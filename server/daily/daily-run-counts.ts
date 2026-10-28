import { previousDayKey } from "./daily-challenge-calendar"

/**
 * Lượt daily có được tính (bảng ngày + streak) không:
 * - phải là lượt đã giữ chỗ lúc bắt đầu (claim.gameId khớp, chưa nộp xong),
 * - nộp chậm nhất hết ngày hôm sau (cho phép offline qua đêm); quá hạn thì chỉ cộng thống kê.
 */
export function dailyRunCounts(input: { claim: unknown; gameId: string; day: string; today: string }): boolean {
  if (input.day !== input.today && input.day !== previousDayKey(input.today)) return false
  const claim = input.claim as { gameId?: unknown; status?: unknown } | undefined
  return claim?.gameId === input.gameId && claim.status === "started"
}
