# Đề xuất tính năng: giữ chân + kéo người chơi mới

Lợi thế sẵn có cần tận dụng: engine thuần TS + RNG có seed → **cùng seed + cùng nước đi = cùng điểm**. Nhờ vậy làm được: thử thách hằng ngày công bằng, thách đấu bạn bè cùng ván, và **server tự chơi lại (replay) để kiểm tra điểm** (chống hack bảng xếp hạng). Đa số ý tưởng bên dưới dựa vào điểm này.

Ký hiệu: 🔁 = giữ chân (retention), 📣 = kéo người mới (acquisition). Công sức: S (≤2 ngày), M (3–5 ngày), L (>1 tuần).

## A. Nền tảng (bắt buộc làm trước)

| # | Tính năng | Phục vụ | Cơ chế |
|---|---|---|---|
| A1 | **Tài khoản khách tự động** (Firebase Anonymous) + nút "Lưu tiến trình bằng Google" | 🔁 | Vào game là có `uid` ngay, không bắt đăng ký (không mất người ở bước login). Khi đã có thứ đáng giữ (streak, theme, kỷ lục) mới mời liên kết Google → giữ nguyên `uid` và dữ liệu. Người đã liên kết = khó bỏ đi (switching cost). |
| A2 | **Cloud save + đồng bộ nhiều máy** | 🔁 | Kỷ lục, thống kê, theme, streak lưu Firestore. Đổi máy/xoá cache không mất gì → bớt lý do "chơi lại từ đầu thì thôi bỏ". |
| ~~A3~~ | ~~Đo lường bằng Analytics~~ — **bỏ** (đã chốt không dùng Analytics) | — | Có thể đếm sơ bộ từ dữ liệu Firestore (số ván, daily, thách đấu) khi cần. |

## B. Giữ chân người đã chơi 🔁

| # | Tính năng | Phục vụ | Cơ chế | Công sức |
|---|---|---|---|---|
| B1 | **Thử thách hằng ngày** (Daily Challenge) | Lý do quay lại **mỗi ngày** | Seed theo ngày → mọi người cùng chuỗi khối. Mỗi ngày 1 ván tính điểm (chơi thử thoải mái). Có BXH ngày riêng → ai cũng có cơ hội top mỗi ngày, không chỉ người chơi lâu. | M |
| B2 | **Chuỗi ngày chơi** (Streak) + "khiên giữ chuỗi" | Thói quen hằng ngày | Đếm số ngày liên tiếp chơi daily. Sợ mất chuỗi (loss aversion) là động lực mạnh nhất để mở app. Khiên (nhận từ nhiệm vụ) cứu 1 ngày lỡ → bớt bỏ cuộc khi đứt chuỗi. | S |
| B3 | **Nhiệm vụ ngày** (3 nhiệm vụ/ngày) | Mục tiêu ngắn, đa dạng cách chơi | VD: "Xoá 15 dòng", "Combo x4", "Đạt 1.000 điểm 1 ván". Hoàn thành → xu + XP. Người chơi kém vẫn có thứ để đạt (không chỉ đua điểm). | M |
| B4 | **Cấp độ (XP) + xu + mở khoá theme** | Cảm giác tiến bộ dài hạn | Hiện 4 theme đang free → biến thành phần thưởng: mở bằng cấp độ hoặc xu. Thêm theme mới = thêm mục tiêu. Chỉ bán **đồ ngắm** (cosmetic), không bán lợi thế → BXH vẫn công bằng. | M |
| B5 | **Thành tích** (Achievements/huy hiệu) | Mục tiêu dài hạn + khoe | "Dọn sạch bàn 10 lần", "Combo x8", "Streak 30 ngày". Hiện trong profile, hiện lên thẻ share. | S |
| B6 | **Bảng xếp hạng**: ngày / tuần / mọi lúc / bạn bè | Cạnh tranh | BXH tuần reset mỗi thứ 2 → người mới vẫn có cửa. Hiện "Bạn hạng #1.234 — cần 120 điểm để lên #1.100" (mục tiêu gần, cụ thể). Điểm phải qua server replay mới lên bảng. | M |
| B7 | **Nhắc nhở** (Web Push) | Kéo người quên quay lại | "Chuỗi 6 ngày của bạn sắp mất!", "Thử thách hôm nay đã có". Chỉ xin quyền sau khi người chơi đã có streak ≥2 (xin sớm bị từ chối nhiều). iOS chỉ nhận push khi đã cài PWA. | M |
| B8 | **PWA** (cài ra màn hình chính, chơi offline) | Có icon trên máy = nhớ tới game | Manifest + service worker. Nút "Cài game" hiện sau ván thứ 3. | S |
| B9 | **Sự kiện tuần / mùa** | Nội dung mới định kỳ | Tuần có luật đặc biệt (bàn có sẵn chướng ngại, chỉ khối nhỏ…), theme giới hạn thời gian. Cấu hình bằng Remote Config → đổi sự kiện không cần deploy. | L |
| B10 | **Chế độ màn chơi** (Adventure: 100+ màn có mục tiêu) | Nội dung dài hạn cho người chán chế độ vô tận | Bàn khởi đầu dựng sẵn + mục tiêu (xoá X ô đặc biệt trong Y nước). Tốn công thiết kế màn → để sau khi đo được retention từ B1–B6. | L |

## C. Kéo người chơi mới 📣

| # | Tính năng | Phục vụ | Cơ chế | Công sức |
|---|---|---|---|---|
| C1 | **Thẻ kết quả để share** | Mỗi ván là 1 quảng cáo miễn phí | Game over → tạo ảnh (canvas) gồm điểm, combo, bàn cuối, streak + link. Nút share qua Web Share API (Zalo/Messenger/FB trên điện thoại), fallback copy link. Daily thì share kiểu "lưới emoji" không lộ lời giải. | S |
| C2 | **Thách đấu bạn bè cùng ván** (async) | Vòng lan truyền (viral loop) | Share link `/play?c=<id>` → bạn mở ra chơi **đúng chuỗi khối đó** (cùng seed), xong thấy so sánh "Bạn 1.820 vs Duy 2.340". Người nhận gần như chắc chắn chơi thử + share lại để phục thù. Không cần đăng ký để chơi. | M |
| C3 | **Ảnh preview động cho link** (Open Graph) | Tăng tỉ lệ click khi share | Link thách đấu/daily hiện ảnh "Duy thách bạn vượt 2.340 điểm" khi dán vào Zalo/FB (Next.js `next/og`). Link trơn ít người bấm. | S |
| C4 | **Mời bạn** (referral) | Thưởng cho người mời | Mỗi user có mã mời. Bạn mới chơi xong 3 ván → cả 2 nhận theme độc quyền/xu. Server ghi nhận, không cho client tự cộng. | M |
| C5 | **Đấu 1v1 realtime** | Tính xã hội + lý do rủ bạn | Hai người cùng seed, thấy điểm đối thủ nhảy theo thời gian thực, ai game over trước thua (hoặc hết 3 phút). Ghép ngẫu nhiên hoặc phòng riêng qua link. Đây là chỗ dùng Realtime Database. | L |
| C6 | **"X người đang chơi"** | Bằng chứng xã hội (social proof) cho người mới | Presence trên Realtime Database. Hiện ở trang chủ + màn ghép trận. | S |
| C7 | **SEO trang công khai** | Người mới tìm thấy qua Google | Trang BXH công khai, trang daily theo ngày, trang chủ đa ngôn ngữ (đã có en/vi) có nội dung (cách chơi, mẹo). Next.js render server sẵn. | S–M |
| C8 | **Lên các cổng game** (CrazyGames, GameDistribution…) | Kênh người chơi có sẵn | Không phải tính năng code chính, nhưng cần: build chạy trong iframe (đã có fallback storage), tắt login bắt buộc. Cần kiểm tra quy định từng cổng về login/link ngoài. | M |

## Thứ tự đề xuất

| Giai đoạn | Nội dung | Lý do |
|---|---|---|
| 1 | A1, A2 | Mọi thứ khác cần `uid` + chỗ lưu |
| 2 | B1, B2, B6 (BXH ngày/tuần) + API replay chống hack | Vòng giữ chân hằng ngày, tận dụng seed |
| 3 | C1, C2, C3 | Vòng lan truyền rẻ nhất, dựa trên seed |
| 4 | B3, B4, B5, C4 | Kinh tế xu/XP/theme, thưởng mời bạn |
| 5 | B7, B8, C6, C7 | Push, PWA, presence, SEO |
| 6 | C5, B9, B10 | Nặng nhất — làm khi đã có số liệu từ 1–5 |

Chỉ số theo dõi: D1/D7/D30 retention, % người chơi daily, độ dài streak TB, % ván được share, số người mới / 1 link share (K-factor), % khách đã liên kết Google.
