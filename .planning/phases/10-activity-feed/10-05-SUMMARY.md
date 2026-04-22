---
phase: 10-activity-feed
plan: 05
subsystem: network-activity-ui
tags: [react-server-components, client-component, next-link, lucide-react, testing-library, tdd, keyset-pagination, ui-spec]

# Dependency graph
requires:
  - plan: 10-02
    provides: |
      getFeedForUser(viewerId, cursor, limit) DAL + aggregateFeed(rows) pure
      function + loadMoreFeed Server Action + RawFeedRow/AggregatedRow/FeedCursor types
provides:
  - "NetworkActivityFeed — Server Component rendering the Network Activity section with page-1 SSR + aggregation + conditional LoadMoreButton"
  - "ActivityRow — pure renderer for RawFeedRow with F-01 composition, F-02 flat verbs, F-03 dual link targets (profile + watch), imageUrl-null fallback"
  - "AggregatedActivityRow — pure renderer for F-08 aggregated groups with '{user} {verb} {N} watches' line 1 template"
  - "LoadMoreButton — 'use client' keyset-pagination driver wired to loadMoreFeed; idle / loading / error / retry states"
  - "FeedEmptyState — zero-follows/zero-rows CTA block anchored to #suggested-collectors"
affects: [10-06, 10-07, 10-08, 10-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server Component composing DAL + pure aggregator + Server-rendered rows + mounted client island for page-2+ pagination (mirrors the Next 16 App Router idiom of hosting interactivity at the leaf, not the root)"
    - "Full-row Link overlay via `absolute inset-0` — captures F-03 profile navigation without a wrapping <Link> that would swallow nested watch-name clicks. Nested watch-name link uses `relative z-10` to escape the overlay."
    - "useTransition + useState + useState + useState pattern for compound client state (cursor + appendedRows + error + pending) — rolls back atomically on Server Action failure. Mirrors Phase 9 FollowButton per CONTEXT.md D-06."

key-files:
  created:
    - src/components/home/ActivityRow.tsx
    - src/components/home/AggregatedActivityRow.tsx
    - src/components/home/NetworkActivityFeed.tsx
    - src/components/home/FeedEmptyState.tsx
    - src/components/home/LoadMoreButton.tsx
    - tests/components/home/ActivityRow.test.tsx
    - tests/components/home/AggregatedActivityRow.test.tsx
    - tests/components/home/NetworkActivityFeed.test.tsx
    - tests/components/home/LoadMoreButton.test.tsx
  modified: []

key-decisions:
  - "Aggregated wishlist rows emit 'wishlisted {N} watches' (symmetric with 'added {N} watches' from UI-SPEC § Verbs). UI-SPEC only documented the added variant; for F-08 symmetry and because wishlist_added is a legitimate aggregatable type per feedTypes.ts, the planner note in the plan was followed. Reviewer may adjust this string in isolation — it's the only copy not found in the UI-SPEC table verbatim."
  - "Adapted AvatarDisplay invocation to the project's existing prop signature (avatarUrl/displayName/username/size) instead of the plan's pseudocode (src/username/size). Semantics match: size={40} → size-10 (40px) per AvatarDisplay's internal dimensionClass map."
  - "Full-row Link overlay pattern (`absolute inset-0` + nested `relative z-10` for the watch-name link) was chosen over a wrapping <Link> + stopPropagation to keep the row pure Server Component — wrapping <Link> would work but nested clickable elements inside one <Link> are invalid HTML."
  - "Routed thumbnails through `getSafeImageUrl` (shared Phase 1 helper) before handing to `next/image` — the metadata.imageUrl in activities JSONB is user-supplied (from Phase 7 watch URL imports), so the same https-upgrade / protocol guard applies. This is a Rule 2 correctness addition not in the plan but consistent with project-wide SSRF hardening (mitigates T-10-05-02 and T-10-05-05 at the row level)."
  - "LoadMoreButton was shipped in two commits: Task 2 lands a null-returning stub so NetworkActivityFeed can compile in isolation; Task 3 replaces the stub with the full keyset-pagination implementation. Keeps per-task commits atomic and each task's tests self-contained."

patterns-established:
  - "Feed row components in src/components/home/ always accept a single `row` prop of their discriminated-union variant (RawFeedRow or AggregatedRow) — no viewerId, no callbacks. The Server Component parent owns all data orchestration."
  - "Client islands in the feed (LoadMoreButton) render appended rows inline using the SAME pure renderers the server uses for page 1. Prevents visual drift between initial SSR paint and subsequent client appends."

requirements-completed: [FEED-01, FEED-02, FEED-03, FEED-04]

# Metrics
duration: ~15 min
completed: 2026-04-22
---

# Phase 10 Plan 05: Network Activity UI Summary

**Shipped the Network Activity section of the 5-section home: a Server Component that runs the Plan 02 DAL + pure aggregator and hands rows to three leaf renderers (ActivityRow, AggregatedActivityRow, FeedEmptyState), plus a 'use client' LoadMoreButton that calls `loadMoreFeed` with keyset-safe pagination and renders page-2+ rows inline via the same pure renderers — 29 behavioral tests green (10 + 6 + 7 + 6).**

## Performance

- **Duration:** ~15 min (single session)
- **Started:** 2026-04-22T00:04:44Z
- **Completed:** 2026-04-22T00:10:34Z
- **Tasks:** 3 (all TDD: RED test commit → GREEN implementation commit)
- **Files created:** 9 (5 components, 4 test files)
- **Files modified:** 0
- **Commits:** 6 task commits + this metadata commit

## Accomplishments

- **ActivityRow** at `src/components/home/ActivityRow.tsx` — F-01 composition (avatar LEFT, `{user} {verb} {watch}` on line 1, timeAgo on line 2, thumbnail RIGHT) with F-02 flat verbs (`wore` / `added` / `wishlisted`), F-03 dual link targets (full-row overlay → `/u/{username}/collection`, nested watch-name link → `/watch/{watchId}`), post-delete fallback (watchId=null renders plain span), and imageUrl-null fallback via lucide Watch icon over `bg-muted`. 10 tests pin every behavior.

- **AggregatedActivityRow** at `src/components/home/AggregatedActivityRow.tsx` — F-08 display layer for collapsed groups. Line 1: `{user} {verb} {count} watches` with username and count in `font-semibold`. Line 2: `timeAgo(firstCreatedAt)` — explicitly the most-recent row in the group, NOT `lastCreatedAt`. Single row-level link to the collector profile; no nested watch link (aggregated groups have no single watch target). aria-label follows the UI-SPEC § Accessibility pattern: `{user} {verb} {N} watches. {timeAgo}. View profile.` 6 tests.

- **NetworkActivityFeed** at `src/components/home/NetworkActivityFeed.tsx` — async Server Component wrapping `<section id="network-activity">`. Calls `getFeedForUser(viewerId, null, 20)`, runs `aggregateFeed`, branches on `row.kind` per row, and conditionally mounts `<LoadMoreButton>` when `page.nextCursor !== null`. Empty-state gate (`rows.length === 0 && nextCursor === null`) swaps in `<FeedEmptyState />`. Section heading: literal `<h2>Network activity</h2>` with `text-xl font-semibold leading-tight` per UI-SPEC § Typography § Heading tier. 7 tests.

- **FeedEmptyState** at `src/components/home/FeedEmptyState.tsx` — locked UI-SPEC copy: heading `Your feed is quiet` (`font-serif text-3xl` Display tier), body `Follow collectors to see what they're wearing, adding, and wishlisting.`, and CTA anchor `<Link href="#suggested-collectors">Find collectors to follow</Link>` styled as a neutral primary button. Covered by the empty-branch NetworkActivityFeed test.

- **LoadMoreButton** at `src/components/home/LoadMoreButton.tsx` — `'use client'` (line 1). `useTransition` + four pieces of `useState` (`cursor`, `appendedRows`, `pending`, `error`) drive a clean state machine: idle → pending → success-append-or-error → back-to-idle-or-retry. Error copy is locked: `Couldn't load more. Tap to retry.` Spinner is lucide `Loader2` with `animate-spin text-accent`. Renders appended rows INLINE via the same `ActivityRow` / `AggregatedActivityRow` pure renderers — no visual drift between SSR page-1 and client page-2+. Unmounts cleanly when `cursor` becomes null. 6 tests.

## Task Commits

1. **Task 1 RED** — failing tests for ActivityRow + AggregatedActivityRow — `0bbf238` (test)
2. **Task 1 GREEN** — ActivityRow + AggregatedActivityRow implementations — `d209fdb` (feat)
3. **Task 2 RED** — failing tests for NetworkActivityFeed + FeedEmptyState — `95fc232` (test)
4. **Task 2 GREEN** — NetworkActivityFeed + FeedEmptyState (LoadMoreButton stub) — `e5cac04` (feat)
5. **Task 3 RED** — failing tests for LoadMoreButton — `87b856e` (test)
6. **Task 3 GREEN** — full LoadMoreButton implementation — `2ff6972` (feat)

Plan metadata commit is made after this SUMMARY is written (bundles SUMMARY.md + STATE.md + ROADMAP.md).

## Files Created/Modified

- `src/components/home/ActivityRow.tsx` — new, 79 lines
- `src/components/home/AggregatedActivityRow.tsx` — new, 65 lines
- `src/components/home/NetworkActivityFeed.tsx` — new, 58 lines
- `src/components/home/FeedEmptyState.tsx` — new, 26 lines
- `src/components/home/LoadMoreButton.tsx` — new, 93 lines
- `tests/components/home/ActivityRow.test.tsx` — new, 10 tests
- `tests/components/home/AggregatedActivityRow.test.tsx` — new, 6 tests
- `tests/components/home/NetworkActivityFeed.test.tsx` — new, 7 tests
- `tests/components/home/LoadMoreButton.test.tsx` — new, 6 tests

## Aggregated-Row Verb Decision (planner note)

The plan body flagged this: UI-SPEC § Verbs explicitly lists only `added {N} watches` for F-08. The plan's Task 1 Test 12 asks for `wishlisted {N} watches` under the same pattern. Rationale:

- `wishlist_added` is a fully supported type in `AggregatedRow['type']` (see `src/lib/feedTypes.ts` L55) — the aggregator will emit wishlist aggregations.
- Rendering an aggregation with no verb (or falling back to `added`) would mislabel the activity.
- Symmetric `wishlisted {N} watches` matches the singular row's `wishlisted X` and reads consistently with the `added {N} watches` variant.

Implementation: `AGG_VERBS: Record<AggregatedRow['type'], string>` at the top of `AggregatedActivityRow.tsx` with entries `watch_added: 'added'` and `wishlist_added: 'wishlisted'`. The reviewer can flip this to `'added'` in a single-line change without touching tests (Test 12 would be the only failure) if the UI-SPEC author prefers the asymmetric form.

## UI-SPEC Deviations (intentional)

1. **`<section>` instead of `<h2>` alone for "Network activity".** UI-SPEC § Component Inventory describes the heading but not the wrapping element explicitly. Wrapped in `<section id="network-activity">` so future Plans 07–09 can anchor-link cleanly (Plan 08 home shell + FeedEmptyState's `#suggested-collectors` anchor are already coupled via same-page-anchor navigation per CONTEXT.md L-02).

2. **Thumbnail `size-6` lucide icon inside `size-12` thumbnail slot.** UI-SPEC § Spacing specifies the thumbnail slot dimensions (48 / 56px) but doesn't pin the fallback icon size. Using `size-6 text-muted-foreground/60` keeps the icon visually quiet (doesn't compete with the surrounding image row aesthetic) and matches the `ProfileWatchCard` fallback tone.

3. **Appended rows in LoadMoreButton render INLINE inside the component body, not as siblings of the main feed list.** Contract: NetworkActivityFeed renders page 1 + LoadMoreButton; LoadMoreButton renders its own appendedRows ABOVE the button in DOM order. This is a React Fragment pattern — semantically equivalent to "rows then button" but constrains the pagination state to live inside the client island. No visual difference. Mentioned here for the verifier.

## Keyset Pagination End-to-End Confirmation

Confirmed via Test 3 and Test 4 in `LoadMoreButton.test.tsx`:

- **Test 3 (append + unmount):** Click with `nextCursor: null` returned from Server Action → appended row renders in-DOM, button unmounts. `screen.queryByRole('button')` returns null.
- **Test 4 (append + stay mounted):** Click with `nextCursor` non-null → appended row renders, button stays mounted with the new cursor staged in state. Second click would call `loadMoreFeed({ cursor: newCursor })`.

Cursor flow verified: `initialCursor` (from Server Component SSR) → click → `loadMoreFeed({ cursor: initialCursor })` → `result.data.nextCursor` → `setCursor(nextCursor)` → (conditionally) button unmounts OR next click uses the new cursor. No cursor reuse, no off-by-one.

## Decisions Made

- **Two-commit shipping of LoadMoreButton.** Task 2 (NetworkActivityFeed) imports `@/components/home/LoadMoreButton` — but Task 3 creates the full component. To keep task commits atomic (each task: RED test, then GREEN implementation), Task 2's GREEN commit lands a minimal stub that returns `null` but exports the correct type signature. Task 3's GREEN commit overwrites the stub with the full client component. Rationale: bundling Task 3's full implementation into Task 2 would violate TDD commit cadence and make the per-task test suites non-self-contained. Tests import through `vi.mock('@/components/home/LoadMoreButton', ...)` in Task 2 anyway, so the stub is functionally invisible in test.

- **Full-row Link overlay pattern (F-03).** Chose `absolute inset-0` profile link + nested `relative z-10` watch-name link over wrapping the entire row in a <Link>. Wrapping <Link> would require nested clickable children — invalid HTML (<a> inside <a>). The overlay + z-10 escape pattern is the canonical React Twitter-style feed-row approach and renders correctly in both Server Components and hydrated client islands.

- **AvatarDisplay adapter.** The plan pseudocode used `<AvatarDisplay src={row.avatarUrl} username={row.username} size={40} />`, but the project's existing `AvatarDisplay` component takes `avatarUrl`, `displayName`, `username`, `size`. Rule 3 (blocking issue) — adapted to the existing signature. Zero-behavior-change: `size={40}` still resolves to `size-10` via the component's internal `dimensionClass` switch, and `displayName` is passed through from `RawFeedRow.displayName` which the DAL already populates.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] AvatarDisplay prop-name mismatch**

- **Found during:** Task 1 implementation.
- **Issue:** Plan's pseudocode used `<AvatarDisplay src={row.avatarUrl} username={row.username} size={40} />`. The existing component signature (verified via Read of `src/components/profile/AvatarDisplay.tsx`) is `{ avatarUrl, displayName, username, size? }`. Using the plan's props would fail TypeScript compile.
- **Fix:** Passed `avatarUrl={row.avatarUrl}`, `displayName={row.displayName}`, `username={row.username}`, `size={40}` — matches the existing component contract. `RawFeedRow` and `AggregatedRow` both carry `displayName: string | null` already (Phase 10 Plan 01 added it).
- **Files modified:** `src/components/home/ActivityRow.tsx`, `src/components/home/AggregatedActivityRow.tsx`
- **Verification:** Build green; 16 Task 1 tests pass.

**2. [Rule 2 - Critical functionality] Image URL SSRF-hardened before next/image**

- **Found during:** Task 1 implementation, cross-checking against `ProfileWatchCard` (Phase 8) which routes all image URLs through `getSafeImageUrl`.
- **Issue:** The plan's pseudocode passed `row.metadata.imageUrl` directly to `<Image src={...}>`. Activities metadata.imageUrl is user-supplied (from Phase 7 watch-URL imports) and may be http:// or a malformed URL. `next/image` with `unoptimized` bypasses server-side SSRF, but browser-level mixed-content rules and malformed-URL crashes still apply.
- **Fix:** Route all thumbnail URLs through `getSafeImageUrl` (Phase 1 shared helper) — upgrades http→https, rejects non-http(s) schemes, returns null on parse failure. Fallback to the lucide Watch icon when `getSafeImageUrl` returns null. Aligns with project-wide image hardening (mitigates T-10-05-05 at the component level, even though the plan marked it `accept`).
- **Files modified:** `src/components/home/ActivityRow.tsx`, `src/components/home/AggregatedActivityRow.tsx`
- **Verification:** Test 8 (imageUrl null fallback) remained correct without modification; the getSafeImageUrl branch absorbs invalid URLs the same way.

**Total deviations:** 2 auto-fixed (Rule 3 - Blocking: prop mismatch; Rule 2 - Critical: image hardening). No architectural decisions needed. No CLAUDE.md-driven adjustments.

**Impact on plan:** None on plan scope. All three tasks delivered the components per F-01/F-02/F-03/F-08/F-04 rules with all 29 tests green.

## Issues Encountered

- **None blocking.** Pre-existing lint errors in unrelated test files (70 errors across `tests/actions/*`, `tests/data/isolation.test.ts`, `tests/proxy.test.ts`, plus one unused-var warning in `src/lib/similarity.ts`) carry over from prior phases — logged by Plan 10-02's SUMMARY; still out of scope per the scope-boundary rule.

## User Setup Required

None. Plan 10-05 is purely a UI build — no env vars, no migrations, no new dependencies.

## Next Phase Readiness

- **Plan 06 (WYWT rail)** can sit above this section in the home shell. Independent scope.
- **Plan 07 (Collectors Like You + Personal Insights + Suggested Collectors)** can sit below this section. The `#suggested-collectors` anchor that `FeedEmptyState` points to MUST be the section id on the Suggested Collectors wrapper in Plan 07.
- **Plan 08 (home page assembly)** imports `NetworkActivityFeed` and passes `viewerId` (from `getCurrentUser()` at the page level). Empty-auth gate at the page level (not in the component) — this component assumes a valid `viewerId`.
- **Plan 09 (e2e)** already has the component signature locked via Plan 02's Summary table and can test the full feed-rendering path.

No blockers for the rest of Phase 10.

## Self-Check: PASSED

Verified via shell checks:

- `src/components/home/ActivityRow.tsx` — FOUND; VERBS map with 'added', 'wishlisted', 'wore'; profile href `/u/${row.username}/collection`; watch href `/watch/${row.watchId}`; `font-semibold` username span; `absolute inset-0` overlay; `getSafeImageUrl` guard
- `src/components/home/AggregatedActivityRow.tsx` — FOUND; `timeAgo(row.firstCreatedAt)` (not lastCreatedAt); `font-semibold` on username and count; `watches` literal in template
- `src/components/home/NetworkActivityFeed.tsx` — FOUND; `getFeedForUser(viewerId, null, 20)`; `aggregateFeed(page.rows)`; branches on `row.kind`; conditional `<LoadMoreButton>`; `id="network-activity"`; literal `Network activity` h2
- `src/components/home/FeedEmptyState.tsx` — FOUND; `Your feed is quiet` heading; `href="#suggested-collectors"` CTA; `Find collectors to follow` button text
- `src/components/home/LoadMoreButton.tsx` — FOUND; `'use client'` line 1; `useTransition`; `loadMoreFeed({ cursor })`; `Couldn't load more. Tap to retry.` error copy; `animate-spin` spinner; `variant="outline"`; `appendedRows.map` inline render
- Commits `0bbf238`, `d209fdb`, `95fc232`, `e5cac04`, `87b856e`, `2ff6972` — ALL FOUND in `git log`
- `npm test` — 1710 passing, 39 skipped (0 regressions vs Plan 10-04)
- `npm run build` — green
- `npm run lint` on Plan 10-05 files only — zero errors/warnings

---
*Phase: 10-activity-feed*
*Completed: 2026-04-22*
