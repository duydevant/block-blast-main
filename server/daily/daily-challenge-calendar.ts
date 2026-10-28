import { createHmac } from "node:crypto"

/** Ranh giới ngày/tuần theo giờ Việt Nam (UTC+7, không có giờ mùa hè). */
const DAILY_UTC_OFFSET_MS = 7 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** Ngày theo giờ VN dưới dạng Date ở 00:00 UTC (chỉ dùng phần ngày tháng năm). */
function localDate(now: Date): Date {
  const shifted = new Date(now.getTime() + DAILY_UTC_OFFSET_MS)
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()))
}

function formatDayKey(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")
  return `${date.getUTCFullYear()}${month}${day}`
}

/** "20261027" — khoá ngày của thử thách hằng ngày. */
export function dayKeyFor(now: Date): string {
  return formatDayKey(localDate(now))
}

function parseDayKey(dayKey: string): Date {
  return new Date(Date.UTC(Number(dayKey.slice(0, 4)), Number(dayKey.slice(4, 6)) - 1, Number(dayKey.slice(6, 8))))
}

export function previousDayKey(dayKey: string): string {
  return formatDayKey(new Date(parseDayKey(dayKey).getTime() - DAY_MS))
}

/** Số ngày từ `from` tới `to` (cùng ngày = 0, `to` trước `from` thì âm). */
export function daysBetweenDayKeys(from: string, to: string): number {
  return Math.round((parseDayKey(to).getTime() - parseDayKey(from).getTime()) / DAY_MS)
}

/** Thời điểm (ms) bắt đầu tuần ISO kế tiếp = 00:00 thứ Hai giờ VN (sự kiện tuần kết thúc lúc này). */
export function nextWeekStartMs(now: Date): number {
  const date = localDate(now)
  const weekday = date.getUTCDay() || 7
  return date.getTime() + (8 - weekday) * DAY_MS - DAILY_UTC_OFFSET_MS
}

/** "2026-W44" — tuần ISO 8601 (bắt đầu thứ Hai) theo giờ VN. */
export function isoWeekKeyFor(now: Date): string {
  const date = localDate(now)
  const weekday = date.getUTCDay() || 7
  // Thứ Năm của tuần này quyết định năm ISO.
  const thursday = new Date(date.getTime() + (4 - weekday) * DAY_MS)
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1)
  const week = Math.ceil(((thursday.getTime() - yearStart) / DAY_MS + 1) / 7)
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`
}

/** Seed của ngày = HMAC(secret, ngày) → không đoán trước được seed ngày mai nếu không có secret. */
export function dailySeedFor(dayKey: string, secret: string): number {
  return createHmac("sha256", secret).update(`daily:${dayKey}`).digest().readUInt32BE(0)
}
