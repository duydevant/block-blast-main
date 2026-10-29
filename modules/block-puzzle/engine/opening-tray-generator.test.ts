import { describe, expect, it } from "vitest"

import { placeRowsAndClear, placementsRows, shapeRows, toBoardRows, type BoardRows } from "./board-bitmask-operations"
import { createEmptyBoard } from "./board-grid-operations"
import { createNewGame } from "./game-state-reducer"
import type { ShapeDef } from "./game-types"
import { OPENING_TRAYS } from "./opening-tray-generator"
import { findShape } from "./piece-shape-catalog"
import { dealTray } from "./piece-tray-generator"

/** Nhiều dòng nhất xoá được khi đặt lần lượt các khối (đúng luật ván: đầy là nổ ngay). */
function bestLines(board: BoardRows, shapes: readonly ShapeDef[]): number {
  if (shapes.length === 0) return 0
  let best = 0
  shapes.forEach((shape, index) => {
    const rest = shapes.filter((_, other) => other !== index)
    for (const [row, col] of placementsRows(board, shape)) {
      const placed = placeRowsAndClear(board, shapeRows(shape), row, col)
      best = Math.max(best, placed.linesCleared + bestLines(placed.rows, rest))
      if (best >= 3) return
    }
  })
  return best
}

describe("opening tray", () => {
  it("every opening set can clear at least two lines on an empty board", () => {
    const empty = toBoardRows(createEmptyBoard())
    for (const ids of OPENING_TRAYS) {
      const shapes = ids.map((id) => findShape(id)!)
      expect(shapes.every(Boolean), ids.join(" ")).toBe(true)
      expect(bestLines(empty, shapes), ids.join(" ")).toBeGreaterThanOrEqual(2)
    }
  })

  it("is deterministic per seed but varies between games", () => {
    const opening = (seed: number) => createNewGame(seed).tray.map((piece) => piece!.shapeId)
    expect(opening(42)).toEqual(opening(42))
    const kinds = new Set(Array.from({ length: 200 }, (_, seed) => [...opening(seed * 7919)].sort().join(" ")))
    expect(kinds.size).toBeGreaterThan(12)
    const allowed = new Set(OPENING_TRAYS.map((ids) => [...ids].sort().join(" ")))
    for (const kind of kinds) expect(allowed.has(kind)).toBe(true)
  })

  it("keeps the board-aware dealer for prebuilt level boards", () => {
    const startBoard = createEmptyBoard()
    startBoard[63] = 1
    expect(createNewGame(7, { startBoard }).tray).toEqual(dealTray(startBoard, 0, 7, 1).tray)
    // Màn chơi bàn trống (có giới hạn nước) được thiết kế theo seed → giữ khay cũ.
    expect(createNewGame(7, { moveLimit: 20 }).tray).toEqual(dealTray(createEmptyBoard(), 0, 7, 1).tray)
  })
})
