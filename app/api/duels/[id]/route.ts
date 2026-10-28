import { DUEL_ID_PATTERN } from "@/modules/duel/duel-types"
import { getDuel } from "@/server/duels/duel-store"
import { HttpError, handleJsonRoute } from "@/server/http/authenticated-json-route"

/** Trạng thái trận (công khai: chỉ tên, điểm đã kiểm tra, người thắng). Gọi sau hạn chót thì chốt trận. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleJsonRoute(async () => {
    const { id } = await params
    if (!DUEL_ID_PATTERN.test(id)) throw new HttpError(404, "duel-not-found")
    return getDuel(id)
  })
}
