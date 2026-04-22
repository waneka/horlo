---
phase: 10-activity-feed
plan: 07
subsystem: home-discovery-ui
tags: [nextjs16, cache-components, use-cache, cacheLife, server-components, tdd, vitest, react-testing-library, follow-button-reuse, keyset-pagination]

# Dependency graph
requires:
  - plan: 10-01
    provides: |
      cacheComponents: true in next.config.ts — prerequisite for the
      'use cache' directive in src/components/home/CollectorsLikeYou.tsx.
  - plan: 10-04
    provides: |
      getRecommendationsForViewer DAL, getSuggestedCollectors DAL +
      SuggestionCursor type + SuggestionPage, loadMoreSuggestions Server
      Action, wishlistGap pure function, Recommendation /
      SuggestedCollector / WishlistGap types from
      src/lib/discoveryTypes.ts.
  - plan: 10-05
    provides: |
      FeedEmptyState anchor target contract — Plan 05's "Find collectors
      to follow" CTA links to "#suggested-collectors", which THIS plan
      provides on the <section> wrapper of the Suggested Collectors
      component.
  - phase: 9
    provides: |
      FollowButton with variant="inline" (Phase 9 D-07/D-09 semantics
      preserved — reused without modification); AvatarDisplay size={40};
      /u/{username}/common-ground 6th tab.
provides:
  - "CollectorsLikeYou Server Component ('use cache' + cacheLife('minutes')) — rec rail for the home page"
  - "RecommendationCard — pure render of one Recommendation with w-40/md:w-44 + aspect-[4/5] + /watch/{id} link"
  - "PersonalInsightsGrid Server Component — up to 4 insight cards; I-04 hides entire section when viewer owns 0 watches"
  - "SleepingBeautyCard + MostWornThisMonthCard + WishlistGapCard + CommonGroundFollowerCard — pure-render insight cards"
  - "SuggestedCollectors Server Component with id=\"suggested-collectors\" anchor (Plan 05 FeedEmptyState target)"
  - "SuggestedCollectorRow — reuses Phase 9 FollowButton variant=\"inline\" + initialIsFollowing=false; row link + FollowButton click isolation via z-index"
  - "LoadMoreSuggestionsButton ('use client') — calls loadMoreSuggestions Server Action, appends rows, hides on final page (S-03 LOCKED)"
affects: [10-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cached Server Component with prop-borne viewerId (Pitfall 7 / T-10-07-01): 'use cache' + cacheLife('minutes') as the first two lines of the async function body; viewerId flows as a function argument so Next.js includes it in the cache key. Absence of getCurrentUser() inside the cached scope is grep-verified."
    - "Insight ordering vs. rendering separation: PersonalInsightsGrid tracks `effectiveDays` (+Infinity for never-worn) as the ordering key for Sleeping Beauty and passes `lastWornDate` separately to the card. The card branches on `lastWornDate === null` to render 'Never worn' rather than fabricating a 999-day sentinel count — the previous approach leaked '999 days unworn' into the UI."
    - "LoadMore state machine mirror: LoadMoreSuggestionsButton reuses Plan 05's LoadMoreButton state shape exactly (cursor + appendedRows + error + useTransition), so both Load More controls on the home feel identical. Error label 'Couldn't load more. Tap to retry.' is byte-identical."
    - "Row + nested interactive isolation: SuggestedCollectorRow uses an absolute-inset Link overlay (row click → /u/{username}/collection) with the FollowButton raised via `relative z-10` so the button's click never bubbles to the row link. Same pattern established in Plan 10-05's ActivityRow (F-03) — canonical for any future composite row with both row-level and button-level targets."
    - "FollowButton reuse without modification: SuggestedCollectorRow imports Phase 9's FollowButton as-is. `variant='inline'` + `initialIsFollowing={false}` always (DAL excludes followed users via notInArray — T-10-04-02). No Suggested-specific variant added."

key-files:
  created:
    - src/components/home/CollectorsLikeYou.tsx
    - src/components/home/RecommendationCard.tsx
    - src/components/home/PersonalInsightsGrid.tsx
    - src/components/home/SleepingBeautyCard.tsx
    - src/components/home/MostWornThisMonthCard.tsx
    - src/components/home/WishlistGapCard.tsx
    - src/components/home/CommonGroundFollowerCard.tsx
    - src/components/home/SuggestedCollectors.tsx
    - src/components/home/SuggestedCollectorRow.tsx
    - src/components/home/LoadMoreSuggestionsButton.tsx
    - tests/components/home/RecommendationCard.test.tsx
    - tests/components/home/CollectorsLikeYou.test.tsx
    - tests/components/home/PersonalInsightsGrid.test.tsx
    - tests/components/home/SuggestedCollectorRow.test.tsx
    - tests/components/home/LoadMoreSuggestionsButton.test.tsx
  modified: []

key-decisions:
  - "Used `cacheLife('minutes')` preset, which resolves to 5min stale / 1min revalidate / 1hr expire (per node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cacheLife.md table lines 134–141). Matches CONTEXT.md C-06 'per-request, cached … ~5 minutes' guidance and avoids a custom cacheLife config. Note: with `revalidate: 60s`, the 'minutes' profile is above the 5-minute dynamic-hole cutoff (cacheLife.md line 256) so CollectorsLikeYou does prerender."
  - "Wishlist-gap click target = `/u/me/wishlist?filter={gap.role}` (I-03 Claude's discretion). `/u/me/*` does not exist as a canonical route today — Plan 10-08 will wire the viewer's actual username in as the parent computes it, or alias `/u/me` to `/u/{viewerUsername}` at the page level. Threat register T-10-07-03 documents this as an 'accept' disposition."
  - "Common Ground per-follower try/catch: each follower's `getTasteOverlapData` call is wrapped in its own try/catch returning `shared: 0` on failure. One bad row never hides the whole card. Scan limit = 10 followers — bounded scoring pass to keep render latency predictable."
  - "Heading literals kept on single lines in JSX (`<h2 …>For you</h2>` and `<h2 …>Collectors to follow</h2>`) so the plan's acceptance-criteria greps for `>For you<` and `>Collectors to follow<` match as written. Pure formatting decision; Prettier would normally split these long lines."
  - "Test-level FollowButton stub: SuggestedCollectorRow / LoadMoreSuggestionsButton tests stub `@/components/profile/FollowButton` with a bare `<button data-testid='follow-button'>`. Keeps the suite focused on Plan 07 composition; Phase 9's FollowButton behavior is already covered by its own test file."
  - "Test scoping: LoadMoreSuggestionsButton tests scope `screen.getByRole('button')` queries by accessible name (`/Load more/`, `/Retry/`, `/Loading/`) so the stubbed FollowButton inside appended rows doesn't clash with the Load More button's role query. Required because appended rows render inside the same tree as the Load More button."

patterns-established:
  - "'use cache' + cacheLife('minutes') pattern with viewerId as a prop: CollectorsLikeYou is the reference implementation. Any future cached Server Component on the home that is viewer-specific should follow the same shape: prop-borne identity, directive as first line of the function body, cacheLife immediately after."
  - "Personal-insights hide-on-empty (I-04) via early-return null: PersonalInsightsGrid's `if (owned.length === 0) return null` is the canonical pattern for any home section that degrades to hidden when the viewer has no relevant signal. The home's outer `space-y-*` stack collapses null sections cleanly."
  - "SuggestedCollectors section wrapper with `id='suggested-collectors'`: anchor-target contract for any home CTA that wants to deep-link to a section (established here so Plan 05's FeedEmptyState can land users on it). Future cross-section CTAs should follow the same `id={section}-slug` convention."

requirements-completed: [FEED-05, DISC-02, DISC-04]

# Metrics
duration: ~8 min
completed: 2026-04-22
---

# Phase 10 Plan 07: Recs / Insights / Suggested UI Summary

**Built the three remaining home-page sections: From Collectors Like You (cached rec rail with `'use cache'` + `cacheLife('minutes')` + prop-borne viewerId to avoid cross-user cache-key leakage), Personal Insights (4-card grid that hides entirely when viewer owns 0 watches), and Suggested Collectors (row list reusing Phase 9 FollowButton variant="inline", plus a LoadMoreSuggestionsButton mirroring Plan 05's state machine so both Load More controls on the home feel identical). 10 new components + 5 test files = 34 new unit tests, all green; full suite 2031/2031 passing, lint zero-error, `npm run build` green across all 20 routes under `cacheComponents: true`.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-22T00:35:19Z
- **Completed:** 2026-04-22T00:43:08Z
- **Tasks:** 3 (all TDD — RED test commit, then GREEN implementation commit)
- **Files created:** 15 (10 components + 5 test files)
- **Commits:** 6 task commits + pending metadata commit

## Accomplishments

### Task 1 — From Collectors Like You (cached rec rail)

- **`RecommendationCard`** (`src/components/home/RecommendationCard.tsx`) — pure render. `w-40 md:w-44` outer Link, `aspect-[4/5]` image area with `next/image` + `unoptimized`, `WatchIcon` fallback on null imageUrl, brand/model/rationale caption. Link href `/watch/${rec.representativeWatchId}` per C-05. aria-label `"${brand} ${model}"`.

- **`CollectorsLikeYou`** (`src/components/home/CollectorsLikeYou.tsx`) — async Server Component. First line of function body: `'use cache'`. Second line: `cacheLife('minutes')`. Awaits `getRecommendationsForViewer(viewerId)`. Returns null when recs.length === 0 (C-02 fallback — section hides entirely). Otherwise renders `<section>` with `<h2>From collectors like you</h2>` + horizontal scroll-snap rail of RecommendationCards.

  **Pitfall 7 / T-10-07-01 mitigation:** viewerId flows as a function prop, not from `getCurrentUser()` inside. Grep-verified: file contains zero references to `getCurrentUser`. Next.js serializes the prop into the cache key, preventing cross-user rec leakage.

  **`cacheLife('minutes')` behavior (confirmed from node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cacheLife.md line 137):** 5 minutes stale / 1 minute revalidate / 1 hour expire. With `revalidate: 60s` the component is above the 5-minute dynamic-hole cutoff (cacheLife.md line 256), so it does prerender.

### Task 2 — Personal Insights (4-card grid with I-04 hide-on-empty)

- **`SleepingBeautyCard`** — Alert badge with `bg-accent text-accent-foreground`. Renders `"Never worn"` literal when `lastWornDate === null` (per new decision: don't fabricate day counts); otherwise `"{daysUnworn} days unworn"`. Link to `/watch/{id}`.

- **`MostWornThisMonthCard`** — uppercase label "Most worn this month" + brand/model + `"N wear(s)"`. Link to `/watch/{id}`.

- **`WishlistGapCard`** — Tip badge with `bg-accent text-accent-foreground`. Consumes `WishlistGap` from `wishlistGap()`. Returns null when `gap.role` is null. Link to `/u/me/wishlist?filter={gap.role}` (I-03 Claude's discretion).

- **`CommonGroundFollowerCard`** — AvatarDisplay (size 40) + display name + `"N shared"`. Link to `/u/{username}/common-ground` (Phase 9 6th tab).

- **`PersonalInsightsGrid`** — async Server Component. Resolves owned watches + wear events + following list in parallel. **I-04: returns null when `owned.length === 0`** — the entire section hides. Otherwise:
  - **Sleeping Beauty ordering key**: `effectiveDays = daysSince(lastWornDate) ?? Number.POSITIVE_INFINITY` so never-worn watches sort to the top. The card renders `lastWornDate` directly (null → "Never worn").
  - **Most Worn This Month**: calendar-month window via ISO `YYYY-MM-DD` string comparison against `monthStart`. Omitted when no wears.
  - **Wishlist Gap**: calls `wishlistGap(owned, wishlist)` with status-filtered arrays.
  - **Common Ground**: scans up to 10 followers via `getTasteOverlapData` + `computeTasteOverlap`. Each per-follower call wrapped in its own try/catch (returns `shared: 0` on failure). Top follower by sharedWatches count wins — omitted if none have any shared watches.

### Task 3 — Suggested Collectors (row list + Load More)

- **`SuggestedCollectorRow`** — absolute-inset `<Link>` overlay to `/u/{username}/collection` with FollowButton raised via `relative z-10`. Reuses **Phase 9's FollowButton without modification** (`variant="inline"`, `initialIsFollowing={false}`, `targetDisplayName={displayName ?? username}`). Renders `"{Math.round(overlap * 100)}% taste overlap"`, up to 3 mini-thumb cluster with `bg-muted ring-2 ring-card` wrappers overlapping by `-0.5rem`, `"{sharedCount} shared"` label. AvatarDisplay size 40.

- **`LoadMoreSuggestionsButton`** (`'use client'`) — calls `loadMoreSuggestions({ cursor })` Server Action, appends rows, hides itself when nextCursor becomes null. Mirrors Plan 05's LoadMoreButton state machine exactly (cursor + appendedRows + error + useTransition). Error label `"Couldn't load more. Tap to retry."` (byte-identical to Plan 05). aria-label cycles through `"Loading more collectors"` → `"Retry loading more collectors"` → `"Load more"`.

- **`SuggestedCollectors`** — async Server Component. Awaits `getSuggestedCollectors(viewerId, { limit: 5 })` and destructures `{ collectors, nextCursor }`. `<section id="suggested-collectors">` on both the empty-state branch and the populated branch (Plan 05 FeedEmptyState anchor target). Empty-state copy matches UI-SPEC verbatim: `"You're already following everyone we can suggest"` + `"Check back as more collectors join."`. Populated branch conditionally renders `<LoadMoreSuggestionsButton>` on non-null nextCursor.

## Task Commits

| # | Type | Description | Hash |
|---|------|-------------|------|
| 1 | test | RED tests for RecommendationCard + CollectorsLikeYou | `4448838` |
| 2 | feat | RecommendationCard + cached CollectorsLikeYou section | `62c7806` |
| 3 | test | RED tests for PersonalInsightsGrid | `bc63840` |
| 4 | feat | PersonalInsightsGrid + 4 insight cards | `6f16c3b` |
| 5 | test | RED tests for SuggestedCollectorRow + LoadMoreSuggestionsButton | `509918e` |
| 6 | feat | SuggestedCollectors section + LoadMoreSuggestionsButton | `29b360c` |

Plan metadata commit made after this SUMMARY is written.

## Files Created

**Components (10):**
- `src/components/home/CollectorsLikeYou.tsx` — cached Server Component; `'use cache'` + `cacheLife('minutes')`; viewerId prop
- `src/components/home/RecommendationCard.tsx` — pure render of one Recommendation
- `src/components/home/PersonalInsightsGrid.tsx` — Server Component; I-04 hide on empty; 4 cards + ordering/rendering separation for Sleeping Beauty
- `src/components/home/SleepingBeautyCard.tsx` — Alert badge; "Never worn" literal for null lastWornDate
- `src/components/home/MostWornThisMonthCard.tsx` — pure render; plural-aware wears label
- `src/components/home/WishlistGapCard.tsx` — Tip badge; returns null when gap.role is null
- `src/components/home/CommonGroundFollowerCard.tsx` — AvatarDisplay + /u/{username}/common-ground link
- `src/components/home/SuggestedCollectors.tsx` — Server Component; id="suggested-collectors" anchor
- `src/components/home/SuggestedCollectorRow.tsx` — FollowButton reuse; row + button click isolation via z-index
- `src/components/home/LoadMoreSuggestionsButton.tsx` — 'use client'; mirrors Plan 05 LoadMoreButton state machine

**Tests (5, 34 passing cases):**
- `tests/components/home/RecommendationCard.test.tsx` — 5 cases
- `tests/components/home/CollectorsLikeYou.test.tsx` — 8 cases (4 behavioral + 4 source-integrity greps)
- `tests/components/home/PersonalInsightsGrid.test.tsx` — 8 cases
- `tests/components/home/SuggestedCollectorRow.test.tsx` — 7 cases
- `tests/components/home/LoadMoreSuggestionsButton.test.tsx` — 6 cases

## Output Spec Requirements (from 10-07-PLAN.md `<output>`)

### 1. `cacheLife('minutes')` behavior observed

Per `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cacheLife.md` line 137:

| Profile | Description | Stale | Revalidate | Expire |
|---------|-------------|-------|------------|--------|
| `minutes` | Frequently updated content | 5 minutes | 1 minute | 1 hour |

**Implications for CollectorsLikeYou:**
- Clients see cached recs for up to 5 min before a background revalidation is triggered.
- Server regenerates fresh recs every ~1 min on access (low cost since tasteOverlap is per-request but the outer cache amortizes across identical viewerId requests).
- Cache entries fully expire after 1 hour, even without traffic.
- `revalidate: 60s` is ABOVE the 5-minute dynamic-hole cutoff (cacheLife.md line 256), so `CollectorsLikeYou` participates in prerendering — it does NOT become a dynamic hole.

Confirmed via `npm run build`: all 20 routes render successfully, `◐` (Partial Prerender) on `/` — the home page prerenders its static shell while `CollectorsLikeYou` contributes a cached segment keyed by viewerId.

### 2. Wishlist-gap click target chosen

`WishlistGapCard` links to `/u/me/wishlist?filter={gap.role}`.

**Why:** CONTEXT.md I-03 explicitly calls this out as Claude's discretion ("filtered wishlist view, or scroll-to / refresh Collectors Like You section with a style filter applied"). The filtered wishlist is the most direct fulfillment of the card's prompt ("you have a gap in `${role}` — here are your wishlist candidates for that role").

**Caveat (T-10-07-03 in the plan's threat register, accept disposition):** `/u/me` is not a canonical route in the codebase today. Plan 10-08 (which assembles the home page) will either (a) rewrite this link to `/u/{viewerUsername}/wishlist?filter={gap.role}` by reading the viewer's username from `getCurrentUser() + getProfileById()` at the page layer, or (b) alias `/u/me/*` to `/u/{viewerUsername}/*` at the route level. The card itself ships the logical URL; the concrete rewrite is Plan 08's call.

### 3. Common Ground fallbacks when `getTasteOverlapData` throws

Each per-follower call in `PersonalInsightsGrid` is independently try/catch'd:

```ts
following.slice(0, 10).map(async (f) => {
  try {
    const data = await getTasteOverlapData(viewerId, f.userId)
    const result = computeTasteOverlap(data.viewer, data.owner)
    return { f, shared: result.sharedWatches.length }
  } catch {
    return { f, shared: 0 }
  }
})
```

Results:
- A failed follower contributes `shared: 0` to the scoring pass.
- The top follower by `shared` wins.
- If ALL followers fail (or if the top follower has `shared: 0`), the Common Ground card is omitted entirely — the grid still renders the other three cards and the "For you" heading.

Test 7 (`PersonalInsightsGrid.test.tsx`) pins this: mocking `getTasteOverlapData` to reject makes `commonGround` null and no `/common-ground` link appears in the rendered output.

### 4. Confirming Load More (S-03 LOCKED) end-to-end wiring

- `SuggestedCollectors` destructures `{ collectors, nextCursor } = await getSuggestedCollectors(viewerId, { limit: 5 })` — confirmed via grep `nextCursor && (` in the source.
- `LoadMoreSuggestionsButton` is mounted when `nextCursor` is non-null (grep `nextCursor && (` in SuggestedCollectors.tsx).
- On click, the button calls `loadMoreSuggestions({ cursor })` inside `useTransition` (grep `loadMoreSuggestions({ cursor })` in LoadMoreSuggestionsButton.tsx).
- On success with a non-null returned `nextCursor`, the button appends rows (via `SuggestedCollectorRow`) and updates its internal cursor.
- On success with `nextCursor === null`, the button sets its cursor to `null`, which hides it (`{cursor !== null && (…)}`) — the appended rows remain, the Load More control disappears.
- On failure, the error label flips to `"Couldn't load more. Tap to retry."` and the next click retries cleanly (error is cleared before `startTransition` re-fires).

Tests 3, 4, 6 in `LoadMoreSuggestionsButton.test.tsx` cover all three branches (null-cursor → unmount, non-null-cursor → stay mounted, error → retry). All pass.

## Decisions Made

See **key-decisions** in frontmatter + **Output Spec Requirements** above for full detail.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Plan sketch used incorrect AvatarDisplay prop name**

- **Found during:** Task 2 + Task 3
- **Issue:** Plan sketches showed `<AvatarDisplay src={avatarUrl} username={username} size={40} />` but the actual Phase 8 API is `{ avatarUrl, displayName, username, size }` (no `src`). Using the sketch API as-is would fail TypeScript compilation.
- **Fix:** Passed `avatarUrl={collector.avatarUrl}` + `displayName={collector.displayName}` + `username={collector.username}` + `size={40}` in both `CommonGroundFollowerCard` and `SuggestedCollectorRow`.
- **Files modified:** `src/components/home/CommonGroundFollowerCard.tsx`, `src/components/home/SuggestedCollectorRow.tsx`
- **Commits:** `6f16c3b`, `29b360c`
- **Scope:** Directly caused by this task (the plan sketches mis-specified the API); fix is isolated to this plan's files.

**2. [Rule 3 — Blocking] Test role-query clash after appended rows**

- **Found during:** Task 3 GREEN (initial test run)
- **Issue:** `screen.queryByRole('button')` in `LoadMoreSuggestionsButton.test.tsx` matched BOTH the Load More button AND the stubbed FollowButton inside appended `SuggestedCollectorRow` instances. Tests 3, 4, 6 fail as soon as any row is appended.
- **Fix:** Scoped all ambiguous button queries by accessible name (`{ name: /Load more/ }`, `{ name: /Retry/ }`, `{ name: /Load more|Retry|Loading/ }` for the negative case). Maintains the semantic contract — the Load More button's aria-label transitions are still what the test verifies.
- **Files modified:** `tests/components/home/LoadMoreSuggestionsButton.test.tsx`
- **Commit:** `29b360c`
- **Scope:** Test-harness-only fix; no source code changed.

### Formatting Adjustments (not deviations)

- `PersonalInsightsGrid` and `SuggestedCollectors` heading `<h2>` tags kept on single lines (`<h2 …>For you</h2>` and `<h2 …>Collectors to follow</h2>`) rather than split across three lines, so the plan's acceptance-criteria greps for `>For you<` and `>Collectors to follow<` match the source verbatim. A Prettier pass would normally split these; the single-line form is intentional to meet the contract.

## Authentication Gates

None. All work was purely code + tests; no auth flow involved.

## Issues Encountered

- **Lint warnings on test files (5 `@next/next/no-img-element` warnings)** — from the `next/image` stubs in the new test files that return plain `<img>`. Follows the existing `ActivityRow.test.tsx` / `WatchPickerDialog.test.tsx` pattern. Lint errors: **0**.
- **Pre-existing lint warnings across unrelated source/test files** persist (same ~70 errors as Plan 10-04 noted); zero introduced by this plan.

## User Setup Required

None. No new secrets, migrations, or environment variables.

## Next Phase Readiness

**Plan 10-08 (home page assembly) can now import everything it needs:**

```tsx
import { CollectorsLikeYou } from '@/components/home/CollectorsLikeYou'
import { PersonalInsightsGrid } from '@/components/home/PersonalInsightsGrid'
import { SuggestedCollectors } from '@/components/home/SuggestedCollectors'

// At the home page Server Component:
const viewerId = (await getCurrentUser()).id
<CollectorsLikeYou viewerId={viewerId} />
<PersonalInsightsGrid viewerId={viewerId} />
<SuggestedCollectors viewerId={viewerId} />
```

Each section handles its own empty-state and privacy; the page layer just composes.

**Open task for Plan 10-08:** resolve `/u/me/wishlist?filter={role}` in `WishlistGapCard` to the viewer's concrete username or alias `/u/me/*` at the route level.

## Self-Check: PASSED

Verified via shell checks:

- `src/components/home/CollectorsLikeYou.tsx` — FOUND; contains `'use cache'`, `cacheLife('minutes')`, `viewerId }: { viewerId: string }`; no `getCurrentUser`; heading literal `From collectors like you`
- `src/components/home/RecommendationCard.tsx` — FOUND; href pattern `/watch/${rec.representativeWatchId}`; `w-40`, `md:w-44`, `aspect-[4/5]` classes present
- `src/components/home/PersonalInsightsGrid.tsx` — FOUND; `owned.length === 0` early return; `>For you<` literal; `grid gap-4 lg:grid-cols-2`; `wishlistGap(owned, wishlist)` call; `lastWornDate` threading
- `src/components/home/SleepingBeautyCard.tsx` — FOUND; `bg-accent text-accent-foreground`; `Never worn` literal branch
- `src/components/home/MostWornThisMonthCard.tsx` — FOUND; "Most worn this month" heading
- `src/components/home/WishlistGapCard.tsx` — FOUND; `bg-accent text-accent-foreground`; null-return guard
- `src/components/home/CommonGroundFollowerCard.tsx` — FOUND; `/u/${username}/common-ground` link
- `src/components/home/SuggestedCollectors.tsx` — FOUND; `id="suggested-collectors"`; `>Collectors to follow<` literal; `nextCursor && (` conditional render
- `src/components/home/SuggestedCollectorRow.tsx` — FOUND; `variant="inline"`; `taste overlap`; `/u/${collector.username}/collection`
- `src/components/home/LoadMoreSuggestionsButton.tsx` — FOUND; `'use client'`; `loadMoreSuggestions({ cursor })`; `Couldn't load more. Tap to retry.`; `cursor !== null &&`
- All 5 test files — FOUND; `npx vitest run` on all five: **34/34 passing** (required: ≥26)
- `npm test` — **2031 passed, 39 skipped** (baseline 1997 + 34 new)
- `npm run build` — **green** across all 20 routes under `cacheComponents: true`
- `npx eslint` on all 15 new files — **0 errors, 5 warnings** (all in test files using `<img>` in stubs; matches existing project pattern)
- Commits `4448838`, `62c7806`, `bc63840`, `6f16c3b`, `509918e`, `29b360c` — ALL FOUND in `git log`

---
*Phase: 10-activity-feed*
*Completed: 2026-04-22*
