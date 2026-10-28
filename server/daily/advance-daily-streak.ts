import type { DailyStreak } from "@/modules/player-profile/player-profile-types"

import { previousDayKey } from "./daily-challenge-calendar"

/** Hoàn thành thử thách ngày `day`: nối chuỗi nếu hôm qua có chơi, không thì bắt đầu lại từ 1. */
export function advanceDailyStreak(streak: DailyStreak, day: string): DailyStreak {
  // Lượt của ngày cũ nộp muộn (sau khi đã có lượt ngày mới hơn) không được kéo chuỗi lùi lại.
  if (streak.lastDailyDay !== null && day <= streak.lastDailyDay) return streak
  const current = streak.lastDailyDay === previousDayKey(day) ? streak.current + 1 : 1
  return { current, best: Math.max(streak.best, current), lastDailyDay: day }
}

/** Chuỗi đang hiển thị: còn sống nếu đã chơi hôm nay hoặc hôm qua (hôm nay chưa chơi vẫn kịp giữ). */
export function effectiveDailyStreak(streak: DailyStreak, today: string): DailyStreak {
  const alive = streak.lastDailyDay === today || streak.lastDailyDay === previousDayKey(today)
  return alive ? streak : { ...streak, current: 0 }
}
