#!/bin/sh
# Chạy một lần mỗi `docker compose up`: deploy index + TTL Firestore, rules Firestore và rules Realtime Database
# từ file trong repo (repo là nguồn sự thật). Đăng nhập bằng chính service account Firebase Admin của app
# (FIREBASE_ADMIN_* trong file env) — không cần `firebase login`. Lệnh idempotent: chạy lại không đổi gì nếu file không đổi.
# Tắt: FIREBASE_AUTO_DEPLOY=0. Service account cần quyền IAM (một lần): xem docs/deployment-guide.md.
# `--non-interactive`: index có trên console mà không có trong file sẽ KHÔNG bị xoá.
set -eu

if [ "${FIREBASE_AUTO_DEPLOY:-1}" = "0" ]; then
  echo "[firebase-deploy] FIREBASE_AUTO_DEPLOY=0 -> bỏ qua"
  exit 0
fi
if [ -z "${FIREBASE_ADMIN_PROJECT_ID:-}" ] || [ -z "${FIREBASE_ADMIN_CLIENT_EMAIL:-}" ] || [ -z "${FIREBASE_ADMIN_PRIVATE_KEY:-}" ]; then
  echo "[firebase-deploy] thiếu FIREBASE_ADMIN_* -> bỏ qua" >&2
  exit 0
fi

# Dựng file key service account tạm từ env (key một dòng với "\n" escape như app đang dùng), xoá khi thoát.
key="$(mktemp)"
trap 'rm -f "$key"' EXIT INT TERM
node -e '
const env = process.env
require("fs").writeFileSync(process.argv[1], JSON.stringify({
  type: "service_account",
  project_id: env.FIREBASE_ADMIN_PROJECT_ID,
  client_email: env.FIREBASE_ADMIN_CLIENT_EMAIL,
  private_key: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
  token_uri: "https://oauth2.googleapis.com/token",
}), { mode: 0o600 })
' "$key"
export GOOGLE_APPLICATION_CREDENTIALS="$key"

cd /firebase
echo "[firebase-deploy] project ${FIREBASE_ADMIN_PROJECT_ID}: firestore:indexes, firestore:rules, database"
npx -y firebase-tools@15.33.0 deploy --only firestore:indexes,firestore:rules,database --project "$FIREBASE_ADMIN_PROJECT_ID" --non-interactive
