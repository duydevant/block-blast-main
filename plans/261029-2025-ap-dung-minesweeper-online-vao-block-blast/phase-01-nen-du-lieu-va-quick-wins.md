# Phase 01 — Nền dữ liệu + Quick wins (F1–F6)

## Context Links

- Plan tổng: [plan.md](./plan.md) (mục 3 từ vựng, mục 4 mô tả F1–F6)
- Nghiên cứu: `D:\VQD\minesweeper-online-local-20261029\NGHIEN-CUU-MINESWEEPER-ONLINE-20261029.md` — Phần I §2 (chỉ số 3BV/Efficiency/NF/Mastery), Phần III §3 (Quests), Phụ lục achievement, Phần IV §3 (điều khiển touch)
- Docs repo: `docs/system-architecture.md` (luồng ván tính điểm, tiến trình), `docs/code-standards.md`
- Next.js 16: đọc `node_modules/next/dist/docs/` trước khi thêm route mới (`params` là Promise, route handler conventions)

## Overview

| | |
|---|---|
| Priority | P0 (F1) / P1 (F2–F6) |
| Status | Chưa bắt đầu |
| Ước lượng | 8–10 ngày dev |
| Phụ thuộc | Không (phase đầu). F2, F3, F4, F5 đều cần F1 xong trước |

Mục tiêu: mỗi ván có nhiều chỉ số kỹ năng (không chỉ điểm), có lịch sử, có thước đo **ổn định** (Phong độ → Bậc), nhiệm vụ/thành tích dẫn người chơi thử nhiều phong cách, và vài cài đặt trợ năng rẻ mà giá trị cao.

## Key Insights

- Minesweeper tách **tốc độ / hiệu suất / phong cách (NF) / ổn định (Mastery)** → mỗi kiểu người chơi có mục tiêu riêng. Block Blast chỉ có điểm.
- Block Blast phụ thuộc may rủi chia khối (bag deal không đảm bảo đặt được — `piece-tray-generator.ts`) → **kỷ lục ≠ kỹ năng**. Trung vị 20 ván (giống Mastery 100 ván) là thước đo đúng.
- `GameState.linesCleared` đã được reducer đếm → mô hình "đếm trong reducer" đã có tiền lệ; mở rộng theo cùng cách là ít rủi ro nhất (không cần replay lại ở client để có số liệu).
- `gameSessions.expireAt` = 30 ngày cho mọi session → không dùng session làm lịch sử.
- Ván < 10 nước hiện bị loại khỏi XP/nhiệm vụ. **Nhưng Phong độ phải tính cả ván ngắn** (≥1 nước), nếu không người chơi bấm "Ván mới" khi khay xấu để né ván tệ (giống lý do Mastery đếm mọi ván).
- Recap năm (F18, phase 4) cần dữ liệu cả năm → **phải bắt đầu ghi bộ đếm theo năm ngay phase này**, không thì tháng 12 không có gì để tổng kết.

## Requirements

**Chức năng**
- F1: reducer đếm chỉ số ván; server replay trả chỉ số; `PlayerStats` có field mới; hộp hết ván hiện 3 chỉ số.
- F2: mỗi ván nộp xong có 1 dòng lịch sử; trang `/profile/games` (lọc chế độ, phân trang); thống kê theo chế độ; bộ đếm theo năm.
- F3: Phong độ (trung vị 20 ván Vô tận + lượt đầu daily, ≥10 ván) → Bậc; huy hiệu Bậc ở profile/BXH/duel/hết ván; thưởng xu lần đầu lên mỗi Bậc.
- F4: 6 loại nhiệm vụ mới; mức khó theo Bậc (chốt theo ngày); đổi 1 nhiệm vụ/ngày.
- F5: ~10 thành tích mới, nhóm theo chủ đề.
- F6: nâng khối khi kéo, ký hiệu mù màu, giảm chuyển động, tắt highlight dòng, chơi bằng bàn phím.

**Phi chức năng**
- Không tăng `SAVE_VERSION`; mọi field mới optional, zod parse có default.
- Không thêm lượt đọc Firestore trong transaction nộp ván ngoài doc lịch sử/năm (chỉ ghi).
- Engine thuần; `npm run balance` cho kết quả **y hệt** trước khi đổi (không đổi luật).

## Architecture

```
gameReducer (PLACE/STASH/REPLACE/REVIVE)
  └─ accumulateRunStats(prev, action, next) → GameState.runStats   (engine/game-run-stats.ts)
replayRecordedGame → ReplaySummary { ..., runStats }               (đọc từ state cuối)
recordSubmittedRankedGame (transaction)
  ├─ applyVerifiedGameToPlayerStats → stats mới (pure/multiClear…)
  ├─ withRecentFormScore → users.recentFormScores (F3)
  ├─ applyProgressionForVerifiedGame → nhiệm vụ theo band (F4), thành tích mới (F5), tierUp (F3)
  ├─ writeGameHistory → users/{uid}/games/{gameId} (F2)
  └─ incrementYearCounters → users/{uid}/years/{YYYY} (F2/F18)
Client: game-over-dialog → GameOverRunMetrics (đọc game.runStats) + TierProgressNote
```

**Dữ liệu mới**

```ts
// engine/game-types.ts
interface GameRunStats {
  clearMoves: number        // nước có xoá ≥1 dòng
  multiClears: [number, number, number] // nước xoá ≥2, ≥3, ≥4 dòng
  maxLinesInMove: number
  bestCombo: number         // gom từ replay hiện tại vào đây
  boardClears: number
  stashUses: number
  replaceUses: number
  reviveUsed: boolean
}
GameState.runStats?: GameRunStats   // optional: save cũ thiếu → EMPTY_RUN_STATS
```

```ts
// Firestore users/{uid} (thêm)
stats.pureGames, stats.bestPureScore, stats.multiClears3, stats.maxLinesInMove
statsByMode: { classic|daily|challenge|level|duel: { games, best, total } }
recentFormScores: number[]          // ≤ 20, mới nhất ở cuối
tierRewardsClaimed: string[]        // id Bậc đã nhận xu
dailyThreeStarDays: number          // cho thành tích daily-3stars-7
// users/{uid}/games/{gameId}
{ mode, score, moveCount, linesCleared, bestCombo, pure, multiClears3, levelId?, day?, finishedAt, expireAt(+180 ngày) }
// users/{uid}/years/{YYYY}
{ games, totalScore, lines, bestScore, bestCombo, boardClears, pureGames, days, lastDay, modes: {classic: n, ...} }
// users/{uid}/missions/{day} (thêm)
{ band, replaced?: { slot, kind }, games1000 }
```

## Related Code Files

**Sửa**
- `modules/block-puzzle/engine/game-types.ts` — `GameRunStats`, `GameState.runStats`
- `modules/block-puzzle/engine/game-state-reducer.ts` — gọi accumulator sau mỗi action hợp lệ; `createNewGame` khởi tạo `runStats`
- `modules/block-puzzle/engine/power-up-rules.ts` — không đổi luật; accumulator đặt ở reducer (1 chỗ)
- `modules/block-puzzle/engine/replay-recorded-game-actions.ts` — bỏ vòng đếm riêng, đọc `state.runStats`; `ReplaySummary.runStats`
- `modules/block-puzzle/store/saved-game-schema.ts` — `runStats` optional
- `modules/player-profile/player-profile-types.ts` — `PlayerStats` field mới, `PlayerProfile.form/tier/formGames/statsByMode`, `GameRewards.tierUp`
- `server/profile/stored-player-document.ts` — schema field mới + `toPlayerProfile`
- `server/games/apply-verified-game-to-player-stats.ts` — cộng field mới + `statsByMode`
- `server/games/record-submitted-ranked-game.ts` — **tách trước** (đang 189 dòng): phần ghi BXH → `write-leaderboard-entries.ts`; thêm gọi history/year/form
- `server/progression/apply-progression-for-verified-game.ts` — truyền band, runStats, tier vào nhiệm vụ/thành tích
- `modules/progression/daily-mission-catalog.ts` — kind mới, bảng target theo band, replace
- `modules/progression/achievement-catalog.ts` — thành tích mới + `category`
- `modules/progression/daily-challenge-goals.ts` — dùng `median` chung
- `server/daily/daily-status-store.ts` — trả nhiệm vụ theo band + `replaced`
- `modules/block-puzzle/components/game-over-dialog.tsx`, `game-settings-menu.tsx`
- `modules/block-puzzle/store/block-puzzle-settings-store.ts`
- `modules/block-puzzle/input/pointer-drag-controller.ts` (`TOUCH_LIFT_IN_CELLS` → tham số)
- `modules/block-puzzle/render/block-cell-painter.ts`, `effects-timeline.ts`, `drag-placement-preview.ts`, `board-canvas-renderer.ts`
- `modules/block-puzzle/components/block-puzzle-game-canvas.tsx` (gắn keyboard controller)
- `modules/home/components/home-missions-row.tsx`, `modules/progression/components/profile-achievements-card.tsx`, `modules/player-profile/components/profile-hero.tsx`, `profile-stats-card.tsx`
- `modules/leaderboard/components/leaderboard-table.tsx`, `modules/duel/components/duel-versus-card.tsx`
- `lib/routes.tsx` (`PROFILE_GAMES`, `ApiRoutes.GAMES_HISTORY`, `MISSIONS_REPLACE`)
- Translation: `block-puzzle-translations.ts`, `progression-translations.ts`, `player-profile-translations.ts`
- `firestore.indexes.json` — index `games` (mode ASC, finishedAt DESC)

**Tạo**
- `modules/block-puzzle/engine/game-run-stats.ts` (+ `.test.ts`)
- `modules/progression/score-statistics.ts` (`median`)
- `modules/progression/player-form-rules.ts` (+ `.test.ts`)
- `modules/progression/components/player-tier-badge.tsx`, `tier-progress-note.tsx`
- `modules/block-puzzle/components/game-over-run-metrics.tsx`
- `server/games/write-leaderboard-entries.ts`
- `server/games/game-history-documents.ts` (schema, `historyEntryFor`, `yearCounterUpdate`)
- `server/games/game-history-store.ts` (query phân trang)
- `app/api/games/history/route.ts`
- `app/api/missions/replace/route.ts`, `server/progression/replace-daily-mission.ts`
- `app/(main)/profile/games/page.tsx`, `modules/player-profile/components/game-history-list.tsx`, `score-trend-sparkline.tsx`, `use-game-history-query.ts`
- `modules/block-puzzle/input/keyboard-placement-controller.ts` (+ `.test.ts`)
- `modules/block-puzzle/render/colorblind-glyphs.ts`

**Xoá**: không.

## Implementation Steps

### Bước 0 — Chuẩn bị (0.5 ngày)
1. Chạy `npm test`, `npx tsc --noEmit`, `npm run balance` → lưu số liệu gốc vào `plans/.../reports/balance-before-phase-01.txt`.
2. Tách `record-submitted-ranked-game.ts`: chuyển khối "Ghi bảng" (đọc entries, `improved`, `mergeScoreIntoTopList`) sang `write-leaderboard-entries.ts` với 2 hàm `readLeaderboardEntries(tx, db, boardIds, uid)` và `writeLeaderboardEntries(tx, …)`. Không đổi hành vi; test hiện có phải xanh.

### F1 — Chỉ số ván (2 ngày)
3. `game-run-stats.ts`: `EMPTY_RUN_STATS`, `accumulateRunStats(stats, action, next)`:
   - `PLACE_PIECE` có `next.lastMove`: `n = clearedRows+clearedCols`; `n≥1` → clearMoves++; `n≥2/3/4` → multiClears[0/1/2]++; `maxLinesInMove = max`; `bestCombo = max(lastMove.combo)`; `boardCleared` → boardClears++.
   - `STASH_PIECE` → stashUses++; `REPLACE_TRAY` → replaceUses++; `REVIVE` → reviveUsed = true.
   - Hàm phụ: `isPureRun(stats)`, `pointsPerMove(score, moves)` (0 nếu moves=0, làm tròn 1 số lẻ ở UI).
4. Reducer: sau khi tính `next` hợp lệ (khác tham chiếu) → `next.runStats = accumulateRunStats(state.runStats ?? EMPTY, action, next)`. `RESTORE` giữ nguyên `runStats`. Không chạm khi action không hợp lệ (vẫn trả **đúng tham chiếu cũ**).
5. Replay: xoá biến đếm cục bộ, `summary.runStats = state.runStats`; giữ `linesCleared/bestCombo/boardClears` trong summary (đọc từ runStats/state) để code cũ không đổi.
6. `saved-game-schema.ts`: `runStats: runStatsSchema.optional()`; save cũ thiếu → reducer coi như EMPTY (chỉ số ván dở cũ bị thiếu phần trước — chấp nhận, ghi chú trong code).
7. `PlayerStats` + `applyVerifiedGameToPlayerStats`: `pureGames += pure && moveCount ≥ 10`; `bestPureScore = max` khi pure; `multiClears3 += multiClears[1]`; `maxLinesInMove = max`. `statsByMode[mode]` cập nhật games/best/total (cần truyền `mode` vào hàm).
8. UI `game-over-run-metrics.tsx`: 3 chip — *Điểm/nước*, *Xoá ≥3 dòng*, *Ván thuần ✓/✗* (tooltip giải thích "không Cất, Đổi khối, Hồi sinh"). Chèn vào `game-over-dialog.tsx` dưới số điểm, ẩn ở duel (đã có panel riêng).
9. Test: accumulator từng loại action; replay determinism (cùng log → cùng runStats); `power-up-replay-determinism.test.ts` vẫn xanh; save cũ không có runStats vẫn load.

### F2 — Lịch sử ván + bộ đếm năm (2 ngày)
10. `game-history-documents.ts`: `GAMES_HISTORY_SUBCOLLECTION = "games"`, `YEARS_SUBCOLLECTION = "years"`, `historyEntryFor({mode, summary, levelId, day, finishedAt})`, `HISTORY_TTL_MS = 180 ngày`.
11. Năm theo **giờ VN** (`lib/vn-calendar.ts`). `yearCounterUpdate(summary, mode, today)` trả object `FieldValue.increment(...)`; `days` chỉ +1 khi `lastDay !== today` → cần đọc doc năm trong transaction (**+1 read**, chấp nhận; hoặc đếm ngày bằng `missions/{today}` đã đọc: nếu doc missions chưa tồn tại → ngày đầu tiên → days+1, **không thêm read**. Chọn cách này).
12. Trong transaction submit (sau replay hợp lệ, `moveCount > 0`): `tx.set(historyRef, entry)`, `tx.set(yearRef, counters, {merge: true})`.
13. Firestore console: bật TTL cho collection group `games` field `expireAt` (ghi vào `docs/firebase-setup-guide.md`).
14. `game-history-store.ts`: `listGameHistory(uid, {mode?, cursor?, limit = 30})` — `orderBy("finishedAt","desc")`, `where("mode","==")` nếu có, cursor = `finishedAt` millis + `gameId`.
15. Route `GET /api/games/history` (Bearer, zod query), trả `{ items, nextCursor }`.
16. Trang `/profile/games`: `useInfiniteQuery`; danh sách: icon chế độ, điểm, số nước, dòng, combo, badge "Thuần", ngày giờ; chip lọc chế độ; `score-trend-sparkline.tsx` (SVG thuần, 30 ván gần nhất, đường trung vị phong độ). Link từ `profile-stats-card.tsx` ("Xem lịch sử").
17. Profile stats card: thêm bảng nhỏ theo chế độ từ `statsByMode` (ván / kỷ lục / trung bình).

### F3 — Phong độ + Bậc (2 ngày)
18. `score-statistics.ts`: chuyển `median` từ `daily-challenge-goals.ts` sang đây, daily import lại (DRY, test daily vẫn xanh).
19. `player-form-rules.ts`:
    ```ts
    export const FORM_WINDOW = 20, FORM_MIN_GAMES = 10
    export const PLAYER_TIERS = [
      { id: "bronze", minForm: 0, coins: 0 },
      { id: "silver", minForm: 800, coins: 50 },
      { id: "gold", minForm: 1500, coins: 100 },
      { id: "platinum", minForm: 3000, coins: 200 },
      { id: "diamond", minForm: 6000, coins: 400 },
      { id: "master", minForm: 12000, coins: 800 },
    ] as const   // ngưỡng TẠM — chỉnh theo dữ liệu thật (câu hỏi mở #2)
    withRecentFormScore(recent, score): number[]  // push + cắt còn 20
    formFromRecent(recent): number | null          // null nếu < 10
    tierForForm(form): TierId | "unranked"
    nextTierTarget(form): { tier, minForm } | null
    ```
    Tên hiển thị: Tập sự (chưa đủ 10 ván) · Đồng · Bạc · Vàng · Bạch kim · Kim cương · Cao thủ.
20. Submit: nếu `mode === "classic"` **hoặc** (daily, countsForDaily, firstRun) và `moveCount ≥ 1` → `recentFormScores = withRecentFormScore(...)`. Tính `tierBefore/tierAfter`; nếu `tierAfter` cao hơn mọi bậc trong `tierRewardsClaimed` → cộng xu các bậc chưa nhận, `rewards.tierUp = tierAfter`.
21. `toPlayerProfile`: `form`, `formGames = recent.length`, `tier`.
22. UI: `player-tier-badge.tsx` (icon + màu theo bậc, vẽ CSS/lucide, không ảnh ngoài) ở `profile-hero.tsx`, `duel-versus-card.tsx`; `tier-progress-note.tsx` ở hộp hết ván: "Phong độ 1.420 · còn 80 nữa lên Vàng" (hoặc "Còn 4 ván để xếp Bậc").
23. BXH: thêm `tier?: TierId` vào `LeaderboardRow` (schema `leaderboard-documents.ts` `.optional()`), ghi kèm row khi merge; `leaderboard-table.tsx` hiện badge. Snapshot cũ thiếu tier → không hiện.
24. Toast khi `rewards.tierUp` (`use-progression-side-effects.ts`).
25. Test: median chẵn/lẻ, < 10 ván → null, cắt 20, tierUp chỉ thưởng 1 lần, tụt bậc không trừ gì.

### F4 — Nhiệm vụ theo phong cách + đổi nhiệm vụ (2 ngày)
26. `DailyMissionKind` thêm: `pureScore`, `multiClear`, `efficiency`, `levelStars`, `duel`, `dailyStars`. `MissionGameResult` thêm: `pure`, `multiClears3`, `pointsPerMove`, `levelThreeStars` (ván màn đạt 3★), `isDuel`, `dailyStarsAfter`.
27. Bảng target theo **band 0–3** (band = Tập sự/Đồng → 0, Bạc → 1, Vàng/Bạch kim → 2, Kim cương/Cao thủ → 3). Ví dụ:
    | kind | band0 | band1 | band2 | band3 | xu/xp band0→3 |
    |---|---|---|---|---|---|
    | score | 1.000 | 1.500 | 3.000 | 8.000 | 25/30 → 60/80 |
    | pureScore | 600 | 1.000 | 2.000 | 5.000 | 30/40 → 70/90 |
    | multiClear (≥3 dòng) | 1 | 2 | 3 | 5 | 25/30 → 60/80 |
    | efficiency (≥30 nước, điểm/nước ≥) | 12 | 18 | 25 | 35 | 25/30 → 60/80 |
    | lines | 20 | 30 | 40 | 60 | … |
    Kind không phụ thuộc kỹ năng (games, daily, duel, levelStars, dailyStars, boardClears) giữ 1–2 mức như cũ.
28. `dailyMissionsForDay(day, band, replaced?)`: *loại* vẫn tất định theo ngày (giữ hàm shuffle), *mức* theo band; nếu `replaced` → thay kind ở slot đó bằng kind kế tiếp trong thứ tự shuffle chưa dùng.
29. Chốt band: hàm `ensureMissionDay(missionsSnap, stored)` → band từ doc nếu có, không thì từ `tierForForm(formFromRecent(stored.recentFormScores))`. Ghi `band` ở lần ghi đầu tiên (submit hoặc replace). GET `/api/daily` chỉ đọc (không ghi trong GET) — nếu band chưa chốt, hiển thị band tính tạm.
30. `POST /api/missions/replace { slot: 0|1|2 }`: transaction đọc user + missions doc; đã có `replaced` → 409 `already-replaced`; nhiệm vụ slot đó đã hoàn thành → 409 `mission-completed`; ghi `{ band, replaced: {slot, kind}, progress[oldId] xoá }`. Trả danh sách nhiệm vụ mới.
31. UI: nút "Đổi" nhỏ trên từng nhiệm vụ (home + /daily) khi còn lượt đổi; có tiến độ > 0 → `AlertDialog` "Mất tiến độ hiện tại?".
32. Test: cùng ngày + band → cùng nhiệm vụ; replace tất định; tiến độ kind mới; band chốt không đổi khi tier đổi giữa ngày.

### F5 — Thành tích mới (1 ngày)
33. `Achievement` thêm `category: "dedication" | "skill" | "style" | "social"`. Thêm (id → điều kiện → xu):
    `pure-2000` (bestPureScore ≥2.000, 80) · `pure-10000` (≥10.000, 300) · `quad-clear` (maxLinesInMove ≥4, 100) · `multi3-50` (multiClears3 ≥50, 150) · `stars-30` / `stars-60` (tổng sao màn, 100/300) · `duel-wins-10` (duelStats.won ≥10, 150) · `tier-gold` / `tier-diamond` (bậc cao nhất từng đạt, 100/400) · `marathon` (10 ván ≥1.000 điểm trong 1 ngày, 150) · `daily-3stars-7` (7 ngày đạt ★★★, 200).
34. `AchievementState` thêm `levelStarsTotal`, `duelWins`, `highestTier`, `todayGames1000`, `dailyThreeStarDays`. **Chú ý** `rewardForInviter` dựng state cho người mời → điền từ doc người mời (todayGames1000 = 0).
35. `todayGames1000`: field `games1000` trong `missions/{today}` (doc đã đọc trong submit) += 1 nếu score ≥ 1.000. `dailyThreeStarDays`: +1 khi `dailyOutcome` làm sao ngày từ <3 lên 3.
36. `profile-achievements-card.tsx`: nhóm theo category, thứ tự trong catalog giữ nguyên.
37. Test: mỗi thành tích mới đạt đúng ngưỡng, không thưởng 2 lần.

### F6 — Cài đặt & trợ năng (2 ngày, làm song song được)
38. Settings store thêm (partialize + merge validate như field cũ): `dragLift: "low"|"normal"|"high"` (1.0/1.6/2.4 ô), `colorblindMarks: boolean`, `reduceMotion: "system"|"on"|"off"`, `linePreview: boolean` (mặc định true).
39. `pointer-drag-controller.ts`: nhận `getTouchLiftCells()` thay hằng số.
40. `colorblind-glyphs.ts`: 8 ký hiệu vẽ bằng path (chấm, tam giác, vuông, thoi, sao, chữ thập, tim, lục giác) theo `colorId`; `drawBlock` gọi khi bật. Áp cả `block-board-preview.tsx` (HTML/CSS) nếu khả thi, không thì chỉ canvas.
41. Giảm chuyển động: `reduceMotion` resolve với `matchMedia("(prefers-reduced-motion: reduce)")`; `createMoveEffects` bỏ hạt + rung bàn, giữ hiệu ứng xoá ngắn (≤150 ms).
42. `linePreview=false` → `computePlacementPreview` không trả dòng sắp xoá (vẫn hiện bóng khối).
43. `keyboard-placement-controller.ts` (thuần, test được): state `{slot, row, col}`; `1/2/3` chọn khối, `Tab` chuyển khối, mũi tên di bóng (clamp trong bàn), `Enter/Space` đặt, `S` cất, `R` đổi khay, `Esc` huỷ. Trả `DragState`-tương-đương để renderer vẽ bóng bằng đường hiện có. Canvas có `tabIndex=0`, `aria-label`, vùng `aria-live` đọc điểm + "xoá 2 dòng".
44. Menu cài đặt: nhóm "Điều khiển & hiển thị".
45. Đóng mục "Chơi bằng bàn phím (WCAG 2.1.1)" trong roadmap.

### Bước cuối (1 ngày)
46. `npm test`, `npx tsc --noEmit`, `npm run lint`, `npx next build --webpack` (Windows), `npm run balance` → so với số gốc: phải trùng.
47. QA tay: ván Vô tận, daily, màn, duel, thách đấu → hộp hết ván, lịch sử, phong độ; save cũ (copy localStorage trước khi đổi) vẫn chơi tiếp.
48. Cập nhật `docs/system-architecture.md` (field mới, API, phong độ/bậc), `docs/project-roadmap.md` (v2.6), `docs/firebase-setup-guide.md` (TTL `games`, index).

## Todo List

- [ ] Lưu số liệu balance/test gốc
- [ ] Tách `write-leaderboard-entries.ts`
- [ ] F1 `game-run-stats.ts` + reducer + replay + schema + test
- [ ] F1 PlayerStats/statsByMode + hộp hết ván
- [ ] F2 history + year counters trong transaction
- [ ] F2 TTL + index + API + trang `/profile/games`
- [ ] F3 `median` chung + `player-form-rules.ts` + test
- [ ] F3 submit cập nhật form/tierUp + profile + badge + BXH row tier
- [ ] F4 kind mới + band + replace API + UI đổi nhiệm vụ
- [ ] F5 10 thành tích + category + counters
- [ ] F6 settings + drag lift + glyph + reduce motion + line preview
- [ ] F6 bàn phím + aria-live
- [ ] i18n en/vi đủ key
- [ ] Test/lint/build/balance
- [ ] Docs

## Success Criteria

- Toàn bộ test cũ + mới xanh; `npm run balance` không đổi số.
- Ván nộp lên có `runStats` khớp giữa client (hộp hết ván) và server (profile) — test so sánh replay vs store.
- Người chơi ≥ 10 ván thấy Phong độ + Bậc; < 10 ván thấy "còn N ván".
- Nhiệm vụ của người Bậc Kim cương khác mức người Bậc Đồng cùng ngày; đổi được đúng 1 lần.
- Lịch sử hiển thị ≤ 2 lượt đọc/trang (1 query + không đọc thêm).
- Bàn phím: hoàn thành 1 ván không dùng chuột (QA tay).
- KPI theo dõi 2 tuần sau release: số ván/phiên, % người mở `/profile/games`, % nhiệm vụ hoàn thành, D7 retention.

## Risk Assessment

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Thêm `runStats` vào reducer làm lệch replay của ván đang dở trên máy người chơi | Thấp | `runStats` không ảnh hưởng luật/điểm; server chỉ đọc. Test determinism |
| Transaction submit phình (history + year + nhiều field) | TB | Chỉ thêm **ghi**, không thêm đọc (ngày đầu đếm qua missions doc). Đo thời gian transaction ở emulator |
| Ngưỡng Bậc sai | Cao | Ngưỡng ở 1 file config; sau 2 tuần lấy phân phối `recentFormScores` thật (script đọc Firestore) chỉnh theo percentile 50/75/90/97/99.5 |
| Đổi `median` làm lệch daily goals | Thấp | Chuyển nguyên hàm, test daily goals hiện có giữ nguyên |
| Người chơi phàn nàn ván ngắn kéo phong độ xuống | TB | Giải thích trong tooltip "mọi ván Vô tận đều tính, như Mastery"; ván 0 nước không tính (đã có: abandoned) |
| Keyboard controller xung đột phím tắt trình duyệt/IME | Thấp | Chỉ bắt khi canvas focus; bỏ qua khi `event.isComposing` |

## Security Considerations

- Mọi chỉ số do server replay; client gửi lại vẫn chỉ là `actions` (không gửi runStats).
- `GET /api/games/history` chỉ trả lịch sử của uid trong token; cursor validate bằng zod (số + 20 ký tự id).
- `POST /api/missions/replace`: rate tự nhiên (1 lần/ngày, kiểm trong transaction); body ≤ 256 B.
- Không lộ uid qua `tier` trên BXH (row đã có uid nội bộ như hiện tại — không đổi phạm vi).

## Next Steps

- Phase 02 dùng: `runStats` (BXH Thuần/Combo), Phong độ (BXH Phong độ), history (link replay), `write-leaderboard-entries.ts` (mở rộng nhiều hạng mục).
- Sau 2 tuần: chạy script phân phối điểm → chỉnh ngưỡng Bậc + band nhiệm vụ (ghi báo cáo vào `reports/`).
