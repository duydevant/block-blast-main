import { describe, expect, it } from "vitest"

import { createNewGame, gameReducer } from "../engine/game-state-reducer"
import { parseSavedGame } from "./saved-game-schema"

function roundTrip<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value))
}

describe("parseSavedGame", () => {
  it("accepts a real saved game and strips lastMove", () => {
    let game = createNewGame(10)
    game = gameReducer(game, { type: "PLACE_PIECE", slot: 0, row: 0, col: 0 })
    const saved = parseSavedGame(roundTrip({ game, best: 50 }))
    expect(saved.best).toBe(50)
    expect(saved.game?.board).toEqual(game.board)
    expect(saved.game?.lastMove).toBeNull()
  })

  it("accepts an empty save", () => {
    expect(parseSavedGame({ game: null, best: 0 })).toEqual({ game: null, best: 0 })
  })

  it.each([
    ["wrong board length", (g: Record<string, unknown>) => ({ ...g, board: [0, 0] })],
    ["out-of-range color", (g: Record<string, unknown>) => ({ ...g, board: new Array(64).fill(99) })],
    ["unknown shape", (g: Record<string, unknown>) => ({ ...g, tray: [{ uid: 1, shapeId: "hack", colorId: 1 }, null, null] })],
    ["negative score", (g: Record<string, unknown>) => ({ ...g, score: -5 })],
    ["fractional rng state", (g: Record<string, unknown>) => ({ ...g, rngState: 1.5 })],
  ])("drops a game with %s but keeps the best score", (_, mutate) => {
    const game = roundTrip(createNewGame(3)) as Record<string, unknown>
    expect(parseSavedGame({ game: mutate(game), best: 120 })).toEqual({ game: null, best: 120 })
  })

  it("keeps a valid game when only the best score is corrupted", () => {
    const game = createNewGame(4)
    const saved = parseSavedGame(roundTrip({ game, best: "9999" }))
    expect(saved.best).toBe(0)
    expect(saved.game?.tray).toEqual(game.tray)
  })

  it("falls back to defaults for garbage", () => {
    expect(parseSavedGame("nope")).toEqual({ game: null, best: 0 })
    expect(parseSavedGame(null)).toEqual({ game: null, best: 0 })
  })
})
