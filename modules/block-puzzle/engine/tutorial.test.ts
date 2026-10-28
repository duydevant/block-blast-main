import { describe, expect, it } from "vitest"

import { createTutorialStage, placeTutorialPiece, TUTORIAL_SLOT, tutorialTarget, type TutorialStage } from "./tutorial"

describe("tutorial", () => {
  it.each([
    [1, 1],
    [2, 2],
    [3, 2],
  ] as [TutorialStage, number][])("stage %i clears %i lines and empties the board", (stage, lines) => {
    const game = createTutorialStage(stage)
    const { row, col } = tutorialTarget(stage)
    expect(placeTutorialPiece(stage, game, 0, row, col)).toBeNull()
    expect(placeTutorialPiece(stage, game, TUTORIAL_SLOT, row + 1, col)).toBeNull()
    const next = placeTutorialPiece(stage, game, TUTORIAL_SLOT, row, col)!
    expect(next.board.every((cell) => cell === 0)).toBe(true)
    expect(next.lastMove!.clearedRows.length + next.lastMove!.clearedCols.length).toBe(lines)
    expect(next.score).toBeGreaterThan(0)
    expect(game.tray[TUTORIAL_SLOT]).not.toBeNull()
  })
})
