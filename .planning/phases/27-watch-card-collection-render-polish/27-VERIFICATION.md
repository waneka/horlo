---
phase: 27-watch-card-collection-render-polish
verified: 2026-05-04T15:45:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
---

# Phase 27: Watch Card & Collection Render Polish — Verification Report

**Phase Goal:** Collection and wishlist owners can see and reorder their watches in a denser, price-aware grid that reflects the order they care about.

**Verified:** 2026-05-04T15:45:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Mobile (<768px): Collection + Wishlist tabs render in 2-column grid; desktop unchanged | VERIFIED | `CollectionTabContent.tsx:161` and `WishlistTabContent.tsx:83,221` both use `grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4` — mobile gets 2 columns, sm/lg breakpoints retained for desktop. Component test `CollectionTabContent.test.tsx` passes (1/1) and `WishlistTabContent.test.tsx` passes (6/6) including the cross-branch grid-cols-2 assertion. |
| 2 | Each watch card shows price line — paid_price for owned, target_price for wishlist — hidden when null | VERIFIED | `ProfileWatchCard.tsx:48-56` derives `priceLine` from `isWishlistLike` (status==='wishlist'\|\|'grail') with bucket selection (target vs paid) and marketPrice fallback (D-20). Render gate at line 102: `{priceLine && (...)}`. All 9 cells in `ProfileWatchCard-priceLine.test.tsx` matrix pass GREEN (status × price-presence × marketPrice fallback × hidden-when-null). |
| 3 | Owner can reorder Wishlist via drag (desktop) and long-press (mobile); persists across sessions and devices | VERIFIED | `SortableProfileWatchCard.tsx` uses `useSortable` + `touchAction: 'manipulation'`. `WishlistTabContent.tsx:139-149` sets `MouseSensor(delay:150ms)` + `TouchSensor(delay:250ms)` + `KeyboardSensor`. Drop calls `reorderWishlist({orderedIds})` (line 177) which writes via `bulkReorderWishlist` DAL. Schema column `watches.sort_order` (NOT NULL DEFAULT 0) + `watches_user_sort_idx` index in `src/db/schema.ts:103-115` and `supabase/migrations/20260504120000_phase27_sort_order.sql` for prod. `getWatchesByUser` orders by `asc(sortOrder), desc(createdAt)` (line 108). Persistence: each reorder writes to DB, `revalidatePath('/u/[username]/[tab]', 'page')` invalidates cache (BR-02 fix `dad495e` confirmed). UAT approved 2026-05-04 covering desktop + iOS Safari + persistence across refresh. |
| 4 | Non-owner viewing public Wishlist sees watches in owner's chosen order | VERIFIED | `WishlistTabContent.tsx:80-94` non-owner populated branch renders plain `ProfileWatchCard` list (no DnD, no `aria-roledescription="sortable"`). Order is sourced from `getWatchesByUser` which orders by `sort_order ASC` — same query path used for both owner and non-owner views (`src/app/u/[username]/[tab]/page.tsx:147,202,243`). Test `WishlistTabContent.test.tsx` "Phase 27 — non-owner branch" GREEN. UAT Test 7 confirmed visually 2026-05-04. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/schema.ts` | sortOrder column + watches_user_sort_idx index | VERIFIED | `sortOrder: integer('sort_order').notNull().default(0)` at line 106; `index('watches_user_sort_idx').on(table.userId, table.sortOrder)` at line 115 |
| `src/lib/types.ts` | Watch.sortOrder?: number | VERIFIED | Confirmed via `mapRowToWatch` in `src/data/watches.ts:49` (`sortOrder: row.sortOrder`) and grep `sortOrder` in types.ts |
| `drizzle/0006_phase27_sort_order.sql` | drizzle-emitted local migration | VERIFIED | File exists; contains `ALTER TABLE "watches" ADD COLUMN "sort_order"` + `CREATE INDEX "watches_user_sort_idx"` |
| `supabase/migrations/20260504120000_phase27_sort_order.sql` | prod migration with backfill + assertion | VERIFIED | BEGIN/COMMIT wrap, IF NOT EXISTS guards, dual idempotent backfill CTEs (wishlist+grail; owned+sold), DO $$ post-assertion. WR-05 idempotency gate present (skip-on-non-zero check). |
| `src/data/watches.ts` | getWatchesByUser ORDER BY + bulkReorderWishlist + getMaxWishlistSortOrder | VERIFIED | All 3 functions exported. `getWatchesByUser` orders by `asc(sortOrder), desc(createdAt)` (line 108). `bulkReorderWishlist` includes BR-01 set-completeness check (lines 340-352) before CASE WHEN UPDATE; throws `SetMismatchError` or `OwnerMismatchError`. `getMaxWishlistSortOrder` uses `coalesce(max, -1)` over wishlist+grail. |
| `src/app/actions/wishlist.ts` | reorderWishlist Server Action with Zod .strict + auth + DAL delegation | VERIFIED | Lines 156-226. Zod schema `.strict()` with `min(1).max(500)` (line 175-179). `getCurrentUser` auth gate (line 186). DAL delegation (line 197). BR-02 fix: `revalidatePath('/u/[username]/[tab]', 'page')` (line 206). WR-04 fix: `instanceof OwnerMismatchError` / `SetMismatchError` discrimination (lines 212, 218) — no string matching. |
| `src/app/actions/watches.ts` | addWatch + editWatch sort_order bump on wishlist|grail | VERIFIED | WR-01 fix confirmed: lines 100, 325 destructure `sortOrder` out of `parsed.data` unconditionally before computing server-side max+1. Both `addWatch` (line 105-106) and `editWatch` (line 334-335) re-add `sortOrder: maxSort + 1` only when entering wishlist+grail group. |
| `src/components/profile/ProfileWatchCard.tsx` | Status-driven price line + Image sizes attr | VERIFIED | Lines 41-56 implement `isWishlistLike` price bucket logic with marketPrice fallback. Line 67: `sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw"` matches D-13. Line 102-106: `{priceLine && <p className="mt-1 text-xs font-normal text-foreground">...</p>}`. |
| `src/components/profile/CollectionTabContent.tsx` | grid-cols-2 wrapper | VERIFIED | Line 161: `<div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">`. Empty-state grid at line 89 (`sm:grid-cols-2`) deliberately untouched. |
| `src/components/profile/SortableProfileWatchCard.tsx` | useSortable wrapper with drop indicator | VERIFIED | 'use client', `useSortable` from @dnd-kit/sortable, `touchAction: 'manipulation'`, `cursor-grab active:cursor-grabbing`, `aria-roledescription="sortable"`, `aria-label`. WR-02 fix: symmetric drop indicator (lines 72-75) — `showDropIndicatorBefore` (moving up) + `showDropIndicatorAfter` (moving down) both render `h-0.5 w-full bg-ring rounded-full` indicator. |
| `src/components/profile/WishlistTabContent.tsx` | DndContext + SortableContext + useOptimistic on owner; grid-cols-2 on both | VERIFIED | Lines 116-251 `OwnerWishlistGrid` sub-component (rules-of-hooks compliance). Sensors with 150ms desktop / 250ms mobile activation. WR-03 fix: `setActiveId(null)` moved inside `startTransition` (line 176) so React batches overlay clear with optimistic update. AddWatchCard rendered OUTSIDE `SortableContext.items` as final grid cell. DragOverlay wraps presentational ProfileWatchCard. |
| `package.json` | @dnd-kit/core ^6.3.1, @dnd-kit/sortable ^10.0.0, @dnd-kit/utilities ^3.2.2 | VERIFIED | All three present at the locked carets. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| WishlistTabContent.tsx | wishlist.ts | `import { reorderWishlist } from '@/app/actions/wishlist'` | WIRED | Line 28; called at line 177 inside `startTransition` |
| WishlistTabContent.tsx | SortableProfileWatchCard.tsx | owner branch render | WIRED | Line 26 import; line 223 mount inside `SortableContext` |
| SortableProfileWatchCard.tsx | ProfileWatchCard.tsx | presentational composition | WIRED | Line 5 import; line 94 inner render |
| WishlistTabContent.tsx | sonner | `toast.error` | WIRED | Line 23 import; line 181 invocation on `result.success === false` |
| wishlist.ts | watches DAL | `bulkReorderWishlist`, `OwnerMismatchError`, `SetMismatchError` | WIRED | Lines 10-15 import; line 197 call; lines 212, 218 instanceof checks |
| watches.ts (DAL) | schema.ts | `watches.sortOrder` | WIRED | Used in `bulkReorderWishlist` (lines 363-365), `getMaxWishlistSortOrder` (line 263), `getWatchesByUser` (line 108) |
| actions/watches.ts | data/watches.ts | `getMaxWishlistSortOrder` | WIRED | Line 105 (addWatch), line 334 (editWatch) — both gated on wishlist\|grail status |
| [tab]/page.tsx | data/watches.ts | `getWatchesByUser` | WIRED | Lines 147, 202, 243 — same query path used for owner AND non-owner views, both inherit `ORDER BY sort_order ASC, created_at DESC` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| WishlistTabContent | `watches` prop | `getWatchesByUser(profile.id)` in [tab]/page.tsx:202 | DB query (drizzle select with ORDER BY) | FLOWING |
| OwnerWishlistGrid | `optimisticIds` | `useOptimistic(initialIds)` derived from server-fetched `watches` | DB-sourced via parent prop | FLOWING |
| ProfileWatchCard | `priceLine` | computed from `watch.pricePaid`/`watch.targetPrice`/`watch.marketPrice` | DB columns mapped via `mapRowToWatch` | FLOWING |
| CollectionTabContent | `watches` prop | `getWatchesByUser(profile.id)` in [tab]/page.tsx:147 | DB query | FLOWING |
| Reorder write path | `orderedIds` | `arrayMove` of optimisticIds → `reorderWishlist` Server Action → `bulkReorderWishlist` DAL → `UPDATE watches SET sort_order = CASE WHEN ... END` | DB write with WHERE clause defense + count check + set-completeness check | FLOWING |

### Behavioral Spot-Checks

Component + action tests run with no DB:

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Card price-line + grid + DnD owner branch tests pass | `npx vitest run src/components/profile/WishlistTabContent.test.tsx src/components/profile/__tests__/CollectionTabContent.test.tsx src/components/profile/__tests__/ProfileWatchCard-priceLine.test.tsx src/app/actions/__tests__/reorderWishlist.test.ts` | 24/24 passed (4 files, all green) | PASS |
| reorderWishlist surface contract | included above | 8/8 passed (7 original + 1 SetMismatchError mapping after BR-01 fix) | PASS |
| WishlistTabContent isOwner branching + grid-cols-2 cross-branch | included above | 6/6 passed | PASS |
| ProfileWatchCard 8-cell price-line matrix + sizes attr | included above | 9/9 passed | PASS |
| CollectionTabContent grid-cols-2 wrapper | included above | 1/1 passed | PASS |
| DB-gated integration tests (phase27-schema, phase27-backfill, phase27-bulk-reorder, phase27-getwatchesbyuser-order) | DATABASE_URL points at supabase.com remote in this worktree's .env.local — running them in this verifier session would touch a non-local DB | SKIPPED — user reported phase tests pass when run sequentially against fresh DB pool (33/33 phase 27 specs green) | SKIP |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| WISH-01 | 27-01, 27-02, 27-03, 27-05 | User can reorder wishlist via drag/long-press; order persists via sort_order column; owner-only; public profiles render in chosen order | SATISFIED | `sortOrder` column + composite index in schema; `bulkReorderWishlist` + `reorderWishlist` Server Action with three-layer owner enforcement (Zod strict + session-userId + DAL WHERE+count+set-completeness); WishlistTabContent owner DnD wiring + non-owner plain-list branch; UAT approved |
| VIS-07 | 27-01, 27-04, 27-05 | Collection and wishlist grids render 2 columns mobile, desktop unchanged | SATISFIED | Both `CollectionTabContent` and `WishlistTabContent` (owner + non-owner branches) use `grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4` |
| VIS-08 | 27-01, 27-04 | Watch card displays paid_price for owned / target_price for wishlist; hidden when null | SATISFIED | `ProfileWatchCard.tsx` lines 41-56 unified status-driven price-line resolution; conditional render `{priceLine && (...)}`; 9-case test matrix GREEN |

No orphaned requirements — all 3 IDs declared in PLAN frontmatter (`27-01-PLAN.md` requirements, propagated to other plans) match REQUIREMENTS.md mappings to Phase 27.

**Note:** REQUIREMENTS.md still shows `[ ]` (unchecked) for WISH-01, VIS-07, VIS-08. This is a status-tracking artifact — the implementation is complete; the checkbox flip is typically performed in a phase-completion housekeeping commit. Not a verification gap.

### Anti-Patterns Found

Stub detection scan on phase 27 modified files:

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | — | — | No TODO/FIXME/PLACEHOLDER markers; no empty implementations; no hardcoded empty data flowing to user-visible output; no console-log-only handlers |

Drop indicator initially flagged WR-02 (asymmetric); the WR-02 fix (commit `cb68db1`) makes it symmetric — verified at `SortableProfileWatchCard.tsx:72-75`. Drop-indicator is now correct for both up- and down-direction drags.

### Code Review Fix Verification

The 27-REVIEW-FIX.md claims 7 findings were fixed (2 BLOCKERs + 5 WARNINGs). All 7 verified live in the codebase:

| Finding | Commit | Verified In Code |
|---------|--------|------------------|
| BR-01 (set-completeness check) | `60dbef4` | `src/data/watches.ts:340-352` — COUNT(*) query + `SetMismatchError` throw before CASE WHEN UPDATE |
| BR-02 (revalidatePath dynamic segment) | `dad495e` | `src/app/actions/wishlist.ts:206` — `revalidatePath('/u/[username]/[tab]', 'page')` matches actual `src/app/u/[username]/[tab]/page.tsx` route |
| WR-01 (strip client-controlled sortOrder) | `442dca9` | `src/app/actions/watches.ts:100,325` — destructure `sortOrder` out of `parsed.data` unconditionally; re-add server-computed value only on wishlist\|grail entry |
| WR-02 (symmetric drop indicator) | `cb68db1` | `src/components/profile/SortableProfileWatchCard.tsx:72-75,79-83,100-105` — both `showDropIndicatorBefore` and `showDropIndicatorAfter` |
| WR-03 (setActiveId inside transition) | `961b4bd` | `src/components/profile/WishlistTabContent.tsx:171-176` — `setActiveId(null)` inside `startTransition` after `setOptimistic(newOrder)` |
| WR-04 (typed errors over string match) | `60dbef4` | `src/data/watches.ts:286-306` — `OwnerMismatchError` + `SetMismatchError` classes; `src/app/actions/wishlist.ts:212,218` — `instanceof` discrimination |
| WR-05 (idempotent backfill gate) | `f89225d` | `supabase/migrations/20260504120000_phase27_sort_order.sql:26-51,58-83` — `DO $$ BEGIN IF EXISTS (...sort_order > 0) THEN RAISE NOTICE skip ELSE backfill END IF END $$;` |

### Human Verification Status

UAT approved 2026-05-04 covering all 8 sub-tests:
- Desktop happy path (cursor-grab, lift, drop indicator, persist on refresh, Server Action call success)
- Desktop quick-tap navigation (no accidental drag below 150ms)
- Desktop keyboard reorder (focus → space → arrows → space/escape, aria-live announcements)
- iOS Safari long-press 250ms drag (no scroll-fight, haptic, persist across refresh)
- Failure path (network blocked → Sonner toast → optimistic rollback)
- Non-owner viewing public wishlist (plain cards, owner's chosen order)
- Click-through verification (drag-release does NOT navigate)
- Drop indicator visual confirmation in both up and down directions

No additional human verification items remain.

### Gaps Summary

No gaps. All 4 success criteria verified at code, key-link, and data-flow levels. All 7 review findings (2 BLOCKER + 5 WARNING) are fixed and verified live in the codebase. Component + action test suite (24/24) passes. UAT approved.

---

_Verified: 2026-05-04T15:45:00Z_
_Verifier: Claude (gsd-verifier)_
