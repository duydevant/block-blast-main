import { afterEach, describe, expect, it } from "vitest"

import { createNewGame } from "@/modules/block-puzzle/engine/game-state-reducer"
import { useBlockPuzzleGameStore } from "@/modules/block-puzzle/store/block-puzzle-game-store"

import { findStartStateFor, startAnalysisStartCapture } from "./analysis-start-capture"
import { verdictShares } from "./analysis-verdict-history"

const initial = useBlockPuzzleGameStore.getState()
afterEach(() => useBlockPuzzleGameStore.setState(initial, true))

const store = () => useBlockPuzzleGameStore.getState()

function placeAnything(): boolean {
  for (let slot = 0; slot < 3; slot++)
    for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) if (store().placePiece(slot, row, col)) return true
  return false
}

describe("analysis start capture", () => {
  it("remembers the fresh game and matches it after moves are played", () => {
    startAnalysisStartCapture()
    const start = createNewGame(4242)
    useBlockPuzzleGameStore.setState({ game: start, actionLog: [] })
    for (let i = 0; i < 6; i++) expect(placeAnything()).toBe(true)

    const { game, actionLog } = store()
    expect(findStartStateFor(game!, actionLog)).toEqual({ ...start, lastMove: null })
    // Log không khớp ván (thiếu 1 nước) → không dùng nhầm state đầu.
    expect(findStartStateFor(game!, actionLog.slice(0, -1))).toBeNull()
  })
})

describe("verdictShares", () => {
  it("ignores unknown verdicts and splits the rest", () => {
    expect(verdictShares([])).toEqual({ counted: 0, unlucky: 0, mistake: 0 })
    expect(verdictShares(["unlucky", "mistake", "mistake", "unknown"])).toEqual({ counted: 3, unlucky: 33, mistake: 67 })
  })
})
