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

## Còn mở

- QA trên điện thoại thật (Android Chrome, iOS Safari), cả dọc và ngang.
- Playtest để cân chỉnh điểm/độ khó (`engine/tray-generator-config.ts`, `engine/score-and-combo-rules.ts`), dùng `npm run balance` để so trước/sau. Đổi catalog khối → tăng `SAVE_VERSION`.
- Chốt tên game + bộ nhận diện (env `NEXT_PUBLIC_SITE_NAME`).
- Kiểm tra âm thanh trên iOS Safari (unlock audio đã gọi ở pointerdown/pointerup/keydown).
- Chơi bằng bàn phím (WCAG 2.1.1) — hiện chỉ hỗ trợ chuột/cảm ứng.
- Nhỏ: "Kỷ lục mới" hiện cả khi bằng kỷ lục cũ; 2 tab cùng mở ghi đè save của nhau; canvas mờ khi kéo cửa sổ sang màn hình khác DPR.

## Follow-up (chưa lên kế hoạch)

- Xem plan v2 ở trên (BXH, daily, share, PWA đã lên kế hoạch).
