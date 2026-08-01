/**
 * canvasInput.js
 * -----------------------------------------------------------------
 * Small shared helpers so this logic (and its edge cases) exists in
 * exactly one place instead of being copy-pasted into every
 * canvas-based game.
 * -----------------------------------------------------------------
 */

/**
 * Standard 360x540-logical-resolution canvas, appended into the
 * dedicated #game-canvas-slot (which now fills the entire screen --
 * see #game-viewport in main.css) so every game still draws against
 * the exact same fixed 360x540 coordinate space it always has (no
 * game's internal math changes), while the actual on-screen box is
 * stretched with a "cover" fit -- scaled up until it fills the real
 * screen on BOTH axes, cropping whichever axis overflows instead of
 * letterboxing. That crop is what removes the dark bars that used to
 * show around the play area: there is no gap left for a wrapper
 * background to show through, on any device aspect ratio.
 *
 * Falls back to the passed root if the slot doesn't exist for some
 * reason, so this never silently does nothing.
 */
export function createGameCanvas(root, width = 360, height = 540) {
  const slot = document.getElementById('game-canvas-slot') || root;
  const wrapper = document.createElement('div');
  wrapper.className = 'game-canvas-wrapper';
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  wrapper.appendChild(canvas);
  slot.appendChild(wrapper);

  function applyCoverSize() {
    const rect = wrapper.getBoundingClientRect();
    const boxW = Math.max(1, rect.width);
    const boxH = Math.max(1, rect.height);
    const scale = Math.max(boxW / width, boxH / height);
    canvas.style.width = `${width * scale}px`;
    canvas.style.height = `${height * scale}px`;
  }

  applyCoverSize();
  // ResizeObserver (not window 'resize') so this also reacts to the
  // viewport changing for reasons other than a resize event -- browser
  // chrome show/hide, orientation change, keyboard opening, etc.
  const resizeObserver = new ResizeObserver(() => applyCoverSize());
  resizeObserver.observe(wrapper);

  return { wrapper, canvas, ctx: canvas.getContext('2d'), resizeObserver };
}

/**
 * Fills the canvas with a vertical gradient. Each game passes its own
 * distinct color stops so no two games share an identical background
 * (previously every game used the same flat '#04081c' fill).
 */
export function drawGradientBackground(ctx, width, height, stops) {
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  stops.forEach(([offset, color]) => grad.addColorStop(offset, color));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

/**
 * Unifies mouse + touch into onDown/onMove/onUp callbacks, each
 * receiving {x, y} already mapped into the canvas internal
 * resolution regardless of how it is CSS-scaled on screen.
 * Returns a detach() function -- call it from the game's destroy().
 */
export function attachPointerEvents(canvas, { onDown, onMove, onUp } = {}) {
  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if (e.touches && e.touches.length) {
      clientX = e.touches[0].clientX; clientY = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length) {
      clientX = e.changedTouches[0].clientX; clientY = e.changedTouches[0].clientY;
    } else {
      clientX = e.clientX; clientY = e.clientY;
    }
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  function handleDown(e) { e.preventDefault(); if (onDown) onDown(getPos(e)); }
  function handleMove(e) { e.preventDefault(); if (onMove) onMove(getPos(e)); }
  function handleUp(e) { e.preventDefault(); if (onUp) onUp(getPos(e)); }

  canvas.addEventListener('mousedown', handleDown);
  canvas.addEventListener('mousemove', handleMove);
  window.addEventListener('mouseup', handleUp);
  canvas.addEventListener('touchstart', handleDown, { passive: false });
  canvas.addEventListener('touchmove', handleMove, { passive: false });
  canvas.addEventListener('touchend', handleUp, { passive: false });
  canvas.addEventListener('touchcancel', handleUp, { passive: false });

  return function detach() {
    canvas.removeEventListener('mousedown', handleDown);
    canvas.removeEventListener('mousemove', handleMove);
    window.removeEventListener('mouseup', handleUp);
    canvas.removeEventListener('touchstart', handleDown);
    canvas.removeEventListener('touchmove', handleMove);
    canvas.removeEventListener('touchend', handleUp);
    canvas.removeEventListener('touchcancel', handleUp);
  };
}
