#!/bin/sh
# Thay Vercel Cron khi chạy bằng Docker: gọi /api/cron/daily-reminders của service `web` theo lịch.
# Mọi biến lấy từ env_file của compose: CRON_SECRET (bắt buộc), PORT, CRON_DAILY_REMINDERS_SCHEDULE (giờ UTC).
set -eu

if [ -z "${CRON_SECRET:-}" ]; then
  echo "[cron] CRON_SECRET chưa đặt -> tắt nhắc nhở hằng ngày" >&2
  exit 0
fi

schedule="${CRON_DAILY_REMINDERS_SCHEDULE:-0 12 * * *}"
url="http://web:${PORT:-3000}/api/cron/daily-reminders"

# crond không truyền env của container cho job → ghi lệnh kèm header vào crontab (chỉ nằm trong container này).
printf '%s wget -q -O - --header "Authorization: Bearer %s" --post-data "" %s > /proc/1/fd/1 2>&1\n' \
  "$schedule" "$CRON_SECRET" "$url" > /etc/crontabs/root
echo "[cron] daily reminders: '$schedule' (UTC) -> $url"
exec crond -f -l 8
