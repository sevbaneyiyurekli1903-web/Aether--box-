import bus from '../../core/EventBus.js';
import { EVENTS } from '../../core/Events.js';
import i18n from '../../core/I18nManager.js';

/**
 * LoadingScreen.js
 * -----------------------------------------------------------------
 * Oyun ilk açılırken ve menüler arası geçişlerde 5 saniyeliğine
 * loading-bg.png görselini gösterir.
 * -----------------------------------------------------------------
 */

export class LoadingScreen {
  constructor() {
    this.element = null;
    this._timerId = null;
    this._onComplete = null;
  }

  render() {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay hidden';
    overlay.id = 'loading-overlay';

    const img = document.createElement('img');
    img.className = 'loading-image';
    img.src = 'assets/images/loading-bg.png';
    img.alt = 'Loading...';
    overlay.appendChild(img);

    this.element = overlay;
    return overlay;
  }

  show(onComplete) {
    this._onComplete = onComplete;
    this.element.classList.remove('hidden');
    if (this._timerId) clearTimeout(this._timerId);
    this._timerId = setTimeout(() => {
      this.hide();
      if (typeof this._onComplete === 'function') this._onComplete();
    }, 5000); // 5 saniye
  }

  hide() {
    this.element.classList.add('hidden');
    if (this._timerId) {
      clearTimeout(this._timerId);
      this._timerId = null;
    }
  }
}
