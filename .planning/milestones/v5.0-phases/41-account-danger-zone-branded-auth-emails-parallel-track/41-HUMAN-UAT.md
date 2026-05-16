---
status: approved
phase: 41-account-danger-zone-branded-auth-emails-parallel-track
source: [41-VERIFICATION.md]
started: 2026-05-16T03:30:00Z
updated: 2026-05-16T15:50:00Z
milestone_close_approval: "2026-05-16 — operator approved at v5.0 milestone close; cross-client email rendering, Supabase dashboard install, and DKIM/SMTP checks accepted, not deferred"
---

## Current Test

[operator-approved at v5.0 milestone close 2026-05-16]

## Tests

### 1. Cross-client email rendering
expected: Each of the three branded auth emails (Confirm signup, Reset Password, Change Email), when received at a real address, renders the Horlo wordmark and a single gold (`#DDA552`) CTA button correctly in Apple Mail iOS dark mode, Outlook (MSO), and Gmail web — no black CTA, no broken layout, 600px single-column.
result: [approved — operator-accepted at v5.0 milestone close 2026-05-16]

### 2. Supabase dashboard template status
expected: All three Supabase Auth email template slots (Confirm signup, Reset Password, Change Email Address) show the branded Horlo HTML in the dashboard — not the Supabase default template.
result: [approved — operator-accepted at v5.0 milestone close 2026-05-16]

### 3. DKIM / SMTP confirmation
expected: Triggering a live auth email still sends via Resend SMTP at `mail.horlo.app`; received-email headers carry the `mail.horlo.app` DKIM signature — unaffected by the template content changes.
result: [approved — operator-accepted at v5.0 milestone close 2026-05-16]

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0

(passed = operator-approved at v5.0 milestone close 2026-05-16)

## Gaps
