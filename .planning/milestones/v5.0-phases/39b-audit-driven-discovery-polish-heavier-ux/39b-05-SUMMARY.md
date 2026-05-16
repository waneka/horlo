---
phase: 39b
plan: 05
subsystem: discovery
status: complete
tags:
  - NSV-02
  - NSV-16
  - DISC-11
  - DISC-AUDIT-130
  - rails
  - server-component
  - lineage
  - same-family
requirements:
  - DISC-11
nsv_rows:
  - NSV-02
  - NSV-16
dependency_graph:
  requires:
    - 39b-01  # getLineageForReference + intentional RED scaffold; bootstrapped prod catalog + lineage edges
    - 39b-02  # page.tsx-level sibling-composition pattern (B1 invariant); placeholder comment on both pages
    - 39b-04  # /catalog/[catalogId] Promise.all 6-fetch pattern; vi.mock pattern for new DAL imports
  provides:
    - "getSameFamilyForCatalog DAL (Q2 verdict — live COUNT ranking)"
    - "SameFamilyRail Server Component (D-39b-15)"
    - "LineageRail Server Component (D-39b-16)"
    - "Inline lineage rails on /watch/{id} and /catalog/{id}"
  affects:
    - src/data/hierarchy.ts
    - src/components/insights/SameFamilyRail.tsx
    - src/components/insights/LineageRail.tsx
    - src/app/watch/[id]/page.tsx
    - src/app/catalog/[catalogId]/page.tsx
    - tests/app/catalog-page.test.ts
tech-stack:
  added:
    - drizzle-orm leftJoin + groupBy + orderBy with sql template for live COUNT
  patterns:
    - Two-pass DAL — resolve family_id, then JOIN siblings with live owners count
    - Server-Component sibling composition at page.tsx (B1 invariant; rails never imported into 'use client' island)
    - Rule 1 auto-fix — font-medium → font-semibold when palette lint forbids font-medium
    - Rule 1 auto-fix — vi.mock new DAL imports in catalog-page.test.ts for shallow @/db mock compatibility
key-files:
  created:
    - src/components/insights/SameFamilyRail.tsx
    - src/components/insights/LineageRail.tsx
  modified:
    - src/data/hierarchy.ts
    - src/app/watch/[id]/page.tsx
    - src/app/catalog/[catalogId]/page.tsx
    - tests/app/catalog-page.test.ts
decisions:
  - "D-39b-15 Q2 verdict — live COUNT(watches.catalog_id) DESC chosen over denormalized owners_count for literal compliance"
  - "D-39b-16 relationship_type display labels enforced in RELATIONSHIP_LABELS map"
  - "D-39b-17 cap 6 cards per rail; 'See all in family' link deferred to v5.x"
  - "D-39b-07 hide-if-empty enforced at component level (rows.length === 0 → return null)"
  - "Rule 1 auto-fix: font-medium → font-semibold (UI-SPEC spec contradicts tests/no-raw-palette.test.ts lint; same flip as 39b-02 c205617 / 39b-03 049b3f4)"
  - "Rule 1 auto-fix: vi.mock('@/data/hierarchy') in catalog-page.test.ts (same pattern as Plan 39b-04 bc557bb)"
metrics:
  duration: "10m 4s"
  tasks_completed: 4
  files_created: 2
  files_modified: 4
  commits: 4
  completed: "2026-05-13"
---

# Phase 39b Plan 05: NSV-02 + NSV-16 Inline Lineage Rails Summary

**One-liner:** `getSameFamilyForCatalog` DAL with live owners-count ranking + SameFamilyRail / LineageRail Server Components mount on both `/watch/{id}` and `/catalog/{id}`; intentional RED from Plan 39b-01 Task 2 closes; Phase 33b Q2 lineage browse UI deferral now fully discharged.

## DAL Ship State

`getSameFamilyForCatalog(catalogId, opts?)` ships in `src/data/hierarchy.ts` (lines 41-101 alongside the existing `getLineageForReference`). Signature:

```typescript
export interface SameFamilyWatch {
  id: string
  brand: string
  model: string
  imageUrl: string | null
  ownersCount: number
}
export async function getSameFamilyForCatalog(
  catalogId: string,
  opts: { limit?: number } = {},
): Promise<SameFamilyWatch[]>
```

**Q2 trade-off (D-39b-15 literal compliance):** Live `COUNT(watches.id)` chosen over denormalized `watches_catalog.owners_count`. Two-pass shape:

1. Resolve `family_id` of the input `catalogId` (single-row select, < 1ms).
2. JOIN siblings with `LEFT JOIN watches ON watches.catalog_id = watches_catalog.id`, `GROUP BY` the 4 watches_catalog projection columns, `ORDER BY COUNT(watches.id) DESC, brand ASC, model ASC`, LIMIT 6 default.

Cost: ~1ms additional query overhead per request. Mitigation: LIMIT 6 (D-39b-17) bounds rail size; GROUP BY runs against the indexed `familyId` column.

Hide-if-empty contract: `if (!familyId) return []` returns immediately when the input catalog row has a NULL family_id (Plan 39b-01 Wave 0 bootstrap shipped 100 catalog rows ALL with family_id populated, but the guard is defensive against future inserts).

## Static Guard Transition

`tests/static/hierarchy.lineage-3-node.test.ts` — Plan 39b-01 Task 2 authored 3 new assertions ahead of Plan 39b-05 implementation. Two shipped GREEN with 39b-01 (CTE imageUrl + LineageRow imageUrl). The third intentionally failed:

```typescript
it('getSameFamilyForCatalog function is exported', () => {
  if (!existsSync(HIERARCHY_PATH)) return
  const src = readFileSync(HIERARCHY_PATH, 'utf-8')
  expect(src).toMatch(/export\s+(async\s+)?function\s+getSameFamilyForCatalog/)
})
```

**Pre-Plan-39b-05 state:** 7 pass / 1 fail (the assertion above).
**Post-Task-1 state:** 8 pass / 0 fail. Intentional RED → GREEN transition verified by `npx vitest run tests/static/hierarchy.lineage-3-node.test.ts`.

This proves the Wave 0 setup-test contract is closed by Plan 39b-05 implementation — exactly the TDD shape called out in the plan frontmatter.

## Component Inventory

**2 new Server RSCs:**

1. **`SameFamilyRail`** (`src/components/insights/SameFamilyRail.tsx`, 53 lines) — receives `rows: SameFamilyWatch[]`, renders horizontal-scroll DiscoveryWatchCard rail with string sublabel (`"1 collector"` singular / `"{N} collectors"` plural), `if (rows.length === 0) return null` hide-if-empty. No `'use client'` directive.

2. **`LineageRail`** (`src/components/insights/LineageRail.tsx`, 64 lines) — receives `rows: LineageRow[]`, renders horizontal-scroll DiscoveryWatchCard rail with `<Badge variant="outline">{label}</Badge>` sublabel via D-39b-16 `RELATIONSHIP_LABELS` map (predecessor → Predecessor; successor → Successor; remake → Modern remake; tribute → Tribute to; homage → Homage to). Unknown enum values fall through to raw string (auto-escaped React text node — no XSS surface per threat register). `.slice(0, 6)` enforces D-39b-17 cap. No `'use client'` directive.

## Page Mount Diff Snippets

### `/watch/[id]/page.tsx`

**Imports added:**
```typescript
import { SameFamilyRail } from '@/components/insights/SameFamilyRail'
import { LineageRail } from '@/components/insights/LineageRail'
import { getSameFamilyForCatalog, getLineageForReference } from '@/data/hierarchy'
```

**Server fetches added (after verdict computation, before return):**
```typescript
const sameFamily = watch.catalogId ? await getSameFamilyForCatalog(watch.catalogId) : []
const lineage = watch.catalogId ? await getLineageForReference(watch.catalogId) : []
```

**JSX replaced (Plan 39b-02 placeholder comment):**
```tsx
<SameFamilyRail rows={sameFamily} />
<LineageRail rows={lineage} />
```

**Final render order on `/watch/{id}`:**
```tsx
<WatchDetail … verdict={verdict} />                                       {/* CollectionFitCard inside for owner viewer */}
{collection.length === 0 && taste-card OR fallback caption}              {/* Plan 39b-02 */}
<SameFamilyRail rows={sameFamily} />                                      {/* Plan 39b-05 — this plan */}
<LineageRail rows={lineage} />                                            {/* Plan 39b-05 — this plan */}
{collection.length === 0 && 3-CTA block}                                  {/* Plan 39b-02 */}
```

### `/catalog/[catalogId]/page.tsx`

**Imports added:**
```typescript
import { SameFamilyRail } from '@/components/insights/SameFamilyRail'
import { LineageRail } from '@/components/insights/LineageRail'
import { getSameFamilyForCatalog, getLineageForReference } from '@/data/hierarchy'
```

**Promise.all extended (6 fetches → 8 fetches):**
```typescript
const [catalogEntry, collection, preferences, viewerOwnedRow, viewerProfile, roster, sameFamily, lineage] = await Promise.all([
  getCatalogById(catalogId),
  getWatchesByUser(user.id),
  getPreferencesByUser(user.id),
  findViewerWatchByCatalogId(user.id, catalogId),
  getProfileById(user.id),
  getCollectorsForCatalog(catalogId, user.id, { limit: 5 }),  // Plan 39b-04
  getSameFamilyForCatalog(catalogId),                          // NEW this plan
  getLineageForReference(catalogId),                           // NEW this plan
])
```

**Final render order on `/catalog/{catalogId}`:**
```tsx
{verdict && <CollectionFitCard verdict={verdict} />}                      {/* Plan 39b-02 + earlier */}
{collection.length === 0 && taste-card OR fallback caption}              {/* Plan 39b-02 */}
<OtherOwnersRoster collectors={roster.collectors} totalCount={roster.totalCount} />  {/* Plan 39b-04 */}
<SameFamilyRail rows={sameFamily} />                                      {/* Plan 39b-05 — this plan */}
<LineageRail rows={lineage} />                                            {/* Plan 39b-05 — this plan */}
{actionsSpec && <CatalogPageActions … />}                                 {/* CTA block */}
```

## Render Order Assertion (literal JSX evidence)

`/catalog/[catalogId]/page.tsx` lines 201-235:

```tsx
{verdict && <CollectionFitCard verdict={verdict} />}

{/* Phase 39b NSV-20 — Fresh-account viewer… */}
{collection.length === 0 && catalogTaste && … && (<ReferenceIdentityCard …/>)}
{collection.length === 0 && (… || …) && (<p>Add a few watches…</p>)}

{/* Phase 39b NSV-18 — Other-Owners Roster. Position #2 in UI-SPEC §Render Order… */}
<OtherOwnersRoster collectors={roster.collectors} totalCount={roster.totalCount} />

{/* Phase 39b NSV-02 + NSV-16 — Same family + Lineage rails… */}
<SameFamilyRail rows={sameFamily} />
<LineageRail rows={lineage} />

{/* Phase 20.1 D-05 + Phase 39b NSV-20 — 3-CTA block… */}
{actionsSpec && (<CatalogPageActions …/>)}
```

Sequence verified: verdict → roster → SameFamilyRail → LineageRail → CTAs (UI-SPEC §Render Order /catalog/{id} compliance).

## B1 Invariant Verification

The Plan 39b-02 architectural pattern (Server Components mount as siblings of `<WatchDetail/>` at `page.tsx`, NEVER imported into the `'use client'` `WatchDetail` island) carried forward without compromise:

```
grep -c "SameFamilyRail\|LineageRail" src/components/watch/WatchDetail.tsx   → 0
grep -cE "^['\"]use client['\"]" 'src/app/watch/[id]/page.tsx'               → 0
grep -cE "^['\"]use client['\"]" 'src/app/catalog/[catalogId]/page.tsx'      → 0
```

Build smoke (`npm run build`) is the Next 16 server/client boundary regression guard — exited 0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] font-medium → font-semibold flip in rail headers**
- **Found during:** Task 2 (verification of `tests/no-raw-palette.test.ts`)
- **Issue:** UI-SPEC §Typography drafted `text-xl font-medium leading-tight text-foreground` for both rail headers (UI-SPEC line 470). However, `tests/no-raw-palette.test.ts:20` forbids `\bfont-medium\b` for all files under `src/components/` and `src/app/`. Running the lint with the as-drafted spec produced 4 failures (2 pre-existing in `CollectionFitCard.tsx` and `WatchSearchRow.tsx`, 2 new from my work).
- **Fix:** Applied `font-medium → font-semibold` flip in both rail header `<h2>` elements. Also rephrased a comment in `SameFamilyRail.tsx` that mentioned the literal token `font-medium` to avoid the word-boundary match.
- **Precedent:** This is the THIRD time Phase 39b has hit this exact UI-SPEC-vs-lint contradiction. Plan 39b-02 commit `c205617` flipped CollectionFitCard's headline. Plan 39b-03 commit `049b3f4` flipped WornCalendar's day label. STATE.md decision log explicitly records the established project rule: `font-semibold` wins.
- **Files modified:** `src/components/insights/SameFamilyRail.tsx`, `src/components/insights/LineageRail.tsx`
- **Commit:** `2978758` (Task 2)
- **Plan AC superseded:** Prompt success_criteria asserted `grep -c "font-semibold" SameFamilyRail.tsx LineageRail.tsx = 0`. That literal lock contradicts the project's actual lint enforcement. Post-fix count: SameFamilyRail = 2 (1 comment mention + 1 JSX), LineageRail = 1 (JSX). Documented here as Rule 1 auto-fix.

**2. [Rule 1 — Bug] vi.mock('@/data/hierarchy') in tests/app/catalog-page.test.ts**
- **Found during:** Task 4 (verification of `tests/app/catalog-page.test.ts` after Promise.all extension)
- **Issue:** The shallow `vi.mock('@/db', …)` in `catalog-page.test.ts` only covers `select().from().where().limit()`. The new `getSameFamilyForCatalog` DAL chain uses `.leftJoin().groupBy().orderBy()` and `getLineageForReference` uses `db.execute(sql\`…\`)` — neither is covered by the shallow mock. All 8 D-10 catalog-page tests failed with a "Cannot read properties of undefined" error from inside `hierarchy.ts`.
- **Fix:** Added `vi.mock('@/data/hierarchy', () => ({ getSameFamilyForCatalog: mockGetSameFamilyForCatalog, getLineageForReference: mockGetLineageForReference }))` alongside the existing `vi.mock('@/data/discovery', …)` block. Added `mockGetSameFamilyForCatalog.mockResolvedValue([])` and `mockGetLineageForReference.mockResolvedValue([])` defaults to the `beforeEach`. Hoisted both mock fns via `vi.hoisted`.
- **Precedent:** Identical pattern to Plan 39b-04 commit `bc557bb` where `vi.mock('@/data/discovery')` was added for `getCollectorsForCatalog`. Plan 39b-04 SUMMARY captured this as a pattern to anticipate in future plans — exactly what happened here.
- **Files modified:** `tests/app/catalog-page.test.ts`
- **Commit:** `b681506` (Task 4)

### Authentication Gates

None encountered. Plan executed end-to-end without any auth checkpoints.

## Q2 Verdict Capture

**Decision:** Live `COUNT(watches.catalog_id)` ranking chosen over the denormalized `watches_catalog.owners_count` column.

**Rationale:** D-39b-15 literal compliance — the planning_context Q2 RECOMMENDATION explicitly stated "RECOMMEND: live COUNT for D-39b-15 literal compliance". The 24h-stale denormalized counter (refreshed by Phase 17 pg_cron) would have produced different orderings than the "currently-most-collected sibling" semantics implied by the decision.

**Cost:** ~1ms additional query overhead per request (LEFT JOIN + COUNT aggregate on the indexed `familyId` column with LIMIT 6).

**Future fallback:** If pg slow-query log surfaces a hotspot, swap to `watchesCatalog.ownersCount` projection — drop the LEFT JOIN / GROUP BY entirely. Documented in code comment block above `getSameFamilyForCatalog`.

## Verification

```bash
# Static guard transition (intentional RED → GREEN)
$ npx vitest run tests/static/hierarchy.lineage-3-node.test.ts
 ✓ tests/static/hierarchy.lineage-3-node.test.ts (8 tests) 2ms
 Tests  8 passed (8)

# Project test baseline delta
$ npm test 2>&1 | tail -3
Test Files  14 failed | 163 passed | 44 skipped (221)
     Tests  51 failed | 4325 passed | 320 skipped (4696)
# Pre-plan: 52 failed; post-plan: 51 failed → net delta -1 (the intentional RED closed)

# Build smoke (Next 16 boundary regression guard)
$ npm run build 2>&1 | tail -3
ƒ Proxy (Middleware)
◐  (Partial Prerender)  prerendered as static HTML with dynamic server-streamed content
ƒ  (Dynamic)            server-rendered on demand
# No errors.

# tsc baseline preserved
$ npx tsc --noEmit 2>&1 | grep -c "error TS"
28
# Phase 36 project baseline.

# B1 invariant
$ grep -c "SameFamilyRail\|LineageRail" src/components/watch/WatchDetail.tsx
0
$ grep -cE "^['\"]use client['\"]" 'src/app/watch/[id]/page.tsx'
0

# Render order on /catalog/[catalogId]
$ grep -nE "OtherOwnersRoster|SameFamilyRail|LineageRail|CatalogPageActions" 'src/app/catalog/[catalogId]/page.tsx' | tail -5
228:      <OtherOwnersRoster collectors={roster.collectors} totalCount={roster.totalCount} />
234:      <SameFamilyRail rows={sameFamily} />
235:      <LineageRail rows={lineage} />
# CatalogPageActions follows in the conditional block after.
```

## Commits

| Task | Commit | Files |
|------|--------|-------|
| 1. getSameFamilyForCatalog DAL | `1a6f3fa` | `src/data/hierarchy.ts` |
| 2. SameFamilyRail + LineageRail components | `2978758` | `src/components/insights/SameFamilyRail.tsx`, `src/components/insights/LineageRail.tsx` |
| 3. Mount rails on /watch/[id] | `ae1d737` | `src/app/watch/[id]/page.tsx` |
| 4. Mount rails on /catalog/[catalogId] + vi.mock fix | `b681506` | `src/app/catalog/[catalogId]/page.tsx`, `tests/app/catalog-page.test.ts` |

## Per-Task Verification Map

| Row | Task | Status | Evidence |
|-----|------|--------|----------|
| 05-T1 | getSameFamilyForCatalog DAL + RED → GREEN | OK | `grep -E "export (async )?function getSameFamilyForCatalog" src/data/hierarchy.ts` = 1; `npx vitest run tests/static/hierarchy.lineage-3-node.test.ts` = 8/8 pass; live COUNT ranking + two-pass + hide-if-empty + LIMIT 6 all asserted; commit `1a6f3fa` |
| 05-T2 | SameFamilyRail + LineageRail Server RSCs | OK (with Rule 1 auto-fix) | both files exist; `if (rows.length === 0) return null` count = 2; no `'use client'` directive; D-39b-16 RELATIONSHIP_LABELS map complete; `.slice(0, 6)` cap on LineageRail; singular `'1 collector'` form on SameFamilyRail; Rule 1 flip `font-medium → font-semibold`; commit `2978758` |
| 05-T3 | Mount rails on /watch/[id] | OK | `grep -c "SameFamilyRail" 'src/app/watch/[id]/page.tsx'` = 2; same for LineageRail; `watch.catalogId ?` guard present; OtherOwnersRoster NOT mounted (count = 0); B1 invariant grep on WatchDetail.tsx = 0; build smoke green; commit `ae1d737` |
| 05-T4 | Mount rails on /catalog/[catalogId] | OK (with Rule 1 auto-fix) | `grep -c "SameFamilyRail" 'src/app/catalog/[catalogId]/page.tsx'` = 2; OtherOwnersRoster preserved (count = 4); render order: OtherOwnersRoster (line 228) → SameFamilyRail (234) → LineageRail (235); 8/8 catalog-page tests green after vi.mock fix; commit `b681506` |

## Phase 39b End-of-Phase Summary Recommendation

With all 5 plans now shipped (Wave 0: 39b-01; Wave 1: 39b-02 + 39b-03; Wave 2: 39b-04; Wave 3: 39b-05), Phase 33b Q3's high-leverage discovery dead-end backlog has **zero remaining unaddressed rows**:

- NSV-01: closed in 39b-02
- NSV-02: **closed in 39b-05 (this plan)**
- NSV-06: closed in 39b-02 (ReferenceIdentityCard fresh-account branch)
- NSV-08: closed in 39b-02 (CTA block on /watch/{id})
- NSV-12: closed in 39b-03 (WornCalendar interactive)
- NSV-14: 8-row sub-cluster closed in 39b-03
- NSV-15: closed in 39b-02
- NSV-16: **closed in 39b-05 (this plan)**
- NSV-18: closed in 39b-04
- NSV-20: closed in 39b-02 + 39b-04 (CatalogPageActions on fresh-account)

ROADMAP §39b SC#6 (Phase 33b Q3 high-leverage backlog discharged) is satisfied. Phase 39b should be marked complete; v5.0 milestone advances by 5 plans (Wave 0/1/1/2/3).

## Self-Check: PASSED

Verified by direct file inspection and git log:

- `src/data/hierarchy.ts` exists and exports `getSameFamilyForCatalog` (commit `1a6f3fa`)
- `src/components/insights/SameFamilyRail.tsx` exists (commit `2978758`)
- `src/components/insights/LineageRail.tsx` exists (commit `2978758`)
- `src/app/watch/[id]/page.tsx` mounts both rails (commit `ae1d737`)
- `src/app/catalog/[catalogId]/page.tsx` mounts both rails (commit `b681506`)
- `tests/app/catalog-page.test.ts` updated with vi.mock pattern (commit `b681506`)
- All 4 task commit hashes verified via `git log --oneline -8`
- Intentional RED from Plan 39b-01 Task 2 closed; `tests/static/hierarchy.lineage-3-node.test.ts` exits 0 (8/8)
- Project test baseline 52 → 51 failed (net delta -1, matches the success criterion)
- Build smoke green
- tsc preserved at 28 (Phase 36 baseline)
