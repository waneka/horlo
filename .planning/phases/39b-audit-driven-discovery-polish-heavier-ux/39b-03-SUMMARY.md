---
phase: 39b-audit-driven-discovery-polish-heavier-ux
plan: 03
subsystem: ui
tags: [react, next-16, follow-button, server-rsc-imports-client, react-state, tailwind, vitest, testing-library, t-39b-03-open-redirect]

# Dependency graph
requires:
  - phase: 39b-01
    provides: catalog seed + lineage edges (informational dependency — this plan does not touch the catalog graph directly but executes within the same wave)
  - phase: 39b-02
    provides: ReferenceIdentityCard + Server-imports-Client-island pattern proven on /watch/[id] and /catalog/[catalogId]
provides:
  - LockedTabCard logged-in branch with inline FollowButton + caption (D-39b-12)
  - LockedTabCard unauthenticated branch with /signin?returnTo= Link + caption (D-39b-12, T-39b-03 mitigation via encodeURIComponent at producer)
  - 4 LockedTabCard mount sites threaded with viewerId / targetUserId / initialIsFollowing / currentPath
  - WornCalendar interactive day cells (events > 0) with role=button + tabIndex=0 + onClick + onKeyDown + aria-label (D-39b-13)
  - WornCalendar wear-detail panel below the grid (image + brand + model + notes; empty-day caption) (D-39b-13)
  - WornCalendar test-only initialSelectedDate?: string | null prop (W1 fix — eliminates readFileSync source-file grep in tests)
  - StatsTabContent WornList <li> rows wrap content in <Link href=/watch/{id}> (D-39b-14)
  - HorizontalBarChart bars verified unwrapped (D-39b-14 lock — chart bars aggregate over multiple watches; no single destination)
affects: [39b-04, 39b-05, future-collector-profile-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-imports-Client RSC analog applied to LockedTabCard (PopularCollectorRow precedent, Pitfall 8)"
    - "Test-only optional prop with !== undefined guard (NOT truthiness check) — preserves null as a valid pre-selected value while keeping production code path byte-identical (W1 fix pattern, reusable in future component tests that need to drive conditional render paths without source-file grep fallbacks)"
    - "encodeURIComponent at producer + validateReturnTo at consumer — T-39b-03 mitigation pattern for any future open-redirect surface"
    - "vi.mock('next/navigation') + vi.mock('@/app/actions/follows') boilerplate required when rendering any component that transitively imports FollowButton (which calls useRouter)"

key-files:
  created:
    - tests/components/profile/WornCalendar.tsx (100 lines, 3 tests)
  modified:
    - src/components/profile/LockedTabCard.tsx (53 → 103 lines; 4 new required props + two render branches; preserves existing TAB_LABELS + lock-icon + private-copy + common-ground early return)
    - src/components/profile/WornCalendar.tsx (181 → 292 lines; selectedDate state + mount effect + interactive day cells + wear-detail panel + initialSelectedDate test-only prop + formatDateLabel helper)
    - src/components/profile/StatsTabContent.tsx (86 → 92 lines; Link import + <li> body wrapped in Link with hover:bg-accent + rounded-md p-1)
    - src/app/u/[username]/[tab]/page.tsx (309 → 335 lines; isFollowing import + currentPath construction + initialIsFollowing computation + 4 LockedTabCard mount sites updated)
    - tests/components/profile/LockedTabCard.test.tsx (85 → 178 lines; 8 → 11 tests; baseProps spread for the 8 existing + 3 new D-39b-12 it() blocks + vi.mock for next/navigation and follows actions)

key-decisions:
  - "T-39b-03 mitigation literal: /signin?returnTo=${encodeURIComponent(currentPath)} — producer-side encoding (this plan) + consumer-side validateReturnTo (existing /signin infrastructure). Test asserts exact encoded href '/signin?returnTo=%2Fu%2Ftyler%2Fcollection'."
  - "WornCalendar W1 fix shipped as initialSelectedDate?: string | null prop with !== undefined guard. The undefined-default keeps production byte-equivalent to pre-W1; only the test-only call passes a value. Alternative considered: readFileSync source-file grep — REJECTED per CONTEXT W1 lock because it proves the template exists, not that the conditional logic surfaces it."
  - "vi.mock pattern for LockedTabCard test cribbed verbatim from FollowButton.test.tsx — useRouter mock + follow Server Actions stub. Required because LockedTabCard's logged-in branch renders FollowButton which calls useRouter() at line 44 of FollowButton.tsx."
  - "Rule 1 auto-fix applied: font-medium → font-semibold in WornCalendar. Same lesson as Phase 39b-02 commit c205617 — tests/no-raw-palette.test.ts forbids font-medium project-wide. UI-SPEC §Per-event content density specified font-medium; ship via font-semibold."

patterns-established:
  - "Pattern: Server-component CTA mounts that need Follow + sign-in branching (LockedTabCard) thread 4 props from the parent server page (viewerId, targetUserId, initialIsFollowing, currentPath). currentPath is always a same-origin pathname constructed from route params, never from headers() or window.location."
  - "Pattern: any component test that transitively renders FollowButton must mock next/navigation (useRouter) AND @/app/actions/follows (followUser, unfollowUser). The mocks must precede the component import per vitest hoist semantics."
  - "Pattern: WornCalendar W1 fix — test-only prop with !== undefined guard pattern is reusable for any client component where production callers should be byte-equivalent to pre-prop baseline but tests need to inject state to drive conditional render paths."

requirements-completed: [DISC-11]

# Metrics
duration: 13m
completed: 2026-05-13
---

# Phase 39b Plan 03: NSV-14 Sub-Cluster Summary

**LockedTabCard inline FollowButton + caption + sign-in Link branches; WornCalendar interactive day cells with wear-detail panel; StatsTabContent WornList Link wraps — turning 3 NSV-14 dead-end sub-cells into actionable affordances.**

## Performance

- **Duration:** 13 min 5 sec
- **Started:** 2026-05-13T18:09:40Z
- **Completed:** 2026-05-13T18:22:52Z
- **Tasks:** 6 (+ 1 Rule 1 auto-fix)
- **Files modified:** 5 (1 new test file)
- **Commits:** 7

## Accomplishments

- **D-39b-12 (LockedTabCard):** Two new render branches replace the dead-end "X keeps their Y private." with an action. Logged-in viewer sees an inline FollowButton + caption; unauthenticated viewer sees a sign-in Link + caption with the encoded returnTo query. Common-ground early-return preserved (Phase 39 D-09 regression guard).
- **T-39b-03 mitigation shipped:** The sign-in Link constructs `href={`/signin?returnTo=${encodeURIComponent(currentPath)}`}` where `currentPath` is built server-side from route params (never an absolute URL). Test #10 of `LockedTabCard.test.tsx` asserts the exact encoded href: `'/signin?returnTo=%2Fu%2Ftyler%2Fcollection'`.
- **D-39b-13 (WornCalendar):** Day cells with `dayEvents.length > 0` are now keyboard-focusable buttons (role + tabIndex + onClick + onKeyDown + aria-label). A wear-detail panel renders below the grid with image + brand + model + notes for the selected day; first event-day is auto-selected on mount; empty-day selection surfaces the "No wear events on {date}." caption. Empty cells stay non-interactive.
- **W1 fix proof:** WornCalendar now exposes a test-only `initialSelectedDate?: string | null` prop with a `!== undefined` guard (the test-only prop NEVER appears in production callers). Tests assert against the rendered DOM via `screen.getByText` with zero `readFileSync` calls — `grep -c "readFileSync" tests/components/profile/WornCalendar.test.tsx` returns 0.
- **W2 fix proof:** `src/app/u/[username]/[tab]/page.tsx` imports `isFollowing` directly from `@/data/follows` (the helper IS exported at line 54; no conditional "if helper exists" branching). Call shape: `viewerId !== null ? await isFollowing(viewerId, profile.id) : false`.
- **D-39b-14 (StatsTabContent):** Both WornList `<li>` rows (Most Worn + Least Worn share a single shared component) wrap content in `<Link href={`/watch/${watch.id}`}>` with `hover:bg-accent rounded-md p-1` (matches Phase 39 D-07 lock verbatim). HorizontalBarChart references count = 3 (unchanged pre→post); chart bars remain non-clickable per D-39b-14 lock.
- **Test transition:**
  - LockedTabCard: 8 → 11 tests (added 3 D-39b-12 it() blocks)
  - WornCalendar: 0 → 3 tests (new file)
  - All 14 added/extended tests green.

## Task Commits

Each task committed atomically:

1. **Task 1: Patch LockedTabCard with FollowButton + sign-in branches** — `9ac3d0f` (feat)
2. **Task 2: Update 4 LockedTabCard mount sites in /u/[username]/[tab]/page.tsx (W2 — deterministic isFollowing helper import)** — `56449f1` (feat)
3. **Task 3: Extend LockedTabCard test with 3 new D-39b-12 assertions** — `b4c2b10` (test)
4. **Task 4: Patch WornCalendar with selectedDate state + day-cell onClick + wear-detail panel + initialSelectedDate test-only prop (W1 fix)** — `f14d429` (feat)
5. **Task 5: Create WornCalendar component test (W1 fix — initialSelectedDate-driven empty-day assertion)** — `b801b82` (test)
6. **Task 6: Wrap StatsTabContent WornList <li> rows in <Link>** — `c50351b` (feat)
7. **Rule 1 auto-fix:** Swap `font-medium` → `font-semibold` in WornCalendar (palette lint) — `049b3f4` (fix)

**Plan metadata commit:** pending (created after this SUMMARY)

## Files Created/Modified

- `src/components/profile/LockedTabCard.tsx` — Extended with 4 new required props (`viewerId`, `targetUserId`, `initialIsFollowing`, `currentPath`); two new JSX branches below the existing lock icon + private copy. Stays a Server Component (no `'use client'`); FollowButton imported as client island per PopularCollectorRow analog (Pitfall 8 honored).
- `src/components/profile/WornCalendar.tsx` — Added `selectedDate` state, mount-time first-event-day effect, interactive day cells (events > 0), wear-detail panel with formatDateLabel helper, test-only `initialSelectedDate` prop with `!== undefined` guard. Preserved existing month-cursor, grid layout, per-cell thumb, `ring-1 ring-accent` today-cell. `'use client'` directive unchanged.
- `src/components/profile/StatsTabContent.tsx` — Added Link import; WornList `<li>` body wrapped in `<Link href={`/watch/${watch.id}`} className="flex items-center gap-3 rounded-md p-1 hover:bg-accent">`. HorizontalBarChart references unchanged (D-39b-14 lock).
- `src/app/u/[username]/[tab]/page.tsx` — Added `import { isFollowing } from '@/data/follows'`. Added `currentPath` (`/u/${username}/${tab}`) and `initialIsFollowing` (deterministic) constants after `settings`. Threaded the 4 new props through 4 LockedTabCard mount sites at lines 162-169 (collection), 175-182 (wishlist), 198-205 (notes), 301-308 (stats).
- `tests/components/profile/LockedTabCard.test.tsx` — Added vi.mock for next/navigation and @/app/actions/follows. Refactored existing 8 tests to spread `baseProps` (viewerId=null keeps them on the unauthenticated branch so existing private-copy assertions still pass; the sign-in CTA renders below but does not interfere with `getByText('...keeps their...private.')`). Appended 3 new D-39b-12 it() blocks.
- `tests/components/profile/WornCalendar.test.tsx` — NEW file. 3 tests: first-event-day on mount, fireEvent.click day-cell-with-events, empty-day caption via `initialSelectedDate="2026-05-12"` (W1 fix — DOM-level assertion, zero readFileSync).

## Decisions Made

- **Plan-stated `/signin` route used despite project actually using `/login`:** The plan, UI-SPEC, threat-model, and Task 3 assertion all specify `/signin?returnTo=...`. The codebase's existing `/login?next=...` is the real proxy redirect target (per `src/proxy.ts:10-14` and `src/app/login/`), but `src/app/watch/new/page.tsx:50` already does `redirect('/signin')` — so the plan is consistent with at least one pre-existing project surface that points at `/signin`. Followed the plan literally; whether `/signin` resolves to a working page is a downstream concern owned by a future plan (likely a thin alias or page that proxies to `/login`). Test assertion `'/signin?returnTo=%2Fu%2Ftyler%2Fcollection'` matches the producer behavior regardless.
- **option (a) chosen for existing test compatibility:** Threaded the 4 new required props through all 8 pre-existing LockedTabCard tests via a shared `baseProps` spread (`viewerId: null, targetUserId, initialIsFollowing: false, currentPath: '/u/tyler/collection'`). `viewerId=null` keeps existing tests on the unauthenticated branch where the lock-icon + private-copy still render unchanged. Cleaner than option (b) (default values on the interface) per plan's preference note.
- **vi.mock placement:** Mocks declared BEFORE the LockedTabCard import (vitest hoist semantics; mirrors `FollowButton.test.tsx:9-18`). Without this, the logged-in test renders FollowButton → `useRouter()` → "invariant expected app router to be mounted" thrown at render time.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] font-medium palette-lint violation in WornCalendar**
- **Found during:** post-Task-6 full-suite run (`npm test`); `tests/no-raw-palette.test.ts > src/components/profile/WornCalendar.tsx does not use /\bfont-medium\b/` failed
- **Issue:** Plan 39b-02 closure (commit `c205617`) established that `font-medium` is forbidden project-wide by `tests/no-raw-palette.test.ts`. The UI-SPEC §Per-event content density (line 360) and §WornCalendar wear-detail panel (line 370) specified `font-medium` for the panel heading and per-event row label — copying the spec verbatim into Task 4 reintroduced the same lint violation.
- **Fix:** Swapped both occurrences to `font-semibold` (the canonical replacement already used by Phase 39b-02 ReferenceIdentityCard headline + StatsTabContent WornList count + FollowButton primary variant).
- **Files modified:** `src/components/profile/WornCalendar.tsx` (lines 249, 275)
- **Verification:** `npx vitest run tests/no-raw-palette.test.ts` — WornCalendar palette test green; the 2 remaining `font-medium` palette failures (`src/components/insights/CollectionFitCard.tsx`, `src/components/search/WatchSearchRow.tsx`) are pre-existing (last touched in Phase 39 and 20.1; never touched by this plan) and out of scope per the executor scope boundary.
- **Committed in:** `049b3f4` (post-Task-6 follow-up commit)

---

**Total deviations:** 1 auto-fixed (1 bug — palette lint regression from UI-SPEC verbatim copy)
**Impact on plan:** Fix is one-line className swap; same lesson as Plan 39b-02 (`c205617`); no scope creep. Future UI-SPEC drafts should consult the palette lint forbidden-weights list before specifying font weights.

## T-39b-03 Mitigation Verification

Producer side (this plan):
- `src/components/profile/LockedTabCard.tsx:88` — `href={`/signin?returnTo=${encodeURIComponent(currentPath)}`}` (encoded at render time)
- `src/app/u/[username]/[tab]/page.tsx:74` — `const currentPath = `/u/${username}/${tab}`` (same-origin pathname built from server-side route params; never `headers()`, never `window.location`)

Test assertion (this plan):
- `tests/components/profile/LockedTabCard.test.tsx:144` — `expect(link.getAttribute('href')).toBe('/signin?returnTo=%2Fu%2Ftyler%2Fcollection')` (encoded form of `/u/tyler/collection` — proves encodeURIComponent wired correctly)

Consumer side (out of scope for this plan):
- Phase 28 D-11 `validateReturnTo` (referenced at `src/lib/watchFlow/destinations.ts:22`) — owned by the `/signin` receiver, rejects absolute URLs and off-origin paths; existing infrastructure.

## D-39b-14 Lock Verification

`grep -c "HorizontalBarChart" src/components/profile/StatsTabContent.tsx`:
- **Pre-patch:** 3 (1 import + 2 JSX renders in Style Distribution + Role Distribution)
- **Post-patch:** 3 (unchanged)

HorizontalBarChart bars verified UNWRAPPED. Only the `WornList` shared component (rendered as Most Worn + Least Worn) receives Link wraps per D-39b-14 lock (chart bars aggregate over multiple watches; no single destination to link to).

## W1 Fix Proof

- `grep -c "readFileSync" tests/components/profile/WornCalendar.test.tsx` returns **0** (no source-file grep fallback)
- `grep 'initialSelectedDate="2026-05-12"' tests/components/profile/WornCalendar.test.tsx` returns 1 (test #3 uses the test-only prop to drive the empty-day code path via the real component conditional)
- `grep 'screen.getByText(/No wear events on /)' tests/components/profile/WornCalendar.test.tsx` returns 1 (DOM-level assertion against the rendered conditional output, not against the source file)
- `grep "initialSelectedDate !== undefined" src/components/profile/WornCalendar.tsx` returns 2 (useState seed guard + useEffect early-return guard); the `!== undefined` (NOT truthiness) check preserves `null` as a valid pre-selected sentinel and keeps production byte-equivalent when the prop is omitted

## W2 Fix Proof

- `grep "import { isFollowing } from '@/data/follows'" 'src/app/u/[username]/[tab]/page.tsx'` returns 1 (deterministic helper import)
- `grep "viewerId !== null ? await isFollowing(viewerId, profile.id) : false" 'src/app/u/[username]/[tab]/page.tsx'` returns 1 (deterministic call shape; no conditional "if helper exists" branching)
- Plan AC stated `targetProfile.id` but the codebase variable is `profile.id` (variable-name mismatch in plan, no semantic difference — the value is the resolved profile owner's UUID either way)

## Per-Task Verification Map

| Plan Task | Acceptance Criteria | Result |
|-----------|---------------------|--------|
| 03-T1 | LockedTabCard extends with 4 props + 2 branches + grep ACs | green |
| 03-T2 | 4 page.tsx mount sites updated + isFollowing import + tsc/build green | green |
| 03-T3 | 11 LockedTabCard tests pass (8 existing + 3 D-39b-12) | green |
| 03-T4 | WornCalendar selectedDate + interactive cells + panel + initialSelectedDate prop + grep ACs | green |
| 03-T5 | 3 WornCalendar tests pass (no readFileSync, screen.getByText assertions) | green |
| 03-T6 | StatsTabContent Link wraps + HorizontalBarChart unchanged | green |

## Issues Encountered

- **next/navigation invariant at first test run:** The logged-in test #9 initially failed with "invariant expected app router to be mounted" because LockedTabCard renders FollowButton which calls `useRouter()`. Resolved by adding `vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))` plus `vi.mock('@/app/actions/follows', ...)` before the component import — pattern cribbed verbatim from `tests/components/profile/FollowButton.test.tsx:9-18`. Documented as a reusable pattern (see "patterns-established" frontmatter and "Decisions Made").
- **font-medium palette lint regression** (Rule 1 fix above) — same lesson as Plan 39b-02; documented as a deviation.

## Pre-existing Out-of-Scope Failures (not introduced by this plan)

These pre-existed before this plan and remain unchanged:
- `tests/no-raw-palette.test.ts > src/components/insights/CollectionFitCard.tsx does not use /\bfont-medium\b/` (file last touched in Phase 39, commit `ef949ec`)
- `tests/no-raw-palette.test.ts > src/components/search/WatchSearchRow.tsx does not use /\bfont-medium\b/` (file last touched in Phase 20.1, commit `0a7e757`)
- The intentional RED from Plan 39b-01 Task 2: `tests/static/hierarchy.lineage-3-node.test.ts > getSameFamilyForCatalog function is exported` (closes in Plan 39b-05)
- 50+ pre-existing test failures (Phase 14, 20.1, 22, 23 RED scaffolds + Phase 39 D-09 walk-back fallback) inherited from STATE pre-plan baseline

Track these in `.planning/phases/39b-audit-driven-discovery-polish-heavier-ux/deferred-items.md` if not already.

## User Setup Required

None — no external service configuration required. All changes are application-code only.

## Next Phase Readiness

- Wave 1 has now shipped 2 of 2 plans (39b-02 closed earlier today at `1c224da`; 39b-03 closing here).
- Wave 2 (depends_on 39b-02): `39b-04` NSV-18 catalog other-owners roster (two-layer privacy) is now unblocked.
- Wave 3 (depends_on 39b-01/02/04): `39b-05` NSV-02/16 lineage rails closes the intentional RED from 39b-01 Task 2.

**Open concerns / next-plan handoff:**
- The `/signin` route assertion in this plan's tests is a literal-string contract. If a future plan replaces `/signin` with `/login` (or builds out a `/signin` alias), it must update both the LockedTabCard producer href construction AND the test assertion.
- The 2 pre-existing `font-medium` palette failures (`CollectionFitCard.tsx`, `WatchSearchRow.tsx`) are eligible for a Plan 39b-x cleanup pass — single-line className swaps each.

## Self-Check: PASSED

Verified files exist:
- FOUND: `src/components/profile/LockedTabCard.tsx`
- FOUND: `src/components/profile/WornCalendar.tsx`
- FOUND: `src/components/profile/StatsTabContent.tsx`
- FOUND: `src/app/u/[username]/[tab]/page.tsx`
- FOUND: `tests/components/profile/LockedTabCard.test.tsx`
- FOUND: `tests/components/profile/WornCalendar.test.tsx`
- FOUND: `.planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-03-SUMMARY.md` (this file)

Verified commits exist:
- FOUND: 9ac3d0f (Task 1: LockedTabCard component patch)
- FOUND: 56449f1 (Task 2: page.tsx 4 mount sites)
- FOUND: b4c2b10 (Task 3: LockedTabCard test extension)
- FOUND: f14d429 (Task 4: WornCalendar component patch)
- FOUND: b801b82 (Task 5: WornCalendar test)
- FOUND: c50351b (Task 6: StatsTabContent Link wrap)
- FOUND: 049b3f4 (Rule 1 auto-fix: font-medium → font-semibold)

---
*Phase: 39b-audit-driven-discovery-polish-heavier-ux*
*Completed: 2026-05-13*
