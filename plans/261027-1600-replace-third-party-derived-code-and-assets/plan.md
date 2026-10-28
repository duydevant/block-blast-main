---
status: completed
created: 2026-10-27
---

# Thay toàn bộ phần lấy từ bản build bên thứ ba

Mục tiêu: game không còn code, dữ liệu, asset hay số liệu port từ bản build Poki/OPlay. Giữ nguyên tính năng (kéo thả, stash, đổi khay, hồi sinh, tutorial, theme), thay phần bên trong bằng thiết kế riêng.

## Phase

| # | Việc | Trạng thái |
|---|---|---|
| 1 | Xoá: `public/game-assets/`, `engine/poki-*`, `smart-shape-finder.ts`, `board-starter*`, `docs/poki-*.md`, `data-poki-game`, font PT Sans | Done (còn `dev-poki-*.log` đang bị process khác giữ file) |
| 2 | Engine: catalog khối riêng (`piece-shape-catalog.ts`), bộ chia khối mới + config + kiểm tra giải được, điểm/combo riêng, revive/stash/đổi khay theo luật riêng, `SAVE_VERSION` 3 | Done |
| 3 | Bot tự chơi đo cân bằng (`engine/balance-simulator.ts`) + script `npm run balance` | Done |
| 4 | Tutorial 3 màn tự thiết kế | Done |
| 5 | UI: palette + theme riêng, khối vẽ bằng code, layout co giãn riêng, HUD/menu/dialog bằng lucide + Tailwind, âm thanh Web Audio tổng hợp | Done |
| 6 | Test viết lại, tsc/eslint/build, review, docs | Done |

## Luật mới (tóm tắt)

- Khối: 15 họ polyomino chung của thể loại, đủ hướng xoay, mỗi họ có `family`, `weight`, `tier`.
- Chia khối (`engine/tray-generator-config.ts` gom mọi số):
  - bốc theo trọng số; tier khó tăng dần theo điểm;
  - phạt họ khối vừa ra ở 2 khay gần nhất;
  - khay phải giải được: tồn tại thứ tự đặt cả 3 khối (có mô phỏng xoá dòng);
  - bàn đầy ≥ ngưỡng → ưu tiên khay có ít nhất 1 khối xoá được dòng ngay (khối cứu);
  - hết lượt thử → khay dự phòng tham lam từng khối một.
- Điểm: 1/ô đặt; xoá n dòng = 10·n(n+1)/2; nhân combo 1 + 0.5·(combo−1); combo giữ 3 nước; dọn sạch bàn +300.
- Bàn khởi đầu trống. Stash mở ở 300 điểm. Đổi khay 2 lượt/ván. Hồi sinh 1 lần: xoá 2 hàng + 2 cột đầy nhất, chia khay mới.

## Ngoài phạm vi

Font: chuyển sang Inter (OFL), bỏ PT Sans. Không commit thư mục `block-blast-poki/`.

## Kết quả

- 135/135 test, tsc + eslint sạch, `next build` OK (`/play` static).
- Review đã xử lý: HUD tràn trên điện thoại, chia khối chậm trên bàn rời rạc (bitmask + memo + ngân sách chung: max ~95ms → ~15ms desktop), cache ảnh khối, stash sau khi restore, âm thanh, a11y tutorial, `STASH_SLOT` về `game-types.ts`, cap `replaceCharges`, khai báo `vite-node`.

## Còn mở (cần user quyết)

- `dev-poki-*.log` vẫn được git track (file đang bị process khác khoá).
- `../block-blast-poki/` (bản build gốc) đã nằm trong commit đầu của repo; git history còn asset đã xoá. Cần chọn: untrack + ignore, hay viết lại history / tạo repo mới nếu repo sẽ public.
