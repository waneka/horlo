# Phase 48: User-Facing Bug Fixes - Research

**Researched:** 2026-05-19
**Domain:** Next.js App Router, Drizzle ORM, Tailwind CSS 4, CVA chip primitives, Vitest
**Confidence:** HIGH

## Summary

Phase 48 addresses two live production bugs — a catalog ownership mislabel (BUG-01) and dark-mode chip contrast failure (BUG-02) — plus a chip consolidation refactor. CONTEXT.md has locked both root causes and the fix strategies. This research focuses on the four specific questions the planner needs answered: the exact query shape to add a `status = 'owned'` filter, the precise `viewerOwnedRow` flow into `verdict.framing`, the chip className inventory across all 8 surfaces, and the dark/light token values to select the correct foreground replacement.

**Primary recommendation:** All three workstreams (BUG-01 one-line query fix, BUG-02 CVA primitive extraction + token swap) are independently containable changes. Execute BUG-01 first (lowest risk, largest UX impact), then build the chip primitive with BUG-02's token fix baked in, then migrate all 8 surfaces.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Ownership-state query filter | API / Backend (Server Component) | — | `findViewerWatchByCatalogId` is a server-side Drizzle query inside `CatalogPage` (RSC) |
| Verdict framing selection | API / Backend (Server Component) | — | `verdict.framing` is assembled server-side in page.tsx and passed as prop to `CollectionFitCard` |
| `YouOwnThisCallout` render | Frontend (Client or RSC component) | — | `CollectionFitCard` is a pure renderer; framing decision is upstream in page.tsx |
| Chip token/style correctness | Browser / Client | — | Tailwind utility classes applied in client components; token values resolve at paint time |
| Chip primitive (CVA) | Browser / Client | — | `FilterDrawer` chips and `SearchPageClient` inline chips are both `'use client'` |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01/D-02:** Root cause is `findViewerWatchByCatalogId` lacking a `status = 'owned'` filter. Fix: restrict to `status = 'owned'` only.
- **D-03:** Non-owned watches fall through to the existing cross-user verdict path. No new "On your wishlist" callout.
- **D-04:** Root cause of BUG-02: inline chips use `text-accent-foreground`; in dark mode `--accent-foreground` is `oklch(0.14 ...)` (near-black) on a barely-tinted dark surface.
- **D-05:** Fix keeps `bg-accent/10` tinted pill; swaps `text-accent-foreground` for a legible foreground token. Do NOT restyle to solid `bg-accent` selected-pill look.
- **D-06:** The 7 drawer chip components are NOT broken themselves but are consolidated per D-07.
- **D-07:** Extract one shared chip primitive into `src/components/ui/`.
- **D-08:** Drawer toggle chips and inline removable chips must be visually consistent post-consolidation. A `/gsd-ui-phase 48` design contract is warranted.
- **D-09:** The BUG-02 dark-mode fix lands inside the new shared primitive.
- **D-10:** Extend `tests/app/catalog-page.test.ts` rather than starting fresh.

### Claude's Discretion
- Chip primitive variant model — recommended: CVA-based with `toggle` variant (selected/unselected) and `removable` variant (with trailing X). Final API shape is the planner's call.
- Exact legible foreground token for D-05 — pick whatever the unified chip design settles on.

### Deferred Ideas (OUT OF SCOPE)
- Positive "On your wishlist" callout on `/catalog/[catalogId]`
- Architecture question of whether `/catalog/[catalogId]` and `/watch/[id]` should merge (Phase 50 / ARCH-01)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BUG-01 | Wishlist watches viewed via `/catalog/[catalogId]` display correct ownership state — never "you own this watch" | D-01/D-02: add `eq(watchesTable.status, 'owned')` to `findViewerWatchByCatalogId`; regression test in existing test file |
| BUG-02 | `/search` filter chips render with legible text contrast in dark mode across all chip groups | D-04/D-05: swap `text-accent-foreground` for `text-foreground` (or `text-accent`) in the new shared chip primitive; verified token values below |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | already installed | ORM for Drizzle queries with `and()`, `eq()` helpers | Project standard; existing `findViewerWatchByCatalogId` already uses these |
| class-variance-authority (CVA) | `^0.7.1` | Variant-based className composition for the chip primitive | Already a project dependency; `badge.tsx` and `button.tsx` use identical CVA pattern |
| tailwind-merge + clsx via `cn()` | installed | Class merging for chip className overrides | Project-standard `cn()` helper at `src/lib/utils.ts` |
| vitest | installed | Test framework for BUG-01 regression tests | Project standard; `vitest.config.ts` present; existing catalog-page tests in vitest |

[VERIFIED: codebase grep — all libraries confirmed present in src/]

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@base-ui/react` | `^1.3.0` | Headless button primitive (optional for chip) | The existing `button.tsx` wraps `@base-ui/react/button`; the chip primitive may use a plain `<button>` or this primitive — discretion of planner |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CVA chip primitive | plain className string | CVA is already the project pattern (badge, button); a plain string approach creates more divergence, not less |

## BUG-01 Deep Dive: `findViewerWatchByCatalogId` Query

[VERIFIED: codebase read — src/app/catalog/[catalogId]/page.tsx lines 279-301]

### Current Query (lines 279-301)
```typescript
async function findViewerWatchByCatalogId(
  userId: string,
  catalogId: string,
): Promise<{ id: string; acquisitionDate: string | null } | null> {
  const rows = await db
    .select({
      id: watchesTable.id,
      acquisitionDate: watchesTable.acquisitionDate,
      createdAt: watchesTable.createdAt,
    })
    .from(watchesTable)
    .where(and(eq(watchesTable.userId, userId), eq(watchesTable.catalogId, catalogId)))
    //          ^--- missing: eq(watchesTable.status, 'owned')
    .limit(1)
  // ...
}
```

### The Fix

Add a third condition to the `and()` call:
```typescript
.where(and(
  eq(watchesTable.userId, userId),
  eq(watchesTable.catalogId, catalogId),
  eq(watchesTable.status, 'owned'),   // BUG-01 fix — only truly owned rows trigger callout
))
```

The `status` column in `src/db/schema.ts` (line 91) is defined as:
```typescript
status: text('status', { enum: ['owned', 'wishlist', 'sold', 'grail'] }).notNull(),
```

[VERIFIED: codebase grep of schema.ts line 91]

The `watchesTable.status` field is already available on the table object — no import changes needed; `eq` is already imported from `drizzle-orm`.

### `viewerOwnedRow` Flow (page.tsx lines 104-169)

```
findViewerWatchByCatalogId() returns non-null
  → viewerOwnedRow is truthy
  → verdict = { framing: 'self-via-cross-user', ... }   (line 107)
  → actionsSpec remains null                             (line 111 comment: "do NOT render CTAs")
  → CollectionFitCard receives framing='self-via-cross-user'
  → CollectionFitCard renders YouOwnThisCallout (line 30-31 of CollectionFitCard.tsx)
```

After the fix, a `wishlist`/`grail`/`sold` row makes `findViewerWatchByCatalogId` return `null`. Page falls into the `else if (collection.length > 0)` branch (line 113), which computes the full cross-user verdict — the correct path per D-03.

### Regression Risk

The existing test at line 157 ("renders 'You own this watch' callout when viewer already owns this catalog ref") sets `mockDbLimit` to a row that has no status field — the mock bypasses the DB layer entirely, so the test correctly continues to test the owned path after the fix. No mock changes are needed for the positive owned-path test.

The new regression tests (D-10) must:
1. Mock `mockDbLimit.mockResolvedValue([])` to simulate a `wishlist` watch NOT being returned (which is what the fixed query achieves)
2. Assert that `framing: 'cross-user'` verdict is computed (mockComputeVerdictBundle is called)
3. Assert "You own this watch" / `self-via-cross-user` does NOT appear

There is no mock for `@/data/profiles` in `catalog-page.test.ts` currently. [VERIFIED: grep confirmed not present] The page calls `getProfileById(user.id)` in the `Promise.all` (line 66). Vitest's module mocking will throw or return `undefined` for an unmocked module. Checking whether this is already causing issues:

**The current tests pass** — all 8 tests pass (confirmed via `npx vitest run`). This means `getProfileById` is somehow resolving. Looking more carefully: `getProfileById` is in `@/data/profiles`, but the tests do NOT mock it. Since vitest uses the actual module, this might auto-return `null` or there may be a profiles mock in `tests/setup.tsx`. **The planner must mock `@/data/profiles` when adding new tests** if the existing tests already handle it (or confirm the setup mock covers it).

[ASSUMED] The reason existing tests pass without mocking `@/data/profiles` is likely either that the module has a fallback or the test setup file handles it. The planner should check `tests/setup.tsx` before writing new tests.

## BUG-02 Deep Dive: Dark-Mode Token Analysis

[VERIFIED: codebase read — src/app/globals.css lines 55-122]

### Token Values

| Token | Light mode (`:root`) | Dark mode (`.dark`) |
|-------|---------------------|---------------------|
| `--accent` | `oklch(0.76 0.12 75)` — golden/warm, L=0.76 | `oklch(0.78 0.13 75)` — similar golden, L=0.78 |
| `--accent-foreground` | `oklch(0.18 0.01 75)` — near-black, L=0.18 | `oklch(0.14 0.005 75)` — near-black, L=0.14 |
| `--secondary` | `oklch(0.96 0.005 75)` — near-white | `oklch(0.26 0.005 75)` — dark gray |
| `--secondary-foreground` | `oklch(0.22 0.005 75)` — near-black | `oklch(0.96 0.005 75)` — near-white |
| `--foreground` | `oklch(0.18 0.01 75)` — near-black | `oklch(0.96 0.005 75)` — near-white |
| `--background` | `oklch(0.985 0.003 75)` — near-white | `oklch(0.14 0.005 75)` — near-black |

### Why `text-accent-foreground` Fails in Dark Mode

`bg-accent/10` in dark mode = `oklch(0.78 0.13 75 / 10%)` layered on a dark surface (~L=0.14-0.19). The effective background luminance is approximately L=0.15-0.20 (very dark).

`text-accent-foreground` in dark mode = `oklch(0.14 0.005 75)` — **L=0.14, near-black**.

Black text on a very dark surface: contrast ratio is near 1:1. This is the confirmed bug.

### Token Candidates for the Fix (D-05)

| Token | Dark mode value | Contrast on `bg-accent/10` dark surface | Verdict |
|-------|-----------------|----------------------------------------|---------|
| `text-foreground` | `oklch(0.96 0.005 75)` — near-white, L=0.96 | Excellent (L=0.96 on L~0.17) | **Recommended** |
| `text-accent` | `oklch(0.78 0.13 75)` — golden, L=0.78 | Good (L=0.78 on L~0.17) | Viable |
| `text-secondary-foreground` | `oklch(0.96 0.005 75)` — same as foreground | Excellent | Same as foreground |

**Recommendation:** Use `text-foreground` for the removable chip text. In light mode `--foreground` is `oklch(0.18 0.01 75)` (near-black) which is legible on a light `bg-accent/10` tinted pill (~L=0.95). In dark mode it flips to near-white. This is the most semantically correct choice and requires no dark-mode-specific override.

### Light Mode Verification

Removable chip on light mode: `bg-accent/10` = `oklch(0.76 0.12 75 / 10%)` on `--background` L=0.985 → effective L~0.975 (very light). `text-foreground` in light = L=0.18 (near-black). Contrast: excellent.

## Chip Surface Inventory: All 8 Surfaces

[VERIFIED: codebase read — all 7 drawer chip components + SearchPageClient.tsx]

### Surface 1: `BrandChips.tsx` (toggle, single-select)
```
unselected: 'bg-secondary text-secondary-foreground border-border hover:bg-muted'
selected:   'bg-accent text-accent-foreground border-accent font-semibold'
```
Props: `selected: string | null`, `onSelect: (value: string | null) => void`, `vocab: { slug: string; name: string }[]`

### Surface 2: `EraChips.tsx` (toggle, single-select)
```
unselected: 'bg-secondary text-secondary-foreground border-border hover:bg-muted'
selected:   'bg-accent text-accent-foreground border-accent font-semibold'
```
Props: `selected: string | null`, `onSelect: (value: string | null) => void` (vocab is internal — ERA_SIGNALS constant)

### Surface 3: `GenreChips.tsx` (toggle, single-select)
```
unselected: 'bg-secondary text-secondary-foreground border-border hover:bg-muted'
selected:   'bg-accent text-accent-foreground border-accent font-semibold'
```
Props: `selected: string | null`, `onSelect: (value: string | null) => void` (vocab is internal — PRIMARY_ARCHETYPES)

### Surface 4: `ArchetypeChips.tsx` (toggle, single-select)
```
unselected: 'bg-secondary text-secondary-foreground border-border hover:bg-muted'
selected:   'bg-accent text-accent-foreground border-accent font-semibold'
```
Props: `selected: string | null`, `onSelect: (value: string | null) => void` (vocab is internal — PRIMARY_ARCHETYPES with ARCHETYPE_CONFIG display names)

### Surface 5: `MovementChips.tsx` (toggle, single-select)
```
unselected: 'bg-secondary text-secondary-foreground border-border hover:bg-muted'
selected:   'bg-accent text-accent-foreground border-accent font-semibold'
```
Props: `selected: string | null`, `onSelect: (value: string | null) => void` (vocab is internal — MOVEMENT_OPTIONS)

### Surface 6: `CaseSizeChips.tsx` (toggle, single-select)
```
unselected: 'bg-secondary text-secondary-foreground border-border hover:bg-muted'
selected:   'bg-accent text-accent-foreground border-accent font-semibold'
```
Props: `selected: string | null`, `onSelect: (value: string | null) => void` (vocab is internal — CASE_SIZE_OPTIONS)

### Surface 7: `StyleChips.tsx` (toggle, **multi-select**)
```
unselected: 'bg-secondary text-secondary-foreground border-border hover:bg-muted'
selected:   'bg-accent text-accent-foreground border-accent font-semibold'
```
Props: `selected: string[]`, `onSelect: (value: string[]) => void`, `vocab: string[]`

**Divergence:** StyleChips accepts `string[]` (array) not `string | null` for `selected`. The primitive must accommodate both single-select and multi-select interaction patterns. The planner should decide whether the chip component itself tracks selection state or the parent always passes `aria-pressed` as a boolean per-chip (the current per-button `isSelected` pattern makes the primitive stateless — each parent computes `isSelected`; this is the cleaner approach).

### Surface 8: Inline removable chips in `SearchPageClient.tsx` (removable, not togglable)

Four chip instances appear **twice** in SearchPageClient (once in the zero-results branch, once in the results branch) — same className pattern, same 4 facets (archetype, brand, era, genre).

```
className="inline-flex items-center gap-1 rounded-full border border-accent bg-accent/10 px-3 py-1 text-sm font-semibold text-accent-foreground hover:bg-accent/20 transition-colors"
```

This is the **broken pattern** — `text-accent-foreground` is near-black in dark mode.

**Structural divergence from drawer chips:**
- Contains an `X` icon (`<X className="size-3" aria-hidden />`) and an `sr-only` "Remove [label] filter" span
- Uses `border-accent bg-accent/10` (tinted pill), NOT `bg-accent` solid
- Has no selected/unselected state — it is always "active" (always visible when the facet is set)
- onClick clears the facet entirely (not a toggle)

**The same removable chip block appears at two places in SearchPageClient:**
- Lines ~410-454 (zero-results / "No watches match these filters" branch)
- Lines ~491-537 (results branch)

Both blocks are identical markup and classes. Post-consolidation, both should use the new `removable` chip variant.

### Summary of Divergences the Primitive Must Handle

| Property | Drawer toggle chips (7) | Inline removable chips (2×4 in SearchPageClient) |
|----------|------------------------|--------------------------------------------------|
| Visual background | `bg-secondary` (unselected) / `bg-accent` solid (selected) | `bg-accent/10` always |
| Border | `border-border` (unselected) / `border-accent` (selected) | `border-accent` always |
| Text color | `text-secondary-foreground` (unselected) / `text-accent-foreground` (selected) | `text-accent-foreground` (broken → fix to `text-foreground`) |
| Trailing icon | None | `<X className="size-3">` + sr-only label |
| Hover | `hover:bg-muted` (unselected) | `hover:bg-accent/20` |
| Font weight | Normal (unselected) / `font-semibold` (selected) | `font-semibold` always |
| Interaction | Toggle (press again to deselect) | One-shot clear |

**Note:** The drawer chips' selected state (`bg-accent text-accent-foreground`) is on a SOLID accent background (L=0.76/0.78) — so `text-accent-foreground` is L=0.18/0.14 (near-black) on a mid-light background. This contrast is adequate in both modes. The token pair is only broken in the removable chips because they use `bg-accent/10` (near-transparent) instead of `bg-accent` solid.

Post-D-08 unification: the design contract (from `/gsd-ui-phase 48`) will dictate whether the removable chips should look exactly like unselected drawer chips, selected drawer chips, or keep their distinct tinted appearance. The planner should wait for the UI design contract before finalizing the `removable` variant's background/foreground pair.

## Architecture Patterns

### Recommended Project Structure

No new directories needed. The chip primitive goes in the existing `src/components/ui/` directory alongside `button.tsx`, `badge.tsx`, etc.

```
src/
├── components/
│   ├── ui/
│   │   └── chip.tsx         # new — shared chip primitive (toggle + removable variants)
│   ├── search/
│   │   ├── BrandChips.tsx   # refactored to use <Chip> primitive
│   │   ├── EraChips.tsx     # refactored
│   │   ├── GenreChips.tsx   # refactored
│   │   ├── ArchetypeChips.tsx  # refactored
│   │   ├── MovementChips.tsx   # refactored
│   │   ├── CaseSizeChips.tsx   # refactored
│   │   └── StyleChips.tsx   # refactored
│   └── search/
│       └── SearchPageClient.tsx  # removable chip instances replaced with <Chip variant="removable">
```

### Pattern: CVA Chip Primitive

CVA is already used for `badge.tsx` and `button.tsx` — the pattern is project-established.

```typescript
// Source: src/components/ui/badge.tsx (existing CVA pattern in project)
// Proposed chip primitive follows the same structure:
const chipVariants = cva(
  // base classes shared by all chips
  'inline-flex items-center rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
  {
    variants: {
      variant: {
        // toggle chips (drawer): 2 states driven by `selected` prop
        toggle: 'bg-secondary text-secondary-foreground border-border hover:bg-muted',
        toggleSelected: 'bg-accent text-accent-foreground border-accent font-semibold',
        // removable chips (inline): always-active tinted pill with X
        removable: 'gap-1 bg-accent/10 border-accent text-foreground font-semibold hover:bg-accent/20',
        //                                                 ^--- text-foreground: the BUG-02 fix
      },
    },
    defaultVariants: {
      variant: 'toggle',
    },
  },
)
```

The planner may choose to use a single `toggle` variant + a `selected` boolean compound variant instead of two separate toggle/toggleSelected variants. Both approaches work; the planner decides.

**Note:** The `removable` variant must wrap an `<X>` icon + sr-only text inside the button. The primitive should accept `onRemove` + `removeLabel` (or `children` + `onRemove`) as props, or the caller can compose the X icon inline. Planner decides — either approach is consistent with project conventions.

### Anti-Patterns to Avoid
- **Hardcoding colors:** BUG-02 fix must use theme tokens, not hardcoded values. The `feedback_ui_spec_css_chain_blind_spot` memory explicitly flags asserting CSS chains on token-driven styling.
- **Breaking the existing selected-state contrast:** Drawer chips' `bg-accent text-accent-foreground` on solid accent background IS fine — do not change it trying to fix BUG-02.
- **Treating wishlist/grail/sold as owned:** The fix must be surgical — only add `status = 'owned'` to the query; do not touch the framing logic or VerdictBundle shapes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Variant-based chip classNames | Manual ternary/template strings per chip | CVA `chipVariants` | CVA is the project pattern; `badge.tsx` and `button.tsx` prove it |
| Multi-status DB filter | Custom raw SQL | Drizzle `eq(watchesTable.status, 'owned')` inside existing `and()` | Drizzle's type-safe filter builder is already in use in the same function |

## Runtime State Inventory

Step 2.5: SKIPPED — this is a code-only fix phase with no rename/refactor/migration.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| vitest | BUG-01 regression tests | ✓ | 2.1.9 | — |
| Node.js / npm | dev server, test runner | ✓ | present | — |

[VERIFIED: `npx vitest run tests/app/catalog-page.test.ts` passes all 8 tests]

## Common Pitfalls

### Pitfall 1: Missing `@/data/profiles` Mock in New Tests
**What goes wrong:** `getProfileById` is called in `CatalogPage`'s `Promise.all` (line 66) but is NOT mocked in the existing `catalog-page.test.ts`. Current tests pass anyway — likely because the import resolves to a module that returns `null` safely, or the test setup file intercepts it.
**Why it happens:** The existing tests were written when `getProfileById` was added to the page; the test author may have relied on the module's own behavior.
**How to avoid:** Before writing new test cases, verify `tests/setup.tsx` and confirm whether `@/data/profiles` needs an explicit mock. If it does, add `vi.mock('@/data/profiles', ...)` following the pattern from `tests/app/watch-new-page.test.ts`.
**Warning signs:** Test runtime error mentioning `profiles` or `getProfileById` returning undefined unexpectedly.

[ASSUMED] Root cause of the profiles mock omission — investigate in Wave 0 test setup.

### Pitfall 2: Forgetting the Duplicate Chip Block in SearchPageClient
**What goes wrong:** The removable facet chips appear in TWO places in `SearchPageClient.tsx` — once in the zero-results branch (~lines 410-454) and once in the normal results branch (~lines 491-537). Fixing only one leaves the bug alive in the other branch.
**Why it happens:** The page renders two separate JSX trees (zero-results vs results) and copies the chip block into each.
**How to avoid:** The chip consolidation should replace BOTH occurrences with the shared primitive. The plan should call out both locations explicitly.
**Warning signs:** Bug visible only on zero-results pages but not results pages (or vice versa) after the fix.

### Pitfall 3: Regressing the Owned-Path Positive Test
**What goes wrong:** After adding `status = 'owned'` to the query, the test that asserts "You own this watch" callout must still pass. The mock (`mockDbLimit`) returns a row object that does not include a `status` field — the mock bypasses Drizzle entirely, so it still returns the row and the page still renders the callout. This is correct behavior.
**Why it happens:** The test mocks the entire Drizzle chain at the `.limit()` return; the `where()` filter never executes in tests.
**How to avoid:** Do not change the existing positive-owned-path test mock. Verify all 8 existing tests still pass after the one-line query fix.
**Warning signs:** The "renders You own this watch callout" test fails after the BUG-01 fix.

### Pitfall 4: Dark/Light Token Assumptions
**What goes wrong:** A token that looks legible in light mode may still fail in dark mode if its dark-mode value is not checked.
**Why it happens:** Globals.css defines two sets of values; it is easy to check only one.
**How to avoid:** For every token used in a chip class, verify both the `:root` and `.dark` values in globals.css (table above). Use the `@custom-variant dark (&:is(.dark *))` pattern — all `.dark` overrides in this project are class-based, not media-query-based.
**Warning signs:** Chip looks fine in light mode but dark mode still fails.

## Code Examples

### BUG-01 Fix — One-Line Query Change
```typescript
// Before (in src/app/catalog/[catalogId]/page.tsx ~line 290):
.where(and(eq(watchesTable.userId, userId), eq(watchesTable.catalogId, catalogId)))

// After:
.where(and(
  eq(watchesTable.userId, userId),
  eq(watchesTable.catalogId, catalogId),
  eq(watchesTable.status, 'owned'),
))
// Source: VERIFIED codebase read of page.tsx + schema.ts
```

### BUG-01 Regression Test Pattern (new tests to add to catalog-page.test.ts)
```typescript
// Source: extending existing test at tests/app/catalog-page.test.ts line 157
it('BUG-01 — wishlist watch does NOT trigger "You own this watch" callout', async () => {
  mockGetCatalogById.mockResolvedValue(baseCatalogEntry)
  mockGetWatchesByUser.mockResolvedValue([{ id: 'mine-1' }])
  // Fixed query returns [] for wishlist status — mock the fixed behavior
  mockDbLimit.mockResolvedValue([])  // status='wishlist' row is NOT returned
  await CatalogPage({ params: Promise.resolve({ catalogId: validCatalogId }) })
  // Cross-user verdict is computed, not the self-owned path
  expect(mockComputeVerdictBundle).toHaveBeenCalledTimes(1)
  expect(mockComputeVerdictBundle.mock.calls[0][0].framing).toBe('cross-user')
})

it('BUG-01 — actually-owned watch still shows "You own this watch" (regression guard)', async () => {
  mockGetCatalogById.mockResolvedValue(baseCatalogEntry)
  mockGetWatchesByUser.mockResolvedValue([{ id: 'mine-1' }])
  mockDbLimit.mockResolvedValue([{
    id: 'per-user-uuid',
    acquisitionDate: '2026-04-12',
    createdAt: new Date('2026-04-12T00:00:00.000Z'),
  }])
  const result = await CatalogPage({ params: Promise.resolve({ catalogId: validCatalogId }) })
  expect(JSON.stringify(result)).toMatch(/self-via-cross-user/)
  expect(mockComputeVerdictBundle).not.toHaveBeenCalled()
})
```

### BUG-02 Fix — CVA Chip Primitive (proposed structure)
```typescript
// Source: follows existing badge.tsx CVA pattern (VERIFIED: src/components/ui/badge.tsx)
'use client'

import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const chipVariants = cva(
  'inline-flex items-center rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
  {
    variants: {
      variant: {
        toggle: 'bg-secondary text-secondary-foreground border-border hover:bg-muted',
        toggleSelected: 'bg-accent text-accent-foreground border-accent font-semibold',
        removable: 'gap-1 bg-accent/10 border-accent text-foreground font-semibold hover:bg-accent/20',
        //                                              ^--- text-foreground replaces text-accent-foreground
        //                                                   Light: oklch(0.18) on L~0.975 = legible
        //                                                   Dark:  oklch(0.96) on L~0.17 = legible
      },
    },
    defaultVariants: { variant: 'toggle' },
  },
)

export { chipVariants }
export type ChipVariants = VariantProps<typeof chipVariants>
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/app/catalog-page.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BUG-01 | Wishlist watch on `/catalog/[catalogId]` does NOT render `self-via-cross-user` framing | unit | `npx vitest run tests/app/catalog-page.test.ts` | ✅ (extend existing) |
| BUG-01 | Owned watch still renders `self-via-cross-user` (regression guard) | unit | `npx vitest run tests/app/catalog-page.test.ts` | ✅ (test at line 157 stays) |
| BUG-01 | `grail` and `sold` watches also do NOT trigger callout | unit | `npx vitest run tests/app/catalog-page.test.ts` | ❌ Wave 0: add to test file |
| BUG-02 | Chip primitive `removable` variant uses `text-foreground` not `text-accent-foreground` | unit / static | `npx vitest run tests/` | ❌ Wave 0: new test or static grep |
| BUG-02 | All 8 chip surfaces migrated to shared primitive | static | `grep -rn "text-accent-foreground" src/components/search/` returns 0 hits | ❌ Wave 0: post-migration assertion |

### BUG-02 Contrast Test Approach

Dark-mode CSS token assertions in a jsdom environment cannot test rendered paint values (jsdom does not resolve CSS custom properties). The appropriate validation approach:

1. **Static assertion:** After chip consolidation, `grep -rn "text-accent-foreground" src/components/search/` should return 0 hits — all chip surfaces should use the primitive, which uses `text-foreground` in the `removable` variant.
2. **Unit test on chipVariants:** A simple unit test can assert that `chipVariants({ variant: 'removable' })` includes `text-foreground` and does NOT include `text-accent-foreground`.
3. **Manual dark-mode verification:** Visual check in the dev server with `.dark` applied — this is the only way to fully verify contrast ratio (per the `feedback_ui_spec_css_chain_blind_spot` memory warning).

### Sampling Rate
- **Per task commit:** `npx vitest run tests/app/catalog-page.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] New test cases in `tests/app/catalog-page.test.ts` — BUG-01 regression for `wishlist` (and ideally `grail`/`sold`) statuses
- [ ] `@/data/profiles` mock audit — confirm whether `tests/setup.tsx` or existing mock infrastructure covers `getProfileById` in `catalog-page.test.ts` context before writing new assertions
- [ ] Optional: `tests/components/ui/chip.test.tsx` — unit test asserting `chipVariants({ variant: 'removable' })` does not contain `text-accent-foreground`

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The reason `catalog-page.test.ts` passes without mocking `@/data/profiles` is that the module returns null safely or the setup file handles it | BUG-01 Deep Dive — Pitfall 1 | New test cases might fail at test collection if `getProfileById` throws; add the mock as a precaution |
| A2 | The `/gsd-ui-phase 48` design contract will preserve the tinted-pill (`bg-accent/10`) look for removable chips (per D-05 "do NOT restyle to solid") | Chip primitive — removable variant | If the design contract chooses a different background, the `removable` variant background must change; but `text-foreground` remains correct |

## Open Questions (RESOLVED)

> Both questions answered inline with recommendations; resolutions implemented in plans 48-01 (Q2: profiles mock) and 48-03 (Q1: stateless `selected: boolean`).

1. **`StyleChips` multi-select interaction in the primitive**
   - What we know: StyleChips accepts `selected: string[]` (array) not `string | null`
   - What's unclear: Whether the chip primitive should accept `selected: boolean` (caller pre-computes `isSelected`) or the primitive handles selection state internally
   - Recommendation: Keep the primitive stateless — accept `selected: boolean` as a prop; the parent chip component (BrandChips, StyleChips, etc.) continues to own selection logic. This matches the current pattern and avoids leaking selection state into the primitive.

2. **`@/data/profiles` mock gap in catalog-page.test.ts**
   - What we know: `getProfileById` is in `Promise.all` but not mocked in the test file; tests pass regardless
   - What's unclear: Why this works — setup intercept, module returning null, or something else
   - Recommendation: Check `tests/setup.tsx` in Wave 0 before adding new tests; add explicit mock if needed.

## Security Domain

This phase makes no authentication, authorization, session, or cryptographic changes. The `status = 'owned'` filter is additive to an existing query that is already scoped by both `userId` AND `catalogId` (T-20-06-01 — security comment in the query function). No ASVS concerns arise from narrowing a query filter.

## Sources

### Primary (HIGH confidence)
- `src/app/catalog/[catalogId]/page.tsx` — query shape at lines 279-301, framing logic at lines 104-169 [VERIFIED: codebase read]
- `src/db/schema.ts` line 91 — `status` column enum definition [VERIFIED: codebase grep]
- `src/app/globals.css` lines 55-122 — complete `:root` and `.dark` token values [VERIFIED: codebase read]
- `tests/app/catalog-page.test.ts` — all 8 existing tests, mock infrastructure, `baseCatalogEntry` shape [VERIFIED: codebase read + test run]
- `src/components/search/{BrandChips,EraChips,GenreChips,ArchetypeChips,MovementChips,CaseSizeChips,StyleChips}.tsx` — all 7 chip className patterns [VERIFIED: codebase read]
- `src/components/search/SearchPageClient.tsx` lines 408-537 — inline removable chip className pattern (2 occurrences) [VERIFIED: codebase read]
- `src/components/ui/button.tsx`, `src/components/ui/badge.tsx` — established CVA patterns [VERIFIED: codebase read]
- `npx vitest run tests/app/catalog-page.test.ts` — 8/8 tests pass [VERIFIED: executed]

### Secondary (MEDIUM confidence)
- None needed — all findings verified against codebase source.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed present in codebase
- BUG-01 fix: HIGH — query shape and fix location confirmed by code read
- BUG-02 token analysis: HIGH — exact oklch values read from globals.css, contrast analysis is deterministic
- Chip inventory: HIGH — all 7 drawer chip files read; SearchPageClient read
- Test infrastructure: HIGH (existing tests); MEDIUM (profiles mock gap — one assumed claim)
- Chip primitive API: MEDIUM — depends on UI design contract from `/gsd-ui-phase 48`

**Research date:** 2026-05-19
**Valid until:** 2026-06-18 (stable codebase; token values and query structure unlikely to change)
