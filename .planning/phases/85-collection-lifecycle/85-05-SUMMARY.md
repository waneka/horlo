---
phase: 85-collection-lifecycle
plan: 05
subsystem: api
tags: [server-actions, zod, drizzle, disposal, promotion, next-cache]

# Dependency graph
requires:
  - phase: 85-02
    provides: "WatchStatus previously_owned + disposalReason/sellPrice/disposalDate on Watch + mapDomainToRow 'key in data' idiom"
  - phase: 85-03
    provides: "divestments dual-write retired from editWatch; single-table updateWatch is the only write path for a status transition"
  - phase: 85-04
    provides: "repo-wide 'sold' literal sweep closed; npm run build green baseline for Wave 4"
provides:
  - "markWatchPreviouslyOwned Server Action — the disposal dialog's only commit path (LIFE-03 server half)"
  - "editWatch / moveWishlistToCollection return ActionResult<WatchEditResult> ({ watch, promoted, promotedFrom }) — the D-09 promotion signal (LIFE-04 server half)"
  - "editWatch D-07 guard (dialog-only entry into previously_owned) and D-04 undo-nulling + D-02 disposal-field-ignore for non-disposed watches"
  - "addWatch D-07 guard (a new watch can never be created previously_owned)"
  - "src/lib/clientToday.ts — shared isoCalendarDate/isPlausibleClientToday/TODAY_TOLERANCE_MS, extracted from wearEvents.ts"
  - "WatchEditResult + MarkPreviouslyOwnedInput types (src/lib/types.ts)"
affects: [85-06, 85-08, 85-09, 85-10, 85-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client-owns-today date validation shared across Server Actions: isoCalendarDate zod schema + isPlausibleClientToday (±14h server-UTC bound) + lexical disposalDate > today string comparison — never derive 'today' server-side (260622-exo)."
    - "Disposal-field 'key in data' idiom reused at the Server Action layer (not just the DAL): editWatch deletes/re-adds disposalReason/sellPrice/disposalDate keys on cleanData BEFORE the existing sort-bump/DISP-02 spreads so those later spreads never reintroduce a stripped or force-nulled key."

key-files:
  created:
    - src/lib/clientToday.ts
    - src/app/actions/__tests__/watches-lifecycle.test.ts
  modified:
    - src/app/actions/wearEvents.ts
    - src/lib/types.ts
    - src/app/actions/watches.ts
    - src/app/actions/__tests__/moveWishlistToCollection.test.ts
    - tests/actions/watches.test.ts
    - tests/actions/watches.notesPublic.test.ts

key-decisions:
  - "markWatchPreviouslyOwned is a dedicated action (not a thin editWatch wrapper) — keeps 'reason required + only from owned' explicit and lets editWatch hard-reject transitions into previously_owned (D-07), per the plan's own discretion note."
  - "markWatchPreviouslyOwned's D-08 fan-out uses updateTag('profile:<username>') (read-your-own-writes, Phase 84 logBackfillWear precedent) instead of revalidateTag(tag,'max') so the card leaves the grid immediately for the owner who stays on the tab."
  - "editWatch's D-07/D-04/D-02 disposal-field block runs on cleanData BEFORE the Phase 27 sort-bump and DISP-02 canonical-overwrite blocks, since both later blocks spread from cleanData/updatePayload — running the disposal edits first guarantees those spreads can never reintroduce a key this block deleted or forced to undefined."
  - "LIFE-03/LIFE-04 stay unmarked (Pending) in REQUIREMENTS.md despite being in this plan's frontmatter requirements list — both requirement descriptions are user-facing ('mark from its collection card', 'sees a celebration moment') and this plan ships only the server contract those UI plans (85-08 dialog, 85-06/85-09 celebration) consume, matching the 84-02 precedent (WEAR-02 stayed unmarked until its client half shipped)."

patterns-established:
  - "Server Action disposal-field ignore/undo/guard block runs before any later payload-mutating block in the same function — a general shape for 'field X is only ever writable under condition Y' rules layered onto an existing multi-branch editWatch-style action."

requirements-completed: []

# Metrics
duration: ~50min
completed: 2026-09-14
---

# Phase 85 Plan 05: Server-side lifecycle contract Summary

**New `markWatchPreviouslyOwned` Server Action plus `editWatch`/`addWatch`/`moveWishlistToCollection` disposal guards and a D-09 promotion signal — the trust-boundary half of LIFE-03/LIFE-04, with zero UI yet.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 3 (Task 1 auto, Task 2 auto+tdd, Task 3 auto+tdd)
- **Files modified:** 8 (2 created, 6 modified)

## Accomplishments

- `src/lib/clientToday.ts` now holds `isoCalendarDate` / `isPlausibleClientToday` / `TODAY_TOLERANCE_MS`, moved verbatim out of `wearEvents.ts` (a `'use server'` file can only export async functions) so the Phase 85 disposal actions can import the same client-owns-"today" validators `logBackfillWear` already relies on.
- `markWatchPreviouslyOwned` is a new, dedicated Server Action: auth → `.strict()` zod (mass-assignment guard, T-85-10) → client-today plausibility bound (T-85-09) → `disposalDate > today` lexical rejection → IDOR-scoped `getWatchById` (T-85-08) → already-disposed idempotent no-op (T-85-13) → owned-only status guard → single-table `updateWatch` (D-03: no transaction, no historical dual-write) → the full D-08 cache fan-out (`revalidatePath('/')`, `updateTag(viewer:<id>:recs)`, `revalidatePath('/u/[username]','layout')`, `updateTag(profile:<username>)`, `revalidateTag('explore','max')`).
- `editWatch` and `moveWishlistToCollection` both now return `ActionResult<WatchEditResult>` (`{ watch, promoted, promotedFrom }`). `editWatch` detects a wishlist/grail→owned promotion off the prior row; `moveWishlistToCollection`'s wishlist branch is always a promotion (grail is already rejected upstream, T-70-03), and its idempotent already-owned branch reports `promoted: false`.
- `editWatch` rejects any client-driven transition INTO `previously_owned` with `'Use "Mark as previously owned" to record a watch leaving your collection.'` (D-07) and `addWatch` rejects `status: 'previously_owned'` outright with `'New watches can not be added as previously owned.'`.
- On an already-disposed watch, `editWatch` re-validates a `disposalDate` edit against a client-supplied `today` the same way `markWatchPreviouslyOwned` does, and refuses to let a bare `disposalReason: undefined` key clear the reason (D-04's mirror case — the watch is still disposed, only its metadata is being corrected). When the watch is leaving `previously_owned` (undo), all three disposal keys are forced to `undefined` regardless of what the client sent (D-04). When the watch neither is nor is becoming `previously_owned`, the three disposal keys are dropped from the payload entirely (D-02).
- New test file `src/app/actions/__tests__/watches-lifecycle.test.ts` (26 tests) covers every `<behavior>` case from the plan for all four actions.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract client-today validators + add WatchEditResult/MarkPreviouslyOwnedInput** - `0d3afd28` (refactor)
2. **Task 2: markWatchPreviouslyOwned Server Action** - `e3fe1430` (feat)
3. **Task 3: Promotion signal, D-04 undo, D-07 guard** - `ab911356` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/lib/clientToday.ts` - shared `isoCalendarDate` / `isPlausibleClientToday` / `TODAY_TOLERANCE_MS`, moved out of `wearEvents.ts`
- `src/app/actions/wearEvents.ts` - local definitions removed; imports the shared module instead
- `src/lib/types.ts` - `WatchEditResult` + `MarkPreviouslyOwnedInput` interfaces
- `src/app/actions/watches.ts` - `markWatchPreviouslyOwned` action; `editWatch`/`addWatch`/`moveWishlistToCollection` D-02/D-04/D-07/D-09 logic; schema additions
- `src/app/actions/__tests__/watches-lifecycle.test.ts` - new LIFE-02/03/04 server contract tests (26 cases)
- `src/app/actions/__tests__/moveWishlistToCollection.test.ts` - `.data` assertions updated to `.data.watch`/`.promoted`/`.promotedFrom`; `updateTag` mock added
- `tests/actions/watches.test.ts` - `updateTag` mock added
- `tests/actions/watches.notesPublic.test.ts` - `updateTag` mock added

## Decisions Made

See `key-decisions` in frontmatter. Additionally: LIFE-03/LIFE-04 are intentionally left `Pending` in `.planning/REQUIREMENTS.md` — the disposal dialog UI (85-08), the promotion celebration UI (85-06/85-09), and the edit-form disposal fields (85-10) all consume the signatures this plan built but have not shipped yet, so the user-facing requirement text isn't true yet. LIFE-02 was already marked complete by 85-02 and is unaffected by this plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `markWatchPreviouslyOwned`'s own doc comments tripped this task's forward-armor grep**
- **Found during:** Task 3's acceptance-criteria verification (`grep -c "divestments" src/app/actions/watches.ts` expected `0`)
- **Issue:** Task 2's `markWatchPreviouslyOwned` doc comments used the literal word "divestments" in a negation ("no `db.transaction`, no divestments insert") to explain D-03. That's the same grep-armor pitfall 85-03/85-04 already hit — a comment describing what ISN'T there still contains the literal substring a later forward-armor check scans for.
- **Fix:** Reworded both occurrences to non-literal prose ("no transaction, no historical dual-write to the retired disposal-tracking table"). Comment-only change; no behavior touched.
- **Files modified:** `src/app/actions/watches.ts`
- **Verification:** `grep -c "divestments" src/app/actions/watches.ts` → `0`; targeted vitest re-run unaffected (still 12/12 `markWatchPreviouslyOwned` cases green).
- **Committed in:** `ab911356` (Task 3 commit)

**2. [Rule 3 - Blocking fix] Three test files' `next/cache` mocks were missing an `updateTag` stub**
- **Found during:** Task 3's required test run (`tests/actions/watches.test.ts`, `tests/actions/watches.notesPublic.test.ts`, `src/app/actions/__tests__/moveWishlistToCollection.test.ts`)
- **Issue:** `addWatch`/`editWatch`/`moveWishlistToCollection` have called `updateTag(\`viewer:${id}:recs\`)` unconditionally since Phase 75, but these three files' `vi.mock('next/cache', ...)` blocks never stubbed `updateTag`. Every happy-path call threw inside the real (unmocked) `next/cache` `updateTag` — which requires a live Server Action/cache-scope context absent in a unit test — and was swallowed by each action's outer `try/catch`, silently flipping `result.success` to `false`. This is the exact pre-existing gap 85-03's and 85-04's SUMMARYs already logged as out-of-scope baseline noise (9 + 2 failing tests respectively).
- **Fix:** Added `updateTag: vi.fn()` to each file's `next/cache` mock, with a comment explaining the root cause and pointing at the prior SUMMARYs. No assertion logic changed — this plan's own test files needed all three green per its acceptance criteria and the orchestrator's explicit Rule-3 authorization to fix exactly this.
- **Files modified:** `tests/actions/watches.test.ts`, `tests/actions/watches.notesPublic.test.ts`, `src/app/actions/__tests__/moveWishlistToCollection.test.ts`
- **Verification:** All 5 required test files pass in full (74/74 tests) after the fix; `npm run build` exits 0.
- **Committed in:** `ab911356` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 1 grep-armor comment reword, 1 Rule 3 pre-existing mock-gap fix affecting 3 files).
**Impact on plan:** Both were necessary for this plan's own stated acceptance criteria (forward-armor grep = 0; the five listed test files pass) — no scope creep beyond what the plan and the orchestrator's Rule-3 carve-out explicitly called for.

## Issues Encountered

None beyond the two documented deviations above. `WatchForm.tsx`, `AddWatchFlow.tsx`, and `WatchDetailHero.tsx` (the three non-test callers of `editWatch`/`moveWishlistToCollection`/`addWatch`) all compile unchanged — none of them destructure `result.data` as a bare `Watch` for the two functions whose return shape widened; `WatchForm.tsx`'s `'id' in result.data` narrowing is on `addWatch`'s (unchanged) return, not `editWatch`'s.

## User Setup Required

None - no external service configuration required.

## Verification

- `npx vitest run tests/actions/wearEventsBackfill.test.ts` — 15/15 pass (Task 1 gate; confirms the moved date helpers didn't regress the Phase 84 backfill action).
- `npx vitest run src/app/actions/__tests__/watches-lifecycle.test.ts` — 26/26 pass.
- `npx vitest run src/app/actions/__tests__/watches-lifecycle.test.ts src/app/actions/__tests__/moveWishlistToCollection.test.ts src/app/actions/__tests__/watches-recs-invalidation.test.ts tests/actions/watches.test.ts tests/actions/watches.notesPublic.test.ts` — 74/74 pass.
- `npm run build` — exit code 0 (captured directly), confirmed twice. `✓ Compiled successfully`, `Finished TypeScript`, all 36 routes generated.
- Acceptance-criteria greps: `export async function markWatchPreviouslyOwned` = 1; `"Disposal date can't be in the future."` = 1; `todayLocalISO` in `watches.ts` = 0; `Promise<ActionResult<WatchEditResult>>` = 2; `"New watches can not be added as previously owned."` = 1; `'Use "Mark as previously owned" to record a watch leaving your collection.'` = 1; `divestments` = 0 (after the Rule 1 fix); `export interface WatchEditResult` / `export interface MarkPreviouslyOwnedInput` in `types.ts` = 1 each.

## Next Phase Readiness

- The server-side lifecycle contract is complete and compiling: `markWatchPreviouslyOwned`, `editWatch`, `addWatch`, and `moveWishlistToCollection` all enforce their respective D-02/D-03/D-04/D-05/D-06/D-07/D-08/D-09 rules and are unit-tested.
- 85-08 (disposal dialog) can call `markWatchPreviouslyOwned` directly with a `MarkPreviouslyOwnedInput`.
- 85-06/85-09 (celebration) can read `result.data.promoted` / `result.data.promotedFrom` off `editWatch`'s and `moveWishlistToCollection`'s resolved `ActionResult<WatchEditResult>` — no further server work needed for the signal itself.
- 85-10 (edit form) can rely on the server already refusing a client-driven `previously_owned` transition and already ignoring/undoing disposal fields per D-02/D-04 — the form only needs to stop *offering* `previously_owned` in its status `<Select>` (UI-only, D-07's client half).
- LIFE-03/LIFE-04 remain `Pending` in REQUIREMENTS.md until those UI plans land.

---
*Phase: 85-collection-lifecycle*
*Completed: 2026-09-14*

## Self-Check: PASSED

- FOUND: src/lib/clientToday.ts
- FOUND: src/app/actions/__tests__/watches-lifecycle.test.ts
- FOUND: src/app/actions/watches.ts
- FOUND: src/lib/types.ts
- FOUND: src/app/actions/wearEvents.ts
- FOUND: .planning/phases/85-collection-lifecycle/85-05-SUMMARY.md
- FOUND commit: 0d3afd28 (Task 1)
- FOUND commit: e3fe1430 (Task 2)
- FOUND commit: ab911356 (Task 3)
