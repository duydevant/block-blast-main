import { BOARD_SIZE, type BoardCells, type GameState, type GameVariant } from "@/modules/block-puzzle/engine/game-types"
import { EMPTY_RUN_STATS } from "@/modules/block-puzzle/engine/game-run-stats"
import {
  type RankedGameStart,
  type RecordedGameAction,
  replayRecordedGame,
} from "@/modules/block-puzzle/engine/replay-recorded-game-actions"

/**
 * Bài học kỹ thuật: bàn dựng sẵn + khay cố định + mục tiêu nhỏ, chạy bằng chính reducer của game nên server replay
 * kiểm được (thưởng xu lần đầu). Luật thuần, dùng chung client (trình chơi bài học) và server (API hoàn thành).
 */
export type LessonGoalKind = "lines" | "surviveTurns" | "combo" | "boardClear"

export interface LessonDefinition {
  /** Slug URL `/how-to-play/{slug}`, cũng là key dịch `lesson.{slug}.*`. */
  slug: string
  /** 8 dòng × 8 ký tự: "." = trống, "1".."8" = màu ô có sẵn. */
  board: readonly string[]
  /** Khay chia lần lượt (1–3 khối mỗi khay, theo shapeId). */
  fixedTrays: readonly (readonly string[])[]
  goal: { kind: LessonGoalKind; target: number }
  /** Số nước đặt tối đa (= số khối lời giải đặt) — hết nước mà chưa đạt mục tiêu là chưa qua. */
  moveLimit: number
  /** Ô Cất mở sẵn (bài dùng ô Cất). */
  stashUnlocked?: boolean
  /** Số lượt Đổi khay (bài dạy đổi khay); mặc định 0. */
  replaceCharges?: number
  /** Lời giải mẫu — cũng là gợi ý từng bước. */
  solution: readonly RecordedGameAction[]
}

/** Seed chỉ quyết định màu khối (khay cố định) → mọi người thấy cùng một bài. */
const LESSON_SEED_BASE = 4200

export function parseLessonBoard(rows: readonly string[]): BoardCells {
  const cells: number[] = []
  for (let row = 0; row < BOARD_SIZE; row++)
    for (let col = 0; col < BOARD_SIZE; col++) {
      const value = Number(rows[row]?.[col])
      cells.push(Number.isInteger(value) && value >= 1 && value <= 8 ? value : 0)
    }
  return cells
}

export function lessonVariant(lesson: LessonDefinition): GameVariant {
  const usesPowerUps = Boolean(lesson.stashUnlocked) || (lesson.replaceCharges ?? 0) > 0
  return {
    startBoard: parseLessonBoard(lesson.board),
    fixedTrays: lesson.fixedTrays,
    moveLimit: lesson.moveLimit,
    replaceCharges: lesson.replaceCharges ?? 0,
    noRevive: true,
    // Bài không dạy Cất / Đổi khay → ẩn hai nút cho bàn to, gọn.
    ...(usesPowerUps ? {} : { noPowerUps: true }),
  }
}

export function lessonStart(lesson: LessonDefinition, index: number): RankedGameStart {
  return { seed: LESSON_SEED_BASE + index, stashUnlocked: Boolean(lesson.stashUnlocked), variant: lessonVariant(lesson) }
}

/** Tiến độ mục tiêu (đơn điệu tăng → đạt rồi là giữ). */
export function lessonGoalProgress(lesson: LessonDefinition, game: Pick<GameState, "linesCleared" | "moveCount" | "runStats">): number {
  const stats = game.runStats ?? EMPTY_RUN_STATS
  switch (lesson.goal.kind) {
    case "lines":
      return game.linesCleared ?? 0
    case "surviveTurns":
      return game.moveCount
    case "combo":
      return stats.bestCombo
    case "boardClear":
      return stats.boardClears
  }
}

export type LessonStatus = "playing" | "complete" | "failed"

export function lessonStatus(lesson: LessonDefinition, game: GameState): LessonStatus {
  if (lessonGoalProgress(lesson, game) >= lesson.goal.target) return "complete"
  return game.isGameOver ? "failed" : "playing"
}

/** Server: log nước đi có hợp lệ và đạt mục tiêu bài không (replay bằng reducer thật). */
export function verifyLessonActions(lesson: LessonDefinition, index: number, actions: readonly RecordedGameAction[]): boolean {
  const replay = replayRecordedGame(lessonStart(lesson, index), actions)
  return replay.ok && lessonGoalProgress(lesson, replay.state) >= lesson.goal.target
}

const sameAction = (a: RecordedGameAction, b: RecordedGameAction) => JSON.stringify(a) === JSON.stringify(b)

/** Gợi ý bước kế: chỉ khi người chơi đang đi đúng lời giải mẫu; lệch rồi → null (chơi lại để xem gợi ý). */
export function nextLessonHint(lesson: LessonDefinition, played: readonly RecordedGameAction[]): RecordedGameAction | null {
  if (played.length >= lesson.solution.length) return null
  return played.every((action, index) => sameAction(action, lesson.solution[index])) ? lesson.solution[played.length] : null
}
