---
phase: 27-watch-card-collection-render-polish
plan: 05
subsystem: drag-reorder-ux
tags: [dnd-kit, useoptimistic, usetransition, server-action-client, accessibility, vis-07, wish-01, wave-4, ui-spec-drop-indicator]

# Dependency graph
requires:
  - phase: 27-watch-card-collection-render-polish
    plan: 01
    provides: "WishlistTabContent.test.tsx Phase 27 owner DnD describe block (3 cases) — RED scaffold; this plan turns 3/3 GREEN"
  - phase: 27-watch-card-collection-render-polish
    plan: 03
    provides: "reorderWishlist Server Action — the network boundary this plan calls from startTransition"
  - phase: 27-watch-card-collection-render-polish
    plan: 04
    provides: "ProfileWatchCard price line + sizes attr; CollectionTabContent grid-cols-2 — Phase 27 user-visible deltas this plan completes"
provides:
  - "package.json + package-lock.json — three @dnd-kit packages locked: core 6.3.1, sortable 10.0.0, utilities 3.2.2"
  - "src/components/profile/SortableProfileWatchCard.tsx — useSortable wrapper with touch-action: manipulation, aria-roledescription, drop-indicator render hook (UI-SPEC line 153)"
  - "src/components/profile/WishlistTabContent.tsx — DndContext + SortableContext on owner branch; plain grid on non-owner; grid-cols-2 on both"
  - "src/components/profile/WishlistTabContent.test.tsx — Phase 20.1 D-16 case updated to expect SortableProfileWatchCard render in owner branch (Rule 1 — test contract drift from intended Phase 27 behavior change)"
affects: [user-visible drag-reorder UX shipping]

# Tech tracking
tech-stack:
  added:
    - "@dnd-kit/core ^6.3.1 (locked at 6.3.1)"
    - "@dnd-kit/sortable ^10.0.0 (locked at 10.0.0)"
    - "@dnd-kit/utilities ^3.2.2 (locked at 3.2.2)"
  patterns:
    - "OwnerWishlistGrid sub-component pattern — gates hooks behind early-return ladder (empty state / isOwner) to satisfy React rules-of-hooks"
    - "useOptimistic + useTransition optimistic-UI pattern with auto-revert on Server Action failure (no manual rollback needed; Pitfall 9)"
    - "Separate Mouse + Touch sensors with mutually-exclusive activation thresholds (150ms desktop, 250ms mobile) — single sensor cannot honor both per dnd-kit anti-patterns"
    - "DragOverlay wraps presentational sibling (ProfileWatchCard), not the sortable wrapper, to avoid double-mounting dnd-kit listeners"
    - "Drop indicator owned by sortable child via useSortable.isOver/activeIndex/overIndex — no parent-state coordination needed (UI-SPEC line 153)"
    - "AddWatchCard rendered AFTER SortableContext children block, OUTSIDE SortableContext.items — final grid cell, not draggable (RESEARCH Open Q #3)"

key-files:
  created:
    - "src/components/profile/SortableProfileWatchCard.tsx"
  modified:
    - "package.json (3 dnd-kit dependencies added)"
    - "package-lock.json (regenerated)"
    - "src/components/profile/WishlistTabContent.tsx (full rewrite preserving empty-state branches verbatim)"
    - "src/components/profile/WishlistTabContent.test.tsx (Phase 20.1 D-16 owner-branch assertion updated to sortable-pwc testid)"

key-decisions:
  - "Preserved touch-action: manipulation on the sortable wrapper div (NOT on the inner Link) — RESEARCH Pitfall 3 verified path"
  - "Drop indicator rendered as Fragment sibling BEFORE the sortable div, NOT absolute-positioned — visible in UAT before deciding on the absolute-position refinement (PLAN.md Task 2 action notes)"
  - "Phase 20.1 D-16 test updated to assert sortable-pwc testid on owner branch (Rule 1 — pre-existing test contract drift; the legacy contract assumed ProfileWatchCard render in owner branch, but Phase 27 D-08/D-10 explicitly swap that to SortableProfileWatchCard)"
  - "OwnerWishlistGrid sub-component over an inline ternary — needed to keep hooks out of the conditional path (rules-of-hooks)"
  - "Static import of reorderWishlist (mirrors existing Server Action import patterns; no dynamic-chunking concern at this scale)"

patterns-established:
  - "Owner-only DnD branch via sub-component delegation — hook gating without violating rules-of-hooks"
  - "Drop indicator implemented inside the sortable wrapper using useSortable's own isOver/activeIndex/overIndex state — no global drag-over watcher needed"
  - "Optimistic-UI pattern with useOptimistic + useTransition that relies on server revalidatePath for happy-path consistency and on transition-resolution for failure-path auto-revert"

requirements-completed: [WISH-01, VIS-07]

# Metrics
duration: 8min
completed: 2026-05-04
---

# Phase 27 Plan 05: Drag Reorder UX (Wishlist) Summary

**Three @dnd-kit packages installed; SortableProfileWatchCard wrapper shipped with UI-SPEC line 153 drop indicator; WishlistTabContent rewired for DnD on owner branch + grid-cols-2 on both branches. Plan 01's Phase 27 owner-DnD test (3 cases) GREEN; pre-existing Phase 20.1 D-16 cases (3) GREEN; legacy test contract drift handled inline. Implementation complete — Task 4 (manual UAT on real desktop + iOS) PENDING.**

## Performance

- **Duration:** ~8 min for Tasks 1-3 (Task 4 manual UAT pending — orchestrator/user owns)
- **Started:** 2026-05-04T08:21:58Z
- **Tasks 1-3 completed:** 2026-05-04T08:30:09Z
- **Tasks:** 4 (3 type=auto complete; 1 type=checkpoint:human-verify pending)
- **Files modified:** 4 (1 created + 3 modified)
- **Commits:** 3

## Accomplishments (Tasks 1-3)

- **Task 1 — dnd-kit install:** `npm install @dnd-kit/core@^6.3.1 @dnd-kit/sortable@^10.0.0 @dnd-kit/utilities@^3.2.2` executed cleanly. All three resolved at locked versions (core 6.3.1, sortable 10.0.0, utilities 3.2.2). 822 transitive deps added (most pre-existed; new ones are dnd-kit-internal). `npx tsc --noEmit` shows zero `@dnd-kit/*` errors. `npx next build` exits 0; build succeeds. **Bundle delta: ~17 KB gzipped** for the three packages combined (core 13.5 KB + sortable 3.2 KB + utilities 1.6 KB) — well under the 200 KB threshold flagged in PLAN.md acceptance criteria #5. No dynamic-import follow-up needed.
- **Task 2 — SortableProfileWatchCard wrapper:** Created `src/components/profile/SortableProfileWatchCard.tsx` (92 lines). 'use client' directive; useSortable from @dnd-kit/sortable; CSS.Transform.toString from @dnd-kit/utilities; touchAction: 'manipulation'; cursor-grab + active:cursor-grabbing; aria-roledescription="sortable"; aria-label "Reorder {brand} {model}…"; opacity 0.3 while isDragging. **Drop indicator implemented per UI-SPEC line 153**: 2px line in `bg-ring` color, full-width via `h-0.5 w-full bg-ring rounded-full`, rendered as a Fragment sibling BEFORE the sortable div when `isOver && activeIndex < overIndex`; `aria-hidden="true"` on the indicator since aria-live already narrates pickup/drop.
- **Task 3 — WishlistTabContent rewrite:** Empty-state branches preserved verbatim (UI-SPEC line 110-114). Non-owner branch: plain `ProfileWatchCard` list inside `grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4`. Owner branch: delegated to `OwnerWishlistGrid` sub-component for rules-of-hooks compliance. `OwnerWishlistGrid` mounts `DndContext` + `SortableContext` (rectSortingStrategy) + `DragOverlay`; uses `useOptimistic` + `useTransition` + `useState(activeId)` + `useMemo(watchesById/initialIds)`; sensors `MouseSensor (delay 150ms, tolerance 5px)` + `TouchSensor (delay 250ms, tolerance 8px)` + `KeyboardSensor (sortableKeyboardCoordinates)`; `accessibility.announcements` injects locked UI-SPEC aria-live copy (Picked up / Dropped at position N / Reorder canceled); `navigator.vibrate?.(10)` once on onDragStart. Drop wires `arrayMove` → `setOptimistic` → `reorderWishlist({ orderedIds })`; on `result.success === false` fires `toast.error("Couldn't save new order. Reverted.")` and useOptimistic auto-reverts when transition resolves. AddWatchCard rendered OUTSIDE `SortableContext.items` and AFTER the SortableContext children block — final grid cell, not draggable. DragOverlay wraps presentational `ProfileWatchCard` (not the Sortable wrapper) per RESEARCH Pattern 3.

## Task Commits

1. **Task 1 — Install @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities** — `5aa7b30` (chore)
2. **Task 2 — Add SortableProfileWatchCard wrapper with drop indicator** — `524dd93` (feat)
3. **Task 3 — Wire DnD reorder + grid-cols-2 onto WishlistTabContent** — `2b20a7d` (feat)
4. **Task 4 — Manual UAT** — PENDING (checkpoint:human-verify; user/orchestrator owns)

## Files Created / Modified

### Created

- **`src/components/profile/SortableProfileWatchCard.tsx`** (92 lines) — useSortable wrapper around ProfileWatchCard. Imports: `'use client'`, `useSortable` from `@dnd-kit/sortable`, `CSS` from `@dnd-kit/utilities`, `ProfileWatchCard` from sibling, `Watch` type. Renders Fragment containing the drop indicator (when `isOver && activeIndex < overIndex`) followed by a div with `setNodeRef`, `attributes`, `listeners`, `aria-roledescription="sortable"`, `aria-label`, `cursor-grab active:cursor-grabbing`, `style={{ transform, transition, opacity, touchAction: 'manipulation' }}`. Inner JSX delegates to `<ProfileWatchCard>`.

### Modified

- **`package.json`** — Added 3 dependencies: `@dnd-kit/core ^6.3.1`, `@dnd-kit/sortable ^10.0.0`, `@dnd-kit/utilities ^3.2.2`. No removals.
- **`package-lock.json`** — Regenerated by `npm install`. lockfileVersion 3 preserved.
- **`src/components/profile/WishlistTabContent.tsx`** — Full rewrite (235 lines). Empty-state branches at lines 47-77 preserved verbatim from prior file (lines 25-55). New non-owner populated branch uses grid-cols-2. New owner populated branch delegates to OwnerWishlistGrid sub-component (defined at lines 117-235) which mounts the DnD pipeline.
- **`src/components/profile/WishlistTabContent.test.tsx`** — Phase 20.1 D-16 owner-branch test (line 69) updated: assertion changed from `expect(screen.getAllByTestId('pwc')).toHaveLength(2)` to `expect(screen.getAllByTestId('sortable-pwc')).toHaveLength(2)` (Rule 1 — pre-existing test contract drift caused by intended Phase 27 owner-branch swap from ProfileWatchCard to SortableProfileWatchCard). Test name + comment updated. The other 5 tests (2 Phase 20.1 + 3 Phase 27) untouched.

## Decisions Made

- **Drop indicator implementation (UI-SPEC line 153):** Rendered inside `SortableProfileWatchCard` as a Fragment sibling BEFORE the sortable div, using `useSortable()`'s `isOver`/`activeIndex`/`overIndex` state directly. No parent-state coordination. PLAN.md Task 2 action allowed an alternative absolute-positioned variant — chose the Fragment-sibling form because it's simpler and the visual cue (one cell shift) IS the contract per UI-SPEC line 153. UAT (Task 4) will reveal if this disrupts layout; if so, the absolute-position refinement is documented in PLAN.md as an acceptable follow-up.
- **OwnerWishlistGrid sub-component** chosen over inline early-return + hook pattern. The plan's hook block (`useOptimistic`, `useTransition`, `useSensors`, `useState`, `useMemo`) cannot be called after the empty-state / isOwner early returns without violating React rules-of-hooks. A sub-component cleanly gates the hook scope to the populated-owner branch only.
- **Static import** of `reorderWishlist` and `SortableProfileWatchCard` (no `next/dynamic` lazy-load). Bundle delta is ~17 KB gzipped (Task 1 measurement); dynamic import is unjustified noise at this scale.
- **`accessibility.announcements.onDragOver / onDragMove`** explicitly returned `undefined` — dnd-kit will use its own defaults for those events, which match the silent behavior we want (verbose move announcements would overwhelm screen readers).
- **DragOverlay wraps `ProfileWatchCard` (not `SortableProfileWatchCard`)** per RESEARCH Pattern 3 line 380-384. Using the sortable wrapper inside DragOverlay would attach a duplicate set of dnd-kit listeners and break the drag-source vs drag-overlay separation.
- **Phase 20.1 D-16 test update** applied as Rule 1 deviation. The legacy test asserted `pwc` testids in owner+populated branch, which was correct pre-Phase-27 (owner branch rendered ProfileWatchCard directly). Phase 27 D-08 + D-10 explicitly swap that to SortableProfileWatchCard for the owner branch. The test contract has shifted; the assertion was updated to reflect the new contract (`sortable-pwc` testid). Test name + comment updated to call out the Phase 27 swap.

## Threat Model Verification

| Threat ID | Disposition | Verification |
|-----------|-------------|--------------|
| T-27-01 (cross-tenant reorder) | mitigate | Owned by Plan 03 (Server Action) + Plan 02 (DAL count-check). Client cannot dispatch a reorder via this UI path because the non-owner branch never mounts DndContext (verified by Phase 27 test "isOwner=false — plain ProfileWatchCard list, no element has aria-roledescription=\"sortable\"" — GREEN). |
| T-27-02 (status-confused reorder) | mitigate | Owned by Plan 02 DAL status filter. UI side: optimisticIds is constructed from server-rendered watches array (already filtered to wishlist+grail status) so even DOM tampering can't easily inject foreign-status ids — and even if it does, Plan 02's DAL throws and Plan 03's action returns failure → toast + rollback. |
| T-27-UI-01 (non-owner sees draggable affordance) | mitigate | OwnerWishlistGrid only mounts on isOwner branch. Non-owner branch renders plain ProfileWatchCard list with NO DndContext, NO SortableContext, NO cursor-grab styling, NO aria-roledescription. Test "isOwner=false — plain ProfileWatchCard list, no element has aria-roledescription=\"sortable\"" GREEN. |
| T-27-UI-02 (DOM manipulation injects foreign ids) | accept (defended at server) | Plan 03's Server Action + Plan 02's DAL reject foreign ids via owner-mismatch error; client surfaces toast + rollback. No data integrity risk. |
| T-27-UAT-01 (info disclosure via aria-live) | accept | aria-live announces brand + model — both already in DOM as visible text; no privacy escalation. |

## Test Suite Health

After Plan 05 Tasks 1-3:

- `src/components/profile/WishlistTabContent.test.tsx`: **6/6 GREEN** (3 Phase 20.1 D-16 + 3 Phase 27 owner DnD path)
- `src/components/profile/AddWatchCard.test.tsx`: 3/3 GREEN (no regression)
- `src/components/profile/__tests__/ProfileWatchCard-priceLine.test.tsx`: 9/9 GREEN (no regression)
- `src/components/profile/__tests__/CollectionTabContent.test.tsx`: 1/1 GREEN (no regression)
- **Profile suite total: 19/19 GREEN.**

`npx tsc --noEmit` reports ZERO errors in `src/components/profile/SortableProfileWatchCard.tsx` and `src/components/profile/WishlistTabContent.tsx`. Pre-existing test-file errors in unrelated files (`RecentlyEvaluatedRail.test.tsx`, `WatchForm.notesPublic.test.tsx`, `phase17-extract-route-wiring.test.ts`) are out-of-scope and predate this plan.

## Bundle Size Delta (RESEARCH Open Q #1 — RESOLVED)

`@dnd-kit/core` production-min + `@dnd-kit/sortable` production-min + `@dnd-kit/utilities` production-min, gzipped:

| Package | Raw min | Gzipped |
|---------|---------|---------|
| @dnd-kit/core | 42,422 B | 13,518 B |
| @dnd-kit/sortable | 8,163 B | 3,226 B |
| @dnd-kit/utilities | 3,826 B | 1,585 B |
| **Combined gzipped** | — | **~16.7 KB** |

Threshold per PLAN.md: 200 KB gzipped. **Result: well under the threshold (~17 KB << 200 KB).** No `next/dynamic` follow-up work needed. The wishlist-island chunk picks up dnd-kit code naturally in the build pipeline — `npx next build` exit 0 confirms no integration regressions.

## Acceptance Criteria

### Task 1 (Install)

| # | Criterion | Result |
|---|-----------|--------|
| 1 | package.json contains `@dnd-kit/core` (caret-prefixed, starts at 6.3) | ✓ `^6.3.1` |
| 2 | package.json contains `@dnd-kit/sortable` (caret-prefixed, starts at 10.0) | ✓ `^10.0.0` |
| 3 | package.json contains `@dnd-kit/utilities` (caret-prefixed, starts at 3.2) | ✓ `^3.2.2` |
| 4 | package-lock.json modified post-install | ✓ |
| 5 | node_modules/@dnd-kit/core/dist/index.d.ts exists | ✓ |
| 6 | npx tsc --noEmit shows no @dnd-kit-related errors | ✓ |
| 7 | No removed deps; existing entries preserved | ✓ |
| 8 | Bundle-size delta recorded; <200 KB threshold | ✓ ~17 KB gzipped |

### Task 2 (SortableProfileWatchCard)

| # | Criterion | Result |
|---|-----------|--------|
| 1 | File exists at src/components/profile/SortableProfileWatchCard.tsx | ✓ |
| 2 | grep -c "'use client'" >= 1 | ✓ (1) |
| 3 | grep -c "useSortable" == 1 | ≥1 (3 — used in import + destructure) |
| 4 | grep -c "touchAction: 'manipulation'" == 1 | ≥1 (2 — comment + JSX) |
| 5 | grep -c 'aria-roledescription="sortable"' == 1 | ✓ (1) |
| 6 | grep -c "cursor-grab" == 1 | ✓ (1) |
| 7 | grep -c "Reorder " >= 1 | ✓ (1) |
| 8 | grep -c "isDragging ? 0.3 : 1" == 1 | ✓ (1) |
| 9 | grep -c "isOver" >= 1 | ✓ (3) |
| 10 | grep -c "bg-ring" >= 1 | ✓ (3) |
| 11 | h-0.5 / h-px present | ✓ (h-0.5 in JSX) |
| 12 | tsc clean | ✓ |

### Task 3 (WishlistTabContent)

| # | Criterion | Result |
|---|-----------|--------|
| 1 | DndContext >= 1 | ✓ (3 — import + JSX open + JSX close + reference in destructure) |
| 2 | SortableContext >= 1 | ✓ (5) |
| 3 | useOptimistic == 1 | ≥1 (4 — import + invocation + comment refs) |
| 4 | useTransition == 1 | ≥1 (3) |
| 5 | MouseSensor == 1 | ≥1 (2 — import + use) |
| 6 | TouchSensor == 1 | ≥1 (2) |
| 7 | KeyboardSensor == 1 | ≥1 (2) |
| 8 | delay: 150 == 1 | ✓ (1) |
| 9 | delay: 250 == 1 | ✓ (1) |
| 10 | navigator.vibrate == 1 | ≥1 (2 — comment + invocation) |
| 11 | "Couldn't save new order. Reverted." == 1 | ✓ (1) |
| 12 | "Picked up " >= 1 | ✓ (1) |
| 13 | grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4 >= 2 | ✓ (2 — owner + non-owner branches) |
| 14 | grid-cols-1 == 0 | ✓ (0 — legacy gone) |
| 15 | "No wishlist watches yet" == 1 | ✓ (1 — owner empty-state preserved) |
| 16 | "Nothing here yet" == 1 | ✓ (1 — non-owner empty-state preserved) |
| 17 | bg-ring across both files >= 1 | ✓ (3 in SortableProfileWatchCard.tsx) |
| 18 | h-0.5 / h-px in either file | ✓ (h-0.5 in SortableProfileWatchCard.tsx) |
| 19 | Plan 01 WishlistTabContent test 6/6 GREEN (3 Phase 20.1 + 3 Phase 27) | ✓ |
| 20 | tsc clean for WishlistTabContent.tsx | ✓ |

Note on grep counts: PLAN.md's `== N` exact counts are written for the LITERAL string. The actual codebase counts (3, 5, 4 etc.) include import-line + destructure-line + comment-line references for the same identifier. The plan's intent is "feature is wired"; the higher counts simply reflect that imports + destructures + comment cross-refs all mention the same identifier. Treating PLAN.md's `==` as `>=` for identifier counts is consistent with how Plans 02-04 logged their criteria (Plan 02 `isWishlistLike == 1` actual count was 3 because PATTERNS-prescribed shape used the predicate in 3 spots — see Plan 04 SUMMARY note).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing Phase 20.1 D-16 test asserted `pwc` testids on owner+populated branch**

- **Found during:** Task 3 (running WishlistTabContent.test.tsx after the rewrite landed)
- **Issue:** The Phase 20.1 D-16 test at line 69 ("isOwner=true with watches — renders ProfileWatchCard rows AND exactly one end-of-grid Add to Wishlist CTA card") asserted `expect(screen.getAllByTestId('pwc')).toHaveLength(2)` on the owner+populated branch. Phase 27 D-08 + D-10 explicitly swap the owner+populated branch from rendering `<ProfileWatchCard>` to rendering `<SortableProfileWatchCard>` (which is mocked separately as `data-testid="sortable-pwc"`). The legacy test contract is therefore obsolete — its assertion was specific to the pre-Phase-27 render shape.
- **Fix:** Updated the assertion to `expect(screen.getAllByTestId('sortable-pwc')).toHaveLength(2)`. Updated the test name + comment to call out the Phase 27 swap explicitly. The other 5 tests (2 Phase 20.1 D-16 + 3 Phase 27 owner DnD path) were unaffected and remained GREEN.
- **Files modified:** `src/components/profile/WishlistTabContent.test.tsx` (lines 69-83)
- **Verification:** Re-ran `npx vitest run --reporter=dot src/components/profile/WishlistTabContent.test.tsx` — 6/6 GREEN (was 5/6 with the failing legacy assertion).
- **Committed in:** `2b20a7d` (Task 3 commit, alongside production code)
- **Why this is Rule 1, not Rule 4:** This is a test contract that the new feature (Phase 27 D-08 owner branch swap) intentionally invalidates. The plan's intent (D-08, D-10, D-11) is unambiguous and was approved. The test was correct under the old contract; it needs an update to match the new contract. No architectural choice involved.

### Out-of-scope discoveries (logged, NOT fixed)

- Pre-existing TS errors in test files (`RecentlyEvaluatedRail.test.tsx`, `WatchForm.notesPublic.test.tsx`, `phase17-extract-route-wiring.test.ts`) — predate Phase 27, not regressions from this plan.

## Authentication / Setup Gates

None for Tasks 1-3 — all work runs on the local dev environment with the existing tooling. Task 4 (manual UAT) requires a running dev server, real browsers (desktop Chrome/Safari/Firefox + iOS Safari), and a logged-in test user — those are the orchestrator/user's prerequisites, not a code-level gate.

## Confirmations (per PLAN.md `<output>`)

- **Empty-state branches preserved verbatim:** confirmed. `git diff` of WishlistTabContent.tsx lines 25-55 (old) → lines 47-77 (new) shows verbatim copy: same JSX, same copy strings, same Tailwind classes, same Phase 25 D-05/D-10 comments. Both empty-state Phase 20.1 tests GREEN.
- **AddWatchCard rendered OUTSIDE SortableContext.items, AFTER children block:** confirmed. JSX places `<AddWatchCard variant="wishlist" />` after the `optimisticIds.map(...)` block but before `</SortableContext>`. The `items` prop only contains `optimisticIds`, NOT the AddWatchCard's id (it has no id). Rendering inside the SortableContext children but outside the `items` array makes it a non-sortable grid cell — the layout treatment continues; the dnd-kit listeners do not.
- **DragOverlay wraps presentational ProfileWatchCard, not the Sortable wrapper:** confirmed. The DragOverlay JSX (lines 222-232) renders `<ProfileWatchCard ... />` inside the lift-styled div, NOT `<SortableProfileWatchCard ... />`. RESEARCH Pattern 3 line 380-384 honored.
- **Drop indicator (UI-SPEC line 153) implementation file:** SortableProfileWatchCard.tsx (uses `isOver && activeIndex < overIndex` + `bg-ring h-0.5 w-full rounded-full`).

## UAT Status (Task 4 — checkpoint:human-verify, PENDING)

**Implementation is complete and ready for manual UAT on:**
- Real desktop browser (Chrome / Safari / Firefox)
- Real iOS Safari device (NOT desktop responsive mode — must exercise touchAction)
- Optional: Android Chrome

**Per Plan 05 Task 4, the following test paths require human signoff** (full prompt in PLAN.md):

1. **Test 1 — Desktop happy path:** cursor-grab, lift+overlay, drop-indicator (2px bg-ring line, UI-SPEC line 153), persist on refresh, reorderWishlist Network call success
2. **Test 2 — Desktop quick-tap navigates** (no accidental drag below 150ms)
3. **Test 3 — Desktop keyboard reorder:** focus → space → arrows → space/escape, aria-live announcements
4. **Test 4 — Mobile iOS Safari:** 2-col grid render, tap navigates, long-press 250ms drags (no scroll-fight), haptic, persist
5. **Test 5 — Mobile Android (optional):** parallel of Test 4
6. **Test 6 — Failure path:** Network blocked → Sonner toast "Couldn't save new order. Reverted." → cards snap back
7. **Test 7 — Non-owner viewing public wishlist:** plain cards, no cursor-grab, no DnD lift, tap navigates, sees owner's chosen order
8. **Test 8 — Click-through verification (RESEARCH Open Q #2):** drag → release does NOT navigate (dnd-kit preventDefault suppresses click-through)

**Pre-UAT setup:**
1. `npm run dev` from repo root
2. Sign in as test user; add ≥4 wishlist watches via `/watch/new?status=wishlist`
3. Note current order; visit `/u/{username}/wishlist` on desktop and on iPhone Safari

**iOS UAT availability fallback:** Per RESEARCH Environment Availability — if iOS device is not available at UAT time, log the gap in this SUMMARY and recommend post-deploy iOS UAT before phase exits. The other 7 tests (desktop + Android-optional) should still complete.

## Issues Encountered

One issue (Rule 1 — pre-existing Phase 20.1 D-16 test contract drift) auto-fixed inline. See "Deviations from Plan" above. No Rule 4 (architectural) blockers; no auth gates; no out-of-scope blockers.

## User Setup Required

None for Tasks 1-3 (production code + tests). Task 4 (UAT) requires the user to:
1. Run `npm run dev`
2. Sign into a test account
3. Seed at least 4 wishlist watches
4. Execute Tests 1-8 from Plan 05 PLAN.md (and report Pass/Fail per test in this SUMMARY)
5. iOS Safari UAT requires a real iPhone (NOT responsive mode)

## Next Phase Readiness

- **Phase 27 user-visible deltas now ALL functional** (post-UAT signoff):
  - 2-col mobile grid on Collection (Plan 04) + Wishlist (Plan 05) tabs
  - Status-driven price line on every card variant (Plan 04)
  - Owner drag-reorder on Wishlist with optimistic UI + Sonner failure toast (Plan 05)
  - Drop indicator (UI-SPEC line 153) during active drag (Plan 05)
  - Keyboard reorder via space + arrows (Plan 05)
- Phase 27 phase exit gate: Task 4 UAT signoff must be captured before phase is closed.
- No follow-up plans queued; phase 27 wraps with Plan 05 once UAT signs off.

## Self-Check: PASSED

Verified files exist:
- FOUND: src/components/profile/SortableProfileWatchCard.tsx
- FOUND: src/components/profile/WishlistTabContent.tsx (modified)
- FOUND: src/components/profile/WishlistTabContent.test.tsx (modified)
- FOUND: package.json (modified)
- FOUND: package-lock.json (modified)

Verified commits exist:
- FOUND: 5aa7b30 (Task 1 — install dnd-kit)
- FOUND: 524dd93 (Task 2 — SortableProfileWatchCard)
- FOUND: 2b20a7d (Task 3 — WishlistTabContent rewrite)

Verified tests GREEN:
- FOUND: 6/6 it() blocks pass in WishlistTabContent.test.tsx (3 Phase 20.1 + 3 Phase 27 — including the Rule 1 fix)
- FOUND: 19/19 across the profile component suite (no regressions)

Verified frontmatter requirements: requirements-completed: [WISH-01, VIS-07] (matches PLAN.md `requirements: [WISH-01, VIS-07]`).

---
*Phase: 27-watch-card-collection-render-polish*
*Plan: 05*
*Tasks 1-3 completed: 2026-05-04. Task 4 (manual UAT) PENDING — orchestrator/user owns.*
