---
phase: 14-nav-shell-explore-stub
plan: 07
subsystem: profile-insights-tab
tags: [profile, insights, owner-only, privacy, p-08, d-13, tabs, nav-v3]
requirements: [NAV-11]
dependency_graph:
  requires:
    - "ProfileTabs component (existing)"
    - "getCurrentUser + getProfileById (existing auth/DAL)"
    - "Existing /insights page body (moved verbatim)"
    - "Next.js 16 `redirect()` semantics"
  provides:
    - "Owner-only Insights tab on /u/[username]/insights"
    - "InsightsTabContent reusable Server Component (takes profileUserId prop)"
    - "/insights redirect stub preserving bookmarks + 11 internal links"
  affects:
    - "src/app/u/[username]/layout.tsx (passes isOwner to ProfileTabs)"
    - "src/app/u/[username]/[tab]/page.tsx (new VALID_TABS entry + branch)"
tech-stack:
  added: []
  patterns:
    - "Two-layer privacy (Phase 12 pattern): tab-strip omission + [tab]/page.tsx notFound() gate"
    - "Uniform Letterboxd-style 404 for non-owner and anonymous insights viewers"
    - "Server Component redirect (Next.js 16 Pattern 6)"
    - "Lifted renderer pattern: former /insights page body → reusable component taking explicit owner id"
key-files:
  created:
    - "src/components/profile/InsightsTabContent.tsx"
    - "tests/app/profile-tab-insights.test.tsx"
    - "tests/app/insights-retirement.test.tsx"
  modified:
    - "src/components/profile/ProfileTabs.tsx"
    - "src/app/u/[username]/layout.tsx"
    - "src/app/u/[username]/[tab]/page.tsx"
    - "src/app/insights/page.tsx"
    - "tests/components/profile/ProfileTabs.test.tsx"
decisions:
  - "D-13 (from phase CONTEXT): retire /insights; move content to owner-only profile tab; keep /insights as redirect"
  - "D-15 (from phase CONTEXT): Insights tab coexists with public Stats tab (different audiences)"
  - "P-08 defense: omit tab link for non-owners + notFound() on direct URL access — two layers, either alone suffices"
  - "P-11 defense: no cache directive on /insights retirement page (target is per-request)"
  - "Test assertion style for Server Components: inspect returned React element type/props rather than expecting mocked component function to be called (Server Components return JSX elements without React runtime invoking them in vitest)"
metrics:
  duration: "6 min"
  tasks: 3
  files_created: 3
  files_modified: 5
  completed: 2026-04-23T22:56:30Z
  tests_added: 14
---

# Phase 14 Plan 07: Profile Insights Tab Summary

Retired the top-level `/insights` route and migrated its content into an owner-only **Insights tab** under `/u/[username]/insights`. Non-owners never see the tab exists — two-layer privacy (tab strip omission + `notFound()` direct-URL gate) prevents existence leaks. The `/insights` URL is preserved as a thin redirect to the viewer's own profile Insights tab, keeping all 11 internal bookmarks working via a 307 bounce.

## What Shipped

**ProfileTabs (`src/components/profile/ProfileTabs.tsx`)** — gained an `isOwner?: boolean` prop (default `false`). When `true`, a 6th/7th tab labeled "Insights" is appended after Common Ground. When `false`, the tab is entirely absent from the DOM — no text, no `<a>` element, no `data-tab-id="insights"` marker. Acts as the first layer of the existence-leak defense (P-08). The prop is wired from `src/app/u/[username]/layout.tsx`, which already computed `isOwner` for other consumers.

**InsightsTabContent (`src/components/profile/InsightsTabContent.tsx`)** — new Server Component lifted verbatim from the former `src/app/insights/page.tsx` body. All six helper functions (`observationCopy`, `calculateDistribution`, `calculateSingleValueDistribution`, `computeWearInsights`, `computeCollectionValue`, `formatCurrency`) moved over unchanged; the only swap is `getCurrentUser()` → `profileUserId: string` prop. All DAL calls (`getWatchesByUser`, `getPreferencesByUser`, `getMostRecentWearDates`) now accept the passed id. Header copy, sections (`GoodDealsSection`, `SleepingBeautiesSection`, `BalanceChart` x4, Wear Insights card, Collection Observations card), summary cards, empty state — all byte-identical to the pre-retirement page.

**[tab]/page.tsx (`src/app/u/[username]/[tab]/page.tsx`)** — `VALID_TABS` extended with `'insights'`. New branch placed after the `common-ground` handler and before the collection/wishlist/notes dispatch:

```ts
if (tab === 'insights') {
  if (!isOwner) notFound()
  return <InsightsTabContent profileUserId={profile.id} />
}
```

This is the second layer of the defense. `!isOwner` includes both "authenticated but not the owner" and "anonymous visitor" — the existing layout already resolves `viewerId = null` for unauth, so `isOwner === (viewerId === profile.id)` is `false` for both cases, producing the same uniform 404.

**/insights retirement (`src/app/insights/page.tsx`)** — reduced from ~400 lines to 25. The new body is:

```ts
export default async function InsightsRetirementPage() {
  const user = await getCurrentUser()
  const profile = await getProfileById(user.id)
  redirect(profile?.username ? `/u/${profile.username}/insights` : '/')
}
```

No cache directive (P-11: target is per-request, caching would leak the first caller's username). `redirect()` sits outside any try/catch per Next.js 16 docs (it throws `NEXT_REDIRECT`). The orphaned-user edge case (user row exists, no profile row — rare, but defensible) falls back to `/`.

## Tests

Added **14 tests** across 3 files:

| File | Tests | Purpose |
|------|-------|---------|
| `tests/components/profile/ProfileTabs.test.tsx` | 7 | Full isOwner × showCommonGround matrix; P-08 existence-leak (Test 5); default value |
| `tests/app/profile-tab-insights.test.tsx` | 4 | Owner success, non-owner 404, anonymous 404, regression smoke on collection branch |
| `tests/app/insights-retirement.test.tsx` | 3 | Redirect to /u/{username}/insights; fallback to /; P-11 static check (no `'use cache'`) |

Full suite: **2273 passed / 0 failed / 119 skipped** (skips are pre-existing integration tests that gate on local Supabase env vars). Build: green.

## Deviations from Plan

### Adjustments During Execution

**1. Test assertion style — Server Component JSX (not a deviation rule, but worth logging)**
- **Found during:** Task 2 RED→GREEN cycle
- **Issue:** The plan skeleton asserted `expect(InsightsTabContent).toHaveBeenCalledWith({ profileUserId: 'user-1' }, ...)` — but `await ProfileTabPage({ params })` returns a React element created via `React.createElement(InsightsTabContent, { profileUserId })`. vitest doesn't run a React renderer, so the mocked component function is never invoked.
- **Fix:** Rewrote the assertion to inspect the returned React element directly: `expect(result.type).toBe(InsightsTabContent)` and `expect(result.props).toEqual({ profileUserId: 'user-1' })`. This is the correct contract for Server Component branch-selection tests — the test proves the owner branch picks the right component with the right props, which is what the plan intended to verify.
- **Files modified:** `tests/app/profile-tab-insights.test.tsx`
- **Commit:** 3625c19

**2. Self-inflicted `'use cache'` literal in comment (Rule 1 — bug)**
- **Found during:** Task 3 GREEN
- **Issue:** The plan-suggested comment in `src/app/insights/page.tsx` contained the literal text `` `'use cache'` `` (as in "No `'use cache'` — redirect target is per-request"). My P-11 test grep-scans the file content for the string `'use cache'` and therefore failed.
- **Fix:** Rephrased the comment to "No cache directive (P-11) — …" so the compiler-visible string is absent while the guidance remains.
- **Files modified:** `src/app/insights/page.tsx`
- **Commit:** 26a27ea

**3. Test TS type mismatch on null profile mock (Rule 1 — bug)**
- **Found during:** Task 3 build verification
- **Issue:** `getProfileById` has a non-nullable inferred return type from Drizzle. `vi.mocked(getProfileById).mockResolvedValue(null)` failed `tsc --noEmit`.
- **Fix:** Cast to `as any` (same pattern the plan used elsewhere for Drizzle row mocks).
- **Files modified:** `tests/app/insights-retirement.test.tsx`
- **Commit:** 26a27ea

### Plan Acceptance-Criteria Observations

One plan check stated `grep -c "isOwner={isOwner}" src/app/u/[username]/layout.tsx` should return **1**. Actual return is **2**: the layout already passed `isOwner` to `<ProfileHeader>` before this plan started (line 119). The new `<ProfileTabs isOwner={isOwner}>` (line 140) is one additional occurrence. This is the expected outcome — the criterion was counted against the pre-existing state. Task 1 acceptance is met: the ProfileTabs line was added.

### Authentication Gates

None. All work was local code changes.

## Threat Model Status

All threats listed in the plan's `<threat_model>` are mitigated as planned:

- **T-14-07-01 (Information Disclosure — existence leak):** Tests 5 (ProfileTabs) and 2–3 (profile-tab-insights) lock the two-layer defense. DOM scan confirms no Insights text or `/insights` link leaks when `isOwner=false`.
- **T-14-07-02 (Information Disclosure — Insights data to non-owner):** `InsightsTabContent` is only reachable when `isOwner=true` per the [tab]/page.tsx branch, verified by Test 2.
- **T-14-07-03 (Open Redirect):** Target URL interpolated from `getProfileById(user.id).username` — DB value, not user input. No tampering vector.
- **T-14-07-04 (Availability — breaking internal /insights links):** Accepted per RESEARCH Open Question #1; 307 bounce handles the 11 callers.
- **T-14-07-05 (Side-channel timing leak):** Accepted; `notFound()` used uniformly matches the `common-ground` empty-overlap branch.

No new threat surfaces introduced (see Threat Flags below).

## Threat Flags

None. All added surface (Insights tab, InsightsTabContent, /insights redirect) is already covered by the plan's threat register.

## Self-Check: PASSED

- [x] `src/components/profile/InsightsTabContent.tsx` exists (FOUND)
- [x] `src/components/profile/ProfileTabs.tsx` modified (isOwner prop present)
- [x] `src/app/u/[username]/layout.tsx` modified (ProfileTabs isOwner wired)
- [x] `src/app/u/[username]/[tab]/page.tsx` modified (insights branch + VALID_TABS)
- [x] `src/app/insights/page.tsx` rewritten (25 lines, redirect only)
- [x] `tests/components/profile/ProfileTabs.test.tsx` passes 7/7
- [x] `tests/app/profile-tab-insights.test.tsx` passes 4/4
- [x] `tests/app/insights-retirement.test.tsx` passes 3/3
- [x] Full suite passes 2273/2273 (119 skipped = pre-existing env-gated integrations)
- [x] `npm run build` exits 0
- [x] `npx tsc --noEmit` exits 0
- [x] Commits present:
  - 235fd05 test(14-07): ProfileTabs RED
  - 9c65fc0 feat(14-07): ProfileTabs GREEN
  - fc6905e test(14-07): [tab]/page RED
  - 3625c19 feat(14-07): InsightsTabContent + [tab]/page GREEN
  - fa9bf3f test(14-07): /insights retirement RED
  - 26a27ea feat(14-07): /insights retirement GREEN
