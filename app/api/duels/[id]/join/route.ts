import { DUEL_ID_PATTERN } from "@/modules/duel/duel-types"
import { joinDuel } from "@/server/duels/duel-store"
import { HttpError, handleJsonRoute, requireUid } from "@/server/http/authenticated-json-route"

/** Vào phòng làm đối thủ → trận bắt đầu sau đếm ngược. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleJsonRoute(async () => {
    const uid = await requireUid(request)
    const { id } = await params
    if (!DUEL_ID_PATTERN.test(id)) throw new HttpError(404, "duel-not-found")
    return joinDuel(uid, id)
  })
}
