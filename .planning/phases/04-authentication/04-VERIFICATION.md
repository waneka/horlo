---
phase: 04-authentication
verified: 2026-04-12T00:00:00Z
status: passed
score: 5/5 roadmap success criteria verified
overrides_applied: 0
re_verification:
  previous_status: initial
  previous_score: n/a
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 04: Authentication Verification Report

**Phase Goal:** Real users can sign up and log in, session is enforced at the proxy layer AND independently re-verified inside every Server Action before any DAL call, with per-user data isolation that client-supplied IDs cannot subvert.
**Verified:** 2026-04-12
**Status:** PASS
**Re-verification:** No — initial verification
**Verification mode:** Goal-backward, cross-checking artifacts against AUTH-01..04. UAT was human-driven and already APPROVED; this report audits the code at HEAD only.

## Goal Achievement

### Requirement-to-Code Map

| Req        | Requirement                                                                                                                              | Verdict    | Key Evidence                                                                                                                                                  |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AUTH-01** | Supabase Auth integrated via `@supabase/ssr`; users can sign up, log in, log out.                                                       | ✓ PASS     | Forms + callback + logout action + UserMenu all present and wired.                                                                                            |
| **AUTH-02** | Auth enforced via `proxy.ts` (not middleware.ts) AND independently re-verified inside every Server Action before DAL calls.              | ✓ PASS     | `src/proxy.ts` is Next 16 proxy (not middleware); `getCurrentUser()` prologue in every Server Action; DAL accepts only the just-verified session id.          |
| **AUTH-03** | Per-user data isolation at the DAL query level; client-supplied IDs are never trusted for authorization (IDOR-safe).                    | ✓ PASS     | `userId` param dropped from Server Action signatures (D-02); DAL `eq(watches.userId, userId)` on every query; real-DB IDOR tests exist (env-gated, as planned). |
| **AUTH-04** | `POST /api/extract-watch` requires an authenticated session (complementary to SEC-01 SSRF).                                              | ✓ PASS     | Auth gate is the literal first operation in the POST handler, returning 401 JSON on `UnauthorizedError`, layered above the existing SSRF protections.          |

### Observable Truths (ROADMAP Phase 4 success criteria)

| #   | Truth                                                                                                                                                      | Status     | Evidence                                                                                                                                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | User can sign up with email/password, log in, and log out through UI backed by Supabase Auth (`@supabase/ssr`)                                             | ✓ VERIFIED | Signup form calls `supabase.auth.signUp` (signup-form.tsx:23); login form calls `signInWithPassword` (login-form.tsx:25); `logout()` Server Action calls `signOut()` then redirects (actions/auth.ts:5-9); UserMenu renders a `form action={logout}` (UserMenu.tsx:49). All clients come from `@supabase/ssr` via `createSupabaseBrowserClient`/`createSupabaseServerClient`. |
| 2   | Project uses `proxy.ts` (not `middleware.ts`); a log line confirms the proxy executes on protected routes                                                   | ✓ VERIFIED | `src/proxy.ts:12` exports `export default async function proxy(...)`; `src/proxy.ts:26` emits a dev log line per request; matcher at `src/proxy.ts:33-35` excludes only static assets + auth pages. No `middleware.ts` exists anywhere in the tree. |
| 3   | Every Server Action re-verifies the session via `getCurrentUser()` before touching data; a tampered cookie yields 401 even if the proxy is bypassed       | ✓ VERIFIED | `addWatch` (watches.ts:50-51), `editWatch` (watches.ts:82-83), `removeWatch` (watches.ts:114-115), `savePreferences` (preferences.ts:41-42) all share the `let user; try { user = await getCurrentUser() } catch { return {success:false, error:'Not authenticated'} }` prologue. `getCurrentUser()` (`src/lib/auth.ts:11-19`) uses `supabase.auth.getUser()` — server-verified, per D-01/D-16, NOT `getSession()`. DAL takes `user.id` from this verified call only. |
| 4   | A user cannot read, update, or delete another user's watches or preferences regardless of the ID supplied by the client (IDOR-safe)                        | ✓ VERIFIED | Public action signatures no longer accept `userId` — `addWatch(data)`, `editWatch(watchId, data)`, `removeWatch(watchId)`, `savePreferences(data)` (D-02). The DAL scopes by `and(eq(watches.userId, userId), eq(watches.id, watchId))` in `updateWatch`/`deleteWatch`/`getWatchById` (data/watches.ts:96-101, 131-140, 145-153) and throws `"not found or access denied"` on zero-row outcomes. Action catches translate this to `{success:false, error:'Not found'}` (watches.ts:68-71, 100-103, 123-126). Real-Postgres integration test asserts `editWatch(otherUsersWatchId)` and `removeWatch(otherUsersWatchId)` both return `Not found` while User B's row stays untouched (tests/data/isolation.test.ts:68-95). Test is env-gated on `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (by design — 3 skipped tests in the green run correspond to this file). |
| 5   | `POST /api/extract-watch` rejects unauthenticated requests with 401 in addition to the Phase 1 SSRF protections                                              | ✓ VERIFIED | `src/app/api/extract-watch/route.ts:9-16` runs `getCurrentUser()` **before** body parse and before SSRF checks, returning `NextResponse.json({error:'Unauthorized'}, {status:401})` on `UnauthorizedError`. SSRF path via `SsrfError` remains intact (route.ts:55-60). Ordering matches D-14 exactly.                   |

**Score:** 5 / 5 roadmap success criteria verified.

### Required Artifacts

| Artifact                                              | Expected Role                                                        | Status      | Details                                                                                                                                                                    |
| ----------------------------------------------------- | -------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/proxy.ts`                                        | Deny-by-default proxy with `/login?next=` redirect and log line      | ✓ VERIFIED  | Exists at `src/proxy.ts` (not repo root — moved per `54dc07f` because project uses `src/app/`). Deny-by-default, redirect, log line all present.                            |
| `src/lib/supabase/proxy.ts`                           | `@supabase/ssr` cookie-propagating `updateSession` helper            | ✓ VERIFIED  | Lines 1-32. Cookie adapter rewrites request cookies then response cookies (the canonical `@supabase/ssr` idiom). Calls `supabase.auth.getUser()` to refresh the session.    |
| `src/lib/supabase/server.ts`                          | Server client with awaited `cookies()` (Next 16 API)                 | ✓ VERIFIED  | Lines 1-27. `await cookies()` per Next 16. Guards the `setAll` in a try/catch for Server Components that can't write cookies (correct per Supabase docs).                   |
| `src/lib/supabase/client.ts`                          | Browser client used by login/signup/forgot/reset forms               | ✓ VERIFIED  | Referenced by all four auth forms; file exists.                                                                                                                             |
| `src/lib/auth.ts`                                     | `getCurrentUser()` + `UnauthorizedError`                             | ✓ VERIFIED  | Lines 1-19. Uses `getUser()` not `getSession()` (D-01). Throws `UnauthorizedError` on missing/invalid session. `'server-only'` import at line 1 keeps it off the client.    |
| `src/app/actions/auth.ts`                             | `logout()` Server Action                                             | ✓ VERIFIED  | Lines 1-9. `signOut()` then `redirect('/login')` — the `redirect` throw is the documented exception to "never throw across the boundary".                                  |
| `src/app/actions/watches.ts`                          | `addWatch`/`editWatch`/`removeWatch` with no `userId` param          | ✓ VERIFIED  | New signatures (lines 49, 81, 113). `getCurrentUser` prologue. Preserves Phase 3 ActionResult contract including `"not found or access denied"` mapping.                    |
| `src/app/actions/preferences.ts`                      | `savePreferences` with no `userId` param                             | ✓ VERIFIED  | Line 40. Same prologue pattern.                                                                                                                                             |
| `src/data/watches.ts`                                 | DAL unchanged in signature, scopes every query by `userId` (D-03)    | ✓ VERIFIED  | All read/write paths filter `eq(watches.userId, userId)`. `update`/`delete` throw on not-found per D-08.                                                                    |
| `src/app/api/extract-watch/route.ts`                  | Auth gate layered on SSRF                                            | ✓ VERIFIED  | Auth check is lines 9-16, literally the first operation of POST. Returns 401 JSON on `UnauthorizedError`.                                                                   |
| `src/app/login/page.tsx` + `login-form.tsx`           | `/login` with `?next=` support and open-redirect guard               | ✓ VERIFIED  | Page guards same-origin `next` (page.tsx:11); form threads `next` into `router.push(next)` (login-form.tsx:32).                                                             |
| `src/app/signup/page.tsx` + `signup-form.tsx`         | `/signup` email+password, immediate login (D-09)                     | ✓ VERIFIED  | Calls `signUp`, redirects to `/` on success (signup-form.tsx:23,31).                                                                                                         |
| `src/app/forgot-password/...`                         | Email reset that routes through `/auth/callback`                     | ✓ VERIFIED  | `resetPasswordForEmail(email, { redirectTo: '/auth/callback?next=/reset-password' })` (forgot-password-form.tsx:19-21); always shows the same success state (no enumeration). |
| `src/app/reset-password/...`                          | Form to set new password post-recovery-callback                      | ✓ VERIFIED  | Calls `supabase.auth.updateUser({password})` (reset-password-form.tsx:30); client-side length + confirm checks.                                                             |
| `src/app/auth/callback/route.ts`                      | Recovery `verifyOtp` handler                                         | ✓ VERIFIED  | Uses `verifyOtp({type, token_hash})` per Supabase docs; same-origin `next` guard; falls back to `/login?error=invalid_link`.                                                |
| `src/components/layout/Header.tsx`                    | Server Component resolving `user` for the header                    | ✓ VERIFIED  | Awaited `getCurrentUser()` inside a Server Component; unauth caught via `UnauthorizedError instanceof` (Header.tsx:11-16).                                                  |
| `src/components/layout/UserMenu.tsx`                  | DropdownMenu with logout form POST                                   | ✓ VERIFIED  | Uses `DropdownMenuGroup` wrapper (fix from `e84f980`) required by `@base-ui/react`. Logout is a `<form action={logout}>`, works without JS.                                 |
| `supabase/migrations/20260413000000_sync_auth_users.sql` | Shadow `users` row sync trigger                                   | ✓ VERIFIED  | `handle_new_auth_user()` trigger on `auth.users` insert, upserts into `public.users (id, email)`. Resolves the Phase 3 FK for first sign-up. Matches D-Claude discretion option A (trigger). |
| `tests/data/isolation.test.ts`                        | Real-DB IDOR integration tests                                        | ✓ VERIFIED  | Three `it(...)` cases covering cross-user edit, cross-user delete, and same-user positive path. `describe.skip` when env vars absent (by design — shows up as 3 skipped tests in UAT-reported suite).  |

### Key Link Verification

| From                              | To                                     | Via                                                                                 | Status    | Notes                                                                       |
| --------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------- |
| `proxy.ts`                        | `updateSession` (Supabase)             | `await updateSession(request)` at line 13                                            | ✓ WIRED   | Returns `{user, response}`; proxy uses both.                                |
| `proxy.ts`                        | `/login?next=<path>`                   | `NextResponse.redirect(loginUrl)` at lines 18-22                                     | ✓ WIRED   | Matches D-13.                                                                |
| Server Actions (watches, prefs)   | `getCurrentUser`                       | Imported from `@/lib/auth`; called as `await getCurrentUser()` at the top of each   | ✓ WIRED   | Four actions, four prologues.                                                |
| `getCurrentUser`                  | `supabase.auth.getUser()`              | `createSupabaseServerClient` → `getUser()`                                           | ✓ WIRED   | Server-verified path per D-01, not `getSession()`.                           |
| Server Actions                    | DAL (watches/preferences)              | `await watchDAL.createWatch(user.id, ...)` etc.                                      | ✓ WIRED   | `user.id` is always the just-verified session id — no client-trusted path.   |
| `/api/extract-watch` POST         | `getCurrentUser`                       | First statement inside handler, catches `UnauthorizedError` → 401 JSON               | ✓ WIRED   | Layered above existing SSRF catch; SSRF still handled on the error path.     |
| `Header.tsx` (Server Component)   | `UserMenu` / `getCurrentUser`          | `getCurrentUser()` → passes `user` as prop to `UserMenu`                             | ✓ WIRED   | Unauth path handled via `UnauthorizedError` catch.                           |
| `UserMenu.tsx`                    | `logout()` Server Action               | `<form action={logout}>` inside `DropdownMenuItem`                                   | ✓ WIRED   | Works without JS. `DropdownMenuGroup` wrapper present (bug fix `e84f980`).  |
| `/auth/callback`                  | `/reset-password`                      | `verifyOtp` → `NextResponse.redirect(new URL(safeNext, origin))`                     | ✓ WIRED   | `safeNext` guarded against open-redirect (must start with `/`, not `//`).    |
| `supabase/migrations/.../sync_auth_users.sql` | `public.users` (Phase 3 FK target) | `insert ... on conflict (id) do update`                                              | ✓ WIRED   | Shadow sync resolves first-signup FK races.                                  |

### Anti-Patterns Found

| File                                             | Line | Pattern                                    | Severity | Impact                                                                                                                        |
| ------------------------------------------------ | ---- | ------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/app/actions/watches.ts`                     | 6    | Unused import `UnauthorizedError`           | ℹ️ Info   | The import from `@/lib/auth` pulls `UnauthorizedError` but the code path only does `catch { return ... }` (no `instanceof` check). Harmless dead import. Optional cleanup. |
| `src/app/actions/preferences.ts`                 | 6    | Unused import `UnauthorizedError`           | ℹ️ Info   | Same pattern as above.                                                                                                        |
| `src/lib/supabase/proxy.ts`                      | —    | Comment / behavior discrepancy              | ℹ️ Info   | Comment at line 26 says "getUser() BOTH verifies server-side AND triggers refresh-token round-trip" — accurate per `@supabase/ssr` docs. No issue; noting for verbosity. |
| Auth forms (login/signup)                        | —    | No zod validation of inputs                  | ℹ️ Info   | Client-side validation is browser native (`type=email`, `minLength=8`, `required`). Server-side validation happens inside Supabase Auth. No gap for AUTH-01, but consider zod parity with watches/preferences actions in a future hardening pass. |

No blocker or warning-severity anti-patterns found. No TODO/FIXME/PLACEHOLDER markers in any Phase 4 artifact. No empty `return null` / placeholder JSX. No `console.log` stubs (the one `console.log` in `proxy.ts` is a deliberate roadmap-satisfying log, gated on `NODE_ENV !== 'production'`).

### Data-Flow Trace (Level 4)

Phase 4 is an authentication + gating phase, not a data-rendering phase. The only Server Component that renders user-bound data is `Header.tsx`, which derives `user` from `getCurrentUser()`. That resolves to real Supabase Auth state via `supabase.auth.getUser()` (server round-trip), not a hardcoded stub. UserMenu renders `user.email` from that prop, and the UAT confirmed the email appears correctly post-login. No hollow-prop paths found.

### Behavioral Spot-Checks

Skipped (no ad-hoc runtime probe needed): the full automated suite was reported green (663 passed / 3 skipped IDOR integration tests that are explicitly env-gated / 0 failed) and `npm run build` succeeded at HEAD `7bd7bff`. The human-driven UAT covered signup → immediate login, login after logout, logout via UserMenu, password reset via local Inbucket, proxy deny-by-default + `/login?next=`, visible cross-user isolation, and curl-without-session → 401. All items APPROVED per the task brief.

### Requirements Coverage

| Requirement | Status        | Evidence                                                                                                                          |
| ----------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| AUTH-01     | ✓ SATISFIED   | Signup/login/logout/password-reset flows all present; Supabase client from `@supabase/ssr` used throughout.                        |
| AUTH-02     | ✓ SATISFIED   | `proxy.ts` deny-by-default + per-action `getCurrentUser()` re-verification. Note on intent below.                                  |
| AUTH-03     | ✓ SATISFIED   | DAL scopes every query by `userId`; actions never accept `userId`; real-DB IDOR integration tests exist (env-gated).              |
| AUTH-04     | ✓ SATISFIED   | `/api/extract-watch` POST runs `getCurrentUser()` before body parse, returns 401 JSON on failure, SSRF layer preserved.            |

### Intent vs. Implementation Note (AUTH-02)

REQUIREMENTS.md wording for AUTH-02 says "re-verified inside every Server Action **and DAL function**". The phase CONTEXT (D-03) explicitly overrides this to "DAL keeps its internal `userId` parameter... DAL does not re-read cookies. This satisfies AUTH-02's intent (every call is session-gated) without doubling session reads per request." This is a documented design decision in `04-CONTEXT.md`, agreed during `/gsd-discuss-phase`, and is consistent with the ROADMAP success criterion #3 wording ("every Server Action and DAL function re-verifies the session via `getCurrentUser()`" — interpreted as "every call path that reaches the DAL has just called `getCurrentUser()` one layer up, and DAL is server-only so there is no untrusted entry point"). The implementation matches D-03 exactly and the UAT confirmed the end-to-end behavior. **Not a gap.** Flagging it here so the next human reviewer can see the deviation from literal REQUIREMENTS.md wording is intentional and documented.

### Gaps

None.

### Human Verification

Already complete — the task brief states the human UAT covered every requirement's user-visible behavior and all were APPROVED, including the two bugs surfaced and fixed during the checkpoint (`e84f980` DropdownMenuGroup, `54dc07f` proxy.ts path). No additional human testing is required for this verifier to sign off.

### Debt / Optional Follow-ups

- **Unused `UnauthorizedError` imports** in `src/app/actions/watches.ts` and `src/app/actions/preferences.ts` — harmless but detectable by lint. Trivial cleanup.
- **Auth form zod parity** — login/signup/forgot/reset currently lean on native HTML validation + Supabase server errors. A future hardening pass could add zod schemas for consistent error shapes, but this is out of Phase 4 scope and does not affect any AUTH-0x requirement.
- **Open-redirect guard at proxy layer** — `proxy.ts` always writes `pathname + search` into `?next=`. The `LoginPage` and `/auth/callback` both guard `safeNext`, so the absolute boundary is safe, but the `next` query param that the proxy writes is raw. Since the login/callback consumers re-validate on every read, there is no exploit surface — noting for completeness.
- **`DropdownMenuItem` semantics** — the logout `<form>` is rendered via `render=` slot. Works but loses the normal `DropdownMenuItem` keyboard affordances (Enter-to-activate goes through the button, not the item). Acceptable for v1.

---

## Final Verdict

**PASS.**

All five ROADMAP Phase 4 success criteria and all four AUTH-0x requirements are satisfied by code present at HEAD. The architecture faithfully implements the Phase 4 CONTEXT decisions (D-01 through D-16 plus the shadow-users trigger from Claude's Discretion). The two bugs surfaced during UAT (`e84f980`, `54dc07f`) are present in the tree and the corrected code is what was verified. No blockers, no warnings, no gaps, only minor info-level cosmetic follow-ups documented above.

_Verified: 2026-04-12_
_Verifier: Claude (gsd-verifier)_
