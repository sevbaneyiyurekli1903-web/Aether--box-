import bus from './EventBus.js';
import { EVENTS } from './Events.js';
import { AUDIO_REGISTRY } from '../data/audioRegistry.js';

/**
 * AudioManager.js
 * -----------------------------------------------------------------
 * The only module in the whole hub that touches audio.
 *
 * Two completely different mechanisms live here on purpose:
 *
 *   1. BACKGROUND MUSIC -- a single real <audio> element, playing the
 *      one real track this project ships (cerulean_ascent.mp3). It
 *      starts once and is never swapped, paused (other than for the
 *      interstitial overlay), or restarted when navigating between
 *      the menu and any game -- the same music now plays everywhere
 *      in the app, per spec, instead of stopping/changing per screen.
 *
 *   2. EVERYTHING ELSE (UI click, gameplay SFX, announcer stingers) --
 *      synthesized on the fly with the Web Audio API. This project
 *      never shipped real files for any of these (only placeholder
 *      paths that all 404'd), so they were completely silent before
 *      this pass. Rather than source dozens of licensed sound files,
 *      every one of these is now a tiny procedural "recipe" (a few
 *      oscillator/noise-burst layers with a volume envelope) defined
 *      in SFX_RECIPES / ANNOUNCER_RECIPES below. This is a real fix,
 *      not a placeholder: every sound in the game now actually plays,
 *      requires no network fetch, and can't 404.
 *
 * Every other file still just emits events on the bus (EVENTS.SFX_PLAY,
 * EVENTS.ANNOUNCER_TRIGGER, EVENTS.UI_CLICK, ...) and has no idea any
 * of this happens here.
 * -----------------------------------------------------------------
 */

// A few named pitches, reused across recipes below (standard
// equal-tempered frequencies in Hz).
const N = {
  G4: 392.00,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.00, B5: 987.77,
  C6: 1046.50, D6: 1174.66, E6: 1318.51
};

// Each key -> a list of "layers" scheduled relative to the moment the
// sound is triggered. type:'tone' is an oscillator with an amplitude
// envelope (and an optional frequency sweep); type:'noise' is a short
// burst of filtered white noise (used for crashes, whooshes, impacts --
// anything more percussive than a pitched tone).
const SFX_RECIPES = {
  click:         [{ type: 'tone', wave: 'sine', freq: 720, dur: 0.035, gain: 0.16 }],
  jump:          [{ type: 'tone', wave: 'sine', freq: 320, freqEnd: 640, dur: 0.12, gain: 0.22 }],
  merge:         [
                   { type: 'tone', wave: 'triangle', freq: 440, dur: 0.14, gain: 0.22 },
                   { type: 'tone', wave: 'triangle', freq: 660, dur: 0.16, gain: 0.20, at: 0.05 }
                 ],
  blockRotate:   [{ type: 'tone', wave: 'square', freq: 300, dur: 0.03, gain: 0.12 }],
  blockLock:     [
                   { type: 'tone', wave: 'sine', freq: 140, dur: 0.09, gain: 0.30 },
                   { type: 'noise', dur: 0.03, gain: 0.08, filterFreq: 400 }
                 ],
  blockClear:    [
                   { type: 'tone', wave: 'triangle', freq: N.C5, dur: 0.10, gain: 0.22 },
                   { type: 'tone', wave: 'triangle', freq: N.E5, dur: 0.10, gain: 0.22, at: 0.07 },
                   { type: 'tone', wave: 'triangle', freq: N.G5, dur: 0.14, gain: 0.24, at: 0.14 }
                 ],
  gravityFlip:   [{ type: 'tone', wave: 'sine', freq: 260, freqEnd: 820, dur: 0.15, gain: 0.22 }],
  score:         [{ type: 'tone', wave: 'sine', freq: 950, dur: 0.045, gain: 0.14 }],
  crash:         [
                   { type: 'noise', dur: 0.32, gain: 0.34, filterFreq: 1800, filterFreqEnd: 180 },
                   { type: 'tone', wave: 'square', freq: 80, dur: 0.22, gain: 0.20 }
                 ],
  flip:          [{ type: 'tone', wave: 'sine', freq: 340, freqEnd: 1000, dur: 0.10, gain: 0.18 }],
  landPerfect:   [
                   { type: 'tone', wave: 'triangle', freq: N.G5, dur: 0.12, gain: 0.22 },
                   { type: 'tone', wave: 'triangle', freq: N.B5, dur: 0.16, gain: 0.22, at: 0.06 }
                 ],
  arrowSlide:    [
                   { type: 'noise', dur: 0.08, gain: 0.10, filterFreq: 2200 },
                   { type: 'tone', wave: 'sine', freq: 500, freqEnd: 900, dur: 0.08, gain: 0.14 }
                 ],
  arrowBlocked:  [{ type: 'tone', wave: 'square', freq: 120, dur: 0.16, gain: 0.20 }],
  levelClear:    [
                   { type: 'tone', wave: 'triangle', freq: N.C5, dur: 0.09, gain: 0.20 },
                   { type: 'tone', wave: 'triangle', freq: N.E5, dur: 0.09, gain: 0.20, at: 0.07 },
                   { type: 'tone', wave: 'triangle', freq: N.G5, dur: 0.09, gain: 0.22, at: 0.14 },
                   { type: 'tone', wave: 'triangle', freq: N.C6, dur: 0.18, gain: 0.24, at: 0.21 }
                 ],
  reviveOffered: [
                   { type: 'tone', wave: 'square', freq: 600, dur: 0.09, gain: 0.16 },
                   { type: 'tone', wave: 'square', freq: 800, dur: 0.09, gain: 0.16, at: 0.13 }
                 ],
  reviveSuccess: [
                   { type: 'tone', wave: 'triangle', freq: N.C5, dur: 0.09, gain: 0.20 },
                   { type: 'tone', wave: 'triangle', freq: N.E5, dur: 0.09, gain: 0.20, at: 0.08 },
                   { type: 'tone', wave: 'triangle', freq: N.G5, dur: 0.16, gain: 0.22, at: 0.16 }
                 ],
  jokerUsed:     [
                   { type: 'tone', wave: 'square', freq: 500, dur: 0.05, gain: 0.14 },
                   { type: 'tone', wave: 'square', freq: 700, dur: 0.06, gain: 0.14, at: 0.06 }
                 ],
  // Planet Merge's two jokers only.
  bombExplode:   [
                   { type: 'noise', dur: 0.38, gain: 0.36, filterFreq: 2600, filterFreqEnd: 100 },
                   { type: 'tone', wave: 'sine', freq: 70, dur: 0.34, gain: 0.28 }
                 ],
  screenShake:   [{ type: 'noise', dur: 0.26, gain: 0.20, filterFreq: 350, filterFreqEnd: 150 }]
};

const ANNOUNCER_RECIPES = {
  nice:       [
                { type: 'tone', wave: 'triangle', freq: N.E5, dur: 0.10, gain: 0.22 },
                { type: 'tone', wave: 'triangle', freq: N.G5, dur: 0.14, gain: 0.22, at: 0.09 }
              ],
  amazing:    [
                { type: 'tone', wave: 'triangle', freq: N.C5, dur: 0.09, gain: 0.20 },
                { type: 'tone', wave: 'triangle', freq: N.E5, dur: 0.09, gain: 0.22, at: 0.08 },
                { type: 'tone', wave: 'triangle', freq: N.A5, dur: 0.16, gain: 0.24, at: 0.16 }
              ],
  incredible: [
                { type: 'tone', wave: 'triangle', freq: N.C5, dur: 0.08, gain: 0.20 },
                { type: 'tone', wave: 'triangle', freq: N.E5, dur: 0.08, gain: 0.20, at: 0.07 },
                { type: 'tone', wave: 'triangle', freq: N.G5, dur: 0.08, gain: 0.22, at: 0.14 },
                { type: 'tone', wave: 'triangle', freq: N.C6, dur: 0.22, gain: 0.26, at: 0.21 },
                { type: 'tone', wave: 'triangle', freq: N.E6, dur: 0.22, gain: 0.20, at: 0.21 }
              ],
  // Fired on a successful multi-flip landing (see NeonRiderGame) -- an
  // upbeat ascending run, not a "failure" sound despite the key name
  // (kept as-is; it's the existing event contract from GameManager).
  comboBreak: [
                { type: 'tone', wave: 'triangle', freq: N.G4, dur: 0.06, gain: 0.18 },
                { type: 'tone', wave: 'triangle', freq: N.C5, dur: 0.06, gain: 0.19, at: 0.05 },
                { type: 'tone', wave: 'triangle', freq: N.E5, dur: 0.06, gain: 0.20, at: 0.10 },
                { type: 'tone', wave: 'triangle', freq: N.G5, dur: 0.06, gain: 0.21, at: 0.15 },
                { type: 'tone', wave: 'triangle', freq: N.C6, dur: 0.16, gain: 0.26, at: 0.20 }
              ]
};

class AudioManager {
  constructor() {
    this.bgmElement = new Audio();
    this.bgmElement.loop = true;

    this.sfxVolume = 1;
    this.bgmVolume = 0.6;
    this.muted = false;

    // Lazily created on first use -- browsers require a user gesture
    // before an AudioContext is allowed to produce sound, so building
    // it eagerly at construction time would just start out suspended.
    this._ctx = null;
    this._sfxGain = null;

    bus.on(EVENTS.UI_CLICK, () => this.playUIClick());
    bus.on(EVENTS.SFX_PLAY, (key) => this.playSFX(key));
    bus.on(EVENTS.ANNOUNCER_TRIGGER, (payload) => this._handleAnnouncerTrigger(payload));

    // Music is app-wide now: it starts once below and this listener
    // deliberately does NOT switch tracks on GAME_STARTED/GAME_EXITED
    // -- the whole point is that navigating into or out of a game no
    // longer touches the music at all.
    bus.on(EVENTS.SETTINGS_CHANGED, (settings) => this._applySettings(settings));

    // Revive flow / joker feedback — small, obvious sound cues so the
    // player always knows their tap registered before the fake ad delay.
    bus.on(EVENTS.REVIVE_OFFERED, () => this.playSFX('reviveOffered'));
    bus.on(EVENTS.INTERSTITIAL_SHOW, () => this.bgmElement.pause());
    bus.on(EVENTS.INTERSTITIAL_HIDE, () => { if (!this.muted) this.bgmElement.play().catch(() => {}); });
    bus.on(EVENTS.GAME_RESUMED, () => this.playSFX('reviveSuccess'));
    bus.on(EVENTS.AD_JOKER_REQUESTED, () => this.playSFX('jokerUsed'));

    // Browsers block audio.play() before any user gesture, so this
    // first attempt at boot will likely be silently rejected (caught
    // below) — the retry-on-click fallback in playUIClick() covers that.
    this.playBGM('bgm_mainMenu');
  }

  // 1. UI Interaction ------------------------------------------------
  playUIClick() {
    this._playRecipe(SFX_RECIPES.click);
    // A click is a genuine user gesture — if BGM (or the AudioContext
    // used for every synthesized sound) got blocked by the browser's
    // autoplay policy at boot, this is what unblocks both.
    if (this.bgmElement.paused && this.bgmElement.src && !this.muted) {
      this.bgmElement.play().catch(() => {});
    }
  }

  // 2. Background Music (the one real audio file, plays everywhere) --
  playBGM(key) {
    const src = AUDIO_REGISTRY.bgm[key];
    if (!src) { console.warn(`AudioManager: unknown BGM key "${key}"`); return; }
    if (this.bgmElement.src.endsWith(src)) return; // already the current track

    this.bgmElement.src = src;
    this.bgmElement.volume = this.muted ? 0 : this.bgmVolume;
    this.bgmElement.currentTime = 0;

    // Autoplay can be blocked until a user gesture. Any menu button the
    // player has already tapped to get here satisfies that requirement,
    // but we still swallow the rejection defensively.
    this.bgmElement.play().catch(() => {});
  }

  stopBGM() {
    this.bgmElement.pause();
  }

  // 3. In-Game SFX (code-synthesized) ---------------------------------
  playSFX(key) {
    const recipe = SFX_RECIPES[key];
    if (!recipe) { console.warn(`AudioManager: unknown SFX key "${key}"`); return; }
    this._playRecipe(recipe);
  }

  // 4. Announcer / Reward Audio (code-synthesized) ---------------------
  _handleAnnouncerTrigger({ type, value } = {}) {
    let key = null;
    if (type === 'score') {
      if (value >= 5000) key = 'incredible';
      else if (value >= 1000) key = 'amazing';
      else if (value >= 100) key = 'nice';
    } else if (type === 'combo') {
      key = 'comboBreak';
    }
    const recipe = key && ANNOUNCER_RECIPES[key];
    if (recipe) this._playRecipe(recipe);
  }

  // -----------------------------------------------------------------
  // Web Audio synthesis engine
  // -----------------------------------------------------------------

  _ensureContext() {
    if (!this._ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null; // ancient/unsupported browser -- fail silent, never throw
      this._ctx = new Ctx();
      this._sfxGain = this._ctx.createGain();
      this._sfxGain.gain.value = this.muted ? 0 : this.sfxVolume;
      this._sfxGain.connect(this._ctx.destination);
    }
    if (this._ctx.state === 'suspended') this._ctx.resume().catch(() => {});
    return this._ctx;
  }

  /** Schedules every layer of a recipe relative to "now". Layers within
   *  one recipe can overlap/stagger via their own `at` offset, so a
   *  single SFX key can be a tiny chime made of several notes. */
  _playRecipe(layers) {
    if (this.muted) return;
    const ctx = this._ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    for (const layer of layers) {
      if (layer.type === 'noise') this._scheduleNoise(ctx, now, layer);
      else this._scheduleTone(ctx, now, layer);
    }
  }

  _scheduleTone(ctx, now, { wave = 'sine', freq, freqEnd = null, dur = 0.12, gain = 0.2, at = 0 }) {
    const t0 = now + at;
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    // Fast attack, then an exponential decay down to the note's tail --
    // this is what makes every layer sound like a percussive "hit"
    // rather than a synth pad droning on.
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t0 + Math.min(0.012, dur * 0.25));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(g).connect(this._sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  _scheduleNoise(ctx, now, { dur = 0.2, gain = 0.2, filterFreq = 1200, filterFreqEnd = null, at = 0 }) {
    const t0 = now + at;
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize); // linear fade-out white noise
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, t0);
    if (filterFreqEnd !== null) filter.frequency.exponentialRampToValueAtTime(Math.max(40, filterFreqEnd), t0 + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.max(0.0001, gain), t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(filter).connect(g).connect(this._sfxGain);
    src.start(t0);
  }

  _applySettings({ muted, sfxVolume, bgmVolume } = {}) {
    if (typeof muted === 'boolean') {
      this.muted = muted;
      this.bgmElement.volume = muted ? 0 : this.bgmVolume;
      if (this._sfxGain) this._sfxGain.gain.value = muted ? 0 : this.sfxVolume;
    }
    if (typeof sfxVolume === 'number') {
      this.sfxVolume = sfxVolume;
      if (this._sfxGain && !this.muted) this._sfxGain.gain.value = sfxVolume;
    }
    if (typeof bgmVolume === 'number') {
      this.bgmVolume = bgmVolume;
      if (!this.muted) this.bgmElement.volume = bgmVolume;
    }
  }
}

export default new AudioManager();
