# Phase 06 — Đấu 1v1 realtime, sự kiện tuần, chế độ màn chơi

## Context Links
- Ý tưởng: `reports/feature-ideas-retention-acquisition.md` (C5, B9, B10)
- Kiến trúc: `reports/firebase-data-architecture.md` (RTDB cho 1v1)
- Phase trước: phase 02 (seed/session/replay), phase 03 (thách đấu cùng seed), phase 05 (RTDB presence)

## Overview
- Priority: P3 · Status: Done (2026-10-28)
- Ba chế độ mới dùng chung một cơ chế: **biến thể ván** (bàn dựng sẵn, giới hạn nước, số lượt đổi khay) trong engine, server replay đúng biến thể theo mode của session.

## Key Insights
- Engine tất định → thêm `GameVariant` vào state đầu ván là đủ cho cả sự kiện (bàn có đá) lẫn màn chơi (bàn dựng sẵn + giới hạn nước). Server **không bao giờ** nhận biến thể từ client: suy ra từ mode + id (tuần sự kiện / số màn) trong catalog dùng chung.
- Mục tiêu màn chơi đơn điệu (điểm, số dòng) → chỉ cần kiểm ở trạng thái cuối replay; sao tính theo số nước đã dùng.
- Màn có seed cố định → kiểm được "giải được" bằng bot trong test (bot đạt mục tiêu với đúng seed đó).
- 1v1: RTDB chỉ để **hiển thị** (điểm trực tiếp, trạng thái phòng do server ghi); kết quả thắng/thua lấy từ điểm server replay. Hết giờ = client chốt ván, server chỉ nhận bài nộp trước hạn + ân hạn.
- Ghép trận ngẫu nhiên cần lượng người chơi → chỉ làm phòng riêng qua link + đấu lại (YAGNI).
- Sự kiện xoay vòng theo tuần ISO bằng catalog trong code (không cần Remote Config).

## Requirements
- Engine: `createNewGame(seed, variant)`; `moveLimit` (hết nước = hết ván, không hồi sinh vượt giới hạn); đếm dòng đã xoá trong state.
- Sự kiện tuần: luật theo tuần, bảng xếp hạng `event-YYYY-Www`, thẻ ở trang chủ, tab BXH.
- Màn chơi: ~20 màn, mở dần, 1–3 sao, thưởng xu lần đầu qua màn/thêm sao (server xác minh); chơi offline được (chỉ lưu local).
- 1v1: tạo phòng → link mời → người kia vào → đếm ngược 5s → 3 phút cùng seed, thấy điểm đối thủ realtime → kết quả theo điểm đã replay; bỏ cuộc/không nộp = thua; đấu lại.

## Architecture
```
engine: GameVariant { startBoard, moveLimit, replaceCharges }, GameState.moveLimit/linesCleared
modules/game-modes/      catalog sự kiện + màn chơi, biến thể theo VariantRun, mục tiêu/sao
server/games/            session mode event|level|duel, replay theo biến thể, hậu xử lý theo mode
server/duels/            tạo/tham gia/kết thúc phòng (Firestore duels/{id}) + mirror RTDB /duels/{id}/state
store                    variantRun (event|level|duel), startVariantGame, chốt ván khi hết giờ/qua màn
UI                       /levels, /duel, /duel/[id], HUD theo chế độ, hộp qua màn, thẻ sự kiện, tab BXH
```
RTDB rules: `/duels/$id` đọc khi đã đăng nhập (id không đoán được); `/duels/$id/live/$uid` chỉ chính chủ và phải là thành viên (server ghi `state`).

## Related Code Files
- Sửa: engine (`game-types`, `game-state-reducer`, `power-up-rules`, `replay-recorded-game-actions`), `saved-game-schema`, store + sync, launcher, badge, game-over dialog, session/submit server, leaderboard ids/types, daily status, profile, `database.rules.json`, i18n, routes, sitemap
- Tạo: `modules/game-modes/*`, `server/duels/*`, `app/api/duels/**`, `app/(main)/levels`, `app/(main)/duel/**`, component HUD/thẻ/hộp

## Implementation Steps
1. Engine biến thể + test.
2. Catalog sự kiện/màn (+ test bot giải được).
3. Server: session + submit theo mode, BXH sự kiện, kết quả màn, duel API + RTDB.
4. Store + sync + launcher.
5. UI các chế độ.
6. Test, e2e Firebase thật, review, docs.

## Todo List
- [x] Engine variant
- [x] Catalog + test giải được
- [x] Server modes + duel
- [x] Store/launcher
- [x] UI
- [x] Test + e2e + review + docs

## Success Criteria
- Replay đúng biến thể; client gửi log của biến thể khác → 422.
- Mọi màn bot giải được với seed của màn.
- 1v1: hai người cùng seed, điểm realtime, kết quả đúng theo điểm replay, nộp trễ không tính.

## Risk Assessment
- Save cũ không có field mới → optional, `SAVE_VERSION` giữ nguyên.
- RTDB Spark 100 kết nối: duel + presence dùng chung; lên Blaze khi ra mắt.
- Đồng hồ máy lệch: hạn chót tính bằng giờ server (`endsAt` server ghi), client chỉ hiển thị.

## Security Considerations
- Biến thể/seed chỉ từ server; hạn nộp duel kiểm ở server; RTDB live chỉ thành viên ghi phần của mình; kết quả chỉ Admin SDK ghi.

## Next Steps
- Ghép trận ngẫu nhiên khi đủ người chơi; phần thưởng sự kiện (theme giới hạn thời gian).

## Kết quả / sai khác
- 20 màn: seed + giới hạn nước chọn bằng bot (dò seed tới khi bot đạt đúng mục tiêu dự định, giới hạn = 1.4 × số nước bot cần + 2); test chạy lại bot cho từng màn.
- 5 luật sự kiện (chữ thập đá, bốn góc, đổi khối thả ga, hai cột đá, đá rải rác), xoay theo tuần ISO.
- E2E (scratchpad `e2e-phase6.ts`, Firebase thật, bản production): sự kiện nộp 200 + vào `event-2026-W44`; màn 1 → 3 sao + 60 xu, chơi lại không thưởng lại, màn 3 khi chưa qua màn 2 → 403; duel: tạo/vào/người thứ 3 409, xin ván trong lúc đếm ngược 409, cùng seed, mỗi người 1 ván, đủ 2 điểm → chốt đúng người thắng, duelStats, đấu lại gắn link, RTDB mirror ghi được (đọc/ghi từ client 401 tới khi deploy rules mới).
- Sau review (`plans/reports/reviewer-261028-phase-06-duels-events-levels.md`): đồng hồ trận dùng lệch giờ server (từ RTDB hoặc giờ server trả kèm khi cấp ván/API), không tin đồng hồ máy; trang phòng chạy sync + chốt ván khi hết giờ (rời màn chơi giữa trận vẫn nộp); phòng chọn bản trạng thái "tiến xa" hơn giữa RTDB/API + hỏi lại server mỗi 5s khi quá hạn; mirror RTDB bằng transaction không ghi lùi; không cấp seed trước giờ bắt đầu; `started` để không đưa người đã chơi quay lại; server chặn màn chưa mở; ván sự kiện chưa chơi không bị coi là "đang dở".
- Còn để ngỏ: giới hạn 3 phút chỉ thực thi phía client (log không có timestamp) — server chặn theo hạn nộp; node RTDB `/duels` không tự dọn; chưa giới hạn số phòng tạo mỗi người; ghép trận ngẫu nhiên.

- RTDB rules đã publish trên console (2026-10-28): client ghi presence + điểm trực tiếp 200, ghi hộ/đọc danh sách 401, "đang chơi" đếm đúng 2 khi có 2 người, trạng thái phòng đọc được qua RTDB.
