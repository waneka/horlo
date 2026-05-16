---
phase: 37-layer-d-provenance-fields-divestments-table
verified: 2026-05-12T05:17:58Z
status: passed
score: 5/5
overrides_applied: 0
re_verification: false
---

# Phase 37: Layer D — Provenance Fields + Divestments Table Verification Report

**Phase Goal:** Add collector-diary provenance columns to `watches` and create the `divestments` table that gives the future recommender a timestamped sold-signal for temporal decay, replacing the insufficient `watches.status = 'sold'` alone.
**Verified:** 2026-05-12T05:17:58Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `watches` table gains 7 provenance columns (serial, year_of_acquisition, condition, box_papers, service_history, paid_currency, purchase_date) — all nullable; all existing rows unaffected | VERIFIED | `src/db/schema.ts` lines 133–139; `supabase/migrations/20260511010000_phase37_layer_d.sql` STEP 2 ALTER TABLE; Drizzle twin `drizzle/0010_phase37_layer_d.sql` lines 11–23; all 7 ADD COLUMN IF NOT EXISTS; existing `acquisitionDate` text + `pricePaid` real columns untouched |
| 2 | `divestments` table exists with the required columns and RLS mirroring `watches` | VERIFIED | `src/db/schema.ts` lines 525–560; Supabase migration STEP 3 (catalog_id NOT NULL FK RESTRICT, user_id NOT NULL FK CASCADE, replaced_by_catalog_id SET NULL, sale_price, sale_currency, notes); STEP 5 enables RLS + 4 per-user `auth.uid() = user_id` policies; GRANT to authenticated + REVOKE FROM anon |
| 3 | Status transition `owned → sold` in the UI writes a row to `divestments` with `divested_at = NOW()` via Server Action; `watches.status = 'sold'` remains | VERIFIED | `src/app/actions/divestments.ts` — `recordDivestment()` does atomic `db.transaction()` INSERT + UPDATE; `src/app/actions/watches.ts` `editWatch()` — `isTransitioningToSold` branch (lines 376–417) inline db.transaction(); `divestedAt` defaults to `now()` at DB level; status col preserved |
| 4 | WatchForm edit page shows collapsed "Collector's Record" disclosure section exposing all 7 provenance fields — collapsed by default with no visual regression on non-expanded state | VERIFIED | `src/components/watch/WatchForm.tsx` lines 695–856: `{mode === 'edit' && (` guard; `import { Accordion } from '@base-ui/react/accordion'`; `<Accordion.Root>` with NO `defaultValue` prop (collapsed by default); all 7 fields rendered inside `<Accordion.Panel>` (purchaseDate, yearOfAcquisition, serial, condition, boxPapers, paidCurrency, serviceHistory) |
| 5 | Divestment dialog UI is explicitly documented as deferred to v5.x in phase CONTEXT.md | VERIFIED | `37-CONTEXT.md` `<deferred>` section line 419: "Divestment dialog UI — ROADMAP-locked deferred to v5.x"; also documented at lines 34 and 47 in the domain section |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/schema.ts` | 3 pgEnums + 7 watches columns + divestments pgTable | VERIFIED | conditionGradeEnum, currencyCodeEnum, boxPapersStatusEnum defined at lines 55–67; 7 provenance columns at lines 133–139; divestments pgTable at lines 525–560 with correct FK on-delete semantics |
| `supabase/migrations/20260511010000_phase37_layer_d.sql` | Authoritative DDL with enums, ADD COLUMNs, divestments table, RLS, GRANTs, indexes, trigger, DO $$ assertions | VERIFIED | All 6 STEPS present; 14-digit timestamp > Phase 36's 20260511000000; DO $$ assertion block covers 17 invariants including FK cascade types, policy count, GRANT/REVOKE |
| `drizzle/0010_phase37_layer_d.sql` | Idempotent structural twin — no RLS, no GRANT, no triggers | VERIFIED | ADD COLUMN IF NOT EXISTS x 7; CREATE TABLE IF NOT EXISTS divestments; 3 DO $$ FK guards; 3 indexes; no RLS/GRANT/triggers |
| `drizzle/meta/_journal.json` | idx=10 appended | VERIFIED | Entry `{"idx": 10, ... "tag": "0010_phase37_layer_d"}` at line 76–80 |
| `src/app/actions/divestments.ts` | recordDivestment Server Action | VERIFIED | 134-line server action with zod validation, auth gate, ownership check, catalog_id invariant check, db.transaction() dual-write, revalidatePath fan-out |
| `src/app/actions/watches.ts` | editWatch owned→sold transition branch | VERIFIED | isTransitioningToSold guard at line 376; inline db.transaction() at line 394 with INSERT divestments + UPDATE watches atomically |
| `src/components/watch/WatchForm.tsx` | base-ui Accordion edit-only + 7 field inputs | VERIFIED | `@base-ui/react/accordion` import (not the non-existent shadcn path); `mode === 'edit'` gate; `<Accordion.Root>` with no defaultValue; all 7 provenance field inputs rendered |
| `src/components/watch/WatchCard.tsx` | sold-badge variant | VERIFIED | Line 52: `variant={watch.status === 'sold' ? 'secondary' : 'outline'}` — distinct visual treatment for sold watches |
| `src/lib/types.ts` | Watch interface extended; Divestment type | VERIFIED | ConditionGrade, CurrencyCode, BoxPapersStatus types at lines 16–28; Watch interface extended with 7 optional fields at lines 83–89; Divestment interface at lines 112–123 |
| `src/lib/constants.ts` | CONDITION_GRADES / CURRENCY_CODES / BOX_PAPERS_STATUSES | VERIFIED | All 3 arrays + display-label maps at lines 147–182 |
| `tests/integration/phase37-rls.test.ts` | V-02..V-10 + V-14 | VERIFIED | 13 `it()` blocks covering pgEnum existence (V-03), 7 column presence (V-02), divestments table shape (V-04), FK cascade types x3 (V-05), 4 RLS policies (V-06), anon cannot SELECT (V-07), authenticated can SELECT/INSERT/UPDATE/DELETE (V-08), FK orphan rejection (V-09), dual-write happy-path + rollback (V-10), docs heading (V-14) |
| `tests/static/WatchForm.accordion.guards.test.ts` | Accordion structural guards | VERIFIED | 4 guards: correct import path, no shadcn path, edit-mode gate present, no defaultValue prop, "Collector's Record" copy |
| `tests/static/WatchCard.sold-badge.test.tsx` | Sold badge variant guard | VERIFIED | 2 guards: ternary variant present, no hardcoded variant="outline" on status badge |
| `docs/deploy-db-setup.md` | §37.0..§37.5 section | VERIFIED | `## Phase 37` heading at line 1023; sections §37.0 through §37.5 present including rollback instructions |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `WatchForm.tsx` mode=edit | `Accordion.Root` (collapsed) | `{mode === 'edit' && (` JSX gate | WIRED | Lines 696–856; Accordion.Root has no defaultValue/openAll prop — collapsed by default |
| `editWatch` (watches.ts) | `divestments` table | `db.transaction()` + `tx.insert(divestments)` | WIRED | Lines 394–417; isTransitioningToSold check + atomic dual-write |
| `recordDivestment` (divestments.ts) | `divestments` table + `watches.status` | `db.transaction()` tx.insert + tx.update | WIRED | Lines 98–117; both writes in single transaction |
| `WatchCard.tsx` | sold variant badge | `watch.status === 'sold' ? 'secondary' : 'outline'` ternary | WIRED | Line 52 |
| `src/data/watches.ts` DAL mapper | 7 new provenance fields | `row.serial ?? undefined` etc. | WIRED | Lines 51–57 (read), 100–106 (write) — mapper updated in Phase 37 |
| `supabase migration` | `auth.uid() = user_id` RLS | ENABLE ROW LEVEL SECURITY + 4 policies + GRANT authenticated + REVOKE anon | WIRED | STEP 5; DO $$ assertions verify at migration time |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `divestments.ts` `recordDivestment` | `watch.catalogId` | `watchDAL.getWatchById()` → DB query | Yes — live DB row | FLOWING |
| `watches.ts` `editWatch` | `priorRow.catalogId` | `watchDAL.getWatchById()` → DB query | Yes — live DB row | FLOWING |
| `WatchForm.tsx` provenance fields | `formData.serial` etc. | `watch` prop seeded from DAL at lines 145–152 | Yes — seeded from DB row | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — integration tests cover the server action behavior; running the dev server is not required for static artifact verification. V-10 dual-write tests (happy path + rollback) in `tests/integration/phase37-rls.test.ts` provide equivalent automated coverage.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| CAT-18 | 37-01..37-05 | Provenance columns + divestments table + Server Action + WatchForm disclosure + dialog deferred | SATISFIED | All 5 sub-criteria verified (see Observable Truths table above) |

---

### Anti-Patterns Found

No blockers or significant anti-patterns detected.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/actions/watches.ts` | ~404-416 | `Object.fromEntries` filter over updatePayload inside transaction — inline approach vs DAL delegation | Info | Documented decision (comment at line 390: "inline is cleaner per plan Task 2 guidance"); not a stub |
| `src/app/actions/divestments.ts` | 129 | `revalidateTag('explore', 'max')` — `revalidateTag` takes one argument; second arg is silently ignored by Next.js | Info | Non-fatal API misuse; does not affect divestment correctness |

---

### Human Verification Required

None. All 5 success criteria are verifiable programmatically through code inspection and the integration/static test suite.

---

### Gaps Summary

No gaps. All 5 ROADMAP success criteria are fully satisfied by shipped code and migration artifacts. The phase boundary is clean.

---

## Architecture / Migration Discipline Checks

**Memory rule `project_drizzle_supabase_db_mismatch.md`:**
- Rule 1 (14-digit timestamp): `20260511010000` > `20260511000000` — HONORED
- Rule 2 (no insertion between adjacent integers): idx=10 is a fresh entry, not an insertion — HONORED
- Rule 3 (extension schema — N/A): no GIN indexes, no extension-scoped operators — HONORED
- Rule 4 (pg_depend pre-check — N/A): Phase 37 only ADDs columns/tables; no drops or type-changes — HONORED

**Memory rule `project_supabase_secdef_grants.md`:**
- GRANT to `authenticated`: present in STEP 5 — HONORED
- REVOKE from `anon` and `public`: explicit `REVOKE ALL ON divestments FROM anon; REVOKE ALL ON divestments FROM public` — HONORED
- DO $$ assertion validates `NOT has_table_privilege('anon', ...)` = true — HONORED

**DEBT-12:** `drizzle-kit migrate` skipped for prod deploy; `supabase db push --linked` is the prod deploy path — confirmed by ROADMAP checklist note and 37-05-SUMMARY.md.

**Drizzle/Supabase split discipline:**
- Supabase migration: CREATE TYPE, ALTER TABLE, CREATE TABLE, RLS, GRANT, REVOKE, trigger, DO $$ assertions
- Drizzle migration: ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS, DO $$ FK guards, indexes only — no RLS, no GRANT, no triggers
- Split maintained correctly.

**Regression checks:**
- `watches.acquisitionDate` (text) column: still present at schema.ts line 120 — untouched
- `watches.pricePaid` (real) column: still present at schema.ts line 93 — untouched
- `src/data/watches.ts` mapper: updated with 7 new fields without modifying existing field mappings

---

_Verified: 2026-05-12T05:17:58Z_
_Verifier: Claude (gsd-verifier)_
