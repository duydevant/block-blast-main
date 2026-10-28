---
title: "Original block-puzzle game module on Next.js base"
description: "Build an original 8x8 block-puzzle game (drag 3 pieces, clear rows/cols, score/combo) as modules/block-puzzle in the Next.js 16 base"
status: completed
priority: P1
effort: 40h
branch: feat/block-puzzle-game
tags: [game, canvas, nextjs, zustand]
created: 2026-10-27
---

# Original block-puzzle game module

## Context

- **Base** `block-blast-main/`: Next.js 16.3 App Router, React 19, Tailwind 4, shadcn (base-ui), zustand, vitest, own i18n (en/vi). No game logic. Convention: game goes in `modules/<game>/` + route under `app/(main)/`.
- **Poki clone** `block-blast-poki/`: NOT source. Compiled Defold build (`blockypuzzle.wasm` 1.9MB, `game0.arcd` archive, `dmloader.js`) of *Blocky Blast Puzzle* by OPlay Games + Poki SDK + nginx mirror that pulls from Poki CDN. Nothing to "convert" — WASM/archive can't be ported to TS.
- **Decision:** write a fresh TS/Canvas game in the same *genre* (8x8 grid block puzzle). Clone is only a genre reference to play. No code, assets, logo, name, palette, layout or SDK from it ships in this repo. See phase 01.

## Key architecture

```
modules/block-puzzle/
  engine/      pure TS, no DOM/React — board, shapes, scoring, generator, reducer (unit tested)
  store/       zustand store wrapping reducer + persist (best score, in-progress save)
  render/      Canvas 2D renderer (board, tray, ghost, effects), DPR-aware layout
  input/       pointer-events drag controller (mouse + touch), snap-to-grid
  audio/       Web Audio SFX player
  components/  React shell: canvas host, HUD, dialogs (shadcn), settings
app/(main)/play/page.tsx   route + metadata
```

Data flow: pointer → drag controller → `dispatch(PLACE_PIECE)` → reducer (engine) → new state → store → renderer redraws + HUD re-renders + SFX/effects fire.

No game engine lib (Phaser/Pixi) — 64 cells + 3 pieces doesn't need one (YAGNI).

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | Scope, IP boundary, project setup | Done | 2h | [phase-01](./phase-01-scope-ip-boundary-and-project-setup.md) |
| 2 | Core game engine (pure TS + tests) | Done | 8h | [phase-02](./phase-02-core-game-engine-pure-typescript.md) |
| 3 | Canvas renderer + drag input | Done | 10h | [phase-03](./phase-03-canvas-renderer-and-pointer-drag-input.md) |
| 4 | Game shell UI, store, persistence | Done | 6h | [phase-04](./phase-04-game-shell-ui-store-and-persistence.md) |
| 5 | Game feel: animation, SFX, haptics | Done | 6h | [phase-05](./phase-05-game-feel-animation-sound-haptics.md) |
| 6 | App integration: route, nav, SEO, i18n | Done | 3h | [phase-06](./phase-06-app-integration-route-nav-seo.md) |
| 7 | Testing, QA, docs | Done | 5h | [phase-07](./phase-07-testing-qa-and-docs-update.md) |

## Dependencies

- 2 → 3 → 4 → 5 sequential (each builds on previous API).
- 6 can start after 4 (needs page component). 7 runs last; engine tests written inside phase 2.

## Out of scope (follow-up)

- Online leaderboard / cloud save (needs BE; `lib/api/auth.api.ts` still scaffold).
- Ads / monetization SDK, daily challenge mode, PWA/offline.

## Unresolved questions

1. Game name + branding? (Avoid "Block Blast" / "Blocky Blast" — both are existing products.) Placeholder: `block-puzzle`.
2. Visual direction (palette, block style) — need own design or just tasteful default?
3. Need leaderboard/login tie-in for v1, or local-only best score OK?
