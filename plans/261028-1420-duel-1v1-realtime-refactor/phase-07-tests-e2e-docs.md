# Phase 07: Test, e2e, review, docs

## Overview
Priority P1 · Status Todo. Kiểm toàn bộ luồng với Firebase thật, review và cập nhật docs.

## Requirements
- Unit:
  - `decideRound` (mọi nhánh);
  - lọc nước đi theo hạn/chỗ hở;
  - `setReady`;
  - chuyển bàn sang rows.
- E2E (script scratchpad, hai khách ẩn danh và một người xem):
  1. Tạo phòng, vào phòng, đếm ngược, hai bên đẩy nước, settle ra điểm đúng bằng replay cục bộ.
  2. A chết khi B đang hơn: kết thúc `clinched` ngay.
  3. A chết khi B đang kém: B có hạn chót `overAt + 30s`; nước sau hạn bị rules từ chối.
  4. Ghi trước giờ, ghi hộ người khác, ghi đè nước, người xem ghi nước: đều bị từ chối.
  5. Hai người sẵn sàng thì ván 2 có seed mới, tỉ số cập nhật.
  6. Settle gọi đồng thời 3 lần: thống kê chỉ cộng 1 lần.
- Kiểm tay trên Chrome (2 tab chơi + 1 tab xem) và mobile 360px.
- Review code (`code-reviewer`), sửa phát hiện.
- Docs:
  - `docs/system-architecture.md` (mục đấu 1v1 mới);
  - `docs/project-roadmap.md`;
  - nhắc publish `database.rules.json`.

## Todo
- [ ] Unit test
- [ ] E2E Firebase thật
- [ ] Kiểm tay desktop + mobile
- [ ] Review + sửa
- [ ] Docs + nhắc publish rules RTDB

## Success Criteria
- Toàn bộ test qua. E2E đủ 6 kịch bản. Review không còn lỗi mức cao.
