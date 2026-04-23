---
phase: 14-nav-shell-explore-stub
reviewed: 2026-04-23T23:17:51Z
depth: standard
files_reviewed: 39
files_reviewed_list:
  - src/app/explore/page.tsx
  - src/app/insights/page.tsx
  - src/app/layout.tsx
  - src/app/search/page.tsx
  - src/app/u/[username]/[tab]/page.tsx
  - src/app/u/[username]/layout.tsx
  - src/components/layout/BottomNav.tsx
  - src/components/layout/BottomNavServer.tsx
  - src/components/layout/DesktopTopNav.tsx
  - src/components/layout/Header.tsx
  - src/components/layout/HeaderNav.tsx
  - src/components/layout/HeaderSkeleton.tsx
  - src/components/layout/InlineThemeSegmented.tsx
  - src/components/layout/NavWearButton.tsx
  - src/components/layout/SlimTopNav.tsx
  - src/components/layout/UserMenu.tsx
  - src/components/profile/InsightsTabContent.tsx
  - src/components/profile/ProfileTabs.tsx
  - src/components/settings/SettingsClient.tsx
  - src/lib/constants/public-paths.ts
  - src/proxy.ts
  - tests/app/explore.test.tsx
  - tests/app/insights-retirement.test.tsx
  - tests/app/layout.test.tsx
  - tests/app/profile-tab-insights.test.tsx
  - tests/app/search.test.tsx
  - tests/components/layout/BottomNav.test.tsx
  - tests/components/layout/DesktopTopNav.test.tsx
  - tests/components/layout/Header.bell-placement.test.tsx
  - tests/components/layout/HeaderNav.test.tsx
  - tests/components/layout/InlineThemeSegmented.test.tsx
  - tests/components/layout/NavWearButton.test.tsx
  - tests/components/layout/SlimTopNav.test.tsx
  - tests/components/layout/UserMenu.test.tsx
  - tests/components/preferences/PreferencesClient.debt01.test.tsx
  - tests/components/profile/ProfileTabs.test.tsx
  - tests/components/settings/SettingsClient.test.tsx
  - tests/lib/mobile-nav-absence.test.ts
  - tests/lib/public-paths.test.ts
  - tests/proxy.test.ts
findings:
  critical: 0
  warning: 3
  info: 5
  total: 8
status: findings
---

# Phase 14: Code Review Report

**Reviewed:** 2026-04-23T23:17:51Z
**Depth:** standard
**Files Reviewed:** 39
**Status:** findings

## Summary

Phase 14 (nav-shell-explore-stub) adds a new nav surface (slim top + bottom-nav on
mobile, desktop top nav at md+), stubs the `/explore` and `/search` routes, and
retires the standalone `/insights` route (content moved to an owner-only
`/u/{me}/insights` profile tab).

Code quality is generally high: privacy gates are defensive (two-layer in
`ProfileTabs` + `[tab]/page.tsx`), the `NotificationBell` shared-element pattern
(P-06) is well-documented and tested, and `PUBLIC_PATHS` is a single source of
truth consumed by both the proxy and three client nav surfaces. Comments
consistently reference plan IDs, decision IDs, and research pitfalls, making the
surface easy to audit.

No critical security, correctness, or privacy bugs were found. Three warnings
cover (a) full-page navigation in the desktop search form that undoes the SPA
context, (b) an unguarded DAL call in `InsightsTabContent` that can throw past
the page boundary on connection failure, and (c) a prefix-match edge case in
`BottomNav` profile-active resolution. Info items are style/consistency nits.

## Warnings

### WR-01: Desktop search form uses `window.location.href` instead of Next router

**File:** `src/components/layout/DesktopTopNav.tsx:47-56`
**Issue:** The search form's `onSubmit` handler assigns to `window.location.href`,
triggering a full-page reload. The header is on every authenticated route, so
each search kicks the user out of the SPA: scroll position is lost, cached data
refetches, and the bundle re-hydrates. This also re-runs the proxy and the root
layout, doubling the cost of a simple search submit. `Link`-based navigation is
already used elsewhere in this file; the search form should use `useRouter`.
**Fix:**
```tsx
import { useRouter } from 'next/navigation'
// ...
export function DesktopTopNav({ user, username, ownedWatches, bell }: DesktopTopNavProps) {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  if (isPublicPath(pathname)) return null

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const q = String(fd.get('q') ?? '').trim()
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : '/search')
  }
  // ...
}
```

### WR-02: `getPreferencesByUser` call in `InsightsTabContent` is not guarded

**File:** `src/components/profile/InsightsTabContent.tsx:145-148`
**Issue:** `Promise.all([getWatchesByUser(...), getPreferencesByUser(...)])` has
no `.catch()` fallback. The equivalent stats branch in `[tab]/page.tsx:228` uses
`getPreferencesByUser(profile.id).catch(() => null)` precisely because the DAL
throws on connection/query errors (the "no rows" case is handled inside the DAL
by returning defaults, but infra failures still bubble up). If the DB is
unreachable, the entire owner-only Insights tab renders a server error instead of
degrading to the `balanced` default goal. For consistency with stats and for
better failure UX, wrap the preferences call.
**Fix:**
```tsx
const [watches, preferences] = await Promise.all([
  getWatchesByUser(profileUserId),
  getPreferencesByUser(profileUserId).catch(() => ({
    collectionGoal: null,
  } as Partial<UserPreferences>)),
])
```
(Adjust type to the same shape the stats branch uses — returning `null` and
letting `preferences?.collectionGoal ?? 'balanced'` resolve works too.)

### WR-03: `BottomNav` profile-active match allows prefix collisions

**File:** `src/components/layout/BottomNav.tsx:94`
**Issue:** `isProfile = pathname.startsWith(\`/u/${username}\`)` returns true for
any path that begins with the username string, including other users whose
username starts with the viewer's. If the viewer is `alice` and visits
`/u/alicewhatever/collection` (a different user's profile), the Profile tab
lights up incorrectly. Usernames starting with each other are plausible (`ty`
vs `tyler`), so this is a real edge case. The desktop `HeaderNav.tsx:33` has
the same issue. Anchor the match with a trailing `/` or equality.
**Fix:**
```tsx
const isProfile =
  pathname === `/u/${username}` ||
  pathname.startsWith(`/u/${username}/`)
```
Apply the same pattern to `HeaderNav.tsx:33`:
```tsx
isActive: (p) => p === `/u/${username}` || p.startsWith(`/u/${username}/`),
```

## Info

### IN-01: `getCurrentUser()` in `/insights` retirement is unguarded

**File:** `src/app/insights/page.tsx:22-24`
**Issue:** `getCurrentUser()` throws `UnauthorizedError` when unauth. The proxy
(`src/proxy.ts`) redirects unauth users to `/login` before reaching this route,
so this works today. However, if the proxy matcher ever excludes this path (or
the route is fetched via a path that bypasses the matcher), the page would 500
instead of redirecting. The twin route `[tab]/page.tsx:57-62` wraps the call in
try/catch for exactly this reason. Defense-in-depth: either wrap here too, or
add a comment explaining the dependency on the proxy gate.
**Fix:** Either
```tsx
try {
  const user = await getCurrentUser()
  const profile = await getProfileById(user.id)
  redirect(profile?.username ? `/u/${profile.username}/insights` : '/')
} catch (err) {
  if (err instanceof UnauthorizedError) redirect('/login?next=/insights')
  throw err
}
```
or acknowledge the proxy dependency with a comment + test.

### IN-02: Redundant `?? ''` after `String.prototype.split`

**File:** `src/components/layout/UserMenu.tsx:31`
**Issue:** `const local = user.email.split('@')[0] ?? ''` — `String.split` with
any separator always returns an array with at least one element, so index `[0]`
is never `undefined`. The `?? ''` is dead. Replace with a plain access or use
the fallback only for the empty-string case via `|| 'U'` (which is already on
the next line). Not a bug — just a noise trim.
**Fix:**
```tsx
const local = user.email.split('@')[0]
const initials = local.slice(0, 2).toUpperCase() || 'U'
```

### IN-03: `InsightsTabContent` uses `||` where `??` is more precise for prices

**File:** `src/components/profile/InsightsTabContent.tsx:112-120`
**Issue:** `sum + (w.pricePaid || 0)` and `w.pricePaid && w.marketPrice` treat
`0` as "missing". If a user records a price of `0` for an inherited or gifted
watch, these reductions skip it (for the sum, `0 || 0 = 0` so neutral; for the
`watchesWithPriceData` count, a zero-priced watch is excluded). Either document
that `0` is a sentinel for "unknown" or migrate to `??` + explicit null checks.
The `styleDistribution[0]?.percentage || 0` on line 372 has the same character:
if percentage is `0` (no matching watches), render `0` — currently renders `0`,
so functionally correct but `??` is more intention-revealing.
**Fix:**
```tsx
const totalPaid = ownedWatches.reduce(
  (sum, w) => sum + (w.pricePaid ?? 0),
  0,
)
// ...
const watchesWithBothPrices = ownedWatches.filter(
  (w) => w.pricePaid != null && w.marketPrice != null,
)
```

### IN-04: `ProfileTabs` active-tab resolution depends on path suffix

**File:** `src/components/profile/ProfileTabs.tsx:58-59`
**Issue:** `pathname.endsWith(\`/${t.id}\`)` breaks if Next.js ever passes a
trailing slash (e.g. `/u/alice/collection/` from config or a static redirect).
Today `usePathname()` returns a normalized pathname without trailing slash, so
this is a latent brittleness rather than an active bug. Either assert the last
segment, or split on `/` and read `segments.at(-1)`.
**Fix:**
```tsx
const lastSegment = pathname.split('/').filter(Boolean).at(-1) ?? ''
const activeTab = tabs.find((t) => t.id === lastSegment)?.id ?? 'collection'
```

### IN-05: `InsightsTabContent` reads DB before empty-collection early exit

**File:** `src/components/profile/InsightsTabContent.tsx:145-203`
**Issue:** The DB reads (`getWatchesByUser`, `getPreferencesByUser`,
`getMostRecentWearDates`) and all distribution calculations run before the
`watches.length === 0` check at line 190. A new user with zero watches pays for
three round-trips to render a static empty state. Low-priority because `<500`
watches/user is the target scale and the empty case is short-lived (the user
adds a watch within minutes), but a short-circuit after the first fetch saves
two queries on cold accounts.
**Fix:** Check `watches.length === 0` immediately after the first `getWatchesByUser`
and return the empty-state JSX before computing anything else.

---

_Reviewed: 2026-04-23T23:17:51Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
