import { handleJsonRoute, readJsonBody, requireUid } from "@/server/http/authenticated-json-route"
import { getPlayerProfile, updatePlayerDisplayName, updateProfileRequestSchema } from "@/server/profile/player-profile-store"

export async function GET(request: Request) {
  return handleJsonRoute(async () => getPlayerProfile(await requireUid(request)))
}

/** Hiện chỉ cho đổi tên hiển thị; thống kê/ô cất chỉ server ghi khi nộp ván. */
export async function PATCH(request: Request) {
  return handleJsonRoute(async () => {
    const uid = await requireUid(request)
    const body = await readJsonBody(request, updateProfileRequestSchema, 1024)
    return updatePlayerDisplayName(uid, body.displayName)
  })
}
