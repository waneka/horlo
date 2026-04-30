---
phase: 21
slug: custom-smtp-via-resend
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-30
updated: 2026-04-30
---

# Phase 21 — Validation Strategy

> Per-phase validation contract. Phase 21 is **primarily ops/config/docs** with one targeted code change (signup-form). Most "validation" is therefore manual checkpoint observation (DNS Verified ✓, dashboard SMTP test, real-Gmail end-to-end signup) rather than automated unit tests. The signup-form code change has automated coverage via type-check + build + a manual UAT pass that rolls into the D-07 production gate.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None installed (per RESEARCH.md). Type-check + lint + build are the only automated gates. |
| **Config file** | `tsconfig.json` (strict TS), `eslint.config.mjs` |
| **Quick run command** | `npm run lint` |
| **Full suite command** | `npm run lint && npx tsc --noEmit && npm run build` |
| **Estimated runtime** | ~30–60s for the full triad |

> No unit-test framework is in scope for Phase 21. Wave 0 does NOT install one — the phase is too small to justify the install, and the only code change (signup-form UX) has its semantics verified by the D-07 end-to-end Gmail signup gate in production.

---

## Sampling Rate

- **After every task commit:** Run `npm run lint` (when a code file was edited; skip for DNS / dashboard / docs-only tasks).
- **After the signup-form code task:** Run `npm run lint && npx tsc --noEmit && npm run build`.
- **Before `/gsd-verify-work`:** Full triad must be green AND the D-07 round-trip gate must be documented as passed in `evidence/d07-gate-result.md`.
- **Max automated feedback latency:** ~60s for the code change. Manual gates (DNS propagation, Resend Verified ✓, end-to-end Gmail signup) are observed as they happen and recorded in `evidence/` with screenshots and dig output.

---

## Per-Task Verification Map

> Filled by the planner. Manual ops/config tasks use `manual` test type with explicit observation criteria. Automated tasks (signup-form code edit + docs edit) use `automated` with grep/test commands.

### Plan 21-01: DNS submit + signup-form scaffold

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 21-01-1 | 01 | 1 | SMTP-01 | T-21-05 | Operator records DNS provider + Resend record set into evidence/ (no secrets) | manual + automated | `test -f evidence/dns-submitted.md && test -f evidence/resend-record-set.png && grep -q "NS probe" evidence/dns-submitted.md && grep -q "Resend-issued record set" evidence/dns-submitted.md` | ✅ N/A | ⬜ pending |
| 21-01-2 | 01 | 1 | SMTP-01 | T-21-02 | DNS records (SPF + DKIM + DMARC + bounce-MX) submitted with leftmost-label Name (Pitfall 2) | manual + automated | `grep -q "Records submitted at" evidence/dns-submitted.md && grep -q "_dmarc.mail" evidence/dns-submitted.md && test -f evidence/dns-provider-records.png` | ✅ N/A | ⬜ pending |
| 21-01-3 | 01 | 1 | D-10 (prerequisite for SMTP-03) | T-21-04 | signup-form.tsx renders "Check your email" on no-session signup; preserves immediate-session redirect; neutral error copy unchanged | automated | `grep -q "data.session" src/app/signup/signup-form.tsx && grep -q "signupSent" src/app/signup/signup-form.tsx && grep -q "Check your email" src/app/signup/signup-form.tsx && grep -q "router.push('/')" src/app/signup/signup-form.tsx && grep -q "Could not create account." src/app/signup/signup-form.tsx && npm run lint && npx tsc --noEmit && npm run build` | ✅ src/app/signup/signup-form.tsx | ⬜ pending |

### Plan 21-02: Verify, wire, gate, flip, doc

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 21-02-1 | 02 | 2 | SMTP-01 (final verify) | T-21-01 | Verified ✓ confirmed; API key created Send-only and stored offline (not in evidence/) | manual + automated | `test -f evidence/dns-verified.md && test -f evidence/resend-verified.png && grep -q "v=spf1" evidence/dns-verified.md && grep -q "DMARC1" evidence/dns-verified.md && ! grep -rE "re_[A-Za-z0-9]{20,}" evidence/` | ✅ N/A | ⬜ pending |
| 21-02-2 | 02 | 2 | SMTP-02 | T-21-01, T-21-02 | Supabase SMTP wired exactly to field-mapping; Site URL = https://horlo.app (no trailing slash; Pitfall 3); redirect allowlist includes prod + preview | manual + automated | `test -f evidence/supabase-smtp-settings.png && test -f evidence/supabase-url-config.png && test -f evidence/preflight-unconfirmed-users.txt && ! grep -rE "re_[A-Za-z0-9]{20,}" evidence/` | ✅ N/A | ⬜ pending |
| 21-02-3 | 02 | 2 | SMTP-03 (gate clause), SMTP-02 (gate clause), D-07, D-08, D-09 | T-21-02 | BOTH Invite-User Inbox-not-Spam AND real-Gmail end-to-end signup Inbox-not-Spam; From header = `Horlo <noreply@mail.horlo.app>`; reset link round-trips through prod | manual + automated | `test -f evidence/d07-gate-result.md && grep -q "Clause A: PASS" evidence/d07-gate-result.md && grep -q "Clause B: PASS" evidence/d07-gate-result.md && grep -q "Overall gate disposition: PASS" evidence/d07-gate-result.md && test -f evidence/d07-clause-a-invite-inbox.png && test -f evidence/d07-clause-a-invite-headers.png && test -f evidence/d07-clause-b-reset-inbox.png && test -f evidence/d07-clause-b-reset-headers.png && test -f evidence/d07-clause-b-reset-success.png` | ✅ N/A | ⬜ pending |
| 21-02-4 | 02 | 2 | SMTP-03, SMTP-04, D-10 (production verification) | T-21-03 | Three toggles ON in prod; post-flip smoke confirms signup-form D-10 path renders correctly AND email round-trips to Inbox | manual + automated | `test -f evidence/toggle-confirm-email-on.png && test -f evidence/toggle-secure-email-change-on.png && test -f evidence/toggle-secure-password-change-on.png && test -f evidence/postflip-signup-card.png && test -f evidence/postflip-confirm-inbox.png && test -f evidence/postflip-logged-in.png && grep -q "data.session" src/app/signup/signup-form.tsx` | ✅ N/A | ⬜ pending |
| 21-02-5 | 02 | 2 | SMTP-05, SMTP-06 (deferral note) | T-21-05 | docs/deploy-db-setup.md has Phase 21 backout section with **Footgun T-21-PREVIEWMAIL:** pattern; PROJECT.md Key Decisions reflects email confirmation ON; REQUIREMENTS.md SMTP-06 marked Deferred; no API key in docs | automated | `grep -q "Phase 21 — Custom SMTP via Resend Backout" docs/deploy-db-setup.md && grep -q "Footgun T-21-PREVIEWMAIL" docs/deploy-db-setup.md && grep -q "Backout triggers" docs/deploy-db-setup.md && grep -q "Backout procedure" docs/deploy-db-setup.md && grep -q "Email confirmation" .planning/PROJECT.md && grep -q "SMTP-06.*Deferred" .planning/REQUIREMENTS.md && grep -q "Deferred — pending staging Supabase project" .planning/REQUIREMENTS.md && ! grep -E "re_[A-Za-z0-9]{20,}" docs/deploy-db-setup.md && npm run lint && npx tsc --noEmit` | ✅ docs/deploy-db-setup.md | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] No new test infrastructure required — phase ships type-check + lint + build as automated gates and relies on manual observation gates (D-07) for ops/config behavior.

*Existing `tsconfig.json` strict mode + `npm run build` cover the only code change.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `mail.horlo.app` Verified ✓ at Resend | SMTP-01 | Vendor dashboard state, no programmatic verification path | Open Resend → Domains → `mail.horlo.app`. Confirm "Verified ✓" badge on SPF, DKIM, DMARC, and bounce-MX rows. Screenshot to `evidence/resend-verified.png`. |
| DNS records propagated | SMTP-01 | Authoritative DNS query, vendor-side verification | Run `dig +short TXT mail.horlo.app`, `dig +short TXT _dmarc.mail.horlo.app`, `dig +short CNAME <resend-dkim-record>` from at least one external network. Each must return non-empty values matching what Resend issued. Capture in `evidence/dns-verified.md`. |
| Supabase SMTP configured | SMTP-02 | Vendor dashboard state | Open Supabase Dashboard → Auth → SMTP Settings. Confirm Host=`smtp.resend.com`, Port=`465`, Username=`resend`, Sender Email=`noreply@mail.horlo.app`, Sender Name=`Horlo`. Screenshot to `evidence/supabase-smtp-settings.png` (with password masked by Supabase). |
| D-07 round-trip gate passes | SMTP-02 / SMTP-03 | Real-world end-to-end behavior over public mail networks; no automation path | (1) Trigger Supabase **Send Invitation** flow (per RESEARCH.md, the closest substitute for the missing "Send test email" button — that button does NOT exist). Confirm receipt at a controlled Gmail address. (2) Trigger a password-reset flow against production using a real Gmail signup. Confirm: email arrives in **Inbox** (NOT Spam) within ~2 minutes; the link round-trips through `/auth/v1/verify` → lands logged in on horlo.app. **If spam-foldered, BLOCK the toggle flip per D-09.** Capture in `evidence/d07-gate-result.md` with screenshots. |
| Three Auth toggles ON | SMTP-03, SMTP-04 | Vendor dashboard state | Open Supabase Dashboard → Auth → Sign In/Providers → Email. Confirm "Confirm email", "Secure email change", "Secure password change" all show ON in **production project** (`wdntzsckjaoqodsyscns`), not staging. Screenshot each to `evidence/toggle-*.png`. |
| Site URL audit | (Claude's Discretion) | Vendor dashboard state | Open Supabase Dashboard → Auth → URL Configuration. Confirm Site URL = `https://horlo.app` (NO trailing slash, Pitfall 3) and the redirect-URL allowlist includes prod (`https://horlo.app/**`) AND preview (`https://horlo-*.vercel.app/**`) per D-02. Screenshot to `evidence/supabase-url-config.png`. |
| Backout plan documented | SMTP-05 | Documentation deliverable | `grep -q "Phase 21 — Custom SMTP via Resend Backout" docs/deploy-db-setup.md && grep -q "Footgun T-21-PREVIEWMAIL" docs/deploy-db-setup.md`. The new section names the trigger conditions (DKIM regression, Resend suspension, deliverability incident) and the revert procedure (Supabase Dashboard toggle flip + hosted-SMTP creds restoration). |
| Signup-form UX handles no-session case | D-10 (prerequisite for SMTP-03) | UI behavior best confirmed by the same end-to-end flow as D-07 | After amending `src/app/signup/signup-form.tsx`, `npm run lint && npx tsc --noEmit && npm run build` must all pass. Production verification rolls into Plan 21-02 Task 4 smoke test (post-flip): visit `horlo.app/signup`, sign up with a fresh +suffix Gmail alias, verify the form renders the "Check your email" success state in-card AND does NOT redirect, then click the confirmation link and verify it lands logged in. Screenshots to `evidence/postflip-signup-card.png` etc. |
| Resend API key never leaks | T-21-01 mitigation | Search across evidence/ and docs | `! grep -rE "re_[A-Za-z0-9]{20,}" .planning/phases/21-custom-smtp-via-resend/evidence/ && ! grep -E "re_[A-Za-z0-9]{20,}" docs/deploy-db-setup.md`. Both must return no matches. The key lives only in 1Password and Supabase Dashboard (masked after save) and optionally `.env.local` (gitignored). |

---

## Validation Sign-Off

- [x] Every task in every PLAN.md has either `<automated>` verify command OR explicit manual observation criteria + recording instruction
- [x] Sampling continuity: ops/config tasks have observation criteria with recorded artifacts in `evidence/`; code tasks have automated checks (lint + tsc + build)
- [x] No watch-mode flags in any automated command
- [x] D-07 round-trip gate is encoded as a `[BLOCKING]` task in the plan that flips Confirm-email ON (Plan 21-02 Task 3 [BLOCKING], Task 4 has explicit pre-flight check that Task 3 PASSed)
- [x] DNS-propagation gate is encoded as a non-blocking checkpoint between Plan 21-01 and Plan 21-02 (Plan 21-02 Task 1 verifies Verified ✓ via `dig` + Resend dashboard before any other Plan 21-02 work begins)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
