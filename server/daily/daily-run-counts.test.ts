import { describe, expect, it } from "vitest"

import { advanceDailyStreak } from "./advance-daily-streak"
import { dailyRunCounts } from "./daily-run-counts"

describe("dailyRunCounts", () => {
  const day = { runs: ["g1", "g2"], finished: ["g1"] }

  it("counts only runs that reserved a slot when they started, once each", () => {
    expect(dailyRunCounts({ ...day, gameId: "g2", day: "20261027", today: "20261027" })).toBe(true)
    expect(dailyRunCounts({ ...day, gameId: "g1", day: "20261027", today: "20261027" })).toBe(false)
    expect(dailyRunCounts({ ...day, gameId: "g9", day: "20261027", today: "20261027" })).toBe(false)
    expect(dailyRunCounts({ runs: [], finished: [], gameId: "g1", day: "20261027", today: "20261027" })).toBe(false)
  })

  it("accepts a submission until the end of the next day only", () => {
    expect(dailyRunCounts({ ...day, gameId: "g2", day: "20261027", today: "20261028" })).toBe(true)
    expect(dailyRunCounts({ ...day, gameId: "g2", day: "20261027", today: "20261029" })).toBe(false)
  })
})

describe("late daily submissions and the streak", () => {
  it("never moves the streak backwards when an older day arrives after a newer one", () => {
    const afterToday = { current: 5, best: 5, lastDailyDay: "20261028" }
    expect(advanceDailyStreak(afterToday, "20261027")).toBe(afterToday)
  })
})
