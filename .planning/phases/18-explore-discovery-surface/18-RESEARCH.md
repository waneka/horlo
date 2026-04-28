# Phase 18: /explore Discovery Surface - Research

**Researched:** 2026-04-27
**Domain:** Next.js 16 Server Components + Drizzle SQL aggregation + Cache Components on top of Phase 17 catalog
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**BottomNav 5-Slot Transition**

- **D-01:** Final BottomNav shape ships in this phase: `Home / Search / Wear / Explore / Profile` (5 slots, Profile rightmost, Explore at slot 4). Drops both Add AND the previous Explore-at-slot-2 position. The Wear cradle stays at slot 3 (center, elevated). Active-state resolution mirrors Phase 14 `BottomNav`. Search routes to `/search` (Phase 16). Profile routes to `/u/{username}/collection`. Wear continues to use shared `NavWearButton` with `appearance="bottom-nav"`.
- **D-02:** Add slot is dropped entirely. `/watch/new` reachable from contextual surfaces only — Phase 25 ships UX-01..UX-04 contextual CTAs. **Phase 18 owns Add-slot REMOVAL but does NOT own contextual CTAs.** Acceptable interim friction between Phase 18 ship and Phase 25 ship.
- **D-03:** Profile stays in BottomNav permanently (Instagram pattern). Phase 25 NAV-13/15 (TopNav avatar) ships as ADDITIONAL access on top of BottomNav Profile, NOT as a replacement. **Re-decides DISC-08 wording (Notifications was named) and NAV-14 (Profile-out-of-BottomNav).** Phase 25 needs amendment via `/gsd-discuss-phase 25`.
- **D-04:** Notifications stays in TopNav bell (no Phase 18 change). NotificationBell stays wired in `SlimTopNav` and `DesktopTopNav` shared by reference (Phase 13 + Phase 14 D-11). No bell on BottomNav.

**Sparse-Network Welcome Hero**

- **D-05:** Hero = welcome copy + ONE primary CTA. No multi-CTA, no step-checklist. Exact copy is Claude's Discretion (UI-SPEC locks).
- **D-06:** Hero disappears immediately on threshold cross. Trigger: `followingCount < 3 && wearEventsCount < 1`. Server state always wins; no client-side hide-state, no session-stickiness.
- **D-07:** All 3 rails render BELOW the hero when hero shows. Rails compute independently of hero state.
- **D-08:** Hero CTA routes to `/explore/collectors` via `<Link href="/explore/collectors">`.

**Rail Order, Density & Empty States**

- **D-09:** Rail order top-to-bottom: Popular Collectors → Trending Watches → Gaining Traction.
- **D-10:** Cap = 5 items per rail. "See all" navigates to `/explore/collectors` (Popular Collectors) or `/explore/watches` (Trending + Gaining Traction share this destination).
- **D-11:** Layout shape mixed by content type. Popular Collectors = vertical row list (mirror Phase 10 `SuggestedCollectorRow`). Trending + Gaining Traction = horizontal-scroll image-led cards (mirror Phase 10 `WywtRail`).
- **D-12:** Gaining Traction always renders rail header; body adapts: 0 snapshots = "Not enough data yet"; 1–6 days = compute against oldest available snapshot, sublabel shows actual window; 7+ days = strict 7-day delta.

**Trending vs Gaining Traction Differentiation**

- **D-13:** Same watch card component for both rails. Trending icon = `<Flame />`; Gaining Traction icon = `<TrendingUp />`. Trending sublabel = `· {N} collectors`; Gaining Traction sublabel = `↑ +{delta} this week`.
- **D-14:** Same watch CAN appear in both rails simultaneously. No deduplication.
- **D-15:** Sort tie-breaks within each rail = `(brand_normalized ASC, model_normalized ASC)`. Full SQL: `ORDER BY score DESC, brand_normalized ASC, model_normalized ASC LIMIT 5` for rails; `LIMIT 50` for See-all.

### Claude's Discretion

- Exact hero copy + visual treatment (UI-SPEC locks)
- Hero illustration / icon
- Watch-card click target until Phase 20 ships `/evaluate?catalogId=`. Default = non-clickable; acceptable alternative = link to `/evaluate?catalogId={uuid}` accepting brief 404.
- `/explore/watches` See-all internal layout (tab toggle / sort-by select / two stacked sections)
- Caching strategy — recommended baseline: Popular Collectors per-viewer 5min, Trending global 5min, Gaining Traction global 24h. Hero NOT cached.
- DAL function naming (e.g., `getMostFollowedCollectors`, `getTrendingCatalogWatches`, `getGainingTractionCatalogWatches`). Place in `src/data/follows.ts` or new `src/data/discovery.ts`; watches in `src/data/catalog.ts`.
- Whether to factor a single shared `<DiscoveryWatchCard>` or specialize per-rail
- See-all pagination shape (default cap 50, no infinite scroll)

### Deferred Ideas (OUT OF SCOPE)

- `/evaluate?catalogId=` deep-link target — Phase 20
- Editorial / featured collector slot — DISC-09 (v4.x)
- Trending feed widening to wear shots / follows — DISC-10 (v4.x)
- Filter facets on Trending (movement / case size / style) — adjacent to SRCH-16 (v4.x)
- Realtime updates to /explore — free-tier WebSocket cap (project-wide)
- Phase 25 amendment to NAV-14 + DISC-08 — when Phase 25 plans, re-derive from D-01..D-04
- Hero illustration / motion design — UI-SPEC owns
- `/explore/watches` See-all internal layout — UI-SPEC owns
- Modifying `analyzeSimilarity()` (catalog stays silent infrastructure)
- Catalog watch detail page (no `/watch/{catalogId}` — Phase 20 owns `/evaluate?catalogId=`)

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DISC-03 | User can visit `/explore` and see Server Component shell with sparse-network welcome hero conditionally rendered when `followingCount < 3 && wearEventsCount < 1` | Pattern 1 (page composition); Pattern 6 (hero-outside-cache); New DAL §`getWearEventsCountByUser` + reuse `getFollowerCounts` |
| DISC-04 | User can browse Popular Collectors rail showing most-followed public profiles (excludes self + already-followed) | Pattern 4 (anti-N+1 batched isFollowing); New DAL §`getMostFollowedCollectors`; Two-layer privacy mirrors `searchProfiles` |
| DISC-05 | User can browse Trending Watches rail sorted by `owners_count + wishlist_count * 0.5` using denormalized counts from CAT-09 | Pattern 5 (Trending SQL); New DAL §`getTrendingCatalogWatches`; index `watches_catalog_owners_count_desc_idx` already exists |
| DISC-06 | User can browse Gaining Traction rail showing 7-day delta from CAT-12 daily snapshots | Pattern 5 (Gaining Traction SQL via lateral subquery); D-12 partial-window logic; New DAL §`getGainingTractionCatalogWatches` |
| DISC-07 | User can navigate to `/explore/collectors` and `/explore/watches` "See all" routes for full lists beyond rail caps | Pattern 1 (route file structure); cap-50 LIMIT pattern |
| DISC-08 | BottomNav surfaces Explore as one of its 5 slots (Home / Search / Wear / Explore / Profile per D-01..D-04, **NOT** the original DISC-08 wording with Notifications) | Pattern 7 (BottomNav rewrite); D-01 supersedes original wording |

</phase_requirements>

## Summary

Phase 18 is a UI/read-side phase on top of the Phase 17 catalog substrate. Zero schema work; zero new tables; zero new RLS policies. The phase composes three Server-Component rails plus a per-viewer hero into a single `/explore` route, ships two See-all overflow routes, and rewrites the 5-slot mobile BottomNav. All data infrastructure (denormalized counts, daily snapshots, public-read RLS) was delivered by Phase 17.

The two non-trivial pieces are (1) the **Gaining Traction delta SQL**, which must compute `(current owners_count + 0.5 × current wishlist_count) − (snapshot owners_count + 0.5 × snapshot wishlist_count)` against the oldest snapshot in the last 7 days, gracefully degrading on day 0 / day 1–6 per D-12; and (2) the **Cache Components fan-out**, which has three rails with three distinct cache scopes (per-viewer, global short, global daily) plus a per-viewer hero that MUST stay outside any cache scope. Both have direct precedent in this codebase — Gaining Traction can use the same idiom as the Phase 17 daily snapshot writer; cache fan-out mirrors the Phase 13 `NotificationBell` + Phase 10 `CollectorsLikeYou` pattern.

**Primary recommendation:** Mirror existing Horlo patterns aggressively. The repo is a tight stack (Next 16 Cache Components, Drizzle pre-LIMIT-then-JS-sort + `inArray` anti-N+1, two-layer privacy, fire-and-forget logger, `updateTag` vs `revalidateTag` already documented in `notifications.ts`). Phase 18 invents nothing — it composes existing patterns into a new surface and ships a BottomNav slot rewrite.

## Project Constraints (from CLAUDE.md)

- **Tech stack: Next.js 16 App Router, no rewrites.** Continue `cacheComponents: true` and Server Components by default. AGENTS.md warns "this is NOT the Next.js you know — read the relevant guide in `node_modules/next/dist/docs/` before writing any code."
- **Data model:** Watch and UserPreferences are established — extend, don't break. Phase 17 `watchesCatalog` + `watchesCatalogDailySnapshots` are the canonical sources for /explore.
- **Personal first:** Single-user data isolation must remain correct. /explore is auth-only; Popular Collectors uses `viewerId` for self + already-followed exclusion.
- **Performance:** Target <500 watches per user; no need for complex pagination. Rails cap at 5; See-all caps at 50; no infinite scroll.
- **GSD workflow enforcement:** All edits must flow through GSD commands.

## Standard Stack

### Core (already in repo — no installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 16.2.3 (registry has 16.2.4) [VERIFIED: npm registry] | Server Components + Cache Components + App Router | Already locked at project root |
| `react` / `react-dom` | 19.2.4 [VERIFIED: package.json] | Server Components + Suspense leaves | Already locked |
| `drizzle-orm` | 0.45.2 [VERIFIED: package.json] / 0.45.2 latest [VERIFIED: npm registry] | DB query builder, raw `sql` template, `inArray` batch | Existing DAL idiom |
| `lucide-react` | 1.8.0 (1.11.0 latest [VERIFIED: npm registry]) | `<Flame />` Trending icon, `<TrendingUp />` Gaining Traction icon, `<Compass />` Explore in BottomNav, `<Search />` Search in BottomNav, `<User />` Profile in BottomNav | Already in BottomNav |
| `next/cache` | (Next 16) | `'use cache'` + `cacheTag` + `cacheLife` + `revalidateTag(tag, 'max')` + `updateTag(tag)` | Existing pattern in `NotificationBell` + `CollectorsLikeYou` |
| `next/link` | (Next 16) | "See all" navigation, hero CTA, BottomNav links | Existing pattern |
| Tailwind CSS 4 | ^4 [VERIFIED: package.json] | All styling | Existing convention |

### Supporting (already in repo)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@/components/profile/AvatarDisplay` | n/a (in-repo) | Avatar 40×40 in collector rows | Drop-in for Popular Collectors |
| `@/components/profile/FollowButton` | n/a (in-repo) | Inline follow toggle on collector rows | Drop-in; `variant="inline"` |
| `next/image` (or `<img>` for catalog) | n/a | Watch thumbnails on Trending + Gaining Traction cards | Use `<img>` (or `next/image` with `unoptimized` per `next.config.ts`) — catalog images come from arbitrary retailer hosts |
| `@/lib/utils.cn` | n/a (in-repo) | Class composition | Existing convention |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Two-call DAL (count + list) for Popular Collectors | Single CTE with window function | CTE is simpler SQL but Drizzle CTE support is awkward; two-call mirrors `searchProfiles` and is anti-N+1 by virtue of `inArray` batching (Pattern 4). Stay with two-call. |
| `embla-carousel-react` for horizontal rails | Native CSS `scroll-snap-type` (Phase 10 `WywtRail` pattern) | Native scroll-snap is what `WywtRail` ships; embla is reserved for the WYWT overlay (full-screen swipe). **Use native scroll-snap** for Trending + Gaining Traction. |
| Single shared `<DiscoveryWatchCard>` with sublabel slot prop | Two thin wrappers around a base | Both honor D-13. Single component with `sublabel: ReactNode` prop is leaner and matches the "same card body, different rail framing" intent. **Recommend single component.** |

**Installation:** None required. `npm install` is a no-op for Phase 18.

**Version verification:**
- `next@16.2.3` (project) — registry latest is `16.2.4` [VERIFIED: npm registry]. No upgrade needed for Phase 18; `'use cache'` + `cacheTag` + `cacheLife` + `updateTag` all stable in 16.2.x. [VERIFIED: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/]
- `drizzle-orm@0.45.2` (project + registry latest) [VERIFIED: npm registry]. `sql` template + `inArray` + `desc` + `asc` + `gte` + `eq` all available.
- `lucide-react@1.8.0` (project) — registry has `1.11.0` [VERIFIED: npm registry]. `Flame`, `TrendingUp`, `Compass`, `Search`, `User`, `Sparkles` all stable in 1.8.

## Architecture Patterns

### Recommended Project Structure

```
src/app/explore/
├── page.tsx                    # Replaces v3.0 stub; Server Component shell
├── collectors/
│   └── page.tsx                # See-all overflow for Popular Collectors (LIMIT 50)
└── watches/
    └── page.tsx                # See-all overflow for Trending + Gaining Traction
                                #  (UI-SPEC owns tab/select/stacked layout)

src/components/explore/
├── ExploreHero.tsx             # Sparse-network welcome (NOT cached — per-viewer)
├── PopularCollectors.tsx       # Server Component rail; 'use cache' per-viewer 5min
├── PopularCollectorRow.tsx     # Or reuse src/components/home/SuggestedCollectorRow
├── TrendingWatches.tsx         # Server Component rail; 'use cache' global 5min
├── GainingTractionWatches.tsx  # Server Component rail; 'use cache' global 24h
└── DiscoveryWatchCard.tsx      # Shared by both watch rails (D-13)

src/data/
├── discovery.ts                # NEW: getMostFollowedCollectors, getTrendingCatalogWatches, getGainingTractionCatalogWatches
│                                  (Claude's Discretion — could fold into follows.ts + catalog.ts)
└── wearEvents.ts               # Add getWearEventsCountByUser (cheap COUNT(*))
```

### Pattern 1: /explore Page Composition (Server Component Shell)

**What:** Top-level Server Component that resolves viewer, runs parallel data fetches for hero gate, then composes hero (conditionally) + 3 rail components in fixed order.

**When to use:** The /explore root page; mirrors `src/app/page.tsx` home composition.

**Example:**

```tsx
// src/app/explore/page.tsx
// Source: mirrors src/app/page.tsx (Promise.all home composition)
import { getCurrentUser } from '@/lib/auth'
import { getFollowerCounts } from '@/data/profiles'           // returns { followers, following }
import { getWearEventsCountByUser } from '@/data/wearEvents'  // NEW (Pattern 8)
import { ExploreHero } from '@/components/explore/ExploreHero'
import { PopularCollectors } from '@/components/explore/PopularCollectors'
import { TrendingWatches } from '@/components/explore/TrendingWatches'
import { GainingTractionWatches } from '@/components/explore/GainingTractionWatches'

export default async function ExplorePage() {
  const user = await getCurrentUser() // proxy.ts already redirected unauth viewers

  // Hero gate runs OUTSIDE any 'use cache' scope — per-viewer, server state always wins (D-06).
  const [{ following: followingCount }, wearEventsCount] = await Promise.all([
    getFollowerCounts(user.id),
    getWearEventsCountByUser(user.id),
  ])
  const showHero = followingCount < 3 && wearEventsCount < 1

  return (
    <main className="container mx-auto px-4 md:px-8 py-8 space-y-8 md:space-y-12 max-w-6xl">
      {showHero && <ExploreHero />}
      <PopularCollectors viewerId={user.id} />
      <TrendingWatches />
      <GainingTractionWatches />
    </main>
  )
}
```

[CITED: src/app/page.tsx Promise.all + L-01 fixed-order composition]

### Pattern 2: Cache Components TTL + Tag-Fanout Matrix (Phase 18 Specific)

**What:** Three rail Server Components, each with its own `'use cache'` scope and tag set. Hero stays outside cache. The viewerId MUST flow as an explicit prop to per-viewer cached components — resolving identity *inside* a cached scope leaks state across users (Phase 13 Pitfall 5; documented in `NotificationBell.tsx` source comment).

**When to use:** Each of the three rails. Hero is the explicit non-cache exception.

**Example (Popular Collectors — per-viewer):**

```tsx
// src/components/explore/PopularCollectors.tsx
// Source: mirrors src/components/notifications/NotificationBell.tsx pattern
import { cacheLife, cacheTag } from 'next/cache'
import Link from 'next/link'
import { getMostFollowedCollectors } from '@/data/discovery'
import { PopularCollectorRow } from '@/components/explore/PopularCollectorRow'

export async function PopularCollectors({ viewerId }: { viewerId: string }) {
  'use cache'
  // CRITICAL (Phase 13 Pitfall 5): viewerId MUST be an explicit prop.
  // Do NOT call getCurrentUser() inside the cached scope — cache key would
  // omit viewer and leak state across users.
  cacheTag('explore', `explore:popular-collectors:viewer:${viewerId}`)
  cacheLife({ revalidate: 300 })  // 5min — matches Phase 10 'minutes' profile spirit

  const collectors = await getMostFollowedCollectors(viewerId, { limit: 5 })
  if (collectors.length === 0) return null  // D-12 hide-on-empty for non-Gaining-Traction rails

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Popular collectors</h2>
        <Link href="/explore/collectors" className="text-sm text-muted-foreground">See all</Link>
      </header>
      <div className="space-y-2">
        {collectors.map((c) => <PopularCollectorRow key={c.userId} collector={c} viewerId={viewerId} />)}
      </div>
    </section>
  )
}
```

**Example (Trending Watches — global short):**

```tsx
// src/components/explore/TrendingWatches.tsx
import { cacheLife, cacheTag } from 'next/cache'
import { Flame } from 'lucide-react'
import Link from 'next/link'
import { getTrendingCatalogWatches } from '@/data/discovery'
import { DiscoveryWatchCard } from '@/components/explore/DiscoveryWatchCard'

export async function TrendingWatches() {
  'use cache'
  cacheTag('explore', 'explore:trending-watches')
  cacheLife({ revalidate: 300 })  // 5min

  const watches = await getTrendingCatalogWatches({ limit: 5 })
  if (watches.length === 0) return null

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Flame className="size-5" aria-hidden /> Trending
        </h2>
        <Link href="/explore/watches" className="text-sm text-muted-foreground">See all</Link>
      </header>
      <div className="flex gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2">
        {watches.map((w) => (
          <div key={w.id} className="snap-start">
            <DiscoveryWatchCard watch={w} sublabel={`· ${w.ownersCount} collectors`} />
          </div>
        ))}
      </div>
    </section>
  )
}
```

**Example (Gaining Traction — global daily):**

```tsx
// src/components/explore/GainingTractionWatches.tsx
import { cacheLife, cacheTag } from 'next/cache'
import { TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { getGainingTractionCatalogWatches } from '@/data/discovery'
import { DiscoveryWatchCard } from '@/components/explore/DiscoveryWatchCard'

export async function GainingTractionWatches() {
  'use cache'
  cacheTag('explore', 'explore:gaining-traction')
  cacheLife({ revalidate: 86400 })  // 24h — snapshots refresh daily via pg_cron 03:00 UTC

  const result = await getGainingTractionCatalogWatches({ limit: 5 })
  // result = { window: number, watches: GainingTractionWatch[] }
  // window: 0 → "Not enough data yet" body; 1–6 → "in N days"; 7 → "this week"

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <TrendingUp className="size-5" aria-hidden /> Gaining traction
        </h2>
        {result.window >= 1 && (
          <Link href="/explore/watches" className="text-sm text-muted-foreground">See all</Link>
        )}
      </header>
      {result.window === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Not enough data yet — check back in a few days.
        </p>
      ) : (
        <div className="flex gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2">
          {result.watches.map((w) => (
            <div key={w.id} className="snap-start">
              <DiscoveryWatchCard
                watch={w}
                sublabel={`↑ +${w.delta} ${result.window === 7 ? 'this week' : `in ${result.window} day${result.window === 1 ? '' : 's'}`}`}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
```

[CITED: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cacheLife.md (preset profiles + inline `{revalidate: N}`)]
[CITED: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cacheTag.md (multi-tag idempotent + 256-char limit)]
[CITED: src/components/notifications/NotificationBell.tsx (canonical viewerId-as-prop + cacheLife({revalidate:30}))]

### Pattern 3: Hero Stays Outside Cache — Suspense Leaf Discipline

**What:** The hero render gate depends on per-viewer counts (`followingCount`, `wearEventsCount`) that change frequently. Putting hero inside `'use cache'` would either (a) require per-viewer cache keys for an already-tiny computation or (b) leak across viewers. **Mirror Phase 14 `BottomNavServer` Suspense-leaf pattern** — hero rendering is a thin Server Component, not cached, parallel-fetches its two counts, and either renders or returns null. The page-level `<main>` does not wrap individual rails in nested Suspense (each rail is its own cache scope; cache hit returns instantly).

**Why it matters:** Caching the hero would mean either a stale "show hero" decision (after the user follows their 3rd collector, they'd still see the hero until cache expiry) OR a cacheTag fan-out on every follow / wear write — needless complexity for a server-render-cheap Boolean computation.

**Example:** Pattern 1 above already shows the hero gate computed at the page level outside any `'use cache'`. The hero component itself is a pure render with no DAL reads — it does not need its own Suspense leaf because it never blocks.

### Pattern 4: Anti-N+1 `inArray` Batched Hydration (Popular Collectors)

**What:** Pre-LIMIT candidate query → JS sort → batched `inArray(follows.followingId, topIds)` to hydrate `isFollowing` flags in a single SQL round trip. **Direct mirror of `src/data/search.ts` `searchProfiles`** which already ships this exact pattern.

**When to use:** `getMostFollowedCollectors`. Note: per D-11 the row only needs basic profile fields + a follower count — `isFollowing` is *guaranteed false* by the `notInArray(profiles.id, alreadyFollowing)` exclusion (mirrors Phase 10 `getSuggestedCollectors`), so the `inArray` second-query is technically optional here. Recommendation: skip the second query for Popular Collectors and rely on exclusion semantics; the row component sets `initialIsFollowing={false}` always (mirrors `SuggestedCollectorRow` line 92).

**Example:**

```typescript
// src/data/discovery.ts (NEW file) — getMostFollowedCollectors
// Source: mirrors src/data/suggestions.ts step 1-3 (exclusion shape) + src/data/follows.ts mergeListEntries (count aggregation)
import 'server-only'
import { db } from '@/db'
import { follows, profiles, profileSettings, watches } from '@/db/schema'
import { and, count, desc, eq, inArray, notInArray, sql } from 'drizzle-orm'

export interface PopularCollector {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  followersCount: number
  watchCount: number
}

export async function getMostFollowedCollectors(
  viewerId: string,
  opts: { limit?: number } = {},
): Promise<PopularCollector[]> {
  const limit = opts.limit ?? 5

  // 1. Already-followed exclusion (mirrors getSuggestedCollectors step 1)
  const followingRows = await db
    .select({ id: follows.followingId })
    .from(follows)
    .where(eq(follows.followerId, viewerId))
  const excludeIds = [viewerId, ...followingRows.map((r) => r.id)]

  // 2. Aggregate followers, JOIN profile gate, exclude self+followed.
  //    Two-layer privacy (profileSettings.profilePublic = true) mirrors searchProfiles.
  //    Pre-LIMIT slightly larger than `limit` to allow JS tie-break sort by username.
  const rows = await db
    .select({
      userId: profiles.id,
      username: profiles.username,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
      followersCount: count(follows.id),
    })
    .from(profiles)
    .innerJoin(profileSettings, eq(profileSettings.userId, profiles.id))
    .leftJoin(follows, eq(follows.followingId, profiles.id))
    .where(
      and(
        eq(profileSettings.profilePublic, true),
        excludeIds.length > 0 ? notInArray(profiles.id, excludeIds) : undefined,
      ),
    )
    .groupBy(profiles.id, profileSettings.profilePublic)
    .orderBy(desc(count(follows.id)), profiles.username)  // D-15 tie-break by username ASC
    .limit(Math.max(limit, 50))  // Pre-LIMIT cap (Pattern 5 of Phase 16)

  if (rows.length === 0) return []

  // 3. Hydrate watchCount via inArray batch (mirrors getFollowersForProfile mergeListEntries)
  const ids = rows.map((r) => r.userId)
  const watchAggs = await db
    .select({
      userId: watches.userId,
      watchCount: sql<number>`count(*) FILTER (WHERE ${watches.status} = 'owned')::int`,
    })
    .from(watches)
    .where(inArray(watches.userId, ids))
    .groupBy(watches.userId)
  const watchById = new Map(watchAggs.map((w) => [w.userId, w.watchCount]))

  // 4. JS slice to final limit (already sorted by SQL)
  return rows.slice(0, limit).map((r) => ({
    userId: r.userId,
    username: r.username,
    displayName: r.displayName,
    avatarUrl: r.avatarUrl,
    followersCount: Number(r.followersCount),
    watchCount: watchById.get(r.userId) ?? 0,
  }))
}
```

[CITED: src/data/search.ts (`searchProfiles` two-layer privacy + pre-LIMIT cap + viewer self-exclusion)]
[CITED: src/data/follows.ts `mergeListEntries` (inArray batch hydration of profile + watch aggregates)]
[CITED: src/data/suggestions.ts `getSuggestedCollectors` step 1 + step 3 (alreadyFollowing exclusion shape)]

### Pattern 5: Trending + Gaining Traction SQL Shapes

**Trending Watches** is straightforward — read directly from the denormalized counts on `watches_catalog`. Phase 17 already shipped `watches_catalog_owners_count_desc_idx` (single-column DESC NULLS LAST) but the score `owners_count + 0.5 * wishlist_count` isn't covered by an index. At <500 watches per user × <1000 catalog rows v4.0 scale, this is fine — the table is tiny enough that a Seq Scan + sort is sub-50ms. No index needed beyond what Phase 17 ships.

**Gaining Traction** is the only non-trivial query in this phase. Per D-12, three cases must be handled:

1. **0 snapshots exist (deploy day):** Return `{ window: 0, watches: [] }`. UI shows empty-state copy.
2. **1–6 days of snapshots:** Compute delta vs. **oldest snapshot in the last 7 days** (i.e., the actual oldest available, since catalog hasn't accumulated 7 days yet).
3. **7+ days:** Compute delta vs. snapshot from exactly 7 days ago (strict 7-day window).

The cleanest SQL shape is a **CTE + LATERAL subquery** that picks the oldest snapshot per catalog row within the [today − 6 days, today] window, then joins to the current catalog counts:

```typescript
// src/data/discovery.ts — getGainingTractionCatalogWatches
// Source: mirrors src/data/follows.ts pattern of raw-sql for non-trivial aggregation
import 'server-only'
import { db } from '@/db'
import { sql } from 'drizzle-orm'

export interface GainingTractionWatch {
  id: string
  brand: string
  model: string
  reference: string | null
  imageUrl: string | null
  delta: number  // (current owners + 0.5 * current wishlist) - (snapshot owners + 0.5 * snapshot wishlist)
}

export interface GainingTractionResult {
  window: number  // 0 = no snapshots, 1-6 = partial, 7 = full
  watches: GainingTractionWatch[]
}

export async function getGainingTractionCatalogWatches(
  opts: { limit?: number } = {},
): Promise<GainingTractionResult> {
  const limit = opts.limit ?? 5

  // 1. Discover snapshot age — what is the oldest snapshot date we have?
  //    Cheap query against the unique-per-day index (watches_catalog_snapshots_date_idx).
  const oldestRows = await db.execute<{ oldest: string | null; max_age_days: number }>(sql`
    SELECT MIN(snapshot_date) AS oldest,
           COALESCE(EXTRACT(DAY FROM (current_date - MIN(snapshot_date)::date))::int, 0) AS max_age_days
      FROM watches_catalog_daily_snapshots
  `)
  const oldest = (oldestRows as unknown as Array<{ oldest: string | null; max_age_days: number }>)[0]
  if (!oldest || !oldest.oldest) {
    return { window: 0, watches: [] }
  }

  // window = min(max_age_days, 7), clamped to [1, 7]
  const window = Math.max(1, Math.min(oldest.max_age_days ?? 0, 7))

  // 2. Compute delta. Pick per-catalog the OLDEST snapshot within the last `window` days,
  //    then JOIN current catalog counts. Score = (current.score - snap.score) DESC.
  //    Tie-break per D-15: brand_normalized ASC, model_normalized ASC.
  //    Index reachability: watches_catalog_snapshots_date_idx (snapshot_date, catalog_id) is
  //    Phase 17 — supports the WHERE snapshot_date >= today - N efficiently.
  const rows = await db.execute<{
    id: string; brand: string; model: string; reference: string | null;
    image_url: string | null; delta: number;
  }>(sql`
    WITH base AS (
      SELECT DISTINCT ON (s.catalog_id)
             s.catalog_id,
             s.owners_count   AS snap_owners,
             s.wishlist_count AS snap_wishlist
        FROM watches_catalog_daily_snapshots s
       WHERE s.snapshot_date >= (current_date - ${window} * INTERVAL '1 day')::date::text
       ORDER BY s.catalog_id, s.snapshot_date ASC
    )
    SELECT wc.id,
           wc.brand,
           wc.model,
           wc.reference,
           wc.image_url,
           ROUND(
             (wc.owners_count + 0.5 * wc.wishlist_count)
             - (base.snap_owners + 0.5 * base.snap_wishlist)
           )::int AS delta
      FROM watches_catalog wc
      JOIN base ON base.catalog_id = wc.id
     WHERE (wc.owners_count + 0.5 * wc.wishlist_count)
           > (base.snap_owners + 0.5 * base.snap_wishlist)
     ORDER BY delta DESC,
              wc.brand_normalized ASC,
              wc.model_normalized ASC
     LIMIT ${limit}
  `)

  const watches = (rows as unknown as Array<{
    id: string; brand: string; model: string; reference: string | null;
    image_url: string | null; delta: number;
  }>).map((r) => ({
    id: r.id,
    brand: r.brand,
    model: r.model,
    reference: r.reference,
    imageUrl: r.image_url,
    delta: r.delta,
  }))

  return { window, watches }
}
```

**Index reachability:** Phase 17 ships `watches_catalog_snapshots_date_idx ON (snapshot_date, snapshot_date, catalog_id)` (per `src/db/schema.ts:343`) — supports the `WHERE snapshot_date >= ...` predicate directly. The `DISTINCT ON (catalog_id) ORDER BY catalog_id, snapshot_date ASC` operator picks the oldest snapshot per catalog row in one pass. This pattern is the standard Postgres idiom for "earliest row per group" and is well-known to Postgres planners.

**Trending Watches** is much simpler:

```typescript
// src/data/discovery.ts — getTrendingCatalogWatches
import 'server-only'
import { db } from '@/db'
import { watchesCatalog } from '@/db/schema'
import { desc, sql, asc, gt } from 'drizzle-orm'

export interface TrendingWatch {
  id: string
  brand: string
  model: string
  reference: string | null
  imageUrl: string | null
  ownersCount: number
  wishlistCount: number
}

export async function getTrendingCatalogWatches(
  opts: { limit?: number } = {},
): Promise<TrendingWatch[]> {
  const limit = opts.limit ?? 5
  const rows = await db
    .select({
      id: watchesCatalog.id,
      brand: watchesCatalog.brand,
      model: watchesCatalog.model,
      reference: watchesCatalog.reference,
      imageUrl: watchesCatalog.imageUrl,
      ownersCount: watchesCatalog.ownersCount,
      wishlistCount: watchesCatalog.wishlistCount,
    })
    .from(watchesCatalog)
    .where(sql`(${watchesCatalog.ownersCount} + 0.5 * ${watchesCatalog.wishlistCount}) > 0`)
    .orderBy(
      desc(sql`(${watchesCatalog.ownersCount} + 0.5 * ${watchesCatalog.wishlistCount})`),
      asc(watchesCatalog.brandNormalized),
      asc(watchesCatalog.modelNormalized),
    )
    .limit(limit)
  return rows
}
```

**Cap-5 vs cap-50 strategy:** For rails (limit=5), cap directly at SQL. For See-all (limit=50), same DAL function with limit=50; no JS post-sort needed because SQL already produces the canonical order. **Recommendation:** Single DAL function per rail, parameterized by limit; rail callers pass 5, See-all pages pass 50. Mirrors `getSuggestedCollectors` opts shape.

[CITED: src/db/schema.ts:343 (`watches_catalog_snapshots_date_idx`)]
[CITED: supabase/migrations/20260427000000_phase17_catalog_schema.sql:148-149 (`watches_catalog_owners_count_desc_idx`)]
[CITED: supabase/migrations/20260427000001_phase17_pg_cron.sql:55-63 (snapshot writer with `current_date::text` insertion)]

### Pattern 6: Server Action Tag Invalidation Matrix (`updateTag` vs `revalidateTag`)

**What:** When a user follows someone or adds a watch, the affected /explore rails need to refresh. The repo already documents the canonical `updateTag` (read-your-own-writes) vs `revalidateTag` (cross-user fan-out) split in `src/app/actions/notifications.ts:14-55`. Phase 18 extends this matrix.

**Tag-fanout matrix:**

| Server Action | Affected /explore rails | Tag(s) to invalidate | API | Why |
|---------------|-------------------------|----------------------|-----|-----|
| `followUser(userId)` | Popular Collectors per-viewer cache (the just-followed person should drop off the rail on next render) | `explore:popular-collectors:viewer:${user.id}` | `updateTag(...)` | Read-your-own-writes — caller is the same viewer whose rail recomputes. The 5min cacheLife would otherwise stick. |
| `unfollowUser(userId)` | Same as above (the just-unfollowed person becomes re-eligible) | `explore:popular-collectors:viewer:${user.id}` | `updateTag(...)` | Same RYO semantics. |
| `addWatch` (status='owned' or 'wishlist') | Trending Watches global; potentially Gaining Traction global | `explore:trending-watches` AND `explore:gaining-traction` (or just `explore` for fan-out) | `revalidateTag('explore', 'max')` | Cross-user — the writer is one user, but Trending is global. SWR semantics are fine; new watch surfaces within the cacheLife window. **Note:** `addWatch` already invalidates `viewer:${recipient.userId}` for overlap notifications — this is additive. |
| `removeWatch` | Same as `addWatch` (counts decrement) | `explore:trending-watches` AND `explore:gaining-traction` | `revalidateTag('explore', 'max')` | Same fan-out. |
| (pg_cron daily refresh @ 03:00 UTC) | Gaining Traction (uses snapshots) | n/a (cache TTL is 24h) | n/a | The 24h `cacheLife` TTL aligns with the cron cadence; manual invalidation is unnecessary. If a planner wants belt-and-suspenders, expose a Server Action `refreshDiscovery()` that calls `revalidateTag('explore', 'max')` and wire it to the local `npm run db:refresh-counts` script — but this is over-engineering for v4.0. |

**Why `'explore'` as a multi-tag root:** `cacheTag` accepts multiple tags (`cacheTag('explore', 'explore:trending-watches')` per `cacheTag.md:88-93`). Tagging both lets `addWatch` either fan-out to `'explore'` (broad) or be surgical with `'explore:trending-watches'` (specific). **Recommendation:** Tag broad (`'explore'`) on writes; tag both broad-and-specific on reads. Keeps the write side simple while leaving room for future per-rail invalidation.

**Critical Next 16 quirks:**

1. `updateTag(tag)` is **Server Actions only** [CITED: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/updateTag.md:11-15]. In Route Handlers, use `revalidateTag(tag, 'max')`.
2. `revalidateTag(tag)` (no second arg) is legacy — equivalent to `updateTag(tag)`. Always pass `'max'` for stale-while-revalidate semantics on cross-user fan-out (precedent: `src/app/actions/follows.ts:77`).
3. **`revalidateTag` cannot be called during render** — only in Server Actions or Route Handlers. The page Server Component MUST NOT call it. (See `src/components/notifications/MarkNotificationsSeenOnMount.tsx` for the client-mount workaround pattern, but Phase 18 doesn't need this — all invalidation happens from existing Server Actions.)

### Pattern 7: BottomNav 5-Slot Rewrite

**What:** The current 5 slots are `Home / Explore / Wear / Add / Profile` (per `src/components/layout/BottomNav.tsx:122-145`). New 5 slots are `Home / Search / Wear / Explore / Profile`. The Wear cradle stays in slot 3 (center, elevated). All structural mechanics (safe-area iOS padding, icon strokeWidth toggle, label band) stay intact.

**Diff (file: `src/components/layout/BottomNav.tsx`):**

| Aspect | Before | After |
|--------|--------|-------|
| Imports | `import { Home, Compass, Plus, User } from 'lucide-react'` | `import { Home, Search, Compass, User } from 'lucide-react'` |
| Active-state predicates | `isHome`, `isExplore`, `isAdd`, `isProfile` | `isHome`, `isSearch`, `isExplore`, `isProfile` |
| `isAdd` | `pathname === '/watch/new'` | **DELETED** |
| `isSearch` | (none) | `pathname === '/search' \|\| pathname.startsWith('/search/')` |
| Slot 2 NavLink | `<NavLink href="/explore" icon={Compass} label="Explore" active={isExplore} />` | `<NavLink href="/search" icon={Search} label="Search" active={isSearch} />` |
| Slot 3 (cradle) | `<NavWearButton .../>` | unchanged |
| Slot 4 NavLink | `<NavLink href="/watch/new" icon={Plus} label="Add" active={isAdd} />` | `<NavLink href="/explore" icon={Compass} label="Explore" active={isExplore} />` |
| Slot 5 NavLink (Profile) | unchanged | unchanged |
| Doc comment top | "5 flex columns: Home · Explore · Wear · Add · Profile" | "5 flex columns: Home · Search · Wear · Explore · Profile" |

**`BottomNavServer.tsx` props:** No change needed. `username`, `ownedWatches`, `viewerId` all still resolved upstream (`getCurrentUser` → `getProfileById` + `getWatchesByUser` Promise.all). Search slot is path-only, no data fetch. (Confirmed by reading `src/components/layout/BottomNavServer.tsx:25-54`.)

**`SlimTopNav.tsx` and `DesktopTopNav.tsx`:** No change. NotificationBell stays per D-04. `DesktopTopNav` already includes a `<Link href="/explore">Explore</Link>` (line 70-74) — still correct.

**Active-state path-prefix utility:** None exists today. Each predicate is inlined per-component (e.g., `pathname.startsWith('/u/${username}')` in line 106). Phase 18 plan can choose to inline (status quo) or factor a small helper. **Recommendation: inline** — three predicates is below the abstraction threshold.

**Phase-25 interim props check:** Read `BottomNav.tsx` end-to-end. There are NO half-shipped Phase 25-related interim props. The current 5 slots are the v3.0 shape; D-03 supersedes NAV-14's "Profile out of BottomNav" decision before Phase 25 ships, so Phase 18 is the canonical authoring surface.

[CITED: src/components/layout/BottomNav.tsx:99-148 (current implementation; surgical diff above)]
[CITED: src/components/layout/BottomNavServer.tsx:25-54 (props unchanged)]

### Pattern 8: New `getWearEventsCountByUser` Helper

**What:** The hero render gate needs a CHEAP COUNT(*) read of wear events per user. The existing `getAllWearEventsByUser(userId)` (in `src/data/wearEvents.ts:131-137`) returns the full list — heavy when used purely as a "any wear events?" gate. No existing helper covers this. **New DAL function needed.**

**When to use:** Hero render gate only. Other surfaces (worn tab, profile insights) use `getAllWearEventsByUser` for the full list.

**Example:**

```typescript
// src/data/wearEvents.ts — append at end of file
import { count } from 'drizzle-orm'

/**
 * Cheap COUNT(*) of wear events for a user.
 * Used by Phase 18 /explore hero render gate (DISC-03).
 * Pattern mirrors getFollowerCounts in src/data/profiles.ts:83-97.
 */
export async function getWearEventsCountByUser(userId: string): Promise<number> {
  const rows = await db
    .select({ count: count() })
    .from(wearEvents)
    .where(eq(wearEvents.userId, userId))
  return Number(rows[0]?.count ?? 0)
}
```

[CITED: src/data/profiles.ts:83-97 (`getFollowerCounts` count() pattern)]
[CITED: src/data/wearEvents.ts:131-137 (`getAllWearEventsByUser` heavy list helper to compare)]

### Anti-Patterns to Avoid

- **Resolving viewerId inside a `'use cache'` scope:** Documented Phase 13 Pitfall 5; would leak per-viewer state across users. Always pass `viewerId` as an explicit prop.
- **Wrapping the rails in nested Suspense leaves:** Each rail is its own cache scope; cache hit returns instantly. Nested Suspense adds noise without benefit. Reserve Suspense for the page-level shell only (mirrors `src/app/page.tsx`).
- **Tagging `cacheTag('viewer:${id}')` on rail caches:** That tag is owned by Phase 13 NotificationBell + Phase 13 markRead actions. If Phase 18 piggybacks, every notification mark-read fires a Popular Collectors recompute — wasted work. Use `explore:popular-collectors:viewer:${id}` instead.
- **Reading `getAllWearEventsByUser` for the hero gate:** Pulls full row data when only COUNT(*) is needed. Add the new `getWearEventsCountByUser` helper.
- **Calling `revalidateTag` from a Server Component render scope:** Next 16 throws E7 (`workUnitStore.phase === 'render'`). Pattern documented in `src/app/actions/notifications.ts:124-138`. /explore page should NEVER call `revalidateTag` directly — only Server Actions invalidate.
- **Filtering Popular Collectors results in JS post-fetch:** Drizzle's `notInArray(profiles.id, excludeIds)` runs in SQL. Doing the exclusion in JS would defeat the pre-LIMIT cap and pull excluded rows over the wire (a privacy footgun if `excludeIds` includes private profiles).
- **Relying on RLS alone for `profileSettings.profilePublic`:** Two-layer privacy is the project default — DAL `WHERE` clause is defense-in-depth even though RLS already enforces it. (Catalog deliberately departs per Phase 17 D-asymmetry, but profiles-side privacy retains both layers.)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Horizontal-scroll rail with snap behavior | Custom carousel component / pointer-event handlers | Native CSS `flex gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2` with child `class="snap-start"` | Phase 10 `WywtRail` ships this exact pattern; native scroll works on iOS without polyfills; embla-carousel-react is reserved for the WYWT overlay (full-screen swipe). |
| Avatar 40×40 with fallback initial | Custom AvatarFallback logic | `<AvatarDisplay avatarUrl={...} displayName={...} username={...} size={40} />` | Already used by Phase 10; covers null avatarUrl + display-vs-username precedence. |
| Inline follow toggle that doesn't bubble click to row link | Custom event-stop handlers | `<FollowButton variant="inline" />` wrapped in `<div className="relative z-10">` (see SuggestedCollectorRow:86-94) | Already shipped in Phase 10. |
| `isFollowing` hydration | Per-row SQL query (N+1) | `inArray(follows.followingId, topIds)` single-batch query then `Set.has()` lookup (Pattern 4) | Existing pattern; Phase 16 Pitfall C-4. |
| Per-viewer cache key | Manually compose tag suffix from request | `cacheTag('explore:popular-collectors:viewer:${viewerId}')` with viewerId as Server Component prop | Documented Phase 13 Pitfall 5 in NotificationBell.tsx; Next 16 enforces `'use cache'` props are part of the cache key. |
| Cron-style "refresh discovery" Server Action | Custom job runner | `cacheLife({revalidate: 86400})` aligned with pg_cron 03:00 UTC + optional manual `revalidateTag('explore', 'max')` | Cache TTL aligns with cron cadence; no extra infra. |
| 7-day delta computation | Application-level subtract-after-fetch loops | Single SQL CTE + LATERAL with `DISTINCT ON (catalog_id) ORDER BY catalog_id, snapshot_date ASC` (Pattern 5) | Postgres planner-known idiom; index `watches_catalog_snapshots_date_idx` already covers it. |
| Empty-state copy for Popular Collectors / Trending | Custom "no items" messaging | Return `null` from the rail Server Component (CSS `space-y-8` collapses cleanly — see `CollectorsLikeYou.tsx:28`) | D-12 "Empty-state policy for Popular Collectors / Trending Watches: hide rail header entirely on 0 rows." |
| Hero illustration | Build SVG from scratch | Use existing lucide icon (`<Sparkles />` or `<Compass />`); UI-SPEC will pin choice | Discretion item; UI-SPEC owns. |

**Key insight:** Phase 18 is composition-heavy, not invention-heavy. Every component, DAL pattern, cache primitive, and SQL idiom needed has direct precedent in Phase 10, 13, 14, 16, or 17. The Plan should look like 4-6 thin wiring tasks, not 12 from-scratch tasks.

## Runtime State Inventory

> Phase 18 is greenfield UI/read-side composition with one BottomNav slot rewrite. No rename, no refactor of stored data, no migration.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — verified by reading Phase 17 schema (`src/db/schema.ts:267-345`) and Phase 18 CONTEXT.md "Out of scope". No new tables, no column renames, no data shape changes. | None |
| Live service config | None — no n8n, Datadog, Tailscale, or Cloudflare config interacts with /explore. The pg_cron job from Phase 17 is unchanged by Phase 18. | None |
| OS-registered state | None — no Task Scheduler, pm2, launchd, or systemd state. | None |
| Secrets/env vars | None — Phase 18 reads no env vars beyond the existing `DATABASE_URL` / `SUPABASE_*` / `ANTHROPIC_API_KEY` already in use. | None |
| Build artifacts | None — no package rename, no `pyproject.toml`-equivalent rewire. | None |

## Common Pitfalls

### Pitfall 1: viewerId Resolved Inside Cache Scope (Cross-User Leak)

**What goes wrong:** A rail Server Component calls `getCurrentUser()` inside its own `'use cache'` body. Cache key omits viewer; first user's Popular Collectors rail gets returned to the second user.

**Why it happens:** Convenience trap — `'use cache'` looks like it should "just work." But `getCurrentUser()` reads cookies and returns different values per request, and the cache machinery snapshots the function output keyed by *positional arguments*, not request-scoped state.

**How to avoid:** ALWAYS pass `viewerId` as a Server Component prop (see `NotificationBell.tsx:19` and the lecture comment lines 11-18). The page Server Component does `const user = await getCurrentUser()` ONCE, then forwards `user.id` to each per-viewer rail.

**Warning signs:** Code review check — any `'use cache'` function that calls `getCurrentUser()`, reads cookies, or accesses request headers.

### Pitfall 2: Drizzle `count()` Type Coercion

**What goes wrong:** Drizzle `count()` aggregates return `number | string` typed at runtime depending on Postgres driver settings. Direct comparison `r.followersCount > 100` may silently coerce strings, producing wrong sort order.

**Why it happens:** postgres.js driver returns `bigint` for COUNT(*) which JS receives as `string`.

**How to avoid:** Either (a) cast in SQL: `sql<number>\`count(*)::int\`` (mirrors `src/data/profiles.ts:88` and `src/data/follows.ts:147`), or (b) wrap with `Number()` in JS. Recommendation: cast in SQL for consistency with existing DAL.

**Warning signs:** Sort orders that look "almost right" but lexicographic instead of numeric.

### Pitfall 3: Snapshot Date String Comparison

**What goes wrong:** `watches_catalog_daily_snapshots.snapshot_date` is a `text` column (per `src/db/schema.ts:336`). String comparison works for ISO `YYYY-MM-DD` (lexicographic == chronological), but only because the format is fixed-width zero-padded. A query that does `WHERE snapshot_date >= NOW() - INTERVAL '7 days'` will fail because the right side is a `timestamptz`, not a string.

**Why it happens:** `text`-typed dates are common in this repo (`wear_events.worn_date` line 234) for ISO-day storage. Mixing with interval arithmetic requires explicit cast.

**How to avoid:** Always cast: `WHERE snapshot_date >= (current_date - INTERVAL '7 days')::date::text` (Pattern 5 query). Mirror `getWearRailForViewer:319` which casts `cutoffDate = new Date(cutoffMs).toISOString().slice(0, 10)` in JS.

**Warning signs:** Empty Gaining Traction rail when snapshots clearly exist; or unexplained Postgres `operator does not exist: text >= timestamp` errors.

### Pitfall 4: pg_cron Hasn't Run Yet on Deploy Day

**What goes wrong:** On Phase 18 deploy day, `watches_catalog_daily_snapshots` may have 0 rows (if pg_cron hasn't fired its 03:00 UTC slot yet) OR 1 row (if it has). The hero gate doesn't depend on snapshots, but Gaining Traction does. D-12 specifies this — but the planner must remember to test all three windows: 0, 1, 7+.

**Why it happens:** pg_cron runs at `0 3 * * *` UTC (per `supabase/migrations/20260427000001_phase17_pg_cron.sql:107-108`). If Phase 17 was deployed after 03:00 UTC on day 0, the first snapshot doesn't land until day 1.

**How to avoid:** Manual `npm run db:refresh-counts` writes a snapshot row immediately (per Phase 17 D-16). Pre-deploy step: run this once on prod via the same script Phase 17 ships, so deploy day has at least 1 snapshot. Document in plan; surface in `docs/deploy-db-setup.md` if needed.

**Warning signs:** Empty Gaining Traction rail post-deploy on day 0; Day 1 shows "↑ +N in 1 day" sublabel; Day 7+ stable.

### Pitfall 5: BottomNav Active-State Drift After Slot Reorder

**What goes wrong:** When `isAdd` is deleted and `isSearch` is added, code that consumed those locals (e.g., a hypothetical analytics hook) breaks silently.

**Why it happens:** TypeScript will catch missing imports + undefined variables, but a stray `analytics.track(isAdd ? 'add' : 'other')` survives unused-import linting.

**How to avoid:** `npm run lint` after the rewrite + manual grep for `isAdd` across `src/`. Phase 18 plan should include a tasklet "grep for `isAdd` references; verify zero hits outside `BottomNav.tsx`."

**Warning signs:** None at runtime — TypeScript catches `Cannot find name 'isAdd'`. Just verify the grep is part of the plan.

### Pitfall 6: `notInArray(profiles.id, [])` Edge Case

**What goes wrong:** When `excludeIds = []` (a brand-new viewer with zero follows), `notInArray(profiles.id, [])` produces `WHERE NOT (FALSE)` in some Drizzle versions, accidentally excluding ALL rows OR including ALL rows depending on driver.

**Why it happens:** SQL `NOT IN ()` with empty list is a runtime error in raw SQL; Drizzle wraps it but the wrapping behavior has historically varied across versions.

**How to avoid:** Conditional in DAL: `excludeIds.length > 0 ? notInArray(profiles.id, excludeIds) : undefined` — passes `undefined` to `and(...)` which Drizzle ignores. The Pattern 4 example already shows this guard.

**Warning signs:** Brand-new user (zero follows, zero wears) sees an empty Popular Collectors rail when the catalog clearly has public profiles.

### Pitfall 7: PUBLIC_PATHS Drift on New Routes

**What goes wrong:** Future maintainer reads `isPublicPath('/explore/collectors')` returning `false` (correct — auth-gated) but a sibling adds `/explore` to PUBLIC_PATHS by mistake, leaking the auth-gated rails to anonymous viewers.

**Why it happens:** `PUBLIC_PATHS` (`src/lib/constants/public-paths.ts:1-7`) is a tiny array; adding `/explore` would silently flip the gate.

**How to avoid:** Phase 18 plan task verifies `'/explore' NOT in PUBLIC_PATHS` (zero changes; existing list = `['/login', '/signup', '/forgot-password', '/reset-password', '/auth']`). The new `/explore/collectors` and `/explore/watches` inherit the same gate via `proxy.ts:11-15` — no additional config.

**Warning signs:** `curl -s -I http://localhost:3000/explore/collectors -H 'cookie: ' | grep Location` should show a `/login` redirect.

### Pitfall 8: Watch-Card Click Target 404 Today

**What goes wrong:** Phase 18 ships watch cards with `<Link href="/evaluate?catalogId={id}">` per the acceptable alternative in Claude's Discretion. Phase 20 hasn't shipped `/evaluate` yet — the click target is a 404.

**Why it happens:** Phase ordering. /evaluate is Phase 20.

**How to avoid:** **Default = non-clickable in Phase 18** (the locked-default per Discretion). If the planner picks the link-anyway alternative, document explicitly in PLAN.md and accept that QA UAT will see the 404 until Phase 20 ships. Verified via `ls /Users/tylerwaneka/Documents/horlo/src/app/evaluate/` — directory does not exist (returns exit 1). No `/evaluate` route stub today.

**Warning signs:** Cards that look interactive but produce 404 → poor UX. Choose non-clickable + revisit in Phase 20.

## Code Examples

Verified patterns from the existing repo:

### `'use cache'` + `cacheTag` + `cacheLife` per-viewer

```tsx
// Source: src/components/notifications/NotificationBell.tsx:19-23
export async function NotificationBell({ viewerId }: { viewerId: string }) {
  'use cache'
  cacheTag('notifications', `viewer:${viewerId}`)
  cacheLife({ revalidate: 30 })
  // ...
}
```

### `'use cache'` + named profile (for global cache)

```tsx
// Source: src/components/home/CollectorsLikeYou.tsx:23-26
export async function CollectorsLikeYou({ viewerId }: { viewerId: string }) {
  'use cache'
  cacheLife('minutes')  // 5min stale / 1min revalidate / 1hr expire
  // ...
}
```

### Two-layer-privacy candidate query (mirror for Popular Collectors)

```typescript
// Source: src/data/search.ts:74-91
const candidates = await db
  .select({ /* ... */ })
  .from(profiles)
  .innerJoin(profileSettings, eq(profileSettings.userId, profiles.id))
  .where(
    and(
      eq(profileSettings.profilePublic, true), // D-18 / Pitfall C-3
      sql`${profiles.id} != ${viewerId}`,      // viewer self-exclusion
      matchExpr,
    ),
  )
  .limit(CANDIDATE_CAP) // Pre-LIMIT cap
```

### Anti-N+1 batched isFollowing hydration

```typescript
// Source: src/data/search.ts:159-173
const topIds = top.map((r) => r.userId)
const followingRows = topIds.length
  ? await db
      .select({ id: follows.followingId })
      .from(follows)
      .where(
        and(
          eq(follows.followerId, viewerId),
          inArray(follows.followingId, topIds),
        ),
      )
  : []
const followingSet = new Set(followingRows.map((r) => r.id))
return top.map((r) => ({ ...r, isFollowing: followingSet.has(r.userId) }))
```

### Horizontal scroll-snap rail (mirror for Trending + Gaining Traction)

```tsx
// Source: src/components/home/WywtRail.tsx:97-114
<div className="flex gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2">
  {entries.map((entry, i) => (
    <div key={entry.tile?.wearEventId ?? `self-${i}`} className="snap-start">
      <WywtTile /* ... */ />
    </div>
  ))}
</div>
```

### Server Action invalidation matrix (read-your-own-writes vs cross-user)

```typescript
// Source: src/app/actions/notifications.ts:74-78 (RYO via updateTag)
await markAllReadForUser(user.id)
updateTag(`viewer:${user.id}`)

// Source: src/app/actions/follows.ts:77 (cross-user via revalidateTag)
revalidateTag(`viewer:${parsed.data.userId}`, 'max')

// Source: src/app/actions/watches.ts:158 (cross-user via revalidateTag)
revalidateTag(`viewer:${recipient.userId}`, 'max')
```

### `count()` aggregate cast (used in DAL)

```typescript
// Source: src/data/profiles.ts:88-95
const [fr, fg] = await Promise.all([
  db.select({ count: sql<number>`count(*)::int` }).from(follows).where(eq(follows.followingId, userId)),
  db.select({ count: sql<number>`count(*)::int` }).from(follows).where(eq(follows.followerId, userId)),
])
return { followers: fr[0]?.count ?? 0, following: fg[0]?.count ?? 0 }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `revalidateTag(tag)` (1-arg legacy) | `revalidateTag(tag, 'max')` for SWR; `updateTag(tag)` for RYO | Next 16 | Documented in `src/app/actions/notifications.ts:14-55`; both forms still work but two-arg is canonical. |
| `pages/` router | App Router exclusively | Project locked since v1.0 | Phase 18 follows. |
| Client-side filter via Zustand | Server-side via Drizzle WHERE | v1.0 → v3.0 ripple | All /explore data is server-fetched. |
| `worn_public` boolean tab gate | Three-tier `wear_events.visibility` enum | v3.0 Phase 11/12 | Phase 18 `getWearEventsCountByUser` should NOT filter on visibility — the hero gate cares "did the viewer ever post a wear?" regardless of visibility. |

**Deprecated/outdated:**

- The original DISC-08 wording ("Notifications as 5th slot") is superseded by Phase 18 D-01..D-04 (Profile rightmost, Notifications stays in TopNav). NAV-14 ("BottomNav Profile out") is also superseded. Both need amendment when Phase 25 plans (per Deferred Ideas).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | At Horlo's v4.0 scale (<1000 catalog rows, <500 watches per user, <100 public profiles), the `Trending Watches` SQL Seq Scan + sort completes in <50ms without a specialized score-index. | Pattern 5 | If wrong (catalog grows to 10K+ rows), add `CREATE INDEX ... ON watches_catalog ((owners_count + 0.5 * wishlist_count) DESC)` — but this is a v5+ optimization, not Phase 18 scope. |
| A2 | Drizzle 0.45.2 emits the `notInArray(col, [])` empty-array case as a no-op (`WHERE TRUE`) — verified empirically by Phase 10 `getSuggestedCollectors:91-106` which guards via spread-into-array (`[viewerId, ...alreadyFollowing]` is always non-empty). | Pitfall 6 | Use the conditional guard `excludeIds.length > 0 ? notInArray(...) : undefined` per Pattern 4 — even if Drizzle handles the edge case, the guard is defense-in-depth. |
| A3 | Postgres `DISTINCT ON (catalog_id) ORDER BY catalog_id, snapshot_date ASC` consistently picks the OLDEST snapshot per catalog row (not the newest) when paired with `ORDER BY ... ASC`. This is canonical PG idiom but worth stating. | Pattern 5 | Verified by reading Postgres docs; no risk. The query is structurally correct. |
| A4 | The 5min `cacheLife({revalidate: 300})` for Trending is short enough that "newly-imported watch surfaces in Trending" feels live to the user, while long enough to absorb the hot-path traffic. The 24h `cacheLife({revalidate: 86400})` for Gaining Traction aligns with the daily snapshot cadence and is therefore not stale. | Pattern 2 | If the user perceives Trending as too stale, drop to 60s. If Gaining Traction recomputes within the 24h window seem necessary (e.g., manual `npm run db:refresh-counts` should reflect immediately), wire a `revalidateTag('explore', 'max')` into the refresh script. Both are tunable post-ship. |
| A5 | Fan-out invalidation on `addWatch` writes to BOTH `'explore:trending-watches'` and `'explore:gaining-traction'` is the correct shape — but Pattern 6 recommends just `'explore'` for simplicity. Either works under D-13. | Pattern 6 | If a future requirement needs surgical per-rail invalidation (e.g., admin tooling that surfaces a watch in Trending but not Gaining Traction), the broad-tag-on-write strategy may need refinement. v4.0 scope: not a concern. |
| A6 | The hero CTA `<Link href="/explore/collectors">` (D-08) ships in Phase 18 — i.e., `/explore/collectors` is a real route by ship time, not deferred to a follow-up. Per CONTEXT.md scope and DISC-07. | User Constraints | None — confirmed in CONTEXT.md `<domain>` section line 9. |

## Open Questions

1. **Should `/explore/watches` See-all internal layout be tab-toggle, sort-by-select, or two stacked sections?**
   - What we know: Both Trending and Gaining Traction share this destination per D-10; UI-SPEC owns the choice.
   - What's unclear: The planner cannot ship layout without a decision.
   - Recommendation: Plan defers to UI-SPEC. Plan ships a placeholder route (`<TrendingWatches /> + <GainingTractionWatches />` stacked, both with `limit=50`) and surfaces the layout choice for `/gsd-ui-phase 18`. UI-SPEC overrides if needed.

2. **Should the planner create `src/data/discovery.ts` as a new file, or fold the three new readers into `src/data/follows.ts` (collectors) and `src/data/catalog.ts` (watches)?**
   - What we know: Claude's Discretion item.
   - What's unclear: Stylistic; both work.
   - Recommendation: **Create `src/data/discovery.ts`** — keeps Phase 18-specific readers grouped, mirrors `src/data/suggestions.ts` precedent (Phase 10's home-page-discovery DAL is its own file). Three new functions (`getMostFollowedCollectors`, `getTrendingCatalogWatches`, `getGainingTractionCatalogWatches`) are enough to justify a file. Add `getWearEventsCountByUser` to `src/data/wearEvents.ts` (it's a wear-events helper, not a discovery helper).

3. **Should the watch card on Trending + Gaining Traction be clickable now or wait for Phase 20?**
   - What we know: Discretion item; default = non-clickable; alternative = link to `/evaluate?catalogId={id}` accepting brief 404.
   - What's unclear: Product call.
   - Recommendation: **Default — non-clickable in Phase 18.** No /evaluate route exists today (verified). 404-into-stub UX is worse than display-only. Phase 20 lights it up.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js + npm | dev / build | ✓ (project standard) | as-pinned by Vercel | — |
| Next.js 16 dev server | `npm run dev` | ✓ | 16.2.3 | — |
| PostgreSQL via Supabase Docker | DAL development + integration tests | ✓ (per existing tests gated on `DATABASE_URL`) | Supabase Docker | If unavailable, integration tests skip via `const maybe = process.env.DATABASE_URL ? describe : describe.skip` (Phase 17 pattern) |
| Drizzle migrations | local schema sync | ✓ (`drizzle-kit push` for local; `supabase db push --linked` for prod per MEMORY) | drizzle-kit 0.31.10 | — |
| pg_cron extension | Phase 18 reads snapshots written by Phase 17 cron | Conditional — installed in prod via `CREATE EXTENSION IF NOT EXISTS pg_cron` per Phase 17 Mig 2; local Docker may lack it | n/a | Local: run `npm run db:refresh-counts` to write a snapshot row manually (Phase 17 D-16). Phase 18 reads work either way. |
| Vitest | unit tests | ✓ (project test runner) | 2.1.9 | — |
| MSW | route handler mocking | ✓ (project) | 2.13.2 | — |
| jsdom | component tests | ✓ (project) | 25.0.1 | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** pg_cron locally — fallback documented above; manual snapshot write via existing script.

## Validation Architecture

> Phase 18 is a UI/read-side phase with three new DAL readers, three new Server Components, two new See-all routes, one new hero component, and one BottomNav slot rewrite. Nyquist sampling target: every requirement has at least one observable test surface.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 + React Testing Library 16.3.2 + MSW 2.13.2 + jsdom 25.0.1 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/unit tests/components/explore` (target subset) |
| Full suite command | `npm test` (alias for `vitest run`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DISC-03 | Hero renders when `followingCount < 3 && wearEventsCount < 1` | unit (component) | `npx vitest run tests/components/explore/ExplorePage.test.tsx` | ❌ Wave 0 |
| DISC-03 | Hero hides when threshold crosses (followingCount >= 3 OR wearEventsCount >= 1) | unit (component) | same file | ❌ Wave 0 |
| DISC-03 | `getWearEventsCountByUser` returns correct count and 0 for new user | integration | `npx vitest run tests/data/getWearEventsCountByUser.test.ts` | ❌ Wave 0 |
| DISC-04 | `getMostFollowedCollectors` excludes self | integration | `npx vitest run tests/data/getMostFollowedCollectors.test.ts` | ❌ Wave 0 |
| DISC-04 | `getMostFollowedCollectors` excludes already-followed | integration | same file | ❌ Wave 0 |
| DISC-04 | `getMostFollowedCollectors` filters `profile_public=true` (two-layer privacy) | integration | same file | ❌ Wave 0 |
| DISC-04 | Popular Collectors rail renders 5 rows, links to /explore/collectors | unit (component) | `npx vitest run tests/components/explore/PopularCollectors.test.tsx` | ❌ Wave 0 |
| DISC-05 | `getTrendingCatalogWatches` orders by `owners_count + 0.5 * wishlist_count DESC` | integration | `npx vitest run tests/data/getTrendingCatalogWatches.test.ts` | ❌ Wave 0 |
| DISC-05 | Tie-break is `(brand_normalized ASC, model_normalized ASC)` | integration | same file | ❌ Wave 0 |
| DISC-05 | Trending rail renders Flame icon + "{N} collectors" sublabel | unit (component) | `npx vitest run tests/components/explore/TrendingWatches.test.tsx` | ❌ Wave 0 |
| DISC-06 | `getGainingTractionCatalogWatches` returns `{window: 0, watches: []}` when no snapshots | integration | `npx vitest run tests/data/getGainingTractionCatalogWatches.test.ts` | ❌ Wave 0 |
| DISC-06 | Returns `{window: N}` for 1-6 day partial window with delta vs. oldest | integration | same file | ❌ Wave 0 |
| DISC-06 | Returns `{window: 7}` for 7+ day window with delta vs. exactly-7-days-ago | integration | same file | ❌ Wave 0 |
| DISC-06 | Excludes catalog rows with delta <= 0 (no change or decrease) | integration | same file | ❌ Wave 0 |
| DISC-06 | Gaining Traction rail renders TrendingUp icon + "↑ +N this week" sublabel | unit (component) | `npx vitest run tests/components/explore/GainingTractionWatches.test.tsx` | ❌ Wave 0 |
| DISC-06 | Gaining Traction rail renders "Not enough data yet" body when window=0 | unit (component) | same file | ❌ Wave 0 |
| DISC-07 | `/explore/collectors` Server Component renders 50 rows | unit (page) | `npx vitest run tests/components/explore/CollectorsSeeAll.test.tsx` | ❌ Wave 0 |
| DISC-07 | `/explore/watches` Server Component renders both rails with limit=50 | unit (page) | `npx vitest run tests/components/explore/WatchesSeeAll.test.tsx` | ❌ Wave 0 |
| DISC-07 | Both See-all routes are auth-gated (return null/redirect if no viewer) | integration | `npx vitest run tests/proxy.test.ts` (existing) extend | ✅ exists; needs new cases |
| DISC-08 | BottomNav renders Home, Search, Wear, Explore, Profile (in this order) | unit (component) | `npx vitest run tests/components/layout/BottomNav.test.tsx` | ❌ Wave 0 (existing tests need rewrite) |
| DISC-08 | BottomNav `isSearch` predicate matches `/search` and `/search/...` paths | unit (component) | same file | ❌ Wave 0 |
| DISC-08 | BottomNav has no `Add` slot, no `isAdd` predicate | unit (component) | same file | ❌ Wave 0 |
| Cross-cutting | `revalidateTag('explore', 'max')` fires on `addWatch` | integration | extend `tests/actions/watches.test.ts` | ✅ exists; needs new case |
| Cross-cutting | `updateTag('explore:popular-collectors:viewer:${id}')` fires on `followUser` | integration | extend `tests/actions/follows.test.ts` | ✅ exists; needs new case |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/unit tests/components/explore tests/data/getMostFollowedCollectors.test.ts tests/data/getTrendingCatalogWatches.test.ts tests/data/getGainingTractionCatalogWatches.test.ts tests/data/getWearEventsCountByUser.test.ts` — fast subset, runs in <15s.
- **Per wave merge:** `npm test` — full suite green.
- **Phase gate:** Full suite green + `npm run lint` clean before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `tests/components/explore/ExplorePage.test.tsx` — hero gate render predicate (DISC-03)
- [ ] `tests/components/explore/PopularCollectors.test.tsx` — rail render + see-all link (DISC-04)
- [ ] `tests/components/explore/TrendingWatches.test.tsx` — rail render + Flame + sublabel (DISC-05)
- [ ] `tests/components/explore/GainingTractionWatches.test.tsx` — rail render + TrendingUp + window cases (DISC-06)
- [ ] `tests/components/explore/CollectorsSeeAll.test.tsx` — see-all route render
- [ ] `tests/components/explore/WatchesSeeAll.test.tsx` — see-all route render
- [ ] `tests/data/getMostFollowedCollectors.test.ts` — exclude-self, exclude-followed, two-layer privacy
- [ ] `tests/data/getTrendingCatalogWatches.test.ts` — sort order, tie-break, weighted score
- [ ] `tests/data/getGainingTractionCatalogWatches.test.ts` — three windows, delta math, exclude-non-positive-delta
- [ ] `tests/data/getWearEventsCountByUser.test.ts` — count correctness, 0 for new user
- [ ] Rewrite of `tests/components/layout/BottomNav.test.tsx` for new 5-slot layout (existing test asserts old slots; needs full rewrite per D-01)
- [ ] Extend `tests/actions/follows.test.ts` to assert `updateTag` fires for new explore-collectors-viewer tag
- [ ] Extend `tests/actions/watches.test.ts` to assert `revalidateTag('explore', 'max')` fires on add/remove

*Wave 0 estimate: 11 new test files + 2 extensions. All run under existing Vitest infrastructure — no new framework install.*

## Security Domain

> Required by project default (security_enforcement enabled per CLAUDE.md and Phase 17 precedent).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing — `proxy.ts` redirects unauth to /login; `getCurrentUser()` in DAL throws `UnauthorizedError`; Phase 18 inherits both, no changes. |
| V3 Session Management | yes | Existing — Supabase SSR cookie flow; Phase 18 reads `getCurrentUser()` once at /explore root and passes id down. |
| V4 Access Control | yes | Two-layer privacy on Popular Collectors: `profileSettings.profilePublic = true` in DAL `WHERE` (mirrors `searchProfiles`) + RLS on `profiles` table. Catalog reads are public-read RLS by Phase 17 D-asymmetry; /explore is auth-only by `proxy.ts`, so RLS is belt-and-suspenders. |
| V5 Input Validation | partial | Phase 18 has minimal user input (none on /explore root; query params on See-all routes are URL-driven not user-typed). No Zod schemas needed unless See-all adds query params (deferred per Discretion). The `viewerId` flowing into cached scopes is server-resolved, never client-supplied. |
| V6 Cryptography | no | No new crypto. Existing Supabase Auth handles session crypto. |
| V7 Error Handling & Logging | yes | Mirror existing patterns: rail Server Components return `null` on 0 rows (no 500); DAL functions throw on DB error; Server Component wrapping `<Suspense>` already in place. |
| V8 Data Protection | yes | No PII change. Catalog is public-readable; profile fields filtered by `profile_public` gate. No new sensitive fields surfaced. |
| V11 Business Logic | yes | Hero gate is server-computed (D-06) — no client-side bypass possible. The `followingCount < 3 && wearEventsCount < 1` predicate runs in the page Server Component scope. |
| V13 API & Web Service | n/a | Phase 18 adds no API routes. All flows go through Server Components + existing Server Actions. |

### Known Threat Patterns for Next.js + Supabase + Drizzle Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-user cache leak via viewerId-in-cached-scope | Information Disclosure | Pass `viewerId` as prop to `'use cache'` components; documented in `NotificationBell.tsx:11-18` and Pitfall 1. |
| SQL injection via drizzle `sql` template | Tampering | Use parameterized `sql\`...${var}...\`` (Drizzle interpolates via prepared statements). Never concatenate user input. Mirror `src/data/catalog.ts:127-146` (existing safe pattern). |
| Privacy gate bypass on Popular Collectors | Information Disclosure | Two-layer (RLS + DAL `WHERE profileSettings.profilePublic = true`) — mirror `searchProfiles`. |
| IDOR — viewer querying another viewer's exclude list | Tampering | `viewerId` is server-resolved from `getCurrentUser()`, never from client input. Already enforced. |
| Open redirect via See-all path | Tampering | Both See-all routes use static paths; no user-supplied redirect targets. |
| Stored XSS via catalog data (LLM-extracted brand/model strings) | XSS | React JSX escapes by default; catalog images already protocol-validated by `sanitizeHttpUrl` (Phase 17 `src/data/catalog.ts:19-28`). No `dangerouslySetInnerHTML` in Phase 18 surfaces. |
| Cache key collision across users | Information Disclosure | Per-viewer tags include explicit `viewer:${id}` suffix; documented Phase 13 Pitfall 5. |

**Phase-specific security verification steps:**

1. Verify `/explore`, `/explore/collectors`, `/explore/watches` are NOT in `PUBLIC_PATHS` (Pitfall 7).
2. Verify Popular Collectors DAL filters `profile_public = true` (test exists in spec).
3. Verify hero gate runs server-side only — no client-readable count props on the hero component.
4. Verify cache tag scope isolation — per-viewer tag includes `viewer:${id}`.

## Sources

### Primary (HIGH confidence)

- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cacheLife.md` — preset profiles + inline `{revalidate, stale, expire}` shape; client-cache 30s minimum; nested-cache behavior. [READ]
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cacheTag.md` — multi-tag idempotent + 256-char/128-item limits + invalidation via `revalidateTag`. [READ]
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/updateTag.md` — Server-Action-only + read-your-own-writes vs `revalidateTag('max')` SWR distinction. [READ]
- `src/components/notifications/NotificationBell.tsx:1-40` — canonical `'use cache'` + `cacheTag('notifications', viewer:${id})` + `cacheLife({revalidate:30})` pattern.
- `src/components/home/CollectorsLikeYou.tsx:1-42` — canonical `'use cache'` + `cacheLife('minutes')` named-profile pattern.
- `src/app/actions/notifications.ts:14-55` — canonical `updateTag` vs `revalidateTag(tag, 'max')` lecture comment with Next 16 source-level reasoning.
- `src/data/search.ts:1-175` — canonical anti-N+1 + two-layer-privacy + pre-LIMIT-then-JS-sort pattern.
- `src/data/suggestions.ts:1-178` — canonical viewer-aware exclusion + already-followed exclusion shape.
- `src/data/follows.ts:135-180` — canonical `inArray` batched profile + watch aggregate hydration.
- `src/components/home/WywtRail.tsx:97-114` — canonical native scroll-snap rail markup.
- `src/components/home/SuggestedCollectors.tsx:25-70` — canonical rail Server Component (header + list + load-more).
- `src/components/home/SuggestedCollectorRow.tsx:24-97` — canonical row layout (avatar + meta + thumbs + inline FollowButton with z-10 raise).
- `src/components/layout/BottomNav.tsx:99-148` — current 5-slot impl (the surgical-diff target).
- `src/components/layout/BottomNavServer.tsx:25-54` — props/data-flow contract (no change needed).
- `src/db/schema.ts:267-345` — Phase 17 catalog + snapshots schema.
- `supabase/migrations/20260427000000_phase17_catalog_schema.sql` — RLS policies + indexes available to Phase 18 (especially `watches_catalog_owners_count_desc_idx` line 148-149 and `watches_catalog_snapshots_date_idx` from schema).
- `supabase/migrations/20260427000001_phase17_pg_cron.sql` — daily snapshot writer that Phase 18 reads from (cadence + idempotency contract).
- `package.json` — locks `next@16.2.3`, `drizzle-orm@0.45.2`, `lucide-react@1.8.0`, `vitest@2.1.9`.
- `vitest.config.ts` — test infrastructure config.

### Secondary (MEDIUM confidence)

- npm registry: `npm view next version` → `16.2.4`; `npm view drizzle-orm version` → `0.45.2`; `npm view lucide-react version` → `1.11.0`. Project versions are at-or-near-latest. [VERIFIED via Bash]

### Tertiary (LOW confidence)

- None — every Phase 18 claim is grounded in either explicit Next 16 docs (read directly from `node_modules/`) or existing Horlo source files. No WebSearch-only assertions.

## Metadata

**Confidence breakdown:**

- **Standard stack:** HIGH — every dependency is already in `package.json`; versions verified against npm registry; documentation for `'use cache'` / `cacheTag` / `cacheLife` / `updateTag` read directly from `node_modules/next/dist/docs/`.
- **Architecture (page composition + cache strategy):** HIGH — direct mirror of Phase 10 `src/app/page.tsx` + Phase 13 `NotificationBell` + Phase 14 `BottomNavServer`; all patterns ship and pass tests in current main.
- **DAL SQL shapes (Trending, Gaining Traction, Popular Collectors, getWearEventsCountByUser):** HIGH for Trending + counts (trivial Drizzle); HIGH for Popular Collectors (mirrors `searchProfiles` exactly); MEDIUM-HIGH for Gaining Traction (the `DISTINCT ON ... ORDER BY catalog_id, snapshot_date ASC` idiom is canonical Postgres but worth integration-testing against real snapshot data on day 1, day 6, day 7+ to confirm window behavior).
- **BottomNav slot rewrite:** HIGH — surgical diff against existing file, no new patterns needed.
- **Pitfalls:** HIGH — every pitfall is grounded in either an existing source-comment lecture (Phase 13 Pitfall 5 in NotificationBell, Phase 16 Pitfall C-4 in searchProfiles, Phase 13 SWR-vs-RYO in notifications.ts) or a project-standard discipline (PUBLIC_PATHS, two-layer privacy).
- **Validation architecture:** HIGH — Vitest + RTL + jsdom infrastructure already in repo; Phase 17 integration test pattern (gated on `DATABASE_URL`) directly applicable.
- **Security domain:** HIGH — applicable ASVS categories all map to existing project controls; no new attack surface in Phase 18.

**Research date:** 2026-04-27
**Valid until:** 2026-05-27 (30 days — stable stack; Cache Components stable since Phase 10; catalog substrate stable since Phase 17 ship 2026-04-27).

---

*Phase 18 research complete. Phase is composition-heavy with one non-trivial SQL shape (Gaining Traction delta). Plan should aim for 4-6 wiring tasks: (1) new DAL readers + helper, (2) hero + 3 rail components + shared watch card, (3) /explore page rewrite + 2 See-all pages, (4) BottomNav 5-slot rewrite, (5) Server Action invalidation hooks (`updateTag` on follow / unfollow; `revalidateTag('explore', 'max')` on `addWatch`/`removeWatch`), (6) test coverage per Validation Architecture.*
