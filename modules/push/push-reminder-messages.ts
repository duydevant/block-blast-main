import type { Locale } from "@/lib/i18n-locales"

/** Loại tin nhắc: giữ chuỗi (đang có chuỗi, hôm nay chưa chơi) hoặc báo thử thách mới. */
export type DailyReminderKind = "streak" | "daily"

export interface PushReminderPayload {
  title: string
  body: string
  /** Trang mở khi bấm thông báo. */
  url: string
  /** Cùng tag thì tin mới thay tin cũ trên máy. */
  tag: string
}

const MESSAGES: Record<Locale, Record<DailyReminderKind, { title: string; body: string }>> = {
  en: {
    streak: { title: "Keep your {streak}-day streak!", body: "Play today's daily challenge before midnight (GMT+7) to keep it going." },
    daily: { title: "Today's challenge is ready", body: "Same blocks for everyone today — how high can you score?" },
  },
  vi: {
    streak: { title: "Giữ chuỗi {streak} ngày nhé!", body: "Chơi thử thách hôm nay trước nửa đêm để không mất chuỗi." },
    daily: { title: "Thử thách hôm nay đã có", body: "Cùng một chuỗi khối cho mọi người — bạn được bao nhiêu điểm?" },
  },
}

export function dailyReminderPayload(kind: DailyReminderKind, locale: Locale, streak: number, url: string): PushReminderPayload {
  const message = MESSAGES[locale][kind]
  return { title: message.title.replace("{streak}", String(streak)), body: message.body, url, tag: "daily-reminder" }
}
