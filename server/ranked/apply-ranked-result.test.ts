import { describe, expect, it } from "vitest"

import { parseStoredPlayer } from "@/server/profile/stored-player-document"

import { forfeitedRating, rankedOutcome } from "./ranked-outcome"

const session = { ghostScore: 1000, ghostMmr: 1000, ghostUid: "g", ghostIsBot: false }
const stored = parseStoredPlayer({ rankedOpenGameId: "game1" })
const base = { gameId: "game1", session, stored, score: 1500, durationMs: 120_000, playSpanMs: 110_000, flagged: false, season: "2026-Q4" }

describe("rankedOutcome", () => {
  it("wins on a higher score and counts a placement", () => {
    const outcome = rankedOutcome(base)
    expect(outcome.reward.result).toBe("win")
    expect(outcome.rating.placements).toBe(1)
    expect(outcome.reward.placementsLeft).toBe(2)
    expect(outcome.current).toBe(true)
  })

  it("loses when late or flagged", () => {
    expect(rankedOutcome({ ...base, durationMs: 400_000 })).toMatchObject({ late: true, reward: { result: "loss" } })
    expect(rankedOutcome({ ...base, flagged: true }).reward.result).toBe("loss")
    // Nộp đúng giờ nhưng nhịp client cho thấy đã chơi quá 3 phút.
    expect(rankedOutcome({ ...base, durationMs: 185_000, playSpanMs: 200_000 })).toMatchObject({ late: true, reward: { result: "loss" } })
    expect(rankedOutcome({ ...base, durationMs: 200_000, playSpanMs: null }).late).toBe(false)
  })

  it("forfeits the open match on a broken or empty log", () => {
    const rating = forfeitedRating({ gameId: "game1", session, stored, season: "2026-Q4" })
    expect(rating).toMatchObject({ placements: 1, losses: 1 })
    expect(forfeitedRating({ gameId: "other", session, stored, season: "2026-Q4" })).toBeNull()
  })

  it("does not touch the rating for a match already forfeited", () => {
    const outcome = rankedOutcome({ ...base, gameId: "other" })
    expect(outcome.current).toBe(false)
    expect(outcome.rating.placements).toBe(0)
  })
})
