import { describe, expect, it } from "vitest"

import { chooseMove } from "./balance-simulator"
import { createNewGame, gameReducer } from "./game-state-reducer"
import type { GameState, GameVariant } from "./game-types"
import { findShape } from "./piece-shape-catalog"
import { type RecordedGameAction, replayRecordedGame } from "./replay-recorded-game-actions"
import { canPlaceAllInSomeOrder } from "./tray-solvability-search"

const LOGIC: GameVariant = { guaranteedTray: true }

/** Bot chơi tới hết; trả các khay vừa chia (đủ 3 khối) kèm bàn lúc chia + log nước đi. */
function playLogicGame(seed: number) {
  let state = createNewGame(seed, LOGIC)
  const dealt: { board: GameState["board"]; tray: GameState["tray"] }[] = [{ board: state.board, tray: state.tray }]
  const actions: RecordedGameAction[] = []
  while (!state.isGameOver && actions.length < 300) {
    const move = chooseMove(state)
    if (!move) break
    const action: RecordedGameAction = { type: "PLACE_PIECE", ...move }
    const next = gameReducer(state, action)
    if (next.tray.every((piece) => piece !== null) && state.tray.some((piece) => piece === null || piece.uid !== next.tray[0]?.uid)) {
      dealt.push({ board: next.board, tray: next.tray })
    }
    state = next
    actions.push(action)
  }
  return { state, dealt, actions }
}

describe("guaranteed tray dealer", () => {
  it("keeps the flag in state and only deals trays that can all be placed", () => {
    for (const seed of [1, 2, 3, 17, 99]) {
      const { state, dealt } = playLogicGame(seed)
      expect(state.guaranteedTray).toBe(true)
      for (const { board, tray } of dealt) {
        const shapes = tray.map((piece) => findShape(piece!.shapeId)!)
        expect(canPlaceAllInSomeOrder(board, shapes, 6000)).not.toBe(false)
      }
    }
  })

  it("replays deterministically on the server with the same variant", () => {
    const { state, actions } = playLogicGame(42)
    const replay = replayRecordedGame({ seed: 42, stashUnlocked: false, variant: LOGIC }, actions)
    expect(replay.ok && replay.state.score).toBe(state.score)
    // Không có biến thể → bộ chia khác → log không còn hợp lệ hoặc ra điểm khác (không thể giả ván logic bằng ván thường).
    const classic = replayRecordedGame({ seed: 42, stashUnlocked: false }, actions)
    expect(classic.ok && classic.state.score === state.score && classic.state.tray === state.tray).toBe(false)
  })

  it("leaves classic games untouched", () => {
    expect(createNewGame(7).guaranteedTray).toBeUndefined()
  })
})
