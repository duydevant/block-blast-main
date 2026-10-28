---
name: project-ip-clean-rewrite
description: block-puzzle module is being rewritten to remove all third-party (Poki/OPlay build) derived code/assets; sibling block-blast-poki/ is tracked in same git root
metadata:
  type: project
---

As of 2026-10-27 the block-puzzle game (block-blast-main/modules/block-puzzle) was rewritten to drop everything ported from a third-party game build (sprites, audio, WASM shape finder, Lua shape pools, scoring, layout). Plan: plans/261027-1600-replace-third-party-derived-code-and-assets.

**Why:** IP/licensing - the game must contain only original rules, data and art.

**How to apply:** In reviews, always grep (case-insensitive, include hidden + tracked logs) for poki/oplay/defold/lua/recovered/game-assets. Remember the git root (D:\VQD\blocky-blast-web-main) also tracks block-blast-poki/ (653 files) and dev-poki-*.log files, and history still holds removed assets - flag repo-level exposure, not just working tree.
