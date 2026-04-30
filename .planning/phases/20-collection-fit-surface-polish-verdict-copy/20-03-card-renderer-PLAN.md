---
phase: 20
plan: 03
type: execute
wave: 2
depends_on: ["20-01"]
files_modified:
  - src/components/insights/CollectionFitCard.tsx
  - src/components/insights/VerdictSkeleton.tsx
  - src/components/insights/CollectionFitCard.test.tsx
autonomous: true
requirements: [FIT-01]

must_haves:
  truths:
    - "<CollectionFitCard> is a pure renderer — receives VerdictBundle props, no engine import, no Server Action call, no Zustand subscription"
    - "Card renders 3 framings correctly: same-user, cross-user (identical chrome), self-via-cross-user (You own this callout body)"
    - "When verdict.framing === 'self-via-cross-user', card body is the You-own-this callout — NO label badge, NO contextual phrasings, NO mostSimilar list rendered"
    - "<VerdictSkeleton> matches the structural shape of the real card so swap is dimensionally stable (no layout shift)"
    - "Static text-scan guard from Plan 01 (CollectionFitCard.no-engine.test.ts) passes with file-present (real assertion paths exercised)"
  artifacts:
    - path: "src/components/insights/CollectionFitCard.tsx"
      provides: "Pure-renderer card component with VerdictBundle prop"
      exports: ["CollectionFitCard"]
      contains: "Collection Fit"
    - path: "src/components/insights/VerdictSkeleton.tsx"
      provides: "Loading skeleton matching CollectionFitCard structural shape"
      exports: ["VerdictSkeleton"]
      contains: "Skeleton"
    - path: "src/components/insights/CollectionFitCard.test.tsx"
      provides: "8 RTL render tests covering 3 framings + role-overlap warning + most-similar list visibility"
      contains: "framing"
  key_links:
    - from: "src/components/insights/CollectionFitCard.tsx"
      to: "src/lib/verdict/types"
      via: "type-only import of VerdictBundle"
      pattern: "import type"
    - from: "src/components/insights/CollectionFitCard.tsx"
      to: "src/components/ui/card, src/components/ui/badge"
      via: "shadcn primitives"
      pattern: "from '@/components/ui/card'"
    - from: "src/components/insights/VerdictSkeleton.tsx"
      to: "src/components/ui/skeleton"
      via: "shadcn primitive"
      pattern: "from '@/components/ui/skeleton'"
---

<objective>
Build the pure-renderer `<CollectionFitCard>` (FIT-01 / D-04) and the matching `<VerdictSkeleton>` loading state. The card receives a finished `VerdictBundle` and renders it; computation happens upstream in Plan 04 (Server Component) and Plan 05 (Server Action).

Purpose: Lock the renderer contract so consumers in Plans 04, 05, 06 import a single component with a single prop shape. Pitfall 1 mitigation enforced via the no-engine static guard from Plan 01 — once this card exists, the guard kicks in and asserts no engine import.

Output:
- `src/components/insights/CollectionFitCard.tsx` — pure renderer, three framings.
- `src/components/insights/VerdictSkeleton.tsx` — structural skeleton matching the card's shape.
- `src/components/insights/CollectionFitCard.test.tsx` — 8 RTL tests (replaces Plan 01 it.todo scaffold).
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
@.planning/phases/20-collection-fit-surface-polish-verdict-copy/20-01-SUMMARY.md

<interfaces>
<!-- From Plan 01: src/lib/verdict/types.ts -->

```typescript
export type Framing = 'same-user' | 'cross-user' | 'self-via-cross-user'
export interface VerdictMostSimilar { watch: Watch; score: number }
export interface VerdictBundleFull {
  framing: 'same-user' | 'cross-user'
  label: SimilarityLabel
  headlinePhrasing: string         // e.g. "Core Fit"
  contextualPhrasings: string[]    // composer-generated; non-empty (composer guarantees)
  mostSimilar: VerdictMostSimilar[]
  roleOverlap: boolean
}
export interface VerdictBundleSelfOwned {
  framing: 'self-via-cross-user'
  ownedAtIso: string               // viewer.acquisitionDate ?? createdAt
  ownerHref: string                // /watch/{viewer.watchId}
}
export type VerdictBundle = VerdictBundleFull | VerdictBundleSelfOwned
```

<!-- Existing shadcn primitives -->
```typescript
// src/components/ui/card.tsx
export function Card(props: HTMLAttributes<HTMLDivElement>): JSX.Element
export function CardHeader(props): JSX.Element
export function CardTitle(props): JSX.Element
export function CardContent(props): JSX.Element

// src/components/ui/badge.tsx
export function Badge(props: { variant?: 'outline' | 'default'; children }): JSX.Element

// src/components/ui/skeleton.tsx
export function Skeleton(props: { className?: string }): JSX.Element
```

<!-- lucide-react icons used (per UI-SPEC component reuse table) -->
```typescript
import { AlertTriangle, Watch as WatchIcon, ArrowRight } from 'lucide-react'
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Implement <CollectionFitCard> pure renderer with 3-framing discriminated union</name>
  <files>src/components/insights/CollectionFitCard.tsx, src/components/insights/CollectionFitCard.test.tsx</files>
  <read_first>
    - src/components/insights/SimilarityBadge.tsx (entire file) — existing chrome/rhythm to mirror; copy VERBATIM the role-overlap copy "May compete for wrist time with similar watches" and most-similar list format
    - src/lib/verdict/types.ts (Plan 01) — VerdictBundle / Framing / VerdictBundleFull / VerdictBundleSelfOwned discriminated union
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-UI-SPEC.md § "Component Inventory" → "<CollectionFitCard> (NEW — pure renderer per D-04)" (full layout grid + verbatim copy)
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-UI-SPEC.md § "Component Inventory" → "You own this" callout (D-08 — full visual treatment, date format, link affordance)
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-UI-SPEC.md § Copywriting Contract (verbatim copy: "Collection Fit", "Most Similar in Collection", role-overlap "May compete for wrist time with similar watches", "You own this watch", "Added {date}. Visit your watch detail.", "Visit your watch detail")
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-UI-SPEC.md § Color (no per-label color; outline badge for all 6 labels; text-accent reserved for role-overlap warning)
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-UI-SPEC.md § Typography (text-sm font-medium for headline; text-sm text-muted-foreground for contextual; no italic on hedged copy)
    - src/components/ui/card.tsx, src/components/ui/badge.tsx (existing primitives — confirm prop shapes)
    - src/components/explore/DiscoveryWatchCard.tsx — existing pattern for pure presentational components (no client directives needed)
  </read_first>
  <behavior>
    - When `verdict.framing === 'same-user'` → renders `<Card>` with header "Collection Fit" + outline `<Badge>` containing `verdict.headlinePhrasing`; body has headline phrasing as `<p className="text-sm font-medium text-foreground">` (the FIRST contextualPhrasing — composer guarantees length ≥ 1); remaining contextualPhrasings as bulleted `<ul>`; conditional most-similar section; conditional role-overlap warning row.
    - When `verdict.framing === 'cross-user'` → IDENTICAL output to same-user (UI-SPEC § Color: no lens indicator).
    - When `verdict.framing === 'self-via-cross-user'` → renders `<Card>` with `<CardContent className="py-4">` containing the You-own-this callout (no `<CardHeader>`); icon + "You own this watch" title row; "Added {formatted date}." text; `<Link>` "Visit your watch detail →" pointing to `verdict.ownerHref`.
    - When `verdict.mostSimilar.length === 0` → mostSimilar section NOT rendered (no empty heading).
    - When `verdict.roleOverlap === false` → role-overlap warning NOT rendered.
    - When `verdict.roleOverlap === true` → renders `<AlertTriangle />` from lucide-react with class `size-4` + `text-accent`; copy "May compete for wrist time with similar watches" verbatim.
    - Card never imports `analyzeSimilarity`, `composeVerdictCopy`, `computeVerdictBundle`, `composer`, `viewerTasteProfile`, or any `server-only` module.
    - Card has NO `'use client'` directive (it's a pure presentational component; works in either RSC or client tree).
    - Card has NO state, NO hooks, NO `useEffect`, NO Zustand subscription.
  </behavior>
  <action>
**File 1: `src/components/insights/CollectionFitCard.tsx`**

```typescript
import Link from 'next/link'
import { AlertTriangle, Watch as WatchIcon, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { VerdictBundle } from '@/lib/verdict/types'

/**
 * Phase 20 FIT-01 / D-04: pure-renderer Collection Fit card.
 *
 * Receives a finished VerdictBundle from caller (Server Component in Plans 04/06,
 * Client Component via Server Action in Plan 05). Card has no logic — no engine
 * import, no composer call, no state, no hooks.
 *
 * Pitfall 1 mitigation: this file MUST NOT import @/lib/similarity or
 * @/lib/verdict/composer. Enforced by tests/static/CollectionFitCard.no-engine.test.ts.
 *
 * Three framings via VerdictBundle discriminated union:
 *   - 'same-user' / 'cross-user' → full verdict (D-03/D-04 paths)
 *   - 'self-via-cross-user' (D-08) → "You own this watch" callout
 *
 * D-07 (viewer collection size 0 → hide card entirely) is enforced by the
 * CALLER, not this component. Caller renders nothing when verdict is null.
 */
interface CollectionFitCardProps {
  verdict: VerdictBundle
}

export function CollectionFitCard({ verdict }: CollectionFitCardProps) {
  if (verdict.framing === 'self-via-cross-user') {
    return <YouOwnThisCallout ownedAtIso={verdict.ownedAtIso} ownerHref={verdict.ownerHref} />
  }

  // verdict is VerdictBundleFull from here on
  const [headline, ...rest] = verdict.contextualPhrasings

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          Collection Fit
          <Badge variant="outline">{verdict.headlinePhrasing}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Headline phrasing — text-sm font-medium per UI-SPEC § Typography */}
        {headline && (
          <p className="text-sm font-medium text-foreground">{headline}</p>
        )}

        {/* Contextual phrasings — text-sm muted, single column, space-y-1 */}
        {rest.length > 0 && (
          <ul className="text-sm text-muted-foreground space-y-1">
            {rest.map((p, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-muted-foreground/70" aria-hidden>•</span>
                {p}
              </li>
            ))}
          </ul>
        )}

        {/* Most-similar list — only when non-empty */}
        {verdict.mostSimilar.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2">
              Most Similar in Collection
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              {verdict.mostSimilar.map(({ watch, score }) => (
                <li key={watch.id} className="flex items-center justify-between">
                  <span className="truncate">
                    {watch.brand} {watch.model}
                  </span>
                  <span className="text-muted-foreground/70">
                    {Math.round(score * 100)}% similar
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Role-overlap warning — verbatim copy from SimilarityBadge.tsx:78 */}
        {verdict.roleOverlap && (
          <p className="text-sm text-accent flex items-center gap-2">
            <AlertTriangle className="size-4" aria-hidden />
            May compete for wrist time with similar watches
          </p>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * D-08 self-via-cross-user callout. Replaces the entire card body — no header,
 * no verdict computed.
 *
 * Date format: Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
 * Source: viewer.watch.acquisitionDate ?? viewer.watch.createdAt — caller threads as ownedAtIso.
 */
function YouOwnThisCallout({ ownedAtIso, ownerHref }: { ownedAtIso: string; ownerHref: string }) {
  const formatted = formatOwnedDate(ownedAtIso)
  return (
    <Card>
      <CardContent className="py-4 space-y-2">
        <p className="text-sm font-medium text-foreground flex items-center gap-2">
          <WatchIcon className="size-4 text-muted-foreground" aria-hidden />
          You own this watch
        </p>
        <p className="text-sm text-muted-foreground">
          Added {formatted}.
        </p>
        <Link
          href={ownerHref}
          className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline inline-flex items-center gap-1"
        >
          Visit your watch detail
          <ArrowRight className="inline size-3" aria-hidden />
        </Link>
      </CardContent>
    </Card>
  )
}

function formatOwnedDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'recently'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}
```

**File 2: `src/components/insights/CollectionFitCard.test.tsx`** — REPLACE Plan 01 todos with 8 real RTL tests.

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

import { CollectionFitCard } from '@/components/insights/CollectionFitCard'
import type { VerdictBundle } from '@/lib/verdict/types'
import type { Watch } from '@/lib/types'

const buildWatch = (id: string, brand: string, model: string): Watch => ({
  id, brand, model,
  status: 'owned',
  movement: 'automatic',
  complications: [],
  styleTags: [], designTraits: [], roleTags: [],
})

const baseFullVerdict: VerdictBundle = {
  framing: 'same-user',
  label: 'core-fit',
  headlinePhrasing: 'Core Fit',
  contextualPhrasings: ['Lines up cleanly with your established taste.'],
  mostSimilar: [],
  roleOverlap: false,
}

describe('FIT-01 CollectionFitCard (Plan 03)', () => {
  it('renders headline + contextual phrasings + most-similar list for framing="same-user"', () => {
    const verdict: VerdictBundle = {
      ...baseFullVerdict,
      contextualPhrasings: ['Headline.', 'First context.', 'Second context.'],
      mostSimilar: [
        { watch: buildWatch('w1', 'Rolex', 'Submariner'), score: 0.78 },
      ],
    }
    render(<CollectionFitCard verdict={verdict} />)
    expect(screen.getByText('Collection Fit')).toBeInTheDocument()
    expect(screen.getByText('Core Fit')).toBeInTheDocument()
    expect(screen.getByText('Headline.')).toBeInTheDocument()
    expect(screen.getByText('First context.')).toBeInTheDocument()
    expect(screen.getByText('Second context.')).toBeInTheDocument()
    expect(screen.getByText('Most Similar in Collection')).toBeInTheDocument()
    expect(screen.getByText(/Rolex Submariner/)).toBeInTheDocument()
    expect(screen.getByText('78% similar')).toBeInTheDocument()
  })

  it('renders identical chrome for framing="cross-user" (no lens indicator)', () => {
    const verdict: VerdictBundle = { ...baseFullVerdict, framing: 'cross-user' }
    render(<CollectionFitCard verdict={verdict} />)
    expect(screen.getByText('Collection Fit')).toBeInTheDocument()
    expect(screen.queryByText(/viewing|someone else/i)).not.toBeInTheDocument()
  })

  it('renders "You own this watch" callout for framing="self-via-cross-user" (no verdict)', () => {
    const verdict: VerdictBundle = {
      framing: 'self-via-cross-user',
      ownedAtIso: '2026-04-12T00:00:00.000Z',
      ownerHref: '/watch/per-user-uuid-abc',
    }
    render(<CollectionFitCard verdict={verdict} />)
    expect(screen.getByText('You own this watch')).toBeInTheDocument()
    expect(screen.getByText(/Apr 12, 2026/)).toBeInTheDocument()
    expect(screen.getByText(/Visit your watch detail/)).toBeInTheDocument()
    expect(screen.queryByText('Collection Fit')).not.toBeInTheDocument()
    expect(screen.queryByText(/Most Similar/)).not.toBeInTheDocument()
  })

  it('hides most-similar section when verdict.mostSimilar is empty array', () => {
    render(<CollectionFitCard verdict={baseFullVerdict} />)
    expect(screen.queryByText('Most Similar in Collection')).not.toBeInTheDocument()
  })

  it('hides role-overlap warning when verdict.roleOverlap is false', () => {
    render(<CollectionFitCard verdict={baseFullVerdict} />)
    expect(screen.queryByText(/May compete for wrist time/)).not.toBeInTheDocument()
  })

  it('renders <AlertTriangle /> from lucide-react when roleOverlap is true (replaces inline SVG)', () => {
    const verdict: VerdictBundle = { ...baseFullVerdict, roleOverlap: true }
    const { container } = render(<CollectionFitCard verdict={verdict} />)
    expect(screen.getByText(/May compete for wrist time/)).toBeInTheDocument()
    // lucide-react renders an <svg> with class "lucide" — confirm it's present
    const svgs = container.querySelectorAll('svg')
    expect(svgs.length).toBeGreaterThan(0)
  })

  it('uses verbatim copy "May compete for wrist time with similar watches" from SimilarityBadge.tsx:78', () => {
    const verdict: VerdictBundle = { ...baseFullVerdict, roleOverlap: true }
    render(<CollectionFitCard verdict={verdict} />)
    expect(screen.getByText('May compete for wrist time with similar watches')).toBeInTheDocument()
  })

  it('renders title "Collection Fit" with outline Badge variant for label', () => {
    render(<CollectionFitCard verdict={baseFullVerdict} />)
    expect(screen.getByText('Collection Fit')).toBeInTheDocument()
    expect(screen.getByText('Core Fit')).toBeInTheDocument()
  })
})
```
  </action>
  <verify>
    <automated>npx vitest run src/components/insights/CollectionFitCard tests/static/CollectionFitCard.no-engine --reporter=basic</automated>
  </verify>
  <acceptance_criteria>
    - `test -f src/components/insights/CollectionFitCard.tsx` exits 0
    - `grep "export function CollectionFitCard" src/components/insights/CollectionFitCard.tsx` exits 0
    - `grep "from '@/lib/similarity'" src/components/insights/CollectionFitCard.tsx` exits 1 (Pitfall 1 — no engine import)
    - `grep "from '@/lib/verdict/composer'" src/components/insights/CollectionFitCard.tsx` exits 1 (Pitfall 1 — no composer import)
    - `grep "analyzeSimilarity" src/components/insights/CollectionFitCard.tsx` exits 1 (no engine call)
    - `grep "computeVerdictBundle" src/components/insights/CollectionFitCard.tsx` exits 1 (no composer call)
    - `grep "import 'server-only'" src/components/insights/CollectionFitCard.tsx` exits 1 (not server-only — pure renderer works in either tree)
    - `grep "'use client'" src/components/insights/CollectionFitCard.tsx` exits 1 (no client directive — works as RSC)
    - `grep "useState\\|useEffect\\|useTransition\\|useMemo\\|useCallback" src/components/insights/CollectionFitCard.tsx` exits 1 (no hooks)
    - `grep "useWatchStore\\|usePreferencesStore" src/components/insights/CollectionFitCard.tsx` exits 1 (no Zustand)
    - `grep "Collection Fit" src/components/insights/CollectionFitCard.tsx` exits 0 (verbatim title)
    - `grep "You own this watch" src/components/insights/CollectionFitCard.tsx` exits 0 (D-08 verbatim)
    - `grep "Visit your watch detail" src/components/insights/CollectionFitCard.tsx` exits 0 (UI-SPEC verbatim)
    - `grep "May compete for wrist time with similar watches" src/components/insights/CollectionFitCard.tsx` exits 0 (verbatim — SimilarityBadge.tsx:78 carryover)
    - `grep "Most Similar in Collection" src/components/insights/CollectionFitCard.tsx` exits 0
    - `grep "AlertTriangle" src/components/insights/CollectionFitCard.tsx` exits 0 (lucide replaces inline SVG)
    - `grep "from 'lucide-react'" src/components/insights/CollectionFitCard.tsx` exits 0
    - `grep "Intl.DateTimeFormat" src/components/insights/CollectionFitCard.tsx` exits 0 (D-08 date format)
    - `grep "dangerouslySetInnerHTML" src/components/insights/CollectionFitCard.tsx` exits 1 (T-20-02-02 mitigation — no XSS surface)
    - `grep -c "it\.todo" src/components/insights/CollectionFitCard.test.tsx` returns 0
    - `grep -cE "^\s*it\(" src/components/insights/CollectionFitCard.test.tsx` returns 8
    - `npx vitest run src/components/insights/CollectionFitCard tests/static/CollectionFitCard.no-engine --reporter=basic` exits 0 (8 card tests + 3 static guard tests passing — guard now exercises real assertions since file exists)
  </acceptance_criteria>
  <done>CollectionFitCard implemented as pure renderer; 8 RTL tests pass; static no-engine guard now exercises real assertions and passes.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Implement <VerdictSkeleton> matching the card's structural shape</name>
  <files>src/components/insights/VerdictSkeleton.tsx</files>
  <read_first>
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-UI-SPEC.md § "Component Inventory" → "Loading state for accordion expand (open question 6 from prompt)" — full skeleton block with exact pulse heights and widths
    - src/components/ui/skeleton.tsx (entire file) — Skeleton primitive contract
    - src/components/insights/CollectionFitCard.tsx (just-built file from Task 1) — confirm card shape so skeleton mirrors
  </read_first>
  <action>
**File: `src/components/insights/VerdictSkeleton.tsx`**

Implement EXACTLY the dimensions specified in UI-SPEC § Loading state:

```typescript
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Phase 20 D-06: structural skeleton for the FIT-04 search-row inline expand.
 *
 * Mirrors <CollectionFitCard> shape so the swap from skeleton → real card is
 * dimensionally stable (no layout shift).
 *
 * Heights and widths from UI-SPEC § "Component Inventory" → "Loading state":
 *   - Title: h-4 w-24
 *   - Badge: h-5 w-16 rounded-4xl
 *   - Headline: h-4 w-full
 *   - Context lines: h-3.5 w-3/4 + h-3.5 w-2/3
 *   - Most-similar heading: h-3.5 w-32
 *   - List rows: h-3.5 w-1/2 left + h-3.5 w-12 right per row
 */
export function VerdictSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-16 rounded-4xl" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-4 w-full" />
        <div className="space-y-1">
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-32" />
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-3.5 w-12" />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-3.5 w-12" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

Rules:
- No `'use client'` directive (pure presentational; works in either tree).
- No state, no hooks.
- Imports only `Card`, `CardContent`, `CardHeader` from shadcn card and `Skeleton` from shadcn skeleton.
- Each pulse dimension matches UI-SPEC verbatim.
- No tests required for the skeleton (visual regression only; covered by parent component tests in Plan 05 where the skeleton is rendered during accordion pending state).
  </action>
  <verify>
    <automated>npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "VerdictSkeleton" || echo "OK: no errors in VerdictSkeleton.tsx"</automated>
  </verify>
  <acceptance_criteria>
    - `test -f src/components/insights/VerdictSkeleton.tsx` exits 0
    - `grep "export function VerdictSkeleton" src/components/insights/VerdictSkeleton.tsx` exits 0
    - `grep "from '@/components/ui/skeleton'" src/components/insights/VerdictSkeleton.tsx` exits 0
    - `grep "from '@/components/ui/card'" src/components/insights/VerdictSkeleton.tsx` exits 0
    - `grep "h-4 w-24" src/components/insights/VerdictSkeleton.tsx` exits 0 (title pulse — UI-SPEC verbatim)
    - `grep "h-5 w-16 rounded-4xl" src/components/insights/VerdictSkeleton.tsx` exits 0 (badge pulse)
    - `grep "h-3.5 w-32" src/components/insights/VerdictSkeleton.tsx` exits 0 (most-similar heading pulse)
    - `grep "'use client'" src/components/insights/VerdictSkeleton.tsx` exits 1 (no client directive)
    - `grep "useState\\|useEffect" src/components/insights/VerdictSkeleton.tsx` exits 1 (no hooks)
    - `npx tsc --noEmit` exits 0 (file compiles cleanly)
  </acceptance_criteria>
  <done>VerdictSkeleton implemented matching UI-SPEC pulse dimensions; compiles cleanly; ready to be consumed by Plan 05 accordion.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| upstream caller → renderer props | Caller (Plan 04 Server Component, Plan 05 Server Action) hands a finished VerdictBundle. The card paints fields as plain JSX text — auto-escaped by React. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-20-03-01 | Tampering | CollectionFitCard rendering of contextualPhrasings | mitigate | All slot values originate from catalog rows (controlled by Phase 19.1 LLM extraction or admin curation) and are painted via `{phrasing}` in JSX, which React auto-escapes. No `dangerouslySetInnerHTML`. Acceptance criterion `grep dangerouslySetInnerHTML` returns nothing. |
| T-20-03-02 | Information Disclosure | YouOwnThisCallout date formatting | accept | `ownedAtIso` is the viewer's own watch acquisitionDate — no cross-user leak (caller passes viewer's own row). `Intl.DateTimeFormat` formats locally; no network. |
| T-20-03-03 | Tampering | ownerHref Link href | mitigate | `ownerHref` is constructed by the caller (Plan 06) as `/watch/{viewer.watchId}` — the caller's responsibility to scope to viewer's own row. The card does not validate the URL shape; it trusts the caller. Caller-side acceptance criterion in Plan 06 enforces this is `/watch/{viewer.watches.id}`. |

This plan introduces no Server Action, no DB read, no client-state. The card is a pure presentational function. ASVS L1: V5 input validation handled upstream (composer); V8 data protection (auto-escape via React JSX). No XSS risk because React auto-escapes interpolated strings and no innerHTML is used.
</threat_model>

<verification>
- All 3 frontmatter `files_modified` exist on disk
- `npx vitest run src/components/insights/CollectionFitCard tests/static/CollectionFitCard.no-engine --reporter=basic` exits 0
- `grep "analyzeSimilarity\\|computeVerdictBundle" src/components/insights/CollectionFitCard.tsx` exits 1 (D-04 / Pitfall 1)
- Static guard `tests/static/CollectionFitCard.no-engine.test.ts` from Plan 01 now exercises real assertions (file exists)
</verification>

<success_criteria>
1. `<CollectionFitCard>` is a pure renderer — no engine, no composer, no Server Action, no Zustand subscription, no `'use client'` directive.
2. 8 RTL tests pass (3 framings + most-similar visibility + role-overlap visibility + verbatim copy).
3. `<VerdictSkeleton>` matches UI-SPEC pulse dimensions (h-4/w-24, h-5/w-16, h-3.5/w-32, etc.).
4. Static guard `tests/static/CollectionFitCard.no-engine.test.ts` (from Plan 01) now passes with real assertions exercised.
5. UI-SPEC verbatim copy preserved: "Collection Fit", "Most Similar in Collection", "May compete for wrist time with similar watches", "You own this watch", "Visit your watch detail", "Added {date}.".
</success_criteria>

<output>
After completion, create `.planning/phases/20-collection-fit-surface-polish-verdict-copy/20-03-SUMMARY.md`.
</output>
