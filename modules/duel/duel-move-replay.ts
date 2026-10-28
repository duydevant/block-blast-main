import { gameReducer } from "@/modules/block-puzzle/engine/game-state-reducer"
import { BOARD_SIZE, type GameState } from "@/modules/block-puzzle/engine/game-types"
import { recordedActionSchema } from "@/modules/block-puzzle/engine/recorded-action-schema"
import { createRankedGameStartState, MAX_RECORDED_ACTIONS } from "@/modules/block-puzzle/engine/replay-recorded-game-actions"
import { DUEL_VARIANT } from "@/modules/game-modes/variant-run"

import { duelMoveKey, type DuelMoveRecord } from "./duel-types"

/** Bàn đầu ván đấu (cùng cho hai người, người xem và server). */
export function duelStartState(seed: number): GameState {
  return createRankedGameStartState({ seed, stashUnlocked: false, variant: DUEL_VARIANT })
}

/**
 * Nước cuối khi người chơi dừng trước khi hết nước (bỏ trận / hết giờ): không phải nước của engine, chỉ đánh dấu
 * ván người này đã kết thúc để server chốt sớm được (người kia vượt điểm là thắng).
 */
export const DUEL_END_ACTION = { type: "END" } as const

/**
 * Áp một nước đi (đọc từ RTDB) vào bàn; null nếu nước sai dạng / không hợp lệ — từ đó trở đi không áp tiếp
 * (người chơi thật không bao giờ ghi nước sai, chỉ log bị sửa mới có).
 */
export function applyDuelMove(state: GameState, record: unknown): GameState | null {
  const raw = (record as Partial<DuelMoveRecord> | null)?.a as { type?: unknown } | undefined
  if (raw?.type === DUEL_END_ACTION.type) return state.isGameOver ? null : { ...state, isGameOver: true, endedEarly: true, lastMove: null }
  const action = recordedActionSchema.safeParse(raw)
  if (!action.success) return null
  const next = gameReducer(state, action.data)
  return next === state ? null : next
}

export interface DuelReplay {
  state: GameState
  /** Số nước đã áp (liên tục từ 0000). */
  applied: number
}

/**
 * Replay nước đi của một người trong ván: theo thứ tự khoá 0000, 0001…, dừng ở chỗ hở, nước sai, hoặc nước
 * ghi sau `deadline` (giờ server). Server dùng để chấm; kết quả trùng với bàn người xem thấy.
 */
export function replayDuelMoves(seed: number, records: Record<string, unknown> | null | undefined, deadline = Infinity): DuelReplay {
  let state = duelStartState(seed)
  let applied = 0
  for (; applied < MAX_RECORDED_ACTIONS; applied++) {
    const record = records?.[duelMoveKey(applied)] as Partial<DuelMoveRecord> | undefined
    if (!record || typeof record.at !== "number" || record.at > deadline) break
    const next = applyDuelMove(state, record)
    if (!next) break
    state = next
  }
  return { state, applied }
}

/** Bàn → dòng ký tự cho `BlockBoardPreview` ("1".."8" = màu, "." = trống). */
export function duelBoardRows(state: GameState): string[] {
  return Array.from({ length: BOARD_SIZE }, (_, row) =>
    state.board
      .slice(row * BOARD_SIZE, row * BOARD_SIZE + BOARD_SIZE)
      .map((cell) => (cell >= 1 && cell <= 8 ? String(cell) : "."))
      .join("")
  )
}
