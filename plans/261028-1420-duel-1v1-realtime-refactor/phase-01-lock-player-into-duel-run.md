# Phase 01: Khoá người chơi trong trận đấu (sửa lỗi người dùng báo)

## Context
- Người dùng chơi thử 2026-10-28; tái hiện bằng 2 tab (`localhost` + `127.0.0.1` = 2 tài khoản).
- Liên quan:
  - `modules/block-puzzle/components/block-puzzle-game-screen.tsx`;
  - `game-over-dialog.tsx`, `game-hud-score-bar.tsx`, `use-special-mode-launcher.tsx`;
  - `modules/duel/components/duel-hud.tsx`;
  - `modules/game-modes/components/game-over-variant-section.tsx`;
  - `modules/block-puzzle/engine/*` (revive).

## Overview
Priority **P0** · Status **Done** (2026-10-28). Không đổi server. Đưa màn chơi đấu về đúng luồng: vào là chơi ngay, luôn thấy điểm đối thủ, chết thì bị giữ trong trận (chờ kết quả hoặc về phòng) chứ không bị mời chơi ván thường.

## Lỗi hiện tại (đã tái hiện)
1. **Người mới vào phòng bị kẹt ở hướng dẫn** (3 bước kéo khối) trong khi đồng hồ 3 phút vẫn chạy. Lúc đó HUD đấu không được render nên điểm của họ không được gửi đi, và đối thủ thấy họ đứng yên ở 0 điểm.
2. **Điểm đối thủ khó thấy:** chỉ là một pill chữ 12px dưới điểm của mình ("⚔ Khách #LCG2 0"). Trong khi đó vương miện kỷ lục cá nhân (8.229) lại to, dù không liên quan tới trận.
3. **Chết thì hiện hộp hết ván của chế độ thường:**
   - nút "Hồi sinh" dùng được trong trận đấu (lợi thế không công bằng, server replay cũng chấp nhận);
   - nút "Chơi ván mới" thoát trận sang ván Vô tận;
   - nút chia sẻ và vương miện kỷ lục;
   - kết quả trận chỉ là một link nhỏ "Xem kết quả".
4. Trong trận vẫn bấm được: chơi lại (menu), thử thách ngày, sự kiện, màn chơi. Bấm vào là bỏ trận mà không hỏi.

## Requirements
- **Hướng dẫn:** trận đấu (`?duel=` hoặc `variantRun.kind === "duel"`) bỏ qua hướng dẫn và đánh dấu đã xem, vì vào đấu coi như đã biết chơi.
- **HUD đấu** thay hàng điểm thường khi đang đấu:
  - `[Bạn 1.240]  ⏱ 2:31  [Đối thủ 980]`, điểm hai bên cỡ chữ như nhau;
  - chênh lệch nhỏ bên dưới (+260 xanh / -80 đỏ);
  - đối thủ chết thì hiện "Hết nước" cạnh tên;
  - không hiện kỷ lục cá nhân.
- **Không hồi sinh trong trận:** thêm `noRevive` vào `GameVariant`. Engine từ chối REVIVE khi có cờ này, và server replay duel dùng cùng variant nên log có REVIVE bị từ chối.
- **Chết hoặc hết giờ → bảng "Trận đấu"** thay hộp hết ván thường:
  - Khi chưa có kết quả:
    - điểm của mình;
    - điểm trực tiếp của đối thủ, "đang chơi" hoặc "hết nước";
    - đồng hồ còn lại;
    - trạng thái "Đang dẫn 85 điểm" / "Bị dẫn 40 điểm";
    - chỉ một nút phụ "Về phòng đấu". Không có "Chơi ván mới", hồi sinh hay chia sẻ.
  - Khi đã có kết quả (nghe trạng thái phòng):
    - "Bạn thắng!", "Bạn thua" hoặc "Hoà", kèm hai điểm;
    - nút "Đấu lại" và "Về phòng";
    - nút "Về trang chủ" để thoát hẳn.
- **Thoát giữa trận:**
  - nút Home và menu hỏi xác nhận "Bỏ trận? Điểm hiện tại sẽ được nộp" → `endVariantRun()` rồi về phòng;
  - menu ẩn "Chơi lại" và các lối vào chế độ khác khi trận còn chạy;
  - launcher (`?daily`, `?event`…) phải hỏi trước khi bỏ trận đấu.

## Architecture
```
duel-hud.tsx              → HUD đấu (thay GameHudScoreBar khi variantRun.kind === "duel")
duel-game-over-panel.tsx  (mới) bảng "Trận đấu" thay GameOverDialog khi đấu
use-duel-room.ts          dùng lại: state phòng + live score (chưa đổi server)
engine: GameVariant.noRevive; variantForSession(duel) = { noRevive: true }; variantForRun duel cùng giá trị
```

## Related Code Files
- Tạo: `modules/duel/components/duel-game-over-panel.tsx`
- Sửa:
  - `block-puzzle-game-screen.tsx` (bỏ qua hướng dẫn, chọn HUD và hộp hết ván theo chế độ);
  - `duel-hud.tsx`;
  - `game-over-dialog.tsx` (không mở khi đấu);
  - `game-hud-score-bar.tsx` / `game-settings-menu.tsx` (xác nhận bỏ trận, ẩn chơi lại);
  - `use-special-mode-launcher.tsx`;
  - engine `game-types.ts` + reducer revive;
  - `server/games/stored-game-session.ts` (`variantForSession` duel);
  - `modules/game-modes/variant-run.ts`;
  - `game-modes-translations.ts`.

## Implementation Steps
1. Bỏ qua hướng dẫn khi đấu; test chuyển giao hướng dẫn (`tutorial-handoff.test.ts`) thêm case duel.
2. `noRevive` trong engine + variant duel; test reducer và test replay server từ chối REVIVE.
3. HUD đấu mới.
4. `DuelGameOverPanel`: trạng thái chờ / có kết quả; gọi lấy kết quả từ API khi quá hạn (logic ở `duel-room-view` tách thành hook dùng chung).
5. Xác nhận bỏ trận + chặn lối vào chế độ khác.
6. Kiểm bằng 2 tab (2 origin): người mới vào chơi ngay, thấy điểm nhau, chết thì bị giữ ở bảng trận, có kết quả thì hiện thắng/thua.

## Todo
- [x] Bỏ hướng dẫn khi đấu
- [x] Cấm hồi sinh trong trận (client + server)
- [x] HUD đấu: điểm hai bên rõ ràng
- [x] Bảng "Trận đấu" thay hộp hết ván
- [x] Xác nhận khi bỏ trận / chặn chế độ khác
- [x] Kiểm 2 tab

## Success Criteria
- Tài khoản mới vào bằng link: vào thẳng ván, không có hướng dẫn.
- Hai bên luôn thấy điểm nhau, cập nhật dưới 1 giây.
- Chết sớm: không có nút chơi ván mới hay hồi sinh; thấy đối thủ đang chơi, đồng hồ và kết quả khi trận chốt.

## Risks
- Ván đấu đang dở trong save cũ có REVIVE: chỉ ảnh hưởng ván đang chạy lúc deploy, bỏ qua được.

## Security
- Cấm hồi sinh phải ở engine và server, không chỉ ẩn nút.

## Next
- Phase này chưa rút ngắn thời gian chờ: chờ tối đa vẫn là hết 3 phút. Chốt sớm và giới hạn chờ 30 giây cần điểm đã kiểm tra giữa trận, nằm ở phase 02–04.
- Phase 04 nâng bảng chờ thành màn xem bàn đối thủ.

## Kết quả
- Code:
  - `GameVariant.noRevive` (đấu bắt đầu với `reviveUsed`); `variantForSession` duel → server từ chối log có REVIVE;
  - `DuelHud` thành bảng điểm ở đầu màn (Bạn | đồng hồ + chênh lệch | đối thủ, "Hết nước");
  - `DuelGameOverPanel` thay hộp hết ván;
  - `DuelLeaveButton` (xác nhận bỏ trận);
  - menu ẩn ván mới / thử thách ngày khi đấu; launcher luôn hỏi khi đang đấu;
  - hook `use-duel-match` dùng chung cho phòng và bảng trận.
- **Lỗi gốc phát hiện thêm:** khi tải lại save, `RESTORE` tính lại "hết ván" chỉ dựa trên bàn. Vì vậy ván đấu bị chốt do hết giờ hoặc bỏ trận mà bàn còn chỗ lại "sống lại" và chơi tiếp được, phòng đấu còn đẩy người chơi quay lại ván. Sửa: `GameState.endedEarly` (lưu trong save) được giữ qua RESTORE.
- Test: 268 pass (thêm `modules/game-modes/duel-variant.test.ts`); tsc, eslint sạch; build production qua.
- Kiểm 2 tab (localhost + 127.0.0.1, bản production), mọi bước đều đúng:
  - người mới vào thẳng ván, không có hướng dẫn;
  - hai bên thấy điểm nhau;
  - bỏ trận hỏi xác nhận, về phòng, không bị kéo lại vào ván;
  - bảng chờ cập nhật điểm đối thủ trực tiếp;
  - đủ điểm hai bên thì hiện "Bạn thua 9–18", nút đấu lại, về phòng.
- Ghi chú: dev server Next 16 chặn origin `127.0.0.1` (allowedDevOrigins) nên test 2 tài khoản cần bản production.
