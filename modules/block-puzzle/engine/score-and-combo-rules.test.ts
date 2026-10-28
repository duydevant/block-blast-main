import { describe, expect, it } from "vitest"

import { comboMultiplier, lineClearPoints, nextComboState, scoreForMove, SCORING_RULES } from "./score-and-combo-rules"

describe("scoring", () => {
  it.each([[0, 0], [1, 10], [2, 30], [3, 60], [4, 100]])("%i lines award %i before combo", (lines, points) => {
    expect(lineClearPoints(lines)).toBe(points)
  })

  it("grows the combo multiplier by 50% per step", () => {
    expect(comboMultiplier(0)).toBe(1)
    expect(comboMultiplier(1)).toBe(1)
    expect(comboMultiplier(3)).toBe(2)
  })

  it("adds placed cells, combo-scaled lines and the board-clear bonus", () => {
    expect(scoreForMove({ placedCellCount: 3, linesCleared: 2, combo: 2, boardCleared: false })).toBe(3 + 45)
    expect(scoreForMove({ placedCellCount: 3, linesCleared: 2, combo: 2, boardCleared: true })).toBe(3 + 45 + SCORING_RULES.boardClearBonus)
    expect(scoreForMove({ placedCellCount: 4, linesCleared: 0, combo: 5, boardCleared: false })).toBe(4)
  })

  it("keeps the combo through the grace moves, then resets", () => {
    let state = { combo: 2, movesSinceClear: 0 }
    for (let i = 0; i < SCORING_RULES.comboGraceMoves; i++) {
      state = nextComboState(state, 0)
      expect(state.combo).toBe(2)
    }
    state = nextComboState(state, 0)
    expect(state.combo).toBe(0)
    expect(nextComboState(state, 0).movesSinceClear).toBe(SCORING_RULES.comboGraceMoves + 1)
    expect(nextComboState(state, 1)).toEqual({ combo: 1, movesSinceClear: 0 })
  })
})
