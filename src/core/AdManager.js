import bus from './EventBus.js';
import { EVENTS } from './Events.js';

/**
 * AdManager.js
 * -----------------------------------------------------------------
 * AdMob reklam tetikleyicileri:
 * 1. Canlanma (Revive): Ödüllü reklam
 * 2. Ölüm sonrası restart: "Hayır" 2x basınca geçiş reklamı
 * 3. Menü geçişleri: 3x geçişte geçiş reklamı
 * -----------------------------------------------------------------
 */

class AdManager {
  constructor() {
    // Menü geçiş sayacı (3'e ulaşınca reklam)
    this._menuTransitionCount = 0;
    // Ölüm sonrası "Hayır" basış sayacı (2'ye ulaşınca reklam)
    this._declineTapCount = 0;
  }

  /** Menü geçişinde sayaç artır, 3 olunca reklam göster */
  handleMenuTransition(callback) {
    this._menuTransitionCount++;
    console.log(`[AdManager] Menü geçiş sayacı: ${this._menuTransitionCount}/3`);

    if (this._menuTransitionCount >= 3) {
      this._menuTransitionCount = 0;
      this._showInterstitialAd(() => {
        if (callback) callback();
      });
    } else {
      if (callback) callback();
    }
  }

  /** Canlanma reklamı (Ödüllü Reklam) */
  showReviveAd(onSuccess, onFailure) {
    console.log('[AdManager] AdMob Ödüllü Reklam gösteriliyor (Canlanma)...');
    // AdMob SDK entegrasyon noktası
    // window.admob.rewarded.show({...})

    // Simülasyon (gerçek AdMob SDK ile değiştirilecek)
    setTimeout(() => {
      const success = true; // Kullanıcı reklamı izledi
      if (success) {
        console.log('[AdManager] Ödüllü reklam tamamlandı ✅');
        if (onSuccess) onSuccess();
      } else {
        console.log('[AdManager] Ödüllü reklam atlandı ❌');
        if (onFailure) onFailure();
      }
    }, 1500);
  }

  /** Ölüm sonrası "Hayır" basış sayacı (2x = Geçiş Reklamı) */
  handleDeathRestart(callback) {
    this._declineTapCount++;
    console.log(`[AdManager] "Hayır" basış sayacı: ${this._declineTapCount}/2`);

    if (this._declineTapCount >= 2) {
      this._declineTapCount = 0;
      this._showInterstitialAd(() => {
        if (callback) callback();
      });
    } else {
      if (callback) callback();
    }
  }

  /** Geçiş Reklamı (Interstitial) */
  _showInterstitialAd(callback) {
    console.log('[AdManager] AdMob Geçiş Reklamı gösteriliyor...');
    // AdMob SDK entegrasyon noktası
    // window.admob.interstitial.show({...})

    // Simülasyon
    setTimeout(() => {
      console.log('[AdManager] Geçiş reklamı tamamlandı');
      bus.emit(EVENTS.AD_INTERSTITIAL_SHOWN);
      if (callback) callback();
    }, 2000);
  }

  /** Sayaçları sıfırla */
  resetCounters() {
    this._menuTransitionCount = 0;
    this._declineTapCount = 0;
    console.log('[AdManager] Sayaçlar sıfırlandı');
  }
}

const adManager = new AdManager();
export default adManager;
