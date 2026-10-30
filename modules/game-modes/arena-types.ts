import type { ArenaType } from "./arena-catalog"
import type { ArenaRunStatus } from "./arena-goal-rules"

/** Lượt Đấu trường hiển thị cho client. */
export interface ArenaRunView {
  runId: string
  type: ArenaType
  level: number
  status: ArenaRunStatus
  attemptsUsed: number
  gamesDone: number
  attemptsLeft: number
  /** Epoch ms hết hạn lượt. */
  expiresAt: number
}

/** GET /api/arena */
export interface ArenaStatusResponse {
  openRun: ArenaRunView | null
}

/** POST /api/games/start (mode arena) → thông tin lần thử. */
export interface ArenaStartInfo {
  runId: string
  type: ArenaType
  level: number
  /** Lần thử thứ mấy (1-based). */
  attempt: number
  /** Epoch ms (giờ server) đồng hồ lần thử hết — chỉ loại Tốc độ. */
  endsAt: number | null
  serverNow: number
}

/** Kết quả lần thử trả kèm phần thưởng ván. */
export interface ArenaAttemptReward {
  type: ArenaType
  level: number
  met: boolean
  value: number
  status: ArenaRunStatus
  attemptsLeft: number
  /** Xu + XP thưởng khi thắng lượt (đã gộp vào phần thưởng ván). */
  coins: number
  xp: number
}
