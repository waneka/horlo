---
phase: 51-profile-route-ppr-opt-out-recurrence-3-fix
reviewed: 2026-05-20T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - tests/profile-route-51.test.ts
  - scripts/verify-phase-51-prod.sh
  - scripts/assert-phase-51-build.mjs
  - src/app/u/[username]/profile-gate.tsx
  - src/app/u/[username]/layout.tsx
  - src/app/u/[username]/[tab]/page.tsx
  - tests/app/profile-tab-insights.test.tsx
  - src/lib/supabase/proxy.ts
  - next.config.ts
  - src/proxy.ts
  - src/lib/constants/public-paths.ts
  - tests/proxy.test.ts
findings:
  critical: 2
  warning: 6
  info: 3
  total: 11
status: issues_found
---

# Phase 51: Code Review Report

**Reviewed:** 2026-05-20
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Phase 51 restructures the `/u/[username]/[tab]` route to opt out of Cache Components PPR
(recurrence-3 fix). The structural intent — moving the runtime-API consumer
(`getCurrentUser()`) from layout to page, accepting `viewerId` as a prop in `ProfileGate`,
moving the cookie boundary onto the page, and re-gating `/u/*` at the proxy with
`Cache-Control: no-store` on the redirect — is sound and the regression-contract tests
(`tests/profile-route-51.test.ts`, `tests/proxy.test.ts` Phase 51 block,
`scripts/assert-phase-51-build.mjs`, `scripts/verify-phase-51-prod.sh`) provide good
defense-in-depth coverage.

However, two BLOCKER-class issues need attention before this ships:

1. **Factually wrong invariant comment in `src/lib/supabase/proxy.ts`** — the code now
   relies on `getSession()` for the proxy gate, but the comment claims `getSession()`
   "reads the JWT from cookies and decrypts locally — no network — so it cannot fail
   transiently." This is false. `@supabase/auth-js`'s `getSession()` triggers a
   `_callRefreshToken` network round-trip when the access token is near expiry
   (`GoTrueClient.js:2358`). The Branch B safety claim in the comment overstates the
   guarantee, and any reviewer accepting the file at face value will be misled about the
   recurrence-2 vector that this commit was supposed to close.
2. **Silent `insecure user` warnings will spam server logs** — `getSession()` wraps
   `session.user` in `insecureUserWarningProxy` on the server. The first property access
   logs a `console.warn`. `src/proxy.ts:29` reads `user?.id`, triggering the warning on
   every authenticated dev-mode request. In production it fires once per cold start, but
   any downstream consumer of the returned `user` (none today, but the surface is
   exported) will trip it. This is a code-smell that suggests the proxy gate should be
   reading the session token directly, not handing back a `User` proxy.

Plus six warnings (mostly around the redundant-work pattern in `[tab]/page.tsx`,
test/reality drift, build script fail-open behavior, and one missing test assertion) and
three info items.

## Critical Issues

### CR-01: Comment in `proxy.ts` falsely claims `getSession()` is network-free

**File:** `src/lib/supabase/proxy.ts:34-41`
**Issue:** The phase rationale documented in the comment says:

> getSession() reads the JWT from cookies and decrypts locally — no network — so it
> cannot fail transiently.

This is factually incorrect. In `@supabase/auth-js@2.x` (the version pulled in by
`@supabase/ssr@^0.7`), `GoTrueClient.getSession()` (GoTrueClient.js:2217) routes through
`__loadSession()` which checks `expires_at - Date.now() < EXPIRY_MARGIN_MS` and, when
true, calls `_callRefreshToken(refresh_token)` (GoTrueClient.js:2358) — a network
round-trip to the Supabase auth server. The "no transient failure" guarantee that the
comment uses to justify Branch B safety holds ONLY for sessions whose access token has
≥ EXPIRY_MARGIN_MS of life remaining.

This matters because the entire premise of recurrence-2 mitigation in this phase is "the
proxy gate is cookie-only and cannot fail transiently". If a refresh token request fails
or times out at the exact moment an RSC prefetch arrives, `getSession()` returns
`{ session: null }` and the proxy issues a 307 → /login — the same Router Cache
poisoning vector that recurrence-2 was caused by. The `Cache-Control: no-store` on the
redirect (line 23 of `src/proxy.ts`) IS the actual mitigation; the `getSession()` swap
narrows the window but does not eliminate it.

**Fix:** Rewrite the comment to be honest about the trade-off, OR move to a token-only
check (decode the JWT directly from the cookie without refresh):

```ts
// Phase 51 (Branch B safety): proxy auth gating uses getSession() rather than
// getUser(). getSession() reads the session from the cookie store and, when the
// access token is near expiry, may trigger a single refresh round-trip
// (auth-js GoTrueClient.js:2358). This is a narrower failure window than
// getUser() (which ALWAYS makes a network call), but it is not zero.
//
// The PRIMARY recurrence-2 mitigation is the `Cache-Control: no-store` header
// set on the 307 → /login in src/proxy.ts. That header — not the getUser/
// getSession choice — is what prevents Router Cache poisoning.
//
// Trade-off explicitly accepted: ...
```

If a true cookie-only gate is required, decode the JWT directly:

```ts
import { decodeJwt } from 'jose' // already a transitive dep via @supabase

const sb = createServerClient(/* ... */)
const cookieStore = request.cookies
const token = cookieStore.get('sb-access-token')?.value ?? null
const payload = token ? decodeJwt(token).catch(() => null) : null
const user = payload && payload.exp * 1000 > Date.now() ? { id: payload.sub } : null
```

This eliminates the refresh-on-near-expiry round trip entirely.

### CR-02: `insecureUserWarningProxy` will log warnings on every authenticated request

**File:** `src/lib/supabase/proxy.ts:42-47`, `src/proxy.ts:29`
**Issue:** `@supabase/auth-js` wraps `session.user` returned from `getSession()` on the
server with `insecureUserWarningProxy` (GoTrueClient.js:2350). Any property access on
that proxy fires `console.warn(...)` once per process (suppressed via internal flag, but
still emitted on first access).

`updateSession` returns `user = session?.user ?? null` (line 45) — `session.user` is the
proxied object, NOT a plain user. The caller in `src/proxy.ts:29` reads `user?.id` —
this triggers the warning. The suppressWarningRef is per-client, so the warning will
re-fire whenever a new server client is created (which happens per request in
`createServerClient`).

The warning text is:

```
Using the user object as returned from supabase.auth.getSession() or from some
supabase.auth.onAuthStateChange() events could be insecure! This value comes directly
from the storage medium (usually cookies on the server) and may not be authentic.
Use supabase.auth.getUser() instead which authenticates the data by contacting the
Supabase Auth server.
```

This will surface as production log noise and as a worrying-looking security warning in
local dev. It also undermines the documented intent — the comment in proxy.ts at
line 30-40 frames `getSession()` as the safer choice, but Supabase itself is screaming
the opposite via this proxy.

**Fix:** Either (a) return `{ userId: session?.user?.id ?? null }` from `updateSession`
so the proxy boundary is the only consumer of the proxied `user` and ID extraction
happens once (still triggers one warn — preferable to read `decodeJwt(token).sub`
directly), or (b) accept the warning and explicitly suppress it with the documented
`suppressGetSessionWarning` option on the Supabase client:

```ts
const supabase = createServerClient(/* url */, /* key */, {
  cookies: { /* ... */ },
  auth: { suppressGetSessionWarning: true }, // documented escape hatch
})
```

The latter is the minimum-change fix. The former is more honest (the proxy is
authoritative anyway — there's no value in returning a User-shaped object).

## Warnings

### WR-01: `tests/proxy.test.ts` tests `/u/twwaneka` redirect that is unreachable in production

**File:** `tests/proxy.test.ts:96`
**Issue:** The test case `['/u/twwaneka']` (line 96) asserts that an anonymous request
to the bare-username path triggers a 307 → /login. But `next.config.ts:22-29` defines a
build-time `redirects()` rule mapping `/u/:username` → `/u/:username/collection` with
`permanent: true` (308). Next.js applies config redirects BEFORE middleware/proxy
(documented behavior). A real anonymous request to `/u/twwaneka` will:

1. Hit Next's config-redirect layer → 308 → `/u/twwaneka/collection`
2. Browser follows the 308 → new request to `/u/twwaneka/collection`
3. Proxy fires → 307 → /login

The proxy is never invoked with `/u/twwaneka` in production. The test imports the proxy
directly and bypasses the config redirect layer, so it passes — but it doesn't model
reality.

**Fix:** Either remove the `/u/twwaneka` row from the test table (it's not a real attack
surface), or add a comment acknowledging the test is "proxy unit behavior, not e2e
flow":

```ts
// NOTE: in production, /u/:username is redirected by next.config.ts to
// /u/:username/collection BEFORE the proxy runs. This test asserts proxy
// behavior in isolation; the live request never reaches this branch.
['/u/twwaneka'],
```

### WR-02: Page and gate both call `ProfileShellResolver(username)` and `isFollowing` — duplicate work

**File:** `src/app/u/[username]/[tab]/page.tsx:94,108` + `src/app/u/[username]/profile-gate.tsx:46,61`
**Issue:** `[tab]/page.tsx` calls `ProfileShellResolver({ username })` at line 94 and
`isFollowing(viewerId, profile.id)` at line 107-108. The Suspense-wrapped
`<ProfileGate>` it renders ALSO calls `ProfileShellResolver({ username })` at
profile-gate.tsx:46 and `isFollowing(viewerId, profile.id)` at line 60-61.

- `ProfileShellResolver` is cached (`'use cache'` + `cacheTag('profile:${username}')`)
  so the second call is a cache lookup, not a DB roundtrip — but it does mean the
  resolver function is invoked twice per render with all the bookkeeping that implies.
- `isFollowing` is NOT cached (it lives in `@/data/follows`, plain async fn). Calling it
  twice means two DB round-trips per profile tab render.

Result: every profile tab render runs `isFollowing` against the DB twice. For a logged-in
viewer browsing tabs this is a hot path.

**Fix:** Either (a) pass `resolved` and `initialIsFollowing` from the page into the gate
as props (and rely on cache hits to be fast), or (b) acknowledge in a comment that the
gate's resolver call is a deliberate cache hit and remove the `isFollowing` call from
the page (the gate already computes it):

```tsx
// Before page.tsx:106-108
const currentPath = `/u/${username}/${tab}`
// initialIsFollowing is needed only by LockedTabCard branches below; the gate
// computes its own copy independently. Compute once and pass forward.
const initialIsFollowing =
  viewerId !== null ? await isFollowing(viewerId, profile.id) : false
```

The cleanest fix is to move all viewer-dependent reads into the gate (which receives
viewerId) and have the page pass only the params + tabContent.

### WR-03: `assert-phase-51-build.mjs` fails OPEN when route is absent from all manifests

**File:** `scripts/assert-phase-51-build.mjs:107-150`
**Issue:** The script inspects four manifest files for the route key
`/u/[username]/[tab]`. If the route is classified as PPR, it shows up under
`routes` (Shape 1) or `pages` (Shape 2) → script flags violation. If the route is fully
dynamic, it may not appear in any manifest at all, in which case the script exits 0 with
"OK".

But the script should ALSO fail if NO manifest contains the route in any form, because
that may indicate Next.js changed its manifest shape (the comment at line 105-107
explicitly acknowledges this as a future risk) — and a silent "OK" gives false
confidence. The `BUILD_LOG` env var defense-in-depth check is opt-in, not on by default.

This script is the regression-contract guard for the entire phase. A silent fall-through
(manifest shape changed → script can't find the route anywhere → script passes) is the
worst possible failure mode.

**Fix:** Add a "no entries found in any manifest" branch that exits with a SKIP status
(or, more strictly, fails closed). Also wire `BUILD_LOG` on by default by capturing
build output in CI:

```js
// After the violations loop:
const routeFoundAnywhere = foundManifests.some(({ rel, abs }) => {
  try {
    const json = JSON.parse(readFileSync(abs, 'utf8'))
    return (
      (json?.routes && ROUTE_KEY in json.routes) ||
      (json?.dynamicRoutes && ROUTE_KEY in json.dynamicRoutes) ||
      (json?.pages && ROUTE_KEY in json.pages)
    )
  } catch {
    return false
  }
})

if (!routeFoundAnywhere) {
  console.warn(
    `WARN: ${ROUTE_KEY} not found in any inspected manifest. ` +
    'Manifest shape may have changed; assertion is inconclusive.',
  )
  process.exit(BUILD_LOG_CHECK_PERFORMED ? 0 : 2) // SKIP if build-log check didn't run
}
```

### WR-04: `verify-phase-51-prod.sh` Branch B re-gate check is opt-in despite Branch B being the chosen path

**File:** `scripts/verify-phase-51-prod.sh:90`
**Issue:** Per commit `2459a3d` "operator confirms Branch B", the re-gating of `/u/*`
is the chosen direction for this phase. But the verify script only runs the Branch B
check (REQ-51-07: 307 + `Cache-Control: no-store`) when `PHASE51_BRANCH_B=1` is
explicitly set. The default verify run will pass even if the Branch B contract is
broken — the operator must remember to opt in.

This is backwards: Branch B is the committed path, so its contract should be the default
check. An opt-out flag (`PHASE51_BRANCH_B=0`) would be acceptable for emergency
disable, but opt-in is wrong.

**Fix:** Invert the default:

```bash
# Run Branch B check by default; allow opt-out for emergency.
if [ "${PHASE51_BRANCH_B:-1}" != "0" ]; then
  # ...check...
fi
```

Update the env var documentation in the header comment block to match.

### WR-05: `verify-phase-51-prod.sh` uses macOS-specific `mktemp -t` syntax

**File:** `scripts/verify-phase-51-prod.sh:60,61,91`
**Issue:** `mktemp -t phase51-prefetch-headers.XXXXXX` works differently on macOS and
Linux:

- macOS: `-t TEMPLATE` creates `$TMPDIR/TEMPLATE` (template is a prefix; X's at the end are
  randomized).
- Linux (GNU coreutils): `-t` is the "interpret TEMPLATE as a leaf name in TMPDIR"
  flag. Combined behavior differs subtly — `mktemp -t prefix.XXXXXX` may or may not
  honor the `.XXXXXX` template.

CI typically runs on Linux. If the script is run from a CI machine, it may produce
different temp file names than expected, or fail outright on some `mktemp` builds.

**Fix:** Use the portable form:

```bash
PREFETCH_HEADERS_FILE=$(mktemp "${TMPDIR:-/tmp}/phase51-prefetch-headers.XXXXXX")
```

This works identically on macOS, Linux, and BusyBox.

### WR-06: `tests/app/profile-tab-insights.test.tsx` does not assert that `viewerId` is plumbed to ProfileGate

**File:** `tests/app/profile-tab-insights.test.tsx:100-115`
**Issue:** The test navigates `result.props.children` (Suspense) →
`gateEl.props.children` (ProfileGate) → `inner` (InsightsTabContent), but never asserts
the values on the intermediate `gateEl.props` (`username`, `viewerId`). REQ-51-05
explicitly requires that `viewerId` is passed as a prop, but the only test that
exercises page rendering doesn't pin this contract — only the source-grep test
(`profile-route-51.test.ts`) does.

If a future refactor changes the page to pass `viewerId` via a context (which would
still pass the source-grep test if the prop appears anywhere in the source), this test
would not catch it.

**Fix:** Add explicit prop assertions:

```ts
const gateEl = result.props.children
expect(gateEl.props.username).toBe('alice')
expect(gateEl.props.viewerId).toBe('user-1') // owner case
// In the anonymous case (line 142): expect(gateEl.props.viewerId).toBe(null)
```

Note: the anonymous case currently throws notFound before constructing the gate, so it
doesn't reach a JSX result — but the collection-branch smoke at line 165 could carry the
anon-case viewerId assertion if you switch to a non-insights tab.

## Info

### IN-01: `[tab]/page.tsx:106` builds `currentPath` without encoding username

**File:** `src/app/u/[username]/[tab]/page.tsx:106`
**Issue:** `const currentPath = \`/u/${username}/${tab}\`` interpolates raw username and
tab into a same-origin pathname. `tab` is validated against `VALID_TABS` at line 61
(safe). `username` comes from `params` and is whatever the URL contains — it could
contain slashes or `?` if validation is lax.

Username validation lives in the data layer (`getProfileByUsername` returns null for
unknown users → notFound), but the path is constructed at line 106 BEFORE the resolver
runs (line 94 ran the resolver, but the username string itself was used as-is before
that). In practice this is fine because the route segment `[username]` in Next.js is
URL-decoded but cannot contain `/`. Defensive encoding is still cheap:

**Fix:**

```ts
const currentPath = `/u/${encodeURIComponent(username)}/${tab}`
```

### IN-02: `[tab]/page.tsx:67-72` swallows non-Unauthorized auth errors via re-throw — fine but verbose

**File:** `src/app/u/[username]/[tab]/page.tsx:67-72`
**Issue:** The try/catch around `getCurrentUser()` only swallows `UnauthorizedError` and
re-throws everything else. This is correct (other errors should bubble up to the error
boundary), but the pattern is non-obvious:

```ts
let viewerId: string | null = null
try {
  viewerId = (await getCurrentUser()).id
} catch (err) {
  if (!(err instanceof UnauthorizedError)) throw err
}
```

Consider a helper:

```ts
// In @/lib/auth:
export async function tryGetCurrentUser() {
  try {
    return await getCurrentUser()
  } catch (err) {
    if (err instanceof UnauthorizedError) return null
    throw err
  }
}

// In page.tsx:
const viewer = await tryGetCurrentUser()
const viewerId = viewer?.id ?? null
```

This pattern is repeated across `[tab]/page.tsx`, `followers/page.tsx`,
`following/page.tsx` — extracting a helper would reduce duplication and the chance of
someone forgetting the `!(err instanceof UnauthorizedError)` re-throw.

### IN-03: `profile-gate.tsx:46` redundant resolver + notFound when called from `[tab]/page.tsx`

**File:** `src/app/u/[username]/profile-gate.tsx:46-49`
**Issue:** ProfileGate calls `ProfileShellResolver({ username })` and then
`notFound()` if profile is null. The page at `[tab]/page.tsx:94-95` already runs the
same check before constructing the gate's JSX. In the current architecture this is
dead-code-defensive (only triggers if someone reuses ProfileGate from a path that didn't
pre-check). The cache key means the resolver lookup is fast, but the `notFound()` check
is logically unreachable.

This is acceptable as a defensive design and probably should NOT be removed (it
preserves the gate's correctness if reused elsewhere). Flagging only because the
docstring at line 18-19 says "load-bearing invariant (a) `notFound()` MUST be called
BEFORE any post-suspending await" — and the page already ate that bullet, so the gate's
copy is belt-and-suspenders, not load-bearing. Update the comment to reflect the new
architecture:

**Fix:**

```ts
// notFound() is defensive — the page consumer already short-circuits when
// resolved.profile is null. Kept here so the gate remains correct if reused
// from a non-tab caller in the future.
if (!resolved.profile) notFound()
```

---

_Reviewed: 2026-05-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
