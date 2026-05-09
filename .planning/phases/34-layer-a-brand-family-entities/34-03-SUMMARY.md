---
phase: 34
plan: 03
status: complete
completed: 2026-05-09
duration_min: ~25
mode: interactive (operator-narrated; orchestrator presented commands, operator ran them locally with prod credentials)
---

# Plan 34-03: Production Push + Brand Backfill — SUMMARY

> Wave 3 of Phase 34 (executed AFTER Wave 4 per operator request — operator wanted runbook in hand during prod push).

## Objective

Apply the Phase 34 schema migration to production via `supabase db push --linked`, run the brand backfill script against prod with inline `DATABASE_URL=<prod>` override (Footgun T-34-04 mitigation), verify RLS truth values, verify backfill row counts, and smoke-test that existing discovery surfaces still render.

## What shipped

### Production schema state (post-push)

| Object | State | Verification |
|--------|-------|--------------|
| `public.brands` table | exists | `SELECT 1 FROM information_schema.tables WHERE table_name='brands'` returned row |
| `public.watch_families` table | exists | same query returned row |
| `watches_catalog.brand_id` column | `uuid | YES` (nullable) | `information_schema.columns` query confirmed |
| `watches_catalog.family_id` column | `uuid | YES` (nullable) | same |
| `brands.name_normalized` GENERATED column | `is_generated = ALWAYS` | `information_schema.columns` confirmed |
| `watch_families.name_normalized` GENERATED column | `is_generated = ALWAYS` | same |
| `anon` SELECT on `brands` | `t` | `has_table_privilege('anon', 'public.brands', 'SELECT')` |
| `anon` SELECT on `watch_families` | `t` | `has_table_privilege('anon', 'public.watch_families', 'SELECT')` |
| pg_depend delta on watches_catalog | `+4` (44 → 48) | `SELECT count(*) FROM pg_depend WHERE refobjid = 'public.watches_catalog'::regclass` (note: plan estimated +2; observed +4 because each FK constraint creates multiple pg_depend rows for column refs) |
| 8 RAISE EXCEPTION assertion guards | all passed | `supabase db push` exit 0; only NOTICEs from idempotency `DROP IF EXISTS` guards |

### Production backfill state (post-script)

| Metric | Value | Notes |
|--------|-------|-------|
| `brands` row count | 6 | Distinct `brand_normalized` values in prod's `watches_catalog` |
| `brands` rows with country_of_origin | 3 | Matched against `scripts/country.json` (the other 3 brands aren't in country.json — operator can patch later) |
| `watches_catalog` total rows | 9 | (small dataset — single-user prod state) |
| `watches_catalog` rows with `brand_id` linked | 9 | 100% link rate |
| `watches_catalog` rows with `brand_id IS NULL AND brand_normalized IS NOT NULL` | **0** | Success gate ✓ |
| `watch_families` row count | 0 | Correctly empty per D-03 (Phase 35 territory) |
| Backfill elapsed | 7896 ms | Idempotent on re-run (next invocation would report `inserted=0 patched=3 linked=0 unlinked=0`) |

### DAL parity (live)

Operator visited prod surfaces; pages loaded without 5xx:
- Home (`/`)
- Explore (`/explore`)
- Catalog page

Confirms the 31 `watchesCatalog` references in `src/data/*.ts` still return correct results after two new nullable columns were added. (Static-analysis evidence already established in 34-RESEARCH.md Pitfall 8; live render is the final confirmation.)

## ROADMAP success criteria — Wave 3 contribution

| SC# | Requirement | Wave 3 status |
|-----|-------------|---------------|
| #1 | `brands` and `watch_families` tables exist in production with public-read RLS + service-role-write policies | ✓ Both tables present; RLS truth values confirmed |
| #2 | `watches_catalog.brand_id` (nullable FK) + `watches_catalog.family_id` (nullable FK) columns exist; existing DAL queries return correct results | ✓ Both columns present as `uuid | YES`; live render confirmed unchanged |
| #3 | `has_table_privilege('anon', 'public.brands', 'SELECT')` and `has_table_privilege('anon', 'public.watch_families', 'SELECT')` both return `true` in production | ✓ Both confirmed `t` in Dashboard SQL editor |
| #4 | Service-role backfill script populates brands | ✓ 6 brands inserted on prod; 9 catalog rows linked; 0 unlinked |

SC #5 (three-step migration discipline documented; NOT NULL flip explicitly deferred) was satisfied by Wave 4 (Plan 34-04 §34.5).

## Threats addressed

| Threat | Mitigation evidence |
|--------|---------------------|
| T-34-01 (anon write to brands/watch_families) | RLS policy with no INSERT/UPDATE/DELETE policy → anon writes blocked. Confirmed via Plan 01's 11 integration tests; same RLS in prod migration |
| T-34-02 (anon read disabled would break trending) | `GRANT SELECT TO anon, authenticated` + `CREATE POLICY ... USING (true)` → confirmed `t/t` truth values |
| T-34-04 (silent backfill against wrong DB) | Operator used inline `DATABASE_URL="<prod>"` override per runbook §34.2 footgun callout. Verified backfill hit prod (numbers 6/9 differ from local's 11/17). |

## Operator workflow (interactive narration mode)

Per operator request, Plan 03 ran in interactive mode rather than as a spawned executor agent — keeps prod credentials off the agent context. Orchestrator presented each command; operator ran locally with prod URL substituted; orchestrator verified output before gating each checkpoint:human-verify.

Sequence executed:
1. Pre-flight (operator local): branch state, commits on `main`, `supabase status` linked, pg_depend baseline = 44
2. `supabase db push --linked` → applied `20260510000000_phase34_brands_families.sql` (Y prompt confirmed)
3. `DATABASE_URL=<prod> npx drizzle-kit migrate` → connected to prod (NOTICE about drizzle schema confirms prod hit), but did NOT successfully record 0007 in `__drizzle_migrations` (see "Discovered drift" below)
4. Smoke verification (Dashboard SQL editor): tables present, RLS = t/t, FK columns nullable uuid, GENERATED = t/t, pg_depend = 48
5. **Checkpoint:human-verify #1 — APPROVED**
6. `DATABASE_URL=<prod> npm run db:backfill-catalog-brands -- --patch-country=scripts/country.json` → `inserted=6 patched=3 linked=9 unlinked=0`
7. Final smoke (Dashboard): brand_count=6, brands_with_country=3, linked=9, unlinked_with_brand=0, watch_families=0
8. DAL parity (operator browser): home/explore/catalog all load
9. **Checkpoint:human-verify #2 — APPROVED**

## Discovered drift (NOT a Phase 34 regression)

Prod's `drizzle.__drizzle_migrations` table contains exactly 1 row — `idx=0 0000_flaky_lenny_balinger`. None of phases 8/12/17/19.1/27 ever recorded their drizzle migrations in prod's journal. They all shipped via `supabase db push --linked` only.

When `drizzle-kit migrate` ran against prod today, it saw all of `0001..0007` as pending, attempted to apply `0001` (which lacks IF NOT EXISTS guards), failed on `relation "watches" already exists`, and aborted before recording `0007`. The spinner the operator observed mid-output was the connection waiting on the failed transaction.

**Phase 34's schema is correct on prod regardless** — `supabase db push --linked` (Step 1) is what shipped the schema. The journal sync is bookkeeping only.

Filed as follow-up DEBT ticket (orchestrator Task #12) — repair = `INSERT INTO drizzle.__drizzle_migrations` 7 rows with SHA256 hashes from local `drizzle/meta/_journal.json`. Not in Phase 34 scope.

## Commits

This plan generated no git commits — all operations ran against external production state (Supabase, npm scripts) rather than modifying local files. The artifacts of this plan are the production database state changes, evidence captured in this SUMMARY, and the orchestrator's task ledger.

## Self-Check

- [x] supabase db push --linked applied 20260510000000 to prod, exit 0, no RAISE EXCEPTION
- [x] watches_catalog.brand_id and family_id columns exist as nullable uuid on prod
- [x] anon SELECT on brands and watch_families both return `t` on prod
- [x] brands table populated (6 rows); watches_catalog.brand_id linked (9/9); watch_families empty
- [x] Existing prod surfaces render unchanged (home, explore, catalog)
- [x] Inline DATABASE_URL override pattern used (T-34-04 footgun avoided)
- [x] All `must_haves.truths` from PLAN.md frontmatter satisfied except journal sync (filed as follow-up DEBT)

**PASSED** with one informational finding (drizzle journal drift — pre-existing, not Phase 34 caused).
