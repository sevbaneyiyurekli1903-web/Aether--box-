import { BaseGame } from '../BaseGame.js';
import { createGameCanvas, attachPointerEvents, drawGradientBackground } from '../canvasInput.js';
import gameManager from '../../core/GameManager.js';
import bus from '../../core/EventBus.js';
import { EVENTS } from '../../core/Events.js';

const TOTAL_LEVELS = 400;
const START_LIVES = 3;

const DIRS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
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

function generateBoard(level, rand) {
  const rows = 8, cols = 7;
  const targetCount = Math.min(cols * rows, 16 + Math.floor(level * 1.35));
  const cellOrder = shuffle(
    Array.from({ length: cols * rows }, (_, i) => [Math.floor(i / cols), i % cols]),
    rand
  );

  const occupied = Array.from({ length: rows }, () => Array(cols).fill(false));
  const tiles = [];

  for (const [r, c] of cellOrder) {
    if (tiles.length >= targetCount) break;
    const options = shuffle([...DIR_KEYS], rand).filter((dirKey) => pathClear(r, c, dirKey, occupied));
    if (!options.length) continue;
    occupied[r][c] = true;
    tiles.push({ r, c, dir: options[0], cleared: false });
  }

  return tiles;
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
    this.tiles = generateBoard(levelNum, rand);
    this.lives = START_LIVES;
    this.levelJustCleared = false;
    this._shake = null;
    this._clearing = null;
  }

  revive() {
    this.lives = START_LIVES;
    this.over = false;
  }

  _occupiedGrid() {
    const rows = 8, cols = 7;
    const grid = Array.from({ length: rows }, () => Array(cols).fill(false));
    for (const t of this.tiles) if (!t.cleared) grid[t.r][t.c] = true;
    return grid;
  }

  _onTap(x, y) {
    if (this.over || this.levelJustCleared) return;
    const W = this.canvas.width, H = this.canvas.height;
    const rows = 8, cols = 7;
    const cell = Math.min(W / (cols + 1), H / (rows + 3));
    const gridW = cols * cell;
    const gridH = rows * cell;
    const gridLeft = (W - gridW) / 2;
    const gridTop = (H - gridH) / 2 + 20;

    const col = Math.floor((x - gridLeft) / cell);
    const row = Math.floor((y - gridTop) / cell);
    if (row < 0 || row >= rows || col < 0 || col >= cols) return;

    const tile = this.tiles.find((t) => t.r === row && t.c === col && !t.cleared);
    if (!tile) return;

    if (pathClear(row, col, tile.dir, this._occupiedGrid())) {
      tile.cleared = true;
      this._clearing = { r: tile.r, c: tile.c, dir: tile.dir, t: 0 };
      gameManager.addScore(10);
      bus.emit(EVENTS.SFX_PLAY, 'arrowSlide');

      if (this.tiles.every((t) => t.cleared)) this._onLevelCleared();
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

  _onLevelCleared() {
    this.levelJustCleared = true;
    gameManager.addScore(100);
    bus.emit(EVENTS.SFX_PLAY, 'levelClear');
    bus.emit(EVENTS.ANNOUNCER_TRIGGER, { type: 'combo', value: 1 });
    this.currentLevel = this.currentLevel >= TOTAL_LEVELS ? 1 : this.currentLevel + 1;
    this._saveLevel(this.currentLevel);
    this._clearTimeout = setTimeout(() => {
      if (!this.over) this._startLevel(this.currentLevel);
    }, 650);
  }

  update(dt) {
    if (this._shake) { this._shake.t += dt; if (this._shake.t > 14) this._shake = null; }
    if (this._clearing) { this._clearing.t += dt; if (this._clearing.t > 16) this._clearing = null; }
    this._render();
  }

  _render() {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;

    drawGradientBackground(ctx, W, H, [[0, '#a8d8f0'], [0.5, '#7ec8e0'], [1, '#5ab8d0']]);

    const rows = 8, cols = 7;
    const cell = Math.min(W / (cols + 1), H / (rows + 3));
    const gridW = cols * cell;
    const gridH = rows * cell;
    const gridLeft = (W - gridW) / 2;
    const gridTop = (H - gridH) / 2 + 20;

    // HUD: Hearts + Difficulty
    ctx.save();
    ctx.font = `bold ${cell * 0.4}px Poppins, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#d32f2f';
    const hearts = '\u2764'.repeat(Math.max(0, this.lives)) + '\u2661'.repeat(Math.max(0, START_LIVES - this.lives));
    ctx.fillText(hearts, gridLeft, gridTop - cell * 0.6);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#0d47a1';
    ctx.fillText(`LV.${this.currentLevel} ${getDifficultyName(this.currentLevel)}`, gridLeft + gridW, gridTop - cell * 0.6);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        roundRectPath(ctx, gridLeft + c * cell + 2, gridTop + r * cell + 2, cell - 4, cell - 4, cell * 0.15);
        ctx.fill();
      }
    }
    ctx.restore();

    for (const t of this.tiles) {
      if (t.cleared) continue;
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

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx + shakeX, cy);

    const size = cell * 0.75;
    ctx.fillStyle = shaking ? 'rgba(211,47,47,0.9)' : 'rgba(13,71,161,0.9)';
    ctx.shadowColor = shaking ? 'rgba(211,47,47,0.5)' : 'rgba(13,71,161,0.4)';
    ctx.shadowBlur = 8;
    roundRectPath(ctx, -size / 2, -size / 2, size, size, cell * 0.15);
    ctx.fill();
    ctx.shadowColor = 'transparent';

    ctx.rotate(DIR_ANGLE[t.dir]);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    const s = size * 0.28;
    ctx.moveTo(s, 0);
    ctx.lineTo(-s * 0.6, -s * 0.85);
    ctx.lineTo(-s * 0.6, s * 0.85);
    ctx.closePath();
    ctx.fill();

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
