import { DUEL_ID_PATTERN } from "@/modules/duel/duel-types"
import { HttpError, handleJsonRoute, requireUid } from "@/server/http/authenticated-json-route"
import { settleDuelRound } from "@/server/duels/settle-duel-round"

/**
 * Chấm ván đang chơi từ nước đi trên RTDB: client gọi khi mình hết nước / hết giờ / vừa vượt điểm đối thủ đã dừng.
 * Đã rõ thắng thua thì chốt; chưa thì chỉ trả trạng thái.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleJsonRoute(async () => {
    const uid = await requireUid(request)
    const { id } = await params
    if (!DUEL_ID_PATTERN.test(id)) throw new HttpError(404, "duel-not-found")
    return { ...(await settleDuelRound(id, uid)), serverNow: Date.now() }
  })
}
