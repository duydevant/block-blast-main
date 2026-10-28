import { createDuel, createDuelRequestSchema } from "@/server/duels/duel-store"
import { handleJsonRoute, readJsonBody, requireUid } from "@/server/http/authenticated-json-route"

/** Tạo phòng đấu 1v1 (hoặc đấu lại sau trận `rematchOf`). */
export async function POST(request: Request) {
  return handleJsonRoute(async () => {
    const uid = await requireUid(request)
    const body = await readJsonBody(request, createDuelRequestSchema, 1024)
    return createDuel(uid, body.rematchOf)
  })
}
