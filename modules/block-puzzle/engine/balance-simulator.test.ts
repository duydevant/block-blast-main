import { describe, expect, it } from "vitest"

import { simulateGames } from "./balance-simulator"

describe("balance simulator", () => {
  it("plays deterministic, non-trivial games with the greedy bot", () => {
    const report = simulateGames({ games: 12, seed: 3 })
    expect(report).toEqual(simulateGames({ games: 12, seed: 3 }))
    expect(report.averageMoves).toBeGreaterThan(15)
    expect(report.clearRate).toBeGreaterThan(0.05)
    expect(report.averageScore).toBeGreaterThan(100)
  })
})
