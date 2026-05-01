---
phase: 22-settings-restructure-account-section
verified: 2026-04-30T20:45:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Email change end-to-end with real Resend SMTP"
    expected: "On Account tab, submit a new email address; receive confirmation links at BOTH old and new addresses; banner copy 'Confirmation sent to <strong>old@</strong> and <strong>new@</strong>. Click both links to complete the change.' appears immediately; clicking the new-email confirmation link routes back through /auth/callback?type=email_change and lands on /settings#account?status=email_changed; the Sonner toast 'Email changed successfully' fires; ?status=email_changed is stripped from the URL while #account is preserved."
    why_human: "Requires live Resend SMTP delivery, real Supabase verifyOtp token round-trip, and visual confirmation of toast firing. Phase 21 wired Resend; Phase 22 wires the UX. Tests stub the network layer."
  - test: "Password change fresh-session direct path"
    expected: "Sign in fresh (within last 24h), navigate to Settings → Account, type a valid new password + matching confirm, click Update password. Password updates without dialog opening. Sonner toast 'Password updated' appears. Subsequent login uses new password."
    why_human: "Requires real Supabase updateUser({password}) round-trip with a live session. Tests verify the branch logic and 401 catch but cannot validate the actual password mutation reaches the auth backend."
  - test: "Password change stale-session re-auth dialog flow"
    expected: "Sign in, wait > 24h or manually expire session, then attempt password change. Dialog 'Confirm your password' opens with locked copy 'Re-enter your current password to continue.'. Type wrong password → inline 'Password incorrect.' surfaces. Type correct password → dialog closes, password updates, toast 'Password updated' fires."
    why_human: "Requires controlled session staleness (waiting 24h or manipulating session.created_at server-side) to drive the stale path. The 24h threshold can be tested with mocks but the live signInWithPassword + updateUser chain needs live auth."
  - test: "Visual layout — vertical-tabs shell on /settings"
    expected: "Sidebar shows 6 tabs in canonical order (Account, Profile, Preferences, Privacy, Notifications, Appearance) with icons. Clicking a tab updates window.location.hash without page reload. Browser back/forward navigates between tabs. URL fragment shareable (e.g., /settings#preferences activates the Preferences tab on landing). Layout uses max-w-4xl wrapper. Mobile horizontal scroll on tab list."
    why_human: "Visual layout, responsive behavior, and SPA tab-switch UX feel cannot be verified by RTL tests alone. Tests confirm pushState calls and tab order; smoke confirms no page reload + visual polish."
  - test: "Legacy /preferences redirect"
    expected: "Visiting /preferences in a browser returns 307 with Location /settings#preferences. SettingsTabsShell mount-time hash parser activates the Preferences tab. Saving a preference persists; on reload, the tab still shows the saved value (revalidatePath('/settings') effective)."
    why_human: "End-to-end revalidation flow + hash-fragment-honored-by-browser is a runtime behavior. Tests assert the redirect target string but not the actual cache-fresh round-trip."
  - test: "Email-change banner persists across reloads"
    expected: "After submitting a new email, banner stays visible across page refreshes (Server Component re-fetches user.new_email). Resend confirmation button re-fires updateUser({email}) and surfaces 'Confirmation resent.' toast. Banner disappears once the user clicks BOTH confirmation links."
    why_human: "Persistence across reload + completing the dual-confirmation cycle requires live Supabase auth state mutations that tests cannot fully exercise."
---

# Phase 22: Settings Restructure + Account Section Verification Report

**Phase Goal:** The v3.0 stub `/settings` page (privacy-only with "other sections coming soon") is replaced with a base-ui vertical-tabs shell in canonical SaaS order, and the Account section ships email/password change wired to Supabase `updateUser` with the correct re-auth + dual-confirmation UX.
**Verified:** 2026-04-30T20:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `/settings` renders a single-page vertical-tabs layout (`@base-ui/react` Tabs with `orientation="vertical"`) with sections in canonical order: Account / Profile / Preferences / Privacy / Notifications / Appearance | VERIFIED | `src/components/settings/SettingsTabsShell.tsx:104-132` — `orientation="vertical"` + 6 `TabsTrigger`s in canonical SECTION_ORDER. Test `tests/components/settings/SettingsTabsShell.test.tsx > renders 6 tabs in canonical order with vertical orientation` GREEN. |
| 2 | Tab state is hash-driven (`#account`, `#preferences`, etc.) using `window.history.pushState` (NOT `router.push`) | VERIFIED | `src/components/settings/SettingsTabsShell.tsx:95` — `window.history.pushState(null, '', `#${value}`)`. `grep -c "router.push" SettingsTabsShell.tsx` = 0. `hashchange` listener at line 81-87 (D-18). Default-tab replaceState at line 72-77 (D-17). Test `uses pushState (not router.push) on tab change` GREEN. |
| 3 | The viewer can change email from Account; UI shows a pending banner ("Confirmation sent to both old@ and new@") and does NOT display the new email as current until confirmation lands | VERIFIED | `src/components/settings/EmailChangeForm.tsx:91` — disabled input renders `value={currentEmail}` (T-22-S4 mitigation). `grep -c 'value={pendingNewEmail}'` = 0. Banner gate at line 76: `{pendingNewEmail && <EmailChangePendingBanner ...>}`. Banner copy verbatim at `EmailChangePendingBanner.tsx:62-64`. Test `input shows current email pre-confirmation (NOT new_email — T-22-S4 mitigation)` GREEN. |
| 4 | The viewer can change password from Account; sessions older than 24h trigger a re-auth dialog before the change applies | VERIFIED | `src/components/settings/PasswordChangeForm.tsx:75-79` — `if (isSessionStale(lastSignInAt)) setReauth({open: true, ...})`. Helper `src/lib/auth/lastSignInAt.ts` 24h default threshold. Dialog at `PasswordReauthDialog.tsx` chains `signInWithPassword` then `updateUser({password})` (lines 87, 100). RECONCILED D-08 Option C 401 catch at `PasswordChangeForm.tsx:92-99` (defense-in-depth). Tests `stale session opens re-auth dialog` and `server 401 reopens dialog` GREEN. |
| 5 | Clicking the email-change confirmation link routes through `/auth/callback?type=email_change` and lands on `/settings#account?status=email_changed` with a success toast; the legacy `/preferences` route redirects to `/settings#preferences` | VERIFIED | `src/app/auth/callback/route.ts:31` — `email_change: '/settings#account?status=email_changed'` in TYPE_DEFAULT_REDIRECT. NEXT_OVERRIDABLE set excludes `email_change` (D-12 / T-22-S6). `src/app/preferences/page.tsx:16` — `redirect('/settings#preferences')`. `src/components/settings/StatusToastHandler.tsx:41-50` — parses hash-with-querystring, fires `toast.success('Email changed successfully')` on `status=email_changed`, strips `?status=` while preserving `#account`. CR-01 fix verified: `useSearchParams` reference is comment-only (line 15), real source is `window.location.hash`. Tests `email_change redirect with hash and status`, `email_change ignores next override`, `redirects with hash preserved`, `fires toast.success on ?status=email_changed`, `strips status param preserving hash` all GREEN. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/settings/page.tsx` | Server Component, fetches profile + settings + Supabase user, hands data to SettingsTabsShell, max-w-4xl wrapper | VERIFIED | 65 LOC. `getCurrentUserFull()` (WR-02 fix — single round-trip). `max-w-4xl` line 50. Hands all 9 props to SettingsTabsShell. Old subtitle removed. Build typechecks. |
| `src/app/preferences/page.tsx` | Server-side redirect to /settings#preferences (no 'use client') | VERIFIED | 17 LOC. No `'use client'`. `redirect('/settings#preferences')` line 16. |
| `src/app/auth/callback/route.ts` | 5-type EmailOtpType switch with TYPE_DEFAULT_REDIRECT + NEXT_OVERRIDABLE; email_change destination NEVER overridable; safeNext same-origin guard | VERIFIED | 95 LOC. All 5 types in TYPE_DEFAULT_REDIRECT. NEXT_OVERRIDABLE excludes email_change + invite. WR-04 fix tightened safeNext to reject backslash + CRLF + tab. URL constructor preserves `#tab?query` shape verbatim (verified in inline comment + tests). |
| `src/components/settings/SettingsTabsShell.tsx` | Client Component tabs shell, hash-driven, mounts StatusToastHandler | VERIFIED | 165 LOC. `'use client'`, parseHash D-16, replaceState D-17, hashchange D-18. CR-01 fix removed `<Suspense>` wrapper since StatusToastHandler no longer uses useSearchParams. |
| `src/components/settings/StatusToastHandler.tsx` | Reads hash directly (CR-01 fix), fires toast on email_changed, strips status preserving hash | VERIFIED | 64 LOC. Uses `window.location.hash` + hashchange listener. Strict-Mode ref guard. router.replace target preserves tab portion of hash. |
| `src/components/settings/AppearanceSection.tsx` | Coming-soon stub with Palette icon and locked copy | VERIFIED | 21 LOC. Server Component. Locked copy `Theme and visual preferences are coming in the next update.`. |
| `src/components/settings/AccountSection.tsx` | Composes EmailChangeForm + PasswordChangeForm in space-y-8 wrapper | VERIFIED | 32 LOC. Both children imported and rendered. `<div className="space-y-8">` wrapper line 21. |
| `src/components/settings/EmailChangeForm.tsx` | Form + banner gate + T-22-S4 mitigation | VERIFIED | 121 LOC. `value={currentEmail}` on disabled input (NEVER pendingNewEmail). Banner gate at line 76. Locked description + error copy. router.refresh() after success. |
| `src/components/settings/EmailChangePendingBanner.tsx` | role=status aria-live=polite, locked SET-04 copy, Resend (no Cancel), updateUser({email}) on resend | VERIFIED | 79 LOC. role+aria-live. Locked copy lines 62-64. NO `supabase.auth.resend` call (only comment reference). NO Cancel button. `border-l-accent` + `bg-muted/40`. |
| `src/components/settings/PasswordChangeForm.tsx` | Fresh/stale branching via isSessionStale, 401 catch reopens dialog (Option C), validation copy | VERIFIED | 172 LOC. `isSessionStale` import + use. WR-01 fix: `updErr instanceof AuthError && updErr.status === 401` (no `as any`). Locked validation copy. Renders PasswordReauthDialog with controlled props. |
| `src/components/settings/PasswordReauthDialog.tsx` | Single field (D-09), signInWithPassword → updateUser chain, neutral error | VERIFIED | 158 LOC. Single Input (current password). Locked title/description/labels. Locked neutral error `Password incorrect.`. Chain at lines 87+100. No `stopPropagation`. |
| `src/components/settings/PrivacySection.tsx` | 3 PrivacyToggleRow instances migrated | VERIFIED | 44 LOC. 3 toggles: profilePublic / collectionPublic / wishlistPublic inside `<SettingsSection title="Visibility">` with `divide-y divide-border`. |
| `src/components/settings/NotificationsSection.tsx` | 2 PrivacyToggleRow instances migrated | VERIFIED | 36 LOC. 2 toggles: notifyOnFollow / notifyOnWatchOverlap inside `<SettingsSection title="Email notifications">`. |
| `src/components/settings/PreferencesSection.tsx` | Embeds PreferencesClient unchanged | VERIFIED | 27 LOC. Returns `<PreferencesClient preferences={preferences} />` directly. No outer card wrapper. |
| `src/components/settings/ProfileSection.tsx` | D-19 read-only stub with avatar + displayName/@username + View public profile link + footer note | VERIFIED | 68 LOC. Avatar (img) or muted bg-muted placeholder. Link to /u/{username}. Locked footer copy. |
| `src/lib/auth/lastSignInAt.ts` | isSessionStale + getLastSignInAgeMs helpers, 24h default | VERIFIED | 59 LOC. Both exports. Defensive defaults (null/malformed → stale). Pure functions, no `'server-only'` guard. |
| `src/lib/auth.ts` getCurrentUserFull | New helper for single auth.getUser() round-trip (WR-02 fix) | VERIFIED | Added at lines 22-40. Returns full User. Throws UnauthorizedError. |
| `src/app/actions/preferences.ts` | revalidatePath('/settings') alongside revalidatePath('/preferences') (FG-3) | VERIFIED | Both calls present at lines 55+61. |
| `src/components/settings/SettingsClient.tsx` | DELETED (D-02/D-03/D-04 cleanup) | VERIFIED | File no longer exists. `grep -rn "from '@/components/settings/SettingsClient'"` returns no matches. |
| `tests/components/settings/SettingsClient.test.tsx` | DELETED (cascade-fail prevention) | VERIFIED | File no longer exists. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src/app/settings/page.tsx` | `SettingsTabsShell.tsx` | passes 9 props (currentEmail, pendingNewEmail, lastSignInAt, profile, settings, preferences) | WIRED | All 9 props present in SettingsPage JSX (lines 52-62). |
| `SettingsTabsShell.tsx` | `StatusToastHandler.tsx` | rendered as sibling of Tabs root | WIRED | Line 102. Suspense wrapper removed (CR-01 fix made it unnecessary). |
| `SettingsTabsShell.tsx` | All 5 section components | TabsContent value="X" → `<XSection>` | WIRED | AccountSection (line 136), ProfileSection (143), PreferencesSection (150), PrivacySection (153), NotificationsSection (156), AppearanceSection (159). All imports + JSX present. |
| `AccountSection.tsx` | `EmailChangeForm` + `PasswordChangeForm` | child of space-y-8 wrapper | WIRED | Lines 22-29. Both imports + JSX. |
| `EmailChangeForm.tsx` | `EmailChangePendingBanner.tsx` | conditional render when pendingNewEmail non-null | WIRED | Line 76: `{pendingNewEmail && <EmailChangePendingBanner ...>}`. |
| `EmailChangeForm.tsx` | `supabase.auth.updateUser` | submit handler | WIRED | Line 58. |
| `EmailChangePendingBanner.tsx` | `supabase.auth.updateUser` | Resend onClick handler | WIRED | Line 46. |
| `PasswordChangeForm.tsx` | `PasswordReauthDialog.tsx` | controlled child with state-captured pendingNewPassword | WIRED | Lines 159-168. Discriminated-union state. |
| `PasswordChangeForm.tsx` | `src/lib/auth/lastSignInAt.ts` | imports `isSessionStale` | WIRED | Line 12 + line 75 use. |
| `PasswordReauthDialog.tsx` | `signInWithPassword` + `updateUser` chain | re-auth submit handler | WIRED | Lines 87 + 100, in correct order. |
| `auth/callback/route.ts` | `/settings#account?status=email_changed` | NextResponse.redirect with email_change destination | WIRED | TYPE_DEFAULT_REDIRECT line 31. NEXT_OVERRIDABLE excludes email_change. URL constructor preserves shape. |
| `preferences/page.tsx` | `/settings#preferences` | next/navigation redirect() | WIRED | Line 16. |
| `actions/preferences.ts` | `/settings` revalidation | revalidatePath('/settings') call | WIRED | Line 61 alongside line 55. |
| `StatusToastHandler.tsx` | `window.location.hash` (CR-01 fix) | mount + hashchange listener | WIRED | Lines 33-37 + 41 hash parser. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `SettingsTabsShell` props | `currentEmail`, `pendingNewEmail`, `lastSignInAt` | Server Component reads `getCurrentUserFull()` → live Supabase User object | Yes — live `auth.getUser()` round-trip on every render (verified in `getCurrentUserFull` impl: lines 32-40 of `src/lib/auth.ts`) | FLOWING |
| `SettingsTabsShell` props | `settings`, `preferences`, `profile` | `Promise.all([getProfileById, getProfileSettings, getPreferencesByUser])` — all DAL calls returning Postgres rows | Yes — DAL calls in `src/data/profiles.ts` + `src/data/preferences.ts` (production-grade Drizzle queries) | FLOWING |
| `EmailChangeForm` submit | `newEmail` state | `useState` + onChange from controlled Input | Yes — user-typed value submitted via `supabase.auth.updateUser({email: newEmail})` | FLOWING |
| `PasswordChangeForm` submit | `password`, `confirm`, `lastSignInAt` | Controlled inputs + Server-passed prop | Yes — drives real branch decision via `isSessionStale(lastSignInAt)` and submits via `updateUser({password})` or routes to dialog | FLOWING |
| `StatusToastHandler` toast | `status` from hash | `window.location.hash` parsed via `hash.slice(1).split('?', 2)` then `URLSearchParams(query)` | Yes — reads live URL state (verified by tests: `fires toast.success on ?status=email_changed` GREEN) | FLOWING |
| `PrivacySection` toggles | `settings.profilePublic`, etc. | Server-fetched `getProfileSettings(userId)` | Yes — DAL returns live Postgres row | FLOWING |
| `auth/callback` redirect | `type`, `next`, `token_hash` | URL searchParams + `verifyOtp` Supabase call | Yes — live verifyOtp + branched redirect target (10 GREEN tests verify each branch) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase 22 test set runs GREEN | `npm test -- tests/components/settings tests/app/auth-callback-route.test.ts tests/app/preferences-redirect.test.ts tests/lib/auth/lastSignInAt.test.ts` | 14 files, 69 tests passed, 0 failed, 2.96s | PASS |
| Production build typechecks | `npm run build` | `Compiled successfully in 5.1s`; `27/27` static pages generated | PASS |
| SettingsClient.tsx deleted | `test ! -f src/components/settings/SettingsClient.tsx` | DELETED | PASS |
| No imports of deleted file | `grep -rn "from '@/components/settings/SettingsClient'" src/ tests/` | (no matches) | PASS |
| T-22-S4 grep evidence | `grep -c 'value={pendingNewEmail}' src/components/settings/EmailChangeForm.tsx` | 0 | PASS |
| router.push not used for tab changes | `grep -c "router.push" src/components/settings/SettingsTabsShell.tsx` | 0 | PASS |
| useSearchParams not used in StatusToastHandler (CR-01 fix) | `grep -c "useSearchParams" src/components/settings/StatusToastHandler.tsx` | 1 (comment-only; no import or call) | PASS |
| AuthError instanceof check (WR-01 fix) | `grep -c "AuthError" src/components/settings/PasswordChangeForm.tsx` | 3 (import + instanceof + comment) | PASS |
| revalidatePath('/settings') in savePreferences (FG-3) | `grep -c "revalidatePath('/settings')" src/app/actions/preferences.ts` | 1 | PASS |
| email_change destination | `grep -c "/settings#account?status=email_changed" src/app/auth/callback/route.ts` | 3 (TYPE_DEFAULT_REDIRECT + 2 comments) | PASS |
| /preferences redirect | `grep -c "redirect('/settings#preferences')" src/app/preferences/page.tsx` | 1 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SET-01 | 22-01, 22-02, 22-05 | `/settings` is a single-page vertical-tabs layout using `@base-ui/react` Tabs with `orientation="vertical"` | SATISFIED | SettingsTabsShell.tsx line 105 `orientation="vertical"`; 6 tabs in canonical order. Test GREEN. |
| SET-02 | 22-01, 22-02 | Tab state is hash-driven via `window.location.hash` + `useEffect` (uses `pushState`, NOT `router.push`) | SATISFIED | SettingsTabsShell.tsx line 95 pushState; `grep -c "router.push"` = 0; hashchange listener at 81-87. Tests GREEN. |
| SET-03 | 22-01, 22-02, 22-05 | Settings sections in canonical order: Account / Profile / Preferences / Privacy / Notifications / Appearance | SATISFIED | SECTION_ORDER constant lines 16-23; TabsTrigger order matches. Test `renders 6 tabs in canonical order with vertical orientation` GREEN. |
| SET-04 | 22-01, 22-03, 22-05 | Email change with pending banner; UI does NOT display new email as current pre-confirm | SATISFIED | EmailChangeForm `value={currentEmail}` on disabled input; banner gate on pendingNewEmail; locked SET-04 copy in EmailChangePendingBanner. Tests GREEN (4 form + 4 banner). |
| SET-05 | 22-01, 22-04, 22-05 | Password change with re-auth dialog for stale sessions older than 24h | SATISFIED | PasswordChangeForm uses `isSessionStale(lastSignInAt)` (24h threshold); PasswordReauthDialog single-field re-auth; Option C 401 defense-in-depth. Tests GREEN (5 form + 4 dialog + 10 helper). |
| SET-06 | 22-01, 22-02 | `/auth/callback` 5-type switch; email_change → `/settings#account?status=email_changed` | SATISFIED | TYPE_DEFAULT_REDIRECT 5-key map; NEXT_OVERRIDABLE excludes email_change (D-12); /preferences server redirect; CR-01 fix wires StatusToastHandler to read hash directly. Tests GREEN (10 callback + 2 redirect + 7 toast). |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/settings/StatusToastHandler.tsx` | 49 | `// Unknown status — no toast, no strip.` early return | Info | Documented behavior — unknown statuses are no-op by design (forward-compat for future SET-XX status values). |
| `src/components/settings/ProfileSection.tsx` | 35 | `// eslint-disable-next-line @next/next/no-img-element` raw `<img>` | Info (IN-05 from REVIEW) | Bypasses next/image optimization. Documented as accepted v1; T-22-X1 mitigation via Phase 19.1 sanitized CDN. Could be addressed in a follow-up but not a Phase 22 blocker. |
| `src/app/actions/preferences.ts` | 55 | `revalidatePath('/preferences')` (no-op since /preferences became a redirect) | Info (IN-03 from REVIEW) | Harmless. Comment at line 56-60 explains the FG-3 rationale. |
| `src/components/settings/EmailChangePendingBanner.tsx` | 58 | `aria-live="polite"` + `role="status"` (redundant) | Info (IN-01 from REVIEW) | ARIA spec: role=status implies aria-live=polite. Redundancy is harmless; could be simplified in a follow-up. |
| `src/lib/auth/lastSignInAt.ts` | 34 | `typeof !== 'string'` defensive check unreachable given type signature | Info (IN-04 from REVIEW) | Defensive. Reasonable for runtime callers passing `unknown`. |

No blockers or warnings. All REVIEW findings either fixed in REVIEW-FIX (CR-01 + WR-01..WR-04) or accepted as documented info-level.

### Human Verification Required

#### 1. Email change end-to-end with real Resend SMTP

**Test:** On Account tab, submit a new email address.
**Expected:** Receive confirmation links at BOTH old and new addresses; banner copy "Confirmation sent to <strong>old@</strong> and <strong>new@</strong>. Click both links to complete the change." appears immediately; clicking the new-email confirmation link routes back through /auth/callback?type=email_change and lands on /settings#account?status=email_changed; the Sonner toast "Email changed successfully" fires; ?status=email_changed is stripped from the URL while #account is preserved.
**Why human:** Requires live Resend SMTP delivery, real Supabase verifyOtp token round-trip, and visual confirmation of toast firing. Phase 21 wired Resend; Phase 22 wires the UX. Tests stub the network layer.

#### 2. Password change fresh-session direct path

**Test:** Sign in fresh (within last 24h), navigate to Settings → Account, type a valid new password + matching confirm, click Update password.
**Expected:** Password updates without dialog opening. Sonner toast "Password updated" appears. Subsequent login uses new password.
**Why human:** Requires real Supabase updateUser({password}) round-trip with a live session.

#### 3. Password change stale-session re-auth dialog flow

**Test:** Sign in, wait > 24h or manually expire session, then attempt password change.
**Expected:** Dialog "Confirm your password" opens with locked copy "Re-enter your current password to continue." Type wrong password → inline "Password incorrect." surfaces. Type correct password → dialog closes, password updates, toast "Password updated" fires.
**Why human:** Requires controlled session staleness to drive the stale path; live signInWithPassword + updateUser chain.

#### 4. Visual layout — vertical-tabs shell on /settings

**Test:** Visit `/settings` in a browser.
**Expected:** Sidebar shows 6 tabs in canonical order (Account, Profile, Preferences, Privacy, Notifications, Appearance) with icons. Clicking a tab updates window.location.hash without page reload. Browser back/forward navigates between tabs. URL fragment shareable. Layout uses max-w-4xl wrapper. Mobile horizontal scroll on tab list.
**Why human:** Visual layout, responsive behavior, and SPA tab-switch UX feel cannot be verified by RTL tests alone.

#### 5. Legacy /preferences redirect

**Test:** Visit /preferences in a browser.
**Expected:** 307 redirect to /settings#preferences. SettingsTabsShell mount-time hash parser activates the Preferences tab. Saving a preference persists; on reload, tab still shows the saved value (revalidatePath('/settings') effective).
**Why human:** End-to-end revalidation flow + hash-fragment-honored-by-browser is a runtime behavior.

#### 6. Email-change banner persists across reloads

**Test:** After submitting a new email, refresh the page.
**Expected:** Banner stays visible across page refreshes (Server Component re-fetches user.new_email). Resend confirmation button re-fires updateUser({email}) and surfaces "Confirmation resent." toast. Banner disappears once the user clicks BOTH confirmation links.
**Why human:** Persistence across reload + completing the dual-confirmation cycle requires live Supabase auth state mutations.

### Gaps Summary

**No automation gaps blocking goal achievement.** All 5 ROADMAP success criteria, all 6 SET-XX requirements, all PLAN frontmatter must-haves, all 20 declared artifacts, and all 14 key links verified through file inspection + GREEN tests.

The CR-01 critical issue identified during code review (StatusToastHandler reading querystring instead of hash) was fully fixed in REVIEW-FIX (commit 89d6322); the live source confirms `useSearchParams` is gone (only a comment remains explaining why) and `window.location.hash` is the data source. WR-01 (AuthError typing), WR-02 (redundant getUser), WR-03 (TODO for hash-loss), WR-04 (safeNext tightening) are all reflected in the live code.

The 5 pre-existing test failures in the full suite (`tests/no-raw-palette.test.ts` × 2 and `tests/app/explore.test.tsx` × 3) are NOT Phase 22 fallout — they pre-date this phase and are documented in 22-02-SUMMARY + 22-05-SUMMARY (Phase 20 surface for the palette tests; Phase 14 stub superseded by Phase 18 for the explore tests).

The status is `human_needed` rather than `passed` only because Phase 22 surfaces user-facing flows (email/password change, visual tab UX, redirect chain) whose end-to-end correctness requires a live Supabase session + Resend SMTP. The automated checks confirm the wiring is correct; the human verification confirms the wiring delivers the intended outcome.

---

_Verified: 2026-04-30T20:45:00Z_
_Verifier: Claude (gsd-verifier)_
