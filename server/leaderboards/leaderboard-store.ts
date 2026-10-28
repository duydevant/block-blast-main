import "server-only"

import type { LeaderboardPeriod, LeaderboardResponse, MyLeaderboardStanding } from "@/modules/leaderboard/leaderboard-types"
import { getAdminFirestore } from "@/server/firebase/firebase-admin-app"
import { LEADERBOARD_ENTRIES_SUBCOLLECTION } from "@/server/profile/stored-player-document"

import { boardIdForPeriod } from "./leaderboard-board-ids"
import { leaderboardRef, parseLeaderboardTop } from "./leaderboard-documents"
import { standingFromTop } from "./merge-score-into-top-list"

/**
 * Bảng hiện hành của kỳ: 1 lượt đọc snapshot + 1 lượt đọc entry của mình;
 * ngoài top 100 thì thêm 1 truy vấn count() và 1 truy vấn lấy điểm người ngay trên.
 */
export async function getLeaderboard(period: LeaderboardPeriod, uid: string): Promise<LeaderboardResponse> {
  const boardId = boardIdForPeriod(period, new Date())
  const boardRef = leaderboardRef(getAdminFirestore(), boardId)
  const entries = boardRef.collection(LEADERBOARD_ENTRIES_SUBCOLLECTION)
  const [boardSnap, mySnap] = await Promise.all([boardRef.get(), entries.doc(uid).get()])
  const top = parseLeaderboardTop(boardSnap.data())

  const myScore = mySnap.get("score")
  let me: MyLeaderboardStanding | null = null
  if (typeof myScore === "number") {
    if (top.some((row) => row.uid === uid)) {
      me = standingFromTop(top, myScore)
    } else {
      const higher = entries.where("score", ">", myScore)
      const [countSnap, nextSnap] = await Promise.all([higher.count().get(), higher.orderBy("score", "asc").limit(1).get()])
      me = { score: myScore, rank: countSnap.data().count + 1, nextScore: nextSnap.empty ? null : nextSnap.docs[0].get("score") }
    }
  }

  return { period, boardId, top, me }
}
