import { describe, expect, it } from "vitest"

import { currentRecapYear, isRecapOpen, recapWindowFor } from "@/modules/recap/recap-window"
import { parseStoredPlayer } from "@/server/profile/stored-player-document"

import { buildYearRecap } from "./build-year-recap"

describe("recap window (giờ VN)", () => {
  it("opens on Dec 15 and closes after Jan 15", () => {
    const { startMs, endMs } = recapWindowFor(2026)
    expect(startMs).toBe(Date.parse("2026-12-14T17:00:00Z"))
    expect(endMs).toBe(Date.parse("2027-01-15T17:00:00Z"))
    expect(isRecapOpen(2026, Date.parse("2026-12-14T16:59:59Z"))).toBe(false)
    expect(isRecapOpen(2026, Date.parse("2026-12-14T17:00:00Z"))).toBe(true)
    expect(isRecapOpen(2026, Date.parse("2027-01-15T16:59:59Z"))).toBe(true)
    expect(isRecapOpen(2026, Date.parse("2027-01-15T17:00:00Z"))).toBe(false)
  })

  it("picks the year being recapped", () => {
    expect(currentRecapYear(Date.parse("2026-12-20T05:00:00Z"))).toBe(2026)
    expect(currentRecapYear(Date.parse("2027-01-05T05:00:00Z"))).toBe(2026)
    expect(currentRecapYear(Date.parse("2026-10-30T05:00:00Z"))).toBeNull()
  })
})

describe("buildYearRecap", () => {
  it("returns empty for a year without games", () => {
    expect(buildYearRecap(2026, undefined, parseStoredPlayer({}))).toEqual({ empty: true, year: 2026 })
    expect(buildYearRecap(2026, { games: 0 }, parseStoredPlayer({}))).toEqual({ empty: true, year: 2026 })
  })

  it("merges year counters with profile highlights", () => {
    const stored = parseStoredPlayer({
      streak: { current: 2, best: 12, lastDailyDay: null },
      tierRewardsClaimed: ["bronze", "silver", "gold"],
      arena: { speed: 2, combo: 3 },
      levelStars: { "1": 3, "2": 2 },
    })
    const recap = buildYearRecap(2026, { games: 40, totalScore: 50000, bestScore: 4000, bestCombo: 12, days: 18, modes: { classic: 25, daily: 15 } }, stored)
    expect(recap).toMatchObject({
      empty: false,
      games: 40,
      bestScore: 4000,
      days: 18,
      favoriteMode: "classic",
      longestStreak: 12,
      highestTier: "gold",
      arenaPoints: 5,
      levelStars: 5,
    })
  })
})
