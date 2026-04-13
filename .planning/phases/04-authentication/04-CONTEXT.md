---
doc_type: phase-context
phase: "04"
phase_name: authentication
gathered: 2026-04-12
status: ready-for-planning
source: discuss-phase interactive
---

# Phase 04: Authentication — Context

**Gathered:** 2026-04-12
**Status:** Ready for planning
**Source:** `/gsd-discuss-phase 4` (interactive)

<domain>
## Phase Boundary

Phase 4 bolts Supabase Auth (`@supabase/ssr`) onto the Phase 3 data layer: real users can sign up, log in, and log out; `proxy.ts` gates protected routes; every Server Action reads the session via a shared `getCurrentUser()` helper and passes the verified id down to DAL; `/api/extract-watch` gets a 401 gate on top of the Phase 1 SSRF hardening. No UI rewire to Server Components (that's Phase 5), no localStorage migration (also Phase 5).

**Requirement IDs in scope:** AUTH-01, AUTH-02, AUTH-03, AUTH-04

**Phase goal:** Real users can sign up and log in, session is enforced at the proxy layer AND independently re-verified inside every Server Action before any DAL call, with per-user data isolation that client-supplied IDs cannot subvert.

</domain>

<decisions>
## Implementation Decisions

### Session contract (AUTH-02, AUTH-03)

- **D-01:** Shared helper `getCurrentUser()` lives in `src/lib/auth.ts` (server-only). Single source of truth. Returns `{ id: string; email: string }` on success, throws `UnauthorizedError` on missing/invalid session. Internally uses `@supabase/ssr` `createServerClient()` + `supabase.auth.getUser()` (the `getUser()` method hits Supabase to verify, unlike `getSession()` which only decodes — use `getUser()`).
- **D-02:** **Server Actions drop the `userId` parameter.** Signatures become `addWatch(data)`, `editWatch(watchId, data)`, `removeWatch(watchId)`, `updatePreferences(data)`, etc. Callers never pass ids. The id is read inside the action from the session — there is no trust boundary for the client to attack.
- **D-03:** **DAL keeps its internal `userId` parameter** (`createWatch(userId, data)` stays as-is in signature). DAL is server-only and only called by Server Actions, which pass the just-verified session id. One cookie read per request at the Server Action layer — DAL does not re-read cookies. This satisfies AUTH-02's intent (every call is session-gated) without doubling session reads per query.
- **D-04:** Server Action pattern:
  ```ts
  export async function addWatch(data: unknown): Promise<ActionResult<Watch>> {
    let user
    try { user = await getCurrentUser() } catch { return { success: false, error: 'Not authenticated' } }
    // ...zod parse...
    try {
      const watch = await watchDAL.createWatch(user.id, parsed.data)
      revalidatePath('/')
      return { success: true, data: watch }
    } catch (err) { /* existing catch */ }
  }
  ```
- **D-05:** DAL `update`/`delete` keep their current `throw new Error('Watch not found or access denied')` behavior (Phase 3 D-08). Server Action catches and maps to `{ success: false, error: 'Not found' }`. Consistent with Phase 3 contracts — no rewrite.
- **D-06:** A new `UnauthorizedError` class in `src/lib/auth.ts` so callers can `instanceof`-check specifically (rather than catching all errors). Plain `Error` subclass, no message normalization needed.
- **D-07:** Every call site in `src/app/actions/watches.ts` and `src/app/actions/preferences.ts` updates to the new signature. Any Phase 3 tests that pass a `userId` argument to actions must be updated; DAL tests are unaffected.

### Auth methods & UX (AUTH-01)

- **D-08:** **Email + password only** for v1. No OAuth, no magic links, no passkeys. Simplest UI surface, no third-party app registration, no email delivery dependency for the login path. OAuth/magic links are deferred ideas.
- **D-09:** **Email verification disabled** in Supabase (`Confirm email` setting off). Sign-up → immediately logged in. Single-user app in local dev; verification can be toggled on in the Supabase dashboard later without code changes.
- **D-10:** **Password reset flow is in scope for this phase.** Full flow:
  1. `/forgot-password` page with email input → calls `supabase.auth.resetPasswordForEmail()`
  2. Supabase emails a reset link pointing to `/auth/callback?type=recovery&...`
  3. `/auth/callback` route handler exchanges the token for a session
  4. User lands on `/reset-password` with a `set new password` form → calls `supabase.auth.updateUser({ password })`
  5. On success, redirect to `/`.

  This requires Supabase SMTP to be configured (either Supabase's default sender or a custom one). Planner/executor should flag if SMTP is not configured in the local Supabase instance.
- **D-11:** **Logout lives in a header dropdown.** Add a user menu in the header (avatar-or-email trigger) with a `Log out` item. Logout is a Server Action form POST so it still works without JS. Use shadcn `DropdownMenu`.

### Proxy matcher & unauth UX (AUTH-02, AUTH-04)

- **D-12:** **Deny-by-default matcher.** `proxy.ts` matcher excludes only: `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth/*`, `_next/*`, `/favicon.ico`, and the standard Next.js static asset paths. Everything else requires a session. New routes added in future phases are protected automatically.
- **D-13:** **Proxy redirects unauth users to `/login?next=<path>`** where `<path>` is the originally requested pathname + search. Login form reads `next` from `searchParams`, redirects there after successful auth. Falls back to `/` when `next` is absent.
- **D-14:** **`/api/extract-watch` returns `401 JSON`** when unauthenticated: `NextResponse.json({ error: 'Unauthorized' }, { status: 401 })`. The route handler itself calls `getCurrentUser()` at the top — **do not rely on proxy alone for API routes** (proxy is optimistic per Next 16 docs). This is the belt that makes AUTH-04 bulletproof. Layers with existing SEC-01 SSRF check.
- **D-15:** **Tampered/expired session in a Server Action returns `{success:false, error:'Not authenticated'}`**, not a `redirect()`. The calling client component sees the error and navigates to `/login?next=<current>` itself. Preserves Phase 3 D-12 (never throw/redirect across the Server Action boundary) and lets the client show its own inline error state before the nav.
- **D-16:** Proxy uses `@supabase/ssr` `createServerClient()` with the cookie adapter that reads/writes the request and response. On every proxied request, the proxy calls `supabase.auth.getUser()` to **also refresh the session cookie** — this is how `@supabase/ssr` keeps the refresh-token alive. The refreshed cookies must be attached to `NextResponse` before returning. Researcher should confirm the exact Next 16 + @supabase/ssr cookie-propagation idiom.

### Claude's Discretion

- **Shadow `users` table row sync on first sign-up** — planner's choice between a Postgres trigger on `auth.users INSERT` (zero race conditions, lives in a migration) and an app-side upsert inside `getCurrentUser()` on first successful call (no SQL, but a branch on every request). Either satisfies AUTH-03 as long as the FK from `watches.userId` / `user_preferences.userId` resolves. Recommend the trigger if it's low-friction in local Supabase CLI.
- **Auth UI styling depth** — shadcn `Card` + `Input` + `Button` primitives with the warm/brass semantic tokens from Phase 1. No need for novel design — forms are a solved problem. Planner decides whether to build a shared `AuthLayout` wrapper or copy-paste the card across `/login`, `/signup`, `/forgot-password`, `/reset-password`.
- **Exact login form state handling** — `useActionState` vs. a manual `useTransition`+state pair. Either works with the `ActionResult` contract.
- **Error messaging copy** — specific strings for `Invalid credentials`, `Email already registered`, `Weak password`, etc. Keep them neutral (no user enumeration via error wording differences).
- **Whether to wire a test user seed script** — nice for local dev, not required by the AUTH requirements.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Next.js 16 docs (CRITICAL — this is not the Next you know)
- `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md` — proxy.ts convention, the "optimistic checks only" warning (don't use as a full authorization solution)
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` — proxy API reference, matcher syntax, cookie propagation
- `node_modules/next/dist/docs/01-app/02-guides/authentication.md` — Next 16 auth guide (optimistic proxy checks + Server Action re-verification pattern)

### Supabase
- `@supabase/ssr` package docs — `createServerClient`, `createBrowserClient`, cookie adapter API. This is the package to use; do NOT use the older `@supabase/auth-helpers-nextjs` (deprecated).
- Use `supabase.auth.getUser()` (server-verified) NOT `supabase.auth.getSession()` (client-cached) inside `getCurrentUser()` and `proxy.ts`. Researcher: fetch current docs via context7 if needed.

### Project context
- `.planning/PROJECT.md` — personal-first constraint, Next.js 16 no-rewrite, extend-don't-break data model
- `.planning/REQUIREMENTS.md` — AUTH-01..04 acceptance criteria, plus MIG-01/02 (Phase 5, not this phase — don't bleed into migration)
- `CLAUDE.md` + `AGENTS.md` — Next.js 16 warning, profile is unset

### Phase 3 artifacts (foundation this phase rewrites)
- `.planning/phases/03-data-layer-foundation/03-CONTEXT.md` — D-07 (DAL accepts explicit userId), D-08 (DAL throws on not-found), D-10 (userId-scoped queries), D-12 (ActionResult contract, never throw across boundary)
- `src/lib/auth.ts` — does NOT exist yet; new file this phase creates
- `src/app/actions/watches.ts` — Server Actions with `TODO(Phase 4)` comment; every signature changes (D-02)
- `src/app/actions/preferences.ts` — same pattern, every signature changes
- `src/data/watches.ts` — DAL unchanged in signature (D-03), still takes internal `userId`
- `src/data/preferences.ts` — same
- `src/db/schema.ts` — `users` shadow table already exists with `id uuid PK` matching Supabase Auth user id (Phase 3 D-03). No schema changes needed for AUTH-01..04.
- `src/app/api/extract-watch/route.ts` — add `getCurrentUser()` check at top, return 401 JSON on throw. Layer on top of existing SEC-01 SSRF check.

### .env
- `.env.example` — needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` documented (already has `DATABASE_URL` from Phase 3)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/data/watches.ts` + `src/data/preferences.ts` — DAL is ready, internal `userId` signature is already the right shape for the new Server Action pattern. No changes required to DAL internals.
- `src/app/actions/watches.ts` — already has the `ActionResult<T>` return shape, Zod validation, and `revalidatePath` calls. Phase 4 only changes the parameter list and adds the session-read prologue.
- shadcn UI primitives already installed (`Card`, `Input`, `Button`, `DropdownMenu` per earlier phases) — auth pages and header menu can compose existing primitives without new installs.
- `src/db/schema.ts` `users` table — ready to accept Supabase Auth IDs on first sign-up (shadow sync method is TBD, see Claude's Discretion).

### Established Patterns
- Server Actions return `{success, data?, error?}` — never throw across the boundary. D-15 extends this to the unauth case.
- DAL functions throw on unexpected errors; actions catch and shape the response (Phase 3 D-08).
- `server-only` import guards DAL from client bundles — extend the same pattern to `src/lib/auth.ts`.
- `drizzle-kit push` against local Supabase Postgres is the schema-sync workflow (Phase 3 D-16) — any DB triggers for shadow `users` sync go into a migration alongside.

### Integration Points
- `proxy.ts` — new file at project root (or `src/proxy.ts`) — does not exist yet
- `src/lib/auth.ts` — new file, houses `getCurrentUser()`, `UnauthorizedError`, and a `createSupabaseServerClient()` helper that the auth functions + Server Actions + route handlers share
- `src/app/login/page.tsx`, `src/app/signup/page.tsx`, `src/app/forgot-password/page.tsx`, `src/app/reset-password/page.tsx` — new routes, server components with client form subcomponents
- `src/app/auth/callback/route.ts` — new route handler to exchange recovery/session codes for cookies (used by password reset)
- `src/components/layout/Header.tsx` (or equivalent) — add user dropdown with logout Server Action form
- `src/app/api/extract-watch/route.ts` — add 401 gate at top of handler
- `.env.local` — add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (planner notes; user provides values)

</code_context>

<specifics>
## Specific Ideas

- `getCurrentUser()` uses `supabase.auth.getUser()` (server-verified), NOT `getSession()` (client-cached). The distinction matters: `getSession()` trusts the cookie-decoded JWT without hitting Supabase, which is vulnerable to a tampered-but-syntactically-valid cookie. `getUser()` validates server-side.
- `proxy.ts` must both read cookies (to know if there's a session) AND write cookies (to forward refreshed auth cookies). The `@supabase/ssr` cookie adapter pattern handles this but is Next-version-sensitive — researcher should fetch current docs.
- Logout Server Action calls `supabase.auth.signOut()` then `redirect('/login')`. `redirect()` inside an action throws a special Next signal — that's expected; it's not a "throw across the boundary" in the Phase 3 D-12 sense. Logout is the one exception.
- `/api/extract-watch` auth check: call `getCurrentUser()` at the very top of the POST handler, before URL parsing, before SSRF check. 401 on failure. This ordering keeps the SSRF gate as a second line — cheaper to reject unauth first.
- Password reset link redirects through `/auth/callback` — the callback exchanges the recovery token for a real session cookie, then redirects to `/reset-password`. Don't try to set the password inline from the callback; let the user type it on a form that's protected by the now-valid session.

</specifics>

<deferred>
## Deferred Ideas

- **OAuth providers (Google, GitHub, Apple)** — future milestone. Adds a callback flow and third-party OAuth app registration. Email+password is enough for v1.
- **Magic link login** — deferred. Requires reliable email delivery on the critical path.
- **Passkeys / WebAuthn** — future milestone. Worth revisiting once the v1 baseline is stable.
- **Email verification gate** — toggled off in Supabase for now; flip it on via dashboard when ready (no code change needed).
- **Multi-session management / device list** — future. Supabase supports it but there's no v1 requirement.
- **Rate limiting on `/login` and `/forgot-password`** — not in v1 scope; Supabase has built-in rate limits that are sufficient for a single-user app. Revisit when the app is public.
- **Test user seeding script** — nice-to-have for local dev; planner's discretion.
- **Shadow `users` table row sync** — deferred to planner's discretion (DB trigger vs app-side upsert), not deferred to a future phase. Must ship in Phase 4.
- **UI rewire of pages to Server Components reading from DAL** — Phase 5 (MIG / DATA-04 / DATA-05), not this phase. Phase 4 leaves the Zustand-powered UI unchanged except for the header logout menu and the new auth pages.
- **localStorage import banner** — Phase 5 (MIG-01, MIG-02). Do not bleed into Phase 4.

</deferred>

---

*Phase: 04-authentication*
*Context gathered: 2026-04-12 via `/gsd-discuss-phase 4`*
