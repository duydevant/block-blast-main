import { afterEach, describe, expect, it } from "vitest"
import { createNewGame } from "../engine/game-state-reducer"
import { useBlockPuzzleGameStore } from "./block-puzzle-game-store"

const initial = useBlockPuzzleGameStore.getState()
afterEach(() => useBlockPuzzleGameStore.setState(initial))

describe("tutorial handoff", () => {
  it("starts fresh classic on an empty board without replacing best or unlocks", () => {
    useBlockPuzzleGameStore.setState({ game: { ...createNewGame(7), stashUnlocked: true }, best: 980 })
    useBlockPuzzleGameStore.getState().finishTutorial()
    const { game, best } = useBlockPuzzleGameStore.getState()
    expect(game!.board.every((cell) => cell === 0)).toBe(true)
    expect(game!.tray.filter(Boolean)).toHaveLength(3)
    expect(game!.stashUnlocked).toBe(true)
    expect(best).toBe(980)
  })
  it("does not replace a saved classic game with actual progress", () => {
    const saved = { ...createNewGame(8), score: 12, moveCount: 1 }
    useBlockPuzzleGameStore.setState({ game: saved })
    useBlockPuzzleGameStore.getState().finishTutorial()
    expect(useBlockPuzzleGameStore.getState().game).toBe(saved)
  })
  it("does not reset spent replacement charges", () => {
    const saved = { ...createNewGame(8), replaceCharges: 1 }
    useBlockPuzzleGameStore.setState({ game: saved })
    useBlockPuzzleGameStore.getState().finishTutorial()
    expect(useBlockPuzzleGameStore.getState().game).toBe(saved)
  })
})
