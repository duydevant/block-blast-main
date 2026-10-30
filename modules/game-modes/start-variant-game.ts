import { useFirebaseAuthStore } from "@/lib/auth/firebase-auth-store"
import { ApiRequestError, fetchJsonWithFirebaseIdToken } from "@/lib/firebase/fetch-json-with-firebase-id-token"
import { ApiRoutes } from "@/lib/routes"
import { CURRENT_RULES_VERSION } from "@/modules/block-puzzle/engine/game-types"
import { useBlockPuzzleGameStore } from "@/modules/block-puzzle/store/block-puzzle-game-store"
import type { StartRankedGameResponse } from "@/modules/player-profile/player-profile-types"

import { findLevel } from "./level-catalog"

function signedInUid(): string | null {
  const auth = useFirebaseAuthStore.getState()
  return auth.status === "ready" ? (auth.player?.uid ?? null) : null
}

async function requestStart(uid: string, body: Record<string, unknown>): Promise<StartRankedGameResponse> {
  // Khai luật client chơi được; server chỉ cấp luật mới cho client khai (Màn / Đấu trường / Không bế tắc bỏ qua).
  return fetchJsonWithFirebaseIdToken<StartRankedGameResponse>(ApiRoutes.GAMES_START, {
    method: "POST",
    body: { ...body, rulesVersion: CURRENT_RULES_VERSION },
    expectedUid: uid,
  })
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

/** Lần thử trước còn đang nộp (409 `attempt-pending`): đợi sync nộp xong rồi xin lại, tối đa chừng này lần. */
const ARENA_PENDING_RETRIES = 8
const ARENA_PENDING_DELAY_MS = 1500

const isAttemptPending = (error: unknown) => error instanceof ApiRequestError && error.code === "attempt-pending"

/**
 * Một lần thử của lượt Đấu trường đã mở (server kiểm lượt còn mở + còn lần thử). Ván vừa chơi chưa nộp xong thì server
 * từ chối để không chấm nhầm thành "bỏ dở" → đợi rồi thử lại.
 */
export async function startArenaAttempt(runId: string): Promise<void> {
  const uid = signedInUid()
  if (!uid) throw new Error("not-signed-in")
  // Ván Đấu trường vừa hết (còn quyền hồi sinh nên chưa vào hàng chờ) → nộp ngay để server chấm trước lần thử mới.
  const current = useBlockPuzzleGameStore.getState()
  if (current.variantRun?.kind === "arena" && current.game?.isGameOver) current.queueFinishedRankedGame()
  let issued: StartRankedGameResponse | null = null
  for (let attempt = 0; issued === null; attempt++) {
    try {
      issued = await requestStart(uid, { mode: "arena", arenaRunId: runId })
    } catch (error) {
      if (!isAttemptPending(error) || attempt >= ARENA_PENDING_RETRIES) throw error
      await new Promise((resolve) => setTimeout(resolve, ARENA_PENDING_DELAY_MS))
    }
  }
  if (issued.mode !== "arena" || !issued.gameId || !issued.arena) throw new Error("unexpected-arena-start")
  const { type, level, attempt, endsAt, serverNow } = issued.arena
  useBlockPuzzleGameStore.getState().startVariantGame({
    gameId: issued.gameId,
    uid,
    seed: issued.seed,
    run: { kind: "arena", runId, type, level, attempt, endsAt, clockOffset: serverNow - Date.now() },
  })
}

/** Trận xếp hạng với bóng ma; trận trước còn đang nộp (409 `match-pending`) → nộp ngay rồi đợi xin lại. */
export async function startRankedMatch(): Promise<void> {
  const uid = signedInUid()
  if (!uid) throw new Error("not-signed-in")
  const current = useBlockPuzzleGameStore.getState()
  if (current.variantRun?.kind === "ranked" && current.game?.isGameOver) current.queueFinishedRankedGame()
  let issued: StartRankedGameResponse | null = null
  for (let attempt = 0; issued === null; attempt++) {
    try {
      issued = await fetchJsonWithFirebaseIdToken<StartRankedGameResponse>(ApiRoutes.RANKED_MATCH, {
        method: "POST",
        body: { rulesVersion: CURRENT_RULES_VERSION },
        expectedUid: uid,
      })
    } catch (error) {
      if (!(error instanceof ApiRequestError && error.code === "match-pending") || attempt >= ARENA_PENDING_RETRIES) throw error
      await new Promise((resolve) => setTimeout(resolve, ARENA_PENDING_DELAY_MS))
    }
  }
  if (issued.mode !== "ranked" || !issued.gameId || !issued.ranked) throw new Error("unexpected-ranked-start")
  const { ghost, endsAt, serverNow } = issued.ranked
  useBlockPuzzleGameStore.getState().startVariantGame({
    gameId: issued.gameId,
    uid,
    seed: issued.seed,
    run: { kind: "ranked", seed: issued.seed, ghost, endsAt, clockOffset: serverNow - Date.now(), rulesVersion: issued.rulesVersion },
  })
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
    run: { kind: "duel", duelId, round, seed: issued.seed, opponent, startAt, endsAt, clockOffset: serverNow - Date.now(), rulesVersion: issued.rulesVersion },
  })
}
