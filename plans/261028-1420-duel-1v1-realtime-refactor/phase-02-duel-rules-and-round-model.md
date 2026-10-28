# Phase 02: Luật trận + mô hình phòng nhiều ván

## Context
- Hiện tại: `server/duels/duel-rules.ts`, `duel-documents.ts`, `duel-store.ts`, `modules/duel/duel-types.ts`
- Plan: [plan.md](plan.md)

## Overview
Priority P1 · Status Todo. Tách "phòng" (người chơi, tỉ số, người xem) khỏi "ván" (seed, giờ, hạn chót từng người, kết quả). Viết luật chốt ván thành hàm thuần có test.

## Key Insights
- Điểm trong ván không bao giờ giảm. Người còn sống đã có điểm kiểm tra **lớn hơn** điểm cuối của người đã chết thì thắng chắc, chốt được ngay.
- Hạn chót phải theo **từng người**: người còn sống bị rút hạn còn `min(endsAt, deathAt + 30s)`.
- Hoà khi bằng điểm. Người không có nước đi nào thì điểm 0, không "thua vì không nộp" nữa vì điểm đã nằm sẵn trên RTDB.

## Requirements
- Phòng: `code`, `hostUid/guestUid` (+ tên), `round` (số ván hiện tại), `series` (uid → số ván thắng), `status` phòng: `waiting | ready | playing | finished | expired`.
- Ván `rounds/{n}`: `seed`, `startAt`, `endsAt`, `deadlines {uid: ms}`, `results {uid: {score, over, moves, verifiedAt}}`, `winnerUid`, `endReason`. `endReason` nhận một trong các giá trị:
  - `clinched`: chốt sớm;
  - `both-over`: cả hai chết;
  - `time`: hết giờ;
  - `forfeit`: không vào ván.
- Luật thuần `decideRound(snapshot, now)` → `{ deadlines, finished, winnerUid, endReason }`.

## Architecture
```
Firestore duels/{code}                  phòng (nguồn thật): người chơi, round, series, status
Firestore duels/{code}/rounds/{n}       ván: seed, giờ, deadlines, results, winner
RTDB duels/{code}/state                 mirror phòng + ván hiện tại (thêm seed khi ván đã bắt đầu)
server/duels/duel-round-rules.ts        decideRound, applyDeath, isClinched (thuần)
```
Luật `decideRound` (A, B là hai người; S = điểm kiểm tra; over = replay báo hết nước):
1. Cả hai over → so điểm (`both-over`).
2. A over và S_B > S_A → B thắng (`clinched`).
3. A over và S_B ≤ S_A → `deadline_B = min(endsAt, overAt_A + DUEL_LAST_STAND_MS)`. Quá hạn đó → so điểm (`time`).
4. Không ai over, `now > endsAt + DUEL_MOVE_GRACE_MS` → so điểm (`time`).
5. Ván đã bắt đầu mà một người không có nước nào → điểm 0, áp các luật trên như thường.

## Related Code Files
- Tạo: `server/duels/duel-round-rules.ts`, `server/duels/duel-round-rules.test.ts`
- Sửa: `modules/duel/duel-types.ts` (DuelState có round, series, deadlines, seed, endReason; hằng `DUEL_LAST_STAND_MS = 30_000`, `DUEL_MOVE_GRACE_MS = 3_000`), `server/duels/duel-documents.ts` (schema phòng + ván, `toDuelState`), `server/duels/duel-rules.ts` (gộp hoặc thay bằng round rules)
- Xoá: `server/duels/record-duel-result.ts` (thay bằng settle ở phase 03)

## Implementation Steps
1. Định nghĩa schema zod cho phòng và ván, cùng `DuelState` mới (giữ `duelStateRank` để chống ghi lùi; thêm round vào rank).
2. Viết `decideRound` và helper; test mọi nhánh: chốt sớm, rút hạn, hoà, không có nước, hết giờ.
3. Đọc phòng định dạng cũ (không có `round`): trả trạng thái chỉ-xem, không cho chơi.

## Todo
- [ ] Schema phòng/ván + DuelState mới
- [ ] `decideRound` + test
- [ ] Tương thích đọc phòng cũ

## Success Criteria
- Test luật phủ đủ 5 nhánh. Typecheck sạch.

## Risks
- Đổi DuelState làm vỡ UI hiện tại → làm phase 02–03 liền nhau rồi mới deploy.

## Security
- Luật chỉ chạy ở server; client chỉ hiển thị.

## Next
Phase 03 dùng `decideRound` khi chấm.
