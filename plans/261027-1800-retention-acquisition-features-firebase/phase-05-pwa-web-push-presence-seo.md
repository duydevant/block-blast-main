# Phase 05 — PWA, Web Push nhắc nhở, "X người đang chơi", trang SEO

## Context Links
- Ý tưởng: `reports/feature-ideas-retention-acquisition.md` (B7, B8, C6, C7)
- Kiến trúc: `reports/firebase-data-architecture.md`
- Next 16: `node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md`, `.../03-file-conventions/01-metadata/manifest.md`

## Overview
- Priority: P2 · Status: Done (2026-10-28) — chờ env VAPID/CRON_SECRET ở host, cron
- Cài game ra màn hình chính + chơi offline (PWA), nhắc giữ chuỗi bằng Web Push, hiện số người đang chơi (RTDB presence), trang công khai cho Google (hướng dẫn chơi, BXH render server).

## Key Insights
- Push dùng **Web Push chuẩn (VAPID) + thư viện `web-push`** theo guide của Next thay vì FCM: không cần lấy khoá trên console, không cần SW riêng của Firebase. Khoá VAPID tự sinh, để trong env.
- Gửi theo lịch cần cron gọi `POST /api/cron/daily-reminders` (header `Authorization: Bearer CRON_SECRET`). Vercel: `vercel.json` crons; VPS: crontab + curl.
- Endpoint push do client gửi lên → server sẽ POST tới đó: **chỉ nhận host của dịch vụ push thật** (chặn SSRF).
- iOS chỉ nhận push khi đã cài PWA (16.4+) → hướng dẫn cài.
- Presence: client ghi `/presence/{uid}` (RTDB rules chỉ cho chính chủ), `onDisconnect().remove()`; đếm bằng Admin SDK ở server (client không đọc được danh sách uid), cache 30s. Chỉ kết nối khi đang ở màn chơi và tab đang hiện (gói Spark giới hạn 100 kết nối).
- i18n chạy phía client (render đầu là tiếng Anh) → trang SEO render server bằng tiếng Anh, client đổi sang ngôn ngữ người dùng như các trang khác.

## Requirements
- Manifest (`app/manifest.ts`), icon PNG 192/512 + maskable sinh bằng `next/og`, `apple-icon`.
- Service worker `public/sw.js`: cache app shell để mở lại offline, nhận push, bấm thông báo mở `/play?daily=1`. Chỉ đăng ký ở production.
- Nút "Cài game" (beforeinstallprompt) sau khi có ≥3 ván online; iOS hiện hướng dẫn "Thêm vào MH chính".
- Bật/tắt nhắc nhở ở profile; gợi ý bật trên thẻ thử thách ngày khi chuỗi ≥2.
- Cron: chưa chơi daily hôm nay → chuỗi còn sống: "Chuỗi N ngày sắp mất"; người còn hoạt động (≤7 ngày) → "Thử thách hôm nay đã có". Mỗi máy tối đa 1 tin/ngày; endpoint hết hạn (404/410) thì xoá.
- Presence: `GET /api/presence` → `{ playing }`; trang chủ hiện "X người đang chơi" khi ≥2.
- SEO: `/how-to-play` (luật, mẹo, FAQ JSON-LD), `/leaderboard` có top 10 render server (bảng mọi lúc + tuần), sitemap cập nhật.

## Architecture
```
public/sw.js                         cache shell + push + notificationclick
app/manifest.ts, app/pwa-icon/[size] manifest + icon
modules/pwa/                         đăng ký SW, install prompt store/nút
modules/push/                        hook bật/tắt nhắc nhở, nội dung tin (en/vi)
server/push/                         lưu subscription (allowlist host), gửi nhắc nhở theo lịch
app/api/push/subscriptions           POST/DELETE (cần token)
app/api/cron/daily-reminders         POST (CRON_SECRET)
modules/presence/ + app/api/presence RTDB presence + đếm
app/(main)/how-to-play               trang hướng dẫn
```
Firestore: `pushSubscriptions/{sha256(endpoint)}` → `{ uid, endpoint, keys, locale, createdAt, lastSentDay }`. RTDB: `/presence/{uid}` = timestamp.

## Related Code Files
- Sửa: `database.rules.json`, `server/firebase/firebase-admin-app.ts`, `providers/app-providers.tsx`, `app/(main)/page.tsx`, `app/(main)/leaderboard/page.tsx`, `app/(main)/profile/page.tsx`, `app/sitemap.ts`, `daily-challenge-card.tsx`, `game-over-dialog.tsx`, `block-puzzle-game-screen.tsx`, `.env.example`, `lib/routes.tsx`, `lib/i18n.tsx`
- Tạo: như Architecture

## Implementation Steps
1. PWA: icon, manifest, sw.js, đăng ký SW, install prompt.
2. Push: `web-push`, env VAPID + CRON_SECRET, API subscription, cron gửi, UI bật/tắt.
3. Presence: rules RTDB, hook client, API đếm, hiển thị.
4. SEO: how-to-play, leaderboard SSR, sitemap.
5. Test đơn vị (chọn tin nhắc, allowlist), e2e với Firebase thật, review, docs.

## Todo List
- [x] PWA manifest + icon + SW + install
- [x] Push subscription API + cron + UI
- [x] Presence
- [x] SEO pages
- [x] Test + e2e + review + docs

## Success Criteria
- Lighthouse nhận diện installable (manifest + SW + icon).
- Cron gửi đúng loại tin, không gửi 2 lần/ngày, xoá endpoint chết.
- Endpoint lạ (không phải dịch vụ push) bị 400.
- `/how-to-play` và top BXH có trong HTML server.

## Risk Assessment
- SW cache sai làm kẹt bản cũ: đổi `CACHE_VERSION` khi đổi chiến lược; chỉ cache-first cho `/_next/static` (có hash).
- Rules RTDB chưa deploy → presence không ghi được (đếm = 0, ẩn UI). Cần `firebase deploy --only database`.
- Cron chạy trên nhiều instance → `lastSentDay` chặn gửi trùng (không tuyệt đối khi chạy song song; đủ dùng).

## Security Considerations
- `CRON_SECRET` so sánh timing-safe; VAPID private key chỉ ở server env.
- Allowlist host push; subscription gắn uid từ token.
- Presence chỉ chính chủ ghi; không client nào đọc được danh sách uid.

## Next Steps
- Phase 06: đấu 1v1 realtime (RTDB), sự kiện tuần, chế độ màn chơi.

## Kết quả / sai khác
- Dùng `web-push` (VAPID tự sinh) thay FCM như ghi ở Key Insights; khoá đã sinh vào `.env.local` (không commit).
- E2E (scratchpad `e2e-phase5.ts`, bản production): manifest + 3 icon PNG + favicon/apple-icon 200; `sw.js` có push handler; `/how-to-play` có FAQPage JSON-LD; `/leaderboard` render sẵn 11 dòng (tab đầu có dữ liệu); sitemap có `/how-to-play`; `/api/presence` đếm được bằng Admin SDK; client ghi presence 401 cho tới khi deploy RTDB rules (đúng dự kiến), ghi hộ người khác / đọc danh sách 401; đăng ký push 200, host lạ 400, không token 401; cron sai/thiếu secret 401, chạy thật xoá endpoint giả (FCM trả 404/410), chạy lần 2 cùng ngày không gửi lại.
- Chưa kiểm được: gửi push thật tới trình duyệt (cần bật trên máy thật), cài PWA trên điện thoại.
- Sau review (`plans/reports/reviewer-261028-phase-05-pwa-push-presence-seo.md`): presence chống goOffline trễ + ghi khi tab hiện lại; cron phân trang theo id, lỗi xoá không làm dừng cả lần chạy, `maxDuration` 60s; tối đa 5 đăng ký push/tài khoản; kiểm tra độ dài khoá p256dh/auth; ISR bảng xếp hạng không lưu đè trang rỗng khi lỗi lúc chạy; SW không trả `/play` cho trang khác khi offline, giới hạn 150 file cache, không cache 206/redirect, notificationclick có dự phòng; đổi khoá VAPID thì tự huỷ đăng ký cũ.
- Còn để ngỏ: presence có thể bị thổi phồng bằng tài khoản khách (chỉ là số hiển thị).
