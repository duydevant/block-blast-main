# Phase 05: Đấu lại trong phòng: sẵn sàng → ván mới, tỉ số

## Context
- Hiện tại: `createDuel(uid, rematchOf)` tạo phòng mới và gắn `rematchId`; nút "Đấu lại" / "Vào trận đấu lại" trong `duel-room-view.tsx`.
- Phụ thuộc: [phase-02](phase-02-duel-rules-and-round-model.md), [phase-04](phase-04-live-opponent-view-and-early-finish.md)

## Overview
Priority P2 · Status Todo. Phòng sống qua nhiều ván với cùng mã và cùng link. Ván xong, hai người bấm "Sẵn sàng": đủ hai người thì đếm ngược 5 giây và vào ván mới với seed mới. Phòng hiện tỉ số.

## Key Insights
- Người xem (phase 06) ở lại phòng nên tự xem được ván tiếp theo mà không phải đổi link.
- Seed mới mỗi ván để không học thuộc bộ khối.

## Requirements
- `POST /api/duels/{code}/ready`:
  - chỉ người chơi gọi được, chỉ khi ván hiện tại đã xong;
  - đánh dấu sẵn sàng; người thứ hai sẵn sàng thì tạo `rounds/{n+1}` (seed mới, `startAt = now + 5s`, `endsAt = startAt + 3 phút`), xoá danh sách sẵn sàng, mirror.
- `POST /api/duels/{code}/ready` với `{ ready: false }`: huỷ sẵn sàng.
- Kết thúc ván cộng `series[winnerUid]` (hoà không cộng). Thống kê `duelStats` vẫn cộng theo ván.
- Phòng hết hạn khi không có ván mới sau 1 giờ. TTL doc dời theo lần hoạt động cuối.
- Trang phòng hiện:
  - tỉ số (Bạn 2 – 1 Đối thủ);
  - lịch sử ván (điểm từng ván);
  - trạng thái sẵn sàng của hai bên;
  - nút "Rời phòng".
- Một người rời phòng (bấm rời, hoặc mất presence quá 2 phút khi đang chờ sẵn sàng): người còn lại thấy "Đối thủ đã rời" cùng nút "Tạo phòng mới".

## Architecture
```
Firestore duels/{code}: round, series, readyUids[], lastActiveAt, expireAt
RTDB duels/{code}/state: + series, ready, round
server/duels/duel-ready.ts       setReady (transaction)
```

## Related Code Files
- Tạo: `server/duels/duel-ready.ts`, `app/api/duels/[id]/ready/route.ts`, `modules/duel/components/duel-series-score.tsx`
- Sửa: `duel-store.ts` (bỏ `rematchOf`), `duel-room-view.tsx`, `duel-actions.ts`, `create-duel-card.tsx` (bỏ luồng rematch), `game-modes-translations.ts`
- Xoá: field `rematchId` và luồng `createDuelRoom(rematchOf)`

## Implementation Steps
1. `setReady` + test luật (chỉ người chơi, chỉ khi ván xong, đủ hai thì mở ván mới đúng một lần dù gọi đồng thời).
2. Kết thúc ván cập nhật `series`.
3. UI: tỉ số, lịch sử ván, nút sẵn sàng, trạng thái đối thủ. Đếm ngược xong thì cả hai tự vào ván (như hiện tại).
4. `startDuelGame` nhận `round` để session gắn đúng ván.

## Todo
- [ ] API sẵn sàng + test
- [ ] Tỉ số + lịch sử ván
- [ ] UI phòng nhiều ván
- [ ] Bỏ luồng rematch cũ

## Success Criteria
- Ba ván liên tiếp cùng một mã, tỉ số đúng. Người xem ở lại phòng thấy cả ba ván.

## Risks
- Hai người bấm sẵn sàng cùng lúc: transaction + kiểm `round` không đổi.

## Security
- Chỉ hai người chơi gọi được ready. Người xem gọi thì nhận 403.

## Next
Phase 07.
