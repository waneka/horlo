---
phase: 46-explore-shell-browse-archetypes
verified: 2026-05-18T21:25:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Modules hide correctly on /explore — EXPL-02 null-hiding passes visual inspection"
    expected: "When no editorial content exists: HeroModule, CuratedListsRail, WhereCollectionsGo produce zero visible DOM output; CollectorArchetypes hides when archetype counts are empty; BrowseModule always shows 3 tiles (static links, cannot be empty). On live /explore only CollectorArchetypes + BrowseModule render."
    why_human: "The Phase-47 null stubs and the CollectorArchetypes null-guard work in code, but confirming no empty container (no invisible height, no padding-only box) requires visual inspection. BrowseModule never has an empty state by design — its 'null guard' is theoretical. EXPL-02 checkbox is still unchecked in REQUIREMENTS.md."
  - test: "A-Z jump nav on /explore/brands scrolls without heading hiding under nav — EXPL-04 UAT"
    expected: "Tapping a letter anchor scrolls the correct letter section into view with scroll-mt-12 keeping the heading clear of the sticky nav. EXPL-04 checkbox is unchecked in REQUIREMENTS.md even though A-Z nav code is implemented."
    why_human: "scroll-mt-12 offset is verified in code but the actual scroll behavior (correct offset, not hidden under sticky nav) requires a real browser. REQUIREMENTS.md checkbox [x] needs human confirmation to close."
  - test: "All 10 archetype chips resolve to at least one result"
    expected: "Every chip on /explore/Collector Archetypes shows count > 0 and navigating to /search?tab=watches&archetype={value} returns at least one watch for each of the 10 primary_archetype values."
    why_human: "This is a live-data assertion. Code provides the null-guard mechanism and ARCHETYPE_CONFIG covers all 10 values. Whether each archetype has catalog coverage is a DB state question, not verifiable without a running database."
  - test: "Archetype chip navigates to /search with prefiltered results and editorial header"
    expected: "Clicking a chip on /explore lands on /search?tab=watches&archetype={value} showing watches filtered by that archetype, an archetype editorial header (displayName + description + N watches), and a removable chip above the results."
    why_human: "End-to-end user flow across two routes requires a running dev server. Code wiring is verified; the actual interaction flow needs human verification."
---

# Phase 46: Explore Shell + Browse + Archetypes — Verification Report

**Phase Goal:** `/explore` renders as a 5-module shell and users can browse the catalog by brand, era, and genre, and deep-link into archetype-filtered search results
**Verified:** 2026-05-18T21:25:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `/explore` renders a five-module page — stacked on mobile, grid on desktop; any module with no available content hides itself entirely (no empty containers) [SC #1 / EXPL-01 + EXPL-02] | ✓ VERIFIED (code); ? UNCERTAIN (visual — see human items 1 & 2) | `src/app/explore/page.tsx` renders all 5 modules in `flex flex-col gap-6 md:grid md:grid-cols-2 md:gap-8`; HeroModule/CuratedListsRail/WhereCollectionsGo each return `null`; CollectorArchetypes has `if (counts.length === 0) return null`; EXPL-02 checkbox unchecked in REQUIREMENTS.md (documentation gap, not code gap) |
| 2 | Browse the Catalog presents brand, era, and genre indices with accurate counts; tapping a grouping opens `/search` prefiltered by that facet [SC #2 / EXPL-03] | ✓ VERIFIED | BrowseModule.tsx renders 3 tiles linking to `/explore/brands`, `/explore/eras`, `/explore/genres`; index pages fetch via `getBrowseBrandCounts()`, `getBrowseEraCounts()`, `getBrowseGenreCounts()` — real GROUP BY SQL queries with `'use cache'` + `cacheTag('explore', 'explore:browse')`; each row links to `/search?tab=watches&brand=`, `&era=`, `&genre=`; CR-01 fixed: `revalidateTag('explore', 'max')` now called in `/api/extract-watch/route.ts` |
| 3 | The Brands index includes A-Z jump navigation allowing the user to jump to any letter section [SC #3 / EXPL-04] | ✓ VERIFIED (code); ? UNCERTAIN (visual — see human item 2) | `brands/page.tsx` has sticky `top-0` nav with 27 letter anchors (A-Z + #), `id="letter-{X}"` section anchors, `scroll-mt-12` on every section; EXPL-04 checkbox unchecked in REQUIREMENTS.md (documentation gap, not code gap) |
| 4 | Collector Archetypes renders a chip rail with all 10 archetypes, each showing a watch-count badge; tapping a chip opens prefiltered search results with an archetype header [SC #4 / EXPL-05] | ✓ VERIFIED (code); ? UNCERTAIN (live data — see human items 3 & 4) | `CollectorArchetypes.tsx` imports ARCHETYPE_CONFIG (10 entries), iterates `ARCHETYPE_ORDER` (all 10 values), renders `<Link href="/search?tab=watches&archetype=${value}">` per chip, includes `<Badge>` count; `SearchPageClient.tsx` renders editorial header (displayName + description + count) guarded by `archetype in ARCHETYPE_CONFIG`; 2/2 unit tests pass |

**Score:** 4/4 truths verified (code-level); 4 human verification items pending

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Price-band Browse index (original phase goal text included "price band") | Phase 47 → v6.0 Market Value (SEED-005) | CONTEXT.md D-08: `watches_catalog` has no price column; deferred to v6.0 when `market_prices` added. ROADMAP.md Phase 46 goal text already amended to remove "price band". REQUIREMENTS.md EXPL-03 carries scope clarification note. |
| 2 | Hero, Curated Lists Rail, Where Collections Go modules wired with editorial content | Phase 47 | All three are null-returning stubs per EXPL-02; Phase 47 goal explicitly covers these modules. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/archetype-config.ts` | 10-entry ARCHETYPE_CONFIG lookup | ✓ VERIFIED | 10 entries (dress, dive, field, pilot, chrono, gmt, racing, sport, tool, hybrid); exports `ArchetypeConfig` interface and `ARCHETYPE_CONFIG`; no stubs |
| `src/data/browse.ts` | 4 cached browse count DAL functions | ✓ VERIFIED | Exports `getBrowseBrandCounts`, `getBrowseEraCounts`, `getBrowseGenreCounts`, `getBrowseArchetypeCounts`; 4 `'use cache'` directives; 4 `cacheTag('explore', 'explore:browse')`; real `db.execute(sql)` GROUP BY queries |
| `src/data/catalog.ts` | CatalogSearchFilters extended | ✓ VERIFIED | `CatalogSearchFilters` has `brand?: string`, `era?: EraSignal`, `genre?: PrimaryArchetype`, `archetype?: PrimaryArchetype`; `hasActiveFacet` extended to all 4 new facets; WHERE predicates for era/archetype+genre/brand implemented |
| `src/app/actions/search.ts` | searchSchema Zod fields for brand/era/genre/archetype | ✓ VERIFIED | `era: z.enum(ERA_SIGNALS).optional()`, `genre: z.enum(PRIMARY_ARCHETYPES).optional()`, `archetype: z.enum(PRIMARY_ARCHETYPES).optional()`, `brand: z.string().max(100).optional()`; WR-01 fix applied — enums derived from vocab source of truth |
| `src/components/search/useSearchState.ts` | brand/era/genre/archetype state + URL sync | ✓ VERIFIED | 4 state pairs initialized from URL params; 4 `params.set()` calls in URL sync; `hasActiveFacet` extended; all 4 passed to `searchWatchesAction`; all 4 in effect deps array; exported in `UseSearchState` interface and return object |
| `src/components/search/SearchPageClient.tsx` | Inline removable facet chips + archetype editorial header | ✓ VERIFIED | Imports `ARCHETYPE_CONFIG` and `X`; `archetype in ARCHETYPE_CONFIG` guard (WR-03 fix); editorial header with displayName + description + `{results.length} watches`; chip rail with `flex flex-wrap gap-2`; X icon + `sr-only` "Remove ... filter" on each chip; chips dismiss via setter callbacks |
| `src/app/explore/page.tsx` | 5-module /explore shell | ✓ VERIFIED | Imports all 5 modules; `flex flex-col gap-6 md:grid md:grid-cols-2 md:gap-8` container; no empty containers (null stubs produce nothing) |
| `src/components/explore/CollectorArchetypes.tsx` | 10-chip archetype rail | ✓ VERIFIED | `'use cache'` + `cacheTag('explore', 'explore:archetypes')`; iterates all 10 ARCHETYPE_CONFIG entries; `min-h-[44px]` chips; `/search?tab=watches&archetype=` links; null-guard |
| `src/components/explore/BrowseModule.tsx` | 3-tile Browse entry module | ✓ VERIFIED | `'use cache'`; 3 tiles only (Brands, Eras, Genres — no 4th Price-bands tile per D-08); links to `/explore/brands`, `/explore/eras`, `/explore/genres`; `min-h-12` |
| `src/app/explore/brands/page.tsx` | Brands index with A-Z jump nav | ✓ VERIFIED | Sticky `top-0` nav with `z-10`; 27 letter buckets (A-Z + #, per WR-05 fix); `id="letter-{X}"` sections with `scroll-mt-12`; brand rows link to `/search?tab=watches&brand=${slug}` |
| `src/app/explore/eras/page.tsx` | Eras index | ✓ VERIFIED | Fetches `getBrowseEraCounts()`; ERA_DISPLAY_NAMES map for vintage-leaning/modern/contemporary; links to `/search?tab=watches&era=${value}` |
| `src/app/explore/genres/page.tsx` | Genres index | ✓ VERIFIED | Title is "Genres" (not "Archetypes" — D-17); `getBrowseGenreCounts()`; GENRE_DISPLAY_NAMES map; links to `/search?tab=watches&genre=${value}`; no editorial descriptions |
| `src/components/explore/HeroModule.tsx` | Phase-47 null stub | ✓ VERIFIED | Returns `null`; comment: "Phase 47 wires this. Per EXPL-02: absent is correct." |
| `src/components/explore/CuratedListsRail.tsx` | Phase-47 null stub | ✓ VERIFIED | Returns `null`; same comment pattern |
| `src/components/explore/WhereCollectionsGo.tsx` | Phase-47 null stub | ✓ VERIFIED | Returns `null`; same comment pattern |
| `src/data/__tests__/browse.test.ts` | Wave 0 browse count tests | ✓ VERIFIED | 8 tests, all passing |
| `src/data/__tests__/catalog-facets.test.ts` | Facet predicate tests (7 cases, no remaining skips) | ✓ VERIFIED | 7 tests, all passing (no `it.skip`) |
| `src/lib/archetype-config.test.ts` | ARCHETYPE_CONFIG coverage tests | ✓ VERIFIED | 4 tests, all passing |
| `src/components/explore/__tests__/CollectorArchetypes.test.tsx` | Null-hide + 10-chip tests | ✓ VERIFIED | 2 tests, all passing (no remaining `it.skip`) |
| `.planning/ROADMAP.md` | Phase 46 criterion #4 says 10 archetypes | ✓ VERIFIED | "all 10 archetypes" present; "all 8 archetypes" absent; price-band deferral note in criterion #2 |
| `.planning/REQUIREMENTS.md` | EXPL-05 says "ten archetypes"; EXPL-03 has price-band deferral note | ✓ VERIFIED | "ten archetypes" present; "eight archetypes" absent; EXPL-03 carries scope clarification |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `CollectorArchetypes.tsx` | `getBrowseArchetypeCounts` in `browse.ts` | `const counts = propCounts ?? (await getBrowseArchetypeCounts())` | ✓ WIRED | Import confirmed; production path calls the real DAL function |
| `CollectorArchetypes.tsx` chips | `/search?tab=watches&archetype={value}` | `<Link href>` per chip | ✓ WIRED | `href={\`/search?tab=watches&archetype=${value}\`}` for all 10 chips |
| `brands/page.tsx` brand rows | `/search?tab=watches&brand={slug}` | `<Link href>` per row | ✓ WIRED | `href={\`/search?tab=watches&brand=${brand.slug}\`}` |
| URL params brand/era/genre/archetype | `searchCatalogWatches` WHERE predicates | `useSearchState` → `searchWatchesAction` → `CatalogSearchFilters` | ✓ WIRED | State initialized from `searchParams.get()`; 4 `params.set()` in URL sync; 4 fields passed to action; action validated by Zod; DAL predicate builder handles all 4 |
| `SearchPageClient.tsx` | `ARCHETYPE_CONFIG` lookup | `archetype in ARCHETYPE_CONFIG ? ARCHETYPE_CONFIG[archetype as PrimaryArchetype] : null` | ✓ WIRED | Guarded lookup; WR-03 fix applied |
| `browse.ts` cache tags | `revalidateTag('explore', 'max')` bust | `cacheTag('explore', 'explore:browse')` in each function | ✓ WIRED | Both invalidation paths confirmed: `watches.ts:294` (addWatch action) AND `extract-watch/route.ts:230` (URL import path — CR-01 fix) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `CollectorArchetypes.tsx` | `counts` array | `getBrowseArchetypeCounts()` → `db.execute(sql` GROUP BY primary_archetype`)` | Yes — real DB query | ✓ FLOWING |
| `brands/page.tsx` | `brands` array | `getBrowseBrandCounts()` → `db.execute(sql` JOIN brands GROUP BY`)` | Yes — real DB query with JOIN | ✓ FLOWING |
| `eras/page.tsx` | `eras` array | `getBrowseEraCounts()` → `db.execute(sql` GROUP BY era_signal`)` | Yes — real DB query | ✓ FLOWING |
| `genres/page.tsx` | `genres` array | `getBrowseGenreCounts()` → `db.execute(sql` GROUP BY primary_archetype`)` | Yes — real DB query | ✓ FLOWING |
| `WatchesPanel` in `SearchPageClient.tsx` | `results` (watchesResults) | `searchWatchesAction` → `searchCatalogWatches` with facet predicates | Yes — Drizzle ORM query with WHERE predicates | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| archetype-config covers all 10 PRIMARY_ARCHETYPES | `npx vitest run src/lib/archetype-config.test.ts` | 4/4 tests pass | ✓ PASS |
| browse DAL functions return correctly-shaped data | `npx vitest run src/data/__tests__/browse.test.ts` | 8/8 tests pass | ✓ PASS |
| catalog facet extension (archetype/era/genre/brand WHERE predicates) | `npx vitest run src/data/__tests__/catalog-facets.test.ts` | 7/7 tests pass | ✓ PASS |
| CollectorArchetypes null-hide + 10-chip render | `npx vitest run src/components/explore/__tests__/CollectorArchetypes.test.tsx` | 2/2 tests pass | ✓ PASS |
| No TypeScript errors in production source files | `npx tsc --noEmit` (filtering *.test.* files) | 0 errors in non-test src/ files; 3 pre-existing test file errors (RailEntry/verdict, SearchPageClient.test/styleVocab) — confirmed pre-existing baseline unrelated to Phase 46 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| EXPL-01 | 46-03 | `/explore` renders five-module page | ✓ SATISFIED | 5 module components imported and rendered in `explore/page.tsx` |
| EXPL-02 | 46-01, 46-03 | Modules with no content hide themselves | ✓ SATISFIED (code); ? human UAT needed | Phase-47 stubs return null; CollectorArchetypes null-guard; REQUIREMENTS.md checkbox unchecked |
| EXPL-03 | 46-01, 46-02, 46-03 | Browse indices with counts + prefiltered /search + cache | ✓ SATISFIED | 3 index pages with cached GROUP BY queries; each row links to /search with facet params; WR-04 brand slug resolution improved |
| EXPL-04 | 46-03 | Brands index A-Z jump navigation | ✓ SATISFIED (code); ? human UAT needed | sticky nav, scroll-mt-12 anchors implemented; REQUIREMENTS.md checkbox unchecked |
| EXPL-05 | 46-01, 46-02, 46-03, 46-04 | Collector Archetypes: 10 chips with count badges + archetype header on /search | ✓ SATISFIED (code); ? live data check needed | 10-chip rail with ARCHETYPE_CONFIG lookup; archetype header in SearchPageClient; REQUIREMENTS.md updated to "ten archetypes" |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/actions/follows.ts` | 91 | Stale comment referencing deleted `src/components/explore/PopularCollectors.tsx` | Info | Comment-only reference; no import, no functionality affected |
| `src/components/search/SearchPageClient.tsx` | 416, 438 | Brand and genre chip labels use naive `charAt(0).toUpperCase()` capitalization (IN-03) | Info | `grand-seiko` renders as `Grand-seiko`; visually sub-optimal but not a functional gap; pre-existing known issue from code review |
| `src/components/search/SearchPageClient.tsx` | ~391-444, ~474-525 | Facet chip JSX block duplicated between two render branches (IN-02) | Info | Maintenance hazard; code review flagged; does not affect Phase 46 goal |
| `src/data/browse.ts` | 44-56, 95-106 | `getBrowseGenreCounts` and `getBrowseArchetypeCounts` run identical SQL (IN-01) | Info | Duplicate query bodies; code review flagged; does not affect correctness |

No blockers found. No unresolved `TBD`, `FIXME`, or `XXX` markers in any Phase 46 modified files.

### Human Verification Required

**1. EXPL-02 visual null-hiding — No empty containers on /explore**

**Test:** Run `npm run dev`. Visit `/explore`. Confirm that only two modules render (Collector Archetypes and Browse the Catalog). Check that there are no invisible placeholder boxes, no gap-only empty areas, and no debug-visible empty containers where Hero / Curated Lists / Where Collections Go would appear. Inspect the DOM (DevTools) to confirm the phase-47 module slots produce zero DOM output.
**Expected:** Exactly two modules visible. The responsive grid shows CollectorArchetypes and BrowseModule side-by-side on desktop, stacked on mobile. No additional spacing or artifacts from the three null-returning stubs.
**Why human:** Visual layout verification of null render in a live browser; DevTools DOM inspection required to confirm true absence vs. invisible zero-height containers.

**2. EXPL-04 A-Z nav scroll offset — Brands page heading not hidden under sticky nav**

**Test:** Visit `/explore/brands`. Tap any active letter in the sticky A-Z nav. Confirm the target section scrolls into view with the letter heading fully visible below the nav bar (not hidden beneath it).
**Expected:** `scroll-mt-12` (48px) offset keeps the section heading clear of the `sticky top-0` A-Z nav. Tapping a letter-with-no-brands (opacity-30) does nothing.
**Why human:** Scroll offset behavior requires a real browser scroll event to verify; jsdom tests cannot validate the `scroll-mt-12` CSS chain assertion.

**3. All 10 archetype chips resolve to at least one result (SC #4 live-data assertion)**

**Test:** For each chip on `/explore` (Collector Archetypes module), note the displayed count badge. Then tap each chip and confirm the `/search` Watches results load (count > 0 for each of the 10 archetypes).
**Expected:** Every chip shows count > 0. Every deep-link to `/search?tab=watches&archetype={value}` returns at least one watch.
**Why human:** Live DB state verification; Phase 44 verified archetype coverage in catalog but count > 0 per archetype is a runtime data assertion that requires a running database.

**4. End-to-end user flow: chip tap → prefiltered /search with editorial header**

**Test:** From `/explore`, tap a Collector Archetypes chip (e.g. "Dive Watch Devotee"). Confirm: (a) lands on `/search?tab=watches&archetype=dive`, (b) watches tab shows dive-archetype results without a typed query, (c) editorial header shows "Dive Watch Devotee" + description + "N watches", (d) a removable chip shows "Dive Watch Devotee" with an X, (e) tapping X removes the filter. Repeat for a Browse tile: tap "Brands" → tap a brand → confirm prefiltered /search with a brand chip.
**Expected:** Full Browse → /search deep-link flow works end-to-end; facet chips are dismissible; typed search still works after dismissing a chip.
**Why human:** Cross-route user flow requires a running dev server; automated tests cover individual functions but not the full browser flow.

### Gaps Summary

No blocking gaps. All 4 observable truths are verified at the code level. The 4 human verification items are standard UAT confirmations (visual layout, scroll behavior, live data counts, end-to-end interaction flow) — they do not indicate missing or broken code.

**Documentation discrepancy (WARNING, not BLOCKER):** REQUIREMENTS.md traceability shows EXPL-02 and EXPL-04 as `Pending` / unchecked `[ ]` despite both being fully implemented. The checkboxes should be updated to `[x]` and traceability to `Complete` after human UAT confirms.

---

_Verified: 2026-05-18T21:25:00Z_
_Verifier: Claude (gsd-verifier)_
