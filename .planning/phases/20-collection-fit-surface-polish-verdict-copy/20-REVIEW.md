---
phase: 20-collection-fit-surface-polish-verdict-copy
reviewed: 2026-04-29T00:00:00Z
depth: standard
files_reviewed: 31
files_reviewed_list:
  - src/lib/verdict/types.ts
  - src/lib/verdict/viewerTasteProfile.ts
  - src/lib/verdict/shims.ts
  - src/lib/verdict/templates.ts
  - src/lib/verdict/composer.ts
  - src/components/insights/CollectionFitCard.tsx
  - src/components/insights/VerdictSkeleton.tsx
  - src/app/watch/[id]/page.tsx
  - src/components/watch/WatchDetail.tsx
  - src/lib/types.ts
  - src/data/watches.ts
  - src/app/actions/verdict.ts
  - src/components/search/WatchSearchRowsAccordion.tsx
  - src/components/search/useWatchSearchVerdictCache.ts
  - src/components/search/WatchSearchRow.tsx
  - src/components/search/SearchPageClient.tsx
  - src/app/search/page.tsx
  - src/app/catalog/[catalogId]/page.tsx
  - src/components/explore/DiscoveryWatchCard.tsx
  - tests/no-evaluate-route.test.ts
  - tests/static/CollectionFitCard.no-engine.test.ts
  - src/lib/verdict/composer.test.ts
  - src/lib/verdict/viewerTasteProfile.test.ts
  - src/lib/verdict/shims.test.ts
  - src/lib/verdict/confidence.test.ts
  - src/components/insights/CollectionFitCard.test.tsx
  - tests/actions/verdict.test.ts
  - tests/components/search/WatchSearchRowsAccordion.test.tsx
  - tests/components/search/useWatchSearchVerdictCache.test.tsx
  - tests/app/watch-page-verdict.test.ts
  - tests/app/catalog-page.test.ts
  - tests/components/search/WatchSearchRow.test.tsx
findings:
  critical: 0
  warning: 2
  info: 8
  total: 10
status: issues_found
---

# Phase 20: Code Review Report

**Reviewed:** 2026-04-29T00:00:00Z
**Depth:** standard
**Files Reviewed:** 31
**Status:** issues_found

## Summary

The Phase 20 verdict-copy substrate is well-structured: pure render contract for `<CollectionFitCard>` (D-04), server-side compute on `/watch/[id]` (D-03), deterministic 12-template library with confidence gating (D-01 / Pitfall 4), RSC-safe `VerdictBundle` discriminated union (Pitfall 3), and a documented engine-boundary shim that respects the byte-lock on `analyzeSimilarity` (D-09). Test coverage is thorough across composer determinism, confidence boundaries (0.5/0.7), shim round-tripping, three surface integrations, and the lint guard against `@/lib/similarity` imports leaking into the client bundle.

No Critical issues. Two Warnings: the prompt-flagged `font-medium` ↔ `tests/no-raw-palette.test.ts` policy conflict, and an over-broad catch in the verdict Server Action that misreports DB errors as auth failures. Eight Info items target dead code (one unreachable template, one redundant fallback), one misleading return-type field name, one minor security-hygiene gap (raw `<img>` in `DiscoveryWatchCard`), and several minor robustness/maintenance suggestions.

## Warnings

### WR-01: UI-SPEC `font-medium` directly violates `tests/no-raw-palette.test.ts` invariant

**Files:**
- `src/components/insights/CollectionFitCard.tsx:47` — `text-sm font-medium text-foreground` on the verdict headline `<p>`.
- `src/components/insights/CollectionFitCard.tsx:107` — `text-sm font-medium text-foreground` on the "You own this watch" callout `<p>`.
- `src/components/search/WatchSearchRow.tsx:61` — `text-xs font-medium` on the `Owned` pill (likely pre-Phase 20).
- `src/components/search/WatchSearchRow.tsx:66` — `text-xs font-medium` on the `Wishlist` pill (likely pre-Phase 20).

**Issue:** `tests/no-raw-palette.test.ts:20` lists `/\bfont-medium\b/` in the FORBIDDEN array. `walk('src/components')` and `walk('src/app')` cover both files (only `src/components/ui` is skipped). The test will fail on every build — not a stylistic preference; the invariant is a hard build gate. Per the phase prompt, UI-SPEC § Typography mandates `font-medium` for the verdict headline; this is an explicit, documented policy conflict that the verifier must adjudicate.

**Fix (one of):**

- Verifier-level adjudication: remove `/\bfont-medium\b/` from `tests/no-raw-palette.test.ts:20` (with explicit sign-off from whoever owns that invariant) and update its docstring to reflect the new typography policy.
- Code-level: replace `font-medium` with `font-semibold` (which is NOT on the forbidden list) at all four sites. `font-semibold` is already used in the same file (`CollectionFitCard.tsx:65` for the "Most Similar in Collection" heading), so there is precedent.

```tsx
// CollectionFitCard.tsx:47 — current
<p className="text-sm font-medium text-foreground">{headline}</p>
// proposed
<p className="text-sm font-semibold text-foreground">{headline}</p>
```

### WR-02: `getVerdictForCatalogWatch` swallows non-auth errors as "Not authenticated"

**File:** `src/app/actions/verdict.ts:36-40`

**Issue:** The bare `catch {}` around `getCurrentUser()` returns `'Not authenticated'` for every error type. The toast copy in `WatchSearchRowsAccordion.tsx:116` then renders "Sign in to see how this fits your collection." — misleading and unactionable when the underlying cause is a DB timeout or transient Supabase error rather than an actual auth failure. Tests at `tests/actions/verdict.test.ts:65-69` confirm the over-broad behavior (any thrown error is treated as auth).

**Fix:** Narrow the catch to the specific auth-error type. Mirror the pattern from `src/app/actions/search.ts` (`searchPeopleAction`, referenced in the verdict.ts header comment):

```ts
let user
try {
  user = await getCurrentUser()
} catch (err) {
  if (err instanceof UnauthorizedError) {
    return { success: false, error: 'Not authenticated' }
  }
  console.error('[getVerdictForCatalogWatch] auth error:', err)
  return { success: false, error: "Couldn't compute verdict." }
}
```

(Replace `UnauthorizedError` with the actual symbol exported by `@/lib/auth`.)

## Info

### IN-01: `era-echo` template is unreachable dead code

**File:** `src/lib/verdict/templates.ts:86-95`

**Issue:** The `era-echo` predicate hardcodes `return null` with a comment that it's a "Reserved slot — composer caller may inject candidateEraSignal in future." This is genuinely 0% reachable today because:

1. `CandidateTasteSnapshot` (in `types.ts:66-72`) does not include `eraSignal`.
2. The composer at `src/lib/verdict/composer.ts:46-52` does not thread `eraSignal` into the snapshot, even though `catalogEntry.eraSignal` is in scope.

The template string `'Echoes the ${era} era of your collection.'` will never render. Dead code in a deterministic template library is a maintenance smell — future readers may assume the predicate fires and rely on the copy.

**Fix (one of):**

- Complete the wiring. Add `eraSignal: catalogEntry?.eraSignal ?? null` to `CandidateTasteSnapshot` and `composer.ts`'s snapshot builder; rewrite the predicate to `taste.eraSignal && profile.dominantEraSignal === taste.eraSignal`.
- Or delete the entry until the wiring is needed; record a note in the phase plan.

### IN-02: `ownedAtIso ?? new Date().toISOString()` fallback in catalog page is dead code

**File:** `src/app/catalog/[catalogId]/page.tsx:57`

**Issue:** `findViewerWatchByCatalogId` (lines 136-158) always returns a non-null string in `acquisitionDate` — when `row.acquisitionDate` is null, the helper substitutes `new Date(row.createdAt).toISOString()`. So the call-site coalesce on line 57 (`viewerOwnedRow.acquisitionDate ?? new Date().toISOString()`) is unreachable.

**Fix:** Remove the call-site `??` (the helper guarantees a value), or move the `?? new Date().toISOString()` fallback OUT of the helper and into the caller. Pair with IN-03 below.

### IN-03: Misleading return field name in `findViewerWatchByCatalogId`

**File:** `src/app/catalog/[catalogId]/page.tsx:139, 154-157`

**Issue:** The return type advertises `acquisitionDate: string | null`, but the helper actually returns:
- a non-null value (`null` is impossible — the helper falls through to `createdAt.toISOString()`),
- and the value is *not always* the row's `acquisitionDate` (it may be the `createdAt` ISO string).

The field name lies about both nullability and provenance.

**Fix:** Rename to `ownedAtIso: string` (matches the consumer field on `VerdictBundleSelfOwned`):

```ts
async function findViewerWatchByCatalogId(
  userId: string,
  catalogId: string,
): Promise<{ id: string; ownedAtIso: string } | null> {
  ...
  return { id: row.id, ownedAtIso: iso }
}
// caller:
verdict = {
  framing: 'self-via-cross-user',
  ownedAtIso: viewerOwnedRow.ownedAtIso,
  ownerHref: `/watch/${viewerOwnedRow.id}`,
}
```

### IN-04: `DiscoveryWatchCard` uses raw `<img>` without `getSafeImageUrl`

**File:** `src/components/explore/DiscoveryWatchCard.tsx:36-42`

**Issue:** The component renders `watch.imageUrl` via a raw `<img>` (with `eslint-disable @next/next/no-img-element`). Sibling components on the same data path (`WatchDetail.tsx:109`) use `getSafeImageUrl()` for parity. The catalog source enum (`src/lib/types.ts:111`) includes `url_extracted` — meaning third-party-controlled URLs can land in `imageUrl`. While `<img src>` does not execute JS in modern browsers, an attacker-controlled URL still leaks viewer IP / referrer to attacker-controlled hosts on every render.

This file existed before Phase 20 and was only modified to wrap in a `Link` (D-10), so this finding may be carried-forward technical debt rather than Phase-20 introduced. Including it because the file is in the changed set and the fix is small.

**Fix:**

```tsx
import { getSafeImageUrl } from '@/lib/images'
const safe = getSafeImageUrl(watch.imageUrl)
{safe ? (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={safe} alt="" className="w-full h-full object-cover" />
) : null}
```

### IN-05: `applyHedge` lowercases first character — fragile invariant on template wording

**File:** `src/lib/verdict/composer.ts:96-99`

**Issue:** `applyHedge` does `s[0].toLowerCase() + s.slice(1)` to splice "Possibly " in front of the existing template. This works for all 12 current templates because each begins with a verb / article that's grammatically lowercase mid-sentence. A future template like `'Rolex pieces in your collection set the floor.'` would render as `'Possibly rolex pieces in your collection set the floor.'` — visibly broken.

**Fix:** Add an invariant comment to `templates.ts`:

```ts
// INVARIANT: every template MUST begin with a regular word (verb / article /
// common noun that is grammatically lowercase mid-sentence) — applyHedge() in
// composer.ts lowercases the first character to splice "Possibly " in front.
```

No code change required if the policy is understood; just document it.

### IN-06: `numbersOf` uses `as unknown as` to handle pg-numeric stringification

**File:** `src/lib/verdict/viewerTasteProfile.ts:62-67`

**Issue:** The cast `r[key] as unknown as number | string | null` is correct (Drizzle returns `numeric` columns as strings via postgres-js, even though the schema infers `number`) and the docstring at lines 28-34 explains why. Just noting that `as unknown` casts bypass TypeScript's narrowing — a future schema change to `bigint` would silently break this code with `Number(bigint) → NaN` filtered out.

**Fix:** Optional. A small parser helper makes the conversion explicit and future-proof:

```ts
function parseNumeric(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}
const numbersOf = (key: 'formality' | 'sportiness' | 'heritageScore'): number[] =>
  rows.map((r) => parseNumeric(r[key])).filter((n): n is number => n !== null)
```

### IN-07: Catalog-page test mock duplicates Drizzle query-shape

**File:** `tests/app/catalog-page.test.ts:25-35`

**Issue:** The `vi.mock('@/db')` factory hardcodes the chain shape `select → from → where → limit`. This is brittle: a future addition like `.orderBy()` or `.leftJoin()` to `findViewerWatchByCatalogId` will not be exercised by the mock and may produce silent test passes. Test-only concern.

**Fix:** Optional. Extract the inline helper to `src/data/watches.ts` (e.g. `getOwnedRowByCatalogId(userId, catalogId)`). Then the test mocks the helper directly, decoupling the SQL contract from the test. Bonus: keeps `src/app/catalog/[catalogId]/page.tsx` free of direct Drizzle usage (consistent with `getWatchesByUser`, `getCatalogById`, `getPreferencesByUser` already centralized in DAL).

### IN-08: `WatchSearchRowsAccordion` has no explicit empty-results guard

**File:** `src/components/search/WatchSearchRowsAccordion.tsx`

**Issue:** When `results` is empty, the component renders an empty `<Accordion.Root>` with no children. The current caller (`WatchesPanel` in `SearchPageClient.tsx:277-289`) handles the empty case upstream, so this is dead-but-defensive today. A future caller could render the accordion with empty results and produce a silent no-op UI. Low priority.

**Fix (optional):** Render `null` when `results.length === 0`, or assert at the contract boundary:

```ts
if (results.length === 0) return null
```

---

_Reviewed: 2026-04-29T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
