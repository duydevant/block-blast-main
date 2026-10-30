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
| Firestore | `challenges/{id}` (+ `results/{uid}`), `users/{uid}` (tên, `stashUnlocked`, `stats`, `statsByMode`, `streak`, `xp`, `coins`, `unlockedThemes`, `achievements`, mời bạn, `recentFormScores`, `tierRewardsClaimed`, `dailyThreeStarDays`), `users/{uid}/daily/{YYYYMMDD}` (lượt tính điểm daily), `users/{uid}/missions/{YYYYMMDD}` (tiến độ nhiệm vụ ngày + `band`, `replacedSlot`, `gamesToday`, `games1000`), `users/{uid}/games/{gameId}` (lịch sử ván, TTL 180 ngày), `users/{uid}/years/{YYYY}` (bộ đếm cả năm cho tổng kết năm), `gameReplays/{gameId}` (log nước đi nén của ván kỷ lục / lọt top / tự lưu; `expireAt` null = giữ mãi), `reports/{id}` (báo cáo gian lận, admin xử lý trong console), `users/{uid}/seasons/{YYYY-MM}` (số ván, Bậc cao nhất, nhiệm vụ mùa, đã nhận thưởng hạng), `arenaRuns/{runId}` (lượt Đấu trường đã trả xu: loại, cấp, trạng thái, lần thử, session đang mở), `ghostPool/{gameId}` (ván xếp hạng làm bóng ma: nhóm MMR, `rand`, seed, nước đi nén, thời điểm, TTL 30 ngày), `users.rating` (MMR ẩn, LP, trận xếp hạng, mùa quý), `challenges/{id}.expiresAtMs/rewardedUids`, `referralCodes/{code}` (→ uid người mời), `duels/{code}` (phòng 1v1 nhiều ván: chủ/khách, `round` + seed + giờ server của ván hiện tại, `sessions`, điểm chốt, người thắng, `series`, `ready`, `history`, `version`), `pushSubscriptions/{sha256(endpoint)}` (đăng ký nhắc nhở: uid, keys, locale, ngày gửi gần nhất), `gameSessions/{gameId}` (seed, `mode`, `day`, trạng thái, TTL `expireAt`), `leaderboards/{boardId}` (snapshot top 100) + `leaderboards/{boardId}/entries/{uid}` (điểm tốt nhất) |
| Realtime Database | `/presence/{uid}` = timestamp khi đang ở màn chơi (chỉ chính chủ ghi, không ai đọc từ client); `/duels/{code}/state` (server ghi, có `version` chống ghi lùi; ai đăng nhập + biết mã đọc được) + `/duels/{code}/moves/{roundKey}/{uid}/{seq}` = `{a, at}` (từng nước đi; chỉ chính chủ là người chơi ghi, append-only, `at == now`, trong giờ ván) + `/duels/{code}/online/{uid}` (ai đang mở phòng / ván) |

- Client **không** đọc/ghi Firestore trực tiếp: `firestore.rules` và `database.rules.json` chặn hết. Mọi truy cập qua API route dùng Admin SDK (`server/firebase/firebase-admin-app.ts`).
- API (đều cần `Authorization: Bearer <Firebase ID token>`, uid lấy từ token):
  - `POST /api/games/start { mode: "classic" | "daily" }` → `{ gameId, seed, stashUnlocked, mode, day }`. Daily đã dùng hết 3 lượt tính điểm hôm nay → `gameId: null` (luyện tập, không nộp).
  - `POST /api/games/submit { gameId, actions[] }` → transaction: session phải `open` + đúng uid → `replayRecordedGame` → ghi `stats`, bảng xếp hạng, (daily lượt tính điểm) kết quả ngày + mốc/xu + tổng tuần + `streak`, session `done`. Log sai → 422 + session `rejected`; nộp lại → 409.
  - `GET /api/daily` → `{ day, todayScore, runInProgress, runs, goals, yesterdayScore, stars, recordBroken, week, previousWeek, streak, reward, missions }`; `POST /api/daily/week-claim { week, kind: "chest", index } | { week, kind: "rank" }`.
  - `POST /api/shop/themes { themeId }` → mua theme bằng xu (409 `not-enough-coins` / `theme-owned`), trả profile.
  - `POST/DELETE /api/push/subscriptions` → bật/tắt nhắc nhở; `GET /api/presence` (công khai) → `{ playing }`; `GET|POST /api/cron/daily-reminders` (Bearer `CRON_SECRET`).
  - `POST /api/games/start` còn nhận `mode: "level" (levelId) | "duel" (duelId)`; `POST /api/duels`, `POST /api/duels/{id}/join`, `POST /api/duels/{id}/settle`, `POST /api/duels/{id}/ready { ready }`, `GET /api/duels/{id}` (công khai, chốt ván quá hạn).
  - `GET /api/referral` → `{ code, referralCount }` (tạo mã lần đầu); `POST /api/referral/claim { code }` → gắn người mời.
  - `POST /api/challenges { gameId, actions? }` → `{ challengeId }`; `GET /api/challenges/{id}` (công khai).
  - `GET /api/leaderboards/{today|weekly|challenge|alltime|daily}` → bảng hiện hành `{ boardId, top, me: { rank, score, nextScore } }`.
  - `GET /api/games/history?mode=&cursor=` → `{ items, nextCursor }` (30 ván/trang, mới nhất trước); `POST /api/missions/replace { slot }` → đổi 1 nhiệm vụ hôm nay (1 lần/ngày, nhiệm vụ đã xong thì không đổi).
  - `GET /api/replays/{id}` (công khai, không uid, cache 1 ngày) → replay; `POST /api/replays { gameId, actions }` → tự lưu replay ván đã nộp (server replay lại, điểm phải khớp; tối đa 20). `POST /api/reports { replayId, reason }` (5/ngày). `GET /api/leaderboards/{period}?category=score|form|pure|combo|stars|logic`. Cron `/api/cron/rebuild-leaderboards` (Bearer `CRON_SECRET`) dựng lại top bảng phong độ.
  - `GET /api/seasons` + `POST /api/seasons/claim { kind: "mission", season, missionId } | { kind: "rank" }`; `GET /api/arena`, `POST /api/arena/runs { type, level }`, `POST /api/arena/runs/abandon`; `POST /api/games/start { mode: "arena", arenaRunId }`; `POST /api/lessons/complete { slug, actions }`.
  - `GET /api/ranked`, `POST /api/ranked/match` (tạo session `mode: "ranked"` cùng seed với bóng ma); `GET /api/recap/{year}` (15/12 → 15/01).
  - `GET/PATCH /api/profile` → profile (kèm `streak`, `form`, `tier`, `highestTier`, `statsByMode`); PATCH chỉ đổi `displayName` (2–16 ký tự), cập nhật tên trên các bảng hiện hành.
- Thiếu env Firebase → `status: "disabled"`, game chạy offline như cũ.

### Thử thách hằng ngày + bảng xếp hạng

- Ngày/tuần theo giờ VN (UTC+7, tuần ISO bắt đầu thứ Hai) — `server/daily/daily-challenge-calendar.ts`.
- Seed ngày = `HMAC(DAILY_SEED_SECRET, ngày)` → mọi người cùng chuỗi khối, không đoán trước ngày mai. Ô cất luôn khoá ở daily.
- **3 lượt tính điểm/ngày**, giữ chỗ lúc bắt đầu (`users/{uid}/daily/{day}.runs`, `server/daily/start-daily-run.ts`); hết lượt → luyện tập. Lượt cao nhất tính cho mốc, bảng ngày, tổng tuần; ván 0 nước trả lại lượt.
- **Mốc cá nhân** (`modules/progression/daily-challenge-goals.ts`): phong độ = trung vị điểm cao nhất 7 ngày gần nhất có chơi (`users.dailyRecent`, mặc định 1500) → ★/★★/★★★ = 70/110/150% (làm tròn 50) + 🏆 vượt `users.dailyBest`. Mốc chốt ở lượt đầu (`daily/{day}.goals`). Xu mốc (20/40/80, kỷ lục 100) cộng ngay khi nộp, mỗi mốc 1 lần/ngày (`apply-daily-run-result.ts`).
- **Thử thách tuần**: bảng `challenge-week-YYYY-Www` = tổng điểm cao nhất từng ngày (entry += phần điểm ngày tăng thêm; tuần của ngày thử thách, nhận nộp trễ 1 giờ sau khi tuần kết thúc). Sao tuần (≤ 21) mở rương 10★ = 150 xu, 18★ = 400 xu; thưởng hạng (top 1/3/10/100 + tham gia) nhận tuần sau, hạng tính bằng `count()` trên bảng đã chốt. Đánh dấu `users/{uid}/dailyWeeks/{week}` (`daily-week-rewards-store.ts`).
- Streak: +1 nếu hôm qua có lượt daily, không thì về 1; hiển thị 0 khi đã đứt (quá hết ngày hôm sau).
- Bảng: hôm nay ⊂ tuần ⊂ mọi lúc (cùng tập ván: Vô tận + lượt daily tính điểm). classic → `today-YYYYMMDD` (ngày nộp) + `weekly-YYYY-Www` + `alltime`; daily (lượt tính điểm) → `daily-YYYYMMDD` (bảng riêng thử thách, giữ lượt cao nhất); chỉ **lượt đầu** của ngày thêm hôm nay + tuần + mọi lúc (lượt 2, 3 đã biết bộ khối). Tab /leaderboard: hôm nay, tuần, thử thách (tổng tuần), mọi lúc. Mỗi bảng: entries (điểm tốt nhất/uid) + doc snapshot top 100 cập nhật trong cùng transaction → mở bảng = 2 lượt đọc (ngoài top 100 thêm `count()` + 1 truy vấn).
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
- Thành tích suy từ stats/streak/cấp/số bạn mời/sao màn/Bậc/thắng 1v1…; chỉ lưu id đã nhận thưởng. Nhóm hiển thị: chăm chỉ / kỹ năng / phong cách / bạn bè.
- **Chỉ số ván** (`engine/game-run-stats.ts`): reducer cộng `GameState.runStats` sau mỗi nước hợp lệ (nước xoá dòng, xoá ≥2/3/4 dòng, max dòng 1 nước, combo, dọn bàn, số lần Cất/Đổi/Hồi sinh) → client và server replay ra cùng số. "Ván thuần" = không dùng trợ giúp (≥10 nước). Không ảnh hưởng luật/điểm.
- **Phong độ & Bậc** (`modules/progression/player-form-rules.ts`): phong độ = trung vị 20 ván gần nhất trong tập Vô tận + lượt đầu daily (mọi ván ≥1 nước đều tính — không né ván xấu được); ≥10 ván mới xếp Bậc Đồng/Bạc/Vàng/Bạch kim/Kim cương/Cao thủ (ngưỡng tạm 0/800/1.500/3.000/6.000/12.000). Lần đầu đạt mỗi Bậc +xu. Bậc ghi kèm hàng BXH.
- **Nhiệm vụ ngày**: 12 loại (thêm ván thuần, xoá ≥3 dòng, điểm/nước, 3 sao màn, đấu 1v1, sao thử thách); *loại* tất định theo ngày, *mức* theo band Bậc (0–3) chốt ở lần ghi đầu của ngày; đổi được 1 nhiệm vụ/ngày (lấy loại thứ 4 của ngày).
- **Xem lại ván (replay)**: ván là kỷ lục cá nhân hoặc làm đổi top 100 một bảng → lưu `gameReplays/{gameId}` trong transaction nộp ván (nước đi nén 1 số/nước, `engine/recorded-action-codec.ts`). Kỷ lục cá nhân + top bảng mọi lúc giữ mãi (`users.bestReplayId`), còn lại TTL 90 ngày. Hàng BXH mang `replayId` + `tag` → `/game/{id}` (phát lại bằng chính renderer của game) và `/u/{tag}` (hồ sơ công khai, tag = mã mời).
- **BXH theo hạng mục** (`modules/leaderboard/leaderboard-categories.ts`): Điểm (bảng cũ), Phong độ (`form-alltime`, ghi đè — giảm được; cron dựng lại top hằng ngày), Thuần (`pure-weekly-*`, `pure-alltime`), Combo (`combo-alltime`), Sao màn (`stars-alltime`), Không bế tắc (`logic-weekly-*`, `logic-alltime`).
- **Chống bot** (`server/games/assess-game-plausibility.ts`): client gắn thời điểm `t` vào từng nước (bỏ khi ghi RTDB đấu), nộp kèm `times`; server gắn cờ khi quá nhanh (<250 ms/nước theo giờ session) hoặc nhịp đều như máy / quá nhiều nước <120 ms. Ván bị gắn cờ hoặc tài khoản `banned`: không vào bảng, không replay, không xu, không tính phong độ (vẫn cộng XP/thống kê). Báo cáo đang mở giữ thưởng hạng tuần top 10.
- **Phân tích sau ván** (`engine/game-outcome-analysis.ts`, `modules/analysis/`): chạy trong Web Worker khi bấm "Vì sao thua?" → nước quyết định (còn lối → hết lối) + gợi ý vị trí khác, hoặc "khay vô nghiệm" (xui). Không có gợi ý trong ván.
- **Mùa giải tháng** (`lib/vn-calendar.ts` `seasonKeyFor`, `modules/progression/season-rules.ts`): bảng `season-YYYY-MM` (điểm), `form-season-*`, `pure-season-*`; doc mùa của người chơi cập nhật trong transaction nộp ván (ván bị gắn cờ không tính). 5 nhiệm vụ mùa tất định theo tháng, mức theo band chốt ở ván đầu mùa, bấm nhận. Mùa trước: thưởng hạng (top 1/3/10/100 + tham gia ≥ 20 ván) + huy hiệu Bậc cao nhất, nhận sau khi bảng chốt (1 giờ ân hạn); top 10 bị giữ nếu có báo cáo mở. Bậc không reset.
- **Đấu trường** (`modules/game-modes/arena-catalog.ts`): 5 loại (Tốc độ, Thuần, Chướng ngại, Combo, Bền bỉ) × 5 cấp; trả xu mở lượt (L3+ cần Bậc Vàng/Bạch kim/Kim cương), mỗi lần thử là 1 session `mode: "arena"` với biến thể từ catalog. Tốc độ: đồng hồ theo giờ server, client tự chốt ván khi hết giờ, server so `finishedAt − createdAt` (+10 s). Thắng lượt → xu + XP + `users.arena[type]`; điểm Đấu trường = tổng cấp cao nhất (≤ 25). Không cất ván, không vào BXH, không tính phong độ, không lưu replay. `users.coinsSpentTotal` (theme + phí) → xu đã kiếm = coins + đã tiêu. `npm run arena-balance` đo bằng bot.
- **Bài học kỹ thuật** (`modules/lessons/`): 12 bài, bàn + khay cố định (`GameVariant.fixedTrays`), lời giải mẫu được test replay; chơi trên state cục bộ; `POST /api/lessons/complete` replay lại → lần đầu +20 xu (`users.lessonsDone`). Trang SEO `/how-to-play/{slug}` (SSG, JSON-LD HowTo); "Vì sao thua?" gợi ý bài liên quan.
- **Đấu xếp hạng với bóng ma** (`modules/ranked/`, `server/ranked/`): ghép với ván đã ghi của người cùng nhóm MMR (±100 → lan ±300, bỏ ván của mình + 10 đối thủ gần nhất); không có → bot cùng MMR (tất định theo seed, đánh dấu "Máy", K/2 + LP/2, thắng máy không đẩy MMR quá 1300 và LP quá mức MMR cho phép; 15% trận ghép thẳng máy để hồ có seed mới). Luật đấu 1v1, 3 phút giờ server; client phát lại bóng ma theo nhịp thật. Elo ẩn (K 48 khi xếp hạng / 24), LP sau 3 trận xếp hạng, 7 giải 100 LP/giải, mùa quý (MMR kéo về giữa 25%). Trận chưa nộp quá giờ / log hỏng / 0 nước → thua; nộp trễ (>3 phút + 30 s, hoặc nhịp client >3 phút) / bị gắn cờ → thua. Chủ bóng ma nhận ngược nửa thay đổi MMR (trừ khi đối thủ vi phạm). Phòng 1v1 riêng không tính hạng. BXH `ranked-lp-YYYY-Qn`.
- **Thách đấu có thưởng 2 chiều**: người nhận vượt điểm trong 3 ngày → cả hai +50 xu (ván người thách ≥ 10 nước + không nghi bot; người nhận ≥ 5 ván + tài khoản ≥ 24 giờ, mỗi người 1 lần / thách đấu, mỗi người tối đa 5 lần thưởng / ngày tính cả hai vai).
- **Emote trong phòng 1v1** (RTDB `duels/{code}/emotes/{uid}`, 6 emote cố định, cách nhau ≥ 3 s, không xoá được để lách, có thể ẩn emote đối thủ). **Tổng kết năm** `/recap/{year}` từ bộ đếm `users/{uid}/years/{YYYY}` + ảnh share 1080×1080.
- **Lịch sử ván**: mỗi ván nộp xong ghi `users/{uid}/games/{gameId}` + bộ đếm năm trong cùng transaction (chỉ ghi, không thêm lượt đọc). Trang `/profile/games`.
- Theme: 4 theme gốc miễn phí; `sunset` mở ở cấp 5, `forest`/`galaxy` mua bằng xu, `gold` chỉ qua mời bạn (`theme-unlock-rules.ts`). Màn chơi tự về theme mặc định nếu profile cho thấy theme đang chọn không thuộc về người chơi.
- Mời bạn: link `/?ref=CODE` → `ReferralLinkCapture` giữ mã tới khi có uid rồi claim (chỉ khi chưa được mời, < 3 ván, không tự mời, không mời chéo). Ván đủ nước thứ 3 (đếm `referralGames`) của người được mời → cả hai +200 xu + theme `gold`; người mời nhận xu tối đa 10 lần, thành tích "referral-1" cộng ngay trong cùng transaction. uid người mời không bao giờ trả về client.

### PWA, nhắc nhở, đang chơi, SEO

- PWA: `app/manifest.ts` (start_url `/play`, standalone), icon sinh bằng `next/og` (`app/icon.tsx`, `app/apple-icon.tsx`, `/pwa-icon/{any-192|any-512|maskable-512}`). `public/sw.js`: trang `/`, `/play` network-first (mất mạng dùng bản lưu), `/_next/static` + font cache-first, không bao giờ cache `/api`. Chỉ đăng ký SW ở production (`modules/pwa/pwa-environment.ts`). Nút "Cài game" (beforeinstallprompt) ở hộp hết ván sau ≥3 ván online và ở profile; iOS hiện hướng dẫn.
- Web Push chuẩn VAPID (`web-push`), không dùng FCM SDK: client `usePushReminders` → `POST/DELETE /api/push/subscriptions` (endpoint chỉ nhận host dịch vụ push thật — chặn SSRF). Cron `/api/cron/daily-reminders` (Bearer `CRON_SECRET`, so sánh timing-safe): hôm nay chưa có lượt daily → chuỗi còn sống thì "giữ chuỗi N ngày", không thì "thử thách hôm nay" cho người hoạt động ≤7 ngày; `lastSentDay` chặn gửi trùng; 404/410 → xoá đăng ký. Gợi ý bật ở thẻ daily khi chuỗi ≥2.
- Presence: `usePlayerPresence` (màn chơi) ghi `/presence/{uid}` + `onDisconnect().remove()`, tab ẩn thì xoá + `goOffline` (Spark 100 kết nối). `GET /api/presence` đếm bằng Admin SDK, cache 30s; trang chủ hiện khi ≥2.
- SEO: `/how-to-play` (render server, JSON-LD FAQPage); `/leaderboard` render sẵn top 20 các bảng (ISR 5 phút, mở tab đầu tiên có dữ liệu) rồi client thay bằng dữ liệu kèm hạng của mình; sitemap có `/how-to-play`.

### Sự kiện tuần, màn chơi, đấu 1v1

- Các chế độ độc lập (`modules/block-puzzle/special-game-modes.ts`, `store/parked-mode-games.ts`): mỗi chế độ (Vô tận, thử thách ngày, màn chơi, thách đấu) giữ một ván dở trong `parkedGames` của save. Vào chế độ khác → cất ván đang chơi (không nộp), lấy ván dở của chế độ đích nếu còn đúng ngày / màn / thách đấu, không thì xin ván mới (ván cất cũ bị bỏ thì nộp phần đã chơi). Màn chơi hiện "đang tải" trong lúc chuyển. Nút Play chung = `/play?endless=1`; "Ván mới" = ván mới cùng chế độ. Đấu 1v1 không cất (rời = bỏ trận, có hỏi).

- Engine: `createNewGame(seed, variant)` với `GameVariant { startBoard, moveLimit, replaceCharges }`; `moveLimit` hết = hết ván (không hồi sinh vượt); `linesCleared` đếm trong state. Biến thể **luôn** suy từ catalog (`modules/game-modes/`) theo mode + id lưu trong session — client không gửi biến thể.
- Sự kiện tuần đã gộp vào thử thách ngày (2026-10-29): `/event` chuyển về `/daily`; session `mode: "event"` cũ nộp lên bị từ chối (`mode-retired`).
- Màn chơi: 20 màn (`level-catalog.ts`) seed + bàn cố định, mục tiêu điểm/dòng + giới hạn nước; seed/giới hạn chọn bằng bot và test bot giải được từng màn. Đạt mục tiêu → client chốt ván (`endVariantRun`) → server replay tính sao (≤60% nước = 3 sao, ≤80% = 2), `users.levelStars`, 20 xu mỗi sao mới. Chơi offline được (sao lưu local, `level-progress-store`).
- Đấu 1v1 (phòng nhiều ván, cùng mã):
  - `POST /api/duels` tạo phòng → link/mã `/duel/{code}` → người kia `join` → ván 1: đếm ngược 5s, 3 phút (giờ server). Mỗi người xin 1 session `mode: "duel"` mỗi ván (cùng seed, `DUEL_VARIANT` = không hồi sinh, `noPowerUps`: không Cất / Đổi khối — canvas bỏ hàng nút, reducer + replay từ chối `STASH_PIECE` / `REPLACE_TRAY`).
  - Mỗi nước đi được ghi ngay lên RTDB `moves/{roundKey}/{uid}/{0000…}` kèm giờ server (`modules/duel/duel-move-stream.ts`). Đối thủ + người xem replay nước đi từ seed để vẽ bàn thật (`use-duel-board.ts`); server chấm từ cùng chuỗi nước (`settle-duel-round.ts`, chỉ nước liên tục, ghi trước `endsAt + 3s`).
  - Chốt ván (`decideDuelRound`): cả hai hết nước → so điểm; một người hết nước và người kia **vượt** điểm → thắng ngay; còn lại người sống chơi tới hết nước / hết 3 phút. Client gọi `settle` khi mình dừng hoặc vừa vượt điểm; `GET` chốt ván quá hạn.
  - Hết ván → bảng "Trận đấu" (không ván mới / hồi sinh), xem bàn đối thủ tới khi có kết quả. Đấu lại: hai người `ready` → ván mới cùng phòng (seed mới), `series` + `history` giữ tỉ số; nước đi ván cũ bị xoá.
  - Người xem: mở link/mã khi phòng đủ người → hai bàn trực tiếp, tỉ số, số người xem (`online`). XP/thống kê ván vẫn qua `/api/games/submit`; `users.duelStats` cộng khi chốt ván. Ván bị chốt sớm (hết giờ/bỏ trận) mang `endedEarly` để tải lại vẫn là hết ván.
- Kết nối RTDB dùng chung, đếm người giữ (`modules/realtime/realtime-connection.ts`) để presence và phòng đấu không ngắt nhau.

### Phần thưởng: thưởng chuỗi, mốc thử thách, thưởng tuần

- Thưởng ngày: xong lượt daily tính điểm → `POST /api/daily/claim` (mỗi ngày 1 lần, `users/{uid}/daily/{day}.rewardClaimedAt`), xu theo vòng 7 ngày của chuỗi (20→150, `daily-reward-track.ts`). Nhận ở /daily (hộp chúc mừng), trang chủ + hộp hết ván báo khi có quà.
- Mốc thử thách ngày + rương sao + thưởng hạng tuần: xem phần "Thử thách hằng ngày" ở trên. Tuần kết thúc 00:00 thứ Hai giờ VN.
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
- Khay đầu ván (bàn trống, không phải màn chơi): `engine/opening-tray-generator.ts` bốc theo seed 1 trong 19 bộ 3 khối to đặt được để xoá ≥ 2 dòng (thứ tự + màu ngẫu nhiên), thay lượt smart đầu; màn chơi giữ bộ chia cũ (thiết kế theo seed).
- Chia khối (`engine/piece-tray-generator.ts`): chu kỳ smart/bag/bag. `board-smart-selector.ts` chọn tuần tự theo bàn và mô phỏng xoá dòng; `tray-generator-config.ts` chứa túi khối, nhánh điểm 100/800 và shuffle. Túi rút không hoàn lại, không bắt buộc cả ba khối đặt được; chỉ thay slot đầu bằng dot nếu khay và ô cất đều không có nước đi. State lưu bộ đếm, hàng đợi túi và phần còn lại. Chi tiết/kiểm chứng: `classic-tray-generation.md`.
- Cài đặt (`block-puzzle.settings`): âm thanh, rung, theme, độ nâng khối khi kéo (thấp/vừa/cao), ký hiệu mù màu, giảm chuyển động (theo hệ thống/bật/tắt), tô dòng sắp xoá. Chơi bằng bàn phím khi canvas có focus: 1/2/3 chọn khối, Tab đổi khối, mũi tên di chuyển, Enter/Space đặt, S cất, R đổi khay, Esc thoát; vùng `aria-live` đọc điểm.
- **Luật v2** (`rulesVersion: 2` trong `GameVariant`/`GameState`, thiếu = v1): chỉ chế độ vô tận (Cổ điển, Thử thách ngày, Thách đấu, Xếp hạng, 1v1). Client khai luật trong request xin seed (`rulesVersion`); server chỉ cấp v2 khi client khai (JS cũ → v1; thách đấu / phòng 1v1 / xếp hạng luật v2 → 409 `client-outdated`), ghi vào session (thách đấu theo ván gốc, 1v1 theo ván của phòng, xếp hạng chỉ ghép bóng ma cùng phiên bản) và trả về `rulesVersion`; replay/bóng ma/replay viewer dựng ván đúng phiên bản. Gồm: chuỗi dọn sạch bàn (`score-and-combo-rules.ts`: +500, lần kế trong ≤ 9 nước ×2…×5) và bộ chia theo điểm (`engine/adaptive-tray-dealer.ts`: độ khó `điểm / (điểm + 2500)`, khối gỡ bàn 55% → 20%/ô, khối nhỏ/vừa/to 45/40/15 → 20/35/45%). Màn chơi, Đấu trường, Bài học, Không bế tắc giữ luật v1.
- Tạm dừng (`components/game-pause-overlay.tsx`): chế độ không tính giờ; che bàn, tự dừng khi ẩn tab. Không có ở 1v1 / Xếp hạng / Đấu trường có giờ (đồng hồ server, đối thủ vẫn chạy).
- Chế độ "Không bế tắc" (mode `logic`, `GameVariant.guaranteedTray`): mọi chỗ chia khay đi qua `engine/deal-tray-for-state.ts`; khay vô nghiệm (kiểm `canPlaceAllInSomeOrder`, budget 6.000) → chia lại tối đa 4 lần rồi ép lượt smart. Tất định theo seed nên server replay ra cùng khay. BXH riêng, không tính phong độ. Bot: trung vị 1.057 (Classic 951).
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
