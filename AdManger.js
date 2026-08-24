/**
 * core/AdManager.js
 * -----------------------------------------------------------------
 * Web ve Mobil (Capacitor) uyumlu Reklam Yöneticisi.
 * Web ortamında çökme yapmaz, APK ortamında gerçek AdMob reklamlarını çalıştırır.
 * -----------------------------------------------------------------
 */

class AdManager {
  constructor() {
    this.menuTransitionCount = 0;
    this.deathCount = 0;
    this.initialized = false;
    this.admob = null;

    // Reklam Kimlikleri (AdMob Test ID'leri)
    this.adUnits = {
      interstitial: 'ca-app-pub-3940256099942544/1033173712',
      rewarded: 'ca-app-pub-3940256099942544/5224354917'
    };

    this.init();
  }

  async init() {
    // Yalnızca Android / iOS (Native) ortamındaysa AdMob'u başlat
    if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform()) {
      try {
        const { AdMob } = await import('@capacitor-community/admob');
        this.admob = AdMob;
        await this.admob.initialize();
        console.log('[AdManager] AdMob başarıyla başlatıldı.');
        this.initialized = true;
      } catch (err) {
        console.warn('[AdManager] AdMob başlatılamadı:', err);
      }
    } else {
      console.log('[AdManager] Web/Önizleme modu aktif (Reklamlar simüle edilecek).');
    }
  }

  /**
   * Canlanma veya Joker İçin Ödüllü Reklam Göster
   */
  async showReviveAd(onSuccess, onFailure) {
    if (!this.initialized || !this.admob) {
      console.log('[AdManager] Web Modu: Reklam izlenmiş sayıldı.');
      if (onSuccess) onSuccess();
      return;
    }

    try {
      await this.admob.prepareRewardVideoAd({ adId: this.adUnits.rewarded });
      const result = await this.admob.showRewardVideoAd();
      
      if (result) {
        if (onSuccess) onSuccess();
      } else {
        if (onFailure) onFailure();
      }
    } catch (err) {
      console.error('[AdManager] Ödüllü reklam gösterilemedi:', err);
      // Reklam yüklenemezse oyuncuyu mağdur etmemek için canlandır
      if (onSuccess) onSuccess();
    }
  }

  /**
   * Her 2. Ölmeyle Yeniden Başlamada Geçiş Reklamı
   */
  handleDeathRestart(onComplete) {
    this.deathCount++;
    if (this.deathCount % 2 === 0) {
      this.showInterstitial(onComplete);
    } else {
      if (onComplete) onComplete();
    }
  }

  /**
   * Her 3. Menü Geçişinde Geçiş Reklamı
   */
  handleMenuTransition(onComplete) {
    this.menuTransitionCount++;
    if (this.menuTransitionCount % 3 === 0) {
      this.showInterstitial(onComplete);
    } else {
      if (onComplete) onComplete();
    }
  }

  /**
   * Geçiş Reklamı Gösterme Fonksiyonu
   */
  async showInterstitial(onComplete) {
    if (!this.initialized || !this.admob) {
      if (onComplete) onComplete();
      return;
    }

    try {
      await this.admob.prepareInterstitial({ adId: this.adUnits.interstitial });
      await this.admob.showInterstitial();
      if (onComplete) onComplete();
    } catch (err) {
      console.warn('[AdManager] Geçiş reklamı gösterilemedi:', err);
      if (onComplete) onComplete();
    }
  }
}

// GameManager ve diğer modüllerin rahatça import edebilmesi için varsayılan export
const adManager = new AdManager();
export default adManager;
