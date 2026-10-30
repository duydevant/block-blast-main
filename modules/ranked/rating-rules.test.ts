import { describe, expect, it } from "vitest"

import { applyMatch, BOT_MMR_CAP, emptyRating, leagueForLp, matchResult, mmrBucket, PLACEMENT_GAMES, rankedSeasonKeyFor, ratingForSeason } from "./rating-rules"

const human = { mmr: 1000, uid: "ghost", isBot: false }

describe("ranked rating", () => {
  it("maps quarters in VN time", () => {
    expect(rankedSeasonKeyFor(new Date("2026-09-30T16:59:00Z"))).toBe("2026-Q3")
    expect(rankedSeasonKeyFor(new Date("2026-09-30T17:00:00Z"))).toBe("2026-Q4")
  })

  it("treats near-equal scores as a draw", () => {
    expect(matchResult(1000, 990)).toBe("draw")
    expect(matchResult(1100, 1000)).toBe("win")
    expect(matchResult(800, 1000)).toBe("loss")
  })

  it("sets LP from MMR after placement games, then moves LP by results", () => {
    let rating = emptyRating("2026-Q4")
    for (let i = 0; i < PLACEMENT_GAMES; i++) {
      expect(rating.lp).toBe(0)
      rating = applyMatch(rating, human, "win").rating
    }
    expect(rating.mmr).toBeGreaterThan(1000)
    expect(rating.lp).toBeGreaterThan(200)
    const afterLoss = applyMatch(rating, human, "loss")
    expect(afterLoss.lpDelta).toBeLessThan(0)
    expect(afterLoss.rating.losses).toBe(1)
  })

  it("halves the swing against bots and remembers human opponents", () => {
    const vsHuman = applyMatch(emptyRating("s"), human, "win")
    const vsBot = applyMatch(emptyRating("s"), { mmr: 1000, uid: null, isBot: true }, "win")
    expect(vsBot.mmrDelta).toBe(Math.round(vsHuman.mmrDelta / 2))
    expect(vsHuman.rating.recentOpponents).toEqual(["ghost"])
    expect(vsBot.rating.recentOpponents).toEqual([])
  })

  it("cannot farm MMR or LP past the bot cap by beating bots", () => {
    const strong = { ...emptyRating("s"), mmr: BOT_MMR_CAP, lp: 380, placements: 10 }
    const bot = { mmr: BOT_MMR_CAP, uid: null, isBot: true }
    let rating = strong
    for (let i = 0; i < 50; i++) rating = applyMatch(rating, bot, "win").rating
    expect(rating.mmr).toBe(BOT_MMR_CAP)
    expect(rating.lp).toBeLessThanOrEqual(400)
    // Thua bot vẫn mất LP / MMR bình thường.
    const lost = applyMatch(strong, bot, "loss")
    expect(lost.mmrDelta).toBeLessThan(0)
    expect(lost.lpDelta).toBeLessThan(0)
  })

  it("soft-resets on a new quarter", () => {
    const old = { ...emptyRating("2026-Q3"), mmr: 1400, lp: 500, placements: 20, wins: 15 }
    expect(ratingForSeason(old, "2026-Q4")).toMatchObject({ season: "2026-Q4", mmr: 1300, lp: 0, placements: 0, wins: 0 })
    expect(ratingForSeason(old, "2026-Q3")).toBe(old)
  })

  it("maps LP to leagues and MMR to buckets", () => {
    expect(leagueForLp(0)).toBe("recruit")
    expect(leagueForLp(250)).toBe("knight")
    expect(leagueForLp(900)).toBe("legend")
    expect(mmrBucket(1049)).toBe(10)
  })
})
