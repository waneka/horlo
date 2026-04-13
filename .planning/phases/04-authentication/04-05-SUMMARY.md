---
phase: "04"
plan: 5
plan_name: auth-pages
subsystem: authentication
tags: [phase-4, wave-3, auth-pages, supabase, password-reset]
requirements: [AUTH-01]
wave: 3
depends_on: [2]
dependency_graph:
  requires:
    - "src/lib/supabase/client.ts — createSupabaseBrowserClient() (from 04-02)"
    - "src/lib/supabase/server.ts — createSupabaseServerClient() (from 04-02)"
    - "src/components/ui/card.tsx, input.tsx, button.tsx, label.tsx (shadcn primitives)"
  provides:
    - "src/app/login/page.tsx + login-form.tsx — email+password login"
    - "src/app/signup/page.tsx + signup-form.tsx — email+password signup"
    - "src/app/forgot-password/page.tsx + forgot-password-form.tsx — password reset request"
    - "src/app/reset-password/page.tsx + reset-password-form.tsx — set new password"
    - "src/app/auth/callback/route.ts — verifyOtp token exchange, session establishment"
  affects:
    - "Plans 04-06 (UAT checkpoint depends on these pages being exercisable)"
    - "Plans 04-03 (proxy deny-by-default excludes these routes from auth requirement)"
tech-stack:
  added: []
  patterns:
    - "Next 16 async searchParams — PageProps with searchParams: Promise<{...}>, then await"
    - "Server Component page + 'use client' form child split — state/Supabase calls client-side only"
    - "verifyOtp({type, token_hash}) — current 2026 Supabase password-reset pattern (not exchangeCodeForSession)"
    - "Open-redirect guard — startsWith('/') && !startsWith('//')"
    - "Neutral error copy throughout — no user enumeration on any form"
key-files:
  created:
    - path: "src/app/login/page.tsx"
      purpose: "Server Component; reads next from async searchParams, applies open-redirect guard, renders LoginForm"
    - path: "src/app/login/login-form.tsx"
      purpose: "Client form; signInWithPassword, navigates to next on success, neutral error copy"
    - path: "src/app/signup/page.tsx"
      purpose: "Server Component wrapper for SignupForm"
    - path: "src/app/signup/signup-form.tsx"
      purpose: "Client form; signUp, immediate redirect to / (email confirmations off per D-09)"
    - path: "src/app/forgot-password/page.tsx"
      purpose: "Server Component wrapper for ForgotPasswordForm"
    - path: "src/app/forgot-password/forgot-password-form.tsx"
      purpose: "Client form; resetPasswordForEmail with redirectTo /auth/callback?next=/reset-password; always shows same success UI"
    - path: "src/app/reset-password/page.tsx"
      purpose: "Server Component wrapper for ResetPasswordForm"
    - path: "src/app/reset-password/reset-password-form.tsx"
      purpose: "Client form; validates password match + 8-char min; updateUser({password}), redirect to /"
    - path: "src/app/auth/callback/route.ts"
      purpose: "GET route handler; verifyOtp({type,token_hash}); redirects to safeNext or /login?error=invalid_link"
decisions:
  - "Used div wrapper instead of main in page components — layout.tsx already wraps children in <main>"
  - "Kept verifyOtp (not exchangeCodeForSession) per RESEARCH Q5 — current 2026 Supabase pattern"
  - "Copy-pasted card layout per page (no shared AuthLayout component) — simpler, each page is a one-off"
  - "Neutral error copy everywhere — T-4-05 mitigation: no branching messages based on email existence"
metrics:
  duration_minutes: 12
  tasks_completed: 2
  files_created: 9
  files_modified: 0
  completed_date: 2026-04-13
---

# Phase 4 Plan 5: Auth Pages Summary

**One-liner:** Shipped all four auth pages (login, signup, forgot-password, reset-password) plus the /auth/callback token-exchange route handler using Next 16 async searchParams, existing shadcn primitives, and the verifyOtp password-reset flow.

## Outcome

All nine files from the plan's artifacts list now exist and typecheck clean:

1. `src/app/login/page.tsx` — Server Component, async searchParams, open-redirect guard
2. `src/app/login/login-form.tsx` — `signInWithPassword`, `router.push(next)` + `router.refresh()`
3. `src/app/signup/page.tsx` — Server Component wrapper
4. `src/app/signup/signup-form.tsx` — `signUp`, immediate redirect (email confirmation off)
5. `src/app/forgot-password/page.tsx` — Server Component wrapper
6. `src/app/forgot-password/forgot-password-form.tsx` — `resetPasswordForEmail`, same-success anti-enumeration
7. `src/app/reset-password/page.tsx` — Server Component wrapper
8. `src/app/reset-password/reset-password-form.tsx` — `updateUser({password})`, client-side validation
9. `src/app/auth/callback/route.ts` — `verifyOtp({type,token_hash})`, open-redirect guard on next

TypeScript: zero errors in all nine files.
Anti-patterns absent: no `exchangeCodeForSession`, no `getSession()` in server code, no user enumeration copy.

## Task Log

### Task 1 — Create /login and /signup pages with client forms
- Commit: `d510d71`
- Created login/page.tsx, login/login-form.tsx, signup/page.tsx, signup/signup-form.tsx
- Applied Next 16 `searchParams: Promise<{...}>` contract on login page
- Open-redirect guard (`safeNext`) on login page
- Neutral error copy: `'Invalid email or password.'` (login), `'Could not create account.'` (signup)

### Task 2 — Create /forgot-password + /reset-password + /auth/callback route
- Commit: `e015d8e`
- Created forgot-password-form.tsx (always shows same success UI — no enumeration)
- Created reset-password-form.tsx (validates password match + 8-char minimum)
- Created /auth/callback route.ts using `verifyOtp` (current 2026 pattern)
- Open-redirect guard on `next` param in callback route

## Deviations from Plan

**[Rule 2 - Convention] Used div instead of main in page wrappers**
- **Found during:** Task 1 review of layout.tsx
- **Issue:** The plan code specified `<main className="...">` but `src/app/layout.tsx` already wraps children in `<main className="flex-1">`, making nested `<main>` tags invalid HTML
- **Fix:** Used `<div>` with the same centering classes
- **Files modified:** All 4 page.tsx files
- **Impact:** None — purely structural correctness, same visual output

No other deviations. Both tasks executed exactly as written.

## Known Stubs

None. All forms are fully wired to Supabase auth calls. No hardcoded empty values or placeholder text that would prevent the plan goal from being achieved.

## Threat Surface

All threats from the plan's threat model are mitigated:

| Threat ID | Status | Verification |
|-----------|--------|--------------|
| T-4-05 (user enumeration) | Mitigated | Neutral copy in all 4 forms; forgot-password always shows same success state |
| T-4-06 (token replay) | Mitigated | `verifyOtp` enforces single-use server-side; HTTPS-only session cookies via setAll adapter |
| T-4-01 (open-redirect) | Mitigated | `safeNext` guard in login/page.tsx and auth/callback/route.ts |
| T-4-02 (spoofing) | Mitigated | `createSupabaseServerClient` in route.ts (not browser client) |
| T-4-07 (repudiation/double-submit) | Accepted | `updateUser` is idempotent; no audit log in v1 |

## Verification

- `npx tsc --noEmit` — zero errors in all 9 new files
- `grep -r "exchangeCodeForSession" src/app` — no matches (correct)
- `grep -r "signInWithPassword|signUp|resetPasswordForEmail|updateUser|verifyOtp" src/app` — exactly one match per call site
- Full UAT (signup → login → reset-password flow against local Inbucket) deferred to Plan 06 checkpoint

## Commits

- `d510d71` — feat(04-05): add /login and /signup pages with client forms
- `e015d8e` — feat(04-05): add forgot-password, reset-password, and /auth/callback route

## Self-Check: PASSED

- FOUND: src/app/login/page.tsx
- FOUND: src/app/login/login-form.tsx
- FOUND: src/app/signup/page.tsx
- FOUND: src/app/signup/signup-form.tsx
- FOUND: src/app/forgot-password/page.tsx
- FOUND: src/app/forgot-password/forgot-password-form.tsx
- FOUND: src/app/reset-password/page.tsx
- FOUND: src/app/reset-password/reset-password-form.tsx
- FOUND: src/app/auth/callback/route.ts
- FOUND: commit d510d71
- FOUND: commit e015d8e
- VERIFIED: npx tsc --noEmit reports 0 errors for all 9 new files
- VERIFIED: no exchangeCodeForSession in src/app/
- VERIFIED: one auth call per form, exactly matching plan spec
