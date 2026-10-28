import { describe, expect, it } from "vitest"

import { parseSavedGame } from "../store/saved-game-schema"
import { createNewGame, gameReducer } from "./game-state-reducer"
import { BOARD_SIZE } from "./game-types"
import { POWER_UP_RULES } from "./power-up-rules"

describe("replace tray", () => {
  it("spends one charge per use, keeps board and score, then refuses", () => {
    let state = createNewGame(42)
    expect(state.replaceCharges).toBe(POWER_UP_RULES.replaceChargesPerGame)
    for (let used = 1; used <= POWER_UP_RULES.replaceChargesPerGame; used++) {
      const next = gameReducer(state, { type: "REPLACE_TRAY" })
      expect(next.replaceCharges).toBe(POWER_UP_RULES.replaceChargesPerGame - used)
      expect(next.nextPieceUid).toBe(state.nextPieceUid + 3)
      expect(next.board).toEqual(state.board)
      expect(next.score).toBe(state.score)
      state = next
    }
    expect(gameReducer(state, { type: "REPLACE_TRAY" })).toBe(state)
  })
})

describe("revive", () => {
  it("clears the fullest rows and columns once, keeps the score, and deals a playable tray", () => {
    const board = new Array(64).fill(1)
    // Hàng 0 và cột 7 thưa hơn → không được chọn để xoá.
    for (let i = 0; i < 4; i++) {
      board[i] = 0
      board[(i + 2) * BOARD_SIZE + 7] = 0
    }
    const base = { ...createNewGame(42), board, score: 900, combo: 3, isGameOver: true }
    const result = gameReducer(base, { type: "REVIVE" })
    const clearedRows = Array.from({ length: BOARD_SIZE }, (_, row) => row).filter((row) =>
      Array.from({ length: BOARD_SIZE }, (_, col) => result.board[row * BOARD_SIZE + col]).every((cell) => cell === 0))
    expect(clearedRows).toHaveLength(POWER_UP_RULES.reviveRows)
    expect(clearedRows).not.toContain(0)
    expect(result.score).toBe(900)
    expect(result.combo).toBe(0)
    expect(result.reviveUsed).toBe(true)
    expect(result.isGameOver).toBe(false)
    expect(result.tray.every(Boolean)).toBe(true)

    const overAgain = { ...result, isGameOver: true }
    expect(gameReducer(overAgain, { type: "REVIVE" })).toBe(overAgain)
    expect(gameReducer(base, { type: "REPLACE_TRAY" })).toBe(base)
  })

  it("does nothing while the game is still running", () => {
    const state = createNewGame(1)
    expect(gameReducer(state, { type: "REVIVE" })).toBe(state)
  })

  it("keeps charges and revive availability through a placement and save", () => {
    const base = { ...createNewGame(42), replaceCharges: 0, reviveUsed: true, tray: [{ uid: 10, shapeId: "dot", colorId: 1 }, null, null] }
    const moved = gameReducer(base, { type: "PLACE_PIECE", slot: 0, row: 0, col: 0 })
    expect(moved.replaceCharges).toBe(0)
    expect(moved.reviveUsed).toBe(true)
    const saved = parseSavedGame(JSON.parse(JSON.stringify({ game: moved, best: 900 }))).game!
    expect(saved.replaceCharges).toBe(0)
    expect(saved.reviveUsed).toBe(true)
  })
})
