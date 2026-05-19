---
phase: 47-curated-lists-rail-hero-where-collections-go
plan: "02"
subsystem: explore-curated-lists
tags: [curated-lists, rail, editorial, react-markdown, use-cache, routes, wave-2]
dependency_graph:
  requires: [47-01, phase-45-cms-tables]
  provides: [CuratedListsRail, RailListCard, ListSortFilterControls, explore-lists-route, explore-lists-id-route]
  affects:
    - src/components/explore/CuratedListsRail.tsx
    - src/components/explore/RailListCard.tsx
    - src/components/explore/ListSortFilterControls.tsx
    - src/app/explore/lists/page.tsx
    - src/app/explore/lists/[id]/page.tsx
    - src/data/curatedLists.ts
    - src/components/explore/__tests__/CuratedListsRail.test.tsx
tech_stack:
  added: []
  patterns:
    - use-cache-viewer-independent-module
    - rail-card-cover-image-css-chain
    - intl-relative-time-format
    - react-markdown-rehype-sanitize-prose
    - client-use-state-sort-no-url-params
key_files:
  created:
    - src/components/explore/RailListCard.tsx
    - src/components/explore/ListSortFilterControls.tsx
    - src/app/explore/lists/page.tsx
    - src/app/explore/lists/[id]/page.tsx
  modified:
    - src/components/explore/CuratedListsRail.tsx
    - src/data/curatedLists.ts
    - src/components/explore/__tests__/CuratedListsRail.test.tsx
decisions:
  - "getListWithItems filters status=published (T-47-07 fix); draft id resolves to null → notFound()"
  - "RailListCard uses Intl.RelativeTimeFormat('en', {numeric: auto}) for relative timestamps"
  - "7-day window for New badge (Claude's Discretion, confirmed UI-SPEC)"
  - "ListSortFilterControls uses local useState/useMemo — no URL params (D-04 discretion, RESEARCH Pitfall 7)"
  - "Separate getListItemCount calls (N+1 at ≤12 lists is acceptable per RESEARCH Pitfall 5)"
metrics:
  duration: "~8 minutes"
  completed_date: "2026-05-19"
  tasks_completed: 3
  files_changed: 7
---

# Phase 47 Plan 02: CuratedListsRail + Lists Routes Summary

Wired the CuratedListsRail from its return-null stub to a fully-cached 'use cache' Server Component, created the RailListCard sub-component with verified cover-image CSS chain, shipped /explore/lists (sortable grid) and /explore/lists/[id] (markdown editorial detail), and applied a security fix for T-47-07 IDOR on the detail route.

## What Was Built

### Task 1: CuratedListsRail + RailListCard (TDD, EXPL-06)

**`src/components/explore/CuratedListsRail.tsx`** — Replaced the return-null stub. Async Server Component with `'use cache'` as the first function-body statement, `cacheTag('explore', 'explore:lists')`, and `cacheLife('hours')`. Calls `getPublishedLists(12)`; returns null when empty (EXPL-02). Fetches `getListItemCount` per list concurrently. Renders a `<section className="space-y-4">` with a flex header (h2 "Curated Lists" + "View all" link to /explore/lists) and a `flex gap-4 overflow-x-auto pb-2 scroll-smooth` rail of RailListCard elements. Does NOT call `getCurrentUser()` (RESEARCH Pitfall 1 — auth is in the explore page).

**`src/components/explore/RailListCard.tsx`** — Pure presentational Server sub-component. Cover image CSS chain: `aspect-square rounded-md bg-muted overflow-hidden relative` / `w-full h-full object-cover` (verified pattern from DiscoveryWatchCard). "New" badge with `bg-accent text-accent-foreground` conditionally on 7-day publishedAt window. Relative timestamp via `Intl.RelativeTimeFormat('en', { numeric: 'auto' })` — "Today", "3 days ago", "last week", "2 months ago". Null publishedAt → no badge, no timestamp.

**`src/components/explore/__tests__/CuratedListsRail.test.tsx`** — Converted 4 `it.todo` scaffolds plus added one more badge test to 5 live `it()` tests. All 5 pass:
1. Returns null when no published lists (EXPL-02)
2. Renders rail cards for all published lists
3. Each card shows title, curator name, watch count, relative timestamp
4. "View all" link points to /explore/lists
5. "New" badge shown within 7 days; omitted for older lists

TDD gate compliance: RED commit `2aebe17`, GREEN commit `525210f`.

### Task 2: /explore/lists see-all route + ListSortFilterControls (D-04)

**`src/app/explore/lists/page.tsx`** — Server Component. `await getCurrentUser()` is the first statement (outside cache scope, RESEARCH Pitfall 1). Fetches `getPublishedLists(100)` and item counts concurrently. Container `max-w-6xl`, back nav `← Explore` to /explore, `<h1>` "Curated Lists" at `text-2xl font-semibold`. Passes lists+counts to `<ListSortFilterControls />`.

**`src/components/explore/ListSortFilterControls.tsx`** — `'use client'` component. `useState<SortKey>('newest')` and `useMemo` sort: "Newest" = publishedAt desc (nulls last), "Most watches" = itemCount desc. Plain `<select>` with Tailwind classes (`text-sm rounded-md border border-border bg-background px-3 py-1.5`). Grid: `grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4`. No `useRouter` or `searchParams` — local state only (D-04 discretion).

### Task 3: /explore/lists/[id] markdown detail route (EXPL-07)

**`src/app/explore/lists/[id]/page.tsx`** — Server Component. `await getCurrentUser()` first. `getListWithItems(id)` returns null for drafts (T-47-07 fix); `notFound()` called on null. Container `max-w-3xl` (narrower editorial measure). Header: curator name in muted uppercase, `<h1>` list title at text-2xl, `{N} watches · {timestamp}` metadata line. Intro copy: `<div className="prose prose-sm dark:prose-invert max-w-none mb-10">` wrapping `<ReactMarkdown rehypePlugins={[rehypeSanitize]}>` — both prose wrapper and rehypeSanitize are mandatory (CR-02, T-47-05). Editorial rows: `flex flex-col md:flex-row gap-4 py-6`; image side has `w-full md:w-40 aspect-square rounded-md bg-muted overflow-hidden` + `w-full h-full object-cover`; each watch image links to `/catalog/${item.catalogId}`; commentary `<p>` omitted when null; empty list shows "This list has no watches yet.".

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 RED | `2aebe17` | test(47-02): add failing CuratedListsRail tests (RED phase) |
| Task 1 GREEN + T-47-07 fix | `525210f` | feat(47-02): implement CuratedListsRail + RailListCard (EXPL-06) |
| Task 2 | `7db0bfc` | feat(47-02): /explore/lists see-all route + ListSortFilterControls (D-04) |
| Task 3 | `f82eb04` | feat(47-02): /explore/lists/[id] markdown detail route (EXPL-07) |

## Verification

- `npm test -- --run src/components/explore/__tests__/CuratedListsRail.test.tsx` — 5 tests, all passing
- `npx tsc --noEmit` — no new errors in any plan file
- T-47-07: `getListWithItems` now filters `status = 'published'`; draft id resolves to null → `notFound()`
- rehypeSanitize count in list detail page: 4 (import, usage, and security comment annotations)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Security] T-47-07 IDOR — getListWithItems did not filter by status='published'**
- **Found during:** Task 3 implementation (verification step mandated by threat model)
- **Issue:** `getListWithItems` called `getListById` which has no status filter. A user with a draft list's UUID could access it via `/explore/lists/[id]` before this fix.
- **Fix:** Modified `getListWithItems` in `src/data/curatedLists.ts` to fetch with a status check: returns null when `list.status !== 'published'`, which causes the detail page to call `notFound()`.
- **Files modified:** `src/data/curatedLists.ts`
- **Commit:** `525210f`

## Known Stubs

None. All components receive and render real data from the DAL. No hardcoded empty values or placeholders flow to the UI.

## Threat Flags

No new security-relevant surface beyond what the plan's `<threat_model>` describes.

| Threat | Mitigation | Status |
|--------|------------|--------|
| T-47-05 XSS via introMarkdown | rehypeSanitize in ReactMarkdown + prose wrapper | Applied |
| T-47-07 IDOR draft list via /explore/lists/[id] | getListWithItems status='published' filter → notFound() | Fixed (deviation) |
| T-47-08 Unauthenticated access | getCurrentUser() first in both page bodies | Applied |

## TDD Gate Compliance

- RED commit `2aebe17`: `test(47-02)` — 5 live failing tests
- GREEN commit `525210f`: `feat(47-02)` — 5 tests pass
- No REFACTOR needed (code was clean from GREEN)

## Self-Check: PASSED

- `src/components/explore/CuratedListsRail.tsx` — contains `'use cache'`, `cacheTag('explore', 'explore:lists')`, `cacheLife('hours')`, `getPublishedLists(12)`, `return null`: VERIFIED
- `src/components/explore/RailListCard.tsx` — contains `aspect-square`, `overflow-hidden`, `w-full h-full object-cover`, `bg-accent text-accent-foreground`, `Intl.RelativeTimeFormat`: VERIFIED
- `src/components/explore/ListSortFilterControls.tsx` — first line `'use client'`, uses `useState` and `useMemo`, two sort options, `grid-cols-2 md:grid-cols-3 lg:grid-cols-4`: VERIFIED
- `src/app/explore/lists/page.tsx` — first statement `await getCurrentUser()`, contains `getPublishedLists`, renders `<ListSortFilterControls`: VERIFIED
- `src/app/explore/lists/[id]/page.tsx` — first statement `await getCurrentUser()`, contains `getListWithItems`, `notFound()`, `rehypeSanitize`, `prose` wrapper, `max-w-3xl`, `flex flex-col md:flex-row`: VERIFIED
- `src/data/curatedLists.ts` — `getListWithItems` now filters `status !== 'published'` → return null: VERIFIED
- Commit `2aebe17` — RED test commit: FOUND
- Commit `525210f` — GREEN implementation commit: FOUND
- Commit `7db0bfc` — Task 2 commit: FOUND
- Commit `f82eb04` — Task 3 commit: FOUND
- 5 CuratedListsRail tests passing: VERIFIED
- TypeScript: no errors in plan files: VERIFIED
