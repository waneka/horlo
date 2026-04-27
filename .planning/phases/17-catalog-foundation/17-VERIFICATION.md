---
phase: 17-catalog-foundation
verified: 2026-04-27T20:33:00Z
status: passed
score: 6/6 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 17: Catalog Foundation Verification Report

**Phase Goal:** A canonical `watches_catalog` table is laid silently underneath per-user `watches`, populated from both manual entry and URL extraction, and refreshed daily — unblocking /search Watches, /explore Trending, and /evaluate deep-link without modifying `analyzeSimilarity()`.

**Verified:** 2026-04-27T20:33:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| #   | Truth   | Status     | Evidence       |
| --- | ------- | ---------- | -------------- |
| 1   | DB has a `watches_catalog` table that an anonymous Supabase client can read but cannot write to (public-read RLS, service-role-only writes) | VERIFIED | Live `\d watches_catalog` confirms table + `POLICY watches_catalog_select_all FOR SELECT USING (true)`; no INSERT/UPDATE/DELETE policy. `tests/integration/phase17-catalog-rls.test.ts` (8 tests) passes — anon SELECT works, anon writes blocked on both `watches_catalog` and `watches_catalog_daily_snapshots`. |
| 2   | Both `addWatch` (Server Action) and `/api/extract-watch` route call the catalog upsert helpers, and these calls are fire-and-forget — failure to upsert MUST NOT block the user-facing operation | VERIFIED | `src/app/actions/watches.ts:69-81` wraps `upsertCatalogFromUserInput` + `linkWatchToCatalog` in inner try/catch with `console.error('[addWatch] catalog wiring failed (non-fatal)')`. `src/app/api/extract-watch/route.ts:49-75` wraps `upsertCatalogFromExtractedUrl` in inner try/catch with `console.error('[extract-watch] catalog upsert failed (non-fatal)')`. `tests/actions/addwatch-catalog-resilience.test.ts` (3 tests) proves catalog throw → addWatch returns success=true. |
| 3   | An idempotent backfill script links every existing per-user `watches` row to a `watches_catalog` row (running it twice produces no changes) | VERIFIED | `scripts/backfill-catalog.ts` exists with `WHERE catalog_id IS NULL` filter (line 36-43) + final zero-unlinked assertion (line 53-67) + `process.exit(0)` on success. `tests/integration/phase17-backfill-idempotency.test.ts` (3 tests) — first run links 5 watches → 3 unique catalog rows (NULLS NOT DISTINCT collapses two pairs); second run reports `total linked: 0`. |
| 4   | A daily refresh function recomputes `owners_count` + `wishlist_count` AND writes a snapshot row in `watches_catalog_daily_snapshots` — scheduled by `pg_cron` in prod and via `npm run db:refresh-counts` locally | VERIFIED | `supabase/migrations/20260427000001_phase17_pg_cron.sql` creates `public.refresh_watches_catalog_counts()` SECURITY DEFINER function. Live DB query: `SELECT jobname, schedule FROM cron.job WHERE jobname='refresh_watches_catalog_counts_daily'` returns `0 3 * * *`. `scripts/refresh-counts.ts` calls the same function. `tests/integration/phase17-refresh-counts.test.ts` (4 tests) proves count refresh + snapshot write + idempotent re-run + reset-on-delete. |
| 5   | The SECDEF refresh function is locked down: `anon=f`, `authenticated=f`, `service_role=t` for EXECUTE | VERIFIED | Live DB query: `SELECT has_function_privilege('anon', 'public.refresh_watches_catalog_counts()', 'EXECUTE')` returns `f`; `authenticated` returns `f`; `service_role` returns `t`. Migration lines 70-73 explicitly REVOKE from PUBLIC, anon, authenticated, service_role then GRANT to service_role only. `tests/integration/phase17-secdef.test.ts` (4 tests) passes. |
| 6   | `analyzeSimilarity()` (in `src/lib/similarity.ts`) is unchanged | VERIFIED | `git diff 0dcdf85f2149832ae5201cbd5a8589984b7ea0c9..HEAD -- src/lib/similarity.ts` returns empty diff — file is byte-identical to pre-phase HEAD. Catalog is silent infrastructure as designed. |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/db/schema.ts` | `watchesCatalog` + `watchesCatalogDailySnapshots` tables; `catalogId` FK on `watches` | VERIFIED | Lines 276-326 (watchesCatalog with generated normalized columns), 331-345 (watchesCatalogDailySnapshots with UNIQUE per day), 103 (watches.catalogId with onDelete: 'set null') |
| `src/lib/types.ts` | `CatalogSource`, `ImageSourceQuality`, `CatalogEntry` exports | VERIFIED | (per Plan 01 SUMMARY — added; types referenced in `src/data/catalog.ts:7`) |
| `src/data/catalog.ts` | 4 exports: `upsertCatalogFromUserInput`, `upsertCatalogFromExtractedUrl`, `getCatalogById`, sanitizers; `server-only` import | VERIFIED | Line 2 (`'server-only'`), 122 (upsertCatalogFromUserInput), 162 (upsertCatalogFromExtractedUrl), 236 (getCatalogById), 19 (sanitizeHttpUrl), 35 (sanitizeTagArray). `ON CONFLICT ON CONSTRAINT watches_catalog_natural_key DO NOTHING` at 131; `DO UPDATE SET ... COALESCE(...)` at 201-220; admin_curated CASE guard at 202-205. |
| `src/data/watches.ts` | `linkWatchToCatalog(userId, watchId, catalogId)` — owner-scoped | VERIFIED | Line 222 — function exists with WHERE clause including `userId` (per Plan 02 SUMMARY) |
| `src/app/actions/watches.ts` | `addWatch` populates `watches.catalog_id` via fire-and-forget catalog wiring | VERIFIED | Line 6 (catalogDAL import), 69-81 (try/catch wraps upsert + link), 80 (`console.error('[addWatch] catalog wiring failed (non-fatal)')`) |
| `src/app/api/extract-watch/route.ts` | POST handler calls `upsertCatalogFromExtractedUrl` after `fetchAndExtract` (fire-and-forget) | VERIFIED | Line 5 (catalogDAL import), 49-75 (inner try/catch around catalog wiring), 74 (`console.error('[extract-watch] catalog upsert failed (non-fatal)')`) |
| `supabase/migrations/20260427000000_phase17_catalog_schema.sql` | RLS, generated columns, NULLS NOT DISTINCT UNIQUE, GIN, CHECK, trigger, snapshots table | VERIFIED | Live DB confirms: generated columns (`brand_normalized`, `model_normalized`, `reference_normalized` STORED), `watches_catalog_natural_key` UNIQUE CONSTRAINT with NULLS NOT DISTINCT, GIN indexes on brand+model, CHECK on `source` and `image_source_quality`, RLS enabled with SELECT-only policy on both tables. |
| `supabase/migrations/20260427000001_phase17_pg_cron.sql` | SECDEF function, REVOKE/GRANT lockdown, cron.schedule | VERIFIED | Live DB confirms: function exists, lockdown matrix `anon=f, authed=f, service=t`, cron job registered with schedule `0 3 * * *`. |
| `scripts/backfill-catalog.ts` | Idempotent batched backfill with WHERE catalog_id IS NULL filter + final zero-unlinked assertion | VERIFIED | File exists with `WHERE catalog_id IS NULL` (lines 27, 53), `ON CONFLICT ON CONSTRAINT watches_catalog_natural_key DO NOTHING`, `console.table(unlinked)` on failure, `process.exit(0)` on success. `package.json` exposes `db:backfill-catalog` script. |
| `scripts/refresh-counts.ts` | Calls `SELECT public.refresh_watches_catalog_counts()` via service-role db | VERIFIED | File exists; calls SECDEF function via service-role Drizzle client. `package.json` exposes `db:refresh-counts` script using `tsx --env-file=.env.local`. |
| `src/lib/similarity.ts` | UNCHANGED from pre-phase HEAD | VERIFIED | `git diff 0dcdf85f2149832ae5201cbd5a8589984b7ea0c9..HEAD -- src/lib/similarity.ts` returns empty. |

### Key Link Verification

| From | To  | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `addWatch` Server Action | `src/data/catalog.ts upsertCatalogFromUserInput` + `src/data/watches.ts linkWatchToCatalog` | fire-and-forget try/catch after `createWatch` | WIRED | `src/app/actions/watches.ts:69-81` — catalogDAL imported (line 6); both helpers called inside dedicated try/catch; on success watch.catalogId is set, on failure the watch insert is committed regardless. Verified by `tests/integration/phase17-addwatch-wiring.test.ts` (asserts `watches.catalog_id` non-null after addWatch) and `tests/actions/addwatch-catalog-resilience.test.ts` (asserts catalog throw doesn't break addWatch). |
| `/api/extract-watch` POST | `src/data/catalog.ts upsertCatalogFromExtractedUrl` | fire-and-forget try/catch after `fetchAndExtract` | WIRED | `src/app/api/extract-watch/route.ts:49-75` — catalogDAL imported (line 5); helper called with all spec fields including sanitized image URLs. Verified by `tests/integration/phase17-extract-route-wiring.test.ts` (asserts catalog row source='url_extracted' after POST). |
| `src/data/catalog.ts upsertCatalogFromUserInput` | `watches_catalog` table | `ON CONFLICT ON CONSTRAINT watches_catalog_natural_key DO NOTHING` + UNION ALL fallback | WIRED | Line 131 (DO NOTHING on conflict), 134-144 (UNION ALL SELECT fallback to retrieve existing id). Verified by `phase17-upsert-coalesce.test.ts` "user input does nothing on conflict" + "casing collapse via helper". |
| `src/data/catalog.ts upsertCatalogFromExtractedUrl` | `watches_catalog` table | `ON CONFLICT ... DO UPDATE SET col = COALESCE(catalog.col, EXCLUDED.col)` + admin_curated CASE guard | WIRED | Lines 201-221 — COALESCE on 11 nullable spec columns, CASE WHEN source = 'admin_curated' THEN source ELSE 'url_extracted' END (line 202-205). Verified by `phase17-upsert-coalesce.test.ts` "url extract enriches NULL columns via COALESCE", "admin_curated locked", "url extract does not overwrite non-null". |
| `scripts/backfill-catalog.ts` | `watches.catalog_id` (UPDATE WHERE catalog_id IS NULL) | single CTE per row (atomic upsert + link via COALESCE) | WIRED | Verified by `phase17-backfill-idempotency.test.ts`: first run links 5 watches → 3 unique catalog rows (NULLS NOT DISTINCT dedup); second run reports `total linked: 0` (idempotent); zero-unlinked assertion engages. |
| `pg_cron` daily job | `public.refresh_watches_catalog_counts()` | cron.schedule guarded by `IF EXISTS pg_extension WHERE extname = 'pg_cron'` | WIRED | Live `cron.job` table contains `refresh_watches_catalog_counts_daily` with schedule `0 3 * * *`. Pitfall 5 guard means migration apply is non-fatal on Docker without pg_cron. |
| `scripts/refresh-counts.ts` | `SELECT public.refresh_watches_catalog_counts()` | service-role Drizzle client | WIRED | Calls SECDEF function via `db.execute`; only role with EXECUTE is `service_role`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `watches_catalog.owners_count` | computed by SECDEF function | UPDATE FROM (SELECT COUNT(*) FILTER ... FROM watches GROUP BY catalog_id) | YES | FLOWING — `phase17-refresh-counts.test.ts` "refresh counts -- owners + wishlist" seeds 2 owned + 1 wishlist watches and asserts owners_count=2, wishlist_count=1 after function call. |
| `watches_catalog_daily_snapshots` row | INSERT ON CONFLICT DO UPDATE | function reads watches_catalog and inserts (catalog_id, current_date, owners_count, wishlist_count) | YES | FLOWING — same test asserts snapshot exists with correct counts and today's date. |
| `watches.catalog_id` (after addWatch) | linkWatchToCatalog UPDATE | catalog_id returned by upsertCatalogFromUserInput | YES | FLOWING — `phase17-addwatch-wiring.test.ts` asserts `watches.catalog_id` is non-null after Server Action call. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| All Phase 17 integration tests pass | `vitest run` on 12 test files | 56/56 passing in 3.89s | PASS |
| SECDEF lockdown live | `has_function_privilege` query on local DB | anon=f, authed=f, service=t | PASS |
| Schema in live DB matches plan | `\d watches_catalog` | All 28 columns present, generated columns STORED, natural_key UNIQUE NULLS NOT DISTINCT, RLS SELECT policy, CHECK constraints on source + image_source_quality | PASS |
| `watches.catalog_id` FK behavior | `pg_constraint.confdeltype` | `n` (SET NULL) | PASS |
| pg_cron schedule registered locally | `SELECT * FROM cron.job WHERE jobname='refresh_watches_catalog_counts_daily'` | 1 row, schedule `0 3 * * *` | PASS |
| `src/lib/similarity.ts` unchanged | `git diff <pre-phase>..HEAD -- src/lib/similarity.ts` | Empty diff | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| CAT-01 | 17-01 | `watches_catalog` table with surrogate UUID PK + natural-key UNIQUE on normalized trio | SATISFIED | Live DB: `watches_catalog_natural_key UNIQUE CONSTRAINT (brand_normalized, model_normalized, reference_normalized) NULLS NOT DISTINCT`. Tests: `phase17-schema.test.ts`, `phase17-natural-key.test.ts` (4 tests). |
| CAT-02 | 17-01 | Public-read RLS, service-role-only writes | SATISFIED | Live DB: `POLICY watches_catalog_select_all FOR SELECT USING (true)`, no INSERT/UPDATE/DELETE policies. Tests: `phase17-catalog-rls.test.ts` (8 tests). |
| CAT-03 | 17-01 | pg_trgm GIN indexes on brand + model | SATISFIED | Live DB: `watches_catalog_brand_trgm_idx gin (brand gin_trgm_ops)`, `watches_catalog_model_trgm_idx gin (model gin_trgm_ops)`. Tests: `phase17-schema.test.ts` "trgm indexes" + "trgm planner reachability". |
| CAT-04 | 17-01 | `watches.catalog_id` nullable FK, ON DELETE SET NULL | SATISFIED | Live DB: `confdeltype = 'n'` (SET NULL), `is_nullable = 'YES'`. Tests: `phase17-schema.test.ts` "watches.catalog_id FK". |
| CAT-05 | 17-04 | Idempotent backfill script | SATISFIED | `scripts/backfill-catalog.ts` + `npm run db:backfill-catalog`. Tests: `phase17-backfill-idempotency.test.ts` (3 tests). |
| CAT-06 | 17-02 | `upsertCatalogFromUserInput` with DO NOTHING | SATISFIED | `src/data/catalog.ts:122-148`. Tests: `phase17-upsert-coalesce.test.ts` (9 tests). |
| CAT-07 | 17-02 | `upsertCatalogFromExtractedUrl` with COALESCE + admin_curated guard | SATISFIED | `src/data/catalog.ts:162-226`. Tests: `phase17-upsert-coalesce.test.ts` "url extract enriches NULL", "admin_curated locked", "first-non-null wins". |
| CAT-08 | 17-03 | Both write paths populate `watches_catalog` via fire-and-forget wiring | SATISFIED | `src/app/actions/watches.ts:69-81`, `src/app/api/extract-watch/route.ts:49-75`. Tests: `phase17-addwatch-wiring.test.ts` + `phase17-extract-route-wiring.test.ts` + `addwatch-catalog-resilience.test.ts`. |
| CAT-09 | 17-05 | pg_cron daily-batch SECDEF refresh function | SATISFIED | `supabase/migrations/20260427000001_phase17_pg_cron.sql`. Live DB: cron job registered, SECDEF lockdown verified. Tests: `phase17-refresh-counts.test.ts` + `phase17-secdef.test.ts`. |
| CAT-10 | 17-05 | `npm run db:refresh-counts` local mirror | SATISFIED | `scripts/refresh-counts.ts` + `package.json` script entry. Verified by Plan 05 SUMMARY (sample run output). |
| CAT-11 | 17-02 + 17-06 | Catalog authoritative for SPEC fields via `catalog_id` JOIN at display time | SATISFIED | `getCatalogById` exists in `src/data/catalog.ts:236`. JOIN shape verified by `phase17-join-shape.test.ts` (LEFT JOIN watches → watches_catalog). PROJECT.md captures the design contract for downstream consumers (Phase 19/20). |
| CAT-12 | 17-01 + 17-06 | `watches_catalog_daily_snapshots` table records (catalog_id, date, counts) | SATISFIED | Live DB: table exists with UNIQUE on (catalog_id, snapshot_date), RLS public-read. Tests: `phase17-refresh-counts.test.ts` "snapshot written for today" + "snapshot idempotent same-day"; `phase17-image-provenance.test.ts` (CAT-12 sibling — image columns round-trip). |

All 12 CAT-NN requirements are SATISFIED.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `src/data/catalog.ts` | 56, 59 | `as CatalogSource` / `as ImageSourceQuality` casts without runtime validation | Info | DB CHECK constraint enforces the literal union; cast is safe in practice. Documented in 17-REVIEW.md IN-02. |
| `src/app/actions/watches.ts` | 69-81 | Single try/catch wraps both `upsertCatalogFromUserInput` AND `linkWatchToCatalog` — the error log can't distinguish which half failed | Info | Functionally correct (both are fire-and-forget). The 17-REVIEW.md WR-04 finding suggests splitting for log clarity but the goal is met. |
| `tests/actions/addwatch-catalog-resilience.test.ts` | 52-67 | `mockWatch: Watch` literal includes excess properties (`userId`, `catalogId`, `createdAt`, `updatedAt`) | Info | Documented in 17-REVIEW.md WR-01. Test passes at runtime but `tsc --noEmit` may surface TS2353. Not blocking goal. |
| `scripts/backfill-catalog.ts` | 10-11 | `import { config } from 'dotenv'` without dotenv as explicit dependency | Info | Documented in 17-REVIEW.md WR-02. Works today via transitive resolution; future-proofing concern only. |

No blockers found. All findings are quality/robustness improvements documented in 17-REVIEW.md, none of which prevent the phase goal.

### Human Verification Required

None. All goal-critical behaviors are verified programmatically:
- 56 integration tests pass against live local DB
- Live DB schema matches plan (verified via psql)
- SECDEF lockdown verified via `has_function_privilege` (anon=f, authed=f, service=t)
- pg_cron schedule registered locally (`0 3 * * *`)
- `src/lib/similarity.ts` unchanged from pre-phase HEAD (empty diff)
- Fire-and-forget resilience proven by mock-throw test

The phase is "silent infrastructure" — there is no user-facing UI to verify visually. Production deployment via `supabase db push --linked` is documented in `docs/deploy-db-setup.md` sections 17.1–17.6 and is the operator's responsibility post-merge.

### Gaps Summary

No gaps. Phase 17 achieves its goal: a canonical `watches_catalog` table is in place beneath per-user `watches`, populated by both write paths via fire-and-forget upsert helpers, refreshed daily by a SECDEF function (pg_cron in prod / npm script locally) that is locked down to service_role only, with `analyzeSimilarity()` deliberately untouched. All six ROADMAP success criteria are met. All 12 CAT-NN requirements are satisfied.

---

_Verified: 2026-04-27T20:33:00Z_
_Verifier: Claude (gsd-verifier)_
