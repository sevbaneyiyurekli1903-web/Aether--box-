import { BaseGame } from '../BaseGame.js';
import { createGameCanvas, attachPointerEvents, drawGradientBackground } from '../canvasInput.js';
import gameManager from '../../core/GameManager.js';
import bus from '../../core/EventBus.js';
import { EVENTS } from '../../core/Events.js';

function normalizeAngle(a) { a = a % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a; }
function rand(min, max) { return min + Math.random() * (max - min); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

const NEON_COLORS = ['#00f0ff', '#ff00c8', '#00ff88', '#ffaa00', '#aa00ff'];
const SEGMENT_LENGTH = 120;

/**
 * NeonRiderGame.js
 * -----------------------------------------------------------------
 * Synthwave-themed endless driving & flipping game.
 * Pure black background, neon track, geometric obstacles.
 * One-touch: hold to accelerate/flip, release to free-fall.
 * -----------------------------------------------------------------
 */
export default class NeonRiderGame extends BaseGame {
  init() {
    const root = document.getElementById('app-root');
    const { canvas, ctx, resizeObserver } = createGameCanvas(root);
    this.canvas = canvas;
    this.ctx = ctx;
    this._resizeObserver = resizeObserver;

    this.worldX = 0;
    this.baseSpeed = 2.8;
    this.speed = this.baseSpeed;
    this.holding = false;
    this.airborne = false;
    this.vy = 0;
    this.rotation = 0;
    this.spinAccum = 0;
    this.over = false;
    this._stuntPopups = [];
    this._particles = [];
    this._distance = 0;
    this._colorIndex = 0;
    this._colorTimer = 0;

    // Car state
    this.car = { x: 100, y: 300, r: 18, width: 40, height: 24 };

    // Track segments
    this._segments = [];
    this._diamonds = [];
    this._breakables = [];
    this._saws = [];
    this._blades = [];
    this._gates = [];
    this._boosts = [];
    this._generateInitialTrack();

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

  _generateInitialTrack() {
    let x = 0;
    const types = ['FLAT', 'RAMP_UP', 'RAMP_DOWN', 'GAP', 'FLAT', 'BOOST', 'FLAT', 'BREAKABLE', 'FLAT', 'SAW', 'FLAT', 'BLADE', 'FLAT', 'GATE'];
    for (let i = 0; i < 40; i++) {
      const type = types[i % types.length];
      const len = type === 'GAP' ? rand(50, 90) : type === 'BOOST' ? 50 : SEGMENT_LENGTH + rand(-20, 40);
      const seg = { type, startX: x, endX: x + len, length: len };
      if (type === 'RAMP_UP') seg.peakH = rand(60, 110);
      if (type === 'RAMP_DOWN') seg.peakH = rand(60, 110);
      if (type === 'GAP') seg.gapDepth = rand(120, 200);
      this._segments.push(seg);

      // Add diamonds on ramps and flats
      if (type === 'FLAT' || type === 'RAMP_UP' || type === 'RAMP_DOWN') {
        const dCount = Math.floor(rand(1, 4));
        for (let d = 0; d < dCount; d++) {
          this._diamonds.push({
            x: x + rand(10, len - 10),
            yOffset: rand(-60, -20),
            collected: false,
            r: 7
          });
        }
      }

      // Breakable platforms
      if (type === 'BREAKABLE') {
        this._breakables.push({ x: x + 10, w: len - 20, broken: false, breakTimer: 0 });
      }

      // Saws
      if (type === 'SAW') {
        this._saws.push({ x: x + len / 2, y: 340, r: 22, angle: 0 });
      }

      // Blades (guillotine)
      if (type === 'BLADE') {
        this._blades.push({ x: x + len / 2, yTop: 80, yBottom: 300, phase: rand(0, Math.PI * 2) });
      }

      // Gates
      if (type === 'GATE') {
        this._gates.push({ x: x + len / 2, open: true, timer: 0, phase: rand(0, Math.PI * 2) });
      }

      // Boosts
      if (type === 'BOOST') {
        this._boosts.push({ x: x + len / 2, w: len });
      }

      x += len;
    }
  }

  _extendTrack() {
    const last = this._segments[this._segments.length - 1];
    let x = last.endX;
    const types = ['FLAT', 'RAMP_UP', 'RAMP_DOWN', 'GAP', 'FLAT', 'BOOST', 'FLAT', 'BREAKABLE', 'FLAT', 'SAW', 'FLAT', 'BLADE', 'FLAT', 'GATE'];
    for (let i = 0; i < 10; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      const len = type === 'GAP' ? rand(50, 90) : type === 'BOOST' ? 50 : SEGMENT_LENGTH + rand(-20, 40);
      const seg = { type, startX: x, endX: x + len, length: len };
      if (type === 'RAMP_UP') seg.peakH = rand(60, 110);
      if (type === 'RAMP_DOWN') seg.peakH = rand(60, 110);
      if (type === 'GAP') seg.gapDepth = rand(120, 200);
      this._segments.push(seg);

      if (type === 'FLAT' || type === 'RAMP_UP' || type === 'RAMP_DOWN') {
        const dCount = Math.floor(rand(1, 3));
        for (let d = 0; d < dCount; d++) {
          this._diamonds.push({
            x: x + rand(10, len - 10),
            yOffset: rand(-60, -20),
            collected: false,
            r: 7
          });
        }
      }
      if (type === 'BREAKABLE') {
        this._breakables.push({ x: x + 10, w: len - 20, broken: false, breakTimer: 0 });
      }
      if (type === 'SAW') {
        this._saws.push({ x: x + len / 2, y: 340, r: 22, angle: 0 });
      }
      if (type === 'BLADE') {
        this._blades.push({ x: x + len / 2, yTop: 80, yBottom: 300, phase: rand(0, Math.PI * 2) });
      }
      if (type === 'GATE') {
        this._gates.push({ x: x + len / 2, open: true, timer: 0, phase: rand(0, Math.PI * 2) });
      }
      if (type === 'BOOST') {
        this._boosts.push({ x: x + len / 2, w: len });
      }
      x += len;
    }
  }

  _getSegmentAt(wx) {
    for (const seg of this._segments) {
      if (wx >= seg.startX && wx < seg.endX) return seg;
    }
    return this._segments[this._segments.length - 1];
  }

  _trackY(wx) {
    const seg = this._getSegmentAt(wx);
    if (!seg) return 380;
    const t = (wx - seg.startX) / seg.length;
    const baseY = 380;
    switch (seg.type) {
      case 'FLAT': return baseY;
      case 'RAMP_UP': return baseY - Math.sin(t * Math.PI / 2) * seg.peakH;
      case 'RAMP_DOWN': return baseY - Math.cos(t * Math.PI / 2) * seg.peakH;
      case 'GAP': return baseY + seg.gapDepth; // deep pit
      case 'BOOST': return baseY;
      case 'BREAKABLE': return baseY - 30;
      case 'SAW': return baseY;
      case 'BLADE': return baseY;
      case 'GATE': return baseY;
      default: return baseY;
    }
  }

  _trackAngle(wx) {
    const d = 4;
    const y1 = this._trackY(wx - d);
    const y2 = this._trackY(wx + d);
    return Math.atan2(y2 - y1, d * 2);
  }

  revive() {
    const wx = this.worldX + 100;
    this.car.y = this._trackY(wx);
    this.rotation = this._trackAngle(wx);
    this.vy = 0;
    this.airborne = false;
    this.spinAccum = 0;
    this.speed = this.baseSpeed;
    this.over = false;
    this._stuntPopups = [];
    this._particles = [];
  }

  update(dt) {
    if (this.over) {
      this._render();
      return;
    }

    this.worldX += this.speed * dt;
    this._distance += this.speed * dt;
    const wx = this.worldX + 100;
    const groundY = this._trackY(wx);
    const nextSeg = this._getSegmentAt(wx + 60);

    // Extend track if needed
    const lastSeg = this._segments[this._segments.length - 1];
    if (wx > lastSeg.endX - 400) this._extendTrack();

    // Color shift over distance
    this._colorTimer += dt;
    if (this._colorTimer > 300) {
      this._colorTimer = 0;
      this._colorIndex = (this._colorIndex + 1) % NEON_COLORS.length;
    }

    if (!this.airborne) {
      this.speed = this.holding
        ? Math.min(7, this.speed + 0.012 * dt)
        : Math.max(this.baseSpeed, this.speed - 0.006 * dt);

      // Check for gap ahead
      if (nextSeg && nextSeg.type === 'GAP' && (nextSeg.startX - wx) < 80 && this.speed < 5) {
        // Not enough speed for gap -> fall
        this.airborne = true;
        this.vy = 0;
        this.spinAccum = 0;
      }

      // Check boost
      for (const b of this._boosts) {
        if (Math.abs(b.x - wx) < b.w / 2 && !b.used) {
          b.used = true;
          this.airborne = true;
          this.vy = -10 - this.speed * 0.8;
          this.spinAccum = 0;
          bus.emit(EVENTS.SFX_PLAY, 'jump');
        }
      }

      // Normal ground behavior
      if (nextSeg && nextSeg.type !== 'GAP') {
        const slope = this._trackAngle(wx);
        if (slope < -0.5 && this.holding) {
          // Launch off steep ramp
          this.airborne = true;
          this.vy = -Math.max(6, this.speed * 1.6);
          this.spinAccum = 0;
        } else {
          this.car.y = groundY - this.car.height / 2;
          this.rotation = slope;
        }
      }
    } else {
      this.vy += 0.32 * dt;
      this.car.y += this.vy * dt;
      if (this.holding) {
        const spin = 0.22 * dt;
        this.rotation -= spin;
        this.spinAccum += spin;
      }

      // Landing check
      if (this.car.y >= groundY - this.car.height / 2 && this.vy > 0) {
        const slope = this._trackAngle(wx);
        let diff = Math.abs(normalizeAngle(this.rotation) - normalizeAngle(slope));
        if (diff > Math.PI) diff = Math.PI * 2 - diff;

        if (diff < 0.6) {
          this.airborne = false;
          this.car.y = groundY - this.car.height / 2;
          this.vy = 0;
          this.rotation = slope;
          const flips = Math.floor(this.spinAccum / (Math.PI * 2));
          let points = 10;
          if (flips >= 3) points += 15;
          else if (flips >= 2) points += 10;
          else if (flips === 1) points += 5;
          gameManager.addScore(points);
          if (flips > 0) {
            this._stuntPopups.push({ text: `+${flips >= 3 ? 15 : flips >= 2 ? 10 : 5}`, x: 100, y: this.car.y - 50, t: 0, dur: 45 });
            bus.emit(EVENTS.ANNOUNCER_TRIGGER, { type: 'combo', value: flips });
            // Perfect landing glow
            this._particles.push({
              x: 100, y: this.car.y, vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 3,
              life: 30, color: '#00ff88', type: 'glow'
            });
          }
          bus.emit(EVENTS.SFX_PLAY, 'landPerfect');
        } else {
          this._explode();
          return;
        }
      }
    }

    // Distance score
    if (Math.floor(this._distance / 20) > Math.floor((this._distance - this.speed * dt) / 20)) {
      gameManager.addScore(1);
    }

    // Collect diamonds
    for (const d of this._diamonds) {
      if (d.collected) continue;
      const dx = d.x - wx;
      const dy = (groundY + d.yOffset) - this.car.y;
      if (Math.abs(dx) < 25 && Math.abs(dy) < 30) {
        d.collected = true;
        gameManager.addScore(50);
        bus.emit(EVENTS.SFX_PLAY, 'score');
        // Sparkle particles
        for (let i = 0; i < 6; i++) {
          this._particles.push({
            x: 100 + (Math.random() - 0.5) * 20, y: this.car.y + (Math.random() - 0.5) * 20,
            vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 4,
            life: 25, color: '#00f0ff', type: 'sparkle'
          });
        }
      }
    }

    // Breakable platforms
    for (const b of this._breakables) {
      if (b.broken) {
        b.breakTimer += dt;
        continue;
      }
      if (Math.abs(b.x + b.w / 2 - wx) < b.w / 2 + 10 && !this.airborne) {
        b.broken = true;
        b.breakTimer = 0;
        bus.emit(EVENTS.SFX_PLAY, 'blockLock');
      }
    }

    // Saws
    for (const s of this._saws) {
      s.angle += 0.15 * dt;
      const dx = Math.abs(s.x - wx);
      const dy = Math.abs(s.y - this.car.y);
      if (dx < s.r + this.car.r && dy < s.r + this.car.r && !this.over) {
        this._explode();
        return;
      }
    }

    // Blades
    for (const b of this._blades) {
      b.phase += 0.08 * dt;
      const bladeY = b.yTop + (Math.sin(b.phase) + 1) / 2 * (b.yBottom - b.yTop);
      const dx = Math.abs(b.x - wx);
      const dy = Math.abs(bladeY - this.car.y);
      if (dx < 20 && dy < 25 && !this.over) {
        this._explode();
        return;
      }
    }

    // Gates
    for (const g of this._gates) {
      g.phase += 0.06 * dt;
      g.open = Math.sin(g.phase) > 0;
      const dx = Math.abs(g.x - wx);
      if (dx < 20 && !g.open && !this.over) {
        this._explode();
        return;
      }
    }

    // Fall into void
    if (this.car.y > this.canvas.height + 80) {
      this._explode();
      return;
    }

    // Update particles
    for (const p of this._particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this._particles = this._particles.filter(p => p.life > 0);

    // Update popups
    for (const p of this._stuntPopups) p.t += dt;
    this._stuntPopups = this._stuntPopups.filter(p => p.t < p.dur);

    this._render();
  }

  _explode() {
    this.over = true;
    bus.emit(EVENTS.SFX_PLAY, 'crash');
    // Neon explosion particles
    for (let i = 0; i < 30; i++) {
      const col = NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)];
      this._particles.push({
        x: 100, y: this.car.y,
        vx: (Math.random() - 0.5) * 10, vy: -Math.random() * 8,
        life: 50, color: col, type: 'explosion'
      });
    }
    gameManager.playerLost();
  }

  _render() {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    const themeColor = NEON_COLORS[this._colorIndex];

    // Pure black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);

    // Distant neon grid (retro perspective)
    ctx.save();
    ctx.strokeStyle = themeColor + '18';
    ctx.lineWidth = 1;
    const gridOffset = -(this.worldX * 0.3) % 40;
    for (let x = gridOffset; x < W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();

    // Draw track segments
    const startWX = this.worldX;
    const endWX = this.worldX + W;
    ctx.save();
    ctx.lineWidth = 4;
    ctx.shadowBlur = 15;
    for (const seg of this._segments) {
      if (seg.endX < startWX || seg.startX > endWX + 100) continue;
      const sx = seg.startX - startWX;
      const ex = seg.endX - startWX;

      if (seg.type === 'GAP') {
        // Draw gap warning lines
        ctx.strokeStyle = '#ff0044';
        ctx.shadowColor = '#ff0044';
        ctx.setLineDash([8, 8]);
        ctx.beginPath(); ctx.moveTo(sx, 380); ctx.lineTo(sx, H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ex, 380); ctx.lineTo(ex, H); ctx.stroke();
        ctx.setLineDash([]);
        continue;
      }

      if (seg.type === 'BREAKABLE') {
        const b = this._breakables.find(b => Math.abs(b.x - seg.startX - 10) < 5);
        if (b && b.broken && b.breakTimer > 30) continue;
        ctx.strokeStyle = b && b.broken ? '#ff4444' : '#ffaa00';
        ctx.shadowColor = ctx.strokeStyle;
        ctx.beginPath();
        const steps = 8;
        for (let i = 0; i <= steps; i++) {
          const px = sx + (ex - sx) * (i / steps);
          const py = this._trackY(seg.startX + (seg.endX - seg.startX) * (i / steps)) - startWX + startWX;
          const drawY = this._trackY(seg.startX + (seg.endX - seg.startX) * (i / steps)) - 380 + 380;
          if (i === 0) ctx.moveTo(px, drawY); else ctx.lineTo(px, drawY);
        }
        ctx.stroke();
        continue;
      }

      ctx.strokeStyle = themeColor;
      ctx.shadowColor = themeColor;
      ctx.beginPath();
      const steps = 12;
      for (let i = 0; i <= steps; i++) {
        const px = sx + (ex - sx) * (i / steps);
        const t = seg.startX + (seg.endX - seg.startX) * (i / steps);
        const drawY = this._trackY(t);
        if (i === 0) ctx.moveTo(px, drawY); else ctx.lineTo(px, drawY);
      }
      ctx.stroke();

      // Track fill under line
      ctx.lineTo(ex, H);
      ctx.lineTo(sx, H);
      ctx.closePath();
      ctx.fillStyle = themeColor + '10';
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.restore();

    // Draw boosts
    ctx.save();
    for (const b of this._boosts) {
      const bx = b.x - startWX;
      if (bx < -50 || bx > W + 50) continue;
      ctx.fillStyle = '#00ff88';
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 12;
      ctx.fillRect(bx - 20, 360, 40, 8);
      ctx.shadowBlur = 0;
    }
    ctx.restore();

    // Draw diamonds
    ctx.save();
    for (const d of this._diamonds) {
      if (d.collected) continue;
      const dx = d.x - startWX;
      if (dx < -20 || dx > W + 20) continue;
      const dy = this._trackY(d.x) + d.yOffset;
      ctx.fillStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(dx, dy - d.r);
      ctx.lineTo(dx + d.r, dy);
      ctx.lineTo(dx, dy + d.r);
      ctx.lineTo(dx - d.r, dy);
      ctx.closePath();
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.restore();

    // Draw saws
    ctx.save();
    for (const s of this._saws) {
      const sx = s.x - startWX;
      if (sx < -50 || sx > W + 50) continue;
      ctx.translate(sx, s.y);
      ctx.rotate(s.angle);
      ctx.fillStyle = '#ff0044';
      ctx.shadowColor = '#ff0044';
      ctx.shadowBlur = 10;
      for (let i = 0; i < 8; i++) {
        ctx.rotate(Math.PI / 4);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(8, -s.r);
        ctx.lineTo(-8, -s.r);
        ctx.closePath();
        ctx.fill();
      }
      ctx.rotate(-s.angle);
      ctx.translate(-sx, -s.y);
    }
    ctx.shadowBlur = 0;
    ctx.restore();

    // Draw blades
    ctx.save();
    for (const b of this._blades) {
      const bx = b.x - startWX;
      if (bx < -50 || bx > W + 50) continue;
      const bladeY = b.yTop + (Math.sin(b.phase) + 1) / 2 * (b.yBottom - b.yTop);
      ctx.fillStyle = '#ff4444';
      ctx.shadowColor = '#ff4444';
      ctx.shadowBlur = 8;
      ctx.fillRect(bx - 3, bladeY - 20, 6, 40);
      ctx.fillRect(bx - 15, bladeY - 4, 30, 8);
    }
    ctx.shadowBlur = 0;
    ctx.restore();

    // Draw gates
    ctx.save();
    for (const g of this._gates) {
      const gx = g.x - startWX;
      if (gx < -50 || gx > W + 50) continue;
      const gateH = g.open ? 0 : 70;
      ctx.fillStyle = g.open ? '#00ff8844' : '#ff0044';
      ctx.shadowColor = g.open ? '#00ff88' : '#ff0044';
      ctx.shadowBlur = 8;
      ctx.fillRect(gx - 4, 250, 8, gateH);
      ctx.fillRect(gx - 20, 250 + gateH - 4, 40, 8);
    }
    ctx.shadowBlur = 0;
    ctx.restore();

    // Draw particles
    ctx.save();
    for (const p of this._particles) {
      ctx.globalAlpha = Math.max(0, p.life / 50);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = p.type === 'explosion' ? 6 : 4;
      const size = p.type === 'explosion' ? 4 : 2;
      ctx.fillRect(p.x, p.y, size, size);
    }
    ctx.shadowBlur = 0;
    ctx.restore();

    // Draw car
    if (!this.over || this._particles.length > 0) {
      ctx.save();
      ctx.translate(this.car.x, this.car.y);
      ctx.rotate(this.rotation);
      ctx.fillStyle = themeColor;
      ctx.shadowColor = themeColor;
      ctx.shadowBlur = 20;
      // Car image
      const carImg = new Image();
      carImg.src = 'assets/images/neon-rider-player.png';
      if (carImg.complete && carImg.naturalWidth > 0) {
        ctx.drawImage(carImg, -30, -20, 60, 40);
      } else {
        // Fallback: geometric car
        ctx.beginPath();
        ctx.moveTo(-20, 10);
        ctx.lineTo(20, 10);
        ctx.lineTo(18, -6);
        ctx.lineTo(-10, -10);
        ctx.lineTo(-20, -4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(-12, 10, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(12, 10, 5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Stunt popups
    for (const p of this._stuntPopups) {
      const alpha = Math.max(0, 1 - p.t / p.dur);
      const yOff = -p.t * 1.5;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#00ff88';
      ctx.font = 'bold 20px Baloo 2, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 8;
      ctx.fillText(p.text, p.x, p.y + yOff);
      ctx.restore();
    }

    // Speed lines effect when fast
    if (this.speed > 5) {
      ctx.save();
      ctx.strokeStyle = themeColor + '30';
      ctx.lineWidth = 1;
      for (let i = 0; i < 10; i++) {
        const lx = (i * 47 + this.worldX * 2) % W;
        ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx - 30, H); ctx.stroke();
      }
      ctx.restore();
    }
  }
}
