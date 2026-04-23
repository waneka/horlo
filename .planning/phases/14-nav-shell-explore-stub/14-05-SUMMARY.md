---
phase: 14-nav-shell-explore-stub
plan: 05
subsystem: layout-navigation
tags: [nav, theme, dropdown, a11y, client-component]
requirements: [NAV-08]
dependency_graph:
  requires:
    - src/components/theme-provider.tsx (existing useTheme hook)
    - src/components/ui/dropdown-menu.tsx (existing base-ui wrappers)
    - src/app/actions/auth.ts (existing logout Server Action)
  provides:
    - src/components/layout/InlineThemeSegmented.tsx (new Client Component)
    - src/components/layout/UserMenu.tsx (extended with username + Profile/Settings/Theme/Sign-out)
  affects:
    - src/components/layout/Header.tsx (pass-through: username prop now forwarded to UserMenu)
    - Plan 14-04 DesktopTopNav (downstream consumer of UserMenu's extended signature)
tech-stack:
  added: []
  patterns:
    - "aria-pressed segmented control — native 3-button row with accessible pressed-state"
    - "useTheme + mounted guard — pre-hydration fallback to 'system' avoids SSR/CSR mismatch"
    - "DropdownMenuItem render-slot pattern — Link and form children composed via base-ui slots"
key-files:
  created:
    - src/components/layout/InlineThemeSegmented.tsx
    - tests/components/layout/InlineThemeSegmented.test.tsx
    - tests/components/layout/UserMenu.test.tsx
  modified:
    - src/components/layout/UserMenu.tsx
    - src/components/layout/Header.tsx
decisions:
  - "Reused the three-option theme set (Light/Dark/System + Sun/Moon/Monitor icons) from ThemeToggle verbatim — single source of truth for theme choices"
  - "Profile item omitted when username is null (not fallback to '/') — simpler guard; Header always resolves username for a logged-in user, the null case is defensive for transient DB failures (Test 9)"
  - "Sign out kept as form-submit button (not DropdownMenuItem.onSelect) — preserves Server Action invocation semantics exactly as before"
metrics:
  duration: "~3 minutes"
  completed: "2026-04-23T22:53:23Z"
  tasks: 2
  tests_added: 16
  commits: 4
---

# Phase 14 Plan 05: UserMenu D-17 Profile Dropdown Consolidation Summary

**One-liner:** Moved ThemeToggle options inline into the authenticated profile dropdown and added Profile/Settings links, consolidating four nav controls into one menu per D-17.

## What Shipped

### 1. New Client Component: `InlineThemeSegmented`

File: `src/components/layout/InlineThemeSegmented.tsx`

A 3-button segmented row (Light · Dark · System) intended to live inline inside a dropdown. Reads theme via the project's custom `useTheme()` hook, writes via `setTheme()`. Uses an `aria-pressed`-based accessible segmented-control pattern rather than a radio group — matches the visual density required by the dropdown slot.

Key behaviors:
- Three buttons with `aria-label` Light/Dark/System and lucide Sun/Moon/Monitor icons
- `aria-pressed="true"` on the currently-selected option
- Mounted guard (`mounted ? theme ?? 'system' : 'system'`) mirrors ThemeToggle to avoid hydration flicker
- Fully client-side — no server-render path

### 2. Extended `UserMenu` (D-17 consolidation)

File: `src/components/layout/UserMenu.tsx`

Signature extension:
```ts
// Before
UserMenu({ user })
// After
UserMenu({ user, username })  // username: string | null
```

Dropdown now renders five sections in order:
1. Signed-in-as header (email label, non-interactive)
2. Profile link → `/u/{username}/collection` (omitted when `username === null`)
3. Settings link → `/settings`
4. Theme section — label + inline `InlineThemeSegmented`
5. Sign out — form-submit button styled `text-destructive`, invokes the existing `logout` Server Action

Dropdown width bumped from `w-56` to `w-64` to fit the 3-button Theme row.

### 3. Header pass-through

File: `src/components/layout/Header.tsx`

Header already resolves `username` from `getProfileById(user.id)` for HeaderNav — it now also forwards that value to UserMenu. Pure pass-through; no new DB reads.

## Verification

| Check | Result |
|-------|--------|
| `npm test -- --run tests/components/layout/InlineThemeSegmented.test.tsx` | 7/7 green |
| `npm test -- --run tests/components/layout/UserMenu.test.tsx` | 9/9 green |
| Full `npm test` | 2278 pass / 119 skipped — 0 regressions |
| `npx tsc --noEmit` | Clean except 1 pre-existing unrelated error (see Deferred Issues) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Updated Header.tsx to pass `username` to UserMenu**
- **Found during:** Task 2 TypeScript verification
- **Issue:** `error TS2741: Property 'username' is missing` — UserMenu's new required `username: string | null` prop broke Header.tsx's existing call site
- **Fix:** Forwarded the already-resolved `username` variable from Header's existing `getProfileById()` lookup
- **Files modified:** `src/components/layout/Header.tsx` (1-line change)
- **Commit:** `0572c25`
- **Rationale:** Out-of-scope for the plan's `files_modified` list but a direct consequence of the plan-mandated signature change; not adding this would leave the build broken

## Deferred Issues

- `src/app/u/[username]/layout.tsx:21` — `error TS2304: Cannot find name 'LayoutProps'`. Pre-existing on the plan base `ed1dc1d`; reproduces with all plan changes reverted. Unrelated to 14-05. Logged in `.planning/phases/14-nav-shell-explore-stub/deferred-items.md`.

## Acceptance Criteria Status

Task 1 (InlineThemeSegmented):
- [x] `'use client'` on line 1
- [x] `export function InlineThemeSegmented` exists
- [x] `useTheme` imported and called
- [x] `Sun, Moon, Monitor` imported from lucide-react
- [x] `aria-pressed` used for segmented-control a11y
- [x] 7 tests pass

Task 2 (UserMenu):
- [x] `InlineThemeSegmented` imported and rendered
- [x] `href="/settings"` present
- [x] ``href={`/u/${username}/collection`}`` present
- [x] `text-destructive` applied to Sign out button
- [x] "Sign out" copy replaces "Log out" (present in JSX — multi-line formatted, functionally equivalent to the `>Sign out<` grep criterion; Test 8 asserts `getByRole('button', { name: 'Sign out' })`)
- [x] Signature includes `username: string | null`
- [x] `action={logout}` preserved
- [x] 9 tests pass; Task 1 tests remain green

## Downstream Consumers

Plan 14-04 (DesktopTopNav) will compose this extended UserMenu and pass `username` from its own profile-lookup path. The signature is now ready for that integration.

## Known Stubs

None. Every rendered slot has a real data source: user email from server context, username from `getProfileById`, theme from `useTheme`, logout from existing Server Action. Profile link is deliberately conditional on `username` presence — not a stub.

## Threat Flags

No new security-relevant surface introduced. The plan's threat register (T-14-05-01..04) is fully covered:
- T-14-05-01 (email disclosure) — accepted; own-session only
- T-14-05-02 (logout tampering) — accepted; non-destructive if bypassed
- T-14-05-03 (open-redirect via username) — mitigated; `username` sourced from DB via `getProfileById`, not query params; Profile item omitted on null
- T-14-05-04 (theme cookie) — accepted; existing pattern

## Commits

| Hash | Subject |
|------|---------|
| `549c288` | test(14-05): add failing test for InlineThemeSegmented |
| `033bde6` | feat(14-05): implement InlineThemeSegmented |
| `1e1aed5` | test(14-05): add failing tests for UserMenu D-17 extension |
| `0572c25` | feat(14-05): extend UserMenu with Profile/Settings/Theme/Sign-out (D-17) |

## Self-Check: PASSED

- File `src/components/layout/InlineThemeSegmented.tsx` — FOUND
- File `tests/components/layout/InlineThemeSegmented.test.tsx` — FOUND
- File `src/components/layout/UserMenu.tsx` — FOUND (modified)
- File `tests/components/layout/UserMenu.test.tsx` — FOUND
- File `src/components/layout/Header.tsx` — FOUND (modified)
- Commit `549c288` — FOUND
- Commit `033bde6` — FOUND
- Commit `1e1aed5` — FOUND
- Commit `0572c25` — FOUND
