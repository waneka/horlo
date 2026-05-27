### Phase 64: Detail Page IA Redesign
**Goal**: The `/w/[ref]` page presents an intentional information hierarchy — carousel, verdict, like, comments, rails, footer — rather than append-order stacking; comments have a deliberate, reachable position; the Phase 51/52 Cache Components structure is fully preserved
**Depends on**: Phase 61, Phase 62, Phase 63
**Requirements**: PAGE-01, PAGE-02, PAGE-03, PAGE-04
**Success Criteria** (what must be TRUE):
  1. The watch detail page presents carousel, verdict, like, comments, rails, and footer in a deliberate visual hierarchy rather than chronological-append order
  2. Comments appear at a reachable scroll position — not buried below all rails and metadata
  3. The photo carousel functions as the primary visual element at the top of the page
  4. CommentThread remains an uncached Suspense sibling and the `unstable_instant = false` lock on related routes is not disturbed; Cache Component rules are intact
**Plans**: 4 plans (3 waves)
- [x] 64-01-PLAN.md — Foundations: extract SpecsSublabel + CommentThread id=comments anchor + two Wave-0 static guards + repair the pre-existing PPR guard pattern (Wave 1)
- [ ] 64-02-PLAN.md — WatchDetailHero client island: 2-col hero, elevated verdict, carousel-forward, jump anchor, owner gates (Wave 2)
- [ ] 64-03-PLAN.md — WatchDetailTrailing RSC: four spec cards + gap-fill + notes, #418-safe dates (Wave 2)
- [ ] 64-04-PLAN.md — Re-order all 3 page.tsx branches + update skeleton + prod human-verify checkpoint (Wave 3)
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 59. Unified Route (Variant C) | 3/3 | Complete    | 2026-05-25 |
| 60. Multi-Photo Schema + DAL | 4/4 | Complete    | 2026-05-25 |
| 61. Photo Upload + Carousel UI | 6/6 | Complete   | 2026-05-26 |
| 62. Public Wear Pics on Watch Detail | 5/5 | Complete   | 2026-05-27 |
| 63. Inline Grid Engagement | 3/3 | Complete   | 2026-05-27 |
| 64. Detail Page IA Redesign | 1/4 | In Progress|  |