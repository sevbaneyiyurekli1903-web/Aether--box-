export default class LoadingScreen {
  static _instance = null;

  constructor(container) {
    this.container = container || document.getElementById('app-root') || document.body;
    this.element = null;
    this._autoHideTimeout = null;
    this._injectStyles();
  }

  static getInstance(container) {
    if (!LoadingScreen._instance) {
      LoadingScreen._instance = new LoadingScreen(container);
    }
    return LoadingScreen._instance;
  }

  // --- STATİK METODLAR ---
  static init(container) {
    return LoadingScreen.getInstance(container).init();
  }

  static show(status) {
    return LoadingScreen.getInstance().show(status);
  }

  static hide() {
    return LoadingScreen.getInstance().hide();
  }

  static setProgress(percent, statusMsg) {
    return LoadingScreen.getInstance().setProgress(percent, statusMsg);
  }

  static render(container) {
    return LoadingScreen.getInstance(container).render();
  }

  static destroy() {
    if (LoadingScreen._instance) {
      LoadingScreen._instance.destroy();
      LoadingScreen._instance = null;
    }
  }

  // --- ÖRNEK (INSTANCE) METODLARI ---
  init() {
    if (!this.element) {
      this.render();
    }
    const target = document.getElementById('app-root') || this.container || document.body;
    if (this.element && !this.element.parentNode && target) {
      target.appendChild(this.element);
    }
    return this;
  }

  _injectStyles() {
    if (document.getElementById('loading-screen-styles')) return;

    const style = document.createElement('style');
    style.id = 'loading-screen-styles';
    style.textContent = `
      .loading-screen-wrapper {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background-color: #000000;
        z-index: 999999;
        opacity: 1;
        transition: opacity 0.4s ease, visibility 0.4s ease;
        overflow: hidden;
        pointer-events: auto;
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;

        /* >>> 1. EKRAN KENAR BOŞLUĞU (İçeri itme) <<< */
        padding: 0px; /* Büyütmek için 0px tut, küçültmek istersen 10px, 20px yap */
      }

      .loading-screen-wrapper.hidden {
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
        display: none !important;
      }

      /* ========================================================= */
      /* >>> MANUEL BOYUT AYARLARINI BURADAN DEĞİŞTİREBİLİRSİN <<< */
      /* ========================================================= */
      .ls-bg-image {
        /* Büyüklük Limitleri (%100 ekran için 100vw ve 100vh) */
        max-width: 95vw;   /* %95 genişlik (İstersen 100vw yapabilirsin) */
        max-height: 95vh;  /* %95 yükseklik (İstersen 100vh yapabilirsin) */
        
        width: auto;
        height: auto;
        display: block;
        margin: auto;

        /* >>> 2. ÖLÇEKLEME / ZOOM (En Pratik Büyütme-Küçültme) <<< */
        /* 1.0 = Normal | 1.1 = %10 Büyük | 1.25 = %25 Büyük | 0.8 = %20 Küçük */
        transform: scale(1.0); 

        /* >>> 3. DOLDURMA MODU <<< */
        /* 'contain' = Taşmadan sığdırır | 'cover' = Ekranı tamamen kaplar | 'fill' = Esneterek kaplar */
        object-fit: contain; 
        
        border-radius: 12px;
      }
    `;
    document.head.appendChild(style);
  }

  render() {
    if (this.element) return this.element;

    const wrapper = document.createElement('div');
    wrapper.className = 'loading-screen-wrapper';
    wrapper.innerHTML = `
      <img class="ls-bg-image" id="ls-bg-img" src="Loading-bg.png" alt="Loading Background" />
    `;

    this.element = wrapper;

    // Tıklayarak güvenli kapatma
    const forceClose = () => this.hide();
    wrapper.addEventListener('click', forceClose);
    wrapper.addEventListener('touchstart', forceClose, { passive: true });

    // Görsel Yolunu Otomatik Bulucu
    const bgImg = wrapper.querySelector('#ls-bg-img');
    if (bgImg) {
      const paths = [
        'Loading-bg.png',
        './Loading-bg.png',
        'assets/Loading-bg.png',
        './assets/Loading-bg.png',
        'assets/images/Loading-bg.png',
        './assets/images/Loading-bg.png',
        'ui/screens/Loading-bg.png'
      ];
      let pathIdx = 0;

      bgImg.onerror = () => {
        pathIdx++;
        if (pathIdx < paths.length) {
          bgImg.src = paths[pathIdx];
        }
      };
    }

    return this.element;
  }

  show() {
    this.init();
    if (this.element) {
      this.element.style.display = 'flex';
      this.element.classList.remove('hidden');
    }

    if (this._autoHideTimeout) clearTimeout(this._autoHideTimeout);
    this._autoHideTimeout = setTimeout(() => {
      this.hide();
    }, 4500);

    return this;
  }

  setProgress(percent) {
    if (typeof percent === 'number' && percent >= 100) {
      this.hide();
    }
    return this;
  }

  hide() {
    if (this._autoHideTimeout) {
      clearTimeout(this._autoHideTimeout);
      this._autoHideTimeout = null;
    }

    if (this.element) {
      this.element.classList.add('hidden');
      setTimeout(() => {
        if (this.element) {
          this.element.style.display = 'none';
        }
      }, 400);
    }
    return this;
  }

  destroy() {
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
  }
}
