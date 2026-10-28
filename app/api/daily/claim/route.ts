import { claimDailyReward } from "@/server/daily/claim-daily-reward"
import { handleJsonRoute, requireUid } from "@/server/http/authenticated-json-route"

/** Nhận thưởng hoàn thành thử thách hôm nay (mỗi ngày một lần). */
export async function POST(request: Request) {
  return handleJsonRoute(async () => claimDailyReward(await requireUid(request)))
}
