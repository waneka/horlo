# Roadmap: Horlo

## Milestones

- ✅ **v1.0 MVP** — Phases 1-5 (shipped 2026-04-19) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v2.0 Taste Network Foundation** — Phases 6-10 (shipped 2026-04-22) — [archive](milestones/v2.0-ROADMAP.md)
- ✅ **v3.0 Production Nav & Daily Wear Loop** — Phases 11-16 + 999.1 (shipped 2026-04-27) — [archive](milestones/v3.0-ROADMAP.md)
- 🚧 **v4.0 Discovery & Polish** — Phases 17-26 (in progress)

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

<details>
<summary>✅ v3.0 Production Nav & Daily Wear Loop (Phases 11-16 + 999.1) — SHIPPED 2026-04-27</summary>

- [x] Phase 11: Schema + Storage Foundation (5/5 plans)
- [x] Phase 12: Visibility Ripple in DAL (7/7 plans)
- [x] Phase 13: Notifications Foundation (5/5 plans)
- [x] Phase 14: Nav Shell + Explore Stub (9/9 plans)
- [x] Phase 15: WYWT Photo Post Flow (5/5 plans)
- [x] Phase 16: People Search (5/5 plans)
- [x] Phase 999.1: Phase 5 Code Review Follow-ups (1/1 plan, inserted)

51/51 requirements shipped at code level. Cross-phase integration verified. Audit status `tech_debt` — 31 deferred human-verification UAT items + ~30 advisory tech-debt items, none blocking.

See [v3.0-ROADMAP.md](milestones/v3.0-ROADMAP.md) for full phase details and [v3.0-MILESTONE-AUDIT.md](milestones/v3.0-MILESTONE-AUDIT.md) for the audit report.

</details>

### 🚧 v4.0 Discovery & Polish (In Progress)

**Milestone Goal:** Finish v3.0-era stubs (`/explore`, `/search` Watches/Collections, Settings expansion), expose schema-driven knobs that already exist behind the scenes (`collectionGoal`, `overlapTolerance`, `notesPublic`, `isChronometer`), surface the similarity engine as a first-class `/evaluate` flow, lay the canonical `watches_catalog` foundation that unblocks future cross-user features, raise profile prominence, and ship empty-state CTAs + WYWT auto-nav + form-feedback polish + dead-stub cleanup.

- [x] **Phase 17: Catalog Foundation** — `watches_catalog` schema + RLS + nullable FK + idempotent backfill + two upsert helpers + pg_cron daily counts + daily snapshots (completed 2026-04-27)
- [ ] **Phase 18: /explore Discovery Surface** — Server Component shell with sparse-network hero + Popular Collectors / Trending / Gaining Traction rails + BottomNav slot wiring
- [ ] **Phase 19: /search Watches + Collections** — Catalog-backed Watches tab + cross-user Collections tab (two-layer privacy) + All-tab union + tab-aware AbortController
- [ ] **Phase 20: /evaluate Route + Verdict UI** — Auth-only route, paste-URL flow, shared `<SimilarityVerdictCard>` pure renderer, three-CTA ladder, `?catalogId=` deep-link from /search
- [ ] **Phase 21: Custom SMTP via Resend** — DNS verify + Supabase SMTP wire + Confirm-email/Secure-change toggles ON + staging/prod sender split + backout-plan doc
- [ ] **Phase 22: Settings Restructure + Account Section** — base-ui vertical-tabs shell with hash routing + canonical SaaS section order + email/password change with re-auth + `/auth/confirm` type-switched redirect map + `/preferences` redirect
- [ ] **Phase 23: Settings Sections + Schema-Field UI** — Preferences (collectionGoal + overlapTolerance) + Notifications (opt-out toggles) + Privacy (restyled) + Appearance (theme) + WatchForm `notesPublic` per-note + `isChronometer` toggle/display
- [ ] **Phase 24: Notification Stub Cleanup + Test Fixture/Carryover** — Pre-flight zero-row assertion + ENUM rename+recreate + Drizzle update + dead-code deletion + 9-file `wornPublic` fixture cleanup + TEST-04/05/06
- [ ] **Phase 25: Profile Nav Prominence + Empty States + Form Polish** — DesktopTopNav/SlimTopNav avatar dual-affordance + 4 empty-state CTAs + categorized URL-extract errors + Sonner+aria-live hybrid + Server Action pending states + profile-edit success toast
- [ ] **Phase 26: WYWT Auto-Nav** — Post-submit `router.push(/wear/{id})` after both upload + server-action resolve + `<Suspense fallback={<PhotoSkeleton />}>` for storage-CDN propagation window

## Phase Details

### Phase 17: Catalog Foundation
**Goal**: A canonical `watches_catalog` table is laid silently underneath per-user `watches`, populated from both manual entry and URL extraction, and refreshed daily — unblocking /search Watches, /explore Trending, and /evaluate deep-link without modifying `analyzeSimilarity()`.
**Depends on**: Nothing (first phase of v4.0; v3.0 production frame is the substrate)
**Requirements**: CAT-01, CAT-02, CAT-03, CAT-04, CAT-05, CAT-06, CAT-07, CAT-08, CAT-09, CAT-10, CAT-11, CAT-12
**Success Criteria** (what must be TRUE):
  1. The DB has a `watches_catalog` table that an anonymous Supabase client can read but cannot write to (public-read RLS, service-role-only writes).
  2. Adding a watch via the existing form OR via URL extraction populates `watches_catalog` and links the per-user `watches` row by `catalog_id` (URL extraction enriches missing fields; typed input never overwrites).
  3. Existing `watches` rows from before the migration have non-NULL `catalog_id` after the backfill script runs once — and re-running the script is a no-op.
  4. `owners_count` and `wishlist_count` on `watches_catalog` refresh daily in production via `pg_cron`, and a developer can refresh them locally with `npm run db:refresh-counts`.
  5. A `watches_catalog_daily_snapshots` row is recorded per catalog row per day, providing the data substrate for the Phase 18 Gaining Traction rail.
**Plans**: 6 plans
- [x] 17-01-PLAN.md — Schema migration (Drizzle column shapes + Supabase migration with RLS, generated columns, NULLS NOT DISTINCT UNIQUE, GIN, CHECK, snapshots, [BLOCKING] local push)
- [x] 17-02-PLAN.md — Catalog DAL (`src/data/catalog.ts` upsert helpers + `linkWatchToCatalog` in `src/data/watches.ts` + URL/tag sanitizers + 9 upsert-coalesce tests)
- [x] 17-03-PLAN.md — Wire catalog into `addWatch` Server Action and `/api/extract-watch` route (fire-and-forget; resilience test)
- [x] 17-04-PLAN.md — Backfill script `scripts/backfill-catalog.ts` + `npm run db:backfill-catalog` + idempotency test
- [x] 17-05-PLAN.md — pg_cron SECDEF refresh function + REVOKE/GRANT lockdown + `scripts/refresh-counts.ts` + `npm run db:refresh-counts` + [BLOCKING] local apply + SECDEF tests
- [x] 17-06-PLAN.md — docs/deploy-db-setup.md Phase 17 runbook + PROJECT.md Key Decisions + image-provenance round-trip test

### Phase 18: /explore Discovery Surface
**Goal**: The v3.0 "coming soon" `/explore` stub is replaced with a Server-Component discovery surface that surfaces popular collectors and rising-watch signals, with a welcoming empty-state hero for sparse-network users — and Explore claims its rightful slot in the BottomNav.
**Depends on**: Phase 17 (Trending + Gaining Traction rails consume catalog counts; Popular Collectors does not strictly need catalog but ships in the same surface)
**Requirements**: DISC-03, DISC-04, DISC-05, DISC-06, DISC-07, DISC-08
**Success Criteria** (what must be TRUE):
  1. Visiting `/explore` shows a Server Component shell that renders a sparse-network welcome hero when the viewer has fewer than 3 follows AND zero wear events.
  2. The viewer sees a Popular Collectors rail showing the most-followed public profiles (excluding self and already-followed) and can navigate to `/explore/collectors` for the full list.
  3. The viewer sees a Trending Watches rail (sorted by `owners_count + wishlist_count * 0.5`) and can navigate to `/explore/watches` for the full list.
  4. The viewer sees a Gaining Traction rail showing 7-day delta from `watches_catalog_daily_snapshots`.
  5. The mobile BottomNav shows Explore as one of its 5 slots (Home / Search / Wear / Notifications / **Explore**), replacing the previous Discover entry.
**Plans**: TBD
**UI hint**: yes

### Phase 19: /search Watches + Collections
**Goal**: The two stub tabs from v3.0 Phase 16 (`?tab=watches` and `?tab=collections`) are populated with real, debounced, anti-N+1, two-layer-privacy results — and the All tab unions all four sources.
**Depends on**: Phase 17 (Watches tab queries `watches_catalog`; Collections tab joins `watches` to `profiles` with viewer-state badges that need catalog identity to be efficient)
**Requirements**: SRCH-09, SRCH-10, SRCH-11, SRCH-12, SRCH-13, SRCH-14, SRCH-15
**Success Criteria** (what must be TRUE):
  1. Typing a query into `/search?tab=watches` returns catalog matches with thumbnails, brand/model, owned/wishlist badges, and an inline "Evaluate" CTA per result.
  2. Owned/wishlist badge hydration uses a single batched `inArray` query (no per-row N+1) verified by query log.
  3. Typing a query into `/search?tab=collections` returns matches that satisfy BOTH `profile_public = true` AND `collection_public = true` (verified via two-layer privacy integration test) and excludes the viewer's own collection.
  4. The `/search?tab=all` view surfaces People + Watches + Collections capped at 5 each.
  5. Rapidly switching tabs while typing aborts in-flight requests for the previous tab (per-tab AbortController) and never displays results from the wrong tab.
**Plans**: TBD
**UI hint**: yes

### Phase 20: /evaluate Route + Verdict UI
**Goal**: The similarity engine — Horlo's core value prop — is surfaced as a first-class flow at `/evaluate` instead of being buried inside watch-detail cards. Auth-only in v4.0 (anonymous redirect to /signin). Both URL-paste entry and `/search`-deep-link entry are supported.
**Depends on**: Phase 17 (for `?catalogId=` deep-link path) and Phase 19 (for the inline "Evaluate" CTA on /search Watches results); URL-paste path is independent and could ship earlier
**Requirements**: EVAL-01, EVAL-02, EVAL-03, EVAL-04, EVAL-05, EVAL-06
**Success Criteria** (what must be TRUE):
  1. Anonymous viewers visiting `/evaluate` are redirected to `/signin`; authenticated viewers reach a `<Suspense>`-wrapped page body.
  2. Pasting a watch URL into the form runs `/api/extract-watch` server-side and `analyzeSimilarity()` client-side, then renders the verdict inline without a full-page reload.
  3. The verdict surface presents three CTAs in a clear ladder — "Save to Evaluate Later" (creates a wishlist row with rationale in `notes`), "Add to Wishlist", "Add to Collection".
  4. Visiting `/evaluate` with no URL provided shows a meaningful empty-state with copy explaining the flow.
  5. Clicking "Evaluate" on a /search Watches result row deep-links to `/evaluate?catalogId={uuid}` and skips the URL-paste step entirely.
**Plans**: TBD
**UI hint**: yes

### Phase 21: Custom SMTP via Resend
**Goal**: Auth confirmation emails leave Supabase's hosted SMTP (2/h free-tier limit) and route through Resend with verified DKIM — and Confirm-email is flipped ON only after successful round-trip — so new signups receive their confirmation links in inbox not spam.
**Depends on**: Nothing (independent of catalog work; long DNS lead-time means this can ship in parallel with Phase 17)
**Requirements**: SMTP-01, SMTP-02, SMTP-03, SMTP-04, SMTP-05, SMTP-06
**Success Criteria** (what must be TRUE):
  1. The `horlo.app` domain shows "Verified ✓" in Resend (SPF + DKIM + bounce MX records propagated and confirmed BEFORE any code/config change downstream).
  2. Supabase Dashboard → Auth → SMTP Settings is wired to `smtp.resend.com:465` with the Resend-issued password, and a Supabase Auth test email round-trips successfully.
  3. The Supabase "Confirm email" + "Secure password change" + "Secure email change" toggles are all ON in production (only after step 2 passes).
  4. `mail.staging.horlo.app` (staging) and `mail.horlo.app` (prod) are separated so a staging deliverability incident cannot tank production sender reputation.
  5. `docs/deploy-db-setup.md` has a backout-plan section documenting how to revert to Supabase hosted SMTP if DKIM fails post-flip.
**Plans**: TBD

### Phase 22: Settings Restructure + Account Section
**Goal**: The v3.0 stub `/settings` page (privacy-only with "other sections coming soon") is replaced with a base-ui vertical-tabs shell in canonical SaaS order, and the Account section ships email/password change wired to Supabase `updateUser` with the correct re-auth + dual-confirmation UX.
**Depends on**: Phase 21 (email-change flow requires custom SMTP delivering confirmation links to both old and new addresses)
**Requirements**: SET-01, SET-02, SET-03, SET-04, SET-05, SET-06
**Success Criteria** (what must be TRUE):
  1. `/settings` renders a single-page vertical-tabs layout (`@base-ui/react` Tabs with `orientation="vertical"`) with sections in canonical order: Account / Profile / Preferences / Privacy / Notifications / Appearance.
  2. Tab state is hash-driven (`#account`, `#preferences`, etc.) using `window.history.pushState` (NOT `router.push`), so switching tabs doesn't re-run the page Server Component loader.
  3. The viewer can change email from Account; UI shows a pending banner ("Confirmation sent to both old@ and new@") and does NOT display the new email as current until confirmation lands.
  4. The viewer can change password from Account; sessions older than 24h trigger a re-auth dialog before the change applies.
  5. Clicking the email-change confirmation link routes through `/auth/confirm/route.ts` (extended to switch on `type`) and lands on `/settings#account?status=email_changed` with a success toast; the legacy `/preferences` route redirects to `/settings#preferences`.
**Plans**: TBD
**UI hint**: yes

### Phase 23: Settings Sections + Schema-Field UI
**Goal**: The five Settings sections beyond Account are populated with the schema-driven knobs that exist in the database today but have no user-facing edit surface — exposing `collectionGoal`, `overlapTolerance`, `notifyOnFollow`/`notifyOnWatchOverlap`, theme switch, privacy toggles, plus per-note `notesPublic` and `isChronometer` on watches.
**Depends on**: Phase 22 (tabs shell)
**Requirements**: SET-07, SET-08, SET-09, SET-10, SET-11, SET-12, FEAT-07, FEAT-08
**Success Criteria** (what must be TRUE):
  1. The Preferences section exposes a `collectionGoal` select (balanced / specialist / variety-within-theme / brand-loyalist) and an `overlapTolerance` select (low / medium / high), both wired to `user_preferences` and reflected by `analyzeSimilarity()` on next read.
  2. The Notifications section exposes UI toggles for `notifyOnFollow` and `notifyOnWatchOverlap` (backend already wired in v3.0 Phase 13).
  3. The Privacy section retains existing toggles, restyled into the vertical-tabs frame; the Appearance section houses the theme switch (lifted from UserMenu's `<InlineThemeSegmented>`).
  4. The owner can toggle `notesPublic` per-note from the WatchForm and from the per-row note edit surface (today the visibility pill is read-only).
  5. The owner can toggle `isChronometer` in WatchForm and see it displayed in WatchDetail (today extracted by URL import but never editable, never displayed).
**Plans**: TBD
**UI hint**: yes

### Phase 24: Notification Stub Cleanup + Test Fixture & Carryover
**Goal**: The v3.0 dead-code stubs (`price_drop`, `trending_collector` notification types) are removed from the enum + Drizzle + render branches via the rename+recreate pattern, the 9 test files referencing the removed `wornPublic` column are updated to the v3.0 `wear_visibility` enum, and the three test suites carried from v1.0 (TEST-04/05/06) finally land.
**Depends on**: Nothing (independent — schedule when convenient; this is the only phase whose ordering does not affect any other phase)
**Requirements**: DEBT-03, DEBT-04, DEBT-05, DEBT-06, TEST-04, TEST-05, TEST-06
**Success Criteria** (what must be TRUE):
  1. A pre-flight assertion confirms zero rows reference `price_drop` or `trending_collector` in `notifications.type` BEFORE the migration runs.
  2. The `notification_type` enum is recreated without dead values via the rename+recreate pattern (`ALTER TYPE … RENAME TO …_old` → `CREATE TYPE …` → `ALTER COLUMN … USING type::text::…` → `DROP TYPE …_old`); Drizzle `pgEnum` is updated AFTER the prod migration applies.
  3. Render branches and stub UI for `price_drop` + `trending_collector` are deleted across `src/`, `tests/`, `scripts/`, and `seed/`.
  4. The 9 test files that reference the removed `wornPublic` column are updated to use the `wear_visibility` enum, and the test suite is fully green again.
  5. `watchStore` filter reducer has unit tests with `beforeEach` reset (TEST-04), POST `/api/extract-watch` has integration coverage (TEST-05), and `WatchForm` / `FilterBar` / `WatchCard` have component tests (TEST-06).
**Plans**: TBD

### Phase 25: Profile Nav Prominence + Empty States + Form Polish
**Goal**: Profile graduates from "buried in dropdown" to first-class top-right affordance on every screen; collection / wishlist / worn / notes empty states get single-primary-CTA welcomes; URL-extract failures get categorized recovery copy; every Server Action surfaces success and pending states consistently.
**Depends on**: Phases 17–24 (polish phase needs all functional surfaces existing to link CTAs correctly and to avoid restyling churn)
**Requirements**: NAV-13, NAV-14, NAV-15, UX-01, UX-02, UX-03, UX-04, UX-05, UX-06, UX-07, UX-08
**Success Criteria** (what must be TRUE):
  1. The `DesktopTopNav` and `SlimTopNav` (mobile <768px) both expose a top-right avatar with dual affordance — clicking the avatar navigates to `/u/{username}`, clicking the chevron opens the existing UserMenu dropdown — and BottomNav remains 5 slots (Profile does NOT enter BottomNav).
  2. Each of the four empty states (Collection / Wishlist / Worn / Notes) has a single primary CTA; the Collection empty state has an "Add manually" fallback when `ANTHROPIC_API_KEY` is unset.
  3. URL-extract failures surface categorized errors with recovery copy: `host-403`, `structured-data-missing`, `LLM-timeout`, `quota-exceeded`, `generic-network`.
  4. Form submissions across the app surface success via Sonner toast AND an inline `aria-live="polite"` banner (hybrid pattern from Phase 999.1 MR-01); the profile edit form fires a success toast on save (today there is no confirmation visible).
  5. Every Server Action submit button (preferences, notifications, settings sections, profile edit, mark-all-read) displays a pending state during transition.
**Plans**: TBD
**UI hint**: yes

### Phase 26: WYWT Auto-Nav
**Goal**: The v3.0 deferred celebration moment ships — after a successful WYWT post, the user is auto-navigated to `/wear/{wearEventId}` with a Suspense-wrapped photo render that gracefully covers the 200–800ms storage-CDN propagation window.
**Depends on**: Nothing (small, isolated; independent of the rest of v4.0)
**Requirements**: WYWT-20, WYWT-21
**Success Criteria** (what must be TRUE):
  1. After a successful WYWT post submission, the dialog closes and the user is auto-navigated to `/wear/{wearEventId}` — `router.push` fires only after BOTH `uploadResult` AND `logWearWithPhoto` resolve, inside the `useTransition` callback.
  2. The `/wear/[wearEventId]` page wraps the photo render in `<Suspense fallback={<PhotoSkeleton />}>` so the user sees a skeleton (not a broken image) during the 200–800ms storage-CDN propagation window before the signed URL is reachable.
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 17 → 18 → 19 → 20 → 21 → 22 → 23 → 24 → 25 → 26.
Phases 21 (SMTP DNS lead-time) and 24 (cleanup) are independent and may ship in parallel where convenient. Phase 25 must land last (polish needs all surfaces present).

| Milestone | Phase | Plans Complete | Status | Completed |
|-----------|-------|----------------|--------|-----------|
| v1.0 MVP | 1-5 | 26/26 | ✅ Complete | 2026-04-19 |
| v2.0 Taste Network Foundation | 6-10 | 21/21 | ✅ Complete | 2026-04-22 |
| v3.0 Production Nav & Daily Wear Loop | 11-16 + 999.1 | 37/37 | ✅ Complete | 2026-04-27 |
| v4.0 Discovery & Polish | 17. Catalog Foundation | 0/6 | Not started | - |
| v4.0 Discovery & Polish | 18. /explore Discovery Surface | 0/TBD | Not started | - |
| v4.0 Discovery & Polish | 19. /search Watches + Collections | 0/TBD | Not started | - |
| v4.0 Discovery & Polish | 20. /evaluate Route + Verdict UI | 0/TBD | Not started | - |
| v4.0 Discovery & Polish | 21. Custom SMTP via Resend | 0/TBD | Not started | - |
| v4.0 Discovery & Polish | 22. Settings Restructure + Account Section | 0/TBD | Not started | - |
| v4.0 Discovery & Polish | 23. Settings Sections + Schema-Field UI | 0/TBD | Not started | - |
| v4.0 Discovery & Polish | 24. Notification Stub Cleanup + Test Fixture & Carryover | 0/TBD | Not started | - |
| v4.0 Discovery & Polish | 25. Profile Nav Prominence + Empty States + Form Polish | 0/TBD | Not started | - |
| v4.0 Discovery & Polish | 26. WYWT Auto-Nav | 0/TBD | Not started | - |
