import "server-only"

import { type DocumentReference, type DocumentSnapshot, FieldPath, type QueryDocumentSnapshot } from "firebase-admin/firestore"
import webpush, { WebPushError } from "web-push"

import { Routes } from "@/lib/routes"
import { siteConfig } from "@/lib/site"
import { dailyReminderPayload } from "@/modules/push/push-reminder-messages"
import { dayKeyFor } from "@/server/daily/daily-challenge-calendar"
import { getAdminFirestore } from "@/server/firebase/firebase-admin-app"
import { DAILY_RESULTS_SUBCOLLECTION, parseStoredPlayer, USERS_COLLECTION } from "@/server/profile/stored-player-document"

import { planDailyReminder } from "./plan-daily-reminder"
import { PUSH_SUBSCRIPTIONS_COLLECTION, storedPushSubscriptionSchema } from "./push-subscription-documents"

/** Đọc đăng ký theo trang (thứ tự id cố định) để không giới hạn tổng số và không tải hết vào bộ nhớ. */
const PAGE_SIZE = 300
const READ_CHUNK = 100
const SEND_CONCURRENCY = 20
/** Tin quá 6 giờ chưa tới máy (máy tắt) thì bỏ — nhắc trễ sang hôm sau là sai. */
const PUSH_TTL_SECONDS = 6 * 60 * 60

export interface DailyRemindersResult {
  checked: number
  sent: number
  removed: number
  failed: number
}

function configureVapid() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) throw new Error("Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY")
  // Dịch vụ push cần địa chỉ liên hệ dạng mailto: hoặc https URL.
  const subject = process.env.VAPID_SUBJECT || (siteConfig.url.startsWith("https://") ? siteConfig.url : "mailto:noreply@example.com")
  webpush.setVapidDetails(subject, publicKey, privateKey)
}

async function getAllInChunks(refs: DocumentReference[]): Promise<DocumentSnapshot[]> {
  const db = getAdminFirestore()
  const snaps: DocumentSnapshot[] = []
  for (let i = 0; i < refs.length; i += READ_CHUNK) {
    snaps.push(...(await db.getAll(...refs.slice(i, i + READ_CHUNK))))
  }
  return snaps
}

/** Gửi nhắc nhở cho một trang đăng ký; lỗi từng máy chỉ được đếm, không làm dừng cả lần chạy. */
async function sendPage(docs: QueryDocumentSnapshot[], today: string, result: DailyRemindersResult): Promise<void> {
  const db = getAdminFirestore()
  const subscriptions = docs.flatMap((doc) => {
    const parsed = storedPushSubscriptionSchema.safeParse(doc.data())
    return parsed.success && parsed.data.lastSentDay !== today ? [{ ref: doc.ref, ...parsed.data }] : []
  })
  result.checked += subscriptions.length
  if (subscriptions.length === 0) return

  const uids = [...new Set(subscriptions.map((item) => item.uid))]
  const userRefs = uids.map((uid) => db.collection(USERS_COLLECTION).doc(uid))
  const users = await getAllInChunks(userRefs)
  const todayRuns = await getAllInChunks(userRefs.map((ref) => ref.collection(DAILY_RESULTS_SUBCOLLECTION).doc(today)))
  const byUid = new Map(uids.map((uid, index) => [uid, { player: parseStoredPlayer(users[index].data()), playedToday: todayRuns[index].exists }]))
  const url = new URL(Routes.PLAY_DAILY, siteConfig.url).toString()

  const send = async (item: (typeof subscriptions)[number]) => {
    const user = byUid.get(item.uid)
    if (!user) return
    const plan = planDailyReminder({
      today,
      streak: user.player.streak,
      playedToday: user.playedToday,
      subscribedDay: item.subscribedDay,
      lastSentDay: item.lastSentDay,
    })
    if (!plan) return
    const payload = dailyReminderPayload(plan.kind, item.locale, plan.streak, url)
    try {
      await webpush.sendNotification({ endpoint: item.endpoint, keys: item.keys }, JSON.stringify(payload), {
        TTL: PUSH_TTL_SECONDS,
        topic: "daily",
      })
      await item.ref.update({ lastSentDay: today })
      result.sent++
    } catch (error) {
      const expired = error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)
      if (expired) {
        await item.ref.delete().then(
          () => result.removed++,
          (deleteError: unknown) => console.warn("[push] delete expired subscription failed", deleteError)
        )
      } else {
        console.warn("[push] send failed", error instanceof WebPushError ? error.statusCode : error)
        result.failed++
      }
    }
  }

  for (let i = 0; i < subscriptions.length; i += SEND_CONCURRENCY) {
    await Promise.all(subscriptions.slice(i, i + SEND_CONCURRENCY).map(send))
  }
}

/**
 * Cron mỗi ngày (VD 19:00 giờ VN): máy nào chưa chơi daily hôm nay thì nhắc giữ chuỗi / báo thử thách mới.
 * Đánh dấu `lastSentDay` để chạy lại cùng ngày không gửi trùng; endpoint hết hạn (404/410) thì xoá.
 */
export async function sendDailyReminders(now = new Date()): Promise<DailyRemindersResult> {
  configureVapid()
  const collection = getAdminFirestore().collection(PUSH_SUBSCRIPTIONS_COLLECTION)
  const today = dayKeyFor(now)
  const result: DailyRemindersResult = { checked: 0, sent: 0, removed: 0, failed: 0 }

  let cursor: QueryDocumentSnapshot | null = null
  for (;;) {
    let query = collection.orderBy(FieldPath.documentId()).limit(PAGE_SIZE)
    if (cursor) query = query.startAfter(cursor)
    const page = await query.get()
    if (page.empty) break
    await sendPage(page.docs, today, result)
    if (page.size < PAGE_SIZE) break
    cursor = page.docs[page.docs.length - 1]
  }
  return result
}
