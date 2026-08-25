import uiManager from './core/UIManager.js';
import { LoadingScreen } from './ui/screens/LoadingScreen.js';
import bus from './core/EventBus.js';
import { EVENTS } from './core/Events.js';
import gameManager from './core/GameManager.js';
import './core/AudioManager.js';

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('app-root');

  // 1. Yükleme ekranını oluştur
  const loadingScreen = new LoadingScreen();
  const loadingEl = loadingScreen.render();
  root.appendChild(loadingEl);

  // 2. Yükleme ekranını göster (5 saniye)
  loadingScreen.show(() => {
    // 5 saniye sonra ana menüyü göster
    loadingScreen.hide();
    uiManager.init(root);
    gameManager.showMainMenu();
  });
});
