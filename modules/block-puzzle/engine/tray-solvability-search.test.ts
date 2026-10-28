import { describe, expect, it } from "vitest"

import { cellIndex, createEmptyBoard } from "./board-grid-operations"
import { BOARD_SIZE, type ShapeDef } from "./game-types"
import { findShape } from "./piece-shape-catalog"
import { TRAY_GENERATOR_CONFIG } from "./tray-generator-config"
import { bestPlacement, canPlaceAllInSomeOrder, clearsLineImmediately, listPlacements, simulatePlacement } from "./tray-solvability-search"

const shape = (id: string): ShapeDef => findShape(id)!
const dots = (count: number): ShapeDef[] => Array.from({ length: count }, () => shape("dot"))
const fullBoard = (): number[] => new Array<number>(BOARD_SIZE * BOARD_SIZE).fill(1)

/** Bàn đầy trừ các ô `holes` (chỉ số phẳng). */
function boardWithHoles(holes: number[]): number[] {
  const board = fullBoard()
  for (const index of holes) board[index] = 0
  return board
}

/** Hàng 0 chỉ trống cột 0..2, phần còn lại đầy. */
const topGapBoard = (): number[] => boardWithHoles([cellIndex(0, 0), cellIndex(0, 1), cellIndex(0, 2)])

/** Bàn xen kẽ: ô trống không kề nhau, không có đoạn 2 ô trống liên tiếp nào. */
function checkerboard(): number[] {
  return Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, i) => ((Math.floor(i / BOARD_SIZE) + (i % BOARD_SIZE)) % 2 === 1 ? 1 : 0))
}

describe("canPlaceAllInSomeOrder edge cases", () => {
  it("treats an empty shape list as trivially placeable, even on a full board with zero budget", () => {
    expect(canPlaceAllInSomeOrder(fullBoard(), [], 0)).toBe(true)
  })

  it("returns false, not unknown, when a shape has no legal spot at all", () => {
    expect(canPlaceAllInSomeOrder(checkerboard(), [shape("line5-r0")], 0)).toBe(false)
  })

  it("rejects a duplicate pair on a full board", () => {
    expect(canPlaceAllInSomeOrder(fullBoard(), [shape("dot"), shape("dot")], 100)).toBe(false)
  })

  it("returns unknown when the budget runs out before the search is decided", () => {
    const fiveSquares = Array.from({ length: 5 }, () => shape("square3"))
    expect(canPlaceAllInSomeOrder(createEmptyBoard(), fiveSquares, TRAY_GENERATOR_CONFIG.solvabilitySearchBudget)).toBe("unknown")
  })

  it("returns unknown with zero budget when a shape does have a legal spot", () => {
    expect(canPlaceAllInSomeOrder(createEmptyBoard(), [shape("dot")], 0)).toBe("unknown")
  })

  it("budget boundary is exact: three dots need three attempts", () => {
    expect(canPlaceAllInSomeOrder(createEmptyBoard(), dots(3), 3)).toBe(true)
    expect(canPlaceAllInSomeOrder(createEmptyBoard(), dots(3), 2)).toBe("unknown")
  })

  it("proves an impossible tray false once the budget is large enough", () => {
    // Tối đa 4 khối 3x3 không chồng nhau trên bàn 8x8, nên 5 khối là bất khả thi.
    const fiveSquares = Array.from({ length: 5 }, () => shape("square3"))
    expect(canPlaceAllInSomeOrder(createEmptyBoard(), fiveSquares, 1_000_000)).toBe(false)
  })

  it("accepts a tray that is solvable only because line clears free cells mid-sequence", () => {
    const board = topGapBoard()
    expect(board.filter((cell) => cell === 0)).toHaveLength(3)
    // 4 ô khối nhưng chỉ 3 ô trống: chỉ đúng nếu xoá dòng giải phóng ô giữa chừng.
    expect(canPlaceAllInSomeOrder(board, dots(4), TRAY_GENERATOR_CONFIG.solvabilitySearchBudget)).toBe(true)
  })

  it("gives the same answer regardless of tray order", () => {
    const trays = [
      [shape("line3-r0"), shape("dot"), shape("square2")],
      [shape("dot"), shape("line2-r1"), shape("line3-r0"), shape("dot")],
    ]
    const boards = [topGapBoard(), checkerboard(), boardWithHoles([cellIndex(0, 7), cellIndex(3, 0), cellIndex(7, 4)])]
    for (const board of boards)
      for (const tray of trays) {
        const forward = canPlaceAllInSomeOrder(board, tray, 100_000)
        expect(forward).not.toBe("unknown")
        expect(canPlaceAllInSomeOrder(board, [...tray].reverse(), 100_000)).toBe(forward)
      }
  })
})

describe("placement helpers", () => {
  it("lists no placements on a full board and all 64 row-major for a dot on an empty board", () => {
    expect(listPlacements(fullBoard(), shape("dot"))).toEqual([])
    const all = listPlacements(createEmptyBoard(), shape("dot"))
    expect(all).toHaveLength(64)
    expect(all[0]).toEqual({ row: 0, col: 0 })
    expect(all[63]).toEqual({ row: 7, col: 7 })
  })

  it("bestPlacement is null when nothing fits and prefers the first of equally good spots", () => {
    expect(bestPlacement(fullBoard(), shape("dot"))).toBeNull()
    // Hàng 0 thiếu (0,7) và hàng 3 thiếu (3,0): mỗi lỗ hoàn thành đúng 1 dòng. Hoà thì lấy (0,7) vì đứng trước.
    const board = createEmptyBoard()
    for (let col = 0; col < BOARD_SIZE - 1; col++) board[cellIndex(0, col)] = 1
    for (let col = 1; col < BOARD_SIZE; col++) board[cellIndex(3, col)] = 1
    expect(bestPlacement(board, shape("dot"))).toMatchObject({ row: 0, col: 7, linesCleared: 1 })
  })

  it("clearsLineImmediately is false on an empty board and true when one hole completes a line", () => {
    expect(clearsLineImmediately(createEmptyBoard(), shape("dot"))).toBe(false)
    expect(clearsLineImmediately(boardWithHoles([cellIndex(0, 7)]), shape("dot"))).toBe(true)
  })

  it("simulatePlacement counts cleared lines without mutating the input board", () => {
    // Chỉ hàng 0 có 7/8 ô: đặt dot vào (0,7) xoá đúng hàng 0, các cột không đầy.
    const board = createEmptyBoard()
    for (let col = 0; col < BOARD_SIZE - 1; col++) board[cellIndex(0, col)] = 1
    board[cellIndex(5, 5)] = 1
    const snapshot = [...board]
    const result = simulatePlacement(board, shape("dot"), 0, 7)
    expect(result.linesCleared).toBe(1)
    expect(board).toEqual(snapshot)
    expect(result.board.slice(0, BOARD_SIZE).every((cell) => cell === 0)).toBe(true)
    expect(result.board[cellIndex(5, 5)]).toBe(1)
  })
})
