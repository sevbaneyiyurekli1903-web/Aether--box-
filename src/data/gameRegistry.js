/**
 * gameRegistry.js
 * -----------------------------------------------------------------
 * Single source of truth for the Game Select screen.
 * Order: Arrows, Planet Merge, Tetris, Color Switch, Brick Quest,
 *        Gravity Flip, Gravity Pulse, Neon Rider
 * -----------------------------------------------------------------
 */
export const GAME_REGISTRY = [
  {
    id: 'arrows',
    title: 'Arrows',
    cardArt: 'assets/images/card-arrows.png',
    load: () => import('../games/arrows/ArrowsGame.js')
  },
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
    id: 'colorSwitch',
    title: 'Color Switch',
    cardArt: 'assets/images/card-color-switch.png',
    load: () => import('../games/color-switch/ColorSwitchGame.js')
  },
  {
    id: 'brickQuest',
    title: 'Brick Quest',
    cardArt: 'assets/images/card-brick-quest.png',
    load: () => import('../games/brick-quest/BrickQuestGame.js')
  },
  {
    id: 'gravityFlip',
    title: 'Gravity Flip',
    cardArt: 'assets/images/card-gravity-flip.png',
    load: () => import('../games/gravity-flip/GravityFlipGame.js')
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
  }
];
