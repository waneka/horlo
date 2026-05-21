---
phase: 52
plan: 05
status: complete
completed: 2026-05-21
tasks_completed: 1
tasks_total: 1
---

# Plan 52-05 SUMMARY — `[tab]/page.tsx` restructure

## What was done

`src/app/u/[username]/[tab]/page.tsx` restructured per RESEARCH.md Pattern 2 / instant-navigation.md ProductPage canonical example.

**Outer `ProfileTabPage`** — now SYNC, returns only:
```tsx
<Suspense fallback={<ProfileTabContentSkeleton />}>
  <ProfileTabContent paramsPromise={params} />
</Suspense>
```

**Inner `ProfileTabContent`** — async function at module scope (exported). The 311-line body (viewer resolution, ProfileShellResolver call, common-ground branch, insights branch, locked-tab cards for collection/wishlist/notes/stats, worn/notes/stats data fetches, every notFound call) moved VERBATIM. The only mechanical changes: function declaration keyword, function name, parameter rename `params` → `paramsPromise` + `await paramsPromise` on the first body line.

Commit: `291b966` — `feat(52-05): restructure [tab]/page.tsx — sync outer + async inner inside Suspense`

## Build-validator refinement (D-52-DEV-01)

The audit followup specified `unstable_instant = { prefetch: 'static' }`, but the Next 16.2.3 validator empirically requires samples for two-dynamic-param routes. The validator's own error message reads "Add it to the sample's `params` object." The TypeScript reference in `instant.md` defines `samples: RuntimeSample[]` as part of the `prefetch: 'runtime'` variant. Phase 52 ships with the typed-annotation form:

```ts
export const unstable_instant: {
  prefetch: 'runtime'
  samples: Array<{ params: Record<string, string> }>
} = {
  prefetch: 'runtime',
  samples: [{ params: { username: 'twwaneka', tab: 'collection' } }],
}
```

The `as const`-on-string form trips a separate "Invalid segment configuration export detected" check during page-data collection — only the inline-type-annotated form is accepted by both the validator and the segment-config schema. Runtime behavior is unchanged regardless of TS shape; this is a build-time gate distinction.

**Documented as D-52-DEV-01.** The runtime-with-samples variant keeps full validation active at every shared layout boundary (the recurrence-5 contract per D-52-03) while supplying the representative params the prerender phase needs.

## ProfileTabContent exported for testability

The default export is now a pure JSX wrapper, so unit tests that exercised dynamic branching at the function-call level had to migrate. `ProfileTabContent` is now an exported named function; tests call it directly with `paramsPromise: Promise.resolve(...)`.

Tests updated:
| File | Change |
|------|--------|
| `tests/profile-route-51.test.ts` | Test 4 regex loosened from `unstable_instant\s*=` to `unstable_instant\b` (accepts typed-annotation form) |
| `tests/app/profile-tab-insights.test.tsx` | 4 call sites — `ProfileTabPage({ params: ... })` → `ProfileTabContent({ paramsPromise: ... })` |
| `tests/app/profile-layout.test.tsx` | 3 call sites — `ProfileLayout({ params: ..., children: ... })` → `ProfileChrome({ paramsPromise: ..., children: ... })`; assertion adjusted (no `<main>` wrapper at this layer) |
| `tests/app/common-ground-fallback.test.tsx` | 3 call sites — same `ProfileTabContent` swap |

## Test progression

| After plan | profile-route-51 | Full vitest | Build |
|------------|------------------|-------------|-------|
| Plan 52-01 | 2 pass / 3 fail | (regression contract installed) | — |
| Plan 52-03 | 3 pass / 2 fail | n/a | exit 1 (validator surfacing 2 sites — designed) |
| Plan 52-04 | 4 pass / 1 fail | n/a | n/a |
| **Plan 52-05** | **5 pass / 0 fail** | **5252 pass / 0 fail / 325 skipped** | **exit 0; 33/33 static pages; 0 INSTANT_VALIDATION_ERROR** |

## Acceptance criteria check

| Criterion | Status |
|-----------|--------|
| Outer `ProfileTabPage` is SYNC | ✓ (no `async` keyword) |
| Outer body is only the Suspense + ProfileTabContent JSX | ✓ |
| Inner async `ProfileTabContent` at module scope | ✓ (exported for testability) |
| Inner body is original page body verbatim with `params` → `paramsPromise` | ✓ |
| All `notFound()` calls preserved in their existing relative positions (D-52-CF-03) | ✓ (invalid-tab first, missing-profile after resolver) |
| All tab-specific branching preserved verbatim | ✓ (common-ground, insights, collection/wishlist/notes/worn/stats) |
| `Suspense` + `ProfileTabContentSkeleton` imports added | ✓ |
| `unstable_instant` export present | ✓ (typed-annotation form per D-52-DEV-01) |
| All 5 tests in `tests/profile-route-51.test.ts` PASS | ✓ |
| `tests/app/profile-tab-*.test.tsx` + `profile-layout.test.tsx` all green | ✓ (10 tests across 3 files) |
| `npx tsc --noEmit` exits 0 | ✓ (no new TS errors introduced) |
| `npm run build` exits 0 — `/u/[username]/[tab]` validator green | ✓ (◐ Partial Prerender; 33/33 pages) |

## Deviations from PLAN.md

| Deviation | Why | Disposition |
|-----------|-----|-------------|
| `unstable_instant` shape changed from `{ prefetch: 'static' }` (audit) to `{ prefetch: 'runtime', samples: [...] }` (this plan) | Empirical validator behavior on `/u/[username]/[tab]` (two dynamic params) demands samples. The `prefetch: 'static'` form built with the validator surfacing two INSTANT_VALIDATION_ERROR sites that the structural refactor alone did not silence. Runtime+samples is the documented variant for dynamic routes per the instant.md TypeScript reference. | **Rule 1 (Bypass with reason).** Captured as D-52-DEV-01. Recurrence-5 prevention contract preserved (full validation still runs at every shared layout boundary). |
| Inline type annotation form `unstable_instant: {...} = {...}` instead of `as const` | The `as const`-tagged form trips Next 16.2.3's segment-config schema check ("Invalid segment configuration export detected"). The inline-type-annotated form is accepted. Runtime object shape is identical; only the TypeScript type representation differs. | **Rule 1 (Bypass with reason).** Test 4 regex updated to accept both forms. |
| ProfileTabContent exported for testability (not specified in plan) | The default export is now a sync Suspense wrapper; pre-Phase-52 unit tests called it directly to exercise dynamic branching. Without exporting the inner function, 7 tests across 2 files (profile-tab-insights + common-ground-fallback) would have been forced to do full-tree rendering with Suspense resolution — slower and more brittle. Exporting the inner function preserves the existing test idiom verbatim. | **Rule 1 (Bypass with reason).** Inline comment in source documents the test entry point. |
| Updated `tests/app/profile-layout.test.tsx` to call `ProfileChrome` instead of `ProfileLayout` (Plan 04 created ProfileChrome; this is the test-side adaptation) | After Plan 04 made the layout sync, the viewer-plumbing logic moved to ProfileChrome. The layout-level WR-06-equivalent test (existed pre-Phase-52) needed to move with the logic. | **Rule 1 (Bypass with reason).** describe() block renamed accordingly; file kept at same path for git history continuity. |

## Files touched

| File | Change | Commit |
|------|--------|--------|
| `src/app/u/[username]/[tab]/page.tsx` | 370 → 415 lines (Suspense scaffold + Phase 52 comment block + typed unstable_instant; body verbatim) | `291b966` |
| `tests/profile-route-51.test.ts` | Test 4 regex loosened; comment expanded with D-52-DEV-01 rationale | `291b966` |
| `tests/app/profile-tab-insights.test.tsx` | Import + 4 call sites updated | `291b966` |
| `tests/app/profile-layout.test.tsx` | Switched to ProfileChrome; describe renamed; assertions adjusted | `291b966` |
| `tests/app/common-ground-fallback.test.tsx` | Import + 3 call sites updated | `291b966` |
| `.planning/phases/52-.../52-VALIDATION.md` | Row 52-05-01 green | (this SUMMARY commit) |

## Self-Check

- [x] All tasks executed (Task 1 complete)
- [x] Task committed atomically (`291b966`)
- [x] SUMMARY.md created in plan directory (this file)
- [x] REQ-52-04 ✓ (inner async ProfileTabContent inside Suspense)
- [x] REQ-52-01 ✓ (unstable_instant export present; validator green)
- [x] REQ-52-02 ✓ (`npm run build` exits 0 — recurrence-5 CI gate live)
- [x] D-52-CF-02 / D-52-CF-03 preserved (viewerId scope; notFound ordering)
- [x] D-52-16 structural lock applied end-to-end

## Next

Plan 52-06: cross-route opt-outs / SEED-014 hand-off. The Phase 52 in-route validator is now green; Plan 06's first action is to re-run `npm run build` to confirm no cross-route violations remain. Based on this plan's build output (33/33 static pages, zero errors), Plan 06 is likely a no-op confirmation + SEED-014 empty finding set.
