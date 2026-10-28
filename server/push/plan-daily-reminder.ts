import type { DailyStreak } from "@/modules/player-profile/player-profile-types"
import type { DailyReminderKind } from "@/modules/push/push-reminder-messages"
import { daysBetweenDayKeys, previousDayKey } from "@/server/daily/daily-challenge-calendar"

/** Người chơi vẫn được nhắc "thử thách mới" nếu chơi daily hoặc bật nhắc nhở trong từng ấy ngày gần đây. */
export const ACTIVE_PLAYER_WINDOW_DAYS = 7

export interface DailyReminderInput {
  today: string
  streak: DailyStreak
  /** Đã có lượt daily hôm nay (đang chơi hoặc xong) → không nhắc. */
  playedToday: boolean
  /** Ngày bật nhắc nhở trên máy này ("YYYYMMDD"). */
  subscribedDay: string | null
  /** Ngày cuối cùng đã gửi tin cho máy này. */
  lastSentDay: string | null
}

export type DailyReminderPlan = { kind: DailyReminderKind; streak: number } | null

/** Quyết định gửi tin gì cho một máy hôm nay (thuần, không I/O). Mỗi máy tối đa 1 tin/ngày. */
export function planDailyReminder(input: DailyReminderInput): DailyReminderPlan {
  const { today, streak } = input
  if (input.playedToday || input.lastSentDay === today) return null
  // Chuỗi còn sống nhưng hôm nay chưa chơi → sắp mất lúc nửa đêm.
  if (streak.current > 0 && streak.lastDailyDay === previousDayKey(today)) return { kind: "streak", streak: streak.current }

  const recent = (day: string | null) => day !== null && daysBetweenDayKeys(day, today) <= ACTIVE_PLAYER_WINDOW_DAYS
  // Người đã bỏ game lâu thì thôi, không làm phiền mỗi ngày.
  return recent(streak.lastDailyDay) || recent(input.subscribedDay) ? { kind: "daily", streak: 0 } : null
}
