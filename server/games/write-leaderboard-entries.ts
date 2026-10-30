import "server-only"

import type { FieldValue, Firestore, Transaction } from "firebase-admin/firestore"

import type { LeaderboardRow } from "@/modules/leaderboard/leaderboard-types"
import type { BoardWrite } from "@/server/leaderboards/leaderboard-categories"
import { leaderboardRef, parseLeaderboardTop } from "@/server/leaderboards/leaderboard-documents"
import { mergeScoreIntoTopList, replaceScoreInTopList } from "@/server/leaderboards/merge-score-into-top-list"
import { LEADERBOARD_ENTRIES_SUBCOLLECTION } from "@/server/profile/stored-player-document"

/** Bảng sẽ được ghi (giá trị khác entry hiện có theo đúng policy) + snapshot top đọc trong transaction. */
export interface PendingBoardUpdate extends BoardWrite {
  top: LeaderboardRow[]
}

/** Thông tin hàng chung cho mọi bảng của ván; `score` của từng bảng là `value` của bảng đó. */
export type BoardRowBase = Omit<LeaderboardRow, "score">

/** Đọc entry của người chơi ở các bảng → bảng nào cần ghi + snapshot top của bảng đó. */
export async function readBoardUpdates(tx: Transaction, db: Firestore, writes: BoardWrite[], uid: string): Promise<PendingBoardUpdate[]> {
  if (writes.length === 0) return []
  const entrySnaps = await tx.getAll(...writes.map((write) => leaderboardRef(db, write.boardId).collection(LEADERBOARD_ENTRIES_SUBCOLLECTION).doc(uid)))
  const changed = writes.filter((write, index) => {
    const previous = entrySnaps[index].get("score")
    if (typeof previous !== "number") return true
    return write.policy === "max" ? write.value > previous : write.value !== previous
  })
  if (changed.length === 0) return []
  const boardSnaps = await tx.getAll(...changed.map((write) => leaderboardRef(db, write.boardId)))
  return changed.map((write, index) => ({ ...write, top: parseLeaderboardTop(boardSnaps[index].data()) }))
}

function nextTop(update: PendingBoardUpdate, row: LeaderboardRow): LeaderboardRow[] | null {
  return update.policy === "max" ? mergeScoreIntoTopList(update.top, row) : replaceScoreInTopList(update.top, row)
}

/**
 * Bảng "max" mà top 100 sẽ đổi nếu ghi (để quyết định lưu replay trước khi ghi). Bảng "replace" (phong độ) bỏ qua:
 * giá trị là trung vị nhiều ván, không phải điểm của ván này.
 */
export function topChangedBoards(updates: readonly PendingBoardUpdate[], base: BoardRowBase): string[] {
  return updates
    .filter((update) => update.policy === "max" && nextTop(update, { ...base, score: update.value }) !== null)
    .map((update) => update.boardId)
}

/**
 * Ghi entry + snapshot top của các bảng (sau khi đã đọc xong mọi thứ trong transaction).
 * `replayId` chỉ gắn vào bảng "max" (giá trị đến từ đúng ván này).
 */
export function writeBoardUpdates(
  tx: Transaction,
  db: Firestore,
  updates: readonly PendingBoardUpdate[],
  base: BoardRowBase,
  stamp: FieldValue,
  replayId: string | null = null
) {
  for (const update of updates) {
    const ref = leaderboardRef(db, update.boardId)
    const row: LeaderboardRow = { ...base, score: update.value, ...(replayId && update.policy === "max" ? { replayId } : {}) }
    tx.set(ref.collection(LEADERBOARD_ENTRIES_SUBCOLLECTION).doc(row.uid), { ...row, updatedAt: stamp })
    const top = nextTop(update, row)
    if (top) tx.set(ref, { top, updatedAt: stamp })
  }
}
