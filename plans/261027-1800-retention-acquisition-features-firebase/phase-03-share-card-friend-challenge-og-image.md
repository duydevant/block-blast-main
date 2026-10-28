# Phase 03 — Thẻ share, thách đấu bạn bè, ảnh OG

## Context Links
- `phase-01-...` (session đã kiểm tra), `phase-02-...` (daily)
- Next 16 docs: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/opengraph-image.md`

## Overview
- Priority: P1 — vòng lan truyền rẻ nhất
- Status: **Done** (2026-10-27). Khác plan: tạo thách đấu nhận luôn log ván chưa nộp (server nộp rồi tạo) thay vì bắt ván phải nộp trước; ván thách đấu không vào BXH, chơi lại nhiều lần giữ điểm cao nhất; chưa giới hạn số thách đấu/ngày (mỗi ván đã chơi chỉ tạo được 1); ảnh OG dùng font mặc định next/og vì Inter variable không đọc được; metadata/OG trang `/c/[id]` viết tiếng Việt.
- Hết ván → share ảnh kết quả; tạo link thách đấu để bạn chơi đúng ván đó và so điểm.

## Key Insights
- Thách đấu chỉ tạo từ ván đã server kiểm tra → điểm người thách là thật.
- Người nhận không cần tài khoản Google: vào là khách, chơi ngay.
- Link có ảnh OG riêng ("X thách bạn vượt N điểm") tăng tỉ lệ bấm khi dán vào Zalo/Messenger/FB.
- Daily share dạng tóm tắt, không lộ bàn → không spoil.

## Requirements
Functional
- Game over: nút "Chia sẻ" (Web Share API kèm ảnh PNG; fallback tải ảnh + copy link) và "Thách bạn bè".
- `POST /api/challenges { gameId }` → `challenges/{id}` (seed, stashUnlocked lúc đầu ván, creator name, score). Id ngắn, khó đoán.
- Trang `/c/[id]`: điểm + tên người thách, nút "Nhận thách đấu" → `/play?challenge=id`.
- Chơi challenge: start `mode: "challenge"` với seed của thách đấu; submit ghi `challenges/{id}/results/{uid}`; màn kết quả so sánh + nút "Thách lại".
- `opengraph-image` cho `/c/[id]` và trang chủ.
Non-functional
- Ảnh share tạo phía client trong < 300ms. Trang `/c/[id]` render server.

## Architecture
```
game over (ranked) ─ Thách bạn ─► POST /api/challenges → challenges/{id}
link /c/{id} ─► server page (Admin SDK đọc) + opengraph-image
   └► /play?challenge=id ─► start(mode challenge) ─► chơi ─► submit
                                         → challenges/{id}/results/{uid} → màn so sánh
```

## Related Code Files
Tạo
- `modules/share/` — `render-result-share-card.ts` (canvas → PNG), `share-or-copy-link.ts`, `share-result-button.tsx`
- `modules/challenge/` — `challenge-types.ts`, `challenge-result-comparison.tsx`
- `server/challenges/create-challenge-from-session.ts`, `record-challenge-result.ts` + test
- `app/api/challenges/route.ts`
- `app/(main)/c/[id]/page.tsx`, `app/(main)/c/[id]/opengraph-image.tsx`, `app/opengraph-image.tsx`
Sửa
- `game-dialogs.tsx`, `app/(game)/play/page.tsx` (đọc `challenge` param), game store (mode challenge), `server/games/*`, `firestore.rules`, translations, `lib/routes.tsx`

## Implementation Steps
1. Render thẻ share bằng canvas (dùng lại palette/painter), test kích thước/nội dung.
2. Share/copy fallback.
3. API tạo thách đấu + trang `/c/[id]` + OG image (đọc docs Next 16 trước).
4. Chế độ challenge trong start/submit + màn so sánh.
5. Build/lint/test, review, docs.

## Todo List
- [ ] Thẻ share + share/copy
- [ ] API + trang thách đấu + OG
- [ ] Mode challenge + màn so sánh
- [ ] i18n, docs

## Success Criteria
- Share trên Android Chrome/iOS Safari mở được bảng share kèm ảnh; desktop copy link.
- Dán link `/c/{id}` vào Zalo/Messenger hiện ảnh preview đúng.
- Người nhận chơi đúng chuỗi khối của người thách (cùng nước đi → cùng điểm).

## Risk Assessment
- Web Share kèm file không hỗ trợ đủ → fallback tải ảnh.
- Spam tạo thách đấu → giới hạn N thách đấu/uid/ngày.

## Security Considerations
- Chỉ tạo thách đấu từ session của chính uid, đã `done`. Trang công khai chỉ lộ tên hiển thị + điểm.

## Next Steps
- Phase 04 thêm thưởng mời bạn dựa trên luồng người nhận thách đấu.
