---
phase: "04"
plan: 2
type: execute
wave: 2
depends_on: [1]
files_modified:
  - src/lib/supabase/server.ts
  - src/lib/supabase/client.ts
  - src/lib/supabase/proxy.ts
  - src/lib/auth.ts
  - src/app/actions/auth.ts
  - tests/auth.test.ts
  - tests/actions/auth.test.ts
autonomous: true
requirements:
  - AUTH-01
  - AUTH-02
must_haves:
  truths:
    - "A single server-only getCurrentUser() helper exists that uses supabase.auth.getUser() (server-verified, not JWT decode)"
    - "A single UnauthorizedError class exists that callers can instanceof-check"
    - "A shared createSupabaseServerClient() helper exists that uses the getAll/setAll cookie adapter (not the deprecated get/set/remove shape)"
    - "A browser-side createSupabaseBrowserClient() helper exists for client form components"
    - "A proxy cookie adapter helper exists that refreshes cookies and returns { user, response } — ready to be consumed by proxy.ts in Plan 03"
    - "A logout Server Action exists that calls supabase.auth.signOut() and redirects to /login"
    - "tests/auth.test.ts turns from all-todo to real green assertions covering getCurrentUser success + failure"
    - "tests/actions/auth.test.ts turns from todo to real green assertion covering logout"
  artifacts:
    - path: "src/lib/supabase/server.ts"
      provides: "createSupabaseServerClient() for Server Components, Server Actions, and route handlers"
      exports: ["createSupabaseServerClient"]
      contains: "await cookies()"
    - path: "src/lib/supabase/client.ts"
      provides: "createSupabaseBrowserClient() for 'use client' form components"
      exports: ["createSupabaseBrowserClient"]
    - path: "src/lib/supabase/proxy.ts"
      provides: "updateSession(request) helper used by root proxy.ts in Plan 03"
      exports: ["updateSession"]
      contains: "getAll"
    - path: "src/lib/auth.ts"
      provides: "getCurrentUser() + UnauthorizedError facade over the server client"
      exports: ["getCurrentUser", "UnauthorizedError"]
      contains: "getUser"
    - path: "src/app/actions/auth.ts"
      provides: "logout Server Action (signOut + redirect)"
      exports: ["logout"]
  key_links:
    - from: "src/lib/auth.ts"
      to: "supabase.auth.getUser()"
      via: "createSupabaseServerClient helper"
      pattern: "supabase\\.auth\\.getUser"
    - from: "src/lib/supabase/server.ts"
      to: "next/headers cookies()"
      via: "await cookies() — Next 16 async contract"
      pattern: "await cookies"
    - from: "src/app/actions/auth.ts"
      to: "redirect('/login')"
      via: "supabase.auth.signOut() then redirect"
      pattern: "signOut"
---

<objective>
Create the shared auth library that every downstream plan depends on: the three-file Supabase helper pattern (server/client/proxy), the `getCurrentUser()` + `UnauthorizedError` facade, and the logout Server Action. Convert the failing-stub tests from Plan 01 into real green assertions for these primitives.

Purpose: Plans 03, 04, 05, and 06 all import from these files. They cannot run in parallel in Wave 3 unless this foundation exists.
Output: A shipped, tested auth library that Plans 03–06 can consume.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/04-authentication/04-CONTEXT.md
@.planning/phases/04-authentication/04-RESEARCH.md
@.planning/phases/04-authentication/04-01-SUMMARY.md
@CLAUDE.md
@AGENTS.md
@node_modules/next/dist/docs/01-app/02-guides/authentication.md
@tests/helpers/mock-supabase.ts

<interfaces>
<!-- VERBATIM code from RESEARCH.md Q1, Q3, Q6, Q8 — copy, do not reinvent. -->

// src/lib/supabase/server.ts (RESEARCH Q3)
```ts
import 'server-only'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function createSupabaseServerClient() {
  const cookieStore = await cookies() // await is REQUIRED in Next 16
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
            // Server Components cannot set cookies — the proxy handles refresh.
          }
        },
      },
    },
  )
}
```

// src/lib/supabase/client.ts (RESEARCH Recommended Structure)
```ts
'use client'
import { createBrowserClient } from '@supabase/ssr'

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
```

// src/lib/supabase/proxy.ts (RESEARCH Q1 — cookie propagation idiom)
```ts
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
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request: { headers: request.headers } })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // getUser() BOTH verifies server-side AND triggers refresh-token round-trip.
  const { data: { user } } = await supabase.auth.getUser()

  return { supabase, user, response }
}
```

// src/lib/auth.ts (RESEARCH Q3, Q8)
```ts
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

// src/app/actions/auth.ts (RESEARCH Q6)
```ts
'use server'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function logout() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create src/lib/supabase/{server,client,proxy}.ts helpers</name>
  <files>src/lib/supabase/server.ts, src/lib/supabase/client.ts, src/lib/supabase/proxy.ts</files>
  <read_first>
    - .planning/phases/04-authentication/04-RESEARCH.md (Q1 for proxy adapter, Q3 for server helper — these blocks are VERBATIM)
    - src/lib/ssrf.ts (existing `server-only` import pattern — match it)
    - package.json (confirm @supabase/ssr 0.10.2 is installed per Plan 01)
    - node_modules/@supabase/ssr/dist/main/index.d.ts (confirm createServerClient + createBrowserClient exports)
  </read_first>
  <behavior>
    - Test 1: `createSupabaseServerClient()` awaits `cookies()` exactly once per call (verify via mock on next/headers)
    - Test 2: the server cookie adapter uses `getAll`/`setAll` shape, NOT `get`/`set`/`remove`
    - Test 3: `updateSession(request)` returns `{ supabase, user, response }` and calls `supabase.auth.getUser()` once
    - Test 4: `setAll` in proxy replays cookies onto the request AND attaches them to response
  </behavior>
  <action>
Create the three files VERBATIM from the `<interfaces>` block above. Do not deviate — every line was cross-checked against Next 16 docs and Supabase SSR 0.10.2.

Critical invariants (violating any of these breaks auth silently):

1. `src/lib/supabase/server.ts` MUST import `'server-only'` at the top — matches the pattern in `src/data/watches.ts` / `src/lib/ssrf.ts`.
2. `src/lib/supabase/server.ts` MUST `await cookies()` (Next 16 is async — unawaited `cookies()` silently returns a Promise object whose `.getAll` is undefined).
3. Cookie adapter MUST use `getAll` / `setAll` shape. Do NOT emit `get`/`set`/`remove` — that shape is from `@supabase/ssr` < 0.4 and breaks session refresh silently (TypeScript still compiles).
4. `src/lib/supabase/proxy.ts` MUST use the `let response = ...; setAll { response = ... }` closure idiom — this is how refreshed cookies propagate to downstream RSCs.
5. `src/lib/supabase/client.ts` MUST start with `'use client'`. It uses `createBrowserClient` (NOT `createServerClient`).

Extend `tests/auth.test.ts` (currently all `it.todo`) to replace the first two todos with:
- `it('createSupabaseServerClient awaits cookies()', ...)` — vi.mock('next/headers', () => ({ cookies: vi.fn().mockResolvedValue({ getAll: vi.fn().mockReturnValue([]), set: vi.fn() }) })), import the helper, call it, assert cookies mock was called.
- Leave the `getCurrentUser` todos for Task 2.
  </action>
  <verify>
    <automated>npx tsc --noEmit -p tsconfig.json 2>&amp;1 | grep -E "src/lib/supabase" | head &amp;&amp; npx vitest run tests/auth.test.ts --reporter=dot</automated>
  </verify>
  <acceptance_criteria>
    - `src/lib/supabase/server.ts` exists AND contains literal string `'server-only'`
    - `src/lib/supabase/server.ts` contains literal string `await cookies()`
    - `src/lib/supabase/server.ts` contains literal string `getAll()` AND literal string `setAll(`
    - `src/lib/supabase/server.ts` does NOT contain `get(name` (confirming old adapter shape is absent)
    - `src/lib/supabase/client.ts` exists AND first non-comment line is `'use client'`
    - `src/lib/supabase/client.ts` contains `createBrowserClient`
    - `src/lib/supabase/proxy.ts` contains `NextResponse.next({ request: { headers: request.headers } })`
    - `src/lib/supabase/proxy.ts` contains `await supabase.auth.getUser()`
    - `npx tsc --noEmit` reports zero errors in src/lib/supabase/**
    - `npx vitest run tests/auth.test.ts` exits 0 and reports at least 1 passing test (the cookies-await test) plus the remaining todos
  </acceptance_criteria>
  <done>Three Supabase helper files exist, typecheck, use the correct cookie adapter shape, and the first real unit test is green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create src/lib/auth.ts with getCurrentUser + UnauthorizedError</name>
  <files>src/lib/auth.ts, tests/auth.test.ts</files>
  <read_first>
    - .planning/phases/04-authentication/04-RESEARCH.md (Q3, Q8)
    - .planning/phases/04-authentication/04-CONTEXT.md (D-01, D-06)
    - src/lib/supabase/server.ts (just created — this file is its consumer)
    - tests/auth.test.ts (the failing stubs from Plan 01 — fill them in)
    - tests/helpers/mock-supabase.ts (use mockSupabaseServerClient for unit tests)
  </read_first>
  <behavior>
    - Test 1: `getCurrentUser()` returns `{ id, email }` when supabase.auth.getUser returns a valid user
    - Test 2: `getCurrentUser()` throws `UnauthorizedError` when supabase.auth.getUser returns null user
    - Test 3: `getCurrentUser()` throws `UnauthorizedError` when supabase.auth.getUser returns an error
    - Test 4: `new UnauthorizedError()` is instanceof Error and has `name === 'UnauthorizedError'`
    - Test 5: `new UnauthorizedError('custom')` preserves the custom message
  </behavior>
  <action>
Create `src/lib/auth.ts` VERBATIM from the `<interfaces>` block. Key points (all locked by D-01/D-06):

- `import 'server-only'` at the top — prevents accidental client bundle inclusion.
- Export `UnauthorizedError` as a named class extending `Error` with `name = 'UnauthorizedError'`. Default message `'Not authenticated'`. No message normalization.
- Export `getCurrentUser()` as `async (): Promise<{ id: string; email: string }>`.
- Internally: `const supabase = await createSupabaseServerClient()`, then `const { data: { user }, error } = await supabase.auth.getUser()`.
- If `error || !user`, throw `new UnauthorizedError()`.
- Return `{ id: user.id, email: user.email! }` (non-null assertion is safe because Supabase email is required in the sign-up flow per D-08).
- MUST use `getUser()` — NOT `getSession()` — per CONTEXT D-01 and RESEARCH Risk #4. `getSession()` decodes the JWT without hitting Supabase; a tampered cookie would pass.

Now fill in `tests/auth.test.ts` (replace all todos except the one already done in Task 1):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockSupabaseServerClient } from './helpers/mock-supabase'

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}))

import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

describe('getCurrentUser (src/lib/auth.ts) — AUTH-01, AUTH-02', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns { id, email } when supabase.auth.getUser returns a user', async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      mockSupabaseServerClient({ user: { id: 'u-1', email: 'a@b.co' } }) as any,
    )
    await expect(getCurrentUser()).resolves.toEqual({ id: 'u-1', email: 'a@b.co' })
  })

  it('throws UnauthorizedError when supabase.auth.getUser returns null user', async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      mockSupabaseServerClient({ user: null }) as any,
    )
    await expect(getCurrentUser()).rejects.toBeInstanceOf(UnauthorizedError)
  })

  it('throws UnauthorizedError when supabase.auth.getUser returns an error', async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      mockSupabaseServerClient({ user: null, error: new Error('jwt tampered') }) as any,
    )
    await expect(getCurrentUser()).rejects.toBeInstanceOf(UnauthorizedError)
  })

  it('UnauthorizedError extends Error with correct name', () => {
    const err = new UnauthorizedError()
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('UnauthorizedError')
    expect(err.message).toBe('Not authenticated')
  })

  it('UnauthorizedError preserves custom message', () => {
    expect(new UnauthorizedError('custom').message).toBe('custom')
  })
})
```
  </action>
  <verify>
    <automated>npx vitest run tests/auth.test.ts --reporter=dot</automated>
  </verify>
  <acceptance_criteria>
    - `src/lib/auth.ts` exists AND contains literal string `'server-only'`
    - `src/lib/auth.ts` exports named class `UnauthorizedError` (verify: `grep "export class UnauthorizedError" src/lib/auth.ts` matches)
    - `src/lib/auth.ts` exports `async function getCurrentUser` (verify: `grep "export async function getCurrentUser" src/lib/auth.ts` matches)
    - `src/lib/auth.ts` contains literal string `supabase.auth.getUser()` AND does NOT contain `getSession()`
    - `npx vitest run tests/auth.test.ts` exits 0 with at least 5 passing tests, zero failing, zero todo
    - `npx tsc --noEmit` reports zero errors in src/lib/auth.ts
  </acceptance_criteria>
  <done>getCurrentUser is implemented per D-01, UnauthorizedError per D-06, and the full tests/auth.test.ts suite is green (no remaining todos).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Create logout Server Action at src/app/actions/auth.ts</name>
  <files>src/app/actions/auth.ts, tests/actions/auth.test.ts</files>
  <read_first>
    - .planning/phases/04-authentication/04-CONTEXT.md (D-11, specifics section on logout)
    - .planning/phases/04-authentication/04-RESEARCH.md (Q6)
    - src/lib/supabase/server.ts (just created)
    - src/app/actions/watches.ts (existing Server Action file — match `'use server'` directive placement, no TypeScript 'use strict')
    - tests/actions/auth.test.ts (stub from Plan 01)
  </read_first>
  <behavior>
    - Test 1: `logout()` calls `supabase.auth.signOut()` exactly once
    - Test 2: `logout()` calls `redirect('/login')` after signOut (verify via mock on next/navigation)
    - Test 3: logout is exported from a file starting with `'use server'`
  </behavior>
  <action>
Create `src/app/actions/auth.ts` VERBATIM from `<interfaces>` block:

```ts
'use server'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function logout() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

Notes on why this is safe (NOT a Phase 3 D-12 violation):
- `redirect()` from `next/navigation` throws a `NEXT_REDIRECT` signal that Next handles internally. Per RESEARCH Gotcha #8 and CONTEXT Specifics, logout is the one documented exception to "never throw across the Server Action boundary". Do NOT wrap redirect in try/catch — that breaks the redirect.

Fill in `tests/actions/auth.test.ts` (replace the single todo):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockSupabaseServerClient } from '../helpers/mock-supabase'

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT /login')
  }),
}))

import { logout } from '@/app/actions/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

describe('logout Server Action — AUTH-01', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls supabase.auth.signOut and redirects to /login', async () => {
    const mock = mockSupabaseServerClient({ user: { id: 'u-1', email: 'a@b.co' } })
    vi.mocked(createSupabaseServerClient).mockResolvedValue(mock as any)

    await expect(logout()).rejects.toThrow('NEXT_REDIRECT /login')

    expect(mock.auth.signOut).toHaveBeenCalledTimes(1)
    expect(redirect).toHaveBeenCalledWith('/login')
    // signOut runs BEFORE redirect
    expect(vi.mocked(mock.auth.signOut).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(redirect).mock.invocationCallOrder[0],
    )
  })
})
```
  </action>
  <verify>
    <automated>npx vitest run tests/actions/auth.test.ts --reporter=dot</automated>
  </verify>
  <acceptance_criteria>
    - `src/app/actions/auth.ts` first non-comment line is `'use server'`
    - `src/app/actions/auth.ts` exports named function `logout`
    - `src/app/actions/auth.ts` contains both `signOut()` AND `redirect('/login')`
    - `npx vitest run tests/actions/auth.test.ts` exits 0 with 1 passing test
    - `npx tsc --noEmit` reports zero errors for src/app/actions/auth.ts
  </acceptance_criteria>
  <done>Logout Server Action shipped per D-11, tested end-to-end (mocked).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → Server Action | Logout action receives no parameters but still crosses the trust boundary — safe because it only de-authenticates the caller. |
| Server Component/Route → Supabase cookies | `getCurrentUser()` reads the session cookie. If the adapter shape is wrong, session refresh silently fails. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-4-02 | Spoofing | src/lib/auth.ts getCurrentUser | mitigate | Use `supabase.auth.getUser()` (server-verified) NOT `getSession()` — hits Supabase to validate, rejects tampered-but-valid-shaped JWTs. Enforced by acceptance criteria grep check `does NOT contain getSession()`. |
| T-4-04 | Tampering | src/lib/supabase/server.ts cookie adapter | mitigate | `getAll`/`setAll` adapter shape per Supabase SSR 0.10.2 — enforced by grep `does NOT contain get(name`. Refresh-token refresh works; deprecated shape silently breaks it. |
| T-4-01 | Tampering | src/lib/supabase/proxy.ts | mitigate | Uses closure `let response = ...` idiom so refreshed cookies propagate to downstream RSCs; calls `getUser()` (not `getSession()`) to force server-side verification. |
| T-4-07 | Repudiation | src/app/actions/auth.ts logout | accept | `supabase.auth.signOut()` clears cookies via `setAll`; `redirect('/login')` ensures the UI can't render authenticated pages after logout. Server-side sign-out is instantaneous; no stale token window. |
</threat_model>

<verification>
- `npx vitest run tests/auth.test.ts tests/actions/auth.test.ts` reports zero failures, zero remaining todos
- `npx tsc --noEmit` reports zero errors
- `grep -r "getSession()" src/lib src/app/actions` returns no matches (must use getUser only)
- `grep -r "get(name" src/lib/supabase` returns no matches (rejects deprecated adapter shape)
</verification>

<success_criteria>
Downstream consumers (Plans 03–06) can:
1. `import { createSupabaseServerClient } from '@/lib/supabase/server'` in Server Actions, Server Components, and route handlers.
2. `import { createSupabaseBrowserClient } from '@/lib/supabase/client'` in `'use client'` form components.
3. `import { updateSession } from '@/lib/supabase/proxy'` in the root `proxy.ts`.
4. `import { getCurrentUser, UnauthorizedError } from '@/lib/auth'` everywhere that needs the session.
5. `import { logout } from '@/app/actions/auth'` in the header user menu.

All five imports resolve, typecheck, and the two test files are green.
</success_criteria>

<output>
After completion, create `.planning/phases/04-authentication/04-02-SUMMARY.md`.
</output>
