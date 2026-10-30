import "server-only"

import { FieldValue } from "firebase-admin/firestore"

import { getAdminFirestore } from "@/server/firebase/firebase-admin-app"
import { LEADERBOARD_ENTRIES_SUBCOLLECTION } from "@/server/profile/stored-player-document"

import { currentBoardIds } from "./leaderboard-categories"
import { leaderboardRef, parseLeaderboardTop } from "./leaderboard-documents"

/**
 * Đổi tên → cập nhật tên trên các bảng hiện hành (mọi hạng mục, ngày/tuần/mọi lúc). Bảng cũ giữ tên lúc đó.
 * Chạy trong transaction để không ghi đè snapshot vừa được một lượt nộp ván khác cập nhật.
 */
export async function renamePlayerOnCurrentLeaderboards(uid: string, displayName: string): Promise<void> {
  const db = getAdminFirestore()
  const now = new Date()
  const boardRefs = currentBoardIds(now).map((boardId) => leaderboardRef(db, boardId))
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
