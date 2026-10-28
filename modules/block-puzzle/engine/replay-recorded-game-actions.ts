import { createNewGame, gameReducer } from "./game-state-reducer"
import type { GameAction, GameState, GameVariant } from "./game-types"

/** Hành động người chơi được ghi lại để server chơi lại (không gồm NEW_GAME/RESTORE). */
export type RecordedGameAction = Exclude<GameAction, { type: "NEW_GAME" } | { type: "RESTORE" }>

/**
 * Giới hạn số action một ván — chặn request quá lớn. Ván trung bình ~50 nước; 10.000 nước
 * vẫn replay < vài giây trên server. Client vượt mốc này thì ván thành offline (không nộp).
 */
export const MAX_RECORDED_ACTIONS = 10_000

export interface RankedGameStart {
  seed: number
  /** Ô cất mở sẵn từ các ván trước; phải khớp đúng giữa client và server. */
  stashUnlocked: boolean
  /** Sự kiện / màn chơi; server lấy từ catalog theo mode của session. */
  variant?: GameVariant
}

export interface ReplaySummary {
  score: number
  moveCount: number
  linesCleared: number
  bestCombo: number
  boardClears: number
  isGameOver: boolean
  stashUnlocked: boolean
}

export type ReplayResult =
  | { ok: true; state: GameState; summary: ReplaySummary }
  | { ok: false; reason: "too-many-actions" | "invalid-action"; actionIndex?: number }

/** State đầu ván dùng chung cho store (client) và replay (server). */
export function createRankedGameStartState(start: RankedGameStart): GameState {
  return { ...createNewGame(start.seed, start.variant), stashUnlocked: start.stashUnlocked }
}

/**
 * Chơi lại toàn bộ ván từ seed. Reducer trả lại đúng tham chiếu state cũ khi nước đi không hợp lệ
 * → coi là log bị sửa/hỏng và từ chối cả ván. Điểm luôn do replay tính, không tin số client gửi.
 */
export function replayRecordedGame(start: RankedGameStart, actions: readonly RecordedGameAction[]): ReplayResult {
  if (actions.length > MAX_RECORDED_ACTIONS) return { ok: false, reason: "too-many-actions" }

  let state = createRankedGameStartState(start)
  let linesCleared = 0
  let bestCombo = 0
  let boardClears = 0

  for (let index = 0; index < actions.length; index++) {
    const next = gameReducer(state, actions[index])
    if (next === state) return { ok: false, reason: "invalid-action", actionIndex: index }
    if (actions[index].type === "PLACE_PIECE" && next.lastMove) {
      linesCleared += next.lastMove.clearedRows.length + next.lastMove.clearedCols.length
      bestCombo = Math.max(bestCombo, next.lastMove.combo)
      if (next.lastMove.boardCleared) boardClears++
    }
    state = next
  }

  return {
    ok: true,
    state,
    summary: {
      score: state.score,
      moveCount: state.moveCount,
      linesCleared,
      bestCombo,
      boardClears,
      isGameOver: state.isGameOver,
      stashUnlocked: Boolean(state.stashUnlocked),
    },
  }
}
