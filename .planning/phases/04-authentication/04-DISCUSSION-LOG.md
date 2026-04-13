# Phase 04: Authentication — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `04-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-12
**Phase:** 04-authentication
**Areas discussed:** Session contract refactor, Auth methods & scope, Proxy matcher & unauth UX

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Session contract refactor | DAL/Server Action signature changes, `getCurrentUser()` contract, re-verification pattern | ✓ |
| Auth methods & scope | Sign-up methods, email verification, password reset, logout UX | ✓ |
| Proxy matcher & unauth UX | proxy.ts scope, redirect vs 401, post-login redirect | ✓ |
| Shadow users + UI surface | Shadow users row sync, /login /signup route polish | (deferred to Claude's Discretion) |

---

## Session Contract Refactor

### Where should the `who is logged in?` helper live?

| Option | Description | Selected |
|--------|-------------|----------|
| One shared file | `src/lib/auth.ts` with single `getCurrentUser()` function imported everywhere | ✓ |
| Inline in each file | Each Server Action/DAL file reads the session directly, no helper | |

**User's choice:** One shared file
**Notes:** User asked a clarifying question first, wondering if `getCurrentUser()` was for existing users / migration. Clarified that it has nothing to do with localStorage users — it's how the server knows *which logged-in account* made each request. Needed even on an empty database with only one account.

### Should server code stop asking the caller `which user?` and just read it from the session itself?

| Option | Description | Selected |
|--------|-------------|----------|
| Drop userId arg everywhere | `addWatch(data)` not `addWatch(userId, data)` — server reads session | ✓ |
| Keep it, but double-check | Keep arg but also verify the session matches | |

**User's choice:** Drop userId arg everywhere
**Notes:** Applied to Server Actions. DAL keeps internal `userId` param because it's server-only and only called by actions passing a just-verified id (see next decision).

### How paranoid should the data layer be about re-checking the login on every call?

| Option | Description | Selected |
|--------|-------------|----------|
| Check once per request | Server Action reads session once, DAL receives verified id as trusted internal | ✓ |
| Check in every data function | Every DAL call re-reads cookies — literal AUTH-02 reading | |

**User's choice:** Check once per request
**Notes:** Reconciles with the previous answer by keeping DAL's internal userId param. One cookie read per request at the Server Action layer; DAL does not re-read cookies.

### When someone tries to update/delete a watch that isn't theirs, what should happen?

| Option | Description | Selected |
|--------|-------------|----------|
| Throw, action returns error | Keep Phase 3 D-08 behavior, action catches and maps to ActionResult error | ✓ |
| Return null, action handles | Refactor DAL update/delete to return null on miss | |

**User's choice:** Throw, action returns error

---

## Auth Methods & Scope

### How should sign-up / log-in actually work?

| Option | Description | Selected |
|--------|-------------|----------|
| Email + password only | Classic forms, nothing else | ✓ |
| Magic link only | No password, email login links | |
| Email+password AND Google OAuth | Both, with Google callback | |

**User's choice:** Email + password only

### Should Supabase require the user to click a verification link before they can log in?

| Option | Description | Selected |
|--------|-------------|----------|
| Off for now | Immediate login after signup, toggle later via dashboard | ✓ |
| On from day one | Email confirmation interstitial + callback | |

**User's choice:** Off for now

### Password reset flow in this phase, or defer?

| Option | Description | Selected |
|--------|-------------|----------|
| Defer | No forgot-password link, use Supabase dashboard as escape hatch | |
| Build it | Full forgot-password → email → /auth/callback → /reset-password flow | ✓ |

**User's choice:** Build it
**Notes:** User opted for the full reset flow despite it being a single-user app. Requires Supabase SMTP to be configured; planner/executor should flag if missing in local Supabase instance.

### Should the logout button live in the header, or only on a dedicated account page?

| Option | Description | Selected |
|--------|-------------|----------|
| Header dropdown | User menu in header with Log out item, Server Action form POST | ✓ |
| Account page only | Logout lives on /account or /preferences | |

**User's choice:** Header dropdown

---

## Proxy Matcher & Unauth UX

### Which routes should `proxy.ts` protect?

| Option | Description | Selected |
|--------|-------------|----------|
| Deny-by-default | Protect everything except explicit allowlist (login, signup, auth/*, static) | ✓ |
| Allow-by-default | Only protect an explicit list of known routes | |

**User's choice:** Deny-by-default

### When `/api/extract-watch` gets an unauthenticated request, what should it return?

| Option | Description | Selected |
|--------|-------------|----------|
| 401 JSON | `NextResponse.json({error:'Unauthorized'}, {status:401})` | ✓ |
| Redirect to /login | Redirect the API call | |

**User's choice:** 401 JSON

### When a Server Action hits `getCurrentUser()` and finds no session, what should the user see?

| Option | Description | Selected |
|--------|-------------|----------|
| ActionResult error → client redirects | Action returns `{success:false, error:'Not authenticated'}`, client navigates | ✓ |
| Action calls redirect('/login') | Action calls Next `redirect()` directly | |

**User's choice:** ActionResult error → client redirects

### After a successful login, where does the user land?

| Option | Description | Selected |
|--------|-------------|----------|
| Respect ?next param | Proxy redirects to `/login?next=<path>`, login form honors it | ✓ |
| Always go home | Land on `/` regardless | |

**User's choice:** Respect ?next param

---

## Claude's Discretion

- Shadow `users` table row sync mechanism — DB trigger vs app-side upsert (planner's choice, must ship this phase)
- Auth UI styling depth — shadcn primitives, planner decides layout reuse
- Login form state handling — useActionState vs useTransition
- Error message copy — neutral, no user enumeration

## Deferred Ideas

- OAuth providers (Google, GitHub, Apple)
- Magic link login
- Passkeys / WebAuthn
- Email verification gate (toggled off, can flip later via dashboard)
- Multi-session / device list management
- Rate limiting on auth endpoints beyond Supabase built-ins
- Test user seeding script
- UI rewire to Server Components (Phase 5)
- localStorage import banner (Phase 5, MIG-01/02)
