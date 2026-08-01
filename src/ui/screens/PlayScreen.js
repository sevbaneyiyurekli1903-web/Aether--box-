import bus from '../../core/EventBus.js';
import { EVENTS } from '../../core/Events.js';
import i18n from '../../core/I18nManager.js';

/**
 * PlayScreen.js
 * -----------------------------------------------------------------
 * Mandatory preparation screen shown after loading completes.
 * Player must tap "PLAY" to actually start the game.
 * -----------------------------------------------------------------
 */
export class PlayScreen {
  constructor() {
    this.element = null;
    this._playBtn = null;
    this._gameId = null;
  }

  render() {
    const overlay = document.createElement('div');
    overlay.className = 'play-overlay hidden';
    overlay.id = 'play-overlay';

    const panel = document.createElement('div');
    panel.className = 'play-panel';

    const title = document.createElement('h2');
    title.className = 'play-title';
    title.textContent = 'READY?';

    this._playBtn = document.createElement('button');
    this._playBtn.type = 'button';
    this._playBtn.className = 'crystal-btn play-btn';
    this._playBtn.textContent = i18n.t('play');
    this._playBtn.addEventListener('click', () => {
      bus.emit(EVENTS.UI_CLICK);
      bus.emit(EVENTS.PLAY_SCREEN_CONFIRMED, this._gameId);
      this.hide();
    });

    panel.append(title, this._playBtn);
    overlay.appendChild(panel);
    this.element = overlay;
    return overlay;
  }

  show(gameId) {
    this._gameId = gameId;
    this.element.classList.remove('hidden');
  }

  hide() {
    this.element.classList.add('hidden');
  }
}
