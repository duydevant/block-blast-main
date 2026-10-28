import { getEventStatus } from "@/server/events/event-rewards-store"
import { handleJsonRoute, requireUid } from "@/server/http/authenticated-json-route"

/** Sự kiện tuần: mốc điểm, hạng, giờ kết thúc; tuần trước (thưởng hạng). */
export async function GET(request: Request) {
  return handleJsonRoute(async () => getEventStatus(await requireUid(request)))
}
