import { describe, expect, it } from "vitest"

import { dealAdaptiveTray, dealerDifficulty } from "./adaptive-tray-dealer"
import { canShapeFitAnywhere, cellIndex, createEmptyBoard } from "./board-grid-operations"
import { BOARD_SIZE } from "./game-types"
import { findShape } from "./piece-shape-catalog"
import { clearsLineImmediately } from "./tray-solvability-search"

/** Bàn có 2 hàng gần đầy (thiếu 2 ô cuối) → nhiều khối xoá được dòng ngay. */
function nearlyFullRows(): number[] {
  const board = [...createEmptyBoard()]
  for (const row of [6, 7]) for (let col = 0; col < BOARD_SIZE - 2; col++) board[cellIndex(row, col)] = 3
  return board
}

/** Đếm qua nhiều lần chia: tỉ lệ khối to (tier 3) và tỉ lệ khối xoá được dòng ngay. */
function sample(score: number, deals = 400) {
  const board = nearlyFullRows()
  let large = 0
  let helpers = 0
  let pieces = 0
  for (let index = 0; index < deals; index++) {
    const { tray } = dealAdaptiveTray(board, score, 1000 + index * 7919, 1)
    for (const piece of tray) {
      const shape = findShape(piece.shapeId)!
      pieces++
      if (shape.tier === 3) large++
      if (clearsLineImmediately(board, shape)) helpers++
    }
  }
  return { large: large / pieces, helpers: helpers / pieces }
}

describe("dealAdaptiveTray", () => {
  it("is deterministic for the same rng state", () => {
    const board = nearlyFullRows()
    expect(dealAdaptiveTray(board, 500, 77, 10)).toEqual(dealAdaptiveTray(board, 500, 77, 10))
  })

  it("grows difficulty with score", () => {
    expect(dealerDifficulty(0)).toBe(0)
    expect(dealerDifficulty(3000)).toBeGreaterThan(dealerDifficulty(1000))
    expect(dealerDifficulty(100_000)).toBeLessThanOrEqual(1)
  })

  it("deals more line-clearing pieces at low score and more large pieces at high score", () => {
    const low = sample(0)
    const high = sample(20_000)
    expect(low.helpers).toBeGreaterThan(high.helpers)
    expect(high.large).toBeGreaterThan(low.large * 2)
    // Điểm cao vẫn còn khối gỡ bàn.
    expect(high.helpers).toBeGreaterThan(0.15)
  })

  it("prefers the piece that empties the board when one exists", () => {
    const board = [...createEmptyBoard()]
    for (let col = 0; col < BOARD_SIZE - 3; col++) board[cellIndex(0, col)] = 4
    let perfect = 0
    for (let index = 0; index < 200; index++) {
      const { tray } = dealAdaptiveTray(board, 0, index * 104729, 1)
      if (tray.some((piece) => piece.shapeId === "line3" || piece.shapeId.startsWith("line3-"))) perfect++
    }
    expect(perfect / 200).toBeGreaterThan(0.5)
  })

  it("rescues a tray where nothing fits", () => {
    const board = Array.from({ length: 64 }, () => 5)
    board[cellIndex(3, 3)] = 0
    for (let index = 0; index < 50; index++) {
      const { tray } = dealAdaptiveTray(board, 50_000, index * 31, 1)
      expect(tray.some((piece) => canShapeFitAnywhere(board, findShape(piece.shapeId)!))).toBe(true)
    }
  })
})
