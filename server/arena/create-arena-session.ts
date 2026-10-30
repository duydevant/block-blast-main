import "server-only"

import { randomInt } from "node:crypto"

import type { DocumentReference } from "firebase-admin/firestore"

import { type ArenaRunProgress, nextArenaRun } from "@/modules/game-modes/arena-goal-rules"
import type { StartRankedGameResponse } from "@/modules/player-profile/player-profile-types"
import { getAdminFirestore } from "@/server/firebase/firebase-admin-app"
import { HttpError } from "@/server/http/authenticated-json-route"
import { GAME_SESSIONS_COLLECTION, parseStoredPlayer, USERS_COLLECTION } from "@/server/profile/stored-player-document"

import { arenaRunRef, effectiveStatus, parseArenaRun, progressOf, type StoredArenaRun } from "./arena-run-documents"

type SessionFields = (seed: number, extra: Record<string, unknown>) => Record<string, unknown>

/** Lần thử không giới hạn giờ còn mở quá lâu (thoát app, không nộp) → coi như bỏ. */
const UNTIMED_ATTEMPT_STALE_MS = 60 * 60 * 1000
/** Thêm sau đồng hồ (Tốc độ) trước khi coi lần thử đang mở là đã bỏ — chờ ván vừa hết giờ kịp nộp. */
const TIMED_ATTEMPT_STALE_GRACE_MS = 3 * 60 * 1000

function isStaleAttempt(run: StoredArenaRun, createdAtMs: number | null, nowMs: number): boolean {
  if (createdAtMs === null) return true
  const limit = run.definition.attemptTimeMs === null ? UNTIMED_ATTEMPT_STALE_MS : run.definition.attemptTimeMs + TIMED_ATTEMPT_STALE_GRACE_MS
  return nowMs - createdAtMs > limit
}

type SessionResult = { kind: "started"; response: StartRankedGameResponse } | { kind: "pending" } | { kind: "closed"; status: string }

/**
 * Một lần thử của lượt Đấu trường: chỉ chủ lượt, lượt còn mở + còn lần thử. Seed ngẫu nhiên; biến thể theo catalog.
 * Lần thử trước vẫn đánh dấu mở:
 * - session còn `open` và chưa quá hạn → 409 `attempt-pending` (ván vừa chơi còn đang nộp; client đợi rồi thử lại);
 * - session còn `open` nhưng quá hạn, hoặc đã đóng mà chưa được chấm (log hỏng…) → tính là thử trượt.
 */
export async function createArenaSession(uid: string, sessionRef: DocumentReference, fields: SessionFields, runId: string | undefined): Promise<StartRankedGameResponse> {
  if (!runId) throw new HttpError(400, "missing-arena-run")
  const db = getAdminFirestore()
  const runRef = arenaRunRef(db, runId)
  const userRef = db.collection(USERS_COLLECTION).doc(uid)
  const nowMs = Date.now()

  const result = await db.runTransaction<SessionResult>(async (tx) => {
    const [runSnap, userSnap] = await tx.getAll(runRef, userRef)
    const run = parseArenaRun(runSnap.data())
    if (!run || run.uid !== uid) throw new HttpError(404, "arena-run-not-found")
    const previousRef = run.openGameId ? db.collection(GAME_SESSIONS_COLLECTION).doc(run.openGameId) : null
    const previousSnap = previousRef ? await tx.get(previousRef) : null

    let progress: ArenaRunProgress = progressOf(run)
    if (previousRef && previousSnap) {
      const previousOpen = previousSnap.get("status") === "open"
      const createdAtMs = previousSnap.get("createdAt")?.toMillis?.() ?? null
      if (previousOpen && !isStaleAttempt(run, createdAtMs, nowMs)) return { kind: "pending" }
      if (previousOpen) tx.update(previousRef, { status: "abandoned", abandonReason: "arena-replaced" })
      progress = nextArenaRun(run.definition, progress, false, false)
    }
    const status = progress.status === "open" && effectiveStatus(run, nowMs) === "expired" ? "expired" : progress.status
    if (status !== "open") {
      tx.update(runRef, { ...progress, status, openGameId: null })
      if (parseStoredPlayer(userSnap.data()).arenaRunOpen === runId) tx.set(userRef, { arenaRunOpen: null }, { merge: true })
      // Ghi trạng thái đóng lượt rồi báo lỗi bằng kết quả (throw sẽ huỷ cả transaction).
      return { kind: "closed", status }
    }

    const seed = randomInt(0, 0x1_0000_0000)
    const endsAt = run.definition.attemptTimeMs === null ? null : nowMs + run.definition.attemptTimeMs
    tx.set(sessionRef, fields(seed, { arenaRunId: runId, arenaType: run.type, arenaLevel: run.level }))
    tx.update(runRef, { ...progress, openGameId: sessionRef.id })
    return {
      kind: "started",
      response: {
        gameId: sessionRef.id,
        seed,
        stashUnlocked: false,
        mode: "arena",
        day: null,
        challenge: null,
        arena: { runId, type: run.type, level: run.level, attempt: progress.attemptsUsed + 1, endsAt, serverNow: nowMs },
      },
    }
  })

  if (result.kind === "pending") throw new HttpError(409, "attempt-pending")
  if (result.kind === "closed") throw new HttpError(409, `arena-run-${result.status}`)
  return result.response
}
