---
phase: 83-polish-sweep
plan: "02"
subsystem: profile/worn-tab
tags:
  - ui
  - profile
  - worn-tab
  - polish
dependency_graph:
  requires:
    - src/app/u/[username]/[tab]/page.tsx (ownedWatches prop already threaded at line 493)
  provides:
    - Worn-tab watch dropdowns scoped to owned-only (POLISH-02)
  affects:
    - src/components/profile/WornTabContent.tsx
tech_stack:
  added: []
  patterns:
    - useMemo derivation from filtered prop rather than derived all-watches map
key_files:
  modified:
    - src/components/profile/WornTabContent.tsx
decisions:
  - "D-03: Both Worn-tab dropdowns (log-a-wear picker + events filter) show status=owned watches only"
  - "D-04: All watches default filter option preserved so historical demoted-watch events remain visible"
  - "D-05: watchMap stays populated from all watches (timeline label source); ownedWatches drives pickers"
  - "D-06: No forward-looking Phase 85 helper; literal status=owned consumed from already-filtered prop"
metrics:
  duration: "~5 min"
  completed_date: "2026-07-14"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
  commits: 1
---

# Phase 83 Plan 02: Worn Tab Owned-Only Dropdown Summary

**One-liner:** Swap `watchOptions` useMemo source from `Object.values(watchMap)` to `ownedWatches` prop with `{ id, brand, model }` projection, scoping both Worn-tab dropdowns to owned watches only.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Swap watchOptions derivation to ownedWatches | 9eb47266 | src/components/profile/WornTabContent.tsx |

## What Was Built

POLISH-02 is satisfied: both watch-selection dropdowns on the Worn tab — the events-filter `Select` and the `LogTodaysWearButton` picker — now only show `status === 'owned'` watches. Wishlist and grail watches no longer appear in either dropdown.

The change is a single-useMemo swap in `WornTabContent.tsx`:
- Old: `Object.values(watchMap)` (all watches, typed `WatchSummary[]`)
- New: `ownedWatches.map((w) => ({ id: w.id, brand: w.brand, model: w.model }))` (owned only, projected to the minimal `{ id, brand, model }` shape both consumers require)
- Dependency array updated from `[watchMap]` to `[ownedWatches]`
- Brand+model sort predicate preserved verbatim

`watchMap` is untouched — it still flows to `WornTimeline` and `WornCalendar` intact, so wear-event rows for historically demoted watches still render brand/model correctly (D-05). The `All watches` default `SelectItem` is untouched (D-04).

No changes to `LogTodaysWearButton.tsx` or `[tab]/page.tsx`.

## Acceptance Criteria Verification

- `grep -c 'Object.values(watchMap)' WornTabContent.tsx` = **0** (old derivation removed)
- `grep -c 'ownedWatches' WornTabContent.tsx` = **5** (>= 3 required; interface decl + destructured param + useMemo body + empty-state WywtPostDialog mount + dep array)
- `watchOptions` useMemo dependency array = `[ownedWatches]`
- `grep -c 'watchMap={watchMap}' WornTabContent.tsx` = **2** (WornTimeline + WornCalendar)
- `grep -c '<SelectItem value="all">All watches</SelectItem>' WornTabContent.tsx` = **1**
- `git diff --name-only -- LogTodaysWearButton.tsx` = empty (no change)
- `git diff --name-only -- 'src/app/u/[username]/[tab]/page.tsx'` = empty (no change)
- `npm run build` exits 0 ("Compiled successfully in 22.3s")

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. The dropdown now actively derives from `ownedWatches` (a real server-passed prop); no hardcoded empty values or placeholders.

## Threat Flags

None. This change reduces the surface of watch data exposed in dropdowns (from all to owned-only). No new network endpoints, auth paths, or schema changes.

## Self-Check: PASSED

- File modified: `src/components/profile/WornTabContent.tsx` — exists and contains the expected changes.
- Commit `9eb47266` exists: confirmed via `git log`.
- Build: `npm run build` exits 0.
