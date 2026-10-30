import "server-only"

import { timingSafeEqual } from "node:crypto"

import { HttpError } from "./authenticated-json-route"

/** Chỉ cron (Vercel Cron hoặc crontab + curl) gọi được: `Authorization: Bearer <CRON_SECRET>` (so sánh timing-safe). */
export function requireCronSecret(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) throw new HttpError(503, "cron-not-configured")
  const given = Buffer.from(request.headers.get("authorization") ?? "")
  const expected = Buffer.from(`Bearer ${secret}`)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new HttpError(401, "invalid-cron-secret")
}
