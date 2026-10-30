import { describe, expect, it } from "vitest"

import { parseSavedGame } from "../store/saved-game-schema"
import { chooseMove } from "./balance-simulator"
import { accumulateRunStats, EMPTY_RUN_STATS, isPureRun, pointsPerMove } from "./game-run-stats"
import { gameReducer } from "./game-state-reducer"
import type { GameState, MoveResult } from "./game-types"
import { createRankedGameStartState, type RecordedGameAction, replayRecordedGame } from "./replay-recorded-game-actions"

const move = (rows: number, cols: number, combo = 1, boardCleared = false): MoveResult => ({
  colorId: 1,
  placedCells: [0],
  clearedRows: Array.from({ length: rows }, (_, i) => i),
  clearedCols: Array.from({ length: cols }, (_, i) => i),
  clearedCells: [],
  points: 0,
  combo,
  boardCleared,
})
const place: RecordedGameAction = { type: "PLACE_PIECE", slot: 0, row: 0, col: 0 }
const after = (lastMove: MoveResult | null) => ({ lastMove }) as GameState

describe("accumulateRunStats", () => {
  it("counts clears, multi-line clears, max lines, combo and board clears", () => {
    let stats = accumulateRunStats(EMPTY_RUN_STATS, place, after(move(0, 0, 0)))
    stats = accumulateRunStats(stats, place, after(move(2, 0, 1)))
    stats = accumulateRunStats(stats, place, after(move(2, 2, 3, true)))
    expect(stats).toMatchObject({ clearMoves: 2, multiClears: [2, 1, 1], maxLinesInMove: 4, bestCombo: 3, boardClears: 1 })
  })

  it("tracks power-up use and the pure flag", () => {
    expect(isPureRun(EMPTY_RUN_STATS)).toBe(true)
    const stashed = accumulateRunStats(EMPTY_RUN_STATS, { type: "STASH_PIECE", slot: 1 }, after(null))
    const swapped = accumulateRunStats(stashed, { type: "REPLACE_TRAY" }, after(null))
    const revived = accumulateRunStats(swapped, { type: "REVIVE" }, after(null))
    expect(revived).toMatchObject({ stashUses: 1, replaceUses: 1, reviveUsed: true })
    expect(isPureRun(stashed)).toBe(false)
  })

  it("computes points per move safely", () => {
    expect(pointsPerMove(300, 0)).toBe(0)
    expect(pointsPerMove(300, 20)).toBe(15)
  })
})

/** Bot chơi tới hết ván (có hồi sinh) để so chỉ số client (store/reducer) với server (replay). */
function playWithBot(seed: number) {
  let state = createRankedGameStartState({ seed, stashUnlocked: false })
  const actions: RecordedGameAction[] = []
  const apply = (action: RecordedGameAction) => {
    const next = gameReducer(state, action)
    if (next === state) return false
    actions.push(action)
    state = next
    return true
  }
  apply({ type: "REPLACE_TRAY" })
  while (actions.length < 400) {
    if (state.isGameOver && !(state.reviveUsed === false && apply({ type: "REVIVE" }))) break
    const choice = chooseMove(state)
    if (!choice || !apply({ type: "PLACE_PIECE", ...choice })) break
  }
  return { state, actions }
}

describe("run stats through the reducer and replay", () => {
  it("matches between the live game and the server replay", () => {
    for (const seed of [3, 41, 977]) {
      const { state, actions } = playWithBot(seed)
      const replay = replayRecordedGame({ seed, stashUnlocked: false }, actions)
      expect(replay.ok).toBe(true)
      if (!replay.ok) return
      expect(replay.summary.runStats).toEqual(state.runStats)
      expect(replay.summary.linesCleared).toBe(state.linesCleared)
      expect(state.runStats?.replaceUses).toBe(1)
      expect(isPureRun(state.runStats!)).toBe(false)
    }
  })

  it("leaves the run stats untouched on invalid moves", () => {
    const start = createRankedGameStartState({ seed: 5, stashUnlocked: false })
    expect(gameReducer(start, { type: "PLACE_PIECE", slot: 0, row: 50, col: 50 })).toBe(start)
    expect(start.runStats).toEqual(EMPTY_RUN_STATS)
  })

  it("keeps old saves without run stats and drops corrupt ones", () => {
    const { state } = playWithBot(7)
    const { runStats, ...withoutStats } = state
    expect(runStats).toBeDefined()
    expect(parseSavedGame({ game: withoutStats, best: 0 }).game).not.toBeNull()
    const corrupt = parseSavedGame({ game: { ...state, runStats: { clearMoves: -1 } }, best: 0 }).game
    expect(corrupt).not.toBeNull()
    expect(corrupt?.runStats).toBeUndefined()
    expect(parseSavedGame({ game: state, best: 0 }).game?.runStats).toEqual(state.runStats)
  })
})
