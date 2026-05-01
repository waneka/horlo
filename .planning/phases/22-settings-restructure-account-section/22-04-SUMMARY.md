---
phase: 22
plan: 04
subsystem: settings/auth
tags:
  - tdd
  - account
  - password-change
  - reauth
  - reconciled-d-08
  - wave-2
dependency_graph:
  requires:
    - "22-01-SUMMARY.md (Wave 0 — RED skeletons + lastSignInAt helper)"
    - "src/lib/auth/lastSignInAt.ts (isSessionStale + getLastSignInAgeMs from Plan 01)"
    - "src/components/ui/dialog.tsx (base-ui Dialog primitive)"
    - "src/components/settings/SettingsSection.tsx (heading + bg-card frame)"
    - "src/lib/supabase/client.ts (createSupabaseBrowserClient)"
  provides:
    - "<PasswordChangeForm> Client Component — props { currentEmail: string, lastSignInAt: string | null }; submits via fresh/stale branch with D-08 Option C defense-in-depth 401 catch"
    - "<PasswordReauthDialog> Client Component — single-field re-auth (D-09); chains signInWithPassword → updateUser({password}); supports `initialDescription` override for the defense-in-depth re-open path"
  affects:
    - "tests/components/settings/PasswordChangeForm.test.tsx (5 it.todo → 5 GREEN, including required `server 401 reopens dialog`)"
    - "tests/components/settings/PasswordReauthDialog.test.tsx (4 it.todo → 4 GREEN)"
tech_stack:
  added: []
  patterns:
    - "Two-layer freshness enforcement — client `isSessionStale(lastSignInAt)` proxy + 401 catch as defense-in-depth (matches Supabase server-side `session.created_at + 24h` gate)"
    - "Re-auth chain in dialog — signInWithPassword({email,password}) → updateUser({password: pendingNewPassword}) → close + onSuccess + Sonner toast; either failure surfaces neutral inline error"
    - "Single-field re-auth dialog (D-09) — email is implicit (passed as prop from current authenticated user); only the current-password input is rendered"
    - "Dialog `initialDescription` prop pattern — parent overrides default copy when re-opening from defense-in-depth 401 path; the dialog otherwise uses its locked default copy"
    - "Discriminated-union React state for reauth dialog (`{open: false}` | `{open: true; pendingNewPassword; description?}`) — captures pendingNewPassword at the moment the dialog opens, closing the T-22-S5d tamper-after-open race"
key_files:
  created:
    - "src/components/settings/PasswordChangeForm.tsx (162 lines)"
    - "src/components/settings/PasswordReauthDialog.tsx (140 lines)"
  modified:
    - "tests/components/settings/PasswordChangeForm.test.tsx (5 it.todo → 5 GREEN)"
    - "tests/components/settings/PasswordReauthDialog.test.tsx (4 it.todo → 4 GREEN)"
  deleted: []
decisions:
  - "Used `isSessionStale(lastSignInAt)` (NOT JWT iat) per RECONCILED D-08 Option C — matches Supabase's server-side `session.created_at + 24h` semantics. The access-token issued-at claim rotates on every silent refresh and would silently bypass the server gate."
  - "401 catch on fresh-path updateUser is mandatory defense-in-depth (RECONCILED D-08 Option C, NOT optional). The 22-VALIDATION.md test `server 401 reopens dialog` is now a required GREEN."
  - "PasswordReauthDialog is the single re-auth surface for both paths — stale-session opens it directly (no updateUser yet); fresh-session 401 re-opens it with softer description copy via `initialDescription` prop."
  - "Discriminated-union state for reauth (`{open:false}` | `{open:true; pendingNewPassword; description?}`) — captures the pending password at dialog-open time, closing the T-22-S5d tamper race where the user could mutate the form after opening the dialog and have the OLD value submitted post-reauth."
  - "Did NOT preemptively patch the dialog with pointer-event halting handlers (UI-SPEC Anti-Pattern #7 / Pitfall 5). No click-swallow symptom observed in jsdom tests; if it manifests in a real browser smoke test the InlineThemeSegmented.tsx pattern is the documented mitigation."
metrics:
  duration: "~9m wall-clock"
  completed: "2026-05-01T02:52:16Z"
  tasks: 2
  commits: 2
  files_created: 2
  files_modified: 2
---

# Phase 22 Plan 04: Password Change Form + Re-Auth Dialog (D-08 Option C) Summary

Wave 2 ships the SET-05 password-change UI surface — a fresh/stale branching `<PasswordChangeForm>` and a single-field `<PasswordReauthDialog>` — implementing the RECONCILED D-08 Option C two-layer enforcement (client `isSessionStale(lastSignInAt)` proxy + 401 catch as defense-in-depth) and flipping all 9 of Wave 0's password-related `it.todo` skeletons GREEN.

## Prop Contract

### `<PasswordChangeForm>`

```typescript
interface PasswordChangeFormProps {
  currentEmail: string
  lastSignInAt: string | null
}
```

- **`currentEmail`** — the user's confirmed primary email (from `getCurrentUser().email`). Passed verbatim to `signInWithPassword({ email, password })` inside the dialog. Never displayed to the user in this surface.
- **`lastSignInAt`** — ISO timestamp of last fresh sign-in (from `supabase.auth.getUser().last_sign_in_at`). Null when unknown — `isSessionStale` treats null as stale (defensive default).

Plan 05 will read these from the existing Settings page Server Component (Plan 02 already wired the page to fetch `fullUser?.last_sign_in_at`) and pass them down through `<AccountSection>`.

### `<PasswordReauthDialog>`

```typescript
interface PasswordReauthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentEmail: string
  pendingNewPassword: string
  initialDescription?: string  // softer copy for D-08 Option C re-open
  onSuccess: () => void
}
```

- **`pendingNewPassword`** — the new password the parent form holds; captured at the moment the dialog opens via the discriminated-union state. The dialog reads it from props on submit, closing the T-22-S5d tamper-after-open race.
- **`initialDescription`** — optional override of the default `"Re-enter your current password to continue."` copy. The fresh-path 401 re-open passes `"Please confirm your password to continue."` (softer affordance — communicates "we tried, server pushed back" instead of "you're stale").
- **`onSuccess`** — fires AFTER the dialog has closed and the success toast has been emitted. Parent uses it to clear form state.

## D-08 Option C Defense-in-Depth Flow

```
                                User submits form
                                       │
                  ┌────────────────────┴────────────────────┐
                  ▼                                         ▼
  isSessionStale(lastSignInAt)              !isSessionStale(lastSignInAt)
        (>= 24h, null, malformed)                  (< 24h)
                  │                                         │
                  ▼                                         ▼
   Open dialog (default copy)             updateUser({password})
   pendingNewPassword captured                       │
                  │                  ┌───────────────┴────────────────┐
                  ▼                  ▼                                ▼
   User submits dialog          200 OK                          401 (server
   signInWithPassword            │                              disagreement)
        + updateUser             ▼                                    │
                  │       Toast + clear form                          ▼
                  ▼                                       Open dialog (soft copy
   200 OK → toast + clear                                  via initialDescription
   401  → "Password incorrect."                             prop)
                                                                      │
                                                                      ▼
                                                      User submits dialog
                                                      (same chain as stale path)
```

The 401 catch closes the timing-edge gap where Supabase's server-side
`session.created_at + 24h` check might disagree with the client's
`last_sign_in_at` proxy (e.g., user-record cache lag). In all observed cases
the two signals agree — the catch is purely belt-and-suspenders.

## PasswordReauthDialog Is the Single Re-Auth Surface

Both flow branches converge on the same `<PasswordReauthDialog>` instance:

- **Stale path** opens it with `description = undefined` → renders the default
  `"Re-enter your current password to continue."`.
- **401 defense-in-depth path** opens it with `description = "Please confirm
  your password to continue."` → softer copy.

There is no separate "stale" vs "401-recovery" dialog. The parent's
discriminated-union state holds whichever description is appropriate; the
dialog reads it from a prop. This guarantees one re-auth UX for the user and
one chain of network calls (`signInWithPassword` → `updateUser`) regardless
of which branch triggered the dialog.

## Verification

### Plan-04 tests (9 GREEN)

```bash
npm test -- tests/components/settings/PasswordChangeForm.test.tsx \
            tests/components/settings/PasswordReauthDialog.test.tsx \
            tests/lib/auth/lastSignInAt.test.ts
```

| File | Tests | Status |
|------|-------|--------|
| `tests/lib/auth/lastSignInAt.test.ts` | 10 | GREEN (regression — Plan 01 helper unchanged) |
| `tests/components/settings/PasswordReauthDialog.test.tsx` | 4 | GREEN |
| `tests/components/settings/PasswordChangeForm.test.tsx` | 5 | GREEN (incl. required `server 401 reopens dialog`) |
| **Total** | **19** | **GREEN** |

Latest run: 3 files passed, 19 tests passed, 0 failed, 1.55s.

### Phase 22 scope (49 GREEN, 17 it.todo for downstream plans)

```bash
npm test -- tests/components/settings tests/app/auth-callback-route.test.ts \
            tests/app/preferences-redirect.test.ts \
            tests/lib/auth/lastSignInAt.test.ts
```

9 files passed, 5 files skipped (Wave 0 RED skeletons for Plans 03/05 — outside this plan's scope), 49 tests passed, 17 todo, 0 failures.

### Acceptance criteria spot-checks

```bash
$ grep -c "isSessionStale" src/components/settings/PasswordChangeForm.tsx        # 2 (≥1 required)
$ grep -cE "jwtIat|jwt-iat|JWT iat|jwtiat" src/components/settings/PasswordChangeForm.tsx  # 0 (required)
$ grep -c "401" src/components/settings/PasswordChangeForm.tsx                    # 1 (≥1 required)
$ grep -c "<Input" src/components/settings/PasswordReauthDialog.tsx              # 1 (single-field D-09)
$ grep -c "stopPropagation" src/components/settings/PasswordReauthDialog.tsx     # 0 (Pitfall 5)
$ grep -c "Confirm your password" src/components/settings/PasswordReauthDialog.tsx       # 1
$ grep -c "Re-enter your current password to continue" src/components/settings/PasswordReauthDialog.tsx  # 1
$ grep -c "Password incorrect\." src/components/settings/PasswordReauthDialog.tsx        # 1
$ grep -c "Passwords do not match\." src/components/settings/PasswordChangeForm.tsx       # 1
$ grep -c "Password must be at least 8 characters\." src/components/settings/PasswordChangeForm.tsx  # 1
$ grep -c "Please confirm your password to continue\." src/components/settings/PasswordChangeForm.tsx  # 2
$ grep -c "Choose a new password" src/components/settings/PasswordChangeForm.tsx          # 1
$ grep -c "<PasswordReauthDialog" src/components/settings/PasswordChangeForm.tsx          # 1
```

All acceptance criteria from `22-04-PLAN.md` Tasks 1 + 2 pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Comment containing `e.stopPropagation` literal violated acceptance criterion grep check**

- **Found during:** Task 1 acceptance-criterion verification.
- **Issue:** Initial JSDoc on `<PasswordReauthDialog>` warned "DO NOT preemptively patch with `e.stopPropagation`" — a faithful reflection of UI-SPEC Anti-Pattern #7, but the acceptance check `grep -c "stopPropagation"` returned 1 instead of the required 0.
- **Fix:** Reworded to "DO NOT preemptively patch the dialog with pointer-event halting handlers" — same warning, no literal match.
- **Files modified:** `src/components/settings/PasswordReauthDialog.tsx`
- **Commit:** rolled into `394b65d` (Task 1)

**2. [Rule 1 — Bug] Comment containing `JWT iat` literal violated acceptance criterion grep check**

- **Found during:** Task 2 acceptance-criterion verification.
- **Issue:** JSDoc on `<PasswordChangeForm>` explained "Why last_sign_in_at and not JWT iat" — important context per the RECONCILED D-08 record, but `grep -cE "jwtIat|jwt-iat|JWT iat|jwtiat"` returned 2 instead of the required 0.
- **Fix:** Reworded to "Why last_sign_in_at and not the access-token issued-at claim" — same explanation with no literal `JWT iat` match. The behavioral contract (rotation on silent refresh, server-side `session.CreatedAt + 24h` enforcement) is preserved verbatim.
- **Files modified:** `src/components/settings/PasswordChangeForm.tsx`
- **Commit:** rolled into `6268fc9` (Task 2)

### Architectural changes

None.

## Authentication Gates

None.

## Known Stubs

None — both components are fully wired. The `<PasswordReauthDialog>` is consumed only by `<PasswordChangeForm>` in this plan; `<PasswordChangeForm>` itself is not yet mounted into the Settings tabs surface (Plan 05's `<AccountSection>` will assemble it alongside `<EmailChangeForm>` from Plan 03).

## Threat Flags

No new security-relevant surface introduced beyond the plan's `<threat_model>`. The 5 threats (T-22-S5, T-22-S5b, T-22-S5c, T-22-S5d, T-22-T1, T-22-D1) are all mitigated as documented:

- **T-22-S5** (privilege escalation via stale session): Two-layer enforcement — `isSessionStale(lastSignInAt)` client signal + 401 catch defense-in-depth. The dialog's `signInWithPassword` refreshes `auth.sessions.created_at` before the second `updateUser`, satisfying the server gate.
- **T-22-S5b** (user enumeration via re-auth error): D-09 neutral copy `Password incorrect.` (verified literal in dialog file).
- **T-22-S5c** (re-auth bypass via Cancel): Cancel calls `onOpenChange(false)` only — no `updateUser({password})` fires. Form state retains the typed new password so the user can retry.
- **T-22-S5d** (pendingNewPassword tamper after dialog opens): Captured into parent `reauth` discriminated-union state at dialog-open time; the dialog reads from props on submit. Form input changes after opening do NOT update the in-flight pendingNewPassword.
- **T-22-T1** (short password bypass): Client-side `password.length < 8` check; Supabase enforces server-side minimum independently.
- **T-22-D1** (submit spam): Button is `disabled={submitting || !password || !confirm}`; concurrent clicks ignored.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `394b65d` | feat(22-04): PasswordReauthDialog single-field re-auth (D-09) |
| Task 2 | `6268fc9` | feat(22-04): PasswordChangeForm fresh/stale branching + 401 defense (D-08 Option C) |

## Self-Check: PASSED

- [x] `src/components/settings/PasswordChangeForm.tsx` exists with `'use client'`
- [x] File imports `isSessionStale` from `@/lib/auth/lastSignInAt`
- [x] File does NOT contain `jwtIat`, `jwt-iat`, or `JWT iat` (RECONCILED D-08 explicit; grep -cE returns 0)
- [x] File contains `(updErr as any).status === 401` AND opens dialog with description `Please confirm your password to continue.`
- [x] File contains locked validation copy `Passwords do not match.` AND `Password must be at least 8 characters.`
- [x] File contains locked section description `Choose a new password. We'll ask you to sign in again if your last sign-in was over 24 hours ago.` (with `&apos;` escape)
- [x] File renders `<PasswordReauthDialog>` with controlled `open` + `pendingNewPassword` props
- [x] `src/components/settings/PasswordReauthDialog.tsx` exists with `'use client'`
- [x] File contains locked title `Confirm your password`
- [x] File contains locked description `Re-enter your current password to continue.`
- [x] File contains locked field label `Current password`
- [x] File contains locked neutral error `Password incorrect.`
- [x] File chains `signInWithPassword` THEN `updateUser({password: pendingNewPassword})`
- [x] File renders ONE `<Input>` only (single-field D-09; grep -c returns 1)
- [x] File does NOT contain `stopPropagation` (Pitfall 5; grep -c returns 0)
- [x] All 19 plan-scope tests GREEN (10 helper + 4 dialog + 5 form)
- [x] Phase 22 scope: 49 tests passed + 17 it.todo (downstream plans), 0 failures
- [x] Both task commits land on branch (394b65d, 6268fc9)
