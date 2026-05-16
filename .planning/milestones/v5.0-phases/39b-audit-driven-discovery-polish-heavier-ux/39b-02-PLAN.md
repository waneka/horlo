---
phase: 39b
plan: 02
type: execute
wave: 1
depends_on:
  - 39b-01
files_modified:
  - src/components/insights/ReferenceIdentityCard.tsx
  - tests/static/ReferenceIdentityCard.no-engine.test.ts
  - tests/components/insights/ReferenceIdentityCard.test.tsx
  - src/app/watch/[id]/page.tsx
  - src/app/catalog/[catalogId]/page.tsx
autonomous: true
requirements:
  - DISC-11
nsv_rows:
  - NSV-06
  - NSV-20
disc_audit_rows:
  - DISC-AUDIT-70
  - DISC-AUDIT-81
  - DISC-AUDIT-130
  - DISC-AUDIT-131
commit_strategy: per-task

must_haves:
  truths:
    - "Fresh-account viewer (collection.length === 0) on /watch/{id} sees ReferenceIdentityCard above the CTA block when catalogTaste.confidence >= 0.5"
    - "Fresh-account viewer on /catalog/{id} sees ReferenceIdentityCard above the CTA block when catalogEntry.confidence >= 0.5"
    - "Below the 0.5 confidence gate (or catalogTaste === null), the card is suppressed and the fallback caption renders above the CTAs"
    - "ReferenceIdentityCard has zero imports from @/lib/similarity, @/lib/verdict/composer, @/lib/verdict/viewerTasteProfile, or server-only"
    - "ReferenceIdentityCard has no 'use client' directive (pure server component)"
    - "src/app/watch/[id]/page.tsx remains a Server Component (no 'use client'); ReferenceIdentityCard and the 3-CTA block are rendered as Server-Component JSX siblings to <WatchDetail/> (the client island), NOT inside WatchDetail"
    - "The rendered card on both surfaces shows the same fields (era + archetype headline; formality/sportiness/heritage scale bars; design motifs chips) — D-39b-04 lock"
  artifacts:
    - path: "src/components/insights/ReferenceIdentityCard.tsx"
      provides: "Pure-renderer server RSC for fresh-account catalog taste signature"
      contains: "export function ReferenceIdentityCard"
      min_lines: 60
    - path: "tests/static/ReferenceIdentityCard.no-engine.test.ts"
      provides: "Import-boundary static guard (mirrors CollectionFitCard.no-engine pattern)"
      contains: "@/lib/similarity"
    - path: "tests/components/insights/ReferenceIdentityCard.test.tsx"
      provides: "Component tests — confidence gate + suppression + headline omission + scale omission"
      contains: "Inferred taste signature"
  key_links:
    - from: "src/app/watch/[id]/page.tsx (Server Component)"
      to: "src/components/insights/ReferenceIdentityCard.tsx"
      via: "Conditional mount as a Server-Component SIBLING of <WatchDetail/> (NOT inside the client island) in the fresh-account branch (collection.length === 0)"
      pattern: "ReferenceIdentityCard\\s+taste="
    - from: "src/app/catalog/[catalogId]/page.tsx"
      to: "src/components/insights/ReferenceIdentityCard.tsx"
      via: "Conditional mount in G-4 fresh-account branch (replaces lines 112-113 'verdict stays null AND actionsSpec stays null' suppression)"
      pattern: "ReferenceIdentityCard\\s+taste="
---

<objective>
Ship the `ReferenceIdentityCard` component and mount it on both `/watch/{id}`
(G-6 branch) and `/catalog/{id}` (G-4 branch) so a fresh-account viewer with
zero owned watches sees an inferred taste signature for the watch they are
considering, instead of an empty "no card, no CTAs" surface (per Phase 33b
NSV-06 + NSV-20).

Purpose: closes the heavier-tier dead-end on /watch and /catalog for empty
collections. Card renders identically on both surfaces (D-39b-04) when
`catalogTaste.confidence >= 0.5` (D-39b-03); below threshold (or null taste),
suppress card and render the fallback caption + CTAs only. Pure-renderer
import isolation (D-39b-01) enforced by static guard.

Architectural note for `/watch/{id}`: the existing route delegates rendering
to `<WatchDetail>` (a Client Component — `'use client'` at line 1 of
`src/components/watch/WatchDetail.tsx`). Plan 39b-02 does NOT import the new
RSCs into `WatchDetail`. Instead, `src/app/watch/[id]/page.tsx` (Server
Component) is reshaped so that `ReferenceIdentityCard`, the fallback caption,
and the new 3-CTA block render as Server-Component JSX **siblings** of
`<WatchDetail/>` within the page's `<main>` body. This preserves Next 16's
server/client boundary rules: RSCs are never imported into a Client Component;
they compose at the server tree level.

Output: One new component, two test files, two page-level mount edits, four
commits (per-task).
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
@.planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-UI-SPEC.md
@.planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-RESEARCH.md
@CLAUDE.md
@AGENTS.md
@src/components/insights/CollectionFitCard.tsx
@tests/static/CollectionFitCard.no-engine.test.ts
@src/app/watch/[id]/page.tsx
@src/components/watch/WatchDetail.tsx
@src/app/catalog/[catalogId]/page.tsx
@src/lib/types.ts
@src/lib/taste/vocab.ts

<interfaces>
<!-- Key types and contracts. Extracted from codebase. -->

From src/lib/types.ts §CatalogTasteAttributes (the prop shape):
```typescript
export type EraSignal = 'vintage-leaning' | 'modern' | 'contemporary'
export type PrimaryArchetype =
  | 'dress' | 'dive' | 'field' | 'pilot' | 'chrono'
  | 'gmt' | 'racing' | 'sport' | 'tool' | 'hybrid'

export interface CatalogTasteAttributes {
  formality: number | null
  sportiness: number | null
  heritageScore: number | null
  primaryArchetype: PrimaryArchetype | null
  eraSignal: EraSignal | null
  designMotifs: string[]
  confidence: number | null
  extractedFromPhoto: boolean | null
}
```

From src/components/ui/card.tsx (existing primitives):
```typescript
export { Card, CardContent, CardDescription, CardHeader, CardTitle }
```

From src/components/insights/CollectionFitCard.tsx:1-5 (canonical sibling — copy the import shape):
```typescript
import { Card, CardContent, CardHeader, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { CatalogTasteAttributes } from '@/lib/types'
```

From src/app/watch/[id]/page.tsx (CURRENT — 68 lines, Server Component). page.tsx delegates ALL rendering to `<WatchDetail watch={watch} collection={collection} preferences={preferences} lastWornDate={...} viewerCanEdit={isOwner} verdict={verdict} />`. There is NO existing 3-CTA block ("Add to Wishlist / Add to Collection / Skip") on this route — neither in page.tsx nor in WatchDetail.tsx. Phase 39b is the first phase to introduce the 3-CTA block on /watch/{id}; per UI-SPEC § Render Order line 266, the executor CONSTRUCTS it inside page.tsx as a Server-Component sibling of `<WatchDetail/>`. The fresh-account fallback caption + 3-CTA block are rendered ONLY when `collection.length === 0`.

From src/components/watch/WatchDetail.tsx:1 ('use client') — Client Component. CollectionFitCard is imported and mounted INSIDE WatchDetail (line 25 + 445); that owner-populated mount is unchanged. ReferenceIdentityCard is a Server Component and MUST NOT be imported into WatchDetail. The fresh-account branch is handled at the page.tsx level via Server-Component sibling composition.

From src/app/catalog/[catalogId]/page.tsx:112-113 (current G-4 comment block — load-bearing reshape target):
```typescript
// else: collection.length === 0 → verdict stays null AND actionsSpec stays
// null → no card, no CTAs (D-05 + D-07 empty-collection rule)
```

From src/lib/taste/vocab.ts:16-24 (display label sources — use these IDs for ERA_LABELS / ARCHETYPE_LABELS maps; the maps themselves are authored in ReferenceIdentityCard).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create static import-boundary guard test (RED-state — file does not yet exist)</name>
  <files>tests/static/ReferenceIdentityCard.no-engine.test.ts</files>
  <read_first>
    - tests/static/CollectionFitCard.no-engine.test.ts (FULL — verbatim mirror analog; only path + describe label change)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-PATTERNS.md §12 (lines 991-1032 — full file ready to copy with path substitution)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-CONTEXT.md D-39b-01 (sibling slot to CollectionFitCard) + Claude's Discretion §"Import-boundary static guard for ReferenceIdentityCard"
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-UI-SPEC.md §Test Coverage Contract (MANDATED per Discretion resolution)
  </read_first>
  <behavior>
    - When ReferenceIdentityCard.tsx does NOT exist, `existsSync` returns false; all `it` blocks short-circuit (vacuous-pass pattern from analog).
    - When ReferenceIdentityCard.tsx exists, the file MUST NOT contain `from '@/lib/similarity'` or `analyzeSimilarity(` calls.
    - The file MUST NOT contain `from '@/lib/verdict/composer'`, `composeVerdictCopy(`, or `computeVerdictBundle(`.
    - The file MUST NOT contain `from 'server-only'` or `from '@/lib/verdict/viewerTasteProfile'`.
    - The file MUST NOT have a `'use client'` directive at the top.
  </behavior>
  <action>
    Create `tests/static/ReferenceIdentityCard.no-engine.test.ts` by copying the content of `tests/static/CollectionFitCard.no-engine.test.ts` and substituting:
    - Path constant: `src/components/insights/ReferenceIdentityCard.tsx`
    - Describe label: `'Phase 39b D-39b-01 — <ReferenceIdentityCard> pure-renderer invariant'`

    Use 39b-PATTERNS.md §12 (lines 998-1031) verbatim. Four `it(...)` assertions, each guarded by `if (!existsSync(cardPath)) return` so the test vacuously passes before Task 2 lands the component file (TDD RED → GREEN cycle).

    Forbidden:
    - Do NOT add additional assertions beyond the four canonical ones.
    - Do NOT remove the `existsSync` guard — it is load-bearing for the vacuous-pass pre-component state.
  </action>
  <verify>
    <automated>npx vitest run tests/static/ReferenceIdentityCard.no-engine.test.ts 2>&1 | tail -15</automated>
  </verify>
  <acceptance_criteria>
    - `test -f tests/static/ReferenceIdentityCard.no-engine.test.ts` exits 0
    - `grep -c "if (!existsSync(cardPath)) return" tests/static/ReferenceIdentityCard.no-engine.test.ts` returns ≥ 4 (one per assertion)
    - `grep "src/components/insights/ReferenceIdentityCard.tsx" tests/static/ReferenceIdentityCard.no-engine.test.ts` returns 1 line
    - `grep "Phase 39b D-39b-01" tests/static/ReferenceIdentityCard.no-engine.test.ts` returns 1 line
    - `npx vitest run tests/static/ReferenceIdentityCard.no-engine.test.ts` exits 0 (4 tests pass vacuously since ReferenceIdentityCard.tsx does not yet exist)
  </acceptance_criteria>
  <done>
    Static guard present, vacuously green. Task 2 lands the component; the same test then re-runs and validates real imports.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create ReferenceIdentityCard component</name>
  <files>src/components/insights/ReferenceIdentityCard.tsx</files>
  <read_first>
    - src/components/insights/CollectionFitCard.tsx (FULL — 142 lines — sibling component shape; import isolation pattern)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-PATTERNS.md §1 (lines 36-101 — component shape + ERA_LABELS + ARCHETYPE_LABELS ready to copy)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-UI-SPEC.md §ReferenceIdentityCard Design Specification (lines 146-247 — scale bar anatomy + card layout + display labels + aria-labels)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-RESEARCH.md §Example 1 (lines 772-872 — extended skeleton if needed)
    - src/lib/types.ts §CatalogTasteAttributes (consumed prop shape)
    - src/lib/taste/vocab.ts (closed vocab IDs for archetype + era + motifs)
  </read_first>
  <behavior>
    - When `taste === null` → returns null (no card).
    - When `taste.confidence === null` → returns null (defense-in-depth; caller also gates).
    - When `taste.confidence < 0.5` → returns null (D-39b-03 gate).
    - When `taste.confidence >= 0.5` and all fields populated → renders Card with CardDescription "Inferred taste signature", headline row ({era} · {archetype}), three scale bars (Formality / Sportiness / Heritage), design motifs flex-wrap of `<Badge variant="outline">` chips.
    - Headline row omits a segment when that field is null; omits the whole row when BOTH era and archetype are null.
    - Each scale bar is hidden when its numeric value is null; all three hidden → entire scale section omitted.
    - Design motifs cluster is omitted when `designMotifs` array is empty.
    - Scale bars carry `aria-label="{dimensionLabel}: {Math.round(value * 100)} out of 100"` on the bar `<div>` (UI-SPEC §Screen-reader contract).
    - NO 'use client', NO imports from @/lib/similarity, @/lib/verdict/composer, @/lib/verdict/viewerTasteProfile, or server-only.
  </behavior>
  <action>
    Create `src/components/insights/ReferenceIdentityCard.tsx`. Use 39b-PATTERNS.md §1 (lines 41-100) for the import block + component shape, and 39b-UI-SPEC.md §ReferenceIdentityCard (lines 158-247) for the scale-bar JSX + dimension labels + display label maps + copy strings.

    Concrete structure:

    1. Imports (verbatim from CollectionFitCard.tsx:1-5 with substitutions):
       ```typescript
       import { Card, CardContent, CardHeader, CardDescription } from '@/components/ui/card'
       import { Badge } from '@/components/ui/badge'
       import type { CatalogTasteAttributes } from '@/lib/types'
       ```

    2. Display label maps at module top (verbatim from 39b-PATTERNS.md §1 lines 89-100):
       ```typescript
       const ERA_LABELS: Record<NonNullable<CatalogTasteAttributes['eraSignal']>, string> = {
         'vintage-leaning': 'Vintage-leaning',
         'modern': 'Modern era',
         'contemporary': 'Contemporary',
       }
       const ARCHETYPE_LABELS: Record<NonNullable<CatalogTasteAttributes['primaryArchetype']>, string> = {
         dress: 'Dress', dive: 'Dive', field: 'Field', pilot: 'Pilot',
         chrono: 'Chronograph', gmt: 'GMT', racing: 'Racing', sport: 'Sport',
         tool: 'Tool', hybrid: 'Hybrid',
       }
       ```

    3. Props interface (39b-PATTERNS.md §1 line 58-60):
       ```typescript
       interface ReferenceIdentityCardProps {
         taste: CatalogTasteAttributes | null
       }
       ```

    4. Component function:
       - Early return null when `!taste || taste.confidence === null || taste.confidence < 0.5` (D-39b-03 gate).
       - Derive `eraLabel` and `archetypeLabel` from the maps.
       - Compute `hasHeadline = Boolean(eraLabel || archetypeLabel)`.
       - Compute `hasScale = (taste.formality !== null) || (taste.sportiness !== null) || (taste.heritageScore !== null)`.
       - Compute `hasMotifs = taste.designMotifs.length > 0`.
       - Render `<Card><CardHeader><CardDescription>Inferred taste signature</CardDescription></CardHeader><CardContent className="space-y-4">`...

    5. Headline row (UI-SPEC §Card Layout): inside CardContent when `hasHeadline`:
       ```tsx
       <p className="text-base font-medium text-foreground">
         {eraLabel && <span className="truncate">{eraLabel}</span>}
         {eraLabel && archetypeLabel && ' · '}
         {archetypeLabel && <span className="truncate">{archetypeLabel}</span>}
       </p>
       ```

    6. Scale section (UI-SPEC §Scale Visual lines 158-192): inside CardContent when `hasScale`:
       ```tsx
       <div className="space-y-2">
         {taste.formality !== null && (
           <ScaleBar label="Formality" value={taste.formality} />
         )}
         {taste.sportiness !== null && (
           <ScaleBar label="Sportiness" value={taste.sportiness} />
         )}
         {taste.heritageScore !== null && (
           <ScaleBar label="Heritage" value={taste.heritageScore} />
         )}
       </div>
       ```

       Define `ScaleBar` as a local function component (same file, no separate export) using UI-SPEC §Scale-bar anatomy lines 166-181:
       ```tsx
       function ScaleBar({ label, value }: { label: string; value: number }) {
         const pct = Math.round(value * 100)
         return (
           <div className="flex flex-col gap-1">
             <span className="text-xs text-muted-foreground">{label}</span>
             <div
               className="relative h-1.5 rounded-full bg-muted overflow-hidden"
               aria-label={`${label}: ${pct} out of 100`}
             >
               <div
                 className="absolute inset-y-0 left-0 rounded-full bg-foreground/70"
                 style={{ width: `${pct}%` }}
               />
             </div>
             <div className="flex justify-between text-xs text-muted-foreground/60">
               <span>Low</span>
               <span>High</span>
             </div>
           </div>
         )
       }
       ```

    7. Motifs cluster: inside CardContent when `hasMotifs`:
       ```tsx
       <div className="flex flex-wrap gap-1">
         {taste.designMotifs.map((m) => (
           <Badge key={m} variant="outline">{m}</Badge>
         ))}
       </div>
       ```

    Forbidden imports (Pitfall 9 / D-39b-01 / static guard from Task 1):
    - ❌ `from '@/lib/similarity'`
    - ❌ `from '@/lib/verdict/composer'`
    - ❌ `from '@/lib/verdict/viewerTasteProfile'`
    - ❌ `from 'server-only'`
    - ❌ `'use client'` directive

    Forbidden visuals:
    - No `CardTitle` (D-39b-02 — muted subtitle only).
    - No verdict / mostSimilar / discriminated-union branching (this is not CollectionFitCard).
    - No numeric confidence percentage rendered anywhere in the UI (D-39b-02 lock).
  </action>
  <verify>
    <automated>test -f src/components/insights/ReferenceIdentityCard.tsx && echo "file exists"</automated>
    <automated>grep "export function ReferenceIdentityCard" src/components/insights/ReferenceIdentityCard.tsx</automated>
    <automated>grep -c "from '@/lib/similarity'" src/components/insights/ReferenceIdentityCard.tsx</automated>
    <automated>grep -c "'use client'" src/components/insights/ReferenceIdentityCard.tsx</automated>
    <automated>npx vitest run tests/static/ReferenceIdentityCard.no-engine.test.ts 2>&1 | tail -15</automated>
    <automated>npx tsc --noEmit 2>&1 | grep -c "error TS"</automated>
  </verify>
  <acceptance_criteria>
    - `test -f src/components/insights/ReferenceIdentityCard.tsx` exits 0
    - `grep "export function ReferenceIdentityCard" src/components/insights/ReferenceIdentityCard.tsx` returns 1 line
    - `grep -c "from '@/lib/similarity'" src/components/insights/ReferenceIdentityCard.tsx` returns 0
    - `grep -c "from '@/lib/verdict/composer'" src/components/insights/ReferenceIdentityCard.tsx` returns 0
    - `grep -c "from '@/lib/verdict/viewerTasteProfile'" src/components/insights/ReferenceIdentityCard.tsx` returns 0
    - `grep -c "from 'server-only'" src/components/insights/ReferenceIdentityCard.tsx` returns 0
    - `grep -cE "^['\"]use client['\"]" src/components/insights/ReferenceIdentityCard.tsx` returns 0
    - `grep "Inferred taste signature" src/components/insights/ReferenceIdentityCard.tsx` returns 1 line (UI-SPEC subtitle lock)
    - `grep "aria-label" src/components/insights/ReferenceIdentityCard.tsx` returns ≥ 1 line (scale bar a11y)
    - `npx vitest run tests/static/ReferenceIdentityCard.no-engine.test.ts` exits 0 (now non-vacuously green)
    - `npx tsc --noEmit 2>&1 | grep -c "error TS"` ≤ 27 (Phase 36 baseline)
    - File ≥ 60 lines (signal for real implementation, not stub)
  </acceptance_criteria>
  <done>
    Component file exists. Static import-boundary guard now non-vacuously green. No new tsc errors.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Create component test (confidence gate + suppression + headline omission + scale omission)</name>
  <files>tests/components/insights/ReferenceIdentityCard.test.tsx</files>
  <read_first>
    - tests/components/profile/LockedTabCard.test.tsx (analog test structure)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-PATTERNS.md §13 (lines 1036-1103 — full file ready to copy)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-UI-SPEC.md §Test Coverage Contract (lines 622-633)
    - src/components/insights/ReferenceIdentityCard.tsx (just shipped — Task 2)
  </read_first>
  <behavior>
    Six test cases per 39b-PATTERNS.md §13:
    1. Renders all sections when confidence >= 0.5 (asserts "Inferred taste signature" + "Modern era" + "Dress" + "bauhaus" present)
    2. Returns null when taste === null (asserts container.firstChild is null)
    3. Returns null when confidence < 0.5 (D-39b-03 gate)
    4. Returns null when confidence === null
    5. Omits headline when both era and archetype are null
    6. Omits a scale bar when its value is null (asserts "Formality" not present when formality===null but Sportiness + Heritage still render)
  </behavior>
  <action>
    Create `tests/components/insights/ReferenceIdentityCard.test.tsx` using 39b-PATTERNS.md §13 (lines 1042-1102) verbatim. The `FULL_TASTE` const provides the baseline; each test spreads it and overrides specific fields.

    Required imports:
    ```typescript
    import { render } from '@testing-library/react'
    import { describe, it, expect } from 'vitest'
    import { ReferenceIdentityCard } from '@/components/insights/ReferenceIdentityCard'
    import type { CatalogTasteAttributes } from '@/lib/types'
    ```

    Six `it(...)` blocks per 39b-PATTERNS.md §13 lines 1060-1101. The first test asserts visible substrings — use the UI-SPEC § "Era display labels" + "Archetype display labels" maps for the expected human-readable strings (e.g., `'modern'` → `"Modern era"`, `'dress'` → `"Dress"`).

    Forbidden: do NOT mock `Card`, `Badge`, or any other primitive — the test renders the real DOM tree to validate the UI-SPEC contract.
  </action>
  <verify>
    <automated>test -f tests/components/insights/ReferenceIdentityCard.test.tsx && echo "file exists"</automated>
    <automated>npx vitest run tests/components/insights/ReferenceIdentityCard.test.tsx 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - `test -f tests/components/insights/ReferenceIdentityCard.test.tsx` exits 0
    - `grep -c "it(" tests/components/insights/ReferenceIdentityCard.test.tsx` returns ≥ 6
    - `grep "Inferred taste signature" tests/components/insights/ReferenceIdentityCard.test.tsx` returns ≥ 1 line
    - `grep "confidence: 0.3" tests/components/insights/ReferenceIdentityCard.test.tsx` returns ≥ 1 line (D-39b-03 gate test)
    - `grep "confidence: null" tests/components/insights/ReferenceIdentityCard.test.tsx` returns ≥ 1 line
    - `npx vitest run tests/components/insights/ReferenceIdentityCard.test.tsx` exits 0 (all 6 tests pass)
  </acceptance_criteria>
  <done>
    Component test file exists, 6 tests green, gate semantics + suppression + headline omission + scale omission all proven.
  </done>
</task>

<task type="auto">
  <name>Task 4: Mount ReferenceIdentityCard + fallback caption + 3-CTA block on /watch/{id} as Server-Component siblings of &lt;WatchDetail/&gt; (B1 — server/client boundary fix)</name>
  <files>src/app/watch/[id]/page.tsx</files>
  <read_first>
    - src/app/watch/[id]/page.tsx (FULL — 68 lines; Server Component; currently delegates ALL rendering to <WatchDetail/>)
    - src/components/watch/WatchDetail.tsx (FULL — 462 lines; `'use client'` at line 1; CollectionFitCard mounted inside at line 445; NO existing 3-CTA block — verify with `grep -c "Add to Wishlist" src/components/watch/WatchDetail.tsx` → expected 0)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-PATTERNS.md §7 (lines 619-663 — mount pattern + import block + render order)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-UI-SPEC.md §"Render Order — /watch/{id} and /catalog/{id}" (lines 251-271 — fresh-account sequence: ReferenceIdentityCard OR fallback caption → Same family rail → Lineage rail → CTA block)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-CONTEXT.md D-39b-04 (identical rendering both surfaces) + D-39b-03 (confidence gate)
    - node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md (Next 16 server/client boundary rules — RSC importable into RSC; RSC NOT importable into Client Component)
    - src/components/search/WatchSearchRowsAccordion.tsx:170-200 (existing 3-CTA pattern: "Add to Wishlist" + "Add to Collection" — reference for visual + behavioral shape of the CTAs the executor constructs here)
  </read_first>
  <behavior>
    - `src/app/watch/[id]/page.tsx` remains a Server Component (no `'use client'`).
    - The page's `<main>` (or `<div className="container ...">`) JSX body renders, in order:
      1. `<WatchDetail watch={watch} collection={collection} preferences={preferences} lastWornDate={lastWornDate} viewerCanEdit={isOwner} verdict={verdict} />` (unchanged — already mounted)
      2. A NEW Server-Component sibling block that conditionally renders ReferenceIdentityCard OR fallback caption when `collection.length === 0`
      3. (Reserved comment placeholder for Plan 39b-05 to mount SameFamilyRail + LineageRail)
      4. A NEW Server-Component sibling block that renders the 3-CTA block (Add to Wishlist / Add to Collection / Skip) ONLY when `collection.length === 0` (fresh-account viewer)
    - The owner-populated branch (`collection.length > 0`) is unchanged. CollectionFitCard continues to render INSIDE WatchDetail (it's a Client-Component import that's allowed; CollectionFitCard's own `'use client'`-less status is enforced elsewhere). No new RSC siblings render for owner-populated viewers in this task.
  </behavior>
  <action>
    Reshape `src/app/watch/[id]/page.tsx` so that the new Phase 39b RSC content (ReferenceIdentityCard, fallback caption, 3-CTA block) renders as Server-Component **siblings** of `<WatchDetail/>` — NOT inside it.

    Architectural rationale (B1 fix): `WatchDetail` is a Client Component (`'use client'` at WatchDetail.tsx:1). Next 16's server/client boundary rules forbid importing a Server Component (ReferenceIdentityCard) into a Client Component. The solution is to keep `WatchDetail` as-is (CollectionFitCard already mounts correctly INSIDE it for the owner-populated case) and add the new fresh-account content at the page.tsx level (which IS a Server Component) as siblings. Server-tree composition is valid in Next 16.

    Step 1 — Add the imports at the top of page.tsx (after existing imports):
    ```typescript
    import { ReferenceIdentityCard } from '@/components/insights/ReferenceIdentityCard'
    import Link from 'next/link'
    import { Button } from '@/components/ui/button'
    ```
    (Server Component imports are unrestricted; `Button` is a Client Component, but importing a Client Component into a Server Component is the standard server-imports-client pattern that Next 16 explicitly supports — same as PopularCollectorRow imports FollowButton.)

    Step 2 — Reshape the JSX return block. Replace the existing single-child wrapper:
    ```tsx
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <WatchDetail ... />
      </div>
    )
    ```
    with the multi-child Server-Component sibling composition:
    ```tsx
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
        <WatchDetail
          watch={watch}
          collection={collection}
          preferences={preferences}
          lastWornDate={lastWornDate}
          viewerCanEdit={isOwner}
          verdict={verdict}
        />

        {/* Phase 39b NSV-06 — Fresh-account viewer: ReferenceIdentityCard OR fallback caption.
            Server-Component sibling of <WatchDetail/> (B1 fix — RSC cannot be imported into the
            'use client' WatchDetail island; compose at the server tree level instead). */}
        {collection.length === 0 && watch.catalogTaste && watch.catalogTaste.confidence !== null && watch.catalogTaste.confidence >= 0.5 && (
          <ReferenceIdentityCard taste={watch.catalogTaste} />
        )}
        {collection.length === 0 && (!watch.catalogTaste || watch.catalogTaste.confidence === null || watch.catalogTaste.confidence < 0.5) && (
          <p className="text-sm text-muted-foreground">
            Add a few watches to see how this one fits your collection.
          </p>
        )}

        {/* Plan 39b-05 mounts SameFamilyRail + LineageRail here (both viewer states) */}

        {/* Phase 39b NSV-06 — Fresh-account 3-CTA block. UI-SPEC § Render Order line 266 — first
            phase to introduce these CTAs on /watch/{id} (search-page pattern from
            WatchSearchRowsAccordion.tsx:170-200 is the reference). Only the fresh-account
            viewer sees these — D-39b-04 / UI-SPEC § "Owner-populated viewer sees: ...
            No CTAs". */}
        {collection.length === 0 && (
          <div className="flex flex-wrap gap-2">
            <Link href={`/watch/${watch.id}/edit?status=wishlist`}>
              <Button variant="outline">Add to Wishlist</Button>
            </Link>
            <Link href={`/watch/${watch.id}/edit?status=owned`}>
              <Button>Add to Collection</Button>
            </Link>
            <Link href="/">
              <Button variant="ghost">Skip</Button>
            </Link>
          </div>
        )}
      </div>
    )
    ```

    Note on CTA link targets: this plan ships the CTA UI (visual + label + render-order contract). The exact `href` destinations above use the existing `/watch/{id}/edit` route as a sensible placeholder that already exists in the route tree. If a Phase 39b-follow-up wishes to wire the CTAs to a dedicated "add catalog watch to MY collection" action, that is out of scope here — the AC only verifies the buttons render with the load-bearing labels.

    Step 3 — Do NOT mount SameFamilyRail or LineageRail in this task. Plan 39b-05 owns those mounts. Leave the placeholder comment `{/* Plan 39b-05 mounts SameFamilyRail + LineageRail here */}` between the card/caption block and the CTA block.

    Step 4 — Do NOT remove or modify `<WatchDetail/>`. The owner-populated CollectionFitCard mount inside WatchDetail.tsx:445 is unchanged.

    Step 5 — Verify the 3-CTA block does NOT already exist anywhere in the codebase for /watch/{id} before constructing it. Sanity-check command:
    ```bash
    grep -c "Add to Wishlist" src/components/watch/WatchDetail.tsx
    grep -c "Add to Wishlist" 'src/app/watch/[id]/page.tsx'
    ```
    Expected BEFORE this task: both return 0 (no existing 3-CTA on this route — confirmed by repo search). AFTER this task: WatchDetail.tsx still returns 0 (CTAs are NOT moved INTO it); page.tsx returns ≥ 1.

    Forbidden:
    - Do NOT add `'use client'` to `src/app/watch/[id]/page.tsx` (it MUST remain a Server Component; ReferenceIdentityCard is a Server Component and is imported here).
    - Do NOT import ReferenceIdentityCard into `src/components/watch/WatchDetail.tsx` (would violate Next 16 boundary rules — Client Component cannot import Server Component).
    - Do NOT modify `<WatchDetail/>` internals or the CollectionFitCard mount inside it (owner-populated branch is locked).
    - Do NOT touch the `collection.length > 0` (owner-populated) branch.
    - Do NOT render numeric confidence anywhere (D-39b-02).
    - The fallback caption copy is LOAD-BEARING per UI-SPEC §Copywriting Contract — use it verbatim: `Add a few watches to see how this one fits your collection.` (with period, no exclamation).
    - The 3-CTA labels are LOAD-BEARING per UI-SPEC § Render Order line 266: `Add to Wishlist`, `Add to Collection`, `Skip` (exact strings).
  </action>
  <verify>
    <automated>grep -c "ReferenceIdentityCard" 'src/app/watch/[id]/page.tsx'</automated>
    <automated>grep "Add a few watches to see how this one fits your collection." 'src/app/watch/[id]/page.tsx'</automated>
    <automated>grep -c "collection.length === 0" 'src/app/watch/[id]/page.tsx'</automated>
    <automated>grep -cE "^['\"]use client['\"]" 'src/app/watch/[id]/page.tsx'</automated>
    <automated>grep -c "Add to Wishlist" 'src/app/watch/[id]/page.tsx'</automated>
    <automated>grep -c "Add to Wishlist" src/components/watch/WatchDetail.tsx</automated>
    <automated>npx tsc --noEmit 2>&1 | grep -c "error TS"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "ReferenceIdentityCard" 'src/app/watch/[id]/page.tsx'` returns ≥ 2 (import + JSX mount)
    - `grep "Add a few watches to see how this one fits your collection." 'src/app/watch/[id]/page.tsx'` returns 1 line (load-bearing fallback caption)
    - `grep -c "collection.length === 0" 'src/app/watch/[id]/page.tsx'` returns ≥ 3 (card mount conditional + fallback conditional + CTA-block conditional)
    - `grep -E "confidence\s*>=\s*0\.5" 'src/app/watch/[id]/page.tsx'` returns ≥ 1 line (D-39b-03 gate explicit)
    - `grep -cE "^['\"]use client['\"]" 'src/app/watch/[id]/page.tsx'` returns 0 (still a Server Component — B1 fix invariant)
    - `grep -c "Add to Wishlist" 'src/app/watch/[id]/page.tsx'` returns ≥ 1 (3-CTA block constructed in page.tsx — UI-SPEC line 266)
    - `grep -c "Add to Collection" 'src/app/watch/[id]/page.tsx'` returns ≥ 1
    - `grep -c "Skip" 'src/app/watch/[id]/page.tsx'` returns ≥ 1
    - `grep -c "Add to Wishlist" src/components/watch/WatchDetail.tsx` returns 0 (CTAs NOT inside the client island — B1 disposition: CTAs live in page.tsx as Server-Component siblings, WatchDetail.tsx is not touched)
    - `grep -c "Plan 39b-05 mounts SameFamilyRail + LineageRail here" 'src/app/watch/[id]/page.tsx'` returns 1 line (placeholder for downstream wiring)
    - `npx tsc --noEmit 2>&1 | grep -c "error TS"` ≤ 27 (Phase 36 baseline)
    - Build smoke: `npm run build 2>&1 | tail -10` exits 0 (catches Next 16 server/client boundary regressions — would fail if ReferenceIdentityCard were imported into WatchDetail)
  </acceptance_criteria>
  <done>
    Fresh-account viewer (collection.length === 0) on /watch/{id} sees ReferenceIdentityCard when confidence ≥ 0.5; sees fallback caption otherwise; sees the 3-CTA block (Add to Wishlist / Add to Collection / Skip) below the card/caption. All three render as Server-Component siblings of <WatchDetail/>, NOT inside it (B1 fix — Next 16 RSC-into-client-component prohibition honored). Owner branch unchanged.
  </done>
</task>

<task type="auto">
  <name>Task 5: Mount ReferenceIdentityCard on /catalog/{id} G-4 fresh-account branch</name>
  <files>src/app/catalog/[catalogId]/page.tsx</files>
  <read_first>
    - src/app/catalog/[catalogId]/page.tsx (FULL — 211 lines; G-4 branch at lines 79-113; the comment at lines 112-113 is the load-bearing reshape target)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-PATTERNS.md §8 (lines 666-716 — mount pattern + adapter from CatalogEntry to CatalogTasteAttributes)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-RESEARCH.md §Pitfall 9 (CatalogEntry vs Watch.catalogTaste shape — fields are top-level on CatalogEntry)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-UI-SPEC.md §"/catalog/{id} render order" (lines 272-288)
  </read_first>
  <action>
    Patch `src/app/catalog/[catalogId]/page.tsx` to mount ReferenceIdentityCard in the G-4 fresh-account branch (`collection.length === 0` → currently "no card, no CTAs" comment at lines 112-113).

    Step 1 — Add the import (after existing component imports):
    ```typescript
    import { ReferenceIdentityCard } from '@/components/insights/ReferenceIdentityCard'
    ```

    Step 2 — Construct a `CatalogTasteAttributes` adapter inline (Pitfall 9 — fields live at top level on `catalogEntry`, not nested under a `catalogTaste` key). After the `catalogEntry` fetch resolves (and after the UUID guard), derive:

    ```typescript
    const catalogTaste: CatalogTasteAttributes | null = catalogEntry ? {
      formality: catalogEntry.formality,
      sportiness: catalogEntry.sportiness,
      heritageScore: catalogEntry.heritageScore,
      primaryArchetype: catalogEntry.primaryArchetype,
      eraSignal: catalogEntry.eraSignal,
      designMotifs: catalogEntry.designMotifs,
      confidence: catalogEntry.confidence,
      extractedFromPhoto: catalogEntry.extractedFromPhoto,
    } : null
    ```

    Add a type import if needed:
    ```typescript
    import type { CatalogTasteAttributes } from '@/lib/types'
    ```

    Step 3 — Replace the "no card, no CTAs" suppression at lines 112-113. The G-4 fresh-account branch (collection.length === 0) MUST now render either:
    - ReferenceIdentityCard (when catalogTaste exists and confidence >= 0.5) + the existing 3-CTA block below
    - OR the fallback caption + 3-CTA block (when catalogTaste null or confidence < 0.5)

    Use the SAME conditional shape as `/watch/{id}` (D-39b-04 — identical rendering both surfaces):

    ```tsx
    {collection.length === 0 && catalogTaste && catalogTaste.confidence !== null && catalogTaste.confidence >= 0.5 && (
      <ReferenceIdentityCard taste={catalogTaste} />
    )}
    {collection.length === 0 && (!catalogTaste || catalogTaste.confidence === null || catalogTaste.confidence < 0.5) && (
      <p className="text-sm text-muted-foreground">
        Add a few watches to see how this one fits your collection.
      </p>
    )}
    ```

    The existing 3-CTA block (Add to Wishlist / Add to Collection / Skip) renders BELOW these (D-39b-04 — CTAs always render in the fresh-account branch, card OR fallback caption above them).

    Step 4 — Leave a comment `{/* Plan 39b-04 mounts OtherOwnersRoster here */}` and `{/* Plan 39b-05 mounts SameFamilyRail + LineageRail here */}` at the appropriate UI-SPEC § "/catalog/{id} render order" positions (between verdict-card and CTAs). Plans 39b-04 and 39b-05 own those mounts.

    Forbidden:
    - Do NOT modify the `viewerOwnedRow` branch or the populated `collection.length > 0` branch.
    - Do NOT mount the OtherOwnersRoster or rails in this task.
    - Do NOT remove the existing 3-CTA block.
    - Do NOT add `'use client'`.
  </action>
  <verify>
    <automated>grep -c "ReferenceIdentityCard" 'src/app/catalog/[catalogId]/page.tsx'</automated>
    <automated>grep "Add a few watches to see how this one fits your collection." 'src/app/catalog/[catalogId]/page.tsx'</automated>
    <automated>grep -c "catalogTaste" 'src/app/catalog/[catalogId]/page.tsx'</automated>
    <automated>grep -E "confidence\s*>=\s*0\.5" 'src/app/catalog/[catalogId]/page.tsx'</automated>
    <automated>npx tsc --noEmit 2>&1 | grep -c "error TS"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "ReferenceIdentityCard" 'src/app/catalog/[catalogId]/page.tsx'` returns ≥ 2 (import + JSX mount)
    - `grep "Add a few watches to see how this one fits your collection." 'src/app/catalog/[catalogId]/page.tsx'` returns 1 line (D-39b-04 identical fallback caption)
    - `grep -c "catalogTaste" 'src/app/catalog/[catalogId]/page.tsx'` returns ≥ 3 (adapter + 2 conditionals)
    - `grep -E "confidence\s*>=\s*0\.5" 'src/app/catalog/[catalogId]/page.tsx'` returns ≥ 1 line
    - `grep "verdict stays null AND actionsSpec stays" 'src/app/catalog/[catalogId]/page.tsx'` returns 0 lines (the old "no card, no CTAs" comment has been removed/superseded)
    - `npx tsc --noEmit 2>&1 | grep -c "error TS"` ≤ 27 (Phase 36 baseline)
    - `npm run build 2>&1 | tail -10` exits 0 (Next 16 boundary check)
  </acceptance_criteria>
  <done>
    Fresh-account viewer on /catalog/{id} now sees ReferenceIdentityCard or fallback caption above the CTA block. D-39b-04 identical-rendering proven by matching conditional shape on both surfaces.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Server RSC → rendered HTML | ReferenceIdentityCard renders `taste.designMotifs[]` strings via React text nodes; auto-escaped |
| `@/lib/similarity` engine → presentation layer | Static guard enforces zero imports; bundle isolation is the boundary |
| Server Component page.tsx → Client Component WatchDetail | Standard server-imports-client composition (props serialized); RSCs (ReferenceIdentityCard) are NOT imported into the client island — they render as server siblings at the page tree level |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-39b-01 | Information Disclosure | n/a — ReferenceIdentityCard reads only watches_catalog (all-public) | accept | No collector-level data flows through this component; catalog refs are public per §watches_catalog RLS (Phase 36) |
| T-39b-03 | Tampering | n/a — no `returnTo` flow in this plan | accept | Sign-in CTA is owned by Plan 39b-03 (LockedTabCard); ReferenceIdentityCard has no auth-redirect surface |
| Bundle bloat (engine leak into client bundle) | Tampering / DoS-low | src/components/insights/ReferenceIdentityCard.tsx | mitigate | Static guard `tests/static/ReferenceIdentityCard.no-engine.test.ts` (Task 1) — asserts zero imports from `@/lib/similarity`, `@/lib/verdict/composer`, `@/lib/verdict/viewerTasteProfile`, or `server-only`. Mirrors Phase 20 D-04 + CollectionFitCard precedent. |
| Next 16 boundary regression (RSC imported into Client Component) | Build-time crash | src/app/watch/[id]/page.tsx + src/components/watch/WatchDetail.tsx | mitigate | B1 fix: ReferenceIdentityCard mounted as Server-Component sibling of `<WatchDetail/>` at the page.tsx level — never imported into WatchDetail. Build smoke (`npm run build`) is the automated regression guard. |
| XSS via designMotifs strings | XSS | src/components/insights/ReferenceIdentityCard.tsx | mitigate | React text-node auto-escape; no `dangerouslySetInnerHTML`; motif vocab is closed (src/lib/taste/vocab.ts:16-41) and validated upstream by Phase 19.1 |
</threat_model>

<verification>
After all 5 tasks:
- `npx vitest run tests/static/ReferenceIdentityCard.no-engine.test.ts tests/components/insights/ReferenceIdentityCard.test.tsx` exits 0
- `npm test 2>&1 | tail -5` — no NEW test failures other than the intentional RED state from Plan 39b-01 Task 2 (the `tests/static/hierarchy.lineage-3-node.test.ts` assertion "getSameFamilyForCatalog function is exported" remains RED until Plan 39b-05 lands the DAL). Phase 36 baseline otherwise preserved.
- `npm run build 2>&1 | tail -10` exits 0 (Next 16 server/client boundary regression guard for B1 fix)
- Manual smoke (operator UAT, optional): sign in as a fresh account (empty collection), navigate to `/watch/{id}` for a high-confidence watch — verify ReferenceIdentityCard renders ABOVE WatchDetail content, 3-CTA block renders BELOW (Add to Wishlist / Add to Collection / Skip). Navigate to a low-confidence catalog — verify fallback caption renders.
</verification>

<success_criteria>
- ReferenceIdentityCard renders identically on `/watch/{id}` and `/catalog/{id}` for fresh-account viewers when `confidence >= 0.5` (NSV-06 + NSV-20 success criterion #2)
- Below threshold (or null taste), card is suppressed and fallback caption + CTAs render
- On `/watch/{id}`: ReferenceIdentityCard + fallback caption + 3-CTA block render as Server-Component siblings of `<WatchDetail/>` (B1 fix); page.tsx remains a Server Component; WatchDetail.tsx is not modified
- Pure-renderer import isolation enforced by passing static guard (D-39b-01)
- Component test suite (6 tests) green
- No new tsc errors above Phase 36 baseline (27)
- Build smoke green (Next 16 boundary regression guard)
</success_criteria>

<output>
After completion, create `.planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-02-SUMMARY.md` with:
- Task-by-task ship state
- Static guard transition (vacuous-pass → non-vacuously green)
- Component test coverage matrix (6 scenarios)
- Page mount diff summary (before/after JSX snippet for each branch)
- B1 fix verification: assert the JSX tree on /watch/{id} renders <WatchDetail/> + ReferenceIdentityCard/fallback + 3-CTA block as SIBLINGS (not nested inside WatchDetail). Include `grep -c "ReferenceIdentityCard\|Add to Wishlist" src/components/watch/WatchDetail.tsx` returning 0 as evidence.
- Note any deviation from UI-SPEC §ReferenceIdentityCard or D-39b-01..04
</output>
</content>
</invoke>