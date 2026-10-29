# Phase 04 — Đối kháng & xã hội có kiểm soát (F15–F18)

## Context Links

- Plan tổng: [plan.md](./plan.md) mục 7
- Phase trước: [phase-01](./phase-01-nen-du-lieu-va-quick-wins.md) (Bậc, bộ đếm năm), [phase-02](./phase-02-chieu-sau-ky-nang-va-bang-chung.md) (replay + `times`, plausibility), [phase-03](./phase-03-thu-thach-va-mua-giai.md) (mùa tháng)
- Nghiên cứu: Phần I §7 (PvP MMR/LP/League, mùa quý, soft reset, 3 trận xác lập), Phần II §3 (ranked vs private lobby), Phần III §3 Friend quests (3 ngày, cả hai nhận thưởng), §11 (chat — lý do không làm), Phần IV §5 (spectate)
- Code: `modules/duel/*` (phòng, RTDB moves, `use-duel-board.ts`, `duel-live-boards.tsx`, `duel-versus-card.tsx`), `server/duels/*`, `database.rules.json`, `server/challenges/*`, `modules/challenge/*`, `modules/share/render-result-share-card.ts`

## Overview

| | |
|---|---|
| Priority | P3 |
| Status | Chờ điều kiện mở phase: DAU ≥ ~500 **hoặc** ≥ 20 người chơi đồng thời giờ cao điểm (đo presence) — riêng F16, F17 làm sớm được vì không phụ thuộc lượng người |
| Ước lượng | 12–15 ngày dev |
| Thứ tự | F16 (thách đấu có thưởng, rẻ) → F17 (emote) → F15 (ghost ranked) → F18 (recap, phát hành tháng 12) |

Mục tiêu: đối kháng **có xếp hạng** mà không cần hàng chờ đông người (ghost), lan truyền qua thách đấu có thưởng 2 chiều, tương tác nhẹ an toàn (emote), tổng kết năm để chia sẻ.

## Key Insights

- Minesweeper ranked cần matchmaking realtime + MMR ẩn + LP hiển thị; với lượng người hiện tại hàng chờ sẽ rỗng. Block Blast có lợi thế riêng: **seed + replay + times** → đấu với "bóng ma" (ván thật của người khác cùng seed), phát lại theo nhịp thật.
- Minesweeper tách **private lobby không tính ladder** → giữ duel phòng riêng hiện tại **không rating** để chống farm bằng tài khoản phụ.
- Báo cáo cảnh báo nhầm Rank/Ranking/League → giải đấu ghost dùng **tên khác hẳn** Bậc: Bậc (kim loại: Đồng…Cao thủ) vs Giải (Tân binh → Huyền thoại).
- Friend quest = hợp tác bất đồng bộ, hạn 3 ngày, cả hai nhận thưởng → map thẳng vào thách đấu link đã có (`challenges/{id}`).
- Chat tự do bị loại (moderation) → emote cố định qua RTDB là đủ cho cảm xúc trong trận.
- Recap năm cần dữ liệu cả năm → bộ đếm `users/{uid}/years/{YYYY}` đã bắt đầu ghi từ Phase 01.

## Requirements

**Chức năng**
- F16: thách đấu có hạn 3 ngày; người nhận vượt điểm trong hạn → cả hai +50 xu (người thách tối đa 5 lần/ngày, người nhận 1 lần/thách đấu).
- F17: 6 emote trong phòng duel (người chơi gửi, người chơi + người xem thấy), giới hạn 1 emote/3 s.
- F15: "Đấu xếp hạng" — ghép bóng ma cùng rating, cùng luật duel (không trợ giúp, 3 phút); MMR ẩn + LP + 7 giải; mùa quý; 3 trận xếp hạng đầu; BXH LP; bot ghost khi thiếu người (đánh dấu rõ).
- F18: trang + ảnh share "Năm 2026 của bạn" (15/12 → 15/01).

**Phi chức năng**
- Ghost: 1 lượt chọn ghost ≤ 3 read; không hot-doc (pool chia bucket).
- Rating cập nhật trong transaction nộp ván (atomic với stats).
- Emote: rule RTDB chặn spam & giả mạo.

## Architecture

```
F15 Ghost ranked
  POST /api/ranked/match
    ├─ đọc users.rating (mmr, lp, placements) 
    ├─ chọn ghost: ghostPool/{bucket}/games (bucket = floor(mmr/100)) ±1..±3 bucket, loại chính mình + 10 đối thủ gần nhất
    │      không có → bot ghost (bucket gần nhất, đánh dấu isBot)
    ├─ tạo session mode "ranked" {ghostReplayId, ghostMmr, ghostUid?} seed = seed của ghost
    └─ trả { gameId, seed, ghost: { name, tier, league, actions[], times[], isBot }, endsAt }
  Client: bàn mình + bàn ghost phát lại theo times (useGhostBoard) → hết 3 phút / chết → nộp
  Submit (mode ranked): replay (DUEL_VARIANT + giới hạn 3 phút server) → so điểm với ghost.score
    → ratingAfterMatch() → users.rating; chủ ghost (người thật) ± nửa delta (+1 write)
    → ván của mình (không suspect) vào ghostPool bucket của mình
  Mùa quý: rankedSeasonKey = "2026-Q4"; đầu quý soft reset LP = round(LP * 0.5), placements = 0

F16 Thách đấu có thưởng: submit mode challenge → đọc challenge doc (đã đọc) + creator user doc (+1 read khi đủ điều kiện)
F17 Emote: RTDB /duels/{code}/emotes/{uid} = { e, at }   (rules)
F18 Recap: GET /api/recap/{year} ← users/{uid}/years/{year} + profile → share card
```

**Rating (`modules/ranked/rating-rules.ts`, thuần)**
```
MMR khởi tạo 1000; expected = 1 / (1 + 10^((mmrGhost − mmrMe)/400))
result: thắng 1 / hoà 0.5 / thua 0 (so điểm cuối; chênh ≤ 2% = hoà)
K = 48 trong 3 trận placement, sau đó 24; bot ghost: K/2
mmrDelta = round(K × (result − expected))
LP: placement xong → LP = clamp((mmr − 700) / 1.5, 0, 650)
    sau đó lpDelta = round(20 × (result − expected) × 2 + clamp((mmr − lpToMmr(lp)) / 50, −5, 5))   // kéo LP về MMR như MS
Giải theo LP: Tân binh 0 · Chiến binh 100 · Hiệp sĩ 200 · Đại hiệp 300 · Tông sư 400 · Võ thánh 500 · Huyền thoại 600
```
(Không dùng tên kim loại/"Cao thủ" để khỏi trùng với Bậc của Phase 01.)

**Firestore mới**
```
users/{uid}: rating { mmr, lp, placements, season, wins, losses, draws, recentOpponents[] }
ghostPool/{bucket}/games/{gameId}: { uid|null, displayName, tier, mmr, seed, replayId, score, isBot, createdAt, expireAt(+30 ngày) }
gameSessions: + ghostReplayId, ghostScore, ghostUid, ghostMmr, ghostIsBot (mode "ranked")
leaderboards/ranked-lp-{2026-Q4} (+ entries; policy replace)
challenges/{id}: + expiresAt, rewardedUids: {uid: true}
users/{uid}: + challengeRewardDay, challengeRewardCount
RTDB /duels/{code}/emotes/{uid}: { e: 0..5, at }
```

## Related Code Files

**Sửa**
- `modules/player-profile/player-profile-types.ts` (`RankedGameMode` + `"ranked"`, `PlayerProfile.rating`, `GameRewards.ranked`)
- `server/games/ranked-game-request-schemas.ts`, `stored-game-session.ts` (`variantForSession` ranked = `DUEL_VARIANT`)
- `server/games/record-submitted-ranked-game.ts` (nhánh ranked, nhánh challenge reward) — **tách** nhánh theo mode thành `submit-mode-handlers/*.ts` trước khi thêm (file sẽ vượt 200 dòng)
- `server/leaderboards/leaderboard-categories.ts` (hạng mục `ranked`, kỳ quý)
- `server/profile/stored-player-document.ts`
- `server/challenges/challenge-store.ts`, `challenge-documents.ts`, `challenge-page-data.ts`
- `modules/challenge/components/challenge-landing.tsx`, `modules/block-puzzle/components/game-over-dialog.tsx` (dòng thưởng thách đấu)
- `modules/duel/components/duel-live-boards.tsx`, `duel-opponent-strip.tsx`, `duel-room-view.tsx`
- `database.rules.json`
- `modules/game-modes/variant-run.ts` (`VariantRun` kind `ranked`)
- `modules/block-puzzle/special-game-modes.ts`, `use-special-mode-launcher.tsx`
- `modules/home/components/home-mode-grid.tsx`, `lib/routes.tsx`, translations
- `modules/share/render-result-share-card.ts` (biến thể recap)

**Tạo**
- `modules/ranked/rating-rules.ts` (+ test), `league-catalog.ts`, `ranked-season.ts` (+ test), `ranked-types.ts`, `ranked-translations.ts`
- `modules/ranked/use-ghost-board.ts`, `components/ranked-lobby.tsx`, `ranked-versus-intro.tsx`, `ranked-result-panel.tsx`, `league-badge.tsx`
- `server/ranked/ghost-pool-documents.ts`, `pick-ghost.ts` (+ test), `apply-ranked-result.ts` (+ test), `seed-bot-ghosts.ts` (script)
- `app/api/ranked/match/route.ts`, `app/api/ranked/route.ts` (trạng thái + BXH), `app/(main)/ranked/page.tsx`
- `scripts/seed-bot-ghost-pool.ts`
- `modules/duel/use-duel-emotes.ts`, `components/duel-emote-bar.tsx`
- `server/recap/year-recap-store.ts`, `app/api/recap/[year]/route.ts`, `app/(main)/recap/[year]/page.tsx`, `modules/recap/*`
- `server/games/submit-mode-handlers/*` (tách từ record-submitted)

## Implementation Steps

### F16 — Thách đấu có thưởng 2 chiều (2 ngày, làm sớm được)
1. `challenge-store.ts` tạo thách đấu: `expiresAt = createdAt + 3 ngày`, `rewardedUids: {}`. Thách đấu cũ không có `expiresAt` → không có thưởng (giữ hành vi cũ).
2. Submit mode `challenge` (đã đọc challenge doc): đủ điều kiện = `uid ≠ creatorUid` && `now < expiresAt` && `!rewardedUids[uid]` && `summary.score > creatorScore` && không suspect && `moveCount ≥ 10` → đọc creator user doc (+1 read) → người nhận +50 xu; người thách +50 xu nếu `challengeRewardDay !== today || challengeRewardCount < 5` (reset theo ngày VN); ghi `rewardedUids.{uid} = true`.
3. Chặn farm bằng tài khoản phụ: người nhận phải có `stats.gamesPlayed ≥ 5` **trước** ván này và tài khoản tạo > 24 giờ (`createdAt` user doc) — tài khoản ẩn danh mới tạo hàng loạt không nhận được.
4. `rewards.challenge = { coins, creatorRewarded }` → hộp hết ván: "Bạn vượt điểm! +50 xu cho bạn và {tên}".
5. Trang `/c/[id]` + landing: đếm ngược "Còn 2 ngày 5 giờ · vượt điểm để cả hai nhận 50 xu"; hết hạn → vẫn chơi được, không thưởng.
6. Test: hết hạn, tự thách mình, nhận 2 lần, giới hạn 5/ngày người thách, tài khoản mới.

### F17 — Emote trong phòng duel (1 ngày, làm sớm được)
7. `database.rules.json` thêm:
   ```json
   "emotes": { "$uid": { ".write": "auth.uid === $uid && (root.child('duels/'+$code+'/state/hostUid').val() === auth.uid || root.child('duels/'+$code+'/state/guestUid').val() === auth.uid)",
     ".validate": "newData.hasChildren(['e','at']) && newData.child('e').isNumber() && newData.child('e').val() >= 0 && newData.child('e').val() <= 5 && newData.child('at').val() === now && (!data.exists() || now - data.child('at').val() >= 3000)" } }
   ```
   (Điều chỉnh đường dẫn theo cấu trúc `state` thật trong `database.rules.json`; đọc: ai biết mã phòng + đăng nhập, như state.)
8. `use-duel-emotes.ts`: gửi (`set` với `serverTimestamp`), nghe `onValue` 2 uid → sự kiện mới (at thay đổi) → hiển thị 2 s.
9. `duel-emote-bar.tsx`: 6 nút 👍 😮 😂 🔥 😭 GG dưới bàn (ẩn khi là người xem); emote nổi trên `duel-opponent-strip.tsx`/bàn tương ứng; tôn trọng `reduceMotion` (F6). Tắt emote trong cài đặt (ẩn emote của đối thủ).
10. Publish rules (ghi chú trong roadmap như v2.3).

### F15 — Đấu xếp hạng với bóng ma (8 ngày)
11. `rating-rules.ts` (thuần) theo công thức ở Architecture; `league-catalog.ts` (7 giải, LP mốc 100); `ranked-season.ts` (`rankedSeasonKeyFor(now)` = quý giờ VN, `softResetRating`). Test đầy đủ: placement, hoà, bot K/2, LP kéo về MMR, soft reset.
12. Ghost pool: `ghostPoolRef(bucket)`; `pick-ghost.ts`: thử bucket của mình → ±1 → ±2 → ±3 (mỗi bước 1 query `orderBy(random) limit 5` — dùng field `rand` ngẫu nhiên lưu sẵn + `where rand >= r limit 5`, fallback `rand < r`); loại `uid === me` và `recentOpponents`; không có → bot.
13. `scripts/seed-bot-ghost-pool.ts`: bot `chooseMove` với nhiễu (ε-greedy 0/10/25/40%) chơi luật duel 3 phút giả lập (times = khoảng 700–1500 ms ngẫu nhiên có seed) → lưu replay (`gameReplays`) + `ghostPool` với `isBot: true`, `uid: null`, MMR ước lượng theo điểm. Chạy 1 lần khi mở tính năng + khi bucket rỗng.
14. `POST /api/ranked/match`: kiểm không có session ranked đang mở chưa nộp (409), đọc rating (soft reset nếu sang quý mới), chọn ghost, đọc replay ghost (actions + times), tạo session `{mode: "ranked", seed: ghost.seed, ghostReplayId, ghostScore, ghostUid, ghostMmr, ghostIsBot, endsAt: now + 5s đếm ngược + 3 phút}`. Trả ghost **không có uid**.
15. Client: `VariantRun` kind `ranked` `{gameId, ghost, startAt, endsAt, clockOffset}`; không cất (như duel); `ranked-versus-intro.tsx` (tên, Bậc, giải ghost; nhãn "Máy" nếu bot) đếm ngược 5 s; màn chơi dùng layout duel (`duel-live-boards.tsx` nhận nguồn bàn đối thủ trừu tượng: `useDuelBoard` (RTDB) **hoặc** `useGhostBoard` (replay theo `times` + giờ hiện tại)); hết giờ → `endVariantRun()`.
16. Submit mode `ranked`: replay `DUEL_VARIANT`; `durationMs ≤ 3 phút + 5 s + 10 s grace`, quá → tính điểm tại… (không cắt được log theo thời gian vì không có timestamp server từng nước) → **thua** (trừ khi đã game over trước hạn: client luôn nộp ngay). So `summary.score` vs `ghostScore` → `apply-ranked-result.ts` → ghi `users.rating`, `recentOpponents` (≤10), BXH `ranked-lp-{quý}` (policy replace); chủ ghost người thật: `mmr ± round(delta/2)`, LP ± nửa (ghi merge vào doc họ — chỉ field rating, `FieldValue.increment` để tránh đọc thêm; chấp nhận LP có thể lệch nhẹ, cron chuẩn hoá cuối mùa). Suspect → không đổi rating, không vào pool.
17. Ván ranked hợp lệ của mình → `gameReplays` (luôn lưu cho ranked, TTL 30 ngày) + `ghostPool/{bucket(mmrAfter)}` (TTL 30 ngày).
18. `/ranked`: giải + LP + thanh tiến độ tới giải sau, nút "Đấu xếp hạng", lịch sử 10 trận (từ `users/{uid}/games` mode ranked), BXH LP quý; thông tin mùa quý (ngày kết thúc, thưởng cuối quý theo giải: huy hiệu + xu 100→1.500, nhận ở quý sau như F12).
19. `ranked-result-panel.tsx`: thắng/thua/hoà, LP ±, MMR ẩn **không hiển thị**, nút "Xem lại trận" (2 bàn replay song song — tái dùng `replay-viewer` F8 với 2 timeline).
20. Duel phòng riêng **không đổi**, thêm dòng "Trận phòng riêng không tính xếp hạng" ở `duel-rules-tiles.tsx`.
21. Khi đủ người (≥ 20 đồng thời): bước mở rộng — hàng chờ realtime `rankedQueue/{bucket}` trên RTDB tạo phòng duel tự động; ghost là fallback sau 20 s. **Chỉ lên kế hoạch, chưa code trong phase này.**
22. Test: pick-ghost loại chính mình/đối thủ gần đây, rating atomic, nộp trễ = thua, bot ghost K/2, soft reset khi sang quý.

### F18 — Tổng kết năm (2 ngày, phát hành ~15/12)
23. `GET /api/recap/[year]`: đọc `users/{uid}/years/{year}` + profile → `{ games, totalScore, lines, bestScore, bestCombo, boardClears, pureGames, days, favoriteMode, longestStreak (streak.best), peakTier (nếu có lịch sử seasonPeak), arenaPoints, levelStars }`; mở từ 15/12 tới 15/01 năm sau.
24. `/recap/[year]`: các "thẻ" lật (số ván, kỷ lục, combo, ngày chơi, chế độ yêu thích, Bậc cao nhất); nút share → `render-result-share-card.ts` biến thể recap 1080×1080 (không lộ uid).
25. Banner trang chủ + hộp hết ván trong khoảng thời gian mở; push 1 lần (tái dùng `send-daily-reminders` với template riêng, tôn trọng người đã tắt nhắc).
26. Test: năm không có dữ liệu → trang "Chưa có dữ liệu năm nay"; ngoài khoảng thời gian → 404.

### Bước cuối (1 ngày)
27. Test/lint/tsc/build; deploy `database.rules.json` (emote); seed bot ghost; bật TTL `ghostPool` collection group.
28. QA: 2 tài khoản đấu ghost nhau (A chơi trước, B gặp ghost A), emote giữa 2 máy + người xem, thách đấu có thưởng end-to-end.
29. Docs: kiến trúc (ranked/ghost, rating, emote, recap, challenge reward), roadmap v3.0, firebase guide (TTL ghostPool, rules mới).

## Todo List

- [ ] F16 expiresAt + thưởng 2 chiều + chống tài khoản phụ + UI
- [ ] F17 rules RTDB + hook + thanh emote + cài đặt tắt
- [ ] Tách `record-submitted-ranked-game.ts` theo mode handler
- [ ] F15 rating/league/season rules + test
- [ ] Ghost pool + pick-ghost + seed bot ghosts
- [ ] API match + session ranked + submit ranked + rating chủ ghost
- [ ] Client ranked (intro, ghost board, kết quả, `/ranked`, BXH LP)
- [ ] F18 API + trang + share card + banner/push
- [ ] i18n, test, docs, deploy rules

## Success Criteria

- Người chơi luôn tìm được trận xếp hạng < 2 s (ghost người hoặc bot), kể cả lúc chỉ 1 người online.
- Rating cập nhật atomic với stats; không có đường farm LP bằng phòng riêng hoặc tài khoản phụ (test).
- Emote: không gửi được nhanh hơn 3 s, không gửi thay người khác (test rules bằng emulator).
- Thách đấu có thưởng: K-factor (người mới từ link thách đấu / người gửi) đo được, mục tiêu ≥ 0.2.
- Recap: share được trên iOS/Android (Web Share API, fallback copy).

## Risk Assessment

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Người chơi thấy đấu "máy" là lừa | TB | Luôn ghi nhãn "Máy" cho bot ghost; bot ghost K/2; ưu tiên ghost người |
| Ghost lộ trước điểm cuối (client có actions) → biết mục tiêu | Thấp | Chấp nhận: giống xem đối thủ trực tiếp; luật là so điểm cuối |
| Ghi rating chủ ghost gây tranh chấp transaction | Thấp | `FieldValue.increment`, không đọc doc chủ ghost |
| Farm thưởng thách đấu bằng tài khoản phụ | TB | Điều kiện ≥ 5 ván + tài khoản > 24 h + giới hạn 5/ngày |
| Emote bị dùng quấy rối | Thấp | Chỉ 6 emote cố định, rate limit, tắt emote đối thủ |
| Phụ thuộc lượng người (pool mỏng → gặp lại cùng người) | TB | `recentOpponents`, mở rộng bucket ±3, bot fill |

## Security Considerations

- Ghost API không trả uid; chủ ghost hiển thị bằng tên + tag công khai (F8).
- Rating chỉ server ghi; client không gửi kết quả trận, chỉ actions.
- RTDB rules emote: chỉ thành viên phòng, đúng uid, `at == now`, rate limit trong rule.
- Recap chỉ trả dữ liệu của uid trong token; ảnh share không chứa uid.
- Tài khoản bị `banned` (F11): không vào pool, không nhận thưởng thách đấu, không đấu xếp hạng.

## Next Steps

- Khi ≥ 20 người đồng thời: lên plan riêng cho hàng chờ realtime (bước 21) dùng hạ tầng duel RTDB.
- Sau 1 quý ranked: xem phân phối LP để chỉnh mốc giải và hệ số kéo LP→MMR.
- Xem lại danh sách "Chưa làm" trong plan.md mục 8 (news feed, giải đấu cuối tuần) với số liệu DAU mới.
