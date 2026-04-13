---
phase: "04"
plan: 6
type: execute
wave: 4
depends_on: [2, 5]
files_modified:
  - src/components/layout/Header.tsx
  - src/components/layout/HeaderNav.tsx
  - src/components/layout/UserMenu.tsx
autonomous: false
requirements:
  - AUTH-01
must_haves:
  truths:
    - "Header.tsx becomes a Server Component that calls getCurrentUser() (with try/catch → null fallback)"
    - "usePathname-dependent nav rendering is extracted to a new 'use client' HeaderNav.tsx child"
    - "A new UserMenu.tsx Server Component renders the shadcn DropdownMenu with an avatar/email trigger and a logout form-submit item"
    - "Unauthenticated users on public pages see 'Sign in' Link instead of the user menu"
    - "Logout button is inside a <form action={logout}> so it works without client JS"
    - "Full end-to-end UAT (signup, login, add watch, logout, forgot-password) passes against the local Supabase stack"
  artifacts:
    - path: "src/components/layout/Header.tsx"
      provides: "Header shell — Server Component with await getCurrentUser() and UserMenu or Sign in link"
      contains: "getCurrentUser"
    - path: "src/components/layout/HeaderNav.tsx"
      provides: "Client component with usePathname-aware nav links (extracted from old Header)"
      contains: "'use client'"
    - path: "src/components/layout/UserMenu.tsx"
      provides: "Server component with shadcn DropdownMenu + logout form"
      contains: "logout"
  key_links:
    - from: "src/components/layout/UserMenu.tsx"
      to: "src/app/actions/auth.ts logout"
      via: "<form action={logout}>"
      pattern: "action=\\{logout\\}"
    - from: "src/components/layout/Header.tsx"
      to: "src/lib/auth.ts getCurrentUser"
      via: "try/catch around await getCurrentUser"
      pattern: "getCurrentUser"
---

<objective>
Close the loop on the authenticated UX: convert Header.tsx from a client-only component to a Server Component that knows about the current user, extract usePathname-dependent nav rendering into HeaderNav.tsx (client), add the new UserMenu.tsx (Server Component) with a shadcn DropdownMenu and a no-JS-friendly logout form. Then gate the whole phase behind a UAT checkpoint that exercises every AUTH-01..04 flow against the running local Supabase stack.

Purpose: without this plan the Header.tsx still shows "Add Watch" but has no login/logout affordance, making the auth flows untestable from the UI. The UAT checkpoint is the gate between Phase 4 and Phase 5.
Output: Shipped UserMenu and a signed-off UAT for every Phase 4 success criterion.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/04-authentication/04-CONTEXT.md
@.planning/phases/04-authentication/04-RESEARCH.md
@.planning/phases/04-authentication/04-02-SUMMARY.md
@.planning/phases/04-authentication/04-05-SUMMARY.md
@.planning/ROADMAP.md
@src/components/layout/Header.tsx
@src/components/layout/MobileNav.tsx
@src/components/layout/ThemeToggle.tsx
@src/components/ui/dropdown-menu.tsx
@src/components/ui/button.tsx

<interfaces>
<!-- From Plan 02: -->
// src/lib/auth.ts
export async function getCurrentUser(): Promise<{ id: string; email: string }>
export class UnauthorizedError extends Error {}

// src/app/actions/auth.ts
'use server'
export async function logout(): Promise<void>  // throws NEXT_REDIRECT

<!-- From Plan 01 (Wave 0): -->
// src/components/ui/dropdown-menu.tsx — shadcn primitive
export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator }

<!-- Current Header.tsx shape (from src/components/layout/Header.tsx): -->
- Line 1: 'use client'
- Line 17: const pathname = usePathname() — used by navItems active-state
- Lines 44-49: right-side div with ThemeToggle + "Add Watch" Link/Button
- This plan extracts the pathname-dependent nav into HeaderNav and makes Header itself a server component.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extract HeaderNav (client) + convert Header to Server Component + add UserMenu</name>
  <files>src/components/layout/HeaderNav.tsx, src/components/layout/Header.tsx, src/components/layout/UserMenu.tsx</files>
  <read_first>
    - src/components/layout/Header.tsx (existing 53-line client component)
    - src/components/layout/MobileNav.tsx (existing client component rendered inside Header — verify it can still be imported by a Server Component; client components can be imported BY server components, not vice versa)
    - src/components/layout/ThemeToggle.tsx (client component — same note)
    - src/lib/auth.ts (getCurrentUser + UnauthorizedError from Plan 02)
    - src/app/actions/auth.ts (logout from Plan 02)
    - src/components/ui/dropdown-menu.tsx (shadcn primitive from Plan 01 — confirm exports)
    - .planning/phases/04-authentication/04-RESEARCH.md (Q9 — Header refactor strategy)
    - src/app/layout.tsx (to confirm Header is rendered server-side — if it's inside a client tree, the refactor must be adjusted)
  </read_first>
  <action>
Three file changes:

**1. Create `src/components/layout/HeaderNav.tsx` (NEW, client):**
```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', label: 'Collection' },
  { href: '/insights', label: 'Insights' },
  { href: '/preferences', label: 'Preferences' },
]

export function HeaderNav() {
  const pathname = usePathname()
  return (
    <nav className="hidden md:flex items-center gap-6">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            'text-sm font-semibold transition-colors hover:text-foreground',
            pathname === item.href ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
```

**2. Create `src/components/layout/UserMenu.tsx` (NEW, server):**
```tsx
import Link from 'next/link'
import { logout } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function UserMenu({ user }: { user: { id: string; email: string } | null }) {
  if (!user) {
    return (
      <Link href="/login">
        <Button variant="ghost">Sign in</Button>
      </Link>
    )
  }

  // Derive initials from email local-part for the avatar trigger
  const local = user.email.split('@')[0] ?? ''
  const initials = local.slice(0, 2).toUpperCase() || 'U'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="font-serif">
          {initials}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="text-xs text-muted-foreground">Signed in as</div>
          <div className="truncate text-sm">{user.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <form action={logout} className="w-full">
            <button type="submit" className="w-full text-left">
              Log out
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

Note the `<form action={logout}>` pattern — this is a Server Action form submission that works without client JS (progressive enhancement). The DropdownMenuItem's `asChild` prop lets us put the form inside without double-wrapping button elements.

**3. Rewrite `src/components/layout/Header.tsx` as a Server Component:**
```tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { MobileNav } from '@/components/layout/MobileNav'
import { HeaderNav } from '@/components/layout/HeaderNav'
import { UserMenu } from '@/components/layout/UserMenu'
import { getCurrentUser, UnauthorizedError } from '@/lib/auth'

export async function Header() {
  let user: { id: string; email: string } | null = null
  try {
    user = await getCurrentUser()
  } catch (err) {
    if (!(err instanceof UnauthorizedError)) throw err
    // unauth is the expected case on /login, /signup, etc.
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2 md:gap-8">
          <MobileNav />
          <Link href="/" className="flex items-center gap-2">
            <span className="font-serif text-xl">Horlo</span>
          </Link>
          <HeaderNav />
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          {user && (
            <Link href="/watch/new">
              <Button>Add Watch</Button>
            </Link>
          )}
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  )
}
```

Critical invariants:

1. Header.tsx MUST NOT have `'use client'` — it's a Server Component now.
2. The `try { await getCurrentUser() } catch` block MUST catch `UnauthorizedError` specifically and re-throw other errors — silent swallow would hide bugs.
3. `HeaderNav` and `UserMenu` MUST be imported directly (Server Component can import both client and server children).
4. "Add Watch" button only renders when user is present — prevents the logged-out view from teasing an action that would redirect to /login anyway.
5. The logout form uses the logout Server Action from Plan 02; `DropdownMenuItem asChild` keeps the form from wrapping an extra element.

If `src/app/layout.tsx` currently imports Header with a named import, verify it doesn't require any change — the export is still `export async function Header`.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&amp;1 | grep -E "src/components/layout/(Header|HeaderNav|UserMenu)" | head &amp;&amp; ! grep -q "^'use client'" src/components/layout/Header.tsx &amp;&amp; grep -q "^'use client'" src/components/layout/HeaderNav.tsx &amp;&amp; grep -q "getCurrentUser" src/components/layout/Header.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `src/components/layout/Header.tsx` does NOT contain `'use client'` on its first non-comment line
    - `src/components/layout/Header.tsx` exports `async function Header` (note `async`)
    - `src/components/layout/Header.tsx` contains `await getCurrentUser()`
    - `src/components/layout/Header.tsx` contains `catch` AND `UnauthorizedError`
    - `src/components/layout/Header.tsx` does NOT contain `usePathname` (moved to HeaderNav)
    - `src/components/layout/HeaderNav.tsx` first non-comment line is `'use client'`
    - `src/components/layout/HeaderNav.tsx` contains `usePathname` AND renders `navItems`
    - `src/components/layout/UserMenu.tsx` contains `<form action={logout}`
    - `src/components/layout/UserMenu.tsx` imports from `@/components/ui/dropdown-menu`
    - `src/components/layout/UserMenu.tsx` imports `logout` from `@/app/actions/auth`
    - `src/components/layout/UserMenu.tsx` renders `'Sign in'` when `user === null`
    - `npx tsc --noEmit` reports zero errors for the three files
    - `npm run build` completes without error
    - Full test suite `npm test` still exits 0 (no regressions)
  </acceptance_criteria>
  <done>Header is now a Server Component aware of the current user, nav rendering still works via HeaderNav client child, UserMenu ships a shadcn DropdownMenu with a no-JS logout form.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: UAT — full Phase 4 end-to-end verification against local Supabase stack</name>
  <files></files>
  <read_first>
    - .planning/ROADMAP.md (Phase 4 Success Criteria — five items to verify)
    - .planning/phases/04-authentication/04-CONTEXT.md (every D-01..D-16 should be observable)
    - .planning/phases/04-authentication/04-VALIDATION.md (Manual-Only Verifications table)
  </read_first>
  <what-built>
Complete Phase 4 surface:
- proxy.ts session enforcement on every non-asset route
- getCurrentUser() session helper used by actions + route handler + header
- Server Actions refactored to drop userId and read from session
- /api/extract-watch 401 gate on top of SSRF
- Auth pages (/login, /signup, /forgot-password, /reset-password, /auth/callback)
- Header UserMenu with shadcn DropdownMenu and logout form
- Shadow-user trigger keeps FKs resolved
  </what-built>
  <action>
  Run `npm run dev` with the local Supabase stack active, then walk through every flow enumerated in the `<how-to-verify>` block below. This task is manual by design — the goal is end-to-end human verification of AUTH-01..04 against real browser + cookies + email.
  </action>
  <how-to-verify>
Run `npm run dev` with local Supabase stack running. Execute each of these flows IN ORDER and record pass/fail:

**AUTH-01: Sign-up -> immediately logged in**
1. Open a private/incognito window and visit `http://localhost:3000/`
2. EXPECT: Browser redirects to `/login?next=%2F`
3. Click "Create account" link
4. Enter a new email (e.g., `uat-1@horlo.test`) and a password of 8+ chars
5. Click "Create account"
6. EXPECT: Redirect to `/` — collection page renders
7. EXPECT: Header shows the initials badge (e.g., "UA") instead of "Sign in"
8. EXPECT: Terminal dev log shows `[proxy] / user=<uuid> public=false`

**AUTH-02: proxy enforcement + Server Action re-verification**
1. Still logged in, click "Add Watch" in the header
2. Fill in a minimum valid watch (brand + model + status + movement) and submit
3. EXPECT: Watch appears in the collection (Phase 3 DAL wrote it, Server Action read user.id from session)
4. Open browser devtools -> Application -> Cookies -> find a cookie starting with `sb-`
5. Edit that cookie to garbage (single character change)
6. Refresh `/`
7. EXPECT: Redirect to `/login?next=%2F` — getUser rejected the tampered cookie

**AUTH-02 success criterion #2: log line confirms proxy executes**
1. Watch the dev server terminal
2. Visit `/insights`
3. EXPECT: terminal prints `[proxy] /insights user=<uuid> public=false`

**AUTH-03: IDOR denial**
1. Create a second user via `/signup` (e.g., `uat-2@horlo.test`) in a different browser profile
2. User 2 adds a watch; note the watch ID from the URL or devtools
3. In user 1's browser, open devtools console on the collection page and type:
   ```js
   fetch('/some-edit-endpoint', ...)  // OR use the edit button on a watch
   ```
   Since the UI only shows user 1's watches, an easier check: user 1 cannot SEE user 2's watch at all.
4. EXPECT: collection shows only user 1's watches. Switching users shows only their own.
5. Automated: the tests/data/isolation.test.ts integration test (Plan 04) already proves the IDOR behavior at the Server Action layer.

**AUTH-04: /api/extract-watch 401 gate**
1. From an anonymous terminal:
   ```
   curl -i -X POST http://localhost:3000/api/extract-watch \
     -H 'Content-Type: application/json' \
     -d '{"url":"https://example.com"}'
   ```
2. EXPECT: `HTTP/1.1 401` with body `{"error":"Unauthorized"}`
3. (Optional — requires session cookie copy) Log in via browser, copy the session cookie, re-run curl with `-H "Cookie: sb-...="` — EXPECT: 200 or real extraction result

**AUTH-01: Logout**
1. While logged in, click the initials badge in the header
2. EXPECT: DropdownMenu opens showing email + "Log out"
3. Click "Log out"
4. EXPECT: Redirect to `/login`
5. Try to visit `/` directly — EXPECT: redirect to `/login?next=%2F`

**AUTH-01: Password reset (local Inbucket)**
1. On `/login`, click "Forgot password?"
2. Enter the email of user 1 (`uat-1@horlo.test`), submit
3. EXPECT: "Check your inbox" success state
4. Open `http://localhost:54324` (local Inbucket)
5. Find the most recent email to `uat-1@horlo.test`, click the reset link
6. EXPECT: Browser lands on `/reset-password`
7. Enter a new password (8+ chars), confirm it, submit
8. EXPECT: Redirect to `/`
9. Log out, log back in with the NEW password — EXPECT: success

**Full test suite**
1. Run `npm test` — EXPECT: zero failures
2. Run `NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx vitest run tests/data/isolation.test.ts` — EXPECT: 3 passes
  </how-to-verify>
  <acceptance_criteria>
    - AUTH-01 signup → immediately logged in: PASS
    - AUTH-01 login after logout: PASS
    - AUTH-01 logout flow from UserMenu: PASS
    - AUTH-01 password reset end-to-end via Inbucket: PASS
    - AUTH-02 proxy log line appears on protected route: PASS
    - AUTH-02 tampered cookie redirects to /login (server-verified via getUser): PASS
    - AUTH-03 User 1 does not see User 2's watches (visible UI isolation): PASS
    - AUTH-03 integration test green against local Postgres: PASS
    - AUTH-04 curl with no session returns 401 JSON: PASS
    - `npm test` full suite green: PASS
    - `npm run build` completes: PASS
    - No console errors in dev server during any flow
  </acceptance_criteria>
  <verify>
    <automated>npm test &amp;&amp; npm run build</automated>
  </verify>
  <resume-signal>Type "approved" once every line in how-to-verify has been checked. If any step failed, describe what happened and which file is the suspect.</resume-signal>
  <done>Every AUTH-01..04 success criterion observed end-to-end against the local Supabase stack. Phase 4 is ready to hand off to Phase 5.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Server Component Header → getCurrentUser | Runs on every rendered page; failure must be handled gracefully for public pages. |
| UserMenu form submit → logout Server Action | Progressive enhancement — works without JS via form POST. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-4-04 | Repudiation | UserMenu logout form | mitigate | Logout is a Server Action form POST. Form action includes Next.js's built-in CSRF origin check (Next 16 Server Action contract). The logout action calls `supabase.auth.signOut()` which clears cookies via the `setAll` adapter — not revertible by replaying an old form submission. |
| T-4-02 | Spoofing | Header Server Component getCurrentUser | mitigate | Uses `getCurrentUser()` (server-verified via `supabase.auth.getUser()`) — if cookie is tampered, the catch branch sets `user = null`, header renders "Sign in" state, no data is leaked. |
| T-4-05 | Information disclosure | UserMenu email display | accept | The user's own email is shown only when they are authenticated. No other users' emails are displayed. Single-user app model (PROJECT.md constraint). |
| T-4-07 | Denial of service | Header getCurrentUser on every request | accept | Every page render calls `supabase.auth.getUser()` which hits Supabase. For local dev ~10ms; for prod this is a known Supabase cost. Matches RESEARCH Risk #13 — not a v1 blocker. |
</threat_model>

<verification>
- `npx tsc --noEmit` reports zero errors
- `npm run build` completes successfully
- `npm test` full suite green
- Manual UAT checklist above signed off
</verification>

<success_criteria>
1. Every Phase 4 ROADMAP success criterion observed end-to-end in the browser:
   (a) Sign-up/login/logout through UI backed by Supabase Auth
   (b) proxy.ts log line confirms the proxy executes on protected routes
   (c) Tampered cookie returns 401/redirect even if proxy is bypassed (proven via Server Action re-verification)
   (d) IDOR attempts denied at DAL level (automated + visual UI check)
   (e) /api/extract-watch returns 401 on unauth curl
2. All four auth pages usable from the header UserMenu.
3. Phase 4 is ready to hand off to Phase 5 (migration + Zustand demotion).
</success_criteria>

<output>
After completion, create `.planning/phases/04-authentication/04-06-SUMMARY.md`.
</output>
