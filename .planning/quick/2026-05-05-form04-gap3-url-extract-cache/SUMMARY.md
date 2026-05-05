---
status: complete
quick_id: 2026-05-05-form04-gap3
slug: url-extract-cache
completed: 2026-05-05
phase_origin: 29-nav-profile-chrome-cleanup (post-UAT gap 3)
commits:
  - 03667a5 feat(quick): add useUrlExtractCache module-scoped cache
  - 8de2382 feat(quick): cache /api/extract-watch responses by URL
  - 726f2ed test(quick): unit test useUrlExtractCache
  - 0815c96 test(quick): regression — URL extract cache survives AddWatchFlow remount
---

# Quick Task: FORM-04 Gap 3 — URL extract cache

## What shipped

Closed the third (and final) FORM-04 user-observable regression: re-pasting
the same URL on `/watch/new` after AddWatchFlow remount no longer fires
`/api/extract-watch` a second time. Verdict cache (29-05) survived remount
but only short-circuits the verdict server action — the upstream extract
fetch was uncached and remained the user-visible bottleneck.

## Files changed

| File | Change |
|---|---|
| `src/components/watch/useUrlExtractCache.ts` | NEW — module-scoped `Map<url, ExtractCacheEntry>` mirroring 29-05's pattern |
| `src/components/watch/AddWatchFlow.tsx` | `handleExtract` checks `urlCache.get(trimmedUrl)` before fetch; on success with non-null catalogId, sets the cache |
| `src/components/watch/AddWatchFlow.test.tsx` | `__resetUrlExtractCacheForTests` in beforeEach to insulate from URL-leak across tests |
| `tests/components/watch/useUrlExtractCache.test.tsx` | NEW — 4 hook unit tests (miss, set/get, survives-remount, multi-URL) |
| `tests/components/watch/AddWatchFlow.urlCacheRemount.test.tsx` | NEW — `fetchSpy` called exactly once across remount + same-URL re-paste |

## Design decisions

- **Cache key:** raw trimmed URL string. No normalization — matches what user pastes; no surprise misses from `?utm_*` removal etc.
- **Cache value:** `{ catalogId, extracted, catalogIdError }` — exactly what `handleExtract` needs downstream. Type-safe via `ExtractCacheEntry` export.
- **Storage:** module-scoped `let moduleCache: Map<...>`. Survives the per-request UUID `key` boundary on `/watch/new` because module state lives outside React's tree.
- **Invalidation:** none. URL → scraped catalog data is stable across the user's collection state. The downstream verdict cache still handles `collectionRevision` invalidation.
- **What NOT to cache:** `!res.ok` responses, network throws, and `catalogId === null` (extractor returned brand+model gap). Failures stay uncached so the user can retry a malformed URL after fixing it.
- **Test isolation:** added `__resetUrlExtractCacheForTests` to `AddWatchFlow.test.tsx` beforeEach because that suite reuses URLs across tests; without the reset, a cached entry from one test poisons later tests via the wrong code path.

## Verification

- 4/4 `useUrlExtractCache.test.tsx` green (hook unit)
- 1/1 `AddWatchFlow.urlCacheRemount.test.tsx` green (fetchSpy === 1 across remount)
- 12/12 `AddWatchFlow.test.tsx` green (no regressions)
- 4/4 `useWatchSearchVerdictCache.test.tsx` green (29-05 still intact)
- 1/1 `AddWatchFlow.cacheRemount.test.tsx` green (29-05 regression preserved)
- 2/2 `AddWatchFlow.strictModePrefill.test.tsx` green (29-06 regression preserved)
- 79/79 watch + UserMenu + ProfileTabs cross-suite sweep green
- TypeScript compiles clean for new + modified files

## Manual UAT to confirm

Re-test prior UAT Test 8 (29-UAT.md):
1. `/watch/new` → paste a catalog URL → verdict appears
2. Click any "Add Watch" CTA elsewhere → re-enter `/watch/new`
3. Paste the SAME URL → DevTools Network: `/api/extract-watch` should fire ONLY ONCE total (one call from step 1, zero from step 3)

## Out of scope / non-goals

- URL normalization (lowercase host, strip query params, etc.) — deferred; user's direct paste is canonical
- Extract failure caching — intentionally NOT cached so retry works
- Cross-session persistence (localStorage / IndexedDB) — module state is per-tab/per-load, sufficient for the in-session re-paste case D-15 contracted for
