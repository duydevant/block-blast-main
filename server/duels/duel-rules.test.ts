import { describe, expect, it } from "vitest"

import { DUEL_SUBMIT_GRACE_MS, DUEL_WAITING_TTL_MS, type DuelState, freshestDuelState } from "@/modules/duel/duel-types"

import { acceptsDuelSubmission, bothResultsIn, duelWinner, type DuelRuleState, effectiveDuelStatus, isDuelOverdue } from "./duel-rules"

const ENDS = 1_000_000
const duel = (overrides: Partial<DuelRuleState> = {}): DuelRuleState => ({
  status: "playing",
  hostUid: "host",
  guestUid: "guest",
  createdAtMs: 0,
  endsAt: ENDS,
  results: {},
  ...overrides,
})

describe("duel rules", () => {
  it("picks the higher verified score, a forfeit loses, a tie is a draw", () => {
    expect(duelWinner(duel({ results: { host: 900, guest: 1200 } }))).toBe("guest")
    expect(duelWinner(duel({ results: { host: 900 } }))).toBe("host")
    expect(duelWinner(duel({ results: { host: 500, guest: 500 } }))).toBeNull()
    expect(duelWinner(duel({ results: {} }))).toBeNull()
    expect(duelWinner(duel({ guestUid: null, results: { host: 10 } }))).toBeNull()
  })

  it("accepts submissions until the deadline plus grace, then the duel is overdue", () => {
    expect(acceptsDuelSubmission(duel(), ENDS + DUEL_SUBMIT_GRACE_MS)).toBe(true)
    expect(acceptsDuelSubmission(duel(), ENDS + DUEL_SUBMIT_GRACE_MS + 1)).toBe(false)
    expect(acceptsDuelSubmission(duel({ status: "finished" }), ENDS)).toBe(false)
    expect(isDuelOverdue(duel(), ENDS + DUEL_SUBMIT_GRACE_MS + 1)).toBe(true)
    expect(isDuelOverdue(duel({ status: "finished" }), ENDS * 2)).toBe(false)
  })

  it("finishes as soon as both scores are in and expires idle rooms", () => {
    expect(bothResultsIn(duel({ results: { host: 1 } }))).toBe(false)
    expect(bothResultsIn(duel({ results: { host: 1, guest: 0 } }))).toBe(true)
    expect(effectiveDuelStatus(duel({ status: "waiting", guestUid: null }), DUEL_WAITING_TTL_MS + 1)).toBe("expired")
    expect(effectiveDuelStatus(duel({ status: "waiting", guestUid: null }), 10)).toBe("waiting")
  })
})

describe("duel state merge", () => {
  const base: DuelState = { id: "x", status: "playing", host: { uid: "h", name: null }, guest: { uid: "g", name: null }, startAt: 1, endsAt: 2, results: {}, winnerUid: null, rematchId: null, started: [] }
  it("keeps whichever copy has progressed further", () => {
    const finished = { ...base, status: "finished" as const, results: { h: 1, g: 2 }, winnerUid: "g" }
    expect(freshestDuelState(base, finished)).toBe(finished)
    expect(freshestDuelState(finished, base)).toBe(finished)
    expect(freshestDuelState(base, { ...base, started: ["h"] })?.started).toEqual(["h"])
    expect(freshestDuelState(null, base)).toBe(base)
  })
})
