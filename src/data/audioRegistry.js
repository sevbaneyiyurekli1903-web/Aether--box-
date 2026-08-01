/**
 * audioRegistry.js
 * -----------------------------------------------------------------
 * There is now exactly one real audio FILE in the whole app: the
 * background track, which plays everywhere (main menu, every menu
 * screen, every game) instead of switching per game -- see
 * AudioManager.js.
 *
 * Every other sound (UI click, gameplay SFX, announcer stingers) is
 * now synthesized in code with the Web Audio API -- there is nothing
 * left to register here for those; their "recipes" live directly in
 * AudioManager.js next to the code that plays them. This was a
 * correctness fix, not just a preference: this project never actually
 * shipped real files for any of those, so every one of them was
 * silently 404-ing and playing nothing before this pass.
 * -----------------------------------------------------------------
 */
export const AUDIO_REGISTRY = {
  bgm: {
    bgm_mainMenu: 'assets/audio/bgm/cerulean_ascent.mp3' // real track, provided by user; plays app-wide
  }
};
