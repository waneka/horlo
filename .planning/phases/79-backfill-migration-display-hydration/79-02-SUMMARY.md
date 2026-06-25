---
phase: 79
plan: 02
subsystem: migration-tooling
tags: [migration, postgres, tsx-script, brand-apply, sql-begin, mig-02]
status: complete
completed: 2026-06-25
duration_minutes: 10
tasks_total: 3
tasks_completed: 3
files_created: 0
files_modified: 2
loc_delta:
  scripts_added: 528
  scripts_removed: 16
  tests_added: 132
  tests_removed: 14
requires:
  - 79-01-SUMMARY.md (Wave 0 RED stubs landed; host-detect + strict-gate tests ready to green)
  - .planning/v8.4-brand-merge-decisions.md (operator-edited 2026-06-25; 53 rows)
  - Phase 78 PLAN 02/03 deliverables (parseArgs / parseExistingPreserved / mergeForward reused)
provides:
  - scripts/v8.4-brand-canonicalization.ts: NEW exports (isLocalDatabaseUrl, slugify, ApplySummary, ResolvedBrand, BrandDecisionMap, BrandDecisionRow, parseDecisionsTable, buildBrandMap, strictPreflightGate); NEW non-exported helpers (confirmIfProd, idempotentReRunGate, applyBrandPath)
  - main() apply dispatch on args.apply + args.mode (Plan 02 lands --mode=brands; --mode=families and --mode=both throw "implemented in Plan 03/04" diagnostic)
  - Brand-only apply scaffold inside its OWN sql.begin (TRANSIENT — Plan 04 restructures into ONE outer sql.begin wrapping brand + family + alias + hydration + post-flight per D-79-03)
affects:
  - tests/unit/scripts/v8.4-host-detect.test.ts (7 it.todo → 7 it() greens; 8 tests pass / 0 todo / 0 failed)
  - tests/unit/scripts/v8.4-strict-gate.test.ts (6 brand it.todo → 6 it() greens; 8 tests / 2 todo for Plan 03 family cases / 0 failed)
  - No application-runtime files affected (script-only changes)
tech-stack:
  added:
    - node:readline/promises (Node built-in; interactive 'yes' prod confirmation per D-79-02)
  patterns:
    - sql.begin transactional atomicity (1st extension of project's only existing caller at scripts/repair-drizzle-journal.ts L172-179)
    - in-memory BrandDecisionMap reify pattern (Step 4.1 INSERT RETURNING → patch map → Step 4.2 UPDATE)
    - postgres-lib IN-list parameter binding via sql(uuids) helper form (NOT array-spread per [[drizzle-sql-any-array-pitfall]] forward armor)
    - dependency injection for DB existence check (existingBrandIdsFn) so strictPreflightGate unit tests stay fixture-only
key-files:
  modified:
    - scripts/v8.4-brand-canonicalization.ts (345 → 873 LOC; +528/-16)
    - tests/unit/scripts/v8.4-host-detect.test.ts (Wave 0 RED stub → GREEN; 7 todo → 7 it; +44/-7)
    - tests/unit/scripts/v8.4-strict-gate.test.ts (Wave 0 RED stub → GREEN brand cases; 6 todo → 6 it; +88/-7)
decisions:
  - D-79-01 strict pre-flight gate brand-only scope landed; family cases (d-family, f) stay it.todo for Plan 03
  - D-79-02 host-detect with fail-closed semantics on unparseable / alt-port / empty (safety bias)
  - D-79-04 idempotent re-run gate fires BEFORE strict gate (cheaper exit on no-op re-run)
  - D-79-07 in-memory BrandDecisionMap shape locked (ResolvedBrand discriminated union)
  - D-79-09 new brand INSERTs hardcoded needs_review=false (operator marking 'new' IS the approval signal)
metrics:
  duration_minutes: 10
  test_files_passing: 27
  tests_passing: 507
  tests_todo: 14
  tests_failing: 0
  build_exit_code: 0
---

# Phase 79 Plan 02: Brand Apply Scaffold + Host-Detect + Strict Gate Summary

Extended `scripts/v8.4-brand-canonicalization.ts` from Phase 78's dry-run-only shape (345 LOC) to a 873-LOC script that lands the brand-only apply scaffold: idempotent re-run gate, strict pre-flight gate, in-memory BrandDecisionMap, interactive prod confirmation, and the brand-only INSERT/UPDATE path inside a `sql.begin` callback. Plans 03 + 04 extend with family + hydration + post-flight steps.

## What landed

### New exports (verbatim signatures)

```typescript
// Apply-path helpers (Plan 02 brand-only scope)
export interface ParsedArgs {
  regenerate: boolean
  force: boolean
  apply: boolean
  mode: 'brands' | 'families' | 'both'
}
export function parseArgs(argv?: string[]): ParsedArgs
export function isLocalDatabaseUrl(connStr: string): boolean
export function slugify(name: string): string
export interface ApplySummary {
  brandsToCreate: number
  catalogRowsToResolve: number
  familiesToCreate: number
  userWatchesToHydrate: number
  aliasesToAppend: number
}
export type ResolvedBrand =
  | { kind: 'existing'; uuid: string; canonicalName: string }
  | { kind: 'merge'; uuid: string; canonicalName: string }
  | { kind: 'new'; syntheticKey: string; rawName: string }
export type BrandDecisionMap = Map<string, ResolvedBrand>
export interface BrandDecisionRow {
  brand_raw: string
  brand_normalized: string
  proposed_target_id: string | null
  status: string
}
export function parseDecisionsTable(content: string): BrandDecisionRow[]
export function buildBrandMap(rows: BrandDecisionRow[]): BrandDecisionMap
export async function strictPreflightGate(
  sql: SqlTagBrandNormalized,
  brandRows: BrandDecisionRow[],
  existingBrandIdsFn: (uuids: string[]) => Promise<Set<string>>,
): Promise<void>
```

### New non-exported helpers

- `confirmIfProd(connStr, summary): Promise<void>` — silent on local; prints summary + reads 'yes' via `node:readline/promises` on prod; `process.exit(1)` on decline (OUTSIDE any sql.begin per Pitfall 2)
- `idempotentReRunGate(sql): Promise<'already-applied' | 'proceed'>` — queries `count(*) FROM watches_catalog WHERE brand_id IS NULL OR family_id IS NULL`; logs "Already applied" and returns 'already-applied' on no-op re-run
- `applyBrandPath(tx, brandMap): Promise<{ brandsCreated, catalogRowsResolvedBrand }>` — Step 4.1 INSERT new brands RETURNING id + reify map, Pitfall 3 invariant check, Step 4.2 per-row UPDATE catalog brand_id with re-run-safety predicate

### main() apply dispatch

`main()` now dispatches on `args.apply`:
- `args.apply === false` → Phase 78 dry-run path runs unchanged (full backward compat)
- `args.apply === true`:
  1. Early pre-DB validation: `--apply` requires `--mode=both` (Pitfall 7); otherwise exit 1 with clear diagnostic
  2. Connect + set search_path (R-FIND-02 cross-env portability — inherited unchanged)
  3. **D-79-04 idempotent re-run gate** fires FIRST (cheaper exit on no-op)
  4. Read + parse `.planning/v8.4-brand-merge-decisions.md`
  5. **D-79-01 strict pre-flight gate** (brand-only scope): refuses on needs-review / unknown status / merge:<uuid> target missing / live catalog brand absent from decisions
  6. Build BrandDecisionMap from parsed rows
  7. `--mode=families` and `--mode=both` throw clear "implemented in Plan 03/04" — `--mode=brands` proceeds
  8. **D-79-02 interactive prod confirmation** (silent on local; reads 'yes' from stdin on prod)
  9. Open `sql.begin(async tx => applyBrandPath(tx, brandMap))` — Plan 04 will RESTRUCTURE this into ONE outer sql.begin wrapping brand + family + alias + hydration + post-flight per D-79-03
  10. Print apply summary and return

## Phase 78 dry-run regression check

Local smoke ran `npm run db:v8.4-brand-canon -- --force` against `127.0.0.1:54322`:

```
[v8.4-brand-canon] wrote /Users/tylerwaneka/Documents/horlo/.planning/v8.4-brand-merge-decisions.md
  (55 brand rows, 17 auto-resolved, 38 needs-review)
```

Backward-compat confirmed. (The 55 vs 53 delta in the operator-edited file is the Brand-54 placeholder + 1 other local-only row; the operator's file was restored from backup immediately after smoke.)

## Plan 01 stub green counts

| Stub file | Pre-Plan-02 | Post-Plan-02 | Notes |
|-----------|-------------|--------------|-------|
| tests/unit/scripts/v8.4-host-detect.test.ts | 1 sanity + 7 it.todo | 8 pass / 0 todo / 0 failed | All 7 D-79-02 cases green |
| tests/unit/scripts/v8.4-strict-gate.test.ts | 1 sanity + 6 it.todo | 6 pass + 2 todo (family) | Brand cases green; family cases (d-family, f) stay todo for Plan 03 |
| tests/unit/scripts/v8.4-family-build-decisions.test.ts | 1 sanity + 5 it.todo | unchanged (1 pass / 5 todo) | Plan 03 greens |
| tests/unit/scripts/v8.4-post-deploy-template.test.ts | 1 sanity + 7 it.todo | unchanged (1 pass / 7 todo) | Plan 04 greens |
| tests/integration/scripts/v8.4-apply-atomic.test.ts | 1 sanity + ~5 it.todo | unchanged | Plan 04 greens (full transaction integration) |
| tests/integration/scripts/v8.4-mig-04-postflight.test.ts | 1 sanity + ~3 it.todo | unchanged | Plan 04 greens |

Full sweep: **27 test files / 507 pass / 14 todo / 0 failed** (tests/unit/scripts + tests/static).

## Forward armor verifications

| Verification | Pre-Plan-02 | Post-Plan-02 |
|--------------|-------------|--------------|
| `grep -c "= ANY("` in scripts/v8.4-brand-canonicalization.ts | 0 | **0** ✓ |
| `grep -c "sql\.begin("` (actual calls, not comments) | 0 | **1** (Plan 02 brand-only; Plan 04 restructures) |
| `process.exit` calls inside sql.begin callbacks | 0 | **0** ✓ Pitfall 2 satisfied |
| `process.exit` calls total (excluding comments) | 4 | **5** (added one for `--apply requires --mode=both` Pitfall 7) |
| `npm run build` exit code | 0 | **0** ✓ |

## Deviations from spec

### [Rule 1 - regex] Verify grep regex strictness on `export function`

**Found during:** Task 2 done-criteria verification.
**Issue:** Plan 02 done-criteria asserted `grep -c "export function buildBrandMap\|export function strictPreflightGate\|export function parseDecisionsTable"` returns 3. Actual count: 2. `strictPreflightGate` is declared `export async function strictPreflightGate(...)` — the literal grep pattern doesn't match `export async function`. The function IS exported (verified via the test's import); the regex is too narrow.
**Fix:** Extended grep regex used for verification: `grep -c "export \(async \)*function buildBrandMap\|export \(async \)*function strictPreflightGate\|export \(async \)*function parseDecisionsTable"` returns 3. The substantive intent — three new exported helpers — is met.
**Files modified:** none (regex-vs-intent gap in plan spec; code is correct).
**Commit:** Task 2 commit `e10fbbb0`.

### [Rule 1 - typing] applyBrandPath Step 4.2 type narrowing

**Found during:** Task 3 build verification.
**Issue:** `npm run build` failed in `applyBrandPath` Step 4.2: TypeScript's flow analysis can't carry the "post-invariant" narrowing across a for-of loop. The Step 4.1 invariant throws if any `kind='new'` remains, but the type system doesn't propagate that — the iterator variable is typed `ResolvedBrand` (full union) and `resolved.uuid` errors with "Property 'uuid' does not exist on type '{ kind: "new"; ... }'".
**Fix:** Added an explicit runtime guard inside the loop (`if (resolved.kind === 'new') throw new Error(...)`) which gives TypeScript the flow-narrowing signal AND adds defensive runtime detection if the invariant ever drifts. Also separated the `resolvedUuid` extraction so the template literals interpolate a single narrow `string`.
**Files modified:** scripts/v8.4-brand-canonicalization.ts (within applyBrandPath Step 4.2).
**Commit:** Task 3 commit `1120fafd`.

### [Rule 1 - typing] postgres-lib UpdateResult cast for .count access

**Found during:** Task 3 build verification.
**Issue:** The `SqlTagBrandInsert` type returns `Promise<Array<{id:string}>>` to support the INSERT...RETURNING id path. But the Step 4.2 UPDATE result also has a runtime `.count` property (rows affected) that isn't on the typed return shape, causing `result.count` to fail TypeScript.
**Fix:** Added a small `interface UpdateResult { count: number }` and cast the UPDATE result via `(await tx`...`) as unknown as UpdateResult`. Runtime semantics unchanged.
**Files modified:** scripts/v8.4-brand-canonicalization.ts (above applyBrandPath).
**Commit:** Task 3 commit `1120fafd`.

### [Rule 1 - comment] Removed `= ANY(${arr})` literal from comment

**Found during:** Task 2 forward-armor verification.
**Issue:** A JSDoc comment in `strictPreflightGate` documented the forbidden pattern verbatim (`...NOT \`= ANY(${arr})\``) for educational reference. The literal `= ANY(` substring would set off any future grep-based audit alarm even though it's in prose.
**Fix:** Rephrased the comment to refer to "the array-spread anti-pattern flagged by `[[drizzle-sql-any-array-pitfall]]`" without using the literal pattern. Semantic intent preserved; `grep -c "= ANY("` now returns 0.
**Files modified:** scripts/v8.4-brand-canonicalization.ts.
**Commit:** Task 2 commit `e10fbbb0`.

## Authentication / human-action gates

None. All work was script + test changes; no auth surfaces touched.

## Known stubs / known limitations

- **Family cases of strict gate are still it.todo** (case d-family, case f) — Plan 03 greens these.
- **Integration tests (`v8.4-apply-atomic.test.ts`, `v8.4-mig-04-postflight.test.ts`) remain it.todo** — Plan 04 wires the full outer-transaction integration; greening fragments per plan would require integration-test forks (over-engineering).
- **The Plan 02 `sql.begin` wrapper is TRANSIENT.** Plan 04 will RESTRUCTURE this into ONE outer sql.begin wrapping brand + family + alias + hydration + post-flight per D-79-03. The seam is clearly marked in the code comment.

## Threat surface scan

No new network endpoints, auth paths, or schema changes introduced. All threats are covered by the existing 79-02-PLAN `<threat_model>` block:
- T-79-02 (Tampering / Confused Deputy) — mitigated by `isLocalDatabaseUrl` + `confirmIfProd`
- T-79-03 (Tampering — drift) — mitigated by `strictPreflightGate`
- T-79-04 (Integrity — re-run safety) — mitigated by `idempotentReRunGate` + UPDATE re-run predicate
- T-INJ-01 (SQL injection) — all interpolations are postgres-lib parameter bindings; `sql(uuids)` for the lone IN-list

## Self-Check: PASSED

- **File exists check:** `[ -f scripts/v8.4-brand-canonicalization.ts ]` → FOUND; `[ -f tests/unit/scripts/v8.4-host-detect.test.ts ]` → FOUND; `[ -f tests/unit/scripts/v8.4-strict-gate.test.ts ]` → FOUND.
- **Commit hash check:** `501d19db` (Task 1) FOUND; `e10fbbb0` (Task 2) FOUND; `1120fafd` (Task 3) FOUND in `git log --oneline --all`.
- **Test suite status:** 27 test files / 507 pass / 14 todo / 0 failed.
- **Build status:** `npm run build` exit 0.
- **Forward armor:** 0 `= ANY(` patterns; 0 `process.exit` inside sql.begin callbacks; 1 actual `sql.begin(` call (≥1 ✓); 5 total `process.exit` outside comments (=5 ✓).
