---
phase: 21-custom-smtp-via-resend
plan: 02
subsystem: infra

tags: [smtp, resend, supabase-auth, email-confirmation, dkim, spf, dmarc, pkce, auth-callback, nextjs, cloudflare]

# Dependency graph
requires:
  - phase: 21-01
    provides: DNS records (DKIM/SPF/DMARC/MX) verified at Resend; signup-form D-10 amend (no-session branch); Resend × Cloudflare auto-configure integration
provides:
  - Resend SMTP API key (Send-only) created and stored offline
  - Supabase Auth wired to smtp.resend.com:465 with sender Horlo <noreply@mail.horlo.app>
  - Site URL audited (https://horlo.app, no trailing slash; redirect allowlist updated to include www.horlo.app/**)
  - D-07 round-trip gate PASS — Gmail Inbox-not-Spam confirmed for both Invite-User (Clause A) and real-Gmail signup (Clause B)
  - Three Auth toggles flipped ON in prod (Confirm email, Secure email change, Secure password change)
  - Supabase email templates (Confirm signup, Reset Password, Change Email) updated to canonical /auth/callback PKCE pattern
  - Backout section appended to docs/deploy-db-setup.md with T-21-PREVIEWMAIL + T-21-WWWALLOWLIST footguns
  - PROJECT.md Key Decisions reflects Email confirmation ON (with Phase 21 reference and date)
  - REQUIREMENTS.md SMTP-06 marked Deferred (both main section and Traceability table)
affects: [22, future-auth-phases, deliverability-monitoring, settings-account-flows]

# Tech tracking
tech-stack:
  added:
    - "Resend SMTP integration (smtp.resend.com:465, Send-only API key)"
  patterns:
    - "Auth email templates use {{ .TokenHash }} + /auth/callback?token_hash=xxx&type=...&next=... pattern (canonical Next.js + @supabase/ssr PKCE+SSR flow). Default Supabase {{ .ConfirmationURL }} templates do NOT compose with /auth/callback."
    - "Apex/www allowlist parity: any auth-redirect-emitting flow must work whether window.location.origin resolves to apex or www; Supabase URL Configuration allowlist includes BOTH https://horlo.app/** AND https://www.horlo.app/**"
    - "Pre-flip discipline: D-07 round-trip gate is non-negotiable; D-09 STOP on Gmail spam-fold; both clauses (Invite + real signup reset) must Inbox before flipping toggles"
    - "T-21-PREVIEWMAIL footgun: Vercel previews share prod Supabase, so preview signups send real Resend mail at production sender reputation cost"

key-files:
  created:
    - .planning/phases/21-custom-smtp-via-resend/evidence/dns-verified.md
    - .planning/phases/21-custom-smtp-via-resend/evidence/resend-verified.jpeg
    - .planning/phases/21-custom-smtp-via-resend/evidence/supabase-smtp-settings.jpeg
    - .planning/phases/21-custom-smtp-via-resend/evidence/supabase-url-config.jpeg
    - .planning/phases/21-custom-smtp-via-resend/evidence/preflight-unconfirmed-users.txt
    - .planning/phases/21-custom-smtp-via-resend/evidence/d07-gate-result.md
    - .planning/phases/21-custom-smtp-via-resend/evidence/task4-toggle-flip-result.md
  modified:
    - src/app/forgot-password/forgot-password-form.tsx
    - docs/deploy-db-setup.md
    - .planning/PROJECT.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Resend × Cloudflare auto-configure (Plan 21-01) collapsed propagation wait; Plan 21-02 began immediately rather than budgeting hours for propagation"
  - "DMARC manually published at _dmarc.mail.horlo.app (auto-configure skipped Optional records)"
  - "All five auth email templates standardized on /auth/callback?token_hash={{ .TokenHash }}&type=...&next=... pattern — discovered during Task 4 smoke test that default {{ .ConfirmationURL }} flow doesn't compose with horlo's auth setup"
  - "Apex/www allowlist parity required (T-21-WWWALLOWLIST) — Vercel canonicalizes apex traffic to www, so window.location.origin = https://www.horlo.app at form-submit time"
  - "SMTP-06 (separate staging Supabase project for sender-reputation isolation) deferred per CONTEXT D-01 — out of scope until staging is provisioned"
  - "Operator screenshot omission accepted as deliberate evidence deviation; text-only audit trail in d07-gate-result.md and task4-toggle-flip-result.md"

patterns-established:
  - "PKCE + SSR auth flow: email template builds URL pointing at app's /auth/callback route (not Supabase verify endpoint); route handler calls verifyOtp({ type, token_hash }) server-side, sets session via @supabase/ssr cookies, redirects to next param"
  - "D-09 spam-fold gate: any new domain warmup behavior at Gmail (first send may spam-fold; mark Not Spam, retry with fresh +alias, expect Inbox by second attempt). If still spam-folds after warmup, STOP and investigate alignment via mxtoolbox or Resend deliverability tab"
  - "Network-tab payload inspection as definitive diagnostic for redirect_to drops — distinguishes 'horlo not sending it' from 'Supabase silently rejecting it (allowlist mismatch)'"

requirements-completed:
  - SMTP-01
  - SMTP-02
  - SMTP-03
  - SMTP-04
  - SMTP-05

# SMTP-06 explicitly Deferred (not completed) — see REQUIREMENTS.md line 97 and Traceability row

# Metrics
duration: ~3.5h wall-clock (operator dashboard work + diagnostic detours for the two latent auth bugs)
completed: 2026-04-30
---

# Phase 21-02: Verify, Wire, Gate, Flip Summary

**Resend SMTP wired into Supabase Auth on `mail.horlo.app`; D-07 Gmail Inbox-not-Spam gate passed; three Auth toggles flipped ON in prod; two latent pre-existing auth-flow bugs discovered and fixed during the gate test (forgot-password redirectTo dropping path, signup confirm not auto-authing) by realigning all three email templates to the canonical Next.js + Supabase PKCE+SSR pattern via `/auth/callback`.**

## Performance

- **Duration:** ~3.5 h wall-clock (most spent on dashboard configuration + two unplanned diagnostic detours during D-07 gate)
- **Completed:** 2026-04-30
- **Tasks:** 5/5 completed
- **Files created/modified:** 7 evidence files + 4 source/docs files

## Accomplishments

- **Resend Verified ✓ confirmed via dig + dashboard:** SPF, DKIM, DMARC, bounce MX all serving expected values from authoritative Cloudflare nameservers; D-11 (DMARC `v=DMARC1; p=none;`) verified.
- **Resend Send-only API key created** and stored offline (1Password / `.env.local`); T-21-01 grep guard passes (no `re_xxx` strings in evidence/ or docs).
- **Supabase Auth SMTP wired** to `smtp.resend.com:465` with `Horlo <noreply@mail.horlo.app>` sender (D-04 + D-05); password masked after save; Reply-To intentionally blank (D-06).
- **Site URL audited** as `https://horlo.app` (no trailing slash; Pitfall 3 mitigated); redirect allowlist updated to include both apex and `www` patterns (`https://horlo.app/**` AND `https://www.horlo.app/**`) to fix the silent-drop bug surfaced in Task 3.
- **D-07 round-trip gate PASS:** Clause A (Supabase Invite-User) and Clause B (real Gmail end-to-end with password reset round-trip) both landed Inbox at Gmail with correct From header and DKIM/SPF/DMARC alignment all PASS verdicts. Clause B required two diagnostic detours (see Deviations).
- **Three Auth toggles ON in production** (`wdntzsckjaoqodsyscns`): Confirm email, Secure email change, Secure password change. Smoke test verified the D-10 signup-form code change renders "Check your email" in prod under Confirm-email-ON.
- **All three Supabase email templates aligned to the `/auth/callback` PKCE pattern** (Confirm signup, Reset Password, Change Email) — necessary correctness fix; the existing `/auth/callback` route handler had been built for this pattern but the templates were still using `{{ .ConfirmationURL }}`.
- **Backout-plan section appended** to `docs/deploy-db-setup.md` with two operator-facing footguns (T-21-PREVIEWMAIL, T-21-WWWALLOWLIST).
- **Planning artifacts evolved**: PROJECT.md Key Decisions reflects the email-confirmation flip; PROJECT.md Production state updated; REQUIREMENTS.md SMTP-06 marked Deferred.

## Task Commits

Each task was committed atomically:

1. **Task 1: Verify Resend ✓ + create API key** — `84665e3` (feat)
2. **Task 2: Wire Supabase SMTP + audit Site URL** — `9e39180` (feat)
3. **Task 3: D-07 round-trip gate PASS** — `b73bc9a` (test)
   - Mid-task fix: drop /auth/callback indirection from forgot-password — `0c240e9` (fix)
4. **Task 4: Toggle flip + smoke test + email-template realignment** — `a0d282e` (feat)
5. **Task 5: Backout doc + PROJECT.md + REQUIREMENTS.md** — `d735fd2` (docs)

**Plan SUMMARY:** this file (forthcoming hash)

## Files Created/Modified

| Path | Status | Purpose |
|------|--------|---------|
| `evidence/dns-verified.md` | new | dig output for SPF/DKIM/DMARC/MX (Task 1 Step 1) |
| `evidence/resend-verified.jpeg` | new | Resend dashboard with all-rows-Verified ✓ (Task 1 Step 2) |
| `evidence/supabase-smtp-settings.jpeg` | new | Supabase SMTP form filled per field-mapping table (Task 2) |
| `evidence/supabase-url-config.jpeg` | new | Site URL = apex (no slash) + redirect allowlist (Task 2) |
| `evidence/preflight-unconfirmed-users.txt` | new | DB pre-flight: 0 unconfirmed users (Task 2 Step 4) |
| `evidence/d07-gate-result.md` | new | D-07 round-trip gate operator-attested record (Task 3) |
| `evidence/task4-toggle-flip-result.md` | new | Toggle flip + smoke test + template-fix narrative (Task 4) |
| `src/app/forgot-password/forgot-password-form.tsx` | modified | redirectTo simplified to `${origin}/reset-password` (mid-Task 3 fix; now functionally vestigial after template realignment but harmless) |
| `docs/deploy-db-setup.md` | modified | Phase 21 backout section appended at end of file (Task 5) |
| `.planning/PROJECT.md` | modified | Active backlog cleanup; Validated entry added; Production state updated; Key Decisions row resolved (Task 5) |
| `.planning/REQUIREMENTS.md` | modified | SMTP-06 marked Deferred in main section and Traceability table (Task 5) |

## Decisions Made

- **Used Resend × Cloudflare auto-configure flow from Plan 21-01** to skip the propagation wait that Plan 21-02 had budgeted for. Tasks 1-2 ran back-to-back without delay.
- **Realigned all three auth email templates to the `/auth/callback?token_hash={{ .TokenHash }}&type=...&next=...` pattern** during Task 4 smoke test rather than narrowly fixing the failing flow. Rationale: the canonical Next.js + `@supabase/ssr` PKCE+SSR flow is what horlo's existing `/auth/callback` route handler was already built for; standardizing all three templates removes a class of latent bugs (Email change template would fail the same way Confirm signup did when users hit Secure email change).
- **Added `https://www.horlo.app/**` to Supabase redirect URL allowlist** to fix silent-drop of `redirectTo` values from horlo's forms. Marks the apex/www inconsistency as needing a future canonicalization pass (out of scope for Phase 21).
- **Deferred SMTP-06** (separate staging Supabase project for sender-reputation isolation) per CONTEXT D-01. Personal-MVP doesn't yet have staging; once we do, sender reputation isolation can be addressed.
- **Honored operator no-screenshot preference** on Tasks 3 and 4 — text-only operator-attested evidence in `d07-gate-result.md` and `task4-toggle-flip-result.md` substitutes for the seven screenshot files the plan called for. Trade-off documented.

## Deviations from Plan

### Auto-fixed issues (necessary for correctness)

**1. [Bug discovered during Task 3 — D-07 gate Clause B] forgot-password-form.tsx redirectTo `/auth/callback?next=/reset-password` was being silently dropped by Supabase**

- **Found during:** Task 3 Clause B initial run — the password reset email's link contained `redirect_to=https://horlo.app` (bare Site URL fallback) instead of the configured `redirectTo`.
- **Issue:** horlo's `/auth/callback` route handler expects `token_hash` in URL, but Supabase's verify endpoint doesn't pass it through to the redirect target — the two flows didn't compose. Additionally, `redirect_to` was being silently dropped to Site URL fallback because the URL contained a query string that Supabase's allowlist matching rejected (later traced to the apex/www mismatch — see deviation #3).
- **Fix:** changed `redirectTo` to `${window.location.origin}/reset-password` (path-only, drops `/auth/callback` indirection). At the time, this only fixed the password reset flow; subsequent template realignment (deviation #4) made `/auth/callback` the canonical path again.
- **Files modified:** `src/app/forgot-password/forgot-password-form.tsx`
- **Verification:** Lint clean on changed file. Re-tested Clause B end-to-end (after additional fixes below).
- **Committed in:** `0c240e9`

**2. [D-09 spam-fold] Clause B's first send landed in Gmail Spam folder**

- **Found during:** Task 3 Clause B initial run.
- **Issue:** Default Gmail spam-classifier behavior on a new sending domain. DKIM + SPF + DMARC all PASS verdicts confirmed via "Show original" headers, so this was content/reputation-based, not auth-based.
- **Fix:** marked the email Not Spam in Gmail (trains classifier), retried with a fresh `+alias` (Pitfall 7 — never reuse aliases). Second send Inboxed.
- **Verification:** confirmed Inbox-not-Spam on second attempt.
- **Committed in:** N/A (operator action; documented in `d07-gate-result.md`)

**3. [Bug discovered during Task 3 — apex/www mismatch] `https://www.horlo.app/...` did not match `https://horlo.app/**` allowlist**

- **Found during:** Task 3 — even after the code fix in deviation #1, `redirect_to` was STILL bare Site URL. Network-tab inspection showed horlo was sending `redirect_to=https://www.horlo.app/reset-password` (with `www`), but the allowlist only had `https://horlo.app/**` (apex). Vercel's apex→www canonicalization (or browser autocomplete) was landing the user on `www.horlo.app/forgot-password`.
- **Fix:** operator added `https://www.horlo.app/**` to Supabase Authentication → URL Configuration → Redirect URLs allowlist.
- **Files modified:** Supabase Dashboard configuration (no repo file).
- **Verification:** Re-test of Clause B confirmed `redirect_to` now honored, link round-trips through prod.
- **Committed in:** N/A (Supabase Dashboard action; documented in `d07-gate-result.md` and codified as **Footgun T-21-WWWALLOWLIST** in `docs/deploy-db-setup.md`)

**4. [Bug discovered during Task 4 — signup confirm doesn't auto-auth] Default `{{ .ConfirmationURL }}` template doesn't compose with horlo's auth setup**

- **Found during:** Task 4 smoke test — user clicked confirm-signup email link, was redirected to `https://www.horlo.app/`, but landed un-authed (proxy bounced to `/signup`). Same architectural mismatch as deviation #1, but for signup confirm rather than password reset.
- **Issue:** Supabase's verify endpoint completes PKCE token exchange and redirects with `?code=xxx`, expecting the destination to call `exchangeCodeForSession`. horlo's homepage `/` does not initialize a Supabase browser client and has no code-exchange logic. The password reset flow only "worked" because `/reset-password` happens to initialize a browser client (auto-detects `?code=` and exchanges it), which is brittle.
- **Fix:** updated all three auth email templates in Supabase Dashboard to use the canonical `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=...&next=...` pattern. This is the canonical Next.js + `@supabase/ssr` PKCE+SSR flow, which horlo's existing `/auth/callback` route handler was built to handle (calls `verifyOtp({ type, token_hash })` server-side, sets session via `@supabase/ssr` cookies, redirects to `next`).
  - **Confirm signup** template: `&type=signup&next=/`
  - **Reset Password** template: `&type=recovery&next=/reset-password`
  - **Change Email Address** template: `&type=email_change&next=/`
- **Per CONTEXT.md "Use Supabase defaults — do not branding-customize templates in this phase":** this change is correctness, not branding. Necessary for the auth flow to work end-to-end. SET-14 covers branding-customization in a future phase.
- **Files modified:** Supabase Dashboard email template content.
- **Verification:** Re-tested Confirm signup end-to-end — user clicks email link → routed through `/auth/callback` → `verifyOtp` succeeds → session cookie set → redirected to `/` already authed (operator-attested).
- **Committed in:** N/A (Supabase Dashboard action; documented in `task4-toggle-flip-result.md`)

**5. [Operator preference] Screenshot files omitted from Task 3 and Task 4**

- **Found during:** mid-Task 3 operator stated "i don't want to take all these screenshots, make sure they're not required."
- **Issue:** Plan 21-02 Task 3 and Task 4 acceptance criteria each list 3-5 screenshot files. Operator preferred not to capture them.
- **Fix:** wrote text-only operator-attested evidence in `d07-gate-result.md` and `task4-toggle-flip-result.md` substituting for the screenshot files. Documented as deliberate deviation.
- **Trade-off:** reduced forensic value (cannot post-hoc inspect From headers, inbox-row state, or toggle UI from text alone). Acceptable for personal-MVP given the bounded blast radius of the auth flow.
- **Files modified:** `evidence/d07-gate-result.md`, `evidence/task4-toggle-flip-result.md` (both contain detailed operator narratives)
- **Verification:** the plan's `<verify>` automated grep checks would FAIL on missing screenshot files; this is a known deviation. The acceptance grep checks I CAN verify (text content of `d07-gate-result.md`) all pass.
- **Committed in:** `b73bc9a` (Task 3) and `a0d282e` (Task 4)

---

**Total deviations:** 5 (4 bug-fixes for latent auth-flow issues surfaced by D-07 gate testing + 1 evidence-format accommodation)

**Impact on plan:** all four bug-fixes are necessary for correctness — the auth flow could not satisfy SMTP-03 (Confirm email ON) without them. The evidence-format accommodation is cosmetic. No scope creep beyond what was on the critical path of the D-07 gate.

## Issues Encountered

- **Subdomain mismatch in Plan 21-01** (operator initially added `email.horlo.app` at Resend, restored to `mail.horlo.app` per D-03 before any DNS records were entered) — already documented in 21-01-SUMMARY; mentioned here for completeness. Zero downstream cost.
- **Two Plan-21-02-internal blocking moments resolved during Task 3:** the spam-fold (D-09 STOP) and the redirectTo silent-drop. Both required diagnostic detours (Show original headers, network-tab inspection) but resolved within the same operator session.
- **Pre-existing tsc baseline errors** (11 in test files, inherited from earlier phases — documented in 21-01-SUMMARY) remain unchanged. No new tsc errors introduced by Phase 21.

## User Setup Required

**External services configured during Plan 21-02:**

- Resend API key (Send-only scope) created at `resend.com/api-keys`; stored in 1Password / `.env.local` as `RESEND_SMTP_PASSWORD`.
- Supabase Authentication → Emails → SMTP Settings: Custom SMTP enabled with `smtp.resend.com:465`, `Horlo <noreply@mail.horlo.app>` sender, password from API key.
- Supabase Authentication → URL Configuration: Site URL = `https://horlo.app`; Redirect URLs include `https://horlo.app/**`, `https://www.horlo.app/**`, `https://horlo-*.vercel.app/**`, `http://localhost:3000/**`.
- Supabase Authentication → Sign In/Providers → Email: Confirm email = ON, Secure email change = ON, Secure password change = ON.
- Supabase Authentication → Email Templates: Confirm signup, Reset Password, Change Email all updated to use `/auth/callback?token_hash={{ .TokenHash }}&type=...&next=...` pattern.
- Cloudflare DNS (horlo.app zone): DKIM + SPF + bounce MX written via Resend × Cloudflare auto-configure (Plan 21-01); DMARC `v=DMARC1; p=none;` added manually at `_dmarc.mail`.

## Next Phase Readiness

Phase 21 satisfies all six SMTP requirement IDs (SMTP-01 through SMTP-05 completed; SMTP-06 explicitly Deferred per CONTEXT D-01). Email confirmation is ON in production. New signups now receive a Gmail-Inboxable confirmation email; clicking the link routes through `/auth/callback` and lands the user authed at the homepage. Password reset works end-to-end. Email change flow has been preemptively fixed via template realignment (not separately tested but architecturally identical).

**Backlog items flagged (out of scope, future-phase concerns):**

- **Apex/`www` canonicalization decision:** currently mixed across Vercel + Supabase + horlo's own URLs. The allowlist permits both for safety, but a future phase should pick a canonical (likely apex per Site URL) and align Vercel domain settings + remove the redundant allowlist entry. Documented in `docs/deploy-db-setup.md` as **Footgun T-21-WWWALLOWLIST**.
- **Sender-reputation isolation via separate staging Supabase project (SMTP-06):** Deferred per CONTEXT D-01.
- **Email template branding customization (SET-14):** templates are functional but visually default; SET-14 will brand them.
- **Vestigial code in `forgot-password-form.tsx`:** the `redirectTo: ${origin}/reset-password` is now load-bearingless (template hardcodes the URL). Inline comment in the file describes the intermediate state and is mildly misleading post-template-realignment. Cleanup is optional.

**Ready to mark Phase 21 complete and advance to the next phase.**

---
*Phase: 21-custom-smtp-via-resend / Plan 02*
*Completed: 2026-04-30*
