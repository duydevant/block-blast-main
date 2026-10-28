import { describe, expect, it } from "vitest"

import { parseSavedGame } from "../store/saved-game-schema"
import { createNewGame, gameReducer, hasAnyMove, STASH_SLOT } from "./game-state-reducer"
import { POWER_UP_RULES } from "./power-up-rules"

const unlockScore = POWER_UP_RULES.stashUnlockScore

describe("stash", () => {
  it("is locked below the unlock score, holds one piece, and rejects a second", () => {
    const base = { ...createNewGame(2), score: unlockScore - 1 }
    expect(gameReducer(base, { type: "STASH_PIECE", slot: 0 })).toBe(base)
    const unlocked = { ...base, score: unlockScore }
    const next = gameReducer(unlocked, { type: "STASH_PIECE", slot: 0 })
    expect(next.stash).toEqual(base.tray[0])
    expect(next.tray[0]).toBeNull()
    expect(next.stashUnlocked).toBe(true)
    expect(gameReducer(next, { type: "STASH_PIECE", slot: 1 })).toBe(next)
  })

  it("refills after stashing the last tray piece and places the stashed piece later", () => {
    const base = { ...createNewGame(2), score: unlockScore, tray: [{ uid: 10, shapeId: "dot", colorId: 1 }, null, null] }
    const held = gameReducer(base, { type: "STASH_PIECE", slot: 0 })
    expect(held.tray.every(Boolean)).toBe(true)
    const next = gameReducer(held, { type: "PLACE_PIECE", slot: STASH_SLOT, row: 0, col: 0 })
    expect(next.stash).toBeNull()
    expect(next.tray).toEqual(held.tray)
    expect(next.board[0]).toBe(1)
    expect(next.score).toBe(unlockScore + 1)
  })

  it("unlocks permanently once the score reaches the threshold", () => {
    const base = { ...createNewGame(2), score: unlockScore - 1, tray: [{ uid: 10, shapeId: "dot", colorId: 1 }, null, null] }
    expect(gameReducer(base, { type: "PLACE_PIECE", slot: 0, row: 0, col: 0 }).stashUnlocked).toBe(true)
  })

  it("counts the stash as a possible move and survives a validated save", () => {
    const state = { ...createNewGame(2), stash: { uid: 25, shapeId: "dot", colorId: 1 }, stashUnlocked: true }
    expect(hasAnyMove(state.board, [null, null, null], state.stash)).toBe(true)
    const restored = parseSavedGame(JSON.parse(JSON.stringify({ game: state, best: 300 }))).game!
    expect(restored.stash).toEqual(state.stash)
    expect(restored.stashUnlocked).toBe(true)
  })
})
