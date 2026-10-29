# Phase 01: Server: lượt, mốc, sao, tổng tuần, thưởng

## Overview

- **Priority:** cao.
- **Status:** Done.
- **Mô tả:** 3 lượt tính điểm/ngày, mốc cá nhân chốt theo ngày, thưởng mốc tự cộng, sao tuần, bảng tổng tuần, rương sao, thưởng hạng.

## Dữ liệu

- **`users/{uid}/daily/{day}`**
  - `runs: string[]`: gameId các lượt tính điểm, tối đa 3. Doc cũ có `gameId` → coi như `runs = [gameId]`.
  - `status`: "started" | "done". Thành "done" khi lượt đầu tiên nộp xong (giữ cho streak + thưởng chuỗi).
  - `score`: điểm cao nhất trong ngày.
  - `goals: { base, targets: [t1, t2, t3], record: number | null }`
  - `stars: 0..3`, `recordBroken: boolean`
- **`users/{uid}`:** thêm `dailyBest: number`.
- **`users/{uid}/dailyWeeks/{week}`:** `{ chests: number[], rankClaimedAt?, rank?, rankCoins? }`. Sao tuần đếm từ các doc ngày, không lưu riêng.
- **Bảng `challenge-week-{week}`:** entry.score = tổng `score` các ngày trong tuần của `day`. Khi một ngày tăng điểm cao nhất thêm d thì entry tăng d.

## Files

- **Tạo:**
  - `modules/progression/daily-challenge-goals.ts`: luật thuần (P, mốc, sao, rương, bậc hạng, kiểu API), có test.
  - `server/daily/daily-challenge-history.ts`: đọc lịch sử, tính mốc.
  - `server/daily/apply-daily-run-result.ts`: phần ghi daily trong transaction nộp ván.
  - `server/daily/daily-week-rewards-store.ts`: trạng thái tuần + nhận rương / thưởng hạng.
  - `app/api/daily/week-claim/route.ts`
- **Sửa:**
  - `create-ranked-game-session.ts`: 3 lượt, chốt mốc ở lượt đầu, session `dailyRun`.
  - `stored-game-session.ts`
  - `record-submitted-ranked-game.ts`
  - `leaderboard-board-ids.ts`
  - `daily-run-counts.ts`
  - `daily-status-store.ts`
  - `player-profile-types.ts`
  - `stored-player-document.ts`

## Steps

1. Viết module luật thuần + test.
2. Bắt đầu lượt daily:
   - transaction đọc doc ngày;
   - `runs.length < 3` → thêm gameId;
   - lượt đầu → ghi `goals` (lịch sử đọc trước transaction);
   - session lưu `dailyRun` (0/1/2).
3. Nộp ván daily:
   - lượt tính nếu gameId ∈ runs và ngày còn hạn;
   - cập nhật điểm cao nhất ngày, sao, kỷ lục, xu mốc;
   - entry tuần += delta;
   - `dailyRun === 0` → thêm bảng Hôm nay / Tuần / Mọi lúc;
   - bảng `daily-{day}` nhận mọi lượt (giữ max).
4. Ván 0 nước: bỏ gameId khỏi runs (trả lượt).
5. GET `/api/daily`: thêm lượt đã dùng, mốc (chưa chốt thì tính tạm), sao, tuần (tổng, hạng, sao, rương, `endsAt`), tuần trước (hạng + rương chưa nhận).
6. POST `/api/daily/week-claim`: `{ week, kind: "chest", index }` | `{ week, kind: "rank" }`.

## Success criteria

- Test luật pass.
- e2e server (script Admin SDK): 3 lượt → lượt 4 practice; mốc / xu / sao / tổng tuần đúng; lượt 2 không vào bảng Mọi lúc.
