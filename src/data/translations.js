/**
 * translations.js
 * -----------------------------------------------------------------
 * One flat key -> string map per supported language. Every UI string
 * in the app should be looked up through I18nManager.t(key) rather
 * than hardcoded, so adding a language later only ever means adding
 * one more object here.
 *
 * Fallback order (see I18nManager.t): current language -> English ->
 * the raw key itself, so a missing translation never renders blank.
 * -----------------------------------------------------------------
 */
export const TRANSLATIONS = {
  en: {
    play: 'PLAY',
    removeAds: '\u2728 Remove Ads',
    settings: 'SETTINGS',
    selectModule: '// SELECT MODULE //',
    menu: '\u25C0 MENU',
    settingsTitle: '// SETTINGS //',
    muteOff: 'MUTE: OFF',
    muteOn: 'MUTE: ON',
    music: 'MUSIC',
    sfx: 'SFX',
    language: 'LANGUAGE',
    infiniteAdMode: 'INFINITE AD MODE',
    infiniteAdModeOff: 'INFINITE ADS: OFF',
    infiniteAdModeOn: 'INFINITE ADS: ON',
    exit: '\u25C0 EXIT',
    shakeJoker: 'Shake',
    bombJoker: 'Bomb',
    watchingAd: 'WATCHING AD\u2026',
    best: 'BEST',
    score: 'SCORE',
    watchAdToRevive: 'WATCH AD TO REVIVE',
    noThanks: 'No thanks',
    advertisement: 'ADVERTISEMENT'
  },
  tr: {
    play: 'OYNA',
    removeAds: '\u2728 Reklamlar\u0131 Kald\u0131r',
    settings: 'AYARLAR',
    selectModule: '// M\u00d6D\u00dcL SE\u00c7 //',
    menu: '\u25C0 MEN\u00dc',
    settingsTitle: '// AYARLAR //',
    muteOff: 'SES: A\u00c7IK',
    muteOn: 'SES: KAPALI',
    music: 'M\u00dcZ\u0130K',
    sfx: 'EFEKT',
    language: 'D\u0130L',
    infiniteAdMode: 'SONSUZ REKLAM MODU',
    infiniteAdModeOff: 'SONSUZ REKLAM: KAPALI',
    infiniteAdModeOn: 'SONSUZ REKLAM: A\u00c7IK',
    exit: '\u25C0 \u00c7IKI\u015e',
    shakeJoker: 'Sallama',
    bombJoker: 'Bomba',
    watchingAd: 'REKLAM \u0130ZLEN\u0130YOR\u2026',
    best: 'REKOR',
    score: 'SKOR',
    watchAdToRevive: 'CANLANMAK \u0130\u00c7\u0130N REKLAM \u0130ZLE',
    noThanks: 'Gerek yok',
    advertisement: 'REKLAM'
  },
  fr: {
    play: 'JOUER',
    removeAds: '\u2728 Supprimer les pubs',
    settings: 'PARAM\u00c8TRES',
    selectModule: '// CHOISIR UN MODULE //',
    menu: '\u25C0 MENU',
    settingsTitle: '// PARAM\u00c8TRES //',
    muteOff: 'MUET : NON',
    muteOn: 'MUET : OUI',
    music: 'MUSIQUE',
    sfx: 'BRUITAGES',
    language: 'LANGUE',
    infiniteAdMode: 'MODE PUB INFINIE',
    infiniteAdModeOff: 'PUB INFINIE : NON',
    infiniteAdModeOn: 'PUB INFINIE : OUI',
    exit: '\u25C0 QUITTER',
    shakeJoker: 'Secousse',
    bombJoker: 'Bombe',
    watchingAd: 'PUB EN COURS\u2026',
    best: 'MEILLEUR',
    score: 'SCORE',
    watchAdToRevive: 'REGARDER UNE PUB POUR REVIVRE',
    noThanks: 'Non merci',
    advertisement: 'PUBLICIT\u00c9'
  },
  de: {
    play: 'SPIELEN',
    removeAds: '\u2728 Werbung entfernen',
    settings: 'EINSTELLUNGEN',
    selectModule: '// MODUL W\u00c4HLEN //',
    menu: '\u25C0 MEN\u00dc',
    settingsTitle: '// EINSTELLUNGEN //',
    muteOff: 'STUMM: AUS',
    muteOn: 'STUMM: AN',
    music: 'MUSIK',
    sfx: 'EFFEKTE',
    language: 'SPRACHE',
    infiniteAdMode: 'ENDLOS-WERBEMODUS',
    infiniteAdModeOff: 'ENDLOS-WERBUNG: AUS',
    infiniteAdModeOn: 'ENDLOS-WERBUNG: AN',
    exit: '\u25C0 VERLASSEN',
    shakeJoker: 'Sch\u00fctteln',
    bombJoker: 'Bombe',
    watchingAd: 'WERBUNG L\u00c4UFT\u2026',
    best: 'BESTWERT',
    score: 'PUNKTE',
    watchAdToRevive: 'WERBUNG ANSEHEN ZUM WIEDERBELEBEN',
    noThanks: 'Nein danke',
    advertisement: 'WERBUNG'
  }
};
