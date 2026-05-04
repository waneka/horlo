---
phase: 27-watch-card-collection-render-polish
plan: 03
subsystem: server-actions
tags: [server-action, zod, mass-assignment-defense, owner-enforcement, revalidate-path, wishlist-reorder, wave-3]

# Dependency graph
requires:
  - phase: 27-watch-card-collection-render-polish
    plan: 01
    provides: "src/app/actions/__tests__/reorderWishlist.test.ts — 7-case Wave 0 RED Server Action surface contract that this plan turns GREEN"
  - phase: 27-watch-card-collection-render-polish
    plan: 02
    provides: "bulkReorderWishlist(userId, orderedIds) DAL helper — owner-scoped CASE WHEN bulk update with ::int4 cast + Owner mismatch defense (T-27-01, T-27-02). reorderWishlist delegates to it."
provides:
  - "reorderWishlist(data: unknown): Promise<ActionResult<void>> — Server Action exported from src/app/actions/wishlist.ts. The network boundary the wishlist drag UX (Plan 05) calls."
  - "Three-layer owner-only enforcement for bulk reorder: (1) Zod .strict() rejects extra payload keys; (2) getCurrentUser is sole userId source; (3) DAL WHERE clause + count-check throws on any forged/foreign id."
  - "T-27-03 DoS mitigation — orderedIds capped at 500 entries via Zod .max(500); matches v4.1 <500 watches/user scale ceiling."
  - "T-27-NEW-01 verbose-error mitigation — DAL Error.message never echoed verbatim; only classified into 'Some watches do not belong to you.' (Owner mismatch) or generic \"Couldn't save new order.\""
affects: [27-05-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server Action error mapping via ActionResult<T> discriminated union — never throw across the boundary (matches addToWishlistFromWearEvent shape in same file)"
    - "Zod .strict() + server-sourced userId as composite mass-assignment defense (T-10-03-04 pattern from existing schema, reused for T-27-01)"
    - ".max(500) array length cap on Zod inputs as DoS-class mitigation aligned with the project's per-user-watches scale constraint"
    - "Static import of bulkReorderWishlist DAL helper alongside existing createWatch import — readability over the dynamic-import hedge"
    - "instanceof Error narrowing + message.startsWith('Owner mismatch') for DAL classification without re-exposing internal details to the client"

key-files:
  created: []
  modified:
    - "src/app/actions/wishlist.ts (added reorderWishlist export + reorderWishlistSchema; widened existing createWatch import to also pull bulkReorderWishlist)"
    - "src/app/actions/__tests__/reorderWishlist.test.ts (Rule 1 fix: VALID_UUID fixture from all-1s to RFC 4122 strict v4 — Zod 4 z.string().uuid() requires version 1-8 + variant 8/9/a/b)"

key-decisions:
  - "Static vs dynamic import of bulkReorderWishlist — chose STATIC. Plan permitted either; static is one line, mirrors existing createWatch import shape, and avoids the `await import()` indirection. No bundling concern at this scale."
  - "Zod 4's z.string().uuid() enforces RFC 4122 strict v4 format (version digit 1-8, variant 8/9/a/b). Plan 01's VALID_UUID = '11111111-1111-1111-1111-111111111111' fails that pattern. Updated to '11111111-1111-4111-8111-111111111111' (Rule 1 — bug in test fixture)."
  - "revalidatePath('/u/[username]/wishlist', 'page') — used the dynamic-segment placeholder form per Next.js 16 docs; the second arg 'page' invalidates the entire page-level render. Pattern parallels addToWishlistFromWearEvent's revalidatePath('/') in the same file."
  - "ActionResult<void> chosen over ActionResult — explicit `void` keeps the discriminated-union narrowing tight at consumer sites (the drag UX in Plan 05) and matches the test's `data: undefined` assertion."

patterns-established:
  - "Phase 27 wave-3 unblock pattern — RED test from Plan 01 + DAL helper from Plan 02 = single-task Server Action wrapping plan that goes GREEN in one commit"
  - "Three-layer owner-only enforcement on Server Action boundaries: Zod strict (no userId in payload) + session-sourced userId + DAL count-check"
  - "When DAL throws domain-meaningful errors, classify via instanceof Error + message prefix matching, NEVER echo the raw message — keeps the threat model T-27-NEW-01 intact"

requirements-completed: [WISH-01]

# Metrics
duration: 5min
completed: 2026-05-04
---

# Phase 27 Plan 03: reorderWishlist Server Action Surface Summary

**reorderWishlist Server Action exported with Zod .strict() + getCurrentUser + bulkReorderWishlist delegation; Plan 01's 7-case Wave 0 RED contract goes from RED to GREEN (7/7).**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-04T08:13:48Z
- **Completed:** 2026-05-04T08:18:19Z
- **Tasks:** 1 (type=auto, tdd=true — Wave 0 RED test from Plan 01 was the precondition)
- **Files touched:** 2 (modified)
- **Commits:** 1

## Accomplishments

- **reorderWishlist Server Action** appended to `src/app/actions/wishlist.ts` (after the existing `addToWishlistFromWearEvent` at line 149). The export validates payloads, authenticates the caller, delegates to the Plan 02 DAL helper, and maps errors into the `ActionResult<void>` shape — never throwing across the boundary.
- **Three-layer owner-only enforcement** in place:
  1. Zod `.strict()` schema (`reorderWishlistSchema`) rejects payloads with any key other than `orderedIds` — `userId` can NEVER come from the client.
  2. `getCurrentUser()` from `src/lib/auth.ts` is the sole source of `userId` for the DAL call.
  3. `bulkReorderWishlist(user.id, parsed.data.orderedIds)` enforces a WHERE clause + post-update count-check at the DAL layer; throws `"Owner mismatch: …"` if any input id is foreign or status-confused.
- **T-27-03 DoS mitigation:** `z.array(z.string().uuid()).min(1).max(500)` caps the orderedIds length. Aligns with the project's `<500 watches per user` v4.1 scale ceiling.
- **T-27-NEW-01 information-disclosure mitigation:** DAL `Error.message` is never echoed to the client. Only two user-visible error messages are surfaced: `"Some watches do not belong to you."` (Owner mismatch branch) and `"Couldn't save new order."` (generic catch-all). `console.error` keeps server-side debugging context.
- **revalidatePath('/u/[username]/wishlist', 'page')** invalidates the dynamic wishlist tab route on the happy path. Pattern matches `addToWishlistFromWearEvent`'s `revalidatePath('/')` in the same file.
- **Plan 01 surface test (7/7) now GREEN** — every Wave 0 it() block in `src/app/actions/__tests__/reorderWishlist.test.ts` passes.
- **No bundle/dependency churn** — static import of `bulkReorderWishlist` extends the existing `createWatch` import line; no new packages, no `package.json` change.

## Task Commits

1. **Task 1: Append reorderWishlist Server Action to src/app/actions/wishlist.ts** — `55ce804` (feat)

_Note: Plan 27-03 type=execute (single-task), task tdd=true; the RED test was already authored in Plan 01 commit `68bdbdb`. This plan is the GREEN commit. There was no separate REFACTOR step — the implementation landed clean and minimal in one commit._

## Files Created/Modified

### Modified

- `src/app/actions/wishlist.ts` — Two edits:
  1. **Line 10 (import widening):** `import { createWatch } from '@/data/watches'` → `import { createWatch, bulkReorderWishlist } from '@/data/watches'`. Static import preserves the file's existing import-block shape.
  2. **Lines 151-209 (new export):** Appended `reorderWishlistSchema` (Zod object with `.strict()` + `.min(1).max(500)`) and `export async function reorderWishlist(data: unknown): Promise<ActionResult<void>>`. The existing `addToWishlistFromWearEvent` export (lines 44-149) is untouched. The `'use server'` file directive at line 1 is preserved.
- `src/app/actions/__tests__/reorderWishlist.test.ts` — One edit (Rule 1 fix):
  - **Line 29 (VALID_UUID fixture):** `'11111111-1111-1111-1111-111111111111'` → `'11111111-1111-4111-8111-111111111111'`. The all-1s string fails Zod 4's strict RFC 4122 v4 regex (version digit must be 1-8, variant must be 8/9/a/b). Fixed in place with a comment explaining the version+variant requirement.

## Decisions Made

- **Static import of `bulkReorderWishlist` (chose static over dynamic).** Plan permitted either. The static one-liner reads cleaner, mirrors the existing `createWatch` import shape, and avoids the runtime `await import()` indirection. No bundling concern at this scale (`bulkReorderWishlist` is server-only and only ~30 lines).
- **`revalidatePath('/u/[username]/wishlist', 'page')` form.** Used the literal dynamic-segment placeholder (`[username]`) rather than a concrete username — Next.js 16 strips the params from dynamic-route revalidation paths, and the `'page'` second arg invalidates the page-level render scope. Pattern parallels `addToWishlistFromWearEvent`'s `revalidatePath('/')` in the same file.
- **Error classification via `instanceof Error` + `message.startsWith('Owner mismatch')`.** The DAL throws a single Error subtype with a stable prefix; the action layer recognizes that prefix and maps to the user-visible owner-mismatch message. Any other DAL throw (DB errors, transient failures) falls through to the generic `"Couldn't save new order."` — keeping the T-27-NEW-01 information-disclosure boundary intact.
- **`Promise<ActionResult<void>>` over `Promise<ActionResult>`.** Explicit `void` keeps the discriminated-union narrowing tight at consumer sites (the drag UX in Plan 05) and matches the test's `expect(result.data).toBeUndefined()` assertion.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan 01's VALID_UUID test fixture fails Zod 4's strict RFC 4122 v4 validator**

- **Found during:** Task 1 (running the Plan 01 surface test after the implementation landed)
- **Issue:** `VALID_UUID = '11111111-1111-1111-1111-111111111111'` was the fixture used by 2 of the 7 test cases (happy path + owner-mismatch). Zod 4's `z.string().uuid()` enforces strict RFC 4122 v4: version digit (third group's first char) must be 1-8 and variant digit (fourth group's first char) must be 8/9/a/b. The all-1s string fails both checks, so both tests reached the `.safeParse` failure branch and asserted on the wrong error code. Pre-fix: 5/7 GREEN, 2/7 RED with `expected 'Invalid request' to be 'Some watches do not belong to you.'` and `expected false to be true`.
- **Fix:** Updated `VALID_UUID` to `'11111111-1111-4111-8111-111111111111'` (version digit `4`, variant digit `8`). Added a code comment explaining the version+variant requirement and pointing back to Zod 4's strict regex. The 501-element `tooManyIds` test was already using `randomUUID()` (which always returns valid v4) — no fix needed there.
- **Files modified:** `src/app/actions/__tests__/reorderWishlist.test.ts` (line 29 + new comment block)
- **Verification:** Re-ran `npx vitest run --reporter=dot src/app/actions/__tests__/reorderWishlist.test.ts` — `Tests 7 passed (7)`.
- **Committed in:** `55ce804` (Task 1 commit, alongside the production code)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in Plan 01 test fixture).
**Impact on plan:** Zero scope creep. The fix was confined to a single literal string + comment in the test file. The Server Action implementation matched Plan 03's PATTERNS.md excerpt verbatim.

## Threat Model Verification

| Threat ID | Disposition | Test that proves the mitigation |
|-----------|-------------|---------------------------------|
| T-27-01 (cross-tenant reorder) | mitigate | `rejects payloads with extra keys (.strict() — D-10 mass-assignment defense)` — extra `userId` payload key triggers Zod failure → returns `'Invalid request'` |
| T-27-02 (status-confused reorder) | mitigate | Owned by Plan 02's DAL count-check; surfaces here as `owner-mismatch from DAL → action returns "Some watches do not belong to you."` — action correctly classifies the throw |
| T-27-03 (DoS via mass enumeration) | mitigate | `rejects payloads exceeding 500 orderedIds (T-27-03 length cap → "Invalid request")` — 501-element `randomUUID()` array triggers Zod `.max(500)` failure |
| T-27-NEW-01 (verbose-error info disclosure) | mitigate | `owner-mismatch from DAL → action returns "Some watches do not belong to you."` — confirms the DAL message is NOT echoed; only the classified user-visible string is returned |
| T-27-04 (concurrent reorder race) | accept | CONTEXT D-09 explicitly accepts last-write-wins at v4.1 scale; not a code-level concern |

`addToWishlistFromWearEvent` was NOT touched (verified: `grep -c "export async function addToWishlistFromWearEvent" == 1`). Its threat model (T-10-03-04 mass-assignment, three-tier visibility gate) is preserved.

## Test Suite Health

- **Plan 01 surface test (`src/app/actions/__tests__/reorderWishlist.test.ts`):** 7/7 GREEN (was 7/7 RED pre-Plan-03).
- **No regressions:** `addToWishlistFromWearEvent` import preserved; existing `schema` const for `wearEventId` untouched; `'use server'` directive preserved.
- **TypeScript:** `npx tsc --noEmit` reports no new errors in `src/app/actions/wishlist.ts`. Pre-existing TS errors in unrelated test files (RecentlyEvaluatedRail, DesktopTopNav, PreferencesClient debt-01, etc.) are out-of-scope and pre-date this plan.
- **ESLint:** Clean on both modified files.

## Acceptance Criteria

All Plan 03 acceptance criteria pass:

| # | Criterion | Result |
|---|-----------|--------|
| 1 | `grep -c "export async function reorderWishlist"` == 1 | 1 ✓ |
| 2 | `grep -c "reorderWishlistSchema"` >= 2 | 2 ✓ |
| 3 | `grep -c "\.strict()"` >= 2 | 4 ✓ (existing schema + reorderWishlistSchema, both as declaration and via `.strict()` call) |
| 4 | `grep -c "z.array(z.string().uuid()).min(1).max(500)"` == 1 | 1 ✓ |
| 5 | `grep -c "Some watches do not belong to you"` == 1 | 1 ✓ |
| 6 | `grep -c "Couldn't save new order"` == 1 | 1 ✓ |
| 7 | `grep -c "revalidatePath('/u/\[username\]/wishlist'"` == 1 | 1 ✓ |
| 8 | Plan 01 test passes 7/7 | GREEN ✓ |
| 9 | `npx tsc --noEmit` no new errors in wishlist.ts | Clean ✓ |
| 10 | `addToWishlistFromWearEvent` export preserved (`grep -c "export async function addToWishlistFromWearEvent"` == 1) | 1 ✓ |
| 11 | `'use server'` directive preserved (`grep -c "use server"` >= 1) | 1 ✓ |

## Issues Encountered

One issue, classified as Rule 1 (auto-fix bug) and resolved inline — see "Deviations from Plan" above. No Rule 4 (architectural) blockers; no auth gates; no out-of-scope discoveries.

## User Setup Required

None — the Server Action runs entirely within the existing Next.js + Supabase stack. No new env vars, no external service configuration, no `package.json` changes.

## Next Phase Readiness

- **Plan 27-04 (card content renderers)** has no dependency on Plan 03; it operates on the read path (`getWatchesByUser` ORDER BY landed in Plan 02).
- **Plan 27-05 (DnD wiring)** can now `import { reorderWishlist } from '@/app/actions/wishlist'` and call it from `startTransition` with `useOptimistic` per CONTEXT D-09. The 7-case test contract documents the exact `ActionResult<void>` shape and error string set the client must handle (Sonner toast on `success: false`, optimistic-state auto-revert via React's transition resolution).

## Self-Check: PASSED

Verified files modified:
- FOUND: src/app/actions/wishlist.ts (reorderWishlist export present at line 176)
- FOUND: src/app/actions/__tests__/reorderWishlist.test.ts (VALID_UUID updated)

Verified commit exists:
- FOUND: 55ce804 (Task 1 — feat(27-03): add reorderWishlist Server Action)

Verified tests GREEN:
- FOUND: 7/7 it() blocks pass in src/app/actions/__tests__/reorderWishlist.test.ts

Verified frontmatter requirements:
- requirements-completed: [WISH-01] (matches PLAN.md `requirements: [WISH-01]`)

---
*Phase: 27-watch-card-collection-render-polish*
*Plan: 03*
*Completed: 2026-05-04*
