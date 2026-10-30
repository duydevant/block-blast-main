import { dayKeyFor } from "@/lib/vn-calendar"
import { startChallengeGame } from "@/modules/challenge/challenge-game-actions"
import { CHALLENGE_ID_PATTERN } from "@/modules/challenge/challenge-types"
import { DUEL_ID_PATTERN } from "@/modules/duel/duel-types"
import { findLevel } from "@/modules/game-modes/level-catalog"
import { startDuelGame, startLevelGame, startLogicGame } from "@/modules/game-modes/start-variant-game"

import { useBlockPuzzleGameStore } from "./store/block-puzzle-game-store"
import { type GameModeSlot, modeSlotOf, type ParkedGame } from "./store/parked-mode-games"
import { startDailyChallenge } from "./store/start-daily-challenge"

/** Chế độ người chơi muốn vào (từ link `/play?…` hoặc menu). */
export type SpecialMode =
  | { kind: "endless" }
  | { kind: "logic" }
  | { kind: "daily" }
  | { kind: "challenge"; id: string }
  | { kind: "level"; id: number }
  | { kind: "duel"; id: string; round: number | null }

/** `/play?endless=1`, `?daily=1`, `?challenge=<id>`, `?level=<n>`, `?duel=<id>&round=<n>` → chế độ cần mở. */
export function modeFromQuery(search: string): SpecialMode | null {
  const params = new URLSearchParams(search)
  if (params.has("endless")) return { kind: "endless" }
  if (params.has("logic")) return { kind: "logic" }
  const challengeId = params.get("challenge")
  if (challengeId && CHALLENGE_ID_PATTERN.test(challengeId)) return { kind: "challenge", id: challengeId }
  const duelId = params.get("duel")
  const round = Number(params.get("round"))
  if (duelId && DUEL_ID_PATTERN.test(duelId)) return { kind: "duel", id: duelId, round: Number.isInteger(round) && round > 0 ? round : null }
  const levelId = Number(params.get("level"))
  if (findLevel(levelId)) return { kind: "level", id: levelId }
  return params.has("daily") ? { kind: "daily" } : null
}

/** Ngăn ván của chế độ (null = đấu 1v1, không cất). */
function slotOfMode(mode: SpecialMode): GameModeSlot | null {
  return mode.kind === "duel" ? null : mode.kind
}

/** Ván (đang chơi hoặc đã cất) đúng là ván của chế độ được mở: cùng ngày / tuần / màn / thách đấu. */
function gameMatchesMode(game: Pick<ParkedGame, "dailyDay" | "challenge" | "variantRun">, mode: SpecialMode, now: Date): boolean {
  if (modeSlotOf(game) !== slotOfMode(mode)) return false
  if (mode.kind === "daily") return game.dailyDay === dayKeyFor(now)
  if (mode.kind === "level") return game.variantRun?.kind === "level" && game.variantRun.levelId === mode.id
  if (mode.kind === "challenge") return game.challenge?.id === mode.id
  if (mode.kind === "logic") return game.variantRun?.kind === "logic"
  return mode.kind === "endless"
}

/** Đang chơi đúng ván của chế độ này rồi (chưa hết ván) → không làm gì; đấu 1v1: cùng phòng + cùng ván. */
export function isAlreadyInMode(mode: SpecialMode): boolean {
  const state = useBlockPuzzleGameStore.getState()
  if (mode.kind === "duel") {
    const run = state.variantRun
    return run?.kind === "duel" && run.duelId === mode.id && (mode.round === null || run.round === mode.round)
  }
  return state.game !== null && !state.game.isGameOver && gameMatchesMode(state, mode, new Date())
}

/** Có ván dở đã cất của đúng chế độ này để chơi tiếp không. */
export function canResumeMode(mode: SpecialMode): boolean {
  const slot = slotOfMode(mode)
  const parked = slot ? useBlockPuzzleGameStore.getState().parkedGames[slot] : undefined
  return parked !== undefined && gameMatchesMode(parked, mode, new Date())
}

/** Xin ván mới của chế độ (server cấp seed); "practice" = lượt luyện tập thử thách ngày. */
async function startFreshMode(mode: SpecialMode): Promise<"practice" | void> {
  if (mode.kind === "endless") return useBlockPuzzleGameStore.getState().startNewGame()
  if (mode.kind === "logic") return startLogicGame()
  if (mode.kind === "challenge") return startChallengeGame(mode.id)
  if (mode.kind === "duel") return startDuelGame(mode.id)
  if (mode.kind === "level") return void (await startLevelGame(mode.id))
  return (await startDailyChallenge()) === "practice" ? "practice" : undefined
}

/**
 * Vào chế độ: cất ván đang chơi vào ngăn của chế độ nó, lấy ván dở của chế độ đích ra chơi tiếp, chưa có (hoặc ván
 * cất đã cũ: ngày/tuần/màn khác) thì xin ván mới. Xin ván mới lỗi → trả lại ván vừa cất để không mất gì.
 */
export async function enterMode(mode: SpecialMode): Promise<"practice" | void> {
  const store = useBlockPuzzleGameStore.getState()
  const target = slotOfMode(mode)
  const resumable = canResumeMode(mode)
  const previous = store.parkCurrentGame()
  if (target && resumable && useBlockPuzzleGameStore.getState().resumeParkedGame(target)) return
  if (target && !resumable) useBlockPuzzleGameStore.getState().discardParkedGame(target)
  try {
    return await startFreshMode(mode)
  } catch (error) {
    const after = useBlockPuzzleGameStore.getState()
    if (after.game === null && !(previous && after.resumeParkedGame(previous))) after.startNewGame()
    throw error
  }
}

/** "Ván mới" trong một chế độ: ván mới **cùng chế độ** (thử thách → lượt tiếp, màn → chơi lại màn, thách đấu → lượt mới). */
export async function restartCurrentMode(): Promise<"practice" | void> {
  const { variantRun, dailyDay, challenge, startNewGame } = useBlockPuzzleGameStore.getState()
  if (variantRun?.kind === "level") return void (await startLevelGame(variantRun.levelId))
  if (variantRun?.kind === "logic") return startLogicGame()
  if (dailyDay) return (await startDailyChallenge()) === "practice" ? "practice" : undefined
  if (challenge) return startChallengeGame(challenge.id)
  startNewGame()
}
