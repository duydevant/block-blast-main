import { describe, expect, it } from "vitest"

import { DUEL_EMOTES, EMOTE_COOLDOWN_MS, emoteCooldownLeft, isValidEmoteIndex, newEmoteFrom } from "./duel-emote-rules"

describe("duel emote rules", () => {
  it("accepts only the fixed emote indices", () => {
    expect(isValidEmoteIndex(0)).toBe(true)
    expect(isValidEmoteIndex(DUEL_EMOTES.length - 1)).toBe(true)
    expect(isValidEmoteIndex(DUEL_EMOTES.length)).toBe(false)
    expect(isValidEmoteIndex(1.5)).toBe(false)
    expect(isValidEmoteIndex("1")).toBe(false)
  })

  it("enforces the cooldown between sends", () => {
    expect(emoteCooldownLeft(null, 1000)).toBe(0)
    expect(emoteCooldownLeft(1000, 1000 + EMOTE_COOLDOWN_MS - 1)).toBe(1)
    expect(emoteCooldownLeft(1000, 1000 + EMOTE_COOLDOWN_MS)).toBe(0)
  })

  it("surfaces an emote only when its timestamp changes", () => {
    expect(newEmoteFrom(null, { e: 2, at: 50 })).toEqual({ e: 2, at: 50 })
    expect(newEmoteFrom(50, { e: 2, at: 50 })).toBeNull()
    expect(newEmoteFrom(50, { e: 9, at: 60 })).toBeNull()
    expect(newEmoteFrom(null, null)).toBeNull()
  })
})
