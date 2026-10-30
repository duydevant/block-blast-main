import type { RankedGameMode } from "./player-profile-types"

/** Một ván trong lịch sử (GET /api/games/history). */
export interface GameHistoryEntry {
  gameId: string
  mode: RankedGameMode
  score: number
  moveCount: number
  linesCleared: number
  bestCombo: number
  boardClears: number
  /** Số nước xoá ≥ 3 dòng cùng lúc. */
  multiClears3: number
  /** Ván thuần: không Cất / Đổi khối / Hồi sinh. */
  pure: boolean
  levelId: number | null
  /** Khoá ngày của thử thách ngày (chỉ ván daily). */
  day: string | null
  /** Epoch ms lúc nộp. */
  finishedAt: number
}

export interface GameHistoryResponse {
  items: GameHistoryEntry[]
  /** Truyền lại để lấy trang kế; null = hết. */
  nextCursor: string | null
}

export const GAME_HISTORY_PAGE_SIZE = 30
export const GAME_HISTORY_MODES = ["classic", "logic", "daily", "challenge", "level", "duel", "arena", "ranked"] as const satisfies readonly RankedGameMode[]
