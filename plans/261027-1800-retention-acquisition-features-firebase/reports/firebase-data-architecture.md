# Kiến trúc dữ liệu Firebase

## Chia việc giữa các dịch vụ

| Dịch vụ | Dùng cho | Lý do |
|---|---|---|
| **Authentication** | Khách (Anonymous) → liên kết Google | Có `uid` ngay khi vào game, liên kết sau vẫn giữ `uid` + dữ liệu |
| **Cloud Firestore** — kho lưu chính | Profile, thống kê, streak, xu/XP, cloud save, BXH, thách đấu, thành tích | Truy vấn/sắp xếp/đếm hạng được, security rules theo field, offline cache. Tính tiền theo **số lần đọc/ghi** → ghi ít, theo mốc (hết ván), không ghi mỗi nước |
| **Realtime Database** — chỉ phần realtime | Presence ("X đang chơi"), phòng đấu 1v1, hàng chờ ghép trận | Có `onDisconnect` (tự xoá khi rớt mạng), độ trễ thấp, tính tiền theo **dung lượng/băng thông** chứ không theo số lần ghi → hợp với cập nhật điểm mỗi nước trong trận 1v1 |
| **Next.js Route Handler + Admin SDK** | Nộp điểm (replay kiểm tra), cộng xu/XP, thưởng mời bạn, tạo seed ván | Client không được tự ghi điểm/xu. Chạy trên server Next sẵn có → **không cần Cloud Functions** (Functions bắt buộc gói Blaze) |
| ~~Analytics (GA4)~~ | **Không dùng** (đã chốt) | Đo retention/share bằng số liệu Firestore khi cần |
| Remote Config (giai đoạn 5+) | Bật/tắt sự kiện, chỉnh độ khó, A/B test | Đổi không cần deploy |
| Cloud Messaging (giai đoạn 5) | Web Push nhắc streak | Miễn phí |
| ~~Cloud Storage~~ | **Không dùng** | Không có file người dùng tải lên. Ảnh share tạo bằng canvas phía client, ảnh OG tạo bằng `next/og` từ dữ liệu Firestore. Dự án mới cần gói Blaze mới tạo được bucket Storage — tránh được thì tránh |
| localStorage (giữ nguyên) | Ván đang chơi, cài đặt, cache offline | Game vẫn chơi được khi mất mạng / bị chặn storage trong iframe. Đồng bộ lên Firestore ở mốc: hết ván, đổi theme, rời trang |

Region: **asia-southeast1 (Singapore)** cho cả Firestore và Realtime DB — gần VN nhất. Chọn rồi **không đổi được**.

## Firestore

```
users/{uid}
  displayName, avatarId, locale, isAnonymous, createdAt, lastActiveAt
  selectedTheme                          ← client được ghi
  level, xp, coins, unlockedThemes[]     ← chỉ server ghi
  stats { gamesPlayed, bestScore, bestCombo, totalLines, boardClears }   ← chỉ server ghi
  streak { current, best, lastDailyDay, freezes }                        ← chỉ server ghi
  referralCode, referredBy
users/{uid}/private/save                 ← ván dở để chơi tiếp trên máy khác (client ghi, chỉ chủ đọc)
users/{uid}/daily/{yyyymmdd}             ← kết quả daily + tiến độ nhiệm vụ ngày (server ghi)

leaderboards/{boardId}                   ← 1 doc snapshot top 100: { top: [{uid,name,score}], updatedAt }
leaderboards/{boardId}/entries/{uid}     ← điểm tốt nhất của từng người trên bảng đó (server ghi)
   boardId: "alltime" | "week-2026-W44" | "day-20261027"

challenges/{challengeId}                 ← thách đấu bạn bè: creatorUid, creatorName, seed, creatorScore, createdAt
challenges/{challengeId}/results/{uid}   ← điểm người nhận (server ghi sau replay)
```

Tiết kiệm lượt đọc: màn BXH đọc **1 doc snapshot top 100** (1 lượt đọc) thay vì query 100 doc (100 lượt). Hạng của chính mình dùng aggregation `count()` (`score > myScore`) — 1 lượt đọc / 1.000 entry.

## Realtime Database

```
/presence/{uid}            { state: "online", mode: "classic|daily|duel", at }   ← onDisconnect().remove()
/matchmaking/{uid}         { name, at }                                         ← hàng chờ ghép trận
/duels/{roomId}
   seed, status: "waiting|playing|done", startedAt, endsAt
   players/{uid}           { name, score, moveCount, isGameOver, at }           ← mỗi người chỉ ghi nhánh của mình
```

Kết quả trận 1v1 được server replay rồi mới ghi vào Firestore (thống kê, XP). RTDB chỉ giữ trạng thái đang diễn ra, xoá phòng sau khi xong.

Giới hạn cần biết: gói Spark (free) chỉ **100 kết nối đồng thời** vào RTDB. Đủ cho dev/test; ra mắt presence/1v1 thật thì lên Blaze (200k kết nối).

## Chống gian lận điểm

```
1. POST /api/games/start   (gửi Firebase ID token)
   → server tạo gameId + seed (daily: seed theo ngày; challenge: seed của thách đấu), lưu tạm
2. Client chơi, ghi lại danh sách action: PLACE_PIECE / STASH_PIECE / REPLACE_TRAY / REVIVE
3. POST /api/games/submit  { gameId, actions[] }
   → verifyIdToken → lấy seed theo gameId → chạy lại gameReducer (import thẳng engine)
   → điểm do server tính, bỏ qua điểm client báo
   → ghi leaderboard entries + cập nhật snapshot top 100 + stats/xp/coins/streak (1 transaction)
```

Engine đã có test replay tất định (`power-up-replay-determinism.test.ts`) → dùng chung được ở server. Không chặn được bot tự chơi bằng thuật toán, nhưng chặn được sửa điểm/sửa request. Sau này thêm App Check (reCAPTCHA) để chặn gọi API từ ngoài trình duyệt.

## Security rules (tóm tắt)

- `users/{uid}`: chủ được đọc; chủ chỉ được sửa `displayName`, `avatarId`, `selectedTheme`, `locale`, `lastActiveAt`. Field kinh tế/thống kê chỉ Admin SDK.
- `users/{uid}/private/**`: chỉ chủ đọc/ghi.
- `leaderboards/**`, `challenges/**`: ai đăng nhập (kể cả khách) được đọc; không ai ghi từ client.
- RTDB `/presence/$uid`, `/duels/$room/players/$uid`: chỉ `auth.uid == $uid` được ghi.

File rules sẽ nằm trong repo (`firestore.rules`, `database.rules.json`) và deploy bằng Firebase CLI ở giai đoạn 1.

## Chi phí ước tính (gói Spark miễn phí)

Firestore free/ngày: 50k đọc, 20k ghi. Mỗi người ~1 lần đọc profile + 1–2 lần đọc BXH + 1–3 lần ghi mỗi ván → khoảng **3.000–5.000 người chơi/ngày** vẫn trong free. Vượt mức thì lên Blaze (vẫn được hạn mức free, chỉ trả phần vượt) và **đặt budget alert**.
