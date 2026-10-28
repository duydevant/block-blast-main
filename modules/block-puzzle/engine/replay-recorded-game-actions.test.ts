import { describe, expect, it } from "vitest"

import { canPlace } from "./board-grid-operations"
import { gameReducer } from "./game-state-reducer"
import { BOARD_SIZE, type GameState, STASH_SLOT } from "./game-types"
import { findShape } from "./piece-shape-catalog"
import {
  createRankedGameStartState,
  MAX_RECORDED_ACTIONS,
  type RecordedGameAction,
  replayRecordedGame,
} from "./replay-recorded-game-actions"

function firstLegalPlacement(state: GameState): RecordedGameAction | null {
  const sources = [...state.tray.map((piece, slot) => [slot, piece] as const), [STASH_SLOT, state.stash] as const]
  for (const [slot, piece] of sources) {
    const shape = piece && findShape(piece.shapeId)
    if (!shape) continue
    for (let row = 0; row < BOARD_SIZE; row++)
      for (let col = 0; col < BOARD_SIZE; col++)
        if (canPlace(state.board, shape, row, col)) return { type: "PLACE_PIECE", slot, row, col }
  }
  return null
}

/** Chơi như client: đổi khay ở nước đầu, cất 1 khối, đặt khối đầu tiên hợp lệ, hồi sinh 1 lần. */
function playRecorded(seed: number, stashUnlocked: boolean) {
  let state = createRankedGameStartState({ seed, stashUnlocked })
  const actions: RecordedGameAction[] = []
  const apply = (action: RecordedGameAction) => {
    const next = gameReducer(state, action)
    if (next !== state) {
      actions.push(action)
      state = next
    }
  }
  apply({ type: "REPLACE_TRAY" })
  apply({ type: "STASH_PIECE", slot: 0 })
  while (actions.length < 2000) {
    if (state.isGameOver) {
      if (state.reviveUsed) break
      apply({ type: "REVIVE" })
      continue
    }
    const move = firstLegalPlacement(state)
    if (!move) break
    apply(move)
  }
  return { actions, state }
}

describe("replayRecordedGame", () => {
  it.each([1, 42, 2026])("replays seed %i to the exact final state and score", (seed) => {
    const { actions, state } = playRecorded(seed, true)
    const result = replayRecordedGame({ seed, stashUnlocked: true }, actions)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state).toEqual(state)
    expect(result.summary.score).toBe(state.score)
    expect(result.summary.moveCount).toBe(state.moveCount)
    expect(result.summary.isGameOver).toBe(true)
    expect(result.summary.linesCleared).toBeGreaterThan(0)
  })

  it("rejects a placement that does not fit the replayed board", () => {
    const { actions } = playRecorded(7, false)
    const tampered = [...actions]
    // Đặt chồng lên đúng ô của nước trước → chắc chắn không hợp lệ.
    const firstPlace = tampered.findIndex((action) => action.type === "PLACE_PIECE")
    tampered.splice(firstPlace + 1, 0, tampered[firstPlace])
    const result = replayRecordedGame({ seed: 7, stashUnlocked: false }, tampered)
    expect(result).toMatchObject({ ok: false, reason: "invalid-action" })
  })

  it("rejects power-ups used beyond their limits", () => {
    const replaces: RecordedGameAction[] = Array.from({ length: 5 }, () => ({ type: "REPLACE_TRAY" }))
    expect(replayRecordedGame({ seed: 3, stashUnlocked: false }, replaces)).toMatchObject({ ok: false, actionIndex: 2 })
    expect(replayRecordedGame({ seed: 3, stashUnlocked: false }, [{ type: "REVIVE" }])).toMatchObject({ ok: false, actionIndex: 0 })
  })

  it("rejects stashing when the stash is still locked", () => {
    const result = replayRecordedGame({ seed: 5, stashUnlocked: false }, [{ type: "STASH_PIECE", slot: 0 }])
    expect(result).toMatchObject({ ok: false, reason: "invalid-action" })
  })

  it("a log recorded on one seed does not replay to the same score on another seed", () => {
    const { actions, state } = playRecorded(11, true)
    const result = replayRecordedGame({ seed: 12, stashUnlocked: true }, actions)
    expect(result.ok && result.summary.score === state.score).toBe(false)
  })

  it("rejects oversized logs before replaying", () => {
    const actions: RecordedGameAction[] = Array.from({ length: MAX_RECORDED_ACTIONS + 1 }, () => ({ type: "REPLACE_TRAY" }))
    expect(replayRecordedGame({ seed: 1, stashUnlocked: false }, actions)).toEqual({ ok: false, reason: "too-many-actions" })
  })
})
