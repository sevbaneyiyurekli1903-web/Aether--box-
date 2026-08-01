# Aether Hub — fix pass (July 2026)

Builds on the previous refactor pass (still true: i18n, the shared
scoreboard, decoupled EventBus architecture). This pass works through
a fresh list of issues: real character art, two silently-broken audio
systems, a game-viewport restructure to kill the black borders around
gameplay, a joker system that was universal and is now Planet-Merge-only
(with two new mechanics), a reordered menu, and a full rebuild of
Arrows to match the actual mobile-game genre it's named after.

## 1. Character & obstacle art

All five sprite sets were swapped to the new provided assets — nothing
else about how they're drawn changed (still hotlinked URLs, same
`imageLoader.js` cache/preload, same `drawSprite`/`drawCircularSprite`
calls):

| Game | Constant | File |
|---|---|---|
| Rider Neon | `PLAYER_SPRITE` | `NeonRiderGame.js` |
| Gravity Flip | `PLAYER_SPRITE` / `OBSTACLE_SPRITE` | `GravityFlipGame.js` |
| Gravity Pulse | `PLAYER_SPRITE` | `GravityPulseGame.js` |
| Planet Merge | `MOON_IMAGES[0..10]` (level 1 → 11) | `PlanetMergeGame.js` |

The Game Select screen's Planet Merge card art was also swapped to the
new image supplied for that slot.

## 2. Audio — both systems were actually broken, not just "off-brand"

**Music now plays everywhere, not just the main menu.** The old code
tried to switch to a per-game BGM track on `GAME_STARTED`. Every one of
those per-game tracks was a path to a file that was never shipped (see
old `audioRegistry.js`), so entering *any* game replaced the working
`<audio>` element's `src` with a 404, silently killing the music
instead of switching it. Fix: `AudioManager` no longer switches tracks
on game start/exit at all — the one real track
(`assets/audio/bgm/cerulean_ascent.mp3`) starts once and just keeps
looping across every screen and every game. `gameRegistry.js` entries
no longer carry a `bgmKey`.

**Every other sound (UI click, gameplay SFX, announcer stingers) is
now synthesized in code**, per spec ("oyun içindeki bütün seslerin
kodlarla halledilmesi"). This is a real fix, not just a style choice —
none of these ever had real files either (only placeholder paths that
all 404'd), so they were completely silent before. `AudioManager.js`
now has a small Web Audio API synth engine (`_scheduleTone` /
`_scheduleNoise`) and a declarative recipe table (`SFX_RECIPES`,
`ANNOUNCER_RECIPES`) — each key is a few oscillator/noise layers with a
volume envelope, e.g.:

```javascript
merge: [
  { type: 'tone', wave: 'triangle', freq: 440, dur: 0.14, gain: 0.22 },
  { type: 'tone', wave: 'triangle', freq: 660, dur: 0.16, gain: 0.20, at: 0.05 }
]
```

No network fetch, nothing that can 404, and the existing Settings
volume sliders (`sfxVolume`/`bgmVolume`/mute) still work — they now
drive a shared `GainNode` instead of `<audio>.volume`.
`audioRegistry.js` is now just the one real BGM path; there's nothing
left to register for SFX/UI/announcer since their recipes live next to
the code that plays them.

## 3. Game viewport: fullscreen, no letterboxing, EXIT top-left

Three related asks, one restructure:

- *"Bütün oyunlardaki arka plan renkleri koyulaşsın ve ekranın
  tamamını kaplasın"* — darker backgrounds, covering the whole screen.
- *"Oyun oynanan yerin kenarındaki siyahlıklar kaldırılsın"* — remove
  the dark borders around the play area.
- *"Çıkış tuşları ekranın sol üst köşesine konulsun"* — EXIT to the
  top-left corner of the screen.

Previously `#game-viewport` was a small centered box (`85vw x 127.5vw,
capped 360×540`) with EXIT/JOKER/BEST/SCORE living in their own
reserved top/bottom flex bands *outside* the canvas. Splitting height
between those bands and the canvas slot meant the canvas (still fixed
at a 2:3 ratio) usually didn't exactly fill its remaining space, so it
letterboxed — showing the wrapper's own flat color on one axis. That
flat color is the "siyahlık" (blackness) that was reported.

Fix, root cause not a patch:

- `#game-viewport` is now `position: fixed; inset: 0` — the actual
  screen, no centered box, no reserved HUD bands.
- `createGameCanvas` (`canvasInput.js`) keeps every game's *internal*
  resolution at the same fixed 360×540 it's always been (no game's
  drawing math changed), but now sizes the canvas element with a
  **cover** fit instead of *contain* — scaled up via a `ResizeObserver`
  until it fills the real screen on *both* axes, centered, with
  `overflow: hidden` cropping whichever axis overflows. There is no
  leftover gap for a flat wrapper color to show through, on any device
  aspect ratio.
- EXIT and the BEST/SCORE chips are now `position: absolute` directly
  over the canvas (top-left / top-center respectively — top-right is
  deliberately left free since several games draw their own on-canvas
  "NEXT" box there), instead of living in separate reserved bands. The
  game's own background now visibly extends behind them, since there's
  no separate strip carved out above the canvas anymore.
- Every game's flat, bright per-spec fill color (`#2196F3`,
  `#9C27B0`, `#FFD700`, ...) was replaced with a darker gradient via
  the existing `drawGradientBackground()` helper, keeping each game's
  distinct hue.
- A couple of games drew their own on-canvas text right in the
  top-left/top-right corners (Gravity Pulse's `GRAVITY ↑/↓` indicator,
  Arrows' level/lives readout) — nudged clear of the floating EXIT
  chip so nothing overlaps it.

## 4. Jokers — removed everywhere except Planet Merge

Every game previously shared one generic "🎴 AD JOKER" HUD button
(`UIManager`'s shared HUD). Per spec, that's gone from the shared HUD
entirely, and every other game's `useJoker()` implementation was
deleted outright (Tetris, Neon Rider, Gravity Flip, Gravity Pulse,
Brick Quest, Color Switch, Arrows now all just inherit `BaseGame`'s
no-op default — no joker at all).

**Planet Merge gets two new jokers instead**, built and owned entirely
by that game (not the shared HUD), bottom-left/bottom-right, both
ad-gated through the existing simulated-ad flow
(`GameManager._handleJokerRequested`, generalized to carry a
`jokerId` so it can support more than one reward per game):

- 🌀 **Shake** — rattles the board, giving every piece on it a random
  velocity kick, with a brief screen-shake render effect.
- 💣 **Bomb** — arms a one-shot targeter after the ad finishes; the
  *next tap on the board* destroys whichever piece is under it instead
  of dropping a new one (tapping the bomb button again while armed
  cancels it, no ad re-charged).

## 5. Game Select menu — vertical list, new order

`gameRegistry.js`'s array order is now the literal top-to-bottom order
(the screen is a single flex column, not a 2-column grid, per spec —
*"oyunlar yan yana değil alt alta olsun"*):

1. Planet Merge · 2. Tetris · 3. Brick Quest · 4. Arrows ·
5. Gravity Pulse · 6. Rider Neon · 7. Color Switch · 8. Gravity Flip

Cards are now full-width banners instead of square icons; the screen
scrolls internally (`.game-select-screen { overflow-y: auto }`) since
eight stacked banners are taller than most viewports.

## 6. Arrows — full rebuild to match the real mobile-game genre

The previous implementation had the player trace a hidden longest-path
through a maze of connected pipes — a completely different genre from
the actual "Arrows" games on the app stores, which is a specific,
well-documented puzzle mechanic: a grid of arrow tiles, each pointing
a direction; **tap an arrow and, if its straight-line path to the edge
of the grid is clear of every other tile, it slides off; tap a blocked
one and you lose a life instead.** Clear the whole board to advance.
That's what `ArrowsGame.js` is now, built from that documented rule
set (an original implementation, not a decompilation of any specific
app — the same approach the previous pass already used for Neon
Rider).

The one non-obvious part is guaranteeing every generated board is
actually solvable. `generateBoard()` does this by construction rather
than by luck: cells are added to the board one at a time, and each
new cell's direction is only ever chosen from directions clear of
every cell **already on the board at that moment**. That's exactly
what makes *reverse* build order a valid clear order — proof by
induction in the comment above `generateBoard()`. I additionally wrote
a standalone script (not shipped) that ran an independent greedy
solver against 100 generated boards spanning levels 1–400 and
confirmed every single one is fully clearable, with no duplicate tile
placements.

Also darker/on-theme per §3, and the level/lives readout was
repositioned clear of the floating EXIT button.

## 7. Rider Neon

The existing implementation was already built from Ketchapp Rider's
documented mechanic (hold to accelerate while grounded; hold while
airborne to spin; land matching the slope or crash; endless procedural
terrain, no timer) rather than a decompilation, and checked out against
that mechanic again this pass — no physics changes. What changed:
new player sprite, joker removed, darker sky gradient (was a flat
bright purple).

## Testing this pass

Every JS file passes `node --check` (ES module syntax). Cross-checked
every `i18n.t('key')` call site in the codebase against
`translations.js` in all four languages — no missing keys. Swept the
whole `src/` tree for leftover references to removed systems (old
joker button/HUD-band classes, old `bgmKey` data) — none found. Every
game module that opens a `ResizeObserver` via `createGameCanvas` now
also disconnects it in `destroy()` — checked file-by-file. Arrows'
board generator was verified independently (see §6) rather than only
reasoned about.

What I couldn't do in this environment: physically tap through the
touch flows on a device. The logic, event wiring, and animation timers
are all in place and internally consistent, but give the shake/bomb
buttons and Arrows a real playtest and tell me if anything feels off.
