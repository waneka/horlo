# Horlo

## What This Is

A taste-aware watch collection intelligence system for personal collectors. Users manage their collection and wishlist, understand how their watches relate to each other, and make more intentional buying decisions. The core insight engine evaluates any watch against the user's collection and preferences to produce a semantic label (Core Fit, Role Duplicate, Hard Mismatch, etc.) rather than a raw score.

Shipped as a cloud-backed, authenticated web app at [horlo.app](https://horlo.app) — data persists across devices and browsers via Supabase Postgres.

## Core Value

A collector can evaluate any watch against their collection and get a meaningful, preference-aware answer about whether it adds something or just duplicates what they already own.

## Current Milestone: v3.0 Production Nav & Daily Wear Loop

**Goal:** Ship the production navigation frame (top + bottom + new entry points), close the social system with notifications, and turn WYWT into a photo-first daily habit with three-tier privacy.

**Target features:**

- Navigation overhaul — desktop top nav (logo + Explore, persistent search, Wear CTA, +Add icon, notifications bell, profile dropdown), slim mobile top nav (logo, search, notifications, settings), sticky mobile bottom nav (Home / Explore / **Wear elevated CTA** / Add / Profile)
- Stub routes for unbuilt destinations — `/explore` placeholder so nav has no broken links
- Notifications foundation — new `notifications` table with per-row `read_at`; live types (Follow, Watch-overlap); stubbed UI templates (Price Drop, Trending) for future data wiring; "N new" badge in nav, "Mark all read" page, unread bell dot
- Search (people-only) — `/search` with live debounced results; 4 tabs visible (All / Watches / People / Collections); only People populated (`pg_trgm` ILIKE on username + bio with taste overlap %); other tabs show "coming soon"
- WYWT post flow — reuses `WatchPickerDialog` for step 1; new wear form with photo (Take Wrist Shot via custom `getUserMedia` + static dotted guide overlay, or Upload Photo with `heic2any` HEIC conversion); per-wear note (0/200); per-wear visibility (Private / **Followers** / Public — new "followers" tier rippled through all wear-reading DALs); EXIF stripping; Supabase Storage with per-user RLS buckets + signed URLs; sonner toast on success

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

### Active

- [ ] Zustand watchStore filter reducer unit tests with beforeEach reset — carried from v1.0 (TEST-04)
- [ ] Integration test for POST /api/extract-watch route handler — carried from v1.0 (TEST-05)
- [ ] Component tests for WatchForm, FilterBar, WatchCard — carried from v1.0 (TEST-06)
- [ ] Custom SMTP for email confirmation — currently OFF for personal-MVP posture

### Out of Scope

- Social / community features — partial: v2.0 Phase 7-10 shipped public profiles, follow graph, Common Ground overlap, and the 5-section Network Home (activity feed, WYWT, recommendations, insights, suggested collectors)
- Automated price tracking / market integrations / deal alerts — future milestone, significant infrastructure
- AI recommendation engine (best gap filler, most versatile addition) — future milestone after auth/data layer is solid
- Collection visualization map (2D dressy↔sporty × affordable↔expensive plot) — future milestone
- Sharing / export to others — future milestone once multi-user is established

## Context

**Current state (post v2.0):** Next.js 16 App Router with `cacheComponents: true`, React 19, TypeScript 5 strict, Supabase Auth + Postgres with RLS enabled project-wide, Drizzle ORM, Tailwind CSS 4, Shadcn/base-ui. 2070+ tests passing across 55+ test files, plus 50+ integration tests that activate against local Supabase. Deployed at horlo.app on Vercel.

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
*Last updated: 2026-04-22 — Phase 999.1 complete. Phase 5 code-review follow-ups closed: `PreferencesClient` now inspects the `savePreferences` `ActionResult` and renders an accessible `role="alert"` banner with `aria-live="polite"` "Saving…" hint on failure (MR-01); the discarded-pending-tuple anti-pattern is gone. Dead `UnauthorizedError` imports removed from `actions/watches.ts` and `actions/preferences.ts` (MR-02). MR-03 closed paperwork-only via in-tree `999.1-MR-03-CLOSURE.md` citing Phase 6 RLS migration `20260420000000_rls_existing_tables.sql` and Phase 11 DEBT-02 audit migration `20260423000005_phase11_debt02_audit.sql` — no new SQL. Vitest 2078 passed / 0 failed; pre-existing `wornPublic` test-tree TS residue from Phase 12 logged in `deferred-items.md` for follow-up. Code review surfaced 5 warnings in surrounding code (input-validation gaps in `actions/watches.ts`, unbounded case-size range schema in `actions/preferences.ts`, stale-closure race in `toggleArrayItem`) — out of phase scope, candidates for future quick fixes via `/gsd-code-review-fix 999.1`. Up next: Phase 13 (Notifications Foundation).*
