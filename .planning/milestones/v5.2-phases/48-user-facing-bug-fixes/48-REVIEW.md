---
phase: 48-user-facing-bug-fixes
reviewed: 2026-05-19T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - src/app/catalog/[catalogId]/page.tsx
  - src/components/search/ArchetypeChips.tsx
  - src/components/search/BrandChips.tsx
  - src/components/search/CaseSizeChips.tsx
  - src/components/search/EraChips.tsx
  - src/components/search/GenreChips.tsx
  - src/components/search/MovementChips.tsx
  - src/components/search/SearchPageClient.tsx
  - src/components/search/StyleChips.tsx
  - src/components/ui/chip.tsx
  - tests/app/catalog-page.test.ts
  - tests/components/search/DrawerChips.test.tsx
  - tests/components/search/SearchPageClientChips.test.tsx
  - tests/components/ui/chip.test.tsx
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 48: Code Review Report

**Reviewed:** 2026-05-19T00:00:00Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Phase 48 ships two scoped fixes:

- **BUG-01** — `findViewerWatchByCatalogId` now scopes `watches` lookup to `status='owned'`, so wishlist/grail/sold entries can no longer trip the "You own this watch" framing. The Drizzle predicate is correct against the schema enum (`'owned' | 'wishlist' | 'sold' | 'grail'`, schema.ts:91). Logic is sound and minimal.
- **BUG-02 / chip consolidation** — A shared CVA-based `Chip` primitive lands at `src/components/ui/chip.tsx`, and all 7 drawer chip components plus both inline removable chip blocks in `SearchPageClient.tsx` are migrated. Migration is consistent (no stragglers; no remaining inline `text-accent-foreground` usages on `bg-accent/10` surfaces) and the new `removable` variant uses `text-foreground` for dual-theme legibility per D-09.

The defects below are not blockers, but several deserve attention before this phase is considered locked:

1. **The BUG-01 regression tests do not actually assert the SQL predicate** — they bypass Drizzle's `.where()` chain entirely and would still pass if a developer reverted the `status='owned'` filter. The protection against future regression is weaker than the test names suggest.
2. The new `Chip` primitive accepts `selected` on `removable` variant (silently ignored) and a removable chip with no `onClick` still renders the X dismiss affordance (latent footgun if a parent fails to wire a clear handler).
3. The `WatchesPanel` removable-chip click handlers are typed optional but the chip primitive renders a dismiss-affordance icon unconditionally, producing a fake-dismissable chip if any caller omits the handler.

No security issues found. No data correctness issues found beyond the test-coverage gap noted in WR-01.

## Warnings

### WR-01: BUG-01 regression tests bypass the SQL predicate they claim to guard

**File:** `tests/app/catalog-page.test.ts:33-43, 258-283`
**Issue:** The `@/db` mock stubs `db.select().from().where().limit()` so that `where()` returns `{ limit: mockDbLimit }` regardless of the predicates passed. The three "BUG-01 — {wishlist,grail,sold} watch does NOT trigger ..." tests then simply set `mockDbLimit.mockResolvedValue([])` and assert that the page treats the row as not-owned. The test comment is candid about this: "These tests simulate the FIXED query behavior." That is the problem — the test does not exercise the fix, it presupposes it. If a future commit removes the `eq(watchesTable.status, 'owned')` predicate (which would re-introduce the bug for any wishlist/grail/sold row that shares a `catalogId`), every test still passes because the mocked `where()` returns the same shape.
**Fix:** Either (a) refactor the mock to capture the predicate AST and assert the third `eq()` clause is present, or (b) replace this trio with one positive-control test that ensures the new predicate is constructed. Sketch for (a):

```ts
const mockWhere = vi.fn(() => ({ limit: mockDbLimit }))
vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: mockWhere,
      })),
    })),
  },
}))

it('BUG-01 — query is scoped to status=\'owned\' (predicate guard)', async () => {
  mockGetCatalogById.mockResolvedValue(baseCatalogEntry)
  mockGetWatchesByUser.mockResolvedValue([{ id: 'mine-1' }])
  mockDbLimit.mockResolvedValue([])
  await CatalogPage({ params: Promise.resolve({ catalogId: validCatalogId }) })
  // Verify the and(...) predicate contains an eq(status, 'owned') clause.
  // Drizzle exposes the predicate as a structured object — snapshot or
  // walk its `queryChunks` to verify status='owned' is one of the conjuncts.
  expect(mockWhere).toHaveBeenCalledTimes(1)
  const predicate = mockWhere.mock.calls[0][0]
  expect(JSON.stringify(predicate)).toContain('owned')
})
```

### WR-02: Removable `Chip` with no `onClick` still renders the X dismiss affordance

**File:** `src/components/ui/chip.tsx:42-72`
**Issue:** The component renders a clickable `<button>` plus an `X` icon and optional sr-only label whenever `variant === 'removable'`. There is no guard for the case where `onClick` is undefined. Combined with WR-03 below (callers' optional typing), a removable chip can render visually as dismissable while clicks do nothing. Screen-reader users hear "Remove brand filter, button" but activation has no effect.
**Fix:** Either make `onClick` required when `variant === 'removable'` via a discriminated union, or assert at runtime:

```ts
type ChipProps =
  | ({ variant?: 'toggle'; selected?: boolean; removeLabel?: never }
      & React.ButtonHTMLAttributes<HTMLButtonElement>)
  | ({ variant: 'removable'; removeLabel?: string; onClick: React.MouseEventHandler<HTMLButtonElement> }
      & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>)

export function Chip(props: ChipProps) { /* ... */ }
```

A discriminated union prevents the next consumer from accidentally wiring a no-op X.

### WR-03: `WatchesPanel` clear-callbacks are typed optional but the chip primitive renders a dismiss UI unconditionally

**File:** `src/components/search/SearchPageClient.tsx:353-356, 411-447, 487-521`
**Issue:** `onClearBrand?: () => void`, `onClearEra?: () => void`, `onClearGenre?: () => void`, and `onClearArchetype?: () => void` are all declared optional on `WatchesPanel`. The only current caller (`SearchPageClient`) provides all four, so this is not a live defect — but it pairs with WR-02 to create a foot-gun: any future caller (or refactor) that drops one of these props produces a chip that renders its dismiss icon and aria label but does nothing on activation.
**Fix:** Drop the optional `?` from the four `onClearXxx` props since `WatchesPanel` is an internal component used in exactly one place and there is no semantic case for omitting a clear handler when the corresponding facet may be active:

```ts
onClearBrand: () => void
onClearEra: () => void
onClearGenre: () => void
onClearArchetype: () => void
```

This catches the bug at compile time at any future call site.

### WR-04: `Chip` prop spread can override `type="button"`

**File:** `src/components/ui/chip.tsx:54-62`
**Issue:** The `<button>` element sets `type="button"` and `className={cn(...)}` as static JSX props, but `{...props}` is spread AFTER them. Because `type` is not destructured out of `props`, a consumer who passes `type="submit"` (intentional or stray) silently overrides the safe default and the chip becomes a form submitter. There is no consumer doing this today, but Chip is now a primitive used in 9+ surfaces and the precedence is wrong by convention.
**Fix:** Either destructure `type` out of props with a safe default, or place `type="button"` after the spread to make it un-overridable:

```tsx
<button
  className={cn(...)}
  {...props}
  type="button"  // last wins; cannot be overridden
>
```

(`className` is already destructured so it does not have the same issue.)

## Info

### IN-01: `selected` prop is silently no-op on `Chip variant="removable"`

**File:** `src/components/ui/chip.tsx:42-61`
**Issue:** The component's prop signature accepts `selected?: boolean` regardless of variant, but the selected-overlay class is gated `variant === 'toggle' && selected`. Passing `<Chip variant="removable" selected>...</Chip>` compiles cleanly but has no visual effect — and `aria-pressed={true}` (toggle-button semantics) would be misapplied to what is semantically a dismiss button.
**Fix:** Same discriminated-union refactor suggested in WR-02 keeps `selected` exclusive to the toggle variant. Cheaper alternative: leave the runtime as-is but narrow the type so the bad combination becomes a TypeScript error.

### IN-02: `acquisitionDate` from `findViewerWatchByCatalogId` is mis-typed as nullable

**File:** `src/app/catalog/[catalogId]/page.tsx:282, 301-304`
**Issue:** Function signature declares the return as `{ id: string; acquisitionDate: string | null } | null`, but the implementation always computes `iso` to a non-null string (via the `row.acquisitionDate ?? new Date(row.createdAt).toISOString()` fallback). The caller then writes `viewerOwnedRow.acquisitionDate ?? new Date().toISOString()` (line 108), a dead `??` fallback. The bug exists in pre-existing code and was not authored in this phase, so it is out of strict review scope — flagged because the file is being touched and the right-typed signature (`acquisitionDate: string`) would eliminate the dead branch and make the intent clearer.
**Fix:** Tighten the return type and drop the dead `??` at the call site:

```ts
async function findViewerWatchByCatalogId(
  userId: string,
  catalogId: string,
): Promise<{ id: string; acquisitionDate: string } | null> { ... }

// caller:
ownedAtIso: viewerOwnedRow.acquisitionDate,
```

### IN-03: `ERA_DISPLAY_LABELS` duplicated between `EraChips.tsx` and `SearchPageClient.tsx`

**File:** `src/components/search/EraChips.tsx:7-11`, `src/components/search/SearchPageClient.tsx:319-323`
**Issue:** Both files maintain identical `ERA_DISPLAY_LABELS` constants. The comment on `EraChips.tsx:6` even acknowledges the duplication: "identical to SearchPageClient's ERA_DISPLAY_LABELS." Two copies will drift the first time anyone adds an era signal or relabels one. The era vocab itself (`ERA_SIGNALS`) is already exported from `@/lib/taste/vocab`; the label map belongs alongside it (or in a shared `src/lib/taste/displayLabels.ts`).
**Fix:** Hoist `ERA_DISPLAY_LABELS` (and the `GENRE_DISPLAY_NAMES` map in `GenreChips.tsx:7-18`, which is also flagged as "copied from … explore/genres/page.tsx") into a single module under `src/lib/taste/` and import both from there.

### IN-04: `DrawerChips.test.tsx` mocks `PRIMARY_ARCHETYPES` to 4 entries — partial vocab coverage

**File:** `tests/components/search/DrawerChips.test.tsx:43-55`
**Issue:** The `@/lib/taste/vocab` mock returns `['dress', 'dive', 'field', 'pilot']` (4 of the real 10 archetypes), and the `ARCHETYPE_CONFIG` mock provides display names for the same 4. The `GenreChips` test then asserts `chips.length === 4`. If the real `PRIMARY_ARCHETYPES` constant grows or shrinks, this test silently keeps passing because the mock is decoupled from the actual vocab. This is acceptable for unit-test isolation but at minimum the comment should make the divergence explicit so a future maintainer doesn't read this test as a guarantee of full-vocab rendering.
**Fix:** Either (a) import the real `PRIMARY_ARCHETYPES` and assert `chips.length === PRIMARY_ARCHETYPES.length`, or (b) add a code comment noting that the vocab is mocked to a fixed-size subset so the count assertions are stable rather than representative.

---

_Reviewed: 2026-05-19T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
