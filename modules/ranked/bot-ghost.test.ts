import { describe, expect, it } from "vitest"

import { replayRecordedGame } from "@/modules/block-puzzle/engine/replay-recorded-game-actions"
import { decodeActions } from "@/modules/block-puzzle/engine/recorded-action-codec"
import { buildReplayTimeline } from "@/modules/replay/replay-timeline"

import { playBotGhost, RANKED_TIME_MS, RANKED_VARIANT, relativeGhostTimes } from "./bot-ghost"

describe("bot ghost", () => {
  it("is deterministic, stays inside 3 minutes and replays to its score", () => {
    const ghost = playBotGhost(1234, 1000)
    expect(playBotGhost(1234, 1000)).toEqual(ghost)
    expect(ghost.times.every((time, index) => time <= RANKED_TIME_MS && (index === 0 || time > ghost.times[index - 1]))).toBe(true)
    const replay = replayRecordedGame({ seed: 1234, stashUnlocked: false, variant: RANKED_VARIANT }, decodeActions(ghost.actions)!)
    expect(replay.ok && replay.summary.score).toBe(ghost.score)
    expect(buildReplayTimeline({ seed: 1234, stashUnlocked: false, variant: RANKED_VARIANT }, ghost.actions).brokenAt).toBeNull()
  })

  it("plays worse at low MMR on average", () => {
    const average = (mmr: number) => Array.from({ length: 12 }, (_, i) => playBotGhost(100 + i, mmr).score).reduce((a, b) => a + b, 0) / 12
    expect(average(1400)).toBeGreaterThan(average(500))
  })

  it("normalises recorded client times", () => {
    expect(relativeGhostTimes([5000, 5600, 7000], 3)).toEqual([1000, 1600, 3000])
    expect(relativeGhostTimes(null, 2)).toEqual([1000, 2000])
  })
})
