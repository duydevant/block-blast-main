import { describe, expect, it } from "vitest"

import { CHALLENGE_RECIPIENT_MIN_AGE_MS, type ChallengeRewardInput, creatorRewardCount, isChallengeRewardDue } from "./challenge-reward-rules"

const NOW = 1_800_000_000_000
const base: ChallengeRewardInput = {
  recipientUid: "r",
  creatorUid: "c",
  expiresAtMs: NOW + 1000,
  alreadyRewarded: false,
  score: 2000,
  creatorScore: 1500,
  moveCount: 40,
  flagged: false,
  recipientGamesBefore: 10,
  recipientCreatedAtMs: NOW - CHALLENGE_RECIPIENT_MIN_AGE_MS,
  nowMs: NOW,
}

describe("challenge rewards", () => {
  it("rewards a real recipient who beats the score in time", () => {
    expect(isChallengeRewardDue(base)).toBe(true)
  })

  it("rejects expired, self, repeated, flagged, short or losing games", () => {
    expect(isChallengeRewardDue({ ...base, expiresAtMs: NOW })).toBe(false)
    expect(isChallengeRewardDue({ ...base, expiresAtMs: null })).toBe(false)
    expect(isChallengeRewardDue({ ...base, recipientUid: "c" })).toBe(false)
    expect(isChallengeRewardDue({ ...base, alreadyRewarded: true })).toBe(false)
    expect(isChallengeRewardDue({ ...base, flagged: true })).toBe(false)
    expect(isChallengeRewardDue({ ...base, moveCount: 5 })).toBe(false)
    expect(isChallengeRewardDue({ ...base, score: 1500 })).toBe(false)
  })

  it("blocks fresh throwaway accounts", () => {
    expect(isChallengeRewardDue({ ...base, recipientGamesBefore: 2 })).toBe(false)
    expect(isChallengeRewardDue({ ...base, recipientCreatedAtMs: NOW - 1000 })).toBe(false)
    expect(isChallengeRewardDue({ ...base, recipientCreatedAtMs: null })).toBe(false)
  })

  it("counts creator rewards per day", () => {
    expect(creatorRewardCount({ challengeRewardDay: "20261030", challengeRewardCount: 3 }, "20261030")).toBe(3)
    expect(creatorRewardCount({ challengeRewardDay: "20261029", challengeRewardCount: 5 }, "20261030")).toBe(0)
  })
})
