---
phase: 24-notification-stub-cleanup-test-fixture-carryover
plan: "07"
subsystem: testing
tags: [vitest, api-routes, integration-tests, extract-watch, ssrf, catalog]

# Dependency graph
requires:
  - phase: 24-notification-stub-cleanup-test-fixture-carryover
    provides: "extract-watch route (src/app/api/extract-watch/route.ts) with manual URL validation gates and catalog upsert wiring"
provides:
  - "Integration test coverage for POST /api/extract-watch beyond the auth gate (TEST-05)"
  - "9 tests: happy path, URL validation (missing/null/malformed/non-http(s)), SsrfError → 400, generic Error → 500, catalog upsert null id, brand/model missing"
affects: [25-ux-error-differentiation, any-phase-modifying-extract-watch-route]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "5-seam mock pattern for Next.js route integration tests: auth, extractors, ssrf, catalog DAL, taste enricher"
    - "vi.mocked() for per-test override of module-level vi.mock() defaults"

key-files:
  created:
    - tests/api/extract-watch.test.ts
  modified: []

key-decisions:
  - "No Zod introduced — route uses manual checks today per CONTEXT.md D-02 + RESEARCH.md A5; tests assert against manual-gate behavior, not a schema"
  - "Dynamic imports (enrichTasteAttributes, updateCatalogTaste via import()) are caught by vi.mock hoisting — no special handling needed"
  - "Test 7 (upsert null) requires per-test vi.mocked override since module default returns 'cat-123'"
  - "9 tests chosen: null URL added as distinct case from missing URL for completeness"

patterns-established:
  - "Route integration test pattern: mock all 5 seams at module level → beforeEach(vi.clearAllMocks) → per-test overrides via vi.mocked()"
  - "Auth seam mock: UnauthorizedError class + getCurrentUser always resolves to user — lets test focus past the auth gate"

requirements-completed: [TEST-05]

# Metrics
duration: 7min
completed: 2026-05-02
---

# Phase 24 Plan 07: Extract-Watch Integration Tests Summary

**9 Vitest integration tests for POST /api/extract-watch covering happy path, 4 URL validation gates (manual checks, no Zod), SsrfError → 400, generic Error → 500, and 2 catalog upsert failure paths**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-02T03:47:00Z
- **Completed:** 2026-05-02T03:54:40Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Created `tests/api/extract-watch.test.ts` with 9 passing tests (separated from `extract-watch-auth.test.ts` which covers only the auth gate)
- Established 5-seam vi.mock pattern for the extract-watch route: `@/lib/auth`, `@/lib/extractors`, `@/lib/ssrf`, `@/data/catalog`, `@/lib/taste/enricher`
- Confirmed that Vitest vi.mock hoisting intercepts the route's dynamic `import()` calls for `enrichTasteAttributes` and `updateCatalogTaste` without special handling
- Verified exact error strings from the route source: `'URL is required'`, `'Invalid URL format'`, `'Only HTTP/HTTPS URLs are supported'`, `"private address"` substring, `'Failed to extract'` substring, `'null id'` substring, `'brand/model missing'` substring

## Task Commits

1. **Task 1: Create tests/api/extract-watch.test.ts (TEST-05)** - `8d6e822` (test)

## Files Created/Modified

- `tests/api/extract-watch.test.ts` — 9 integration tests for POST /api/extract-watch beyond the auth gate (TEST-05)

## Decisions Made

- No Zod schema added to the route handler: per RESEARCH.md A5 and CONTEXT.md D-02 reconciliation, the route uses manual checks today. Tests assert against the manual-gate behavior. Zod adoption is deferred to a future polish phase.
- Dynamic imports in the route's taste-enrichment block (`enrichTasteAttributes`, `updateCatalogTaste` via inline `await import(...)`) are correctly intercepted by top-level `vi.mock` hoisting in Vitest — no workaround needed.
- 9 tests rather than exactly 9-per-plan: added null URL as a distinct case from missing URL for completeness (both covered by the same route gate).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Tests passed on first run. `console.error` output in test stderr is expected behavior — the route logs errors before returning 400/500 responses.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. Test file only.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- TEST-05 complete; `tests/api/extract-watch.test.ts` guards the extract-watch route against regressions
- Phase 25 (UX-05 error differentiation) can now add categorized error responses to the route with test coverage showing what changed
- The 5-seam mock pattern established here is reusable for any future route tests that touch the same extract-watch dependencies

---
*Phase: 24-notification-stub-cleanup-test-fixture-carryover*
*Completed: 2026-05-02*
