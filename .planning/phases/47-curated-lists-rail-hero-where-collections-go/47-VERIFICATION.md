---
phase: 47-curated-lists-rail-hero-where-collections-go
verified: 2026-05-19T09:00:00Z
status: passed
score: 13/15 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Hero renders full-bleed at correct 16:9 aspect ratio"
    expected: "Visiting /explore on a desktop viewport shows the Hero as a full-bleed image filling its slot — no black bar, no letterboxed frame, no collapsed height — with the gradient overlay and curator name/title legible"
    why_human: "The full-bleed CSS chain (aspect-video / overflow-hidden / absolute inset-0 w-full h-full object-cover) can be asserted statically, but actual rendering requires a live browser to confirm no CSS chain failure produces a black bar or collapsed container"
  - test: "Where Collections Go renders correctly at 360px mobile width"
    expected: "At 360px viewport width each path shows as a numbered vertical stack (1 → 2 → 3 ...) with numbered badges and visible connector lines between nodes, readable rationale text, and nothing clipped or overlapping"
    why_human: "Responsive layout at 360px requires a live browser or device emulator; static code analysis confirms the md:hidden / hidden md:flex pattern and min-h-[24px] connector are present, but the actual visual result at that breakpoint cannot be confirmed programmatically"
  - test: "Pinning or unpublishing a list updates the Hero immediately on reload"
    expected: "In /admin/lists, pinning a different eligible list (or unpublishing the currently-featured list) and immediately reloading /explore shows the updated Hero — no stale content and no TTL wait required"
    why_human: "Immediate cache propagation via revalidateTag('explore:hero', 'max') is verified statically (confirmed in settings.ts lines 46 and 66), but actual end-to-end cache invalidation under the live Next.js 16 'use cache' + revalidateTag('explore:hero','max') mechanism requires a running dev server to confirm"
---

# Phase 47: Curated Lists Rail + Hero + Where Collections Go — Verification Report

**Phase Goal:** The editorial half of `/explore` is live — users can discover curated lists, see the hero feature, and explore collection paths authored by the curator.
**Verified:** 2026-05-19T09:00:00Z
**Status:** passed (human-verified 2026-05-19)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Curated Lists Rail shows up to 12 published lists (cover, title, curator, watch count, freshness indicator) with a "View all" link to /explore/lists | ✓ VERIFIED | `CuratedListsRail.tsx` calls `getPublishedLists(12)`, uses `getListItemCount`, renders `RailListCard` per list with a "View all" `<Link href="/explore/lists">` header; 5 live tests pass |
| 2 | A curated list detail page renders intro copy + per-item editorial commentary | ✓ VERIFIED | `/explore/lists/[id]/page.tsx` renders `<ReactMarkdown rehypePlugins={[rehypeSanitize]}>` for `introMarkdown` inside `prose` wrapper; editorial rows use `flex flex-col md:flex-row` with watch image and commentary; watch links to `/catalog/${item.catalogId}` |
| 3 | Hero shows a single full-bleed image with title + curator from a quality-gated published list; auto-selects unless a manual pin overrides; hides entirely when no eligible content | ✓ VERIFIED | `HeroModule.tsx`: quality gate (`itemCount >= 3 && !!coverUrl && !!introMarkdown`), pin override (`settings.pinnedListId` + `pinExpiresAt` check), `getWeekIndex` rotation fallback, `return null` when eligible pool empty; full-bleed CSS chain: `aspect-video overflow-hidden` / `absolute inset-0 w-full h-full object-cover`; 4 live tests pass |
| 4 | Pinning/unpublishing a list updates the Hero immediately via `revalidateTag('explore:hero', 'max')` | ✓ VERIFIED | `settings.ts` fires `revalidateTag('explore:hero', 'max')` in both `setPinnedHero` (line 46) and `clearPinnedHero` (line 66); `curatedLists.ts` actions fire it in `publishCuratedList` (line 370) and `unpublishCuratedList` (line 398); runtime propagation requires human verification |
| 5 | Rail and Paths modules are invalidated when content is published/unpublished (CR-01 fix) | ✓ VERIFIED | `CuratedListsRail.tsx` tags only `cacheTag('explore:lists')` (umbrella removed); all `curatedLists` CMS actions fire `revalidateTag('explore:lists', 'max')`; `WhereCollectionsGo.tsx` tags only `cacheTag('explore:paths')`; all `collectionPaths` CMS actions fire `revalidateTag('explore:paths', 'max')` |
| 6 | Where Collections Go shows rotating published collection paths (seed + follow-ons, rationale, path-type label); tapping a watch opens its detail page; "Explore all paths" links to /explore/paths | ✓ VERIFIED | `WhereCollectionsGo.tsx` calls `getPublishedPaths`, weekly rotation via `weekIndex % allPaths.length` with wrap-around + dedup; `PathCard.tsx` renders `<Badge>` chip, mobile `md:hidden` numbered stack, desktop `hidden md:flex` horizontal with `ChevronRight`; each node `<Link href={/catalog/${node.catalogId}}>` |
| 7 | Where Collections Go renders at 360px mobile width — numbered indicator + vertical stacking | ? UNCERTAIN | Code confirms `flex flex-col gap-3 md:hidden` layout with `size-6 rounded-full bg-accent` badges and `w-px flex-1 bg-border min-h-[24px]` connector line; actual 360px visual requires human verification |
| 8 | /explore/lists shows every published list in a sortable grid | ✓ VERIFIED | `/explore/lists/page.tsx` calls `getPublishedLists(100)`, passes to `<ListSortFilterControls>`; `ListSortFilterControls.tsx` has `'use client'`, `useState`, `useMemo` sort by newest/most-watches, grid `grid-cols-2 md:grid-cols-3 lg:grid-cols-4` |
| 9 | /explore/paths shows published paths grouped by path-type label | ✓ VERIFIED | `/explore/paths/page.tsx` imports `PATH_TYPES` from `@/lib/pathTypes`, groups by type into a `Map`, iterates in declared order filtering out empty buckets; `PathCard` reused per section |
| 10 | Hero hides entirely when no eligible content exists | ✓ VERIFIED | `HeroModule.tsx` line 64: `if (eligible.length === 0) return null` — returns null before rendering, no empty container |
| 11 | Hero full-bleed CSS chain visually renders correctly | ? UNCERTAIN | CSS chain present in code: `relative w-full aspect-video overflow-hidden rounded-xl bg-muted min-h-[200px]` container, `absolute inset-0 w-full h-full object-cover` image; actual render requires live browser (human verification item 1) |
| 12 | `published_at` schema column exists and setListStatus stamps it on first publish only | ✓ VERIFIED | `schema.ts` line 580: `publishedAt: timestamp('published_at', { withTimezone: true })` — no `.notNull()`; `curatedLists.ts` `setListStatus` uses `COALESCE(${curatedLists.publishedAt}, NOW())` only when `status === 'published'`; migration `20260519000000_phase47_published_at.sql` has both ADD COLUMN and backfill UPDATE |
| 13 | `getListItems`, `getPathNodes`, and seed query return `imageUrl` | ✓ VERIFIED | `curatedLists.ts` line 174: `imageUrl: watchesCatalog.imageUrl`; `collectionPaths.ts` lines 65 and 96: `imageUrl: watchesCatalog.imageUrl` in both `getPathNodes` and seed-watch query |
| 14 | EXPL-06, EXPL-07, EXPL-08, EXPL-09 marked Complete in REQUIREMENTS.md | ✓ VERIFIED | `REQUIREMENTS.md` checkboxes `- [x]` for all four; traceability table shows `Complete` for all four at Phase 47 |
| 15 | All Phase 47 tests pass (weekIndex, curatedLists, CuratedListsRail, HeroModule, WhereCollectionsGo) | ✓ VERIFIED | `npm test -- --run` on 5 Phase 47 test files: 28 tests pass, 0 failures |

**Score:** 13/15 truths verified (2 uncertain — require human confirmation)

### Required Artifacts

| Artifact | Expected | Status | Details |
|---------|----------|--------|---------|
| `supabase/migrations/20260519000000_phase47_published_at.sql` | published_at column add + backfill | ✓ VERIFIED | Contains `ADD COLUMN IF NOT EXISTS published_at timestamptz` and backfill UPDATE |
| `src/lib/weekIndex.ts` | Shared deterministic week-index utility | ✓ VERIFIED | Exports `getWeekIndex(now: Date): number` using `Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000))` |
| `src/lib/pathTypes.ts` | Shared PATH_TYPES vocab constant | ✓ VERIFIED | Exports `PATH_TYPES` 4-element `as const` tuple and `PathType` type |
| `src/db/schema.ts` | `publishedAt` column on curatedLists | ✓ VERIFIED | Line 580: nullable `publishedAt: timestamp('published_at', { withTimezone: true })` |
| `src/components/explore/CuratedListsRail.tsx` | Horizontally-scrollable rail (≥25 lines) | ✓ VERIFIED | 63 lines; `'use cache'`, `cacheTag('explore:lists')`, `cacheLife('hours')`, `getPublishedLists(12)`, null guard, rail rendering |
| `src/components/explore/RailListCard.tsx` | Rail card with cover, freshness, metadata | ✓ VERIFIED | Conditional `coverUrl` img render, "New" badge via `isNew()`, `getRelativeTimestamp()`, correct CSS chain |
| `src/app/explore/lists/page.tsx` | /explore/lists see-all route | ✓ VERIFIED | `await getCurrentUser()` first, `getPublishedLists(100)`, `<ListSortFilterControls>` |
| `src/app/explore/lists/[id]/page.tsx` | /explore/lists/[id] markdown detail route | ✓ VERIFIED | `await getCurrentUser()` first, `getListWithItems`, `notFound()`, `rehypeSanitize`, `prose` wrapper, `max-w-3xl` |
| `src/components/explore/ListSortFilterControls.tsx` | Client sort controls for see-all grid | ✓ VERIFIED | `'use client'`, `useState`, `useMemo`, two sort options, correct grid classes |
| `src/components/explore/HeroModule.tsx` | Quality-gated hero (≥40 lines) | ✓ VERIFIED | 122 lines; `'use cache'`, `cacheTag('explore:hero')`, quality gate, pin override, weekly rotation, full-bleed CSS chain |
| `src/components/explore/WhereCollectionsGo.tsx` | Rotating 3-path paths module | ✓ VERIFIED | `'use cache'`, `cacheTag('explore:paths')`, rotation with wrap-around + dedup, `PathCard` rendering |
| `src/components/explore/PathCard.tsx` | Single path renderer — dual layout | ✓ VERIFIED | `md:hidden` mobile stack with numbered badges + connector lines, `hidden md:flex` desktop horizontal with `ChevronRight` |
| `src/app/explore/paths/page.tsx` | /explore/paths see-all route grouped by path-type | ✓ VERIFIED | `await getCurrentUser()` first, `PATH_TYPES` from `@/lib/pathTypes`, grouped sections, empty sections omitted |
| `src/lib/heroTypes.ts` | HeroFeature discriminated union | ✓ VERIFIED | Exports both `{ format: 'featured_list'; list: CuratedListHero }` and `{ format: 'featured_collector' }` variants |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `CuratedListsRail.tsx` | `getPublishedLists` | DAL call inside 'use cache' scope | ✓ WIRED | Line 32: `const lists = await getPublishedLists(12)` |
| `CuratedListsRail.tsx` | `explore:lists` cache tag | `cacheTag('explore:lists')` | ✓ WIRED | Line 29: `cacheTag('explore:lists')` (umbrella tag removed per CR-01) |
| `CMS curatedLists actions` | `explore:lists` invalidation | `revalidateTag('explore:lists', 'max')` | ✓ WIRED | All list mutations (publish, unpublish, update, delete, item add/remove/commentary, reorder) fire `revalidateTag('explore:lists', 'max')` |
| `/explore/lists/[id]/page.tsx` | `react-markdown + rehypeSanitize` | `ReactMarkdown` with `rehypePlugins` | ✓ WIRED | Line 79: `<ReactMarkdown rehypePlugins={[rehypeSanitize]}>` inside `prose` div |
| `/explore/lists/[id]/page.tsx` | `/catalog/[catalogId]` | `Link href` per editorial row | ✓ WIRED | Line 91: `<Link href={/catalog/${item.catalogId}}>` |
| `HeroModule.tsx` | `explore:hero` cache tag | `cacheTag('explore:hero')` | ✓ WIRED | Line 43: `cacheTag('explore:hero')` only (not cacheTag('explore', 'explore:hero')) |
| `HeroModule.tsx` | `getCmsSettings + getPublishedLists` | pin read + quality-gated pool | ✓ WIRED | Lines 47-50: `Promise.all([getCmsSettings(), getPublishedLists(50)])` |
| `HeroModule.tsx` | `getWeekIndex` | weekly rotation slice (WR-02 fix) | ✓ WIRED | `weekIndex` passed as prop from `explore/page.tsx`; `sorted[weekIndex % sorted.length]` at line 82 |
| `WhereCollectionsGo.tsx` | `getWeekIndex` | weekly rotation slice (WR-02 fix) | ✓ WIRED | `weekIndex` passed as prop from `explore/page.tsx`; `startIdx = weekIndex % allPaths.length` at line 43 |
| `WhereCollectionsGo.tsx` | `explore:paths` cache tag | `cacheTag('explore:paths')` | ✓ WIRED | Line 34: `cacheTag('explore:paths')` (umbrella tag removed per CR-01) |
| `CMS collectionPaths actions` | `explore:paths` invalidation | `revalidateTag('explore:paths', 'max')` | ✓ WIRED | All path mutations (publish, unpublish, update, delete, setNode, removeNode, reorder) fire `revalidateTag('explore:paths', 'max')` |
| `src/data/curatedLists.ts setListStatus` | `curated_lists.published_at` | `COALESCE(published_at, NOW()) on publish` | ✓ WIRED | Line 113: `updateFields.publishedAt = sql\`COALESCE(${curatedLists.publishedAt}, NOW())\`` inside `status === 'published'` branch only |
| `src/data/curatedLists.ts getListItems` | `watches_catalog.imageUrl` | `select imageUrl from innerJoin` | ✓ WIRED | Line 174: `imageUrl: watchesCatalog.imageUrl` in select object |
| `explore/page.tsx` | `HeroModule + CuratedListsRail + WhereCollectionsGo` | all three modules rendered | ✓ WIRED | All five modules imported and rendered; `HeroModule` wrapped in `<div className="md:col-span-2">`; `weekIndex` passed to HeroModule and WhereCollectionsGo |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---------|--------------|--------|-------------------|--------|
| `CuratedListsRail.tsx` | `lists` / `listsWithCounts` | `getPublishedLists(12)` + `getListItemCount` per list | Yes — DB queries with `WHERE status='published'` | ✓ FLOWING |
| `HeroModule.tsx` | `eligible`, `featured` | `getPublishedLists(50)` + quality gate + pin/rotation logic | Yes — `getCmsSettings()` + `getPublishedLists(50)` + `getListItemCount` per list | ✓ FLOWING |
| `WhereCollectionsGo.tsx` | `validPaths` | `getPublishedPaths()` + `getPathWithNodes` per selected path | Yes — DB queries with `WHERE status='published'` | ✓ FLOWING |
| `/explore/lists/[id]/page.tsx` | `list`, `watchCount` | `getListWithItems(id)` (status-gated) | Yes — `getListById` + JS status gate + `getListItems` with imageUrl join | ✓ FLOWING |
| `/explore/paths/page.tsx` | `validPaths`, `pathsByType` | `getPublishedPaths(100)` + `getPathWithNodes` per path | Yes — DB queries with `WHERE status='published'` | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---------|---------|--------|--------|
| weekIndex returns integer advancing every 7 days | `npm test -- --run src/lib/__tests__/weekIndex.test.ts` | 4 tests pass | ✓ PASS |
| setListStatus stamps publishedAt on publish only | `npm test -- --run src/data/__tests__/curatedLists.test.ts` | 10 tests pass (includes 2 Phase 47) | ✓ PASS |
| CuratedListsRail null-on-empty + renders cards | `npm test -- --run src/components/explore/__tests__/CuratedListsRail.test.tsx` | 5 tests pass | ✓ PASS |
| HeroModule quality gate + pin override + rotation | `npm test -- --run src/components/explore/__tests__/HeroModule.test.tsx` | 4 tests pass | ✓ PASS |
| WhereCollectionsGo rotation + null-on-empty + path-type chip | `npm test -- --run src/components/explore/__tests__/WhereCollectionsGo.test.tsx` | 5 tests pass | ✓ PASS |
| Full Phase 47 test suite | All 5 files combined | 28 tests pass, 0 failures | ✓ PASS |

### Probe Execution

No conventional `scripts/*/tests/probe-*.sh` probes declared or discovered for this phase. Step 7c: SKIPPED (no probe scripts).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|------------|------------|-------------|--------|---------|
| EXPL-06 | 47-02-PLAN | Curated Lists Rail with freshness, "View all" to /explore/lists | ✓ SATISFIED | `CuratedListsRail.tsx` + `RailListCard.tsx` implemented and tested; REQUIREMENTS.md `- [x]` |
| EXPL-07 | 47-02-PLAN | List detail page with intro copy + per-item editorial commentary | ✓ SATISFIED | `/explore/lists/[id]/page.tsx` with `ReactMarkdown`+`rehypeSanitize`; REQUIREMENTS.md `- [x]` |
| EXPL-08 | 47-03-PLAN | Quality-gated hero with pin override + weekly rotation; hides when no eligible content | ✓ SATISFIED | `HeroModule.tsx` with quality gate, pin override, `getWeekIndex` rotation; REQUIREMENTS.md `- [x]` |
| EXPL-09 | 47-03-PLAN | Where Collections Go with rotating paths, rationale, path-type; "Explore all paths" to /explore/paths | ✓ SATISFIED | `WhereCollectionsGo.tsx` + `PathCard.tsx` + `/explore/paths/page.tsx`; REQUIREMENTS.md `- [x]` |

**Requirement traceability:** All four EXPL-06..09 rows show `Complete` in the traceability table. No orphaned requirements detected for Phase 47.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|---------|--------|
| `src/data/curatedLists.ts` | 117 | `eslint-disable-next-line @typescript-eslint/no-explicit-any` to cast `updateFields as any` in `setListStatus` | Info | Type safety for the `.set()` call is narrowed to `any`; a typo in another field name would not be caught; flagged as IN-01 in 47-REVIEW.md — no fix required for v1 |

No `TBD`, `FIXME`, or `XXX` debt markers found in any Phase 47 source files. The `any` cast has a co-located eslint-disable comment and is documented in 47-REVIEW.md IN-01 as accepted for v1.

### Human Verification Required

#### 1. Hero Full-Bleed CSS Chain

**Test:** Start the dev server (`npm run dev`), visit `/explore` on a desktop viewport (1280px+). If CSS looks wrong, run `rm -rf .next` and restart (memory: `project_turbopack_next_cache_stale_css`).

**Expected:** The Hero is a full-bleed 16:9 image filling its slot at the top of the page — no black bar, no letterboxed whitespace, no collapsed height — with the curator name and list title legible over the gradient overlay. The image fills `aspect-video` proportions.

**Why human:** The full-bleed CSS chain (`relative w-full aspect-video overflow-hidden rounded-xl bg-muted min-h-[200px]` container, `absolute inset-0 w-full h-full object-cover` image) is verified present in code, but the `feedback_ui_spec_css_chain_blind_spot` memory explicitly warns that a 6-pillar checker can pass while the actual CSS chain silently fails. Phase 30 shipped a black-bar through automated checks. The only reliable confirmation is visual.

#### 2. Where Collections Go at 360px Mobile Width

**Test:** On the same dev server session, resize the browser to 360px width (or use Chrome DevTools device emulation at 360px). Navigate to `/explore` and scroll to Where Collections Go.

**Expected:** Each path renders as a numbered vertical stack (number badge 1 → connector line → number badge 2 → connector line → number badge 3 ...) with readable brand/model text and rationale beneath each badge. Nothing is clipped, horizontally overflowing, or visually overlapping.

**Why human:** The mobile layout (`flex flex-col gap-3 md:hidden`) with `size-6` badges and `w-px flex-1 bg-border min-h-[24px]` connectors is statically verified in code, but actual 360px rendering (connector proportions, text reflow, no overflow) requires a live browser. This is explicitly roadmap success criterion #5.

#### 3. Hero Cache Invalidation Propagates Immediately

**Test:** On the dev server, navigate to `/admin/lists`. Pin a different eligible list as the hero (or unpublish the currently-featured list). Immediately reload `/explore`.

**Expected:** The Hero updates immediately to reflect the change — no need to wait for a cache TTL. This verifies the `explore:hero` revalidateTag wiring (roadmap success criterion #3).

**Why human:** `revalidateTag('explore:hero', 'max')` is statically confirmed in both `settings.ts` (setPinnedHero line 46, clearPinnedHero line 66) and `curatedLists.ts` actions (publishCuratedList, unpublishCuratedList). However, the end-to-end behaviour of `revalidateTag` + Next.js 16 `'use cache'` in the live dev server is a runtime property that cannot be asserted statically.

### Pre-Existing Test Debt (Not Phase 47 Regressions)

As documented in the context notes: the full test suite has ~54 failing tests across 16 files for OTHER phases (Phase 14/18/20.1/22/23/39, WYWT, tasteOverlap, no-raw-palette). These were present at Phase 47's base commit and are NOT Phase 47 regressions. All 28 Phase 47 tests pass in their named-file run.

---

_Verified: 2026-05-19T09:00:00Z_
_Verifier: Claude (gsd-verifier)_
