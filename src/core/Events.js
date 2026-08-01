/**
 * Events.js
 * -----------------------------------------------------------------
 * Central registry of every event name used on the EventBus.
 * -----------------------------------------------------------------
 */
export const EVENTS = Object.freeze({
  // -- navigation (UI -> GameManager) --
  NAV_SHOW_MAIN_MENU: 'nav:showMainMenu',
  NAV_SHOW_GAME_SELECT: 'nav:showGameSelect',
  NAV_SHOW_SETTINGS: 'nav:showSettings',
  NAV_LOAD_GAME: 'nav:loadGame',

  // -- game lifecycle (GameManager -> everyone) --
  GAME_LOADING: 'game:loading',
  GAME_STARTED: 'game:started',
  GAME_PAUSED: 'game:paused',
  GAME_RESUMED: 'game:resumed',
  GAME_OVER: 'game:over',
  GAME_EXITED: 'game:exited',

  // -- loading & play screen --
  PLAY_SCREEN_CONFIRMED: 'play:confirmed',

  // -- revive flow --
  REVIVE_OFFERED: 'revive:offered',
  REVIVE_ACCEPTED: 'revive:accepted',
  REVIVE_DECLINED: 'revive:declined',

  // -- ad jokers --
  AD_JOKER_REQUESTED: 'adJoker:requested',
  AD_JOKER_GRANTED: 'adJoker:granted',

  // -- gameplay signals --
  SCORE_CHANGED: 'score:changed',
  COMBO_CHANGED: 'combo:changed',
  SFX_PLAY: 'sfx:play',
  ANNOUNCER_TRIGGER: 'announcer:trigger',

  // -- UI --
  UI_CLICK: 'ui:click',
  SETTINGS_CHANGED: 'settings:changed',
  REMOVE_ADS_REQUESTED: 'monetization:removeAdsRequested',
  LANGUAGE_CHANGED: 'i18n:languageChanged',

  // -- ad system --
  INTERSTITIAL_SHOW: 'ads:interstitialShow',
  INTERSTITIAL_HIDE: 'ads:interstitialHide'
});
