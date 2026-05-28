# Phase 65: Follow-Scoped Owners Module — Research

**Researched:** 2026-05-28
**Domain:** Server Component data-loader + presentational chip module on a PPR-opt-out RSC route
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Branch visibility & viewer context (FOLL-01)**
- **D-01:** Renders on all 3 render branches in `src/app/w/[ref]/page.tsx`, for every viewer. Branch 1 (per-user watch detail — your own watch + cross-user), Branch 2 (owner-via-catalog), Branch 3 (pure catalog). The chip-set is always derived from `catalogId` (Branch 1 resolves `catalogId` from the loaded `Watch`; Branches 2/3 already have `catalogId` as `ref`). **Self-excludes the viewer** in the DAL WHERE clause (matches `getCollectorsForCatalog` T-39b-04). When you view YOUR OWN watch, you still see followed collectors who ALSO own this catalog ref — social-proof framing is intentional. Hide-if-empty is intrinsic: empty intersection → no DOM (FOLL-01).
- **D-01a (catalogId resolution on Branch 1):** Branch 1 today loads the watch via `getWatchByIdForViewer` — the row carries `catalogId` (nullable). When `watch.catalogId` is null the module **cannot** render (no key to intersect on); treat as empty → hide-if-empty (no DOM). Document this null-handling in the DAL call site, not the component.

**Chip click destination (FOLL-03)**
- **D-02:** Each chip is a single tap target linking to `/u/${username}/collection` — matches the existing `OtherOwnersRoster` pattern. DAL projection is `{ userId, username, displayName, avatarUrl }`, identical to `CatalogCollector`.
- **D-02a (accessible label):** Use the `OtherOwnersRoster` pattern — `aria-label="${displayName ?? '@'+username}'s collection"` on the absolute-inset `<Link>`. FOLL-03 satisfied.

**Coexistence with existing OtherOwnersRoster (Branch 3)**
- **D-03:** Both modules render on Branch 3. Follow-scoped module sits in the hero right column; existing broad `OtherOwnersRoster` stays where Phase 64 put it (untouched). "From your circle" (followed-only, tight) vs "X collectors own this" (broad, public-roster).
- **D-03a:** No layout regression on Branch 3 — do not relocate / suppress / reorder the existing `OtherOwnersRoster`.
- **D-03b (B1/B2 — no existing roster):** Branches 1/2 do NOT currently render `OtherOwnersRoster`. Phase 65 adds ONLY the new follow-scoped module on those branches — does not introduce the broad roster where it doesn't exist today.

**Visual shape, count, overflow (FOLL-03)**
- **D-04 (layout):** Compact vertical chips in the hero right column — one chip per row, `avatar (40px AvatarDisplay) + @username + optional displayName`. Vertical stack (NOT horizontal scroll). Single column on mobile carries naturally.
- **D-04a (header copy):** `"From your circle"` — warmer Rdio-inspired identity framing.
- **D-04b (count limit):** Top 5 by recency. Matches `getCollectorsForCatalog` default limit.
- **D-04c (overflow):** When >5 followed owners exist, render plain text caption `"and {N} more"` below the 5 chips. **No see-all route. No inline expand.**

**Privacy gates (FOLL-04)**
- **D-05:** Apply both privacy gates — `profileSettings.profilePublic = true` AND `profileSettings.collectionPublic = true`. Identical contract to broad `OtherOwnersRoster` two-layer privacy. **A follow does NOT override either flag.**
- **D-05a (self-exclusion):** `sql\`${profiles.id} != ${viewerId}\`` — viewer never appears in their own follow-scoped roster.
- **D-05b (status filter):** `inArray(watches.status, ['owned', 'wishlist', 'grail'])` — exclude `sold`.

### Claude's Discretion (planner / researcher to resolve)
- **D-06 (DAL strategy):** Extend `getCollectorsForCatalog` with a `viewerFollowingOnly: true` flag, OR create a new dedicated `getFollowedOwnersForCatalog(catalogId, viewerId, { limit })`. **Lean toward a dedicated new function** — regression-safe; tests own the follow-join concern.
- **D-07 (query shape):** Single SQL query joining `follows` ⋈ `watches` ⋈ `profiles` ⋈ `profileSettings`. Same Pitfall 3 dedup pattern. FOLL-04 single-query mandate satisfied. Separate `count(DISTINCT)` for totalCount mirrors Pitfall 4.
- **D-08 (ordering signal):** Order by `watches.createdAt DESC` (recency of THEIR ownership — "who in my circle just got one"). NOT `follows.createdAt`.
- **D-09 (Suspense vs pre-fetch):** Pre-fetch in the existing `Promise.all` block at the top of each branch (mirrors `getCollectorsForCatalog` on Branch 2/3). If profiling shows >100ms p95 impact, wrap in a sibling `<Suspense>` with 1-row skeleton, but DO NOT import the DAL into `WatchDetailHero` (preserve Phase 64 D-07 B1 sibling-composition discipline).
- **D-10 (component placement):** Renders as a child of `WatchDetailHero` inside the right column `<div className="space-y-6 min-w-0">` — after the LikeButton+jump row (line ~276), before the Last-Worn line (line ~300). Pure-presentation prop-driven RSC (NOT `'use client'`). New file `src/components/insights/FollowedOwnersModule.tsx`. Add `followedOwners` and `followedOwnersTotal` props to `WatchDetailHeroProps`.
- **D-11 (FollowedOwner row type):** `FollowedOwner = { userId, username, displayName, avatarUrl }`. Lives in `src/data/follows.ts` next to the new DAL function. NOT imported from `discovery.ts:CatalogCollector`.
- **D-12 (test coverage):** Mirror `tests/data/getCollectorsForCatalog.test.ts` — privacy edges (4 layers: profilePublic, collectionPublic, self-exclusion, follow-direction), Pitfall 3 dedup, Pitfall 4 totalCount. Component test for hide-if-empty + "+N more" caption.

### Deferred Ideas (OUT OF SCOPE)
- See-all page for followed owners (`/w/${ref}/followed-owners`)
- Mutual-follow variant
- "Your followers who own this" reverse direction
- Per-user-watch-detail click target (would require projecting per-owner `watches.id`)
- Inline expand on "+N more" client-side reveal
- Promoting `FollowedOwnersModule` to a shared component (e.g. profile-level "your circle's recent additions")
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOLL-01 | On `/w/[ref]`, when ≥1 user the viewer follows owns this watch (same `catalogId`), a compact module renders in the hero right column; entirely absent from DOM when zero matches | Hide-if-empty `if (owners.length === 0) return null` in the new RSC mirrors `OtherOwnersRoster.tsx:50`. DAL inner-joining `follows` guarantees the empty-intersection case returns `[]`. Branch 1 null-catalogId case → DAL returns empty (D-01a). |
| FOLL-02 | Follow direction is one-way `viewer → owner` (people the viewer follows) — NOT "people who follow the viewer" and NOT mutual-only | DAL clause: `INNER JOIN follows ON follows.followingId = profiles.id AND follows.followerId = ${viewerId}`. The `followerId = viewerId / followingId = owner` direction encodes "viewer follows owner". The opposite direction (`followerId = owner / followingId = viewer`) is what `isMutualFollow` checks in `follows.ts:77` — explicitly NOT used here. |
| FOLL-03 | Each owner row is a navigable link to that owner's profile, rendered as `avatar + @username` chip with accessible label | `OtherOwnersRoster.tsx:65-86` is the prior art — absolute-inset `<Link href={\`/u/${c.username}/collection\`}>` with `aria-label="${displayName ?? '@'+username}'s collection"`, `AvatarDisplay` size 40 (smallest legal per `AvatarDisplay.tsx:10`), `focus-visible:ring-2`. D-04 swaps horizontal-scroll for vertical-stack but reuses every other primitive. |
| FOLL-04 | Single efficient query (no N+1), respects existing profile-visibility / privacy rules, does not block hero render path (Suspense-wrap if cannot resolve synchronously) | One SQL query per page render (no per-chip follow-up) via inner-joins on `follows ⋈ watches ⋈ profiles ⋈ profileSettings`. Identical two-layer privacy as `discovery.ts:91-94` (`profilePublic` + `collectionPublic`). Pre-fetch alongside existing DAL calls in each branch's `Promise.all` (D-09); Suspense fallback unnecessary if the query stays under hero render budget. |
</phase_requirements>

## Summary

Phase 65 adds **one new DAL function** (`getFollowedOwnersForCatalog`) and **one new pure-presentation RSC** (`FollowedOwnersModule`) that composes into the existing `WatchDetailHero` right column as another prop-driven sibling. The DAL is a near-clone of `getCollectorsForCatalog` (`src/data/discovery.ts:72`) with one additional `INNER JOIN follows` clause on `(followerId = viewerId, followingId = profiles.id)`. No schema changes, no new routes, no new client islands, no new privacy primitives.

The work fits cleanly into three already-load-bearing patterns established by Phases 39b, 51/52/61, and 64:
1. **Two-layer privacy at the DAL WHERE** (Phase 39b — `discovery.ts`),
2. **PPR opt-out + outer-sync / inner-async / Suspense route shape** (Phase 51/52/61 — already in place on `/w/[ref]`, do NOT touch),
3. **B1 sibling-composition: pre-resolve in `page.tsx`, pass into `WatchDetailHero` as a prop** (Phase 64 — `signedPhotos`, `wearPics`, `verdict` already flow this way).

**Primary recommendation:** Use a dedicated `getFollowedOwnersForCatalog(catalogId, viewerId, { limit })` in `src/data/follows.ts` (per D-06); add three pre-fetch sites (one per branch) inside the existing `Promise.all` blocks in `src/app/w/[ref]/page.tsx`, skipping Branch 1 when `watch.catalogId` is null; render `<FollowedOwnersModule owners={...} totalCount={...} />` inside `WatchDetailHero` between the LikeButton+jump row (line 276) and the Last-Worn line (line 300). Mirror `tests/data/getCollectorsForCatalog.test.ts` for DAL test coverage (add a 7th privacy-edge: viewer-does-not-follow → excluded).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Resolve (viewer-follows ∩ catalog-owners) intersection | API / Backend (DAL) | Database (Postgres join) | Single SQL JOIN; service-role pooler bypasses RLS so the DAL WHERE clause IS the privacy gate (per `discovery.ts` "Threat surface" comment) |
| Apply two-layer privacy (profilePublic + collectionPublic) | API / Backend (DAL) | — | Identical contract to `getCollectorsForCatalog` — privacy must NOT be re-implemented at the component layer |
| Pre-fetch + thread data into hero | Frontend Server (RSC `page.tsx`) | — | B1 invariant per Phase 64 D-07: `WatchDetailHero` is `'use client'` and CANNOT import server-only DAL; pre-resolve in `page.tsx` and pass as prop |
| Render avatar+@username chip list | Frontend Server (RSC presentational component) | — | Pure presentation, no state, no client interactivity — chips are plain `<Link>` elements (no `'use client'`) |
| Hide-if-empty contract | Frontend Server (RSC `FollowedOwnersModule`) | — | `if (owners.length === 0) return null` at the top of the component; FOLL-01 |
| Navigate to owner collection | Browser / Client | — | Standard `<Link href="/u/${username}/collection">` SPA navigation |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.3 | App Router RSC + PPR | Already the framework; route is auth-gated server component [VERIFIED: package.json] |
| React | 19.2.4 | RSC + Suspense | Already the renderer [VERIFIED: package.json] |
| Drizzle ORM | (in tree) | DAL SQL builder | Every DAL in `src/data/*` uses Drizzle; new DAL must match style [VERIFIED: codebase grep] |
| Supabase Postgres | (in tree) | Data store | Tables `follows`, `watches`, `profiles`, `profile_settings` already participate in this exact join shape [VERIFIED: `src/db/schema.ts:238-276`] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@/components/profile/AvatarDisplay` | local | Avatar primitive | Use `size={40}` — the only legal size below 64; matches `OtherOwnersRoster` [VERIFIED: `AvatarDisplay.tsx:10`] |
| `next/link` | bundled with Next | Internal navigation | Standard `<Link>` for chip click-surface; absolute-inset pattern from `OtherOwnersRoster.tsx:69-73` |
| `lucide-react` | 1.8.0 | Optional icon (e.g. small users-icon next to "From your circle" header) | Defer to UI-SPEC; not strictly required [VERIFIED: package.json] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Dedicated `getFollowedOwnersForCatalog` (D-06 recommendation) | Extend `getCollectorsForCatalog` with `viewerFollowingOnly` flag | Extending mixes two contracts in one function and forces tests to cover both modes; dedicated DAL keeps the broad roster's call path untouched (regression-safe). |
| Single SQL JOIN | Compose `isFollowing()` × `getCollectorsForCatalog()` rows | Composed approach is N+1 (one `isFollowing` per collector) — violates FOLL-04. Single JOIN is the only correct shape. |
| Pre-fetch in `Promise.all` | Stream via `<Suspense>` sibling boundary | Pre-fetch matches the existing `getCollectorsForCatalog` call site on Branch 3 (line 431); JOIN cost is dominated by `follows_follower_idx` lookup (~ms). Use Suspense only if profiling shows >100ms p95 hero impact (D-09 fallback). |

**Installation:** None — all dependencies present.

**Version verification:** Not applicable — no new packages introduced.

## Architecture Patterns

### System Architecture Diagram

```
Request: GET /w/[ref] (authenticated user)
        │
        ▼
┌──────────────────────────────────────────────────────┐
│ middleware.ts (Supabase auth — redirects /login)    │
└──────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────┐
│ UnifiedWatchPage (sync default export)               │
│   await connection()  ← PPR opt-out (DO NOT MOVE)   │
│   return <Suspense fallback={<WatchPageSkeleton/>}> │
│            <UnifiedWatchContent params={…}/>         │
│          </Suspense>                                 │
└──────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────┐
│ UnifiedWatchContent (async)                          │
│   user = getCurrentUser()  ← throws → middleware    │
│   try per-user (Branch 1) → if hit, render          │
│   else try catalog (Branch 2: owner-via-catalog)    │
│   else Branch 3 (pure catalog)                       │
└──────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────┐
│ Per-branch Promise.all (NEW pre-fetch site)         │
│   getCollectorsForCatalog(ref, user.id)   (B2/B3)   │
│   getFollowedOwnersForCatalog(catalogId, user.id) ◄─┼── NEW DAL
│   …other parallel loads…                            │
└──────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────┐
│ DB: single SQL query (no N+1)                       │
│   SELECT profiles.{id,username,displayName,avatar} │
│   FROM watches                                       │
│   INNER JOIN profiles ON profiles.id = watches.userId │
│   INNER JOIN profile_settings ON …                  │
│   INNER JOIN follows ON                              │
│     follows.followerId = ${viewerId} AND             │
│     follows.followingId = profiles.id    ◄─── ONLY new clause vs getCollectorsForCatalog
│   WHERE watches.catalogId = ${catalogId}             │
│     AND profileSettings.profilePublic = true         │
│     AND profileSettings.collectionPublic = true      │
│     AND profiles.id != ${viewerId}                   │
│     AND watches.status IN ('owned','wishlist','grail') │
│   ORDER BY watches.createdAt DESC                    │
│   LIMIT 50  ← Pitfall 3 overfetch for JS dedup       │
└──────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────┐
│ JS dedup (Set on userId, keep first / most-recent)  │
│   slice to top 5                                     │
│   + separate count(DISTINCT) for totalCount          │
└──────────────────────────────────────────────────────┘
        │
        ▼ (resolved data flows as PROP, not import)
┌──────────────────────────────────────────────────────┐
│ <WatchDetailHero                                     │
│   …existing props…                                  │
│   followedOwners={…}                                 │
│   followedOwnersTotal={…}                            │
│ />                                                   │
└──────────────────────────────────────────────────────┘
        │
        ▼ (inside the right column, between Like row and Last-Worn line)
┌──────────────────────────────────────────────────────┐
│ <FollowedOwnersModule                                │
│   owners={followedOwners}                            │
│   totalCount={followedOwnersTotal}                   │
│ />                                                   │
│   if (owners.length === 0) return null  ← FOLL-01    │
│   else: <section>                                    │
│     <h3>From your circle</h3>                        │
│     {owners.map(o => <ChipRow>…)}                    │
│     {totalCount > 5 && "and {N} more"}               │
│   </section>                                         │
└──────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
src/
├── data/
│   └── follows.ts           # ADD: getFollowedOwnersForCatalog + FollowedOwner type
├── components/
│   └── insights/
│       └── FollowedOwnersModule.tsx   # NEW: pure-presentation RSC
├── components/watch/
│   └── WatchDetailHero.tsx  # MODIFY: extend props, render new module in right column
├── app/w/[ref]/
│   └── page.tsx             # MODIFY: 3 pre-fetch sites (1 per branch); thread props
└── tests/
    ├── data/
    │   └── getFollowedOwnersForCatalog.test.ts   # NEW: mirror of getCollectorsForCatalog test
    └── static/                                    # OPTIONAL: structural guard for hide-if-empty
```

### Pattern 1: DAL — follows-join over the catalog roster shape
**What:** Single SQL query that intersects (viewer-follows-X) ⋂ (X-owns-this-catalog) with both privacy layers and self-exclusion applied at the WHERE.
**When to use:** Every read of "X-the-viewer-follows-who-does-Y" on this codebase.
**Example:**
```typescript
// File: src/data/follows.ts (proposed new function)
// Mirrors src/data/discovery.ts:72 getCollectorsForCatalog with ONE added INNER JOIN.

export interface FollowedOwner {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
}

export async function getFollowedOwnersForCatalog(
  catalogId: string,
  viewerId: string,
  opts: { limit?: number } = {},
): Promise<{ owners: FollowedOwner[]; totalCount: number }> {
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
    // The ONE clause that distinguishes this from getCollectorsForCatalog:
    // viewer→owner direction (FOLL-02). NOT mutual; NOT reversed.
    .innerJoin(
      follows,
      and(
        eq(follows.followerId, viewerId),
        eq(follows.followingId, profiles.id),
      ),
    )
    .where(
      and(
        eq(watches.catalogId, catalogId),
        eq(profileSettings.profilePublic, true),    // D-05 layer 1 (T-39b-01)
        eq(profileSettings.collectionPublic, true), // D-05 layer 2 (D-39b-09 NEW in 39b)
        sql`${profiles.id} != ${viewerId}`,         // D-05a self-exclusion
        inArray(watches.status, ['owned', 'wishlist', 'grail']), // D-05b
      ),
    )
    .orderBy(desc(watches.createdAt), asc(profiles.username))
    .limit(50) // Pitfall 3 — overfetch for JS dedup

  // Pitfall 4 — separate count(DISTINCT) with IDENTICAL WHERE for "+N more"
  const totalRows = await db
    .select({ count: sql<number>`count(DISTINCT ${profiles.id})::int` })
    .from(watches)
    .innerJoin(profiles, eq(profiles.id, watches.userId))
    .innerJoin(profileSettings, eq(profileSettings.userId, profiles.id))
    .innerJoin(
      follows,
      and(
        eq(follows.followerId, viewerId),
        eq(follows.followingId, profiles.id),
      ),
    )
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

  // Pitfall 3 — JS dedup: keep first occurrence per userId (already DESC ordered)
  const seen = new Set<string>()
  const owners: FollowedOwner[] = []
  for (const r of rows) {
    if (seen.has(r.userId)) continue
    seen.add(r.userId)
    owners.push({
      userId: r.userId,
      username: r.username,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
    })
    if (owners.length >= limit) break
  }
  return { owners, totalCount }
}
```
[CITED: `src/data/discovery.ts:72-136` for the structural template]

### Pattern 2: B1 sibling composition — pre-fetch in page.tsx, prop into hero
**What:** Server-only DAL functions are called by `page.tsx` (RSC). The resolved primitives flow as props into `WatchDetailHero` (which is `'use client'`). The hero never imports anything from `src/data/*` or anything that reads `cookies()`.
**When to use:** Every data dependency on this route. The Phase 64 hero is `'use client'` and would corrupt the PPR boundary if it imported cookie-touching code.
**Example:**
```typescript
// File: src/app/w/[ref]/page.tsx — Branch 1 (per-user) Promise.all block
// (Around lines 171-174 today; ADD the new DAL call.)

const [collection, preferences, followedOwners] = await Promise.all([
  getWatchesByUser(user.id),
  getPreferencesByUser(user.id),
  // D-01a: catalogId is nullable on Branch 1; null → empty result, hide-if-empty
  watch.catalogId
    ? getFollowedOwnersForCatalog(watch.catalogId, user.id, { limit: 5 })
    : Promise.resolve({ owners: [], totalCount: 0 }),
])

// …later in the JSX:
<WatchDetailHero
  …existing props
  followedOwners={followedOwners.owners}
  followedOwnersTotal={followedOwners.totalCount}
/>
```
[CITED: pattern matches `signedPhotos`/`wearPics` threading in `page.tsx:331-355`]

### Pattern 3: Pure-presentation RSC chip module
**What:** A Server Component with no client directive, no hooks, no state, no cookie reads. Accepts pre-resolved data via props and returns either `null` (hide-if-empty) or static JSX.
**When to use:** Any "render this list" surface fed by a server-resolved DAL on this codebase. `OtherOwnersRoster` is the direct prior art.
**Example:**
```typescript
// File: src/components/insights/FollowedOwnersModule.tsx (NEW)
// NO 'use client' directive. Pure RSC. Mirrors OtherOwnersRoster.tsx shape.

import Link from 'next/link'
import { AvatarDisplay } from '@/components/profile/AvatarDisplay'
import type { FollowedOwner } from '@/data/follows'

interface FollowedOwnersModuleProps {
  owners: FollowedOwner[]
  totalCount: number
}

export function FollowedOwnersModule({ owners, totalCount }: FollowedOwnersModuleProps) {
  // FOLL-01: entirely absent from the DOM when zero — NOT an empty-state card.
  if (owners.length === 0) return null

  return (
    <section className="space-y-2" aria-label="People you follow who own this">
      <h3 className="text-sm font-medium text-foreground">From your circle</h3>
      <ul className="space-y-2">
        {owners.map((o) => {
          const name = o.displayName ?? `@${o.username}`
          return (
            <li
              key={o.userId}
              className="group relative flex items-center gap-3 min-h-[44px]"
            >
              <Link
                href={`/u/${o.username}/collection`}
                aria-label={`${name}'s collection`}
                className="absolute inset-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <AvatarDisplay
                avatarUrl={o.avatarUrl}
                displayName={o.displayName}
                username={o.username}
                size={40}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">@{o.username}</p>
                {o.displayName && (
                  <p className="text-xs text-muted-foreground truncate">{o.displayName}</p>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      {totalCount > owners.length && (
        <p className="text-xs text-muted-foreground">
          and {totalCount - owners.length} more
        </p>
      )}
    </section>
  )
}
```
[CITED: `src/components/insights/OtherOwnersRoster.tsx:46-90`]

### Anti-Patterns to Avoid
- **Importing the DAL into `WatchDetailHero`:** `WatchDetailHero.tsx:1` is `'use client'`. Importing server-only DAL or anything touching `cookies()` corrupts the PPR boundary and re-introduces the React #419 soft-nav class (MEMORY `project_ppr_dynamic_before_use_cache`). Data must arrive as a prop.
- **Per-chip follow-up queries:** A naive composition (`getCollectorsForCatalog` then per-result `isFollowing`) violates FOLL-04. The SQL must do the intersection in one join.
- **Splitting the privacy gate to "follows override":** Following a private-profile / private-collection user does NOT grant visibility. Both `profilePublic` and `collectionPublic` gates MUST stay. Follow is an additional FILTER, never an OVERRIDE.
- **Re-adding `OtherOwnersRoster` to Branches 1 or 2:** D-03b — out of scope. Branch 1/2 currently have no broad roster and Phase 65 does not add one.
- **Wrapping `FollowedOwnersModule` in its own `<Suspense>` inside `WatchDetailHero`:** That would re-introduce the cross-boundary problem D-09 explicitly avoids. The fallback path (D-09) wraps it as a *sibling* in `page.tsx`, not inside the client island.
- **Touching `unstable_instant = false` (page.tsx:50) or moving `await connection()` (page.tsx:96):** These are permanent fixes; the new DAL call goes INSIDE the Promise.all blocks ABOVE the JSX return, well after `await connection()` already ran.
- **Using `lg:hidden` / `hidden lg:block` JSX duplication for "From your circle":** Module belongs inside the existing right column container, which is already single-column on mobile and 2/5 of the grid on `lg+`. The natural collapse satisfies success criterion 5; no responsive variants needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Avatar with fallback initial | A new `<img>` wrapper with text fallback | `AvatarDisplay` (`size={40}`) | Already handles signed URL, missing-image fallback, accessible alt text, three sizes |
| Privacy filtering at the component | A `.filter(o => o.public)` in the component | DAL WHERE clause | Service-role pooler bypasses RLS; the DAL WHERE IS the gate (see `discovery.ts` "Threat surface" comment) |
| Follow-pair existence check per chip | Looping `isFollowing(viewerId, ownerId)` | `INNER JOIN follows` in the single query | N+1; violates FOLL-04 |
| Total-count derivation from `rows.length` | `totalCount = collectors.length` | Separate `count(DISTINCT profiles.id)` with identical WHERE | The main SELECT is dedup'd AND limited; cannot compute the real total from it (Pitfall 4 in `discovery.ts`) |
| Custom "+N more" link | A button to a new route | Plain text caption (D-04c) | Explicit user choice; see-all is a deferred phase |
| Click target inference | Computing the owner's `watches.id` to deep-link to `/w/${watchId}` | `<Link href={\`/u/${username}/collection\`}>` | D-02; matches `OtherOwnersRoster`; cheaper projection (no extra column) |
| Re-implementing username escaping | `dangerouslySetInnerHTML` or custom escape | React text-node auto-escape | Username is regex-validated at signup; React auto-escapes `{c.username}` text and template-literal aria-label (see `OtherOwnersRoster` XSS comment lines 36-39) |

**Key insight:** Every primitive Phase 65 needs already exists. The phase is **structurally a near-clone** of `getCollectorsForCatalog` + `OtherOwnersRoster`, differing only in (a) the additional `follows` INNER JOIN, (b) header copy "From your circle", and (c) vertical-stack instead of horizontal-scroll layout.

## Common Pitfalls

### Pitfall 1: Wrong follow-join direction
**What goes wrong:** Joining `follows` with `followerId = profile.id AND followingId = viewerId` would render "your followers who own this" — the explicitly rejected variant (FOLL-02 / UAT 2026-05-27).
**Why it happens:** The two columns are easy to swap; `followers` vs `following` mental model varies between engineers.
**How to avoid:** The join MUST be `eq(follows.followerId, viewerId) AND eq(follows.followingId, profiles.id)`. Mnemonic: **viewer-as-follower → owner-as-followee**. Lock it down with a DAL test that seeds (viewer→alice) WITHOUT (alice→viewer) and asserts alice appears (D-12 test 4).
**Warning signs:** Module renders "mutuals only" (both directions present in fixtures) or renders for users the viewer hasn't followed.

### Pitfall 2: N+1 via composed helpers
**What goes wrong:** Composing `getCollectorsForCatalog` (server-side) + per-result `isFollowing(viewerId, ownerId)` issues 1 + N queries. Violates FOLL-04 "single efficient query."
**Why it happens:** Reuse instinct — the two functions feel like building blocks.
**How to avoid:** One SQL JOIN. Period. Reviewer should grep the new DAL for `isFollowing` and `isMutualFollow` imports and reject the diff if found.
**Warning signs:** New DAL is >2× the LOC of `getCollectorsForCatalog`; new DAL imports anything from itself (recursive helper) or from another DAL file.

### Pitfall 3: Multi-row-per-user dedup
**What goes wrong:** A followed user with both an `owned` and a `wishlist` row for this catalog appears twice in the chip list, and the `totalCount` double-counts them.
**Why it happens:** SQL JOIN multiplies rows by every matching `watches` row; the user has 1+ matching rows.
**How to avoid:** Mirror `discovery.ts:120-134` exactly — overfetch to LIMIT 50, then a JS `Set<userId>` keeps the first (most-recent-by-createdAt) occurrence; slice to top-N. The `count(DISTINCT profiles.id)::int` query handles totalCount correctly.
**Warning signs:** Test 6 (D-12) failure with `aliceRows.length === 2`.

### Pitfall 4: totalCount from `rows.length`
**What goes wrong:** Using `rows.length` (post-dedup, post-limit) as the "+N more" denominator under-counts overflow.
**Why it happens:** Looks cheaper to skip the second query.
**How to avoid:** Always issue the separate `count(DISTINCT profiles.id)` query with IDENTICAL WHERE clause (privacy + status + follow-join). See `discovery.ts:104-118` for the template; replicate exactly.
**Warning signs:** "+N more" doesn't appear when prod has >5 followed owners; or shows wrong N.

### Pitfall 5: Touching the route's PPR opt-out scaffolding
**What goes wrong:** Moving `await connection()` below the Promise.all, deleting `export const unstable_instant = false`, or wrapping `UnifiedWatchContent` in any structural change re-introduces the React #419 + 404 soft-nav family (Phase 51/52/61).
**Why it happens:** A wave of "let me also clean up this route" energy.
**How to avoid:** This phase touches THREE things in `page.tsx`: (a) add 1 import (`getFollowedOwnersForCatalog`), (b) add 1 line inside each of 3 Promise.all blocks, (c) thread 2 props into 3 `<WatchDetailHero>` call sites. Nothing else. The existing `tests/static/ppr-dynamic-before-use-cache.test.ts` guard catches regressions.
**Warning signs:** Soft-nav from a grid to `/w/[ref]` returns 404 once cache fills on prod (MEMORY `project_ppr_dynamic_before_use_cache` — "Build can't confirm; verify on prod AFTER cache fills").

### Pitfall 6: Branch 1 null-catalogId crash
**What goes wrong:** A per-user watch with `watch.catalogId === null` (URL-extracted watches that never matched a catalog) calls `getFollowedOwnersForCatalog(null, …)` and the JOIN crashes or returns wrong data.
**Why it happens:** D-01a documents this null case; easy to forget at the call site.
**How to avoid:** Guard at the page-level call site with the same ternary pattern Branch 1 uses for `sameFamily` and `lineage`:
```typescript
watch.catalogId
  ? getFollowedOwnersForCatalog(watch.catalogId, user.id, { limit: 5 })
  : Promise.resolve({ owners: [], totalCount: 0 })
```
[CITED: `page.tsx:328-329` for the existing null-catalogId pattern]
**Warning signs:** TypeScript error at the DAL call site (catalogId is `string | null`), or a runtime error from Drizzle building a query with `eq(watches.catalogId, null)`.

### Pitfall 7: Static fs-scan test missing `// @vitest-environment node`
**What goes wrong:** If Phase 65 ships a static guard that walks `src/components/insights/` or `src/data/follows.ts`, omitting the `// @vitest-environment node` header will pass locally (jsdom polyfills `readFileSync`) but fail Vercel's prebuild (`node:fs` is externalized in jsdom → `readdirSync` undefined).
**Why it happens:** MEMORY `project_vitest_static_node_env` — cost a Phase 59 prod-deploy failure.
**How to avoid:** Every static test file MUST start with `// @vitest-environment node`. See `tests/static/comment-thread-no-client.test.ts` or `ppr-dynamic-before-use-cache.test.ts` for the template.
**Warning signs:** Static test passes locally but Vercel build fails with `TypeError: readdirSync is not a function`.

### Pitfall 8: Hydration / React #418 risk via date formatting
**What goes wrong:** Adding a "joined X ago" or "added this watch on …" affordance to the chip would re-introduce the React #418 hydration mismatch (MEMORY `project_react_418_date_tz_hydration`) — local-time vs UTC divergence between server and browser.
**Why it happens:** Visual polish instinct: "let me show when they added it."
**How to avoid:** D-04 explicitly excludes any date display. The chip is `avatar + @username + (optional displayName)` and nothing else. If a "recency" affordance is added later, use `WatchDetailHero.tsx:37-46`'s `formatDate(timeZone:'UTC', locale:'en-US')` pattern.
**Warning signs:** React #418 in prod console; UAT tester in a non-UTC timezone reports a date mismatch.

## Runtime State Inventory

> Phase 65 is greenfield code addition only — no rename, refactor, migration, or string replacement. **Skipped.**

## Code Examples

Verified patterns from official sources / the existing codebase:

### DAL call inside Branch 3's Promise.all
```typescript
// File: src/app/w/[ref]/page.tsx (Branch 3, line ~423-434 today)
// MODIFY: add followedOwners alongside roster (mirrors roster, with catalogId=ref)

const [catalogEntry, collection, preferences, viewerOwnedRow, viewerProfile, roster, followedOwners, sameFamily, lineage] = await Promise.all([
  getCatalogById(ref),
  getWatchesByUser(user.id),
  getPreferencesByUser(user.id),
  findViewerWatchByCatalogId(user.id, ref),
  getProfileById(user.id),
  getCollectorsForCatalog(ref, user.id, { limit: 5 }),
  getFollowedOwnersForCatalog(ref, user.id, { limit: 5 }),  // NEW
  getSameFamilyForCatalog(ref),
  getLineageForReference(ref),
])
```
[CITED: `src/app/w/[ref]/page.tsx:423-434` — current shape]

### `WatchDetailHero` integration site (between LikeButton and Last-Worn)
```typescript
// File: src/components/watch/WatchDetailHero.tsx — INSIDE the right column,
// after the LikeButton+jump-to-comments block (line ~298), BEFORE the
// Last-Worn block (line ~301).

// Phase 65 — Follow-scoped owners. Pure RSC sibling; receives pre-resolved
// data. Hide-if-empty contract lives inside the component itself (FOLL-01).
<FollowedOwnersModule
  owners={followedOwners ?? []}
  totalCount={followedOwnersTotal ?? 0}
/>
```
[CITED: anchor lines from `WatchDetailHero.tsx:276-300` for placement]

### Extended `WatchDetailHeroProps`
```typescript
// File: src/components/watch/WatchDetailHero.tsx (line ~48)
interface WatchDetailHeroProps {
  // …existing props…
  /**
   * Phase 65 FOLL-01..04. Pre-resolved by page.tsx via
   * getFollowedOwnersForCatalog (or [] when watch.catalogId is null on B1).
   * Hide-if-empty is enforced inside <FollowedOwnersModule/>.
   */
  followedOwners?: FollowedOwner[]
  followedOwnersTotal?: number
}
```
Note: `FollowedOwner` must be imported as a `type` to keep `WatchDetailHero`'s `'use client'` boundary free of server-only imports — only the bare type is needed.

### DAL test mirror (Wave 0)
```typescript
// File: tests/data/getFollowedOwnersForCatalog.test.ts (NEW)
// Mirror tests/data/getCollectorsForCatalog.test.ts exactly. Add ONE extra
// privacy edge (Test 7) for the new follow-direction gate.

it('Test 7: viewer does NOT follow → owner excluded (FOLL-02)', async () => {
  // bob owns this catalog but viewer does NOT follow bob.
  // Module must NOT include bob.
  const catalogId = await seedTestCatalogRow('t7')
  await seedWatchForCatalog(bob.id, catalogId, 'owned')
  // No follows row seeded for (viewer → bob).

  const { owners, totalCount } = await dal.getFollowedOwnersForCatalog(
    catalogId,
    viewer.id,
  )

  expect(owners.find((o) => o.userId === bob.id)).toBeUndefined()
  expect(totalCount).toBe(0)
})

it('Test 8: viewer follows alice (one-way) → alice INCLUDED (FOLL-02)', async () => {
  const catalogId = await seedTestCatalogRow('t8')
  await seedWatchForCatalog(alice.id, catalogId, 'owned')
  await dbModule.db.insert(schema.follows).values({
    followerId: viewer.id,
    followingId: alice.id,
  }).onConflictDoNothing()
  // Do NOT seed the reverse (alice → viewer); proves NOT mutual-only.

  const { owners, totalCount } = await dal.getFollowedOwnersForCatalog(
    catalogId,
    viewer.id,
  )

  expect(owners.find((o) => o.userId === alice.id)).toBeDefined()
  expect(totalCount).toBe(1)
})
```
[CITED: `tests/data/getCollectorsForCatalog.test.ts:1-312` for full template]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Mix server-only DAL into `'use client'` islands | RSC pre-fetch in `page.tsx`, props into client island (B1 invariant) | Phase 51/52 (Cache Components + PPR) | The ONLY way to avoid the React #419 soft-nav family on this route |
| `await connection()` BELOW page Suspense | `await connection()` ABOVE page Suspense (opts out of PPR static shell) | Phase 61 debug (resolved 2026-05-26) | Cannot be reverted; do not touch (MEMORY `project_ppr_dynamic_before_use_cache`) |
| Single-layer privacy (`profilePublic` only) for owner rosters | Two-layer privacy (`profilePublic` + `collectionPublic`) | Phase 39b D-39b-09 | Both gates apply; follows DO NOT override |
| Inline DAL calls inside JSX | All DAL inside per-branch `Promise.all` blocks, results flow as props | Phase 51/52 onward | Avoids waterfalls; matches existing `getCollectorsForCatalog`/`signedPhotos`/`wearPics` patterns |
| `toLocaleDateString()` bare | `toLocaleDateString('en-US', { timeZone: 'UTC' })` | Phase 61 debug (React #418 fix) | N/A for this phase (no date display) but the discipline applies if extended |

**Deprecated/outdated:**
- `/watch/[id]` and `/catalog/[catalogId]` routes — removed in Phase 59 (no redirect). All chip `<Link>`s MUST target `/u/${username}/collection` not anything under those legacy paths (CI guard `tests/static/legacy-watch-routes.test.ts` blocks any regression).

## Project Constraints (from CLAUDE.md)

| Constraint | How Phase 65 honors it |
|------------|------------------------|
| Tech stack: Next.js 16 App Router — no rewrites | New code is RSC + 1 DAL; no route changes, no `pages/` revival, no rewrites. |
| Data model: Watch + UserPreferences established | No new types on Watch/UserPreferences. New `FollowedOwner` type is a projection of `profiles` columns only. |
| Personal first / single-user correctness | Self-exclusion clause `profiles.id != viewerId` ensures the viewer never appears in their own follow-scoped roster (D-05a). |
| Performance: <500 watches per user | DAL has `LIMIT 50` overfetch + slice to 5; intersected with viewer's followed-set (typically tiny on a personal-collector app). Indexed via `follows_follower_idx` + watches' `catalog_id` index. |
| AGENTS.md: "This is NOT the Next.js you know" | Phase 65 uses NO Next.js APIs new to this phase — relies only on already-proven patterns (`<Suspense>`, server components, `<Link>`, `'use client'` boundaries). Any tempting `unstable_*` or new caching directive should be cross-checked against `node_modules/next/dist/docs/`. |
| GSD Workflow Enforcement | Edits gated through `/gsd-plan-phase` → `/gsd-execute-phase`. This research is part of that flow. |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/static/ tests/data/getFollowedOwnersForCatalog.test.ts --reporter=verbose` |
| Full suite command | `npm run test` |
| Build gate command | `npm run build` (exit 0 — MEMORY `project_baseline_not_green_build_is_gate`) |
| Estimated runtime | ~10s static; ~60s full; DAL integration ~5s per file when env present |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOLL-01 | Module returns `null` when `owners.length === 0` (hide-if-empty) | Unit (component) | `npx vitest run tests/components/FollowedOwnersModule.test.tsx` | ❌ Wave 0 |
| FOLL-01 | Branch 1 null-catalogId → DAL not called or returns empty (no DOM) | Static (fs-scan grep for guard) | `npx vitest run tests/static/followed-owners-null-catalog.test.ts` | ❌ Wave 0 (optional) |
| FOLL-02 | DAL excludes followed users you do NOT follow (Test 7) | Integration (DAL) | `npx vitest run tests/data/getFollowedOwnersForCatalog.test.ts -t "Test 7"` | ❌ Wave 0 |
| FOLL-02 | DAL includes one-way follows; NOT mutual-only (Test 8) | Integration (DAL) | `npx vitest run tests/data/getFollowedOwnersForCatalog.test.ts -t "Test 8"` | ❌ Wave 0 |
| FOLL-03 | Chip renders `<Link href="/u/${username}/collection">` with `aria-label` | Unit (component) | `npx vitest run tests/components/FollowedOwnersModule.test.tsx -t "chip link"` | ❌ Wave 0 |
| FOLL-04 | DAL excludes profilePublic=false (Test 1 mirror) | Integration (DAL) | Same DAL file | ❌ Wave 0 |
| FOLL-04 | DAL excludes collectionPublic=false (Test 2 mirror) | Integration (DAL) | Same | ❌ Wave 0 |
| FOLL-04 | DAL excludes viewer self (Test 3 mirror) | Integration (DAL) | Same | ❌ Wave 0 |
| FOLL-04 | DAL excludes sold-status rows (Test 4 mirror) | Integration (DAL) | Same | ❌ Wave 0 |
| FOLL-04 | DAL orders by `watches.created_at DESC` (Test 5 mirror) | Integration (DAL) | Same | ❌ Wave 0 |
| FOLL-04 | DAL dedups multi-row-per-user owned+wishlist (Test 6 mirror) | Integration (DAL) | Same | ❌ Wave 0 |
| FOLL-04 | "+N more" caption renders correctly when totalCount > owners.length | Unit (component) | `npx vitest run tests/components/FollowedOwnersModule.test.tsx -t "and N more"` | ❌ Wave 0 |
| FOLL-04 | Page.tsx adds new DAL inside Promise.all (not awaited serially) | Static (fs-scan source position) | `npx vitest run tests/static/watch-detail-ia-order.test.ts` (extend) | ⚠️ extend existing |
| PAGE-03 preserve | `unstable_instant = false` still set; `await connection()` still above Suspense | Static (existing guard) | `npx vitest run tests/static/ppr-dynamic-before-use-cache.test.ts` | ✅ existing |
| PAGE-03 preserve | `FollowedOwnersModule` has NO `'use client'` directive | Static (grep) | `npx vitest run tests/static/followed-owners-module-rsc.test.ts` | ❌ Wave 0 (optional) |
| PAGE-03 preserve | `WatchDetailHero` does NOT import from `@/data/*` | Static (grep) | Extend `watch-detail-ia-order.test.ts` | ⚠️ extend |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/static/ --reporter=verbose` (~10s)
- **Per wave merge:** `npm run test` (~60s full suite)
- **Phase gate:** `npm run build` exits 0 AND full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/data/getFollowedOwnersForCatalog.test.ts` — full mirror of `getCollectorsForCatalog.test.ts` (Tests 1-6) + new Tests 7, 8 for follow-direction gate. Reuse the `seedProfile` / `seedTestCatalogRow` / `seedWatchForCatalog` helpers from the existing file (copy-paste; OR extract to `tests/data/_collectorsFixtures.ts` if planner prefers DRY).
- [ ] `tests/components/FollowedOwnersModule.test.tsx` — unit tests for: (a) `null` return on empty owners, (b) chip link `href`/`aria-label` shape, (c) "+N more" caption renders/omitted correctly, (d) renders the literal "From your circle" header.
- [ ] (Optional, recommended) `tests/static/followed-owners-module-rsc.test.ts` — `// @vitest-environment node` + `readFileSync` `FollowedOwnersModule.tsx`, assert it does NOT contain `'use client'` or `'use cache'`. Cheap CI guard that catches an accidental client conversion. (Mirrors `tests/static/comment-thread-no-client.test.ts`.)
- [ ] (Optional) Extend `tests/static/watch-detail-ia-order.test.ts` to assert the new DAL call sits inside each branch's `Promise.all` (not awaited serially) and that `WatchDetailHero.tsx` does not import `getFollowedOwnersForCatalog`.

**Manual-only (`human_needed` on prod):**
- Responsive mobile single-column collapse (visual / viewport — MEMORY `feedback_mobile_ui_verify_on_prod`).
- Visual proportion of the vertical chip stack inside the narrow right column (subjective; D-04 layout call).
- Click target / 44px tap-target on mobile.
- Soft-nav from a grid card to `/w/[ref]` does NOT regress React #419 — verify AFTER cache fills on prod (MEMORY `project_ppr_dynamic_before_use_cache`).
- Visual confirmation that "From your circle" sits between LikeButton+jump-row and Last-Worn line on owner view, and between LikeButton+jump-row and (no Last-Worn) on cross-user view.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | RSC sibling composition + DAL privacy gates documented; reviewer asserts the contract |
| V2 Authentication | yes (inherited) | `getCurrentUser()` in `src/lib/auth.ts:25` enforces auth; route 401s anon via `UnauthorizedError`; middleware redirects to `/login`. Phase 65 inherits — no new auth surface |
| V3 Session Management | no | Inherits Supabase session — no new sessions |
| V4 Access Control | yes | Service-role pooler bypasses RLS → DAL WHERE IS the gate. Phase 65 DAL applies: (a) two-layer privacy, (b) self-exclusion, (c) status filter, (d) follow-direction. Mirror of `discovery.ts` privacy surface. **Service-action / mutation surface: none — Phase 65 is read-only.** |
| V5 Input Validation | yes | `catalogId` is `string` from `params` — page.tsx already validates UUID format at line 149 (defense-in-depth before any DB query); Drizzle parameterizes all bindings; no raw SQL concatenation in the new DAL |
| V6 Cryptography | no | No new crypto |
| V14 Configuration | no | No new env vars |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via `catalogId` or `viewerId` | Tampering | Drizzle parameterized queries (every value goes through `${}` interpolation that produces a bound parameter, never raw SQL) [VERIFIED: `src/data/discovery.ts:88-117`] |
| Privacy leak: private profile / private collection user appearing because viewer follows them | Information Disclosure | Both `profilePublic` and `collectionPublic` MUST be true; follow is a FILTER, never an OVERRIDE (D-05). Identical contract enforced in `discovery.ts:93-94` |
| IDOR via crafted `catalogId` | Authorization | None applicable — `catalogId` references the public `watches_catalog` table; there is no owner-scoped access on catalog rows. The DAL projects only `profiles.{id,username,displayName,avatarUrl}` (all public-by-design when both privacy gates pass) |
| Username injection in `<Link href>` or `aria-label` | Tampering / XSS | Username is regex-validated at signup; React text-node + template-literal auto-escape applies in JSX. Same protection as `OtherOwnersRoster.tsx:36-39` |
| Cache poisoning of follow-scoped data across viewers (cross-user leak) | Information Disclosure | The DAL is NOT wrapped in `'use cache'`; results are per-viewer dynamic, computed in the per-request render. The `await connection()` opt-out and `unstable_instant = false` ensure no PPR static-shell caches viewer-scoped output. Phase 51/52 contract preserved |
| Soft-nav React #419 regression after fill | DoS / Availability | Static guard `ppr-dynamic-before-use-cache.test.ts` enforces the route shape; new code does NOT touch `connection()` / `unstable_instant`; new DAL pre-fetches in `Promise.all` (no new Suspense boundary inside `WatchDetailHero`) |

## Environment Availability

> Phase 65 introduces no new external tools/services/runtimes. **Skipped.**

## Open Questions

1. **Should the new DAL helpers be extracted into a shared `tests/data/_collectorsFixtures.ts`?**
   - What we know: `tests/data/getCollectorsForCatalog.test.ts:51-119` defines `seedProfile`, `seedTestCatalogRow`, `seedWatchForCatalog`. Phase 65's new DAL test needs identical seeding.
   - What's unclear: Whether to copy-paste (simple, regression-isolated) or extract (DRY, single source of truth).
   - Recommendation: Copy-paste in the new test file. Two test files at ~300 LOC each is cheaper to reason about than a refactor of the existing Phase 39b test. Extract later if a third user emerges.

2. **Should the "From your circle" header itself be hidden when owners > 0 but visually unclear?**
   - What we know: D-04a locks header copy to "From your circle".
   - What's unclear: Whether the header is part of the hide-if-empty contract or rendered even at zero (the contract says the whole module is absent, which subsumes the header — answered).
   - Recommendation: Header is INSIDE the module's JSX, BELOW the `if (owners.length === 0) return null` early-return. Empty → no DOM at all. Resolved by FOLL-01 / D-04a + D-04. Logged as already-answered for the planner.

3. **Is there a risk that the route's existing Branch 2 `roster` (CollectorsForCatalog) and new `followedOwners` produce overlapping users that read awkwardly visually?**
   - What we know: D-03 keeps both rosters on Branch 3 (visually distinct: hero column "From your circle" vs below-hero "X collectors own this").
   - What's unclear: Subjective UX — does a followed collector appearing in BOTH lists feel redundant?
   - Recommendation: Accept the overlap by design. Followed-set is typically tiny and the broad roster is recency-ordered; overlap is informative ("this person is both in your circle AND in the public roster"), not redundant. If the user reports redundancy in UAT, a follow-up phase can dedupe at the broad-roster level. Out of scope for FOLL-01..04.

4. **Should `getFollowedOwnersForCatalog` accept a `null` catalogId and short-circuit, or should the page-level ternary stay the responsibility of the call site?**
   - What we know: D-01a says "document this null-handling in the DAL call site, not the component."
   - What's unclear: Whether the planner prefers a defensive null-accepting DAL signature.
   - Recommendation: Keep the DAL strict (`catalogId: string`) — call site guards with the ternary pattern from `page.tsx:328-329`. Matches `getCollectorsForCatalog` strict signature; reviewer sees the null-handling at the call site, not buried inside the DAL.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Indexes on `follows.follower_id` + `watches.catalog_id` make the new 4-table JOIN fast enough to pre-fetch synchronously (not Suspense-streamed) | D-09 fallback in user_constraints + Architecture | If wrong, hero render p95 regresses — fallback path (wrap in `<Suspense>` sibling) is documented and trivially applicable. Plan should include a measurement step |
| A2 | The middleware redirects all unauthenticated requests to `/w/[ref]` to `/login`, so the "unauthed viewer + module absence" case is moot at the route level | Architecture + Validation Architecture | `getCurrentUser()` throws `UnauthorizedError` for anon viewers; observed in `src/lib/auth.ts:25-37`. **VERIFIED** for the throw behavior; the middleware redirect itself was not opened during this research (no `middleware.ts` found at repo root via `find -maxdepth 3`; route is auth-gated via `getCurrentUser` throw → error boundary → effectively 500/redirect). The planner / executor should confirm the actual unauth UX (redirect or 500) is acceptable for this route. If `/w/[ref]` is publicly accessible for some viewer class, the DAL must short-circuit when `viewerId` is null |

## Sources

### Primary (HIGH confidence)
- `src/data/discovery.ts` (lines 72-136) — `getCollectorsForCatalog` (the structural template for the new DAL)
- `src/data/follows.ts` (lines 1-95) — existing follow DAL conventions; already imports `follows`, `profiles`, `profileSettings`, `watches`
- `src/components/insights/OtherOwnersRoster.tsx` (lines 1-90) — presentational chip module template; click-surface, aria-label, AvatarDisplay-size invariants
- `src/components/profile/AvatarDisplay.tsx` (lines 1-60) — size constraint (40 | 64 | 96 literal union)
- `src/components/watch/WatchDetailHero.tsx` (lines 48-122, 230-300) — prop shape, right-column container, integration site
- `src/app/w/[ref]/page.tsx` (lines 1-200, 200-755) — three branches, three Promise.all blocks, PPR opt-out scaffolding
- `src/db/schema.ts` (lines 238-276) — `follows`, `profiles`, `profileSettings` definitions
- `tests/data/getCollectorsForCatalog.test.ts` (lines 1-312) — DAL test template; 6 existing privacy / dedup tests
- `.planning/STATE.md` — accumulated architectural decisions; Phase 64 just shipped; route guard rails locked
- `.planning/REQUIREMENTS.md` — FOLL-01..04 verbatim
- `.planning/phases/65-follow-scoped-owners-module/65-CONTEXT.md` — user decisions

### Secondary (MEDIUM confidence)
- `.planning/phases/64-detail-page-ia-redesign/64-VALIDATION.md` — validation template for the Phase 65 Validation Architecture section
- `.planning/phases/64-detail-page-ia-redesign/64-CONTEXT.md` — D-09/D-10 hero right-column contract that Phase 65 extends
- MEMORY `project_ppr_dynamic_before_use_cache` — soft-nav #419 resolution; route shape locks
- MEMORY `project_react_418_date_tz_hydration` — date-formatting safety
- MEMORY `feedback_mobile_ui_verify_on_prod` — mobile/visual verification gate
- MEMORY `project_vitest_static_node_env` — static guard test-env requirement
- MEMORY `project_baseline_not_green_build_is_gate` — `npm run build` is the authoritative gate

### Tertiary (LOW confidence — flagged for validation)
- None — all critical claims sourced from in-tree code or load-bearing project memories.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every dependency in tree; no new packages
- Architecture: HIGH — pattern is a direct clone of Phase 39b's `getCollectorsForCatalog` + `OtherOwnersRoster`, with Phase 64's B1-sibling prop-threading discipline applied
- Pitfalls: HIGH — every pitfall has a verified prior incident or test in the codebase

**Research date:** 2026-05-28
**Valid until:** ~2026-06-28 (30 days — stable; phase touches mature subsystems with no fast-moving dependencies)
