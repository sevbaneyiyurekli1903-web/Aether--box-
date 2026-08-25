import bus from '../core/EventBus.js';
import { EVENTS } from '../core/Events.js';
import i18n from '../core/I18nManager.js';

/**
 * ReviveOverlay.js
 * -----------------------------------------------------------------
 * AdMob entegrasyonu:
 * - "Reklam İzle" → Ödüllü reklam (Canlanma)
 * - "Hayır, Teşekkürler" → 2x basınca geçiş reklamı
 * -----------------------------------------------------------------
 */

export class ReviveOverlay {
  constructor() {
    this.element = null;
    this._timerId = null;
    this._onComplete = null;
    this._countdown = 5;
    this._declineTapCount = 0; // "Hayır" basış sayacı
  }

  render() {
    const overlay = document.createElement('div');
    overlay.className = 'revive-overlay hidden';
    overlay.id = 'revive-overlay';

    const panel = document.createElement('div');
    panel.className = 'revive-panel';

    const title = document.createElement('div');
    title.className = 'revive-countdown';
    title.id = 'revive-countdown';
    title.textContent = String(this._countdown);
    panel.appendChild(title);

    const watchBtn = document.createElement('button');
    watchBtn.type = 'button';
    watchBtn.className = 'revive-watch-btn';
    watchBtn.textContent = i18n.t('watchAdRevive');
    watchBtn.addEventListener('click', () => {
      bus.emit(EVENTS.UI_CLICK);
      bus.emit(EVENTS.REVIVE_ACCEPTED);
    });
    panel.appendChild(watchBtn);

    const decline = document.createElement('div');
    decline.className = 'revive-decline';
    decline.id = 'revive-decline';
    decline.textContent = i18n.t('noThanks');
    decline.addEventListener('click', () => {
      bus.emit(EVENTS.UI_CLICK);
      this._declineTapCount++;

      // 2x basınca geçiş reklamı göster
      if (this._declineTapCount >= 2) {
        this._declineTapCount = 0;
        decline.textContent = i18n.t('loadingAd');
        // AdManager handleDeathRestart tetiklenir GameManager'dan
        bus.emit(EVENTS.REVIVE_DECLINED);
      } else {
        decline.textContent = i18n.t('noThanks') + ' (1/2)';
        setTimeout(() => {
          decline.textContent = i18n.t('noThanks');
        }, 1500);
      }
    });

    overlay.appendChild(panel);
    overlay.appendChild(decline);

    this.element = overlay;
    this._declineEl = decline;
    return overlay;
  }

  show() {
    this._countdown = 5;
    this._declineTapCount = 0;
    this.element.classList.remove('hidden');
    const cdEl = document.getElementById('revive-countdown');
    if (cdEl) cdEl.textContent = String(this._countdown);
    if (this._declineEl) this._declineEl.textContent = i18n.t('noThanks');

    if (this._timerId) clearInterval(this._timerId);
    this._timerId = setInterval(() => {
      this._countdown -= 1;
      const el = document.getElementById('revive-countdown');
      if (el) el.textContent = String(this._countdown);
      if (this._countdown <= 0) {
        this.hide();
        bus.emit(EVENTS.REVIVE_DECLINED);
      }
    }, 1000);
  }

  hide() {
    this.element.classList.add('hidden');
    if (this._timerId) {
      clearInterval(this._timerId);
      this._timerId = null;
    }
    this._declineTapCount = 0;
  }
}
