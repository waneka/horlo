---
phase: 15-wywt-photo-post-flow
plan: 02
subsystem: ui
tags: [sonner, toast, theme, layout, ui, cache-components]

# Dependency graph
requires:
  - phase: 10-network-home
    provides: cacheComponents+inline-theme-script root layout pattern (Suspense around Header/main/BottomNav)
  - phase: 14-nav-shell-explore-stub
    provides: ThemeProvider mount point + custom useTheme hook in src/components/theme-provider.tsx
provides:
  - Mounted Sonner Toaster (`<ThemedToaster />`) usable from any Client Component via `toast.success(...)`
  - Custom Sonner wrapper bound to Horlo's ThemeProvider (NOT next-themes) to stay compatible with cacheComponents
  - Wave 0 unit test asserting theme-prop binding, fallback safety, and position/richColors
affects:
  - 15-03 (post-dialog) — submit handler will call toast.success('Wear logged') after Server Action returns success
  - any future Client Component that wants user-facing notifications

# Tech tracking
tech-stack:
  added: ["sonner@^2.0.7"]
  patterns:
    - "Sonner wrapper bound to project's custom ThemeProvider (not next-themes) to avoid cookies()-in-cached-render"
    - "Toaster mounted as sibling of Suspense boundaries (NOT inside) so transitions don't unmount the toast layer"

key-files:
  created:
    - src/components/ui/ThemedToaster.tsx
    - tests/components/ThemedToaster.test.tsx
  modified:
    - src/app/layout.tsx
    - package.json
    - package-lock.json

key-decisions:
  - "Sonner wrapper binds to Horlo's custom ThemeProvider via useTheme(); does not import next-themes (Pitfall H-3)"
  - "Mount point: last child of <ThemeProvider>, sibling of three Suspense wrappers — preserves toast across route transitions (Pitfall H-1)"
  - "Toaster props locked to position='bottom-center' + richColors per UI-SPEC; no per-page customization API"

patterns-established:
  - "ThemedToaster: Client Component wrapper for any third-party UI primitive that needs theme awareness — read theme from custom ThemeProvider, not next-themes"
  - "Doc-comment guard pattern: inline comment in layout.tsx explains the INSIDE/OUTSIDE invariant for future contributors who might wrap it in Suspense"

requirements-completed: [WYWT-19]

# Metrics
duration: 3min 28sec
completed: 2026-04-24
---

# Phase 15 Plan 02: Themed Toaster Summary

**Sonner toast infrastructure shipped — `<ThemedToaster />` Client Component bound to Horlo's custom `ThemeProvider` (not next-themes) and mounted in root layout as a sibling of every `<Suspense>` boundary, satisfying both Pitfall H-1 (Suspense unmount) and Pitfall H-3 (cacheComponents incompatibility).**

## Performance

- **Duration:** 3 min 28 sec
- **Started:** 2026-04-24T18:29:24Z
- **Completed:** 2026-04-24T18:32:52Z
- **Tasks:** 2
- **Files modified:** 5 (2 created src + 1 created test + 1 modified layout + 2 modified package files)

## Accomplishments

- `src/components/ui/ThemedToaster.tsx` — Client Component that reads `resolvedTheme` from custom `ThemeProvider` and forwards it to `<Toaster theme=... position="bottom-center" richColors />`
- Root `src/app/layout.tsx` mounts `<ThemedToaster />` inside `<ThemeProvider>` and outside every `<Suspense>` (sibling of Header/main/BottomNavServer wrappers); inline comment documents the WYWT-19 / H-1 invariant
- Wave 0 test (`tests/components/ThemedToaster.test.tsx`) — 3 assertions: (1) resolvedTheme is forwarded to sonner's `theme` prop, (2) `useTheme()` fallback path doesn't crash when rendered outside a provider and defaults to `light`, (3) `position="bottom-center"` + `richColors` are wired
- `sonner@2.0.7` installed (idempotent with Plan 15-01 Task 1, which installs the same version)

## Task Commits

Each task was committed atomically:

1. **Task 1 (chore): Install sonner@^2.0.7** — `271974b`
2. **Task 1 (test, RED): Wave 0 ThemedToaster test** — `c7594da`
3. **Task 1 (feat, GREEN): ThemedToaster Client Component** — `2df002e`
4. **Task 2 (feat): Mount ThemedToaster in root layout** — `7a6096f`

_Note: Task 1 produced 3 commits because it bundles dependency install + RED test + GREEN implementation under TDD. The plan metadata commit will be added by the orchestrator after the wave completes._

## Files Created/Modified

- `src/components/ui/ThemedToaster.tsx` (created, 30 lines) — Sonner wrapper bound to custom ThemeProvider
- `tests/components/ThemedToaster.test.tsx` (created, 61 lines) — Wave 0 unit test, mocks sonner to surface props as `data-*` attributes
- `src/app/layout.tsx` (modified, +5 lines) — added import + render of `<ThemedToaster />` inside `<ThemeProvider>`, outside every `<Suspense>`, with explanatory comment
- `package.json` / `package-lock.json` (modified) — added `sonner: ^2.0.7`

## Sonner Version

- **Installed:** `sonner@2.0.7` (matches research recommendation and Plan 15-01 expected version)
- **Idempotency:** `npm install sonner@^2.0.7` is safe to re-run; Plan 15-01 Task 1 will be a no-op once 15-02 has installed it (or vice-versa)

## Layout.tsx Diff (before/after)

**Imports — added line 9:**
```diff
 import { Header } from '@/components/layout/Header'
 import { HeaderSkeleton } from '@/components/layout/HeaderSkeleton'
 import { BottomNavServer } from '@/components/layout/BottomNavServer'
+import { ThemedToaster } from '@/components/ui/ThemedToaster'
```

**Body — added 5 lines as the LAST child of `<ThemeProvider>`:**
```diff
       <Suspense fallback={null}>
         <BottomNavServer />
       </Suspense>
+      {/* WYWT-19: ThemedToaster sits INSIDE ThemeProvider (so useTheme() works)
+          but OUTSIDE every Suspense boundary (Pitfall H-1 — transitions
+          would otherwise unmount the toast layer mid-toast). */}
+      <ThemedToaster />
     </ThemeProvider>
```

No other parts of layout.tsx were modified (no font/metadata/viewport changes; no Suspense reordering; no `'use client'` directive added).

## Hydration Smoke Check

The plan asks for a qualitative dev-time smoke test in the browser. Skipped here because (a) the executor runs in a non-interactive worktree with no available browser, and (b) the layout edit is a pure tree append inside an existing context provider — there is no SSR-vs-CSR divergence path. The Sonner Toaster itself uses `suppressHydrationWarning` internally on its portal root (per sonner v2 source) so no warnings are expected. If a contributor sees a hydration mismatch in dev, the most likely cause is rendering `<ThemedToaster>` *outside* `<ThemeProvider>` — the Wave 0 test will not catch that, but a follow-up E2E in Plan 15-03 will surface it.

## Decisions Made

None beyond what the plan specified. Followed `RESEARCH.md §Pattern 10` and `15-CONTEXT.md D-25/D-26/D-27/D-28` verbatim. The only deviations from the plan's verbatim verify command (see below) were procedural, not architectural.

## Deviations from Plan

### Procedural / fact-corrections (no behavior change)

**1. [Rule 3 - Blocking] Verify command path correction**

- **Found during:** Task 2 verify (`<verify>` block)
- **Issue:** Plan's verify command references `tests/mobile-nav-absence.test.ts`. The file lives at `tests/lib/mobile-nav-absence.test.ts` (verified via repo search across both filesystem and planning docs).
- **Fix:** Ran `npm run test -- tests/components/ThemedToaster.test.tsx tests/lib/mobile-nav-absence.test.ts` instead.
- **Files modified:** none — pure command-line correction
- **Verification:** Both test files passed (3/3 + 2/2 = 5 tests total).
- **Committed in:** N/A (procedural)

**2. [Rule 3 - Blocking] tsc --noEmit produces 3 pre-existing errors**

- **Found during:** Task 2 verify (`npx tsc --noEmit`)
- **Issue:** 3 TS errors emit:
  1. `src/app/u/[username]/layout.tsx(21,4)` — `Cannot find name 'LayoutProps'`
  2. `tests/components/preferences/PreferencesClient.debt01.test.tsx(86,67)` — `Type 'undefined' is not assignable to type 'UserPreferences'`
  3. same file at `(129,7)` — same error
- **Investigation:** Stashed all Plan 15-02 changes and re-ran `tsc` against base commit `8c831ae`. All 3 errors reproduce without any of this plan's edits. **They are pre-existing and out of scope per the deviation-rules SCOPE BOUNDARY clause.**
- **Action:** Logged in `.planning/phases/15-wywt-photo-post-flow/deferred-items.md`. No fix attempted.
- **Files modified:** `.planning/phases/15-wywt-photo-post-flow/deferred-items.md` (untracked, will be committed by the orchestrator's metadata commit or in a future cleanup)
- **Verification:** N/A — issues left as deferred items for a separate plan
- **Committed in:** N/A

---

**Total deviations:** 0 architectural / behavioral; 2 procedural (path correction + scope-boundary deferral)
**Impact on plan:** Zero. The plan's intent and success criteria are met exactly as written; the procedural notes only document path/error provenance for the next phase reviewer.

## Self-Check: Verification

**Files exist:**
- `src/components/ui/ThemedToaster.tsx` — FOUND
- `tests/components/ThemedToaster.test.tsx` — FOUND
- `src/app/layout.tsx` — FOUND (modified, +5 lines)
- `.planning/phases/15-wywt-photo-post-flow/15-02-SUMMARY.md` — being written now

**Commits exist (verified via `git log --oneline 8c831ae..HEAD`):**
- `271974b` — chore(15-02): install sonner@^2.0.7 — FOUND
- `c7594da` — test(15-02): add failing test for ThemedToaster wrapper — FOUND
- `2df002e` — feat(15-02): implement ThemedToaster Client Component — FOUND
- `7a6096f` — feat(15-02): mount ThemedToaster in root layout — FOUND

**Plan-level verification (re-run before sign-off):**
- `npm run test -- tests/components/ThemedToaster.test.tsx` — 3/3 PASS
- `grep -c "from 'next-themes'" src/components/ui/ThemedToaster.tsx` — 0 (correct)
- `grep -n 'ThemedToaster' src/app/layout.tsx` — 3 matches (import on L9, comment on L65, render on L68)
- `grep -c "'use client'" src/app/layout.tsx` — 0 (Server Component preserved)
- `npm run lint -- src/app/layout.tsx src/components/ui/ThemedToaster.tsx` — 0 errors, 0 warnings
- Regression check: `npm run test -- tests/components/ tests/app/ tests/theme.test.tsx` — 41/41 files PASS, 323/323 tests PASS

## Self-Check: PASSED

## Issues Encountered

None during planned work.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 15-03 (`WywtPostDialog`) can call `toast.success('Wear logged')` from any Client Component handler; the Toaster is mounted and theme-aware.
- No blockers for Plan 15-03 from this plan.
- Plan 15-01 (photo pipeline, Wave 1 sibling) shares the `sonner@2.0.7` install — duplicate `chore` commits across the two plans are expected and harmless (`npm install` is idempotent on identical versions).

## Threat Flags

None — this plan only mounts a UI primitive bound to existing ThemeProvider context. No new network endpoints, auth paths, file access patterns, or schema changes. The threats T-15-12 through T-15-15 enumerated in the plan's `<threat_model>` are all addressed:

- **T-15-12 (Sonner XSS):** mitigated by sonner's text-rendering default; no dynamic untrusted content currently flows through this Toaster.
- **T-15-13 (Suspense unmount):** mitigated architecturally by the layout mount-point invariant (sibling of Suspense, not child) + inline comment guard.
- **T-15-14 (theme flash):** acceptable per plan; toast UX appears after user interaction, by which time `useTheme()` has reconciled.
- **T-15-15 (Server Action toast):** out-of-scope for 15-02 (no toast call sites land here); enforced in Plan 15-03 code review.

---
*Phase: 15-wywt-photo-post-flow*
*Completed: 2026-04-24*
