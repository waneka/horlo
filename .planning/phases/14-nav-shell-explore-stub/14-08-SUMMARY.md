---
phase: 14-nav-shell-explore-stub
plan: 08
subsystem: settings-ui
tags: [nav, settings, preferences, ui]
dependency_graph:
  requires:
    - existing /preferences page (built earlier in v1.0)
    - existing SettingsClient sections (Privacy Controls, Notifications, Appearance, Data Preferences, Account)
    - SettingsSection primitive (src/components/settings/SettingsSection.tsx)
  provides:
    - Sole nav entry point to /preferences post Phase 14 (D-12)
  affects:
    - src/components/settings/SettingsClient.tsx
tech_stack:
  added:
    - none (used existing next/link, lucide-react/ChevronRight already in package.json)
  patterns:
    - heading-role query for section titles in tests (disambiguates duplicate text that also appears as row labels)
key_files:
  created:
    - tests/components/settings/SettingsClient.test.tsx
  modified:
    - src/components/settings/SettingsClient.tsx
decisions:
  - "Mock @/app/actions/profile (not @/app/actions/settings) in test — PrivacyToggleRow's actual dep is updateProfileSettings from @/app/actions/profile; @/app/actions/settings does not exist"
  - "Use heading-role query to locate section titles — the label 'Collection' appears twice (new Collection section title AND the existing PrivacyToggleRow label for collectionPublic)"
metrics:
  duration_minutes: 3
  completed_date: "2026-04-23"
requirements: [NAV-11]
---

# Phase 14 Plan 08: Settings → Taste Preferences Link Row Summary

Added a "Collection → Taste Preferences" link row inside `/settings` as the sole nav entry point to `/preferences` per D-12 (desktop HeaderNav dropped the entry in Plan 04; mobile BottomNav never surfaces it).

## What Changed

- **`src/components/settings/SettingsClient.tsx`**
  - New imports: `Link` from `next/link`, `ChevronRight` from `lucide-react`.
  - New `SettingsSection title="Collection"` placed between the Notifications and Appearance sections (RESEARCH Open Question #4 resolution).
  - Single row inside: `<Link href="/preferences">` with label "Taste Preferences", descriptive helper copy "Configure your collecting taste — case size, styles, complications, goal.", and a right-chevron affordance.
  - All five existing sections (Privacy Controls, Notifications, Appearance, Data Preferences, Account) left byte-for-byte intact.
  - Inline D-12 + Open-Question-#4 comment anchors the rationale for future readers.

- **`tests/components/settings/SettingsClient.test.tsx` (new)**
  - Six test cases: section title render, row label render, `href="/preferences"` assertion, placement-between-Notifications-and-Appearance check, regression coverage of all five existing section titles, descriptive helper copy match.
  - Mocks `@/app/actions/profile` (the real module `PrivacyToggleRow` imports) with `updateProfileSettings` stub returning a success result.
  - Uses `getByRole('heading', { level: 2, name: 'Collection' })` to disambiguate the section title from the existing PrivacyToggleRow label also named "Collection".

## Tasks & Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add "Collection → Taste Preferences" link row to SettingsClient (TDD) | 52feffe | src/components/settings/SettingsClient.tsx, tests/components/settings/SettingsClient.test.tsx |

## Verification

- `npm test -- --run tests/components/settings/SettingsClient.test.tsx` — 6/6 pass
- Full suite: `npm test -- --run` — 2251 passed / 119 skipped / 0 failed (63 test files)
- Acceptance grep checks:
  - `grep -c 'title="Collection"' src/components/settings/SettingsClient.tsx` → 1
  - `grep -c 'Taste Preferences' src/components/settings/SettingsClient.tsx` → 1
  - `grep -c 'href="/preferences"' src/components/settings/SettingsClient.tsx` → 1
  - `grep -c "import Link from 'next/link'" src/components/settings/SettingsClient.tsx` → 1
  - `grep -c "ChevronRight" src/components/settings/SettingsClient.tsx` → 2 (import + usage)
  - Existing-sections grep (5 titles) → 5
- TypeScript: `npx tsc --noEmit` — my changes introduce zero new errors. One pre-existing `LayoutProps` TS2304 in `src/app/u/[username]/layout.tsx` was confirmed pre-existing against base `ed1dc1d` and logged to `deferred-items.md` (out of scope per SCOPE BOUNDARY rule).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking issue] Wrong action-module path in plan's test mock**
- **Found during:** Task 1 (RED → GREEN test setup)
- **Issue:** The plan specified `vi.mock('@/app/actions/settings', () => ({ setVisibility: vi.fn() }))`, but `@/app/actions/settings` does not exist. `PrivacyToggleRow` imports `updateProfileSettings` from `@/app/actions/profile`.
- **Fix:** Changed the mock to `vi.mock('@/app/actions/profile', () => ({ updateProfileSettings: vi.fn(async () => ({ success: true, data: undefined })) }))`.
- **Files modified:** `tests/components/settings/SettingsClient.test.tsx`
- **Commit:** 52feffe

**2. [Rule 3 — Blocking issue] "Collection" name collision in assertions**
- **Found during:** Task 1 (after initial GREEN attempt — 2 of 6 tests still red)
- **Issue:** The plan's `getByText(/^Collection$/)` and `html.indexOf('Collection')` both matched the existing PrivacyToggleRow label "Collection" (for `collectionPublic`), not the new section title.
- **Fix:** Switched the section-title assertion to `getByRole('heading', { level: 2, name: 'Collection' })` and the placement check to iterate over only `<h2>` elements (section titles), which are unique.
- **Files modified:** `tests/components/settings/SettingsClient.test.tsx`
- **Commit:** 52feffe

No implementation-side deviations — the `SettingsClient.tsx` edit matches the plan's literal snippet.

## Known Stubs

None. The link routes to the already-implemented `/preferences` page (shipped in v1.0).

## Must-Haves Verification (from PLAN frontmatter)

- Truth 1 — Settings page contains a 'Collection' section with a 'Taste Preferences' link row routing to /preferences: **Satisfied** (src/components/settings/SettingsClient.tsx L152–165).
- Truth 2 — /preferences remains reachable on both mobile and desktop — solely via Settings: **Satisfied** (this row is now the sole entry point; desktop HeaderNav and mobile BottomNav do not surface /preferences per D-12).
- Artifact — `src/components/settings/SettingsClient.tsx` provides Collection section linking to /preferences, contains "Taste Preferences": **Satisfied** (grep confirms both tokens present once).
- Key link — `<Link href='/preferences'>` with pattern `href="/preferences"` in `src/components/settings/SettingsClient.tsx`: **Satisfied** (grep matches exactly once).

## Self-Check: PASSED

- `[ -f src/components/settings/SettingsClient.tsx ]` — FOUND
- `[ -f tests/components/settings/SettingsClient.test.tsx ]` — FOUND
- `git log --oneline --all | grep -q 52feffe` — FOUND
