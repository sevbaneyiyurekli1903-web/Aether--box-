import { BaseGame } from '../BaseGame.js';
import { createGameCanvas, attachPointerEvents, drawGradientBackground } from '../canvasInput.js';
import gameManager from '../../core/GameManager.js';
import bus from '../../core/EventBus.js';
import { EVENTS } from '../../core/Events.js';

function rand(min, max) { return min + Math.random() * (max - min); }
const COLORS = ['#8fe8ff', '#ffb0e0', '#ffd88a'];

/**
 * ColorSwitchGame.js
 * -----------------------------------------------------------------
 * Tap to cycle the player's color through the crystal palette;
 * colored bars scroll in from the right and must be passed while
 * matching that bar's color. Ported from the original Aether Box
 * prototype and re-themed for the crystal palette.
 * -----------------------------------------------------------------
 */
export default class ColorSwitchGame extends BaseGame {
  init() {
    const root = document.getElementById('app-root');
    const { canvas, ctx, resizeObserver } = createGameCanvas(root);
    this.canvas = canvas;
    this.ctx = ctx;
    this._resizeObserver = resizeObserver;

    this.playerColor = 0;
    this.playerX = 70; this.playerY = 470; this.playerR = 20; // 15 * 1.3, visual scaling pass
    this.obstacles = [];
    this.spawnTimer = 40;
    this.speed = 2.6;
    this.over = false;
    this.invulnFrames = 0;

    this._detach = attachPointerEvents(canvas, {
      onDown: () => this._cycle()
    });
  }

  destroy() {
    if (this._detach) this._detach();
    this._resizeObserver?.disconnect();
    this.canvas?.closest('.game-canvas-wrapper')?.remove();
  }

  _cycle() {
    if (this.over) return;
    this.playerColor = (this.playerColor + 1) % 3;
    bus.emit(EVENTS.SFX_PLAY, 'gravityFlip');
  }

  /** Ad-revive: clear the obstacle band around the player, brief grace window. */
  revive() {
    this.obstacles = this.obstacles.filter((o) => Math.abs(o.x - this.playerX) > 60);
    this.invulnFrames = 90;
    this.over = false;
  }

  update(dt) {
    if (this.over) return;
    if (this.invulnFrames > 0) this.invulnFrames -= dt;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 70 + rand(0, 20);
      this.obstacles.push({ x: 376, w: 26, c: Math.floor(Math.random() * 3), passed: false }); // 20 * 1.3
    }
    for (const o of this.obstacles) o.x -= this.speed * dt;
    this.obstacles = this.obstacles.filter((o) => o.x > -30);
    this.speed = Math.min(5, this.speed + 0.001 * dt);

    for (const o of this.obstacles) {
      if (!o.passed && o.x + o.w < this.playerX - this.playerR) {
        o.passed = true;
        gameManager.addScore(1);
      }
      if (this.invulnFrames > 0) continue;
      const overlapsX = this.playerX + this.playerR > o.x && this.playerX - this.playerR < o.x + o.w;
      if (overlapsX && o.c !== this.playerColor) {
        this.over = true;
        bus.emit(EVENTS.SFX_PLAY, 'crash');
        gameManager.playerLost();
      }
    }

    this._render();
  }

  _render() {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    // Deep forest-green gradient (was a flat bright green) -- darker
    // per spec, edge-to-edge with no letterbox gap.
    drawGradientBackground(ctx, W, H, [[0, '#0e3d1a'], [0.6, '#071f0d'], [1, '#020a04']]);

    for (const o of this.obstacles) {
      ctx.save();
      ctx.fillStyle = COLORS[o.c];
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 8;
      ctx.fillRect(o.x, 0, o.w, H);
      ctx.restore();
    }

    ctx.save();
    if (this.invulnFrames > 0 && Math.floor(this.invulnFrames / 6) % 2 === 0) ctx.globalAlpha = 0.4;
    ctx.fillStyle = COLORS[this.playerColor];
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(this.playerX, this.playerY, this.playerR, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.restore();
  }
}
