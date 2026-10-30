# QA tay — 4 phase học từ Minesweeper Online

Ngày: 2026-10-30 · Branch `feat/skill-depth-from-minesweeper-research` · Commit `6ec9314`+

Mỗi case: **Làm** → **PASS khi** → **FAIL khi**. Ghi kết quả vào cột cuối (✅ / ❌ + ghi chú).
Ưu tiên: **P0** = chặn release, **P1** = nên sửa trước release, **P2** = sửa sau được.

## 0. Chuẩn bị

- 2 tài khoản Google: **A** (tài khoản chính) và **B** (tài khoản thứ hai). Với case thách đấu có thưởng, B cần **≥ 5 ván** và **tạo ≥ 24 giờ** → tạo B ngay hôm nay.
- Mở Firebase Console (Firestore + Realtime Database) để soi dữ liệu.
- 1 điện thoại thật (Android Chrome hoặc iOS Safari) + 1 máy tính.
- Trước khi test: `docker compose logs firebase-deploy` có `Deploy complete!`; Firestore → Indexes **tất cả Enabled**.

---

## Hạ tầng (làm trước tiên)

| ID | P | Làm | PASS khi | FAIL khi | KQ |
|---|---|---|---|---|---|
| INF-01 | P0 | `docker compose up firebase-deploy` | Log có `✔ Deploy complete!` | `403` / `PERMISSION_DENIED` / `thiếu FIREBASE_ADMIN_*` | |
| INF-02 | P0 | Firestore → Indexes | Có index `games` (mode, finishedAt), `reports` (targetUid, status, createdAtMs), `ghostPool` (bucket, rand) — tất cả **Enabled** | Thiếu index / kẹt *Building* > 1 giờ / *Error* | |
| INF-03 | P1 | Firestore → TTL policies | `expireAt` bật cho `gameSessions`, `games`, `gameReplays`, `ghostPool` | Thiếu collection nào | |
| INF-04 | P0 | Realtime Database → Rules | Có nhánh `duels/$duelId/emotes/$uid` | Không có | |
| INF-05 | P0 | `docker compose ps` | `web` Up, `cron` Up, `firebase-deploy` Exited (0) | `web` restart liên tục | |
| INF-06 | P1 | Chạy backfill thử (không `--write`), xem số dòng, rồi `--write` | Bảng **Sao** có dữ liệu ngay; chạy lại lần 2 không nhân đôi | Lỗi / chạy lại bị nhân đôi điểm | |

---

## Phase 1 — Chỉ số ván, Phong độ, Lịch sử, Nhiệm vụ, Cài đặt

| ID | P | Làm | PASS khi | FAIL khi | KQ |
|---|---|---|---|---|---|
| P1-01 | P0 | Chơi 1 ván Vô tận bình thường (≥ 10 nước) tới hết | Hộp hết ván hiện điểm + chỉ số (điểm/nước, xoá nhiều dòng, combo cao nhất, ván thuần…); điểm khớp điểm trong ván | Thiếu chỉ số / điểm khác / nộp lỗi 422 | |
| P1-02 | P0 | Chơi 1 ván **không** dùng Cất / Đổi khay / Hồi sinh | Ván được đánh dấu **Thuần** | Không nhận là thuần | |
| P1-03 | P1 | Chơi 1 ván có dùng Đổi khay | Ván **không** thuần | Vẫn tính thuần | |
| P1-04 | P0 | Tài khoản mới, chơi 9 ván | Chưa có Bậc ("chưa xếp") | Đã có Bậc trước 10 ván | |
| P1-05 | P0 | Chơi ván thứ 10 | Có Phong độ (= trung vị 20 ván gần nhất) + Bậc; lần đầu đạt Bậc ≥ Bạc thì nhận xu (Bạc 50, Vàng 100, Bạch kim 200, Kim cương 400, Cao thủ 800) | Không có Bậc / nhận xu lại lần 2 cho cùng Bậc | |
| P1-06 | P1 | Chơi 1 ván điểm cực cao sau ≥ 10 ván | Phong độ **gần như không đổi** (trung vị) | Phong độ nhảy theo 1 ván | |
| P1-07 | P1 | Xem huy hiệu Bậc | Hiện ở hồ sơ, bảng xếp hạng, hộp hết ván | Thiếu chỗ nào | |
| P1-08 | P0 | Mở `/profile/games` | Danh sách ván mới nhất trước, đúng chế độ, có biểu đồ điểm; lọc theo chế độ đúng | Trống / lỗi index / lọc sai | |
| P1-09 | P1 | Trang nhiệm vụ ngày | Nhiệm vụ mới (12 loại), mức khó theo Bậc; đổi được **1** nhiệm vụ/ngày | Đổi được lần 2 / mức khó không theo Bậc | |
| P1-10 | P1 | Hoàn thành nhiệm vụ | Tiến độ tăng, nhận thưởng 1 lần | Không tăng / nhận 2 lần | |
| P1-11 | P2 | Thành tích | 11 thành tích mới, nhóm theo chủ đề | Thiếu / mở sai | |
| P1-12 | P1 | Cài đặt: nâng khối, mù màu, giảm chuyển động, tắt tô dòng | Mỗi cài đặt có tác dụng thấy được, lưu sau khi tải lại | Không tác dụng / mất sau tải lại | |
| P1-13 | P2 | Chơi bằng bàn phím (máy tính) | Chọn khối, di chuyển, đặt được bằng phím | Kẹt focus / không đặt được | |

---

## Phase 2 — Replay, BXH 6 hạng mục, Chống bot, Không bế tắc, Vì sao thua

| ID | P | Làm | PASS khi | FAIL khi | KQ |
|---|---|---|---|---|---|
| P2-01 | P0 | Phá kỷ lục cá nhân | Replay tự lưu; hộp hết ván có link xem lại | Không lưu | |
| P2-02 | P0 | Mở `/game/{id}` | Phát/dừng, tua, ×1/×2/×4, phím ← → đều chạy; **điểm cuối replay = điểm ván** | Replay lệch nước / điểm khác / "hỏng ở nước X" | |
| P2-03 | P1 | Mở link replay khi **chưa đăng nhập** (tab ẩn danh) | Xem được | Bắt đăng nhập / 404 | |
| P2-04 | P1 | Tự lưu thêm ván thứ 21 | Bị từ chối (tối đa 20) với thông báo rõ | Lưu được quá 20 | |
| P2-05 | P0 | `/leaderboard`, chuyển 6 hạng mục: Điểm, Phong độ, Thuần, Combo, Sao, Không bế tắc | Mỗi bảng có dữ liệu đúng loại; bấm tên → hồ sơ `/u/{tag}`; có link replay | Bảng lỗi / trùng dữ liệu bảng khác | |
| P2-06 | P1 | Ván thuần điểm cao | Lên bảng **Thuần**; ván không thuần thì không lên | Ván có trợ giúp vào bảng Thuần | |
| P2-07 | P1 | Hôm sau xem bảng Phong độ | Cron dựng lại bảng; phong độ giảm thì thứ hạng giảm theo | Bảng không đổi / phong độ cũ cao nhất bị giữ | |
| P2-08 | P0 | Chơi bình thường nhanh tay 1 ván ≥ 50 nước | **Không** bị gắn cờ (vẫn nhận xu, lên bảng) | Người thật bị gắn cờ (báo sai) | |
| P2-09 | P2 | (Đã có unit test) bot gửi nước quá đều / quá nhanh | Ván `suspect: true` trong `gameSessions`, không xu, không lên bảng | — | |
| P2-10 | P1 | B báo cáo 1 replay của A | Có doc trong `reports`; báo cáo lần thứ 6 trong ngày bị từ chối | Báo cáo được vô hạn / báo cáo chính mình được | |
| P2-11 | P1 | Ban tài khoản (đặt `banned: true` trong `users/{uid}`), chơi 1 ván | Ván mới không lên bảng, không xu | Vẫn lên bảng | |
| P2-12 | P0 | Chơi `/play?logic=1` vài ván | Mỗi khay mới **luôn đặt được cả 3 khối theo một thứ tự nào đó**; thua chỉ do mình đi sai | Có khay vừa chia đã không đặt được | |
| P2-13 | P1 | Ván Không bế tắc | Lên bảng **Không bế tắc**, không vào bảng Điểm / Phong độ | Lẫn sang bảng Điểm | |
| P2-14 | P1 | Thua 1 ván, bấm "Vì sao thua?" | Chỉ ra nước quyết định + gợi ý + link bài học liên quan; phân biệt xui / sai | Không chạy / gợi ý nước không hợp lệ | |
| P2-15 | P2 | Hồ sơ | Có thống kê tỉ lệ xui / sai | Thiếu | |

---

## Phase 3 — Mùa giải, Đấu trường, Bài học

| ID | P | Làm | PASS khi | FAIL khi | KQ |
|---|---|---|---|---|---|
| P3-01 | P0 | Mở `/season` | Mùa = tháng hiện tại (giờ VN), BXH mùa (Điểm / Phong độ / Thuần), 5 nhiệm vụ mùa | Lỗi / sai tháng | |
| P3-02 | P1 | Chơi vài ván | Tiến độ nhiệm vụ mùa tăng; ván bị gắn cờ không tính | Không tăng | |
| P3-03 | P1 | **Ngày 01/11** mở `/season` | Mùa mới; nhận được thưởng hạng + huy hiệu mùa 10 **1 lần** | Không nhận được / nhận 2 lần | |
| P3-04 | P0 | `/arena`: mở lượt Tốc độ cấp 1 (30 xu) | Trừ đúng 30 xu; đồng hồ 2 phút chạy theo giờ server | Không trừ xu / trừ 2 lần / đồng hồ sai | |
| P3-05 | P0 | Đạt mục tiêu (≥ 800 điểm trong 2 phút) | Thắng: +75 xu + 40 XP, mở cấp 2 | Không thưởng / không mở cấp | |
| P3-06 | P0 | Trượt cả 3 lần thử | Lượt đóng, mất 30 xu, không thưởng | Được thử lần 4 | |
| P3-07 | P1 | Đang thử, thoát ra (về trang chủ) | Lần thử đó tính **trượt** (không chơi lại seed mới miễn phí) | Thoát ra rồi thử lại không mất lần | |
| P3-08 | P1 | Thử cấp 3 khi Bậc < Vàng | Bị khoá, ghi rõ cần Bậc Vàng | Mở được | |
| P3-09 | P1 | Lần lượt mở 4 loại còn lại: Thuần (không trợ giúp), Chướng ngại (bàn có sẵn khối + giới hạn nước), Combo, Bền bỉ | Luật đúng từng loại (không có nút trợ giúp ở Thuần; đếm nước ở Chướng ngại…) | Luật sai / trợ giúp vẫn dùng được | |
| P3-10 | P1 | Không đủ xu mở lượt | Báo thiếu xu, không trừ âm | Xu âm | |
| P3-11 | P1 | Mở `/how-to-play`, học 1 bài | 12 bài; bài có khay cố định + lời giải mẫu; hoàn thành → ghi nhận 1 lần | Lời giải mẫu không đặt được / hoàn thành lặp lại | |
| P3-12 | P2 | Mở `/how-to-play/{slug}` khi chưa đăng nhập | Trang SEO xem được | 404 / bắt đăng nhập | |

---

## Phase 4 — Xếp hạng bóng ma, Thách đấu có thưởng, Emote, Tổng kết năm

### Đấu xếp hạng `/ranked`

| ID | P | Làm | PASS khi | FAIL khi | KQ |
|---|---|---|---|---|---|
| P4-01 | P0 | A mở `/ranked`, bấm đấu | Vào trận 3 phút, thấy dải bóng ma chạy điểm theo thời gian; trận đầu gần như chắc gặp **Máy** (hồ trống) | Lỗi `index` / không vào được trận | |
| P4-02 | P0 | Chơi hết 3 phút | Hết giờ tự kết thúc + nộp; hiện Thắng / Thua / Hoà, số trận xếp hạng còn lại | Đồng hồ chạy quá 3 phút / không nộp | |
| P4-03 | P0 | Chơi đủ 3 trận | Sau trận 3 có LP + giải (Tân binh, Chiến binh…) | Vẫn chưa có LP / có LP từ trận 1 | |
| P4-04 | P0 | Sau trận 3, thắng / thua tiếp | Thắng +LP, thua −LP; đấu **Máy** đổi ít hơn | LP không đổi / thua lại cộng | |
| P4-05 | P0 | B (MMR gần A) đánh ranked sau khi A đã có ván | B có lúc gặp **bóng ma của A** (tên + Bậc của A), nước đi bóng ma giống ván A | Luôn gặp máy dù có ván người thật / gặp chính mình | |
| P4-06 | P0 | Đang trận, thoát ra rồi bấm đấu lại **trong 5 phút** | Bị chặn "trận đang chờ" (không mở trận mới) | Mở được trận mới | |
| P4-07 | P0 | Thoát trận, **chờ > 5 phút** rồi đấu lại | Trận cũ tính **thua** (losses +1), mở được trận mới | Trận cũ biến mất không tính | |
| P4-08 | P0 | Trận đi 0 nước rồi bỏ | Tính **thua** | Không tính gì (né thua được) | |
| P4-09 | P1 | Chơi vài nước, tắt mạng, chờ 4 phút, bật mạng (ván nộp trễ) | Tính **thua** | Thắng/hoà theo điểm | |
| P4-10 | P1 | `/leaderboard` → bảng LP quý (`ranked-lp-2026-Q4`) | Có A, B sau khi đủ 3 trận | Có người chưa đủ 3 trận | |
| P4-11 | P1 | Mở replay một ván xếp hạng | Phát đúng (luật đấu 1v1), không "hỏng ở nước X" | Replay lệch | |
| P4-12 | P2 | Lịch sử ván | Ván xếp hạng có nhãn "Xếp hạng" | Nhãn sai | |
| P4-13 | P2 | Thắng máy liên tục nhiều trận | LP tăng chậm dần rồi dừng (không vượt ~400 LP nhờ máy) | Tăng mãi | |

### Thách đấu có thưởng 2 chiều

| ID | P | Làm | PASS khi | FAIL khi | KQ |
|---|---|---|---|---|---|
| P4-20 | P0 | A chơi Vô tận ≥ 10 nước, tạo link thách đấu, gửi B | B mở link thấy lời mời "vượt điểm trong 3 ngày → cả hai +50 xu" | Không có lời mời thưởng | |
| P4-21 | P0 | B (≥ 5 ván, tài khoản ≥ 24 giờ) vượt điểm A | B +50 xu ở hộp hết ván; A +50 xu | Một trong hai không nhận | |
| P4-22 | P0 | B chơi lại thách đấu đó, vượt điểm lần nữa | **Không** nhận thêm | Nhận lần 2 | |
| P4-23 | P1 | B thua điểm A | Không ai nhận xu | Có xu | |
| P4-24 | P1 | Tài khoản mới (< 5 ván hoặc < 24 giờ) vượt điểm | Không nhận xu | Nhận xu | |
| P4-25 | P1 | A tạo thách đấu từ ván < 10 nước | Thách đấu vẫn chơi được nhưng **không** có lời mời thưởng | Có thưởng | |
| P4-26 | P1 | Một người nhận/được thưởng 6 lần trong ngày | Lần thứ 6 không có xu | Vẫn có xu | |
| P4-27 | P2 | Mở link thách đấu sau 3 ngày | Vẫn chơi được, không còn lời mời thưởng | Còn hiện thưởng | |

### Emote phòng 1v1

| ID | P | Làm | PASS khi | FAIL khi | KQ |
|---|---|---|---|---|---|
| P4-30 | P0 | A, B vào cùng phòng `/duel`, A bấm emote | B thấy emote của A gần như tức thì | B không thấy / lỗi permission | |
| P4-31 | P1 | A bấm liên tục | Trong 3 giây chỉ 1 emote đi qua; nút có trạng thái chờ | Spam được | |
| P4-32 | P1 | B bật cài đặt ẩn emote đối thủ | B không thấy emote của A nữa | Vẫn thấy | |
| P4-33 | P2 | Người xem (không phải 2 người chơi) | Không gửi được emote | Gửi được | |

### Tổng kết năm

| ID | P | Làm | PASS khi | FAIL khi | KQ |
|---|---|---|---|---|---|
| P4-40 | P1 | Hôm nay (30/10) mở `/recap/2026` | Báo "mở từ 15/12 tới 15/01"; trang chủ **không** có banner | Mở được / có banner | |
| P4-41 | P1 | **Từ 15/12**: mở `/recap/2026` | Số ván, điểm cao nhất, combo, số ngày chơi, chế độ yêu thích (có Xếp hạng); dòng "(mọi lúc)" cho chuỗi / Bậc / Đấu trường / sao | Số liệu 0 dù có chơi / lỗi | |
| P4-42 | P2 | Bấm Chia sẻ | Ảnh 1080×1080 đúng số liệu | Ảnh vỡ / sai | |

---

## Hồi quy (tính năng cũ không được hỏng)

| ID | P | Làm | PASS khi | FAIL khi | KQ |
|---|---|---|---|---|---|
| REG-01 | P0 | Daily `/play?daily=1` 3 lượt | Mốc ★, streak, BXH ngày như cũ; lượt 4 bị chặn | Hỏng daily | |
| REG-02 | P0 | 20 màn chơi `/levels` | Sao theo % nước như cũ | Sai sao | |
| REG-03 | P0 | Duel 1v1 phòng riêng (cả người xem) | Chạy như cũ, không tính hạng | Lỗi / bị tính LP | |
| REG-04 | P0 | Mất mạng giữa ván rồi có mạng lại | Ván trong hàng chờ tự nộp lên | Mất ván | |
| REG-05 | P1 | Mua theme bằng xu | Trừ xu đúng | Sai xu | |
| REG-06 | P1 | Điện thoại thật: dọc + ngang, iOS Safari | Không vỡ layout ở `/ranked`, `/arena`, `/season`, `/game/{id}` | Tràn ngang / nút bị che | |

---

## Tiêu chí release

- **Tất cả P0 PASS** → được merge vào `main` và deploy.
- P1 FAIL → ghi lại, sửa trước khi mở cho toàn bộ người chơi (có thể deploy nhưng chưa quảng bá).
- P2 FAIL → đưa vào backlog.
- Case phụ thuộc ngày (P3-03 ngày 01/11, P4-41/42 từ 15/12) → test khi tới ngày, không chặn release.
