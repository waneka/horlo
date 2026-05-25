---
phase: 54-dal-reactions-comments-gate-logic
plan: "01"
subsystem: test-scaffolds
status: complete
tags: [tdd, red-green, integration-test, unit-test, security, gate]
dependency_graph:
  requires: []
  provides:
    - tests/integration/phase54-dal-gate.test.ts
    - src/data/__tests__/reactions-comments-gate.test.ts
  affects:
    - src/data/comments.ts (Plan 03 must satisfy these tests)
    - src/data/reactions.ts (Plan 03 must satisfy these tests)
    - src/data/follows.ts (Plan 02 must satisfy these tests)
tech_stack:
  added: []
  patterns:
    - localhost-gated integration test suite (phase34-rls.test.ts pattern)
    - vi.mock('@/db') chained-mock unit scaffold (watches-leftjoin.test.ts pattern)
key_files:
  created:
    - tests/integration/phase54-dal-gate.test.ts
    - src/data/__tests__/reactions-comments-gate.test.ts
  modified: []
decisions:
  - "Strict dbUrlIsLocal guard (localhost/127.0.0.1) in integration suite — prevents accidental prod execution (T-54-01)"
  - "NEGATIVE CELLS FIRST ordering: SEC-02 rejection tests before GATE-04/GATE-05 positive tests"
  - "catalogId seeded via watchesCatalog insert before watches insert (watches.catalogId is NOT NULL per Phase 38)"
  - "Flexible per-call mockImplementation for canViewerCommentOnTarget multi-step tests (watch row + isMutualFollow calls)"
metrics:
  duration: "~3 minutes"
  completed: "2026-05-22"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
---

# Phase 54 Plan 01: Wave 0 Test Scaffolds Summary

Wave 0 — both Phase 54 automated test scaffolds created: the localhost-gated integration suite encoding SEC-02/GATE-01/GATE-04/GATE-05 direct-DAL contracts, and the mocked-db unit suite covering every gate branch of `canViewerCommentOnTarget` and both `isMutualFollow` directions.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Scaffold localhost-gated SEC-02/GATE-01/GATE-04/GATE-05 integration suite | 10f4305 | tests/integration/phase54-dal-gate.test.ts |
| 2 | Scaffold mocked-db unit suite for isMutualFollow + canViewerCommentOnTarget | 11039b6 | src/data/__tests__/reactions-comments-gate.test.ts |

## What Was Built

**Task 1 — Integration suite (`tests/integration/phase54-dal-gate.test.ts`):**
- Strict `dbUrlIsLocal` guard (localhost/127.0.0.1 check) + `SUPABASE_SERVICE_ROLE_KEY` gate; `describe.skip` otherwise (T-54-01 mitigated)
- Four fixed UUIDs in `00000000-0000-0000-0000-0000000054XX` namespace: `owner`, `mutual`, `oneWay`, `stranger`
- `beforeAll`: cleanup → insert users → update profiles → insert follows (mutual↔owner bidirectional, oneWay→owner one-directional) → insert catalog row → insert wishlist watch + owned watch for owner
- `afterAll`: cleanup in FK dependency order (comments → watches → follows → profileSettings → profiles → users)
- Eight test cases: SEC-02 (×2), GATE-01 read-gate, GATE-04 owner create + owner read, GATE-01 open path (non-wishlist), mutual path, GATE-05 (×2 — one-way false, bidirectional true)
- RED until Wave 1 (`isMutualFollow` in `follows.ts`) and Wave 2 (`createComment`, `getCommentsForTarget` in `comments.ts`) land

**Task 2 — Unit suite (`src/data/__tests__/reactions-comments-gate.test.ts`):**
- `vi.mock('@/db')` chained-mock scaffold mirroring `watches-leftjoin.test.ts`
- `selectCallCount` sentinel to assert no DB call on wear short-circuit
- `isMutualFollow` coverage: one-way→false, bidirectional→true, empty rows→false
- `canViewerCommentOnTarget` coverage: wear short-circuit (no db call asserted), watch-not-found→false, owner bypass→true, owned/sold/grail open→true, wishlist+mutual→true, wishlist+non-mutual→false
- `getLikesForTarget` Pitfall 1 coverage: null aggregate row→{count:0, viewerHasLiked:false}, empty rows→same, normal row
- Per-call `mockImplementation` for multi-call branches (watch row fetch + isMutualFollow aggregate)
- RED until Wave 1+2 land

## Deviations from Plan

None — plan executed exactly as written.

The integration test seeds a `watchesCatalog` row before `watches` rows because `watches.catalogId` is `NOT NULL` (Phase 38 promotion). This was anticipated in the research context; no deviation required.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Both files are test-only — no production surface added.

## Known Stubs

None. Both files are test scaffolds; no stubs that would block the plan's goal. The tests are intentionally RED (Wave 0) and will be satisfied by Plans 54-02 and 54-03.

## Self-Check: PASSED

- [x] `tests/integration/phase54-dal-gate.test.ts` exists and contains `CommentGateError`, `dbUrlIsLocal`, `describe.skip`, `isMutualFollow`, imports from `@/data/comments` and `@/data/follows`
- [x] `src/data/__tests__/reactions-comments-gate.test.ts` exists and contains `vi.mock('@/db'`, imports from `@/data/follows`, `@/data/comments`, `@/data/reactions`
- [x] Both suites fail RED (unresolved imports, not structural errors in test code)
- [x] Integration suite guard logic is syntactically correct (skip fires when env vars missing)
- [x] Task 1 commit: 10f4305
- [x] Task 2 commit: 11039b6
- [x] No DAL implementation files created or modified
