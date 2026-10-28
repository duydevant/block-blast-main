import { DUEL_ID_PATTERN } from "@/modules/duel/duel-types"
import { setDuelReady, setDuelReadyRequestSchema } from "@/server/duels/duel-store"
import { HttpError, handleJsonRoute, readJsonBody, requireUid } from "@/server/http/authenticated-json-route"

/** Sẵn sàng / huỷ sẵn sàng ván tiếp trong cùng phòng; đủ hai người thì ván mới bắt đầu sau đếm ngược. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleJsonRoute(async () => {
    const uid = await requireUid(request)
    const { id } = await params
    if (!DUEL_ID_PATTERN.test(id)) throw new HttpError(404, "duel-not-found")
    const body = await readJsonBody(request, setDuelReadyRequestSchema, 256)
    return setDuelReady(uid, id, body.ready)
  })
}
