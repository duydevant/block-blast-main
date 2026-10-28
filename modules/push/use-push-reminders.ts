"use client"

import { useCallback, useEffect, useState } from "react"

import { fetchJsonWithFirebaseIdToken } from "@/lib/firebase/fetch-json-with-firebase-id-token"
import { useI18n } from "@/lib/i18n"
import { ApiRoutes } from "@/lib/routes"
import { useSignedInUid } from "@/modules/player-profile/use-player-profile-query"
import { isIosDevice, isStandaloneDisplay, PWA_ENABLED, registerAppServiceWorker } from "@/modules/pwa/pwa-environment"

/**
 * - unsupported: trình duyệt/bản dev không có push
 * - needs-install: iPhone/iPad phải cài app ra màn hình chính trước
 * - denied: người chơi đã chặn thông báo cho site
 */
export type PushReminderStatus = "loading" | "unsupported" | "needs-install" | "denied" | "off" | "on"

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""

function isPushSupported(): boolean {
  return PWA_ENABLED && VAPID_PUBLIC_KEY !== "" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
}

/** Khoá VAPID dạng base64url → bytes cho pushManager.subscribe. */
function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/")
  const raw = window.atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

/** Đã đồng bộ (endpoint|uid|locale) nào trong phiên này — nhiều chỗ dùng hook không gửi lại trùng. */
let lastSyncedKey = ""

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration()
  return (await registration?.pushManager.getSubscription()) ?? null
}

/** Bật/tắt nhắc nhở hằng ngày cho trình duyệt này; tự đồng bộ uid/ngôn ngữ lên server khi đã bật. */
export function usePushReminders() {
  const { locale } = useI18n()
  const uid = useSignedInUid()
  const [status, setStatus] = useState<PushReminderStatus>("loading")

  const save = useCallback(
    (subscription: PushSubscription) =>
      fetchJsonWithFirebaseIdToken(ApiRoutes.PUSH_SUBSCRIPTIONS, { method: "POST", body: { subscription: subscription.toJSON(), locale } }),
    [locale]
  )

  useEffect(() => {
    let cancelled = false
    const detect = async (): Promise<PushReminderStatus> => {
      if (isIosDevice() && !isStandaloneDisplay()) return "needs-install"
      if (!isPushSupported()) return "unsupported"
      if (Notification.permission === "denied") return "denied"
      const subscription = await currentSubscription()
      // Đã bật trước đó: gửi lại để server có uid (đổi tài khoản) và ngôn ngữ hiện tại.
      const key = subscription && uid ? `${subscription.endpoint}|${uid}|${locale}` : ""
      if (subscription && uid && key !== lastSyncedKey) {
        lastSyncedKey = key
        await save(subscription).catch((error: unknown) => {
          lastSyncedKey = ""
          console.warn("[push] sync failed", error)
        })
      }
      return subscription ? "on" : "off"
    }
    detect()
      .then((next) => !cancelled && setStatus(next))
      .catch(() => !cancelled && setStatus("unsupported"))
    return () => {
      cancelled = true
    }
  }, [uid, locale, save])

  const enable = useCallback(async () => {
    const permission = await Notification.requestPermission()
    if (permission !== "granted") {
      setStatus(permission === "denied" ? "denied" : "off")
      return false
    }
    const registration = (await navigator.serviceWorker.getRegistration()) ?? (await registerAppServiceWorker())
    await navigator.serviceWorker.ready
    const options = { userVisibleOnly: true, applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY) }
    let subscription: PushSubscription
    try {
      subscription = await registration.pushManager.subscribe(options)
    } catch (error) {
      // Đăng ký cũ dùng khoá VAPID khác (đã đổi khoá) → huỷ rồi đăng ký lại một lần.
      const stale = await registration.pushManager.getSubscription()
      if (!(error instanceof DOMException && error.name === "InvalidStateError") || !stale) throw error
      await stale.unsubscribe()
      subscription = await registration.pushManager.subscribe(options)
    }
    try {
      await save(subscription)
    } catch (error) {
      // Server không lưu được → huỷ luôn ở trình duyệt để trạng thái hai bên khớp nhau.
      await subscription.unsubscribe()
      throw error
    }
    setStatus("on")
    return true
  }, [save])

  const disable = useCallback(async () => {
    const subscription = await currentSubscription()
    if (subscription) {
      await fetchJsonWithFirebaseIdToken(ApiRoutes.PUSH_SUBSCRIPTIONS, { method: "DELETE", body: { endpoint: subscription.endpoint } })
      await subscription.unsubscribe()
    }
    setStatus("off")
  }, [])

  return { status, enable, disable }
}
