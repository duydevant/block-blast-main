/**
 * Service worker chỉ chạy ở bản production: ở dev nó sẽ cache file build và làm hỏng hot reload.
 * Vì vậy nhắc nhở (cần SW) cũng chỉ có ở production.
 */
export const PWA_ENABLED = process.env.NODE_ENV === "production"

export const SERVICE_WORKER_URL = "/sw.js"

export function registerAppServiceWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: "/", updateViaCache: "none" })
}

/** Đang chạy như app đã cài (mở từ màn hình chính). */
export function isStandaloneDisplay(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia("(display-mode: standalone)").matches
}

/** iPhone/iPad (kể cả iPad báo là Mac): chỉ cài qua menu Chia sẻ, push chỉ có khi đã cài. */
export function isIosDevice(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
}
