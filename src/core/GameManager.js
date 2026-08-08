import bus from './EventBus.js';
import { EVENTS } from './Events.js';
import { GAME_REGISTRY } from '../data/gameRegistry.js';

/**
 * GameManager.js
 * -----------------------------------------------------------------
 * Owns the top-level app state machine (which screen/mode we're in),
 * the lifecycle of whichever mini-game is currently active, and the
 * shared score/combo/high-score bookkeeping every game reports
 * through instead of implementing its own.
 *
 * GameManager never touches the DOM and never touches audio. It only
 * knows about: the game registry, the active game instance (via the
 * BaseGame contract), and the EventBus. That's the whole point of the
 * decoupling — UIManager and AudioManager react to what GameManager
 * announces; GameManager never reaches into either of them.
 * -----------------------------------------------------------------
 */

export const AppState = Object.freeze({
  MAIN_MENU: 'MAIN_MENU',
  GAME_SELECT: 'GAME_SELECT',
  SETTINGS: 'SETTINGS',
  IN_GAME: 'IN_GAME'
});

// Score thresholds that fire the announcer system (section 3.4 of the
// spec). Kept here rather than in AudioManager because "when do we
// celebrate" is game-flow logic, not an audio concern.
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
    // In-memory fallback so high scores still work for the current
    // session even if localStorage throws (private browsing, a
    // sandboxed preview, etc.) -- only localStorage survives a reload,
    // but this prevents the display from wrongly regressing to 0
    // mid-session just because storage happens to be blocked.
    this._highScoreCache = new Map();

    // Infinite Ad Mode: when on, a repeating interstitial fires every
    // ~25s while a game is active, independent of the revive/joker ad
    // flows. Only runs while state === IN_GAME (see _syncAdModeTimer).
    this._infiniteAdMode = false;
    this._adModeIntervalId = null;

    // GameManager only reacts to *requests*; it doesn't know or care
    // which button or screen made the request.
    bus.on(EVENTS.NAV_SHOW_MAIN_MENU, () => this.showMainMenu());
    bus.on(EVENTS.NAV_SHOW_GAME_SELECT, () => this.showGameSelect());
    bus.on(EVENTS.NAV_LOAD_GAME, (gameId) => this.loadGame(gameId));

    bus.on(EVENTS.SETTINGS_CHANGED, (settings) => {
      if (settings && typeof settings.infiniteAdMode === 'boolean') {
        this._infiniteAdMode = settings.infiniteAdMode;
        this._syncAdModeTimer();
      }
    });

    // Revive flow: a game calls playerLost() instead of ending
    // directly; the actual end/restart only happens once the player
    // (or the 5s timeout in ReviveOverlay) decides.
    bus.on(EVENTS.REVIVE_ACCEPTED, () => this._handleReviveAccepted());
    bus.on(EVENTS.REVIVE_DECLINED, () => this._handleReviveDeclined());

    bus.on(EVENTS.AD_JOKER_REQUESTED, (jokerId) => this._handleJokerRequested(jokerId));

    // Stub for a real IAP flow later — kept here (not in UIManager) since
    // "did the purchase succeed" is app-state logic, not a UI concern.
    bus.on(EVENTS.REMOVE_ADS_REQUESTED, () => {
      console.log('GameManager: Remove Ads requested — wire up your IAP SDK here.');
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

  /**
   * Look a game up in the registry, lazy-load its module, instantiate
   * it, and start the shared update loop. Any object honoring the
   * BaseGame contract (init/update/render/destroy) works here — the
   * game's internals are invisible to GameManager.
   */
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

  /** Called by the active game (via its BaseGame instance) on scoring events. */
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

  /**
   * Called by the active game when the player dies — NOT the same as
   * ending the run. This freezes the loop and hands off to the
   * ad-revive overlay; _handleReviveAccepted/_handleReviveDeclined
   * decide what actually happens next.
   */
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
      return cached; // storage unavailable -- still have this session's best, if any
    }
  }

  // -----------------------------------------------------------------
  // internals
  // -----------------------------------------------------------------

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
    // Finalize this run's score against the persisted high score...
    this._saveHighScore(this.activeGameId, this.score);
    bus.emit(EVENTS.GAME_OVER, { gameId: this.activeGameId, score: this.score });

    // ...then restart the SAME game from the beginning, per spec.
    // IMPORTANT: destroy() before init() — a game's init() creates its
    // own canvas/wrapper via createGameCanvas(root); without tearing
    // the old one down first, this stacks a second canvas on top of
    // the first, which is what was distorting the layout after
    // "No Thanks".
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

  /**
   * Stand-in for a real rewarded-ad SDK call (AdMob, Unity Ads, IronSource,
   * ...). Every caller above only cares that the returned promise
   * resolves once the "ad" finishes — swap this one function out when
   * wiring a real SDK and nothing else in the app needs to change.
   */
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
      // Non-fatal: the in-memory cache above still covers this session.
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
      const dt = Math.min((t - this._lastTime) / 16.6667, 3); // dt === 1 at steady 60fps
      this._lastTime = t;
      if (this.activeGame) this.activeGame.update(dt);
    };
    this._rafId = requestAnimationFrame(tick);
    this._syncAdModeTimer();
  }

  /** Starts/stops the repeating Infinite Ad Mode interstitial in
   *  lockstep with the game loop -- called from _startLoop() so every
   *  call site (loadGame, resumeGame, revive-accept, revive-decline)
   *  automatically stays correct without needing its own copy of this
   *  logic. */
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
