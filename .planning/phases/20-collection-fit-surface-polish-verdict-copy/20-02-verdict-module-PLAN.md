---
phase: 20
plan: 02
type: execute
wave: 2
depends_on: ["20-01"]
files_modified:
  - src/lib/verdict/templates.ts
  - src/lib/verdict/composer.ts
  - src/lib/verdict/viewerTasteProfile.ts
  - src/lib/verdict/shims.ts
  - src/lib/verdict/composer.test.ts
  - src/lib/verdict/viewerTasteProfile.test.ts
  - src/lib/verdict/shims.test.ts
  - src/lib/verdict/confidence.test.ts
autonomous: true
requirements: [FIT-02]

must_haves:
  truths:
    - "A pure deterministic composer produces VerdictBundle from (SimilarityResult, ViewerTasteProfile, Watch, CatalogTasteSnapshot)"
    - "All 4 roadmap-example phrasings (D-01) fire under their respective predicate-applicable inputs"
    - "Phase 19.1 D-14 confidence gate enforces (null → fallback; <0.5 → fallback; 0.5–0.7 → hedged; ≥0.7 → full contextual)"
    - "computeViewerTasteProfile is null-tolerant — collection of all-NULL taste rows produces EMPTY_PROFILE without NaN"
    - "catalogEntryToSimilarityInput preserves engine inputs verbatim (round-trip property holds)"
    - "analyzeSimilarity body remains BYTE-IDENTICAL — verified by static text-scan against pre-phase hash (D-09 lock)"
  artifacts:
    - path: "src/lib/verdict/templates.ts"
      provides: "TEMPLATES array with 12 entries (4 roadmap + 8 supporting)"
      exports: ["TEMPLATES", "HEADLINE_FOR_LABEL", "DESCRIPTION_FOR_LABEL"]
      contains: "fills-a-hole"
    - path: "src/lib/verdict/composer.ts"
      provides: "computeVerdictBundle(args) entry point + fillTemplate helper"
      exports: ["computeVerdictBundle"]
      contains: "import 'server-only'"
    - path: "src/lib/verdict/viewerTasteProfile.ts"
      provides: "computeViewerTasteProfile(collection) DAL-backed pure function + EMPTY_PROFILE constant"
      exports: ["computeViewerTasteProfile", "EMPTY_PROFILE"]
      contains: "import 'server-only'"
    - path: "src/lib/verdict/shims.ts"
      provides: "catalogEntryToSimilarityInput shim (CatalogEntry → Watch)"
      exports: ["catalogEntryToSimilarityInput"]
    - path: "src/lib/verdict/composer.test.ts"
      provides: "Composer determinism + 4 roadmap example assertions + confidence gate tests"
      contains: "fills-a-hole"
    - path: "src/lib/verdict/viewerTasteProfile.test.ts"
      provides: "Null-tolerance + mode/mean/topK tests"
      contains: "EMPTY_PROFILE"
    - path: "src/lib/verdict/shims.test.ts"
      provides: "Round-trip + closed-union coercion tests"
      contains: "catalogEntryToSimilarityInput"
    - path: "src/lib/verdict/confidence.test.ts"
      provides: "Phase 19.1 D-14 threshold tests (null/<0.5/0.5–0.7/≥0.7)"
      contains: "confidence"
  key_links:
    - from: "src/lib/verdict/composer.ts"
      to: "src/lib/similarity.ts"
      via: "analyzeSimilarity import"
      pattern: "from '@/lib/similarity'"
    - from: "src/lib/verdict/composer.ts"
      to: "src/lib/verdict/types.ts"
      via: "VerdictBundle / Framing import"
      pattern: "from '@/lib/verdict/types'"
    - from: "src/lib/verdict/viewerTasteProfile.ts"
      to: "src/db/schema (watches_catalog)"
      via: "Drizzle inner join on watches.catalogId"
      pattern: "watchesCatalog"
    - from: "src/lib/verdict/shims.ts"
      to: "src/lib/types (Watch, CatalogEntry)"
      via: "type-only import + runtime mapping"
      pattern: "catalogEntryToSimilarityInput"
---

<objective>
Build the Phase 20 verdict module: deterministic template-library composer (D-01), null-tolerant viewer aggregate taste profile (D-02), and the `CatalogEntry → Watch` caller shim (D-09 byte-lock preserved). Implements FIT-02 (richer contextual phrasings) at the substrate level — surfaces are wired in Plans 04–06.

Purpose: Single source of truth for verdict copy. Card stays a pure renderer (D-04 enforced by static text-scan from Plan 01). Engine stays byte-identical (D-09). Each shim/composer/aggregate function is independently testable and contains zero runtime knowledge of the rendering surfaces.

Output:
- `src/lib/verdict/templates.ts` — 12 curated templates (4 roadmap + 8 supporting).
- `src/lib/verdict/composer.ts` — `computeVerdictBundle(args): VerdictBundle` entry point with the Pitfall 4 confidence gate.
- `src/lib/verdict/viewerTasteProfile.ts` — Drizzle JOIN-based `computeViewerTasteProfile(collection)` with `EMPTY_PROFILE` and confidence floor.
- `src/lib/verdict/shims.ts` — `catalogEntryToSimilarityInput(entry): Watch` mapper.
- 4 test files filled in (replacing `it.todo` from Plan 01).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/20-collection-fit-surface-polish-verdict-copy/20-CONTEXT.md
@.planning/phases/20-collection-fit-surface-polish-verdict-copy/20-RESEARCH.md
@.planning/phases/20-collection-fit-surface-polish-verdict-copy/20-UI-SPEC.md
@.planning/phases/19.1-catalog-taste-enrichment/19.1-CONTEXT.md
@.planning/phases/20-collection-fit-surface-polish-verdict-copy/20-01-SUMMARY.md

<interfaces>
<!-- Types this plan builds against. From src/lib/verdict/types.ts (Plan 01) -->

```typescript
// Plan 01 exports (from src/lib/verdict/types.ts):
export type Framing = 'same-user' | 'cross-user' | 'self-via-cross-user'
export interface VerdictMostSimilar { watch: Watch; score: number }
export interface VerdictBundleFull {
  framing: 'same-user' | 'cross-user'
  label: SimilarityLabel
  headlinePhrasing: string
  contextualPhrasings: string[]
  mostSimilar: VerdictMostSimilar[]
  roleOverlap: boolean
}
export interface VerdictBundleSelfOwned {
  framing: 'self-via-cross-user'
  ownedAtIso: string
  ownerHref: string
}
export type VerdictBundle = VerdictBundleFull | VerdictBundleSelfOwned
export interface ViewerTasteProfile {
  meanFormality: number | null
  meanSportiness: number | null
  meanHeritageScore: number | null
  dominantArchetype: PrimaryArchetype | null
  dominantEraSignal: EraSignal | null
  topDesignMotifs: string[]
}
export interface CandidateTasteSnapshot {
  primaryArchetype: PrimaryArchetype | null
  heritageScore: number | null
  formality: number | null
  sportiness: number | null
  confidence: number | null
}
export interface Template {
  id: string
  predicate: (result, profile, candidate, candidateTaste) => Record<string,string> | null
  template: string
}
```

```typescript
// Existing src/lib/similarity.ts (BYTE-LOCKED per D-09):
export function analyzeSimilarity(
  targetWatch: Watch,
  collection: Watch[],
  preferences: UserPreferences,
): SimilarityResult

export function getSimilarityLabelDisplay(label: SimilarityLabel): {
  text: string
  description: string
}
```

```typescript
// Existing src/db/schema (Drizzle):
import { watches, watchesCatalog } from '@/db/schema'
// watches has watches.catalogId (uuid, nullable, FK to watches_catalog.id)
// watchesCatalog has formality, sportiness, heritageScore, primaryArchetype,
// eraSignal, designMotifs, confidence (Phase 19.1 columns)
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Implement viewerTasteProfile.ts with confidence floor + null-tolerance + tests</name>
  <files>src/lib/verdict/viewerTasteProfile.ts, src/lib/verdict/viewerTasteProfile.test.ts</files>
  <read_first>
    - src/lib/verdict/types.ts (entire file from Plan 01) — imports `ViewerTasteProfile`, `PrimaryArchetype`, `EraSignal`
    - src/db/schema (the watchesCatalog and watches table definitions) — confirm column names: `formality`, `sportiness`, `heritage_score`, `primary_archetype`, `era_signal`, `design_motifs`, `confidence` (Drizzle camelCase mapping). Search via Grep on `src/db/schema/` for `watchesCatalog`.
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-RESEARCH.md § "Code Examples" Example 3 (full reference implementation)
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-RESEARCH.md § "Common Pitfalls" Pitfall 2 (null-tolerance) + Pitfall 4 (confidence floor on aggregate inputs)
    - src/data/catalog.ts (lines 240-250 `getCatalogById` — pattern for db.select + drizzle eq)
    - tests/setup.ts (test setup conventions)
  </read_first>
  <behavior>
    - `computeViewerTasteProfile([])` returns `EMPTY_PROFILE` (all numeric fields null, dominantArchetype null, dominantEraSignal null, topDesignMotifs []).
    - `computeViewerTasteProfile([w1, w2])` where neither watch has a catalogId → returns `EMPTY_PROFILE` (inner-join eliminates rows).
    - When the JOIN returns rows where `confidence < 0.5`, those rows are excluded from the aggregate (SQL WHERE clause filters).
    - When all returned rows have `formality = null`, `meanFormality` is `null` (not `0`, not `NaN`).
    - When 2 rows have formality 0.6 and 0.8 and a third has null, `meanFormality` is `0.7` (filter nulls then average).
    - `mode([])` returns `null`; `mode(['dive', 'dive', 'dress'])` returns `'dive'`.
    - `topK([], 3)` returns `[]`; `topK(['a','b','a','c','a','b'], 2)` returns `['a','b']` (insertion-order tiebreak).
  </behavior>
  <action>
**File 1: `src/lib/verdict/viewerTasteProfile.ts`**

Implement EXACTLY this contract:

```typescript
import 'server-only'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/db'
import { watches, watchesCatalog } from '@/db/schema'
import type { Watch } from '@/lib/types'
import type { ViewerTasteProfile, PrimaryArchetype, EraSignal } from '@/lib/verdict/types'

/**
 * D-02 + Pitfall 4: catalog rows with confidence < 0.5 are too noisy to count
 * toward dominant-style detection. The aggregate excludes them; the per-candidate
 * confidence gate (Pitfall 4) is enforced separately in composer.ts.
 */
const CONFIDENCE_FLOOR = 0.5

export const EMPTY_PROFILE: ViewerTasteProfile = {
  meanFormality: null,
  meanSportiness: null,
  meanHeritageScore: null,
  dominantArchetype: null,
  dominantEraSignal: null,
  topDesignMotifs: [],
}

/**
 * Phase 20 D-02: viewer collection's aggregate taste profile.
 * Pure function (per-render); null-tolerant; O(N) over collection size.
 *
 * SQL: INNER JOIN watches → watches_catalog by catalogId, filtered by
 * watchIds and confidence ≥ 0.5. Watches without a catalogId are skipped
 * entirely (inner join eliminates them).
 */
export async function computeViewerTasteProfile(
  collection: Watch[],
): Promise<ViewerTasteProfile> {
  if (collection.length === 0) return EMPTY_PROFILE

  const watchIds = collection.map((w) => w.id)
  const rows = await db
    .select({
      formality: watchesCatalog.formality,
      sportiness: watchesCatalog.sportiness,
      heritageScore: watchesCatalog.heritageScore,
      primaryArchetype: watchesCatalog.primaryArchetype,
      eraSignal: watchesCatalog.eraSignal,
      designMotifs: watchesCatalog.designMotifs,
    })
    .from(watches)
    .innerJoin(watchesCatalog, eq(watchesCatalog.id, watches.catalogId))
    .where(and(
      inArray(watches.id, watchIds),
      sql`${watchesCatalog.confidence} >= ${CONFIDENCE_FLOOR}`,
    ))

  if (rows.length === 0) return EMPTY_PROFILE

  const numbersOf = <K extends keyof typeof rows[number]>(k: K): number[] =>
    rows
      .map((r) => r[k] as unknown as number | null)
      .filter((x): x is number => x !== null)
      .map((x) => Number(x))

  const formalities = numbersOf('formality')
  const sportinesses = numbersOf('sportiness')
  const heritages = numbersOf('heritageScore')

  return {
    meanFormality: avg(formalities),
    meanSportiness: avg(sportinesses),
    meanHeritageScore: avg(heritages),
    dominantArchetype: mode<PrimaryArchetype>(
      rows.map((r) => r.primaryArchetype).filter((x): x is PrimaryArchetype => x !== null),
    ),
    dominantEraSignal: mode<EraSignal>(
      rows.map((r) => r.eraSignal).filter((x): x is EraSignal => x !== null),
    ),
    topDesignMotifs: topK(rows.flatMap((r) => r.designMotifs ?? []), 3),
  }
}

function avg(arr: number[]): number | null {
  if (arr.length === 0) return null
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function mode<T>(arr: T[]): T | null {
  if (arr.length === 0) return null
  const counts = new Map<T, number>()
  for (const x of arr) counts.set(x, (counts.get(x) ?? 0) + 1)
  let best: T | null = null
  let bestN = 0
  for (const [k, n] of counts) {
    if (n > bestN) {
      best = k
      bestN = n
    }
  }
  return best
}

function topK(arr: string[], k: number): string[] {
  if (arr.length === 0) return []
  const counts = new Map<string, number>()
  for (const x of arr) counts.set(x, (counts.get(x) ?? 0) + 1)
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([s]) => s)
}
```

**File 2: `src/lib/verdict/viewerTasteProfile.test.ts`** — REPLACE the Plan 01 it.todo scaffold with real tests. Use `vi.mock('@/db', ...)` to fake the Drizzle query builder. The test exercises the pure logic, not the DB. Pattern from `tests/data/catalog.test.ts` if present, else hand-roll the mock chain.

Tests required (replace ALL 8 `it.todo` from Plan 01):
1. `returns EMPTY_PROFILE when collection has zero watches` — call `computeViewerTasteProfile([])`, assert deep-equal `EMPTY_PROFILE`. No DB call (verified by mock spy).
2. `skips catalog rows with confidence < 0.5` — mock returns row with confidence 0.4; expect this row excluded (assert via WHERE filter — easier: mock returns ONLY rows where confidence ≥ 0.5; test confirms inputs threading).
3. `mean of all-NULL formality column returns null` — mock returns 3 rows with `formality: null`; expect `meanFormality: null`.
4. `mode of all-NULL primaryArchetype column returns null` — mock returns 3 rows with `primaryArchetype: null`; expect `dominantArchetype: null`.
5. `topDesignMotifs returns [] when all designMotifs arrays are empty` — mock returns rows with `designMotifs: []`; expect `topDesignMotifs: []`.
6. `topDesignMotifs returns top-3 by frequency, ties broken by insertion order` — mock returns rows with `designMotifs: [['onyx-dial'], ['onyx-dial', 'fluted-bezel'], ['onyx-dial', 'jubilee-bracelet'], ['fluted-bezel'], ['jubilee-bracelet']]` → expect `['onyx-dial', 'fluted-bezel', 'jubilee-bracelet']` (counts 3,2,2; tiebreak by first-seen).
7. `mean of mixed null + numeric column averages only the non-null entries` — formality values [0.6, null, 0.8] → expect 0.7.
8. `handles a 0-watch collection without throwing` — same as test 1 but explicit assertion that no throw occurs.

For mocking strategy use:
```typescript
import { vi } from 'vitest'
vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => ({ from: vi.fn(() => ({ innerJoin: vi.fn(() => ({ where: vi.fn().mockResolvedValue(MOCK_ROWS) })) })) })),
  },
}))
```
Set `MOCK_ROWS` per test via `vi.mocked(db.select).mockReturnValueOnce(...)` or by re-mocking `db` per test.

Drizzle 'server-only' module is aliased in vitest.config.ts (`tests/shims/server-only.ts`), so the `import 'server-only'` line works under tests.
  </action>
  <verify>
    <automated>npx vitest run src/lib/verdict/viewerTasteProfile --reporter=basic</automated>
  </verify>
  <acceptance_criteria>
    - `test -f src/lib/verdict/viewerTasteProfile.ts` exits 0
    - `grep "import 'server-only'" src/lib/verdict/viewerTasteProfile.ts` exits 0 (Pitfall 1 — server-only)
    - `grep "const CONFIDENCE_FLOOR = 0.5" src/lib/verdict/viewerTasteProfile.ts` exits 0
    - `grep "export const EMPTY_PROFILE" src/lib/verdict/viewerTasteProfile.ts` exits 0
    - `grep "export async function computeViewerTasteProfile" src/lib/verdict/viewerTasteProfile.ts` exits 0
    - `grep "innerJoin" src/lib/verdict/viewerTasteProfile.ts` exits 0 (correct join — inner, not left)
    - `grep -c "it\.todo" src/lib/verdict/viewerTasteProfile.test.ts` returns 0 (all todos replaced)
    - `grep -cE "^\s*it\(" src/lib/verdict/viewerTasteProfile.test.ts` returns 8 (8 real tests)
    - `npx vitest run src/lib/verdict/viewerTasteProfile --reporter=basic` exits 0 (8 passing)
  </acceptance_criteria>
  <done>computeViewerTasteProfile is implemented with confidence floor + null-tolerance; 8 tests pass; analyzeSimilarity untouched.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement shims.ts (catalogEntryToSimilarityInput) + round-trip tests</name>
  <files>src/lib/verdict/shims.ts, src/lib/verdict/shims.test.ts</files>
  <read_first>
    - src/lib/types.ts (lines 1-160) — `Watch`, `CatalogEntry`, `MovementType`, `CrystalType`, `WatchStatus` definitions
    - src/lib/similarity.ts (lines 220-235) — confirm engine behaviour at line 225 (`otherWatches.filter` for status owned/grail) per Pitfall 7 — comment must reference this line number
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-RESEARCH.md § "Architecture Patterns" Pattern 2 (full shim reference) + § "Common Pitfalls" Pitfall 7 (status comment requirement)
  </read_first>
  <behavior>
    - Round-trip property: `analyzeSimilarity(catalogEntryToSimilarityInput(entry), collection, prefs)` produces the SAME `SimilarityResult` as `analyzeSimilarity(realWatch, collection, prefs)` when realWatch has identical fields to entry.
    - Unknown movement string → coerced to `'other'`.
    - Unknown crystalType → coerced to `undefined`.
    - All array fields preserved verbatim.
    - candidate.status === 'wishlist' (synthetic — Pitfall 7).
    - id field threads catalog UUID — does not collide with collection ids.
  </behavior>
  <action>
**File 1: `src/lib/verdict/shims.ts`**

```typescript
import type { Watch, CatalogEntry, WatchStatus, MovementType, CrystalType } from '@/lib/types'

/**
 * Phase 20 D-09: caller shim at the engine boundary.
 * Converts a catalog row (CatalogEntry) into a Watch-shape so analyzeSimilarity
 * can score it as the candidate, without touching the engine body (D-09 byte-lock).
 *
 * Pitfall 7: candidate.status='wishlist' is synthetic. The engine at
 * src/lib/similarity.ts:225 filters the *collection* to status owned/grail —
 * the candidate's status is never read by scoring. 'wishlist' is chosen as a
 * neutral "being evaluated, not owned" sentinel.
 *
 * Assumption A1: catalog UUID and per-user watches.id never collide
 * (Postgres gen_random_uuid()).
 */
const STATUS_FOR_CANDIDATE: WatchStatus = 'wishlist'

const KNOWN_MOVEMENTS: ReadonlySet<MovementType> = new Set([
  'automatic', 'manual', 'quartz', 'spring-drive', 'other',
])
const KNOWN_CRYSTALS: ReadonlySet<CrystalType> = new Set([
  'sapphire', 'mineral', 'acrylic', 'hesalite', 'hardlex',
])

function coerceMovement(m: string | null): MovementType {
  if (m === null) return 'other'
  return KNOWN_MOVEMENTS.has(m as MovementType) ? (m as MovementType) : 'other'
}

function coerceCrystal(c: string | null): CrystalType | undefined {
  if (c === null) return undefined
  return KNOWN_CRYSTALS.has(c as CrystalType) ? (c as CrystalType) : undefined
}

export function catalogEntryToSimilarityInput(entry: CatalogEntry): Watch {
  return {
    id: entry.id,                    // catalog UUID — A1 collision-safe
    brand: entry.brand,
    model: entry.model,
    reference: entry.reference ?? undefined,
    status: STATUS_FOR_CANDIDATE,    // Pitfall 7 — see header comment
    movement: coerceMovement(entry.movement),
    complications: entry.complications,
    caseSizeMm: entry.caseSizeMm ?? undefined,
    lugToLugMm: entry.lugToLugMm ?? undefined,
    waterResistanceM: entry.waterResistanceM ?? undefined,
    crystalType: coerceCrystal(entry.crystalType),
    dialColor: entry.dialColor ?? undefined,
    styleTags: entry.styleTags,
    designTraits: entry.designTraits,
    roleTags: entry.roleTags,
    isChronometer: entry.isChronometer ?? undefined,
    productionYear: entry.productionYear ?? undefined,
    imageUrl: entry.imageUrl ?? undefined,
  }
}
```

**File 2: `src/lib/verdict/shims.test.ts`** — REPLACE Plan 01 todos with real tests:

1. `round-trip preserves engine result` — build a fixture `CatalogEntry` with full data; build a parallel `Watch` with identical fields; assert `analyzeSimilarity(shim(entry), [], defaultPrefs)` deep-equals `analyzeSimilarity(realWatch, [], defaultPrefs)`. (Use a small collection of 2-3 watches to actually exercise the engine.)
2. `coerces unknown movement string to "other"` — entry.movement = 'rotor-driven' → shim'd Watch.movement === 'other'.
3. `coerces unknown crystalType to undefined` — entry.crystalType = 'titanium-glass' → shim'd Watch.crystalType === undefined.
4. `preserves arrays verbatim` — entry.styleTags=['dressy','tool'] → Watch.styleTags=['dressy','tool'] (same elements; reference identity not required).
5. `candidate.status is "wishlist" (Pitfall 7)` — assert `shim(entry).status === 'wishlist'`.
6. `id field threads catalog UUID` — entry.id='catalog-uuid-xyz' → Watch.id==='catalog-uuid-xyz'.

Use a fixture `buildCatalogEntry(overrides?)` helper local to the test file to avoid repetition.
  </action>
  <verify>
    <automated>npx vitest run src/lib/verdict/shims --reporter=basic</automated>
  </verify>
  <acceptance_criteria>
    - `test -f src/lib/verdict/shims.ts` exits 0
    - `grep "export function catalogEntryToSimilarityInput" src/lib/verdict/shims.ts` exits 0
    - `grep "const STATUS_FOR_CANDIDATE: WatchStatus = 'wishlist'" src/lib/verdict/shims.ts` exits 0 (Pitfall 7 explicit)
    - `grep "src/lib/similarity.ts:225" src/lib/verdict/shims.ts` exits 0 (Pitfall 7 comment cites engine line)
    - `grep "import 'server-only'" src/lib/verdict/shims.ts` exits 1 (NOT server-only — shim is pure; can be used client-side via the Watch type which itself is shared)
    - `grep -c "it\.todo" src/lib/verdict/shims.test.ts` returns 0
    - `grep -cE "^\s*it\(" src/lib/verdict/shims.test.ts` returns 6
    - `npx vitest run src/lib/verdict/shims --reporter=basic` exits 0 (6 passing)
  </acceptance_criteria>
  <done>Shim implemented with closed-union coercion + Pitfall 7 documentation; 6 tests pass; engine untouched.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Implement templates.ts + composer.ts (composeVerdictBundle) + composer/confidence tests</name>
  <files>src/lib/verdict/templates.ts, src/lib/verdict/composer.ts, src/lib/verdict/composer.test.ts, src/lib/verdict/confidence.test.ts</files>
  <read_first>
    - src/lib/verdict/types.ts (Plan 01) — `VerdictBundle`, `VerdictBundleFull`, `Framing`, `Template`, `CandidateTasteSnapshot`, `ViewerTasteProfile`
    - src/lib/similarity.ts (entire file) — `analyzeSimilarity` signature + `getSimilarityLabelDisplay` returns `{text, description}` for each of 6 labels (lines 343-382)
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-CONTEXT.md § Implementation Decisions D-01 (template library is single source of truth for FIT-02; 4 roadmap examples mandatory)
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-RESEARCH.md § "Code Examples" Example 1 (template shape + 4 roadmap examples) + Example 2 (composer entry point) + § Common Pitfalls Pitfall 4 (confidence gate)
    - .planning/phases/19.1-catalog-taste-enrichment/19.1-CONTEXT.md (whole file — D-14 confidence gate semantics: null/<0.5/0.5–0.7/≥0.7)
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-UI-SPEC.md § Copywriting Contract (verbatim copy for hedged-prefix "Possibly ", confidence-fallback fixed-label descriptions)
  </read_first>
  <behavior>
    - 4 roadmap-example templates fire for their canonical test fixtures: `fills-a-hole`, `aligns-with-heritage`, `collection-skews-contrast`, `overlaps-with-specific`.
    - 8 supporting templates exist (final names listed below), each with a predicate that gates on observable signals (no random selection).
    - Composer iteration order is deterministic (insertion order in TEMPLATES array).
    - Composer fires ALL applicable templates (no early-return after first match) — caller decides display count via UI.
    - When `entry.confidence === null` OR `< 0.5` → `contextualPhrasings = [DESCRIPTION_FOR_LABEL[result.label]]` (single fixed-label description; no template firing).
    - When `0.5 ≤ entry.confidence < 0.7` → composer prefixes hedged templates with `'Possibly '` (no double prefix; "Aligns with…" → "Possibly aligns with…"); first-letter de-cap handled by template author or composer (use `${slot}` and template-author lowercases the first word for hedged-compatible templates — composer just prefixes).
    - When `entry.confidence ≥ 0.7` → full templates fire as written.
    - Default fallback: when no template fires AND confidence ≥ 0.5, returns `[DESCRIPTION_FOR_LABEL[result.label]]`.
  </behavior>
  <action>
**File 1: `src/lib/verdict/templates.ts`**

Create EXACTLY 12 templates: 4 roadmap (D-01 lock) + 8 supporting (Claude's Discretion per CONTEXT D-01 starting set; user reviews in PR). Pattern is `Array<Template>` per Plan 01 type.

```typescript
import type { Template } from '@/lib/verdict/types'
import type { SimilarityLabel } from '@/lib/types'

/**
 * Phase 20 D-01: deterministic template library, single source of truth for FIT-02.
 *
 * 4 roadmap-mandated templates (CONTEXT.md D-01) + 8 supporting templates.
 * Predicates gate on observable signals from (SimilarityResult, ViewerTasteProfile,
 * Watch, CandidateTasteSnapshot). No randomness.
 *
 * The 4 roadmap templates ARE NOT optional — composer.test.ts asserts each fires
 * under its canonical fixture.
 */
export const TEMPLATES: Template[] = [
  // ── 4 ROADMAP TEMPLATES (D-01 lock) ────────────────────────────────────────
  {
    id: 'fills-a-hole',
    predicate: (result, profile, _candidate, taste) => {
      if (result.label !== 'taste-expansion' && result.label !== 'outlier') return null
      if (!taste.primaryArchetype) return null
      if (profile.dominantArchetype === taste.primaryArchetype) return null
      return { archetype: taste.primaryArchetype }
    },
    template: 'Fills a hole in your collection — your first ${archetype}.',
  },
  {
    id: 'aligns-with-heritage',
    predicate: (result, profile, _c, taste) => {
      if (result.label === 'hard-mismatch') return null
      if ((taste.heritageScore ?? 0) < 0.7) return null
      if ((profile.meanHeritageScore ?? 0) < 0.6) return null
      return {}
    },
    template: 'Aligns with your heritage-driven taste.',
  },
  {
    id: 'collection-skews-contrast',
    predicate: (result, profile, _c, taste) => {
      if (result.label === 'core-fit') return null
      if (!profile.dominantArchetype || !taste.primaryArchetype) return null
      if (profile.dominantArchetype === taste.primaryArchetype) return null
      return { dominant: profile.dominantArchetype, contrast: taste.primaryArchetype }
    },
    template: 'Your collection skews ${dominant} — this is a ${contrast}.',
  },
  {
    id: 'overlaps-with-specific',
    predicate: (result) => {
      const top = result.mostSimilarWatches[0]
      if (!top) return null
      if (top.score < 0.6) return null
      return { specific: `${top.watch.brand} ${top.watch.model}` }
    },
    template: 'Overlaps strongly with your ${specific}.',
  },
  // ── 8 SUPPORTING TEMPLATES (Claude's Discretion starting set) ──────────────
  {
    id: 'first-watch',
    predicate: (_result, profile) => {
      // Only fires when the viewer aggregate has nothing — i.e. EMPTY_PROFILE upstream
      if (profile.dominantArchetype !== null) return null
      if (profile.meanFormality !== null) return null
      return {}
    },
    template: 'First watch in your collection — no comparison yet.',
  },
  {
    id: 'core-fit-confirmed',
    predicate: (result) => result.label === 'core-fit' ? {} : null,
    template: 'Lines up cleanly with your established taste.',
  },
  {
    id: 'role-duplicate-warning',
    predicate: (result) => result.roleOverlap ? {} : null,
    template: 'Competes for wrist time with watches you already own.',
  },
  {
    id: 'archetype-echo',
    predicate: (_result, profile, _c, taste) => {
      if (!taste.primaryArchetype) return null
      if (profile.dominantArchetype !== taste.primaryArchetype) return null
      return { archetype: taste.primaryArchetype }
    },
    template: 'Another ${archetype} — your dominant style.',
  },
  {
    id: 'era-echo',
    predicate: (_result, profile, _c, taste) => {
      // taste does not carry eraSignal in CandidateTasteSnapshot — derive via candidate's
      // Phase 19.1 catalog row upstream; if not threaded, predicate cannot fire.
      // Reserved slot — composer caller may inject candidateEraSignal in future.
      return null
    },
    template: 'Echoes the ${era} era of your collection.',
  },
  {
    id: 'formality-aligned',
    predicate: (_result, profile, _c, taste) => {
      if (taste.formality === null || profile.meanFormality === null) return null
      if (Math.abs(taste.formality - profile.meanFormality) > 0.15) return null
      return {}
    },
    template: 'Matches the formality range of your favourites.',
  },
  {
    id: 'sportiness-contrast',
    predicate: (_result, profile, _c, taste) => {
      if (taste.sportiness === null || profile.meanSportiness === null) return null
      if (Math.abs(taste.sportiness - profile.meanSportiness) < 0.4) return null
      return {}
    },
    template: 'Shifts the sport/dress balance of your collection.',
  },
  {
    id: 'hard-mismatch-stated',
    predicate: (result) => result.label === 'hard-mismatch' ? {} : null,
    template: 'Conflicts with the styles you said you avoid.',
  },
]

export const HEADLINE_FOR_LABEL: Record<SimilarityLabel, string> = {
  'core-fit': 'Core Fit',
  'familiar-territory': 'Familiar Territory',
  'role-duplicate': 'Role Duplicate',
  'taste-expansion': 'Taste Expansion',
  'outlier': 'Outlier',
  'hard-mismatch': 'Hard Mismatch',
}

export const DESCRIPTION_FOR_LABEL: Record<SimilarityLabel, string> = {
  'core-fit': 'Highly aligned with your taste',
  'familiar-territory': 'Similar to what you like',
  'role-duplicate': 'May compete for wrist time',
  'taste-expansion': 'New but still aligned',
  'outlier': 'Unusual for your collection',
  'hard-mismatch': 'Conflicts with stated dislikes',
}
```

**File 2: `src/lib/verdict/composer.ts`**

```typescript
import 'server-only'
import { analyzeSimilarity } from '@/lib/similarity'
import type { Watch, UserPreferences, CatalogEntry } from '@/lib/types'
import type {
  VerdictBundle,
  VerdictBundleFull,
  Framing,
  ViewerTasteProfile,
  CandidateTasteSnapshot,
} from '@/lib/verdict/types'
import { TEMPLATES, HEADLINE_FOR_LABEL, DESCRIPTION_FOR_LABEL } from '@/lib/verdict/templates'

/**
 * Phase 20 D-01 + Pitfall 4: deterministic verdict composer.
 *
 * Confidence gating (Phase 19.1 D-14):
 *   - confidence === null OR < 0.5 → 6-fixed-label fallback (no templates)
 *   - 0.5 ≤ confidence < 0.7 → templates fire with "Possibly " prefix (hedged)
 *   - confidence ≥ 0.7 → templates fire as written (full contextual)
 */

interface ComposeArgs {
  candidate: Watch
  catalogEntry?: CatalogEntry | null
  collection: Watch[]
  preferences: UserPreferences
  profile: ViewerTasteProfile
  framing: Exclude<Framing, 'self-via-cross-user'>  // self-owned framing built upstream
}

const HEDGE_PREFIX = 'Possibly '
const FULL_CONFIDENCE_THRESHOLD = 0.7
const HEDGE_CONFIDENCE_THRESHOLD = 0.5

export function computeVerdictBundle(args: ComposeArgs): VerdictBundleFull {
  const { candidate, catalogEntry, collection, preferences, profile, framing } = args
  const result = analyzeSimilarity(candidate, collection, preferences)

  const candidateTaste: CandidateTasteSnapshot = {
    primaryArchetype: catalogEntry?.primaryArchetype ?? null,
    heritageScore: catalogEntry?.heritageScore ?? null,
    formality: catalogEntry?.formality ?? null,
    sportiness: catalogEntry?.sportiness ?? null,
    confidence: catalogEntry?.confidence ?? null,
  }

  const conf = candidateTaste.confidence
  const isFallback = conf === null || conf < HEDGE_CONFIDENCE_THRESHOLD
  const isHedged = !isFallback && conf < FULL_CONFIDENCE_THRESHOLD

  let contextualPhrasings: string[]
  if (isFallback) {
    contextualPhrasings = [DESCRIPTION_FOR_LABEL[result.label]]
  } else {
    const phrasings: string[] = []
    for (const t of TEMPLATES) {
      const slots = t.predicate(result, profile, candidate, candidateTaste)
      if (!slots) continue
      let copy = fillTemplate(t.template, slots)
      if (isHedged) copy = applyHedge(copy)
      phrasings.push(copy)
    }
    contextualPhrasings = phrasings.length > 0
      ? phrasings
      : [DESCRIPTION_FOR_LABEL[result.label]]
  }

  return {
    framing,
    label: result.label,
    headlinePhrasing: HEADLINE_FOR_LABEL[result.label],
    contextualPhrasings,
    mostSimilar: result.mostSimilarWatches.map(({ watch, score }) => ({ watch, score })),
    roleOverlap: result.roleOverlap,
  }
}

function fillTemplate(tmpl: string, slots: Record<string, string>): string {
  return tmpl.replace(/\$\{(\w+)\}/g, (_, k) => slots[k] ?? '')
}

/**
 * Hedge prefix: "Aligns with…" → "Possibly aligns with…" — lowercases the first
 * letter of the original sentence so the hedge reads naturally mid-sentence.
 */
function applyHedge(s: string): string {
  if (s.length === 0) return s
  const lowered = s[0].toLowerCase() + s.slice(1)
  return `${HEDGE_PREFIX}${lowered}`
}
```

**File 3: `src/lib/verdict/composer.test.ts`** — REPLACE Plan 01 todos. Mock `analyzeSimilarity` via `vi.mock('@/lib/similarity', ...)` so each test controls the SimilarityResult shape directly. Use fixtures for `ViewerTasteProfile`, `Watch`, `UserPreferences`, `CatalogEntry`.

Tests required (replace ALL 9 todos from Plan 01):
1. `is deterministic — same (result, profile, candidate) → same VerdictBundle` — call composer twice with same inputs; deep-equal the outputs.
2. `fires "fills-a-hole" template when archetype is novel and confidence ≥ 0.7` — fixture: result.label='taste-expansion'; profile.dominantArchetype='dive'; taste.primaryArchetype='dress'; taste.confidence=0.8 → expect `contextualPhrasings` to include `"Fills a hole in your collection — your first dress."`
3. `fires "aligns-with-heritage" template` — heritageScore=0.85 + meanHeritageScore=0.75 + label='core-fit' + confidence=0.8 → includes `"Aligns with your heritage-driven taste."`
4. `fires "collection-skews-contrast" template` — dominant='dress', contrast='dive' → includes `"Your collection skews dress — this is a dive."`
5. `fires "overlaps-with-specific" template` — mostSimilar[0]={brand:'Rolex', model:'Submariner', score:0.7} → includes `"Overlaps strongly with your Rolex Submariner."`
6. `falls through to 6-fixed-label phrasings when entry.confidence < 0.5` — confidence=0.3 + label='core-fit' → expect `contextualPhrasings === ['Highly aligned with your taste']` (single entry, fixed-label description verbatim).
7. `hedges phrasing prefix ("Possibly ") when 0.5 ≤ entry.confidence < 0.7` — same fixture as test 3 but confidence=0.6 → expect entry like `"Possibly aligns with your heritage-driven taste."`
8. `returns at least one phrasing even when no template fires (default fallback)` — fixture where no predicate matches AND confidence ≥ 0.5 → expect `contextualPhrasings.length >= 1`.
9. `preserves SimilarityLabel.text in headlinePhrasing for all 6 fixed labels` — loop over the 6 SimilarityLabel values, assert `headlinePhrasing === HEADLINE_FOR_LABEL[label]`.

**File 4: `src/lib/verdict/confidence.test.ts`** — REPLACE Plan 01 todos. Tests focus narrowly on the gate boundary semantics:
1. `confidence === null → 6-fixed-label fallback` — composer with `catalogEntry: null` (which threads confidence=null) → returns single-entry fixed-label phrasings.
2. `confidence < 0.5 → 6-fixed-label fallback` — confidence=0.49 → fallback.
3. `0.5 ≤ confidence < 0.7 → hedged phrasings ("Possibly " prefix)` — confidence=0.5 (exact boundary, must hedge); confidence=0.69 (must hedge).
4. `confidence ≥ 0.7 → full contextual phrasings` — confidence=0.7 (exact boundary, must be full); confidence=0.95 (full).

Use the same `analyzeSimilarity` mock pattern. The test asserts on whether `Possibly` appears OR whether the output is the fixed-label description.
  </action>
  <verify>
    <automated>npx vitest run src/lib/verdict/composer src/lib/verdict/confidence --reporter=basic</automated>
  </verify>
  <acceptance_criteria>
    - `test -f src/lib/verdict/templates.ts` exits 0
    - `test -f src/lib/verdict/composer.ts` exits 0
    - `grep "import 'server-only'" src/lib/verdict/composer.ts` exits 0 (Pitfall 1)
    - `grep "export function computeVerdictBundle" src/lib/verdict/composer.ts` exits 0
    - `grep "id: 'fills-a-hole'" src/lib/verdict/templates.ts` exits 0 (D-01 roadmap template 1)
    - `grep "id: 'aligns-with-heritage'" src/lib/verdict/templates.ts` exits 0 (D-01 roadmap template 2)
    - `grep "id: 'collection-skews-contrast'" src/lib/verdict/templates.ts` exits 0 (D-01 roadmap template 3)
    - `grep "id: 'overlaps-with-specific'" src/lib/verdict/templates.ts` exits 0 (D-01 roadmap template 4)
    - `grep -c "id: '" src/lib/verdict/templates.ts` returns 12 (4 roadmap + 8 supporting)
    - `grep "Fills a hole in your collection" src/lib/verdict/templates.ts` exits 0 (verbatim D-01 roadmap copy)
    - `grep "Aligns with your heritage-driven taste" src/lib/verdict/templates.ts` exits 0
    - `grep "Your collection skews \\\${dominant}" src/lib/verdict/templates.ts` exits 0
    - `grep "Overlaps strongly with your \\\${specific}" src/lib/verdict/templates.ts` exits 0
    - `grep "HEDGE_PREFIX = 'Possibly '" src/lib/verdict/composer.ts` exits 0 (UI-SPEC verbatim)
    - `grep "FULL_CONFIDENCE_THRESHOLD = 0.7" src/lib/verdict/composer.ts` exits 0
    - `grep "HEDGE_CONFIDENCE_THRESHOLD = 0.5" src/lib/verdict/composer.ts` exits 0
    - `grep -c "it\.todo" src/lib/verdict/composer.test.ts` returns 0
    - `grep -c "it\.todo" src/lib/verdict/confidence.test.ts` returns 0
    - `grep -cE "^\s*it\(" src/lib/verdict/composer.test.ts` returns 9
    - `grep -cE "^\s*it\(" src/lib/verdict/confidence.test.ts` returns 4
    - `npx vitest run src/lib/verdict/composer src/lib/verdict/confidence --reporter=basic` exits 0 (13 tests passing)
  </acceptance_criteria>
  <done>Composer + 12 templates + confidence gate implemented; 13 tests pass (9 composer + 4 confidence); analyzeSimilarity body untouched.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 4: Verify D-09 byte-lock — analyzeSimilarity is untouched</name>
  <files>src/lib/similarity.ts (READ ONLY — must not be modified)</files>
  <read_first>
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-CONTEXT.md § Implementation Decisions D-09 (BYTE-IDENTICAL LOCK on analyzeSimilarity body)
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-RESEARCH.md § Anti-Patterns to Avoid (do NOT touch analyzeSimilarity)
    - src/lib/similarity.ts (entire file, read-only) — confirm last commit is from before Phase 20
  </read_first>
  <action>
This task asserts the lock by recording a hash of `src/lib/similarity.ts` BEFORE Plan 02 work began (i.e. as committed on `main`) and verifying the working-tree file matches.

Steps:
1. Run `git show HEAD:src/lib/similarity.ts | shasum -a 256` to get the committed hash.
2. Run `shasum -a 256 src/lib/similarity.ts` to get the working-tree hash.
3. Assert both match. If they differ, revert local edits to `src/lib/similarity.ts` and re-run.

Do NOT modify the file. Do NOT add imports, exports, comments, or whitespace. The acceptance criterion is byte-equality with HEAD.
  </action>
  <verify>
    <automated>diff <(git show HEAD:src/lib/similarity.ts | shasum -a 256 | awk '{print $1}') <(shasum -a 256 src/lib/similarity.ts | awk '{print $1}')</automated>
  </verify>
  <acceptance_criteria>
    - `diff <(git show HEAD:src/lib/similarity.ts | shasum -a 256 | awk '{print $1}') <(shasum -a 256 src/lib/similarity.ts | awk '{print $1}')` exits 0 (hashes equal — D-09 byte-lock honoured)
    - `git diff HEAD -- src/lib/similarity.ts` produces no output (no working-tree edits)
  </acceptance_criteria>
  <done>analyzeSimilarity body is byte-identical to HEAD; D-09 byte-lock verified.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| viewer DB → server module | `computeViewerTasteProfile` reads `watches` and `watches_catalog` via Drizzle; SQL parameterized via Drizzle binds (no string concat) |
| catalog row → composer slots | catalog string fields (brand, model, primaryArchetype) flow into template slots that the renderer (Plan 03) eventually paints |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-20-02-01 | Information Disclosure | computeViewerTasteProfile | mitigate | Function takes `Watch[]` from caller; the caller (Plan 04/05/06) MUST pass viewer's own collection from `getWatchesByUser(viewerId)`. The aggregate is per-viewer; no cross-viewer leak. Drizzle parameterized binds prevent SQL injection. |
| T-20-02-02 | Tampering | composer.ts template slots | mitigate | Slot values originate from catalog rows (admin-curated or LLM-extracted). Renderer (Plan 03) paints the resulting strings as plain text within React JSX (auto-escaped). No `dangerouslySetInnerHTML`. Acceptance criterion in Plan 03 enforces no innerHTML usage. |
| T-20-02-03 | Tampering | shims.ts movement coercion | accept | Unknown movement string is coerced to `'other'` — closed-union enforcement at the type boundary prevents engine misbehaviour. No security risk. |
| T-20-02-04 | Information Disclosure | analyzeSimilarity invocation | accept | Engine consumes only objects passed by caller (candidate Watch + viewer's collection + viewer's preferences). No DB access inside engine. Same security posture as v1.0–v3.0. |

This plan introduces no Server Actions (Plan 05), no UI surfaces (Plan 03), no public route (Plans 04/06). Threat surface is one Drizzle JOIN + pure functions. ASVS L1 V5 (input validation): n/a — inputs are TypeScript-typed; no untrusted external strings reach SQL except via parameterized binds. V4 (access control): mitigated by caller responsibility (caller passes viewerId-scoped collection).
</threat_model>

<verification>
- All 8 frontmatter `files_modified` exist on disk
- `npx vitest run src/lib/verdict --reporter=basic` exits 0 (4 test files; ~27 tests passing)
- `git diff HEAD -- src/lib/similarity.ts` produces no output (D-09 byte-lock)
- `grep "import 'server-only'" src/lib/verdict/composer.ts src/lib/verdict/viewerTasteProfile.ts | wc -l` returns 2 (both are server-only)
- `grep "import 'server-only'" src/lib/verdict/shims.ts src/lib/verdict/types.ts src/lib/verdict/templates.ts | wc -l` returns 0 (none of these are server-only — pure types/data)
- `grep -c "id: '" src/lib/verdict/templates.ts` returns 12 (4 roadmap + 8 supporting)
- `grep -E "(fills-a-hole|aligns-with-heritage|collection-skews-contrast|overlaps-with-specific)" src/lib/verdict/templates.ts | wc -l` returns 4 (4 roadmap templates present)
</verification>

<success_criteria>
1. `src/lib/verdict/{templates,composer,viewerTasteProfile,shims}.ts` exist; types compile; no edits to `src/lib/similarity.ts`.
2. The 4 roadmap-mandated templates fire under their canonical test fixtures.
3. Confidence gate enforces the 4 boundary cases (null, <0.5, 0.5–0.7, ≥0.7).
4. Aggregate is null-tolerant — no NaN, no undefined, no thrown errors.
5. Shim round-trip property holds (analyzeSimilarity output equals on equivalent inputs).
6. `analyzeSimilarity` body byte-identical to HEAD (D-09).
7. 27 tests passing across the 4 test files.
</success_criteria>

<output>
After completion, create `.planning/phases/20-collection-fit-surface-polish-verdict-copy/20-02-SUMMARY.md`.
</output>
