---
phase: 20
plan: "05"
subsystem: search-accordion-action
tags: [server-action, accordion, verdict-cache, watch-search, fit-04]
dependency_graph:
  requires: ["20-02", "20-03"]
  provides: ["FIT-04 inline verdict preview in search rows"]
  affects: ["src/app/search", "src/components/search"]
tech_stack:
  added:
    - "@base-ui/react/accordion — Accordion.Root/Item/Header/Trigger/Panel primitive"
    - "Zod .uuid() + .strict() for Server Action input validation"
    - "startTransition + async Server Action for non-blocking verdict fetch"
  patterns:
    - "vi.hoisted() for mock factories that reference external variables in vitest"
    - "useState<string[]> for base-ui Accordion value (array, not string | null)"
    - "onKeyDown on Accordion.Root for ESC collapse (not handled by base-ui natively)"
    - "isOpen prop threading from parent accordion to row for label/chevron toggle"
key_files:
  created:
    - src/app/actions/verdict.ts
    - src/components/search/WatchSearchRowsAccordion.tsx
    - src/components/search/useWatchSearchVerdictCache.ts
    - tests/actions/verdict.test.ts
    - tests/components/search/WatchSearchRowsAccordion.test.tsx
    - tests/components/search/useWatchSearchVerdictCache.test.tsx
  modified:
    - src/components/search/WatchSearchRow.tsx
    - src/components/search/SearchPageClient.tsx
    - src/app/search/page.tsx
    - tests/components/search/WatchSearchRow.test.tsx
    - tests/app/search/SearchPageClient.test.tsx
decisions:
  - "collectionRevision uses viewer collection length (not a UUID or timestamp) as a coarse cache-invalidation key — simple, sufficient at v4.0 scale; acknowledged trade-off that edits not changing count won't auto-invalidate"
  - "isOpen prop threading (not CSS group-data-[state=open]) for label/chevron toggle — more reliable in RTL tests and avoids CSS propagation complexity"
  - "ESC key handled via onKeyDown on Accordion.Root (Rule 2 auto-add) since base-ui Accordion does not handle it natively"
  - "framing hardcoded to 'cross-user' in Server Action — search rows always evaluate watches the viewer does not yet own"
metrics:
  duration: "~90 minutes (including worktree context recovery)"
  completed: "2026-04-29"
  tasks_completed: 4
  tasks_total: 4
  files_created: 6
  files_modified: 5
---

# Phase 20 Plan 05: Search Accordion + Verdict Action Summary

**One-liner:** Replaced dangling `/evaluate?catalogId=` href in watch search rows with a base-ui Accordion inline-expand that lazy-fetches `getVerdictForCatalogWatch` Server Action and renders `CollectionFitCard` in-panel, with per-mount verdict cache keyed by viewer collection length.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Server Action + 8 tests | 9821892 | src/app/actions/verdict.ts, tests/actions/verdict.test.ts |
| 2 | useWatchSearchVerdictCache + 4 tests | 9ab70e3 | src/components/search/useWatchSearchVerdictCache.ts, tests/components/search/useWatchSearchVerdictCache.test.tsx |
| 3 | WatchSearchRowsAccordion + WatchSearchRow mods + 22 tests | e39529d | src/components/search/WatchSearchRowsAccordion.tsx, src/components/search/WatchSearchRow.tsx, tests/components/search/WatchSearchRowsAccordion.test.tsx, tests/components/search/WatchSearchRow.test.tsx |
| 4 | Wire SearchPageClient + /search page | 82cc9b7 | src/components/search/SearchPageClient.tsx, src/app/search/page.tsx, tests/app/search/SearchPageClient.test.tsx |

## Verification

All 44 Plan 05 tests pass (8 Server Action + 4 cache hook + 10 accordion + 12 WatchSearchRow/existing search):

```
tests/actions/verdict.test.ts          8 passed
tests/components/search/useWatchSearchVerdictCache.test.tsx  4 passed
tests/components/search/WatchSearchRowsAccordion.test.tsx   10 passed
tests/components/search/WatchSearchRow.test.tsx             12 passed (includes 6 new)
```

TypeScript: no new errors from Plan 05 changes (`tests/app/search/SearchPageClient.test.tsx` TS error introduced by adding required `collectionRevision` prop was fixed in Task 4).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] ESC key handler on Accordion.Root**
- **Found during:** Task 3 — plan stated "base-ui Accordion handles ESC natively"
- **Issue:** Grep of `node_modules/@base-ui-components/react/accordion` confirmed no Escape handler in accordion source
- **Fix:** Added `onKeyDown` on `Accordion.Root` that calls `setOpenValues([])` when `e.key === 'Escape'` and panel is open
- **Files modified:** src/components/search/WatchSearchRowsAccordion.tsx
- **Commit:** e39529d

**2. [Rule 1 - Bug] base-ui Accordion uses array value (string[]), not string | null**
- **Found during:** Task 3 implementation
- **Issue:** Plan showed `string | null` pattern but `@base-ui/react/accordion` `Accordion.Root.value` is always `Value[]` and `onValueChange` receives `(Value[], eventDetails)`
- **Fix:** Changed `useState<string | null>` to `useState<string[]>([])`, extracted `openId = openValues[0] ?? null` for single-value semantics; updated tests to use `aria-expanded` (not `data-state`) for open check
- **Files modified:** src/components/search/WatchSearchRowsAccordion.tsx, tests/components/search/WatchSearchRowsAccordion.test.tsx
- **Commit:** e39529d

**3. [Rule 1 - Bug] Mock hoisting issue in verdict.test.ts and WatchSearchRowsAccordion.test.tsx**
- **Found during:** Task 1 and Task 3 test execution
- **Issue:** `vi.mock()` factory functions are hoisted before variable declarations; mock functions defined outside `vi.hoisted()` were uninitialized at factory call time
- **Fix:** Used `vi.hoisted(() => ({ mockFn: vi.fn() }))` pattern to declare mock functions before hoisting
- **Files modified:** tests/actions/verdict.test.ts, tests/components/search/WatchSearchRowsAccordion.test.tsx
- **Commit:** 9821892, e39529d

**4. [Rule 1 - Bug] Missing collectionRevision prop in existing SearchPageClient tests**
- **Found during:** Task 4 — tsc revealed 13 TypeScript errors in tests/app/search/SearchPageClient.test.tsx
- **Issue:** Adding required `collectionRevision: number` to `SearchPageClientProps` caused all existing renders in the test file to fail type-check
- **Fix:** Added `collectionRevision={0}` to all 13 `<SearchPageClient>` renders in the test file
- **Files modified:** tests/app/search/SearchPageClient.test.tsx
- **Commit:** 82cc9b7

## Known Stubs

None — all verdict data flows from real Server Action through real DAL calls.

## Threat Flags

None beyond the plan's threat model. The Server Action (`getVerdictForCatalogWatch`) is auth-gated via `getCurrentUser()`, Zod-validated with `.uuid()` + `.strict()`, and never accepts `viewerId` from client input (V4 ASVS mitigation T-20-05-01/02 from plan).

## Self-Check: PASSED
