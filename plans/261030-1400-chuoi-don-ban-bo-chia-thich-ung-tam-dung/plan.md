# Chuỗi dọn bàn, bộ chia khối theo điểm, tạm dừng

Ngày: 2026-10-30. Branch: `feat/skill-depth-from-minesweeper-research`.

## Quyết định (người dùng chốt)
- Thưởng dọn sạch bàn: chuỗi nhân. Lần đầu +500; lần kế tiếp trong ≤ 9 nước (3 khay) → ×2, ×3… tối đa ×5 (+2.500). Quá 9 nước không dọn → chuỗi về 0.
- Bảng "Mọi lúc" giữ chung (không reset). Xếp hạng chỉ ghép bóng ma cùng phiên bản luật.
- Bộ chia mới chỉ cho chế độ vô tận: Cổ điển, Thử thách ngày, Thách đấu, Xếp hạng, 1v1. Giữ nguyên Màn chơi, Đấu trường, Bài học, Không bế tắc.

## Thiết kế
- `rulesVersion` (1 = luật cũ, 2 = luật mới) nằm trong `GameVariant` + `GameState`. Thiếu = 1 → save cũ, session cũ, bóng ma cũ, replay cũ chấm đúng luật cũ.
- Client khai luật nó chơi được khi xin seed; server chỉ cấp v2 khi client khai (JS cũ → v1; thách đấu / phòng 1v1 / xếp hạng luật v2 → 409 `client-outdated`). Session mới của chế độ vô tận = 2; thách đấu theo ván gốc; 1v1 theo phòng; xếp hạng = 2 và chỉ chọn bóng ma v2.
- Bộ chia v2 (tự thiết kế, không dựa bộ chia cổ điển): độ khó `d = điểm / (điểm + 2500)` (chỉ phép chia → replay giống hệt mọi trình duyệt).
  - Mỗi ô khay: xác suất "khối gỡ bàn" giảm 55% → 20% theo `d` (khối + vị trí xoá nhiều dòng nhất, ưu tiên dọn sạch bàn).
  - Còn lại bốc theo bậc khối: nhỏ/vừa/to 45/40/15% → 20/35/45%.
  - Khay không khối nào đặt được → thay ô đầu bằng khối gỡ bàn.
- Tạm dừng: chế độ không tính giờ (Cổ điển, Ngày, Thách đấu, Màn, Không bế tắc, Đấu trường không giờ). Che bàn, chặn thao tác, tự dừng khi ẩn tab. Không tạm dừng ở 1v1 / Xếp hạng / Đấu trường Tốc độ: đồng hồ do server giữ, đối thủ/bóng ma vẫn chạy → dừng chỉ cho thêm thời gian nghĩ hoặc làm đối thủ chờ.

## Phase
| # | Nội dung | Trạng thái |
|---|---|---|
| 1 | Engine: rulesVersion, chuỗi dọn bàn, bộ chia thích ứng, schema save | Xong |
| 2 | Server + client: phiên bản luật theo session / thách đấu / phòng 1v1 / bóng ma / replay | Xong |
| 3 | UI: chữ "Dọn sạch ×n", nút + màn tạm dừng | Xong |
| 4 | Test, báo cáo cân bằng trước/sau, docs | Xong (chờ QA tay) |

## Rủi ro
- Tab chạy JS cũ nhận session v2 → replay lệch → ván bị từ chối (chỉ trong lúc chuyển bản).
- Bóng ma v1 hết dần sau 30 ngày (TTL); trong lúc đó ghép bot nhiều hơn.
- Bảng "Mọi lúc" trộn điểm v1/v2.
