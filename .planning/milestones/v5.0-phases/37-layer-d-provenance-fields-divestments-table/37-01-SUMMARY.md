---
phase: 37-layer-d-provenance-fields-divestments-table
plan: 01
subsystem: database
tags: [drizzle, schema, pgenum, typescript, postgres]

# Dependency graph
requires:
  - phase: 36-layer-c-variant-split-clean-slate-wipe-cat-14-not-null
    provides: watchVariants pgTable structural template + watches.catalogId nullable deferral (L-09)
  - phase: 35-layer-b-catalog-enrichment
    provides: movementTypeEnum pgEnum pattern + watchEraEnum definitions
provides:
  - conditionGradeEnum, currencyCodeEnum, boxPapersStatusEnum pgEnum exports in src/db/schema.ts
  - 7 nullable provenance columns on watches pgTable (serial, yearOfAcquisition, condition, boxPapers, serviceHistory, paidCurrency, purchaseDate)
  - divestments pgTable export with 10 columns + 3 indexes
  - ConditionGrade, CurrencyCode, BoxPapersStatus TypeScript type aliases
  - Divestment interface in src/lib/types.ts
  - CONDITION_GRADES, CURRENCY_CODES, BOX_PAPERS_STATUSES as-const arrays
  - CONDITION_GRADE_LABELS, BOX_PAPERS_LABELS Record maps in src/lib/constants.ts
affects: [37-02, 37-03, 37-04, 37-05, 38-dal-not-null-tightening, seed-002-recommender]

# Tech tracking
tech-stack:
  added: [drizzle-orm date column type]
  patterns:
    - pgEnum bare-name convention (condition_grade not condition_grade_enum) per CONTEXT.md D-02/D-03/D-05
    - divestments FK pattern: catalog_id RESTRICT, user_id CASCADE, replaced_by_catalog_id SET NULL
    - nullable-by-default provenance columns (no .notNull() on any of the 7 new watches columns)

key-files:
  created: []
  modified:
    - src/db/schema.ts
    - src/lib/types.ts
    - src/lib/constants.ts

key-decisions:
  - "pgEnum pg-names are bare (condition_grade / currency_code / box_papers_status) — no _enum suffix, matching CONTEXT.md D-02/D-03/D-05 and Supabase migration CREATE TYPE names"
  - "watches.catalogId .notNull() deferral from Phase 36 Plan 01 Rule 4 is preserved — no tightening in Phase 37 (L-09)"
  - "No UNIQUE constraint on divestments(userId, catalogId) — D-13 soft convention: 1:1 per-user sell is convention, not schema invariant"
  - "CurrencyCode NOT imported in constants.ts — codes are display-self-explanatory; no CURRENCY_CODE_LABELS map"

patterns-established:
  - "pgEnum exports follow bare-name pattern (no _enum suffix) when CONTEXT.md specifies exact pg type name"
  - "Provenance fields grouped with Phase tag comment block inside the watches pgTable definition"
  - "Divestment table placed between watchVariants and watchesCatalogDailySnapshots"

requirements-completed: [CAT-18]

# Metrics
duration: 4min
completed: 2026-05-11
---

# Phase 37 Plan 01: Schema Foundation Summary

**3 pgEnums (condition_grade/currency_code/box_papers_status) + 7 nullable provenance columns on watches + divestments pgTable with per-user RLS shape exported from src/db/schema.ts, src/lib/types.ts, src/lib/constants.ts**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-11T00:00:18Z
- **Completed:** 2026-05-11T00:04:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Drizzle TypeScript schema extended with 3 new pgEnum exports mirroring D-02/D-03/D-05 exact pg type names (no _enum suffix)
- 7 nullable collector provenance columns added inside watches pgTable after imageUrl, before catalogId (L-09 preserved)
- New divestments pgTable added with 10 columns + 3 indexes (user_id, catalog_id, composite user+divestedAt), no UNIQUE constraint per D-13
- ConditionGrade / CurrencyCode / BoxPapersStatus type aliases + Divestment interface added to src/lib/types.ts
- CONDITION_GRADES / CURRENCY_CODES / BOX_PAPERS_STATUSES as-const arrays + CONDITION_GRADE_LABELS / BOX_PAPERS_LABELS label maps added to constants.ts
- tsc baseline preserved: 0 new errors from any of the 3 modified files (pre-existing ~29 errors in test files unchanged)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend src/db/schema.ts** - `ce5a5cb` (feat)
2. **Task 2: Extend src/lib/types.ts** - `c111643` (feat)
3. **Task 3: Extend src/lib/constants.ts** - `0a111eb` (feat)

## Files Created/Modified

- `src/db/schema.ts` — +72 lines: `date` import added; 3 pgEnum exports (conditionGradeEnum, currencyCodeEnum, boxPapersStatusEnum); 7 nullable watches columns; divestments pgTable
- `src/lib/types.ts` — +46 lines: ConditionGrade, CurrencyCode, BoxPapersStatus type aliases; 7 optional Watch fields; Divestment interface
- `src/lib/constants.ts` — +41 lines, -1 line: import updated; CONDITION_GRADES, CONDITION_GRADE_LABELS, CURRENCY_CODES, BOX_PAPERS_STATUSES, BOX_PAPERS_LABELS exported

## pgEnum Names + Values (for Plan 02 + 03 mirror)

| Drizzle export | pg type name | Values |
|---|---|---|
| `conditionGradeEnum` | `condition_grade` | `mint`, `near_mint`, `excellent`, `good`, `fair`, `poor` |
| `currencyCodeEnum` | `currency_code` | `USD`, `EUR`, `GBP`, `JPY`, `CHF`, `AUD`, `CAD`, `HKD`, `SGD`, `CNY` |
| `boxPapersStatusEnum` | `box_papers_status` | `none`, `box_only`, `papers_only`, `full_set` |

## divestments Column Order (for Plan 02 CREATE TABLE + Plan 05 column-presence assertion)

Column order in pgTable definition (matches `information_schema.columns` `ordinal_position`):
1. `id` (uuid PK)
2. `catalog_id` (uuid NOT NULL FK → watches_catalog ON DELETE RESTRICT)
3. `user_id` (uuid NOT NULL FK → users ON DELETE CASCADE)
4. `divested_at` (timestamptz NOT NULL DEFAULT now())
5. `replaced_by_catalog_id` (uuid nullable FK → watches_catalog ON DELETE SET NULL)
6. `sale_price` (real nullable)
7. `sale_currency` (currency_code nullable)
8. `notes` (text nullable)
9. `created_at` (timestamptz NOT NULL DEFAULT now())
10. `updated_at` (timestamptz NOT NULL DEFAULT now())

Indexes: `divestments_user_id_idx`, `divestments_catalog_id_idx`, `divestments_user_divested_at_idx` (composite user_id + divested_at)
No UNIQUE constraint (D-13).

## L-09 Confirmation

`watches.catalogId` Drizzle definition at line 125 of schema.ts is UNCHANGED:
```typescript
catalogId: uuid('catalog_id').references(() => watchesCatalog.id, { onDelete: 'set null' }),
```
No `.notNull()` added. Phase 36 Plan 01 Rule 4 deferral honored. Phase 38 owns the DAL flow rewrite.

## Pre/Post tsc Error Counts

- **Pre-edit baseline:** 31 lines of tsc output (pre-existing errors in tests and layout.tsx)
- **Post-edit count:** 31 lines of tsc output (identical baseline)
- **New errors from src/db/schema.ts:** 0
- **New errors from src/lib/types.ts:** 0
- **New errors from src/lib/constants.ts:** 0
- **Result:** BASELINE PRESERVED

## Decisions Made

- pgEnum bare-name convention used (condition_grade not condition_grade_enum) per CONTEXT.md D-02/D-03/D-05 exact specification — differs from movementTypeEnum which uses movement_type_enum suffix
- watches.catalogId remains nullable in Drizzle (L-09 deferral from Phase 36 Plan 01 Rule 4)
- No UNIQUE constraint on divestments — D-13 soft-convention confirmed (catalog_id re-use across collectors/re-buys is intentional)
- CurrencyCode not imported in constants.ts — codes are display-self-explanatory; only ConditionGrade and BoxPapersStatus imported for their label maps

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Threat Flags

No new wire surface introduced. All 3 files are TypeScript source only — no network endpoints, auth paths, file access patterns, or DB trust boundaries in this plan.

## Known Stubs

None — this plan introduces no UI rendering or data display.

## User Setup Required

None — no external service configuration required. Plan 02 (Supabase migration) carries the authoritative DDL.

## Next Phase Readiness

- Plan 02 (Supabase migration) can `CREATE TYPE condition_grade AS ENUM ('mint', 'near_mint', 'excellent', 'good', 'fair', 'poor')` + `ALTER TABLE watches ADD COLUMN ...` + `CREATE TABLE divestments` matching column order above
- Plan 03 (Drizzle migration twin) can mirror with `ADD COLUMN IF NOT EXISTS` guards using enum column types quoted as `"condition_grade"` etc.
- Plan 04 (Server Action + UI) can `import { divestments } from '@/db/schema'` and `import type { Divestment, ConditionGrade, CurrencyCode, BoxPapersStatus } from '@/lib/types'` and `import { CONDITION_GRADES, CURRENCY_CODES, BOX_PAPERS_STATUSES, CONDITION_GRADE_LABELS, BOX_PAPERS_LABELS } from '@/lib/constants'`

---
*Phase: 37-layer-d-provenance-fields-divestments-table*
*Completed: 2026-05-11*

## Self-Check: PASSED

- FOUND: src/db/schema.ts
- FOUND: src/lib/types.ts
- FOUND: src/lib/constants.ts
- FOUND: .planning/phases/37-layer-d-provenance-fields-divestments-table/37-01-SUMMARY.md
- FOUND: ce5a5cb (Task 1 commit)
- FOUND: c111643 (Task 2 commit)
- FOUND: 0a111eb (Task 3 commit)
- FOUND: 1cefd16 (SUMMARY commit)
- All 4 key schema exports verified
- All 4 key type exports verified
- All 3 key constants exports verified
