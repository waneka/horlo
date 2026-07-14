---
phase: 81-recommender-display-server-action-swap
plan: 04
subsystem: verification
tags: [local-first, drift-fixture, uat, deploy-runbook, checkpoint]

requires:
  - phase: 81-01
    provides: Watch.brandId?/familyId? + upsert canonical name returns
  - phase: 81-02
    provides: recommender FK-keyed exclusion + INNER JOIN top-up + viewerTopBrand
  - phase: 81-03
    provides: addWatch + editWatch canonical write-time overwrite
  - phase: 81-05
    provides: same-family + lineage rail canonical INNER JOIN (scope patch)
provides:
  - Reversible drift-Hamilton fixture (APPLY + REVERT stanzas) for local-first UAT
  - 81-POST-DEPLOY.md operator-facing deploy runbook (bundled Vercel push + prod smoke + rollback)
  - Operator sign-off on D-81-04 local walkthrough (4/4 assertions passed after Plan 05 patch)
affects: [phase-82-catalog-expansion, future-detail-page-rails, post-deploy-runbook-template]

tech-stack:
  added: []
  patterns:
    - "Reversible fixture SQL wrapped in `-- BEGIN APPLY` / `-- END APPLY` + `-- BEGIN REVERT` / `-- END REVERT` awk-extractable stanzas — reusable local-first UAT recipe for future phases"
    - "Post-deploy runbook committed inline in phase dir alongside fixture — durable operator artifact"
    - "Mid-walkthrough scope-patch loop: operator surfaces adjacent drift → orchestrator adds a scoped Plan 05 → executor lands fix → operator re-verifies → phase closes"

key-files:
  created:
    - .planning/phases/81-recommender-display-server-action-swap/fixtures/drift-hamilton.sql
    - .planning/phases/81-recommender-display-server-action-swap/81-POST-DEPLOY.md
  modified: []

key-decisions:
  - "Fold same-family + lineage rail drift into Phase 81 via a scope-patch Plan 05 rather than defer to Phase 82. Operator's call during walkthrough — CONTEXT.md § Deferred Ideas explicitly named this class as the revisit trigger."
  - "Bundled single Vercel push per D-81-04 (not incremental per-plan). Operator owns the actual `git push` — orchestrator stops before it."

patterns-established:
  - "Reversible drift-fixture SQL: two stanzas in the same file, extract with awk. Cleanup is idempotent (SELECT of remaining_* counts on REVERT block)."
  - "Local-first walkthrough gates prod push. AUTO_MODE + --chain do NOT auto-approve human-verify when the checkpoint gates a shared-state action; orchestrator breaks the chain and surfaces the checklist verbatim."

requirements-completed:
  - RECO-01
  - RECO-02
  - RECO-03
  - RECO-04
  - DISP-01
  - DISP-02

duration: 45min
completed: 2026-07-13
---

# Phase 81 Plan 04: Local Drift-Fixture Walkthrough + Prod Deploy Gate

**Local-first D-81-04 walkthrough approved by operator after mid-walk scope-patch (Plan 05) fixed detail-page rail drift; drift fixture reverted clean; POST-DEPLOY runbook captured. Prod push pending operator invocation.**

## Performance

- **Duration:** ~45 min (including Plan 05 scope-patch loop)
- **Tasks:** 3 (2 autonomous + 1 human-verify checkpoint)
- **Files created:** 2

## Accomplishments

- Authored reversible drift-Hamilton fixture SQL (`drift-hamilton.sql`) — 224 lines including APPLY, REVERT, and remaining-row-count validation
- Authored `81-POST-DEPLOY.md` operator runbook (367 lines) — bundled Vercel push, post-push prod smoke, rollback plan
- Operator ran the 4-step D-81-04 walkthrough on `npm run dev` + local Supabase and confirmed all four assertions post-Plan-05:
  - **(i) RECO-01** — drift row (`Hamilton Watch / DriftTest Chrono`) excluded from viewer's home "From Collectors Like You" rail ✓
  - **(ii) RECO-04** — peer Hamilton rows rendered `Fans of Hamilton love this` (canonical) ✓
  - **(iii) DISP-01** — typed drift brand `Hamilton Watch` persisted as canonical `Hamilton` on addWatch ✓
  - **(iv) DISP-02** — retyped drift brand on edit still persisted as canonical `Hamilton` ✓
- Same-family + lineage rails on the detail page render canonical strings after Plan 05 scope patch
- Fixture REVERT block executed cleanly: `remaining_drift_catalog=0`, `remaining_peer_fixture=0`, `remaining_viewer_test_watches=0`

## Task Commits

1. **Task 04-1: Reversible drift-Hamilton fixture** — `64aafb2c` (feat)
2. **Task 04-2: Bundled Vercel deploy runbook** — `05e2c9e9` (feat)
3. **Task 04-3: human-verify checkpoint** — no commit (operator approval marker; SUMMARY.md serves as the record)

**Plan metadata:** commit hash for this SUMMARY follows.

## Files Created

- `fixtures/drift-hamilton.sql` — Two-stanza reversible fixture. APPLY inserts a drift catalog row (`Hamilton Watch / DriftTest Chrono` on canonical Hamilton brand_id + Khaki Field Mechanical family_id) plus a peer-owned watch on it; REVERT deletes them and asserts remaining counts are zero. Extract via `awk '/^-- BEGIN APPLY/,/^-- END APPLY/'`.
- `81-POST-DEPLOY.md` — Operator-facing runbook. Contains bundled `git push` command, Vercel deploy trigger, post-push prod smoke steps (sign in, load home, spot-check rail), and rollback plan.

## Decisions Made

- **Mid-walkthrough scope patch (Plan 05).** During step (i), operator surfaced that the drift row appeared on the watch detail page's SameFamilyRail with drift denorm strings. CONTEXT.md § Deferred Ideas explicitly named this class of drift as the revisit trigger for post-Phase-81 discovery. Operator elected to fold the fix into Phase 81 via a scoped Plan 05 (INNER JOIN pattern replicated from Plan 02) rather than defer. After Plan 05 landed, operator re-verified the detail page and approved.
- **Fixture REVERT ran after re-verification.** Kept the fixture applied through the Plan 05 land + re-walk cycle so the operator could confirm the fix on the same drift row that surfaced the bug.

## Deviations from Plan

**1. [Scope patch — Plan 05 spawned mid-walk] Same-family + lineage rail drift**
- **Found during:** Task 04-3 walkthrough step (i)
- **Issue:** Drift row surfaced on watch detail page's SameFamilyRail with drift denorm strings — `getSameFamilyForCatalog` and `getLineageForReference` in `src/data/hierarchy.ts` read `watches_catalog.brand`/`.model` directly without JOINing through canonical FKs
- **Fix:** Authored Plan 81-05, spawned executor. Applied the exact INNER JOIN pattern from Plan 02's `topUpFromCatalogPopularity` fix (JOIN through `brand_id → brands.name` and `family_id → watch_families.name`). Both arms of the recursive CTE in `getLineageForReference` got the JOIN symmetrically.
- **Files modified:** `src/data/hierarchy.ts` (Plans 05 commits: `39b7783e`, `748c0b5f`, `33ef2ade`)
- **Verification:** Live psql smoke returned canonical `Hamilton / Khaki Field Mechanical`; operator confirmed on re-walk
- **Committed in:** Plan 05 commits (not part of Plan 04)

---

**Total deviations:** 1 (scope patch — CONTEXT-anticipated revisit trigger fired)
**Impact on plan:** Positive — folded a would-be Phase 82 follow-up into Phase 81, closing the drift class in one shipping unit. No scope creep beyond the CONTEXT-locked deferred item.

## Issues Encountered

None during Plan 04 execution. The Plan 05 scope patch was the natural response to a surfaced defect and completed cleanly.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **All 6 phase requirements complete** (RECO-01..04, DISP-01/02). Fifth Phase 81 success criterion ("no measurable p95 regression") is informal — no baseline artifact exists per RESEARCH.md Open Question #10; operator will spot-check subjectively post-deploy.
- **Drift-elimination surfaces covered:** home rail (Plan 02), Server Action writes (Plan 03), same-family + lineage rails (Plan 05). Any additional drift-visible surface discovered post-deploy is a fresh Phase 82+ concern.
- **Ready for prod push.** Operator follows `81-POST-DEPLOY.md` to execute the bundled Vercel deploy.
- **Post-deploy:** operator confirms prod smoke on their own collection (typical `viewer@horlo.test` walk-through won't exist on prod; use tyler's account instead per POST-DEPLOY runbook step 4).

---

*Phase: 81-recommender-display-server-action-swap*
*Completed: 2026-07-13*
