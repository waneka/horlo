---
phase: 69
plan: 02
subsystem: add-watch-redesign
tags: [module-scope-cache, viewerUserId-reset, cache-hygiene, CLNP-07, D-06, D-18, tdd]
requires:
  - useUrlExtractCache.ExtractCacheEntry  # type re-used for useStructuredExtractCache
  - SearchCatalogWatchResult              # cache value type for useCatalogSearchCache
provides:
  - useCatalogSearchCache(viewerUserId)
  - useStructuredExtractCache(viewerUserId)
  - __resetCatalogSearchCacheForTests
  - __resetStructuredExtractCacheForTests
affects:
  - none yet (dormant hooks — Plan 04/05 wire SearchEntry + StructuredEntryPanel; Plan 06 adds integration test)
tech_stack:
  added: []
  patterns:
    - "module-scope Map<K,V> cache surviving AddWatchFlow per-request UUID key remount"
    - "in-render sync mutation reset on lastUserId mismatch (D-06)"
    - "stale-write guard inside set() — old-user closure cannot pollute new-user cache"
    - "required positional viewerUserId arg (D-08) — TypeScript surfaces all callers"
key_files:
  created:
    - src/components/watch/useCatalogSearchCache.ts
    - src/components/watch/useCatalogSearchCache.test.ts
    - src/components/watch/useStructuredExtractCache.ts
    - src/components/watch/useStructuredExtractCache.test.ts
  modified: []
decisions:
  - "useStructuredExtractCache reuses ExtractCacheEntry from useUrlExtractCache (single source of truth — type drift avoided if ExtractedWatchData shape changes)"
  - "Hooks stay key-shape-agnostic (treat key: string as opaque) — callers own D-18 normalization to match catalog DAL natural-key normalization (project_local_catalog_natural_key_drift)"
metrics:
  duration_minutes: 3
  completed_date: 2026-05-29
  completed_tasks: 2
  total_tasks: 2
  tests_pass: 9   # 4 + 5
  build_exit: 0
requirements:
  - CLNP-07  # partial — new caches; existing 2 retrofit lands in Plan 03
---

# Phase 69 Plan 02: useCatalogSearchCache + useStructuredExtractCache Summary

Two new module-scope client caches shipped dormant — `useCatalogSearchCache(viewerUserId)` keyed by trimmed+lowercased query for SearchEntry typeahead results, and `useStructuredExtractCache(viewerUserId)` keyed by a D-18 JSON-tuple for StructuredEntryPanel structured-extract results — both mirror the `useUrlExtractCache` shape with a Phase 69 D-06 viewer-keyed reset (in-render `lastUserId` check + stale-write guard) so signOut → signIn-as-different-user cannot leak cached entries across viewer identities.

## What Was Built

### useCatalogSearchCache (Task 1)

- **`src/components/watch/useCatalogSearchCache.ts`** (61 lines) — `'use client'` module-scope `Map<string, SearchCatalogWatchResult[]>`; required positional `viewerUserId: string` arg per D-07/D-08; in-render reset block (`if (moduleUserId !== viewerUserId) { moduleCache = new Map(); moduleUserId = viewerUserId }`) byte-for-byte mirror of `useWatchSearchVerdictCache.ts:42-45`; stale-write guard inside `set()` (`if (moduleUserId !== viewerUserId) return;`); exports `__resetCatalogSearchCacheForTests()` that resets both `moduleCache` and `moduleUserId`.
- **Cache key contract:** caller passes `query.trim().toLowerCase()` (D-Discretion). Hook treats the key as opaque (consistent with `useUrlExtractCache` discipline) so SearchEntry owns normalization — JSDoc spells out the expected key shape but does not normalize inside the hook.

### useStructuredExtractCache (Task 2)

- **`src/components/watch/useStructuredExtractCache.ts`** (74 lines) — same shape as `useCatalogSearchCache` with two deltas: (1) value type is `ExtractCacheEntry` re-used via `import type { ExtractCacheEntry } from '@/components/watch/useUrlExtractCache'` (single source of truth); (2) D-18 cache-key contract documented in JSDoc — caller builds `JSON.stringify({brand: brand.trim().toLowerCase(), model: model.trim().toLowerCase(), reference: (reference ?? '').trim().toLowerCase(), year: year ?? null})`.
- Same D-06 in-render reset + stale-write guard + `__resetStructuredExtractCacheForTests()` semantics.

### Tests

- **`useCatalogSearchCache.test.ts`** (74 lines) — 4 behavioral tests via `renderHook` from `@testing-library/react`:
  1. `set()` then `get()` returns the cached entry for the same `viewerUserId`
  2. Switching `viewerUserId` across renders clears the cache — `get()` returns `undefined`
  3. Stale-write guard — `set()` from old-user closure after rerender does NOT pollute new-user cache
  4. `__resetCatalogSearchCacheForTests()` resets both `moduleCache` AND `moduleUserId` (subsequent `get` returns `undefined`)
- **`useStructuredExtractCache.test.ts`** (91 lines) — 5 behavioral tests including the four shared with Task 1 plus a D-18 symmetric-normalization test asserting writer-cased `'  OMEGA  '`/`'  Speedmaster  '`/`'  3135  '` and reader-cased `'omega'`/`'speedmaster'`/`'3135'` produce byte-identical `JSON.stringify` output and resolve to the same cached entry.
- **No `@vitest-environment node` pragmas** — behavioral tests run under default `jsdom` (D-09 + `vitest_static_node_env` memory).

## Deviations from Plan

None — plan executed exactly as written. TDD RED → GREEN cycle ran cleanly for both tasks; no Rule 1/2/3 auto-fixes triggered; no architectural questions surfaced.

## Authentication Gates

None.

## Self-Check

- [x] `src/components/watch/useCatalogSearchCache.ts` exists with `'use client'` directive
- [x] `src/components/watch/useCatalogSearchCache.test.ts` exists with 4 passing tests
- [x] `src/components/watch/useStructuredExtractCache.ts` exists with `'use client'` directive
- [x] `src/components/watch/useStructuredExtractCache.test.ts` exists with 5 passing tests
- [x] Commit `5f9ab165` (RED useCatalogSearchCache test) found in `git log --all`
- [x] Commit `098b5714` (GREEN useCatalogSearchCache impl) found
- [x] Commit `8d2b39ca` (RED useStructuredExtractCache test) found
- [x] Commit `5b9cebc0` (GREEN useStructuredExtractCache impl) found

### Acceptance criteria — Task 1 (useCatalogSearchCache)

| Assertion | Result |
| --- | --- |
| `head -1` is `'use client'` | PASS |
| `grep -c "^export function useCatalogSearchCache(viewerUserId: string)"` | 1 (PASS) |
| `grep -c "let moduleUserId"` | 1 (PASS) |
| `grep -c "^export function __resetCatalogSearchCacheForTests"` | 1 (PASS) |
| `grep -c "if (moduleUserId !== viewerUserId) return"` (stale-write guard) | 1 (PASS) |
| `npm run test -- --run src/components/watch/useCatalogSearchCache.test.ts` | exit 0 — 4/4 PASS |
| `grep -c "getUser\|createSupabaseBrowserClient"` (must be 0) | 0 (PASS) |

### Acceptance criteria — Task 2 (useStructuredExtractCache)

| Assertion | Result |
| --- | --- |
| `head -1` is `'use client'` | PASS |
| `grep -c "^export function useStructuredExtractCache(viewerUserId: string)"` | 1 (PASS) |
| `grep -c "^export function __resetStructuredExtractCacheForTests"` | 1 (PASS) |
| `grep -c "import type.*ExtractCacheEntry.*useUrlExtractCache"` | 1 (PASS) |
| `grep -c "if (moduleUserId !== viewerUserId) return"` | 1 (PASS) |
| `grep -c "JSON.stringify"` (in JSDoc example, must be ≥ 1) | 1 (PASS) |
| `npm run test -- --run src/components/watch/useStructuredExtractCache.test.ts` | exit 0 — 5/5 PASS |
| `grep -c "getUser\|createSupabaseBrowserClient"` (must be 0) | 0 (PASS) |
| No `@vitest-environment node` pragma in either test file | confirmed (0/0) PASS |

### Plan-level verification

| Check | Result |
| --- | --- |
| `npm run build` exits 0 (authoritative phase gate per `project_baseline_not_green_build_is_gate`) | PASS |
| `grep -rn "useCatalogSearchCache\|useStructuredExtractCache" src/` returns ONLY the 4 new files (no callers yet — Plan 04/05 wire) | PASS |
| TDD gate sequence — `test(...)` commit precedes `feat(...)` commit for both hooks | PASS (RED commits `5f9ab165` + `8d2b39ca` precede GREEN commits `098b5714` + `5b9cebc0`) |
| No `getUser` / `createSupabaseBrowserClient` calls in either hook | PASS |
| No `@vitest-environment node` pragmas | PASS |

## TDD Gate Compliance

- `useCatalogSearchCache`: RED commit `5f9ab165` (test) → GREEN commit `098b5714` (impl). REFACTOR not needed; implementation matched analog cleanly.
- `useStructuredExtractCache`: RED commit `8d2b39ca` (test) → GREEN commit `5b9cebc0` (impl). REFACTOR not needed.

## Known Stubs

None — both hooks are fully wired primitives. The fact that they are not yet imported by any production caller is intentional dormancy per phase boundary; Plan 04 (StructuredEntryPanel) and Plan 05 (SearchEntry) will consume them, and Plan 06 will add the four-cache `AddWatchFlow.test.tsx` integration test that exercises `__resetCatalogSearchCacheForTests` + `__resetStructuredExtractCacheForTests` together with the two existing reset helpers.

## Threat Flags

None — module-scope `Map` storage stays in the client process and contains only data already accessible to the viewer (their own search results / their own structured-extract responses). The viewer-keyed reset is the threat mitigation for cross-user leakage and is unit-tested explicitly.

## Commits

| Commit | Type | Description |
| --- | --- | --- |
| `5f9ab165` | test | RED — 4 failing tests for `useCatalogSearchCache` |
| `098b5714` | feat | GREEN — `useCatalogSearchCache` module-scope cache (CLNP-07, D-06, D-07) |
| `8d2b39ca` | test | RED — 5 failing tests for `useStructuredExtractCache` |
| `5b9cebc0` | feat | GREEN — `useStructuredExtractCache` module-scope cache (CLNP-07, D-06, D-18) |

## Self-Check: PASSED
