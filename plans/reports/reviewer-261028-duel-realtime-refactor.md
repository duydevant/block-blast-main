# Review: duel 1v1 realtime refactor (uncommitted diff)

Scope: modules/duel/**, server/duels/**, app/api/duels/**, database.rules.json, the duel parts of create-variant-game-session / record-submitted-ranked-game / stored-game-session, the game-screen and HUD wiring, and endVariantRun/endedEarly. No files edited. `vitest run server/duels modules/game-modes/duel-variant.test.ts`: 11/11 pass.

## 1. CRITICAL / CONFIRMED: the room page enters an infinite render loop once the device has a duel save for the room
- `modules/duel/components/duel-room-view.tsx:49-51`: the zustand selector returns a new object (`{ round, over }`) every time it is called.
- The project uses zustand 5.0.15, whose `useStore` is plain `React.useSyncExternalStore(subscribe, () => selector(getState()))` with no equality memoization. A selector that returns a new reference on every call makes getSnapshot unstable, and React 19 ends with "Maximum update depth exceeded".
- HEAD returned a primitive (`"active" | "finished"`), so this is a regression.
- Scenario: a player finishes or leaves round 1 and lands on `/duel/{code}` (Leave button, "Back to room", Rematch, or the auto-redirect). After `persist.rehydrate()`, `variantRun.duelId === duelId`, so `localRun` is non-null and the page crashes. This breaks the ready/rematch flow for every player who played a round on that device.
- Fix: select primitives, for example `round` and `over` with two selectors, or a string such as `` `${round}:${over}` ``. Alternatively wrap the selector with `useShallow`.

## 2. HIGH / CONFIRMED: Leave, mode switch and time-up are never sent to the server, so the leaver counts as "alive"
- `endVariantRun` (block-puzzle-game-store.ts:80-84) only sets `isGameOver/endedEarly` locally. Nothing is written to RTDB.
- The server (settle-duel-round.ts:19-20) decides `over` only by replaying moves, so a leaver whose board still has room has `over = false`.
- `decideDuelRound` (duel-round-rules.ts:37-38) can then never clinch against the leaver.
- Scenario: A leaves at 500 points (the dialog says "current score will be submitted"). B reaches 600, or runs out of moves at 700. The round still runs to the full 3 min + grace. A's board shows "playing"/"offline", and B's client never sees `opponentOver`, so it never triggers a clinch settle.
- The same applies to the launcher path ("switch mode = leave", use-special-mode-launcher.tsx).
- Fix: record a terminal marker the server trusts. Options:
  - (a) Allow a final `{type:"END"}` move. The rules accept it, `applyDuelMove`/`replayDuelMoves` treat it as `over = true`, and it is written from `endVariantRun` in duel mode.
  - (b) Add a `POST /api/duels/{id}/leave` that stores `stopped[uid]` in Firestore, which `decideDuelRound` then treats as over.

## 3. MEDIUM / CONFIRMED: settle triggers fire once and never retry, so an already-decidable round can wait up to 3 min
`duel-run-controller.tsx:37-51`:
- `settledAt.current = key` is set before the request and is not reset on failure. A failed `/settle` call (network blip or 5xx) is never retried for that reason.
- The stopped player never asks again. Once `over`, the reason stays `"over"`. When the opponent later passes their score, the only trigger is the opponent's client. If that client closed the tab right after passing, or its single call failed, the round is not settled until `endsAt + grace` (the overdue GET poll in useDuelMatch).
- Same issue for both-over: if the second player's settle fails, the panel shows "settling" until time-up.

Fix:
- Reset the key in `.catch`.
- Also settle when `over && opponentScore > score` (a distinct key), and/or poll settle every ~5 s from `DuelGameOverPanel` while `opponentDone && !finished`.
- Feed the returned `DuelStateResponse` into `useDuelMatch.accept`. Today it is discarded (line 50), so a failed RTDB mirror also leaves the panel stale.

## 4. MEDIUM / PLAUSIBLE: player locked out of a round if the start response is lost
- `create-variant-game-session.ts:71` returns 409 `duel-already-started` once `sessions[uid]` exists.
- `duel-room-view.tsx:62` allows entry only if the local save holds the run or the uid is not in `started`.
- Scenario: the server transaction commits, then the response is lost (mobile drop or tab killed) before `startVariantGame` stores the run. The player can never enter the round: the room shows no "Play" button and the play page gets 409. They score 0 and lose by time.
- Fix: make start idempotent per uid and round. If `sessions[uid]` exists, return the same gameId and seed (and possibly refuse only if RTDB already has moves from another device).

## 5. LOW / CONFIRMED: seed is published during the countdown
- `toDuelState` (duel-documents.ts:77) exposes `seed` as soon as the round is created. That is 5 s before start, through the RTDB mirror and the public GET.
- This contradicts the comment in create-variant-game-session.ts:67 ("don't hand out the seed during countdown").
- Either player, or a script, can precompute the opening for 3.5 s+ before the opponent receives a session.
- Fix: return `seed: null` while `now < startAt - DUEL_EARLY_START_TOLERANCE_MS`. The first `createDuelSession` mirror then publishes it for spectators.

## 6. LOW / CONFIRMED: `/settle` is a CPU-amplification endpoint
- `app/api/duels/[id]/settle/route.ts:11` requires only any auth (anonymous users included), not membership.
- Each call reads the whole round from RTDB and replays up to 2×10k reducer steps, even when nothing can be decided.
- Fix: require membership (spectators do not need to settle; overdue rounds are covered by GET), or rate-limit per uid/room. Optionally skip the replay unless a cheap precondition holds.

## 7. LOW / PLAUSIBLE: the RTDB state mirror is best-effort, but the move rules depend on it
- `mirrorDuelState` (duel-documents.ts:172-180) only logs on failure, yet the RTDB rules gate writes on `state/status`, `roundKey`, `startAt` and `endsAt`.
- If the mirror after ready/join fails, every move write for the new round is rejected until another mirror lands. A later `createDuelSession` usually repairs this, but not if it also fails or if both players had already started. Players would then play a whole round that scores 0–0.
- Related: if `resetDuelRoom` fails when a 6-char code is reused, the stale RTDB `state` (higher `version`) makes the version guard reject every mirror for the new room.
- Fix: retry the mirror a few times, re-mirror on GET when the RTDB version is lower, and reset `version` handling on create (for example, force-set state after reset).

## 8. LOW / CONFIRMED: misc robustness
- `duel-move-stream.ts:51-56`: if the initial `get()` rejects (permission or transient), `written` stays -1 and nothing is streamed for the rest of the mount. Only a `console.warn` is logged. Retry with backoff.
- A move rejected mid-round (e.g. offline writes reaching the server after `endsAt+3000`, or a transient rule failure) leaves a gap. Server and opponent replay then freeze the score at that point while the local HUD keeps counting. This is inherent to the design but not surfaced to the player. Consider showing "moves not syncing" when the write promise rejects.
- The room page no longer calls `endVariantRun` at `endsAt` (HEAD did). A player who left with browser Back keeps a "live" local round until they reopen /play. This is harmless because DuelRunController ends it on mount, but `localThisRound.over` stays false meanwhile.
- RTDB `duels/{code}` (state, last round's moves, online) is never deleted when the Firestore doc TTLs out, so storage grows without bound.
- `online/$uid` can be written by any signed-in user for any code, including non-existent rooms. This is garbage or spam only, not a correctness problem.
- 4 independent `useDuelBoard` listeners and replays run on /play (HUD, strip, controller, panel). This costs performance only. Consider lifting it into a shared context or store.

## Verified OK (no finding)
- **RTDB rules:**
  - Only the owner can write, and only as a member (host or guest uid from state). A spectator cannot write moves.
  - Writes are append-only (`!data.exists()`; partial-child writes also fail because `hasChildren` is checked at `$seq`).
  - `at === now`, so time cannot be spoofed.
  - The roundKey and status checks block writes to another round or after the round is finished.
  - The time window matches `DUEL_MOVE_GRACE_MS` and the early-start tolerance.
  - `a` is restricted to type/slot/row/col.
  - A player cannot touch the other's moves or the state.
- **Replay parity:**
  - The client board (`useDuelBoard`) and the server (`replayDuelMoves`) both stop at a gap or an invalid move.
  - Because of the rule time window, every accepted move has `at <= endsAt+3000`. The missing deadline filter on the client therefore cannot diverge, apart from clock skew between the Next server and Firebase.
  - The start state matches (stash locked, `DUEL_VARIANT`, noRevive) in the client store, the server session replay and `duelStartState`.
  - Keys "0000…" are not converted to arrays by RTDB (they fail the `/^(0|[1-9]\d*)$/` check).
- **Concurrency:**
  - settle re-checks status and round inside the transaction, so stats are not double-counted.
  - ready and session-start are serialized by Firestore transactions.
  - The mirror version guard handles out-of-order mirrors.
  - Decisions computed from a stale read stay valid because scores are monotonic and "over" is terminal.
- **Hooks:** keys include round/seed/uid. Every listener is cleaned up through `subscribeRealtime`, which is safe before the SDK loads. DuelRunController is keyed by duelId:round. The panel's reveal state is keyed by round.

## Unresolved questions
1. Should Leave count as "out" server-side (finding 2), or is waiting for time-up intended? The plan says "submit current score", which suggests it should count as out.
2. Copycat risk (design-level, not a bug): both players share the seed and see each other's board live. The trailing player can mirror the leader's moves exactly and so never do worse than a tie, and can deviate later. Is this accepted? Possible mitigations: show the opponent's board with a delay or only the score, or use per-player seeds with equal difficulty.
3. Duel sessions issued before deploy are now replayed with `noRevive` (stored-game-session.ts:28). An old in-flight duel game that used REVIVE will fail submission with invalid-action. Is that acceptable?
4. Is anonymous auth always present for spectators? `useDuelRoom` and `useDuelOnline` need a uid, so a signed-out viewer only gets the single API fetch and no live updates.
