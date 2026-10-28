import { describe, expect, it } from "vitest"

import { guestTagFromUid, normalizeDisplayName } from "./player-profile-types"

describe("normalizeDisplayName", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeDisplayName("  Duy   Vu \t")).toBe("Duy Vu")
  })

  it("strips control, zero-width and bidi characters", () => {
    const zeroWidth = String.fromCodePoint(0x200b)
    const rightToLeft = String.fromCodePoint(0x202e)
    expect(normalizeDisplayName(`Du${zeroWidth}y${rightToLeft}\u0007`)).toBe("Duy")
  })

  it("counts Vietnamese and emoji characters by code point", () => {
    expect(normalizeDisplayName("Người chơi số một")).toBeNull()
    expect(normalizeDisplayName("Người chơi 🎮")).toBe("Người chơi 🎮")
  })

  it("rejects names that are too short or too long", () => {
    expect(normalizeDisplayName("a")).toBeNull()
    expect(normalizeDisplayName("   ")).toBeNull()
    expect(normalizeDisplayName("x".repeat(17))).toBeNull()
    expect(normalizeDisplayName("x".repeat(16))).toBe("x".repeat(16))
  })
})

describe("guestTagFromUid", () => {
  it("uses the last four characters, upper-cased", () => {
    expect(guestTagFromUid("abcdEf12z9")).toBe("12Z9")
  })
})
