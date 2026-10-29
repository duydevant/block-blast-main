import { previousDayKey } from "./daily-challenge-calendar"

/**
 * Lượt daily có được tính (mốc, bảng ngày, tổng tuần, streak) không:
 * - phải là một trong các lượt đã giữ chỗ lúc bắt đầu (gameId nằm trong `runs`) và chưa nộp,
 * - nộp chậm nhất hết ngày hôm sau (cho phép offline qua đêm); quá hạn thì chỉ cộng thống kê.
 */
export function dailyRunCounts(input: { runs: readonly string[]; finished: readonly string[]; gameId: string; day: string; today: string }): boolean {
  if (input.day !== input.today && input.day !== previousDayKey(input.today)) return false
  return input.runs.includes(input.gameId) && !input.finished.includes(input.gameId)
}
