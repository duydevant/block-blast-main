import { afterEach, describe, expect, it } from "vitest"

import { createNewGame } from "../engine/game-state-reducer"
import { MAX_RECORDED_ACTIONS, replayRecordedGame } from "../engine/replay-recorded-game-actions"
import { useBlockPuzzleGameStore } from "./block-puzzle-game-store"
import { parseSavedRankedGameCloudState } from "./ranked-game-cloud-state"

const initial = useBlockPuzzleGameStore.getState()
afterEach(() => useBlockPuzzleGameStore.setState(initial, true))

const issued = { gameId: "g1", uid: "u1", seed: 4242, stashUnlocked: false }
const store = () => useBlockPuzzleGameStore.getState()

/** Đặt khối đầu tiên vừa chỗ nào đó (thử mọi ô). */
function placeAnything(): boolean {
  for (let slot = 0; slot < 3; slot++)
    for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) if (store().placePiece(slot, row, col)) return true
  return false
}

describe("ranked game recording", () => {
  it("starts a ranked game from the issued seed and records actions the server can replay", () => {
    useBlockPuzzleGameStore.setState({ game: createNewGame(1) })
    store().setNextRankedSeed(issued)
    store().startNewGame()
    expect(store().rankedSession).toEqual({ gameId: "g1", uid: "u1", queued: false })
    expect(store().nextRankedSeed).toBeNull()

    store().replaceTray()
    for (let i = 0; i < 5; i++) expect(placeAnything()).toBe(true)
    const { actionLog, game } = store()
    expect(actionLog).toHaveLength(6)

    const replay = replayRecordedGame(issued, actionLog)
    expect(replay.ok && replay.state).toEqual(game)
  })

  it("does not record rejected moves", () => {
    useBlockPuzzleGameStore.setState({ game: createNewGame(2), actionLog: [] })
    expect(store().placePiece(0, 99, 99)).toBe(false)
    expect(store().revive()).toBe(false)
    expect(store().actionLog).toEqual([])
  })

  it("queues the played ranked game when a new game starts, once", () => {
    useBlockPuzzleGameStore.setState({ game: createNewGame(1) })
    store().setNextRankedSeed(issued)
    store().startNewGame()
    placeAnything()
    store().queueFinishedRankedGame()
    store().queueFinishedRankedGame()
    store().startNewGame()
    expect(store().pendingSubmissions).toHaveLength(1)
    expect(store().pendingSubmissions[0]).toMatchObject({ gameId: "g1", uid: "u1" })
    expect(store().rankedSession).toBeNull()
  })

  it("does not queue an untouched ranked game", () => {
    useBlockPuzzleGameStore.setState({ game: createNewGame(1) })
    store().setNextRankedSeed(issued)
    store().startNewGame()
    store().startNewGame()
    expect(store().pendingSubmissions).toEqual([])
  })

  it("keeps an untouched ranked game when the tutorial finishes", () => {
    useBlockPuzzleGameStore.setState({ game: createNewGame(1) })
    store().setNextRankedSeed(issued)
    store().startNewGame()
    const ranked = store().game
    store().finishTutorial()
    expect(store().game).toBe(ranked)
  })

  it("turns a ranked game offline once its log exceeds the server limit", () => {
    useBlockPuzzleGameStore.setState({ game: createNewGame(1) })
    store().setNextRankedSeed(issued)
    store().startNewGame()
    const filler = Array.from({ length: MAX_RECORDED_ACTIONS }, () => ({ type: "REPLACE_TRAY" as const }))
    useBlockPuzzleGameStore.setState({ actionLog: filler })
    expect(placeAnything()).toBe(true)
    expect(store().rankedSession).toBeNull()
    store().startNewGame()
    expect(store().pendingSubmissions).toEqual([])
  })

  it("drops seeds, sessions and submissions that belong to another account", () => {
    useBlockPuzzleGameStore.setState({
      rankedSession: { gameId: "a", uid: "old", queued: false },
      nextRankedSeed: { ...issued, uid: "old" },
      pendingSubmissions: [{ gameId: "b", uid: "old", actions: [] }, { gameId: "c", uid: "new", actions: [] }],
    })
    store().dropCloudStateForOtherUser("new")
    expect(store().rankedSession).toBeNull()
    expect(store().nextRankedSeed).toBeNull()
    expect(store().pendingSubmissions.map((item) => item.gameId)).toEqual(["c"])
  })
})

describe("parseSavedRankedGameCloudState", () => {
  it("falls back per field on malformed saves", () => {
    const parsed = parseSavedRankedGameCloudState({
      rankedSession: { gameId: 5 },
      actionLog: [{ type: "REPLACE_TRAY" }],
      nextRankedSeed: issued,
      pendingSubmissions: "nope",
    })
    expect(parsed.rankedSession).toBeNull()
    expect(parsed.actionLog).toEqual([{ type: "REPLACE_TRAY" }])
    expect(parsed.nextRankedSeed).toEqual(issued)
    expect(parsed.pendingSubmissions).toEqual([])
  })
})
