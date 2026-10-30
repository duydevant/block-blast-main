import { handleJsonRoute } from "@/server/http/authenticated-json-route"
import { requireCronSecret } from "@/server/http/require-cron-secret"
import { rebuildReplacedLeaderboards } from "@/server/leaderboards/rebuild-replaced-leaderboards"

async function runRebuild(request: Request) {
  return handleJsonRoute(async () => {
    requireCronSecret(request)
    return rebuildReplacedLeaderboards()
  })
}

/** Dựng lại top bảng phong độ hằng ngày (Vercel Cron GET; crontab có thể POST). */
export const GET = runRebuild
export const POST = runRebuild
