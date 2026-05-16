---
phase: 41-account-danger-zone-branded-auth-emails-parallel-track
verified: 2026-05-16T04:55:05Z
status: human_needed
score: 8/9 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Cross-client email rendering — Apple Mail iOS dark mode, Outlook MSO, Gmail web"
    expected: "All three branded templates (confirm signup, reset password, change email) render with Horlo wordmark and gold CTA button on all three clients"
    why_human: "Requires actual email send and visual inspection across multiple email clients; cannot be verified programmatically from codebase"
  - test: "Supabase Auth dashboard template installation confirmation"
    expected: "The exported HTML from emails/out/ is pasted into Supabase Auth dashboard for Confirm signup, Reset Password, and Change Email Address slots"
    why_human: "Dashboard state is outside the codebase; operator confirmed during execution but verifier cannot read dashboard state"
  - test: "DKIM/SMTP unaffected — send a real auth email and verify mail.horlo.app DKIM signature"
    expected: "Email header shows valid DKIM signature from mail.horlo.app; no SMTP relay or signing configuration changed"
    why_human: "Requires live send and mail header inspection; Phase 21 SMTP configuration untouched by this phase"
---

# Phase 41: Account Danger Zone + Branded Auth Emails — Verification Report

**Phase Goal:** Ship the two Danger Zone account actions (Wipe Collection, Delete Account) and three branded Horlo auth email templates — both fully independent of the catalog hierarchy serial spine.
**Verified:** 2026-05-16T04:55:05Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Danger Zone section exposes two distinct actions (Wipe Collection, Delete Account) on /settings#account | VERIFIED | `DangerZoneSection.tsx` imported and rendered as 3rd child of `AccountSection` via `SettingsTabsShell`; two distinct `variant="destructive"` buttons with `Trash2`/`UserX` icons |
| 2 | Both actions require type-to-confirm input + password re-auth + multi-step modal | VERIFIED | `WipeCollectionModal.tsx` (185 lines, WIPE gate) and `DeleteAccountModal.tsx` (197 lines, DELETE gate) each implement a 2-step warn→confirm+password flow; execute button `disabled={pending \|\| typed !== 'KEYWORD' \|\| !password}` |
| 3 | Storage wear-photos/{userId}/ files purged BEFORE DB delete in both flows | VERIFIED | `purgeWearPhotos(supabase, user.id)` at line 82 (wipeCollection) and line 153 (deleteAccount) precede all `db.delete()` calls (lines 85-86 and 161 respectively); CR-01 pagination bug fixed in commit `a515814` — always re-lists from offset 0 |
| 4 | Account Delete cascade on notifications.actor_id documented with UX note in CONTEXT.md | VERIFIED | `41-CONTEXT.md` lines 87-93: "### UX Note — Account Delete Cascade (success criterion 3)" explains the cascade behavior, states it is schema-correct, and explicitly documents it is intentionally NOT surfaced in modal UI copy |
| 5 | Three branded email templates exist with 600px container, Horlo wordmark, brand color, single CTA | VERIFIED | `emails/confirm-signup.tsx`, `emails/reset-password.tsx`, `emails/change-email.tsx` each wrap `HorloEmailLayout`; layout has `width: '600px'`, text wordmark "Horlo" in `#DDA552`, single `<Button>` per template; exported HTML verified: `{{ .ConfirmationURL }}` literal present in all three, zero `oklch()`, 600px confirmed |
| 6 | Built with react-email + @react-email/components; HTML pasted into Supabase Auth dashboard | VERIFIED (partially) | `package.json` devDependencies: `react-email@^6.1.4`, `@react-email/components@^1.0.12`; `emails/out/*.html` exported and present; operator confirmed dashboard paste during execution — cross-client rendering requires human verification |
| 7 | Existing Resend SMTP + DKIM unaffected | UNCERTAIN (human needed) | Template content does not affect signing (CONTEXT.md D-11, Phase 21 SMTP unchanged); no SMTP config files modified in this phase; requires live send to confirm |
| 8 | deleteAccount performs hard delete via supabase.auth.admin.deleteUser() with explicit public.users delete first | VERIFIED | Line 161: `await db.delete(users).where(eq(users.id, user.id))`; line 167-169: `createSupabaseAdminClient().auth.admin.deleteUser(user.id)`; ordering enforced with `dbDeleted` flag (WR-04 fix, commit `9f1bbd3`) |
| 9 | No Next.js code ships for email templates; emails/ build-excluded | VERIFIED | `tsconfig.json` exclude: `["node_modules", "emails"]`; react-email in devDependencies only; `emails/` not under `src/`; `emails/out/` gitignored |

**Score:** 8/9 truths verified (1 requires human verification — SC#4/SC#5 cross-client rendering + DKIM confirmation)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/supabase/admin.ts` | Service-role Supabase client factory | VERIFIED | First line `import 'server-only'`; imports `createClient` from `@supabase/supabase-js` (not `@supabase/ssr`); exports `createSupabaseAdminClient`; `auth: { autoRefreshToken: false, persistSession: false }`; client created inside function body (never module-scoped) |
| `src/app/actions/account.ts` | wipeCollection + deleteAccount server actions | VERIFIED | File begins `'use server'`; exports both functions; 193 lines; `purgeWearPhotos` shared helper implements CR-01 fix (always offset 0) |
| `src/components/settings/WipeCollectionModal.tsx` | 2-step Wipe Collection modal | VERIFIED | 185 lines; `'use client'`; named export; 2-step flow; WIPE gate; `useFormFeedback({ dialogMode: true })` with `successMessage: 'Collection wiped'`; `handleOpenChange` resets step+fields |
| `src/components/settings/DeleteAccountModal.tsx` | 2-step Delete Account modal | VERIFIED | 197 lines; `'use client'`; named export; 2-step flow; DELETE gate; no successMessage (toast suppressed); `window.location.assign('/')` after signOut with error swallowed (WR-02 fix) |
| `src/components/settings/DangerZoneSection.tsx` | Danger Zone card composing both modals | VERIFIED | `'use client'`; `border border-destructive/30 rounded-lg p-6` card; `text-destructive font-semibold text-lg` title; two destructive buttons with Trash2/UserX icons |
| `src/components/settings/AccountSection.tsx` | Account tab with DangerZoneSection as 3rd child | VERIFIED | No `'use client'` (stays Server Component); imports `DangerZoneSection`; renders as 3rd child of `<div className="space-y-8">` |
| `emails/components/HorloEmailLayout.tsx` | Shared email layout | VERIFIED | 600px container; text "Horlo" wordmark in `#DDA552`; no `<img>`; color-scheme meta tags; no oklch; no className |
| `emails/confirm-signup.tsx` | Confirm signup template | VERIFIED | CTA "Confirm your email"; wraps HorloEmailLayout; single Button with `{{ .ConfirmationURL }}` |
| `emails/reset-password.tsx` | Reset password template | VERIFIED | CTA "Reset your password"; same structure |
| `emails/change-email.tsx` | Change email template | VERIFIED | CTA "Confirm email change"; same structure |
| `tsconfig.json` | emails/ build exclusion | VERIFIED | exclude array: `["node_modules", "emails"]` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `WipeCollectionModal.tsx` | `wipeCollection` server action | `import from @/app/actions/account` | WIRED | Line 16: `import { wipeCollection } from '@/app/actions/account'`; called in handleExecute after signInWithPassword |
| `DeleteAccountModal.tsx` | `deleteAccount` server action | `import from @/app/actions/account` | WIRED | Line 16: `import { deleteAccount } from '@/app/actions/account'`; called in handleExecute after signInWithPassword |
| `AccountSection.tsx` | `DangerZoneSection` | import + 3rd child of space-y-8 | WIRED | Line 3: import; line 35: `<DangerZoneSection currentEmail={currentEmail} />` |
| `DangerZoneSection.tsx` | both modals | renders WipeCollectionModal + DeleteAccountModal | WIRED | Lines 49-57: both modals rendered with open/onOpenChange props |
| `account.ts deleteAccount` | `public.users DELETE` | `db.delete(users).where(eq(users.id, user.id))` | WIRED | Line 161: explicit drizzle delete; load-bearing for cascades |
| `account.ts deleteAccount` | `auth.admin.deleteUser` | `createSupabaseAdminClient()` | WIRED | Lines 167-169: admin client created per-call; deleteUser called with authenticated user id |
| `account.ts` | `wear-photos storage` | `purgeWearPhotos` using `.list` + `.remove` | WIRED | Lines 37-50: paginated list-then-remove loop (always offset 0, CR-01 fix) |
| `emails/*.tsx` | `emails/out/*.html` | `npx react-email export` (gitignored output) | WIRED | All three HTML files present in `emails/out/`; each contains `{{ .ConfirmationURL }}` literal, no oklch |
| `tsconfig.json exclude` | `emails/` directory | `exclude` array entry | WIRED | `"emails"` in exclude array confirmed |

### Data-Flow Trace (Level 4)

Server actions and email templates — both involve external system calls (Supabase DB, Storage, auth.admin API, dashboard state) that cannot be traced to a live data source programmatically from the codebase. The modals call real server actions (not stubs); server actions call real DB/storage APIs. The mocking is test-only (`vi.mock` in test files, not in production code).

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `WipeCollectionModal.tsx` | `wipeCollection()` result | `src/app/actions/account.ts` | Yes — real DB/storage delete | FLOWING |
| `DeleteAccountModal.tsx` | `deleteAccount()` result | `src/app/actions/account.ts` | Yes — real DB/storage/auth delete | FLOWING |
| `account.ts wipeCollection` | `wear_events` + `watches` rows | Drizzle ORM → Supabase DB | Yes — `db.delete()` with real eq filter | FLOWING |
| `account.ts deleteAccount` | `users` + `auth.users` rows | Drizzle ORM + admin client | Yes — explicit deletes with authenticated user.id | FLOWING |
| `emails/out/*.html` | `{{ .ConfirmationURL }}` | Supabase GoTrue (substituted at send time) | N/A — template; Supabase substitutes at runtime | FLOWING (token present) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Component tests GREEN (WipeCollectionModal + DeleteAccountModal) | `npx vitest run tests/components/WipeCollectionModal.test.tsx tests/components/DeleteAccountModal.test.tsx` | 2 test files passed, 13 tests passed | PASS |
| Email template static tests GREEN | `npx vitest run tests/static/email-templates.test.ts` | 1 test file passed, 14 tests passed | PASS |
| Integration tests pass/skip cleanly | `npx vitest run tests/integration/account-wipe.test.ts tests/integration/account-delete.test.ts` | 2 passed, 9 skipped (no DB env) | PASS |
| admin.ts server-only guard | Programmatic checks: import 'server-only' first, createClient from @supabase/supabase-js, createSupabaseAdminClient exported, persistSession: false, no module-scope client | All 5 PASS | PASS |
| emails/out/ ConfirmationURL literal token | `grep '{{ .ConfirmationURL }}' emails/out/*.html` | All 3 HTML files: 1 match each | PASS |
| emails/out/ no oklch | `grep 'oklch(' emails/out/*.html` | 0 matches in all 3 | PASS |
| emails/out/ 600px container | `grep '600px' emails/out/*.html` | 1 match in all 3 | PASS |
| Storage ordering: purge BEFORE DB delete | Line number comparison in account.ts | purgeWearPhotos(82) < wearEvents(85) < watches(86); purgeWearPhotos(153) < db.delete(users)(161) < auth.admin.deleteUser(168) | PASS |
| CR-01 fix: no advancing offset in purgeWearPhotos | `grep 'offset' src/app/actions/account.ts` | Only comment references to offset (warning of the old bug); no `offset += PAGE_SIZE` | PASS |
| WR-02 fix: window.location.assign after signOut | `grep 'window.location\|signOut' DeleteAccountModal.tsx` | try/catch wraps signOut; window.location.assign('/') always executes | PASS |
| WR-03 fix: revalidatePath('/u/[username]') in wipeCollection | `grep 'revalidatePath' src/app/actions/account.ts` | Both `revalidatePath('/')` and `revalidatePath('/u/[username]', 'layout')` present | PASS |
| WR-04 fix: dbDeleted flag for idempotent partial recovery | `grep 'dbDeleted\|PARTIAL DELETE' account.ts` | `dbDeleted` flag at line 147; distinct PARTIAL DELETE log at line 182 | PASS |

### Probe Execution

No conventional probe scripts (`scripts/*/tests/probe-*.sh`) declared or found for this phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SET-13 | 41-02, 41-03 | Account Danger Zone — Wipe Collection + Delete Account with type-to-confirm + re-auth + multi-step modal; storage purge before DB delete; notifications.actor_id documented | SATISFIED | `wipeCollection` + `deleteAccount` server actions; `WipeCollectionModal` + `DeleteAccountModal` + `DangerZoneSection`; `AccountSection` wired; CONTEXT.md UX note; all REVIEW blockers/warnings resolved |
| SET-14 | 41-04 | Three Supabase Auth email templates (react-email); 600px, hex accent, single CTA, Go-template token; dashboard paste; SMTP/DKIM unaffected | SATISFIED (codebase) / NEEDS HUMAN (cross-client rendering) | `emails/*.tsx` + `HorloEmailLayout.tsx`; `emails/out/*.html` exported; `tsconfig.json` excludes emails; operator confirmed dashboard paste; cross-client UAT requires human verification |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/settings/DeleteAccountModal.tsx` | 154 | `placeholder="DELETE"` | Info | This is the UI-SPEC required keyword prompt, not a stub indicator |
| `src/components/settings/WipeCollectionModal.tsx` | 142 | `placeholder="WIPE"` | Info | Same — intentional keyword placeholder per D-04 |

No TBD, FIXME, or XXX markers found in any phase-41 modified files. No unresolved debt markers.

The `placeholder` attribute matches are UI-SPEC intentional design (D-04 fixed keywords), not stub indicators. Both inputs have real `value` and `onChange` bindings — they are functional form fields.

### Human Verification Required

#### 1. Cross-Client Email Rendering (SC#4)

**Test:** Trigger each Supabase Auth email flow (sign up a new account, request password reset, change email address) and inspect the received emails in: Apple Mail iOS dark mode, Outlook (MSO), and Gmail web.
**Expected:** Horlo wordmark rendered in gold (#DDA552) at top; 600px single-column layout; action-specific CTA button in gold with white text; `{{ .ConfirmationURL }}` resolved to a working confirmation link; no broken images (text wordmark, so none expected); dark mode rendering preserved on Apple Mail iOS.
**Why human:** Email client rendering requires live sends and visual inspection across three distinct clients. The codebase passes all static checks (token present, no oklch, 600px) but pixel rendering on MSO/dark mode can only be verified by opening the emails.

#### 2. Supabase Auth Dashboard Template Status (SC#5 partial)

**Test:** Open Supabase Dashboard → Authentication → Email Templates and confirm all three slots (Confirm signup, Reset Password, Change Email Address) contain the branded Horlo HTML (not the default Supabase template).
**Expected:** Each slot shows the HorloEmailLayout HTML with Horlo wordmark, gold CTA button, and action-specific body copy.
**Why human:** The operator confirmed the paste during execution (41-04-SUMMARY.md), but dashboard state cannot be read programmatically from the codebase.

#### 3. DKIM / SMTP Unaffected Confirmation (SC#5)

**Test:** Trigger a real auth email and inspect the received email's headers for a valid DKIM signature from `mail.horlo.app`.
**Expected:** `DKIM-Signature: v=1; a=rsa-sha256; d=mail.horlo.app` present; email passes DMARC; Phase 21 Resend SMTP configuration unchanged.
**Why human:** SMTP/DKIM status requires live send and mail header inspection. No SMTP configuration files were modified in Phase 41, supporting the claim, but live verification is the only confirmation.

### Gaps Summary

No code gaps found. All automated checks pass. All REVIEW findings resolved (CR-01, WR-02, WR-03, WR-04 confirmed fixed in code; WR-01 accepted as plan-scope decision; WR-05, WR-06, IN-01 through IN-04 remain open as non-blocking out-of-scope items per context note).

The 3 items in Human Verification Required are for live email client rendering and dashboard state — these are inherently non-codebase-verifiable. The codebase evidence is complete for all SC#1, SC#2, SC#3, and the code side of SC#4 and SC#5. SC#4's cross-client UAT and SC#5's DKIM/dashboard confirmation remain the outstanding human items.

---

_Verified: 2026-05-16T04:55:05Z_
_Verifier: Claude (gsd-verifier)_
