import { describe, expect, it } from "vitest"

import { cellIndex } from "../engine/board-grid-operations"
import { createNewGame, STASH_SLOT } from "../engine/game-state-reducer"
import { BOARD_SIZE, type GameState } from "../engine/game-types"
import { findShape } from "../engine/piece-shape-catalog"
import { computeDragState } from "../input/pointer-drag-controller"
import { computeLayout, computeSnapCell, hitTestStash, hitTestTraySlot, trayPieceOrigin } from "./canvas-layout-metrics"
import { computePlacementPreview } from "./drag-placement-preview"

describe("computeLayout", () => {
  it.each([
    [360, 600],
    [414, 820],
    [1440, 900],
    [500, 300],
  ])("fits board + tray inside %ix%i", (width, height) => {
    const layout = computeLayout(width, height, 2)
    const trayBottom = layout.traySlots[0].y + layout.traySlots[0].height
    expect(layout.cellSize).toBeGreaterThan(0)
    expect(layout.board.x).toBeGreaterThanOrEqual(0)
    expect(layout.board.x + layout.board.width).toBeLessThanOrEqual(width)
    expect(layout.board.y).toBeGreaterThanOrEqual(0)
    expect(trayBottom).toBeLessThanOrEqual(height)
    expect(layout.board.width).toBe(layout.cellSize * BOARD_SIZE)
  })

  it("caps DPR and never goes below 1", () => {
    expect(computeLayout(400, 700, 4).dpr).toBe(2.5)
    expect(computeLayout(400, 700, 0.5).dpr).toBe(1)
  })

  it.each([
    [390, 780],
    [1920, 1000],
  ])("stacks board, tray and stash without overlap and keeps the stash on screen at %ix%i", (width, height) => {
    const layout = computeLayout(width, height)
    const boardBottom = layout.board.y + layout.board.height
    const tray = layout.traySlots
    expect(Number.isInteger(layout.cellSize)).toBe(true)
    expect(tray[0].y).toBeGreaterThan(boardBottom)
    expect(tray[0].x).toBeCloseTo(layout.board.x)
    expect(tray[2].x + tray[2].width).toBeCloseTo(layout.board.x + layout.board.width)
    expect(layout.stash.y).toBeGreaterThanOrEqual(tray[0].y + tray[0].height)
    expect(layout.stash.y + layout.stash.height).toBeLessThanOrEqual(height)
    expect(hitTestStash(layout, layout.stash.x + layout.stash.width / 2, layout.stash.y + layout.stash.height / 2)).toBe(true)
    expect(hitTestStash(layout, layout.board.x, layout.board.y)).toBe(false)
    // Hàng dưới khay: "Cất" bên trái, nút "Đổi khối" bên phải, không chồng nhau, cùng hàng, trong bề ngang bàn.
    expect(layout.stash.x).toBeCloseTo(layout.board.x)
    expect(layout.swapButton.y).toBeCloseTo(layout.stash.y)
    expect(layout.swapButton.x).toBeGreaterThan(layout.stash.x + layout.stash.width)
    expect(layout.swapButton.x + layout.swapButton.width).toBeCloseTo(layout.board.x + layout.board.width)
    expect(hitTestStash(layout, layout.swapButton.x + 2, layout.swapButton.y + 2)).toBe(false)
  })

  it("leaves room for the largest tray piece inside its slot", () => {
    const layout = computeLayout(390, 780)
    const pieceWidth = 5 * layout.cellSize * layout.trayScale
    expect(pieceWidth).toBeLessThanOrEqual(layout.traySlots[0].width)
  })

  it("handles a zero-size container without NaN", () => {
    const layout = computeLayout(0, 0, 1)
    expect(layout.cellSize).toBe(0)
    expect(Number.isNaN(layout.board.x)).toBe(false)
  })
})

describe("hit testing + snapping", () => {
  const layout = computeLayout(400, 720, 1)

  it("maps tray slot centers to slot indexes and the board to -1", () => {
    layout.traySlots.forEach((slot, index) => {
      expect(hitTestTraySlot(layout, slot.x + slot.width / 2, slot.y + slot.height / 2)).toBe(index)
    })
    expect(hitTestTraySlot(layout, layout.board.x + 5, layout.board.y + 5)).toBe(-1)
  })

  it("snaps to the nearest integer cell", () => {
    const { x, y } = layout.board
    const c = layout.cellSize
    expect(computeSnapCell(layout, x + 2 * c + c * 0.4, y + 3 * c - c * 0.4)).toEqual({ row: 3, col: 2 })
  })

  it("centers tray pieces inside their slot", () => {
    const shape = findShape("square2")!
    const origin = trayPieceOrigin(layout, 1, shape)
    const slot = layout.traySlots[1]
    const size = 2 * layout.cellSize * layout.trayScale
    expect(origin.x + size / 2).toBeCloseTo(slot.x + slot.width / 2)
    expect(origin.y + size / 2).toBeCloseTo(slot.y + slot.height / 2)
  })
})

describe("computeDragState + preview", () => {
  const layout = computeLayout(400, 720, 1)
  const c = layout.cellSize

  function stateWithDot(): GameState {
    const base = createNewGame(1)
    const board = [...base.board]
    for (let col = 1; col < BOARD_SIZE; col++) board[cellIndex(0, col)] = 3
    return { ...base, board, tray: [{ uid: 1, shapeId: "dot", colorId: 5 }, null, null] }
  }

  it("snaps a valid drop and previews the row it would clear", () => {
    const game = stateWithDot()
    const drag = computeDragState(layout, game, 0, 1, layout.board.x + c / 2, layout.board.y + c / 2, 0)
    expect(drag?.snap).toEqual({ row: 0, col: 0 })
    const preview = computePlacementPreview(game, drag)
    expect(preview).toEqual({ colorId: 5, ghostCells: [0], rows: [0], cols: [] })
  })

  it("has no snap over an occupied cell or outside the board", () => {
    const game = stateWithDot()
    expect(computeDragState(layout, game, 0, 1, layout.board.x + c * 1.5, layout.board.y + c / 2, 0)?.snap).toBeNull()
    expect(computeDragState(layout, game, 0, 1, -100, -100, 0)?.snap).toBeNull()
  })

  it("applies touch lift so the piece sits above the finger", () => {
    const game = stateWithDot()
    const drag = computeDragState(layout, game, 0, 1, layout.board.x + c / 2, layout.board.y + c * 2.1, c * 2)
    expect(drag?.snap).toEqual({ row: 0, col: 0 })
  })

  it("returns null for an empty slot", () => {
    expect(computeDragState(layout, stateWithDot(), 1, 1, 0, 0, 0)).toBeNull()
  })

  it("previews and validates a stashed piece from the stash slot", () => {
    const game = stateWithDot()
    game.stash = game.tray[0]
    game.stashUnlocked = true
    game.tray = [null, null, null]
    const drag = computeDragState(layout, game, STASH_SLOT, 1, layout.board.x + c / 2, layout.board.y + c / 2, 0)
    expect(drag?.snap).toEqual({ row: 0, col: 0 })
    expect(computePlacementPreview(game, drag)?.rows).toEqual([0])
    expect(computeDragState(layout, game, STASH_SLOT, 1, 0, 0, 0, 999)).toBeNull()
  })

  it("cancels when the slot now holds a different piece or the game is over", () => {
    const game = stateWithDot()
    expect(computeDragState(layout, game, 0, 1, 0, 0, 0, 1)?.uid).toBe(1)
    expect(computeDragState(layout, game, 0, 1, 0, 0, 0, 999)).toBeNull()
    expect(computeDragState(layout, { ...game, isGameOver: true }, 0, 1, 0, 0, 0)).toBeNull()
  })
})
