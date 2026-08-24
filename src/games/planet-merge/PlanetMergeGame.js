import { BaseGame } from '../BaseGame.js';
import { createGameCanvas, attachPointerEvents, drawGradientBackground } from '../canvasInput.js';
import { preload, drawCircularSprite } from '../imageLoader.js';
import gameManager from '../../core/GameManager.js';
import bus from '../../core/EventBus.js';
import { EVENTS } from '../../core/Events.js';
import i18n from '../../core/I18nManager.js';

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

const PLANET_IMAGES = [
  'assets/images/planet-1.png',
  'assets/images/planet-2.png',
  'assets/images/planet-3.png',
  'assets/images/planet-4.png',
  'assets/images/planet-5.png',
  'assets/images/planet-6.png',
];
const STAR_IMAGES = [
  'assets/images/planet-7.png',
  'assets/images/planet-8.png',
  'assets/images/planet-9.png',
  'assets/images/planet-10.png',
  'assets/images/planet-11.png',
];

const MAX_LEVEL = 11;

const FALLBACK_COLORS = [
  { light: '#eaffff', mid: '#8fe8ff', dark: '#3fa9cf' },
  { light: '#fff0fa', mid: '#ffb0e0', dark: '#d874ad' },
  { light: '#f2ecff', mid: '#c3a6ff', dark: '#8a68d9' },
  { light: '#fff6e0', mid: '#ffd88a', dark: '#d19a3d' }
];

export default class PlanetMergeGame extends BaseGame {
  WALL_L = 14; WALL_R = 346; FLOOR_Y = 528; DANGER_Y = 78;

  radiusFor(level) { return (9 + level * 3.6) * 1.3; }

  init() {
    preload([...MOON_IMAGES, ...STAR_IMAGES]);
    const root = document.getElementById('app-root');
    const { canvas, ctx, resizeObserver } = createGameCanvas(root);
    this.canvas = canvas;
    this.ctx = ctx;
    this._resizeObserver = resizeObserver;

    this.planets = [];
    this.previewX = 180;
    this.nextLevel = 1 + Math.floor(Math.random() * 3);
    this.queuedLevel = 1 + Math.floor(Math.random() * 3);
    this.lastDropTime = 0;
    this.dangerTimer = 0;
    this.over = false;

    this.bombArmed = false;
    this._shakeTime = 0;
    this._explodeFx = null;

    this._detach = attachPointerEvents(canvas, {
      onDown: (p) => this._onDown(p.x, p.y),
      onMove: (p) => this._onMove(p.x, p.y),
      onUp: () => this._onUp()
    });

    this._buildJokerButtons();
  }

  destroy() {
    if (this._detach) this._detach();
    this._resizeObserver?.disconnect();
    this._unsubJokerGranted?.();
    this.canvas?.closest('.game-canvas-wrapper')?.remove();
  }

  _buildJokerButtons() {
    const wrapper = this.canvas.closest('.game-canvas-wrapper');
    if (!wrapper) return;

    const shakeBtn = document.createElement('button');
    shakeBtn.type = 'button';
    shakeBtn.className = 'planet-joker-btn planet-joker-btn--shake';
    shakeBtn.textContent = '\u{1F300}';
    shakeBtn.setAttribute('aria-label', i18n.t('shakeJoker'));
    shakeBtn.title = i18n.t('shakeJoker');
    shakeBtn.addEventListener('click', () => this._requestJoker('shake', shakeBtn));

    const bombBtn = document.createElement('button');
    bombBtn.type = 'button';
    bombBtn.className = 'planet-joker-btn planet-joker-btn--bomb';
    bombBtn.textContent = '\u{1F4A3}';
    bombBtn.setAttribute('aria-label', i18n.t('bombJoker'));
    bombBtn.title = i18n.t('bombJoker');
    bombBtn.addEventListener('click', () => {
      if (this.bombArmed) { this._disarmBomb(); return; }
      this._requestJoker('bomb', bombBtn);
    });

    wrapper.append(shakeBtn, bombBtn);
    this._shakeBtn = shakeBtn;
    this._bombBtn = bombBtn;

    this._unsubJokerGranted = bus.on(EVENTS.AD_JOKER_GRANTED, (jokerId) => this._onJokerGranted(jokerId));
  }

  _requestJoker(jokerId, btnEl) {
    if (this.over || btnEl.disabled) return;
    btnEl.disabled = true;
    btnEl.classList.add('is-busy');
    btnEl.title = i18n.t('watchingAd');
    bus.emit(EVENTS.UI_CLICK);
    bus.emit(EVENTS.AD_JOKER_REQUESTED, jokerId);
  }

  _onJokerGranted(jokerId) {
    if (jokerId === 'shake') {
      this._shakeBtn.disabled = false;
      this._shakeBtn.classList.remove('is-busy');
      this._shakeBtn.title = i18n.t('shakeJoker');
    } else if (jokerId === 'bomb') {
      this._bombBtn.disabled = false;
      this._bombBtn.classList.remove('is-busy');
      this._bombBtn.classList.add('is-armed');
      this._bombBtn.title = i18n.t('bombJoker');
    }
  }

  _disarmBomb() {
    this.bombArmed = false;
    this._bombBtn?.classList.remove('is-armed');
  }

  useJoker(jokerId) {
    if (jokerId === 'shake') this._doShake();
    else if (jokerId === 'bomb') this.bombArmed = true;
  }

  _doShake() {
    for (const p of this.planets) {
      p.vx += (Math.random() - 0.5) * 9;
      p.vy -= Math.random() * 5;
    }
    this._shakeTime = 18;
    bus.emit(EVENTS.SFX_PLAY, 'screenShake');
  }

  _tryDetonate(x, y) {
    let target = null, bestDist = Infinity;
    for (const p of this.planets) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d <= p.r && d < bestDist) { target = p; bestDist = d; }
    }
    if (target) {
      this._explodeFx = { x: target.x, y: target.y, r: target.r, t: 0, dur: 20 };
      this.planets = this.planets.filter((p) => p !== target);
      this._disarmBomb();
      bus.emit(EVENTS.SFX_PLAY, 'bombExplode');
    }
  }

  clampX(x) {
    const r = this.radiusFor(this.nextLevel);
    return clamp(x, this.WALL_L + r, this.WALL_R - r);
  }
  _onDown(x, y) {
    if (this.over) return;
    if (this.bombArmed) { this._tryDetonate(x, y); return; }
    this.previewX = this.clampX(x);
  }
  _onMove(x, y) {
    if (this.over || this.bombArmed) return;
    this.previewX = this.clampX(x);
  }
  _onUp() {
    if (this.over || this.bombArmed) return;
    const now = performance.now();
    if (now - this.lastDropTime < 450) return;
    this.lastDropTime = now;

    const level = this.nextLevel;
    this.planets.push({
      x: this.previewX, y: 40,
      vx: (Math.random() - 0.5) * 0.5,
      vy: 0,
      level, r: this.radiusFor(level),
      restFrames: 0,
      isStar: level >= 7
    });
    this.nextLevel = this.queuedLevel;
    this.queuedLevel = 1 + Math.floor(Math.random() * 3);
  }

  revive() {
    this.planets = this.planets.filter((p) => p.y - p.r >= this.DANGER_Y);
    this.dangerTimer = 0;
    this.over = false;
  }

  update(dt) {
    if (this.over) return;
    const GRAVITY = 0.34;

    if (this._shakeTime > 0) this._shakeTime = Math.max(0, this._shakeTime - dt);
    if (this._explodeFx) {
      this._explodeFx.t += dt;
      if (this._explodeFx.t >= this._explodeFx.dur) this._explodeFx = null;
    }

    for (const p of this.planets) {
      p.vy += GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.995;
    }

    for (const p of this.planets) {
      if (p.x - p.r < this.WALL_L) { p.x = this.WALL_L + p.r; p.vx *= -0.4; }
      if (p.x + p.r > this.WALL_R) { p.x = this.WALL_R - p.r; p.vx *= -0.4; }
      if (p.y + p.r > this.FLOOR_Y) {
        p.y = this.FLOOR_Y - p.r;
        p.vy *= -0.3;
        if (Math.abs(p.vy) < 0.6) p.vy = 0;
      }
    }

    const dead = new Set();
    const spawned = [];
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < this.planets.length; i++) {
        const a = this.planets[i];
        if (dead.has(a)) continue;
        for (let j = i + 1; j < this.planets.length; j++) {
          const b = this.planets[j];
          if (dead.has(b)) continue;

          const dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 0.0001;
          const minDist = a.r + b.r;
          if (dist >= minDist) continue;

          if (pass === 0 && a.level === b.level) {
            dead.add(a); dead.add(b);
            const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
            const newLevel = Math.min(MAX_LEVEL, a.level + 1);
            spawned.push({
              x: mx, y: my, vx: 0, vy: -1.5,
              level: newLevel, r: this.radiusFor(newLevel), restFrames: 0,
              isStar: newLevel >= 7
            });
            gameManager.addScore(a.level >= MAX_LEVEL ? 800 : newLevel * 10);
            bus.emit(EVENTS.SFX_PLAY, 'merge');
            continue;
          }

          const nx = dx / dist, ny = dy / dist;
          const overlap = minDist - dist;
          const ma = a.r * a.r, mb = b.r * b.r, total = ma + mb;
          a.x -= nx * overlap * (mb / total);
          a.y -= ny * overlap * (mb / total);
          b.x += nx * overlap * (ma / total);
          b.y += ny * overlap * (ma / total);

          const relVx = b.vx - a.vx, relVy = b.vy - a.vy;
          const relDot = relVx * nx + relVy * ny;
          if (relDot < 0) {
            const rest = Math.abs(relDot) > 2 ? 0.15 : 0;
            const imp = -(1 + rest) * relDot / (1 / ma + 1 / mb);
            a.vx -= (imp * nx) / ma; a.vy -= (imp * ny) / ma;
            b.vx += (imp * nx) / mb; b.vy += (imp * ny) / mb;
          }
          const relSpeed = Math.hypot(b.vx - a.vx, b.vy - a.vy);
          if (relSpeed < 2) {
            a.vx *= 0.6; a.vy *= 0.6;
            b.vx *= 0.6; b.vy *= 0.6;
          }
        }
      }
    }
    if (dead.size) this.planets = this.planets.filter((p) => !dead.has(p));
    for (const s of spawned) this.planets.push(s);

    for (const p of this.planets) {
      if (Math.abs(p.vx) < 0.3 && Math.abs(p.vy) < 0.3) {
        p.restFrames = (p.restFrames || 0) + dt;
      } else {
        p.restFrames = 0;
      }
    }
    const inDanger = this.planets.some((p) => p.y - p.r < this.DANGER_Y && p.restFrames > 30);
    if (inDanger) {
      this.dangerTimer += dt * 16.67;
      if (this.dangerTimer > 1000) {
        this.over = true;
        gameManager.playerLost();
      }
    } else {
      this.dangerTimer = 0;
    }

    this._render();
  }

  _render() {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;

    // Deep space gradient with nebula feel
    drawGradientBackground(ctx, W, H, [[0, '#0a0e2e'], [0.55, '#05081c'], [1, '#020208']]);

    // Draw distant stars with twinkle
    ctx.save();
    for (let i = 0; i < 120; i++) {
      const sx = (i * 173) % W;
      const sy = (i * 91) % H;
      const twinkle = 0.15 + (Math.sin(performance.now() * 0.001 + i) + 1) * 0.25;
      ctx.globalAlpha = twinkle;
      ctx.fillStyle = (i % 7 === 0) ? '#c3a6ff' : (i % 5 === 0) ? '#8fe8ff' : '#ffffff';
      const sz = (i % 3 === 0) ? 2 : 1;
      ctx.fillRect(sx, sy, sz, sz);
    }
    ctx.restore();

    // Draw subtle grid lines
    ctx.save();
    ctx.strokeStyle = 'rgba(143, 232, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 36) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 36) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    if (this._shakeTime > 0) {
      const mag = Math.min(7, this._shakeTime);
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }

    ctx.save();
    ctx.strokeStyle = 'rgba(255,80,80,0.5)';
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.WALL_L, this.DANGER_Y);
    ctx.lineTo(this.WALL_R, this.DANGER_Y);
    ctx.stroke();
    ctx.restore();

    for (const p of this.planets) this._drawBody(ctx, p.x, p.y, p.r, p.level, 1, p.isStar);

    if (this._explodeFx) {
      const fx = this._explodeFx;
      const t = fx.t / fx.dur;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t);
      ctx.strokeStyle = '#ff8a65';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ff8a65';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, fx.r + t * fx.r * 1.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (!this.over) {
      const r = this.radiusFor(this.nextLevel);
      ctx.save();
      ctx.strokeStyle = 'rgba(143,232,255,0.25)';
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(this.previewX, 50 + r);
      ctx.lineTo(this.previewX, this.FLOOR_Y);
      ctx.stroke();
      ctx.restore();
      this._drawBody(ctx, this.previewX, 40, r, this.nextLevel, 0.9, this.nextLevel >= 7);

      const bx = 325, by = 34;
      ctx.save();
      ctx.fillStyle = 'rgba(16,26,92,0.85)';
      ctx.beginPath();
      if (ctx.roundRect) { ctx.roundRect(bx - 28, by - 26, 56, 52, 10); } else { ctx.rect(bx - 28, by - 26, 56, 52); }
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.font = '8px Poppins, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('NEXT', bx, by - 16);
      ctx.restore();
      this._drawBody(ctx, bx, by + 8, 15, this.queuedLevel, 1, this.queuedLevel >= 7);
    }

    ctx.restore();
  }

  _drawBody(ctx, x, y, r, level, alpha, isStar) {
    ctx.save();
    ctx.globalAlpha = alpha;

    const imgList = isStar ? STAR_IMAGES : PLANET_IMAGES;
    const url = imgList[(level - 1) % imgList.length];
    // Use drawCircularSprite for perfect circular fit matching the physics radius
    const drew = drawCircularSprite(ctx, url, x, y, r * 2.1);

    if (!drew) {
      const c = FALLBACK_COLORS[(level - 1) % FALLBACK_COLORS.length];
      if (isStar) {
        this._drawStarShape(ctx, x, y, r, c);
      } else {
        const grad = ctx.createRadialGradient(x - r * 0.32, y - r * 0.32, r * 0.1, x, y, r);
        grad.addColorStop(0, c.light);
        grad.addColorStop(0.55, c.mid);
        grad.addColorStop(1, c.dark);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    if (isStar) {
      this._drawStarBorder(ctx, x, y, r);
    } else {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(4,8,28,0.6)';
    ctx.font = `bold ${Math.max(9, r * 0.5)}px Baloo 2, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(level, x, y);
    ctx.restore();
  }

  _drawStarShape(ctx, cx, cy, r, colors) {
    const points = 5;
    const outer = r;
    const inner = r * 0.4;
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const angle = Math.PI / 2 + i * Math.PI / points;
      const rad = (i % 2 === 0) ? outer : inner;
      const px = cx + rad * Math.cos(angle);
      const py = cy - rad * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    const grad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, r * 0.1, cx, cy, r);
    grad.addColorStop(0, colors.light);
    grad.addColorStop(0.55, colors.mid);
    grad.addColorStop(1, colors.dark);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  _drawStarBorder(ctx, cx, cy, r) {
    const points = 5;
    const outer = r;
    const inner = r * 0.4;
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const angle = Math.PI / 2 + i * Math.PI / points;
      const rad = (i % 2 === 0) ? outer : inner;
      const px = cx + rad * Math.cos(angle);
      const py = cy - rad * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }
}
