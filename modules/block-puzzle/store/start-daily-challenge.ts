import { useFirebaseAuthStore } from "@/lib/auth/firebase-auth-store"
import { fetchJsonWithFirebaseIdToken } from "@/lib/firebase/fetch-json-with-firebase-id-token"
import { ApiRoutes } from "@/lib/routes"
import { CURRENT_RULES_VERSION } from "@/modules/block-puzzle/engine/game-types"
import type { StartRankedGameResponse } from "@/modules/player-profile/player-profile-types"

import { useBlockPuzzleGameStore } from "./block-puzzle-game-store"

export type DailyChallengeStart = "ranked" | "practice"

/**
 * Xin seed thử thách hôm nay rồi vào ván. Cần mạng + đã đăng nhập (seed daily chỉ server biết).
 * Mỗi ngày 3 lượt tính điểm; hết lượt thì là luyện tập (cùng seed, không nộp).
 */
export async function startDailyChallenge(): Promise<DailyChallengeStart> {
  const auth = useFirebaseAuthStore.getState()
  const uid = auth.status === "ready" ? auth.player?.uid : undefined
  if (!uid) throw new Error("not-signed-in")

  const issued = await fetchJsonWithFirebaseIdToken<StartRankedGameResponse>(ApiRoutes.GAMES_START, {
    method: "POST",
    body: { mode: "daily", rulesVersion: CURRENT_RULES_VERSION },
    expectedUid: uid,
  })
  if (issued.mode !== "daily" || !issued.day) throw new Error("unexpected-daily-start")

  useBlockPuzzleGameStore.getState().startDailyGame({ gameId: issued.gameId, uid, seed: issued.seed, day: issued.day, rulesVersion: issued.rulesVersion })
  return issued.gameId ? "ranked" : "practice"
}
