import { describe, expect, it } from "vitest"

import { placeRowsAndClear, placementsRows, shapeRows, toBoardRows } from "./board-bitmask-operations"
import { SHAPE_CATALOG } from "./piece-shape-catalog"
import { nextRandomInt } from "./seeded-random-generator"
import { listPlacements, simulatePlacement } from "./tray-solvability-search"

function randomBoard(seed: number, ratio: number): number[] {
  let state = seed
  return Array.from({ length: 64 }, () => {
    const [roll, next] = nextRandomInt(state, 100)
    state = next
    return roll < ratio * 100 ? 3 : 0
  })
}

describe("board bitmask operations match the array implementation", () => {
  it("lists the same placements and produces the same board + line count", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const board = randomBoard(seed, 0.55)
      const rows = toBoardRows(board)
      for (const shape of SHAPE_CATALOG) {
        const expected = listPlacements(board, shape).map(({ row, col }) => [row, col])
        expect(placementsRows(rows, shape)).toEqual(expected)
        for (const [row, col] of expected) {
          const slow = simulatePlacement(board, shape, row, col)
          const fast = placeRowsAndClear(rows, shapeRows(shape), row, col)
          expect(fast.linesCleared).toBe(slow.linesCleared)
          expect(fast.rows).toEqual(toBoardRows(slow.board))
        }
      }
    }
  })

  it("clears a row and a column through their intersection", () => {
    const board = new Array(64).fill(0)
    for (let i = 1; i < 8; i++) {
      board[i] = 1
      board[i * 8] = 1
    }
    const dot = SHAPE_CATALOG.find((shape) => shape.id === "dot")!
    const result = placeRowsAndClear(toBoardRows(board), shapeRows(dot), 0, 0)
    expect(result.linesCleared).toBe(2)
    expect(result.rows.every((row) => row === 0)).toBe(true)
  })
})
