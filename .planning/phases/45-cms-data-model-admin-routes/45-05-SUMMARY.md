---
phase: 45-cms-data-model-admin-routes
plan: 05
subsystem: ui
tags: [next.js, react, tailwind, supabase, server-actions, cms, admin]

requires:
  - phase: 45-cms-data-model-admin-routes/45-02
    provides: assertOwner() auth helper, uploadCmsCover storage helper
  - phase: 45-cms-data-model-admin-routes/45-03
    provides: curatedLists + settings Server Actions, searchCatalogForPicker action
  - phase: 45-cms-data-model-admin-routes/45-04
    provides: collectionPaths Server Actions, DAL functions
provides:
  - Owner-gated /admin layout (server component assertOwner + redirect guard)
  - AdminSubNav component (ghost Button links with active underline state)
  - WatchPicker component (200ms debounced search-as-you-type catalog picker)
  - MarkdownEditor component (Edit/Preview tabs with react-markdown, no prose class)
  - CmsCoverUploader component (16:9 aspect-video, EXIF-strip, 4 MB guard, object-cover)
  - /admin/lists page + ListIndexClient (New List CTA, D-12 reorder, delete with confirm dialog)
  - /admin/lists/[id] page + ListEditorClient (metadata, cover, markdown, items, publish, hero-pin)
  - /admin/paths page + PathIndexClient (New Path dialog with seed+type selection, reorder, delete)
  - /admin/paths/[id] page + PathEditorClient (seed display, 3 follow-on slots, D-16 chip row, publish)
affects: [45-explore, phase-46, phase-47, cms-public-surface]

tech-stack:
  added: [react-markdown@^10.1.0 (already installed before this plan)]
  patterns:
    - server-component layout guard with assertOwner + redirect
    - action-then-redirect pattern for draft creation (createCuratedList → router.push)
    - client-side optimistic state + server refresh via router.refresh()
    - WatchPicker: debounced SA call, disabled already-added rows with check icon
    - MarkdownEditor: tab-switch-only preview update (no keystroke live-update)
    - CmsCoverUploader: aspect-video container + object-cover child (CSS chain assertion)

key-files:
  created:
    - src/app/admin/layout.tsx
    - src/components/admin/AdminSubNav.tsx
    - src/components/admin/WatchPicker.tsx
    - src/components/admin/MarkdownEditor.tsx
    - src/components/admin/CmsCoverUploader.tsx
    - src/app/admin/lists/page.tsx
    - src/components/admin/ListIndexClient.tsx
    - src/app/admin/lists/[id]/page.tsx
    - src/components/admin/ListEditorClient.tsx
    - src/app/admin/paths/page.tsx
    - src/components/admin/PathIndexClient.tsx
    - src/app/admin/paths/[id]/page.tsx
    - src/components/admin/PathEditorClient.tsx
  modified: []

key-decisions:
  - "createCuratedList requires both title+curatorName (min(1) in schema); ListIndexClient passes { title: 'Untitled List', curatorName: 'Curator' } as defaults"
  - "createCollectionPath requires seedCatalogId+pathType (DB NOT NULL, schema enum); PathIndexClient collects both via a 'New Path' dialog before calling the action"
  - "TooltipTrigger (@base-ui/react) has no asChild prop; used span wrapper to allow hovering a disabled Publish button"
  - "MarkdownEditor preview updates only on tab switch (not on keystroke) per UI-SPEC §Interaction Contracts"

patterns-established:
  - "Admin layout guard: server-component try/catch with redirect() outside nested try (NEXT_REDIRECT propagation)"
  - "New draft creation: action-then-redirect (no /new route), startTransition wrapping the SA call"
  - "CSS chain assertion: aspect-video on container + object-cover w-full h-full on img (D-15)"
  - "D-06 FK-RESTRICT toast: check error string for restrict/foreign key/referenced before surfacing custom toast copy"

requirements-completed: [CMS-02, CMS-03, CMS-04, CMS-05, CMS-06, CMS-07, CMS-08]

duration: 65min
completed: 2026-05-18
---

# Phase 45 Plan 05: Admin Authoring Surface Summary

**Owner-only /admin CMS UI with layout guard, search-as-you-type watch picker, markdown editor, cover uploader, and full curated list + collection path authoring pages wired to Plan 03/04 Server Actions**

## Performance

- **Duration:** ~65 min
- **Started:** 2026-05-18
- **Completed:** 2026-05-18
- **Tasks:** 3
- **Files modified:** 13 created

## Accomplishments
- /admin layout server component with assertOwner() + redirect('/') UX guard (D-05/D-06)
- Full curated list authoring: metadata, 16:9 cover image with EXIF-strip (D-14/D-15), markdown editor (D-13), watch picker (D-11), per-item commentary, D-12 reorder, publish/unpublish, CMS-08 hero-pin dialog
- Full collection path authoring: seed watch display, up to 3 follow-on slots with per-node rationale, D-16 four-chip path-type selector, editorial rationale, publish/unpublish guard (requires seed+type)

## Task Commits

1. **Task 1: Admin layout guard + shared editor primitives** - `1394cc1` (feat)
2. **Task 2: Curated lists index + editor pages** - `d36ef0c` (feat)
3. **Task 3: Collection paths index + editor pages** - `fe437fc` (feat)

## Files Created/Modified
- `src/app/admin/layout.tsx` - Server component layout guard (assertOwner + redirect('/'))
- `src/components/admin/AdminSubNav.tsx` - Ghost Button nav links with active underline state
- `src/components/admin/WatchPicker.tsx` - 200ms debounced search-as-you-type catalog picker
- `src/components/admin/MarkdownEditor.tsx` - Edit/Preview tabs, react-markdown, no prose class
- `src/components/admin/CmsCoverUploader.tsx` - 16:9 cover upload, EXIF-strip, 4 MB guard (D-14/D-15)
- `src/app/admin/lists/page.tsx` - Server component: getAllListsForOwner + ListIndexClient
- `src/components/admin/ListIndexClient.tsx` - New List CTA, reorder, delete confirm dialog
- `src/app/admin/lists/[id]/page.tsx` - Server component: getListWithItems + getCmsSettings + notFound()
- `src/components/admin/ListEditorClient.tsx` - Full list editor with cover, markdown, items, hero-pin
- `src/app/admin/paths/page.tsx` - Server component: getAllPathsForOwner + PathIndexClient
- `src/components/admin/PathIndexClient.tsx` - New Path dialog (seed+type), reorder, delete
- `src/app/admin/paths/[id]/page.tsx` - Server component: getPathWithNodes + notFound()
- `src/components/admin/PathEditorClient.tsx` - Seed display, follow-on slots, path-type chips, publish

## Decisions Made
- `createCuratedList` schema requires `curatorName` (min 1) — passed default `'Curator'` from ListIndexClient since the action schema from Plan 03 couldn't be changed here
- `createCollectionPath` schema requires both `seedCatalogId` and `pathType` (DB NOT NULL + enum constraint) — plan described omitting these, which would fail schema validation; implemented "New Path" dialog in PathIndexClient to collect both before calling the action
- `TooltipTrigger` (@base-ui/react) has no `asChild` prop — used a `<span>` wrapper to allow hovering a disabled Publish button for tooltip display

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] createCollectionPath requires seedCatalogId+pathType (action schema conflict)**
- **Found during:** Task 3 (PathIndexClient implementation)
- **Issue:** Plan described `createCollectionPath` with no required fields ("omit seedCatalogId; created as a draft"). The actual action schema from Plan 04 requires both `seedCatalogId` (UUID, validated) and `pathType` (enum). DB also has NOT NULL on seedCatalogId. Calling with `{}` would fail schema validation.
- **Fix:** PathIndexClient "New Path" button now opens a dialog to collect seed watch (WatchPicker) and path type (chip row) first, then calls `createCollectionPath` with all required fields.
- **Files modified:** `src/components/admin/PathIndexClient.tsx`
- **Committed in:** fe437fc (Task 3 commit)

**2. [Rule 1 - Bug] Lint error: setState called synchronously in useEffect (WatchPicker)**
- **Found during:** Task 1 verification (lint check)
- **Issue:** WatchPicker's useEffect had early return with `setResults([])` + `setOpen(false)` — called synchronously (before setTimeout) inside useEffect, triggering "Calling setState synchronously within an effect" lint error.
- **Fix:** Moved all state updates into the setTimeout callback. Short queries (< 2 chars) now clear state after the debounce window, not immediately.
- **Files modified:** `src/components/admin/WatchPicker.tsx`
- **Committed in:** 1394cc1 (Task 1 commit)

**3. [Rule 1 - Bug] Unused Loader2 import in CmsCoverUploader**
- **Found during:** Task 1 verification (lint check)
- **Issue:** `Loader2` was imported but not used (Skeleton covers the processing state instead).
- **Fix:** Removed unused import.
- **Files modified:** `src/components/admin/CmsCoverUploader.tsx`
- **Committed in:** 1394cc1 (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (1 action schema conflict, 2 lint bugs)
**Impact on plan:** All fixes necessary for correctness. PathIndexClient deviation is functional — the "New Path" dialog approach matches the actual action contract and gives a better UX than creating a completely empty path that would fail publish anyway.

## Issues Encountered
- Pre-existing TypeScript errors in test files (SearchPageClient, WatchForm, etc.) — not related to this plan's changes. The admin-specific files have zero TypeScript errors.
- Pre-existing test suite failures (14 test files, ~53 tests) — all pre-existing from prior phases, none caused by admin files.

## Known Stubs
- List item thumbnails in ListEditorClient render a numeric placeholder div instead of the actual catalog watch image (the list-item row has only catalogId, not the imageUrl from watches_catalog). This is intentional — fetching all catalog images for every item would require a join not included in the current DAL. A future phase can wire catalog image lookup per item.
- Path node thumbnails in PathEditorClient similarly show a slot-number placeholder.
- Both stubs render inside the correct `size-10 rounded-sm overflow-hidden bg-muted` containers (CSS chain assertion preserved). The visual placeholder is acceptable for the admin authoring surface.

## Threat Flags
No new threat surface beyond what the plan's threat model covers. The `/admin` layout guard (T-45-18), partial-rendering bypass (T-45-19), markdown XSS (T-45-20 accepted), and cover upload RLS (T-45-21) are all handled as specified.

## Next Phase Readiness
- /admin/lists and /admin/paths are fully functional for owner authoring
- All curated list + collection path Server Actions from Plans 03/04 are wired
- Phase 46 (public /explore module) can read published lists/paths from the DAL (getPublishedLists, getPublishedPaths)
- Hero-pin control functional — setPinnedHero/clearPinnedHero wired through CMS-08 dialog

## Self-Check

Checking created files exist and commits are present:

---
*Phase: 45-cms-data-model-admin-routes*
*Completed: 2026-05-18*
