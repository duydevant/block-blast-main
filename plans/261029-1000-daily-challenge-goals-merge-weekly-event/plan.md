# Thử thách ngày có mốc cá nhân, gộp sự kiện tuần

Gộp "Sự kiện tuần" vào "Thử thách ngày". Mỗi ngày người chơi có mốc riêng theo phong độ của chính họ (phải hơn hôm qua), đạt mốc thì nhận thưởng. Phần tuần gồm tổng điểm 7 ngày, rương sao và thưởng hạng.

## Quyết định đã chốt (user, 2026-10-29)

- Mỗi ngày **3 lượt tính điểm**, lấy lượt cao nhất cho mốc, bảng ngày và tổng tuần.
  - Chỉ **lượt đầu** vào bảng Hôm nay / Tuần này / Mọi lúc, để tránh học thuộc bộ khối rồi đua top chung.
  - Từ lượt thứ 4 là luyện tập: không vào bảng nào.
- **Bảng tuần thử thách** = tổng điểm cao nhất của từng ngày trong tuần. Cuối tuần trao thưởng hạng (bậc như sự kiện cũ).
- **Bỏ hẳn chế độ Sự kiện tuần**: luật, bảng `event-*`, mốc 1000/3000/6000, trang `/event`, API `/api/events`.
  - Vô tận quay về chỉ tính Hôm nay / Tuần này / Mọi lúc.

## Luật mốc

- **Phong độ P** = trung vị điểm cao nhất của các ngày đã chơi, lấy tối đa 7 ngày gần nhất, không tính hôm nay. Chưa có lịch sử → P = 1500.
- **Mốc:** ★ = 70% P, ★★ = 110% P, ★★★ = 150% P, làm tròn 50.
- **🏆 Kỷ lục** = vượt `dailyBest` (điểm thử thách cao nhất mọi thời điểm). Chỉ tính khi đã có `dailyBest`.
- Mốc được **chốt lúc bắt đầu lượt đầu của ngày**, lưu trong doc ngày, nên không đổi trong ngày.
- **Thưởng tự cộng khi nộp ván:** ★ 20 / ★★ 40 / ★★★ 80 / 🏆 100 xu. Mỗi mốc 1 lần/ngày.
- **Sao tuần** (tối đa 21) mở rương: 10 sao = 150 xu, 18 sao = 400 xu. Rương nhận ở trang `/daily`.
- **Thưởng hạng tuần:** nhận tuần sau (top 1: 1000, top 3: 500, top 10: 300, top 100: 100, còn lại có chơi: 30).

## Phases

| # | Phase | Status |
|---|---|---|
| 01 | [Server: lượt, mốc, sao, tổng tuần, thưởng](phase-01-server-daily-goals-and-week.md) | Done |
| 02 | [Bỏ sự kiện tuần (client + server)](phase-02-remove-weekly-event.md) | Done |
| 03 | [UI: trang /daily, HUD, hết ván, trang chủ, bảng xếp hạng](phase-03-daily-ui.md) | Done |
| 04 | Test, review, docs | Done |

## Phụ thuộc / rủi ro

- Phase 02 và 03 dựa vào kiểu dữ liệu ở phase 01.
- Thưởng hạng sự kiện tuần trước chưa nhận sẽ mất (bảng `event-*` bỏ). Ít người chơi → chấp nhận, ghi chú cho user.
- Ván sự kiện đang dở / chưa nộp lúc deploy: replay thiếu luật → bị từ chối (chỉ mất thống kê ván đó).

## Kết quả (2026-10-29)

- Unit test 284 pass; e2e API (bản build production, tài khoản khách, dọn dữ liệu sau khi chạy) 23/23 pass.
- Review: sửa 5 điểm (lượt cũ dạng `gameId` bị coi là chưa nộp, điểm ngày cũ chưa vào tổng tuần, map phong độ 1 ngày cho người chơi cũ, lượt đầu xác định theo danh sách thay vì số thứ tự, nút thưởng hạng ẩn trong 1 giờ ân hạn).
- Còn chấp nhận: điểm các ngày trước khi deploy trong tuần đầu không vào tổng tuần; lượt Chủ nhật nộp sau 01:00 thứ Hai vẫn được sao/xu nhưng không cộng tổng tuần.
