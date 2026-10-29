import { BLOCK_COLOR_COUNT, TRAY_SIZE, type TrayPiece } from "./game-types"
import type { DealResult } from "./piece-tray-generator"
import { nextRandom } from "./seeded-random-generator"

/**
 * Khay đầu ván (bàn trống): bốc ngẫu nhiên theo seed một trong các bộ 3 khối to đặt được để xoá ít nhất
 * 2 hàng/cột cùng lúc (2 bộ đầu xoá được 3) — mở ván bằng một cú nổ to, mỗi ván một kiểu. Thứ tự trong khay
 * và màu cũng ngẫu nhiên. Đây là toàn bộ các bộ như vậy trong catalog (test kiểm lại từng bộ).
 */
export const OPENING_TRAYS: readonly (readonly [string, string, string])[] = [
  ["square3", "square3", "rect2x3-r0"],
  ["square3", "square3", "rect2x3-r1"],
  ["square3", "square3", "square2"],
  ["square3", "rect2x3-r0", "square2"],
  ["square3", "rect2x3-r1", "square2"],
  ["square3", "rect2x3-r0", "rect2x3-r1"],
  ["rect2x3-r0", "rect2x3-r0", "square2"],
  ["rect2x3-r1", "rect2x3-r1", "square2"],
  ["rect2x3-r0", "rect2x3-r0", "rect2x3-r1"],
  ["rect2x3-r0", "rect2x3-r1", "rect2x3-r1"],
  ["line5-r0", "line5-r0", "square3"],
  ["line5-r1", "line5-r1", "square3"],
  ["line5-r0", "line5-r1", "square3"],
  ["line5-r0", "line5-r0", "rect2x3-r0"],
  ["line5-r1", "line5-r1", "rect2x3-r1"],
  ["line5-r0", "line5-r1", "corner5-r0"],
  ["line5-r0", "line5-r1", "corner5-r1"],
  ["line5-r0", "line5-r1", "corner5-r2"],
  ["line5-r0", "line5-r1", "corner5-r3"],
]

export function dealOpeningTray(rngState: number, nextPieceUid: number): DealResult {
  let state = rngState
  const random = () => {
    const [value, next] = nextRandom(state)
    state = next
    return value
  }
  const shapeIds = [...OPENING_TRAYS[Math.floor(random() * OPENING_TRAYS.length)]]
  for (let i = shapeIds.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[shapeIds[i], shapeIds[j]] = [shapeIds[j], shapeIds[i]]
  }
  const tray: TrayPiece[] = shapeIds.map((shapeId, slot) => ({
    uid: nextPieceUid + slot,
    shapeId,
    colorId: Math.floor(random() * BLOCK_COLOR_COUNT) + 1,
  }))
  // Khay đầu thay cho lượt chia "thông minh" đầu tiên; các lượt sau đi tiếp chu kỳ bag, bag, smart.
  return { tray, rngState: state, nextPieceUid: nextPieceUid + TRAY_SIZE,
    generatorState: { stepsBeforeSmart: 1, poolIndices: [], currentPool: [] } }
}
