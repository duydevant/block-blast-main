# Phase 04: Màn chơi: theo dõi đối thủ, chết sớm → xem, chốt sớm

## Context
- Hiện tại:
  - `modules/duel/components/duel-hud.tsx` (pill điểm);
  - `modules/game-modes/components/game-over-variant-section.tsx` (link "Xem kết quả");
  - `components/game-ui/block-board-preview.tsx`.
- Phụ thuộc: [phase-03](phase-03-server-timed-move-stream-and-settle.md); nâng cấp HUD đấu và bảng "Trận đấu" đã làm ở [phase-01](phase-01-lock-player-into-duel-run.md).

## Overview
Priority P1 · Status Todo. Trong ván luôn thấy đối thủ đang làm gì. Chết rồi thì chuyển sang xem đối thủ, kèm đồng hồ "còn Xs để vượt". Trận kết thúc ngay khi đã rõ thắng thua.

## Key Insights
- Replay tăng dần: giữ `GameState` của đối thủ trong hook và áp từng action mới (`onChildAdded`), không replay lại từ đầu.
- Bàn mini dùng lại `BlockBoardPreview`, chỉ cần hàm `boardToPreviewRows(state)`.

## Requirements
- `useDuelOpponentBoard(code, round, uid)` trả về `{ state, score, over, lastMoveAt }` từ seed và moves.
- HUD khi đang chơi: thanh trên cùng gồm
  - đồng hồ;
  - điểm mình và điểm đối thủ;
  - chênh lệch (+120 xanh / -80 đỏ);
  - bàn mini 8×8 của đối thủ (khoảng 72px, chạm vào phóng to);
  - badge "Đã hết nước" khi đối thủ chết.
- Đối thủ chết trước: banner "Đối thủ dừng ở X điểm, vượt trong 0:30 để thắng".
- Mình chết trước: thay hộp game over bằng **màn xem đối thủ**: bàn to, điểm, đếm ngược hạn chót của đối thủ, dòng "Cần thêm N điểm để vượt bạn".
- Ván kết thúc: màn kết quả chung với hai điểm, lý do (`Vượt điểm sớm` / `Hết giờ` / `Cả hai hết nước`), tỉ số phòng, nút "Sẵn sàng ván mới" (phase 05) và "Về phòng".
- Đối thủ mất kết nối (presence người chơi trong phòng): hiện "Mất kết nối…". Không dừng ván, hạn chót vẫn chạy.

## Architecture
```
modules/duel/use-duel-opponent-board.ts     nghe moves → reducer cục bộ
modules/duel/components/duel-hud.tsx        HUD mới (đồng hồ, điểm, chênh lệch, bàn mini)
modules/duel/components/duel-watch-panel.tsx  màn xem đối thủ khi mình đã chết (dùng lại ở phase 06)
modules/duel/components/duel-round-result.tsx màn kết quả ván
modules/duel/duel-board-preview-rows.ts     GameState → rows cho BlockBoardPreview
```

## Related Code Files
- Tạo: các file ở trên.
- Sửa:
  - `duel-hud.tsx`;
  - `game-over-variant-section.tsx` (duel: hiện watch panel / kết quả thay link);
  - `duel-room-view.tsx` (đang chơi: hiện cả hai bàn);
  - `game-modes-translations.ts` (chuỗi mới en/vi).

## Implementation Steps
1. Hook bàn đối thủ + chuyển state → rows; test chuyển đổi.
2. HUD mới. Ước lượng chiều cao để không đẩy bàn chơi trên điện thoại nhỏ; kiểm ở 360×640.
3. Watch panel + logic gọi settle (mình chết, vượt điểm, quá hạn).
4. Màn kết quả ván. Âm thanh và hiệu ứng thắng/thua dùng lại hiệu ứng có sẵn (pháo khối như thưởng ngày).

## Todo
- [ ] use-duel-opponent-board + rows
- [ ] HUD mới
- [ ] Màn xem đối thủ khi mình chết
- [ ] Chốt sớm khi vượt điểm (client gọi settle)
- [ ] Màn kết quả ván
- [ ] Kiểm mobile 360px

## Success Criteria
- Chết lúc 0:30 khi đối thủ đang hơn điểm: kết quả hiện trong khoảng 2 giây.
- Đối thủ đang kém: chờ tối đa 30 giây, có xem bàn đối thủ.
- Bàn mini khớp bàn thật của đối thủ (so sánh e2e bằng replay).

## Risks
- HUD chiếm chỗ trên màn nhỏ: bàn mini thu gọn được.
- Hiệu năng: mỗi action đối thủ chỉ áp một lần vào reducer, nhẹ.

## Security
- Chỉ hiển thị; kết quả vẫn do server quyết.

## Next
Phase 05 (nút sẵn sàng ván mới) và phase 06 (dùng lại watch panel).
