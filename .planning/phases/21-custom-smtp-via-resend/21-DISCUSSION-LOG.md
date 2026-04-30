# Phase 21: Custom SMTP via Resend - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-30
**Phase:** 21-custom-smtp-via-resend
**Areas discussed:** Staging environment definition, Sender identity (From + domain), Round-trip verification protocol

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Staging environment definition | SMTP-06 mail.staging vs mail.horlo separation given no staging Supabase exists | ✓ |
| Sender identity (From + domain) | From address, display name, apex vs subdomain verification at Resend | ✓ |
| Round-trip verification protocol | Test mechanism between SMTP-02 and SMTP-03; receiver coverage; spam-folder response | ✓ |
| Backout-plan structure + triggers | What triggers revert, how fast, where the doc lives | |

**User's choice:** Three of four areas selected. Backout-plan deferred to Claude's discretion (planner).

---

## Staging environment definition

### Q1: How should Phase 21 handle SMTP-06 staging/prod sender separation?

| Option | Description | Selected |
|--------|-------------|----------|
| Defer SMTP-06; prod only now | Verify mail.horlo.app, wire prod Supabase, mark SMTP-06 deferred. Simplest. | ✓ |
| Pre-verify mail.staging.horlo.app at Resend now | Add DNS for both subdomains, verify both, wire only prod. Pre-provision staging sender. | |
| Stand up staging Supabase project this phase | Create second Supabase project, point preview deploys at it. Largest scope creep. | |

**User's choice:** Defer SMTP-06; prod only now (Recommended).

### Q2: Should Vercel preview deploys keep pointing at prod Supabase after Phase 21?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — unchanged | Preview deploys continue using prod Supabase. Note as known constraint. | ✓ |
| Investigate splitting now | Treat Vercel preview → prod Supabase as a Phase 21 problem. Probably scope creep. | |

**User's choice:** Yes — unchanged (Recommended).

---

## Sender identity (From + domain)

### Q1: Which domain should be verified at Resend?

| Option | Description | Selected |
|--------|-------------|----------|
| Subdomain: mail.horlo.app | SPF/DKIM/MX on subdomain. Apex stays clean. Industry standard. | ✓ |
| Apex: horlo.app | Cleaner From addresses. Couples auth DKIM/SPF to anything else at apex. | |

**User's choice:** Subdomain: mail.horlo.app (Recommended).

### Q2: What local-part should the From address use?

| Option | Description | Selected |
|--------|-------------|----------|
| noreply@ | Standard for transactional + auth. Clear "don't reply" semantics. | ✓ |
| auth@ | More specific. Means another address needed for non-auth transactional later. | |
| hello@ | Friendlier brand voice but ambiguous for password-reset emails. | |

**User's choice:** noreply@ (Recommended).

### Q3: What display name should appear in inboxes?

| Option | Description | Selected |
|--------|-------------|----------|
| Horlo | Inbox shows: Horlo <noreply@mail.horlo.app>. Clean brand match. | ✓ |
| Horlo Auth | More descriptive. Reads slightly bureaucratic. | |

**User's choice:** Horlo (Recommended).

### Q4: Should Supabase Auth emails set a Reply-To header?

| Option | Description | Selected |
|--------|-------------|----------|
| No Reply-To header | Replies bounce off noreply@. Matches semantics. | ✓ |
| Reply-To: tyler's email (twwaneka@gmail.com) | Replies route to your inbox. Mixes personal mail with app traffic. | |
| Reply-To: support@horlo.app (does not exist yet) | Future-facing; would need inbox setup first. Scope creep. | |

**User's choice:** No Reply-To header (Recommended).

---

## Round-trip verification protocol

### Q1: What verification step proves SMTP works before flipping Confirm-email ON?

| Option | Description | Selected |
|--------|-------------|----------|
| Both: dashboard test + throwaway signup | Dashboard "Send test email" then real end-to-end signup. Catches both cred and template errors. | ✓ |
| Dashboard "Send test email" only | Faster but doesn't exercise the actual confirmation link flow. | |
| Throwaway signup end-to-end only | Skips dashboard test. Conflates credential and link issues if it fails. | |

**User's choice:** Both: dashboard test + throwaway signup (Recommended).

### Q2: Which receiver inboxes must pass (inbox not spam) before flipping?

| Option | Description | Selected |
|--------|-------------|----------|
| Gmail | Largest receiver, strict DMARC/DKIM. If Gmail accepts, most do. | ✓ |
| iCloud | Apple's filtering is aggressive. Useful confidence check. | |
| Outlook/Hotmail | Microsoft has its own quirks. Good third sample. | |
| Just one (Gmail) is enough | Minimum viable gate. Faster but less coverage. | |

**User's choice:** Gmail only.

### Q3: If the test email lands in spam (not inbox), what's the response?

| Option | Description | Selected |
|--------|-------------|----------|
| Block flip; investigate DKIM/SPF first | Fix DNS root cause before retrying gate. | ✓ |
| Flip anyway, monitor 24h | Riskier; new signups might miss confirmation. | |

**User's choice:** Block flip; investigate DKIM/SPF first (Recommended).

---

## Claude's Discretion

- **Backout-plan structure + triggers** — User did not select for discussion. Planner decides triggers (DKIM regress, Resend suspension, deliverability incident), revert procedure (toggle Confirm-email OFF, restore Supabase hosted SMTP creds), and doc location (extend `docs/deploy-db-setup.md` Step 0 area).
- **Plan structure / DNS lead-time gating** — Planner decides whether to split DNS submission and post-verification wiring into separate plans with a propagation checkpoint.
- **Site URL / redirect URL audit before flip** — Not a discussed gray area, but plan should include verification of Supabase Auth → URL Configuration before flipping toggles.

## Deferred Ideas

- **SMTP-06** (staging sender separation) — Deferred until staging Supabase project exists; REQUIREMENTS.md will be updated.
- **Branded HTML email templates** — Already deferred to SET-14 (Phase 23 area).
- **Vercel preview → staging Supabase split** — Future ROADMAP item.
- **Bounce/complaint webhook handling** — Defer until user volume justifies.
- **Deliverability monitoring dashboard** — Resend dashboard suffices for now.
- **`support@horlo.app` mailbox / Reply-To routing** — Out of scope.
