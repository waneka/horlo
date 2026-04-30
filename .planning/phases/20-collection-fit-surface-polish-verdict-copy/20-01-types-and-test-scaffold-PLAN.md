---
phase: 20
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/verdict/types.ts
  - tests/no-evaluate-route.test.ts
  - tests/static/CollectionFitCard.no-engine.test.ts
  - src/lib/verdict/composer.test.ts
  - src/lib/verdict/viewerTasteProfile.test.ts
  - src/lib/verdict/shims.test.ts
  - src/lib/verdict/confidence.test.ts
  - src/components/insights/CollectionFitCard.test.tsx
  - tests/actions/verdict.test.ts
  - tests/components/search/WatchSearchRowsAccordion.test.tsx
  - tests/components/search/useWatchSearchVerdictCache.test.tsx
  - tests/app/watch-page-verdict.test.ts
  - tests/app/catalog-page.test.ts
autonomous: true
requirements: [FIT-01, FIT-02, FIT-03, FIT-04]

must_haves:
  truths:
    - "Plan 01 publishes the VerdictBundle / Framing / ViewerTasteProfile / Template type contract that downstream plans implement against"
    - "Wave 0 test scaffolds exist with placeholder it.todo entries so per-task automated verifies pass within 30s"
    - "A static smoke test asserts src/app/evaluate/ does not exist (success criterion 5 enforced at CI time)"
  artifacts:
    - path: "src/lib/verdict/types.ts"
      provides: "VerdictBundle, Framing, ViewerTasteProfile, Template, VerdictMostSimilar exports"
      exports: ["VerdictBundle", "Framing", "ViewerTasteProfile", "Template"]
    - path: "tests/no-evaluate-route.test.ts"
      provides: "File-system assertion that src/app/evaluate does not exist"
      contains: "describe"
    - path: "tests/static/CollectionFitCard.no-engine.test.ts"
      provides: "Static text-scan asserting CollectionFitCard.tsx does not import analyzeSimilarity or composer"
      contains: "describe"
    - path: "src/lib/verdict/composer.test.ts"
      provides: "Composer placeholder test scaffold"
      contains: "describe"
    - path: "src/lib/verdict/viewerTasteProfile.test.ts"
      provides: "Viewer aggregate placeholder test scaffold"
      contains: "describe"
    - path: "src/lib/verdict/shims.test.ts"
      provides: "Shim mapper placeholder test scaffold"
      contains: "describe"
    - path: "src/lib/verdict/confidence.test.ts"
      provides: "Confidence gate threshold placeholder test scaffold"
      contains: "describe"
    - path: "src/components/insights/CollectionFitCard.test.tsx"
      provides: "Card placeholder test scaffold"
      contains: "describe"
    - path: "tests/actions/verdict.test.ts"
      provides: "Server Action auth-gate / Zod placeholder test scaffold"
      contains: "describe"
    - path: "tests/components/search/WatchSearchRowsAccordion.test.tsx"
      provides: "Accordion expand / one-at-a-time placeholder scaffold"
      contains: "describe"
    - path: "tests/components/search/useWatchSearchVerdictCache.test.tsx"
      provides: "Cache hook placeholder scaffold"
      contains: "describe"
    - path: "tests/app/watch-page-verdict.test.ts"
      provides: "/watch/[id] verdict integration placeholder scaffold"
      contains: "describe"
    - path: "tests/app/catalog-page.test.ts"
      provides: "/catalog/[catalogId] integration placeholder scaffold"
      contains: "describe"
  key_links:
    - from: "downstream plans (02–06)"
      to: "src/lib/verdict/types.ts"
      via: "import { VerdictBundle, Framing, ViewerTasteProfile } from '@/lib/verdict/types'"
      pattern: "from '@/lib/verdict/types'"
    - from: "tests/no-evaluate-route.test.ts"
      to: "src/app/evaluate"
      via: "fs.existsSync"
      pattern: "src/app/evaluate"
---

<objective>
Publish the Phase 20 type contract (`VerdictBundle`, `Framing`, `ViewerTasteProfile`, `Template`) that all downstream plans (02–06) implement against, and lay down the Wave 0 test scaffolds that the Nyquist validation strategy requires.

Purpose: Eliminates the "scavenger hunt" anti-pattern. Plans 02–06 each receive the type shape they consume directly — no executor exploration to discover the prop shape of `<CollectionFitCard>` or the return type of the Server Action. Also enforces success criterion 5 at CI time via a file-system assertion: `src/app/evaluate/` must not exist.

Output:
- `src/lib/verdict/types.ts` — single source of truth for `VerdictBundle`, `Framing`, `ViewerTasteProfile`, `Template`, `VerdictMostSimilar`.
- 11 test scaffolds with placeholder `it.todo` entries (so automated `<verify>` commands run cleanly in 02–06 before tests are filled in).
- 2 always-on guard tests: no-evaluate-route + CollectionFitCard-no-engine (guards against regression even before card exists).
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
@.planning/phases/20-collection-fit-surface-polish-verdict-copy/20-VALIDATION.md

<interfaces>
<!-- Existing types this plan re-exports / composes against. Pulled from src/lib/types.ts -->

From src/lib/types.ts (existing — DO NOT modify):
```typescript
export type SimilarityLabel =
  | 'core-fit' | 'familiar-territory' | 'role-duplicate'
  | 'taste-expansion' | 'outlier' | 'hard-mismatch'

export interface SimilarityResult {
  label: SimilarityLabel
  score: number
  mostSimilarWatches: Array<{ watch: Watch; score: number }>
  roleOverlap: boolean
  reasoning: string[]
}

export type PrimaryArchetype =
  | 'dress' | 'dive' | 'field' | 'pilot' | 'chrono'
  | 'gmt' | 'racing' | 'sport' | 'tool' | 'hybrid'
export type EraSignal = 'vintage-leaning' | 'modern' | 'contemporary'

export interface Watch { id: string; brand: string; model: string; /* ... */ }
export interface CatalogEntry {
  /* Phase 19.1 D-01 taste attributes (NULLable on fresh dev DB before backfill): */
  formality: number | null
  sportiness: number | null
  heritageScore: number | null
  primaryArchetype: PrimaryArchetype | null
  eraSignal: EraSignal | null
  designMotifs: string[]
  confidence: number | null
  extractedFromPhoto: boolean
  /* ... rest of CatalogEntry */
}
```

From src/lib/actionTypes.ts (existing):
```typescript
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Create src/lib/verdict/types.ts with the locked VerdictBundle / Framing / ViewerTasteProfile / Template / VerdictMostSimilar exports</name>
  <files>src/lib/verdict/types.ts</files>
  <read_first>
    - src/lib/types.ts (lines 1-170) — to import existing SimilarityLabel, Watch, PrimaryArchetype, EraSignal types verbatim, never redefine
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-CONTEXT.md § "Implementation Decisions" D-04 (locked VerdictBundle shape) and D-08 (self-via-cross-user fields)
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-RESEARCH.md § "Architecture Patterns" Pattern 1 (pure renderer) + § "Common Pitfalls" Pitfall 3 (RSC serialization — NO Date, Map, Set, undefined-as-property)
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-UI-SPEC.md § "Component Inventory" → "You own this" callout (D-08 fields: ownedAtIso, ownerHref)
  </read_first>
  <action>
Create `src/lib/verdict/types.ts` exporting EXACTLY these named exports (no others — keep the surface minimal per D-04):

```typescript
import type { Watch, SimilarityLabel, PrimaryArchetype, EraSignal } from '@/lib/types'

/**
 * Phase 20 D-04: VerdictBundle is the pure-render contract for <CollectionFitCard>.
 *
 * Discriminated union by `framing`:
 *   - 'same-user' / 'cross-user' → full verdict (label, headline, contextual, mostSimilar, roleOverlap)
 *   - 'self-via-cross-user' (D-08) → "You own this" callout — no verdict computed
 *
 * Pitfall 3 (RSC serialization): every field is plain JSON. No Date, Map, Set,
 * undefined-as-property. Date values are ISO strings (ownedAtIso).
 */
export type Framing = 'same-user' | 'cross-user' | 'self-via-cross-user'

export interface VerdictMostSimilar {
  watch: Watch
  score: number
}

export interface VerdictBundleFull {
  framing: 'same-user' | 'cross-user'
  label: SimilarityLabel
  /** Verbatim getSimilarityLabelDisplay(label).text — chip copy. */
  headlinePhrasing: string
  /** Composer-generated phrasings (D-01 templates); falls back to single fixed-label description when confidence < 0.5. */
  contextualPhrasings: string[]
  mostSimilar: VerdictMostSimilar[]
  roleOverlap: boolean
}

export interface VerdictBundleSelfOwned {
  framing: 'self-via-cross-user'
  /** ISO date string of viewer.acquisitionDate ?? viewer.createdAt — UI formats with Intl.DateTimeFormat short month. */
  ownedAtIso: string
  /** /watch/{viewer.watchId} — viewer's per-user watches.id, not catalog id. */
  ownerHref: string
}

export type VerdictBundle = VerdictBundleFull | VerdictBundleSelfOwned

/**
 * Phase 20 D-02: viewer aggregate taste profile.
 * Null-tolerant: every numeric field is `number | null`; arrays are `[]` when empty.
 * `null` means "no signal" (collection has no Phase 19.1-enriched rows above the
 * confidence floor). Composer must skip templates whose slot resolves to null.
 */
export interface ViewerTasteProfile {
  meanFormality: number | null
  meanSportiness: number | null
  meanHeritageScore: number | null
  dominantArchetype: PrimaryArchetype | null
  dominantEraSignal: EraSignal | null
  topDesignMotifs: string[]  // always array; up to 3 entries by frequency
}

/**
 * D-01 template library entry. Predicate decides applicability + returns slot bag;
 * template is a string with ${slot} placeholders the composer fills.
 *
 * Predicate inputs include candidateTaste (the Phase 19.1 taste row of the candidate
 * watch) so templates can gate on confidence (Pitfall 4) and primaryArchetype
 * without re-querying.
 */
export interface CandidateTasteSnapshot {
  primaryArchetype: PrimaryArchetype | null
  heritageScore: number | null
  formality: number | null
  sportiness: number | null
  confidence: number | null
}

export interface Template {
  id: string
  predicate: (
    result: import('@/lib/types').SimilarityResult,
    profile: ViewerTasteProfile,
    candidate: Watch,
    candidateTaste: CandidateTasteSnapshot,
  ) => Record<string, string> | null
  template: string
}
```

Exact rules:
- Use `import type` for `Watch / SimilarityLabel / PrimaryArchetype / EraSignal` from `@/lib/types`. Use `import type { SimilarityResult }` only inside the `Template.predicate` parameter type via the inline `import('@/lib/types').SimilarityResult` form to avoid pulling SimilarityResult into the consumer's runtime imports.
- DO NOT export `composeVerdictCopy`, `computeViewerTasteProfile`, `catalogEntryToSimilarityInput` — those are runtime exports owned by Plan 02 in `composer.ts`, `viewerTasteProfile.ts`, `shims.ts` respectively. This file is types-only.
- DO NOT add a default export.
- File header comment: `// Phase 20 D-04: pure-render type contract for <CollectionFitCard>. Types-only — no runtime exports.`
  </action>
  <verify>
    <automated>npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "verdict/types" || echo "OK: no errors in verdict/types.ts"</automated>
  </verify>
  <acceptance_criteria>
    - `test -f src/lib/verdict/types.ts` exits 0
    - `grep -E "^export (type|interface) (Framing|VerdictBundle|VerdictBundleFull|VerdictBundleSelfOwned|VerdictMostSimilar|ViewerTasteProfile|Template|CandidateTasteSnapshot)" src/lib/verdict/types.ts` returns 8 lines (each exported name appears once)
    - `grep -E "framing: 'self-via-cross-user'" src/lib/verdict/types.ts` exits 0 (D-08 framing locked)
    - `grep "ownedAtIso: string" src/lib/verdict/types.ts` exits 0 (Pitfall 3 — ISO string not Date)
    - `grep "ownerHref: string" src/lib/verdict/types.ts` exits 0
    - `grep -E "meanFormality: number \| null" src/lib/verdict/types.ts` exits 0 (D-02 null-tolerant)
    - `grep -E "topDesignMotifs: string\[\]" src/lib/verdict/types.ts` exits 0 (D-02 array always present)
    - `grep "from '@/lib/types'" src/lib/verdict/types.ts` exits 0 (uses existing types, doesn't redefine)
    - `grep -E "^export const|^export function" src/lib/verdict/types.ts` exits 1 (types-only — no runtime exports)
    - `grep "Date" src/lib/verdict/types.ts | grep -v "ISO\|date" | grep -v "//" | wc -l` is 0 (no Date type in serializable surface)
    - `npx tsc --noEmit` exits 0 (file compiles cleanly)
  </acceptance_criteria>
  <done>src/lib/verdict/types.ts exists with all 8 named exports, no runtime exports, compiles clean, RSC-serializable (ISO string for date, no Date type).</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Create the 2 always-on guard tests (no-evaluate-route + CollectionFitCard-no-engine)</name>
  <files>tests/no-evaluate-route.test.ts, tests/static/CollectionFitCard.no-engine.test.ts</files>
  <read_first>
    - tests/no-raw-img.test.ts (entire file) — pattern for static text-scan assertions
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-CONTEXT.md § Phase Boundary (success criterion 5: /evaluate route does not exist)
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-RESEARCH.md § Common Pitfalls → Pitfall 1 (engine bundle leak via card import)
    - vitest.config.ts (entire file) — to confirm test glob patterns include `tests/**/*.test.ts`
  </read_first>
  <action>
Create EXACTLY these two test files:

**File 1: `tests/no-evaluate-route.test.ts`**
```typescript
import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'

describe('Phase 20 success criterion 5 — /evaluate route does not exist', () => {
  it('src/app/evaluate/ directory does not exist', () => {
    expect(existsSync('src/app/evaluate')).toBe(false)
  })

  it('src/app/evaluate/page.tsx does not exist', () => {
    expect(existsSync('src/app/evaluate/page.tsx')).toBe(false)
  })

  it('src/app/evaluate/route.ts does not exist', () => {
    expect(existsSync('src/app/evaluate/route.ts')).toBe(false)
  })
})
```

**File 2: `tests/static/CollectionFitCard.no-engine.test.ts`**
```typescript
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'

/**
 * Phase 20 D-04 + Pitfall 1: <CollectionFitCard> is a pure renderer. It MUST NOT
 * import the similarity engine or the verdict composer (both pull non-trivial
 * code into client bundles when transitively reached from a 'use client' file).
 *
 * Plan 03 creates the file; this guard runs at all times. While the file does
 * not yet exist, the test passes vacuously (skip via existsSync).
 */
describe('Phase 20 D-04 — <CollectionFitCard> pure-renderer invariant', () => {
  const cardPath = 'src/components/insights/CollectionFitCard.tsx'

  it('does not import @/lib/similarity', () => {
    if (!existsSync(cardPath)) {
      // Vacuous pass until Plan 03 creates the file.
      return
    }
    const src = readFileSync(cardPath, 'utf8')
    expect(src).not.toMatch(/from ['"]@\/lib\/similarity['"]/)
    expect(src).not.toMatch(/analyzeSimilarity\s*\(/)
  })

  it('does not import @/lib/verdict/composer', () => {
    if (!existsSync(cardPath)) return
    const src = readFileSync(cardPath, 'utf8')
    expect(src).not.toMatch(/from ['"]@\/lib\/verdict\/composer['"]/)
    expect(src).not.toMatch(/composeVerdictCopy\s*\(/)
    expect(src).not.toMatch(/computeVerdictBundle\s*\(/)
  })

  it('does not import server-only modules into the client bundle', () => {
    if (!existsSync(cardPath)) return
    const src = readFileSync(cardPath, 'utf8')
    expect(src).not.toMatch(/from ['"]server-only['"]/)
    expect(src).not.toMatch(/from ['"]@\/lib\/verdict\/viewerTasteProfile['"]/)
  })
})
```

Rules:
- Test 1 must check the directory AND `page.tsx` AND `route.ts` (covers all three Next.js dynamic route file shapes).
- Test 2 must use the vacuous-pass pattern (`if (!existsSync) return`) so this test compiles on day 1 of Wave 1, before Plan 03 creates the card. The test is permanently load-bearing — once the card exists, the assertions kick in.
- Both files use `from 'node:fs'` (Node 18+ canonical), not `from 'fs'`.
- Both files use `describe/it/expect` from `'vitest'` per project convention.
  </action>
  <verify>
    <automated>npx vitest run tests/no-evaluate-route tests/static/CollectionFitCard.no-engine --reporter=basic</automated>
  </verify>
  <acceptance_criteria>
    - `test -f tests/no-evaluate-route.test.ts` exits 0
    - `test -f tests/static/CollectionFitCard.no-engine.test.ts` exits 0
    - `grep "existsSync('src/app/evaluate')" tests/no-evaluate-route.test.ts` exits 0
    - `grep "existsSync('src/app/evaluate/page.tsx')" tests/no-evaluate-route.test.ts` exits 0
    - `grep "existsSync('src/app/evaluate/route.ts')" tests/no-evaluate-route.test.ts` exits 0
    - `grep "from '@/lib/similarity'" tests/static/CollectionFitCard.no-engine.test.ts` exits 0 (the test file references this string as the regex it's checking)
    - `grep "from '@/lib/verdict/composer'" tests/static/CollectionFitCard.no-engine.test.ts` exits 0
    - `npx vitest run tests/no-evaluate-route tests/static/CollectionFitCard.no-engine --reporter=basic` exits 0 (both passing — second is vacuous-pass before card exists)
  </acceptance_criteria>
  <done>Both guard tests pass. /evaluate-route test asserts negative existence; CollectionFitCard-no-engine test passes vacuously now and will assert real invariants once Plan 03 lands.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Create 11 Wave 0 placeholder test scaffolds with it.todo entries (per VALIDATION.md)</name>
  <files>src/lib/verdict/composer.test.ts, src/lib/verdict/viewerTasteProfile.test.ts, src/lib/verdict/shims.test.ts, src/lib/verdict/confidence.test.ts, src/components/insights/CollectionFitCard.test.tsx, tests/actions/verdict.test.ts, tests/components/search/WatchSearchRowsAccordion.test.tsx, tests/components/search/useWatchSearchVerdictCache.test.tsx, tests/app/watch-page-verdict.test.ts, tests/app/catalog-page.test.ts</files>
  <read_first>
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-VALIDATION.md § "Wave 0 Requirements" (full list of 11 scaffolds + intent)
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-RESEARCH.md § "Validation Architecture" → "Phase Requirements → Test Map" (lists each test's intent and command)
    - tests/setup.ts (entire file) — test setup conventions
    - vitest.config.ts (entire file) — confirms test glob includes both src/ and tests/ paths
  </read_first>
  <action>
Create EXACTLY these 10 placeholder test files (Task 2 already created the first two guard tests). Each uses `it.todo` so the suite stays green until Plans 02–06 fill them in. Each scaffold has a top-level `describe(...)` whose name encodes the requirement-ID it covers, and a comment block listing the eventual test cases (Plans 02–06 replace `it.todo` with real assertions).

**File 1: `src/lib/verdict/composer.test.ts`**
```typescript
import { describe, it } from 'vitest'

/**
 * Phase 20 FIT-02 — Composer determinism + 4 roadmap-example template hits +
 * confidence gating (Pitfall 4) + null-tolerant slot resolution (Pitfall 2).
 *
 * Filled by Plan 02 Task: "Implement composer + composer.test.ts".
 */
describe('FIT-02 composer (Plan 02)', () => {
  it.todo('is deterministic — same (result, profile, candidate) → same VerdictBundle')
  it.todo('fires "fills-a-hole" template when archetype is novel and confidence ≥ 0.7')
  it.todo('fires "aligns-with-heritage" template when both candidate and profile heritage signals are high')
  it.todo('fires "collection-skews-contrast" template when archetypes diverge')
  it.todo('fires "overlaps-with-specific" template when top mostSimilar score ≥ 0.6')
  it.todo('falls through to 6-fixed-label phrasings when entry.confidence < 0.5')
  it.todo('hedges phrasing prefix ("Possibly ") when 0.5 ≤ entry.confidence < 0.7')
  it.todo('returns at least one phrasing even when no template fires (default fallback)')
  it.todo('preserves SimilarityLabel.text in headlinePhrasing for all 6 fixed labels')
})
```

**File 2: `src/lib/verdict/viewerTasteProfile.test.ts`**
```typescript
import { describe, it } from 'vitest'

/**
 * Phase 20 D-02 — pure aggregate taste profile, null-tolerant.
 *
 * Filled by Plan 02 Task: "Implement viewerTasteProfile + tests".
 */
describe('D-02 viewerTasteProfile (Plan 02)', () => {
  it.todo('returns EMPTY_PROFILE when collection has zero watches')
  it.todo('skips catalog rows with confidence < CONFIDENCE_FLOOR (0.5)')
  it.todo('mean of all-NULL formality column returns null (not NaN, not 0)')
  it.todo('mode of all-NULL primaryArchetype column returns null')
  it.todo('topDesignMotifs returns [] when all designMotifs arrays are empty')
  it.todo('topDesignMotifs returns top-3 by frequency, ties broken by insertion order')
  it.todo('mean of mixed null + numeric column averages only the non-null entries')
  it.todo('handles a 0-watch collection without throwing (D-07 guarded path is upstream)')
})
```

**File 3: `src/lib/verdict/shims.test.ts`**
```typescript
import { describe, it } from 'vitest'

/**
 * Phase 20 D-09 — caller shim catalogEntryToSimilarityInput preserves engine inputs.
 *
 * Filled by Plan 02 Task: "Implement shims + tests".
 */
describe('D-09 catalogEntryToSimilarityInput shim (Plan 02)', () => {
  it.todo('round-trip: shim\'d Watch produces same SimilarityResult as a real Watch with identical fields')
  it.todo('coerces unknown movement string to "other" (closed union safety)')
  it.todo('coerces unknown crystalType to undefined (Watch optional)')
  it.todo('preserves styleTags / designTraits / roleTags / complications arrays verbatim')
  it.todo('sets candidate.status = "wishlist" with comment referencing engine line 225 (Pitfall 7)')
  it.todo('threads catalog UUID through to id slot — does not collide with viewer collection ids (A1)')
})
```

**File 4: `src/lib/verdict/confidence.test.ts`**
```typescript
import { describe, it } from 'vitest'

/**
 * Phase 20 Pitfall 4 / Phase 19.1 D-14 confidence gating thresholds (0.5 / 0.7).
 *
 * Filled by Plan 02 Task: "Implement confidence gate + tests".
 */
describe('Pitfall 4 confidence gate (Plan 02)', () => {
  it.todo('confidence === null → 6-fixed-label fallback')
  it.todo('confidence < 0.5 → 6-fixed-label fallback')
  it.todo('0.5 ≤ confidence < 0.7 → hedged phrasings ("Possibly " prefix)')
  it.todo('confidence ≥ 0.7 → full contextual phrasings')
})
```

**File 5: `src/components/insights/CollectionFitCard.test.tsx`**
```typescript
import { describe, it } from 'vitest'

/**
 * Phase 20 FIT-01 — <CollectionFitCard> renders all 3 framings without computing verdict.
 *
 * Filled by Plan 03 Task: "Implement CollectionFitCard + tests".
 */
describe('FIT-01 CollectionFitCard (Plan 03)', () => {
  it.todo('renders headline + contextual phrasings + most-similar list for framing="same-user"')
  it.todo('renders identical chrome for framing="cross-user" (no lens indicator)')
  it.todo('renders "You own this watch" callout for framing="self-via-cross-user" (no verdict)')
  it.todo('hides most-similar section when verdict.mostSimilar is empty array')
  it.todo('hides role-overlap warning when verdict.roleOverlap is false')
  it.todo('renders <AlertTriangle /> from lucide-react when roleOverlap is true (replaces inline SVG)')
  it.todo('uses verbatim copy "May compete for wrist time with similar watches" from SimilarityBadge.tsx:78')
  it.todo('renders title "Collection Fit" with outline Badge variant for label')
})
```

**File 6: `tests/actions/verdict.test.ts`**
```typescript
import { describe, it } from 'vitest'

/**
 * Phase 20 FIT-04 D-06 — getVerdictForCatalogWatch Server Action.
 *
 * Filled by Plan 05 Task: "Implement Server Action + tests".
 */
describe('D-06 getVerdictForCatalogWatch Server Action (Plan 05)', () => {
  it.todo('returns {success:false, error:"Not authenticated"} when getCurrentUser throws')
  it.todo('returns {success:false, error:"Invalid request"} when catalogId is not a UUID')
  it.todo('returns {success:false, error:"Invalid request"} when extra fields present (Zod .strict)')
  it.todo('returns {success:false, error:"Watch not found"} when getCatalogById returns null')
  it.todo('returns {success:true, data:VerdictBundle} for valid request with viewer.collection.length > 0')
  it.todo('VerdictBundle is plain JSON-serializable (no Date, Map, Set in returned object — Pitfall 3)')
  it.todo('framing in returned bundle is "cross-user" (search rows are always non-owned per Plan 05 contract)')
  it.todo('uses user.id from getCurrentUser — never accepts viewerId from input (V4 ASVS)')
})
```

**File 7: `tests/components/search/WatchSearchRowsAccordion.test.tsx`**
```typescript
import { describe, it } from 'vitest'

/**
 * Phase 20 FIT-04 D-05 — Accordion one-at-a-time + ESC + cache.
 *
 * Filled by Plan 05 Task: "Implement WatchSearchRowsAccordion + tests".
 */
describe('FIT-04 D-05 WatchSearchRowsAccordion (Plan 05)', () => {
  it.todo('clicking a row trigger expands its panel and renders <CollectionFitCard>')
  it.todo('opening a second row collapses the first (one-at-a-time, multiple={false})')
  it.todo('ESC key collapses the open row')
  it.todo('Tab key moves focus between row triggers without entering panel content')
  it.todo('chevron rotates 180deg when row is open (data-[state=open]:rotate-180)')
  it.todo('button label toggles "Evaluate" → "Hide" via data-state attribute')
  it.todo('first expand fires getVerdictForCatalogWatch Server Action')
  it.todo('re-expand of same row uses cache (no second Server Action call)')
  it.todo('shows <VerdictSkeleton /> while Server Action is pending')
  it.todo('Sonner toast fires on Server Action error and panel collapses')
})
```

**File 8: `tests/components/search/useWatchSearchVerdictCache.test.tsx`**
```typescript
import { describe, it } from 'vitest'

/**
 * Phase 20 D-06 — verdict cache keyed by viewer collection-revision.
 *
 * Filled by Plan 05 Task: "Implement useWatchSearchVerdictCache + tests".
 */
describe('D-06 useWatchSearchVerdictCache (Plan 05)', () => {
  it.todo('get() returns undefined for a never-set catalogId')
  it.todo('set() then get() returns the same VerdictBundle reference')
  it.todo('changing collectionRevision prop drops all cached entries')
  it.todo('hook does not refetch on re-render when revision is unchanged')
})
```

**File 9: `tests/app/watch-page-verdict.test.ts`**
```typescript
import { describe, it } from 'vitest'

/**
 * Phase 20 FIT-03 — /watch/[id] page-level verdict computation.
 *
 * Filled by Plan 04 Task: "Implement page-level compute + tests".
 */
describe('FIT-03 /watch/[id] verdict integration (Plan 04)', () => {
  it.todo('renders <CollectionFitCard> with framing="same-user" when isOwner=true')
  it.todo('renders <CollectionFitCard> with framing="cross-user" when isOwner=false')
  it.todo('does NOT render <CollectionFitCard> when viewer collection.length === 0 (D-07)')
  it.todo('passes computed VerdictBundle as prop — does not call analyzeSimilarity in WatchDetail')
})
```

**File 10: `tests/app/catalog-page.test.ts`**
```typescript
import { describe, it } from 'vitest'

/**
 * Phase 20 D-10 — /catalog/[catalogId] new route.
 *
 * Filled by Plan 06 Task: "Implement catalog page + tests".
 */
describe('D-10 /catalog/[catalogId] page (Plan 06)', () => {
  it.todo('returns 404 when catalogId does not exist in watches_catalog')
  it.todo('renders <CollectionFitCard> with framing="cross-user" when viewer does not own this catalog ref AND collection > 0')
  it.todo('hides <CollectionFitCard> entirely when viewer.collection.length === 0 (D-07)')
  it.todo('renders "You own this watch" callout when viewer already owns this catalog ref (D-08)')
  it.todo('callout link points to /watch/{viewer.watches.id} — per-user UUID, not catalog UUID')
})
```

Rules for ALL 10 files:
- Use `import { describe, it } from 'vitest'` (no `expect` needed — `it.todo` doesn't run assertions).
- Each describe name encodes the requirement-ID and the responsible Plan number.
- Each `it.todo` describes a behaviour in plain English; no assertions.
- DO NOT add real test logic; that's owned by Plans 02–06.
- File extensions: `.test.tsx` for files that will need React Testing Library renders (Card, Accordion, Cache hook); `.test.ts` for the rest.
  </action>
  <verify>
    <automated>npx vitest run src/lib/verdict tests/actions/verdict tests/components/search/WatchSearchRowsAccordion tests/components/search/useWatchSearchVerdictCache tests/app/watch-page-verdict tests/app/catalog-page src/components/insights/CollectionFitCard --reporter=basic</automated>
  </verify>
  <acceptance_criteria>
    - All 10 files exist: `for f in src/lib/verdict/composer.test.ts src/lib/verdict/viewerTasteProfile.test.ts src/lib/verdict/shims.test.ts src/lib/verdict/confidence.test.ts src/components/insights/CollectionFitCard.test.tsx tests/actions/verdict.test.ts tests/components/search/WatchSearchRowsAccordion.test.tsx tests/components/search/useWatchSearchVerdictCache.test.tsx tests/app/watch-page-verdict.test.ts tests/app/catalog-page.test.ts; do test -f $f || exit 1; done` exits 0
    - `grep -l "it.todo" src/lib/verdict/composer.test.ts src/lib/verdict/viewerTasteProfile.test.ts src/lib/verdict/shims.test.ts src/lib/verdict/confidence.test.ts src/components/insights/CollectionFitCard.test.tsx tests/actions/verdict.test.ts tests/components/search/WatchSearchRowsAccordion.test.tsx tests/components/search/useWatchSearchVerdictCache.test.tsx tests/app/watch-page-verdict.test.ts tests/app/catalog-page.test.ts | wc -l` returns 10 (every file uses it.todo)
    - `grep -E "it\.todo\(" src/lib/verdict/composer.test.ts | wc -l` returns 9 (composer scaffold has 9 todos)
    - `grep -E "it\.todo\(" tests/actions/verdict.test.ts | wc -l` returns 8 (action scaffold has 8 todos)
    - `npx vitest run src/lib/verdict tests/actions/verdict tests/components/search/WatchSearchRowsAccordion tests/components/search/useWatchSearchVerdictCache tests/app/watch-page-verdict tests/app/catalog-page src/components/insights/CollectionFitCard --reporter=basic` exits 0 with status TODO for all entries (todos report as skipped, suite passes)
  </acceptance_criteria>
  <done>10 placeholder test files committed; vitest run reports them all as todos; suite green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| filesystem→tests | tests read source files via `node:fs` for static text-scans; read-only |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-20-01-01 | Information Disclosure | tests/no-evaluate-route.test.ts | accept | Test reads filesystem only via existsSync; no path interpolation, no user input. Hardcoded paths cannot be coerced. |
| T-20-01-02 | Tampering | src/lib/verdict/types.ts | mitigate | Types-only file. No runtime exports → no attack surface. Acceptance criterion grep enforces no `^export const|^export function`. |

This plan introduces no Server Actions, no DAL queries, no client-state logic, no user-facing surfaces. Threat surface is filesystem-only, read-only, hardcoded paths. ASVS L1 categories applicable: V5 Input Validation (n/a — no input). All other categories n/a.
</threat_model>

<verification>
- All 13 frontmatter `files_modified` exist on disk
- `npx vitest run --reporter=basic` exits 0 (suite green)
- `npx tsc --noEmit` exits 0 (types compile)
- `grep -E "^export (type|interface)" src/lib/verdict/types.ts | wc -l` returns 8 (all 8 named exports present)
- `test ! -d src/app/evaluate` exits 0 (route does not exist)
</verification>

<success_criteria>
1. `src/lib/verdict/types.ts` exports `VerdictBundle`, `Framing`, `ViewerTasteProfile`, `Template`, `VerdictMostSimilar`, `VerdictBundleFull`, `VerdictBundleSelfOwned`, `CandidateTasteSnapshot` (8 exports).
2. 11 placeholder/guard test files exist in the locations specified.
3. `tests/no-evaluate-route.test.ts` and `tests/static/CollectionFitCard.no-engine.test.ts` are real tests (not it.todo) and pass.
4. The other 10 scaffolds use `it.todo` and report as todos under vitest.
5. Full vitest suite green after this plan.
</success_criteria>

<output>
After completion, create `.planning/phases/20-collection-fit-surface-polish-verdict-copy/20-01-SUMMARY.md`.
</output>
