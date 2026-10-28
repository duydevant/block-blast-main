# Phase 05 — Game feel: animation, SFX, haptics

## Context Links
- [plan.md](./plan.md) · [phase-04](./phase-04-game-shell-ui-store-and-persistence.md)

## Overview
- Priority: P2 · Status: Done · Effort: 6h
- What makes the genre satisfying: snap feedback, line-clear burst, combo text, score count-up, sound.

## Key Insights
- Effects are time-based, live outside game state: reducer returns move result (cleared cells, lines, combo, points) → effects queue keyed by `performance.now()`.
- rAF loop runs only while effects active or dragging; otherwise idle.
- Web Audio needs user gesture to start → create/resume `AudioContext` on first pointerdown.
- SFX: synthesize with oscillators/noise (no asset licensing) or own recorded/CC0 files in `public/sounds/` with license note.
- `navigator.vibrate` absent on iOS → feature-detect, silent no-op.
- Respect `prefers-reduced-motion`: shorten/skip shake & particles.

## Requirements
- Functional: place pop, clear flash + cell shrink/fade, simple particles, floating "+N" and combo label, score count-up in HUD, game-over board fade/grey, SFX (pick, place, invalid, clear 1..n, combo, game over), haptic on place/clear.
- Non-functional: effects never block input; no allocation-heavy particle systems (cap ~100).

## Architecture
```
render/effects-timeline.ts        addEffect(kind, payload, start); stepEffects(now) → active list; pure easing helpers
render/effects-painter.ts         draws active effects onto ctx after board
audio/sound-effects-player.ts     lazy AudioContext, play(name), respects settings.sound
audio/synth-sound-recipes.ts      oscillator/noise envelopes per sound name
input/haptic-feedback.ts          vibrate(pattern) guarded by settings + feature detect
```
Reducer change: expose `lastMoveResult` in state (or return tuple via store action) for effects.

## Related Code Files
- Modify: `engine/game-state-reducer.ts` (lastMoveResult), `render/board-canvas-renderer.ts`, `components/block-puzzle-game-canvas.tsx`, `components/game-hud-score-bar.tsx`
- Create: files above
- Test: `effects-timeline.test.ts` (start/expire/easing)

## Implementation Steps
1. `lastMoveResult` in reducer + tests update.
2. Effects timeline + painter; hook into rAF loop with "active" check.
3. SFX player + recipes; unlock on first gesture.
4. Haptics.
5. Reduced-motion support.
6. Playtest tweak timings (clear anim ≈ 250–350ms).

## Todo List
- [x] lastMoveResult
- [x] effects timeline + painter
- [x] SFX
- [x] haptics
- [x] reduced motion
- [ ] playtest tuning

## Success Criteria
- Clearing 3 lines with combo feels distinct from single clear (visual + audio).
- Idle CPU ≈ 0 (Performance panel, no rAF when idle).

## Risk Assessment
- Autoplay policy blocks audio → unlock on gesture; never throw if AudioContext missing.

## Security Considerations
- N/A.

## Next Steps
- Phase 06/07.
