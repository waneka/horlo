---
phase: 18-explore-discovery-surface
reviewed: 2026-04-28T17:09:11Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - src/app/actions/follows.ts
  - src/app/actions/watches.ts
  - src/app/explore/collectors/page.tsx
  - src/app/explore/page.tsx
  - src/app/explore/watches/page.tsx
  - src/components/explore/DiscoveryWatchCard.tsx
  - src/components/explore/ExploreHero.tsx
  - src/components/explore/GainingTractionWatches.tsx
  - src/components/explore/PopularCollectorRow.tsx
  - src/components/explore/PopularCollectors.tsx
  - src/components/explore/TrendingWatches.tsx
  - src/components/layout/BottomNav.tsx
  - src/data/discovery.ts
  - src/data/wearEvents.ts
  - tests/actions/follows.test.ts
  - tests/actions/watches.test.ts
  - tests/components/explore/CollectorsSeeAll.test.tsx
  - tests/components/explore/ExplorePage.test.tsx
  - tests/components/explore/GainingTractionWatches.test.tsx
  - tests/components/explore/PopularCollectors.test.tsx
  - tests/components/explore/TrendingWatches.test.tsx
  - tests/components/explore/WatchesSeeAll.test.tsx
  - tests/components/layout/BottomNav.test.tsx
  - tests/data/getGainingTractionCatalogWatches.test.ts
  - tests/data/getMostFollowedCollectors.test.ts
  - tests/data/getTrendingCatalogWatches.test.ts
  - tests/data/getWearEventsCountByUser.test.ts
findings:
  critical: 0
  warning: 4
  info: 6
  total: 10
status: issues_found
---

# Phase 18: Code Review Report

**Reviewed:** 2026-04-28T17:09:11Z
**Depth:** standard
**Files Reviewed:** 28 (13 source + 13 test files; one of the listed test files counted twice in the input list — `tests/components/explore/PopularCollectors.test.tsx` appears once in the file list and contains the row tests as part of its inline scope)
**Status:** issues_found

## Summary

Phase 18 ships a well-structured discovery surface (Popular Collectors, Trending Watches, Gaining Traction) with clear separation between Server Components, DAL, and Server Actions. Code quality is generally high: cache-tag conventions are consistent, two-layer privacy is enforced, parameterized SQL is used throughout, and pluralization/empty-state copy is locked to the UI spec.

No Critical bugs or security vulnerabilities were found. The four Warnings flag a mixed bug/quality cluster around the Gaining Traction DAL — a fragile cast pattern, a misleading SQL idiom, an off-by-one boundary edge in a partial-window claim, and a confusing `Math.max(limit, 50)` that means something different from what the surrounding text suggests. Six Info items collect minor cleanups (dead-code branches, shadowed globals, magic numbers).

The DAL also has one important latent invariant that is correct today but easy to break — see WR-04 (Math.max(limit, 50) over-fetch).

## Warnings

### WR-01: `Math.max(limit, 50)` over-fetch silently violates `opts.limit` for callers that pass `limit > 50`

**File:** `src/data/discovery.ts:93` (and effectively `:113` where it slices)
**Issue:** In `getMostFollowedCollectors`, the SQL `LIMIT` is computed as `Math.max(limit, 50)` so that — for the default case `limit=5` — the inner `inArray` watchCount hydration can preserve a stable ordering. Then `rows.slice(0, limit)` trims to the requested limit.

This works for the two known callers (limits 5 and 50) because `Math.max(5, 50) === 50` and `Math.max(50, 50) === 50`. But the contract `opts.limit` *says* it returns at most N. If a future caller passes `limit = 100`, this will fetch 100 (correct) and slice to 100 (correct). But for `limit = 30`, it fetches 50 (over-fetch) and slices to 30 (correct). Fine. The real issue is the *intent*: the code's purpose is "fetch enough to cover top-N rows for the watchCount hydration," but the current expression fetches MORE than needed when `limit > 50` is reasonable, and fetches the SAME amount as the cap when 5 ≤ limit ≤ 50. The DAL behavior is therefore bound to the assumption that the see-all page caps at 50 — which is enforced today but not by the DAL.

If a future caller passes `limit = 0` (as test case "Test 6" actually does, line 299 of `tests/data/getMostFollowedCollectors.test.ts`), the SQL fetches 50 then JS slices to 0 — fine, but counter-intuitive. The fact that this *needs* a comment to reason about is a code smell.

**Fix:** Either codify the cap explicitly so the contract is self-documenting, or drop the `Math.max` and just respect `limit`:
```ts
// Option A — make the cap intent explicit
const HYDRATION_FLOOR = 50
const fetchLimit = Math.max(limit, HYDRATION_FLOOR)
// ...
.limit(fetchLimit)
// then slice down
return rows.slice(0, limit).map(...)

// Option B — simplify (no slice, no over-fetch)
.limit(limit)
// then map directly without slice
```
Option B requires no behavioral change for current callers (limits 5 and 50 work identically with or without the floor). The only reason to keep the floor is if there's a planned future "secondary sort" that needs a buffer — and if so, that should be in a comment naming the planned use case.

---

### WR-02: `DISTINCT ON` query in `getGainingTractionCatalogWatches` does not match the comment's claim of "OLDEST snapshot per catalog row"

**File:** `src/data/discovery.ts:182-264` (especially line 245)
**Issue:** The header comment (lines 181-184) says:
> SQL idiom: DISTINCT ON (catalog_id) ORDER BY catalog_id, snapshot_date ASC picks the OLDEST snapshot per catalog row in the [today − window, today] range.

The query (line 245) does specify `ORDER BY s.catalog_id, s.snapshot_date ASC`, which IS correct for picking the oldest. So the comment is correct. **However**, the `WHERE` clause uses `>=` (line 244):
```sql
WHERE s.snapshot_date::date >= (current_date - ${window} * INTERVAL '1 day')::date
```

Combined with `window = clamp(max_age_days, 1, 7)`, this means:
- If `max_age_days` is 14, `window` clamps to 7. The CTE picks the oldest snapshot that is ≤ 7 days old.
- The user-facing string says "↑ +N this week" (week = 7 days).
- But the snapshot used as the baseline could be **anywhere from 0 to 7 days old**, not necessarily 7. If the only snapshot in range happens to be 1 day old (because the system was offline for a week), the delta is computed against a 1-day baseline — but the UI tells the user "this week."

The DAL is using the OLDEST snapshot in the window as a proxy for "the snapshot 7 days ago" but they are not the same thing. Today this is fine because the pg_cron snapshot runs daily at 03:00 UTC (per docstring), so the oldest snapshot ≤7 days old is always ~7 days. If the cron ever misses a day or is paused for maintenance, the labeling is off but no error is raised — this is a silent semantic correctness issue.

**Fix:** Either tighten the comment to acknowledge the assumption explicitly, or change the SQL to require `snapshot_date::date = current_date - {window}` (exact equality) and let the result be empty if the snapshot is missing:
```sql
-- Option A: tighten the comment
-- Picks the OLDEST snapshot per catalog row within the last `window` days.
-- ASSUMPTION: pg_cron daily snapshot is healthy → oldest ≈ window days old.
-- If snapshots are missing, the baseline is younger and the delta under-reports.

-- Option B: require exact-window snapshot
WHERE s.snapshot_date::date = (current_date - ${window} * INTERVAL '1 day')::date
-- Returns empty result for that catalog row if the exact-day snapshot is missing.
```
Option A is the lower-cost fix and matches the apparent intent. At minimum, document the assumption so a future reader doesn't think the DAL guarantees a 7-day baseline.

---

### WR-03: `oldest.max_age_days` cast pattern silently swallows `null` to 0 — partial-window labeling can be wrong on day 0

**File:** `src/data/discovery.ts:212, 221`
**Issue:** The `EXTRACT(DAY FROM (current_date - MIN(snapshot_date::date)))::int` produces an integer, then is wrapped in `COALESCE(..., 0)`. The next line clamps:
```ts
const window = Math.max(1, Math.min(oldest.max_age_days ?? 0, 7))
```

If `MIN(snapshot_date::date) = current_date` (a snapshot was taken today), then `current_date - today = INTERVAL '0 days'`, `EXTRACT(DAY FROM ...) = 0`, and `window = Math.max(1, Math.min(0, 7)) = 1`. The function then renders the sublabel `"↑ +N in 1 day"` — but the snapshot is from TODAY, not yesterday. The delta is the change-since-this-morning, labeled as a 1-day delta.

This is a boundary edge where the label is misleading. The intent is "1-6 days of snapshots → window = max-age clamped to [1, 7]" (line 194), but max-age = 0 is force-promoted to 1, mislabeling the delta. The `Math.max(1, ...)` was likely added to avoid `window = 0` from triggering the empty-state branch when snapshots DO exist — a reasonable goal — but it conflates "no useful baseline yet (deploy day)" with "have today's snapshot but nothing older."

**Fix:** Distinguish the day-0 case from the deploy-day-no-snapshots case. Option:
```ts
// If oldest snapshot is today (max_age_days === 0), there is no baseline to
// diff against. Treat as window=0 (empty-state copy) until tomorrow's snapshot.
if ((oldest.max_age_days ?? 0) < 1) {
  return { window: 0, watches: [] }
}
const window = Math.min(oldest.max_age_days, 7)
```
Verify the test in `tests/data/getGainingTractionCatalogWatches.test.ts` Test 2 handles this — currently it inserts a 3-day-old snapshot, so it doesn't catch the day-0 edge.

---

### WR-04: PopularCollectors empty-state branch silently propagates `null` from cached scope — verify Next 16 `'use cache'` allows `null` returns

**File:** `src/components/explore/PopularCollectors.tsx:28`
**Issue:** The component uses `'use cache'` (line 23) and then returns `null` when `collectors.length === 0` (line 28). Per the Next 16 docs (`use-cache.md`) the cached function's return value is serialized — `null` is technically serializable but the component scope does mean React caches `null` and Next.js stores that as the cache entry. On the next render that hits the cache, `null` is returned and the page-level `<>{showHero && <ExploreHero />}<PopularCollectors viewerId={user.id} /><TrendingWatches /><GainingTractionWatches /></>` correctly omits the section.

However, the empty-state cache duration is 5 minutes (line 25, `cacheLife({ revalidate: 300 })`). If a viewer happens to hit `/explore` at the moment the candidate pool is empty (e.g., immediately after signup before any `getMostFollowedCollectors` has been called), the empty result is cached for 5 minutes for THIS viewer. New collectors who appear in the next 5 minutes are not surfaced until the tag invalidation fires. The cache invalidation paths (`updateTag('explore:popular-collectors:viewer:${viewerId}')` from follow/unfollow, `revalidateTag('explore', 'max')` from add/edit/remove watch) DO cover most state changes that would change the candidate pool, but a NEW user signing up does NOT fire any of these tags — that user becomes eligible to surface, but the empty cache for existing viewers is not invalidated.

This is a correctness-bordering-on-quality issue: the rail can be empty for up to 5 minutes for a viewer who was the first to load `/explore` before others signed up. Probably acceptable for MVP, but worth documenting.

**Fix:** Either accept the 5-minute window as MVP-acceptable and add a comment noting the propagation gap, or fan out the `explore` tag on profile creation so new-user signups also invalidate the cache:
```ts
// In the profile creation path (e.g., src/app/actions/profiles.ts, signup):
revalidateTag('explore', 'max')  // new public profile may reach Popular Collectors

// Or, if MVP-acceptable, document the gap on PopularCollectors.tsx:
// NOTE: Empty-state cache is held for 5 min. A brand-new user who signs up
// AFTER an existing viewer has cached an empty rail will not surface until
// cache TTL expires. Acceptable for MVP per PROJECT.md <500-watch scope.
```

## Info

### IN-01: `excludeIds.length > 0 ? notInArray(...) : undefined` is dead code

**File:** `src/data/discovery.ts:88`
**Issue:** The comment on line 71-73 explicitly states `excludeIds is always >= 1 here (viewerId is spread in)`, and the test for "Test 6: returns [] when only the viewer exists" confirms this is invariant. The conditional `excludeIds.length > 0 ? ... : undefined` is therefore unreachable on the false branch. The comment justifies it as "defense-in-depth against any future refactor," which is a fair practice, but the code reads as if `excludeIds` could be empty when it cannot.

**Fix:** Either drop the conditional (the simpler choice given the spread guarantee), or extract the invariant as a runtime assertion:
```ts
// Option A — drop the conditional, since the spread guarantees ≥1
.where(
  and(
    eq(profileSettings.profilePublic, true),
    notInArray(profiles.id, excludeIds),
  ),
)

// Option B — assert the invariant if defensive coding is preferred
if (excludeIds.length === 0) throw new Error('invariant: viewerId always present')
```

---

### IN-02: `window` shadows the global `window` identifier

**File:** `src/data/discovery.ts:221, 244, 263`
**Issue:** `const window = ...` shadows the global `window` (defined in browser contexts; not present in `'server-only'` modules but still a confusing name). When future maintainers grep for `window` they will hit this. TypeScript does not warn because of the `'server-only'` import, but readability suffers.

**Fix:** Rename to something like `windowDays`, `lookbackDays`, or `ageWindow`:
```ts
const windowDays = Math.max(1, Math.min(oldest.max_age_days ?? 0, 7))
// ...used in SQL ${windowDays}, returned as { window: windowDays, watches }
```
The struct field name `window` in the result can stay as-is for the API contract (callers already destructure it).

---

### IN-03: Magic number `0.5` for wishlist-weight repeated in 3 places

**File:** `src/data/discovery.ts:151, 154, 253-254, 258-259`
**Issue:** The trending score formula `owners_count + 0.5 * wishlist_count` appears verbatim in `getTrendingCatalogWatches` (twice — WHERE and ORDER BY) and in `getGainingTractionCatalogWatches` (twice — SELECT delta and WHERE). If the weight ever changes, all four occurrences must be updated. A future refactor that changes one without the others creates a silent ranking divergence between Trending and Gaining Traction.

**Fix:** Extract the weight as a named constant at module scope:
```ts
// At top of src/data/discovery.ts (or in a shared constants file)
const WISHLIST_SIGNAL_WEIGHT = 0.5

// In SQL — Drizzle's sql tag interpolates JS values as parameters
sql`(${watchesCatalog.ownersCount} + ${WISHLIST_SIGNAL_WEIGHT} * ${watchesCatalog.wishlistCount})`
```
Verify Drizzle's `sql` tag parameterizes the float correctly (it should — Drizzle treats JS numbers as bound parameters). At minimum, add a constant-named header comment that says "if you change 0.5 here, also change line 253 of getGainingTractionCatalogWatches."

---

### IN-04: `Math.max(limit, 50)` magic number `50` matches see-all cap but is implicit

**File:** `src/data/discovery.ts:93`
**Issue:** Same `50` cap appears here in the DAL hydration floor and in the see-all page (`src/app/explore/collectors/page.tsx:19`). The two are coincidentally identical, but the relationship is not documented — if someone raises the see-all cap to 100 someday, the DAL hydration floor stays at 50 silently.

**Fix:** Cross-reference the constants explicitly. See WR-01 for a refactor that removes the magic number entirely.

---

### IN-05: `getCurrentUser()` called purely for its side effect (auth check)

**File:** `src/app/explore/watches/page.tsx:30`
**Issue:** `await getCurrentUser() // auth check; proxy.ts already redirects anon`. The result is discarded. The comment explains that proxy.ts already redirects anon viewers, so this is defense-in-depth. But the function might throw, and if it does, the error propagates to the framework error UI — which IS the desired behavior, but the discard pattern is unusual. Other pages in this phase store the result (e.g., `src/app/explore/page.tsx:31` uses `user.id`).

**Fix:** Either rename for clarity or store + ignore:
```ts
// Option A — comment + void
void (await getCurrentUser()) // auth check; proxy.ts already redirects anon

// Option B — use the user even for a no-op, matching the surrounding pages
const user = await getCurrentUser()
void user.id // explicit no-op, signals defense-in-depth
```
Minor — the existing form is functional and the comment makes intent clear.

---

### IN-06: `eslint-disable-next-line @next/next/no-img-element` on DiscoveryWatchCard image

**File:** `src/components/explore/DiscoveryWatchCard.tsx:31-37`
**Issue:** `<img>` is used (with the lint suppression) instead of `next/image`. Reasonable for an MVP card if image URLs come from many external sources and Next/Image's domain config is not set up — but the suppression has no comment explaining why. Future readers may "fix" this by switching to `<Image>` and break image rendering for catalog watches whose imageUrl is not in the next.config.ts allowlist.

**Fix:** Add a one-line rationale next to the lint suppression:
```tsx
{/* Catalog watch images come from arbitrary external sources (URL extraction) — not a fixed remoteimages allowlist, so next/image would block. */}
{/* eslint-disable-next-line @next/next/no-img-element */}
<img ... />
```

---

_Reviewed: 2026-04-28T17:09:11Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
