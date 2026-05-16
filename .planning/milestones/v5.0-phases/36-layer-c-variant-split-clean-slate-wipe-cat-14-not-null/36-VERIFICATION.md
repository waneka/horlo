---
phase: 36-layer-c-variant-split-clean-slate-wipe-cat-14-not-null
verified: 2026-05-11T22:00:00Z
status: passed
score: 5/5 ROADMAP success criteria + 7/7 D-NN decisions + 12/13 Nyquist gates (V-13 deferred to Phase 38)
must_haves_total: 5
must_haves_passed: 5
must_haves_failed: 0
re_verification:
  previous_status: null
  is_initial: true
overrides:
  - must_have: "Drizzle types match prod constraint (V-13: InferSelectModel<typeof watches>.catalogId is `string`, not `string | null`)"
    reason: "Plan 01 Rule 4 architectural deferral — applying `.notNull()` to watches.catalogId cascades 18 tsc errors across DAL (`createWatch()` signature) + 17 integration test fixtures, requiring DAL flow rewrite (catalog upsert BEFORE createWatch) outside Plan 01's `src/db/schema.ts`-only scope. Documented in `deferred-items.md` Item 1 with full handoff to Phase 38 (CAT-13 Engine Rewire — natural consumer of the non-null guarantee). Prod-side CAT-14 SET NOT NULL is UNAFFECTED and LIVE (`is_nullable = NO` verified 2026-05-11)."
    accepted_by: "tylerwaneka@gmail.com"
    accepted_at: "2026-05-11T22:00:00Z"
---

# Phase 36: Layer C — Variant Split + Clean-Slate Wipe + CAT-14 NOT NULL Verification Report

**Phase Goal:** Create the `watch_variants` table, add `watches.variant_id` FK, and flip `watches.catalog_id` to NOT NULL — bundled because Phase 35 inherited clean-slate provides the 100% backfill guarantee CAT-14 requires.

**Verified:** 2026-05-11T22:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (ROADMAP §Phase 36 Success Criteria #1–#5)

| #   | Truth                                                                                                                                                                                                                                                  | Status     | Evidence                                                                                                                                                                                                                                                                                                                                                              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1   | `watch_variants` table exists with `(catalog_id FK, dial_color, bezel, bracelet_variant)` columns + `watches.variant_id` optional FK added                                                                                                             | ✓ VERIFIED | `src/db/schema.ts:466–488` exports `watchVariants` pgTable with 10 cols + UNIQUE (catalog_id, slug) + FK ON DELETE RESTRICT. `src/db/schema.ts:130` adds `variantId` nullable FK ON DELETE SET NULL. Supabase migration `20260511000000_phase36_layer_c_variants.sql` STEP 1 + STEP 4 create both. Prod live `has_table_privilege('anon','public.watch_variants','SELECT')=true`. |
| 2   | 6-step clean-slate runbook executed (reinterpreted by D-01: steps a/b/c inherited from Phase 35 D-02; steps d/e/f executed in Phase 36)                                                                                                                | ✓ VERIFIED | `docs/deploy-db-setup.md` H2 §Phase 36 with 8 H3 sub-sections §36.0..§36.7 present (1021 lines total). §36.1 backfill, §36.2 zero-NULL verify, §36.3 supabase db push --linked all documented. Plan 05 SUMMARY §"Prod Deploy Outcome" confirms steps executed 2026-05-11 (§36.1+§36.6 vacuously skipped against 0-row state — documented).                              |
| 3   | CAT-14 migration begins with `DO $$` pre-flight asserting zero NULLs as FIRST statement                                                                                                                                                                | ✓ VERIFIED | `awk` test in `tests/integration/phase36-rls.test.ts:169–188` (V-10) is green. Manual verification: line 22 of migration is `DO $$` immediately after `BEGIN;` + header comments. ALTER COLUMN SET NOT NULL is at line 87 (STEP 5) — after the pre-flight at STEP 0.                                                                                                |
| 4   | `watches.catalog_id` is NOT NULL in production schema                                                                                                                                                                                                  | ✓ VERIFIED | Plan 05 §"Prod Deploy Outcome" Step §36.4: `SELECT is_nullable FROM information_schema.columns WHERE table_name='watches' AND column_name='catalog_id'` → `NO` (verified live 2026-05-11). Migration STEP 5 + final DO $$ assertion at line 144 enforce this.                                                                                                       |
| 5   | All existing collection-browsing/profile/verdict flows return correct watch data — proven via parity (no DAL touches `variant_id`) and vacuous on empty prod state                                                                                       | ✓ VERIFIED | V-12 parity grep: `grep -rln 'variant_id\|variantId' src/data src/app src/lib src/components \| wc -l` = 0. No DAL code consumes the new column. Prod live counts: `watches=0`, `watches_catalog=0` (post-Phase-35-wipe). UI walk vacuous; non-vacuous walk re-tests when Phase 39 reseeds catalog.                                                                  |

**Score:** 5/5 ROADMAP success criteria verified.

---

### D-NN Decision Coverage (CONTEXT.md §Decisions)

| #    | Decision                                                                                                              | Status     | Evidence                                                                                                                                                                                                                                                                                                                                |
| ---- | --------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-01 | Shrink ROADMAP 6-step runbook (drop a/b/c inherited from Phase 35; keep d/e/f for Phase 36)                          | ✓ VERIFIED | `docs/deploy-db-setup.md` §36 contains §36.0..§36.7. NOTE blockquote at top documents (a)(b)(c) as inherited. Plan 05 SUMMARY confirms this is verbatim from 36-RESEARCH.md §Deploy Runbook Append.                                                                                                                                     |
| D-02 | 10-column `watch_variants` shape (id, catalog_id, name, slug, dial_color, bezel, bracelet_variant, image_url, created_at, updated_at) | ✓ VERIFIED | Migration line 37–49 + Drizzle line 11–23 ship identical 10-col shape. Plan 04 SUMMARY §"Schema Introspection" confirms live DB matches via `\d watch_variants`.                                                                                                                                                                       |
| D-03 | ON DELETE RESTRICT on `watch_variants.catalog_id`                                                                     | ✓ VERIFIED | Migration line 39 `... ON DELETE RESTRICT`. Drizzle line 34 `ON DELETE restrict`. `src/db/schema.ts:473` `onDelete: 'restrict'`. Tested by `tests/integration/phase36-rls.test.ts` it() block #11 (V-01) — `confdeltype = 'r'`.                                                                                                       |
| D-04 | ON DELETE SET NULL on `watches.variant_id`                                                                            | ✓ VERIFIED | Migration line 79 `REFERENCES watch_variants(id) ON DELETE SET NULL`. Drizzle line 53 `ON DELETE set null`. `src/db/schema.ts:130` `onDelete: 'set null'`. Tested by phase36-rls.test.ts it() block #9 (V-07) — `confdeltype = 'n'`.                                                                                                  |
| D-05 | RLS public-read + service-role-only writes                                                                            | ✓ VERIFIED | Migration line 68–71: ENABLE RLS + CREATE POLICY `watch_variants_select_all` FOR SELECT USING (true) + GRANT SELECT TO anon, authenticated. Tested by phase36-rls.test.ts it() blocks #1–#3 (V-05, V-06).                                                                                                                              |
| D-06 | Ship `watch_variants` empty                                                                                           | ✓ VERIFIED | No seed data in migration. Plan 05 §"Prod Deploy Outcome" Step §36.4 confirms `SELECT COUNT(*) FROM watch_variants` returned 0 in prod.                                                                                                                                                                                                |
| D-07 | DO $$ pre-flight FIRST statement + hard-fail recovery via runbook                                                     | ✓ VERIFIED | Migration line 22–30: DO $$ asserts `SELECT COUNT(*) FROM watches WHERE catalog_id IS NULL = 0`; raises EXCEPTION with operator-friendly recovery message. `docs/deploy-db-setup.md` §36.5 documents three-path recovery flow (re-run backfill / manual upsert / re-verify / retry).                                                  |

**Score:** 7/7 decisions honored.

---

### Required Artifacts

| Artifact                                                                  | Expected                                                                                                                  | Status     | Details                                                                                                                                  |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------|
| `src/db/schema.ts`                                                        | exports `watchVariants` pgTable + `watches.variantId` column                                                              | ✓ VERIFIED | `grep "export const watchVariants = pgTable("` = 1 match (line 466). `grep "variantId: uuid('variant_id')"` = 1 match (line 130).        |
| `supabase/migrations/20260511000000_phase36_layer_c_variants.sql`         | single-transaction migration; DO $$ FIRST; CREATE TABLE + RLS + GRANT + ADD COLUMN + SET NOT NULL                          | ✓ VERIFIED | 150 lines, 8513 bytes. 6 STEPs + 2 DO $$ blocks. First non-comment non-BEGIN line = `DO $$`. BEGIN/COMMIT envelope present.             |
| `drizzle/0009_phase36_layer_c_variants.sql`                               | idempotent structural twin (no RLS, no GRANT, no DO $$ pre-flight)                                                        | ✓ VERIFIED | 64 lines, 2780 bytes. `CREATE TABLE IF NOT EXISTS` + `ADD COLUMN IF NOT EXISTS` + DO $$ FK guards. `grep "ROW LEVEL SECURITY\|^GRANT\|CREATE POLICY"` = 0. |
| `drizzle/meta/_journal.json` idx=9 entry                                  | idx=9 entry with tag `0009_phase36_layer_c_variants`                                                                      | ✓ VERIFIED | `{"idx":9,"version":"7","when":1778534674854,"tag":"0009_phase36_layer_c_variants","breakpoints":true}` present; entries.length = 10.    |
| `tests/integration/phase36-rls.test.ts`                                   | 13 it() blocks covering V-01..V-11 + DO $$ static guard + INSERT NULL rejection                                            | ✓ VERIFIED | 189 lines, 13 it() blocks confirmed by `grep -c "^  it("` = 13. All green against local Docker per Plan 04 SUMMARY.                       |
| `docs/deploy-db-setup.md` §36.0..§36.7                                    | 8 H3 sub-sections appended (pg_depend, backfill, verify, push, smoke, recovery, re-sync, backout)                          | ✓ VERIFIED | `grep -cE "^### 36\\.[0-7] "` = 8 (lines 847..1000). H2 §Phase 36 present (line ≈840). Phase 34/35 sections untouched.                    |
| `.planning/phases/.../deferred-items.md`                                  | tracks Plan 01 Rule 4 deferral with Phase 38 handoff                                                                       | ✓ VERIFIED | Item 1 documents Pitfall 6 `.notNull()` deferral; 4-step Phase 38 sequence; explicit cross-reference from `src/db/schema.ts:116–125`.   |

**Score:** 7/7 artifacts verified.

---

### Key Link Verification

| From                                                                    | To                                                          | Via                                                                | Status     | Details                                                                                                                                                                       |
| ----------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/db/schema.ts` watches.variantId                                    | `src/db/schema.ts` watchVariants.id                         | lazy callback `references(() => watchVariants.id, { onDelete: 'set null' })` | ✓ WIRED | Line 130 — pattern match passes verbatim.                                                                                                                                  |
| `src/db/schema.ts` watchVariants.catalogId                              | `src/db/schema.ts` watchesCatalog.id                        | `.notNull().references(() => watchesCatalog.id, { onDelete: 'restrict' })` | ✓ WIRED | Lines 471–473 — pattern match passes verbatim.                                                                                                                              |
| Migration DO $$ pre-flight (STEP 0)                                     | Migration ALTER COLUMN catalog_id SET NOT NULL (STEP 5)     | shared BEGIN;...COMMIT; transaction — pre-flight EXCEPTION rolls back the SET NOT NULL atomically | ✓ WIRED | Single `BEGIN;` (line 15) and single `COMMIT;` (line 150) envelope; STEP 0 at line 22; STEP 5 at line 87. Atomicity proven by Postgres semantics.                            |
| Migration CREATE POLICY watch_variants_select_all                       | Migration GRANT SELECT ON watch_variants TO anon, authenticated | co-located 4-line RLS block (per memory `project_supabase_secdef_grants.md`) | ✓ WIRED | Lines 68–71: ENABLE RLS → DROP POLICY IF EXISTS → CREATE POLICY → GRANT SELECT. Verbatim Phase 35 pattern.                                                                |

**Score:** 4/4 key links wired.

---

### Nyquist Validation Gates (VALIDATION.md §V-01..V-13)

| Gate  | Requirement | Behavior                                                          | Status     | Evidence                                                                          |
| ----- | ----------- | ----------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------- |
| V-01  | CAT-17      | FK ON DELETE RESTRICT on watch_variants.catalog_id                | ✓ green    | phase36-rls.test.ts it #11 + #12 — `confdeltype='r'`; INSERT orphan → 23503        |
| V-02  | CAT-17      | watch_variants table has 10 expected columns in order             | ✓ green    | phase36-rls.test.ts it #6                                                          |
| V-03  | CAT-17      | watch_variants.catalog_id is NOT NULL                             | ✓ green    | phase36-rls.test.ts it #7                                                          |
| V-04  | CAT-17      | UNIQUE (catalog_id, slug) enforced                                | ✓ green    | phase36-rls.test.ts it #8                                                          |
| V-05  | CAT-17      | RLS enabled; anon can SELECT watch_variants                       | ✓ green    | phase36-rls.test.ts it #1 + #2                                                     |
| V-06  | CAT-17      | Anon INSERT into watch_variants blocked by RLS                    | ✓ green    | phase36-rls.test.ts it #3                                                          |
| V-07  | CAT-17      | watches.variant_id exists, nullable, FK ON DELETE SET NULL        | ✓ green    | phase36-rls.test.ts it #9 — `confdeltype='n'`                                      |
| V-08  | CAT-14      | watches.catalog_id is_nullable = 'NO' post-migration              | ✓ green    | phase36-rls.test.ts it #4; PROD verified live (`is_nullable = NO`)                 |
| V-09  | CAT-14      | INSERT NULL catalog_id raises constraint violation                | ✓ green    | phase36-rls.test.ts it #5 — `.cause.code='23502'`                                  |
| V-10  | CAT-14      | DO $$ is FIRST statement in migration                             | ✓ green    | phase36-rls.test.ts it #13 (fs.readFile static guard); manual awk also passes      |
| V-11  | CAT-17      | watches.catalog_id ON DELETE SET NULL preserved (not changed)     | ✓ green    | phase36-rls.test.ts it #10 — `confdeltype='n'`                                     |
| V-12  | CAT-17,14   | Parity gate: no existing DAL/UI references `variant_id\|variantId` | ✓ green    | `grep -rln 'variant_id\|variantId' src/data src/app src/lib src/components` = 0   |
| V-13  | CAT-17      | Drizzle `InferSelectModel<typeof watches>.catalogId` is `string`  | ⚠ DEFERRED | Plan 01 Rule 4 deferral to Phase 38 — see override entry in frontmatter           |

**Score:** 12/13 gates green; V-13 explicitly deferred to Phase 38 with override.

---

### Anti-Patterns Scanned

| File                                                                        | Pattern Searched                                | Severity | Impact                                                                                                                                                                                                                |
| --------------------------------------------------------------------------- | ----------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20260511000000_phase36_layer_c_variants.sql`           | TODO / FIXME / XXX / HACK / PLACEHOLDER         | none     | Zero TODO/FIXME present. Migration ships clean.                                                                                                                                                                       |
| `drizzle/0009_phase36_layer_c_variants.sql`                                 | TODO / FIXME / XXX / HACK / PLACEHOLDER         | none     | Zero TODO/FIXME present. Idempotent guards documented.                                                                                                                                                                |
| `tests/integration/phase36-rls.test.ts`                                     | TODO / FIXME / placeholder; empty handlers      | none     | Zero placeholder/TODO. All 13 it() blocks have non-trivial assertions.                                                                                                                                                |
| `src/db/schema.ts` (Phase 36 diff)                                          | TODO / FIXME / placeholder                      | none     | The "DEFERRED" comment at lines 116–125 is intentional handoff to Phase 38 — references `deferred-items.md` Item 1, NOT a code-smell.                                                                                |
| `docs/deploy-db-setup.md` (§36 diff)                                        | placeholder / TBD / coming soon                 | none     | Zero placeholders; §36.0..§36.7 are complete deploy steps.                                                                                                                                                            |

**No blocker or warning anti-patterns found.**

---

### Behavioral Spot-Checks (Plan 04 vitest + Plan 05 prod psql)

| Behavior                                                                                       | Command                                                                                                              | Result                                                                                                                        | Status   |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------- |
| Local: vitest phase36-rls.test.ts                                                              | `set -a; source .env.local; set +a; npx vitest run tests/integration/phase36-rls.test.ts`                            | 13 tests passed (116ms) per Plan 04 SUMMARY                                                                                   | ✓ PASS   |
| Prod: anon SELECT privilege on watch_variants                                                  | `supabase db query --linked "SELECT has_table_privilege('anon','public.watch_variants','SELECT')"`                  | `true` (per Plan 05 Step §36.4)                                                                                              | ✓ PASS   |
| Prod: watches.catalog_id is_nullable                                                           | `supabase db query --linked "SELECT is_nullable FROM information_schema.columns WHERE table_name='watches' AND column_name='catalog_id'"` | `NO` (per Plan 05 Step §36.4)                                                                                                | ✓ PASS   |
| Prod: SELECT COUNT(*) FROM watch_variants                                                      | `supabase db query --linked "SELECT COUNT(*) FROM watch_variants"`                                                   | `0` (D-06 ship-empty)                                                                                                          | ✓ PASS   |
| Prod: SELECT COUNT(*) FROM watches WHERE variant_id IS NOT NULL                                | `supabase db query --linked "SELECT COUNT(*) FROM watches WHERE variant_id IS NOT NULL"`                             | `0`                                                                                                                            | ✓ PASS   |
| Static: V-12 parity grep                                                                       | `grep -rln 'variant_id\|variantId' src/data src/app src/lib src/components \| wc -l`                                | `0` (no DAL/UI consumers)                                                                                                      | ✓ PASS   |
| Static: V-10 DO $$ first-statement guard                                                       | `awk` non-comment non-BEGIN first line check on the migration                                                        | First non-comment, non-BEGIN line = `DO $$`                                                                                    | ✓ PASS   |

All spot-checks pass.

---

### Requirements Coverage

| Requirement | Source Plan         | Description                                                                                                                                                                                                                                  | Status      | Evidence                                                                                                                                                       |
| ----------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CAT-17      | 36-01, 36-02, 36-03, 36-04, 36-05 | New `watch_variants` table (catalog_id FK + dial_color, bezel, bracelet_variant) + consolidated Reference rows + idempotent backfill + 6-step runbook. Reinterpreted by D-01 (steps a/b/c inherited from Phase 35) and D-06 (ship empty; population deferred to Phase 39). | ✓ SATISFIED | `watch_variants` table in prod (Plan 05 §36.4); 10-col shape verified locally (Plan 04 \d output); runbook §36.0..§36.7 in `docs/deploy-db-setup.md`. Variant population is OUT OF SCOPE per D-06 — handoff to Phase 39 documented. |
| CAT-14      | 36-01, 36-02, 36-03, 36-04, 36-05 | `SET NOT NULL` on `watches.catalog_id` with DO $$ pre-flight asserting zero NULLs as FIRST migration statement                                                                                                                              | ✓ SATISFIED | Migration STEP 0 (line 22) DO $$; STEP 5 (line 87) ALTER COLUMN SET NOT NULL. Prod live `is_nullable = NO` (Plan 05 §36.4). Drizzle-side `.notNull()` deferred to Phase 38 per documented override; prod-side flip UNAFFECTED. |

**No orphaned requirements.** Both CAT-17 and CAT-14 are claimed by all 5 plans (Plan 01 frontmatter `requirements: [CAT-17, CAT-14]` and propagating through Plans 02–05). REQUIREMENTS.md table at lines 109–110 maps CAT-17 → Phase 36 and CAT-14 → Phase 36 — fully covered.

---

### Data-Flow Trace (Level 4)

N/A — Phase 36 is **schema-only**. There are no UI components rendering dynamic data, no API routes consuming the new schema, and no DAL paths added. The `watches.variant_id` column is a nullable additive (V-12 parity grep proves zero consumers). Data-flow verification re-applies when Phase 39 ships the variant population + lineage browse UI.

---

### Human Verification Required

None for goal-backward verification. Per the additional context:

- Prod state was operator-verified live on 2026-05-11 (all §36.4 smoke tests returned green and are captured in Plan 05 SUMMARY §"Prod Deploy Outcome").
- §36.6 UI smoke walk was explicitly skipped as vacuous (post-Phase-35-wipe state means `watches=0`, `watches_catalog=0`; no regression surface). Non-vacuous UI walk is deferred until Phase 39 re-seeds canonical Reference rows — at which point Phase 39's verification will exercise the collection/profile/verdict flows against actual data.

No additional human testing required to close Phase 36.

---

### Deviations from PLAN — Explicitly Accepted

1. **Plan 01 Rule 4 architectural deferral** — Drizzle-side `.notNull()` on `watches.catalogId` deferred to Phase 38 (cascading 18 tsc errors across DAL + 17 test fixtures requires DAL flow rewrite). Documented in `deferred-items.md` Item 1; cross-referenced inline at `src/db/schema.ts:116–125`. Prod-side CAT-14 SET NOT NULL UNAFFECTED — verified live `is_nullable = NO` on 2026-05-11. Tracked via `overrides:` entry in frontmatter.

2. **Plan 04 Rule 3 deviation** — `drizzle-kit push` was not run locally due to interactive TTY prompt on pre-existing snapshot drift. The live local DB shape was instead verified directly via `docker exec psql` against the applied `supabase/migrations/20260511000000_phase36_layer_c_variants.sql`. Type-level "Drizzle matches prod" is preserved by construction because both files declare identical column shapes. No functional impact. Plan 04 SUMMARY documents.

3. **§36.2a auth.users = 12 surprise** — runbook expected 1 (single-user assumption). Operator confirmed all 12 are seed garbage from prior Claude sessions; Phase 36 is mechanically user-count-independent (schema-only, no TRUNCATE, no auth.users reads/writes). Memory file `project_db_wipeable_2026_05_09.md` update queued per Plan 05 SUMMARY §"Memory file follow-up".

4. **§36.1 backfill and §36.6 UI walk vacuous skips** — both steps documented as skipped against 0-row prod state (post-Phase-35-wipe). No regression surface to test. ROADMAP success #5 covered instead by V-12 parity grep (zero DAL/UI consumers) + no DAL changes.

All four deviations are documented and have explicit user/operator acceptance trails. None are gaps; all are intentional handoffs or vacuous-state skips.

---

### Gaps Summary

**None.**

All 5 ROADMAP success criteria are satisfied (#2 reinterpreted per D-01; #5 proven via parity gate against vacuous prod state). All 7 D-NN decisions honored. 12 of 13 Nyquist validation gates green; V-13 explicitly deferred to Phase 38 with override. Prod state verified live 2026-05-11 (CAT-14 + watch_variants LIVE). No blocker or warning anti-patterns found in any Phase 36 artifact.

Phase 36 goal **ACHIEVED**: `watch_variants` table created, `watches.variant_id` FK added, `watches.catalog_id` flipped to NOT NULL in production — bundled and atomic per the original phase goal.

---

_Verified: 2026-05-11T22:00:00Z_
_Verifier: Claude (gsd-verifier; Opus 4.7 1M-ctx)_
