import { describe, expect, it } from "vitest"

import {
  canPlace,
  canShapeFitAnywhere,
  cellIndex,
  clearLines,
  createEmptyBoard,
  findFullLines,
  isBoardEmpty,
  placeCells,
} from "./board-grid-operations"
import { BOARD_SIZE } from "./game-types"
import { findShape } from "./piece-shape-catalog"

const square2 = findShape("square2")!
const dot = findShape("dot")!

function fillRow(board: number[], row: number, exceptCol?: number) {
  for (let c = 0; c < BOARD_SIZE; c++) if (c !== exceptCol) board[cellIndex(row, c)] = 1
}

function fillCol(board: number[], col: number, exceptRow?: number) {
  for (let r = 0; r < BOARD_SIZE; r++) if (r !== exceptRow) board[cellIndex(r, col)] = 1
}

describe("canPlace", () => {
  it("accepts in-bounds placement on empty cells", () => {
    expect(canPlace(createEmptyBoard(), square2, 0, 0)).toBe(true)
    expect(canPlace(createEmptyBoard(), square2, 6, 6)).toBe(true)
  })

  it("rejects out of bounds", () => {
    const board = createEmptyBoard()
    expect(canPlace(board, square2, 7, 0)).toBe(false)
    expect(canPlace(board, square2, 0, 7)).toBe(false)
    expect(canPlace(board, square2, -1, 0)).toBe(false)
  })

  it("rejects overlap", () => {
    const board = createEmptyBoard()
    board[cellIndex(1, 1)] = 3
    expect(canPlace(board, square2, 0, 0)).toBe(false)
    expect(canPlace(board, square2, 2, 2)).toBe(true)
  })
})

describe("placeCells", () => {
  it("writes color without mutating input", () => {
    const board = createEmptyBoard()
    const result = placeCells(board, square2, 3, 4, 5)
    expect(result.placedCells).toEqual([cellIndex(3, 4), cellIndex(3, 5), cellIndex(4, 4), cellIndex(4, 5)])
    expect(result.placedCells.every((i) => result.board[i] === 5)).toBe(true)
    expect(isBoardEmpty(board)).toBe(true)
  })
})

describe("findFullLines + clearLines", () => {
  it("detects rows and columns", () => {
    const board = createEmptyBoard()
    fillRow(board, 2)
    fillCol(board, 5)
    expect(findFullLines(board)).toEqual({ rows: [2], cols: [5] })
  })

  it("clears row and column together, counting the intersection once", () => {
    const board = createEmptyBoard()
    fillRow(board, 2)
    fillCol(board, 5)
    const { board: next, clearedCells } = clearLines(board, [2], [5])
    expect(clearedCells).toHaveLength(BOARD_SIZE * 2 - 1)
    expect(isBoardEmpty(next)).toBe(true)
  })

  it("ignores rows with a gap", () => {
    const board = createEmptyBoard()
    fillRow(board, 0, 3)
    expect(findFullLines(board)).toEqual({ rows: [], cols: [] })
  })
})

describe("canShapeFitAnywhere", () => {
  it("finds the only gap", () => {
    const board = new Array(BOARD_SIZE * BOARD_SIZE).fill(1)
    board[cellIndex(7, 7)] = 0
    expect(canShapeFitAnywhere(board, dot)).toBe(true)
    expect(canShapeFitAnywhere(board, square2)).toBe(false)
  })
})
