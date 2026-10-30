# Plan: Áp dụng bài học từ Minesweeper Online vào Block Blast

Ngày: 2026-10-29 · Trạng thái: **Đề xuất (chưa code)**
Nguồn: `D:\VQD\minesweeper-online-local-20261029\NGHIEN-CUU-MINESWEEPER-ONLINE-20261029.md` (REA, build 1039) + đọc source repo này (engine, store, server, progression, docs v1→v2.5).

---

## Phase files (plan chi tiết từng phase)

| Phase | File | Tính năng | Ước lượng | Trạng thái |
|---|---|---|---|---|
| 01 | [phase-01-nen-du-lieu-va-quick-wins.md](./phase-01-nen-du-lieu-va-quick-wins.md) | F1–F6 | 8–10 ngày | Đã code + commit (2026-10-29), chờ QA tay + bật TTL/index ở host |
| 02 | [phase-02-chieu-sau-ky-nang-va-bang-chung.md](./phase-02-chieu-sau-ky-nang-va-bang-chung.md) | F7–F11 | 13–16 ngày | Đã code + commit (2026-10-29), chờ QA tay + TTL/index/cron ở host |
| 03 | [phase-03-thu-thach-va-mua-giai.md](./phase-03-thu-thach-va-mua-giai.md) | F12–F14 | 14–17 ngày | Đã code (2026-10-30), chờ QA tay |
| 04 | [phase-04-doi-khang-va-xa-hoi.md](./phase-04-doi-khang-va-xa-hoi.md) | F15–F18 | 12–15 ngày | Chờ DAU (F16, F17 làm sớm được) |

Phase files là nguồn chuẩn khi có khác biệt chi tiết với file này (tên Bậc, số liệu, API).

## 0. TL;DR

- Block Blast hiện **đã có nền rất mạnh** mà Minesweeper Online coi là cốt lõi: ván có seed do server cấp + **server replay toàn bộ nước đi để tính điểm** (tương đương `VerifyGameStateWS`), daily seed chung, BXH ngày/tuần/mọi lúc, level có sao, duel realtime, XP/xu/nhiệm vụ/thành tích/theme.
- Thứ Block Blast **thiếu** so với Minesweeper Online không phải "nhiều hệ thống kinh tế", mà là **chiều sâu kỹ năng**: (1) chỉ số ván ngoài điểm, (2) đo độ **ổn định** thay vì 1 ván may mắn, (3) bằng chứng kỷ lục (replay), (4) nhiều trục xếp hạng theo phong cách chơi, (5) thử thách có điều kiện (Arena), (6) công cụ học từ thất bại.
- **Làm**: 15 tính năng chia 4 phase (mục 4–7). **Không làm**: ~20 hệ thống của Minesweeper (equipment, talents, gems, marketplace, chat, wallet, premium pay-to-win…) — lý do ở mục 8.
- Nguyên tắc vàng học được: *một trục tiến trình = một câu hỏi rõ ràng*, *thành tích phải có bằng chứng*, *thưởng không bao giờ ảnh hưởng gameplay/xếp hạng*.

---

## 1. Hiện trạng Block Blast (đã kiểm tra trong code)

| Mảng | Đã có | File chính |
|---|---|---|
| Engine | 8x8, khay 3, 15 họ khối; điểm `1/ô + 10·n(n+1)/2 × combo(1+0.5/bậc)`, grace 3 nước, dọn bàn +300; Cất (mở ở 300đ), Đổi khay ×2, Hồi sinh ×1 | `engine/score-and-combo-rules.ts`, `engine/power-up-rules.ts` |
| Chia khối | Smart/bag/bag theo bản Classic; bag **không** đảm bảo đặt được; khay mở đầu 19 bộ | `engine/piece-tray-generator.ts`, `tray-generator-config.ts` |
| Xác thực | Seed server → client ghi `actionLog` → `POST /api/games/submit` → `replayRecordedGame` tính điểm thật; log sai → 422 | `engine/replay-recorded-game-actions.ts`, `server/games/record-submitted-ranked-game.ts` |
| Chỉ số ván | `ReplaySummary`: score, moveCount, linesCleared, bestCombo, boardClears | như trên |
| Thống kê người chơi | `PlayerStats`: gamesPlayed, bestScore, totalScore, totalLinesCleared, bestCombo, boardClears, totalMoves | `modules/player-profile/player-profile-types.ts` |
| BXH | `today-*`, `weekly-*`, `alltime`, `daily-*`, `challenge-week-*`; chỉ 1 tiêu chí: **điểm** | `server/leaderboards/*` |
| Daily | 3 lượt/ngày, mốc ★ theo **trung vị 7 ngày** của chính mình, thưởng chuỗi 7 ngày, tuần (rương sao + thưởng hạng) | `modules/progression/daily-challenge-goals.ts`, `server/daily/*` |
| Tiến trình | XP `10+⌊điểm/100⌋` (≤100), cấp `50·L·(L−1)`, +50 xu/cấp; 6 loại nhiệm vụ × 1–2 mức; 13 thành tích; 8 theme (free/level/xu/referral) | `modules/progression/*` |
| Chế độ | Vô tận, Daily, 20 Level (sao theo % nước), Thách đấu link, Duel 1v1 phòng riêng (RTDB, nhiều ván, người xem) | `modules/game-modes/*`, `modules/duel/*` |
| Khác | PWA, Web Push nhắc chuỗi, presence "X người đang chơi", referral, SEO how-to-play | |

**Khoảng trống quan trọng phát hiện khi đọc code**

1. `gameSessions` có `expireAt` 30 ngày cho **mọi** session (kể cả `done`) → không có lịch sử ván lâu dài.
2. Action log **không được lưu** sau khi nộp (chỉ seed + score) → không thể xem lại ván / chứng minh kỷ lục / làm ghost.
3. `ReplaySummary` không ghi việc dùng trợ giúp (Cất/Đổi/Hồi sinh), số lần xoá nhiều dòng, nên không phân biệt được "ván thuần kỹ năng".
4. Xu chỉ có 1 chỗ tiêu (theme 300/800) → **thiếu coin sink**, xu sẽ lạm phát.
5. Duel chỉ có phòng riêng qua link, không có rating.
6. Settings chỉ có sound/haptics/theme/tutorial.
7. Không có khái niệm "phong độ" toàn cục (chỉ daily dùng trung vị 7 ngày nội bộ để đặt mốc).

---

## 2. Phân tích Minesweeper Online — cái gì thực sự tạo nên chiều sâu

Gom 4 phần của báo cáo REA thành 7 cơ chế cốt lõi, và đánh giá khả năng chuyển sang Block Blast:

| # | Cơ chế Minesweeper | Bản chất | Chuyển sang Block Blast? |
|---|---|---|---|
| M1 | 3BV, 3BV/s, Efficiency, NF/FL | Nhiều **chỉ số kỹ năng trực giao** ngoài thời gian | ✅ Có tương đương: điểm/nước, tỉ lệ xoá, xoá nhiều dòng, ván không trợ giúp |
| M2 | Mastery (thắng/100 ván), Win streak, Endurance (100 thắng/24h) | Đo **ổn định**, chống "1 ván may mắn" | ✅ Rất hợp: Block Blast phụ thuộc may rủi chia khối → "phong độ" (trung vị N ván) quan trọng hơn kỷ lục |
| M3 | Ngưỡng 3BV tối thiểu để vào time ranking | **Chống may mắn** ở cấp luật | ⚠️ Một phần: đã có `MIN_MOVES_FOR_REWARDS=10`; trung vị phong độ giải quyết tốt hơn |
| M4 | Mọi kỷ lục link tới replay `/game/{id}`; cheating review | **Bằng chứng** + học từ người giỏi | ✅ Có sẵn engine deterministic, chỉ thiếu lưu log |
| M5 | NG (bàn luôn giải được bằng logic) tách bảng riêng với Standard | Chế độ **loại bỏ may rủi** cho người thích logic | ✅ Tương đương: "khay luôn có lối đi" (đã có `tray-solvability-search.ts`) |
| M6 | Arena: 10 loại × L1–L8, vé, giới hạn giờ, phạt | **Thử thách có điều kiện** gắn kỹ năng ↔ phần thưởng | ✅ Làm bản "lite": đã có `GameVariant` (startBoard, moveLimit, noPowerUps, noRevive) |
| M7 | Quest theo phong cách chơi; Trophy→Rank mở quest/vé cao | **Định hướng** người chơi thử nhiều lối | ✅ Mở rộng nhiệm vụ hiện có |
| M8 | Game analysis (sau khi thua: nước an toàn nhất, 50/50…) + Patterns/Guides | **Học từ thất bại** | ✅ Có bot `chooseMove` + solvability search → "phân tích nước quyết định" |
| M9 | Season tháng / PvP mùa quý / năm | Nhịp **reset** để người mới có cơ hội | ✅ Mùa tháng nhẹ |
| M10 | PvP MMR ẩn + LP + League | Đối kháng công bằng | ⚠️ Cần nhiều người online; làm dạng **bất đồng bộ (ghost)** |
| M11 | Equipment/Talents/Gems/Marketplace/Exchange/EMC/Wallet | Kinh tế phức tạp, giữ chân hardcore lâu năm | ❌ Không hợp (mục 8) |
| M12 | Chat, contacts, players-online map, spectate bất kỳ ai, incognito | Cộng đồng | ❌ Không hợp lúc này (mục 8) |

**4 nhầm lẫn mà báo cáo cảnh báo → áp cho mình**: Minesweeper phải tách "Ranking ≠ Rank ≠ League". Block Blast phải chốt **từ vựng** ngay từ đầu (mục 3) để không thành 3 cái thang khó hiểu.

---

## 3. Từ vựng & nguyên tắc thiết kế (bắt buộc trước khi code)

| Thuật ngữ (vi / en) | Nghĩa | Nguồn dữ liệu |
|---|---|---|
| **Cấp** / Level | Mức độ chơi nhiều (đã có, theo XP) | `xp` |
| **Phong độ** / Form | Trung vị điểm **20 ván Vô tận gần nhất** (≥10 ván mới có) | mới: `recentFormScores` |
| **Bậc** / Tier | Danh hiệu kỹ năng suy từ Phong độ (Đồng → Cao thủ) | tính, không lưu riêng |
| **Hạng** / Rank | Vị trí trên 1 BXH (#1, #23…) | BXH |
| **Kỷ lục** / Best | Điểm cao nhất 1 ván | `bestScore` |
| **Ván thuần** / Pure run | Ván không dùng Cất, Đổi khay, Hồi sinh (≈ NF) | mới: cờ trong `ReplaySummary` |

Nguyên tắc (rút ra từ báo cáo):

1. **Thưởng không bao giờ thay đổi gameplay/xếp hạng** (Minesweeper: equipment chỉ tăng thưởng, không làm bàn dễ hơn). Theme/huy hiệu chỉ để ngắm — giữ đúng `theme-unlock-rules.ts`.
2. **Mọi số trên BXH phải là số server replay ra.** Không nhận số từ client (giữ nguyên kiến trúc hiện tại).
3. **Một trục = một câu hỏi.** Cấp = "chơi nhiều chưa?", Bậc = "giỏi ổn định chưa?", Kỷ lục = "đỉnh cao nhất?". Không làm điểm tổng hợp kiểu Trophy 10 nhóm (quá khó hiểu cho game casual).
4. **Ít mà rõ**: Minesweeper có 13 chỉ số nâng cao (CPS, IOE, ZiNi, STNB…) — mình chỉ lấy 4–5 chỉ số người chơi hiểu ngay.
5. **Không gì phụ thuộc lượng người online** trước khi có DAU thật (matchmaking, feed, chat sẽ trông "chết").
6. Engine thuần, mọi luật mới đặt trong `modules/*` dùng chung client/server, có test, chạy `npm run balance` khi đổi luật.

---

## 4. PHASE 1 — Nền dữ liệu + Quick wins (ưu tiên cao nhất, ~1.5–2 tuần)

### F1. Mở rộng chỉ số ván (tương đương 3BV/Efficiency/NF) — **P0, nền cho mọi thứ sau**

**Vì sao**: Minesweeper cho người chơi nhiều cách "giỏi" (nhanh, ít click, không cờ). Block Blast hiện chỉ có 1 cách: điểm.

**Chỉ số mới tính trong `replayRecordedGame` (server) và store (client), cùng 1 hàm thuần:**

| Chỉ số | Công thức | Ý nghĩa |
|---|---|---|
| `piecesPlaced` | số `PLACE_PIECE` | đã có gần đúng qua `moveCount` |
| `clearMoves` | số nước có xoá ≥1 dòng | |
| `multiClears` | `{2: n, 3: n, 4+: n}` số nước xoá ≥2/≥3/≥4 dòng | kỹ năng "dồn hàng" |
| `maxLinesInMove` | max dòng xoá trong 1 nước | |
| `pointsPerMove` | `score / moveCount` (hiển thị 1 số lẻ) | ≈ Efficiency |
| `clearRate` | `clearMoves / moveCount` | ≈ tỉ lệ nước hữu ích |
| `assists` | `{ stash: n, replace: n, revive: bool }` | dùng trợ giúp |
| `pure` | `assists` đều 0/false | ≈ NF (phong cách, KHÔNG phải chế độ) |

**Việc cần làm**
- `engine/replay-recorded-game-actions.ts`: mở rộng `ReplaySummary` (giữ field cũ, thêm field mới). Tách hàm `accumulateMoveMetrics(summary, action, nextState)` sang file mới `engine/game-metrics-accumulator.ts` để store client dùng lại (DRY).
- `server/games/apply-verified-game-to-player-stats.ts`: thêm `PlayerStats.pureGames`, `bestPureScore`, `multiClears3`, `maxLinesInMove` (field mới optional → không phá doc cũ; `stored-player-document.ts` parse với default 0).
- UI hộp hết ván (`game-over-dialog.tsx`): thêm 1 hàng 3 ô nhỏ: *Điểm/nước*, *Xoá nhiều dòng*, *Ván thuần ✓*. Không nhồi thêm.
- Test: replay determinism cho metrics; ván cũ (summary thiếu field) vẫn parse.

**Không làm**: thời gian ván / nước-mỗi-giây cho xếp hạng (action không có timestamp server; client timestamp không tin được).

### F2. Lịch sử ván ("My games") — **P1**

**Vì sao**: Minesweeper "My games" + Statistics theo level giúp người chơi tự thấy tiến bộ, là nền cho replay.

- Khi submit `done`: ghi `users/{uid}/games/{gameId}` = `{ mode, score, moveCount, metrics…, finishedAt, levelId?, day? }` (≈300 B/doc). Hoặc: bỏ `expireAt` khỏi session `done` và query `gameSessions where uid==` (cần composite index). **Khuyến nghị subcollection riêng** (không đụng TTL session, đọc theo uid rẻ, xoá khi xoá account dễ).
- Giới hạn: giữ 200 ván gần nhất (cron dọn hoặc chỉ query `limit 50`, bỏ cũ bằng TTL `expireAt` 180 ngày trên doc history).
- API `GET /api/games/history?mode=&cursor=` (50/trang).
- Trang `/profile/games`: bảng ván, lọc theo chế độ, đánh dấu kỷ lục, biểu đồ điểm 30 ván gần nhất (sparkline).
- Thống kê theo chế độ trong profile: số ván, TB, trung vị, kỷ lục — tính từ history (không cần thêm counter).

### F3. Phong độ + Bậc kỹ năng (tương đương Mastery) — **P1, tính năng "ăn tiền" nhất**

**Vì sao**: Block Blast có may rủi chia khối → bestScore phản ánh may mắn nhiều hơn kỹ năng. Minesweeper giải bằng Mastery (thắng/100 ván) và ngưỡng 3BV. Trung vị N ván = đo ổn định, không farm được bằng 1 ván ăn may, không farm được bằng chơi nhiều.

- `users.recentFormScores: number[]` (tối đa 20, chỉ ván **Vô tận** + lượt đầu daily — cùng tập với bảng Mọi lúc; mọi ván ≥ 1 nước đều tính để không né được ván xấu bằng "Ván mới"). Ghi trong transaction submit (đã đọc user doc sẵn → 0 read thêm).
- `modules/progression/player-form-rules.ts` (mới, thuần): `formFromRecent(scores)` = trung vị nếu ≥10 ván, ngược lại `null`; `tierForForm(form)`.
- Bậc (ngưỡng **tạm**, phải chỉnh theo phân phối thật — xem câu hỏi mở):

| Bậc | Phong độ ≥ |
|---|---:|
| Tập sự | — (chưa đủ 10 ván) |
| Đồng | 0 |
| Bạc | 800 |
| Vàng | 1.500 |
| Bạch kim | 3.000 |
| Kim cương | 6.000 |
| Cao thủ | 12.000 |

- Hiển thị: huy hiệu Bậc cạnh tên trên BXH, profile, duel versus card, ảnh share. Lên bậc → toast + xu (1 lần/bậc, lưu `tierRewardsClaimed`).
- **Tái dùng**: daily goals đang dùng `dailyRecent` trung vị 7 ngày → giữ nguyên, không gộp (2 tập ván khác nhau), nhưng dùng chung hàm `median` (DRY).
- BXH "Phong độ" (F7) dùng số này.

### F4. Nhiệm vụ theo phong cách chơi + đổi nhiệm vụ — **P1**

**Vì sao**: Quest của Minesweeper dẫn người chơi thử Speed/NF/Efficiency/Streak/Arena… Nhiệm vụ hiện tại chỉ là "chơi nhiều/điểm/dòng/combo".

Thêm `DailyMissionKind` (dùng metrics F1):

| Kind | Ví dụ mục tiêu | Phong cách được dẫn tới |
|---|---|---|
| `pureScore` | Đạt 1.500 điểm trong 1 **ván thuần** | Không trợ giúp (≈NF) |
| `multiClear` | Xoá ≥3 dòng cùng lúc 2 lần | Dồn hàng |
| `efficiency` | Ván ≥30 nước với điểm/nước ≥ 25 | Hiệu suất |
| `levelStars` | Đạt 3 sao ở 1 màn bất kỳ | Màn chơi |
| `duel` | Chơi 1 trận đấu 1v1 | Đối kháng |
| `dailyStars` | Đạt ★★ ở thử thách ngày | Daily |

- Mức khó theo **Bậc** (Minesweeper: rank cao → quest level cao, thưởng cao): người Bạc nhận `score 1500`, người Kim cương nhận `score 8000` — **chú ý**: hiện nhiệm vụ tất định theo ngày, giống nhau cho mọi người. Đổi sang: *loại* vẫn tất định theo ngày, *mức* theo bậc lúc bắt đầu ngày (lưu `missions/{day}.tier` lần đầu đọc). Thưởng tăng theo mức.
- **Đổi nhiệm vụ 1 lần/ngày miễn phí** (Minesweeper `ReplaceQuestWS`, cảnh báo mất tiến độ). Lưu `missions/{day}.replaced = {slot, kind}`. API `POST /api/missions/replace`.
- Không làm: elite quest 5% ngẫu nhiên, nhiều slot mua bằng tiền.

### F5. Thành tích theo phong cách + bậc thành tích — **P1, rẻ**

Thêm vào `achievement-catalog.ts` (chỉ cần dòng + key dịch, server tự xét):

| id | Điều kiện | Lấy cảm hứng |
|---|---|---|
| `pure-2000` / `pure-10000` | Ván thuần ≥ 2.000 / 10.000 | Optimizer (NF) |
| `quad-clear` | Xoá ≥4 dòng 1 nước | Sniper |
| `clears-in-game-3` | Dọn sạch bàn 3 lần trong 1 ván | |
| `stars-60` | Đủ 60 sao (3★ cả 20 màn) | Gladiator |
| `duel-wins-10` | Thắng 10 trận 1v1 | Fanatic |
| `tier-gold` / `tier-diamond` | Đạt Bậc Vàng / Kim cương | Rank |
| `marathon` | 10 ván ≥ 1.000 điểm trong 1 ngày | Marathoner/Endurance |
| `daily-3stars-7` | 7 ngày ★★★ daily | Guru |

Thêm `AchievementState.stats` field mới từ F1; `marathon` cần đếm theo ngày → dùng history F2 hoặc counter `users/{uid}/missions/{day}` (đã có doc theo ngày → thêm field `qualifyingGames1000`).
UI: nhóm thành tích theo chủ đề (Chăm chỉ / Kỹ năng / Phong cách / Xã hội), thanh tiến độ đã có.

### F6. Cài đặt điều khiển & trợ năng — **P1, rẻ**

Học từ bảng Settings/Touch của Minesweeper (hold-to-flag, quick action, colour accessibility trong event):

- **Khoảng nâng khối khi kéo** (drag offset: thấp/vừa/cao) — ngón tay hay che khối trên mobile. `pointer-drag-controller.ts` + `canvas-layout-metrics.ts`.
- **Chế độ mù màu**: vẽ thêm hoa văn/ký hiệu nhỏ trên khối theo `colorId` (`block-cell-painter.ts`). Không phải theme mới, là lớp phủ.
- **Giảm chuyển động** (theo `prefers-reduced-motion` + toggle): tắt rung màn, rút ngắn hiệu ứng (`effects-timeline.ts`).
- **Tắt highlight dòng sắp xoá** (tuỳ chọn cho người thích khó; mặc định bật).
- Đã có trong roadmap "Còn mở": chơi bằng bàn phím (WCAG 2.1.1) → gộp vào đây: phím 1/2/3 chọn khối, mũi tên di chuyển bóng, Enter đặt, S cất, R đổi khay.

---

## 5. PHASE 2 — Chiều sâu kỹ năng & bằng chứng (~3 tuần)

### F7. BXH nhiều hạng mục (tương đương Best players categories) — **P1**

**Vì sao**: Minesweeper có ~20 hạng mục; mình chỉ cần 4–5 để mỗi kiểu người chơi có "bảng của mình".

| Hạng mục | Giá trị entry | Kỳ | Ghi chú |
|---|---|---|---|
| Điểm (đã có) | best score | hôm nay/tuần/mọi lúc | giữ nguyên |
| **Phong độ** | form (F3) | mọi lúc (+mùa ở F12) | chỉ người ≥10 ván; cập nhật khi form tăng **hoặc giảm** (khác board điểm: ghi đè, không giữ max) |
| **Ván thuần** | best pure score | tuần/mọi lúc | ≈ NF-only filter |
| **Combo** | best combo 1 ván | mọi lúc | |
| **Sao màn** | tổng sao (≤60) rồi số nước ít | mọi lúc | đồng điểm nhiều → tie-break theo thời gian đạt |

- Mở rộng `boardIdsForRankedGame` → trả `{boardId, value}` thay vì chỉ boardId (mỗi bảng 1 giá trị). Chỉ ghi khi giá trị cải thiện → số write tăng ít.
- **Bảng Phong độ** cần xử lý giảm: entry ghi đè mỗi lần form đổi; top-100 snapshot phải hỗ trợ xoá/hạ hạng (`merge-score-into-top-list.ts` hiện chỉ merge tăng) → viết `replaceScoreInTopList`.
- UI `/leaderboard`: hàng tab chính (Điểm · Phong độ · Thuần · Combo · Sao) + tab kỳ. Hàng mình: "Hạng #23 · cách #22: 140".
- Mỗi hàng có link replay (F8) — **kỷ lục phải xem được**.

### F8. Xem lại ván (Replay) + bằng chứng kỷ lục + hồ sơ công khai — **P1**

**Vì sao**: Minesweeper: mọi kỷ lục link `/game/{id}`, người chơi học từ replay top, và replay là cơ sở chống gian lận. Engine mình deterministic → replay gần như miễn phí, chỉ thiếu lưu log.

- Lưu `gameReplays/{gameId}` = `{ uid, mode, seed, stashUnlocked, variant ref, actions (nén: mảng số), score, createdAt }` **chỉ khi**: ván lọt top-100 bất kỳ bảng, hoặc là kỷ lục cá nhân, hoặc người chơi bấm "Lưu ván". ~50–500 action × ~6 B (nén `[type,slot,row,col]` thành 1 số) → < 5 KB.
- Trang `/game/[id]` (server render meta + OG image): canvas phát lại (dùng lại `board-canvas-renderer.ts` + `gameReducer`), Play/Pause, ←/→ từng nước, thanh timeline, tốc độ ×1/×2/×4, panel chỉ số F1. Hiển thị khay tại mỗi bước để người xem hiểu *vì sao* chọn nước đó.
- `modules/duel/duel-move-replay.ts` đã có logic replay từ seed → tách phần dùng chung.
- **Hồ sơ công khai** `/u/[tag]`: tên, Bậc, Phong độ, kỷ lục + link replay, sao màn, thành tích, thống kê duel. Không có uid trong URL (dùng tag ngắn / mã như referral code).
- "Chơi tiếp từ đây" (Continue playing): từ 1 bước replay mở ván **luyện tập** (không tính điểm, không nộp) — Phase 3, tuỳ chọn.

### F9. Chế độ "Không bế tắc" (tương đương NG) — **P2**

**Vì sao**: NG là một trong các chế độ phổ biến nhất của Minesweeper vì loại bỏ may rủi. Block Blast hiện: bag deal **không đảm bảo** đặt được (đúng bản Classic) → nhiều ván chết do khay xấu, người chơi cảm thấy "bị game lừa".

- Biến thể `GameVariant.guaranteedTray: true`: mọi khay chia ra đều tồn tại ít nhất 1 thứ tự đặt được cả 3 khối (dùng `tray-solvability-search.ts`, budget 6.000 đã có; nếu không tìm được trong budget → chia lại với rng kế tiếp, tối đa K lần rồi fallback khay smart).
- **Lưu ý như báo cáo cảnh báo "NG ≠ không thể thua"**: vẫn thua nếu đặt sai thứ tự/vị trí. Ghi rõ trong UI.
- Bảng riêng (như `/ranking/ng` tách Standard): `logic-alltime`, `logic-weekly`. **Không** gộp với bảng Vô tận.
- Hiệu năng: worst case ~15 ms/khay (doc v1.1) × K lần retry → đặt K=4, đo bằng `npm run balance` với variant mới; chạy trên server replay (Node) cũng phải < vài giây/ván.
- Slot mới trong `parked-mode-games.ts` (`"logic"`), `RankedGameMode` + `storedSessionSchema.mode` thêm `"logic"`.
- Cân nhắc: chế độ này có thể làm điểm "vô tận" quá cao → cần thêm tăng độ khó theo điểm (túi khối to hơn sau 5.000). Test bằng bot trước khi mở.

### F10. Phân tích sau ván ("Vì sao mình thua?") — **P2, khác biệt lớn**

**Vì sao**: Minesweeper Game analysis (premium) chỉ ra nước sai, nước an toàn nhất, 50/50. Người chơi Block Blast thường không biết mình chết vì khay xấu hay vì đặt sai 5 nước trước.

- Chạy **sau** khi hết ván, trên client (worker) từ seed + actionLog:
  - Với mỗi lượt khay (3 khối), kiểm tra bằng solvability search: *tại đầu lượt có tồn tại cách đặt đủ 3 khối không?* và *sau nước người chơi đi thì còn không?*
  - Nước **đầu tiên** biến trạng thái "còn lối" → "hết lối" = **nước quyết định**. Nếu ngay đầu lượt đã không có lối → "khay không thể đặt hết (xui)".
  - Hiển thị: "Nước #47: đặt khối L ở (3,5) làm khối 3x3 không còn chỗ. Gợi ý: đặt ở (0,0)" + mini board trước/sau (từ F8 replay).
- Phân loại kết thúc ván: **Xui** (khay vô nghiệm) / **Sai lầm** (có nước cứu) — thống kê % mỗi loại trong profile → người chơi biết cần cải thiện gì.
- **Không** có gợi ý trong ván tính điểm (Minesweeper: championship cấm hint). Gợi ý chỉ có ở: phân tích sau ván, ván luyện tập, bài học (F14).
- Chi phí: search trên mỗi lượt (~20–100 lượt/ván) × ≤15 ms → ≤1.5 s trong Web Worker; giới hạn phân tích 30 lượt cuối.

### F11. Kiểm tra hợp lý chống bot — **P2 (bắt buộc trước khi có thưởng hạng lớn)**

**Vì sao**: Replay chỉ chứng minh nước đi **hợp lệ**, không chứng minh **người** chơi. Bot dùng `chooseMove`-like có thể leo bảng. Minesweeper có website rules + `VerifyGameStateWS` + `ReportGameAbuseWS` + cheating review cho championship.

- Server ghi `createdAt` session (đã có) → khi submit tính `durationMs`; nếu `durationMs / moveCount < 300 ms` → đánh dấu `suspect`, không vào BXH (vẫn cộng thống kê).
- Client gửi thêm `t` (ms từ đầu ván) cho mỗi action (chỉ dùng để phát hiện bất thường, không tính điểm): phân phối khoảng cách quá đều/quá nhanh → `suspect`.
- Top 10 bảng tuần/mùa có thưởng → hàng chờ review thủ công (replay F8 là bằng chứng) trước khi phát thưởng hạng. Thêm cờ `reviewed` trong `daily-week-rewards-store.ts`.
- Nút "Báo cáo" trên replay của top BXH (ghi `reports/{id}`, không UI admin phức tạp — xem Firestore console).

---

## 6. PHASE 3 — Thử thách & mùa giải (~3–4 tuần)

### F12. Mùa giải tháng — **P2**

**Vì sao**: Season leaders + PvP season của Minesweeper tạo nhịp reset; BXH Mọi lúc của mình sớm muộn sẽ "đóng băng" với người mới.

- Mùa = tháng lịch (giờ VN), id `season-YYYY-MM`. Bảng mùa: Điểm, Phong độ (form cuối mùa), Thuần.
- **Không cần soft reset Bậc**: Phong độ vốn là cửa sổ trượt 20 ván nên tự làm mới. Mùa chỉ reset **bảng**, và ghi nhận Bậc cao nhất đạt được trong mùa làm huy hiệu. Soft reset chỉ áp cho LP của đấu xếp hạng (F15, mùa quý).
- Thưởng cuối mùa: huy hiệu mùa (theo Bậc cao nhất đạt trong mùa) hiển thị ở profile + xu theo hạng (top 1/10/100). Nhận ở đầu mùa sau — tái dùng pattern `previousWeek.rankClaimable` của daily week.
- **Nhiệm vụ mùa**: 5 nhiệm vụ lớn/tháng (vd "500 dòng trong tháng", "đạt Bậc Vàng", "15 ngày daily"), thưởng lớn hơn nhiệm vụ ngày. Dùng lại engine mission (cumulative kinds).
- **Không** làm battle pass nhiều tầng (báo cáo: Minesweeper chỉ có dấu vết battle pass, chưa xác minh; và mình chưa có monetization).

### F13. Đấu trường (Arena-lite) — **P2, coin sink chính**

**Vì sao**: Arena là cầu nối kỹ năng ↔ phần thưởng mạnh nhất của Minesweeper. Mình đã có `GameVariant` + level catalog + sao → chỉ cần thêm "điều kiện" và "chuỗi".

**5 loại × 5 cấp** (không làm 10×8 + Elite):

| Loại | Điều kiện (ví dụ L1 → L5) | Luyện | Biến thể |
|---|---|---|---|
| **Tốc độ** | Đạt 800 → 4.000 điểm trong 2 → 5 phút | nhịp nhanh | thời gian server |
| **Thuần** | Đạt 1.000 → 6.000 điểm, không Cất/Đổi/Hồi sinh | kỹ năng gốc | `noPowerUps + noRevive` |
| **Chướng ngại** | Bàn có sẵn pattern khó, đạt X dòng trong N nước | đọc bàn | `startBoard + moveLimit` |
| **Combo** | Giữ combo ≥ 8 → 20 trong 1 ván | dồn hàng | đọc `bestCombo` |
| **Bền bỉ** | 3 → 5 ván liên tiếp, mỗi ván ≥ X điểm, trong 24 giờ | ổn định | chuỗi session |

- **Vé = xu** (không làm vé rơi ngẫu nhiên): L1 30 xu → L5 300 xu. Thắng trả 2–3× + XP + huy hiệu Arena. Đây là **coin sink** cân bằng lại xu (khoảng trống #4).
- Mở cấp theo **Bậc** (Minesweeper: rank mở vé level cao): L3 cần Vàng, L5 cần Kim cương.
- Điểm Arena = tổng cấp cao nhất đã qua mỗi loại (tối đa 25), y như "80 points" của Minesweeper — **không** cộng dồn mỗi lần chơi.
- Thời gian (loại Tốc độ, Bền bỉ): server so `finishedAt − createdAt ≤ limit + 10s grace`. Client tự chốt ván khi hết giờ (giống duel `endsAt`). Không thể gian lận bằng cách chậm hơn; nhanh hơn thì không có lợi.
- Catalog thuần `modules/game-modes/arena-catalog.ts` (seed ngẫu nhiên server cấp, variant theo catalog — **client không gửi variant**, giữ nguyên nguyên tắc hiện tại).
- Session `mode: "arena"`, `arenaType`, `arenaLevel`, `runId` (chuỗi bền bỉ). Không vào BXH điểm chung.

### F14. Bài học kỹ thuật (tương đương Patterns/Guides) — **P3, rẻ + SEO**

- 10–15 bài puzzle cố định, mỗi bài dạy 1 kỹ thuật: giữ ô 3x3 trống, không tạo lỗ, ưu tiên mép, chuẩn bị 2 dòng cùng lúc, giữ combo qua 3 nước grace, dùng ô Cất cho khối khó, khi nào đổi khay…
- Mỗi bài = `startBoard` + khay cố định + mục tiêu (tái dùng tutorial engine `engine/tutorial.ts` mở rộng thành nhiều bài) + gợi ý được phép.
- Trang SEO `/how-to-play/[technique]` (render server, ảnh bàn vẽ bằng `block-board-preview.tsx`), link từ F10 ("Bạn mất ván vì tạo lỗ → xem bài 'Tránh tạo lỗ'").

---

## 7. PHASE 4 — Đối kháng & xã hội có kiểm soát (khi đủ người chơi)

Điều kiện mở phase: DAU ≥ ~500 hoặc ≥ 20 người chơi đồng thời giờ cao điểm (đo bằng presence).

### F15. Đấu xếp hạng bất đồng bộ với "bóng ma" (Ghost) — **P3**

**Vì sao**: Minesweeper ranked PvP cần matchmaking realtime; với lượng người hiện tại hàng chờ sẽ trống. Mình có lợi thế: **seed + replay** → đấu với *ván đã ghi* của người cùng trình độ.

- Bấm "Đấu xếp hạng" → server chọn 1 replay (F8) của người có rating gần (±150), cùng seed → người chơi đấu với bóng ma, hiển thị bàn đối thủ phát lại song song (tái dùng `duel-live-boards.tsx` + `use-duel-board.ts`).
- Rating: Elo ẩn (MMR) + điểm hiển thị (LP) + 7 giải (Tân binh → Huyền thoại, 100 LP/giải; tên khác hẳn Bậc để không nhầm) như Minesweeper; mùa **quý** (3 mùa tháng F12), soft reset LP. 3 trận xếp hạng đầu để xác định LP (placement).
- Người bị dùng làm bóng ma cũng nhận ±LP nhỏ (nửa hệ số) → tránh rating chỉ tăng.
- **Phòng riêng (duel hiện tại) giữ nguyên, không tính rating** (Minesweeper: private lobby không tính ladder) → chống farm bằng tài khoản phụ.
- Khi đủ người online → thêm hàng chờ realtime dùng hạ tầng duel RTDB hiện có; bóng ma là fallback sau 20 s chờ.

### F16. Thách đấu có thưởng 2 chiều (tương đương Friend quests) — **P3, rẻ**

- Mở rộng `challenges/{id}`: hạn 3 ngày; người nhận vượt điểm trong hạn → **cả hai** +X xu (người thách nhận tối đa 5 lần/ngày). Giống friend quest event: hợp tác bất đồng bộ, lan truyền qua link.
- Không cần danh bạ/kết bạn.

### F17. Emote trong duel — **P3**

- 6 biểu cảm cố định (👍 😮 😂 🔥 😭 GG), gửi qua RTDB `duels/{code}/emotes/{uid}`, rate limit 1/3 s. **Không có chat chữ tự do** (xem mục 8).

### F18. Tổng kết năm — **P3, theo mùa (tháng 12)**

- Ảnh share 1080×1080 (tái dùng `render-result-share-card.ts`): số ván, kỷ lục, Bậc cao nhất, combo đỉnh, chế độ chơi nhiều nhất, số ngày chuỗi dài nhất. Cần F2 history.

---

## 8. KHÔNG NÊN phát triển (và lý do)

| Hệ thống Minesweeper | Quyết định | Lý do |
|---|---|---|
| **Equipment** (5 slot, rarity, boost, upgrade, personal item) | ❌ Không | Kinh tế cho người chơi hardcore nhiều năm; với game casual 8x8 là gánh nặng cân bằng khổng lồ; tăng thưởng theo đồ → người mới thấy bất công |
| **Talents + custom talents + mercy system** (gacha) | ❌ Không | Cơ chế gacha → rủi ro pháp lý (loot box) + đi ngược nguyên tắc minh bạch; không có giá trị gameplay |
| **10 loại Gems, Arena coins kim loại, spare parts, green essence, minetokens** | ❌ Không | 10+ loại tài nguyên cho 1 game xếp khối là quá tải nhận thức. Giữ **1 tiền tệ (xu)** |
| **Marketplace / Exchange / Net worth** | ❌ Không | Cần moderation, chống RMT, chống bot giao dịch; Firestore transaction phức tạp; không có gì để giao dịch |
| **Wallet / withdrawal** | ❌ Tuyệt đối không | Rủi ro pháp lý (đổi tiền thật, cờ bạc), KYC |
| **Premium/VIP ảnh hưởng tiến trình** (thêm quest, giảm phí, VIP coin) | ❌ Không (hiện tại) | Chưa có mô hình kiếm tiền; nếu có sau này chỉ: bỏ quảng cáo + theme. Không pay-to-win, không pay-for-analysis (F10 miễn phí) |
| **Chat** (kênh ngôn ngữ, PM, contacts, notes, trading channel) | ❌ Không | Moderation, người dùng nhỏ tuổi, spam/scam, báo cáo/ban; chi phí Firestore/RTDB. Thay bằng emote cố định (F17) |
| **Players online list/map, spectate bất kỳ ai, incognito** | ❌ Không | Riêng tư; lượng người ít → danh sách trống trông "chết". Đã có: đếm người chơi + xem duel bằng link |
| **EMC / Elite club / NFT board / lottery** | ❌ Không | Endgame của kinh tế equipment — không có nền tảng; từ "NFT" gây hiểu lầm |
| **Trophy tổng hợp 10 nhóm + Rank 13 cấp quân hàm** | ❌ Không làm nguyên bản | Chính báo cáo phải giải thích "Ranking ≠ Rank ≠ League". Thay bằng **1** thang kỹ năng: Bậc theo Phong độ (F3) |
| **20 hạng mục BXH** (minecoins, gems, tickets, activity, equipment…) | ❌ Không | Phần lớn đo "cày", không đo kỹ năng; chỉ giữ 5 hạng mục F7 |
| **13 chỉ số nâng cao** (CPS, IOE, ThrP, Corr, ZiNi, RQP, IOS, STNB…) | ❌ Không | Đặc thù cơ học click của Minesweeper; Block Blast chỉ cần 4–5 chỉ số F1 |
| **Bàn tuỳ chỉnh kích thước** (Custom 1–100×100) | ❌ Không | 8x8 là bản sắc + mọi luật/chia khối/điểm tối ưu cho 8x8; phá so sánh BXH |
| **Sự kiện tháng với 4 mô hình xoay vòng** (Wheel, global hourly quest, vé đặc biệt, friend quest event) | ❌ Không (hiện tại) | v2.5 vừa **gộp sự kiện tuần vào daily** vì quá nhiều chế độ — thêm event tháng là đi ngược quyết định đó. Mùa tháng (F12) đủ nhịp |
| **Championship tháng + giải IRL + cheating review thủ công quy mô lớn** | ❌ Không (hiện tại) | Cần cộng đồng + nhân sự review. Thử thách tuần hiện có đóng vai trò giải nhỏ |
| **Matchmaking ranked realtime ngay bây giờ** | ❌ Chưa | Hàng chờ trống với lượng người hiện tại → dùng Ghost (F15) |
| **Desktop app, chọn server, ping, low-latency mode** | ❌ Không | Game không nhạy độ trễ (trừ duel, đã dùng giờ server); PWA đã đủ |
| **Skin thử thách** (No numbers, Blind, Rotating board, random letters) | ❌ Không làm thành skin | Có thể dùng **1** modifier "không highlight dòng sắp xoá" như tuỳ chọn F6 / điều kiện Arena; không làm hệ skin riêng |
| **Hint/gợi ý trong ván tính điểm** | ❌ Không | Phá BXH. Chỉ có ở phân tích sau ván / luyện tập / bài học |
| **News/activity feed toàn site** | ❌ Chưa | Ít người → feed thưa; cân nhắc lại khi DAU lớn |
| **Screenshot editor / Imgur upload** | ❌ Không | Share card + replay link (F8) đã thay thế tốt hơn |
| **Elite quests ngẫu nhiên 5%, mua thêm slot quest** | ❌ Không | Thêm ngẫu nhiên + cám dỗ trả tiền, không thêm chiều sâu |

---

## 9. Thứ tự triển khai & phụ thuộc

```
F1 Chỉ số ván ──┬─► F3 Phong độ/Bậc ──┬─► F4 Nhiệm vụ theo bậc
                │                     ├─► F7 BXH đa hạng mục ──► F12 Mùa giải
                │                     └─► F13 Arena (gate theo bậc)
                ├─► F5 Thành tích mới
                └─► F2 Lịch sử ván ──► F18 Tổng kết năm
F8 Replay ──┬─► F10 Phân tích sau ván ──► F14 Bài học
            ├─► F11 Chống bot (review bằng replay)
            └─► F15 Ghost ranked (cần F3 + F12)
F6 Settings: độc lập, làm song song bất kỳ lúc nào
F9 Không bế tắc: độc lập (cần bot balance), sau F7 để có bảng riêng
```

| Phase | Tính năng | Ước lượng | Mục tiêu đo |
|---|---|---|---|
| 1 | F1, F2, F3, F4, F5, F6 | 1.5–2 tuần | Số ván/phiên ↑, D7 retention ↑, % người xem profile |
| 2 | F7, F8, F9, F10, F11 | ~3 tuần | % người mở replay/phân tích, thời gian phiên, tỉ lệ ván bị đánh dấu suspect |
| 3 | F12, F13, F14 | 3–4 tuần | Xu tiêu/xu kiếm (mục tiêu ≥ 0.6), D30 retention, traffic SEO bài học |
| 4 | F15, F16, F17, F18 | khi đủ DAU | Số trận xếp hạng/ngày, viral K-factor từ thách đấu |

---

## 10. Thay đổi dữ liệu & API (tổng hợp)

**Firestore (mọi field mới optional, parse có default → không migrate)**

| Doc | Thêm | Phase |
|---|---|---|
| `users/{uid}` | `stats.pureGames`, `stats.bestPureScore`, `stats.multiClears3`, `stats.maxLinesInMove`, `recentFormScores[≤20]`, `tierRewardsClaimed[]`, `arena{type:level}`, `seasonBadges[]`, `rating{mmr,lp,placements}` | 1/3/4 |
| `users/{uid}/games/{gameId}` | lịch sử ván (+`expireAt` 180 ngày) | 1 |
| `users/{uid}/missions/{day}` | `tier`, `replaced`, `qualifyingGames1000` | 1 |
| `gameReplays/{gameId}` | seed, variant ref, actions nén, score, uid | 2 |
| `gameSessions/{gameId}` | `mode` += `logic`/`arena`, `arenaType`, `arenaLevel`, `suspect` | 2/3 |
| `leaderboards/{boardId}` | board mới: `form-alltime`, `pure-*`, `combo-alltime`, `stars-alltime`, `logic-*`, `season-*` | 2/3 |
| `reports/{id}` | báo cáo replay | 2 |

**API mới**: `GET /api/games/history`, `GET /api/games/{id}/replay` (công khai cho replay đã lưu), `POST /api/missions/replace`, `GET /api/players/{tag}`, `POST /api/arena/start` (hoặc mở rộng `/api/games/start { mode: "arena" }` — **khuyến nghị mở rộng**, đi chung luồng submit), `GET /api/leaderboards/{category}/{period}`.

**Rules**: không đổi nguyên tắc — client vẫn không đọc/ghi Firestore trực tiếp.

**Chi phí Firestore mỗi lần submit** (hiện ~6–10 read/write): +1 write history, +0–1 write replay, +0–4 write BXH hạng mục (chỉ khi cải thiện). Chấp nhận được; theo dõi bằng Firebase usage sau Phase 2.

---

## 11. Rủi ro & giảm thiểu

| Rủi ro | Giảm thiểu |
|---|---|
| Quá nhiều trục → người chơi rối (bài học số 1 của báo cáo) | Từ vựng mục 3; mỗi màn hình chỉ hiện 1–2 trục; profile gom gọn |
| Ngưỡng Bậc đặt sai → ai cũng Đồng/ai cũng Kim cương | Lấy phân phối thật 2 tuần sau F3 (từ history F2), đặt theo percentile (50/75/90/97/99.5), ngưỡng để ở 1 file config |
| Board Phong độ giảm điểm phá logic top-100 hiện tại (chỉ merge tăng) | Hàm `replaceScoreInTopList` riêng + test; giữ board điểm cũ không đổi |
| Chế độ Không bế tắc làm server replay chậm | Budget + retry giới hạn; benchmark replay 10.000 action trên Node trước khi mở |
| Bot leo BXH | F11 trước khi có thưởng hạng lớn (mùa/arena) |
| Arena Tốc độ: đồng hồ client lệch | Dùng giờ server như duel (`clockOffset` đã có), grace 10 s |
| Xu lạm phát / thiếu | Theo dõi tỉ lệ tiêu/kiếm; giá vé Arena ở config |
| `SAVE_VERSION` | Không đổi catalog khối → không cần tăng; slot parked mới (`logic`, `arena`) là field optional |
| File > 200 dòng (`record-submitted-ranked-game.ts` đã 189) | Tách phần BXH đa hạng mục + history thành module riêng trước khi thêm |

---

## 12. Checklist triển khai Phase 1 (để bắt đầu ngay)

- [ ] F1: `engine/game-metrics-accumulator.ts` + mở rộng `ReplaySummary` + test determinism
- [ ] F1: `PlayerStats` field mới + parse default trong `stored-player-document.ts`
- [ ] F1: Hộp hết ván hiện 3 chỉ số
- [ ] F2: ghi `users/{uid}/games/{gameId}` trong transaction submit (tách module)
- [ ] F2: API history + trang `/profile/games`
- [ ] F3: `player-form-rules.ts` (median, tier) + `recentFormScores` + huy hiệu Bậc
- [ ] F4: 6 kind nhiệm vụ mới + mức theo bậc + `POST /api/missions/replace`
- [ ] F5: 10 thành tích mới + key dịch en/vi
- [ ] F6: drag offset, mù màu, giảm chuyển động, bàn phím
- [ ] `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run balance` (không đổi luật → số phải như cũ)
- [ ] Cập nhật `docs/system-architecture.md`, `docs/project-roadmap.md` (v2.6)

---

## 13. Câu hỏi chưa giải quyết

1. Lượng người chơi hiện tại (DAU, đồng thời giờ cao điểm)? Quyết định thời điểm mở Phase 4 và có nên làm matchmaking realtime không.
2. Phân phối điểm thật của người chơi (không phải bot ~927 TB) — cần để chốt ngưỡng Bậc F3 và mức nhiệm vụ F4.
3. Có kế hoạch kiếm tiền (quảng cáo / IAP) không? Ảnh hưởng: có giữ "Hồi sinh" miễn phí, có thêm "xem quảng cáo để hồi sinh" không — và F1 coi Hồi sinh là "trợ giúp" (ván không thuần).
4. Gói Firebase (Spark hay Blaze)? Ảnh hưởng chi phí lưu replay/history và giới hạn kết nối RTDB cho ghost/duel.
5. Chế độ "Không bế tắc" (F9) có nên thay luôn Vô tận cho người mới (≤ 10 ván đầu) không, hay chỉ là chế độ riêng?
6. Thưởng hạng mùa/tuần có giá trị thật (quà, tiền) không? Nếu có → F11 + review thủ công là bắt buộc, và cần điều khoản.
7. Hồ sơ công khai (F8) có cần cho người chơi tắt (ẩn) không — tương đương incognito nhưng miễn phí?
