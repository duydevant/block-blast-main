# Review: phase 06 duels / weekly events / levels (uncommitted)

Verified: `tsc --noEmit` clean, vitest 258/258 pass, all t() keys resolve. Replay variant derivation (stored-game-session.ts) is server-side only; no client-supplied variant path found. Firestore tx read-before-write ordering OK in record-submitted-ranked-game.ts, join, create(rematch), getDuel finalize. Both-submit-at-once is serialized by the duel doc (retry sees other result -> finish). RTDB rules: no hole found (state is admin-only; live/$uid limited to self + member; extra keys rejected).

## Findings (ranked)

1. MED-HIGH (conf 85) Irreversible duel forfeit from client clock skew. modules/duel/components/duel-hud.tsx:30-37 + modules/duel/use-duel-room.ts:92-97.
   useServerNow starts with serverOffset=0 until RTDB `.info/serverTimeOffset` arrives (or forever if RTDB unconfigured/blocked). If device clock is ahead of server by > remaining time, `timeLeft<=0` on first render -> endVariantRun() sets isGameOver+reviveUsed -> 0 moves -> server marks "abandoned", no duel result = loss. Same offset-0 use in duel-room-view.tsx auto-navigate window.
   Fix: only treat timeUp / auto-navigate when `room.loaded` and offset is known (or derive offset from API response `Date` header / add `serverNow` to GET /api/duels/[id] and startDuelGame response).

2. MED (conf 80) Leaving /play mid-duel = forfeit. endVariantRun on time-up lives only in DuelHud (mounted on /play); submission needs game.isGameOver && reviveUsed (ranked-game-cloud-sync.ts:~113). If player navigates to /duel/[id] or closes tab, nothing ends/submits the run; when they return after endsAt+60s grace (DUEL_SUBMIT_GRACE_MS) record-duel-result.ts:~21 drops the score. Room view also hides "go play" after endsAt.
   Fix: run the time-up effect (or a small hook) from the game store level/room view too, or end the run on pagehide/visibility; consider larger grace for pending offline submissions.

3. MED (conf 75) Duel room finalize is one-shot and can wedge. duel-room-view.tsx:~62 `finalizeRequested` ref set before fetch, never retried on failure or when server clock still says not overdue (client offset vs Next server clock differ by ms-hundreds ms; `now` ticks 250ms). Room then stays "playing / pending" until reload. Also `state = room.state ?? fetched` (line ~52) prefers RTDB over fresher fetch: if mirror write failed (best-effort, duel-documents.ts mirrorDuelState) RTDB stays "playing"/"waiting" forever and fetched "finished" is ignored. Expired waiting rooms are never mirrored as "expired" either (status computed lazily), so RTDB shows "waiting" + Join button -> 410.
   Fix: retry finalize on interval until finished (reset ref on failure/not-finished); pick newer state (e.g. prefer fetched when fetched.status is terminal); mirror on getDuel when state differs.

4. MED (conf 80) Duel seed leaks before start / no server-side time limit. server/games/create-variant-game-session.ts createDuelSession checks only `now < endsAt`, not `now >= startAt`. A member can POST /api/games/start during the 5s countdown (or right after join) to get the seed and precompute/bot a solution; actions carry no timestamps, so a scripted client can submit a full bot game any time before endsAt+60s. 3-minute limit is client-only.
   Fix: reject start when `Date.now() < startAt` (small tolerance); optionally cap actions for duel (e.g. max moves/min), or accept as known limitation.

5. LOW-MED (conf 70) Mirror ordering races. duel-store.ts joinDuel/getDuel and submit path each `await mirrorDuelState` after their tx with no version check; two concurrent writers (e.g. overdue getDuel by both clients, or submit+getDuel) can overwrite a newer "finished" mirror with a stale "playing" one. Fix: add `rev`/updatedAt in state and write via RTDB transaction, or mirror from a fresh Firestore read.

6. LOW (conf 85) Level progression not enforced server-side: createLevelSession accepts any levelId 1..20 (isLevelUnlocked only client). Stars/coins (20/star) obtainable for level 20 without clearing earlier ones. Minor coin skip; fix by checking stored.levelStars[id-1]>0 in createLevelSession if desired.

7. LOW (conf 90) isUntouchedGame (ranked-game-cloud-state.ts:85-89) compares replaceCharges to default 2: a fresh `replace-frenzy` (6) / `pillars` (3) event game counts as "touched" (confirm-dialog on leaving, sync seed swap logic), and a level/event with default charges unaffected. Fix: compare to variant's initial charges or use moveCount/score/actionLog only.

8. LOW (conf 80) Duel stale-start loops/noise: after finishing early and pressing "Play again" (variantRun cleared), returning to /duel/[id] before endsAt re-enables canEnterGame -> auto router.push('/play?duel=id') -> startDuelGame returns 409 duel-already-started -> error toast "startFailed". Not an infinite loop (navigated ref), but confusing. Fix: room view should know "already started" (e.g. server state `started` uids) and not auto-navigate.

9. LOW (conf 90) RTDB `/duels/{id}` nodes (state + live) are never deleted; Firestore doc has TTL, RTDB doesn't -> unbounded growth; no rate limit on POST /api/duels. Fix: cleanup on finalize (delayed) or scheduled job; per-uid creation limit.

10. NIT (conf 100) use-special-mode-launcher.tsx ~L112 duplicate `if (!mode) return`.

## Checked, no defect
- Level completion: goal met -> useLevelRunEffects records stars then endVariantRun (isGameOver+reviveUsed) -> sync queues -> server stars from replay.state (final moveCount, so extra moves would lower stars; client stops at goal). Reload: normalizeRestoredState recomputes isGameOver (resets false) but effect/HUD re-ends run; OK.
- Old saves: variantRun `.nullable().catch(null)` handles missing; linesCleared `?? 0`; replaceCharges max 10 >= 6; stone colorId 8 == BLOCK_COLOR_COUNT OK.
- Double result / re-entry: sessions[uid] (409) + results[uid] guard + session status; late submit after finalize ignored.
- Event board uses session.eventWeek (week at start); rule stored on session.
- Realtime ref-counting: release idempotent, presence leave awaits remove before release; OK.

## Unresolved questions
- Is the 3-min limit meant to be enforceable server-side (finding 4)? Currently trust model is "score from valid replay before deadline".
- Is RTDB `isRealtimeDatabaseConfigured()` always true in prod? If false, offset=0 and duel HUD relies on device clock (finding 1 worsens).
- Should an unsubmitted-but-started duel session count as forfeit only, or also block rematch linking?
