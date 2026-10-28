import { getDailyStatus } from "@/server/daily/daily-status-store"
import { handleJsonRoute, requireUid } from "@/server/http/authenticated-json-route"

/** Trạng thái thử thách hôm nay: đã chơi chưa, điểm, chuỗi ngày. */
export async function GET(request: Request) {
  return handleJsonRoute(async () => getDailyStatus(await requireUid(request)))
}
