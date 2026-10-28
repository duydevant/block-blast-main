import { describe, expect, it } from "vitest"

import { findSmartShapeIndices, NATIVE_SHAPE_CELLS } from "./board-smart-selector"

// Recorded from the reference selector, not calculated by this implementation.
const FIXTURES: readonly [string, readonly number[]][] = [
  ["0000000000000000000000000000000000000000000000000000000000000000", [36, 36, 12]],
  ["0000100000000000001000100000000000000000000000001000000000001000", [36, 36, 28]],
  ["0000000000000000010000000000100100000100010000001001000010010000", [36, 29, 12]],
  ["0111100110010101010100011010000011000000010000100111000010000001", [36, 28, 16]],
  ["0000011110010110100100000000000101010000110001010000110100000110", [36, 53, 26]],
  ["1000111111000010001000010100010000011111011101010010101001011000", [29, 48, 10]],
  ["1101111010111000011011110111010110000111000111111110011111111101", [20, 12, 44]],
  ["1011001111011011110111101110101101011011110111111101011001101011", [17, 58, 33]],
  ["1011010100110111011011011100111010100111010101011110111011110110", [25, 45, 44]],
  ["1111111101111111111111111111111111111111011111101111011111011111", [0, 36, 36]],
]

describe("board smart selector", () => {
  it.each(FIXTURES)("matches reference choices for %s", (bits, expected) => {
    const board = [...bits].map(Number)
    const before = [...board]
    expect(findSmartShapeIndices(board)).toEqual(expected)
    expect(board).toEqual(before)
  })

  it("ignores colors and uses only occupied cells", () => {
    const board = [...FIXTURES[5][0]].map((cell, index) => Number(cell) * (index % 8 + 1))
    expect(findSmartShapeIndices(board)).toEqual(FIXTURES[5][1])
  })

  it("rejects boards with the wrong size", () => {
    expect(() => findSmartShapeIndices([])).toThrow(RangeError)
  })

  it("maps native low bits to the bottom-right of each screen shape", () => {
    expect(NATIVE_SHAPE_CELLS).toHaveLength(60)
    expect(NATIVE_SHAPE_CELLS[8]).toEqual([[1, 0], [0, 1], [0, 0]])
    expect(NATIVE_SHAPE_CELLS[44]).toEqual([[1, 0], [0, 1]])
  })
})
