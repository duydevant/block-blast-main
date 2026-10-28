import { afterEach, describe, expect, it } from "vitest"

import { CHALLENGE_ID_PATTERN } from "@/modules/challenge/challenge-types"
import { generateChallengeId } from "@/server/challenges/challenge-documents"
import { boardIdsForRankedGame } from "@/server/leaderboards/leaderboard-board-ids"

import { createNewGame } from "../engine/game-state-reducer"
import { createRankedGameStartState, replayRecordedGame } from "../engine/replay-recorded-game-actions"
import { useBlockPuzzleGameStore } from "./block-puzzle-game-store"
import { parseSavedRankedGameCloudState } from "./ranked-game-cloud-state"

const initial = useBlockPuzzleGameStore.getState()
afterEach(() => useBlockPuzzleGameStore.setState(initial, true))

const store = () => useBlockPuzzleGameStore.getState()
const opponent = { id: "AbCdEfGh23", creatorName: "Duy", creatorTag: "Z9K2", creatorScore: 1500 }
const start = { gameId: "ch1", uid: "u1", seed: 31337, stashUnlocked: true, opponent }

function placeAnything(): boolean {
  for (let slot = 0; slot < 3; slot++)
    for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) if (store().placePiece(slot, row, col)) return true
  return false
}

describe("challenge games", () => {
  it("plays exactly the challenger's opening and records a log the server can replay", () => {
    useBlockPuzzleGameStore.setState({ game: createNewGame(1), dailyDay: "20261027" })
    store().startChallengeGame(start)
    expect(store().game).toEqual(createRankedGameStartState(start))
    expect(store().challenge).toEqual(opponent)
    expect(store().dailyDay).toBeNull()

    for (let i = 0; i < 4; i++) placeAnything()
    const replay = replayRecordedGame(start, store().actionLog)
    expect(replay.ok && replay.state).toEqual(store().game)
  })

  it("queues the challenge run when the next game starts and leaves challenge mode", () => {
    useBlockPuzzleGameStore.setState({ game: createNewGame(1) })
    store().startChallengeGame(start)
    placeAnything()
    store().startNewGame()
    expect(store().challenge).toBeNull()
    expect(store().pendingSubmissions.map((item) => item.gameId)).toEqual(["ch1"])
  })

  it("keeps an untouched challenge game when the tutorial finishes", () => {
    useBlockPuzzleGameStore.setState({ game: createNewGame(1) })
    store().startChallengeGame(start)
    const challengeGame = store().game
    store().finishTutorial()
    expect(store().game).toBe(challengeGame)
  })

  it("drops the challenge label when the account changes and the run becomes offline", () => {
    useBlockPuzzleGameStore.setState({ game: createNewGame(1) })
    store().startChallengeGame(start)
    store().dropCloudStateForOtherUser("someone-else")
    expect(store().rankedSession).toBeNull()
    expect(store().challenge).toBeNull()
  })

  it("restores the opponent from the save and drops malformed ids", () => {
    expect(parseSavedRankedGameCloudState({ challenge: opponent }).challenge).toEqual(opponent)
    expect(parseSavedRankedGameCloudState({ challenge: { ...opponent, id: "../x" } }).challenge).toBeNull()
  })
})

describe("challenge server helpers", () => {
  it("generates short ids that match the public pattern", () => {
    const ids = new Set(Array.from({ length: 200 }, generateChallengeId))
    expect(ids.size).toBe(200)
    for (const id of ids) expect(id).toMatch(CHALLENGE_ID_PATTERN)
  })

  it("keeps challenge runs off every leaderboard", () => {
    expect(boardIdsForRankedGame("challenge", new Date(), null, false)).toEqual([])
  })
})
