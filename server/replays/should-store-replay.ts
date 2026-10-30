import { ALLTIME_BOARD_ID } from "@/server/leaderboards/leaderboard-board-ids"

/** Bảng "mọi lúc" (`alltime`, `*-alltime`): ván lọt top được giữ replay vĩnh viễn (bằng chứng kỷ lục). */
export function isAllTimeBoard(boardId: string): boolean {
  return boardId === ALLTIME_BOARD_ID || boardId.endsWith(`-${ALLTIME_BOARD_ID}`)
}

export interface ReplayDecision {
  store: boolean
  /** Không tự xoá (kỷ lục cá nhân hoặc lọt top bảng mọi lúc). */
  permanent: boolean
  /** Giữ vì lọt top bảng mọi lúc (BXH đang link tới) — kỷ lục cá nhân sau không được bỏ ghim. */
  pinnedByBoard: boolean
  personalBest: boolean
}

/**
 * Tự lưu replay khi ván là kỷ lục cá nhân hoặc làm đổi top 100 của một bảng — đủ để mọi hàng BXH và mọi
 * kỷ lục đều xem lại được, mà không lưu mọi ván. Ván 0 nước / bị gắn cờ nghi vấn thì không lưu.
 */
export function decideReplayStorage(input: {
  moveCount: number
  score: number
  previousBestScore: number
  /** Bảng mà top 100 thay đổi nhờ ván này. */
  topChangedBoards: readonly string[]
  suspect?: boolean
}): ReplayDecision {
  if (input.moveCount === 0 || input.suspect) return { store: false, permanent: false, pinnedByBoard: false, personalBest: false }
  const personalBest = input.score > input.previousBestScore
  const topPermanent = input.topChangedBoards.some(isAllTimeBoard)
  const store = personalBest || input.topChangedBoards.length > 0
  return { store, permanent: store && (personalBest || topPermanent), pinnedByBoard: topPermanent, personalBest }
}
