import { describe, expect, it } from "vitest"

import { chooseMove } from "./balance-simulator"
import { countIsolatedHoles } from "./board-heuristics"
import { analyzeGameOutcome, analyzeGameOutcomeFromState } from "./game-outcome-analysis"
import { createNewGame, gameReducer } from "./game-state-reducer"
import { BOARD_SIZE, type GameState } from "./game-types"
import { createRankedGameStartState, type RecordedGameAction } from "./replay-recorded-game-actions"

/**
 * Bàn kín gần hết: mỗi hàng/cột còn ≥2 ô trống rời nhau (đặt 1 ô không làm đầy dòng nào),
 * thêm một khe dọc 3 ô ở cột 0 (hàng 4–6) — chỗ duy nhất vừa thanh dọc 3 ô.
 */
function crampedBoard(): number[] {
  const empty = new Set<number>()
  for (let row = 0; row < BOARD_SIZE; row++) {
    empty.add(row * BOARD_SIZE + row)
    empty.add(row * BOARD_SIZE + ((row + 4) % BOARD_SIZE))
  }
  for (const row of [4, 5, 6]) empty.add(row * BOARD_SIZE)
  return Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => (empty.has(index) ? 0 : 1))
}

function startWith(shapeIds: (string | null)[]): GameState {
  const base = createNewGame(1)
  return {
    ...base,
    board: crampedBoard(),
    tray: shapeIds.map((shapeId, slot) => (shapeId ? { uid: 100 + slot, shapeId, colorId: 2 } : null)),
    nextPieceUid: 200,
  }
}

const place = (slot: number, row: number, col: number): RecordedGameAction => ({ type: "PLACE_PIECE", slot, row, col })

describe("analyzeGameOutcomeFromState", () => {
  it("finds the move that blocked an otherwise solvable tray and suggests another spot", () => {
    const start = startWith(["dot", "line3-r1", null])
    // Chặn giữa khe dọc → thanh 3 ô không còn chỗ.
    const after = gameReducer(start, place(0, 5, 0))
    expect(after.isGameOver).toBe(true)

    const result = analyzeGameOutcomeFromState(start, [place(0, 5, 0)])
    expect(result.verdict).toBe("mistake")
    expect(result.decisive).toMatchObject({ moveIndex: 0, shapeId: "dot", row: 5, col: 0 })
    expect(result.decisive?.boardBefore).toEqual(start.board)
    expect(result.suggestion).toBeDefined()
    const { row, col } = result.suggestion!
    expect(col === 0 && row >= 4 && row <= 6).toBe(false)
    expect(result.turnsAnalyzed).toBe(1)
  })

  it("calls a tray that could never be fully placed unlucky", () => {
    const start = startWith(["dot", "square2", null])
    const actions = [place(0, 0, 0)]
    expect(gameReducer(start, actions[0]).isGameOver).toBe(true)
    expect(analyzeGameOutcomeFromState(start, actions).verdict).toBe("unlucky")
  })

  it("returns unknown for unfinished games, revives before death, invalid logs and assisted turns", () => {
    const start = startWith(["dot", "line3-r1", null])
    expect(analyzeGameOutcomeFromState(start, []).verdict).toBe("unknown")
    expect(analyzeGameOutcomeFromState(start, [{ type: "REVIVE" }]).verdict).toBe("unknown")
    expect(analyzeGameOutcomeFromState(start, [place(0, 50, 50)]).verdict).toBe("unknown")
    const stashed = { ...start, stash: { uid: 99, shapeId: "dot", colorId: 3 } }
    expect(analyzeGameOutcomeFromState(stashed, [place(0, 5, 0)]).verdict).toBe("unknown")
  })

  it("is deterministic and never throws on real bot games", () => {
    for (const seed of [2, 19, 404]) {
      let state = createRankedGameStartState({ seed, stashUnlocked: false })
      const actions: RecordedGameAction[] = []
      while (!state.isGameOver && actions.length < 300) {
        const choice = chooseMove(state)
        if (!choice) break
        const action = place(choice.slot, choice.row, choice.col)
        state = gameReducer(state, action)
        actions.push(action)
      }
      const first = analyzeGameOutcome({ start: { seed, stashUnlocked: false }, actions })
      expect(["mistake", "unlucky", "unknown"]).toContain(first.verdict)
      expect(analyzeGameOutcome({ start: { seed, stashUnlocked: false }, actions })).toEqual(first)
    }
  })
})

describe("countIsolatedHoles", () => {
  it("counts empty cells closed on all four sides", () => {
    // 18 ô trống: khe 3 ô + ô (5,1) sát khe không kín → 14 lỗ kín.
    expect(countIsolatedHoles(crampedBoard())).toBe(14)
  })
})
