# Milestones

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
