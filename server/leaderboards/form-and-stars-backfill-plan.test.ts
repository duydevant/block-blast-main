import { describe, expect, it } from "vitest"

import { parseStoredPlayer } from "@/server/profile/stored-player-document"

import { type BackfillSession, isFormSession, planFormAndStarsBackfill } from "./form-and-stars-backfill-plan"

const session = (overrides: Partial<BackfillSession>): BackfillSession => ({
  gameId: "g",
  uid: "u1",
  mode: "classic",
  score: 1000,
  moveCount: 30,
  finishedAt: 0,
  dailyRun: 0,
  suspect: false,
  ...overrides,
})

describe("isFormSession", () => {
  it("counts endless games and first daily runs only", () => {
    expect(isFormSession(session({}))).toBe(true)
    expect(isFormSession(session({ mode: "daily", dailyRun: 0 }))).toBe(true)
    expect(isFormSession(session({ mode: "daily", dailyRun: 1 }))).toBe(false)
    expect(isFormSession(session({ mode: "level" }))).toBe(false)
    expect(isFormSession(session({ suspect: true }))).toBe(false)
    expect(isFormSession(session({ moveCount: 0 }))).toBe(false)
  })
})

describe("planFormAndStarsBackfill", () => {
  it("merges old scores before new ones, ranks players with 10+ games and totals stars", () => {
    const sessions = Array.from({ length: 12 }, (_, i) => session({ gameId: `g${i}`, score: 1000 + i, finishedAt: i }))
    const players = [
      { uid: "u1", stored: parseStoredPlayer({ displayName: "An", referralCode: "ABC234", recentFormScores: [5000], levelStars: { "1": 3, "2": 2 } }) },
      { uid: "u2", stored: parseStoredPlayer({ levelStars: { "1": 1 } }) },
    ]
    const plan = planFormAndStarsBackfill({ players, sessions, historyGameIds: new Set(["g11"]) })
    const old = Array.from({ length: 11 }, (_, i) => 1000 + i)
    expect(plan.formScores).toEqual([{ uid: "u1", oldScores: old, recentFormScores: [...old, 5000] }])
    expect(plan.formRows).toEqual([{ uid: "u1", displayName: "An", score: 1006, tier: "silver", tag: "ABC234" }])
    expect(plan.starsRows).toEqual([
      { uid: "u1", displayName: "An", score: 5, tier: "silver", tag: "ABC234" },
      { uid: "u2", displayName: null, score: 1 },
    ])
  })

  it("skips banned players and keeps only the last 20 scores", () => {
    const sessions = Array.from({ length: 30 }, (_, i) => session({ gameId: `g${i}`, uid: "u1", score: i, finishedAt: i }))
    const plan = planFormAndStarsBackfill({
      players: [
        { uid: "u1", stored: parseStoredPlayer({}) },
        { uid: "u3", stored: parseStoredPlayer({ banned: true, levelStars: { "1": 3 } }) },
      ],
      sessions,
      historyGameIds: new Set(),
    })
    expect(plan.formScores[0].recentFormScores).toEqual(Array.from({ length: 20 }, (_, i) => i + 10))
    expect(plan.starsRows).toEqual([])
  })
})
