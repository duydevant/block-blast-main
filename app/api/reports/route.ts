import { handleJsonRoute, readJsonBody, requireUid } from "@/server/http/authenticated-json-route"
import { reportReplay, reportRequestSchema } from "@/server/reports/report-store"

/** Báo cáo một replay nghi gian lận: `{ replayId, reason: "bot" | "other" }` (tối đa 5 / ngày). */
export async function POST(request: Request) {
  return handleJsonRoute(async () => {
    const uid = await requireUid(request)
    return reportReplay(uid, await readJsonBody(request, reportRequestSchema, 256))
  })
}
