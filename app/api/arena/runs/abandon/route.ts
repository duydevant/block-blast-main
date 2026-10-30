import { abandonArenaRun } from "@/server/arena/arena-run-store"
import { handleJsonRoute, requireUid } from "@/server/http/authenticated-json-route"

/** Bỏ lượt đang mở (không hoàn xu). */
export async function POST(request: Request) {
  return handleJsonRoute(async () => abandonArenaRun(await requireUid(request)))
}
