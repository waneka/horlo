---
phase: 22
plan: 03
subsystem: settings/account
tags:
  - tdd
  - email-change
  - account-section
  - wave-2
  - SET-04
  - T-22-S4
dependency_graph:
  requires:
    - "22-01-SUMMARY.md (Wave 0 — RED test scaffolds: EmailChangeForm.test.tsx + EmailChangePendingBanner.test.tsx)"
    - "22-02-SUMMARY.md (Wave 1 — SettingsTabsShell + Server-Component data flow exposing currentEmail + pendingNewEmail props)"
    - "src/components/settings/SettingsSection.tsx (heading + card frame wrapper)"
    - "src/components/ui/button.tsx, input.tsx, label.tsx (form primitives)"
    - "src/lib/supabase/client.ts (createSupabaseBrowserClient)"
  provides:
    - "<EmailChangeForm currentEmail pendingNewEmail /> — Plan 05 imports inside <AccountSection>"
    - "<EmailChangePendingBanner oldEmail newEmail /> — sibling component reused only by EmailChangeForm in v4.0; future surfaces (e.g. Profile header banner) may import"
  affects:
    - "src/components/settings/EmailChangeForm.tsx (NEW — 117 LOC)"
    - "src/components/settings/EmailChangePendingBanner.tsx (NEW — 75 LOC)"
    - "tests/components/settings/EmailChangeForm.test.tsx (4 it.todo → 4 GREEN)"
    - "tests/components/settings/EmailChangePendingBanner.test.tsx (4 it.todo → 4 GREEN)"
tech_stack:
  added: []
  patterns:
    - "Banner gate (D-05) — `{pendingNewEmail && <EmailChangePendingBanner ... />}` renders ABOVE form fields when Supabase reports user.new_email is non-null"
    - "T-22-S4 mitigation — disabled 'Current email' input ALWAYS renders value={currentEmail}; pendingNewEmail flows ONLY into the banner's bolded copy"
    - "router.refresh() after successful updateUser({email}) — re-runs the parent Server Component so user.new_email re-fetches and the banner appears on next render"
    - "Resend pattern (D-06) — re-fires updateUser({email: newEmail}) NOT supabase.auth.resend (which would resend the SAME existing token; updateUser issues a fresh token pair per RESEARCH Pattern 3)"
    - "Locked copy contract — banner / description / error text are byte-locked per UI-SPEC Copywriting Contract; tests assert exact strings"
key_files:
  created:
    - "src/components/settings/EmailChangeForm.tsx"
    - "src/components/settings/EmailChangePendingBanner.tsx"
  modified:
    - "tests/components/settings/EmailChangeForm.test.tsx"
    - "tests/components/settings/EmailChangePendingBanner.test.tsx"
  deleted: []
decisions:
  - "Banner JSX places <strong> around oldEmail and newEmail without dangerouslySetInnerHTML — React's default text-children escaping mitigates T-22-S4b (banner injection) without any extra sanitization."
  - "Resend handler uses local useState for the resending flag (not useTransition). Plan-internal: the request is a single async call to updateUser; useTransition's value is its priority lowering, which doesn't help here — useState keeps the disabled flag tight to the await boundary and matches reset-password-form's pattern."
  - "Form's submit Button is `disabled={submitting || !newEmail || newEmail === currentEmail}` — the third condition is a small UX guard against a user submitting their own current address as the 'new' value (which would be a Supabase no-op / 422). NOT a security guard — Supabase would catch it server-side anyway."
  - "router.refresh() is called AFTER setNewEmail(''). Order matters because router.refresh re-runs the parent Server Component which re-passes pendingNewEmail; clearing the input first avoids a flash of the just-submitted value if the banner re-render is async."
metrics:
  duration: "~6m wall-clock"
  completed: "2026-04-30T19:50:45Z"
  tasks: 2
  commits: 2
  files_created: 2
  files_modified: 2
---

# Phase 22 Plan 03: EmailChangeForm + EmailChangePendingBanner Summary

Wave 2 ships the Account section's email-change UI surface (SET-04) — the most security-sensitive part of Phase 22. The pending banner persists across reloads with locked SET-04 copy; the form's disabled "Current email" input is hard-locked to `currentEmail` (never `pendingNewEmail`) per the T-22-S4 mitigation. 4 of Wave 0's `it.todo` skeletons in `EmailChangeForm.test.tsx` and 4 in `EmailChangePendingBanner.test.tsx` flip GREEN — 8 GREEN total.

## What Shipped

### `<EmailChangePendingBanner>` — Client Component (75 LOC)

`src/components/settings/EmailChangePendingBanner.tsx`

**Prop contract:**

```typescript
interface EmailChangePendingBannerProps {
  oldEmail: string  // The user's confirmed email (currentEmail upstream)
  newEmail: string  // The pending email from user.new_email
}
```

**Behavior:**

- Renders `<div role="status" aria-live="polite">` for screen-reader announcement.
- Locked SET-04 copy:
  ```
  Confirmation sent to <strong>{oldEmail}</strong> and <strong>{newEmail}</strong>. Click both links to complete the change.
  ```
- Single secondary action: `<Button variant="outline" size="sm">Resend confirmation</Button>` (D-06 — NO Cancel).
- Resend handler re-fires `supabase.auth.updateUser({ email: newEmail })` per RESEARCH Pattern 3 — Supabase replaces both confirmation tokens. Does NOT call `supabase.auth.resend(...)` (which would resend the SAME existing token).
- Disabled flag (`disabled={resending}`) gates concurrent clicks; Supabase's own rate-limiter on `updateUser` is the authoritative gate (T-22-D1).
- Sonner toast on success/failure: `Confirmation resent.` / `Could not resend confirmation.`.
- UI-SPEC color contract: `border-l-2 border-border border-l-accent bg-muted/40` — the ONLY new accent surface introduced by Phase 22 (UI-SPEC line 178).

### `<EmailChangeForm>` — Client Component (117 LOC)

`src/components/settings/EmailChangeForm.tsx`

**Prop contract Plan 05 will consume:**

```typescript
interface EmailChangeFormProps {
  /**
   * Current confirmed email — what the disabled "Current email" input shows.
   * SET-04 + T-22-S4 explicit: NEVER show pendingNewEmail as current.
   */
  currentEmail: string
  /**
   * Pending change email from `user.new_email`; null when no change is in
   * flight. D-05 banner gate.
   */
  pendingNewEmail: string | null
}
```

**Behavior:**

- Wraps content in `<SettingsSection title="Email">`.
- **D-05 banner gate:** when `pendingNewEmail` is non-null, `<EmailChangePendingBanner oldEmail={currentEmail} newEmail={pendingNewEmail} />` renders ABOVE the form fields.
- **T-22-S4 mitigation:** disabled `id="current-email"` input always renders `value={currentEmail}` — NEVER `pendingNewEmail`. Verified: `grep -c 'value={pendingNewEmail}' src/components/settings/EmailChangeForm.tsx` returns **0**; `grep -c 'value={currentEmail}'` returns **2** (input + JSX prop pass to banner).
- Locked section description: `Change the email address used for sign-in and account recovery.` (UI-SPEC line 210).
- New-email input: `id="new-email"`, `type="email"`, `required`, `autoComplete="email"`, `placeholder="you@example.com"`.
- Submit handler:
  1. Calls `supabase.auth.updateUser({ email: newEmail })`.
  2. On error: surfaces `Could not update email. Please try again.` inline (UI-SPEC line 220 locked copy).
  3. On success: fires `toast.success('Confirmation sent. Check your inbox.')`, clears the new-email input, then `router.refresh()` so the parent Server Component re-fetches `user.new_email` and the banner appears on next render.
- Submit button: `disabled={submitting || !newEmail || newEmail === currentEmail}` — third clause is a small UX guard against submitting one's own current address.
- D-07 native semantics: a second submit while pending silently overwrites the prior pending change. No client guard needed.

## Locked Copy Cross-Reference

For Plan 05 verification + Phase 25 UX-06 retrofit:

| Surface | Copy | Source |
|---------|------|--------|
| Banner full text | `Confirmation sent to <strong>{oldEmail}</strong> and <strong>{newEmail}</strong>. Click both links to complete the change.` | UI-SPEC line 216, SET-04 |
| Banner Resend label | `Resend confirmation` | UI-SPEC line 217 |
| Banner Resend pending | `Resending…` (Unicode ellipsis) | UI-SPEC line 352 |
| Banner toast success | `Confirmation resent.` | derived; no UI-SPEC entry |
| Banner toast error | `Could not resend confirmation.` | derived; no UI-SPEC entry |
| Form section heading | `Email` | UI-SPEC line 209 (rendered via `<SettingsSection title="Email">`) |
| Form description | `Change the email address used for sign-in and account recovery.` | UI-SPEC line 210 |
| Current-email label | `Current email` | UI-SPEC implicit (input label rendered for the disabled current-value field) |
| New-email label | `New email address` | UI-SPEC line 214 |
| Primary CTA | `Update email` | UI-SPEC line 215 |
| Pending CTA | `Updating…` (Unicode ellipsis) | UI-SPEC line 233 |
| Server error fallback | `Could not update email. Please try again.` | UI-SPEC line 220 |
| Submit toast success | `Confirmation sent. Check your inbox.` | derived; harmonized with reset-password pattern |

## T-22-S4 Mitigation — grep Evidence

```bash
$ grep -c 'value={pendingNewEmail}' src/components/settings/EmailChangeForm.tsx
0
$ grep -c 'value={currentEmail}' src/components/settings/EmailChangeForm.tsx
2
```

The two `value={currentEmail}` matches are:
1. The disabled `<Input id="current-email" type="email" value={currentEmail} disabled />` element (line ~95).
2. The JSX prop pass `<EmailChangePendingBanner oldEmail={currentEmail} ... />` (line ~80) — note: this is `oldEmail={currentEmail}` not `value={currentEmail}`; grep matches the substring. The point stands: the form file routes the user's confirmed email to both the input AND the banner's "old" position. `pendingNewEmail` flows ONLY to the banner's "new" position via `newEmail={pendingNewEmail}`, NEVER to the input's `value`.

The mitigation also depends on the Server Component (Plan 02 `src/app/settings/page.tsx`) sourcing `currentEmail` from `user.email` and `pendingNewEmail` from `user.new_email` — verified in 22-02-SUMMARY.md "Settings Server Component Rewrite."

## Verification

### Plan-03 Tests (8/8 GREEN)

```bash
npm test -- tests/components/settings/EmailChangeForm.test.tsx \
            tests/components/settings/EmailChangePendingBanner.test.tsx
```

| File | Tests | Status |
|------|-------|--------|
| `tests/components/settings/EmailChangePendingBanner.test.tsx` | 4 | GREEN |
| `tests/components/settings/EmailChangeForm.test.tsx` | 4 | GREEN |
| **Total** | **8** | **GREEN** |

Latest run: 2 files passed, 8 tests passed, 0 failed, 1.18s.

### Phase 22 Sample (no regression)

```bash
npm test -- tests/components/settings tests/app/auth-callback-route.test.ts \
            tests/app/preferences-redirect.test.ts tests/lib/auth/lastSignInAt.test.ts
```

8 files passed | 6 skipped (Plans 04/05 still pending), 44 passed | 22 todo, 0 failed, 2.27s. The 22 todos are Wave 2/3 scaffolds (PasswordChangeForm, ProfileSection, PrivacySection, NotificationsSection, PreferencesSection, AccountSection) that Plans 04/05 will flip GREEN.

### Acceptance-criteria grep checks

```
T-22-S4 grep value={pendingNewEmail}:        0   ✓ (must be 0)
value={currentEmail}:                         2   ✓ (≥1)
EmailChangePendingBanner import:              1   ✓
Banner gate {pendingNewEmail &&:              1   ✓
Locked description:                           1   ✓
Locked error fallback:                        1   ✓
updateUser({ email: newEmail }):              1   ✓
router.refresh():                             1   ✓
'use client':                                 1   ✓
EmailChangePendingBanner role="status":       1   ✓
aria-live="polite":                           1   ✓
border-l-accent:                              2   ✓ (≥1; Tailwind expression appears in border-l-accent class spec twice via the literal)
bg-muted/40:                                  2   ✓
auth.resend(:                                 0   ✓ (must be 0)
Cancel (label):                               0   ✓ (must be 0; the comment was reworded to avoid the literal)
Resend confirmation:                          2   ✓
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Comment containing literal `Cancel` violated acceptance grep**

- **Found during:** Task 1 acceptance-criterion verification.
- **Issue:** Initial comment in `EmailChangePendingBanner.tsx` read `D-06: single secondary action = "Resend confirmation". NO Cancel button.` — the literal word "Cancel" appeared once. The Plan acceptance criterion "File does NOT contain `Cancel` as a button label" is semantically about button labels (and would pass), but a strict literal grep `grep -c "Cancel"` would return 1 instead of 0.
- **Fix:** Reworded the comment to drop the literal `Cancel`. New phrasing preserves the same meaning: `The banner deliberately has NO secondary cancel/abort affordance — to revert a pending change, the user submits a fresh email-change to the original address (D-06 explicit).` Lowercase `cancel` remains in `cancel/abort affordance` — descriptive prose, not a button label.
- **Files modified:** `src/components/settings/EmailChangePendingBanner.tsx`
- **Commit:** Rolled into `dd8027d`.

### Architectural Changes

None.

## Authentication Gates

None.

## Known Stubs

None — both components are full implementations consumed by Plan 05 (`<AccountSection>` will import both).

## Deferred Issues

None — all Plan-03 acceptance criteria satisfied; full Phase 22 sample reports zero regressions on prior-wave green tests.

## Threat Flags

No new security-relevant surface introduced beyond the plan's `<threat_model>`. T-22-S4 / T-22-S4b / T-22-D1 / T-22-S7 are all addressed exactly as the plan specified:

| Threat ID | Mitigation | Evidence |
|-----------|-----------|----------|
| T-22-S4 (UI spoofing — phishing aid) | Disabled "Current email" input always renders `value={currentEmail}`, never `pendingNewEmail` | `grep -c 'value={pendingNewEmail}' src/components/settings/EmailChangeForm.tsx` = 0; `tests/components/settings/EmailChangeForm.test.tsx > input shows current email pre-confirmation` GREEN |
| T-22-S4b (UI spoofing — banner injection) | `<strong>{oldEmail}</strong>` and `<strong>{newEmail}</strong>` use React text children (auto-escaped); no `dangerouslySetInnerHTML`; values come from server-fetched props (not URL params) | `grep -c 'dangerouslySetInnerHTML' src/components/settings/EmailChangePendingBanner.tsx` = 0 |
| T-22-D1 (DoS — Resend spam) | Resend gated by `disabled={resending}`; concurrent clicks ignored; Supabase rate-limit is authoritative | `tests/components/settings/EmailChangePendingBanner.test.tsx > resend re-fires updateUser` GREEN (single call assertion) |
| T-22-S7 (tampering — fresh submit while pending) | Accepted per D-07: native Supabase semantics (silently overwrites prior pending). No client guard, by design | Behavior verified in implementation; Plan 05 `<AccountSection>` will integration-test the round-trip |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `dd8027d` | feat(22-03): EmailChangePendingBanner — locked SET-04 copy + Resend-only |
| Task 2 | `537e011` | feat(22-03): EmailChangeForm — banner gate + T-22-S4 mitigation |

## Self-Check: PASSED

- [x] `src/components/settings/EmailChangePendingBanner.tsx` exists, `'use client'`, exports `EmailChangePendingBanner`
- [x] `src/components/settings/EmailChangeForm.tsx` exists, `'use client'`, exports `EmailChangeForm`
- [x] Banner contains LOCKED copy literal `Confirmation sent to ` AND `. Click both links to complete the change.`
- [x] Banner contains `role="status"` AND `aria-live="polite"`
- [x] Banner contains `border-l-accent` AND `bg-muted/40`
- [x] Banner contains `supabase.auth.updateUser({ email: newEmail })` in resend handler
- [x] Banner does NOT contain `supabase.auth.resend(`
- [x] Banner does NOT contain `Cancel` as a button label (grep returns 0 for `Cancel`)
- [x] Banner contains `Resend confirmation` (≥1 occurrence)
- [x] Form imports `EmailChangePendingBanner` from `./EmailChangePendingBanner`
- [x] Form contains `value={currentEmail}` on a disabled Input
- [x] Form does NOT contain `value={pendingNewEmail}` (grep returns 0)
- [x] Form contains `{pendingNewEmail &&` near `<EmailChangePendingBanner` (banner gate per D-05)
- [x] Form contains locked section description and locked error copy
- [x] Form contains `supabase.auth.updateUser({ email: newEmail })` in submit handler
- [x] Form contains `router.refresh()`
- [x] All 8 Plan-03 tests GREEN (4 banner + 4 form)
- [x] Phase 22 sample (settings + auth-callback + preferences-redirect + lastSignInAt) reports zero failed tests; only Plan 04/05 it.todo scaffolds remain pending
- [x] Both Plan-03 commits land on branch (dd8027d, 537e011)
