---
phase: 80-not-null-constraint-flip-ingest-hardening
verified: 2026-06-25T20:30:00Z
status: passed
score: 6/6
overrides_applied: 0
re_verification: null
gaps: []
deferred: []
human_verification: []
---

# Phase 80: NOT NULL Constraint Flip + Ingest Hardening — Verification Report

**Phase Goal:** The schema enforces that every `watches_catalog` row resolves to a brand and family, and `/api/extract-watch` cannot create new canonical drift after this phase — every extract attempt either matches an existing `brand_id` (exact or fuzzy) or auto-creates a `needs_review: true` row.

**Verified:** 2026-06-25T20:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `watches_catalog.brand_id` and `watches_catalog.family_id` are both NOT NULL; inserting a NULL value fails with 23502 at the database layer (CANON-01, CANON-02) | VERIFIED | `schema.ts` L505-506: `.notNull().references(...)`; migration SQL applies `ALTER TABLE ... SET NOT NULL` with pre/post-flight guards; 80-POST-DEPLOY Step 3 sign-off: `is_nullable = NO` on both columns, 206 rows / 0 NULL FKs confirmed via `information_schema`; integration test `80-not-null-constraint.test.ts` asserts 23502 on NULL insert |
| 2 | Exact brand match attaches existing `brand_id` with no new row created (INGEST-01) | VERIFIED | `catalog-resolver.ts` Tier 1: `SELECT WHERE name_normalized = lower(trim(${rawBrand}))`, returns on first hit; no log event emitted; unit test "Brand Tier 1 (exact) — INGEST-01" green; local-DB integration test "Brand Tier 1 (exact match against seeded Hamilton brand)" green; prod Step 2 sign-off confirms `canonical_brand = 'Hamilton'` with zero `brand_auto_created` event |
| 3 | Fuzzy clear-gap brand match (score >= 0.6, gap >= 0.1 over runner-up) attaches `brand_id` and emits `fuzzy_brand_match` log event with 8-key payload; no user-visible delay (INGEST-02) | VERIFIED | `catalog-resolver.ts` Tier 2: `word_similarity(...) >= 0.6 LIMIT 2`, gap check `top.score - runnerUp.score >= BRAND_FUZZY_CLEAR_GAP (0.1)`; `console.log('[extract-watch] fuzzy_brand_match', {...})` with all 8 keys; unit test "Brand Tier 2 (fuzzy clear-gap matched)" asserts exact log payload shape; prod Step 2 Vercel logs: `fuzzy_brand_match` with `score: 0.6`, `decision: matched`, full 8-key payload for "Hamilton Watch" → canonical Hamilton |
| 4 | No-match brand auto-creates a `brands` row with `needs_review: true` and attaches its `brand_id`; user flow never blocks (INGEST-03) | VERIFIED | `catalog-resolver.ts` `_brandAutoCreate`: `INSERT INTO brands (name, slug, needs_review) VALUES (..., true) ON CONFLICT ... RETURNING id`; emits `brand_auto_created` event on actual insertion (xmax=0 guard); unit test "Brand Tier 3 (no candidates → no_candidates_auto_create)" green; local-DB integration test "Brand Tier 3 (auto-create with needs_review=true)" green; prod Step 3 sign-off: `families_needs_review = 1` (Khaki Navy Scuba Auto 40mm auto-created) |
| 5 | Family resolution follows exact → alias (`@>`) → fuzzy → auto-create, with alias tier beating fuzzy for operator-curated merges (INGEST-04) | VERIFIED | `catalog-resolver.ts` `resolveFamilyId`: Tier 1 exact on `name_normalized`, Tier 2 `aliases @> ARRAY[lower(trim(...))]::text[]` with `ORDER BY created_at ASC`, Tier 3 `word_similarity >= 0.6 LIMIT 1` (no clear-gap rule per D-80-02), Tier 4 auto-create; unit test "Family Tier 2 (alias hit beats fuzzy)" confirms Tier 3 queue entry is NOT consumed when Tier 2 hits; local-DB test "Family Tier 2 (alias hit on 'Brut Date' → 'Brut Datejust')" exercises the actual alias containment path |
| 6 | Both upsert helpers (`upsertCatalogFromExtractedUrl` and `upsertCatalogFromUserInput`) invoke the resolver and write non-NULL `brand_id` + `family_id` on every INSERT; ON CONFLICT does NOT overwrite existing FKs (INGEST-01..04) | VERIFIED | `catalog.ts` L11: `import { resolveBrandId, resolveFamilyId } from '@/data/catalog-resolver'`; `upsertCatalogFromUserInput` L146-152: resolver called before INSERT, `brand_id` + `family_id` in column list; `upsertCatalogFromExtractedUrl` L199-230: resolver called before INSERT, both FKs in column list; DO UPDATE SET clause (L232-253) does NOT include `brand_id` or `family_id` (operator-merge values preserved on re-extract); integration tests `upsert-catalog-from-extracted-url.test.ts` and `upsert-catalog-from-user-input.test.ts` assert non-NULL FKs on inserted rows |

**Score:** 6/6 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/data/catalog-resolver.ts` | Brand 3-tier + family 4-tier resolver with D-80-04 structured log events | VERIFIED | 334 lines; `import 'server-only'`; exports `resolveBrandId`, `resolveFamilyId`, `BRAND_FUZZY_CLEAR_GAP`, `BRAND_FUZZY_MIN_SCORE`, `FAMILY_FUZZY_MIN_SCORE`, `UNSPECIFIED_FAMILY_NAME`; all tiers implemented with parameterized SQL |
| `src/lib/slug.ts` | Extracted slug helpers with `server-only` import | VERIFIED | 36 lines; exports `slugify` and `slugifyWithRandomSuffix`; `import 'server-only'` + `import { randomUUID } from 'node:crypto'`; used by resolver for auto-create slug collision prevention |
| `src/data/catalog.ts` (modified) | Resolver wired into both upsert helpers | VERIFIED | L11 imports resolver; L146-147 and L199-200 call `resolveBrandId` + `resolveFamilyId` before INSERT; L151+L217 include `brand_id` + `family_id` in INSERT column lists; ON CONFLICT preserves FKs |
| `src/db/schema.ts` (modified) | `watches_catalog.brand_id` + `family_id` have `.notNull()` | VERIFIED | L505: `brandId: uuid('brand_id').notNull().references(() => brands.id, { onDelete: 'restrict' })`; L506: `familyId: uuid('family_id').notNull().references(() => watchFamilies.id, { onDelete: 'restrict' })` |
| `supabase/migrations/20260626000000_phase80_catalog_brand_family_not_null.sql` | NOT NULL migration with pre/post-flight guards using divergent predicates | VERIFIED | 101 lines; pre-flight counts NULL rows (`IS NULL`); `ALTER TABLE SET NOT NULL` on both columns; post-flight checks `information_schema.columns is_nullable = 'NO'` (divergent predicate per `[[post-flight-assertion-predicate-divergence]]`); wrapped in `BEGIN`/`COMMIT`; applied to prod (supabase db push --linked) |
| `tests/unit/data/catalog-resolver.test.ts` | 10 unit cases; node env; 8-key D-80-04 payload validation | VERIFIED | 317 lines; `@vitest-environment node`; 10 test cases covering all brand/family tiers + edge cases (empty model, idempotency); queue-based DB mock; payload key assertions via `Object.keys` whitelist |
| `tests/integration/migrations/80-not-null-constraint.test.ts` | CANON-01/02 23502 assertions against local DB | VERIFIED | 77 lines; `@vitest-environment node`; DATABASE_URL gate; 3 tests (brand_id NOT NULL, family_id NOT NULL, NULL INSERT raises 23502) |
| `tests/integration/data/catalog-resolver-against-local-db.test.ts` | 4 local-DB cases (exact, fuzzy, alias, auto-create) | VERIFIED | 136 lines; `@vitest-environment node`; DATABASE_URL gate; beforeAll conditionally seeds alias; afterAll cleanup |
| `tests/integration/data/upsert-catalog-from-extracted-url.test.ts` | Non-NULL FK assertion on end-to-end upsert | VERIFIED | 123 lines; asserts both `brand_id` and `family_id` non-NULL on inserted row |
| `tests/integration/data/upsert-catalog-from-user-input.test.ts` | Non-NULL FK assertion on end-to-end upsert | VERIFIED | 104 lines; asserts both `brand_id` and `family_id` non-NULL on inserted row |
| `.planning/phases/80-.../80-POST-DEPLOY.md` | D-80-03 staged deploy runbook with Steps 1+2+3 sign-off | VERIFIED | All 3 steps marked complete; Step 1 deploy `horlo-ach55t2p0` Ready after fix commit `922a378c`; Step 2 Hamilton extract proves both FKs non-NULL + Vercel log payload verified; Step 3 migration applied, post-flight SQL confirms `is_nullable = NO`, `total = 206`, `null_brand_id = 0`, `null_family_id = 0` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `catalog.ts` `upsertCatalogFromExtractedUrl` | `catalog-resolver.ts` `resolveBrandId` | `import { resolveBrandId, resolveFamilyId }` at L11; called at L199 | WIRED | Both resolver functions called before INSERT; brandId + familyId destructured and passed to SQL |
| `catalog.ts` `upsertCatalogFromUserInput` | `catalog-resolver.ts` `resolveBrandId` + `resolveFamilyId` | Same import; called at L146-147 | WIRED | CTE INSERT includes `brand_id, family_id` at L151 with resolver-resolved values |
| `catalog-resolver.ts` | `slug.ts` `slugifyWithRandomSuffix` | `import { slugifyWithRandomSuffix } from '@/lib/slug'` at L7 | WIRED | Used in `_brandAutoCreate` at L173 for slug collision prevention |
| `catalog-resolver.ts` | `@/db` Drizzle client | `import { db } from '@/db'`; `db.execute(sql`...`)` for all 7 SQL queries | WIRED | All tiers use parameterized `sql` template tag; no `sql.raw` |
| `scripts/v8.4-brand-canonicalization.ts` | `slug.ts` `slugify` | `import { slugify } from '@/lib/slug'` at L165 (explicit import + re-export) | WIRED | Fix commit `922a378c` added the explicit import; earlier `export { slugify }` alone left the symbol out of local scope (the reported build failure) |
| `schema.ts` `watchesCatalog` | `brands` table | `uuid('brand_id').notNull().references(() => brands.id, { onDelete: 'restrict' })` | WIRED | FK enforced at Drizzle schema level + migration SQL level |
| `schema.ts` `watchesCatalog` | `watchFamilies` table | `uuid('family_id').notNull().references(() => watchFamilies.id, { onDelete: 'restrict' })` | WIRED | FK enforced at Drizzle schema level + migration SQL level |

---

### Data-Flow Trace (Level 4)

This phase produces no UI rendering artifacts (it is a DAL + schema phase). Data flows verified through the ingest pipeline:

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `catalog-resolver.ts` `resolveBrandId` | `exactRows` / `fuzzyRows` | `db.execute(sql` SELECT FROM brands WHERE name_normalized = ...`)` — live DB query | Yes — queries `brands` table with parameterized bind | FLOWING |
| `catalog-resolver.ts` `_brandAutoCreate` | `autoCreateRows[0].id` | `db.execute(sql` INSERT INTO brands ... RETURNING id`)` with `ON CONFLICT` idempotency | Yes — real INSERT into `brands` table | FLOWING |
| `catalog-resolver.ts` `resolveFamilyId` | `exactRows` / `aliasRows` / `fuzzyRows` | `db.execute(sql` SELECT FROM watch_families WHERE brand_id = ${brandId} AND ...`)` — brand-scoped queries | Yes — queries `watch_families` table with parameterized binds | FLOWING |
| `catalog.ts` `upsertCatalogFromExtractedUrl` | `brandId`, `familyId` | Resolver return values — passed to `sql` INSERT at L210-231 | Yes — resolver values flow into INSERT column list | FLOWING |
| `catalog.ts` `upsertCatalogFromUserInput` | `brandId`, `familyId` | Resolver return values — passed to CTE INSERT at L149-152 | Yes — resolver values flow into INSERT column list | FLOWING |

---

### Behavioral Spot-Checks

Step 7b skipped — this phase has no runnable entry points testable without a running server and live DB connection. Verification is through integration tests (DATABASE_URL-gated) and prod sign-off captured in `80-POST-DEPLOY.md`.

---

### Probe Execution

No probe scripts declared for this phase. The phase uses manual prod verification (D-80-03 staged deploy pattern) documented in `80-POST-DEPLOY.md` rather than automated shell probes.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CANON-01 | 80-04-PLAN.md | `watches_catalog.brand_id NOT NULL` after migration | SATISFIED | `schema.ts` L505 `.notNull()`; migration L62-63 `ALTER TABLE ... SET NOT NULL`; prod `is_nullable = NO`; integration test green |
| CANON-02 | 80-04-PLAN.md | `watches_catalog.family_id NOT NULL` after migration | SATISFIED | `schema.ts` L506 `.notNull()`; migration L66-67 `ALTER TABLE ... SET NOT NULL`; prod `is_nullable = NO`; integration test green |
| INGEST-01 | 80-02-PLAN.md + 80-03-PLAN.md | Exact brand match attaches existing `brand_id` | SATISFIED | Resolver Tier 1 `WHERE name_normalized = lower(trim(${rawBrand}))`; both upsert helpers wired; unit test green; prod step 2 shows canonical Hamilton attached |
| INGEST-02 | 80-02-PLAN.md | Fuzzy brand match >= 0.6 with clear gap attaches `brand_id`, logs event | SATISFIED | Resolver Tier 2 `word_similarity >= 0.6 LIMIT 2` + gap check; `console.log('[extract-watch] fuzzy_brand_match', {...8 keys...})`; unit test asserts exact payload; prod Vercel log fired with `score: 0.6` |
| INGEST-03 | 80-02-PLAN.md | No-match auto-creates `brands` row with `needs_review: true` | SATISFIED | Resolver `_brandAutoCreate` INSERT with `needs_review = true`; `ON CONFLICT DO UPDATE SET needs_review = brands.needs_review` (idempotent); `brand_auto_created` event emitted on actual create; prod `brands_needs_review = 0` (Hamilton matched; family auto-created instead) |
| INGEST-04 | 80-02-PLAN.md | Family resolution: exact → alias → fuzzy → auto-create, alias before fuzzy | SATISFIED | `resolveFamilyId` 4-tier implementation; Tier 2 uses `aliases @> ARRAY[...]::text[]`; unit test confirms alias tier short-circuits before fuzzy tier (queue length assertion); local-DB test exercises Brut Date → Brut Datejust alias path |

---

### D-80 Locked Decision Compliance

| Decision | Description | Implemented | Evidence |
|----------|-------------|-------------|---------|
| D-80-01 | Clear-gap fuzzy tie-break: top score beats runner-up by >= 0.1; otherwise falls through to auto-create | YES | `catalog-resolver.ts` L112: `if (gap >= BRAND_FUZZY_CLEAR_GAP)`; `BRAND_FUZZY_CLEAR_GAP = 0.1`; ambiguous case emits `tied_auto_create` and routes to `_brandAutoCreate` |
| D-80-02 | Family chain: exact → alias → fuzzy → auto-create; alias tier BEFORE fuzzy | YES | `resolveFamilyId` tier ordering: exact (L227), alias `@>` (L245), fuzzy (L263), auto-create (L300); unit test "Family Tier 2 (alias hit beats fuzzy)" verifies Tier 3 queue entry is unconsumed |
| D-80-03 | Staged deploy: ingest code first → manual extract proof → NOT NULL migration | YES | All 3 steps completed in order (commit `922a378c` deployed, Hamilton extract on prod, `supabase db push --linked`); documented in `80-POST-DEPLOY.md` with timestamps |
| D-80-04 | Structured `console.log` events with unified 8-key payload; response shape unchanged | YES | All events use `console.log('[extract-watch] {event}', { input_raw, decision, matched_id, matched_name, score, runner_up_id, runner_up_name, runner_up_score })`; family events also include `brand_id`; auto-create events use `null` for score + runner_up_* (not omitted); unit tests assert `Object.keys` whitelist with 8 mandatory keys |

---

### Wave 0 Validation Gaps Closed

| Gap | Status | Evidence |
|-----|--------|---------|
| `tests/unit/data/catalog-resolver.test.ts` — 10 unit cases | CLOSED | File exists (12,718 bytes); all 10 test cases present; `nyquist_compliant: true` in `80-VALIDATION.md` frontmatter |
| `tests/integration/migrations/80-not-null-constraint.test.ts` — CANON-01/02 | CLOSED | File exists (3,267 bytes); 3 test cases; applied migration makes tests green |
| `tests/integration/data/catalog-resolver-against-local-db.test.ts` — INGEST-04 alias | CLOSED | File exists (5,590 bytes); 4 local-DB cases |
| `tests/integration/data/upsert-catalog-from-extracted-url.test.ts` — INGEST-01..03 | CLOSED | File exists (4,963 bytes); closes 80-02-01 W0 gap |
| `tests/integration/data/upsert-catalog-from-user-input.test.ts` — INGEST-01/04 | CLOSED | File exists (4,226 bytes); closes 80-03-01 W0 gap |
| `80-VALIDATION.md` `nyquist_compliant: true` + `wave_0_complete: true` | CLOSED | Frontmatter shows both flags true; Validation Sign-Off section marked complete |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/data/catalog-resolver.ts` | 223 | `// Step 0 — Empty-model placeholder` — comment contains word "placeholder" | INFO | Comment documents the `UNSPECIFIED_FAMILY_NAME = '(unspecified)'` design choice (Discretion ii-b); NOT a code placeholder; the behavior is implemented (L224: `rawModel.trim() === '' ? UNSPECIFIED_FAMILY_NAME : rawModel`) — no stub risk |

No blockers or warnings found. The one INFO-level match is a comment describing implemented behavior, not a deferred implementation.

---

### Slug Import Bug — Fix Verification

The POST-DEPLOY documents that the initial deploy commit `334e0a55` failed the Vercel TypeScript build because `scripts/v8.4-brand-canonicalization.ts` had an `export { slugify }` re-export but no local `import`. Fix commit `922a378c` added the explicit import.

**Verification:**
- `scripts/v8.4-brand-canonicalization.ts` L165: `import { slugify } from '@/lib/slug'` — explicit import present
- L166: `export { slugify }` — re-export preserved for backward compatibility
- L981: `${slugify(resolved.rawName)}` — call site uses locally-imported symbol
- No other files in `src/` or `scripts/` have the same re-export-without-import pattern for `slugify`
- `src/data/catalog-resolver.ts` L7: `import { slugifyWithRandomSuffix } from '@/lib/slug'` — direct import, no re-export pattern

**Status: FULLY FIXED.** No other call sites have the same scope bug.

---

### Human Verification Required

None. All observable behaviors are verifiable through code inspection + prod sign-off captured in `80-POST-DEPLOY.md`. The prod sign-off constitutes the manual verification gate required by D-80-03 and CLAUDE.md § Local-First Development.

---

### Gaps Summary

None. All 6 requirements (CANON-01, CANON-02, INGEST-01, INGEST-02, INGEST-03, INGEST-04) are met. All 5 ROADMAP success criteria are met. All 4 locked decisions (D-80-01..D-80-04) are implemented in shipped code and verified in prod. All 5 Wave 0 test files exist and are substantive. The slug import bug is fully repaired. Prod deployment completed in correct D-80-03 staged order with sign-off captured.

---

_Verified: 2026-06-25T20:30:00Z_
_Verifier: Claude (gsd-verifier)_
