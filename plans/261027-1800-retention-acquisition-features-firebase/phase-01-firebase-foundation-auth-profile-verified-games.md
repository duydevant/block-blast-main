# Phase 01 — Firebase nền tảng: khách ẩn danh, profile, ván được server kiểm tra

## Context Links
- `reports/firebase-data-architecture.md`, `reports/feature-ideas-retention-acquisition.md`
- `docs/firebase-setup-guide.md`
- Next 16 docs: `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`, `.../02-guides/environment-variables.md`
- Engine: `modules/block-puzzle/engine/game-state-reducer.ts`, `power-up-rules.ts`, `power-up-replay-determinism.test.ts`

## Overview
- Priority: P0 (mọi phase sau phụ thuộc)
- Status: **Done** (2026-10-27). Khác plan: profile đọc/ghi qua API route (client không dùng Firestore SDK, rules chặn hết → không cần test rules với emulator); code server nằm ở `server/`; không tăng `SAVE_VERSION` (field mới tuỳ chọn); liên kết Google chỉ dùng popup (redirect không ổn định khi host khác firebaseapp.com). Còn lại: deploy rules, bật TTL `gameSessions.expireAt`, test liên kết Google bằng tài khoản thật.
- Vào game là có `uid` khách; liên kết Google giữ nguyên dữ liệu; mỗi ván online được server chơi lại để tính điểm thật → thống kê cloud đáng tin, làm nền cho BXH ở phase 02.

## Key Insights
- Engine tất định: `seed` + danh sách action → cùng state. Server import thẳng `gameReducer` để replay, không viết lại luật.
- `stashUnlocked` mang sang ván sau (mở ở 300 điểm hoặc khi revive) → server phải biết cờ này lúc bắt đầu ván: lưu ở `users/{uid}.stashUnlocked`, server cập nhật sau mỗi ván đã kiểm tra.
- Store hiện tạo seed ở client (`randomSeed`). Ván online lấy seed từ server; mất mạng thì vẫn chơi với seed local nhưng ván đó **không tính** lên cloud.
- `RESTORE` chuẩn hoá state khi load save. Cần xác nhận nó không đổi state hợp lệ (idempotent); nếu có đổi thì phải ghi `RESTORE` vào log để server replay đúng.
- Iframe/portal có thể chặn popup và IndexedDB → liên kết Google cần fallback redirect; Firestore dùng memory cache (không bật persistent cache).

## Requirements
Functional
- Tự `signInAnonymously` khi chưa có user; lỗi mạng/auth không chặn việc chơi.
- Nút "Lưu tiến trình bằng Google": `linkWithPopup` → fallback `linkWithRedirect`. Nếu Google đã gắn tài khoản khác (`auth/credential-already-in-use`) → hỏi người chơi, chuyển sang tài khoản đó.
- `POST /api/games/start` → `{ gameId, seed, stashUnlocked }`. `POST /api/games/submit` `{ gameId, actions[] }` → server replay, cập nhật `stats`, `stashUnlocked`, trả về điểm đã kiểm tra.
- Profile hiển thị: tên, khách/Google, thống kê cloud. Đổi tên hiển thị (2–16 ký tự).
Non-functional
- Không thêm độ trễ trước khi vẽ bàn (auth + start chạy song song với render).
- Mỗi ván ≤ 4 thao tác Firestore. Body submit ≤ 64KB, ≤ 3.000 action.

## Architecture
```
Client                                     Server (Next route handler, runtime nodejs)
FirebaseAuthProvider ── onAuthStateChanged ─┐
  └ chưa có user → signInAnonymously        │ ID token (Authorization: Bearer)
game store: startNewGame ──────────────────► POST /api/games/start
  ├ ok   → seed server, gameId, mode=ranked   → gameSessions/{gameId} {uid, seed, stashUnlocked, status:"open"}
  └ fail → seed local, mode=offline
  mỗi nước → actionLog.push(action)
  game over (ranked) ──────────────────────► POST /api/games/submit
                                              verifyIdToken → transaction:
                                              session open & uid khớp → replay(seed, flags, actions)
                                              → session.status="done", score
                                              → users/{uid}.stats/stashUnlocked
```
Firestore mới: `gameSessions/{gameId}` (chỉ server đọc/ghi; TTL policy xoá sau 30 ngày).

## Related Code Files
Tạo
- `lib/firebase/firebase-client-app.ts` — init app/auth/firestore/database (singleton, chỉ client)
- `lib/firebase/firebase-admin-app.ts` — `import "server-only"`, cert từ env
- `lib/firebase/verify-firebase-id-token-from-request.ts`
- `lib/auth/firebase-auth-store.ts` — zustand: `user`, `status`, `isAnonymous`
- `lib/auth/link-anonymous-account-with-google.ts`
- `providers/firebase-auth-provider.tsx`
- `modules/block-puzzle/engine/replay-recorded-game-actions.ts` + `.test.ts` — thuần TS, dùng chung client/server
- `modules/player-profile/` — `player-profile-types.ts`, `player-profile-schema.ts` (zod), `use-player-profile-snapshot.ts`, `profile-account-card.tsx`
- `app/api/games/start/route.ts`, `app/api/games/submit/route.ts`, `app/api/profile/route.ts` (PATCH tên)
- `server/games/` — `create-game-session.ts`, `verify-and-record-submitted-game.ts` (logic tách khỏi route để test)
- `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`, `database.rules.json`
- `tests/firestore-security-rules.test.ts` (chạy với emulator)
Sửa
- `modules/block-puzzle/store/block-puzzle-game-store.ts` — `gameId`, `mode`, `actionLog`; ghi action ở mỗi hành động; `SAVE_VERSION` → 4
- `modules/block-puzzle/store/saved-game-schema.ts` — validate field mới
- `modules/block-puzzle/components/game-dialogs.tsx` — game over hiện điểm đã kiểm tra / "chơi offline, không tính"
- `components/layout/user-nav-menu.tsx`, `app/(main)/profile/page.tsx`, `app/(auth)/sign-in/page.tsx` — dùng Firebase
- `providers/` root provider, `.env.example`, `docs/system-architecture.md`, `README.md`
Xoá (nếu xác nhận không còn BE riêng)
- `lib/api/auth.api.ts`, `lib/api/api-client.ts`, `lib/api/types.ts`, `lib/store/auth.store.ts`, `app/(auth)/sign-up/`

## Implementation Steps
1. Cài `firebase`, `firebase-admin`, `server-only` (bản mới nhất, kiểm tra peer với Next 16 / React 19). Đọc docs Next 16 về route handler + env trước khi viết.
2. Viết `replay-recorded-game-actions.ts`: `(seed, { stashUnlocked }, actions) → GameState | { error }`; từ chối action không hợp lệ (reducer trả về state cũ = gian lận/lỗi). Test: replay khớp state chơi thật, kể cả stash/replace/revive; kiểm tra `RESTORE` idempotent.
3. Firebase client + admin + auth store + provider; tự đăng nhập khách.
4. Route `games/start`, `games/submit` (transaction, 1 lần submit/gameId, `runtime = "nodejs"`). Logic ở `server/games/`, test bằng vitest với Firestore emulator.
5. Store game: `actionLog`, `mode`, gọi start khi ván mới (không chặn UI), submit khi game over; retry submit khi có mạng lại (giữ trong save).
6. Rules + indexes + TTL `gameSessions`; deploy bằng `firebase deploy --only firestore,database`.
7. UI: menu tài khoản, card profile, nút liên kết Google, đổi tên.
8. `npx tsc --noEmit`, `npm run lint`, `npm test`, `npx next build --webpack`; code review; cập nhật docs.

## Todo List
- [ ] Cài package + module firebase client/admin
- [ ] Replay engine + test
- [ ] Auth store/provider + liên kết Google (popup/redirect/conflict)
- [ ] API start/submit + test với emulator
- [ ] Action log trong store, SAVE_VERSION 4
- [ ] Rules Firestore/RTDB + test rules + deploy
- [ ] UI profile/menu, bỏ scaffold auth cũ
- [ ] Build/lint/test, review, docs

## Success Criteria
- Mở `/play` lần đầu: có `uid` khách trong Auth console, bàn vẽ ngay không chờ mạng.
- Hết ván online → `users/{uid}.stats` cập nhật đúng điểm server tính. Sửa request (điểm/action giả) → bị từ chối.
- Liên kết Google rồi mở trên máy khác → thấy cùng thống kê.
- Tắt mạng vẫn chơi trọn ván.
- Test rules: client không ghi được `stats`, `coins`, `gameSessions`.

## Risk Assessment
- Replay lệch client/server (state ngầm ngoài reducer) → test so khớp + giữ mọi biến đổi state trong reducer.
- Popup Google bị chặn trong iframe → fallback redirect; ẩn nút nếu cả hai bất khả.
- Admin SDK nặng → chỉ import trong route handler (`server-only`), không lọt vào bundle client.
- Emulator cần Java 11+ trên máy dev/CI.

## Security Considerations
- Mọi API verify ID token; uid lấy từ token, không từ body.
- Field kinh tế/thống kê chỉ Admin SDK ghi. Private key chỉ ở env server.
- Giới hạn kích thước body + số action; 1 submit/gameId (transaction).

## Next Steps
- Phase 02 dùng `games/start` với `mode: "daily"` và ghi BXH trong cùng transaction submit.
