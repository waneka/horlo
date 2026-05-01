---
status: partial
phase: 22-settings-restructure-account-section
source: [22-VERIFICATION.md]
started: 2026-04-30T20:45:00Z
updated: 2026-04-30T20:45:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Email change end-to-end with real Resend SMTP
expected: On Account tab, submit a new email address; receive confirmation links at BOTH old and new addresses; banner copy "Confirmation sent to **old@** and **new@**. Click both links to complete the change." appears immediately; clicking the new-email confirmation link routes back through /auth/callback?type=email_change and lands on /settings#account?status=email_changed; the Sonner toast "Email changed successfully" fires; ?status=email_changed is stripped from the URL while #account is preserved.
result: [pending]

### 2. Password change fresh-session direct path
expected: Sign in fresh (within last 24h), navigate to Settings → Account, type a valid new password + matching confirm, click Update password. Password updates without dialog opening. Sonner toast "Password updated" appears. Subsequent login uses new password.
result: [pending]

### 3. Password change stale-session re-auth dialog flow
expected: Sign in, wait > 24h or manually expire session, then attempt password change. Dialog "Confirm your password" opens with locked copy "Re-enter your current password to continue.". Type wrong password → inline "Password incorrect." surfaces. Type correct password → dialog closes, password updates, toast "Password updated" fires.
result: [pending]

### 4. Visual layout — vertical-tabs shell on /settings
expected: Sidebar shows 6 tabs in canonical order (Account, Profile, Preferences, Privacy, Notifications, Appearance) with icons. Clicking a tab updates window.location.hash without page reload. Browser back/forward navigates between tabs. URL fragment shareable (e.g., /settings#preferences activates the Preferences tab on landing). Layout uses max-w-4xl wrapper. Mobile horizontal scroll on tab list.
result: [pending]

### 5. Legacy /preferences redirect
expected: Visiting /preferences in a browser returns 307 with Location /settings#preferences. SettingsTabsShell mount-time hash parser activates the Preferences tab. Saving a preference persists; on reload, the tab still shows the saved value (revalidatePath('/settings') effective).
result: [pending]

### 6. Email-change banner persists across reloads
expected: After submitting a new email, banner stays visible across page refreshes (Server Component re-fetches user.new_email). Resend confirmation button re-fires updateUser({email}) and surfaces "Confirmation resent." toast. Banner disappears once the user clicks BOTH confirmation links.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
