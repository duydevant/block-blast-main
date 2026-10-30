import "server-only"

import type { DocumentReference, Firestore, Transaction } from "firebase-admin/firestore"

import { attemptsLeft, evaluateArenaAttempt, nextArenaRun } from "@/modules/game-modes/arena-goal-rules"
import type { ArenaAttemptReward } from "@/modules/game-modes/arena-types"

import { arenaRunRef, parseArenaRun, progressOf, type StoredArenaRun } from "./arena-run-documents"

export interface ArenaSubmitContext {
  ref: DocumentReference
  run: StoredArenaRun
}

/** Đọc (trong transaction) lượt của session Đấu trường; lượt không còn / không phải của người chơi → null. */
export async function readArenaContext(tx: Transaction, db: Firestore, uid: string, runId: string | null): Promise<ArenaSubmitContext | null> {
  if (!runId) return null
  const ref = arenaRunRef(db, runId)
  const run = parseArenaRun((await tx.get(ref)).data())
  return run && run.uid === uid ? { ref, run } : null
}

/** Lần thử bắt đầu sau khi lượt hết hạn → hết hạn (lần thử bắt đầu trong hạn thì được chơi trọn). */
const startedAfterExpiry = (run: StoredArenaRun, startedMs: number) => startedMs >= run.expiresAtMs

/**
 * Lần thử kết thúc mà không chấm được (0 nước, log hỏng): tính là trượt — không cho rút lại lần thử để đổi seed / đồng
 * hồ. Trả true nếu lượt vì thế đã đóng (thua / hết hạn).
 */
export function failArenaAttempt(tx: Transaction, context: ArenaSubmitContext, gameId: string, startedMs: number): boolean {
  const { run } = context
  if (run.openGameId !== gameId || run.status !== "open") return false
  const next = nextArenaRun(run.definition, progressOf(run), false, startedAfterExpiry(run, startedMs))
  tx.update(context.ref, { ...next, openGameId: null })
  return next.status !== "open"
}

export interface ArenaAttemptOutcome {
  /** Field cập nhật vào doc lượt. */
  runPatch: Record<string, unknown>
  /** Lượt đã đóng (thắng / thua / hết hạn) → bỏ `arenaRunOpen` của người chơi. */
  closed: boolean
  reward: ArenaAttemptReward
}

/**
 * Chấm một lần thử đã replay (thuần). Ván bị gắn cờ tính là không đạt. Lần thử không còn là session đang mở của lượt
 * (đã bị thay bởi lần thử mới) → không đổi lượt.
 */
export function arenaAttemptOutcome(input: {
  context: ArenaSubmitContext
  gameId: string
  summary: { score: number; linesCleared: number; bestCombo: number }
  durationMs: number
  /** Thời gian từ nước đầu tới nước cuối theo `times` của client (null = không có). */
  playSpanMs: number | null
  startedMs: number
  flagged: boolean
}): ArenaAttemptOutcome {
  const { run } = input.context
  const definition = run.definition
  const evaluation = evaluateArenaAttempt(definition, { ...input.summary, durationMs: input.durationMs, playSpanMs: input.playSpanMs })
  const met = evaluation.met && !input.flagged
  const current = progressOf(run)
  const isCurrentAttempt = run.openGameId === input.gameId && current.status === "open"
  const next = isCurrentAttempt ? nextArenaRun(definition, current, met, startedAfterExpiry(run, input.startedMs)) : current
  const won = isCurrentAttempt && next.status === "won"
  return {
    runPatch: isCurrentAttempt ? { ...next, openGameId: null } : {},
    closed: isCurrentAttempt && next.status !== "open",
    reward: {
      type: run.type,
      level: run.level,
      met,
      value: evaluation.value,
      status: next.status,
      attemptsLeft: attemptsLeft(definition, next),
      coins: won ? definition.rewardCoins : 0,
      xp: won ? definition.rewardXp : 0,
    },
  }
}

/** Gộp kết quả lần thử cho luồng nộp ván: phần thưởng + cấp cao nhất mới của từng loại. Không phải ván Đấu trường → rỗng. */
export function summarizeArenaAttempt(input: {
  context: ArenaSubmitContext | null
  arenaLevels: Readonly<Record<string, number>>
  gameId: string
  summary: { score: number; linesCleared: number; bestCombo: number }
  durationMs: number
  playSpanMs: number | null
  startedMs: number
  flagged: boolean
}) {
  const { context } = input
  if (!context) return { outcome: null, won: false, levels: input.arenaLevels, coins: 0, xp: 0 }
  const outcome = arenaAttemptOutcome({ ...input, context })
  const won = outcome.reward.status === "won" && outcome.reward.coins > 0
  const { type, level } = context.run
  const levels = won ? { ...input.arenaLevels, [type]: Math.max(input.arenaLevels[type] ?? 0, level) } : input.arenaLevels
  return { outcome, won, levels, coins: outcome.reward.coins, xp: outcome.reward.xp }
}
