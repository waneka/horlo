# Horlo

## What This Is

A taste-aware watch collection intelligence system for personal collectors. Users manage their collection and wishlist, understand how their watches relate to each other, and make more intentional buying decisions. The core insight engine evaluates any watch against the user's collection and preferences to produce a semantic label (Core Fit, Role Duplicate, Hard Mismatch, etc.) rather than a raw score.

Shipped as a cloud-backed, authenticated web app at [horlo.app](https://horlo.app) — data persists across devices and browsers via Supabase Postgres.

## Core Value

A collector can evaluate any watch against their collection and get a meaningful, preference-aware answer about whether it adds something or just duplicates what they already own.

## Current State

**Shipped:** v3.0 Production Nav & Daily Wear Loop (2026-04-27)

Production navigation frame, three-tier wear privacy, notifications system, photo-first WYWT post flow with `/wear/[id]` detail route, and people search are all live. 51/51 v3.0 requirements satisfied at code level. See `.planning/milestones/v3.0-MILESTONE-AUDIT.md` for the audit (status: `tech_debt` — no blockers, 31 deferred UAT items + ~30 advisory items).

**Next:** Run `/gsd-new-milestone` to scope the next version.

## Requirements

### Validated

- ✓ Watch CRUD — add, edit, delete; status transitions (owned → sold, wishlist → owned) — existing
- ✓ Collection grid — card layout with image, brand/model, key specs — existing
- ✓ Status toggle — owned / wishlist / sold / grail views — existing
- ✓ Filter bar — status, style tags, role tags, dial color filters — existing
- ✓ Tagging system — style, design traits, and role tags per watch — existing
- ✓ User preferences — styles, design traits, complications, dial colors, overlap tolerance — existing
- ✓ Similarity engine — 3-layer scoring (objective similarity → role overlap → preference adjustment) with semantic labels — existing
- ✓ Collection balance analysis — distribution of style, role, dial color across owned watches — existing
- ✓ URL import — 3-stage extraction pipeline (structured data → HTML selectors → LLM fallback) — existing
- ✓ Wear tracking — "mark as worn today" stores lastWornDate on each watch — existing
- ✓ UI polish — spacing, typography, color system, dark/light/system theme toggle — v1.0 (VIS-01/02/03)
- ✓ Better data display — richer watch cards, improved detail view, days-since-worn, balance charts — v1.0 (VIS-04/05/06)
- ✓ Mobile / responsive — usable on phone and tablet — v1.0 (VIS-02)
- ✓ Dark mode — full dark/light mode toggle with system preference detection — v1.0 (VIS-01)
- ✓ SSRF hardening — IP pinning, redirect validation, protocol allowlist — v1.0 (SEC-01)
- ✓ Image security — `next/image` with `remotePatterns` domain allowlist — v1.0 (SEC-02)
- ✓ Fix complicationExceptions — exceptions applied in similarity scoring — v1.0 (FEAT-01)
- ✓ Fix collectionGoal — balanced/specialist/variety influences thresholds and insights — v1.0 (FEAT-02)
- ✓ Wishlist intelligence — deal flags, target price, gap-fill scores, actionable wishlist — v1.0 (FEAT-03/04/05)
- ✓ Wear tracking insights — "haven't worn in X days", Sleeping Beauties panel — v1.0 (VIS-05)
- ✓ UUID watch IDs — `crypto.randomUUID()` replaces Date.now() IDs — v1.0 (FEAT-06)
- ✓ Authentication — Supabase Auth email/password, proxy.ts enforcement, double-verified in DAL + Server Actions — v1.0 (AUTH-01/02/03/04)
- ✓ Cloud persistence — Supabase Postgres via Drizzle ORM, server-only DAL, Server Actions — v1.0 (DATA-01/02/03/04/05)
- ✓ Similarity engine props — receives collection + preferences as props, not Zustand reads — v1.0 (DATA-05)
- ✓ Prod deploy runbook — verified `docs/deploy-db-setup.md` with 6 footgun fixes — v1.0 (OPS-01)
- ✓ Test foundation — Vitest + React Testing Library + MSW configured — v1.0 (TEST-01)
- ✓ Similarity tests — all six SimilarityLabel outputs covered including preference-aware paths — v1.0 (TEST-02)
- ✓ Extractor pipeline tests — structured, HTML, merge logic with fixture HTML — v1.0 (TEST-03)
- ✓ Follow / unfollow (social graph) — v2.0 Phase 9 (FOLL-01, FOLL-02)
- ✓ Follower counts — v2.0 Phase 9 (FOLL-03)
- ✓ Follower / following list routes — v2.0 Phase 9 (FOLL-04)
- ✓ Read-only public collection at `/u/[username]` with per-tab privacy gating — v2.0 Phase 9 (PROF-08)
- ✓ Common Ground taste overlap (server-computed; result-only to client) — v2.0 Phase 9 (PROF-09)
- ✓ 5-section Network Home — WYWT rail + Network Activity feed + Collectors Like You + Personal Insights + Suggested Collectors — v2.0 Phase 10 (FEED-01..05, WYWT-03, DISC-02, DISC-04)
- ✓ Nav `+ Wear` button wired to shared WatchPickerDialog — v2.0 Phase 10 (WYWT-03)
- ✓ Cache Components enabled (Next.js 16 `cacheComponents: true`) with canonical Suspense+inline-theme-script layout pattern — v2.0 Phase 10
- ✓ Schema + storage foundation — `wear_visibility` enum (public/followers/private), `wear_events.photo_url`+`note`+`visibility` columns with `worn_public` backfill, `notifications` table + `notification_type` enum with recipient-only RLS + partial UNIQUE dedup, `pg_trgm` + GIN trigram indexes on `profiles.username`/`bio`, `wear-photos` private Supabase Storage bucket with three-tier SELECT RLS + folder-enforcement INSERT/UPDATE/DELETE, SECURITY DEFINER helpers with revoked PUBLIC/anon EXECUTE, and DEBT-02 RLS audit on users/watches/user_preferences — v3.0 Phase 11 (WYWT-09, WYWT-11, WYWT-13, WYWT-14, NOTIF-01, SRCH-08, DEBT-02)
- ✓ Visibility ripple in DAL — `getWearEventsForViewer` (renamed from `getPublicWearEventsForViewer`) with three-tier predicate (owner bypass + per-row follow check + public/followers visibility OR), `getWearRailForViewer` leftJoin(follows) with per-row visibility, feed hot path uses `metadata->>'visibility' IN ('public','followers')` gate, wishlist `addToWishlistFromWearEvent` gates on `wear_events.visibility` + follows with Letterboxd-style uniform "not found" error, Worn History settings toggle retired, `worn_public` column dropped from schema + local + prod DB — v3.0 Phase 12 (WYWT-10, WYWT-11)
- ✓ Phase 5 code-review follow-ups — `PreferencesClient` surfaces save failures via `role="alert"` inline banner with `aria-live="polite"` "Saving…" indicator (MR-01); dead `UnauthorizedError` imports removed from `src/app/actions/watches.ts` and `src/app/actions/preferences.ts` (MR-02); MR-03 closed paperwork-only with in-tree note `999.1-MR-03-CLOSURE.md` citing Phase 6 RLS migration + Phase 11 DEBT-02 audit migration as evidence (no new SQL) — v3.0 Phase 999.1 (MR-01, MR-02, MR-03)
- ✓ Notifications foundation — fire-and-forget `logNotification` logger with D-18 opt-out + D-24 self-guard + D-27 internal try/catch; 6-function notifications DAL with explicit-viewerId two-layer defense (D-25); `markAllNotificationsRead` + `markNotificationRead` + `markNotificationsSeen` Server Actions using Next 16 `updateTag()` (not `revalidateTag`) for read-your-own-writes correctness; pure-UI NotificationRow (Client Component with `useOptimistic` + `useTransition` + `useRouter` for D-08 per-row optimistic read flip), NotificationsInbox (Today/Yesterday/Earlier grouping + NOTIF-08 watch_overlap display-time collapse), NotificationsEmptyState; cached NotificationBell Server Component (`'use cache'` + `cacheTag('notifications', 'viewer:${viewerId}')` + `cacheLife({revalidate:30})`); `/notifications` page with client-mount `MarkNotificationsSeenOnMount` (avoids render-time revalidation per Next 16 Cache Components); Settings Notifications section with `notifyOnFollow` + `notifyOnWatchOverlap` opt-out toggles; `followUser` + `addWatch` Server Actions await `logNotification` and invalidate the recipient's `viewer:` tag on write; dedup end-to-end contract verified via partial UNIQUE index integration test — v3.0 Phase 13 (NOTIF-02..10)
- ✓ Production nav shell — Mobile `BottomNav` (5-item sticky with elevated Wear cradle), `SlimTopNav` (<768px) / `DesktopTopNav` (≥768px) split, `MobileNav` hamburger deleted, `/explore` + `/search` stubs close nav-link 404s, `/insights` retired to owner-only profile tab with two-layer P-08 privacy defense, `UserMenu` consolidates Profile/Settings/Theme/Sign out via `InlineThemeSegmented`, shared `PUBLIC_PATHS` constant + `isPublicPath` predicate unifies proxy + nav auth gate, IBM Plex Sans + `viewport-fit=cover` metadata, DEBT-01 regression-locked — v3.0 Phase 14 (NAV-01..12, DEBT-01)
- ✓ WYWT photo post flow — Two-step `WywtPostDialog` (reuses `WatchPickerDialog` for step 1, `ComposeStep` for photo+note+visibility); `CameraCaptureView` with `WristOverlaySvg` static guide overlay; `PhotoUploader` with HEIC→JPEG via `heic2any` lazy-loaded in Web Worker; canvas-reencoded JPEG ≤1080px with EXIF strip; client-direct upload to `wear-photos` bucket; `logWearWithPhoto` Server Action with orphan-cleanup on 23505 + non-23505; `/wear/[wearEventId]` route with three-tier gate + uniform 404 + per-request signed URL; Sonner `<ThemedToaster />` bound to custom `ThemeProvider` outside Suspense — v3.0 Phase 15 (WYWT-01..08, WYWT-12, WYWT-15..19)
- ✓ People search — `/search` 4-tab page (All / Watches / People / Collections) with People populated and the other three tabs showing "coming soon" cards (no query firing); `searchProfiles` DAL using `pg_trgm` ILIKE on `username` + bio search gated at `q.length>=3` with two-layer privacy (`profile_public = true` + viewer self-exclusion); pre-LIMIT 50 in SQL then JS sort `(overlap DESC, username ASC)` with batched `inArray(follows.followingId, topIds)` for `isFollowing` (Pitfall C-4 anti-N+1); `searchPeopleAction` Server Action with Zod `.strict().max(200)` schema (mass-assignment guard) + auth gate; `useSearchState` hook (250 ms debounce + AbortController + URL sync + 2-char client minimum) wired to a 4-tab `SearchPageClient`; XSS-safe `HighlightedText` (regex-escape + React text children, no `dangerouslySetInnerHTML`); `PeopleSearchRow` with avatar + highlighted username/bio + overlap pill + inline `FollowButton`; persistent `DesktopTopNav` search input restyled (D-24 muted-fill + leading lucide Search icon) and `HeaderNav` deleted (D-23) — Profile/Settings now reachable only via the UserMenu dropdown shipped in Phase 14; Pitfall C-1 (pg_trgm GIN index reachability) verified via forced-plan EXPLAIN ANALYZE evidence in `16-VERIFICATION.md`; UAT approved 2026-04-25 — v3.0 Phase 16 (SRCH-01..07)

### Active

- [ ] Zustand watchStore filter reducer unit tests with beforeEach reset — carried from v1.0 (TEST-04)
- [ ] Integration test for POST /api/extract-watch route handler — carried from v1.0 (TEST-05)
- [ ] Component tests for WatchForm, FilterBar, WatchCard — carried from v1.0 (TEST-06)
- [ ] Custom SMTP for email confirmation — currently OFF for personal-MVP posture
- [ ] WristOverlaySvg geometry redesign — user owns; canonical 10:10 + arm spacing fix (v3.0 deferred UAT)
- [ ] WYWT post-submit auto-navigation to `/wear/[wearEventId]` — currently dialog closes with toast only (v3.0 deferred UX enhancement)
- [ ] 31 v3.0 deferred human-verification UAT items (iOS device tests, multi-session flows, FOUC checks, prod browser smoke tests) — see `.planning/milestones/v3.0-MILESTONE-AUDIT.md`
- [ ] Test fixture cleanup — 9 test files reference removed `wornPublic` column (Phase 12 fallout)
- [ ] Pre-existing `LayoutProps` TS error in `src/app/u/[username]/layout.tsx:21`
- [ ] Nyquist VALIDATION.md follow-up — most v3.0 phases have draft validation strategies but `nyquist_compliant: true` + `wave_0_complete: true` is rare; run `/gsd-validate-phase {N}` per phase if rigor needed

### Out of Scope

- Social / community features — partial: v2.0 Phase 7-10 shipped public profiles, follow graph, Common Ground overlap, and the 5-section Network Home (activity feed, WYWT, recommendations, insights, suggested collectors)
- Automated price tracking / market integrations / deal alerts — future milestone, significant infrastructure
- AI recommendation engine (best gap filler, most versatile addition) — future milestone after auth/data layer is solid
- Collection visualization map (2D dressy↔sporty × affordable↔expensive plot) — future milestone
- Sharing / export to others — future milestone once multi-user is established

## Context

**Current state (post v3.0):** Next.js 16 App Router with `cacheComponents: true`, React 19, TypeScript 5 strict, Supabase Auth + Postgres with RLS enabled project-wide (DEBT-02 audited), Drizzle ORM, Tailwind CSS 4 with IBM Plex Sans, Shadcn/base-ui + Sonner. 2813+ tests passing / 152 skipped (env-gated integration), 87+ test files. 21,311 LOC TypeScript in `src/`. Deployed at horlo.app on Vercel; production navigation frame, three-tier wear privacy, notifications system, photo-first WYWT flow, and people search are all live.

**Architecture:** Server Components by default, Zustand demoted to filter-only ephemeral state (31 lines), server-only DAL for all data access, Server Actions for all mutations, proxy.ts enforces auth at the edge, double-verified in every DAL function and Server Action. Two-layer privacy (RLS at DB + DAL WHERE clauses) protects follower/followee reads. Root layout uses inline theme script + Suspense around dynamic children to satisfy Next 16 Cache Components.

**Production:** Supabase project `wdntzsckjaoqodsyscns`, Vercel deployment at `horlo.app`/`www.horlo.app`. Email confirmation OFF (personal-MVP). Drizzle migrations tracked; production RLS policies (including `activities_select_own_or_followed`) pushed via `supabase db push --linked --include-all`. Deploy runbook: `docs/deploy-db-setup.md`.

## Constraints

- **Tech stack**: Next.js 16 App Router — continue with existing framework, no rewrites
- **Data model**: Watch and UserPreferences types are established — extend, don't break existing structure
- **Personal first**: Single-user experience and data isolation must remain correct even after multi-user auth is added
- **Performance**: Target <500 watches per user; no need for complex pagination or infinite scroll in MVP

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Local-first with localStorage | Zero backend complexity for MVP, fast iteration | ✓ Completed migration — localStorage replaced by Supabase Postgres in v1.0 |
| URL import with LLM extraction | Product vision said "no external APIs" but the feature was built and adds real value | ✓ Good — SSRF hardened in Phase 1, auth-gated in Phase 4 |
| Semantic similarity labels over raw scores | Scores are confusing; collector language (Core Fit, Role Duplicate) is more actionable | ✓ Good |
| Zustand for state | Simple, no boilerplate, works well with localStorage persist | ✓ Resolved — demoted to filter-only (31 lines) in Phase 5; DB is source of truth |
| App Router only, no pages/ | Clean separation, server components where possible | ✓ Good |
| Supabase Auth + Postgres + Drizzle | Integrated auth+DB, free tier sufficient for personal use, Drizzle for type-safe queries | ✓ Good — deployed and verified in prod |
| DAL + Server Actions (not API routes) | Colocation of data access with auth verification, better type safety | ✓ Good — single POST route remains for extract-watch only |
| proxy.ts + double-verified auth | Defense in depth: proxy.ts for redirects, DAL/SA for data access | ✓ Good — tested via Phase 4 UAT |
| Email confirmation OFF | Personal-MVP posture; free-tier SMTP limited to 2/hour | — Pending — revisit when opening to other users, configure custom SMTP |
| Session-mode pooler for migrations | Direct-connect host is IPv6-only, unreachable on most home ISPs | ✓ Good — documented in runbook |
| Two-layer privacy (RLS + DAL WHERE) | Single-layer is fragile; if one breaks, data leaks. Enforce at both layers so either breaking alone is still caught | ✓ Good — shipped in v2.0 Phase 6-10; integration tests in `tests/integration/home-privacy.test.ts` exercise the combined guarantee |
| No Supabase Realtime in v2.0 | Free tier limit of 200 concurrent WebSockets; server-rendered + `router.refresh()` is sufficient at MVP scale | ✓ Good — v2.0 shipped without it; revisit if user scale grows |
| Per-user independent watch entries (no canonical watch table) | Canonical normalization adds huge product complexity; per-user entries ship faster and let the UI/DAL compose views | ✓ Good — shipped in v2.0; revisit in a future "data strategy" phase if social features need cross-user watch identity |
| Cache Components (`cacheComponents: true`) with inline theme script | Next.js 16 `cacheComponents` forbids `cookies()` in layout body; canonical shadcn/next-themes inline `<script>` in `<head>` is the zero-FOUC escape hatch | ✓ Good — shipped in Phase 10; Suspense wraps Header + main |
| Rule-based recommendations (no LLM) in v2.0 | Keep the home page rendereable without API keys; 5 priority-ordered rationale templates produce deterministic, testable output | ✓ Good — shipped; revisit if product needs richer personalization |
| Viewer-aware DAL for cross-user reads | Different functions for owner-only (`getWatchById`) vs viewer-aware (`getWatchByIdForViewer`) keeps edit/delete paths strictly owner-scoped while allowing public views of public profiles | ✓ Good — pattern established in quick-260421-rdb; mirror for any future cross-user read |
| Three-tier wear visibility (public/followers/private) per row instead of `worn_public` boolean | Per-row visibility lets users mix public + followers-only + private wears on the same profile; tab-level boolean was too coarse | ✓ Good — shipped in v3.0 Phase 11 (schema + backfill) + Phase 12 (DAL ripple + column drop). Two-layer privacy preserved (RLS + DAL WHERE) |
| Default wear visibility: Public | Override researcher recommendation; explicitly chosen by user. Default-to-Public + clear UI copy is the safety net against confirmation-dialog friction | ✓ Good — shipped in v3.0 Phase 15 |
| Client-direct wear photo upload pipeline | Browser → Supabase Storage with user's session; Server Action validates storage key + inserts row. Avoids doubling bandwidth and Next.js 4MB body limit | ✓ Good — shipped in v3.0 Phase 15; orphan-cleanup on row-insert failure (23505 + non-23505) |
| Sonner Toaster bound to custom `ThemeProvider` (NOT next-themes) | Horlo's existing ThemeProvider is the single source of truth; binding to next-themes would fork theme state | ✓ Good — `ThemedToaster` Client Component shipped in v3.0 Phase 15 |
| `getWornTodayIdsForUser` preflight in WYWT picker + 23505 server catch | Two-layer defense against duplicate-day wears: client disables already-worn watches, server enforces UNIQUE constraint | ✓ Good — shipped in v3.0 Phase 15 |
| `revalidateTag(viewer:${id}, 'max')` for cross-user notification fan-out vs `updateTag` for self-reads | Read-your-own-writes via `updateTag()` (immediate); SWR semantics via `revalidateTag('max')` for OTHER users (recipient sees dot within 30s TTL) | ✓ Good — shipped in v3.0 Phase 13 |
| Fire-and-forget notification logger | Notification insert failure must never block follow / addWatch primary commit; same pattern as `logActivity` | ✓ Good — `logNotification` with internal try/catch + opt-out + self-guard shipped in v3.0 Phase 13 |
| Cradle-style elevated Wear CTA in mobile bottom nav (no SVG cutout) | Stacking-context simplicity > true notch cutout at v3.0 scale; visual elevation via translate + shadow achieves Figma intent | ✓ Good — shipped in v3.0 Phase 14 |
| Shared `PUBLIC_PATHS` constant for proxy + 3 nav surfaces | Single source of truth eliminates drift between auth gate and nav rendering | ✓ Good — shipped in v3.0 Phase 14 |
| pg_trgm GIN indexes for people search | Cost model picks Seq Scan at <127 rows but Bitmap Index Scan available at production scale (forced-plan EXPLAIN ANALYZE proves indexes are reachable) | ✓ Good — shipped in v3.0 Phase 11 + 16; production trajectory verified |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-27 after v3.0 milestone — Production Nav & Daily Wear Loop shipped. 7 phases (11, 12, 13, 14, 15, 16, 999.1), 37 plans, 56 tasks, 178 commits over 5 days; 51/51 v3.0 requirements satisfied at code level. Schema + storage foundation, three-tier wear privacy ripple, notifications system, production navigation frame (mobile BottomNav + SlimTopNav + DesktopTopNav with shared PUBLIC_PATHS gate), photo-first WYWT post flow with `/wear/[id]` detail route, and people search with pg_trgm-backed live debounced results all live. Audit status: `tech_debt` — 31 deferred human-verification UAT items + ~30 advisory items, none blocking. See `.planning/milestones/v3.0-MILESTONE-AUDIT.md`. Up next: `/gsd-new-milestone`.*

*Previous: 2026-04-24 — Phase 14 (Nav Shell + Explore Stub) complete. Production navigation frame shipped: mobile BottomNav (5-item sticky bar, 80px tall, shrink-0 Wear cradle with 12px natural overflow above the bar, all 5 labels share a bottom baseline); desktop Header delegator split into SlimTopNav (<768px) / DesktopTopNav (≥768px); legacy `MobileNav.tsx` deleted (NAV-12); `/explore` + `/search` stubs close nav-link 404s; `/insights` retired to owner-only profile tab with two-layer P-08 privacy defense; profile dropdown consolidated via `InlineThemeSegmented` (D-17) with base-ui dismissal guard on the theme buttons; Settings routes to `/preferences` as sole v3.0 entry point (D-12); shared `PUBLIC_PATHS` constant + `isPublicPath` predicate unify proxy + nav auth gate (NAV-05 D-21/D-22); IBM Plex Sans + `viewport-fit=cover` metadata added. DEBT-01 regression-locked. 5 human UAT items resolved. 2489 tests pass, 0 regressions. Code review: 0 critical, 3 warnings, 5 info (non-blocking, tracked in 14-REVIEW.md). Up next: Phase 15 (WYWT Photo Post Flow).*
