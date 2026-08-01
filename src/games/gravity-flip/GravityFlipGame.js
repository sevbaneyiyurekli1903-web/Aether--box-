import { BaseGame } from '../BaseGame.js';
import { createGameCanvas, attachPointerEvents, drawGradientBackground } from '../canvasInput.js';
import { preload, drawSprite } from '../imageLoader.js';
import gameManager from '../../core/GameManager.js';
import bus from '../../core/EventBus.js';
import { EVENTS } from '../../core/Events.js';

function rand(min, max) { return min + Math.random() * (max - min); }

const PLAYER_SPRITE = 'https://i.supaimg.com/92a3b603-2eb1-4604-ac92-569047989f8c/53b42d89-b07e-4b14-87ee-8fe3f4c7929d.png';
const OBSTACLE_SPRITE = 'https://i.supaimg.com/92a3b603-2eb1-4604-ac92-569047989f8c/0c65a3b6-5bae-436a-958f-8525f037ba75.png';

/**
 * GravityFlipGame.js
 * -----------------------------------------------------------------
 * Tap-to-flip auto-runner: the player instantly swaps between the
 * floor and the ceiling to dodge obstacles scrolling in from the
 * right. Now draws the real player/obstacle sprite assets (falls
 * back to a plain shape for the brief moment before they load).
 * -----------------------------------------------------------------
 */
export default class GravityFlipGame extends BaseGame {
  init() {
    preload([PLAYER_SPRITE, OBSTACLE_SPRITE]);
    const root = document.getElementById('app-root');
    const { canvas, ctx, resizeObserver } = createGameCanvas(root);
    this.canvas = canvas;
    this.ctx = ctx;
    this._resizeObserver = resizeObserver;

    this.onFloor = true;
    this.playerX = 70;
    this.playerR = 21; // 16 * 1.3, visual scaling pass
    this.obstacles = [];
    this.spawnTimer = 60;
    this.speed = 3;
    this.distance = 0;
    this.over = false;
    this.invulnFrames = 0;

    this._detach = attachPointerEvents(canvas, {
      onDown: () => this._flip()
    });
  }

  destroy() {
    if (this._detach) this._detach();
    this._resizeObserver?.disconnect();
    this.canvas?.closest('.game-canvas-wrapper')?.remove();
  }

  _flip() {
    if (this.over) return;
    this.onFloor = !this.onFloor;
    bus.emit(EVENTS.SFX_PLAY, 'gravityFlip');
  }

  revive() {
    this.obstacles = this.obstacles.filter((o) => o.x > this.playerX + 60 || o.x + o.w < this.playerX - 40);
    this.invulnFrames = 90;
    this.over = false;
  }

  update(dt) {
    if (this.over) return;
    if (this.invulnFrames > 0) this.invulnFrames -= dt;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 65 + rand(0, 30);
      const side = Math.random() < 0.5 ? 'floor' : 'ceiling';
      this.obstacles.push({ x: 376, w: 34, h: 39, side }); // 26,30 * 1.3
    }
    for (const o of this.obstacles) o.x -= this.speed * dt;
    this.obstacles = this.obstacles.filter((o) => o.x > -30);
    this.speed = Math.min(6, this.speed + 0.0012 * dt);

    this.distance += dt;
    if (Math.floor(this.distance / 12) > Math.floor((this.distance - dt) / 12)) gameManager.addScore(1);

    if (this.invulnFrames <= 0) {
      for (const o of this.obstacles) {
        const overlapsX = this.playerX + this.playerR > o.x && this.playerX - this.playerR < o.x + o.w;
        if (!overlapsX) continue;
        const collides = o.side === 'floor' ? this.onFloor : !this.onFloor;
        if (collides) {
          this.over = true;
          bus.emit(EVENTS.SFX_PLAY, 'crash');
          gameManager.playerLost();
          break;
        }
      }
    }

    this._render();
  }

  _render() {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    // Deep maroon-pink gradient (was a flat bright pink) -- darker per
    // spec, edge-to-edge with no letterbox gap.
    drawGradientBackground(ctx, W, H, [[0, '#4a0f2e'], [0.6, '#26071a'], [1, '#08030a']]);

    ctx.save();
    ctx.strokeStyle = 'rgba(143,232,255,0.3)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 20); ctx.lineTo(W, 20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 520); ctx.lineTo(W, 520); ctx.stroke();
    ctx.restore();

    for (const o of this.obstacles) {
      const y = o.side === 'floor' ? 520 - o.h : 20;
      const cx = o.x + o.w / 2, cy = y + o.h / 2;
      const drew = drawSprite(ctx, OBSTACLE_SPRITE, cx, cy, o.w, o.h);
      if (!drew) {
        ctx.save();
        ctx.fillStyle = '#ffb0e0';
        ctx.fillRect(o.x, y, o.w, o.h);
        ctx.restore();
      }
    }

    const py = this.onFloor ? 520 - this.playerR : 20 + this.playerR;
    ctx.save();
    if (this.invulnFrames > 0 && Math.floor(this.invulnFrames / 6) % 2 === 0) ctx.globalAlpha = 0.4;
    const drewPlayer = drawSprite(ctx, PLAYER_SPRITE, this.playerX, py, this.playerR * 2, this.playerR * 2);
    if (!drewPlayer) {
      ctx.fillStyle = '#8fe8ff';
      ctx.beginPath();
      ctx.arc(this.playerX, py, this.playerR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
