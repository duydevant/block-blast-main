/* Service worker của game: mở lại được khi offline + nhận thông báo nhắc nhở (Web Push).
 * Đổi CACHE_VERSION khi đổi chiến lược cache để bỏ cache cũ. */
const CACHE_VERSION = "v1"
/** File build cũ (hash cũ) tích luỹ qua các lần deploy → chỉ giữ từng ấy file mới nhất. */
const STATIC_CACHE_LIMIT = 150
const SHELL_CACHE = `shell-${CACHE_VERSION}`
const STATIC_CACHE = `static-${CACHE_VERSION}`
/** Trang mở offline được; /play là đích chính (game chạy hoàn toàn ở client). */
const SHELL_URLS = ["/play", "/"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  const keep = new Set([SHELL_CACHE, STATIC_CACHE])
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !keep.has(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

/** File build có hash trong tên → không bao giờ đổi nội dung, lấy cache trước. */
function isImmutableAsset(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/fonts/")
}

/** Bỏ các file cũ nhất (Cache Storage giữ thứ tự thêm vào). */
async function trimCache(cache, limit) {
  const keys = await cache.keys()
  await Promise.all(keys.slice(0, Math.max(0, keys.length - limit)).map((key) => cache.delete(key)))
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  // Chỉ lưu phản hồi đầy đủ (206 partial content không cache được).
  if (response.status === 200) {
    const cache = await caches.open(STATIC_CACHE)
    await cache.put(request, response.clone()).catch(() => undefined)
    trimCache(cache, STATIC_CACHE_LIMIT).catch(() => undefined)
  }
  return response
}

/** Trang: luôn lấy bản mới khi có mạng (để nhận bản deploy mới), mất mạng thì dùng bản đã lưu. */
async function networkFirstPage(request) {
  const url = new URL(request.url)
  try {
    const response = await fetch(request)
    if (response.status === 200 && !response.redirected && SHELL_URLS.includes(url.pathname)) {
      const cache = await caches.open(SHELL_CACHE)
      cache.put(url.pathname, response.clone())
    }
    return response
  } catch (error) {
    // Chỉ trả đúng trang đã lưu; trang khác (profile, thách đấu…) để trình duyệt báo mất mạng
    // thay vì hiện nội dung /play dưới URL khác.
    const cached = await caches.match(url.pathname)
    if (cached) return cached
    throw error
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return
  const url = new URL(request.url)
  // API, Firebase và trang khác domain: để trình duyệt tự xử lý (không bao giờ cache dữ liệu người chơi).
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return

  if (request.mode === "navigate") event.respondWith(networkFirstPage(request))
  else if (isImmutableAsset(url)) event.respondWith(cacheFirst(request))
})

self.addEventListener("push", (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { body: event.data ? event.data.text() : "" }
  }
  const title = payload.title || "Block Puzzle"
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "",
      icon: "/pwa-icon/any-192",
      badge: "/pwa-icon/any-192",
      // Cùng tag → tin mới thay tin cũ, không chồng nhiều tin nhắc trong ngày.
      tag: payload.tag || "daily-reminder",
      data: { url: payload.url || "/play" },
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const target = new URL((event.notification.data && event.notification.data.url) || "/play", self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((client) => client.url.startsWith(self.location.origin) && "focus" in client)
      if (!existing) return self.clients.openWindow(target)
      // navigate() có thể bị từ chối (tab không do SW quản lý) → mở cửa sổ mới.
      return existing
        .navigate(target)
        .then((client) => (client || existing).focus())
        .catch(() => self.clients.openWindow(target))
    })
  )
})
