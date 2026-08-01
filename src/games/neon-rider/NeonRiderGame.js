import { BaseGame } from '../BaseGame.js';
import { createGameCanvas, attachPointerEvents, drawGradientBackground } from '../canvasInput.js';
import { preload, drawSprite } from '../imageLoader.js';
import gameManager from '../../core/GameManager.js';
import bus from '../../core/EventBus.js';
import { EVENTS } from '../../core/Events.js';

function normalizeAngle(a) { a = a % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a; }

const PLAYER_SPRITE = 'assets/images/player-car.png';

export default class NeonRiderGame extends BaseGame {
  init() {
    preload([PLAYER_SPRITE]);
    const root = document.getElementById('app-root');
    const { canvas, ctx, resizeObserver } = createGameCanvas(root);
    this.canvas = canvas;
    this.ctx = ctx;
    this._resizeObserver = resizeObserver;

    this.worldX = 0;
    this.baseSpeed = 2.6;
    this.speed = this.baseSpeed;
    this.holding = false;
    this.airborne = false;
    this.vy = 0;
    this.rotation = 0;
    this.spinAccum = 0;
    this.over = false;
    this._stuntPopups = [];
    this._seedA = Math.random() * 1000;
    this._seedB = Math.random() * 1000;

    const startWX = 100;
    this.py = this.terrainY(startWX);

    this._detach = attachPointerEvents(canvas, {
      onDown: () => { this.holding = true; },
      onUp: () => { this.holding = false; }
    });
  }

  destroy() {
    if (this._detach) this._detach();
    this._resizeObserver?.disconnect();
    this.canvas?.closest('.game-canvas-wrapper')?.remove();
  }

  terrainY(wx) {
    return 380
      + Math.sin(wx * 0.012 + this._seedA) * 55
      + Math.sin(wx * 0.03 + this._seedB) * 22
      + Math.sin(wx * 0.004) * 30;
  }
  terrainAngle(wx) {
    const d = 2;
    const y1 = this.terrainY(wx - d), y2 = this.terrainY(wx + d);
    return Math.atan2(y2 - y1, d * 2);
  }

  revive() {
    const wx = this.worldX + 100;
    this.py = this.terrainY(wx);
    this.rotation = this.terrainAngle(wx);
    this.vy = 0;
    this.airborne = false;
    this.spinAccum = 0;
    this.speed = this.baseSpeed;
    this.over = false;
    this._stuntPopups = [];
  }

  update(dt) {
    if (this.over) {
      this._render();
      return;
    }
    this.worldX += this.speed * dt;
    const wx = this.worldX + 100;
    const groundY = this.terrainY(wx);

    if (!this.airborne) {
      this.speed = this.holding
        ? Math.min(6.5, this.speed + 0.01 * dt)
        : Math.max(this.baseSpeed, this.speed - 0.006 * dt);

      const slope = this.terrainAngle(wx);
      if (slope < -0.55) {
        this.airborne = true;
        this.vy = -Math.max(6, this.speed * 1.8);
        this.spinAccum = 0;
      } else {
        this.py = groundY;
        this.rotation = slope;
      }
    } else {
      this.vy += 0.3 * dt;
      this.py += this.vy * dt;
      if (this.holding) {
        const spin = 0.22 * dt;
        this.rotation -= spin;
        this.spinAccum += spin;
      }
      if (this.py >= groundY) {
        const slope = this.terrainAngle(wx);
        let diff = Math.abs(normalizeAngle(this.rotation) - normalizeAngle(slope));
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        if (diff < 0.5) {
          this.airborne = false;
          this.py = groundY;
          this.vy = 0;
          this.rotation = slope;
          const flips = Math.floor(this.spinAccum / (Math.PI * 2));
          let points = 10;
          if (flips >= 2) points += 5;
          else if (flips === 1) points += 3;
          gameManager.addScore(points);
          if (flips > 0) {
            this._stuntPopups.push({ text: `+${flips >= 2 ? 5 : 3}`, x: 100, y: this.py - 40, t: 0, dur: 40 });
            bus.emit(EVENTS.ANNOUNCER_TRIGGER, { type: 'combo', value: flips });
          }
          bus.emit(EVENTS.SFX_PLAY, 'landPerfect');
        } else {
          this.over = true;
          bus.emit(EVENTS.SFX_PLAY, 'crash');
          gameManager.playerLost();
        }
      }
    }

    if (this.py > this.canvas.height + 60) {
      this.over = true;
      gameManager.playerLost();
    }

    for (const p of this._stuntPopups) p.t += dt;
    this._stuntPopups = this._stuntPopups.filter(p => p.t < p.dur);

    this._render();
  }

  _render() {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;

    drawGradientBackground(ctx, W, H, [[0, '#0a0e2e'], [0.5, '#05081c'], [1, '#020208']]);

    ctx.save();
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 60; i++) {
      const sx = ((i * 137.5 + this.worldX * 0.05) % W);
      const sy = ((i * 73.3) % (H * 0.6));
      const size = (i % 3 === 0) ? 2 : 1;
      ctx.globalAlpha = 0.3 + (i % 5) * 0.15;
      ctx.fillRect(sx, sy, size, size);
    }
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    for (let sx = 0; sx <= W; sx += 4) {
      const gy = this.terrainY(this.worldX + sx);
      if (sx === 0) ctx.moveTo(sx, gy); else ctx.lineTo(sx, gy);
    }
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
    const grad = ctx.createLinearGradient(0, 200, 0, H);
    grad.addColorStop(0, 'rgba(0,255,180,0.12)');
    grad.addColorStop(1, 'rgba(0,100,80,0.35)');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = '#00ffc8';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#00ffc8';
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = 'rgba(0,255,200,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let sx = 0; sx <= W; sx += 4) {
      const gy = this.terrainY(this.worldX + sx) - 8;
      if (sx === 0) ctx.moveTo(sx, gy); else ctx.lineTo(sx, gy);
    }
    ctx.stroke();
    ctx.restore();

    const drew = drawSprite(ctx, PLAYER_SPRITE, 100, this.py, 44, 44, this.rotation);
    if (!drew) {
      ctx.save();
      ctx.translate(100, this.py);
      ctx.rotate(this.rotation);
      ctx.fillStyle = '#ff00c8';
      ctx.shadowColor = '#ff00c8';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.moveTo(-20, 14); ctx.lineTo(20, 14); ctx.lineTo(0, -20);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    for (const p of this._stuntPopups) {
      const alpha = Math.max(0, 1 - p.t / p.dur);
      const yOff = -p.t * 1.5;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#00ffc8';
      ctx.font = 'bold 20px Baloo 2, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#00ffc8';
      ctx.shadowBlur = 8;
      ctx.fillText(p.text, p.x, p.y + yOff);
      ctx.restore();
    }
  }
}
