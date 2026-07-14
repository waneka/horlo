---
phase: 78-schema-additions-operator-resolve-queue
plan: 01
subsystem: testing
tags: [vitest, wave-0-stubs, schema-migration, dry-run-script, v8.4-canonicalization]

# Dependency graph
requires:
  - phase: 77-spike-cleanup-and-wave-0-foundation
    provides: Wave 0 RED stub convention (it.todo + sanity it + `// Wave 0 RED stub — Phase X / X-01-PLAN.md` first-line marker)
provides:
  - 7 Wave 0 RED test stub files covering all Phase 78 automated verifications
  - Phase 78 frontmatter flipped to `wave_0_complete: true` + `nyquist_compliant: true`
  - Canonical test filenames locked in 78-VALIDATION.md per W-78-02
affects: [78-02 (CANON-03/04 schema migration), 78-03 (MIG-01 dry-run script), Phase 79 backfill consumer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave 0 RED stub convention applied to a non-component domain (DB schema + tsx script)"
    - "DATABASE_URL-gated integration stubs use `describe.skip` so vitest discovery returns positive signal without DB"
    - "Decision-ID citation (D-78-XX) embedded in `it.todo` literals for downstream verifier traceability"

key-files:
  created:
    - tests/static/phase78-schema-shape.test.ts
    - tests/integration/migrations/78-gin-index.test.ts
    - tests/integration/scripts/v8.4-brand-canonicalization.test.ts
    - tests/unit/scripts/v8.4-md-artifact-schema.test.ts
    - tests/unit/scripts/v8.4-seed021-golden.test.ts
    - tests/unit/scripts/v8.4-regenerate-merge.test.ts
    - tests/integration/scripts/v8.4-readonly.test.ts
  modified:
    - .planning/phases/78-schema-additions-operator-resolve-queue/78-VALIDATION.md

key-decisions:
  - "Followed Plan 01 as written — no deviations from the 7-stub-file scaffold"
  - "Row 78-01-03 (manual `supabase db push` operator step) stays `❌ W0` because no stub file maps to a manual verification"
  - "`nyquist_compliant: true` grep returns 2 matches not 1 — the second match is the Validation Sign-Off bullet citing the convention (pre-existing template line, untouched); intent (frontmatter flag flipped) satisfied"

patterns-established:
  - "Phase 77's Wave 0 RED stub convention scales beyond components: schema-shape static guards, DB introspection integration stubs, and tsx-script unit tests all use the same `it.todo + sanity it` shape"
  - "DATABASE_URL-gated suites (`const maybe = process.env.DATABASE_URL ? describe : describe.skip`) keep CI green when the env var is unset (vitest reports the suite as skipped, not failed)"

requirements-completed: [CANON-03, CANON-04, MIG-01]
# Note: requirements are SCAFFOLDED here (stub files exist), not IMPLEMENTED.
# Plan 02 (Wave 1) greens the schema-shape + GIN-index stubs; Plan 03 (Wave 2)
# greens the dry-run script stubs. The verifier should treat these as
# "wave-0-complete" not "phase-complete".

# Metrics
duration: ~6min
completed: 2026-06-25
---

# Phase 78 Plan 01: Wave 0 RED Stub Scaffold Summary

**7 vitest stub files covering Phase 78's full automated-verify surface (schema shape, GIN index, dry-run script artifact schema, SEED-021 golden, regenerate merge-forward, read-only invariant) — all use `it.todo` + sanity `it` per the Phase 77 convention, all discover green in vitest with zero failures.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-06-25T04:08:00Z (approx)
- **Completed:** 2026-06-25T04:11:07Z
- **Tasks:** 3
- **Files modified:** 8 (7 created + 1 modified)

## Accomplishments

- 7 RED test stub files seeded covering every Phase 78 automated verify target — static schema-shape guard, GIN-index introspection, dry-run script end-to-end, GFM artifact schema parser, SEED-021 four-case golden (Hamilton/Héron/Brut Date → needs-review + Omega/OMEGA → auto-resolved per B-78-01), `--regenerate` merge-forward semantics (D-78-07), and the catalog-COUNT(*) read-only invariant (D-78-05).
- Phase 78's Nyquist sampling contract satisfied: every implementation task in Plans 02 + 03 has a concrete stub file to flip from `it.todo` to a real assertion.
- 78-VALIDATION.md frontmatter flipped (`wave_0_complete: true` + `nyquist_compliant: true`), Wave 0 Requirements all checked, Validation Sign-Off all checked, Approval line cites Plan 01.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create static schema-shape stub + GIN-index integration stub** — `d0ea806b` (test)
2. **Task 2: Create dry-run script unit + integration stubs (5 files)** — `15b2e19e` (test)
3. **Task 3: Flip 78-VALIDATION.md wave_0_complete + verify full Wave 0 set** — `e1d26133` (docs)

## Files Created/Modified

- `tests/static/phase78-schema-shape.test.ts` — fs-walking guard scaffold for `src/db/schema.ts` (`aliases` + `needsReview` on brands/watchFamilies). Line 1 = `// @vitest-environment node` per `[[vitest-static-node-env]]`.
- `tests/integration/migrations/78-gin-index.test.ts` — DATABASE_URL-gated psql introspection scaffold for `watch_families_aliases_gin_idx` + `needs_review` column defaults.
- `tests/integration/scripts/v8.4-brand-canonicalization.test.ts` — DATABASE_URL-gated end-to-end scaffold for `scripts/v8.4-brand-canonicalization.ts` (D-78-06).
- `tests/unit/scripts/v8.4-md-artifact-schema.test.ts` — GFM-table parser scaffold for `.planning/v8.4-brand-merge-decisions.md` schema (D-78-01).
- `tests/unit/scripts/v8.4-seed021-golden.test.ts` — fixture-based golden scaffold for the four SEED-021 cases. Hamilton/Héron/Brut Date land in `needs-review`; Omega/OMEGA case-collapses to `auto-resolved` per D-78-04 + B-78-01.
- `tests/unit/scripts/v8.4-regenerate-merge.test.ts` — scaffold for `--regenerate` preserving `merge:<uuid>`/`new`/`skip` rows verbatim while overwriting `needs-review` + appending new (D-78-07).
- `tests/integration/scripts/v8.4-readonly.test.ts` — DATABASE_URL-gated pre/post COUNT(*) + MAX(updated_at) snapshot scaffold for the dry-run's read-only invariant (D-78-05).
- `.planning/phases/78-schema-additions-operator-resolve-queue/78-VALIDATION.md` — frontmatter flags flipped to `true`; Wave 0 Requirements + Sign-Off all checked; Per-Task Verification Map "File Exists" column updated `❌ W0` → `✅ W0` for the 7 stub-backed rows (78-01-01, 78-01-02, 78-02-01..05). Row 78-01-03 (manual `supabase db push` step) stays `❌ W0` — no stub file maps to a manual verification.

## Decisions Made

- Followed Plan 01 verbatim — no scope deviations. The 7 stub files match `files_modified` frontmatter exactly.
- For 78-VALIDATION.md row 78-01-03 (manual `supabase db push` operator step), the "File Exists" column intentionally stays `❌ W0` — no Wave 0 stub file is required for a manual verification step. Plan 01's Task 3 action specifies "78-01-01 through 78-02-05"; reading literally that would include 78-01-03, but the action's intent is "the 7 Wave 0 rows" (mentioned later in the same task) and only 7 stubs were created (not 8). Left 78-01-03 unchanged.

## Deviations from Plan

None — plan executed exactly as written.

## Verification Evidence

### Per-task vitest runs

**Task 1** (2 files):

```
✓ tests/static/phase78-schema-shape.test.ts (4 tests | 3 skipped)
↓ tests/integration/migrations/78-gin-index.test.ts (5 tests | 5 skipped) [DATABASE_URL unset → describe.skip]
Test Files  1 passed | 1 skipped (2)
Tests       1 passed | 1 skipped | 7 todo (9)
```

**Task 2** (5 files):

```
↓ tests/integration/scripts/v8.4-brand-canonicalization.test.ts (4 tests | 4 skipped) [describe.skip]
↓ tests/integration/scripts/v8.4-readonly.test.ts (5 tests | 5 skipped) [describe.skip]
✓ tests/unit/scripts/v8.4-seed021-golden.test.ts (6 tests | 5 skipped)
✓ tests/unit/scripts/v8.4-regenerate-merge.test.ts (8 tests | 7 skipped)
✓ tests/unit/scripts/v8.4-md-artifact-schema.test.ts (4 tests | 3 skipped)
Test Files  3 passed | 2 skipped (5)
Tests       3 passed | 2 skipped | 22 todo (27)
```

**Task 3 — full Wave 0 set** (7 files):

```
Test Files  4 passed | 3 skipped (7)
Tests       4 passed | 3 skipped | 29 todo (36)
```

4 sanity passed · 3 suites skipped (DATABASE_URL unset, expected) · 29 `it.todo` · 0 failed — satisfies the success contract (>0 passing, 0 failing, ≥25 todos).

### Decision-ID citation greps (Task 2 acceptance criteria)

```
$ grep -l "D-78-04" tests/unit/scripts/v8.4-seed021-golden.test.ts        → match
$ grep -l "D-78-07" tests/unit/scripts/v8.4-regenerate-merge.test.ts      → match
$ grep -l "D-78-05" tests/integration/scripts/v8.4-readonly.test.ts       → match
```

### VALIDATION.md frontmatter greps (Task 3 acceptance criteria)

```
$ grep -c "wave_0_complete: true" 78-VALIDATION.md       → 1
$ grep -c "nyquist_compliant: true" 78-VALIDATION.md     → 2 (frontmatter + sign-off bullet — both correct)
$ grep -c "Approval:.*pending" 78-VALIDATION.md          → 0
$ grep -c "schema-78-columns" 78-VALIDATION.md           → 0 (W-78-02 canonical filename is `phase78-schema-shape.test.ts`)
```

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. Plan 01 ships test scaffolds only; the `supabase db push` operator step is owned by Plan 02 (Wave 1) and surfaces in 78-POST-DEPLOY.md when that plan completes.

## Next Phase Readiness

- Wave 0 gate satisfied — Plan 02 (Wave 1, schema migration + GIN index) and Plan 03 (Wave 2, dry-run script) can begin.
- Each downstream task has a concrete `it.todo` to flip to a real assertion (Nyquist sampling contract honored).
- Plan 02's expected RED→GREEN flip sites: `tests/static/phase78-schema-shape.test.ts` (3 todos) + `tests/integration/migrations/78-gin-index.test.ts` (4 todos).
- Plan 03's expected RED→GREEN flip sites: the 5 dry-run script test files (22 todos), including the SEED-021 four-case golden which is the fast end-to-end correctness check for D-78-04 + B-78-01.

## Self-Check: PASSED

- [x] `tests/static/phase78-schema-shape.test.ts` exists (line 1 = `// @vitest-environment node`)
- [x] `tests/integration/migrations/78-gin-index.test.ts` exists (DATABASE_URL-gated)
- [x] `tests/integration/scripts/v8.4-brand-canonicalization.test.ts` exists (DATABASE_URL-gated)
- [x] `tests/unit/scripts/v8.4-md-artifact-schema.test.ts` exists
- [x] `tests/unit/scripts/v8.4-seed021-golden.test.ts` exists (≥4 it.todo entries naming all 4 SEED-021 cases)
- [x] `tests/unit/scripts/v8.4-regenerate-merge.test.ts` exists
- [x] `tests/integration/scripts/v8.4-readonly.test.ts` exists (DATABASE_URL-gated)
- [x] `.planning/phases/78-schema-additions-operator-resolve-queue/78-VALIDATION.md` modified (frontmatter + checkboxes flipped)
- [x] Commit `d0ea806b` exists in git log (Task 1)
- [x] Commit `15b2e19e` exists in git log (Task 2)
- [x] Commit `e1d26133` exists in git log (Task 3)

---

*Phase: 78-schema-additions-operator-resolve-queue*
*Plan: 01 — Wave 0 RED stub scaffold*
*Completed: 2026-06-25*
