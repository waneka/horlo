### Phase 64: Detail Page IA Redesign
**Goal**: The `/w/[ref]` page presents an intentional information hierarchy — carousel, verdict, like, comments, rails, footer — rather than append-order stacking; comments have a deliberate, reachable position; the Phase 51/52 Cache Components structure is fully preserved
**Depends on**: Phase 61, Phase 62, Phase 63
**Requirements**: PAGE-01, PAGE-02, PAGE-03, PAGE-04
**Success Criteria** (what must be TRUE):
  1. The watch detail page presents carousel, verdict, like, comments, rails, and footer in a deliberate visual hierarchy rather than chronological-append order
  2. Comments appear at a reachable scroll position — not buried below all rails and metadata
  3. The photo carousel functions as the primary visual element at the top of the page
  4. CommentThread remains an uncached Suspense sibling and the `unstable_instant = false` lock on related routes is not disturbed; Cache Component rules are intact
**Plans**: 5 plans (4 waves) — Plan 05 added 2026-05-28 as a UAT gap closure (Test 2: mobile brand+model below fold)
- [x] 64-01-PLAN.md — Foundations: extract SpecsSublabel + CommentThread id=comments anchor + two Wave-0 static guards + repair the pre-existing PPR guard pattern (Wave 1)
- [x] 64-02-PLAN.md — WatchDetailHero client island: 2-col hero, elevated verdict, carousel-forward, jump anchor, owner gates (Wave 2)
- [x] 64-03-PLAN.md — WatchDetailTrailing RSC: four spec cards + gap-fill + notes, #418-safe dates (Wave 2)
- [x] 64-04-PLAN.md — Re-order all 3 page.tsx branches + update skeleton + prod human-verify checkpoint (Wave 3)
- [ ] 64-05-PLAN.md — Gap closure: mobile-only brand+model hoist above the carousel (lg:hidden / hidden lg:block JSX dup; NOT CSS order-) + WatchPageSkeleton mirror + static guard extension (Wave 4)
**UI hint**: yes

### Phase 65: Follow-Scoped Owners Module
**Goal**: On `/w/[ref]`, viewers see at-a-glance which collectors **they follow** also own this watch — a compact, hide-if-empty "people you follow who own this" module rendered in the hero right column (under the existing minimal title/spec/like/owner-actions block), with linkable avatar + @username chips routing to each owner's profile / per-user watch detail.
**Depends on**: Phase 64 (the recomposed hero whose right-column slot it fills)
**Requirements**: FOLL-01, FOLL-02, FOLL-03, FOLL-04
**Success Criteria** (what must be TRUE):
  1. On `/w/[ref]`, when ≥1 user the viewer follows owns this watch (matched by `catalogId`), a compact module renders in the hero right column below the existing minimal info; the module is entirely absent from the DOM (hide-if-empty) when zero matches
  2. The follow direction is one-way "viewer → owner" (people the viewer follows) — NOT "people who follow the viewer" and NOT mutual-only — per the UAT 2026-05-27 product call (taste-discovery / social-proof framing)
  3. Each owner chip is a navigable link (`avatar + @username`, with an accessible label) to that owner's profile or their per-user watch detail
  4. Only profiles visible to the viewer per existing privacy rules appear; data is fetched in a single efficient query (no N+1) and does not block the hero render path (Suspense-wrap if it cannot resolve synchronously)
  5. Mobile: the module stacks naturally below the hero's right-column content (single-column collapse) — no separate mobile layout required
**Plans**: TBD
**UI hint**: yes
**Origin**: surfaced during Phase 64 UAT (2026-05-27) — user proposal, captured as a new phase rather than expanding Phase 64's recompose-only scope

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 59. Unified Route (Variant C) | 3/3 | Complete    | 2026-05-25 |
| 60. Multi-Photo Schema + DAL | 4/4 | Complete    | 2026-05-25 |
| 61. Photo Upload + Carousel UI | 6/6 | Complete   | 2026-05-26 |
| 62. Public Wear Pics on Watch Detail | 5/5 | Complete   | 2026-05-27 |
| 63. Inline Grid Engagement | 3/3 | Complete   | 2026-05-27 |
| 64. Detail Page IA Redesign | 4/4 | Complete   | 2026-05-27 |
| 65. Follow-Scoped Owners Module | 0/TBD | Not started | - |