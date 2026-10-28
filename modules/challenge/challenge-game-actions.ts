import { useFirebaseAuthStore } from "@/lib/auth/firebase-auth-store"
import { fetchJsonWithFirebaseIdToken } from "@/lib/firebase/fetch-json-with-firebase-id-token"
import { ApiRoutes, Routes } from "@/lib/routes"
import { siteConfig } from "@/lib/site"
import { useBlockPuzzleGameStore } from "@/modules/block-puzzle/store/block-puzzle-game-store"
import type { StartRankedGameResponse } from "@/modules/player-profile/player-profile-types"

import type { CreateChallengeResponse } from "./challenge-types"

function signedInUid(): string {
  const auth = useFirebaseAuthStore.getState()
  const uid = auth.status === "ready" ? auth.player?.uid : undefined
  if (!uid) throw new Error("not-signed-in")
  return uid
}

/** Link tuyệt đối để dán vào Zalo/Messenger. */
export function challengeUrl(challengeId: string): string {
  return new URL(`${Routes.CHALLENGE}/${challengeId}`, siteConfig.url).toString()
}

/**
 * Tạo thách đấu từ ván classic vừa chơi. Ván chưa nộp thì gửi kèm log để server nộp luôn
 * (bỏ quyền hồi sinh còn lại); ván đã vào hàng chờ thì gỡ khỏi hàng chờ vì server đã ghi.
 */
export async function createChallengeFromCurrentGame(): Promise<string> {
  const uid = signedInUid()
  const store = useBlockPuzzleGameStore.getState()
  const session = store.rankedSession
  if (!session || session.uid !== uid || store.dailyDay || store.challenge) throw new Error("not-challengeable")

  store.queueFinishedRankedGame()
  const result = await fetchJsonWithFirebaseIdToken<CreateChallengeResponse>(ApiRoutes.CHALLENGES, {
    method: "POST",
    body: { gameId: session.gameId, actions: store.actionLog },
    expectedUid: uid,
  })
  useBlockPuzzleGameStore.getState().removePendingSubmission(session.gameId)
  return result.challengeId
}

/** Nhận thách đấu: xin session với đúng seed của người thách rồi vào ván. */
export async function startChallengeGame(challengeId: string): Promise<void> {
  const uid = signedInUid()
  const issued = await fetchJsonWithFirebaseIdToken<StartRankedGameResponse>(ApiRoutes.GAMES_START, {
    method: "POST",
    body: { mode: "challenge", challengeId },
    expectedUid: uid,
  })
  if (issued.mode !== "challenge" || !issued.gameId || !issued.challenge) throw new Error("unexpected-challenge-start")
  useBlockPuzzleGameStore.getState().startChallengeGame({
    gameId: issued.gameId,
    uid,
    seed: issued.seed,
    stashUnlocked: issued.stashUnlocked,
    opponent: issued.challenge,
  })
}
