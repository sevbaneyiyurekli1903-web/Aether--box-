import bus from '../../core/EventBus.js';
import { EVENTS } from '../../core/Events.js';
import i18n from '../../core/I18nManager.js';

/**
 * LoadingScreen.js
 * -----------------------------------------------------------------
 * Full-screen loading overlay shown for exactly 7 seconds during
 * every transition: app launch, entering any game, switching main
 * menus, or opening settings. Uses the local asset
 * assets/images/yukleme-ekrani.png.
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
    img.src = 'assets/images/yukleme-ekrani.png';
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
    }, 7000);
  }

  hide() {
    this.element.classList.add('hidden');
    if (this._timerId) {
      clearTimeout(this._timerId);
      this._timerId = null;
    }
  }
}
