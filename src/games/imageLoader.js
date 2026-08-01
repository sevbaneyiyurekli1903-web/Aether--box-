/**
 * imageLoader.js
 * -----------------------------------------------------------------
 * Shared remote-image preloader. Several games now draw real sprite
 * assets (Planet Merge's 11 moon images, Gravity Flip/Pulse/Neon
 * Rider's character art) instead of programmatically-drawn shapes —
 * this is the one place that logic lives instead of being
 * copy-pasted into every game file.
 *
 * Images are cached by URL at module scope, so switching games (or
 * restarting one via the revive/decline flow) never re-downloads an
 * asset it already has.
 * -----------------------------------------------------------------
 */
const cache = new Map();

/** Kick off loading; returns immediately, resolves in the background. */
function loadOne(url) {
  if (cache.has(url)) return cache.get(url);
  const entry = { image: new Image(), loaded: false };
  entry.image.onload = () => { entry.loaded = true; };
  entry.image.onerror = () => { entry.loaded = false; entry.failed = true; };
  entry.image.src = url;
  cache.set(url, entry);
  return entry;
}

/** Preload a list of URLs. Call this in init(); safe to call every time —
 *  already-cached URLs are instant no-ops. */
export function preload(urls) {
  urls.forEach(loadOne);
}

/**
 * Draw a cached image centered at (x, y) with the given diameter,
 * clipped to a circle. Returns false (drew nothing) if the image
 * hasn't finished loading yet or failed — callers should fall back to
 * a plain shape in that case so nothing is invisible while loading.
 */
export function drawCircularSprite(ctx, url, x, y, diameter) {
  const entry = cache.get(url) || loadOne(url);
  if (!entry.loaded) return false;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, diameter / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(entry.image, x - diameter / 2, y - diameter / 2, diameter, diameter);
  ctx.restore();
  return true;
}

/** Draw a cached image as a plain (unclipped) sprite, centered at (x, y),
 *  rotated by `rotation` radians. Returns false if not loaded yet. */
export function drawSprite(ctx, url, x, y, width, height, rotation = 0) {
  const entry = cache.get(url) || loadOne(url);
  if (!entry.loaded) return false;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.drawImage(entry.image, -width / 2, -height / 2, width, height);
  ctx.restore();
  return true;
}

export function isLoaded(url) {
  const entry = cache.get(url);
  return !!entry && entry.loaded;
}
