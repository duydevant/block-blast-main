import { chooseMove } from "@/modules/block-puzzle/engine/balance-simulator"
import { gameReducer } from "@/modules/block-puzzle/engine/game-state-reducer"
import { encodeAction } from "@/modules/block-puzzle/engine/recorded-action-codec"
import { createRankedGameStartState } from "@/modules/block-puzzle/engine/replay-recorded-game-actions"
import { nextRandom, normalizeSeed } from "@/modules/block-puzzle/engine/seeded-random-generator"
import { listPlacements } from "@/modules/block-puzzle/engine/tray-solvability-search"
import { findShape } from "@/modules/block-puzzle/engine/piece-shape-catalog"
import type { RulesVersion } from "@/modules/block-puzzle/engine/game-types"
import { DUEL_VARIANT, withRulesVersion } from "@/modules/game-modes/variant-run"

import { RANKED_TIME_MS } from "./rating-rules"

/** Trận xếp hạng: luật như đấu 1v1 (không Cất / Đổi / Hồi sinh), 3 phút. */
export const RANKED_VARIANT = DUEL_VARIANT
export { RANKED_TIME_MS }

/** Ván bóng ma: nước đi nén + thời điểm tương đối (ms từ đầu ván) + điểm cuối. */
export interface GhostGame {
  seed: number
  actions: number[]
  times: number[]
  score: number
}

/**
 * Bot làm bóng ma khi chưa có ván người thật cùng trình độ: bot tham lam, thỉnh thoảng đi nước ngẫu nhiên (MMR càng
 * thấp càng hay "nhầm"), nhịp 0.7–1.6 s/nước, dừng khi hết 3 phút. Tất định theo seed (server tạo, client chỉ phát lại).
 */
export function playBotGhost(seed: number, mmr: number, rulesVersion?: RulesVersion): GhostGame {
  let rng = normalizeSeed(seed ^ 0x6b43a9b5)
  const random = () => {
    const [value, next] = nextRandom(rng)
    rng = next
    return value
  }
  const mistakeRate = Math.min(0.5, Math.max(0.02, (1300 - mmr) / 1000))
  let state = createRankedGameStartState({ seed, stashUnlocked: false, variant: withRulesVersion(RANKED_VARIANT, rulesVersion) })
  const actions: number[] = []
  const times: number[] = []
  let clock = 0
  while (!state.isGameOver) {
    clock += 700 + Math.floor(random() * 900)
    if (clock > RANKED_TIME_MS) break
    let move = chooseMove(state)
    if (random() < mistakeRate) {
      const slots = state.tray.flatMap((piece, slot) => (piece ? [{ slot, shape: findShape(piece.shapeId)! }] : []))
      const pick = slots[Math.floor(random() * slots.length)]
      const placements = pick ? listPlacements(state.board, pick.shape) : []
      if (pick && placements.length > 0) move = { slot: pick.slot, ...placements[Math.floor(random() * placements.length)] }
    }
    if (!move) break
    const action = { type: "PLACE_PIECE" as const, ...move }
    const next = gameReducer(state, action)
    if (next === state) break
    state = next
    actions.push(encodeAction(action))
    times.push(clock)
  }
  return { seed, actions, times, score: state.score }
}

/** Thời điểm tương đối của ván người thật (epoch ms của client) → ms từ đầu ván; nước đầu coi như sau 1 s. */
export function relativeGhostTimes(times: readonly number[] | null, count: number): number[] {
  if (!times || times.length !== count || count === 0) return Array.from({ length: count }, (_, index) => (index + 1) * 1000)
  return times.map((time) => Math.max(0, Math.round(time - times[0])) + 1000)
}
