import { countIsolatedHoles } from "./board-heuristics"
import { gameReducer } from "./game-state-reducer"
import type { BoardCells, GameState, ShapeDef } from "./game-types"
import { hasAnyMove } from "./move-availability"
import { findShape } from "./piece-shape-catalog"
import {
  createRankedGameStartState,
  type RankedGameStart,
  type RecordedGameAction,
} from "./replay-recorded-game-actions"
import { canPlaceAllInSomeOrder, listPlacements, type SearchBudget, simulatePlacement } from "./tray-solvability-search"

/**
 * Phân tích sau ván ("Vì sao thua?"): chơi lại từ đầu, tìm lần chết đầu tiên (trước Hồi sinh) rồi xét lượt khay
 * cuối cùng: đầu lượt có cách đặt hết 3 khối không, và nước nào làm mất lối đi đó. Thuần, tất định, không throw.
 */
export type OutcomeVerdict = "mistake" | "unlucky" | "unknown"

export interface GameOutcomeAnalysis {
  verdict: OutcomeVerdict
  /** Nước làm khay đang có lối thành hết lối (chỉ khi verdict = "mistake"). */
  decisive?: { moveIndex: number; shapeId: string; row: number; col: number; boardBefore: BoardCells; boardAfter: BoardCells }
  /** Vị trí khác của cùng khối vẫn giữ được lối đi (ít lỗ kín nhất); không có = nên đặt khối khác trước. */
  suggestion?: { row: number; col: number }
  /** Số lỗ kín nước quyết định tạo thêm. */
  holesCreated: number
  /** Số lượt khay đã xét (không tính lượt có Cất / Đổi khối). */
  turnsAnalyzed: number
}

/** Ngân sách thử đặt mặc định cho cả lần phân tích (bàn rối quá thì trả "unknown"). */
export const DEFAULT_ANALYSIS_BUDGET = 40_000
/** Số lượt khay xét ngược từ lần chết. */
const LOOKBACK_TURNS = 10

interface Step {
  index: number
  action: RecordedGameAction
  before: GameState
  after: GameState
}

interface Turn {
  steps: Step[]
  /** Có Cất / Đổi khối hoặc đang giữ khối trong ô cất → bài toán khác, bỏ qua. */
  assisted: boolean
}

const UNKNOWN: GameOutcomeAnalysis = { verdict: "unknown", holesCreated: 0, turnsAnalyzed: 0 }

const trayShapes = (state: GameState): ShapeDef[] =>
  state.tray.flatMap((piece) => {
    const shape = piece ? findShape(piece.shapeId) : undefined
    return shape ? [shape] : []
  })

/** Chơi lại tới lần chết đầu tiên; null nếu log sai hoặc ván chưa chết (Hồi sinh trước khi chết = log lạ). */
function replayUntilFirstDeath(startState: GameState, actions: readonly RecordedGameAction[]): Step[] | null {
  const steps: Step[] = []
  let state = startState
  for (let index = 0; index < actions.length; index++) {
    const action = actions[index]
    if (action.type === "REVIVE") return null
    const next = gameReducer(state, action)
    if (next === state) return null
    steps.push({ index, action, before: state, after: next })
    state = next
    if (next.isGameOver) return steps
  }
  return null
}

/** Chia các nước thành lượt khay: lượt mới bắt đầu sau mỗi lần chia khay (nextPieceUid đổi). */
function splitIntoTurns(startState: GameState, steps: Step[]): Turn[] {
  const turns: Turn[] = []
  let current: Turn = { steps: [], assisted: Boolean(startState.stash) }
  for (const step of steps) {
    current.steps.push(step)
    if (step.action.type !== "PLACE_PIECE") current.assisted = true
    // Nước cuối đặt hết khay rồi khay mới không đặt được: lượt chết là khay mới (chưa đi nước nào).
    if (step.after.nextPieceUid !== step.before.nextPieceUid) {
      turns.push(current)
      current = { steps: [], assisted: Boolean(step.after.stash) }
    }
  }
  turns.push(current)
  return turns
}

/** Vị trí khác của cùng khối giữ được lối đặt hết phần khay còn lại; ưu tiên ít lỗ kín. */
function findSuggestion(step: Step, shape: ShapeDef, budget: SearchBudget): { row: number; col: number } | undefined {
  if (step.action.type !== "PLACE_PIECE") return undefined
  const { slot, row, col } = step.action
  const rest = trayShapes({ ...step.before, tray: step.before.tray.map((piece, index) => (index === slot ? null : piece)) })
  let best: { row: number; col: number; holes: number } | undefined
  for (const spot of listPlacements(step.before.board, shape)) {
    if (spot.row === row && spot.col === col) continue
    const board = simulatePlacement(step.before.board, shape, spot.row, spot.col).board
    if (canPlaceAllInSomeOrder(board, rest, budget) !== true) continue
    const holes = countIsolatedHoles(board)
    if (!best || holes < best.holes) best = { ...spot, holes }
  }
  return best ? { row: best.row, col: best.col } : undefined
}

/** Phân tích từ state đầu ván (dùng được cả ván offline khi biết state đầu). */
export function analyzeGameOutcomeFromState(
  startState: GameState,
  actions: readonly RecordedGameAction[],
  budgetLimit = DEFAULT_ANALYSIS_BUDGET
): GameOutcomeAnalysis {
  try {
    const steps = replayUntilFirstDeath(startState, actions)
    if (!steps) return UNKNOWN
    const death = steps[steps.length - 1].after
    // Chết vì hết số nước (màn chơi) / bị chốt sớm (đấu) — không phải bị kẹt khối.
    if (hasAnyMove(death.board, death.tray, death.stash ?? null)) return UNKNOWN

    const window = splitIntoTurns(startState, steps).slice(-LOOKBACK_TURNS)
    const turnsAnalyzed = window.filter((turn) => !turn.assisted).length
    // Các lượt trước đã đặt hết khối (đi tiếp được) nên không thể chứa nước làm mất lối; chỉ lượt chết cần tìm.
    const dying = window[window.length - 1]
    if (dying.assisted) return { ...UNKNOWN, turnsAnalyzed }

    const budget: SearchBudget = { remaining: budgetLimit }
    const turnStart = dying.steps.length > 0 ? dying.steps[0].before : death
    const atStart = canPlaceAllInSomeOrder(turnStart.board, trayShapes(turnStart), budget)
    if (atStart === false) return { verdict: "unlucky", holesCreated: 0, turnsAnalyzed }
    if (atStart === "unknown") return { ...UNKNOWN, turnsAnalyzed }

    for (const step of dying.steps) {
      if (step.action.type !== "PLACE_PIECE") continue
      const after = canPlaceAllInSomeOrder(step.after.board, trayShapes(step.after), budget)
      if (after === "unknown") return { ...UNKNOWN, turnsAnalyzed }
      if (after) continue
      const piece = step.before.tray[step.action.slot]
      const shape = piece ? findShape(piece.shapeId) : undefined
      if (!piece || !shape) return { ...UNKNOWN, turnsAnalyzed }
      const placedBoard = simulatePlacement(step.before.board, shape, step.action.row, step.action.col).board
      return {
        verdict: "mistake",
        decisive: {
          moveIndex: step.index,
          shapeId: piece.shapeId,
          row: step.action.row,
          col: step.action.col,
          boardBefore: step.before.board,
          boardAfter: step.after.board,
        },
        suggestion: findSuggestion(step, shape, budget),
        holesCreated: Math.max(0, countIsolatedHoles(placedBoard) - countIsolatedHoles(step.before.board)),
        turnsAnalyzed,
      }
    }
    return { ...UNKNOWN, turnsAnalyzed }
  } catch {
    return UNKNOWN
  }
}

/** Phân tích ván tính điểm từ seed (giống server replay). */
export function analyzeGameOutcome(input: { start: RankedGameStart; actions: readonly RecordedGameAction[]; budget?: number }): GameOutcomeAnalysis {
  return analyzeGameOutcomeFromState(createRankedGameStartState(input.start), input.actions, input.budget)
}
