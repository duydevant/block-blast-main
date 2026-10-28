import { createRankedGameSession } from "@/server/games/create-ranked-game-session"
import { startRankedGameRequestSchema } from "@/server/games/ranked-game-request-schemas"
import { handleJsonRoute, readJsonBody, requireUid } from "@/server/http/authenticated-json-route"

/** Cấp seed cho một ván tính điểm (classic) hoặc thử thách hằng ngày (daily). */
export async function POST(request: Request) {
  return handleJsonRoute(async () => {
    const uid = await requireUid(request)
    const body = await readJsonBody(request, startRankedGameRequestSchema, 1024)
    return createRankedGameSession(uid, body)
  })
}
