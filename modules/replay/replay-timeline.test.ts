import { describe, expect, it } from "vitest"

import { chooseMove } from "@/modules/block-puzzle/engine/balance-simulator"
import { gameReducer } from "@/modules/block-puzzle/engine/game-state-reducer"
import { encodeActions } from "@/modules/block-puzzle/engine/recorded-action-codec"
import { createRankedGameStartState, type RecordedGameAction, replayRecordedGame } from "@/modules/block-puzzle/engine/replay-recorded-game-actions"

import { buildReplayTimeline } from "./replay-timeline"
import { replayStartFor } from "./replay-types"

function botGame(seed: number) {
  let state = createRankedGameStartState({ seed, stashUnlocked: false })
  const actions: RecordedGameAction[] = []
  while (!state.isGameOver && actions.length < 200) {
    const move = chooseMove(state)
    if (!move) break
    const action: RecordedGameAction = { type: "PLACE_PIECE", ...move }
    state = gameReducer(state, action)
    actions.push(action)
  }
  return actions
}

describe("buildReplayTimeline", () => {
  it("ends on the same state the server replay computes", () => {
    const actions = botGame(12)
    const start = replayStartFor({ mode: "classic", seed: 12, stashUnlocked: false, levelId: null })
    const timeline = buildReplayTimeline(start, encodeActions(actions))
    const server = replayRecordedGame(start, actions)
    expect(timeline.brokenAt).toBeNull()
    expect(timeline.states).toHaveLength(actions.length + 1)
    expect(server.ok && timeline.states.at(-1)?.score).toBe(server.ok ? server.state.score : -1)
  })

  it("stops at the first invalid move", () => {
    const actions = botGame(5).slice(0, 3)
    const encoded = [...encodeActions(actions), encodeActions([{ type: "PLACE_PIECE", slot: 0, row: 15, col: 15 }])[0]]
    const timeline = buildReplayTimeline({ seed: 5, stashUnlocked: false }, encoded)
    expect(timeline.brokenAt).toBe(3)
    expect(timeline.states).toHaveLength(4)
    expect(buildReplayTimeline({ seed: 5, stashUnlocked: false }, [99999]).brokenAt).toBe(0)
  })
})
