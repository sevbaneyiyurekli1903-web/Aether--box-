import bus from '../../core/EventBus.js';
import { EVENTS } from '../../core/Events.js';
import i18n from '../../core/I18nManager.js';
import adManager from '../../core/AdManager.js';

/**
 * SettingsScreen.js
 * -----------------------------------------------------------------
 * Owns its own local UI state (mute / volumes) and
 * broadcasts changes via EVENTS.SETTINGS_CHANGED. It has no idea
 * AudioManager or GameManager are the ones listening -- it would work
 * identically if some other system decided to react instead.
 *
 * Language is different: it goes through the dedicated I18nManager
 * (EVENTS.LANGUAGE_CHANGED) rather than SETTINGS_CHANGED, since a
 * language switch needs to update every screen's visible text, not
 * just audio/gameplay behavior.
 * -----------------------------------------------------------------
 */
export class SettingsScreen {
  constructor() {
    this.element = null;
    this.state = { muted: false, sfxVolume: 1, bgmVolume: 0.6 };
  }

  render() {
    const section = document.createElement('section');
    section.className = 'screen settings-screen';

    this._heading = document.createElement('h2');
    this._heading.className = 'screen-title';

    this._langBtn = document.createElement('button');
    this._langBtn.type = 'button';
    this._langBtn.className = 'crystal-btn';
    this._langBtn.addEventListener('click', () => {
      bus.emit(EVENTS.UI_CLICK);
      i18n.cycleLanguage();
    });

    this._muteBtn = document.createElement('button');
    this._muteBtn.type = 'button';
    this._muteBtn.className = 'crystal-btn';
    this._muteBtn.addEventListener('click', () => {
      bus.emit(EVENTS.UI_CLICK);
      this.state.muted = !this.state.muted;
      this._renderMuteBtn();
      bus.emit(EVENTS.SETTINGS_CHANGED, { ...this.state });
    });

    const bgmSlider = this._buildSlider(() => i18n.t('music'), this.state.bgmVolume, (v) => {
      this.state.bgmVolume = v;
      bus.emit(EVENTS.SETTINGS_CHANGED, { ...this.state });
    });
    this._bgmLabel = bgmSlider.labelEl;

    const sfxSlider = this._buildSlider(() => i18n.t('sfx'), this.state.sfxVolume, (v) => {
      this.state.sfxVolume = v;
      bus.emit(EVENTS.SETTINGS_CHANGED, { ...this.state });
    });
    this._sfxLabel = sfxSlider.labelEl;

    this._backBtn = document.createElement('button');
    this._backBtn.type = 'button';
    this._backBtn.className = 'crystal-btn back-btn';
    this._backBtn.addEventListener('click', () => {
      bus.emit(EVENTS.UI_CLICK);
      // Menü geçiş sayacını tetikler (3. geçişte AdMob reklamı açılır)
      adManager.handleMenuTransition(() => {
        bus.emit(EVENTS.NAV_SHOW_MAIN_MENU);
      });
    });

    section.append(
      this._heading,
      this._langBtn,
      bgmSlider.row,
      sfxSlider.row,
      this._muteBtn,
      this._backBtn
    );
    this.element = section;

    this._applyTranslations();
    bus.on(EVENTS.LANGUAGE_CHANGED, () => this._applyTranslations());

    return section;
  }

  _applyTranslations() {
    this._heading.textContent = i18n.t('settingsTitle');
    this._langBtn.textContent = `${i18n.t('language')}: ${i18n.displayName()}`;
    this._renderMuteBtn();
    this._bgmLabel.textContent = i18n.t('music');
    this._sfxLabel.textContent = i18n.t('sfx');
    this._backBtn.textContent = i18n.t('menu');
  }

  _renderMuteBtn() {
    this._muteBtn.textContent = this.state.muted ? i18n.t('muteOn') : i18n.t('muteOff');
  }

  _buildSlider(labelTextFn, initial, onChange) {
    const row = document.createElement('label');
    row.className = 'settings-row';

    const labelEl = document.createElement('span');
    labelEl.textContent = labelTextFn();

    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = '1';
    input.step = '0.05';
    input.value = String(initial);
    input.addEventListener('input', () => onChange(Number(input.value)));

    row.append(labelEl, input);
    return { row, labelEl };
  }
}
