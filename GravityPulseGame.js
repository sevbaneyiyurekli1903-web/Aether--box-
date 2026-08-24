import { BaseGame } from '../BaseGame.js';
import { createGameCanvas, attachPointerEvents, drawGradientBackground } from '../canvasInput.js';
import { preload, drawSprite } from '../imageLoader.js';
import gameManager from '../../core/GameManager.js';
import bus from '../../core/EventBus.js';
import { EVENTS } from '../../core/Events.js';

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function rand(min, max) { return min + Math.random() * (max - min); }

const PLAYER_SPRITE = 'assets/images/gravity-pulse-player.png';

/**
 * GravityPulseGame.js
 * -----------------------------------------------------------------
 * Flappy-style: tap reverses the direction gravity currently pulls
 * (continuous arc physics, not a discrete position swap like Gravity
 * Flip). Now draws the real player sprite asset.
 * -----------------------------------------------------------------
 */
export default class GravityPulseGame extends BaseGame {
  init() {
    preload([PLAYER_SPRITE]);
    const root = document.getElementById('app-root');
    const { canvas, ctx, resizeObserver } = createGameCanvas(root);
    this.canvas = canvas;
    this.ctx = ctx;
    this._resizeObserver = resizeObserver;

    this.player = { x: 70, y: 270, vy: 0, r: 20 }; // 15 * 1.3, visual scaling pass
    this.gravityDir = 1;
    this.obstacles = [];
    this.spawnTimer = 40;
    this.speed = 2.2;
    this.over = false;
    this.invulnFrames = 0;

    this._detach = attachPointerEvents(canvas, {
      onDown: () => this._pulse()
    });
  }

  destroy() {
    if (this._detach) this._detach();
    this._resizeObserver?.disconnect();
    this.canvas?.closest('.game-canvas-wrapper')?.remove();
  }

  _pulse() {
    if (this.over) return;
    this.gravityDir *= -1;
    bus.emit(EVENTS.SFX_PLAY, 'gravityFlip');
  }

  revive() {
    this.obstacles = this.obstacles.filter((o) => Math.abs(o.x - this.player.x) > 70);
    this.invulnFrames = 90;
    this.player.vy = 0;
    this.over = false;
  }

  update(dt) {
    if (this.over) return;
    if (this.invulnFrames > 0) this.invulnFrames -= dt;

    this.player.vy += 0.24 * this.gravityDir * dt;
    this.player.vy = clamp(this.player.vy, -7, 7);
    this.player.y += this.player.vy * dt;
    const H = this.canvas.height;
    if (this.player.y < this.player.r) { this.player.y = this.player.r; this.player.vy = 0; }
    if (this.player.y > H - this.player.r) { this.player.y = H - this.player.r; this.player.vy = 0; }

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 68;
      const gapH = 140;
      const gapY = rand(60, H - 60 - gapH);
      this.obstacles.push({ x: 376, w: 34, gapY, gapH, passed: false }); // 26 * 1.3
    }
    for (const o of this.obstacles) o.x -= this.speed * dt;
    this.obstacles = this.obstacles.filter((o) => o.x > -40);
    this.speed = Math.min(4, this.speed + 0.0006 * dt);

    for (const o of this.obstacles) {
      if (!o.passed && o.x + o.w < this.player.x - this.player.r) {
        o.passed = true;
        gameManager.addScore(1);
      }
      if (this.invulnFrames > 0) continue;
      const overlapsX = this.player.x + this.player.r > o.x && this.player.x - this.player.r < o.x + o.w;
      if (overlapsX) {
        if (this.player.y - this.player.r < o.gapY || this.player.y + this.player.r > o.gapY + o.gapH) {
          this.over = true;
          bus.emit(EVENTS.SFX_PLAY, 'crash');
          gameManager.playerLost();
        }
      }
    }

    this._render();
  }

  _render() {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    // Deep red gradient (was a flat bright red) -- darker per spec,
    // edge-to-edge with no letterbox gap.
    drawGradientBackground(ctx, W, H, [[0, '#4a0e0e'], [0.6, '#260707'], [1, '#080202']]);
    // Energy pulse lines
    ctx.save();
    ctx.strokeStyle = 'rgba(195,166,255,0.1)';
    ctx.lineWidth = 2;
    const time = performance.now() * 0.002;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      for (let x = 0; x < W; x += 5) {
        const y = H / 2 + Math.sin(x * 0.02 + time + i) * (40 + i * 15);
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();

    for (const o of this.obstacles) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 8;
      const grad = ctx.createLinearGradient(o.x, 0, o.x + o.w, 0);
      grad.addColorStop(0, '#c3a6ff');
      grad.addColorStop(1, '#8a68d9');
      ctx.fillStyle = grad;
      ctx.fillRect(o.x, 0, o.w, o.gapY);
      ctx.fillRect(o.x, o.gapY + o.gapH, o.w, H - (o.gapY + o.gapH));
      ctx.restore();
    }

    ctx.save();
    if (this.invulnFrames > 0 && Math.floor(this.invulnFrames / 6) % 2 === 0) ctx.globalAlpha = 0.4;
    const angle = clamp(this.player.vy * 0.08, -0.6, 0.6);
    const drew = drawSprite(ctx, PLAYER_SPRITE, this.player.x, this.player.y, this.player.r * 2, this.player.r * 2, angle);
    if (!drew) {
      ctx.fillStyle = '#8fe8ff';
      ctx.beginPath();
      ctx.arc(this.player.x, this.player.y, this.player.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '10px Poppins, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(this.gravityDir > 0 ? 'GRAVITY \u2193' : 'GRAVITY \u2191', W - 12, 26);
    ctx.restore();
  }
}
