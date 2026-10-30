import { handleJsonRoute, readJsonBody, requireUid } from "@/server/http/authenticated-json-route"
import { claimSeasonReward, seasonClaimRequestSchema } from "@/server/seasons/season-store"

/** Nhận thưởng nhiệm vụ mùa `{ kind: "mission", season, missionId }` hoặc thưởng hạng mùa trước `{ kind: "rank" }`. */
export async function POST(request: Request) {
  return handleJsonRoute(async () => {
    const uid = await requireUid(request)
    return claimSeasonReward(uid, await readJsonBody(request, seasonClaimRequestSchema, 256))
  })
}
