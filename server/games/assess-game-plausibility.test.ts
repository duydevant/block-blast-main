import { describe, expect, it } from "vitest"

import { normalizeSeed, nextRandom } from "@/modules/block-puzzle/engine/seeded-random-generator"

import { assessGamePlausibility } from "./assess-game-plausibility"

/** Thời điểm các nước với khoảng ngẫu nhiên (có seed) trong [min, max] ms. */
function timesWithGaps(count: number, min: number, max: number, seed = 1): number[] {
  let state = normalizeSeed(seed)
  const times = [1_700_000_000_000]
  for (let i = 1; i < count; i++) {
    const [value, next] = nextRandom(state)
    state = next
    times.push(times[i - 1] + Math.round(min + value * (max - min)))
  }
  return times
}

describe("assessGamePlausibility", () => {
  it("accepts human-like games", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const times = timesWithGaps(120, 400, 3000, seed)
      expect(assessGamePlausibility({ durationMs: times.at(-1)! - times[0] + 5000, moveCount: 120, times }).suspect).toBe(false)
    }
  })

  it("ignores short games and missing or broken timing", () => {
    expect(assessGamePlausibility({ durationMs: 100, moveCount: 10 }).suspect).toBe(false)
    expect(assessGamePlausibility({ durationMs: 60_000, moveCount: 80, times: null }).suspect).toBe(false)
    expect(assessGamePlausibility({ durationMs: 60_000, moveCount: 80, times: [5, 3, 9] }).suspect).toBe(false)
  })

  it("flags sessions that are too fast overall", () => {
    expect(assessGamePlausibility({ durationMs: 10_000, moveCount: 100 })).toEqual({ suspect: true, reason: "too-fast" })
  })

  it("flags machine-like timing", () => {
    const uniform = Array.from({ length: 100 }, (_, i) => 1_700_000_000_000 + i * 500)
    expect(assessGamePlausibility({ durationMs: 60_000, moveCount: 100, times: uniform }).reason).toBe("uniform-timing")
    const fast = timesWithGaps(100, 30, 100)
    expect(assessGamePlausibility({ durationMs: 600_000, moveCount: 100, times: fast }).reason).toBe("inhuman-speed")
  })
})
