import { startRankedMatchRequestSchema } from "@/server/games/ranked-game-request-schemas"
import { handleJsonRoute, readJsonBody, requireUid } from "@/server/http/authenticated-json-route"
import { startRankedMatch } from "@/server/ranked/start-ranked-match"

/** Mở trận xếp hạng với bóng ma cùng trình độ → session `mode: "ranked"` + bóng ma để phát lại. */
export async function POST(request: Request) {
  return handleJsonRoute(async () => {
    const uid = await requireUid(request)
    const body = await readJsonBody(request, startRankedMatchRequestSchema, 256)
    return startRankedMatch(uid, body.rulesVersion)
  })
}
