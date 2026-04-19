# Project Research Summary

**Project:** Horlo — v2.0 Taste Network Foundation
**Domain:** Social collection platform — multi-user taste graph layered on an existing single-user collector tool
**Researched:** 2026-04-19
**Confidence:** HIGH (overall — primary sources are official docs and the existing codebase)

## Executive Summary

Horlo v2.0 adds a social taste network to an established single-user watch collection app. The existing technical foundation (Next.js 16 App Router, Supabase Auth + Postgres, Drizzle ORM, Server Components + Server Actions) is solid and does not need to change. The entire social layer — follows, profiles, activity feed, and Common Ground taste overlap — can be built by extending the existing DAL pattern with new tables and new route segments. No new major dependencies are required; the only optional addition is `swr` for polling-based feed freshness if post-launch UX testing demands it.

The recommended build order is dictated by a hard dependency chain: RLS on all existing tables must land first (a carry-forward from v1.0 that blocks all multi-user visibility), then the new schema tables, then the profile and privacy surfaces, then follows, then the activity feed and Common Ground. Horlo has a structural differentiator that no competitor (Letterboxd, Goodreads, Discogs) has shipped natively: a semantic similarity engine already built. Common Ground taste overlap between two collectors should ship in v2.0 and is computed server-side using the existing `analyzeSimilarity()` logic — it is not a stretch goal.

The dominant risk for this milestone is RLS misconfiguration. There are four distinct failure modes that are silent, hard to detect in the Supabase SQL Editor, and potentially catastrophic (data invisible to owners, private data exposed to others, row ownership injection). Every pitfall in the research maps back to the Phase 1 RLS foundation. Get that phase right — with correct policy syntax, `WITH CHECK` on all UPDATE policies, and User Impersonation testing — and the rest of the milestone is a clean additive build.

## Key Findings

### Recommended Stack

No new npm packages are required for the core social data model. The existing Drizzle ORM already supports `pgPolicy` + `authUid()` helpers from `drizzle-orm/supabase` (installed at ^0.45.2) for defining RLS policies in TypeScript alongside table definitions. The RLS policies compile to Postgres `CREATE POLICY` statements via `drizzle-kit migrate`. Supabase Realtime WebSocket subscriptions are explicitly deferred — server-rendered page loads with `router.refresh()` after mutations are sufficient at MVP scale, and Realtime's free tier (200 concurrent connections) and per-row RLS auth overhead make it a cost driver without meaningful UX benefit for a discovery-driven (not notification-driven) product.

**Core technologies:**
- `drizzle-orm/supabase` `pgPolicy` + `authUid()`: RLS policy definitions in TypeScript — colocated with schema, tracked in migrations, no raw SQL maintenance
- Drizzle ORM + `drizzle-kit migrate`: Generates `CREATE POLICY` SQL from `pgPolicy` definitions — existing toolchain, no new packages
- Server Components + Server Actions (existing): All new routes follow this pattern — profiles, feeds, and follow mutations are server-rendered with `revalidatePath()` after mutations
- `swr` ^2.3.x (optional, not yet installed): Add only if polling-based feed freshness is needed post-launch; `refreshInterval: 30000` is the pattern

**What NOT to add:** Supabase Realtime (defer to v3.0), TanStack Query, Redis, fan-out-on-write, graph databases — all premature at MVP scale (<200 users, <500 watches/user).

### Expected Features

**Must have (table stakes):**
- RLS on all tables (carry-forward from v1.0 MR-03) — blocks all multi-user work; no social feature is safe without it
- Public profile page `/u/[username]` with read-only collection grid — the minimum viable social surface
- Follow / unfollow with follower/following counts — without follow, there is no network and no feed payoff
- Activity feed (watch_added, watch_worn, wishlist_added) for followed users — follows without a feed is a dead end
- Privacy controls: profile-level + per-tab (collection, wishlist, worn independently) — collectors have different comfort levels for each data type

**Should have (differentiators):**
- Common Ground taste overlap on collector profile — no major competitor ships this natively; Horlo can because `analyzeSimilarity()` already exists; this is the signature differentiator and must NOT be deferred
- Profile tabs (Collection / Wishlist / Worn) — standard for collection-first platforms; Wishlist and Worn expose intent and behavior competitors don't surface
- Shared watches highlight ("You both own: X, Y, Z") — set intersection on brand+model, not the full similarity engine; low complexity, high hook value
- Activity feed wear events from followed users (WYWT) — strongest daily retention hook; surfaces behavior, not just acquisition

**Defer to later:**
- Likes, comments, notifications — engagement mechanics and moderation out of scope; product model is Rdio-style behavior signal, not approval mechanics
- "Collectors who own this watch" — requires imprecise brand+model matching without a canonical watch DB; noisy until canonical strategy exists
- Explore page, suggested collectors, cross-user search — require user critical mass and infrastructure beyond v2.0 scope
- Supabase Realtime / live feed — polling is sufficient; defer until UX research shows users expect live updates
- Activity feed pagination — limit to last 50 events at launch; cursor pagination can be added when volume demands it

### Architecture Approach

The existing DAL + Server Actions + Drizzle pattern extends cleanly to social features. Five new tables are added to `src/db/schema.ts` (`profiles`, `follows`, `profile_settings`, `activities`, `wear_events`) with full RLS policies colocated in the schema file. New DAL files handle each social domain. A new server-safe `src/lib/tasteOverlap.ts` handles Common Ground computation on the server (the existing `analyzeSimilarity()` stays client-only for self-analysis). Privacy enforcement is two-layer: RLS at the database level AND DAL WHERE clause enforcement at the application level — never just one layer.

**Major components:**
1. RLS policy layer (`pgPolicy` definitions in `src/db/schema.ts`) — database-level access control; prerequisite for everything else
2. Profile + privacy DAL (`src/data/profiles.ts`) — owns all profile reads and cross-user visibility checks; privacy rules live here, not in page components
3. Activity feed DAL (`src/data/activities.ts`) — single JOIN query for feed (not N+1); append-only `activities` table; keyset pagination from the start
4. Common Ground engine (`src/lib/tasteOverlap.ts`) — server-side computation; only the `TasteOverlapResult` is sent to the client, never raw collections
5. Follow system (`src/data/follows.ts` + `src/app/actions/follows.ts`) — directed graph (asymmetric follow, Rdio/Twitter model); one row per directed edge

### Critical Pitfalls

1. **RLS enabled without all policies written — existing data becomes invisible** — Enable RLS and write all policies in the same migration transaction. Test with Supabase User Impersonation (not the SQL Editor, which bypasses RLS). Minimum: SELECT, INSERT, UPDATE (with USING + WITH CHECK), DELETE for every table.

2. **`auth.uid()` without `SELECT` wrapper — per-row function calls blow up query plans** — Write all policies as `user_id = (SELECT auth.uid())`. Postgres caches the subquery result per statement; bare `auth.uid()` is re-evaluated per row. Supabase flags this as lint `0003_auth_rls_initplan`.

3. **`WITH CHECK` missing from UPDATE policies — users can inject data into other accounts** — Every UPDATE policy needs both `USING` and `WITH CHECK` checking `user_id = (SELECT auth.uid())`. `USING` filters which rows can be touched; `WITH CHECK` prevents changing `user_id` to someone else's ID.

4. **Privacy enforcement only in the application layer — data exposed via direct API calls** — Two-layer enforcement is mandatory: RLS policy at the DB level AND DAL WHERE clause. A direct `fetch` with the anon key bypasses the app entirely; only RLS stops it.

5. **N+1 queries in the activity feed — home page makes 20-100+ DB round-trips** — Write the feed DAL as a single JOIN query across `activities`, `watches`, and `profiles`. Verify with `EXPLAIN ANALYZE`. Use keyset pagination (`WHERE created_at < $cursor`) from the start — OFFSET degrades at depth and produces duplicates on live inserts.

## Implications for Roadmap

The dependency chain is strict. RLS is the blocker for everything. After RLS, schema must exist before any social app code. After schema: profile identity surface → privacy controls → follow system → public visibility → activity feed + Common Ground.

### Phase 1: RLS Foundation
**Rationale:** Hard prerequisite carried from v1.0 (MR-03). Without RLS on existing tables, any multi-user feature leaks private data at the database level. No social feature is safe to ship without this floor. Establishes correct policy syntax as the codebase standard.
**Delivers:** RLS policies on `watches`, `user_preferences`, `users`; `WITH CHECK` on all UPDATE policies; User Impersonation test verification
**Addresses:** Unblocks all subsequent social features
**Avoids:** Pitfalls 1, 2, 3, 4 — the entire RLS misconfiguration cluster

### Phase 2: Social Schema + Profile Auto-Creation
**Rationale:** New tables and the profile auto-creation trigger must exist before any app code can read from them. Pure infrastructure with no visible UX, but unblocks all subsequent phases.
**Delivers:** `profiles`, `follows`, `profile_settings`, `activities`, `wear_events` tables with migrations; Supabase Auth webhook or DB trigger for profile row on signup; one-time backfill for existing users; all required indexes in the initial migration
**Avoids:** Pitfall 7 (follows table `status` column designed from the start); Pitfall 5 (indexes on `follows` and `activities` in the initial migration, not added later)

### Phase 3: Self Profile + Privacy Controls
**Rationale:** Build the identity surface for the logged-in user before exposing other users' profiles. Surfaces privacy gaps early in a controlled context before they affect real user data.
**Delivers:** `/u/[username]` page (own view, Collection tab); `/settings` page with privacy toggles; `updatePrivacySettings` Server Action with `revalidatePath()` cache invalidation
**Avoids:** Pitfall 10 (cache invalidation on privacy change in the Server Action from day one); Pitfall 3 (privacy enforcement at DAL WHERE clause level, not component conditional render)

### Phase 4: Follow System + Public Profile Visibility
**Rationale:** Follow is the core network primitive. Once follows exist and profiles are visible, the social graph can form. `proxy.ts` update to allow `/u/` without auth happens here.
**Delivers:** Follow/unfollow Server Actions; `FollowButton` client island; follower/following counts; read-only collector profile page (other user view) with privacy enforcement; `/u/` added to `PUBLIC_PATHS`; shared watches highlight (set intersection, low complexity — include here)
**Avoids:** Pitfall 8 (distinct DAL functions for own vs. foreign user reads — code review gate); Pitfall 7 (follows INSERT policy checks `follower_id = auth.uid()`)

### Phase 5: Activity Feed
**Rationale:** Follows now exist; the feed has real data to display. Highest-complexity feature; should come after the social graph is established.
**Delivers:** Activity event logging wired into existing `watches.ts` Server Actions (fire-and-forget, separate try/catch); `getFeedForUser()` JOIN query in DAL; home page activity feed section (Server Component); keyset pagination from day one
**Avoids:** Pitfall 5 (single JOIN query, verified with EXPLAIN ANALYZE); Pitfall 6 (keyset pagination, no OFFSET)

### Phase 6: Common Ground (Taste Overlap)
**Rationale:** The signature differentiator. Depends on the collector profile page (Phase 4) being stable. Runs server-side, so no new client infrastructure needed.
**Delivers:** `src/lib/tasteOverlap.ts` server-safe function; Common Ground section on collector profile page; Wishlist and Worn profile tabs (if privacy settings permit)
**Avoids:** Pitfall 9 (Common Ground computed server-side only; only `TasteOverlapResult` sent to client — not raw foreign collection data)

### Phase Ordering Rationale

- RLS before everything: no multi-user feature is safe without database-level access control
- Schema before app code: five new tables are dependencies for all social DAL functions
- Self-profile before other-profile: surfaces privacy assumptions in a controlled context before they affect real user data
- Follow before feed: the feed query joins `follows` to assemble the personalized event stream
- Feed before Common Ground: activity logging infrastructure in Server Actions is reused as the activity data source

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (RLS):** The `watches` visibility policy requires a `SECURITY DEFINER` function to join `profile_settings` without causing RLS recursion. The exact migration workflow (function creation via raw SQL in `drizzle-kit` migration + `pgPolicy` reference) should be validated in a staging environment before applying to production.
- **Phase 2 (Profile Auto-Creation):** The specific mechanism for profile row creation on Supabase Auth signup (webhook URL configuration vs. DB trigger on `auth.users`) should be verified against current Supabase docs; the correct approach varies by Supabase version and project configuration.

Phases with standard patterns (skip research-phase):
- **Phase 4 (Follow System):** Directed follow graph with asymmetric follow is thoroughly documented; DAL functions and RLS policies are fully specified in research.
- **Phase 5 (Activity Feed):** JOIN-based feed query, keyset pagination, fire-and-forget activity logging — all standard patterns with verified implementations in research.
- **Phase 6 (Common Ground):** Pure function composition of existing `analyzeSimilarity()` logic; no new libraries; server-side execution path is fully specified.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No new packages; existing stack is production-validated; Drizzle `pgPolicy` API confirmed against official docs |
| Features | HIGH | Competitive landscape research thorough (Letterboxd, Goodreads, Discogs, Rdio); feature prioritization aligns with PRODUCT-BRIEF.md |
| Architecture | HIGH | Primary sources are the existing codebase and PROJECT.md/PRODUCT-BRIEF.md; patterns consistent with what is already built and validated |
| Pitfalls | HIGH (RLS), MEDIUM (privacy enforcement patterns) | RLS failure modes from official Supabase docs and GitHub discussions; N+1 and pagination from high-confidence sources; some privacy enforcement patterns from community sources |

**Overall confidence:** HIGH

### Gaps to Address

- **Realtime decision needs UX validation:** Deferring Supabase Realtime is technically sound but whether users will tolerate a non-live feed is a product assumption. Flag for the post-launch retrospective; if live updates are expected, use Broadcast (not Postgres Changes) to avoid per-row RLS overhead.
- **Feed RLS policy complexity at scale:** The `activities` SELECT policy ("owner OR following the owner") subquery-joins `follows` on every row authorization. Fine at MVP scale (<200 users); above ~1,000 users needs a denormalized approach or SECURITY DEFINER function. Note this in schema design and revisit if user base grows.
- **Canonical watch matching imprecision:** Common Ground matches watches by normalized `(brand, model)` string — no canonical watch ID exists in v2.0. Model name inconsistencies between users will produce false negatives. UX should label the section "Shared interests" not "Exact matches" to set expectations.
- **Username claim flow undefined:** The profile auto-creation mechanism needs a username assignment strategy for existing users and a UX for username selection at signup. Neither is specified in PRODUCT-BRIEF.md and must be defined before Phase 3 ships.

## Sources

### Primary (HIGH confidence)
- Drizzle ORM RLS docs — `pgPolicy`, `authUid()`, `authenticatedRole` API: https://orm.drizzle.team/docs/rls
- Supabase RLS docs — SECURITY DEFINER function pattern for cross-table policies: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Realtime Postgres Changes — RLS interaction, scaling limits, 200 concurrent connection ceiling: https://supabase.com/docs/guides/realtime/postgres-changes
- Supabase RLS Performance Advisors — lint `0003_auth_rls_initplan`: https://supabase.com/docs/guides/database/database-advisors
- Next.js Data Security Guide: https://nextjs.org/docs/app/guides/data-security
- Drizzle ORM Joins: https://orm.drizzle.team/docs/joins
- Existing codebase — direct read: `src/proxy.ts`, `src/lib/auth.ts`, `src/data/watches.ts`, `src/db/schema.ts`, `src/app/actions/watches.ts`
- Keyset cursors vs. OFFSET for Postgres: https://blog.sequinstream.com/keyset-cursors-not-offsets-for-postgres-pagination/
- RLS performance and best practices — Supabase GitHub Discussion #14576: https://github.com/orgs/supabase/discussions/14576

### Secondary (MEDIUM confidence)
- GetStream — scalable activity feed architecture: https://getstream.io/blog/scalable-activity-feed-architecture/
- Letterboxd FAQ, activity feed docs, Wikipedia overview: https://letterboxd.com/about/faq/
- Goodreads social network site research: https://www.researchgate.net/publication/293768221_Goodreads_A_Social_Network_Site_for_Book_Readers
- Discogs collection feature documentation: https://support.discogs.com/hc/en-us/articles/360007331534
- Rdio Wikipedia overview: https://en.wikipedia.org/wiki/Rdio
- MakerKit real-time notifications guide — initial data + subscription merge pattern: https://makerkit.dev/blog/tutorials/real-time-notifications-supabase-nextjs
- Neon blog — Drizzle + social network RLS modeling: https://neon.com/blog/modelling-authorization-for-a-social-network-with-postgres-rls-and-drizzle-orm

### Tertiary (LOW confidence)
- Third-party Letterboxd taste comparison tools — evidence of unmet native demand for Common Ground analog: https://github.com/jsalvasoler/letterboxd_user_comparison

---
*Research completed: 2026-04-19*
*Ready for roadmap: yes*
