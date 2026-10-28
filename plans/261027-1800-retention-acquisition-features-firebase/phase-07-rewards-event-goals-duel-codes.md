# Phase 07 — Thưởng ngày, mục tiêu sự kiện, mã phòng 1v1, sửa BXH + hồ sơ

## Overview
- Priority: P1 (phản hồi người dùng 2026-10-28) · Status: Done (2026-10-28)
- Sửa: lượt daily không lên bảng tuần/mọi lúc. Thêm: nhận thưởng ngày theo chuỗi, mục tiêu + phần thưởng cho sự kiện tuần, mã phòng 6 ký tự cho 1v1, chỉnh hồ sơ (ô tên + nút lưu cùng hàng, modal thành tích).

## Key Insights
- Lượt daily tính điểm (chỉ lượt đầu, seed lộ khi sang ngày) đủ công bằng để vào bảng tuần + mọi lúc.
- Thưởng phải do server cấp: điều kiện kiểm trong transaction (đã hoàn thành daily hôm nay / điểm sự kiện đạt mốc / hạng tuần trước), đánh dấu đã nhận để không nhận 2 lần.
- Hạng sự kiện tuần trước tính lúc nhận (count điểm cao hơn) — không cần cron.
- Mã phòng = chính id phòng (6 ký tự không dễ nhầm), link và mã là một.

## Requirements
- Thưởng ngày: vòng 7 ngày theo chuỗi (20→150 xu), nhận ở /daily sau khi xong lượt tính điểm hôm nay; trang chủ báo "có quà".
- Sự kiện: 3 mốc điểm trong tuần (1.000/3.000/6.000) có xu; xếp hạng cuối tuần (top 1/3/10/100 + tham gia) nhận ở tuần sau; trang /event.
- 1v1: tạo phòng ra mã 6 ký tự, vào bằng mã hoặc link.
- Hồ sơ: ô tên + nút lưu cùng hàng, mép thẳng; bấm thành tích mở modal chi tiết.

## Architecture
```
modules/progression/daily-reward-track.ts   vòng thưởng chuỗi (thuần)
server/daily/claim-daily-reward.ts           POST /api/daily/claim
modules/game-modes/event-rewards.ts          mốc + bậc hạng (thuần)
server/events/*                              GET /api/events, POST /api/events/claim
users/{uid}/daily/{day}.rewardClaimedAt, users/{uid}/eventRewards/{week}
duel id: 6 ký tự (dùng lại bảng chữ mã mời)
```

## Todo List
- [x] Daily vào bảng tuần + mọi lúc
- [x] Thưởng ngày (server + /daily + trang chủ)
- [x] Mục tiêu/thưởng sự kiện (server + /event)
- [x] Mã phòng 6 ký tự + ô nhập mã
- [x] Hồ sơ: hàng tên, modal thành tích
- [x] Test, e2e, review, docs

## Success Criteria
- Nhận thưởng ngày đúng 1 lần/ngày, chỉ sau lượt tính điểm; nhận thưởng sự kiện đúng điều kiện, không nhận lại.
- Vào phòng bằng mã nhập tay hoạt động như link.

## Security Considerations
- Mọi phần thưởng kiểm trong transaction Admin SDK; client chỉ gửi tuần/mốc muốn nhận.

## Kết quả
- E2E Firebase thật (scratchpad `e2e-phase7.ts`): lượt daily vào cả 3 bảng; nhận thưởng ngày 200 rồi 409; mốc sự kiện nhận 1 lần, mốc chưa đạt 409, thưởng hạng tuần đang chạy 409, tuần cũ 410; mã phòng 6 ký tự, vào bằng mã, link chữ thường chuyển về mã chuẩn.
- Sau review (`plans/reports/reviewer-261028-phase-07-rewards-event-goals-duel-codes.md`): xoá phòng RTDB cũ khi mã được dùng lại; nhận thưởng lượt hôm qua nếu chơi xong sát nửa đêm; bảng sự kiện chốt 1 giờ sau khi tuần kết thúc (thưởng hạng mở sau đó, hạng lưu lúc nhận); không đếm hạng lại cho tuần đã nhận.
- Phản hồi tiếp (cùng ngày): tab "Hôm nay" chỉ có lượt thử thách nên lệch với "Tuần này" → thêm bảng `today-YYYYMMDD` gồm mọi ván tính điểm (Vô tận + daily), bảng `daily-*` giữ riêng cho thử thách (/daily). Ván Vô tận ghi thêm vào bảng sự kiện tuần này.
- Ghi bù tuần 2026-W44 (scratchpad `backfill-boards.ts`, chỉ nâng điểm, chạy lại không ghi thêm): hôm nay 9, tuần 7, mọi lúc 7, sự kiện 16 dòng.
