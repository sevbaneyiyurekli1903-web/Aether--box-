import { BaseGame } from '../BaseGame.js';
import { createGameCanvas, attachPointerEvents, drawGradientBackground } from '../canvasInput.js';
import gameManager from '../../core/GameManager.js';
import bus from '../../core/EventBus.js';
import { EVENTS } from '../../core/Events.js';

const TOTAL_LEVELS = 400;
const START_LIVES = 3;

const DIRS = {
  up:    { dx: 0, dy: -1 },
  down:  { dx: 0, dy: 1 },
  left:  { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 }
};
const DIR_KEYS = Object.keys(DIRS);
const DIR_ANGLE = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 };

const DIFFICULTY_TIERS = [
  { threshold: 1, name: 'Easy' },
  { threshold: 20, name: 'Normal' },
  { threshold: 50, name: 'Hard' },
  { threshold: 100, name: 'Nightmare' },
  { threshold: 200, name: 'Inferno' }
];

const LOCK_COLORS = ['#ff5252', '#448aff', '#69f0ae'];

function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function next() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function shuffle(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pathClear(r, c, dirKey, occupied) {
  const { dx, dy } = DIRS[dirKey];
  let rr = r + dy, cc = c + dx;
  while (rr >= 0 && rr < occupied.length && cc >= 0 && cc < occupied[0].length) {
    if (occupied[rr][cc]) return false;
    rr += dy; cc += dx;
  }
  return true;
}

function gridSizeForLevel(level) {
  if (level <= 1) return 3;
  if (level <= 5) return 4;
  if (level <= 10) return 5;
  if (level <= 20) return 6;
  if (level <= 50) return 7;
  return 8;
}

function generateBoard(level, rand) {
  const size = gridSizeForLevel(level);
  const targetCount = Math.min(size * size, 4 + Math.floor(level * 1.2));
  const cellOrder = shuffle(
    Array.from({ length: size * size }, (_, i) => [Math.floor(i / size), i % size]),
    rand
  );

  const occupied = Array.from({ length: size }, () => Array(size).fill(false));
  const tiles = [];

  for (const [r, c] of cellOrder) {
    if (tiles.length >= targetCount) break;
    const options = shuffle([...DIR_KEYS], rand).filter((dirKey) => pathClear(r, c, dirKey, occupied));
    if (!options.length) continue;
    occupied[r][c] = true;
    tiles.push({ r, c, dir: options[0], cleared: false, type: 'normal', rot: 0 });
  }

  // Post-process: add special types
  const specialChance = Math.min(0.45, 0.05 + level * 0.008);
  for (const t of tiles) {
    const roll = rand();
    if (roll < specialChance * 0.3 && level >= 5) {
      t.type = 'double';
      t.dir2 = shuffle([...DIR_KEYS], rand)[0];
    } else if (roll < specialChance * 0.6 && level >= 10) {
      t.type = 'rotator';
    } else if (roll < specialChance && level >= 15) {
      t.type = 'locked';
      t.lockColor = Math.floor(rand() * 3);
      t.active = false;
    }
  }

  // Add blocked cells
  const blockCount = Math.floor(level * 0.15);
  let blocksAdded = 0;
  for (const [r, c] of cellOrder) {
    if (blocksAdded >= blockCount) break;
    if (!occupied[r][c]) {
      occupied[r][c] = true;
      tiles.push({ r, c, dir: 'right', cleared: false, type: 'blocked' });
      blocksAdded++;
    }
  }

  return { tiles, size };
}

function getDifficultyName(level) {
  for (let i = DIFFICULTY_TIERS.length - 1; i >= 0; i--) {
    if (level >= DIFFICULTY_TIERS[i].threshold) return DIFFICULTY_TIERS[i].name;
  }
  return 'Easy';
}

export default class ArrowsGame extends BaseGame {
  init() {
    const root = document.getElementById('app-root');
    const { canvas, ctx, resizeObserver } = createGameCanvas(root);
    this.canvas = canvas;
    this.ctx = ctx;
    this._resizeObserver = resizeObserver;

    this.over = false;
    this.currentLevel = this._loadLevel();
    this._startLevel(this.currentLevel);

    this._detach = attachPointerEvents(canvas, {
      onDown: (p) => this._onTap(p.x, p.y)
    });
  }

  destroy() {
    if (this._detach) this._detach();
    this._resizeObserver?.disconnect();
    if (this._clearTimeout) clearTimeout(this._clearTimeout);
    this.canvas?.closest('.game-canvas-wrapper')?.remove();
  }

  _loadLevel() {
    try { return Number(localStorage.getItem('aetherhub:arrows:level') || 1); } catch { return 1; }
  }
  _saveLevel(level) {
    try { localStorage.setItem('aetherhub:arrows:level', String(level)); } catch { }
  }

  _startLevel(levelNum) {
    const rand = seededRandom(levelNum * 7919 + 13);
    const board = generateBoard(levelNum, rand);
    this.tiles = board.tiles;
    this.gridSize = board.size;
    this.lives = START_LIVES;
    this.levelJustCleared = false;
    this._shake = null;
    this._clearing = null;
    this._rotating = null;
  }

  revive() {
    this.lives = START_LIVES;
    this.over = false;
  }

  _occupiedGrid() {
    const grid = Array.from({ length: this.gridSize }, () => Array(this.gridSize).fill(false));
    for (const t of this.tiles) if (!t.cleared && t.type !== 'blocked') grid[t.r][t.c] = true;
    return grid;
  }

  _countClearedOfColor(colorId) {
    return this.tiles.filter(t => t.type === 'normal' && t.lockColor === colorId && t.cleared).length;
  }

  _countTotalOfColor(colorId) {
    return this.tiles.filter(t => t.type === 'normal' && t.lockColor === colorId).length;
  }

  _updateLocks() {
    for (const t of this.tiles) {
      if (t.type === 'locked' && !t.active) {
        const cleared = this._countClearedOfColor(t.lockColor);
        const total = this._countTotalOfColor(t.lockColor);
        if (total === 0 || cleared >= total) t.active = true;
      }
    }
  }

  _onTap(x, y) {
    if (this.over || this.levelJustCleared || this._rotating) return;
    const W = this.canvas.width, H = this.canvas.height;
    const size = this.gridSize;
    const cell = Math.min(W / (size + 1), H / (size + 3));
    const gridW = size * cell;
    const gridH = size * cell;
    const gridLeft = (W - gridW) / 2;
    const gridTop = (H - gridH) / 2 + 20;

    const col = Math.floor((x - gridLeft) / cell);
    const row = Math.floor((y - gridTop) / cell);
    if (row < 0 || row >= size || col < 0 || col >= size) return;

    const tile = this.tiles.find((t) => t.r === row && t.c === col && !t.cleared);
    if (!tile || tile.type === 'blocked') return;

    // Handle rotator
    if (tile.type === 'rotator') {
      this._rotating = { tile, fromDir: tile.dir, t: 0 };
      // Rotate 90deg clockwise
      const dirs = ['up', 'right', 'down', 'left'];
      const idx = dirs.indexOf(tile.dir);
      tile.dir = dirs[(idx + 1) % 4];
      tile.rot = (tile.rot || 0) + Math.PI / 2;
      // After rotation, check if path is clear
      setTimeout(() => {
        this._rotating = null;
        if (pathClear(row, col, tile.dir, this._occupiedGrid())) {
          this._clearTile(tile);
        } else {
          // Revert rotation if blocked
          tile.dir = dirs[idx];
          tile.rot = (tile.rot || 0) - Math.PI / 2;
          this._shake = { r: row, c: col, t: 0 };
          this.lives -= 1;
          bus.emit(EVENTS.SFX_PLAY, 'arrowBlocked');
          if (this.lives <= 0) {
            this.over = true;
            gameManager.playerLost();
          }
        }
      }, 250);
      bus.emit(EVENTS.SFX_PLAY, 'blockRotate');
      return;
    }

    // Handle locked
    if (tile.type === 'locked' && !tile.active) {
      this._shake = { r: row, c: col, t: 0 };
      bus.emit(EVENTS.SFX_PLAY, 'arrowBlocked');
      return;
    }

    // Check path clear
    if (pathClear(row, col, tile.dir, this._occupiedGrid())) {
      this._clearTile(tile);
    } else {
      this._shake = { r: row, c: col, t: 0 };
      this.lives -= 1;
      bus.emit(EVENTS.SFX_PLAY, 'arrowBlocked');
      if (this.lives <= 0) {
        this.over = true;
        gameManager.playerLost();
      }
    }
  }

  _clearTile(tile) {
    tile.cleared = true;
    this._clearing = { r: tile.r, c: tile.c, dir: tile.dir, t: 0 };
    gameManager.addScore(tile.type === 'double' ? 20 : tile.type === 'locked' ? 30 : 10);
    bus.emit(EVENTS.SFX_PLAY, 'arrowSlide');
    this._updateLocks();

    if (this.tiles.every((t) => t.cleared || t.type === 'blocked')) this._onLevelCleared();
  }

  _onLevelCleared() {
    this.levelJustCleared = true;
    gameManager.addScore(100);
    bus.emit(EVENTS.SFX_PLAY, 'levelClear');
    bus.emit(EVENTS.ANNOUNCER_TRIGGER, { type: 'combo', value: 1 });
    this.currentLevel = this.currentLevel >= TOTAL_LEVELS ? 1 : this.currentLevel + 1;
    this._saveLevel(this.currentLevel);
    this._clearTimeout = setTimeout(() => {
      if (!this.over) this._startLevel(this.currentLevel);
    }, 800);
  }

  update(dt) {
    if (this._shake) { this._shake.t += dt; if (this._shake.t > 14) this._shake = null; }
    if (this._clearing) { this._clearing.t += dt; if (this._clearing.t > 16) this._clearing = null; }
    if (this._rotating) { this._rotating.t += dt; }
    this._render();
  }

  _render() {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;

    // Dark minimalist background
    drawGradientBackground(ctx, W, H, [[0, '#0d1b2a'], [0.5, '#1b263b'], [1, '#0d1b2a']]);

    // Subtle grid pattern
    ctx.save();
    ctx.strokeStyle = 'rgba(65, 90, 120, 0.15)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.restore();

    const size = this.gridSize;
    const cell = Math.min(W / (size + 1), H / (size + 3));
    const gridW = size * cell;
    const gridH = size * cell;
    const gridLeft = (W - gridW) / 2;
    const gridTop = (H - gridH) / 2 + 20;

    // HUD: Hearts + Difficulty + Grid size
    ctx.save();
    ctx.font = `bold ${cell * 0.35}px Poppins, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ff6b6b';
    const hearts = '\u2764'.repeat(Math.max(0, this.lives)) + '\u2661'.repeat(Math.max(0, START_LIVES - this.lives));
    ctx.fillText(hearts, gridLeft, gridTop - cell * 0.5);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#90e0ef';
    ctx.fillText(`LV.${this.currentLevel} ${getDifficultyName(this.currentLevel)} ${size}x${size}`, gridLeft + gridW, gridTop - cell * 0.5);
    ctx.restore();

    // Grid cells background
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        roundRectPath(ctx, gridLeft + c * cell + 2, gridTop + r * cell + 2, cell - 4, cell - 4, cell * 0.12);
        ctx.fill();
      }
    }
    ctx.restore();

    // Draw blocked cells
    for (const t of this.tiles) {
      if (t.type !== 'blocked') continue;
      const cx = gridLeft + t.c * cell + cell / 2;
      const cy = gridTop + t.r * cell + cell / 2;
      ctx.save();
      ctx.fillStyle = 'rgba(40, 50, 70, 0.9)';
      ctx.strokeStyle = 'rgba(80, 100, 130, 0.5)';
      ctx.lineWidth = 2;
      roundRectPath(ctx, gridLeft + t.c * cell + 3, gridTop + t.r * cell + 3, cell - 6, cell - 6, cell * 0.1);
      ctx.fill(); ctx.stroke();
      // X mark
      ctx.strokeStyle = 'rgba(120, 140, 170, 0.4)';
      ctx.beginPath();
      ctx.moveTo(cx - cell * 0.2, cy - cell * 0.2);
      ctx.lineTo(cx + cell * 0.2, cy + cell * 0.2);
      ctx.moveTo(cx + cell * 0.2, cy - cell * 0.2);
      ctx.lineTo(cx - cell * 0.2, cy + cell * 0.2);
      ctx.stroke();
      ctx.restore();
    }

    // Draw tiles
    for (const t of this.tiles) {
      if (t.cleared || t.type === 'blocked') continue;
      this._drawTile(ctx, t, gridLeft, gridTop, cell);
    }
    if (this._clearing) this._drawTile(ctx, this._clearing, gridLeft, gridTop, cell);

    if (this.levelJustCleared) {
      ctx.save();
      ctx.fillStyle = 'rgba(13,71,161,0.45)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${cell * 0.9}px Baloo 2, sans-serif`;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(255,255,255,0.5)';
      ctx.shadowBlur = 16;
      ctx.fillText('LEVEL CLEAR', W / 2, gridTop + gridH / 2);
      ctx.restore();
    }
  }

  _drawTile(ctx, t, gridLeft, gridTop, cell) {
    let cx = gridLeft + t.c * cell + cell / 2;
    let cy = gridTop + t.r * cell + cell / 2;
    let alpha = 1;
    let rotation = (t.rot || 0) + (DIR_ANGLE[t.dir] || 0);

    const animating = this._clearing && this._clearing.r === t.r && this._clearing.c === t.c;
    if (animating) {
      const p = this._clearing.t / 16;
      const { dx, dy } = DIRS[t.dir];
      cx += dx * p * cell * 3;
      cy += dy * p * cell * 3;
      alpha = Math.max(0, 1 - p);
    }

    const shaking = this._shake && this._shake.r === t.r && this._shake.c === t.c;
    const shakeX = shaking ? Math.sin(this._shake.t * 3) * 3 : 0;
    const rotOffset = (this._rotating && this._rotating.tile === t) ? (this._rotating.t / 5) * (Math.PI / 2) : 0;
    rotation += rotOffset;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx + shakeX, cy);

    const size = cell * 0.72;
    let bgColor, shadowColor;

    if (t.type === 'double') {
      bgColor = shaking ? 'rgba(255,107,107,0.9)' : 'rgba(255,193,7,0.9)';
      shadowColor = shaking ? 'rgba(255,107,107,0.5)' : 'rgba(255,193,7,0.4)';
    } else if (t.type === 'rotator') {
      bgColor = shaking ? 'rgba(255,107,107,0.9)' : 'rgba(156,39,176,0.9)';
      shadowColor = shaking ? 'rgba(255,107,107,0.5)' : 'rgba(156,39,176,0.4)';
    } else if (t.type === 'locked') {
      if (t.active) {
        bgColor = shaking ? 'rgba(255,107,107,0.9)' : 'rgba(100,220,150,0.9)';
        shadowColor = shaking ? 'rgba(255,107,107,0.5)' : 'rgba(100,220,150,0.4)';
      } else {
        bgColor = 'rgba(60,70,90,0.9)';
        shadowColor = 'rgba(60,70,90,0.4)';
      }
    } else {
      bgColor = shaking ? 'rgba(255,107,107,0.9)' : 'rgba(25,55,95,0.9)';
      shadowColor = shaking ? 'rgba(255,107,107,0.5)' : 'rgba(100,180,255,0.3)';
    }

    ctx.fillStyle = bgColor;
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = 8;
    roundRectPath(ctx, -size / 2, -size / 2, size, size, cell * 0.15);
    ctx.fill();
    ctx.shadowColor = 'transparent';

    // Lock icon for locked tiles
    if (t.type === 'locked' && !t.active) {
      ctx.fillStyle = LOCK_COLORS[t.lockColor] || '#888';
      ctx.beginPath();
      ctx.arc(0, -size * 0.1, size * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-size * 0.12, size * 0.05, size * 0.24, size * 0.18);
    }

    // Rotator icon
    if (t.type === 'rotator') {
      ctx.strokeStyle = '#e1bee7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.22, 0, Math.PI * 1.5);
      ctx.stroke();
      ctx.fillStyle = '#e1bee7';
      ctx.beginPath();
      ctx.moveTo(size * 0.22, -4); ctx.lineTo(size * 0.22 + 6, 0); ctx.lineTo(size * 0.22, 4);
      ctx.fill();
    }

    // Double arrow indicator
    if (t.type === 'double') {
      ctx.strokeStyle = '#fff176';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.15, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.rotate(rotation);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    const s = size * 0.28;
    ctx.moveTo(s, 0);
    ctx.lineTo(-s * 0.6, -s * 0.85);
    ctx.lineTo(-s * 0.6, s * 0.85);
    ctx.closePath();
    ctx.fill();

    // Second arrow for double
    if (t.type === 'double' && t.dir2) {
      ctx.rotate((DIR_ANGLE[t.dir2] || 0) - rotation);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.moveTo(s * 0.7, 0);
      ctx.lineTo(-s * 0.4, -s * 0.6);
      ctx.lineTo(-s * 0.4, s * 0.6);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
