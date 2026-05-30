---
phase: 67-server-action-dal-extensions
plan: 03
subsystem: api
tags: [server-action, zod, catalog, addWatch, typescript]

# Dependency graph
requires:
  - phase: 67-server-action-dal-extensions (plans 01-02)
    provides: getCatalogById DAL function + searchCatalogForAddFlow action (consumed transitively)
provides:
  - insertWatchSchema extended with optional catalogId (CONF-11)
  - addWatch catalogId-supplied branch: D-09 fail-fast, D-10 server-side identity override, D-11 enrichment-skip gate
  - Pitfall 3 fix: enrichTasteAttributes spec reads cleanData (post-override), not parsed.data
  - 5 CONF-11 integration tests in tests/actions/watches.test.ts
affects:
  - Phase 68 (ConfirmStep consumes addWatch with catalogId)
  - Phase 70 (AddWatchFlow rewrite uses this catalogId passthrough)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "catalogId-supplied branch inserted BEFORE wishlist-sortOrder block so D-10 override lands before createPayload spread"
    - "alreadyEnriched guard wraps both photo write-through and enrichTasteAttributes blocks"
    - "Pitfall 3 fix: spec identity fields read from cleanData (mutable post-destructure object), not parsed.data (immutable Zod output)"

key-files:
  created: []
  modified:
    - src/app/actions/watches.ts
    - tests/actions/watches.test.ts

key-decisions:
  - "catalogId branch inserted BEFORE wishlist-sortOrder computation (not after) so identity override is captured by createPayload spread"
  - "alreadyEnriched = catalogRowForSkipCheck != null && (catalogRowForSkipCheck.styleTags?.length ?? 0) > 0 — single check, cheapest reliable taste-pass success indicator"
  - "Test UUIDs use proper v4 UUID format (Zod z.string().uuid() validates format before DAL is called)"
  - "enrichTasteAttributes spec: identity fields (brand/model/reference) read from cleanData; non-identity fields (movement, caseSizeMm, etc.) still read from parsed.data — D-10 only overrides identity"

patterns-established:
  - "D-09 fail-fast: getCatalogById returns null → { success: false, error: 'Catalog reference not found' } — never fall back to upsert"
  - "D-10 server-side override: cleanData.brand/model/reference overwritten from catalogRow before createPayload build"
  - "D-11 always-run: logActivity, findOverlapRecipients+logNotification, revalidatePath/revalidateTag are NOT inside any catalogId-conditional"

requirements-completed:
  - CONF-11

# Metrics
duration: 35min
completed: 2026-05-29
---

# Phase 67 Plan 03: addWatch catalogId branch (D-09/D-10/D-11) Summary

**addWatch action extended with optional catalogId passthrough: fail-fast on missing row (D-09), server-side brand/model/reference override from catalog row (D-10), and enrichment-skip gate when styleTags already populated (D-11)**

## Performance

- **Duration:** 35 min
- **Started:** 2026-05-29T17:15:00Z
- **Completed:** 2026-05-29T17:50:00Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Extended `insertWatchSchema` with `catalogId: z.string().uuid().optional()` (CONF-11) — the derived `updateWatchSchema = insertWatchSchema.partial()` picks it up automatically
- Implemented catalogId-supplied branch in `addWatch` with D-09 fail-fast (null row → ActionResult error, no fallback upsert), D-10 server-side identity override (cleanData.brand/model/reference overwritten from catalogRow), and D-11 enrichment-skip gate (alreadyEnriched wraps photo write-through + enrichTasteAttributes blocks)
- Fixed Pitfall 3: `enrichTasteAttributes spec:` now reads `cleanData.brand`, `cleanData.model`, `cleanData.reference` (post-D-10 override) instead of the old `parsed.data.*` reads (raw client input)
- Branch re-ordering decision: catalogId-resolution block inserted BEFORE wishlist-sortOrder computation so the D-10 override is captured by the `createPayload` spread
- All ALWAYS-RUN side-effects (logActivity, findOverlapRecipients+logNotification, revalidatePath/revalidateTag) remain unconditional
- 5 new CONF-11 integration tests pass (cases a-e); all 27 existing tests in the file pass; build exits 0

## Task Commits

1. **Task 1: Extend insertWatchSchema + addWatch with catalogId branch (D-09/D-10/D-11) AND add 5 integration tests** - `bdac143b` (feat)

**Plan metadata:** (created below)

## Files Created/Modified

- `src/app/actions/watches.ts` — insertWatchSchema field addition (line 48) + catalogId-supplied branch (lines 120-158) + alreadyEnriched guard (lines 171-172) + Pitfall 3 fix in enrichTasteAttributes spec (lines 219-221)
- `tests/actions/watches.test.ts` — getCatalogById added to vi.mock catalog block (line 39); `import * as catalogDAL from '@/data/catalog'` added; 5-case CONF-11 describe block appended

## Decisions Made

- **Branch placement before wishlist-sortOrder**: The catalogId-resolution block was inserted BEFORE the wishlist-sortOrder computation so the D-10 override (cleanData.brand/model/reference) is captured when `createPayload` is built as `{ ...cleanData, sortOrder: maxSort + 1 }`. If it were inserted after, the spread would have captured the pre-override values.
- **Test UUIDs must be valid v4 UUIDs**: The initial test fixtures used short strings like `'cat-uuid-1'` which fail Zod's `z.string().uuid()` validation before the DAL is ever called. Fixed by using real UUID-format strings (e.g. `'11111111-2222-4333-8444-555555555555'`).
- **alreadyEnriched wraps both photo write-through AND enrichTasteAttributes**: D-11 CONTEXT.md specification says both blocks skip together when styleTags are non-empty. This avoids the signed-URL roundtrip (photo write-through) AND the LLM call (enrichment) on already-enriched catalog rows.
- **Non-identity spec fields keep parsed.data reads**: Only brand/model/reference are overridden (D-10); movement, caseSizeMm, lugToLugMm, waterResistanceM, crystalType, dialColor, isChronometer, productionYear, complications still read from parsed.data (client-supplied).

## Deviations from Plan

None - plan executed exactly as written. The test UUID format issue was caught and fixed during test authoring (not a separate deviation — test was never committed in broken form).

## Issues Encountered

None beyond the UUID format discovery during test writing (corrected before first commit).

## Known Stubs

None - no stubs introduced. The catalogId branch either succeeds (calls createWatch with the resolved catalogId) or returns an ActionResult error (fail-fast D-09). No hardcoded values flow to any rendering path.

## Threat Surface Scan

No new network endpoints, auth paths, or trust boundaries introduced. The catalogId branch reads from `watches_catalog` (public-read by design per T-67-03-03 — catalog rows are not user-private). The threat mitigations documented in the plan's threat model are all implemented:
- T-67-03-01 (Tampering — client brand/model): mitigated by D-10 server-side override (test case c asserts this)
- T-67-03-02 (Tampering — fabricated catalogId pointing to missing row): mitigated by D-09 fail-fast (test case b asserts this)
- T-67-03-04 (EoP — unauthenticated caller): existing AUTH-04 gate runs before any new code
- T-67-03-05 (Tampering — invalid UUID format): Zod `z.string().uuid()` rejects at parse time

## Self-Check

Files verified to exist:
- [x] `src/app/actions/watches.ts` (modified)
- [x] `tests/actions/watches.test.ts` (modified)

Commits verified:
- [x] `bdac143b` feat(67-03): extend addWatch + insertWatchSchema with catalogId branch

## Self-Check: PASSED

## Next Phase Readiness

- Phase 68 (ConfirmStep) can now call `addWatch({ ...data, catalogId })` with the catalogId surfaced by Phase 67 Plan 02's typeahead. The D-09 error string `'Catalog reference not found'` flows through the ActionResult to the ConfirmStep UI.
- Phase 70 (AddWatchFlow rewrite) benefits from the catalogId branch preventing duplicate catalog rows when users pick from typeahead.
- No blockers.

---
*Phase: 67-server-action-dal-extensions*
*Completed: 2026-05-29*
