import "server-only"

import { FieldValue } from "firebase-admin/firestore"

import { LEADERBOARD_PERIODS } from "@/modules/leaderboard/leaderboard-types"
import { getAdminFirestore } from "@/server/firebase/firebase-admin-app"
import { LEADERBOARD_ENTRIES_SUBCOLLECTION } from "@/server/profile/stored-player-document"

import { boardIdForPeriod } from "./leaderboard-board-ids"
import { leaderboardRef, parseLeaderboardTop } from "./leaderboard-documents"

/**
 * Đổi tên → cập nhật tên trên các bảng hiện hành (ngày/tuần/mọi lúc). Bảng cũ giữ tên lúc đó.
 * Chạy trong transaction để không ghi đè snapshot vừa được một lượt nộp ván khác cập nhật.
 */
export async function renamePlayerOnCurrentLeaderboards(uid: string, displayName: string): Promise<void> {
  const db = getAdminFirestore()
  const now = new Date()
  const boardRefs = LEADERBOARD_PERIODS.map((period) => leaderboardRef(db, boardIdForPeriod(period, now)))
  const entryRefs = boardRefs.map((ref) => ref.collection(LEADERBOARD_ENTRIES_SUBCOLLECTION).doc(uid))

  await db.runTransaction(async (tx) => {
    const snaps = await tx.getAll(...boardRefs, ...entryRefs)
    const boardSnaps = snaps.slice(0, boardRefs.length)
    const entrySnaps = snaps.slice(boardRefs.length)

    entrySnaps.forEach((snap, index) => {
      if (snap.exists) tx.update(entryRefs[index], { displayName })
    })
    boardSnaps.forEach((snap, index) => {
      const top = parseLeaderboardTop(snap.data())
      if (!top.some((row) => row.uid === uid)) return
      tx.update(boardRefs[index], {
        top: top.map((row) => (row.uid === uid ? { ...row, displayName } : row)),
        updatedAt: FieldValue.serverTimestamp(),
      })
    })
  })
}
