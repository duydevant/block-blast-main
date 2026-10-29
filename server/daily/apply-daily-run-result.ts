import "server-only"

import { type DocumentReference, FieldValue, type Firestore, type Transaction } from "firebase-admin/firestore"

import { isoWeekKeyForDay } from "@/lib/vn-calendar"
import type { DailyRunGameReward } from "@/modules/player-profile/player-profile-types"
import { dailyGoalsFor, dailyRunReward } from "@/modules/progression/daily-challenge-goals"
import { challengeWeekBoardId, isChallengeWeekOpen } from "@/server/leaderboards/leaderboard-board-ids"
import { leaderboardRef, parseLeaderboardTop } from "@/server/leaderboards/leaderboard-documents"
import { mergeScoreIntoTopList } from "@/server/leaderboards/merge-score-into-top-list"
import { LEADERBOARD_ENTRIES_SUBCOLLECTION } from "@/server/profile/stored-player-document"

import { type DailyDay, dailyDayRef, parseDailyDay } from "./daily-challenge-documents"
import { dailyRunCounts } from "./daily-run-counts"

/** Mọi thứ lượt thử thách cần, đọc trong transaction nộp ván (Firestore: đọc hết rồi mới ghi). */
export interface DailyRunContext {
  dayRef: DocumentReference
  day: DailyDay
  /** Lượt tính điểm (đã giữ chỗ, chưa nộp, còn hạn). */
  counts: boolean
  /** Lượt đầu tiên của ngày → vào cả bảng Hôm nay / Tuần / Mọi lúc. */
  firstRun: boolean
  /** Bảng tổng tuần còn mở → cộng phần điểm ngày tăng thêm. */
  week: { boardRef: DocumentReference; entryRef: DocumentReference; total: number; top: ReturnType<typeof parseLeaderboardTop> } | null
}

export async function readDailyRunContext(
  tx: Transaction,
  db: Firestore,
  input: { uid: string; gameId: string; dayKey: string; today: string; now: Date }
): Promise<DailyRunContext> {
  const dayRef = dailyDayRef(db, input.uid, input.dayKey)
  const day = parseDailyDay((await tx.get(dayRef)).data())
  const counts = dailyRunCounts({ runs: day.runs, finished: day.finished, gameId: input.gameId, day: input.dayKey, today: input.today })
  const weekKey = isoWeekKeyForDay(input.dayKey)
  let week: DailyRunContext["week"] = null
  if (counts && isChallengeWeekOpen(weekKey, input.now)) {
    const boardRef = leaderboardRef(db, challengeWeekBoardId(weekKey))
    const entryRef = boardRef.collection(LEADERBOARD_ENTRIES_SUBCOLLECTION).doc(input.uid)
    const [boardSnap, entrySnap] = await tx.getAll(boardRef, entryRef)
    const total = entrySnap.get("score")
    week = { boardRef, entryRef, total: typeof total === "number" ? total : 0, top: parseLeaderboardTop(boardSnap.data()) }
  }
  // Lượt đầu = lượt giữ chỗ đầu tiên còn trong danh sách (không dùng số thứ tự: lượt bỏ ngang được trả lại).
  return { dayRef, day, counts, firstRun: day.runs[0] === input.gameId, week }
}

export interface DailyRunOutcome {
  reward: DailyRunGameReward
  /** Điểm cao nhất ngày sau lượt này. */
  dayBest: number
  /** Kỷ lục thử thách mọi thời điểm sau lượt này. */
  dailyBest: number
}

/** Kết quả một lượt tính điểm: sao + kỷ lục mới đạt (xu), điểm cao nhất của ngày. */
export function dailyRunOutcome(context: DailyRunContext, score: number, dailyBest: number): DailyRunOutcome {
  // Lượt bắt đầu trước khi có mốc (bản cũ) → mốc mặc định theo kỷ lục hiện có.
  const goals = context.day.goals ?? dailyGoalsFor([], dailyBest > 0 ? dailyBest : null)
  const result = dailyRunReward(goals, { stars: context.day.stars, recordBroken: context.day.recordBroken }, score)
  return {
    reward: {
      run: context.day.finished.length + 1,
      stars: result.progress.stars,
      newStars: result.newStars,
      recordBroken: result.recordBroken,
      coins: result.coins,
    },
    dayBest: Math.max(context.day.score ?? 0, score),
    dailyBest: Math.max(dailyBest, score),
  }
}

/** Ghi kết quả lượt: doc ngày (điểm cao nhất, sao, lượt đã nộp) + tổng tuần khi điểm ngày tăng. */
export function writeDailyRunResult(
  tx: Transaction,
  context: DailyRunContext,
  outcome: DailyRunOutcome,
  input: { uid: string; displayName: string | null; gameId: string; moveCount: number; stamp: FieldValue }
) {
  const { day } = context
  tx.set(
    context.dayRef,
    {
      status: "done",
      score: outcome.dayBest,
      stars: outcome.reward.stars,
      recordBroken: day.recordBroken || outcome.reward.recordBroken,
      // Ghi cả danh sách (không arrayUnion): doc cũ chỉ có gameId, lượt cũ đó phải vẫn tính là đã nộp.
      finished: [...day.finished, input.gameId],
      runs: day.runs,
      ...(outcome.dayBest > (day.score ?? 0) ? { moveCount: input.moveCount, bestGameId: input.gameId } : {}),
      ...(context.week ? { weekCounted: true } : {}),
      finishedAt: input.stamp,
    },
    { merge: true }
  )

  // Điểm ngày chưa từng cộng vào tổng tuần (doc cũ có điểm từ trước khi có bảng tuần) → cộng cả điểm ngày.
  const delta = outcome.dayBest - (day.weekCounted ? (day.score ?? 0) : 0)
  if (!context.week || delta <= 0) return
  const row = { uid: input.uid, displayName: input.displayName, score: context.week.total + delta }
  tx.set(context.week.entryRef, { ...row, updatedAt: input.stamp })
  const top = mergeScoreIntoTopList(context.week.top, row)
  if (top) tx.set(context.week.boardRef, { top, updatedAt: input.stamp })
}

/** Ván 0 nước (bỏ ngang trước khi đặt khối): trả lại lượt để chơi lượt khác. */
export function releaseDailyRun(tx: Transaction, context: DailyRunContext, gameId: string) {
  const runs = context.day.runs.filter((run) => run !== gameId)
  if (runs.length === 0 && context.day.finished.length === 0) tx.delete(context.dayRef)
  else tx.set(context.dayRef, { runs }, { merge: true })
}
