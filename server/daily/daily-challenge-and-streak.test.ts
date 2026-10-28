import { describe, expect, it } from "vitest"

import { EMPTY_DAILY_STREAK } from "@/modules/player-profile/player-profile-types"

import { advanceDailyStreak, effectiveDailyStreak } from "./advance-daily-streak"
import { dailySeedFor, dayKeyFor, isoWeekKeyFor, previousDayKey } from "./daily-challenge-calendar"

describe("daily calendar (UTC+7)", () => {
  it("rolls the day over at midnight Vietnam time, not UTC", () => {
    expect(dayKeyFor(new Date("2026-10-27T16:59:59Z"))).toBe("20261027")
    expect(dayKeyFor(new Date("2026-10-27T17:00:00Z"))).toBe("20261028")
  })

  it("steps back across month and year boundaries", () => {
    expect(previousDayKey("20261101")).toBe("20261031")
    expect(previousDayKey("20260101")).toBe("20251231")
    expect(previousDayKey("20240301")).toBe("20240229")
  })

  it("uses ISO weeks starting on Monday", () => {
    expect(isoWeekKeyFor(new Date("2026-10-26T01:00:00Z"))).toBe("2026-W44") // thứ Hai
    expect(isoWeekKeyFor(new Date("2026-11-01T16:00:00Z"))).toBe("2026-W44") // CN 23:00 giờ VN
    expect(isoWeekKeyFor(new Date("2026-11-01T17:00:00Z"))).toBe("2026-W45") // thứ Hai 00:00 giờ VN
    expect(isoWeekKeyFor(new Date("2027-01-01T05:00:00Z"))).toBe("2026-W53") // tuần 53 của 2026
  })

  it("derives a stable daily seed that depends on the secret and the day", () => {
    expect(dailySeedFor("20261027", "s1")).toBe(dailySeedFor("20261027", "s1"))
    expect(dailySeedFor("20261027", "s1")).not.toBe(dailySeedFor("20261028", "s1"))
    expect(dailySeedFor("20261027", "s1")).not.toBe(dailySeedFor("20261027", "s2"))
    expect(dailySeedFor("20261027", "s1")).toBeGreaterThanOrEqual(0)
    expect(dailySeedFor("20261027", "s1")).toBeLessThan(2 ** 32)
  })
})

describe("daily streak", () => {
  it("starts, extends on consecutive days, and restarts after a gap", () => {
    const day1 = advanceDailyStreak(EMPTY_DAILY_STREAK, "20261030")
    const day2 = advanceDailyStreak(day1, "20261031")
    const day3 = advanceDailyStreak(day2, "20261101")
    expect(day3).toEqual({ current: 3, best: 3, lastDailyDay: "20261101" })
    expect(advanceDailyStreak(day3, "20261103")).toEqual({ current: 1, best: 3, lastDailyDay: "20261103" })
  })

  it("does not count the same day twice", () => {
    const once = advanceDailyStreak(EMPTY_DAILY_STREAK, "20261027")
    expect(advanceDailyStreak(once, "20261027")).toBe(once)
  })

  it("stays alive until the end of the next day, then shows 0 but keeps the best", () => {
    const streak = { current: 4, best: 6, lastDailyDay: "20261027" }
    expect(effectiveDailyStreak(streak, "20261027").current).toBe(4)
    expect(effectiveDailyStreak(streak, "20261028").current).toBe(4)
    expect(effectiveDailyStreak(streak, "20261029")).toEqual({ current: 0, best: 6, lastDailyDay: "20261027" })
  })
})
