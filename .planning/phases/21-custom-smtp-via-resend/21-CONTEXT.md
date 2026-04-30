# Phase 21: Custom SMTP via Resend - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Move Supabase Auth's transactional emails (signup confirm, password reset, email-change confirm) off Supabase's hosted SMTP (2/h free-tier cap) onto Resend with a verified DKIM-signed `mail.horlo.app` subdomain, then flip **Confirm email**, **Secure email change**, and **Secure password change** to ON in production — only after a documented round-trip test passes.

This is an **ops + config + docs phase**. No application code changes. The deliverables are:
1. DNS records at the registrar (SPF/DKIM/MX) for `mail.horlo.app`.
2. Resend domain verified ✓ + a Resend SMTP password issued.
3. Supabase Dashboard → Auth → SMTP wired to `smtp.resend.com:465`.
4. Three Auth toggles flipped ON in prod.
5. A backout-plan section appended to `docs/deploy-db-setup.md`.
6. PROJECT.md Key Decisions row updated (`Email confirmation OFF` → `ON`).
7. REQUIREMENTS.md note that SMTP-06 (staging sender separation) is deferred until a staging Supabase project exists.

Anything beyond this list (branded HTML templates, bounce/complaint webhooks, monitoring dashboards, staging Supabase project) belongs in other phases.

</domain>

<decisions>
## Implementation Decisions

### Staging / Sender Reputation Isolation
- **D-01:** SMTP-06 is **deferred** until a separate Supabase staging project exists. Phase 21 wires prod-only. REQUIREMENTS.md is updated to mark SMTP-06 as `Deferred — pending staging Supabase project`. The decision is captured here so a future phase can pick it up without re-litigating.
- **D-02:** Vercel **preview deployments continue to point at prod Supabase** after this phase. Any signup/recovery email sent from a preview URL will hit prod auth and send a real Resend email. This is a known constraint, not a problem to solve in Phase 21. Document it in the backout-plan section so anyone hitting unexpected emails from previews has the context.

### Resend Domain + Sender Identity
- **D-03:** Verify the **subdomain `mail.horlo.app`** at Resend (not the apex `horlo.app`). DNS records (SPF TXT, DKIM CNAME × Resend's set, bounce MX) live on the subdomain. Keeps the apex clean for future Google Workspace / marketing senders / inbound mail.
- **D-04:** From local-part = **`noreply@`** → full From: `noreply@mail.horlo.app`.
- **D-05:** Display name = **`Horlo`** → inbox shows `Horlo <noreply@mail.horlo.app>`.
- **D-06:** **No Reply-To header**. Replies bounce off `noreply@`. Matches the address semantics. Future support@ inbox is out of scope.

### Round-Trip Verification Gate (between SMTP-02 and SMTP-03)
- **D-07:** Verification gate = **both** of:
  1. Supabase Dashboard → Auth → SMTP Settings → "Send test email" succeeds.
  2. A throwaway end-to-end signup against prod (using a real Gmail address you control) completes — confirmation email arrives, the link in the email opens `/auth/confirm` correctly, and the account becomes confirmed.

  Both must pass before flipping Confirm-email ON. Dashboard test alone catches credential errors; end-to-end signup catches link/template/site-URL errors.
- **D-08:** Minimum receiver gate = **Gmail must inbox (not spam)**. iCloud / Outlook are nice-to-have signal but not blockers for SMTP-03.
- **D-09:** **If the test email lands in spam, block the flip.** Investigate DKIM/SPF/DMARC alignment first. Spam-foldering on a fresh-verified Resend domain almost always means a misconfigured DNS record or missing DMARC policy — fix root cause, then retry the gate. Do not "flip and monitor" as the recovery strategy.

### Claude's Discretion
- **Backout-plan structure** — User did not select this gray area for discussion. Planner has discretion. Sensible defaults: backout doc lives as a new subsection in `docs/deploy-db-setup.md` (likely after Step 0 since that's where the email-confirmation footgun is documented today). Triggers should include: (1) DKIM verify regresses, (2) Resend account suspended/throttled, (3) deliverability incident on `mail.horlo.app`. Revert procedure: toggle Confirm-email OFF in Supabase Dashboard, restore Supabase hosted SMTP creds, communicate via PROJECT.md Key Decisions update.
- **Plan structure / DNS lead-time gating** — Planner has discretion on whether to split DNS submission and post-verification wiring into separate plans (with an explicit "DNS-propagated checkpoint" between them) or one plan with internal wait gates. DNS propagation can take hours; the plan must NOT block on a synchronous wait but should clearly separate "submit DNS" from "wire SMTP creds."
- **Site URL / redirect URL audit** — Before flipping, confirm Supabase Dashboard → Auth → URL Configuration has `https://horlo.app` as Site URL and the right redirect URLs whitelisted. The plan should include a verification step here even though it isn't a discussed decision — this is the exact category of misconfiguration D-07's end-to-end test catches.
- **Email template content** — Use Supabase defaults (deferred to SET-14 per REQUIREMENTS.md). Do not branding-customize templates in this phase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Specs / ADRs
- `.planning/ROADMAP.md` § "Phase 21: Custom SMTP via Resend" (lines ~186–198) — Goal, dependencies, success criteria.
- `.planning/REQUIREMENTS.md` § "Email / Custom SMTP" (lines 88–97) — SMTP-01 through SMTP-06 acceptance criteria.
- `.planning/PROJECT.md` Key Decisions table — `Email confirmation OFF` row that this phase flips to ON; carryover note in milestone summary.
- `.planning/STATE.md` — current v4.0 milestone status, project ref `wdntzsckjaoqodsyscns`.

### Operational Runbooks (touch points)
- `docs/deploy-db-setup.md` § Step 0 "Disable email confirmation (personal-MVP posture)" + "Footgun T-05-06-SMTPRATE" — current state of the email-confirmation toggle and the rate-limit footgun this phase resolves. **The backout-plan section (SMTP-05) is appended to this file.**
- `docs/phase-completion-checklist.md` — drizzle↔supabase parity; not directly affected since this phase has no schema changes, but the phase-completion checklist is the canonical pre-merge gate.

### External (Vendor) Docs — read at research-phase
- Resend domain verification + DNS records: https://resend.com/docs/dashboard/domains/introduction
- Resend SMTP credentials: https://resend.com/docs/send-with-smtp
- Supabase Auth custom SMTP: https://supabase.com/docs/guides/auth/auth-smtp
- Supabase Auth email change flow (Phase 22 dependency): https://supabase.com/docs/guides/auth/auth-email#email-change

### Memory References
- `~/.claude/projects/-Users-tylerwaneka-Documents-horlo/memory/project_drizzle_supabase_db_mismatch.md` — DB migration rules (not directly invoked here since no schema changes, but reminder that prod is `wdntzsckjaoqodsyscns`).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`/auth/confirm/route.ts`** — Supabase confirmation handler already exists from v1.0 auth scaffolding (AUTH-01..04). The flip from "no confirmation" to "confirmation required" exercises this route end-to-end for the first time in production. No code changes needed; just verify the route's existing behavior under D-07's end-to-end test.
- **Existing signup/signin Server Actions** — Already wired for Supabase Auth in `src/app/actions/`. They will trigger Supabase to send the confirm email once the toggle is ON. No code changes.

### Established Patterns
- **Supabase Dashboard as source of truth for Auth config** — All Auth toggles (Confirm email, Secure password change, Secure email change) live in dashboard, not in code. This phase changes dashboard state, not codebase state. Plans should be runbook-style ("open Supabase Dashboard → ..."), not file-edit-style.
- **DNS records at the registrar** — Domain `horlo.app` is registered externally (Cloudflare/Vercel/Namecheap — confirm during research). DNS edits are a manual step, not a CLI step. Plans should reference "your DNS provider" rather than assume a specific UI.
- **Footgun documentation pattern** — `docs/deploy-db-setup.md` already uses `**Footgun T-05-06-SMTPRATE:**` as a callout pattern. The new backout-plan section should follow the same pattern (one named footgun + numbered steps).

### Integration Points
- **`src/proxy.ts` (auth gate)** — No changes. Auth gating already correctly routes unconfirmed users; flipping the dashboard toggle changes Supabase's behavior, not the proxy's.
- **Phase 22 dependency** — Phase 22 (Settings Restructure + Account Section) consumes this phase's SMTP wiring for the email-change flow (sends confirmation links to BOTH old and new addresses). Phase 22 cannot ship until Phase 21's SMTP is verified working.
- **Vercel preview deploys** — Continue pointing at prod Supabase per D-02. Any preview-URL signup will send a real Resend email post-flip. Document this in the backout-plan section so it doesn't surprise anyone debugging a preview later.

</code_context>

<specifics>
## Specific Ideas

- The full From line should render in inboxes as: **`Horlo <noreply@mail.horlo.app>`** (D-03 + D-04 + D-05 combined).
- The DNS-verify gate (SMTP-01) is the longest-lead-time step in the phase. Plan structure should let DNS propagate without blocking other prep work.
- Verification gate is non-negotiable: a green dashboard test ALONE is insufficient (D-07). The end-to-end Gmail signup must complete and inbox-not-spam before SMTP-03 flips.
- Backout doc lives in `docs/deploy-db-setup.md` (not a new file) — extends the existing email-confirmation/SMTP context already there.

</specifics>

<deferred>
## Deferred Ideas

- **SMTP-06 (staging sender separation)** — Deferred to a future phase that stands up a staging Supabase project. Phase 21 will update REQUIREMENTS.md to mark SMTP-06 as `Deferred — pending staging Supabase project` and document the rationale here.
- **Branded HTML email templates** — Already deferred to **SET-14** in REQUIREMENTS.md. Phase 21 uses Supabase defaults sent via Resend.
- **Vercel preview → staging Supabase split** — Out of scope for Phase 21 (D-02). Worth a future ROADMAP item once a staging Supabase project is on the table.
- **Bounce / complaint webhook handling** — Resend supports webhooks for bounce/complaint/delivered events. Not part of SMTP-01..06 and not urgent for personal-MVP. Defer until user volume justifies it.
- **Deliverability monitoring dashboard** — Resend's own dashboard suffices for now. Custom monitoring (alerts on bounce-rate spikes, etc.) deferred until volume warrants.
- **`support@horlo.app` mailbox / Reply-To routing** — D-06 says no Reply-To. Setting up a real support inbox is its own initiative.

</deferred>

---

*Phase: 21-custom-smtp-via-resend*
*Context gathered: 2026-04-30*
