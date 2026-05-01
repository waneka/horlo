---
phase: 22
slug: settings-restructure-account-section
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-30
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `22-RESEARCH.md` § Validation Architecture (verified against codebase + library type defs).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `vitest` 2.1.9 + `@testing-library/react` 16.3.2 + `jsdom` 25.0.1 (jsdom env) |
| **Config file** | `/Users/tylerwaneka/Documents/horlo/vitest.config.ts` |
| **Quick run command** | `npm test -- tests/components/settings tests/app/auth-callback-route.test.ts tests/app/preferences-redirect.test.ts tests/lib/auth/jwtIat.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30s quick / ~3–5 min full |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- tests/components/settings tests/app/auth-callback-route.test.ts tests/app/preferences-redirect.test.ts tests/lib/auth/jwtIat.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 22-01-W0a | 01 | 0 | SET-01/02/03 | — | n/a | scaffold | (no test — creates `SettingsTabsShell.test.tsx` skeleton) | ❌ W0 | ⬜ pending |
| 22-01-W0b | 01 | 0 | SET-04 | — | n/a | scaffold | (creates `EmailChangeForm.test.tsx` + `EmailChangePendingBanner.test.tsx`) | ❌ W0 | ⬜ pending |
| 22-01-W0c | 01 | 0 | SET-05 | T-22-S5 | re-auth required for stale session | scaffold | (creates `PasswordChangeForm.test.tsx` + `PasswordReauthDialog.test.tsx` + `lib/auth/lastSignInAt.test.ts`) | ❌ W0 | ⬜ pending |
| 22-01-W0d | 01 | 0 | SET-06 | T-22-S6 | email_change destination is unforgeable via `next` | scaffold | (creates `tests/app/auth-callback-route.test.ts` + `tests/app/preferences-redirect.test.ts`) | ❌ W0 | ⬜ pending |
| 22-01-W0e | 01 | 0 | D-01 | — | n/a | scaffold | (creates `PrivacySection.test.tsx`, `NotificationsSection.test.tsx`, `PreferencesSection.test.tsx`, `ProfileSection.test.tsx`, `StatusToastHandler.test.tsx`) | ❌ W0 | ⬜ pending |
| (impl) | various | 1+ | SET-01 | — | n/a | component (RTL) | `npm test -- tests/components/settings/SettingsTabsShell.test.tsx -t "renders 6 tabs in canonical order with vertical orientation"` | ❌ W0 | ⬜ pending |
| (impl) | various | 1+ | SET-02 | — | n/a | component (RTL + history spy) | `npm test -- tests/components/settings/SettingsTabsShell.test.tsx -t "uses pushState"` | ❌ W0 | ⬜ pending |
| (impl) | various | 1+ | SET-02 | — | n/a | component | `npm test -- tests/components/settings/SettingsTabsShell.test.tsx -t "responds to hashchange"` | ❌ W0 | ⬜ pending |
| (impl) | various | 1+ | SET-02 | — | n/a | component | `npm test -- tests/components/settings/SettingsTabsShell.test.tsx -t "default tab is account"` | ❌ W0 | ⬜ pending |
| (impl) | various | 1+ | SET-02 | — | n/a | unit | `npm test -- tests/components/settings/SettingsTabsShell.test.tsx -t "parses hash with querystring"` | ❌ W0 | ⬜ pending |
| (impl) | various | 1+ | SET-03 | — | n/a | component | (covered by SET-01 canonical-order test) | ❌ W0 | ⬜ pending |
| (impl) | various | 1+ | SET-04 | T-22-S4 | new email never displayed as current pre-confirm | component (RTL + mock client) | `npm test -- tests/components/settings/EmailChangeForm.test.tsx -t "banner gates on new_email"` | ❌ W0 | ⬜ pending |
| (impl) | various | 1+ | SET-04 | T-22-S4 | input shows current email pre-confirm | component | `npm test -- tests/components/settings/EmailChangeForm.test.tsx -t "input shows current email pre-confirmation"` | ❌ W0 | ⬜ pending |
| (impl) | various | 1+ | SET-04 | — | resend re-fires same address | component | `npm test -- tests/components/settings/EmailChangePendingBanner.test.tsx -t "resend re-fires updateUser"` | ❌ W0 | ⬜ pending |
| (impl) | various | 1+ | SET-04 | — | aria-live status | component | `npm test -- tests/components/settings/EmailChangePendingBanner.test.tsx -t "renders aria-live status"` | ❌ W0 | ⬜ pending |
| (impl) | various | 1+ | SET-05 | T-22-S5 | last_sign_in_at < 24h → direct path | unit | `npm test -- tests/lib/auth/lastSignInAt.test.ts` | ❌ W0 | ⬜ pending |
| (impl) | various | 1+ | SET-05 | T-22-S5 | freshness threshold 24h | unit | `npm test -- tests/lib/auth/lastSignInAt.test.ts -t "stale threshold 24h"` | ❌ W0 | ⬜ pending |
| (impl) | various | 1+ | SET-05 | T-22-S5 | fresh session updates without dialog | component | `npm test -- tests/components/settings/PasswordChangeForm.test.tsx -t "fresh session updates directly"` | ❌ W0 | ⬜ pending |
| (impl) | various | 1+ | SET-05 | T-22-S5 | stale session opens re-auth dialog and signs in then updates | component | `npm test -- tests/components/settings/PasswordReauthDialog.test.tsx -t "stale session re-auth flow"` | ❌ W0 | ⬜ pending |
| (impl) | various | 1+ | SET-05 | — | neutral error on bad password | component | `npm test -- tests/components/settings/PasswordReauthDialog.test.tsx -t "neutral error on signInWithPassword failure"` | ❌ W0 | ⬜ pending |
| (impl) | various | 1+ | SET-05 | T-22-S5 | **D-08 defense-in-depth: 401 from `updateUser({password})` re-opens dialog** | component | `npm test -- tests/components/settings/PasswordChangeForm.test.tsx -t "server 401 reopens dialog"` | ❌ W0 | ⬜ pending |
| (impl) | various | 1+ | SET-06 | T-22-S6 | signup redirect | route handler | `npm test -- tests/app/auth-callback-route.test.ts -t "signup redirect"` | ❌ W0 | ⬜ pending |
| (impl) | various | 1+ | SET-06 | T-22-S6 | recovery redirect | route handler | `npm test -- tests/app/auth-callback-route.test.ts -t "recovery redirect"` | ❌ W0 | ⬜ pending |
| (impl) | various | 1+ | SET-06 | T-22-S6 | email_change redirect with hash and status | route handler | `npm test -- tests/app/auth-callback-route.test.ts -t "email_change redirect with hash and status"` | ❌ W0 | ⬜ pending |
| (impl) | various | 1+ | SET-06 | T-22-S6 | email_change ignores `next` override (D-12) | route handler | `npm test -- tests/app/auth-callback-route.test.ts -t "email_change ignores next override"` | ❌ W0 | ⬜ pending |
| (impl) | various | 1+ | SET-06 | T-22-S6 | signup honors `next` override | route handler | `npm test -- tests/app/auth-callback-route.test.ts -t "signup honors next override"` | ❌ W0 | ⬜ pending |
| (impl) | various | 1+ | SET-06 | T-22-S6 | signup rejects offsite next (same-origin guard) | route handler | `npm test -- tests/app/auth-callback-route.test.ts -t "signup rejects offsite next"` | ❌ W0 | ⬜ pending |
| (impl) | various | 1+ | SET-06 | T-22-S6 | magiclink + invite redirects | route handler | `npm test -- tests/app/auth-callback-route.test.ts -t "magiclink and invite redirects"` | ❌ W0 | ⬜ pending |
| (impl) | various | 1+ | SET-06 | T-22-S6 | unknown / null type → invalid_link | route handler | `npm test -- tests/app/auth-callback-route.test.ts -t "unknown type falls through to error"` | ❌ W0 | ⬜ pending |
| (impl) | various | 1+ | SET-06 | T-22-S6 | verifyOtp error → invalid_link | route handler | `npm test -- tests/app/auth-callback-route.test.ts -t "verifyOtp error falls through"` | ❌ W0 | ⬜ pending |
| (impl) | various | 1+ | SET-06/D-13/D-14 | — | status param strip preserves hash | component | `npm test -- tests/components/settings/StatusToastHandler.test.tsx -t "strips status param preserving hash"` | ❌ W0 | ⬜ pending |
| (impl) | various | 1+ | SET-06/D-15 | — | `/preferences` 307 with `Location: /settings#preferences` | route / page | `npm test -- tests/app/preferences-redirect.test.ts -t "redirects with hash preserved"` | ❌ W0 | ⬜ pending |
| (impl) | various | 1+ | D-01 | — | privacy migration no regression | component | `npm test -- tests/components/settings/PrivacySection.test.tsx` | ❌ W0 | ⬜ pending |
| (impl) | various | 1+ | D-01 | — | notifications migration no regression | component | `npm test -- tests/components/settings/NotificationsSection.test.tsx` | ❌ W0 | ⬜ pending |
| (impl) | various | 1+ | D-01 | — | preferences embed unchanged | component | `npm test -- tests/components/settings/PreferencesSection.test.tsx -t "embeds PreferencesClient unchanged"` | ❌ W0 | ⬜ pending |
| (impl) | various | 1+ | D-19 | — | profile stub displays + public-profile link | component | `npm test -- tests/components/settings/ProfileSection.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> **Note on D-08 reconciliation (2026-04-30):** Per Option C, `lastSignInAt` is the freshness signal AND a 401 catch on `updateUser({password})` is a mandatory defense-in-depth. The unit-test target moved from `tests/lib/auth/jwtIat.test.ts` to `tests/lib/auth/lastSignInAt.test.ts`; the 401-reopen test moved from "optional" to "required."

---

## Wave 0 Requirements

- [ ] `tests/components/settings/SettingsTabsShell.test.tsx` — covers SET-01, SET-02, SET-03 + hash parser
- [ ] `tests/components/settings/AccountSection.test.tsx` — top-level integration of email + password forms
- [ ] `tests/components/settings/EmailChangeForm.test.tsx` — covers SET-04 form path
- [ ] `tests/components/settings/EmailChangePendingBanner.test.tsx` — covers SET-04 banner + resend
- [ ] `tests/components/settings/PasswordChangeForm.test.tsx` — covers SET-05 fresh-session direct path + 401-reopen
- [ ] `tests/components/settings/PasswordReauthDialog.test.tsx` — covers SET-05 stale-session dialog flow
- [ ] `tests/components/settings/StatusToastHandler.test.tsx` — covers D-13 toast + D-14 strip-preserving-hash
- [ ] `tests/components/settings/PrivacySection.test.tsx` — covers D-01 Privacy migration
- [ ] `tests/components/settings/NotificationsSection.test.tsx` — covers D-01 Notifications migration
- [ ] `tests/components/settings/PreferencesSection.test.tsx` — covers D-01 PreferencesClient embed
- [ ] `tests/components/settings/ProfileSection.test.tsx` — covers D-19 stub
- [ ] `tests/app/auth-callback-route.test.ts` — covers SET-06 5-type redirect map + override matrix
- [ ] `tests/app/preferences-redirect.test.ts` — covers D-15 redirect with fragment preserved
- [ ] `tests/lib/auth/lastSignInAt.test.ts` — covers freshness helper unit tests (was `jwtIat.test.ts` pre-reconciliation)
- [ ] **Retire** existing `tests/components/settings/SettingsClient.test.tsx` — its assertions about Collection chevron link + Coming-soon stubs become invalid per D-02..D-04
- [ ] `tests/integration/phase13-profile-settings-migration.test.ts` — keep DAL assertions; review for regressions

**Framework install:** None — already complete.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real Supabase email-change round-trip (both confirmation links arrive at expected addresses) | SET-04 / SET-06 | Requires hitting live Resend SMTP + Supabase Auth; cannot mock `verifyOtp` end-to-end | 1. Sign in with a test account whose email you control. 2. Submit email-change to a second address. 3. Verify both inboxes receive a confirmation link. 4. Click the link delivered to the **new** address; observe redirect to `/settings#account?status=email_changed` with toast. 5. Click the link delivered to the **old** address; observe second confirmation completes the change (banner clears). 6. After completion, current email = new address. |
| Real password-change with stale session against live Supabase (verify server reauth gate matches client `last_sign_in_at` decision) | SET-05 | Requires session state older than 24h on live auth; jsdom + mock client cannot reproduce | 1. Sign in to a test account. 2. Wait > 24h (or manually update `auth.sessions.created_at` in dev DB to be > 24h ago). 3. Open Settings → Account, attempt password change. 4. Verify re-auth dialog opens client-side. 5. Submit dialog with current password; verify password updates. 6. Repeat with stale session and SKIP the dialog (use devtools to bypass) — verify the 401 catch from `updateUser` re-opens the dialog. |
| Visual / a11y of vertical Tabs across Account/Profile/Preferences/Privacy/Notifications/Appearance | SET-01 / SET-03 | RTL covers DOM structure; visual order, focus ring, hover state, and roving-focus feel are subjective | 1. `npm run dev`. 2. Open `/settings`. 3. Verify visible tab order matches CONTEXT.md canonical order. 4. Tab through with keyboard; Up/Down moves between tabs; Tab moves into panel content. 5. Mouse hover; verify hover state visible. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
