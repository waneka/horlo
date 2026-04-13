---
doc_type: phase-research
phase: "04"
phase_name: authentication
researched: 2026-04-12
confidence: HIGH
---

# Phase 4: Authentication — Research

## Summary

Phase 4 bolts Supabase Auth onto the Phase 3 data layer using `@supabase/ssr` (latest `0.10.2` — verified via `npm view`) alongside `@supabase/supabase-js` (`2.103.0`). Neither package is currently in `package.json` (verified by reading `/Users/tylerwaneka/Documents/horlo/package.json`), so the plan needs a Wave 0 install task. The data-layer foundations are favorable: `src/db/schema.ts` already defines a shadow `users` table with a UUID PK (`users.id`) that cascades to `watches.userId` and `user_preferences.userId` (Phase 3 D-03); no schema changes are required to land AUTH-01..04. Existing Server Actions in `src/app/actions/watches.ts` and `src/app/actions/preferences.ts` currently accept a `userId` parameter with a `TODO(Phase 4)` comment — the Phase 4 work is to drop that parameter, read the id from `getCurrentUser()` inside the action, and pass it to the DAL (which keeps its current signature per CONTEXT D-03).

The biggest Next.js 16 gotchas for the planner: (1) `cookies()` from `next/headers` is **async** — every call site inside Server Actions and route handlers must `await cookies()` (verified in `node_modules/next/dist/docs/01-app/02-guides/authentication.md`); (2) the file is `proxy.ts`, not `middleware.ts`, and the existing repo has **neither** file yet (there is nothing for the `middleware-to-proxy` codemod to rename — the planner should skip the codemod step and write `proxy.ts` from scratch); (3) the proxy docs carry an explicit warning that proxy matchers don't protect Server Functions reliably ("A matcher change or a refactor that moves a Server Function to a different route can silently remove Proxy coverage. Always verify authentication and authorization inside each Server Function rather than relying on Proxy alone") — this is exactly why CONTEXT D-03/D-14 require `getCurrentUser()` inside every Server Action and inside `/api/extract-watch`.

The `@supabase/ssr` cookie adapter for Next.js 16 uses a **`getAll`/`setAll`** shape (not the older `get`/`set`/`remove` adapter from 2023 — the older shape is deprecated and Supabase discussion #34842 confirms AI tools still emit the wrong one). The proxy version of the adapter is more involved than the server-component version because `setAll` must both (a) replay cookies onto the incoming request object so downstream RSCs see the refreshed session, and (b) attach `Set-Cookie` headers to the outgoing `NextResponse` — the standard idiom reconstructs `NextResponse.next({ request })` inside `setAll` to carry both. The password-reset flow in the current Supabase Next.js quickstart uses **`verifyOtp({ type: 'recovery', token_hash })`** (newer, non-PKCE) rather than `exchangeCodeForSession` — both work, but `verifyOtp` is the documented pattern as of 2026 and requires the email template to pass `token_hash` and `type=recovery` in the query string.

**Primary recommendation:** Copy the canonical three-file Supabase helper pattern (`src/lib/supabase/server.ts` for RSC+Action+Route-handler usage, `src/lib/supabase/client.ts` for browser usage, `src/lib/supabase/proxy.ts` for the proxy cookie adapter), wrap the server version with a `getCurrentUser()` / `UnauthorizedError` facade in `src/lib/auth.ts`, and install the shadow-user row via a **Postgres trigger** on `auth.users` — it lives in a Drizzle-compatible SQL migration, has zero race conditions, and runs before any app code touches the row.

## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01 through D-16)

- **D-01:** `getCurrentUser()` in `src/lib/auth.ts` (server-only). Returns `{ id: string; email: string }`; throws `UnauthorizedError` on missing/invalid session. Uses `@supabase/ssr` `createServerClient()` + `supabase.auth.getUser()` (NOT `getSession()`).
- **D-02:** Server Actions drop the `userId` parameter. New signatures: `addWatch(data)`, `editWatch(watchId, data)`, `removeWatch(watchId)`, `savePreferences(data)`. ID is read inside the action from the session.
- **D-03:** DAL keeps its internal `userId` parameter (unchanged signatures). One cookie read per request at the Server Action layer.
- **D-04:** Server Action pattern: call `getCurrentUser()` in a try/catch; on throw, return `{success:false, error:'Not authenticated'}`; on success, zod-parse, then call DAL with `user.id`.
- **D-05:** DAL update/delete keep `throw new Error('Watch not found or access denied')` (Phase 3 D-08). Actions catch and map to `{success:false, error:'Not found'}`.
- **D-06:** `UnauthorizedError` class in `src/lib/auth.ts` for `instanceof` checks.
- **D-07:** Every call site in `src/app/actions/watches.ts` and `src/app/actions/preferences.ts` updates to new signatures. Phase 3 tests passing a `userId` arg must be updated; DAL tests unaffected.
- **D-08:** Email + password only. No OAuth, magic links, passkeys.
- **D-09:** Email verification disabled in Supabase (`Confirm email` off). Sign-up → immediately logged in.
- **D-10:** Password reset IS in scope. Full flow: `/forgot-password` → `resetPasswordForEmail` → email → `/auth/callback?type=recovery&token_hash=...` → `/reset-password` → `supabase.auth.updateUser({password})` → `/`. Requires Supabase SMTP configured (flag if not).
- **D-11:** Logout via header dropdown — user menu with `Log out` Server Action form POST. Use shadcn `DropdownMenu`.
- **D-12:** Deny-by-default proxy matcher. Exclude only `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth/*`, `_next/*`, `/favicon.ico`, static asset paths.
- **D-13:** Proxy redirects unauth → `/login?next=<path>` (path + search). Login form reads `next` from `searchParams`; falls back to `/`.
- **D-14:** `/api/extract-watch` returns `401 JSON` when unauthenticated. Route handler itself calls `getCurrentUser()` at top, before SSRF check. Do NOT rely on proxy alone for API routes.
- **D-15:** Tampered/expired session in a Server Action returns `{success:false, error:'Not authenticated'}` — NOT a `redirect()`. Client navigates to `/login?next=<current>` itself. Preserves Phase 3 D-12.
- **D-16:** Proxy uses `@supabase/ssr` `createServerClient()` with cookie adapter that reads request + writes response. Calls `supabase.auth.getUser()` on every proxied request to refresh cookies. Researcher must confirm exact cookie-propagation idiom — **resolved below, Q1**.

### Claude's Discretion

- Shadow `users` table row sync method (DB trigger vs app-side upsert) — **researcher recommends Postgres trigger, see Q7**.
- Auth UI styling depth (shared `AuthLayout` wrapper vs per-page cards).
- Login form state handling (`useActionState` vs manual `useTransition`).
- Error messaging copy (keep neutral, no user enumeration).
- Test user seed script (nice-to-have).

### Deferred Ideas (OUT OF SCOPE — ignore)

- OAuth providers (Google/GitHub/Apple)
- Magic link login
- Passkeys / WebAuthn
- Email verification gate (toggle via dashboard later)
- Multi-session / device list
- Rate limiting on `/login` / `/forgot-password`
- UI rewire of pages to Server Components reading DAL → **Phase 5**
- localStorage import banner → **Phase 5 (MIG-01, MIG-02)**

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Supabase Auth via `@supabase/ssr`; users can sign up, log in, log out | Q1, Q2, Q5, Q6, Q10 — full `@supabase/ssr` client setup, proxy, email/password flows |
| AUTH-02 | Auth enforced via `proxy.ts` AND re-verified inside every Server Action and DAL function | Q2, Q3, Q8 — proxy matcher + Server Action `getCurrentUser()` pattern + `UnauthorizedError` |
| AUTH-03 | Per-user data isolation at DAL; client-supplied IDs never trusted | Phase 3 DAL already does WHERE userId scoping; D-02 drops client-supplied userId. Q7 ensures FK resolves via shadow-user sync |
| AUTH-04 | `POST /api/extract-watch` requires authenticated session | Q4 — `getCurrentUser()` at top of route handler, returns 401 JSON on throw |

## Open Questions Resolved

### Q1. `@supabase/ssr` cookie propagation in Next 16 `proxy.ts`

**Resolved — HIGH confidence.** [VERIFIED: `/Users/tylerwaneka/Documents/horlo/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`; [CITED: Supabase SSR 2026 migration guide](https://medium.com/@securestartkit/next-js-proxy-ts-auth-migration-guide-ff7489ec8735); [CITED: Supabase docs — Creating a Supabase client for SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client)]

The cookie adapter shape for `@supabase/ssr` ≥0.4 is **`getAll`/`setAll`** — NOT the legacy `get`/`set`/`remove`. Supabase Discussion #34842 documents that AI tools (including this one, before this research) frequently emit the deprecated shape. Use exactly the following pattern for `src/lib/supabase/proxy.ts` (adapter factory used by `proxy.ts` at the repo root):

```ts
// src/lib/supabase/proxy.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Replay onto the incoming request so downstream RSCs see refreshed cookies
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          // Reconstruct response to carry the mutated request headers upstream
          response = NextResponse.next({ request: { headers: request.headers } })
          // Attach Set-Cookie to the outgoing response
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // IMPORTANT: calling getUser() here BOTH verifies the session server-side
  // AND triggers the refresh-token round-trip that populates setAll().
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { supabase, user, response }
}
```

The `response` variable is **captured by closure** and reassigned inside `setAll` — this is the idiom Supabase docs recommend because `NextResponse.next({ request })` is the only way to propagate mutated request headers to downstream rendering. The proxy entry point then uses the returned `user` for the auth decision and returns `response` (not a fresh `NextResponse.next()`) so the refreshed `Set-Cookie` headers survive.

### Q2. `proxy.ts` matcher syntax in Next 16

**Resolved — HIGH confidence.** [VERIFIED: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` lines 600–665]

Exact matcher export shape for deny-by-default (D-12):

```ts
// proxy.ts (at repo root, NOT src/ — horlo has no src/ proxy and src-at-root is also valid;
// either location works per Next 16 docs, but repo root is simpler and matches existing config files)
export const config = {
  matcher: [
    // Match everything EXCEPT static assets and internal next paths.
    // The public auth routes are handled *inside* the proxy function by a path check,
    // not by the matcher, because we still need the proxy to refresh the session cookie
    // on /login etc. (so a user who logs in sees their session cookie come through).
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
```

**Critical nuance from the Next docs (line 659):** "Even when `_next/data` is excluded in a negative matcher pattern, proxy will still be invoked for `_next/data` routes. This is intentional behavior to prevent accidental security issues." This means Next will always re-invoke the proxy for data requests even if the matcher says otherwise — don't rely on matcher exclusions for security, only for performance.

**The public-path allowlist lives inside the proxy function**, not in the matcher:

```ts
const PUBLIC_PATHS = ['/login', '/signup', '/forgot-password', '/reset-password', '/auth']
const isPublic = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p))
if (!user && !isPublic) {
  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search)
  return NextResponse.redirect(loginUrl)
}
```

### Q3. Server Action session read pattern in Next 16

**Resolved — HIGH confidence.** [VERIFIED: `node_modules/next/dist/docs/01-app/02-guides/authentication.md` lines 641–795 — all `cookies()` call sites use `await cookies()`]

`cookies()` from `next/headers` is **async** in Next 16. Every Server Action, Server Component, and Route Handler must `await cookies()`. The canonical server helper:

```ts
// src/lib/supabase/server.ts
import 'server-only'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function createSupabaseServerClient() {
  const cookieStore = await cookies() // <-- await is REQUIRED in Next 16

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Server Components cannot set cookies — this is expected.
            // The proxy handles cookie refresh; this try/catch is documented
            // in the Supabase docs as the correct no-op fallback.
          }
        },
      },
    },
  )
}
```

And the auth facade:

```ts
// src/lib/auth.ts
import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export class UnauthorizedError extends Error {
  constructor(message = 'Not authenticated') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export async function getCurrentUser(): Promise<{ id: string; email: string }> {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new UnauthorizedError()
  return { id: user.id, email: user.email! }
}
```

### Q4. Route handler (`POST /api/extract-watch`) auth check

**Resolved — HIGH confidence.** Route handlers use the exact same `createSupabaseServerClient()` + `getCurrentUser()` pattern as Server Actions. The `cookies()` call inside the helper works identically because Next 16 route handlers are allowed to read AND write cookies (unlike Server Components).

Ordering for the handler at `src/app/api/extract-watch/route.ts`:

```ts
import { UnauthorizedError, getCurrentUser } from '@/lib/auth'
// ... existing imports

export async function POST(request: NextRequest) {
  // 1. AuthN gate FIRST (cheapest rejection, AUTH-04)
  try {
    await getCurrentUser()
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    throw err
  }

  // 2. Existing URL/SSRF validation + fetchAndExtract (unchanged)
  // ...
}
```

### Q5. Password reset flow with `@supabase/ssr`

**Resolved — HIGH confidence.** [CITED: [Supabase UI — Password-based Authentication for Next.js](https://supabase.com/ui/docs/nextjs/password-based-auth)]

The **current** (2026) Supabase Next.js quickstart uses `verifyOtp({ type: 'recovery', token_hash })` in a route handler at `/auth/confirm` (or `/auth/callback` — name is free). The older `exchangeCodeForSession` API still exists but is for the PKCE flow; `verifyOtp` is what ships in the default Supabase email template.

**Flow:**

1. `/forgot-password` page client form calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback?next=/reset-password` })`.
2. Supabase email template (configured in dashboard) contains a link shaped like:
   ```
   {{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
   ```
3. `src/app/auth/callback/route.ts` GET handler reads `token_hash`, `type`, `next` from `searchParams`, calls `supabase.auth.verifyOtp({ type, token_hash })`, which sets the recovery session cookie via the server client's `setAll`, then `redirect(next ?? '/')`.
4. `/reset-password` page — now protected by a **real session**, so the proxy allows it even for "logged-out" users (they're logged in as the recovery session). Form POST calls `supabase.auth.updateUser({ password })` via a Server Action, then `redirect('/')`.
5. Logout or session expiry returns user to normal unauthenticated state.

**"Is this a recovery session vs normal login?"** — Supabase does not expose a first-class flag for this in the session object. The practical answer: don't gate UX on it. After `verifyOtp({type:'recovery'})` the user has a normal session; the `/reset-password` page is just a page they're routed to after callback. The security property comes from the fact that `verifyOtp` requires the valid `token_hash` from the email — an attacker without the email link cannot reach `/reset-password` with a recovery session. If you want stricter UX (e.g., force password change before anything else works), check a custom user metadata flag you set during `resetPasswordForEmail`.

**Supabase SMTP requirement:** Local Supabase (`supabase start` via the Supabase CLI) ships with an embedded Inbucket SMTP server on port 54324 — emails land in a local web inbox visible at `http://localhost:54324`. No external SMTP config needed for local dev. **But** the repo currently has no `supabase/` directory (verified via `ls`), which means local Supabase CLI is not yet initialized. See Q10 for the install/init task.

### Q6. Logout Server Action

**Resolved — HIGH confidence.** The pattern:

```ts
// src/app/actions/auth.ts
'use server'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function logout() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut() // clears cookies via the setAll adapter
  redirect('/login')
}
```

`supabase.auth.signOut()` internally calls `setAll` with expired cookies, which clears them in the response. `redirect()` from `next/navigation` throws a special Next signal — this is **not** a "throw across the boundary" violation of Phase 3 D-12; `redirect()` is the documented way to navigate from Server Actions and Next handles the signal internally. The logout action is the one documented exception to the "never throw" rule.

**Form POST usage in Header.tsx dropdown:**

```tsx
<form action={logout}>
  <button type="submit">Log out</button>
</form>
```

Works without JS (progressive enhancement), which satisfies D-11.

### Q7. Shadow `users` table sync on first sign-up — **RECOMMENDATION**

**Resolved — HIGH confidence.** [VERIFIED: `src/db/schema.ts` lines 14–21 — `users` table exists; [VERIFIED: Supabase CLI supports SQL migrations via `supabase/migrations/` directory]]

**Recommend option (a): Postgres trigger on `auth.users` INSERT.**

Rationale:

1. **Zero race conditions.** The trigger runs in the same transaction as the Supabase Auth signup insert — the `public.users` row exists before any Server Action code runs. There is no window where a logged-in user can call `addWatch` and hit a FK violation.
2. **No branch on every request.** Option (b) requires `getCurrentUser()` to do `SELECT ... FROM public.users WHERE id = $1` on every request, or maintain an in-memory "seen user" cache that gets invalidated on deploy. Trigger avoids this entirely.
3. **Single-user app for now.** The cost of "writing SQL" is negligible because Horlo already uses Drizzle, which means migrations live alongside the schema. Local Supabase CLI (`supabase migration new create_users_trigger`) makes this a one-file addition.
4. **Lives alongside schema.** `supabase/migrations/NNNNNNNN_sync_auth_users.sql` sits next to the Drizzle schema and is version-controlled.

**The SQL (for the planner to verbatim copy):**

```sql
-- supabase/migrations/20260413000000_sync_auth_users.sql
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();
```

Note the trigger uses `security definer` because `auth.users` is in a schema owned by Supabase's internal role — the trigger must run with elevated privileges to write to `public.users`. This is the standard Supabase pattern.

**Caveat the planner must flag:** The repo currently has no `supabase/` directory. The plan needs an explicit "install Supabase CLI, `supabase init`, `supabase start`" task before the migration can be created.

### Q8. `UnauthorizedError` pattern — prior art

**Resolved — HIGH confidence.** [VERIFIED: `src/data/watches.ts` lines 137, 151 — no custom error class, uses plain `new Error('Watch not found or access denied: ...')`]

There is **no prior art** for a custom error class in the Horlo codebase — Phase 3 DAL uses plain `Error` with a message pattern (grep returns no `class ... extends Error`). The Phase 4 `UnauthorizedError` is greenfield.

Recommended shape (simple, no interaction with Next.js error boundaries):

```ts
export class UnauthorizedError extends Error {
  constructor(message = 'Not authenticated') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}
```

Server Actions catch with `instanceof UnauthorizedError` and map to `{success:false, error:'Not authenticated'}`. Do **not** use Next.js `error.tsx` boundaries for this — those are for page render errors, and Phase 3 D-12 mandates ActionResult shapes.

**Subtle interaction:** `src/data/watches.ts` uses plain `Error` with the message `Watch not found or access denied: ...`. Server Actions already catch these. Adding `UnauthorizedError` does NOT require changing the DAL — it's only used inside `getCurrentUser()`, which lives one layer above the DAL. The DAL still throws its existing generic errors and is unaware of auth.

### Q9. Existing Header.tsx location

**Resolved — HIGH confidence.** [VERIFIED: `/Users/tylerwaneka/Documents/horlo/src/components/layout/Header.tsx` — 53 lines, `'use client'` component with `ThemeToggle`, `MobileNav`, `navItems` array, and an "Add Watch" button]

File exists at **`src/components/layout/Header.tsx`** and is a client component. It currently has:

- Line 2: `'use client'`
- Lines 44–49: right-side container with `<ThemeToggle />` and `<Link href="/watch/new"><Button>Add Watch</Button></Link>`

The user dropdown (D-11) drops into lines 44–49 between `ThemeToggle` and the Add Watch button. **Because `Header.tsx` is a client component**, it cannot directly call `getCurrentUser()` (which is `'server-only'`). Two options for the planner:

1. **Convert Header.tsx to a Server Component**, pass `user` as a prop. Requires removing `usePathname()` at line 17 — nav items would need their active-state logic moved to a child client component. Non-trivial churn.
2. **Keep Header.tsx client, add a `<UserMenu />` Server Component** that fetches the user via `getCurrentUser()` and renders either "Log in" link (for public routes) or the dropdown. Simpler — only new code, no refactor of the existing active-link logic.

**Recommend option 2.** It respects the existing client/server split and only touches lines 44–49. The `UserMenu` Server Component renders inside the still-client `Header`, which works in Next.js 16 App Router (client components can render server components passed as children/props — but can NOT import them directly; instead, the `layout.tsx` should render `<Header><UserMenu /></Header>` OR the Header shell becomes a server component that wraps the existing client logic).

**Actually simplest for minimal churn:** convert `Header.tsx` to a server component, extract the `usePathname`-dependent nav rendering into `HeaderNav.tsx` as a client component. The Header can then `await getCurrentUser()` inline (wrapped in try/catch that sets `user = null` on `UnauthorizedError`), and render `<UserMenu user={user} />` or `<Link href="/login">Log in</Link>`. Roughly a 20-line refactor. Planner chooses.

**Shadcn `DropdownMenu` primitive is NOT installed** — verified via `ls src/components/ui/` which shows `badge, button, card, chart, checkbox, dialog, input, label, popover, select, sheet, tabs, textarea`. The plan needs a task: `npx shadcn@latest add dropdown-menu`.

### Q10. `@supabase/ssr` installation state

**Resolved — HIGH confidence.** [VERIFIED: `/Users/tylerwaneka/Documents/horlo/package.json` — searched for "supabase", only `drizzle-orm`/`postgres` appear; no `@supabase/*` packages]

**Neither `@supabase/ssr` nor `@supabase/supabase-js` is installed.** The plan needs:

```bash
npm install @supabase/ssr@0.10.2 @supabase/supabase-js@2.103.0
```

(Versions verified via `npm view @supabase/ssr version` → `0.10.2` and `npm view @supabase/supabase-js version` → `2.103.0` on 2026-04-12.)

**Env var state:** `.env.example` currently documents `ANTHROPIC_API_KEY` and `DATABASE_URL`. **Missing:**

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from `supabase status` after `supabase start`>
```

The local Supabase CLI default URL is `http://127.0.0.1:54321`, and `supabase start` emits the anon key in its output. The plan needs an ".env.example update" task.

**Supabase CLI state:** There is no `supabase/` directory at the repo root — the CLI is not yet initialized. The plan needs a sequential chain:

1. Install Supabase CLI (brew/npm — CLI version not pinned in repo)
2. `supabase init` (creates `supabase/config.toml`)
3. Edit `supabase/config.toml` to disable email confirmation (`[auth.email] enable_confirmations = false` per D-09)
4. `supabase start` (spins up local Postgres, GoTrue, Kong, Inbucket SMTP)
5. Read env values from `supabase status`, populate `.env.local`
6. Create migration file for the shadow-user trigger (Q7)
7. `supabase migration up` to apply

Phase 3 used `DATABASE_URL` against what must have been a manually-run Postgres instance (Phase 3 D-15 says "local Supabase CLI" but the `supabase/` directory does not exist — **confirm with user whether Phase 3 actually used Supabase CLI or a separate Postgres**). If Phase 3 used a standalone Postgres, switching to `supabase start` may require re-pushing the Drizzle schema (`drizzle-kit push`) against the new local DB.

### Q11. Nyquist Validation Architecture

**Resolved — HIGH confidence.** Test infrastructure already exists: Vitest 2.1.9 + jsdom + RTL 16.3.2 + MSW 2.13.2 ([VERIFIED: `package.json` lines 42–49]; `vitest.config.ts` at project root). Test files live under `tests/` (flat layout, not colocated). Run commands:

- Quick (single file): `npx vitest run tests/<file>.test.ts`
- Full suite: `npm test` (runs `vitest run`)
- Watch: `npm run test:watch`

See the **Validation Architecture** section below for the REQ → test map.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 + jsdom 25.0.1 + @testing-library/react 16.3.2 + MSW 2.13.2 |
| Config file | `/Users/tylerwaneka/Documents/horlo/vitest.config.ts` |
| Quick run command | `npx vitest run tests/<file>.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| AUTH-01 | `getCurrentUser()` returns `{id,email}` when Supabase returns a user | unit (mocked supabase client) | `npx vitest run tests/auth.test.ts` | ❌ Wave 0 |
| AUTH-01 | `getCurrentUser()` throws `UnauthorizedError` when Supabase returns null user | unit | same | ❌ Wave 0 |
| AUTH-01 | Logout Server Action calls `signOut` and redirects | unit (mocked) | `npx vitest run tests/actions/auth.test.ts` | ❌ Wave 0 |
| AUTH-02 | `proxy.ts` redirects unauth request on protected path to `/login?next=<path>` | unit (Next experimental testing helper `unstable_doesProxyMatch` + direct `proxy()` call with mock `NextRequest`) | `npx vitest run tests/proxy.test.ts` | ❌ Wave 0 |
| AUTH-02 | `proxy.ts` allows unauth request on `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth/*` | unit | same | ❌ Wave 0 |
| AUTH-02 | `proxy.ts` lets authenticated request through with refreshed cookies | unit (mock supabase.auth.getUser returning user) | same | ❌ Wave 0 |
| AUTH-02 | `addWatch` Server Action returns `{success:false,error:'Not authenticated'}` when `getCurrentUser` throws | unit (mock `getCurrentUser`) | `npx vitest run tests/actions/watches.test.ts` | ❌ Wave 0 (existing file for Phase 3 tests may exist — check) |
| AUTH-02 | `savePreferences` Server Action returns `{success:false,error:'Not authenticated'}` when `getCurrentUser` throws | unit | `npx vitest run tests/actions/preferences.test.ts` | ❌ Wave 0 |
| AUTH-03 | IDOR: `editWatch('other-user-watch-id', data)` returns `{success:false,error:'Not found'}` — session id is User A, watch belongs to User B | integration against real local Postgres | `npx vitest run tests/data/isolation.test.ts` | ❌ Wave 0 |
| AUTH-03 | IDOR: `removeWatch('other-user-watch-id')` returns `{success:false,error:'Not found'}` | integration | same | ❌ Wave 0 |
| AUTH-04 | `POST /api/extract-watch` returns `401 {error:'Unauthorized'}` when session missing | unit/integration (direct handler call with mock `NextRequest`) | `npx vitest run tests/api/extract-watch-auth.test.ts` | ❌ Wave 0 |
| AUTH-04 | `POST /api/extract-watch` proceeds past auth check and enters SSRF gate when session present | unit | same | ❌ Wave 0 |
| **Manual** | Full signup → login → add watch → logout flow against local Supabase | manual UAT (executor checklist) | n/a | n/a |
| **Manual** | Password reset end-to-end against local Inbucket (`http://localhost:54324`) | manual UAT | n/a | n/a |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/<file>.test.ts` for the file the task touched (< 30s)
- **Per wave merge:** `npm test` (full suite, all Phase 1–4 tests must stay green)
- **Phase gate:** Full suite green + manual UAT checklist for the two manual items before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/auth.test.ts` — `getCurrentUser` + `UnauthorizedError` unit coverage
- [ ] `tests/actions/auth.test.ts` — logout action
- [ ] `tests/actions/watches.test.ts` — extend or create; auth-error paths
- [ ] `tests/actions/preferences.test.ts` — extend or create; auth-error paths
- [ ] `tests/proxy.test.ts` — matcher + function behavior tests
- [ ] `tests/data/isolation.test.ts` — IDOR tests against real Postgres (may need a test db connection fixture if Phase 3 didn't set one up — check)
- [ ] `tests/api/extract-watch-auth.test.ts` — route handler auth gate
- [ ] Shared test helper for mocking `createSupabaseServerClient` — `tests/helpers/mock-supabase.ts`

## Risks & Gotchas

1. **`cookies()` is async in Next 16.** Every forgotten `await` produces a silent empty cookie list — which makes `supabase.auth.getUser()` return `null` and every authenticated user look unauthenticated. Add an ESLint rule or a grep check in CI. ([VERIFIED: Next 16 authentication guide uses `await cookies()` in every example])

2. **The cookie adapter shape matters.** `@supabase/ssr` 0.10.x requires `getAll/setAll` — the older `get/set/remove` shape is deprecated and some AI-emitted code (and older Stack Overflow answers) still use it. Symptom: TypeScript compiles but sessions never refresh. ([CITED: Supabase GitHub Discussion #34842](https://github.com/orgs/supabase/discussions/34842))

3. **Proxy does NOT protect Server Functions reliably.** Next docs explicitly state (proxy.md line 214): "A matcher change or a refactor that moves a Server Function to a different route can silently remove Proxy coverage. Always verify authentication and authorization inside each Server Function rather than relying on Proxy alone." This is why D-04/D-14 exist — don't let the proxy become a false sense of security.

4. **`supabase.auth.getSession()` vs `getUser()`.** `getSession()` just decodes the cookie without contacting Supabase — a tampered but valid-shaped cookie will pass. `getUser()` hits the Supabase server. **Always use `getUser()` in `proxy.ts` and `getCurrentUser()`.** ([VERIFIED: CONTEXT D-01, Supabase advanced guide])

5. **Header.tsx is a client component.** It cannot directly `await getCurrentUser()`. Planner must either convert Header to a server component (extracting `usePathname` logic) or pass the user down from `layout.tsx`. See Q9.

6. **shadcn `DropdownMenu` primitive not installed.** Needs `npx shadcn@latest add dropdown-menu` task.

7. **No `supabase/` directory in repo.** Phase 3 context claims the CLI was used (D-15), but `ls` shows no `supabase/` folder. Phase 4 plan must either verify with user that Supabase CLI is set up outside the repo, or include an init task. This is blocking for local email flows (password reset depends on Inbucket).

8. **`redirect()` inside Server Actions throws a special signal.** This is normal and is NOT a Phase 3 D-12 violation. Only the logout action and the `/auth/callback` route handler should use `redirect()`; other actions still return ActionResult.

9. **Password reset "recovery session" has no dedicated flag.** Don't try to programmatically distinguish a recovery session from a normal session in code — rely on routing (the `/auth/callback` handler redirects to `/reset-password`, the only page that can submit `updateUser({password})`).

10. **Phase 3 `TODO(Phase 4)` comments must be removed** in `src/app/actions/watches.ts` (line 3) and `src/app/actions/preferences.ts` (line 3) as part of the Server Action refactor. If the plan leaves these comments, `grep TODO` post-phase will be noisy.

11. **Existing Phase 3 tests may pass `userId` as a Server Action argument** and will break when D-02 drops the parameter. Check `tests/actions/` (if any exists) before landing D-07.

12. **IDOR test setup is non-trivial** — it needs two real users in the `users` table and two real watches owned by different users. This is more than a mocked unit test; it's an integration test against local Postgres. If Phase 3 did not leave a DB test fixture, Wave 0 needs to create one (seeded-db Vitest setup file).

13. **Proxy runs on every request** (negative-lookahead matcher). Every request incurs a `supabase.auth.getUser()` round-trip. For local dev this is ~10ms; for prod this depends on Supabase latency. Not a blocker for v1 single-user but worth noting in the phase review.

## Recommended Structure

```
horlo/
├── proxy.ts                                          # NEW: root, Next 16 proxy entry — cookie adapter + auth redirect
├── supabase/                                         # NEW: Supabase CLI project (if not already)
│   ├── config.toml                                   # NEW: auth.email.enable_confirmations = false
│   └── migrations/
│       └── 20260413000000_sync_auth_users.sql       # NEW: trigger on auth.users → public.users
├── .env.example                                      # UPDATE: add NEXT_PUBLIC_SUPABASE_URL + _ANON_KEY
├── src/
│   ├── lib/
│   │   ├── auth.ts                                   # NEW: getCurrentUser + UnauthorizedError
│   │   └── supabase/
│   │       ├── server.ts                             # NEW: createSupabaseServerClient (RSC/Action/Route)
│   │       ├── client.ts                             # NEW: createBrowserClient (for /login, /signup, /forgot-password client forms)
│   │       └── proxy.ts                              # NEW: updateSession helper used by root proxy.ts
│   ├── app/
│   │   ├── login/
│   │   │   ├── page.tsx                              # NEW: Server Component, reads `next` from searchParams
│   │   │   └── login-form.tsx                        # NEW: 'use client', calls supabase.auth.signInWithPassword
│   │   ├── signup/
│   │   │   ├── page.tsx                              # NEW
│   │   │   └── signup-form.tsx                       # NEW: calls supabase.auth.signUp
│   │   ├── forgot-password/
│   │   │   ├── page.tsx                              # NEW
│   │   │   └── forgot-password-form.tsx              # NEW: calls resetPasswordForEmail with redirectTo
│   │   ├── reset-password/
│   │   │   ├── page.tsx                              # NEW: Server Component, requires session
│   │   │   └── reset-password-form.tsx               # NEW: calls supabase.auth.updateUser({password})
│   │   ├── auth/
│   │   │   └── callback/
│   │   │       └── route.ts                          # NEW: GET handler, verifyOtp({type,token_hash}), redirect(next)
│   │   ├── actions/
│   │   │   ├── auth.ts                               # NEW: logout Server Action
│   │   │   ├── watches.ts                            # UPDATE: drop userId param, add getCurrentUser() prologue (D-02, D-04, D-07)
│   │   │   └── preferences.ts                        # UPDATE: same pattern (D-02, D-07)
│   │   └── api/
│   │       └── extract-watch/
│   │           └── route.ts                          # UPDATE: getCurrentUser() gate at top (D-14, AUTH-04)
│   └── components/
│       ├── layout/
│       │   ├── Header.tsx                            # UPDATE: convert to server component OR add UserMenu slot (Q9)
│       │   └── UserMenu.tsx                          # NEW: server component, renders DropdownMenu + logout form or "Log in" link
│       └── ui/
│           └── dropdown-menu.tsx                     # NEW: added via `npx shadcn@latest add dropdown-menu`
└── tests/
    ├── helpers/
    │   └── mock-supabase.ts                          # NEW: shared vi.mock helper for createSupabaseServerClient
    ├── auth.test.ts                                  # NEW: getCurrentUser + UnauthorizedError
    ├── proxy.test.ts                                 # NEW: proxy.ts behavior
    ├── actions/
    │   ├── auth.test.ts                              # NEW: logout
    │   ├── watches.test.ts                           # NEW or UPDATE: auth-error paths
    │   └── preferences.test.ts                       # NEW or UPDATE
    ├── data/
    │   └── isolation.test.ts                         # NEW: IDOR integration test
    └── api/
        └── extract-watch-auth.test.ts                # NEW: AUTH-04 route handler gate
```

**Modified files (count):** 5 (`package.json`, `.env.example`, `src/app/actions/watches.ts`, `src/app/actions/preferences.ts`, `src/app/api/extract-watch/route.ts`, `src/components/layout/Header.tsx`)

**New files (count):** ~22 (proxy, auth lib, supabase lib, 4 auth pages + forms, callback route, logout action, UserMenu, dropdown-menu primitive, migration, 7 test files, 1 test helper)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Phase 3 did NOT leave a test DB fixture that multi-user integration tests can reuse | Validation Architecture / Wave 0 Gaps | Medium — Wave 0 adds a setup file that duplicates existing fixture, minor rework |
| A2 | Phase 3 local DB is reachable at the same `DATABASE_URL` that a fresh `supabase start` would produce | Q10 | Medium — may need to re-run `drizzle-kit push` against new port/credentials |
| A3 | `supabase start` is the expected local dev path (vs a manually-managed standalone Postgres) | Q10 | Low — if user prefers standalone, Q10 install chain just collapses to "create shadow-user trigger via drizzle migration" |
| A4 | Shadcn `DropdownMenu` primitive is installable via the default `npx shadcn@latest add` path in this repo's `components.json` | Recommended Structure | Low — worst case planner picks a base-ui DropdownMenu equivalent |
| A5 | The `middleware-to-proxy` codemod is a no-op on this repo (no `middleware.ts` exists) so no codemod task is needed | STATE.md blocker / Risks | Low — a quick `ls` confirms, codemod is additive-only |

## Sources

### Primary (HIGH confidence)

- `/Users/tylerwaneka/Documents/horlo/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` — Next 16 proxy API reference (matcher, cookies, execution order, Server Function warning)
- `/Users/tylerwaneka/Documents/horlo/node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md` — proxy overview, "not a full authorization solution" warning
- `/Users/tylerwaneka/Documents/horlo/node_modules/next/dist/docs/01-app/02-guides/authentication.md` — Next 16 auth guide, DAL + Proxy optimistic-check pattern, `await cookies()` throughout
- `npm view @supabase/ssr version` → `0.10.2` (verified 2026-04-12)
- `npm view @supabase/supabase-js version` → `2.103.0` (verified 2026-04-12)
- `/Users/tylerwaneka/Documents/horlo/package.json` — confirms neither Supabase package installed
- `/Users/tylerwaneka/Documents/horlo/src/db/schema.ts` — shadow `users` table already exists
- `/Users/tylerwaneka/Documents/horlo/src/app/actions/watches.ts` + `preferences.ts` — existing `TODO(Phase 4)` markers
- `/Users/tylerwaneka/Documents/horlo/src/components/layout/Header.tsx` — current client-component shape
- `/Users/tylerwaneka/Documents/horlo/src/app/api/extract-watch/route.ts` — current SSRF handler
- `/Users/tylerwaneka/Documents/horlo/.env.example` — missing Supabase vars
- `/Users/tylerwaneka/Documents/horlo/vitest.config.ts` — test runner config

### Secondary (MEDIUM confidence)

- [Supabase Docs — Creating a Supabase client for SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client) — cookies `getAll/setAll` pattern, try/catch for Server Components
- [Supabase Docs — Auth server-side Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs) — proxy + server client conceptual guide
- [Supabase UI — Password-based Authentication (Next.js)](https://supabase.com/ui/docs/nextjs/password-based-auth) — `verifyOtp({type:'recovery'})` + `resetPasswordForEmail({redirectTo})` current pattern
- [Next.js 16 proxy.ts + Supabase SSR migration guide](https://medium.com/@securestartkit/next-js-proxy-ts-auth-migration-guide-ff7489ec8735) — complete proxy.ts code with getAll/setAll (used as cross-check for the adapter shape)

### Tertiary (LOW confidence — cross-reference only)

- [Supabase GitHub Discussion #34842](https://github.com/orgs/supabase/discussions/34842) — AI-tool confusion about the old cookie adapter shape (used as evidence that the wrong shape is a real footgun)

## Metadata

**Confidence breakdown:**

- Standard stack (`@supabase/ssr` 0.10.2 + `supabase-js` 2.103.0): HIGH — verified via `npm view`
- `cookies()` async requirement in Next 16: HIGH — verified in local `node_modules` docs
- Proxy cookie adapter (`getAll/setAll`): HIGH — official Supabase docs + migration guide agree
- Password reset `verifyOtp` flow: MEDIUM-HIGH — current Supabase UI docs; older `exchangeCodeForSession` PKCE path also works
- Shadow-user trigger recommendation: HIGH — canonical Supabase pattern
- Phase 3 local DB state (Supabase CLI vs standalone): MEDIUM — `supabase/` dir missing contradicts Phase 3 D-15
- IDOR test setup complexity: MEDIUM — depends on Phase 3 fixture state (not inspected)
- Header.tsx refactor path: HIGH — file contents verified line-by-line

**Research date:** 2026-04-12
**Valid until:** 2026-05-12 (30 days — @supabase/ssr 0.10.x API is stable, Next 16 proxy is stable)
