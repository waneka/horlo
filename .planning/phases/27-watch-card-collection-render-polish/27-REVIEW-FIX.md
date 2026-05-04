---
phase: 27-watch-card-collection-render-polish
fixed_at: 2026-05-04T00:00:00Z
review_path: .planning/phases/27-watch-card-collection-render-polish/27-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 27: Code Review Fix Report

**Fixed at:** 2026-05-04
**Source review:** `.planning/phases/27-watch-card-collection-render-polish/27-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (2 BLOCKER + 5 WARNING)
- Fixed: 7
- Skipped: 0

All in-scope findings from the standard review were resolved. Two findings (BR-01 and WR-04) shipped in a single commit because the typed-error refactor introduced by WR-04 is the dispatch mechanism for the new `SetMismatchError` thrown by BR-01.

## Fixed Issues

### BR-02: `revalidatePath` literal `wishlist` segment did not match dynamic `[tab]` route

**Files modified:** `src/app/actions/wishlist.ts`
**Commit:** `dad495e`
**Applied fix:** Changed `revalidatePath('/u/[username]/wishlist', 'page')` to `revalidatePath('/u/[username]/[tab]', 'page')`. The actual Next.js route is `/u/[username]/[tab]/page.tsx` (verified at `src/app/u/[username]/[tab]/page.tsx`); the literal `wishlist` segment silently no-opped revalidation. The dynamic `[tab]` placeholder now invalidates all tab variants for the route.

### BR-01: `bulkReorderWishlist` did not enforce orderedIds is the complete user wishlist+grail set

**Files modified:** `src/data/watches.ts`, `src/app/actions/wishlist.ts`, `src/app/actions/__tests__/reorderWishlist.test.ts`
**Commit:** `60dbef4` (combined with WR-04)
**Applied fix:** Added a `COUNT(*)` query at the start of `bulkReorderWishlist` that fetches the user's total wishlist+grail row count. If `orderedIds.length !== total`, throw the new `SetMismatchError`. Combined with the existing post-update count check (which proves every submitted id IS in the set), this is a full bidirectional set-equality proof — no partial submission can succeed. The Server Action maps `SetMismatchError` to a refresh-and-retry user message ("Your wishlist changed in another tab. Refresh and try again."). New unit test added in the same commit covers the SetMismatchError → action mapping.

**Verification note:** This finding involved correctness logic for a race-condition path. Tier 1 (re-read) and Tier 2 (TypeScript + unit tests) verified the structural correctness of the check, but only manual UAT can confirm the live race scenario produces the expected user-facing message. Flagging for human verification of the live two-tab race in the Phase 27 verifier step.

### WR-04: Error mapping relied on brittle string-matching of error messages

**Files modified:** `src/data/watches.ts`, `src/app/actions/wishlist.ts`, `src/app/actions/__tests__/reorderWishlist.test.ts`
**Commit:** `60dbef4` (combined with BR-01)
**Applied fix:** Introduced two typed error classes in `src/data/watches.ts` — `OwnerMismatchError` and `SetMismatchError` — and replaced `err.message.startsWith('Owner mismatch')` in the action's catch with `instanceof OwnerMismatchError` / `instanceof SetMismatchError`. The `OwnerMismatchError.message` text is intentionally preserved as `"Owner mismatch: expected N rows, updated M"` for back-compat with the existing integration test (`tests/integration/phase27-bulk-reorder.test.ts`) which uses regex `/Owner mismatch/`. The unit test was updated to throw the typed errors via `vi.importActual` so the action's `instanceof` discrimination resolves the real class.

### WR-01: Client-controllable `sortOrder` bypassed server-side ordering policy in addWatch/editWatch

**Files modified:** `src/app/actions/watches.ts`
**Commit:** `442dca9`
**Applied fix:** Destructure `sortOrder` out of `parsed.data` unconditionally at the top of both `addWatch` and `editWatch` try blocks. The schema still accepts `sortOrder` for back-compat, but the action now passes `cleanData` (no `sortOrder`) to the DAL by default. The server re-adds the computed `maxSort + 1` only when entering the wishlist+grail group. Closes the within-group-edit gap where the prior code passed the client value through untouched. Server is now the sole source of truth for `sortOrder` values across all addWatch/editWatch transitions.

### WR-02: Drop-indicator UX was asymmetric and rendered at the wrong gap

**Files modified:** `src/components/profile/SortableProfileWatchCard.tsx`
**Commit:** `cb68db1`
**Applied fix:** Replaced the single `showDropIndicator = isOver && activeIndex < overIndex` predicate with two predicates: `showDropIndicatorBefore` (when `activeIndex > overIndex`, i.e., moving UP) and `showDropIndicatorAfter` (when `activeIndex < overIndex`, i.e., moving DOWN). Render an indicator before AND after the card based on direction so the indicator marks the gap the dragged item will land at after `arrayMove(items, activeIndex, overIndex)`. Both directions now have a visual cue.

### WR-03: `setActiveId(null)` outside `startTransition` caused snap-back flicker

**Files modified:** `src/components/profile/WishlistTabContent.tsx`
**Commit:** `961b4bd`
**Applied fix:** Removed the synchronous `setActiveId(null)` from the top of `handleDragEnd`. Moved it to: (a) each early-return path (no-op drops, missing indices), and (b) inside the `startTransition` callback after `setOptimistic(newOrder)`. React now batches the overlay clear with the optimistic update for a single render — the dragged card never re-renders with the cleared overlay AND the OLD order at the same time. `setActiveId` is a regular `useState` setter (NOT `useOptimistic`) so calling it inside the transition is safe.

### WR-05: Backfill migration was not RE-runnable without clobbering user-driven reorders

**Files modified:** `supabase/migrations/20260504120000_phase27_sort_order.sql`
**Commit:** `f89225d`
**Applied fix:** Wrapped each backfill CTE (wishlist+grail and owned+sold) in a `DO $$` block that early-returns with `RAISE NOTICE` if any row in the target status set already has `sort_order > 0`. A non-zero value can only have come from a prior backfill OR from the Phase 27 reorder UX — either way, re-running would destroy state. The schema-side `ADD COLUMN IF NOT EXISTS` makes the schema idempotent; the new gate makes the data-write idempotent too. The post-migration duplicate-tuple assertion (lines 90-106) is preserved unchanged.

## Skipped Issues

None — all 7 in-scope findings were fixed.

## Verification Performed

- **Tier 1 (re-read):** Every modified file re-read after edit; fix text confirmed present and surrounding code intact.
- **Tier 2 (syntax / type-check / unit tests):**
  - `npx tsc --noEmit -p tsconfig.json` — no errors in any modified `.ts` / `.tsx` file (pre-existing errors in unrelated test fixtures and `node_modules/drizzle-orm/gel-core` ignored per spec).
  - `npx vitest run src/app/actions/__tests__/reorderWishlist.test.ts` — 8/8 passed (7 original + 1 new for BR-01 SetMismatchError mapping).
  - `npx vitest run src/components/profile/WishlistTabContent.test.tsx` — 6/6 passed.
- **Tier 3 (fallback):** SQL migration file changes verified by re-read only (Tier 2 syntax checking for SQL not in scope per the verification table).

## Notes for Verifier

1. **BR-01 logic correctness — flag for manual UAT.** The set-completeness check has been verified structurally (TypeScript types check, unit test passes for the explicit `SetMismatchError` rejection path), but the live two-tab race condition this guards against can only be exercised by a manual UAT. Open two browser tabs on `/u/<username>/wishlist` (owner view), add a watch in tab B, drag-reorder in tab A — expect the user-facing message "Your wishlist changed in another tab. Refresh and try again." and an automatic optimistic-UI revert.

2. **Integration test compatibility.** The existing `tests/integration/phase27-bulk-reorder.test.ts` regex `/Owner mismatch/` still matches `OwnerMismatchError.message` — the message string was intentionally preserved for back-compat. Re-running the integration suite (with `DATABASE_URL` set) is recommended.

3. **Migration idempotency gate.** Re-applying the migration on a fresh DB still backfills as before (all rows have `sort_order = 0` initially → ELSE branch taken). Re-applying after the reorder UX has written non-zero values triggers the IF branch and prints a NOTICE. Both paths verified by reading the SQL.

---

_Fixed: 2026-05-04_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
