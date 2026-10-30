import { useFirebaseAuthStore } from "@/lib/auth/firebase-auth-store"
import { ApiRequestError, fetchJsonWithFirebaseIdToken } from "@/lib/firebase/fetch-json-with-firebase-id-token"
import { ApiRoutes } from "@/lib/routes"
import type { StartRankedGameResponse, SubmitRankedGameResponse } from "@/modules/player-profile/player-profile-types"

import { CURRENT_RULES_VERSION } from "../engine/game-types"
import { actionTimesOf, withoutActionTime } from "../engine/recorded-action-timing"

import { useBlockPuzzleGameStore } from "./block-puzzle-game-store"
import { isUntouchedGame } from "./ranked-game-cloud-state"

/** Sau lỗi mạng/server thì nghỉ một lúc mới thử lại, tránh gọi API liên tục mỗi nước đi. */
const RETRY_DELAY_MS = 30_000

/**
 * Chỉ những mã này nghĩa là server đã xét ván và từ chối hẳn (body sai, không có ván, đã nộp, log sai) → bỏ.
 * 401/429/5xx/lỗi mạng là lỗi tạm (token, cấu hình server, quá tải) → giữ lại thử sau, không làm mất ván.
 */
const PERMANENT_REJECTION_STATUSES = new Set([400, 404, 409, 413, 422])

function isPermanentRejection(error: unknown): boolean {
  return error instanceof ApiRequestError && PERMANENT_REJECTION_STATUSES.has(error.status)
}

/**
 * Đồng bộ ván tính điểm với server, chạy nền khi màn chơi mở:
 * - xin sẵn seed cho ván kế tiếp (ván chưa chơi thì nhận luôn seed đó),
 * - hết ván + hết hồi sinh → đưa vào hàng chờ; nộp hàng chờ khi có mạng,
 * - đổi tài khoản → bỏ dữ liệu của uid cũ.
 * Mọi thay đổi state đều kích hoạt lại `tick`, nên mỗi bước chỉ làm một việc rồi return.
 */
export function startRankedGameCloudSync(onGameSubmitted: (result: SubmitRankedGameResponse, gameId: string) => void): () => void {
  const store = useBlockPuzzleGameStore
  let requestingSeed = false
  let flushing = false
  let lastFailureAt = 0
  let disposed = false
  let retryTimer: number | undefined
  let refetchingForStash = false
  let keptLockedSeedId: string | null = null

  const currentUid = () => {
    const auth = useFirebaseAuthStore.getState()
    return auth.status === "ready" ? (auth.player?.uid ?? null) : null
  }
  const coolingDown = () => Date.now() - lastFailureAt < RETRY_DELAY_MS
  const markFailure = () => {
    lastFailureAt = Date.now()
    window.clearTimeout(retryTimer)
    retryTimer = window.setTimeout(tick, RETRY_DELAY_MS + 100)
  }

  async function requestSeed(uid: string) {
    requestingSeed = true
    try {
      const stashUnlocked = store.getState().game?.stashUnlocked ?? false
      const issued = await fetchJsonWithFirebaseIdToken<StartRankedGameResponse>(ApiRoutes.GAMES_START, {
        method: "POST",
        body: { mode: "classic", stashUnlocked, rulesVersion: CURRENT_RULES_VERSION },
        expectedUid: uid,
      })
      if (!issued.gameId) throw new Error("classic start returned no session")
      const gameId = issued.gameId
      if (refetchingForStash) keptLockedSeedId = gameId
      if (!disposed && currentUid() === uid) {
        store.getState().setNextRankedSeed({ gameId, uid, seed: issued.seed, stashUnlocked: issued.stashUnlocked, rulesVersion: issued.rulesVersion })
      }
    } catch (error) {
      console.warn("[ranked-sync] could not get a ranked seed", error)
      markFailure()
    } finally {
      // State có thể đã đổi trong lúc cờ còn bật (VD vừa nhận seed cho ván chưa chơi) → chạy lại một lượt.
      requestingSeed = false
      refetchingForStash = false
      tick()
    }
  }

  async function flushPending(uid: string) {
    flushing = true
    try {
      for (const item of store.getState().pendingSubmissions.filter((entry) => entry.uid === uid)) {
        if (disposed || currentUid() !== uid) return
        try {
          const result = await fetchJsonWithFirebaseIdToken<SubmitRankedGameResponse>(ApiRoutes.GAMES_SUBMIT, {
            method: "POST",
            body: { gameId: item.gameId, actions: item.actions.map(withoutActionTime), times: actionTimesOf(item.actions) ?? undefined },
            expectedUid: uid,
          })
          store.getState().removePendingSubmission(item.gameId)
          onGameSubmitted(result, item.gameId)
        } catch (error) {
          console.warn("[ranked-sync] submit failed", error)
          if (!isPermanentRejection(error)) return markFailure()
          store.getState().removePendingSubmission(item.gameId)
        }
      }
    } finally {
      flushing = false
      tick()
    }
  }

  function tick() {
    const state = store.getState()
    if (disposed || !state.hasHydrated) return
    const uid = currentUid()
    if (!uid) return

    // Save/seed của tài khoản khác (đổi tài khoản, hoặc save cũ) → dọn trước; set sẽ gọi lại tick.
    state.dropCloudStateForOtherUser(uid)
    if (store.getState() !== state) return
    if (state.rankedSession && !state.rankedSession.queued && state.game?.isGameOver && state.game.reviveUsed) {
      return state.queueFinishedRankedGame()
    }
    // Ván offline chưa chơi → nhận seed tính điểm ngay (không đụng ván daily/thách đấu).
    const specialGame = state.dailyDay !== null || state.challenge !== null || state.variantRun !== null
    if (state.nextRankedSeed && !state.rankedSession && !specialGame && isUntouchedGame(state.game)) return state.startNewGame()
    // Seed xin lúc ô cất còn khoá, nhưng ván vừa rồi đã mở ô cất và đã nộp xong → xin seed mới để không khoá lại.
    const hasPendingForUid = state.pendingSubmissions.some((item) => item.uid === uid)
    // Chỉ xin lại một lần cho mỗi seed (server vẫn trả "khoá" thì giữ, tránh vòng lặp ghi Firestore).
    if (state.nextRankedSeed && !state.nextRankedSeed.stashUnlocked && state.game?.stashUnlocked
      && state.nextRankedSeed.gameId !== keptLockedSeedId
      && (!state.rankedSession || state.rankedSession.queued) && !hasPendingForUid && !flushing && !requestingSeed) {
      refetchingForStash = true
      return state.discardNextRankedSeed()
    }
    if (coolingDown()) return
    if (!flushing && hasPendingForUid) void flushPending(uid)
    if (!requestingSeed && !state.nextRankedSeed) void requestSeed(uid)
  }

  const onOnline = () => {
    lastFailureAt = 0
    tick()
  }

  const unsubscribeGame = store.subscribe(tick)
  const unsubscribeAuth = useFirebaseAuthStore.subscribe(tick)
  window.addEventListener("online", onOnline)
  tick()

  return () => {
    disposed = true
    window.clearTimeout(retryTimer)
    unsubscribeGame()
    unsubscribeAuth()
    window.removeEventListener("online", onOnline)
  }
}
