import { describe, expect, it } from "vitest"

import {
  FORM_MIN_GAMES,
  FORM_WINDOW,
  formFromRecent,
  highestTier,
  newlyReachedTiers,
  nextTierTarget,
  tierForForm,
  tierRewardCoins,
  withRecentFormScore,
} from "./player-form-rules"
import { median } from "./score-statistics"

describe("median", () => {
  it("handles odd, even and empty lists", () => {
    expect(median([5, 1, 3])).toBe(3)
    expect(median([4, 1, 3, 2])).toBe(3)
    expect(median([])).toBe(0)
  })
})

describe("player form", () => {
  it("keeps only the latest FORM_WINDOW scores", () => {
    let recent: number[] = []
    for (let i = 1; i <= FORM_WINDOW + 5; i++) recent = withRecentFormScore(recent, i)
    expect(recent).toHaveLength(FORM_WINDOW)
    expect(recent[0]).toBe(6)
    expect(recent.at(-1)).toBe(FORM_WINDOW + 5)
  })

  it("has no form before FORM_MIN_GAMES games", () => {
    expect(formFromRecent(Array(FORM_MIN_GAMES - 1).fill(1000))).toBeNull()
    expect(formFromRecent(Array(FORM_MIN_GAMES).fill(1000))).toBe(1000)
  })

  it("ignores one lucky game", () => {
    expect(formFromRecent([...Array(10).fill(900), 50000])).toBe(900)
  })
})

describe("player tiers", () => {
  it("maps form to tiers", () => {
    expect(tierForForm(null)).toBe("unranked")
    expect(tierForForm(0)).toBe("bronze")
    expect(tierForForm(799)).toBe("bronze")
    expect(tierForForm(800)).toBe("silver")
    expect(tierForForm(20000)).toBe("master")
  })

  it("rewards every skipped tier once", () => {
    expect(newlyReachedTiers("gold", [])).toEqual(["bronze", "silver", "gold"])
    expect(newlyReachedTiers("gold", ["bronze", "silver", "gold"])).toEqual([])
    expect(newlyReachedTiers("silver", ["bronze", "silver", "gold"])).toEqual([])
    expect(newlyReachedTiers("unranked", [])).toEqual([])
    expect(tierRewardCoins(["bronze", "silver", "gold"])).toBe(150)
  })

  it("finds the highest claimed tier and the next target", () => {
    expect(highestTier(["bronze", "gold", "silver"])).toBe("gold")
    expect(highestTier([])).toBe("unranked")
    expect(nextTierTarget(1000)).toEqual({ tier: "gold", minForm: 1500 })
    expect(nextTierTarget(50000)).toBeNull()
    expect(nextTierTarget(null)).toBeNull()
  })
})
