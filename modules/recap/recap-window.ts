/**
 * Tổng kết năm chỉ mở từ 15/12 tới hết 15/01 năm sau (giờ VN). Thuần, dùng chung client (banner) + server (API).
 */
const VN_OFFSET_MS = 7 * 60 * 60 * 1000

/** Mốc 00:00 giờ VN của ngày (tháng 1-based) → epoch ms. */
const vnMidnight = (year: number, month: number, day: number) => Date.UTC(year, month - 1, day) - VN_OFFSET_MS

export function recapWindowFor(year: number): { startMs: number; endMs: number } {
  return { startMs: vnMidnight(year, 12, 15), endMs: vnMidnight(year + 1, 1, 16) }
}

export function isRecapOpen(year: number, nowMs: number): boolean {
  const { startMs, endMs } = recapWindowFor(year)
  return nowMs >= startMs && nowMs < endMs
}

/** Năm đang được tổng kết lúc này (15/12–31/12 → năm nay, 1/1–15/1 → năm trước); ngoài khoảng → null. */
export function currentRecapYear(nowMs: number): number | null {
  const vnYear = new Date(nowMs + VN_OFFSET_MS).getUTCFullYear()
  for (const year of [vnYear, vnYear - 1]) if (isRecapOpen(year, nowMs)) return year
  return null
}
