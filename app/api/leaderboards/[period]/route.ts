import { isCategoryPeriod, isLeaderboardCategory } from "@/modules/leaderboard/leaderboard-categories"
import { LEADERBOARD_PERIODS, type LeaderboardPeriod } from "@/modules/leaderboard/leaderboard-types"
import { HttpError, handleJsonRoute, requireUid } from "@/server/http/authenticated-json-route"
import { getLeaderboard } from "@/server/leaderboards/leaderboard-store"

/** Bảng hiện hành của kỳ + hạng của người gọi; `?category=form|pure|combo|stars` (mặc định điểm). */
export async function GET(request: Request, { params }: { params: Promise<{ period: string }> }) {
  return handleJsonRoute(async () => {
    const uid = await requireUid(request)
    const { period } = await params
    const category = new URL(request.url).searchParams.get("category") ?? "score"
    if (!LEADERBOARD_PERIODS.includes(period as LeaderboardPeriod)) throw new HttpError(404, "unknown-leaderboard")
    if (!isLeaderboardCategory(category) || !isCategoryPeriod(category, period as LeaderboardPeriod)) throw new HttpError(404, "unknown-leaderboard")
    return getLeaderboard(period as LeaderboardPeriod, uid, category)
  })
}
