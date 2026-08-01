import bus from './EventBus.js';
import { EVENTS } from './Events.js';
import i18n from './I18nManager.js';
import { MainMenuScreen } from '../ui/screens/MainMenuScreen.js';
import { GameSelectScreen } from '../ui/screens/GameSelectScreen.js';
import { SettingsScreen } from '../ui/screens/SettingsScreen.js';
import { LoadingScreen } from '../ui/screens/LoadingScreen.js';
import { PlayScreen } from '../ui/screens/PlayScreen.js';
import { ReviveOverlay } from '../ui/ReviveOverlay.js';
import { AdOverlay } from '../ui/AdOverlay.js';

class UIManager {
  constructor() {
    this.root = null;
    this.screens = {};
    this.activeScreenId = null;
    this._pendingGameId = null;
  }

  init(rootElement) {
    this.root = rootElement;

    // Loading screen (always first, covers everything)
    this._loadingScreen = new LoadingScreen();
    this.root.appendChild(this._loadingScreen.render());

    // Play screen (after loading, before game)
    this._playScreen = new PlayScreen();
    this.root.appendChild(this._playScreen.render());

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
    this._bestScoreEl = document.createElement('div');
    this._bestScoreEl.className = 'best-score-hud';
    this._currentBest = 0;
    this._scoreEl = document.createElement('div');
    this._scoreEl.className = 'live-score-hud';
    scoreGroup.append(this._bestScoreEl, this._scoreEl);
    this._gameViewport.appendChild(scoreGroup);

    this._reviveOverlay = new ReviveOverlay();
    this.root.appendChild(this._reviveOverlay.render());

    this._adOverlay = new AdOverlay();
    this.root.appendChild(this._adOverlay.render());

    // Navigation with loading screens
    bus.on(EVENTS.NAV_SHOW_MAIN_MENU, () => {
      this._loadingScreen.show(() => this._show('mainMenu'));
    });
    bus.on(EVENTS.NAV_SHOW_GAME_SELECT, () => {
      this._loadingScreen.show(() => this._show('gameSelect'));
    });
    bus.on(EVENTS.NAV_SHOW_SETTINGS, () => {
      this._loadingScreen.show(() => this._show('settings'));
    });

    // Game loading flow: Loading -> Play Screen -> Game
    bus.on(EVENTS.NAV_LOAD_GAME, (gameId) => {
      this._pendingGameId = gameId;
      this._hideAll();
      this._loadingScreen.show(() => {
        this._playScreen.show(gameId);
      });
    });

    bus.on(EVENTS.PLAY_SCREEN_CONFIRMED, (gameId) => {
      bus.emit(EVENTS.GAME_LOADING, { id: gameId });
    });

    bus.on(EVENTS.GAME_STARTED, (entry) => {
      this._gameViewport.classList.remove('hidden');
      this._currentBest = (entry && typeof entry.highScore === 'number') ? entry.highScore : 0;
      this._renderBestScore();
      this._renderScore(0);
    });

    bus.on(EVENTS.GAME_EXITED, () => this._show('mainMenu'));

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
      if (typeof this._lastScore === 'number') this._renderScore(this._lastScore);
    });

    // Initial load with loading screen
    this._loadingScreen.show(() => this._show('mainMenu'));
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
