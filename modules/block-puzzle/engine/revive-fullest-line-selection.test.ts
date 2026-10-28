import { describe, expect, it } from "vitest"

import { createNewGame, gameReducer, hasAnyMove } from "./game-state-reducer"
import { BOARD_SIZE, type GameState } from "./game-types"

/** Bàn kỳ vọng sau khi xoá các hàng `rows` và cột `cols` (không tính điểm). */
function expectedAfterRevive(board: readonly number[], rows: number[], cols: number[]): number[] {
  return board.map((cell, index) => (rows.includes(Math.floor(index / BOARD_SIZE)) || cols.includes(index % BOARD_SIZE) ? 0 : cell))
}

/** Bàn 8x8 với ô (row, col) có khối khi `fill` trả true. */
function boardFrom(fill: (row: number, col: number) => boolean): number[] {
  return Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => (fill(Math.floor(index / BOARD_SIZE), index % BOARD_SIZE) ? 1 : 0))
}

/** Ván đã thua, sẵn sàng hồi sinh. */
function gameOverOn(board: number[], extra: Partial<GameState> = {}): GameState {
  return { ...createNewGame(42), board, score: 900, combo: 3, isGameOver: true, ...extra }
}

describe("revive line selection", () => {
  it("clears the two central full rows and columns on a full board", () => {
    // Mọi hàng/cột đều đầy: tie-break theo độ gần tâm → hàng 3,4 và cột 3,4.
    const state = gameOverOn(boardFrom(() => true))
    const result = gameReducer(state, { type: "REVIVE" })
    expect(result.board).toEqual(expectedAfterRevive(state.board, [3, 4], [3, 4]))
    expect(result.board.filter((cell) => cell === 0)).toHaveLength(28)
    expect(result.score).toBe(state.score)
    expect(result.reviveUsed).toBe(true)
  })

  it("ranks lines by filled count before centrality", () => {
    // Hàng 1 và 6 đầy 6 ô (cột 0..5) nên được chọn dù lệch tâm.
    const state = gameOverOn(boardFrom((row, col) => (row === 1 || row === 6) && col < 6))
    const result = gameReducer(state, { type: "REVIVE" })
    // Cột 0..5 đều có 2 ô; hai cột gần tâm nhất là 3 và 4.
    expect(result.board).toEqual(expectedAfterRevive(state.board, [1, 6], [3, 4]))
  })

  it("breaks ties by centrality, then by lower index", () => {
    // Hàng 0, 3, 7 cùng 4 ô (cột 0..3): hàng 3 gần tâm nhất, rồi hàng 0 trước hàng 7.
    const state = gameOverOn(boardFrom((row, col) => [0, 3, 7].includes(row) && col < 4))
    const result = gameReducer(state, { type: "REVIVE" })
    // Cột 0..3 cùng 3 ô: cột 3 và cột 2 gần tâm nhất.
    expect(result.board).toEqual(expectedAfterRevive(state.board, [3, 0], [3, 2]))
  })

  it.each([0, 2000, 6000])("never leaves a revived full board immediately game over (score %i)", (score) => {
    for (let seed = 1; seed <= 30; seed++) {
      const state = gameOverOn(boardFrom(() => true), {
        score,
        rngState: seed,
        stash: { uid: 200, shapeId: "line5-r0", colorId: 2 },
        stashUnlocked: true,
      })
      const result = gameReducer(state, { type: "REVIVE" })
      expect(result.isGameOver).toBe(false)
      expect(result.tray.every(Boolean)).toBe(true)
      expect(hasAnyMove(result.board, result.tray, result.stash)).toBe(true)
    }
  })
})
