---
phase: 72-search-composition-fixes
plan: 02
subsystem: ui
tags: [base-ui, combobox, react, rtl, vitest, keyboard-navigation]

# Dependency graph
requires:
  - phase: 72-search-composition-fixes
    provides: Phase context decisions D-05 through D-12
  - phase: 69-search-entry
    provides: SearchEntry.tsx pure-presenter component (D-03 contract FROZEN)
provides:
  - "SRCH-02 fixed: combobox keyboard navigation (ArrowDown/ArrowUp/Enter/Escape) restored via isItemEqualToValue + index={i} removal"
  - "SRCH-03 fixed: 'Not finding it?' footer click restored in real browsers by relocating button outside Combobox.List"
  - "4 regression tests (SRCH-02a, SRCH-02b, SRCH-03a structural, SRCH-03b behavioral) all GREEN"
affects: [73-route-fix, 74-mobile-polish, prod-bundle-v8.1]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CompositeList registration: never pass explicit index={i} to Combobox.Item unless virtualization (items= prop) is in use; DOM-order registration via useCompositeListItem.register() is the correct mode for server-filtered controlled comboboxes"
    - "base-ui keyboard test pattern: real timers (not fake), real-time await (260ms for 250ms debounce), userEvent.setup({ delay: null }) for synchronous key dispatch"
    - "Footer-outside-listbox pattern: non-Item elements inside Combobox.List lose click routing in real browsers; place them as Popup siblings with their own render gate"

key-files:
  created: []
  modified:
    - src/components/watch/SearchEntry.tsx
    - src/components/watch/SearchEntry.test.tsx

key-decisions:
  - "D-07 HALT resolved by operator (Option A): SRCH-02 fix is two-change composite — isItemEqualToValue prop + removal of index={i} from Combobox.Item. RESEARCH.md's 'single prop' original analysis was incomplete; the true root cause was index={i} causing useCompositeListItem to skip register(), leaving listRef.current.length=0 so ArrowDown always read out-of-bounds and onNavigate(null) was called instead of advancing activeIndex."
  - "Real timers required for SRCH-02 keyboard tests (RESEARCH.md Pitfall 6): fake-timer/rAF interaction with base-ui's CompositeList causes ArrowDown to deadlock; switching to 260ms real-time await unblocks the animation frame loop"
  - "SRCH-03 footer render gate must be explicit after relocation (Pitfall 5): when the button lived inside the !isLoading && results.length > 0 List block it was implicitly gated; as a sibling it needs its own identical condition"
  - "font-medium in comments is allowed (guardrail is for className usage only); both occurrences in SearchEntry.tsx are documentation comments explaining the guardrail, not style attributes"

patterns-established:
  - "CompositeList registration: omit explicit index prop on Combobox.Item when not using virtualization"
  - "base-ui keyboard RTL: real timers + 260ms await + userEvent.setup({ delay: null })"
  - "Popup sibling footer: explicit gate mirrors the List gate"

requirements-completed:
  - SRCH-02
  - SRCH-03

# Metrics
duration: ~15min
completed: 2026-05-30
---

# Phase 72 Plan 02: SearchEntry Keyboard + Footer Fix Summary

**Combobox keyboard navigation (SRCH-02) and footer click (SRCH-03) restored in SearchEntry via two surgical edits: isItemEqualToValue prop + index={i} removal from Combobox.Item, and footer button relocated outside Combobox.List as a Popup sibling**

## Performance

- **Duration:** ~15 min (continuation from D-07 HALT checkpoint)
- **Started:** 2026-05-30T10:00:00Z (continuation)
- **Completed:** 2026-05-30T10:15:00Z
- **Tasks:** 3 (Task 1 completed by prior executor at 8f5e692c; Tasks 2 + 3 completed this session)
- **Files modified:** 2

## Accomplishments

- SRCH-02 keyboard navigation restored: ArrowDown/ArrowUp/Enter/Escape all work correctly; `data-highlighted` attribute sets on the active option; Enter fires `onPick(result)` with the correct row
- SRCH-03 footer click restored for real browsers: button moved outside `<Combobox.List>` (role="listbox") so native click routing applies; structural test asserts `footer.closest('[role="listbox"]') === null`
- 4 regression tests (SRCH-02a, SRCH-02b, SRCH-03a structural, SRCH-03b behavioral) all GREEN; all 24 SearchEntry tests pass; `npm run build` exit 0
- D-07 HALT escalation fully resolved: operator's Option A (two-change composite) confirmed correct

## Task Commits

1. **Task 1: RED tests — SRCH-02 keyboard + SRCH-03 footer-placement** - `8f5e692c` (test) [prior executor]
2. **Task 2: SRCH-02 GREEN — isItemEqualToValue + drop index={i}** - `1d3055fd` (feat)
3. **Task 3: SRCH-03 GREEN — footer relocation as Popup sibling** - `4d5d51dd` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `src/components/watch/SearchEntry.tsx` — Two surgical edits: (a) `isItemEqualToValue={(a, b) => a.catalogId === b.catalogId}` on `<Combobox.Root>` (already present from prior executor); (b) `index={i}` removed from `<Combobox.Item>` and unused `i` dropped from `.map()` parameter; (c) footer `<button>` moved from last child of `<Combobox.List>` to sibling inside `<Combobox.Popup>` with own `!isLoading && results.length > 0` render gate
- `src/components/watch/SearchEntry.test.tsx` — SRCH-02 describe block switched from fake-timer to real-timer approach (260ms await replaces vi.advanceTimersByTime); 4 new test cases across SRCH-02 + SRCH-03 describe blocks

## Decisions Made

- **Option A confirmed (operator decision, binding):** SRCH-02 requires both `isItemEqualToValue` AND removal of `index={i}` — the original D-07 "single prop" analysis in RESEARCH.md was incomplete. The two fixes are orthogonal correctness requirements: `isItemEqualToValue` resolves the `Object.is` comparator failure for fresh result objects; removing `index={i}` restores `useCompositeListItem.register()` so `listRef.current` populates, enabling ArrowDown to find the next item.
- **Real timers for SRCH-02 keyboard tests:** Fake timers + `vi.advanceTimersByTime` cause a deadlock with base-ui's `useIsoLayoutEffect` rAF loop in jsdom; real-time 260ms await resolves this without any jsdom environment pragma.
- **Phase 69 D-03 pure-presenter contract preserved:** No new props added to SearchEntry; `onPick`/`onSubmitStructured`/`onSwitchToUrl` signatures unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Operator Decision - SRCH-02 Fix Scope Expansion] Two-change composite applied instead of single-prop addition**
- **Found during:** D-07 HALT by prior executor; operator resolved before this session
- **Issue:** RESEARCH.md's root-cause analysis identified `isItemEqualToValue` as the single fix (D-07 "single-change discipline"). During prior executor's Task 2 attempt, `isItemEqualToValue` alone was insufficient because `index={i}` on `<Combobox.Item>` caused `useCompositeListItem` to skip `register()` (because `externalIndex != null`), leaving `sortedMap.size = 0`. `CompositeList.useIsoLayoutEffect` then truncated `listRef.current.length = 0`. ArrowDown read `listRef.length === 0`, treated index as out-of-bounds, called `onNavigate(null)`, and `activeIndex` never advanced.
- **Fix:** Applied Option A per operator decision: keep `isItemEqualToValue` prop AND remove `index={i}` from `<Combobox.Item>`. Also removed unused `i` from `.map((r, i) =>` parameter.
- **Files modified:** src/components/watch/SearchEntry.tsx, src/components/watch/SearchEntry.test.tsx
- **Verification:** SRCH-02a + SRCH-02b both GREEN; 23/24 tests passing after Task 2 (SRCH-03a still RED as expected)
- **Committed in:** `1d3055fd`

**2. [Rule 1 - Bug] SRCH-02 tests switched from fake-timer to real-timer approach**
- **Found during:** Task 2 GREEN phase — prior executor updated tests to real timers (committed as part of working-tree state)
- **Issue:** Fake-timer approach with `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })` pattern caused a deadlock with base-ui's `useIsoLayoutEffect` rAF scheduling in jsdom, preventing `data-highlighted` from ever being set
- **Fix:** Tests use `vi.useRealTimers()` in `beforeEach` and `await new Promise(r => setTimeout(r, 260))` for debounce advance instead of `vi.advanceTimersByTime(250)`
- **Files modified:** src/components/watch/SearchEntry.test.tsx
- **Committed in:** `1d3055fd` (included in Task 2 commit with the source fix)

---

**Total deviations:** 2 (1 operator-resolved scope expansion; 1 auto-fix for test timer approach)
**Impact on plan:** Both deviations were necessary for correctness. No scope creep. Phase 69 D-03 contract preserved.

## Issues Encountered

- RESEARCH.md root-cause analysis was incomplete: the original plan (D-07) framed SRCH-02 as a single-prop addition. The actual root cause involved a second interaction (`index={i}` preventing `useCompositeListItem.register()`) that only emerged when attempting the single-prop fix. Escalated per D-07 discipline; operator resolved with Option A decision.

## Structural Verification

- `grep -c "isItemEqualToValue=" src/components/watch/SearchEntry.tsx` → 1 (single prop, no duplicate)
- `grep -nE "<Combobox\.Item[^>]*index=\{" src/components/watch/SearchEntry.tsx` → 0 lines (index={i} removed)
- `grep -c "font-medium" src/components/watch/SearchEntry.tsx` → 2 (both are comments, not className — guardrail intact)
- `npm run build` → exit 0
- 24/24 SearchEntry tests pass

## Forward Signal

Phase 72 Plan 02 complete. SRCH-02 + SRCH-03 fixed and regression-tested. Bundle ships with Phases 73 (ROUTE-01) + 74 (DUPE-04 + MOB-01) for a single prod push per `feedback_mobile_ui_verify_on_prod`.

## User Setup Required

None - no external service configuration required.

---
*Phase: 72-search-composition-fixes*
*Completed: 2026-05-30*
