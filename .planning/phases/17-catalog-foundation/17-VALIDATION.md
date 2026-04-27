---
phase: 17
slug: catalog-foundation
status: filled
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-27
updated: 2026-04-27
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 2.1.x with `@testing-library/react` 16.3.x and MSW 2.13.x |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `npm test -- --run tests/integration/phase17-*.test.ts tests/actions/addwatch-catalog-resilience.test.ts` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~30 seconds (catalog suite); ~90 seconds (full) |
| **DB-gated pattern** | `const maybe = process.env.DATABASE_URL ? describe : describe.skip` (mirrors `tests/integration/phase11-pg-trgm.test.ts:23`) |

---

## Sampling Rate

- **After every task commit:** Run quick command (catalog integration suite)
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> One row per task across all 6 plans. Columns: Plan, Wave, Requirement, Threat Ref, Secure Behavior, Test Type, Automated Command, File Exists, Status.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 17-01-T1 | 01 | 1 | CAT-01, CAT-02, CAT-03, CAT-04, CAT-12 | T-17-01-01..05 | Wave 0 RED test stubs for schema + RLS + natural key + JOIN shape | integration | `npm test -- --run tests/integration/phase17-schema.test.ts tests/integration/phase17-natural-key.test.ts tests/integration/phase17-catalog-rls.test.ts tests/integration/phase17-join-shape.test.ts` | ❌ Wave 0 (created by this task) | ⬜ pending |
| 17-01-T2 | 01 | 1 | CAT-01, CAT-04, CAT-12 | T-17-01-05 | Drizzle schema declares `watchesCatalog`, `watchesCatalogDailySnapshots`, `watches.catalogId` with `onDelete: 'set null'` | unit (type) | `npx tsc --noEmit && grep -c "export const watchesCatalog " src/db/schema.ts` | ✅ schema.ts exists | ⬜ pending |
| 17-01-T3 | 01 | 1 | CAT-01, CAT-02, CAT-03, CAT-12 | T-17-01-01..05 | Supabase migration authors RLS + UNIQUE NULLS NOT DISTINCT + GIN + generated columns + CHECK + RLS for both tables | integration | `grep -c "NULLS NOT DISTINCT" supabase/migrations/20260427000000_phase17_catalog_schema.sql && grep -c "ENABLE ROW LEVEL SECURITY" supabase/migrations/20260427000000_phase17_catalog_schema.sql` | ❌ Wave 0 (created by this task) | ⬜ pending |
| 17-01-T4 | 01 | 1 | CAT-01..CAT-04, CAT-12 | T-17-01-01..05 | [BLOCKING] Local schema push — drizzle-kit push + docker exec psql for Supabase migration | integration | `npm test -- --run tests/integration/phase17-schema.test.ts tests/integration/phase17-natural-key.test.ts tests/integration/phase17-catalog-rls.test.ts tests/integration/phase17-join-shape.test.ts` | depends on T1+T2+T3 | ⬜ pending |
| 17-02-T1 | 02 | 2 | CAT-06, CAT-07, CAT-11 | T-17-02-01..04 | upsertCatalogFromUserInput + upsertCatalogFromExtractedUrl + getCatalogById + sanitizers in src/data/catalog.ts | unit (type) | `npx tsc --noEmit && grep -c "ON CONFLICT.*DO NOTHING" src/data/catalog.ts && grep -c "COALESCE(watches_catalog" src/data/catalog.ts` | depends on 17-01 | ⬜ pending |
| 17-02-T2 | 02 | 2 | CAT-08 (sets up linkWatchToCatalog used by Plan 03) | T-17-02-03 | linkWatchToCatalog with owner-scoped UPDATE WHERE id AND user_id | unit (type) | `grep -c "export async function linkWatchToCatalog" src/data/watches.ts && npx tsc --noEmit` | depends on 17-01 | ⬜ pending |
| 17-02-T3 | 02 | 2 | CAT-06, CAT-07 | T-17-02-01, T-17-02-04 | DO NOTHING + COALESCE + admin_curated guard + non-http URL rejection — 9 tests | integration | `npm test -- --run tests/integration/phase17-upsert-coalesce.test.ts` | ❌ created by this task | ⬜ pending |
| 17-03-T1 | 03 | 3 | CAT-08 | T-17-03-01..05 | addWatch + /api/extract-watch wire catalog with fire-and-forget try/catch; resilience proven via mock-throw | integration + unit | `npm test -- --run tests/integration/phase17-addwatch-wiring.test.ts tests/integration/phase17-extract-route-wiring.test.ts tests/actions/addwatch-catalog-resilience.test.ts` | ❌ all 3 created by this task | ⬜ pending |
| 17-04-T1 | 04 | 3 | CAT-05 | T-17-04-01..05 | scripts/backfill-catalog.ts is idempotent; service-role only; final zero-unlinked assertion exits 1 if non-zero | manual + integration | `npm run db:backfill-catalog && npm run db:backfill-catalog` (second run = "total linked: 0") | ❌ scripts/backfill-catalog.ts created by this task | ⬜ pending |
| 17-04-T2 | 04 | 3 | CAT-05 | T-17-04-01..05 | First-run links + second-run no-op + NULLS NOT DISTINCT dedup at script scale (subprocess invocation) | integration | `npm test -- --run tests/integration/phase17-backfill-idempotency.test.ts` | ❌ created by this task | ⬜ pending |
| 17-05-T1 | 05 | 4 | CAT-09, CAT-10 | T-17-05-01..07 | SECDEF function + REVOKE PUBLIC,anon,authenticated,service_role + GRANT service_role + sanity assertion DO block + cron.schedule guarded by extension | integration | `grep -c "SECURITY DEFINER" supabase/migrations/20260427000001_phase17_pg_cron.sql && grep -c "FROM PUBLIC, anon, authenticated, service_role" supabase/migrations/20260427000001_phase17_pg_cron.sql` | ❌ created by this task | ⬜ pending |
| 17-05-T2 | 05 | 4 | CAT-10 | T-17-05-07 | scripts/refresh-counts.ts mirrors prod cron 1:1; service-role db client | unit (type) + manual | `npx tsc --noEmit && grep -c "SELECT public.refresh_watches_catalog_counts" scripts/refresh-counts.ts` | ❌ created by this task | ⬜ pending |
| 17-05-T3 | 05 | 4 | CAT-09, CAT-10 | T-17-05-01..02 | Refresh function recomputes counts + writes idempotent snapshot + resets-on-delete; SECDEF anon+authed=false, service=true | integration | `npm test -- --run tests/integration/phase17-refresh-counts.test.ts tests/integration/phase17-secdef.test.ts` | ❌ both files created by this task | ⬜ pending |
| 17-05-T4 | 05 | 4 | CAT-09, CAT-10 | T-17-05-01..02 | [BLOCKING] Apply pg_cron migration locally + verify lockdown | integration | `npm test -- --run tests/integration/phase17-refresh-counts.test.ts tests/integration/phase17-secdef.test.ts && npm run db:refresh-counts` | depends on T1+T2+T3 | ⬜ pending |
| 17-06-T1 | 06 | 5 | (docs only — supports CAT-05, CAT-09, CAT-10, CAT-11) | T-17-06-01..02 | docs/deploy-db-setup.md Phase 17 section: prod push + backfill + cron verify + SECDEF verify + backout + footgun warnings | manual | `grep -c "Phase 17" docs/deploy-db-setup.md && grep -c "T-17-BACKFILL-PROD-DB" docs/deploy-db-setup.md` | ✅ docs/deploy-db-setup.md exists | ⬜ pending |
| 17-06-T2 | 06 | 5 | CAT-11 | T-17-06-04 | PROJECT.md Key Decisions row for catalog reversal + RLS asymmetry + NULLABLE INDEFINITELY | manual | `grep -c "watches_catalog" .planning/PROJECT.md && grep -c "NULLABLE INDEFINITELY" .planning/PROJECT.md` | ✅ .planning/PROJECT.md exists | ⬜ pending |
| 17-06-T3 | 06 | 5 | CAT-12 (image columns) | T-17-06-04 | image_url + image_source_url + image_source_quality round-trip + COALESCE first-non-null + CHECK valid/NULL | integration | `npm test -- --run tests/integration/phase17-image-provenance.test.ts` | ❌ created by this task | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/integration/phase17-schema.test.ts` — natural-key UNIQUE existence; trgm indexes existence; `watches.catalog_id` FK shape; snapshots table + UNIQUE; CHECK constraints; covers CAT-01 (structural), CAT-03, CAT-04, CAT-12 (Plan 01 Task 1)
- [ ] `tests/integration/phase17-natural-key.test.ts` — NULLS NOT DISTINCT dedup; casing collapse; reference normalization (Plan 01 Task 1; CAT-01 behavior)
- [ ] `tests/integration/phase17-catalog-rls.test.ts` — anon SELECT works; anon write blocked on both tables (Plan 01 Task 1; CAT-02 + Pitfall 4)
- [ ] `tests/integration/phase17-join-shape.test.ts` — `watches LEFT JOIN watches_catalog` returns expected shape (Plan 01 Task 1; CAT-11 forward-compat)
- [ ] `tests/integration/phase17-upsert-coalesce.test.ts` — DO NOTHING (CAT-06) + DO UPDATE COALESCE (CAT-07) + admin_curated guard + non-http URL rejection (Plan 02 Task 3)
- [ ] `tests/integration/phase17-addwatch-wiring.test.ts` — addWatch populates catalog_id end-to-end (Plan 03 Task 1; CAT-08)
- [ ] `tests/integration/phase17-extract-route-wiring.test.ts` — /api/extract-watch populates catalog (Plan 03 Task 1; CAT-08)
- [ ] `tests/actions/addwatch-catalog-resilience.test.ts` — addWatch fire-and-forget when catalog DAL throws (Plan 03 Task 1; Pitfall 9)
- [ ] `tests/integration/phase17-backfill-idempotency.test.ts` — first-run links + second-run no-op + NULLS NOT DISTINCT dedup (Plan 04 Task 2; CAT-05)
- [ ] `tests/integration/phase17-refresh-counts.test.ts` — function recomputes counts + writes idempotent snapshot + resets on delete (Plan 05 Task 3; CAT-09 + CAT-10)
- [ ] `tests/integration/phase17-secdef.test.ts` — anon/authenticated cannot EXECUTE; has_function_privilege correct; cron job scheduled (Plan 05 Task 3; CAT-09 + Pitfall 6)
- [ ] `tests/integration/phase17-image-provenance.test.ts` — image columns round-trip + COALESCE D-13 + CHECK constraint (Plan 06 Task 3; D-06 / CAT-12 sibling)

*Wave 0 owns these test stub files; later waves implement to satisfy them. Plan 01 Task 1 creates 4 stub files; Plan 02 Task 3 creates 1; Plan 03 Task 1 creates 3; Plan 04 Task 2 creates 1; Plan 05 Task 3 creates 2; Plan 06 Task 3 creates 1. Total: 12 test files.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| pg_cron job exists in production at 03:00 UTC | CAT-09 | Local Supabase Docker may not ship pg_cron | After `supabase db push --linked`, run `psql "$DATABASE_URL" -c "SELECT * FROM cron.job WHERE jobname LIKE 'refresh_watches_catalog%';"` against the Supabase project; expect 1 row with `schedule = '0 3 * * *'`. Documented in docs/deploy-db-setup.md section 17.3. |
| Drizzle introspection of NULLS NOT DISTINCT UNIQUE | CAT-01 | Drizzle 0.45.2 emit behavior must be eyeballed once | Plan 01 Task 2 Step 6: run `npx drizzle-kit generate`; inspect generated SQL; if `NULLS NOT DISTINCT` is missing, the Supabase migration is authoritative anyway. Document in 17-01-SUMMARY.md. |
| Prod backfill (npm run db:backfill-catalog with prod DATABASE_URL) | CAT-05 | Prod operation; cannot run in CI | After prod migration applies, operator runs script with prod URL exported. Final assertion enforces correctness ("unlinked remaining: 0"). Documented in docs/deploy-db-setup.md section 17.2 + footgun T-17-BACKFILL-PROD-DB. |
| SECDEF lockdown verified in prod | CAT-09 | Prod-specific role configuration | After prod migration, run `psql ... -c "SELECT has_function_privilege(...)"`. Documented in docs/deploy-db-setup.md section 17.4. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or [BLOCKING] checkpoint with manual verification command
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (Wave 0 RED stubs run within 30s; subsequent tasks GREEN them)
- [x] Wave 0 covers all MISSING references (12 files mapped above)
- [x] No watch-mode flags in any verify command
- [x] Feedback latency < 30s (catalog suite is ~30 seconds total)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** filled by gsd-planner 2026-04-27 — pending operator execution.
