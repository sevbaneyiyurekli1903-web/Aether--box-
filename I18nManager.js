import bus from './EventBus.js';
import { EVENTS } from './Events.js';
import { TRANSLATIONS } from '../data/translations.js';

const STORAGE_KEY = 'aetherhub:language';
export const SUPPORTED_LANGUAGES = ['en', 'tr', 'fr', 'de'];
const LANGUAGE_NAMES = { en: 'English', tr: 'T\u00fcrk\u00e7e', fr: 'Fran\u00e7ais', de: 'Deutsch' };
const DEFAULT_LANG = 'en';

/**
 * I18nManager.js
 * -----------------------------------------------------------------
 * Singleton, same pattern as every other manager here: import the
 * default export, call .t('key') for a string in the current
 * language, listen for EVENTS.LANGUAGE_CHANGED to know when to
 * re-render. Persists the chosen language the same safe way high
 * scores are persisted (localStorage, try/catch fallback).
 * -----------------------------------------------------------------
 */
class I18nManager {
  constructor() {
    this.language = this._loadLanguage();
  }

  _loadLanguage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && SUPPORTED_LANGUAGES.includes(stored)) return stored;
    } catch {
      // storage unavailable -- fall through to default
    }
    return DEFAULT_LANG;
  }

  setLanguage(lang) {
    if (!SUPPORTED_LANGUAGES.includes(lang) || lang === this.language) return;
    this.language = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* non-fatal, session-only */ }
    bus.emit(EVENTS.LANGUAGE_CHANGED, lang);
  }

  /** Cycle to the next supported language, in a fixed order -- used by
   *  the Settings screen's single-tap language button. */
  cycleLanguage() {
    const i = SUPPORTED_LANGUAGES.indexOf(this.language);
    this.setLanguage(SUPPORTED_LANGUAGES[(i + 1) % SUPPORTED_LANGUAGES.length]);
  }

  displayName(lang = this.language) {
    return LANGUAGE_NAMES[lang] || lang;
  }

  /** Look up a string in the current language. Falls back to English,
   *  then to the raw key, so a missing translation never renders blank. */
  t(key) {
    const dict = TRANSLATIONS[this.language] || TRANSLATIONS[DEFAULT_LANG];
    return dict[key] ?? TRANSLATIONS[DEFAULT_LANG][key] ?? key;
  }
}

export default new I18nManager();
