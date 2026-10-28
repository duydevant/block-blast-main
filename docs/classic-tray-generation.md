# Classic tray generation

Implemented 2026-10-27. Reference: [Blocky Blast Puzzle by OPlay Games](https://poki.com/en/g/blocky-blast-puzzle), local build `ef6cb1bf-51ef-4ec4-89fc-693b895e231e`.

## Observed rules and implementation

- A new empty-board game starts with counter 2. Counters 2/1/0 select smart/bag/bag; a negative counter resets to 2. The filled-board reference mode starts at 4, but this app retains its existing empty-board start.
- Smart selection enumerates 60 geometry/rotation entries, then every legal placement in native y/x order. After each selection it simulates placement and simultaneous line clears before selecting the next piece. Ties keep the first candidate.
- Candidate score: truncate the float32 sum of mean longest occupied runs in nonempty rows and columns, multiplied by 100; add 110 times squared lines cleared; add 500 for an empty resulting board on the first selection only. The selector consumes no random numbers.
- Other deals draw three entries without replacement from an active bag. Empty bags advance a shuffled queue; the queue is rebuilt only when exhausted, using score bands below 100, below 800, and 800+. The middle/high bands make a fresh random draw for their second branch test. Repeated entries intentionally retain their probability weight.
- Each piece consumes an independent color draw immediately after selection; adjacent colors may repeat. Only a bag deal with no legal move in either its tray or stash replaces slot one with a dot and draws a replacement color. Bag deals do not guarantee that all three pieces can be placed.
- Existing generic shape IDs are retained. Two diagonal cells were added because that geometry is present in the reference. Other existing shapes remain loadable for saved games.
- Save data retains the counter, queue and current bag. Existing v3 weighted-generator saves keep their board/tray and begin a fresh generator cycle; no save-version reset is needed because all existing IDs remain valid.

## Evidence and verification

The workspace contains extracted Lua in `../block-blast-poki/temp/extracted/scripts/`: `game/game_classic_store.luac.lua` (cadence, queue branches, rescue), `pools_catalog.luac.lua` (bag multiplicities), `shapes_catalog.luac.lua` and `shape.luac.lua` (geometry/rotation), and `table.luac.lua` (shuffle). These are static build observations, not a live-browser trace.

Smart-selector reference: `../block-blast-poki/public/blockypuzzle.wasm`, SHA-256 `94b57481105cf6aafd84f933f5cd2c93346e09837a7d2b8323558e6f18245415`; functions 1365/1732 and wrapper 3825. REA inspection was attempted but unavailable because its required `REA_WABT_BIN_DIRECTORY` was not configured. Local WABT tools and the existing full-build oracle with added function exports were used instead; this is not a claim of REA-produced evidence.

Run from the workspace parent:

```powershell
node block-blast-poki/tools/verify-ts-smart-selector.cjs
```

The research-only verifier compares the fresh TypeScript selector against `temp/oracle.wasm` with throwing import stubs. Result: zero mismatches over 5,000 deterministic boards / 15,000 selections, plus all 60 native geometries, all 60 Lua rotations and all 11 Classic bags matched. Production imports only TypeScript; no native binary payload is restored to the app. Regression tests also cover cadence, bag exhaustion, score thresholds, stash-aware rescue and saved-state continuation.

## Scope of equivalence

This verifies selector outputs for the tested boards and reproduces the observed Classic dealing rules. It does not prove every possible board or a newer remote build. The app keeps its seeded PRNG rather than Lua's time-seeded random stream, so two independently played games will not produce an identical random sequence. It also keeps the current scoring, starter board, power-up rules, artwork and audio; those can change when a player reaches score thresholds. This report makes no legal-clearance determination.
