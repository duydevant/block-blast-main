# Block Puzzle (Next.js)

Game xếp khối 8x8 chạy trên trình duyệt: kéo khối vào bàn, lấp đầy hàng/cột để xoá, nối combo lấy điểm cao. Chơi tại `/play`.

Tên game lấy từ env `NEXT_PUBLIC_SITE_NAME` — đổi env là đổi toàn bộ tên trong app.

## Bắt đầu

```bash
npm install
cp .env.example .env.local
npm run dev
```

Mở `http://localhost:3000` (trang chủ) hoặc `http://localhost:3000/play` (vào chơi luôn).

## Deploy bằng Docker

```bash
cp .env.example .env   # điền giá trị; PORT / HOST_PORT / HOST_IP chỉnh cổng
docker compose up -d --build
```

Chi tiết (biến build-time vs runtime, cron nhắc nhở, reverse proxy): `docs/deployment-guide.md`.

## Scripts

```bash
npm run dev     # dev server (Turbopack)
npm run build   # production build
npm run lint    # eslint
npm test        # vitest run
npm run test:watch
npx tsc --noEmit
```

## Cấu trúc

```
app/           # Next.js App Router: trang chủ, /play, profile, API route (app/api/)
components/    # shadcn/ui + layout (header, footer, language, account menu)
lib/           # i18n, routes, Firebase client, auth store, SEO
modules/       # block-puzzle (engine thuần TS, canvas, input, audio, store, UI game), player-profile, leaderboard, challenge, share, progression (XP/xu/nhiệm vụ/thành tích/mời bạn)
server/        # code chỉ chạy server: Firebase Admin, replay kiểm tra điểm, profile
providers/     # React Query, Firebase Auth + app providers
docs/          # code standards, system architecture, firebase setup
```

Kiến trúc game: xem `docs/system-architecture.md`. Chỉnh điểm/độ khó ở `modules/block-puzzle/engine/score-and-combo-rules.ts` và `tray-generator-config.ts`.

Giao diện vẽ bằng code, âm thanh Web Audio. Bộ chia 3 khối được viết lại bằng TypeScript theo hành vi Classic của bản Poki tham chiếu: chu kỳ smart/bag/bag, túi khối theo điểm và bộ chọn theo trạng thái bàn. Xem `docs/classic-tray-generation.md` về nguồn đối chiếu và giới hạn kiểm chứng. App không nhúng WASM hay tài nguyên hình/âm thanh của bản tham chiếu. Dùng `npm run balance` để bot tự chơi; trên Windows host hiện tại, dùng `npx next build --webpack` nếu Turbopack báo lỗi CSS worker.

## Firebase (tài khoản + điểm cloud)

Cấu hình theo `docs/firebase-setup-guide.md`, điền `.env.local` (mẫu ở `.env.example`). Thiếu config Firebase thì game vẫn chạy offline, chỉ không có tài khoản/thống kê cloud.

- Vào game tự có tài khoản khách (Anonymous); trang `/profile` cho liên kết Google để giữ tiến trình trên máy khác.
- Ván online: server cấp seed (`POST /api/games/start`), client ghi lại nước đi, hết ván nộp log (`POST /api/games/submit`) → server chơi lại bằng engine để tính điểm thật rồi cập nhật thống kê.
- Mỗi ván đã kiểm tra cho XP, xu, tiến độ nhiệm vụ ngày và thành tích; xu mua theme trong hộp chọn màu. Profile có mã mời bạn (`/?ref=CODE`).
- PWA cài được ra màn hình chính, chơi offline; nhắc nhở hằng ngày bằng Web Push (cần env VAPID + cron, xem `docs/firebase-setup-guide.md`); trang chủ hiện số người đang chơi (Realtime DB).
- Chế độ chơi: sự kiện tuần (luật đổi mỗi tuần, BXH riêng), 20 màn chơi có sao (`/levels`), đấu 1v1 realtime qua link (`/duel`).
- Deploy security rules: `firebase deploy --only firestore,database` (cần `firebase login`).
