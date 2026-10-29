import { describe, expect, it } from "vitest"

import { EMPTY_RUN_STATS } from "@/modules/block-puzzle/engine/game-run-stats"
import type { ReplaySummary } from "@/modules/block-puzzle/engine/replay-recorded-game-actions"
import {
  dailyMissionsForDay,
  DAILY_MISSION_COUNT,
  missionBandForTier,
  MISSION_BANDS,
} from "@/modules/progression/daily-mission-catalog"
import { parseStoredPlayer } from "@/server/profile/stored-player-document"
import { parseMissionDay } from "@/server/progression/mission-day-documents"

import { countsTowardForm, verifiedGamePlayerUpdates } from "./verified-game-player-updates"

const summary = (score: number, moveCount = 30): ReplaySummary => ({
  score,
  moveCount,
  linesCleared: 0,
  bestCombo: 0,
  boardClears: 0,
  isGameOver: true,
  stashUnlocked: false,
  runStats: EMPTY_RUN_STATS,
})

const base = { countsForDaily: false, firstDailyRun: true, dailyReward: null }

describe("countsTowardForm", () => {
  it("counts endless games and only the first counted daily run, including short games", () => {
    expect(countsTowardForm("classic", false, true, 1)).toBe(true)
    expect(countsTowardForm("classic", false, true, 0)).toBe(false)
    expect(countsTowardForm("daily", true, true, 20)).toBe(true)
    expect(countsTowardForm("daily", true, false, 20)).toBe(false)
    expect(countsTowardForm("level", false, true, 20)).toBe(false)
    expect(countsTowardForm("duel", false, true, 20)).toBe(false)
  })
})

describe("verifiedGamePlayerUpdates", () => {
  it("adds the score to the form window and ranks the player after 10 games", () => {
    const stored = parseStoredPlayer({ recentFormScores: Array(9).fill(1600) })
    const updates = verifiedGamePlayerUpdates({ ...base, stored, summary: summary(200), mode: "classic", missionDay: parseMissionDay(undefined) })
    expect(updates.recentFormScores).toHaveLength(10)
    expect(updates.tierAfter).toBe("gold")
    expect(updates.statsByMode.classic).toEqual({ games: 1, best: 200, total: 200 })
  })

  it("keeps the band fixed for the day and counts marathon games", () => {
    const stored = parseStoredPlayer({ recentFormScores: Array(20).fill(7000) })
    const fresh = verifiedGamePlayerUpdates({ ...base, stored, summary: summary(1200), mode: "level", missionDay: parseMissionDay(undefined) })
    expect(fresh.missionBand).toBe(3)
    expect(fresh.firstGameToday).toBe(true)
    expect(fresh.games1000).toBe(1)
    const locked = verifiedGamePlayerUpdates({
      ...base,
      stored,
      summary: summary(500),
      mode: "classic",
      missionDay: parseMissionDay({ band: 1, gamesToday: 4, games1000: 2 }),
    })
    expect(locked.missionBand).toBe(1)
    expect(locked.firstGameToday).toBe(false)
    expect(locked.games1000).toBe(2)
    expect(locked.gamesToday).toBe(5)
  })

  it("counts a new three-star daily day once", () => {
    const stored = parseStoredPlayer({ dailyThreeStarDays: 2 })
    const missionDay = parseMissionDay(undefined)
    const reward = (stars: number, newStars: number) => ({ run: 1, stars, newStars, recordBroken: false, coins: 0 })
    const input = { ...base, stored, summary: summary(3000), mode: "daily" as const, missionDay }
    expect(verifiedGamePlayerUpdates({ ...input, dailyReward: reward(3, 1) }).dailyThreeStarDays).toBe(3)
    expect(verifiedGamePlayerUpdates({ ...input, dailyReward: reward(3, 0) }).dailyThreeStarDays).toBe(2)
  })
})

describe("mission bands and replacement", () => {
  it("maps tiers to bands", () => {
    expect(missionBandForTier("unranked")).toBe(0)
    expect(missionBandForTier("silver")).toBe(1)
    expect(missionBandForTier("platinum")).toBe(2)
    expect(missionBandForTier("master")).toBe(3)
  })

  it("keeps the same kinds per day across bands with harder skill targets", () => {
    const day = "20261103"
    const kinds = dailyMissionsForDay(day, 0).map((item) => item.kind)
    for (const band of MISSION_BANDS) expect(dailyMissionsForDay(day, band).map((item) => item.kind)).toEqual(kinds)
    const scoreDay = Array.from({ length: 28 }, (_, i) => `202611${String(i + 1).padStart(2, "0")}`).find((key) =>
      dailyMissionsForDay(key).some((item) => item.kind === "score")
    )
    expect(scoreDay).toBeDefined()
    const scoreTargets = MISSION_BANDS.map((band) => dailyMissionsForDay(scoreDay!, band).find((item) => item.kind === "score")?.target)
    expect(scoreTargets).toEqual([1000, 1500, 3000, 8000])
  })

  it("replaces one slot with a new kind deterministically", () => {
    const day = "20261103"
    const before = dailyMissionsForDay(day, 2)
    for (let slot = 0; slot < DAILY_MISSION_COUNT; slot++) {
      const after = dailyMissionsForDay(day, 2, slot)
      expect(after).toEqual(dailyMissionsForDay(day, 2, slot))
      expect(after.filter((_, index) => index !== slot)).toEqual(before.filter((_, index) => index !== slot))
      expect(new Set(after.map((item) => item.kind)).size).toBe(DAILY_MISSION_COUNT)
      expect(before.map((item) => item.kind)).not.toContain(after[slot].kind)
    }
  })
})
