---
phase: 22
plan: 02
subsystem: settings/auth
tags:
  - tdd
  - tabs-shell
  - hash-routing
  - auth-callback
  - wave-1
dependency_graph:
  requires:
    - "22-01-SUMMARY.md (Wave 0 — RED test scaffolds + lastSignInAt helper)"
    - "src/components/ui/tabs.tsx (base-ui Tabs wrapper, vertical orientation)"
    - "src/components/ui/ThemedToaster.tsx (Sonner toaster mounted at root layout)"
    - "src/lib/auth.ts (getCurrentUser + UnauthorizedError)"
    - "src/lib/supabase/server.ts (createSupabaseServerClient)"
  provides:
    - "<SettingsTabsShell> client component — props contract Plans 03/04/05 will consume to drop their section components into the panel slots"
    - "<StatusToastHandler /> — fires Sonner toast.success on ?status=email_changed and strips the param while preserving #account hash (D-13/D-14)"
    - "<AppearanceSection> — final coming-soon stub (no further work; Phase 23 SET-10 replaces)"
    - "/auth/callback 5-type redirect map (signup/recovery/email_change/magiclink/invite + 'email' alias coercion); D-12 NEXT_OVERRIDABLE set excludes email_change + invite"
    - "/preferences → /settings#preferences server-side redirect (D-15)"
    - "Settings page Server Component wired to SettingsTabsShell with full Supabase User read (new_email + last_sign_in_at)"
  affects:
    - "src/app/settings/page.tsx (rewritten — max-w-4xl, supabase.auth.getUser() for full User, removed legacy subtitle)"
    - "src/app/preferences/page.tsx (rewritten — 4-line redirect; was a 9-line PreferencesClient host)"
    - "src/app/auth/callback/route.ts (rewritten — 24 lines → 86 lines, full type-switched redirect map)"
    - "tests/components/settings/SettingsTabsShell.test.tsx (6 it.todo → 6 GREEN)"
    - "tests/components/settings/StatusToastHandler.test.tsx (4 it.todo → 4 GREEN)"
    - "tests/app/auth-callback-route.test.ts (10 it.todo → 10 GREEN)"
    - "tests/app/preferences-redirect.test.ts (2 it.todo → 2 GREEN)"
tech_stack:
  added: []
  patterns:
    - "Hash-driven tab routing — useState + useEffect + window.history.pushState/replaceState + hashchange listener (D-16/D-17/D-18); NOT router.push (Pitfall 1)"
    - "Suspense-wrapped useSearchParams consumer to avoid Next.js 16 prerender bailout (Pitfall 3)"
    - "Strict-Mode ref guard on one-shot side effects (FG-5 — useRef + early-return guard)"
    - "Hash-with-querystring URL shape (#tab?key=value) parser via hash.slice(1).split('?', 2) — D-16 documented inline"
    - "Hash-preserving param strip via router.replace(`${pathname}${queryStr ? '?' + queryStr : ''}${hash}`) — D-14 footgun documented inline"
    - "Direct NextResponse Location-header construction for hash+querystring redirects — preserves the byte-identical `#account?status=email_changed` shape that `new URL(...)` would otherwise reorder to `?status=email_changed#account`"
    - "TYPE_DEFAULT_REDIRECT `as const satisfies Record<Exclude<EmailOtpType, 'email'>, string>` — TS-enforced exhaustiveness over the 5 documented Supabase types"
    - "Server-side redirect() preserves URL fragment in Location header per RFC 7231 §7.1.2 — verified Next.js 16 behavior"
key_files:
  created:
    - "src/components/settings/SettingsTabsShell.tsx (170 lines)"
    - "src/components/settings/StatusToastHandler.tsx (54 lines)"
    - "src/components/settings/AppearanceSection.tsx (21 lines)"
  modified:
    - "src/app/settings/page.tsx"
    - "src/app/preferences/page.tsx"
    - "src/app/auth/callback/route.ts"
    - "tests/components/settings/SettingsTabsShell.test.tsx"
    - "tests/components/settings/StatusToastHandler.test.tsx"
    - "tests/app/auth-callback-route.test.ts"
    - "tests/app/preferences-redirect.test.ts"
  deleted: []
decisions:
  - "Hash-with-querystring redirects use direct NextResponse Location-header construction (not new URL(...)). The URL constructor reorders fragments to land after the query, emitting `/settings?status=email_changed#account`. SettingsTabsShell.parseHash relies on the D-16 byte-identical `#account?status=email_changed` shape so the destination passes through verbatim."
  - "AppearanceSection is a Server Component (no `'use client'`). Tab panels render client-only via <Tabs> parent state, but section components themselves can be Server Components when they hold no client logic — keeps the bundle minimal."
  - "Page wrapper widened from max-w-2xl to max-w-4xl per UI-SPEC Layout decision. Vertical-tabs need ~520px content width minimum (sidebar 176 + panel ≥320 + gap 24); the old 672px wrapper left only 472px for the panel."
  - "settings/page.tsx now reads the full Supabase User via supabase.auth.getUser() in addition to getCurrentUser(). The helper returns only { id, email } — pending email + freshness fields require the full User object for SET-04 (Plan 03) and SET-05 / RECONCILED D-08 (Plan 04)."
metrics:
  duration: "~7m41s wall-clock"
  completed: "2026-05-01T02:44:12Z"
  tasks: 3
  commits: 3
  files_created: 3
  files_modified: 7
---

# Phase 22 Plan 02: Settings Shell Foundation Summary

Wave 1 stands up the vertical-tabs Settings shell with hash-driven routing, the auth-callback type-switched redirect map, the `/preferences` server-side redirect, the StatusToastHandler one-shot toast firer, and the AppearanceSection coming-soon stub — flipping 22 of Wave 0's `it.todo` scaffolds GREEN and unblocking Plans 03–05 to drop their section components into placeholder panel slots.

## What Shipped

### `<SettingsTabsShell>` — Client Component (170 LOC)

`src/components/settings/SettingsTabsShell.tsx`

**Prop contract Plans 03/04/05 will consume:**

```typescript
interface SettingsTabsShellProps {
  // Profile data
  username: string
  displayName: string | null
  avatarUrl: string | null
  profilePublic: boolean
  // Account state
  currentEmail: string
  pendingNewEmail: string | null    // SET-04 banner gate (Plan 03)
  lastSignInAt: string | null       // SET-05 / D-08 freshness (Plan 04)
  // Settings + preferences (Plan 05)
  settings: ProfileSettings
  preferences: UserPreferences
}
```

**Behavior:**
- Renders 6 tabs in canonical order: **account / profile / preferences / privacy / notifications / appearance** (SET-01 / SET-03).
- Hash-driven routing per D-16/D-17/D-18:
  - **D-17** mount: empty hash → `window.history.replaceState(null, '', '/settings#account')`.
  - **D-16** parser: `hash.slice(1).split('?', 2)` handles the non-standard `#tab?key=value` shape.
  - **D-18** listener: `addEventListener('hashchange')` syncs active tab on browser back/forward.
- Tab clicks call `window.history.pushState(null, '', `#${value}`)` — **NOT `router.push`** (Pitfall 1; UI-SPEC Anti-Pattern #5; literal `router.push` count in shell file = 0).
- 5 of 6 panels render `<PanelPlaceholder label={...} planRef="22-05" />` — Plan 05 replaces them with the real section components.
- Appearance panel renders `<AppearanceSection />` (final, no further work).
- `<StatusToastHandler />` mounted inside `<Suspense fallback={null}>` per Pitfall 3.

### `<StatusToastHandler />` — Client Component (54 LOC)

`src/components/settings/StatusToastHandler.tsx`

- D-13: reads `?status=` from `useSearchParams()`; on `email_changed` fires `toast.success('Email changed successfully')`.
- D-14: strips the `status` param via `router.replace(${pathname}${queryStr ? '?' + queryStr : ''}${hash})` — preserves `window.location.hash` so the active tab is not lost.
- FG-5: `useRef` Strict-Mode guard prevents double-fire on dev double-mount.
- Unknown status values are no-op (no toast, no strip).

### `<AppearanceSection>` — Server Component (21 LOC)

`src/components/settings/AppearanceSection.tsx`

- Final coming-soon stub per UI-SPEC visual spec lines 432-440.
- `Palette` icon + muted copy "Theme and visual preferences are coming in the next update."
- Phase 23 SET-10 will replace with the lifted `<InlineThemeSegmented>` theme switch.

### `/auth/callback` Redirect Map — `src/app/auth/callback/route.ts` (86 LOC)

**Exact destination map per D-11:**

| `type` | Destination | `next` overridable? |
|--------|-------------|---------------------|
| `signup` | `/?status=email_confirmed` | yes |
| `recovery` | `/reset-password` | yes |
| `email_change` | `/settings#account?status=email_changed` | **NO** (D-12 / T-22-S6) |
| `magiclink` | `/?status=signed_in` | yes |
| `invite` | `/signup?status=invited` | NO |
| `email` (deprecated alias) | coerced to `signup` → `/?status=email_confirmed` | (per signup) |

**Security:**
- Same-origin guard preserved: `safeNext = next.startsWith('/') && !next.startsWith('//') ? next : null` (Pitfall 8).
- `email_change` and `invite` are NOT in the `NEXT_OVERRIDABLE` set, so a stale `?next=` carried in the change-form URL cannot redirect users post-confirm (T-22-S6 mitigation).
- `verifyOtp` errors fall through to `/login?error=invalid_link`.
- Unknown / null `type` falls through to `/login?error=invalid_link`.

**TS exhaustiveness:** `TYPE_DEFAULT_REDIRECT` is typed `as const satisfies Record<Exclude<EmailOtpType, 'email'>, string>` — adding a new EmailOtpType in a future Supabase version will fail compilation rather than silently fall through.

### `/preferences` Redirect — `src/app/preferences/page.tsx` (16 LOC)

```typescript
import { redirect } from 'next/navigation'

export default function PreferencesPage(): never {
  redirect('/settings#preferences')
}
```

- Server-side `redirect()` preserves the URL fragment per RFC 7231 §7.1.2 (verified in 22-RESEARCH.md Pattern 7 via code-read of `node_modules/next/dist/shared/lib/router/utils/add-path-prefix.js`).
- No Client Component fallback needed.
- The `<SettingsTabsShell>` mount-time hash parser activates the Preferences tab on landing.

### `/settings` Server Component Rewrite — `src/app/settings/page.tsx` (60 LOC)

- Page wrapper: `max-w-2xl` → `max-w-4xl` per UI-SPEC Layout decision.
- Old subtitle "Manage your privacy controls. Other sections coming soon." removed.
- Reads `getCurrentUser()` (auth gate) + the full Supabase `User` via `supabase.auth.getUser()` for `new_email` + `last_sign_in_at`.
- `Promise.all` parallelizes `getProfileById` + `getProfileSettings` + `getPreferencesByUser`.
- `redirect('/login?next=/settings')` stays OUTSIDE the try/catch (Pitfall 7).
- Hands all data to `<SettingsTabsShell>` props for downstream consumption.

### Confirmation: Placeholder panels exist for Plan 05 to replace

| Tab | Current panel content | Plan 05 will replace with |
|-----|----------------------|---------------------------|
| Account | `<PanelPlaceholder label="Account" planRef="22-05" />` | `<AccountSection>` (renders `<EmailChangeForm>` Plan 03 + `<PasswordChangeForm>` Plan 04) |
| Profile | `<PanelPlaceholder label="Profile" planRef="22-05" />` | `<ProfileSection>` (D-19 read-only stub) |
| Preferences | `<PanelPlaceholder label="Preferences" planRef="22-05" />` | `<PreferencesSection>` (PreferencesClient embed) |
| Privacy | `<PanelPlaceholder label="Privacy" planRef="22-05" />` | `<PrivacySection>` (3x PrivacyToggleRow migration) |
| Notifications | `<PanelPlaceholder label="Notifications" planRef="22-05" />` | `<NotificationsSection>` (2x PrivacyToggleRow migration) |
| Appearance | `<AppearanceSection />` (FINAL) | (no further work — Phase 23 SET-10 replaces this in a later phase) |

Each placeholder reads `{label} section content lands in Plan 22-05.` so a developer running `npm run dev` sees a clear forward-pointer rather than empty panels.

## Verification

### Plan-02 Tests (22/22 GREEN)

```bash
npm test -- tests/components/settings/SettingsTabsShell.test.tsx \
            tests/components/settings/StatusToastHandler.test.tsx \
            tests/app/auth-callback-route.test.ts \
            tests/app/preferences-redirect.test.ts
```

| File | Tests | Status |
|------|-------|--------|
| `tests/components/settings/SettingsTabsShell.test.tsx` | 6 | ✅ GREEN |
| `tests/components/settings/StatusToastHandler.test.tsx` | 4 | ✅ GREEN |
| `tests/app/auth-callback-route.test.ts` | 10 | ✅ GREEN |
| `tests/app/preferences-redirect.test.ts` | 2 | ✅ GREEN |
| **Total** | **22** | **✅ GREEN** |

Latest run: 4 files passed, 22 tests passed, 0 failed, 1.22s.

### Build

`npm run build` exits 0 with `✓ Compiled successfully in 5.0s` and `✓ Generating static pages using 7 workers (27/27)`. Settings page typechecks against the new SettingsTabsShell prop contract.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocker fix] URL constructor reorders fragment after query in `new URL(...)`**

- **Found during:** Task 2 implementation, before tests written.
- **Issue:** `new URL('/settings#account?status=email_changed', origin)` normalizes to `https://horlo.app/settings?status=email_changed#account` — fragment lands after query. The plan inline-noted this and asked the executor to "verify and adjust if it normalizes."
- **Fix:** Branch the redirect path: when `destination.includes('#') && destination.includes('?')`, construct the response with a direct Location header byte-identical to the destination string (`new NextResponse(null, { status: 307, headers: { location: absolute } })`). All other types use the standard `NextResponse.redirect(new URL(...))` path. The non-standard `#tab?key=value` shape now lands at the browser intact and `<SettingsTabsShell>.parseHash` receives what it expects.
- **Files modified:** `src/app/auth/callback/route.ts`
- **Commit:** `2953646`

**2. [Rule 1 — Bug] Comment hardcoded `max-w-2xl` violated acceptance criterion grep check**

- **Found during:** Task 3 acceptance-criterion verification.
- **Issue:** Initial comment in `src/app/settings/page.tsx` referenced both `max-w-4xl (was max-w-2xl)` and `max-w-2xl (672px) leaves only 472px` — the `grep -c "max-w-2xl"` acceptance check returned 2 instead of the intended 0.
- **Fix:** Reworded the comment to drop both literal `max-w-2xl` mentions while preserving the rationale ("the previous narrower 672px wrapper").
- **Files modified:** `src/app/settings/page.tsx`
- **Commit:** `f2f440a` (rolled into Task 3 commit)

**3. [Rule 1 — Bug] Comment containing `router.push` violated acceptance criterion grep check**

- **Found during:** Task 1 acceptance-criterion verification.
- **Issue:** Comment in `SettingsTabsShell.tsx` said "pushState (NOT router.push) — router.push re-runs the page Server Component loader" — `grep -c "router.push"` returned 1 instead of the intended 0.
- **Fix:** Reworded comment to "pushState ONLY — the Next.js router would re-run the page Server Component loader on a hash change" — same meaning, no literal match.
- **Files modified:** `src/components/settings/SettingsTabsShell.tsx`
- **Commit:** `9fd6349` (rolled into Task 1 commit)

### Architectural changes

None.

## Authentication Gates

None.

## Known Stubs

The 5 placeholder panels in `<SettingsTabsShell>` are intentional — Plan 05 replaces them with the real section components. Each placeholder is forward-pointed (`Plan 22-05`) so it's clear they're not "real" UI state. AppearanceSection is the only final panel content shipped in this plan; Phase 23 SET-10 will replace it.

## Deferred Issues

7 pre-existing test failures observed in the full suite are NOT caused by Plan 22-02 changes — flagged for visibility, no action taken (SCOPE BOUNDARY rule):

- `tests/no-raw-palette.test.ts` — 2 failures: `src/components/insights/CollectionFitCard.tsx` and `src/components/search/WatchSearchRow.tsx` use `font-medium` (Phase 20 files; not touched in Plan 22-02).
- `tests/app/explore.test.tsx` — 3 failures: tests assert against a "Discovery is coming." stub from Phase 14 NAV-11 D-18 that Phase 18 has already replaced with the live discovery surface.
- `tests/integration/backfill-taste.test.ts` — 2 failures: `node: .env.local: not found` — env-gated integration tests not runnable in this worktree.

All 22 Plan 22-02 tests are GREEN. Build passes.

## Threat Flags

No new security-relevant surface introduced beyond the plan's `<threat_model>`. The `email_change` destination, `safeNext` guard, and verifyOtp failure path are exactly the threats T-22-S6 / T-22-S2 documented in the plan.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `9fd6349` | feat(22-02): SettingsTabsShell + StatusToastHandler + AppearanceSection |
| Task 2 | `2953646` | feat(22-02): auth callback 5-type redirect map + /preferences server redirect |
| Task 3 | `f2f440a` | feat(22-02): /settings server-component rewrite — wire SettingsTabsShell |

## Self-Check: PASSED

- [x] `src/components/settings/SettingsTabsShell.tsx` exists, `'use client'`, exports `SettingsTabsShell`
- [x] Contains literal `window.history.pushState`; `grep -c "router.push"` returns 0
- [x] Contains `parseHash` + comments for D-16, D-17, D-18
- [x] Contains `<Suspense fallback={null}>` wrapping `<StatusToastHandler />`
- [x] Contains all 6 SECTION_ORDER values
- [x] `src/components/settings/StatusToastHandler.tsx` exists, `'use client'`, `useRef` guard, calls `toast.success('Email changed successfully')`, `router.replace` with hash preservation
- [x] `src/components/settings/AppearanceSection.tsx` exists, contains "Theme and visual preferences are coming in the next update."
- [x] `src/app/auth/callback/route.ts` contains `TYPE_DEFAULT_REDIRECT` + 5 keys + `/settings#account?status=email_changed` literal + `NEXT_OVERRIDABLE` Set with 3 entries + safeNext guard + D-11/D-12 markers + email-alias coercion
- [x] `src/app/preferences/page.tsx` does NOT contain `'use client'`; imports `redirect` from `next/navigation`; calls `redirect('/settings#preferences')`
- [x] `src/app/settings/page.tsx` contains `max-w-4xl`, NOT `max-w-2xl`; contains SettingsTabsShell import + JSX; reads `supabase.auth.getUser()` + `fullUser?.new_email` + `fullUser?.last_sign_in_at`; old subtitle removed
- [x] All 22 Plan 22-02 tests GREEN (6 shell + 4 status + 10 callback + 2 preferences-redirect)
- [x] `npm run build` exits 0 (27/27 static pages, 5.0s compile)
- [x] All 3 commits land on branch (9fd6349, 2953646, f2f440a)
