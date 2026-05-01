---
phase: 21-custom-smtp-via-resend
reviewed: 2026-04-30T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - docs/deploy-db-setup.md
  - src/app/forgot-password/forgot-password-form.tsx
  - src/app/signup/signup-form.tsx
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Phase 21: Code Review Report

**Reviewed:** 2026-04-30
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Phase 21 (Custom SMTP via Resend) introduces a Confirm-email-ON posture across signup and password-reset flows, plus a Backout runbook section in `docs/deploy-db-setup.md`. All three files were reviewed at standard depth against Phase 21's stated mitigations: T-21-04 (no user enumeration on signup), T-21-05 (no Resend API key leakage in docs), and T-21-PREVIEWMAIL / T-21-WWWALLOWLIST (operator footguns).

Verified clean:
- **T-21-05 (Resend API key not leaked):** regex `re_[A-Za-z0-9]{20,}` returns zero hits across the new section. Only abstract references to "the Resend API key" appear (line 469).
- **Footgun convention match:** Both new footguns (`T-21-PREVIEWMAIL`, `T-21-WWWALLOWLIST`) use the existing `**Footgun T-XX-...:**` bold-prefix pattern established by lines 24, 48, 109, 122, 279.
- **Forgot-password no-enumeration success state (line 38):** copy "If an account exists for that email, a reset link has been sent." is preserved verbatim, and the `error` return from `resetPasswordForEmail` is intentionally discarded so success rendering is unconditional. Property holds.
- **Signup `data.session === null` branch (line 31):** uses ONLY `!data.session` as the predicate — does NOT introspect `data.user`, `data.user.identities`, `data.user.identities.length`, or any other field that would let the UI differentiate "new email" from "already-exists email". The displayed email (line 91) is the user-typed input, not a server-returned identifier, so no enumeration via echo.

One Warning and two Info findings below.

## Warnings

### WR-01: Signup error branch is a potential enumeration channel under non-modern Supabase configurations

**File:** `src/app/signup/signup-form.tsx:25-30`
**Issue:** The `data.session === null` branch correctly avoids enumeration via the success path (T-21-04 verified). However, the sibling `if (err)` branch at lines 25-30 sets `setError('Could not create account.')` and does NOT advance to the `signupSent` success card. Modern Supabase Auth with "Confirm email" ON returns `{ data: { user: <obfuscated>, session: null }, error: null }` for the duplicate-email case (no error) — and Phase 21's prod project is configured this way per the 21-02 SUMMARY round-trip evidence, so the current code is correct for the deployed configuration. But the property is *configuration-dependent*: if Supabase's behavior changes (e.g., dashboard toggle "Prevent duplicate signups" gets flipped, or a future SDK upgrade returns a 422 on duplicate), the duplicate-email user sees "Could not create account." while a fresh email sees "Check your email to confirm your account." That is a user-enumeration oracle.

This is a Warning rather than a Critical because (a) the current Supabase posture does not exhibit this behavior (verified by 21-02 round-trip evidence) and (b) the distinct copy on `err` is defensible for genuine errors (network failure, rate-limit, invalid-email-syntax). But the code does not assert or comment on the assumption that `err` cannot fire for the duplicate-email case under the current Supabase configuration.

**Fix:** Add an inline comment documenting the assumption, OR collapse the duplicate-email-as-error fallback into the `signupSent` path defensively. Minimal fix — comment-only:
```ts
if (err) {
  // Neutral copy — no user enumeration. NOTE: relies on Supabase Auth ("Confirm email" ON)
  // returning error=null + session=null for duplicate emails. If Supabase ever returns an
  // error for duplicates, this branch becomes an enumeration oracle vs. the success state.
  // Verified behavior on prod project wdntzsckjaoqodsyscns 2026-04-30 (see 21-02-SUMMARY).
  setError('Could not create account.')
  setLoading(false)
  return
}
```

Defensive fix — route to success state on a recognized "already registered" error code so behavior is invariant under Supabase config changes:
```ts
if (err) {
  // Defensive: if Supabase ever surfaces duplicate-email as an error, fold into success
  // state to preserve T-21-04 invariant.
  const isDuplicate = /already.*registered|user.*exists/i.test(err.message)
  if (isDuplicate) {
    setSignupSent(true)
    setLoading(false)
    return
  }
  setError('Could not create account.')
  setLoading(false)
  return
}
```

## Info

### IN-01: Inline comment on `redirectTo` describes a superseded intermediate state

**File:** `src/app/forgot-password/forgot-password-form.tsx:20-22`
**Issue:** The comment on lines 20-22 reads:
> Land directly on /reset-password after Supabase's verify endpoint sets the recovery session. Path-only URL (no query string) sidesteps allowlist matching nuances; /auth/callback expects token_hash which Supabase's verify flow does not pass through to the redirect target.

After Phase 21-02 realigned all five Supabase auth email templates to use the `{{ .TokenHash }}` + `/auth/callback?token_hash=...&next=/reset-password` pattern (per 21-02-SUMMARY), the destination is now hardcoded in the email template, not derived from the JS-side `redirectTo` parameter. The `redirectTo` arg passed to `resetPasswordForEmail` is functionally vestigial — Supabase ignores it for templated recovery emails since the template's `{{ .ConfirmationURL }}` builder uses `redirectTo` as the `next=` target only when the template doesn't override it. The comment describes the OLD state where the redirect URL flowed end-to-end; under the current template configuration, the path-only choice still happens to be correct (as the `next=` value), but the rationale ("`/auth/callback` expects token_hash which Supabase's verify flow does not pass through") is now inverted: `/auth/callback` IS the destination, and it DOES receive `token_hash` via the template's hardcoded URL.

**Fix:** Update the comment to reflect the current architecture:
```ts
await supabase.auth.resetPasswordForEmail(email, {
  // Phase 21-02: Supabase email templates now hardcode /auth/callback?token_hash=...&next=...,
  // so this redirectTo is functionally the `next=` target after server-side verifyOtp completes.
  // Path-only (no query) keeps allowlist matching simple; both apex and www variants must be
  // allowlisted in Supabase URL Configuration (see Footgun T-21-WWWALLOWLIST in deploy-db-setup.md).
  redirectTo: `${window.location.origin}/reset-password`,
})
```

### IN-02: Phase 21 backout section is otherwise consistent — minor nit on heading hierarchy

**File:** `docs/deploy-db-setup.md:445`
**Issue:** The new section uses `## Phase 21 — Custom SMTP via Resend Backout` (H2) which matches the file's existing top-level phase section pattern (`## Phase 17 — Catalog Foundation Deploy Steps` at line 234, `## Phase 19.1: Catalog Taste Enrichment` at line 324). The two earlier phase sections are framed as "Deploy Steps" / "Catalog Taste Enrichment" while Phase 21's heading is "Backout" — a backout-only section, no deploy steps. This is appropriate given Phase 21 was deployed via dashboard toggles (not migrations) so there are no operator-runnable deploy steps to document, only the post-deploy backout procedure.

The asymmetry is fine but worth noting for future scanning: an operator looking for "how do I deploy Phase 21?" will not find a deploy section here. The 21-02-SUMMARY captures the dashboard toggle sequence; consider a one-line back-pointer at the top of the Phase 21 section so future operators can find the deploy provenance:

**Fix (optional):** Add a single line under the section header:
```markdown
## Phase 21 — Custom SMTP via Resend Backout

(Deploy steps for Phase 21 are dashboard-only — Resend SMTP wiring + Auth toggles. See `.planning/phases/21-custom-smtp-via-resend/21-02-SUMMARY.md` for the as-deployed sequence. This section covers backout only.)

Phase 21 wired Supabase Auth to Resend SMTP for `mail.horlo.app`...
```

This is a minor convenience for future operators; the current section is functional without it.

---

_Reviewed: 2026-04-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
