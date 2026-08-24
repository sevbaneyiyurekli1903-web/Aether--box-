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

function getDifficultyName(level) {
  for (let i = DIFFICULTY_TIERS.length - 1; i >= 0; i--) {
    if (level >= DIFFICULTY_TIERS[i].threshold) return DIFFICULTY_TIERS[i].name;
  }
  return 'Easy';
}

function gridSizeForLevel(level) {
  if (level <= 5) return 4;
  if (level <= 20) return 5;
  if (level <= 50) return 6;
  if (level <= 100) return 7;
  return 8;
}

/**
 * Haritada %100 Çözülebilir Labirent Ok Üreticisi
 */
function generateBoard(level, rand) {
  const size = gridSizeForLevel(level);
  const targetCount = Math.min(size * size - 2, 4 + Math.floor(level * 0.8));
  const occupied = Array.from({ length: size }, () => Array(size).fill(false));
  const tiles = [];

  for (let i = 0; i < targetCount; i++) {
    const arrow = tryPlaceArrow(size, occupied, rand, i + 1, level);
    if (arrow) tiles.push(arrow);
  }

  // Bloklu Hücreler (Engeller)
  const blockCount = Math.floor(level * 0.12);
  let blocksAdded = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (blocksAdded >= blockCount) break;
      if (!occupied[r][c] && rand() < 0.2) {
        occupied[r][c] = true;
        tiles.push({ r, c, dir: 'right', cleared: false, type: 'blocked', segments: [{r, c}] });
        blocksAdded++;
      }
    }
  }

  return { tiles, size };
}

function tryPlaceArrow(size, occupied, rand, id, level) {
  const possibleHeads = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!occupied[r][c]) {
        for (const dirKey of DIR_KEYS) {
          if (isExitRayClear(r, c, dirKey, occupied, size)) {
            possibleHeads.push({ r, c, dir: dirKey });
          }
        }
      }
    }
  }

  if (!possibleHeads.length) return null;

  shuffle(possibleHeads, rand);
  const head = possibleHeads[0];

  const path = [{ r: head.r, c: head.c }];
  occupied[head.r][head.c] = true;

  const segmentLength = 1 + Math.floor(rand() * 2);
  let current = { r: head.r, c: head.c };

  for (let s = 0; s < segmentLength; s++) {
    const neighbors = shuffle([...DIR_KEYS], rand)
      .map(d => ({ r: current.r + DIRS[d].dy, c: current.c + DIRS[d].dx }))
      .filter(n => n.r >= 0 && n.r < size && n.c >= 0 && n.c < size && !occupied[n.r][n.c]);

    if (!neighbors.length) break;

    current = neighbors[0];
    occupied[current.r][current.c] = true;
    path.unshift({ r: current.r, c: current.c });
  }

  // Özel Tür Belirleme (Rotator, Locked, Double)
  let type = 'normal';
  let lockColor = 0;
  let active = true;
  const roll = rand();

  if (roll < 0.25 && level >= 10) {
    type = 'rotator';
  } else if (roll < 0.45 && level >= 15) {
    type = 'locked';
    lockColor = Math.floor(rand() * 3);
    active = false;
  } else if (roll < 0.65 && level >= 5) {
    type = 'double';
  }

  return {
    id,
    r: head.r,
    c: head.c,
    segments: path,
    dir: head.dir,
    cleared: false,
    type,
    lockColor,
    active,
    rot: 0
  };
}

function isExitRayClear(r, c, dirKey, occupied, size) {
  const { dx, dy } = DIRS[dirKey];
  let rr = r + dy, cc = c + dx;
  while (rr >= 0 && rr < size && cc >= 0 && cc < size) {
    if (occupied[rr][cc]) return false;
    rr += dy; cc += dx;
  }
  return true;
}

export default class ArrowsGame extends BaseGame {
  init() {
    const root = document.getElementById('app-root');
    const { canvas, ctx, resizeObserver } = createGameCanvas(root);
    this.canvas = canvas;
    this.ctx = ctx;
    this._resizeObserver = resizeObserver;

    this.isLoading = true;
    this.loadingProgress = 0;
    this.images = {};

    this.over = false;
    this.currentLevel = this._loadLevel();

    // Sürükleme / Pan Değişkenleri
    this.panOffset = { x: 0, y: 0 };
    this.dragStart = { x: 0, y: 0 };
    this.isDragging = false;
    this.pointerDownPos = { x: 0, y: 0 };

    // Özel Görselleri/Sprite'ları Yükleme
    this._loadAssets(() => {
      this.isLoading = false;
      this._startLevel(this.currentLevel);
    });

    this._detach = attachPointerEvents(canvas, {
      onDown: (p) => this._onPointerDown(p.x, p.y),
      onMove: (p) => this._onPointerMove(p.x, p.y),
      onUp: (p) => this._onPointerUp(p.x, p.y)
    });
  }

  /**
   * Yükleme Ekranı İçin Görsel/Asset Yükleyici
   */
  _loadAssets(onComplete) {
    // Yüklemek istediğiniz resimlerin Yolu (Gerekli değilse vektörel çizim kullanılır)
    const assetSources = {
      // bg: 'assets/images/game_bg.png',
      // arrowHead: 'assets/images/arrow_head.png'
    };

    const keys = Object.keys(assetSources);
    if (keys.length === 0) {
      // Görsel tanımlanmadıysa yükleme ekranını kısa simüle etip başlat
      let progress = 0;
      const interval = setInterval(() => {
        progress += 0.2;
        this.loadingProgress = Math.min(1, progress);
        if (progress >= 1) {
          clearInterval(interval);
          onComplete();
        }
      }, 50);
      return;
    }

    let loadedCount = 0;
    keys.forEach((key) => {
      const img = new Image();
      img.src = assetSources[key];
      img.onload = () => {
        this.images[key] = img;
        loadedCount++;
        this.loadingProgress = loadedCount / keys.length;
        if (loadedCount === keys.length) onComplete();
      };
      img.onerror = () => {
        loadedCount++;
        this.loadingProgress = loadedCount / keys.length;
        if (loadedCount === keys.length) onComplete();
      };
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
    this.panOffset = { x: 0, y: 0 };
    this._shake = null;
    this._clearing = null;
    this._rotating = null;
  }

  revive() {
    this.lives = START_LIVES;
    this.over = false;
  }

  _onPointerDown(x, y) {
    if (this.isLoading || this.over || this.levelJustCleared) return;
    this.isDragging = true;
    this.pointerDownPos = { x, y };
    this.dragStart = { x: x - this.panOffset.x, y: y - this.panOffset.y };
  }

  _onPointerMove(x, y) {
    if (!this.isDragging) return;
    this.panOffset.x = x - this.dragStart.x;
    this.panOffset.y = y - this.dragStart.y;
  }

  _onPointerUp(x, y) {
    if (!this.isDragging) return;
    this.isDragging = false;

    const dist = Math.hypot(x - this.pointerDownPos.x, y - this.pointerDownPos.y);
    if (dist < 8) {
      this._onTap(x, y);
    }
  }

  _onTap(x, y) {
    if (this.isLoading || this.over || this.levelJustCleared || this._rotating || this._clearing) return;

    const tile = this._getClickedTile(x, y);
    if (!tile || tile.cleared || tile.type === 'blocked') return;

    // Rotator Mantığı
    if (tile.type === 'rotator') {
      this._rotating = { tile, t: 0 };
      const dirs = ['up', 'right', 'down', 'left'];
      const idx = dirs.indexOf(tile.dir);
      tile.dir = dirs[(idx + 1) % 4];
      tile.rot = (tile.rot || 0) + Math.PI / 2;

      bus.emit(EVENTS.SFX_PLAY, 'blockRotate');
      setTimeout(() => {
        this._rotating = null;
        if (!this._checkCollision(tile)) {
          this._clearTile(tile);
        } else {
          tile.dir = dirs[idx];
          tile.rot = (tile.rot || 0) - Math.PI / 2;
          this._shake = { tile, t: 0 };
          this.lives -= 1;
          bus.emit(EVENTS.SFX_PLAY, 'arrowBlocked');
          if (this.lives <= 0) {
            this.over = true;
            gameManager.playerLost();
          }
        }
      }, 250);
      return;
    }

    // Kilitli Mantık
    if (tile.type === 'locked' && !tile.active) {
      this._shake = { tile, t: 0 };
      bus.emit(EVENTS.SFX_PLAY, 'arrowBlocked');
      return;
    }

    // Çarpışma Kontrolü
    if (!this._checkCollision(tile)) {
      this._clearTile(tile);
    } else {
      this._shake = { tile, t: 0 };
      this.lives -= 1;
      bus.emit(EVENTS.SFX_PLAY, 'arrowBlocked');
      if (this.lives <= 0) {
        this.over = true;
        gameManager.playerLost();
      }
    }
  }

  _getClickedTile(screenX, screenY) {
    const W = this.canvas.width, H = this.canvas.height;
    const size = this.gridSize;
    const cell = Math.min(W / (size + 1), H / (size + 3));
    const gridW = size * cell;
    const gridH = size * cell;
    const gridLeft = (W - gridW) / 2 + this.panOffset.x;
    const gridTop = (H - gridH) / 2 + 20 + this.panOffset.y;

    for (const t of this.tiles) {
      if (t.cleared) continue;
      for (let i = 0; i < t.segments.length; i++) {
        const seg = t.segments[i];
        const cx = gridLeft + seg.c * cell + cell / 2;
        const cy = gridTop + seg.r * cell + cell / 2;
        if (Math.hypot(screenX - cx, screenY - cy) < cell * 0.45) {
          return t;
        }
      }
    }
    return null;
  }

  _checkCollision(targetTile) {
    const head = targetTile.segments[targetTile.segments.length - 1];
    const { dx, dy } = DIRS[targetTile.dir];

    for (let step = 1; step <= this.gridSize * 2; step++) {
      const checkPt = { r: head.r + dy * step, c: head.c + dx * step };

      for (const other of this.tiles) {
        if (other.id === targetTile.id || other.cleared) continue;

        for (let i = 0; i < other.segments.length; i++) {
          const seg = other.segments[i];
          if (seg.r === checkPt.r && seg.c === checkPt.c) {
            return true;
          }
        }
      }
    }
    return false;
  }

  _clearTile(tile) {
    tile.cleared = true;
    this._clearing = { tile, progress: 0 };
    gameManager.addScore(tile.type === 'double' ? 20 : 10);
    bus.emit(EVENTS.SFX_PLAY, 'arrowSlide');

    this._updateLocks();

    if (this.tiles.every((t) => t.cleared || t.type === 'blocked')) {
      this._onLevelCleared();
    }
  }

  _updateLocks() {
    for (const t of this.tiles) {
      if (t.type === 'locked' && !t.active) {
        const remainingNormals = this.tiles.filter(x => x.type === 'normal' && !x.cleared).length;
        if (remainingNormals === 0) t.active = true;
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
    }, 900);
  }

  update(dt) {
    if (this._shake) { this._shake.t += dt; if (this._shake.t > 14) this._shake = null; }
    if (this._clearing) {
      this._clearing.progress += dt * 0.08;
      if (this._clearing.progress >= 1) this._clearing = null;
    }
    if (this._rotating) { this._rotating.t += dt; }

    this._render();
  }

  _render() {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;

    // YÜKLEME EKRANI GÖRSELİ
    if (this.isLoading) {
      drawGradientBackground(ctx, W, H, [[0, '#0f172a'], [1, '#1e293b']]);
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('YÜKLENİYOR...', W / 2, H / 2 - 20);

      // Yükleme Barı
      const barW = 200, barH = 12;
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      roundRectPath(ctx, W / 2 - barW / 2, H / 2 + 10, barW, barH, 6);
      ctx.fill();

      ctx.fillStyle = '#3b82f6';
      roundRectPath(ctx, W / 2 - barW / 2, H / 2 + 10, barW * this.loadingProgress, barH, 6);
      ctx.fill();
      ctx.restore();
      return;
    }

    // OYUN ARKA PLANI
    drawGradientBackground(ctx, W, H, [[0, '#0d1b2a'], [0.5, '#1b263b'], [1, '#0d1b2a']]);

    // Arka Plan Izgara Çizgileri
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
    const gridLeft = (W - gridW) / 2 + this.panOffset.x;
    const gridTop = (H - gridH) / 2 + 20 + this.panOffset.y;

    // HUD: Canlar + Seviye
    ctx.save();
    ctx.font = `bold ${Math.max(16, cell * 0.35)}px Poppins, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ff6b6b';
    const hearts = '\u2764'.repeat(Math.max(0, this.lives)) + '\u2661'.repeat(Math.max(0, START_LIVES - this.lives));
    ctx.fillText(hearts, gridLeft, gridTop - cell * 0.4);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#90e0ef';
    ctx.fillText(`LV.${this.currentLevel} ${getDifficultyName(this.currentLevel)} ${size}x${size}`, gridLeft + gridW, gridTop - cell * 0.4);
    ctx.restore();

    // Izgara Yuvaları Background
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        roundRectPath(ctx, gridLeft + c * cell + 2, gridTop + r * cell + 2, cell - 4, cell - 4, cell * 0.15);
        ctx.fill();
      }
    }
    ctx.restore();

    // Engelleri Çiz (Blocked)
    for (const t of this.tiles) {
      if (t.type !== 'blocked') continue;
      const cx = gridLeft + t.c * cell + cell / 2;
      const cy = gridTop + t.r * cell + cell / 2;
      ctx.save();
      ctx.fillStyle = 'rgba(40, 50, 70, 0.9)';
      ctx.strokeStyle = 'rgba(80, 100, 130, 0.5)';
      ctx.lineWidth = 2;
      roundRectPath(ctx, gridLeft + t.c * cell + 3, gridTop + t.r * cell + 3, cell - 6, cell - 6, cell * 0.12);
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(120, 140, 170, 0.5)';
      ctx.beginPath();
      ctx.moveTo(cx - cell * 0.2, cy - cell * 0.2); ctx.lineTo(cx + cell * 0.2, cy + cell * 0.2);
      ctx.moveTo(cx + cell * 0.2, cy - cell * 0.2); ctx.lineTo(cx - cell * 0.2, cy + cell * 0.2);
      ctx.stroke();
      ctx.restore();
    }

    // Ok Kiremitlerini Çiz
    for (const t of this.tiles) {
      if (t.cleared && this._clearing?.tile !== t || t.type === 'blocked') continue;
      this._drawTile(ctx, t, gridLeft, gridTop, cell);
    }

    // Seviye Bitti Efekti
    if (this.levelJustCleared) {
      ctx.save();
      ctx.fillStyle = 'rgba(13,71,161,0.5)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${cell * 0.8}px Baloo 2, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('TEBRİKLER!', W / 2, gridTop + gridH / 2);
      ctx.restore();
    }
  }

  _drawTile(ctx, t, gridLeft, gridTop, cell) {
    const isShaking = this._shake?.tile === t;
    const shakeX = isShaking ? Math.sin(this._shake.t * 3) * 4 : 0;

    let offsetDx = 0, offsetDy = 0;
    if (this._clearing?.tile === t) {
      const p = this._clearing.progress;
      const { dx, dy } = DIRS[t.dir];
      offsetDx = dx * p * cell * 5;
      offsetDy = dy * p * cell * 5;
    }

    // Ok Gövdesi ve Parçalarını Kiremit Olarak Çiz
    t.segments.forEach((seg, idx) => {
      const cx = gridLeft + seg.c * cell + cell / 2 + shakeX + offsetDx;
      const cy = gridTop + seg.r * cell + cell / 2 + offsetDy;
      const size = cell * 0.75;

      ctx.save();
      ctx.translate(cx, cy);

      let bgColor, shadowColor;
      if (isShaking) {
        bgColor = '#ef4444';
        shadowColor = 'rgba(239, 68, 68, 0.5)';
      } else if (t.type === 'double') {
        bgColor = 'rgba(255,193,7,0.9)'; shadowColor = 'rgba(255,193,7,0.4)';
      } else if (t.type === 'rotator') {
        bgColor = 'rgba(156,39,176,0.9)'; shadowColor = 'rgba(156,39,176,0.4)';
      } else if (t.type === 'locked') {
        bgColor = t.active ? 'rgba(100,220,150,0.9)' : 'rgba(60,70,90,0.9)';
        shadowColor = t.active ? 'rgba(100,220,150,0.4)' : 'rgba(60,70,90,0.4)';
      } else {
        bgColor = 'rgba(25,55,95,0.9)'; shadowColor = 'rgba(100,180,255,0.3)';
      }

      ctx.fillStyle = bgColor;
      ctx.shadowColor = shadowColor;
      ctx.shadowBlur = 8;
      roundRectPath(ctx, -size / 2, -size / 2, size, size, cell * 0.15);
      ctx.fill();

      // İkonlar
      if (t.type === 'locked' && !t.active && idx === 0) {
        ctx.fillStyle = LOCK_COLORS[t.lockColor] || '#fff';
        ctx.beginPath();
        ctx.arc(0, -size * 0.1, size * 0.12, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(-size * 0.12, size * 0.05, size * 0.24, size * 0.18);
      }

      if (t.type === 'rotator' && idx === 0) {
        ctx.strokeStyle = '#e1bee7'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, size * 0.22, 0, Math.PI * 1.5); ctx.stroke();
      }

      // Ok Başlığı (En Son Parçada Çizilir)
      if (idx === t.segments.length - 1) {
        let rotation = (t.rot || 0) + (DIR_ANGLE[t.dir] || 0);
        if (this._rotating && this._rotating.tile === t) {
          rotation += (this._rotating.t / 5) * (Math.PI / 2);
        }
        ctx.rotate(rotation);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        const s = size * 0.3;
        ctx.moveTo(s, 0);
        ctx.lineTo(-s * 0.6, -s * 0.85);
        ctx.lineTo(-s * 0.6, s * 0.85);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    });
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
