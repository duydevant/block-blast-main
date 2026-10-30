#!/bin/sh
# Thay Vercel Cron khi chạy bằng Docker: gọi /api/cron/daily-reminders và /api/cron/rebuild-leaderboards của service `web` theo lịch.
# Mọi biến lấy từ env_file của compose: CRON_SECRET (bắt buộc), PORT, CRON_DAILY_REMINDERS_SCHEDULE (giờ UTC).
set -eu

if [ -z "${CRON_SECRET:-}" ]; then
  echo "[cron] CRON_SECRET chưa đặt -> tắt nhắc nhở hằng ngày" >&2
  exit 0
fi

schedule="${CRON_DAILY_REMINDERS_SCHEDULE:-0 12 * * *}"
url="http://web:${PORT:-3000}/api/cron/daily-reminders"
# Dựng lại top bảng phong độ (mặc định 00:05 giờ VN).
rebuild_schedule="${CRON_REBUILD_LEADERBOARDS_SCHEDULE:-5 17 * * *}"
rebuild_url="http://web:${PORT:-3000}/api/cron/rebuild-leaderboards"

# crond không truyền env của container cho job → ghi lệnh kèm header vào crontab (chỉ nằm trong container này).
job='%s wget -q -O - --header "Authorization: Bearer %s" --post-data "" %s > /proc/1/fd/1 2>&1\n'
{
  printf "$job" "$schedule" "$CRON_SECRET" "$url"
  printf "$job" "$rebuild_schedule" "$CRON_SECRET" "$rebuild_url"
} > /etc/crontabs/root
echo "[cron] daily reminders: '$schedule' (UTC) -> $url"
echo "[cron] rebuild leaderboards: '$rebuild_schedule' (UTC) -> $rebuild_url"
exec crond -f -l 8
