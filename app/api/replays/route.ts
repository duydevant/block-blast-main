import { z } from "zod"

import { recordedActionSchema } from "@/modules/block-puzzle/engine/recorded-action-schema"
import { MAX_RECORDED_ACTIONS } from "@/modules/block-puzzle/engine/replay-recorded-game-actions"
import { gameIdSchema, MAX_REQUEST_BODY_BYTES } from "@/server/games/ranked-game-request-schemas"
import { handleJsonRoute, readJsonBody, requireUid } from "@/server/http/authenticated-json-route"
import { saveOwnGameReplay } from "@/server/replays/replay-store"

const bodySchema = z.object({ gameId: gameIdSchema, actions: z.array(recordedActionSchema).max(MAX_RECORDED_ACTIONS) })

/** Lưu replay một ván đã nộp của chính mình (server replay lại, điểm phải khớp) → `{ replayId }`. */
export async function POST(request: Request) {
  return handleJsonRoute(async () => {
    const uid = await requireUid(request)
    const body = await readJsonBody(request, bodySchema, MAX_REQUEST_BODY_BYTES)
    return saveOwnGameReplay(uid, body.gameId, body.actions)
  })
}
