import { handleJsonRoute, readJsonBody, requireUid } from "@/server/http/authenticated-json-route"
import { buyThemeRequestSchema, buyThemeWithCoins } from "@/server/progression/theme-shop-store"

/** Mua theme bằng xu; trả profile mới (xu + theme đã mở). */
export async function POST(request: Request) {
  return handleJsonRoute(async () => {
    const uid = await requireUid(request)
    const body = await readJsonBody(request, buyThemeRequestSchema, 1024)
    return buyThemeWithCoins(uid, body.themeId)
  })
}
