---
gsd_state_version: 1.0
milestone: v8.2
milestone_name: Discovery Freshness
status: verifying
last_updated: "2026-05-30T23:58:19.282Z"
last_activity: 2026-05-30
progress:
  total_phases: 1
  completed_phases: 1
  total_plans: 2
  completed_plans: 2
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-30 — v8.2 Discovery Freshness STARTED; see §Current Milestone)

**Core value:** A collector can evaluate any watch against their collection and get a meaningful, preference-aware answer about whether it adds something or just duplicates what they already own.
**Current focus:** Phase 75 — Recommendations Freshness

## Current Position

Phase: 75 (Recommendations Freshness) — EXECUTING
Plan: 2 of 2
Status: Phase complete — ready for verification
Last activity: 2026-05-30

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
- **Phase 75 P02 D-06/07/08/09**: `SEED_POOL_SIZE 15→30`; new `ROTATION_WINDOW_MS = 6 * 60 * 60 * 1000`; exported `seedFor` (djb2-style 32-bit) + `mulberry32` (5-line PRNG); Fisher-Yates shuffle of top-30 → take first `SAMPLED_SEED_SIZE` (15). Cache-stable within window; rotates next window.
- **Phase 75 P02 D-10/D-11/D-14**: `topUpFromCatalogPopularity()` (exported) fires when `candidateMap.size < SPARSE_POOL_THRESHOLD` (8); queries `watches_catalog` ordered by `(ownersCount DESC, brand ASC) LIMIT 20`; uses `ownersCount` ONLY (no `wishlistCount`); determinism comes from daily pg_cron refresh — no PRNG needed for top-up.
- **Phase 75 P02 D-12/D-13**: `Recommendation.representativeOwnerId` widened to `string | null`; synthetic top-up rows emit `null` + route through existing community-fallback rationale `"Popular in the community"` — no new rationale template or copy surface. `RecommendationCard.tsx` already does not dereference the field — non-breaking widening.

### Pending Todos

None.

### Blockers/Concerns

None.

## Quick Tasks Completed

| Quick Task ID | Description | Commits | Date |
|---------------|-------------|---------|------|
| 260530-e55 | SRCH-03 followup: composite footer onClick closes combobox popup + mounts StructuredEntryPanel | 6070c5cc, 17d5bc0f | 2026-05-30 |
| Phase 75 P01 | 25m | 3 tasks | 3 files |
| Phase 75 P02 | 8min | 3 tasks | 3 files |

## Session Continuity

Last activity: 2026-05-30 — Phase 75 Plan 02 COMPLETE (DISC-RECS-VARIATION). Both Phase 75 plans now done in parallel (P01 cache-invalidation + P02 algorithm-variation, zero file overlap). Code surface: `src/data/recommendations.ts` (rotation + sparse-pool top-up), `src/lib/discoveryTypes.ts` (representativeOwnerId widened to nullable), new test file `src/data/__tests__/recommendations.test.ts` (10 tests, 4 D-16 cases + 6 pure-function smoke tests). All verify chains PASS (build + targeted vitest + grep markers + no font-medium + no destructive git). Coverage 2/2 plans complete; v8.2 Phase 75 ready for verification + UAT scaffolding.
Next action: `/gsd-verify-phase 75` to run the phase verifier; then bundle the v8.2 prod push (single Vercel deploy on top of v8.1 commit `cdd2db16`) and the single UAT walk covering DISC-RECS-CACHE (1 walk — add a watch and assert rail re-computes) + DISC-RECS-VARIATION (2 walks ≥6h apart) + sparse-pool top-up (1 walk on a fresh test account). Per `feedback_ppr_cache_fill_no_longer_call_out` do NOT layer #419 / cache-fill checks into the UAT script. Per `project_phase_complete_999_1_misset` hand-correct STATE.md `completed_phases` + `percent` after `gsd-sdk query phase.complete 75` (Bug 2 fires even when `is_last_phase: true`).

## Operator Next Steps

- Plan Phase 75 with `/gsd-plan-phase 75`
