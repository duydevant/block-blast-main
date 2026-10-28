"use client"

import { useEffect, useState } from "react"

/** Ngày của thử thách đổi lúc 00:00 giờ VN (UTC+7) = 17:00 UTC. */
const RESET_UTC_HOUR = 17
const DAY_MS = 24 * 60 * 60 * 1000

export function msUntilNextDailyReset(now: number): number {
  const date = new Date(now)
  let reset = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), RESET_UTC_HOUR)
  if (reset <= now) reset += DAY_MS
  return reset - now
}

/** "06:12:30". */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`
}

/** Đếm ngược tới lúc đổi bộ khối ngày; null trước khi mount (tránh lệch HTML server/client). */
export function useDailyResetCountdown(): string | null {
  const [remaining, setRemaining] = useState<string | null>(null)
  useEffect(() => {
    const tick = () => setRemaining(formatCountdown(msUntilNextDailyReset(Date.now())))
    const first = window.setTimeout(tick, 0)
    const timer = window.setInterval(tick, 1000)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(timer)
    }
  }, [])
  return remaining
}
