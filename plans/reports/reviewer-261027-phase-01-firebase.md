# Review: Phase 01 Firebase foundation (guest auth + ranked games)

## Findings

1. **MEDIUM: 401 counted as permanent rejection, so queued games are silently dropped.** `ranked-game-cloud-sync.ts:13-15,74` + `server/http/authenticated-json-route.ts:22-27`. `getAdminAuth()` (env check) and the `verifyIdToken` cert fetch both sit inside the try block, so a missing `FIREBASE_ADMIN_*` env or a Google cert-fetch blip returns 401 instead of 500. The client treats any non-429 4xx as final and calls `removePendingSubmission`. A bad deploy would wipe every user's queued games. The same thing happens on account switch: `auth.currentUser` changes before `useFirebaseAuthStore` does, so `fetchJsonWithFirebaseIdToken` sends user A's item with B's token (404) or with no user (client-side 401), and the item is dropped. Fix: retry 401, 5xx and network errors; drop only on 404, 409 and 422; return 500 for admin init errors.

2. **MEDIUM: stash re-locks for one ranked game after it is first unlocked.** `ranked-game-cloud-sync.ts:46,98` + `ranked-game-session-store.ts:35`. The next seed is prefetched as soon as game N starts, using `stashUnlocked` from the start of N and the server stats from before N. If N is the game that unlocks the stash (score >= 300), N+1 starts with the stash locked. The unranked path keeps it (`block-puzzle-game-store.ts:64`). This is a UX regression, not a divergence. Fix: issue a new seed when local `stashUnlocked` no longer matches `nextRankedSeed.stashUnlocked`.

3. **LOW: games longer than 3000 actions are lost.** `ranked-game-request-schemas.ts:30`. The client records with no cap, the zod `.max` returns 400, and the client drops the game. The best players' games are the ones affected.

4. **LOW: multiple tabs overwrite each other's queue.** Zustand `persist` writes the whole state per tab, so both tabs adopt the same `nextRankedSeed` and the last writer wipes the other tab's `pendingSubmissions`.

5. **LOW / design: the score can be gamed but not forged.** The seed is known in advance and the engine is public and deterministic, so a bot can produce an optimal log. A player can also open many sessions and submit only the best one, since unsubmitted sessions count for nothing. `/api/games/start` has no rate limit and writes one doc per call (cost abuse through free anonymous uids). While `gamesPlayed===0`, the `stashUnlocked` the client claims is trusted (documented as intended).

## No issues found
- uid spoofing: uid comes only from the token, and another user's session returns 404.
- Double submit: the transaction plus the status check gives 409. Rejected logs are committed as `rejected`.
- Body size: content-length plus text-length checks; the action schema is tight.
- Client/server divergence: RESTORE normalization is effectively the identity on legit states. Tutorial and `finishTutorial` never replace a ranked game. Auto-adopt only happens for untouched games with no session, and REVIVE is recorded.
- Tick loop: guards against re-entrancy and dedupes in-flight requests. Cooldown prevents retry storms. Disposal is handled.
- Transaction usage: `getAll` before writes, writes go through `tx`, and a retry re-runs the deterministic replay. Minor: replay could run before the transaction to hold the lock for less time.
- Next 16: route handlers, `NEXT_PUBLIC_*` inlining and the node runtime are fine.
- Firestore and RTDB rules deny all access.

## Unresolved questions
- Is the 3000-action cap meant to also cap the length of a ranked game?
