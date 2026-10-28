Đang làm: unit + e2e server + review xong, còn thử trình duyệt |Code xong, chờ thử trình duyệt |Done (e2e server) |Code xong, chờ thử trình duyệt |Code xong, chờ thử trình duyệt (cần publish rules RTDB) |Done |# Refactor đấu 1v1: khoá trong trận, không phải chờ lâu, xem đối thủ, đấu lại cùng phòng, người xem

Status: Draft, chờ duyệt · Ngày: 2026-10-28 · Nguồn: phản hồi người dùng (2 lần) + tái hiện bằng 2 tab.

## Vấn đề hiện tại
Luồng thật, đã tái hiện:
1. Vào trận xong, tài khoản mới **bị kẹt ở hướng dẫn** trong khi đồng hồ vẫn chạy. Điểm của họ không được gửi đi nên đối thủ thấy 0.
2. Điểm đối thủ chỉ là pill chữ nhỏ; kỷ lục cá nhân lại hiện to.
3. **Chết thì hiện hộp hết ván của chế độ thường:** có nút hồi sinh (dùng được cả trong trận), nút "Chơi ván mới" (thoát trận). Người chơi không bị giữ lại chờ kết quả.
4. Server chỉ có kết quả khi cả hai đã nộp hoặc hết 3 phút + 60 giây, nên không chốt sớm được.
5. Đấu lại phải tạo phòng mới. Người ngoài mở link chỉ thấy 2 con số.

## Hướng làm
- **Phase 01** (P0, chỉ sửa client và engine) sửa ngay các lỗi 1–3: bỏ hướng dẫn, HUD đấu rõ ràng, cấm hồi sinh, chết thì vào bảng "Trận đấu" (chờ kết quả hoặc về phòng), xác nhận khi bỏ trận.
- **Phase 02–07** đổi nền tảng để chốt sớm và xem trực tiếp. Mỗi nước đi được đẩy lên RTDB kèm giờ server (rules ép `at == now`). Server replay ra điểm thật bất cứ lúc nào. Đối thủ và người xem replay cùng chuỗi nước để vẽ bàn thật.

## Quyết định đề xuất (cần chốt)
1. **Chết sớm** (đã chốt với người dùng): người còn sống vượt điểm người đã dừng → kết thúc ngay; đang kém thì chơi tiếp tới hết nước / hết 3 phút (**bỏ** luật 30 giây). Trong lúc chờ xem bàn đối thủ.
2. **Theo dõi đối thủ:** HUD có điểm hai bên và chênh lệch (phase 01), thêm bàn mini (phase 04).
3. **Đấu lại:** trong phòng, cùng mã. Hai người bấm "Sẵn sàng" thì sang ván mới với seed mới; phòng giữ tỉ số.
4. **Người xem:** ai có link hoặc mã đều vào xem khi phòng đủ 2 người. Thấy hai bàn trực tiếp và số người xem.

## Phases
| # | Phase | Status |
| --- | --- | --- |
| 01 | [Khoá người chơi trong trận (sửa lỗi người dùng báo)](phase-01-lock-player-into-duel-run.md) | Done (2026-10-28) |
| 02 | [Luật trận + mô hình phòng nhiều ván](phase-02-duel-rules-and-round-model.md) | Done |
| 03 | [Nước đi lên RTDB có giờ server + server chấm từ nước đi](phase-03-server-timed-move-stream-and-settle.md) | Code xong, e2e server xong; chờ thử trình duyệt (cần publish rules RTDB) |
| 04 | [Màn chơi: xem bàn đối thủ, chốt sớm khi vượt điểm](phase-04-live-opponent-view-and-early-finish.md) | Code xong; chờ thử trình duyệt |
| 05 | [Đấu lại trong phòng: sẵn sàng → ván mới, tỉ số](phase-05-in-room-rematch-series.md) | Code xong, e2e server xong; chờ thử trình duyệt |
| 06 | [Người xem](phase-06-spectator-mode.md) | Code xong; chờ thử trình duyệt |
| 07 | [Test, e2e, review, docs](phase-07-tests-e2e-docs.md) | Unit + e2e server + review + docs xong; còn thử trình duyệt |

Thứ tự: 01 (deploy riêng được) → 02 → 03 → 04 → (05 ∥ 06) → 07.

## Phụ thuộc
- Rules RTDB mới (phase 03, 06): người dùng phải publish lại trên console.
- Engine tất định (`replay-recorded-game-actions.ts`) và `BlockBoardPreview` dùng lại được.
- Phòng tạo trước khi deploy phase 02–03 chỉ hiện kết quả.

## Kết quả (2026-10-28)
- Code phase 02–06 xong; 273 test, tsc, eslint, build sạch.
- E2E server Firebase thật (`e2e-duel-rounds.ts`): chưa chốt khi người sống đang kém; vượt điểm → `clinched` ngay; settle lặp không đổi; người xem không join/ready được; sẵn sàng → ván 2 seed mới, nước ván 1 bị xoá, seed ẩn lúc đếm ngược; hết giờ → `time`; xin ván lại khi chưa đi nước → cùng ván.
- Review (`plans/reports/reviewer-261028-duel-realtime-refactor.md`) đã sửa: vòng render vô hạn ở phòng; nước `END` khi bỏ trận/hết giờ (server biết người đã dừng); settle thử lại; start ván idempotent; seed ẩn lúc đếm ngược; /settle chỉ cho người chơi.
- Còn: thử 2 người + 1 người xem trên trình duyệt sau khi publish `database.rules.json`.

## Câu hỏi chưa chốt
- Cùng seed + thấy bàn nhau trực tiếp → người đang kém có thể chép y nước của người dẫn để ít nhất hoà. Chấp nhận (đấu bạn bè) hay ẩn bàn đối thủ khi đang chơi?
- Emoji/chat cho người xem, Bo3/Bo5: để sau.
