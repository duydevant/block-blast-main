import { describe, expect, it } from "vitest"

import { cellIndex } from "./board-grid-operations"
import { createNewGame, gameReducer } from "./game-state-reducer"
import { BOARD_CELL_COUNT, BOARD_SIZE, type GameState, type TrayPiece } from "./game-types"

const stashed: TrayPiece = { uid: 500, shapeId: "dot", colorId: 2 }

const restore = (state: GameState): GameState => gameReducer(createNewGame(1), { type: "RESTORE", state })

describe("RESTORE with a stash present", () => {
  it("refills an empty tray, keeps the stash, and gives all pieces unique uids above the stash", () => {
    const base = createNewGame(7)
    const next = restore({ ...base, tray: [null, null, null], stash: stashed, stashUnlocked: true, nextPieceUid: 3 })
    expect(next.tray.every(Boolean)).toBe(true)
    expect(next.stash).toEqual(stashed)
    const uids = [...next.tray, next.stash].map((piece) => piece!.uid)
    expect(new Set(uids).size).toBe(4)
    expect(Math.min(...next.tray.map((piece) => piece!.uid))).toBeGreaterThan(stashed.uid)
    expect(next.nextPieceUid).toBe(stashed.uid + 1 + 3)
  })

  it("does not refill a partly empty tray, since a null slot is a normal gap after stashing", () => {
    const base = createNewGame(7)
    const next = restore({ ...base, tray: [null, base.tray[1], base.tray[2]], stash: stashed, stashUnlocked: true })
    expect(next.tray[0]).toBeNull()
    expect(next.tray[1]).toEqual(base.tray[1])
  })

  it("clears a pre-filled full board before dealing, so it is not game over", () => {
    // Bàn đầy sẵn: mọi dòng đều đầy → xoá trước khi chia khay, nên không phải game over.
    const fullBoard = new Array<number>(BOARD_CELL_COUNT).fill(1)
    const next = restore({ ...createNewGame(7), board: fullBoard, tray: [null, null, null], stash: stashed, stashUnlocked: true, isGameOver: true })
    expect(next.board.every((cell) => cell === 0)).toBe(true)
    expect(next.tray.every(Boolean)).toBe(true)
    expect(next.isGameOver).toBe(false)
  })

  it("clears a stale game-over flag when the stash still fits", () => {
    const board = new Array<number>(BOARD_CELL_COUNT).fill(1)
    board[cellIndex(0, 0)] = 0
    const next = restore({ ...createNewGame(7), board, tray: [null, null, null], stash: stashed, stashUnlocked: true, isGameOver: true })
    expect(next.isGameOver).toBe(false)
  })

  it("clears a pre-filled full row without awarding points when a stash is present", () => {
    const base = createNewGame(7)
    const board = [...base.board]
    for (let col = 0; col < BOARD_SIZE; col++) board[cellIndex(0, col)] = 3
    const next = restore({ ...base, board, tray: [null, null, null], stash: stashed, stashUnlocked: true })
    expect(next.board.slice(0, BOARD_SIZE).every((cell) => cell === 0)).toBe(true)
    expect(next.score).toBe(base.score)
  })
})
