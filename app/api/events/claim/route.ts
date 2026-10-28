import { claimEventReward, claimEventRewardRequestSchema } from "@/server/events/event-rewards-store"
import { handleJsonRoute, readJsonBody, requireUid } from "@/server/http/authenticated-json-route"

/** Nhận thưởng mốc điểm hoặc thưởng hạng cuối tuần của sự kiện. */
export async function POST(request: Request) {
  return handleJsonRoute(async () => {
    const uid = await requireUid(request)
    const body = await readJsonBody(request, claimEventRewardRequestSchema, 1024)
    return claimEventReward(uid, body)
  })
}
