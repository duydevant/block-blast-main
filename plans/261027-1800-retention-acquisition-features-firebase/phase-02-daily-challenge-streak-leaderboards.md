# Phase 02 — Thử thách hằng ngày, streak, bảng xếp hạng

## Context Links
- `phase-01-firebase-foundation-auth-profile-verified-games.md` (start/submit/replay)
- `reports/firebase-data-architecture.md` (leaderboards, snapshot top 100)

## Overview
- Priority: P0 — vòng giữ chân hằng ngày
- Status: **Done** (2026-10-27). Khác plan: trang `/leaderboard` render client qua API (cần token để có hạng của mình; SEO trang BXH để phase 05); streak hiện ở thẻ thử thách trang chủ + hồ sơ, HUD chỉ có nhãn "Thử thách dd/mm"; game over không hiện hạng (ván chỉ nộp khi hết hồi sinh/ván mới) mà có link xem BXH; ván daily vào từ menu game hoặc `/play?daily=1`; đổi tên cập nhật tên trên các bảng hiện hành.
- Mỗi ngày 1 seed chung, 1 lượt tính điểm; streak ngày; BXH ngày/tuần/mọi lúc.

## Key Insights
- Seed daily = `hash(DAILY_SEED_SECRET + yyyymmdd)` ở server → không đoán trước được ngày mai.
- Chỉ **lượt đầu** tính điểm (kiểu Wordle): chơi lại nhiều lần sẽ thuộc chuỗi khối. Chơi lại được nhưng là luyện tập.
- Màn BXH đọc 1 doc snapshot top 100 thay vì 100 doc; hạng của mình dùng `count()`.
- Doc snapshot chịu ~1 ghi/giây bền vững → chỉ ghi khi điểm lọt top 100; đủ cho giai đoạn đầu.

## Requirements
Functional
- `games/start` nhận `mode: "classic" | "daily"`. Daily: trả seed ngày + `attempt` (`ranked` nếu chưa nộp hôm nay).
- Submit ranked → ghi `users/{uid}/daily/{day}`, cập nhật streak, ghi `leaderboards/{day|week|alltime}/entries/{uid}` (giữ max) + snapshot nếu vào top 100. Tất cả trong 1 transaction.
- Classic ranked → chỉ bảng tuần + mọi lúc.
- Streak: `current` +1 nếu hôm qua có daily, về 1 nếu đứt; `best` = max.
- UI: thẻ "Thử thách hôm nay" ở trang chủ + menu game (trạng thái: chưa chơi / đã chơi + hạng); badge streak trên HUD; trang `/leaderboard` (tab Ngày/Tuần/Mọi lúc, dòng "hạng của bạn"); game over hiện hạng + "cần X điểm để lên hạng Y".
Non-functional
- Mở BXH: ≤ 2 lượt đọc Firestore. Trang BXH render server, cache 60 giây.

## Architecture
```
start(daily) → seed = hmac(secret, day) ; session.mode="daily", session.day
submit → replay → transaction:
   users/{uid}/daily/{day}   (nếu chưa có → ranked)
   users/{uid}.streak
   leaderboards/day-{day}/entries/{uid}, week-{isoWeek}/entries/{uid}, alltime/entries/{uid}
   leaderboards/{boardId}.top  (chèn + cắt 100 nếu đủ điểm)
```
Ranh giới ngày: theo `DAILY_TIMEZONE` (mặc định `Asia/Ho_Chi_Minh` — chờ chốt).

## Related Code Files
Tạo
- `server/daily/daily-challenge-seed-and-day-key.ts` + test (ngày, tuần ISO, timezone)
- `server/leaderboards/record-score-on-leaderboards.ts` + test
- `server/streaks/advance-daily-streak.ts` + test
- `modules/leaderboard/` — `leaderboard-types.ts`, `fetch-leaderboard-snapshot.ts` (server), `leaderboard-table.tsx`, `my-rank-row.tsx`
- `app/(main)/leaderboard/page.tsx`
- `modules/block-puzzle/components/daily-challenge-card.tsx`, `streak-badge.tsx`
Sửa
- `server/games/*` (mode daily), game store (`mode: "daily"`), `game-dialogs.tsx` (hạng sau ván), HUD, trang chủ, translations en/vi, `firestore.rules`, `firestore.indexes.json` (index `score desc`), `lib/routes.tsx`, `app/sitemap.ts`, `.env.example` (`DAILY_SEED_SECRET`, `DAILY_TIMEZONE`)

## Implementation Steps
1. Hàm day key / week key / seed daily + test qua ranh giới ngày và năm.
2. Streak + ghi BXH (thuần, test với emulator).
3. Nối vào submit transaction; start nhận mode daily.
4. Rules: `leaderboards/**` đọc được khi đã đăng nhập, không ghi từ client.
5. UI daily card, streak badge, game over hạng, trang `/leaderboard`.
6. Build/lint/test, review, docs.

## Todo List
- [ ] Day/week key + seed daily
- [ ] Streak
- [ ] Ghi entries + snapshot top 100
- [ ] Start/submit mode daily
- [ ] Rules + index
- [ ] UI: daily card, streak, game over hạng, trang BXH
- [ ] i18n, docs

## Success Criteria
- 2 tài khoản cùng ngày nhận cùng chuỗi khối ở daily; ngày sau khác.
- Lượt daily thứ 2 không đổi BXH ngày.
- Streak tăng/đứt đúng qua nửa đêm theo timezone đã chốt.
- Mở BXH tốn ≤ 2 lượt đọc (kiểm tra Firestore usage).

## Risk Assessment
- Bot tự chơi bằng thuật toán vẫn lên top được → theo dõi, thêm App Check + giới hạn tốc độ nước đi ở phase sau.
- Tranh chấp ghi snapshot khi đông → chuyển sang cập nhật snapshot theo lịch (cron) nếu cần.

## Security Considerations
- `DAILY_SEED_SECRET` chỉ ở server. Entries/snapshot chỉ Admin SDK ghi. Tên hiển thị lọc độ dài/ký tự trước khi chép vào BXH.

## Next Steps
- Phase 03 dùng session đã kiểm tra để tạo thách đấu.
