# Code Review: block-puzzle render/input/store/audio/UI layers

## Scope
- Files: modules/block-puzzle/{render,input,audio,store,components}/*, block-puzzle-translations.ts, app/(game)/layout.tsx, app/(game)/play/page.tsx, sitemap/schema/header/home CTA edits
- LOC reviewed: ~1,250 (excluding engine)
- Focus: lifecycle leaks, persist hydration/migrate/merge, pointer edge cases, DPR/resize, a11y, mobile layout, audio unlock
- Verified against zustand 5.0.15 `persist` source (node_modules/zustand/esm/middleware.mjs:280-475)

## Overall Assessment
Clean, well-separated architecture. Canvas loop is idle-when-static, reads store via getState/subscribe (no per-frame React renders), effect cleanup is complete and StrictMode-safe, the save is zod-validated and normalized through the engine's RESTORE. Main risks: (1) persist API is `undefined` when localStorage access throws -> crash/stuck loading; (2) `migrate` drops best score in exactly the scenario it is meant to protect; (3) audio unlock is bound to touch `pointerdown`, which is not a user-activation event -> likely silent on iOS and first move silent on Android. Rest is Medium/Low.

**Score: 8/10**

## Critical Issues
None.

## High Priority

### H1. Crash + stuck "Loading" when localStorage is inaccessible
`components/block-puzzle-game-screen.tsx:24-27`
zustand `createJSONStorage(() => window.localStorage)` swallows the throw and returns `undefined`; persist then returns the bare store **without `api.persist`** (middleware.mjs:280-284, 344-355). Accessing `window.localStorage` throws `SecurityError` in cross-origin iframes with third-party storage blocked (game portals / embeds), Firefox/Safari with cookies disabled, some sandboxed webviews. Then `useBlockPuzzleGameStore.persist.rehydrate()` -> `TypeError: Cannot read properties of undefined`, `hasHydrated` never flips, screen stuck on "Loading game..." (and error overlay in dev).
Fix (either):
```ts
// game-screen effect
const gamePersist = useBlockPuzzleGameStore.persist
if (gamePersist) void gamePersist.rehydrate()
else useBlockPuzzleGameStore.setState((s) => ({ hasHydrated: true, game: s.game ?? createNewGame(seed) }))
// same for settings store
```
or pass a safe storage: `storage: createJSONStorage(() => safeLocalStorage())` where `safeLocalStorage` try/catches and falls back to an in-memory `StateStorage`. The second keeps `persist` always defined and also covers `setItem` throwing (QuotaExceeded) which today propagates out of `placePiece` (`set` -> `setItem` is synchronous, middleware.mjs:366-370).

### H2. `migrate` loses best score on version bump
`store/block-puzzle-game-store.ts:50-53`
```ts
const saved = parseSavedGame({ game: null, best: 0, ...(persisted as object) })
```
Spread puts the *old* `game` back over `game: null`. A version bump happens precisely because old games no longer validate (shape catalog/rules change) -> whole parse fails -> `best = 0`. The comment on line 10 ("giữ best") is the opposite of actual behavior.
Fix: validate best independently.
```ts
const bestSchema = savedGameSchema.shape.best
migrate: (persisted) => {
  const raw = (persisted ?? {}) as { best?: unknown }
  const best = bestSchema.safeParse(raw.best)
  return { game: null, best: best.success ? best.data : 0 }
},
```
Add a store-level vitest for v0 -> v1 with an invalid game + best=500.

### H3. Audio unlock only on touch `pointerdown` (not an activation-triggering event)
`components/block-puzzle-game-canvas.tsx:117-121`, `audio/sound-effects-player.ts:9-24`
Per HTML spec, activation-triggering events are `keydown`, `mousedown`, `pointerdown` **only for mouse**, `pointerup` for non-mouse, `touchend`. For touch:
- Chrome Android: first `new AudioContext()`/`resume()` in pointerdown is blocked ("AudioContext was not allowed to start"); unlocks on the 2nd drag (sticky activation from first pointerup). First move silent + console warning.
- iOS Safari (WebKit requires a gesture in the call stack; touchstart-equivalent does not count) -> likely never unlocks since unlock is only ever called from pointerdown. Needs real-device check (phase-03 TODO "touch verified on real phone" still open).
Also `unlockAudio` only resumes when `state === "suspended"`; iOS uses `"interrupted"` after calls/backgrounding.
Fix:
```ts
// sound-effects-player.ts
if (audioContext.state !== "running") void audioContext.resume().catch(() => {})
// canvas effect: also unlock on gesture-granting events
const unlock = () => unlockAudio()
window.addEventListener("pointerup", unlock, true)
window.addEventListener("keydown", unlock, true)
// remove both in cleanup (or once running)
```
Optionally also resume on `visibilitychange` -> visible. Same activation issue makes the first `navigator.vibrate` on touch blocked (Chrome logs an Intervention) - low impact.

## Medium Priority

### M1. Drag not tied to piece identity; tray can change under an active drag
`input/pointer-drag-controller.ts:6-16, 87-104`
`DragState` stores only `slot`. If the game is replaced mid-drag (second finger taps HUD Restart -> confirm; keyboard Enter on focused Restart while mouse held), the dragged slot now points at a different piece from the new game: shape swaps under the finger and drop places the new piece.
Fix: add `uid` to `DragState` (from `game.tray[slot].uid`); in `computeDragState` return null if `game.tray[slot]?.uid !== uid`; in the canvas `subscribe`, if `state.game !== prev.game` and it's not a +1 move, cancel drag (expose `cancel()` from the controller).

### M2. Stuck drag if pointerup is missed
`input/pointer-drag-controller.ts:71, 77-81`
`handleDown` bails when `drag` is set. If `setPointerCapture` fails (caught on line 79) and the pointer is released outside the canvas, no up/cancel/lostpointercapture reaches the canvas -> drag frozen, every later pointerdown ignored until reload. Also no `window` blur handling although phase-03 step 4 specifies "cancel (pointercancel/blur)".
Fix: in handleDown, if `drag && !canvas.hasPointerCapture(drag.pointerId)` reset it; add `window.addEventListener("blur", () => drag && update(null))`.

### M3. Non-primary buttons start a drag
`input/pointer-drag-controller.ts:68-75`
Right/middle click on a tray piece picks it up (and opens the context menu). Add `if (event.button !== 0 || !event.isPrimary) return`. Consider `onContextMenu={e => e.preventDefault()}` and `[-webkit-touch-callout:none]` on the container for long-press on iOS.

### M4. `aria-live` on an rAF-animated number
`components/game-hud-score-bar.tsx:34-36`
The live region text changes ~24 times per score update (use-animated-number), causing screen-reader chatter / partial announcements. Make the animated span `aria-hidden` and add a separate `<span className="sr-only" aria-live="polite">{formatNumber(score)}</span>` with the final value (optionally include combo).

### M5. Game is pointer-only (WCAG 2.1.1)
`components/block-puzzle-game-canvas.tsx:135-144`
No keyboard path to select a tray piece / move / drop; canvas is `role="img"`. Acceptable for v1 if documented, but log as known limitation in docs and backlog (e.g. Tab cycles tray slots, arrows move ghost, Enter drops; engine + `computePlacementPreview` already support it).

### M6. Pinch-zoom disabled
`app/(game)/play/page.tsx:15-22`
`maximumScale: 1, userScalable: false` fails WCAG 1.4.4 and is ignored by iOS anyway. `touch-none` on the game container already prevents gesture zoom during drag. Recommend dropping both fields. `themeColor` is hard-coded dark regardless of theme; consider `[{ media: "(prefers-color-scheme: dark)", color }, ...]`.

### M7. Fixed header-height assumption
`app/(game)/layout.tsx:9`
`h-[calc(100dvh-4rem-1px)]` couples to `min-h-16` + `border-b` in game-header.tsx. Any header growth (taller avatar, text zoom, banner) causes overflow that is then clipped (`overflow-hidden`) at the bottom = tray cut off. No fallback for browsers without `dvh` (whole declaration dropped -> main height auto -> canvas container 0px).
Fix: make the layout a flex column: wrapper `flex h-dvh flex-col` (plus `h-screen` fallback class first), `<main className="min-h-0 flex-1 overflow-hidden">`. No magic number.

### M8. `merge` discards best when only the game part is invalid
`store/block-puzzle-game-store.ts:54-58`
Same coupling as H2 for tampered/corrupted-but-valid-JSON saves: one bad cell nukes `best`. Parse `best` and `game` separately and keep whichever is valid.

## Low Priority

- **L1 rAF bookkeeping** `block-puzzle-game-canvas.tsx:45-67`: `resize()` calls `draw()` directly, which zeroes `frameId` while a rAF may be pending -> a second rAF gets scheduled and cleanup only cancels the latest; an orphan frame (and its effect-driven chain, <=1.3s) can run after unmount on a detached canvas. Harmless but untidy. Fix: in resize, `if (frameId) cancelAnimationFrame(frameId)` before `draw()`. StrictMode double-mount itself is clean (no rAF pending at first cleanup).
- **L2 DPR changes** `block-puzzle-game-canvas.tsx:58-70`: ResizeObserver doesn't fire when moving window to a monitor with different DPR -> blurry until next resize. Add `matchMedia(\`(resolution: ${devicePixelRatio}dppx)\`)` change listener (re-arm each time) or observe `device-pixel-content-box`. Also backing store uses `Math.round(width*dpr)` while transform uses exact dpr -> sub-pixel scale mismatch; minor.
- **L3 Resize mid-drag** (orientation change): `drag.pieceX/Y/snap` stay in old layout coords until next pointermove; a drop without moving uses stale snap. Recompute or cancel drag in `resize()`.
- **L4 "New best" on tie** `game-dialogs.tsx:44`: `best` is always >= score, so `score >= best` means `score === best`, true also when merely tying an older best. Track `bestAtGameStart` in store if exact semantics matter.
- **L5 Points float text not locale-formatted** `block-puzzle-game-canvas.tsx:89`: use `formatNumber(move.points)` (large board-clear bonuses in vi-VN).
- **L6 Old effects survive restart**: clear `effects` in subscribe when the game object is replaced by a new game (moveCount reset).
- **L7 Multi-tab**: two tabs overwrite the same save last-writer-wins, best can regress to the other tab's value since each tab writes its in-memory `best`. Optional: listen to `storage` event and `Math.max` best.
- **L8 Perf (not urgent)**: `drawBlock` creates a gradient per cell per frame (~70-100/frame during drag) + `canShapeFitAnywhere` x3 per frame. Fine at 8x8; if low-end Android jank appears, cache static board layer in an offscreen canvas and memoize fit results per game object.

## Edge Cases Checked (OK)
- Corrupted JSON in storage: `JSON.parse` throw -> thenable `.catch` -> `onRehydrateStorage` callback still runs -> new game + `hasHydrated` set. OK.
- Missing key / version absent / downgrade: handled (merge null -> current; migrate also runs on downgrade).
- StrictMode: both `rehydrate()` calls are synchronous with localStorage and idempotent; canvas effect cleanup removes RO, store subscription, 5 pointer listeners, timer, rAF.
- Hydration: loading placeholder rendered identically on server/client (i18n starts at "en", stores skipHydration). Server-side store module has no `persist` but is never rehydrated on server.
- Multi-touch: second pointer ignored while dragging; pointerId filtered in move/up/cancel; `lostpointercapture` after `pointerup` is a no-op.
- Drag during game over: blocked in handleDown; game-over dialog key/timer cleaned on restart.
- Restored state goes through engine RESTORE (clears pre-filled lines, redeals empty tray, recomputes game over, strips lastMove -> no replayed effects/sounds).
- Zero-size container: `cellSize 0` -> renderFrame early-return; hit-test can't hit -> no divide-by-zero path.
- JSON-LD serialization escapes `<`.

## Positive Observations
- Pure, testable split (layout metrics, snap, preview, timeline) with tests; renderer stateless.
- Draw-on-demand loop; effects coordinates in cell units survive resize.
- zod schema validates shape IDs against catalog, color range, rng/score ints; `lastMove` never restored.
- Settings decoupled from save; per-field type-guarded merge.
- Reduced-motion respected in effects and score counter; WebAudio synthesized (no asset IP).
- Header-only `(game)` route group per spec; touch-action/overscroll set on container.

## Recommended Actions (priority order)
1. H1 safe storage / guard `persist` undefined.
2. H2 + M8 parse `best` independently in migrate/merge; add store tests.
3. H3 unlock audio on pointerup/keydown, resume any non-running state; verify on iOS + Android device.
4. M1-M3 drag robustness (uid check, cancel on game replace/blur, primary button only).
5. M4 a11y live region; M6 re-enable zoom; M7 flex layout instead of calc.
6. Low items as time allows.

## Metrics
- Type coverage: strict TS, no `any`; two `as` casts in stores (acceptable, followed by validation).
- Tests: render/layout/timeline/schema covered; no tests for store migrate/merge or drag controller event flow.
- Lint: reported clean by caller.

## Plan TODO status
- phase-03 "touch verified on real phone" unchecked - required to close H3/M3.
- phase-05 "playtest tuning" unchecked.

## Unresolved Questions
- Is iframe/portal embedding a target? Raises H1 to must-fix.
- Is keyboard play (M5) in scope for v1 or explicitly deferred?
- iOS audio behavior needs real-device confirmation (WebKit gesture rules for pointerdown-from-touch).
