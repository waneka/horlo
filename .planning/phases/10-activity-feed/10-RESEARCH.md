# Phase 10: Activity Feed - Research

**Researched:** 2026-04-21
**Domain:** Multi-surface authenticated home (activity feed + WYWT rail + recs + insights + suggested collectors) on Next.js 16 App Router + Supabase Postgres + Drizzle
**Confidence:** HIGH on stack, HIGH on keyset pagination, HIGH on RLS gap, MEDIUM on Cache Components ergonomics (new in Next 16; project has not yet enabled the flag)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Home Layout (all sections)**

- **L-01: Section order = Figma order.** Top → bottom: WYWT → From Collectors Like You → Network Activity → Personal Insights → Suggested Collectors.
- **L-02: Zero-state = onboarding home.** A user with zero follows and zero wear events still sees the full layout. Each section has its own empty state: WYWT = self-prompt tile only; Collectors Like You = seeded recs (works off the viewer's own collection alone); Network Activity = "Follow collectors to see their activity"; Personal Insights = section hidden if viewer has no watches; Suggested = always rendered when public profiles exist.
- **L-03: Personal collection lives at `/u/[me]/collection`.** Already built in Phase 8. Top-nav `+` and WYWT self-tile give quick access without leaving home. No dedicated `/collection` route, no duplicated "My Collection" section on home.

**Network Activity Feed (FEED-01 / FEED-02 / FEED-03 / FEED-04)**

- **F-01: Row layout = avatar left, text center, watch thumbnail right.** Row content: `{avatar} {username} {verb} {watchName}` over `{time ago}`, with watch thumbnail (from `activities.metadata.imageUrl`) on the far right. Overrides the Figma static mock.
- **F-02: Verbs are flat.** `wore {X}`, `added {X}`, `wishlisted {X}`.
- **F-03: Row click → collector profile.** Clicking anywhere on the row except the watch name navigates to `/u/{username}/collection`. Watch name is a separate tappable target → watch detail.
- **F-04: Pagination = Load More button, 20 per page, keyset cursor.** Cursor = `(created_at, id)` DESC. No OFFSET. Server Action or DAL accepts a cursor; client swaps the button for a spinner while fetching, then appends new rows.
- **F-05: Filter viewer's own events out of the main feed.** Own activities remain on `/u/[me]/stats|worn` tabs.
- **F-06: Privacy gate = per-event, no follow bypass.** Enforced at BOTH RLS and DAL WHERE clause layers.
  - `watch_added` / `wishlist_added` hidden when actor's `collection_public` / `wishlist_public` is false
  - `watch_worn` hidden when actor's `worn_public` is false
  - Actor with `profile_public = false` → all their activity rows hidden from non-owner viewers
  - Follows do NOT unlock private content (Phase 9 D-08).
- **F-07: New events = silent insert on router.refresh.** No "N new activities" banner.
- **F-08: Bulk aggregation = time-window collapse at feed-read time.** Collapse ≥3 same-type events from the same actor within a 1-hour window into ONE aggregated row. Display: `{username} added {N} watches · {time ago}`. Zero writer-side changes.

**WYWT Rail (WYWT-03)**

- **W-01: Source = last 48h rolling, most-recent-per-user.** Actor in viewer's follow list (or is viewer), respects `worn_public` at the DAL layer. Viewer's own wear always included.
- **W-02: Self-tile → watch picker dialog.** Lightweight modal listing viewer's owned watches; selecting one calls `markAsWorn`.
- **W-03: Empty rail = self-tile only.**
- **W-04: Tile visual = Instagram Reels feel.** Unviewed = accent ring, viewed = muted ring.
- **W-05: Tap tile = full-screen on mobile, modal on desktop.** Large photo, username + time, brand + model link, "Add to wishlist" button, caption, swipe navigation, close on swipe-down (mobile) or ESC / click-outside (desktop). Opening marks `wear_event.id` as viewed.
- **W-06: Viewed tracking = localStorage per viewer.** No DB writes, no cross-device sync.
- **W-07: Rail = horizontal scroll, no hard cap.** 48h window + dedupe-per-user bounds length naturally.

**From Collectors Like You (DISC-02)**

- **C-01: "Similar" = Phase 9 `tasteOverlap` score.** Top-N (10–20) public collectors excluding viewer.
- **C-02: Candidate pool = similar collectors' owned watches, minus viewer's own + wishlist.** Dedupe by normalized `(brand, model)`.
- **C-03: Rationale = rule-based templates from tags.** No LLM. Deterministic templates. No `ANTHROPIC_API_KEY` dependency on home render.
- **C-04: 4 visible cards, horizontal scroll, cap ~12.**
- **C-05: Card click → watch detail** for a representative owner's instance of that `(brand, model)`.
- **C-06: Rec freshness = per-request, cached via Next.js 16 Cache Components (`cacheLife` ~5 minutes).**
- **C-07: Dedupe = normalized `(brand, model)`** — lowercase + trim both sides.

**Personal Insights**

- **I-01: Four cards in Phase 10.** Sleeping Beauty alert · Most worn this month · Wishlist gap (NEW) · Common Ground with a follower.
- **I-02: Source = reuse existing insight lib + new `wishlistGap()` fn.** No duplication.
- **I-03: Every card is clickable, contextual target.** Sleeping Beauty → watch detail, Most Worn → watch detail, Wishlist Gap → discretion, Common Ground → follower's profile at 6th tab.
- **I-04: If viewer has no watches, hide Personal Insights section entirely.**

**Suggested Collectors (DISC-04)**

- **S-01: Pool = public profiles the viewer does not follow.** Ordered by `tasteOverlap` DESC. Private excluded.
- **S-02: Card = Figma-faithful.** Avatar + username + overlap % + 2–3 mini watch thumbnails + "N shared" + Follow button.
- **S-03: 3–5 rows visible, Load More reveals more.**
- **S-04: Follow behavior = stay in place + button flips to "Following".** Uses Phase 9 D-09 hover-swap; Phase 9 D-06 optimistic UI.

**Top Nav (Phase 10 scope)**

- **N-01: Phase 10 nav additions = `+ Wear` + `+` Add.** `+ Wear` opens the SAME picker as WYWT self-tile (one dialog, two triggers).
- **N-02: Explore link, global search bar, notifications bell = hidden.**
- **N-03: Real bulk-import UX deferred.** F-08 satisfies FEED-04.

### Claude's Discretion

- Exact dimensions, spacing, and typographic scale of sections / cards / rails
- Exact SQL structure of the feed JOIN (must be ≤2 queries per feed page, verified via EXPLAIN ANALYZE)
- Keyset cursor encoding on the wire (opaque base64 vs. plain tuple)
- Thresholds and full template list for "Collectors Like You" rationale lines
- Swipe gesture implementation for WYWT overlay — hand-rolled pointer events or a lightweight library
- Wishlist-gap algorithm specifics
- Sign-in redirect UX if an unauth viewer hits the WYWT overlay "Add to wishlist" action
- Toast placement and content on optimistic follow errors in Suggested Collectors
- Whether localStorage viewed-state uses array, Set-as-JSON, or timestamp-indexed map
- Whether "Add to wishlist" from WYWT overlay creates server-side from wear event metadata directly, or prompts confirm first
- Whether to use existing `/watch/[id]` route or create a new one

### Deferred Ideas (OUT OF SCOPE — do not research)

- Bulk-import UX (multi-URL / CSV / Chrono24)
- Cross-device viewed-state sync (`wear_event_views` table)
- Writer-side aggregate column on `activities`
- Daily rec rotation / cron
- Collaborative-filtering recommendations
- Explore page / global search / notifications (EXPL-*, SRCH-*, NOTF-*)
- NOTF-01 new-follower notifications
- Rec cache invalidation on follow/unfollow (let `cacheLife` expire)
- WYWT auto-advance timer
- "You and {name} shared N recent wears this week" composite insight
- WTCH-* requirements (watch detail social context)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FEED-01 | Home feed of network activity from followed collectors | § Feed JOIN SQL shape, § RLS gap, § DAL composition pattern |
| FEED-02 | Feed shows watch_added, wishlist_added, watch_worn | Existing writer (`logActivity` + `addWatch` + `markAsWorn`) already produces all three types; read-side only work |
| FEED-03 | Keyset pagination, no OFFSET | § Keyset cursor mechanics, § tuple comparison in Postgres |
| FEED-04 | Bulk imports emit aggregated event | F-08 read-time collapse covers this; § PostgreSQL LAG / window-function aggregation |
| WYWT-03 | WYWT rail on home page of followed users' wear events | § WYWT DAL composition, § 48h most-recent-per-user query |
| DISC-02 | "From collectors like you" recommendations | § Rule-based rationale algorithm, § tasteOverlap sampling |
| DISC-04 | Suggested collectors on home | § Top-N overlap query, § excluded-followed filter |
| FEED-05 (NEW) | Home personal insights surface | § Reuse `/insights` lib + new wishlistGap fn, § Common Ground follower variant |
</phase_requirements>

## Summary

Phase 10 is a pure **read-side + UI build** layered on top of social writes that already happen in prod (Phase 7 `logActivity`, Phase 8 `wear_events`, Phase 9 `follows` + `tasteOverlap`). There are **no new tables** and the only mandatory schema change is an **RLS policy expansion** on `public.activities` — the current `activities_select_own` policy blocks cross-user reads, which would make the feed JOIN return zero rows. This is the single non-obvious blocker and must be fixed in the same migration transaction that lands the feed DAL.

The five home sections have three distinct data-access shapes: (1) a large keyset-paginated JOIN (Network Activity), (2) composed single-query reads reused from Phase 8/9 DAL (WYWT, Suggested Collectors, Personal Insights), (3) a per-request cached computation (From Collectors Like You). Cache Components (Next.js 16's `use cache` + `cacheLife` + `cacheTag`) are the correct primitive for (3) but require enabling `cacheComponents: true` in `next.config.ts` — not currently set. Plan for Wave 0 to enable the flag and confirm no regression on existing pages.

The two parts that actually need genuine engineering judgement beyond translating CONTEXT.md are: (a) the read-time F-08 aggregation algorithm, where the planner must pick between a SQL window-function approach (collapse at query time, clean cursor semantics) and an app-layer post-pass (simpler, but cursor must advance past an uncollapsed row then re-collapse next page — handleable but subtle), and (b) the WYWT overlay swipe gesture, where embla-carousel-react 8.6.0 with full-bleed slides is the proven path over hand-rolled pointer events.

**Primary recommendation:** One Drizzle migration to expand activities SELECT policy, three new DAL files (`getFeedForUser`, `getWearRailForViewer`, `getRecommendationsForViewer`, `getSuggestedCollectors`, `wishlistGap`), one new Server Action (`addToWishlistFromWearEvent`), embla-carousel-react for WYWT overlay swipe, app-layer F-08 aggregation (simpler reasoning; SQL window approach is an optimization if EXPLAIN ANALYZE shows a bottleneck), Cache Components with `use cache` + `cacheLife('minutes')` only on the recommendations slot (not the feed — the feed must reflect follow state immediately and is per-user anyway).

## Project Constraints (from CLAUDE.md)

- **`AGENTS.md` mandate:** "This is NOT the Next.js you know" — read `node_modules/next/dist/docs/` before writing code. Heed deprecation notices. [VERIFIED: AGENTS.md]
- **Tech stack:** Next.js 16 App Router; no rewrites. [VERIFIED: CLAUDE.md]
- **Data model:** extend `Watch` + `UserPreferences` types; don't break existing shape. [VERIFIED: CLAUDE.md]
- **Personal first:** single-user correctness must hold even after multi-user auth (already delivered). [VERIFIED: CLAUDE.md]
- **Performance:** <500 watches per user; no infinite scroll / complex pagination in MVP. [VERIFIED: CLAUDE.md — note: feed DOES need keyset pagination (FEED-03) but this is for the network feed across many users, not per-user pagination]
- **GSD workflow enforcement:** No edits outside a GSD command. [VERIFIED: CLAUDE.md]
- **Naming conventions (observed in codebase):** PascalCase components, camelCase non-components, kebab-case routes, UPPER_SNAKE_CASE constants. [VERIFIED: project grep]
- **No barrel files.** Import components directly. [VERIFIED: project grep]
- **Absolute imports via `@/*`.** [VERIFIED: tsconfig.json + existing code]
- **Zod `.strict()` on all Server Action inputs** (Phase 9 pattern). [VERIFIED: src/app/actions/follows.ts]
- **Two-layer privacy: RLS + DAL WHERE.** Every new read must enforce at both layers. [VERIFIED: Phase 8 D-15, Phase 9 D-20]
- **`server-only` directive on every DAL file.** [VERIFIED: src/data/*.ts]

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.2.3 | App Router, Server Components, Server Actions, Cache Components | Project is on 16.2.3; Cache Components stable as of 16.0 [VERIFIED: package.json; CITED: node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md line 663] |
| react | 19.2.4 | Server Components, `useOptimistic`, `useTransition` | Project version [VERIFIED: package.json] |
| drizzle-orm | 0.45.2 | SQL query builder for feed JOIN | Existing DAL precedent [VERIFIED: package.json + src/data/*] |
| postgres | 3.4.9 | Postgres driver used by Drizzle client | Existing [VERIFIED: package.json + src/db/index.ts] |
| @supabase/ssr | 0.10.2 | Auth session on server | Existing `getCurrentUser` path [VERIFIED: package.json + src/lib/auth.ts] |
| zod | 4.3.6 (available; project not pinned) | Server Action input validation | Existing pattern `.strict()` [VERIFIED: `npm view zod version` → 4.3.6; CITED: src/app/actions/follows.ts] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| embla-carousel-react | 8.6.0 | WYWT overlay swipe navigation; WYWT rail horizontal scroll-snap | Use when W-05 swipe-between-tiles is implemented. 14kB gzipped, battle-tested, no cascade deps. [VERIFIED: `npm view embla-carousel-react version` → 8.6.0] |
| @base-ui/react | 1.3.0 (already installed) | Dialog primitive for WYWT overlay, watch picker dialog | Use existing primitives [VERIFIED: package.json]; base-ui provides accessible Dialog out of the box |
| lucide-react | 1.8.0 (already installed) | Icons for section headers, "+ Wear" nav button, badges | Existing [VERIFIED: package.json] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| embla-carousel-react | Hand-rolled pointer events + CSS scroll-snap | Swipe feel is the product's daily-retention hook. Hand-rolled works for the rail (horizontal scroll-snap is native CSS) but falls short for the modal overlay's swipe-between-slides behavior. Using embla for the overlay and native CSS scroll-snap for the rail is a reasonable hybrid. |
| PostgreSQL window function for F-08 aggregation | App-layer aggregation after SELECT | SQL approach: cleaner cursor semantics, harder to debug, needs `LAG()` + gap-detection logic. App-layer: simpler to reason about, extra client-side pass, cursor must advance past the last RAW row (not the last aggregated group). **Recommendation: app-layer for Phase 10, with a `TODO: promote to SQL if EXPLAIN ANALYZE shows the SELECT returning >500 raw rows per page.**| 
| Cache Components `use cache` with `cacheTag('feed:${userId}')` | Uncached Server Component render per request | Feed is already per-user and `router.refresh()` must reflect new follows immediately. Caching the feed adds cache-invalidation complexity without meaningful perf gain at MVP scale (<500 watches/user, ~50 feed items). **Recommendation: do NOT cache the Network Activity slot. Cache ONLY the From Collectors Like You recommendations (C-06 explicitly calls for this) — they survive 5-min staleness and are expensive to compute.** |
| Opaque base64 cursor encoding | Plain `{createdAt, id}` JSON on the wire | Opaque prevents clients from fabricating cursors into other users' data (low risk here since the DAL re-enforces visibility, but still tidy). **Recommendation: plain JSON cursor — simpler, DAL enforces visibility regardless.** |

**Installation:**

```bash
npm install embla-carousel-react@^8.6.0
# zod, @base-ui/react, drizzle-orm already installed
```

**Version verification (2026-04-21):**
- `next@16.2.3` — installed
- `react@19.2.4` — installed
- `drizzle-orm@0.45.2` — installed
- `embla-carousel-react@8.6.0` — verified via `npm view`, published 2026 series
- `zod@4.3.6` — verified current; project uses existing install

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── page.tsx                    # MODIFY — 5-section network home for authenticated users
│   └── actions/
│       ├── wearEvents.ts            # EXISTING — markAsWorn called from WYWT self-tile picker
│       └── wishlist.ts              # NEW — addToWishlistFromWearEvent Server Action
├── components/
│   ├── home/                        # NEW section
│   │   ├── NetworkActivityFeed.tsx     # Server Component; renders ActivityRow[] + LoadMoreButton
│   │   ├── ActivityRow.tsx             # Pure render of one activity (single OR aggregated)
│   │   ├── LoadMoreButton.tsx          # 'use client'; calls Server Action, appends rows
│   │   ├── WywtRail.tsx                # Server Component; renders tiles + self-tile
│   │   ├── WywtTile.tsx                # 'use client' (needs localStorage viewed state)
│   │   ├── WywtOverlay.tsx             # 'use client'; embla-carousel-react, base-ui Dialog
│   │   ├── WatchPickerDialog.tsx       # 'use client'; shared by WYWT self-tile + nav `+ Wear`
│   │   ├── CollectorsLikeYou.tsx       # Server Component; 'use cache' + cacheLife('minutes')
│   │   ├── RecommendationCard.tsx      # Pure render
│   │   ├── PersonalInsightsGrid.tsx    # Server Component
│   │   ├── WishlistGapCard.tsx         # Pure render
│   │   ├── MostWornThisMonthCard.tsx   # Pure render
│   │   ├── CommonGroundFollowerCard.tsx # Pure render
│   │   ├── SuggestedCollectors.tsx     # Server Component
│   │   └── SuggestedCollectorRow.tsx   # Pure render (uses Phase 9 FollowButton inline)
│   └── layout/
│       └── Header.tsx                # MODIFY — add `+ Wear` + `+` buttons
├── data/
│   ├── activities.ts                # EXTEND — add getFeedForUser(userId, cursor, limit)
│   ├── wearEvents.ts                # EXTEND — add getWearRailForViewer(userId)
│   ├── recommendations.ts           # NEW — getRecommendationsForViewer(userId)
│   └── suggestions.ts               # NEW — getSuggestedCollectors(userId, cursor)
├── lib/
│   └── wishlistGap.ts               # NEW — pure wishlistGap(watches) fn
└── supabase/migrations/
    └── 20260421xxxxxx_phase10_activities_feed_select.sql  # NEW — expand activities SELECT policy
```

### Pattern 1: Feed DAL = single JOIN + privacy gates in SQL WHERE

**What:** Assemble the feed with one `SELECT ... FROM activities a JOIN profiles p ... JOIN profile_settings ps ...` rather than fetching activity rows then N+1-ing for profiles/watches.

**When to use:** Always, for the Network Activity feed. Matches research PITFALL 5.

**Example:**
```sql
-- Source: adapts PITFALLS.md example + Phase 10 F-06 privacy gates
SELECT
  a.id, a.type, a.created_at, a.metadata,
  a.watch_id,
  p.username, p.display_name, p.avatar_url,
  ps.profile_public, ps.collection_public, ps.wishlist_public, ps.worn_public
FROM activities a
JOIN profiles p ON p.id = a.user_id
JOIN profile_settings ps ON ps.user_id = a.user_id
WHERE a.user_id IN (
  SELECT following_id FROM follows WHERE follower_id = $viewerId
)
AND a.user_id <> $viewerId                                  -- F-05 own-filter
AND ps.profile_public = true                                -- F-06 profile gate
AND (
  (a.type IN ('watch_added') AND ps.collection_public = true)
  OR (a.type = 'wishlist_added' AND ps.wishlist_public = true)
  OR (a.type = 'watch_worn' AND ps.worn_public = true)
)
AND ($cursor IS NULL OR (a.created_at, a.id) < ($cursorCreatedAt, $cursorId))
ORDER BY a.created_at DESC, a.id DESC
LIMIT 21;                                                    -- 20 + 1 sentinel for "hasMore"
```

Drizzle translation uses `.select()` + `.from(activities)` + `.innerJoin(profiles, eq(...))` + `.innerJoin(profileSettings, eq(...))` + explicit `sql` fragment for the tuple comparison `sql\`(${activities.createdAt}, ${activities.id}) < (${cursorCreatedAt}, ${cursorId})\``. [CITED: src/data/follows.ts mergeListEntries shows the Drizzle join pattern used in this project]

### Pattern 2: Keyset cursor = `(created_at, id)` DESC with row-value comparison

**What:** Postgres supports tuple comparison natively: `(a.created_at, a.id) < ($t, $id)`. This handles same-timestamp ties deterministically (id is the tiebreaker) and is O(1) per page regardless of depth.

**When to use:** Always for FEED-03. Never use OFFSET.

**Example (cursor shape on the wire — plain JSON, not opaque):**
```typescript
// Source: adapts Postgres keyset docs + research PITFALL 6
export interface FeedCursor {
  createdAt: string  // ISO timestamp of last-seen row
  id: string         // UUID of last-seen row (tiebreaker)
}
// First page: cursor = null
// Next page: cursor = { createdAt: lastRow.createdAt, id: lastRow.id }
```

The `activities_user_created_at_idx` composite index on `(user_id, created_at)` — already in the schema — is the right shape to support this query plan. [VERIFIED: src/db/schema.ts lines 178–180]

### Pattern 3: Read-time F-08 aggregation (app-layer post-pass)

**What:** The DAL returns 20–21 RAW activity rows. The aggregation step runs in TypeScript: group consecutive same-`(userId, type)` rows where the spread between first and last `createdAt` in the group is < 1 hour AND group size ≥ 3. Emit aggregated row; otherwise emit raw.

**When to use:** Always for FEED-04. The spec says ≥3 `watch_added` OR ≥3 `wishlist_added` from same actor within 1 hour (watch_worn is NOT aggregated — nobody logs 3 wears in an hour).

**Cursor implications:** The cursor always points to a RAW row (not an aggregated group). Next page picks up from the last raw row's `(createdAt, id)`. This means the 1-hour window may be split across page boundaries — if rows 18–22 are within a 1-hour same-type burst and page 1 ends at row 20, page 1 shows 20 raw rows (no aggregation triggers because only 2 in the visible slice), and page 2 shows rows 21+ raw. **Mitigation:** fetch 20 + 1 sentinel rows per page to reduce the chance of a split; accept that edge-case splits are acceptable (display is slightly more verbose than ideal, not wrong).

**Example:**
```typescript
// Source: pure TS implementation; adapts research FEATURES.md event rate limiting guidance
export interface AggregatedRow {
  kind: 'aggregated'
  userId: string
  username: string
  avatarUrl: string | null
  type: 'watch_added' | 'wishlist_added'
  count: number
  firstCreatedAt: string
  lastCreatedAt: string
  representativeMetadata: { brand: string; model: string; imageUrl: string | null }
}

export function aggregateFeed(rows: RawFeedRow[]): Array<RawFeedRow | AggregatedRow> {
  const out: Array<RawFeedRow | AggregatedRow> = []
  let i = 0
  while (i < rows.length) {
    const head = rows[i]
    if (head.type !== 'watch_added' && head.type !== 'wishlist_added') {
      out.push(head); i++; continue
    }
    let j = i + 1
    while (
      j < rows.length &&
      rows[j].userId === head.userId &&
      rows[j].type === head.type &&
      (new Date(head.createdAt).getTime() - new Date(rows[j].createdAt).getTime()) < 3_600_000
    ) j++
    const groupSize = j - i
    if (groupSize >= 3) {
      out.push(toAggregated(rows.slice(i, j)))
    } else {
      for (let k = i; k < j; k++) out.push(rows[k])
    }
    i = j
  }
  return out
}
```

### Pattern 4: Cache Components for recommendations (only)

**What:** Mark `CollectorsLikeYou` with `'use cache'` + `cacheLife('minutes')` (built-in profile, 5min revalidate, 1hr expire). Scope the cache key by the viewer's `userId` via a function argument so one viewer's recs don't leak to another.

**When to use:** ONLY for C-06 Collectors Like You. Do NOT cache the feed or WYWT rail.

**Example:**
```tsx
// Source: adapts Next.js 16 Cache Components docs (use-cache.md + cacheLife.md)
import { cacheLife } from 'next/cache'

export async function CollectorsLikeYou({ viewerId }: { viewerId: string }) {
  'use cache'
  cacheLife('minutes')  // 5min stale, 5min revalidate, 1hr expire
  // viewerId flows into the cache key automatically (Cache Components doc lines 78–99)
  const recs = await getRecommendationsForViewer(viewerId)
  return <RecommendationGrid recs={recs} />
}
```

**Prerequisite:** Enable `cacheComponents: true` in `next.config.ts` (Wave 0). Currently NOT set. [VERIFIED: next.config.ts]

**`router.refresh()` interaction:** Per Next.js 16 docs (cacheLife.md line 250), calling `revalidateTag` / `revalidatePath` / `updateTag` / `refresh` from a Server Action **immediately clears the entire client cache**, bypassing stale time. This means after `followUser` / `unfollowUser`, the recommendations cache on the server is NOT cleared (only client-side stale is), but the 5-minute revalidate means stale data is served for up to 5 minutes, then regenerated. **This is acceptable** — recommendations are not time-critical and the section is secondary. If the planner wants follow-triggered immediate refresh, use `cacheTag(\`recs:${viewerId}\`)` inside the cache scope and `revalidateTag(\`recs:${userId}\`)` in the follow Server Action.

### Pattern 5: WYWT DAL composes `getPublicWearEventsForViewer`

**What:** Reuse the existing Phase 8 DAL gate rather than duplicating `worn_public` logic.

**When to use:** In the new `getWearRailForViewer(viewerId)` DAL.

**Example:**
```typescript
// Source: composes src/data/wearEvents.ts:86 (existing getPublicWearEventsForViewer)
export async function getWearRailForViewer(viewerId: string) {
  // 1. Who's in scope: viewer + everyone they follow
  const followingIds = await db.select({ id: follows.followingId })
    .from(follows)
    .where(eq(follows.followerId, viewerId))
    .then(rows => rows.map(r => r.id))
  const actorIds = [viewerId, ...followingIds]

  // 2. Pull all wears from last 48h for those actors in ONE query
  //    (viewer's own + followed), filter worn_public at SQL layer
  const cutoff = new Date(Date.now() - 48 * 3600_000).toISOString().split('T')[0]
  const rows = await db.select({
      wearEvent: wearEvents,
      profile: profiles,
      wornPublic: profileSettings.wornPublic,
    })
    .from(wearEvents)
    .innerJoin(profiles, eq(profiles.id, wearEvents.userId))
    .innerJoin(profileSettings, eq(profileSettings.userId, wearEvents.userId))
    .where(and(
      inArray(wearEvents.userId, actorIds),
      gte(wearEvents.wornDate, cutoff),
      or(eq(wearEvents.userId, viewerId), eq(profileSettings.wornPublic, true)),
    ))
    .orderBy(desc(wearEvents.wornDate))

  // 3. Dedupe to most-recent-per-actor (viewer always gets latest, even if old)
  const byUser = new Map<string, typeof rows[0]>()
  for (const r of rows) if (!byUser.has(r.wearEvent.userId)) byUser.set(r.wearEvent.userId, r)
  return [...byUser.values()]
}
```

### Anti-Patterns to Avoid

- **Fetching watch row per activity:** the `activities.metadata` JSONB column already carries `{brand, model, imageUrl}` — never re-join to `watches` from the feed renderer (Phase 7 D-06). [VERIFIED: src/data/activities.ts + src/app/actions/watches.ts:69]
- **Relying on app-layer privacy alone:** every new cross-user read MUST be gated at RLS AND DAL (Phase 8 D-15, Phase 9 D-20).
- **Using `watches.id` for recommendation "already-owned" dedup:** per-user watches have independent UUIDs. Use normalized `(brand, model)` like `computeTasteOverlap` does (Phase 9 D-01, tasteOverlap.ts:57).
- **localStorage reads in server components:** localStorage is client-only; must be guarded behind `useEffect` to avoid hydration mismatch.
- **Calling `revalidatePath('/')` from WYWT overlay "Add to wishlist":** the overlay is an island; refreshing the entire page jars the user out of the overlay. Use `router.refresh()` ONLY after the overlay closes — or better, leave the refresh for the next natural navigation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Swipe-between-slides in overlay | Hand-rolled pointer events + translate animations | `embla-carousel-react@8.6.0` | Handles inertia, velocity, snap, keyboard arrows, rubber-band edge bounce. 14kB gzipped. Hand-rolling misses edge cases (momentum interrupt, pinch-zoom suppression, focus trap interaction). [CITED: embla-carousel-react npm] |
| Horizontal scroll-snap rail | JS scroll handlers | CSS `scroll-snap-type: x mandatory` + `scroll-snap-align: start` on tiles | Native, zero JS, accessible. |
| Dialog / modal primitive | Portal + ESC handler + focus trap + scroll lock | `@base-ui/react` Dialog (already installed 1.3.0) | Accessible focus trap, ESC, click-outside handled. [VERIFIED: package.json] |
| Time-ago formatting ("3m ago") | Hand math with `Date.now()` | Existing `formatDistanceToNow` helper in codebase OR date-fns `formatDistanceToNowStrict` (adds dep) | Check if codebase already has a `timeAgo` helper under `src/lib/` before adding date-fns. [ASSUMED that a helper may exist — planner must grep `src/lib` before installing date-fns. If none, use a 10-line inline helper; Horlo's CLAUDE.md cautions against heavy date libs.] |
| Keyset cursor SQL | Hand-crafting OFFSET math to "skip" inserts | Postgres row-value tuple comparison `(a, b) < ($a, $b)` | Native Postgres feature, matches research recommendation. [CITED: Postgres docs + Sequin keyset cursors article] |
| Optimistic follow button | New state machine | Existing Phase 9 `FollowButton` component | Drop-in reuse; already handles hover-swap, D-06 optimistic pattern, D-09 mobile two-tap. [VERIFIED: src/components/profile/FollowButton.tsx] |
| Avatar rendering | New component | Existing `AvatarDisplay` | [VERIFIED: src/components/profile/AvatarDisplay.tsx] |
| Taste-overlap ranking | New pairwise loop | Existing `computeTasteOverlap` + `tasteOverlap` DAL | [VERIFIED: src/lib/tasteOverlap.ts + src/data/follows.ts:261] |
| Activity logging | New emit path | Existing `logActivity` — already called from `addWatch` / `markAsWorn` | [VERIFIED: src/data/activities.ts + src/app/actions/watches.ts:69 + src/app/actions/wearEvents.ts:39] |

**Key insight:** Nearly all building blocks are already in the codebase. The four genuinely new units of work are: feed DAL + aggregation, WYWT DAL + overlay UI, recommendations DAL + rule templates, wishlistGap fn.

## Runtime State Inventory

> Phase 10 is a read-side + UI build. The only state mutation is the RLS policy expansion. No renames, no refactors. Included for completeness.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no data migration. Existing `activities` / `wear_events` / `follows` / `profiles` / `profile_settings` rows are consumed as-is. | None |
| Live service config | Supabase RLS policy on `public.activities` (`activities_select_own`, SELECT own only) — currently blocks cross-user reads, which breaks the feed JOIN | DROP existing SELECT policy, CREATE new policy allowing own OR followed-with-privacy-gate; ship in the same Drizzle migration as any DAL changes |
| OS-registered state | None | None |
| Secrets / env vars | None — no new secret. `ANTHROPIC_API_KEY` is NOT a dependency (C-03 template-based recs). | None |
| Build artifacts | `cacheComponents: true` flag in `next.config.ts` — enabling it rebuilds the Next.js route tree with the new caching semantics | Wave 0: enable the flag, run `npm run build` locally to confirm no existing route breaks, then commit |

**Nothing found in category:** Stored data, OS-registered state, secrets — verified by grepping the codebase and reading `.env.example`.

## Common Pitfalls

### Pitfall 1: `activities_select_own` policy blocks the feed JOIN
**What goes wrong:** `SELECT ... FROM activities a WHERE a.user_id IN (SELECT following_id FROM follows WHERE follower_id = $viewerId)` returns ZERO rows because `activities_select_own` only admits `user_id = auth.uid()`. The feed is silently empty.
**Why it happens:** Phase 7 shipped the policy with a comment `-- Phase 10 will expand SELECT for feed` but the expansion was deferred. The comment is on supabase/migrations/20260420000001_social_tables_rls.sql line 29.
**How to avoid:** Ship a migration in Phase 10 that DROPs `activities_select_own` and CREATEs a replacement like `activities_select_own_or_followed`:
```sql
DROP POLICY activities_select_own ON public.activities;
CREATE POLICY activities_select_own_or_followed ON public.activities
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.follows
      WHERE follows.follower_id = (SELECT auth.uid())
        AND follows.following_id = activities.user_id
    )
  );
```
Note: per-event visibility (collection_public / wishlist_public / worn_public) is enforced in the DAL WHERE clause, NOT in RLS, because RLS is row-level and the type→setting mapping is cleaner at the DAL. RLS is the outer gate; DAL is the inner gate.
**Warning signs:** Feed renders empty on a viewer with known-active followings. `SELECT COUNT(*) FROM activities WHERE user_id = '<followed-user-id>'` from Supabase SQL editor (superuser) returns rows; from the Drizzle client (`auth.uid()` context) returns 0. [VERIFIED: supabase/migrations/20260420000001_social_tables_rls.sql line 31]

### Pitfall 2: N+1 in feed renderer (re-fetching watch rows per activity)
**What goes wrong:** Naïve render calls `getWatchById(row.watchId)` per activity to get the image URL — N queries for 20 activities.
**Why it happens:** It's not obvious the metadata JSONB already has what the row needs. It does: Phase 7 D-06 put `{brand, model, imageUrl}` in `activities.metadata` precisely so the feed renders without a watches JOIN.
**How to avoid:** Render from `activity.metadata`. Do not call `getWatchById` from the feed row. The only reason to JOIN `watches` is if the row links to `/watch/{watchId}` and you need the live watch to verify it still exists (watchId is nullable on `activities` since `ON DELETE SET NULL`). Better: let the click target handle missing-watch gracefully (the row still renders because it uses metadata snapshot).
**Warning signs:** Supabase logs show 20+ queries per home page load.

### Pitfall 3: OFFSET pagination (research PITFALL 6)
**What goes wrong:** Duplicates and gaps when new activities arrive during pagination.
**How to avoid:** Keyset (cursor) with `(created_at, id)` tuple comparison. See Pattern 2.

### Pitfall 4: localStorage hydration mismatch
**What goes wrong:** Reading localStorage during server render is impossible; reading during first client render causes React hydration mismatch (server said "unviewed ring", client says "viewed ring").
**How to avoid:** Initial render always shows "unviewed". After `useEffect` hydrates the viewed set, re-render. This produces a brief flicker on first load but no hydration warnings. Alternative: put viewed-ring as a CSS class toggled client-only via a `data-` attribute after mount.

### Pitfall 5: Aggregation-window split across page boundary
**What goes wrong:** 3 `watch_added` events from user X land within a 1-hour window. Events 1–2 sit in page 1 slot 19–20, event 3 sits in page 2 slot 1. Aggregation trigger (≥3) never fires because each page has <3 same-actor same-type rows.
**How to avoid:** Accept the edge-case display (2 raw rows on page 1 + 1 raw row on page 2) — not wrong, just verbose. Fetching 20+1 sentinel per page reduces but doesn't eliminate. Document the tradeoff in the plan. Future-state promotion to SQL window function closes the gap.
**Warning signs:** User observes "I imported 5 watches in one sitting and the feed shows each one separately on the edge of a page."

### Pitfall 6: `router.refresh()` does not invalidate `use cache`
**What goes wrong:** User follows a collector. `router.refresh()` is called. The feed re-fetches (good, feed is not cached). But "Collectors Like You" (cached via `cacheLife('minutes')`) continues to show the pre-follow recommendations for up to 5 minutes.
**How to avoid:** Either (a) accept the 5-minute lag (default — recs are not time-critical), or (b) add `cacheTag(\`recs:${viewerId}\`)` inside the cached scope and call `revalidateTag(\`recs:${currentUser.id}\`)` from `followUser` / `unfollowUser` Server Actions. **Recommendation: (a). If the planner picks (b), add a TODO note in the Server Action that it now has a concern it didn't have before.**
**Warning signs:** QA reports "I followed the person and the 'Collectors Like You' section still shows their watches as recommendations for me." [CITED: Next.js cacheLife.md line 250 — revalidate/updateTag/refresh from Server Action clears CLIENT cache, not server in-memory LRU]

### Pitfall 7: Viewer cached under different cache key than they render as
**What goes wrong:** `CollectorsLikeYou` captures `viewerId` in the closure. If the component is mounted as `<CollectorsLikeYou />` (no prop) and reads `getCurrentUser()` INSIDE the cached scope, the cache key is deterministic (same function + no args = same key) and every user sees the same recs — disastrous.
**How to avoid:** `viewerId` MUST be a prop (function argument) to the cached component, not read from inside. Cache keys include serialized arguments (use-cache.md line 78). [CITED: use-cache.md lines 78–99]
**Warning signs:** Two users see identical recommendations. Hard to detect in single-user local dev — catch in code review.

### Pitfall 8: Own-activity bleeding into feed (research line 363)
**What goes wrong:** The viewer sees `You added Rolex Submariner` in their own Network Activity feed — feels like a personal log, not discovery.
**How to avoid:** Add `AND a.user_id <> $viewerId` to the feed WHERE clause (F-05).

### Pitfall 9: Wishlist gap "definition" drift
**What goes wrong:** "Wishlist gap" is vague. Implementation picks one heuristic (e.g., missing `dress` role), QA picks another (e.g., missing `green` dial color), feature feels random.
**How to avoid:** Lock an operational definition in the plan. Recommendation:
> **Wishlist gap = the underrepresented role tag in the viewer's OWNED collection, provided a threshold of "under-representation" is met.**
> Algorithm: compute roleTag distribution across owned watches. If any role tag from the CANONICAL set `{dive, dress, sport, field, pilot, chronograph, travel, formal, casual}` has frequency < 10% AND no watch in the wishlist already covers it, surface that role as the gap.
> Rationale line: `"Your collection leans {top-role}. Consider a {gap-role} watch to round it out."`
> Click target: filtered wishlist view OR refresh Collectors Like You with a style filter applied (I-03 Claude's discretion).
>
> Falls back to "no gap detected" (card hidden) when every canonical role has ≥10% or is already in wishlist.

### Pitfall 10: Two watch picker dialogs diverge
**What goes wrong:** WYWT self-tile picker and nav `+ Wear` picker were built separately, then they drift (one searches, the other doesn't; one shows brand+model, the other shows brand only).
**How to avoid:** Extract `WatchPickerDialog` as a single component, imported by both call sites. CONTEXT.md N-01 explicitly calls this out.

### Pitfall 11: Feed DAL fetching entire activity payload, not just what the row needs
**What goes wrong:** DAL returns full `activities.metadata` JSONB plus all profile fields. Over-the-wire payload bloats as collections grow.
**How to avoid:** Explicit SELECT columns in Drizzle (`.select({ id: activities.id, ... })`), don't `.select()` whole tables on joined rows. [CITED: src/data/follows.ts mergeListEntries shows the explicit-select pattern already used in this codebase]

### Pitfall 12: `cacheComponents` flag not enabled but `'use cache'` written
**What goes wrong:** Writing `'use cache'` without `cacheComponents: true` in `next.config.ts` is a no-op or error depending on Next version. [CITED: cacheLife.md lines 20–38; use-cache.md lines 25–46]
**How to avoid:** Wave 0 task — enable the flag, rebuild, commit before any `'use cache'` directive lands.

## Code Examples

### Feed DAL with keyset cursor + RLS/DAL two-layer privacy

```typescript
// Source: adapts PITFALLS.md example + Phase 9 src/data/follows.ts pattern
// src/data/activities.ts — ADD getFeedForUser
import 'server-only'
import { db } from '@/db'
import { activities, profiles, profileSettings, follows } from '@/db/schema'
import { and, desc, eq, sql, inArray, not } from 'drizzle-orm'

export interface FeedCursor { createdAt: string; id: string }
export interface RawFeedRow {
  id: string
  type: 'watch_added' | 'wishlist_added' | 'watch_worn'
  createdAt: string
  watchId: string | null
  metadata: { brand: string; model: string; imageUrl: string | null }
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
}

export async function getFeedForUser(
  viewerId: string,
  cursor: FeedCursor | null,
  limit = 20,
): Promise<{ rows: RawFeedRow[]; nextCursor: FeedCursor | null }> {
  const cursorClause = cursor
    ? sql`(${activities.createdAt}, ${activities.id}) < (${new Date(cursor.createdAt)}, ${cursor.id})`
    : sql`TRUE`

  const rows = await db
    .select({
      id: activities.id,
      type: activities.type,
      createdAt: activities.createdAt,
      watchId: activities.watchId,
      metadata: activities.metadata,
      userId: activities.userId,
      username: profiles.username,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
      profilePublic: profileSettings.profilePublic,
      collectionPublic: profileSettings.collectionPublic,
      wishlistPublic: profileSettings.wishlistPublic,
      wornPublic: profileSettings.wornPublic,
    })
    .from(activities)
    .innerJoin(profiles, eq(profiles.id, activities.userId))
    .innerJoin(profileSettings, eq(profileSettings.userId, activities.userId))
    .innerJoin(follows, and(
      eq(follows.followerId, viewerId),
      eq(follows.followingId, activities.userId),
    ))
    .where(and(
      not(eq(activities.userId, viewerId)),           // F-05
      eq(profileSettings.profilePublic, true),        // F-06 profile gate
      sql`(
        (${activities.type} = 'watch_added' AND ${profileSettings.collectionPublic} = true)
        OR (${activities.type} = 'wishlist_added' AND ${profileSettings.wishlistPublic} = true)
        OR (${activities.type} = 'watch_worn' AND ${profileSettings.wornPublic} = true)
      )`,
      cursorClause,
    ))
    .orderBy(desc(activities.createdAt), desc(activities.id))
    .limit(limit + 1)

  const hasMore = rows.length > limit
  const pageRows = rows.slice(0, limit)
  const nextCursor = hasMore && pageRows.length > 0
    ? { createdAt: pageRows[pageRows.length - 1].createdAt.toISOString(), id: pageRows[pageRows.length - 1].id }
    : null

  return {
    rows: pageRows.map(r => ({
      id: r.id,
      type: r.type as RawFeedRow['type'],
      createdAt: r.createdAt.toISOString(),
      watchId: r.watchId,
      metadata: r.metadata as RawFeedRow['metadata'],
      userId: r.userId,
      username: r.username,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
    })),
    nextCursor,
  }
}
```

### Load More Server Action

```typescript
// Source: adapts src/app/actions/follows.ts pattern
// src/app/actions/feed.ts (NEW)
'use server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { getFeedForUser, aggregateFeed } from '@/data/activities'
import type { ActionResult } from '@/lib/actionTypes'

const cursorSchema = z.object({
  createdAt: z.string().datetime(),
  id: z.string().uuid(),
}).strict()

const loadMoreSchema = z.object({ cursor: cursorSchema }).strict()

export async function loadMoreFeed(data: unknown): Promise<ActionResult<{
  rows: ReturnType<typeof aggregateFeed>
  nextCursor: { createdAt: string; id: string } | null
}>> {
  let user
  try { user = await getCurrentUser() } catch { return { success: false, error: 'Not authenticated' } }
  const parsed = loadMoreSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: 'Invalid request' }
  try {
    const { rows, nextCursor } = await getFeedForUser(user.id, parsed.data.cursor, 20)
    return { success: true, data: { rows: aggregateFeed(rows), nextCursor } }
  } catch (err) {
    console.error('[loadMoreFeed] unexpected error:', err)
    return { success: false, error: "Couldn't load more." }
  }
}
```

### WYWT overlay with embla-carousel-react

```tsx
// Source: embla-carousel-react docs + base-ui Dialog
// src/components/home/WywtOverlay.tsx
'use client'
import useEmblaCarousel from 'embla-carousel-react'
import { Dialog } from '@base-ui/react'
import { useState, useEffect } from 'react'

interface Props {
  tiles: WywtTile[]
  initialIndex: number
  open: boolean
  onOpenChange: (v: boolean) => void
  onViewed: (wearEventId: string) => void
}

export function WywtOverlay({ tiles, initialIndex, open, onOpenChange, onViewed }: Props) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    startIndex: initialIndex,
    align: 'start',
    containScroll: false,
  })

  useEffect(() => {
    if (!emblaApi) return
    const onSelect = () => {
      const index = emblaApi.selectedScrollSnap()
      onViewed(tiles[index].wearEventId)
    }
    emblaApi.on('select', onSelect)
    onSelect() // mark initial as viewed
    return () => { emblaApi.off('select', onSelect) }
  }, [emblaApi, tiles, onViewed])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/80" />
        <Dialog.Popup className="fixed inset-0 md:inset-8 md:max-w-md md:mx-auto">
          <div className="overflow-hidden h-full" ref={emblaRef}>
            <div className="flex h-full">
              {tiles.map(tile => (
                <div key={tile.wearEventId} className="flex-[0_0_100%] min-w-0 h-full">
                  <WywtSlide tile={tile} />
                </div>
              ))}
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

### localStorage viewed-state with SSR safety

```typescript
// Source: standard React 19 hydration pattern
// src/components/home/useWywtViewedSet.ts
'use client'
import { useState, useEffect, useCallback } from 'react'

const KEY = 'horlo:wywt:viewed:v1'
const MAX_ENTRIES = 200

export function useWywtViewedSet() {
  const [viewed, setViewed] = useState<Set<string>>(new Set())
  // Hydrate AFTER mount — never during SSR or first render
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) setViewed(new Set(JSON.parse(raw) as string[]))
    } catch {}
  }, [])
  const markViewed = useCallback((id: string) => {
    setViewed(prev => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      // Cap size; drop oldest (no timestamp, drop in iteration order)
      if (next.size > MAX_ENTRIES) {
        const iter = next.values()
        for (let i = 0; i < next.size - MAX_ENTRIES; i++) next.delete(iter.next().value!)
      }
      try { localStorage.setItem(KEY, JSON.stringify([...next])) } catch {}
      return next
    })
  }, [])
  return { viewed, markViewed }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `revalidate = 3600` route segment config | `'use cache'` + `cacheLife('hours')` | Next.js 16 (cache components stable) | Phase 10 uses new API for the recs slot. Route-segment `revalidate` is deprecated when `cacheComponents: true` [CITED: node_modules/next/dist/docs/01-app/02-guides/migrating-to-cache-components.md] |
| `router.refresh()` from client for reconciliation | Still current — both exist; `router.refresh()` triggered from Server Action called `refresh()` | Next.js 16 | Use existing `router.refresh()` client-side pattern for follow/unfollow (Phase 9 precedent). Optionally use `refresh()` from Server Action if preferred. |
| OFFSET pagination | Keyset cursor with tuple comparison | 2023+ community consensus | Phase 10 FEED-03 mandates this [CITED: research PITFALLS.md + Sequin keyset article] |
| Client-side taste comparison via fetched full collections | Server-side `computeTasteOverlap` | Phase 9 shipped | Phase 10 reuses — no client fetch of foreign collections |

**Deprecated / outdated:**
- `export const revalidate = N` in pages when `cacheComponents: true` — replaced by `cacheLife` (but only once the flag is on)
- Nothing else in prior phases is deprecated

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Next.js 16 | All (home, feed, recs) | Yes | 16.2.3 | — |
| React 19 | All | Yes | 19.2.4 | — |
| Drizzle ORM | Feed / WYWT / recs DAL | Yes | 0.45.2 | — |
| Supabase Postgres | Feed / WYWT / recs | Yes | Linked project | — |
| `cacheComponents: true` flag | Collectors Like You cache | **No — must be enabled in Wave 0** | n/a | If the planner decides to defer the flag, skip the cache layer on recs; still functional, just recomputes every request |
| embla-carousel-react | WYWT overlay swipe | **No — must `npm install`** | target 8.6.0 | Hand-rolled overlay with pointer events (worse feel) |
| @base-ui/react | Dialog primitive | Yes | 1.3.0 | — |
| Vitest + jsdom | Unit tests (aggregation, wishlistGap, keyset predicate builder, recommendation scorer) | Yes | Vitest 2.1.9 | — |

**Missing dependencies with no fallback:** None — every blocker has a workaround.

**Missing dependencies with fallback:**
- `cacheComponents` flag (fallback: skip cache, recompute recs per request — acceptable at MVP scale)
- `embla-carousel-react` (fallback: hand-rolled pointer events; worse feel but ships)

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 + @testing-library/react 16.3.2 + jsdom 25.0.1 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test -- --run tests/data/getFeedForUser.test.ts` (per-test) |
| Full suite command | `npm test` |
| Existing pattern examples | `tests/lib/tasteOverlap.test.ts`, `tests/actions/follows.test.ts`, `tests/data/isolation.test.ts`, `tests/components/profile/FollowButton.test.tsx` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FEED-01 | Viewer sees feed of followed collectors' events | integration (Drizzle against test DB or heavily-mocked) | `npm test -- --run tests/data/getFeedForUser.test.ts` | ❌ Wave 0 |
| FEED-01 | Row shape includes actor profile + metadata for render | unit | `npm test -- --run tests/data/getFeedForUser.test.ts` | ❌ Wave 0 |
| FEED-02 | All three activity types appear in feed | unit + integration | `npm test -- --run tests/data/getFeedForUser.test.ts` | ❌ Wave 0 |
| FEED-03 | Keyset cursor predicate correctness | unit (pure SQL-fragment builder or integration) | `npm test -- --run tests/data/feedKeyset.test.ts` | ❌ Wave 0 |
| FEED-03 | No duplicates when new activity inserted between pages | integration | `npm test -- --run tests/data/feedKeyset.test.ts::'no-duplicate'` | ❌ Wave 0 |
| FEED-04 | ≥3 same-actor same-type within 1hr collapse into one row | unit (pure aggregateFeed fn) | `npm test -- --run tests/lib/aggregateFeed.test.ts` | ❌ Wave 0 |
| FEED-04 | Aggregation across page boundary (documented split behavior) | unit | `npm test -- --run tests/lib/aggregateFeed.test.ts::'split'` | ❌ Wave 0 |
| FEED-01 Zero-state | Empty follow graph → empty-state copy | component test | `npm test -- --run tests/components/home/NetworkActivityFeed.test.tsx` | ❌ Wave 0 |
| F-06 Privacy | Private collection's `watch_added` not in feed | integration | `npm test -- --run tests/data/getFeedForUser.test.ts::'privacy'` | ❌ Wave 0 |
| F-05 Own-filter | Viewer's own activities excluded | unit/integration | `npm test -- --run tests/data/getFeedForUser.test.ts::'own-filter'` | ❌ Wave 0 |
| WYWT-03 | 48h rolling rail respects worn_public | integration | `npm test -- --run tests/data/getWearRailForViewer.test.ts` | ❌ Wave 0 |
| WYWT-03 | Most-recent-per-actor dedupe | unit | `npm test -- --run tests/data/getWearRailForViewer.test.ts::'dedupe'` | ❌ Wave 0 |
| W-06 | localStorage viewed set hydrates without mismatch | component test | `npm test -- --run tests/components/home/WywtTile.test.tsx` | ❌ Wave 0 |
| DISC-02 | Recs exclude viewer-owned + viewer-wishlisted | unit | `npm test -- --run tests/data/getRecommendationsForViewer.test.ts` | ❌ Wave 0 |
| DISC-02 | Rule-based rationale picks the right template | unit | `npm test -- --run tests/lib/recommendationRationale.test.ts` | ❌ Wave 0 |
| DISC-02 | Normalized (brand, model) dedupe (case + whitespace) | unit | `npm test -- --run tests/lib/recommendationRationale.test.ts::'dedupe'` | ❌ Wave 0 |
| FEED-05 (new) | `wishlistGap` returns the underrepresented role | unit | `npm test -- --run tests/lib/wishlistGap.test.ts` | ❌ Wave 0 |
| FEED-05 | No gap when collection covers all roles | unit | `npm test -- --run tests/lib/wishlistGap.test.ts::'balanced'` | ❌ Wave 0 |
| DISC-04 | Suggested ordered by tasteOverlap DESC, excludes followed | integration | `npm test -- --run tests/data/getSuggestedCollectors.test.ts` | ❌ Wave 0 |
| DISC-04 | Private profiles excluded from suggestions | integration | `npm test -- --run tests/data/getSuggestedCollectors.test.ts::'privacy'` | ❌ Wave 0 |
| Server Action | `loadMoreFeed` rejects non-UUID cursor id | unit | `npm test -- --run tests/actions/feed.test.ts` | ❌ Wave 0 |
| Server Action | `addToWishlistFromWearEvent` rejects unauth | unit | `npm test -- --run tests/actions/wishlist.test.ts` | ❌ Wave 0 |
| Component | ActivityRow renders all three verbs correctly | component test | `npm test -- --run tests/components/home/ActivityRow.test.tsx` | ❌ Wave 0 |
| Component | WatchPickerDialog shared between nav + self-tile | component test | `npm test -- --run tests/components/home/WatchPickerDialog.test.tsx` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- --run tests/{changed-file-area}.test.ts` (Vitest run, single area)
- **Per wave merge:** `npm test` (full suite — currently ~120 tests, runs in <10s)
- **Phase gate:** Full suite green + `npm run lint` + `npm run build` before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/data/getFeedForUser.test.ts` — covers FEED-01, FEED-02, F-05, F-06, keyset pagination
- [ ] `tests/data/feedKeyset.test.ts` — covers FEED-03 cursor correctness and no-duplicate invariant
- [ ] `tests/lib/aggregateFeed.test.ts` — covers FEED-04 aggregation algorithm (pure fn — easy unit test)
- [ ] `tests/data/getWearRailForViewer.test.ts` — covers WYWT-03 48h + dedupe + privacy
- [ ] `tests/components/home/WywtTile.test.tsx` — covers W-06 localStorage hydration safety
- [ ] `tests/data/getRecommendationsForViewer.test.ts` — covers DISC-02 candidate filter + dedupe
- [ ] `tests/lib/recommendationRationale.test.ts` — covers C-03 rule templates
- [ ] `tests/lib/wishlistGap.test.ts` — covers FEED-05 / I-01 gap algorithm
- [ ] `tests/data/getSuggestedCollectors.test.ts` — covers DISC-04 ordering + privacy exclusion
- [ ] `tests/actions/feed.test.ts` — covers `loadMoreFeed` Server Action input validation + auth gate
- [ ] `tests/actions/wishlist.test.ts` — covers `addToWishlistFromWearEvent` Server Action
- [ ] `tests/components/home/NetworkActivityFeed.test.tsx` — covers empty-state and mixed aggregated + raw render
- [ ] `tests/components/home/ActivityRow.test.tsx` — covers three verbs + metadata render
- [ ] `tests/components/home/WatchPickerDialog.test.tsx` — covers shared picker (used by two triggers)

**Manual / UAT verification to flag for `/gsd-verify-work`:**
- WYWT overlay swipe gesture on real mobile device (embla reliability across iOS Safari + Android Chrome)
- Feed renders with no flash on first load after follow (router.refresh reconciliation)
- localStorage viewed-state persists across page reload and gives subtle but visible state change
- Add-to-wishlist from WYWT overlay creates a `status='wishlist'` row and the overlay reflects "already in your wishlist" if tapped again
- Recommendations section shows different recs for two different users on the same machine (log out / log in test)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `getCurrentUser()` gate on every DAL/Server Action (existing pattern) |
| V3 Session Management | yes | Supabase `@supabase/ssr` — unchanged |
| V4 Access Control | yes | Two-layer privacy: RLS + DAL WHERE. Feed DAL explicitly checks `profile_public`, `collection_public`, `wishlist_public`, `worn_public`. RLS allows own + followed SELECT on activities. |
| V5 Input Validation | yes | Zod `.strict()` on `loadMoreFeed`, `addToWishlistFromWearEvent`, WatchPicker payloads |
| V6 Cryptography | no | No cryptography introduced |
| V11 Business Logic | yes | F-05 own-filter, F-06 per-event privacy gates, self-follow prevention (carries Phase 9) |
| V12 File | no | No file uploads |
| V13 API | yes | Server Actions use structured ActionResult; no new API routes |
| V14 Configuration | yes | Enabling `cacheComponents` is a config change — commit it, don't rely on runtime flag |

### Known Threat Patterns for Next.js 16 + Supabase + Drizzle

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR on Load More cursor (viewer crafts a cursor pointing at private activity) | Info Disclosure | DAL filters still apply; cursor only controls pagination, not visibility. Zod validates cursor shape (`.uuid()` + `.datetime()`). |
| Follow-then-spy: user follows a private account and hopes the feed surfaces private activity | Info Disclosure | Phase 9 D-08 + Phase 10 F-06: follows never bypass privacy. Enforced at RLS AND DAL. |
| Cache-key leak: cached recs for user A served to user B | Info Disclosure | `viewerId` passed as argument → part of cache key. DO NOT read `getCurrentUser()` inside `'use cache'` scope. |
| Self-follow inflation / activity spoofing | Tampering | `follows_insert_own` RLS + app-layer self-follow check (Phase 9). Activity writer always uses `auth.uid()` server-side. |
| SSRF via watch image URLs in feed | Info Disclosure | Images served via `next/image` unoptimized (next.config.ts) — browser fetches directly, no server-side fetch; existing `getSafeImageUrl` enforces https: [VERIFIED: next.config.ts] |
| Mass assignment on `addToWishlistFromWearEvent` | Tampering | Zod `.strict()` — reject any keys beyond `wearEventId` (server derives brand/model/imageUrl from the source wear event) |
| Watch-picker ID spoofing (pick another user's watch) | Tampering | `markAsWorn` already enforces `getWatchById(user.id, watchId)` ownership check; picker passes only UUID, server re-resolves. [VERIFIED: src/app/actions/wearEvents.ts lines 28–31] |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `activities_select_own` is still the current SELECT policy on `public.activities` in prod | Pitfalls #1, Standard Stack | LOW — verified via reading the migration file; a follow-up migration between Phase 7 and now that changed it would supersede; planner should `supabase db pull` to confirm |
| A2 | Aggregation across page boundaries is acceptable to display without collapse (edge case) | Pattern 3 / Pitfall 5 | LOW — user-visible quirk only; plan documents the tradeoff |
| A3 | Recommendation slot gets ≥5% perf benefit from `use cache` vs. recomputing per request | Alternatives Considered | MEDIUM — at MVP scale (<500 watches, <10 seed collectors) the overlap computation is cheap. If benchmark shows no gain, skip the cache |
| A4 | Existing `computeTasteOverlap` invocation pattern is fast enough to run 10–20x for "From Collectors Like You" candidate collection | C-03 rationale | MEDIUM — Phase 9 research capped at 500×500; running it against 10–20 seed collectors is ~5M pairs total. If slow, cache per pair |
| A5 | `cacheComponents: true` can be enabled without breaking existing pages (Phase 5–9 shipped without this flag) | Pitfall 12, Wave 0 | LOW-MEDIUM — Next 16 docs say existing code keeps working, but the migration guide warns about `revalidate` / `dynamic` route segment configs. Plan should grep for these before flipping |
| A6 | embla-carousel-react 8.6.0 ships without peer-dep conflicts against React 19.2.4 | Standard Stack | LOW — embla is library-agnostic, no React version pinning in package docs |
| A7 | The WYWT "Add to wishlist" creates a new Watch row directly from `wear_event.metadata`, not via the LLM extractor | W-05 | MEDIUM — CONTEXT.md says snapshot from wear-event metadata. If the planner decides to invoke the LLM extractor for enrichment, that pulls in the Anthropic API key dependency that C-03 explicitly avoids |
| A8 | No existing `timeAgo` / `formatRelative` helper in `src/lib` | Don't Hand-Roll | LOW — planner can grep; if one exists, use it; if not, a 10-line inline helper is sufficient |
| A9 | `watches.id` is safe as the click target for feed rows even when `ON DELETE SET NULL` triggers (i.e., watch was deleted) | F-03 | LOW — the row still renders from metadata snapshot; click target 404s gracefully |

## Open Questions

1. **Should `/watch/[id]` be created in Phase 10 or does it already exist?**
   - What we know: Phase 8 notes "watch detail route" but I did not find `src/app/watch/[id]/page.tsx` in the tree (only `src/app/watch/` was listed — need to verify).
   - What's unclear: is there already a detail page or must the planner create one?
   - Recommendation: Planner greps `src/app/watch/` first; if missing, scope a minimal detail page into Phase 10 (CONTEXT.md C-05, F-03 both click through to watch detail).

2. **App-layer aggregation vs SQL window-function aggregation — which is Phase 10 go-live?**
   - What we know: App-layer is simpler to reason about and test as a pure fn. SQL approach is more robust across page boundaries but harder to debug in a Drizzle codebase where raw SQL fragments mix with the query builder.
   - What's unclear: does the product accept the edge-case "split aggregation" behavior?
   - Recommendation: App-layer for Phase 10; promote to SQL if EXPLAIN ANALYZE shows the feed SELECT is a hot path, OR if QA reports the split behavior is unacceptable.

3. **Is `cacheTag` worth the invalidation complexity on follow/unfollow?**
   - What we know: `cacheLife('minutes')` gives 5-min staleness; recs are not time-critical.
   - What's unclear: does the product want "follow → immediately see them excluded from recs"?
   - Recommendation: Default to no `cacheTag` invalidation. Document the staleness tradeoff in the plan.

4. **Cursor encoding: plain JSON or opaque base64?**
   - What we know: DAL re-enforces privacy, so cursor fabrication can't leak private data.
   - What's unclear: does the team prefer API-style hygiene of opaque cursors?
   - Recommendation: Plain JSON (simpler; matches the project's existing conventions of passing structured data to Server Actions).

## Sources

### Primary (HIGH confidence)

- **Project source (all VERIFIED via direct file read):**
  - `src/db/schema.ts` lines 130–198 — social tables + indexes
  - `src/data/activities.ts` lines 1–20 — existing `logActivity` DAL
  - `src/data/wearEvents.ts` lines 86–101 — `getPublicWearEventsForViewer` (Phase 8 privacy gate)
  - `src/data/follows.ts` — follower list + tasteOverlap data loader patterns
  - `src/data/profiles.ts` — profile + settings DAL shape
  - `src/lib/tasteOverlap.ts` — pure overlap fn to reuse
  - `src/app/page.tsx` — current home page (to be replaced)
  - `src/app/actions/watches.ts` lines 65–76 — `addWatch` + `logActivity` integration (the activity-logging writer pattern)
  - `src/app/actions/wearEvents.ts` lines 39–47 — `markAsWorn` + `logActivity` + `revalidatePath('/')`
  - `src/app/actions/follows.ts` — Server Action structure + Zod `.strict()` pattern
  - `supabase/migrations/20260420000001_social_tables_rls.sql` line 31 — `activities_select_own` current policy; critical blocker for the feed
  - `next.config.ts` — confirms `cacheComponents` NOT enabled
  - `vitest.config.ts` — test environment jsdom + `@` alias

- **Next.js 16 docs bundled in `node_modules/next/dist/docs` (HIGH confidence — authoritative):**
  - `01-app/03-api-reference/01-directives/use-cache.md` — Cache Components semantics, key generation, serialization constraints
  - `01-app/03-api-reference/04-functions/cacheLife.md` — built-in profiles (`minutes` = 5min stale / 1min revalidate / 1hr expire) and client-cache stale semantics
  - `01-app/03-api-reference/04-functions/cacheTag.md` — on-demand invalidation via tags
  - `01-app/03-api-reference/04-functions/refresh.md` — Server-Action-only `refresh()`
  - `01-app/03-api-reference/04-functions/updateTag.md` — read-your-own-writes cache invalidation
  - `01-app/02-guides/migrating-to-cache-components.md` — `revalidate` and `fetchCache` route-segment configs are superseded

- **Research docs (HIGH confidence):**
  - `.planning/research/ARCHITECTURE.md` lines 100–115 (activities schema + metadata snapshot rationale), 337–349 (feed flow), 417–421 (Step 10 home feed)
  - `.planning/research/PITFALLS.md` Pitfalls 1 (RLS), 5 (N+1), 6 (OFFSET), RLS on activities (line 320), own-activity filter (line 363)
  - `.planning/research/FEATURES.md` lines 46 (activity types signal strength), 75 (feed event rate limiting — precedent for F-08)

- **Prior phase contexts (HIGH confidence):**
  - Phase 7 — D-05/D-06 activity logging + metadata snapshot; indexes on activities
  - Phase 8 — D-15 two-layer privacy, D-09 Log Today's Wear flow reused by WYWT
  - Phase 9 — D-06 optimistic UI, D-08 follows never bypass privacy, D-09 hover-swap, D-20 two-layer privacy, tasteOverlap library

### Secondary (MEDIUM confidence — WebSearch + official docs cross-verified)

- Postgres keyset pagination with tuple comparison (Andrew Fisher, Sequin, Cybertec) — HIGH concurrence across 3 sources on `(col1, col2) < ($a, $b)` row-value syntax and DESC semantics
- embla-carousel-react 8.6.0 version verified via `npm view embla-carousel-react version`; npm page confirms React 19 compatibility

### Tertiary (LOW confidence — planner should verify before committing)

- Assumption A8 that no `timeAgo` helper already exists — single-source (absence of evidence is not evidence of absence)
- Assumption A5 that enabling `cacheComponents` doesn't regress existing routes — based on reading the migration guide; actual validation requires a local `npm run build` after enabling the flag

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry + package.json
- Architecture (feed DAL shape, RLS gap, keyset pattern): HIGH — code + migration file + Postgres docs all aligned
- Architecture (Cache Components ergonomics): MEDIUM — Next 16 docs are current but the feature has not been exercised in this codebase yet; Wave 0 flag-enable is a real risk surface
- Pitfalls: HIGH — every pitfall has at minimum one source in research docs and most are re-verified in the current codebase
- Aggregation algorithm (app-layer): HIGH as pure function; MEDIUM on the "split at page boundary" tradeoff being product-acceptable
- Wishlist gap definition: MEDIUM — operationally proposed here; product may want to tune thresholds

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (30 days; Next.js Cache Components is new enough that a point release could change defaults)
