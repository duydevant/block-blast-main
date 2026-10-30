import { handleJsonRoute } from "@/server/http/authenticated-json-route"
import { requireCronSecret } from "@/server/http/require-cron-secret"
import { sendDailyReminders } from "@/server/push/send-daily-reminders"

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
