/** Luật điểm/combo của game. Chỉnh số ở đây rồi chạy `npm run balance` để xem tác động. */
export const SCORING_RULES = {
  pointsPerPlacedCell: 1,
  /** Điểm dòng đầu tiên; xoá n dòng một lúc = lineClearBase · n(n+1)/2 (1→10, 2→30, 3→60...). */
  lineClearBase: 10,
  /** Mỗi bậc combo cộng thêm 50% điểm xoá dòng. */
  comboStep: 0.5,
  /** Số nước không xoá dòng tối đa mà combo vẫn được giữ. */
  comboGraceMoves: 3,
  /** Thưởng khi dọn sạch bàn. */
  boardClearBonus: 300,
} as const

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

export function scoreForMove(move: { placedCellCount: number; linesCleared: number; combo: number; boardCleared: boolean }): number {
  const placed = move.placedCellCount * SCORING_RULES.pointsPerPlacedCell
  const lines = Math.round(lineClearPoints(move.linesCleared) * comboMultiplier(move.combo))
  return placed + lines + (move.boardCleared ? SCORING_RULES.boardClearBonus : 0)
}
