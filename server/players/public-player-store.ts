import "server-only"

import { guestTagFromUid } from "@/modules/player-profile/player-profile-types"
import type { PublicPlayerProfile } from "@/modules/player-profile/public-player-types"
import { totalLevelStars } from "@/modules/progression/achievement-catalog"
import { normalizeReferralCode } from "@/modules/progression/referral-rules"
import { getAdminFirestore } from "@/server/firebase/firebase-admin-app"
import { parseStoredPlayer, playerFormView, REFERRAL_CODES_COLLECTION, USERS_COLLECTION } from "@/server/profile/stored-player-document"

/** Hồ sơ công khai theo tag (= mã mời, vốn để chia sẻ). Tag sai / không có → null. 2 lượt đọc. */
export async function getPublicPlayerProfile(rawTag: string): Promise<PublicPlayerProfile | null> {
  const tag = normalizeReferralCode(rawTag)
  if (!tag) return null
  const db = getAdminFirestore()
  const uid = (await db.collection(REFERRAL_CODES_COLLECTION).doc(tag).get()).get("uid")
  if (typeof uid !== "string") return null
  const snap = await db.collection(USERS_COLLECTION).doc(uid).get()
  if (!snap.exists) return null
  const stored = parseStoredPlayer(snap.data())
  const { form, tier, highestTier } = playerFormView(stored)
  const { stats } = stored
  return {
    tag,
    displayName: stored.displayName,
    guestTag: guestTagFromUid(uid),
    form,
    tier,
    highestTier,
    stats: {
      gamesPlayed: stats.gamesPlayed,
      bestScore: stats.bestScore,
      bestCombo: stats.bestCombo,
      boardClears: stats.boardClears,
      totalLinesCleared: stats.totalLinesCleared,
      bestPureScore: stats.bestPureScore,
    },
    statsByMode: stored.statsByMode,
    levelStarsTotal: totalLevelStars(stored.levelStars),
    duelStats: stored.duelStats,
    bestStreak: stored.streak.best,
    achievements: stored.achievements,
    bestReplayId: stored.bestReplayId,
  }
}
