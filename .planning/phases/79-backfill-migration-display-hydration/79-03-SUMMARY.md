---
phase: 79
plan: 03
subsystem: migration-tooling-family
tags: [migration, postgres, tsx-script, family-apply, aliases, mig-03, disp-03]
status: complete
completed: 2026-06-25
duration_minutes: 14
tasks_total: 3
tasks_completed: 3
files_created: 0
files_modified: 2
loc_delta:
  scripts_added: 770
  scripts_removed: 4
  tests_added: 358
  tests_removed: 31
requires:
  - 79-01-SUMMARY.md (Wave 0 RED stubs for family-build-decisions + strict-gate)
  - 79-02-SUMMARY.md (Plan 02 brand apply scaffold: BrandDecisionMap + buildBrandMap + strictPreflightGate brand-only scope + applyBrandPath)
  - .planning/v8.4-brand-merge-decisions.md (operator-edited; read in-memory per D-79-07 Option 2)
  - src/db/schema.ts watchFamilies L539-560 (aliases text[] + needs_review)
provides:
  - "scripts/v8.4-brand-canonicalization.ts NEW exports: FamilyRow, FamilyDecisionRow, ResolvedFamily, FamilyDecisionMap, FamilyDecision, buildFamilyRow, buildFamilyTableRows, parseFamilyDecisionsTable, parseCompositeKey, buildFamilyMap"
  - "scripts/v8.4-brand-canonicalization.ts NEW non-exported helpers: buildFamilyHeader, parseExistingFamilyPreserved, familyDryRun, applyFamilyPath"
  - "strictPreflightGate signature extended with familyRows + existingFamilyIdsFn (defaults preserve brand-only callsites). Adds 4 family refuse cases per D-79-01."
  - "--mode=families dry-run wired in main(): reads brand decisions in-memory (D-79-07 Option 2 — no brand --apply required), writes .planning/v8.4-family-merge-decisions.md (D-79-05 read-only invariant)."
  - "applyFamilyPath function definition (NOT WIRED into main() per spec — Plan 04 wraps applyBrandPath + applyFamilyPath + hydration + post-flight in ONE outer sql.begin per D-79-03)."
affects:
  - tests/unit/scripts/v8.4-family-build-decisions.test.ts (Plan 01 RED stub → GREEN; 5 it.todo → 5 it() greens; 6 tests / 0 todo / 0 failed)
  - tests/unit/scripts/v8.4-strict-gate.test.ts (Plan 02 brand cases unchanged; 2 family it.todo → 2 it() greens + 1 NEW combined PASS test; 9 tests / 0 todo / 0 failed)
  - No application-runtime files affected (script + test changes only)
tech-stack:
  added: []
  patterns:
    - "in-memory brand→family chain (D-79-07 Option 2) — family dry-run resolves catalog brand_raws through BrandDecisionMap to canonical brand identity BEFORE emitting family rows; Hamilton + Hamilton Watch collapse to one canonical Hamilton-bucket per (canonical_brand_id, model_normalized) tuple"
    - "canonical-brand-identity dedup keyed on UUID (not normalized name string) — merge: entries' canonicalName is the SOURCE raw, not the target canonical; dedup MUST use uuid identity"
    - "idempotent alias-append SQL: WHERE NOT (aliases @> ARRAY[$src]::text[]) is the SQL-layer T-79-04 mitigation; combined with Plan 02 idempotentReRunGate, double-apply is safe"
    - "applyFamilyPath function defined but NOT wired (Plan 04 owns the call inside the unified outer sql.begin transaction per D-79-03) — leaves a clean seam mirroring Plan 02's applyBrandPath staging"
key-files:
  modified:
    - "scripts/v8.4-brand-canonicalization.ts (873 → 1643 LOC; +770/-4)"
    - "tests/unit/scripts/v8.4-family-build-decisions.test.ts (Wave 0 RED → GREEN; 5 todo → 5 it; +166/-31)"
    - "tests/unit/scripts/v8.4-strict-gate.test.ts (2 family todo → 2 it + 1 combined PASS; +192/-7)"
decisions:
  - "D-79-05 family dry-run read-only invariant landed (no DB writes; verified by Phase 78 v8.4-readonly.test.ts still passing)"
  - "D-79-06 alias auto-append from merge decisions — applyFamilyPath Step 4.4 implements idempotent SQL with NOT(aliases @> ARRAY[$src]) containment predicate"
  - "D-79-07 in-memory brand→family chain Option 2 landed — family dry-run does NOT require brand --apply to have run first; reads brand-merge-decisions.md in-memory and uses BrandDecisionMap to dedupe family rows by canonical brand identity"
  - "D-79-09 new family rows default needs_review=false on INSERT (carryforward from D-79-09 brand-side semantics)"
metrics:
  duration_minutes: 14
  test_files_passing: 27
  tests_passing: 510
  tests_todo: 7
  tests_failing: 0
  build_exit_code: 0
---

# Phase 79 Plan 03: Family Dry-Run + applyFamilyPath Definition Summary

Extended `scripts/v8.4-brand-canonicalization.ts` from Plan 02's 873-LOC brand-apply-scaffold shape to a 1643-LOC script that lands the entire family-side surface: `FamilyDecisionMap` + `buildFamilyMap` + `parseFamilyDecisionsTable`, the `--mode=families` dry-run path that emits `.planning/v8.4-family-merge-decisions.md`, the family refuse cases in `strictPreflightGate`, and the `applyFamilyPath` function definition (Steps 4.3 + 4.4 + 4.5) ready for Plan 04 to wire into the unified outer transaction.

## What shipped

### New exports (verbatim signatures)

```typescript
// Family-side analogs of BrandRow / BrandDecisionRow / ResolvedBrand /
// BrandDecisionMap. The composite key for FamilyDecisionMap is
// `${lower(trim(brand_raw))}|${family_normalized}` per D-79-07.
export interface FamilyRow {
  brand_raw: string
  family_raw: string
  family_normalized: string
  proposed_target_id: string | null
  candidates: Candidate[]
}
export interface FamilyDecisionRow extends FamilyRow {
  status: string
}
export type ResolvedFamily =
  | { kind: 'existing'; uuid: string; canonicalName: string }
  | { kind: 'merge'; uuid: string; canonicalName: string; sourceModelRaw: string }
  | { kind: 'new'; syntheticKey: string; rawName: string; brandUuid: string }
export type FamilyDecisionMap = Map<string, ResolvedFamily>
export type FamilyDecision =
  | { kind: 'new'; brandUuid: string; name: string; compositeKey: string }
  | { kind: 'merge'; targetUuid: string; sourceModelRaw: string; compositeKey: string }

export function buildFamilyRow(row: FamilyRow, status: string): string
export function buildFamilyTableRows(rows: FamilyDecisionRow[]): string[]
export function parseFamilyDecisionsTable(content: string): FamilyDecisionRow[]
export function parseCompositeKey(key: string): { brandNorm: string; modelNorm: string }
export function buildFamilyMap(
  rows: FamilyDecisionRow[],
  brandMap: BrandDecisionMap,
): FamilyDecisionMap

// strictPreflightGate signature extended (defaults preserve brand-only callsites):
export async function strictPreflightGate(
  sql: SqlTagBrandNormalized,
  brandRows: BrandDecisionRow[],
  existingBrandIdsFn: (uuids: string[]) => Promise<Set<string>>,
  familyRows: FamilyDecisionRow[] = [],
  existingFamilyIdsFn: (uuids: string[]) => Promise<Set<string>> = async () => new Set<string>(),
): Promise<void>
```

### New non-exported helpers

- `buildFamilyHeader()`: family-side analog of `buildHeader()`; cites `--mode=families` generation and `--apply --mode=both` consumption per 79-PATTERNS L555-564.
- `parseExistingFamilyPreserved(content)`: mirror of `parseExistingPreserved` for the family file format; keyed by composite `${brand_norm}|${family_normalized}`.
- `familyDryRun(sql, brandMap, args)`: D-79-05 + D-79-07 read-only family dry-run path. 4-stage: catalog SELECT JOIN brands JOIN watch_families → canonical-brand-identity dedup via BrandDecisionMap (keyed on UUID, NOT brand_norm string — see Rule 1 deviation below) → word_similarity fuzzy candidates scoped per canonical brand_id → GFM artifact emission with refuse-to-overwrite + `--regenerate` merge-forward gate.
- `applyFamilyPath(tx, familyMap)`: 3-step apply (Steps 4.3 + 4.4 + 4.5) per RESEARCH § Code Examples L727-770. NOT WIRED into main() per spec — Plan 04 owns the call inside the unified outer `sql.begin`.

### `--mode=families` dry-run dispatch in main()

Inserted BEFORE the existing `args.apply` branch:

```typescript
if (!args.apply && args.mode === 'families') {
  if (!existsSync(OUTPUT_FILE)) {
    console.error('brand decisions file not found ...')
    process.exit(1)
  }
  const brandContent = await readFile(OUTPUT_FILE, 'utf8')
  const brandRows = parseDecisionsTable(brandContent)
  const brandMap = buildBrandMap(brandRows)
  await familyDryRun(sql, brandMap, args)
  return
}
```

The brand-side refuse-to-overwrite gate now scopes to `args.mode === 'brands'` so the family dry-run doesn't trip it. The family dry-run has its own refuse-to-overwrite gate on FAMILY_OUTPUT_FILE inside `familyDryRun`.

## Family dry-run smoke test result

Ran `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres npx tsx scripts/v8.4-brand-canonicalization.ts --mode=families --force` against local Supabase:

```
[v8.4-brand-canon] wrote /Users/tylerwaneka/Documents/horlo/.planning/v8.4-family-merge-decisions.md (164 family rows, 21 auto-resolved, 143 needs-review)
```

**Canonical brand-merge collapse verified end-to-end** (D-79-07 + the SEED-021 Hamilton/Hamilton Watch case):

```
grep -c "^| Hamilton Watch" v8.4-family-merge-decisions.md  → 0
grep -c "^| Hamilton "      v8.4-family-merge-decisions.md  → 8
```

Both `Hamilton` and `Hamilton Watch` catalog brand_raws collapse under the canonical `Hamilton` leading column (8 distinct families across the merged-brand bucket; zero rows leaked under the source brand name). The smoke-test artifact was removed after verification — Plan 03 ships the script + tests; the artifact is operator-edited and generated fresh per environment.

## Phase 78 readonly invariant regression check

Phase 78 `tests/integration/scripts/v8.4-readonly.test.ts` still passes against local DB:

```
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres npx vitest run tests/integration/scripts/v8.4-readonly.test.ts
→ 5 passed (count + max(updated_at) byte-identical pre/post on brands + watch_families + watches_catalog)
```

D-79-05 (family dry-run is read-only by construction — `familyDryRun` issues only SELECT statements) verified by inspection AND by the Phase 78 invariant continuing to hold across script execution shapes.

## Plan 01 stub green counts

| Stub file | Pre-Plan-03 | Post-Plan-03 | Notes |
|-----------|-------------|--------------|-------|
| tests/unit/scripts/v8.4-family-build-decisions.test.ts | 1 sanity + 5 it.todo | 6 pass / 0 todo / 0 failed | All D-79-07 + D-79-06 cases green |
| tests/unit/scripts/v8.4-strict-gate.test.ts | 6 brand-pass + 2 family-todo + 1 sanity | 9 pass / 0 todo / 0 failed | 2 family refuse cases green + 1 NEW combined PASS test |
| tests/unit/scripts/v8.4-post-deploy-template.test.ts | 1 sanity + 7 it.todo | unchanged (1 pass / 7 todo) | Plan 04 greens |
| tests/integration/scripts/v8.4-apply-atomic.test.ts | 1 sanity + 10 it.todo | unchanged | Plan 04 greens |
| tests/integration/scripts/v8.4-apply-idempotent.test.ts | 1 sanity + 3 it.todo | unchanged | Plan 04 greens |

Full Phase 78 + Phase 79 sweep (tests/unit/scripts/ + DATABASE_URL-gated integration):

```
 Test Files  7 passed | 1 skipped (8)
      Tests  43 passed | 5 skipped | 7 todo (55)
   Duration  ~1.54s
```

Plus the readonly integration test against local DB: `5 passed (5)`.

`npm run build` exits 0.

## Forward armor verifications

| Verification | Pre-Plan-03 | Post-Plan-03 |
|--------------|-------------|--------------|
| `grep -c "= ANY("` in scripts/v8.4-brand-canonicalization.ts | 0 | **0** (see Rule 1 deviation #2 — comment rephrase) |
| `grep -c "applyFamilyPath\|aliases = aliases \|\| ARRAY"` | 0 | **8** (1 function defn + 1 alias-append SQL + 6 comment/JSDoc refs) |
| `grep -c "FAMILY_OUTPUT_FILE\|familyDryRun"` | 0 | **15** (constant + function defn + dispatch + JSDoc) |
| `process.exit` calls inside sql.begin callbacks | 0 | **0** ✓ Pitfall 2 satisfied |
| `npm run build` exit code | 0 | **0** ✓ |

## Deviations from spec

### [Rule 1 - bug] Family dry-run dedup keyed by canonical UUID not brand_norm string

**Found during:** Task 2 local smoke test (`--mode=families` initial run).

**Issue:** The plan spec said canonical-brand dedup uses `lower(trim(canonicalName))` as the key. But the BrandDecisionMap's 'merge' entries store `canonicalName: row.brand_raw` (the SOURCE raw, not the target canonical — there's no target-canonical name field available at parse time). With that key, `Hamilton Watch` (merge:HAMILTON_UUID) dedup'd to `'hamilton watch|<model>'` and `Hamilton` (auto-resolved) dedup'd to `'hamilton|<model>'` — **no collapse**. The first smoke run produced 164 family rows including `| Hamilton Watch | American Classic Intra-Matic Auto |` and `| Hamilton | Khaki Aviation Pilot Day Date Auto |` as separate buckets.

**Fix:** Switched canonical-brand-identity dedup to use the UUID identity (real UUID for 'existing'/'merge', `synthetic:${brandNorm}` for 'new'). Built a separate `canonicalNameByUuid: Map<uuid, canonicalName>` populated from 'existing' entries only — that map provides the canonical display string for the artifact's leading column. After fix: 0 `Hamilton Watch` rows + 8 `Hamilton` rows under canonical leading column.

**Files modified:** scripts/v8.4-brand-canonicalization.ts familyDryRun Stage 2.

**Commit:** Task 2 commit `21b3a753`.

### [Rule 1 - comment] Removed `= ANY(${arr})` literal from JSDoc comment

**Found during:** Task 3 forward-armor verification.

**Issue:** The `applyFamilyPath` JSDoc header included an educational reference to the forbidden pattern verbatim (`NO \`= ANY(${arr})\` ANYWHERE per ...`). The literal `= ANY(` substring set off the forward-armor grep audit at count=1 (vs required 0). Same regression as Plan 02 Rule 1 - comment deviation.

**Fix:** Rephrased the comment to `NO array-spread anti-pattern flagged by [[drizzle-sql-any-array-pitfall]] anywhere`. Semantic intent preserved; `grep -c "= ANY("` now returns 0.

**Files modified:** scripts/v8.4-brand-canonicalization.ts (within applyFamilyPath JSDoc).

**Commit:** Task 3 commit `66820328`.

## Authentication / human-action gates

None. Pure script + test changes; no auth surfaces touched.

## Known stubs / known limitations

- **applyFamilyPath is NOT wired into main()** per spec — Plan 04 wraps applyBrandPath + applyFamilyPath + hydration (Step 4.6) + post-flight assertion (Step 4.7) inside ONE outer `sql.begin` per D-79-03. The seam is clearly marked: applyFamilyPath ships with full 3-step shape + invariant + JSDoc citations, ready for Plan 04 to call.
- **The Plan 02 brand-only `sql.begin` wrapper at L1540 is still TRANSIENT.** Plan 04 RESTRUCTURES it to wrap brand + family + alias + hydration + post-flight in ONE outer transaction. Plan 03 did not touch this seam.
- **Plan 02 family-side error in main()** at L1115-1121 (`if (args.mode === 'families' || args.mode === 'both') throw new Error('Plan 03/04')`) still fires for the `--apply --mode=both` apply path. Plan 03 left this in place — Plan 04's job is to delete the throw and wire the families/both apply branch.
- **Plan 01 integration stub for `v8.4-apply-atomic.test.ts`** (10 it.todo) — Plan 04 greens these against the full atomic transaction; Plan 03 does not.
- **The Brut Date → Brut Datejust alias-append integration check** stays `it.todo` for Plan 04 + Plan 05 (local seed lacks Brut Date per Pitfall 8; fixture-only coverage lands in Plan 03's `v8.4-family-build-decisions.test.ts` D-79-06 + MIG-03 case which IS green).

## Threat surface scan

No new network endpoints, auth paths, or schema changes introduced. All threats are covered by the existing 79-03-PLAN `<threat_model>` block:

- **T-79-03 (Tampering — strict gate refuse cases)**: mitigated by family-side strictPreflightGate extension (4 family refuse cases land Task 2; 2 family-merge-not-found + family-triple-drift cases are tested green in v8.4-strict-gate.test.ts).
- **T-79-04 (Integrity — alias-append non-idempotency on rerun)**: mitigated by `NOT (aliases @> ARRAY[$src])` SQL-layer idempotency gate (applyFamilyPath Step 4.4). Combined with Plan 02 idempotentReRunGate, double-apply is safe even if the outer gate fails.
- **T-79-01 (Integrity — atomic transaction)**: mitigated by `throw`-only inside applyFamilyPath (Plan 04 wraps in sql.begin → automatic ROLLBACK on any failure; no `process.exit` per Pitfall 2).
- **T-INJ-01 (SQL injection)**: all template-literal interpolations bind as postgres-lib parameters; family_raw / merge UUIDs never concatenate into raw SQL.

## Threat Flags

None — Plan 03 introduces no new security-relevant surface beyond what's already in `<threat_model>`.

## Self-Check: PASSED

**Created files exist:**

```
FOUND: scripts/v8.4-brand-canonicalization.ts (modified, 1643 LOC)
FOUND: tests/unit/scripts/v8.4-family-build-decisions.test.ts (modified, GREEN)
FOUND: tests/unit/scripts/v8.4-strict-gate.test.ts (modified, GREEN)
```

**Commits exist:**

```
FOUND: 4c7a7f4b (Task 1)
FOUND: 21b3a753 (Task 2)
FOUND: 66820328 (Task 3)
```

**Test suite status:** 7 unit-script files / 43 passed / 7 todo / 0 failed; 1 integration-script file / 5 passed (DATABASE_URL gated).
**Build status:** `npm run build` exit 0.
**Forward armor:** 0 `= ANY(` patterns; 0 `process.exit` inside sql.begin callbacks; applyFamilyPath function defined with 3-step shape + Pitfall 3 invariant + idempotent alias-append SQL pattern.
