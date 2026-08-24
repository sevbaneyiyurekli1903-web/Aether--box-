import bus from './EventBus.js';
import { EVENTS } from './Events.js';
import i18n from './I18nManager.js';
import { MainMenuScreen } from '../ui/screens/MainMenuScreen.js';
import { GameSelectScreen } from '../ui/screens/GameSelectScreen.js';
import { SettingsScreen } from '../ui/screens/SettingsScreen.js';
import { ReviveOverlay } from '../ui/ReviveOverlay.js';
import { AdOverlay } from '../ui/AdOverlay.js';

/**
 * UIManager.js
 * -----------------------------------------------------------------
 * Deliberately thin. It owns the screen instances (plus the game HUD
 * and the revive overlay) and shows/hides them in reaction to
 * navigation + game-lifecycle events — it does NOT contain any
 * screen's actual layout or click logic (that lives in each screen's
 * own file, e.g. GameSelectScreen.js).
 *
 * UIManager never calls GameManager directly, and GameManager never
 * calls UIManager directly — both only touch the EventBus. Either
 * one can be unit-tested or replaced without the other noticing.
 * -----------------------------------------------------------------
 */
class UIManager {
  constructor() {
    this.root = null;
    this.screens = {};
    this.activeScreenId = null;
  }

  init(rootElement) {
    this.root = rootElement;

    this.screens = {
      mainMenu: new MainMenuScreen(),
      gameSelect: new GameSelectScreen(),
      settings: new SettingsScreen()
    };

    for (const screen of Object.values(this.screens)) {
      const el = screen.render();
      el.classList.add('hidden');
      this.root.appendChild(el);
    }

    // The game-viewport now IS the whole screen (position:fixed,
    // inset:0 -- see main.css) instead of a small centered "phone
    // frame" box. EXIT and the Best/Score chips float directly on top
    // of the canvas as absolutely-positioned children of this same
    // container, anchored to the screen's actual corners:
    //   - EXIT: top-left
    //   - BEST / SCORE: top-center (clear of any game's own on-canvas
    //     UI, several of which use the top-right corner)
    // There is no generic "Joker" button anymore -- the only jokers
    // left in the app are Planet Merge's own shake/bomb buttons, which
    // that game builds and owns itself (see PlanetMergeGame.js), not
    // the shared HUD, since no other game has one anymore.
    //
    // Because the HUD and the canvas are both anchored to this one
    // shared, always-screen-sized container, they structurally cannot
    // drift apart on any device aspect ratio.
    this._gameViewport = document.createElement('div');
    this._gameViewport.id = 'game-viewport';
    this._gameViewport.classList.add('hidden');
    this.root.appendChild(this._gameViewport);

    this._canvasSlot = document.createElement('div');
    this._canvasSlot.id = 'game-canvas-slot';
    this._gameViewport.appendChild(this._canvasSlot);

    this._exitBtn = document.createElement('button');
    this._exitBtn.type = 'button';
    this._exitBtn.className = 'crystal-btn exit-btn';
    this._exitBtn.textContent = i18n.t('exit');
    this._exitBtn.addEventListener('click', () => {
      bus.emit(EVENTS.UI_CLICK);
      bus.emit(EVENTS.NAV_SHOW_GAME_SELECT);
    });
    this._gameViewport.appendChild(this._exitBtn);

    const scoreGroup = document.createElement('div');
    scoreGroup.className = 'score-hud-group';
    // Best Score + live Score: both live in the shared UI layer, not
    // inside any game's own canvas/DOM, so it's structurally
    // impossible for a game's init()/destroy() cycle to remove them
    // -- this is also what guarantees EVERY game has a scoreboard.
    this._bestScoreEl = document.createElement('div');
    this._bestScoreEl.className = 'best-score-hud';
    this._currentBest = 0;
    this._scoreEl = document.createElement('div');
    this._scoreEl.className = 'live-score-hud';
    scoreGroup.append(this._bestScoreEl, this._scoreEl);
    this._gameViewport.appendChild(scoreGroup);

    this._reviveOverlay = new ReviveOverlay();
    const reviveEl = this._reviveOverlay.render();
    this.root.appendChild(reviveEl);

    this._adOverlay = new AdOverlay();
    this.root.appendChild(this._adOverlay.render());

    bus.on(EVENTS.NAV_SHOW_MAIN_MENU, () => this._show('mainMenu'));
    bus.on(EVENTS.NAV_SHOW_GAME_SELECT, () => this._show('gameSelect'));
    bus.on(EVENTS.NAV_SHOW_SETTINGS, () => this._show('settings'));

    // While a game is running, no menu screen should be visible; when
    // it exits, GameManager emits GAME_EXITED and we return to the menu.
    bus.on(EVENTS.GAME_STARTED, (entry) => {
      this._hideAll();
      this._gameViewport.classList.remove('hidden');
      this._currentBest = (entry && typeof entry.highScore === 'number') ? entry.highScore : 0;
      this._renderBestScore();
      this._renderScore(0);
    });
    bus.on(EVENTS.GAME_EXITED, () => this._show('mainMenu'));

    // Live-update: current score always reflects the active run; if it
    // passes the stored best, the Best HUD reflects that immediately
    // too, rather than waiting for the next game-over screen.
    bus.on(EVENTS.SCORE_CHANGED, (score) => {
      this._renderScore(score);
      if (score > this._currentBest) {
        this._currentBest = score;
        this._renderBestScore();
      }
    });

    bus.on(EVENTS.REVIVE_OFFERED, () => this._reviveOverlay.show());

    bus.on(EVENTS.LANGUAGE_CHANGED, () => {
      this._exitBtn.textContent = i18n.t('exit');
      this._renderBestScore();
      // live score text is re-derived from _currentScore tracked via renderScore calls;
      // simplest correct refresh is to just re-run the last known score through it
      if (typeof this._lastScore === 'number') this._renderScore(this._lastScore);
    });

    this._show('mainMenu');
  }

  _renderBestScore() {
    this._bestScoreEl.textContent = `${i18n.t('best')}: ` + Math.floor(this._currentBest);
  }
  _renderScore(score) {
    this._lastScore = score;
    this._scoreEl.textContent = `${i18n.t('score')}: ` + Math.floor(score);
  }

  _show(screenId) {
    this._gameViewport.classList.add('hidden');
    for (const [id, screen] of Object.entries(this.screens)) {
      const isTarget = id === screenId;
      screen.element.classList.toggle('hidden', !isTarget);
      if (isTarget && typeof screen.onShow === 'function') screen.onShow();
    }
    this.activeScreenId = screenId;
  }

  _hideAll() {
    for (const screen of Object.values(this.screens)) {
      screen.element.classList.add('hidden');
    }
    this.activeScreenId = null;
  }
}

export default new UIManager();
