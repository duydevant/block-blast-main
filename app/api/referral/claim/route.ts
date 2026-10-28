import { handleJsonRoute, readJsonBody, requireUid } from "@/server/http/authenticated-json-route"
import { claimReferralCode, claimReferralRequestSchema } from "@/server/progression/referral-store"

/** Người mới nhập mã mời (từ link `/?ref=`); quà phát khi họ chơi đủ ván. */
export async function POST(request: Request) {
  return handleJsonRoute(async () => {
    const uid = await requireUid(request)
    const body = await readJsonBody(request, claimReferralRequestSchema, 1024)
    return claimReferralCode(uid, body.code)
  })
}
