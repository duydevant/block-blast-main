import { createECDH, randomBytes } from "node:crypto"

import { describe, expect, it } from "vitest"

import { EMPTY_DAILY_STREAK } from "@/modules/player-profile/player-profile-types"
import { dailyReminderPayload } from "@/modules/push/push-reminder-messages"
import { daysBetweenDayKeys } from "@/server/daily/daily-challenge-calendar"

import { type DailyReminderInput, planDailyReminder } from "./plan-daily-reminder"
import { isAllowedPushEndpoint, pushSubscriptionDocId, savePushSubscriptionRequestSchema } from "./push-subscription-documents"

const TODAY = "20261028"
const input = (overrides: Partial<DailyReminderInput> = {}): DailyReminderInput => ({
  today: TODAY,
  streak: EMPTY_DAILY_STREAK,
  playedToday: false,
  subscribedDay: null,
  lastSentDay: null,
  ...overrides,
})

describe("planDailyReminder", () => {
  it("warns about a streak that ends tonight", () => {
    const streak = { current: 4, best: 6, lastDailyDay: "20261027" }
    expect(planDailyReminder(input({ streak }))).toEqual({ kind: "streak", streak: 4 })
  })

  it("stays quiet once today's daily is started or played, or a reminder already went out", () => {
    const streak = { current: 4, best: 6, lastDailyDay: "20261027" }
    expect(planDailyReminder(input({ streak, playedToday: true }))).toBeNull()
    expect(planDailyReminder(input({ streak, lastSentDay: TODAY }))).toBeNull()
  })

  it("announces the daily challenge to recently active players only", () => {
    expect(planDailyReminder(input({ streak: { current: 0, best: 3, lastDailyDay: "20261024" } }))).toEqual({ kind: "daily", streak: 0 })
    expect(planDailyReminder(input({ subscribedDay: "20261026" }))).toEqual({ kind: "daily", streak: 0 })
    expect(planDailyReminder(input({ streak: { current: 0, best: 3, lastDailyDay: "20261001" }, subscribedDay: "20261001" }))).toBeNull()
  })
})

describe("daysBetweenDayKeys", () => {
  it("counts calendar days across month and year ends", () => {
    expect(daysBetweenDayKeys("20261028", "20261028")).toBe(0)
    expect(daysBetweenDayKeys("20261031", "20261101")).toBe(1)
    expect(daysBetweenDayKeys("20261225", "20270101")).toBe(7)
  })
})

describe("push subscriptions", () => {
  it("accepts only real push services over https", () => {
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true)
    expect(isAllowedPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/abc")).toBe(true)
    expect(isAllowedPushEndpoint("https://web.push.apple.com/QAbc")).toBe(true)
    expect(isAllowedPushEndpoint("https://wns2-par02p.notify.windows.com/w/?token=x")).toBe(true)
    expect(isAllowedPushEndpoint("http://fcm.googleapis.com/fcm/send/abc")).toBe(false)
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com.evil.test/x")).toBe(false)
    expect(isAllowedPushEndpoint("https://169.254.169.254/latest/meta-data")).toBe(false)
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com:8443/x")).toBe(false)
    expect(isAllowedPushEndpoint("not a url")).toBe(false)
  })

  it("validates the browser subscription shape and defaults the locale", () => {
    const keys = { p256dh: createECDH("prime256v1").generateKeys().toString("base64url"), auth: randomBytes(16).toString("base64url") }
    const subscription = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys }
    const parse = (overrides: Partial<typeof keys>) =>
      savePushSubscriptionRequestSchema.safeParse({ subscription: { ...subscription, keys: { ...keys, ...overrides } } }).success
    expect(savePushSubscriptionRequestSchema.parse({ subscription, locale: "fr" }).locale).toBe("en")
    expect(parse({})).toBe(true)
    expect(parse({ p256dh: "a b" })).toBe(false)
    expect(parse({ p256dh: randomBytes(65).fill(2, 0, 1).toString("base64url") })).toBe(false)
    expect(parse({ auth: randomBytes(8).toString("base64url") })).toBe(false)
  })

  it("keys one document per browser endpoint", () => {
    expect(pushSubscriptionDocId("https://fcm.googleapis.com/a")).toMatch(/^[0-9a-f]{64}$/)
    expect(pushSubscriptionDocId("https://fcm.googleapis.com/a")).not.toBe(pushSubscriptionDocId("https://fcm.googleapis.com/b"))
  })
})

describe("reminder messages", () => {
  it("fills in the streak and links to the daily challenge", () => {
    const payload = dailyReminderPayload("streak", "vi", 5, "https://example.com/play?daily=1")
    expect(payload.title).toContain("5")
    expect(payload).toMatchObject({ url: "https://example.com/play?daily=1", tag: "daily-reminder" })
  })
})
