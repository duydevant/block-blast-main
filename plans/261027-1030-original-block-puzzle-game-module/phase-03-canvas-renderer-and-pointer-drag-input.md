# Phase 03 — Canvas renderer + pointer drag input

## Context Links
- [plan.md](./plan.md) · [phase-02](./phase-02-core-game-engine-pure-typescript.md)
- Next 16 client components: `node_modules/next/dist/docs/01-app/` (check `"use client"` + dynamic import notes)

## Overview
- Priority: P1 · Status: Done · Effort: 10h
- One `<canvas>` draws board + 3-slot tray + dragged piece + ghost. Pointer Events for mouse/touch/pen.

## Key Insights
- Canvas 2D > DOM grid here: smooth 60fps drag, cheap effects later, no React re-render per pointermove.
- DPR scaling: backing store = CSS size × `devicePixelRatio` (cap 2–3), `ctx.setTransform(dpr,0,0,dpr,0,0)`.
- Touch: lift dragged piece above finger (offset ≈ 1.5 cells up) or finger hides it. Tray pieces drawn at ~60% scale, full scale while dragging.
- Snap: piece top-left cell = round((pointer − offset − boardOrigin) / cellSize). Valid → ghost + highlight lines that *would* clear.
- `touch-action: none` on canvas, `setPointerCapture` on pointerdown.
- Only redraw on demand (dirty flag + rAF) — idle = 0 CPU.

## Requirements
- Functional: pick piece from tray, drag, ghost preview (valid/invalid), would-clear highlight, drop → dispatch or snap back.
- Non-functional: portrait mobile 360px wide → desktop; resize/orientation handled via `ResizeObserver`; no layout shift.

## Architecture
```
render/canvas-layout-metrics.ts   computeLayout(cssW, cssH) → { cellSize, boardRect, traySlots[3], dpr }
render/block-cell-painter.ts      drawBlock(ctx, x, y, size, colorId, alpha) — own bevel/flat style, palette tokens
render/board-canvas-renderer.ts   renderFrame(ctx, layout, state, dragState, effects) — pure draw, no input
input/pointer-drag-controller.ts  attach(canvas, getLayout, getState, onDrop) → detach; tracks DragState
                                  { slot, pointerX, pointerY, grabOffset, snapRow, snapCol, isValid }
components/block-puzzle-game-canvas.tsx  "use client"; owns canvas ref, ResizeObserver, rAF loop, wires store
```
Palette: own color list in `render/block-color-palette.ts` (derive from theme `--hue` optional).

## Related Code Files
- Create: files above under `modules/block-puzzle/`
- Test: `canvas-layout-metrics.test.ts`, snap math in `pointer-drag-controller` extracted to pure fn `computeSnapCell()` + test

## Implementation Steps
1. Layout metrics (pure) + tests for few viewport sizes.
2. Block painter + palette (no image assets needed).
3. Renderer: grid bg, filled cells, tray pieces scaled, dragged piece, ghost, would-clear row/col tint.
4. Drag controller: hit-test tray slots (bounding box padded for fat fingers), capture, move, drop, cancel (pointercancel/blur).
5. Canvas component: mount, resize, rAF dirty loop, cleanup on unmount; dispatch via temporary `useReducer` (store comes phase 04).
6. Manual test desktop Chrome + mobile emulation + real phone.

## Todo List
- [x] layout metrics + tests
- [x] palette + block painter
- [x] renderer
- [x] drag controller + snap tests
- [x] canvas component w/ resize + cleanup
- [x] mouse verified (Chrome desktop)
- [ ] touch verified on real phone

## Success Criteria
- Drag at 60fps on mid Android; drop accuracy correct on 360px and 1440px widths.
- No listeners leak after route change (check with React StrictMode double-mount).

## Risk Assessment
- iOS Safari scroll/zoom during drag → `touch-action:none`, `overscroll-behavior:none` on game container, prevent default on pointerdown.
- Blurry canvas on HiDPI → DPR handled in layout.

## Security Considerations
- N/A (client-only rendering).

## Next Steps
- Phase 04 swaps local reducer for zustand store + HUD.
