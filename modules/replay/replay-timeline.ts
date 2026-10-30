import { decodeActions } from "@/modules/block-puzzle/engine/recorded-action-codec"
import { gameReducer } from "@/modules/block-puzzle/engine/game-state-reducer"
import type { GameState } from "@/modules/block-puzzle/engine/game-types"
import { createRankedGameStartState, type RankedGameStart } from "@/modules/block-puzzle/engine/replay-recorded-game-actions"

export interface ReplayTimeline {
  /** states[0] = đầu ván; states[i] = sau nước thứ i. */
  states: GameState[]
  /** Nước đầu tiên không áp được (replay hỏng) — dừng tại đó; null = đầy đủ. */
  brokenAt: number | null
}

/** Dựng toàn bộ trạng thái từ seed + log nén (engine tất định → giống y ván người chơi đã thấy). */
export function buildReplayTimeline(start: RankedGameStart, encoded: readonly number[]): ReplayTimeline {
  const actions = decodeActions(encoded)
  const states: GameState[] = [createRankedGameStartState(start)]
  if (!actions) return { states, brokenAt: 0 }
  for (let index = 0; index < actions.length; index++) {
    const previous = states[states.length - 1]
    const next = gameReducer(previous, actions[index])
    if (next === previous) return { states, brokenAt: index }
    states.push(next)
  }
  return { states, brokenAt: null }
}
