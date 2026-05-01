---
phase: 22-settings-restructure-account-section
reviewed: 2026-04-30T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - src/app/actions/preferences.ts
  - src/app/auth/callback/route.ts
  - src/app/preferences/page.tsx
  - src/app/settings/page.tsx
  - src/components/settings/AccountSection.tsx
  - src/components/settings/AppearanceSection.tsx
  - src/components/settings/EmailChangeForm.tsx
  - src/components/settings/EmailChangePendingBanner.tsx
  - src/components/settings/NotificationsSection.tsx
  - src/components/settings/PasswordChangeForm.tsx
  - src/components/settings/PasswordReauthDialog.tsx
  - src/components/settings/PreferencesSection.tsx
  - src/components/settings/PrivacySection.tsx
  - src/components/settings/PrivacyToggleRow.tsx
  - src/components/settings/ProfileSection.tsx
  - src/components/settings/SettingsTabsShell.tsx
  - src/components/settings/StatusToastHandler.tsx
  - src/lib/auth/lastSignInAt.ts
findings:
  critical: 1
  warning: 4
  info: 6
  total: 11
status: issues_found
---

# Phase 22: Code Review Report

**Reviewed:** 2026-04-30
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Phase 22 ships a base-ui vertical-tabs `/settings` shell, six section components (Account, Profile, Preferences, Privacy, Notifications, Appearance), and the email/password change flow with the locked re-auth UX. Architecture is clean — the Server Component → Client Component prop boundary in `src/app/settings/page.tsx` is well-defined, the dialog state machine in `PasswordChangeForm` correctly captures `pendingNewPassword` per-attempt via a discriminated union, and the same-origin guard in `auth/callback/route.ts` is preserved.

**One CRITICAL contract mismatch** prevents the SET-06 success toast from ever firing: the auth callback redirects to `/settings#account?status=email_changed` (status param INSIDE the hash, per D-16), but `StatusToastHandler` reads via `useSearchParams()`, which returns the location *querystring* — empty in this URL shape. The D-16 spec in 22-CONTEXT.md explicitly mandates parsing the hash-internal query (`hash.slice(1).split('?', 2)` then `URLSearchParams(query)`); the implementation skipped that parser and used the wrong source. End-to-end the email_change toast is silently dead.

Other warnings: an `as any` cast on the AuthError 401 detection (works but bypasses type safety), a redundant `auth.getUser()` call in the page loader, a hash-stripping login redirect, and a minor accessibility duplication.

## Critical Issues

### CR-01: SET-06 success toast never fires — `?status=` is inside the hash, but `useSearchParams()` reads the querystring

**File:** `src/components/settings/StatusToastHandler.tsx:31`
**Also affects:** `src/components/settings/SettingsTabsShell.tsx:34-38` (`parseHash` discards the query portion); `src/app/auth/callback/route.ts:31` (destination shape).

**Issue:** The auth callback redirect destination is `/settings#account?status=email_changed` — the `?status=...` is inside the URL fragment, so:

- `location.pathname` = `/settings`
- `location.search` = `""` (empty)
- `location.hash` = `#account?status=email_changed`

Per WHATWG URL spec, everything after the first unescaped `#` is opaque fragment data. `useSearchParams()` from `next/navigation` reads from the React-level `SearchParamsContext`, populated from `location.search` only — it never inspects the fragment. So `searchParams.get('status')` always returns `null`, the early `if (!status) return` short-circuits, and the success toast never fires.

`SettingsTabsShell.parseHash` (line 34-38) extracts only the tab name and discards the query portion, contradicting the D-16 parser spec from 22-CONTEXT.md (line 83):

> Parser: `const [tab, query] = hash.slice(1).split('?', 2); const params = new URLSearchParams(query ?? '')`

The CONTEXT-mandated parser is missing from the implementation. The `D-14` strip logic in `StatusToastHandler` (which preserves `window.location.hash` while stripping `?status=` from the querystring) only makes sense if `?status=` were in the actual querystring — it can't strip something that isn't there.

**Repro path:**
1. Submit email change → click confirmation link in new email → Supabase `verifyOtp` succeeds.
2. Callback route redirects with `Location: /settings#account?status=email_changed` (line 84-87).
3. Browser navigates; `<StatusToastHandler>` mounts.
4. `searchParams.get('status')` returns `null` → no toast.
5. The Account tab is correctly activated (parseHash works for the tab name), but the locked SET-06 acknowledgement is silently dropped.

**Fix (pick one):**

**Option A — extract status from the hash (matches CONTEXT D-16 spec):**

```tsx
// StatusToastHandler.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { toast } from 'sonner'

export function StatusToastHandler() {
  const router = useRouter()
  const pathname = usePathname()
  const fired = useRef(false)
  const [hash, setHash] = useState('')

  useEffect(() => {
    setHash(window.location.hash)
    const onHashChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    if (fired.current || !hash) return
    const [tab, query] = hash.slice(1).split('?', 2)
    const params = new URLSearchParams(query ?? '')
    const status = params.get('status')
    if (!status) return

    if (status === 'email_changed') {
      toast.success('Email changed successfully')
    } else {
      return
    }
    fired.current = true

    // Strip status from the hash, preserve the tab.
    params.delete('status')
    const remainder = params.toString()
    const newHash = remainder ? `#${tab}?${remainder}` : `#${tab}`
    router.replace(`${pathname}${newHash}`, { scroll: false })
  }, [hash, pathname, router])

  return null
}
```

This removes the `useSearchParams()` dependency entirely, which also obsoletes the `<Suspense>` boundary in `SettingsTabsShell`.

**Option B — change the destination to use the actual querystring** (`/settings?status=email_changed#account`):

```ts
// auth/callback/route.ts
email_change: '/settings?status=email_changed#account',
```

Then drop the special hash+query Location-construction branch (line 83-89) — `new URL()` handles `?...#...` ordering correctly. `useSearchParams()` reads `?status=email_changed`, fires the toast, and `router.replace(pathname + queryStrWithoutStatus + hash)` preserves `#account`. This better matches the existing D-14 strip-with-hash-preserve logic, but contradicts D-16's "non-standard hash-with-querystring shape" — would require revising the locked decision.

Option A is the smaller diff and aligns with the CONTEXT spec as written.

## Warnings

### WR-01: `(updErr as any).status === 401` bypasses AuthError type safety

**File:** `src/components/settings/PasswordChangeForm.tsx:89-93`

**Issue:** The Option C defense-in-depth 401 detection casts to `any`:

```ts
if (
  updErr &&
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (updErr as any).status === 401
)
```

`@supabase/auth-js` exports `AuthError` (verified at `node_modules/@supabase/auth-js/dist/main/lib/errors.d.ts:13`) with a typed `status: number | undefined` field. Casting to `any` works at runtime but loses type safety and disables the lint rule. If a future version of supabase-js renames `status` to `statusCode`, the runtime check silently turns into a no-op (the dialog never re-opens for the timing edge — Option C defense-in-depth is silently disabled).

**Fix:**

```ts
import { AuthError } from '@supabase/supabase-js'
// ...
if (updErr instanceof AuthError && updErr.status === 401) {
  setReauth({
    open: true,
    pendingNewPassword: password,
    description: 'Please confirm your password to continue.',
  })
  return
}
```

This removes the `eslint-disable` comment and the `as any` cast. Surface area is identical; type narrowing is exhaustive.

### WR-02: Redundant `supabase.auth.getUser()` call in /settings/page.tsx

**File:** `src/app/settings/page.tsx:31-34`

**Issue:** The page loader calls `getCurrentUser()` (which internally calls `supabase.auth.getUser()` — see `src/lib/auth.ts:11-19`), then immediately calls `supabase.auth.getUser()` again to read `new_email` and `last_sign_in_at`:

```ts
user = await getCurrentUser()  // calls supabase.auth.getUser() internally
// ...
const supabase = await createSupabaseServerClient()
const {
  data: { user: fullUser },
} = await supabase.auth.getUser()  // second redundant call
```

Each `auth.getUser()` round-trips to the Supabase Auth server (it's not local JWT decode — it's a verified user fetch). On every settings page render, two HTTP calls happen instead of one. Not a bug, but a tax on every render of the most-visited account surface in the app.

**Fix:** Either (a) extend `getCurrentUser()` to accept a `full?: boolean` flag and return `User | { id; email }`, or (b) introduce a sibling `getCurrentUserFull()` helper:

```ts
// src/lib/auth.ts
export async function getCurrentUserFull(): Promise<User> {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new UnauthorizedError()
  return user
}
```

Then in the page:

```ts
const fullUser = await getCurrentUserFull()
const user = { id: fullUser.id, email: fullUser.email! }
```

One round-trip; no redundancy. Apply the same `try/catch` pattern.

### WR-03: `redirect('/login?next=/settings')` drops the active tab from `next`

**File:** `src/app/settings/page.tsx:24`

**Issue:** When an unauthenticated user navigates to `/settings#preferences` (or any non-default tab), the redirect target is `/login?next=/settings` — the `#preferences` fragment is lost. After successful login, the user lands on `/settings` and the tab shell defaults to `#account` (D-17), not `#preferences`. UX regression for deep links.

The fragment cannot be carried in the `next` query value because the Server Component cannot read the client's `location.hash`. This is a fundamental limitation, but the loss is silent — there's no compensating mechanism (e.g., post-login a `<RestoreHashFromSession>` Client Component, or storing the hash in a cookie before redirect).

**Fix:** Phase 22 v1 — accept the regression and document it; deep-link-from-logged-out is rare. Phase 23+ — consider adding a tiny `<HashCarrier>` Client Component on the login page that reads `sessionStorage.getItem('hashAfterLogin')` set by a `<HashCapture>` on `/settings` if `getCurrentUser` is unauthenticated. Or just use middleware to redirect at the edge before hash-bearing navigation completes (still has the same fragment-isn't-sent-to-server problem).

For this review: at minimum, add an inline TODO comment so the regression is visible:

```ts
if (needsLogin || !user) {
  // TODO: Server-side redirect cannot preserve location.hash — deep-link to a
  // non-default tab will land on #account post-login. Acceptable for v1 (rare path).
  redirect('/login?next=/settings')
}
```

### WR-04: `safeNext` open-redirect surface — backslash and CRLF edge cases

**File:** `src/app/auth/callback/route.ts:51-52`

**Issue:** The same-origin guard:

```ts
const safeNext =
  next && next.startsWith('/') && !next.startsWith('//') ? next : null
```

is sufficient against `//evil.com` and `https://evil.com` because both fail the `startsWith('/')` test or hit the `!startsWith('//')` reject. However, the manual `Location` header construction at line 84-88 uses string interpolation rather than `new URL()`:

```ts
const absolute = `${origin}${destination}`
return new NextResponse(null, {
  status: 307,
  headers: { location: absolute },
})
```

This branch only runs when `destination.includes('#') && destination.includes('?')`. For `email_change` and `invite` (non-overridable types), `destination = typeDefault`, which is hardcoded — safe. For overridable types (`signup`, `recovery`, `magiclink`), if a malicious link supplies `next=/foo?a=b#c`, `safeNext` becomes `/foo?a=b#c` and concatenates: `https://app.com/foo?a=b#c`. WHATWG URL parsing of the resulting absolute URL keeps the host as `app.com` (any `\\` sequences in the path normalize to `/` but stay within the authority `app.com`), so I could not construct an exploit on modern browsers.

However, two latent risks worth pre-empting:

1. **CRLF in `next`:** `searchParams.get('next')` URL-decodes — a `next=%0d%0aSet-Cookie:...` value would, after decode, contain raw `\r\n`. The Headers API rejects header values with control characters at runtime, so this throws (defense-in-depth from Node's HTTP layer), but it's better to validate explicitly than rely on the throw.

2. **Future destination shapes:** the special branch is keyed on `includes('#') && includes('?')`, which any `safeNext` can satisfy. The hardcoded-typeDefault assumption is the only thing keeping user-controlled values out of this string-concat path; a future contributor adding a new typeDefault that also derives from `safeNext` would silently re-enter it.

**Fix:** Validate `safeNext` more strictly and route the special branch through `new URL()`:

```ts
// Reject anything containing control chars or backslash.
const safeNext = (() => {
  if (!next) return null
  if (!/^\/(?!\/)[^\\\r\n\t]*$/.test(next)) return null
  return next
})()

// Always go through new URL — it preserves byte-identity for the
// `path?query#fragment` shape; reordering to `path?query#fragment`
// is correct WHATWG behavior, not a bug. Verify this matches what
// SettingsTabsShell.parseHash expects (it should — the spec destination is
// path?query#fragment, not path#fragment?query, after CR-01 is resolved).
return NextResponse.redirect(new URL(destination, origin))
```

If CR-01 is resolved with Option B (move `?status=` out of the hash), this entire special branch goes away — the destination becomes `/settings?status=email_changed#account`, which `new URL()` handles correctly.

## Info

### IN-01: `aria-live="polite"` is redundant with `role="status"`

**File:** `src/components/settings/EmailChangePendingBanner.tsx:57-58`

**Issue:** ARIA spec: `role="status"` already implies `aria-live="polite"` and `aria-atomic="true"`. Setting both is harmless but creates two sources of truth. Some SR/browser combos handle the duplicate inconsistently (most ignore the redundancy; a few re-announce on every render). Not a bug.

**Fix:** Drop `aria-live="polite"`:

```tsx
<div
  role="status"
  className="..."
>
```

If you specifically want `assertive` announcements (banner appearance interrupts other SR speech), use `role="alert"` instead — but for the success-pending case `polite` is the correct UX.

### IN-02: Generic error copy hides actionable Supabase failure modes

**File:** `src/components/settings/EmailChangeForm.tsx:62`, `src/components/settings/PasswordChangeForm.tsx:103`, `src/components/settings/PasswordReauthDialog.tsx:106`

**Issue:** All three forms collapse Supabase errors into a single locked string ("Could not update email. Please try again.", "Could not update password.", etc.). This hides:

- Rate-limit errors (4xx with `retry_after`) — user sees generic failure, retries immediately, fails again.
- Weak-password errors (`AuthWeakPasswordError`) — user has no idea what's wrong with the password.
- Email-already-in-use errors — user submits the same email and gets generic copy.

The UI-SPEC Copywriting Contract locks these strings for v1, so the design intent is acknowledged. For v2, consider parsing `AuthError.code` and surfacing a small dictionary of friendlier messages.

**Fix:** Track as a follow-up; not a v1 blocker.

### IN-03: `revalidatePath('/preferences')` is a no-op since /preferences became a pure redirect

**File:** `src/app/actions/preferences.ts:55`

**Issue:** Per D-15, `/preferences` is now a server-side `redirect('/settings#preferences')`. There's no cached page content at `/preferences` to revalidate. The call is harmless but misleading — a future contributor reading the code will assume there's a real `/preferences` page being kept fresh.

**Fix:** Remove `revalidatePath('/preferences')`:

```ts
revalidatePath('/settings')
```

Or leave with a comment:

```ts
// /preferences is a server redirect to /settings#preferences (D-15); no page
// cache to revalidate. Kept for symmetry in case the route is ever restored.
revalidatePath('/preferences')
revalidatePath('/settings')
```

### IN-04: `lastSignInAt.ts` `typeof !== 'string'` check is dead code given the type signature

**File:** `src/lib/auth/lastSignInAt.ts:34`

**Issue:** The signature is `lastSignInAtIso: string | null | undefined`. The `lastSignInAtIso == null` check at line 33 already excludes `null` and `undefined`. The subsequent `typeof !== 'string'` branch at line 34 cannot be reached given the static type — TS narrows `lastSignInAtIso` to `string` after the null check.

The check is reasonable defense-in-depth for runtime callers (e.g., a future Server Action that passes `unknown`), but it's currently unreachable for the documented use-case (Supabase User shape).

**Fix:** Either keep with a comment explaining the defensive intent, or simplify:

```ts
export function getLastSignInAgeMs(
  lastSignInAtIso: string | null | undefined,
): number | null {
  if (!lastSignInAtIso) return null  // catches null, undefined, ''
  const parsed = Date.parse(lastSignInAtIso)
  if (Number.isNaN(parsed)) return null
  return Date.now() - parsed
}
```

The empty-string guard is preserved by the truthiness check.

### IN-05: `<img>` in ProfileSection bypasses Next.js Image optimization

**File:** `src/components/settings/ProfileSection.tsx:32-39`

**Issue:** The avatar uses a plain `<img>` with `// eslint-disable-next-line @next/next/no-img-element`. The inline comment explains it's a sanitized Supabase Storage CDN URL (T-22-X1 mitigation), but raw `<img>` skips Next.js's automatic responsive sizing, lazy loading, and AVIF/WebP serving. Not a security issue (the URL is server-fetched and validated), but a perf regression vs the rest of the app.

**Fix:** Use `next/image` with the Supabase CDN domain whitelisted in `next.config.ts`:

```tsx
import Image from 'next/image'
// ...
<Image
  src={avatarUrl}
  alt=""
  width={64}
  height={64}
  className="size-16 shrink-0 rounded-full object-cover"
/>
```

If the avatar URL pattern is unstable, a wrapper component that falls back to `<img>` could keep the eslint-disable scoped.

### IN-06: `<EmailChangePendingBanner>` and `<EmailChangeForm>` both create a Supabase browser client per render

**Files:** `src/components/settings/EmailChangeForm.tsx:57`, `src/components/settings/EmailChangePendingBanner.tsx:45`, `src/components/settings/PasswordChangeForm.tsx:82`, `src/components/settings/PasswordReauthDialog.tsx:85`

**Issue:** `createSupabaseBrowserClient()` is called inside the submit handler on every form interaction. The `@supabase/ssr` browser client is internally a singleton-ish factory (it reuses cookies/storage), but a fresh wrapper object is allocated each time. Not incorrect, just micro-allocation noise.

**Fix:** Hoist to a module-scope `useMemo` or call once in a `useState` initializer:

```ts
const [supabase] = useState(() => createSupabaseBrowserClient())
```

Or just accept the current pattern — Phase 22 follows the established codebase convention.

---

_Reviewed: 2026-04-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
