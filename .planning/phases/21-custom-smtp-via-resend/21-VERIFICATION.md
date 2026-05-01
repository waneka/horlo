---
phase: 21-custom-smtp-via-resend
verified: 2026-04-30T18:00:00Z
status: passed
score: 5/5 must-haves verified (SMTP-06 explicitly Deferred per CONTEXT D-01, not counted as gap)
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
  gaps_closed: []
  gaps_remaining: []
  regressions: []
requirements_coverage:
  SMTP-01: satisfied
  SMTP-02: satisfied
  SMTP-03: satisfied
  SMTP-04: satisfied
  SMTP-05: satisfied
  SMTP-06: deferred
---

# Phase 21: Custom SMTP via Resend — Verification Report

**Phase Goal:** Auth confirmation emails leave Supabase's hosted SMTP (2/h free-tier limit) and route through Resend with verified DKIM — and Confirm-email is flipped ON only after successful round-trip — so new signups receive their confirmation links in inbox not spam.

**Verified:** 2026-04-30
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| #   | Truth (from ROADMAP success_criteria) | Status     | Evidence       |
| --- | ------------------------------------- | ---------- | -------------- |
| 1   | `mail.horlo.app` subdomain shows "Verified ✓" in Resend (SPF + DKIM + DMARC `p=none` + bounce MX propagated and confirmed BEFORE any downstream code/config change) | ✓ VERIFIED | `evidence/dns-verified.md` shows authoritative `dig` returns for SPF (`v=spf1 include:amazonses.com ~all`), DKIM (long base64 `p=` value), DMARC (`v=DMARC1; p=none;` from both `thaddeus.ns.cloudflare.com` and `mia.ns.cloudflare.com`), and MX (`10 feedback-smtp.us-east-1.amazonses.com.`); operator screenshot `evidence/resend-records-verified.jpeg` + `evidence/resend-verified.jpeg` attest to dashboard Verified ✓ on every row |
| 2   | Supabase Auth → SMTP wired to `smtp.resend.com:465` with Resend-issued password; D-07 round-trip gate (Invite + real-Gmail signup) passes Inbox-not-Spam; signup-form D-10 code change merged BEFORE toggle flip | ✓ VERIFIED | `evidence/supabase-smtp-settings.jpeg` (operator-attested SMTP form values per field-mapping table); `evidence/d07-gate-result.md` reports `Clause A: PASS`, `Clause B: PASS`, `Overall gate disposition: PASS`; commit `fbf3b8f` (signup-form D-10 amend) precedes commit `a0d282e` (toggle flip), confirmed in git log; pre-flight in `task4-toggle-flip-result.md` documents the merge order |
| 3   | Three Auth toggles ON in production (Confirm email, Secure email change, Secure password change) — only after step 2 passes | ✓ VERIFIED | `evidence/task4-toggle-flip-result.md` operator-attested table records all three toggles ON in project `wdntzsckjaoqodsyscns`; post-flip smoke test confirms (a) signup-form renders "Check your email to confirm your account" message in prod under Confirm-email-ON, and (b) confirmation email round-trips to Inbox + clicking link routes through `/auth/callback` + user lands authed at `/` |
| 4   | SMTP-06 (`mail.staging.horlo.app` separation) marked Deferred — pending staging Supabase project (D-01); Phase 21 wires prod-only | ✓ VERIFIED | REQUIREMENTS.md line 97 main section: `**Deferred — pending staging Supabase project (see Phase 21 21-CONTEXT.md D-01)**`; Traceability table line 250: `Deferred — pending staging Supabase project (see Phase 21 21-CONTEXT.md D-01)`; both grep checks pass |
| 5   | `docs/deploy-db-setup.md` has a backout-plan section using existing **Footgun T-XX-...:** pattern (T-21-PREVIEWMAIL) documenting how to revert to Supabase hosted SMTP if DKIM fails post-flip | ✓ VERIFIED | `docs/deploy-db-setup.md` line 445: `## Phase 21 — Custom SMTP via Resend Backout`; line 451: `**Footgun T-21-PREVIEWMAIL:**` (D-02 preview-deploys context); line 453 also adds `**Footgun T-21-WWWALLOWLIST:**` (apex/www allowlist parity discovered during D-07 gate); section contains Backout triggers, Backout procedure (5 numbered steps), Backout footgun, Recovery sub-sections; no API key leak (`grep -E "re_[A-Za-z0-9]{20,}" docs/deploy-db-setup.md` exits 1 = no match) |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/app/signup/signup-form.tsx` | D-10 no-session branch + signupSent state + "Check your email" copy + preserves immediate-session redirect; T-21-04 user-enumeration-safe error copy | ✓ VERIFIED | Line 24: `const { data, error: err } = await supabase.auth.signUp(...)`; line 17: `useState(false)` for `signupSent`; line 31-36: `if (!data.session)` branch sets `signupSent` and bails before `router.push('/')`; line 38-39: immediate-session path preserved (`router.push('/')` + `router.refresh()`); line 27: `'Could not create account.'` (T-21-04 neutral error copy retained); line 90: `<p className="text-sm">Check your email to confirm your account.</p>`; "Already have an account? Sign in" link present in BOTH `signupSent=false` (line 80-83) and `signupSent=true` (line 95-98) states so the user is never stranded |
| `src/app/forgot-password/forgot-password-form.tsx` | T-21-04 success state preserves no-enumeration property; redirectTo simplified after Task 3 fix | ✓ VERIFIED | Line 25: `setSent(true)` always fires regardless of whether email exists; line 38: `'If an account exists for that email, a reset link has been sent.'` is the uniform success copy (no enumeration); line 23: `redirectTo: ${window.location.origin}/reset-password` (path-only after commit `0c240e9` mid-Task 3 fix; comment on lines 20-22 documents the architectural reason) |
| `src/app/auth/callback/route.ts` | Route handler in place to receive `token_hash` from updated email templates (PKCE+SSR pattern) | ✓ VERIFIED | Line 7-9: parses `token_hash`, `type`, `next` from search params; line 12: `safeNext` open-redirect guard (only relative same-origin paths); line 14-19: when `token_hash && type` present, calls `supabase.auth.verifyOtp({ type, token_hash })` and on success redirects to `safeNext`; line 22: failure fallback to `/login?error=invalid_link`; route handler matches the exact pattern the email templates were updated to use (`{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=...&next=...`) |
| `docs/deploy-db-setup.md` | Phase 21 backout section using existing footgun callout pattern; T-21-PREVIEWMAIL ID present; no API key leaked | ✓ VERIFIED | Section header at line 445 (`## Phase 21 — Custom SMTP via Resend Backout`); 3 footgun-pattern markers found (`grep -c "Phase 21 — Custom SMTP via Resend Backout\|Footgun T-21-PREVIEWMAIL\|Footgun T-21-WWWALLOWLIST"` returns 3); both T-21-PREVIEWMAIL (D-02 preview-share-prod-Supabase) and T-21-WWWALLOWLIST (apex/www allowlist parity) documented; Backout triggers list, 5-step procedure, recovery section all present; T-21-WWWALLOWLIST is value-add over original plan (codifies the apex/www footgun discovered during D-07 gate); zero API key leakage (`grep -E "re_[A-Za-z0-9]{20,}"` exits 1 = no match) |
| `.planning/PROJECT.md` | Email confirmation Key Decisions row reflects post-flip state with Phase 21 reference + 2026-04-30 date | ✓ VERIFIED | Line 128 (Production state): `Email confirmation ON (via Resend SMTP at mail.horlo.app, flipped 2026-04-30 in Phase 21)`; line 149 (Key Decisions table): `Email confirmation OFF | Personal-MVP posture; free-tier SMTP limited to 2/hour | ✓ Resolved — flipped ON 2026-04-30 in Phase 21 via custom Resend SMTP on mail.horlo.app (DKIM+SPF+DMARC verified; D-07 round-trip gate passed). Backout in docs/deploy-db-setup.md "Phase 21 — Custom SMTP via Resend Backout".`; line 100 (Validated section) contains a multi-line entry codifying the v4.0 Phase 21 outcome including SMTP-06 deferral note |
| `.planning/REQUIREMENTS.md` | SMTP-06 marked Deferred (both main section AND Traceability table) | ✓ VERIFIED | Main section line 97: `**Deferred — pending staging Supabase project (see Phase 21 21-CONTEXT.md D-01)**`; Traceability table line 250: `Deferred — pending staging Supabase project (see Phase 21 21-CONTEXT.md D-01)`; `grep -c "Deferred — pending staging Supabase project"` returns 2 (matches plan acceptance criterion of "at least 2 matches") |
| `.planning/phases/21-custom-smtp-via-resend/evidence/` | Audit-trail directory (DNS evidence + Resend Verified ✓ screenshots + SMTP/URL config screenshots + D-07 gate result + Task 4 toggle flip narrative + preflight DB check) | ✓ VERIFIED | 10 evidence artifacts present: `dns-submitted.md` (NS probe + Resend record set + Cloudflare auto-configure transcription + DMARC dig verification), `dns-verified.md` (post-propagation dig output for SPF/DKIM/DMARC/MX), `resend-records-verified.jpeg`, `resend-verified.jpeg`, `supabase-smtp-settings.jpeg`, `supabase-url-config.jpeg`, `preflight-unconfirmed-users.txt` (0 unconfirmed users — toggle flip safe), `d07-gate-result.md` (Clause A + Clause B + Overall: PASS), `task4-toggle-flip-result.md` (toggle states + smoke test + email-template realignment narrative). API-key leakage guard: `grep -rE "re_[A-Za-z0-9]{20,}" evidence/` exits 1 (no match) — T-21-01 mitigation enforced |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| Resend Verified ✓ | Supabase SMTP wiring | Resend API key (Send-only scope) → pasted into Supabase Auth SMTP password field | ✓ WIRED | `evidence/dns-verified.md` confirms DKIM+SPF+DMARC+MX serving expected values from authoritative Cloudflare nameservers. `evidence/supabase-smtp-settings.jpeg` (operator-attested) confirms `smtp.resend.com:465` + Username=`resend` + Sender=`Horlo <noreply@mail.horlo.app>` + masked password (D-04 + D-05 + D-06 honored). API key creation + 1Password storage operator-attested in 21-02-SUMMARY (Task 1) with T-21-01 grep guard passing on `evidence/`. |
| Supabase Invite-User + real Gmail signup | Three-toggle flip | Both must Inbox at Gmail (not Spam) per D-08 BEFORE flipping; spam-fold blocks the flip per D-09 | ✓ WIRED | `evidence/d07-gate-result.md` reports Clause A (Supabase Invite-User → `twwaneka+horlo-smtp-test1@gmail.com`) landed Inbox first attempt with From=`Horlo <noreply@mail.horlo.app>` and DKIM=pass+SPF=pass+DMARC=pass; Clause B initial attempt spam-foldered (D-09 STOP enforced — operator did NOT proceed to toggle flip from spam'd state); operator marked Not Spam, retried with fresh `+suffix` alias, second attempt landed Inbox; subsequent latent bugs (forgot-password redirectTo silent-drop + apex/www allowlist mismatch) discovered and fixed during the gate; final re-test landed Inbox AND link round-tripped end-to-end through `/reset-password`; only AFTER `Overall gate disposition: PASS` did Task 4 begin (verified by pre-flight check in `task4-toggle-flip-result.md` line 6: `D-07 round-trip gate: PASS (per evidence/d07-gate-result.md)`) |
| Supabase email templates | `/auth/callback` route handler | `{{ .TokenHash }}` PKCE pattern: `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=...&next=...` | ✓ WIRED | `task4-toggle-flip-result.md` records the operator updated all three Supabase Auth email templates (Confirm signup → `&type=signup&next=/`, Reset Password → `&type=recovery&next=/reset-password`, Change Email → `&type=email_change&next=/`); on-the-wire verification: captured email link `https://horlo.app/auth/callback?token_hash=pkce_xxx&type=signup&next=/` round-tripped through horlo's `/auth/callback` route → `verifyOtp({ type, token_hash })` → session cookie set → redirect to `/` with user authed; `src/app/auth/callback/route.ts` parses exactly these three params (`token_hash`, `type`, `next`) per the route handler reading |

### Data-Flow Trace (Level 4)

Phase 21 is primarily an ops + config + docs phase. The two source files modified (`signup-form.tsx`, `forgot-password-form.tsx`) render UI state (`signupSent`, `sent`) that is set in response to user form submission via Supabase Auth client calls. Data flow:

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `signup-form.tsx` | `signupSent` (boolean) | `setSignupSent(true)` after `supabase.auth.signUp({ email, password })` returns `{ data: { session: null }, error: null }` | Yes — branches on real Supabase Auth response shape; production smoke-tested in Task 4 (operator confirmed in-card success state rendered correctly under Confirm-email-ON) | ✓ FLOWING |
| `forgot-password-form.tsx` | `sent` (boolean) | `setSent(true)` always fires after `supabase.auth.resetPasswordForEmail(email, { redirectTo })` (T-21-04: uniform behavior whether email exists or not — no enumeration leak) | Yes — branch fires unconditionally after the Supabase call resolves; verified end-to-end in `d07-gate-result.md` Clause B re-test | ✓ FLOWING |
| `auth/callback/route.ts` | redirect target (`safeNext`) + session cookie | `searchParams.get('token_hash')` + `searchParams.get('type')` from email link → `verifyOtp({ type, token_hash })` server-side → `@supabase/ssr` cookies → redirect | Yes — verified end-to-end in `task4-toggle-flip-result.md` post-flip smoke test (operator clicked link in confirm-signup email, route handler verified OTP, session cookie set, redirected to `/` with user authed) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command / Check | Result | Status |
| -------- | --------------- | ------ | ------ |
| Phase 21 backout doc section present | `grep -c "Phase 21 — Custom SMTP via Resend Backout\|Footgun T-21-PREVIEWMAIL\|Footgun T-21-WWWALLOWLIST" docs/deploy-db-setup.md` | `3` | ✓ PASS |
| No Resend API key leaked into evidence | `grep -rE "re_[A-Za-z0-9]{20,}" .planning/phases/21-custom-smtp-via-resend/evidence/ ; exit=1` | exit=1 (no match — T-21-01 guard) | ✓ PASS |
| No Resend API key leaked into docs | `grep -nE "re_[A-Za-z0-9]{20,}" docs/deploy-db-setup.md ; exit=1` | exit=1 (no match) | ✓ PASS |
| signup-form has D-10 no-session branch | `grep -F "data.session" src/app/signup/signup-form.tsx`, `grep -F "signupSent" src/app/signup/signup-form.tsx`, `grep -F "Check your email" src/app/signup/signup-form.tsx`, `grep -F "router.push('/')" src/app/signup/signup-form.tsx` | All 4 grep patterns match (lines 17, 24, 31, 33, 38, 90) | ✓ PASS |
| T-21-04 user-enumeration neutral error copy preserved | `grep -F "Could not create account." src/app/signup/signup-form.tsx` | 1 match (line 27) | ✓ PASS |
| forgot-password T-21-04 uniform success state | `grep -F "If an account exists" src/app/forgot-password/forgot-password-form.tsx` | 1 match (line 38) | ✓ PASS |
| signup-form D-10 commit precedes toggle-flip commit | `git log --oneline -- src/app/signup/signup-form.tsx \| head -1` returns `fbf3b8f`; toggle flip in `a0d282e` (Task 4) per 21-02-SUMMARY commit list | `fbf3b8f` (Plan 21-01 Task 3) chronologically precedes `a0d282e` (Plan 21-02 Task 4) — T-21-03 sequencing mitigation enforced | ✓ PASS |
| SMTP-06 marked Deferred (both main section + Traceability) | `grep -c "Deferred — pending staging Supabase project" .planning/REQUIREMENTS.md` | `2` (line 97 main, line 250 Traceability) | ✓ PASS |
| Evidence directory has all expected operator-attested files | `ls .planning/phases/21-custom-smtp-via-resend/evidence/` | 10 files present (5 markdown/text + 4 .jpeg + 1 .gitkeep) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| SMTP-01 | 21-01-PLAN.md, 21-02-PLAN.md | `mail.horlo.app` (subdomain per D-03) verified at Resend with SPF + DKIM + DMARC `p=none` + bounce MX; "Verified ✓" badge confirmed | ✓ SATISFIED | DNS submission via Resend × Cloudflare auto-configure (Plan 21-01) + manual DMARC; `evidence/dns-submitted.md` + `evidence/dns-verified.md` + `evidence/resend-records-verified.jpeg` + `evidence/resend-verified.jpeg` |
| SMTP-02 | 21-02-PLAN.md | Supabase SMTP wired to `smtp.resend.com:465` with Resend-issued password | ✓ SATISFIED | `evidence/supabase-smtp-settings.jpeg` (operator-attested form values per field-mapping table); D-07 Clause A confirmed connectivity end-to-end |
| SMTP-03 | 21-02-PLAN.md | Confirm-email toggle ON only after SMTP-01 + SMTP-02 land AND test email round-trips successfully (D-07 gate) | ✓ SATISFIED | `evidence/d07-gate-result.md` `Overall gate disposition: PASS`; `evidence/task4-toggle-flip-result.md` records Confirm-email ON in production; signup-form D-10 amend (commit `fbf3b8f`) merged BEFORE flip (commit `a0d282e`); post-flip smoke test confirms in-prod D-10 UX renders correctly |
| SMTP-04 | 21-02-PLAN.md | Secure email change + Secure password change toggles ON | ✓ SATISFIED | `evidence/task4-toggle-flip-result.md` operator-attested table records both toggles ON in project `wdntzsckjaoqodsyscns` |
| SMTP-05 | 21-02-PLAN.md | Backout-plan section in `docs/deploy-db-setup.md` documenting how to revert to Supabase hosted SMTP if DKIM fails post-flip | ✓ SATISFIED | `docs/deploy-db-setup.md` § "Phase 21 — Custom SMTP via Resend Backout" (line 445) using existing footgun pattern (T-21-PREVIEWMAIL + T-21-WWWALLOWLIST); 5-step backout procedure + triggers + recovery |
| SMTP-06 | 21-02-PLAN.md | `mail.staging.horlo.app` (staging) and `mail.horlo.app` (prod) separated for sender-reputation isolation | ⊘ DEFERRED | Explicitly Deferred per CONTEXT D-01 (no staging Supabase project yet); REQUIREMENTS.md line 97 + line 250 both mark Deferred with reference to Phase 21 21-CONTEXT.md D-01; this is a deliberate scope decision, NOT a gap |

**Coverage:** 5/5 actionable requirements satisfied; 1/1 deferred requirement explicitly documented as Deferred per phase decision (D-01). All 6 SMTP requirement IDs from PLAN frontmatter accounted for.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `src/app/forgot-password/forgot-password-form.tsx` | 20-23 | Inline comment in `redirectTo: ${window.location.origin}/reset-password` describes intermediate post-fix-1 state; per `task4-toggle-flip-result.md` "Notes for follow-up", this code is now functionally vestigial after the email-template realignment (templates hardcode the destination via `&next=/reset-password`) — code remains functional and safe; comment is mildly misleading | ℹ️ Info | Documented as out-of-scope cleanup in 21-02-SUMMARY "Next Phase Readiness" section. Does not affect goal achievement; the form still works correctly because the template's `&next=/reset-password` takes precedence and `/reset-password` is in the redirect allowlist anyway. |
| `src/app/signup/signup-form.tsx` | 17-39 | None — change is clean: state declaration, branch on `data.session`, neutral error copy preserved, immediate-session redirect path retained | n/a | n/a |
| `src/app/auth/callback/route.ts` | 12 | Open-redirect guard (`safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/'`) — defensive coding, not an anti-pattern | n/a | n/a |
| Phase 21 evidence directory | n/a | Operator no-screenshot preference accepted as deliberate evidence deviation on Tasks 3 + 4 (text-only audit trail in `d07-gate-result.md` + `task4-toggle-flip-result.md`); 5 expected screenshot files NOT captured | ℹ️ Info | Documented in 21-02-SUMMARY Deviations §5 as deliberate operator preference; trade-off accepted (reduced post-hoc forensic value) given personal-MVP scope and bounded blast radius. Plan's `<verify>` automated grep block on screenshot files would FAIL on missing files; this is the only known deviation. The 4 critical screenshots that WERE captured (`resend-records-verified.jpeg`, `resend-verified.jpeg`, `supabase-smtp-settings.jpeg`, `supabase-url-config.jpeg`) cover the highest-stakes config surfaces (DNS verification + SMTP wiring + URL allowlist). Operator-attested text evidence in `d07-gate-result.md` and `task4-toggle-flip-result.md` includes specific diagnostic detail (Authentication-Results header verdicts, fix commit hashes, decoded URL values, network-tab payload observations) that screenshots alone could not have provided. |

**No blockers. No warnings. Two info-level notes for situational awareness — neither affects the goal.**

### Human Verification Required

None. All operator-attested items are accompanied by sufficient evidence (text narratives, dig output captured in evidence/, dashboard screenshots for the high-stakes config surfaces, fix commit hashes, on-the-wire link captures, AC-Results header verdicts) such that a human re-verifier can audit the chain end-to-end without re-running the gate. Per the verification request, operator-attested items are classified as verifiable-via-evidence (passed if evidence supports), not human_verification gaps.

The post-flip smoke test in `task4-toggle-flip-result.md` step 7 (clicking the link `https://horlo.app/auth/callback?token_hash=pkce_xxx&type=signup&next=/` in production and landing authed at `/`) is the load-bearing on-the-wire proof that all upstream wiring (DNS → DKIM → SMTP → Supabase Auth → email template → /auth/callback route → verifyOtp → @supabase/ssr session cookie → middleware) composes correctly end-to-end in prod. This was operator-confirmed; no further human verification is required to advance.

### Gaps Summary

No gaps. All 5 ROADMAP success criteria verified; all 5 actionable requirement IDs (SMTP-01 through SMTP-05) satisfied; SMTP-06 explicitly Deferred per CONTEXT D-01 (deliberate scope decision, not a gap). Two latent pre-existing auth-flow bugs (forgot-password redirect indirection mismatch + signup confirm not auto-authing) were discovered and fixed mid-phase during the D-07 gate test — the planner over-delivered relative to the original plan by realigning all three email templates to the canonical `/auth/callback` PKCE+SSR pattern and codifying the apex/www allowlist parity discovery as **Footgun T-21-WWWALLOWLIST** in the backout doc. Phase exits in a stronger architectural posture than it entered.

**Notable strengths beyond the plan:**
- T-21-WWWALLOWLIST footgun added to backout doc (codifies apex/www mismatch discovered during D-07 gate testing — value-add over the original plan's single-footgun expectation)
- All three Supabase auth email templates standardized on `/auth/callback?token_hash={{ .TokenHash }}&type=...&next=...` pattern (preemptively fixes Email change template before SET-04 in Phase 22 hits it; eliminates a class of latent bugs)
- Threat model T-21-01 (Resend API key leak) verified via grep guard against both `evidence/` and `docs/` — both clean
- T-21-04 user-enumeration mitigation verified in BOTH signup-form AND forgot-password-form (uniform success copy in both flows)
- DMARC `v=DMARC1; p=none;` (D-11) published and verified via authoritative Cloudflare NS, despite Resend × Cloudflare auto-configure skipping the optional record — operator caught the gap and manually published

---

_Verified: 2026-04-30T18:00:00Z_
_Verifier: Claude (gsd-verifier)_
