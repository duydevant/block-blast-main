import { gameHistoryQuerySchema, listGameHistory } from "@/server/games/game-history-store"
import { HttpError, handleJsonRoute, requireUid } from "@/server/http/authenticated-json-route"

/** Lịch sử ván của người gọi: `?mode=classic&cursor=<finishedAt>_<gameId>`. */
export async function GET(request: Request) {
  return handleJsonRoute(async () => {
    const uid = await requireUid(request)
    const params = new URL(request.url).searchParams
    const query = gameHistoryQuerySchema.safeParse({
      mode: params.get("mode") ?? undefined,
      cursor: params.get("cursor") ?? undefined,
    })
    if (!query.success) throw new HttpError(400, "invalid-query")
    return listGameHistory(uid, query.data)
  })
}
