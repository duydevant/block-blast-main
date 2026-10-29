import { describe, expect, it } from "vitest"

import { isoWeekKeyForDay, weekDayKeysFor } from "@/lib/vn-calendar"

import {
  DAILY_RECORD_COINS,
  DAILY_STAR_COINS,
  dailyFormFor,
  dailyGoalsFor,
  dailyRunReward,
  DEFAULT_DAILY_FORM,
  nextDailyGoal,
  recentBestsBefore,
  starsForScore,
  weekChestStatuses,
  weekRankCoins,
  withRecentBest,
} from "./daily-challenge-goals"

describe("daily challenge goals", () => {
  it("uses the median of the last seven played days, so one lucky or bad day barely moves the bar", () => {
    expect(dailyFormFor([])).toBe(DEFAULT_DAILY_FORM)
    expect(dailyFormFor([4000, 3000, 9000])).toBe(4000)
    expect(dailyFormFor([4000, 3000])).toBe(3500)
    // Ngày thứ 8 trở về trước không tính.
    expect(dailyFormFor([1000, 1000, 1000, 1000, 1000, 1000, 1000, 99999])).toBe(1000)
    expect(dailyFormFor([200, 5000, 5000, 5000])).toBe(5000)
  })

  it("sets rising targets at 70% / 110% / 150% of form, rounded to 50, and the all-time best as the record", () => {
    expect(dailyGoalsFor([4000], 7200)).toEqual({ form: 4000, targets: [2800, 4400, 6000], record: 7200 })
    expect(dailyGoalsFor([], null)).toEqual({ form: 1500, targets: [1050, 1650, 2250], record: null })
    // Phong độ rất thấp: mốc vẫn tăng dần.
    expect(dailyGoalsFor([20], 20).targets).toEqual([50, 100, 150])
  })

  it("pays each star and the record once per day across the three runs", () => {
    const goals = dailyGoalsFor([4000], 5000)
    const first = dailyRunReward(goals, { stars: 0, recordBroken: false }, 3000)
    expect(first).toEqual({ progress: { stars: 1, recordBroken: false }, newStars: 1, recordBroken: false, coins: DAILY_STAR_COINS[0] })

    const second = dailyRunReward(goals, first.progress, 6100)
    expect(second.newStars).toBe(2)
    expect(second.recordBroken).toBe(true)
    expect(second.coins).toBe(DAILY_STAR_COINS[1] + DAILY_STAR_COINS[2] + DAILY_RECORD_COINS)

    // Lượt thứ ba kém hơn: không mất sao, không thưởng lại.
    const third = dailyRunReward(goals, second.progress, 2000)
    expect(third).toEqual({ progress: { stars: 3, recordBroken: true }, newStars: 0, recordBroken: false, coins: 0 })
  })

  it("never pays a record to a first-time player and points the HUD to the next goal", () => {
    const goals = dailyGoalsFor([], null)
    expect(dailyRunReward(goals, { stars: 0, recordBroken: false }, 99999).recordBroken).toBe(false)
    expect(starsForScore(goals, 1650)).toBe(2)
    expect(nextDailyGoal(goals, 1700)).toEqual({ kind: "star", stars: 3, target: 2250 })
    expect(nextDailyGoal(goals, 3000)).toBeNull()
    expect(nextDailyGoal(dailyGoalsFor([1000], 4000), 3000)).toEqual({ kind: "record", target: 4001 })
  })

  it("gives week rewards by rank tier and chests by stars", () => {
    expect([1, 2, 3, 10, 100, 101].map(weekRankCoins)).toEqual([1000, 500, 500, 300, 100, 30])
    expect(weekRankCoins(null)).toBe(0)
    expect(weekChestStatuses(12, [0]).map((chest) => [chest.reached, chest.claimed])).toEqual([[true, true], [false, false]])
  })

  it("keeps the last eight played days on the player and reads only days before today", () => {
    let recent = {}
    for (let day = 20; day <= 30; day++) recent = withRecentBest(recent, `202610${day}`, day * 100)
    expect(Object.keys(recent)).toEqual(["20261023", "20261024", "20261025", "20261026", "20261027", "20261028", "20261029", "20261030"])
    // Lượt sau trong ngày thấp hơn không hạ điểm ngày.
    expect(withRecentBest(recent, "20261030", 10)["20261030"]).toBe(3000)
    expect(recentBestsBefore(recent, "20261030")).toEqual([2900, 2800, 2700, 2600, 2500, 2400, 2300])
  })

  it("maps a day to its ISO week in Vietnam time", () => {
    expect(weekDayKeysFor("20261029")).toEqual(["20261026", "20261027", "20261028", "20261029", "20261030", "20261031", "20261101"])
    expect(isoWeekKeyForDay("20261101")).toBe("2026-W44")
    expect(isoWeekKeyForDay("20261102")).toBe("2026-W45")
    expect(isoWeekKeyForDay("20270103")).toBe("2026-W53")
  })
})
