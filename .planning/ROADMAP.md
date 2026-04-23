# Roadmap: Horlo

## Milestones

- ✅ **v1.0 MVP** — Phases 1-5 (shipped 2026-04-19) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v2.0 Taste Network Foundation** — Phases 6-10 (shipped 2026-04-22) — [archive](milestones/v2.0-ROADMAP.md)
- 📋 **v3.0 Production Nav & Daily Wear Loop** — Phases 11-16 (in progress)

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

<details>
<summary>✅ v2.0 Taste Network Foundation (Phases 6-10) — SHIPPED 2026-04-22</summary>

- [x] Phase 6: RLS Foundation (1/1 plans)
- [x] Phase 7: Social Schema & Profile Auto-Creation (3/3 plans)
- [x] Phase 8: Self Profile & Privacy Controls (4/4 plans)
- [x] Phase 9: Follow System & Collector Profiles (4/4 plans)
- [x] Phase 10: Network Home (9/9 plans)

35/35 requirements shipped. Cross-phase integration verified. End-to-end privacy flows audited.

See [v2.0-ROADMAP.md](milestones/v2.0-ROADMAP.md) for full phase details and [v2.0-MILESTONE-AUDIT.md](milestones/v2.0-MILESTONE-AUDIT.md) for the audit report.

</details>

### v3.0 Production Nav & Daily Wear Loop (Phases 11-16)

- [x] **Phase 11: Schema + Storage Foundation** — All migrations, bucket, pg_trgm, worn_public backfill, RLS audit (completed 2026-04-22)
- [x] **Phase 12: Visibility Ripple in DAL** — Three-tier wear privacy wired through all existing wear-reading DAL functions (completed 2026-04-22)
- [x] **Phase 13: Notifications Foundation** — notifications DAL + Server Actions + bell + inbox + fire-and-forget wiring (completed 2026-04-23)
- [ ] **Phase 14: Nav Shell + Explore Stub** — Bottom nav, desktop top nav, slim mobile nav, MobileNav retired, /explore stub
- [ ] **Phase 15: WYWT Photo Post Flow** — Multi-step wear post modal, camera, HEIC upload, visibility selector, Storage upload, Sonner toast, wear detail route
- [ ] **Phase 16: People Search** — /search page, live debounced ILIKE, taste overlap %, FollowButton inline

## Phase Details

### Phase 11: Schema + Storage Foundation
**Goal**: All database schemas, migrations, storage infrastructure, and RLS policies are in place so every downstream phase has a stable foundation to build on.
**Depends on**: Nothing (prerequisite for all other phases)
**Requirements**: WYWT-09, WYWT-11, WYWT-13, WYWT-14, NOTIF-01, SRCH-08, DEBT-02
**Success Criteria** (what must be TRUE):
  1. A `wear_visibility` Postgres enum exists with values `public`, `followers`, `private`; `wear_events` table has `photo_url`, `note`, and `visibility` columns; all existing rows have `visibility` backfilled from `worn_public` with `false → 'private'` and `true → 'public'` (no row has `visibility = 'followers'`)
  2. The `notifications` table exists with `id`, `user_id`, `type`, `payload`, `read_at`, `created_at`; a partial index on `(user_id) WHERE read_at IS NULL` exists; RLS allows recipients to SELECT/UPDATE only their own rows; no INSERT policy exists for anon key
  3. The `wear-photos` Supabase Storage bucket exists as private; Storage RLS on `storage.objects` enforces three-tier access: owner always, public-visibility unsigned OK, followers-visibility requires follow relationship, private-visibility owner only; direct URL access to a private wear photo in incognito returns 403
  4. `pg_trgm` extension is enabled in Supabase; GIN trigram indexes exist on `profiles.username` and `profiles.bio`; a query plan for `username ILIKE '%query%'` shows an index scan, not a seq scan
  5. `users`, `watches`, and `user_preferences` tables all have RLS policies using the `(SELECT auth.uid())` InitPlan-optimized pattern; every UPDATE policy has both `USING` and `WITH CHECK` clauses
**Plans**: 5 plans (Wave 1: Plans 01-03 parallel · Wave 2: Plan 04 · Wave 3: Plan 05)
  - [x] 11-01-PLAN.md — Drizzle schema extensions + Migration 1 (wear_visibility enum + wear_events columns + backfill + DO\$\$ verification) [Wave 1]
  - [x] 11-02-PLAN.md — Migration 2 (notifications table + notification_type enum + indexes + dedup UNIQUE + self-notif CHECK + recipient-only RLS) [Wave 1]
  - [x] 11-03-PLAN.md — Migration 3 (pg_trgm extension + GIN trigram indexes on profiles.username/bio) [Wave 1]
  - [x] 11-04-PLAN.md — Migration 4 (wear-photos Storage bucket + three-tier SELECT RLS + folder-enforcement INSERT/UPDATE/DELETE RLS) [Wave 2; depends on Plan 01]
  - [x] 11-05-PLAN.md — Migration 5 (DEBT-02 audit — no-op DDL + sanity assertion) + [BLOCKING] local schema push + full Wave 0 test execution [Wave 3; depends on Plans 01-04]
**Pitfalls to address**: G-6 (backfill direction), F-1 (Storage RLS separate system), F-4 (folder enforcement in storage path), C-1 (pg_trgm must be in migration not dashboard click), B-4 (notifications SELECT recipient-only), B-9 (no-self-notification CHECK), B-3 (unique constraint for dedup), B-7 (ON DELETE CASCADE for orphan cleanup), DEBT-02 (WITH CHECK on all UPDATE policies)

---

### Phase 12: Visibility Ripple in DAL
**Goal**: Every existing function that reads `wear_events` for non-owner viewers correctly enforces the three-tier visibility gate so followers-only wears are never exposed publicly.
**Depends on**: Phase 11 (visibility column and enum must exist)
**Requirements**: WYWT-10, WYWT-11
**Success Criteria** (what must be TRUE):
  1. `getPublicWearEventsForViewer` returns a wear event with `visibility = 'followers'` only when the viewer follows the actor; the same event is invisible to a stranger; `worn_public` boolean is no longer the gate
  2. `getWearRailForViewer` home rail includes followers-only tiles only for followed actors; a user with `worn_public = true` but `visibility = 'followers'` on a wear event does not expose that event to non-followers
  3. `getFeedForUser` activity rows for `watch_worn` events respect per-row visibility drawn from activity metadata; no JOIN to `wear_events` is needed on the feed hot path
  4. The profile worn tab for a non-owner viewer calls a viewer-aware DAL function, not `getAllWearEventsByUser`; a private wear event on that profile does not appear in the viewer's rendered worn tab
  5. Integration tests cover: (a) public wear visible to all, (b) followers-only wear visible to follower and invisible to stranger, (c) private wear visible only to owner — all three pass before this phase ships
**Plans**: 7 plans (Wave 0: Plan 01 tests-first · Wave 1: Plans 02-03 parallel DAL ripple · Wave 2: Plan 04 consumers · Wave 3: Plans 05-06 cleanup + [BLOCKING] column drop migration · Gap closure: Plan 07 wishlist test fixture three-tier contract)
  - [x] 12-01-PLAN.md — Author Phase 12 visibility matrix integration tests + modify unit tests (red-state commits; privacy-first UAT rule) [Wave 0]
  - [x] 12-02-PLAN.md — Introduce WearVisibility type + getWearEventsForViewer (rename, three-tier predicate) + getWearRailForViewer WHERE rewrite + WywtTile carries visibility [Wave 1; depends on Plan 01]
  - [x] 12-03-PLAN.md — Widen logActivity (WatchWornMetadata requires visibility) + getFeedForUser metadata->>'visibility' gate + markAsWorn writes visibility:'public' [Wave 1; depends on Plan 01]
  - [x] 12-04-PLAN.md — Profile tab page calls getWearEventsForViewer; delete worn-tab LockedTabCard branch; wishlist action three-tier gate via inline JOIN [Wave 2; depends on Plan 02]
  - [x] 12-05-PLAN.md — Strip wornPublic from ProfileSettings type, VISIBILITY_FIELDS, settings page + SettingsClient; repo-wide invariant grep clean [Wave 3; depends on Plans 02-04]
  - [x] 12-06-PLAN.md — [BLOCKING] Drop wornPublic from src/db/schema.ts; drizzle-kit generate; author supabase migration 20260424000001_phase12_drop_worn_public.sql; apply locally; verify matrix final cell green; MANUAL prod push checkpoint [Wave 3; depends on Plan 05]
  - [x] 12-07-PLAN.md — [GAP CLOSURE] Update tests/actions/wishlist.test.ts mock fixture to three-tier contract (visibility + profilePublic) · queue-based db.select chain · rewrite Test 5 Case B and Test 9 · add Test 10 (followers tier happy) and Test 11 (followers tier deny) [Wave 1; gap closure for VERIFICATION.md truth #5]
**Pitfalls to address**: G-1 (audit all 8+ DAL functions before touching any), G-3 (wornPublic fallthrough removed), G-4 (profile_public outer gate preserved), G-5 (self-tile bypass unchanged), G-7 (visibility in activity metadata at write time), F-1 (table RLS does not protect Storage — separate), B-6 (no getCurrentUser inside use cache), privacy-first UAT rule from SUMMARY.md

---

### Phase 13: Notifications Foundation
**Goal**: Collectors receive live notifications for follows and watch overlaps; the nav bell shows an unread count; the notifications inbox lets users mark all read.
**Depends on**: Phase 11 (notifications table must exist)
**Requirements**: NOTIF-02, NOTIF-03, NOTIF-04, NOTIF-05, NOTIF-06, NOTIF-07, NOTIF-08, NOTIF-09, NOTIF-10
**Success Criteria** (what must be TRUE):
  1. When User A follows User B, User B's notifications bell shows an unread dot on their next page load; the `/notifications` page lists a "User A started following you" row
  2. When User A adds a watch that User B already owns (brand + model normalized match), User B receives a watch-overlap notification; User A does not receive a self-notification; adding the same watch twice within 30 days does not create a second overlap notification for User B
  3. The notifications bell renders an unread dot when unread count > 0 and no dot when count = 0; the count is server-rendered per request without client-side polling
  4. The `/notifications` page lists notifications newest-first with visual differentiation between read and unread rows; "Mark all read" sets all unread rows to read and the bell dot disappears on next render
  5. Settings page exposes per-type opt-out toggles for "New followers" and "Watch overlaps"; toggling off prevents new notification inserts of that type; the notifications inbox shows "You're all caught up" copy when zero rows exist
**Plans**: 4 plans (Wave 0: Plan 01 schema+migration+tests · Wave 1: Plans 02-03 parallel DAL+logger+SA and UI components · Wave 2: Plan 04 page+wire-up+Bell+settings+Header)
  - [x] 13-01-PLAN.md — Drizzle schema edits + Supabase migration (3 profile_settings columns + backfill) + TypeScript type extensions + Wave 0 test suite RED [Wave 0]
  - [x] 13-02-PLAN.md — Fire-and-forget logger + notifications DAL (5 functions) + markAllNotificationsRead SA + VISIBILITY_FIELDS enum widening [Wave 1; depends on 13-01]
  - [x] 13-03-PLAN.md — NotificationRow + NotificationsInbox (NOTIF-08 collapse + Today/Yesterday/Earlier buckets) + NotificationsEmptyState [Wave 1; depends on 13-01; parallel with 13-02]
  - [x] 13-04-PLAN.md — NotificationBell cached Server Component + /notifications page + SettingsClient Notifications section + followUser/addWatch logNotification wiring + temporary Header bell placement + full suite GREEN [Wave 2; depends on 13-02, 13-03]
**Pitfalls to address**: B-1 (bell count as isolated Suspense leaf), B-2 (fire-and-forget — failure never rolls back follow or addWatch), B-3 (dedup UNIQUE constraint + ON CONFLICT DO NOTHING), B-4 (recipient-only RLS SELECT policy), B-5 (Mark All Read operates on WHERE read_at IS NULL server-side, not a client-supplied list), B-6 (viewerId as explicit argument to any use cache wrapper), B-8 (unknown types render null, not broken card), B-9 (self-notification DB CHECK), B-7 (ON DELETE CASCADE verified in schema), A-1 (NotificationBell in its own Suspense leaf, not blocking page)
**UI hint**: yes

---

### Phase 14: Nav Shell + Explore Stub
**Goal**: Every route in the app is reachable from a single-tap navigation frame; the production desktop top nav and mobile bottom nav replace the v2.0 placeholder nav; the Explore stub closes the only broken nav link.
**Depends on**: Phase 13 (unread count DAL must exist for bell wiring in nav)
**Requirements**: NAV-01, NAV-02, NAV-03, NAV-04, NAV-05, NAV-06, NAV-07, NAV-08, NAV-09, NAV-10, NAV-11, NAV-12, DEBT-01
**Success Criteria** (what must be TRUE):
  1. On a mobile viewport (< 768px) a sticky bottom nav with five items (Home, Explore, Wear, Add, Profile) is always visible regardless of scroll position; the centered Wear item has a cradle/notch visual treatment; tapping Wear opens `WatchPickerDialog`
  2. On iOS (Face ID device), the bottom nav does not overlap the home indicator; content at the bottom of any page is not clipped behind the nav; `viewport-fit=cover` is present in the viewport meta tag
  3. The bottom nav and slim mobile top nav are absent on `/login`, `/signup`, and any pre-auth route; the desktop top nav contains logo, Explore link, persistent search input, Wear CTA, Add icon, notifications bell, and profile dropdown
  4. The active route in the bottom nav shows a filled icon in accent color; tapping the Add icon in either the desktop or mobile nav routes to `/watch/new`; the old `MobileNav` hamburger component is removed from the codebase
  5. `/explore` renders a "coming soon" placeholder page; no nav link produces a 404; the desktop profile dropdown consolidates profile link, settings, theme toggle, and sign out; preference save failures surface a visible error message to the user (DEBT-01)
**Plans**: 9 plans (Wave 1: Plans 01, 02, 05, 06, 07, 08, 09 parallel · Wave 2: Plans 03, 04 parallel)
  - [x] 14-01-PLAN.md — Shared PUBLIC_PATHS constant + proxy refactor (NAV-05 D-21/D-22) [Wave 1]
  - [x] 14-02-PLAN.md — Root layout IBM Plex Sans font swap + viewport-fit=cover + preserved theme script (NAV-03 D-07/D-08/D-09) [Wave 1]
  - [ ] 14-03-PLAN.md — BottomNav Client Component + NavWearButton appearance prop + layout mount + main padding (NAV-01/02/03/04/05/09/10) [Wave 2; depends on 14-01, 14-02]
  - [ ] 14-04-PLAN.md — SlimTopNav + DesktopTopNav + Header delegator + HeaderNav Insights removal + NotificationBell relocation + MobileNav deletion (NAV-05/06/07/10/12) [Wave 2; depends on 14-01, 14-05]
  - [x] 14-05-PLAN.md — InlineThemeSegmented + UserMenu consolidation (Profile/Settings/Theme/Sign out) (NAV-08 D-17) [Wave 1]
  - [x] 14-06-PLAN.md — /explore and /search coming-soon stubs (NAV-11 D-18/D-19) [Wave 1]
  - [x] 14-07-PLAN.md — ProfileTabs owner-only Insights tab + InsightsTabContent + [tab]/page gate + /insights redirect (NAV-11 D-13/D-14/D-15) [Wave 1]
  - [x] 14-08-PLAN.md — Settings "Taste Preferences" link row (NAV-11 D-12) [Wave 1]
  - [x] 14-09-PLAN.md — DEBT-01 regression-lock test + REQUIREMENTS.md traceability (DEBT-01 D-25) [Wave 1]
**Pitfalls to address**: A-1 (BottomNav inside Suspense boundary, not bare body), A-2 (usePathname hydration — client component for active state), A-3 (iOS safe-area-inset on nav and main), A-4 (auth route exclusion), A-5 (inline theme script contract unchanged), I-2 (WatchPickerDialog not forked — extend via props only), B-1 (bell count rendered as isolated Suspense leaf), P-08 (Insights tab existence leak — uniform notFound for non-owners), P-11 (no `'use cache'` on /insights redirect)
**UI hint**: yes

---

### Phase 15: WYWT Photo Post Flow
**Goal**: Collectors can log a wear event with a wrist photo, note, and three-tier visibility in a two-step modal; the photo is stored securely in Supabase Storage; a Sonner toast confirms success; wear detail is viewable at a permanent URL.
**Depends on**: Phase 11 (schema), Phase 12 (visibility ripple in place), Phase 14 (WywtPostDialog orchestration shell and WatchPickerDialog onWatchSelected prop)
**Requirements**: WYWT-01, WYWT-02, WYWT-03, WYWT-04, WYWT-05, WYWT-06, WYWT-07, WYWT-08, WYWT-12, WYWT-15, WYWT-16, WYWT-17, WYWT-18, WYWT-19
**Success Criteria** (what must be TRUE):
  1. Tapping the Wear CTA opens a two-step modal: Step 1 shows the existing `WatchPickerDialog`; selecting a watch advances to Step 2 with a "Change" link returning to Step 1
  2. Step 2 offers "Take Wrist Shot" (camera with dotted oval overlay) and "Upload Photo" (file picker with HEIC support); both are optional; submitting with no photo is valid; the note textarea shows a live `0/200` character counter
  3. All captured or uploaded images are resized to a max 1080px dimension and EXIF-stripped via canvas re-encode before upload; a photo uploaded from iOS camera roll with EXIF GPS data has no GPS metadata in the stored file (verified with exiftool)
  4. The visibility selector shows Private, Followers, and Public with Public as the default; a successful wear post triggers a "Wear logged" Sonner toast; the same (user, watch, calendar day) combination cannot be logged twice — a clear error appears on the second attempt
  5. `/wear/[wearEventId]` shows the wear detail (image, watch, collector, note, timestamp) gated by three-tier visibility; a stranger gets a uniform 404 for private and followers-only wear events; the WYWT rail tile tap continues to open the Reels-style overlay from Phase 10
**Plans**: TBD
**Pitfalls to address**: D-1 (getUserMedia must be first await on iOS gesture — no awaits before it), D-2 (MediaStream cleanup on unmount), D-3 (camera permission denied UX), D-4 (canvas resize before upload — target < 500KB), D-5 (overlay relative units), E-1 (heic2any lazy-loaded in Web Worker — never eager import), E-2 (EXIF orientation before canvas draw — research flag: createImageBitmap vs exifr), E-3 (server-side storage path validation in Server Action), E-4 (EXIF stripped on ALL paths including camera), F-2 (signed URLs generated per-request, never in cached components), F-3 (orphan storage cleanup if row insert fails), F-4 (path convention {userId}/{wearEventId}.jpg enforced), H-1 (Toaster outside Suspense boundaries), H-2 (toast called from Client Component not Server Action), H-3 (Toaster uses custom ThemeProvider wrapper not next-themes scaffold)
**UI hint**: yes

---

### Phase 16: People Search
**Goal**: Collectors can search for other collectors by username or bio with live debounced results, taste overlap percentage, and inline follow actions.
**Depends on**: Phase 11 (pg_trgm indexes must exist)
**Requirements**: SRCH-01, SRCH-02, SRCH-03, SRCH-04, SRCH-05, SRCH-06, SRCH-07
**Success Criteria** (what must be TRUE):
  1. `/search` renders four tabs (All, Watches, People, Collections); Watches and Collections tabs show "coming soon" copy with no query firing; People tab shows suggested collectors before any query is typed
  2. Typing a query shorter than 2 characters fires no search request; at 2+ characters the input debounces 250ms then executes; results are ordered by taste overlap % descending then username ascending, limited to 20 rows
  3. Each result row shows username, bio snippet, taste overlap percentage, and an inline FollowButton; tapping Follow/Unfollow updates button state without a full page reload
  4. Searching for a user whose `profile_public = false` returns 0 results for a non-follower; private profiles do not leak through the search surface
  5. When the search returns no matches, the "No results" state shows suggested collectors from the Phase 10 `getCollectorsLikeUser` DAL as a discovery surface
**Plans**: TBD
**Pitfalls to address**: C-1 (pg_trgm from Phase 11 — verified by EXPLAIN ANALYZE showing index scan), C-2 (2-char minimum enforced server-side in DAL, not only client), C-3 (profile_public WHERE clause in searchProfiles DAL — two-layer), C-4 (batched isFollowing lookup — no N+1, same pattern as v2.0 Suggested Collectors), C-5 (bio search minimum-length guard for bio matches)
**UI hint**: yes

---

## Backlog

### Phase 999.1: Phase 5 Code Review Follow-ups — RLS & Error Handling (BACKLOG)

**Goal:** Close the three MEDIUM findings from the Phase 5 code review by (a) surfacing preference save failures to the user in `PreferencesClient` with a `role="alert"` inline banner and exposed `isPending` state, (b) removing the unused `UnauthorizedError` import from `src/app/actions/watches.ts` and `src/app/actions/preferences.ts`, and (c) formally documenting that MR-03 (RLS on users / watches / user_preferences) was resolved by Phase 6 migration `20260420000000_rls_existing_tables.sql` and re-audited by Phase 11 DEBT-02 migration `20260423000005_phase11_debt02_audit.sql`. No new RLS SQL is authored by this phase.
**Requirements:** MR-01, MR-02, MR-03
**Plans:** 7/9 plans executed
**Success Criteria** (what must be TRUE):
  1. `src/components/preferences/PreferencesClient.tsx` inspects the `ActionResult` returned by `savePreferences`; on `{ success: false }` it renders an accessible `role="alert"` banner with the message `"Couldn't save preferences: {error}"`; the discarded-pending-tuple pattern (`const [, startTransition]`) is gone and `isPending` is surfaced as a "Saving…" hint.
  2. `grep -c UnauthorizedError src/app/actions/watches.ts` returns `0` and `grep -c UnauthorizedError src/app/actions/preferences.ts` returns `0`; each file imports only `getCurrentUser` from `@/lib/auth`; action behavior is otherwise byte-for-byte unchanged.
  3. `.planning/phases/999.1-phase-5-code-review-followups-rls-errors/999.1-MR-03-CLOSURE.md` exists and names both migration SQL files verbatim; no new files are created under `supabase/migrations/`.
  4. `npx tsc --noEmit` exits 0 and the existing Vitest suite continues to pass with no newly-broken tests.

Source of truth: `git show b3e547b:.planning/phases/05-migration-zustand-cleanup-similarity-rewire-prod-db-bootstrap/05-REVIEW.md` (file was archived in git history at commit b3e547b).

Plans:
- [x] 999.1-01-PLAN.md — PreferencesClient error UX (MR-01) + remove dead UnauthorizedError imports (MR-02) + document MR-03 closure [Wave 1]

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 11. Schema + Storage Foundation | 5/5 | Complete    | 2026-04-22 |
| 12. Visibility Ripple in DAL | 7/7 | Complete    | 2026-04-22 |
| 13. Notifications Foundation | 5/5 | Complete    | 2026-04-23 |
| 14. Nav Shell + Explore Stub | 7/9 | In Progress|  |
| 15. WYWT Photo Post Flow | 0/TBD | Not started | - |
| 16. People Search | 0/TBD | Not started | - |
| 999.1. Phase 5 Code Review Follow-ups | 1/1 | Complete    | 2026-04-22 |

| Milestone | Phases | Status | Shipped |
|-----------|--------|--------|---------|
| v1.0 MVP | 1-5 | ✅ Complete | 2026-04-19 |
| v2.0 Taste Network Foundation | 6-10 | ✅ Complete | 2026-04-22 |
| v3.0 Production Nav & Daily Wear Loop | 11-16 | In progress | - |
