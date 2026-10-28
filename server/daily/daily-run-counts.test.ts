import { describe, expect, it } from "vitest"

import { advanceDailyStreak } from "./advance-daily-streak"
import { dailyRunCounts } from "./daily-run-counts"

describe("dailyRunCounts", () => {
  const claim = { gameId: "g1", status: "started" }

  it("counts only the run that claimed the day when it started", () => {
    expect(dailyRunCounts({ claim, gameId: "g1", day: "20261027", today: "20261027" })).toBe(true)
    expect(dailyRunCounts({ claim, gameId: "g2", day: "20261027", today: "20261027" })).toBe(false)
  })

  it("does not count a run once the day's result is recorded or when nothing was claimed", () => {
    expect(dailyRunCounts({ claim: { ...claim, status: "done" }, gameId: "g1", day: "20261027", today: "20261027" })).toBe(false)
    expect(dailyRunCounts({ claim: undefined, gameId: "g1", day: "20261027", today: "20261027" })).toBe(false)
  })

  it("accepts a submission until the end of the next day only", () => {
    expect(dailyRunCounts({ claim, gameId: "g1", day: "20261027", today: "20261028" })).toBe(true)
    expect(dailyRunCounts({ claim, gameId: "g1", day: "20261027", today: "20261029" })).toBe(false)
  })
})

describe("late daily submissions and the streak", () => {
  it("never moves the streak backwards when an older day arrives after a newer one", () => {
    const afterToday = { current: 5, best: 5, lastDailyDay: "20261028" }
    expect(advanceDailyStreak(afterToday, "20261027")).toBe(afterToday)
  })
})
