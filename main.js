import uiManager from './core/UIManager.js';
import LoadingScreen from './ui/screens/LoadingScreen.js'; // Klasör yolunuza göre kontrol edin
import bus from './core/EventBus.js';
import { EVENTS } from './core/Events.js';

import './core/GameManager.js';
import './core/AudioManager.js';

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('app-root');

  // 1. Arayüzü başlat
  uiManager.init(root);

  // 2. Yükleme ekranını başlat ve açılışta DOĞRUDAN 3 saniye göster
  LoadingScreen.init();
  LoadingScreen.show(5000);
});
