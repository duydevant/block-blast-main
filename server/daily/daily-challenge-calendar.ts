import { createHmac } from "node:crypto"

export { dayKeyFor, daysBetweenDayKeys, isoWeekKeyFor, nextWeekStartMs, previousDayKey } from "@/lib/vn-calendar"

/** Seed của ngày = HMAC(secret, ngày) → không đoán trước được seed ngày mai nếu không có secret. */
export function dailySeedFor(dayKey: string, secret: string): number {
  return createHmac("sha256", secret).update(`daily:${dayKey}`).digest().readUInt32BE(0)
}
