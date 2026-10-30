import "server-only"

import { FieldValue } from "firebase-admin/firestore"

import type { LeaderboardRow } from "@/modules/leaderboard/leaderboard-types"
import { getAdminFirestore } from "@/server/firebase/firebase-admin-app"
import { LEADERBOARD_ENTRIES_SUBCOLLECTION } from "@/server/profile/stored-player-document"

import { boardIdFor } from "./leaderboard-categories"
import { leaderboardRef, parseLeaderboardTop } from "./leaderboard-documents"
import { LEADERBOARD_TOP_SIZE } from "./merge-score-into-top-list"

/**
 * Bảng "ghi đè" (phong độ) có thể bỏ người khỏi top khi giá trị giảm mà không biết ai đứng sau → snapshot
 * tạm ít hơn 100 dòng. Cron dựng lại snapshot từ entries (1 truy vấn 100 doc / bảng).
 */
export async function rebuildReplacedLeaderboards(now = new Date()): Promise<{ boards: string[]; rows: number }> {
  const db = getAdminFirestore()
  const boardIds = [boardIdFor("form", "alltime", now), boardIdFor("form", "season", now)]
  let rows = 0
  for (const boardId of boardIds) {
    const ref = leaderboardRef(db, boardId)
    const query = ref.collection(LEADERBOARD_ENTRIES_SUBCOLLECTION).orderBy("score", "desc").limit(LEADERBOARD_TOP_SIZE)
    // Đọc entries trong transaction → lượt nộp ván ghi entry cùng lúc làm transaction này chạy lại, không mất dòng.
    rows += await db.runTransaction(async (tx) => {
      const snap = await tx.get(query)
      const top: LeaderboardRow[] = parseLeaderboardTop({ top: snap.docs.map((doc) => doc.data()) })
      tx.set(ref, { top, updatedAt: FieldValue.serverTimestamp() })
      return top.length
    })
  }
  return { boards: boardIds, rows }
}
