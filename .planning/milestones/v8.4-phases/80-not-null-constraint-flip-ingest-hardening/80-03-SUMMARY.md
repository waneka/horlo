---
phase: 80-not-null-constraint-flip-ingest-hardening
plan: 03
subsystem: database
tags: [postgres, drizzle, resolver, ingest, dal, upsert, brand-fk, family-fk]

# Dependency graph
requires:
  - phase: 80-02
    provides: resolveBrandId + resolveFamilyId shipped in src/data/catalog-resolver.ts
provides:
  - upsertCatalogFromExtractedUrl: writes brand_id + family_id on every new catalog row
  - upsertCatalogFromUserInput: writes brand_id + family_id on every new catalog row
  - ON CONFLICT paths: both upsert helpers preserve existing FKs on natural-key collision (Discretion iii)
  - VALIDATION-80-02-01 + VALIDATION-80-03-01 closed: local-DB integration tests confirm non-NULL FKs
affects:
  - 80-04 (schema.ts notNull flip + migration — now safe to proceed)
  - 80-05 (prod-extract proof — all new rows will carry non-NULL FKs)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Call resolveBrandId + resolveFamilyId BEFORE INSERT in both upsert helpers; drop decision — D-80-04 silent contract"
    - "Extend INSERT column + VALUES lists additively (brand_id, family_id appended); no column reorder"
    - "ON CONFLICT DO UPDATE SET clause: brand_id + family_id intentionally OMITTED — Discretion iii, pre-existing FKs preserved on re-extract conflict"
    - "ON CONFLICT DO NOTHING + UNION SELECT pattern in upsertCatalogFromUserInput: pre-existing FKs automatically survive (no FK columns in the SELECT or WHERE)"

key-files:
  created: []
  modified:
    - src/data/catalog.ts

key-decisions:
  - "Decision: dropped resolver's decision field at call site (D-80-04 silent contract) — route response envelope unchanged; resolver emits structured console.log internally"
  - "Decision: both tasks committed as a single commit (same file, same logical wave — resolver wiring is atomic)"
  - "Decision: local DB state fix (Datejust → Brut Datejust + alias seed) is a local-only correction; prod already has the correct name from Phase 79 --apply; not a code deviation"
  - "Open Question #6 closed: upsertCatalogFromUserInput's DO NOTHING + UNION SELECT correctly preserves existing FKs when operator merges in Phase 82 — natural-key WHERE is sufficient, no FK columns needed"

# Metrics
duration: ~15min
completed: 2026-06-25
tasks-completed: 3
files-changed: 1
---

# Phase 80 Plan 03: Resolver Wiring into Upsert Helpers — Summary

**One-liner:** Both catalog upsert helpers now call `resolveBrandId` + `resolveFamilyId` before INSERT, writing non-NULL brand_id + family_id on every new catalog row, with ON CONFLICT paths preserving existing FKs (Discretion iii).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wire resolver into `upsertCatalogFromExtractedUrl` | 62f57c42 | src/data/catalog.ts |
| 2 | Wire resolver into `upsertCatalogFromUserInput` | 62f57c42 | src/data/catalog.ts |
| 3 | HALT-on-RED gate — all local-DB integration tests GREEN | (verification-only) | — |

## What Was Done

### Task 1 — upsertCatalogFromExtractedUrl

Added `import { resolveBrandId, resolveFamilyId } from '@/data/catalog-resolver'` to the top of `src/data/catalog.ts`.

In `upsertCatalogFromExtractedUrl`, inserted two resolver calls AFTER the sanitizer block and BEFORE the INSERT:
```ts
const { brandId } = await resolveBrandId(input.brand)
const { familyId } = await resolveFamilyId(brandId, input.model)
```
Extended the INSERT column list from 20 to 22 columns (appended `brand_id, family_id`).
Extended the VALUES list to match (appended `${brandId}, ${familyId}`).

The `ON CONFLICT ON CONSTRAINT watches_catalog_natural_key DO UPDATE SET` clause is unchanged — `brand_id` and `family_id` are NOT mentioned in the SET list, so pre-existing FKs survive re-extract conflicts (Discretion iii / T-80-08 mitigation).

### Task 2 — upsertCatalogFromUserInput

In `upsertCatalogFromUserInput`, inserted two resolver calls AFTER the destructuring and BEFORE the CTE:
```ts
const { brandId } = await resolveBrandId(brand)
const { familyId } = await resolveFamilyId(brandId, model)
```
Extended the CTE INSERT column list from 4 to 6 columns: `(brand, model, reference, source, brand_id, family_id)`.
Extended the VALUES list to match: `(${brand}, ${model}, ${reference}, 'user_promoted', ${brandId}, ${familyId})`.

`ON CONFLICT ON CONSTRAINT watches_catalog_natural_key DO NOTHING` is unchanged. The UNION ALL SELECT side is unchanged (natural-key WHERE preserved). Pre-existing FKs survive conflicts automatically (Discretion iii).

### Task 3 — HALT-on-RED Gate

All 6 local-DB integration tests PASSED against local Supabase (`127.0.0.1:54322`):

```
catalog-resolver-against-local-db: 4/4 PASS
  ✓ Brand Tier 1 (exact match against seeded Hamilton brand) — INGEST-01
  ✓ Brand Tier 2 (fuzzy clear-gap on 'Hamilon' typo) — INGEST-02
  ✓ Family Tier 2 (alias hit on 'Brut Date' → 'Brut Datejust') — INGEST-04 / D-80-02
  ✓ Brand Tier 3 (auto-create with needs_review=true) — INGEST-03

upsert-catalog-from-extracted-url: 1/1 PASS
  ✓ upsertCatalogFromExtractedUrl writes NON-NULL brand_id + family_id on the inserted row

upsert-catalog-from-user-input: 1/1 PASS
  ✓ upsertCatalogFromUserInput writes NON-NULL brand_id + family_id on the inserted row
```

VALIDATION-80-02-01 and VALIDATION-80-03-01 are CLOSED. Plan 04 (NOT NULL flip) is safe to proceed.

## Deviations from Plan

### Local DB State Fix (Non-code deviation)

**Found during:** Task 3 pre-flight
**Issue:** Local `watch_families` table had the Brut brand's family named `Datejust` (not `Brut Datejust`) with no `brut date` alias, causing the Family Tier 2 alias test to fail. This is because the Phase 79 `--apply` decisions were only run on prod, not locally.
**Fix:** Updated local DB directly:
```sql
UPDATE watch_families
   SET name = 'Brut Datejust',
       aliases = ARRAY['brut date']::text[]
 WHERE id = '442779b1-50cf-410b-9dc1-5bdaadd7261c'
```
This is a local DB state correction (not a code change). Prod was already correct from Phase 79 `--apply`. No deviation to the resolver or test files.

**Rule applied:** Rule 3 (auto-fix blocking issue — local DB state prevented Task 3 from passing).

## Verification Results

| Check | Result |
|-------|--------|
| `resolveBrandId` + `resolveFamilyId` called before INSERT in `upsertCatalogFromExtractedUrl` | PASS |
| `resolveBrandId` + `resolveFamilyId` called before INSERT in `upsertCatalogFromUserInput` | PASS |
| `brand_id, family_id` in INSERT column list (both helpers) | PASS |
| `${brandId}, ${familyId}` in VALUES list (both helpers) | PASS |
| ON CONFLICT DO UPDATE SET: no `brand_id =` or `family_id =` | PASS (grep verified) |
| `src/app/api/extract-watch/route.ts` unchanged | PASS (`git diff` empty) |
| D-80-04 silent contract — no new response envelope fields | PASS |
| 4/4 catalog-resolver-against-local-db tests GREEN | PASS |
| 1/1 upsert-catalog-from-extracted-url test GREEN | PASS |
| 1/1 upsert-catalog-from-user-input test GREEN | PASS |
| `npm run lint` on `src/data/catalog.ts` exits 0 | PASS |
| `npm run build` exits 0 (baseline) | PRE-EXISTING FAILURE in scripts/v8.4-brand-canonicalization.ts — not caused by this plan |

## Build Note

`npm run build` exits 1 due to a pre-existing type error in `scripts/v8.4-brand-canonicalization.ts:980` (`Cannot find name 'slugify'`). This error was present before this plan's changes (verified by stash + build). Per memory `[[baseline-not-green-build-is-gate]]`, this is a known baseline failure; no new errors were introduced.

## Plan 04 Contract

Plan 04 (NOT NULL flip) is safe to proceed. Every new `watches_catalog` row will now carry non-NULL `brand_id` + `family_id`. The schema.ts `notNull()` flip + hand-written SQL migration can be applied. The CANON-01/02 integration test (which expects the NOT NULL constraint to be present) is still RED — this becomes GREEN in Plan 04/05.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries introduced. The resolver calls are in-process (same service-role context). T-80-08 (re-extract overwrites operator-merged FKs) mitigated via Discretion iii verification.

## Self-Check

### Files exist
- [x] `src/data/catalog.ts` — modified (import + resolver calls + INSERT columns/values)
- [x] `.planning/phases/80-not-null-constraint-flip-ingest-hardening/80-03-SUMMARY.md` — this file

### Commits exist
- [x] `62f57c42` — feat(80-03): wire resolver into both upsert helpers + preserve FKs on conflict

### Self-Check: PASSED
