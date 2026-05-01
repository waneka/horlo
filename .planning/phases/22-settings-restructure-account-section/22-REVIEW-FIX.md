---
phase: 22-settings-restructure-account-section
fixed_at: 2026-04-30T20:35:00Z
review_path: .planning/phases/22-settings-restructure-account-section/22-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 22: Code Review Fix Report

**Fixed at:** 2026-04-30T20:35:00Z
**Source review:** `.planning/phases/22-settings-restructure-account-section/22-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (1 critical + 4 warnings)
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: SET-06 success toast never fires — `?status=` is inside the hash, but `useSearchParams()` reads the querystring

**Files modified:** `src/components/settings/StatusToastHandler.tsx`, `src/components/settings/SettingsTabsShell.tsx`, `tests/components/settings/StatusToastHandler.test.tsx`
**Commit:** `89d6322`
**Applied fix:** Took Option A from the review (smaller diff; matches D-16 spec). Rewrote `StatusToastHandler` to read `window.location.hash` directly, parse it per the D-16 spec (`hash.slice(1).split('?', 2)` then `URLSearchParams(query)`), fire the toast on `status=email_changed`, then strip with `router.replace(pathname + '#' + tab + remainder)` so the active tab is preserved. Added a `hashchange` listener so post-navigation hash mutations also re-evaluate. Removed the `<Suspense>` wrapper in `SettingsTabsShell` (no longer needed — `useSearchParams` is gone). Rewrote the test to drive URL state via `Object.defineProperty(window.location, ...)` rather than the now-unused `useSearchParams` mock; added two new cases for empty-hash and additional-hash-query-params preservation. All 7 tests pass; SettingsTabsShell hash-routing tests (6) still pass.

### WR-01: `(updErr as any).status === 401` bypasses AuthError type safety

**Files modified:** `src/components/settings/PasswordChangeForm.tsx`, `tests/components/settings/PasswordChangeForm.test.tsx`
**Commit:** `b4bf770` (source fix), `712d480` (test typing follow-up)
**Applied fix:** Imported `AuthError` from `@supabase/supabase-js` and replaced the `(updErr as any).status === 401` cast with `updErr instanceof AuthError && updErr.status === 401`. Removed the `eslint-disable-next-line @typescript-eslint/no-explicit-any` comment. Updated the 401 test case to use `new AuthError('reauth required', 401)` instead of a plain object so the runtime `instanceof` check matches Supabase actual behavior. Widened the `vi.fn` resolved-value type to `Promise<{ error: AuthError | null }>` so TypeScript accepts the AuthError instance in the test mock. All 5 PasswordChangeForm tests pass.

### WR-02: Redundant `supabase.auth.getUser()` call in /settings/page.tsx

**Files modified:** `src/lib/auth.ts`, `src/app/settings/page.tsx`
**Commit:** `ba56da5` (combined with WR-03)
**Applied fix:** Added `getCurrentUserFull(): Promise<User>` helper to `src/lib/auth.ts` that returns the full Supabase User object in a single `auth.getUser()` round-trip; throws `UnauthorizedError` for parity with `getCurrentUser`. Updated `src/app/settings/page.tsx` to call `getCurrentUserFull()` in place of the prior pattern (`getCurrentUser()` then a second `createSupabaseServerClient + auth.getUser()`). Halves the auth round-trips per render of the most-visited settings surface. Pulled `id`/`email` off the same User object instead of re-fetching. TS-clean; preferences-redirect test still passes.

### WR-03: `redirect('/login?next=/settings')` drops the active tab from `next`

**Files modified:** `src/app/settings/page.tsx`
**Commit:** `ba56da5` (combined with WR-02 — same file edit)
**Applied fix:** Took the inline TODO option from the review (architectural fix deferred — server cannot read client `location.hash`). Added a TODO comment immediately above the `redirect('/login?next=/settings')` call documenting that server-side redirect cannot preserve the hash so deep-links to non-default tabs land on `#account` post-login. Acceptable for v1 (rare path). Note: a future `<HashCarrier>` Client Component on `/login` reading `sessionStorage.getItem('hashAfterLogin')` set by a `<HashCapture>` on `/settings` is a candidate Phase 23+ enhancement; not in this phase's scope.

### WR-04: `safeNext` open-redirect surface — backslash and CRLF edge cases

**Files modified:** `src/app/auth/callback/route.ts`
**Commit:** `060843f`
**Applied fix:** Replaced the `next.startsWith('/') && !next.startsWith('//')` check with a single regex `/^\/(?!\/)[^\\\r\n\t]*$/` that additionally rejects backslash, CR, LF, and tab. Removed the special `destination.includes('#') && destination.includes('?')` branch and the manual `Location` string-concat — verified with `node -e` that `new URL('/settings#account?status=email_changed', origin).toString()` preserves the `#fragment?query` shape byte-identically (everything post-`#` is opaque WHATWG fragment data), so `NextResponse.redirect(new URL(destination, origin))` handles both vanilla and hash-with-internal-query destinations uniformly. All 10 auth-callback-route tests pass — including the SET-06 D-12 invariant ("email_change ignores next override").

## Verification

- TypeScript: `npx tsc --noEmit` reports no errors in any file modified by these fixes (pre-existing errors in unrelated files: `RecentlyEvaluatedRail.test.tsx`, `DesktopTopNav.test.tsx`, `phase17-extract-route-wiring.test.ts`, etc. — those are NOT introduced by this fix run).
- Tests: `npm test -- tests/components/settings tests/app/auth-callback-route.test.ts tests/app/preferences-redirect.test.ts tests/lib/auth/lastSignInAt.test.ts` → **14 files, 69 tests passing.**

---

_Fixed: 2026-04-30T20:35:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
