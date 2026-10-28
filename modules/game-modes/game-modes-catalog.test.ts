import { describe, expect, it } from "vitest"

import { chooseMove } from "@/modules/block-puzzle/engine/balance-simulator"
import { createNewGame, gameReducer } from "@/modules/block-puzzle/engine/game-state-reducer"
import type { GameState } from "@/modules/block-puzzle/engine/game-types"
import { replayRecordedGame, type RecordedGameAction } from "@/modules/block-puzzle/engine/replay-recorded-game-actions"

import { hasFullLine } from "./board-pattern"
import { BOARD_PATTERNS } from "./board-patterns"
import { findLevel, isLevelGoalMet, isLevelUnlocked, LEVELS, levelVariant, starsForLevel } from "./level-catalog"
import { eventRuleForWeek, WEEKLY_EVENT_RULES } from "./weekly-event-catalog"

/** Bot tham lam chơi tới khi hết ván; trả các nước đã đi. */
function botPlay(start: GameState, stop: (state: GameState) => boolean = () => false) {
  let state = start
  const actions: RecordedGameAction[] = []
  while (!state.isGameOver && !stop(state)) {
    const move = chooseMove(state)
    if (!move) break
    state = gameReducer(state, { type: "PLACE_PIECE", ...move })
    actions.push({ type: "PLACE_PIECE", ...move })
  }
  return { state, actions }
}

describe("board patterns", () => {
  it("never start with a full row or column (that would be a free clear)", () => {
    for (const board of Object.values(BOARD_PATTERNS)) expect(hasFullLine(board)).toBe(false)
  })
})

describe("engine variants", () => {
  it("ends the game when the move limit is used up and never allows a revive in level mode", () => {
    let state = createNewGame(5, { moveLimit: 3 })
    state = botPlay(state).state
    expect(state.moveCount).toBe(3)
    expect(state.isGameOver).toBe(true)
    expect(gameReducer(state, { type: "REVIVE" })).toBe(state)
  })

  it("counts cleared lines and honours a preset board and replace charges", () => {
    const state = createNewGame(9, { startBoard: BOARD_PATTERNS.corners, replaceCharges: 6 })
    expect(state.board).toEqual(BOARD_PATTERNS.corners)
    expect(state.replaceCharges).toBe(6)
    const played = botPlay(state).state
    expect(played.linesCleared).toBeGreaterThan(0)
  })

  it("replays only against the same variant", () => {
    const variant = { startBoard: BOARD_PATTERNS.cross }
    const { state, actions } = botPlay(createNewGame(21, variant))
    const replay = replayRecordedGame({ seed: 21, stashUnlocked: false, variant }, actions)
    expect(replay.ok && replay.state.score).toBe(state.score)
    expect(replayRecordedGame({ seed: 21, stashUnlocked: false }, actions).ok).toBe(false)
  })
})

describe("levels", () => {
  it("are numbered 1..n and the bot can clear every one of them with its seed", () => {
    LEVELS.forEach((definition, index) => {
      expect(definition.id).toBe(index + 1)
      expect(findLevel(definition.id)).toBe(definition)
      const { state } = botPlay(createNewGame(definition.seed, levelVariant(definition)), (s) => isLevelGoalMet(definition, s))
      expect(isLevelGoalMet(definition, state), `level ${definition.id}`).toBe(true)
      expect(starsForLevel(definition, state)).toBeGreaterThan(0)
    })
  })

  it("awards stars by moves used and unlocks levels in order", () => {
    const definition = LEVELS[0]
    const done = { score: 0, linesCleared: definition.goal.target }
    expect(starsForLevel(definition, { ...done, moveCount: Math.floor(definition.moveLimit * 0.6) })).toBe(3)
    expect(starsForLevel(definition, { ...done, moveCount: definition.moveLimit })).toBe(1)
    expect(starsForLevel(definition, { ...done, linesCleared: 0, moveCount: 1 })).toBe(0)
    expect(isLevelUnlocked(1, {})).toBe(true)
    expect(isLevelUnlocked(2, {})).toBe(false)
    expect(isLevelUnlocked(2, { "1": 2 })).toBe(true)
    expect(findLevel(0)).toBeUndefined()
    expect(findLevel(LEVELS.length + 1)).toBeUndefined()
  })
})

describe("weekly events", () => {
  it("rotate deterministically through every rule", () => {
    expect(eventRuleForWeek("2026-W44")).toBe(eventRuleForWeek("2026-W44"))
    const ids = new Set(Array.from({ length: WEEKLY_EVENT_RULES.length }, (_, i) => eventRuleForWeek(`2026-W${String(i + 10).padStart(2, "0")}`).id))
    expect(ids.size).toBe(WEEKLY_EVENT_RULES.length)
  })
})
