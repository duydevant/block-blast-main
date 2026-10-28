import { z } from "zod"

import { createChallengeFromSession } from "@/server/challenges/challenge-store"
import { gameIdSchema, MAX_REQUEST_BODY_BYTES, submitRankedGameRequestSchema } from "@/server/games/ranked-game-request-schemas"
import { handleJsonRoute, readJsonBody, requireUid } from "@/server/http/authenticated-json-route"

/** `actions` chỉ cần khi ván chưa nộp: server nộp luôn rồi mới tạo thách đấu từ điểm đã kiểm tra. */
const createChallengeRequestSchema = z.object({
  gameId: gameIdSchema,
  actions: submitRankedGameRequestSchema.shape.actions.optional(),
})

/** Tạo link thách đấu từ một ván classic của chính mình. */
export async function POST(request: Request) {
  return handleJsonRoute(async () => {
    const uid = await requireUid(request)
    const body = await readJsonBody(request, createChallengeRequestSchema, MAX_REQUEST_BODY_BYTES)
    return createChallengeFromSession(uid, body.gameId, body.actions)
  })
}
