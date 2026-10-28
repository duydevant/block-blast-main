# syntax=docker/dockerfile:1.7
# Image production (Next.js output standalone). Không có giá trị env nào nằm trong image:
# - Lúc build: file env được mount dạng build secret `app_env` thành .env.production.local, chỉ tồn tại trong
#   bước `npm run build` (Next nhúng NEXT_PUBLIC_* vào JS; standalone chỉ copy .env/.env.production nên file này không theo ra).
# - Lúc chạy: biến server (Firebase Admin, VAPID, CRON_SECRET...) truyền qua env_file của docker compose.
ARG NODE_VERSION=22-alpine

FROM node:${NODE_VERSION} AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

FROM node:${NODE_VERSION} AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN --mount=type=secret,id=app_env,target=/app/.env.production.local,required=true npm run build

FROM node:${NODE_VERSION} AS runner
WORKDIR /app
# HOSTNAME=0.0.0.0: Docker tự đặt HOSTNAME = id container, server.js sẽ chỉ nghe trên IP đó nếu không ghi đè.
# PORT mặc định 3000; đặt PORT trong file env để đổi (docker-compose.yml map cổng host theo cùng biến).
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "server.js"]
