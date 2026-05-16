---
phase: 41-account-danger-zone-branded-auth-emails-parallel-track
plan: 03
subsystem: ui/settings/danger-zone
tags: [danger-zone, destructive-modals, type-to-confirm, re-auth, client-island]

# Dependency graph
requires:
  - phase: 41-account-danger-zone-branded-auth-emails-parallel-track
    plan: 01
    provides: "RED test scaffolds for WipeCollectionModal + DeleteAccountModal"
  - phase: 41-account-danger-zone-branded-auth-emails-parallel-track
    plan: 02
    provides: "wipeCollection + deleteAccount server actions"
provides:
  - "WipeCollectionModal: 2-step, WIPE-gated, re-auth-then-wipe, Sonner toast"
  - "DeleteAccountModal: 2-step, DELETE-gated, re-auth-then-delete, sign-out + redirect to /"
  - "DangerZoneSection: client island composing both modals + trigger buttons"
  - "AccountSection.tsx: DangerZoneSection appended as 3rd child (stays Server Component)"
affects:
  - /settings Account tab

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "2-step modal pattern: warn screen (step 1) -> combined type-to-confirm + password (step 2)"
    - "PasswordReauthDialog pattern reuse (D-03): signInWithPassword before server action, short-circuit on wrong password"
    - "useFormFeedback({ dialogMode: true }): toast-on-success (Wipe), suppress-toast (Delete)"
    - "vi.hoisted() pattern in DeleteAccountModal.test.tsx (same fix as 41-02 account-delete.test.ts)"
    - "Server Component (AccountSection) composing a client island (DangerZoneSection) — no 'use client' added to AccountSection"

key-files:
  created:
    - "src/components/settings/WipeCollectionModal.tsx"
    - "src/components/settings/DeleteAccountModal.tsx"
    - "src/components/settings/DangerZoneSection.tsx"
  modified:
    - "src/components/settings/AccountSection.tsx"
    - "tests/components/DeleteAccountModal.test.tsx (vi.hoisted() bug fix)"

key-decisions:
  - "D-01 honored: two separate modal files — WipeCollectionModal.tsx and DeleteAccountModal.tsx — not a shared parametrized component"
  - "D-02 honored: both modals use warn -> combined type-to-confirm + password step -> execute flow"
  - "D-03 honored: re-auth is an inline pattern (signInWithPassword before server action) — PasswordReauthDialog component is not imported"
  - "D-04 honored: fixed WIPE keyword for wipe, DELETE keyword for delete"
  - "D-05 honored: execute button disabled until typed === KEYWORD AND password non-empty"
  - "D-06 honored: Wipe success fires Sonner 'Collection wiped' toast via run(..., { successMessage }) hook"
  - "D-07 honored: Delete success calls signOut() then router.push('/') with no toast"
  - "D-08 honored: no notifications.actor_id cascade copy in either modal UI"
  - "DangerZoneSection card uses border-destructive/30 rounded-lg p-6 per UI-SPEC Destructive treatment (diverges from SettingsSection's neutral rounded-xl border)"

# Metrics
duration: 4 minutes
completed: 2026-05-16
---

# Phase 41 Plan 03: Track A Danger Zone UI Summary

**Two 2-step destructive modals (WipeCollectionModal + DeleteAccountModal) with type-to-confirm + password re-auth, a DangerZoneSection client island composing them, and AccountSection updated to render the section as a 3rd child**

## Performance

- **Duration:** 4 minutes
- **Tasks:** 3
- **Files created/modified:** 5

## Accomplishments

- Created `src/components/settings/WipeCollectionModal.tsx` — `'use client'`, named export, 2-step modal: warn screen with 3 destroyed-items bullets + "what is kept" line (step 1); WIPE type-to-confirm + current password (step 2); disabled execute until `typed === 'WIPE' && password`; signInWithPassword re-auth before wipeCollection server action; success fires `'Collection wiped'` Sonner toast via `useFormFeedback({ dialogMode: true })`; handleOpenChange resets step + fields on close
- Created `src/components/settings/DeleteAccountModal.tsx` — same 2-step pattern as WipeCollectionModal but with DELETE keyword; 3 Delete-specific destroyed-items bullets; no "what is kept" line; run() with no successMessage (toast suppressed per UI-SPEC line 195); post-success: `signOut()` then `router.push('/')` (D-07); no notifications.actor_id copy (D-08)
- Created `src/components/settings/DangerZoneSection.tsx` — `'use client'` client island; `border border-destructive/30 rounded-lg p-6` card; `text-destructive font-semibold text-lg` section title "Danger Zone"; two `variant="destructive"` trigger buttons with `Trash2` (Wipe) and `UserX` (Delete) lucide icons; composes both modals, passes `currentEmail` to each
- Modified `src/components/settings/AccountSection.tsx` — imported DangerZoneSection, appended as 3rd child of `space-y-8` div; stayed a Server Component (no `'use client'` added)
- Both RED test scaffolds from 41-01 turned GREEN: 6/6 WipeCollectionModal tests pass, 7/7 DeleteAccountModal tests pass (13 total)
- `npm run build` exits 0 — server/client boundary intact; `/settings` renders as `◐ (Partial Prerender)` 
- No TypeScript errors in any newly created/modified files (pre-existing baseline errors in unrelated files unchanged)

## Task Commits

| # | Task | Commit | Type | Files |
|---|------|--------|------|-------|
| 1 | Build WipeCollectionModal | `b0c4e96` | feat | src/components/settings/WipeCollectionModal.tsx |
| 2 | Build DeleteAccountModal + fix test hoisting | `26a0c90` | feat | src/components/settings/DeleteAccountModal.tsx, tests/components/DeleteAccountModal.test.tsx |
| 3 | Build DangerZoneSection + wire AccountSection | `f91cedc` | feat | src/components/settings/DangerZoneSection.tsx, src/components/settings/AccountSection.tsx |

## Files Created/Modified

- `src/components/settings/WipeCollectionModal.tsx` (NEW) — 185 lines; `'use client'`; `WipeCollectionModal` named export; props `{ open, onOpenChange, currentEmail }`; 2-step flow; WIPE gate; useFormFeedback toast
- `src/components/settings/DeleteAccountModal.tsx` (NEW) — 163 lines; `'use client'`; `DeleteAccountModal` named export; same shape; DELETE gate; no toast; signOut + router.push('/')
- `src/components/settings/DangerZoneSection.tsx` (NEW) — 60 lines; `'use client'`; `DangerZoneSection` named export; destructive card; Trash2 + UserX buttons; composes both modals
- `src/components/settings/AccountSection.tsx` (MODIFIED) — DangerZoneSection import added; `<DangerZoneSection currentEmail={currentEmail} />` appended as 3rd child; no `'use client'` added (stays Server Component)
- `tests/components/DeleteAccountModal.test.tsx` (MODIFIED) — Rule 1 fix: `vi.hoisted()` pattern applied to mockToastSuccess + mockToastError refs

## Decisions Made

- **D-01 honored (two separate files):** WipeCollectionModal and DeleteAccountModal are distinct files with their own behavior, copy, and keyword — no shared parametrized modal.
- **D-03 pattern reuse:** Both modals inline the PasswordReauthDialog re-auth pattern (signInWithPassword before server action) without importing the component — the component is tightly coupled to `pendingNewPassword`.
- **Suppress toast on delete (D-07 / UI-SPEC line 195):** `run(async () => {...})` called with no `successMessage` and no `successAction` — `useFormFeedback` short-circuits toast when both are undefined. Router.push('/') fires directly after signOut().

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Vitest hoisting crash in DeleteAccountModal.test.tsx (41-01 RED scaffold)**
- **Found during:** Task 2 (running component tests)
- **Issue:** `tests/components/DeleteAccountModal.test.tsx` (41-01 Task 2 RED scaffold) declared `const mockToastSuccess = vi.fn()` and `const mockToastError = vi.fn()` at module scope but referenced these constants inside the `vi.mock('sonner', ...)` factory function. Vitest hoists `vi.mock()` calls above all other code at transform time, so the `const` bindings were not yet initialized when the factory executed — causing `ReferenceError: Cannot access 'mockToastSuccess' before initialization`.
- **Fix:** Replaced the two top-level `const mock* = vi.fn()` declarations with a single `vi.hoisted()` call that returns both as an object. `vi.hoisted()` runs before Vitest's hoist step, so the refs are available to both the factory closure and the test body. Identical pattern to the 41-02 fix in `account-delete.test.ts`.
- **Files modified:** `tests/components/DeleteAccountModal.test.tsx`
- **Commit:** `26a0c90`

## Threat Model Coverage

All STRIDE threats from the plan's `<threat_model>` are mitigated by the implementation:

| Threat ID | Mitigation Applied |
|-----------|-------------------|
| T-41-08 | Execute handler ALWAYS runs signInWithPassword first and short-circuits with 'Password incorrect.' on failure — server action unreachable without successful password re-auth. The disabled execute button (D-05) is a UX gate; the real security boundary is the server action's getCurrentUser() check. |
| T-41-09 | 2-step modal (warn -> confirm), distinct keywords (WIPE vs DELETE), and disabled execute button require deliberate action-specific input for each destructive action. |
| T-41-10 | Wrong-password error is 'Password incorrect.' (neutral). Server-failure copy is generic. No sensitive data surfaced. |
| T-41-11 | After deleteAccount succeeds, signOut() clears the local browser session and router.push('/') navigates away from the authenticated area — stale post-delete session is not usable. |

## Known Stubs

None — both modals call real server actions (mocked only in test context via vi.mock()); DangerZoneSection renders real trigger buttons; AccountSection renders DangerZoneSection as a real child.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. All security-relevant surface was documented in the plan's `<threat_model>`.

## Self-Check: PASSED

Files verified present:
- `src/components/settings/WipeCollectionModal.tsx` — FOUND
- `src/components/settings/DeleteAccountModal.tsx` — FOUND
- `src/components/settings/DangerZoneSection.tsx` — FOUND
- `src/components/settings/AccountSection.tsx` (modified) — FOUND
- `tests/components/DeleteAccountModal.test.tsx` (modified) — FOUND

Commits verified in git log:
- `b0c4e96` — FOUND (feat(41-03): build WipeCollectionModal)
- `26a0c90` — FOUND (feat(41-03): build DeleteAccountModal + fix test hoisting)
- `f91cedc` — FOUND (feat(41-03): build DangerZoneSection and wire into AccountSection)

Tests:
- `tests/components/WipeCollectionModal.test.tsx` — 6/6 passed
- `tests/components/DeleteAccountModal.test.tsx` — 7/7 passed

Build: `npm run build` — exits 0, Compiled successfully
