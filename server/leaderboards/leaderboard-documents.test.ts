import { describe, expect, it } from "vitest"

import { parseLeaderboardTop } from "./leaderboard-documents"

describe("parseLeaderboardTop", () => {
  it("keeps valid tiers and drops the key for missing or unknown tiers", () => {
    const top = parseLeaderboardTop({
      top: [
        { uid: "a", displayName: "A", score: 30, tier: "gold" },
        { uid: "b", displayName: null, score: 20, tier: "legendary" },
        { uid: "c", displayName: "C", score: 10 },
      ],
    })
    expect(top[0]).toEqual({ uid: "a", displayName: "A", score: 30, tier: "gold" })
    // Không được có key `tier: undefined` (Firestore từ chối ghi undefined).
    expect(Object.keys(top[1])).not.toContain("tier")
    expect(Object.keys(top[2])).not.toContain("tier")
  })
})
