import { describe, expect, it } from "vitest"

import { glyphForColor, COLORBLIND_GLYPHS } from "../render/colorblind-glyphs"
import { DRAG_LIFT_CELLS, resolveReducedMotion, useBlockPuzzleSettingsStore } from "./block-puzzle-settings-store"

const merge = (persisted: unknown) => {
  const options = useBlockPuzzleSettingsStore.persist.getOptions()
  return options.merge!(persisted, useBlockPuzzleSettingsStore.getState())
}

describe("settings merge", () => {
  it("defaults the new control/display settings for old saves", () => {
    const state = merge({ sound: false })
    expect(state).toMatchObject({ sound: false, dragLift: "normal", colorblindMarks: false, reduceMotion: "system", linePreview: true })
  })

  it("keeps valid saved values and rejects tampered ones", () => {
    expect(merge({ dragLift: "high", colorblindMarks: true, reduceMotion: "on", linePreview: false })).toMatchObject({
      dragLift: "high",
      colorblindMarks: true,
      reduceMotion: "on",
      linePreview: false,
    })
    expect(merge({ dragLift: "huge", colorblindMarks: "yes", reduceMotion: 1, linePreview: null })).toMatchObject({
      dragLift: "normal",
      colorblindMarks: false,
      reduceMotion: "system",
      linePreview: true,
    })
  })

  it("lifts the piece more for higher settings", () => {
    expect(DRAG_LIFT_CELLS.low).toBeLessThan(DRAG_LIFT_CELLS.normal)
    expect(DRAG_LIFT_CELLS.normal).toBeLessThan(DRAG_LIFT_CELLS.high)
  })
})

describe("resolveReducedMotion", () => {
  it("follows the device only in system mode", () => {
    expect(resolveReducedMotion("system", true)).toBe(true)
    expect(resolveReducedMotion("system", false)).toBe(false)
    expect(resolveReducedMotion("on", false)).toBe(true)
    expect(resolveReducedMotion("off", true)).toBe(false)
  })
})

describe("glyphForColor", () => {
  it("gives every block color its own glyph", () => {
    const glyphs = Array.from({ length: 8 }, (_, index) => glyphForColor(index + 1))
    expect(new Set(glyphs).size).toBe(COLORBLIND_GLYPHS.length)
  })
})
