import "server-only"

import { type DocumentReference, FieldValue, type Transaction } from "firebase-admin/firestore"

import type { ReplaySummary } from "@/modules/block-puzzle/engine/replay-recorded-game-actions"
import type { RankedGameMode } from "@/modules/player-profile/player-profile-types"
import type { DailyMissionProgress, MissionBand } from "@/modules/progression/daily-mission-catalog"
import type { InviterReward } from "@/server/progression/apply-progression-for-verified-game"
import { GAMES_HISTORY_SUBCOLLECTION, YEARS_SUBCOLLECTION } from "@/server/profile/stored-player-document"

import { historyDocFor, yearCounterUpdate } from "./game-history-documents"

/** Kết quả thách đấu cần ghi (thách đấu đã bị xoá → null: vẫn ghi thống kê, bỏ phần này). */
export interface ChallengeResultWrite {
  challengeRef: DocumentReference
  resultRef: DocumentReference
  /** Điểm tốt nhất trước đó của người nhận thách đấu (không có → undefined). */
  previousScore: unknown
  displayName: string | null
}

/**
 * Các doc phụ của một lượt nộp ván (ngoài doc người chơi, session, bảng, replay): lịch sử ván, bộ đếm năm,
 * kết quả thách đấu, tiến độ nhiệm vụ ngày, quà cho người mời. Gọi sau khi transaction đã đọc xong.
 */
export function writeSubmittedSideDocuments(
  tx: Transaction,
  input: {
    userRef: DocumentReference
    gameId: string
    mode: RankedGameMode
    summary: ReplaySummary
    levelId: number | null
    day: string | null
    today: string
    stamp: FieldValue
    nowMs: number
    firstGameToday: boolean
    missionsRef: DocumentReference
    missions: { progress: DailyMissionProgress; band: MissionBand; gamesToday: number; games1000: number }
    inviter: { ref: DocumentReference; reward: InviterReward } | null
    challenge: ChallengeResultWrite | null
  }
) {
  const { userRef, summary, stamp } = input
  tx.set(
    userRef.collection(GAMES_HISTORY_SUBCOLLECTION).doc(input.gameId),
    historyDocFor({ mode: input.mode, summary, levelId: input.levelId, day: input.day, finishedAt: stamp, nowMs: input.nowMs })
  )
  tx.set(userRef.collection(YEARS_SUBCOLLECTION).doc(input.today.slice(0, 4)), yearCounterUpdate(summary, input.mode, input.firstGameToday), { merge: true })

  const { challenge } = input
  if (challenge) {
    // Điểm tốt nhất của người nhận thách đấu + đếm số lượt chơi thách đấu.
    if (typeof challenge.previousScore !== "number" || summary.score > challenge.previousScore) {
      tx.set(challenge.resultRef, { displayName: challenge.displayName, score: summary.score, updatedAt: stamp })
    }
    tx.update(challenge.challengeRef, { attempts: FieldValue.increment(1) })
  }

  tx.set(input.missionsRef, { ...input.missions, updatedAt: stamp }, { merge: true })

  if (input.inviter) {
    const { coins, addTheme, achievements } = input.inviter.reward
    tx.set(
      input.inviter.ref,
      {
        referralCount: FieldValue.increment(1),
        coins: FieldValue.increment(coins),
        unlockedThemes: FieldValue.arrayUnion(addTheme),
        ...(achievements.length > 0 ? { achievements: FieldValue.arrayUnion(...achievements) } : {}),
      },
      { merge: true }
    )
  }
}
