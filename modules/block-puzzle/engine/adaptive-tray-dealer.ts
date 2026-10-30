import { placeRowsAndClear, placementsRows, shapeRows, toBoardRows, type BoardRows } from "./board-bitmask-operations"
import { canShapeFitAnywhere } from "./board-grid-operations"
import { BLOCK_COLOR_COUNT, TRAY_SIZE, type BoardCells, type ShapeDef, type TrayPiece } from "./game-types"
import { findShape, SHAPE_CATALOG } from "./piece-shape-catalog"
import { INITIAL_GENERATOR_STATE, type DealResult } from "./piece-tray-generator"
import { nextRandom } from "./seeded-random-generator"

/**
 * Bộ chia khối luật v2 (chế độ vô tận): điểm thấp → nhiều khối "gỡ bàn" (xoá được dòng ngay, ưu tiên dọn sạch bàn)
 * và khối nhỏ; điểm càng cao → càng nhiều khối to (chữ L 3×3, vuông 3×3, thanh 5) nhưng vẫn còn tỉ lệ khối gỡ bàn.
 * Chỉnh số ở đây rồi chạy `npm run balance` để so trước/sau.
 */
export const ADAPTIVE_DEALER_RULES = {
  /**
   * Độ khó d = điểm / (điểm + scale): 1.000 điểm ≈ 0,29; 3.000 ≈ 0,55; 6.000 ≈ 0,71; 20.000 ≈ 0,89.
   * Chỉ dùng phép chia (không Math.exp): kết quả giống hệt nhau trên mọi trình duyệt và server → replay không lệch.
   */
  difficultyScale: 2500,
  /** Xác suất mỗi ô khay là khối gỡ bàn, từ d = 0 → d = 1. */
  helperChance: { easy: 0.55, hard: 0.2 },
  /** Tỉ lệ bậc khối nhỏ / vừa / to (tier 1/2/3 trong catalog), từ d = 0 → d = 1. */
  tierWeights: { easy: [0.45, 0.4, 0.15], hard: [0.2, 0.35, 0.45] },
  /** Điểm thưởng nội bộ khi chấm khối gỡ bàn: dọn sạch bàn luôn được chọn trước. */
  perfectClearValue: 10_000,
} as const

export function dealerDifficulty(score: number): number {
  const points = Math.max(0, score)
  return points / (points + ADAPTIVE_DEALER_RULES.difficultyScale)
}

const lerp = (from: number, to: number, t: number) => from + (to - from) * t
const popcount = (value: number) => {
  let count = 0
  for (let bits = value; bits; bits &= bits - 1) count++
  return count
}

const SHAPES_BY_TIER = ([1, 2, 3] as const).map((tier) => SHAPE_CATALOG.filter((shape) => shape.tier === tier))

/** Khối gỡ bàn tốt nhất: xoá được ít nhất 1 dòng; ưu tiên dọn sạch bàn, nhiều dòng, bàn còn ít ô. Hoà → bốc ngẫu nhiên. */
function pickHelper(rows: BoardRows, random: () => number): { shape: ShapeDef; after: BoardRows } | null {
  let bestValue = -Infinity
  let best: { shape: ShapeDef; after: BoardRows }[] = []
  for (const shape of SHAPE_CATALOG) {
    const mask = shapeRows(shape)
    let shapeBest: { value: number; after: BoardRows } | null = null
    for (const [row, col] of placementsRows(rows, shape)) {
      const result = placeRowsAndClear(rows, mask, row, col)
      if (result.linesCleared === 0) continue
      const filled = result.rows.reduce((sum, value) => sum + popcount(value), 0)
      const value = (filled === 0 ? ADAPTIVE_DEALER_RULES.perfectClearValue : 0) + result.linesCleared ** 2 * 100 - filled
      if (!shapeBest || value > shapeBest.value) shapeBest = { value, after: result.rows }
    }
    if (!shapeBest) continue
    if (shapeBest.value > bestValue) {
      bestValue = shapeBest.value
      best = [{ shape, after: shapeBest.after }]
    } else if (shapeBest.value === bestValue) best.push({ shape, after: shapeBest.after })
  }
  return best.length > 0 ? best[Math.floor(random() * best.length)] : null
}

/** Bốc khối theo bậc (nhỏ/vừa/to theo độ khó), trong bậc theo trọng số catalog. */
function pickByTier(difficulty: number, random: () => number): ShapeDef {
  const { easy, hard } = ADAPTIVE_DEALER_RULES.tierWeights
  const weights = easy.map((weight, index) => lerp(weight, hard[index], difficulty))
  let roll = random() * weights.reduce((sum, weight) => sum + weight, 0)
  let tier = 0
  while (tier < weights.length - 1 && roll >= weights[tier]) roll -= weights[tier++]
  const shapes = SHAPES_BY_TIER[tier]
  let pick = random() * shapes.reduce((sum, shape) => sum + shape.weight, 0)
  for (const shape of shapes) {
    pick -= shape.weight
    if (pick < 0) return shape
  }
  return shapes[shapes.length - 1]
}

/** Chia khay luật v2. Tất định theo rngState (server replay ra đúng khay người chơi đã thấy). */
export function dealAdaptiveTray(
  board: BoardCells,
  score: number,
  rngState: number,
  nextPieceUid: number,
  stash: TrayPiece | null = null
): DealResult {
  let state = rngState
  const random = () => {
    const [value, next] = nextRandom(state)
    state = next
    return value
  }
  const color = () => Math.floor(random() * BLOCK_COLOR_COUNT) + 1
  const difficulty = dealerDifficulty(score)
  const helperChance = lerp(ADAPTIVE_DEALER_RULES.helperChance.easy, ADAPTIVE_DEALER_RULES.helperChance.hard, difficulty)
  const startRows = toBoardRows(board)
  // Khối gỡ bàn sau tính trên bàn đã đặt khối gỡ bàn trước (khay gỡ bàn nối tiếp nhau được).
  let rows = startRows
  const tray: TrayPiece[] = []
  for (let slot = 0; slot < TRAY_SIZE; slot++) {
    const helper = random() < helperChance ? pickHelper(rows, random) : null
    if (helper) rows = helper.after
    const shape = helper?.shape ?? pickByTier(difficulty, random)
    tray.push({ uid: nextPieceUid + slot, shapeId: shape.id, colorId: color() })
  }
  // Không khối nào (kể cả khối cất) đặt được → ô đầu thành khối gỡ bàn, không có thì khối 1 ô.
  const fits = (piece: TrayPiece) => canShapeFitAnywhere(board, findShape(piece.shapeId)!)
  if (!tray.some(fits) && !(stash && fits(stash))) {
    const rescue = pickHelper(startRows, random)?.shape.id ?? "dot"
    tray[0] = { ...tray[0], shapeId: rescue, colorId: color() }
  }
  return { tray, rngState: state, nextPieceUid: nextPieceUid + TRAY_SIZE, generatorState: INITIAL_GENERATOR_STATE }
}
