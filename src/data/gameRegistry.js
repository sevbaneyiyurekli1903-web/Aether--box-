/**
 * gameRegistry.js
 * -----------------------------------------------------------------
 * Single source of truth for the Game Select screen and for how each
 * game's code gets loaded. The intermediate menu is now a single
 * vertical column (stacked, not side-by-side), so array order = the
 * exact top-to-bottom order on screen:
 *
 *   1. Planet Merge
 *   2. Tetris
 *   3. Brick Quest
 *   4. Arrows
 *   5. Gravity Pulse
 *   6. Rider Neon
 *   7. Color Switch
 *   8. Gravity Flip
 *
 * `load` uses a dynamic import() so the initial page load only pays
 * for the menu -- a game's code (and its module-level state) doesn't
 * exist in memory until the player actually opens it.
 *
 * Every game now shares the same background music (see
 * AudioManager.js) rather than a per-game track, so entries no longer
 * carry a bgmKey -- there is only ever one BGM in the whole app.
 * -----------------------------------------------------------------
 */
export const GAME_REGISTRY = [
  {
    id: 'planetMerge',
    title: 'Planet Merge',
    cardArt: 'assets/images/card-planet-merge.png',
    load: () => import('../games/planet-merge/PlanetMergeGame.js')
  },
  {
    id: 'tetris',
    title: 'Tetris',
    cardArt: 'assets/images/card-tetris.png',
    load: () => import('../games/tetris/TetrisGame.js')
  },
  {
    id: 'brickQuest',
    title: 'Brick Quest',
    cardArt: 'assets/images/card-brick-quest.png',
    load: () => import('../games/brick-quest/BrickQuestGame.js')
  },
  {
    id: 'arrows',
    title: 'Arrows',
    cardArt: 'assets/images/card-arrows.png',
    load: () => import('../games/arrows/ArrowsGame.js')
  },
  {
    id: 'gravityPulse',
    title: 'Gravity Pulse',
    cardArt: 'assets/images/card-gravity-pulse.png',
    load: () => import('../games/gravity-pulse/GravityPulseGame.js')
  },
  {
    id: 'neonRider',
    title: 'Neon Rider',
    cardArt: 'assets/images/card-neon-rider.png',
    load: () => import('../games/neon-rider/NeonRiderGame.js')
  },
  {
    id: 'colorSwitch',
    title: 'Color Switch',
    cardArt: 'assets/images/card-color-switch.png',
    load: () => import('../games/color-switch/ColorSwitchGame.js')
  },
  {
    id: 'gravityFlip',
    title: 'Gravity Flip',
    cardArt: 'assets/images/card-gravity-flip.png',
    load: () => import('../games/gravity-flip/GravityFlipGame.js')
  }
];
