import type { GameRunStats } from "./game-run-stats"

export const BOARD_SIZE = 8
export const BOARD_CELL_COUNT = BOARD_SIZE * BOARD_SIZE
export const TRAY_SIZE = 3
/** Slot đặc biệt chỉ khối đang nằm trong ô cất (dùng chung cho engine, input, render). */
export const STASH_SLOT = -2
/** Số màu khối; colorId chạy từ 1..BLOCK_COLOR_COUNT, 0 = ô trống. */
export const BLOCK_COLOR_COUNT = 8

/** Bàn chơi phẳng, index = row * BOARD_SIZE + col. */
export type BoardCells = readonly number[]

export type CellOffset = readonly [row: number, col: number]

export interface ShapeDef {
  id: string
  /** Họ khối (mọi hướng xoay chung một họ), dùng để tránh ra lặp. */
  family: string
  /** Toạ độ ô tính từ góc trên-trái (0,0) của khối. */
  cells: readonly CellOffset[]
  width: number
  height: number
  /** Trọng số xuất hiện cơ bản, chia đều cho các biến thể xoay. */
  weight: number
  /** 1 = khối nhỏ dễ đặt, 3 = khối to khó đặt. */
  tier: 1 | 2 | 3
}

export interface TrayPiece {
  uid: number
  shapeId: string
  colorId: number
}

export type TraySlots = readonly (TrayPiece | null)[]

export interface TrayGeneratorState {
  /** 2 → smart, 1/0 → bag; -1 starts the next cycle. */
  stepsBeforeSmart: number
  /** One-based bag IDs, shuffled only when the queue is exhausted. */
  poolIndices: readonly number[]
  /** Remaining geometry indices in the active bag (draw without replacement). */
  currentPool: readonly number[]
}

/** Kết quả một nước đi, dùng cho hiệu ứng/âm thanh ở UI. */
export interface MoveResult {
  colorId: number
  placedCells: number[]
  clearedRows: number[]
  clearedCols: number[]
  clearedCells: number[]
  points: number
  combo: number
  boardCleared: boolean
}

export interface GameState {
  board: BoardCells
  tray: TraySlots
  score: number
  /** Chuỗi nước xoá dòng liên tiếp, 0 = không có combo. */
  combo: number
  /** Số nước liên tiếp không xoá dòng kể từ lần xoá gần nhất. */
  movesSinceClear: number
  moveCount: number
  isGameOver: boolean
  rngState: number
  nextPieceUid: number
  generatorState?: TrayGeneratorState
  stash?: TrayPiece | null
  stashUnlocked?: boolean
  replaceCharges?: number
  reviveUsed?: boolean
  /** Chế độ màn chơi: đặt đủ số nước này thì hết ván (kể cả còn chỗ). */
  moveLimit?: number
  /** Ván bị chốt khi vẫn còn chỗ đặt (đấu 1v1 hết giờ / bỏ trận): tải lại save vẫn là hết ván. */
  endedEarly?: boolean
  /** Ván không có "Cất" / "Đổi khối" (đấu 1v1): giao diện ẩn hai nút, reducer từ chối hai thao tác này. */
  noPowerUps?: boolean
  /** Chế độ "Không bế tắc": mọi khay chia ra đều đặt hết được theo một thứ tự nào đó. */
  guaranteedTray?: boolean
  /** Bài học: các khay cố định CÒN LẠI (shapeId mỗi khay); hết danh sách thì chia như thường. */
  fixedTrays?: readonly (readonly string[])[]
  /** Tổng số hàng + cột đã xoá trong ván (mục tiêu màn chơi). */
  linesCleared?: number
  /** Chỉ số kỹ năng của ván (reducer cộng dồn); save cũ thiếu → coi như rỗng. */
  runStats?: GameRunStats
  lastMove: MoveResult | null
}

/**
 * Biến thể ván (màn chơi, đấu 1v1): luôn suy ra từ catalog dùng chung ở cả client và server,
 * không bao giờ nhận từ client, để replay ra đúng ván người chơi đã thấy.
 */
export interface GameVariant {
  /** Bàn có sẵn ô (chướng ngại / màn dựng sẵn); ô có màu xoá được như khối thường. */
  startBoard?: BoardCells
  moveLimit?: number
  replaceCharges?: number
  /** Không có hồi sinh (đấu 1v1): ván bắt đầu như đã dùng lượt hồi sinh. */
  noRevive?: boolean
  /** Không có ô "Cất" và nút "Đổi khối" (đấu 1v1). */
  noPowerUps?: boolean
  /** Khay luôn có lối đi (chế độ "Không bế tắc"). */
  guaranteedTray?: boolean
  /** Bài học: chia lần lượt các khay này (1–3 khối mỗi khay, theo shapeId) trước khi chia như thường. */
  fixedTrays?: readonly (readonly string[])[]
}

export type GameAction =
  | { type: "NEW_GAME"; seed: number }
  | { type: "PLACE_PIECE"; slot: number; row: number; col: number }
  | { type: "STASH_PIECE"; slot: number }
  | { type: "REPLACE_TRAY" }
  | { type: "REVIVE" }
  | { type: "RESTORE"; state: GameState }
