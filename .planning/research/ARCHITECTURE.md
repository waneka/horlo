# Architecture Research

**Domain:** Multi-user social layer on top of existing Next.js 16 + Supabase Auth + Drizzle ORM app
**Researched:** 2026-04-19
**Confidence:** HIGH (existing codebase is the primary source of truth; patterns derived from what's already built)

---

## Standard Architecture

### System Overview

```
┌────────────────────────────────────────────────────────────────────┐
│  BROWSER                                                           │
│  ┌──────────────┐  ┌─────────────────┐  ┌──────────────────────┐  │
│  │ Server Pages │  │ Client Islands  │  │   Zustand (filters)  │  │
│  │ (RSC, async) │  │ ('use client')  │  │   31 lines, ephemeral│  │
│  └──────┬───────┘  └────────┬────────┘  └──────────────────────┘  │
├─────────┼───────────────────┼────────────────────────────────────  ┤
│  SERVER (Next.js edge + Node runtime)                              │
│         │                  │                                       │
│  ┌──────▼────────┐  ┌──────▼──────────┐                           │
│  │  proxy.ts     │  │  Server Actions │  (mutations only)         │
│  │  (middleware) │  │  src/app/actions│                            │
│  └──────┬────────┘  └──────┬──────────┘                           │
│         │                  │                                       │
│  ┌──────▼──────────────────▼──────────────────────────────────┐   │
│  │  DAL  src/data/*.ts   (server-only, getCurrentUser() scope) │   │
│  └──────────────────────────────────┬───────────────────────── ┘  │
├───────────────────────────────────── ┼──────────────────────────── ┤
│  SUPABASE                            │                             │
│  ┌───────────────┐  ┌───────────────▼──────────────────────────┐  │
│  │  Auth         │  │  Postgres (Drizzle ORM)                   │  │
│  │  (JWT/session)│  │  users, watches, user_preferences, ...new │  │
│  └───────────────┘  └──────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

### Existing Component Responsibilities

| Component | Responsibility | Location |
|-----------|---------------|----------|
| `proxy.ts` | Middleware: refreshes Supabase session cookie, redirects unauthenticated requests. PUBLIC_PATHS list controls which routes are open. | `src/proxy.ts` |
| DAL functions | Server-only data access, always scoped by `userId`. Two files: `data/watches.ts`, `data/preferences.ts`. | `src/data/` |
| Server Actions | Validated mutations: call `getCurrentUser()`, call DAL, `revalidatePath()`, return `ActionResult<T>`. | `src/app/actions/` |
| `getCurrentUser()` | Reads Supabase Auth session server-side. Throws `UnauthorizedError` if no session. | `src/lib/auth.ts` |
| Page components | Async Server Components: call `getCurrentUser()` then DAL, pass data as props to Client Islands or Server-rendered children. | `src/app/*/page.tsx` |
| Zustand store | Ephemeral UI state only: active filter selections. Not persisted. Not used for server data. | `src/store/watchStore.ts` |
| `src/db/schema.ts` | Drizzle schema — single source of truth for table shapes. | `src/db/schema.ts` |

---

## New DB Tables Needed

### `profiles` table
Extends `users` with public-facing identity. One row per user, created on signup.

```
profiles
  id         uuid PK → users.id
  username   text NOT NULL UNIQUE          -- URL-safe, chosen at signup or auto-generated
  bio        text
  avatarUrl  text
  createdAt  timestamptz
  updatedAt  timestamptz
```

Index: `profiles_username_idx` on `username` (lookup by slug in route `[username]`).

### `follows` table
Directed graph: follower → following. No self-follows enforced at DB level (app layer check sufficient for MVP).

```
follows
  id          uuid PK defaultRandom()
  followerId  uuid NOT NULL → users.id CASCADE
  followingId uuid NOT NULL → users.id CASCADE
  createdAt   timestamptz defaultNow()

UNIQUE (follower_id, following_id)
```

Indexes: `follows_follower_idx` on `followerId`, `follows_following_idx` on `followingId`.

### `profile_settings` table
Privacy controls. One row per user, defaults to open (private = false).

```
profile_settings
  userId              uuid PK → users.id CASCADE
  profilePublic       boolean NOT NULL DEFAULT true
  collectionPublic    boolean NOT NULL DEFAULT true
  wishlistPublic      boolean NOT NULL DEFAULT true
  wornPublic          boolean NOT NULL DEFAULT true
  notesPublic         boolean NOT NULL DEFAULT false   -- notes more sensitive, default off
  updatedAt           timestamptz
```

### `activities` table
Append-only event log. Powers the home feed. Never updated, only inserted and read.

```
activities
  id         uuid PK defaultRandom()
  userId     uuid NOT NULL → users.id CASCADE     -- actor
  type       text NOT NULL  -- enum: 'watch_added' | 'watch_wishlisted' | 'watch_sold' | 'wear_logged' | 'note_added'
  watchId    uuid → watches.id SET NULL           -- nullable: watch may be deleted
  metadata   jsonb                                -- snapshot fields at event time (brand, model, imageUrl)
  createdAt  timestamptz defaultNow() NOT NULL
```

Indexes: `activities_user_id_idx` on `userId`, `activities_created_at_idx` on `createdAt DESC`.

**Why snapshot metadata matters:** watches can be deleted; the activity feed must remain readable. Store `{ brand, model, imageUrl }` in `metadata` at write time so the feed renders even if the watch row is gone.

### `wear_events` table
Tracks daily wear (WYWT). Enforces one event per watch per day at the DB level.

```
wear_events
  id        uuid PK defaultRandom()
  userId    uuid NOT NULL → users.id CASCADE
  watchId   uuid NOT NULL → watches.id CASCADE
  wornDate  date NOT NULL
  note      text
  createdAt timestamptz defaultNow()

UNIQUE (user_id, watch_id, worn_date)
```

Index: `wear_events_user_date_idx` on `(userId, wornDate DESC)`.

Note: `watches.lastWornDate` (text field) currently stores the last worn date. `wear_events` is the proper normalized table for the social milestone. The `lastWornDate` column on `watches` can be maintained via trigger or updated in the Server Action as a denormalized cache.

---

## New Route Segments

### Public profile routes — require proxy.ts update

Currently `proxy.ts` treats all non-`PUBLIC_PATHS` routes as auth-required. Collector profiles need to be readable without login (or optionally gated — decision for roadmap).

**Option A (recommended for MVP):** Make `/u/[username]` a public path so unauthenticated visitors can view profiles. The page itself checks `profile_settings.profilePublic` and shows a reduced view if private. Follow/unfollow actions require auth and use Server Actions that call `getCurrentUser()`.

**Option B:** Keep all routes auth-required. Simpler, but reduces shareability. Defer to later.

Add to `PUBLIC_PATHS` in `proxy.ts`:
```
'/u/',   // collector profiles — public by default per product vision
```

### Route map

```
src/app/
├── page.tsx                    MODIFY — becomes activity feed for logged-in users
│                                        keep collection view as fallback or separate tab
├── u/
│   └── [username]/
│       └── page.tsx            NEW — collector profile (self or other)
│           tab routing via ?tab= query param (Collection, Wishlist, Worn, Notes, Stats)
├── settings/
│   └── page.tsx                NEW — privacy controls, profile edit
└── actions/
    ├── follows.ts              NEW — follow / unfollow Server Actions
    ├── activities.ts           NEW — logActivity helper (called by existing watch actions)
    └── profile.ts              NEW — updateProfile, updatePrivacySettings
```

### Self-profile redirect
`/profile` → redirect to `/u/[current-username]`. Avoids hardcoding the username in nav links.

---

## New DAL Functions

### `src/data/profiles.ts`

```typescript
getProfileByUsername(username: string): Promise<Profile | null>
getProfileById(userId: string): Promise<Profile | null>
createProfile(userId: string, data: Omit<Profile, 'id' | 'createdAt' | 'updatedAt'>): Promise<Profile>
updateProfile(userId: string, data: Partial<Profile>): Promise<Profile>
getPrivacySettings(userId: string): Promise<ProfileSettings>
upsertPrivacySettings(userId: string, data: Partial<ProfileSettings>): Promise<ProfileSettings>
```

### `src/data/follows.ts`

```typescript
followUser(followerId: string, followingId: string): Promise<void>
unfollowUser(followerId: string, followingId: string): Promise<void>
isFollowing(followerId: string, followingId: string): Promise<boolean>
getFollowers(userId: string): Promise<Profile[]>
getFollowing(userId: string): Promise<Profile[]>
getFollowerCount(userId: string): Promise<number>
getFollowingCount(userId: string): Promise<number>
```

### `src/data/activities.ts`

```typescript
logActivity(userId: string, type: ActivityType, watchId: string | null, metadata: Record<string, unknown>): Promise<void>
getFeedForUser(userId: string, limit: number): Promise<Activity[]>
// getFeedForUser fetches activities from users that userId follows, ordered by createdAt DESC
getUserActivities(userId: string, limit: number): Promise<Activity[]>
```

### `src/data/wearEvents.ts`

```typescript
logWearEvent(userId: string, watchId: string, wornDate: string, note?: string): Promise<WearEvent>
getWearEventsByUser(userId: string): Promise<WearEvent[]>
getWearEventsByWatch(userId: string, watchId: string): Promise<WearEvent[]>
getRecentWornByFollowing(userId: string, limit: number): Promise<WearEventWithProfile[]>
```

---

## New Server Actions

### `src/app/actions/follows.ts`

```typescript
'use server'

followCollector(targetUserId: string): Promise<ActionResult<void>>
// calls getCurrentUser(), followUser(user.id, targetUserId), revalidatePath('/u/[username]')

unfollowCollector(targetUserId: string): Promise<ActionResult<void>>
// calls getCurrentUser(), unfollowUser(user.id, targetUserId), revalidatePath('/u/[username]')
```

### `src/app/actions/profile.ts`

```typescript
'use server'

updateProfile(data: Partial<Profile>): Promise<ActionResult<Profile>>
updatePrivacySettings(data: Partial<ProfileSettings>): Promise<ActionResult<ProfileSettings>>
```

### Modification to existing `src/app/actions/watches.ts`

After `watchDAL.createWatch()` succeeds, call `logActivity()`:

```typescript
// inside addWatch(), after const watch = await watchDAL.createWatch(...)
await logActivity(user.id, 'watch_added', watch.id, {
  brand: watch.brand,
  model: watch.model,
  imageUrl: watch.imageUrl ?? null,
})
```

Same pattern for `editWatch()` on status transitions and `removeWatch()`. Keep activity logging fire-and-forget (don't fail the action if logging fails — wrap in try/catch separately).

---

## Modified Components

### `src/proxy.ts` — add `/u/` to PUBLIC_PATHS

### `src/app/page.tsx` — transform home page

Currently: renders `CollectionView` directly.
After: render activity feed for authenticated users; still support unauthenticated redirect via proxy.ts.

### `src/components/layout/Header.tsx` — add profile link

Add link to `/u/[username]` and `/settings` in the nav once profile exists.

### `src/app/actions/watches.ts` — add activity logging

Log `watch_added`, `watch_wishlisted`, `watch_sold` events after successful mutations.

---

## Common Ground (Taste Overlap)

The existing `analyzeSimilarity()` function in `src/lib/similarity.ts` runs entirely in the browser and takes `(targetWatch, collection, preferences)`. For Common Ground on a collector profile, we need a server-side version that compares two users' collections.

**Approach:** Create `src/lib/tasteOverlap.ts` as a server-compatible (no browser APIs) function:

```
computeTasteOverlap(userA: { watches, preferences }, userB: { watches, preferences }): TasteOverlapResult

TasteOverlapResult {
  sharedBrands: string[]
  sharedStyles: string[]
  sharedRoles: string[]
  overlapScore: number        // 0-1
  topSharedWatches: Watch[]   // watches both users own (matched by brand+model, not watch ID)
  label: string               // "Strong overlap" | "Some common ground" | "Different tastes"
}
```

This runs on the server in the collector profile page component:

```typescript
// src/app/u/[username]/page.tsx (simplified)
export default async function CollectorProfilePage({ params }) {
  const { username } = await params
  const currentUser = await tryGetCurrentUser()          // null if unauthenticated
  const profile = await getProfileByUsername(username)
  if (!profile) notFound()

  const theirWatches = await getPublicWatchesByUser(profile.userId, settings)
  const overlap = currentUser
    ? computeTasteOverlap(
        { watches: await getWatchesByUser(currentUser.id), preferences: await getPreferencesByUser(currentUser.id) },
        { watches: theirWatches, preferences: await getPublicPreferencesByUser(profile.userId) }
      )
    : null

  return <CollectorProfileView profile={profile} watches={theirWatches} overlap={overlap} isOwnProfile={currentUser?.id === profile.userId} />
}
```

`getPublicWatchesByUser` is a new DAL function that applies privacy settings before returning data. It differs from `getWatchesByUser` (which is always-own-user scoped) by checking `profile_settings` and only returning watches if `collectionPublic = true`.

---

## Data Flow Changes

### Follow / Unfollow

```
FollowButton (client) → followCollector() Server Action
  → getCurrentUser() [auth check]
  → followUser(followerId, followingId) [DAL]
  → revalidatePath('/u/[username]')
  → return ActionResult
```

### Activity Feed (Home Page)

```
Home page (RSC, async)
  → getCurrentUser()
  → getFeedForUser(user.id, limit=50)
      → SELECT activities JOIN users JOIN profiles
        WHERE activities.user_id IN (
          SELECT following_id FROM follows WHERE follower_id = $userId
        )
        ORDER BY created_at DESC
        LIMIT $limit
  → render ActivityFeed (Server Component, no client state needed)
```

### Collector Profile (Other User)

```
/u/[username] (RSC, async)
  → getProfileByUsername(username)
  → getPrivacySettings(profile.userId)
  → getPublicWatchesByUser(profile.userId, settings)
  → isFollowing(currentUser.id, profile.userId)  [if authenticated]
  → computeTasteOverlap(...)                      [if authenticated]
  → render CollectorProfileView (passes data as props; follow button is client island)
```

### Privacy Check Pattern

Privacy is enforced at the DAL level, not the route level. DAL functions that return other users' data accept a `ProfileSettings` argument and filter accordingly. This means:
- Route handlers don't need to know about privacy rules
- Privacy rules are in one place (the DAL)
- RLS in Supabase is a second line of defense (defense in depth)

```typescript
// src/data/watches.ts — new public-access function
export async function getPublicWatchesByUser(
  targetUserId: string,
  settings: ProfileSettings
): Promise<Watch[]> {
  if (!settings.collectionPublic) return []
  const rows = await db.select().from(watches).where(eq(watches.userId, targetUserId))
  return rows.map(mapRowToWatch)
}
```

---

## Recommended Build Order

Dependencies flow bottom-up. Build in this order to avoid blocking work and to have testable increments at each step.

### Step 1 — RLS (prerequisite, unblocks everything)
Enable Row Level Security on `watches`, `user_preferences`, `users`. Without RLS, the privacy controls we build in the DAL have no database-level safety net. This is the carried item from v1.0 (MR-03). Block all multi-user work on this.

### Step 2 — DB Schema + Drizzle Migrations
Add `profiles`, `follows`, `profile_settings`, `activities`, `wear_events` tables. Run migrations in staging first. No app code changes needed yet.

### Step 3 — Profile Auto-Creation
Add a Supabase Auth webhook or trigger to create a `profiles` row (and `profile_settings` row with defaults) when a user signs up. This is the foundation every other feature reads from.

For existing users: create a one-time migration script that inserts `profiles` rows from existing `users` rows, using email prefix as username (sanitized, deduplicated).

### Step 4 — Profile DAL + Settings Action
`src/data/profiles.ts`, `src/app/actions/profile.ts`. Build and test in isolation. No UI yet.

### Step 5 — Self Profile Page (`/u/[username]`)
Server Component page with tabs: Collection, Wishlist, Worn, Notes, Stats. Reuses existing `WatchGrid`, `WatchCard`. This is the identity surface; ship it before exposing other users' profiles.

### Step 6 — Privacy Settings Page (`/settings`)
`updatePrivacySettings` action + settings UI. Required before making collector profiles publicly visible.

### Step 7 — Follow System (DAL + Actions + UI)
`src/data/follows.ts` + `src/app/actions/follows.ts`. Add `FollowButton` client component. Add follower/following counts to profile header.

Update `proxy.ts` to allow `/u/` without auth at this step (profiles are now public).

### Step 8 — Collector Profile Page (Other User View)
Read-only profile view with privacy enforcement. Includes Common Ground (`src/lib/tasteOverlap.ts`).

### Step 9 — Activity Logging in Existing Actions
Add `logActivity()` calls to `watches.ts` Server Actions. Non-breaking — activities table is append-only and optional.

### Step 10 — Home Page Activity Feed
Replace or augment `src/app/page.tsx`. For users with no follows, show collection view (current behavior) as fallback. For users with follows, show feed above collection.

---

## Architecture Patterns to Follow

### Pattern 1: DAL owns all cross-user data access

The existing pattern scopes all DAL functions by `userId` from the session. For social features, some functions must read other users' data. Keep the distinction clear by naming:

- `getWatchesByUser(userId)` — own data only, no privacy check needed (you own it)
- `getPublicWatchesByUser(targetUserId, settings)` — other users' data, privacy enforced
- Never put the privacy check in the page component or Server Action; it belongs in the DAL

### Pattern 2: Server Actions never read other users' session data

Server Actions call `getCurrentUser()` to get the actor. When an action involves another user (e.g., follow), the target user ID comes from the form/params, not from a session read. The DAL validates that the follow relationship makes sense (no self-follow).

### Pattern 3: Activity logging is fire-and-forget

Activity writes must not block or fail the primary mutation. Wrap in a separate try/catch inside the Server Action:

```typescript
// After successful watch creation:
try {
  await logActivity(user.id, 'watch_added', watch.id, { brand: watch.brand, model: watch.model })
} catch (err) {
  console.error('[addWatch] activity log failed (non-fatal):', err)
  // do NOT return failure — the watch was created successfully
}
```

### Pattern 4: Profiles are created out-of-band from the app

Don't create the `profiles` row inside a Server Action that the user triggers. Use Supabase Auth webhooks or a DB trigger on `auth.users` insert. This means profiles always exist before the user hits any page.

### Pattern 5: Parallel routes vs. tab segments for profile tabs

The profile has 5 tabs (Collection, Wishlist, Worn, Notes, Stats). Options:

- **Tab segments (recommended):** Single page component renders all tabs, active tab controlled by a `tab` query param. Simpler, fewer files, works well with Server Components since each tab's data can be fetched conditionally.
- **Parallel routes:** More Next.js-idiomatic for true independent tab loading, but adds file count and complexity.

For MVP, implement as a single page with a `tab` query param and conditional data fetching. Each tab renders its own Server Component sub-tree.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing privacy checks in middleware

**What people do:** Add privacy logic to `proxy.ts` (e.g., "if route is `/u/[username]` and profile is private, redirect").

**Why it's wrong:** Middleware runs before the page and can't know the `profilePublic` value without a DB call. Makes middleware slow, pollutes auth logic with business rules, and creates a maintenance nightmare.

**Do this instead:** Let the page render, check `profile_settings` in the DAL, and return a "private profile" view from the Server Component.

### Anti-Pattern 2: Fetching feed in a Client Component

**What people do:** Move the activity feed to a Client Component and fetch it client-side via a `useEffect` or SWR.

**Why it's wrong:** The existing architecture is Server Components for all data-heavy pages. Introducing client-side data fetching for the home page breaks the pattern, adds loading states, and makes the page harder to cache.

**Do this instead:** Fetch the feed in the Server Component (`page.tsx`), pass as props.

### Anti-Pattern 3: Using watch IDs to match "shared" watches in Common Ground

**What people do:** Query `SELECT * FROM watches WHERE id IN (both users' watch IDs)` to find overlap.

**Why it's wrong:** Each user's watch entries are independent UUIDs. Two people owning a "Rolex Submariner 124060" have different `watch.id` values. There is no canonical watch ID in v2.0.

**Do this instead:** Match on normalized `(brand, model)` pairs. The `tasteOverlap` function should normalize brand/model strings (lowercase, trim) before comparing.

### Anti-Pattern 4: Logging activities inside the DAL

**What people do:** Call `logActivity()` from inside `createWatch()` in the DAL.

**Why it's wrong:** The DAL is a pure data access layer — it shouldn't have cross-cutting concerns like event logging. The DAL also doesn't know the context of why the mutation happened.

**Do this instead:** Log activities in the Server Action, after the DAL call succeeds.

### Anti-Pattern 5: Making `follows` a symmetric relationship

**What people do:** Insert two rows on follow (A→B and B→A) or use a `friends` model.

**Why it's wrong:** The product model is asymmetric follows (Twitter/Rdio style), not mutual friendship. Symmetric storage doubles writes and complicates queries.

**Do this instead:** One row per directed edge: `{ followerId, followingId }`. Followers = rows where `followingId = userId`. Following = rows where `followerId = userId`.

---

## RLS Policy Design

RLS is a prerequisite. Policies needed:

**`watches` table:**
- Owners: full access where `user_id = auth.uid()`
- Others: SELECT only if `profile_settings.collection_public = true` for that user (requires a Postgres function `is_collection_public(user_id uuid)`)

**`user_preferences` table:**
- Owners: full access
- Others: no access (preferences are private; `tasteOverlap` runs as the app's service role)

**`profiles` table:**
- Owners: full access
- Others: SELECT always (profiles are public identifiers)

**`follows` table:**
- Actors: INSERT/DELETE where `follower_id = auth.uid()`
- Read: SELECT for all (follower/following counts are public)

**`activities` table:**
- Actors: INSERT where `user_id = auth.uid()`
- Read: SELECT for followers (complex policy — easier to use service role in DAL and enforce in app layer)

**`profile_settings` table:**
- Owners: full access
- Others: SELECT only (so the app can check visibility)

---

## Integration Points Summary

| Existing File | Change Type | What Changes |
|---------------|-------------|--------------|
| `src/proxy.ts` | Modify | Add `/u/` to `PUBLIC_PATHS` |
| `src/app/page.tsx` | Modify | Add activity feed section for authenticated users with follows |
| `src/app/actions/watches.ts` | Modify | Add `logActivity()` calls after successful mutations |
| `src/components/layout/Header.tsx` | Modify | Add profile and settings nav links |
| `src/db/schema.ts` | Extend | Add 5 new tables |
| `src/lib/auth.ts` | No change | `getCurrentUser()` unchanged |
| `src/lib/types.ts` | Extend | Add `Profile`, `ProfileSettings`, `Activity`, `Follow`, `WearEvent` types |
| `src/lib/similarity.ts` | No change | Stays client-side for self-analysis; `tasteOverlap.ts` is new server-side file |

| New File | Purpose |
|----------|---------|
| `src/data/profiles.ts` | Profile + settings DAL |
| `src/data/follows.ts` | Follow graph DAL |
| `src/data/activities.ts` | Activity log DAL + feed query |
| `src/data/wearEvents.ts` | Wear event DAL |
| `src/app/actions/follows.ts` | follow/unfollow Server Actions |
| `src/app/actions/profile.ts` | Profile + privacy Server Actions |
| `src/app/u/[username]/page.tsx` | Collector profile page |
| `src/app/settings/page.tsx` | Privacy settings page |
| `src/lib/tasteOverlap.ts` | Common Ground computation (server-safe, no browser APIs) |
| `src/components/profile/` | Profile-specific UI components |
| `src/components/activity/` | Activity feed UI components |
| `src/components/social/FollowButton.tsx` | Client island for follow/unfollow |

---

## Scaling Considerations

| Scale | Consideration |
|-------|--------------|
| Less than 100 users (current) | All patterns above are fine. Single Supabase instance, no caching needed. |
| 100-10k users | Activity feed query (JOIN across follows + activities) may need the `activities_created_at_idx` index and a reasonable LIMIT (50 is fine). Monitor slow queries in Supabase dashboard. |
| 10k+ users | Fan-out on write for activity feed (pre-compute per-follower feeds) becomes relevant, but this is far beyond MVP scope. Defer. |

The `<500 watches per user` constraint means the Common Ground computation (`tasteOverlap`) is always bounded at 500x500 = 250k comparisons max, which is fast enough in-process on the server. No caching needed at MVP scale.

---

## Sources

- Existing codebase read directly: `src/proxy.ts`, `src/lib/auth.ts`, `src/data/watches.ts`, `src/data/preferences.ts`, `src/db/schema.ts`, `src/app/actions/watches.ts` (HIGH confidence)
- `.planning/PROJECT.md` — milestone requirements and constraints (HIGH confidence)
- `.planning/PRODUCT-BRIEF.md` — product vision, page and flow definitions (HIGH confidence)
- Next.js 16 App Router Server Components + Server Actions pattern — consistent with existing codebase (HIGH confidence)
- Drizzle ORM pattern — consistent with existing DAL files (HIGH confidence)

---
*Architecture research for: Horlo v2.0 — Multi-user taste network social layer*
*Researched: 2026-04-19*
