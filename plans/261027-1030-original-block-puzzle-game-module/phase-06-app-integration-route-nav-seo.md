# Phase 06 — App integration: route, nav, SEO, i18n

## Context Links
- [plan.md](./plan.md)
- `app/(main)/layout.tsx`, `app/(main)/page.tsx`, `components/layout/game-header.tsx`, `app/sitemap.ts`, `lib/seo/schema.ts`, `next.config.ts`
- Next 16 metadata docs: `node_modules/next/dist/docs/01-app/`

## Overview
- Priority: P1 · Status: Done · Effort: 3h
- Expose the game at `/play`, link from home + header, add metadata/JSON-LD, full-height mobile layout.

## Key Insights
- Page must be server component exporting `metadata`; render client `BlockPuzzleGameScreen` inside. Optionally `next/dynamic` with `ssr:false` for the canvas part if hydration issues.
- Mobile: game needs `100dvh` minus header; footer would push content → hide footer on `/play` or put route in own group `app/(game)/play/` with header-only layout. Prefer the new group (no conditional logic in shared layout).
- Viewport: `export const viewport` (Next 16 API) for `themeColor`, disable zoom only on game route if needed.

## Requirements
- Functional: `/play` works; home CTA "Play now"; header nav item; sitemap includes `/play`; `VideoGame` JSON-LD.
- Non-functional: Lighthouse mobile perf ≥ 90 on `/play`; no CLS from canvas.

## Architecture
```
app/(game)/layout.tsx        GameHeader + full-height main, no footer
app/(game)/play/page.tsx     metadata + <BlockPuzzleGameScreen/>
lib/seo/schema.ts            + videoGameJsonLd()
```

## Related Code Files
- Modify: `app/(main)/page.tsx` (CTA to play, keep sign-in secondary), `components/layout/game-header.tsx` (nav link), `app/sitemap.ts`, `lib/seo/schema.ts`, `lib/site.ts`, `lib/i18n.tsx` (nav/home keys)
- Create: `app/(game)/layout.tsx`, `app/(game)/play/page.tsx`

## Implementation Steps
1. Route group + layout.
2. Play page with metadata + viewport.
3. Home CTA + header nav + i18n.
4. Sitemap + JSON-LD.
5. `npm run build` and check `/play` prerender output.

## Todo List
- [x] (game) route group
- [x] /play page + metadata
- [x] home CTA, header nav
- [x] sitemap + JSON-LD
- [x] build green

## Success Criteria
- `npm run build` passes, `/play` static; no hydration warnings; works on 360×640 without scroll.

## Risk Assessment
- Next 16 API differences (metadata/viewport/dynamic) → read local docs before coding (AGENTS.md warns).

## Security Considerations
- Existing headers in `next.config.ts` (X-Frame-Options SAMEORIGIN) — keep; if later embedding on portals, revisit with CSP `frame-ancestors` allowlist.

## Next Steps
- Phase 07.
