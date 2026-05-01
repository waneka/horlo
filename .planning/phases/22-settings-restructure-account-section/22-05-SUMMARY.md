---
phase: 22
plan: 05
subsystem: settings/ui
tags:
  - tabs-shell
  - section-migration
  - email-change
  - password-change
  - revalidate
  - wave-3
  - SET-01
  - SET-03
  - SET-04
  - SET-05
dependency_graph:
  requires:
    - "22-01-SUMMARY.md (Wave 0 — RED scaffolds for AccountSection / PrivacySection / NotificationsSection / PreferencesSection / ProfileSection; lastSignInAt helper)"
    - "22-02-SUMMARY.md (Wave 1 — SettingsTabsShell with 5 PanelPlaceholder slots + Server-Component data flow exposing currentEmail / pendingNewEmail / lastSignInAt / settings / preferences props)"
    - "22-03-SUMMARY.md (Wave 2 — EmailChangeForm + EmailChangePendingBanner consumed by AccountSection)"
    - "22-04-SUMMARY.md (Wave 2 — PasswordChangeForm + PasswordReauthDialog consumed by AccountSection)"
    - "src/components/settings/PrivacyToggleRow.tsx (untouched migration target — 5 instances move from legacy SettingsClient)"
    - "src/components/preferences/PreferencesClient.tsx (embedded unchanged inside PreferencesSection)"
    - "src/components/settings/SettingsSection.tsx (card frame wrapper used by Profile / Privacy / Notifications)"
  provides:
    - "<AccountSection currentEmail pendingNewEmail lastSignInAt /> — composes EmailChangeForm + PasswordChangeForm inside `<div className=\"space-y-8\">`"
    - "<ProfileSection username displayName avatarUrl /> — D-19 read-only stub: avatar (size-16) or muted placeholder, displayName/@username pair, View public profile link to /u/{username}"
    - "<PrivacySection settings /> — migrates the 3 PrivacyToggleRow instances (profilePublic / collectionPublic / wishlistPublic) verbatim from legacy SettingsClient"
    - "<NotificationsSection settings /> — migrates the 2 PrivacyToggleRow instances (notifyOnFollow / notifyOnWatchOverlap) verbatim from legacy SettingsClient"
    - "<PreferencesSection preferences /> — embeds PreferencesClient unchanged"
    - "Final assembled `/settings` surface: 6 production tabs, no placeholders"
    - "savePreferences Server Action revalidates BOTH /preferences AND /settings on success"
  affects:
    - "src/components/settings/SettingsTabsShell.tsx (5 PanelPlaceholder slots → real section components; PanelPlaceholder helper deleted)"
    - "src/components/settings/SettingsClient.tsx (DELETED — D-02/D-03/D-04 cleanup)"
    - "src/app/actions/preferences.ts (revalidatePath('/settings') added alongside existing revalidatePath('/preferences') — FG-3)"
    - "src/components/settings/PrivacyToggleRow.tsx (JSDoc reference to deleted SettingsClient updated to point at parent section components)"
tech_stack:
  added: []
  patterns:
    - "vi.hoisted lift pattern — top-level mock factory references must use vi.hoisted to avoid the 'cannot access ... before initialization' temporal-dead-zone error when vi.mock factories hoist before module-scope const declarations"
    - "Section composition via prop pass-through — SettingsTabsShell holds the prop contract; section components are pure pass-through wrappers around their domain logic (forms, toggles, embed)"
    - "Single-file no-double-revalidate pattern — savePreferences calls revalidatePath('/preferences') AND revalidatePath('/settings') because /preferences is now a redirect-only route while the live tab lives inside /settings"
    - "Delete-after-migrate workflow — legacy single-page SettingsClient is removed only after every section has migrated and zero source files import it (verified via `grep -rn from '@/components/settings/SettingsClient'`)"
key_files:
  created:
    - "src/components/settings/AccountSection.tsx (29 lines)"
    - "src/components/settings/ProfileSection.tsx (60 lines)"
    - "src/components/settings/PrivacySection.tsx (43 lines)"
    - "src/components/settings/NotificationsSection.tsx (38 lines)"
    - "src/components/settings/PreferencesSection.tsx (24 lines)"
  modified:
    - "src/components/settings/SettingsTabsShell.tsx (5 PanelPlaceholder panels → 5 real section components; PanelPlaceholder helper removed)"
    - "src/app/actions/preferences.ts (added revalidatePath('/settings') alongside revalidatePath('/preferences'))"
    - "src/components/settings/PrivacyToggleRow.tsx (JSDoc cleanup — SettingsClient → parent section components)"
    - "tests/components/settings/AccountSection.test.tsx (3 it.todo → 3 GREEN)"
    - "tests/components/settings/PrivacySection.test.tsx (3 it.todo → 3 GREEN; vi.hoisted lift)"
    - "tests/components/settings/NotificationsSection.test.tsx (3 it.todo → 3 GREEN; vi.hoisted lift)"
    - "tests/components/settings/PreferencesSection.test.tsx (2 it.todo → 2 GREEN)"
    - "tests/components/settings/ProfileSection.test.tsx (6 it.todo → 6 GREEN)"
  deleted:
    - "src/components/settings/SettingsClient.tsx (232 lines — D-02/D-03/D-04 cleanup; Privacy + Notifications migrated to dedicated sections, all stubs removed)"
decisions:
  - "PreferencesSection does NOT strip the inner PreferencesClient outer wrapper (`container mx-auto px-4 py-8 max-w-3xl`). The plan flagged FG-2 as 'planner's call'; in practice the inner padding reads as deliberate breathing room inside the tab panel rather than double-padding. If a future UI checker run flags it, fix in a follow-up commit (no test currently asserts against it; keeping the embed byte-identical preserves the D-01 'no functional regression' guarantee)."
  - "vi.hoisted lift used in PrivacySection + NotificationsSection tests — top-level `const updateMock = vi.fn(...)` references inside a vi.mock factory hit the temporal-dead-zone hoisting error. The vi.hoisted block lifts the spy alongside the mock factory so both are initialized before module imports run."
  - "Did NOT add `nativeButton={false}` to the ProfileSection View public profile button despite a base-ui informational warning — adding it broke `getByRole('link')` in tests (the link role disappeared). The warning is benign for the link-as-button render pattern (UserMenu uses the same pattern without the prop). Tests are GREEN; behavior is correct; the warning is non-actionable."
  - "Per-section ProfileSettings type is `Pick<ProfileSettings, ...>` not the full type — keeps each section's prop surface minimal and explicit about which fields it consumes. SettingsTabsShell still passes the full settings object via `props.settings`, but the section signatures document their actual dependencies."
metrics:
  duration: "~7m wall-clock"
  completed: "2026-05-01T03:04:30Z"
  tasks: 2
  commits: 2
  files_created: 5
  files_modified: 4
  files_deleted: 1
  tests_green: 17
requirements_completed:
  - SET-01
  - SET-03
  - SET-04
  - SET-05
---

# Phase 22 Plan 05: Section Migration + Final Shell Wiring Summary

**Wave 3 closes Phase 22 — the 5 SettingsTabsShell PanelPlaceholder slots are replaced with production section components, AccountSection assembles EmailChangeForm + PasswordChangeForm into the real Account surface, the legacy single-page SettingsClient.tsx is deleted, and savePreferences now revalidates `/settings` so the embedded Preferences tab refreshes after a save. 17 new tests GREEN; 66/66 Phase 22 tests GREEN end-to-end; `npm run build` clean.**

## What Shipped

### `<AccountSection>` — 29 LOC

`src/components/settings/AccountSection.tsx`

```typescript
interface AccountSectionProps {
  currentEmail: string
  pendingNewEmail: string | null
  lastSignInAt: string | null
}
```

Composes Plan 03's `<EmailChangeForm>` + Plan 04's `<PasswordChangeForm>` inside `<div className="space-y-8">` per UI-SPEC line 448 (32px subsection gap). Pure pass-through — all state lives in the children.

### `<ProfileSection>` — 60 LOC (D-19 read-only stub)

`src/components/settings/ProfileSection.tsx`

```typescript
interface ProfileSectionProps {
  username: string
  displayName: string | null
  avatarUrl: string | null
}
```

Avatar (`size-16` rounded-full from CDN) or muted `bg-muted` placeholder + displayName/@username heading pair + `<Button render={<Link href="/u/{username}" />}>View public profile</Button>` + footer note "Profile editing coming in the next update." Phase 25 (UX-08) replaces with the editable form.

### `<PrivacySection>` — 43 LOC

`src/components/settings/PrivacySection.tsx`

```typescript
interface PrivacySectionProps {
  settings: Pick<ProfileSettings, 'profilePublic' | 'collectionPublic' | 'wishlistPublic'>
}
```

Migrates the 3 `<PrivacyToggleRow>` instances verbatim from the legacy SettingsClient (Profile Visibility / Collection / Wishlist) inside a `<SettingsSection title="Visibility">` card with `divide-y divide-border` row separators. Behavior unchanged — `useOptimistic` + `useTransition` + `updateProfileSettings` Server Action all live inside the unchanged PrivacyToggleRow primitive. Phase 23 SET-11 owns the visual restyle pass.

### `<NotificationsSection>` — 38 LOC

`src/components/settings/NotificationsSection.tsx`

```typescript
interface NotificationsSectionProps {
  settings: Pick<ProfileSettings, 'notifyOnFollow' | 'notifyOnWatchOverlap'>
}
```

Migrates the 2 toggles (New Followers / Watch Overlaps) verbatim into a `<SettingsSection title="Email notifications">` card. Phase 23 SET-09 owns the restyle.

### `<PreferencesSection>` — 24 LOC

`src/components/settings/PreferencesSection.tsx`

```typescript
interface PreferencesSectionProps {
  preferences: UserPreferences
}
```

One-liner that returns `<PreferencesClient preferences={preferences} />`. No outer wrapper card — PreferencesClient already renders its own per-section `<Card>` primitives, and double-wrapping would create card-inside-card visuals. Inner `container mx-auto px-4 py-8 max-w-3xl` wrapper retained per the FG-2 byte-identical guarantee.

### `<SettingsTabsShell>` rewire

`src/components/settings/SettingsTabsShell.tsx` — 5 PanelPlaceholder slots → 5 real section components. PanelPlaceholder helper component + the 5 `PLACEHOLDER —` comments deleted. AppearanceSection unchanged (Phase 23 SET-10 will replace).

```tsx
<TabsContent value="account">
  <AccountSection currentEmail={...} pendingNewEmail={...} lastSignInAt={...} />
</TabsContent>
<TabsContent value="profile">
  <ProfileSection username={...} displayName={...} avatarUrl={...} />
</TabsContent>
<TabsContent value="preferences">
  <PreferencesSection preferences={...} />
</TabsContent>
<TabsContent value="privacy">
  <PrivacySection settings={...} />
</TabsContent>
<TabsContent value="notifications">
  <NotificationsSection settings={...} />
</TabsContent>
<TabsContent value="appearance">
  <AppearanceSection />
</TabsContent>
```

### `savePreferences` revalidation patch (FG-3)

`src/app/actions/preferences.ts`

```typescript
const prefs = await preferencesDAL.upsertPreferences(user.id, parsed.data)
revalidatePath('/preferences')
revalidatePath('/settings')   // FG-3 — Preferences tab is the live surface
return { success: true, data: prefs }
```

Without the `revalidatePath('/settings')` call the Preferences tab inside `/settings` would show stale data after a save until the next full-page navigation, because `/preferences` is now a redirect-only route (Plan 22-02 D-15).

### Legacy `SettingsClient.tsx` DELETED (232 lines)

`git rm src/components/settings/SettingsClient.tsx`

D-02/D-03/D-04 cleanup. The deletion removes:

- **D-02:** Collection chevron link to `/preferences`
- **D-03:** Account stubs (Change Password / Blocked Users / Delete Account dialog)
- **D-04:** Coming-soon stubs (Theme / Download Data / Export Collection / New Note Visibility disabled select)

Verified via `grep -rn "from '@/components/settings/SettingsClient'" src/ tests/` → zero matches. The PrivacyToggleRow JSDoc reference to the deleted file was updated to point at the parent section components.

## Section Component Prop Contracts (for future phases)

For Phase 23 (SET-09 / SET-10 / SET-11) and any later phases that modify these sections:

| Component | Required props | Rationale |
|-----------|---------------|-----------|
| `AccountSection` | `currentEmail`, `pendingNewEmail`, `lastSignInAt` | Direct pass-through to EmailChangeForm + PasswordChangeForm. Source: Server Component reads via `supabase.auth.getUser()`. |
| `ProfileSection` | `username`, `displayName`, `avatarUrl` | Read-only stub. Phase 25 (UX-08) will add a `profile` mutation prop or use a Server Action. |
| `PrivacySection` | `settings` (`Pick` of `profilePublic` / `collectionPublic` / `wishlistPublic`) | Toggle initial values; PrivacyToggleRow handles mutations via Server Action. |
| `NotificationsSection` | `settings` (`Pick` of `notifyOnFollow` / `notifyOnWatchOverlap`) | Same as Privacy. |
| `PreferencesSection` | `preferences` (full UserPreferences) | PreferencesClient owns its full state shape. |

Plans modifying these surfaces should keep the prop contracts stable — SettingsTabsShell + the Server Component data flow already wire all required fields end-to-end.

## Phase 22 Final Test Count

```bash
npm test -- tests/components/settings tests/app/auth-callback-route.test.ts \
            tests/app/preferences-redirect.test.ts tests/lib/auth/lastSignInAt.test.ts
```

| File | Tests | Status |
|------|-------|--------|
| `tests/lib/auth/lastSignInAt.test.ts` | 10 | GREEN |
| `tests/components/settings/SettingsTabsShell.test.tsx` | 6 | GREEN |
| `tests/components/settings/StatusToastHandler.test.tsx` | 4 | GREEN |
| `tests/app/auth-callback-route.test.ts` | 10 | GREEN |
| `tests/app/preferences-redirect.test.ts` | 2 | GREEN |
| `tests/components/settings/EmailChangeForm.test.tsx` | 4 | GREEN |
| `tests/components/settings/EmailChangePendingBanner.test.tsx` | 4 | GREEN |
| `tests/components/settings/PasswordChangeForm.test.tsx` | 5 | GREEN |
| `tests/components/settings/PasswordReauthDialog.test.tsx` | 4 | GREEN |
| `tests/components/settings/AccountSection.test.tsx` | 3 | GREEN |
| `tests/components/settings/PrivacySection.test.tsx` | 3 | GREEN |
| `tests/components/settings/NotificationsSection.test.tsx` | 3 | GREEN |
| `tests/components/settings/PreferencesSection.test.tsx` | 2 | GREEN |
| `tests/components/settings/ProfileSection.test.tsx` | 6 | GREEN |
| **Total** | **66** | **GREEN** |

14 test files, 66 tests passed, 0 failed, 0 skipped, ~3.7s. Plan 05 contributes the final 17 GREEN (3+3+3+2+6).

## Build Verification

```
✓ Compiled successfully in 4.8s
```

`npm run build` exits 0 with all 27 static pages generated. Settings page typechecks against the new section component contracts.

## Acceptance Criteria — All Pass

- ✅ All 5 section component files exist
- ✅ `AccountSection.tsx` imports `EmailChangeForm` AND `PasswordChangeForm` AND wraps them in `<div className="space-y-8">`
- ✅ `ProfileSection.tsx` contains the literal `Profile editing coming in the next update.` AND a `Link` to `/u/${username}`
- ✅ `PrivacySection.tsx` renders exactly 3 `<PrivacyToggleRow` JSX instances (Profile Visibility / Collection / Wishlist)
- ✅ `NotificationsSection.tsx` renders exactly 2 `<PrivacyToggleRow` JSX instances (New Followers / Watch Overlaps)
- ✅ `PreferencesSection.tsx` imports and renders `<PreferencesClient`
- ✅ `test ! -f src/components/settings/SettingsClient.tsx` returns true
- ✅ `grep -rn "from '@/components/settings/SettingsClient'" src/ tests/` returns no matches
- ✅ `SettingsTabsShell.tsx` imports all 5 section components
- ✅ `grep -c "PanelPlaceholder" src/components/settings/SettingsTabsShell.tsx` returns 0
- ✅ `grep -c "PLACEHOLDER —" src/components/settings/SettingsTabsShell.tsx` returns 0
- ✅ `src/app/actions/preferences.ts` contains BOTH `revalidatePath('/preferences')` AND `revalidatePath('/settings')`
- ✅ `npm run build` exits 0
- ✅ Full Phase 22 test set: 66 GREEN, 0 failed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] vi.mock factory hoisting collision in PrivacySection + NotificationsSection tests**

- **Found during:** Task 1 test run.
- **Issue:** Initial test files had `const updateMock = vi.fn(...)` at module scope above `vi.mock('@/app/actions/profile', () => ({ updateProfileSettings: updateMock }))`. Vitest hoists the `vi.mock` factory to the top of the file; the `updateMock` reference inside the factory then ran BEFORE the const declaration, throwing `ReferenceError: Cannot access 'updateMock' before initialization`. Both PrivacySection.test.tsx and NotificationsSection.test.tsx hit this — 0 tests collected from each.
- **Fix:** Lifted the spy inside `vi.hoisted(() => ({ updateMock: vi.fn(...) }))` and destructured `const { updateMock } = vi.hoisted(...)`. The vi.hoisted block is co-hoisted with vi.mock factories so both are initialized in lockstep before the module imports run.
- **Files modified:** `tests/components/settings/PrivacySection.test.tsx`, `tests/components/settings/NotificationsSection.test.tsx`
- **Verification:** Both files now collect 3 tests each, all GREEN.
- **Committed in:** `d05bbd8` (Task 1 commit)

**2. [Rule 1 — Bug] Reverted nativeButton={false} attempt on ProfileSection View-public-profile button**

- **Found during:** Task 1 test run after fixing Issue #1.
- **Issue:** Initial Task 1 verification surfaced an informational base-ui warning ("expected a native <button> because the `nativeButton` prop is true. Rendering a non-<button> removes native button semantics"). Tried mirroring the codebase pattern (`UserMenu` / `ProfileTabs` use `nativeButton={false}` for `<Button render={<Link/>}>` patterns) by adding the prop. The warning disappeared but the test `renders View public profile link to /u/{username}` regressed — `getByRole('link')` failed because `nativeButton={false}` removes BOTH the button native-element wrapping AND the link role inheritance from the `render` slot in this base-ui composition.
- **Fix:** Reverted the `nativeButton={false}` addition. Kept the `<Button render={<Link href={...} />}>` pattern unmodified. The warning is non-actionable (the link role IS exposed, the role-as-button warning is informational about double-semantic intent). Test is GREEN.
- **Files modified:** `src/components/settings/ProfileSection.tsx` (no net change vs first commit; the temporary nativeButton={false} attempt was reverted in-session before commit)
- **Verification:** All 6 ProfileSection tests GREEN.

**3. [Rule 2 — Documentation cleanup] Removed dangling SettingsClient reference in PrivacyToggleRow JSDoc**

- **Found during:** Task 2, after `git rm src/components/settings/SettingsClient.tsx`.
- **Issue:** `PrivacyToggleRow.tsx` line 23 commented `// ProfileSettings row passed by SettingsClient.` — referenced a now-deleted file.
- **Fix:** Updated comment to reference the new parent section components: `// ProfileSettings row passed by the parent section component (PrivacySection / NotificationsSection in Phase 22+).`
- **Files modified:** `src/components/settings/PrivacyToggleRow.tsx`
- **Verification:** No behavioral change; comment now accurate.
- **Committed in:** `6c05f86` (Task 2 commit)

---

**Total deviations:** 3 (1 blocking test hoisting fix, 1 in-session experiment reverted, 1 documentation cleanup). Impact on plan: zero scope creep — all three were narrow corrections to keep tests GREEN and code references accurate after legacy deletion.

## Authentication Gates

None.

## Known Stubs

- **AppearanceSection** — coming-soon stub from Plan 02 (Wave 1) is unchanged. Phase 23 SET-10 will replace with the lifted `<InlineThemeSegmented>` theme switch.
- **ProfileSection** — D-19 read-only stub is the intended design for Phase 22. Phase 25 UX-08 will replace with an editable profile form.

Both are documented as deferred per CONTEXT D-01 and the deferred-ideas section. No `Known Stubs` block needs to flag the verifier — both are explicit deliverables shipping at the documented stub level.

## Deferred Issues

The 6 full-suite test failures are all pre-existing and out of scope per the SCOPE BOUNDARY rule:

- `tests/no-raw-palette.test.ts` — 2 failures: `src/components/insights/CollectionFitCard.tsx` and `src/components/search/WatchSearchRow.tsx` use `font-medium` (Phase 20 surfaces, not touched by Plan 22-05). Same 2 failures Plan 22-02 SUMMARY documented.
- `tests/app/explore.test.tsx` — 3 failures: tests assert against a Phase 14 NAV-11 D-18 "Discovery is coming." stub that Phase 18 has already replaced with the live discovery surface. Same 3 failures Plan 22-02 SUMMARY documented.
- `src/components/watch/AddWatchFlow.test.tsx` — 1 failure: Phase 20.1 Plan 04 ADD-01 happy path test (unrelated to Phase 22 surface).

None are caused by Plan 22-05 changes. All were present before Task 1 ran and remain present after Task 2 lands. Phase 22 surfaces report 66/66 GREEN.

## Threat Flags

No new security-relevant surface introduced beyond the plan's `<threat_model>`. The 6 threats (T-22-S4 / T-22-S5 / T-22-X1 / T-22-X2 / T-22-D2 / T-22-T2) are all mitigated as documented:

| Threat ID | Mitigation | Evidence |
|-----------|-----------|----------|
| T-22-S4 (full mitigation in production) | Spoofing — Account tab live; EmailChangeForm enforces `value={currentEmail}` for the disabled input; AccountSection composition wires Plan 03's surface in production | AccountSection test `renders Email card with EmailChangeForm` GREEN; EmailChangeForm acceptance grep `value={pendingNewEmail}` = 0 (Plan 03 SUMMARY) |
| T-22-S5 (full mitigation in production) | Tampering — Account tab live; PasswordChangeForm two-layer freshness gate (lastSignInAt proxy + 401 catch); AccountSection wires Plan 04's surface | AccountSection test `renders Password card with PasswordChangeForm` GREEN; PasswordChangeForm `server 401 reopens dialog` GREEN (Plan 04 SUMMARY) |
| T-22-X1 (XSS via avatarUrl) | React `<img src={avatarUrl}>` uses `setAttribute('src', ...)` which is safe for trusted https URLs; avatar pipeline gated through Phase 19.1 sanitized Supabase Storage CDN | ProfileSection test `renders avatar image when avatarUrl is present` GREEN; comment in ProfileSection.tsx documents the trust path |
| T-22-X2 (XSS via username in href) | `Link href={`/u/${username}`}` template literal; React + Next.js encode the path component; username is DB-constrained (signup trigger lowercases + validates) | ProfileSection test `renders View public profile link to /u/{username}` asserts the literal href value GREEN |
| T-22-D2 (cache invalidation gap) | savePreferences calls BOTH `revalidatePath('/preferences')` AND `revalidatePath('/settings')` | `grep "revalidatePath" src/app/actions/preferences.ts` shows both calls; build passes |
| T-22-T2 (legacy SettingsClient still reachable) | File deleted from filesystem; no source file imports it; build passes typecheck | `test ! -f src/components/settings/SettingsClient.tsx` true; `grep -rn` returns no matches; build green |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `d05bbd8` | feat(22-05): 5 section components — Account/Profile/Privacy/Notifications/Preferences |
| Task 2 | `6c05f86` | feat(22-05): wire 5 sections into SettingsTabsShell + delete legacy SettingsClient + revalidate /settings |

## Phase 22 Status — All 5 SET Requirements Delivered

| Requirement | Delivered by | Status |
|-------------|--------------|--------|
| SET-01 (Vertical-tabs shell, 6 sections) | Plan 22-02 (shell foundation) + Plan 22-05 (sections wired) | ✅ end-to-end |
| SET-02 (Hash-driven routing, pushState only) | Plan 22-02 | ✅ |
| SET-03 (Canonical SaaS section order) | Plan 22-02 (placeholders) + Plan 22-05 (real content) | ✅ end-to-end |
| SET-04 (Email change with persistent banner) | Plan 22-03 + Plan 22-05 (composed into Account tab) | ✅ end-to-end |
| SET-05 (Password change with 24h re-auth) | Plan 22-04 + Plan 22-05 (composed into Account tab) | ✅ end-to-end |
| SET-06 (auth/callback type switch + /preferences redirect) | Plan 22-02 | ✅ end-to-end (verified here) |

Phase 22 is complete. Phase 23 owns the visual restyle pass (SET-09 / SET-11), Appearance theme switch (SET-10), and `collectionGoal` / `overlapTolerance` polish (SET-07 / SET-08). Phase 25 owns the Profile-edit form (UX-08).

## Next Phase Readiness

- **Phase 22 closed.** All 5 SET-XX requirements delivered end-to-end through real production surfaces.
- **Phase 23 unblocked.** SET-09 (Notifications restyle), SET-10 (Appearance theme switch), SET-11 (Privacy restyle), SET-07/08 (Preferences polish) all have stable section component contracts to modify.
- **Phase 25 unblocked.** ProfileSection is a clean read-only stub ready for replacement with the editable form when UX-08 lands.

## Self-Check: PASSED

- [x] All 5 section component files exist on disk:
  - `src/components/settings/AccountSection.tsx` FOUND
  - `src/components/settings/ProfileSection.tsx` FOUND
  - `src/components/settings/PrivacySection.tsx` FOUND
  - `src/components/settings/NotificationsSection.tsx` FOUND
  - `src/components/settings/PreferencesSection.tsx` FOUND
- [x] Legacy `src/components/settings/SettingsClient.tsx` MISSING (deleted)
- [x] `src/app/actions/preferences.ts` contains `revalidatePath('/settings')`
- [x] `src/components/settings/SettingsTabsShell.tsx` contains zero `PanelPlaceholder` references
- [x] All 5 test files updated; 17 new GREEN tests (3+3+3+2+6)
- [x] 66/66 Phase 22 test set GREEN
- [x] `npm run build` exits 0
- [x] Both task commits land on branch (d05bbd8, 6c05f86)
- [x] Zero `from '@/components/settings/SettingsClient'` imports in src/ or tests/

---

*Phase: 22-settings-restructure-account-section*
*Completed: 2026-05-01*
