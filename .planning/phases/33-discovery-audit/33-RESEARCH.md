# Phase 33: Discovery Audit - Research

**Researched:** 2026-05-06
**Domain:** Read-only audit methodology — falsifiable click-path enumeration of v5.0 discovery surfaces
**Confidence:** HIGH (decisions D-01..D-17 lock the entire output schema; this research operationalizes that schema, not invents it)

## Summary

Phase 33 is a zero-code documentation phase. CONTEXT.md decisions D-01 through D-17 lock the audit method, surface scope, row schema, pass/fail rules, and decisions-section format. Research focus is therefore narrow: validate the source-grep recipe against the real codebase, enumerate every entry-point file the audit must walk, catalog runtime gates that the source-pass cannot see (so the browser-pass spends time where it actually matters), pre-warn the audit author about double-counting and WR-07 silent-no-op landmines, and propose a falsifiability validator script as a Phase 39 candidate.

The 15 surface blocks (Header + 6 ROADMAP + 7 profile tabs + 1 redirect-only `/u/[username]/page.tsx`) all exist on `main` as of 2026-05-06; the directory map in `.planning/codebase/STRUCTURE.md` is severely stale (snapshot dated 2026-04-11, before /explore, /search, /u/, /catalog/ shipped) and must NOT be relied on. The actual `src/app/` tree was verified directly (see §Surface Inventory).

The source-grep recipe in CONTEXT.md `<specifics>` is correct in shape but undercounts in two predictable ways: (1) it omits the layout component subtree (`src/components/layout/{SlimTopNav,DesktopTopNav,UserMenu,BottomNav,NavWearButton}.tsx`) which carry ~10 Header surface affordances, and (2) it does not grep the page.tsx files themselves (most surfaces have ≤2 page-level affordances but `/explore/watches/page.tsx` has 6+ inline affordances). The recipe needs three additional command lines documented in §Source-Grep Recipe.

The single highest-value landmine for this audit is WR-07 — the `revalidatePath('/u/[username]/[tab]', 'page')` literal-template silent-no-op pattern. A repo-wide grep confirms `src/app/actions/wishlist.ts:206` is the LONE remaining holdout (8 of 9 sibling layout-revalidate calls use the corrected `'/u/[username]', 'layout'` pattern after Phase 32). This is a Dead-row candidate per D-11 ("element renders but target ... no-ops"). The audit captures it as `DISC-AUDIT-NN` on the `/u/{user}/wishlist` block but does NOT fix it (zero-code rule).

**Primary recommendation:** Execute the audit in three serial passes — (1) source-grep enumeration of all 15 surface blocks producing the full row table tagged `viewer_state: TBD` and `viewport: TBD`, (2) runtime-gate annotation pass (no browsing yet — just attach the Conditional Rendering Map to the candidate rows so the browser pass knows which rows to walk twice), (3) browser spot-check pass on horlo.app of ~20 high-stakes rows (the 6 confirmed runtime gates × 2 viewer states × ~2 viewports each, capped). Estimated work: 4-6 hours for the source pass, 1-2 hours for the gate annotation, 1-2 hours for the browser pass. Total ~8 hours.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Audit method (Area 1)**
- **D-01:** Source-code-first traversal. Pass 1 is a full source-code enumeration: for each surface in scope (Header + 6 ROADMAP surfaces + 7 profile tabs), grep `<Link`, `<a href`, `router.push`, `router.replace`, `redirect(`, `onClick` handlers across the component tree starting from `src/app/{surface}/page.tsx` and following imports. Each enumerated affordance becomes a candidate row tagged with `evidence: file:line`.
- **D-02:** Production horlo.app for the browser spot-check pass. After the source-code pass produces candidate rows, walk ~5–10 high-stakes rows in a real browser at horlo.app to confirm runtime behavior. Production is the source-of-truth tag; `evidence` for browser-confirmed rows reads `prod: <URL> + <observation>`.
- **D-03:** Owner AND a fresh signed-up account (no collection, no follows) walk every surface. Each row carries a `viewer_state` column tagged `owner-populated` or `fresh-account` (or `N/A` for surfaces where it doesn't matter).
- **D-04:** Both viewports (desktop ~1280px + mobile ~390px iPhone). Each row stays single unless the affordance, target, or visibility differs by viewport — in which case the row splits into two with `viewport: desktop` / `viewport: mobile`. Rows with identical behavior at both viewports carry `viewport: both`.

**Surface coverage breadth (Area 2)**
- **D-05:** Audit scope = 6 ROADMAP surfaces + Header (global) + 7 profile tabs as separate surface blocks. Final surface list (15 blocks): Header / `/` / `/explore` / `/search` / `/catalog/{catalogId}` / `/watch/{id}` / `/u/{user}/collection` / `/u/{user}/wishlist` / `/u/{user}/worn` / `/u/{user}/notes` / `/u/{user}/stats` / `/u/{user}/common-ground` / `/u/{user}/insights`.
- **D-06:** /explore sub-routes (`/explore/collectors`, `/explore/watches`) are NOT separate surface blocks. The "See all collectors" / "See all watches" affordances in the parent rails get rows on the `/explore` block. Each sub-route then gets ONE summary row.
- **D-07:** 7 profile tabs are separate surface blocks (not one `/u/{user}` block with a tab column).
- **D-08:** Header nav documented once as the "Header (global)" surface block. Per-surface variation in Header gets a single Header row noting "active state varies by surface; not enumerated per-surface".

**Click-path row schema (Area 3)**
- **D-09:** Row ID format = `DISC-AUDIT-NN` flat sequential, zero-padded to 2 digits when N<10 for stable sort.
- **D-10:** Final column set (8 columns): `row_id`, `surface`, `element`, `target`, `tag`, `evidence`, `viewer_state`, `viewport`.
- **D-11:** Strict + behavioral tag definitions (Live / Dead / Redundant / Missing) pinned in a § above the table. Includes the WR-07 silent-no-op pattern as a Dead-row example.
- **D-12:** Single rubric for "ideal click-path" — the SEED-004 Rdio principle quote pinned at the top.

**Pass/fail + decisions doc shape (Area 4)**
- **D-13:** Pass/fail criteria pinned at the TOP of DISCOVERY-AUDIT.md before any findings appear. 5 rules — audit passes IFF ALL hold.
- **D-14:** No numeric row-count thresholds per surface.
- **D-15:** Decisions § lives INLINE in DISCOVERY-AUDIT.md as the final §.
- **D-16:** Per-decision format = verdict + 2–4 sentence rationale + cited row IDs + downstream-phase impact.
- **D-17:** Exactly 4 decisions in the final §: (1) Combine home and explore? (2) Lineage browse priority. (3) Dead-end closure priority. (4) CAT-13 discovery framing.

### Claude's Discretion

User selected the recommended option on every question across all 4 areas. No areas were left for Claude's free discretion; all decisions D-01 through D-17 are user-confirmed selections among presented options.

### Deferred Ideas (OUT OF SCOPE)

- **Audit a 5th catch-all "scope-change findings" decision** — discussed and dropped per D-17.
- **Audit the auth/utility surfaces** (/notifications, /insights, /preferences, /settings, /wear/[id], /watch/new, /watch/[id]/edit, /signup, /login, /forgot-password, /reset-password, /auth/callback) — explicitly out of scope per D-05.
- **Anonymous-viewer walk** — explicitly skipped per D-03.
- **Numeric row-count thresholds per surface** — discussed and dropped per D-14.
- **`/explore` sub-routes as separate surface blocks** — dropped per D-06.
- **Header active-state per-surface enumeration** — dropped per D-08.
- **`/explore/watches` and `/explore/collectors` LoadMore behavior as separate sub-route audit** — covered as summary rows per D-06.
- **`wishlist.ts:206` `revalidatePath('/u/[username]/[tab]', 'page')` divergence** — flagged in Phase 32 deferred ideas. The audit captures it as a Dead-row candidate but does NOT fix it (zero-code rule).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DISC-10 | Read-only discovery audit produces `.planning/phases/{N}-discovery-audit/DISCOVERY-AUDIT.md` containing (a) a click-path table with one row per `(surface × clickable element)` across `/`, `/explore`, `/u/{user}`, `/catalog/{id}`, `/search`, `/watch/{id}` — each row tagged Live / Dead / Redundant / Missing — and (b) a decisions doc with explicit YES/NO/DEFERRED resolutions for: "combine home and explore?", lineage browse priority, dead-end closure priority, CAT-13 discovery framing. Pass/fail criteria are written before audit runs. Downstream phases cite specific audit row IDs. No code ships in this phase. | The full output schema, surface inventory, runtime-gate map, source-grep recipe, browser-pass logistics, validation architecture, and row-count estimates below give the planner everything needed to size and sequence the audit work to produce the artifact DISC-10 mandates. |
</phase_requirements>

## Architectural Responsibility Map

This is a documentation phase — no architectural tier owns runtime behavior. The "tiers" here are *audit method tiers*: which research/inspection technique owns each capability.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Affordance enumeration | Source-code grep (D-01) | Browser-pass (D-02) | Grep captures every wired affordance including runtime-gated ones; browser confirms a sample. |
| Runtime-gate observation | Browser-pass (D-02 + fresh-account D-03) | Source-code reading | Some gates only fire under specific viewer states (`followingCount<3 && wearEventsCount<1`); source reveals the gate condition but only browsing reveals the *rendered* surface in that state. |
| Viewport divergence | Browser-pass (D-04) at desktop + mobile | Source-grep for `md:hidden` / `md:block` Tailwind classes | Phase 27/30 mobile-first work and SRCH-16 mobile-bottom-sheet decisions only manifest at the rendered DOM. |
| Tag classification (Live/Dead/Redundant/Missing) | Combined source + browser pass | SEED-004 Rdio rubric (D-12) | Live/Dead require runtime confirmation; Redundant requires cross-row reasoning; Missing requires the Rdio rubric. |
| Decisions verdicts | Audit-author judgement (D-16) | Cited row IDs from the table | Verdicts MUST cite ≥1 row ID per D-13 rule #5 — the table is the falsifiability anchor, not author opinion. |
| Falsifiability validation | Manual review against D-13 rules | Future validator script (Phase 39 candidate) | Phase 33 validates by hand; the script is OUT OF SCOPE for this phase per zero-code rule. |

## Surface Inventory

The 15 surface blocks per D-05, with verified entry-point files (confirmed against `src/app/` tree as of 2026-05-06; STRUCTURE.md is stale — do NOT rely on it).

### Block 1 — Header (global)

| Aspect | Detail |
|--------|--------|
| Entry point | `src/components/layout/Header.tsx` (Server Component delegator) |
| Subtree to grep | `src/components/layout/{SlimTopNav,DesktopTopNav,UserMenu,NotificationBell,BottomNav,BottomNavServer,NavWearButton}.tsx` |
| Auth gate | Renders for both authenticated and anon viewers; bell + UserMenu hidden when no user |
| Mobile/desktop split | `SlimTopNav` (mobile <768px) + `DesktopTopNav` (desktop ≥768px) — CSS-hidden at the wrong breakpoint per Header.tsx:75-76 |
| BottomNav (mobile) | `src/components/layout/BottomNav.tsx` — sticky 5-item nav (Home/Search/Wear/Explore/Profile); `md:hidden`; rendered NULL on PUBLIC_PATHS per `src/lib/constants/public-paths.ts` |
| Notes | D-08 says "single row per affordance, do not enumerate per-surface active-state variation" — this is reasonable: SlimTopNav has 2 Link affordances + UserMenu trigger; DesktopTopNav has 3 Link affordances + UserMenu; BottomNav has 5 NavLink + 1 NavWearButton. ~10 distinct surface affordances total. |

### Block 2 — `/` (Home)

| Aspect | Detail |
|--------|--------|
| Entry point | `src/app/page.tsx` |
| Subtree to grep | `src/components/home/*.tsx` (20 files: WywtRail, WywtSlide, WywtTile, WywtOverlay, CollectorsLikeYou, NetworkActivityFeed, ActivityRow, AggregatedActivityRow, FeedEmptyState, PersonalInsightsGrid, MostWornThisMonthCard, RecommendationCard, SleepingBeautyCard, WishlistGapCard, CommonGroundFollowerCard, SuggestedCollectors, SuggestedCollectorRow, LoadMoreButton, LoadMoreSuggestionsButton, WatchPickerDialog) |
| Section order (LOCKED L-01) | WywtRail → CollectorsLikeYou → NetworkActivityFeed → PersonalInsightsGrid → SuggestedCollectors |
| Auth gate | `getCurrentUser()` redirects unauth via proxy.ts → /login |
| Runtime gates | PersonalInsightsGrid hides on empty collection (I-04); FeedEmptyState branches when no activity available |

### Block 3 — `/explore`

| Aspect | Detail |
|--------|--------|
| Entry point | `src/app/explore/page.tsx` |
| Subtree to grep | `src/components/explore/{ExploreHero,PopularCollectors,PopularCollectorRow,TrendingWatches,GainingTractionWatches,DiscoveryWatchCard}.tsx` |
| Sub-routes (D-06: summary rows only, NOT separate blocks) | `src/app/explore/collectors/page.tsx`, `src/app/explore/watches/page.tsx` |
| Runtime gates | `ExploreHero` renders ONLY when `followingCount<3 && wearEventsCount<1` (`src/app/explore/page.tsx:38`) — fresh-account walk REQUIRED |

### Block 4 — `/search`

| Aspect | Detail |
|--------|--------|
| Entry point | `src/app/search/page.tsx` (Server Component shell) |
| Client subtree | `src/components/search/SearchPageClient.tsx` (4-tab tabs: All / Watches / People / Collections) |
| Subtree to grep | `src/components/search/{SearchPageClient,AllTabResults,PeopleSearchRow,CollectionSearchRow,WatchSearchRow,WatchSearchRowsAccordion,HighlightedText,useSearchState,useWatchSearchVerdictCache}.tsx` |
| Auth gate | proxy.ts redirects unauth |
| Runtime gates | Empty-query state shows `SuggestedCollectorsForSearch` (server-rendered child); per-tab states (loading / error / empty / results) — 4 tabs × 4 states = 16 rendered branches |

### Block 5 — `/catalog/{catalogId}`

| Aspect | Detail |
|--------|--------|
| Entry point | `src/app/catalog/[catalogId]/page.tsx` |
| Subtree to grep | `src/components/watch/{CatalogPageActions,WatchDetail,CollectionView}.tsx` and `src/components/insights/CollectionFitCard.tsx` |
| Runtime gates | (a) UUID format check on `catalogId` → 404 if malformed (line 46); (b) verdict suppressed when `collection.length === 0`; (c) "You own this" framing when viewer owns the catalog ref (line 70) — `CatalogPageActions` NOT rendered in this branch; (d) `CatalogPageActions` 3 CTAs (Wishlist/Collection/Skip) only in cross-user framing with non-empty collection. **All three states require fresh-account + populated walk.** |

### Block 6 — `/watch/{id}`

| Aspect | Detail |
|--------|--------|
| Entry point | `src/app/watch/[id]/page.tsx` |
| Subtree to grep | `src/components/watch/WatchDetail.tsx` and `src/components/insights/CollectionFitCard.tsx` |
| Runtime gates | (a) `notFound()` if `getWatchByIdForViewer` returns null (per-row visibility filter — owner sees own; non-owner sees only `wornPublic` rows); (b) verdict suppressed when `collection.length === 0`; (c) `framing: 'same-user' \| 'cross-user'` branch on `isOwner`; (d) `viewerCanEdit={isOwner}` gates Edit + Delete affordances on WatchDetail |

### Blocks 7–13 — Profile tabs (`/u/{username}/[tab]`)

All 7 tabs share `src/app/u/[username]/layout.tsx` (renders ProfileHeader + ProfileTabs + tab content slot) and dispatch via `src/app/u/[username]/[tab]/page.tsx`.

| Block | Tab | Entry point branch | Gates |
|-------|-----|--------------------|-------|
| 7 | `/u/{user}/collection` | `[tab]/page.tsx:159-167` (renders `CollectionTabContent`) | LockedTabCard if non-owner && !`collectionPublic` (line 107); `hasUrlExtract` env-presence boolean branches AddWatchCard CTA (line 73) |
| 8 | `/u/{user}/wishlist` | `[tab]/page.tsx:169-180` (renders `WishlistTabContent`) | LockedTabCard if non-owner && !`wishlistPublic` (line 116); reorderable affordances (Phase 27) only for owner |
| 9 | `/u/{user}/worn` | `[tab]/page.tsx:198-229` (renders `WornTabContent`) | DAL visibility gate (Phase 12 WYWT-10); per-row `wornPublic` filter for non-owners |
| 10 | `/u/{user}/notes` | `[tab]/page.tsx:182-196` (renders `NotesTabContent`) | LockedTabCard if non-owner && !`collectionPublic` (line 135 — WR-01 collection-public gate); per-row `notesPublic !== false` filter for non-owners; **DEBT-09 fix territory just shipped in Phase 32** — `NoteVisibilityPill` per-row affordance |
| 11 | `/u/{user}/stats` | `[tab]/page.tsx:243-269` (renders `StatsTabContent`) | LockedTabCard if non-owner && !`collectionPublic` (line 234); wear-event visibility gate Phase 12 |
| 12 | `/u/{user}/common-ground` | `[tab]/page.tsx:80-94` | **404-on-gate-fail** per Phase 25 D-02/D-17 (not LockedTabCard; tab is absent or present, never locked); gate = viewer && !isOwner && `collectionPublic` && overlap.hasAny |
| 13 | `/u/{user}/insights` | `[tab]/page.tsx:100-103` | **404 for non-owners** (existence-leak defense P-08); ProfileTabs OMITS the link entirely for non-owners (two-layer privacy) |

**Followers/Following sub-routes** (D-05: counted as click TARGETS, NOT separate surfaces):
- `src/app/u/[username]/followers/page.tsx` — exists
- `src/app/u/[username]/following/page.tsx` — exists
- ProfileHeader.tsx:71-83 — the source of these click links (`Link href={\`/u/${username}/followers\`}` and `/following`)

**Subtree to grep for ALL 7 tab blocks**: `src/components/profile/*.tsx` (35 files including ProfileTabs, ProfileHeader, AvatarDisplay, FollowButton, FollowerListCard, FollowerList, ProfileWatchCard, SortableProfileWatchCard, NoteRow, NotesTabContent, NotesEmptyOwnerActions, NoteVisibilityPill, RemoveNoteDialog, AddWatchCard, CollectionTabContent, WishlistTabContent, WornTabContent, WornCalendar, WornTimeline, StatsTabContent, StatsCard, CollectionObservations, FilterChips, ViewTogglePill, HorizontalBarChart, CommonGroundTabContent, CommonGroundHeroBand, InsightsTabContent, LogTodaysWearButton, LockedProfileState, LockedTabCard, ProfileEditForm, TasteTagPill).

The audit author MUST grep this entire subtree once and disambiguate which tab each affordance belongs to (most tab-specific components are clearly named; some shared components like ProfileWatchCard render on both Collection and Wishlist tabs — those affordances appear on BOTH blocks per D-07 surface-block independence).

## Source-Grep Recipe (Validated + Augmented)

The recipe in CONTEXT.md `<specifics>` is correct in shape but undercounts. Validated grep counts as of 2026-05-06:

| Subtree | Files w/ ≥1 affordance | Estimated rows |
|---------|------------------------|----------------|
| `src/components/home/` | 12 / 20 | ~25-35 |
| `src/components/explore/` | 6 / 6 | ~8-12 |
| `src/components/profile/` | 13 / 35 | ~30-50 (split across 7 tab blocks) |
| `src/components/search/` | 6 / 14 | ~12-18 |
| `src/components/watch/` | 4 / ~22 | ~10-15 (split across /catalog and /watch blocks) |
| `src/components/layout/` | 3 / 10 (Slim/Desktop/UserMenu) | ~10-12 (Header block) |

**Total estimated rows:** **120–180** unique affordances after dedup. Splitting per viewer_state and viewport (D-03 / D-04) MAY add 10–30 row splits → **130–210 final rows**. This is a defensible upper bound for sizing audit time.

### Augmented grep recipe (use this, NOT the CONTEXT.md `<specifics>` version)

```bash
# 1. Page-level entry points (CONTEXT.md recipe omitted these)
rg -n '<Link\b|router\.push|router\.replace|redirect\(|<a href|onClick=' \
  src/app/page.tsx \
  src/app/explore/page.tsx src/app/explore/collectors/page.tsx src/app/explore/watches/page.tsx \
  src/app/search/page.tsx \
  src/app/catalog/\[catalogId\]/page.tsx \
  src/app/watch/\[id\]/page.tsx \
  src/app/u/\[username\]/page.tsx src/app/u/\[username\]/layout.tsx \
  src/app/u/\[username\]/\[tab\]/page.tsx \
  src/app/u/\[username\]/followers/page.tsx src/app/u/\[username\]/following/page.tsx

# 2. Domain component subtrees (per CONTEXT.md, with onClick + redirect added)
rg -n '<Link\b|router\.push|router\.replace|redirect\(|<a href|onClick=' \
  src/components/home/ \
  src/components/explore/ \
  src/components/profile/ \
  src/components/search/ \
  src/components/watch/

# 3. Layout subtree (Header block — CONTEXT.md only listed Header.tsx; the
#    real affordances live in SlimTopNav/DesktopTopNav/UserMenu/BottomNav/NavWearButton)
rg -n '<Link\b|router\.push|router\.replace|redirect\(|<a href|onClick=' \
  src/components/layout/Header.tsx \
  src/components/layout/SlimTopNav.tsx \
  src/components/layout/DesktopTopNav.tsx \
  src/components/layout/UserMenu.tsx \
  src/components/layout/BottomNav.tsx \
  src/components/layout/BottomNavServer.tsx \
  src/components/layout/NavWearButton.tsx \
  src/components/layout/NotificationBell.tsx 2>/dev/null
```

**Exclusions:** Test files (`__tests__/`, `*.test.tsx`) MUST be excluded by hand — `rg --type tsx` does not auto-skip them. The grep output mixes test files into the matches; ignore lines from `*.test.tsx` files.

**Per-affordance dedup rule:** Several components render in multiple parent surfaces (e.g., `SuggestedCollectorRow` appears on both `/` SuggestedCollectors and `/search` `SuggestedCollectorsForSearch`). Each rendered location is a SEPARATE row on the parent surface block, even if the underlying component file is shared. Do not collapse them into a single row.

## Conditional Rendering Map (runtime gates the source-pass cannot fully see)

These are the gates the browser-pass MUST walk twice (owner-populated + fresh-account) to confirm rendering. Each gate corresponds to one or more candidate rows that the source-pass produces tagged `viewer_state: TBD` — the runtime-gate annotation pass replaces TBD with the correct value before the browser pass.

| # | Surface | File:line | Gate condition | Viewer states to walk |
|---|---------|-----------|----------------|----------------------|
| G-1 | `/explore` | `src/app/explore/page.tsx:38` | `followingCount < 3 && wearEventsCount < 1` → renders `<ExploreHero>` | fresh-account (gate fires); owner-populated (gate suppressed) |
| G-2 | `/catalog/{id}` | `src/app/catalog/[catalogId]/page.tsx:46` | UUID regex fails → `notFound()` | N/A (any viewer state; reproducible by visiting `/catalog/not-a-uuid`) |
| G-3 | `/catalog/{id}` | `src/app/catalog/[catalogId]/page.tsx:70-78` | viewer owns catalog ref → "You own this" framing; CatalogPageActions NOT rendered | owner-populated walking own catalog ref vs. cross-user catalog ref |
| G-4 | `/catalog/{id}` | `src/app/catalog/[catalogId]/page.tsx:79-110` | `collection.length > 0` → verdict + CatalogPageActions; else neither | fresh-account (no verdict, no CTAs); owner-populated cross-user catalog (verdict + 3 CTAs) |
| G-5 | `/watch/{id}` | `src/app/watch/[id]/page.tsx:25` | `getWatchByIdForViewer` returns null → `notFound()` | non-owner walking owner's `wornPublic=false` wear → 404 |
| G-6 | `/watch/{id}` | `src/app/watch/[id]/page.tsx:41` | `collection.length > 0` → verdict; else null | fresh-account vs. owner-populated |
| G-7 | `/watch/{id}` | `src/app/watch/[id]/page.tsx:52` | `framing: 'same-user' \| 'cross-user'` based on `isOwner` | owner-populated walking own watch vs. another user's watch |
| G-8 | `/u/{user}/collection` | `[tab]/page.tsx:107` | non-owner && `!collectionPublic` → LockedTabCard | non-owner viewing private collection |
| G-9 | `/u/{user}/wishlist` | `[tab]/page.tsx:116` | non-owner && `!wishlistPublic` → LockedTabCard | non-owner viewing private wishlist |
| G-10 | `/u/{user}/notes` | `[tab]/page.tsx:135` | non-owner && `!collectionPublic` → LockedTabCard (WR-01 side-channel defense) | non-owner viewing private collection (notes locked even if `notesPublic` is true on individual rows) |
| G-11 | `/u/{user}/stats` | `[tab]/page.tsx:234` | non-owner && `!collectionPublic` → LockedTabCard | non-owner viewing private collection |
| G-12 | `/u/{user}/common-ground` | `[tab]/page.tsx:87` | gate-fail OR empty overlap → `notFound()` | fresh-account viewing owner's profile (no overlap → 404); owner viewing self (gate-fail → 404) |
| G-13 | `/u/{user}/insights` | `[tab]/page.tsx:101` | non-owner → `notFound()` | non-owner attempting direct URL access → 404; ProfileTabs OMITS link for non-owners |
| G-14 | `/u/{user}` (any tab) | `layout.tsx:47` | non-owner && `!profilePublic` → LockedProfileState (entire profile locked) | non-owner viewing private profile |
| G-15 | `/u/{user}/notes` (per-row) | `[tab]/page.tsx:182-186` | non-owner sees only rows where `notesPublic !== false` | non-owner viewing mix of public+private notes |
| G-16 | `/u/{user}/worn` (per-row) | `wearEvents.ts` (DAL) | non-owner sees only rows where `wornPublic = true` | non-owner viewing mix of public+private wears |
| G-17 | All authenticated surfaces | `proxy.ts:11-15` | unauth + non-public path → redirect to /login | N/A (D-03 explicitly skips anon walk) |
| G-18 | Header / BottomNav | `BottomNav.tsx:104` + `SlimTopNav` (TBD) + `Header.tsx:53-57` | `isPublicPath` → render NULL; `!user` → bell + UserMenu hidden | N/A (D-03 skips anon; auth pages hide nav) |
| G-19 | `/u/{user}` (ProfileTabs) | `ProfileTabs.tsx:54-55` | `showCommonGround` (overlap.hasAny) ? add tab; `isOwner` ? add Insights tab | viewer with overlap vs. without; owner vs. non-owner |
| G-20 | `/u/{user}/collection` (CollectionTabContent) | `[tab]/page.tsx:73` | `process.env.ANTHROPIC_API_KEY` present → AddWatchCard with URL extract; absent → 2-button manual fallback | env-dependent (production has key; dev may differ) — observe in production |

**The browser-pass priority order** is the table above filtered to gates where rendered output diverges most: **G-1, G-3, G-4, G-6, G-7, G-8, G-12, G-13, G-15, G-19** are the 10 highest-stakes gates. Walking these at owner-populated + fresh-account at one viewport each = ~20 page loads, plus cross-spotting at the alternate viewport for layout-divergent surfaces (G-1 ExploreHero mobile vs desktop; G-3/G-4 CatalogPageActions mobile bottom-sheet vs desktop sidebar) = ~25-30 total page loads. Allocate ~1-2 hours for this.

## Viewport Divergence Catalog

D-04 says rows split when affordance, target, or visibility differs by viewport. These are the known divergence sources to focus the desktop-vs-mobile spot-check on.

| # | Surface | Divergence | Source |
|---|---------|-----------|--------|
| V-1 | Header | SlimTopNav (mobile <768px) vs DesktopTopNav (desktop ≥768px) — different DOM, different affordance set | `Header.tsx:60-75` |
| V-2 | Mobile-only | BottomNav (`md:hidden` per `BottomNav.tsx:118`) — 5 affordances exist ONLY on mobile | `BottomNav.tsx` |
| V-3 | `/explore/watches` | Grid `grid-cols-2 sm:grid-cols-3 md:grid-cols-4` — same affordances, different layout | `src/app/explore/watches/page.tsx:73,106` |
| V-4 | `/u/{user}` ProfileTabs | `overflow-x-auto` mobile scroll-lock per Phase 27 | `ProfileTabs.tsx:65` |
| V-5 | ProfileWatchCard / WatchGrid | Phase 27 mobile-first grid-cols-2 redesign | `src/components/profile/SortableProfileWatchCard.tsx`, Phase 27 work |
| V-6 | `/catalog/{id}` CatalogPageActions | SRCH-16 design intent: bottom-sheet on mobile (NOT yet implemented; SRCH-16 = Phase 40); current state likely has same buttons stacked at both viewports — confirm |
| V-7 | WywtRail | Likely horizontal scroll on mobile, grid on desktop — confirm in `WywtRail.tsx` |
| V-8 | Phase 30 aspect-ratio CSS chain | **Feedback memory (`feedback_ui_spec_css_chain_blind_spot.md`)**: 6/6 PASS plan checker shipped a black-bar bug. CSS chain validation requires aspect-ratio + object-fit observation at the rendered DOM level. Wrist-photo and watch-image surfaces (WywtSlide, ProfileWatchCard, DiscoveryWatchCard) all use this pattern — spot-check at mobile width. |

**Heuristic:** Walk each surface at desktop first, then re-walk at mobile (~390px iPhone width via Chrome DevTools device emulator OR a real iPhone). Tag rows `viewport: both` by default; split into `viewport: desktop` / `viewport: mobile` ONLY when one of V-1..V-8 (or another observed divergence) applies.

## Browser-Pass Logistics

### Fresh-account fixture creation

Per CONTEXT.md `<specifics>`:

1. Open horlo.app in an incognito window (or a separate Chrome profile to avoid cookie collision with the owner account).
2. Navigate to `/signup`. Use a throwaway email address — e.g., `phase33-audit+1@horlo.app` (Gmail+ aliasing or a one-time mailbox like SimpleLogin).
3. Complete signup; verify email if required (check `mail.horlo.app` Resend SMTP — Phase 21).
4. **Do NOT** follow anyone, add any watches, or log any wear events. The account must satisfy `followingCount<3 && wearEventsCount<1` AND `collection.length === 0` simultaneously.
5. Confirm in the URL bar that the proxy.ts auth gate redirects logged-out routes to `/login` (G-17 sanity check).
6. After audit ships, the fixture account survives until SET-13 Wipe Collection / Delete Account ships (Phase 41) — no v5.0 cleanup required per CONTEXT.md.

### Owner account walk

Use the existing development account (the user's primary collector account on horlo.app). This satisfies the populated viewer state (5+ watches, ≥1 wear event, ≥3 follows after v3.0+). Confirm `followingCount` and `wearEventsCount` BEFORE the audit so the gate decisions are predictable.

### URL pattern reference (for `evidence: prod: <URL>` rows)

| Surface | URL pattern | Example for browser-pass evidence |
|---------|-------------|-----------------------------------|
| Home | `https://horlo.app/` | `prod: https://horlo.app/ — clicked "View all" on CollectorsLikeYou rail, landed on /explore` |
| /explore | `https://horlo.app/explore` | `prod: https://horlo.app/explore (fresh-account) — ExploreHero rendered with "Find your first three" copy` |
| /search | `https://horlo.app/search` | `prod: https://horlo.app/search?q=rolex — Watches tab inline-expand accordion opened verdict on row 1` |
| /catalog/{id} | `https://horlo.app/catalog/{uuid}` | `prod: https://horlo.app/catalog/{some-id} (owner-populated, cross-user ref) — verdict + 3 CTAs rendered; clicked "Add to Wishlist" → toast + /u/{user}/wishlist` |
| /watch/{id} | `https://horlo.app/watch/{uuid}` | `prod: https://horlo.app/watch/{some-id} (same-user) — Edit + Delete affordances visible` |
| /u/{user}/{tab} | `https://horlo.app/u/{username}/{tab}` | `prod: https://horlo.app/u/{another-user}/wishlist (fresh-account) — LockedTabCard rendered, no row affordances` |

### Pitfalls in the browser pass

- **Vercel ISR / Next.js Cache Components:** Some surfaces are heavily cached (per the L-01 home composition + per-rail cache scopes). Hard refresh (Cmd+Shift+R) or use incognito to bypass stale caches between the owner walk and fresh-account walk. The `cacheTag(..., viewer:${viewerId})` pattern in Header.tsx:50-52 means the bell renders viewer-specific data — confirm this in DevTools Network tab.
- **Common Ground gate flakiness:** G-12 depends on overlap data which depends on the OTHER user's collection. If the owner account follows nobody with overlap, /u/{another}/common-ground will 404 even when the gate would otherwise pass. Pre-audit step: identify ≥1 user pair with known overlap to test G-12.
- **404 vs LockedTabCard distinction:** D-11 Dead-tag includes `404`, but per-tab `LockedTabCard` is a Live tag (the affordance renders the lock UI as designed). Distinguish carefully.
- **`/explore/watches` and `/explore/collectors` summary rows (D-06):** Visit each sub-route ONCE to confirm "see all" affordance lands correctly; do NOT enumerate every Card on the sub-route — the parent rail rows already capture them per D-06.

## WR-07 Landmine — `revalidatePath` Literal-Template Silent No-Op

The `revalidatePath('/u/[username]/[tab]', 'page')` pattern silently no-ops because the literal `[username]/[tab]` does not match a compiled route entry — `revalidatePath` matches against the route DEFINITION, not literal string equality. The corrected pattern is `revalidatePath('/u/[username]', 'layout')` which bubbles to all child tabs. Phase 32 corrected `addWatch` and `editWatch`; Phase 23 originally specified the pattern.

Repo-wide grep on 2026-05-06:

```
src/app/actions/profile.ts:34,83        — '/u/[username]', 'layout'   ✅
src/app/actions/follows.ts:53,118       — '/u/[username]', 'layout'   ✅
src/app/actions/notes.ts:58,113         — '/u/[username]', 'layout'   ✅ (with WR-07 doc comments)
src/app/actions/watches.ts:269,343      — '/u/[username]', 'layout'   ✅ (Phase 32 fix)
src/app/actions/wishlist.ts:206         — '/u/[username]/[tab]', 'page'   ❌ DEAD
```

**The lone holdout is `wishlist.ts:206` — `bulkReorderWishlist` after-write revalidate.** This is a Dead-row candidate per D-11. Audit author MUST:

1. Source-pass: enumerate `reorderWishlist` as an affordance on `/u/{user}/wishlist` (the drag-reorder UI in WishlistTabContent / SortableProfileWatchCard).
2. Browser-pass (owner): drag-reorder a wishlist row; observe whether the new order persists across a hard navigation (it should — DAL writes succeed) but watch for stale visual state until manual refresh (revalidate silently no-ops, so the page doesn't re-render).
3. Tag: **Dead** — `evidence: src/app/actions/wishlist.ts:206 — revalidatePath literal-template silently no-ops; visible regression: drag-reorder does not refresh ProfileWatchCard order until manual reload`.
4. Cite SEED-004 Rdio violation: "drag-reordering a wishlist creates a perceived dead-end — the change appears not to commit until a hard refresh."

**This is the audit's flagship Dead-row finding.** Capture it but do NOT fix it (zero-code rule).

**Audit author should also grep for any OTHER potential WR-07 patterns in case Phase 33 finds new holdouts:**

```bash
rg -n "revalidatePath\('/u/\[username\]/\[tab\]'" src/
rg -n "revalidatePath\('[^']+\[[a-zA-Z]+\]" src/  # broader: any literal-bracketed-segment template
```

The second grep is the broader audit. As of 2026-05-06 it returns only the wishlist.ts:206 line.

## Estimated Row Count by Surface

Defensible row-count estimate per surface for sizing audit work. Ranges given because viewer_state and viewport splits are not predictable from source alone.

| # | Surface block | Estimated rows | Likely splits |
|---|---------------|----------------|--------------|
| 1 | Header (global) | 10–14 | V-1 mobile/desktop split adds 4–6 rows |
| 2 | `/` (Home) | 25–35 | Empty-collection branch hides PersonalInsightsGrid; FeedEmptyState branch on no-activity → 4–6 viewer_state splits |
| 3 | `/explore` | 8–12 | G-1 ExploreHero adds 1 fresh-account-only row; rails ~6 affordances each |
| 4 | `/search` | 12–18 | 4 tabs × empty/results/no-match states; viewer_state splits less likely (search is largely viewer-independent) |
| 5 | `/catalog/{id}` | 6–10 | G-3/G-4 produce 3 viewer-state splits (empty / cross-user / self-via-cross-user) |
| 6 | `/watch/{id}` | 5–8 | G-6/G-7 produce 2 viewer-state splits (same-user with verdict / cross-user with verdict / either with empty collection) |
| 7 | `/u/{user}/collection` | 8–12 | G-8 LockedTabCard split; ProfileWatchCard rendered N times per row, count ONCE |
| 8 | `/u/{user}/wishlist` | 6–10 | G-9 split; **+1 Dead row for WR-07 wishlist.ts:206 reorder** |
| 9 | `/u/{user}/worn` | 5–8 | Per-row visibility filter; calendar + timeline view toggles |
| 10 | `/u/{user}/notes` | 5–8 | G-10 split; per-row notesPublic gate; **DEBT-09 NoteVisibilityPill just-fixed** affordance |
| 11 | `/u/{user}/stats` | 4–6 | G-11 split; mostly read-only (low affordance density) |
| 12 | `/u/{user}/common-ground` | 3–5 | G-12 404 case; affordance density low |
| 13 | `/u/{user}/insights` | 3–5 | G-13 owner-only; PersonalInsightsGrid-style content |
| TOTAL | — | **100–150 rows** before splits; **130–210 after splits** | — |

The `/catalog/{id}` and `/u/{user}/{tab}` blocks have the highest viewer_state branching density and are the most likely to produce row splits. Allocate audit time accordingly.

## Validation Architecture

> Phase 33 nyquist applies the documentation-phase variant: "validation" = falsifiability + internal consistency of the markdown artifact, NOT runtime test execution.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual review against D-13 5-rule checklist (no automated framework for prose+table validation in v5.0) |
| Config file | None — D-13 rules pinned at TOP of DISCOVERY-AUDIT.md serve as the validation contract |
| Quick run command | `grep -c "DISC-AUDIT-" DISCOVERY-AUDIT.md` — sanity-check row count |
| Full validation | Manual: walk D-13 rules 1–5 against the artifact; for each Redundant row confirm cited target row exists; for each Missing row confirm SEED-004 quote citation; for each Dead row confirm reproduction evidence |

### Phase Requirements → Validation Map

| Req ID | Behavior | Test Type | Validation Procedure | File Exists? |
|--------|----------|-----------|----------------------|-------------|
| DISC-10 | Click-path table with one row per `(surface × clickable element)` across 6 ROADMAP surfaces | manual review | `grep "^| DISC-AUDIT-"` produces ≥1 row per surface in D-05 list | ❌ Wave 0 — DISCOVERY-AUDIT.md is the artifact this phase ships |
| DISC-10 | Each row tagged Live / Dead / Redundant / Missing | manual review | Tag column values are exactly one of the 4 enum values; reject "TBD" / blank / freetext | ❌ Wave 0 |
| DISC-10 | Decisions doc with YES/NO/DEFERRED for 4 named questions | manual review | Decisions § contains exactly 4 sub-§; each has a verdict line matching `(YES|NO|DEFERRED)` | ❌ Wave 0 |
| DISC-10 | Pass/fail criteria written before findings | manual review | DISCOVERY-AUDIT.md TOC: D-13 rules block appears textually BEFORE the table | ❌ Wave 0 |
| DISC-10 | Downstream phases cite specific audit row IDs | downstream-phase enforcement | Phase 34/35/38/39 plans `grep -n "DISC-AUDIT-"` returns matches; this is enforced by Phase 39 success criterion #1, not Phase 33 | N/A — downstream |
| DISC-10 | No code ships in this phase | git diff | `git diff main..HEAD --stat` shows changes only under `.planning/phases/33-discovery-audit/` and (per Phase 32 D-05 precedent) optionally `.planning/STATE.md` | manual gate |

### Sampling Rate

- **Per task commit:** None — this is a documentation phase; commit cadence drives by audit-method tier (source-pass commit → gate-annotation commit → browser-pass commit → decisions commit).
- **Per wave merge:** Manual D-13 rules walk-through.
- **Phase gate:** Full D-13 5-rule audit by `/gsd-verify-work` reviewer; cite each rule pass/fail explicitly.

### Falsifiability Validator (Phase 39 candidate — OUT OF SCOPE for Phase 33)

A future `scripts/validate-discovery-audit.ts` (or `.sh`) script would automate the manual D-13 walkthrough. The script's contract:

```
Input: .planning/phases/33-discovery-audit/DISCOVERY-AUDIT.md
Output: exit 0 if all 5 D-13 rules pass; exit 1 with diagnostic if any rule fails

Rule 1 check: parse the table, extract `surface` column distinct values, assert
  the set equals D-05 surface list (Header / / / explore / search / etc.).
Rule 2 check: for each row tagged "Dead", assert `evidence` column matches
  /file:line|prod: https?:\/\//.
Rule 3 check: for each row tagged "Missing", assert `evidence` column contains
  the substring "Rdio" or "SEED-004".
Rule 4 check: for each row tagged "Redundant", assert `evidence` column matches
  /Redundant to DISC-AUDIT-\d+/ AND that the cited row ID exists in the table.
Rule 5 check: parse the Decisions § (last § in the file), assert exactly 4
  sub-§ each with verdict in {YES, NO, DEFERRED} AND `Cited rows:` line
  containing ≥1 `DISC-AUDIT-NN` reference, AND that the cited rows exist
  in the table.

Optional rule 6 (D-10 schema): assert all 8 columns are present in the table
  header row.
```

**Why deferred:** Phase 33 zero-code rule forbids shipping the script. Phase 39 may decide to ship it as part of "Audit-Driven Discovery Polish" if v5.x re-audits become a recurring need — at that point the script earns its complexity.

### Wave 0 Gaps

- [ ] `.planning/phases/33-discovery-audit/DISCOVERY-AUDIT.md` — the artifact this phase produces; existence + 5-rule pass IS the wave 0 contract
- [ ] (Optional, Phase 39 candidate) `scripts/validate-discovery-audit.ts` — automated falsifiability check; NOT shipped in Phase 33

*(No test framework install needed — manual review is the framework at this phase scale.)*

## Common Pitfalls (Audit-Method Specific)

### Pitfall 1: Double-counting affordances rendered in shared components

**What goes wrong:** Components like `SuggestedCollectorRow` or `ProfileWatchCard` are rendered in multiple parent surfaces. The grep returns the affordance once per source file, but the AFFORDANCE appears once per RENDERED LOCATION.
**Why it happens:** Source-grep is file-oriented; D-08/D-09 row-counting is surface-oriented.
**How to avoid:** When a grep match's parent component is a shared component, walk the import graph to identify EVERY surface that imports it. Each rendering location is a separate row on the parent surface block.
**Warning signs:** Final row count comes in suspiciously low (< 100). Indicates shared components are being collapsed into single rows.

### Pitfall 2: Conflating LockedTabCard "locked" with Dead

**What goes wrong:** A tab renders LockedTabCard (e.g., non-owner viewing private collection) and the auditor tags it Dead because "the tab content is unreachable."
**Why it happens:** "Renders but you can't get past it" feels dead-end-ish. But D-11 Live tag covers "renders in the documented viewer_state AND target loads to expected destination" — LockedTabCard IS the target in non-owner state. It's a designed lock, not a failure.
**How to avoid:** Tag LockedTabCard as Live when (a) it renders the correct lock UI for the viewer_state and (b) the SEED-004 Rdio principle is satisfied (the viewer is informed, not lost).
**Warning signs:** Many private-profile rows tagged Dead → likely conflated.

### Pitfall 3: Header active-state per-surface temptation

**What goes wrong:** Auditor enumerates the Header's 10 affordances 13 times (once per authenticated page), inflating the table by ~130 rows.
**Why it happens:** D-08 explicitly forbids this but the source-grep produces matches per file, and Header.tsx renders on every authenticated page.
**How to avoid:** Treat the Header as a single block (block 1 of 15). Per-surface variations in active-state get a SINGLE Header row noting "active state varies by surface; not enumerated per-surface" per D-08.
**Warning signs:** Final row count > 250 → likely Header was enumerated per-surface.

### Pitfall 4: Browser-pass scope creep beyond ~30 page loads

**What goes wrong:** Auditor walks every row in the browser, turning a ~2-hour spot-check into a ~12-hour exhaustive walk.
**Why it happens:** Source-grep tags candidate rows as TBD viewer_state; auditor feels obligated to confirm every one.
**How to avoid:** The runtime-gate annotation pass (between source and browser passes) replaces TBD with the correct value FROM SOURCE READING (file:line of the gate). Browser pass walks ONLY the high-stakes G-1..G-20 gates, ~25-30 page loads total.
**Warning signs:** Browser-pass time exceeds 3 hours → likely walking too many rows.

### Pitfall 5: Decisions § verdicts that don't cite rows

**What goes wrong:** Decision Q1 ("Combine home and explore?") gets a verdict + rationale that reads as gut-call rather than table-driven.
**Why it happens:** D-16 mandates citing rows but the rows might not exist for the verdict the auditor wants. Auditor papers over the gap.
**How to avoid:** D-13 rule #5 fails the audit if any verdict lacks ≥1 cited row ID. Run rule #5 BEFORE merging.
**Warning signs:** "Cited rows:" line missing or sparse → audit fails rule #5; reviewer rejects.

### Pitfall 6: Treating STRUCTURE.md as authoritative

**What goes wrong:** STRUCTURE.md is dated 2026-04-11, before /explore, /search, /u/, /catalog/ all shipped. Treating it as the directory map omits 4 of the 6 ROADMAP surfaces.
**Why it happens:** STRUCTURE.md exists in `.planning/codebase/` and feels canonical.
**How to avoid:** Re-verify against `ls src/app/` AND `ls src/components/` directly before grepping. The Surface Inventory § above does this verification once for the audit author.
**Warning signs:** Reading STRUCTURE.md → /preferences and /insights show as full surfaces but /explore and /search are absent. Stop and re-verify.

## Code Examples

This is a documentation phase — no code ships. Below are example *audit table rows* in the D-10 schema, illustrating the 4 tag types. These are illustrative, not authoritative findings.

### Example Live row

```markdown
| DISC-AUDIT-01 | / | "Avatar in CollectorsLikeYou row 1" | /u/{username} | Live | src/components/home/CollectorsLikeYou.tsx:NN | owner-populated | both |
```

### Example Dead row (WR-07 candidate)

```markdown
| DISC-AUDIT-NN | /u/{user}/wishlist | "Drag handle on wishlist row (reorder)" | reorderWishlist Server Action | Dead | src/app/actions/wishlist.ts:206 — revalidatePath('/u/[username]/[tab]', 'page') silently no-ops; reorder commits to DB but page does not refresh; SEED-004 violation: drag-reorder appears to fail until manual reload | owner-populated | both |
```

### Example Redundant row

```markdown
| DISC-AUDIT-NN | /search | "All-tab People section 'See all'" | sets tab=people | Redundant | Redundant to DISC-AUDIT-MM ("People tab in TabsList trigger") — both arrive at the same People-tab content with the same query | N/A | both |
```

### Example Missing row

```markdown
| DISC-AUDIT-NN | /catalog/{id} | "(no affordance)" | — | Missing | Rdio violation: catalog page has no affordance to walk to other watches in the same family or by the same brand. SEED-004 quote: "without ever feeling lost or running into a dead end" | owner-populated cross-user | both |
```

## Sources

### Primary (HIGH confidence)
- `.planning/phases/33-discovery-audit/33-CONTEXT.md` — D-01..D-17 user-confirmed decisions (the entire audit method spec)
- `.planning/REQUIREMENTS.md` §DISC-10 line 19 — the requirement text
- `.planning/ROADMAP.md` §"Phase 33: Discovery Audit" lines 132–142 — 5 success criteria
- `.planning/STATE.md` §"Key Decisions (v5.0)" lines 65–72 — Phase 39 + Phase 35 audit-conditional scope
- `.planning/seeds/SEED-004-v5-discovery-north-star.md` line 15 — the Rdio principle quote (D-12 anchor)
- `.planning/research/PREMIUM-MAP.md` — confirms no paywall in v5.0; no paid-vs-free forks to audit
- `src/app/{page.tsx,explore/page.tsx,search/page.tsx,catalog/[catalogId]/page.tsx,watch/[id]/page.tsx,u/[username]/{layout.tsx,page.tsx,[tab]/page.tsx}}` — verified 2026-05-06 against actual `ls` output
- `src/components/layout/{Header,SlimTopNav,DesktopTopNav,UserMenu,BottomNav,NavWearButton}.tsx` — Header surface block source
- `src/components/{home,explore,profile,search,watch}/*.tsx` — affordance source files; counts via `rg -c`
- `src/app/actions/{notes,profile,follows,watches,wishlist,wearEvents,preferences}.ts` — WR-07 holdout grep (wishlist.ts:206 confirmed lone holdout)
- `src/proxy.ts` + `src/lib/constants/public-paths.ts` — auth gate behavior; PUBLIC_PATHS list
- `.planning/phases/32-debt-09-notespublic-fix/32-CONTEXT.md` §WR-07 — the silent-no-op pattern reference

### Secondary (MEDIUM confidence)
- `.planning/codebase/STRUCTURE.md` — directory map (STALE 2026-04-11; flagged in Pitfall 6; do not rely on)
- `.claude/projects/-Users-tylerwaneka-Documents-horlo/memory/feedback_ui_spec_css_chain_blind_spot.md` — V-8 Phase 30 aspect-ratio CSS-chain blind spot

### Tertiary (LOW confidence)
- None — the entire audit method is locked in CONTEXT.md; this research operationalizes that spec rather than hypothesizing.

## Open Questions

1. **Should the source-grep recipe also include `redirect()` calls outside of page.tsx?**
   - What we know: `redirect(\`/u/${username}/collection\`)` at `src/app/u/[username]/page.tsx:10` is a navigation affordance; counted in the page-level grep above.
   - What's unclear: Server Actions also use `redirect()` (e.g., post-signup redirects). These aren't user-facing clickable elements but they ARE click-path destinations.
   - Recommendation: Treat Server Action `redirect()` calls as TARGETS of affordances (the affordance is the form submit; the redirect is where it ends up), NOT separate affordances. This matches D-10 schema where `target` is a route or action.

2. **How to handle BottomNav rendering on PUBLIC_PATHS (G-18)?**
   - What we know: BottomNav.tsx:104 returns null on PUBLIC_PATHS. Auth pages (/login, /signup) hide BottomNav entirely.
   - What's unclear: Should the audit document these no-render cases as Dead rows? Or skip because PUBLIC_PATHS are out of scope per D-05?
   - Recommendation: Skip — D-05 explicitly excludes /login, /signup, etc. The "BottomNav doesn't render on /login" is correct behavior, not a discovery dead-end.

3. **Phase 30 CSS-chain blind spot — should the audit assert computed styles?**
   - What we know: `feedback_ui_spec_css_chain_blind_spot.md` says class-name validation missed the black-bar bug; computed-style assertions would have caught it.
   - What's unclear: Phase 33 is documentation-only; computed-style assertions belong in Phase 30/42 VALIDATION.md backfill.
   - Recommendation: Audit author OBSERVES at mobile viewport (V-8) and tags any visible aspect-ratio / object-fit failure as a Dead row with evidence "rendered black-bar at viewport 390px"; the FIX is Phase 42 (DEBT-10 Nyquist hardening), not Phase 33.

4. **Decision Q4 ("CAT-13 discovery framing") — what does the verdict actually decide?**
   - What we know: D-17 says Q4 drives Phase 38 framing — "tech debt" vs "discovery improvement".
   - What's unclear: How does the AUDIT TABLE produce evidence for this decision? CAT-13 is engine code, not a click-path affordance.
   - Recommendation: The verdict cites Missing rows on `/catalog/{id}` and `/watch/{id}` where the verdict is suppressed (G-4, G-6 empty-collection branches) OR where catalog taste columns would visibly change the verdict label. If many such rows exist, CAT-13 is a discovery improvement; if few, it's tech debt. Audit author should look for verdict-related rows and weight Q4 accordingly.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `rg` (ripgrep) | Source-grep recipe | ✓ (verified by repeat usage) | system-installed | `grep -rn` (slower, equivalent for the patterns used) |
| Chrome / Chromium browser | Browser spot-check pass | ✓ (assumed on developer machine) | any modern | Firefox / Safari work equivalently for the spot-check |
| Incognito / separate Chrome profile | Fresh-account walk isolation | ✓ | — | Different browser app |
| `mail.horlo.app` Resend SMTP | Fresh-account email verification on signup | ✓ (Phase 21 SMTP-01..05 shipped v4.0) | — | Use existing test account if signup verification fails |
| horlo.app production deployment | D-02 source-of-truth | ✓ (assumed live) | current main | If prod is down, audit falls back to local `npm run dev` against same DB — flag the divergence in evidence URLs |

**No missing dependencies.** All required tooling is available.

## Project Constraints (from CLAUDE.md / AGENTS.md)

- **AGENTS.md:** "This is NOT the Next.js you know" — Next.js 16 has breaking changes from training data. Read `node_modules/next/dist/docs/` before writing code. **Phase 33 ships zero code, so this constraint is observational only.** The audit consumes existing Next.js 16 behavior; documenting it correctly requires reading the actual source (which research did).
- **CLAUDE.md tech stack:** Next.js 16.2.3 App Router, React 19.2.4, TypeScript 5, Tailwind CSS 4. Confirmed against `package.json`.
- **CLAUDE.md conventions:** All paths use `@/*` alias (maps to `src/`); no relative `../../` traversals. **Phase 33 paths in DISCOVERY-AUDIT.md MUST use the same `@/...` alias OR raw `src/...` paths consistently** — pick one and stick to it. Recommend raw `src/...` paths for clarity in the audit table (they're shorter and unambiguous as `evidence: file:line` values).
- **CLAUDE.md GSD workflow enforcement:** "Before using Edit, Write, or other file-changing tools, start work through a GSD command." **Phase 33 is invoked via `/gsd-execute-phase 33` after planning** — research executes from `/gsd-research-phase` (this run); no direct edits outside the workflow.
- **No project skills configured** — `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/` all absent per CLAUDE.md "Project Skills" §.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Total estimated rows: 130–210 after splits | §Estimated Row Count by Surface | Audit takes 2x longer than scoped; planner under-sizes the phase work effort |
| A2 | Browser-pass = ~25-30 page loads, ~1-2 hours | §Browser-Pass Logistics | Browser pass takes longer; total audit work estimated >8 hours |
| A3 | wishlist.ts:206 visibly fails to refresh after drag-reorder (Dead row evidence) | §WR-07 Landmine | If revalidatePath logs an error or a downstream cache invalidation hides the bug, this stops being a Dead row. Browser-pass MUST confirm the actual user-visible failure mode before tagging Dead. |
| A4 | The `cacheTag(viewer:${viewerId})` pattern in Header.tsx isolates rendered state per-viewer | §Browser-Pass Pitfalls | If cache leak across viewers, owner-populated walk would see fresh-account state mixed in. Verify by walking owner ↔ fresh-account in alternating order without shared cookies. |
| A5 | All G-1..G-20 gates correctly map to viewer_state {owner-populated, fresh-account, N/A} | §Conditional Rendering Map | If a gate requires a 3rd viewer_state (e.g., "owner-populated but with empty wishlist"), audit row counts grow accordingly |
| A6 | The fresh-account fixture survives until SET-13 (Phase 41) without manual cleanup | §Fresh-account fixture creation | If signup creates noisy data visible to other users (e.g., appears in PopularCollectors with low signal), audit author must clean up post-audit. Low risk at single-user app scale. |
| A7 | Phase 30 aspect-ratio bug surfaces visibly at 390px width on `WywtSlide` / `ProfileWatchCard` / `DiscoveryWatchCard` | §Viewport Divergence Catalog V-8 | If the bug only surfaces on a specific photo aspect ratio, the audit needs photo-quality fixtures. Skip if not reproducible; capture as Open Question for Phase 42. |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

## Metadata

**Confidence breakdown:**
- Surface inventory: HIGH — verified against `ls src/app/` and `ls src/components/` on 2026-05-06
- Source-grep recipe: HIGH — validated by running `rg` and counting matches per file
- Conditional rendering map (G-1..G-20): HIGH — every gate cited file:line confirmed
- WR-07 landmine: HIGH — repo-wide grep confirms wishlist.ts:206 lone holdout
- Row-count estimates: MEDIUM — based on grep counts, but viewer_state and viewport splits are author-judgement-dependent
- Browser-pass logistics: MEDIUM — fresh-account creation steps are repo-precedent-aware but not literally tested in this research session
- Validator script contract (Phase 39 candidate): MEDIUM — proposed contract is reasonable but not implemented or tested

**Research date:** 2026-05-06
**Valid until:** 2026-06-06 (30 days for stable; if Phase 33 has not started by then, re-verify the Surface Inventory and WR-07 holdout grep — both are deterministic and fast)
