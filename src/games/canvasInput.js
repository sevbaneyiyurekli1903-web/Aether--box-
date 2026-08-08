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
  const resizeObserver = new ResizeObserver(() => applyCoverSize());
  resizeObserver.observe(wrapper);

  return { wrapper, canvas, ctx: canvas.getContext('2d'), resizeObserver };
}

export function drawGradientBackground(ctx, width, height, stops) {
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  stops.forEach(([offset, color]) => grad.addColorStop(offset, color));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

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
