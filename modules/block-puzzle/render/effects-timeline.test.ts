import { describe, expect, it } from "vitest"

import type { MoveResult } from "../engine/game-types"
import { createMoveEffects, effectProgress, pruneEffects } from "./effects-timeline"

const clearMove: MoveResult = {
  colorId: 4,
  placedCells: [0],
  clearedRows: [0],
  clearedCols: [],
  clearedCells: [0, 1, 2, 3, 4, 5, 6, 7],
  points: 11,
  combo: 2,
  boardCleared: false,
}

const texts = { points: "+11", combo: "Combo x2", boardClear: null }

describe("createMoveEffects", () => {
  it("creates flash, clear, particles and texts for a clearing move", () => {
    const board = [4, 2, 2, 2, 2, 2, 2, 2, ...new Array(56).fill(0)]
    const effects = createMoveEffects(clearMove, board, 1000, texts, false, () => 0.5)
    expect(effects.map((e) => e.kind)).toEqual(["flash", "clear", "particles", "floatText", "floatText"])
    const clear = effects.find((e) => e.kind === "clear")
    expect(clear?.kind === "clear" && clear.cells[1]).toEqual({ index: 1, colorId: 2 })
  })

  it("skips particles under reduced motion and shortens durations", () => {
    const normal = createMoveEffects(clearMove, new Array(64).fill(1), 0, texts, false, () => 0.5)
    const reduced = createMoveEffects(clearMove, new Array(64).fill(1), 0, texts, true, () => 0.5)
    expect(reduced.some((e) => e.kind === "particles")).toBe(false)
    expect(reduced[0].duration).toBeLessThan(normal[0].duration)
  })

  it("keeps the clear effect at or under 150ms under reduced motion", () => {
    const reduced = createMoveEffects(clearMove, new Array(64).fill(1), 0, texts, true)
    const clear = reduced.find((e) => e.kind === "clear")
    expect(clear?.duration).toBeLessThanOrEqual(150)
  })

  it("only flashes and shows points when nothing clears", () => {
    const move = { ...clearMove, clearedRows: [], clearedCells: [], combo: 0 }
    const effects = createMoveEffects(move, new Array(64).fill(0), 0, { ...texts, combo: null }, false)
    expect(effects.map((e) => e.kind)).toEqual(["flash", "floatText"])
  })
})

describe("effectProgress + pruneEffects", () => {
  const effect = { kind: "flash" as const, start: 100, duration: 200, cells: [] }

  it("clamps progress to [0, 1]", () => {
    expect(effectProgress(effect, 0)).toBe(0)
    expect(effectProgress(effect, 200)).toBe(0.5)
    expect(effectProgress(effect, 999)).toBe(1)
  })

  it("drops finished effects", () => {
    expect(pruneEffects([effect], 250)).toHaveLength(1)
    expect(pruneEffects([effect], 300)).toHaveLength(0)
  })
})
