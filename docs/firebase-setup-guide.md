# Hướng dẫn cấu hình Firebase

Làm theo thứ tự. Xong thì điền **mục 9** và gửi lại. Phần bí mật (private key) **không gửi qua chat** — tự dán vào `.env.local`.

Thiết kế dữ liệu: `plans/261027-1800-retention-acquisition-features-firebase/reports/firebase-data-architecture.md`.

## 1. Tạo project

1. Vào https://console.firebase.google.com → **Create a project**.
2. Đặt tên (VD `block-puzzle-prod`). Nên tạo thêm 1 project riêng cho dev/test (`block-puzzle-dev`) để thử không đụng dữ liệu thật — làm lại các bước dưới cho project đó.
3. Google Analytics: **tắt** (dự án không dùng) → Create.

## 2. Đăng ký Web App

1. Trang Project Overview → biểu tượng **`</>`** (Web).
2. Nickname: `web`. **Không** tick "Firebase Hosting" (host Next.js ở chỗ khác, xem câu hỏi ở mục 10).
3. Copy object `firebaseConfig` hiện ra (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId). Mấy giá trị này **công khai** (nằm trong code client), gửi qua chat được.

Lấy lại sau: ⚙️ Project settings → General → Your apps.

## 3. Authentication

1. Build → **Authentication** → Get started.
2. Tab **Sign-in method**:
   - **Anonymous** → Enable → Save.
   - **Google** → Enable → chọn *Project support email* → Save.
3. Tab **Settings → Authorized domains**: đã có `localhost`; **Add domain** cho domain production (VD `blockpuzzle.vn`) và domain preview nếu có (VD `*.vercel.app` thì phải thêm từng domain cụ thể).

## 4. Cloud Firestore

1. Build → **Firestore Database** → Create database.
2. Edition: **Standard**. Database ID: để `(default)`.
3. Location: **asia-southeast1 (Singapore)**. ⚠️ Không đổi được sau khi tạo.
4. Chọn **Start in production mode** (khoá hết, rules thật sẽ deploy từ repo).

## 5. Realtime Database

1. Build → **Realtime Database** → Create Database.
2. Location: **Singapore (asia-southeast1)**.
3. Chọn **Start in locked mode**.
4. Copy URL ở đầu tab Data, dạng `https://<project-id>-default-rtdb.asia-southeast1.firebasedatabase.app`.

## 6. Service account (cho server Next.js)

Server dùng Admin SDK để kiểm tra điểm, ghi BXH, cộng xu.

1. ⚙️ Project settings → **Service accounts** → **Generate new private key** → tải file JSON.
2. Mở file, lấy 3 giá trị `project_id`, `client_email`, `private_key`.
3. Dán vào `.env.local` (mẫu ở mục 8). **Không** commit file JSON, **không** gửi qua chat. Xoá file JSON sau khi dán xong (hoặc cất chỗ an toàn).

## 7. Firebase CLI (để deploy security rules)

```bash
npm install -g firebase-tools
firebase login
firebase projects:list   # kiểm tra thấy project vừa tạo
```

Repo đã có `firebase.json`, `.firebaserc` (project `block-puzzle-prod-40242`), `firestore.rules`, `database.rules.json`. Deploy rules (chạy trong thư mục `block-blast-main`):

```bash
firebase deploy --only firestore,database
```

Rules hiện chặn mọi truy cập trực tiếp từ client — app đi qua API route dùng Admin SDK.

### TTL cho ván chưa nộp (tuỳ chọn, nên làm)

Firestore → **TTL** (tab bên trái của Firestore Database) → **Create policy** → Collection group `gameSessions`, Timestamp field `expireAt` → Create. Session không nộp sẽ tự xoá sau 30 ngày (không tốn phí ghi).

## 8. Biến môi trường

Thêm vào `.env.local` (mẫu cũng có trong `.env.example`):

```bash
# Client — công khai
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_DATABASE_URL=

# Server — BÍ MẬT, chỉ ở .env.local / biến môi trường của nơi host
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
# Giữ nguyên dấu ngoặc kép và các ký tự \n trong key
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
# Bí mật tạo seed thử thách hằng ngày: chuỗi ngẫu nhiên dài, KHÔNG đổi sau khi ra mắt
# (đổi = seed hôm nay đổi giữa ngày). Tạo bằng: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
DAILY_SEED_SECRET=

# Web Push nhắc nhở (phase 05) — tạo khoá: npx web-push generate-vapid-keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
# Liên hệ cho dịch vụ push: mailto:... hoặc https URL; trống = NEXT_PUBLIC_SITE_URL (nếu https)
VAPID_SUBJECT=
# Cron gọi /api/cron/daily-reminders với header Authorization: Bearer <CRON_SECRET>
CRON_SECRET=
```

### Cron nhắc nhở hằng ngày

- **Vercel**: `vercel.json` đã khai báo cron `0 12 * * *` (19:00 giờ VN); Vercel tự gửi `Authorization: Bearer $CRON_SECRET` khi biến `CRON_SECRET` có trong project.
- **VPS**: thêm vào crontab (giờ UTC):
  ```
  0 12 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/daily-reminders
  ```
- Đổi khoá VAPID = mọi máy đã bật nhắc nhở phải bật lại → tạo một lần, giữ cố định.

Khi deploy: khai báo đủ các biến trên ở dashboard của nơi host. `DAILY_SEED_SECRET` ở host phải giống giá trị dùng khi test nếu muốn giữ seed ngày đang chạy.

## 9. Gửi lại cho tao

```
Project ID (prod):        
Project ID (dev, nếu có): 
firebaseConfig (prod):    <dán nguyên object>
firebaseConfig (dev):     <dán nguyên object>
Realtime DB URL:          
Domain production:        
Nơi host Next.js:         Vercel / VPS / Firebase App Hosting / khác: ___
Đã bật: [ ] Anonymous  [ ] Google  [ ] Firestore Singapore  [ ] RTDB Singapore
Đã dán service account vào .env.local: [ ] có
Đã cài + login Firebase CLI: [ ] có
```

## 10. Chưa cần làm bây giờ (sẽ báo khi tới giai đoạn)

| Việc | Khi nào | Ghi chú |
|---|---|---|
| Nâng gói **Blaze** + đặt **Budget alert** (VD $10/tháng) | Ra mắt 1v1/presence (RTDB Spark chỉ 100 kết nối đồng thời) hoặc vượt free Firestore | Blaze vẫn giữ hạn mức free, chỉ trả phần vượt |
| **App Check** (reCAPTCHA Enterprise) | Sau khi có BXH công khai | Chặn gọi API từ script ngoài trình duyệt |
| **Remote Config** | Giai đoạn sự kiện | Không cần config trước |
| Cloud Storage | Không dùng | Xem lý do trong tài liệu kiến trúc |
