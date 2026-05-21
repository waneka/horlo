---
phase: 51-profile-route-ppr-opt-out-recurrence-3-fix-for-u-username-ta
plan: 02
subsystem: ui
tags: [next16, ppr, cache-components, profile-route, server-components, react-19, phase-39c, pitfall-1]

# Dependency graph
requires:
  - phase: 51
    provides: "51-01 test scaffold (tests/profile-route-51.test.ts) — Test 2 (REQ-51-05) is the structural assertion this plan turns from RED to GREEN"
  - phase: 39c
    provides: "Phase 39c Pitfall 1 (D-39c-03) convention that viewerId must stay outside the cached scope — this plan reinforces it structurally"
provides:
  - "ProfileGate now accepts viewerId: string | null as a typed prop"
  - "ProfileGate no longer imports or calls getCurrentUser / UnauthorizedError"
  - "Pitfall 1 (viewerId outside cached scope) becomes a STRUCTURAL invariant — the gate physically cannot read cookies"
  - "Prerequisite for plan 51-03 (page-owned cookie read + gate composition)"
affects:
  - "51-03 (layout collapse + page-owned composition) — REQUIRED IMMEDIATE FOLLOW-UP; without it, layout.tsx fails TypeScript compilation"
  - "v6.0 social interaction features (depend on profile route stability)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure async server-component function: gate as f(username, viewerId, children)"
    - "Structural enforcement of Phase 39c Pitfall 1 (no cookie API surface inside gate)"

key-files:
  created: []
  modified:
    - "src/app/u/[username]/profile-gate.tsx — signature change to accept viewerId prop; removed @/lib/auth import; updated JSDoc invariants"

key-decisions:
  - "Updated PROHIBITED item (c) in JSDoc to drop the literal getCurrentUser() text — required for Test 2's source.includes('getCurrentUser()') === false assertion to pass. Replaced with 'Reading cookies via any means' wording that preserves prohibition intent and adds a fourth PROHIBITED item barring @/lib/auth import. This is a minor wording deviation from the plan's 'keep all four items, do NOT add getCurrentUser to the prohibited list' guidance — the plan's literal instruction would have conflicted with the test contract. Spirit of the plan preserved: the prohibition is stricter, not weaker."

patterns-established:
  - "Pitfall 1 as a structural lock: when a gate must keep viewer state outside a cached scope, prefer prop-injection over internal cookie reads — the type system enforces the invariant"

requirements-completed: [REQ-51-05]

# Metrics
duration: ~5min
completed: 2026-05-21
---

# Phase 51 Plan 02: ProfileGate viewerId Prop Refactor Summary

**ProfileGate refactored to accept `viewerId: string | null` as a typed prop, removing the internal `getCurrentUser()` cookie read and elevating Phase 39c Pitfall 1 from a documented convention to a structural invariant.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-21T00:41:00Z
- **Completed:** 2026-05-21T00:43:00Z
- **Tasks:** 1 (TDD: RED already in place via plan 51-01, GREEN executed here)
- **Files modified:** 1

## Accomplishments

- Removed `import { getCurrentUser, UnauthorizedError } from '@/lib/auth'` from `profile-gate.tsx`
- Added `viewerId: string | null` to `ProfileGate`'s destructured props and type signature
- Deleted the internal `let viewerId / try { ... } catch (UnauthorizedError) { ... }` block
- Updated JSDoc header to reflect the new structural invariant: gate physically cannot read cookies
- Test 2 (REQ-51-05) `tests/profile-route-51.test.ts` flipped from RED to GREEN
- Test 3 (REQ-51-06) continues to PASS (resolver unchanged)

## Task Commits

1. **Task 1: Refactor ProfileGate to accept viewerId as a prop** — `1c01985` (refactor)

The commit message includes the literal `[DO NOT PUSH ALONE]` marker per the plan's atomic-commit contract. Plans 51-02 + 51-03 are a single atomic unit; layout.tsx will be in temporarily broken TypeScript state until 51-03 lands.

## Files Created/Modified

- `src/app/u/[username]/profile-gate.tsx` — Removed `@/lib/auth` import; new prop signature `{ username, viewerId, children }` with `viewerId: string | null`; deleted internal viewer-resolution try/catch; updated JSDoc to declare Pitfall 1 as a structural invariant; everything from `await ProfileShellResolver({ username })` downward is byte-identical to the prior state

## Decisions Made

- **JSDoc PROHIBITED list wording adjustment** — see `key-decisions` in frontmatter. The plan said "keep all four items; do NOT add `getCurrentUser` to the prohibited list," but the existing item (c) read `Reading cookies via any means other than the `getCurrentUser()` try/catch` — the literal `getCurrentUser()` substring there would have made Test 2's `source.includes('getCurrentUser()')` assertion fail. Resolved by rewording item (c) to `Reading cookies via any means — viewer identity arrives via the viewerId prop and is the page's responsibility` and adding a new item (d) prohibiting imports from `@/lib/auth`. Test contract is the verifiable gate (REQ-51-05); preserved its intent (no cookie reads in gate, stricter prohibition than before).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] JSDoc PROHIBITED item (c) wording conflicted with Test 2 contract**

- **Found during:** Task 1 (TDD GREEN step — first test run after edit)
- **Issue:** Plan instructed to "keep all four items" of the PROHIBITED list (which had only three items, the third referencing `getCurrentUser()` literally). Test 2 asserts `source.includes('getCurrentUser()') === false` — leaving that comment would have kept Test 2 in RED state and failed the plan's `<done>` criteria.
- **Fix:** Reworded item (c) to remove the literal `getCurrentUser()` substring (`Reading cookies via any means — viewer identity arrives via the viewerId prop and is the page's responsibility`). Added a new item (d) prohibiting imports from `@/lib/auth` — strictly tighter than the original, in line with the structural-Pitfall-1 intent of the refactor.
- **Files modified:** `src/app/u/[username]/profile-gate.tsx`
- **Verification:** `npm test -- tests/profile-route-51.test.ts --run` → Test 2 (REQ-51-05) PASSES; Test 3 (REQ-51-06) continues to PASS; Test 1 (REQ-51-04) remains expected-failing (fixed by plan 51-03)
- **Committed in:** `1c01985` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Zero scope change — the deviation is a single comment-text adjustment that resolves an internal conflict between plan prose and test contract. Test contract treated as authoritative per planner rules (verifiable gate beats prose). Spirit of the prohibition list is preserved and strengthened.

## Issues Encountered

- None beyond the deviation above. The TDD cycle ran cleanly: RED confirmed before edit, GREEN confirmed after edit on second test run.

## Caller Wiring Deferred to 51-03

Per the plan's `<plan_scope_lock>`, this plan does NOT touch `src/app/u/[username]/layout.tsx`. After this commit, `layout.tsx` calls `<ProfileGate username={username}>{children}</ProfileGate>` without the new required `viewerId` prop. TypeScript compilation of `layout.tsx` will fail. This is **expected and documented**:

- The commit message includes the literal marker `[DO NOT PUSH ALONE]`
- Plan 51-03 restructures the layout + page to (a) move cookie-reading into `[tab]/page.tsx` (the runtime-API consumer) and (b) pass `viewerId` to the gate
- Plans 51-02 and 51-03 are a single atomic unit; together they must land in one PR (or be squashed locally) before any push to `origin/main`

Per the plan's executor gate: **DO NOT push this commit to origin alone.** Verify the branch also contains 51-03's commit before push.

## Test Status After This Plan

| Test | REQ | Status After 51-02 | Notes |
|------|-----|---------------------|-------|
| Test 1: layout does not Suspense-wrap ProfileGate | REQ-51-04 | RED (expected) | Fixed by plan 51-03 |
| Test 2: ProfileGate accepts viewerId as a prop | REQ-51-05 | **GREEN** | This plan's target |
| Test 3: ProfileShellResolver remains cached | REQ-51-06 | GREEN (unchanged) | Resolver unmodified by this plan |

## Known Stubs

None. No placeholder data, no hardcoded empty values, no "TODO" / "coming soon" markers introduced.

## Threat Flags

None. No new network endpoints, auth paths, file-access patterns, or trust-boundary schema changes. The change is a pure refactor that **tightens** an existing security-relevant invariant (Pitfall 1: viewer state out of cached scope) by making it structural.

## TDD Gate Compliance

This plan is a `tdd="true"` task within a non-TDD plan (no plan-level RED/GREEN/REFACTOR sequence required). The cycle ran as:

1. RED: Confirmed via `npm test -- tests/profile-route-51.test.ts --run` BEFORE the edit (Test 2 failing on `getCurrentUser` substring match)
2. GREEN: Source edit applied, test re-run confirmed Test 2 passing
3. Single commit `refactor(51-02): ...` covers the change (RED was authored in plan 51-01, so no separate `test(...)` commit needed in this plan)

## Next Phase Readiness

- Plan 51-03 is unblocked and depends on this commit (`1c01985`)
- 51-03 will pass `viewerId` from `[tab]/page.tsx` into `<ProfileGate>` and restore TypeScript buildability
- The atomic-commit contract MUST be honored: do NOT push `1c01985` to `origin/main` without 51-03's commit on the same branch

## Self-Check: PASSED

- File `src/app/u/[username]/profile-gate.tsx` exists at expected path: FOUND
- Commit `1c01985` exists in git log: FOUND (`refactor(51-02): ProfileGate accepts viewerId as a typed prop [DO NOT PUSH ALONE]`)
- Test 2 (REQ-51-05) passes: VERIFIED via `npm test -- tests/profile-route-51.test.ts --run` (Tests 2, 3 pass; Test 1 expected RED)
- `grep -c "getCurrentUser" src/app/u/[username]/profile-gate.tsx` → 0: VERIFIED
- `grep -c "UnauthorizedError" src/app/u/[username]/profile-gate.tsx` → 0: VERIFIED
- `grep -c "@/lib/auth" src/app/u/[username]/profile-gate.tsx` → 1 (in PROHIBITED comment, not an import): ACCEPTABLE — no actual import statement

---
*Phase: 51-profile-route-ppr-opt-out-recurrence-3-fix-for-u-username-ta*
*Completed: 2026-05-21*
