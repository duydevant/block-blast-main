import { createHash } from "node:crypto"

import { z } from "zod"

import { locales } from "@/lib/i18n-locales"

/** pushSubscriptions/{sha256(endpoint)}: mỗi trình duyệt/máy một doc, gắn uid đang đăng nhập. */
export const PUSH_SUBSCRIPTIONS_COLLECTION = "pushSubscriptions"

/**
 * Server sẽ POST tới endpoint này khi gửi tin → chỉ nhận host của dịch vụ push thật (chặn SSRF).
 * Chrome/Edge(Chromium)/Opera/Samsung: FCM; Firefox: Mozilla autopush; Safari: Apple; Edge cũ: WNS.
 */
const PUSH_SERVICE_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^web\.push\.apple\.com$/, /^[a-z0-9-]+\.notify\.windows\.com$/]

export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint)
    return url.protocol === "https:" && url.port === "" && PUSH_SERVICE_HOSTS.some((host) => host.test(url.hostname))
  } catch {
    return false
  }
}

/** Chuỗi base64url giải mã ra đúng `bytes` byte (khoá sai độ dài thì web-push không mã hoá được → không bao giờ gửi được). */
const base64UrlBytes = (bytes: number, check: (decoded: Buffer) => boolean = () => true) =>
  z
    .string()
    .max(128)
    .regex(/^[A-Za-z0-9_-]+={0,2}$/)
    .refine((value) => {
      const decoded = Buffer.from(value, "base64url")
      return decoded.length === bytes && check(decoded)
    }, "invalid-push-key")

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().max(1024).refine(isAllowedPushEndpoint, "unsupported-push-endpoint"),
  // p256dh: khoá công khai P-256 dạng không nén (65 byte, bắt đầu 0x04); auth: 16 byte.
  keys: z.object({ p256dh: base64UrlBytes(65, (decoded) => decoded[0] === 0x04), auth: base64UrlBytes(16) }),
})

export type StoredPushKeys = z.infer<typeof pushSubscriptionSchema>["keys"]

export const savePushSubscriptionRequestSchema = z.object({
  subscription: pushSubscriptionSchema,
  locale: z.enum(locales).catch("en"),
})

export const deletePushSubscriptionRequestSchema = z.object({ endpoint: z.string().max(1024) })

/** Một tài khoản bật nhắc nhở trên tối đa từng ấy trình duyệt; vượt thì bỏ đăng ký cũ nhất. */
export const MAX_PUSH_SUBSCRIPTIONS_PER_USER = 5

export const storedPushSubscriptionSchema = z.object({
  uid: z.string(),
  endpoint: z.string(),
  keys: pushSubscriptionSchema.shape.keys,
  locale: z.enum(locales).catch("en"),
  subscribedDay: z.string().regex(/^\d{8}$/).nullable().catch(null),
  lastSentDay: z.string().regex(/^\d{8}$/).nullable().catch(null),
})

export function pushSubscriptionDocId(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("hex")
}
