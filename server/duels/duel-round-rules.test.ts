import { describe, expect, it } from "vitest"

import { gameReducer } from "@/modules/block-puzzle/engine/game-state-reducer"
import { chooseMove } from "@/modules/block-puzzle/engine/balance-simulator"
import { DUEL_END_ACTION, duelBoardRows, duelStartState, replayDuelMoves } from "@/modules/duel/duel-move-replay"
import { DUEL_MOVE_GRACE_MS, DUEL_ROOM_IDLE_TTL_MS, duelMoveKey, type DuelState, freshestDuelState } from "@/modules/duel/duel-types"

import { decideDuelRound, effectiveDuelStatus, isDuelRoundOverdue, nextReadyList } from "./duel-round-rules"

const ENDS = 1_000_000
const decide = (host: { score: number; over: boolean }, guest: { score: number; over: boolean }, now = ENDS - 60_000) =>
  decideDuelRound({ hostUid: "host", guestUid: "guest", endsAt: ENDS, now, progress: { host, guest } })

describe("duel round rules", () => {
  it("keeps the round going while the survivor is still behind — no time cap, they play until out of moves or time", () => {
    expect(decide({ score: 900, over: true }, { score: 500, over: false }).finished).toBe(false)
    expect(decide({ score: 900, over: true }, { score: 900, over: false }).finished).toBe(false)
  })

  it("ends at once when the survivor passes the stopped player's final score", () => {
    expect(decide({ score: 900, over: true }, { score: 901, over: false })).toMatchObject({ finished: true, winnerUid: "guest", endReason: "clinched" })
    expect(decide({ score: 300, over: false }, { score: 200, over: true })).toMatchObject({ finished: true, winnerUid: "host", endReason: "clinched" })
  })

  it("compares scores when both are out of moves or time is up (plus the move grace); a tie is a draw", () => {
    expect(decide({ score: 400, over: true }, { score: 700, over: true })).toMatchObject({ winnerUid: "guest", endReason: "both-over" })
    expect(decide({ score: 400, over: false }, { score: 400, over: false }, ENDS + DUEL_MOVE_GRACE_MS + 1)).toMatchObject({
      finished: true,
      winnerUid: null,
      endReason: "time",
    })
    expect(decide({ score: 400, over: false }, { score: 0, over: false }, ENDS + DUEL_MOVE_GRACE_MS).finished).toBe(false)
  })

  it("expires idle waiting rooms and flags overdue rounds", () => {
    expect(effectiveDuelStatus({ status: "waiting", lastActiveAtMs: 0 }, DUEL_ROOM_IDLE_TTL_MS + 1)).toBe("expired")
    expect(effectiveDuelStatus({ status: "finished", lastActiveAtMs: 0 }, DUEL_ROOM_IDLE_TTL_MS + 1)).toBe("finished")
    expect(isDuelRoundOverdue({ status: "playing", endsAt: ENDS }, ENDS + DUEL_MOVE_GRACE_MS + 1)).toBe(true)
    expect(isDuelRoundOverdue({ status: "finished", endsAt: ENDS }, ENDS * 2)).toBe(false)
  })

  it("starts the next round only when both players are ready", () => {
    expect(nextReadyList([], "host", true, ["host", "guest"])).toEqual({ ready: ["host"], start: false })
    expect(nextReadyList(["host"], "guest", true, ["host", "guest"])).toEqual({ ready: ["host", "guest"], start: true })
    expect(nextReadyList(["host"], "host", false, ["host", "guest"])).toEqual({ ready: [], start: false })
  })

  it("prefers the room state with the higher version", () => {
    const state = (version: number) => ({ version }) as DuelState
    expect(freshestDuelState(state(3), state(5))?.version).toBe(5)
    expect(freshestDuelState(state(6), state(5))?.version).toBe(6)
    expect(freshestDuelState(null, state(1))?.version).toBe(1)
  })
})

describe("duel move replay", () => {
  /** Bot chơi vài nước từ seed → bản ghi RTDB giả lập (khoá 0000…, giờ server tăng dần). */
  function recordMoves(seed: number, count: number, startAt = 1_000) {
    let state = duelStartState(seed)
    const records: Record<string, unknown> = {}
    for (let index = 0; index < count && !state.isGameOver; index++) {
      const move = chooseMove(state)
      if (!move) break
      const action = { type: "PLACE_PIECE" as const, ...move }
      state = gameReducer(state, action)
      records[duelMoveKey(index)] = { a: action, at: startAt + index * 1_000 }
    }
    return { records, state }
  }

  it("rebuilds the same board and score the player saw", () => {
    const { records, state } = recordMoves(42, 12)
    const replay = replayDuelMoves(42, records)
    expect(replay.applied).toBe(Object.keys(records).length)
    expect(replay.state.score).toBe(state.score)
    expect(duelBoardRows(replay.state)).toEqual(duelBoardRows(state))
  })

  it("treats a final END move (left / time up) as stopped, so the other player can clinch", () => {
    const { records, state } = recordMoves(11, 6)
    const ended = replayDuelMoves(11, { ...records, [duelMoveKey(Object.keys(records).length)]: { a: DUEL_END_ACTION, at: 99_000 } })
    expect(ended.state).toMatchObject({ isGameOver: true, endedEarly: true, score: state.score })
    expect(decide({ score: ended.state.score, over: ended.state.isGameOver }, { score: ended.state.score + 1, over: false }).endReason).toBe("clinched")
    // Sau END không áp thêm nước nào.
    const after = { ...records, [duelMoveKey(6)]: { a: DUEL_END_ACTION, at: 1 }, [duelMoveKey(7)]: records[duelMoveKey(0)] }
    expect(replayDuelMoves(11, after).applied).toBe(7)
  })

  it("ignores moves written after the deadline, after a gap, or tampered with", () => {
    const { records } = recordMoves(7, 10)
    expect(replayDuelMoves(7, records, 1_000 + 4 * 1_000).applied).toBe(5)

    const gap = { ...records }
    delete gap[duelMoveKey(3)]
    expect(replayDuelMoves(7, gap).applied).toBe(3)

    const tampered = { ...records, [duelMoveKey(2)]: { a: { type: "PLACE_PIECE", slot: 0, row: 99, col: 99 }, at: 3_000 } }
    expect(replayDuelMoves(7, tampered).applied).toBe(2)
    expect(replayDuelMoves(7, { [duelMoveKey(0)]: { a: { type: "REVIVE" }, at: 1 } }).applied).toBe(0)
  })
})
