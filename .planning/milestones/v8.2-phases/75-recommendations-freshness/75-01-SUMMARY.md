---
phase: 75
plan: 01
subsystem: cache-invalidation
tags: [cache-components, server-actions, read-your-own-writes, next-16, discovery]
dependency_graph:
  requires: []
  provides:
    - per-viewer recs cacheTag handle on the home "From collectors like you" rail
    - 4 mutation sites that invalidate the rail on add/move/edit/remove
    - file-header invariant comment for future mutation actions
  affects:
    - src/components/home/CollectorsLikeYou.tsx (now tag-registered)
    - src/app/actions/watches.ts (4 new updateTag call sites + D-19 header)
tech_stack:
  added:
    - "next/cache: updateTag (Next 16 read-your-own-writes primitive for Server Actions)"
  patterns:
    - per-viewer cache tag pattern (mirrors v7.0 Phase 63 D-12 viewer:${id}:counts shape)
    - file-header invariant comment for invisible-rule discoverability (D-19)
key_files:
  created:
    - src/app/actions/__tests__/watches-recs-invalidation.test.ts
  modified:
    - src/components/home/CollectorsLikeYou.tsx
    - src/app/actions/watches.ts
decisions:
  - D-01 cacheTag value — per-viewer scope viewer:${viewerId}:recs (not global 'recs')
  - D-02 semantics — read-your-own-writes (Next 16 updateTag, NOT revalidateTag-with-'max' SWR)
  - D-03 four wiring sites — addWatch, moveWishlistToCollection, editWatch, removeWatch
  - D-04 additive-only — no pre-existing revalidatePath/revalidateTag modified
  - D-05 viewerId stays in cache key via prop (Pitfall 7 / T-10-07-01 preserved)
  - D-15 regression test asserts the wiring (4 cases, one per mutation)
  - D-19 file-header invariant comment documents the rule for future authors
metrics:
  duration: ~25min
  completed: 2026-05-30
  tasks_completed: 3
  files_changed: 3
  commits: 3
---

# Phase 75 Plan 01: Cache-Tag Wiring for the Home Recs Rail Summary

Closed the DISC-RECS-CACHE invalidation gap: the home "From collectors like you" rail now registers a per-viewer `cacheTag(`viewer:${viewerId}:recs`)` and all four watch-mutation Server Actions (`addWatch`, `moveWishlistToCollection`, `editWatch`, `removeWatch`) invalidate that exact tag via Next 16's `updateTag` primitive — eliminating the up-to-1hr stale window after every collection change.

## What Built

1. **`cacheTag` registered on the rail** (`src/components/home/CollectorsLikeYou.tsx`)
   - Extended the `next/cache` import to include `cacheTag` alongside `cacheLife`.
   - Inserted `cacheTag(`viewer:${viewerId}:recs`)` inside the `'use cache'` scope, on the line immediately after `cacheLife('minutes')`.
   - Function signature `{ viewerId }: { viewerId: string }` unchanged — viewerId still flows as a prop per Pitfall 7 / T-10-07-01 (D-05 preserved).
   - The JSDoc block on lines 6-22 (Pitfall 7 documentation) is untouched.

2. **`updateTag` wired into 4 mutation actions + D-19 file-header invariant comment** (`src/app/actions/watches.ts`)
   - Added a 14-line header comment block above the `next/cache` import (line 3-18) documenting the mutation-must-invalidate-recs invariant per D-19, with explicit Next 16 deprecation context.
   - Extended the `next/cache` import to add `updateTag` alongside the pre-existing `revalidatePath` and `revalidateTag`.
   - Inserted `updateTag(`viewer:${user.id}:recs`)` in 4 spots, each immediately after the action's existing `revalidatePath('/')`:
     - `addWatch` (line 340) — colocated with the existing cache invalidation cluster
     - `moveWishlistToCollection` (line 532)
     - `editWatch` (line 676)
     - `removeWatch` (line 728)
   - All pre-existing revalidate calls preserved verbatim (D-04 additive-only): 4× `revalidatePath('/')`, 4× `revalidateTag('profile:${ownerProfile.username}', 'max')`, 4× `revalidateTag('explore', 'max')`, plus the recipient-NotificationBell fan-out `revalidateTag('viewer:${recipient.userId}', 'max')` block in addWatch + moveWishlistToCollection.

3. **Regression test** (`src/app/actions/__tests__/watches-recs-invalidation.test.ts` — NEW, 228 LOC)
   - 4 vi.mock-driven cases (one per mutation action), each asserting `updateTag` was called with `viewer:viewer-1:recs` (positive assertion via constant `RECS_TAG`) AND that ZERO `revalidateTag` calls landed on the same tag (negative D-02 enforcement — confirms read-your-own-writes was used, not stale-while-revalidate).
   - Mock surface mirrors the canonical `moveWishlistToCollection.test.ts:31-34` pattern with added DAL stubs for `createWatch`/`updateWatch`/`deleteWatch`/`getMaxWishlistSortOrder`, `catalog.upsertCatalogFromUserInput`, `account.purgeWatchPhotos`, and `supabase/server.createSupabaseServerClient` so the four happy-paths can run end-to-end without DB or network.
   - All 4 tests pass under `npx vitest run src/app/actions/__tests__/watches-recs-invalidation.test.ts` (1.10s, 4/4 passed).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking issue] Plan's `revalidateTag(tag)` single-arg form is deprecated in Next 16 → migrated to `updateTag(tag)`**

- **Found during:** Task 2 (`npm run build` after wiring 4× `revalidateTag(`viewer:${user.id}:recs`)` calls per the plan).
- **Issue:** Next 16's TypeScript signature for `revalidateTag` is `revalidateTag(tag: string, profile: string | CacheLifeConfig): undefined` — single-arg form does NOT type-check. Build failed with `Type error: Expected 2 arguments, but got 1. src/app/actions/watches.ts:333:5 revalidateTag(`viewer:${user.id}:recs`)`. The plan (Tasks 2 + 3) explicitly mandated default semantics with NO `'max'` second arg, citing D-02 "read-your-own-write requires immediate invalidation, NOT stale-while-revalidate."
- **Root cause investigation:** Per AGENTS.md ("This is NOT the Next.js you know ... Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices."), checked `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/`:
  - `revalidateTag.md`: "The single-argument form `revalidateTag(tag)` is deprecated. It currently works if TypeScript errors are suppressed, but this behavior may be removed in a future version."
  - `updateTag.md`: "`updateTag` allows you to update cached data on-demand for a specific cache tag from within Server Actions. This function is designed for **read-your-own-writes** scenarios, where a user makes a change ... and the UI immediately shows the change, rather than stale data."
  - Conclusion: Next 16 split the API. Single-arg `revalidateTag` became deprecated `updateTag`; `revalidateTag` now requires a `profile` arg and means stale-while-revalidate.
- **Fix:** Migrated all 4 call sites from `revalidateTag(`viewer:${user.id}:recs`)` to `updateTag(`viewer:${user.id}:recs`)`. Added `updateTag` to the `next/cache` import. Updated the D-19 file-header comment to reflect Next 16 semantics (cites the doc paths so future readers can verify). Updated the regression test (Task 3) to assert against `updateTag` instead of `revalidateTag`.
- **Why this preserves the plan intent:** D-02's literal requirement was "read-your-own-write requires immediate invalidation, NOT stale-while-revalidate." `updateTag` is Next 16's named primitive for exactly that semantic — the docs say single-arg `revalidateTag` was "legacy behavior which is equivalent to `updateTag`." The semantic is preserved verbatim; only the function name changed.
- **Files modified:** `src/app/actions/watches.ts` (import + header comment + 4 call sites), `src/app/actions/__tests__/watches-recs-invalidation.test.ts` (assertion target).
- **Commits:** `b96945d8` (watches.ts wiring + header), `cae82899` (test).

### Plan verify-spec adjustments (informational, not deviations)

- Plan's Task 2 verify command `grep -c "revalidateTag(\`viewer:\${user.id}:recs\`)" ... | grep -q "^4$"` would have failed for two reasons even on the originally-specified code: (a) the D-19 file-header comment contains the exact pattern inside backticks, which would push the count to 5 (4 function calls + 1 comment), and (b) the post-deviation code uses `updateTag`. The substantive criterion — exactly 4 function calls invoking the recs invalidation — is met (`grep -cE '^[[:space:]]+updateTag\(`viewer:\$\{user\.id\}:recs`\)' src/app/actions/watches.ts` → 4).
- Plan's Task 3 verify command counted `viewer:viewer-1:recs` literal occurrences expecting ≥4; my test uses a top-of-file `const RECS_TAG = `viewer:${VIEWER_ID}:recs`` constant for DRY and asserts via `RECS_TAG`. The substantive criterion — 4 passing assertions, one per mutation — is met (`vitest run` reports 4 passed; `grep -c "expect(vi.mocked(updateTag)).toHaveBeenCalledWith(RECS_TAG)" ... ` → 4).

## Verification

- `npm run build` exits 0 (the gate per `project_baseline_not_green_build_is_gate` memory). Confirmed after Task 1, Task 2 (post-deviation fix), and final preflight.
- `npx vitest run src/app/actions/__tests__/watches-recs-invalidation.test.ts` → `Test Files 1 passed (1) / Tests 4 passed (4) / Duration 1.10s`.
- `grep -cE '^[[:space:]]+updateTag\(`viewer:\$\{user\.id\}:recs`\)' src/app/actions/watches.ts` → 4 (one per mutation action).
- `grep -cE '^[[:space:]]+revalidateTag\(`viewer:\$\{user\.id\}:recs`' src/app/actions/watches.ts` → 0 (D-02 enforcement: no SWR semantics on the recs tag).
- `grep -cF "revalidatePath('/')" src/app/actions/watches.ts` → 4 (D-04 additive-only: pre-existing path-revalidates preserved).
- `grep -cF "revalidateTag('explore', 'max')" src/app/actions/watches.ts` → 4 (D-04 preserved).
- `grep -cF 'cacheTag(`viewer:${viewerId}:recs`)' src/components/home/CollectorsLikeYou.tsx` (via `grep -F`) → 1 (single registration inside the `'use cache'` scope).
- `grep -q "export async function CollectorsLikeYou({ viewerId }: { viewerId: string })" src/components/home/CollectorsLikeYou.tsx` → match (D-05 Pitfall 7 signature preserved).
- `grep -n font-medium` across 3 modified files → 0 matches (font-semibold > font-medium guardrail per `project_phase_68_complete` upheld).

## Success Criteria

- DISC-RECS-CACHE requirement satisfied: the 4 watch mutations invalidate the per-viewer recs cache tag via `updateTag` (read-your-own-writes); the rail's `'use cache'` scope registers the matching `cacheTag`.
- Read-your-own-write contract verified by the 4-case regression test (each case asserts `updateTag` fired AND `revalidateTag` did NOT fire on the same tag — D-02 enforcement is positive AND negative).
- No cross-user cache-key leakage (D-05 Pitfall 7 preserved — viewerId is a prop, in the cache key by Next.js cache-key composition).
- File-header invariant comment in place for future mutation-action authors (D-19).
- Build green; targeted test green; no font-medium introductions; no destructive git operations.

## Stubs / Threat Flags

None.

## Self-Check: PASSED

**Files exist:**
- `/Users/tylerwaneka/Documents/horlo/src/components/home/CollectorsLikeYou.tsx` — FOUND
- `/Users/tylerwaneka/Documents/horlo/src/app/actions/watches.ts` — FOUND
- `/Users/tylerwaneka/Documents/horlo/src/app/actions/__tests__/watches-recs-invalidation.test.ts` — FOUND

**Commits exist:**
- `5e5d3fcd` — FOUND (Task 1)
- `b96945d8` — FOUND (Task 2)
- `cae82899` — FOUND (Task 3)
