# Phase 04 — Nhiệm vụ ngày, XP/xu, mở khoá theme, thành tích, mời bạn

## Context Links
- Ý tưởng: `reports/feature-ideas-retention-acquisition.md` (B3, B4, B5, C4)
- Kiến trúc: `reports/firebase-data-architecture.md`
- Phase trước: `phase-02-daily-challenge-streak-leaderboards.md`, `phase-03-share-card-friend-challenge-og-image.md`

## Overview
- Priority: P2 · Status: Done (2026-10-28)
- Biến mỗi ván đã server replay thành tiến độ dài hạn: XP/cấp, xu, 3 nhiệm vụ/ngày, thành tích; xu mua theme (chỉ đồ ngắm). Mời bạn: bạn mới chơi đủ 3 ván → cả 2 nhận xu + theme độc quyền.

## Key Insights
- Mọi phần thưởng tính **trong transaction nộp ván** (`record-submitted-ranked-game.ts`) từ `ReplaySummary` → client không tự cộng được gì.
- Nhiệm vụ giống nhau cho mọi người trong ngày: chọn tất định từ khoá ngày (seed PRNG có sẵn) → không cần lưu danh sách, chỉ lưu tiến độ `users/{uid}/missions/{day}`.
- Không dùng doc `users/{uid}/daily/{day}`: doc đó là chỗ giữ lượt daily và bị xoá khi nhả lượt.
- 4 theme hiện có giữ miễn phí (không lấy lại đồ người chơi cũ đã có); thêm 4 theme mới làm phần thưởng: cấp, xu, xu, mời bạn.
- Thành tích suy ra từ stats/streak/cấp → chỉ lưu danh sách id đã nhận thưởng.

## Requirements
- XP mỗi ván = 10 + min(90, ⌊điểm/100⌋); cấp L cần tổng 50·L·(L−1) XP; lên cấp +50 xu/cấp.
- 3 nhiệm vụ/ngày (giờ VN), loại khác nhau: số ván, số dòng, điểm 1 ván, combo 1 ván, dọn sạch bàn, hoàn thành daily. Xong → tự cộng xu + XP (không cần bấm nhận).
- Thành tích: ~12 cái, mỗi cái thưởng xu một lần.
- Shop theme: `POST /api/shop/themes` trừ xu trong transaction.
- Mời bạn: `GET /api/referral` (mã 6 ký tự, tạo lần đầu), `POST /api/referral/claim` (chỉ khi chưa được mời, < 3 ván, không tự mời). Thưởng khi người được mời nộp ván thứ 3; người mời nhận xu tối đa 10 lần, theme 1 lần.
- UI: thẻ nhiệm vụ ở trang chủ, cấp/xu + thành tích + mời bạn ở profile, khoá/mua theme trong hộp chọn theme, toast phần thưởng sau khi nộp ván.

## Architecture
```
modules/progression/            thuần, dùng chung client/server
  player-level-curve.ts           XP → cấp, XP mỗi ván
  daily-mission-catalog.ts        chọn 3 nhiệm vụ theo ngày + cộng tiến độ
  achievement-catalog.ts          điều kiện + thưởng
  theme-unlock-rules.ts           theme nào free/cấp/xu/mời bạn, isThemeOwned
server/progression/
  apply-progression-for-verified-game.ts   thuần: stored + summary → field mới + phần thưởng
  referral-store.ts, theme-shop-store.ts
POST /api/games/submit → response thêm `rewards`
GET  /api/daily        → thêm `missions`
```
Transaction nộp ván đọc thêm: `users/{uid}/missions/{today}` và (khi tới mốc 3 ván) `users/{inviter}`.

## Related Code Files
- Sửa: `server/games/record-submitted-ranked-game.ts`, `server/profile/stored-player-document.ts`, `server/daily/daily-status-store.ts`, `modules/player-profile/player-profile-types.ts`, `modules/block-puzzle/render/block-color-palette.ts`, `game-themes-and-stats-dialogs.tsx`, `block-puzzle-game-screen.tsx`, `app/(main)/page.tsx`, `app/(main)/profile/page.tsx`, `lib/routes.tsx`, `lib/i18n.tsx`, `block-puzzle-translations.ts`
- Tạo: `modules/progression/*`, `server/progression/*`, `app/api/shop/themes/route.ts`, `app/api/referral/route.ts`, `app/api/referral/claim/route.ts`, component thẻ nhiệm vụ / cấp / thành tích / mời bạn, bắt `?ref=`

## Implementation Steps
1. Module thuần progression + test.
2. Mở rộng stored player + profile type; theme mới + luật mở khoá.
3. Gắn progression vào transaction nộp ván, response `rewards`; missions vào `/api/daily`.
4. API shop theme + referral.
5. UI: thẻ nhiệm vụ, profile, hộp theme, toast, bắt link mời.
6. Typecheck, lint, test, e2e với Firebase thật, review.

## Todo List
- [x] progression thuần + test
- [x] stored player / profile type
- [x] theme mới + luật mở khoá
- [x] submit transaction + rewards
- [x] missions trong /api/daily
- [x] shop theme API
- [x] referral API + bắt link
- [x] UI
- [x] e2e + review + docs

## Success Criteria
- Nộp ván → XP/xu/tiến độ nhiệm vụ đúng; nộp lại cùng gameId không cộng thêm (409).
- Mua theme thiếu xu → lỗi, không trừ; mua rồi → 409.
- Người được mời chơi ván thứ 3 → cả hai nhận thưởng đúng một lần.
- 216+ test cũ vẫn pass.

## Risk Assessment
- Farm mời bạn bằng tài khoản khách: giới hạn 10 lần thưởng xu, yêu cầu 3 ván qua replay.
- Transaction nộp ván dài hơn: thêm 1–2 lượt đọc; vẫn dưới giới hạn Firestore.
- Theme đang chọn không còn sở hữu (đổi tài khoản) → tự về theme mặc định khi profile đã tải.

## Security Considerations
- Xu/XP/theme/thành tích chỉ Admin SDK ghi; rules vẫn chặn client.
- Mã mời chỉ map tới uid trên server, không lộ uid ra client.

## Next Steps
- Phase 05: Web Push nhắc streak/nhiệm vụ, PWA, presence, SEO.
- Có thể thêm "khiên giữ chuỗi" mua bằng xu (B2) khi cần chỗ tiêu xu.

## Kết quả / sai khác so với kế hoạch
- Ngưỡng combo nâng sau khi đo bằng bot (`npm run balance`-style, 300 ván: combo cao nhất trung vị 10, p90 20): nhiệm vụ combo 8/15, thành tích combo 15/30.
- E2E với Firebase thật (scratchpad `e2e-progression.ts`): mã mời ổn định, tự mời 400, mời lại 409, mời chéo 409, quà mời bạn đúng ở ván 3 cho cả hai, nộp lại 409 không cộng thêm, mua theme thiếu xu 409, mua 2 lần 409, theme không bán 400, người đã chơi 3 ván nhập mã 409.
- Sau review (`plans/reports/reviewer-261028-phase-04-progression.md`): ván < 10 nước không tính XP cơ bản / nhiệm vụ "chơi N ván" / mời bạn (`referralGames` đếm riêng); thành tích mời bạn của người mời cộng ngay; mã mời không gửi trùng khi đổi ngôn ngữ. Chưa có rate limit tạo session (để phase sau, cân nhắc App Check).
