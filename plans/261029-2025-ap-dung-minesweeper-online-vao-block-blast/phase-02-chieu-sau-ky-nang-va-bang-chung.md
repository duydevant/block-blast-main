# Phase 02 — Chiều sâu kỹ năng & bằng chứng (F7–F11)

## Context Links

- Plan tổng: [plan.md](./plan.md) mục 5
- Phase trước: [phase-01-nen-du-lieu-va-quick-wins.md](./phase-01-nen-du-lieu-va-quick-wins.md) (runStats, Phong độ/Bậc, history, `write-leaderboard-entries.ts`)
- Nghiên cứu: Phần I §1–§5 (nhiều bảng, bộ lọc NF-only, My rank, link replay), §9 (toàn vẹn); Phần II §1 (NG), §6 (replay, hint, analysis); Phần IV §1 (Game analysis), §7 (website rules, report abuse)
- Code: `server/leaderboards/*`, `modules/duel/duel-move-replay.ts`, `modules/block-puzzle/engine/tray-solvability-search.ts`, `balance-simulator.ts`, `render/board-canvas-renderer.ts`
- Next.js 16 docs (`node_modules/next/dist/docs/`): dynamic route `params` Promise, `generateMetadata`, `opengraph-image`, Web Worker với Turbopack

## Overview

| | |
|---|---|
| Priority | P1 (F7, F8, F11) / P2 (F9, F10) |
| Status | Chưa bắt đầu, chờ Phase 01 |
| Ước lượng | 13–16 ngày dev |
| Thứ tự | F8 (replay) → F7 (BXH, cần replayId trên row) → F11 (chống bot, cần replay làm bằng chứng) → F9 → F10 |

Mục tiêu: mỗi kiểu người chơi có BXH riêng; mọi kỷ lục **xem lại được**; có chế độ bỏ may rủi (≈NG); người chơi biết **vì sao thua**; chặn bot trước khi thưởng hạng có giá trị.

## Key Insights

- Engine tất định + đã có replay từ seed ở 3 nơi (server submit, duel người xem, duel server chấm) → replay viewer chủ yếu là **lưu log** + UI. `duel-move-replay.ts` đã có mô hình "áp từng nước, dừng khi sai".
- `mergeScoreIntoTopList` chỉ xử lý **tăng** điểm → bảng Phong độ (giảm được) cần hàm riêng.
- Hạng mục all-time "giữ max" (combo, thuần) có thể **tránh đọc entry** khi giá trị không vượt kỷ lục cá nhân trong `stats` (stats luôn ≥ entry) → không tăng read cho ván bình thường.
- `canPlaceAllInSomeOrder` + budget 6.000 đã có, chạy bitmask ≤ ~15 ms worst-case → đủ dùng cho chế độ Không bế tắc và phân tích sau ván.
- Replay chỉ chứng minh **hợp lệ**, không chứng minh **con người** (báo cáo: rules cấm bot, nhưng client không chứng minh anti-cheat). Cần tín hiệu thời gian.
- Báo cáo: "NG ≠ không thể thua" → UI chế độ Không bế tắc phải nói rõ.

## Requirements

**Chức năng**
- F8: lưu log ván đáng giá; trang `/game/[id]` phát lại (play/pause/bước/tua/tốc độ); hồ sơ công khai `/u/[tag]`.
- F7: 5 hạng mục BXH (Điểm, Phong độ, Thuần, Combo, Sao màn) × kỳ hợp lệ; hàng của mình; link replay + hồ sơ.
- F11: ghi thời gian từng nước; đánh dấu ván nghi vấn; báo cáo replay; chặn tài khoản bị khoá khỏi BXH; giữ thưởng hạng tuần khi bị báo cáo.
- F9: chế độ "Không bế tắc" (mode `logic`), BXH riêng tuần/mọi lúc.
- F10: nút "Vì sao thua?" ở hộp hết ván → nước quyết định + gợi ý + phân loại Xui/Sai.

**Phi chức năng**
- Replay doc ≤ 100 KB; trang replay tải ≤ 2 lượt đọc Firestore.
- Submit tăng tối đa +1 read (entry bảng tuần Thuần) cho ván bình thường.
- Chế độ Không bế tắc: replay server 2.000 nước < 2 s (Node).
- Phân tích sau ván chạy Web Worker, < 2 s trên mobile tầm trung, không chặn UI.

## Architecture

```
Submit (transaction)
  ├─ assessGamePlausibility(durationMs, times) → suspect?           (F11)
  ├─ boardWritesForRankedGame(mode, summary, stored, form) → [{boardId, value, policy: "max"|"replace"}]   (F7)
  │     suspect/banned → []
  ├─ writeLeaderboardEntries (max: merge; replace: replaceScoreInTopList)
  └─ shouldStoreReplay(PB | lọt top | saveRequested) → gameReplays/{gameId} (actions nén)   (F8)
GET /api/replays/[id] → { seed, stashUnlocked, mode, variantRef, actions[], times?, meta }
/game/[id]: server page (metadata + OG) → <ReplayViewer> (client)
     buildReplayTimeline(start, actions) → GameState[]  → renderFrame(ctx, layout, view)
/u/[tag]: GET /api/players/[tag] → hồ sơ công khai
Logic mode: GameVariant.guaranteedTray → dealTrayForState() → guaranteed-tray-dealer
Analysis: Worker(game-outcome-analysis) ← {start, actions} → {verdict, decisive, suggestion}
```

**Mã hoá action (F8)** — `engine/recorded-action-codec.ts`:
```
PLACE_PIECE: 0 | slotCode<<2 | (row+8)<<4 | (col+8)<<9     slotCode: 0,1,2, 3=STASH
STASH_PIECE: 1 | slot<<2
REPLACE_TRAY: 2
REVIVE: 3
```
→ mỗi nước 1 số nguyên < 2^14; giải mã xong **vẫn qua `recordedActionSchema`**.

**Board ids mới (F7, F9)**: `form-alltime`, `pure-weekly-YYYY-Www`, `pure-alltime`, `combo-alltime`, `stars-alltime`, `logic-weekly-YYYY-Www`, `logic-alltime`.

**Firestore mới**
```
gameReplays/{gameId}: { uid, mode, seed, stashUnlocked, levelId?, actions: number[], times?: number[],
                        score, moveCount, runStats, displayName, tier, createdAt, expireAt|null }
reports/{autoId}: { reporterUid, replayId, targetUid, reason, createdAt, status: "open" }
users/{uid}: + banned?: boolean, + bestReplayId?: string, + publicTag (= referralCode)
users/{uid}/games/{gameId}: + replayId?
gameSessions/{gameId}: + suspect?: boolean, + suspectReason?: string, mode += "logic"
leaderboards/*/entries/{uid} + top rows: + replayId?, + tag?
```

## Related Code Files

**Sửa**
- `modules/block-puzzle/engine/game-types.ts` — `GameVariant.guaranteedTray`, `GameState.guaranteedTray`
- `modules/block-puzzle/engine/game-state-reducer.ts`, `power-up-rules.ts` — mọi lời gọi `dealTray` → `dealTrayForState`
- `modules/block-puzzle/engine/piece-tray-generator.ts` — export kiểu dùng cho dealer mới (không đổi luật Classic)
- `modules/block-puzzle/store/block-puzzle-game-store.ts` — `actionTimes` song song `actionLog`; `ranked-game-cloud-state.ts` (pending submission mang `times`)
- `modules/block-puzzle/store/ranked-game-cloud-sync.ts` — gửi `times`, `saveReplay`
- `modules/block-puzzle/store/parked-mode-games.ts`, `special-game-modes.ts`, `use-special-mode-launcher.tsx` — slot/mode `logic`
- `modules/player-profile/player-profile-types.ts` — `RankedGameMode` + `"logic"`
- `server/games/ranked-game-request-schemas.ts` — mode `logic`, `times`, `saveReplay`
- `server/games/create-ranked-game-session.ts`, `stored-game-session.ts` (`variantForSession`)
- `server/games/record-submitted-ranked-game.ts`, `write-leaderboard-entries.ts`
- `server/leaderboards/leaderboard-board-ids.ts`, `merge-score-into-top-list.ts`, `leaderboard-store.ts`, `leaderboard-documents.ts`, `public-leaderboard-tops.ts`
- `app/api/leaderboards/[period]/route.ts` — `?category=`
- `modules/leaderboard/leaderboard-types.ts`, `components/leaderboard-page-client.tsx`, `leaderboard-table.tsx`, `use-leaderboard-queries.ts`
- `server/daily/daily-week-rewards-store.ts` — chặn nhận thưởng hạng khi có báo cáo mở
- `server/profile/stored-player-document.ts` — `banned`, `bestReplayId`
- `modules/block-puzzle/components/game-over-dialog.tsx` — nút "Xem lại", "Vì sao thua?"
- `modules/home/components/home-mode-grid.tsx` — ô "Không bế tắc"
- `firestore.indexes.json`, `lib/routes.tsx`, translations
- `scripts/run-balance-report.ts` — tham số `--variant logic`

**Tạo**
- `modules/block-puzzle/engine/recorded-action-codec.ts` (+ test)
- `modules/block-puzzle/engine/guaranteed-tray-dealer.ts` (+ test)
- `modules/block-puzzle/engine/deal-tray-for-state.ts`
- `modules/block-puzzle/engine/game-outcome-analysis.ts` (+ test)
- `modules/replay/replay-timeline.ts` (+ test), `use-replay-player.ts`, `components/replay-viewer.tsx`, `replay-controls.tsx`, `replay-move-panel.tsx`, `replay-translations.ts`
- `modules/analysis/game-analysis.worker.ts`, `use-game-outcome-analysis.ts`, `components/game-analysis-dialog.tsx`, `analysis-translations.ts`
- `modules/public-profile/*` (types, query hook, `public-profile-view.tsx`)
- `server/replays/replay-documents.ts`, `replay-store.ts`, `should-store-replay.ts` (+ test)
- `server/players/public-player-store.ts`
- `server/games/assess-game-plausibility.ts` (+ test)
- `server/reports/report-store.ts`
- `server/leaderboards/leaderboard-categories.ts` (+ test)
- `app/api/replays/[id]/route.ts`, `app/api/players/[tag]/route.ts`, `app/api/reports/route.ts`
- `app/(main)/game/[id]/page.tsx`, `app/(main)/game/[id]/opengraph-image.tsx`
- `app/(main)/u/[tag]/page.tsx`

## Implementation Steps

### F8 — Replay + hồ sơ công khai (4 ngày)
1. `recorded-action-codec.ts`: `encodeAction`, `decodeAction`, `encodeActions`, `decodeActions` (trả null nếu bất kỳ số nào sai). Test round-trip mọi loại action + biên (row −8..15, STASH_SLOT).
2. `should-store-replay.ts` (thuần): lưu khi `summary.score > stored.stats.bestScore` (PB mới) **hoặc** có bảng mà top list thay đổi (merge trả non-null) **hoặc** `saveReplay === true` (người chơi bấm "Lưu ván", tối đa 20 replay tự lưu/người — đếm `users.savedReplays`). Không lưu ván suspect, ván 0 nước, ván > 10.000 action.
3. Trong transaction submit: `tx.set(gameReplays/{gameId}, …)`; `expireAt = now + 90 ngày`, **trừ** PB (`expireAt: null`, cập nhật `users.bestReplayId`, replay PB cũ đặt lại `expireAt = now + 90 ngày`) và ván lọt top `alltime`/`*-alltime` (`expireAt: null`). Ghi `replayId` vào entry + row top.
4. Console: TTL collection `gameReplays` field `expireAt` (doc `expireAt: null` không bị xoá).
5. `GET /api/replays/[id]` (công khai, không cần token): trả seed, stashUnlocked, mode, `levelId`, actions (số), times, score, runStats, displayName/tag/tier, ngày. **Không trả uid**. `Cache-Control: public, max-age=31536000, immutable` (replay không đổi).
6. `replay-timeline.ts`: `buildReplayTimeline(start, actions)` → mảng `GameState` (state[0] = đầu ván); dừng ở action sai (trả `brokenAt`). Variant lấy từ `variantForRun` theo mode/levelId (client), giống server.
7. `use-replay-player.ts`: index hiện tại, playing, speed (1/2/4×), tick theo `times` nếu có (nhịp thật, chặn khoảng nghỉ > 3 s), không có thì 600 ms/nước.
8. `replay-viewer.tsx`: canvas dùng `computeLayout` + `renderFrame` (view không drag; highlight ô vừa đặt + dòng vừa xoá từ `lastMove`); `replay-controls.tsx` (⏮ ◀ ▶/⏸ ▶ ⏭, slider, tốc độ, phím ←/→/Space); `replay-move-panel.tsx` (nước #, khay tại thời điểm đó, điểm, combo).
9. `/game/[id]/page.tsx`: server component đọc replay meta (Admin SDK) cho `generateMetadata` + `robots: noindex`; OG image "Tên · 12.340 điểm" (tái dùng `server/og/og-image-frame.tsx`).
10. Hồ sơ công khai: tag = `referralCode` (đã có cơ chế sinh + tra `referralCodes/{code}`). Sinh lazily ở submit khi ván lọt top (dùng lại hàm tạo mã trong `server/progression/referral-store.ts`, `tx.create` chống trùng).
11. `GET /api/players/[tag]`: tên, Bậc, Phong độ, `stats` công khai (gamesPlayed, bestScore, bestCombo, boardClears, bestPureScore), `statsByMode`, tổng sao màn, duelStats, thành tích, `bestReplayId`. Không trả xu, uid, referral info.
12. `/u/[tag]` page + link từ hàng BXH (tên → hồ sơ, điểm → replay).
13. Hộp hết ván: nút "Lưu & xem lại" (đánh dấu `saveReplay` trong pending submission; ván đã nộp → `POST /api/replays { gameId }` không cần — đơn giản: chỉ cho bấm trước khi nộp xong, sau đó dùng link từ lịch sử nếu có replayId).
14. Test: codec, timeline determinism (timeline cuối == replay server), should-store-replay, API không lộ uid.

### F7 — BXH đa hạng mục (3 ngày)
15. `leaderboard-types.ts`: `LEADERBOARD_CATEGORIES = ["score","form","pure","combo","stars"]`; kỳ hợp lệ: score = today/weekly/challenge/alltime (như cũ); form/combo/stars = alltime; pure = weekly/alltime.
16. `leaderboard-categories.ts` (thuần): `boardWritesForRankedGame({mode, now, day, countsForDaily, firstRun, summary, stored, formAfter, levelStarsTotalAfter})` →
    - điểm: như `boardIdsForRankedGame` hiện tại (policy max);
    - form: chỉ khi ván tính phong độ và `formAfter !== null` và `formAfter !== formBefore` (policy replace);
    - pure: ván classic/lượt đầu daily, `isPureRun` → `pure-weekly-*` (max) + `pure-alltime` chỉ khi `score > stored.stats.bestPureScore`;
    - combo: `combo-alltime` khi `bestCombo > stored.stats.bestCombo` (mọi chế độ tính điểm trừ challenge/level/duel);
    - stars: `stars-alltime` khi tổng sao tăng (policy max).
17. `merge-score-into-top-list.ts`: thêm `replaceScoreInTopList(top, row)` — bỏ row cũ của uid rồi chèn theo giá trị mới; nếu mới thấp hơn đáy top đầy → chỉ xoá (top tạm còn 99). Test: tăng, giảm, ra khỏi top, vào top.
18. Cron `GET|POST /api/cron/rebuild-leaderboards` (Bearer `CRON_SECRET`, tái dùng `docker/daily-reminder-cron.sh` pattern): rebuild snapshot `form-alltime` từ `entries orderBy score desc limit 100` mỗi ngày → bù chỗ trống do giảm.
19. `write-leaderboard-entries.ts`: nhận danh sách `{boardId, value, policy}`; đọc entry **chỉ** cho policy replace + bảng kỳ (weekly) — bảng alltime "max" đã lọc trước bằng stats nên chắc chắn cải thiện, vẫn đọc snapshot top để merge.
20. `leaderboard-store.ts` + route: `GET /api/leaderboards/[period]?category=score` (mặc định score, giữ tương thích). `public-leaderboard-tops.ts` render sẵn tab đầu của mỗi hạng mục.
21. UI: hàng chip hạng mục (Điểm · Phong độ · Thuần · Combo · Sao) trên tab kỳ; kỳ không hợp lệ ẩn; định dạng giá trị theo hạng mục; hàng của mình "Hạng #23 · cách #22: 140"; giải thích 1 dòng mỗi hạng mục (Phong độ = "trung vị 20 ván gần nhất").
22. Test: `boardWritesForRankedGame` theo mode; không ghi bảng khi suspect/banned; read count trong transaction (test với fake tx đếm `getAll`).

### F11 — Chống bot & báo cáo (2 ngày)
23. Store: `actionTimes: number[]` (ms từ lúc nhận seed / bắt đầu ván, `performance.now()` chuẩn hoá) song song `actionLog`; persist + parked + pending submission (optional, save cũ không có → `[]`).
24. Submit schema: `times?: number[]` (cùng độ dài actions, không giảm, ≤ 24h). Sai dạng → bỏ times (không reject ván).
25. `assess-game-plausibility.ts` (thuần):
    - `durationMs = now − session.createdAt`; `durationMs / moveCount < 250` → suspect `too-fast`;
    - có times & ≥ 50 nước: hệ số biến thiên khoảng cách giữa các nước < 0.15 → suspect `uniform-timing`; khoảng < 120 ms chiếm > 30% → `inhuman-speed`;
    - ngưỡng ở hằng số đầu file, log `suspectReason`.
26. Hệ quả suspect: không ghi BXH, không lưu replay công khai, không thưởng xu (XP + stats vẫn cộng để người thật bị nhầm không mất tiến trình); response `rewards.flagged = true` → hộp hết ván báo nhẹ "Ván không vào bảng xếp hạng".
27. `users.banned` (chỉ set bằng tay trong console): submit bỏ qua mọi bảng + thưởng.
28. `POST /api/reports { replayId, reason: "bot"|"other" }`: Bearer; tối đa 5 báo cáo/ngày/uid (đếm `users/{uid}/missions/{today}.reports`); không tự báo cáo mình; ghi `reports/{id}`.
29. `daily-week-rewards-store.ts`: thưởng hạng top 10 → nếu có `reports` status `open` với `targetUid = uid` tạo trong tuần đó → 409 `under-review` (UI: "Đang xem xét"). Quy trình xử lý: admin xem replay, đổi status `dismissed`/`confirmed` (+ `banned`). Ghi quy trình vào `docs/deployment-guide.md`.
30. Nút "Báo cáo" (cờ nhỏ) trên trang replay khi replay thuộc top 100.
31. Test plausibility: ván người thật mẫu (times ngẫu nhiên 400–3000 ms) không bị gắn cờ; bot đều 200 ms bị gắn cờ.

### F9 — Chế độ Không bế tắc (3 ngày)
32. `deal-tray-for-state.ts`: `dealTrayForState(state, board, stash?)` gom tham số `dealTray` (board, score, rng, uid, generatorState, stash) — thay **mọi** chỗ gọi trong reducer + power-ups (refactor không đổi hành vi; test hiện có xanh).
33. `guaranteed-tray-dealer.ts`: nếu `state.guaranteedTray`:
    ```
    for attempt in 0..3: deal = dealTray(...)    // rng tiến tự nhiên sau mỗi lần
      ok = canPlaceAllInSomeOrder(board, shapes(deal.tray), 6000)
      if ok === true || ok === "unknown": return deal
    return smartDeal(board)   // ép stepsBeforeSmart=2 → bộ chọn smart (luôn đặt được tuần tự)
    ```
    Tất định theo rngState → server replay ra cùng khay.
34. `createNewGame`: `guaranteedTray` lưu vào state; khay mở đầu vẫn opening tray (bàn trống luôn đặt được).
35. `LOGIC_VARIANT = { guaranteedTray: true }` trong `variant-run.ts`; `variantForSession` mode `logic`; `RankedGameMode` + schema start/session `"logic"`; `create-ranked-game-session.ts` cấp seed ngẫu nhiên, ô cất theo profile như classic.
36. Client: `GAME_MODE_SLOTS` + `"logic"`; `SpecialMode {kind:"logic"}`; query `/play?logic=1`; `Routes.PLAY_LOGIC`; ô chế độ trang chủ + giải thích 1 dòng: "Khay luôn có cách đặt hết — thua là do nước đi, không do xui".
37. Board: `logic-weekly-*`, `logic-alltime` (thêm vào F7 categories như hạng mục "Logic", kỳ weekly/alltime). Ván logic **không** tính Phong độ, không vào bảng Điểm.
38. Balance: `run-balance-report.ts --variant logic` 300 ván; nếu trung vị > 3× classic hoặc bot chạm `maxMoves` > 5% → thêm `LOGIC_DIFFICULTY` (sau 5.000 điểm dùng queue túi khối to: `selectPoolQueue` nhánh riêng) và đo lại. Ghi báo cáo `reports/balance-logic-mode.md`.
39. Benchmark: test đo `replayRecordedGame` 2.000 nước logic < 2 s (skip trên CI chậm, chạy local).
40. Test: mọi khay sinh ra trong 300 ván bot đều `canPlaceAllInSomeOrder !== false`; determinism replay.

### F10 — Phân tích sau ván (3 ngày)
41. `game-outcome-analysis.ts` (thuần):
    - Replay từ start; đánh dấu **lượt** = lúc khay vừa được chia đủ 3 khối.
    - Bỏ qua phân tích lượt có dùng Cất/Đổi khay (ghi `skipped`), dừng ở game over đầu tiên (trước Hồi sinh) — phân tích **lần chết** đó.
    - Với lượt cuối trước khi chết, lùi tối đa 10 lượt: `solvableAtStart = canPlaceAllInSomeOrder(board, trayShapes, budget)`; với từng nước trong lượt: `solvableAfter` cho các khối còn lại.
    - Nước đầu tiên có `before === true && after === false` → `decisive`; tìm gợi ý: duyệt `listPlacements` cùng khối, chọn vị trí giữ `true` và ít lỗ kín nhất (dùng `countIsolatedHoles` export từ `balance-simulator.ts` → tách sang `engine/board-heuristics.ts`).
    - Nếu lượt chết `solvableAtStart === false` và không có decisive trước đó → `verdict: "unlucky"`; có decisive → `"mistake"`; budget hết → `"unknown"`.
    - Kết quả: `{ verdict, decisive?: {moveIndex, shapeId, row, col}, suggestion?: {row, col}, holesCreated, turnsAnalyzed }`.
42. Worker `game-analysis.worker.ts` (theo cách Next 16 docs khuyến nghị `new Worker(new URL(...), { type: "module" })`); hook `useGameOutcomeAnalysis(start, actions)` — chỉ chạy khi người chơi bấm nút; timeout 5 s → "unknown".
43. `game-analysis-dialog.tsx`: 2 bàn mini (`block-board-preview.tsx`) trước/sau nước quyết định, viền đỏ vị trí đã đặt, viền xanh vị trí gợi ý; câu giải thích theo verdict; link "Xem lại nước này" (replay F8 nhảy tới `moveIndex` nếu ván đã lưu).
44. Thống kê cá nhân (local, `localStorage` qua `safe-local-storage`): đếm Xui / Sai / Không rõ → hiện ở profile "Trong 20 lần phân tích gần nhất: 35% xui, 65% sai lầm".
45. Không có gợi ý trong ván tính điểm; nút chỉ hiện ở hộp hết ván.
46. Test: bàn dựng tay có nước sai rõ ràng → đúng `decisive`; khay vô nghiệm ngay đầu → `unlucky`; determinism.

### Bước cuối (1 ngày)
47. Test/lint/tsc/build/balance (classic không đổi số).
48. QA: replay ván dài 300+ nước trên mobile; BXH từng hạng mục; logic mode 3 ván; phân tích 5 ván thua.
49. Docs: kiến trúc (replay, categories, plausibility, logic mode, analysis), roadmap v2.7, firebase guide (TTL `gameReplays`, index, cron rebuild), quy trình xử lý báo cáo.

## Todo List

- [ ] Codec action + test
- [ ] Lưu replay trong submit + TTL/pin PB/top
- [ ] API replay + timeline + viewer + controls + page + OG
- [ ] Tag công khai + API player + `/u/[tag]`
- [ ] Categories + `replaceScoreInTopList` + cron rebuild
- [ ] Route `?category=` + UI hạng mục
- [ ] actionTimes + plausibility + suspect handling
- [ ] Reports API + giữ thưởng tuần + nút báo cáo
- [ ] `dealTrayForState` refactor (không đổi hành vi)
- [ ] Guaranteed dealer + mode `logic` end-to-end + board riêng
- [ ] Balance logic + benchmark replay
- [ ] Outcome analysis + worker + dialog + local stats
- [ ] i18n, test, docs

## Success Criteria

- Mọi hàng top 100 bảng alltime có link replay chạy được, điểm cuối replay = điểm trên bảng.
- Submit ván bình thường (không kỷ lục) không tăng số read so với Phase 01 (đo bằng test fake tx).
- Logic mode: 0 khay vô nghiệm trong 300 ván bot; replay server < 2 s/2.000 nước.
- Phân tích trả kết quả < 2 s trên máy mid-range (Chrome DevTools CPU 4× slowdown) cho ván 150 nước.
- 0 false positive suspect trên 50 ván QA người thật.
- KPI: % ván thua người chơi bấm "Vì sao thua?", % người mở replay từ BXH, thời gian phiên.

## Risk Assessment

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Chi phí lưu replay tăng nhanh | TB | Chỉ lưu PB/top/được yêu cầu; TTL 90 ngày; doc ~ vài KB |
| Bảng Phong độ snapshot lệch (giảm) | TB | `replaceScoreInTopList` + cron rebuild hằng ngày; hạng của mình tính từ entries (count) nên luôn đúng |
| Refactor `dealTrayForState` đổi hành vi classic | Cao nếu sai | Refactor riêng 1 commit; test replay + `npm run balance` phải trùng số trước khi làm F9 |
| Logic mode quá dễ → điểm vô tận | TB | Bot đo trước; độ khó theo điểm riêng cho logic; mở bản beta không có thưởng hạng |
| Plausibility gắn cờ nhầm người chơi nhanh | TB | Ngưỡng bảo thủ; suspect vẫn giữ XP/stats; log để chỉnh |
| Worker + Turbopack khác biệt Windows build | Thấp | Đọc docs Next 16; fallback chạy trên main thread với `requestIdleCallback` từng lượt |
| Lộ uid qua replay/hồ sơ công khai | Cao nếu sai | Test API: không có field `uid`; tag = referral code (vốn để chia sẻ) |

## Security Considerations

- Replay + hồ sơ công khai: không uid, không xu, không referral của người khác; `noindex` cho `/game/*`, `/u/*` tuỳ chọn (câu hỏi mở #7: cho người chơi ẩn hồ sơ).
- Reports: rate limit + không cho báo cáo hàng loạt; không hiển thị người báo cáo.
- `times` từ client chỉ dùng để **hạ** độ tin (gắn cờ), không bao giờ để tăng điểm/thưởng.
- Cron rebuild dùng `CRON_SECRET` so sánh timing-safe như cron nhắc nhở.
- Decode replay luôn qua zod schema; replay hỏng → 404, không crash render.

## Next Steps

- Phase 03: mùa giải dùng categories (score/form/pure theo tháng); Arena dùng Bậc + plausibility; bài học nhận link từ phân tích (`holesCreated` → bài "Tránh tạo lỗ").
- Phase 04: ghost dùng replay + `times` để phát lại theo nhịp thật.
