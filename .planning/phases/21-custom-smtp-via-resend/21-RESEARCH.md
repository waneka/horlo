# Phase 21: Custom SMTP via Resend - Research

**Researched:** 2026-04-30
**Domain:** Email deliverability ops — DNS records, Resend SMTP relay, Supabase Auth wiring, DKIM/SPF/DMARC alignment for Gmail inbox placement
**Confidence:** HIGH for ops mechanics; MEDIUM for "Send test email" feature behavior (verified missing); HIGH for the auth-side ripple risk (verified by reading signup-form.tsx)

## Summary

Phase 21 is an ops + config + docs phase with three external systems and zero source-code changes: Vercel-managed DNS at `horlo.app` (registrar/DNS provider verified — see Environment Availability), Resend (domain verification + SMTP relay), and Supabase Auth (custom SMTP wiring + three toggle flips). The deliverables are documented in CONTEXT.md and locked across D-01..D-09. Research focused on the **mechanical "how"** of each step plus the **non-obvious failure modes** that will surface during the verification gate (D-07).

Three findings reshape the planning shape and must be flagged before plan-time:

1. **Supabase has NO "Send test email" button.** [VERIFIED: github.com/orgs/supabase/discussions/36034] The feature is an open community request (April 2026, unfulfilled). D-07's "Supabase Dashboard → Auth → SMTP Settings → Send test email" step **does not exist as written**. The de-facto stand-in is to use the **Send Invitation** flow (Authentication → Users → Invite User), which sends a real templated email through the wired SMTP. This is the only Supabase-dashboard-driven email send that doesn't require an actual signup. D-07 should be reinterpreted: "Invite Test Email + Real Gmail end-to-end signup, both must inbox" — the invite is the closest thing to a connectivity smoke test.

2. **Flipping Confirm-email ON will break the existing signup form's redirect.** [VERIFIED: read `src/app/signup/signup-form.tsx`] The form's `handleSubmit` calls `supabase.auth.signUp()` and then unconditionally `router.push('/')`. With confirmations OFF, Supabase returns a session — the redirect works. With confirmations ON, Supabase returns `data.user` but **no session** until the email link is clicked — the form pushes a logged-out user to `/`, which `proxy.ts` will bounce back to `/login`, with no "check your email" UX in between. This is a Phase 21 pre-flight blocker, NOT a Phase 22 problem. Either (a) the plan amends signup-form.tsx with a "check your email" pending state, OR (b) the plan defers the Confirm-email flip until Phase 22 ships the proper UX. CONTEXT.md is silent on this; the planner needs explicit user input.

3. **Resend SMTP password = Resend API key.** [VERIFIED: resend.com/docs/send-with-smtp + dmarc.wiki/resend cross-confirmed] There is no separate "SMTP password" surface in Resend — the SMTP username is the literal string `resend` and the password is whatever API key you create at resend.com/api-keys. The API key IS shown only at creation time and cannot be retrieved later (standard Resend behavior — same as most SaaS API keys). For backout (D-09), this means: if you need to rotate the SMTP creds during a deliverability incident, you create a new API key, update Supabase Dashboard, and revoke the old one. There is no per-domain SMTP password concept.

**Primary recommendation:** Structure Phase 21 as **two plans separated by a DNS-propagation checkpoint** (per CONTEXT.md "Claude's Discretion" planning hint), with a dedicated mid-phase user-confirmation step on the signup-form-breakage question above. Plan 1 = "Add the domain at Resend + submit DNS records to Vercel + receive SMTP password." Plan 2 = "Wait for verified ✓ → wire Supabase SMTP → run verification gate → flip toggles → write backout doc." The signup-form question must be resolved before Plan 2 reaches the toggle flip.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Staging / Sender Reputation Isolation**
- **D-01:** SMTP-06 is **deferred** until a separate Supabase staging project exists. Phase 21 wires prod-only. REQUIREMENTS.md is updated to mark SMTP-06 as `Deferred — pending staging Supabase project`. The decision is captured here so a future phase can pick it up without re-litigating.
- **D-02:** Vercel **preview deployments continue to point at prod Supabase** after this phase. Any signup/recovery email sent from a preview URL will hit prod auth and send a real Resend email. This is a known constraint, not a problem to solve in Phase 21. Document it in the backout-plan section so anyone hitting unexpected emails from previews has the context.

**Resend Domain + Sender Identity**
- **D-03:** Verify the **subdomain `mail.horlo.app`** at Resend (not the apex `horlo.app`). DNS records (SPF TXT, DKIM CNAME × Resend's set, bounce MX) live on the subdomain. Keeps the apex clean for future Google Workspace / marketing senders / inbound mail.
- **D-04:** From local-part = **`noreply@`** → full From: `noreply@mail.horlo.app`.
- **D-05:** Display name = **`Horlo`** → inbox shows `Horlo <noreply@mail.horlo.app>`.
- **D-06:** **No Reply-To header**. Replies bounce off `noreply@`. Matches the address semantics. Future support@ inbox is out of scope.

**Round-Trip Verification Gate (between SMTP-02 and SMTP-03)**
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

### Deferred Ideas (OUT OF SCOPE)
- **SMTP-06 (staging sender separation)** — Deferred to a future phase that stands up a staging Supabase project. Phase 21 will update REQUIREMENTS.md to mark SMTP-06 as `Deferred — pending staging Supabase project` and document the rationale here.
- **Branded HTML email templates** — Already deferred to **SET-14** in REQUIREMENTS.md. Phase 21 uses Supabase defaults sent via Resend.
- **Vercel preview → staging Supabase split** — Out of scope for Phase 21 (D-02). Worth a future ROADMAP item once a staging Supabase project is on the table.
- **Bounce / complaint webhook handling** — Resend supports webhooks for bounce/complaint/delivered events. Not part of SMTP-01..06 and not urgent for personal-MVP. Defer until user volume justifies it.
- **Deliverability monitoring dashboard** — Resend's own dashboard suffices for now. Custom monitoring (alerts on bounce-rate spikes, etc.) deferred until volume warrants.
- **`support@horlo.app` mailbox / Reply-To routing** — D-06 says no Reply-To. Setting up a real support inbox is its own initiative.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SMTP-01 | `horlo.app` (per CONTEXT.md D-03: actually subdomain `mail.horlo.app`) verified at Resend with SPF + DKIM + bounce MX records added at registrar; "Verified ✓" badge confirmed before any code change | DNS Records section + DNS Provider section + Architecture Patterns "Plan 1" |
| SMTP-02 | Supabase Dashboard SMTP creds wired to `smtp.resend.com:465` with the Resend-issued password | Supabase SMTP Field Mapping section + Architecture Patterns "Plan 2" |
| SMTP-03 | Supabase "Confirm email" toggle is ON only after SMTP-01 + SMTP-02 land and a Supabase Auth test email round-trips successfully | Verification Gate section + Pitfall #1 (signup-form breakage) + Validation Architecture |
| SMTP-04 | Supabase "Secure password change" + "Secure email change" toggles are ON | Toggle Interactions section |
| SMTP-05 | Backout-plan section in `docs/deploy-db-setup.md` documents how to revert to Supabase hosted SMTP if DKIM fails post-flip | Backout Procedure section |
| SMTP-06 | `mail.staging.horlo.app` (staging) and `mail.horlo.app` (prod) are separated for sender-reputation isolation | **DEFERRED per D-01** — research focuses on mark-as-deferred mechanics, not wiring |
</phase_requirements>

## Standard Stack

This phase has no software dependencies (no `npm install`). The "stack" is the trio of external systems and the DNS layer between them.

### Core Systems

| System | Version / Tier | Purpose | Why Standard |
|--------|---------------|---------|--------------|
| Resend (SMTP relay) | Free tier (3,000 emails/month, 100/day in 2026) | DKIM-signed transactional email relay | Recommended in `docs/deploy-db-setup.md` Footgun T-05-06-SMTPRATE; used by Supabase's own integration docs [VERIFIED: resend.com/docs/send-with-supabase-smtp] |
| Supabase Auth Custom SMTP | Hosted Supabase (free tier) | Routes Supabase-issued auth emails (signup confirm, recovery, email change) through Resend instead of Supabase's 2/h shared SMTP | Built-in Supabase feature; no library install [VERIFIED: supabase.com/docs/guides/auth/auth-smtp] |
| Vercel DNS | Managed via Vercel Dashboard | DNS records for `mail.horlo.app` subdomain | Inferred from `.vercel/project.json` presence + `docs/deploy-db-setup.md` deployment posture; **must verify in Plan 1 first task** that `horlo.app` is on Vercel nameservers and not delegated to a registrar [CITED: vercel.com/docs/domains/managing-dns-records] |

### Resend SMTP Credentials (Universal — All Customers)

| Field | Value | Notes |
|-------|-------|-------|
| Host | `smtp.resend.com` | [VERIFIED: resend.com/docs/send-with-smtp] |
| Port | `465` (Implicit SSL/TLS) — preferred per CONTEXT.md SMTP-02 | Alternatives: `587` / `2587` (Explicit STARTTLS), `25` / `2465`. Many corp networks block 25/465 outbound; if Supabase shows connection errors, try 587 |
| Username | `resend` (literal string) | NOT an email address. Static for all Resend customers [VERIFIED: dmarc.wiki/resend, resend.com/docs/send-with-smtp] |
| Password | Resend API key (starts with `re_`) | Same key used for Resend's REST API. Created at resend.com/api-keys |

### Resend API Key Lifecycle

| Behavior | Detail | Implication |
|----------|--------|-------------|
| Visibility after creation | Shown ONCE at creation; cannot be retrieved later | [ASSUMED — standard SaaS API key behavior; not explicitly documented in scraped Resend pages but consistent with Resend changelog references to "permissions"] Plans must capture the key into a password manager or `.env` immediately. If lost, create a new key + update Supabase + revoke old. |
| Rotation | Create new → swap in Supabase Dashboard → revoke old | No "edit" surface; rotation = create+revoke. Important for backout (D-09). |
| Permissions | API keys can be scoped (Send / Full access) per resend.com/changelog/new-api-key-permissions | For SMTP relay, Send-only permission is sufficient and minimum-blast-radius. Use Send-only if available. |
| Per-domain vs per-account | Per-account (one API key works for all verified domains on the account) [VERIFIED: resend.com/docs/api-reference/api-keys/create-api-key] | Implication: if user has only `mail.horlo.app` verified, the key naturally only works for that From — but a future second domain (e.g., `mail.staging.horlo.app` per SMTP-06) can reuse the same key. Generally: prefer one API key per environment. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Resend | Postmark, AWS SES, Mailgun, SendGrid | All work with Supabase Custom SMTP. Resend chosen because it's developer-mailing-friendly, has clean DNS UX, and is explicitly featured in Supabase's own integration docs. Postmark has the best deliverability reputation but stricter compliance review. SES is cheapest at scale but has the worst onboarding (sandbox mode + production access request). |
| Custom SMTP at all | Just keep Supabase hosted SMTP | 2/h cap blocks any non-trivial signup volume. Already documented as the reason for this phase (Footgun T-05-06-SMTPRATE). |

## DNS Provider for `horlo.app`

[VERIFIED: read `.vercel/project.json`] The Vercel project is `prj_P4iBphaC8T3fWlFE3p4G9aGV5r1i` (team `team_5JDZzhdLfiAYJFfOd2iMXDFx`, project name `horlo`). [ASSUMED — must confirm at Plan 1 Task 1] DNS for `horlo.app` is managed at **Vercel** (Vercel Dashboard → Domains → horlo.app → DNS records). Vercel also acts as the registrar in many setups but a domain on `.app` TLD purchased through Google Domains / Squarespace / Namecheap may have nameservers pointed elsewhere.

**Plan 1 Task 1 must explicitly verify this before submitting any DNS records.** The procedure:

```bash
# Check authoritative nameservers
dig NS horlo.app +short

# Expected output for Vercel-managed: ns1.vercel-dns.com / ns2.vercel-dns.com
# If output shows Cloudflare / Squarespace / etc., DNS is NOT at Vercel — adjust plan accordingly
```

If Vercel-managed: records added in Vercel Dashboard → Domains → `horlo.app` → DNS records (or via `vercel dns add` CLI).
If elsewhere: records added at the actual DNS provider's UI; Vercel docs are not the right reference.

[CITED: vercel.com/docs/domains/managing-dns-records] Vercel default TTL is **60 seconds** which is unusually short and helpful for verification iteration.

## DNS Records for `mail.horlo.app` (Resend Subdomain Verification)

[VERIFIED: dmarc.wiki/resend + dmarcdkim.com/setup/how-to-setup-resend-spf-dkim-and-dmarc-records cross-confirmed; CITED: resend.com/docs/dashboard/domains/introduction]

Resend issues a record set when you click **Add Domain** in the Resend dashboard and enter `mail.horlo.app`. Exact values are dynamically generated and shown in the dashboard. The pattern is:

| # | Type | Name (host) | Value | TTL | Purpose |
|---|------|-------------|-------|-----|---------|
| 1 | TXT | `send.mail.horlo.app` | `v=spf1 include:amazonses.com ~all` | 60-3600 | SPF — authorizes Resend's underlying Amazon SES infrastructure to send for the domain |
| 2 | MX | `send.mail.horlo.app` | `feedback-smtp.<region>.amazonses.com` (priority 10) | 60-3600 | Bounce/complaint return path — required, NOT optional. Region is one of `us-east-1`, `eu-west-1`, etc. depending on where Resend assigned the domain |
| 3 | TXT | `resend._domainkey.mail.horlo.app` | `p=<long-public-key>` (full RFC 6376 DKIM record) | 60-3600 | DKIM — public key matched against signed mail. Long string; must be entered without whitespace/line breaks corruption |

**KEY UNKNOWNS** (must be confirmed at execution time, not at plan time):

- **Number of DKIM records**: research found conflicting signals. dmarc.wiki/resend implies one. Resend's own docs are silent on count. Some other relays (SendGrid, Mailgun) issue 2-3 DKIM CNAMEs. **Plan must enumerate ALL records the Resend dashboard displays** rather than hard-coding the count. [CONFIDENCE: MEDIUM]
- **Record type for DKIM**: Resend uses TXT (not CNAME) per dmarc.wiki and dmarcdkim.com sources. [CONFIDENCE: MEDIUM — search results showed mixed wording]
- **Subdomain naming convention**: Resend uses an additional `send.` prefix on the SPF and MX records (so the full host becomes `send.mail.horlo.app`). The DKIM record uses `resend._domainkey.` prefix. The "Custom Return Path" feature lets you change the `send` prefix to something else; default is fine. [CONFIDENCE: MEDIUM]
- **CNAME case-sensitivity**: DNS is case-INsensitive at the wire-protocol level (RFC 1035 §2.3.3) — Vercel and most providers normalize. Not a planning concern.

**Operational note:** Vercel DNS UI does NOT pre-suffix the apex domain — when adding a record, the "Name" field expects the leftmost label (e.g., `send.mail` or `resend._domainkey.mail`), not the FQDN. Mistakenly pasting the FQDN creates `send.mail.horlo.app.horlo.app`, which is a common footgun. [CITED: vercel.com/docs/domains/managing-dns-records]

## DMARC Posture (D-09 Spam-Foldering Risk)

[VERIFIED: powerdmarc.com 2026 article + dmarcian + Google Workspace help]

For a fresh-verified Resend subdomain to inbox at Gmail (D-08), the answer is **YES, set DMARC at this phase, even though Resend doesn't strictly require it**. Reasoning:

- Gmail's bulk-sender requirements (Feb 2024 → fully enforced Nov 2025) require **5,000+/day senders** to publish a DMARC policy of at least `p=none`. [CITED: support.google.com/a/answer/81126]
- Below 5,000/day, DMARC is RECOMMENDED but not required. Personal-MVP volume is well below this threshold. **However:** Gmail's spam classifier scores unauthenticated mail (no DMARC, even if SPF+DKIM pass) lower than authenticated mail at all volumes. [CITED: dmarcian.com/yahoo-and-google-dmarc-required]
- D-09 says "if test email lands in spam, block the flip and investigate DKIM/SPF/DMARC alignment first." The cheapest insurance against ever hitting that block is to publish DMARC `p=none` from day one.

**Recommended DMARC record** (TXT at `_dmarc.mail.horlo.app`):

```
v=DMARC1; p=none; rua=mailto:dmarc@horlo.app; aspf=r; adkim=r;
```

| Tag | Value | Why |
|-----|-------|-----|
| `v` | `DMARC1` | Required version tag |
| `p` | `none` | "Monitor mode" — failures don't bounce. Right starting posture; revisit `quarantine`/`reject` once you have a few weeks of `rua` aggregate reports showing only legitimate mail. |
| `rua` | `mailto:dmarc@horlo.app` | Aggregate report destination. **Important:** `rua` mailbox must EXIST or reports are silently dropped. If no inbox, omit the tag entirely (still valid DMARC) or use a free DMARC monitoring service like postmark's free tier. [ASSUMED — `dmarc@horlo.app` is hypothetical; if no apex MX is configured, this won't deliver. Plan should make this an explicit user decision.] |
| `aspf` / `adkim` | `r` (relaxed) | Resend uses relaxed alignment per dmarc.wiki/resend. `s` (strict) would FAIL because Resend's SPF identity is `amazonses.com`, not `mail.horlo.app`. Strict DKIM alignment is technically possible (DKIM domain matches `mail.horlo.app`) but `r` is safer for first deploy. |

**If the user has no apex DMARC inbox and doesn't want to set up dmarc reporting**, the simplest valid record is:

```
v=DMARC1; p=none;
```

This is enough to satisfy Gmail's "DMARC published" check without the complexity of report aggregation. [CITED: dmarcreport.com/blog/how-to-implement-dmarc-policy-for-gmail-and-google-workspace]

**This is a research recommendation, NOT a locked decision.** CONTEXT.md is silent on DMARC. The planner should add a question to the plan ("publish DMARC `p=none` at this phase, or defer to a future deliverability phase?") and proceed based on the user's answer.

## Supabase SMTP Field Mapping (Authentication → Emails → SMTP Settings)

[VERIFIED: supabase.com/docs/guides/auth/auth-smtp + resend.com/docs/send-with-supabase-smtp]

| Supabase Field | Phase 21 Value | Source |
|----------------|----------------|--------|
| Enable Custom SMTP | ON (toggle) | — |
| Sender name | `Horlo` | D-05 |
| Sender email | `noreply@mail.horlo.app` | D-04 |
| Host | `smtp.resend.com` | Resend universal |
| Port | `465` | CONTEXT.md SMTP-02 explicit. Implicit SSL/TLS. Plan B: `587` if Vercel/upstream blocks 465 outbound (rare, but possible). |
| Username | `resend` | Resend universal |
| Password | `re_<api_key>` (the Resend API key) | Created at resend.com/api-keys after domain verification ✓ |
| Min interval | leave default (Supabase free tier sets 1 second; "Min interval between emails being sent" is a per-recipient throttle, NOT a global rate limit) | [VERIFIED: supabase config.toml line 220 — `max_frequency = "1s"`] |

[VERIFIED: sendlayer.com/blog/supabase-custom-smtp + supabase.com/docs/guides/auth/auth-smtp] **Once Custom SMTP is enabled, Supabase imposes an initial rate-limit of 30 emails/hour** (configurable at Authentication → Rate Limits). This is 15x the hosted SMTP cap (2/h) — sufficient for personal-MVP — but the plan should explicitly check this rate limit field after wiring SMTP and bump it if the user expects bursty signup volume.

## "Send Test Email" Reality vs D-07

[VERIFIED: github.com/orgs/supabase/discussions/36034 — feature request, NOT shipped as of April 2026]

D-07's first verification step ("Supabase Dashboard → Auth → SMTP Settings → Send test email succeeds") **assumes a button that does not exist in the Supabase Dashboard**. This is documented as a community feature request (Discussion #36034, multiple supporters, no resolution).

**Substitute mechanism (closest equivalent):**

1. Supabase Dashboard → Authentication → Users → **Invite user**
2. Enter a real email address you control (Gmail recommended per D-08)
3. Click **Send invitation**

This sends a real templated invitation email through the wired SMTP and exercises the full path: credentials → Resend → DNS-signed delivery → recipient inbox. Failure modes surface as either a Supabase Dashboard error (credential issue) or a missing/spam'd email (DNS/deliverability issue).

**Why this is functionally equivalent to D-07 step 1:**
- Real templated send via custom SMTP ✓
- Bypasses signup flow → catches credential errors before any user-facing surface ✓
- Inbox/spam result is observable ✓
- Limitation: invite is a different template than signup-confirm, so it doesn't validate the `signup` template specifically — but D-07 step 2 (real Gmail end-to-end signup) covers that.

**Alternative substitute (if user dislikes inviting "test" users):** trigger a password reset for an existing dev account. `supabase.auth.resetPasswordForEmail()` with a known dev email exercises the same SMTP path with the `recovery` template. This is cleaner because it doesn't create a phantom user record but requires an existing user.

**Plan implication:** D-07 must be reworded in plan tasks to "Invite Test Email passes (Supabase invite flow) AND end-to-end signup passes" rather than "Send test email passes." Both clauses still gate the toggle flip — the spirit of D-07 is preserved; only the mechanism shifts.

## Supabase Auth Toggle Interactions (D-07 → Toggle Flip Ripple Effects)

### "Confirm email" Toggle ON

[VERIFIED: github.com/supabase/supabase/issues/29632 + supabase/discussions/8197]

| Aspect | Behavior | Phase 21 Implication |
|--------|----------|----------------------|
| Effect on **new signups** post-flip | `email_confirmed_at` stays NULL until user clicks confirmation link; user CANNOT sign in until confirmed | Existing signup-form.tsx breaks (see Pitfall #1) |
| Effect on **existing confirmed users** | None — `email_confirmed_at` already populated; sign-in continues working | No prod-user impact (current personal-MVP has 1-2 users, confirmed at create-time per pre-flip logic) |
| Effect on **existing unconfirmed users** | Documented bug: even with toggle ON, a user previously created with `email_confirmed_at = NULL` may not retroactively receive a confirmation prompt | [LOW RISK] Personal-MVP has no unconfirmed users (all current accounts created with toggle OFF → auto-confirmed). Plan should still include a `SELECT count(*) FROM auth.users WHERE email_confirmed_at IS NULL` pre-flight check. |
| Effect on **in-flight password reset / recovery** | No interaction — recovery flows operate on already-existing users by email lookup; not gated on confirmation toggle | Safe to flip during normal usage. |

### "Secure password change" Toggle ON

[CITED: supabase config.toml line 218 — `secure_password_change = false` is the local-dev default]

When ON: changing a password requires the user to have logged in within the last 24h (or re-authenticate via `signInWithPassword` immediately before `updateUser({ password })`). When OFF: any active session can change the password without re-auth.

| Aspect | Implication |
|--------|-------------|
| New behavior | Users with sessions older than 24h must re-enter password before changing it |
| Phase 21 ripple | Phase 22 (SET-05) will build the re-auth dialog UX. **Pre-Phase 22, there is no UI surface for changing password in this app** (verified: signup-form, login-form, forgot-password-form found; no in-app password-change form). So flipping this toggle is currently a **no-op for users** — only flips a stored Supabase Auth flag that Phase 22 will then exercise. |
| Email send implication | Supabase fires an "email_changed" notification email when a password change succeeds (configurable; opt-out is `notification.password_changed.enabled = false`). Default is enabled. Routes through the wired SMTP. |

### "Secure email change" Toggle ON

[CITED: supabase config.toml line 213-214 — `double_confirm_changes = true` (already TRUE in local-dev default)]

When ON: changing email requires confirmation links delivered to BOTH the old AND new email addresses. When OFF: only the new email gets a confirmation; old email is silently swapped.

| Aspect | Implication |
|--------|-------------|
| New behavior | Email-change attempt → 2 emails sent (one to old, one to new) → both must be clicked → email is swapped |
| Phase 21 ripple | Phase 22 (SET-04) builds the email-change UI ("Confirmation sent to both old@ and new@"). Same pre-Phase-22 reality: flipping this toggle today is a stored-flag flip; no current UI exercises it. |
| SMTP volume implication | Each email change = 2 emails. Stay well under the 30/h initial rate-limit. Personal-MVP volume is fine. |

### Toggle Order

The CONTEXT.md ordering (SMTP-03 = Confirm email; SMTP-04 = Secure password change + Secure email change) implies confirm-email flips BEFORE the secure toggles. This is correct and matters: "Secure email change" sends to BOTH addresses only if Confirm-email is also ON (the old-address email is the same OTP type as a signup confirm). Flipping Secure-email-change first while Confirm-email is OFF is a degenerate state worth avoiding.

**Recommended sequence (per plan):** Confirm email ON → verify it works end-to-end (D-07 already done) → flip Secure password change ON → flip Secure email change ON. Treat toggles 3 and 4 as a single quick step after toggle 1's gate has passed.

## Site URL & Redirect URL Audit (Claude's Discretion)

[VERIFIED: supabase.com/docs/guides/auth/redirect-urls + supabase.com/docs/guides/auth/auth-email-templates]

The confirmation link in the email is built by Supabase using the template `{{ .ConfirmationURL }}`. The template default expands to:

```
https://<project-ref>.supabase.co/auth/v1/verify?token=<token-hash>&type=<type>&redirect_to=<site-url-or-redirect-to>
```

The redirect target after Supabase processes the token is **the Site URL** unless an explicit `emailRedirectTo` was passed at signup time. In this codebase, `signup-form.tsx` does NOT pass `emailRedirectTo` (verified: `await supabase.auth.signUp({ email, password })` with no second argument).

**Therefore:** the Site URL setting in Supabase Dashboard → Authentication → URL Configuration must be `https://horlo.app` (NOT `localhost:3000`, NOT `https://horlo.app/`, trailing-slash-sensitive in some Supabase versions).

**Per-link redirect:** The default Supabase email template hits `/auth/v1/verify` first, then redirects to the Site URL. There is NO call to `/auth/confirm` in this codebase's signup flow today — the existing `/auth/callback/route.ts` handles `verifyOtp` from email links (verified by reading the file). The confirmation link URL pattern depends on whether Supabase's default email template is in use (which routes through `/auth/v1/verify` server-side) or a custom template (which routes through `/auth/confirm` or similar).

**Phase 21 recommendation:**
1. Verify Site URL = `https://horlo.app` (no trailing slash) BEFORE flipping Confirm-email.
2. Verify Redirect URL allow-list includes `https://horlo.app`, `https://horlo.app/**`, AND any Vercel preview pattern (e.g., `https://horlo-*.vercel.app/**`) — preview deploys WILL trigger signup emails per D-02.
3. Audit the email templates at Authentication → Email Templates. Default templates use `{{ .ConfirmationURL }}` which routes through Supabase's `/auth/v1/verify` (not the local `/auth/callback` route). The end-to-end signup test in D-07 must verify the round trip lands on `horlo.app/` (Site URL fallback) with a session cookie set, NOT on `localhost` or a 404.

This audit is in CONTEXT.md "Claude's Discretion" — the plan MUST include an explicit verification task even though no decision was discussed.

## Architecture Patterns

### Recommended Plan Structure: Two Plans + Mid-Phase User Confirmation

CONTEXT.md "Claude's Discretion" allows splitting the phase. Given DNS propagation lead time (up to 24h per Vercel docs, typically 30 minutes - 4 hours in practice) AND the signup-form-breakage question (Pitfall #1) that needs user input, recommend **two plans + a hard gate between them**:

```
Plan 21-01: "Submit DNS records + receive Resend SMTP password" (no synchronous wait)
  Wave 1: Verify DNS provider for horlo.app (`dig NS horlo.app`)
  Wave 1: Add domain at Resend → receive record set
  Wave 1: Submit DNS records to Vercel (or whichever provider)
  Wave 2: Decide on DMARC posture (planner question to user)
  Wave 2: Submit DMARC TXT (if user opts in)
  Wave 2: Create Resend API key (Send-only scope) → store in password manager
  Wave 2: Resolve signup-form-breakage question (planner question to user — see Pitfall #1)
  EXIT GATE: Resend dashboard shows "Pending verification" for all records (acknowledges receipt; verification is asynchronous)

Plan 21-02: "Verify ✓ → wire Supabase SMTP → run gate → flip toggles → write backout doc"
  Wave 1: Confirm Resend dashboard shows "Verified ✓" (manual checkpoint — may require returning hours later)
  Wave 1: Wire Supabase SMTP (Dashboard → Auth → SMTP Settings)
  Wave 1: Audit Site URL + Redirect URL allow-list
  Wave 2: Run verification gate D-07 (invite test + real Gmail signup)
  Wave 2: Confirm Gmail inboxed (D-08) — if spam, escalate to D-09 path; do NOT proceed
  Wave 3: Flip Confirm email ON
  Wave 3: Flip Secure password change ON, Secure email change ON
  Wave 3: Append backout doc to docs/deploy-db-setup.md
  Wave 3: Update PROJECT.md Key Decisions (Email confirmation OFF → ON)
  Wave 3: Mark SMTP-06 deferred in REQUIREMENTS.md
```

**Why this shape:**
- Plan 21-01 is fast (15-30 min real work) but ends with an asynchronous wait the team cannot control.
- Plan 21-02 cannot start until Resend shows ✓. Putting all of 21-02's work in a single plan keeps the verification + flip + backout-doc steps atomically reviewable.
- The mid-phase user-confirmation step (signup-form-breakage) lives in Plan 21-01 because it must be resolved before Plan 21-02 reaches the toggle flip.

### Pattern 1: Runbook-Style Plan Tasks

Per CONTEXT.md `code_context` "Established Patterns": Supabase Dashboard is source of truth for Auth config; DNS is at the registrar; this is a runbook phase, not a code-edit phase. Tasks should look like:

```markdown
## Task 21-01-3: Add DNS records to Vercel
1. Open Vercel Dashboard → Domains → horlo.app → DNS records
2. For each record from Resend dashboard:
   - Click "Add" → Type: TXT/MX → Name: <leftmost label only, NOT FQDN> → Value: <copy from Resend> → TTL: 60
3. Verify in Vercel UI that records appear in the list
4. (No CLI verification — DNS propagation is asynchronous; checkpoint is at start of Plan 21-02)
```

NOT:

```markdown
## Task 21-01-3: Add DNS records  ← BAD: too vague
- Edit DNS file
- Save
```

### Pattern 2: Footgun Callouts in Backout Doc

[VERIFIED: read `docs/deploy-db-setup.md` — pattern `**Footgun T-XX-NNNN:**` with named codes is the codebase standard]

The backout-plan section appended to `docs/deploy-db-setup.md` should follow the existing pattern. Suggested structure:

```markdown
## Phase 21 — Custom SMTP via Resend Backout

If DKIM regresses, deliverability tanks, or Resend account is suspended, follow this procedure to restore Supabase hosted SMTP. Estimated downtime: 5 min from incident detection to restoration.

**Footgun T-21-PREVIEWMAIL:** [D-02] Vercel preview deployments share prod Supabase. Any signup from a preview URL sends a real Resend email at production sender reputation cost. If a preview deploy triggers spam complaints, this Phase 21 can be regressed.

### Backout triggers
- DKIM "Verified ✓" regresses to "Pending"
- Resend account suspended/throttled
- Bulk spam complaints on mail.horlo.app
- > 10% bounce rate over 24h

### Backout procedure
1. Supabase Dashboard → Authentication → Sign In/Providers → Email → toggle "Confirm email" OFF (incoming signups can land without confirmation; existing confirmed users unaffected)
2. Supabase Dashboard → Authentication → Emails → SMTP Settings → toggle "Enable Custom SMTP" OFF (reverts to Supabase hosted SMTP, 2/h cap restored — acceptable during incident response since Confirm-email is OFF)
3. Update PROJECT.md Key Decisions: `Email confirmation ON → OFF (regressed YYYY-MM-DD due to <reason>)`
4. Investigate Resend dashboard → Domain → DNS records (typical regression cause: DNS provider changed records; re-confirm Vercel records match Resend's expected values)

### Backout footgun (not an action — context)
The Resend API key remains valid after Supabase SMTP is disabled. To fully sever the integration, delete the API key at resend.com/api-keys. For incident-response posture, leave the key in place (faster rollback to ON when issue resolved).
```

### Anti-Patterns to Avoid

- **Synchronous DNS-propagation polling in tasks.** A task that polls `dig +short` in a loop will block the planner for hours. DNS propagation is the textbook async-work boundary. Use plan-level gates (Plan 21-01 → wait → Plan 21-02), not task-level loops.
- **Hard-coding DKIM record count.** Multiple sources gave conflicting signals on whether Resend issues 1, 2, or 3 DKIM records. The plan should say "enumerate ALL records the Resend dashboard displays" not "submit the 3 records."
- **Treating "Send test email" button as if it exists.** D-07 step 1 must be reworded to invite-flow or password-reset-flow. Don't lead the user into the dashboard hunting for a button that isn't there.
- **Flipping all 3 Auth toggles in one Wave.** Confirm-email is the riskiest flip (it's the one that breaks signup-form.tsx). Isolate it from the secure-change toggles so a Confirm-email rollback is surgical.
- **Editing the email template.** Per CONTEXT.md, templates are deferred to SET-14. Don't customize during this phase.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DKIM signing | Custom DKIM signer | Resend's built-in DKIM (auto-configured at domain verification) | DKIM is RFC 6376 with subtle pitfalls (canonicalization, body hash, header field selection); using a relay's signing is the standard |
| SPF policy authoring | Hand-built SPF record | Use Resend's provided `v=spf1 include:amazonses.com ~all` exactly | SPF has a 10-DNS-lookup limit; Resend's record is engineered to fit |
| DMARC report aggregation | Custom inbox parser for `rua=` aggregate XML reports | A free DMARC monitoring service (Postmark's free tier, dmarcian, mxtoolbox) | DMARC aggregate reports are XML; parsing is non-trivial; free monitoring services exist |
| Email confirmation token verification | Custom token-handler route | Existing `/auth/callback/route.ts` (already wired) | Token verification is `supabase.auth.verifyOtp({ type, token_hash })` — already implemented in this codebase |
| SMTP retry / failover logic | Application-level retry queue | Supabase's built-in retry on its SMTP send (handled by goauth backend) | Supabase Auth handles SMTP failures internally with backoff; Resend itself handles SMTP-level transient failures |
| Bounce/complaint webhook ingestion | Custom webhook handler | Resend's built-in dashboard reporting (deferred per CONTEXT.md) | Bounce/complaint handling is its own architectural concern; deferred until volume warrants |

**Key insight:** This is a wiring phase, not a building phase. The work is operating three vendor systems via their UIs, not writing code. Hand-rolling at any layer is the wrong instinct.

## Common Pitfalls

### Pitfall 1: Confirm-email Flip Breaks Signup-Form Redirect (CRITICAL)

**What goes wrong:** [VERIFIED: read `src/app/signup/signup-form.tsx` lines 19-32]

```typescript
// signup-form.tsx (current code)
const { error: err } = await supabase.auth.signUp({ email, password })
if (err) {
  setError('Could not create account.')
  setLoading(false)
  return
}
// Email confirmations are off (D-09), so user is immediately logged in — navigate home
router.push('/')
router.refresh()
```

When Confirm-email is OFF, `signUp()` returns `{ data: { user, session }, error: null }` with a populated session — `router.push('/')` succeeds because the user is logged in.

When Confirm-email is ON, `signUp()` returns `{ data: { user, session: null }, error: null }` — `router.push('/')` fires anyway, hits `/`, `proxy.ts` sees no session, redirects to `/login`. The user never sees a "check your email" message and is left confused on the login screen wondering why their account didn't work.

**Why it happens:** The form was written under personal-MVP assumptions (CONTEXT.md says signup-form references "(D-09)" but that was an old phase decision; the code is stale relative to Phase 21's intended state).

**How to avoid (planner must choose ONE):**

A. **Amend signup-form.tsx within Phase 21** — add a "check your email" pending state when `data.session === null`. ~15 LOC change. Phase 21 stops being a pure "no source-code changes" phase but the change is minimal and self-contained.

B. **Defer Confirm-email flip until Phase 22** — Phase 22 (Settings Restructure + Account Section) is where signup/email-change UX is being rebuilt anyway. Phase 21 wires SMTP + verifies via the invite path + flips ONLY the Secure-password-change and Secure-email-change toggles (which currently have no UI surface and are no-ops). SMTP-03 then becomes "verified working but toggle flip deferred to Phase 22."

C. **Flip Confirm-email and accept broken signup UX for the period between Phase 21 and Phase 22 ship.** Tolerable only if no new signups are expected in that window (personal-MVP, single user — feasible).

**This is THE central planning question of Phase 21 and must be resolved before plan tasks are written.** CONTEXT.md is silent — recommend planner adds it as a "must escalate to user" item in the plan.

**Warning signs:** Tasks that say "Flip Confirm-email ON" without an adjacent task for signup-form.tsx amendment OR a plan-level note that signup is expected to break.

### Pitfall 2: DNS Records Entered with FQDN Instead of Leftmost Label

**What goes wrong:** Vercel DNS UI's "Name" field expects only the leftmost label(s). Entering `send.mail.horlo.app` (full FQDN) creates `send.mail.horlo.app.horlo.app` — the trailing apex is auto-appended.

**Why it happens:** Resend's dashboard often shows the full FQDN (`send.mail.horlo.app`) in copy-paste-friendly format. User instinct is "copy the whole string."

**How to avoid:** When adding to Vercel, "Name" field gets the leftmost portion only (`send.mail` for the SPF record on subdomain `mail.horlo.app`, `resend._domainkey.mail` for DKIM). Verify by hovering the saved record — Vercel shows the resolved FQDN and you can confirm it matches Resend.

**Warning signs:** Resend dashboard stays on "Pending" indefinitely; `dig TXT send.mail.horlo.app +short` returns empty, but `dig TXT send.mail.horlo.app.horlo.app +short` returns the value.

### Pitfall 3: Site URL Trailing Slash

**What goes wrong:** Setting Site URL to `https://horlo.app/` (trailing slash) instead of `https://horlo.app`. Some Supabase versions treat these differently; the trailing slash can produce `redirect_to=https://horlo.app//something` (double slash) which some browsers normalize and others don't, leading to flaky email-link redirects.

**Why it happens:** Browser address bar shows trailing slash; user copies from there.

**How to avoid:** Site URL = `https://horlo.app` (no trailing slash). Add `https://horlo.app/**` to Redirect URL allow-list (with the trailing wildcard).

### Pitfall 4: Resend API Key Lost After Creation

**What goes wrong:** Resend shows the API key once at creation. User dismisses the dialog without saving it. To wire Supabase SMTP, user creates a NEW key (works), but if they forget to revoke the previous "lost" key, it remains active and exfiltratable if it leaked anywhere.

**Why it happens:** UI urgency; "I'll save it later."

**How to avoid:** Plan task explicitly says "Save key to password manager BEFORE clicking the dismiss button. If you ever lose access to the key, create a new one and immediately revoke the old one at resend.com/api-keys."

### Pitfall 5: Gmail Spam-Foldering Even with SPF + DKIM Verified

**What goes wrong:** Resend shows "Verified ✓", DNS-passes-all-tests, Supabase Send-Invite sends successfully — but the email lands in Gmail's spam folder. D-09 requires blocking the flip.

**Why it happens:** Gmail's spam classifier is multi-signal:
- Lack of DMARC record (lower trust score) [HIGH probability]
- Brand-new domain (Gmail "warms up" trust over weeks of clean sending) [HIGH for fresh domains]
- "noreply@" pattern (lower engagement signal) [LOW]
- Email body content (Supabase default templates are technical-looking, not promotional — should be fine) [LOW]
- Sending IP reputation (Resend rotates pools; fresh customer pools have lower scores) [MEDIUM]

**How to avoid:**
1. Publish DMARC `p=none` BEFORE the first send (top recommendation; cheapest insurance).
2. If still spam-foldered, mark as "not spam" in Gmail, send 2-3 more test emails, often clears within hours.
3. If persistent (>1 day), the issue is upstream (Resend pool reputation) — open Resend support ticket. Do NOT flip Confirm-email until resolved.

**Warning signs:** D-07 step 2 (real Gmail signup) lands in spam folder. STOP. Per D-09, do not flip.

### Pitfall 6: Vercel Preview Email Bombardment

**What goes wrong:** Per D-02, Vercel preview deploys point at prod Supabase. Once Confirm-email is ON, every preview-URL signup attempt (e.g., from a developer testing a feature on `horlo-git-feature-branch.vercel.app`) sends a real Resend email at prod sender reputation cost.

**Why it happens:** D-02 explicitly accepts this constraint.

**How to avoid:** Document in the backout-plan footgun (T-21-PREVIEWMAIL). Operationally: developers should use `+suffix` Gmail aliases for preview testing (already established convention per `docs/deploy-db-setup.md` Step 4 footgun) and mentally treat preview signups as "real" sends.

### Pitfall 7: Inviting an Already-Existing Email at Verification Gate

**What goes wrong:** D-07 step 1 substitute (Send Invitation flow) uses Authentication → Users → Invite User. If you invite an email that already exists in `auth.users`, Supabase returns an error (or, in some versions, silently no-ops). The verification path appears to fail when the actual SMTP wiring is fine.

**Why it happens:** Developer reuses the same `+suffix` Gmail alias across multiple test rounds.

**How to avoid:** Use a fresh `+suffix` alias each verification attempt (`youremail+horlo-smtp-test1@gmail.com`, `+horlo-smtp-test2`, etc.). Delete invited test users from Authentication → Users between rounds.

### Pitfall 8: REQUIREMENTS.md Mark-as-Deferred for SMTP-06

**What goes wrong:** Phase 21 deliverable #7 says "REQUIREMENTS.md note that SMTP-06 (staging sender separation) is deferred." The current REQUIREMENTS.md table has `| SMTP-06 | Phase 21 — Custom SMTP via Resend | Pending |`. Naïve edit sets it to "Deferred" — but this loses the traceability to a future phase.

**How to avoid:** Edit pattern should preserve the row but reword status. Suggested:

```markdown
| SMTP-06 | Phase 21 — Custom SMTP via Resend | Deferred — pending staging Supabase project (see Phase 21 21-CONTEXT.md D-01) |
```

Mirror the language CONTEXT.md uses verbatim. Keeps the requirement traceable to its blocker.

## Code Examples

### Example 1: DNS Verification Probe

```bash
# Verify DNS provider for horlo.app
dig NS horlo.app +short
# Expected (if Vercel-managed):
#   ns1.vercel-dns.com.
#   ns2.vercel-dns.com.

# Verify Resend records propagated (run after submitting + waiting)
dig TXT send.mail.horlo.app +short
# Expected: "v=spf1 include:amazonses.com ~all"

dig MX send.mail.horlo.app +short
# Expected: "10 feedback-smtp.<region>.amazonses.com."

dig TXT resend._domainkey.mail.horlo.app +short
# Expected: long DKIM public key string

# Verify DMARC (if published)
dig TXT _dmarc.mail.horlo.app +short
# Expected: "v=DMARC1; p=none; ..."
```

### Example 2: Supabase Auth Test (no built-in button — substitute)

[VERIFIED: github.com/orgs/supabase/discussions/36034 — invite is the closest alternative]

**Via Supabase Dashboard:**
1. Authentication → Users → Invite User
2. Email: `youremail+horlo-smtp-test1@gmail.com`
3. Click Send invitation
4. Inbox check: should arrive within 10 seconds; check spam folder; verify From header shows `Horlo <noreply@mail.horlo.app>`

**Or via curl (admin API):**
```bash
curl -X POST 'https://wdntzsckjaoqodsyscns.supabase.co/auth/v1/invite' \
  -H "apikey: <SERVICE_ROLE_KEY>" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"email": "youremail+horlo-smtp-test1@gmail.com"}'
```

### Example 3: End-to-End Signup Verification (D-07 step 2)

```bash
# Pre-flip (Confirm-email still OFF):
# Browser: https://horlo.app/signup
# Email: youremail+horlo-e2e-test1@gmail.com
# Password: <new>
# Submit → should land on / (logged in) — confirms signup-form works pre-flip

# Post-flip (Confirm-email ON):
# Browser: https://horlo.app/signup
# Email: youremail+horlo-e2e-test2@gmail.com
# Password: <new>
# Submit → form behavior depends on Pitfall #1 resolution
# Inbox: confirmation email arrives within 30s
# Click confirm link → should hit horlo.app/auth/v1/verify → redirect to https://horlo.app/ with session
# Verify: refresh / — should show authenticated UI (not redirect to /login)
```

### Example 4: Backout Doc Pattern (preview)

```markdown
## Phase 21 — Custom SMTP via Resend Backout

If DKIM regresses, deliverability tanks, or Resend account is suspended, follow this procedure
to restore Supabase hosted SMTP. Estimated downtime: 5 min from incident detection to restoration.

**Footgun T-21-PREVIEWMAIL:** [D-02] Vercel preview deployments share prod Supabase.
Any signup from a preview URL sends a real Resend email at production sender reputation cost.

### Backout triggers
- DKIM "Verified ✓" regresses to "Pending" in Resend dashboard
- Resend account suspended/throttled (email from Resend support)
- Bulk spam complaints on mail.horlo.app
- > 10% bounce rate over 24h (visible in Resend dashboard)

### Backout procedure
1. Supabase Dashboard → Authentication → Sign In/Providers → Email → toggle "Confirm email" OFF
2. Supabase Dashboard → Authentication → Emails → SMTP Settings → toggle "Enable Custom SMTP" OFF
3. Update .planning/PROJECT.md Key Decisions: "Email confirmation ON → OFF (regressed <date> due to <reason>)"
4. Investigate Resend dashboard → Domain → DNS records; if records mismatch DNS provider state, re-sync

(Full pattern matches existing Step 0 / Footgun T-05-06-SMTPRATE structure.)
```

## State of the Art

| Old Approach | Current Approach (2026) | When Changed | Impact |
|--------------|-------------------------|--------------|--------|
| SPF + DKIM only | SPF + DKIM + DMARC `p=none` recommended for all senders, REQUIRED for >5,000/day to Gmail | Feb 2024 (announced); fully enforced Nov 2025 | Personal-MVP volume below threshold but DMARC still helps inbox placement |
| Custom DKIM signing per-app | Vendor-relayed DKIM (Resend, Postmark, SES) | ~2018+ | Hand-rolled DKIM is now anti-pattern outside email infra teams |
| Apex-domain From: addresses | Subdomain From: addresses for transactional vs marketing isolation | ~2020+ industry norm | CONTEXT.md D-03 follows current best practice |
| Hard-bounce / complaint webhooks | Vendor dashboards + auto-suppression | ~2022+ | Resend auto-suppresses on hard bounce; webhooks deferred per CONTEXT.md |
| Strict SPF alignment | Relaxed SPF alignment with strict DKIM (or relaxed DKIM with bounce-MX configured) | ~2020+ | Resend's `aspf=r adkim=r` defaults match this norm |

**Deprecated/outdated:**
- **`signup` and `magiclink` types in `verifyOtp`** [VERIFIED: supabase.com/docs/reference/javascript/auth-verifyotp] — deprecated in favor of `email`, `recovery`, `invite`, `email_change`. Existing `/auth/callback/route.ts` uses `EmailOtpType` (the union including the deprecated names) — works today but worth flagging for Phase 22 to clean up. Not a Phase 21 concern.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | DNS for `horlo.app` is managed at Vercel | DNS Provider | If managed elsewhere (Cloudflare, Squarespace, etc.), Plan 21-01 Task 1 verifies and pivots; mitigation = explicit `dig NS` step. LOW risk because mitigation is built in. |
| A2 | Resend issues TXT (not CNAME) DKIM records | DNS Records | If actually CNAME, planner just enumerates records the dashboard shows. Phase still ships. LOW risk. |
| A3 | Resend issues 1 DKIM record for the subdomain | DNS Records | If 2-3, the "submit DNS" step takes minutes longer. ZERO risk to phase outcome. |
| A4 | Resend API key is shown once at creation, not retrievable later | Resend API Key Lifecycle | Standard SaaS pattern, not explicitly verified in scraped docs. If actually retrievable, Pitfall #4 mitigation is unnecessary but not harmful. LOW risk. |
| A5 | Supabase "Confirm email" toggle does NOT retroactively prompt confirmed users | Toggle Interactions | Codebase has only confirmed users today; if behavior is different, only-impact is unexpected emails to existing users. LOW risk for personal-MVP. |
| A6 | Site URL trailing slash sensitivity is real in Supabase | Pitfall 3 | Anecdotal from forum posts; if not actually flaky, the "no trailing slash" recommendation is just safe. LOW risk. |
| A7 | Vercel auto-appends apex when "Name" field is set in DNS UI | Pitfall 2 | Documented behavior; verified once at execution time. LOW risk. |
| A8 | DMARC `p=none` is sufficient for Gmail inbox at personal-MVP volume | DMARC Posture | Industry consensus + 2026 documentation. If Gmail still spam-folds, D-09 path investigates. LOW risk because D-09 is the explicit fallback. |
| A9 | The "Send Invitation" flow exercises the full SMTP path equivalently to a hypothetical "Send test email" | "Send Test Email" Reality | Verified architecturally (both go through Auth's email sender). Risk = developer thinks invite isn't a "real" test and doubts the result. Mitigation: D-07 step 2 (real signup) is the second clause. LOW risk. |
| A10 | The `dmarc@horlo.app` mailbox doesn't exist (no apex MX configured) | DMARC Posture | If user has Google Workspace at `horlo.app`, the mailbox might exist or be addable. Plan should ASK user, not assume. MEDIUM risk if assumed wrong; LOW if asked. |

## Open Questions (RESOLVED)

> All five questions raised during research were resolved before plan-checker exit. Resolutions are mirrored in CONTEXT.md (D-10, D-11) and in plan task design (Plan 21-01 Task 1, Plan 21-02 Task 1, Task 5). Inline `RESOLVED:` markers below are the canonical decision-trace.

1. **Is `horlo.app` DNS at Vercel?**
   - What we know: `.vercel/project.json` exists; project is on Vercel.
   - What's unclear: whether the domain's nameservers point to Vercel DNS or a third-party DNS provider.
   - Recommendation: Plan 21-01 Task 1 runs `dig NS horlo.app +short` and pivots based on result.
   - **RESOLVED:** Plan 21-01 Task 1 runs `dig NS horlo.app +short` at execution time and pivots instructions based on the detected provider (no static assumption baked into the plan).

2. **Does the user want DMARC at this phase?**
   - What we know: Industry recommends it; Gmail prefers it; CONTEXT.md is silent.
   - What's unclear: User comfort with adding another DNS record + whether they have a destination for `rua` reports.
   - Recommendation: Planner asks user before Plan 21-01 Wave 2; default = `v=DMARC1; p=none;` (no rua) if user prefers minimum-friction.
   - **RESOLVED:** D-11 locked in CONTEXT.md (2026-04-30) — publish `_dmarc.mail.horlo.app` TXT = `v=DMARC1; p=none;` (monitor-only, no `rua=`) alongside SPF/DKIM in Plan 21-01 Task 2.

3. **Should signup-form.tsx be amended in Phase 21, or should the Confirm-email flip defer to Phase 22?** [CRITICAL — Pitfall #1]
   - What we know: Existing form unconditionally `router.push('/')` after `signUp()`; this breaks when Confirm-email is ON and signUp returns no session.
   - What's unclear: Whether user wants to (A) take a small in-phase code change, (B) defer the toggle to Phase 22, or (C) accept brief broken-signup UX.
   - Recommendation: Planner escalates to user. Default suggestion: option (B) — defer Confirm-email flip to Phase 22 — because Phase 22 is doing related auth UX work and a 1-2 week deferral matters less than splitting auth-UX work across two phases.
   - **RESOLVED:** D-10 locked in CONTEXT.md (2026-04-30) — option (A): amend `src/app/signup/signup-form.tsx` in Plan 21-01 Task 3 to detect `data.session === null`, render an in-card "Check your email to confirm your account" success state, and preserve the existing immediate-session `router.push('/')` redirect path for backward safety. Plan 21-02 Task 4 verifies the merge before flipping toggles.

4. **Number of DKIM records Resend issues for a subdomain in 2026?**
   - What we know: Sources gave conflicting signals (1 vs 2-3).
   - What's unclear: The actual count.
   - Recommendation: Plan task says "enumerate ALL records the Resend dashboard shows" — count doesn't matter operationally if you transcribe what you see.
   - **RESOLVED:** Plan 21-01 Task 2 instructs the executor to transcribe ALL DKIM records the Resend dashboard shows (1, 2, or 3). No hardcoded count assumption. Task 1 acceptance criteria capture the issued record set into `evidence/resend-record-set.png` for audit.

5. **Does Phase 21 update `supabase/config.toml` to mirror prod?**
   - What we know: `config.toml` lines 220, 213-218 control local-dev rate limits and toggle defaults. Local dev uses Inbucket (no real SMTP). Prod toggles are dashboard-only.
   - What's unclear: Whether the team wants local config to mirror prod state for testing parity.
   - Recommendation: NO config.toml changes in Phase 21. Local dev keeps `enable_confirmations = false` because Inbucket can't send real emails anyway, and changing the local default only blocks local signup testing without benefit. Document this in the plan as an explicit non-change.
   - **RESOLVED:** No `supabase/config.toml` changes in Phase 21 — local dev uses Inbucket (no real SMTP path); changing local defaults only blocks local signup testing without benefit. Plans do NOT modify `supabase/config.toml`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `dig` (DNS query CLI) | DNS verification probes (Plan 21-01 Task 1, Plan 21-02 Task 1) | ✓ macOS Darwin 24.6.0 | system | `nslookup` (built-in) |
| Vercel CLI | DNS record submission via CLI (alternative to dashboard) | ✓ documented in `docs/deploy-db-setup.md` Step 3c | per existing setup | Vercel Dashboard UI (no CLI needed) |
| Supabase CLI | Linked to prod project | ✓ per `docs/deploy-db-setup.md` Step 1 | 2.x | Supabase Dashboard UI (this phase mostly uses dashboard, not CLI) |
| Real Gmail account | D-07 step 2 (end-to-end signup verification) | [USER-OWNED] | — | iCloud / Outlook (D-08 says Gmail is the minimum gate; iCloud/Outlook are nice-to-have not blockers) |
| Browser with private window | D-07 step 2 + Site URL audit | ✓ | — | — |
| Password manager | Storing Resend API key safely (Pitfall #4) | [USER-OWNED] | — | `.env.local` (not committed; already in `.gitignore` per `docs/deploy-db-setup.md` Step 3b) |
| Vercel Dashboard access | DNS record submission (if Vercel-managed) | [USER-OWNED] | — | — |
| Resend account | Domain verification + API key creation | [USER-OWNED] | Free tier sufficient | — |
| Supabase Dashboard access | All toggle flips, SMTP settings, URL Configuration | [USER-OWNED] | — | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None — all primary tools available; user owns the accounts/access.

## Validation Architecture

> Phase 21 is an ops phase. "Validation" here is largely manual checkpoints (DNS verified, SMTP delivers, Gmail inboxed). The framework is conceptual — no test-runner involved.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual operational checkpoints (no automated test harness) |
| Config file | None |
| Quick run command | None — each task has an observable end state |
| Full suite command | None |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Verification Command / Observation Point | Pre-existing? |
|--------|----------|-----------|------------------------------------------|---------------|
| SMTP-01 | Domain `mail.horlo.app` Verified ✓ at Resend | Manual checkpoint | Resend Dashboard → Domains → mail.horlo.app → status badge shows "Verified ✓" | N/A — vendor dashboard |
| SMTP-01 | DNS records propagated | Automated probe | `dig TXT send.mail.horlo.app +short` returns SPF; `dig MX send.mail.horlo.app +short` returns Amazon SES feedback host; `dig TXT resend._domainkey.mail.horlo.app +short` returns DKIM public key | N/A — `dig` is system tool |
| SMTP-02 | Supabase SMTP wired correctly | Manual + observable | Supabase Dashboard → Auth → Emails → SMTP Settings shows host=smtp.resend.com, port=465, sender=noreply@mail.horlo.app, sender name=Horlo | N/A — vendor dashboard |
| SMTP-02 | SMTP credentials work | Functional smoke | Supabase Dashboard → Authentication → Users → Invite User → invite delivered to inbox; OR password reset triggered for existing dev account → email delivered | N/A — vendor dashboard |
| SMTP-03 | Confirm email ON | Manual + observable | Supabase Dashboard → Authentication → Sign In/Providers → Email → "Confirm email" toggle is ON | N/A — vendor dashboard |
| SMTP-03 | End-to-end signup works (D-07 step 2) | Manual functional | Browser private window → horlo.app/signup with fresh Gmail `+suffix` alias → confirmation email arrives in INBOX (not spam) → click link → land on horlo.app/ logged in | N/A — manual UAT |
| SMTP-03 | Gmail inboxes (not spam) (D-08) | Manual observation | Gmail inbox shows the message with no "Move to spam" warning banner | N/A — manual UAT |
| SMTP-04 | Secure password change ON | Manual + observable | Supabase Dashboard → Authentication → Sign In/Providers → Email → "Secure password change" toggle is ON | N/A — vendor dashboard |
| SMTP-04 | Secure email change ON | Manual + observable | Supabase Dashboard → Authentication → Sign In/Providers → Email → "Secure email change" toggle is ON | N/A — vendor dashboard |
| SMTP-05 | Backout doc appended | Automated + manual | `grep -q 'Phase 21 — Custom SMTP via Resend Backout' docs/deploy-db-setup.md` exits 0; manual review confirms procedure is correct | N/A — file inspection |
| SMTP-06 | Marked Deferred in REQUIREMENTS.md | Automated | `grep 'SMTP-06.*Deferred' .planning/REQUIREMENTS.md` returns the correct row | N/A — file inspection |

### Sampling Rate

This is an ops phase, not a code phase — there are no per-commit / per-wave / per-PR test runs. Validation happens at **plan-level gates**:

- **Plan 21-01 exit gate:** Resend dashboard shows "Pending verification" for all submitted records (acknowledges receipt). DNS records visible at Vercel UI. API key captured to password manager. Signup-form question resolved.
- **Plan 21-02 entry gate:** Resend dashboard shows "Verified ✓" (synchronous human checkpoint — may require returning hours later).
- **Plan 21-02 mid-gate (D-07):** Invite test passes + end-to-end Gmail signup inboxes (not spam).
- **Plan 21-02 exit gate:** All three toggles ON in dashboard; backout doc committed; PROJECT.md Key Decisions row updated; REQUIREMENTS.md SMTP-06 row updated.

### Wave 0 Gaps

- None — there is no test infrastructure to scaffold. The "tests" are dashboard observations and `dig` command outputs that are inherent to the systems being touched.

**Note:** This deviates from the Nyquist spirit (which prefers automated test runners) by necessity. Ops phases that wire vendor systems can't be unit-tested; the only reliable validation is end-to-end functional verification via the systems themselves. The plan should treat human-in-the-loop checkpoints as first-class verification.

## Project Constraints (from CLAUDE.md)

[VERIFIED: read `/Users/tylerwaneka/Documents/horlo/CLAUDE.md` and AGENTS.md]

| Directive | Source | Phase 21 Implication |
|-----------|--------|----------------------|
| Tech stack: Next.js 16 App Router, no rewrites | CLAUDE.md Constraints | No source edits planned anyway. Pitfall #1 amendment (if chosen) is < 20 LOC inside `signup-form.tsx`. |
| Personal first | CLAUDE.md Constraints | D-01 (defer SMTP-06) and D-02 (preview shares prod) align with personal-MVP posture. |
| <500 watches per user | CLAUDE.md Constraints | Not relevant to this phase (no DB writes). |
| GSD Workflow Enforcement: don't edit outside a GSD command | CLAUDE.md GSD section | Phase 21 IS a GSD phase; satisfied by planning + execution flow. |
| "This is NOT the Next.js you know" — read `node_modules/next/dist/docs/` before code | AGENTS.md | Informational only — Phase 21 has zero Next.js code (unless Pitfall #1 option A is chosen, in which case the signup-form change uses already-established patterns from the existing form). |
| Two-layer privacy (RLS + DAL) | PROJECT.md Key Decisions | Not directly relevant — no DB schema or DAL changes. |
| Drizzle migrations are LOCAL ONLY; prod uses `supabase db push --linked` | MEMORY.md `project_drizzle_supabase_db_mismatch.md` | Not directly relevant — no DB schema changes. |
| Phase-completion checklist is canonical pre-merge gate | `docs/phase-completion-checklist.md` | Phase 21 has no schema changes, so the drizzle↔supabase parity portion is a no-op. The checklist still applies for prod code/config deploy verification. |

No CLAUDE.md directive contradicts the planned approach.

## Sources

### Primary (HIGH confidence)
- [resend.com/docs/send-with-smtp](https://resend.com/docs/send-with-smtp) — SMTP credentials (host, port, username, password = API key)
- [resend.com/docs/send-with-supabase-smtp](https://resend.com/docs/send-with-supabase-smtp) — Step-by-step Supabase + Resend integration
- [supabase.com/docs/guides/auth/auth-smtp](https://supabase.com/docs/guides/auth/auth-smtp) — Custom SMTP fields, 30/h initial rate limit
- [supabase.com/docs/reference/javascript/auth-verifyotp](https://supabase.com/docs/reference/javascript/auth-verifyotp) — OTP types (email, recovery, invite, email_change)
- [supabase.com/docs/guides/auth/auth-email-templates](https://supabase.com/docs/guides/auth/auth-email-templates) — `{{ .ConfirmationURL }}` template variable, Site URL fallback
- [vercel.com/docs/domains/managing-dns-records](https://vercel.com/docs/domains/managing-dns-records) — Vercel DNS UI, default TTL=60, name field is leftmost label only
- [github.com/orgs/supabase/discussions/36034](https://github.com/orgs/supabase/discussions/36034) — "Send test email" button is feature request, NOT implemented (April 2026)
- [support.google.com/a/answer/81126](https://support.google.com/a/answer/81126) — Google sender requirements (DMARC required >5,000/day)

### Secondary (MEDIUM confidence)
- [dmarc.wiki/resend](https://dmarc.wiki/resend) — Resend SPF (`v=spf1 include:amazonses.com ~all`), MX, DKIM record patterns; relaxed alignment defaults
- [dmarcdkim.com/setup/how-to-setup-resend-spf-dkim-and-dmarc-records](https://dmarcdkim.com/setup/how-to-setup-resend-spf-dkim-and-dmarc-records) — MX priority 10, propagation up to 24h, recommended DMARC strict policy
- [github.com/supabase/supabase/issues/29632](https://github.com/supabase/supabase/issues/29632) — Confirm-email toggle does not retroactively allow existing unconfirmed users
- [github.com/orgs/supabase/discussions/8197](https://github.com/orgs/supabase/discussions/8197) — `email_confirmed_at` populated when toggle is OFF
- [powerdmarc.com/google-and-yahoo-email-authentication-requirements](https://powerdmarc.com/google-and-yahoo-email-authentication-requirements/) — 2026 enforcement timeline
- [dmarcian.com/yahoo-and-google-dmarc-required](https://dmarcian.com/yahoo-and-google-dmarc-required/) — `p=none` reputation scoring nuance
- [resend.com/docs/dashboard/domains/introduction](https://resend.com/docs/dashboard/domains/introduction) — Subdomain recommendation, SPF + DKIM + MX (CNAME unclear from page)
- [sendlayer.com/blog/supabase-custom-smtp-and-email-configuration-guide](https://sendlayer.com/blog/supabase-custom-smtp-and-email-configuration-guide/) — 30 emails/hour initial rate limit details

### Tertiary (LOW confidence — flagged for execution-time verification)
- DKIM record count for Resend (1 vs 2-3) — sources conflicted; planner enumerates dashboard output
- DKIM record type (TXT confirmed by 2 sources, but Resend's own docs use ambiguous "TXT/CNAME" wording)
- Whether `signup` template differs materially from `invite` template for D-07 verification — assumed equivalent for SMTP-path validation purposes

## Metadata

**Confidence breakdown:**
- Resend SMTP credentials & wiring: **HIGH** — multiple cross-confirmed sources (Resend docs + supabase docs + dmarc.wiki)
- DNS record exact values: **MEDIUM-HIGH** — pattern is well-known but exact records are vendor-generated; planner enumerates from Resend dashboard
- DKIM record count: **MEDIUM** — conflicting signals; mitigation = enumerate dashboard output
- Supabase Dashboard UX (Send Test Email button): **HIGH** — verified missing via official Supabase community discussion
- Signup form breakage post-flip (Pitfall #1): **HIGH** — verified by reading `src/app/signup/signup-form.tsx`
- Site URL trailing slash sensitivity: **MEDIUM** — anecdotal; safe pattern recommended either way
- DMARC policy recommendation: **HIGH** — 2026 industry consensus; minimum bar is `p=none`
- Backout procedure: **HIGH** — straightforward toggle-flip reversal; pattern matches existing `docs/deploy-db-setup.md`

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (vendor docs change frequently; re-verify if execution slips > 30 days)
