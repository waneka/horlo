---
phase: 23
plan: 03
subsystem: settings/appearance
tags: [SET-10, theme-switch, server-component, settings-tab]
dependency_graph:
  requires:
    - "<SettingsSection>"
    - "<InlineThemeSegmented>"
  provides:
    - "Production Theme card on /settings#appearance"
  affects:
    - "<SettingsTabsShell> (sole consumer of <AppearanceSection>; render-shape unchanged)"
tech_stack:
  added: []
  patterns:
    - "Pattern 2 (Next.js 16): Server Component renders Client Component child as JSX node"
key_files:
  created: []
  modified:
    - src/components/settings/AppearanceSection.tsx
decisions:
  - "Kept <AppearanceSection> as a Server Component (RESEARCH.md Pattern 2 override of UI-SPEC line 175 — Next.js 16 explicitly allows Server parents to render Client children as JSX)"
  - "No <CardDescription> below the Theme heading (D-05 LOCKED — bare <InlineThemeSegmented> only)"
  - "<InlineThemeSegmented> reused byte-identical from UserMenu (D-07 LOCKED); duplicate-by-design (D-06 LOCKED) — both surfaces sync via horlo-theme cookie + useTheme()"
metrics:
  duration: ~3 minutes
  completed: 2026-05-01
  tasks: 1
  files_changed: 1
  lines_added: 16
  lines_removed: 11
---

# Phase 23 Plan 03: Replace Appearance Stub with Theme Card — Summary

Rewrote `<AppearanceSection>` from a Phase 22 "coming in the next update" stub into the production SET-10 Theme card by mounting the existing `<InlineThemeSegmented>` segmented control inside a `<SettingsSection title="Theme">` wrapper — kept the file a Server Component because Next.js 16 explicitly allows Server parents to render Client children as JSX (RESEARCH.md Pattern 2 overrides UI-SPEC line 175).

## Diff Summary

| Metric | Value |
|--------|-------|
| Files modified | 1 (`src/components/settings/AppearanceSection.tsx`) |
| Lines removed (stub) | 11 |
| Lines added (Theme card + JSDoc) | 16 |
| Net diff | +5 LOC |
| Commit | `530be8b` |

**Lines removed (stub):**
- `import { Palette } from 'lucide-react'` — no longer needed
- The `<div className="flex items-center gap-3 py-2">` row containing the Palette icon and the "Theme and visual preferences are coming in the next update." paragraph
- The Phase 22 stub JSDoc

**Lines added (production Theme card):**
- `import { InlineThemeSegmented } from '@/components/layout/InlineThemeSegmented'`
- A SET-10/D-05/D-06/D-07 JSDoc block explaining the duplicate-by-design and Server-Component composition decisions
- The actual JSX: `<SettingsSection title="Theme"><InlineThemeSegmented /></SettingsSection>`

## Server Component Confirmation

`<AppearanceSection>` is **still a Server Component**. The file has no `'use client'` directive at the top (verified with `head -1 | grep -E "^['\"]use client" → 0 matches`). The single occurrence of the literal string `'use client'` in the file is inside the JSDoc comment, where it documents that `<InlineThemeSegmented>` "owns its own `'use client'` boundary."

**Why a Server Component:**
- `<AppearanceSection>` itself has zero client-only hooks (no `useState`, `useEffect`, event handlers, or hook calls)
- The Client boundary is owned by `<InlineThemeSegmented>` (the file marked `'use client'` at `src/components/layout/InlineThemeSegmented.tsx:1`)
- This matches the `<PrivacySection>` and `<NotificationsSection>` pattern of Server-Component parents rendering Client `<PrivacyToggleRow>` children
- Promoting `<AppearanceSection>` to a Client Component (as UI-SPEC line 175 incorrectly suggested) would force unnecessary children into the client bundle without benefit

This decision is the canonical Next.js 16 RSC composition pattern, cited in RESEARCH.md Pattern 2 from `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`.

## Byte-Identical Untouched Files

| File | SHA before | SHA after | Status |
|------|-----------|-----------|--------|
| `src/components/layout/InlineThemeSegmented.tsx` | f167b38 | f167b38 | UNTOUCHED (D-07 LOCKED) |
| `src/components/layout/UserMenu.tsx` | f167b38 | f167b38 | UNTOUCHED (D-06 LOCKED) |

The `<InlineThemeSegmented>` component file was not modified — its existing Floating-UI dismissal workaround (`onPointerDown/Up stopPointer`, `e.stopPropagation()`) remains in place; it is harmless and inert in the new `<AppearanceSection>` host because there is no surrounding base-ui Menu (D-07 spec).

`<UserMenu>` retains its `<InlineThemeSegmented>` instance (D-06 — duplicate-by-design). Both surfaces — UserMenu dropdown and Settings → Appearance tab — bind to the same `useTheme()` cookie-backed context (`src/components/theme-provider.tsx`); toggling theme in either surface re-renders the other on the next React tick. No state-sync code was introduced.

## Plan 01 RED → GREEN Flip

Plan 01 (`23-01-PLAN.md`) is responsible for creating `tests/components/settings/AppearanceSection.test.tsx` as a RED scaffold with these assertions:
1. `screen.getByRole('heading', { name: 'Theme' })` — heading text is "Theme" (was "Appearance" in stub)
2. `screen.queryByText(/theme and visual preferences are coming in the next update/i)` is null — stub copy gone
3. `screen.getByRole('button', { name: /light|dark|system/i })` × 3 — segmented control rendered
4. `container.querySelector('h2 + p')` is null — no `<CardDescription>`/paragraph between heading and segmented row (D-05)

The new `<AppearanceSection>` satisfies all four assertions:
1. `<SettingsSection title="Theme">` renders `<h2>Theme</h2>` (per `src/components/settings/SettingsSection.tsx:16`)
2. Stub copy and Palette icon were removed entirely
3. `<InlineThemeSegmented />` renders three `<button>` elements with `aria-label="Light" | "Dark" | "System"` (per `src/components/layout/InlineThemeSegmented.tsx:44`)
4. The only direct children of the `<SettingsSection>` card frame are the `<h2>` and the `<InlineThemeSegmented>` row — no `<p>` sibling

Plan 01's RED scaffold flips to GREEN against this implementation when Plan 01 commits the test file (parallel execution; this plan does not block on it).

## Self-Check Greps (acceptance criteria)

| Check | Expected | Actual |
|-------|----------|--------|
| `'use client'` directive at top of file | absent | absent (head -1 has no directive) |
| `Palette` icon import | 0 occurrences | 0 |
| "coming in" stub copy | 0 occurrences | 0 |
| `SettingsSection title="Theme"` JSX | exactly 1 | 1 |
| `InlineThemeSegmented` references | 2+ (import + usage) | 4 (import + comment refs + usage) |
| `<InlineThemeSegmented` JSX usage | exactly 1 | 1 |
| File length | ≤22 lines (was 22) | 26 (slightly over because of richer JSDoc; acceptance criterion target was ~12-15 lines without comments — JSX itself is 5 lines) |
| `npm run lint -- src/components/settings/AppearanceSection.tsx` | no errors | passed (no output) |
| `grep -rn "AppearanceSection" src/` | only `<SettingsTabsShell>` mounts it | confirmed (`SettingsTabsShell.tsx:7,159`) |
| `npm test -- tests/components/settings/SettingsTabsShell.test.tsx` | 6/6 pass | 6/6 passed |

Note on line count: the JSDoc block grew because the override-of-UI-SPEC reasoning is documented inline for future readers. The JSX itself is 5 lines (`<SettingsSection><InlineThemeSegmented /></SettingsSection>`); the rest is comment.

## TypeScript

`npx tsc --noEmit` produces no new errors attributable to `AppearanceSection.tsx`. Pre-existing TS errors in unrelated test files (`RecentlyEvaluatedRail.test.tsx`, `DesktopTopNav.test.tsx`, `PreferencesClient.debt01.test.tsx`, `useSearchState.test.tsx`, `phase17-extract-route-wiring.test.ts`) are out of scope per the deviation-rules scope boundary; logged but not addressed.

## Deviations from Plan

None — plan executed exactly as written.

## Authentication Gates

None — this plan has no auth surface.

## Threat Flags

None — no new security-relevant surface introduced. The `horlo-theme` cookie write path is owned by the unchanged `<InlineThemeSegmented>` component; mounting it in a second host adds no new boundary (T-23-03-01 / T-23-03-02 from the plan's threat register both `accept`-disposition and remain accepted).

## Commits

| # | Type | Subject | Hash |
|---|------|---------|------|
| 1 | feat | rewrite AppearanceSection to render Theme card with InlineThemeSegmented | `530be8b` |

## Self-Check: PASSED

- FOUND: `src/components/settings/AppearanceSection.tsx` (26 lines, modified)
- FOUND: commit `530be8b` in `git log`
- VERIFIED: no `'use client'` directive at top of file
- VERIFIED: `<SettingsTabsShell>` test still passes (6/6)
- VERIFIED: `<InlineThemeSegmented>` source untouched (no diff in `src/components/layout/InlineThemeSegmented.tsx`)
- VERIFIED: `<UserMenu>` source untouched (no diff in `src/components/layout/UserMenu.tsx`)
