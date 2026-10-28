# System Architecture

App Next.js chứa một game xếp khối 8x8 tự viết (module `block-puzzle`). Tên game lấy từ env `NEXT_PUBLIC_SITE_NAME` qua `siteConfig.name` — đổi env là đổi toàn bộ tiêu đề, header, SEO, chữ trong game.

## Các lớp

```
app/           — Next.js App Router: trang chủ, /play, profile, API route (`app/api/`).
components/    — shadcn/ui (`components/ui/`) và chrome dùng chung (`components/layout/`).
lib/           — i18n, routes, Firebase client + auth store, SEO.
modules/       — logic game (`modules/block-puzzle/`), profile người chơi (`modules/player-profile/`), thử thách ngày + bảng xếp hạng (`modules/leaderboard/`), thách đấu bạn bè (`modules/challenge/`), ảnh/chia sẻ kết quả (`modules/share/`).
server/        — chỉ chạy server (`import "server-only"`): Firebase Admin, replay kiểm tra ván, profile.
providers/     — React Query, Firebase Auth và các provider gốc.
```

## Firebase

| Dịch vụ | Dùng cho |
|---|---|
| Auth | Khách ẩn danh tự tạo khi vào app; liên kết Google giữ nguyên uid |
| Firestore | `challenges/{id}` (+ `results/{uid}`), `users/{uid}` (tên, `stashUnlocked`, `stats`, `streak`, `xp`, `coins`, `unlockedThemes`, `achievements`, mời bạn), `users/{uid}/daily/{YYYYMMDD}` (lượt tính điểm daily), `users/{uid}/missions/{YYYYMMDD}` (tiến độ nhiệm vụ ngày), `referralCodes/{code}` (→ uid người mời), `duels/{id}` (phòng 1v1: chủ/khách, seed, giờ server, điểm đã replay, người thắng), `pushSubscriptions/{sha256(endpoint)}` (đăng ký nhắc nhở: uid, keys, locale, ngày gửi gần nhất), `gameSessions/{gameId}` (seed, `mode`, `day`, trạng thái, TTL `expireAt`), `leaderboards/{boardId}` (snapshot top 100) + `leaderboards/{boardId}/entries/{uid}` (điểm tốt nhất) |
| Realtime Database | `/presence/{uid}` = timestamp khi đang ở màn chơi (chỉ chính chủ ghi, không ai đọc từ client); `/duels/{id}/state` (server ghi, ai đăng nhập + biết id đọc được) + `/duels/{id}/live/{uid}` (điểm trực tiếp, chỉ thành viên ghi phần của mình) |

- Client **không** đọc/ghi Firestore trực tiếp: `firestore.rules` và `database.rules.json` chặn hết. Mọi truy cập qua API route dùng Admin SDK (`server/firebase/firebase-admin-app.ts`).
- API (đều cần `Authorization: Bearer <Firebase ID token>`, uid lấy từ token):
  - `POST /api/games/start { mode: "classic" | "daily" }` → `{ gameId, seed, stashUnlocked, mode, day }`. Daily đã có lượt tính điểm hôm nay → `gameId: null` (luyện tập, không nộp).
  - `POST /api/games/submit { gameId, actions[] }` → transaction: session phải `open` + đúng uid → `replayRecordedGame` → ghi `stats`, bảng xếp hạng, (daily lượt đầu) kết quả ngày + `streak`, session `done`. Log sai → 422 + session `rejected`; nộp lại → 409.
  - `GET /api/daily` → `{ day, todayScore, runInProgress, streak, missions }`.
  - `POST /api/shop/themes { themeId }` → mua theme bằng xu (409 `not-enough-coins` / `theme-owned`), trả profile.
  - `POST/DELETE /api/push/subscriptions` → bật/tắt nhắc nhở; `GET /api/presence` (công khai) → `{ playing }`; `GET|POST /api/cron/daily-reminders` (Bearer `CRON_SECRET`).
  - `POST /api/games/start` còn nhận `mode: "event" | "level" (levelId) | "duel" (duelId)`; `POST /api/duels { rematchOf? }`, `POST /api/duels/{id}/join`, `GET /api/duels/{id}` (công khai).
  - `GET /api/referral` → `{ code, referralCount }` (tạo mã lần đầu); `POST /api/referral/claim { code }` → gắn người mời.
  - `POST /api/challenges { gameId, actions? }` → `{ challengeId }`; `GET /api/challenges/{id}` (công khai).
  - `GET /api/leaderboards/{daily|weekly|alltime}` → bảng hiện hành `{ boardId, top, me: { rank, score, nextScore } }`.
  - `GET/PATCH /api/profile` → profile (kèm `streak`); PATCH chỉ đổi `displayName` (2–16 ký tự), cập nhật tên trên các bảng hiện hành.
- Thiếu env Firebase → `status: "disabled"`, game chạy offline như cũ.

### Thử thách hằng ngày + bảng xếp hạng

- Ngày/tuần theo giờ VN (UTC+7, tuần ISO bắt đầu thứ Hai) — `server/daily/daily-challenge-calendar.ts`.
- Seed ngày = `HMAC(DAILY_SEED_SECRET, ngày)` → mọi người cùng chuỗi khối, không đoán trước ngày mai. Ô cất luôn khoá ở daily.
- Chỉ **lượt nộp đầu tiên** của ngày lên bảng thử thách ngày + tính streak (`users/{uid}/daily/{day}` đánh dấu, kiểm tra trong transaction). Lượt sau vẫn cộng thống kê.
- Streak: +1 nếu hôm qua có lượt daily, không thì về 1; hiển thị 0 khi đã đứt (quá hết ngày hôm sau).
- Bảng: hôm nay ⊂ tuần ⊂ mọi lúc (cùng tập ván: Vô tận + lượt daily tính điểm). classic → `today-YYYYMMDD` (ngày nộp) + `weekly-YYYY-Www` + `alltime` + `event-YYYY-Www` tuần này; daily (lượt tính điểm) → `daily-YYYYMMDD` (bảng riêng thử thách, trang /daily) + hôm nay + tuần + mọi lúc. Tab /leaderboard: hôm nay, tuần, sự kiện, mọi lúc. Mỗi bảng: entries (điểm tốt nhất/uid) + doc snapshot top 100 cập nhật trong cùng transaction → mở bảng = 2 lượt đọc (ngoài top 100 thêm `count()` + 1 truy vấn).
- Đồng điểm thì đồng hạng (hạng = số người điểm cao hơn + 1).
- Client: `start-daily-challenge.ts` xin seed → `store.startDailyGame` (`dailyDay` đánh dấu ván daily; sync không bao giờ thay ván daily bằng seed classic). Vào từ menu game hoặc link `/play?daily=1` (trang chủ).

### Chia sẻ + thách đấu bạn bè

- Hết ván: "Chia sẻ" vẽ ảnh 1080×1080 bằng canvas (`modules/share/render-result-share-card.ts`; daily không vẽ bàn) rồi mở Web Share API (kèm ảnh nếu được), không có thì copy "text + link".
- "Thách bạn bè" (chỉ ván classic tính điểm): `POST /api/challenges { gameId, actions }` → ván chưa nộp thì server nộp luôn (bỏ quyền hồi sinh), rồi tạo `challenges/{id}` với điểm đã replay; mỗi ván một thách đấu (`gameSessions.createdChallengeId`).
- Người nhận mở `/c/{id}` (server render, `noindex`, ảnh OG "<tên> thách bạn <điểm>") → `/play?challenge={id}` → `POST /api/games/start { mode: "challenge", challengeId }` cấp đúng seed + ô cất của người thách. Chơi lại nhiều lần được; nộp ván ghi điểm cao nhất vào `challenges/{id}/results/{uid}`, tăng `attempts`. Ván thách đấu **không** vào bảng xếp hạng (seed biết trước).
- `GET /api/challenges/{id}` công khai: tên/tag người thách, điểm, số lượt, top 20 kết quả — không có seed, không có uid.
- Store: field `challenge` (người thách + điểm cần vượt) như `dailyDay`; màn hết ván so điểm thắng/thua. Ảnh OG dùng font mặc định của `next/og` (Inter variable trong `public/fonts` satori không đọc được); URL ảnh lấy từ `NEXT_PUBLIC_SITE_URL` → phải đặt đúng domain khi deploy.
- Thiếu env Firebase → `status: "disabled"`, game chạy offline như cũ.

### Tiến trình: XP, xu, nhiệm vụ, thành tích, theme, mời bạn

- Luật thuần ở `modules/progression/` (dùng chung client/server); tính thưởng ở `server/progression/apply-progression-for-verified-game.ts`, gọi trong transaction nộp ván → response `rewards` (client hiện toast).
- XP mỗi ván = 10 + ⌊điểm/100⌋ (tối đa 100); cấp L cần tổng 50·L·(L−1) XP; lên cấp +50 xu. Ván < 10 nước không có 10 XP cơ bản, không tính nhiệm vụ "chơi N ván" và mời bạn (chặn farm bằng ván 1 nước).
- Nhiệm vụ ngày: 3 loại khác nhau chọn tất định theo ngày (giờ VN) → không lưu danh sách, chỉ lưu tiến độ; tính theo **ngày nộp**. Xong là tự cộng xu + XP. Không dùng doc `daily/{day}` vì doc đó bị xoá khi nhả lượt daily.
- Thành tích suy từ stats/streak/cấp/số bạn mời; chỉ lưu id đã nhận thưởng.
- Theme: 4 theme gốc miễn phí; `sunset` mở ở cấp 5, `forest`/`galaxy` mua bằng xu, `gold` chỉ qua mời bạn (`theme-unlock-rules.ts`). Màn chơi tự về theme mặc định nếu profile cho thấy theme đang chọn không thuộc về người chơi.
- Mời bạn: link `/?ref=CODE` → `ReferralLinkCapture` giữ mã tới khi có uid rồi claim (chỉ khi chưa được mời, < 3 ván, không tự mời, không mời chéo). Ván đủ nước thứ 3 (đếm `referralGames`) của người được mời → cả hai +200 xu + theme `gold`; người mời nhận xu tối đa 10 lần, thành tích "referral-1" cộng ngay trong cùng transaction. uid người mời không bao giờ trả về client.

### PWA, nhắc nhở, đang chơi, SEO

- PWA: `app/manifest.ts` (start_url `/play`, standalone), icon sinh bằng `next/og` (`app/icon.tsx`, `app/apple-icon.tsx`, `/pwa-icon/{any-192|any-512|maskable-512}`). `public/sw.js`: trang `/`, `/play` network-first (mất mạng dùng bản lưu), `/_next/static` + font cache-first, không bao giờ cache `/api`. Chỉ đăng ký SW ở production (`modules/pwa/pwa-environment.ts`). Nút "Cài game" (beforeinstallprompt) ở hộp hết ván sau ≥3 ván online và ở profile; iOS hiện hướng dẫn.
- Web Push chuẩn VAPID (`web-push`), không dùng FCM SDK: client `usePushReminders` → `POST/DELETE /api/push/subscriptions` (endpoint chỉ nhận host dịch vụ push thật — chặn SSRF). Cron `/api/cron/daily-reminders` (Bearer `CRON_SECRET`, so sánh timing-safe): hôm nay chưa có lượt daily → chuỗi còn sống thì "giữ chuỗi N ngày", không thì "thử thách hôm nay" cho người hoạt động ≤7 ngày; `lastSentDay` chặn gửi trùng; 404/410 → xoá đăng ký. Gợi ý bật ở thẻ daily khi chuỗi ≥2.
- Presence: `usePlayerPresence` (màn chơi) ghi `/presence/{uid}` + `onDisconnect().remove()`, tab ẩn thì xoá + `goOffline` (Spark 100 kết nối). `GET /api/presence` đếm bằng Admin SDK, cache 30s; trang chủ hiện khi ≥2.
- SEO: `/how-to-play` (render server, JSON-LD FAQPage); `/leaderboard` render sẵn top 20 các bảng (ISR 5 phút, mở tab đầu tiên có dữ liệu) rồi client thay bằng dữ liệu kèm hạng của mình; sitemap có `/how-to-play`.

### Sự kiện tuần, màn chơi, đấu 1v1

- Engine: `createNewGame(seed, variant)` với `GameVariant { startBoard, moveLimit, replaceCharges }`; `moveLimit` hết = hết ván (không hồi sinh vượt); `linesCleared` đếm trong state. Biến thể **luôn** suy từ catalog (`modules/game-modes/`) theo mode + id lưu trong session — client không gửi biến thể.
- Sự kiện tuần: luật xoay vòng theo tuần ISO (`weekly-event-catalog.ts`), session lưu `eventWeek`/`eventRuleId`, bảng `event-YYYY-Www` (tab "Sự kiện tuần", nhận cả ván Vô tận trong tuần), ô cất khoá.
- Màn chơi: 20 màn (`level-catalog.ts`) seed + bàn cố định, mục tiêu điểm/dòng + giới hạn nước; seed/giới hạn chọn bằng bot và test bot giải được từng màn. Đạt mục tiêu → client chốt ván (`endVariantRun`) → server replay tính sao (≤60% nước = 3 sao, ≤80% = 2), `users.levelStars`, 20 xu mỗi sao mới. Chơi offline được (sao lưu local, `level-progress-store`).
- Đấu 1v1: `POST /api/duels` tạo phòng → link `/duel/{id}` → người kia `POST /api/duels/{id}/join` → đếm ngược 5s, 3 phút (giờ server). Mỗi người xin đúng 1 session `mode: "duel"` (cùng seed). Client ghi điểm trực tiếp lên RTDB (chỉ hiển thị); kết quả = điểm server replay, nộp trước hạn + 60s ân hạn; đủ hai điểm → chốt ngay, quá hạn → `GET /api/duels/{id}` chốt (không nộp = thua). Thống kê `users.duelStats`; đấu lại gắn `rematchId` vào trận cũ. Ghép trận ngẫu nhiên chưa làm.
- Kết nối RTDB dùng chung, đếm người giữ (`modules/realtime/realtime-connection.ts`) để presence và phòng đấu không ngắt nhau.

### Phần thưởng: thưởng ngày, mục tiêu sự kiện

- Thưởng ngày: xong lượt daily tính điểm → `POST /api/daily/claim` (mỗi ngày 1 lần, `users/{uid}/daily/{day}.rewardClaimedAt`), xu theo vòng 7 ngày của chuỗi (20→150, `daily-reward-track.ts`). Nhận ở /daily (hộp chúc mừng), trang chủ + hộp hết ván báo khi có quà.
- Sự kiện tuần (/event): 3 mốc điểm trong 1 ván (1.000/3.000/6.000 → 30/80/150 xu) nhận ngay khi đạt; thưởng hạng cuối tuần (top 1/3/10/100 + tham gia) nhận ở tuần sau, hạng tính lúc nhận bằng `count()` trên bảng đã đóng. `GET /api/events`, `POST /api/events/claim`, đánh dấu `users/{uid}/eventRewards/{week}`. Sự kiện kết thúc 00:00 thứ Hai giờ VN.
- Đấu 1v1: id phòng = mã 6 ký tự (bảng chữ không dễ nhầm), vào bằng link hoặc gõ mã ở /duel; phòng cũ id 10 ký tự vẫn mở được.

### Luồng ván tính điểm

```
FirebaseAuthProvider: chưa có user → signInAnonymously
ranked-game-cloud-sync (chạy khi màn chơi mở):
  chưa có seed dự phòng → POST start → store.nextRankedSeed
  ván hiện tại chưa chơi + chưa tính điểm → startNewGame() nhận seed đó ngay
store: mỗi action hợp lệ → actionLog
  hết ván + đã hồi sinh, hoặc bắt đầu ván mới → pendingSubmissions (lưu trong save)
sync: pendingSubmissions → POST submit (400/404/409/413/422: bỏ; 401/429/5xx/mạng: giữ, thử lại sau 30s / khi online)
```

- State đầu ván = `createRankedGameStartState({ seed, stashUnlocked })`, dùng chung client và server.
- `stashUnlocked` đầu ván lấy từ profile server; riêng người chưa có ván cloud nào thì tin trạng thái local một lần.
- Mất mạng / chưa có seed / log vượt 10.000 action → ván seed local, không tính lên cloud (hộp game over ghi rõ).
- Seed dự phòng cấp lúc ô cất còn khoá mà ván vừa rồi đã mở ô cất → sau khi ván đó nộp xong, xin lại seed một lần.
- Đổi tài khoản → bỏ seed/ván/hàng chờ của uid cũ.

## Route

- `app/(main)/` — layout có header + footer: trang chủ (nút "Chơi ngay" + thẻ thử thách hằng ngày + nhiệm vụ ngày), `/leaderboard`, `/c/[id]` (thách đấu), profile (cấp/xu, thống kê, thành tích, mời bạn).
- `app/opengraph-image.tsx`, `app/(main)/c/[id]/opengraph-image.tsx` — ảnh preview khi dán link.
- `app/(game)/play/` — layout không có header/footer của site, màn chơi chiếm trọn `100dvh`; HUD của game tự có nút về trang chủ. Page là server component (metadata, viewport, JSON-LD `VideoGame`) render `BlockPuzzleGameScreen` (client).

## modules/block-puzzle/

```
engine/      TS thuần, không DOM/React — bàn, khối, điểm/combo, chia khối, reducer. Unit test đầy đủ.
store/       zustand + persist: save game ("block-puzzle.save", có version + zod validate, kèm log nước đi + hàng chờ nộp), cài đặt ("block-puzzle.settings"), đồng bộ ván tính điểm.
render/      Canvas 2D: layout theo DPR, vẽ khối bằng code (không sprite), xem trước chỗ thả, hiệu ứng.
input/       Pointer Events kéo thả (chuột/cảm ứng/bút), rung.
audio/       Âm thanh tổng hợp bằng Web Audio (không file âm thanh).
components/  React shell: canvas host, HUD điểm, dialog (game over, chơi lại, cách chơi), menu cài đặt.
block-puzzle-translations.ts  chuỗi en/vi, gộp vào lib/i18n.tsx.
```

### Luồng dữ liệu

```
pointerdown/move (input) → computeDragState → renderer vẽ bóng + dòng sắp xoá
pointerup → store.placePiece → gameReducer(PLACE_PIECE) → state mới (+ lastMove)
store.subscribe (canvas host) → tạo hiệu ứng + âm thanh + rung → rAF vẽ tới khi hết hiệu ứng
HUD/dialog đọc store qua selector → React render
```

- Canvas không re-render React mỗi frame; rAF chỉ chạy khi đang kéo hoặc còn hiệu ứng (idle = 0 CPU).
- Store dùng `skipHydration`, `BlockPuzzleGameScreen` gọi `persist.rehydrate()` sau mount để HTML server/client khớp.
- Save khôi phục: zod validate từng phần (ván hỏng không làm mất kỷ lục) → `RESTORE` chuẩn hoá (xoá dòng đầy sẵn, chia lại khay rỗng, bỏ `lastMove`, tính lại game over).
- Storage qua `store/safe-local-storage.ts`: localStorage bị chặn (iframe portal, hết dung lượng) thì rơi về bộ nhớ tạm, game vẫn chơi được.
- Kéo thả gắn với `uid` khối; move/up nghe trên window; ván mới, resize, mất focus đều huỷ kéo.

### Luật chơi (engine)

- Bàn 8x8, khay 3 khối (15 họ polyomino, đủ hướng xoay, không xoay khi chơi). Dùng hết 3 khối mới chia lượt mới.
- Hàng/cột đầy xoá cùng lúc. Game over khi không khối nào trong khay hoặc ô cất đặt được.
- Điểm (`engine/score-and-combo-rules.ts`): 1/ô đặt + `10·n(n+1)/2` cho n dòng xoá × combo (1 + 0.5/bậc), combo giữ 3 nước không xoá; dọn sạch bàn +300.
- Chia khối (`engine/piece-tray-generator.ts`): chu kỳ smart/bag/bag. `board-smart-selector.ts` chọn tuần tự theo bàn và mô phỏng xoá dòng; `tray-generator-config.ts` chứa túi khối, nhánh điểm 100/800 và shuffle. Túi rút không hoàn lại, không bắt buộc cả ba khối đặt được; chỉ thay slot đầu bằng dot nếu khay và ô cất đều không có nước đi. State lưu bộ đếm, hàng đợi túi và phần còn lại. Chi tiết/kiểm chứng: `classic-tray-generation.md`.
- Bàn mở đầu trống. Ô cất mở từ 300 điểm (giữ cho các ván sau); đổi khay 2 lượt/ván; hồi sinh 1 lần: xoá 2 hàng + 2 cột đầy nhất rồi chia khay mới (`engine/power-up-rules.ts`).
- Tutorial 3 bài tự thiết kế (`engine/tutorial.ts`), chạy trên state tạm, không đụng save.
- UI: khối vẽ bằng code, 4 theme (`render/block-color-palette.ts`), font Inter, âm thanh Web Audio tổng hợp. Không có asset hay dữ liệu lấy từ game khác.
- Cân bằng: `npm run balance` cho bot tham lam chơi 300 ván (`engine/balance-simulator.ts`), in điểm TB/trung vị, số nước, tỉ lệ xoá dòng/combo.
- RNG mulberry32 có seed → cùng seed + cùng nước đi = cùng kết quả.

## lib/ — hạ tầng app

- `lib/firebase/` — khởi tạo Firebase client (Auth với persistence IndexedDB → localStorage → bộ nhớ), `fetchJsonWithFirebaseIdToken` gọi API kèm ID token.
- `lib/auth/` — zustand store trạng thái đăng nhập (không persist, Firebase tự lưu phiên), liên kết/đăng nhập Google, đăng xuất về khách.
- `lib/i18n.tsx` — i18n tự viết (không dùng next-intl), en/vi. Chuỗi của game nằm trong module và được spread vào dictionary.
- `lib/routes.tsx` — enum route tập trung (`Routes`, `ApiRoutes`).
- `lib/site.ts` — site config tĩnh đọc từ env.
- `lib/seo/` — JSON-LD schema helpers (WebSite, Organization, VideoGame).

## UI

- `components/ui/` — shadcn. Cài thêm bằng `cmd /c npx shadcn@latest add <name> --yes`.
- `components/layout/` — header (có link "Chơi"), footer, chuyển ngôn ngữ, menu tài khoản.
- `components/common/` — empty state dùng lại.
- `components/seo/` — JSON-LD.
