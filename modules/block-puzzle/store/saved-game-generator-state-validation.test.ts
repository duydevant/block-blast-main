import { describe, expect, it } from "vitest"

import { createNewGame } from "../engine/game-state-reducer"
import { TRAY_SIZE } from "../engine/game-types"
import { dealTray, INITIAL_GENERATOR_STATE } from "../engine/piece-tray-generator"
import { parseSavedGame } from "./saved-game-schema"

const roundTrip = (value: unknown): Record<string, unknown> => JSON.parse(JSON.stringify(value))

/** Save có ván hợp lệ với `generatorState` tuỳ chỉnh (undefined = bỏ hẳn key). */
function savedWithGeneratorState(generatorState: unknown) {
  const game = roundTrip(createNewGame(11))
  if (generatorState === undefined) delete game.generatorState
  else game.generatorState = generatorState
  return { game, best: 120 }
}

describe("saved generatorState validation", () => {
  it("preserves the next deal after saving a partially consumed bag", () => {
    const game = createNewGame(42)
    const firstBag = dealTray(game.board, 200, game.rngState, game.nextPieceUid, game.generatorState)
    const before = { ...game, ...firstBag, score: 200 }
    const restored = parseSavedGame(roundTrip({ game: before, best: 200 })).game!
    expect(restored.generatorState).toEqual(before.generatorState)
    expect(dealTray(restored.board, restored.score, restored.rngState, restored.nextPieceUid, restored.generatorState))
      .toEqual(dealTray(before.board, before.score, before.rngState, before.nextPieceUid, before.generatorState))
  })

  it("migrates weighted-dealer memory without discarding the current game", () => {
    const restored = parseSavedGame(savedWithGeneratorState({ recentFamilies: ["dot"] }))
    expect(restored.game?.generatorState).toEqual(INITIAL_GENERATOR_STATE)
  })

  it.each([
    { stepsBeforeSmart: 5, poolIndices: [], currentPool: [] },
    { stepsBeforeSmart: -2, poolIndices: [], currentPool: [] },
    { stepsBeforeSmart: 1, poolIndices: [12], currentPool: [] },
    { stepsBeforeSmart: 1, poolIndices: [0], currentPool: [] },
    { stepsBeforeSmart: 1, poolIndices: [], currentPool: [60] },
    { stepsBeforeSmart: 1, poolIndices: [], currentPool: [-1] },
    { stepsBeforeSmart: 1, poolIndices: [], currentPool: [1.5] },
    { stepsBeforeSmart: 1, poolIndices: [], currentPool: Array(22).fill(0) },
  ])("rejects invalid classic dealer state: %j", (state) => {
    expect(parseSavedGame(savedWithGeneratorState(state))).toEqual({ game: null, best: 120 })
  })
  it("rejects a v2-shaped generatorState as the whole game but keeps the best score", () => {
    const v2 = { stepsBeforeSmart: 3, poolIndices: [0, 4, 9], currentPool: ["dot", "line3"] }
    expect(parseSavedGame(savedWithGeneratorState(v2))).toEqual({ game: null, best: 120 })
  })

  it("rejects a generatorState without recentFamilies", () => {
    expect(parseSavedGame(savedWithGeneratorState({}))).toEqual({ game: null, best: 120 })
  })

  it("accepts a save with no generatorState at all and keeps the game", () => {
    const saved = parseSavedGame(savedWithGeneratorState(undefined))
    expect(saved.game?.board).toEqual(createNewGame(11).board)
    expect(saved.best).toBe(120)
  })

  it("accepts exactly the maximum number of recent families and rejects one more", () => {
    const max = TRAY_SIZE * 4
    const atLimit = Array.from({ length: max }, (_, i) => `family-${i}`)
    expect(parseSavedGame(savedWithGeneratorState({ recentFamilies: atLimit })).game).not.toBeNull()
    expect(parseSavedGame(savedWithGeneratorState({ recentFamilies: [...atLimit, "extra"] }))).toEqual({ game: null, best: 120 })
  })

  it("rejects a family id longer than 32 characters and accepts one of exactly 32", () => {
    expect(parseSavedGame(savedWithGeneratorState({ recentFamilies: ["a".repeat(32)] })).game).not.toBeNull()
    expect(parseSavedGame(savedWithGeneratorState({ recentFamilies: ["a".repeat(33)] }))).toEqual({ game: null, best: 120 })
  })

  it("rejects non-string family entries", () => {
    expect(parseSavedGame(savedWithGeneratorState({ recentFamilies: [42] }))).toEqual({ game: null, best: 120 })
  })
})
