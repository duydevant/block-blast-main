# Tester report: block-puzzle engine (phase 02)

Date: 2026-10-27. Scope: `modules/block-puzzle/engine/*`. Spec: `phase-02-core-game-engine-pure-typescript.md`.

## Results
- `npm test` (vitest 3.2.7, node env): 50 passed / 0 failed / 0 skipped. 4 files. Run 3x, stable. Total ~0.6s; slowest test 31ms (full-game simulation, 20 seeds).
- `npx tsc --noEmit`: exit 0, no errors.
- Lint: not run (not in scope).

## Coverage (`modules/block-puzzle/engine`, v8)
| File | Stmts | Branch | Funcs | Lines |
|---|---|---|---|---|
| All | 99.35 | 98.38 | 100 | 99.35 |
| board-grid-operations.ts | 100 | 100 | 100 | 100 |
| game-state-reducer.ts | 100 | 100 | 100 | 100 |
| piece-shape-catalog.ts | 100 | 100 | 100 | 100 |
| piece-tray-generator.ts | 96.22 | 93.75 | 100 | 96.22 |
| score-and-combo-rules.ts | 100 | 100 | 100 | 100 |
| seeded-random-generator.ts | 100 | 100 | 100 | 100 |
| game-types.ts | 100 | 100 | 100 | 100 |

Target ≥90% lines: met (99.35%).

Coverage before this pass: 98.7% lines / 94.26% branch. Gaps closed: NEW_GAME/RESTORE dispatch, placement after game over, empty slot, game-over detection after placement, `hasAnyMove` null/unknown-id/empty cases, tier-weight table (0.8 band), full-board deal.

Remaining uncovered: `piece-tray-generator.ts` L30-31 (`pickWeightedShape` tail `return shapes[last]`). Dead code: roll in [0,1) guarantees `threshold < 0` inside loop. Float margin ~2e-10 >> fp error. Not reachable; left as is (no source edits allowed).

## Tests added (existing `*.test.ts` only)
- `piece-tray-generator.test.ts`: `tierWeightFactor` table (10 cases); `dealTray` full board returns 3 pieces, none fit.
- `game-state-reducer.test.ts`: empty slot rejected; placement after game over rejected; game-over after placement (checkerboard board, line3 left); keep-playing counterpart; `NEW_GAME` equals `createNewGame`; `RESTORE` returns same ref; `hasAnyMove` cases. Helper `checkerboard()`.
- Mistake in first draft: boards with full rows 1-6 caused unintended clears. Fixed by checkerboard. Test bug, not engine bug.

## Bugs found
None blocking. No engine bug reproduced by tests.

## Observations (non-blocking)
1. `RESTORE` action applies state unvalidated (`game-state-reducer.ts` L100). Spec says zod validation in phase 04. Must land before restore from localStorage is wired up.
2. Spec vs impl drift in `GameState`: impl has `moveCount`, `nextPieceUid`, `lastMove`, `rngState`; spec lists `seed`, `best`. `best` absent. `TrayPiece.uid` is `number` (spec: `string`). Update spec or code before phase 04 persistence.
3. `dealTray` fallback (L67-72) rewrites slot 0 only; correct, but fallback is rare. Coverage confirms it runs.
4. `piece-tray-generator.ts` L30-31 dead code (see above).

## Environment note
`@vitest/coverage-v8` not in `node_modules` and not in `package.json`. Installed temporarily with `npm install --no-save @vitest/coverage-v8@3.2.7` to measure coverage, then removed with `npm uninstall --no-save`. `package.json` and `package-lock.json` verified unchanged. Coverage run needs the provider to be installed for that run. Consider adding it as devDependency in phase 07 if coverage gate is wanted in CI. Decision left to user.

## Unresolved questions
- Add `@vitest/coverage-v8@3.2.7` as devDependency for CI coverage gate? (user decision; not done per instructions)
- Spec `GameState` (`seed`, `best`, string uid) vs impl drift: which is authoritative?
- Should `RESTORE` validate state inside reducer, or only in phase 04 zod layer?
