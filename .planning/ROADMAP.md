# Roadmap: Horlo

## Milestones

- ✅ **v1.0 MVP** — Phases 1-5 (shipped 2026-04-19) — [archive](milestones/v1.0-ROADMAP.md)
- 🔄 **v2.0 Taste Network Foundation** — Phases 6-10 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-5) — SHIPPED 2026-04-19</summary>

- [x] Phase 1: Visual Polish & Security Hardening (6/6 plans)
- [x] Phase 2: Feature Completeness & Test Foundation (5/5 plans)
- [x] Phase 3: Data Layer Foundation (3/3 plans)
- [x] Phase 4: Authentication (6/6 plans)
- [x] Phase 5: Zustand Cleanup, Similarity Rewire & Prod DB Bootstrap (6/6 plans)
- [ ] Phase 6: Test Suite Completion — deferred to v1.1 (TEST-04/05/06)

See [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) for full phase details.

</details>

### v2.0 Taste Network Foundation

- [ ] **Phase 6: RLS Foundation** - Defense-in-depth row-level security on all existing tables, prerequisite for all multi-user features
- [ ] **Phase 7: Social Schema & Profile Auto-Creation** - Five new tables land with full RLS, profile rows auto-created on signup
- [ ] **Phase 8: Self Profile & Privacy Controls** - Collector's own profile page with all tabs, privacy settings surface
- [ ] **Phase 9: Follow System & Collector Profiles** - Follow/unfollow, public collector profile view, Common Ground taste overlap
- [ ] **Phase 10: Activity Feed** - Home page network feed showing followed collectors' watch events

## Phase Details

### Phase 6: RLS Foundation
**Goal**: Every existing database table is protected by correctly-written RLS policies so that multi-user data visibility is safe to build on top of.
**Depends on**: Nothing (carry-forward from v1.0 MR-03, prerequisite for all v2.0 work)
**Requirements**: DATA-01, DATA-07
**Success Criteria** (what must be TRUE):
  1. User A's watches, preferences, and user row are completely invisible to User B at the database level — verified by querying the DB while impersonating User B via Supabase User Impersonation tool (not the SQL Editor, which bypasses RLS)
  2. A user can read and write their own data without any change in behavior from before RLS was enabled
  3. Every UPDATE policy has both a USING clause and a WITH CHECK clause using the `(SELECT auth.uid())` subquery pattern — no bare `auth.uid()` calls that would cause per-row re-evaluation
  4. RLS is enabled on `public.users`, `public.watches`, and `public.user_preferences` — confirmed via Supabase dashboard or `SELECT relrowsecurity FROM pg_class WHERE relname = 'watches'`
**Plans**: 1 plan

Plans:
- [ ] 06-01-PLAN.md — Write RLS migration (enable + 12 policies) and push to Supabase

### Phase 7: Social Schema & Profile Auto-Creation
**Goal**: The five new social tables exist in Postgres with full RLS policies and correct indexes, and every user (new and existing) has a profile row.
**Depends on**: Phase 6
**Requirements**: DATA-02, DATA-03, DATA-04, DATA-05, DATA-06
**Success Criteria** (what must be TRUE):
  1. Drizzle schema defines `profiles`, `follows`, `profile_settings`, `activities`, and `wear_events` tables and `drizzle-kit migrate` produces a verified migration that applies cleanly to the prod Supabase project
  2. Every existing user has a profile row — backfill script runs without error and is idempotent
  3. A new user who completes signup finds a profile row already present without any manual step (auto-created via DB trigger or Auth webhook)
  4. Each new table has its RLS policies defined and verified: owners can read and write their own rows; other authenticated users are blocked at the DB level
  5. Required indexes on `follows(follower_id)`, `follows(following_id)`, `activities(user_id, created_at)`, and `wear_events(watch_id, worn_at)` are present in the migration
**Plans**: TBD

### Phase 8: Self Profile & Privacy Controls
**Goal**: A collector can view and edit their own full profile page and control exactly what other users can see.
**Depends on**: Phase 7
**Requirements**: PROF-01, PROF-02, PROF-03, PROF-04, PROF-05, PROF-06, PROF-07, PROF-10, PRIV-01, PRIV-02, PRIV-03, PRIV-04, PRIV-05, PRIV-06
**Success Criteria** (what must be TRUE):
  1. User can navigate to `/u/[their-username]` and see a profile header with avatar, username, bio, follower/following counts, and auto-derived taste tags drawn from collection composition
  2. User can switch between Collection, Wishlist, Worn, Notes, and Stats tabs — each tab loads the correct data and respects the user's own privacy settings when previewing
  3. User can open Settings and toggle profile visibility, collection visibility, wishlist visibility, and worn history visibility — changes persist and take effect immediately without a page reload
  4. When a user sets their profile to private, any visitor who is not the owner sees a locked profile state with a follow button visible but no collection content (Letterboxd pattern)
  5. Privacy enforcement operates at both the RLS layer and the DAL WHERE clause — a direct database query with a foreign user's token cannot read private rows
  6. User can edit display name, avatar URL, and bio from their profile page and see the changes reflected immediately
**Plans**: TBD
**UI hint**: yes

### Phase 9: Follow System & Collector Profiles
**Goal**: Collectors can follow each other, the social graph exists, and visiting another collector's profile shows their public collection alongside a Common Ground taste overlap.
**Depends on**: Phase 8
**Requirements**: FOLL-01, FOLL-02, FOLL-03, FOLL-04, PROF-08, PROF-09
**Success Criteria** (what must be TRUE):
  1. User can click Follow on any collector's profile and see the follower count increment; clicking Unfollow reverses this — both actions persist across page reload
  2. Visiting another collector's public profile at `/u/[username]` shows their collection in read-only view; tabs and data respect that collector's privacy settings (private tabs show locked state, not empty)
  3. User can open the followers or following list on any profile and see the accounts represented as clickable collector cards
  4. The Common Ground section on another collector's profile shows watches both collectors own (set intersection on brand+model) and a taste-overlap summary derived from the similarity engine — computed server-side, only the result is sent to the client
  5. Following counts are accurate on both the follower's and the followed collector's profile without a full page refresh after the follow action
**Plans**: TBD
**UI hint**: yes

### Phase 10: Activity Feed
**Goal**: The home page shows a live-ish feed of what followed collectors are doing with their collections, making the network feel active.
**Depends on**: Phase 9
**Requirements**: FEED-01, FEED-02, FEED-03, FEED-04
**Success Criteria** (what must be TRUE):
  1. User visiting the home page sees a feed of watch_added, wishlist_added, and watch_worn events from collectors they follow, with the collector's name, avatar, and watch details on each entry
  2. When a user adds a watch to their collection, a single activity event is written — bulk imports produce one aggregated event rather than N individual events
  3. The feed loads the most recent events first and shows a "load more" control that fetches the next page using keyset pagination (no OFFSET) — the same watches do not appear twice when new events arrive between page loads
  4. A user with no follows sees an empty-state prompt directing them to find collectors to follow rather than a blank page
  5. Activity feed data for private collectors or private collection tabs is not surfaced to non-followers — privacy settings from Phase 8 are respected in the feed DAL query
**Plans**: TBD

## Backlog

### Phase 999.1: Phase 5 Code Review Follow-ups — RLS & Error Handling (BACKLOG)

**Goal:** [Captured for future planning]
**Requirements:** TBD
**Plans:** 0 plans

See `.planning/phases/05-migration-zustand-cleanup-similarity-rewire-prod-db-bootstrap/05-REVIEW.md` for full context.

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

## Progress

**Execution Order:**
Phases execute in numeric order: 6 → 7 → 8 → 9 → 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 6. RLS Foundation | 0/1 | Not started | - |
| 7. Social Schema & Profile Auto-Creation | 0/TBD | Not started | - |
| 8. Self Profile & Privacy Controls | 0/TBD | Not started | - |
| 9. Follow System & Collector Profiles | 0/TBD | Not started | - |
| 10. Activity Feed | 0/TBD | Not started | - |
