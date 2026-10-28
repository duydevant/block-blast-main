import { describe, expect, it } from "vitest"

import { canPlace } from "./board-grid-operations"
import { createNewGame, gameReducer, STASH_SLOT } from "./game-state-reducer"
import { BOARD_SIZE, type GameAction, type GameState, type TrayPiece, TRAY_SIZE } from "./game-types"
import { findShape } from "./piece-shape-catalog"
import { nextRandomInt } from "./seeded-random-generator"

interface Trace {
  actions: GameAction[]
  /** states[i] là state trước actions[i]; states[i + 1] là state sau actions[i]. */
  states: GameState[]
}

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8]

/**
 * Ván bắt đầu của driver. Ô cất mở sẵn (như ván sau trong store) để STASH_PIECE có hiệu lực
 * mà không cần chơi tới mốc điểm; replay dùng đúng cùng state này.
 */
const startingState = (seed: number): GameState => ({ ...createNewGame(seed), stashUnlocked: true })

/** Mọi nước đặt hợp lệ, kể cả đặt khối từ ô cất. */
function legalPlacements(state: GameState): GameAction[] {
  const sources: [number, TrayPiece | null | undefined][] = [...state.tray.map((piece, slot): [number, TrayPiece | null] => [slot, piece])]
  if (state.stash) sources.push([STASH_SLOT, state.stash])
  const moves: GameAction[] = []
  for (const [slot, piece] of sources) {
    const shape = piece && findShape(piece.shapeId)
    if (!shape) continue
    for (let row = 0; row < BOARD_SIZE; row++)
      for (let col = 0; col < BOARD_SIZE; col++)
        if (canPlace(state.board, shape, row, col)) moves.push({ type: "PLACE_PIECE", slot, row, col })
  }
  return moves
}

/** Chọn nước tiếp theo bằng rng riêng của test: đổi khay, cất khối, đặt khối; hết nước thì hồi sinh một lần. */
function nextAction(state: GameState, pick: (count: number) => number): GameAction | null {
  if (state.isGameOver) return state.reviveUsed ? null : { type: "REVIVE" }
  const roll = pick(100)
  if (roll < 5) return { type: "REPLACE_TRAY" }
  if (roll < 12) return { type: "STASH_PIECE", slot: pick(TRAY_SIZE) }
  const moves = legalPlacements(state)
  if (moves.length === 0) throw new Error("not game over but no legal placement")
  return moves[pick(moves.length)]
}

/** Chơi một ván từ seed bằng driver có seed; trả về toàn bộ action log và state. */
function playSeeded(seed: number, maxSteps = 3000): Trace {
  let rng = (seed * 0x9e3779b9) >>> 0
  const pick = (count: number): number => {
    const [value, next] = nextRandomInt(rng, count)
    rng = next
    return value
  }
  let state = startingState(seed)
  const trace: Trace = { actions: [], states: [state] }
  while (trace.actions.length < maxSteps) {
    const action = nextAction(state, pick)
    if (!action) break
    state = gameReducer(state, action)
    trace.actions.push(action)
    trace.states.push(state)
  }
  return trace
}

describe("power-up replay determinism", () => {
  it.each(SEEDS)("seed %i replays every intermediate state identically from the same actions", (seed) => {
    const trace = playSeeded(seed)
    const replayed: GameState[] = [startingState(seed)]
    for (const action of trace.actions) replayed.push(gameReducer(replayed[replayed.length - 1], action))
    expect(replayed).toEqual(trace.states)
  })

  it("the seeded driver itself produces the same action log on every run", () => {
    expect(playSeeded(3).actions).toEqual(playSeeded(3).actions)
  })

  it("different seeds produce different openings", () => {
    expect(playSeeded(1).states[0].tray).not.toEqual(playSeeded(2).states[0].tray)
  })

  it("exercises replace, stash, stash placement, and revive across the seeded games", () => {
    const counts = { replace: 0, stash: 0, stashPlace: 0, revive: 0 }
    for (const seed of SEEDS) {
      const { actions, states } = playSeeded(seed)
      actions.forEach((action, i) => {
        const prev = states[i]
        const next = states[i + 1]
        if (next.replaceCharges !== prev.replaceCharges) counts.replace++
        if (!prev.stash && next.stash) counts.stash++
        if (action.type === "PLACE_PIECE" && action.slot === STASH_SLOT && next !== prev) counts.stashPlace++
        if (!prev.reviveUsed && next.reviveUsed) counts.revive++
      })
    }
    expect(counts.replace).toBeGreaterThan(0)
    expect(counts.stash).toBeGreaterThan(0)
    expect(counts.stashPlace).toBeGreaterThan(0)
    expect(counts.revive).toBeGreaterThan(0)
  })

  it("a mid-run JSON save restored and continued with the same actions reaches the same final state", () => {
    for (const seed of SEEDS) {
      const { actions, states } = playSeeded(seed)
      const mid = Math.floor(actions.length / 2)
      const saved = JSON.parse(JSON.stringify(states[mid])) as GameState
      const restored = gameReducer(createNewGame(seed), { type: "RESTORE", state: saved })
      const resumed = actions.slice(mid).reduce(gameReducer, restored)
      expect({ ...resumed, lastMove: null }).toEqual({ ...states[states.length - 1], lastMove: null })
    }
  })
})
