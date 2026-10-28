# Phase 04 — Game shell UI, store, persistence

## Context Links
- [plan.md](./plan.md) · [phase-03](./phase-03-canvas-renderer-and-pointer-drag-input.md)
- Pattern: `lib/store/auth.store.ts` (zustand + persist + hydration flag)
- UI kit: `components/ui/{button,dialog,alert-dialog,card,badge,tooltip,dropdown-menu}.tsx`

## Overview
- Priority: P1 · Status: Done · Effort: 6h
- Wrap reducer in zustand store, persist best score + in-progress game, build HUD and dialogs with shadcn.

## Key Insights
- Persist only serializable `GameState` (board, tray, score, combo, rngState) → resume after reload.
- SSR: store reads localStorage only on client; render skeleton until `hasHydrated` (same as auth store) to avoid hydration mismatch.
- Settings (sound, haptics) = separate small persisted slice/key so new-game doesn't reset them.

## Requirements
- Functional: HUD (score, best, combo badge), pause/restart (confirm via AlertDialog), game-over dialog (score, best, "new best" flag, play again), first-run how-to-play overlay, settings menu (sound/haptics toggles).
- Non-functional: all strings via `useI18n().t()` en + vi; keyboard accessible dialogs (shadcn handles).

## Architecture
```
store/block-puzzle-game-store.ts     state + dispatch(action) → gameReducer; persist key "block-puzzle.save"
store/block-puzzle-settings-store.ts sound, haptics, seenTutorial; key "block-puzzle.settings"
store/saved-game-schema.ts           zod schema validating restored GameState (reject → new game)
components/block-puzzle-game-screen.tsx  composes HUD + canvas + dialogs (page uses this only)
components/game-hud-score-bar.tsx
components/game-over-dialog.tsx
components/restart-confirm-dialog.tsx
components/how-to-play-overlay.tsx
components/game-settings-menu.tsx
```

## Related Code Files
- Modify: `lib/i18n.tsx` (add `game.*` keys en/vi), `modules/block-puzzle/components/block-puzzle-game-canvas.tsx` (use store)
- Create: files above
- Test: `saved-game-schema.test.ts`, store test (dispatch → state, corrupted save → fresh game)

## Implementation Steps
1. Settings store.
2. Game store using `gameReducer`; `newGame()` seeds from `crypto.getRandomValues`.
3. zod schema + `onRehydrateStorage` validation fallback.
4. Hook canvas to store (`useBlockPuzzleGameStore.subscribe` → mark dirty, no React re-render per frame).
5. HUD + dialogs + overlay + settings.
6. i18n keys. Watch `lib/i18n.tsx` size (122 lines) — if game keys push it >200, move dictionaries to `lib/i18n/` folder or keep game strings in `modules/block-puzzle/block-puzzle-translations.ts` merged into dict.
7. tsc, lint, test.

## Todo List
- [x] settings store
- [x] game store + persist
- [x] zod validation of save
- [x] canvas ↔ store wiring
- [x] HUD, game over, restart, tutorial, settings
- [x] i18n en/vi
- [x] checks green

## Success Criteria
- Reload mid-game → same board/tray/score. Tampered localStorage → fresh game, no crash.
- No hydration warning in console.

## Risk Assessment
- i18n file bloat → see step 6.
- Store subscription re-rendering canvas component every move → select narrowly, renderer reads via `getState()`.

## Security Considerations
- localStorage is user-controlled: validate, clamp score. Local best score is not trustworthy for any future leaderboard (server must validate).

## Next Steps
- Phase 05 juice, phase 06 integration (can parallel).
