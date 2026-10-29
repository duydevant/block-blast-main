# Phase 02: Bỏ sự kiện tuần

## Overview

- **Priority:** cao.
- **Status:** Done.
- **Mô tả:** xoá chế độ event ở mọi tầng.
  - Ván / save cũ có `variantRun.kind === "event"` bị bỏ khi parse.
  - Session event cũ nộp lên thì replay bị từ chối.

## Files

- **Xoá:**
  - `modules/game-modes/weekly-event-catalog.ts`, `event-rewards.ts`, `use-event-queries.ts`, `components/weekly-event-page.tsx`
  - `server/events/event-rewards-store.ts`
  - `server/daily/current-weekly-event.ts`
  - `app/api/events/*`
  - `app/(main)/event/page.tsx`: thay bằng redirect về `/daily`.
- **Sửa:**
  - `variant-run.ts`, `start-variant-game.ts`, `special-game-modes.ts`, `parked-mode-games.ts`
  - `ranked-game-cloud-state.ts`
  - `create-variant-game-session.ts`, `stored-game-session.ts`, `ranked-game-request-schemas.ts`
  - `leaderboard-board-ids.ts`, `leaderboard-types.ts` (tab "event" → "challenge")
  - `home-mode-grid.tsx`, `game-over-variant-section.tsx`, `variant-mode-badge.tsx`
  - `referral-invite-card.tsx`, `sitemap.ts`
  - translations, test liên quan.

## Success criteria

- `grep` không còn tham chiếu event (trừ ghi chú lịch sử trong docs / plans).
- tsc, eslint, test sạch.
