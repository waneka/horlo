---
phase: 83-polish-sweep
reviewed: 2026-07-14T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/components/layout/DesktopTopNav.tsx
  - tests/components/layout/DesktopTopNav.test.tsx
  - src/components/profile/WornTabContent.tsx
  - src/components/watch/WatchDetail.tsx
findings:
  critical: 0
  warning: 1
  info: 3
  total: 4
status: issues_found
---

# Phase 83: Code Review Report

**Reviewed:** 2026-07-14
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Reviewed the three POLISH edits against the diff of `c35bf34b..HEAD`. All three edits achieve their stated behavior. No bugs, security issues, or logic errors. Test file was updated correctly and no orphan expectations remain elsewhere.

One WARNING: POLISH-01 removed the only `<Button>` usage from `DesktopTopNav.tsx` but left the `Button` import in place — the file will fail an unused-imports lint (or ship dead code if the lint is silenced). This is a straightforward one-line delete and should ship with the same commit.

Three INFO items track semantic side-effects of POLISH-02 (data-source swap) that the phase context calls out as intended but which are worth documenting on the record: (a) users can no longer filter the Worn timeline by watches whose current status is not `owned` even though their wear events still render; (b) the same swap tightens `LogTodaysWearButton`'s watch picker to owned-only — likely a latent-bug fix but not called out in the phase spec; (c) the `WornTabContent.watchOptions` shape narrowed from `WatchSummary` (with `imageUrl`) to `{id, brand, model}`, which is consistent with all downstream consumers but drops the previously-available field.

## Warnings

### WR-01: Unused `Button` import after Plus-button removal

**File:** `src/components/layout/DesktopTopNav.tsx:6`
**Issue:** The `<Button>` primitive was the only JSX consumer of the `Button` import (used inside the removed `<Link>…<Button variant="ghost" size="icon">…</Button></Link>` block). After POLISH-01 there are zero `<Button>` occurrences in the file, but `import { Button } from '@/components/ui/button'` on line 6 remains. This is dead code and will trip `@typescript-eslint/no-unused-vars` / `unused-imports` under `npm run lint` — a violation of the phase's own "surgical, no leftover cruft" framing. It also very slightly bloats the client bundle if the shared chunk isn't already loading it (which, given the file is a client component, it likely is — so runtime impact is negligible; correctness/hygiene is the concern).
**Fix:**
```ts
// src/components/layout/DesktopTopNav.tsx line 6 — delete this line
import { Button } from '@/components/ui/button'
```
Verify with `npm run lint` after the delete.

## Info

### IN-01: `watchOptions` swap narrows the Worn filter dropdown vs. the timeline

**File:** `src/components/profile/WornTabContent.tsx:70-79`
**Issue:** Before the change, `watchOptions` was derived from `watchMap` (built server-side from `resolved.watches` in `app/u/[username]/[tab]/page.tsx:434-444`, which is *all* the user's watches — owned, wishlist, grail, etc., via `getWatchesByUser`). After the change, `watchOptions` is derived only from `ownedWatches` (pre-filtered to `status === 'owned'` in `page.tsx:493`). The `events` prop and `watchMap` are unchanged, so wear events for a watch whose current status is not `owned` (e.g., a watch the user acquired, wore, then reclassified as wishlist/grail, or sold and re-added later) will still render in `WornTimeline`/`WornCalendar` — but that watch will no longer appear in the filter `<Select>`, so the user cannot filter down to only its wear events. This is a real UX asymmetry, though the phase CONTEXT confirms owned-only is the intent. Flagging so the intended narrowing is captured on the record, not as a fix request.
**Fix:** No code change — behavior matches phase spec. If UAT reveals users hit this edge case, revisit by unioning `ownedWatches` with `Object.values(watchMap).filter((w) => events.some((e) => e.watchId === w.id))` and re-sorting.

### IN-02: `LogTodaysWearButton`'s watch list also narrows to owned-only (side-effect)

**File:** `src/components/profile/WornTabContent.tsx:159`
**Issue:** The same `watchOptions` reference is passed to `<LogTodaysWearButton watches={watchOptions} />`. Before the swap, that picker could surface a wishlist/grail watch (any watch present in `watchMap` because a wear event existed for it). After the swap it's limited to owned watches. This is almost certainly *correct* — "Log Today's Wear" for a wishlist watch is nonsensical — but the phase PLAN/SUMMARY frames POLISH-02 as scoped to the *filter* dropdown, not the picker. Worth documenting so it's not read as an unrelated regression later.
**Fix:** No change. If the intent was to fold this in explicitly, update `83-02-worn-tab-owned-only-dropdown-SUMMARY.md` to note that `LogTodaysWearButton`'s picker also tightened as a deliberate side-effect.

### IN-03: `watchOptions` shape narrowed — `imageUrl` no longer present

**File:** `src/components/profile/WornTabContent.tsx:70-79`
**Issue:** The old `Object.values(watchMap)` produced `WatchSummary[]` (declared at lines 19-24: `{id, brand, model, imageUrl: string | null}`). The new mapping produces `{id, brand, model}[]` — no `imageUrl`. Neither the `<Select>` in this file nor `LogTodaysWearButton` (see `src/components/profile/LogTodaysWearButton.tsx:23-27` — its own `WatchSummary` type intentionally omits `imageUrl`) currently reads `imageUrl`, so nothing breaks at the type level or at runtime. Just noting the drop for future maintainers who might grep for `watchOptions[x].imageUrl` expecting it to be there.
**Fix:** No change required. If a future picker wants to render thumbnails, pull the URL from `watchMap[id].imageUrl` at render time rather than re-adding it to `watchOptions`.

---

_Reviewed: 2026-07-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
