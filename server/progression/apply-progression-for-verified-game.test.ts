import { describe, expect, it } from "vitest"

import type { ReplaySummary } from "@/modules/block-puzzle/engine/replay-recorded-game-actions"
import { EMPTY_DAILY_STREAK, EMPTY_PLAYER_STATS } from "@/modules/player-profile/player-profile-types"
import { dailyMissionsForDay } from "@/modules/progression/daily-mission-catalog"
import { COINS_PER_LEVEL_STAR } from "@/modules/game-modes/level-catalog"
import { MAX_REWARDED_REFERRALS, REFERRAL_COINS } from "@/modules/progression/referral-rules"
import { parseStoredPlayer } from "@/server/profile/stored-player-document"

import { applyVerifiedGameToPlayerStats } from "../games/apply-verified-game-to-player-stats"
import { applyProgressionForVerifiedGame, type ProgressionInput } from "./apply-progression-for-verified-game"

const DAY = "20261028"
const summary = (overrides: Partial<ReplaySummary> = {}): ReplaySummary => ({
  score: 500,
  moveCount: 20,
  linesCleared: 4,
  bestCombo: 1,
  boardClears: 0,
  isGameOver: true,
  stashUnlocked: false,
  ...overrides,
})

function input(overrides: Partial<ProgressionInput> = {}): ProgressionInput {
  const stored = overrides.stored ?? parseStoredPlayer({})
  const game = overrides.summary ?? summary()
  return {
    stored,
    stats: applyVerifiedGameToPlayerStats(stored.stats, game),
    streak: EMPTY_DAILY_STREAK,
    summary: game,
    countedDaily: false,
    missionDay: DAY,
    missionProgress: {},
    inviter: null,
    ...overrides,
  }
}

describe("applyProgressionForVerifiedGame", () => {
  it("gives game XP, the first-game achievement and records mission progress", () => {
    const result = applyProgressionForVerifiedGame(input())
    expect(result.rewards.xp).toBe(15)
    expect(result.rewards.achievements).toEqual(["first-game"])
    expect(result.rewards.coins).toBe(20)
    expect(result.playerFields).toMatchObject({ xp: 15, coins: 20, achievements: ["first-game"] })
    expect(Object.keys(result.missionProgress).sort()).toEqual(dailyMissionsForDay(DAY).map((item) => item.id).sort())
    expect(result.inviterReward).toBeNull()
  })

  it("pays completed missions, then level-up coins for the XP they add", () => {
    const missions = dailyMissionsForDay(DAY)
    const almostDone = Object.fromEntries(missions.map((item) => [item.id, item.target - 1]))
    const stored = parseStoredPlayer({ xp: 90, achievements: ["first-game"], stats: { ...EMPTY_PLAYER_STATS, gamesPlayed: 5 } })
    const big = summary({ score: 5000, linesCleared: 60, bestCombo: 16, boardClears: 2 })
    const result = applyProgressionForVerifiedGame(input({ stored, summary: big, countedDaily: true, missionProgress: almostDone }))

    expect(result.rewards.missions.sort()).toEqual(missions.map((item) => item.id).sort())
    const missionXp = missions.reduce((sum, item) => sum + item.xp, 0)
    expect(result.rewards.xp).toBe(60 + missionXp)
    expect(result.rewards.levelUp).not.toBeNull()
    expect(result.rewards.achievements).toEqual(["score-5000", "combo-15"])
  })

  it("does not repay a mission that was already complete", () => {
    const missions = dailyMissionsForDay(DAY)
    const done = Object.fromEntries(missions.map((item) => [item.id, item.target]))
    const stored = parseStoredPlayer({ achievements: ["first-game"] })
    const result = applyProgressionForVerifiedGame(input({ stored, missionProgress: done }))
    expect(result.rewards.missions).toEqual([])
    expect(result.rewards.coins).toBe(0)
  })

  it("pays the referral once, on the invitee's third verified game, to both players", () => {
    const stored = parseStoredPlayer({ referredBy: "inviter", referralGames: 2, achievements: ["first-game"], stats: { ...EMPTY_PLAYER_STATS, gamesPlayed: 2 } })
    const inviter = parseStoredPlayer({ referralCount: 2, achievements: ["referral-1"] })
    const result = applyProgressionForVerifiedGame(input({ stored, inviter }))
    expect(result.rewards.referralBonus).toBe(true)
    expect(result.rewards.coins).toBe(REFERRAL_COINS)
    expect(result.playerFields).toMatchObject({ referralRewarded: true, unlockedThemes: ["gold"] })
    expect(result.inviterReward).toEqual({ coins: REFERRAL_COINS, addTheme: "gold", achievements: [] })
    expect(result.playerFields.referralGames).toBe(3)

    const again = applyProgressionForVerifiedGame(input({ stored: { ...stored, referralRewarded: true }, inviter }))
    expect(again.rewards.referralBonus).toBe(false)
    expect(again.inviterReward).toBeNull()
  })

  it("stops paying coins to an inviter past the cap but still gives the theme", () => {
    const stored = parseStoredPlayer({ referredBy: "inviter", referralGames: 2, achievements: ["first-game"] })
    const inviter = parseStoredPlayer({ referralCount: MAX_REWARDED_REFERRALS, achievements: ["referral-1"] })
    expect(applyProgressionForVerifiedGame(input({ stored, inviter })).inviterReward).toEqual({ coins: 0, addTheme: "gold", achievements: [] })
  })

  it("gives the inviter their first-referral achievement right away", () => {
    const stored = parseStoredPlayer({ referredBy: "inviter", referralGames: 2, achievements: ["first-game"] })
    const inviter = parseStoredPlayer({ referralCount: 0, achievements: ["first-game"] })
    expect(applyProgressionForVerifiedGame(input({ stored, inviter })).inviterReward).toEqual({
      coins: REFERRAL_COINS + 50,
      addTheme: "gold",
      achievements: ["referral-1"],
    })
  })

  it("does not count very short games toward the referral", () => {
    const stored = parseStoredPlayer({ referredBy: "inviter", referralGames: 2 })
    const short = applyProgressionForVerifiedGame(input({ stored, summary: summary({ moveCount: 3 }) }))
    expect(short.rewards.referralBonus).toBe(false)
    expect(short.playerFields.referralGames).toBe(2)
  })

  it("waits for the third game before paying the referral", () => {
    const stored = parseStoredPlayer({ referredBy: "inviter" })
    const result = applyProgressionForVerifiedGame(input({ stored }))
    expect(result.rewards.referralBonus).toBe(false)
    expect(result.playerFields.referralGames).toBe(1)
  })

  it("pays coins only for newly earned level stars", () => {
    const stored = parseStoredPlayer({ achievements: ["first-game"], levelStars: { "3": 1 } })
    const better = applyProgressionForVerifiedGame(input({ stored, level: { id: 3, stars: 3 } }))
    expect(better.rewards.level).toEqual({ id: 3, stars: 3, improved: true })
    expect(better.playerFields.levelStars).toEqual({ "3": 3 })
    expect(better.rewards.coins).toBe(2 * COINS_PER_LEVEL_STAR)

    const worse = applyProgressionForVerifiedGame(input({ stored, level: { id: 3, stars: 1 } }))
    expect(worse.rewards.level?.improved).toBe(false)
    expect(worse.rewards.coins).toBe(0)
    expect(worse.playerFields.levelStars).toEqual({ "3": 1 })
  })
})
