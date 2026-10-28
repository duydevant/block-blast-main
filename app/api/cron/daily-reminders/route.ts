import { timingSafeEqual } from "node:crypto"

import { HttpError, handleJsonRoute } from "@/server/http/authenticated-json-route"
import { sendDailyReminders } from "@/server/push/send-daily-reminders"

/** Chỉ cron (Vercel Cron hoặc crontab + curl) gọi được: `Authorization: Bearer <CRON_SECRET>`. */
function requireCronSecret(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) throw new HttpError(503, "cron-not-configured")
  const given = Buffer.from(request.headers.get("authorization") ?? "")
  const expected = Buffer.from(`Bearer ${secret}`)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new HttpError(401, "invalid-cron-secret")
}

async function runDailyReminders(request: Request) {
  return handleJsonRoute(async () => {
    requireCronSecret(request)
    return sendDailyReminders()
  })
}

/** Gửi theo trang + giới hạn song song; nới thời gian chạy cho hàng nghìn đăng ký (Vercel mặc định ngắn hơn). */
export const maxDuration = 60

/** Vercel Cron gọi bằng GET; crontab tự dựng có thể dùng POST. */
export const GET = runDailyReminders
export const POST = runDailyReminders
