import { BaseGame } from '../BaseGame.js';
import { createGameCanvas, attachPointerEvents, drawGradientBackground } from '../canvasInput.js';
import gameManager from '../../core/GameManager.js';
import bus from '../../core/EventBus.js';
import { EVENTS } from '../../core/Events.js';

// Cell size scaled up 30% per the visual-scaling pass (24 -> 31).
// Row count reduced from the classic 20 to 15 so the taller cells
// still fit the fixed 540px-tall canvas -- keeping 20 rows at this
// cell size would need 620px, well past the canvas bounds. Column
// count (board width) is unchanged at the standard 10.
const COLS = 10, ROWS = 15, CELL = 31;
const GRID_LEFT = 25, GRID_TOP = 54; // GRID_TOP leaves room for the NEXT preview above the board

// Standard rotation-state grids for the 7 tetrominoes.
const SHAPES = {
  I: [[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], [[0,0,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0]], [[0,0,0,0],[0,0,0,0],[1,1,1,1],[0,0,0,0]], [[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]]],
  O: [[[1,1],[1,1]], [[1,1],[1,1]], [[1,1],[1,1]], [[1,1],[1,1]]],
  T: [[[0,1,0],[1,1,1],[0,0,0]], [[0,1,0],[0,1,1],[0,1,0]], [[0,0,0],[1,1,1],[0,1,0]], [[0,1,0],[1,1,0],[0,1,0]]],
  S: [[[0,1,1],[1,1,0],[0,0,0]], [[0,1,0],[0,1,1],[0,0,1]], [[0,0,0],[0,1,1],[1,1,0]], [[1,0,0],[1,1,0],[0,1,0]]],
  Z: [[[1,1,0],[0,1,1],[0,0,0]], [[0,0,1],[0,1,1],[0,1,0]], [[0,0,0],[1,1,0],[0,1,1]], [[0,1,0],[1,1,0],[1,0,0]]],
  J: [[[1,0,0],[1,1,1],[0,0,0]], [[0,1,1],[0,1,0],[0,1,0]], [[0,0,0],[1,1,1],[0,0,1]], [[0,1,0],[0,1,0],[1,1,0]]],
  L: [[[0,0,1],[1,1,1],[0,0,0]], [[0,1,0],[0,1,0],[0,1,1]], [[0,0,0],[1,1,1],[1,0,0]], [[1,1,0],[0,1,0],[0,1,0]]]
};
const PIECE_TYPES = Object.keys(SHAPES);
const PIECE_COLORS = {
  I: ['#eaffff', '#8fe8ff', '#3fa9cf'],
  O: ['#fff6e0', '#ffd88a', '#d19a3d'],
  T: ['#f2ecff', '#c3a6ff', '#8a68d9'],
  S: ['#e8ffe9', '#9be3a8', '#5aa868'],
  Z: ['#fff0fa', '#ffb0e0', '#d874ad'],
  J: ['#e6f0ff', '#9fbaff', '#5c7ed6'],
  L: ['#ffe9da', '#ffb37a', '#d17f3d']
};
const LINE_SCORES = [0, 100, 300, 500, 800];

function makeBag() {
  const bag = [...PIECE_TYPES];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

/**
 * TetrisGame.js
 * -----------------------------------------------------------------
 * Classic grid logic: 10x20 board, 7-bag randomizer, 4 rotation
 * states per piece (no wall-kick table — a rotation that would
 * collide is simply rejected, which is a reasonable simplification
 * for an arcade-scale clone), line clear + classic scoring.
 * Touch controls: drag left/right to shift columns, quick tap to
 * rotate, swipe down to hard-drop.
 * -----------------------------------------------------------------
 */
export default class TetrisGame extends BaseGame {
  init() {
    const root = document.getElementById('app-root');
    const { canvas, ctx, resizeObserver } = createGameCanvas(root);
    this.canvas = canvas;
    this.ctx = ctx;
    this._resizeObserver = resizeObserver;

    this.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    this.bag = makeBag();
    this.nextType = this.bag.shift();
    this.dropTimer = 0;
    this.dropInterval = 48;
    this.over = false;
    this._gesture = null;

    this._spawnPiece();

    this._detach = attachPointerEvents(canvas, {
      onDown: (p) => { this._gesture = { startX: p.x, startY: p.y, lastCol: 0, startTime: performance.now() }; },
      onMove: (p) => this._onDrag(p),
      onUp: (p) => this._onRelease(p)
    });
  }

  destroy() {
    if (this._detach) this._detach();
    this._resizeObserver?.disconnect();
    this.canvas?.closest('.game-canvas-wrapper')?.remove();
  }

  _bagNext() {
    if (this.bag.length === 0) this.bag = makeBag();
    return this.bag.shift();
  }

  _spawnPiece() {
    const type = this.nextType;
    this.nextType = this._bagNext();
    this.piece = { type, rot: 0, row: -1, col: Math.floor(COLS / 2) - 2 };
    if (!this._canPlace(this.piece, 0, 0, 0)) {
      this.over = true;
      gameManager.playerLost();
    }
  }

  _cellsOf(piece, rot = piece.rot) {
    const shape = SHAPES[piece.type][rot];
    const cells = [];
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) cells.push({ r: piece.row + r, c: piece.col + c });
      }
    }
    return cells;
  }

  _canPlace(piece, dRow, dCol, dRot) {
    const rot = (piece.rot + dRot + 4) % 4;
    const test = { ...piece, row: piece.row + dRow, col: piece.col + dCol, rot };
    for (const { r, c } of this._cellsOf(test)) {
      if (c < 0 || c >= COLS || r >= ROWS) return false;
      if (r >= 0 && this.grid[r][c]) return false;
    }
    return true;
  }

  _onDrag(p) {
    if (!this._gesture || this.over) return;
    const dx = p.x - this._gesture.startX;
    const colDelta = Math.trunc(dx / CELL) - this._gesture.lastCol;
    if (colDelta !== 0) {
      const dir = colDelta > 0 ? 1 : -1;
      for (let i = 0; i < Math.abs(colDelta); i++) {
        if (this._canPlace(this.piece, 0, dir, 0)) this.piece.col += dir;
      }
      this._gesture.lastCol += colDelta;
    }
  }

  _onRelease(p) {
    if (!this._gesture || this.over) { this._gesture = null; return; }
    const dx = p.x - this._gesture.startX;
    const dy = p.y - this._gesture.startY;
    const elapsed = performance.now() - this._gesture.startTime;
    if (dy > 40 && Math.abs(dy) > Math.abs(dx)) {
      this._hardDrop();
    } else if (Math.abs(dx) < 12 && Math.abs(dy) < 12 && elapsed < 300) {
      this._rotate();
    }
    this._gesture = null;
  }

  _rotate() {
    if (this._canPlace(this.piece, 0, 0, 1)) {
      this.piece.rot = (this.piece.rot + 1) % 4;
      bus.emit(EVENTS.SFX_PLAY, 'blockRotate');
    }
  }

  _hardDrop() {
    while (this._canPlace(this.piece, 1, 0, 0)) this.piece.row += 1;
    this._lock();
  }

  _lock() {
    for (const { r, c } of this._cellsOf(this.piece)) {
      if (r >= 0) this.grid[r][c] = this.piece.type;
    }
    bus.emit(EVENTS.SFX_PLAY, 'blockLock');
    const cleared = this._clearLines();
    if (cleared > 0) {
      gameManager.addScore(LINE_SCORES[cleared] || cleared * 200);
      bus.emit(EVENTS.SFX_PLAY, 'blockClear');
    }
    this._spawnPiece();
  }

  _clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.grid[r].every((cell) => cell)) {
        this.grid.splice(r, 1);
        this.grid.unshift(Array(COLS).fill(0));
        cleared++;
        r++; // re-check the row that just shifted into this index
      }
    }
    return cleared;
  }

  /** Ad-revive: clear the top four rows so a topped-out board has room
   *  to breathe again. */
  revive() {
    for (let r = 0; r < 4; r++) this.grid[r] = Array(COLS).fill(0);
    this.over = false;
    if (!this._canPlace(this.piece, 0, 0, 0)) this.piece.row = -1;
  }

  update(dt) {
    if (this.over) return;
    this.dropTimer += dt;
    if (this.dropTimer >= this.dropInterval) {
      this.dropTimer = 0;
      if (this._canPlace(this.piece, 1, 0, 0)) {
        this.piece.row += 1;
      } else {
        this._lock();
      }
    }
    this._render();
  }

  _render() {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    // Deep amber gradient (was a flat bright yellow) -- darker per
    // spec, and now the ONLY thing ever visible behind the HUD too,
    // since the canvas cover-fits the full screen with no gap left
    // around it.
    drawGradientBackground(ctx, W, H, [[0, '#4a3a08'], [0.55, '#241c06'], [1, '#0a0803']]);

    // board frame
    ctx.save();
    ctx.fillStyle = 'rgba(16,26,92,0.6)';
    ctx.fillRect(GRID_LEFT - 4, GRID_TOP - 4, COLS * CELL + 8, ROWS * CELL + 8);
    ctx.restore();

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (this.grid[r][c]) this._drawCell(c, r, this.grid[r][c]);
      }
    }
    if (this.piece && !this.over) {
      for (const { r, c } of this._cellsOf(this.piece)) {
        if (r >= 0) this._drawCell(c, r, this.piece.type);
      }
    }

    // next-piece preview, top-right, consistent with Planet Merge's NEXT box
    ctx.save();
    ctx.fillStyle = 'rgba(16,26,92,0.85)';
    ctx.fillRect(300, 8, 52, 44);
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = '8px Poppins, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NEXT', 326, 18);
    ctx.restore();
    const nShape = SHAPES[this.nextType][0];
    const colors = PIECE_COLORS[this.nextType];
    for (let r = 0; r < nShape.length; r++) {
      for (let c = 0; c < nShape[r].length; c++) {
        if (nShape[r][c]) {
          ctx.save();
          ctx.fillStyle = colors[1];
          ctx.fillRect(304 + c * 10, 22 + r * 10, 9, 9);
          ctx.restore();
        }
      }
    }
  }

  _drawCell(col, row, type) {
    const ctx = this.ctx;
    const x = GRID_LEFT + col * CELL, y = GRID_TOP + row * CELL;
    const colors = PIECE_COLORS[type] || ['#fff', '#ccc', '#999'];
    ctx.save();
    const grad = ctx.createLinearGradient(x, y, x + CELL, y + CELL);
    grad.addColorStop(0, colors[0]);
    grad.addColorStop(0.5, colors[1]);
    grad.addColorStop(1, colors[2]);
    ctx.fillStyle = grad;
    ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 1, y + 1, CELL - 2, CELL - 2);
    ctx.restore();
  }
}
