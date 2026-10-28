import { createNewGame } from "../engine/game-state-reducer"
import type { GameState } from "../engine/game-types"
import { createRankedGameStartState } from "../engine/replay-recorded-game-actions"
import { variantForRun } from "@/modules/game-modes/variant-run"

import type { IssuedChallengeStart, IssuedDailyStart, IssuedVariantStart, PendingSubmission, RankedGameCloudState } from "./ranked-game-cloud-state"

/** Giữ tối đa N ván chờ nộp (offline lâu) — bỏ ván cũ nhất. */
const MAX_PENDING_SUBMISSIONS = 20

type GameStoreSnapshot = RankedGameCloudState & { game: GameState | null }
type GameStorePatch = Partial<GameStoreSnapshot>

function randomSeed(): number {
  const buffer = new Uint32Array(1)
  crypto.getRandomValues(buffer)
  return buffer[0]
}

/**
 * Thêm ván tính điểm hiện tại (chưa nộp) vào hàng chờ. Ván classic/thách đấu chưa đi nước nào thì bỏ luôn;
 * ván daily chưa chơi vẫn nộp (log rỗng) để server nhả chỗ giữ lượt tính điểm hôm nay.
 */
export function withCurrentGameQueued(state: GameStoreSnapshot): PendingSubmission[] {
  const session = state.rankedSession
  if (!session || session.queued || (state.actionLog.length === 0 && !state.dailyDay)) return state.pendingSubmissions
  const item = { gameId: session.gameId, uid: session.uid, actions: state.actionLog }
  return [...state.pendingSubmissions, item].slice(-MAX_PENDING_SUBMISSIONS)
}

/** Ván mới: dùng seed server cấp sẵn nếu có (ván tính điểm), không thì seed local (offline). */
export function freshGameState(state: GameStoreSnapshot): GameStorePatch {
  const issued = state.nextRankedSeed
  // Ô cất đã mở thì giữ cho các ván sau; lượt đổi khay reset mỗi ván.
  const game = issued
    ? createRankedGameStartState(issued)
    : { ...createNewGame(randomSeed()), stashUnlocked: state.game?.stashUnlocked ?? false }
  return {
    game,
    actionLog: [],
    rankedSession: issued ? { gameId: issued.gameId, uid: issued.uid, queued: false } : null,
    nextRankedSeed: null,
    pendingSubmissions: withCurrentGameQueued(state),
    dailyDay: null,
    challenge: null,
    variantRun: null,
  }
}

/** Ván thử thách hằng ngày: seed chung của ngày, ô cất khoá; giữ nguyên seed classic dự phòng. */
export function dailyGameState(state: GameStoreSnapshot, start: IssuedDailyStart): GameStorePatch {
  return {
    game: createRankedGameStartState({ seed: start.seed, stashUnlocked: false }),
    actionLog: [],
    rankedSession: start.gameId ? { gameId: start.gameId, uid: start.uid, queued: false } : null,
    pendingSubmissions: withCurrentGameQueued(state),
    dailyDay: start.day,
    challenge: null,
    variantRun: null,
  }
}

/** Ván nhận thách đấu: đúng seed + ô cất của ván người thách; giữ nguyên seed classic dự phòng. */
export function challengeGameState(state: GameStoreSnapshot, start: IssuedChallengeStart): GameStorePatch {
  return {
    game: createRankedGameStartState(start),
    actionLog: [],
    rankedSession: { gameId: start.gameId, uid: start.uid, queued: false },
    pendingSubmissions: withCurrentGameQueued(state),
    dailyDay: null,
    challenge: start.opponent,
    variantRun: null,
  }
}

/** Sự kiện tuần / màn chơi / đấu 1v1: biến thể lấy từ catalog theo chế độ, ô cất khoá như daily. */
export function variantGameState(state: GameStoreSnapshot, start: IssuedVariantStart): GameStorePatch {
  return {
    game: createRankedGameStartState({ seed: start.seed, stashUnlocked: false, variant: variantForRun(start.run) }),
    actionLog: [],
    rankedSession: start.gameId && start.uid ? { gameId: start.gameId, uid: start.uid, queued: false } : null,
    pendingSubmissions: withCurrentGameQueued(state),
    dailyDay: null,
    challenge: null,
    variantRun: start.run,
  }
}
