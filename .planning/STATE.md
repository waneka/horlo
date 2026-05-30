---
gsd_state_version: 1.0
milestone: v8.2
milestone_name: Discovery Freshness
status: planning
last_updated: "2026-05-30T22:30:00.000Z"
last_activity: 2026-05-30
progress:
  total_phases: 1
  completed_phases: 0
  total_plans: 2
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-30 — v8.2 Discovery Freshness STARTED; see §Current Milestone)

**Core value:** A collector can evaluate any watch against their collection and get a meaningful, preference-aware answer about whether it adds something or just duplicates what they already own.
**Current focus:** Phase 75 — Recommendations Freshness — Cache Invalidation + Algorithm Variation

## Current Position

Phase: 75 — Recommendations Freshness — Cache Invalidation + Algorithm Variation
Plan: — (not started — next: `/gsd-plan-phase 75`)
Status: Roadmap complete; planning Phase 75
Last activity: 2026-05-30 — v8.2 ROADMAP.md written; Phase 75 (1 phase, 2 wave-1-parallel plans) covers both v8.2 requirements (DISC-RECS-CACHE + DISC-RECS-VARIATION)

## Deferred Items

Items acknowledged and deferred at v8.1 milestone close on 2026-05-30:

| Category | Item | Status |
|----------|------|--------|
| debug | knowledge-base | unknown |
| debug | mobile-title-above-fold | diagnosed |
| quick_task | 260413-qp3-price-prominence-and-filter-collapse | missing |
| quick_task | 260421-rdb-fix-404-on-watch-detail-pages-for-watche | missing |
| quick_task | 260421-srx-wrap-follower-following-counts-in-link-o | missing |
| quick_task | 260424-nk2-fix-phase-15-uat-bug-wywt-rail-and-overl | missing |
| quick_task | 260513-hvu-hotfix-search-watches-tab-returns-empty- | missing |
| quick_task | 260513-m31-fix-otherownersroster-count-label-always | missing |
| quick_task | 260519-08p-fix-next-js-image-aspect-ratio-console-w | missing |
| quick_task | 260519-d69-fix-4-collection-path-ui-issues-in-pathc | missing |
| quick_task | 260519-g4v-fu-02-fix-explore-brands-a-z-letter-anch | missing |
| quick_task | 260519-ga9-fu-01-expose-brand-era-genre-archetype-f | missing |
| quick_task | 260530-e55-srch-03-followup-popup-stay-open-fix | missing |
| seed | SEED-001-catalog-hierarchy-and-attributes | dormant |
| seed | SEED-002-hybrid-recommender | dormant (this milestone is the lightweight precursor) |
| seed | SEED-003-onboarding-cold-start-flow | dormant |
| seed | SEED-004-v5-discovery-north-star | dormant |
| seed | SEED-005-v6-market-value | dormant |
| seed | SEED-007-market-pricing-api-spike | dormant |
| seed | SEED-008-v5.1-explore-redesign | active |
| seed | SEED-010-v5.3-add-watch-redesign | dormant |
| seed | SEED-012-v6.0-social-interaction | active |
| seed | SEED-013-v7.0-watch-photos | dormant |
| seed | SEED-014-cache-components-canonical-sweep | dormant |
| seed | SEED-015-inline-grid-engagement | dormant |
| seed | SEED-016-watch-detail-redesign | dormant |

Total: 27 items (2 debug + 11 quick_task + 13 seed + 1 UAT-audit false-positive). The 3 v8.1 UAT files (72/73/74) were flagged as gaps but all are `status: passed` with 0 pending — false positive in the audit. The 12 dormant seeds + 2 active seeds represent the forward roadmap, not operational debt; promoted via `/gsd-new-milestone`. Quick tasks are long-tail backlog (oldest from April 2026) consistent with the `project_next_clear_operational_debt` pattern across v6.0 / v7.0 closes.

## Performance Metrics

- v8.1: 3 phases (72-74), 5 plans, 1 day, 47 commits, 6/6 reqs (all bundled prod UAT items passed)
- v8.0: 6 phases (66-71), 22 plans, 2 days, 150 commits, 39/39 reqs
- v7.0: 7 phases (59-65), 29 plans, 4 days, 244 commits
- 34/34 v7.0 requirements shipped (ROUTE 6, PHOTO 9, WPIC 6, GRID 5, PAGE 4, FOLL 4)
- src/ +5,057 / −628 LOC across 65 files; tests/ +3,982 / −502 LOC across 33 files
- Phase 65 prod UAT: 9 pass / 1 skip / 0 issues
- Blockers encountered: 0
- v6.0 (prior): 8 phases (53-58 + 56A + 57.1), 37 plans, 3 days; 34/34 reqs shipped

## Accumulated Context

### Key Decisions

(carried over from v8.1 close — see PROJECT.md and prior-milestone archives for v8.1/v8.0/v7.0/v6.0 decision history. v8.2 starts with no Phase 75 decisions yet.)

- **v8.2 scope is exactly 2 reqs, 1 phase, 2 parallel plans** — Phase 75 covers DISC-RECS-CACHE (cache-tag wiring) + DISC-RECS-VARIATION (algorithm rotation + sparse-pool top-up). Plans are wave-1-parallel because cache wiring touches `src/components/home/CollectorsLikeYou.tsx` + `src/app/actions/watches.ts` while algorithm variation touches `src/data/recommendations.ts` — zero file overlap.
- **`revalidateTag` semantics = default, NOT `'max'`** — DISC-RECS-CACHE wants read-your-own-write (the user who just mutated wants to see the rec change THIS render); per-viewer tag `viewer:${user.id}:recs` keyed per-viewer (mirrors `viewer:${id}:counts` pattern at `src/app/actions/comments.ts:167`) — no cross-user over-invalidation.
- **6h time window for algorithm rotation** — rail rotates 4× daily; balances "feels alive" with cache hit rate. PRNG = inline `mulberry32` (no new dependency). Top-up source = `watches_catalog.count` (v4.0 pg_cron-maintained — no extra query).

### Pending Todos

None.

### Blockers/Concerns

None.

## Quick Tasks Completed

| Quick Task ID | Description | Commits | Date |
|---------------|-------------|---------|------|
| 260530-e55 | SRCH-03 followup: composite footer onClick closes combobox popup + mounts StructuredEntryPanel | 6070c5cc, 17d5bc0f | 2026-05-30 |

## Session Continuity

Last activity: 2026-05-30 — v8.2 ROADMAP.md written. Single phase (Phase 75) maps both v8.2 requirements (DISC-RECS-CACHE + DISC-RECS-VARIATION). Coverage 2/2. Mirrors v8.1's polish-milestone shape: build-gated, no-worktrees, bundled prod push + single UAT walk after Phase 75 lands. Phase 75 plans are wave-1-parallel (cache wiring + algorithm variation — zero file overlap).
Next action: `/gsd-plan-phase 75` to generate Phase 75 plans (01-cache-invalidation + 02-algorithm-variation).

## Operator Next Steps

- Plan Phase 75 with `/gsd-plan-phase 75`
