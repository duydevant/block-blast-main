# Review: phase-04 progression (missions/XP/coins/themes/referrals)

tsc clean; vitest server + modules/progression: 41/41 pass.
Verified OK: tx reads-before-writes in record-submitted-ranked-game.ts (tx.getAll of missions/inviter is before "Ghi"); HttpErrors thrown inside runTransaction (claim/buy/referral) roll back, no retry; buy-theme checks owned+balance in-tx; referredBy never in PlayerProfile/rewards (toPlayerProfile whitelists fields); session `status!=="open"` blocks double reward on resubmit; mission completion fires once (before<target); claim vs first-3-games race serialized by userRef lock; mutual A<->B claim race serialized; i18n keys used in progression/themes/reward/mission/achievement all exist in progression-translations (+ game.theme.* added).

## Findings (ranked)

### 1. LOW-MED (conf. high) No minimum-effort gate on rewards -> cheap farming
server/games/record-submitted-ranked-game.ts:~92 only rejects moveCount===0. A 1-move game earns 10 XP, counts toward `games` mission (+20-30 coins), `first-game`/`games-50` achievements, and toward REFERRAL_GAMES_REQUIRED (3). Script: new anonymous Firebase account -> claim code -> 3 one-move sessions -> invitee 200 coins + gold; inviter +200 (cap 10 => 2000 coins/inviter account). Cap is per inviter uid, so a sybil of inviters is uncapped; guest accounts are free. Rewards are cosmetic only, so impact limited. Fix: require e.g. summary.moveCount >= N / score >= X for referral-count + mission `games` + XP (or only count `stats.gamesPlayed` toward referral when game score >= threshold); rate-limit session creation per uid/IP.

### 2. LOW (conf. medium) ReferralLinkCapture duplicate claim / lost toast on `t` change
modules/progression/components/referral-link-capture.tsx:32-52. Effect deps include `t`; `t` identity changes when I18nProvider switches locale (lib/i18n.tsx:94-96 sets preferred locale via setTimeout 0 after mount, and on manual switch). If uid is already known and the claim is in flight, cleanup sets cancelled=true and effect re-runs (pending key not yet removed) -> second POST gets 409 already-referred (key removed), first .then skips the success toast. Net: no double reward (server idempotent) but "referral.claimed" toast lost. Fix: keep `t` in a ref, drop from deps; or set an in-flight ref guard.

### 3. LOW (conf. medium) Inviter achievement `referral-1` / count lag
apply-progression-for-verified-game.ts:35-40 evaluates achievements from `stored.referralCount` before the invitee's tx increments it (inviter write is only increment/arrayUnion, record-submitted-ranked-game.ts:~148). Inviter gets the `referral-1` achievement (+50 coins) only after their *next* own ranked game; toast shows then, not at referral time. Not a loss; confirm intended.

### 4. LOW (conf. medium) Silent coin loss on corrupt fields
stored-player-document.ts: `count = ...catch(0)` for xp/coins; a malformed (e.g. string/negative) value parses as 0 and next game write overwrites with `0 + gained` (playerFields writes absolute xp/coins). Only matters if data is corrupted by hand/migration; consider failing the tx instead for xp/coins. Also inviter coins use FieldValue.increment on a possibly corrupt value (fine).

### 5. INFO (conf. high) Inviter reward when inviter doc missing
record-submitted-ranked-game.ts / apply-progression: inviter doc absent -> inviterReward null, invitee still rewarded and referralRewarded=true. Acceptable (code only exists if inviter doc created), just noting.

### 6. INFO (conf. low) Theme enforcement
use-progression-side-effects.ts:35-43: resets selected theme to default whenever profile loaded and theme not owned. Stale profile cache after a level-up (invalidate in flight) can't wrongly reset (only grows ownership). Offline/error -> no enforcement (intended). No defect found.

## Unresolved questions
- Is sybil/guest farming of referral coins (finding 1) acceptable given cosmetic-only rewards, or should there be a min-score/min-move gate?
- Is delayed `referral-1` achievement for the inviter (3) intended?
- Is session creation (create-ranked-game-session.ts) rate-limited anywhere? Not checked/found in server/games.
