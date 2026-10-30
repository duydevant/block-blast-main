import { startArenaRun, startArenaRunSchema } from "@/server/arena/arena-run-store"
import { handleJsonRoute, readJsonBody, requireUid } from "@/server/http/authenticated-json-route"

/** Mở lượt Đấu trường `{ type, level }`: kiểm Bậc + xu, trừ phí, trả lượt mới. */
export async function POST(request: Request) {
  return handleJsonRoute(async () => {
    const uid = await requireUid(request)
    return startArenaRun(uid, await readJsonBody(request, startArenaRunSchema, 256))
  })
}
