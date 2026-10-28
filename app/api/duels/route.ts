import { createDuel } from "@/server/duels/duel-store"
import { handleJsonRoute, requireUid } from "@/server/http/authenticated-json-route"

/** Tạo phòng đấu 1v1 (mã 6 ký tự), chờ đối thủ vào. */
export async function POST(request: Request) {
  return handleJsonRoute(async () => createDuel(await requireUid(request)))
}
