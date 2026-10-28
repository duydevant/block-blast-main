import { LEADERBOARD_PERIODS, type LeaderboardPeriod } from "@/modules/leaderboard/leaderboard-types"
import { HttpError, handleJsonRoute, requireUid } from "@/server/http/authenticated-json-route"
import { getLeaderboard } from "@/server/leaderboards/leaderboard-store"

/** Bảng hiện hành của kỳ `daily` | `weekly` | `alltime` + hạng của người gọi. */
export async function GET(request: Request, { params }: { params: Promise<{ period: string }> }) {
  return handleJsonRoute(async () => {
    const uid = await requireUid(request)
    const { period } = await params
    if (!LEADERBOARD_PERIODS.includes(period as LeaderboardPeriod)) throw new HttpError(404, "unknown-leaderboard")
    return getLeaderboard(period as LeaderboardPeriod, uid)
  })
}
