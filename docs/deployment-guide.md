# Deploy bằng Docker

App build thành image Next.js `output: "standalone"` (Node 22 alpine, chạy user `nextjs`). Không có giá trị env nào nằm trong `Dockerfile`, `docker-compose.yml` hay image: mọi biến đọc từ một file env.

## File

| File | Vai trò |
| --- | --- |
| `Dockerfile` | 3 stage: `deps` (npm ci) → `builder` (next build) → `runner` (server.js + static, healthcheck) |
| `docker-compose.yml` | service `web` (app) + `cron` (nhắc nhở push hằng ngày) |
| `docker/daily-reminder-cron.sh` | crond trong alpine gọi `/api/cron/daily-reminders` với `Authorization: Bearer $CRON_SECRET` |
| `.dockerignore` | loại `.env*`, khoá service account, `node_modules`, `.next`, docs/plans khỏi build context |

## Biến môi trường đi đâu

- **Lúc build:** compose mount file env làm build secret `app_env` thành `.env.production.local`, chỉ tồn tại trong bước `npm run build`. Next nhúng `NEXT_PUBLIC_*` vào JS. Standalone chỉ copy `.env` và `.env.production`, nên file này không lọt vào image.
  - Đổi `NEXT_PUBLIC_*` (domain, Firebase web config, VAPID public key) thì phải **build lại**.
- **Lúc chạy:** `env_file` truyền mọi biến vào container: Firebase Admin, `DAILY_SEED_SECRET`, `VAPID_*`, `CRON_SECRET`.
  - Đổi các biến này chỉ cần `docker compose up -d`, không phải build lại.

Biến dành cho Docker (khai báo trong cùng file env, mẫu ở `.env.example`):

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `PORT` | 3000 | cổng app nghe trong container (web và cron dùng chung) |
| `HOST_PORT` | 3000 | cổng mở trên máy host |
| `HOST_IP` | 0.0.0.0 | IP host bind cổng; `127.0.0.1` khi đứng sau nginx/caddy |
| `IMAGE_NAME` / `IMAGE_TAG` | block-puzzle-web / latest | tên image build ra |
| `CRON_DAILY_REMINDERS_SCHEDULE` | `0 12 * * *` | lịch cron theo giờ UTC (= 19:00 giờ VN) |
| `ENV_FILE` | `.env` | đặt ở shell nếu dùng file env khác |

## Chạy

```bash
cp .env.example .env        # điền giá trị thật; NEXT_PUBLIC_SITE_URL = domain production
docker compose up -d --build
docker compose ps           # web: healthy
docker compose logs -f web
```

Dùng file env khác (VD `.env.production`) cho cả biến cổng lẫn biến app:

```bash
ENV_FILE=.env.production docker compose --env-file .env.production up -d --build
```

Cập nhật bản mới: `git pull && docker compose up -d --build`.

## Lưu ý

- Cần Docker Compose v2 có BuildKit (build secret).
- `CRON_SECRET` để trống thì service `cron` tự thoát (exit 0), `web` vẫn chạy bình thường. `CRON_SECRET` không được chứa ký tự `%`, vì crontab hiểu `%` là xuống dòng.
- Đứng sau reverse proxy: đặt `HOST_IP=127.0.0.1` và cho proxy trỏ `http://127.0.0.1:$HOST_PORT`. Proxy phải bật HTTPS, vì Web Push và đăng nhập Google cần HTTPS.
- Firebase Auth → **Authorized domains**: thêm domain production (xem `firebase-setup-guide.md`).
- Không deploy trên Vercel thì `vercel.json` (cron của Vercel) không có tác dụng; service `cron` thay cho nó.

## Tự deploy index / TTL / rules Firebase

Service `firebase-deploy` chạy một lần mỗi `docker compose up`, deploy `firestore.indexes.json` (index + TTL), `firestore.rules` và `database.rules.json` lên project `FIREBASE_ADMIN_PROJECT_ID` bằng `firebase-tools@15.33.0`. Không cần `firebase login`: nó dùng service account Firebase Admin trong file env. Chạy lại không đổi gì nếu file không đổi; index có trên console mà không có trong file sẽ **không** bị xoá. Lỗi deploy không chặn `web`. Xem log bằng `docker compose logs firebase-deploy`. Tắt bằng `FIREBASE_AUTO_DEPLOY=0`.

Cấp quyền một lần: Google Cloud Console → IAM → service account trong `FIREBASE_ADMIN_CLIENT_EMAIL` (dạng `firebase-adminsdk-…@<project>.iam.gserviceaccount.com`) → thêm role:

- **Cloud Datastore Index Admin** (index + TTL Firestore)
- **Firebase Rules Admin** (rules Firestore)
- **Firebase Realtime Database Admin** (rules RTDB)

Thiếu quyền thì log báo `403` / `PERMISSION_DENIED`; app vẫn chạy, chỉ là index/rules chưa được cập nhật.
