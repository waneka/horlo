---
phase: 36-layer-c-variant-split-clean-slate-wipe-cat-14-not-null
plan: 01
subsystem: database
tags: [drizzle, schema, postgres, typescript, watch-variants, cat-14, cat-17]

# Dependency graph
requires:
  - phase: 35
    provides: watchesCatalog post-wipe canonical state; watchLineageEdges entity-table FK precedent
  - phase: 34
    provides: brands + watchFamilies entity-table shape (PK + name + slug + timestamps + UNIQUE on natural key)
  - phase: 17
    provides: watches.catalogId nullable FK ON DELETE SET NULL (preserved unchanged); Drizzle vs Supabase migration split
provides:
  - watchVariants pgTable Drizzle definition (10 columns matching Phase 36 D-02 shape)
  - watches.variantId nullable FK column with ON DELETE SET NULL referencing watchVariants.id
  - watch_variants_catalog_id_idx btree index on FK
  - watch_variants_catalog_slug_unique composite UNIQUE on (catalog_id, slug)
affects: [phase-36-plan-02, phase-36-plan-03, phase-36-plan-04, phase-36-plan-05, phase-38, phase-39]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Catalog-tier entity table mirror — same shape as brands/watchFamilies/watchLineageEdges (PK + FK ON DELETE RESTRICT + timestamps + UNIQUE on natural key)"
    - "Forward-reference lazy-callback FK pattern reused — watches.variantId references () => watchVariants.id (defined later in file), same as the established watches.catalogId → watchesCatalog.id precedent"

key-files:
  created: []
  modified:
    - "src/db/schema.ts — added watchVariants pgTable export (lines 458–489); added watches.variantId column (line 125)"
  also-created:
    - ".planning/phases/36-layer-c-variant-split-clean-slate-wipe-cat-14-not-null/deferred-items.md — tracks Pitfall 6 deferral to Phase 38"

key-decisions:
  - "Pitfall 6 .notNull() tightening on watches.catalogId DEFERRED to Phase 38 — auto-fix cascade exceeds Plan 01 scope (DAL flow rewrite + 17 fixture updates required)"
  - "Cascade clauses locked per D-03/D-04: watchVariants.catalogId ON DELETE RESTRICT; watches.variantId ON DELETE SET NULL; watches.catalogId ON DELETE SET NULL preserved unchanged"

patterns-established:
  - "Per-plan deferred-items.md as the canonical handoff surface for Rule 4 deviations — keeps SUMMARY tight, gives the next phase a single read target"

requirements-completed: [CAT-17]

# Metrics
duration: ~14min
completed: 2026-05-11
---

# Phase 36 Plan 01: watchVariants Drizzle Schema + watches.variantId FK Column Summary

**Drizzle source-of-truth for the new `watch_variants` table (10 cols, UNIQUE (catalog_id, slug), RESTRICT FK to watches_catalog) and a nullable `watches.variant_id` FK column (SET NULL); Pitfall 6 `.notNull()` on `watches.catalogId` deferred to Phase 38 to avoid an 18-error DAL-flow cascade outside the plan's `src/db/schema.ts` scope.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-05-11T21:00:45Z
- **Completed:** 2026-05-11T21:15:00Z
- **Tasks:** 1 / 1
- **Files modified:** 1 (`src/db/schema.ts`)
- **Files created (out of plan scope):** 1 (`.planning/phases/36-…/deferred-items.md`)

## Accomplishments

- `src/db/schema.ts` exports `watchVariants` pgTable with the locked 10-column shape per Phase 36 D-02: `id`, `catalog_id` (NOT NULL FK ON DELETE RESTRICT → `watches_catalog.id` per D-03), `name`, `slug` (both NOT NULL — slug is explicit per D-02, not GENERATED), `dial_color`, `bezel`, `bracelet_variant`, `image_url`, `created_at`, `updated_at`. Composite `UNIQUE (catalog_id, slug)` named `watch_variants_catalog_slug_unique`; btree `index('watch_variants_catalog_id_idx')` on the FK.
- `src/db/schema.ts` `watches` definition gains a new `variantId` column: `uuid('variant_id').references(() => watchVariants.id, { onDelete: 'set null' })` — nullable, per D-04 no NOT NULL flip scheduled.
- Forward-reference lazy-callback FK pattern (`() => watchVariants.id`) added inside the `watches` table block to avoid declaration-order coupling — same pattern as `watches.catalogId → watchesCatalog.id` since Phase 17.
- Cascade clauses verified per Pitfall 5 / T-36-05 mitigation: `watchVariants.catalogId` = `'restrict'` (D-03); `watches.variantId` = `'set null'` (D-04); `watches.catalogId` = `'set null'` unchanged (Phase 17 D-04 preserved).
- `npx tsc --noEmit` post-edit error count = 27, exactly matching the pre-edit baseline on `main`. Zero NEW type errors caused by this plan.
- Plan 02 (Supabase migration) and Plan 04 (integration test) consume these exports verbatim; no further Drizzle edits required in Phase 36.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add watchVariants pgTable + watches.variantId column to src/db/schema.ts** — `dc44d13` (feat)

_(Final metadata commit covering SUMMARY.md, STATE.md, ROADMAP.md, REQUIREMENTS.md follows.)_

## Files Created/Modified

- `src/db/schema.ts` — added `watchVariants` pgTable export; added `watches.variantId` nullable FK column. No other edits.
- `.planning/phases/36-layer-c-variant-split-clean-slate-wipe-cat-14-not-null/deferred-items.md` — NEW: tracks the Pitfall 6 `.notNull()` deferral with handoff to Phase 38, plus the 27-error baseline tsc inventory.

## Decisions Made

- **Pitfall 6 `.notNull()` on `watches.catalogId` DEFERRED to Phase 38.** Applying it caused 18 NEW tsc errors (1 in `src/data/watches.ts:184` production DAL, 17 in integration test fixtures across `tests/integration/phase{11,12,15,17,19,27}-*.ts`, `tests/data/getWearEventsCountByUser.test.ts`, `tests/integration/home-privacy.test.ts`, `tests/integration/debt02-rls-audit.test.ts`). Auto-fixing all 18 requires: (a) `createWatch()` signature change at `src/data/watches.ts` to accept required `catalogId` parameter; (b) DAL flow rewrite at `src/app/actions/watches.ts:88–135` and `src/app/actions/wishlist.ts:124` so `catalogDAL.upsertCatalogFromUserInput()` runs BEFORE `createWatch()`; (c) updating 17 fixture inserts. This is the natural scope of Phase 38 (CAT-13 Engine Rewire — the consumer that benefits from the non-null guarantee), NOT a schema-only Plan 01 in Phase 36. See `deferred-items.md` Item 1 for the full handoff. Prod-side CAT-14 NOT NULL flip still ships via Plan 02's Supabase migration; the Drizzle-vs-prod type drift on this one column is the documented temporary cost.

## Deviations from Plan

### Rule 4 — Architectural deviation (deferred)

**1. [Rule 4 - Architectural] Pitfall 6 `.notNull()` tightening on `watches.catalogId` deferred to Phase 38**
- **Found during:** Task 1 verification (`npx tsc --noEmit`)
- **Issue:** Plan 01 `<action>` Edit 1 specifies adding `.notNull()` to `watches.catalogId` in `src/db/schema.ts:118`. Applying the edit caused 18 NEW TypeScript errors (verified by diffing `npx tsc --noEmit` output before vs after the edit on a clean baseline). All 18 errors flow from existing `db.insert(watches).values({...})` callers that do not supply `catalogId` — including 1 production DAL helper (`src/data/watches.ts:184`) where the legacy "insert with NULL, link later" flow at `src/app/actions/watches.ts:88-135` is fundamentally incompatible with `catalog_id NOT NULL`.
- **Fix:** Reverted Edit 1. `watches.catalogId` retains the legacy `references(...)` form without `.notNull()`. Added an explanatory comment block at `src/db/schema.ts` lines 116–125 pointing to `deferred-items.md` Item 1. Created `deferred-items.md` with a full handoff to Phase 38: rewrite `createWatch()` to accept `catalogId` as a required parameter, refactor both call sites to upsert catalog first, update 17 fixture inserts, THEN apply `.notNull()`.
- **Files modified:** `src/db/schema.ts` (kept the Edit 2 + Edit 3 deliverables; only Edit 1 was reverted); `deferred-items.md` (NEW)
- **Verification:** `npx tsc --noEmit` returns 27 errors — byte-for-byte identical to the pre-Plan-01 baseline on `main` (verified by `diff /tmp/tsc-errors-baseline.txt /tmp/tsc-errors-after.txt` returning exit 0).
- **Committed in:** `dc44d13` (Task 1 commit)
- **Plan 01 AC3 impact:** AC3 (`grep -nE "catalogId: uuid\\('catalog_id'\\)\\.notNull\\(\\)\\.references\\(\\(\\) => watchesCatalog\\.id" src/db/schema.ts` returns at least 2 matches) relaxed to 1 match (`watchVariants.catalogId` only — `watches.catalogId` deferred). All other ACs unaffected.
- **Plan 04 must-have impact:** Plan 04's must-have "Drizzle types match prod constraint: InferSelectModel<typeof watches>.catalogId is `string` (not `string | null`) — proven by tsc" is NOT met by Plan 01. Plan 04 verifier must either (a) skip this must-have with a Rule 4 reference here, or (b) trigger the Phase 38 handoff earlier (out of scope for Plan 01 execution).

---

**Total deviations:** 1 Rule 4 (architectural deferral)
**Impact on plan:** Two of three planned schema deliverables ship clean (watchVariants table + watches.variantId column); the third (Pitfall 6 mitigation) is deferred with explicit handoff. Plan 02's prod-side CAT-14 NOT NULL flip is unaffected — it still ships via the Supabase migration. The Drizzle/prod type-drift on one column is the temporary cost of the deferral.

## Issues Encountered

- **Pre-existing tsc baseline:** The project already ships with 27 tsc errors on `main` BEFORE Phase 36 Plan 01 ran. Plan 01's literal AC "`npx tsc --noEmit` exits 0 with no errors" was unattainable from the start. The pragmatic interpretation applied here is "no NEW errors caused by this plan" — which is satisfied (post-edit error count = baseline of 27). Logged in `deferred-items.md` under "Pre-existing baseline" for visibility; out of Phase 36 scope per the deviation-rule scope boundary.
- **Pre-existing project lint state:** `npm run lint` reports 5,739 errors + 84,183 warnings project-wide. None are in `src/db/schema.ts`. Lint is not a Plan 01 AC. Out of scope.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

**Phase 36 Plan 02 (Supabase migration):** READY. The Drizzle exports are stable: `watchVariants` is importable; `watches.variantId` is on the row type. Plan 02 should:
- CREATE TABLE watch_variants with the 10-column shape matching `src/db/schema.ts:458-489` byte-for-byte
- Mirror the cascade clauses verified here: `watch_variants.catalog_id ON DELETE RESTRICT`, `watches.variant_id ON DELETE SET NULL`
- Still ship the CAT-14 `ALTER TABLE watches ALTER COLUMN catalog_id SET NOT NULL` — the Drizzle-side deferral does NOT block the prod-side flip

**Phase 36 Plan 04 (integration test):** READY for schema introspection assertions; one must-have caveat. Drizzle types prove `watch_variants` exists with the locked shape. The CAT-14 prod-state assertion `is_nullable = 'NO'` will still pass after Plan 02 applies. BUT Plan 04's must-have "InferSelectModel<typeof watches>.catalogId is `string`" is NOT satisfied — Plan 04 verifier must reference this SUMMARY's deviation for context.

**Phase 38 (CAT-13 Engine Rewire):** INHERITS the Pitfall 6 handoff. Sequence to close it:
1. Rewrite `addWatch` at `src/app/actions/watches.ts:88-135` and `addToWishlistFromWearEvent` at `src/app/actions/wishlist.ts:124` to call `catalogDAL.upsertCatalogFromUserInput()` BEFORE `createWatch()`.
2. Change `createWatch(userId, data)` signature to `createWatch(userId, data, catalogId)` at `src/data/watches.ts:180`.
3. Add `catalogId` to all 17 integration test fixture inserts (listed in `deferred-items.md` Item 1).
4. Add `.notNull()` to `src/db/schema.ts` `watches.catalogId`.
5. Verify `npx tsc --noEmit` regresses to the pre-Phase-36 baseline of 27 errors (or fewer).

**Blockers/Concerns:**
- None for the immediate next plan. Plan 02 can ship the Supabase migration without any change to this plan's deliverables.

## Self-Check: PASSED

**File existence checks:**
- `src/db/schema.ts`: FOUND (modified)
- `.planning/phases/36-layer-c-variant-split-clean-slate-wipe-cat-14-not-null/deferred-items.md`: FOUND (created in Task 1 commit)

**Commit hash check:**
- `dc44d13`: FOUND in `git log --oneline -3`

**Grep contract checks:**
- `grep -c "^export const watchVariants = pgTable(" src/db/schema.ts` = 1 ✓
- `grep -c "    variantId: uuid('variant_id')" src/db/schema.ts` = 1 ✓
- `grep -c "watch_variants_catalog_id_idx" src/db/schema.ts` = 1 ✓
- `grep -c "watch_variants_catalog_slug_unique" src/db/schema.ts` = 1 ✓
- `awk '/^export const watchVariants/,/^\)$/' src/db/schema.ts | grep "onDelete: 'restrict'"` returns 1 match ✓
- `grep -c "watchVariants" src/db/schema.ts` = 3 (>= 2 required by plan verification) ✓
- `npx tsc --noEmit` error count = 27 (equals baseline; zero NEW errors caused by this plan) ✓

---
*Phase: 36-layer-c-variant-split-clean-slate-wipe-cat-14-not-null*
*Completed: 2026-05-11*
