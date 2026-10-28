# Phase 01 — Scope, IP boundary, project setup

## Context Links
- [plan.md](./plan.md)
- Base: `README.md`, `docs/code-standards.md`, `docs/system-architecture.md`
- Clone (reference only): `../block-blast-poki/README.md`

## Overview
- Priority: P1 · Status: Done · Effort: 2h
- Fix what we build (original genre game, not a port), set up folder skeleton + route enum.

## Key Insights
- Clone = compiled Defold WASM + binary archive. No readable game logic; porting impossible, decompiling = reverse-engineering third-party code → don't.
- Clone belongs to OPlay Games, distributed via Poki. Shipping its files (iframe/embed/self-host) = redistributing copyrighted work. Copying its look/name 1:1 is also risky.
- Genre mechanics (grid, place pieces, clear lines, score) are generic; implement from scratch with own visuals.
- Clone folder is outside base git repo (sibling dir) — keep it that way.

## Requirements
- Functional: decide game name, route path (`/play`), module name (`block-puzzle`).
- Non-functional: zero files from `block-blast-poki/` copied into `block-blast-main/`.

## Architecture
Skeleton only:
```
modules/block-puzzle/{engine,store,render,input,audio,components}/
modules/block-puzzle/index.ts      # public exports
```

## Related Code Files
- Modify: `lib/routes.tsx` (add `PLAY = "/play"`), `.env.example` (`NEXT_PUBLIC_SITE_NAME` = chosen name)
- Create: `modules/block-puzzle/index.ts`, empty folders as needed
- Delete: `dev-err.log`, `dev-out.log` (empty junk at root)

## Implementation Steps
1. Pick name + 1-line pitch; update `.env.example` + `lib/site.ts` description.
2. `git checkout -b feat/block-puzzle-game`.
3. Add `Routes.PLAY`.
4. Create module skeleton + `index.ts`.
5. Write `modules/block-puzzle/README.md`? No — put notes in `docs/` in phase 07 (YAGNI).
6. Verify `npx tsc --noEmit`, `npm run lint`.

## Todo List
- [x] Name/branding decided
- [x] Branch created
- [x] `Routes.PLAY` added
- [x] Module skeleton created
- [x] tsc + lint pass

## Success Criteria
- Base still builds; `rg -iwl "poki|oplay|defold" --glob '!plans/**' --glob '!node_modules/**'` returns nothing.

## Risk Assessment
- Name collides with trademark → pick distinct name early (cheap now, expensive after SEO).

## Security Considerations
- Don't run clone's `mirror.mjs` in CI/prod; it fetches from third-party CDN.

## Next Steps
- Phase 02.
