---
phase: 16-people-search
reviewed: 2026-04-25T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - src/app/actions/search.ts
  - src/app/search/page.tsx
  - src/components/layout/DesktopTopNav.tsx
  - src/components/search/ComingSoonCard.tsx
  - src/components/search/HighlightedText.tsx
  - src/components/search/PeopleSearchRow.tsx
  - src/components/search/SearchPageClient.tsx
  - src/components/search/SearchResultsSkeleton.tsx
  - src/components/search/useSearchState.ts
  - src/components/ui/skeleton.tsx
  - src/data/search.ts
  - src/lib/searchTypes.ts
  - tests/app/search/SearchPageClient.test.tsx
  - tests/components/layout/DesktopTopNav.test.tsx
  - tests/components/search/PeopleSearchRow.test.tsx
  - tests/components/search/useSearchState.test.tsx
  - tests/data/searchProfiles.test.ts
  - tests/setup.ts
findings:
  critical: 0
  warning: 2
  info: 5
  total: 7
status: issues_found
---

# Phase 16: Code Review Report

**Reviewed:** 2026-04-25
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Phase 16 introduces the People Search surface (`/search`), the supporting Server Action and DAL, the desktop top-nav search input, and a shared coming-soon card. Overall, the implementation is well-structured and matches the CONTEXT decisions (D-02..D-29) and pitfall mitigations called out in the plans. Security fundamentals are solid: Zod-validated Server Action, parameterized SQL, two-layer privacy (`profile_public = true` + viewer self-exclusion), regex-metachar escaping in `HighlightedText`, and React text-escaping for the bio surface.

Two warnings worth addressing before merge:

1. **ILIKE wildcard injection** — user query is interpolated into a `%${trimmed}%` pattern without escaping `%` and `_`, so a user typing `_` or `%` gets ILIKE-wildcard semantics rather than literal-character matching. Not a security vulnerability (no SQL injection — Drizzle parameterizes the value), but a correctness/UX bug.
2. **Unvalidated `tab` URL parameter** — `searchParams.get('tab') as SearchTab | null` is an unchecked `as` cast. A bogus `?tab=foo` URL ends up in component state and round-trips back into the URL via the sync effect.

The remaining items are minor (full-page reload from the desktop-nav search submit, redundant `bioSnippet` field, etc.).

## Warnings

### WR-01: ILIKE wildcard characters in user query are not escaped

**File:** `src/data/search.ts:65`
**Issue:** The DAL constructs the ILIKE pattern via `const pattern = \`%${trimmed}%\``. SQL `%` and `_` are wildcard metacharacters in `LIKE`/`ILIKE`. A user typing the literal characters `%` or `_` in the search box gets wildcard semantics instead of literal matching. Consequences:
- A query of `"_a"` (length 2, passes the gate) becomes `%_a%`, matching every username with at least 2 characters whose 2nd character is `a` — a much broader match than the user intended.
- A query of `"%"` (whitespace-trimmed length 1) is rejected by the 2-char gate, but `"%a"` slips through and behaves as `LIKE '%%a%'` ≡ `LIKE '%a%'`, which is fine — but `"_"` followed by any char similarly bypasses the user's literal intent.
- This is **not** a security vulnerability — Drizzle parameterizes the bound value and there is no SQL injection. It is a correctness/UX bug.

This is also a minor abuse vector for resource exhaustion (a query of `"___"` matches all profiles whose username is at least 3 chars), though within Phase 16 scope (single-user MVP) the impact is negligible.

**Fix:**
```typescript
// Escape ILIKE wildcards so user-typed % and _ match literally.
const escapeLikePattern = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')

const pattern = `%${escapeLikePattern(trimmed)}%`
```
Postgres uses `\` as the default LIKE escape character; no `ESCAPE` clause needed unless a non-default escape is configured.

---

### WR-02: `tab` URL parameter is cast to `SearchTab` without validation

**File:** `src/components/search/useSearchState.ts:49`
**Issue:** `const initialTab = (searchParams.get('tab') as SearchTab | null) ?? 'all'` is an unchecked TypeScript `as` cast. If the URL contains `?tab=foo`, the string `'foo'` is stored in component state with the lying type `SearchTab`. Downstream:
- The fetch effect's `if (tab !== 'all' && tab !== 'people')` branch correctly fails closed (no fetch), so this is not a security issue.
- The URL sync effect's `if (tab !== 'all') params.set('tab', tab)` round-trips the bogus value back into the URL.
- No `<TabsContent value="foo">` exists, so the user sees a blank tab panel until they click a real tab.

**Fix:**
```typescript
const VALID_TABS = ['all', 'people', 'watches', 'collections'] as const
const isValidTab = (s: string | null): s is SearchTab =>
  s !== null && (VALID_TABS as readonly string[]).includes(s)

const rawTab = searchParams.get('tab')
const initialTab: SearchTab = isValidTab(rawTab) ? rawTab : 'all'
```

## Info

### IN-01: `DesktopTopNav` search submit forces a full-page reload

**File:** `src/components/layout/DesktopTopNav.tsx:51-60`
**Issue:** `handleSearchSubmit` uses `window.location.href = ...` to navigate to `/search`. This triggers a full document load instead of Next.js client-side routing. Consequences:
- Network/JS re-evaluation cost per submit
- Loses any in-flight optimistic state on the source page
- Inconsistent with the rest of the app (which uses `<Link>` / `router.push`)

The component is already `'use client'` and could use `useRouter()` from `next/navigation`.

**Fix:**
```typescript
import { useRouter } from 'next/navigation'

const router = useRouter()
const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault()
  const fd = new FormData(e.currentTarget)
  const q = String(fd.get('q') ?? '').trim()
  router.push(q ? `/search?q=${encodeURIComponent(q)}` : '/search')
}
```
Note: Test E (`tests/components/layout/DesktopTopNav.test.tsx:167`) currently asserts on `window.location.href`. Updating to `router.push` will require a parallel update to mock `useRouter` and assert on `mockPush`.

---

### IN-02: `bioSnippet` field stores the full bio rather than a snippet

**File:** `src/data/search.ts:139` and `src/lib/searchTypes.ts:15`
**Issue:** `bioSnippet: c.bio` simply re-exports the full bio. The comment ("line-clamp-1 handled by UI") explains the choice, but the field name promises a server-computed snippet. This is misleading — a future maintainer extending bio behavior may add a real snippet on the server-side and break existing UI assumptions, or duplicate truncation logic.

**Fix:** Either rename to `bio` (and drop the duplicate field) or actually compute a snippet (e.g., first 140 chars centered on the match) on the server. Simplest:
```typescript
// In SearchProfileResult: drop bioSnippet, keep bio.
// In PeopleSearchRow: use result.bio directly.
```

---

### IN-03: `Suspense` fallback for `/search` is an empty div (no skeleton)

**File:** `src/app/search/page.tsx:30`
**Issue:** The Suspense fallback is `<div className="mx-auto w-full max-w-3xl px-4 py-8" />` — empty. Users land on `/search` and see a brief blank container before the Client Component hydrates. A search-skeleton fallback would be more on-brand and consistent with the loading skeleton already shown for in-flight queries.

**Fix:**
```tsx
<Suspense
  fallback={
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <SearchResultsSkeleton />
    </main>
  }
>
```

---

### IN-04: `HighlightedText` relies on value-comparison instead of split-position parity for match detection

**File:** `src/components/search/HighlightedText.tsx:35-42`
**Issue:** `String.prototype.split` with a capture-group regex guarantees matched substrings appear at odd indices (1, 3, 5, ...) in the resulting array — this is a stable contract per ES spec. The current code uses `part.toLowerCase() === lowerQ` to identify matches, which works but is more fragile than index parity:
- It walks every part regardless (cheap but unnecessary).
- If `text` happens to contain a literal substring identical to `trimmedQ` between two matches… that substring would already have matched the global regex on the previous pass, so this scenario can't actually arise. But the value comparison invites that doubt.

**Fix (optional, code clarity):**
```typescript
{parts.map((part, i) =>
  i % 2 === 1 ? (
    <strong key={i} className="font-semibold text-foreground">{part}</strong>
  ) : (
    <Fragment key={i}>{part}</Fragment>
  ),
)}
```
This makes the matching invariant self-documenting.

---

### IN-05: `searchPeopleAction` has no rate limiting; per-call fan-out is N+1-shaped

**File:** `src/app/actions/search.ts:35` (and `src/data/search.ts:108-150`)
**Issue:** Each call to `searchPeopleAction` triggers up to 50 candidates × 3 DAL queries (`getWatchesByUser`, `getPreferencesByUser`, `getAllWearEventsByUser`) = up to 150 DB round-trips inside a `Promise.all`, plus one batched `follows` lookup. There is no per-user rate limit on the action.

In v1 personal-MVP scope this is acceptable (single-user, debounced 250ms client-side). However, a malicious authenticated user could spam queries (one per debounce window or via direct Server Action invocation) to exhaust DB connections.

This is **out of v1 scope** per the review-scope rules (performance issues are excluded), but flagged here as a security/reliability note for the multi-user phase.

**Fix (deferred):** Add per-user rate limiting (e.g., upstash/ratelimit on viewerId) and consider pre-computing taste-overlap scores as a materialized view or denormalized column. Track in `deferred-items.md` for the multi-user auth phase.

---

_Reviewed: 2026-04-25_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
