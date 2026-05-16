# Phase 39b: Audit-Driven Discovery Polish — Heavier UX — Pattern Map

**Mapped:** 2026-05-13
**Files analyzed:** 14 new + 8 patched = 22 total
**Analogs found:** 22 / 22 (100% — all consume existing-repo patterns)

This document binds each new / patched file to a concrete in-repo analog with copy-paste-ready code excerpts. Planner uses this to write `<action>` blocks with concrete imports, signatures, JSX skeletons, and SQL shapes rather than abstract references.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/insights/ReferenceIdentityCard.tsx` | server RSC (pure renderer) | request-response | `src/components/insights/CollectionFitCard.tsx` | exact (sibling slot) |
| `src/components/profile/LockedTabCard.tsx` (PATCH) | server RSC importing client island | request-response | `src/components/explore/PopularCollectorRow.tsx` | role-match (server→client import) |
| `src/components/profile/WornCalendar.tsx` (PATCH) | client component (`'use client'`) | event-driven | self (extend in place) — analog for image+name layout: `src/components/profile/StatsTabContent.tsx:59-82` | self-extend |
| `src/components/profile/StatsTabContent.tsx` (PATCH) | server RSC | request-response | self (extend in place) — Link-wrap pattern from `CollectionFitCard.tsx:71-81` | self-extend + cross-file pattern |
| `src/data/discovery.ts` (ADD `getCollectorsForCatalog`) | DAL (server-only) | CRUD aggregation | `src/data/discovery.ts:57-121` (`getMostFollowedCollectors`) + `src/data/search.ts:60-93` (self-exclusion) | exact (sibling in same file) |
| `src/data/hierarchy.ts` (EXTEND `getLineageForReference` + ADD `getSameFamilyForCatalog`) | DAL (server-only) | CRUD aggregation | `src/data/hierarchy.ts:40-106` (existing CTE) + `src/data/discovery.ts:135-160` (Trending denormalized ranking) | self-extend |
| `src/app/watch/[id]/page.tsx` (PATCH) | RSC page | request-response | self (existing G-6 fresh-account branch — currently no card mount) | self-extend |
| `src/app/catalog/[catalogId]/page.tsx` (PATCH lines 79-113) | RSC page | request-response | self (existing G-4 branch lines 112-113 comment is reshape target) | self-extend |
| `scripts/seed-lineage.ts` | operator script (idempotent backfill) | batch | `scripts/backfill-catalog-brands.ts` | exact (canonical pattern) |
| `package.json` (ADD `db:seed-lineage` script) | config | n/a | `package.json:17-19` (`db:backfill-catalog-brands` line) | exact |
| `tests/static/ReferenceIdentityCard.no-engine.test.ts` | static guard test | n/a | `tests/static/CollectionFitCard.no-engine.test.ts` | exact (verbatim mirror) |
| `tests/components/insights/ReferenceIdentityCard.test.tsx` | component test | n/a | `tests/components/profile/LockedTabCard.test.tsx` | role-match |
| `tests/components/profile/LockedTabCard.test.tsx` (EXTEND) | component test | n/a | self-extend | self-extend |
| `tests/components/profile/WornCalendar.test.tsx` | component test (NEW) | n/a | `tests/components/profile/LockedTabCard.test.tsx` (structure) + `@testing-library/user-event` | role-match |
| `tests/data/collectors.test.ts` (or extend `discovery.test.ts`) | DAL integration test | n/a | `tests/data/getMostFollowedCollectors.test.ts` | exact |
| `tests/data/hierarchy.test.ts` (EXTEND `hierarchy.lineage-3-node.test.ts`) | static + DAL test | n/a | `tests/static/hierarchy.lineage-3-node.test.ts` | self-extend |

---

## Pattern Assignments

### 1. `src/components/insights/ReferenceIdentityCard.tsx` (NEW — server RSC)

**Analog:** `src/components/insights/CollectionFitCard.tsx` (sibling Card; same import-isolation contract)

**Imports pattern** (CollectionFitCard.tsx:1-5 — copy verbatim, swap `VerdictBundle` for `CatalogTasteAttributes`):

```typescript
import { Card, CardContent, CardHeader, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { CatalogTasteAttributes } from '@/lib/types'
```

**FORBIDDEN imports (mirror CollectionFitCard's invariant, enforced by static guard):**
- ❌ `from '@/lib/similarity'`
- ❌ `from '@/lib/verdict/composer'`
- ❌ `from '@/lib/verdict/viewerTasteProfile'`
- ❌ `from 'server-only'`
- ❌ `'use client'` directive

**Component shape** (CollectionFitCard.tsx:24-43 anatomy — Card + CardHeader + CardContent space-y-4):

```typescript
interface ReferenceIdentityCardProps {
  taste: CatalogTasteAttributes | null
}

export function ReferenceIdentityCard({ taste }: ReferenceIdentityCardProps) {
  // D-39b-03 confidence gate (defense-in-depth; caller also gates)
  if (!taste || taste.confidence === null || taste.confidence < 0.5) return null

  const eraLabel = taste.eraSignal ? ERA_LABELS[taste.eraSignal] : null
  const archetypeLabel = taste.primaryArchetype ? ARCHETYPE_LABELS[taste.primaryArchetype] : null

  return (
    <Card>
      <CardHeader>
        <CardDescription>Inferred taste signature</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* headline row · scale section · motif cluster — see 39b-UI-SPEC.md */}
      </CardContent>
    </Card>
  )
}
```

**Concrete deviation from analog:**
- No `CardTitle` headline — only `CardDescription` "Inferred taste signature" (D-39b-02).
- No verdict / framing branches (CollectionFitCard's discriminated union does not apply).
- No `mostSimilar` list.
- Full skeleton lives in 39b-RESEARCH.md Code Examples §Example 1 (lines 772-872).

**Display label maps** (sourced from `src/lib/taste/vocab.ts:16-24` + UI-SPEC §ReferenceIdentityCard):
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

---

### 2. `src/components/profile/LockedTabCard.tsx` (PATCH — server RSC importing client island)

**Analog:** `src/components/explore/PopularCollectorRow.tsx` (canonical server-RSC-imports-FollowButton precedent)

**Server-imports-client pattern** (PopularCollectorRow.tsx:1-5, 60-68):

```typescript
import Link from 'next/link'
import { AvatarDisplay } from '@/components/profile/AvatarDisplay'
import { FollowButton } from '@/components/profile/FollowButton'
// NOTE: no 'use client' — this is a Server Component importing a client island.

// ... in the JSX ...
<div className="relative z-10">
  <FollowButton
    viewerId={viewerId}
    targetUserId={collector.userId}
    targetDisplayName={name}
    initialIsFollowing={false}
    variant="inline"
  />
</div>
```

**Current LockedTabCard signature** (`src/components/profile/LockedTabCard.tsx:11-15` — extend with NEW props):

```typescript
interface LockedTabCardProps {
  tab: LockedTabId
  displayName: string | null
  username: string
  // NEW for Phase 39b D-39b-12:
  viewerId: string | null              // null = unauthenticated; same shape as FollowButton
  targetUserId: string                 // profile owner's user id (for FollowButton.targetUserId)
  initialIsFollowing: boolean          // from isFollowing(viewerId, targetUserId) at parent
  currentPath: string                  // for unauthenticated /signin?returnTo=... — same-origin pathname only
}
```

**TAB_LABELS reuse** (`src/components/profile/LockedTabCard.tsx:19-25` — reuse the existing const for caption interpolation):

```typescript
const TAB_LABELS: Record<Exclude<LockedTabId, 'common-ground'>, string> = {
  collection: 'collection', wishlist: 'wishlist',
  worn: 'worn history', notes: 'notes', stats: 'stats',
}
// D-39b-12 caption: `Follow @${username} to see their ${TAB_LABELS[tab]}.`
```

**JSX extension shape** (extend the existing `<section>` body at LockedTabCard.tsx:45-52):

```tsx
return (
  <section className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-card py-16 text-center">
    <Lock className="size-5 text-muted-foreground" aria-hidden="true" />
    <p className="text-sm text-muted-foreground">
      {name} keeps their {label} private.
    </p>
    {viewerId !== null ? (
      <>
        <FollowButton
          viewerId={viewerId}
          targetUserId={targetUserId}
          targetDisplayName={name}
          initialIsFollowing={initialIsFollowing}
          variant="inline"
        />
        <p className="text-sm text-muted-foreground">
          Follow @{username} to see their {label}.
        </p>
      </>
    ) : (
      <>
        <Link
          href={`/signin?returnTo=${encodeURIComponent(currentPath)}`}
          className={buttonVariants({ variant: 'outline', size: 'default' })}
        >
          Sign in to follow
        </Link>
        <p className="text-sm text-muted-foreground">
          Sign in to see @{username}&apos;s {label}.
        </p>
      </>
    )}
  </section>
)
```

**Concrete deviations from analog (PopularCollectorRow):**
- LockedTabCard is centered vertical stack (`flex-col items-center`), not horizontal row.
- No `absolute inset-0` Link wrap (FollowButton is the primary affordance).
- Adds unauthenticated branch (PopularCollectorRow assumes auth — viewerId always passed).
- ALL 4 callsites at `src/app/u/[username]/[tab]/page.tsx:148, 157, 176, 275` must pass the new props (`viewerId`, `targetUserId`, `initialIsFollowing`, `currentPath`).
- `common-ground` branch at LockedTabCard.tsx:42 stays unchanged (`return null`).

**Mount-site pattern** (analog: `src/app/u/[username]/[tab]/page.tsx:148-180` — existing 3 callsites already render LockedTabCard with `tab, displayName, username`. Pattern is to thread `currentPath` from `headers()` or pre-resolved from params).

---

### 3. `src/components/profile/WornCalendar.tsx` (PATCH — already `'use client'`)

**Analog:** self-extend. Wear-detail panel image+name layout pattern borrowed from `src/components/profile/StatsTabContent.tsx:59-82` (WornList row).

**`WearEventLite` interface extension** (Pitfall 2 — extend existing interface at WornCalendar.tsx:16-20):

```typescript
interface WearEventLite {
  id: string
  watchId: string
  wornDate: string                 // YYYY-MM-DD
  note: string | null              // NEW Phase 39b — parent already passes this
}
```

**`selectedDate` state pattern** (extends the existing `useState({year, month})` cursor at WornCalendar.tsx:67-71):

```typescript
const [selectedDate, setSelectedDate] = useState<string | null>(null)

// Initial-mount selection: first day in cursor.month with events (deterministic).
useEffect(() => {
  if (selectedDate !== null) return  // user already selected
  const monthKeys = Object.keys(eventsByDay).filter((k) => {
    const [y, m] = k.split('-')
    return Number(y) === cursor.year && Number(m) === cursor.month + 1
  }).sort()
  if (monthKeys.length > 0) setSelectedDate(monthKeys[0])
}, [eventsByDay, cursor])
```

**Day-cell interactivity pattern** (replace the existing static `<div>` at WornCalendar.tsx:148-176 — add onClick + role + keyboard handling per UI-SPEC §Interaction A11y):

```tsx
const interactive = dayEvents.length > 0
const isSelected = selectedDate === key
return (
  <div
    key={i}
    role={interactive ? 'button' : undefined}
    tabIndex={interactive ? 0 : undefined}
    onClick={interactive ? () => setSelectedDate(key) : undefined}
    onKeyDown={interactive ? (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setSelectedDate(key)
      }
    } : undefined}
    aria-label={interactive ? `View wear events for ${key}` : undefined}
    className={cn(
      'flex min-h-12 flex-col items-center justify-start rounded-md border p-1 text-xs',
      inMonth ? 'bg-background' : 'bg-muted/30 text-muted-foreground',
      isToday && 'ring-1 ring-accent',
      interactive && 'cursor-pointer hover:bg-muted/60',
      isSelected && 'ring-2 ring-foreground/20',
    )}
  >
    {/* existing day-number + image markup */}
  </div>
)
```

**Wear-detail panel** (NEW — append BELOW the existing `<div className="grid grid-cols-7 gap-1">` at WornCalendar.tsx:178):

```tsx
{selectedDate !== null && (
  <div className="mt-4 border-t pt-4">
    <p className="text-sm font-medium text-foreground mb-3">
      {formatDateLabel(selectedDate)}
    </p>
    {(eventsByDay[selectedDate] ?? []).length === 0 ? (
      <p className="text-sm text-muted-foreground">
        No wear events on {formatDateLabel(selectedDate)}.
      </p>
    ) : (
      <ul className="space-y-3">
        {(eventsByDay[selectedDate] ?? []).map((event) => {
          const watch = watchMap[event.watchId]
          const safe = watch ? getSafeImageUrl(watch.imageUrl) : null
          return (
            <li key={event.id} className="flex items-start gap-3">
              <div className="relative size-12 shrink-0 overflow-hidden rounded bg-muted">
                {safe && <Image src={safe} alt="" fill sizes="48px" className="object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {watch?.brand} {watch?.model}
                </p>
                {event.note && (
                  <p className="mt-1 text-sm text-muted-foreground">{event.note}</p>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    )}
  </div>
)}
```

Image + name two-column pattern is a direct port of `StatsTabContent.tsx:59-82` (WornList row), substituting `size-10` → `size-12` and adding the optional `note` line.

`formatDateLabel` helper (new — inline in WornCalendar.tsx):
```typescript
function formatDateLabel(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  }).format(new Date(y, m - 1, d))
}
```

---

### 4. `src/components/profile/StatsTabContent.tsx` (PATCH lines 50-86)

**Analog:** `src/components/insights/CollectionFitCard.tsx:71-81` (Link-wrap pattern, established by Phase 39 D-07 / NSV-01+15).

**Link-wrap excerpt** (CollectionFitCard.tsx:69-82 — adapt for StatsTabContent WornList rows):

```typescript
// Source: CollectionFitCard.tsx:71-81
<li key={watch.id}>
  <Link
    href={`/watch/${watch.id}`}
    className="block hover:bg-accent rounded-md p-1"
  >
    {/* existing content */}
  </Link>
</li>
```

**Concrete patch** — at `src/components/profile/StatsTabContent.tsx:59-82`, wrap the existing `<li>` body in a `<Link>`:

```tsx
import Link from 'next/link'   // NEW import

// inside WornList .map():
return (
  <li key={watch.id}>
    <Link
      href={`/watch/${watch.id}`}
      className="flex items-center gap-3 rounded-md p-1 hover:bg-accent"
    >
      <div className="relative size-10 shrink-0 overflow-hidden rounded bg-muted">
        {/* existing image markup */}
      </div>
      <p className="flex-1 text-sm">{watch.brand} {watch.model}</p>
      <span className="text-sm font-semibold text-foreground">{count}</span>
    </Link>
  </li>
)
```

**Concrete deviations:**
- The `flex items-center gap-3` classes move from `<li>` to `<Link>` (the Link is the flex container now).
- `<li>` becomes a pure wrapper with no className.
- `HorizontalBarChart` rows in Style/Role distribution at StatsTabContent.tsx:38-43 stay non-clickable (D-39b-14 lock).

---

### 5. `src/data/discovery.ts` (ADD `getCollectorsForCatalog` — NEW DAL)

**Analog:** `src/data/discovery.ts:57-121` (`getMostFollowedCollectors` — sibling in same file) + `src/data/search.ts:84-90` (self-exclusion `sql` predicate).

**Imports already present in discovery.ts** (lines 1-12 — extend `import` list as needed):

```typescript
import 'server-only'
import { and, asc, desc, eq, inArray, notInArray, sql } from 'drizzle-orm'
import { db } from '@/db'
import { follows, profiles, profileSettings, watches, watchesCatalog } from '@/db/schema'
```

**Two-layer privacy + self-exclusion shape** (canonical from `discovery.ts:74-91` + `search.ts:84-90`):

```typescript
.from(watches)
.innerJoin(profiles, eq(profiles.id, watches.userId))
.innerJoin(profileSettings, eq(profileSettings.userId, profiles.id))
.where(
  and(
    eq(watches.catalogId, catalogId),
    eq(profileSettings.profilePublic, true),    // layer 1 (Phase 18 D-09)
    eq(profileSettings.collectionPublic, true), // layer 2 (D-39b-09 NEW)
    sql`${profiles.id} != ${viewerId}`,         // self-exclusion (search.ts:87 pattern)
    inArray(watches.status, ['owned', 'wishlist', 'grail']),  // A1 — exclude sold
  ),
)
```

**Full new function** (39b-RESEARCH.md Pattern 1, lines 270-352 — copy verbatim into `src/data/discovery.ts`):

```typescript
export interface CatalogCollector {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
}

export async function getCollectorsForCatalog(
  catalogId: string,
  viewerId: string,
  opts: { limit?: number } = {},
): Promise<{ collectors: CatalogCollector[]; totalCount: number }> {
  const limit = opts.limit ?? 5

  const rows = await db
    .select({
      userId: profiles.id,
      username: profiles.username,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
      addedAt: watches.createdAt,
    })
    .from(watches)
    .innerJoin(profiles, eq(profiles.id, watches.userId))
    .innerJoin(profileSettings, eq(profileSettings.userId, profiles.id))
    .where(
      and(
        eq(watches.catalogId, catalogId),
        eq(profileSettings.profilePublic, true),
        eq(profileSettings.collectionPublic, true),
        sql`${profiles.id} != ${viewerId}`,
        inArray(watches.status, ['owned', 'wishlist', 'grail']),
      ),
    )
    .orderBy(desc(watches.createdAt), asc(profiles.username))
    .limit(50)  // Pitfall 3 — overfetch for JS-side dedup

  // Pitfall 4 — separate count(DISTINCT) for totalCount label
  const totalRows = await db
    .select({ count: sql<number>`count(DISTINCT ${profiles.id})::int` })
    .from(watches)
    .innerJoin(profiles, eq(profiles.id, watches.userId))
    .innerJoin(profileSettings, eq(profileSettings.userId, profiles.id))
    .where(
      and(
        eq(watches.catalogId, catalogId),
        eq(profileSettings.profilePublic, true),
        eq(profileSettings.collectionPublic, true),
        sql`${profiles.id} != ${viewerId}`,
        inArray(watches.status, ['owned', 'wishlist', 'grail']),
      ),
    )
  const totalCount = totalRows[0]?.count ?? 0

  // JS dedup (Pitfall 3) — keep first occurrence per userId, top-N slice
  const seen = new Set<string>()
  const collectors: CatalogCollector[] = []
  for (const r of rows) {
    if (seen.has(r.userId)) continue
    seen.add(r.userId)
    collectors.push({
      userId: r.userId,
      username: r.username,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
    })
    if (collectors.length >= limit) break
  }
  return { collectors, totalCount }
}
```

**Concrete deviations from `getMostFollowedCollectors`:**
- No `follows`-table JOIN — ranking is `watches.createdAt DESC`, not follower COUNT.
- Two-layer privacy adds `collectionPublic = true` (D-39b-09 new — not present in `getMostFollowedCollectors`).
- Adds `inArray(watches.status, ['owned','wishlist','grail'])` to exclude `sold` (A1 inference — defensible default per "collectors own this" copy).
- Second query for `totalCount` (Pitfall 4 — `getMostFollowedCollectors` returns a fixed list shape, not a totalCount).
- JS dedup loop (Pitfall 3 — multi-row-per-user is unique to the per-catalog query).

---

### 6. `src/data/hierarchy.ts` (EXTEND `getLineageForReference` + ADD `getSameFamilyForCatalog`)

#### 6a. `getLineageForReference` extension (add `imageUrl` to CTE)

**Analog:** self at `src/data/hierarchy.ts:27-106` (existing function).

**LineageRow interface extension** (hierarchy.ts:27-38 — add one field):

```typescript
export interface LineageRow {
  id: string
  brand: string
  model: string
  reference: string | null
  imageUrl: string | null             // NEW Phase 39b
  predecessor_catalog_id: string
  successor_catalog_id: string
  relationship_type: string
  depth: number
  direction: 'forward' | 'backward'
  is_cycle: boolean
}
```

**CTE patch** — Pitfall 5: BOTH seed AND recursive arms must carry the new column.

```diff
   WITH RECURSIVE lineage(
-    id, brand, model, reference,
+    id, brand, model, reference, image_url,
     predecessor_catalog_id, successor_catalog_id,
     relationship_type,
     depth, direction
   ) AS (
     SELECT
-      wc.id, wc.brand, wc.model, wc.reference,
+      wc.id, wc.brand, wc.model, wc.reference, wc.image_url,
       e.predecessor_catalog_id, e.successor_catalog_id,
       e.relationship_type::text,
       ...
     UNION ALL
     SELECT
-      wc.id, wc.brand, wc.model, wc.reference,
+      wc.id, wc.brand, wc.model, wc.reference, wc.image_url,
       e.predecessor_catalog_id, e.successor_catalog_id,
       ...
   )
   CYCLE id SET is_cycle USING path
   SELECT
-    id, brand, model, reference,
+    id, brand, model, reference, image_url AS "imageUrl",
     predecessor_catalog_id, successor_catalog_id,
     relationship_type, depth, direction, is_cycle
   FROM lineage
```

The outer SELECT aliases `image_url AS "imageUrl"` to match the TypeScript interface camelCase convention (existing rows already use snake_case in TS — `predecessor_catalog_id` — so this is a deliberate exception for consumer ergonomics, OR align by exposing `image_url` and letting the rail-mount site rename).

**Test extension** (`tests/static/hierarchy.lineage-3-node.test.ts` — add one assertion):
```typescript
it('selects image_url in both seed and recursive arms', () => {
  if (!existsSync(HIERARCHY_PATH)) return
  const src = readFileSync(HIERARCHY_PATH, 'utf-8')
  // wc.image_url must appear in BOTH SELECT clauses (Pitfall 5)
  const matches = src.match(/wc\.image_url/g) ?? []
  expect(matches.length).toBeGreaterThanOrEqual(2)
})
```

#### 6b. `getSameFamilyForCatalog` (NEW)

**Analog:** `src/data/discovery.ts:135-160` (`getTrendingCatalogWatches` — denormalized `ownersCount` DESC ranking pattern).

**Imports needed** (extend hierarchy.ts:1-5):
```typescript
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { watchesCatalog } from '@/db/schema'
```

**Function shape** (39b-RESEARCH.md Pattern 2, lines 373-419):

```typescript
export interface SameFamilyWatch {
  id: string                   // watches_catalog.id
  brand: string
  model: string
  imageUrl: string | null
  ownersCount: number
}

export async function getSameFamilyForCatalog(
  catalogId: string,
  opts: { limit?: number } = {},
): Promise<SameFamilyWatch[]> {
  const limit = opts.limit ?? 6

  // Two-pass: (1) read family_id of input row, (2) find siblings
  const rootRows = await db
    .select({ familyId: watchesCatalog.familyId })
    .from(watchesCatalog)
    .where(eq(watchesCatalog.id, catalogId))
    .limit(1)
  const familyId = rootRows[0]?.familyId
  if (!familyId) return []   // No family → rail hides (D-39b-07)

  const rows = await db
    .select({
      id: watchesCatalog.id,
      brand: watchesCatalog.brand,
      model: watchesCatalog.model,
      imageUrl: watchesCatalog.imageUrl,
      ownersCount: watchesCatalog.ownersCount,
    })
    .from(watchesCatalog)
    .where(
      and(
        eq(watchesCatalog.familyId, familyId),
        sql`${watchesCatalog.id} != ${catalogId}::uuid`,  // exclude self
      ),
    )
    .orderBy(
      desc(watchesCatalog.ownersCount),
      asc(watchesCatalog.brand),
      asc(watchesCatalog.model),
    )
    .limit(limit)

  return rows
}
```

**Concrete deviations from `getTrendingCatalogWatches`:**
- Filters by `familyId` (not by signal-score `> 0`).
- Two-pass query (resolve familyId first; analog is a single SELECT).
- Hide-if-empty contract via `familyId === null → return []` (D-39b-07).
- Uses denormalized `ownersCount` (A2 assumption — Phase 17 pg_cron-refreshed daily; planner accept staleness trade-off explicitly).

---

### 7. `src/app/watch/[id]/page.tsx` (PATCH — mount ReferenceIdentityCard + rails)

**Analog:** self — extend the existing `if (collection.length > 0) { ... }` branch at lines 41-54.

**Current G-6 fresh-account branch behavior** (watch/[id]/page.tsx:40-54): when `collection.length === 0`, `verdict` stays `null` and no card mounts. Phase 39b adds an `else` branch mounting `ReferenceIdentityCard` (D-39b-04) + always-mounted lineage rails.

**Render-order pattern** (UI-SPEC §"Render Order — /watch/{id}"):

```tsx
import { ReferenceIdentityCard } from '@/components/insights/ReferenceIdentityCard'
import { getCatalogById } from '@/data/catalog'
import { getLineageForReference } from '@/data/hierarchy'
import { getSameFamilyForCatalog } from '@/data/hierarchy'
import { SameFamilyRail } from '@/components/insights/SameFamilyRail'  // see §"New Sections"
import { LineageRail } from '@/components/insights/LineageRail'

// inside WatchPage, after the existing Promise.all block:
const sameFamily = watch.catalogId ? await getSameFamilyForCatalog(watch.catalogId) : []
const lineage = watch.catalogId ? await getLineageForReference(watch.catalogId) : []
const catalogTaste = watch.catalogTaste ?? null

// inside the JSX return:
<div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
  <WatchDetail ... />
  {/* Owner-populated viewer: CollectionFitCard (existing) */}
  {/* Fresh-account viewer: ReferenceIdentityCard */}
  {collection.length === 0 && catalogTaste && catalogTaste.confidence !== null && catalogTaste.confidence >= 0.5 && (
    <ReferenceIdentityCard taste={catalogTaste} />
  )}
  {collection.length === 0 && (!catalogTaste || catalogTaste.confidence === null || catalogTaste.confidence < 0.5) && (
    <p className="text-sm text-muted-foreground">
      Add a few watches to see how this one fits your collection.
    </p>
  )}
  <SameFamilyRail rows={sameFamily} />
  <LineageRail rows={lineage} />
  {/* CTA block already in WatchDetail or follows here */}
</div>
```

**Concrete deviations from current:**
- 3 new server-async calls (`getCatalogById` already in `if collection.length > 0` block; add lineage + sameFamily outside).
- Mount fresh-account-branch ReferenceIdentityCard above lineage rails.
- Lineage rails mount for ALL viewer states (owner + cross-user + fresh-account) — UI-SPEC §Render Order.

---

### 8. `src/app/catalog/[catalogId]/page.tsx` (PATCH — mount RIC + roster + rails)

**Analog:** self — extend lines 79-113 (existing `if (viewerOwnedRow) ... else if (collection.length > 0) ... else (line 112-113 comment)` branch).

**The comment at lines 112-113 is the load-bearing reshape target:**
```typescript
// else: collection.length === 0 → verdict stays null AND actionsSpec stays
// null → no card, no CTAs (D-05 + D-07 empty-collection rule)
```
Phase 39b replaces "no card, no CTAs" with "ReferenceIdentityCard (if confidence ≥ 0.5) OR fallback caption + CTA-only block."

**Imports to add** (extend catalog/[catalogId]/page.tsx:1-18):
```typescript
import { ReferenceIdentityCard } from '@/components/insights/ReferenceIdentityCard'
import { getCollectorsForCatalog } from '@/data/discovery'
import { getSameFamilyForCatalog, getLineageForReference } from '@/data/hierarchy'
import { SameFamilyRail } from '@/components/insights/SameFamilyRail'
import { LineageRail } from '@/components/insights/LineageRail'
import { OtherOwnersRoster } from '@/components/insights/OtherOwnersRoster'  // see §"New Sections"
```

**Data fetches** — extend the existing `Promise.all` at lines 56-62:
```typescript
const [catalogEntry, collection, preferences, viewerOwnedRow, viewerProfile, roster, sameFamily, lineage] = await Promise.all([
  getCatalogById(catalogId),
  getWatchesByUser(user.id),
  getPreferencesByUser(user.id),
  findViewerWatchByCatalogId(user.id, catalogId),
  getProfileById(user.id),
  getCollectorsForCatalog(catalogId, user.id, { limit: 5 }),  // NEW
  getSameFamilyForCatalog(catalogId),                         // NEW
  getLineageForReference(catalogId),                          // NEW
])
```

**Adapter from `CatalogEntry` to `CatalogTasteAttributes`** (Pitfall 9 — fields live at top level on CatalogEntry, not nested):
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

**JSX patch** — replace the existing render order at lines 115-160 to follow UI-SPEC §"/catalog/{id} render order" (verdict → roster → same-family → lineage → CTAs).

---

### 9. `src/components/insights/OtherOwnersRoster.tsx` (NEW inline section — or inline in page)

**Analog:** `src/components/explore/PopularCollectorRow.tsx:40-71` (absolute-inset Link + AvatarDisplay pattern).

**Pitfall 1 note:** `AvatarDisplay` only accepts `size = 40 | 64 | 96` (verified `src/components/profile/AvatarDisplay.tsx:10`). UI-SPEC §NSV-18 specifies `size={36}`. **Substitute `size={40}` (RESEARCH A4 recommendation)**. `w-16` chip still accommodates a 40px avatar.

**Chip row JSX** (RESEARCH Code Examples §3, lines 916-961 — copy verbatim):

```tsx
import Link from 'next/link'
import { AvatarDisplay } from '@/components/profile/AvatarDisplay'
import type { CatalogCollector } from '@/data/discovery'

interface OtherOwnersRosterProps {
  collectors: CatalogCollector[]
  totalCount: number
}

export function OtherOwnersRoster({ collectors, totalCount }: OtherOwnersRosterProps) {
  if (collectors.length === 0) return null  // hide-if-empty (D-39b-07)
  return (
    <section className="space-y-2">
      {totalCount > 5 && (
        <p className="text-sm text-muted-foreground">{totalCount} collectors own this</p>
      )}
      <div className="flex gap-2 overflow-x-auto scroll-smooth pb-1">
        {collectors.map((c) => {
          const name = c.displayName ?? `@${c.username}`
          return (
            <div key={c.userId} className="group relative flex flex-col items-center gap-2 w-16 shrink-0">
              <Link
                href={`/u/${c.username}/collection`}
                aria-label={`${name}'s collection`}
                className="absolute inset-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <AvatarDisplay
                avatarUrl={c.avatarUrl}
                displayName={c.displayName}
                username={c.username}
                size={40}  // UI-SPEC says 36 but primitive only supports 40/64/96 (Pitfall 1)
              />
              <p className="text-xs text-muted-foreground truncate w-full text-center">
                @{c.username}
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
```

**Deviation from PopularCollectorRow:** Vertical compact chip (`w-16` + `flex-col`), not horizontal row. No `FollowButton` (roster is browse-only, not action-eligible). `size=40` instead of UI-SPEC's `36` (deferred primitive extension).

---

### 10. `src/components/insights/SameFamilyRail.tsx` + `LineageRail.tsx` (NEW server RSC rails)

**Analog:** `src/components/explore/TrendingWatches.tsx` (rail section anatomy: header + horizontal scroll container + DiscoveryWatchCard map).

**Imports** (TrendingWatches.tsx:1-7):
```typescript
import Link from 'next/link'
import { DiscoveryWatchCard } from '@/components/explore/DiscoveryWatchCard'
import type { SameFamilyWatch } from '@/data/hierarchy'
import type { LineageRow } from '@/data/hierarchy'
import { Badge } from '@/components/ui/badge'
```

**Same family rail** (extend TrendingWatches.tsx:25-54 pattern; drop the `'use cache'` since the data is already viewer-agnostic and small):

```tsx
export function SameFamilyRail({ rows }: { rows: SameFamilyWatch[] }) {
  if (rows.length === 0) return null  // hide-if-empty (D-39b-07)
  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-medium leading-tight text-foreground">
          Same family
        </h2>
        {/* TODO v5.x: "See all in family" link → /catalog?family={familyId} */}
      </header>
      <div className="flex gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2">
        {rows.map((w) => {
          const sublabel = w.ownersCount === 1 ? '1 collector' : `${w.ownersCount} collectors`
          return (
            <div key={w.id} className="snap-start">
              <DiscoveryWatchCard
                watch={{ id: w.id, brand: w.brand, model: w.model, imageUrl: w.imageUrl }}
                sublabel={sublabel}
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}
```

**Lineage rail** — same skeleton; sublabel is `<Badge variant="outline">{relationshipLabel}</Badge>` per D-39b-16:

```tsx
const RELATIONSHIP_LABELS: Record<string, string> = {
  predecessor: 'Predecessor',
  successor: 'Successor',
  remake: 'Modern remake',
  tribute: 'Tribute to',
  homage: 'Homage to',
}

export function LineageRail({ rows }: { rows: LineageRow[] }) {
  if (rows.length === 0) return null
  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-medium leading-tight text-foreground">Lineage</h2>
      </header>
      <div className="flex gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2">
        {rows.slice(0, 6).map((r) => {
          const label = RELATIONSHIP_LABELS[r.relationship_type] ?? r.relationship_type
          return (
            <div key={r.id} className="snap-start">
              <DiscoveryWatchCard
                watch={{ id: r.id, brand: r.brand, model: r.model, imageUrl: r.imageUrl }}
                sublabel={<Badge variant="outline">{label}</Badge>}
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}
```

**Concrete deviations from TrendingWatches:**
- No `'use cache'` / `cacheTag` / `cacheLife` (rails are page-scoped, not global).
- No `Flame` icon in header.
- Header text uses `text-xl font-medium` (UI-SPEC §Typography), NOT `font-semibold` (TrendingWatches uses semibold; UI-SPEC explicitly relaxes this).
- LineageRail sublabel is a `<Badge>` (ReactNode); SameFamilyRail sublabel is a string. Both work via `sublabel: ReactNode` prop on DiscoveryWatchCard (verified at DiscoveryWatchCard.tsx:2,26).

---

### 11. `scripts/seed-lineage.ts` (NEW operator script)

**Analog:** `scripts/backfill-catalog-brands.ts` (canonical idempotent backfill).

**File header pattern** (backfill-catalog-brands.ts:1-25 — copy structure, swap phase + body):

```typescript
/**
 * Phase 39b Wave 0 — operator-curation seed for catalog hierarchy (D-39b-08 / D-39b-19).
 * Usage: npm run db:seed-lineage
 * Prod usage: DATABASE_URL="<prod pooler URL>" npm run db:seed-lineage
 *
 * Idempotent (D-39b-20):
 *   Pass A: UPDATE watches_catalog SET family_id WHERE family_id IS NULL (never overwrite)
 *   Pass B: INSERT watch_lineage_edges ... ON CONFLICT (predecessor_catalog_id,
 *     successor_catalog_id, relationship_type) DO NOTHING
 *
 * Footgun T-34-04 inheritance: without inline DATABASE_URL override, this reads
 * .env.local (LOCAL Docker DB). See docs/deploy-db-setup.md §34.2 precedent.
 */
import { db } from '../src/db'        // relative — tsx does not resolve @/* aliases
import { sql } from 'drizzle-orm'
```

**Pass structure** (backfill-catalog-brands.ts:51-122 — 3-pass becomes 2-pass for seed-lineage):

```typescript
// ----- OPERATOR-AUTHORED DATA (TODO block — operator fills before running) -----
// Family categories per 39b-CONTEXT.md §Specifics:
//   - Submariner / Sea-Dweller / GMT family
//   - Speedmaster Moonwatch family
//   - Royal Oak family
//   - Submariner homages (Tudor BB, Squale, Christopher Ward C60)
//   - Speedy chain (Sinn 103, etc.)
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

async function passA_assignFamilies(): Promise<{ patched: number; skipped: number }> {
  let patched = 0
  let skipped = 0
  for (const entry of FAMILY_ASSIGNMENTS) {
    const result = await db.execute<{ updated_id: string }>(sql`
      UPDATE watches_catalog
         SET family_id = ${entry.familyId}::uuid,
             updated_at = NOW()
       WHERE id = ${entry.catalogId}::uuid
         AND family_id IS NULL
      RETURNING id AS updated_id
    `)
    const updated = (result as unknown as Array<{ updated_id: string }>).length
    if (updated > 0) {
      patched += 1
      console.log(`[seed-lineage] family: ${entry.brand} ${entry.model} ✓`)
    } else {
      skipped += 1
      console.log(`[seed-lineage] family: ${entry.brand} ${entry.model} (skipped — already assigned)`)
    }
  }
  return { patched, skipped }
}

async function passB_insertLineageEdges(): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0
  let skipped = 0
  for (const edge of LINEAGE_EDGES) {
    const result = await db.execute<{ id: string }>(sql`
      INSERT INTO watch_lineage_edges (
        predecessor_catalog_id, successor_catalog_id, relationship_type
      )
      VALUES (
        ${edge.predecessorCatalogId}::uuid,
        ${edge.successorCatalogId}::uuid,
        ${edge.relationshipType}::lineage_relationship_type
      )
      ON CONFLICT (predecessor_catalog_id, successor_catalog_id, relationship_type)
      DO NOTHING
      RETURNING id
    `)
    const insertedRows = (result as unknown as Array<{ id: string }>).length
    if (insertedRows > 0) {
      inserted += 1
      console.log(`[seed-lineage] edge: ${edge.predecessorCatalogId} -[${edge.relationshipType}]-> ${edge.successorCatalogId}`)
    } else {
      skipped += 1
    }
  }
  return { inserted, skipped }
}

async function main() {
  const startedAt = Date.now()
  console.log(`[seed-lineage] starting — ${FAMILY_ASSIGNMENTS.length} family assignments + ${LINEAGE_EDGES.length} edges`)
  const families = await passA_assignFamilies()
  const edges = await passB_insertLineageEdges()
  const elapsedMs = Date.now() - startedAt
  console.log(`[seed-lineage] OK — family_patched=${families.patched} family_skipped=${families.skipped} edges_inserted=${edges.inserted} edges_skipped=${edges.skipped} elapsedMs=${elapsedMs}`)
  process.exit(0)
}

main().catch((err) => {
  console.error('[seed-lineage] fatal:', err)
  process.exit(1)
})
```

**Concrete deviations from `backfill-catalog-brands.ts`:**
- No `--patch-country` JSON-file flag (no Pass B in the new script).
- No final assertion / failure dump (D-39b-20 idempotency is the contract; operator UAT via re-run).
- 2-pass instead of 3-pass.
- Uses `ON CONFLICT (col, col, col) DO NOTHING` (matches `lineage_edges_unique_triple` constraint at `src/db/schema.ts:471-475`).

**package.json patch** — add line after backfill-catalog-lineage at line 19:
```json
"db:seed-lineage": "tsx --env-file=.env.local scripts/seed-lineage.ts",
```

---

### 12. `tests/static/ReferenceIdentityCard.no-engine.test.ts` (NEW static guard)

**Analog:** `tests/static/CollectionFitCard.no-engine.test.ts` (verbatim mirror; only path + describe label change).

**Full file** (RESEARCH Example 2, lines 874-913 — copy with path substitution):

```typescript
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'

describe('Phase 39b D-39b-01 — <ReferenceIdentityCard> pure-renderer invariant', () => {
  const cardPath = 'src/components/insights/ReferenceIdentityCard.tsx'

  it('does not import @/lib/similarity', () => {
    if (!existsSync(cardPath)) return
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

  it('is a server component (no use client directive)', () => {
    if (!existsSync(cardPath)) return
    const src = readFileSync(cardPath, 'utf8')
    expect(src).not.toMatch(/^['"]use client['"]/m)
  })
})
```

---

### 13. `tests/components/insights/ReferenceIdentityCard.test.tsx` (NEW component test)

**Analog:** `tests/components/profile/LockedTabCard.test.tsx` (canonical render-and-assert structure).

**Pattern** (LockedTabCard.test.tsx:1-30 — copy structure):

```typescript
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ReferenceIdentityCard } from '@/components/insights/ReferenceIdentityCard'
import type { CatalogTasteAttributes } from '@/lib/types'

const FULL_TASTE: CatalogTasteAttributes = {
  formality: 0.7,
  sportiness: 0.3,
  heritageScore: 0.85,
  primaryArchetype: 'dress',
  eraSignal: 'modern',
  designMotifs: ['bauhaus', 'gilt-dial'],
  confidence: 0.75,
  extractedFromPhoto: false,
}

describe('ReferenceIdentityCard', () => {
  it('renders all sections when confidence >= 0.5', () => {
    const { getByText } = render(<ReferenceIdentityCard taste={FULL_TASTE} />)
    expect(getByText('Inferred taste signature')).toBeTruthy()
    expect(getByText('Modern era')).toBeTruthy()  // era headline
    expect(getByText('Dress')).toBeTruthy()        // archetype headline
    expect(getByText('bauhaus')).toBeTruthy()      // motif chip
  })

  it('returns null when taste === null', () => {
    const { container } = render(<ReferenceIdentityCard taste={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null when confidence < 0.5 (D-39b-03 gate)', () => {
    const { container } = render(
      <ReferenceIdentityCard taste={{ ...FULL_TASTE, confidence: 0.3 }} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('returns null when confidence === null', () => {
    const { container } = render(
      <ReferenceIdentityCard taste={{ ...FULL_TASTE, confidence: null }} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('omits headline when both era and archetype are null', () => {
    const { queryByText } = render(
      <ReferenceIdentityCard taste={{ ...FULL_TASTE, eraSignal: null, primaryArchetype: null }} />,
    )
    expect(queryByText('Modern era')).toBeNull()
    expect(queryByText('Dress')).toBeNull()
  })

  it('omits a scale bar when its value is null', () => {
    const { queryByText } = render(
      <ReferenceIdentityCard taste={{ ...FULL_TASTE, formality: null }} />,
    )
    expect(queryByText('Formality')).toBeNull()
    // Sportiness + Heritage still render
  })
})
```

---

### 14. `tests/components/profile/LockedTabCard.test.tsx` (EXTEND existing)

**Analog:** self at `tests/components/profile/LockedTabCard.test.tsx:1-85` (existing 8 tests).

**Add 3 new tests** (Phase 39b D-39b-12 branches — logged-in / unauthenticated / common-ground unchanged):

```typescript
// Append to the existing describe block:

it('renders FollowButton + caption for logged-in not-following viewer (D-39b-12)', () => {
  const { getByText, getByRole } = render(
    <LockedTabCard
      tab="collection"
      displayName="Tyler"
      username="tyler"
      viewerId="viewer-uuid"
      targetUserId="tyler-uuid"
      initialIsFollowing={false}
      currentPath="/u/tyler/collection"
    />,
  )
  expect(getByRole('button', { name: /Follow Tyler/i })).toBeTruthy()
  expect(getByText('Follow @tyler to see their collection.')).toBeTruthy()
})

it('renders sign-in Link for unauthenticated viewer (D-39b-12)', () => {
  const { getByText, getByRole } = render(
    <LockedTabCard
      tab="collection"
      displayName="Tyler"
      username="tyler"
      viewerId={null}
      targetUserId="tyler-uuid"
      initialIsFollowing={false}
      currentPath="/u/tyler/collection"
    />,
  )
  const link = getByRole('link', { name: /Sign in to follow/i })
  expect(link).toBeTruthy()
  expect(link.getAttribute('href')).toBe('/signin?returnTo=%2Fu%2Ftyler%2Fcollection')
  expect(getByText(`Sign in to see @tyler's collection.`)).toBeTruthy()
})

it('still returns null for tab=common-ground regardless of viewerId (D-39 D-09 regression guard)', () => {
  const { container } = render(
    <LockedTabCard
      tab="common-ground"
      displayName="Tyler"
      username="tyler"
      viewerId="viewer-uuid"
      targetUserId="tyler-uuid"
      initialIsFollowing={false}
      currentPath="/u/tyler/common-ground"
    />,
  )
  expect(container.firstChild).toBeNull()
})
```

**The existing 8 tests still pass** because LockedTabCard's props are extended (not replaced); existing tests call with the old prop subset and may need defaults filled in. **Action:** extend the existing renders to pass `viewerId={null}` `targetUserId="..."` `initialIsFollowing={false}` `currentPath="..."` to satisfy the new required prop set — OR mark the new props as optional with defaults. Planner decides; defaults are cleaner.

---

### 15. `tests/components/profile/WornCalendar.test.tsx` (NEW component test)

**Analog:** `tests/components/profile/LockedTabCard.test.tsx` (structure: render + describe).

**Test coverage** (UI-SPEC §Test Coverage Contract):

```typescript
import { render, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { WornCalendar } from '@/components/profile/WornCalendar'

const FIXED_NOW = new Date('2026-05-13T12:00:00Z')

describe('WornCalendar', () => {
  it('selects first day with events on mount', () => {
    const { getByText } = render(
      <WornCalendar
        events={[
          { id: 'e1', watchId: 'w1', wornDate: '2026-05-03', note: 'breakfast wear' },
          { id: 'e2', watchId: 'w1', wornDate: '2026-05-10', note: null },
        ]}
        watchMap={{ w1: { id: 'w1', brand: 'Rolex', model: 'Submariner', imageUrl: null } }}
      />,
    )
    // After mount, May 3 panel rendered → 'breakfast wear' note visible
    expect(getByText('breakfast wear')).toBeTruthy()
  })

  it('renders "No wear events" caption when empty day clicked', () => {
    // Render with cursor on a month where day 15 has no events.
    // Click day 15 → expect "No wear events on Fri, May 15." caption.
    // Implementation depends on whether selectedDate can be programmatically set.
  })

  it('sets selectedDate on day-with-events click', () => {
    const { getByLabelText, getByText } = render(<WornCalendar ... />)
    fireEvent.click(getByLabelText(/View wear events for 2026-05-10/))
    expect(getByText('Sat, May 10')).toBeTruthy()  // panel heading
  })
})
```

**Coverage assertions** (UI-SPEC §Test Coverage Contract):
- selectedDate initializes to first-event-day on mount
- Empty-day selection renders `"No wear events on {date}."`
- Day cell with events sets `selectedDate` on click

---

### 16. `tests/data/collectors.test.ts` (or extend `tests/data/discovery.test.ts`)

**Analog:** `tests/data/getMostFollowedCollectors.test.ts:1-80` (canonical DAL integration test scaffold).

**Pattern** (copy verbatim — seedProfile + maybe gate + two-layer privacy assertions):

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

const hasDrizzle = Boolean(process.env.DATABASE_URL)
const hasSupabaseAdmin =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
const maybe = hasDrizzle && hasSupabaseAdmin ? describe : describe.skip

maybe('getCollectorsForCatalog — DAL integration', () => {
  // ... seedProfile helper from getMostFollowedCollectors.test.ts:37-59 ...
  it('excludes private-profile users (two-layer privacy)', async () => { /* ... */ })
  it('excludes collectionPublic=false users', async () => { /* ... */ })
  it('excludes viewer self', async () => { /* ... */ })
  it('excludes sold-status rows (A1)', async () => { /* ... */ })
  it('orders by watches.created_at DESC', async () => { /* ... */ })
  it('totalCount reflects distinct-collector count beyond top-N limit', async () => { /* ... */ })
  it('deduplicates multi-row-per-user (owned + wishlist same catalog)', async () => { /* ... */ })
})
```

---

### 17. `tests/data/hierarchy.test.ts` (EXTEND `hierarchy.lineage-3-node.test.ts`)

**Analog:** `tests/static/hierarchy.lineage-3-node.test.ts:16-26` (existing static guard).

**Add new tests:**

```typescript
// Append to existing describe block:
it('CTE selects wc.image_url in both seed and recursive arms (Pitfall 5)', () => {
  if (!existsSync(HIERARCHY_PATH)) return
  const src = readFileSync(HIERARCHY_PATH, 'utf-8')
  const matches = src.match(/wc\.image_url/g) ?? []
  expect(matches.length).toBeGreaterThanOrEqual(2)  // seed + recursive arms
})

it('LineageRow interface declares imageUrl field', () => {
  if (!existsSync(HIERARCHY_PATH)) return
  const src = readFileSync(HIERARCHY_PATH, 'utf-8')
  expect(src).toMatch(/imageUrl:\s*string\s*\|\s*null/)
})

it('getSameFamilyForCatalog function is exported', () => {
  if (!existsSync(HIERARCHY_PATH)) return
  const src = readFileSync(HIERARCHY_PATH, 'utf-8')
  expect(src).toMatch(/export\s+(async\s+)?function\s+getSameFamilyForCatalog/)
})
```

---

## Shared Patterns

### Server-Component-imports-Client-Component (Next 16 App Router)

**Source:** `src/components/explore/PopularCollectorRow.tsx:1-71` (canonical precedent)

**Apply to:** `LockedTabCard.tsx` (NSV-14 sub-cell #1)

**Pattern:**
```typescript
// Server Component file — NO 'use client' at top.
import { FollowButton } from '@/components/profile/FollowButton'  // client island
// FollowButton is hydrated on the browser; the host component stays server-rendered.
// Pass serializable props only.
<FollowButton
  viewerId={viewerId}
  targetUserId={collector.userId}
  targetDisplayName={name}
  initialIsFollowing={false}
  variant="inline"
/>
```

**Why this matters for Phase 39b:** Pitfall 8 — author may misread the boundary and add `'use client'` to LockedTabCard, bloating the bundle and breaking the established precedent. PopularCollectorRow demonstrates Server-imports-Client works without serialization errors.

### Two-layer privacy + viewer self-exclusion on cross-user reads

**Source:** `src/data/discovery.ts:74-91` (`getMostFollowedCollectors`) + `src/data/search.ts:83-90` (`searchProfiles`)

**Apply to:** `getCollectorsForCatalog` (NSV-18)

**Pattern:**
```typescript
.innerJoin(profileSettings, eq(profileSettings.userId, profiles.id))
.where(
  and(
    eq(profileSettings.profilePublic, true),    // layer 1 (Phase 18 D-09)
    eq(profileSettings.collectionPublic, true), // layer 2 (NEW for NSV-18 — D-39b-09)
    sql`${profiles.id} != ${viewerId}`,         // self-exclusion (Phase 16 / Phase 19 SRCH-12)
  ),
)
```

**Why this matters:** ASVS V4 access control is load-bearing for NSV-18 per RESEARCH §Security Domain. RLS on `watches` + `profiles` is the second layer, but the postgres-js client uses service-role connection bypassing RLS — DAL WHERE is the load-bearing gate.

### `Number()` cast on Postgres `numeric` columns

**Source:** `src/data/catalog.ts:77-83` (`mapRowToCatalogEntry`) + `src/data/watches.ts:154-160` (verified by grep)

**Apply to:** Any new DAL surfacing `formality / sportiness / heritageScore / confidence` (CatalogTasteAttributes fields).

**Pattern:**
```typescript
formality: row.formality !== null ? Number(row.formality) : null,
sportiness: row.sportiness !== null ? Number(row.sportiness) : null,
heritageScore: row.heritageScore !== null ? Number(row.heritageScore) : null,
confidence: row.confidence !== null ? Number(row.confidence) : null,
```

**Why this matters:** Pitfall 10 — postgres-js returns `numeric(3,2)` as STRING by default. ReferenceIdentityCard's `value * 100` math returns `NaN` on string × number. Already handled in `getWatchesByUser` (verified grep — lines 154-160) and `getCatalogById` (lines 77-83); planner only needs to confirm during plan execution.

### Idempotent operator backfill script

**Source:** `scripts/backfill-catalog-brands.ts:1-157`

**Apply to:** `scripts/seed-lineage.ts` (Wave 0)

**Pattern:**
- Header comment block with phase ref, footgun T-34-04 inheritance, idempotency contract
- `tsx --env-file=.env.local` execution (no inline `import.meta.url` env loading)
- Relative imports (`'../src/db'`) — tsx does not resolve `@/*` aliases
- Multi-pass async function shape returning `{ patched, skipped }` per pass
- `ON CONFLICT ... DO NOTHING` for INSERT idempotency
- `WHERE col IS NULL` for UPDATE idempotency
- Final `console.log` summary with `elapsedMs` + per-pass counts
- `process.exit(0)` on success / `process.exit(1)` on fatal in `main().catch(...)`

### Static import-boundary guard

**Source:** `tests/static/CollectionFitCard.no-engine.test.ts`

**Apply to:** `tests/static/ReferenceIdentityCard.no-engine.test.ts`

**Pattern:**
```typescript
import { existsSync, readFileSync } from 'node:fs'
const cardPath = 'src/components/insights/ReferenceIdentityCard.tsx'
it('does not import @/lib/similarity', () => {
  if (!existsSync(cardPath)) return  // vacuous pass before file lands
  const src = readFileSync(cardPath, 'utf8')
  expect(src).not.toMatch(/from ['"]@\/lib\/similarity['"]/)
})
```

**Why this matters:** D-39b-01 + Phase 20 D-04 lock — pure-renderer cards must not pull engine code into the bundle. The vacuous-pass-via-existsSync pattern lets the test ship before the component file lands (Wave 0 / TDD-friendly).

### Hide-if-empty (module-absent-not-empty) pattern

**Source:** `src/components/explore/TrendingWatches.tsx:23` (`if (watches.length === 0) return null`)

**Apply to:** OtherOwnersRoster, SameFamilyRail, LineageRail (all 3 sections fully omit DOM when query returns 0 rows)

**Pattern:**
```typescript
export function SectionRail({ rows }: { rows: Row[] }) {
  if (rows.length === 0) return null  // D-39b-07 lock
  return <section>...</section>
}
```

**Why this matters:** D-39b-07 / D-39b-09 / D-39b-17 all rely on this. No empty-state cards in Phase 39b.

### Link-wrap on list rows (hover:bg-accent + rounded-md)

**Source:** `src/components/insights/CollectionFitCard.tsx:71-81` (Phase 39 D-07 / NSV-01+15 lock)

**Apply to:** `StatsTabContent.tsx` WornList `<li>` rows (NSV-14 sub-cell #3)

**Pattern:**
```tsx
<li key={item.id}>
  <Link
    href={`/watch/${item.id}`}
    className="flex items-center gap-3 rounded-md p-1 hover:bg-accent"
  >
    {/* existing content */}
  </Link>
</li>
```

**Why this matters:** D-39b-14 explicitly references Phase 39 D-07 lock. `hover:bg-accent` + `p-1` are load-bearing for visual consistency with prior NSV-01+15 ship.

---

## No Analog Found

All 22 files in Phase 39b scope have a close analog in the codebase. No file requires falling back to RESEARCH.md generic patterns alone — every pattern excerpt is sourced from an existing-repo precedent.

---

## Metadata

**Analog search scope:**
- `src/components/insights/`
- `src/components/profile/`
- `src/components/explore/`
- `src/components/ui/`
- `src/data/`
- `src/app/watch/[id]/`
- `src/app/catalog/[catalogId]/`
- `src/app/u/[username]/[tab]/`
- `src/lib/types.ts`
- `src/lib/taste/vocab.ts`
- `src/db/schema.ts`
- `scripts/`
- `tests/static/`
- `tests/components/`
- `tests/data/`
- `package.json`

**Files scanned:** 22 (read in full or targeted offset+limit), pattern verified for every entry in the file scope table.

**Pattern extraction date:** 2026-05-13

**Cross-references:**
- 39b-CONTEXT.md (D-39b-01..D-39b-20)
- 39b-UI-SPEC.md (6/6 approved)
- 39b-RESEARCH.md (Quick Summary, Patterns 1-4, Code Examples 1-3, Pitfalls 1-10)
- Phase 38 D-10 (Watch.catalogTaste LEFT JOIN)
- Phase 35 (getLineageForReference recursive CTE)
- Phase 34 (watches_catalog.family_id, scripts/backfill-catalog-brands.ts canonical pattern)
- Phase 20 D-04 (CollectionFitCard import-boundary lock)
- Phase 18 D-09 + Phase 19 SRCH-12 (two-layer privacy)
