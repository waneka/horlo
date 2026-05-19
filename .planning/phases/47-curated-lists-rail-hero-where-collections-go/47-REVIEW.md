---
phase: 47-curated-lists-rail-hero-where-collections-go
reviewed: 2026-05-19T00:00:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - src/app/explore/lists/[id]/page.tsx
  - src/app/explore/lists/page.tsx
  - src/app/explore/page.tsx
  - src/app/explore/paths/page.tsx
  - src/components/explore/CuratedListsRail.tsx
  - src/components/explore/HeroModule.tsx
  - src/components/explore/ListSortFilterControls.tsx
  - src/components/explore/PathCard.tsx
  - src/components/explore/RailListCard.tsx
  - src/components/explore/WhereCollectionsGo.tsx
  - src/components/explore/__tests__/CuratedListsRail.test.tsx
  - src/components/explore/__tests__/HeroModule.test.tsx
  - src/components/explore/__tests__/WhereCollectionsGo.test.tsx
  - src/data/collectionPaths.ts
  - src/data/curatedLists.ts
  - src/data/__tests__/curatedLists.test.ts
  - src/db/schema.ts
  - src/lib/heroTypes.ts
  - src/lib/pathTypes.ts
  - src/lib/weekIndex.ts
  - src/lib/__tests__/weekIndex.test.ts
  - supabase/migrations/20260519000000_phase47_published_at.sql
findings:
  critical: 2
  warning: 6
  info: 4
  total: 12
status: fixes_applied
fixes_applied_at: 2026-05-19
fixes_resolved: [CR-01, CR-02, WR-01, WR-02, WR-03, WR-04, WR-05, WR-06, IN-01, IN-04]
fixes_accepted: [IN-02, IN-03]
fixes_skipped: []
---

# Phase 47: Code Review Report

**Reviewed:** 2026-05-19T00:00:00Z
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

## Summary

Phase 47 wires the Curated Lists rail, the quality-gated Hero module, the Where
Collections Go paths module, and their see-all routes. The draft-leak focus area
is handled correctly: every public DAL read (`getPublishedLists`,
`getPublishedPaths`, `getListWithItems`) carries an explicit
`status = 'published'` predicate, and `getListWithItems` re-checks
`list.status !== 'published'` so a draft `[id]` resolves to `notFound()`. The
`'use cache'` boundaries also correctly keep `getCurrentUser()` outside the
cached scope in every page.

However, two cache-correctness defects are blockers. First, `CuratedListsRail`
and `WhereCollectionsGo` cache under the `'explore'` / `'explore:lists'` /
`'explore:paths'` tags, but every CMS Server Action only ever calls
`revalidateTag('explore:hero', 'max')` — so publishing, unpublishing, editing,
reordering, or deleting a list/path will never invalidate the rail or the paths
module. Public surfaces will serve stale content (including content that was
just unpublished) for the full `cacheLife('hours')` window. Second, the XSS
control on the list-item `commentary` field is incomplete: `introMarkdown` goes
through `rehypeSanitize`, but `item.commentary` is rendered as a plain string
(safe) while the spec treats curator commentary as editorial copy — see WR-01
for the residual risk if commentary ever becomes markdown.

The weekly-rotation logic is deterministic but interacts badly with `'use cache'`
(WR-02): `getWeekIndex(new Date())` reads wall-clock time *inside* a cached
function, so the rotation only advances when the cache entry is evicted, not on
a clean 7-day boundary.

## Critical Issues

### CR-01: Rail and Paths modules are never cache-invalidated — stale/unpublished content leaks

**Status:** RESOLVED (commit 6616446) — every list/path CMS Server Action that
affects public rendering now also calls `revalidateTag('explore:lists', 'max')`
/ `revalidateTag('explore:paths', 'max')` (publish, unpublish, update, delete,
item add/remove/commentary, reorder). The unused `'explore'` umbrella tag was
removed from `CuratedListsRail`/`WhereCollectionsGo`'s `cacheTag` calls so the
tag set no longer implies coverage that does not exist.

**File:** `src/components/explore/CuratedListsRail.tsx:25`, `src/components/explore/WhereCollectionsGo.tsx:27`
**Issue:** `CuratedListsRail` tags its `'use cache'` entry `cacheTag('explore', 'explore:lists')` and `WhereCollectionsGo` tags `cacheTag('explore', 'explore:paths')`. But a grep of every CMS Server Action (`src/app/actions/cms/curatedLists.ts`, `collectionPaths.ts`, `settings.ts`) shows the *only* tag ever passed to `revalidateTag` is `'explore:hero'`. Nothing in the codebase calls `revalidateTag('explore')`, `revalidateTag('explore:lists')`, or `revalidateTag('explore:paths')`.

Consequences:
- Publishing a new list → the rail does not show it until the `cacheLife('hours')` window expires.
- **Unpublishing a list → it keeps rendering on the public rail and `/explore/lists` for up to an hour.** This is a draft-leak by another route: content the curator deliberately took down stays publicly visible. The explicit `status='published'` DAL filter does not help because the *cached HTML* is served without re-running the DAL.
- Editing a list title/cover, reordering, or deleting a list/path is invisible on the rail until eviction.

The component header comment in `WhereCollectionsGo.tsx:12-13` explicitly claims "revalidated when path publish state changes (Phase 45 wiring)" — that wiring does not exist for the `explore`/`explore:paths` tags.

**Fix:** Either (a) add the missing tags to every relevant CMS action, e.g. in `curatedLists.ts` publish/unpublish/update/delete/reorder actions:
```ts
revalidateTag('explore:hero', 'max')
revalidateTag('explore:lists', 'max')   // ADD — invalidates CuratedListsRail + see-all
```
and in `collectionPaths.ts`:
```ts
revalidateTag('explore:hero', 'max')
revalidateTag('explore:paths', 'max')   // ADD — invalidates WhereCollectionsGo
```
or (b) retag the components to `'explore:hero'` if a single shared invalidation is acceptable. Option (a) is correct given the comments' stated intent. Verify the `'explore'` umbrella tag is also fired or remove it from `cacheTag` so it does not imply coverage it does not have.

### CR-02: `/explore/lists/[id]` renders a draft-or-not-found list with no IDOR/enumeration guard difference, but `generateMetadata` leaks list existence via title

**Status:** RESOLVED (commit 8293b7d) — the redundant `getListItemCount(id)`
call was dropped; the header watch count is now derived as `list.items.length`,
guaranteed consistent with the rendered editorial rows and one DB round-trip
lighter per page load.

**File:** `src/app/explore/lists/[id]/page.tsx:34-39`
**Issue:** `generateMetadata` calls `getListWithItems(id)` which correctly returns `null` for drafts and unknown ids — so the title falls back to `'List Not Found — Horlo'`. That part is fine. The real defect is the **page body fetches the same list twice**: `getListWithItems(id)` at line 36 (metadata) and again at line 46 (page), plus a *third* independent `getListItemCount(id)` at line 51. `getListWithItems` already returns `items`, so the item count for the header (`watchCount` at line 51, used as `{watchCount} watches` at line 74) can be derived as `list.items.length` with zero extra queries.

More importantly: this is a published-only page with no per-row authorization beyond `status='published'`, which is correct for *public* lists. But `getCurrentUser()` at line 43 is called purely as an auth assertion and its result is discarded — meaning any authenticated user can view any published list. That is the intended model, so it is not an IDOR per se. The blocker is the **redundant third query** combined with the fact that `getListItemCount` counts `curated_list_items` directly while `list.items` is the result of an `innerJoin` against `watches_catalog`. If a list item references a catalog row that was deleted (the FK is `ON DELETE RESTRICT`, so this should not happen — but `getListItems` uses `innerJoin`), `getListItemCount` and `list.items.length` will **disagree**, and the header will claim a different watch count than the number of editorial rows actually rendered. The page presents two contradictory counts of the same list to the user.

**Fix:** Drop the separate `getListItemCount` call and derive the count from the already-fetched items so the header and the rendered rows are guaranteed consistent:
```ts
const list = await getListWithItems(id)
if (!list) notFound()
const watchCount = list.items.length          // consistent with rendered rows
const timestamp = getRelativeTimestamp(list.publishedAt ?? null)
```
This also removes one DB round-trip per page load. (If a count that includes items whose catalog row is missing is genuinely desired, then `getListItems` should `leftJoin` instead of `innerJoin` and render a fallback — but mixing an `innerJoin` list with a raw `count(*)` is the bug.)

## Warnings

### WR-01: `item.commentary` and `node.rationale` bypass `rehypeSanitize` — XSS risk if curator copy is ever treated as markdown/HTML

**Status:** RESOLVED (commit 15d42d3) — explicit code comments were added at the
three plain-text commentary/rationale render sites (`[id]/page.tsx` and both
`PathCard.tsx` layouts) stating the copy is intentionally rendered as escaped
plain text and that any future move to markdown MUST route through
`rehypeSanitize` and never `dangerouslySetInnerHTML`.

**File:** `src/app/explore/lists/[id]/page.tsx:120-122`, `src/components/explore/PathCard.tsx:101-103`, `131-132`
**Issue:** `introMarkdown` is correctly rendered through `ReactMarkdown` + `rehypeSanitize` (line 81). But `item.commentary` (line 121) and `node.rationale` (PathCard lines 102, 131) are curator-authored editorial copy from the same CMS, rendered as plain `{string}` children. As plain JSX text children React escapes them, so there is **no live XSS today**. The risk is asymmetry: a future change that "upgrades" commentary to markdown for consistency with the intro copy will almost certainly copy the `<ReactMarkdown>` call *without* the `rehypePlugins={[rehypeSanitize]}` prop, because the safe pattern is not co-located. The intro-copy comment (`// REQUIRED: ... rehypeSanitize`) does not extend to these fields.
**Fix:** Add an explicit code comment at each plain-text commentary/rationale render site stating it is intentionally rendered as escaped plain text and that any move to markdown MUST route through `rehypeSanitize`. Better: extract a shared `<CuratorMarkdown source={...} />` component that bakes in `rehypeSanitize` so there is one safe rendering path for all curator copy.

### WR-02: Weekly rotation reads wall-clock time inside a `'use cache'` scope — rotation does not advance on a 7-day boundary

**Status:** RESOLVED (commit 52a9cfa) — `getWeekIndex(new Date())` is now
computed in `/explore/page.tsx` OUTSIDE the cached modules and passed into
`HeroModule` and `WhereCollectionsGo` as a `weekIndex` prop, making it a
cache-KEY input. The rotation advances deterministically on the 7-day boundary
instead of freezing at cache-population time. (Logic-key change — confirm the
rotation advances as expected on the next week boundary.)

**File:** `src/components/explore/HeroModule.tsx:71`, `src/components/explore/WhereCollectionsGo.tsx:36`
**Issue:** Both modules compute `getWeekIndex(new Date())` *inside* a function marked `'use cache'` with `cacheLife('hours')`. `new Date()` is evaluated once, when the cache entry is first populated, and then frozen into the cached output. The rotation therefore advances only when the cache entry happens to be evicted/revalidated — not on the clean weekly boundary the design (`D-07` / `D-13`) promises. With an hours-long `cacheLife`, the displayed week index can lag the true week index, and two different explore pages cached at different times can show different rotations. The `weekIndex.ts` header comment claims it is used "as an implicit cache-key input" — but a value read *inside* a cache scope is an *output*, not a key input; it does not participate in the cache key at all.
**Fix:** Compute `getWeekIndex(new Date())` *outside* the cached function and pass it in as an argument, so it becomes part of the cache key:
```ts
// page.tsx (uncached)
<HeroModule weekIndex={getWeekIndex(new Date())} />
// HeroModule.tsx
export async function HeroModule({ weekIndex }: { weekIndex: number }) {
  'use cache'
  ...
}
```
A distinct `weekIndex` argument forces a fresh cache entry every 7 days. Note this still depends on CR-01-style tag wiring being correct, but it makes the rotation deterministic rather than eviction-dependent.

### WR-03: `getListWithItems` re-queries `curated_lists` instead of reusing `getListById`, and is called twice per detail-page render

**Status:** RESOLVED (commit ee224a5) — `getListWithItems` now calls
`getListById(id)` and applies the `status !== 'published'` gate in JS; the
gratuitous duplicate `select().from().where().limit()` body is removed. The
detail page still calls `getListWithItems` twice (metadata + body), but the
redundant `getListItemCount` query was eliminated separately by CR-02.

**File:** `src/data/curatedLists.ts:46-58`, `src/app/explore/lists/[id]/page.tsx:36,46`
**Issue:** `getListWithItems` (lines 49-54) duplicates the exact `select().from(curatedLists).where(eq(id)).limit(1)` body of `getListById` instead of calling it. The comment at line 47-48 acknowledges this ("`getListById` has no status filter ... re-query with the published filter here") but `getListById` returns the full row and the status filter could be applied in JS on its result — the duplication is gratuitous. Combined with CR-02, the detail page issues this query twice (metadata + body) plus `getListItemCount` — 3 queries where 1 would do. Next.js request memoization does **not** cover Drizzle calls (only `fetch`), so these are real duplicate round-trips.
**Fix:** Have `getListWithItems` call `getListById(id)` and apply `if (!list || list.status !== 'published') return null`. Accept that the page will still call it twice (metadata + body) unless the count derivation in CR-02 is also applied; if duplicate-query cost matters, cache the lookup with React `cache()`.

### WR-04: `pathsByType` grouping casts `path.pathType as PathType` with no validation — unknown path types silently vanish

**Status:** RESOLVED (commit dfe708e) — `/explore/paths` now partitions paths
explicitly: known types group into `pathsByType`, unknown-typed paths collect
into `unknownTypePaths`, which is `console.error`-logged and rendered in a
trailing "Other" section so published content is never silently dropped.

**File:** `src/app/explore/paths/page.tsx:48-51,69`
**Issue:** `collection_paths.pathType` is a free `text` column (schema line 615 — "text + CHECK, not enum"). The page does `const type = path.pathType as PathType` (line 48) and groups into `pathsByType`. The render loop then iterates only the four hardcoded `PATH_TYPES` values (line 69). If the DB ever holds a `pathType` outside that set — a CHECK-constraint drift, a new value added in the migration but not in `pathTypes.ts`, or a manual DB edit — that path is grouped under a key that `PATH_TYPES.filter(...)` never visits, so **the published path silently disappears from `/explore/paths`** with no error and no log. The `as PathType` cast hides this from the type checker.
**Fix:** Instead of unconditionally trusting the cast, partition explicitly and surface the leftover:
```ts
const known = new Set<string>(PATH_TYPES)
const unknown = validPaths.filter((p) => !known.has(p.pathType))
if (unknown.length > 0) console.error('Unknown pathType(s) on published paths:', unknown.map(p => p.id))
```
or render unknown-typed paths in a trailing "Other" section so published content is never silently dropped.

### WR-05: `HeroModule` builds a `HeroFeature` union then immediately checks `feature.format !== 'featured_list'` — dead branch, and `featured` is non-null-asserted unsafely

**Status:** RESOLVED (commit 52a9cfa) — the statically-unreachable
`if (feature.format !== 'featured_list') return null` line was removed from
`HeroModule`. The `HeroFeature` union shape is retained (with a clarifying
comment) for SEED-008's future `featured_collector` variant per D-10.

**File:** `src/components/explore/HeroModule.tsx:81-84`
**Issue:** Line 81 constructs `feature` with a hardcoded `format: 'featured_list'`. Line 83 then checks `if (feature.format !== 'featured_list') return null` — a branch that is statically unreachable, since `feature.format` was just literally assigned `'featured_list'`. TypeScript narrows it to the literal, so this is dead code. Separately, at line 77 `featured = sorted[week % sorted.length]` can in principle be `undefined` if `sorted` were empty — it is not (guarded by line 58), so this is safe, but line 81's `{ ...featured, itemCount: featured.itemCount }` relies on `featured` being non-null with no assertion; the control flow proves it but it is fragile. The dead branch suggests the discriminated-union forward-compat scaffolding (`heroTypes.ts`) was bolted on without a real second variant path.
**Fix:** Remove the dead `if (feature.format !== 'featured_list') return null` line. If the union is genuinely forward-compat scaffolding, drive `format` from `settings.heroFormat` (which the schema supports — `cms_settings.heroFormat`) and `switch` on it, so the union has a real decision point instead of a hardcoded literal followed by an impossible check.

### WR-06: `getRelativeTimestamp` and `isNew` duplicated verbatim across two files; both run on the server inside a cache scope using `Date.now()`

**Status:** RESOLVED (commit 420120e) — `getRelativeTimestamp` and `isNew` were
extracted to a single shared module `src/lib/relativeTime.ts` and imported in
both `[id]/page.tsx` and `RailListCard.tsx`. The helpers accept an optional
`now` reference; the hours-granularity cache drift for the "New" badge is
explicitly documented in the module header and accepted for v1.

**File:** `src/app/explore/lists/[id]/page.tsx:23-32`, `src/components/explore/RailListCard.tsx:24-39`
**Issue:** `getRelativeTimestamp` is copy-pasted identically into `[id]/page.tsx` and `RailListCard.tsx` (the `[id]` page comment even says "shared logic with RailListCard"). Beyond the duplication: `RailListCard` is rendered inside `CuratedListsRail`'s `'use cache'` scope, so `Date.now()` in `getRelativeTimestamp`/`isNew` is frozen at cache-population time. A list published 6 days ago will keep showing the "New" badge and "6 days ago" for the entire `cacheLife('hours')` window even as real time advances — and once past the hour it jumps. The badge boundary (`< 7 days`) is therefore approximate, not exact. Same `Date.now()`-in-cache issue as WR-02.
**Fix:** Extract the timestamp helper to a shared module (e.g. `src/lib/relativeTime.ts`) and import it in both files. For the freshness accuracy, either accept the hours-granularity drift explicitly in a comment, or compute "is new" against `publishedAt` on the client (`RailListCard` would need a small client subcomponent for the badge) so it reflects real time.

## Info

### IN-01: `setListStatus` casts the update payload to `any` to smuggle a raw SQL expression

**Status:** RESOLVED (commit b64f274) — `updateFields` is now typed as
`PgUpdateSetSource<typeof curatedLists>`, the exact type Drizzle's `.set()`
expects. That type checks every field name against the table AND natively
permits a raw `SQL` value per column, so the `sql\`COALESCE(...)\`` expression
assigns to `publishedAt` with no `any` cast — the `eslint-disable` comment was
removed. (Note: `Partial<typeof curatedLists.$inferInsert>` was tried first but
types `publishedAt` as a plain `Date` and rejects the `SQL` expression;
`PgUpdateSetSource` is the correct typed shape.) The D-03 COALESCE-on-first-publish
behavior is unchanged — re-publishing after an unpublish still does NOT reset
`published_at`. `npx tsc --noEmit` reports no new errors and the existing D-03
`setListStatus` tests in `curatedLists.test.ts` still pass.

**File:** `src/data/curatedLists.ts:113-121`
**Issue:** `updateFields` is typed `Record<string, unknown>` and then cast `as any` (with an eslint-disable) so the `sql\`COALESCE(...)\`` expression can be assigned to `publishedAt`. This works but discards all Drizzle type checking for the entire `.set()` call — a typo in any other field name would not be caught.
**Fix:** Build a typed object instead: declare it as `Partial<typeof curatedLists.$inferInsert>` or use two distinct `.set()` shapes (one for `published`, one for `draft`) so each is fully typed and no `any` is needed.

### IN-02: `getPathWithNodes` is called per-path in a `Promise.all` loop — N+1 on `/explore/paths` and in `WhereCollectionsGo`

**Status:** ACCEPTED (wontfix) — the reviewer's own Fix note states "None required
for v1". N+1 is acceptable at the current scale (≤12 lists/paths); no code change
made. Re-evaluate if published-path count grows past ~100.

**File:** `src/app/explore/paths/page.tsx:36-38`, `src/components/explore/WhereCollectionsGo.tsx:54-56`, `src/components/explore/CuratedListsRail.tsx:32-37`
**Issue:** `getPathWithNodes` itself issues 2 queries (`getPathById` + `getPathNodes` + seed-watch select = 3), called once per path. `CuratedListsRail` similarly fires `getListItemCount` per list. The code comments label this "acceptable at current scale" / "N+1 is acceptable for ≤12 lists". Per the review scope, performance is out of scope for v1 — flagged as Info only so it is on record. At >100 published paths the see-all route would issue 300+ queries.
**Fix:** None required for v1. If revisited, batch node fetches with a single `WHERE path_id IN (...)` query and group in JS.

### IN-03: Migration backfills `published_at = created_at` — rotation/freshness ordering may be wrong for pre-existing lists

**Status:** ACCEPTED (wontfix) — the reviewer's own Fix note states "None
required"; `published_at = created_at` is a defensible default for a single-user
personal-first app. The migration is also already applied to the production
database, so it must not be altered. No code change made.

**File:** `supabase/migrations/20260519000000_phase47_published_at.sql:10-12`
**Issue:** Existing published lists get `published_at = created_at`. If a list was created long before it was published, its rotation order (`HeroModule` sorts by `publishedAt` asc) and its "New" badge will reflect creation time, not actual publish time. For a single-user personal-first app this is cosmetic and likely fine, but it is a silent data-quality assumption worth recording.
**Fix:** None required. If a list-level `updatedAt` is closer to the true publish time it could be used instead, but `created_at` is a defensible default.

### IN-04: Tests assert structure but never assert the draft-leak filter at the integration level

**Status:** RESOLVED (commit a0b3e21) — `curatedLists.test.ts` gains a new test,
"passes a predicate that references the status column and the literal
'published'", that captures the actual `.where()` argument and inspects the
Drizzle condition's `queryChunks` (via a new `inspectCondition` helper that
extracts referenced column names and bound `Param` values). It asserts the
predicate references the `status` column, includes the literal `'published'`,
and does NOT include `'draft'`. A regression to `eq(status,'draft')` or removal
of the filter now fails the test — verified by temporarily inverting the filter
and confirming the test fails (`expected [ 'draft' ] to include 'published'`).
(`getPublishedPaths`/`getListWithItems` are not exercised in this test file —
`curatedLists.test.ts` only covers the `curatedLists` DAL — so the strengthening
was scoped to `getPublishedLists`.) All 11 tests in the file pass.

**File:** `src/data/__tests__/curatedLists.test.ts:132-153`, `src/components/explore/__tests__/HeroModule.test.tsx`
**Issue:** `curatedLists.test.ts` verifies `getPublishedLists` "calls `.where()`" but never asserts *what* predicate was passed — `lastWhereArg` is captured by the mock infrastructure (lines 30-31) but never `expect`-ed. A regression that swapped the filter to `eq(status, 'draft')` would still pass the test ("`.where()` was called"). The HeroModule tests mock the DAL entirely, so the `status='published'` gate is never exercised end-to-end anywhere. The draft-leak defense — the phase's stated #1 focus area — has no test that would actually catch its removal.
**Fix:** Assert the captured `lastWhereArg` serializes to a `status = 'published'` predicate (Drizzle conditions expose their structure), or add a DAL integration test against a real test DB seeded with one draft + one published row that asserts `getPublishedLists()` returns only the published row.

---

_Reviewed: 2026-05-19T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
