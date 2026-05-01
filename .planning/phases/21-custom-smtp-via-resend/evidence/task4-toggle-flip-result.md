# Plan 21-02 Task 4 — Toggle flip + post-flip smoke test

Run date: 2026-04-30
Operator: Tyler Waneka

## Pre-flight (gates passed before flipping)

- Plan 21-01 Task 3 signup-form D-10 amend: merged to main as commit `fbf3b8f` (verified via `git log --oneline main -- src/app/signup/signup-form.tsx`).
- D-07 round-trip gate: PASS (per `evidence/d07-gate-result.md`).
- `data.session` branch + `signupSent` state + "Check your email" copy: present in deployed `src/app/signup/signup-form.tsx`.

## Toggle states (production project `wdntzsckjaoqodsyscns`)

Operator-attested. Per operator's no-screenshot preference, individual toggle screenshots
(`toggle-confirm-email-on.png`, `toggle-secure-email-change-on.png`,
`toggle-secure-password-change-on.png`) were NOT captured.

| Toggle | State | Set in | Notes |
|--------|-------|--------|-------|
| Confirm email | ON | Auth → Sign In/Providers → Email | New signups now require email confirmation in prod |
| Secure email change | ON | Auth → Sign In/Providers → Email | Email change requires confirmation from BOTH old and new addresses |
| Secure password change | ON | Auth → Sign In/Providers → Email | Password change requires re-authentication |

## Post-flip smoke test (D-10 prod verification)

Verifies the Plan 21-01 signup-form code change actually produces the success-state UI in production
under Confirm-email-ON, AND that the confirm-signup email round-trips end-to-end.

### Initial run (Confirm signup template using default `{{ .ConfirmationURL }}`)

| Step | Outcome |
|------|---------|
| Open horlo.app/signup in private window, sign up with fresh `+horlo-postflip1@gmail.com` alias | ✓ |
| Form rendered "Check your email to confirm your account." in-card success state | ✓ (D-10 prod verification — Plan 21-01 Task 3 code is live) |
| Confirmation email landed in Gmail Inbox (not Spam) | ✓ |
| Email From header `Horlo <noreply@mail.horlo.app>` | ✓ |
| Clicked link in email → routed to Supabase verify endpoint → redirected to `https://www.horlo.app/` | ✓ (link round-tripped) |
| User landed authed on `/` | ✗ FAIL — user was anonymous, proxy bounced to `/signup` |
| Workaround: signed in manually with the new credentials | ✓ (account was actually created/confirmed; just no session post-redirect) |

### Bug discovered: signup confirm email doesn't auto-authenticate the user

Default Supabase email template uses `{{ .ConfirmationURL }}` which routes through Supabase's
verify endpoint with PKCE code exchange. After verify, redirect target receives `?code=xxx` in URL
and is expected to call `exchangeCodeForSession`. horlo's homepage (`/`) does not initialize a
Supabase browser client and has no code-exchange logic, so the user lands on `/` with `?code=xxx`
unhandled, sees as anonymous to middleware, gets redirected to `/signup` (since `/` is non-public).

This is the same architectural mismatch as the password-reset bug (caught in Task 3) but more
exposed: password reset's destination `/reset-password` accidentally works because that page
initializes a browser client (`createSupabaseBrowserClient` in the form), which auto-detects
`?code=` and exchanges it. Homepage `/` doesn't.

### Fix shipped: update Supabase email templates to use `{{ .TokenHash }}` + `/auth/callback` pattern

Templates updated in Supabase Dashboard → Authentication → Email Templates:

**Confirm signup:**
```html
<h2>Confirm your signup</h2>
<p>Follow this link to confirm your user:</p>
<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup&next=/">Confirm your mail</a></p>
```

**Reset Password (also updated for consistency):**
```html
<h2>Reset Password</h2>
<p>Follow this link to reset the password for your user:</p>
<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">Reset Password</a></p>
```

**Change Email Address (also updated — Secure email change is now ON, so users WILL hit this template):**
```html
<h2>Confirm Change of Email</h2>
<p>Follow this link to confirm the update of your email from {{ .Email }} to {{ .NewEmail }}:</p>
<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email_change&next=/">Change Email</a></p>
```

This is the canonical Next.js + Supabase Auth PKCE+SSR pattern, and matches what `src/app/auth/callback/route.ts` was already designed to handle (calls `verifyOtp({ type, token_hash })` server-side, sets the session cookie via `@supabase/ssr`, then redirects to `next`). The previous default templates didn't compose with horlo's auth setup; this change aligns the email flow with the route handler.

Per CONTEXT.md "Use Supabase defaults — do not branding-customize templates in this phase":
this change is correctness, not branding (font, colors, copy unchanged). Necessary for the auth
flow to work end-to-end. SET-14 covers branding-customization in a future phase.

### Re-test after template fix (Confirm signup)

| Step | Outcome |
|------|---------|
| Triggered signup confirm with fresh alias | ✓ |
| Email landed in Inbox | ✓ |
| Clicked link `https://horlo.app/auth/callback?token_hash=pkce_xxx&type=signup&next=/` | ✓ |
| Routed through horlo `/auth/callback` route handler | ✓ |
| `verifyOtp({ type, token_hash })` succeeded → session cookie set | ✓ |
| Redirected to `/` | ✓ |
| User is **authed** on the homepage | ✓ (operator-attested) |

End-to-end signup confirm flow: PASS.

## Notes for follow-up

- `src/app/forgot-password/forgot-password-form.tsx` `redirectTo` parameter is now vestigial:
  the email template hardcodes the destination via `&next=/reset-password`, so the JS-side
  `redirectTo` is no longer load-bearing. Code is functional; the inline comment placed in
  commit `0c240e9` is now somewhat misleading (the architecture has shifted to /auth/callback).
  Cleanup is optional and outside Plan 21-02 scope.

- Apex/`www` canonicalization is still inconsistent (Site URL = apex, Vercel canonicalizes to
  www, allowlist now permits both). Cleanup is a future phase concern.

- Per operator's no-screenshot preference, post-flip smoke-test screenshots
  (`postflip-signup-card.png`, `postflip-confirm-inbox.png`, `postflip-logged-in.png`) were NOT
  captured. This document constitutes the operator-attested audit trail.

- Cleanup: post-flip test users (`+horlo-postflip1`, `+horlo-postflip2`) were created and removed
  from Supabase Authentication → Users (operator-attested).

## Disposition

Task 4 complete. All three Auth toggles ON in production. Confirm-signup email flow round-trips
end-to-end with user authed at homepage post-confirm. Plan 21-02 Task 5 (backout doc + decision
updates) may now proceed.
