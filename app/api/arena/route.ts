import { getArenaStatus } from "@/server/arena/arena-run-store"
import { handleJsonRoute, requireUid } from "@/server/http/authenticated-json-route"

/** Lượt Đấu trường đang mở của người gọi (null = không có). */
export async function GET(request: Request) {
  return handleJsonRoute(async () => getArenaStatus(await requireUid(request)))
}
