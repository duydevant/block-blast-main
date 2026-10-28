# Phase 03: Nước đi lên RTDB có giờ server, server chấm từ nước đi

## Context
- Hiện tại:
  - `modules/duel/use-duel-room.ts` (`reportDuelLiveScore`);
  - `server/games/record-submitted-ranked-game.ts` (nộp ván cả log lúc hết);
  - `database.rules.json`;
  - `modules/block-puzzle/engine/replay-recorded-game-actions.ts`.
- Phase trước: [phase-02](phase-02-duel-rules-and-round-model.md)

## Overview
Priority P1 · Status Todo. Mỗi action trong ván đấu được ghi ngay lên `duels/{code}/moves/{round}/{uid}/{seq}` kèm `at`, và rules ép `at` bằng giờ server. Server chấm ván bằng cách replay nước đi đọc từ RTDB, không dùng log client gửi lên.

## Key Insights
- Rules RTDB có `now` và kiểm được `newData.child('at').val() === now` khi client ghi `ServerValue.TIMESTAMP`. Nhờ đó server biết chính xác nước nào đi lúc nào, không cần ân hạn 60 giây nữa.
- Client offline thì SDK xếp hàng ghi; lúc có mạng lại thì `now` đã quá hạn nên rules từ chối. Đúng ý muốn: nước đi lúc mất mạng không được tính.
- Key `seq` đánh số 0-pad (`000042`) để sắp theo thứ tự. Server replay tới chỗ hở đầu tiên thì dừng.
- Chỉ một nguồn sự thật: điểm đấu, thống kê, XP của ván đấu đều tính từ cùng chuỗi nước trên RTDB.

## Requirements
- Client ghi từng action (đặt khối, đổi khối, cất khối), không gom lô, để đối thủ và người xem thấy ngay.
- Rules cho `moves/$round/$uid/$seq`:
  - chỉ chính chủ và là người chơi của phòng mới ghi được;
  - append-only (`!data.exists()`);
  - `at === now`;
  - `now >= startAt - 1.5s` và `now <= deadlines[uid] + DUEL_MOVE_GRACE_MS`;
  - kích thước action giới hạn.
- `POST /api/duels/{code}/settle` không cần body và gọi được nhiều lần (idempotent):
  1. đọc phòng và ván;
  2. đọc nước đi của hai người từ RTDB (Admin SDK);
  3. replay hai chuỗi;
  4. `decideRound`;
  5. ghi `deadlines` và `results`, kết thúc ván nếu đủ điều kiện;
  6. mirror.
- Khi ván kết thúc: ghi thống kê/XP/nhiệm vụ cho **cả hai** người trong cùng transaction, qua phần dùng chung tách ra từ `recordSubmittedRankedGame`. Session `duel` chuyển `done`.
- Nộp ván mode `duel` qua `/api/games/submit` chỉ chuyển sang settle, bỏ qua `actions` trong body.
- Bỏ `live/{uid}` (điểm tự khai); điểm trực tiếp lấy từ replay nước đi.

## Architecture
```
client (đang chơi) --set--> RTDB duels/{code}/moves/{round}/{uid}/{seq} = {a: action, at: TIMESTAMP}
client (chết / hết giờ / vượt điểm) --POST--> /api/duels/{code}/settle
server settle: Firestore tx(read phòng+ván+users) + RTDB get(moves) → replay → decideRound → write → mirror state
người xem/đối thủ --onChildAdded--> moves → reducer cục bộ → bàn + điểm
```
- `server/duels/load-duel-moves.ts`: đọc và sắp nước đi, lọc theo `at ≤ deadline + grace`, dừng ở chỗ hở.
- `server/duels/settle-duel-round.ts`: settle + ghi tiến trình người chơi.
- `modules/duel/duel-move-stream.ts`: client ghi action (gắn vào store, chỉ khi `variantRun.kind === "duel"`).

## Related Code Files
- Tạo:
  - `server/duels/load-duel-moves.ts`, `server/duels/settle-duel-round.ts`;
  - `app/api/duels/[id]/settle/route.ts`;
  - `modules/duel/duel-move-stream.ts`.
- Sửa:
  - `database.rules.json`;
  - `server/games/record-submitted-ranked-game.ts` (tách phần ghi tiến trình dùng chung, mode duel chuyển sang settle);
  - `modules/block-puzzle/store/block-puzzle-game-store.ts` (hook ghi action khi đấu);
  - `modules/block-puzzle/store/ranked-game-cloud-sync.ts` (duel: gọi settle thay vì nộp log);
  - `lib/routes.tsx`.
- Xoá: `reportDuelLiveScore`, nhánh rules `live`.

## Implementation Steps
1. Rules RTDB `moves` + test bằng emulator hoặc e2e (ghi trước giờ, sau hạn, ghi đè, ghi hộ người khác: đều phải bị từ chối).
2. Ghi action từ store: theo sát reducer, chỉ ghi action reducer chấp nhận (state đổi), `seq` tăng dần. Lưu `seq` trong save ván để tải lại trang không trùng số.
3. `load-duel-moves` + `settle-duel-round` (transaction Firestore; replay chạy trước transaction, trong tx chỉ kiểm lại `round`/`status` không đổi).
4. Tách ghi tiến trình (stats/XP/nhiệm vụ/thành tích) khỏi `recordSubmittedRankedGame` thành hàm dùng chung, gọi cho cả hai người lúc kết thúc ván.
5. Client gọi settle khi:
   - mình chết hoặc hết giờ;
   - điểm mình vượt điểm cuối của đối thủ đã chết;
   - đang chờ quá hạn (mỗi 5 giây, như hiện tại).

## Todo
- [ ] Rules `moves` + kiểm thử từ chối
- [ ] Ghi action từ store (seq bền qua tải lại)
- [ ] load-duel-moves + settle API
- [ ] Ghi tiến trình hai người khi kết thúc ván
- [ ] Bỏ live score tự khai, submit duel chuyển sang settle

## Success Criteria
- Điểm server trùng điểm client khi chơi bình thường.
- Nước đi sau hạn không được tính.
- Gọi settle hai lần không cộng thống kê hai lần.

## Risks
- Chi phí RTDB: khoảng 150–300 action mỗi người mỗi ván, mỗi action dưới 100 byte. Không đáng kể.
- Mạng chập chờn làm mất nước đi cuối: chấp nhận được, có ân hạn 3 giây.
- Settle chạy đồng thời: transaction + kiểm `round`/`status`, không ghi lùi.

## Security
- Rules chặn ghi hộ, ghi đè, ghi ngoài khung giờ.
- Server replay từ seed nên action sai luật bị bỏ (replay dừng tại action lỗi, lấy điểm tới đó).
- Seed ván chỉ đưa vào `state` khi `now ≥ startAt`.

## Next
Phase 04 (UI theo dõi) và phase 06 (người xem) dùng chung luồng nghe `moves`.
