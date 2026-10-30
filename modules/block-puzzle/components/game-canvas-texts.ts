import type { useI18n } from "@/lib/i18n"

import { STASH_SLOT, type GameState } from "../engine/game-types"
import { POWER_UP_RULES } from "../engine/power-up-rules"
import type { KeyboardCursor } from "../input/keyboard-placement-controller"
import type { MoveEffectTexts } from "../render/effects-timeline"

type I18n = ReturnType<typeof useI18n>

/** Nhãn vẽ trong canvas (ô "Cất"). */
export function holdLabels(i18n: I18n): { holdLabel: string; holdLockedLabel: string } {
  return { holdLabel: i18n.t("game.hold"), holdLockedLabel: i18n.t("game.holdLocked", { score: i18n.formatNumber(POWER_UP_RULES.stashUnlockScore) }) }
}

/** Chữ bay lên trên bàn sau một nước (điểm, combo, dọn sạch bàn). */
export function moveEffectTexts(game: GameState, i18n: I18n): MoveEffectTexts {
  const move = game.lastMove!
  return {
    points: i18n.t("game.points", { points: i18n.formatNumber(move.points) }),
    combo: move.combo >= 2 ? i18n.t("game.combo", { count: move.combo }) : null,
    // Luật v2: dọn sạch liên tiếp → "Dọn sạch ×n" (lần đầu vẫn là chữ cũ).
    boardClear: !move.boardCleared ? null
      : (move.perfectChain ?? 1) >= 2 ? i18n.t("game.boardClearChain", { count: move.perfectChain ?? 1 }) : i18n.t("game.boardClear"),
  }
}

/** Câu đọc cho trình đọc màn hình (vùng aria-live) sau một nước đi: điểm, số dòng xoá, hết ván. */
export function moveAnnouncement(game: GameState, i18n: I18n): string {
  const { t, formatNumber } = i18n
  const move = game.lastMove
  const parts: string[] = []
  if (move) {
    parts.push(t("gameSettings.kb.placed", { points: formatNumber(move.points), score: formatNumber(game.score) }))
    const lines = move.clearedRows.length + move.clearedCols.length
    if (lines > 0) parts.push(t("gameSettings.kb.cleared", { count: lines }))
  }
  if (game.isGameOver) parts.push(t("gameSettings.kb.gameOver", { score: formatNumber(game.score) }))
  return parts.join(" ")
}

/** Câu đọc khi di con trỏ bàn phím: khối nào, hàng/cột (đếm từ 1), đặt được không. */
export function cursorAnnouncement(cursor: KeyboardCursor, fits: boolean, i18n: I18n): string {
  const { t } = i18n
  const status = t(fits ? "gameSettings.kb.fits" : "gameSettings.kb.blocked")
  const position = { row: cursor.row + 1, col: cursor.col + 1, status }
  return cursor.slot === STASH_SLOT
    ? t("gameSettings.kb.selectedHold", position)
    : t("gameSettings.kb.selected", { ...position, slot: cursor.slot + 1 })
}
