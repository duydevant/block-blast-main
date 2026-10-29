import "server-only"

import type { DocumentSnapshot, FieldValue, Firestore, Transaction } from "firebase-admin/firestore"

import type { LeaderboardRow } from "@/modules/leaderboard/leaderboard-types"
import { leaderboardRef, parseLeaderboardTop } from "@/server/leaderboards/leaderboard-documents"
import { mergeScoreIntoTopList } from "@/server/leaderboards/merge-score-into-top-list"
import { LEADERBOARD_ENTRIES_SUBCOLLECTION } from "@/server/profile/stored-player-document"

export interface ImprovedBoards {
  /** Bảng mà điểm này là kỷ lục mới của người chơi. */
  improved: string[]
  boardSnaps: DocumentSnapshot[]
}

/** Đọc (trong transaction) entry của người chơi ở các bảng → bảng nào điểm mới cao hơn + snapshot top của bảng đó. */
export async function readImprovedBoards(tx: Transaction, db: Firestore, boardIds: string[], uid: string, score: number): Promise<ImprovedBoards> {
  const entryRefs = boardIds.map((boardId) => leaderboardRef(db, boardId).collection(LEADERBOARD_ENTRIES_SUBCOLLECTION).doc(uid))
  const entrySnaps = entryRefs.length > 0 ? await tx.getAll(...entryRefs) : []
  const improved = boardIds.filter((_, index) => {
    const previous = entrySnaps[index].get("score")
    return typeof previous !== "number" || score > previous
  })
  const boardSnaps = improved.length > 0 ? await tx.getAll(...improved.map((boardId) => leaderboardRef(db, boardId))) : []
  return { improved, boardSnaps }
}

/** Ghi entry + cập nhật snapshot top của các bảng đã cải thiện (sau khi đã đọc xong mọi thứ trong transaction). */
export function writeLeaderboardEntries(tx: Transaction, db: Firestore, boards: ImprovedBoards, row: LeaderboardRow, stamp: FieldValue) {
  boards.improved.forEach((boardId, index) => {
    const ref = leaderboardRef(db, boardId)
    tx.set(ref.collection(LEADERBOARD_ENTRIES_SUBCOLLECTION).doc(row.uid), { ...row, updatedAt: stamp })
    const top = mergeScoreIntoTopList(parseLeaderboardTop(boards.boardSnaps[index].data()), row)
    if (top) tx.set(ref, { top, updatedAt: stamp })
  })
}
