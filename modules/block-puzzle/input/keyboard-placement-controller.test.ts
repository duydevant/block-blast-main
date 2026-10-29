import { describe, expect, it } from "vitest"

import { cellIndex } from "../engine/board-grid-operations"
import { createNewGame, gameReducer } from "../engine/game-state-reducer"
import { BOARD_SIZE, STASH_SLOT, type GameState } from "../engine/game-types"
import { computeLayout } from "../render/canvas-layout-metrics"
import { computePlacementPreview } from "../render/drag-placement-preview"
import {
  KEYBOARD_POINTER_ID,
  keyboardCommandForKey,
  keyboardDragState,
  normalizeKeyboardCursor,
  selectableSlots,
} from "./keyboard-placement-controller"

/** Hàng 0 đầy trừ ô (0,0); khay: chấm, vuông 2x2, thanh ngang 2. */
function game(overrides: Partial<GameState> = {}): GameState {
  const base = createNewGame(7)
  const board = [...base.board]
  for (let col = 1; col < BOARD_SIZE; col++) board[cellIndex(0, col)] = 3
  return {
    ...base,
    board,
    tray: [
      { uid: 1, shapeId: "dot", colorId: 5 },
      { uid: 2, shapeId: "square2", colorId: 2 },
      { uid: 3, shapeId: "line2-r0", colorId: 4 },
    ],
    ...overrides,
  }
}

describe("keyboardCommandForKey", () => {
  it("selects a piece with 1/2/3 and centres it on the board", () => {
    expect(keyboardCommandForKey(game(), null, "2")).toEqual({ kind: "cursor", cursor: { slot: 1, row: 3, col: 3 } })
    expect(keyboardCommandForKey(game({ tray: [null, null, null] }), null, "1")).toEqual({ kind: "invalid" })
  })

  it("moves with arrows and clamps to the board for the piece size", () => {
    const cursor = { slot: 1, row: 6, col: 6 }
    expect(keyboardCommandForKey(game(), cursor, "ArrowDown")).toEqual({ kind: "cursor", cursor })
    expect(keyboardCommandForKey(game(), cursor, "ArrowRight")).toEqual({ kind: "cursor", cursor })
    expect(keyboardCommandForKey(game(), cursor, "ArrowUp")).toEqual({ kind: "cursor", cursor: { slot: 1, row: 5, col: 6 } })
    const corner = { slot: 0, row: 0, col: 0 }
    expect(keyboardCommandForKey(game(), corner, "ArrowLeft")).toEqual({ kind: "cursor", cursor: corner })
  })

  it("starts with the first piece when an arrow is pressed without a selection", () => {
    expect(keyboardCommandForKey(game(), null, "ArrowLeft")).toMatchObject({ kind: "cursor", cursor: { slot: 0 } })
  })

  it("cycles pieces with Tab / Shift+Tab but lets Tab leave the canvas when nothing is selected", () => {
    const cursor = { slot: 2, row: 0, col: 0 }
    expect(keyboardCommandForKey(game(), cursor, "Tab")).toMatchObject({ kind: "cursor", cursor: { slot: 0 } })
    expect(keyboardCommandForKey(game(), cursor, "Tab", true)).toMatchObject({ kind: "cursor", cursor: { slot: 1 } })
    expect(keyboardCommandForKey(game(), null, "Tab")).toEqual({ kind: "none" })
  })

  it("places only where the piece fits", () => {
    expect(keyboardCommandForKey(game(), { slot: 0, row: 0, col: 0 }, "Enter")).toEqual({ kind: "place", slot: 0, row: 0, col: 0 })
    expect(keyboardCommandForKey(game(), { slot: 0, row: 0, col: 1 }, " ")).toEqual({ kind: "invalid" })
  })

  it("stashes and replaces only when power-ups are allowed", () => {
    const cursor = { slot: 1, row: 3, col: 3 }
    expect(keyboardCommandForKey(game(), cursor, "s")).toEqual({ kind: "invalid" })
    expect(keyboardCommandForKey(game({ stashUnlocked: true }), cursor, "S")).toEqual({ kind: "stash", slot: 1 })
    expect(keyboardCommandForKey(game({ stashUnlocked: true, noPowerUps: true }), cursor, "s")).toEqual({ kind: "invalid" })
    expect(keyboardCommandForKey(game(), null, "r")).toEqual({ kind: "replace" })
    expect(keyboardCommandForKey(game({ noPowerUps: true }), null, "r")).toEqual({ kind: "none" })
  })

  it("cancels with Escape and ignores keys after game over", () => {
    expect(keyboardCommandForKey(game(), { slot: 0, row: 0, col: 0 }, "Escape")).toEqual({ kind: "cursor", cursor: null })
    expect(keyboardCommandForKey(game({ isGameOver: true }), null, "1")).toEqual({ kind: "none" })
  })
})

describe("normalizeKeyboardCursor", () => {
  it("moves to the next remaining piece after the selected one is placed", () => {
    const before = game()
    const after = gameReducer(before, { type: "PLACE_PIECE", slot: 0, row: 0, col: 0 })
    expect(after).not.toBe(before)
    expect(normalizeKeyboardCursor(after, { slot: 0, row: 0, col: 0 })?.slot).toBe(1)
  })

  it("exits keyboard mode on game over", () => {
    expect(normalizeKeyboardCursor(game({ isGameOver: true }), { slot: 0, row: 0, col: 0 })).toBeNull()
  })

  it("includes the stash only once it is unlocked", () => {
    const stash = { uid: 9, shapeId: "dot", colorId: 1 }
    expect(selectableSlots(game({ stash }))).toEqual([0, 1, 2])
    expect(selectableSlots(game({ stash, stashUnlocked: true }))).toEqual([0, 1, 2, STASH_SLOT])
  })
})

describe("keyboardDragState", () => {
  const layout = computeLayout(400, 720, 1)

  it("draws the piece on the board cell and previews the line it would clear", () => {
    const state = game()
    const drag = keyboardDragState(layout, state, { slot: 0, row: 0, col: 0 })
    expect(drag).toMatchObject({ slot: 0, uid: 1, pointerId: KEYBOARD_POINTER_ID, pieceX: layout.board.x, snap: { row: 0, col: 0 } })
    expect(computePlacementPreview(state, drag)?.rows).toEqual([0])
    expect(computePlacementPreview(state, drag, false)).toEqual({ colorId: 5, ghostCells: [0], rows: [], cols: [] })
  })

  it("has no snap over occupied cells", () => {
    expect(keyboardDragState(layout, game(), { slot: 0, row: 0, col: 3 })?.snap).toBeNull()
  })
})
