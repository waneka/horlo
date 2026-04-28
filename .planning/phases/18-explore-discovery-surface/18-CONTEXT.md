# Phase 18: /explore Discovery Surface - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the v3.0 "coming soon" `/explore` stub with a real discovery surface. The page is a Server Component shell with three rails (Popular Collectors → Trending Watches → Gaining Traction) and a sparse-network welcome hero conditionally rendered when the viewer has fewer than 3 follows AND zero wear events. Two "See all" overflow routes (`/explore/collectors`, `/explore/watches`) ship with the rails. The mobile BottomNav is reshaped to its v4.0 final form: `Home / Search / Wear / Explore / Profile` (replacing today's `Home / Explore / Wear / Add / Profile`).

**Out of scope for this phase:**
- `/evaluate?catalogId=` deep-link target (Phase 20 — until then, watch-card click target is Claude's Discretion)
- `/search?tab=watches` or `?tab=collections` data (Phase 19; existing v3.0 stub tabs unchanged here)
- TopNav avatar dual-affordance (NAV-13/15 — Phase 25; this phase ships Profile in BottomNav for permanent visibility, NOT as a Phase-25-interim crutch)
- Editorial/featured collector slot (DISC-09 — v4.x, requires admin tooling)
- Realtime updates / WebSocket subscriptions (free-tier WebSocket cap; project-wide decision)
- Any modification to `analyzeSimilarity()` (catalog remains silent infrastructure per Phase 17 D-12)
- Catalog watch detail page (no `/watch/{catalogId}` route — Phase 20's `/evaluate?catalogId=` is the destination once it ships)

</domain>

<decisions>
## Implementation Decisions

### BottomNav 5-Slot Transition

- **D-01: Final BottomNav shape ships in this phase: `Home / Search / Wear / Explore / Profile` (5 slots, Profile rightmost, Explore at slot 4).** Drops both Add AND the previous Explore-at-slot-2 position. The Wear cradle stays at slot 3 (center, elevated). Active-state resolution mirrors the Phase 14 pattern in `src/components/layout/BottomNav.tsx`. The Search slot routes to `/search` (Phase 16 surface — exists). The Profile slot routes to `/u/{username}/collection` (Phase 9 — exists). The Wear slot continues to use the shared `NavWearButton` with `appearance="bottom-nav"`.

- **D-02: The Add slot is dropped entirely.** `/watch/new` is reachable from contextual surfaces only — collection / wishlist / worn / notes empty-state CTAs (Phase 25 ships these per UX-01..UX-04), and any per-page "+ Add Watch" affordances on listing surfaces. **Phase 18 owns the Add-slot removal but does NOT own adding the contextual CTAs** — those are explicitly Phase 25 (UX-01..UX-04). Acceptable interim: between Phase 18 ship and Phase 25 ship, mobile users reach `/watch/new` only via existing entry points (e.g., the WatchPicker dialog, the URL-import flow, direct URL entry). This is intentional — the v4.0 navigation philosophy is "creation lives next to the content, not in chrome." If interim friction is a problem, reopen this decision; do NOT spot-fix by re-adding an Add slot.

- **D-03: Profile stays in BottomNav permanently (Instagram pattern), NOT as a Phase-25-interim slot.** Phase 25 NAV-13/15 (top-right TopNav avatar) ships as *additional* access on top of BottomNav Profile, not as a replacement. Redundant access is the goal — the user explicitly wants Profile MORE visible across mobile + desktop. **This re-decides the previously-written DISC-08 wording (which named Notifications as the 5th slot) and NAV-14 (which removed Profile from BottomNav).** When Phase 25 plans, both requirements need amendment via `/gsd-discuss-phase 25` to reflect the final shape: `Home / Search / Wear / Explore / Profile`.

- **D-04: Notifications stays in TopNav bell (no Phase 18 change).** Already wired in `SlimTopNav` (mobile <768px) and `DesktopTopNav` (≥768px) via the cached `NotificationBell` Server Component shared by reference (Phase 13, Phase 14 D-11). Project identity = visual/curatorial (closer to Instagram/Pinterest than to X/Bluesky), so bell-in-top-nav matches user mental model. No additional bell on BottomNav.

### Sparse-Network Welcome Hero

- **D-05: Hero = welcome copy + ONE primary CTA.** No multi-CTA, no step-checklist. Single CTA reduces friction and lets the rails-below-hero do the actual demonstration. Exact copy is Claude's Discretion (lock in UI-SPEC); hero must convey that /explore is a "find collectors and watches" surface and offer the user one clear next step.

- **D-06: Hero disappears immediately on threshold cross.** The Server Component reads live `followingCount` and `wearEventsCount` per render. Whenever `followingCount >= 3 OR wearEventsCount >= 1`, the hero does NOT render. No client-side hide-state, no session-stickiness. Server state always wins. Trigger condition for hero-shown matches DISC-03 spec exactly: `followingCount < 3 && wearEventsCount < 1` (note the AND on the show-side; OR on the hide-side is the symmetric mirror).

- **D-07: All 3 rails render BELOW the hero when the hero is showing.** Sparse-network viewers see the welcome AND see global top picks immediately — sets the "this surface is alive" tone and gives the hero CTA something real to point at. Rails compute independently of hero state; a brand-new viewer (no follows, no wears) gets non-empty Popular Collectors (cross-user top-followed list, exclude-self only — they follow nobody, so no follow-exclusion takes effect), non-empty Trending Watches (catalog populated from Phase 17 backfill), and Gaining Traction with a partial-window banner per D-12.

- **D-08: Hero CTA routes to `/explore/collectors` (the See-all overflow route).** Not anchor-scroll, not search. Sends the viewer to the FULL Popular Collectors list rather than just the rail-strip preview. Implementation: `<Link href="/explore/collectors">` — standard Next.js client navigation. /explore/collectors is a See-all surface that ships in this phase per DISC-07.

### Rail Order, Density & Empty States

- **D-09: Rail order top-to-bottom: Popular Collectors → Trending Watches → Gaining Traction.** People-first reflects PROJECT vision ("taste-aware collection intelligence"). Hero CTA targets Popular Collectors at slot 1, so the user lands on a connection-discovery action immediately even when the hero scrolls off.

- **D-10: Cap = 5 items per rail.** Matches Phase 10 `SuggestedCollectors` and the established Horlo rhythm. "See all" link in each rail header navigates to `/explore/collectors` (Popular Collectors rail) or `/explore/watches` (Trending + Gaining Traction overflow). Trending and Gaining Traction share `/explore/watches` as their See-all destination — the See-all surface offers tab/filter switching between the two rankings (Claude's Discretion: tab-style or sort-toggle UI).

- **D-11: Layout shape is mixed by content type. Popular Collectors = vertical row list (mirror Phase 10 `SuggestedCollectorRow` exactly: avatar 40×40 + displayName/username + "{N}% taste overlap" + 3 mini-thumb cluster + inline FollowButton).** Trending Watches and Gaining Traction = horizontal-scroll image-led cards (mirror Phase 10 `WywtRail` scroll-snap pattern: `flex gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory`). Type-appropriate density — collector rows want metadata; watch cards want image prominence.

- **D-12: Gaining Traction always renders the rail header; the body adapts to data availability.** Three cases:
  - **0 snapshots exist** (deploy day): show inline empty-state "Not enough data yet — check back in a few days" beneath the rail header. Do NOT hide the section.
  - **1–6 days of snapshots** (first week): compute delta against the oldest available snapshot; sublabel shows the actual window (e.g., `↑ +12 in 3 days`).
  - **7+ days of snapshots**: compute 7-day delta as the spec requires; sublabel shows `↑ +12 this week`.
  No special-case hide logic in the page tree — the rail computes against whatever snapshots exist, and the empty-state lives inside the rail component.
  **Empty-state policy for Popular Collectors / Trending Watches** is Claude's Discretion — both are extremely unlikely to be empty in production (Phase 17 catalog backfill + existing public profiles guarantee >0 rows). If a query somehow returns 0 rows, hide the rail header entirely rather than showing a "no items" message; this avoids visual clutter on an asymmetric edge case.

### Trending vs Gaining Traction Differentiation

- **D-13: Same watch card component for both rails; differentiation lives in headings + sublabels + iconography.** Single horizontal-scroll watch-card component used by both rails. Rail-level differences:
  - **Heading iconography**: Trending = flame icon (`<Flame />` from lucide-react); Gaining Traction = trending-up arrow (`<TrendingUp />` from lucide-react). Place icon to the left of the rail heading.
  - **Card sublabel**: Trending = `· {N} collectors` where `N = owners_count` (absolute count). Gaining Traction = `↑ +{delta} this week` where `delta = (current owners_count + 0.5 × current wishlist_count) - (snapshot owners_count + 0.5 × snapshot wishlist_count)` rounded to integer.
  - **Both rails share**: card image, brand + model display, the `class="snap-start"` scroll-snap behavior, and (per D-11) the horizontal-scroll layout.
  Component reuse keeps implementation tight; copy + iconography carry the difference.

- **D-14: Same watch CAN appear in both rails simultaneously.** Each rail computes independently — if a Submariner is both the most-collected watch overall AND the biggest 7-day mover, it shows in both rails. No deduplication. Rationale: each rail represents a distinct truth about that watch ("most-collected ever" vs "biggest mover this week"), and dedup would impose arbitrary precedence and hide real signal.

- **D-15: Sort tie-breaks within each rail = alphabetical by `(brand_normalized ASC, model_normalized ASC)`.** Deterministic and easy to debug. Mirrors Phase 16 search ordering convention (`overlap DESC, username ASC`). Full SQL: `ORDER BY score DESC, brand_normalized ASC, model_normalized ASC LIMIT 5` for the rail; `ORDER BY ... LIMIT 50` for the See-all surface (cap-only, no pagination v4.0).

### Claude's Discretion

The plan can decide:

- **Exact hero copy + visual treatment** (lock in UI-SPEC via `/gsd-ui-phase 18` after planning). Tone target: warm + collection-aware, not generic SaaS welcome.
- **Hero illustration / icon** (Sparkles? Compass? Same Sparkles as the v3.0 stub for continuity? Probably a different glyph since the surface is no longer "coming soon").
- **Watch-card click target** in Trending + Gaining Traction rails until Phase 20 ships `/evaluate?catalogId=`. Default approach: card is non-clickable in v4.0 Phase 18 (display-only), then Phase 20 lights it up. **Acceptable alternative:** card links to `/evaluate?catalogId={uuid}` immediately — Phase 20 fills the route. Prefer non-clickable to avoid 404-into-stub UX, but the planner can choose either; flag in PLAN.md.
- **`/explore/watches` See-all surface internal layout** (Trending and Gaining Traction share this destination — could be a tab toggle, a sort-by select, or two stacked sections on the same page). UI-SPEC will pin it.
- **Caching strategy** (`'use cache'` + `cacheLife` + `cacheTag` pattern from Phase 13 `NotificationBell`). Recommended baseline: Popular Collectors + Trending Watches rails are cached at the page level with a `cacheLife({ revalidate: 300 })` (5min) and tags `'explore'`, `'explore:popular-collectors'`, `'explore:trending-watches'`. Gaining Traction is cached with `cacheLife({ revalidate: 86400 })` (24h, since snapshots refresh daily via pg_cron). Tag-invalidate `'explore'` on `addWatch` server action so newly-imported watches surface within their next cache window. **Hero rendering is per-viewer (depends on `followingCount` + `wearEventsCount`)** — keep hero outside `'use cache'` scope, mirror Phase 14 `BottomNavServer` Suspense-leaf pattern. Planner has latitude to tune TTLs and tag fan-out.
- **DAL function naming** for the new readers (e.g., `getMostFollowedCollectors(viewerId, { limit })`, `getTrendingCatalogWatches({ limit })`, `getGainingTractionCatalogWatches({ limit })`). Place in domain-appropriate files: collectors in `src/data/follows.ts` or new `src/data/discovery.ts`; watches in `src/data/catalog.ts`.
- **Whether to factor a single shared `<DiscoveryWatchCard>` component or specialize per-rail** (D-13 says shared; planner can ship as one component with a sublabel slot prop, or two thin wrappers around a base — both honor the decision).
- **`/explore/collectors` and `/explore/watches` See-all pagination shape**. Default: cap at 50 results, no infinite scroll for v4.0 (matches PROJECT constraint "no need for complex pagination or infinite scroll in MVP" — collectors-and-watches lists are small at v4.0 scale). Show "Showing top 50" footer note when results === 50.

### Folded Todos

None — `todo match-phase 18` returned zero matches.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level
- `.planning/PROJECT.md` — Key Decisions table (catalog silent infrastructure, two-layer privacy, no-Realtime, Cache Components inline-theme-script pattern)
- `.planning/REQUIREMENTS.md` — DISC-03 through DISC-08 (the requirements this phase delivers); also NAV-14 (Phase 25, **needs amendment** when Phase 25 plans — see D-03)
- `.planning/ROADMAP.md` Phase 18 entry — goal + 5 success criteria

### Prior-phase artifacts (Phase 17 / Phase 16 / Phase 14 / Phase 13 / Phase 10)
- `.planning/phases/17-catalog-foundation/17-CONTEXT.md` — catalog data shapes, source-of-truth rules (CAT-11), denormalized counts behavior, snapshot table schema
- `.planning/codebase/STACK.md` — Next 16 + React 19 + Drizzle + Supabase RLS + Tailwind 4 + Zustand-filter-only
- `.planning/codebase/ARCHITECTURE.md` — Server Components by default, Server Actions for mutations, two-layer privacy pattern, Cache Components canonical layout
- `.planning/codebase/CONVENTIONS.md` — `'server-only'` DAL discipline, snake_case DB / camelCase TS row mapping, anti-N+1 `inArray` batch pattern

### Code patterns to mirror
- `src/components/home/SuggestedCollectors.tsx` — direct template for the Popular Collectors rail (Server Component awaiting DAL + LoadMore button + empty-state copy + `id="..."` for anchor scrolling)
- `src/components/home/SuggestedCollectorRow.tsx` — direct template for the Popular Collectors row item (avatar + name + overlap pct + mini-thumb cluster + inline FollowButton, absolute-inset Link with z-10 button raise)
- `src/components/home/WywtRail.tsx` — horizontal scroll-snap pattern for Trending + Gaining Traction watch rails (`flex gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2`, child `class="snap-start"`)
- `src/data/profiles.ts` `searchProfiles` — anti-N+1 `inArray(follows.followingId, topIds)` pattern for `isFollowing` hydration on Popular Collectors rail
- `src/data/suggestions.ts` `getSuggestedCollectors` — pre-LIMIT-then-JS-sort + viewer-aware exclude-self + exclude-already-followed pattern. Popular Collectors uses a different ranking (followers DESC, not taste-overlap) but the exclusion shape is identical.
- `src/data/catalog.ts` — Phase 17 catalog DAL (already has `getCatalogById`; add `getTrendingCatalogWatches`, `getGainingTractionCatalogWatches` here or in a new `src/data/discovery.ts`)
- `src/components/layout/BottomNav.tsx` — current 5-slot implementation; this phase rewrites the slots per D-01
- `src/components/layout/BottomNavServer.tsx` — Server Component container resolving viewer + ownedWatches; no schema change needed but slot props may shift if Profile/Search use new prop shapes
- `src/components/layout/SlimTopNav.tsx` / `src/components/layout/DesktopTopNav.tsx` — verify NotificationBell remains untouched (D-04)
- `src/components/notifications/NotificationBell.tsx` — direct template for `'use cache'` + `cacheTag` + `cacheLife` pattern on the rail Server Components (Claude's Discretion baseline above)
- `src/lib/constants/public-paths.ts` — `PUBLIC_PATHS` constant + `isPublicPath` predicate; verify `/explore`, `/explore/collectors`, `/explore/watches` are NOT in PUBLIC_PATHS (auth-only, mirrors current /explore)
- `src/proxy.ts` — auth gate; no change expected, but verify the new See-all routes inherit the existing protection
- `src/app/page.tsx` — home page composition pattern (Promise.all parallel fetch, then sections render in fixed L-01 order)

### Schema / data sources
- `src/db/schema.ts` — `watchesCatalog`, `watchesCatalogDailySnapshots`, `profiles`, `profileSettings` (`profilePublic` gate), `follows` table shapes
- `supabase/migrations/...phase17_catalog_foundation.sql` — catalog public-read RLS policy (anonymous read works, but /explore is auth-only so RLS is belt-and-suspenders)

### Memory references
- MEMORY: `project_drizzle_supabase_db_mismatch.md` — `drizzle-kit push` is LOCAL ONLY; prod migrations use `supabase db push --linked`. Phase 18 has no schema work but the planner should verify before adding any incidental migration.
- MEMORY: `project_supabase_secdef_grants.md` — Phase 18 doesn't add SECURITY DEFINER functions, but reference for any future read-side function work.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`SuggestedCollectorRow` (Phase 10)** — copy-paste template for Popular Collectors rail row. Already includes: avatar, displayName/username, overlap pct (will rebrand sublabel to "{N} followers" for Popular Collectors), mini-thumb cluster (could swap to "{N} watches" stat), inline FollowButton with z-10 click-bubble guard, absolute-inset Link to `/u/{username}/collection`. The component contract is right; the data shape needs a sibling `PopularCollector` type alongside `SuggestedCollector`.
- **`SuggestedCollectors` (Phase 10)** — template for Popular Collectors section wrapper. Already has: Server Component awaiting DAL + LoadMore button + empty-state copy + `id="..."` anchor for scroll-into-view (Phase 18 hero CTA does NOT need this since D-08 routes off /explore, but pattern is preserved for any future anchor refactor).
- **`WywtRail` horizontal-scroll structure** (Phase 10) — `<div class="flex gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2">` with `<div class="snap-start">` children. Direct template for Trending + Gaining Traction watch rails. The `useViewedWears` hook is NOT applicable; Phase 18 watch cards are display-only or single-tap-to-evaluate.
- **`AvatarDisplay` + `FollowButton`** — drop-in components already used by Phase 10 patterns. Popular Collectors row reuses both unchanged.
- **`NotificationBell`** (Phase 13) — `'use cache'` + `cacheTag('notifications', 'viewer:${viewerId}')` + `cacheLife({revalidate:30})` pattern. Direct template for Trending + Popular Collectors caching (different tags + revalidate windows).
- **`BottomNav` + `BottomNavServer` + `NavWearButton`** (Phase 14) — current 5-slot implementation; this phase replaces the slot definitions but keeps the Wear cradle, the safe-area iOS padding, and the active-state pattern.
- **`PUBLIC_PATHS` shared constant** (Phase 14) — verify new `/explore/collectors` + `/explore/watches` routes don't accidentally land in PUBLIC_PATHS; both should remain auth-gated.

### Established Patterns

- **Two-layer privacy (RLS + DAL WHERE)** — Popular Collectors must filter `profiles.profile_public = true` in the DAL even though RLS on `profiles` already enforces it. Mirror Phase 16 `searchProfiles` pattern. Two-layer guard exists for defense-in-depth.
- **Anti-N+1 `inArray` batch pattern** — `getMostFollowedCollectors` should pre-LIMIT 50, then in a single `inArray(follows.followingId, topIds)` query hydrate the viewer's `isFollowing` flags. Mirror `searchProfiles` (Phase 16).
- **`'server-only'` DAL discipline** — every new DAL file imports `'server-only'` at the top.
- **Cache Components (`cacheComponents: true`) layout** — root layout is already configured. New rail Server Components use `'use cache'` + `cacheTag` + `cacheLife`. Hero rendering depends on per-viewer counts → keep hero OUT of cache scope. Wrap hero in its own Suspense leaf if needed (mirror Phase 14 `BottomNavServer` Suspense-leaf pattern).
- **`updateTag()` for read-your-own-writes; `revalidateTag()` for cross-user fan-out** (Phase 13). When a user follows someone (Server Action), invalidate `'explore'` and `'viewer:${viewerId}'` so their /explore Popular Collectors rail loses the just-followed entry on next render. `addWatch` Server Action should fire `revalidateTag('explore')` so newly-imported watches eventually surface in Trending.
- **DAL viewer-aware reads** — Popular Collectors takes `viewerId` to enforce `notInArray(follows.followingId, alreadyFollowedIds)` + `ne(profiles.id, viewerId)`.

### Integration Points

- **`src/components/layout/BottomNav.tsx`** — slot definitions rewritten per D-01. Active-state predicates change: `isHome` (unchanged), `isSearch` (`pathname === '/search' || startsWith('/search')`), `isWear` (NavWearButton owns its own state), `isExplore` (unchanged predicate, position changes), `isProfile` (unchanged predicate). Drop `isAdd` entirely.
- **`src/components/layout/BottomNavServer.tsx`** — props passed down may shift if planner chooses to add Search-context props; otherwise unchanged. The viewer-resolution + ownedWatches fetch + null-render-on-no-username pattern stays intact.
- **`src/data/catalog.ts`** — add `getTrendingCatalogWatches({ limit })` and `getGainingTractionCatalogWatches({ limit })` here OR create a new `src/data/discovery.ts` (planner's choice; if multiple discovery readers proliferate, factor a new file).
- **`src/data/follows.ts` OR new `src/data/discovery.ts`** — add `getMostFollowedCollectors(viewerId, { limit })`. Likely lives next to the other follow readers.
- **`src/data/wearEvents.ts`** — add `getWearEventsCountByUser(userId)` if no existing helper covers it; the hero render gate needs this. Inspect existing helpers first; `getAllWearEventsByUser` returns the full list (heavy). A SELECT COUNT(*) reader is preferred.
- **New routes:** `src/app/explore/page.tsx` (rewrite from stub), `src/app/explore/collectors/page.tsx` (new), `src/app/explore/watches/page.tsx` (new). All Server Components, all auth-gated by `src/proxy.ts` (no PUBLIC_PATHS entry).
- **New components:** `src/components/explore/ExploreHero.tsx` (sparse-network welcome), `src/components/explore/PopularCollectors.tsx` (Server Component section), `src/components/explore/PopularCollectorRow.tsx` (or rebadge `SuggestedCollectorRow` if shapes match), `src/components/explore/TrendingWatches.tsx`, `src/components/explore/GainingTractionWatches.tsx`, `src/components/explore/DiscoveryWatchCard.tsx` (shared by both watch rails per D-13). Component naming is Claude's Discretion; this list is illustrative.
- **Server Action invalidations:** `followUser` (in `src/app/actions/follows.ts`) — add `revalidateTag('explore')` so Popular Collectors recomputes for the affected viewer. `addWatch` (in `src/app/actions/watches.ts`) — already has Phase 17 catalog wiring; add `revalidateTag('explore')` on the success path so newly-imported watches eventually appear in Trending. Tag granularity (per-viewer vs global) is Claude's Discretion — Trending is global, Popular Collectors is per-viewer.

</code_context>

<specifics>
## Specific Ideas

- **Profile prominence > nav-consistency:** The user explicitly chose to keep Profile in BottomNav rather than graduate it to a TopNav avatar (per the previously-written NAV-13/15 path). The goal is "Profile MORE visible" — Phase 25 NAV-13/15 ships TopNav avatar as ADDITIONAL access, not as a replacement. This is the Instagram pattern (avatar in feed tile + bottom-right tab).
- **Notifications-in-top-nav matches product identity:** Horlo is closer to Instagram/Pinterest (visual/curatorial) than to X/Bluesky/TikTok (feed-driven realtime). Modern feed-driven apps put bell in BottomNav; visual apps put bell in top. Bell-in-TopNav is intentional, not a default.
- **Add-slot deletion is philosophical, not pragmatic:** "+Add Watch" should live next to where users naturally want to add a watch (collection / wishlist / etc), not in chrome. If interim friction is observed between Phase 18 and Phase 25, reopen the decision; do NOT spot-fix by re-adding an Add slot.
- **Sparse-network hero shows AND rails show:** New users see the welcome AND see global top picks immediately. The user prefers "this surface is alive" over "clean empty state" — rails always render, hero just frames them when applicable.
- **Each rail is its own truth:** Same watch can appear in Trending AND Gaining Traction without dedup. Rationale: "most-collected ever" and "biggest mover this week" are distinct facts about the watch, and dedup imposes arbitrary precedence + hides real signal.
- **Heading iconography matters:** Flame on Trending, trending-up arrow on Gaining Traction. Same card body, different rail framing.

</specifics>

<deferred>
## Deferred Ideas

- **`/evaluate?catalogId=` deep-link target** — Phase 20 owns. Until then, watch cards are non-clickable (default) or link to a stub /evaluate that Phase 20 fills (Claude's Discretion above).
- **Editorial / featured collector slot on /explore** — DISC-09 (v4.x); requires admin curation tooling.
- **Trending feed widening to wear shots, follows, etc.** — DISC-10 (v4.x).
- **Filter facets on Trending Watches (movement / case size / style)** — adjacent to SRCH-16 (v4.x); Phase 18 ships the rails sorted-only, no faceting.
- **Realtime updates to /explore** — free-tier WebSocket cap; project-wide decision documented in PROJECT.md Key Decisions.
- **Phase 25 amendment to NAV-14 + DISC-08:** When Phase 25 plans (`/gsd-discuss-phase 25`), the discussion should re-derive BottomNav shape from this phase's D-01..D-04, not from the original NAV-14 wording. The TopNav avatar (NAV-13/15) ships as ADDITIONAL Profile access on top of BottomNav Profile, not as a replacement.
- **Hero illustration / motion design** — UI-SPEC owns visual treatment. Discuss in `/gsd-ui-phase 18`.
- **`/explore/watches` See-all surface internal layout (Trending + Gaining Traction unification)** — UI-SPEC owns whether it's a tab toggle, a sort-by select, or two stacked sections. Phase 18 ships the route + data; presentation is the UI-SPEC's call.

### Reviewed Todos (not folded)

None — `todo match-phase 18` returned zero matches.

</deferred>

---

*Phase: 18-explore-discovery-surface*
*Context gathered: 2026-04-27*
