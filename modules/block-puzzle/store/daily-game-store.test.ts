import { afterEach, describe, expect, it } from "vitest"

import { createNewGame } from "../engine/game-state-reducer"
import { createRankedGameStartState } from "../engine/replay-recorded-game-actions"
import { useBlockPuzzleGameStore } from "./block-puzzle-game-store"
import { parseSavedRankedGameCloudState } from "./ranked-game-cloud-state"

const initial = useBlockPuzzleGameStore.getState()
afterEach(() => useBlockPuzzleGameStore.setState(initial, true))

const store = () => useBlockPuzzleGameStore.getState()
const classicSeed = { gameId: "classic1", uid: "u1", seed: 11, stashUnlocked: true }

function placeAnything(): boolean {
  for (let slot = 0; slot < 3; slot++)
    for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) if (store().placePiece(slot, row, col)) return true
  return false
}

describe("daily challenge games", () => {
  it("starts a ranked daily from the shared seed with the stash locked, keeping the classic seed in reserve", () => {
    useBlockPuzzleGameStore.setState({ game: { ...createNewGame(1), stashUnlocked: true }, nextRankedSeed: classicSeed })
    store().startDailyGame({ gameId: "daily1", uid: "u1", seed: 777, day: "20261027" })
    expect(store().game).toEqual(createRankedGameStartState({ seed: 777, stashUnlocked: false }))
    expect(store().rankedSession).toEqual({ gameId: "daily1", uid: "u1", queued: false })
    expect(store().dailyDay).toBe("20261027")
    expect(store().nextRankedSeed).toEqual(classicSeed)
  })

  it("treats a daily start without a session as practice", () => {
    useBlockPuzzleGameStore.setState({ game: createNewGame(1) })
    store().startDailyGame({ gameId: null, uid: "u1", seed: 777, day: "20261027" })
    expect(store().rankedSession).toBeNull()
    expect(store().dailyDay).toBe("20261027")
  })

  it("queues the classic game in progress when switching to the daily", () => {
    useBlockPuzzleGameStore.setState({ game: createNewGame(1), nextRankedSeed: classicSeed })
    store().startNewGame()
    placeAnything()
    store().startDailyGame({ gameId: "daily1", uid: "u1", seed: 777, day: "20261027" })
    expect(store().pendingSubmissions.map((item) => item.gameId)).toEqual(["classic1"])
  })

  it("still queues an untouched ranked daily so the server can release today's claim", () => {
    useBlockPuzzleGameStore.setState({ game: createNewGame(1), nextRankedSeed: classicSeed })
    store().startDailyGame({ gameId: "daily1", uid: "u1", seed: 777, day: "20261027" })
    store().startNewGame()
    expect(store().pendingSubmissions).toEqual([{ gameId: "daily1", uid: "u1", actions: [] }])
  })

  it("keeps an untouched practice daily when the tutorial finishes", () => {
    useBlockPuzzleGameStore.setState({ game: createNewGame(1) })
    store().startDailyGame({ gameId: null, uid: "u1", seed: 777, day: "20261027" })
    const daily = store().game
    store().finishTutorial()
    expect(store().game).toBe(daily)
  })

  it("returns to classic on the next new game and queues the daily run", () => {
    useBlockPuzzleGameStore.setState({ game: createNewGame(1), nextRankedSeed: classicSeed })
    store().startDailyGame({ gameId: "daily1", uid: "u1", seed: 777, day: "20261027" })
    placeAnything()
    store().startNewGame()
    expect(store().dailyDay).toBeNull()
    expect(store().rankedSession?.gameId).toBe("classic1")
    expect(store().pendingSubmissions.map((item) => item.gameId)).toEqual(["daily1"])
  })

  it("restores the daily day from the save and drops malformed values", () => {
    expect(parseSavedRankedGameCloudState({ dailyDay: "20261027" }).dailyDay).toBe("20261027")
    expect(parseSavedRankedGameCloudState({ dailyDay: "27/10" }).dailyDay).toBeNull()
  })
})
