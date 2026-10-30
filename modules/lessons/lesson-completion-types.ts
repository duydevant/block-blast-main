import { z } from "zod"

import { recordedActionSchema } from "@/modules/block-puzzle/engine/recorded-action-schema"

/** Bài học ngắn: lời giải vài nước; chặn log dài vô lý. */
export const MAX_LESSON_ACTIONS = 64

/** POST /api/lessons/complete */
export const completeLessonRequestSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,48}$/),
  actions: z.array(recordedActionSchema).min(1).max(MAX_LESSON_ACTIONS),
})

export type CompleteLessonRequest = z.infer<typeof completeLessonRequestSchema>

export interface CompleteLessonResponse {
  /** Xu vừa cộng (0 nếu đã qua bài trước đó). */
  coins: number
  alreadyDone: boolean
}
