import { describe, expect, it } from "vitest"

import type { ReplaySummary } from "@/modules/block-puzzle/engine/replay-recorded-game-actions"
import { EMPTY_DAILY_STREAK, EMPTY_PLAYER_STATS } from "@/modules/player-profile/player-profile-types"
import { applyVerifiedGameToPlayerStats } from "@/server/games/apply-verified-game-to-player-stats"

import { parseStoredPlayer, resolveStashUnlockedForNewGame, toPlayerProfile } from "./stored-player-document"

const game: ReplaySummary = {
  score: 840,
  moveCount: 60,
  linesCleared: 22,
  bestCombo: 4,
  boardClears: 1,
  isGameOver: true,
  stashUnlocked: true,
  runStats: { clearMoves: 10, multiClears: [3, 1, 0], maxLinesInMove: 3, bestCombo: 4, boardClears: 1, stashUses: 0, replaceUses: 0, reviveUsed: false },
}

describe("parseStoredPlayer", () => {
  it("returns defaults for a missing document", () => {
    expect(parseStoredPlayer(undefined)).toEqual({
      displayName: null,
      stashUnlocked: false,
      stats: EMPTY_PLAYER_STATS,
      streak: EMPTY_DAILY_STREAK,
      xp: 0,
      coins: 0,
      unlockedThemes: [],
      achievements: [],
      referralCode: null,
      referredBy: null,
      referralRewarded: false,
      referralGames: 0,
      referralCount: 0,
      levelStars: {},
      duelStats: { played: 0, won: 0 },
      dailyBest: 0,
      recentFormScores: [],
      tierRewardsClaimed: [],
      statsByMode: {},
      dailyThreeStarDays: 0,
    })
  })

  it("keeps only valid level stars", () => {
    expect(parseStoredPlayer({ levelStars: { "1": 3, "2": 2 } }).levelStars).toEqual({ "1": 3, "2": 2 })
    expect(parseStoredPlayer({ levelStars: { "1": 9 } }).levelStars).toEqual({})
  })

  it("never exposes the inviter uid or referral bookkeeping in the public profile", () => {
    const profile = toPlayerProfile("u1", parseStoredPlayer({ referredBy: "secret-uid", referralCode: "ABC234", coins: 40 }), "20261028")
    expect(JSON.stringify(profile)).not.toContain("secret-uid")
    expect(profile).toMatchObject({ referred: true, coins: 40 })
    expect(profile).not.toHaveProperty("referralRewarded")
  })

  it("keeps valid fields and resets only the broken ones", () => {
    const stored = parseStoredPlayer({
      displayName: "Duy",
      stashUnlocked: "yes",
      stats: { ...EMPTY_PLAYER_STATS, gamesPlayed: 3, bestScore: -5 },
    })
    expect(stored.displayName).toBe("Duy")
    expect(stored.stashUnlocked).toBe(false)
    expect(stored.stats.gamesPlayed).toBe(3)
    expect(stored.stats.bestScore).toBe(0)
  })
})

describe("resolveStashUnlockedForNewGame", () => {
  const fresh = parseStoredPlayer(undefined)
  const veteran = { ...fresh, stats: { ...EMPTY_PLAYER_STATS, gamesPlayed: 4 } }

  it("trusts the local unlock only before the first cloud game", () => {
    expect(resolveStashUnlockedForNewGame(fresh, true)).toBe(true)
    expect(resolveStashUnlockedForNewGame(veteran, true)).toBe(false)
  })

  it("always honours a server-side unlock", () => {
    expect(resolveStashUnlockedForNewGame({ ...veteran, stashUnlocked: true }, false)).toBe(true)
  })
})

describe("applyVerifiedGameToPlayerStats", () => {
  it("accumulates totals and keeps maxima", () => {
    const once = applyVerifiedGameToPlayerStats(EMPTY_PLAYER_STATS, game)
    const twice = applyVerifiedGameToPlayerStats(once, { ...game, score: 300, bestCombo: 2 })
    expect(twice).toEqual({
      gamesPlayed: 2,
      bestScore: 840,
      totalScore: 1140,
      totalLinesCleared: 44,
      bestCombo: 4,
      boardClears: 2,
      totalMoves: 120,
      pureGames: 2,
      bestPureScore: 840,
      multiClears3: 2,
      maxLinesInMove: 3,
    })
  })
})
