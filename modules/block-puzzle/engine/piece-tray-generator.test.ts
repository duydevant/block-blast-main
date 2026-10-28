import { describe, expect, it } from "vitest"
import { createEmptyBoard } from "./board-grid-operations"
import { findSmartShapeIndices } from "./board-smart-selector"
import { type TrayGeneratorState } from "./game-types"
import { CLASSIC_SHAPE_IDS, dealTray, INITIAL_GENERATOR_STATE } from "./piece-tray-generator"
import { nextRandom } from "./seeded-random-generator"
import { CLASSIC_POOLS, selectPoolQueue } from "./tray-generator-config"

const empty = createEmptyBoard()
const bagState = (currentPool: number[], poolIndices = [11]): TrayGeneratorState =>
  ({ stepsBeforeSmart: 1, currentPool, poolIndices })

describe("classic tray dealing", () => {
  it("maps all sixty variants to the retained generic catalog", () => {
    expect(CLASSIC_SHAPE_IDS).toHaveLength(60)
    expect(CLASSIC_SHAPE_IDS.every(Boolean)).toBe(true)
    expect(CLASSIC_SHAPE_IDS[44]).toMatch(/^diagonal2-/)
  })

  it("starts with the board-aware tray and consumes only three color rolls", () => {
    const a = dealTray(empty, 0, 42, 10)
    const b = dealTray(empty, 900, 99, 10)
    expect(a.tray.map(p => p.shapeId)).toEqual(findSmartShapeIndices(empty).map(i => CLASSIC_SHAPE_IDS[i]))
    expect(a.tray.map(p => p.shapeId)).toEqual(b.tray.map(p => p.shapeId))
    let rng = 42
    for (let i = 0; i < 3; i++) rng = nextRandom(rng)[1]
    expect(a.rngState).toBe(rng)
    expect(a.tray.map(p => p.uid)).toEqual([10, 11, 12])
    expect(a.nextPieceUid).toBe(13)
  })

  it("cycles smart, bag, bag and leaves bags untouched during smart deals", () => {
    let previous = INITIAL_GENERATOR_STATE
    let rng = 42
    const counters = []
    for (let i = 0; i < 7; i++) {
      const before = structuredClone(previous)
      const deal = dealTray(empty, 500, rng, i * 3, previous)
      expect(previous).toEqual(before)
      if (i % 3 === 0) {
        expect(deal.generatorState.currentPool).toEqual(previous.currentPool)
        expect(deal.generatorState.poolIndices).toEqual(previous.poolIndices)
      }
      previous = deal.generatorState
      rng = deal.rngState
      counters.push(previous.stepsBeforeSmart)
    }
    expect(counters).toEqual([1, 0, -1, 1, 0, -1, 1])
  })

  it("draws without replacement and retains duplicates and bag remainder", () => {
    const deal = dealTray(empty, 0, 42, 1, bagState([12, 12, 12, 12]))
    expect(deal.tray.map(p => p.shapeId)).toEqual(["square2", "square2", "square2"])
    expect(deal.generatorState.currentPool).toEqual([12])
    expect(deal.generatorState.poolIndices).toEqual([11])
  })

  it("crosses a bag boundary within one tray", () => {
    const deal = dealTray(empty, 0, 42, 1, bagState([12], [11, 11]))
    expect(deal.tray.map(p => p.shapeId)).toEqual(["square2", "dot", "dot"])
    expect(deal.generatorState.currentPool).toEqual([])
    expect(deal.generatorState.poolIndices).toEqual([])
  })

  it("does not require all bag pieces to fit and rescues only a wholly dead tray", () => {
    const board = Array.from({ length: 64 }, (_, i) => (Math.floor(i / 8) + i % 8) % 2)
    const partial = dealTray(board, 0, 42, 1, bagState([0, 12, 12]))
    expect(partial.tray.filter(p => p.shapeId === "square2")).toHaveLength(2)
    const dead = dealTray(board, 0, 42, 1, bagState([12, 12, 12]))
    expect(dead.tray.map(p => p.shapeId)).toEqual(["dot", "square2", "square2"])
    const withStash = dealTray(board, 0, 42, 1, bagState([12, 12, 12]),
      { uid: 99, shapeId: "dot", colorId: 1 })
    expect(withStash.tray.every(p => p.shapeId === "square2")).toBe(true)
  })

  it("preserves a partly consumed bag when score crosses a threshold", () => {
    const previous = bagState([12, 12, 12, 12], [7, 11])
    expect(dealTray(empty, 99, 42, 1, previous)).toEqual(dealTray(empty, 800, 42, 1, previous))
  })

  it("uses the documented score bands and fresh second branch roll", () => {
    const sorted = (a: number[]) => [...a].sort((a, b) => a - b)
    expect(sorted(selectPoolQueue(99, () => 0.99))).toEqual(sorted([7,9,10,11,11]))
    expect(sorted(selectPoolQueue(100, () => 0.1))).toEqual(sorted([1,8,7,6,10,11,11]))
    expect(sorted(selectPoolQueue(799, () => 0.9))).toEqual(sorted([4,8,9,3,6,10,11,11]))
    expect(sorted(selectPoolQueue(800, () => 0.1))).toEqual(sorted([1,4,8,7,6,10,11,11]))
    const rolls = [0.9, 0.5]
    expect(sorted(selectPoolQueue(800, () => rolls.shift() ?? 0.99))).toEqual(sorted([1,2,8,9,3,5,10,11,11]))
    expect(CLASSIC_POOLS).toHaveLength(11)
  })
})
