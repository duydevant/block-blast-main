import { describe, expect, it } from "vitest"

import { BLOCK_THEME_IDS } from "@/modules/block-puzzle/render/block-color-palette"
import { EMPTY_PLAYER_STATS } from "@/modules/player-profile/player-profile-types"

import { ACHIEVEMENT_CATEGORIES, ACHIEVEMENTS, type AchievementState, newlyMetAchievements } from "./achievement-catalog"
import {
  advanceDailyMissions,
  DAILY_MISSION_COUNT,
  dailyMissionProgressSchema,
  dailyMissionsForDay,
  type MissionGameResult,
} from "./daily-mission-catalog"
import { levelForXp, levelProgressForXp, totalXpForLevel, xpForVerifiedGame } from "./player-level-curve"
import { normalizeReferralCode } from "./referral-rules"
import { isThemeOwned, THEME_UNLOCKS } from "./theme-unlock-rules"

const game = (overrides: Partial<MissionGameResult> = {}): MissionGameResult => ({
  moveCount: 20,
  score: 0,
  linesCleared: 0,
  bestCombo: 0,
  boardClears: 0,
  countedDaily: false,
  pure: false,
  multiClears3: 0,
  levelThreeStars: false,
  isDuel: false,
  dailyStars: 0,
  ...overrides,
})

const baseAchievementState: AchievementState = {
  stats: EMPTY_PLAYER_STATS,
  bestStreak: 0,
  level: 1,
  referralCount: 0,
  levelStarsTotal: 0,
  duelWins: 0,
  highestTier: "unranked",
  todayGames1000: 0,
  dailyThreeStarDays: 0,
}

describe("level curve", () => {
  it("maps XP to levels at exact thresholds", () => {
    expect([0, 99, 100, 299, 300, 600].map(levelForXp)).toEqual([1, 1, 2, 2, 3, 4])
    for (let level = 1; level < 60; level++) {
      expect(levelForXp(totalXpForLevel(level))).toBe(level)
      expect(levelForXp(totalXpForLevel(level + 1) - 1)).toBe(level)
    }
  })

  it("reports progress inside the current level", () => {
    expect(levelProgressForXp(350)).toEqual({ level: 3, xpIntoLevel: 50, xpForNextLevel: 300 })
  })

  it("gives 10 XP per game plus 1 per 100 points, capped at 100", () => {
    expect([0, 99, 1500, 50_000].map((score) => xpForVerifiedGame(score, 30))).toEqual([10, 10, 25, 100])
  })

  it("skips the per-game XP for games shorter than the minimum", () => {
    expect(xpForVerifiedGame(150, 3)).toBe(1)
  })
})

describe("daily missions", () => {
  it("picks the same three missions of different kinds for everyone on a day", () => {
    const missions = dailyMissionsForDay("20261028")
    expect(missions).toHaveLength(DAILY_MISSION_COUNT)
    expect(new Set(missions.map((item) => item.kind)).size).toBe(DAILY_MISSION_COUNT)
    expect(dailyMissionsForDay("20261028")).toEqual(missions)
  })

  it("varies across days", () => {
    const sets = new Set(Array.from({ length: 14 }, (_, i) => dailyMissionsForDay(`202611${String(i + 1).padStart(2, "0")}`).map((m) => m.id).join()))
    expect(sets.size).toBeGreaterThan(5)
  })

  it("sums cumulative missions, keeps the best single game for score/combo and completes once", () => {
    const missions = [
      { id: "lines-20", kind: "lines", target: 20, coins: 25, xp: 30 },
      { id: "score-1500", kind: "score", target: 1500, coins: 25, xp: 30 },
      { id: "daily-1", kind: "daily", target: 1, coins: 30, xp: 40 },
    ] as const
    const first = advanceDailyMissions([...missions], {}, game({ linesCleared: 12, score: 900 }))
    expect(first.progress).toEqual({ "lines-20": 12, "score-1500": 900, "daily-1": 0 })
    expect(first.completed).toEqual([])

    const second = advanceDailyMissions([...missions], first.progress, game({ linesCleared: 12, score: 400, countedDaily: true }))
    expect(second.progress).toEqual({ "lines-20": 20, "score-1500": 900, "daily-1": 1 })
    expect(second.completed.map((item) => item.id)).toEqual(["lines-20", "daily-1"])

    const third = advanceDailyMissions([...missions], second.progress, game({ linesCleared: 30, score: 2000, countedDaily: true }))
    expect(third.completed.map((item) => item.id)).toEqual(["score-1500"])
  })

  it("does not count very short games toward 'play N games'", () => {
    const missions = [{ id: "games-3", kind: "games", target: 3, coins: 20, xp: 30 }] as const
    expect(advanceDailyMissions([...missions], {}, game({ moveCount: 2 })).progress).toEqual({ "games-3": 0 })
    expect(advanceDailyMissions([...missions], {}, game({ moveCount: 10 })).progress).toEqual({ "games-3": 1 })
  })

  it("treats a missing or corrupt progress doc as empty", () => {
    expect(dailyMissionProgressSchema.parse(undefined)).toEqual({})
    expect(dailyMissionProgressSchema.parse({ "lines-20": -3 })).toEqual({})
  })
})

describe("achievements", () => {
  it("unlocks only new achievements that are met", () => {
    const state = { ...baseAchievementState, stats: { ...EMPTY_PLAYER_STATS, gamesPlayed: 1, bestCombo: 16 } }
    expect(newlyMetAchievements([], state).map((item) => item.id)).toEqual(["first-game", "combo-15"])
    expect(newlyMetAchievements(["first-game"], state).map((item) => item.id)).toEqual(["combo-15"])
  })

  it("covers style, tier and marathon achievements", () => {
    const state = {
      ...baseAchievementState,
      stats: { ...EMPTY_PLAYER_STATS, bestPureScore: 2500, maxLinesInMove: 4 },
      highestTier: "gold" as const,
      todayGames1000: 10,
      levelStarsTotal: 30,
    }
    expect(newlyMetAchievements([], state).map((item) => item.id).sort()).toEqual(
      ["marathon", "pure-2000", "quad-clear", "stars-30", "tier-gold"].sort()
    )
  })

  it("groups every achievement into a known category", () => {
    expect(ACHIEVEMENTS.every((item) => ACHIEVEMENT_CATEGORIES.includes(item.category))).toBe(true)
  })

  it("has unique ids", () => {
    expect(new Set(ACHIEVEMENTS.map((item) => item.id)).size).toBe(ACHIEVEMENTS.length)
  })
})

describe("theme unlocks", () => {
  it("covers every theme and checks ownership by kind", () => {
    expect(Object.keys(THEME_UNLOCKS).sort()).toEqual([...BLOCK_THEME_IDS].sort())
    const owner = { level: 4, unlockedThemes: ["forest"] }
    expect(isThemeOwned("classic", owner)).toBe(true)
    expect(isThemeOwned("sunset", owner)).toBe(false)
    expect(isThemeOwned("sunset", { ...owner, level: 5 })).toBe(true)
    expect(isThemeOwned("forest", owner)).toBe(true)
    expect(isThemeOwned("galaxy", owner)).toBe(false)
    expect(isThemeOwned("gold", owner)).toBe(false)
  })
})

describe("referral codes", () => {
  it("normalizes case and rejects ambiguous characters", () => {
    expect(normalizeReferralCode(" abc234 ")).toBe("ABC234")
    expect(normalizeReferralCode("ABC10O")).toBeNull()
    expect(normalizeReferralCode("ABCDEFG")).toBeNull()
  })
})
