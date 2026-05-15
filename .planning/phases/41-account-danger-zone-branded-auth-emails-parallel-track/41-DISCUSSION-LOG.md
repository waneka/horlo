# Phase 41: Account Danger Zone + Branded Auth Emails - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-15
**Phase:** 41-account-danger-zone-branded-auth-emails-parallel-track
**Areas discussed:** Danger Zone modal flow, Type-to-confirm strings, Post-action destinations, Email template design + project location

---

## Danger Zone Modal Flow

### Modal architecture

| Option | Description | Selected |
|--------|-------------|----------|
| One shared component, parametrized | Single multi-step modal taking action type as a prop | |
| Two separate modals | Dedicated WipeCollectionModal + DeleteAccountModal | ✓ |

### Step order

| Option | Description | Selected |
|--------|-------------|----------|
| Warn → type-to-confirm → password → execute | Friction escalates step by step | |
| Warn → type-to-confirm + password on one step → execute | Confirm input + password combined on final step | ✓ |

### Re-auth relationship to PasswordReauthDialog

| Option | Description | Selected |
|--------|-------------|----------|
| New inline step, reuse the pattern | Copy signInWithPassword logic into the danger modal | ✓ |
| Reuse PasswordReauthDialog as-is | Open existing dialog (coupled to password-change use case) | |

**User's choice:** Two separate modals; Warn → combined confirm+password step → execute; new inline re-auth step reusing the pattern.
**Notes:** Existing PasswordReauthDialog is coupled to `pendingNewPassword` — pattern reuse, not component reuse.

---

## Type-to-Confirm Strings

### Confirm text

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed keyword per action | Type 'WIPE' / 'DELETE' | ✓ |
| Username for both | Type username for both actions | |
| Full sentence per action | Type 'delete my account' / 'wipe my collection' | |

### Match UX

| Option | Description | Selected |
|--------|-------------|----------|
| Disable execute button until exact match | Button disabled is the gate; no error state | ✓ |
| Allow submit, show inline error on mismatch | Button always clickable, inline error | |

**User's choice:** Fixed keywords WIPE / DELETE; execute button disabled until exact match.
**Notes:** Distinct keywords prevent muscle-memory carryover between flows.

---

## Post-Action Destinations

### Post-wipe

| Option | Description | Selected |
|--------|-------------|----------|
| Stay on /settings, success toast | Close modal, Sonner toast, stay on Account tab | ✓ |
| Redirect to empty collection view | Navigate to now-empty profile | |

### Post-delete

| Option | Description | Selected |
|--------|-------------|----------|
| Marketing landing page (/) | Sign out, redirect to public landing | ✓ |
| Dedicated goodbye page | New /goodbye route | |
| Login page | Redirect to /login | |

### Cascade UX

| Option | Description | Selected |
|--------|-------------|----------|
| No mention in UI, document in CONTEXT only | Modal copy focuses on user's own data | ✓ |
| Brief line in the warning step | Add multi-user-aware sentence | |

**User's choice:** Stay on /settings with toast after wipe; redirect to / after delete; cascade documented in CONTEXT only.
**Notes:** Single-user scale makes the notifications.actor_id cascade observationally inert.

---

## Email Template Design + Project Location

### react-email file location

| Option | Description | Selected |
|--------|-------------|----------|
| Top-level emails/ dir, build-excluded | Templates + render script at repo root, outside src/ | ✓ |
| Under scripts/ | scripts/emails/ to signal tooling | |
| Throwaway / not committed | Don't keep react-email sources in the repo | |

### Logo treatment

| Option | Description | Selected |
|--------|-------------|----------|
| Hosted image logo | <img> from horlo.app / CDN | |
| Text wordmark | Styled 'Horlo' text in brand color | ✓ (resolved after logo-gap finding) |

### Brand color

| Option | Description | Selected |
|--------|-------------|----------|
| Match the app's existing accent token | Pull primary/accent from globals.css | ✓ |
| You'll specify a hex | User provides exact hex | |

### CTA copy

| Option | Description | Selected |
|--------|-------------|----------|
| Action-specific labels | 'Confirm your email' etc. | ✓ |
| You decide | Claude picks during planning | |

**User's choice:** emails/ dir build-excluded; brand color from globals.css accent token; action-specific CTA labels. Logo initially chose "hosted image" but switched to text wordmark after the codebase scout found no logo asset exists.
**Notes:** Mid-discussion finding — `public/` contains only Next.js default SVGs, no Horlo logo. App accent is `oklch()`, which needs a hex fallback for email HTML.

---

## Claude's Discretion

- Warning-screen copy listing what gets destroyed.
- Wipe success toast wording.
- Email body copy and visual polish (within 600px single-column / wordmark / single-CTA constraints).
- Service-role Supabase client construction — none exists in `src/lib/supabase/` today.

## Deferred Ideas

- Hosted image logo for emails — adopt once a Horlo logo is designed.
- Account-delete cascade warning copy — revisit when a second user exists.
- Grace period / soft-delete for Delete Account — explicitly out of scope per SET-13.
