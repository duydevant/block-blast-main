/** Luật điểm/combo của game. Chỉnh số ở đây rồi chạy `npm run balance` để xem tác động. */
export const SCORING_RULES = {
  pointsPerPlacedCell: 1,
  /** Điểm dòng đầu tiên; xoá n dòng một lúc = lineClearBase · n(n+1)/2 (1→10, 2→30, 3→60...). */
  lineClearBase: 10,
  /** Mỗi bậc combo cộng thêm 50% điểm xoá dòng. */
  comboStep: 0.5,
  /** Số nước không xoá dòng tối đa mà combo vẫn được giữ. */
  comboGraceMoves: 3,
  /** Thưởng khi dọn sạch bàn (luật v1). */
  boardClearBonus: 300,
} as const

/** Luật v2: dọn sạch bàn liên tiếp (lần sau trong vòng `chainWindowMoves` nước) nhân thưởng ×2, ×3… tối đa ×maxChain. */
export const PERFECT_CLEAR_CHAIN_RULES = {
  baseBonus: 500,
  /** Dọn sạch 2 nước liền nhau là không thể (khối ≤ 5 ô, một dòng 8 ô) → tính "liên tiếp" trong 3 khay. */
  chainWindowMoves: 9,
  maxChain: 5,
} as const

/**
 * Chuỗi dọn sạch bàn sau một nước. `movesSinceBoardClear` = số nước đã đặt kể từ lần dọn sạch gần nhất
 * (undefined = chưa dọn lần nào). Quá cửa sổ mà không dọn → chuỗi về 0.
 */
export function nextPerfectChain(current: { perfectChain?: number; movesSinceBoardClear?: number }, boardCleared: boolean) {
  const gap = current.movesSinceBoardClear === undefined ? Infinity : current.movesSinceBoardClear + 1
  const inWindow = gap <= PERFECT_CLEAR_CHAIN_RULES.chainWindowMoves
  if (boardCleared) return { perfectChain: inWindow ? (current.perfectChain ?? 0) + 1 : 1, movesSinceBoardClear: 0 }
  // Chặn trên như movesSinceClear để số không tăng vô hạn trong save.
  const moves = current.movesSinceBoardClear === undefined ? undefined : Math.min(gap, PERFECT_CLEAR_CHAIN_RULES.chainWindowMoves + 1)
  return { perfectChain: inWindow ? (current.perfectChain ?? 0) : 0, movesSinceBoardClear: moves }
}

/** Thưởng dọn sạch bàn theo chuỗi (luật v2): 500, 1.000, 1.500… tối đa 2.500. */
export function perfectClearBonus(chain: number): number {
  return PERFECT_CLEAR_CHAIN_RULES.baseBonus * Math.min(Math.max(1, chain), PERFECT_CLEAR_CHAIN_RULES.maxChain)
}

export function lineClearPoints(linesCleared: number): number {
  return (SCORING_RULES.lineClearBase * linesCleared * (linesCleared + 1)) / 2
}

/** combo 0/1 → x1, combo 2 → x1.5, combo 3 → x2... */
export function comboMultiplier(combo: number): number {
  return 1 + SCORING_RULES.comboStep * Math.max(0, combo - 1)
}

export function nextComboState(current: { combo: number; movesSinceClear: number }, linesCleared: number) {
  if (linesCleared > 0) return { combo: current.combo + 1, movesSinceClear: 0 }
  // Chặn trên để số không tăng vô hạn trong save.
  const movesSinceClear = Math.min(current.movesSinceClear + 1, SCORING_RULES.comboGraceMoves + 1)
  return { combo: movesSinceClear > SCORING_RULES.comboGraceMoves ? 0 : current.combo, movesSinceClear }
}

/** `perfectChain` chỉ có ở luật v2 (chuỗi dọn sạch bàn sau nước này); thiếu = thưởng cố định luật v1. */
export function scoreForMove(move: { placedCellCount: number; linesCleared: number; combo: number; boardCleared: boolean; perfectChain?: number }): number {
  const placed = move.placedCellCount * SCORING_RULES.pointsPerPlacedCell
  const lines = Math.round(lineClearPoints(move.linesCleared) * comboMultiplier(move.combo))
  if (!move.boardCleared) return placed + lines
  return placed + lines + (move.perfectChain === undefined ? SCORING_RULES.boardClearBonus : perfectClearBonus(move.perfectChain))
}
