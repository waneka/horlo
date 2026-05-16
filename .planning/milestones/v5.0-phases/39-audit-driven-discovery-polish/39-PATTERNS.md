# Phase 39: Audit-Driven Discovery Polish — Pattern Map

**Mapped:** 2026-05-12
**Files analyzed:** 3 (2 modify + 1 create)
**Analogs found:** 3 / 3 (all exact matches)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/insights/CollectionFitCard.tsx` (MODIFY) | component (pure renderer, RSC) | request-response (presentational) | `src/components/insights/SleepingBeautiesSection.tsx` (Link-wrapped `<li>` in same `insights/` dir) | **exact** — same role (insight card list), same data flow (presentational list with Link drill-down) |
| `src/app/u/[username]/[tab]/page.tsx` (MODIFY) | route (Server Component, App Router) | request-response (server-rendered branch reshape) | (self — single-branch reshape; no full-file analog needed) | **self** — minimal local-branch edit; pattern is the inline server-component `<Card>` return shape composed from `card.tsx` + `buttonVariants` |
| `tests/app/common-ground-fallback.test.tsx` (CREATE) | test (integration, vitest + jsdom) | request-response (page-function mock + React-tree assertion) | `tests/app/profile-tab-insights.test.tsx` (same parent route, identical mock harness) | **exact** — same parent file `[tab]/page.tsx`, same mock-and-assert convention |

---

## Pattern Assignments

### `src/components/insights/CollectionFitCard.tsx` (MODIFY — NSV-01 + NSV-15)

**Analog:** `src/components/insights/SleepingBeautiesSection.tsx` (sibling pattern, lines 41-53)
**Also reference:** `src/components/insights/GoodDealsSection.tsx` (lines 45-64, same shape with slightly different inner layout)

**Imports pattern** — `CollectionFitCard.tsx:1-5` (no new imports needed; `Link` already at line 1):
```typescript
import Link from 'next/link'
import { AlertTriangle, Watch as WatchIcon, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { VerdictBundle } from '@/lib/verdict/types'
```

**Current target site** — `CollectionFitCard.tsx:69-78` (the `<li>` to be wrapped):
```typescript
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
```

**Analog Link-wrap pattern** — `SleepingBeautiesSection.tsx:41-53`:
```typescript
{sleeping.map(({ watch, days }) => (
  <li key={watch.id}>
    <Link
      href={`/watch/${watch.id}`}
      className="flex items-center justify-between rounded-md p-2 hover:bg-accent"
    >
      <span className="truncate font-semibold">
        {watch.brand} {watch.model}
      </span>
      <span className="text-sm text-muted-foreground shrink-0">{days} days</span>
    </Link>
  </li>
))}
```

**Target shape (D-07 lock — note `block` + `p-1`, NOT `flex` + `p-2` from the analog):**

D-07 mandates `className="block hover:bg-accent rounded-md p-1"` on the `<Link>`, so the existing `<li>` flex layout must move into an inner wrapper `<span className="flex items-center justify-between">` to preserve the visual contract. From `39-RESEARCH.md` lines 432-447:
```typescript
{verdict.mostSimilar.map(({ watch, score }) => (
  <li key={watch.id}>
    <Link
      href={`/watch/${watch.id}`}
      className="block hover:bg-accent rounded-md p-1"
    >
      <span className="flex items-center justify-between">
        <span className="truncate">{watch.brand} {watch.model}</span>
        <span className="text-muted-foreground/70">
          {Math.round(score * 100)}% similar
        </span>
      </span>
    </Link>
  </li>
))}
```

**Import-boundary guard** — `tests/static/CollectionFitCard.no-engine.test.ts:12-40` forbids three patterns: `from '@/lib/similarity'`, `from '@/lib/verdict/composer'`, `from 'server-only'`, `from '@/lib/verdict/viewerTasteProfile'`. `next/link` is NOT on the deny list. Patch must NOT add any new imports.

---

### `src/app/u/[username]/[tab]/page.tsx` (MODIFY — NSV-12)

**Analog:** self (single-branch reshape, no full-file analog). Composition pattern follows shadcn `Card` + `buttonVariants`-on-`Link` (UI-SPEC § "Button + Link composition").

**Current target site** — `page.tsx:80-94` (the no-overlap branch to reshape):
```typescript
if (tab === 'common-ground') {
  const overlap = await resolveCommonGround({
    viewerId,
    ownerId: profile.id,
    isOwner,
    collectionPublic: settings.collectionPublic,
  })
  if (!overlap || !overlap.hasAny) notFound()  // ← line 87, the reshape target
  return (
    <CommonGroundTabContent
      overlap={overlap}
      ownerDisplayLabel={ownerDisplayLabel}
    />
  )
}
```

**Existing context already in file:**
- `displayName` at line 65: `const displayName = profile.displayName ?? null`
- `ownerDisplayLabel` at line 66: `const ownerDisplayLabel = profile.displayName ?? \`@${profile.username}\``
- `notFound()` is already imported (line 1)
- `Link` is NOT imported in this file — must add
- `Card`, `CardContent`, `CardHeader`, `CardTitle`, `buttonVariants` are NOT imported — must add

**Imports to ADD** (top of file, after existing imports):
```typescript
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
```

**Target shape (D-09 + D-10 + UI-SPEC § Component Inventory):**

The single-line guard `if (!overlap || !overlap.hasAny) notFound()` MUST split into two distinct guards. The `!overlap` branch preserves the privacy boundary (gate-failure → 404); the `!overlap.hasAny` branch becomes the new soft fallback Card. From `39-RESEARCH.md` lines 459-503:

```typescript
if (tab === 'common-ground') {
  const overlap = await resolveCommonGround({
    viewerId,
    ownerId: profile.id,
    isOwner,
    collectionPublic: settings.collectionPublic,
  })
  if (!overlap) notFound()  // gate failure — privacy boundary preserved
  if (!overlap.hasAny) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No shared watches yet.</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You and @{profile.username} don&apos;t share any watches in your
            collections. That doesn&apos;t mean you don&apos;t share taste —
            try one of these:
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <Link
              href={`/u/${profile.username}/collection`}
              className={buttonVariants({ variant: 'default', size: 'default' })}
            >
              Browse {displayName ?? `@${profile.username}`}&apos;s collection →
            </Link>
            <Link
              href="/explore"
              className={buttonVariants({ variant: 'outline', size: 'default' })}
            >
              Find collectors with shared watches →
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }
  return (
    <CommonGroundTabContent
      overlap={overlap}
      ownerDisplayLabel={ownerDisplayLabel}
    />
  )
}
```

**Card primitive pattern reference** — `src/components/ui/card.tsx`:
- `Card` (line 5-21) — default `size="default"`: `flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 ring-1 ring-foreground/10`
- `CardHeader` (line 23-34) — `px-4` interior
- `CardTitle` (line 36-47) — renders as `<div>`, `font-heading text-base leading-snug font-medium` (NOT a semantic heading — UI-SPEC § Screen-reader contract accepts this limitation)
- `CardContent` (line 72-80) — `px-4` interior

**buttonVariants pattern reference** — `src/components/ui/button.tsx:6-41, 58`:
- `default` variant: `bg-primary text-primary-foreground [a]:hover:bg-primary/80` — the `[a]:hover:` selector means the hover style activates correctly when applied to an `<a>` (Link) element
- `outline` variant: `border-border bg-background hover:bg-muted hover:text-foreground`
- `default` size: `h-8 gap-1.5 px-2.5`
- **Button primitive does NOT support `asChild`** (wraps `@base-ui/react/button` — no Radix Slot). UI-SPEC § "Button + Link composition" mandates `buttonVariants()` className applied directly to `<Link>`.

**Copy lock (D-10 + UI-SPEC § Copywriting Contract) — verbatim:**
| Element | Copy |
|---------|------|
| Card title | `No shared watches yet.` |
| Body | `You and @{profile.username} don't share any watches in your collections. That doesn't mean you don't share taste — try one of these:` (apostrophes as `&apos;` in JSX) |
| Primary CTA | `Browse {displayName ?? \`@${profile.username}\`}'s collection →` → `/u/{profile.username}/collection` |
| Secondary CTA | `Find collectors with shared watches →` → `/explore` |

**Other `notFound()` calls in same file (UNCHANGED — out-of-scope per D-09 / UI-SPEC § Out-of-Scope):**
- Line 51 — `if (!VALID_TABS.includes(tab as Tab)) notFound()`
- Line 54 — `if (!profile) notFound()`
- Line 101 — `if (!isOwner) notFound()` (insights tab)

`'use client'` directive — DO NOT add. Page is Server Component; Card + Link composition is fully server-renderable (UI-SPEC § Server vs Client component constraint).

---

### `tests/app/common-ground-fallback.test.tsx` (CREATE — Wave 0)

**Analog:** `tests/app/profile-tab-insights.test.tsx` (same parent route `[tab]/page.tsx`, identical mock harness — verified by Read at HEAD)

**Imports + mock harness pattern** — `profile-tab-insights.test.tsx:1-73`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// next/navigation notFound throws a detectable error so we can assert on it.
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
  UnauthorizedError: class UnauthorizedError extends Error {
    constructor(message = 'Not authenticated') {
      super(message)
      this.name = 'UnauthorizedError'
    }
  },
}))

vi.mock('@/data/profiles', () => ({
  getProfileByUsername: vi.fn(),
  getProfileSettings: vi.fn(),
}))

vi.mock('@/data/watches', () => ({
  getWatchesByUser: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/data/wearEvents', () => ({
  getMostRecentWearDates: vi.fn().mockResolvedValue(new Map()),
  getWearEventsForViewer: vi.fn().mockResolvedValue([]),
  getAllWearEventsByUser: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/data/preferences', () => ({
  getPreferencesByUser: vi.fn().mockResolvedValue({ collectionGoal: 'balanced' }),
}))

vi.mock('@/components/profile/InsightsTabContent', () => ({
  InsightsTabContent: vi.fn(() => null),
}))
vi.mock('@/components/profile/CollectionTabContent', () => ({
  CollectionTabContent: vi.fn(() => null),
}))
vi.mock('@/components/profile/WishlistTabContent', () => ({
  WishlistTabContent: vi.fn(() => null),
}))
vi.mock('@/components/profile/NotesTabContent', () => ({
  NotesTabContent: vi.fn(() => null),
}))
vi.mock('@/components/profile/WornTabContent', () => ({
  WornTabContent: vi.fn(() => null),
}))
vi.mock('@/components/profile/StatsTabContent', () => ({
  StatsTabContent: vi.fn(() => null),
}))
vi.mock('@/components/profile/LockedTabCard', () => ({
  LockedTabCard: vi.fn(() => null),
}))
vi.mock('@/components/profile/CommonGroundTabContent', () => ({
  CommonGroundTabContent: vi.fn(() => null),
}))

vi.mock('@/app/u/[username]/common-ground-gate', () => ({
  resolveCommonGround: vi.fn().mockResolvedValue(null),
}))

import ProfileTabPage from '@/app/u/[username]/[tab]/page'
import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import { getProfileByUsername, getProfileSettings } from '@/data/profiles'
```

**Critical mock-hoisting rule** (Pitfall 6): ALL `vi.mock()` calls MUST appear BEFORE `import ProfileTabPage` to take effect. Pattern verified — `profile-tab-insights.test.tsx` puts 13 mocks at lines 4-68 before the import at line 70.

**`findInTree` helper** — copy from `tests/app/layout.test.tsx:23-36`:
```typescript
function findInTree(node: any, predicate: (n: any) => boolean): any | null {
  if (!node || typeof node !== 'object') return null
  if (predicate(node)) return node
  const children = node.props?.children
  if (Array.isArray(children)) {
    for (const c of children) {
      const hit = findInTree(c, predicate)
      if (hit) return hit
    }
  } else if (children) {
    return findInTree(children, predicate)
  }
  return null
}
```

**Test assertion pattern** — based on `profile-tab-insights.test.tsx:80-127`. Three required tests per D-09 + RESEARCH.md § Validation Architecture:

1. **200 path:** `overlap.hasAny === false` returns a React element with the fallback Card (title text + 2 CTA hrefs).
2. **404 path (gate failure):** `overlap === null` still throws `NEXT_NOT_FOUND` (privacy preserved).
3. **404 path (no profile):** `!profile` still throws `NEXT_NOT_FOUND` (line 54 unchanged).

**Mock override pattern** — per-test using `vi.mocked(resolveCommonGround).mockResolvedValue(...)`:
```typescript
import { resolveCommonGround } from '@/app/u/[username]/common-ground-gate'
import { notFound } from 'next/navigation'

it('returns 200 with fallback Card when overlap.hasAny is false', async () => {
  vi.mocked(getCurrentUser).mockResolvedValue({ id: 'viewer-1', email: 'v@b.co' })
  vi.mocked(getProfileByUsername).mockResolvedValue({
    id: 'owner-1', username: 'alice', displayName: 'Alice',
  } as any)
  vi.mocked(getProfileSettings).mockResolvedValue({
    userId: 'owner-1', profilePublic: true, collectionPublic: true,
    wishlistPublic: true, notificationsLastSeenAt: new Date(0),
    notifyOnFollow: true, notifyOnWatchOverlap: true,
  } as any)
  vi.mocked(resolveCommonGround).mockResolvedValue({
    hasAny: false, sharedWatches: [], sharedTasteTags: [],
    overlapLabel: 'Different taste', sharedStyleRows: [], sharedRoleRows: [],
  })
  const result = await ProfileTabPage({
    params: Promise.resolve({ username: 'alice', tab: 'common-ground' }),
  }) as any
  expect(result).toBeTruthy()
  expect(notFound).not.toHaveBeenCalled()
  const title = findInTree(result, (n) => n?.props?.children === 'No shared watches yet.')
  expect(title).toBeTruthy()
  const primaryCta = findInTree(result, (n) => n?.props?.href === '/u/alice/collection')
  expect(primaryCta).toBeTruthy()
  const secondaryCta = findInTree(result, (n) => n?.props?.href === '/explore')
  expect(secondaryCta).toBeTruthy()
})
```

**Privacy-preservation assertion pattern** — verifies `overlap === null` (gate failure) still 404s:
```typescript
it('still calls notFound() when overlap === null (gate failure preserves privacy)', async () => {
  vi.mocked(getCurrentUser).mockResolvedValue({ id: 'viewer-1', email: 'v@b.co' })
  vi.mocked(getProfileByUsername).mockResolvedValue({
    id: 'owner-1', username: 'alice', displayName: 'Alice',
  } as any)
  vi.mocked(getProfileSettings).mockResolvedValue({ /* same baseSettings */ } as any)
  vi.mocked(resolveCommonGround).mockResolvedValue(null)  // gate failed
  await expect(
    ProfileTabPage({
      params: Promise.resolve({ username: 'alice', tab: 'common-ground' }),
    }),
  ).rejects.toThrow('NEXT_NOT_FOUND')
})
```

**Profile-missing assertion pattern** — verifies line 54 `!profile` 404 unchanged:
```typescript
it('still calls notFound() when profile not found (line 54 unchanged)', async () => {
  vi.mocked(getProfileByUsername).mockResolvedValue(null)
  await expect(
    ProfileTabPage({
      params: Promise.resolve({ username: 'nobody', tab: 'common-ground' }),
    }),
  ).rejects.toThrow('NEXT_NOT_FOUND')
})
```

---

## Shared Patterns

### Server-Component `<Link>` wrap pattern (presentational, no client conversion)
**Source:** `src/components/insights/SleepingBeautiesSection.tsx:41-53` and `GoodDealsSection.tsx:45-64`
**Apply to:** NSV-01+15 (`CollectionFitCard.tsx`)
**Key tokens:** `<Link href={\`/watch/${watch.id}\`} className="...hover:bg-accent rounded-md...">` wrapping the entire row.
**Variation for D-07:** UI-SPEC mandates `block hover:bg-accent rounded-md p-1` (NOT `flex p-2`) — preserve the flex via an inner `<span className="flex items-center justify-between">`.

### Server-Component inline branch return (no `'use client'`)
**Source:** `src/app/u/[username]/[tab]/page.tsx` itself — many branches return JSX inline (lines 102, 108-114, 117-123, etc.)
**Apply to:** NSV-12 fallback Card branch
**Key constraint:** ANY new branch must remain server-renderable. Card + Link + buttonVariants composition satisfies this (no client hooks, no browser-only APIs).

### Button + Link composition via `buttonVariants` (NO `asChild`)
**Source:** `src/components/ui/button.tsx:58` exports `buttonVariants` (CVA factory)
**Apply to:** NSV-12 fallback CTAs
**Pattern:**
```tsx
<Link href="..." className={buttonVariants({ variant: 'default', size: 'default' })}>
  Label →
</Link>
```
**Why not `<Button asChild>`:** Project's `Button` wraps `@base-ui/react/button` and has no Radix Slot — `asChild` is unsupported. UI-SPEC § "Button + Link composition" pins this verbatim.

### Apostrophe escaping in JSX text
**Source:** Verified by grep across the repo — `GoodDealsSection.tsx:34` (`you&apos;ve`), `SleepingBeautiesSection.tsx` (no apostrophes), `WatchPickerDialog.tsx:144` (`don&apos;t`), `SearchPageClient.tsx:231` (`you&apos;d`)
**Apply to:** NSV-12 D-10 body copy + Primary CTA label
**Rule:** ESLint `react/no-unescaped-entities` requires `&apos;` in JSX text content. Raw `'` will fail lint.

### Page-test mock harness (vitest + jsdom + React-tree assertion)
**Source:** `tests/app/profile-tab-insights.test.tsx:1-73` (full mock setup) + `tests/app/layout.test.tsx:23-36` (`findInTree` helper)
**Apply to:** `tests/app/common-ground-fallback.test.tsx`
**Key constraints:**
- ALL `vi.mock()` calls at module top, BEFORE `import ProfileTabPage` (Pitfall 6 — hoisting)
- `next/navigation.notFound` mocked to throw `'NEXT_NOT_FOUND'` so `.rejects.toThrow(...)` works
- All 8 tab content components mocked to `vi.fn(() => null)` so module-level imports don't break
- `findInTree` helper copy-pasted (no shared util module — pattern is to inline-copy)

### Import-boundary survival (Phase 20 D-04)
**Source:** `tests/static/CollectionFitCard.no-engine.test.ts:12-40`
**Apply to:** Any edit to `CollectionFitCard.tsx`
**Forbidden imports** (regex source-of-truth):
- `from '@/lib/similarity'`
- `from '@/lib/verdict/composer'`
- `from 'server-only'`
- `from '@/lib/verdict/viewerTasteProfile'`

NSV-01+15 patch adds ZERO new imports (`Link` already at line 1) — guard passes vacuously.

---

## No Analog Found

None. All three files have clear analogs in the existing codebase (`SleepingBeautiesSection.tsx` for the Link wrap, `card.tsx` + `button.tsx` for the Card+Link composition, `profile-tab-insights.test.tsx` for the test harness).

---

## NSV-08 verify-before-patch evidence

**Pattern source:** D-08 mandates a grep BEFORE writing patch code. Verified at HEAD by pattern-mapper:
- `src/components/insights/SleepingBeautiesSection.tsx:43-45` — already wraps `<Link href={\`/watch/${watch.id}\`} className="flex items-center justify-between rounded-md p-2 hover:bg-accent">`. CONFIRMED.
- `src/components/insights/GoodDealsSection.tsx:47-49` — already wraps `<Link href={\`/watch/${w.id}\`} className="flex items-center gap-3 rounded-md p-2 hover:bg-accent">`. CONFIRMED.

**Expected NSV-08 outcome:** Plan author re-runs the D-08 grep at plan execution time; if both still wrap (highly likely — no Phase 39 sibling work touches these files), plan SUMMARY captures the grep stdout and closes the audit row as "already shipped." Zero code changes.

If drift has re-emerged (one or both lost the wrap): patch the missing one(s) using `SleepingBeautiesSection.tsx:43-45` as the verbatim shape reference.

---

## Metadata

**Analog search scope:**
- `src/components/insights/*` (3 files — CollectionFitCard, SleepingBeauties, GoodDeals)
- `src/components/ui/*` (card.tsx, button.tsx)
- `src/app/u/[username]/*` (page.tsx, common-ground-gate.ts)
- `tests/app/*` (profile-tab-insights.test.tsx, layout.test.tsx)
- `tests/static/CollectionFitCard.no-engine.test.ts`

**Files scanned:** 9
**Pattern extraction date:** 2026-05-12
**Pattern stability:** HIGH — all analogs at HEAD verified by Read; patterns are well-established (Link wraps already shipped on 2/3 insight sections; Card+Link buttonVariants pattern documented in UI-SPEC).
