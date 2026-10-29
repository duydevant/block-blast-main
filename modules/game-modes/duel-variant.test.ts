import { describe, expect, it } from "vitest"

import { gameReducer } from "@/modules/block-puzzle/engine/game-state-reducer"
import { createRankedGameStartState, replayRecordedGame } from "@/modules/block-puzzle/engine/replay-recorded-game-actions"

import { DUEL_VARIANT, variantForRun } from "./variant-run"

describe("duel variant", () => {
  it("starts with the revive already used, so a lost duel game cannot be revived", () => {
    const start = createRankedGameStartState({ seed: 42, stashUnlocked: false, variant: variantForRun({ kind: "duel" }) })
    expect(variantForRun({ kind: "duel" })).toBe(DUEL_VARIANT)
    expect(start.reviveUsed).toBe(true)

    const lost = { ...start, isGameOver: true }
    expect(gameReducer(lost, { type: "REVIVE" })).toBe(lost)
  })

  it("keeps a duel game that was ended early (time up / left) over when the save is restored", () => {
    const start = createRankedGameStartState({ seed: 7, stashUnlocked: false, variant: DUEL_VARIANT })
    const ended = { ...start, isGameOver: true, endedEarly: true }
    expect(gameReducer(ended, { type: "RESTORE", state: ended }).isGameOver).toBe(true)
    // Ván chưa bị chốt mà còn chỗ đặt thì tải lại vẫn chơi tiếp như cũ.
    expect(gameReducer(start, { type: "RESTORE", state: start }).isGameOver).toBe(false)
  })

  it("lets a classic game revive once but makes the server reject a duel log containing REVIVE", () => {
    const classic = { ...createRankedGameStartState({ seed: 42, stashUnlocked: false }), isGameOver: true }
    expect(gameReducer(classic, { type: "REVIVE" })).not.toBe(classic)

    const replay = replayRecordedGame({ seed: 42, stashUnlocked: false, variant: DUEL_VARIANT }, [{ type: "REVIVE" }])
    expect(replay).toMatchObject({ ok: false, reason: "invalid-action", actionIndex: 0 })
  })

  it("has no stash or tray swap, even past the stash score or with a stash unlocked on the profile", () => {
    const start = createRankedGameStartState({ seed: 42, stashUnlocked: true, variant: DUEL_VARIANT })
    expect(start).toMatchObject({ noPowerUps: true, replaceCharges: 0 })
    const rich = { ...start, score: 5000, replaceCharges: 3 }
    expect(gameReducer(rich, { type: "STASH_PIECE", slot: 0 })).toBe(rich)
    expect(gameReducer(rich, { type: "REPLACE_TRAY" })).toBe(rich)
    expect(gameReducer(rich, { type: "RESTORE", state: rich }).stashUnlocked).toBe(false)

    for (const action of [{ type: "STASH_PIECE", slot: 0 }, { type: "REPLACE_TRAY" }] as const) {
      const replay = replayRecordedGame({ seed: 42, stashUnlocked: true, variant: DUEL_VARIANT }, [action])
      expect(replay).toMatchObject({ ok: false, reason: "invalid-action", actionIndex: 0 })
    }
  })
})
