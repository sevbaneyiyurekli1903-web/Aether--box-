import bus from '../core/EventBus.js';
import { EVENTS } from '../core/Events.js';
import i18n from '../core/I18nManager.js';

const COUNTDOWN_SECONDS = 5;

/**
 * ReviveOverlay.js
 * -----------------------------------------------------------------
 * Shown on EVENTS.REVIVE_OFFERED (GameManager has already paused the
 * loop by that point, so the game world is frozen behind this).
 *
 * Layout is deliberate, per spec:
 *   - a dark full-screen scrim
 *   - a rectangular panel, centered, containing ONLY the countdown
 *     and the "Watch Ad to Revive" button
 *   - "No thanks" sits OUTSIDE that panel, slightly below it — a
 *     sibling in the overlay, not a second button inside the panel
 *
 * Only ever emits REVIVE_ACCEPTED / REVIVE_DECLINED. It has no idea
 * GameManager is the one listening or that a real ad SDK will
 * eventually sit behind "accept".
 * -----------------------------------------------------------------
 */
export class ReviveOverlay {
  constructor() {
    this.element = null;
    this._countdownEl = null;
    this._intervalId = null;
    this._remaining = COUNTDOWN_SECONDS;
  }

  render() {
    const overlay = document.createElement('div');
    overlay.className = 'revive-overlay hidden';

    const panel = document.createElement('div');
    panel.className = 'revive-panel';

    const countdown = document.createElement('p');
    countdown.className = 'revive-countdown';
    countdown.textContent = String(COUNTDOWN_SECONDS);
    this._countdownEl = countdown;

    const watchBtn = document.createElement('button');
    watchBtn.type = 'button';
    watchBtn.className = 'revive-watch-btn';
    watchBtn.textContent = i18n.t('watchAdToRevive');
    watchBtn.addEventListener('click', () => this._accept());

    panel.append(countdown, watchBtn);

    const decline = document.createElement('span');
    decline.className = 'revive-decline';
    decline.textContent = i18n.t('noThanks');
    decline.addEventListener('click', () => this._decline());

    // decline is a SIBLING of panel inside overlay — outside/below it,
    // not nested inside the rectangular panel.
    overlay.append(panel, decline);

    this.element = overlay;
    this._watchBtn = watchBtn;
    this._declineEl = decline;
    bus.on(EVENTS.LANGUAGE_CHANGED, () => {
      this._watchBtn.textContent = i18n.t('watchAdToRevive');
      this._declineEl.textContent = i18n.t('noThanks');
    });
    return overlay;
  }

  show() {
    this._remaining = COUNTDOWN_SECONDS;
    this._countdownEl.textContent = String(this._remaining);
    this.element.classList.remove('hidden');
    this._clearTimer();
    this._intervalId = setInterval(() => {
      this._remaining -= 1;
      this._countdownEl.textContent = String(Math.max(0, this._remaining));
      if (this._remaining <= 0) this._decline(); // timeout behaves exactly like "No thanks"
    }, 1000);
  }

  hide() {
    this._clearTimer();
    this.element.classList.add('hidden');
  }

  _accept() {
    this._clearTimer();
    this.hide();
    bus.emit(EVENTS.UI_CLICK);
    bus.emit(EVENTS.REVIVE_ACCEPTED);
  }

  _decline() {
    this._clearTimer();
    this.hide();
    bus.emit(EVENTS.UI_CLICK);
    bus.emit(EVENTS.REVIVE_DECLINED);
  }

  _clearTimer() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }
}
