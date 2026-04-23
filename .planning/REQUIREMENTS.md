# Requirements: Horlo v3.0 — Production Nav & Daily Wear Loop

**Defined:** 2026-04-21
**Core Value:** A collector can evaluate any watch against their collection and get a meaningful, preference-aware answer about whether it adds something or just duplicates what they already own.

**Milestone Goal:** Ship the production navigation frame (top + bottom + new entry points), close the social system with notifications, and turn WYWT into a photo-first daily habit with three-tier privacy.

**Phase numbering continues from Phase 11** (v2.0 ended at Phase 10).

---

## v3.0 Requirements

### Navigation (NAV)

- [ ] **NAV-01**: Sticky mobile bottom nav (5 items: Home · Explore · Wear · Add · Profile) is always visible at `< 768px` and never hides on scroll
- [ ] **NAV-02**: Mobile bottom nav uses cradle/notch visual treatment for the elevated centered Wear CTA (semi-circular cutout in the bar with floating circle above)
- [ ] **NAV-03**: Mobile bottom nav respects iOS safe-area-inset-bottom; root layout viewport meta includes `viewport-fit=cover`; pages add `pb-[calc(4rem+env(safe-area-inset-bottom))]` to `<main>` so content does not scroll under the nav
- [ ] **NAV-04**: Active route in mobile bottom nav shows filled icon + accent color
- [ ] **NAV-05**: Mobile bottom nav and slim top nav are hidden on `/login`, `/signup`, and any pre-auth routes
- [ ] **NAV-06**: Mobile slim top nav contains logo (left) · search icon · notifications icon (with unread dot) · settings cog
- [ ] **NAV-07**: Desktop top nav at `>= 768px` contains logo · Explore link · persistent search input · Wear CTA · Add icon · notifications bell (with unread dot) · profile dropdown
- [ ] **NAV-08**: Desktop profile dropdown consolidates profile link · settings · theme toggle · sign out (theme toggle and dropdown items move out of the top nav strip)
- [ ] **NAV-09**: Mobile bottom nav Wear CTA and desktop top nav Wear CTA both open the existing `WatchPickerDialog` — single shared component, no forks (Pitfall 10)
- [ ] **NAV-10**: Add icon (desktop top nav · mobile bottom nav) routes to `/watch/new`
- [ ] **NAV-11**: `/explore` route exists with a "coming soon" placeholder page so no nav link is broken
- [ ] **NAV-12**: Existing `MobileNav` hamburger component is removed from the codebase (replaced by bottom nav)

### Notifications (NOTIF)

- [ ] **NOTIF-01**: New `notifications` table with columns `id` · `user_id` · `type` · `payload jsonb` · `read_at` · `created_at`; RLS gated by `(SELECT auth.uid()) = user_id` (InitPlan-optimized pattern)
- [ ] **NOTIF-02**: Follow action triggers a notification row insert via fire-and-forget logger (failure of insert never blocks the original action — same pattern as `logActivity`)
- [ ] **NOTIF-03**: `addWatch` Server Action triggers notification row insert per matching collector (brand+model normalized match — `LOWER(TRIM())` on both sides), fire-and-forget; self-actions excluded
- [ ] **NOTIF-04**: Notifications bell in nav shows an unread dot when `count(*) WHERE user_id = current AND read_at IS NULL > 0`; bell count read via `'use cache'`-wrapped DAL with `viewerId` as function argument
- [ ] **NOTIF-05**: `/notifications` page lists notifications newest-first with read/unread visual differentiation and a "Mark all read" action in the header
- [ ] **NOTIF-06**: "Mark all read" Server Action sets `read_at = now()` on all rows where `user_id = current AND read_at IS NULL`
- [ ] **NOTIF-07**: Stubbed UI templates for Price Drop and Trending Collector notification types render correctly when rows exist (no data wiring this milestone — types reserved in the enum)
- [ ] **NOTIF-08**: Watch-overlap notifications grouped at display time — multiple inserts for the same `(target_user, watch_brand, watch_model, calendar_day)` collapse into one rendered row with actor count ("3 collectors also own your X")
- [ ] **NOTIF-09**: Settings page exposes per-type opt-out toggles: "Notify me about new followers" and "Notify me about watch overlaps"; opt-out checked before notification insert (skip insert when off)
- [ ] **NOTIF-10**: Empty state on `/notifications` shows "You're all caught up" copy when the user has zero notifications

### People Search (SRCH)

- [ ] **SRCH-01**: `/search` route exists with 4 result tabs: All · Watches · People · Collections
- [ ] **SRCH-02**: Watches and Collections tabs show "coming soon" empty state with no query firing
- [ ] **SRCH-03**: Search input is live-debounced (250ms) and fires after a 2-character minimum
- [ ] **SRCH-04**: People results query `profiles.username` and `profiles.bio` with `pg_trgm` ILIKE; ordered by taste overlap % desc, then username asc; LIMIT 20
- [ ] **SRCH-05**: Result rows show username · bio snippet · taste overlap % · inline FollowButton
- [ ] **SRCH-06**: "No results" state shows suggested collectors (reuses Phase 10 `getCollectorsLikeUser` DAL)
- [ ] **SRCH-07**: Empty state (before query) shows suggested collectors as a discovery surface
- [ ] **SRCH-08**: `pg_trgm` extension enabled in Supabase; GIN trigram indexes on `profiles.username` and `profiles.bio`

### WYWT Photo Post Flow (WYWT)

- [ ] **WYWT-01**: Wear post is a two-step modal: Step 1 reuses `WatchPickerDialog`, Step 2 is a new photo+note+visibility form
- [ ] **WYWT-02**: Step 2 shows Selected Watch card with "Change" link returning to Step 1
- [ ] **WYWT-03**: Step 2 photo section shows two CTAs: "Take Wrist Shot" (camera) and "Upload Photo" (file picker); both optional; user may submit with no photo
- [ ] **WYWT-04**: Camera path uses `getUserMedia` + `<video>` + canvas capture with a static dotted oval overlay positioned over the video element to encourage wrist framing
- [ ] **WYWT-05**: Upload path uses `<input type="file" accept="image/*">` with HEIC → JPEG conversion via `heic2any` lazy-loaded in a Web Worker (so the WASM does not bloat the route bundle)
- [ ] **WYWT-06**: All captured/uploaded images resized to 1080px max dimension and EXIF-stripped via canvas re-encode (`canvas.toBlob('image/jpeg', 0.85)`) before upload
- [ ] **WYWT-07**: Step 2 shows a Note textarea with `0/200` character counter — plain text only (no markdown, no emoji-keyboard requirements)
- [ ] **WYWT-08**: Step 2 shows three-tier Visibility selector: Private · Followers · Public; **default = Public**; UI copy clearly labels Followers tier as "Followers only — people who follow you"
- [ ] **WYWT-09**: `wear_events` schema extended: `photo_url text NULL` · `note text NULL CHECK (length(note) <= 200)` · `visibility wear_visibility NOT NULL DEFAULT 'public'` (where `wear_visibility` is a new Postgres enum: `'public' | 'followers' | 'private'`)
- [ ] **WYWT-10**: New "Followers" privacy tier wired through every existing wear-reading DAL function with a 3-way gate (audit-first; two-layer privacy pattern from v2.0). At minimum: `getWearRailForViewer`, `getPublicWearEventsForViewer`, profile worn tab DAL, any activity-feed wear row reads
- [ ] **WYWT-11**: Existing per-user `worn_public` setting deprecated: migration backfills `wear_events.visibility` from `worn_public` (true → `'public'`, false → `'private'`); `worn_public` column removed from `profile_settings` after backfill verified
- [ ] **WYWT-12**: One wear event per `(user_id, watch_id, calendar_day)` constraint preserved (existing v2.0 rule); user CAN log multiple wear events for DIFFERENT watches in the same day; photo flow surfaces a clear error if user attempts to re-log the same watch within the same day
- [ ] **WYWT-13**: Wear photos stored in Supabase Storage bucket `wear-photos` using convention `{user_id}/{wear_event_id}.jpg`; bucket configured private (no public listing)
- [ ] **WYWT-14**: Storage `storage.objects` RLS gated three ways: `'public'` visibility → unsigned URL public read OK; `'followers'` → signed URL only when viewer follows actor; `'private'` → signed URL only when viewer = actor
- [ ] **WYWT-15**: Upload pipeline is client-direct (browser → Supabase Storage using user's session); the Server Action that writes the `wear_events` row receives the storage key and validates the object exists before persisting
- [ ] **WYWT-16**: Sonner toast on successful wear post: "Wear logged"
- [ ] **WYWT-17**: `/wear/[wearEventId]` route shows wear detail (image, watch brand+model, collector, note, timestamp); gated by 3-tier visibility for the viewer; uniform 404 on missing-or-private (no info leak via response differential)
- [ ] **WYWT-18**: Existing WYWT rail tile tap continues to open Reels-style overlay (Phase 10 pattern preserved); other entry points — notifications, feed activity rows, search results — navigate to `/wear/[wearEventId]`
- [ ] **WYWT-19**: Sonner `<Toaster />` mounted in root layout with theme integration to existing custom `ThemeProvider` (custom wrapper component — NOT the next-themes-coupled scaffold from `npx shadcn add sonner`)

### Carry-Over Debt (DEBT)

- [x] **DEBT-01**: PreferencesClient surfaces preference save failures with user-visible error UX (resolves MR-01 — currently swallowed)
- [ ] **DEBT-02**: RLS defense-in-depth audit on `users` / `watches` / `user_preferences` tables — verify policies exist, follow `(SELECT auth.uid())` InitPlan-optimized pattern, include `WITH CHECK` on UPDATE policies (resolves MR-03)

---

## Future Requirements

Tracked but explicitly NOT in v3.0 scope.

### WYWT Future

- **WYWT-FUT-01**: Edit-after-post — add a photo to a wear event already logged
- **WYWT-FUT-02**: Live wrist-pose AR overlay (auto-position watch hint in viewfinder)
- **WYWT-FUT-03**: Delete wear event action

### Notifications Future

- **NOTIF-FUT-01**: Price Drop notifications wired (requires price tracking infra — significant addition)
- **NOTIF-FUT-02**: Trending in your taste cluster notifications wired (requires aggregation / canonical watch identity work)
- **NOTIF-FUT-03**: Email digest notifications (requires custom SMTP)
- **NOTIF-FUT-04**: Real-time push / WebSocket notifications (deferred until user scale crosses Realtime free-tier limits)

### Search Future

- **SRCH-FUT-01**: Watches search tab populated (depends on canonical watch identity decisions)
- **SRCH-FUT-02**: Collections search tab populated (requires "Collections" entity — separate product surface)
- **SRCH-FUT-03**: Recent searches / search history

### Test Debt Future

- **TEST-FUT-04**: Zustand watchStore filter reducer unit tests with `beforeEach` reset (carried from v1.0 TEST-04)
- **TEST-FUT-05**: Integration test for POST `/api/extract-watch` route handler (carried from v1.0 TEST-05)
- **TEST-FUT-06**: Component tests for WatchForm, FilterBar, WatchCard (carried from v1.0 TEST-06)

### Ops Future

- **OPS-FUT-01**: Custom SMTP for email confirmation (currently OFF for personal-MVP posture)

---

## Out of Scope

Explicitly excluded with reasoning.

| Feature | Reason |
|---------|--------|
| Likes / reactions / comments on wear photos | PRODUCT-BRIEF §10: "No engagement mechanics (likes/comments)" — would change the product positioning |
| Multi-photo carousel per wear event | PRODUCT-BRIEF §2: "Lightweight interactions > heavy posting" — one wrist shot per wear keeps the data model simple and the rail fast |
| Confirmation dialog before submitting a wear log | Friction anti-pattern for a habit loop; default-to-Public + clear UI copy is the safety net |
| Bottom nav hides on scroll-down / reveals on scroll-up | PRODUCT-BRIEF §10 — Horlo is utility-discovery, not infinite-feed; nav should always be reachable |
| Hamburger menu / drawer for primary nav | Bottom nav reaches all 5 destinations in one tap; drawer adds a tap with no benefit at this scale |
| Notification badge on Explore or Add nav items | PRODUCT-BRIEF §2 — discovery > engagement; badging non-notification items conditions algorithmic-push expectation |
| Real-time toast on notification receipt | No Supabase Realtime in v3.0 (KEY DECISION carried from v2.0 — free-tier 200 WS limit) |
| Recent searches / search history | PRODUCT-BRIEF §8 implies low-frequency discovery; suggested collectors are a more useful empty state |
| Full pg_trgm similarity scoring (similarity > threshold ranking) | ILIKE is sufficient at sub-1000-user scale; trigram similarity scoring is incremental UX gain for added GIN-index complexity |
| Phase 999.1 backlog (Phase 5 code review follow-ups — full set) | Two of the three items (MR-01, MR-03) folded into v3.0 as DEBT-01/02; the third (unused UnauthorizedError import cleanup) stays in backlog |
| Wear "done today" muted CTA state | User can log multiple watches per day — muting the CTA after the first wear would be wrong; clarified during requirements scoping |

---

## Traceability

Which phases cover which requirements. Updated by `gsd-roadmapper` during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| NAV-01 | Phase 14 | Pending |
| NAV-02 | Phase 14 | Pending |
| NAV-03 | Phase 14 | Pending |
| NAV-04 | Phase 14 | Pending |
| NAV-05 | Phase 14 | Pending |
| NAV-06 | Phase 14 | Pending |
| NAV-07 | Phase 14 | Pending |
| NAV-08 | Phase 14 | Pending |
| NAV-09 | Phase 14 | Pending |
| NAV-10 | Phase 14 | Pending |
| NAV-11 | Phase 14 | Pending |
| NAV-12 | Phase 14 | Pending |
| NOTIF-01 | Phase 11 | Pending |
| NOTIF-02 | Phase 13 | Pending |
| NOTIF-03 | Phase 13 | Pending |
| NOTIF-04 | Phase 13 | Pending |
| NOTIF-05 | Phase 13 | Pending |
| NOTIF-06 | Phase 13 | Pending |
| NOTIF-07 | Phase 13 | Pending |
| NOTIF-08 | Phase 13 | Pending |
| NOTIF-09 | Phase 13 | Pending |
| NOTIF-10 | Phase 13 | Pending |
| SRCH-01 | Phase 16 | Pending |
| SRCH-02 | Phase 16 | Pending |
| SRCH-03 | Phase 16 | Pending |
| SRCH-04 | Phase 16 | Pending |
| SRCH-05 | Phase 16 | Pending |
| SRCH-06 | Phase 16 | Pending |
| SRCH-07 | Phase 16 | Pending |
| SRCH-08 | Phase 11 | Pending |
| WYWT-01 | Phase 15 | Pending |
| WYWT-02 | Phase 15 | Pending |
| WYWT-03 | Phase 15 | Pending |
| WYWT-04 | Phase 15 | Pending |
| WYWT-05 | Phase 15 | Pending |
| WYWT-06 | Phase 15 | Pending |
| WYWT-07 | Phase 15 | Pending |
| WYWT-08 | Phase 15 | Pending |
| WYWT-09 | Phase 11 | Pending |
| WYWT-10 | Phase 12 | Pending |
| WYWT-11 | Phase 11 | Pending |
| WYWT-12 | Phase 15 | Pending |
| WYWT-13 | Phase 11 | Pending |
| WYWT-14 | Phase 11 | Pending |
| WYWT-15 | Phase 15 | Pending |
| WYWT-16 | Phase 15 | Pending |
| WYWT-17 | Phase 15 | Pending |
| WYWT-18 | Phase 15 | Pending |
| WYWT-19 | Phase 15 | Pending |
| DEBT-01 | Phase 14 | Complete (fix shipped Phase 999.1; regression-lock test added Phase 14) |
| DEBT-02 | Phase 11 | Pending |

**Coverage:**
- v3.0 requirements: 51 total
- Mapped to phases: 51
- Unmapped: 0 ✓

---

*Requirements defined: 2026-04-21*
*Last updated: 2026-04-21 — traceability table populated by gsd-roadmapper; 51/51 requirements mapped across Phases 11-16*
