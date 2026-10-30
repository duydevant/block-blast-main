import { describe, expect, it } from "vitest"

import { previousSeasonKey, seasonBounds, seasonKeyFor } from "@/lib/vn-calendar"
import { parseSeasonDoc, seasonUpdatesFor } from "@/server/seasons/season-documents"

import { advanceSeasonMissions, SEASON_MISSION_COUNT, seasonMissionsFor } from "./season-mission-catalog"
import { parseSeasonBadge, seasonBadgeId, seasonRankCoins } from "./season-rules"

const game = { linesCleared: 10, firstDailyRun: false, tierAfter: "silver" as const, levelStarsGained: 0, pureScore: 0, isDuel: false, arenaWon: false }

describe("season calendar (giờ VN)", () => {
  it("switches season at midnight VN on the 1st", () => {
    expect(seasonKeyFor(new Date("2026-10-31T16:59:59Z"))).toBe("2026-10")
    expect(seasonKeyFor(new Date("2026-10-31T17:00:00Z"))).toBe("2026-11")
    expect(seasonBounds("2026-11")).toEqual({ startMs: Date.parse("2026-10-31T17:00:00Z"), endMs: Date.parse("2026-11-30T17:00:00Z") })
    expect(previousSeasonKey("2027-01")).toBe("2026-12")
  })
})

describe("season rewards", () => {
  it("pays by rank, with a participation gift for enough games", () => {
    expect(seasonRankCoins(1, 5)).toBe(2000)
    expect(seasonRankCoins(50, 0)).toBe(300)
    expect(seasonRankCoins(500, 25)).toBe(100)
    expect(seasonRankCoins(null, 3)).toBe(0)
  })

  it("only gives a badge to ranked players with enough games", () => {
    expect(seasonBadgeId("2026-11", "gold", 20)).toBe("2026-11:gold")
    expect(seasonBadgeId("2026-11", "gold", 19)).toBeNull()
    expect(seasonBadgeId("2026-11", "unranked", 40)).toBeNull()
    expect(parseSeasonBadge("2026-11:gold")).toEqual({ season: "2026-11", tier: "gold" })
  })
})

describe("season missions", () => {
  it("picks five distinct kinds per season deterministically, harder with band", () => {
    const missions = seasonMissionsFor("2026-11", 0)
    expect(missions).toHaveLength(SEASON_MISSION_COUNT)
    expect(new Set(missions.map((item) => item.kind)).size).toBe(SEASON_MISSION_COUNT)
    expect(seasonMissionsFor("2026-11", 0)).toEqual(missions)
    const hard = seasonMissionsFor("2026-11", 3)
    hard.forEach((item, index) => expect(item.target).toBeGreaterThanOrEqual(missions[index].target))
  })

  it("accumulates lines and keeps the best tier", () => {
    const missions = [
      { id: "season-lines-300", kind: "lines", target: 300, coins: 150, xp: 200 },
      { id: "season-tierReach-3", kind: "tierReach", target: 3, coins: 150, xp: 200 },
    ] as const
    let progress = advanceSeasonMissions([...missions], {}, game)
    progress = advanceSeasonMissions([...missions], progress, { ...game, tierAfter: "bronze" })
    expect(progress).toEqual({ "season-lines-300": 20, "season-tierReach-3": 2 })
  })

  it("locks the band at the first game and tracks the peak tier", () => {
    const first = seasonUpdatesFor({ season: "2026-11", doc: parseSeasonDoc(undefined), bandIfNew: 2, game })
    expect(first).toMatchObject({ band: 2, games: 1, peakTier: "silver" })
    const second = seasonUpdatesFor({ season: "2026-11", doc: parseSeasonDoc({ ...first }), bandIfNew: 0, game: { ...game, tierAfter: "bronze" } })
    expect(second).toMatchObject({ band: 2, games: 2, peakTier: "silver" })
  })
})
