import { handleJsonRoute, requireUid } from "@/server/http/authenticated-json-route"
import { getOrCreateReferralInfo } from "@/server/progression/referral-store"

/** Mã mời của người chơi (tạo ở lần gọi đầu) + số bạn đã mời thành công. */
export async function GET(request: Request) {
  return handleJsonRoute(async () => getOrCreateReferralInfo(await requireUid(request)))
}
