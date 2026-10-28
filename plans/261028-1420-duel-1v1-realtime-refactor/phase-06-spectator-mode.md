# Phase 06: Người xem

## Context
- Hiện tại:
  - người ngoài mở `/duel/{code}` thấy thẻ VS và hai con số;
  - RTDB `duels/{id}` đọc được với mọi tài khoản đã đăng nhập (kể cả khách ẩn danh).
- Phụ thuộc: [phase-03](phase-03-server-timed-move-stream-and-settle.md), [phase-04](phase-04-live-opponent-view-and-early-finish.md)

## Overview
Priority P2 · Status Todo. Ai có link hoặc mã đều vào xem được khi phòng đã đủ 2 người. Màn xem gồm hai bàn trực tiếp, điểm, đồng hồ, tỉ số, kết quả từng ván và số người đang xem.

## Key Insights
- Người xem chỉ đọc; bàn vẽ bằng replay nước đi (cùng hook với phase 04), không tốn thêm server.
- Đếm người xem bằng presence RTDB `duels/{code}/watchers/{uid}` (`onDisconnect().remove()`), dùng chung kết nối ref-count `holdRealtimeConnection`.

## Requirements
- `/duel/{code}`:
  - mình là người chơi thì giao diện người chơi như cũ;
  - phòng còn chờ thì nút "Vào đấu";
  - phòng đủ người thì **giao diện người xem**.
- Giao diện người xem:
  - hai bàn cạnh nhau (dọc trên điện thoại hẹp), tên, điểm, chênh lệch;
  - đồng hồ ván, banner "X đã hết nước, Y còn 0:30 để vượt";
  - tỉ số phòng, kết quả ván, đếm ngược ván kế khi hai người sẵn sàng;
  - số người đang xem (👁 12).
- Nút "Mời xem" để chia sẻ link (dùng `shareOrCopyLink`). Người chơi cũng thấy số người đang xem.
- Ô "Vào bằng mã" ở `/duel`: phòng đủ người thì vào chế độ xem, không báo lỗi "phòng đã đủ" như hiện tại.
- Rules: `watchers/$uid` chỉ chính chủ ghi được, giá trị là `now`; không ai ngoài server ghi được `state`/`rounds`.

## Architecture
```
modules/duel/use-duel-watchers.ts          presence người xem + đếm
modules/duel/components/duel-spectator-view.tsx   hai bàn + đồng hồ + tỉ số
modules/duel/components/duel-watch-panel.tsx      (phase 04) dùng cho từng bàn
```

## Related Code Files
- Tạo: các file trên.
- Sửa: `duel-room-view.tsx` (chọn giao diện theo vai trò), `duel-join-by-code.tsx` (phòng đủ người thì vào xem), `database.rules.json` (watchers), `game-modes-translations.ts`.

## Implementation Steps
1. Presence người xem + rules.
2. Giao diện người xem dùng lại hook bàn đối thủ cho cả hai người.
3. Vai trò trong phòng: người chơi / người xem / khách chưa vào (phòng chờ).
4. Kiểm trên điện thoại: hai bàn vẫn đọc được ở 360px (mỗi bàn khoảng 160px).

## Todo
- [ ] Presence + đếm người xem
- [ ] Giao diện người xem
- [ ] Vào bằng mã khi phòng đủ thì vào xem
- [ ] Kiểm mobile

## Success Criteria
- Mở link trên máy thứ ba thấy hai bàn chạy đúng như hai người đang chơi; số người xem tăng giảm đúng.

## Risks
- Băng thông RTDB khi nhiều người xem: mỗi người xem tải toàn bộ nước đi của ván, khoảng 30 KB. Chấp nhận được.
- Mách nước cho người chơi: chấp nhận, vì đây là đấu bạn bè. Ghi rõ trong câu hỏi mở.

## Security
- Người xem không ghi được gì ngoài presence của chính mình.
- Seed chỉ lộ khi ván đã bắt đầu. Người chơi vốn đã có seed ở client nên không lộ thêm gì.

## Next
Phase 07.
