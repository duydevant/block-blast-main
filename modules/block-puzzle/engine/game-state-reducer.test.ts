import { describe, expect, it } from "vitest"

import { canPlace, cellIndex, createEmptyBoard } from "./board-grid-operations"
import { createNewGame, gameReducer, hasAnyMove } from "./game-state-reducer"
import { BOARD_SIZE, type GameAction, type GameState } from "./game-types"
import { findShape } from "./piece-shape-catalog"
import { SCORING_RULES } from "./score-and-combo-rules"
import { nextRandomInt } from "./seeded-random-generator"

/** Liệt kê mọi nước hợp lệ của state hiện tại. */
function validMoves(state: GameState): GameAction[] {
  const moves: GameAction[] = []
  state.tray.forEach((piece, slot) => {
    const shape = piece && findShape(piece.shapeId)
    if (!shape) return
    for (let row = 0; row < BOARD_SIZE; row++)
      for (let col = 0; col < BOARD_SIZE; col++)
        if (canPlace(state.board, shape, row, col)) moves.push({ type: "PLACE_PIECE", slot, row, col })
  })
  return moves
}

/** Bàn xen kẽ: ô trống (0) không bao giờ kề nhau và không dòng nào gần đầy. */
function checkerboard(): number[] {
  return Array.from({ length: 64 }, (_, i) => (((Math.floor(i / BOARD_SIZE) + (i % BOARD_SIZE)) % 2 === 1 ? 1 : 0)))
}

/** Chơi ngẫu nhiên có seed tới khi game over; trả về danh sách action đã dùng. */
function playRandomGame(seed: number, maxMoves = 500) {
  let state = createNewGame(seed)
  let rng = seed ^ 0x9e3779b9
  const actions: GameAction[] = []
  while (!state.isGameOver && actions.length < maxMoves) {
    const moves = validMoves(state)
    expect(moves.length).toBeGreaterThan(0)
    const [pick, nextRng] = nextRandomInt(rng, moves.length)
    rng = nextRng
    const next = gameReducer(state, moves[pick])
    expect(next).not.toBe(state)
    expect(next.score).toBeGreaterThan(state.score)
    actions.push(moves[pick])
    state = next
  }
  return { state, actions }
}

describe("createNewGame", () => {
  it("starts with empty board, full tray, zero score", () => {
    const state = createNewGame(123)
    expect(state.board.every((c) => c === 0)).toBe(true)
    expect(state.tray.every((p) => p !== null)).toBe(true)
    expect(state.score).toBe(0)
    expect(state.isGameOver).toBe(false)
  })
})

describe("gameReducer PLACE_PIECE", () => {
  it("returns the same reference for invalid moves", () => {
    const state = createNewGame(5)
    expect(gameReducer(state, { type: "PLACE_PIECE", slot: 0, row: 99, col: 0 })).toBe(state)
    expect(gameReducer(state, { type: "PLACE_PIECE", slot: 9, row: 0, col: 0 })).toBe(state)
  })

  it("empties the used slot and refills when all three are used", () => {
    let state = createNewGame(8)
    for (let i = 0; i < 2; i++) state = gameReducer(state, validMoves(state).find((m) => m.type === "PLACE_PIECE")!)
    expect(state.tray.filter((p) => p === null)).toHaveLength(2)
    state = gameReducer(state, validMoves(state)[0])
    expect(state.tray.every((p) => p !== null)).toBe(true)
  })

  it("clears a completed row and scores it", () => {
    const base = createNewGame(1)
    const board = [...base.board]
    for (let c = 1; c < BOARD_SIZE; c++) board[cellIndex(0, c)] = 2
    const state: GameState = { ...base, board, tray: [{ uid: 99, shapeId: "dot", colorId: 1 }, null, null] }
    const next = gameReducer(state, { type: "PLACE_PIECE", slot: 0, row: 0, col: 0 })
    expect(next.lastMove?.clearedRows).toEqual([0])
    expect(next.combo).toBe(1)
    expect(next.lastMove?.boardCleared).toBe(true)
    expect(next.score).toBe(1 + 10 + SCORING_RULES.boardClearBonus)
  })

  it("does not mutate the previous state", () => {
    const state = createNewGame(3)
    const snapshot = JSON.stringify(state)
    gameReducer(state, validMoves(state)[0])
    expect(JSON.stringify(state)).toBe(snapshot)
  })

  it("rejects placement from an empty tray slot", () => {
    const base = createNewGame(4)
    const state: GameState = { ...base, tray: [null, base.tray[1], base.tray[2]] }
    expect(gameReducer(state, { type: "PLACE_PIECE", slot: 0, row: 0, col: 0 })).toBe(state)
  })

  it("rejects any placement once the game is over", () => {
    const state: GameState = { ...createNewGame(6), isGameOver: true }
    expect(gameReducer(state, { type: "PLACE_PIECE", slot: 0, row: 0, col: 0 })).toBe(state)
  })

  it("reports game over when the remaining tray pieces no longer fit", () => {
    // Checkerboard: empties never touch orthogonally, so no 3-line fits and no line is near-full.
    const board = checkerboard()
    const state: GameState = {
      ...createNewGame(1),
      board,
      tray: [{ uid: 50, shapeId: "dot", colorId: 2 }, { uid: 51, shapeId: "line3-r0", colorId: 3 }, null],
    }
    const next = gameReducer(state, { type: "PLACE_PIECE", slot: 0, row: 0, col: 0 })
    expect(next).not.toBe(state)
    expect(next.lastMove?.clearedRows).toEqual([])
    expect(next.lastMove?.placedCells).toEqual([cellIndex(0, 0)])
    expect(next.isGameOver).toBe(true)
  })

  it("keeps playing when a remaining tray piece still fits", () => {
    // Checkerboard plus an open horizontal run (0,1)..(0,3) for the 3-line.
    const board = checkerboard()
    board[cellIndex(0, 1)] = 0
    board[cellIndex(0, 3)] = 0
    const state: GameState = {
      ...createNewGame(1),
      board,
      tray: [{ uid: 50, shapeId: "dot", colorId: 2 }, { uid: 51, shapeId: "line3-r0", colorId: 3 }, null],
    }
    const next = gameReducer(state, { type: "PLACE_PIECE", slot: 0, row: 0, col: 0 })
    expect(next.isGameOver).toBe(false)
    expect(next.tray[1]?.uid).toBe(51)
  })
})

describe("gameReducer NEW_GAME and RESTORE", () => {
  it("NEW_GAME matches createNewGame with the same seed", () => {
    const state = gameReducer(createNewGame(1), { type: "NEW_GAME", seed: 9 })
    expect(state).toEqual(createNewGame(9))
  })

  it("RESTORE keeps a valid saved state unchanged", () => {
    const restored = createNewGame(77)
    expect(gameReducer(createNewGame(1), { type: "RESTORE", state: restored })).toEqual(restored)
  })

  it("RESTORE refills an empty tray, clears pre-filled lines without points and drops lastMove", () => {
    const base = createNewGame(5)
    const board = [...base.board]
    for (let c = 0; c < BOARD_SIZE; c++) board[cellIndex(3, c)] = 4
    const tampered: GameState = {
      ...base,
      board,
      tray: [null, null, null],
      isGameOver: true,
      nextPieceUid: 0,
      lastMove: { colorId: 1, placedCells: [1], clearedRows: [], clearedCols: [], clearedCells: [], points: 1, combo: 0, boardCleared: false },
    }
    const next = gameReducer(base, { type: "RESTORE", state: tampered })
    expect(next.board.every((c) => c === 0)).toBe(true)
    expect(next.score).toBe(base.score)
    expect(next.tray.every((p) => p !== null)).toBe(true)
    expect(next.isGameOver).toBe(false)
    expect(next.lastMove).toBeNull()
    expect(new Set(next.tray.map((p) => p!.uid)).size).toBe(3)
  })

  it("survives a JSON round-trip mid-game and continues identically", () => {
    let state = createNewGame(31)
    for (let i = 0; i < 5; i++) state = gameReducer(state, validMoves(state)[0])
    const restored = gameReducer(state, { type: "RESTORE", state: JSON.parse(JSON.stringify(state)) })
    const move = validMoves(state)[0]
    expect(gameReducer(restored, move).board).toEqual(gameReducer(state, move).board)
  })
})

describe("gameReducer combo + cross clear", () => {
  it("clears a row and a column with one placement and builds combo across moves", () => {
    const base = createNewGame(1)
    const board = [...base.board]
    for (let i = 1; i < BOARD_SIZE; i++) {
      board[cellIndex(0, i)] = 2
      board[cellIndex(i, 0)] = 2
    }
    // Cột 5 thiếu hàng 1 (hàng 0 bị xoá ở nước đầu) → nước thứ hai lấp bằng khối dọc 2 ô.
    for (let r = 2; r < BOARD_SIZE; r++) board[cellIndex(r, 5)] = 3
    const state: GameState = {
      ...base,
      board,
      tray: [
        { uid: 90, shapeId: "dot", colorId: 1 },
        { uid: 91, shapeId: "line2-r1", colorId: 1 },
        { uid: 92, shapeId: "square2", colorId: 1 },
      ],
    }
    const first = gameReducer(state, { type: "PLACE_PIECE", slot: 0, row: 0, col: 0 })
    expect(first.lastMove?.clearedRows).toEqual([0])
    expect(first.lastMove?.clearedCols).toEqual([0])
    expect(first.lastMove?.clearedCells).toHaveLength(15)
    expect(first.combo).toBe(1)

    const second = gameReducer(first, { type: "PLACE_PIECE", slot: 1, row: 0, col: 5 })
    expect(second.lastMove?.clearedCols).toEqual([5])
    expect(second.combo).toBe(2)
  })

  it("rejects fractional and non-finite coordinates", () => {
    const state = createNewGame(2)
    for (const [row, col] of [[0.5, 0], [0, Number.NaN], [Number.POSITIVE_INFINITY, 0], [0, -1]]) {
      expect(gameReducer(state, { type: "PLACE_PIECE", slot: 0, row, col })).toBe(state)
    }
  })
})

describe("hasAnyMove", () => {
  it("is false for an all-empty tray and false for unknown shape ids", () => {
    expect(hasAnyMove(createEmptyBoard(), [null, null, null])).toBe(false)
    expect(hasAnyMove(createEmptyBoard(), [{ uid: 1, shapeId: "no-such-shape", colorId: 1 }])).toBe(false)
  })

  it("is true when any slot fits on an empty board", () => {
    expect(hasAnyMove(createEmptyBoard(), [null, { uid: 1, shapeId: "dot", colorId: 1 }, null])).toBe(true)
  })
})

describe("full game simulation", () => {
  it("replays deterministically from the same seed", () => {
    const { state, actions } = playRandomGame(2024)
    const replayed = actions.reduce(gameReducer, createNewGame(2024))
    expect(replayed).toEqual(state)
  })

  it("ends only when no tray piece fits", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { state } = playRandomGame(seed, 2000)
      expect(state.isGameOver).toBe(true)
      expect(hasAnyMove(state.board, state.tray)).toBe(false)
    }
  })
})
