# Project Roadmap

## v1 — Block puzzle game (2026-10-27) — Done

Plan: `plans/261027-1030-original-block-puzzle-game-module/`

| Phase | Status |
|---|---|
| 01 Scope, setup (`Routes.PLAY`, tên game qua env) | Done |
| 02 Engine thuần TS + test | Done |
| 03 Canvas renderer + kéo thả | Done |
| 04 Store, persist, HUD, dialog | Done |
| 05 Hiệu ứng, âm thanh, rung | Done |
| 06 Route `/play`, nav, SEO, i18n | Done |
| 07 Test, QA, docs | Done (còn QA thiết bị thật) |

## v1.1 — Thay phần lấy từ bản build bên thứ ba (2026-10-27) — Done

Plan: `plans/261027-1600-replace-third-party-derived-code-and-assets/`

- Xoá sprite/âm thanh trích xuất, WASM chọn khối, pool/tutorial/điểm/layout port từ bản gốc, font PT Sans.
- Bộ chia khối mới: trọng số + độ khó theo điểm, giảm lặp, khay luôn đặt được cả 3, ưu tiên khối cứu khi bàn đầy. Số chỉnh ở `engine/tray-generator-config.ts`.
- Bot tự chơi đo cân bằng: `npm run balance` (300 ván: điểm TB ~927, ~53 nước/ván, 35% nước xoá dòng). Tìm kiếm khay chạy trên bitmask: chia khối ≤ ~15ms trường hợp xấu nhất trên desktop.
- Điểm/combo, ô cất (300 điểm), đổi khay (2/ván), hồi sinh, tutorial 3 bài đều theo luật riêng. `SAVE_VERSION` 3 (giữ kỷ lục, bỏ ván dở).
- UI vẽ bằng code: 4 theme, HUD/menu/dialog mới, âm thanh Web Audio, font Inter.

## v1.2 — Đồng bộ hành vi chia khối Classic (2026-10-27)

- Viết lại bộ chọn theo bàn bằng TypeScript, đối chiếu 5.000 bàn / 15.000 lựa chọn với build tham chiếu.
- Chu kỳ smart/bag/bag, túi khối theo điểm 100/800, bổ sung khối 2 ô chéo. Giữ ID khối hiện tại và chuyển state save v3 sang chu kỳ mới mà không bỏ ván.
- Giữ giao diện, âm thanh và luật tính điểm hiện tại. Chi tiết phạm vi: `classic-tray-generation.md`.

## v2 — Giữ chân + kéo người chơi trên Firebase (2026-10-27)

Plan: `plans/261027-1800-retention-acquisition-features-firebase/`

| Phase | Status |
|---|---|
| 01 Khách ẩn danh + liên kết Google, profile cloud, API start/submit + replay kiểm tra điểm, rules | Done (chưa deploy rules, chưa test liên kết Google bằng tài khoản thật) |
| 02 Daily challenge, streak, BXH ngày/tuần/mọi lúc | Done (cần đặt `DAILY_SEED_SECRET` ở nơi host) |
| 03 Thẻ share, thách đấu bạn bè, ảnh OG | Done (đặt `NEXT_PUBLIC_SITE_URL` đúng domain khi deploy) |
| 04 Nhiệm vụ ngày, XP/cấp/xu, shop theme, thành tích, mời bạn | Done (2026-10-28) |
| 05 PWA (cài app, offline), Web Push nhắc chuỗi, "X người đang chơi", trang SEO | Done (2026-10-28; cần cron + env VAPID ở host) |
| 06 Đấu 1v1 realtime (phòng riêng qua link), sự kiện tuần, 20 màn chơi | Done (2026-10-28) |

- Bỏ scaffold auth/axios cũ (`lib/api/*`, trang sign-in/sign-up). Save giữ `SAVE_VERSION` 3, field mới (log nước đi, hàng chờ nộp) là tuỳ chọn → không mất ván dở.

## v2.1 — Giao diện mới (2026-10-28)

- Theo bản thiết kế 10 màn hình (canvas thiết kế): nền tím đậm cho toàn site (luôn chế độ tối), font Baloo 2 cho tiêu đề/số, mỗi chế độ một màu (`components/game-ui/game-ui-classes.ts`).
- Trang chủ: bàn mẫu + nút Chơi, thẻ thử thách ngày (1 dòng luật + đồng hồ), 4 ô chế độ, vòng nhiệm vụ. Trang mới `/daily` giải thích thử thách ngày bằng 4 ô hình.
- Màn chơi: thanh trên (về nhà · kỷ lục + điểm · menu lưới), ô "Cất" có nhãn + điều kiện mở, nút "Đổi khối ×N" cạnh ô cất, gợi ý kéo khối cho người mới; hộp hết ván số to + XP/xu + Chơi tiếp/Ván mới + ô icon; cách chơi bằng hình.
- Màn chơi (levels) thua không còn "Chơi tiếp" (engine cũng chặn hồi sinh khi có giới hạn nước).
- Làm lại các trang màn chơi, đấu 1v1, xếp hạng (bục top 3 + thanh hạng của mình), hồ sơ (vòng cấp, ô số liệu, huy hiệu, nút bật/tắt).

## v2.2 — Thưởng & mục tiêu (2026-10-28)

- Lượt daily tính điểm lên cả bảng tuần + mọi lúc (trước chỉ bảng ngày).
- Tab "Hôm nay" = mọi ván tính điểm trong ngày (bảng `today-*`), tách khỏi bảng thử thách ngày; ván Vô tận tính cho sự kiện tuần. Đã ghi bù các ván tuần 2026-W44.
- Nhận thưởng ngày theo chuỗi (/daily), mục tiêu + thưởng cho sự kiện tuần (/event), mã phòng 6 ký tự cho 1v1, hồ sơ: hàng nhập tên thẳng hàng + modal thành tích.

## v2.3 — Đấu 1v1 thời gian thực (2026-10-28)

- Khoá người chơi trong trận: bỏ hướng dẫn khi vào đấu, bảng điểm hai bên, cấm hồi sinh, chết → bảng "Trận đấu" (không ván mới), xác nhận khi bỏ trận; sửa lỗi ván đấu bị chốt "sống lại" khi tải lại save.
- Nước đi lên RTDB kèm giờ server, server chấm từ nước đi: chốt ngay khi người còn sống vượt điểm người đã dừng; xem bàn đối thủ trực tiếp.
- Phòng nhiều ván cùng mã (sẵn sàng → ván mới, tỉ số, lịch sử), người xem bằng link/mã, đếm người xem. Cần publish `database.rules.json` mới.

## v2.4 — Khay đầu ngẫu nhiên, 1v1 gọn hơn (2026-10-29)

- Khay đầu ván ngẫu nhiên theo seed (19 bộ khối to, luôn nổ được ≥ 2 dòng) thay cho 3x3, 3x3, 2x2 cố định.
- Đấu 1v1: bỏ Cất và Đổi khối (bàn to hơn); phòng đấu thêm nút "Copy link" cạnh "Gửi link mời" và "Mời xem".

## v2.5 — Thử thách ngày có mốc cá nhân, gộp sự kiện tuần (2026-10-29)

- Thử thách ngày: 3 lượt/ngày (lấy cao nhất), mốc ★/★★/★★★ theo phong độ của chính người chơi (trung vị 7 ngày) + mốc phá kỷ lục, xu cộng ngay khi đạt; HUD hiện lượt + mốc kế tiếp.
- Thử thách tuần thay sự kiện tuần: bảng tổng điểm 7 ngày (tab "Thử thách"), rương sao 10★/18★, thưởng hạng nhận thứ Hai. Bỏ chế độ Sự kiện tuần; Vô tận chỉ tính Hôm nay / Tuần / Mọi lúc.

## v2.6 — Chiều sâu kỹ năng, Phase 01 học từ Minesweeper Online (2026-10-29)

Plan: `plans/261029-2025-ap-dung-minesweeper-online-vao-block-blast/` (phase 01 xong, 02–04 chờ)

- Chỉ số ván trong reducer (điểm/nước, xoá ≥3 dòng, ván thuần…) hiện ở hộp hết ván; thống kê người chơi + theo chế độ.
- Phong độ (trung vị 20 ván) → Bậc kỹ năng có thưởng lần đầu; huy hiệu ở hồ sơ, BXH, hộp hết ván.
- Lịch sử ván `/profile/games` (lọc chế độ, biểu đồ điểm), bộ đếm năm.
- Nhiệm vụ 12 loại, mức theo Bậc, đổi 1 nhiệm vụ/ngày; 11 thành tích mới, nhóm theo chủ đề.
- Cài đặt nâng khối, mù màu, giảm chuyển động, tắt tô dòng; chơi bằng bàn phím.
- Cần làm ở host: TTL `games.expireAt`, deploy `firestore.indexes.json`.

## v2.7 — Bằng chứng kỷ lục, BXH đa hạng mục, Không bế tắc, Phase 02 (2026-10-29)

- Replay: kỷ lục / lọt top tự lưu, tự lưu thêm tối đa 20 ván; trang `/game/{id}` (phát/dừng, tua, ×1/×2/×4, phím ← →), hồ sơ công khai `/u/{tag}`, link từ BXH.
- BXH 6 hạng mục: Điểm, Phong độ, Thuần, Combo, Sao, Không bế tắc.
- Chống bot theo nhịp chơi + báo cáo replay; giữ thưởng hạng tuần khi bị báo cáo.
- Chế độ "Không bế tắc" (khay luôn có lối đi), bảng riêng.
- "Vì sao thua?" sau ván: nước quyết định + gợi ý; thống kê xui/sai ở hồ sơ.
- Cần làm ở host: TTL `gameReplays.expireAt`, deploy `firestore.indexes.json`, cron `rebuild-leaderboards` (Vercel đã khai trong `vercel.json`, Docker trong `docker/daily-reminder-cron.sh`).
- Ngay sau khi deploy: chạy `npx vite-node --config vitest.config.ts scripts/backfill-form-and-stars-leaderboards.ts` (chạy thử) rồi thêm `--write` để điền sẵn bảng Phong độ + Sao từ `gameSessions` cũ (≤ 30 ngày) và `levelStars`. Mỗi người chỉ gộp 1 lần (`formBackfilledAt`).

## v2.8 — Mùa giải, Đấu trường, Bài học (Phase 03, 2026-10-30)

- Mùa giải tháng: BXH mùa (Điểm / Phong độ / Thuần), 5 nhiệm vụ mùa, thưởng hạng + huy hiệu nhận ở mùa sau; trang `/season`, thẻ trang chủ, huy hiệu ở hồ sơ.
- Đấu trường 5 loại × 5 cấp, trả xu mở lượt (chỗ tiêu xu chính), trang `/arena`, đồng hồ giờ server cho loại Tốc độ. Số liệu đo bằng bot: `reports/arena-balance.txt`.
- 12 bài học kỹ thuật với lời giải mẫu, trang SEO `/how-to-play/{slug}`, link từ "Vì sao thua?".
- Theo dõi kinh tế xu: `coinsSpentTotal` (xu đã kiếm = coins + đã tiêu).
- Cần ở host: deploy `firestore.indexes.json`; theo dõi tỉ lệ xu tiêu / kiếm sau 4 tuần (mục tiêu ≥ 0.6).

## Còn mở

- QA trên điện thoại thật (Android Chrome, iOS Safari), cả dọc và ngang.
- Playtest để cân chỉnh điểm/độ khó (`engine/tray-generator-config.ts`, `engine/score-and-combo-rules.ts`), dùng `npm run balance` để so trước/sau. Đổi catalog khối → tăng `SAVE_VERSION`.
- Chốt tên game + bộ nhận diện (env `NEXT_PUBLIC_SITE_NAME`).
- Kiểm tra âm thanh trên iOS Safari (unlock audio đã gọi ở pointerdown/pointerup/keydown).
- Chỉnh ngưỡng Bậc + band nhiệm vụ theo phân phối điểm thật sau ~2 tuần (`player-form-rules.ts`, `daily-mission-catalog.ts`).
- Nhỏ: "Kỷ lục mới" hiện cả khi bằng kỷ lục cũ; 2 tab cùng mở ghi đè save của nhau; canvas mờ khi kéo cửa sổ sang màn hình khác DPR.

## Follow-up (chưa lên kế hoạch)

- Xem plan v2 ở trên (BXH, daily, share, PWA đã lên kế hoạch).
