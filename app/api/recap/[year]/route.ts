import { isRecapOpen } from "@/modules/recap/recap-window"
import { HttpError, handleJsonRoute, requireUid } from "@/server/http/authenticated-json-route"
import { getYearRecap } from "@/server/recap/year-recap-store"

/** Tổng kết năm của người gọi; chỉ mở 15/12 → 15/01 năm sau (giờ VN), ngoài khoảng → 404. */
export async function GET(request: Request, { params }: { params: Promise<{ year: string }> }) {
  return handleJsonRoute(async () => {
    const uid = await requireUid(request)
    const year = Number((await params).year)
    if (!Number.isInteger(year) || !isRecapOpen(year, Date.now())) throw new HttpError(404, "recap-closed")
    return getYearRecap(uid, year)
  })
}
