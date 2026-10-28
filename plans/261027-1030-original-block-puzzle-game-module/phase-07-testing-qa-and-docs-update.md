# Phase 07 — Testing, QA, docs

## Context Links
- [plan.md](./plan.md) · all phases
- `docs/code-standards.md`, `docs/system-architecture.md`

## Overview
- Priority: P1 · Status: Done (real-device QA pending) · Effort: 5h
- Verify everything end-to-end, tune balance, update docs.

## Key Insights
- Engine is pure → bulk of logic covered by vitest already (phase 02).
- Canvas UX needs real-device manual QA; Playwright not installed — add only if e2e becomes recurring need (YAGNI for v1).

## Requirements
- `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` all green.
- Manual QA matrix: Chrome/Edge desktop, Android Chrome, iOS Safari; portrait + landscape; en + vi; light + dark theme.

## Implementation Steps
1. Run full checks; fix failures (no skipped tests).
2. Seeded "bot" test: random-valid-move simulation 1000 games → no crash, no invalid state, records avg score (balance signal).
3. Manual QA checklist:
   - drag/drop accuracy at board edges
   - row+col simultaneous clear, board-clear bonus
   - game over triggers exactly when no piece fits
   - reload resume, tampered save
   - sound/haptics toggles persist
   - no console errors/hydration warnings
4. Tune scoring/generator weights from playtest.
5. Code review (`code-reviewer` agent).
6. Docs: update `docs/system-architecture.md` (module layers + data flow), `docs/code-standards.md` (engine purity rule), `README.md` (play route), create `docs/project-roadmap.md` with follow-ups.

## Todo List
- [x] checks green
- [x] simulation test
- [ ] manual QA matrix
- [ ] balance tuning
- [x] code review fixes
- [x] docs updated

## Success Criteria
- All checks green; QA matrix passed; docs reflect final structure.

## Risk Assessment
- iOS-only drag bugs found late → test on real iPhone in phase 03, not only here.

## Security Considerations
- Confirm no third-party scripts/SDK added; no clone files in repo (`rg -i "poki|oplay|defold"`).

## Next Steps
- Follow-ups: leaderboard via BE, daily seeded challenge, PWA offline.
