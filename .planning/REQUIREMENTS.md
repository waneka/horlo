# Requirements: Horlo v4.0 Discovery & Polish

**Defined:** 2026-04-26
**Core Value:** A collector can evaluate any watch against their collection and get a meaningful, preference-aware answer about whether it adds something or just duplicates what they already own.

## v4.0 Requirements

Requirements for the Discovery & Polish milestone. Each maps to roadmap phases.

### Catalog Foundation

Canonical `watches_catalog` table — silent infrastructure for v4.0. Unblocks /search Watches, /explore Trending, /search Collections by-watch-identity, and `/evaluate?catalogId=` deep-link. Per-user `watches.catalog_id` FK is **nullable indefinitely** in v4.0 (do NOT add SET NOT NULL).

- [ ] **CAT-01**: System has a `watches_catalog` table with surrogate UUID PK and natural-key UNIQUE on normalized `(brand, model, reference)` trio
- [ ] **CAT-02**: `watches_catalog` is public-readable via RLS; only the service-role Drizzle client can write (deliberate departure from two-layer privacy)
- [ ] **CAT-03**: `watches_catalog` has `pg_trgm` GIN indexes on `brand` + `model` for sub-200ms search at production scale
- [ ] **CAT-04**: `watches` table has a nullable `catalog_id` FK with `ON DELETE SET NULL` so catalog-row deletion doesn't break user collections
- [ ] **CAT-05**: An idempotent batched backfill script links existing `watches` rows to catalog entries (`WHERE catalog_id IS NULL` short-circuit + final `COUNT(*)` zero-unlinked assertion)
- [ ] **CAT-06**: System provides `upsertCatalogFromUserInput` helper using `ON CONFLICT … DO NOTHING` (typed-input path doesn't enrich catalog spec — too much typo risk)
- [ ] **CAT-07**: System provides `upsertCatalogFromExtractedUrl` helper using `ON CONFLICT … DO UPDATE SET col = COALESCE(catalog.col, EXCLUDED.col)` per nullable spec column (URL-extracted enrichment never overwrites `admin_curated` rows)
- [ ] **CAT-08**: `addWatch` Server Action and `/api/extract-watch` route handler both populate `watches_catalog` via the appropriate upsert helper
- [x] **CAT-09**: A `pg_cron` daily-batch function refreshes denormalized `owners_count` + `wishlist_count` on `watches_catalog` (prod-only; SECURITY DEFINER with REVOKE FROM PUBLIC/anon/authenticated)
- [x] **CAT-10**: A manual `npm run db:refresh-counts` script provides the same refresh path for local dev (vanilla Supabase Docker doesn't ship pg_cron)
- [ ] **CAT-11**: Catalog is authoritative for SPEC fields (movement, case_size, dial_color, complications, etc) at display time via `catalog_id` JOIN; per-user `watches` remains authoritative for OWNERSHIP/PROVENANCE fields (acquisitionDate, notes, status, etc)
- [ ] **CAT-12**: A `watches_catalog_daily_snapshots` table records `(catalog_id, date, owners_count, wishlist_count)` for 7-day Gaining Traction delta on /explore

### Discovery (/explore)

Replace the v3.0 "coming soon" stub with a real discovery surface. Three rails plus a sparse-network welcome hero.

- [ ] **DISC-03**: User can visit `/explore` and see a Server Component shell with sparse-network welcome hero conditionally rendered when `followingCount < 3 && wearEventsCount < 1`
- [ ] **DISC-04**: User can browse a Popular Collectors rail showing the most-followed public profiles (excludes self + already-followed)
- [ ] **DISC-05**: User can browse a Trending Watches rail sorted by `owners_count + wishlist_count * 0.5` using denormalized counts from CAT-09
- [ ] **DISC-06**: User can browse a Gaining Traction rail showing 7-day delta from CAT-12 daily snapshots
- [ ] **DISC-07**: User can navigate to `/explore/collectors` and `/explore/watches` "See all" routes for full lists beyond the rail caps
- [ ] **DISC-08**: BottomNav surfaces Explore as one of its 5 slots (Home / Search / Wear / Notifications / **Explore**) — replaces previous Discover entry

### Search (/search Watches + Collections)

Populate the two stub tabs from v3.0 Phase 16. Reuses the 4-tab `SearchPageClient` shell + `useSearchState` hook unchanged.

- [ ] **SRCH-09**: User can search across canonical watch catalog on /search?tab=watches with thumbnails, brand/model display, owned/wishlist badges, and an inline "Evaluate" CTA per result
- [ ] **SRCH-10**: Owned/wishlist badge hydration uses `inArray` batch query (anti-N+1, mirrors Phase 16 isFollowing pattern)
- [ ] **SRCH-11**: User can search across collections on /search?tab=collections — cross-user by-watch-identity (find collectors who own a Speedmaster) AND by-tag-profile (find collectors with style=tool)
- [ ] **SRCH-12**: /search Collections gates results on BOTH `profile_public` AND `collection_public` (two-layer privacy, latter via `profile_settings` JOIN) plus viewer self-exclusion
- [ ] **SRCH-13**: /search?tab=all unions People + Watches + Collections capped at 5 each per category
- [ ] **SRCH-14**: `useSearchState` hook is extended with AbortController per `(tab, query)` pair for safe rapid-tab-switch behavior
- [ ] **SRCH-15**: XSS-safe `<HighlightedText>` from Phase 16 is reused across all v4.0 search surfaces

### Collection Fit Surface Polish

Reframe the similarity engine as "Collection Fit" with richer contextual phrasings, and ensure it lands cleanly at the organic discovery surfaces it already touches (cross-user watch detail, /search row preview). No standalone /evaluate route — URL-paste capability moves to the Add-Watch Flow Rethink (Phase 20.1).

- [ ] **FIT-01**: System extracts a pure-renderer `<CollectionFitCard>` component from `<SimilarityBadge>`; computation moves to caller (Server Component or Client Component as appropriate to the surface)
- [ ] **FIT-02**: Verdict copy expands beyond the 6 fixed `SimilarityLabel` values into richer contextual phrasings — including "fills a hole in your collection", "aligns with your heritage-driven taste", "your collection skews [dominant style] — this is a [contrast]", "overlaps strongly with [specific watch X]"
- [ ] **FIT-03**: Cross-user `/watch/[id]` (reached via `/u/{username}/collection` → click) renders `<CollectionFitCard>` correctly framed for a watch the viewer doesn't own (verdict computes against viewer's collection + preferences vs. the other collector's watch)
- [ ] **FIT-04**: `WatchSearchRow` "Evaluate" CTA from Phase 19 is repointed from the dangling `/evaluate?catalogId=` to an inline-expand verdict preview (verdict appears in or below the row without navigation); the `/evaluate` route does not exist

### Add-Watch Flow Rethink

The add-watch flow is reorganized so URL-paste → verdict preview → status decision (wishlist / owned / skip) is a single coherent gesture. The "skip" path covers the lightweight evaluate-only use case (paste a watch found elsewhere; see fit; bail) without requiring a separate /evaluate route. Manual entry stays as a secondary affordance.

- [ ] **ADD-01**: URL-paste flow runs extract → `<CollectionFitCard>` verdict preview → 3-button status decision in a single coherent flow (replaces today's "Apply to Form" intermediate)
- [ ] **ADD-02**: "Add to Wishlist" CTA from the verdict preview commits a wishlist-status row with extracted fields and optional verdict rationale captured in `notes`
- [ ] **ADD-03**: "Add to Collection" CTA from the verdict preview commits an owned-status row with extracted fields prefilled (continues to existing form for any final edits)
- [ ] **ADD-04**: "Skip" CTA from the verdict preview closes the flow with no commit and offers "evaluate another"
- [ ] **ADD-05**: Manual entry path (no URL) is preserved as a secondary affordance and bypasses the verdict step (rare flow; users typing watches they already own)
- [ ] **ADD-06**: Catalog deep-link from `/search?tab=watches` Evaluate CTA (FIT-04 inline-expand) offers an "Add to Wishlist / Collection" path that prefills via `catalogId` (not URL extract), reusing the same verdict step
- [ ] **ADD-07**: Extraction failure inside the new flow shows a fallback that preserves any partially-extracted data and offers manual continuation (no dead-end)

### Settings Restructure

Replace the v3.0 stub Settings page (privacy-only with "other sections coming soon") with a vertical-tabs IA in canonical SaaS order.

- [ ] **SET-01**: `/settings` is a single-page vertical-tabs layout using `@base-ui/react` Tabs with `orientation="vertical"`
- [ ] **SET-02**: Tab state is hash-driven via `window.location.hash` + `useEffect` (uses `window.history.pushState`, NOT `router.push`, to avoid re-running the page Server Component loader)
- [ ] **SET-03**: Settings sections are ordered in canonical SaaS convention: Account / Profile / Preferences / Privacy / Notifications / Appearance
- [ ] **SET-04**: User can change their email from `<AccountSection>` via Supabase `updateUser({ email })` with a pending banner UI showing "Confirmation sent to both old@ and new@" — UI does NOT display the new email as current until confirmation
- [ ] **SET-05**: User can change their password from `<AccountSection>` via Supabase `updateUser({ password })` with a re-auth dialog for stale sessions older than 24h
- [ ] **SET-06**: `/auth/confirm/route.ts` is extended to switch on `type` (`signup` | `recovery` | `email_change` | `magiclink` | `invite`) with a redirect map (post-`email_change` lands on `/settings#account?status=email_changed`)
- [ ] **SET-07**: `<PreferencesSection>` exposes a `collectionGoal` select (balanced / specialist / variety-within-theme / brand-loyalist) wired to `user_preferences.collection_goal`
- [ ] **SET-08**: `<PreferencesSection>` exposes an `overlapTolerance` select (low / medium / high) wired to `user_preferences.overlap_tolerance`
- [ ] **SET-09**: `<NotificationsSection>` provides UI toggles for `notifyOnFollow` + `notifyOnWatchOverlap` (backend already wired in v3.0 Phase 13)
- [ ] **SET-10**: `<AppearanceSection>` houses the theme toggle (lifted from UserMenu's `<InlineThemeSegmented>`)
- [ ] **SET-11**: `<PrivacySection>` retains the existing privacy toggles, restyled into the vertical-tabs frame
- [ ] **SET-12**: `/preferences` route redirects to `/settings#preferences` for backward compatibility

### Email / Custom SMTP

Move off Supabase's hosted SMTP (2/hour free-tier limit) to Resend before flipping email confirmation ON. DKIM verification BEFORE flipping the toggle.

- [ ] **SMTP-01**: `horlo.app` domain is verified at Resend (SPF + DKIM + bounce MX records added at registrar; "Verified ✓" badge confirmed before any code change)
- [ ] **SMTP-02**: Supabase Dashboard SMTP creds are wired to `smtp.resend.com:465` with the Resend-issued password
- [ ] **SMTP-03**: Supabase "Confirm email" toggle is ON (only after SMTP-01 + SMTP-02 land and a Supabase Auth test email round-trips successfully)
- [ ] **SMTP-04**: Supabase "Secure password change" + "Secure email change" toggles are ON
- [ ] **SMTP-05**: A backout-plan section in `docs/deploy-db-setup.md` documents how to revert to Supabase hosted SMTP if DKIM fails post-flip
- [ ] **SMTP-06**: `mail.staging.horlo.app` (staging) and `mail.horlo.app` (prod) are separated for sender-reputation isolation

### Watch Field UI Exposure

Schema fields that exist in `watches` / `notes` today but have no user-facing edit surface. Expose them.

- [ ] **FEAT-07**: Owner can toggle `notesPublic` per-note from the WatchForm + per-row note edit surface (today the visibility pill is read-only)
- [ ] **FEAT-08**: User can toggle `isChronometer` in WatchForm and see it displayed in WatchDetail (today extracted by URL import but never editable, never displayed)

### Profile Nav Prominence

Surface profile in the top-right of every desktop screen instead of burying it behind UserMenu only. BottomNav stays at 5 slots — Profile does NOT enter BottomNav (universal social-app convention; muscle-memory risk too high).

- [ ] **NAV-13**: `DesktopTopNav` exposes a top-right avatar with dual affordance: clicking the avatar navigates to `/u/{username}`; clicking the chevron opens the existing UserMenu dropdown
- [ ] **NAV-14**: BottomNav remains 5 slots: Home / Search / **Wear** / Notifications / **Explore** (Explore replaces previous Discover slot per DISC-08)
- [ ] **NAV-15**: `SlimTopNav` (mobile <768px) exposes the same profile avatar shortcut in its top-right

### UX Polish

Empty states across the app, form feedback consistency, contextual error messaging.

- [ ] **UX-01**: Collection empty state has a single primary "Add your first watch" CTA + an "Add manually" fallback when `ANTHROPIC_API_KEY` is unset (so the CTA always works)
- [ ] **UX-02**: Wishlist empty state has a CTA to add the first wishlist watch
- [ ] **UX-03**: Worn tab empty state has a CTA to log the first wear
- [ ] **UX-04**: Notes empty state has a CTA to add the first note
- [ ] **UX-05**: URL-extract failures surface categorized errors with recovery copy: `host-403`, `structured-data-missing`, `LLM-timeout`, `quota-exceeded`, `generic-network`
- [ ] **UX-06**: Form submissions surface success via Sonner toast AND an inline `aria-live="polite"` banner (hybrid pattern from Phase 999.1 MR-01)
- [ ] **UX-07**: All Server Action submit buttons display a pending state during transition (preferences, notifications, settings sections, profile edit, mark-all-read)
- [ ] **UX-08**: Profile edit form fires a success toast on save (today there's no confirmation visible)

### WYWT Auto-Nav

Carryover from v3.0 — celebration moment after logging a wear. After both upload AND server action resolve, route to `/wear/[id]`.

- [ ] **WYWT-20**: After a successful WYWT post submission, the dialog closes and the user is auto-navigated to `/wear/{wearEventId}` (router.push fires after BOTH `uploadResult` AND `logWearWithPhoto` resolve, inside the `useTransition` callback)
- [ ] **WYWT-21**: `/wear/[wearEventId]` page wraps the photo render in `<Suspense fallback={<PhotoSkeleton />}>` to cover the 200–800ms storage-CDN propagation window before the signed URL is reachable

### Cleanup (Notification Stubs + Test Fixtures)

- [ ] **DEBT-03**: Pre-flight assertion confirms zero rows reference `price_drop` or `trending_collector` in `notifications.type` before migration
- [ ] **DEBT-04**: `notification_type` enum is recreated without dead values via the rename + recreate pattern (`ALTER TYPE … RENAME TO …_old` → `CREATE TYPE …` → `ALTER COLUMN … USING type::text::…` → `DROP TYPE …_old`)
- [ ] **DEBT-05**: Drizzle `pgEnum` definition is updated AFTER the prod migration applies; render branches and stub UI for `price_drop` + `trending_collector` are deleted from src/, tests/, scripts/, seed/
- [ ] **DEBT-06**: Test fixture cleanup — 9 test files referencing the removed `wornPublic` column are updated to use the v3.0 `wear_visibility` enum

### Tests (Carryover from v1.0)

Three test suites that have been deferred since v1.0. Pair with DEBT-06 fixture cleanup.

- [ ] **TEST-04**: Zustand `watchStore` filter reducer has unit tests with `beforeEach` reset (carried from v1.0)
- [ ] **TEST-05**: POST `/api/extract-watch` route handler has integration test coverage (carried from v1.0)
- [ ] **TEST-06**: `WatchForm`, `FilterBar`, `WatchCard` have component tests (carried from v1.0)

## Future Requirements

Acknowledged but deferred to a v4.x patch milestone or v5.0+. Not in v4.0 roadmap.

### Discovery (v4.x)

- **DISC-09**: /explore Editorial Featured Collection (admin-tooling required)
- **DISC-10**: /explore Trending feed widening past Watches → Wear shots, follows, etc.

### Search (v4.x)

- **SRCH-16**: /search Watches filter facets (Movement / Case size / Style)
- **SRCH-17**: Within-collection search via `/u/{user}?q=…` URL param

### Collection Fit (v4.x)

- **FIT-05**: "Compare with watch I own" pairwise drill-down inside `<CollectionFitCard>`
- **FIT-06**: Verdict copy A/B testing infrastructure for the FIT-02 phrasings

### Settings (v5+)

- **SET-13**: Account → Delete Account / Wipe Collection (Danger Zone — needs multi-step confirm + soft-delete cron)
- **SET-14**: Branded HTML email templates (currently using Supabase defaults via Resend)

### Catalog (v5+)

- **CAT-13**: Migrate `analyzeSimilarity()` to read from canonical catalog at JOIN time (currently catalog is silent infrastructure)
- **CAT-14**: `SET NOT NULL` on `watches.catalog_id` after 100% backfill verified across two consecutive deploys

### Polish (v4.x)

- **UX-09**: Sonner `toast.promise()` refactor for cleaner async toast lifecycle
- **UX-10**: Optimistic-update extension to status toggles (owned ↔ sold ↔ wishlist)
- **UX-11**: Preferences live preview ("here's how your similarity engine reads your taste")

## Out of Scope

Explicitly excluded from v4.0. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Taste Clusters visualization (k-means on preference vectors) | Defer to v5.0+; needs richer signal than v4.0 collection sizes provide |
| Multi-watch Comparison Tool | Adjacent product surface; defer to a focused milestone |
| Saved-search alerts | Requires notification fan-out infrastructure beyond v3.0 scope |
| Faceted search on Collections (filter by tag/role/dial-color) | Adds complexity to /search Collections; defer to v4.x |
| Realtime updates on /explore + /search | Free-tier WebSocket cap; v3.0 decision documented in PROJECT.md Key Decisions |
| Watch-overlap digest emails | Would require `resend` SDK install + scheduled job infra |
| Migrating similarity engine to read from canonical catalog | v4.0 catalog is silent infrastructure; similarity refactor is v5.0+ |
| WristOverlaySvg geometry redesign | User owns this work; not blocking v4.0 |
| AI recommendation engine (best gap filler, most versatile) | Significant new infrastructure; future milestone |
| Automated price tracking / market integrations | Requires external scraping infra; future milestone |
| Collection visualization map (2D dressy↔sporty × affordable↔expensive plot) | Future milestone after data depth grows |
| Sharing / export to others (CSV, public RSS, etc) | Future milestone |

## Traceability

Which phases cover which requirements. Populated by the roadmapper on 2026-04-26.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CAT-01 | Phase 17 — Catalog Foundation | Pending |
| CAT-02 | Phase 17 — Catalog Foundation | Pending |
| CAT-03 | Phase 17 — Catalog Foundation | Pending |
| CAT-04 | Phase 17 — Catalog Foundation | Pending |
| CAT-05 | Phase 17 — Catalog Foundation | Pending |
| CAT-06 | Phase 17 — Catalog Foundation | Pending |
| CAT-07 | Phase 17 — Catalog Foundation | Pending |
| CAT-08 | Phase 17 — Catalog Foundation | Pending |
| CAT-09 | Phase 17 — Catalog Foundation | Complete |
| CAT-10 | Phase 17 — Catalog Foundation | Complete |
| CAT-11 | Phase 17 — Catalog Foundation | Pending |
| CAT-12 | Phase 17 — Catalog Foundation | Pending |
| DISC-03 | Phase 18 — /explore Discovery Surface | Pending |
| DISC-04 | Phase 18 — /explore Discovery Surface | Pending |
| DISC-05 | Phase 18 — /explore Discovery Surface | Pending |
| DISC-06 | Phase 18 — /explore Discovery Surface | Pending |
| DISC-07 | Phase 18 — /explore Discovery Surface | Pending |
| DISC-08 | Phase 18 — /explore Discovery Surface | Pending |
| SRCH-09 | Phase 19 — /search Watches + Collections | Pending |
| SRCH-10 | Phase 19 — /search Watches + Collections | Pending |
| SRCH-11 | Phase 19 — /search Watches + Collections | Pending |
| SRCH-12 | Phase 19 — /search Watches + Collections | Pending |
| SRCH-13 | Phase 19 — /search Watches + Collections | Pending |
| SRCH-14 | Phase 19 — /search Watches + Collections | Pending |
| SRCH-15 | Phase 19 — /search Watches + Collections | Pending |
| FIT-01 | Phase 20 — Collection Fit Surface Polish + Verdict Copy | Pending |
| FIT-02 | Phase 20 — Collection Fit Surface Polish + Verdict Copy | Pending |
| FIT-03 | Phase 20 — Collection Fit Surface Polish + Verdict Copy | Pending |
| FIT-04 | Phase 20 — Collection Fit Surface Polish + Verdict Copy | Pending |
| ADD-01 | Phase 20.1 — Add-Watch Flow Rethink + Verdict-as-Step | Pending |
| ADD-02 | Phase 20.1 — Add-Watch Flow Rethink + Verdict-as-Step | Pending |
| ADD-03 | Phase 20.1 — Add-Watch Flow Rethink + Verdict-as-Step | Pending |
| ADD-04 | Phase 20.1 — Add-Watch Flow Rethink + Verdict-as-Step | Pending |
| ADD-05 | Phase 20.1 — Add-Watch Flow Rethink + Verdict-as-Step | Pending |
| ADD-06 | Phase 20.1 — Add-Watch Flow Rethink + Verdict-as-Step | Pending |
| ADD-07 | Phase 20.1 — Add-Watch Flow Rethink + Verdict-as-Step | Pending |
| SMTP-01 | Phase 21 — Custom SMTP via Resend | Pending |
| SMTP-02 | Phase 21 — Custom SMTP via Resend | Pending |
| SMTP-03 | Phase 21 — Custom SMTP via Resend | Pending |
| SMTP-04 | Phase 21 — Custom SMTP via Resend | Pending |
| SMTP-05 | Phase 21 — Custom SMTP via Resend | Pending |
| SMTP-06 | Phase 21 — Custom SMTP via Resend | Pending |
| SET-01 | Phase 22 — Settings Restructure + Account Section | Pending |
| SET-02 | Phase 22 — Settings Restructure + Account Section | Pending |
| SET-03 | Phase 22 — Settings Restructure + Account Section | Pending |
| SET-04 | Phase 22 — Settings Restructure + Account Section | Pending |
| SET-05 | Phase 22 — Settings Restructure + Account Section | Pending |
| SET-06 | Phase 22 — Settings Restructure + Account Section | Pending |
| SET-07 | Phase 23 — Settings Sections + Schema-Field UI | Pending |
| SET-08 | Phase 23 — Settings Sections + Schema-Field UI | Pending |
| SET-09 | Phase 23 — Settings Sections + Schema-Field UI | Pending |
| SET-10 | Phase 23 — Settings Sections + Schema-Field UI | Pending |
| SET-11 | Phase 23 — Settings Sections + Schema-Field UI | Pending |
| SET-12 | Phase 23 — Settings Sections + Schema-Field UI | Pending |
| FEAT-07 | Phase 23 — Settings Sections + Schema-Field UI | Pending |
| FEAT-08 | Phase 23 — Settings Sections + Schema-Field UI | Pending |
| DEBT-03 | Phase 24 — Notification Stub Cleanup + Test Fixture & Carryover | Pending |
| DEBT-04 | Phase 24 — Notification Stub Cleanup + Test Fixture & Carryover | Pending |
| DEBT-05 | Phase 24 — Notification Stub Cleanup + Test Fixture & Carryover | Pending |
| DEBT-06 | Phase 24 — Notification Stub Cleanup + Test Fixture & Carryover | Pending |
| TEST-04 | Phase 24 — Notification Stub Cleanup + Test Fixture & Carryover | Pending |
| TEST-05 | Phase 24 — Notification Stub Cleanup + Test Fixture & Carryover | Pending |
| TEST-06 | Phase 24 — Notification Stub Cleanup + Test Fixture & Carryover | Pending |
| NAV-13 | Phase 25 — Profile Nav Prominence + Empty States + Form Polish | Pending |
| NAV-14 | Phase 25 — Profile Nav Prominence + Empty States + Form Polish | Pending |
| NAV-15 | Phase 25 — Profile Nav Prominence + Empty States + Form Polish | Pending |
| UX-01 | Phase 25 — Profile Nav Prominence + Empty States + Form Polish | Pending |
| UX-02 | Phase 25 — Profile Nav Prominence + Empty States + Form Polish | Pending |
| UX-03 | Phase 25 — Profile Nav Prominence + Empty States + Form Polish | Pending |
| UX-04 | Phase 25 — Profile Nav Prominence + Empty States + Form Polish | Pending |
| UX-05 | Phase 25 — Profile Nav Prominence + Empty States + Form Polish | Pending |
| UX-06 | Phase 25 — Profile Nav Prominence + Empty States + Form Polish | Pending |
| UX-07 | Phase 25 — Profile Nav Prominence + Empty States + Form Polish | Pending |
| UX-08 | Phase 25 — Profile Nav Prominence + Empty States + Form Polish | Pending |
| WYWT-20 | Phase 26 — WYWT Auto-Nav | Pending |
| WYWT-21 | Phase 26 — WYWT Auto-Nav | Pending |

**Coverage:**
- v4.0 requirements: 76 enumerated (CAT 12 + DISC 6 + SRCH 7 + FIT 4 + ADD 7 + SET 12 + SMTP 6 + FEAT 2 + NAV 3 + UX 8 + WYWT 2 + DEBT 4 + TEST 3 = 76)
- Mapped to phases: 76 ✓
- Unmapped: 0 ✓

> **Note on count:** The original Coverage block in this file stated 64 total v4.0 requirements, but the explicitly enumerated REQ-IDs sum to 76 after the 2026-04-29 Phase 20 reshape (EVAL-01..06 removed; FIT-01..04 + ADD-01..07 added). The roadmapper has trusted the enumeration (each REQ-ID corresponds to a distinct, observable requirement). No requirements have been silently dropped or merged.

---
*Requirements defined: 2026-04-26*
*Traceability populated: 2026-04-26 — 71 requirements mapped across Phases 17–26*
*Phase 20 reshape: 2026-04-29 — EVAL-01..06 removed; FIT-01..04 + ADD-01..07 added; Phase 20.1 inserted (Add-Watch Flow Rethink). Total v4.0 requirements: 76.*
