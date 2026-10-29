import "server-only"

import { type DocumentReference, FieldPath, type Firestore } from "firebase-admin/firestore"
import { z } from "zod"

import { type DailyGoals, dailyGoalsFor, type RecentDailyBests, recentBestsBefore, withRecentBest } from "@/modules/progression/daily-challenge-goals"
import { DAILY_RESULTS_SUBCOLLECTION, type StoredPlayer, USERS_COLLECTION } from "@/server/profile/stored-player-document"

/** users/{uid}/dailyWeeks/{YYYY-Www}: rương sao đã nhận + thưởng hạng tuần đã nhận. */
export const DAILY_WEEKS_SUBCOLLECTION = "dailyWeeks"

const goalsSchema = z.object({
  form: z.number().int().nonnegative(),
  targets: z.array(z.number().int().positive()).min(1),
  record: z.number().int().positive().nullable(),
})

/**
 * Doc users/{uid}/daily/{day}. Doc cũ (1 lượt/ngày) chỉ có `gameId` → coi như một lượt.
 * `status`: "started" = có lượt đã bắt đầu, "done" = đã nộp xong ít nhất một lượt (streak, thưởng chuỗi).
 */
const dailyDaySchema = z.object({
  runs: z.array(z.string()).catch([]),
  gameId: z.string().optional().catch(undefined),
  finished: z.array(z.string()).catch([]),
  status: z.enum(["started", "done"]).optional().catch(undefined),
  /** Điểm cao nhất trong ngày. */
  score: z.number().int().nonnegative().optional().catch(undefined),
  goals: goalsSchema.nullable().optional().catch(null),
  stars: z.number().int().min(0).catch(0),
  recordBroken: z.boolean().catch(false),
  /** Điểm ngày đã được cộng vào tổng tuần (doc cũ trước khi có bảng tuần thì chưa). */
  weekCounted: z.boolean().catch(false),
})

export interface DailyDay {
  exists: boolean
  /** gameId các lượt tính điểm đã bắt đầu (tối đa DAILY_RUNS_PER_DAY). */
  runs: string[]
  finished: string[]
  status: "started" | "done" | null
  score: number | null
  goals: DailyGoals | null
  stars: number
  recordBroken: boolean
  weekCounted: boolean
}

export function parseDailyDay(data: unknown): DailyDay {
  const parsed = dailyDaySchema.safeParse(data ?? {})
  const doc = parsed.success ? parsed.data : dailyDaySchema.parse({})
  return {
    exists: data !== undefined && data !== null,
    runs: doc.runs.length > 0 ? doc.runs : doc.gameId ? [doc.gameId] : [],
    finished: doc.finished.length > 0 ? doc.finished : doc.status === "done" && doc.gameId ? [doc.gameId] : [],
    status: doc.status ?? null,
    score: doc.score ?? null,
    goals: doc.goals ?? null,
    stars: doc.stars,
    recordBroken: doc.recordBroken,
    weekCounted: doc.weekCounted,
  }
}

export function dailyDayRef(db: Firestore, uid: string, day: string): DocumentReference {
  return db.collection(USERS_COLLECTION).doc(uid).collection(DAILY_RESULTS_SUBCOLLECTION).doc(day)
}

export function dailyWeekRef(db: Firestore, uid: string, week: string): DocumentReference {
  return db.collection(USERS_COLLECTION).doc(uid).collection(DAILY_WEEKS_SUBCOLLECTION).doc(week)
}

/** Người chơi cũ (trước khi lưu `dailyRecent`): đọc lịch sử 30 ngày gần nhất một lần (truy vấn tăng dần, không cần index). */
const LEGACY_HISTORY_DAYS = 30

async function legacyRecentBests(db: Firestore, uid: string, day: string): Promise<RecentDailyBests> {
  const from = new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(4, 6)) - 1, Number(day.slice(6, 8))) - LEGACY_HISTORY_DAYS * 24 * 60 * 60 * 1000)
  const snap = await db
    .collection(USERS_COLLECTION)
    .doc(uid)
    .collection(DAILY_RESULTS_SUBCOLLECTION)
    .where(FieldPath.documentId(), ">=", from.toISOString().slice(0, 10).replaceAll("-", ""))
    .where(FieldPath.documentId(), "<", day)
    .get()
  let recent: RecentDailyBests = {}
  for (const doc of snap.docs) {
    const score = parseDailyDay(doc.data()).score
    if (score !== null) recent = withRecentBest(recent, doc.id, score)
  }
  return recent
}

/**
 * Mốc của ngày `day`: phong độ từ điểm các ngày trước (lưu trên doc người chơi), kỷ lục = `dailyBest`.
 * `migrated` khác null = vừa đọc lịch sử của người chơi cũ → nên lưu lại vào `dailyRecent`.
 */
export async function computeDailyGoals(
  db: Firestore,
  uid: string,
  day: string,
  player: Pick<StoredPlayer, "dailyBest" | "dailyRecent">
): Promise<{ goals: DailyGoals; migrated: RecentDailyBests | null }> {
  const migrated = player.dailyRecent ? null : await legacyRecentBests(db, uid, day)
  const bests = recentBestsBefore(player.dailyRecent ?? migrated ?? {}, day)
  const best = Math.max(player.dailyBest, ...bests)
  return { goals: dailyGoalsFor(bests, best > 0 ? best : null), migrated }
}
