/**
 * EventBus.js
 * -----------------------------------------------------------------
 * Oyun içi tüm modüllerin (GameManager, UIManager, LoadingScreen, vb.)
 * birbirine bağımlı olmadan haberleşmesini sağlayan merkezi olay veri yolu.
 * -----------------------------------------------------------------
 */

class EventBus extends EventTarget {
  /**
   * Dinleyicilerin (wrapper) referanslarını saklamak için harita.
   * `off` fonksiyonu çağrıldığında orijinal handler ile silinebilmesi için kullanılır.
   * @private
   */
  #listeners = new Map();

  /**
   * Belirtilen isimdeki olayı tetikler ve veriyi (payload) iletir.
   * @param {string} eventName - Tetiklenecek olayın adı
   * @param {*} [detail] - Olayla birlikte gönderilecek veri
   */
  emit(eventName, detail = null) {
    this.dispatchEvent(new CustomEvent(eventName, { detail }));
  }

  /**
   * Belirtilen olayı dinlemeye başlar.
   * @param {string} eventName - Dinlenecek olayın adı
   * @param {(detail:*) => void} handler - Olay tetiklendiğinde çalışacak fonksiyon
   * @returns {() => void} Aboneliği iptal etmek için çağrılabilecek fonksiyon
   */
  on(eventName, handler) {
    const wrapped = (e) => handler(e.detail);
    
    // Orijinal handler ile wrapped ilişkisini kaydet
    if (!this.#listeners.has(handler)) {
      this.#listeners.set(handler, wrapped);
    }

    this.addEventListener(eventName, wrapped);

    // Unsubscribe (abonelikten çıkma) fonksiyonu döner
    return () => this.off(eventName, handler);
  }

  /**
   * Kayıtlı bir olay dinleyicisini kaldırır.
   * @param {string} eventName - Olay adı
   * @param {(detail:*) => void} handler - Kaldırılacak fonksiyon
   */
  off(eventName, handler) {
    const wrapped = this.#listeners.get(handler);
    if (wrapped) {
      this.removeEventListener(eventName, wrapped);
      this.#listeners.delete(handler);
    } else {
      this.removeEventListener(eventName, handler);
    }
  }

  /**
   * Belirtilen olayı yalnızca İLK tetiklenmede bir kez dinler ve ardından otomatik silinir.
   * @param {string} eventName - Olay adı
   * @param {(detail:*) => void} handler - Bir kez çalışacak fonksiyon
   */
  once(eventName, handler) {
    const wrapped = (e) => {
      handler(e.detail);
      this.off(eventName, handler);
    };
    
    this.#listeners.set(handler, wrapped);
    this.addEventListener(eventName, wrapped);
  }
}

// Singleton: Proje genelinde tek bir EventBus örneği kullanılır.
export default new EventBus();
