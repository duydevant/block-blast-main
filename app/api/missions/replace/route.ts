import { z } from "zod"

import { DAILY_MISSION_COUNT } from "@/modules/progression/daily-mission-catalog"
import { handleJsonRoute, readJsonBody, requireUid } from "@/server/http/authenticated-json-route"
import { replaceDailyMission } from "@/server/progression/replace-daily-mission"

const bodySchema = z.object({ slot: z.number().int().min(0).max(DAILY_MISSION_COUNT - 1) })

/** Đổi một nhiệm vụ hôm nay (1 lần/ngày): `{ slot: 0 | 1 | 2 }` → danh sách nhiệm vụ mới. */
export async function POST(request: Request) {
  return handleJsonRoute(async () => {
    const uid = await requireUid(request)
    const { slot } = await readJsonBody(request, bodySchema, 256)
    return replaceDailyMission(uid, slot)
  })
}
