# Phase 03 — Thử thách & mùa giải (F12–F14)

## Context Links

- Plan tổng: [plan.md](./plan.md) mục 6
- Phase trước: [phase-01](./phase-01-nen-du-lieu-va-quick-wins.md) (Phong độ/Bậc, nhiệm vụ band), [phase-02](./phase-02-chieu-sau-ky-nang-va-bang-chung.md) (categories, replay, plausibility, analysis)
- Nghiên cứu: Phần I §1 (Season leaders, mùa tháng), §4 (Rank mở nội dung), §6 (Arena points 80/80E); Phần II §4 (Arena 10 loại × L1–L8, vé, giới hạn giờ, phạt), §10 (Patterns/Guides); Phần III §3 (season quests), §4 (vé Arena), §7 (event, championship)
- Code: `server/daily/daily-week-rewards-store.ts` (mẫu thưởng hạng kỳ đã chốt), `server/daily/daily-challenge-calendar.ts`, `modules/game-modes/*` (variant, level catalog, sao), `modules/duel/*` (đồng hồ server, `endVariantRun`), `engine/tutorial.ts`, `components/game-tutorial.tsx`

## Overview

| | |
|---|---|
| Priority | P2 |
| Status | Chưa bắt đầu, chờ Phase 02 (cần categories + plausibility) |
| Ước lượng | 14–17 ngày dev |
| Thứ tự | F12 (mùa) → F13 (Arena) → F14 (bài học). F14 độc lập, làm song song được |

Mục tiêu: nhịp **reset hằng tháng** để người mới có cơ hội; **Arena-lite** làm cầu nối kỹ năng ↔ phần thưởng và là **chỗ tiêu xu** chính; **bài học kỹ thuật** biến phân tích sau ván thành học tập + SEO.

## Key Insights

- Daily week đã có mẫu hoàn chỉnh "bảng kỳ → chốt sau grace 1 giờ → thưởng hạng tính bằng `count()` → nhận ở kỳ sau → đánh dấu đã nhận" (`daily-week-rewards-store.ts`). Mùa tháng **tái dùng y nguyên mẫu này**.
- Phong độ đã là cửa sổ trượt 20 ván → bản thân nó tự "làm mới"; "soft reset" kiểu PvP **không cần** cho Bậc. Mùa chỉ reset **bảng** + ghi nhận **Bậc cao nhất trong mùa** làm huy hiệu.
- Arena Minesweeper: điểm Arena = cấp cao nhất đã qua mỗi loại (không cộng dồn). Áp nguyên tắc này để không farm.
- Vé rơi ngẫu nhiên (ô vàng) của Minesweeper cần bàn ô; Block Blast không có chỗ tự nhiên → **vé = xu**. Xu hiện chỉ tiêu cho 2 theme → Arena giải quyết lạm phát.
- Đồng hồ: duel đã có `startAt/endsAt` server + `clockOffset` + `endVariantRun` → Arena Tốc độ dùng cùng cơ chế. Server kiểm `finishedAt − createdAt ≤ limit + grace` là đủ (chậm hơn = thua; nhanh hơn không có lợi).
- Tutorial engine chạy trên state tạm, không đụng save → nền cho bài học. Bài học muốn có thưởng thì server phải replay được → dùng reducer chuẩn + **khay cố định** (variant mới).

## Requirements

**Chức năng**
- F12: mùa = tháng lịch giờ VN; bảng mùa Điểm/Phong độ/Thuần; huy hiệu mùa theo Bậc cao nhất trong mùa; thưởng hạng mùa nhận ở mùa sau; 5 nhiệm vụ mùa.
- F13: 5 loại × 5 cấp; trả xu để mở lượt; cấp cao cần Bậc; mỗi lượt có số lần thử/thời hạn; thắng nhận xu/XP; điểm Arena (≤ 25) trên hồ sơ + thành tích + nhiệm vụ.
- F14: 12 bài kỹ thuật (bàn + khay cố định + mục tiêu), trang SEO mỗi bài, thưởng 1 lần/bài (server xác minh), link từ phân tích sau ván.

**Phi chức năng**
- Không thêm hot-doc (doc bị ghi bởi mọi người chơi).
- Arena: 1 lượt mở tối đa/người; giao dịch xu trong transaction (không âm xu).
- Bài học hoạt động offline (thưởng nộp khi có mạng).

## Architecture

```
Mùa (F12)
  seasonKeyFor(now) = "YYYY-MM" (giờ VN)          server/seasons/season-calendar.ts
  submit → boardWrites += season-score-*, season-form-*, season-pure-*   (categories F7, kỳ "season")
         → users.seasonPeak = { season, tier } (nâng khi tier cao hơn)
         → users/{uid}/seasons/{key}.progress (nhiệm vụ mùa), games
  POST /api/seasons/claim { season } → thưởng hạng + huy hiệu (mẫu daily week)

Arena (F13)
  POST /api/arena/runs {type, level} ─tx─► kiểm Bậc, xu ≥ phí, không có run mở → trừ xu, tạo arenaRuns/{runId}
  POST /api/games/start {mode:"arena", arenaRunId} → session {arenaRunId, attempt, seed, endsAt?}
  submit → replay(variant từ catalog) → evaluateArenaAttempt(def, summary, timing) → cập nhật run
          won → xu/XP, users.arena[type] = max(level)
  GET /api/arena → catalog trạng thái + run đang mở

Bài học (F14)
  lesson-catalog: { slug, board, trays[][], goal, hints[] }
  GameVariant.fixedTrays → dealTrayForState trả khay kế tiếp trong danh sách
  Chơi local (canvas riêng) → POST /api/lessons/complete {slug, actions} → server replay → xu 1 lần
```

**Firestore mới**
```
leaderboards/season-{score|form|pure}-YYYY-MM (+ entries)
users/{uid}: seasonPeak {season, tier}, seasonBadges: string[], arena: {speed:n, pure:n, obstacle:n, combo:n, endurance:n},
             arenaRunOpen: runId|null, coinsEarnedTotal, coinsSpentTotal, lessonsDone: string[]
users/{uid}/seasons/{YYYY-MM}: { progress, claimedMissions[], games, rankClaimed }
arenaRuns/{runId}: { uid, type, level, status: open|won|lost|expired, attempts, gamesDone, bestValue,
                     createdAt, expiresAt, entryCoins }
gameSessions: + arenaRunId, attempt, endsAt
```

## Related Code Files

**Sửa**
- `server/leaderboards/leaderboard-board-ids.ts`, `server/leaderboards/leaderboard-categories.ts` (kỳ `season`)
- `modules/leaderboard/leaderboard-types.ts` (+ period `season`), `components/leaderboard-page-client.tsx`
- `server/games/record-submitted-ranked-game.ts` (mùa, arena evaluate), `server/games/create-ranked-game-session.ts`, `stored-game-session.ts`, `ranked-game-request-schemas.ts`
- `server/profile/stored-player-document.ts`, `modules/player-profile/player-profile-types.ts`
- `server/progression/apply-progression-for-verified-game.ts` (nhiệm vụ mùa, kind `arena`)
- `server/progression/theme-shop-store.ts` (ghi `coinsSpentTotal`)
- `modules/progression/daily-mission-catalog.ts` (kind `arena`; tách hàm tiến độ chung)
- `modules/progression/achievement-catalog.ts` (`arena-10`, `arena-25`, `season-gold`, `lessons-all`)
- `modules/game-modes/variant-run.ts` (`VariantRun` kind `arena`), `modules/block-puzzle/engine/game-types.ts` (`fixedTrays`)
- `modules/block-puzzle/engine/deal-tray-for-state.ts` (nhánh `fixedTrays`)
- `modules/block-puzzle/special-game-modes.ts`, `use-special-mode-launcher.tsx`, `game-hud-score-bar.tsx`
- `modules/game-modes/components/game-over-variant-section.tsx` (kết quả Arena)
- `modules/home/components/home-mode-grid.tsx`, `home-daily-card.tsx` (thẻ mùa)
- `modules/analysis/components/game-analysis-dialog.tsx` (link bài học)
- `app/(main)/how-to-play/page.tsx`, `app/sitemap.ts`, `lib/routes.tsx`, translations

**Tạo**
- `server/seasons/season-calendar.ts` (+ test), `season-rewards-store.ts`, `app/api/seasons/route.ts`, `app/api/seasons/claim/route.ts`
- `modules/progression/season-rules.ts` (thưởng hạng mùa, huy hiệu) (+ test), `season-mission-catalog.ts` (+ test)
- `modules/progression/mission-progress.ts` (hàm tiến độ dùng chung ngày/mùa)
- `modules/season/components/season-card.tsx`, `season-page-client.tsx`, `season-translations.ts`; `app/(main)/season/page.tsx`
- `modules/game-modes/arena-catalog.ts` (+ test), `arena-goal-rules.ts` (+ test), `components/arena-grid.tsx`, `arena-run-card.tsx`, `arena-hud-goal.tsx`, `arena-translations.ts`
- `server/arena/arena-run-documents.ts`, `arena-run-store.ts`, `evaluate-arena-attempt.ts` (+ test)
- `app/api/arena/route.ts`, `app/api/arena/runs/route.ts`, `app/(main)/arena/page.tsx`
- `modules/lessons/lesson-catalog.ts` (+ test bot giải được), `lesson-rules.ts`, `components/lesson-player.tsx`, `lesson-list.tsx`, `lessons-translations.ts`
- `server/lessons/complete-lesson.ts`, `app/api/lessons/complete/route.ts`
- `app/(main)/how-to-play/[technique]/page.tsx`

## Implementation Steps

### F12 — Mùa giải tháng (4 ngày)
1. `season-calendar.ts`: `seasonKeyFor(now)`, `seasonBounds(key)` (00:00 ngày 1 giờ VN → 00:00 ngày 1 tháng sau), `previousSeasonKey`, `isSeasonOpen(key, now)` với grace 1 giờ (giống `CHALLENGE_WEEK_GRACE_MS`).
2. Categories F7: thêm kỳ `season` cho score (max), form (replace), pure (max). Board id `season-score-2026-11`… Form mùa chỉ ghi khi ván thuộc mùa hiện tại.
3. Submit: `seasonPeak` — nếu `season` khác mùa hiện tại → reset về `{season: now, tier: tierAfter}`; cùng mùa → nâng nếu cao hơn. Ghi `users/{uid}/seasons/{key}` (merge): `games += 1`, tiến độ nhiệm vụ mùa.
4. `season-rules.ts`: thưởng hạng (bảng score mùa): top 1 = 2.000, top 3 = 1.200, top 10 = 800, top 100 = 300, tham gia (≥ 20 ván trong mùa) = 100 xu; huy hiệu `season-YYYY-MM-{tier}` theo `seasonPeak.tier` (chỉ khi ≥ 20 ván).
5. `POST /api/seasons/claim { season }`: chỉ mùa đã đóng; transaction đọc entry + `count()` (ngoài transaction như week, rồi xác nhận) → cộng xu, thêm huy hiệu, `rankClaimed = true`. Chặn khi có báo cáo mở (F11). **Thưởng chỉ trao khi bảng đã chốt** — giống week.
6. `season-mission-catalog.ts`: 5 nhiệm vụ/mùa tất định theo key: `lines` (500/800/1200 theo band đầu mùa), `dailyDays` (15 ngày có lượt daily), `tierReach` (đạt Bậc ≥ band+1), `levelStars` (+10 sao trong mùa), `pureScore` (1 ván thuần ≥ X), `duelGames` (10 trận), `arenaWins` (3 lượt Arena thắng — chỉ khi F13 đã bật). Thưởng 150–400 xu + 200–500 XP; nhận bằng nút (không tự cộng — tạo thói quen quay lại).
7. `mission-progress.ts`: tách `advanceMissions(missions, progress, values)` dùng chung ngày/mùa (DRY với `advanceDailyMissions`).
8. `GET /api/seasons`: mùa hiện tại (key, endsAt, hạng của mình ở 3 bảng, nhiệm vụ + tiến độ, peak), mùa trước (thưởng có nhận được không).
9. UI: `/season` (đếm ngược, 3 tab bảng, nhiệm vụ mùa, huy hiệu dự kiến); thẻ mùa nhỏ ở trang chủ; huy hiệu mùa ở hồ sơ (+ hồ sơ công khai); tab "Mùa" ở `/leaderboard`.
10. Test: ranh giới tháng giờ VN (23:59 ngày cuối tháng UTC+7), grace, claim 2 lần → 409, chưa đủ 20 ván → chỉ không có huy hiệu/tham gia.

### F13 — Đấu trường (Arena-lite) (6 ngày)
11. `arena-catalog.ts` (thuần, dùng chung client/server):

    | Loại | Mục tiêu theo cấp L1 → L5 | Biến thể | Lượt | Phí (xu) | Thưởng (xu/XP) | Bậc cần |
    |---|---|---|---|---|---|---|
    | `speed` | 800 / 1.500 / 2.500 / 3.500 / 5.000 điểm trong 2 / 2 / 3 / 3 / 4 phút | thường | 3 lần thử / 30 phút | 30/60/100/180/300 | 75/150/250/450/750 · 40→200 | L3: Vàng, L4: Bạch kim, L5: Kim cương |
    | `pure` | 800 / 1.500 / 2.500 / 4.000 / 6.000 điểm | `noPowerUps`, `noRevive` | 3 lần / 60 phút | như trên | như trên | như trên |
    | `obstacle` | xoá 6/8/10/12/15 dòng trong 25/30/35/40/45 nước | `startBoard` (pattern khó từ `board-patterns.ts`, thêm 5 pattern mới), `moveLimit` | 3 lần / 60 phút | | | |
    | `combo` | combo ≥ 6/8/11/14/18 trong 1 ván | thường | 3 lần / 60 phút | | | |
    | `endurance` | 3/3/4/4/5 ván liên tiếp, mỗi ván ≥ 600/1.000/1.500/2.000/3.000 | thường | 1 lỗi = thua / 24 giờ | | | |

    Số liệu là **đề xuất ban đầu** — bước 18 dùng bot đo tỉ lệ thắng mục tiêu ~70% (L1) → ~15% (L5) với bot tham lam.
12. `arena-goal-rules.ts`: `evaluateAttempt(def, summary, { durationMs })` → `{ met: boolean, value }` (speed: `score ≥ X && durationMs ≤ limit + 10s`; pure: score (engine đã chặn trợ giúp); obstacle: `linesCleared ≥ X` trong moveLimit; combo: `runStats.bestCombo ≥ X`; endurance: `score ≥ X`). `nextRunState(run, attemptResult)`:
    - speed/pure/obstacle/combo: met → `won`; không met → attempts+1, hết lượt → `lost`.
    - endurance: met → gamesDone+1, đủ N → `won`; không met → `lost`.
    - quá `expiresAt` → `expired` (= lost, không hoàn xu).
13. `arena-run-store.ts`:
    - `startArenaRun(uid, type, level)`: transaction — Bậc (từ `recentFormScores`) đủ; `coins ≥ fee`; `arenaRunOpen` null hoặc run đó đã hết hạn; trừ xu, `coinsSpentTotal += fee`, tạo run, set `arenaRunOpen`.
    - `abandonArenaRun` (bỏ lượt, mất phí) — để người chơi thoát kẹt.
14. `create-ranked-game-session.ts`: mode `arena` + `arenaRunId` → kiểm run thuộc uid, `open`, chưa hết hạn, không có session attempt đang mở chưa nộp (chặn chơi song song) → session `{arenaRunId, attempt, endsAt?}` (speed: `endsAt = createdAt + limit`); seed ngẫu nhiên; variant từ catalog (**client không gửi variant**).
15. Submit: mode `arena` → replay với variant catalog → `durationMs = now − createdAt` → `evaluateAttempt` → cập nhật run (cùng transaction, đọc run doc +1 read) → won: cộng thưởng, `users.arena[type] = max(level)`, `arenaRunOpen = null`; lost: `arenaRunOpen = null`. Không vào bất kỳ BXH nào, không tính Phong độ; vẫn cộng stats/XP cơ bản/nhiệm vụ ngày. Suspect (F11) → attempt tính là không đạt.
16. Client: `VariantRun` kind `arena` `{runId, type, level, attempt, endsAt?, clockOffset}`; **không cất** (như duel — rời ván = mất lượt thử, có hỏi xác nhận); speed hết giờ → `endVariantRun()` rồi tự nộp; HUD `arena-hud-goal.tsx` (mục tiêu + tiến độ + đồng hồ nếu có, tái dùng HUD level/duel).
17. `/arena`: lưới 5×5 (`arena-grid.tsx`): khoá theo Bậc, phí, thưởng, ✓ cấp đã qua, điểm Arena tổng (`sum(arena[type])`, tối đa 25); `arena-run-card.tsx` lượt đang mở (lần thử còn lại, hạn). Hộp hết ván: kết quả lần thử + nút "Thử lần nữa" (nếu còn lượt).
18. Bot cân bằng: script `scripts/run-arena-balance.ts` (bot `chooseMove` × 200 lượt/cấp) → bảng tỉ lệ thắng → chỉnh catalog. Lưu `reports/arena-balance.md`.
19. Kinh tế: `coinsEarnedTotal`/`coinsSpentTotal` trên user doc (cộng ở mọi chỗ cộng/trừ xu: submit, claim daily/week/season, shop theme, arena). Script đọc Firestore tính tỉ lệ tiêu/kiếm toàn hệ thống (không hot-doc).
20. Liên kết: nhiệm vụ ngày kind `arena` ("Thắng 1 lượt Đấu trường", chỉ xuất hiện khi Bậc ≥ Đồng & đã từng chơi Arena), thành tích `arena-10`, `arena-25`, nhiệm vụ mùa `arenaWins`.
21. Test: không âm xu (2 request song song), Bậc không đủ → 403, run hết hạn, endurance 1 lỗi → lost, speed nộp trễ → không đạt, variant đúng catalog khi replay.

### F14 — Bài học kỹ thuật (4 ngày)
22. `GameVariant.fixedTrays?: string[][]` (shapeId) — `dealTrayForState`: còn khay trong danh sách → chia theo danh sách (màu theo rng), hết → chia thường. Test determinism.
23. `lesson-catalog.ts`: 12 bài — slug, tiêu đề, bàn (`string[]` 8 dòng như `duelBoardRows`), `fixedTrays`, mục tiêu (`lines` / `surviveTurns` / `combo` / `boardClear`), `hints[]` (vị trí gợi ý từng bước), `technique` (khoá liên kết từ phân tích). Danh sách:
    1. Giữ ô 3×3 trống · 2. Không tạo lỗ kín · 3. Ưu tiên mép và góc · 4. Xoá 2 dòng cùng lúc · 5. Chuẩn bị hàng + cột giao nhau · 6. Giữ combo qua 3 nước · 7. Dọn sạch bàn · 8. Dùng ô Cất cho khối khó · 9. Khi nào nên Đổi khay · 10. Thứ tự đặt 3 khối · 11. Khối dài 1×5 · 12. Cứu bàn gần đầy.
    Test: bot (hoặc lời giải mẫu trong catalog) giải được mọi bài; lời giải mẫu replay qua reducer đạt mục tiêu.
24. `lesson-player.tsx`: canvas + pointer controller trên **state cục bộ** (theo cách `game-tutorial.tsx`), không đụng save; gợi ý bật/tắt (bài học **được** gợi ý); chơi lại không giới hạn.
25. Thưởng: `POST /api/lessons/complete { slug, actions }` → server dựng start từ catalog, `replayRecordedGame` với variant bài, kiểm mục tiêu → lần đầu: +20 xu, `lessonsDone += slug`; thành tích `lessons-all` (+200 xu). Offline: hàng chờ nộp đơn giản trong localStorage (tối đa 12 mục).
26. `/how-to-play/[technique]`: SSG (`generateStaticParams` từ catalog — kiểm cú pháp Next 16), nội dung chữ (en/vi) + bàn minh hoạ `block-board-preview.tsx` + `lesson-player`; JSON-LD `HowTo`; sitemap. Trang `/how-to-play` thêm danh sách bài.
27. Phân tích sau ván (F10): `holesCreated > 0` → link bài 2; chết khi bàn > 70% đầy → bài 12; dùng ô Cất ít & khối to bị kẹt → bài 8.
28. Test: SSG build ra 12 trang; API từ chối actions không đạt mục tiêu; lần 2 không thưởng.

### Bước cuối (1 ngày)
29. Test/lint/tsc/build; balance classic không đổi.
30. QA: chuyển mùa (giả lập `now`), mở lượt Arena hết xu, speed hết giờ khi tab ẩn, bài học offline.
31. Docs: kiến trúc (mùa, Arena, bài học, kinh tế xu), roadmap v2.8, firebase guide (index `arenaRuns` theo uid+status nếu cần).

## Todo List

- [ ] Season calendar + kỳ `season` trong categories
- [ ] seasonPeak + seasons/{key} + nhiệm vụ mùa + `mission-progress.ts` chung
- [ ] Claim mùa + huy hiệu + UI `/season` + thẻ trang chủ
- [ ] Arena catalog + goal rules + test
- [ ] Arena run store (start/abandon) + session + submit evaluate
- [ ] Client VariantRun arena + HUD + đồng hồ + `/arena`
- [ ] Bot cân bằng Arena + báo cáo
- [ ] Theo dõi kinh tế xu
- [ ] `fixedTrays` + lesson catalog + lời giải mẫu + test
- [ ] Lesson player + API complete + SEO pages + link từ phân tích
- [ ] i18n, test, docs

## Success Criteria

- Chuyển mùa không cần thao tác tay; thưởng mùa nhận được đúng hạng sau khi chốt.
- Arena: không thể âm xu, không thể chạy 2 lượt cùng lúc, replay server dùng đúng variant; tỉ lệ thắng bot theo cấp nằm trong khoảng mục tiêu.
- Tỉ lệ xu tiêu/xu kiếm toàn hệ thống ≥ 0.6 sau 4 tuần (trước Arena dự kiến < 0.2).
- 12 bài học build tĩnh, mỗi bài có lời giải mẫu replay đạt mục tiêu.
- KPI: D30 retention, % người chơi mở Arena, traffic organic `/how-to-play/*`.

## Risk Assessment

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Arena quá khó/dễ → mất xu, nản | Cao | Bot đo trước; L1 rẻ + dễ; hoàn 50% phí lần đầu chơi mỗi loại (tuỳ chọn) |
| Đồng hồ Speed lệch, tab ẩn | TB | Giờ server + `clockOffset` như duel; grace 10 s; hết giờ khi tab ẩn vẫn chốt bằng giờ server lúc nộp |
| Người chơi bỏ lượt khi biết sắp thua để giữ… (không có lợi vì phí đã trừ) | Thấp | Thiết kế: phí trả trước, bỏ = thua |
| Thêm đọc run doc vào transaction submit | Thấp | Chỉ mode arena |
| Bài học bị dùng farm xu | Thấp | Mỗi bài 1 lần, server replay |
| Quá nhiều chế độ (lặp lại vấn đề v2.5 đã gộp event) | TB | Trang chủ chỉ thêm 1 ô "Đấu trường"; mùa nằm trong thẻ, không phải chế độ chơi mới |

## Security Considerations

- Mọi trừ/cộng xu trong transaction Firestore; kiểm `coins ≥ fee` trong transaction.
- Variant Arena/bài học luôn từ catalog theo session/slug, không nhận từ client.
- `durationMs` từ timestamp server; `times` client chỉ để gắn cờ (F11).
- Claim mùa: idempotent (`rankClaimed`), chặn khi đang bị báo cáo.

## Next Steps

- Phase 04 dùng mùa (F12) làm chu kỳ cho rating ghost (quý = 3 mùa) và nhiệm vụ mùa kind `ranked`.
- Đánh giá sau 4 tuần: nếu Arena có tỉ lệ chơi tốt → cân nhắc thêm loại "Không bế tắc tốc độ" (kết hợp F9) thay vì thêm cấp L6–L8.
