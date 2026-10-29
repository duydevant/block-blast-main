# Phase 03: UI thử thách ngày

## Overview

- **Priority:** cao.
- **Status:** Done.

## Màn hình

- **`/daily`**
  - Thẻ ngày + giờ đổi bộ khối + "Còn x/3 lượt".
  - Mục tiêu hôm nay: ★ / ★★ / ★★★ / 🏆 với thanh tiến độ theo điểm cao nhất hôm nay, kèm dòng "Hôm qua … · Phong độ …".
  - Tuần này:
    - tổng điểm, hạng;
    - thanh sao x/21 với 2 rương (nút nhận);
    - bảng bậc thưởng hạng;
    - giờ kết thúc tuần.
  - Tuần trước: nhận thưởng hạng + rương chưa nhận.
  - Thưởng chuỗi (giữ), top hôm nay, nút chơi ("Chơi lượt x/3" hoặc "Luyện tập").
- **HUD trong ván daily:** "Thử thách 29/10 · Lượt 2/3", thêm dòng "Mục tiêu ★★ 4.400" (mốc kế tiếp theo điểm hiện tại).
- **Hết ván daily:** sao đạt được ở lượt này + xu mốc (từ rewards), nút "Chơi lượt tiếp (còn x)" / "Nhận thưởng".
- **Trang chủ:**
  - thẻ daily hiện sao hôm nay + số lượt còn;
  - lưới chế độ bỏ ô Sự kiện.
- **Bảng xếp hạng:** tab "Thử thách tuần" thay cho "Sự kiện".

## Success criteria

- Kiểm tra trên trình duyệt (bản build production): chơi 1 lượt → mốc / sao / xu hiện đúng, trang `/daily` và tab xếp hạng đúng.
