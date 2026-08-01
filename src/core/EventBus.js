/**
 * EventBus.js
 * -----------------------------------------------------------------
 * The decoupling backbone of the whole hub. GameManager, UIManager,
 * AudioManager, and every individual game never hold a direct
 * reference to one another — they only emit and listen for named
 * events here. This is what "highly modular, decoupled" means in
 * practice: you can delete AudioManager entirely and nothing else
 * breaks, it just goes silent.
 *
 * Built on the native EventTarget class (no dependency needed).
 * -----------------------------------------------------------------
 */

class EventBus extends EventTarget {
  /**
   * Fire a named event with an optional payload.
   * @param {string} eventName
   * @param {*} [detail]
   */
  emit(eventName, detail = null) {
    this.dispatchEvent(new CustomEvent(eventName, { detail }));
  }

  /**
   * Subscribe to a named event.
   * @param {string} eventName
   * @param {(detail:*) => void} handler
   * @returns {() => void} unsubscribe function
   */
  on(eventName, handler) {
    const wrapped = (e) => handler(e.detail);
    this.addEventListener(eventName, wrapped);
    return () => this.removeEventListener(eventName, wrapped);
  }

  /**
   * Subscribe to a named event for exactly one firing.
   */
  once(eventName, handler) {
    const wrapped = (e) => {
      handler(e.detail);
      this.removeEventListener(eventName, wrapped);
    };
    this.addEventListener(eventName, wrapped);
  }
}

// Singleton: ES modules are evaluated once per URL and cached, so every
// file that imports this gets the exact same instance for free — no
// classic getInstance() boilerplate needed.
export default new EventBus();
