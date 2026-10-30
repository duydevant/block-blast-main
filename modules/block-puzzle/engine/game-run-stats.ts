import type { GameAction, GameState } from "./game-types"

/**
 * Chỉ số kỹ năng của một ván (ngoài điểm): reducer cộng dồn sau mỗi nước hợp lệ nên client (hộp hết ván)
 * và server (replay) luôn ra cùng một số. Không ảnh hưởng luật hay điểm.
 */
export interface GameRunStats {
  /** Số nước có xoá ít nhất 1 dòng. */
  clearMoves: number
  /** Số nước xoá ≥2, ≥3, ≥4 dòng cùng lúc. */
  multiClears: readonly [number, number, number]
  /** Số dòng (hàng + cột) xoá nhiều nhất trong một nước. */
  maxLinesInMove: number
  bestCombo: number
  boardClears: number
  stashUses: number
  replaceUses: number
  reviveUsed: boolean
}

export const EMPTY_RUN_STATS: GameRunStats = {
  clearMoves: 0,
  multiClears: [0, 0, 0],
  maxLinesInMove: 0,
  bestCombo: 0,
  boardClears: 0,
  stashUses: 0,
  replaceUses: 0,
  reviveUsed: false,
}

/** Cộng một nước hợp lệ (`next` là state sau nước đó) vào chỉ số ván. */
export function accumulateRunStats(stats: GameRunStats, action: GameAction, next: GameState): GameRunStats {
  switch (action.type) {
    case "PLACE_PIECE": {
      const move = next.lastMove
      if (!move) return stats
      const lines = move.clearedRows.length + move.clearedCols.length
      const [two, three, four] = stats.multiClears
      return {
        ...stats,
        clearMoves: stats.clearMoves + (lines > 0 ? 1 : 0),
        multiClears: [two + (lines >= 2 ? 1 : 0), three + (lines >= 3 ? 1 : 0), four + (lines >= 4 ? 1 : 0)],
        maxLinesInMove: Math.max(stats.maxLinesInMove, lines),
        bestCombo: Math.max(stats.bestCombo, move.combo),
        boardClears: stats.boardClears + (move.boardCleared ? 1 : 0),
      }
    }
    case "STASH_PIECE":
      return { ...stats, stashUses: stats.stashUses + 1 }
    case "REPLACE_TRAY":
      return { ...stats, replaceUses: stats.replaceUses + 1 }
    case "REVIVE":
      return { ...stats, reviveUsed: true }
    default:
      return stats
  }
}

/** Ván "thuần": không dùng Cất, Đổi khối hay Hồi sinh (phong cách chơi, không phải chế độ riêng). */
export function isPureRun(stats: GameRunStats): boolean {
  return stats.stashUses === 0 && stats.replaceUses === 0 && !stats.reviveUsed
}

/** Điểm trung bình mỗi nước (hiệu suất); 0 khi chưa đi nước nào. */
export function pointsPerMove(score: number, moveCount: number): number {
  return moveCount > 0 ? score / moveCount : 0
}
