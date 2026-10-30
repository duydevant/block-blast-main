import type { ArenaLevelDefinition } from "./arena-catalog"

/** Trạng thái một lượt Đấu trường (đã trả xu). */
export type ArenaRunStatus = "open" | "won" | "lost" | "expired"

export interface ArenaRunProgress {
  status: ArenaRunStatus
  /** Số lần thử đã dùng (Bền bỉ: số ván đã chơi). */
  attemptsUsed: number
  /** Bền bỉ: số ván liên tiếp đã đạt. */
  gamesDone: number
}

/** Số liệu một lần thử đã replay (server) — thời gian theo giờ server. */
export interface ArenaAttemptResult {
  score: number
  linesCleared: number
  bestCombo: number
  /** Từ lúc cấp seed tới lúc nộp (ms, giờ server). */
  durationMs: number
  /** Từ nước đầu tới nước cuối theo thời điểm client ghi (null = không có). */
  playSpanMs?: number | null
}

/** Ân hạn nộp ván sau khi đồng hồ lần thử hết (mạng chậm, hàng chờ nộp, tab bị treo). */
export const ARENA_SUBMIT_GRACE_MS = 120_000
/** Sai số cho nhịp chơi thực (client tự chốt ván đúng lúc hết giờ). */
export const ARENA_PLAY_SPAN_SLACK_MS = 3_000

/** Giá trị mục tiêu của lần thử + đạt chưa (Tốc độ: nộp quá giờ → không đạt dù điểm cao). */
export function evaluateArenaAttempt(definition: ArenaLevelDefinition, result: ArenaAttemptResult): { met: boolean; value: number } {
  const { goal } = definition
  const value = goal.kind === "score" ? result.score : goal.kind === "lines" ? result.linesCleared : result.bestCombo
  const limit = definition.attemptTimeMs
  // Giờ server chặn trên (không thể chơi lâu rồi nộp); nhịp thực từ client chặn phần ân hạn nộp.
  const inTime =
    limit === null ||
    (result.durationMs <= limit + ARENA_SUBMIT_GRACE_MS && (result.playSpanMs == null || result.playSpanMs <= limit + ARENA_PLAY_SPAN_SLACK_MS))
  return { met: inTime && value >= goal.target, value }
}

/**
 * Lượt sau một lần thử. Loại thường: đạt → thắng; hết lần thử → thua. Bền bỉ: đạt → +1 ván (đủ số ván → thắng),
 * trượt một ván → thua ngay. Quá hạn lượt → hết hạn (= thua, không hoàn xu).
 */
export function nextArenaRun(definition: ArenaLevelDefinition, run: ArenaRunProgress, met: boolean, expired: boolean): ArenaRunProgress {
  if (run.status !== "open") return run
  if (expired) return { ...run, status: "expired" }
  const attemptsUsed = run.attemptsUsed + 1
  if (definition.type === "endurance") {
    if (!met) return { status: "lost", attemptsUsed, gamesDone: run.gamesDone }
    const gamesDone = run.gamesDone + 1
    return { status: gamesDone >= definition.attempts ? "won" : "open", attemptsUsed, gamesDone }
  }
  if (met) return { status: "won", attemptsUsed, gamesDone: run.gamesDone + 1 }
  return { status: attemptsUsed >= definition.attempts ? "lost" : "open", attemptsUsed, gamesDone: run.gamesDone }
}

/** Còn được thử thêm không (Bền bỉ: còn ván cần chơi). */
export function attemptsLeft(definition: ArenaLevelDefinition, run: ArenaRunProgress): number {
  if (run.status !== "open") return 0
  return definition.type === "endurance" ? definition.attempts - run.gamesDone : definition.attempts - run.attemptsUsed
}
