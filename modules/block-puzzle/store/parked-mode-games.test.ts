import { afterEach, describe, expect, it } from "vitest"

import { createNewGame } from "../engine/game-state-reducer"
import { useBlockPuzzleGameStore } from "./block-puzzle-game-store"
import { modeSlotOf, parseParkedGames } from "./parked-mode-games"

const initial = useBlockPuzzleGameStore.getState()
afterEach(() => useBlockPuzzleGameStore.setState(initial, true))

const store = () => useBlockPuzzleGameStore.getState()
const classicSeed = { gameId: "classic1", uid: "u1", seed: 11, stashUnlocked: true }
const levelRun = { kind: "level" as const, levelId: 2 }

function placeAnything(): boolean {
  for (let slot = 0; slot < 3; slot++)
    for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) if (store().placePiece(slot, row, col)) return true
  return false
}

describe("independent game per mode", () => {
  it("parks the endless game when a level starts and resumes the exact same game later", () => {
    useBlockPuzzleGameStore.setState({ game: createNewGame(1), nextRankedSeed: classicSeed })
    store().startNewGame()
    placeAnything()
    const endless = store().game
    const log = store().actionLog

    expect(store().parkCurrentGame()).toBe("endless")
    expect(store().game).toBeNull()
    store().startVariantGame({ gameId: "level2", uid: "u1", seed: 5, run: levelRun })
    // Ván Vô tận dở không bị nộp khi sang màn chơi.
    expect(store().pendingSubmissions).toEqual([])
    placeAnything()

    expect(store().parkCurrentGame()).toBe("level")
    expect(store().resumeParkedGame("endless")).toBe(true)
    expect(store().game).toEqual(endless)
    expect(store().actionLog).toEqual(log)
    expect(store().rankedSession).toEqual({ gameId: "classic1", uid: "u1", queued: false })
    expect(store().variantRun).toBeNull()
    expect(Object.keys(store().parkedGames)).toEqual(["level"])

    expect(store().parkCurrentGame()).toBe("endless")
    expect(store().resumeParkedGame("level")).toBe(true)
    expect(store().variantRun).toEqual(levelRun)
    expect(store().rankedSession?.gameId).toBe("level2")
  })

  it("does not park a finished game; an unsubmitted ranked one goes to the submission queue", () => {
    useBlockPuzzleGameStore.setState({ game: { ...createNewGame(1), isGameOver: true }, rankedSession: { gameId: "g1", uid: "u1", queued: false }, actionLog: [{ type: "REPLACE_TRAY" }] })
    expect(store().parkCurrentGame()).toBeNull()
    expect(store().parkedGames).toEqual({})
    expect(store().pendingSubmissions.map((item) => item.gameId)).toEqual(["g1"])
  })

  it("never parks a duel game and submits what was played when an outdated parked game is discarded", () => {
    expect(modeSlotOf({ dailyDay: null, challenge: null, variantRun: { kind: "duel" } as never })).toBeNull()
    useBlockPuzzleGameStore.setState({ game: createNewGame(1) })
    store().startVariantGame({ gameId: "level3", uid: "u1", seed: 9, run: { kind: "level", levelId: 3 } })
    placeAnything()
    store().parkCurrentGame()
    store().discardParkedGame("level")
    expect(store().parkedGames).toEqual({})
    expect(store().pendingSubmissions.map((item) => item.gameId)).toEqual(["level3"])
  })

  it("restores parked games from the save and drops corrupt or misplaced ones", () => {
    const game = createNewGame(3)
    const parked = parseParkedGames({
      level: { game, rankedSession: null, actionLog: [], dailyDay: null, challenge: null, variantRun: levelRun },
      daily: { game, rankedSession: null, actionLog: [], dailyDay: null, challenge: null, variantRun: levelRun },
      endless: { game: "broken" },
    })
    expect(Object.keys(parked)).toEqual(["level"])
    expect(parked.level?.game.board).toEqual(game.board)
  })
})
