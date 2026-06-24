---
id: 260623-uua
type: quick
slug: improve-catalog-and-collection-search-er
status: complete
date_started: 2026-06-23
date_completed: 2026-06-24
duration: ~50 min
files_modified:
  - supabase/migrations/20260623200000_quick_260623_uua_search_unaccent_trgm.sql
  - src/data/catalog.ts
  - src/data/search.ts
  - tests/data/searchCatalogWatches.test.ts
  - tests/data/searchCollections.test.ts
commits:
  - 81e21fb3
  - ac89ad1f
  - 50621739
  - 99172df2
uat_approved: 2026-06-24
prod_push_required:
  - git push (4 commits ahead of origin/main)
  - supabase db push --linked (deploys the unaccent + pg_trgm migration to prod)
---

# Quick Task 260623-uua: Search Ergonomics Summary

**Multi-token + diacritic-fold + typo-tolerant catalog & collection search — the four "search is too strict" failures the user reported all return results now.**

## Performance

- **Duration:** ~50 min (planning + execution + smoke tests + human UAT)
- **Tasks completed:** 5/5
- **Commits:** 4 (Task 4 was a UAT checkpoint, Task 5 is this SUMMARY)

## Accomplishments

- "omega seamaster" now returns Omega Seamaster rows (was 0 — single-pattern ILIKE could not match a query spanning brand + model columns)
- "Heron" (no accent) now returns Héron Watches rows (was 0 — ILIKE is case-insensitive but not diacritic-folding)
- "Jaeger la" now returns Jaeger-LeCoultre rows (was 0 — hyphen broke substring match against `jaeger-lecoultre`)
- "Jeager" (typo) now returns Jaeger-LeCoultre via pg_trgm `word_similarity > 0.2` fuzzy fallback
- All existing facet predicates (movement/size/style/brand/era) AND-compose correctly with the new tokenized text predicate
- searchCollections preserves all privacy gates (profile_public + collection_public + viewer self-exclusion) and match-path classification
- 52/52 DAL tests passing, `npm run build` clean (exit 0)

## Task Commits

1. **Task 1: additive migration (unaccent + pg_trgm + functional trigram indexes + f_unaccent IMMUTABLE wrapper)** — `81e21fb3` (feat)
2. **Task 2: rewire searchCatalogWatches with multi-token + unaccent + pg_trgm fallback** — `ac89ad1f` (feat)
3. **Task 2-fix: swap fuzzy threshold from `similarity > 0.3` to `word_similarity > 0.2`** — `50621739` (fix) — Rule 1 auto-fix during smoke testing
4. **Task 3: rewire searchCollections CTE WHERE with multi-token + unaccent** — `99172df2` (feat)
5. **Task 4: manual UAT against local Supabase** — checkpoint, no commit, approved by user 2026-06-24
6. **Task 5: this SUMMARY** — no commit (orchestrator handles docs commit)

## Files Created/Modified

- `supabase/migrations/20260623200000_quick_260623_uua_search_unaccent_trgm.sql` (new) — CREATE EXTENSION unaccent + pg_trgm; `f_unaccent` IMMUTABLE wrapper (naked `unaccent()` is STABLE and cannot be used in functional indexes); 4 functional GIN trigram indexes on `lower(f_unaccent(brand|model))` for `watches_catalog` and `watches`
- `src/data/catalog.ts` — `searchCatalogWatches` rewritten with whitespace tokenization + AND-of-ORs (mirroring the Phase 72 SRCH-01 pattern in `searchCatalogForAddFlow`) + `lower(public.f_unaccent(...))` fold on both indexed columns and query bind + pg_trgm `word_similarity > 0.2` fuzzy fallback tier that fires when strict returns 0 AND `trimmed.length >= 3`. `searchCatalogForAddFlow` UNCHANGED — it was the reference implementation.
- `src/data/search.ts` — `searchCollections` CTE WHERE rewritten with per-token AND-of-ORs + unaccent fold. CTE shape, GROUP BY, jsonb_agg of matched_watches, matched_tags array_agg, ORDER BY, LIMIT, and JS post-sort all UNCHANGED. Privacy predicate `ps.profile_public = true AND ps.collection_public = true AND p.id != ${viewerId}` preserved verbatim.
- `tests/data/searchCatalogWatches.test.ts` — appended `describe('260623-uua tokenization')`, `describe('260623-uua unaccent fold')`, `describe('260623-uua pg_trgm fallback tier')` blocks (13 new tests)
- `tests/data/searchCollections.test.ts` — appended `describe('260623-uua tokenization')`, `describe('260623-uua unaccent fold')` blocks (12 new tests)

## Decisions Made

All implementation decisions were pre-locked in PLAN.md D-01..D-12 — followed verbatim with one auto-fix (below).

## Deviations from Plan

### Auto-fix: pg_trgm threshold (`similarity` → `word_similarity`, 0.3 → 0.2)

- **Found during:** Task 2 smoke testing
- **Issue:** Plan specified `similarity() > 0.3` per the standard pg_trgm idiom. Against local seed: `similarity('jaeger-lecoultre', 'jeager') = 0.143` — the `-lecoultre` suffix dilutes trigram overlap below threshold. The user's reported failing query "Jeager" returned 0 even with the fuzzy fallback.
- **Fix:** Switched to `word_similarity()` (pg_trgm function for "best matching contiguous substring" — the canonical idiom for "user typed a typo of one word inside a multi-word string"). `word_similarity('jaeger-lecoultre', 'jeager') = 0.286` — comfortably above the lowered 0.2 threshold. Verified "omeg" → "omega" scores 0.8.
- **Files modified:** `src/data/catalog.ts`, `tests/data/searchCatalogWatches.test.ts`
- **Committed in:** `50621739` (separate commit from Task 2 for traceability)

### Local migration applied via direct psql

- **Reason:** Local DB has migration-history drift documented in `project_local_db_reset` memory — `supabase db reset` is fragile mid-session.
- **Action:** Applied the SQL file directly via `psql`, then manually inserted the version row into `supabase_migrations.schema_migrations` so future `supabase migration up` won't re-run it.
- **Prod impact:** None — `supabase db push --linked` for prod will pick up the file normally via the standard migration tracking.

### Test assertion shape adjustment

- `tests/data/searchCatalogWatches.test.ts` Test 3 + Test 7: rewrote assertions to inspect generated SQL (raw `lower(public.f_unaccent(...) ILIKE ...)` chunks) rather than the Drizzle `ilike()` helper that the old strict-only path used. Test 7 now expects `selectCount === 2` (strict + fallback) for the zero-strict-result branch. Pitfall 4 invariant (no state-hydration query when final candidates empty) re-asserted explicitly.

## Local UAT Results (approved 2026-06-24)

All 9 /search Watches tab cases pass; all 3 /search Collections tab cases pass. Approved by user verbatim ("approved").

## Prod Push Checklist

1. `git push origin main` (4 commits ahead)
2. `supabase db push --linked` (deploys the unaccent + pg_trgm migration)
3. Spot-check on prod: search "Jeager" + "omega seamaster" + "Heron" should each return ≥1 row

## Memories Cited (executor honored all)

- `project_drizzle_supabase_db_mismatch` — migration filename `20260623200000_*.sql` correctly orders after the most recent prior migration
- `project_db_wipeable_2026_05_09` — zero ALTER TABLE on `watches_catalog`; functional indexes only
- `project_drizzle_sql_any_array_pitfall` — used `sql.join(...)` style for per-token lists; verified actual SQL against local Supabase before declaring done
- `feedback_local_first_dev` — Task 4 was a mandatory UAT gate, not skippable
- `project_baseline_not_green_build_is_gate` — `npm run build` exit 0 was THE acceptance signal (not full vitest, not tsc --noEmit)
- `project_local_catalog_natural_key_drift` — re-seed path documented but not needed (no drift surfaced)

## Follow-ups (not in this scope)

- **SEED-021 (brand canonicalization)** still pending — this quick task explicitly defers brand/model dedup ("Hamilton" vs "Hamilton Watch", "OMEGA" vs "Omega"). The user accepted the split. SEED-021 is the proper home for those data fixes + recommender brand_id rewire + brand-picker UI on add-watch.
- Consider adding pg_trgm fuzzy fallback to `searchCollections` later if user reports typo frustration on the Collections tab too (per D-07 we skipped it because the failing examples were all catalog-side and the CTE shape is more risky to mutate).
