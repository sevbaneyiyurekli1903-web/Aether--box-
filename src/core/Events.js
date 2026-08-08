/**
 * Events.js
 * -----------------------------------------------------------------
 * Central registry of every event name used on the EventBus. Import
 * this instead of typing string literals — a typo in a plain string
 * fails silently (the listener just never fires); a typo referencing
 * EVENTS.SCORE_CHANGD throws immediately as "undefined".
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

  // -- revive flow: a game calling gameManager.playerLost() triggers
  // this instead of ending immediately, so the player gets an ad-revive
  // choice before the run is actually finalized --
  REVIVE_OFFERED: 'revive:offered',   // GameManager -> UIManager, payload {score}
  REVIVE_ACCEPTED: 'revive:accepted', // UIManager -> GameManager ("Watch Ad to Revive" clicked)
  REVIVE_DECLINED: 'revive:declined', // UIManager -> GameManager ("No thanks" clicked, or timer ran out)

  // -- ad jokers: no longer a universal per-game button. The only
  // jokers left in the app are Planet Merge's own "shake" and "bomb"
  // buttons (built/owned by PlanetMergeGame itself, not the shared
  // HUD), so both events now carry a jokerId ('shake' | 'bomb') --
  AD_JOKER_REQUESTED: 'adJoker:requested', // game's own button -> GameManager, payload jokerId
  AD_JOKER_GRANTED: 'adJoker:granted',     // GameManager -> everyone, payload jokerId (ad "finished", advantage applied)

  // -- gameplay signals any active game can emit --
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
