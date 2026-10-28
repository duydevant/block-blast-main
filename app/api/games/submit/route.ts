import { MAX_REQUEST_BODY_BYTES, submitRankedGameRequestSchema } from "@/server/games/ranked-game-request-schemas"
import { recordSubmittedRankedGame } from "@/server/games/record-submitted-ranked-game"
import { handleJsonRoute, readJsonBody, requireUid } from "@/server/http/authenticated-json-route"

/** Nộp log nước đi: server replay để tính điểm thật rồi cập nhật thống kê, streak, bảng xếp hạng. */
export async function POST(request: Request) {
  return handleJsonRoute(async () => {
    const uid = await requireUid(request)
    const body = await readJsonBody(request, submitRankedGameRequestSchema, MAX_REQUEST_BODY_BYTES)
    return recordSubmittedRankedGame(uid, body.gameId, body.actions)
  })
}
