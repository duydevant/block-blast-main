import "server-only"

import { type DocumentReference, type DocumentSnapshot, FieldValue, type Firestore, type Transaction } from "firebase-admin/firestore"

import {
  CHALLENGE_CREATOR_DAILY_LIMIT,
  CHALLENGE_REWARD_COINS,
  type ChallengeRewardResult,
  creatorRewardCount,
  isChallengeRewardDue,
} from "@/modules/challenge/challenge-reward-rules"
import { parseStoredPlayer, type StoredPlayer, USERS_COLLECTION } from "@/server/profile/stored-player-document"

import { storedChallengeSchema } from "./challenge-documents"

export interface ChallengeRewardPlan {
  challengeRef: DocumentReference
  creatorRef: DocumentReference
  /** Người thách còn dưới giới hạn ngày → cũng nhận xu. */
  creatorEarns: boolean
  creatorCountToday: number
  recipientCountToday: number
}

/**
 * Phần ĐỌC (trong transaction): ván thách đấu này có làm cả hai nhận thưởng không. Đủ điều kiện → đọc thêm doc người
 * thách (giới hạn thưởng/ngày). Không đủ / thách đấu cũ → null.
 */
export async function planChallengeReward(
  tx: Transaction,
  db: Firestore,
  input: {
    uid: string
    challengeSnap: DocumentSnapshot | undefined
    userSnap: DocumentSnapshot
    stored: StoredPlayer
    score: number
    moveCount: number
    flagged: boolean
    nowMs: number
    today: string
  }
): Promise<ChallengeRewardPlan | null> {
  const challenge = storedChallengeSchema.safeParse(input.challengeSnap?.data())
  if (!input.challengeSnap?.exists || !challenge.success) return null
  const due = isChallengeRewardDue({
    recipientUid: input.uid,
    creatorUid: challenge.data.creatorUid,
    expiresAtMs: challenge.data.expiresAtMs,
    alreadyRewarded: challenge.data.rewardedUids[input.uid] === true,
    score: input.score,
    creatorScore: challenge.data.creatorScore,
    moveCount: input.moveCount,
    flagged: input.flagged,
    recipientGamesBefore: input.stored.stats.gamesPlayed,
    recipientCreatedAtMs: input.userSnap.get("createdAt")?.toMillis?.() ?? null,
    nowMs: input.nowMs,
  })
  // Người nhận cũng chịu giới hạn ngày (chung bộ đếm với vai người thách) → không cày bằng hàng loạt thách đấu.
  const recipientCountToday = creatorRewardCount(input.stored, input.today)
  if (!due || recipientCountToday >= CHALLENGE_CREATOR_DAILY_LIMIT) return null
  const creatorRef = db.collection(USERS_COLLECTION).doc(challenge.data.creatorUid)
  const creator = parseStoredPlayer((await tx.get(creatorRef)).data())
  const count = creatorRewardCount(creator, input.today)
  return { challengeRef: input.challengeSnap.ref, creatorRef, creatorEarns: count < CHALLENGE_CREATOR_DAILY_LIMIT && !creator.banned, creatorCountToday: count, recipientCountToday }
}

/**
 * Phần GHI: đánh dấu người nhận đã được thưởng, tăng bộ đếm ngày của người nhận, cộng xu người thách (nếu còn lượt).
 * Xu người nhận cộng chung ở doc người chơi.
 */
export function writeChallengeReward(
  tx: Transaction,
  plan: ChallengeRewardPlan,
  input: { uid: string; userRef: DocumentReference; today: string; stamp: FieldValue }
): ChallengeRewardResult {
  const { uid, today, stamp } = input
  tx.update(plan.challengeRef, { [`rewardedUids.${uid}`]: true })
  tx.set(input.userRef, { challengeRewardDay: today, challengeRewardCount: plan.recipientCountToday + 1 }, { merge: true })
  if (plan.creatorEarns) {
    tx.set(
      plan.creatorRef,
      { coins: FieldValue.increment(CHALLENGE_REWARD_COINS), challengeRewardDay: today, challengeRewardCount: plan.creatorCountToday + 1, updatedAt: stamp },
      { merge: true }
    )
  }
  return { coins: CHALLENGE_REWARD_COINS, creatorRewarded: plan.creatorEarns }
}
