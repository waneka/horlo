---
phase: 46-explore-shell-browse-archetypes
reviewed: 2026-05-18T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/components/search/useSearchState.ts
  - src/app/explore/brands/page.tsx
  - src/components/explore/CollectorArchetypes.tsx
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 46: Code Review Report

**Reviewed:** 2026-05-18T00:00:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Re-review of the three source files changed by phase 46 gap-closure plans 46-05
(soft-nav facet reconciliation in `useSearchState.ts`) and 46-06 (A–Z brands nav +
archetype zero-count filter). Scope is the diff since `f12ae00`.

The brands page and archetype rail changes are small and largely sound — layout-only
tweaks plus a clean zero-count filter on the archetype rail. The reconciliation logic
added to `useSearchState.ts` has one design defect classified BLOCKER: the new Fault 2
"would-strip" guard protects `q` and `tab` against being dropped from the URL, but the
companion reconciliation effect only reconciles facet params — never `q`/`tab`. As a
result, clearing the search box or switching back to the All tab leaves a stale param
permanently stuck in the URL, breaking the D-04 "URL is the single source of truth"
invariant for the two most common state changes on the page.

## Critical Issues

### CR-01: Fault 2 guard wedges URL sync — `q`/`tab` are guarded but never reconciled

**File:** `src/components/search/useSearchState.ts:182-186`
**Issue:**
`TRACKED_PARAMS` includes `'q'` and `'tab'`, and the `wouldStripIncoming` guard returns
early (skips `router.replace`) whenever the URL still carries a tracked key that the
freshly built `params` omits. The stated rationale is to wait for reconciliation effect
1a to settle an incoming value into state. But effect 1a (`useSearchState.ts:137-154`)
reconciles only the **facet** params — `movement`, `size`, `style`, `brand`, `era`,
`genre`, `archetype`. It never reconciles `q` or `tab`, and no other code path copies
URL `q`/`tab` back into state (`setQ`/`setDebouncedQ` are only invoked from the debounce
effect at line 127 and the public `setQ` setter).

Consequences, triggered by ordinary user actions — no soft nav required:

1. URL is `/search?q=omega`. User clears the search box. After debounce `debouncedQ`
   becomes `''`, so the line-164 guard (`>= CLIENT_MIN_CHARS`) omits `q` from `params`.
   But `searchParams.get('q')` is still `'omega'` → `wouldStripIncoming === true` → the
   `router.replace` that should drop `q` is skipped. The URL stays `/search?q=omega`
   indefinitely; state and URL are now permanently divergent. A reload resurrects the
   stale query.
2. URL is `/search?tab=watches`. User clicks back to the All tab. `tab` becomes `'all'`,
   so the line-165 guard omits `tab` from `params`. URL still has `tab=watches` → guard
   fires → the URL never loses `tab=watches`, and a reload restores the wrong tab.

This defeats the D-04 invariant for the two most common state changes on the page, and
is a regression introduced by this gap-closure plan (the pre-46-05 effect had no guard
and replaced unconditionally).

**Fix:**
Restrict the guard to the facet keys that effect 1a actually reconciles. `q` and `tab`
are owned by in-memory state and React events, not by inbound navigation, so they must
never block the replace:
```ts
// Only guard the facet keys reconciliation effect 1a actually settles into state.
// q and tab are driven by user input/events, not inbound nav — never guard them.
const RECONCILED_PARAMS = ['movement', 'size', 'style', 'brand', 'era', 'genre', 'archetype']
const wouldStripIncoming = RECONCILED_PARAMS.some(
  (key) => searchParams.get(key) !== null && !params.has(key),
)
if (wouldStripIncoming) return
```

## Warnings

### WR-01: Brand slug deep-link is not URL-encoded

**File:** `src/app/explore/brands/page.tsx:112`
**Issue:**
`href={`/search?tab=watches&brand=${brand.slug}`}` interpolates `brand.slug` raw into a
query string. `getBrowseBrandCounts` returns `brands.slug` with no sanitization. If a
slug ever contains a query-significant character (`&`, `#`, `+`, space, `%`), the deep
link breaks or silently truncates the brand value — a slug containing `&` would inject
an extra query param into the `/search` URL. Slugs are normally hyphen-safe, but the
page makes no guarantee, and the `/search` action accepts an unconstrained
`z.string().max(100)` for `brand`, so a malformed value is not rejected downstream
either.
**Fix:**
```tsx
href={`/search?tab=watches&brand=${encodeURIComponent(brand.slug)}`}
```

### WR-02: Non-alphabetic brand names are dropped from the page

**File:** `src/app/explore/brands/page.tsx:38-42`
**Issue:**
The WR-05 comment at lines 24-26 claims brands starting with a digit/symbol "bucket
under `#`", and `LETTER_BUCKETS` (line 27) correctly adds `'#'`. But the bucketing
logic only falls back to `'#'` when the first character is *missing*:
```ts
const letter = brand.name[0]?.toUpperCase() ?? '#'
```
A brand whose name starts with a digit — e.g. `"8 Faces"` — yields `letter === '8'`,
which is not in `LETTER_BUCKETS`. The jump nav at line 76 iterates `LETTER_BUCKETS`, so
no `'8'` tab appears; the section loop at line 98 (`LETTER_BUCKETS.filter((l) =>
byLetter.has(l))`) never matches the `'8'` Map key, so that brand is **silently dropped
from the page entirely** — counted nowhere, rendered nowhere. The intended `#` bucket
only ever receives empty-name brands. This is a latent data-loss-from-view bug the
moment a digit- or symbol-prefixed brand enters the catalog.
**Fix:**
Normalize any non-A–Z first character to the `#` bucket:
```ts
const first = brand.name[0]?.toUpperCase() ?? '#'
const letter = first >= 'A' && first <= 'Z' ? first : '#'
```

### WR-03: Reconciliation effect 1a closes over stale state with `exhaustive-deps` disabled

**File:** `src/components/search/useSearchState.ts:137-154`
**Issue:**
Effect 1a disables `react-hooks/exhaustive-deps` and depends only on `[searchParams]`,
while its body reads `movement`, `size`, `styleArr`, `brand`, `era`, `genre`,
`archetype` to compute each `!==` diff. Because those state values are excluded from the
dep array, the effect captures whatever they were on the render that produced the
current `searchParams` reference. In the normal soft-nav flow this works because a new
`searchParams` object arrives with the navigation. But if a facet state value changes
without `searchParams` changing in the same commit (e.g. a chip setter runs locally),
the effect does not re-run, and its closed-over snapshot goes stale; the next time
`searchParams` does change, the effect diffs against an out-of-date value and may issue
a redundant or incorrect `setX`. The comment explains the intent but does not remove
the hazard, and it creates an undocumented hard ordering dependency between effects 1a
and 2.
**Fix:**
Either read the current facet values through refs (so the closure is never stale), or
include all read state in the dep array and rely on the `!==` guards to make redundant
runs cheap no-ops. If keeping `searchParams`-only, document explicitly why no other
dep can change without `searchParams` also changing.

## Info

### IN-01: Disabled A–Z letters are still announced to assistive tech as plain text

**File:** `src/app/explore/brands/page.tsx:79-91`
**Issue:**
Letters with no brands render as an `<a>` with `href={undefined}` plus
`pointer-events-none opacity-30`. An anchor with no `href` is correctly non-focusable
and not exposed as a link, but it is still read by screen readers as plain text with no
indication it is inactive. Minor a11y polish.
**Fix:**
Render empty-bucket letters as `<span aria-hidden="true">` (purely decorative) or add
`aria-disabled="true"`.

### IN-02: `getBrowseArchetypeCounts` consumed here is byte-identical to `getBrowseGenreCounts`

**File:** `src/components/explore/CollectorArchetypes.tsx:40` (cross-reference to `src/data/browse.ts`)
**Issue:**
`CollectorArchetypes` consumes `getBrowseArchetypeCounts`, whose SQL is identical to
`getBrowseGenreCounts` (same column, same `GROUP BY`/`ORDER BY`, only the alias
differs). The duplication is intentional per the D-17 comment in `browse.ts`, but the
two queries will silently diverge if one is later changed (e.g. adding a `WHERE`
clause). Not a phase-46 regression — noted because this component depends on one half
of the pair.
**Fix:**
Extract a shared private query helper that both public functions re-key, or add a
cross-reference comment in each so a future edit updates both.

---

_Reviewed: 2026-05-18T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
