# Review phase 03: share card, friend challenge, OG image

## Findings

1. **[medium] Playing a challenge permanently unlocks the stash for the receiver** (`server/games/record-submitted-ranked-game.ts:127`, plus `create-ranked-game-session.ts:71`)
   A challenge session starts with the creator's `stashUnlocked`. `summary.stashUnlocked` is `Boolean(state.stashUnlocked)` (replay-recorded-game-actions.ts:71), which is already true from move 0. The submit then writes `stored.stashUnlocked || summary.stashUnlocked` to `users/{uid}`.
   Scenario: a veteran player without the stash opens any public `/c/{id}` from a creator who has it, places one piece, and gets back to classic. From then on `resolveStashUnlockedForNewGame` gives them an unlocked stash in every classic ranked game, so they skip the progression gate on the weekly and all-time boards. The client mirrors this through `game.stashUnlocked` in freshGameState and requestSeed.
   Fix: for `mode === "challenge"`, skip the stashUnlocked merge (or only count it if the stash was unlocked during play, not at the start).

2. **[medium, likely on iOS Safari] Challenge share runs after a network await** (`game-over-share-actions.tsx:180-181`, `share-or-copy-link.ts`)
   `navigator.share` is called only after the POST /api/challenges round-trip and the canvas render. On WebKit the user gesture has expired by then. `share` throws NotAllowedError, the code falls back to `clipboard.writeText`, which also needs the gesture and also fails. Result: the challenge is created but the user only sees "share failed". Retrying repeats the await.
   Fix: create the link first, then share it from a second tap (or a dialog showing the link with a copy button).

3. **[low] Profile, daily and leaderboard caches are not refreshed if the challenge route wins the submit race** (`challenge-game-actions.ts:32-38`)
   `queueFinishedRankedGame()` triggers a sync `tick` → `flushPending` at the same time as the challenge POST. Whichever submit loses gets a 409. If the queue loses, its item is dropped with no `onGameSubmitted`, so the queries are never invalidated. Score correctness is fine because the transactions serialize.

4. **[low] Account switch leaves `challenge` set** (`block-puzzle-game-store.ts`, `dropCloudStateForOtherUser`)
   `rankedSession` is cleared but `challenge` is not. The unranked game keeps the challenge badge and the won/lost note, and the classic seed is never adopted (`specialGame` guard). This is the same pattern as `dailyDay` in phase 02.

5. **[low] Submit transaction fails if the challenge doc is gone** (`record-submitted-ranked-game.ts:117`)
   `tx.update(challenge, ...)` throws NOT_FOUND → 500, which is not a permanent rejection, so the client retries every 30s forever. This only happens if challenges are ever deleted or TTL'd.

## Clean
- Creator score is always server-replayed: the re-read inside the transaction requires `status done` + `score`. Owner check returns 404. The mode guard blocks daily and challenge games. Idempotent via `createdChallengeId`. The 409 swallow is correct.
- Submit challenge branch: all reads happen before writes, best score is kept, attempts are counted only when `moveCount > 0`, and challenge runs write to no leaderboards.
- Public data: the GET route, page and OG show no seed, uid or sourceGameId (only the last-4-character uid tag, same as before). firestore.rules is deny-all.
- Client: classic seed is not auto-adopted for challenge games, `challenge` and `dailyDay` are cleared by each start-state function, revive is hidden after submission, and the launcher effect runs once.
- Next 16: `params` is a Promise in the page, generateMetadata and opengraph-image (matches the docs). `metadataBase` is set in app/layout.tsx. Noindex is set.

## Unresolved questions
- Spec's "Thách lại" (re-challenge) button on the result screen is not present. Was it intentionally dropped?
