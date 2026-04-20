---
dimension: stack
generated: 2026-04-19
milestone: v2.0 Taste Network Foundation
---
# Stack Research — v2.0 Social Features

**Domain:** Multi-user taste network (profiles, follows, activity feed, Common Ground overlap, privacy controls)
**Researched:** 2026-04-19
**Confidence:** HIGH (core patterns), MEDIUM (Realtime strategy)

> This document covers ONLY what is new or changed for v2.0. The v1.0 foundation (Next.js 16, React 19, Supabase Auth + Postgres, Drizzle ORM, Tailwind 4, Vitest) is validated and not re-researched here.

---

## Summary

The v2.0 social milestone requires three distinct capability additions to the existing stack:

1. **RLS policies** on all public tables, defined in Drizzle schema using `pgPolicy` + Supabase helpers — enforces per-user data isolation and controlled public visibility without a separate auth layer
2. **New Drizzle schema tables** for follows, activity events, and user profile/privacy settings — no new ORM or database needed
3. **A deliberate non-decision on Supabase Realtime** — for an MVP with <200 users on the free tier, server-rendered page loads + router refresh is sufficient; Realtime WebSocket subscriptions are deferred unless UX testing shows users expect live feed updates

No new npm packages are required for the core social data model. One optional package (`swr`) is listed if polling-based feed freshness is needed post-launch. The Common Ground taste overlap feature runs entirely in the existing similarity engine — no new library needed.

---

## Recommended Stack Additions

### RLS Layer (Drizzle + Supabase)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `drizzle-orm/supabase` | Already installed (^0.45.2) | `pgPolicy`, `authenticatedRole`, `authUid()` helpers | Defines RLS policies in TypeScript alongside table definitions; colocated with schema, tracked in migrations — no raw SQL files to maintain separately |
| `drizzle-orm/pg-core` `pgPolicy` | Already installed | Per-table RLS policies | Drizzle now has first-class RLS API; policies compile to Postgres `CREATE POLICY` statements on `drizzle-kit migrate` |

**Pattern:** All new tables get `pgPolicy` definitions in `schema.ts`. The existing `users`, `watches`, and `userPreferences` tables need RLS added in a migration — they currently have no policies (carried from v1.0 backlog item MR-03).

```typescript
// Example: follows table with correct RLS
import { pgPolicy, pgTable, uuid, timestamp, index } from 'drizzle-orm/pg-core'
import { authenticatedRole, authUid } from 'drizzle-orm/supabase'
import { sql } from 'drizzle-orm'
import { users } from './users'

export const follows = pgTable(
  'follows',
  {
    followerId: uuid('follower_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    followingId: uuid('following_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('follows_follower_idx').on(table.followerId),
    index('follows_following_idx').on(table.followingId),
    // Any authenticated user can see follows (needed for follower counts on public profiles)
    pgPolicy('follows_select', {
      for: 'select',
      to: authenticatedRole,
      using: sql`true`,
    }),
    // You can only insert a follow where you are the follower
    pgPolicy('follows_insert', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`${authUid(table.followerId)}`,
    }),
    // You can only delete your own follows
    pgPolicy('follows_delete', {
      for: 'delete',
      to: authenticatedRole,
      using: sql`${authUid(table.followerId)}`,
    }),
  ]
)
```

**Confidence:** HIGH — Drizzle RLS docs confirm `pgPolicy` + `authUid()` API. Supabase confirms RLS is enforced on all Postgres queries including those via Drizzle's `postgres` driver. The `(select auth.uid())` subquery pattern (what `authUid()` generates) is recommended over bare `auth.uid()` for performance — Postgres caches the subquery result within a statement, avoiding repeated function calls when a policy is evaluated across many rows.

---

### New Schema Tables (Drizzle, no new packages)

All implemented in `src/db/schema.ts` using existing Drizzle + postgres imports.

**`follows`** — collector-to-collector follow graph
- `follower_id` (FK → users.id), `following_id` (FK → users.id), `created_at`
- Composite unique on `(follower_id, following_id)` to prevent duplicate follows
- Indexes on both FKs for follower/following count queries

**`user_profiles`** — public display name, bio, avatar URL; separate from `users` shadow table
- `user_id` (FK → users.id, unique), `display_name`, `bio`, `avatar_url`, `created_at`, `updated_at`
- RLS: select = authenticated users can see all profiles; insert/update = owner only

**`user_privacy_settings`** — controls what each user exposes publicly
- `user_id` (FK → users.id, unique), `profile_public` (bool), `collection_public` (bool), `wishlist_public` (bool), `wear_public` (bool), `created_at`, `updated_at`
- RLS: select = owner OR querying user has `service_role` (or policies join-check); insert/update = owner only
- Default: all public (opt-out model matches Rdio-style discovery vision)

**`activity_events`** — append-only event log for network feed
- `id` (uuid), `user_id` (FK), `event_type` (enum: `watch_added`, `watch_sold`, `wishlist_added`, `worn_today`, `notes_updated`), `watch_id` (FK, nullable), `metadata` (jsonb for extra context), `created_at`
- No updates, no deletes — append-only. Soft-hide via `visibility` column if needed.
- RLS select policy: `user_id = auth.uid()` OR `user_id IN (SELECT following_id FROM follows WHERE follower_id = auth.uid())`
- Index on `(user_id, created_at DESC)` for feed queries

**Note on feed RLS performance:** The "current user can see events from people they follow" RLS policy joins the `follows` table on every row authorization check. At MVP scale (<200 users, <500 events/user), this is fine. At scale this pattern requires either a denormalized `allowed_user_ids` array on each event row, a Postgres function with `SECURITY DEFINER` to cache the following set, or moving to application-layer feed assembly. Flag this for review if the user base grows beyond 1,000.

---

### Common Ground Taste Overlap (No New Library)

The existing `analyzeSimilarity()` function in `src/lib/similarity.ts` already computes weighted overlap across style tags, role tags, design traits, complications, and dial color. Common Ground is a projection of this engine onto two users' collections instead of one watch vs. a collection.

**Implementation approach:** Write a new pure function `computeCommonGround(collectionA: Watch[], collectionB: Watch[], preferences: UserPreferences): CommonGroundResult` that:
1. Runs `analyzeSimilarity` for each watch in B against collection A
2. Aggregates `SimilarityLabel` distribution
3. Returns: shared brands, shared style tags, shared role tags, percentage overlap by dimension, top matching watch pairs

No new library needed. This is client-safe computation (same pattern as the existing engine). The function receives data as props — no store reads.

**Confidence:** HIGH — the existing engine is structurally capable of this. The design question (what to surface in the UI) is a product decision, not a technical one.

---

### Activity Feed Delivery Strategy

**Recommendation: Server-rendered + Next.js `router.refresh()` for MVP. Do NOT add Supabase Realtime subscriptions in v2.0.**

Rationale:

1. **Free tier limit:** Supabase free tier supports 200 concurrent Realtime WebSocket connections. If every visitor to a profile page opens a subscription, that ceiling is hit with ~100 simultaneous users. For a personal app opening to a small collector community, this is an acceptable risk — but it makes Realtime a cost driver earlier than expected.

2. **Realtime Postgres Changes has a known scaling bottleneck:** Every row change triggers an authorization check against RLS for every subscribed client. 100 subscribers to one table = 100 auth reads per insert. Supabase's own docs flag this as a single-thread process where "compute upgrades don't have a large effect on performance."

3. **Activity feeds are not latency-sensitive in this product.** The Rdio-inspired model is discovery-driven, not notification-driven. A feed that refreshes on page visit (or on a 30-60s interval) delivers the same experience as a live-updating feed for this use case.

4. **Simpler implementation:** Server Component fetch on every route visit means no client-side subscription lifecycle, no `useEffect` cleanup, no auth token refresh in the WebSocket layer, and no delta-merge logic in the client.

**If polling freshness is needed post-launch** (i.e., users expect the feed to update while they're on the page), add `swr` with `refreshInterval`:

```bash
npm install swr
```

Use `useSWR` with a `refreshInterval: 30000` in a client component wrapper around the feed. This keeps the feed fresh without WebSocket complexity and works fine on Vercel's serverless functions.

**Defer Supabase Realtime to v3.0** if user research shows that live updates are expected. At that point, the correct pattern is: use Broadcast (not Postgres Changes) — the application writes to the activity_events table AND broadcasts to a named channel. Subscribers receive Broadcast messages (which bypass per-row RLS auth overhead) and refresh their local state. This decouples delivery from authorization cost.

**Confidence:** MEDIUM — the polling/refresh recommendation is based on sound analysis of the free tier limits and Supabase Realtime's known scaling constraints (both documented in official Supabase docs). Whether users will tolerate a non-live feed is a product assumption that should be validated.

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Supabase Realtime (Postgres Changes) in v2.0 | Free tier ceiling at 200 concurrent connections; per-row RLS auth check on every event is a single-thread bottleneck; activity feeds are not latency-sensitive for this product | Server Component renders + `router.refresh()` on mutation; `swr` polling if needed |
| A dedicated graph database (Neo4j, etc.) | Overkill for a follow graph with <10,000 users; Postgres handles social graphs up to millions of edges with proper indexing | Postgres `follows` table with indexed FKs |
| Redis for feed caching | Unnecessary at MVP scale (<500 watches/user, <200 users); premature infrastructure | Application-layer assembly from `activity_events` on each page load |
| Fan-out-on-write feed materialization | Fan-out requires background workers; adds infrastructure; only necessary above ~10K follower counts | Fan-out-on-read: query `activity_events WHERE user_id IN (following list)` at read time |
| TanStack Query / React Query | No existing usage in codebase; adds bundle weight; the existing Server Component + Server Action pattern is sufficient for all data operations | Stick with Server Components for reads, Server Actions for mutations; add `swr` only if polling freshness is needed |
| Socket.io or custom WebSocket server | Supabase Realtime already provides this if/when needed; a custom WebSocket layer adds significant ops complexity | Supabase Realtime Broadcast when real-time delivery is required |
| `@supabase/realtime-js` direct import | Already included transitively via `@supabase/supabase-js`; importing directly bypasses the auth-aware client setup | Use `supabase.channel()` via the existing `@supabase/supabase-js` client |
| Separate profile microservice | No separation of concerns problem at this scale; profiles are just another Postgres table | `user_profiles` table in existing Supabase project |

---

## RLS Policy Patterns for Social Visibility

The following table covers each data type and the correct RLS policy shape. All policies use `(select auth.uid())` subquery form for performance.

| Table | Who Can SELECT | Who Can INSERT | Who Can UPDATE | Who Can DELETE |
|-------|---------------|----------------|----------------|----------------|
| `users` | Owner only | System (on signup trigger) | Owner only | None (Supabase Auth owns deletion) |
| `watches` | Owner only OR owner's `collection_public = true` AND requester is authenticated | Owner only | Owner only | Owner only |
| `user_preferences` | Owner only | Owner only | Owner only | None |
| `user_profiles` | Any authenticated user | Owner only (one row per user) | Owner only | Owner only |
| `user_privacy_settings` | Owner only | Owner only | Owner only | None |
| `follows` | Any authenticated user (needed for follow counts) | Owner (follower_id = auth.uid()) | None (delete + re-insert for changes) | Owner (follower_id = auth.uid()) |
| `activity_events` | Owner OR following the owner | Owner only (system-written via Server Action) | None (append-only) | Owner only |

**Implementation note:** The `watches` visibility policy requires a join to `user_privacy_settings`. Write this as a `SECURITY DEFINER` function to avoid RLS recursion and performance issues from joining inside a policy expression:

```sql
-- Create helper function (in a Drizzle raw SQL migration)
CREATE OR REPLACE FUNCTION user_collection_is_public(owner_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT coalesce(collection_public, true) -- default public
  FROM user_privacy_settings
  WHERE user_id = owner_id
$$;

-- Then reference in pgPolicy using sql`` template
pgPolicy('watches_select', {
  for: 'select',
  to: authenticatedRole,
  using: sql`user_id = (select auth.uid()) OR user_collection_is_public(user_id)`,
})
```

**Confidence:** HIGH — the SECURITY DEFINER function pattern for cross-table RLS is documented in Supabase official docs as the recommended approach for policies that depend on other tables.

---

## Integration with Existing DAL + Server Actions

No architectural change needed. The existing pattern holds:

- **DAL functions** (`src/data/*.ts`) add new query functions for follows, profiles, activity events
- **Server Actions** write to `follows` and `activity_events` tables and call `router.refresh()` after mutations — no Realtime push needed
- **Server Components** fetch profile + collection data in parallel using `Promise.all()` — this is where Common Ground computation happens (server-side, data passed as props to client components)
- **`proxy.ts`** — no changes needed; all new routes use the same auth enforcement pattern

The one new integration point: **activity event logging**. Every Server Action that mutates watch state (add, status change, mark worn) should also `INSERT` into `activity_events`. This is an additive side-effect — no existing action signatures change.

---

## Installation

```bash
# No new runtime packages required for core social features.
# RLS, schema tables, and Common Ground use existing installed packages.

# Optional: add only if polling-based feed freshness is needed post-launch
npm install swr
```

---

## Version Compatibility

| Package | Version | Notes |
|---------|---------|-------|
| `drizzle-orm` | ^0.45.2 (installed) | `pgPolicy` + `authUid()` from `drizzle-orm/supabase` available since ~0.38; confirmed in 0.45.x |
| `drizzle-kit` | ^0.31.10 (installed) | Generates `CREATE POLICY` SQL from `pgPolicy` definitions on migrate; verified working in 0.31.x |
| `@supabase/supabase-js` | ^2.103.0 (installed) | Realtime client bundled; no separate install needed if Realtime is added later |
| `@supabase/ssr` | ^0.10.2 (installed) | No change needed; auth-aware client pattern unchanged for social routes |
| `swr` | ^2.3.x (not installed) | Add only if polling is needed; compatible with React 19 and Next.js 16 App Router |

---

## Sources

- Drizzle ORM RLS docs — `pgPolicy`, `authUid()`, `authenticatedRole` API confirmed: https://orm.drizzle.team/docs/rls
- Supabase Realtime Postgres Changes docs — RLS interaction, scaling limitations, concurrent connection limits: https://supabase.com/docs/guides/realtime/postgres-changes
- Supabase free tier: 200 concurrent Realtime connections confirmed: https://supabase.com/docs/guides/realtime/limits
- Supabase RLS docs — SECURITY DEFINER function pattern for cross-table policies: https://supabase.com/docs/guides/database/postgres/row-level-security
- Neon blog — Drizzle + social network RLS modeling (MEDIUM confidence — Neon-specific framing but pattern is Postgres-standard): https://neon.com/blog/modelling-authorization-for-a-social-network-with-postgres-rls-and-drizzle-orm
- MakerKit real-time notifications guide — initial data + subscription merge pattern: https://makerkit.dev/blog/tutorials/real-time-notifications-supabase-nextjs

---
*Stack research for: Horlo v2.0 Taste Network Foundation — social features only*
*Researched: 2026-04-19*
