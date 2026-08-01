import bus from '../../core/EventBus.js';
import { EVENTS } from '../../core/Events.js';
import i18n from '../../core/I18nManager.js';

// Local logo asset for offline/APK compatibility
const LOGO_URL = 'assets/images/logo.png';

/**
 * MainMenuScreen.js
 * -----------------------------------------------------------------
 * Top of the user journey: the crystal logo (centered, no text
 * wordmark next to/under it), PLAY -> Game Select, REMOVE ADS (IAP
 * stub), SETTINGS -> Settings. Same decoupling rule as every other
 * screen -- only talks to the EventBus, never to GameManager/
 * UIManager/AudioManager instances directly.
 *
 * All visible text goes through i18n.t(key) and refreshes on
 * EVENTS.LANGUAGE_CHANGED instead of being hardcoded in English.
 * -----------------------------------------------------------------
 */
export class MainMenuScreen {
  constructor() {
    this.element = null;
  }

  render() {
    const section = document.createElement('section');
    section.className = 'screen main-menu-screen';

    const logo = document.createElement('img');
    logo.className = 'crystal-logo';
    logo.src = LOGO_URL;
    logo.alt = 'Aether Hub';
    logo.addEventListener('error', () => {
      logo.classList.add('crystal-logo--missing');
    }, { once: true });

    this._playBtn = document.createElement('button');
    this._playBtn.type = 'button';
    this._playBtn.className = 'crystal-btn main-btn main-btn--primary';
    this._playBtn.addEventListener('click', () => {
      bus.emit(EVENTS.UI_CLICK);
      bus.emit(EVENTS.NAV_SHOW_GAME_SELECT);
    });

    this._removeAdsBtn = document.createElement('button');
    this._removeAdsBtn.type = 'button';
    this._removeAdsBtn.className = 'crystal-btn main-btn main-btn--gold';
    this._removeAdsBtn.addEventListener('click', () => {
      bus.emit(EVENTS.UI_CLICK);
      bus.emit(EVENTS.REMOVE_ADS_REQUESTED);
    });

    this._settingsBtn = document.createElement('button');
    this._settingsBtn.type = 'button';
    this._settingsBtn.className = 'crystal-btn main-btn main-btn--ghost';
    this._settingsBtn.addEventListener('click', () => {
      bus.emit(EVENTS.UI_CLICK);
      bus.emit(EVENTS.NAV_SHOW_SETTINGS);
    });

    section.append(logo, this._playBtn, this._removeAdsBtn, this._settingsBtn);
    this.element = section;

    this._applyTranslations();
    bus.on(EVENTS.LANGUAGE_CHANGED, () => this._applyTranslations());

    return section;
  }

  _applyTranslations() {
    this._playBtn.textContent = i18n.t('play');
    this._removeAdsBtn.textContent = i18n.t('removeAds');
    this._settingsBtn.textContent = i18n.t('settings');
  }
}
