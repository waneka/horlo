---
status: partial
phase: 41-account-danger-zone-branded-auth-emails-parallel-track
source: [41-VERIFICATION.md]
started: 2026-05-16T03:30:00Z
updated: 2026-05-16T03:30:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Cross-client email rendering
expected: Each of the three branded auth emails (Confirm signup, Reset Password, Change Email), when received at a real address, renders the Horlo wordmark and a single gold (`#DDA552`) CTA button correctly in Apple Mail iOS dark mode, Outlook (MSO), and Gmail web — no black CTA, no broken layout, 600px single-column.
result: [pending]

### 2. Supabase dashboard template status
expected: All three Supabase Auth email template slots (Confirm signup, Reset Password, Change Email Address) show the branded Horlo HTML in the dashboard — not the Supabase default template.
result: [pending]

### 3. DKIM / SMTP confirmation
expected: Triggering a live auth email still sends via Resend SMTP at `mail.horlo.app`; received-email headers carry the `mail.horlo.app` DKIM signature — unaffected by the template content changes.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
