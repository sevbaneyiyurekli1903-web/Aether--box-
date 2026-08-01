import uiManager from './core/UIManager.js';
// GameManager and AudioManager are imported purely for their
// side-effect: as ES module singletons, their constructors (which
// subscribe to the EventBus) only run once something imports them.
// Nothing in this file calls them directly — that's the point.
import './core/GameManager.js';
import './core/AudioManager.js';

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('app-root');
  uiManager.init(root);
});
