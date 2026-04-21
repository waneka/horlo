---
phase: 08-self-profile-privacy-controls
plan: 02
subsystem: profile-and-settings-ui
tags: [profile, settings, route-shell, react-19, useoptimistic, privacy, app-router-tabs]

requires:
  - phase: 08-self-profile-privacy-controls
    plan: 01
    provides: profiles DAL, Server Actions (updateProfile / updateProfileSettings), computeTasteTags, ProfileSettings type, VisibilityField type
  - phase: 07-social-schema-profile-auto-creation
    provides: profiles + profile_settings tables, getProfileById in DAL
  - phase: 06-rls-foundation
    provides: server-only DB access via @/db
provides:
  - "/u/[username] route group (layout + index redirect + [tab] placeholder)"
  - ProfileHeader with inline edit mode (Edit Profile button + ProfileEditForm)
  - LockedProfileState (Letterboxd-style PRIV-06 surface)
  - ProfileTabs (URL-driven via usePathname, 5 tabs)
  - AvatarDisplay (next/image with safe URL + initials fallback)
  - TasteTagPill (token-only Badge wrapper)
  - /settings page (auth-gated Server Component)
  - SettingsSection / SettingsClient / PrivacyToggleRow (4 functional toggles + localStorage-persisted note default)
  - HeaderNav extension (Profile + Settings entry points)
affects: [profile-route-shell, settings-page, header-nav, app-layout]

tech-stack:
  added: []
  patterns:
    - "URL-driven tabs: TabsTrigger with render={<Link />} prop; activeTab derived from usePathname endsWith"
    - "Optimistic UI: useOptimistic + useTransition; failed save snaps back via parent re-render with original initialValue prop"
    - "Auth-gated Server Component: try/catch sets needsLogin flag; redirect() called OUTSIDE try (Pitfall 2)"
    - "SSR-safe localStorage: useState initial = static default; useEffect hydrates from localStorage on mount"
    - "Threat-model–driven enum validation: stored localStorage values validated against 'public'|'private' before apply (T-08-15a)"
    - "Header passes server-resolved username to client HeaderNav so the Profile link only renders once we know the viewer's identity"

key-files:
  created:
    - src/app/u/[username]/layout.tsx
    - src/app/u/[username]/page.tsx
    - src/app/u/[username]/[tab]/page.tsx
    - src/app/settings/page.tsx
    - src/components/profile/AvatarDisplay.tsx
    - src/components/profile/TasteTagPill.tsx
    - src/components/profile/LockedProfileState.tsx
    - src/components/profile/ProfileTabs.tsx
    - src/components/profile/ProfileHeader.tsx
    - src/components/profile/ProfileEditForm.tsx
    - src/components/settings/SettingsSection.tsx
    - src/components/settings/PrivacyToggleRow.tsx
    - src/components/settings/SettingsClient.tsx
    - tests/components/profile/LockedProfileState.test.tsx
  modified:
    - src/components/layout/HeaderNav.tsx (added optional username prop + Profile + Settings nav items)
    - src/components/layout/Header.tsx (looks up viewer profile via getProfileById to feed username down)

key-decisions:
  - "Test file lives at tests/components/profile/LockedProfileState.test.tsx (NOT co-located in src/) — vitest.config.ts only includes 'tests/**/*.test.{ts,tsx}'. Plan author's co-located path would have been silently skipped."
  - "Settings auth gate uses needsLogin flag pattern so redirect() runs OUTSIDE try/catch (Next.js NEXT_REDIRECT propagation requirement)"
  - "ProfileEditForm sends avatarUrl as null when the trimmed input is empty so Zod .url() validator on the Server Action does not reject empty string"
  - "HeaderNav's Profile link uses startsWith match on /u/{username} so any tab keeps the link highlighted; Settings uses exact match"
  - "noteDefault initial useState value is the static 'public' default — localStorage hydration deferred to useEffect so SSR markup matches first client render (no hydration mismatch)"
  - "Per project rule (no-raw-palette.test.ts), font-medium / font-bold / font-light are forbidden in src/components/** — used font-semibold (Heading) and font-normal (Body) only, matching UI-SPEC's two-weight system"

requirements-completed: [PROF-01, PROF-07, PROF-10, PRIV-01, PRIV-02, PRIV-03, PRIV-04, PRIV-05, PRIV-06]

duration: ~30 min
completed: 2026-04-21
---

# Plan 08-02: Profile Route Shell + Settings Summary

**Ships the user-visible skeleton of the profile experience: `/u/[username]/[tab]` lands on Collection by default, ProfileHeader exposes owner identity + counts + taste tags + inline edit, and `/settings` flips the four PRIV toggles with optimistic UI plus a localStorage-persisted New Note Visibility default.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 3 (3 auto, 0 checkpoints)
- **Commits:** 3 (1 per task, all pre-commit-hook bypassed via --no-verify per parallel-execution protocol)
- **New files:** 14 (4 routes/pages, 9 components, 1 test)
- **Modified files:** 2 (Header.tsx, HeaderNav.tsx)
- **Test additions:** 3 (LockedProfileState — copy / counts / disabled Follow)

## Accomplishments
- Profile route shell at `/u/[username]/[tab]` with Next.js 16 async-params handled correctly (`await params` in Server Components)
- Default redirect at `/u/[username]` → `/u/[username]/collection` outside try/catch (NEXT_REDIRECT propagates)
- 5-tab whitelist (`collection|wishlist|worn|notes|stats`) with notFound() on unknown segments
- Layout fetches profile + settings + counts + watches + wear events in parallel; computes taste tags via Plan 01's `computeTasteTags`
- Letterboxd locked-profile pattern (PRIV-06): private + non-owner viewer renders LockedProfileState (avatar, name, bio, counts, disabled Follow button); owner always sees full profile
- ProfileHeader (Client Component) with inline Edit mode swap — clicking Edit Profile replaces the header with ProfileEditForm; Save persists via `updateProfile` Server Action; Discard returns without saving; error surface uses `text-destructive` token
- AvatarDisplay routes URLs through `getSafeImageUrl` (Phase 1 SSRF guard) and falls back to initials on `bg-accent`
- TasteTagPill uses Badge primitive with token-only colors (no hex)
- ProfileTabs is URL-driven via `usePathname` — back/forward navigation works natively, no React state for active tab
- HeaderNav extended with Profile + Settings links; Header (Server Component) does the `getProfileById` lookup so the Profile link only appears once viewer username is known
- /settings Server Component: auth-gated (redirect to `/login?next=/settings` on UnauthorizedError), fetches profile + settings via `Promise.all`
- 4 functional PRIV toggles wired through `PrivacyToggleRow` using React 19 `useOptimistic` + `useTransition`; failed save snaps back via parent re-render
- "New Note Visibility" Select persists to `window.localStorage` under `horlo:noteVisibilityDefault` with enum validation (T-08-15a mitigation); default `'public'` when unset
- Structure-only Appearance / Notifications / Data Preferences / Account sections with "Coming soon" Badges
- Delete Account opens a Dialog with exact UI-SPEC copy ("Delete your account?" / "This permanently deletes your profile, collection, and all data. This cannot be undone.") and a disabled destructive confirm

## Task Commits

1. **Task 1 (auto, TDD-RED + GREEN combined):** route shell + tabs + locked state + nav extension — `094840d`
2. **Task 2 (auto):** ProfileHeader + ProfileEditForm + layout wires real header — `44f07f2`
3. **Task 3 (auto):** /settings page + SettingsClient + 4 optimistic toggles + localStorage note default + Delete dialog — `ac165a8`

## Files Created/Modified

**Created (14):**
- `src/app/u/[username]/layout.tsx` — shared profile layout (parallel data fetch, taste tags, locked-state branch)
- `src/app/u/[username]/page.tsx` — redirect to collection
- `src/app/u/[username]/[tab]/page.tsx` — tab whitelist + placeholder content (filled by Plans 03/04)
- `src/app/settings/page.tsx` — auth-gated Settings page
- `src/components/profile/AvatarDisplay.tsx`
- `src/components/profile/TasteTagPill.tsx`
- `src/components/profile/LockedProfileState.tsx`
- `src/components/profile/ProfileTabs.tsx`
- `src/components/profile/ProfileHeader.tsx`
- `src/components/profile/ProfileEditForm.tsx`
- `src/components/settings/SettingsSection.tsx`
- `src/components/settings/PrivacyToggleRow.tsx`
- `src/components/settings/SettingsClient.tsx`
- `tests/components/profile/LockedProfileState.test.tsx`

**Modified (2):**
- `src/components/layout/HeaderNav.tsx` — accepts optional `username` prop; appends Profile (startsWith match) + Settings (exact match) nav items
- `src/components/layout/Header.tsx` — calls `getProfileById` to resolve viewer username and passes it to HeaderNav

## Decisions Made
- **Test path overridden** — plan said `src/components/profile/LockedProfileState.test.tsx` (co-located). Project's `vitest.config.ts` only includes `tests/**/*.test.{ts,tsx}`, so a co-located file would never run. Placed at `tests/components/profile/LockedProfileState.test.tsx` to match convention. Same pattern as Plan 01.
- **Auth-gate flag pattern** — `redirect()` throws NEXT_REDIRECT, which would be re-caught if called inside the same try/catch block. Used a `needsLogin` flag inside the catch and called `redirect()` outside the try.
- **Empty avatar URL → null** — Server Action's Zod schema uses `.url()` which rejects empty string. ProfileEditForm sends `null` instead of `""` so the user can clear their avatar.
- **HeaderNav.username is optional** — when the viewer is unauthenticated or the profile lookup fails, the Profile link is omitted entirely (Settings still shown so unauthenticated visitors can be redirected to login when they click).
- **Two-weight typography** — `no-raw-palette.test.ts` forbids `font-medium` / `font-bold` / `font-light` in `src/components/**`. Used only `font-semibold` (Heading/Display) and `font-normal` (Body/Label), matching the UI-SPEC.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] `redirect()` inside try/catch in `src/app/settings/page.tsx`**
- **Found during:** Task 3
- **Issue:** Plan snippet placed `redirect('/login?next=/settings')` inside the `catch (err)` block. Per project rules and Next.js semantics, `redirect()` throws `NEXT_REDIRECT`, which would be re-caught by the same enclosing catch in any wider scope and could mask the redirect. Even within an `instanceof UnauthorizedError` branch, the project rule is unambiguous: `redirect()` outside try/catch.
- **Fix:** Restructured to set a `needsLogin` flag inside the catch, then call `redirect('/login?next=/settings')` AFTER the try block exits.
- **Files modified:** `src/app/settings/page.tsx`
- **Commit:** `ac165a8`

**2. [Project rule — Test convention] `tests/components/profile/LockedProfileState.test.tsx`**
- **Found during:** Task 1 RED phase
- **Issue:** Plan specified `src/components/profile/LockedProfileState.test.tsx` (co-located). Project's `vitest.config.ts` only matches `tests/**/*.test.{ts,tsx}` — a co-located test would silently never run.
- **Fix:** Placed test at `tests/components/profile/LockedProfileState.test.tsx`.
- **Files modified:** `tests/components/profile/LockedProfileState.test.tsx`
- **Commit:** `094840d`
- **Note:** This is the same plan-spec defect that Plan 01 also auto-fixed. Plan author convention should be updated.

**3. [Rule 1 — Type error] `Select onValueChange` signature**
- **Found during:** Task 3 (caught by `npx tsc --noEmit`)
- **Issue:** Plan snippet typed the handler as `(v: string) => void`, but base-ui's `Select onValueChange` is `(value: T | null, ...) => void`. tsc reported TS2322.
- **Fix:** Widened handler signature to `(v: string | null)` — the existing fallback `v === 'private' ? 'private' : 'public'` already handles `null` gracefully.
- **Files modified:** `src/components/settings/SettingsClient.tsx`
- **Commit:** `ac165a8`

---

**Total deviations:** 3 — one bug auto-fix (redirect), one project-rule deviation (test path), one type fix (Select handler signature)
**Impact on plan:** No scope change. All deviations preserve plan intent and align with project conventions.

## Threat Flags

None — surfaces introduced in this plan are accounted for in the plan's threat model (T-08-09 through T-08-15a). No new network endpoints, auth paths, file access, or schema changes at trust boundaries beyond what Plan 01 already established.

## Issues Encountered
- Pre-existing TS2578 in `tests/balance-chart.test.tsx` (unused `@ts-expect-error`) — documented in Plan 01 SUMMARY, not caused by this plan.
- Worktree did not have `node_modules` installed; symlinked `node_modules` from the parent worktree (`/Users/tylerwaneka/Documents/horlo/node_modules`) to run tsc/tests/build. Symlink is gitignored.
- Worktree base required a `git reset --soft 1e56c128` per the orchestrator's instructions; previous HEAD had unrelated future-state changes that were not part of Plan 02 work. After reset, `git checkout HEAD -- .` materialized the Wave-1-complete tree before starting Task 1.

## User Setup Required
None.

## Verification Results
- `npx tsc --noEmit` — clean apart from pre-existing `tests/balance-chart.test.tsx` TS2578 (Plan 01 known issue)
- `npm test -- --run tests/components/profile/LockedProfileState.test.tsx` — 3/3 passing
- `npm test -- --run tests/no-raw-palette.test.ts` — 799/799 passing (covers all new components)
- `npm run build` — succeeded; all 14 routes generate including `/u/[username]`, `/u/[username]/[tab]`, `/settings`

## Next Phase Readiness
- Plan 03 (Collection / Wishlist / Notes tabs) can now mount tab content inside `src/app/u/[username]/[tab]/page.tsx` — replace the placeholder section with real Collection grid for tab=`collection` etc.
- Plan 04 (Worn / Stats tabs + remaining UAT) can plug into the same tab page using the existing layout chrome
- HeaderNav already exposes Profile + Settings entry points so users reach all new routes without typing URLs
- `updateProfile`, `updateProfileSettings` Server Actions already wired and proven against the optimistic UI — Plan 03's Notes pill toggle can mirror the same `useOptimistic + useTransition` pattern using `updateNoteVisibility` from Plan 01

---

## Self-Check: PASSED

**Files created (verified on disk):**
- FOUND: src/app/u/[username]/layout.tsx
- FOUND: src/app/u/[username]/page.tsx
- FOUND: src/app/u/[username]/[tab]/page.tsx
- FOUND: src/app/settings/page.tsx
- FOUND: src/components/profile/AvatarDisplay.tsx
- FOUND: src/components/profile/TasteTagPill.tsx
- FOUND: src/components/profile/LockedProfileState.tsx
- FOUND: src/components/profile/ProfileTabs.tsx
- FOUND: src/components/profile/ProfileHeader.tsx
- FOUND: src/components/profile/ProfileEditForm.tsx
- FOUND: src/components/settings/SettingsSection.tsx
- FOUND: src/components/settings/PrivacyToggleRow.tsx
- FOUND: src/components/settings/SettingsClient.tsx
- FOUND: tests/components/profile/LockedProfileState.test.tsx

**Commits (verified in git log):**
- FOUND: 094840d feat(08-02): profile route shell + tabs + locked state + nav links
- FOUND: 44f07f2 feat(08-02): ProfileHeader with inline edit mode + ProfileEditForm
- FOUND: ac165a8 feat(08-02): /settings with optimistic privacy toggles + localStorage default

---
*Phase: 08-self-profile-privacy-controls*
*Completed: 2026-04-21*
