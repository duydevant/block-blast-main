import { describe, expect, it } from "vitest"

import { canPlace, cellIndex } from "./board-grid-operations"
import { createNewGame, gameReducer } from "./game-state-reducer"
import { BOARD_SIZE, type GameAction, type GameState } from "./game-types"
import { findShape } from "./piece-shape-catalog"
import { replayRecordedGame, type RecordedGameAction } from "./replay-recorded-game-actions"
import { nextPerfectChain, PERFECT_CLEAR_CHAIN_RULES, perfectClearBonus, SCORING_RULES, scoreForMove } from "./score-and-combo-rules"

const { chainWindowMoves, baseBonus, maxChain } = PERFECT_CLEAR_CHAIN_RULES

describe("perfect clear chain", () => {
  it("starts at ×1, grows inside the window and caps the bonus at ×5", () => {
    let state: { perfectChain?: number; movesSinceBoardClear?: number } = {}
    state = nextPerfectChain(state, true)
    expect(state).toEqual({ perfectChain: 1, movesSinceBoardClear: 0 })
    for (let move = 1; move < chainWindowMoves; move++) state = nextPerfectChain(state, false)
    state = nextPerfectChain(state, true)
    expect(state.perfectChain).toBe(2)
    expect([1, 2, 5, 9].map(perfectClearBonus)).toEqual([baseBonus, baseBonus * 2, baseBonus * 5, baseBonus * maxChain])
  })

  it("breaks after the window passes without another clear", () => {
    let state = nextPerfectChain({ perfectChain: 3, movesSinceBoardClear: 0 }, false)
    for (let move = 1; move < chainWindowMoves; move++) state = nextPerfectChain(state, false)
    expect(state.perfectChain).toBe(3)
    state = nextPerfectChain(state, false)
    expect(state).toEqual({ perfectChain: 0, movesSinceBoardClear: chainWindowMoves + 1 })
    expect(nextPerfectChain(state, true).perfectChain).toBe(1)
  })

  it("keeps the v1 fixed bonus when no chain is given", () => {
    const move = { placedCellCount: 1, linesCleared: 1, combo: 1, boardCleared: true }
    expect(scoreForMove(move)).toBe(1 + 10 + SCORING_RULES.boardClearBonus)
    expect(scoreForMove({ ...move, perfectChain: 3 })).toBe(1 + 10 + baseBonus * 3)
  })
})

/** Bàn chỉ còn hàng 0 thiếu ô (0,0); đặt khối 1 ô vào đó là dọn sạch bàn. */
function oneDotFromClear(state: GameState): GameState {
  const board = state.board.map(() => 0)
  for (let col = 1; col < BOARD_SIZE; col++) board[cellIndex(0, col)] = 2
  return { ...state, board, tray: [{ uid: 900 + state.moveCount, shapeId: "dot", colorId: 1 }, null, null] }
}

describe("rules v2 in the reducer", () => {
  it("multiplies consecutive board clears and reports the chain", () => {
    let state = createNewGame(11, { rulesVersion: 2 })
    expect(state.rulesVersion).toBe(2)
    state = gameReducer(oneDotFromClear(state), { type: "PLACE_PIECE", slot: 0, row: 0, col: 0 })
    expect(state.lastMove?.perfectChain).toBe(1)
    expect(state.lastMove?.points).toBe(1 + 10 + baseBonus)
    const before = state.score
    state = gameReducer(oneDotFromClear(state), { type: "PLACE_PIECE", slot: 0, row: 0, col: 0 })
    expect(state.lastMove?.perfectChain).toBe(2)
    // Combo 2 → điểm dòng ×1,5.
    expect(state.score - before).toBe(1 + 15 + baseBonus * 2)
  })

  it("leaves v1 games on the fixed bonus", () => {
    const state = gameReducer(oneDotFromClear(createNewGame(11)), { type: "PLACE_PIECE", slot: 0, row: 0, col: 0 })
    expect(state.rulesVersion).toBeUndefined()
    expect(state.lastMove?.perfectChain).toBeUndefined()
    expect(state.lastMove?.points).toBe(1 + 10 + SCORING_RULES.boardClearBonus)
  })

  it("replays a v2 game to the same score only under v2 rules", () => {
    let state = createNewGame(424242, { rulesVersion: 2 })
    const actions: RecordedGameAction[] = []
    while (!state.isGameOver && actions.length < 120) {
      const move = firstMove(state)
      if (!move) break
      state = gameReducer(state, move)
      actions.push(move)
    }
    const v2 = replayRecordedGame({ seed: 424242, stashUnlocked: false, variant: { rulesVersion: 2 } }, actions)
    expect(v2.ok && v2.summary.score).toBe(state.score)
    const v1 = replayRecordedGame({ seed: 424242, stashUnlocked: false }, actions)
    expect(v1.ok && v1.summary.score === state.score).toBe(false)
  })
})

function firstMove(state: GameState): Extract<GameAction, { type: "PLACE_PIECE" }> | null {
  for (let slot = 0; slot < state.tray.length; slot++) {
    const shape = state.tray[slot] && findShape(state.tray[slot]!.shapeId)
    if (!shape) continue
    for (let row = 0; row < BOARD_SIZE; row++)
      for (let col = 0; col < BOARD_SIZE; col++) if (canPlace(state.board, shape, row, col)) return { type: "PLACE_PIECE", slot, row, col }
  }
  return null
}
