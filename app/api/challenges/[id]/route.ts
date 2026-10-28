import { CHALLENGE_ID_PATTERN } from "@/modules/challenge/challenge-types"
import { getChallengeView } from "@/server/challenges/challenge-store"
import { HttpError, handleJsonRoute } from "@/server/http/authenticated-json-route"

/** Công khai (không cần đăng nhập): người thách, điểm cần vượt, top kết quả. Không trả seed/uid. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleJsonRoute(async () => {
    const { id } = await params
    const view = CHALLENGE_ID_PATTERN.test(id) ? await getChallengeView(id) : null
    if (!view) throw new HttpError(404, "challenge-not-found")
    return view
  })
}
