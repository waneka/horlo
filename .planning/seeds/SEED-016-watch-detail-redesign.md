---
id: SEED-016
status: dormant
planted: 2026-05-24
planted_during: v6.0 Social Interaction / Phase 57 prod UAT
trigger_when: when /watch/[id] gets a dedicated polish/redesign milestone
scope: medium
---

# SEED-016: Redesign the /watch/[id] detail page

Rework the `/watch/[id]` page layout. After Phase 57 added the comment thread as an RSC sibling below `WatchDetail`, the comments sit too far down the page, and the overall page composition feels stacked rather than designed.

## Why This Matters

`/watch/[id]` has accreted surfaces over many phases (verdict card, like button, comment thread, footer actions, lineage/same-family rails). Comments landing at the very bottom buries a primary social action. The page wants an intentional information hierarchy, not just append-at-the-bottom growth. User flagged it as "ok for now" — explicitly deferred, not urgent.

## When to Surface

**Trigger:** a dedicated `/watch/[id]` polish/redesign milestone, or whenever the next surface gets bolted onto this page (treat that as the forcing function to redesign rather than stack).

## Scope Estimate

**Medium** — a layout/IA redesign, not new data. Decide comment placement (e.g., a tab, a right rail on desktop, or a higher inline position), reconcile with the verdict card + footer actions + rails, and keep the Cache Components structure intact (CommentThread stays an uncached Suspense sibling; `unstable_instant`/cache rules from Phases 51/52 must be preserved).

## Breadcrumbs

- `src/app/watch/[id]/page.tsx` — page composition + the `<Suspense>` CommentThread sibling
- `src/components/watch/WatchDetail.tsx` — the main detail body + footer action row
- `src/components/comment/CommentThread.tsx` — the comment host placed below
- Pairs with SEED-015 (grid engagement) and SEED-013 (v7.0 Watch Photos, which also touches this page)

## Notes

Source: prod UAT 2026-05-24 (Phase 57 #9). User: "i don't like how far down the comments are on the page. i think this page needs redesigned in general, i guess it's ok for now."
