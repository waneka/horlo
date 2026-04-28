---
phase: 18-explore-discovery-surface
verified: 2026-04-28T17:13:57Z
status: human_needed
score: 5/5 must-haves verified (codebase evidence sufficient)
overrides_applied: 0
human_verification:
  - test: "Visit /explore as authenticated user with following=0, wears=0"
    expected: "Sparse-network hero renders with Compass icon-circle, serif h1 'Find collectors who share your taste.', supporting paragraph, 'Browse popular collectors' CTA → /explore/collectors. All three rails (Popular Collectors, Trending, Gaining Traction) render below."
    why_human: "Visual rendering — exact pixel layout, accent color application, font loading, and that the hero gate fires before rails render"
  - test: "Visit /explore as user with following=3 OR wears>=1"
    expected: "Hero is hidden; rails render in order Popular → Trending → Gaining."
    why_human: "Conditional render visual confirmation — gate predicate verified in unit tests but live behavior across cache + auth flow needs human eye"
  - test: "Visit /explore on a dataset where snapshot table is empty (deploy day)"
    expected: "Gaining Traction rail header still renders with TrendingUp icon; body shows 'Not enough data yet — check back in a few days.'; no See-all link in this rail header."
    why_human: "D-12 case 1 visual verification under real DB state"
  - test: "Click 'See all' on Popular Collectors rail"
    expected: "Navigates to /explore/collectors showing up to 50 rows; if at cap, footer 'Showing top 50 collectors.' visible"
    why_human: "Navigation + visual layout for the See-all surface"
  - test: "Click 'See all' on Trending rail"
    expected: "Navigates to /explore/watches showing two stacked sections (Trending + Gaining Traction) in responsive grid (2/3/4 cols); per-section cap footer when at limit"
    why_human: "Two-stacked-section layout + responsive grid behavior"
  - test: "Open mobile viewport, verify BottomNav order"
    expected: "5 slots in order: Home / Search / Wear / Explore / Profile (Wear is the elevated 56×56 cradle in slot 3); active accent color on current route"
    why_human: "Mobile viewport + visual confirmation of cradle elevation, accent color, and active-state strokeWidth"
  - test: "Tap Explore slot in BottomNav"
    expected: "Routes to /explore; Explore slot becomes active (text-accent + strokeWidth 2.5); aria-current='page'"
    why_human: "Live tap interaction"
  - test: "Follow a user from Popular Collectors rail, return to /explore"
    expected: "Followed user disappears from rail on next render (RYO via updateTag); rail does NOT show stale data"
    why_human: "Cache invalidation with real Server Action round-trip — only verifiable in a running app"
  - test: "Add a watch via /watch/new, return to /explore"
    expected: "Trending rail eventually reflects the new owners_count delta (SWR via revalidateTag('explore', 'max')); Popular Collectors rail also re-renders for the actor"
    why_human: "Cross-user fan-out invalidation with real DB write — only verifiable in a running app"
---

# Phase 18: explore-discovery-surface Verification Report

**Phase Goal:** "The v3.0 'coming soon' /explore stub is replaced with a Server-Component discovery surface that surfaces popular collectors and rising-watch signals, with a welcoming empty-state hero for sparse-network users — and Explore claims its rightful slot in the BottomNav."

**Verified:** 2026-04-28T17:13:57Z
**Status:** human_needed (codebase evidence sufficient for all 5 success criteria; awaiting browser smoke test)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth (Success Criterion) | Status | Evidence |
|---|---------------------------|--------|----------|
| 1 | /explore is a Server Component shell that renders sparse-network welcome hero when `followingCount < 3 && wearEventsCount < 1` | ✓ VERIFIED | `src/app/explore/page.tsx:30-48` — `async function ExplorePage()` (Server Component, no `'use client'`); `Promise.all([getFollowerCounts(user.id), getWearEventsCountByUser(user.id)])`; `showHero = followingCount < 3 && wearEventsCount < 1` (AND, not OR — D-06 EXACT predicate); `{showHero && <ExploreHero />}` runs OUTSIDE any `'use cache'` scope (the page itself has no cache directive). v3.0 stub replaced — `grep -nE "Sparkles|Discovery is coming"` returns 0. ExplorePage.test.tsx 6/6 tests cover hero gate branches (sparse / followingCount===3 / wearEventsCount===1). |
| 2 | Popular Collectors rail shows most-followed public profiles (excluding self + already-followed) and links to /explore/collectors | ✓ VERIFIED | `src/components/explore/PopularCollectors.tsx:22-50` — calls `getMostFollowedCollectors(viewerId, { limit: 5 })` and renders See-all `<Link href="/explore/collectors">`. DAL `src/data/discovery.ts:57-121` enforces self-exclusion (`excludeIds = [viewerId, ...followingRows.map(r => r.id)]`), already-followed exclusion (`notInArray(profiles.id, excludeIds)` guarded), and two-layer privacy (`innerJoin(profileSettings) + eq(profileSettings.profilePublic, true)`). `src/app/explore/collectors/page.tsx` ships with `limit: 50` cap + footer + empty state. Unit tests pass (5/5 PopularCollectors + 5/5 CollectorsSeeAll). |
| 3 | Trending Watches rail sorted by `owners_count + wishlist_count * 0.5` and links to /explore/watches | ✓ VERIFIED | `src/data/discovery.ts:135-160` — `getTrendingCatalogWatches`: ORDER BY `(owners_count + 0.5 * wishlist_count) DESC`, brand_normalized ASC, model_normalized ASC; WHERE excludes score=0. `0.5 * wishlist_count` is mathematically identical to `wishlist_count * 0.5`. `src/components/explore/TrendingWatches.tsx:17-55` — Flame icon, `· {N} collectors` sublabel, See-all link to `/explore/watches`. `src/app/explore/watches/page.tsx` provides the See-all surface with stacked Trending+Gaining sections at limit:50. Unit tests pass (4/4 TrendingWatches + 8/8 WatchesSeeAll). |
| 4 | Gaining Traction rail shows 7-day delta from `watches_catalog_daily_snapshots` | ✓ VERIFIED | `src/data/discovery.ts:202-283` — `getGainingTractionCatalogWatches` reads `watches_catalog_daily_snapshots` via WITH-CTE `DISTINCT ON (s.catalog_id) ... WHERE s.snapshot_date::date >= (current_date - window * INTERVAL '1 day')::date`; computes delta = `ROUND((wc.owners_count + 0.5*wc.wishlist_count) - (base.snap_owners + 0.5*base.snap_wishlist))::int`; D-12 three-window logic (0/1-6/7) implemented (lines 215-221). Pitfall 3 mitigated (`::date` casts). Component `GainingTractionWatches.tsx:19-70` always renders header (D-12), branches sublabel on window. Unit tests pass (5/5 GainingTractionWatches). |
| 5 | Mobile BottomNav shows Explore as one of its 5 slots (Home / Search / Wear / Explore / Profile per Phase 18 D-01..D-04 — supersedes original DISC-08 wording) | ✓ VERIFIED | `src/components/layout/BottomNav.tsx:5,107-156` — imports `{ Home, Search, Compass, User }` (Plus dropped); predicates `isHome`, `isSearch`, `isExplore`, `isProfile` (no `isAdd`); JSX renders exactly 5 NavLink + NavWearButton in order Home → Search → NavWearButton (Wear cradle, slot 3) → Explore → Profile. Phase 14 typography/spacing/safe-area contract preserved verbatim. `BottomNav.test.tsx` 11/11 tests pass — assert order, routes, active states, /search nested startsWith, no Add slot, NavWearButton present. The D-03/D-04 amendments (Profile permanent, Notifications stays in TopNav) are documented in 18-CONTEXT.md and acknowledged in JSDoc. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/data/discovery.ts` | 3 readers, server-only, two-layer privacy | ✓ VERIFIED | 284 lines; `import 'server-only'` line 1; exports `getMostFollowedCollectors`, `getTrendingCatalogWatches`, `getGainingTractionCatalogWatches` + 4 type interfaces; `eq(profileSettings.profilePublic, true)` line 87; all COUNT casts `::int` (lines 80, 92, 105); `notInArray` guarded (line 88); `DISTINCT ON` + `::date` casts (lines 211-212, 244). |
| `src/data/wearEvents.ts` (getWearEventsCountByUser) | Cheap COUNT(*) for hero gate | ✓ VERIFIED | Line 420 — `count(*)::int` cast, `eq(wearEvents.userId, userId)`, no visibility filter (per RESEARCH §State of the Art row 4). |
| `src/components/explore/ExploreHero.tsx` | Compass icon-circle + serif h1 + paragraph + CTA Link/Button | ✓ VERIFIED | 33 lines; pure render Server Component (no `'use cache'`); Compass in `bg-accent/10` rounded-full backdrop; serif h1 with exact copy "Find collectors who share your taste."; supporting paragraph; `<Link href="/explore/collectors"><Button>Browse popular collectors</Button></Link>`. |
| `src/components/explore/PopularCollectors.tsx` | `'use cache'` + per-viewer cacheTag + 5min revalidate | ✓ VERIFIED | Lines 22-25: `'use cache'`, `cacheTag('explore', \`explore:popular-collectors:viewer:${viewerId}\`)`, `cacheLife({ revalidate: 300 })`. viewerId is explicit prop (Pitfall 1 honored). Hide-on-empty. |
| `src/components/explore/PopularCollectorRow.tsx` | Avatar + name + followers count + optional watch count + inline FollowButton | ✓ VERIFIED | 72 lines; absolute-inset Link to `/u/{username}/collection`; AvatarDisplay 40×40; followersText with singular/plural switch; optional `· {N} watches`; inline FollowButton with `initialIsFollowing={false}`; mini-thumb cluster removed. |
| `src/components/explore/TrendingWatches.tsx` | Flame heading + 5-card horizontal scroll-snap strip; cached global | ✓ VERIFIED | Lines 17-20: `'use cache'`, `cacheTag('explore', 'explore:trending-watches')`, `cacheLife({ revalidate: 300 })`. Flame icon, sublabel `· {N} collectors`/`· 1 collector`, scroll-snap strip with `snap-start` cards. Hide-on-empty. |
| `src/components/explore/GainingTractionWatches.tsx` | TrendingUp heading + branched body; cached global daily | ✓ VERIFIED | Lines 19-22: `'use cache'`, `cacheTag('explore', 'explore:gaining-traction')`, `cacheLife({ revalidate: 86400 })`. Always renders header (D-12). `showStrip = result.window >= 1 && result.watches.length > 0` drives both See-all visibility and body branch. Empty-state copy verbatim. |
| `src/components/explore/DiscoveryWatchCard.tsx` | Shared card body (image + brand + model + sublabel slot) | ✓ VERIFIED | 47 lines; `w-44 md:w-52`; aspect-square image with null fallback; brand/model/sublabel lines; non-clickable (no Link wrapper). |
| `src/app/explore/page.tsx` | Shell: Promise.all hero gate counts + 3 rails | ✓ VERIFIED | 49 lines; Server Component; `Promise.all([getFollowerCounts, getWearEventsCountByUser])` outside cache; `showHero = followingCount < 3 && wearEventsCount < 1`; renders `<main>` with conditional ExploreHero + PopularCollectors + TrendingWatches + GainingTractionWatches; metadata `{ title: 'Explore — Horlo' }`. |
| `src/app/explore/collectors/page.tsx` | See-all collectors at limit:50 | ✓ VERIFIED | 49 lines; calls `getMostFollowedCollectors(user.id, { limit: 50 })`; vertical list of PopularCollectorRows; cap footer "Showing top 50 collectors."; empty state copy. |
| `src/app/explore/watches/page.tsx` | See-all watches: stacked Trending + Gaining at limit:50 | ✓ VERIFIED | 135 lines; Promise.all both DALs at limit:50; full-page empty state when completelyEmpty; otherwise two stacked sections in responsive grid (2/3/4 cols); per-section cap footer; window-branch sublabel. |
| `src/app/actions/follows.ts` (updateTag invalidation) | followUser + unfollowUser invoke updateTag | ✓ VERIFIED | Lines 86, 123: `updateTag(\`explore:popular-collectors:viewer:${user.id}\`)` in success paths of followUser and unfollowUser. Tag string byte-identical to PopularCollectors cacheTag. |
| `src/app/actions/watches.ts` (revalidateTag fan-out) | addWatch (and siblings) invoke revalidateTag('explore', 'max') | ✓ VERIFIED | 3 call sites at lines 177, 218, 248: `revalidateTag('explore', 'max')` in addWatch + editWatch + removeWatch success paths. Two-arg form per Pitfall 4. |
| `src/components/layout/BottomNav.tsx` | v4.0 reshape — Home/Search/Wear/Explore/Profile | ✓ VERIFIED | Imports `Home, Search, Compass, User` (Plus removed). Predicates `isHome, isSearch, isExplore, isProfile`. JSX order: Home → Search → NavWearButton → Explore → Profile. Phase 14 typography/spacing preserved. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src/app/explore/page.tsx` | `getCurrentUser` + `getFollowerCounts` + `getWearEventsCountByUser` + 4 rail components | Promise.all + JSX composition | ✓ WIRED | Imports + calls verified at page.tsx:1-7, 31-36; viewerId={user.id} prop on PopularCollectors line 43 |
| `src/components/explore/PopularCollectors.tsx` | `src/data/discovery.ts:getMostFollowedCollectors` | Direct DAL call inside `'use cache'` scope | ✓ WIRED | Import line 4; call line 27 with viewerId prop forwarded |
| `src/components/explore/TrendingWatches.tsx` | `src/data/discovery.ts:getTrendingCatalogWatches` | DAL call inside `'use cache'` scope | ✓ WIRED | Import line 5; call line 22 |
| `src/components/explore/GainingTractionWatches.tsx` | `src/data/discovery.ts:getGainingTractionCatalogWatches` | DAL call; result.window drives body branch | ✓ WIRED | Import line 5; call line 24; `showStrip` predicate uses result.window |
| `src/app/actions/follows.ts` | `PopularCollectors.tsx` cacheTag | Tag-string match | ✓ WIRED | Writer `updateTag('explore:popular-collectors:viewer:${user.id}')` matches reader `cacheTag('explore', \`explore:popular-collectors:viewer:${viewerId}\`)` exactly |
| `src/app/actions/watches.ts` | All 3 rail components | bare 'explore' fan-out tag | ✓ WIRED | Writer `revalidateTag('explore', 'max')` (3 call sites) matches reader `cacheTag('explore', ...)` (3 rail components) |
| `src/components/layout/BottomNav.tsx` | `NavWearButton` | Wear cradle slot 3 with `appearance="bottom-nav"` | ✓ WIRED | Lines 139-143: `<NavWearButton ownedWatches={ownedWatches} viewerId={viewerId} appearance="bottom-nav" />` |
| `src/components/layout/BottomNav.tsx` Explore slot | `/explore` route | NavLink with Compass icon | ✓ WIRED | Lines 144-149: `<NavLink href="/explore" icon={Compass} label="Explore" active={isExplore} />` |
| `/explore` auth gate | `src/proxy.ts` redirect | NOT in PUBLIC_PATHS | ✓ WIRED | `grep '/explore' src/lib/constants/public-paths.ts` returns 0 matches across all three routes |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| PopularCollectors | `collectors` | `getMostFollowedCollectors(viewerId, { limit: 5 })` → Drizzle SELECT on profiles + profileSettings + follows + watches | Yes — real DB query with COUNT aggregate, two-layer privacy, exclusion | ✓ FLOWING |
| TrendingWatches | `watches` | `getTrendingCatalogWatches({ limit: 5 })` → Drizzle SELECT on watches_catalog with weighted ORDER BY | Yes — real DB query against denormalized counts populated by Phase 17 pg_cron | ✓ FLOWING |
| GainingTractionWatches | `result` | `getGainingTractionCatalogWatches({ limit: 5 })` → raw db.execute WITH-CTE on watches_catalog_daily_snapshots JOIN watches_catalog | Yes — DISTINCT ON oldest snapshot per catalog row, ROUND(int) delta math | ✓ FLOWING |
| ExplorePage hero gate | `followingCount`, `wearEventsCount` | Promise.all of `getFollowerCounts(user.id)` + `getWearEventsCountByUser(user.id)` | Yes — both are real DB COUNT queries | ✓ FLOWING |
| CollectorsSeeAllPage | `collectors` | `getMostFollowedCollectors(user.id, { limit: 50 })` | Yes — same DAL as rail, larger limit | ✓ FLOWING |
| WatchesSeeAllPage | `trending`, `gaining` | Promise.all of trending + gaining DALs at limit:50 | Yes | ✓ FLOWING |

No HOLLOW or HARDCODED-empty data flows detected. All rendering surfaces draw from real DB queries.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles cleanly across phase 18 files | `npx tsc --noEmit` filtered to phase 18 paths | No errors in any phase 18 file | ✓ PASS |
| Component test suite passes | `npx vitest run tests/components/explore/ tests/components/layout/BottomNav.test.tsx` | 7 files / 44 tests passed | ✓ PASS |
| Server Action invalidation tests pass | `npx vitest run tests/actions/follows.test.ts tests/actions/watches.test.ts` | 2 files / 43 tests passed | ✓ PASS |
| v3.0 stub fully replaced in /explore | `grep -nE "Sparkles\|Discovery is coming" src/app/explore/page.tsx` | 0 matches | ✓ PASS |
| BottomNav has no Add slot residue | `grep -nE "Plus\|isAdd" src/components/layout/BottomNav.tsx` | 0 matches | ✓ PASS |
| Tag string consistency: PopularCollectors writer ↔ reader | grep `explore:popular-collectors:viewer:` in follows.ts (2) + PopularCollectors.tsx (1) | Strings byte-identical | ✓ PASS |
| Auth gate preserved on all /explore routes | `grep '/explore' src/lib/constants/public-paths.ts` | 0 matches | ✓ PASS |
| All See-all routes use limit:50 | `grep 'limit: 50' src/app/explore/{collectors,watches}/page.tsx` | 3 matches (1 + 2) | ✓ PASS |

DATABASE_URL-gated DAL integration tests skip cleanly without a live Postgres — they will assert against the real schema in CI/local-supabase setups (per Plan 01 SUMMARY).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DISC-03 | 18-01, 18-02, 18-03 | /explore Server Component shell with sparse-network welcome hero gated by `followingCount < 3 && wearEventsCount < 1` | ✓ SATISFIED | `src/app/explore/page.tsx:30-48` — page is async Server Component, calls Promise.all hero-gate counts, computes `showHero` with AND predicate, conditionally renders ExploreHero. v3.0 stub fully replaced. |
| DISC-04 | 18-01, 18-02, 18-05 | Popular Collectors rail (most-followed public, exclude self + already-followed) | ✓ SATISFIED | DAL `getMostFollowedCollectors` enforces self/already-followed exclusion + two-layer privacy. Component renders 5 PopularCollectorRows. Server Action invalidation wired (followUser/unfollowUser updateTag). |
| DISC-05 | 18-01, 18-02, 18-05 | Trending Watches rail sorted by `owners_count + wishlist_count * 0.5` (CAT-09 denormalized) | ✓ SATISFIED | DAL `getTrendingCatalogWatches` ORDER BY weighted score; component renders Flame-headed scroll-snap strip; addWatch/editWatch/removeWatch revalidateTag('explore', 'max') fan-out wired. |
| DISC-06 | 18-01, 18-02 | Gaining Traction rail showing 7-day delta from `watches_catalog_daily_snapshots` (CAT-12) | ✓ SATISFIED | DAL `getGainingTractionCatalogWatches` reads daily-snapshots table via DISTINCT ON CTE; D-12 three-window logic (0/1-6/7); component always renders header, body branches on window. |
| DISC-07 | 18-03 | /explore/collectors and /explore/watches "See all" routes for full lists beyond rail caps | ✓ SATISFIED | Both routes exist and call DAL at limit:50; per-section cap footer; auth-gated via proxy.ts (NOT in PUBLIC_PATHS). |
| DISC-08 | 18-04 | BottomNav surfaces Explore as one of its 5 slots — Phase 18 D-01..D-04 amendment | ✓ SATISFIED | BottomNav slot order is Home / Search / Wear / Explore / Profile (D-01). Add slot dropped (D-02). Profile permanent in BottomNav (D-03). Notifications stays in TopNav (D-04). REQUIREMENTS.md still has the original wording naming Notifications as a slot — Phase 25 needs to amend NAV-14/DISC-08 wording per 18-CONTEXT.md D-03/D-04. |

**Coverage note:** REQUIREMENTS.md DISC-08 currently reads: "BottomNav surfaces Explore as one of its 5 slots (Home / Search / Wear / Notifications / Explore)" — but Phase 18 D-03/D-04 explicitly amend this to "Home / Search / Wear / Explore / Profile" (Notifications stays in TopNav bell, Profile stays in BottomNav permanently). The prompt's success criterion 5 reflects the amendment ("supersedes original DISC-08 wording"). The implementation matches the amended shape; the REQUIREMENTS.md DISC-08/NAV-14 string update is owed to a Phase 25 `/gsd-discuss-phase` amendment (documented in 18-CONTEXT.md and 18-04-SUMMARY.md). This is NOT a phase 18 gap.

No orphaned requirements found — all 6 DISC-IDs from REQUIREMENTS.md are claimed by at least one Phase 18 plan and satisfied by implementation.

### Anti-Patterns Found

None of the following stub indicators detected in any Phase 18 file:

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | TODO/FIXME/PLACEHOLDER | — | All phase 18 files free of stub markers |
| (none) | — | `return null` rendering paths | — | Hide-on-empty is a deliberate design choice (UI-SPEC § Empty States), not a stub |
| (none) | — | empty-array hardcoded props | — | All array data flows from DAL queries, never from `[]` literals at call sites |
| (none) | — | `console.log`-only handlers | — | All event handlers (FollowButton, etc.) call real Server Actions |
| (none) | — | Sparkles/Discovery-is-coming v3.0 stub | — | Verified 0 matches in `src/app/explore/page.tsx` |

The only `return null` paths are intentional empty-state hide-outs in the rail components (PopularCollectors and TrendingWatches), gated on the result-array length being zero. This matches UI-SPEC § Empty States and is exercised by tests.

### Human Verification Required

See the structured `human_verification` section in the YAML frontmatter. Summary:

1. **Visit /explore as a sparse-network user** — confirm hero renders with Compass icon, serif h1, paragraph, CTA; rails render below.
2. **Visit /explore as a populated user (following≥3 OR wears≥1)** — confirm hero hidden, rails in fixed order Popular → Trending → Gaining.
3. **Deploy-day Gaining Traction empty-state** — confirm header + TrendingUp icon render with "Not enough data yet" body and no See-all link.
4. **Click 'See all' on Popular Collectors rail** — navigates to /explore/collectors with up to 50 rows + cap footer.
5. **Click 'See all' on Trending rail** — navigates to /explore/watches with stacked Trending + Gaining sections in responsive grid.
6. **Mobile BottomNav slot order** — confirm Home / Search / Wear / Explore / Profile with Wear cradle elevated.
7. **Tap Explore slot** — routes to /explore, slot becomes active (text-accent + aria-current).
8. **Follow a collector then return to /explore** — followed collector disappears (RYO via updateTag).
9. **Add a watch then return to /explore** — Trending rail eventually reflects the count shift (SWR via revalidateTag('explore', 'max')).

These behaviors are codebase-verified at the structural level (correct DAL wiring, correct cache tags, correct conditional logic in tests) but the live behavioral surface — visual layout, navigation flow, cache invalidation timing — needs a running app + browser.

### Gaps Summary

**No structural gaps detected.** All 5 roadmap success criteria are satisfied at the codebase level:

1. Server-Component shell with hero gate — `src/app/explore/page.tsx` is a Server Component (no `'use client'`), runs Promise.all hero-gate counts outside any `'use cache'` scope, with the EXACT predicate `followingCount < 3 && wearEventsCount < 1` from D-06.
2. Popular Collectors rail with proper exclusions and See-all link — DAL exclusions verified, two-layer privacy enforced, See-all route ships at limit:50.
3. Trending Watches rail with weighted score and See-all — DAL ORDER BY verified, denormalized counts from Phase 17 pg_cron, See-all surface ships.
4. Gaining Traction rail from daily snapshots — D-12 three-window logic implemented, ::date cast (Pitfall 3), DISTINCT ON CTE for oldest-snapshot-per-row.
5. BottomNav 5-slot v4.0 shape — Add slot dropped, Search added, Explore moved to slot 4, Profile permanent. Test suite asserts the exact contract.

The only thing standing between this phase and a `passed` status is **live browser validation** of the 9 enumerated visual / interactive behaviors. All of these are visual/UX/cache-timing concerns that cannot be programmatically asserted without running the app. None of them indicate a structural defect — they're just outside the scope of static-analysis verification.

**Re: REQUIREMENTS.md DISC-08 wording mismatch:** The implementation is correct per Phase 18 D-01..D-04 amendments (which explicitly supersede the original DISC-08 wording per 18-CONTEXT.md line 31, 33). The text update to REQUIREMENTS.md DISC-08 / NAV-14 is owed to a Phase 25 `/gsd-discuss-phase 25` amendment (documented as required in both 18-CONTEXT.md and 18-04-SUMMARY.md). This is forward-debt logged in the right place, not a phase 18 gap.

---

_Verified: 2026-04-28T17:13:57Z_
_Verifier: Claude (gsd-verifier)_
