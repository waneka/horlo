---
phase: 21
slug: custom-smtp-via-resend
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-30
---

# Phase 21 — Validation Strategy

> Per-phase validation contract. Phase 21 is **primarily ops/config/docs** with one targeted code change (signup-form). Most "validation" is therefore manual checkpoint observation (DNS Verified ✓, dashboard SMTP test, real-Gmail end-to-end signup) rather than automated unit tests. The signup-form code change has automated coverage via type-check + build + a manual UAT pass.

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
- **Before `/gsd-verify-work`:** Full triad must be green AND the D-07 round-trip gate must be documented as passed.
- **Max automated feedback latency:** ~60s for the code change. Manual gates (DNS propagation, Resend Verified ✓, end-to-end Gmail signup) are observed as they happen and recorded in execution logs.

---

## Per-Task Verification Map

> Filled by the planner. Manual ops/config tasks use `manual` test type with explicit observation criteria. Automated tasks (signup-form code edit) use `automated` with grep/test commands.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (planner fills) | — | — | SMTP-XX | — | (per task) | manual / automated | (per task) | ✅ N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] No new test infrastructure required — phase ships type-check + lint + build as automated gates and relies on manual observation gates (D-07) for ops/config behavior.

*Existing `tsconfig.json` strict mode + `npm run build` cover the only code change.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `mail.horlo.app` Verified ✓ at Resend | SMTP-01 | Vendor dashboard state, no programmatic verification path | Open Resend → Domains → `mail.horlo.app`. Confirm "Verified ✓" badge on SPF, DKIM, DMARC, and bounce-MX rows. Screenshot for the execution log. |
| DNS records propagated | SMTP-01 | Authoritative DNS query, vendor-side verification | Run `dig +short TXT mail.horlo.app`, `dig +short TXT _dmarc.mail.horlo.app`, `dig +short CNAME <resend-dkim-record>` from at least one external network. Each must return non-empty values matching what Resend issued. |
| Supabase SMTP configured | SMTP-02 | Vendor dashboard state | Open Supabase Dashboard → Auth → SMTP Settings. Confirm Host=`smtp.resend.com`, Port=`465`, Username=`resend`, Sender Email=`noreply@mail.horlo.app`, Sender Name=`Horlo`. |
| D-07 round-trip gate passes | SMTP-02 / SMTP-03 | Real-world end-to-end behavior over public mail networks; no automation path | (1) Trigger Supabase Invite-User flow (per RESEARCH.md, the closest substitute for the missing "Send test email" button). Confirm receipt at a controlled Gmail address. (2) Sign up at production with a fresh Gmail address. Confirm: email arrives in **Inbox** (NOT Spam) within ~2 minutes; the link opens `/auth/confirm` and confirms the account. **If spam-foldered, BLOCK the toggle flip per D-09.** |
| Three Auth toggles ON | SMTP-03 | Vendor dashboard state | Open Supabase Dashboard → Auth → Providers → Email. Confirm "Confirm email", "Secure email change", "Secure password change" all show ON in **production project** (not staging). |
| Site URL audit | (Claude's Discretion) | Vendor dashboard state | Open Supabase Dashboard → Auth → URL Configuration. Confirm Site URL = `https://horlo.app` and the redirect-URL allowlist includes the production app's `/auth/confirm` path. |
| Backout plan documented | SMTP-05 | Documentation deliverable | `grep -F "Footgun" docs/deploy-db-setup.md` shows a new SMTP-backout footgun callout. The new section names the trigger conditions (DKIM regression, Resend suspension, deliverability incident) and the revert procedure (Supabase Dashboard toggle flip + hosted-SMTP creds restoration). |
| Signup-form UX handles no-session case | (D-10, prerequisite for SMTP-03) | UI behavior best confirmed by the same end-to-end flow as D-07 | After amending `src/app/signup/signup-form.tsx`, run a local signup against a Supabase project with Confirm-email ON. Confirm the form renders a "Check your email" message in-card AND does NOT redirect. Then re-test the existing OFF path (immediate session) still redirects home. Final production verification rolls into the D-07 gate. |

---

## Validation Sign-Off

- [ ] Every task in every PLAN.md has either `<automated>` verify command OR explicit manual observation criteria + recording instruction
- [ ] Sampling continuity: ops/config tasks need observation criteria, code tasks need automated checks
- [ ] No watch-mode flags in any automated command
- [ ] D-07 round-trip gate is encoded as a `[BLOCKING]` task in the plan that flips Confirm-email ON
- [ ] DNS-propagation gate is encoded as a non-blocking checkpoint between SMTP-01 and SMTP-02 plans
- [ ] `nyquist_compliant: true` set in frontmatter once planner has filled the verification map

**Approval:** pending
