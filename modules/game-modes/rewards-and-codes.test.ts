import { describe, expect, it } from "vitest"

import { DUEL_ID_PATTERN, normalizeDuelCode } from "@/modules/duel/duel-types"
import { DAILY_REWARD_TRACK, dailyRewardCoins, dailyRewardDay } from "@/modules/progression/daily-reward-track"
import { isoWeekKeyFor, nextWeekStartMs } from "@/server/daily/daily-challenge-calendar"
import { isChallengeWeekOpen } from "@/server/leaderboards/leaderboard-board-ids"

describe("daily reward track", () => {
  it("walks a 7-day cycle by streak and restarts after day 7", () => {
    expect([0, 1, 2, 7, 8, 14, 15].map(dailyRewardDay)).toEqual([1, 1, 2, 7, 1, 7, 1])
    expect(dailyRewardCoins(1)).toBe(DAILY_REWARD_TRACK[0])
    expect(dailyRewardCoins(7)).toBe(DAILY_REWARD_TRACK[6])
    expect(Math.max(...DAILY_REWARD_TRACK)).toBe(DAILY_REWARD_TRACK[6])
  })
})

describe("challenge week", () => {
  it("ends the week at Monday 00:00 Vietnam time (17:00 UTC Sunday)", () => {
    const wednesday = new Date("2026-10-28T09:00:00Z")
    const end = nextWeekStartMs(wednesday)
    expect(new Date(end).toISOString()).toBe("2026-11-01T17:00:00.000Z")
    expect(isoWeekKeyFor(new Date(end))).not.toBe(isoWeekKeyFor(wednesday))
    expect(isoWeekKeyFor(new Date(end - 1))).toBe(isoWeekKeyFor(wednesday))
  })

  it("accepts late runs into the week total for one hour after the week ends, then the board is closed", () => {
    const weekEnd = new Date("2026-11-01T17:00:00Z")
    expect(isChallengeWeekOpen("2026-W44", new Date(weekEnd.getTime() + 30 * 60 * 1000))).toBe(true)
    expect(isChallengeWeekOpen("2026-W44", new Date(weekEnd.getTime() + 61 * 60 * 1000))).toBe(false)
  })
})

describe("duel room codes", () => {
  it("normalizes typed codes and rejects ambiguous characters", () => {
    expect(normalizeDuelCode(" abc 234 ")).toBe("ABC234")
    expect(normalizeDuelCode("ABC10O")).toBeNull()
    expect(normalizeDuelCode("ABCDEFG")).toBeNull()
    expect(DUEL_ID_PATTERN.test("ABC234")).toBe(true)
    // Phòng cũ (id 10 ký tự) vẫn mở được bằng link.
    expect(DUEL_ID_PATTERN.test("FrDVJX9KGs")).toBe(true)
  })
})
