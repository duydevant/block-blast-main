import { handleJsonRoute, readJsonBody, requireUid } from "@/server/http/authenticated-json-route"
import { deletePushSubscriptionRequestSchema, savePushSubscriptionRequestSchema } from "@/server/push/push-subscription-documents"
import { deletePushSubscription, savePushSubscription } from "@/server/push/push-subscription-store"

/** Bật (hoặc cập nhật uid/ngôn ngữ) nhắc nhở cho trình duyệt này. */
export async function POST(request: Request) {
  return handleJsonRoute(async () => {
    const uid = await requireUid(request)
    const body = await readJsonBody(request, savePushSubscriptionRequestSchema, 4096)
    return savePushSubscription(uid, body)
  })
}

/** Tắt nhắc nhở cho trình duyệt này. */
export async function DELETE(request: Request) {
  return handleJsonRoute(async () => {
    const uid = await requireUid(request)
    const body = await readJsonBody(request, deletePushSubscriptionRequestSchema, 2048)
    return deletePushSubscription(uid, body.endpoint)
  })
}
