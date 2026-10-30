/**
 * Điền sẵn bảng Phong độ (`form-alltime`) + Sao màn (`stars-alltime`) từ dữ liệu cũ. Chạy một lần sau khi deploy Phase 02.
 *
 *   npx vite-node --config vitest.config.ts scripts/backfill-form-and-stars-leaderboards.ts            # chạy thử, không ghi
 *   npx vite-node --config vitest.config.ts scripts/backfill-form-and-stars-leaderboards.ts --write    # ghi thật
 *   ... --env=.env.production                                                                           # chọn file env (mặc định .env.local)
 *
 * Phong độ lấy từ `gameSessions` đã nộp (TTL 30 ngày → tối đa ~30 ngày gần nhất). Mỗi người chơi chỉ được gộp điểm cũ
 * MỘT lần (`formBackfilledAt`) → chạy lại không cộng trùng. Ghi người chơi trong transaction để không mất ván vừa nộp.
 */
import { cert, initializeApp } from "firebase-admin/app"
import { FieldValue, type Firestore, getFirestore } from "firebase-admin/firestore"

import { boardIdFor } from "../server/leaderboards/leaderboard-categories"
import { leaderboardRef, parseLeaderboardTop } from "../server/leaderboards/leaderboard-documents"
import { type BackfillSession, planFormAndStarsBackfill } from "../server/leaderboards/form-and-stars-backfill-plan"
import { LEADERBOARD_TOP_SIZE } from "../server/leaderboards/merge-score-into-top-list"
import {
  GAME_SESSIONS_COLLECTION,
  GAMES_HISTORY_SUBCOLLECTION,
  LEADERBOARD_ENTRIES_SUBCOLLECTION,
  parseStoredPlayer,
  USERS_COLLECTION,
} from "../server/profile/stored-player-document"
import { FORM_WINDOW, formFromRecent, tierForForm } from "../modules/progression/player-form-rules"

const args = process.argv.slice(2)
const write = args.includes("--write")
const envFile = args.find((arg) => arg.startsWith("--env="))?.slice("--env=".length) ?? ".env.local"
process.loadEnvFile(envFile)

function adminFirestore(): Firestore {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n")
  if (!projectId || !clientEmail || !privateKey) throw new Error(`Thiếu FIREBASE_ADMIN_* trong ${envFile}`)
  return getFirestore(initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId }, "backfill"))
}

const millis = (value: unknown) => (value && typeof value === "object" && "toMillis" in value ? (value as { toMillis(): number }).toMillis() : 0)

/** Dựng lại snapshot top 100 từ entries (transaction: lượt nộp ván cùng lúc làm chạy lại, không mất dòng). */
async function rebuildTop(db: Firestore, boardId: string): Promise<number> {
  const ref = leaderboardRef(db, boardId)
  const query = ref.collection(LEADERBOARD_ENTRIES_SUBCOLLECTION).orderBy("score", "desc").limit(LEADERBOARD_TOP_SIZE)
  return db.runTransaction(async (tx) => {
    const top = parseLeaderboardTop({ top: (await tx.get(query)).docs.map((doc) => doc.data()) })
    tx.set(ref, { top, updatedAt: FieldValue.serverTimestamp() })
    return top.length
  })
}

async function main() {
  const db = adminFirestore()
  const now = new Date()
  const formBoard = boardIdFor("form", "alltime", now)
  const starsBoard = boardIdFor("stars", "alltime", now)
  console.log(`[backfill] project ${process.env.FIREBASE_ADMIN_PROJECT_ID} · ${write ? "GHI THẬT" : "chạy thử (thêm --write để ghi)"}`)

  const [userSnap, sessionSnap, historySnap] = await Promise.all([
    db.collection(USERS_COLLECTION).get(),
    db.collection(GAME_SESSIONS_COLLECTION).where("status", "==", "done").select("uid", "mode", "score", "moveCount", "finishedAt", "dailyRun", "suspect").get(),
    db.collectionGroup(GAMES_HISTORY_SUBCOLLECTION).select().get(),
  ])
  const alreadyBackfilled = new Set(userSnap.docs.filter((doc) => doc.get("formBackfilledAt")).map((doc) => doc.id))
  const players = userSnap.docs.map((doc) => ({ uid: doc.id, stored: parseStoredPlayer(doc.data()) }))
  const sessions: BackfillSession[] = sessionSnap.docs
    .map((doc) => ({
      gameId: doc.id,
      uid: String(doc.get("uid") ?? ""),
      mode: String(doc.get("mode") ?? "classic"),
      score: Number(doc.get("score") ?? 0),
      moveCount: Number(doc.get("moveCount") ?? 0),
      finishedAt: millis(doc.get("finishedAt")),
      dailyRun: Number(doc.get("dailyRun") ?? 0),
      suspect: doc.get("suspect") === true,
    }))
    // Người đã gộp ở lần chạy trước: không gộp lại điểm cũ (tránh cộng trùng).
    .filter((session) => !alreadyBackfilled.has(session.uid))
  const plan = planFormAndStarsBackfill({ players, sessions, historyGameIds: new Set(historySnap.docs.map((doc) => doc.id)) })

  console.log(`[backfill] ${players.length} người chơi · ${sessions.length} ván cũ đã nộp · ${historySnap.size} ván trong lịch sử mới`)
  console.log(`[backfill] gộp điểm phong độ cho ${plan.formScores.length} người · bảng Phong độ ${plan.formRows.length} dòng · bảng Sao ${plan.starsRows.length} dòng`)
  const preview = (rows: typeof plan.formRows) => [...rows].sort((a, b) => b.score - a.score).slice(0, 5).map((row) => `${row.displayName ?? row.uid.slice(-4)}=${row.score}`).join(", ")
  console.log(`[backfill] top Phong độ: ${preview(plan.formRows) || "–"}`)
  console.log(`[backfill] top Sao: ${preview(plan.starsRows) || "–"}`)
  if (!write) return

  // Phong độ: gộp điểm cũ trong transaction với giá trị mới nhất của doc (người chơi có thể vừa nộp ván).
  const oldScores = new Map(plan.formScores.map((item) => [item.uid, item.oldScores]))
  const formRowByUid = new Map(plan.formRows.map((row) => [row.uid, row]))
  for (const player of players) {
    if (player.stored.banned || (!oldScores.has(player.uid) && !formRowByUid.has(player.uid))) continue
    await db.runTransaction(async (tx) => {
      const userRef = db.collection(USERS_COLLECTION).doc(player.uid)
      const current = parseStoredPlayer((await tx.get(userRef)).data())
      // Điểm cũ đứng trước điểm hiện có trong doc (mới hơn, có thể vừa nộp sau lúc đọc).
      const recentFormScores = [...(oldScores.get(player.uid) ?? []), ...current.recentFormScores].slice(-FORM_WINDOW)
      const form = formFromRecent(recentFormScores)
      tx.set(userRef, { recentFormScores, formBackfilledAt: FieldValue.serverTimestamp() }, { merge: true })
      if (form === null) return
      const base = formRowByUid.get(player.uid)
      const tier = tierForForm(form)
      tx.set(leaderboardRef(db, formBoard).collection(LEADERBOARD_ENTRIES_SUBCOLLECTION).doc(player.uid), {
        uid: player.uid,
        displayName: current.displayName,
        score: form,
        ...(tier !== "unranked" ? { tier } : {}),
        ...(base?.tag ? { tag: base.tag } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      })
    })
  }

  // Sao: tổng sao lấy thẳng từ doc người chơi (ghi đè an toàn — cùng nguồn sự thật với lúc nộp ván).
  const writer = db.bulkWriter()
  for (const row of plan.starsRows) {
    void writer.set(leaderboardRef(db, starsBoard).collection(LEADERBOARD_ENTRIES_SUBCOLLECTION).doc(row.uid), { ...row, updatedAt: FieldValue.serverTimestamp() })
  }
  await writer.close()

  console.log(`[backfill] dựng lại top: ${formBoard} ${await rebuildTop(db, formBoard)} dòng · ${starsBoard} ${await rebuildTop(db, starsBoard)} dòng`)
}

main().catch((error: unknown) => {
  console.error("[backfill] lỗi", error)
  process.exitCode = 1
})
