import { z } from "zod"

import { STASH_SLOT, TRAY_SIZE } from "./game-types"
import type { RecordedGameAction } from "./replay-recorded-game-actions"

const boardIndex = z.number().int().min(-8).max(15)

/**
 * Một nước đi trong log ván (nộp ván, nước đi đấu 1v1 trên RTDB). Toạ độ ngoài bàn để reducer tự từ chối;
 * ở đây chỉ chặn kiểu dữ liệu và giá trị vô lý.
 */
export const recordedActionSchema: z.ZodType<RecordedGameAction> = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("PLACE_PIECE"),
    slot: z.union([z.number().int().min(0).max(TRAY_SIZE - 1), z.literal(STASH_SLOT)]),
    row: boardIndex,
    col: boardIndex,
  }),
  z.object({ type: z.literal("STASH_PIECE"), slot: z.number().int().min(0).max(TRAY_SIZE - 1) }),
  z.object({ type: z.literal("REPLACE_TRAY") }),
  z.object({ type: z.literal("REVIVE") }),
])
