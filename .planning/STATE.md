---
gsd_state_version: 1.0
milestone: v8.2
milestone_name: Discovery Freshness
status: Awaiting next milestone
last_updated: "2026-06-10T02:05:36.725Z"
last_activity: 2026-06-10 — Milestone v8.2 completed and archived
progress:
  total_phases: 1
  completed_phases: 1
  total_plans: 2
  completed_plans: 2
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-10 — v8.2 Discovery Freshness SHIPPED; see §Current State)

**Core value:** A collector can evaluate any watch against their collection and get a meaningful, preference-aware answer about whether it adds something or just duplicates what they already own.
**Current focus:** Awaiting next milestone — `/gsd-new-milestone` for v9.0 Catalog Expansion (SEED-009) or another seed.

## Current Position

Phase: Between milestones — v8.2 archived
Plan: —
Status: Awaiting next milestone
Last activity: 2026-06-10 — Milestone v8.2 completed and archived

## Deferred Items

Items acknowledged and deferred at v8.2 milestone close on 2026-06-09 (carries forward v8.1's list — SEED-017 dropped because it shipped THIS milestone; SEED-008/012/013/015/016 re-classification still pending separately):

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
| seed | SEED-002-hybrid-recommender | dormant (v8.2 SEED-017 was its lightweight precursor; still dormant as a future paid-feature candidate per `project_monetization_stance_2026_05_06`) |
| seed | SEED-003-onboarding-cold-start-flow | dormant |
| seed | SEED-004-v5-discovery-north-star | dormant (v5.0 shipped) |
| seed | SEED-005-v6-market-value | dormant (next post-v9.0 candidate; needs SEED-007 spike first) |
| seed | SEED-007-market-pricing-api-spike | dormant (precursor to SEED-005) |
| seed | SEED-008-v5.1-explore-redesign | active — flagged for re-classification (v5.1 shipped) |
| seed | SEED-010-v5.3-add-watch-redesign | dormant — flagged for re-classification (v8.0 shipped this) |
| seed | SEED-012-v6.0-social-interaction | active — flagged for re-classification (v6.0 shipped) |
| seed | SEED-013-v7.0-watch-photos | dormant — flagged for re-classification (v7.0 shipped) |
| seed | SEED-014-cache-components-canonical-sweep | dormant — still future work; v7.0 Phase 61 + Phase 52 only covered specific routes |
| seed | SEED-015-inline-grid-engagement | dormant — flagged for re-classification (v7.0 Phase 63 shipped) |
| seed | SEED-016-watch-detail-redesign | dormant — flagged for re-classification (v7.0 Phase 64 shipped) |

Total: 27 items (2 debug + 11 quick_task + 14 seed). SEED-017 (recommendations-freshness) is the one v8.2 just shipped — marked `status: shipped, shipped_in: v8.2` in `.planning/seeds/SEED-017-recommendations-freshness.md` and excluded from this list. The 14 seeds represent the forward roadmap + re-classification backlog, not operational debt; SEED-001/002/003/005/007/014 are genuine future work; SEED-008/010/012/013/015/016 are already shipped and need their seed-file `status:` field flipped to `shipped:`. Quick tasks are long-tail backlog (oldest from April 2026) consistent with the `project_next_clear_operational_debt` pattern across v6.0 / v7.0 / v8.0 / v8.1 closes.

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

(carried forward from v8.1 close; v8.2 added no quick tasks. Phase 75 P01/P02 entries removed — they were standard plan execution, not ad-hoc quick tasks, and the CLI mis-categorized them.)

| Quick Task ID | Description | Commits | Date |
|---------------|-------------|---------|------|
| 260530-e55 | SRCH-03 followup: composite footer onClick closes combobox popup + mounts StructuredEntryPanel | 6070c5cc, 17d5bc0f | 2026-05-30 |

## Session Continuity

Last activity: 2026-06-10 — Milestone v8.2 Discovery Freshness SHIPPED via `/gsd-complete-milestone`. Code was complete 2026-05-30 (Phase 75 / 2 plans / 6 tasks / 14 commits); close held open until 2026-06-09 — the 10-day gap exercised the DISC-RECS-VARIATION ≥6h rotation window organically. ROADMAP/REQUIREMENTS archived to `.planning/milestones/v8.2-*`; Phase 75 directory `git mv`'d to `.planning/milestones/v8.2-phases/` inline (3rd recurrence of archival miss caught + fixed). MILESTONES.md entry hand-rewritten (6th recurrence of extractor garbage). SEED-017 frontmatter flipped `active → shipped+shipped_in:v8.2+shipped:2026-06-09`. 27 audit items acknowledged as deferred. Closed without `/gsd-audit-milestone` (mirrors v5.0/v5.1/v7.0/v8.0/v8.1 polish-milestone pattern). Tag `v8.2` created locally (push pending operator decision).
Next action: `/gsd-new-milestone` for v9.0 Catalog Expansion (SEED-009) — promoted per operator decision 2026-05-28. Pre-kickoff housekeeping: 6 already-shipped seeds (SEED-008/010/012/013/015/016) still mis-classified in audit-open and should have their seed-file `status:` flipped to `shipped:` before next milestone close (4 milestones running with this same noise). Verify `.planning/phases/` is empty before `/gsd-new-milestone`'s `phases.clear --confirm` runs (per `feedback_milestone_close_phase_dir_archival_miss` — already moved in this close).

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
