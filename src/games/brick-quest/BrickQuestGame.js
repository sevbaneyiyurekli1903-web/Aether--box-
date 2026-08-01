import { BaseGame } from '../BaseGame.js';
import { createGameCanvas, attachPointerEvents, drawGradientBackground } from '../canvasInput.js';
import gameManager from '../../core/GameManager.js';
import bus from '../../core/EventBus.js';
import { EVENTS } from '../../core/Events.js';

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

/**
 * BrickQuestGame.js
 * -----------------------------------------------------------------
 * Swipe-to-aim brick breaker: drag to aim (dotted trajectory shown),
 * release fires a stream of balls that bounce and hit numbered
 * bricks; bricks shift down one row per volley.
 *
 * Difficulty spike pass: brick HP is now 1-100 (was 1-5), so bricks
 * take many more hits to clear. Column count reduced from 6 to 5 to
 * keep the grid fitting the canvas after the 30% cell-size increase
 * (6 cols at the new width would overflow past 360px).
 * -----------------------------------------------------------------
 */
export default class BrickQuestGame extends BaseGame {
  // Cell size scaled up 30% (54x24 -> 70x31). Columns reduced 6 -> 5 so
  // the wider cells still fit the canvas (5 * 70 = 350, fits with a
  // 5px margin each side; 6 * 70 = 420 would overflow).
  cols = 5; cellW = 70; cellH = 31; gridTop = 16; gridLeft = 5;

  init() {
    const root = document.getElementById('app-root');
    const { canvas, ctx, resizeObserver } = createGameCanvas(root);
    this.canvas = canvas;
    this.ctx = ctx;
    this._resizeObserver = resizeObserver;

    this.launcher = { x: 180, y: 512 };
    this.aiming = false;
    this.aimAngle = -Math.PI / 2;
    this.balls = [];
    this.bricks = [];
    this.ballCount = 3;
    this.shooting = false;
    this.shotsRemaining = 0;
    this.shotTimer = 0;
    this.over = false;

    this._spawnRow(); this._spawnRow(); this._spawnRow();

    this._detach = attachPointerEvents(canvas, {
      onDown: (p) => this._onDown(p.x, p.y),
      onMove: (p) => this._onMove(p.x, p.y),
      onUp: () => this._onUp()
    });
  }

  destroy() {
    if (this._detach) this._detach();
    this._resizeObserver?.disconnect();
    this.canvas?.closest('.game-canvas-wrapper')?.remove();
  }

  brickX(col) { return this.gridLeft + col * this.cellW; }
  brickY(row) { return this.gridTop + row * this.cellH; }

  _spawnRow() {
    for (const b of this.bricks) b.row += 1;
    for (let c = 0; c < this.cols; c++) {
      if (Math.random() < 0.65) {
        // Difficulty spike: HP now ranges 1-100 (was 1-5).
        this.bricks.push({ col: c, row: 0, hp: 1 + Math.floor(Math.random() * 100) });
      }
    }
  }

  _onDown(x, y) {
    if (this.over || this.shooting) return;
    this.aiming = true;
    this._updateAim(x, y);
  }
  _onMove(x, y) { if (this.aiming) this._updateAim(x, y); }
  _updateAim(x, y) {
    let a = Math.atan2(y - this.launcher.y, x - this.launcher.x);
    this.aimAngle = clamp(a, -Math.PI + 0.2, -0.2);
  }
  _onUp() {
    if (!this.aiming) return;
    this.aiming = false;
    this.shooting = true;
    this.shotsRemaining = this.ballCount;
    this.shotTimer = 0;
  }

  /** Ad-revive: clear the most dangerous (highest) row of bricks. */
  revive() {
    if (this.bricks.length) {
      const minRow = Math.min(...this.bricks.map((b) => b.row));
      this.bricks = this.bricks.filter((b) => b.row !== minRow || b.row > 2);
    }
    this.over = false;
  }

  update(dt) {
    if (this.over) return;

    if (this.shooting) {
      this.shotTimer -= dt;
      if (this.shotsRemaining > 0 && this.shotTimer <= 0) {
        this.balls.push({
          x: this.launcher.x, y: this.launcher.y,
          vx: Math.cos(this.aimAngle) * 7.5,
          vy: Math.sin(this.aimAngle) * 7.5
        });
        this.shotsRemaining--;
        this.shotTimer = 5;
      }
    }

    for (const ball of this.balls) {
      ball.vy += 0.028 * dt;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      if (ball.x < 8) { ball.x = 8; ball.vx *= -1; }
      if (ball.x > 352) { ball.x = 352; ball.vx *= -1; }
      if (ball.y < 8) { ball.y = 8; ball.vy *= -1; }

      for (const b of this.bricks) {
        const bx = this.brickX(b.col), by = this.brickY(b.row);
        if (ball.x > bx && ball.x < bx + this.cellW - 6 && ball.y > by && ball.y < by + this.cellH - 6) {
          b.hp--;
          ball.vy *= -1;
          if (b.hp <= 0) gameManager.addScore(10);
        }
      }
    }
    this.bricks = this.bricks.filter((b) => b.hp > 0);
    this.balls = this.balls.filter((ball) => ball.y < 546);

    if (this.shooting && this.shotsRemaining <= 0 && this.balls.length === 0) {
      this.shooting = false;
      this.ballCount++;
      this._spawnRow();
      const dangerRow = Math.floor((this.launcher.y - 60 - this.gridTop) / this.cellH);
      if (this.bricks.some((b) => b.row >= dangerRow)) {
        this.over = true;
        gameManager.playerLost();
      }
    }

    this._render();
  }

  /** Color mapping re-derived for the 1-100 HP pool (the old formula
   *  `140 - hp*18` clamped to 0 for anything above hp=8, making almost
   *  every brick the same color once the pool grew). Now spread
   *  linearly across the FULL range: hp=1 -> green, hp=100 -> red. */
  _colorFor(hp) {
    const hue = Math.round(clamp(130 - (hp / 100) * 130, 0, 130));
    return `hsl(${hue},80%,60%)`;
  }

  _render() {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    // Deep burnt-orange gradient (was a flat bright orange) -- darker
    // per spec, edge-to-edge with no letterbox gap.
    drawGradientBackground(ctx, W, H, [[0, '#4a2b06'], [0.6, '#241503'], [1, '#0a0602']]);

    for (const b of this.bricks) {
      const bx = this.brickX(b.col), by = this.brickY(b.row);
      const col = this._colorFor(b.hp);
      ctx.save();
      ctx.fillStyle = 'rgba(10,10,30,0.85)';
      ctx.strokeStyle = col;
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 6;
      ctx.lineWidth = 1.5;
      ctx.fillRect(bx, by, this.cellW - 6, this.cellH - 6);
      ctx.strokeRect(bx, by, this.cellW - 6, this.cellH - 6);
      ctx.shadowBlur = 0;
      ctx.fillStyle = col;
      // 13px comfortably fits a 3-digit number in the new, larger cell
      // (cellW-6 = 64px wide) -- was 12px sized for a 1-digit number.
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.hp, bx + (this.cellW - 6) / 2, by + (this.cellH - 6) / 2);
      ctx.restore();
    }

    if (this.aiming) {
      ctx.save();
      ctx.strokeStyle = 'rgba(20,20,30,0.55)';
      ctx.setLineDash([5, 6]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.launcher.x, this.launcher.y);
      ctx.lineTo(this.launcher.x + Math.cos(this.aimAngle) * 400, this.launcher.y + Math.sin(this.aimAngle) * 400);
      ctx.stroke();
      ctx.restore();
    }

    for (const ball of this.balls) {
      ctx.save();
      ctx.fillStyle = '#3f2a00';
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, 7, 0, Math.PI * 2); // 5 * 1.3, visual scaling pass
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.fillStyle = '#1c1140';
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(this.launcher.x, this.launcher.y, 12, 0, Math.PI * 2); // 9 * 1.3
    ctx.fill();
    ctx.restore();

    if (this.shooting) {
      ctx.save();
      ctx.fillStyle = 'rgba(20,20,30,0.7)';
      ctx.font = '10px Poppins, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.shotsRemaining + ' left', this.launcher.x, this.launcher.y + 24);
      ctx.restore();
    }
  }
}
