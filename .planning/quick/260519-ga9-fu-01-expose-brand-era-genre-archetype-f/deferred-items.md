# Deferred Items — Quick Task 260519-ga9 (FU-01)

Pre-existing failures discovered during execution. NOT caused by this task — out of scope.

## Pre-existing tsc errors (unrelated files)

`npx tsc --noEmit` reports type errors in test files this task never touched:

- `tests/data/getGainingTractionCatalogWatches.test.ts` — `getGainingTractionCatalogWatches` not exported from `src/data/discovery`
- `tests/data/getMostFollowedCollectors.test.ts` — `getMostFollowedCollectors` not exported from `src/data/discovery`; implicit-any params
- `tests/data/getTrendingCatalogWatches.test.ts` — `getTrendingCatalogWatches` not exported from `src/data/discovery`; implicit-any params
- `tests/integration/catalog-taste.test.ts` — `number | null` not assignable to `number` (line 127)
- `tests/integration/phase17-extract-route-wiring.test.ts` — `null` not assignable to `string | undefined` (lines 50, 107, 151)

These are stale tests referencing renamed/removed DAL exports. They predate this task
and should be triaged separately.

## Note on tests/app/search/SearchPageClient.test.tsx

This file was ALSO failing at base 08b31f0 (missing the `styleVocab` prop required since
Phase 40). Since FU-01 added a second required prop (`brandVocab`) to the same interface,
this task fixed both props in that file (13 render sites) as a courtesy unblock — the fix
was a clean, consistent two-prop addition. Now passes.
