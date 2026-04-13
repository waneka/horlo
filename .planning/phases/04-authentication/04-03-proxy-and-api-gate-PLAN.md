---
phase: "04"
plan: 3
type: execute
wave: 3
depends_on: [2]
files_modified:
  - proxy.ts
  - src/app/api/extract-watch/route.ts
  - tests/proxy.test.ts
  - tests/api/extract-watch-auth.test.ts
autonomous: true
requirements:
  - AUTH-02
  - AUTH-04
must_haves:
  truths:
    - "A proxy.ts file exists at the repo root (not middleware.ts) and runs on every request matching the negative-lookahead matcher"
    - "Unauthenticated requests to protected paths redirect to /login?next=<pathname+search>"
    - "Requests to /login, /signup, /forgot-password, /reset-password, /auth/* are allowed without a session"
    - "Authenticated requests return the response object carrying refreshed Set-Cookie headers"
    - "POST /api/extract-watch rejects unauthenticated requests with 401 JSON { error: 'Unauthorized' } BEFORE running SSRF validation"
    - "The 401 gate layers on top of the existing SEC-01 SSRF check (Phase 1), not replacing it"
  artifacts:
    - path: "proxy.ts"
      provides: "Next 16 proxy entry — deny-by-default session enforcement + cookie refresh"
      exports: ["default", "config"]
      contains: "updateSession"
    - path: "src/app/api/extract-watch/route.ts"
      provides: "Existing SSRF-hardened handler with new 401 auth gate at top"
      contains: "getCurrentUser"
  key_links:
    - from: "proxy.ts"
      to: "src/lib/supabase/proxy.ts updateSession"
      via: "default export calls updateSession(request)"
      pattern: "updateSession"
    - from: "proxy.ts"
      to: "/login?next=<path>"
      via: "NextResponse.redirect with searchParams.set('next', pathname+search)"
      pattern: "searchParams\\.set.*next"
    - from: "src/app/api/extract-watch/route.ts"
      to: "@/lib/auth getCurrentUser"
      via: "try/catch at top of POST handler, before SSRF check"
      pattern: "getCurrentUser"
---

<objective>
Gate the entire app at the proxy layer (AUTH-02 enforcement point #1) AND add the independent 401 gate to `/api/extract-watch` (AUTH-04). These two changes run in parallel with the Server Action refactor (Plan 04) and the auth pages (Plan 05) because they touch different files.

Purpose: the proxy is the coarse-grained outer gate ("optimistic check" per Next 16 docs); per-action re-verification inside Server Actions is the fine-grained inner gate (Plan 04). Route handlers need their own check because proxy does not reliably cover them (RESEARCH Risk #3).
Output: Working proxy.ts matching CONTEXT D-12/D-13/D-16 and a 401-gated extract-watch route handler per D-14.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/04-authentication/04-CONTEXT.md
@.planning/phases/04-authentication/04-RESEARCH.md
@.planning/phases/04-authentication/04-02-SUMMARY.md
@CLAUDE.md
@AGENTS.md
@node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md
@node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
@node_modules/next/dist/docs/01-app/02-guides/authentication.md

<interfaces>
<!-- From Plan 02 (already shipped): -->
// src/lib/supabase/proxy.ts
export async function updateSession(request: NextRequest): Promise<{
  supabase: SupabaseClient
  user: User | null
  response: NextResponse
}>

// src/lib/auth.ts
export class UnauthorizedError extends Error { name = 'UnauthorizedError' }
export async function getCurrentUser(): Promise<{ id: string; email: string }>

<!-- VERBATIM proxy.ts from RESEARCH Q1 + Q2. -->
// proxy.ts (at repo root — NOT src/)
```ts
import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/auth',
]

export default async function proxy(request: NextRequest) {
  const { user, response } = await updateSession(request)

  const pathname = request.nextUrl.pathname
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))

  if (!user && !isPublic) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname + request.nextUrl.search)
    return NextResponse.redirect(loginUrl)
  }

  // Dev-only log line to satisfy ROADMAP success criterion #2 ("a log line confirms the proxy executes")
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[proxy] ${pathname} user=${user?.id ?? 'anon'} public=${isPublic}`)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
```

<!-- Existing route handler to modify (from src/app/api/extract-watch/route.ts): -->
Current imports: `NextRequest`, `NextResponse` from 'next/server', `fetchAndExtract` from '@/lib/extractors', `SsrfError` from '@/lib/ssrf'.
Current flow: parse body -> URL validation -> protocol check -> fetchAndExtract -> NextResponse.json.
Error handling: catches SsrfError -> 400, generic -> 500.

<!-- New ordering for the handler per RESEARCH Q4 + CONTEXT D-14: -->
Auth gate FIRST (cheapest rejection), THEN existing URL parsing, THEN SSRF check.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create proxy.ts at repo root with deny-by-default matcher</name>
  <files>proxy.ts, tests/proxy.test.ts</files>
  <read_first>
    - .planning/phases/04-authentication/04-CONTEXT.md (D-12, D-13, D-16)
    - .planning/phases/04-authentication/04-RESEARCH.md (Q1 for cookie adapter, Q2 for matcher syntax, Risk #3 for why proxy is not enough on its own)
    - node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md (lines around 600–665 for matcher syntax)
    - src/lib/supabase/proxy.ts (the updateSession helper this file consumes)
    - src/lib/auth.ts (to understand the user shape — only reads user.id in tests)
    - tests/proxy.test.ts (failing stub from Plan 01 — replace todos with real assertions)
    - package.json scripts (confirm there is no old middleware.ts import)
  </read_first>
  <behavior>
    - Test 1: unauth request to `/` → redirect to `/login?next=%2F`
    - Test 2: unauth request to `/watch/abc?edit=1` → redirect to `/login?next=%2Fwatch%2Fabc%3Fedit%3D1`
    - Test 3: unauth request to `/login` → pass through (no redirect)
    - Test 4: unauth request to `/signup` → pass through
    - Test 5: unauth request to `/forgot-password` → pass through
    - Test 6: unauth request to `/reset-password` → pass through
    - Test 7: unauth request to `/auth/callback?token_hash=abc` → pass through
    - Test 8: authenticated request to `/` → returns response (not a redirect), user log line printed
  </behavior>
  <action>
Create `proxy.ts` at the **repo root** (same level as `next.config.ts`, `package.json`) — NOT under `src/`. Research Q2 confirms the root location is simpler and matches existing config files. Use VERBATIM the code in the `<interfaces>` block.

Critical Next 16 gotchas:

1. File name MUST be `proxy.ts` — NOT `middleware.ts`. STATE.md blocker confirms old name is silently ignored in Next 16.
2. The default export MUST be an `async function` named `proxy` (per Next 16 convention — see proxy.md).
3. The named `config` export with `matcher` array is required. The matcher is negative-lookahead: match everything EXCEPT static assets. Public routes (/login etc.) are NOT excluded from the matcher — they go through the proxy so the session cookie can be refreshed, then the in-function `isPublic` check allows them through without redirect.
4. The default export MUST return the `response` object from `updateSession`, not a fresh `NextResponse.next()`. That object carries the refreshed `Set-Cookie` headers (Research Q1 closure idiom).
5. The dev-only `console.log` line satisfies ROADMAP Phase 4 success criterion #2 ("a log line confirms the proxy executes on protected routes").

Now replace the todos in `tests/proxy.test.ts` with real assertions. Use direct function calls — the Next 16 testing helper `unstable_doesProxyMatch` is optional; a direct call with a constructed `NextRequest` works:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/proxy', () => ({
  updateSession: vi.fn(),
}))

import proxy from '../proxy'
import { updateSession } from '@/lib/supabase/proxy'

function mkRequest(pathname: string, search = '') {
  const url = `http://localhost:3000${pathname}${search}`
  return new NextRequest(url)
}

function mkUpdateSession(user: { id: string; email: string } | null) {
  return {
    supabase: {} as any,
    user,
    response: { status: 200, headers: new Headers(), cookies: new Map() } as any,
  }
}

describe('proxy.ts — AUTH-02', () => {
  beforeEach(() => vi.clearAllMocks())

  it('redirects unauth request on / to /login?next=%2F', async () => {
    vi.mocked(updateSession).mockResolvedValue(mkUpdateSession(null) as any)
    const res = await proxy(mkRequest('/'))
    expect(res.status).toBe(307) // NextResponse.redirect default
    expect(res.headers.get('location')).toContain('/login')
    expect(res.headers.get('location')).toContain('next=%2F')
  })

  it('preserves search params in next query', async () => {
    vi.mocked(updateSession).mockResolvedValue(mkUpdateSession(null) as any)
    const res = await proxy(mkRequest('/watch/abc', '?edit=1'))
    expect(res.headers.get('location')).toMatch(/next=%2Fwatch%2Fabc%3Fedit%3D1/)
  })

  it.each([
    ['/login'],
    ['/signup'],
    ['/forgot-password'],
    ['/reset-password'],
    ['/auth/callback?token_hash=abc&type=recovery'],
  ])('allows unauth request on public path %s', async (path) => {
    vi.mocked(updateSession).mockResolvedValue(mkUpdateSession(null) as any)
    const [pathname, search] = path.split('?')
    const res = await proxy(mkRequest(pathname, search ? `?${search}` : ''))
    // Not a redirect — the response from updateSession is returned verbatim
    expect(res.status).not.toBe(307)
  })

  it('lets authenticated request through with refreshed response', async () => {
    vi.mocked(updateSession).mockResolvedValue(
      mkUpdateSession({ id: 'u-1', email: 'a@b.co' }) as any,
    )
    const res = await proxy(mkRequest('/'))
    expect(res.status).not.toBe(307) // not a redirect
  })

  it('config.matcher uses negative-lookahead excluding static assets', async () => {
    const { config } = await import('../proxy')
    expect(config.matcher[0]).toContain('_next/static')
    expect(config.matcher[0]).toContain('favicon.ico')
  })
})
```
  </action>
  <verify>
    <automated>npx vitest run tests/proxy.test.ts --reporter=dot &amp;&amp; test -f proxy.ts &amp;&amp; ! test -f middleware.ts</automated>
  </verify>
  <acceptance_criteria>
    - File `proxy.ts` exists at repo root (same dir as `next.config.ts`)
    - File `middleware.ts` does NOT exist at repo root OR under src/
    - `proxy.ts` contains `export default async function proxy`
    - `proxy.ts` contains `export const config` with a `matcher` array
    - `proxy.ts` contains string `searchParams.set('next'`
    - `proxy.ts` contains import from `@/lib/supabase/proxy`
    - `proxy.ts` PUBLIC_PATHS array contains all of: `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth`
    - `npx vitest run tests/proxy.test.ts` exits 0 with at least 8 passing tests, zero todos remaining
    - `npx tsc --noEmit` reports zero errors for proxy.ts
  </acceptance_criteria>
  <done>proxy.ts deploys deny-by-default session enforcement with the correct Next 16 matcher, correct `/login?next=` redirect contract, and a dev log line.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add getCurrentUser 401 gate to /api/extract-watch route handler</name>
  <files>src/app/api/extract-watch/route.ts, tests/api/extract-watch-auth.test.ts</files>
  <read_first>
    - src/app/api/extract-watch/route.ts (current handler — preserve existing SSRF check ordering after the new auth check)
    - .planning/phases/04-authentication/04-CONTEXT.md (D-14 — auth first, BEFORE SSRF check)
    - .planning/phases/04-authentication/04-RESEARCH.md (Q4)
    - src/lib/auth.ts (exported getCurrentUser + UnauthorizedError)
    - src/lib/ssrf.ts (existing SsrfError class — do not touch)
    - tests/api/extract-watch-auth.test.ts (failing stub from Plan 01)
    - tests/ssrf.test.ts (existing SSRF test style — match format)
  </read_first>
  <behavior>
    - Test 1: POST with no session → returns 401 with body `{ error: 'Unauthorized' }`
    - Test 2: auth check runs BEFORE URL parsing (invalid URL + no session → 401, not 400)
    - Test 3: POST with valid session + invalid URL → 400 (existing SSRF behavior preserved)
    - Test 4: POST with valid session + valid URL → proceeds to fetchAndExtract (mocked)
  </behavior>
  <action>
Modify `src/app/api/extract-watch/route.ts`. Add the auth gate as the VERY FIRST thing inside the POST handler — before `request.json()`, before URL parsing, before the SSRF check. This ordering is locked by CONTEXT D-14 and RESEARCH Q4 (cheapest rejection first).

New imports to add at the top:
```ts
import { UnauthorizedError, getCurrentUser } from '@/lib/auth'
```

New auth-gate block at the top of POST (BEFORE `const body = await request.json()`):
```ts
export async function POST(request: NextRequest) {
  // AUTH-04 / D-14: auth gate runs FIRST, before URL parsing or SSRF check.
  // Proxy is an optimistic outer gate; this is the per-route-handler inner gate.
  try {
    await getCurrentUser()
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    throw err
  }

  try {
    const body = await request.json()
    // ... rest of existing handler UNCHANGED ...
```

Do NOT modify the existing URL validation, SSRF error handling, or success path. The auth gate is purely additive — preserve every existing line below it, including the outer `try/catch` and the `SsrfError` mapping to 400.

Replace the todos in `tests/api/extract-watch-auth.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  UnauthorizedError: class extends Error {
    constructor(m = 'Not authenticated') {
      super(m)
      this.name = 'UnauthorizedError'
    }
  },
  getCurrentUser: vi.fn(),
}))
vi.mock('@/lib/extractors', () => ({
  fetchAndExtract: vi.fn().mockResolvedValue({ name: 'mock' }),
}))

import { POST } from '@/app/api/extract-watch/route'
import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import { fetchAndExtract } from '@/lib/extractors'

function mkPost(body: unknown) {
  return new NextRequest('http://localhost/api/extract-watch', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/extract-watch auth gate — AUTH-04', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 { error: "Unauthorized" } when session is missing', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new UnauthorizedError())
    const res = await POST(mkPost({ url: 'https://example.com' }))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  it('returns 401 BEFORE running SSRF validation (auth runs first)', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new UnauthorizedError())
    // Invalid URL would normally produce 400; auth check must short-circuit.
    const res = await POST(mkPost({ url: 'not-a-valid-url' }))
    expect(res.status).toBe(401)
    expect(fetchAndExtract).not.toHaveBeenCalled()
  })

  it('proceeds past auth check when session is present', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u-1', email: 'a@b.co' })
    const res = await POST(mkPost({ url: 'https://example.com' }))
    expect(res.status).toBe(200)
    expect(fetchAndExtract).toHaveBeenCalledWith('https://example.com')
  })

  it('preserves 400 for invalid URL when session is present', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u-1', email: 'a@b.co' })
    const res = await POST(mkPost({ url: 'not-a-url' }))
    expect(res.status).toBe(400)
  })
})
```
  </action>
  <verify>
    <automated>npx vitest run tests/api/extract-watch-auth.test.ts tests/ssrf.test.ts --reporter=dot</automated>
  </verify>
  <acceptance_criteria>
    - `src/app/api/extract-watch/route.ts` contains import `from '@/lib/auth'`
    - `src/app/api/extract-watch/route.ts` contains literal string `getCurrentUser()`
    - `src/app/api/extract-watch/route.ts` contains literal string `{ error: 'Unauthorized' }`
    - `src/app/api/extract-watch/route.ts` contains literal string `status: 401`
    - The `getCurrentUser()` call appears BEFORE `request.json()` in file order (verify: `grep -n "getCurrentUser\|request.json" src/app/api/extract-watch/route.ts` shows getCurrentUser on a lower line number)
    - The existing `SsrfError` handling block is still present (not accidentally deleted during edit)
    - The existing URL protocol check (`['http:', 'https:']`) is still present
    - `npx vitest run tests/api/extract-watch-auth.test.ts` exits 0 with at least 4 passing tests, zero todo
    - `npx vitest run tests/ssrf.test.ts` still exits 0 (regression check — didn't break Phase 1)
  </acceptance_criteria>
  <done>/api/extract-watch has a belt-and-suspenders 401 gate that fires BEFORE the SSRF check, layered on top of the existing Phase 1 hardening without regressing it.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| internet → proxy.ts → app routes | Every request hits proxy first; proxy decides pass/redirect. Static assets bypass via matcher. |
| internet → /api/extract-watch | API route gets its own auth gate because proxy is optimistic (RESEARCH Risk #3). |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-4-01 | Elevation of privilege | proxy.ts matcher | mitigate | Deny-by-default matcher (negative lookahead) — every non-asset path requires a session. Public allowlist is inside the function body, NOT the matcher, so the proxy still runs on /login to refresh cookies. Tests assert redirect for unauth on `/` and pass-through for each public path. |
| T-4-07 | Spoofing | /api/extract-watch | mitigate | `getCurrentUser()` is called at the top of POST before any body parsing (D-14). Returns `401 JSON` on `UnauthorizedError`. Layers on top of existing SEC-01 SSRF check — tests assert 401 short-circuits invalid-URL input. |
| T-4-06 | Information disclosure | /login?next=<path> redirect | accept | `next` parameter is URL-encoded pathname + search. Login form validates it's a relative path before using it (enforced in Plan 05). No open-redirect vulnerability because `new URL(next, request.url)` is never used in proxy itself. |
| T-4-02 | Tampering | proxy cookie adapter | mitigate | Delegates to `updateSession` from Plan 02 which uses `getAll`/`setAll` and `getUser()` (not `getSession()`). Refreshed cookies propagate to downstream RSCs via the response-closure idiom. |
</threat_model>

<verification>
- `npx vitest run tests/proxy.test.ts tests/api/extract-watch-auth.test.ts tests/ssrf.test.ts` exits 0
- `ls proxy.ts` succeeds; `ls middleware.ts` fails (confirms file rename)
- `grep -n "getCurrentUser" src/app/api/extract-watch/route.ts` returns a line number BEFORE the first `request.json` line
- `npm run build` completes (smoke check — proxy.ts is loaded by Next at build time)
</verification>

<success_criteria>
1. Unauthenticated browser hitting `/` redirects to `/login?next=%2F` (proxy).
2. Unauthenticated `curl -X POST http://localhost:3000/api/extract-watch -d '{"url":"https://example.com"}'` returns `401 {"error":"Unauthorized"}` (route handler gate).
3. Authenticated browser hitting `/` sees the page (Phase 3 UI is still Zustand-powered, unchanged).
4. Dev terminal shows `[proxy] / user=<uuid> public=false` log line per ROADMAP success criterion #2.
5. Phase 1 SSRF protection still works: authenticated request to `/api/extract-watch` with a private IP still returns 400 with the SSRF error message.
</success_criteria>

<output>
After completion, create `.planning/phases/04-authentication/04-03-SUMMARY.md`.
</output>
