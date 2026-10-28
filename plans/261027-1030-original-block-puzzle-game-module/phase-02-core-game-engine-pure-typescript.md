# Phase 02 — Core game engine (pure TS + tests)

## Context Links
- [plan.md](./plan.md) · [phase-01](./phase-01-scope-ip-boundary-and-project-setup.md)
- `vitest.config.ts` (env `node`, alias `@`)

## Overview
- Priority: P1 · Status: Done · Effort: 8h
- All rules as pure functions, no DOM/React. Deterministic with seeded RNG → fully unit-testable.

## Key Insights
- Board 8x8 = 64 cells → flat `Uint8Array(64)` / `number[]`, value 0 = empty, 1..N = color id. Index = `row * 8 + col`.
- Rows and columns clear simultaneously; a cell in both a full row and full col cleared once.
- Game over = none of the remaining tray pieces fits anywhere (not "all 3").
- Generator must avoid unwinnable deals when possible: ≥1 piece of each new tray fits current board.

## Requirements
- Functional: place piece, detect/clear full rows+cols, score, combo streak, board-clear bonus, tray refill when all 3 used, game-over detection, new game, serialize/restore.
- Non-functional: each file < 200 lines; `hasAnyMove` fast enough to run every placement (64 × ≤3 shapes × ≤9 cells — trivial).

## Architecture
```ts
// engine/game-types.ts
export const BOARD_SIZE = 8
export type BoardCells = number[]                // length 64
export interface ShapeDef { id: string; cells: readonly (readonly [row: number, col: number])[]; weight: number; tier: 1 | 2 | 3 }
export interface TrayPiece { uid: string; shapeId: string; colorId: number } // null slot = used
export interface GameState { board: BoardCells; tray: (TrayPiece | null)[]; score: number; best: number;
  combo: number; movesSinceClear: number; isGameOver: boolean; seed: number; rngState: number }
export type GameAction =
  | { type: "NEW_GAME"; seed: number }
  | { type: "PLACE_PIECE"; slot: number; row: number; col: number }
  | { type: "RESTORE"; state: GameState }

// engine/board-grid-operations.ts
canPlace(board, shape, row, col): boolean
placeCells(board, shape, row, col, colorId): BoardCells
findFullLines(board): { rows: number[]; cols: number[] }
clearLines(board, rows, cols): { board: BoardCells; clearedCells: number[] }
canShapeFitAnywhere(board, shape): boolean

// engine/score-and-combo-rules.ts  — constants in one place, tune later
scoreForMove({ placedCellCount, linesCleared, combo, boardCleared }): number
// e.g. placed cells + LINE_BONUS[lines] * (1 + combo * COMBO_STEP) + (boardCleared ? BOARD_CLEAR_BONUS : 0)
// combo++ when move clears ≥1 line; reset to 0 after COMBO_GRACE_MOVES moves w/o clear

// engine/seeded-random-generator.ts   mulberry32(state) → [value, nextState]
// engine/piece-shape-catalog.ts       own shape set + rotations as separate entries
// engine/piece-tray-generator.ts      dealTray(board, score, rngState) → { tray, rngState }
// engine/game-state-reducer.ts        gameReducer(state, action): GameState
```
Shape set (generic polyominoes): 1, 2-line, 3-line, 4-line, 5-line, 2x2, 3x3, 2x3, small L (3), L (4, all rotations), big corner L (5), T, S/Z. Difficulty tier weights shift by score.

## Related Code Files
- Create (all under `modules/block-puzzle/engine/`): `game-types.ts`, `board-grid-operations.ts`, `piece-shape-catalog.ts`, `score-and-combo-rules.ts`, `seeded-random-generator.ts`, `piece-tray-generator.ts`, `game-state-reducer.ts`
- Tests alongside: `board-grid-operations.test.ts`, `score-and-combo-rules.test.ts`, `piece-tray-generator.test.ts`, `game-state-reducer.test.ts`

## Implementation Steps
1. Types + constants.
2. Board ops + tests (edges, overlap, out of bounds, row+col cross clear).
3. Shape catalog (normalized to top-left origin; derive width/height helper).
4. Seeded RNG (store state as number so it serializes).
5. Scoring + combo + tests (table-driven).
6. Tray generator: weighted pick by tier; retry ≤ 20 to guarantee ≥1 fits; fallback = smallest fitting shape.
7. Reducer: validate action (slot non-null, canPlace) → place → clear → score → refill tray if empty → game-over check. Invalid action returns same state reference.
8. `npm test`, `npx tsc --noEmit`.

## Todo List
- [x] game-types
- [x] board ops + tests
- [x] shape catalog
- [x] seeded RNG
- [x] scoring/combo + tests
- [x] tray generator + tests
- [x] reducer + tests
- [x] tests/tsc green

## Success Criteria
- Same seed + same action list → identical final state (replay test).
- Coverage of engine ≥ 90% lines.
- Reducer never mutates input state.

## Risk Assessment
- Balance (too easy/hard) → keep all numbers in `score-and-combo-rules.ts` + generator weights; tune in phase 07 playtest.
- Generator fairness only checks current board, not combinations of 3 → acceptable, same as genre norm.

## Security Considerations
- Restored save is untrusted (localStorage) → validate shape with zod in phase 04 before `RESTORE`.

## Next Steps
- Phase 03 consumes reducer + `canPlace` for ghost preview.

## Implementation Notes (as built)
- `GameState` has no `seed`/`best`: best score lives in the store; `rngState` is the serialized RNG. `TrayPiece.uid` is a number.
- Added `moveCount`, `nextPieceUid`, `lastMove` (incl. piece `colorId`) for UI effects.
- Fallback when no dealt piece fits: weighted pick among fitting shapes (not "smallest").
- Combo grace: up to 2 non-clearing moves keep the combo; 3rd resets (`comboGraceMoves: 3`).
- RESTORE normalizes untrusted saves (`normalizeRestoredState`); `canPlace` rejects non-integer coords (review H1).
