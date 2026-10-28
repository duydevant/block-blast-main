# Review — Phase 02 daily challenge / streak / leaderboards

Scope: uncommitted diff (server/games, server/daily, server/leaderboards, server/profile, app/api/**, client store/sync/launcher). Read-only review.

## Findings

**1. MEDIUM-HIGH — Daily "first run" can be re-rolled: pick the best of N runs**
`server/games/create-ranked-game-session.ts:46-47` only checks `users/{uid}/daily/{day}`, and that doc is written at *submit* time (`record-submitted-ranked-game.ts:95-96`). Before the first submit, every daily start gets a fresh `gameId`.
Scenario: call POST /api/games/start `{mode:"daily"}` 5 times (or use a 2nd tab/device, or clear storage), play all 5, submit only the best one. It gets the daily board + streak. The transaction stops two runs from *both* counting. It does not stop the player from choosing which run counts.
Fix: claim the day at start. In a tx, create `daily/{day}` = `{gameId, status:"started"}` if it doesn't exist (otherwise return practice). On submit, count the run only if `claim.gameId === gameId` and the claim is not yet finished.
(Separate issue, design-level: anonymous uids cost nothing, so alt accounts still allow re-rolls. Needs App Check or rate limits later.)

**2. MEDIUM — Late or out-of-order daily submit resets the streak**
`server/daily/advance-daily-streak.ts:7-9`, called at `record-submitted-ranked-game.ts:104` with the *session's* day. Sessions live 30 days.
Scenario: a day-D run is left pending (offline or on another device). The player plays D+1 and submits (streak N+1, last=D+1). Then the D run flushes. `previousDayKey(D) !== D+1` → `{current:1, lastDailyDay:D}`. Streak lost; `lastDailyDay` goes backwards.
Fix: if `day < streak.lastDailyDay`, return the streak unchanged. Optionally refuse daily credit for runs submitted after day D + grace. Right now they can still change a past daily board for up to 30 days.

**3. LOW — Second daily run wrongly labelled "ranked"**
Same root cause as #1. If the first daily run is still unsubmitted (in progress, or queued but not flushed yet), relaunching daily returns a new `gameId`. `startDailyGame` queues the old run first, so the old run counts. The new run shows the "ranked" badge and the game-over text says it counted, but the server gives it no board. Fix #1 fixes this.

**4. LOW-MEDIUM (scale) — Hot snapshot docs**
`record-submitted-ranked-game.ts:84-92`: every personal-best classic submit reads under lock, and often writes, `leaderboards/alltime` and the weekly doc. That includes every new player's first game, and every submit while the top list has fewer than 100 rows. The Admin SDK uses pessimistic locks, and Firestore allows about 1 write/s per doc. At peak, transactions will abort and return 5xx. The client retries (not a permanent rejection), so no data is lost, only latency. Accept for now; shard or batch if traffic grows.

## Clean
- Transaction ordering: all reads (session, user, conditional daily result, entries, boards) happen before any write. Concurrent double-submit is serialized.
- Board ids come from the session's day, not from the request. Practice starts create no session, so they cannot be submitted (404).
- `mergeScoreIntoTopList` / `standingFromTop` / out-of-top `count()` + next query: tie rule (earlier score ranks higher, tied scores share a rank), cutoff at 100, `nextScore` all correct.
- Rename tx (reads before writes; submit/rename race ends with the new name).
- Client: `dailyDay` guard stops a classic seed from being auto-adopted; practice has `rankedSession=null`, so it is never queued; `finishTutorial` guard; `?daily=1` effect is StrictMode-safe and runs once; account switch turns the run into practice.
- Next 16 route handler `params: Promise` usage is correct.

## Unresolved questions
- Is "first *submitted* run" the intended rule, or "first *started* run"? The spec wording decides whether #1 is a bug or a known limitation.
