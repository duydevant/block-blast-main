import { handleJsonRoute, requireUid } from "@/server/http/authenticated-json-route"
import { getSeasonStatus } from "@/server/seasons/season-store"

/** Mùa hiện tại (số ván, Bậc cao nhất, nhiệm vụ mùa) + mùa trước (hạng, thưởng, huy hiệu). */
export async function GET(request: Request) {
  return handleJsonRoute(async () => getSeasonStatus(await requireUid(request)))
}
