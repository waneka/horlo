---
phase: "04"
plan: 5
type: execute
wave: 3
depends_on: [2]
files_modified:
  - src/app/login/page.tsx
  - src/app/login/login-form.tsx
  - src/app/signup/page.tsx
  - src/app/signup/signup-form.tsx
  - src/app/forgot-password/page.tsx
  - src/app/forgot-password/forgot-password-form.tsx
  - src/app/reset-password/page.tsx
  - src/app/reset-password/reset-password-form.tsx
  - src/app/auth/callback/route.ts
autonomous: true
requirements:
  - AUTH-01
must_haves:
  truths:
    - "/login page renders an email+password form that calls supabase.auth.signInWithPassword and navigates to ?next on success"
    - "/signup page renders an email+password form that calls supabase.auth.signUp and navigates to / on success"
    - "/forgot-password page calls supabase.auth.resetPasswordForEmail with redirectTo pointing at /auth/callback?next=/reset-password"
    - "/auth/callback GET handler calls supabase.auth.verifyOtp({type,token_hash}) and redirects to ?next"
    - "/reset-password form calls supabase.auth.updateUser({password}) and redirects to /"
    - "All four pages are Server Components that read searchParams (Next 16 async) — form interaction lives in *-form.tsx 'use client' children"
    - "Error copy is neutral — no user enumeration between 'Invalid credentials' and 'Email not found'"
  artifacts:
    - path: "src/app/login/page.tsx"
      provides: "Login server component, reads next from searchParams"
    - path: "src/app/login/login-form.tsx"
      provides: "Client form component calling supabase.auth.signInWithPassword"
      contains: "'use client'"
    - path: "src/app/signup/page.tsx"
      provides: "Signup server component"
    - path: "src/app/signup/signup-form.tsx"
      provides: "Client form calling supabase.auth.signUp"
    - path: "src/app/forgot-password/page.tsx"
      provides: "Password reset request page"
    - path: "src/app/forgot-password/forgot-password-form.tsx"
      provides: "Client form calling resetPasswordForEmail"
    - path: "src/app/reset-password/page.tsx"
      provides: "Protected reset page (session from /auth/callback)"
    - path: "src/app/reset-password/reset-password-form.tsx"
      provides: "Client form calling updateUser({password})"
    - path: "src/app/auth/callback/route.ts"
      provides: "GET handler — verifyOtp({type,token_hash}), redirect(next)"
      contains: "verifyOtp"
  key_links:
    - from: "src/app/forgot-password/forgot-password-form.tsx"
      to: "supabase.auth.resetPasswordForEmail"
      via: "redirectTo: `${origin}/auth/callback?next=/reset-password`"
      pattern: "resetPasswordForEmail"
    - from: "src/app/auth/callback/route.ts"
      to: "supabase.auth.verifyOtp"
      via: "token_hash + type from searchParams"
      pattern: "verifyOtp"
---

<objective>
Ship the full auth UX surface: login, signup, forgot-password, reset-password, and the /auth/callback route handler that exchanges the password-reset token for a real session. Use existing shadcn primitives (Card, Input, Button, Label) — no new UI dependencies.

Purpose: without these pages, sign-up/login/logout/reset flows cannot be exercised end-to-end. Plan 06's UAT checkpoint depends on this plan.
Output: Four auth pages + one callback route handler, all composed from existing shadcn primitives with neutral error copy.
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
@src/app/layout.tsx
@src/components/ui/card.tsx
@src/components/ui/input.tsx
@src/components/ui/button.tsx
@src/components/ui/label.tsx

<interfaces>
<!-- From Plan 02 (already shipped): -->
// src/lib/supabase/client.ts
'use client'
export function createSupabaseBrowserClient(): SupabaseClient

// src/lib/supabase/server.ts
export async function createSupabaseServerClient(): Promise<SupabaseClient>

<!-- Next 16 async searchParams contract (from Next 16 authentication.md): -->
type PageProps = {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>
}

<!-- Password reset flow (RESEARCH Q5 — VERBATIM pattern): -->
1. /forgot-password form calls:
   supabase.auth.resetPasswordForEmail(email, {
     redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
   })
2. Supabase email contains link with ?token_hash=...&type=recovery&next=/reset-password
3. /auth/callback route handler GET:
   const { searchParams } = new URL(request.url)
   const token_hash = searchParams.get('token_hash')
   const type = searchParams.get('type') as EmailOtpType
   const next = searchParams.get('next') ?? '/'
   if (token_hash && type) {
     const supabase = await createSupabaseServerClient()
     const { error } = await supabase.auth.verifyOtp({ type, token_hash })
     if (!error) return NextResponse.redirect(new URL(next, request.url))
   }
   return NextResponse.redirect(new URL('/login?error=invalid_link', request.url))
4. /reset-password form calls:
   supabase.auth.updateUser({ password: newPassword })
   then router.push('/')
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create /login and /signup pages with client forms</name>
  <files>src/app/login/page.tsx, src/app/login/login-form.tsx, src/app/signup/page.tsx, src/app/signup/signup-form.tsx</files>
  <read_first>
    - .planning/phases/04-authentication/04-CONTEXT.md (D-08 email+password only, D-13 login reads next, D-09 signup immediately logged in)
    - src/components/ui/card.tsx, input.tsx, button.tsx, label.tsx (shadcn primitives to compose)
    - src/lib/supabase/client.ts (browser client from Plan 02)
    - src/app/layout.tsx (to understand existing font/theme wrapping)
    - node_modules/next/dist/docs/01-app/02-guides/authentication.md (Next 16 searchParams async pattern)
  </read_first>
  <action>
Create four files. Each page is a Server Component; each form is a `'use client'` child that handles `useState` + Supabase browser client calls.

**src/app/login/page.tsx:**
```tsx
import { LoginForm } from './login-form'

type PageProps = {
  searchParams: Promise<{ next?: string; error?: string }>
}

export default async function LoginPage({ searchParams }: PageProps) {
  const params = await searchParams
  const nextParam = typeof params.next === 'string' ? params.next : '/'
  // Guard against open-redirect: only allow same-origin relative paths
  const safeNext = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/'
  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      <LoginForm next={safeNext} initialError={params.error} />
    </main>
  )
}
```

**src/app/login/login-form.tsx:**
```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(
    initialError === 'invalid_link' ? 'That link is invalid or expired.' : null,
  )
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createSupabaseBrowserClient()
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) {
      // Neutral copy — no user enumeration
      setError('Invalid email or password.')
      setLoading(false)
      return
    }
    router.push(next)
    router.refresh()
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="font-serif text-2xl">Sign in to Horlo</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
          <div className="flex w-full justify-between text-sm text-muted-foreground">
            <Link href="/signup" className="hover:text-foreground">
              Create account
            </Link>
            <Link href="/forgot-password" className="hover:text-foreground">
              Forgot password?
            </Link>
          </div>
        </CardFooter>
      </form>
    </Card>
  )
}
```

**src/app/signup/page.tsx:**
```tsx
import { SignupForm } from './signup-form'

export default async function SignupPage() {
  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      <SignupForm />
    </main>
  )
}
```

**src/app/signup/signup-form.tsx:**
Same pattern as LoginForm but calls `supabase.auth.signUp({ email, password })` and on success calls `router.push('/')`. Neutral error copy `'Could not create account.'` (don't leak whether email is already registered — user enumeration). After successful signUp, because D-09 sets email confirmations off, the user is immediately logged in; just navigate home and refresh.

Heading: "Create your Horlo account". Footer link: "Already have an account? Sign in" → /login.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&amp;1 | grep -E "src/app/(login|signup)" | head; test -f src/app/login/page.tsx &amp;&amp; test -f src/app/login/login-form.tsx &amp;&amp; test -f src/app/signup/page.tsx &amp;&amp; test -f src/app/signup/signup-form.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `src/app/login/page.tsx` exists AND contains `searchParams: Promise<` (Next 16 async contract)
    - `src/app/login/page.tsx` contains `await searchParams`
    - `src/app/login/login-form.tsx` first non-comment line is `'use client'`
    - `src/app/login/login-form.tsx` contains `signInWithPassword`
    - `src/app/login/login-form.tsx` contains `router.push(next)` AND `router.refresh()`
    - `src/app/login/login-form.tsx` contains literal string `'Invalid email or password.'` (neutral copy)
    - `src/app/login/page.tsx` contains string `safeNext` or equivalent relative-path guard (`startsWith('/')`)
    - `src/app/signup/signup-form.tsx` contains `supabase.auth.signUp`
    - `src/app/signup/signup-form.tsx` contains neutral error copy (no "already registered" message)
    - `npx tsc --noEmit` reports zero errors for these 4 files
    - `npm run build` completes without error (smoke check — pages load)
  </acceptance_criteria>
  <done>Login and signup pages composed from existing shadcn primitives, Next 16 async searchParams handled correctly, neutral error copy prevents user enumeration.</done>
</task>

<task type="auto">
  <name>Task 2: Create /forgot-password + /reset-password + /auth/callback route</name>
  <files>src/app/forgot-password/page.tsx, src/app/forgot-password/forgot-password-form.tsx, src/app/reset-password/page.tsx, src/app/reset-password/reset-password-form.tsx, src/app/auth/callback/route.ts</files>
  <read_first>
    - .planning/phases/04-authentication/04-CONTEXT.md (D-10 password reset flow)
    - .planning/phases/04-authentication/04-RESEARCH.md (Q5 — verifyOtp flow, VERBATIM)
    - src/lib/supabase/server.ts (needed by /auth/callback route handler)
    - src/lib/supabase/client.ts (needed by forgot-password and reset-password client forms)
    - src/app/login/login-form.tsx (Task 1 output — match form card structure)
    - src/app/api/extract-watch/route.ts (existing route handler pattern — match NextRequest/NextResponse import style)
  </read_first>
  <action>
Create five files.

**src/app/forgot-password/page.tsx:**
```tsx
import { ForgotPasswordForm } from './forgot-password-form'
export default async function ForgotPasswordPage() {
  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      <ForgotPasswordForm />
    </main>
  )
}
```

**src/app/forgot-password/forgot-password-form.tsx:**
```tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })
    // Always show the same success state regardless of whether the email exists (no enumeration)
    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader><CardTitle>Check your inbox</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            If an account exists for that email, a reset link has been sent.
          </p>
        </CardContent>
        <CardFooter>
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
            Back to sign in
          </Link>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader><CardTitle className="font-serif text-2xl">Reset your password</CardTitle></CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Sending…' : 'Send reset link'}
          </Button>
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
            Back to sign in
          </Link>
        </CardFooter>
      </form>
    </Card>
  )
}
```

**src/app/reset-password/page.tsx:**
```tsx
import { ResetPasswordForm } from './reset-password-form'
export default async function ResetPasswordPage() {
  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      <ResetPasswordForm />
    </main>
  )
}
```

**src/app/reset-password/reset-password-form.tsx:**
```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

export function ResetPasswordForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    setError(null)
    const supabase = createSupabaseBrowserClient()
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) {
      setError('Could not update password. The reset link may have expired.')
      setLoading(false)
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader><CardTitle className="font-serif text-2xl">Set a new password</CardTitle></CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input id="confirm" type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Updating…' : 'Update password'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
```

**src/app/auth/callback/route.ts:**
```ts
import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/'

  // Guard: only allow relative, same-origin next values (no open-redirect)
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/'

  if (token_hash && type) {
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      return NextResponse.redirect(new URL(safeNext, origin))
    }
  }

  return NextResponse.redirect(new URL('/login?error=invalid_link', origin))
}
```

Key invariants:
- `/auth/callback/route.ts` MUST use `createSupabaseServerClient` (NOT the browser client) — it's a route handler.
- `verifyOtp({ type, token_hash })` is the current Supabase 2026 pattern (RESEARCH Q5), NOT `exchangeCodeForSession` (older PKCE flow).
- The relative-path guard on `next` prevents open-redirect attacks.
- All four forms use neutral error copy — no user enumeration.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&amp;1 | grep -E "src/app/(forgot-password|reset-password|auth/callback)" | head; test -f src/app/auth/callback/route.ts &amp;&amp; test -f src/app/reset-password/reset-password-form.tsx &amp;&amp; test -f src/app/forgot-password/forgot-password-form.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `src/app/forgot-password/forgot-password-form.tsx` first non-comment line is `'use client'`
    - `src/app/forgot-password/forgot-password-form.tsx` contains `resetPasswordForEmail`
    - `src/app/forgot-password/forgot-password-form.tsx` contains literal string `/auth/callback?next=/reset-password`
    - `src/app/forgot-password/forgot-password-form.tsx` shows the same success UI regardless of whether email exists (no enumeration)
    - `src/app/reset-password/reset-password-form.tsx` contains `supabase.auth.updateUser({ password })`
    - `src/app/reset-password/reset-password-form.tsx` validates `password === confirm` AND `password.length >= 8`
    - `src/app/auth/callback/route.ts` exports `async function GET(request: NextRequest)`
    - `src/app/auth/callback/route.ts` contains `verifyOtp({ type, token_hash })`
    - `src/app/auth/callback/route.ts` contains `createSupabaseServerClient` (NOT the browser client)
    - `src/app/auth/callback/route.ts` contains `safeNext` or equivalent `startsWith('/')` guard
    - `src/app/auth/callback/route.ts` does NOT contain `exchangeCodeForSession` (the older PKCE API)
    - `npx tsc --noEmit` reports zero errors for all five files
    - `npm run build` completes successfully
  </acceptance_criteria>
  <done>Password-reset flow complete: forgot-password -> Supabase email -> /auth/callback verifyOtp -> /reset-password updateUser -> home. All pages composed from existing shadcn primitives with neutral copy and open-redirect guards.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| anon visitor → /login form | Untrusted email+password submitted; Supabase validates. |
| Supabase email → /auth/callback | token_hash in URL is single-use, validated server-side via verifyOtp. |
| client form → supabase.auth.updateUser | Only reachable by a user with a valid recovery session set by /auth/callback. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-4-05 | Information disclosure | /login, /signup, /forgot-password error copy | mitigate | Neutral copy: "Invalid email or password." for login, "Could not create account." for signup, "If an account exists..." for forgot-password. No branching based on email existence. Enforced via acceptance criteria grep checks. |
| T-4-06 | Tampering | /auth/callback token replay | mitigate | Uses `verifyOtp({type:'recovery',token_hash})` — Supabase enforces single-use token semantics server-side. Short TTL configured on the Supabase side (default 1 hour). HTTPS-only cookies set via `setAll` adapter. |
| T-4-01 | Elevation of privilege | /login?next= open-redirect | mitigate | `safeNext` guard: `startsWith('/') && !startsWith('//')` — rejects protocol-relative URLs and absolute URLs. Verified by acceptance criteria. Same guard in /auth/callback for its `next` param. |
| T-4-02 | Spoofing | /auth/callback GET | mitigate | Uses server client (`createSupabaseServerClient`), which calls `verifyOtp` server-side against Supabase. Cannot be bypassed by forging client state. |
| T-4-07 | Repudiation | Password reset double-submit | accept | `updateUser({password})` is idempotent; repeat submissions just re-set the same password. No audit log requirement in v1. |
</threat_model>

<verification>
- `npx tsc --noEmit` reports zero errors across src/app/{login,signup,forgot-password,reset-password,auth}/**
- `npm run build` completes (smoke check — all four pages and the route handler compile)
- `grep -r "exchangeCodeForSession" src/app` returns no matches (confirms using the current verifyOtp pattern)
- `grep -r "signInWithPassword\|signUp\|resetPasswordForEmail\|updateUser\|verifyOtp" src/app` returns exactly one match per expected call site
- Manual UAT items (full sign-up → log in → reset password flow against local Inbucket) are deferred to Plan 06's checkpoint
</verification>

<success_criteria>
1. Visiting `/login?next=/preferences` renders a card form; successful auth navigates to `/preferences`.
2. Visiting `/signup` and submitting credentials creates a user and immediately lands them on `/` (email confirmations off per D-09).
3. Visiting `/forgot-password`, submitting an email, and visiting the Inbucket link (`http://localhost:54324`) produces a working reset flow that ends on `/`.
4. Hitting `/auth/callback` with no params redirects to `/login?error=invalid_link`.
5. All four auth pages still work if JS is disabled for the heading + card layout (forms require JS — documented limitation for v1).
</success_criteria>

<output>
After completion, create `.planning/phases/04-authentication/04-05-SUMMARY.md`.
</output>
