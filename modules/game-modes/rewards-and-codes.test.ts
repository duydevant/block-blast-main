import { describe, expect, it } from "vitest"

import { DUEL_ID_PATTERN, normalizeDuelCode } from "@/modules/duel/duel-types"
import { DAILY_REWARD_TRACK, dailyRewardCoins, dailyRewardDay } from "@/modules/progression/daily-reward-track"
import { isoWeekKeyFor, nextWeekStartMs } from "@/server/daily/daily-challenge-calendar"
import { boardIdsForRankedGame, isEventWeekOpen } from "@/server/leaderboards/leaderboard-board-ids"

import { EVENT_PARTICIPATION_COINS, EVENT_SCORE_MILESTONES, eventRankRewardCoins, milestoneStatuses } from "./event-rewards"

describe("daily reward track", () => {
  it("walks a 7-day cycle by streak and restarts after day 7", () => {
    expect([0, 1, 2, 7, 8, 14, 15].map(dailyRewardDay)).toEqual([1, 1, 2, 7, 1, 7, 1])
    expect(dailyRewardCoins(1)).toBe(DAILY_REWARD_TRACK[0])
    expect(dailyRewardCoins(7)).toBe(DAILY_REWARD_TRACK[6])
    expect(Math.max(...DAILY_REWARD_TRACK)).toBe(DAILY_REWARD_TRACK[6])
  })
})

describe("event rewards", () => {
  it("pays the best matching rank tier, participation otherwise, nothing without a score", () => {
    expect(eventRankRewardCoins(1)).toBe(1000)
    expect(eventRankRewardCoins(2)).toBe(500)
    expect(eventRankRewardCoins(10)).toBe(300)
    expect(eventRankRewardCoins(100)).toBe(100)
    expect(eventRankRewardCoins(101)).toBe(EVENT_PARTICIPATION_COINS)
    expect(eventRankRewardCoins(null)).toBe(0)
  })

  it("marks milestones reached by the week's best score and keeps claimed ones", () => {
    const statuses = milestoneStatuses(3500, [0])
    expect(statuses.map((item) => [item.reached, item.claimed])).toEqual([
      [true, true],
      [true, false],
      [false, false],
    ])
    expect(milestoneStatuses(null, []).every((item) => !item.reached)).toBe(true)
    expect(statuses).toHaveLength(EVENT_SCORE_MILESTONES.length)
  })

  it("ends the event at Monday 00:00 Vietnam time (17:00 UTC Sunday)", () => {
    const wednesday = new Date("2026-10-28T09:00:00Z")
    const end = nextWeekStartMs(wednesday)
    expect(new Date(end).toISOString()).toBe("2026-11-01T17:00:00.000Z")
    expect(isoWeekKeyFor(new Date(end))).not.toBe(isoWeekKeyFor(wednesday))
    expect(isoWeekKeyFor(new Date(end - 1))).toBe(isoWeekKeyFor(wednesday))
  })
})

describe("event board closing", () => {
  it("accepts late event runs for one hour after the week ends, then the board is closed", () => {
    const weekEnd = new Date("2026-11-01T17:00:00Z")
    expect(isEventWeekOpen("2026-W44", new Date(weekEnd.getTime() + 30 * 60 * 1000))).toBe(true)
    expect(isEventWeekOpen("2026-W44", new Date(weekEnd.getTime() + 61 * 60 * 1000))).toBe(false)
    expect(boardIdsForRankedGame("event", new Date(weekEnd.getTime() + 2 * 60 * 60 * 1000), null, false, "2026-W44")).toEqual([])
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
