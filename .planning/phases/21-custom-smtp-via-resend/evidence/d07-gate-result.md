# D-07 Round-Trip Gate Result — Plan 21-02 Task 3

Run date: 2026-04-30
Operator: Tyler Waneka
Recipient: Gmail aliases under twwaneka@gmail.com (using `+suffix` aliases per Pitfall 7)

## Clause A: Supabase Invite-User send

**Disposition: Clause A: PASS**

- Sent via: Supabase Dashboard → Authentication → Users → Invite User
- Recipient alias: `twwaneka+horlo-smtp-test1@gmail.com`
- Outcome: landed in **Inbox** (not Spam) on first send — no Gmail classifier intervention needed
- From header: `Horlo <noreply@mail.horlo.app>` (D-04 + D-05 honored)
- Authentication-Results: DKIM=pass (mail.horlo.app + amazonses.com), SPF=pass, DMARC=pass (p=NONE) — verified via "Show original" headers on Clause B's email; same DKIM signing path
- Cleanup: invited user removed from Authentication → Users (operator-attested)

## Clause B: Real-Gmail end-to-end password reset (D-07 step 2)

**Disposition: Clause B: PASS** — but only after two bugs were discovered and fixed during this gate test.

### First attempt (Clause B initial)
- Triggered via: horlo.app/forgot-password (NOT dashboard)
- Recipient alias: `twwaneka+horlo-smtp-e2e1@gmail.com`
- Outcome: **landed in Spam folder** → STOPPED per D-09
- Diagnostic: opened the spam'd email, viewed "Show original" headers
  - DKIM=pass (mail.horlo.app), DKIM=pass (amazonses.com), SPF=pass, DMARC=pass (p=NONE) — alignment is fine
  - Email body contained the reset link in both text/plain and text/html parts
  - Gmail's spam-folder defensive rendering was visually disabling the clickable link (standard Gmail behavior for spam'd messages)
- Concluded: spam-fold was content/reputation-based, not auth-based. Marked the email "Not spam" in Gmail to train the classifier.

### Second attempt (after Gmail "Not spam" training)
- Recipient alias: `twwaneka+horlo-smtp-e2e3@gmail.com` (fresh per Pitfall 7)
- Outcome: **landed in Inbox** ✓ — Gmail classifier accepted the second send after the "Not spam" feedback
- Spam-fold issue: RESOLVED via standard Gmail new-domain warmup (one "Not spam" report + a successful retry)
- BUT: the link's `redirect_to` parameter was bare `https://horlo.app` (Site URL fallback) instead of the configured `redirectTo`. Clicking the link landed the user on horlo.app/ homepage, NOT on a password reset surface.
- This was a separate, latent pre-existing bug discovered during this gate test (not introduced by Phase 21).

### Bug discovered: `/auth/callback` indirection mismatched the Supabase verify-endpoint flow

`src/app/forgot-password/forgot-password-form.tsx` was passing `redirectTo: ${origin}/auth/callback?next=/reset-password`, but:
- Supabase's default email template routes through `<project>.supabase.co/auth/v1/verify` (handles the OTP server-side, sets the recovery session cookie), then redirects to `redirect_to`.
- horlo's `/auth/callback` route handler expects to receive a `token_hash` query param and verify the OTP itself — but Supabase's verify endpoint doesn't pass `token_hash` through to the redirect target. The two flows don't compose.

**Fix shipped:** commit `0c240e9` — replaced `redirectTo` with the path-only `${origin}/reset-password`, dropping the `/auth/callback` indirection. After Supabase's verify endpoint sets the recovery session, the user lands directly on `/reset-password` with the session active, and `supabase.auth.updateUser({ password })` works against that session.

### Bug discovered: `www` not in Supabase redirect URL allowlist

After the code fix, the redirect_to was STILL falling back to bare Site URL. Network-tab inspection showed horlo was sending `redirect_to=https://www.horlo.app/reset-password` (with `www`), but the Supabase allowlist contained only `https://horlo.app/**` (apex). Supabase silently rejected the `www` URL and fell back to Site URL.

**Root cause:** Vercel's apex→www canonicalization (or browser auto-complete) was landing the user on `www.horlo.app/forgot-password` even when typing `horlo.app/forgot-password`, so `window.location.origin` evaluated to `https://www.horlo.app`. The allowlist mismatch silently dropped the requested redirect.

**Fix shipped:** operator added `https://www.horlo.app/**` to Supabase Authentication → URL Configuration → Redirect URLs allowlist. After the addition, `redirect_to` was honored.

**Long-term debt flagged (NOT in this plan's scope):** the apex/www canonicalization story is mixed (Site URL = apex, Vercel canonicalizes to www, allowlist now permits both). A future phase should pick one canonical and align Vercel + Supabase + horlo's links to it.

### Final Clause B re-test (after both fixes deployed and allowlist updated)

- Recipient alias: `twwaneka+email-test-5@gmail.com` (fresh)
- Outcome: landed in **Inbox** ✓
- Link clicked → Supabase verify endpoint validated the PKCE token → redirected to `https://www.horlo.app/reset-password` → reset form rendered with active recovery session → operator set new password → login succeeded
- Round-trip end-to-end: PASS

## Overall gate disposition: PASS

Both clauses passed Inbox-not-Spam (Clause B required two attempts due to Gmail new-domain warmup, then required two code/config fixes for the link round-trip). DKIM/SPF/DMARC alignment is solid (all four PASS verdicts confirmed via Gmail's Authentication-Results header). Email round-trip works end-to-end on prod from `https://www.horlo.app/forgot-password` → reset-password update.

Plan 21-02 Task 4 (toggle flip) may now proceed.

## Evidence deviation: screenshots omitted by operator request

Per operator preference (mid-task statement: "i don't want to take all these screenshots, make sure they're not required"), the five planned screenshot files (`d07-clause-a-invite-inbox.png`, `d07-clause-a-invite-headers.png`, `d07-clause-b-reset-inbox.png`, `d07-clause-b-reset-headers.png`, `d07-clause-b-reset-success.png`) were NOT captured. This document constitutes the operator-attested audit trail in their place.

Audit trade-off: pixel evidence of Inbox-not-Spam state and From header is not preserved; cannot be re-inspected post-hoc. Operator attestation + the diagnostic detail captured in this file (Authentication-Results verdicts, decoded URL values, network-tab payload, fix commit hashes) provide a textual record of the gate run. Acceptable for personal-MVP per the bounded blast radius of the auth flow.

The plan's `<verify>` automated grep block will fail on the missing screenshot file checks. This is a known deviation, documented here and to be reflected in 21-02-SUMMARY.md.

## Cleanup

- Test users (`+horlo-smtp-test1`, `+horlo-smtp-e2e1`, `+horlo-smtp-e2e3`, `+email-test-5`) were created and removed from Supabase Authentication → Users (operator-attested).
