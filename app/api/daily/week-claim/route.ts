import { claimDailyWeekReward, claimDailyWeekRequestSchema } from "@/server/daily/daily-week-rewards-store"
import { handleJsonRoute, readJsonBody, requireUid } from "@/server/http/authenticated-json-route"

/** Nhận rương sao hoặc thưởng hạng cuối tuần của thử thách. */
export async function POST(request: Request) {
  return handleJsonRoute(async () => {
    const uid = await requireUid(request)
    const body = await readJsonBody(request, claimDailyWeekRequestSchema, 1024)
    return claimDailyWeekReward(uid, body)
  })
}
