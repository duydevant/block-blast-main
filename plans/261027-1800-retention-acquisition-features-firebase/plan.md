# Retention + acquisition features on Firebase

Status: **Planned** — Firebase đã config (project `block-puzzle-prod-40242`), sẵn sàng phase 01.

## Tài liệu
- Ý tưởng tính năng: `reports/feature-ideas-retention-acquisition.md`
- Kiến trúc dữ liệu: `reports/firebase-data-architecture.md`
- Hướng dẫn config: `../../docs/firebase-setup-guide.md`

## Giai đoạn

| # | Nội dung | File | Status |
|---|---|---|---|
| 01 | Firebase client/admin, khách ẩn danh + liên kết Google, profile cloud, API start/submit + replay kiểm tra điểm, rules | `phase-01-firebase-foundation-auth-profile-verified-games.md` | Done |
| 02 | Daily challenge, streak, BXH ngày/tuần/mọi lúc | `phase-02-daily-challenge-streak-leaderboards.md` | Done |
| 03 | Thẻ share, thách đấu bạn bè cùng seed, ảnh OG | `phase-03-share-card-friend-challenge-og-image.md` | Done |
| 04 | Nhiệm vụ ngày, XP/xu, mở khoá theme, thành tích, mời bạn | `phase-04-missions-xp-coins-themes-achievements-referrals.md` | Done |
| 05 | Web Push, PWA, presence (RTDB), trang SEO | `phase-05-pwa-web-push-presence-seo.md` | Done |
| 06 | Đấu 1v1 realtime (RTDB), sự kiện tuần, chế độ màn chơi | `phase-06-duels-weekly-events-levels.md` | Done |

## Trạng thái config (kiểm tra 2026-10-27)
- Auth Anonymous: OK (tạo được uid khách qua REST)
- Firestore: đã tạo, production mode (client bị chặn đúng)
- Realtime DB: đã tạo, locked mode, asia-southeast1
- Service account trong `.env.local`: project/email khớp, private key đọc được (RSA 2048) — **cần thay key** (bị lộ trong log phiên kiểm tra)
- Analytics: **không dùng** (đã chốt 2026-10-27)
- Chưa kiểm tra: Google provider, authorized domains, region Firestore, Firebase CLI login

## Giả định (đổi được — chưa chốt)
1. Host Next.js có Node server (Vercel/VPS) → API route + Admin SDK, không dùng Cloud Functions.
2. Firebase thay hẳn scaffold auth/BE cũ (`lib/api/*`, `auth.store.ts`, trang sign-up).
3. Chưa đưa lên cổng game iframe; vẫn giữ fallback để sau này đưa lên được.
4. Chưa kiếm tiền; xu chỉ kiếm từ chơi, chỉ mua đồ ngắm.
5. Ranh giới ngày daily theo giờ VN (UTC+7).

## Phụ thuộc chính
- Engine tất định dùng chung client/server để replay.
- Firestore = kho chính; RTDB chỉ presence + 1v1; không Cloud Storage/Functions ở phase 01–05.
