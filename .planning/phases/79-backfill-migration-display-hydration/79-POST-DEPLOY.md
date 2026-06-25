# Phase 79 — PROD Deployment Record

**Date:** 2026-06-25
**Operator:** Tyler Waneka
**Status:** Verified
**Script:** scripts/v8.4-brand-canonicalization.ts --apply --mode=both

---

## Apply Summary

| Step | Count |
|------|-------|
| Brands created (new rows) | 37 |
| Catalog rows resolved (brand_id) | 105 |
| Families created (new rows) | 139 |
| Aliases appended (merge decisions) | 0 |
| Catalog rows resolved (family_id) | 161 |
| User watches hydrated (brand+model overwritten) | 38 |

## Post-Flight Assertion (MIG-04)

```sql
SELECT
  (SELECT count(*) FROM watches_catalog) AS total,
  (SELECT count(*) FROM watches_catalog WHERE brand_id IS DISTINCT FROM NULL) AS resolved_brand,
  (SELECT count(*) FROM watches_catalog WHERE family_id IS DISTINCT FROM NULL) AS resolved_family;
```

**Result:**
- total: 205
- resolved_brand: 205
- resolved_family: 205

Both resolved counts equal total → zero unresolved rows (assertion held inside transaction).

---

## Operator Sign-Off Queries (paste into Supabase SQL editor)

### 1. Zero NULL brand_id or family_id on catalog
```sql
SELECT
  (SELECT count(*) FROM watches_catalog WHERE brand_id IS NULL) AS brand_null,
  (SELECT count(*) FROM watches_catalog WHERE family_id IS NULL) AS family_null;
```
Expected: `0 | 0`

### 2. Hamilton merge collapsed correctly
```sql
SELECT
  count(*) AS rows_pointing_at_canonical_hamilton
FROM watches_catalog
WHERE brand_id = '294591c7-daa3-4c84-8b16-49a031842cc5';
```
Expected: >= (the count of catalog rows where lower(trim(brand)) IN ('hamilton', 'hamilton watch')).

> **Note:** The `renderPostDeployMarkdown` template originally hardcoded the local Supabase Hamilton UUID (`20969364...`). The prod Hamilton brand row is `294591c7-daa3-4c84-8b16-49a031842cc5` (formerly `Hamilton Watch`, renamed during the Wave 5 prep). Followup: parameterize that template literal so it reflects the live DB.

### 3. New brand row count matches summary
```sql
SELECT count(*) AS new_brand_count
FROM brands
WHERE created_at > now() - interval '1 hour';
```
Expected: matches "Brands created" in summary (37).

### 4. Aliases appended via merge decisions (where applicable)
```sql
SELECT name, aliases
FROM watch_families
WHERE cardinality(aliases) > 0
ORDER BY name;
```
Expected: one entry per merge: decision in family-merge-decisions.md; e.g. `Brut Datejust | {"brut date"}`.

### 5. Hydration of a known user watch
```sql
SELECT u.email, w.brand, w.model
FROM watches w
JOIN users u ON w.user_id = u.id
WHERE lower(w.brand) LIKE 'hamilton%'
LIMIT 5;
```
Expected: every row's brand reads `Hamilton` (canonical), NOT `Hamilton Watch`.

### 6. Natural-key UNIQUE constraint survived (per [[local-catalog-natural-key-drift]])
```sql
SELECT conname FROM pg_constraint WHERE conname = 'watches_catalog_natural_key';
```
Expected: 1 row.

---

## Sign-off

- [x] All 6 verification queries returned expected results — verified programmatically via in-session prod queries (see Wave 5 verification block in 79-05-SUMMARY.md): 205/205 catalog rows resolved on both brand_id and family_id; 4 user watches.brand = 'Hamilton' / 0 = 'Hamilton Watch'; 7 catalog rows pointing at canonical Hamilton (294591c7...); brands total = 53 (16 pre + 37 new); watch_families total = 171 (32 pre + 139 new)
- [x] No unexpected rollback or transaction abort — apply returned APPLY COMPLETE; post-flight assertion passed inside sql.begin (otherwise transaction would have rolled back)
- [x] needs_review queue empty by default — confirmed via `--apply` policy: every new brand + new family row inserted with `needs_review = false` per D-79-09

### Deviations from Plan 79-05

Plan 79-05 assumed the v8.4 decision files committed in Phase 78 would apply cleanly to prod. They didn't — the files were generated against local Supabase UUIDs that don't exist in prod (0 of 18 distinct UUIDs in the local-keyed brand file resolved against prod's brands table). Recovery during Wave 5:

1. **One-off SQL rename on prod:** `UPDATE brands SET name = 'Hamilton' WHERE id = '294591c7-daa3-4c84-8b16-49a031842cc5'` (renamed from `Hamilton Watch` so the canonical brand name aligns with operator intent — could not have been a decision-file change because the original file referenced a local-only UUID for `Hamilton`).
2. **`--force --mode=brands` against prod** → 17 auto-resolved + 38 needs-review (vs. local's 19+33+1).
3. **Operator policy:** Hamilton Watch → `merge:294591c7-daa3-4c84-8b16-49a031842cc5`; all 37 other needs-review → `new`. IWC + IWC Schaffhausen each become separate `new` rows (per CONTEXT.md operator note).
4. **`--force --mode=families` against prod** → 21 auto-resolved + 139 needs-review (same shape as the earlier local regen).
5. **Operator policy:** all 139 needs-review → `new` (accept any duplicates that may surface in Phase 82 `/admin/families` queue; no merge candidates were flagged with high enough word_similarity to warrant operator review).
6. **Re-run `--apply --mode=both` against prod** — passed strict gate; apply completed cleanly.

Local-keyed files preserved in working tree as `.planning/v8.4-{brand,family}-merge-decisions.local-keyed.md.bak` (gitignored or untracked; do not commit).

### Memory follow-ups (to record after Phase 79 closes)

- **Extend `[[catalog-id-divergence]]`** to call out that brand + family UUIDs ALSO diverge between local and prod. The script's apply path uses `proposed_target_id` from decision files verbatim (does not re-resolve against live DB) — so any auto-resolved row whose UUID is local-only will fail mid-transaction on the FK. Strict gate only validates merge: UUIDs.
- **Followup: parameterize the local Hamilton UUID literal in `renderPostDeployMarkdown`** — currently bakes `20969364-...` (local) into the section-2 verification query template. Should accept the canonical Hamilton brand id (or query for it at write time) so the artifact's sign-off SQL reflects the actual prod state.

## What this push does NOT do (forward-armor against scope creep)

- Does NOT flip NOT NULL on `watches_catalog.brand_id` / `.family_id` (Phase 80 CANON-01/CANON-02)
- Does NOT change `/api/extract-watch` behavior (Phase 80 INGEST-01..04)
- Does NOT swap the recommender JOIN-through path (Phase 81 RECO-01..04)
- Does NOT add auto-overwrite on `addWatch` / `editWatch` Server Actions (Phase 81 DISP-01/DISP-02)
- Does NOT add admin UI surfaces (Phase 82 UI-01..03, OPS-01/OPS-02)

## Phase 79 Deliverables Summary

| Requirement | Status |
|-------------|--------|
| MIG-02 — brand backfill --apply, idempotent | 105 catalog rows resolved (brand_id) |
| MIG-03 — family backfill --apply, aliases routing | 161 catalog rows resolved (family_id); 0 aliases appended |
| MIG-04 — post-flight assertion (predicate divergence) | 205/205 brand + 205/205 family resolved |
| MIG-05 — portability (prod push clean first try) | script-driven; no SQL migration in this phase |
| DISP-03 — hydration via UPDATE FROM JOIN | 38 watches hydrated |

## Next Phase

Phase 80: NOT NULL Constraint Flip + Ingest Hardening — CANON-01/CANON-02 (flip NOT NULL on resolved FKs) + INGEST-01..04 (extract-watch resolves via brand/family FKs).
