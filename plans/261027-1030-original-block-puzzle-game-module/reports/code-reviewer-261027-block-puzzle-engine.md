# Code Review — block-puzzle engine (phase 02)

Date: 2026-10-27 · Reviewer: code-reviewer · Score: **8/10**

## Scope
- Files: `modules/block-puzzle/engine/{game-types,board-grid-operations,piece-shape-catalog,seeded-random-generator,score-and-combo-rules,piece-tray-generator,game-state-reducer}.ts`, 4 `*.test.ts`, `modules/block-puzzle/index.ts`
- LOC: ~460 src, ~390 test (all files < 200 lines)
- Spec: `phase-02-core-game-engine-pure-typescript.md`
- Note: `game-state-reducer.test.ts` and `piece-tray-generator.test.ts` were edited by someone else while this review ran (100 -> 169 lines). One run caught them mid-edit with a failing test. The final run is green: 50 tests, engine coverage 99.35% lines / 98.4% branches. The only uncovered code is the float-rounding fallback in `piece-tray-generator.ts:30`, which can't be reached in practice.
- How findings were checked: a jiti probe script against the real engine (in the scratchpad, outside the project).

## Overall
Clean code with pure functions, deterministic and JSON-serializable. Rows and columns clear correctly at the same time, the intersection cell is counted once, and refilling the tray happens before the game-over check (both use the board after clearing). Mulberry32 matches the reference implementation. A JSON round-trip mid-game gives the same result as a game that never round-tripped (verified). There is one real correctness hole (fractional coordinates) and a group of restore-hardening gaps that phase 04 will run into.

## Critical
None.

## High

### H1. Fractional `row`/`col` is accepted and the piece wraps into the next row
`board-grid-operations.ts:16-19`. The bounds check uses `row + height > 8` and `col + width > 8`. The cell lookup uses `row*8+col`. Fractional inputs where `row*8+col` comes out as a whole number pass both checks.
Verified: `PLACE_PIECE {slot:0, row:0.5, col:0}` with `line5-r0` is accepted, and `placedCells = [4,5,6,7,8]`. The piece runs across cells (0,4)..(0,7) and (1,0), a shape that can't legally exist. NaN is rejected (by luck: `board[NaN]` is undefined).
Why it matters: phase 03 turns pointer pixels into row/col. One missing `Math.floor`/`Math.round` there would corrupt the board without any error. The reducer is the trust boundary, so it should not rely on callers.
Fix (cheapest, covers every caller):
```ts
export function canPlace(board: BoardCells, shape: ShapeDef, row: number, col: number): boolean {
  if (!Number.isInteger(row) || !Number.isInteger(col)) return false
  if (row < 0 || col < 0 || row + shape.height > BOARD_SIZE || col + shape.width > BOARD_SIZE) return false
  ...
```
Add tests for `row: 0.5`, `col: 1.5`, `NaN`, `Infinity`, and negative `col`.

## Medium

### M1. `RESTORE` passes untrusted state through unchanged, which allows soft-lock and stale effects
`game-state-reducer.ts:99-100` (the new test at `game-state-reducer.test.ts:138` locks in "same reference"). Zod in phase 04 only checks the data's shape. It does not check game rules. Verified case: a restored tray of `[null,null,null]` with `isGameOver:false` gives `hasAnyMove=false`, every PLACE is rejected, and the game is stuck with no game-over screen. Other states that pass a zod schema but break the rules:
- `isGameOver` out of sync with board/tray (a save that is "over" but still has moves, or the reverse)
- a full row/col already on the board, which pays out free line points on the next move
- `lastMove` persisted with the save, so a UI driven by `lastMove` replays the clear animation and sound on load
- `nextPieceUid <= max(tray uid)`, which gives duplicate React keys after the next refill
- unknown `shapeId` (catalog renamed). The slot can never be used, though `hasAnyMove` treats it safely.

Fix: add an engine-level `normalizeRestoredState(s): GameState` (pure, easy to test) and call it in `RESTORE`. It should: refill if the tray is all null (`dealTray`), clear any existing full lines (no points), set `lastMove: null`, set `nextPieceUid = max(nextPieceUid, maxTrayUid+1)`, recompute `isGameOver = !hasAnyMove(board, tray)`, and coerce `rngState >>> 0`. Keep the board-length 64, colorId 0..7 and tray-length 3 checks in zod (phase 04). Then change the RESTORE test to assert the normalized result rather than identity.

### M2. Unknown action type returns `undefined`
`game-state-reducer.ts:96-103`. There is no `default` branch. TS is fine with this because the union is exhaustive, but at runtime (devtools, a stale persisted action, a typo through `as any`) `gameReducer(base, {type:"BOGUS"})` returns `undefined` (verified), and the store crashes. Fix:
```ts
default: {
  const _exhaustive: never = action
  return state
}
```

### M3. Shape catalog objects can be mutated by any importer
`piece-shape-catalog.ts:59-75`. `SHAPE_CATALOG` is a `readonly` array, but the `ShapeDef` objects and `cells` arrays inside it aren't frozen (verified `Object.isFrozen(dot) === false`), and `findShape` is re-exported from `index.ts`. If a renderer accidentally does `shape.cells.sort(...)` or `shape.width = ...`, every game is corrupted. Fix: `Object.freeze` each ShapeDef and its `cells` in `buildCatalog`, or mark the `ShapeDef` fields `readonly` in `game-types.ts:12-22`. Doing both is cheap.

### M4. Shape ids and catalog order are part of the save/replay format
`piece-shape-catalog.ts:63` names rotations `${id}-r${index}`, and the index depends on the base `pattern` orientation. `pickWeightedShape` depends on catalog order and weights. Tuning in phase 07 (changing weights, reordering families, editing a base pattern) will (a) re-map or orphan `shapeId`s in existing saves and (b) change every seed's game. Fix: add `SAVE_VERSION` / `ENGINE_VERSION` to the persisted envelope in phase 04 and throw away saves from a different version. Also add a comment on `SHAPE_FAMILIES` warning that ids are persisted.

## Low

- **L1. Spec deviations to record or confirm.** `GameState` has no `seed` or `best` (`game-types.ts:43-56`; the spec lists both). `best` likely belongs in the phase-04 store, but keeping `seed` is cheap and useful for "replay/share seed" and debugging. `TrayPiece.uid` is `number`, not the spec's `string` (fine; update the spec). The fallback picks a *weighted fitting* shape, where the spec says "smallest fitting" (`piece-tray-generator.ts:67-72`). The implemented version is arguably better, so update the spec.
- **L2. Combo grace has an off-by-one ambiguity.** With `comboGraceMoves: 3`, the combo is lost on the 3rd non-clearing move, so only 2 grace moves are allowed (`score-and-combo-rules.ts:27`). The comment at line 8 says so and the tests match, but the spec reads "reset after COMBO_GRACE_MOVES moves". Confirm the intent before playtest so the number isn't mis-tuned.
- **L3. `placeCells`/`clearLines` are exported (via `index.ts`) and have no bounds guard.** Out-of-range indices silently grow the array beyond 64 (`next[70] = c`). Internal callers are safe. Either document the precondition ("call `canPlace` first") or stop exporting them from `index.ts` (YAGNI: phase 03 only needs `canPlace` for the ghost preview).
- **L4. `movesSinceClear` grows without limit after the combo drops** (`score-and-combo-rules.ts:26`). Harmless, but `Math.min(movesSinceClear, comboGraceMoves)` keeps saves tidy.
- **L5. `normalizeSeed`** sends `NaN`/`Infinity` to seed 0 and folds seeds ≥ 2^32 together (`seeded-random-generator.ts:20-22`). Fine for `Date.now()`-style seeds. Note it if seeds ever become user-entered.
- **L6. The simulation test depends on tuning.** `"ends only when no tray piece fits"` (`game-state-reducer.test.ts:162`) assumes every seed from 1 to 20 ends within 2000 random moves. It is deterministic, so not flaky, but making the generator easier in phase 07 could fail it for a reason that isn't a bug. Consider dropping `expect(isGameOver)` and only asserting `isGameOver === !hasAnyMove(...)` at every step.

## Edge cases from scouting
- Fractional coordinates leading to wrapped placement: **bug (H1)**.
- Board with every cell full after a placement: can't persist (every row is full, so it clears), so a refill always has at least one free cell and the fallback always finds `dot`. Game-over right after a refill is impossible. Correct.
- Fallback path coverage: the one-free-cell test reaches the fallback for 4 of 30 seeds (probed). That coverage is real but happens by chance. Fine.
- Refill tier factor uses the score after the move (`game-state-reducer.ts:64`). Correct.
- Tray with nulls: `hasAnyMove` skips nulls, so game-over means "remaining pieces", as the spec says. Correct.
- Invalid slot (`-1`, `9`, `0.5`) gives `tray[x]` undefined, so the move is rejected with the same reference. Correct.
- JSON round-trip mid-game gives an identical continuation. Correct (probed, 30 moves).
- Restore with an all-null tray soft-locks: **M1**.

## Test gaps (after the concurrent additions)
1. Fractional/NaN/Infinity coordinates (H1).
2. Reducer-level combo over several moves: clear, 1-2 dry moves, clear again → `combo` 2 and multiplier 1.5, then 3 dry moves → combo 0.
3. Reducer-level row and column cleared by one placement (e.g. a `corner3` finishing row r and col c): `linesCleared=2`, 30 base points, intersection counted once in `clearedCells`.
4. A JSON round-trip test (stringify/parse state mid-game, continue, compare). This is the phase-04 guarantee, so lock it in now.
5. Mutation guard: deep-freeze the input state in the "does not mutate" test, so a mutation throws instead of relying on a JSON diff.
6. RESTORE normalization cases once M1 is done.

## Positive observations
- Pure, readonly-typed board and tray. Every transition copies (`[...board]`, `tray.map`), and invalid moves return the same reference, as the spec requires.
- The RNG is a single uint32 in state, so nothing is hidden. Replay determinism is tested end-to-end.
- All balance numbers are in `SCORING_RULES` and `tierWeightFactor`, ready for playtest tuning.
- Rotations are generated and de-duplicated automatically, the catalog is normalized, and a test checks it.
- `MoveResult` gives the UI what it needs for effects without the UI having to re-derive anything.
- Files are small and well-named. Engine coverage is 99%.

## Recommended actions (priority)
1. H1: integer guard in `canPlace`, plus tests.
2. M2: `default` branch in the reducer.
3. M1: `normalizeRestoredState` in the engine, used by RESTORE (before phase 04 wires up localStorage).
4. M3: freeze the catalog / make the fields readonly.
5. M4: save version in the phase-04 persistence envelope.
6. Test gaps 2-4.
7. L1/L2: update the spec or confirm the decisions.

## Metrics
- Type coverage: strict TS, no `any` in src
- Test coverage: engine 99.35% lines / 98.38% branches (index.ts 0%, re-exports only)
- Lint: not re-run (caller reports clean)

## Plan TODO status
Every phase-02 todo is implemented. The checkboxes in `phase-02-core-game-engine-pure-typescript.md` are still `[ ]`, and Status still says "Pending". I didn't edit the plan (read-only review), so the lead or project-manager should tick them after H1/M2.

## Unresolved questions
- Is the combo grace meant as 2 dry moves (current) or 3 (as the spec reads)?
- Should `seed` stay in `GameState` for share/replay, or is that out of scope (YAGNI)?
- Should RESTORE keep its "same reference" contract (current test), or switch to normalizing (recommended)?
