---
phase: 39b
plan: 01
type: execute
wave: 0
depends_on: []
files_modified:
  - src/data/hierarchy.ts
  - src/components/profile/WornCalendar.tsx
  - src/components/profile/StatsTabContent.tsx
  - scripts/seed-lineage.ts
  - package.json
  - tests/static/hierarchy.lineage-3-node.test.ts
autonomous: false
requirements:
  - DISC-11
nsv_rows:
  - NSV-02
  - NSV-14
  - NSV-16
disc_audit_rows:
  - DISC-AUDIT-130
commit_strategy: per-task

must_haves:
  truths:
    - "getLineageForReference returns each row with an imageUrl field (string or null)"
    - "WearEventLite interface in WornCalendar exposes a 'note' field (or analog field used by wear-detail panel)"
    - "scripts/seed-lineage.ts exists and is invokable via `npm run db:seed-lineage`"
    - "Re-running the seed script after a successful commit prints `family_patched=0 edges_inserted=0` (idempotency proof)"
    - "Wave 1 UI plans can verify hide-if-empty against real sparse prod data because seeds are committed"
  artifacts:
    - path: "scripts/seed-lineage.ts"
      provides: "Operator-curation idempotent backfill script (Pass A family_id, Pass B lineage_edges)"
      contains: "ON CONFLICT (predecessor_catalog_id, successor_catalog_id, relationship_type) DO NOTHING"
    - path: "src/data/hierarchy.ts"
      provides: "Extended getLineageForReference CTE selecting wc.image_url + getSameFamilyForCatalog (added in Plan 39b-05)"
      contains: "imageUrl"
    - path: "package.json"
      provides: "db:seed-lineage npm script entry"
      contains: "db:seed-lineage"
    - path: "tests/static/hierarchy.lineage-3-node.test.ts"
      provides: "Static guard updated to assert wc.image_url appears in both CTE arms"
      contains: "wc.image_url"
  key_links:
    - from: "scripts/seed-lineage.ts"
      to: "prod watches_catalog + watch_lineage_edges tables"
      via: "tsx --env-file=.env.local + operator DATABASE_URL prod-pooler override"
      pattern: "DATABASE_URL=.*npm run db:seed-lineage"
    - from: "src/data/hierarchy.ts CTE"
      to: "downstream Wave 1 LineageRail consumers"
      via: "imageUrl field on each LineageRow"
      pattern: "imageUrl:\\s*string\\s*\\|\\s*null"
---

<objective>
Land the Wave 0 prerequisites for Phase 39b's heavier-UX closures: extend
`getLineageForReference` to surface `imageUrl` on every lineage row, extend
WornCalendar's `WearEventLite` interface to include `note` (so the wear-detail
panel in Plan 39b-03 can read it), verify `getWatchesByUser` numeric-cast
hygiene (pitfall 10), ship the idempotent `scripts/seed-lineage.ts` operator
script, wire the `npm run db:seed-lineage` package script, and gate Wave 1 on
an operator checkpoint that commits ~20 `family_id` updates + ~15
`watch_lineage_edges` rows to prod DB.

Purpose: Wave 1 UI plans (39b-02..05) are gated on this work — they verify
hide-if-empty branches against REAL sparse prod data (D-39b-19), not against
empty-everywhere. The CTE imageUrl extension is load-bearing for LineageRail
card rendering. The WearEventLite note extension is load-bearing for the
wear-detail panel content density (D-39b-13 + UI-SPEC §Sub-cell #2). The
operator seed pass is load-bearing for D-39b-07 hide-if-empty verification.

Output: Wave 0 SUMMARY documenting (a) the CTE patch, (b) the WearEventLite
patch, (c) numeric-cast verification result, (d) the seed script + npm script
shipment, (e) the operator checkpoint outcome (family_patched / family_skipped
/ edges_inserted / edges_skipped counts pre- and post-second-run).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-CONTEXT.md
@.planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-PATTERNS.md
@.planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-RESEARCH.md
@.planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-UI-SPEC.md
@.planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-VALIDATION.md
@CLAUDE.md
@AGENTS.md
@src/data/hierarchy.ts
@src/components/profile/WornCalendar.tsx
@scripts/backfill-catalog-brands.ts
@tests/static/hierarchy.lineage-3-node.test.ts

<interfaces>
<!-- Key types and contracts. Extracted from codebase. -->

From src/data/hierarchy.ts:27-38 (CURRENT shape — extend to add imageUrl):
```typescript
export interface LineageRow {
  id: string
  brand: string
  model: string
  reference: string | null
  predecessor_catalog_id: string
  successor_catalog_id: string
  relationship_type: string
  depth: number
  direction: 'forward' | 'backward'
  is_cycle: boolean
}
export async function getLineageForReference(catalogId: string): Promise<LineageRow[]>
```

From src/components/profile/WornCalendar.tsx:16-20 (CURRENT shape — extend with note):
```typescript
interface WearEventLite {
  id: string
  watchId: string
  wornDate: string  // YYYY-MM-DD
}
```

From src/data/watches.ts:154-160 (verified Number-cast pattern — DO NOT modify; this is the reference for the grep verification task):
```typescript
formality: taste.formality !== null ? Number(taste.formality) : null,
sportiness: taste.sportiness !== null ? Number(taste.sportiness) : null,
heritageScore: taste.heritageScore !== null ? Number(taste.heritageScore) : null,
confidence: taste.confidence !== null ? Number(taste.confidence) : null,
```

From src/db/schema.ts §watchLineageEdges (unique-triple constraint — load-bearing for ON CONFLICT):
```typescript
// lineage_edges_unique_triple → (predecessor_catalog_id, successor_catalog_id, relationship_type)
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extend getLineageForReference CTE to return imageUrl</name>
  <files>src/data/hierarchy.ts</files>
  <read_first>
    - src/data/hierarchy.ts (full file — 106 lines; the existing recursive CTE lives here)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-PATTERNS.md §6a (lines 479-547 — CTE patch diff with copy-paste-ready code)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-RESEARCH.md §Pitfall 5 — "Both seed AND recursive arms must carry the new column"
    - src/db/schema.ts §watchesCatalog — confirm `image_url` column name
  </read_first>
  <action>
    Patch `src/data/hierarchy.ts` to extend `LineageRow` and the recursive CTE so each returned row carries an `imageUrl: string | null` field.

    Step 1 — Extend interface (around line 27-38):
    Add `imageUrl: string | null` between `reference: string | null` and `predecessor_catalog_id: string`. Final interface MUST contain the exact line:
    `  imageUrl: string | null`

    Step 2 — Patch the CTE (BOTH arms — seed and recursive UNION ALL — Pitfall 5):
    - Add `image_url` to the WITH RECURSIVE column list: `lineage(id, brand, model, reference, image_url, predecessor_catalog_id, ...)`
    - In the seed SELECT: add `wc.image_url` after `wc.reference`
    - In the recursive UNION ALL SELECT: add `wc.image_url` after `wc.reference`
    - In the final outer SELECT: add `image_url AS "imageUrl"` after `reference`

    Use the diff in 39b-PATTERNS.md §6a (lines 503-535) verbatim — every `+` line must appear, every `-` line must be removed.

    Step 3 — Ensure the row mapping/cast preserves nulls. Postgres `text` column does not need `Number()` cast.

    Forbidden: do NOT remove the `CYCLE id SET is_cycle USING path` clause; do NOT change the `depth < 10` guard; do NOT modify the function signature.
  </action>
  <verify>
    <automated>grep -c "wc.image_url" src/data/hierarchy.ts | grep -E '^[2-9]$|^[1-9][0-9]+$'</automated>
    <automated>grep -E 'imageUrl:\s*string\s*\|\s*null' src/data/hierarchy.ts</automated>
    <automated>grep 'image_url AS "imageUrl"' src/data/hierarchy.ts</automated>
    <automated>npx tsc --noEmit 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "wc.image_url" src/data/hierarchy.ts` returns ≥ 2 (seed + recursive arms — Pitfall 5)
    - `grep -E "imageUrl:\s*string\s*\|\s*null" src/data/hierarchy.ts` returns ≥ 1 line (interface field added)
    - `grep "image_url AS \"imageUrl\"" src/data/hierarchy.ts` returns 1 line (outer SELECT alias)
    - `npx tsc --noEmit` exits 0 OR error count equals the documented Phase 36 baseline of 27 pre-existing errors (NO new errors caused by this task — compare `npx tsc --noEmit 2>&1 | grep -c "error TS"` against 27)
    - `grep "CYCLE id SET is_cycle USING path" src/data/hierarchy.ts` returns 1 line (cycle clause preserved)
    - `grep "depth < 10" src/data/hierarchy.ts` returns ≥ 1 line (depth guard preserved)
  </acceptance_criteria>
  <done>
    `getLineageForReference(catalogId)` returns `LineageRow[]` where every row carries `imageUrl: string | null`. Type checks clean (no new tsc errors). CYCLE + depth-guard preserved.
  </done>
</task>

<task type="auto">
  <name>Task 2: Update hierarchy.lineage-3-node test to assert imageUrl in CTE</name>
  <files>tests/static/hierarchy.lineage-3-node.test.ts</files>
  <read_first>
    - tests/static/hierarchy.lineage-3-node.test.ts (full file — current static guard structure)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-PATTERNS.md §17 (lines 1248-1274 — three new test assertions ready to copy)
  </read_first>
  <action>
    Append three new `it(...)` assertions to the existing describe block in `tests/static/hierarchy.lineage-3-node.test.ts`. Copy the assertions verbatim from 39b-PATTERNS.md §17:

    1. `it('CTE selects wc.image_url in both seed and recursive arms (Pitfall 5)', () => { ... })` — asserts `(/wc\.image_url/g)` matches ≥ 2 occurrences.
    2. `it('LineageRow interface declares imageUrl field', () => { ... })` — asserts `/imageUrl:\s*string\s*\|\s*null/`.
    3. `it('getSameFamilyForCatalog function is exported', () => { ... })` — asserts `/export\s+(async\s+)?function\s+getSameFamilyForCatalog/` (will FAIL until Plan 39b-05 ships the function; that is intentional RED state — Plan 39b-05 closes it).

    Use the `HIERARCHY_PATH` constant if it already exists at the top of the file; if not, define `const HIERARCHY_PATH = 'src/data/hierarchy.ts'`. Use the existing `existsSync` + `readFileSync` import pattern from this file (it is the canonical analog for static guards).

    Forbidden: do NOT modify the pre-existing test assertions. APPEND only.
  </action>
  <verify>
    <automated>npx vitest run tests/static/hierarchy.lineage-3-node.test.ts 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "wc.image_url" tests/static/hierarchy.lineage-3-node.test.ts` returns ≥ 1 (new assertion present)
    - `grep "LineageRow interface declares imageUrl field" tests/static/hierarchy.lineage-3-node.test.ts` returns 1 line
    - `grep "getSameFamilyForCatalog function is exported" tests/static/hierarchy.lineage-3-node.test.ts` returns 1 line
    - Running `npx vitest run tests/static/hierarchy.lineage-3-node.test.ts`: the first two new tests PASS (Task 1 already shipped them); the third new test FAILS as expected (closes in Plan 39b-05). Exit code is non-zero — record the single failing test name in the SUMMARY ("intentional RED state for getSameFamilyForCatalog assertion — closes in 39b-05").
  </acceptance_criteria>
  <done>
    Static guard updated. First two assertions green; third assertion intentionally RED until Plan 39b-05 ships `getSameFamilyForCatalog`.
  </done>
</task>

<task type="auto">
  <name>Task 3: Extend WornCalendar WearEventLite to include note field</name>
  <files>src/components/profile/WornCalendar.tsx</files>
  <read_first>
    - src/components/profile/WornCalendar.tsx (full file — 181 lines; `WearEventLite` interface at lines 16-20)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-PATTERNS.md §3 (lines 203-314 — the interface extension excerpt at lines 209-216 is what we ship in this task; the panel + state come in Plan 39b-03)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-RESEARCH.md §Pitfall 2 — WearEventLite omits `note`
    - src/app/u/[username]/[tab]/page.tsx — verify the parent already reads `event.note` or analog from `getAllWearEventsByUser`
  </read_first>
  <action>
    Step 1 — Extend `WearEventLite` interface at WornCalendar.tsx:16-20.

    BEFORE:
    ```typescript
    interface WearEventLite {
      id: string
      watchId: string
      wornDate: string  // YYYY-MM-DD
    }
    ```

    AFTER:
    ```typescript
    interface WearEventLite {
      id: string
      watchId: string
      wornDate: string   // YYYY-MM-DD
      note: string | null  // NEW Phase 39b — parent passes from getAllWearEventsByUser
    }
    ```

    Step 2 — Grep `src/app/u/[username]/[tab]/page.tsx` to confirm the parent mount-site already passes `note` (or an analog field) on each event. If the parent passes `notes` (plural), align the interface field name to match what the parent provides (use whatever field name `src/data/wearEvents.ts` `getAllWearEventsByUser` returns — verify by grepping that file). Document the chosen field name in the SUMMARY.

    Step 3 — DO NOT add the wear-detail panel JSX or `selectedDate` state in this task. Those land in Plan 39b-03 Task 2. This task is interface-only.

    Forbidden: no `selectedDate` state addition; no day-cell onClick; no panel JSX. Plan 39b-03 owns those.
  </action>
  <verify>
    <automated>grep -E "note:?\s*string\s*\|\s*null|notes:?\s*string\s*\|\s*null" src/components/profile/WornCalendar.tsx</automated>
    <automated>npx tsc --noEmit 2>&1 | grep -c "error TS"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -E "note:?\s*string\s*\|\s*null|notes:?\s*string\s*\|\s*null" src/components/profile/WornCalendar.tsx` returns ≥ 1 line (interface extended)
    - `grep -c "useState" src/components/profile/WornCalendar.tsx` returns the SAME count as BEFORE the patch (no new state — Plan 39b-03 adds `selectedDate`)
    - `grep -c "onClick" src/components/profile/WornCalendar.tsx` returns the SAME count as BEFORE the patch (no new onClick — Plan 39b-03 adds day-cell handler)
    - `npx tsc --noEmit 2>&1 | grep -c "error TS"` ≤ 27 (Phase 36 baseline — no new errors)
  </acceptance_criteria>
  <done>
    `WearEventLite` interface carries a note (or notes) field aligned with the parent's data shape. No state or onClick added (Plan 39b-03 owns those).
  </done>
</task>

<task type="auto">
  <name>Task 4: Verify getWatchesByUser numeric-cast hygiene (A3 grep)</name>
  <files>src/data/watches.ts</files>
  <read_first>
    - src/data/watches.ts (lines 140-180 — the LEFT JOIN taste row mapper)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-RESEARCH.md §Pitfall 10 + Assumption A3 (lines 1100-1102, 1130-1133)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-PATTERNS.md §"`Number()` cast on Postgres `numeric` columns" (lines 1323-1337)
  </read_first>
  <action>
    Verify-then-patch protocol. Phase 39 D-08 generalizes this — do NOT patch what is already shipped.

    Step 1 — Grep `src/data/watches.ts` for `Number(` casts on the 4 numeric taste fields:
    - formality, sportiness, heritageScore, confidence

    Expected (verified during plan authoring 2026-05-13):
    ```
    154:          formality: taste.formality !== null ? Number(taste.formality) : null,
    155:          sportiness: taste.sportiness !== null ? Number(taste.sportiness) : null,
    156:          heritageScore: taste.heritageScore !== null ? Number(taste.heritageScore) : null,
    160:          confidence: taste.confidence !== null ? Number(taste.confidence) : null,
    ```

    Step 2A — IF the four casts are present (≥ 4 `Number(` calls on those fields in `src/data/watches.ts`), document "A3 VERIFIED — no patch needed" in the SUMMARY and proceed to next task with zero edits to this file.

    Step 2B — IF any cast is missing, patch the row mapper to add the missing cast(s) using the pattern from `src/data/catalog.ts:77-83` (mapRowToCatalogEntry — canonical). Each missing field gets `field: row.field !== null ? Number(row.field) : null,`. Add a SUMMARY note "A3 GAP CLOSED — added N missing Number() casts".

    Forbidden: do NOT replace or restructure the existing taste row mapping; only ADD missing casts.
  </action>
  <verify>
    <automated>grep -c "Number(taste\." src/data/watches.ts</automated>
    <automated>grep -E "formality:.*Number\(|sportiness:.*Number\(|heritageScore:.*Number\(|confidence:.*Number\(" src/data/watches.ts | wc -l</automated>
  </verify>
  <acceptance_criteria>
    - `grep -E "formality:.*Number\(|sportiness:.*Number\(|heritageScore:.*Number\(|confidence:.*Number\(" src/data/watches.ts | wc -l` returns ≥ 4 (all four taste-field casts present)
    - SUMMARY contains either "A3 VERIFIED — no patch needed" OR "A3 GAP CLOSED — added N missing Number() casts"
    - `npx tsc --noEmit 2>&1 | grep -c "error TS"` ≤ 27 (Phase 36 baseline preserved)
  </acceptance_criteria>
  <done>
    Numeric-cast verification documented. ReferenceIdentityCard (Plan 39b-02) and lineage rails (Plan 39b-05) can rely on numeric values, not strings, on every Watch returned by `getWatchesByUser`.
  </done>
</task>

<task type="auto">
  <name>Task 5: Create scripts/seed-lineage.ts idempotent operator script</name>
  <files>scripts/seed-lineage.ts</files>
  <read_first>
    - scripts/backfill-catalog-brands.ts (full file — 157 lines — canonical idempotent backfill analog; D-39b-20 contract mirrors this)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-PATTERNS.md §11 (lines 864-988 — full ready-to-copy script with header + TODO block + Pass A + Pass B + summary print + footer)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-CONTEXT.md §Specifics (operator-curation TODO category list at line 188)
    - src/db/schema.ts §watchLineageEdges (lines 462-477 — confirm `lineage_edges_unique_triple` constraint shape for ON CONFLICT)
    - docs/deploy-db-setup.md §34.2 (DATABASE_URL inline-override footgun pattern T-34-04)
  </read_first>
  <action>
    Create `scripts/seed-lineage.ts` verbatim from 39b-PATTERNS.md §11 (lines 870-975). The file MUST:

    1. Open with the header comment block citing:
       - Phase 39b Wave 0 reference (D-39b-08 / D-39b-19)
       - Usage line: `npm run db:seed-lineage`
       - Prod usage line: `DATABASE_URL="<prod pooler URL>" npm run db:seed-lineage`
       - Idempotency contract D-39b-20 (UPDATE WHERE family_id IS NULL; INSERT ON CONFLICT DO NOTHING)
       - T-34-04 / T-39b-02 footgun cross-reference to `docs/deploy-db-setup.md` §34.2

    2. Import `db` from `'../src/db'` (relative path — tsx does not resolve `@/*` aliases per the canonical analog).
       Import `sql` from `'drizzle-orm'`.

    3. Define two TODO-block arrays with the EXACT shape from PATTERNS §11:
       ```typescript
       const FAMILY_ASSIGNMENTS: Array<{ catalogId: string; familyId: string; brand: string; model: string }> = [
         // operator authors ~20 entries here
       ]
       const LINEAGE_EDGES: Array<{
         predecessorCatalogId: string
         successorCatalogId: string
         relationshipType: 'predecessor' | 'successor' | 'remake' | 'tribute' | 'homage'
         note?: string
       }> = [
         // operator authors ~15 entries here
       ]
       ```
       Above the arrays, include an extended TODO block comment listing the category guidance from 39b-CONTEXT.md §Specifics:
       - Submariner / Sea-Dweller / GMT family
       - Speedmaster Moonwatch family
       - Royal Oak family
       - Submariner homages (Tudor BB, Squale, Christopher Ward C60)
       - Speedy chain (Sinn 103, etc.)

    4. Implement `passA_assignFamilies()` exactly as in PATTERNS §11 (lines 910-932):
       - `UPDATE watches_catalog SET family_id = ${entry.familyId}::uuid, updated_at = NOW() WHERE id = ${entry.catalogId}::uuid AND family_id IS NULL RETURNING id AS updated_id`
       - Count patched (updated > 0) vs skipped (updated === 0) per row
       - Returns `{ patched: number, skipped: number }`

    5. Implement `passB_insertLineageEdges()` exactly as in PATTERNS §11 (lines 934-960):
       - `INSERT INTO watch_lineage_edges (predecessor_catalog_id, successor_catalog_id, relationship_type) VALUES (${pred}::uuid, ${succ}::uuid, ${rel}::lineage_relationship_type) ON CONFLICT (predecessor_catalog_id, successor_catalog_id, relationship_type) DO NOTHING RETURNING id`
       - Count inserted vs skipped per row
       - Returns `{ inserted: number, skipped: number }`

    6. `main()` calls `passA` then `passB`, prints a summary in this EXACT format (load-bearing for the operator UAT idempotency check):
       ```
       [seed-lineage] OK — family_patched=N family_skipped=M edges_inserted=P edges_skipped=Q elapsedMs=T
       ```
       `process.exit(0)` on success, `process.exit(1)` on fatal in `main().catch(...)`.

    Forbidden:
    - Do NOT use `@/db` alias (tsx will fail at runtime).
    - Do NOT embed any DATABASE_URL string — operator supplies via env-file or inline override.
    - Do NOT add `ON CONFLICT` to Pass A (Pass A uses `WHERE family_id IS NULL` for idempotency — D-39b-20).
    - Do NOT overwrite an already-assigned family_id.
  </action>
  <verify>
    <automated>test -f scripts/seed-lineage.ts && echo "file exists"</automated>
    <automated>grep -c "WHERE id = .*AND family_id IS NULL" scripts/seed-lineage.ts</automated>
    <automated>grep -c "ON CONFLICT (predecessor_catalog_id, successor_catalog_id, relationship_type)" scripts/seed-lineage.ts</automated>
    <automated>grep -c "DO NOTHING" scripts/seed-lineage.ts</automated>
    <automated>grep "from '../src/db'" scripts/seed-lineage.ts</automated>
    <automated>npx tsc --noEmit scripts/seed-lineage.ts 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `test -f scripts/seed-lineage.ts` exits 0
    - `grep -c "WHERE id = .*AND family_id IS NULL" scripts/seed-lineage.ts` returns ≥ 1 (Pass A idempotency)
    - `grep "ON CONFLICT (predecessor_catalog_id, successor_catalog_id, relationship_type)" scripts/seed-lineage.ts` returns ≥ 1 line (Pass B idempotency)
    - `grep "DO NOTHING" scripts/seed-lineage.ts` returns ≥ 1 line
    - `grep "from '../src/db'" scripts/seed-lineage.ts` returns 1 line (relative import — tsx alias-resolution constraint)
    - `grep -E "family_patched=\\\$\{" scripts/seed-lineage.ts` OR `grep "family_patched=" scripts/seed-lineage.ts` returns ≥ 1 line (summary print template)
    - `grep "T-34-04\|T-39b-02" scripts/seed-lineage.ts` returns ≥ 1 line (footgun cross-reference)
    - tsc clean for this file: `npx tsc --noEmit scripts/seed-lineage.ts 2>&1 | grep -c "error TS"` returns 0
  </acceptance_criteria>
  <done>
    `scripts/seed-lineage.ts` ships with idempotent 2-pass structure. Operator can run unfilled (zero-array TODO block) without error — passes print `family_patched=0 family_skipped=0 edges_inserted=0 edges_skipped=0`.
  </done>
</task>

<task type="auto">
  <name>Task 6: Add db:seed-lineage npm script entry</name>
  <files>package.json</files>
  <read_first>
    - package.json (lines 1-30 — scripts block; verify existing `tsx --env-file=.env.local` pattern)
  </read_first>
  <action>
    Add one entry to the `scripts` object in `package.json`, after the existing `db:backfill-catalog-lineage` line (verified at package.json:19):

    ```json
    "db:seed-lineage": "tsx --env-file=.env.local scripts/seed-lineage.ts",
    ```

    Preserve JSON syntax — ensure preceding line ends with comma, following line starts cleanly. Indentation must match siblings (2 spaces).

    Forbidden: do NOT remove or reorder any existing script entry; do NOT change the existing `tsx --env-file=.env.local` convention.
  </action>
  <verify>
    <automated>grep -c '"db:seed-lineage":' package.json</automated>
    <automated>node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))" && echo "JSON parses"</automated>
  </verify>
  <acceptance_criteria>
    - `grep '"db:seed-lineage": "tsx --env-file=.env.local scripts/seed-lineage.ts"' package.json` returns 1 line
    - `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"` exits 0 (JSON syntax valid)
    - `npm run db:seed-lineage 2>&1 | head -5` (smoke test against LOCAL env, empty TODO arrays) exits 0 OR prints the summary line containing `family_patched=0 family_skipped=0 edges_inserted=0 edges_skipped=0`
  </acceptance_criteria>
  <done>
    `npm run db:seed-lineage` is the canonical command operators run. Local smoke (empty arrays) confirms wiring.
  </done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 7: Operator commits ~20 family_id seeds + ~15 lineage edges to prod DB</name>
  <files>scripts/seed-lineage.ts (operator edits TODO arrays)</files>
  <read_first>
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-CONTEXT.md D-39b-18..D-39b-20
    - docs/deploy-db-setup.md §34.2 (DATABASE_URL inline-override pattern — T-34-04 footgun mitigation)
    - scripts/seed-lineage.ts (the operator-authored TODO block they will fill)
  </read_first>
  <what-built>
    Phase 39b Wave 0 has shipped the idempotent operator-curation seed script (`scripts/seed-lineage.ts`), the `npm run db:seed-lineage` package entry, the `getLineageForReference` CTE extension to surface `imageUrl`, the `WearEventLite.note` interface extension, and the `getWatchesByUser` numeric-cast verification. The static guard (`tests/static/hierarchy.lineage-3-node.test.ts`) is updated with three new assertions; two pass green, one is intentionally RED until Plan 39b-05 lands.

    What's outstanding: the prod-DB curation data itself. Wave 1 UI plans (39b-02..05) verify hide-if-empty branches against REAL sparse prod data (D-39b-19) — they require this operator commit before they ship.
  </what-built>
  <how-to-verify>
    Operator runs the following commands locally:

    1. Edit `scripts/seed-lineage.ts` TODO block:
       - Populate `FAMILY_ASSIGNMENTS` with ~20 entries: `{ catalogId, familyId, brand, model }`. Family categories from D-39b-18: Submariner / Sea-Dweller / GMT family; Speedmaster Moonwatch family; Royal Oak family; Submariner homages (Tudor BB, Squale, Christopher Ward C60); Speedy chain (Sinn 103, etc.).
       - Populate `LINEAGE_EDGES` with ~15 entries: `{ predecessorCatalogId, successorCatalogId, relationshipType, note? }`. Use catalog UUIDs from `watches_catalog` (query prod DB to read them).
       - Commit the seed list to git with message `chore(39b-01): operator-authored seed list (~20 families + ~15 edges)`.

    2. Smoke against LOCAL Docker DB first (default `.env.local`):
       - Run: `npm run db:seed-lineage`
       - Expected output line: `[seed-lineage] OK — family_patched=N family_skipped=0 edges_inserted=M edges_skipped=0 elapsedMs=...` where N ≤ 20, M ≤ 15.
       - Re-run the same command. Expected output line: `[seed-lineage] OK — family_patched=0 family_skipped=N edges_inserted=0 edges_skipped=M elapsedMs=...` (idempotency proof; second run is a no-op).
       - If second run shows any non-zero `family_patched` or `edges_inserted`, STOP and surface the bug to Claude.

    3. Prod run (T-34-04 / T-39b-02 mitigation — inline DATABASE_URL override; do NOT rely on `.env.local`):
       ```
       DATABASE_URL="postgresql://<prod-session-mode-pooler-url>" npm run db:seed-lineage
       ```
       Expected: same `family_patched=N family_skipped=0 edges_inserted=M edges_skipped=0` shape, against prod data.

    4. Re-run prod with the same inline override. Expected: `family_patched=0 family_skipped=N edges_inserted=0 edges_skipped=M` (prod idempotency proof).

    5. Spot-check in Supabase Studio (prod):
       - `SELECT COUNT(*) FROM watches_catalog WHERE family_id IS NOT NULL;` — confirm count increased by N.
       - `SELECT COUNT(*) FROM watch_lineage_edges;` — confirm count increased by M.
       - `SELECT brand, model, family_id FROM watches_catalog WHERE family_id IS NOT NULL LIMIT 5;` — confirm rows look right.

    6. Type "approved" when done, or describe what failed.
  </how-to-verify>
  <action>
    BLOCKING checkpoint. Wave 1 plans (39b-02, 39b-03, 39b-04, 39b-05) cannot ship without this completing successfully (D-39b-19).

    On "approved": amend the Wave 0 SUMMARY with:
    - Pre-run counts (`watches_catalog.family_id IS NOT NULL` row count + `watch_lineage_edges` row count from prod, captured before Step 3)
    - Post-run counts (same queries, after Step 3)
    - Post-rerun counts (after Step 4)
    - Output of second prod run (proving `family_patched=0 edges_inserted=0` idempotency)
    - Sample of 3 family_id assignments + 3 lineage edges (brand/model pairs for human-readable verification)
  </action>
  <resume-signal>Type "approved" or describe issues</resume-signal>
  <verify>
    Manual — operator-driven. No automated verify (D-39b-19 explicitly autonomous: false). Wave 1 plans depend on this signal.
  </verify>
  <acceptance_criteria>
    - Operator types "approved" in the resume signal
    - SUMMARY contains pre-run + post-run + post-rerun row counts from prod
    - SUMMARY contains the literal output line from the second prod run with `family_patched=0 edges_inserted=0` (idempotency proof)
    - Wave 1 plans 39b-02..05 can now proceed with hide-if-empty verification against real sparse data
  </acceptance_criteria>
  <done>
    Operator has committed ~20 family_id seeds and ~15 lineage edges to prod DB. Idempotency proven via re-run. Wave 1 unblocked.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Operator CLI → prod DB | scripts/seed-lineage.ts writes to prod tables via service-role pooler URL; T-34-04 inheritance applies (wrong-DB write is silent if .env.local is read instead of operator's inline override) |
| Drizzle ORM ↔ Postgres | Parameterized SQL via `sql` template tag; UUID + enum casts validate at the DB layer |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-39b-02 | Information Disclosure | scripts/seed-lineage.ts | mitigate | Header comment cross-references `docs/deploy-db-setup.md` §34.2 T-34-04 footgun; usage docs require inline `DATABASE_URL="<prod pooler URL>" npm run db:seed-lineage`; idempotency contract D-39b-20 (UPDATE WHERE family_id IS NULL + INSERT ON CONFLICT DO NOTHING) makes a wrong-DB write recoverable via re-run on the right DB; operator UAT requires second-run idempotency confirmation before "approved" |
| T-39b-05 | Information Disclosure (low) | watch_lineage_edges | accept | watches_catalog refs are all public; no per-row privacy on this table; operator-curation does not introduce a new privacy surface |
</threat_model>

<verification>
After all 7 tasks: run `npm test` and confirm no NEW failures (one intentional RED on the `getSameFamilyForCatalog` static assertion is expected; closes in Plan 39b-05). Verify `npx tsc --noEmit 2>&1 | grep -c "error TS"` ≤ 27 (Phase 36 baseline).

Wave 1 readiness gate: `psql $DATABASE_URL -c "SELECT COUNT(*) FROM watches_catalog WHERE family_id IS NOT NULL"` returns N ≥ 15; `psql $DATABASE_URL -c "SELECT COUNT(*) FROM watch_lineage_edges"` returns M ≥ 10. (Operator targets ~20 / ~15 but Wave 1 needs at least sparse non-zero data to verify hide-if-empty branches.)
</verification>

<success_criteria>
- `getLineageForReference(catalogId)` returns `imageUrl: string | null` on every row (interface + CTE patched in both arms)
- `WearEventLite` interface in WornCalendar exposes `note` (or aligned analog field name) — UI plan 39b-03 wear-detail panel can read it
- `getWatchesByUser` numeric-cast verified (A3) — taste fields cast via `Number()` on all 4 dimensions
- `scripts/seed-lineage.ts` ships with idempotent 2-pass structure, prints the load-bearing summary line shape
- `npm run db:seed-lineage` is wired in package.json
- Operator has committed ~20 family_id seeds + ~15 lineage edges to prod DB (D-39b-19)
- Re-running the seed script produces `family_patched=0 edges_inserted=0` (idempotency proof — T-39b-02 mitigation)
- Static guard updated; two new assertions green, one intentional RED that closes in Plan 39b-05
</success_criteria>

<output>
After completion, create `.planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-01-SUMMARY.md` with:
- Wave 0 task-by-task outcome
- A3 verification result (VERIFIED no patch / GAP CLOSED with N patches)
- Pre-run + post-run + post-rerun prod DB row counts (proves D-39b-19 + T-39b-02 mitigation)
- Sample of 3 family_id assignments + 3 lineage edges (brand/model for human-readable confirmation)
- The intentional RED test name that closes in Plan 39b-05
- Note any deviation from CONTEXT decisions D-39b-08, D-39b-18, D-39b-19, D-39b-20
</output>
