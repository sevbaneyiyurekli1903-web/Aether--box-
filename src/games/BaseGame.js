/**
 * BaseGame.js
 * -----------------------------------------------------------------
 * The contract every mini-game must implement. GameManager only ever
 * calls these methods on the active game — it never reaches into a
 * game's internals. Any class honoring this shape can be dropped into
 * the hub by adding one line to gameRegistry.js.
 *
 * Games report progress back out through the singleton GameManager
 * and through the shared EventBus for audio — they should never
 * import UIManager or AudioManager directly.
 *
 * On losing, a game calls `gameManager.playerLost()` — NOT
 * `gameManager.endGame()` directly. playerLost() triggers the
 * ad-revive overlay; only after the player's choice (or the 5s
 * timeout) does GameManager either call revive() or restart the game.
 * -----------------------------------------------------------------
 */
export class BaseGame {
  /** Called once when the game is loaded. Set up state, canvas, listeners. */
  init() {}

  /** Called every frame. dt is normalized so dt === 1 at a steady 60fps. */
  update(dt) {}

  /**
   * Called every frame after update(). Optional — a game that manages
   * its own DOM/canvas internally can leave this empty and draw
   * inside update() or its own rAF.
   */
  render(ctx) {}

  /**
   * Called after the player accepts "Watch Ad to Revive". Put the
   * player back into a safe, playable state — e.g. clear the obstacle
   * that killed them, grant a moment of invincibility, respawn at a
   * safe spot. Default: no-op, meaning the run simply un-pauses
   * exactly where it was (fine for games where "losing" doesn't leave
   * the player embedded in the hazard, e.g. Tetris' topped-out grid
   * can just have its top rows cleared here).
   */
  revive() {}

  /**
   * Called when one of this game's own ad-gated joker buttons was
   * tapped and the simulated ad finished. jokerId identifies which
   * one, for games with more than one. Default: no-op -- most games
   * have no joker at all now; Planet Merge is currently the only one
   * that implements this (jokerId: 'shake' | 'bomb').
   */
  useJoker(jokerId) {}

  /** Called on teardown (back button, loading a different game). Remove
   *  all listeners/timers here or they'll leak across game switches. */
  destroy() {}
}
