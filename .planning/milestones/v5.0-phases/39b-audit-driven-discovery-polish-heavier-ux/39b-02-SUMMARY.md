---
phase: 39b-audit-driven-discovery-polish-heavier-ux
plan: 02
subsystem: ui-server-rsc
tags: [react-server-components, next16, watch-detail, catalog-detail, taste-signature, dead-end-closure, NSV-06, NSV-20, DISC-11]

# Dependency graph
requires:
  - phase: 19.1
    provides: CatalogTasteAttributes type + closed vocab IDs (PrimaryArchetype + EraSignal + design motifs)
  - phase: 20
    provides: CollectionFitCard pure-renderer pattern + tests/static/CollectionFitCard.no-engine.test.ts (analog)
  - phase: 38
    provides: Watch.catalogTaste field populated via getWatchesByUser LEFT JOIN
  - phase: 39b
    plan: 01
    provides: prod catalog populated (100 refs / 32 families / 52 edges) — gives Plan 39b-02 real sparse data to verify hide-if-empty against
provides:
  - ReferenceIdentityCard pure-renderer server RSC (no engine imports; D-39b-01 enforced by static guard)
  - 3-CTA block (Add to Wishlist / Add to Collection / Skip) on /watch/[id] for fresh-account viewers (FIRST phase to introduce these CTAs on this route)
  - 3-CTA block coverage on /catalog/[catalogId] G-4 fresh-account branch (supersedes Phase 20 D-05 "no CTAs when empty" suppression)
  - B1 fix pattern: RSC mounted as Server-Component sibling of Client-Component island via page.tsx server-tree composition (NOT imported into the client island)
  - tests/static/ReferenceIdentityCard.no-engine.test.ts (4-assertion static guard — mirrors CollectionFitCard pattern)
  - tests/components/insights/ReferenceIdentityCard.test.tsx (6-scenario render contract test)
affects: [39b-04, 39b-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-renderer Server RSC with discriminated null gate (D-39b-03): early-return null for (taste === null || confidence === null || confidence < 0.5) — defense-in-depth alongside caller-side gating"
    - "Server-tree composition for RSC + Client Component coexistence: when an existing surface delegates rendering to a 'use client' island (WatchDetail), NEW RSCs mount as siblings at the page.tsx level — never imported INTO the client component (Next 16 boundary)"
    - "Identical conditional shape on twin surfaces (D-39b-04): /watch/[id] and /catalog/[catalogId] use the EXACT same JSX conditional (`collection.length === 0 && ct && ct.confidence !== null && ct.confidence >= 0.5`) so visual contract drift is impossible by construction"
    - "CatalogEntry → CatalogTasteAttributes inline adapter (Pitfall 9): top-level CatalogEntry taste fields are projected field-by-field into a literal matching the Watch.catalogTaste shape so the same component renders both surfaces"

key-files:
  created:
    - src/components/insights/ReferenceIdentityCard.tsx (133 lines — Card + CardHeader/CardDescription + headline + ScaleBar inner component + motif chips)
    - tests/static/ReferenceIdentityCard.no-engine.test.ts (45 lines, 4 assertions)
    - tests/components/insights/ReferenceIdentityCard.test.tsx (76 lines, 6 scenarios)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-02-SUMMARY.md
  modified:
    - src/app/watch/[id]/page.tsx (+45 -1; B1 fix — adds Server-Component sibling block to <WatchDetail/>; first phase to introduce the 3-CTA block on this route)
    - src/app/catalog/[catalogId]/page.tsx (+70 -7; constructs catalogTaste adapter + new else branch for fresh-account actionsSpec; mounts RIC + fallback caption; supersedes Phase 20 "no card, no CTAs" comment)
    - tests/app/catalog-page.test.ts (+10 -2; D-05 test renamed + inverted to reflect D-39b-04 supersession)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-VALIDATION.md (5 rows 02-T1..T5 marked ✅)

decisions:
  - "Hot-path lint override (Rule 1 auto-fix): UI-SPEC §Card Layout specified `text-base font-medium` for the era · archetype headline; project-wide `tests/no-raw-palette.test.ts` forbids /\\bfont-medium\\b/ and would have shipped a NEW failure into the baseline. Swapped to `font-semibold` (canonical replacement used by SleepingBeautiesSection, GoodDealsSection, and the CollectionFitCard h4 in the same insights/ folder). Visually equivalent."
  - "B1 architectural disposition confirmed during execution: WatchDetail.tsx (462 lines, `'use client'` at line 1) is the existing client island on /watch/[id]; ReferenceIdentityCard is a Server Component and MUST NOT be imported into it. The page.tsx Server-Component sibling composition pattern is the only Next 16-compliant mounting strategy."
  - "Test supersession D-39b-04 lock: tests/app/catalog-page.test.ts:196 ('does NOT render CTAs when collection is empty') asserted the OLD Phase 20 D-05 behavior. Updated to assert the NEW D-39b-04 contract: fresh-account viewer DOES see the 3-CTA block (`spec` discriminator present, framing=cross-user)."

metrics:
  duration_minutes: 19
  completed: 2026-05-13
---

# Phase 39b Plan 02: ReferenceIdentityCard (NSV-06 + NSV-20) Summary

Closes the fresh-account dead-end on /watch/[id] and /catalog/[catalogId] by mounting a pure-renderer Server RSC that surfaces the inferred taste signature for any high-confidence catalog ref, plus the first-on-this-route 3-CTA block underneath. Both surfaces render identically (D-39b-04) using a shared component fed by a `CatalogEntry → CatalogTasteAttributes` adapter on the catalog page.

## Task-by-Task Ship State

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Static import-boundary guard (RED — vacuous-pass pre-file) | 82fbc26 | tests/static/ReferenceIdentityCard.no-engine.test.ts |
| 2 | ReferenceIdentityCard component (GREEN — guard non-vacuously green) | 85f875b | src/components/insights/ReferenceIdentityCard.tsx |
| 3 | Component tests (6 scenarios — full render, gate ×2, omissions ×3) | 727e852 | tests/components/insights/ReferenceIdentityCard.test.tsx |
| 4 | Mount on /watch/[id] as Server-Component sibling of WatchDetail (B1 fix) + 3-CTA block | 1c5f428 | src/app/watch/[id]/page.tsx |
| 5 | Mount on /catalog/[catalogId] G-4 branch + adapter + 3-CTA block (supersedes "no CTAs when empty") | 1c224da | src/app/catalog/[catalogId]/page.tsx |
| — | (Rule 1) Palette fix: font-medium → font-semibold | c205617 | src/components/insights/ReferenceIdentityCard.tsx |
| — | (Rule 1) Update catalog-page D-05 test to reflect D-39b-04 supersession | b65587f | tests/app/catalog-page.test.ts |

Seven commits total: five planned + two auto-fix commits (both Rule 1 — pre-existing test/lint expressed older contracts that the plan explicitly supersedes).

## Static Guard Transition

| State | Trigger | Result |
|-------|---------|--------|
| Vacuous-green (Task 1) | RIC.tsx does not yet exist; `existsSync` returns false on all 4 `it` blocks | 4 tests pass without reading anything |
| Non-vacuously green (Task 2) | RIC.tsx exists with clean imports + no 'use client' | All 4 assertions exercise real `readFileSync` and `expect.not.toMatch` against forbidden patterns |

The same test file `tests/static/ReferenceIdentityCard.no-engine.test.ts` serves both states — `existsSync` short-circuit pattern carried verbatim from `tests/static/CollectionFitCard.no-engine.test.ts`.

## Component Test Coverage Matrix

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 1 | Full render (confidence=0.75, all fields populated) | "Inferred taste signature" + "Modern era" + "Dress" + "bauhaus" visible | ✅ |
| 2 | `taste === null` | `container.firstChild` is null | ✅ |
| 3 | `confidence === 0.3` (D-39b-03 gate from above) | `container.firstChild` is null | ✅ |
| 4 | `confidence === null` (defense-in-depth) | `container.firstChild` is null | ✅ |
| 5 | `eraSignal === null && primaryArchetype === null` | "Modern era" and "Dress" both absent (no headline row) | ✅ |
| 6 | `formality === null` | "Formality" absent; "Sportiness" + "Heritage" still render | ✅ |

## Page Mount Diff Summary

### `src/app/watch/[id]/page.tsx` (B1 fix — Server-Component sibling composition)

**Before** (single-child wrapper):
```tsx
return (
  <div className="container mx-auto px-4 py-8 max-w-4xl">
    <WatchDetail ... />
  </div>
)
```

**After** (multi-child server-tree sibling composition; +space-y-8):
```tsx
return (
  <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
    <WatchDetail ... />

    {/* Phase 39b NSV-06 — Fresh-account RIC OR fallback caption */}
    {collection.length === 0 && watch.catalogTaste && watch.catalogTaste.confidence !== null && watch.catalogTaste.confidence >= 0.5 && (
      <ReferenceIdentityCard taste={watch.catalogTaste} />
    )}
    {collection.length === 0 && (!watch.catalogTaste || watch.catalogTaste.confidence === null || watch.catalogTaste.confidence < 0.5) && (
      <p className="text-sm text-muted-foreground">
        Add a few watches to see how this one fits your collection.
      </p>
    )}

    {/* Plan 39b-05 mounts SameFamilyRail + LineageRail here */}

    {/* Phase 39b NSV-06 — Fresh-account 3-CTA block */}
    {collection.length === 0 && (
      <div className="flex flex-wrap gap-2">
        <Link href={`/watch/${watch.id}/edit?status=wishlist`}><Button variant="outline">Add to Wishlist</Button></Link>
        <Link href={`/watch/${watch.id}/edit?status=owned`}><Button>Add to Collection</Button></Link>
        <Link href="/"><Button variant="ghost">Skip</Button></Link>
      </div>
    )}
  </div>
)
```

### `src/app/catalog/[catalogId]/page.tsx` (G-4 fresh-account branch reshape)

**Before** (lines 112-113 — D-05 suppression):
```typescript
// else: collection.length === 0 → verdict stays null AND actionsSpec stays
// null → no card, no CTAs (D-05 + D-07 empty-collection rule)
```

**After** (new `else` branch builds actionsSpec for fresh-account viewer so CatalogPageActions renders):
```typescript
} else {
  // Phase 39b NSV-20 — fresh-account viewer. actionsSpec built so the 3-CTA
  // block renders. Above the CTAs, ReferenceIdentityCard or fallback caption
  // renders. Supersedes Phase 20 "no card, no CTAs" suppression.
  actionsSpec = {
    brand: catalogEntry.brand,
    model: catalogEntry.model,
    // ... full CatalogActionsSpec literal (15 fields) ...
  }
}
```

Plus a new `catalogTaste` adapter immediately after the `if (!catalogEntry) notFound()` guard, projecting the top-level CatalogEntry taste fields into a `CatalogTasteAttributes` literal so the same `<ReferenceIdentityCard taste={...} />` works on both surfaces.

## B1 Fix Verification (RSC-into-client-component prohibition honored)

The plan's B1 architectural fix was: ReferenceIdentityCard (Server Component) must mount as a Server-Component sibling of `<WatchDetail/>` (Client Component), NOT inside WatchDetail. Verification:

```bash
$ grep -cE "^['\"]use client['\"]" 'src/app/watch/[id]/page.tsx'
0     # page.tsx remains a Server Component (RSC import is legal here)

$ grep -c "ReferenceIdentityCard\|Add to Wishlist" src/components/watch/WatchDetail.tsx
0     # Neither the RSC NOR the new CTAs leaked into the client island

$ grep -c "ReferenceIdentityCard" 'src/app/watch/[id]/page.tsx'
4     # Import + JSX mount + comment references — composes at server tree level

$ npm run build 2>&1 | grep "✓ Compiled"
✓ Compiled successfully in 7.0s     # Next 16 boundary regression guard green
```

The JSX tree on /watch/[id] renders `<WatchDetail/>`, `<ReferenceIdentityCard/>`, and the 3-CTA block as SIBLINGS inside the page's `<div className="container ... space-y-8">`. No RSC is imported into a Client Component anywhere in the tree.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Lint] Swapped `font-medium` → `font-semibold` in headline**

- **Found during:** Final verification after Task 5
- **Issue:** UI-SPEC §Card Layout line 222 specified `text-base font-medium` for the era · archetype headline. The project-wide `tests/no-raw-palette.test.ts` forbids `/\bfont-medium\b/` (FORBIDDEN line 20). My initial component would have shipped a NEW failure into the test baseline (going from 48 → 49 failed tests).
- **Fix:** Swapped to `font-semibold` — the canonical replacement used by `SleepingBeautiesSection.tsx`, `GoodDealsSection.tsx`, and the `h4` element in `CollectionFitCard.tsx` (same insights/ folder). Visually equivalent (semibold reads slightly heavier; UI-SPEC intent is preserved).
- **Files modified:** `src/components/insights/ReferenceIdentityCard.tsx` (1-line swap on line 73)
- **Commit:** c205617
- **Note for future plans:** UI-SPEC line 222 should be updated to use `font-semibold` to align with the project lint; for this plan we treat the lint as overriding the spec at the point of conflict.

**2. [Rule 1 — Obsolete test] Updated `tests/app/catalog-page.test.ts` D-05 assertion to reflect D-39b-04 supersession**

- **Found during:** Final regression check after Task 5
- **Issue:** `tests/app/catalog-page.test.ts:196` ("D-05 — does NOT render CTAs when collection is empty") asserted the OLD Phase 20 D-05 behavior that the plan explicitly supersedes. UI-SPEC §"/catalog/{id} render order" line 285 mandates: "CTA block (Add to Wishlist / Add to Collection / Skip) (fresh-account viewer — always last)". Task 5's `actionsSpec` build-out in the new `else` branch was the load-bearing change.
- **Fix:** Renamed the test from "D-05 — does NOT render CTAs" → "D-39b-04 — DOES render CTAs" and inverted the assertion from `expect(rendered).not.toMatch(/"spec":\{/)` to `expect(rendered).toMatch(/"spec":\{/)` + an additional `expect(rendered).toMatch(/"framing":"cross-user"/)`. Comment block documents the supersession lineage (Phase 20 D-05 → Phase 39b D-39b-04).
- **Files modified:** `tests/app/catalog-page.test.ts` (+10 -2)
- **Commit:** b65587f

Both auto-fixes are Rule 1 (pre-existing test/lint expressed older contracts that the plan was explicitly built to replace). No deviation from the plan's design intent — only from artifacts that pre-dated the new contract.

## Regression Baseline

Pre-plan baseline (commit 8b95a05, with the 3 new RIC files temporarily removed): **48 failed tests / 14 failed test files**.
Post-plan: **48 failed tests / 14 failed test files**.

Diff of failure set: empty. Both fixes above brought the net delta back to zero. The intentional RED from Plan 39b-01 Task 2 (`tests/static/hierarchy.lineage-3-node.test.ts > getSameFamilyForCatalog function is exported`) remains the only Phase 39b-attributable failure — closes in Plan 39b-05.

## Self-Check: PASSED

| Claim | Verification |
|-------|--------------|
| `src/components/insights/ReferenceIdentityCard.tsx` exists | ✅ |
| `tests/static/ReferenceIdentityCard.no-engine.test.ts` exists, 4 assertions, green | ✅ |
| `tests/components/insights/ReferenceIdentityCard.test.tsx` exists, 6 tests, green | ✅ |
| Commit 82fbc26 exists | ✅ |
| Commit 85f875b exists | ✅ |
| Commit 727e852 exists | ✅ |
| Commit 1c5f428 exists | ✅ |
| Commit 1c224da exists | ✅ |
| Commit c205617 exists (Rule 1 lint fix) | ✅ |
| Commit b65587f exists (Rule 1 test supersession) | ✅ |
| `grep -c "ReferenceIdentityCard" 'src/app/watch/[id]/page.tsx'` ≥ 2 | ✅ (=4) |
| `grep -c "ReferenceIdentityCard" 'src/app/catalog/[catalogId]/page.tsx'` ≥ 2 | ✅ (=6) |
| `grep -cE "^['\"]use client['\"]" 'src/app/watch/[id]/page.tsx'` = 0 | ✅ (=0) |
| `npm run build` exits 0 | ✅ |
| Net new test failures | 0 |
| tsc baseline preserved | 28 (matches pre-plan; no new errors introduced) |
