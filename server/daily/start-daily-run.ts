import "server-only"

import { type DocumentReference, FieldValue } from "firebase-admin/firestore"

import type { StartRankedGameResponse } from "@/modules/player-profile/player-profile-types"
import { DAILY_RUNS_PER_DAY } from "@/modules/progression/daily-challenge-goals"
import { getAdminFirestore } from "@/server/firebase/firebase-admin-app"
import { parseStoredPlayer, USERS_COLLECTION } from "@/server/profile/stored-player-document"

import { dailySeedFor, dayKeyFor } from "./daily-challenge-calendar"
import { computeDailyGoals, dailyDayRef, parseDailyDay } from "./daily-challenge-documents"

function dailySeedSecret(): string {
  const secret = process.env.DAILY_SEED_SECRET
  if (!secret) throw new Error("Missing DAILY_SEED_SECRET environment variable (see docs/firebase-setup-guide.md)")
  return secret
}

/**
 * Bắt đầu lượt thử thách hôm nay: seed chung của ngày, ô cất khoá. Mỗi ngày DAILY_RUNS_PER_DAY lượt tính điểm,
 * giữ chỗ ngay lúc bắt đầu (mở nhiều lượt rồi chỉ nộp lượt đẹp không lách được giới hạn). Lượt đầu chốt mốc
 * của ngày. Hết lượt → trả seed để luyện tập, không tạo session (gameId null).
 */
export async function startDailyRun(
  uid: string,
  sessionRef: DocumentReference,
  session: (seed: number, day: string) => Record<string, unknown>
): Promise<StartRankedGameResponse> {
  const db = getAdminFirestore()
  const day = dayKeyFor(new Date())
  const seed = dailySeedFor(day, dailySeedSecret())
  const dayRef = dailyDayRef(db, uid, day)

  // Mốc chỉ cần ở lượt đầu: đọc lịch sử trước transaction (truy vấn không chạy trong transaction được).
  const before = parseDailyDay((await dayRef.get()).data())
  const userRef = db.collection(USERS_COLLECTION).doc(uid)
  const computed =
    before.goals === null && before.runs.length < DAILY_RUNS_PER_DAY ? await computeDailyGoals(db, uid, day, parseStoredPlayer((await userRef.get()).data())) : null

  const run = await db.runTransaction(async (tx) => {
    const current = parseDailyDay((await tx.get(dayRef)).data())
    if (current.runs.length >= DAILY_RUNS_PER_DAY) return null
    // Lịch sử người chơi cũ chỉ ghi khi chưa có map (VD lượt nộp trễ vừa ghi map mới hơn) → không đè.
    const migrate = computed?.migrated && !parseStoredPlayer((await tx.get(userRef)).data()).dailyRecent ? computed.migrated : null
    tx.set(
      dayRef,
      {
        runs: [...current.runs, sessionRef.id],
        status: current.status ?? "started",
        goals: current.goals ?? computed?.goals ?? null,
        ...(current.exists ? {} : { startedAt: FieldValue.serverTimestamp() }),
      },
      { merge: true }
    )
    tx.set(sessionRef, { ...session(seed, day), dailyRun: current.runs.length })
    // Người chơi cũ: lưu lịch sử vừa đọc để các ngày sau chỉ đọc doc người chơi.
    if (migrate) tx.set(userRef, { dailyRecent: migrate }, { mergeFields: ["dailyRecent"] })
    return current.runs.length
  })
  return { gameId: run === null ? null : sessionRef.id, seed, stashUnlocked: false, mode: "daily", day, challenge: null }
}
