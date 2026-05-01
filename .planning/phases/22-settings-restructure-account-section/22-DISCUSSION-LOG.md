# Phase 22: Settings Restructure + Account Section - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-30
**Phase:** 22-settings-restructure-account-section
**Areas discussed:** Section stubbing strategy, Email-change pending UX, Password re-auth flow, /auth/callback redirect map

---

## Section Stubbing Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Migrate working content now | Privacy + Notifications + Preferences embed today's content immediately. Profile + Appearance show "Coming in Phase 23" stubs. Zero functional regression. | ✓ |
| Stub everything but Account | All 5 non-Account tabs show "Coming soon"; existing /settings + /preferences functionality temporarily unreachable until Phase 23. Cleaner scope separation. | |
| Migrate Privacy + Notifications only | Privacy + Notifications get migrated; Preferences tab links out to /preferences (which redirects back). Compromise. | |

**User's choice:** Migrate working content now (Recommended)
**Notes:** Avoids functional regression; locks D-01 / D-02 / D-03 / D-04. Profile + Appearance get "Coming in Phase 23" stubs.

---

## Email-Change Pending UX

### Pending state location

| Option | Description | Selected |
|--------|-------------|----------|
| Inline persistent banner above email field | `role="status" aria-live="polite"` banner with "Confirmation sent to old@ and new@" copy. Email input shows OLD email until confirmed. Banner stays until `user.new_email` clears. | ✓ |
| Sonner toast on submit + inline note in field | One-shot toast + subtle muted "(pending change to new@…)" text below field. Less weight, lost on reload. | |
| Modal blocking dialog | Modal user must dismiss. Strong attention but blocks interaction; lost on reload. | |

**User's choice:** Inline persistent banner above email field (Recommended)
**Notes:** Locks D-05.

### Cancel + Re-request actions

| Option | Description | Selected |
|--------|-------------|----------|
| Re-request only | Banner exposes "Resend confirmation" button only. No explicit Cancel — to revert, submit a fresh email-change back to the original address. | ✓ |
| Cancel + Re-request both | Both actions; Cancel reverts pending change. More UX surface; each Cancel fires another pair of confirmation emails. | |
| Neither — informational only | User waits 24h for Supabase link expiry or resubmits the form. Minimal UI; worst typo recovery. | |

**User's choice:** Re-request only (Recommended)
**Notes:** Locks D-06.

### Double-change handling

| Option | Description | Selected |
|--------|-------------|----------|
| Allow it — Supabase replaces `new_email` | Supabase Auth natively overwrites pending `new_email` on second `updateUser({email})`. UI just submits and re-renders. | ✓ |
| Block with disabled form + "Cancel pending first" copy | Disable email input while pending; show explicit guidance. Adds UI state. | |

**User's choice:** Allow it — Supabase replaces `new_email` (Recommended)
**Notes:** Locks D-07. Matches platform behavior.

---

## Password Re-Auth Flow

### Stale-session detection

| Option | Description | Selected |
|--------|-------------|----------|
| Compute from `session.access_token` issued-at (JWT `iat`) | Decode JWT `iat` claim; compare against 24h threshold. Reflects most recent token refresh, not original session creation. | ✓ |
| Always require current password | Skip staleness check; every password change asks for current password. Strongest UX safety net but adds friction even for fresh sessions. | |
| Ask Supabase to enforce — catch reauth-required error | Don't compute; call `updateUser({password})` and surface dialog only if Supabase returns `reauthentication_needed`. Lets Supabase be source of truth. | |

**User's choice:** Compute from `session.access_token` issued-at (Recommended)
**Notes:** Locks D-08. Real footgun: `session.created_at` is original session time, not most recent refresh — JWT `iat` is the correct freshness signal.

### Dialog content

| Option | Description | Selected |
|--------|-------------|----------|
| Current password only | Single field. User is signed in; email is known. Calls `signInWithPassword({email: currentUserEmail, password})` to refresh, then `updateUser({password})`. | ✓ |
| Email + password | Both fields. Slightly more verifiable but Supabase binds session to user.id; email is functionally redundant. | |
| Supabase `reauthenticate()` nonce flow | Email a 6-digit nonce; user enters it. Strongest security but adds round-trip + email latency. | |

**User's choice:** Current password only (Recommended)
**Notes:** Locks D-09. `reauthenticate()` nonce considered and rejected — see CONTEXT.md deferred section.

### Behavior on NON-stale sessions (< 24h)

| Option | Description | Selected |
|--------|-------------|----------|
| Apply directly — no re-auth | Fresh sessions skip dialog; user enters new password + confirm in form, submits, done. Matches existing reset-password pattern. | ✓ |
| Always require current password regardless of staleness | Friction trade-off for stronger consistency; makes 24h threshold meaningless. | |

**User's choice:** Apply directly — no re-auth (Recommended)
**Notes:** Locks D-10.

---

## /auth/callback Redirect Map

### Type values handled

| Option | Description | Selected |
|--------|-------------|----------|
| Full 5-type map | signup → `/?status=email_confirmed`, recovery → `/reset-password`, email_change → `/settings#account?status=email_changed`, magiclink → `/?status=signed_in`, invite → `/signup?status=invited`. Covers every Supabase EmailOtpType. | ✓ |
| 3-type map only — signup, recovery, email_change | Only types horlo actively uses. magiclink + invite fall through to default `/`. Smaller surface; risk of re-touching this route later. | |

**User's choice:** Full 5-type map (Recommended)
**Notes:** Locks D-11. Type-safe via `EmailOtpType` import already in route.

### `next` query param override behavior

| Option | Description | Selected |
|--------|-------------|----------|
| `next` overrides for signup/recovery/magiclink only | `next` wins for those 3 if same-origin-relative. email_change ALWAYS lands on `/settings#account?status=email_changed`. invite uses type-default. | ✓ |
| `next` always overrides type-default when present | Single rule. Matches today. Risk: stale `next` on email_change link could bypass spec destination. | |
| `next` never overrides — type-default always wins | Drops `next` honoring entirely. Simplest. Risk: breaks deep-link return after auth. | |

**User's choice:** `next` overrides for signup/recovery/magiclink only (Recommended)
**Notes:** Locks D-12. email_change destination is part of SET-06 spec; never overridable.

### Success status surface

| Option | Description | Selected |
|--------|-------------|----------|
| URL `?status=` query param + Sonner toast | Read `?status=`, fire toast, strip param via `router.replace` so reload doesn't re-toast. Matches v3.0 hybrid pattern; toast-only for now (UX-06 enriches in Phase 25). | ✓ |
| URL `?status=` + inline aria-live banner only (no toast) | More accessible by default; less celebratory. | |
| URL `?status=` + both toast AND inline banner (UX-06 hybrid) | Belt-and-suspenders. Matches Phase 25 UX-06 exactly; risk of feeling redundant for short status messages. | |

**User's choice:** URL `?status=` query param + Sonner toast (Recommended)
**Notes:** Locks D-13. Hybrid pattern (UX-06) deferred to Phase 25; this phase establishes toast-only baseline. D-14 captures hash-preservation footgun: `router.replace(pathname + window.location.hash)`.

---

## Claude's Discretion

- **Profile tab content (D-19)**: User opted not to discuss; defaults to read-only stub showing displayName/username/avatar + "View public profile" link + "Profile editing coming soon" note. Phase 25 (or whichever phase owns UX-08) replaces with edit form.
- **Hash-routing implementation details (D-16/D-17/D-18)**: User opted not to discuss; planner's call within these constraints — non-standard `#tab?key=value` parser, default `#account` if no hash, `hashchange` listener for back/forward.
- **`/preferences` redirect implementation (D-15)**: Planner verifies Next.js 16 `redirect()` preserves URL fragments per RFC 7231; falls back to Client Component `useEffect` redirect if framework drops fragment.
- **Component file structure**: Illustrative names provided in CONTEXT.md `<code_context>` Integration Points; planner's call on final factoring (one big SettingsTabsShell vs. per-section subcomponents).

## Deferred Ideas

See CONTEXT.md `<deferred>` section. Highlights:
- Phase 23 owns SET-07..SET-12 + FEAT-07/08 (the actual section content beyond Account)
- Phase 25 owns UX-06 hybrid toast+banner
- v5+ owns SET-13 Danger Zone, SET-14 branded templates
- Magic-link signin flow + invite flow are mapped for future-proofing but no UI exposes them
