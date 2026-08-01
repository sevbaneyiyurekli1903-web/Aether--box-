import bus from './EventBus.js';
import { EVENTS } from './Events.js';
import { GAME_REGISTRY } from '../data/gameRegistry.js';

export const AppState = Object.freeze({
  MAIN_MENU: 'MAIN_MENU',
  GAME_SELECT: 'GAME_SELECT',
  SETTINGS: 'SETTINGS',
  IN_GAME: 'IN_GAME'
});

const SCORE_ANNOUNCER_THRESHOLDS = [100, 500, 1000, 5000];

class GameManager {
  constructor() {
    this.state = AppState.MAIN_MENU;
    this.activeGame = null;
    this.activeGameId = null;
    this.score = 0;
    this.combo = 0;

    this._rafId = null;
    this._lastTime = 0;
    this._announcedThisRun = new Set();
    this._highScoreCache = new Map();

    this._infiniteAdMode = false;
    this._adModeIntervalId = null;

    bus.on(EVENTS.NAV_SHOW_MAIN_MENU, () => this.showMainMenu());
    bus.on(EVENTS.NAV_SHOW_GAME_SELECT, () => this.showGameSelect());
    bus.on(EVENTS.NAV_LOAD_GAME, (gameId) => {
      // Loading + Play screen flow handled by UIManager
      // Just store pending game id
    });
    bus.on(EVENTS.PLAY_SCREEN_CONFIRMED, (gameId) => this.loadGame(gameId));

    bus.on(EVENTS.SETTINGS_CHANGED, (settings) => {
      if (settings && typeof settings.infiniteAdMode === 'boolean') {
        this._infiniteAdMode = settings.infiniteAdMode;
        this._syncAdModeTimer();
      }
    });

    bus.on(EVENTS.REVIVE_ACCEPTED, () => this._handleReviveAccepted());
    bus.on(EVENTS.REVIVE_DECLINED, () => this._handleReviveDeclined());

    bus.on(EVENTS.AD_JOKER_REQUESTED, (jokerId) => this._handleJokerRequested(jokerId));

    bus.on(EVENTS.REMOVE_ADS_REQUESTED, () => {
      console.log('GameManager: Remove Ads requested');
    });
  }

  showMainMenu() {
    this._teardownActiveGame();
    this.state = AppState.MAIN_MENU;
    bus.emit(EVENTS.GAME_EXITED);
  }

  showGameSelect() {
    this._teardownActiveGame();
    this.state = AppState.GAME_SELECT;
  }

  showSettings() {
    this.state = AppState.SETTINGS;
  }

  async loadGame(gameId) {
    const entry = GAME_REGISTRY.find((g) => g.id === gameId);
    if (!entry || entry.comingSoon) {
      console.warn(`GameManager: "${gameId}" is not a loadable game yet.`);
      return;
    }

    this._teardownActiveGame();
    bus.emit(EVENTS.GAME_LOADING, entry);

    let GameClass;
    try {
      const module = await entry.load();
      GameClass = module.default;
    } catch (err) {
      console.error(`GameManager: failed to load module for "${gameId}"`, err);
      this.showGameSelect();
      return;
    }

    this.activeGameId = gameId;
    this.activeGame = new GameClass();
    this.score = 0;
    this.combo = 0;
    this._announcedThisRun.clear();
    this.state = AppState.IN_GAME;

    this.activeGame.init();
    bus.emit(EVENTS.GAME_STARTED, { ...entry, highScore: this.getHighScore(gameId) });
    this._startLoop();
  }

  pauseGame() {
    if (this.state !== AppState.IN_GAME) return;
    this._stopLoop();
    bus.emit(EVENTS.GAME_PAUSED);
  }

  resumeGame() {
    if (this.state !== AppState.IN_GAME) return;
    this._startLoop();
    bus.emit(EVENTS.GAME_RESUMED);
  }

  addScore(points) {
    this.score += points;
    bus.emit(EVENTS.SCORE_CHANGED, this.score);
    this._checkScoreAnnouncerThresholds();
  }

  addCombo(amount = 1) {
    this.combo += amount;
    bus.emit(EVENTS.COMBO_CHANGED, this.combo);
  }

  resetCombo() {
    if (this.combo === 0) return;
    this.combo = 0;
    bus.emit(EVENTS.COMBO_CHANGED, this.combo);
  }

  playerLost() {
    if (this.state !== AppState.IN_GAME) return;
    this._reviveOfferPending = true;
    this._stopLoop();
    bus.emit(EVENTS.REVIVE_OFFERED, { score: this.score });
  }

  getHighScore(gameId) {
    const cached = this._highScoreCache.get(gameId) || 0;
    try {
      const stored = Number(localStorage.getItem(`aetherhub:highscore:${gameId}`) || 0);
      return Math.max(cached, stored);
    } catch {
      return cached;
    }
  }

  async _handleReviveAccepted() {
    await this._simulateAdView();
    if (this.activeGame && typeof this.activeGame.revive === 'function') {
      this.activeGame.revive();
    }
    this._reviveOfferPending = false;
    this._startLoop();
    bus.emit(EVENTS.GAME_RESUMED);
  }

  _handleReviveDeclined() {
    this._saveHighScore(this.activeGameId, this.score);
    bus.emit(EVENTS.GAME_OVER, { gameId: this.activeGameId, score: this.score });

    this._reviveOfferPending = false;
    this.score = 0;
    this.combo = 0;
    this._announcedThisRun.clear();
    if (this.activeGame) {
      this.activeGame.destroy();
      this.activeGame.init();
    }
    this.state = AppState.IN_GAME;
    this._startLoop();

    const entry = GAME_REGISTRY.find((g) => g.id === this.activeGameId);
    bus.emit(EVENTS.GAME_STARTED, { ...entry, highScore: this.getHighScore(this.activeGameId) });
  }

  async _handleJokerRequested(jokerId) {
    await this._simulateAdView();
    if (this.activeGame && typeof this.activeGame.useJoker === 'function') {
      this.activeGame.useJoker(jokerId);
    }
    bus.emit(EVENTS.AD_JOKER_GRANTED, jokerId);
  }

  _simulateAdView(durationMs = 1200) {
    return new Promise((resolve) => setTimeout(resolve, durationMs));
  }

  _saveHighScore(gameId, score) {
    if (!gameId) return;
    const prevCached = this._highScoreCache.get(gameId) || 0;
    if (score > prevCached) this._highScoreCache.set(gameId, score);
    try {
      const key = `aetherhub:highscore:${gameId}`;
      const prev = Number(localStorage.getItem(key) || 0);
      if (score > prev) localStorage.setItem(key, String(score));
    } catch {
    }
  }

  _checkScoreAnnouncerThresholds() {
    for (const threshold of SCORE_ANNOUNCER_THRESHOLDS) {
      if (this.score >= threshold && !this._announcedThisRun.has(threshold)) {
        this._announcedThisRun.add(threshold);
        bus.emit(EVENTS.ANNOUNCER_TRIGGER, { type: 'score', value: threshold });
      }
    }
  }

  _startLoop() {
    this._lastTime = performance.now();
    const tick = (t) => {
      this._rafId = requestAnimationFrame(tick);
      const dt = Math.min((t - this._lastTime) / 16.6667, 3);
      this._lastTime = t;
      if (this.activeGame) this.activeGame.update(dt);
    };
    this._rafId = requestAnimationFrame(tick);
    this._syncAdModeTimer();
  }

  _syncAdModeTimer() {
    if (this._adModeIntervalId) {
      clearInterval(this._adModeIntervalId);
      this._adModeIntervalId = null;
    }
    if (this._infiniteAdMode && this.state === AppState.IN_GAME) {
      this._adModeIntervalId = setInterval(() => this._showInterstitial(), 25000);
    }
  }

  async _showInterstitial() {
    if (this.state !== AppState.IN_GAME || this._interstitialShowing || this._reviveOfferPending) return;
    this._interstitialShowing = true;
    this._stopLoop();
    bus.emit(EVENTS.INTERSTITIAL_SHOW);
    await this._simulateAdView(3000);
    bus.emit(EVENTS.INTERSTITIAL_HIDE);
    this._interstitialShowing = false;
    this._startLoop();
  }

  _stopLoop() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = null;
  }

  _teardownActiveGame() {
    this._stopLoop();
    if (this._adModeIntervalId) {
      clearInterval(this._adModeIntervalId);
      this._adModeIntervalId = null;
    }
    this._reviveOfferPending = false;
    if (this.activeGame && typeof this.activeGame.destroy === 'function') {
      this.activeGame.destroy();
    }
    this.activeGame = null;
    this.activeGameId = null;
  }
}

export default new GameManager();
