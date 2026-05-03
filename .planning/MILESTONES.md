# Milestones

## v4.0 Discovery & Polish (Shipped: 2026-05-03)

**Phases completed:** 12 phases (17, 18, 19, 19.1, 20, 20.1, 21, 22, 23, 24, 25, 26), 65 plans
**Timeline:** 6 days (2026-04-27 → 2026-05-02)
**Scope:** 472 files changed, +97,147 / −1,959 lines, 62,322 LOC TypeScript in src/+tests/+scripts/
**Git range:** 430 commits (c573ad4 → 7132ac0)
**Audit:** `tech_debt` — 75/75 actionable requirements satisfied + 1 deferred (SMTP-06); 2 phases shipped without phase-level VERIFICATION.md (23, 24); ~33 deferred human UAT items across Phases 18 / 20 / 20.1 / 22 / 23

**Key accomplishments:**

1. **Catalog foundation + LLM taste enrichment (Phase 17 + 19.1)** — Canonical `watches_catalog` table laid silently underneath per-user `watches` with public-read RLS, service-role-only writes, `pg_trgm` GIN indexes, NULLS-NOT-DISTINCT natural-key UNIQUE, idempotent batched backfill, daily SECURITY DEFINER pg_cron count refresh + `watches_catalog_daily_snapshots` for the Gaining Traction rail. Phase 19.1 layered 8 LLM-derived taste columns (formality / sportiness / heritage_score / primary_archetype / era_signal / design_motifs / confidence / extracted_from_photo) via Anthropic Sonnet strict tool-use, fire-and-forget enrichment from both manual entry and URL extract, optional reference-photo upload to a new `catalog-source-photos` Supabase bucket. `analyzeSimilarity()` byte-locked across both phases (silent infrastructure)
2. **Discovery surface live (Phase 18)** — `/explore` Server Component shell shipped with sparse-network welcome hero (gated on `followingCount < 3 && wearEventsCount < 1`) + Popular Collectors / Trending Watches / Gaining Traction rails (per-viewer + global cacheLife with explicit `updateTag` for read-your-own-writes and `revalidateTag('explore', 'max')` for SWR fan-out). BottomNav reshaped to 5 slots: Home / Search / Wear / Explore / Profile (D-03/D-04 amend original DISC-08 wording). See-all routes at `/explore/collectors` (50-row cap) and `/explore/watches` (stacked Trending+Gaining at limit:50 each)
3. **Search Watches + Collections (Phase 19)** — Two stub tabs from v3.0 populated with anti-N+1 catalog watch search (single `inArray` viewer-state batch keyed by viewerId) and two-layer-privacy collection search (BOTH `profile_public` AND `collection_public` + viewer self-exclusion). All-tab union capped at 5 each via three independent sub-effects with per-section AbortController for safe rapid-tab-switch
4. **Collection Fit verdict reframe + Add-Watch Flow Rethink (Phase 20 + 20.1)** — Pure-renderer `<CollectionFitCard>` (no engine imports — static guard locked) replaces `<SimilarityBadge>` (deleted) across `/watch/[id]`, `/search` row inline-expand accordion, and new `/catalog/[catalogId]` route. 12-template composer (4 roadmap-mandated + 8 supporting) with confidence gating at 0.5 / 0.7 thresholds reads Phase 19.1 taste attributes via `viewerTasteProfile` Drizzle aggregate. `/evaluate` route eliminated — URL-paste capability moved into the Add-Watch Flow as `verdict-as-step`. Pasting a URL → verdict preview → 3-button decision (wishlist / owned / skip) is a single coherent gesture. Catalog deep-link from `/search?tab=watches` → `/watch/new?catalogId=X&intent=owned` short-circuits to form-prefill. Manual entry preserved as secondary affordance
5. **Custom SMTP via Resend (Phase 21)** — `mail.horlo.app` verified at Resend with SPF + DKIM + DMARC `p=none` + bounce MX records published via Cloudflare auto-configure. Supabase Auth wired to `smtp.resend.com:465` with `Horlo <noreply@mail.horlo.app>` sender. D-07 round-trip gate (Invite-User Inbox + real Gmail signup Inbox) passed before flipping toggles. Confirm email + Secure email change + Secure password change toggles all flipped ON in production. All three Auth email templates (Confirm signup / Reset Password / Change Email) standardized on canonical `/auth/callback?token_hash={{ .TokenHash }}&type=...&next=...` PKCE+SSR pattern (preempting SET-04 in Phase 22). Backout-plan section in `docs/deploy-db-setup.md` with **T-21-PREVIEWMAIL** + **T-21-WWWALLOWLIST** footguns
6. **Settings restructure + schema-field UI (Phase 22 + 23)** — `@base-ui/react` vertical-tabs shell at `/settings` with 6 sections in canonical SaaS order (Account / Profile / Preferences / Privacy / Notifications / Appearance), hash-driven via `window.history.pushState` (NOT `router.push`) so tab switching doesn't re-run the page Server Component loader. Account section ships email change with pending banner ("Confirmation sent to BOTH old@ AND new@"; T-22-S4 mitigation never displays new email as current pre-confirmation) and password change with 24h staleness `isSessionStale` re-auth dialog. `/auth/confirm/route.ts` extended to switch on `type` (5 EmailOtpType values). `/preferences` redirects to `/settings#preferences`. Preferences exposes `collectionGoal` + `overlapTolerance` Selects as dedicated top Cards. Privacy/Notifications/Appearance restyled. WatchForm exposes per-note `notesPublic` Public/Private pill + `isChronometer` Checkbox; WatchDetail renders only-if-true Certification row
7. **Notification stub cleanup + test debt paydown + polish (Phase 24 + 25 + 26)** — Pre-flight zero-row assertion + `notification_type` enum rename+recreate (with T-24-PARTIDX partial-index surgery for enum-bound dependents) eliminated `price_drop` + `trending_collector` dead code across src/, tests/, scripts/, seed/. 4 `wornPublic` test fixture files rewritten to `wear_visibility` enum. Three v1.0-carryover test suites finally landed: `watchStore` filter reducer, `/api/extract-watch` route integration, `WatchForm`/`FilterBar`/`WatchCard` component tests. Profile graduates to first-class top-right affordance — DesktopTopNav + SlimTopNav avatar dual-affordance (Link to /u/{username}, chevron to UserMenu). 4 empty-state CTAs across collection/wishlist/worn/notes (with API-key-aware Add-manually fallback). 5-category URL-extract error taxonomy (`host-403`, `structured-data-missing`, `LLM-timeout`, `quota-exceeded`, `generic-network`) with locked copy + lucide icons. Hybrid Sonner toast + inline `aria-live="polite"` form feedback rolled across 7 forms via shared `useFormFeedback` hook + `FormStatusBanner`. WYWT auto-nav with Suspense-wrapped photo render covering the 200–800ms storage-CDN propagation window. Phase 25 + 26 received UAT approval on prod commit 7132ac0

**Tech debt deferred:**

- 2 phases shipped without phase-level VERIFICATION.md (Phase 23 only has sub-plan 23-06; Phase 24 has none — implementation evidence in plan-level SUMMARYs)
- ~33 deferred human UAT items across Phases 18 / 20 / 20.1 / 22 / 23 (visual / interactive / live-network behaviors; Phase 25 + 26 UAT approved on prod)
- Nyquist VALIDATION.md drift — only 3/12 phases reached `nyquist_compliant: true` + `wave_0_complete: true` (Phases 19, 19.1, 21); Phases 25 + 26 have no VALIDATION.md
- SMTP-06 staging-prod sender split (`mail.staging.horlo.app`) — pending staging Supabase project per Phase 21 CONTEXT D-01
- REQUIREMENTS.md DISC-08 / NAV-14 wording drift (still references "Notifications" slot; Phase 18 D-03 / D-04 amended to "Profile") — implementation matches amendment, doc string never updated
- Phase 999.1 directory still in `.planning/phases/` (v3.0 archival miss)
- WatchForm.tsx CardDescription / photoError unused imports flagged in plan summaries
- Pre-existing test failures: `tests/no-raw-palette.test.ts` × 2 (font-medium UI-SPEC vs lint conflict), `tests/app/explore.test.tsx` × 3 (Phase 14 stub copy superseded by Phase 18) — pre-existing, not v4.0 fallout
- Pre-existing `LayoutProps` TS error in `src/app/u/[username]/layout.tsx:21` — carried from v3.0
- 5 Phase 20.1 UAT debug entries closed by gap-closure plans 20.1-06/07/08 — moved to `.planning/debug/resolved/` at milestone close

See `.planning/milestones/v4.0-MILESTONE-AUDIT.md` for the full audit detail.

---

## v3.0 Production Nav & Daily Wear Loop (Shipped: 2026-04-27)

**Phases completed:** 7 phases (11, 12, 13, 14, 15, 16, 999.1), 37 plans, 56 tasks
**Timeline:** 5 days (2026-04-22 → 2026-04-26)
**Scope:** 372 files changed, ~58k insertions / ~28k deletions, 21,311 LOC TypeScript in src/
**Git range:** 178 commits since 2026-04-22
**Audit:** `tech_debt` — 51/51 requirements satisfied at code level; ~30 advisory items + 31 deferred human-verification UAT items

**Key accomplishments:**

1. **Schema + storage foundation (Phase 11)** — `wear_visibility` enum (public/followers/private), `wear_events.photo_url`+`note`+`visibility` columns with `worn_public` backfill, `notifications` table with recipient-only RLS + partial UNIQUE dedup index, `pg_trgm` extension + GIN trigram indexes on `profiles.username`/`bio`, `wear-photos` private Storage bucket with three-tier SELECT RLS, SECURITY DEFINER helpers with revoked PUBLIC/anon EXECUTE, DEBT-02 RLS audit on users/watches/user_preferences (NOTIF-01, SRCH-08, WYWT-09/11/13/14, DEBT-02)
2. **Visibility ripple in DAL (Phase 12)** — Three-tier wear privacy wired through `getWearEventsForViewer` / `getWearRailForViewer` / `getFeedForUser` (jsonb metadata gate) / `addToWishlistFromWearEvent`; `worn_public` column dropped from schema + local + prod (WYWT-10/11)
3. **Notifications foundation (Phase 13)** — Fire-and-forget `logNotification` with opt-out + self-guard + internal try/catch; 6-function notifications DAL with explicit-viewerId two-layer defense; `markAllNotificationsRead` + `markNotificationRead` + `markNotificationsSeen` Server Actions; cached `NotificationBell` Server Component with per-viewer `cacheTag`; `/notifications` page with optimistic per-row read flip; Settings opt-out toggles (NOTIF-02..10)
4. **Production nav shell (Phase 14)** — Mobile `BottomNav` (5-item sticky with elevated Wear cradle), `SlimTopNav` (<768px) / `DesktopTopNav` (≥768px) split, `MobileNav` hamburger deleted, `/explore` + `/search` stubs close nav-link 404s, `/insights` retired to owner-only profile tab, `UserMenu` consolidates Profile/Settings/Theme/Sign out, shared `PUBLIC_PATHS` constant + `isPublicPath` predicate unifies proxy + nav auth gate, IBM Plex Sans + `viewport-fit=cover` metadata, DEBT-01 regression-locked (NAV-01..12, DEBT-01)
5. **WYWT photo post flow (Phase 15)** — Two-step modal (`WywtPostDialog` reuses `WatchPickerDialog` for step 1, new `ComposeStep` for photo + note + visibility); `CameraCaptureView` with `WristOverlaySvg` static guide overlay; `PhotoUploader` with HEIC→JPEG via `heic2any` lazy-loaded in Web Worker; canvas-reencoded JPEG ≤1080px with EXIF strip; client-direct upload to `wear-photos` bucket; `logWearWithPhoto` Server Action with orphan-cleanup on 23505 + non-23505; `/wear/[wearEventId]` route with three-tier gate + uniform 404 + per-request signed URL; Sonner `<ThemedToaster />` bound to custom `ThemeProvider` (WYWT-01..08, WYWT-12, WYWT-15..19)
6. **People search (Phase 16)** — `/search` 4-tab page with People populated; `searchProfiles` DAL with two-layer privacy + compound bio-search predicate + batched `isFollowing` (anti-N+1); `useSearchState` hook (250 ms debounce + AbortController + URL sync + 2-char client minimum); XSS-safe `HighlightedText`; `PeopleSearchRow` with avatar + highlighted username/bio + overlap pill + inline `FollowButton`; `DesktopTopNav` search input restyled, `HeaderNav` deleted; pg_trgm Bitmap Index Scan evidence captured via forced-plan EXPLAIN ANALYZE (SRCH-01..07)
7. **Phase 5 code-review follow-ups (Phase 999.1)** — `PreferencesClient` surfaces save failures via `role="alert"` inline banner (MR-01); dead `UnauthorizedError` imports removed (MR-02); MR-03 closed paperwork-only with in-tree note citing Phase 6 RLS migration + Phase 11 DEBT-02 audit migration

**Tech debt deferred:**
- 31 human-verification UAT items (iOS device tests, multi-session flows, FOUC checks, prod browser smoke tests)
- WristOverlaySvg geometry redesign (user owns)
- 9 test files with stale `wornPublic` references (Phase 12 fallout fixture cleanup)
- WYWT post-submit auto-navigation to `/wear/[wearEventId]` (currently dialog closes with toast only — UX enhancement, not a requirement gap)
- Pre-existing `LayoutProps` TS error in `src/app/u/[username]/layout.tsx:21`
- Nyquist coverage partial across phases — most have draft VALIDATION.md without `nyquist_compliant: true` + `wave_0_complete: true`

See `.planning/milestones/v3.0-MILESTONE-AUDIT.md` for full audit detail.

---

## v2.0 Taste Network Foundation (Shipped: 2026-04-22)

**Phases completed:** 6 phases, 21 plans, 54 tasks

**Key accomplishments:**

- Row-level security enabled on users, watches, and user_preferences with 12 owner-scoped policies using InitPlan-optimized auth.uid()
- One-liner:
- One-liner:
- `logActivity` DAL created and integrated into `addWatch` (watch_added/wishlist_added) and `markAsWorn` (watch_worn) with fire-and-forget error handling; column-drop migration awaiting user `drizzle-kit push`.
- Adds per-note visibility columns to `watches`, the profiles DAL with safe fail-open defaults, a cross-user wear-event visibility gate enforcing worn_public, Zod-strict Server Actions for profile edit / privacy toggles / note-visibility toggle, and a pure computeTasteTags function covering all six D-06 rules.
- Ships the user-visible skeleton of the profile experience: `/u/[username]/[tab]` lands on Collection by default, ProfileHeader exposes owner identity + counts + taste tags + inline edit, and `/settings` flips the four PRIV toggles with optimistic UI plus a localStorage-persisted New Note Visibility default.
- Replaces the Plan 02 placeholder tab page with three viewer-aware tab content components — Collection (filter chips + search + owner-only Add Watch card), Wishlist (target price + notes), and Notes (per-row optimistic visibility pill + remove dialog) — and adds a Zod-strict ownership-scoped `removeNote` Server Action. Per-tab and per-note visibility flags gate non-owners at the Server Component layer (PRIV-02 / PRIV-03 / PRIV-05).
- Replaces the Plan 03 fallthrough placeholder for the `worn` and `stats` tabs with full implementations: Worn ships a Timeline / Calendar segmented view, per-watch filter, and owner-only "Log Today's Wear" dialog — wired through the Plan 01 `getPublicWearEventsForViewer` DAL visibility gate (PRIV-04 + PRIV-05). Stats ships Most Worn / Least Worn / Style / Role distribution cards plus a Collection Observations panel powered by a new `src/lib/stats.ts` helper module — collection_public gates the page, with wear data gated separately through the same DAL function so 0-count cards render when worn_public=false.
- Follow/unfollow DAL + Server Actions with Zod .strict() and self-follow rejection, batched follower-list joins with no N+1, and a pure `computeTasteOverlap` library backed by a React cache()-wrapped `getTasteOverlapData` loader.
- FollowButton Client Component (3 variants) with optimistic follow/unfollow + router.refresh() reconciliation + desktop CSS hover-swap + mobile two-tap; wired into ProfileHeader non-owner slot and LockedProfileState auto-accept card; layout hydrates isFollowing server-side.
- Two Server-Component list routes (`/u/[username]/followers` + `/u/[username]/following`) with a Client-Component FollowerListCard that composes AvatarDisplay size=40 + an inline FollowButton behind an absolute-positioned Link overlay; batched `isFollowing` hydration keeps per-row initial state server-rendered without N+1.
- Single-sourced three-way Common Ground gate (viewerId && !isOwner && collectionPublic) extracted to a server-only helper; hero band + 6th tab + per-tab LockedTabCard all wired and pinned by 36 new tests across 5 files. T-09-21 / T-09-22 / T-09-23 mitigations enforced at the gate helper with payload-shape contract assertions.
- Unblocked the Phase 10 network home: expanded activities RLS to own-or-followed, enabled Next 16 Cache Components with a FOUC-free root layout refactor, and published the shared feed types + timeAgo helper every downstream plan depends on.
- Landed the Network Activity feed's read-side backbone: a two-layer-privacy keyset-paginated JOIN DAL, a pure-function time-window aggregator for F-08 bulk collapse, and a Zod-strict `loadMoreFeed` Server Action — 28 unit tests (12 + 8 + 8) green plus an 11-case integration suite that runs whenever a local Supabase stack is available.
- Shipped the WYWT rail's data-access backbone and the "Add to wishlist from wear event" Server Action — two-layer-privacy single-JOIN DAL returning deduped most-recent-per-actor tiles within a 48h rolling window, plus a Zod-strict action that snapshots watch metadata into a new wishlist row without mass-assignment risk. 17 tests green (8 unit + 9 integration-gated on the DAL side; 9 action tests fully unit).
- Delivered the three data surfaces Plan 07 needs to render the non-feed home sections — a pure `wishlistGap` fn (9 canonical roles, 10%-under-representation + no-wishlist-coverage gap detection), a `getRecommendationsForViewer` DAL that composes `tasteOverlap` + privacy-filtered candidate pool + 5-template rule-based rationale (no LLM), and a `getSuggestedCollectors` DAL with an `(overlap DESC, userId ASC)` keyset cursor for Load More — plus the `loadMoreSuggestions` Server Action. 27 unit tests green (11 + 8 + 4 + 7 — 4 unit on the Suggested DAL; 16 integration-gated tests activate with a local Supabase stack).
- Shipped the Network Activity section of the 5-section home: a Server Component that runs the Plan 02 DAL + pure aggregator and hands rows to three leaf renderers (ActivityRow, AggregatedActivityRow, FeedEmptyState), plus a 'use client' LoadMoreButton that calls `loadMoreFeed` with keyset-safe pagination and renders page-2+ rows inline via the same pure renderers — 29 behavioral tests green (10 + 6 + 7 + 6).
- Shipped the daily-retention hook of Horlo v2.0 — the WYWT rail + Instagram-Reels-style overlay + the ONE `WatchPickerDialog` component that Plan 10-08 will import for the nav `+ Wear` button. Four test suites (32 cases) all green, full repo suite (1827) still green, lint + build green on shipped files. Avoided Pitfall 10 (duplicate dialogs) and Pitfall 4 (hydration mismatch) per RESEARCH.md.
- Built the three remaining home-page sections: From Collectors Like You (cached rec rail with `'use cache'` + `cacheLife('minutes')` + prop-borne viewerId to avoid cross-user cache-key leakage), Personal Insights (4-card grid that hides entirely when viewer owns 0 watches), and Suggested Collectors (row list reusing Phase 9 FollowButton variant="inline", plus a LoadMoreSuggestionsButton mirroring Plan 05's state machine so both Load More controls on the home feel identical). 10 new components + 5 test files = 34 new unit tests, all green; full suite 2031/2031 passing, lint zero-error, `npm run build` green across all 20 routes under `cacheComponents: true`.
- Shipped the home page composition that ties Wave 1 + Wave 2 into the 5-section authenticated network home. One new client component (NavWearButton, 4 TDD tests green), one Header modification (lazy picker trigger + parallel owned-watches fetch), one full `src/app/page.tsx` replacement (5 sections in L-01 locked order). Pitfall 10 upheld — exactly one WatchPickerDialog source in the tree; NavWearButton and WywtRail both lazy-import it. Build green across 20 routes under `cacheComponents: true`, lint green on all 4 plan-08 files, full test suite 2052/2052 passing.
- Closed Phase 10 by (a) flipping REQUIREMENTS.md + ROADMAP.md to reflect the shipped 5-section scope — FEED-05 added, WYWT-03/DISC-02/DISC-04 promoted from Future into a new "Network Home" v2.0 subsection, traceability table extended with 4 Phase 10 rows, coverage 31 → 35, Phase 10 renamed "Network Home" with 9 success criteria — and (b) landing a 5-scenario end-to-end privacy test (`tests/integration/home-privacy.test.ts`) that exercises the full DAL chain (feed + WYWT rail + Suggested Collectors) against a seeded local Postgres. The E2E caught one Rule 2 correctness gap: the WYWT DAL's non-self privacy branch only checked worn_public and missed the outer profile_public gate. Patched in-flight. All 5 E2E scenarios green locally; full suite remains 2052 passing when the integration suite skips (DATABASE_URL unset).

---

## v1.0 MVP (Shipped: 2026-04-19)

**Phases completed:** 5 of 6 phases, 26 plans, 36 tasks
**Timeline:** 5 days (2026-04-10 → 2026-04-15)
**Scope:** 222 files changed, ~45k lines, 7,958 LOC TypeScript
**Git range:** 157 commits (588f47c → b3e547b)
**Tests:** 697 passing, 3 skipped (18 test files)

**Key accomplishments:**

1. **Visual polish & security hardening** — Theme system (light/dark/system), fully responsive layouts, SSRF protection with IP pinning, CSP headers, `next/image` domain allowlist, days-since-worn badges, collection balance charts
2. **Preference-aware scoring** — `complicationExceptions`, `collectionGoal` (balanced/specialist/variety), and gap-fill scoring wired into the similarity engine with full Vitest coverage
3. **Wishlist intelligence** — Deal flags, target price alerts, gap-fill scores, Good Deals + Sleeping Beauties insight sections
4. **Data layer foundation** — Drizzle ORM schema, server-only DAL with per-user scoping, Server Actions for all mutations, Supabase Postgres backing store
5. **Authentication** — Supabase Auth via `@supabase/ssr`, `proxy.ts` enforcement, double-verified auth in every Server Action and DAL function, UserMenu with no-JS logout form
6. **Zustand → Postgres migration** — All pages converted to Server Components, Zustand demoted to filter-only state, similarity engine reads from props not stores, `preferencesStore` and `useIsHydrated` deleted entirely
7. **Production deployment** — `horlo.app` live on Vercel + Supabase, verified deploy runbook (`docs/deploy-db-setup.md`) hardened with 6 real footgun fixes from actual execution

**Known gaps:**

- Phase 6 (Test Suite Completion) was not executed — TEST-04, TEST-05, TEST-06 requirements carry forward to v1.1
- 3 MEDIUM code review findings deferred to backlog 999.1 (RLS on public tables, PreferencesClient error swallowing, unused UnauthorizedError import)

---
