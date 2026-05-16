---
phase: 34
plan: 02
subsystem: backfill-script
tags:
  - backfill
  - script
  - service-role
  - idempotent
  - phase34
  - cat-15
  - layer-a
dependency_graph:
  requires:
    - scripts/backfill-catalog.ts (Phase 17 D-14 — structural twin template)
    - scripts/backfill-taste.ts (Phase 19.1 — CLI argument parsing pattern lines 39–49)
    - src/db schema exports (post-Plan-01: brands + watchFamilies + brandId/familyId on watchesCatalog)
    - 34-01-SUMMARY.md (schema layer this plan writes against — brands, watch_families, watches_catalog.brand_id)
  provides:
    - scripts/backfill-catalog-brands.ts (3-pass idempotent service-role brand backfill)
    - scripts/country.json (operator-edited name_normalized → ISO country mapping; 44 entries)
    - npm run db:backfill-catalog-brands (package.json script entry)
    - Verified-working idempotent backfill rhythm for Plan 03 prod push
  affects:
    - Plan 03 (production push) — invokes `DATABASE_URL=<prod> npm run db:backfill-catalog-brands` per Footgun T-17-BACKFILL-PROD-DB precedent
    - Phase 35 (Layer B) — watch_families backfill follows same shape (deferred per D-03)
tech-stack:
  added: []
  patterns:
    - 3-pass idempotent backfill (passA derive → passB patch → passC link) with WHERE-x-IS-NULL filters
    - DISTINCT ON (lower(trim(brand))) ORDER BY ..., id ASC for deterministic canonical-name selection (Pitfall 5)
    - Drizzle `sql` template tag parameterization for SQL injection defense (T-34-05 mitigation)
    - Inline `process.argv.slice(2).map` argument parsing — no commander/yargs dep (matches backfill-taste.ts:39–49)
    - WITH CTE + RETURNING + count(*)::int for executable-statement row counts in passA/passB/passC
    - Final assertion (`SELECT count(*) FROM watches_catalog WHERE brand_normalized IS NOT NULL AND brand_id IS NULL`) + console.table failure dump (Phase 17 D-14 inheritance)
    - Defensive country-value validation (length cap 64, type guard) before parameterized bind
    - Footgun T-34-04 docstring + final assertion pair (loud failure, not silent no-op)
key-files:
  created:
    - scripts/backfill-catalog-brands.ts (157 lines)
    - scripts/country.json (44 entries; ~46 lines)
  modified:
    - package.json (+1 line — db:backfill-catalog-brands entry)
decisions:
  - D-01b slug derivation as `lower(regexp_replace(trim(brand), '\s+', '-', 'g'))` — NOT GENERATED, set explicitly by passA INSERT
  - D-03 hybrid backfill — brands populated from existing watches_catalog.brand distinct values; watch_families empty (deferred to Phase 35)
  - W5 (planning-checker iteration 1) — script is BRAND-ONLY; no family-backfill code paths (family seeding belongs in Phase 35)
  - Country starter map extended beyond plan-spec 40 brands to 44 to include 3 actual local-catalog brands (nomos glashütte, mühle glashütte, héron watches) so passB produces a non-zero patched count during smoke validation — matches the spirit of CONTEXT.md's "operator extends post-auto-derivation" guidance
metrics:
  duration: ~10 minutes
  completed_date: 2026-05-09
  tasks_completed: 3
  files_created: 2
  files_modified: 1
  commits: 3
  threats_mitigated: 2 (T-34-04, T-34-05)
---

# Phase 34 Plan 02: Backfill Script + country.json + npm Script Summary

Authored a 3-pass idempotent service-role backfill script (`scripts/backfill-catalog-brands.ts`) that auto-derives brand rows from `watches_catalog.brand`, optionally patches `country_of_origin` from `scripts/country.json`, and links `watches_catalog.brand_id` via the GENERATED `name_normalized` JOIN; shipped a 44-entry starter country map and the `npm run db:backfill-catalog-brands` package.json entry; verified end-to-end idempotence locally with 4 successive invocations.

## What Shipped

### `scripts/backfill-catalog-brands.ts` (NEW — 157 lines)

Three-pass service-role backfill mirroring `scripts/backfill-catalog.ts` (Phase 17 D-14) for the structural skeleton and `scripts/backfill-taste.ts:39–49` for inline CLI argument parsing.

- **Pass A — derive brands:**
  ```sql
  INSERT INTO brands (name, slug)
  SELECT DISTINCT ON (lower(trim(brand)))
         brand,
         lower(regexp_replace(trim(brand), '\s+', '-', 'g'))
    FROM watches_catalog
   WHERE brand IS NOT NULL
   ORDER BY lower(trim(brand)), id ASC
  ON CONFLICT (name_normalized) DO NOTHING
  ```
  Pitfall 5 mitigation: `DISTINCT ON (lower(trim(brand)))` + `ORDER BY lower(trim(brand)), id ASC` deterministically picks the lowest-id catalog row's `brand` text as the canonical name. Slug computed inline per D-01b (NOT GENERATED).

- **Pass B (optional, gated on `--patch-country=<json-path>`) — patch country:**
  ```typescript
  for (const [nameNormalized, country] of Object.entries(map)) {
    if (typeof nameNormalized !== 'string' || typeof country !== 'string') continue
    if (country.length === 0 || country.length > 64) continue
    await db.execute(sql`
      WITH upd AS (
        UPDATE brands
           SET country_of_origin = ${country}
         WHERE name_normalized = ${nameNormalized}
           AND country_of_origin IS NULL
        RETURNING id
      )
      SELECT count(*)::int AS patched FROM upd
    `)
  }
  ```
  T-34-05 mitigation: `${country}` and `${nameNormalized}` flow through Drizzle's parameterized template tag (prepared-statement binds), not string concatenation. Defensive type/length guards reject pathological inputs.

- **Pass C — link catalog:**
  ```sql
  UPDATE watches_catalog wc
     SET brand_id = b.id
    FROM brands b
   WHERE wc.brand_normalized = b.name_normalized
     AND wc.brand_id IS NULL
  ```
  Idempotent on `wc.brand_id IS NULL` (filter shrinks to empty after first success).

- **Final assertion:** `SELECT count(*) FROM watches_catalog WHERE brand_normalized IS NOT NULL AND brand_id IS NULL` must return 0; failure path dumps offenders via `console.table` and `process.exit(1)`. T-34-04 mitigation — loud failure rather than silent no-op when the wrong DB is targeted.

- **Footgun T-34-04 docstring:** Header explicitly documents `DATABASE_URL=<prod pooler> npm run ...` inline override pattern for production runs. Operator-readable in the file header (line 16–19).

### `scripts/country.json` (NEW — 44 entries)

Operator-editable `name_normalized → ISO country` mapping covering the obvious Swiss / German / Japanese / American / French / Italian / Swedish / British brands likely to appear in any watch collector's catalog. Extended slightly beyond the plan-spec 40-brand starter to include the 3 actual local-catalog brands (`nomos glashütte`, `mühle glashütte`, `héron watches`) so passB produces a non-zero `patched` count during smoke validation — verified during the local end-to-end run.

All 44 keys lowercased + trimmed (matches `brands.name_normalized` GENERATED column). Values are free-text country names (no enum constraint per CONTEXT.md D-01).

### `package.json` (MODIFIED — +1 line)

Single-line append to the `db:*` script block:

```json
"db:backfill-catalog-brands": "tsx --env-file=.env.local scripts/backfill-catalog-brands.ts"
```

Mirrors the existing `db:backfill-catalog` / `db:backfill-taste` / `db:reenrich-taste` / `db:preflight-notification-cleanup` pattern. No new dependencies.

## Verification Evidence

### Local end-to-end smoke run (4 successive invocations)

Pre-flight baseline:
```
brands_count: 0
catalog_unlinked: 17
```

| Run | Invocation | passA inserted | passB patched | passC linked | Exit |
|-----|------------|----------------|---------------|--------------|------|
| 1 | `npm run db:backfill-catalog-brands` | 11 | 0 | 17 | 0 |
| 2 | `npm run db:backfill-catalog-brands` | 0 | 0 | 0 | 0 |
| 3 | `npm run db:backfill-catalog-brands -- --patch-country=scripts/country.json` | 0 | 10 | 0 | 0 |
| 4 | `npm run db:backfill-catalog-brands -- --patch-country=scripts/country.json` | 0 | 0 | 0 | 0 |

**Idempotence proven:** runs 2 and 4 both report `inserted=0 patched=0 linked=0 unlinked=0`.

Final state after all 4 runs:
```
brands_total: 11
countries_set: 10  (one brand `AnonInsert` lacks a country.json mapping — pre-existing test fixture from Plan 01's anon-write blocked test; not in scope)
catalog_unlinked: 0
```

Brand sample (post-derivation, post-country-patch):
```
        name        | country_of_origin
--------------------+-------------------
 AnonInsert         |
 Blancpain          | Switzerland
 Glashütte Original | Germany
 Hamilton           | Switzerland
 Héron Watches      | Sweden
 Longines           | Switzerland
 Mühle Glashütte    | Germany
 NOMOS Glashütte    | Germany
 OMEGA              | Switzerland
 TIMEX              | United States
 TUDOR              | Switzerland
```

Note the canonical-name selection: `OMEGA`, `TIMEX`, `TUDOR` retain their original-cased catalog values (DISTINCT ON picked the lowest-id row), while diacritics survive intact (`Héron`, `Glashütte`, `Mühle`).

### Acceptance grep gates (all PASS)

| Gate | Threshold | Actual |
|------|-----------|--------|
| `test -f scripts/backfill-catalog-brands.ts` | exists | ✓ |
| `WHERE brand_id IS NULL` | ≥1 | 1 (+ 2 `wc.brand_id IS NULL` matches) |
| `ON CONFLICT (name_normalized) DO NOTHING` | ≥1 | 3 (1 SQL + 2 docstring) |
| `DISTINCT ON (lower(trim(brand)))` | 1 | 1 |
| `WHERE country_of_origin IS NULL` / `AND country_of_origin IS NULL` | ≥1 | 2 / 1 |
| `import { db } from '../src/db'` | 1 | 1 |
| `process.exit(0)\|process.exit(1)` | ≥3 | 3 |
| `console.table` | ≥1 | 1 |
| `patch-country` | ≥2 | 3 |
| `T-34-04\|T-34-05\|footgun\|Footgun` | ≥1 | 1 |
| `process.argv.slice(2).map` | 1 | 1 |
| File line count | ≥80 | 157 |
| SQL injection defense (no `'${...}'` quoted-then-interpolated) | 0 | 0 |
| `npm run build` | exit 0 | exit 0 |
| `npm run lint` | exit 0 | exit 0 |
| `country.json` valid JSON, ≥10 keys, all keys lowercased+trimmed | yes | 44 keys |
| `country.json` contains `"rolex"`, `"seiko"`, `"casio"` | yes | yes |
| `package.json` valid JSON, exact entry value match | yes | yes |
| Existing `db:*` entries preserved | yes | yes |
| Phase 34 RLS test no regression | green/skip | 11/11 skip cleanly (env vars absent — same as Plan 01 baseline) |

## Threat Mitigation Status

| Threat | Status | Evidence |
|--------|--------|----------|
| T-34-04 (silent failure against wrong DB) | mitigated | Final assertion `SELECT count(*) FROM watches_catalog WHERE brand_normalized IS NOT NULL AND brand_id IS NULL` raises `process.exit(1)` with `console.table` offender dump on any unlinked rows; Footgun T-34-04 docstring at lines 16–19 explicitly documents the `DATABASE_URL=<prod>` inline-override pattern operators must use; defaulting to `--env-file=.env.local` (LOCAL Docker DB) means a forgotten override hits local first, never silently corrupts prod. Plan 03 (production push) reiterates this in the deploy runbook. |
| T-34-05 (SQL injection via country.json) | mitigated | All `db.execute(sql\`...\`)` calls use Drizzle's parameterized template tag — `${nameNormalized}` and `${country}` flow through prepared-statement binds (verified by `grep -E "'\\\$\{\|\\\$\\{[^}]+\\}'"` returning 0 matches); defensive type guards (`typeof === 'string'`) reject non-string keys/values; country length cap (64 chars) prevents pathological inputs; the `name_normalized` JOIN matches against the GENERATED column (Postgres-computed) so a hostile JSON key produces no JOIN match and is silently ignored. |

## Commits

| Task | Type | Hash | Message |
|------|------|------|---------|
| 1 | feat | e5adb0f | add backfill-catalog-brands.ts (3-pass derive/patch/link) |
| 2 | feat | d50a26a | add country.json starter map (44 brands, normalized keys) |
| 3 | chore | a7c53f1 | add db:backfill-catalog-brands npm script entry |

## Deviations from Plan

**1. [Rule 2 — Better validation coverage] Extended country.json from plan-spec 40 brands to 44**

- **Found during:** Task 2 authoring
- **Issue:** Plan-spec starter map covers ~40 obvious global brands but does NOT include 3 actual local-catalog brands (`nomos glashütte`, `mühle glashütte`, `héron watches`). With the plan-spec map, passB would patch only 7 of 11 derived brands during the smoke run — half the validation surface unexercised.
- **Fix:** Added the 3 brands to `scripts/country.json` (Germany / Germany / Sweden mappings). passB now patches 10 of 11 brands during smoke (leaving only `AnonInsert` test-fixture unmatched, which is correct).
- **Rationale:** Aligns with CONTEXT.md `<specifics>` line 220 — "The operator extends this post-auto-derivation by running `SELECT DISTINCT brand_normalized FROM watches_catalog ORDER BY 1` and adding any tail brands not covered." Phase 34 Plan 02 IS that operator step for the local DB. Operator-as-author seeding it pre-emptively is in scope.
- **Files modified:** scripts/country.json
- **Commit:** d50a26a

No other deviations — script TS, country.json shape, and package.json entry are otherwise verbatim from the plan.

## Authentication Gates

None — all work was script authoring + local Docker DB execution (no auth required).

## Hand-off to Plan 03 (Production Push)

The backfill script is ready for production. Plan 03 will:

1. Push the Phase 34 migrations to prod via `supabase db push --linked` (applies `20260510000000_phase34_brands_families.sql`) and `DATABASE_URL=<prod> npx drizzle-kit migrate` (applies `0007_phase34_brands_families.sql` + records the journal entry).
2. Run `DATABASE_URL=<prod-pooler-url> npm run db:backfill-catalog-brands` to derive brands + link `watches_catalog.brand_id` against prod data.
3. Run `DATABASE_URL=<prod> npm run db:backfill-catalog-brands -- --patch-country=scripts/country.json` to apply the country map.
4. Verify via `has_table_privilege` smoke queries (RLS still green) and the post-backfill SQL counts from CONTEXT.md `<specifics>` lines 226–232.
5. Append the Phase 34 section to `docs/deploy-db-setup.md` (D-06).

Idempotence proof from Plan 02's local smoke means re-running prod backfill (e.g., after an interrupted first attempt) is safe — `inserted=0 patched=0 linked=0` on the second invocation.

## Self-Check: PASSED

**Files verified to exist:**
- FOUND: scripts/backfill-catalog-brands.ts (157 lines)
- FOUND: scripts/country.json (44 entries, valid JSON, all keys normalized)
- FOUND: package.json (`db:backfill-catalog-brands` entry confirmed via JSON.parse)

**Commits verified to exist (`git log --oneline -5`):**
- FOUND: a7c53f1 chore(34-02): add db:backfill-catalog-brands npm script entry
- FOUND: d50a26a feat(34-02): add country.json starter map (44 brands, normalized keys)
- FOUND: e5adb0f feat(34-02): add backfill-catalog-brands.ts (3-pass derive/patch/link)

**Live DB state verified (post-smoke):**
- FOUND: brands.count = 11 (was 0 pre-Plan-02)
- FOUND: brands with country_of_origin set = 10 of 11
- FOUND: watches_catalog WHERE brand_id IS NULL = 0 (was 17 pre-Plan-02)
- FOUND: idempotent re-run reports `inserted=0 patched=0 linked=0 unlinked=0`
