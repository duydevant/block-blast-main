import "server-only"

import { FieldValue, type Firestore } from "firebase-admin/firestore"
import { z } from "zod"

import { dayKeyFor } from "@/server/daily/daily-challenge-calendar"
import { getAdminFirestore } from "@/server/firebase/firebase-admin-app"
import { HttpError } from "@/server/http/authenticated-json-route"
import { gameIdSchema } from "@/server/games/ranked-game-request-schemas"
import { MISSIONS_SUBCOLLECTION, parseStoredPlayer, USERS_COLLECTION } from "@/server/profile/stored-player-document"
import { GAME_REPLAYS_COLLECTION } from "@/server/replays/replay-documents"

/**
 * reports/{id}: báo cáo một replay nghi gian lận. Admin xử lý trong Firestore console: đổi `status` thành
 * `dismissed` / `confirmed` (+ đặt `users/{uid}.banned = true` khi xác nhận). Báo cáo `open` giữ thưởng hạng tuần.
 */
export const REPORTS_COLLECTION = "reports"
/** Mỗi người chơi gửi tối đa bấy nhiêu báo cáo / ngày (đếm trong doc nhiệm vụ của ngày). */
export const MAX_REPORTS_PER_DAY = 5
/** Người báo cáo phải có ít nhất bấy nhiêu ván đã xác minh (chặn tài khoản khách tạo hàng loạt để phá). */
export const MIN_GAMES_TO_REPORT = 20
/** Báo cáo chưa xử lý chỉ giữ thưởng hạng trong khoảng này (tuần thưởng + 1 ngày); cũ hơn thì không chặn nữa. */
export const REPORT_HOLD_MS = 8 * 24 * 60 * 60 * 1000

export const reportRequestSchema = z.object({
  replayId: gameIdSchema,
  reason: z.enum(["bot", "other"]),
})

export async function reportReplay(uid: string, request: z.infer<typeof reportRequestSchema>): Promise<{ ok: true }> {
  const db = getAdminFirestore()
  const replayRef = db.collection(GAME_REPLAYS_COLLECTION).doc(request.replayId)
  const reporterRef = db.collection(USERS_COLLECTION).doc(uid)
  const quotaRef = reporterRef.collection(MISSIONS_SUBCOLLECTION).doc(dayKeyFor(new Date()))

  await db.runTransaction(async (tx) => {
    const [replaySnap, quotaSnap, reporterSnap] = await tx.getAll(replayRef, quotaRef, reporterRef)
    const targetUid = replaySnap.get("uid")
    if (typeof targetUid !== "string") throw new HttpError(404, "replay-not-found")
    if (targetUid === uid) throw new HttpError(400, "cannot-report-self")
    if (parseStoredPlayer(reporterSnap.data()).stats.gamesPlayed < MIN_GAMES_TO_REPORT) throw new HttpError(403, "report-needs-games")
    const sent = quotaSnap.get("reports")
    if (typeof sent === "number" && sent >= MAX_REPORTS_PER_DAY) throw new HttpError(429, "report-limit")

    const stamp = FieldValue.serverTimestamp()
    tx.set(db.collection(REPORTS_COLLECTION).doc(), {
      reporterUid: uid,
      targetUid,
      replayId: request.replayId,
      score: replaySnap.get("score") ?? null,
      reason: request.reason,
      status: "open",
      createdAt: stamp,
      // Số ms (không phải Timestamp) để truy vấn khoảng thời gian gọn trong hasOpenReports.
      createdAtMs: Date.now(),
    })
    tx.set(quotaRef, { reports: FieldValue.increment(1), updatedAt: stamp }, { merge: true })
  })
  return { ok: true }
}

/** Người chơi có báo cáo chưa xử lý gửi trong REPORT_HOLD_MS gần nhất (giữ thưởng hạng tới khi admin xem replay). */
export async function hasOpenReports(db: Firestore, targetUid: string, now = Date.now()): Promise<boolean> {
  const snap = await db
    .collection(REPORTS_COLLECTION)
    .where("targetUid", "==", targetUid)
    .where("status", "==", "open")
    .where("createdAtMs", ">=", now - REPORT_HOLD_MS)
    .limit(1)
    .get()
  return !snap.empty
}
