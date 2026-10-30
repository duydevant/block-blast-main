import { useFirebaseAuthStore } from "@/lib/auth/firebase-auth-store"
import { fetchJsonWithFirebaseIdToken } from "@/lib/firebase/fetch-json-with-firebase-id-token"
import { ApiRoutes } from "@/lib/routes"
import { useBlockPuzzleGameStore } from "@/modules/block-puzzle/store/block-puzzle-game-store"
import type { StartRankedGameResponse } from "@/modules/player-profile/player-profile-types"

import { findLevel } from "./level-catalog"

function signedInUid(): string | null {
  const auth = useFirebaseAuthStore.getState()
  return auth.status === "ready" ? (auth.player?.uid ?? null) : null
}

async function requestStart(uid: string, body: Record<string, unknown>): Promise<StartRankedGameResponse> {
  return fetchJsonWithFirebaseIdToken<StartRankedGameResponse>(ApiRoutes.GAMES_START, { method: "POST", body, expectedUid: uid })
}

/**
 * Màn chơi: có mạng thì xin session để server xác nhận sao/thưởng xu; không có thì vẫn chơi offline
 * (seed + bàn của màn có sẵn trong catalog, chỉ lưu sao trên máy).
 */
export async function startLevelGame(levelId: number): Promise<"ranked" | "offline"> {
  const definition = findLevel(levelId)
  if (!definition) throw new Error("unknown-level")
  const run = { kind: "level" as const, levelId }
  const uid = signedInUid()
  if (uid) {
    try {
      const issued = await requestStart(uid, { mode: "level", levelId })
      if (issued.mode === "level" && issued.gameId && issued.seed === definition.seed) {
        useBlockPuzzleGameStore.getState().startVariantGame({ gameId: issued.gameId, uid, seed: issued.seed, run })
        return "ranked"
      }
    } catch (error) {
      console.warn("[levels] online start failed, playing offline", error)
    }
  }
  useBlockPuzzleGameStore.getState().startVariantGame({ gameId: null, uid: null, seed: definition.seed, run })
  return "offline"
}

/** Chế độ "Không bế tắc": có mạng thì ván tính điểm (BXH riêng), không thì chơi offline với seed ngẫu nhiên. */
export async function startLogicGame(): Promise<void> {
  const run = { kind: "logic" as const }
  const uid = signedInUid()
  if (uid) {
    try {
      const issued = await requestStart(uid, { mode: "logic" })
      if (issued.mode === "logic" && issued.gameId) {
        useBlockPuzzleGameStore.getState().startVariantGame({ gameId: issued.gameId, uid, seed: issued.seed, run })
        return
      }
    } catch (error) {
      console.warn("[logic] online start failed, playing offline", error)
    }
  }
  useBlockPuzzleGameStore.getState().startVariantGame({ gameId: null, uid: null, seed: Math.floor(Math.random() * 0x1_0000_0000), run })
}

/** Ván đấu 1v1: chỉ khi trận đang diễn ra (server kiểm thành viên + giờ). */
export async function startDuelGame(duelId: string): Promise<void> {
  const uid = signedInUid()
  if (!uid) throw new Error("not-signed-in")
  const issued = await requestStart(uid, { mode: "duel", duelId })
  if (issued.mode !== "duel" || !issued.gameId || !issued.duel) throw new Error("unexpected-duel-start")
  const { opponent, round, startAt, endsAt, serverNow } = issued.duel
  useBlockPuzzleGameStore.getState().startVariantGame({
    gameId: issued.gameId,
    uid,
    seed: issued.seed,
    run: { kind: "duel", duelId, round, seed: issued.seed, opponent, startAt, endsAt, clockOffset: serverNow - Date.now() },
  })
}
