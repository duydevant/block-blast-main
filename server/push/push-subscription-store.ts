import "server-only"

import { FieldValue } from "firebase-admin/firestore"
import type { z } from "zod"

import { dayKeyFor } from "@/server/daily/daily-challenge-calendar"
import { getAdminFirestore } from "@/server/firebase/firebase-admin-app"

import {
  MAX_PUSH_SUBSCRIPTIONS_PER_USER,
  PUSH_SUBSCRIPTIONS_COLLECTION,
  pushSubscriptionDocId,
  type savePushSubscriptionRequestSchema,
} from "./push-subscription-documents"

type SaveRequest = z.infer<typeof savePushSubscriptionRequestSchema>

/**
 * Lưu/cập nhật đăng ký nhắc nhở của máy này cho uid hiện tại. Gọi lại khi đổi tài khoản/ngôn ngữ
 * thì chỉ cập nhật uid/locale, giữ ngày bật và ngày gửi gần nhất.
 */
export async function savePushSubscription(uid: string, request: SaveRequest): Promise<{ ok: true }> {
  const { endpoint, keys } = request.subscription
  const collection = getAdminFirestore().collection(PUSH_SUBSCRIPTIONS_COLLECTION)
  const ref = collection.doc(pushSubscriptionDocId(endpoint))
  const now = FieldValue.serverTimestamp()
  const existing = await ref.get()
  if (!existing.exists) await dropOldestSubscriptionsOverLimit(uid)
  await ref.set(
    {
      uid,
      endpoint,
      keys,
      locale: request.locale,
      updatedAt: now,
      ...(existing.exists ? {} : { createdAt: now, subscribedDay: dayKeyFor(new Date()), lastSentDay: null }),
    },
    { merge: true }
  )
  return { ok: true }
}

/** Giữ mỗi uid tối đa MAX-1 đăng ký trước khi thêm cái mới (chặn một tài khoản đẻ vô hạn đăng ký). */
async function dropOldestSubscriptionsOverLimit(uid: string): Promise<void> {
  const owned = await getAdminFirestore().collection(PUSH_SUBSCRIPTIONS_COLLECTION).where("uid", "==", uid).get()
  const extra = owned.size - (MAX_PUSH_SUBSCRIPTIONS_PER_USER - 1)
  if (extra <= 0) return
  const oldestFirst = [...owned.docs].sort((a, b) => (a.get("createdAt")?.toMillis?.() ?? 0) - (b.get("createdAt")?.toMillis?.() ?? 0))
  await Promise.all(oldestFirst.slice(0, extra).map((doc) => doc.ref.delete()))
}

/** Tắt nhắc nhở: chỉ xoá được đăng ký đang gắn với chính uid này. */
export async function deletePushSubscription(uid: string, endpoint: string): Promise<{ ok: true }> {
  const ref = getAdminFirestore().collection(PUSH_SUBSCRIPTIONS_COLLECTION).doc(pushSubscriptionDocId(endpoint))
  const snap = await ref.get()
  if (snap.exists && snap.get("uid") === uid) await ref.delete()
  return { ok: true }
}
