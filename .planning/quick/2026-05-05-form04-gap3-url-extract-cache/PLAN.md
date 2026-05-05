---
type: quick
quick_id: 2026-05-05-form04-gap3
slug: url-extract-cache
created: 2026-05-05
phase_origin: 29-nav-profile-chrome-cleanup (post-UAT gap 3)
mirrors: 29-05 module-scope cache pattern
files_modified:
  - src/components/watch/useUrlExtractCache.ts (new)
  - src/components/watch/AddWatchFlow.tsx
  - tests/components/watch/useUrlExtractCache.test.tsx (new)
  - tests/components/watch/AddWatchFlow.urlCacheRemount.test.tsx (new)
---

<objective>
Add a parallel module-scoped `useUrlExtractCache` so re-pasting the same URL on
`/watch/new` skips the `/api/extract-watch` round-trip entirely. Closes the
real user complaint behind UAT Test 8 — the verdict cache (29-05) survived
remount but the extract step was uncached, so the user-visible network call
still fired on every re-paste.

Mirror 29-05's storage primitive: module-scoped `Map<url, ExtractCacheEntry>`
with `__resetForTests` test hook and a thin `useUrlExtractCache()` readout
that returns `{get, set}`. Different invalidation policy from the verdict
cache — URL → scraped data is stable across collections, so no
`collectionRevision` keying.
</objective>

<scope>
Cache only fully-successful extracts with non-null `catalogId`. Skip caching
when:
- HTTP failed (`!res.ok`)
- Network threw (catch block)
- `catalogId === null` (extractor returned brand+model gap; let user retry)
</scope>

<tasks>

## Task 1 — Create useUrlExtractCache hook

**Files:** `src/components/watch/useUrlExtractCache.ts` (new)

**Action:**
- Define `type ExtractCacheEntry = { catalogId: string; extracted: ExtractedWatchData; catalogIdError: string | null }`
- Module-scoped `let moduleCache: Map<string, ExtractCacheEntry>`
- Export `__resetUrlExtractCacheForTests()` for test isolation
- Export `useUrlExtractCache()` hook returning `{ get(url), set(url, entry) }`
- No `collectionRevision` keying — URL → scraped data is stable
- Doc comment cross-references 29-05's verdict cache as the sibling primitive

**Verify:** TypeScript compiles. Hook public API matches what AddWatchFlow.handleExtract needs.

**Done:** Commit `feat(quick): add useUrlExtractCache module-scoped cache (FORM-04 Gap 3)`

## Task 2 — Wire urlExtractCache into AddWatchFlow.handleExtract

**Files:** `src/components/watch/AddWatchFlow.tsx`

**Action:**
- Import `useUrlExtractCache`
- Hoist `const urlCache = useUrlExtractCache()` next to the verdict cache call (line ~114)
- Inside `handleExtract`:
  1. Compute `trimmedUrl` once at top
  2. After the rAF yield, check `urlCache.get(trimmedUrl)` BEFORE the fetch
  3. On cache hit: skip fetch, run the same downstream branching (collectionRevision=0 / verdict cache hit / verdict compute)
  4. On cache miss: existing fetch path; on success with non-null catalogId, `urlCache.set(trimmedUrl, {catalogId, extracted, catalogIdError})` before the verdict cache step
- Preserve all existing observability `console.warn` lines; add `(url-cache hit)` suffix on the cache-hit branch's warns to disambiguate in dev console
- Do NOT cache when catalogId is null, when res.ok is false, or in the catch branch

**Verify:** `npm run lint`, type check, no removed exports.

**Done:** Commit `feat(quick): cache /api/extract-watch responses by URL (FORM-04 Gap 3)`

## Task 3 — Hook unit test

**Files:** `tests/components/watch/useUrlExtractCache.test.tsx` (new)

**Action:**
- `beforeEach(__resetUrlExtractCacheForTests)`
- Tests:
  1. `get()` returns undefined for unknown URL
  2. `set()` then `get()` returns same entry (referential or structural equality)
  3. Cache survives remount (rerender hook with same key, set in mount A, get in mount B → hit)
  4. Cache survives across multiple URLs (set 2 distinct URLs, get both → both hit)

**Verify:** `npm run test -- tests/components/watch/useUrlExtractCache.test.tsx` → 4/4 green

**Done:** Commit `test(quick): unit test useUrlExtractCache (FORM-04 Gap 3)`

## Task 4 — AddWatchFlow remount regression test

**Files:** `tests/components/watch/AddWatchFlow.urlCacheRemount.test.tsx` (new)

**Action:**
- `beforeEach`: reset both caches (`__resetVerdictCacheForTests`, `__resetUrlExtractCacheForTests`)
- Spy on global `fetch`. Mock `/api/extract-watch` to return a synthetic successful response with a non-null `catalogId`
- Render `<AddWatchFlow key="a" collectionRevision={0} ... />` (collectionRevision=0 keeps it simple — no verdict compute)
- Type a URL, click Add → wait for verdict-ready
- Rerender with `key="b"` (simulates per-request UUID remount)
- Type the SAME URL, click Add → wait for verdict-ready
- Assert `fetchSpy` called exactly ONCE total across both pastes

**Verify:** `npm run test -- tests/components/watch/AddWatchFlow.urlCacheRemount.test.tsx` → 1/1 green

**Done:** Commit `test(quick): regression — URL extract cache survives AddWatchFlow remount (FORM-04 Gap 3)`

</tasks>

<must_haves>
truths:
  - "Re-pasting the same URL after AddWatchFlow remount does NOT call /api/extract-watch a second time (FORM-04 Gap 3 closure)"
  - "useUrlExtractCache module state survives the per-request UUID `key` boundary on /watch/new"
  - "Failed extracts are NOT cached (catalogId=null, !res.ok, network throw all skip the set)"
  - "Verdict cache (29-05) and URL extract cache are independent — verdict cache invalidates on collectionRevision; URL cache does not"
  - "AddWatchFlow public API and call sites are UNCHANGED"
artifacts:
  - path: "src/components/watch/useUrlExtractCache.ts"
    contains: "let moduleCache"
  - path: "tests/components/watch/AddWatchFlow.urlCacheRemount.test.tsx"
    contains: "toHaveBeenCalledTimes(1)"
key_links:
  - from: "src/components/watch/AddWatchFlow.tsx (handleExtract)"
    to: "useUrlExtractCache (cache check before fetch)"
    via: "urlCache.get(trimmedUrl) ?? fall through to fetch"
</must_haves>
