import { STASH_SLOT } from "./game-types"
import { recordedActionSchema } from "./recorded-action-schema"
import type { RecordedGameAction } from "./replay-recorded-game-actions"

/**
 * Nén một nước đi thành 1 số nguyên (< 2^14) để lưu replay gọn:
 * - PLACE_PIECE: 0 | slotCode<<2 | (row+8)<<4 | (col+8)<<9   (slotCode 0..2 = khay, 3 = ô cất)
 * - STASH_PIECE: 1 | slot<<2
 * - REPLACE_TRAY: 2
 * - REVIVE: 3
 * Giải mã xong vẫn qua `recordedActionSchema` — số rác không thành nước đi lạ.
 */
const OFFSET = 8
const STASH_CODE = 3

export function encodeAction(action: RecordedGameAction): number {
  switch (action.type) {
    case "PLACE_PIECE": {
      const slotCode = action.slot === STASH_SLOT ? STASH_CODE : action.slot
      return 0 | (slotCode << 2) | ((action.row + OFFSET) << 4) | ((action.col + OFFSET) << 9)
    }
    case "STASH_PIECE":
      return 1 | (action.slot << 2)
    case "REPLACE_TRAY":
      return 2
    case "REVIVE":
      return 3
  }
}

export function decodeAction(code: number): RecordedGameAction | null {
  if (!Number.isInteger(code) || code < 0 || code >= 1 << 14) return null
  const type = code & 3
  let raw: unknown
  if (type === 0) {
    const slotCode = (code >> 2) & 3
    raw = { type: "PLACE_PIECE", slot: slotCode === STASH_CODE ? STASH_SLOT : slotCode, row: ((code >> 4) & 31) - OFFSET, col: ((code >> 9) & 31) - OFFSET }
  } else if (type === 1) raw = { type: "STASH_PIECE", slot: code >> 2 }
  else raw = { type: type === 2 ? "REPLACE_TRAY" : "REVIVE" }
  // REPLACE/REVIVE không mang dữ liệu → bit thừa nghĩa là số bị sửa.
  if (type >= 2 && code !== type) return null
  const parsed = recordedActionSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

export function encodeActions(actions: readonly RecordedGameAction[]): number[] {
  return actions.map(encodeAction)
}

/** null nếu bất kỳ số nào không hợp lệ (cả replay coi như hỏng). */
export function decodeActions(codes: readonly unknown[]): RecordedGameAction[] | null {
  const actions: RecordedGameAction[] = []
  for (const code of codes) {
    const action = typeof code === "number" ? decodeAction(code) : null
    if (!action) return null
    actions.push(action)
  }
  return actions
}
