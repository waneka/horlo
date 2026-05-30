# Phase 72: Search Composition Fixes - Pattern Map

**Mapped:** 2026-05-30
**Files analyzed:** 4
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/data/catalog.ts` (modify `searchCatalogForAddFlow`) | service/DAL | CRUD (read) | `src/data/catalog.ts:395-468` (`searchCatalogWatches` WHERE clause) | exact — same file, same Drizzle builder set, same `and(...predicates)` spread pattern |
| `src/data/__tests__/catalog-search-tokens.test.ts` | test | CRUD (unit mock) | `src/data/__tests__/catalog-facets.test.ts` | exact — same file family, same `vi.mock('@/db')` chain-mock pattern |
| `src/components/watch/SearchEntry.tsx` (SRCH-02 + SRCH-03) | component (client) | request-response | `src/components/watch/SearchEntry.tsx:207-333` (existing composition) | self-referential — targeted prop addition + subtree relocation within the same file |
| `src/components/watch/SearchEntry.test.tsx` (extend with keyboard + footer tests) | test | request-response (RTL) | `src/components/watch/ConfirmStep.test.tsx:170-195` (keyboard) + `src/components/watch/SearchEntry.test.tsx:597-625` (footer-click) | exact — same test file extended; keyboard pattern from ConfirmStep |

---

## Pattern Assignments

### `src/data/catalog.ts` — `searchCatalogForAddFlow` SRCH-01 fix

**Analog:** `src/data/catalog.ts:395-468` (`searchCatalogWatches` predicate-array WHERE clause)

**Imports pattern** (lines 1-8 — already in place, no new imports needed):
```typescript
import 'server-only'
import { db } from '@/db'
import { brands, watches, watchesCatalog } from '@/db/schema'
import { and, arrayOverlaps, asc, between, desc, eq, ilike, inArray, isNotNull, or, sql } from 'drizzle-orm'
import type { SearchCatalogWatchResult } from '@/lib/searchTypes'
```
`and`, `or`, `ilike`, and `sql` are already imported — no additions required.

**Core pattern — AND-of-predicates spread** (lines 406-462, `searchCatalogWatches`):
```typescript
// Build a predicates array, then and(...predicates). Empty array → undefined → no WHERE.
// Pitfall 1 guard: and() with 0 args → undefined → Drizzle omits WHERE clause.
return predicates.length > 0 ? and(...predicates) : undefined
```

**Core SRCH-01 fix pattern** (lines 578-588, current single-token):
```typescript
// CURRENT (single-token, broken for multi-word):
const lowerQ = qTrimmed.toLowerCase()
const pattern = `%${lowerQ}%`
.where(
  or(
    ilike(watchesCatalog.brandNormalized, pattern),
    ilike(watchesCatalog.modelNormalized, pattern),
    queryNormalized.length > 0
      ? ilike(watchesCatalog.referenceNormalized, `%${queryNormalized}%`)
      : sql`false`,
  ),
)

// REPLACE WITH (D-02 + D-03 + D-04 — AND-of-ORs per token):
const tokens = qTrimmed.toLowerCase().split(/\s+/).filter(Boolean)
if (tokens.length === 0) return []

const tokenClauses = tokens.map((token) => {
  const colPattern = `%${token}%`
  const refToken = token.replace(/[^a-z0-9]+/g, '')
  return or(
    ilike(watchesCatalog.brandNormalized, colPattern),
    ilike(watchesCatalog.modelNormalized, colPattern),
    refToken.length > 0
      ? ilike(watchesCatalog.referenceNormalized, `%${refToken}%`)
      : sql`false`,
  )
})
.where(and(...tokenClauses))
```

**Security / parameterization discipline** (lines 537-540 docstring):
```
// All `q` interpolations use Drizzle parameterized template binds — never
// string-concatenated into SQL text (T-67-02-01 mitigation).
//
// D-04: pattern construction (`%${token}%`) happens in TypeScript;
// the resulting string is a bind parameter, NOT injected SQL text.
```
Apply the same docstring callout in the updated function — the T-67-02-01 mitigation note must stay accurate after the rewrite.

**Keep intact (do NOT touch):**
- `qTrimmed.length < SEARCH_ADD_FLOW_TRIM_MIN_LEN` early-return at line 552
- `queryNormalized` and `exactRefOrderTier` at lines 556-565 (reference-column exact-match tier stays)
- `stateRows` / `stateMap` hydration at lines 604-643 — unchanged
- The `.orderBy(exactRefOrderTier, ...)` and `.limit(SEARCH_ADD_FLOW_CANDIDATE_CAP)` unchanged

---

### `src/data/__tests__/catalog-search-tokens.test.ts` — NEW file

**Analog:** `src/data/__tests__/catalog-facets.test.ts` (lines 1-139)

**File header pattern** (lines 1-10):
```typescript
// src/data/__tests__/catalog-search-tokens.test.ts
//
// Phase 72 — searchCatalogForAddFlow multi-token regression tests (SRCH-01).
// Coverage (D-11):
//   - single-token "Brut" returns matching row (regression guard)
//   - multi-token "Brut Datejust" returns matching row (primary SRCH-01 fix)
//   - multi-token "Timex Weekender" returns matching row (primary SRCH-01 fix)
//   - token-order invariance: "Datejust Brut" returns same row as "Brut Datejust"
```

**Mock setup pattern** (lines 11-71 of `catalog-facets.test.ts`):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

type Call = { op: string; args: unknown[] }

let candidateRows: Array<{
  id: string
  brand: string
  model: string
  reference: string | null
  imageUrl: string | null
  ownersCount: number
  wishlistCount: number
}> = []
let stateRows: Array<{ catalogId: string | null; status: string }> = []
let calls: Call[] = []
let selectCount = 0

function makeCandidateChain() {
  const chain: Record<string, (...args: unknown[]) => unknown> = {
    from:    (...args) => { calls.push({ op: 'cand.from',    args }); return chain },
    where:   (...args) => { calls.push({ op: 'cand.where',   args }); return chain },
    orderBy: (...args) => { calls.push({ op: 'cand.orderBy', args }); return chain },
    limit:   (...args) => { calls.push({ op: 'cand.limit',   args }); return Promise.resolve(candidateRows) },
  } as never
  return chain
}

function makeStateChain() {
  const chain: Record<string, (...args: unknown[]) => unknown> = {
    from:  (...args) => { calls.push({ op: 'state.from',  args }); return chain },
    where: (...args) => { calls.push({ op: 'state.where', args }); return Promise.resolve(stateRows) },
  } as never
  return chain
}

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => {
      selectCount += 1
      return selectCount === 1 ? makeCandidateChain() : makeStateChain()
    }),
  },
}))

import { searchCatalogForAddFlow } from '@/data/catalog'
```
The `vi.mock('@/db')` must be hoisted (top of file). Import of the function under test (`searchCatalogForAddFlow`) comes AFTER the mock declarations.

**`beforeEach` reset pattern** (lines 89-94):
```typescript
beforeEach(() => {
  calls = []
  candidateRows = []
  stateRows = []
  selectCount = 0
})
```

**Circular-reference safe serializer** (lines 78-87 — copy verbatim for WHERE-clause inspection assertions):
```typescript
function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>()
  return JSON.stringify(value, (_k, v) => {
    if (typeof v === 'object' && v !== null) {
      if (seen.has(v as object)) return '[Circular]'
      seen.add(v as object)
    }
    return v
  })
}
```

**Test assertion pattern for WHERE-clause inspection** (lines 100-108 style):
```typescript
it('multi-token "Brut Datejust" returns matching row (SRCH-01)', async () => {
  candidateRows = [BRUT_DATEJUST_ROW]  // seed with brand='Brut', model='Datejust'
  await searchCatalogForAddFlow({ q: 'Brut Datejust', viewerId: VIEWER, limit: 10 })
  const whereCall = calls.find((c) => c.op === 'cand.where')
  expect(whereCall).toBeDefined()
  const json = safeStringify(whereCall!.args)
  // Both tokens must appear in the WHERE serialization
  expect(json).toContain('brut')
  expect(json).toContain('datejust')
})
```

For the return-value assertions (single-token + multi-token actual row mapping), seed `candidateRows` with a full row shape and assert the mapped `SearchCatalogWatchResult` output — same shape as the `top.map(r => ({...}))` at lines 634-643.

**VIEWER constant** (line 75 style):
```typescript
const VIEWER = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
```

---

### `src/components/watch/SearchEntry.tsx` — SRCH-02 + SRCH-03 fixes

**Analog:** Self — `src/components/watch/SearchEntry.tsx:207-333` (existing `<Combobox.Root>` block)

**SRCH-02 fix: single prop addition to `<Combobox.Root>`** (lines 207-232):
```tsx
// BEFORE: <Combobox.Root<SearchCatalogWatchResult> at line 207 — missing isItemEqualToValue
<Combobox.Root<SearchCatalogWatchResult>
  inputValue={query}
  onInputValueChange={(val, details) => { ... }}
  filteredItems={results}
  filter={null}
  itemToStringLabel={(r) => `${r.brand} ${r.model}`}
  itemToStringValue={(r) => r.catalogId}
  onValueChange={(picked) => { if (picked) onPick(picked) }}
  open={isPopupOpen}
  onOpenChange={(next) => setIsPopupOpen(next)}
>

// AFTER: add isItemEqualToValue per D-07 single-change discipline
<Combobox.Root<SearchCatalogWatchResult>
  inputValue={query}
  onInputValueChange={(val, details) => { ... }}
  filteredItems={results}
  filter={null}
  itemToStringLabel={(r) => `${r.brand} ${r.model}`}
  itemToStringValue={(r) => r.catalogId}
  isItemEqualToValue={(a, b) => a.catalogId === b.catalogId}
  onValueChange={(picked) => { if (picked) onPick(picked) }}
  open={isPopupOpen}
  onOpenChange={(next) => setIsPopupOpen(next)}
>
```
D-07: Do NOT add any other props simultaneously. Verify the keyboard test passes before touching anything else.

**SRCH-03 fix: relocate footer from inside `<Combobox.List>` to sibling** (lines 255-332):
```tsx
// BEFORE: footer button is last child of <Combobox.List> (line 321-327)
<Combobox.List className="max-h-[60vh] overflow-y-auto p-1">
  {results.map((r, i) => (
    <Combobox.Item key={r.catalogId} value={r} index={i} className="...">
      ...
    </Combobox.Item>
  ))}
  <button type="button" onClick={() => setShowPanel(true)} className="...">
    Not finding it? Add manually
  </button>
</Combobox.List>

// AFTER: footer button is sibling of <Combobox.List> inside <Combobox.Popup>
<Combobox.Popup className="z-50 w-[var(--anchor-width)] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
  {isLoading && ( ... )}

  {!isLoading && results.length > 0 && (
    <Combobox.List className="max-h-[60vh] overflow-y-auto p-1">
      {results.map((r, i) => (
        <Combobox.Item key={r.catalogId} value={r} index={i} className="...">
          ...
        </Combobox.Item>
      ))}
    </Combobox.List>
  )}

  {results.length > 0 && (
    <button
      type="button"
      onClick={() => setShowPanel(true)}
      className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px]"
    >
      Not finding it? Add manually
    </button>
  )}
</Combobox.Popup>
```
Handler `onClick={() => setShowPanel(true)}` is unchanged per D-09.
Font-semibold guardrail: this button uses `text-muted-foreground` (secondary text, no font-weight class). If a weight class is ever added, it MUST be `font-semibold` NOT `font-medium` per `project_phase_68_complete` memory.

**Existing `data-[highlighted]` class on `<Combobox.Item>`** (line 262 — used for keyboard-nav test assertion):
```tsx
className="group flex items-center gap-4 min-w-0 rounded-md pl-2 pr-3 py-2 cursor-default data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
```
base-ui sets `data-highlighted` (empty string attribute) on the active item. The SRCH-02 test asserts `toHaveAttribute('data-highlighted', '')` against this class usage.

---

### `src/components/watch/SearchEntry.test.tsx` — keyboard (SRCH-02) + footer-click (SRCH-03) additions

**Analog for keyboard test:** `src/components/watch/ConfirmStep.test.tsx:170-195`
**Analog for footer-click test:** `src/components/watch/SearchEntry.test.tsx:597-625` (existing test 12)

**userEvent import pattern** (ConfirmStep.test.tsx:31):
```typescript
import userEvent from '@testing-library/user-event'
```
Already in `SearchEntry.test.tsx` as well — confirm before adding.

**Keyboard test structure** (ConfirmStep.test.tsx:170-195):
```typescript
it('(SRCH-02a) ArrowDown highlights first result; second ArrowDown moves to second; Enter fires onPick', async () => {
  const user = userEvent.setup()
  // Note: use vi.useRealTimers() for this describe block (D-12 / Pitfall 6 in RESEARCH.md)
  // or advance fake timers before the keyboard interaction section

  vi.mocked(searchCatalogForAddFlow).mockResolvedValue({
    success: true,
    data: [OMEGA, ROLEX],
  })

  render(<SearchEntry {...BASE_PROPS} />)
  const input = screen.getByRole('combobox')

  fireEvent.change(input, { target: { value: 'speed' } })
  await act(async () => { vi.advanceTimersByTime(250) })
  await act(async () => { await Promise.resolve() })

  // Popup is open with results
  expect(screen.getByRole('listbox')).toBeInTheDocument()

  input.focus()
  await user.keyboard('{ArrowDown}')
  const options = screen.getAllByRole('option')
  expect(options[0]).toHaveAttribute('data-highlighted', '')

  await user.keyboard('{ArrowDown}')
  expect(options[1]).toHaveAttribute('data-highlighted', '')

  await user.keyboard('{ArrowUp}')
  expect(options[0]).toHaveAttribute('data-highlighted', '')

  await user.keyboard('{Enter}')
  expect(BASE_PROPS.onPick).toHaveBeenCalledWith(OMEGA)
})
```

**Escape test structure** (same describe block):
```typescript
it('(SRCH-02b) Escape closes the popup', async () => {
  const user = userEvent.setup()
  vi.mocked(searchCatalogForAddFlow).mockResolvedValue({
    success: true,
    data: [OMEGA],
  })
  render(<SearchEntry {...BASE_PROPS} />)
  const input = screen.getByRole('combobox')

  fireEvent.change(input, { target: { value: 'speed' } })
  await act(async () => { vi.advanceTimersByTime(250) })
  await act(async () => { await Promise.resolve() })

  expect(screen.getByRole('listbox')).toBeInTheDocument()
  input.focus()
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
})
```

**Footer-click test structure** (existing test 12 at lines 597-625 as the primary pattern):
```typescript
it('(SRCH-03) clicking "Not finding it?" footer outside Combobox.List mounts StructuredEntryPanel', async () => {
  vi.mocked(searchCatalogForAddFlow).mockResolvedValue({
    success: true,
    data: [OMEGA],
  })
  render(<SearchEntry {...BASE_PROPS} />)
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'speed' } })
  await act(async () => { vi.advanceTimersByTime(250) })
  await act(async () => { await Promise.resolve() })

  expect(screen.queryByTestId('structured-panel-mock')).not.toBeInTheDocument()

  const footer = screen.getByRole('button', { name: /not finding it/i })
  fireEvent.click(footer)

  expect(screen.getByTestId('structured-panel-mock')).toBeInTheDocument()
})
```
Note: test 12 (existing) already tests footer click AND the pre-seed pipeline (asserts `data-brand='Omega'`). The new SRCH-03 test is specifically a structural regression guard that confirms the click reaches the handler AFTER the List relocation fix. Consider adding it as a distinct test rather than replacing test 12. The existing test 12 may continue to pass or fail depending on whether the current broken state means the mock fires `setShowPanel` or not — verify.

**describe block placement:** Add SRCH-02 keyboard tests in a new `describe('SearchEntry — keyboard navigation (SRCH-02)')` block. Add SRCH-03 footer test in `describe('SearchEntry — footer click (SRCH-03)')` block or inline in the existing `SearchEntry — SRCH-24 footer` describe block. The fake-timer concern (Pitfall 6 in RESEARCH.md) means SRCH-02 keyboard tests must either:
- Use their own `describe` with `vi.useRealTimers()` in `beforeEach`/`afterEach`, OR
- Stay in the existing fake-timer block but call `vi.useRealTimers()` at the start of the keyboard interaction section and `vi.useFakeTimers()` when done

The latter is messy. Prefer a separate `describe` block with real timers.

---

## Shared Patterns

### Drizzle parameterized bind discipline
**Source:** `src/data/catalog.ts:537-540` (docstring) + line 8 (import)
**Apply to:** `searchCatalogForAddFlow` WHERE clause rewrite
```typescript
// All `q` interpolations use Drizzle parameterized template binds — never
// string-concatenated into SQL text (T-67-02-01 mitigation).
// Pattern construction (`%${token}%`) happens in TypeScript; the resulting
// string is a bind parameter in the generated SQL.
```

### `and(...arr)` spread with empty-array guard
**Source:** `src/data/catalog.ts:461-462` (`searchCatalogWatches`)
**Apply to:** `searchCatalogForAddFlow` tokenized WHERE clause
```typescript
return predicates.length > 0 ? and(...predicates) : undefined
// For the SRCH-01 fix: and(...tokenClauses) where tokenClauses is always
// non-empty (guarded by the `if (tokens.length === 0) return []` above)
```

### `@/db` chain-mock for DAL unit tests
**Source:** `src/data/__tests__/catalog-facets.test.ts:28-71`
**Apply to:** `src/data/__tests__/catalog-search-tokens.test.ts`
The two-chain pattern (`makeCandidateChain` / `makeStateChain` toggled by `selectCount`) is the established pattern for testing `searchCatalogForAddFlow` (which does two `db.select()` calls: candidates + stateRows). Copy verbatim.

### `vi.useFakeTimers()` / `vi.useRealTimers()` scope discipline
**Source:** `src/components/watch/SearchEntry.test.tsx:145-159` (existing debounce describe block)
**Apply to:** New keyboard-nav describe block (SRCH-02)
```typescript
// Existing pattern: fake timers per describe block
describe('...', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })
  // ...
})
// SRCH-02 keyboard tests: use real timers (keyboard nav does not use debounce)
describe('SearchEntry — keyboard navigation (SRCH-02)', () => {
  beforeEach(() => { vi.useRealTimers(); ... })  // or omit — real timers are the default
})
```

### `userEvent.setup()` async keyboard pattern
**Source:** `src/components/watch/ConfirmStep.test.tsx:170-195`
**Apply to:** SRCH-02 keyboard tests in `SearchEntry.test.tsx`
```typescript
const user = userEvent.setup()
// ...
ownedBtn.focus()
await act(async () => {
  await userEvent.keyboard('{ArrowRight}')
  await new Promise((resolve) => requestAnimationFrame(resolve))
})
```
Note: for base-ui combobox keyboard nav, `rAF` flush may or may not be needed — try without first. The ConfirmStep `rAF` flush is specific to that component's focus management. If `await user.keyboard('{ArrowDown}')` alone does not produce the `data-highlighted` attribute, add `await act(async () => { await new Promise(r => requestAnimationFrame(r)) })` after.

### Absolute imports via `@/*`
**Source:** `src/components/watch/SearchEntry.test.tsx:101-104`
**Apply to:** All new test imports
```typescript
import { SearchEntry } from '@/components/watch/SearchEntry'
import { searchCatalogForAddFlow } from '@/app/actions/search'
import { useCatalogSearchCache } from '@/components/watch/useCatalogSearchCache'
import type { SearchCatalogWatchResult } from '@/lib/searchTypes'
```

---

## No Analog Found

No files in scope lack a close codebase analog. All four files have strong matches.

---

## Metadata

**Analog search scope:** `src/data/`, `src/data/__tests__/`, `src/components/watch/`
**Files scanned:** 6 source files + 4 test files
**Pattern extraction date:** 2026-05-30
