# Phase 27 — Deferred Items

Out-of-scope discoveries surfaced during plan execution. NOT fixed by Phase 27.

## Phase 27 Plan 02 (Wave 2 DAL/migrations)

### Pre-existing test failure: tests/integration/phase17-addwatch-wiring.test.ts

- **Discovered during:** Task 3 verification (post-Tasks-1+2 baseline confirmed failure)
- **Symptom:** addWatch creates a watch but `watches.catalog_id` is null after the action returns. The test asserts `watchRows[0]?.catalog_id` is truthy.
- **Root cause:** catalog upsert + link path inside addWatch silently fails (it is wrapped in try/catch with `console.error`, so the action still returns success). Likely cause is a missing prerequisite seeded row or a Phase 19.1 catalog-source-photos bucket dependency that the integration test does not stub.
- **Why deferred:** Pre-existing, unrelated to sort_order work. Failure reproduces on `git stash` (Tasks 1+2 baseline). Not caused by Phase 27 changes.
- **Owner:** Phase 17 / Phase 19.1 maintenance. File a separate debug ticket if catalog-link wiring is needed for ongoing test coverage.
