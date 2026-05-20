---
phase: 48-user-facing-bug-fixes
fixed_at: 2026-05-19T22:20:20Z
review_path: .planning/phases/48-user-facing-bug-fixes/48-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 48: Code Review Fix Report

**Fixed at:** 2026-05-19T22:20:20Z
**Source review:** `.planning/phases/48-user-facing-bug-fixes/48-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (CR/BL/WR; IN findings out of scope per `fix_scope: critical_warning`)
- Fixed: 4
- Skipped: 0

All 4 warnings were applied cleanly. IN-01 (`selected` no-op on `removable`)
was incidentally resolved by the WR-02 discriminated-union refactor — the
reviewer explicitly tied the two together in the WR-02 fix sketch, and the
`selected?: never` branch on the `removable` shape now makes the bad
combination a TypeScript error. IN-01 is therefore noted in the WR-02 commit
message and is no longer reachable; IN-02, IN-03, IN-04 remain open.

Verification: targeted test suites green after each commit (Tier 1 read-back
+ Tier 2 vitest run on affected specs + targeted `tsc --noEmit` filtered to
modified files). Full `npx vitest run` after all commits: **5285 passed**,
2 unrelated pre-existing failures in `tests/integration/backfill-taste.test.ts`
(env-resolution issue: `node: .env.local: not found`; last touched in phase 44
commit `b2356d9`, unrelated to the chip primitive or catalog page).

## Fixed Issues

### WR-04: `Chip` prop spread can override `type="button"`

**Files modified:** `src/components/ui/chip.tsx`
**Commit:** `825837e`
**Applied fix:** Moved `type="button"` to AFTER the `{...props}` spread on the
`<button>` element. A consumer passing `type="submit"` (intentional or stray)
can no longer flip Chip into a form submitter — the safe default now wins
unconditionally. Added an inline comment cross-referencing the convention
shadcn primitives (Button, Switch) use.

### WR-02: Removable `Chip` with no `onClick` still renders the X dismiss affordance
### IN-01: `selected` prop is silently no-op on `Chip variant="removable"`

**Files modified:** `src/components/ui/chip.tsx`, `tests/components/ui/chip.test.tsx`
**Commit:** `ca951da`
**Applied fix:** Replaced the single-shape `ChipProps` type with a discriminated
union over `variant`:

- The `'toggle'` branch keeps `selected?: boolean` and bans `removeLabel` via
  `removeLabel?: never`.
- The `'removable'` branch makes `onClick` required (re-typed as
  `React.MouseEventHandler<HTMLButtonElement>` after `Omit`-ing the inherited
  optional `onClick` from `ButtonHTMLAttributes`), bans `selected` via
  `selected?: never`, and exposes `removeLabel?: string`.

Function body uses `props as { ... }` (a single localized cast) to keep the
existing destructure ergonomic without leaking the union shape into the JSX
expression. Updated test 7 in `chip.test.tsx` to pass an explicit no-op
`onClick={vi.fn()}` so the test compiles under the new discriminated union
(the test was previously calling `<Chip variant="removable">Label</Chip>` with
no handler — exactly the foot-gun the new types now reject at compile time).

IN-01 (silent `selected` no-op on removable) is solved by the same refactor —
the reviewer's WR-02 fix sketch explicitly noted "Same discriminated-union
refactor suggested in WR-02 keeps `selected` exclusive to the toggle variant."
`<Chip variant="removable" selected>` is now a TypeScript error rather than
a silent paint-no-op.

### WR-03: `WatchesPanel` clear-callbacks are typed optional but the chip primitive renders a dismiss UI unconditionally

**Files modified:** `src/components/search/SearchPageClient.tsx`
**Commit:** `ba1b180`
**Applied fix:** Dropped the `?` on `onClearBrand`, `onClearEra`, `onClearGenre`,
and `onClearArchetype` in the inline `WatchesPanel` prop type. `WatchesPanel`
has exactly one caller (`SearchPageClient.tsx:189`) and it already supplies all
four handlers; there is no semantic case for a future refactor to drop one. The
required typing now closes the foot-gun: dropping a handler is a compile error,
and pairs with WR-02's discriminated union (which also makes `onClick`
required on `Chip variant="removable"` consumers — so the two layers reinforce
each other).

### WR-01: BUG-01 regression tests bypass the SQL predicate they claim to guard

**Files modified:** `tests/app/catalog-page.test.ts`
**Commit:** `8323aca`
**Applied fix:** Two changes:

1. Hoisted the `where()` mock (`mockDbWhere`) into the `vi.hoisted(() => ({...}))`
   block alongside `mockDbLimit` so the predicate argument can be inspected.
   The `@/db` mock factory now passes `mockDbWhere` directly to the chain
   (previously `where()` was an inline `vi.fn(() => ({ limit }))` that discarded
   the predicate arg).
2. Added a new positive-control test:
   `BUG-01 — query is scoped to status='owned' (predicate guard)`.
   It walks the Drizzle predicate AST with a circular-safe recursive visitor
   (WeakSet seen-set + depth cap; raw `JSON.stringify` throws on the
   `PgTable → PgUUID → table` back-reference cycle) and asserts the literal
   string `'owned'` is reachable as a leaf. If a future commit removes the
   `eq(watchesTable.status, 'owned')` conjunct, the parameter value disappears
   from the AST and this assertion fails — closing the regression window the
   three existing BUG-01 tests left open.

The three pre-existing `wishlist`/`grail`/`sold` BUG-01 tests are left intact
as they still exercise the "non-owned row collapses to cross-user framing"
path end-to-end; they are now joined (not replaced) by the predicate guard, so
both the query shape and the routing behavior are protected.

---

_Fixed: 2026-05-19T22:20:20Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
