import i18n from '../core/I18nManager.js';
import bus from '../core/EventBus.js';
import { EVENTS } from '../core/Events.js';

/**
 * AdOverlay.js
 * -----------------------------------------------------------------
 * The full-screen interstitial shown by Infinite Ad Mode. Deliberately
 * simple and non-interactive (a real ad SDK would render its own
 * content here) -- this is a placeholder frame, not the ad itself.
 * Shown/hidden purely in reaction to EVENTS.INTERSTITIAL_SHOW/HIDE;
 * has no idea GameManager is the one driving those.
 * -----------------------------------------------------------------
 */
export class AdOverlay {
  constructor() {
    this.element = null;
  }

  render() {
    const overlay = document.createElement('div');
    overlay.className = 'ad-overlay hidden';

    const label = document.createElement('span');
    label.className = 'ad-overlay-label';
    this._label = label;

    overlay.appendChild(label);
    this.element = overlay;

    this._applyTranslations();
    bus.on(EVENTS.LANGUAGE_CHANGED, () => this._applyTranslations());
    bus.on(EVENTS.INTERSTITIAL_SHOW, () => this.show());
    bus.on(EVENTS.INTERSTITIAL_HIDE, () => this.hide());

    return overlay;
  }

  _applyTranslations() {
    this._label.textContent = i18n.t('advertisement');
  }

  show() { this.element.classList.remove('hidden'); }
  hide() { this.element.classList.add('hidden'); }
}
