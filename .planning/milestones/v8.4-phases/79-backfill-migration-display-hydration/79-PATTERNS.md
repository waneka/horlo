# Phase 79: Backfill Migration + Display Hydration - Pattern Map

**Mapped:** 2026-06-25
**Files analyzed:** 7 (1 EDIT + 6 NEW)
**Analogs found:** 7 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `scripts/v8.4-brand-canonicalization.ts` (EDIT) | migration script (tsx) | batch transform + DB write | `scripts/v8.4-brand-canonicalization.ts` (itself, Phase 78 dry-run) + `scripts/repair-drizzle-journal.ts` (transaction idiom) | exact (self-extension) |
| `tests/unit/scripts/v8.4-family-build-decisions.test.ts` (NEW) | unit test | pure function — fixture in/out | `tests/unit/scripts/v8.4-seed021-golden.test.ts` | exact |
| `tests/unit/scripts/v8.4-strict-gate.test.ts` (NEW) | unit test | pure function — fixture in/out | `tests/unit/scripts/v8.4-regenerate-merge.test.ts` | exact |
| `tests/unit/scripts/v8.4-host-detect.test.ts` (NEW) | unit test | pure function — string in/bool out | `tests/unit/scripts/v8.4-md-artifact-schema.test.ts` | role-match |
| `tests/unit/scripts/v8.4-post-deploy-template.test.ts` (NEW) | unit test | pure function — template snapshot | `tests/unit/scripts/v8.4-md-artifact-schema.test.ts` | role-match |
| `tests/integration/scripts/v8.4-apply-atomic.test.ts` (NEW) | integration test | spawn script → assert DB state | `tests/integration/scripts/v8.4-readonly.test.ts` | exact (inverse — asserts WRITES happened, not absence of writes) |
| `tests/integration/scripts/v8.4-apply-idempotent.test.ts` (NEW) | integration test | spawn script twice → assert second is no-op | `tests/integration/scripts/v8.4-brand-canonicalization.test.ts` | role-match |
| `.planning/phases/79-backfill-migration-display-hydration/79-POST-DEPLOY.md` (GENERATED) | operator audit artifact | template emission | `.planning/phases/78-schema-additions-operator-resolve-queue/78-POST-DEPLOY.md` | exact |
| `.planning/v8.4-family-merge-decisions.md` (GENERATED) | operator decision artifact | GFM table emission | `.planning/v8.4-brand-merge-decisions.md` | exact |

---

## Pattern Assignments

### `scripts/v8.4-brand-canonicalization.ts` (EDIT — extend in place per D-79-05)

**Primary analog:** Itself — Phase 78's 345-LOC dry-run script. All Phase 79 new code attaches to existing hooks.

**Imports pattern** (existing — `scripts/v8.4-brand-canonicalization.ts` L58-61) — REUSE unchanged, ADD readline:
```typescript
import { existsSync } from 'node:fs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import * as path from 'node:path'
import postgres from 'postgres'
// Phase 79 additions:
import * as readline from 'node:readline/promises'  // interactive prod prompt (D-79-02)
// No `node:url` import — `new URL(...)` is a Node global, no import needed.
```

**`parseArgs` extension pattern** (existing — `scripts/v8.4-brand-canonicalization.ts` L86-97) — EXTEND the `ParsedArgs` interface and the parser shape; add `apply: boolean` and `mode: 'brands' | 'families' | 'both'`:
```typescript
// EXISTING shape (preserve backward compatibility):
export interface ParsedArgs {
  regenerate: boolean
  force: boolean
}

export function parseArgs(argv: string[] = process.argv.slice(2)): ParsedArgs {
  const flags = new Set(argv.map((a) => a.replace(/^--/, '')))
  return {
    regenerate: flags.has('regenerate'),
    force: flags.has('force'),
  }
}
// PHASE 79 EXTENSION: add `apply` (boolean) + `mode` (literal union). Default
// mode='brands' preserves Phase 78's npm script entry point unchanged.
// Per Pitfall 7: also enforce `apply && mode !== 'both'` rejection in main().
```

**Connection bootstrap + `search_path` pin pattern** (existing — `scripts/v8.4-brand-canonicalization.ts` L239-258) — REUSE unchanged. Phase 79's family dry-run + apply both run against this same connection; the SET search_path line MUST be preserved (R-FIND-02 / [[supabase-extension-schema-function-pin]]):
```typescript
const connStr = process.env.DATABASE_URL
if (!connStr) {
  console.error('[v8.4-brand-canon] ERROR: DATABASE_URL is not set.\n' + ...)
  process.exit(1)
}
const sql = postgres(connStr, { max: 1, prepare: false })

try {
  // R-FIND-02: prod=extensions, local=public for pg_trgm. Without this SET,
  // word_similarity in family dry-run fails with 42883 on the env where
  // pg_trgm is not in default search_path.
  await sql.unsafe(`SET search_path = public, extensions, pg_catalog`)
  // ...
} finally {
  await sql.end()
}
```

**Atomic transaction pattern** (analog — `scripts/repair-drizzle-journal.ts` L172-179, the ONLY existing `sql.begin(async tx => ...)` caller):
```typescript
// FROM scripts/repair-drizzle-journal.ts:172-179 — verbatim shape Phase 79
// inherits. Throwing inside the callback triggers ROLLBACK; resolution = COMMIT.
await sql.begin(async (tx) => {
  for (const m of missing) {
    await tx.unsafe(`INSERT INTO "${SCHEMA}"."${TABLE}" ("hash","created_at") VALUES ($1,$2)`, [
      m.hash,
      m.when,
    ])
  }
})
```

**Anti-pattern comparison** (analog — `scripts/factual-apply.ts` L306, the LITERAL `BEGIN;...COMMIT;` form):
```typescript
// scripts/factual-apply.ts:306 — DO NOT REPLICATE. This is the manual literal
// form used when EMITTING SQL TO A FILE (where there's no live connection to
// hold the transaction). Phase 79's apply has a live connection and uses
// sql.begin() instead.
const body = `BEGIN;\n\n${updateStatements.join('\n\n')}\n\nCOMMIT;\n`
```

**Per-row UPDATE loop pattern** (existing — `scripts/v8.4-brand-canonicalization.ts` L289-307; established for 53-row scale):
```typescript
// EXISTING fuzzy-candidates loop demonstrates the per-row idiom. Phase 79's
// catalog brand_id UPDATE loop (~53 brands) inherits the same shape:
//   for (const r of unresolvedRows) {
//     const cands = await sql<...>`SELECT ... WHERE ...`
//   }
// At 53-200 rows the per-row round-trip is <1s — bulk VALUES is not worth the
// complexity AND sidesteps [[drizzle-sql-any-array-pitfall]] entirely.
```

**Catalog brand_id UPDATE shape** (RESEARCH § Code Examples L716-725; per [[drizzle-sql-any-array-pitfall]] — no `= ANY(${arr})` form):
```typescript
// Inside sql.begin(async tx => { ... }):
for (const [brandNorm, resolved] of brandMap.entries()) {
  const result = await tx`
    UPDATE watches_catalog
    SET brand_id = ${resolved.uuid}
    WHERE lower(trim(brand)) = ${brandNorm}
      AND (brand_id IS NULL OR brand_id <> ${resolved.uuid})
  `
  catalogRowsResolvedBrand += result.count
}
```

**Idempotent alias-append SQL** (RESEARCH § Pattern 4 L497-503; GIN-index-friendly):
```typescript
// Inside sql.begin transaction — per merge: family decision:
for (const merge of decisions.families.filter(f => f.kind === 'merge')) {
  const sourceNorm = merge.sourceModelRaw.toLowerCase().trim()
  const result = await tx`
    UPDATE watch_families
    SET aliases = aliases || ARRAY[${sourceNorm}]::text[]
    WHERE id = ${merge.targetUuid}
      AND NOT (aliases @> ARRAY[${sourceNorm}]::text[])
  `
  aliasesAppended += result.count
}
```

**Hydration UPDATE FROM JOIN** (RESEARCH § Pattern 5 L518-527; D-79-08):
```typescript
// Inside sql.begin transaction — Step 4.6:
const hydrationResult = await tx`
  UPDATE watches w
  SET brand = b.name,
      model = f.name
  FROM watches_catalog c
  JOIN brands b ON c.brand_id = b.id
  JOIN watch_families f ON c.family_id = f.id
  WHERE w.catalog_id = c.id
`
const userWatchesHydrated = hydrationResult.count
```

**Post-flight assertion with predicate divergence** (RESEARCH § Pattern 6 L548-570; [[post-flight-assertion-predicate-divergence]]):
```typescript
// Inside sql.begin transaction — Step 4.7. Positive predicate
// (IS DISTINCT FROM NULL) — NOT the inverse of the UPDATE's WHERE clause.
const [pf] = await tx<{ total: string; resolved_brand: string; resolved_family: string }[]>`
  SELECT
    (SELECT count(*) FROM watches_catalog)::text AS total,
    (SELECT count(*) FROM watches_catalog
       WHERE brand_id IS DISTINCT FROM NULL)::text AS resolved_brand,
    (SELECT count(*) FROM watches_catalog
       WHERE family_id IS DISTINCT FROM NULL)::text AS resolved_family
`
const total = Number(pf.total)
const resolvedBrand = Number(pf.resolved_brand)
const resolvedFamily = Number(pf.resolved_family)
if (resolvedBrand !== total || resolvedFamily !== total) {
  // Throw inside sql.begin → automatic ROLLBACK of all 6 steps.
  throw new Error(
    `MIG-04 post-flight assertion FAILED: ` +
    `total=${total} resolved_brand=${resolvedBrand} resolved_family=${resolvedFamily}. ` +
    `Rolling back the entire transaction.`,
  )
}
```

**Local-host detection** (RESEARCH § Pattern 3 L439-453; D-79-02 silent local / interactive prod):
```typescript
// NEW helper — Phase 79's only host-string check.
function isLocalDatabaseUrl(connStr: string): boolean {
  try {
    const url = new URL(connStr)
    return url.host === '127.0.0.1:54322' || url.host === 'localhost:54322'
  } catch {
    // Unparseable URL — fail closed (treat as prod → require confirmation).
    return false
  }
}
```

**Interactive `yes` prompt** (RESEARCH § Code Examples L832-864; Node built-in `readline/promises`):
```typescript
import * as readline from 'node:readline/promises'

async function confirmIfProd(connStr: string, summary: ApplySummary): Promise<void> {
  if (isLocalDatabaseUrl(connStr)) return  // D-79-02: silent local
  console.log(`
[v8.4-brand-canon] APPLY against PROD detected (${new URL(connStr).host}). Summary:
  - Brands to create:        ${summary.brandsToCreate}
  - Catalog rows to resolve: ${summary.catalogRowsToResolve}
  - Families to create:      ${summary.familiesToCreate}
  - User watches to hydrate: ${summary.userWatchesToHydrate}
  - Aliases to append:       ${summary.aliasesToAppend}
`)
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = await rl.question('Type "yes" to proceed: ')
    if (answer.trim() !== 'yes') {
      console.error('[v8.4-brand-canon] Operator declined. Exiting without write.')
      process.exit(1)
    }
  } finally {
    rl.close()
  }
}
```

**Refuse-to-overwrite gate pattern for family file** (existing — `scripts/v8.4-brand-canonicalization.ts` L230-237; reuse verbatim shape for the new `family-merge-decisions.md` artifact under `--mode=families`):
```typescript
// EXISTING brand-side gate (D-78-07) — Phase 79 mirrors this exactly for the
// family file. The same args.regenerate / args.force flags govern both.
if (existsSync(OUTPUT_FILE) && !args.regenerate && !args.force) {
  console.error(
    `[v8.4-brand-canon] ERROR: ${OUTPUT_FILE} already exists.\n` +
      `Pass --regenerate to merge operator decisions forward, or --force to overwrite from scratch.\n` +
      `DO NOT remove the file manually — --regenerate is the safe recovery path.`,
  )
  process.exit(1)
}
```

**GFM artifact builder pattern** (existing — `scripts/v8.4-brand-canonicalization.ts` L138-148 `buildTableRows` + L209-223 `buildHeader`; REUSE for family file via parallel `buildFamilyRow` / `buildFamilyTableRows` with `FamilyRow` type analogous to `BrandRow`):
```typescript
// EXISTING brand-side builder — Phase 79 adds parallel family builders that
// share `formatCell` and the header/separator structure.
export function buildTableRows(
  rows: BrandRow[],
  candidatesByNormalized: Map<string, Candidate[]>,
): string[] {
  const lines: string[] = [GFM_HEADER, GFM_SEPARATOR]
  for (const r of rows) {
    const cands = candidatesByNormalized.get(r.brand_normalized) ?? []
    lines.push(buildRow(r, cands))
  }
  return lines
}
```

**`parseExistingPreserved` reuse** (existing — `scripts/v8.4-brand-canonicalization.ts` L155-171; operates on raw line text — schema-agnostic, so Phase 79's family file parsing reuses it unchanged for the `--regenerate --mode=families` merge-forward path).

**Error handling pattern** (existing — `scripts/v8.4-brand-canonicalization.ts` L341-344):
```typescript
main().catch((err) => {
  console.error('[v8.4-brand-canon] fatal:', err)
  process.exit(1)
})
// PHASE 79 NOTE: inside sql.begin callbacks, ONLY throw — do NOT process.exit
// (Pitfall 2). The outer .catch handles the process exit AFTER rollback.
```

**In-memory brand-decision map** (RESEARCH § Pattern 2 L398-413; planner's choice but the obvious shape):
```typescript
// NEW types — placed near existing BrandRow / Candidate exports.
export type ResolvedBrand =
  | { kind: 'existing'; uuid: string; canonicalName: string }
  | { kind: 'merge';    uuid: string; canonicalName: string }
  | { kind: 'new';      syntheticKey: string; rawName: string }

export type BrandDecisionMap = Map<string, ResolvedBrand>

// After Step 4.1 (INSERT new brands), reify 'new' entries via RETURNING id:
//   const [row] = await tx<{ id: string }[]>`
//     INSERT INTO brands (name, slug, needs_review)
//     VALUES (${newBrand.name}, ${slugify(newBrand.name)}, false)
//     RETURNING id
//   `
//   brandMap.set(key, { kind: 'existing', uuid: row.id, canonicalName: newBrand.name })
// Then invariant check before Step 4.2:
//   for (const v of brandMap.values()) {
//     if (v.kind === 'new') throw new Error('brandMap not reified after Step 4.1')
//   }
```

**Slug generator** (RESEARCH § Don't Hand-Roll table — match established slug shape; ~3 LOC):
```typescript
function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
```

---

### `tests/unit/scripts/v8.4-family-build-decisions.test.ts` (NEW)

**Analog:** `tests/unit/scripts/v8.4-seed021-golden.test.ts`

**Header convention** (analog L1-2 + Phase 78 convention):
```typescript
// Phase 79 / 79-01-PLAN.md — Wave 0 RED stub.
//
// Unit test for the in-memory brand-decision-map → family-row generation
// pipeline (D-79-07). Asserts that:
//   - Hamilton + Hamilton Watch raws collapse to ONE family row per
//     (canonical_brand_id, model) tuple BEFORE the operator opens the file.
//   - 'merge:<uuid>' on the brand side does NOT leak duplicates into the
//     family file.
//   - 'new' brand placeholders (synthetic_key) propagate as the family row's
//     scope key so the operator can still resolve the family row by name.
//
// No DATABASE_URL gate — uses exported pure functions from the script.
```

**Test scaffold** (analog L31-37 + L49-87):
```typescript
import { describe, it, expect } from 'vitest'
import {
  buildFamilyTableRows,
  buildBrandMap,
  type BrandRow,
  type FamilyRow,
} from '../../../scripts/v8.4-brand-canonicalization'

describe('Phase 79 — v8.4 family-build-decisions (D-79-07)', () => {
  const fixtureBrandRows: BrandRow[] = [
    { brand_raw: 'Hamilton', brand_normalized: 'hamilton', proposed_target_id: 'uuid-h' },
    { brand_raw: 'Hamilton Watch', brand_normalized: 'hamilton watch', proposed_target_id: null },
    // ...
  ]
  it('Hamilton + Hamilton Watch collapse to one canonical brand id in the map', () => {
    // ...
  })
})
```

---

### `tests/unit/scripts/v8.4-strict-gate.test.ts` (NEW)

**Analog:** `tests/unit/scripts/v8.4-regenerate-merge.test.ts`

**Pure-function fixture pattern** (analog L16-22 + L24-43):
```typescript
// Phase 79 / 79-01-PLAN.md — Wave 0 RED stub.
//
// Unit test for D-79-01 strict pre-flight gate. Refuse cases:
//   (a) row with status='needs-review'
//   (b) row with unknown status token (per D-78-02 grammar)
//   (c) merge:<uuid> pointing at non-existent target
//   (d) live catalog brand absent from decisions file
// Pass case:
//   all rows terminal + all merge UUIDs valid + no drift between catalog
//   and decisions file → gate returns { brandMap, familyMap, summary }.

import { describe, it, expect } from 'vitest'
import {
  strictPreflightGate,
  // ... or test individual sub-helpers if extracted
} from '../../../scripts/v8.4-brand-canonicalization'

describe('Phase 79 — v8.4 strict pre-flight gate (D-79-01)', () => {
  // Use Map fixtures for `existing brand/family uuids in DB` rather than a
  // live connection. Refactor strictPreflightGate to accept the existence
  // check as an injected function so this test stays DB-free.
})
```

---

### `tests/unit/scripts/v8.4-host-detect.test.ts` (NEW)

**Analog:** `tests/unit/scripts/v8.4-md-artifact-schema.test.ts` (role-match — pure function in/out)

**Pattern** (analog L13-19):
```typescript
// Phase 79 / 79-01-PLAN.md — Wave 0 RED stub.
//
// Unit test for D-79-02 local-vs-prod URL detection. Covers:
//   - '127.0.0.1:54322' → true
//   - 'localhost:54322' → true
//   - 'aws-1.pooler.supabase.com:6543' → false
//   - 'aws-0.pooler.supabase.com:5432' → false
//   - '127.0.0.1:54323' (alt port) → false (safety bias)
//   - 'not a url' → false (fail closed)
//   - empty string → false (fail closed)

import { describe, it, expect } from 'vitest'
import { isLocalDatabaseUrl } from '../../../scripts/v8.4-brand-canonicalization'

describe('Phase 79 — v8.4 isLocalDatabaseUrl (D-79-02)', () => {
  it('returns true for 127.0.0.1:54322', () => {
    expect(isLocalDatabaseUrl('postgres://postgres:postgres@127.0.0.1:54322/postgres')).toBe(true)
  })
  it('returns false for Supabase pooler', () => {
    expect(isLocalDatabaseUrl('postgres://...@aws-1.pooler.supabase.com:6543/postgres')).toBe(false)
  })
  // ...
})
```

---

### `tests/unit/scripts/v8.4-post-deploy-template.test.ts` (NEW)

**Analog:** `tests/unit/scripts/v8.4-md-artifact-schema.test.ts` (role-match — template emission verified by string assertions)

**Pattern**: assert that `renderPostDeployMarkdown(args)` returns a string containing the required headings (`## Apply Summary`, `## Post-Flight Assertion (MIG-04)`, `## Operator Sign-Off Queries`, `## What this push does NOT do`), the substitution of counts into the GFM table, and the 6 verification SQL blocks. Extract the writer into a pure `renderPostDeployMarkdown(...)` function so the test stays I/O-free; the file-system `writeFile` call wraps the pure renderer.

---

### `tests/integration/scripts/v8.4-apply-atomic.test.ts` (NEW)

**Analog:** `tests/integration/scripts/v8.4-readonly.test.ts` (exact — inverse intent: asserts WRITES did happen, snapshot-before/snapshot-after diff)

**DATABASE_URL gate pattern** (analog L19-22):
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import * as path from 'node:path'
import postgres from 'postgres'

const maybe = process.env.DATABASE_URL ? describe : describe.skip
```

**Snapshot helper pattern** (analog L49-66) — adapt for Phase 79's write-asserting model:
```typescript
async function snapshot(): Promise<Snapshot> {
  // EXISTING (Phase 78 read-only test):
  const [brandsRow] = await sql<{ count: string; max: string | null }[]>`
    SELECT count(*)::text AS count, max(updated_at)::text AS max FROM public.brands
  `
  // ...
}
// PHASE 79: snapshot ALSO captures
//   - count(*) WHERE brand_id IS DISTINCT FROM NULL on watches_catalog
//   - count(*) WHERE family_id IS DISTINCT FROM NULL on watches_catalog
//   - count(*) FROM watches WHERE brand = 'Hamilton' (canonical hydration check)
// PRE-snapshot: all should be 0 or pre-canonical values.
// POST-snapshot: brand/family resolved counts should EQUAL total catalog
// count; watches.brand should reflect 'Hamilton' (not 'Hamilton Watch') for
// the SEED-021 case.
```

**Script-spawn pattern** (analog L81-90):
```typescript
const result = spawnSync('npx', ['tsx', SCRIPT_PATH, '--apply', '--mode=both'], {
  cwd: process.cwd(),
  env: { ...process.env },
  encoding: 'utf8',
})
if ((result.status ?? -1) !== 0) {
  throw new Error(
    `script exited ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
  )
}
```

**Phase 79 setup additions** (NOT in analog — required because apply is destructive):
```typescript
// beforeAll: also back up the family-merge-decisions.md file (if present) and
// write a known-good fixture so the strict gate has clean input. Also write a
// known-good brand-merge-decisions.md fixture (deferring to the committed
// .planning/v8.4-brand-merge-decisions.md is acceptable as long as it has the
// Hamilton merge row).
// afterAll: restore both decision files; restore the DB to pre-apply state via
// a transaction snapshot OR by running `supabase db reset` (heavy but reliable
// — see [[local-db-reset]] for the multi-step recipe).
```

---

### `tests/integration/scripts/v8.4-apply-idempotent.test.ts` (NEW)

**Analog:** `tests/integration/scripts/v8.4-brand-canonicalization.test.ts` (role-match — same script, asserts D-79-04 "already applied" gate)

**Pattern** (analog L32-43 + L64-88):
```typescript
function runScript(args: string[] = []): { exitCode: number; stdout: string; stderr: string } {
  const result = spawnSync('npx', ['tsx', SCRIPT_PATH, ...args], {
    cwd: process.cwd(),
    env: { ...process.env },
    encoding: 'utf8',
  })
  return {
    exitCode: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

maybe('Phase 79 — v8.4 --apply idempotent (D-79-04)', () => {
  it('first --apply --mode=both run exits 0 and writes', () => {
    const result = runScript(['--apply', '--mode=both'])
    expect(result.exitCode).toBe(0)
  })
  it('second --apply --mode=both run exits 0 with "Already applied" message', () => {
    const result = runScript(['--apply', '--mode=both'])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toMatch(/Already applied/)
  })
})
```

---

### `.planning/phases/79-backfill-migration-display-hydration/79-POST-DEPLOY.md` (GENERATED — D-79-10)

**Analog:** `.planning/phases/78-schema-additions-operator-resolve-queue/78-POST-DEPLOY.md`

**Section structure to mirror verbatim:**
1. Front-matter (Date / Operator / Status / Script)
2. (NEW — Phase 79 only) Apply Summary GFM table with counts
3. Post-Flight Assertion (MIG-04) — query block + result
4. Operator Sign-Off Queries — 6 SQL blocks (Phase 78 had 5)
5. Sign-off checklist
6. "What this push does NOT do (forward-armor against scope creep)"
7. Phase 79 Deliverables Summary GFM table (MIG-02/MIG-03/MIG-04/MIG-05/DISP-03 → ✅ with counts)
8. Next Phase pointer

**Renderer pattern** (RESEARCH § Code Examples L957-1088) — extract into a PURE `renderPostDeployMarkdown(args)` function so the unit test asserts on the string without filesystem I/O; the `writePostDeployArtifact(args)` function wraps the renderer with `mkdir` + `writeFile`:
```typescript
async function writePostDeployArtifact(args: {
  counts: ApplyCounts
  postFlightQuery: string
  postFlightResult: { total: number; resolvedBrand: number; resolvedFamily: number }
  isLocal: boolean
}): Promise<void> {
  const content = renderPostDeployMarkdown(args)
  await mkdir(path.dirname(POST_DEPLOY_PATH), { recursive: true })
  await writeFile(POST_DEPLOY_PATH, content, 'utf8')
  console.log(`[v8.4-brand-canon] wrote ${POST_DEPLOY_PATH}`)
}
```

**Operator sign-off SQL block #2 to include verbatim** (Hamilton merge canonical end-to-end check — `specifics.md` L147-151):
```sql
SELECT count(*) AS rows_pointing_at_canonical_hamilton
FROM watches_catalog
WHERE brand_id = '20969364-f3b1-4b1d-ab2f-e5d22e9ffabc';
-- Expected: ≥ (count of catalog rows where lower(trim(brand)) IN ('hamilton', 'hamilton watch'))
```

---

### `.planning/v8.4-family-merge-decisions.md` (GENERATED)

**Analog:** `.planning/v8.4-brand-merge-decisions.md` (committed example of the operator-edited format)

**Header pattern to mirror** (analog L1-14):
```markdown
# v8.4 Family Merge Decisions

> Generated 2026-06-25 by scripts/v8.4-brand-canonicalization.ts --mode=families — READ-ONLY.
> Edit `status` cells to lock decisions: auto-resolved | merge:<uuid> | new | skip | needs-review
> Phase 79's --apply --mode=both consumes this file. Unknown status values cause Phase 79 to refuse the run.
>
> DO NOT remove this file between runs. Use --regenerate --mode=families to merge operator
> decisions forward; the script preserves any row whose status is not `needs-review` verbatim.

| brand | family_raw | normalized | proposed_target_id | status | candidates / notes |
| ----- | ---------- | ---------- | ------------------ | ------ | ------------------ |
| Hamilton | Khaki Field | khaki field | <uuid-or-empty> | <status> | ... |
| ... |
```

**Column delta from brand artifact:** family table needs a leading `brand` column (the resolved canonical brand name from the in-memory map) because families are brand-scoped per the `watch_families_brand_name_unique` constraint. All other columns mirror the brand artifact exactly.

---

## Shared Patterns

### Service-role + DATABASE_URL connection (D-78-06 carried forward)

**Source:** `scripts/v8.4-brand-canonicalization.ts` L239-258

**Apply to:** every code path in the script (dry-run brand, dry-run family, apply path) — single connection per invocation; reuse the same `postgres({ max: 1, prepare: false })` instance; preserve the `SET search_path = public, extensions, pg_catalog` line at the top of `try {}`.

```typescript
const connStr = process.env.DATABASE_URL
if (!connStr) { console.error(...); process.exit(1) }
const sql = postgres(connStr, { max: 1, prepare: false })
try {
  await sql.unsafe(`SET search_path = public, extensions, pg_catalog`)
  // ... mode dispatch ...
} finally {
  await sql.end()
}
```

### Direct-invocation guard (existing in script)

**Source:** `scripts/v8.4-brand-canonicalization.ts` L339-345

**Apply to:** the script — preserve unchanged so unit/integration tests can import without spawning the CLI.

```typescript
const invokedDirectly = process.argv[1] && /v8\.4-brand-canonicalization\.ts$/.test(process.argv[1])
if (invokedDirectly) {
  main().catch((err) => {
    console.error('[v8.4-brand-canon] fatal:', err)
    process.exit(1)
  })
}
```

### IN-list parameter binding (anti-pattern guardrail)

**Source:** `src/data/recommendations.ts:454` (canonical positive example) + `src/data/search.ts:280` (commented anti-pattern reference)

**Apply to:** any code path in Phase 79 that needs to query "where X in {list of N values}" — use `sql.join` of parameterized binds, NEVER `= ANY(${arr})`.

```typescript
// CORRECT (recommendations.ts:454 verbatim shape):
sql`lower(trim(${watchesCatalog.brand})) IN (${sql.join(
  excluded.map(b => sql`${b}`),
  sql`, `,
)})`

// INCORRECT — per [[drizzle-sql-any-array-pitfall]]:
// sql`brand = ANY(${brandsArray})`  // ROW literal at runtime → 42809 crash
```

**Phase 79 application:** the strict gate's "merge:<uuid> targets exist" check (RESEARCH § strictPreflightGate L894-911) currently shows `sql\`SELECT id FROM brands WHERE id IN ${sql(brandMergeUuids)}\`` — this is the `postgres` lib's array-helper form (different from Drizzle's `= ANY(${arr})` pitfall) and IS safe in the `postgres` lib idiom. If a planner-task action says "use ANY(arr)", reject and substitute the `sql.join` form.

### Test header convention (Phase 78 → Phase 79 carryforward)

**Source:** `tests/unit/scripts/v8.4-md-artifact-schema.test.ts` L1-11 + `tests/integration/scripts/v8.4-readonly.test.ts` L1-10

**Apply to:** EVERY new test file in Phase 79.

```typescript
// Phase 79 / 79-XX-PLAN.md — Wave 0 RED stub.    ← OR `— GREEN` after impl
//
// <one-paragraph what-the-test-covers + which decision it gates>
//
// <DATABASE_URL gate note if integration; "No DATABASE_URL gate" if unit>
```

### DATABASE_URL gate for integration tests

**Source:** `tests/integration/scripts/v8.4-readonly.test.ts` L19-22 + L68-93 (beforeAll setup)

**Apply to:** every Phase 79 integration test.

```typescript
const maybe = process.env.DATABASE_URL ? describe : describe.skip
// ...
maybe('Phase 79 — ...', () => {
  let sql: ReturnType<typeof postgres>
  beforeAll(async () => {
    sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false })
    // ...
  }, 60000)
  afterAll(async () => {
    if (sql) await sql.end({ timeout: 5 })
  })
})
```

### Backup/restore for operator-edited artifact files

**Source:** `tests/integration/scripts/v8.4-readonly.test.ts` L68-104 (backup `.planning/v8.4-brand-merge-decisions.md` before, restore after)

**Apply to:** the apply-atomic test — back up BOTH `brand-merge-decisions.md` AND `family-merge-decisions.md`; restore both in afterAll.

```typescript
beforeAll(() => {
  if (existsSync(BRAND_PATH))  writeFileSync(BRAND_BACKUP,  readFileSync(BRAND_PATH,  'utf8'))
  if (existsSync(FAMILY_PATH)) writeFileSync(FAMILY_BACKUP, readFileSync(FAMILY_PATH, 'utf8'))
})
afterAll(() => {
  if (existsSync(BRAND_BACKUP))  { writeFileSync(BRAND_PATH,  readFileSync(BRAND_BACKUP, 'utf8')); unlinkSync(BRAND_BACKUP)  }
  if (existsSync(FAMILY_BACKUP)) { writeFileSync(FAMILY_PATH, readFileSync(FAMILY_BACKUP, 'utf8')); unlinkSync(FAMILY_BACKUP) }
})
```

---

## No Analog Found

None. Every Phase 79 deliverable maps onto an existing analog. The most novel surface (`sql.begin` for atomicity) has one precedent (`scripts/repair-drizzle-journal.ts:172`) — small but sufficient to confirm the API contract.

---

## Schema Reference (read-only — Phase 79 writes against this schema; does NOT add columns)

**Source:** `src/db/schema.ts` (no edits)

| Table | Lines | Columns Phase 79 Touches | Direction |
|-------|-------|--------------------------|-----------|
| `watches` | L90-175 | `brand` (text NOT NULL) + `model` (text NOT NULL) | WRITE (Step 4.6 hydration) |
| `watches_catalog` | L440-510 | `brand_id` (uuid, FK→brands, nullable until Phase 80) + `family_id` (uuid, FK→watch_families, nullable until Phase 80) | WRITE (Steps 4.2 + 4.5 UPDATE) |
| `watches_catalog` (read) | L451-459 | `brand_normalized` + `model_normalized` (GENERATED) | READ (WHERE clauses; auto-keyed by Postgres) |
| `brands` | L518-537 | `name` + `slug` + `needs_review` | WRITE (Step 4.1 INSERT for `kind='new'` rows; `needs_review=false` per D-79-09) |
| `brands` (read) | L524-526 | `name_normalized` (GENERATED) | READ (resolution + strict gate) |
| `watch_families` | L539-563 | `brand_id` + `name` + `aliases` + `needs_review` | WRITE (Step 4.3 INSERT for new; Step 4.4 UPDATE for alias-append; D-79-06 + D-79-09) |

FK constraint semantics Phase 79 must satisfy:
- `watches_catalog.brand_id` → `brands.id` ON DELETE RESTRICT (L504) — INSERT brands BEFORE catalog UPDATE references them; this is why Step 4.1 precedes 4.2 (Pitfall 3).
- `watches_catalog.family_id` → `watch_families.id` ON DELETE RESTRICT (L505) — same shape; Step 4.3 precedes 4.5.
- `watch_families.brand_id` → `brands.id` ON DELETE RESTRICT (L544) — INSERT new families needs the brand uuid already in `brands`; same Step 4.1 → 4.3 ordering.
- `watches.catalog_id` → `watches_catalog.id` ON DELETE SET NULL (L154) — Pitfall 5: hydration UPDATE's JOIN naturally skips watches with NULL catalog_id (orphaned by prior catalog deletes).

---

## Metadata

**Analog search scope:** `scripts/` (all files); `tests/unit/scripts/`; `tests/integration/scripts/`; `tests/integration/migrations/`; `.planning/phases/78-*/`; `.planning/v8.4-*.md`; `src/db/schema.ts`; cross-checked `src/data/recommendations.ts`, `src/data/search.ts`, `src/data/catalog.ts` for `sql.join` IN-list precedent.

**Files scanned:** 12 (3 scripts, 3 test files, 2 planning artifacts, 1 schema, 3 DAL files for IN-list cross-check).

**Pattern extraction date:** 2026-06-25.
