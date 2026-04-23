---
phase: 14-nav-shell-explore-stub
plan: 02
subsystem: ui
tags: [nextjs16, fonts, ibm-plex-sans, viewport, ios-safe-area, cache-components, theme-script, suspense]

requires:
  - phase: 10-feed-network-home
    provides: Cache Components + inline theme script + Suspense layout pattern (P-05 invariant)
provides:
  - IBM Plex Sans as default body/UI font (weights 400/500/600/700)
  - Viewport export with viewportFit=cover (iOS home-indicator safe-area opt-in)
  - Layout contract test locking font variables, theme script, and Suspense count
affects:
  - 14-03-bottom-nav (BottomNav renders in IBM Plex; pb-[calc(4rem+env(safe-area-inset-bottom))] composes with viewport-fit=cover)
  - Downstream phases rendering body text (all now IBM Plex)

tech-stack:
  added:
    - IBM_Plex_Sans from next/font/google (weights 400/500/600/700, display swap)
    - Viewport type import from next
  patterns:
    - Static `export const viewport: Viewport = {...}` alongside `export const metadata: Metadata = {...}` (Next.js 16 canonical)
    - Font variable aliasing: `--font-sans` on <html> auto-resolves through existing `@theme inline { --font-sans: var(--font-sans); }` mapping — no globals.css edit required
    - Next/font mock pattern for vitest (SWC font plugin unavailable under jsdom)

key-files:
  created:
    - tests/app/layout.test.tsx
  modified:
    - src/app/layout.tsx

key-decisions:
  - "IBM_Plex_Sans targets --font-sans (not --font-ibm-plex-sans) to keep the existing globals.css @theme mapping untouched"
  - "Globals.css intentionally NOT in files_modified — existing `--font-sans: var(--font-sans)` mapping auto-resolves via Next's font-variable assignment on <html>"
  - "Negative lock test added (className does NOT match /geistSans|geist-sans/i) to prevent a partial rename from slipping past grep-only acceptance checks"
  - "Viewport exported as static object (not generateViewport); depends on no runtime data, so static form preserves Cache Components static shell"

patterns-established:
  - "Layout contract test: import module directly, inspect RootLayout(children) return as React element tree (no jsdom DOM mount — <html> cannot mount in jsdom)"
  - "next/font/google mock returns plain CSS variable strings; no SWC plugin required under vitest"
  - "Suspense-count grep + type-identity walker locks the Phase 10 Cache Components invariant"

requirements-completed: [NAV-03]

duration: ~6min
completed: 2026-04-23
---

# Phase 14 Plan 02: Global Font + Viewport Metadata Summary

**Swapped Geist for IBM Plex Sans as the body/UI font and added viewportFit=cover for iOS safe-area opt-in, without touching globals.css or the zero-FOUC theme boot.**

## Performance

- **Duration:** ~6 minutes
- **Started:** 2026-04-23T22:50:28Z
- **Completed:** 2026-04-23T22:56:00Z (approx)
- **Tasks:** 2/2 complete
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- IBM Plex Sans now renders on every route (weights 400/500/600/700 preloaded with font-display:swap)
- `viewport-fit=cover` emitted in the viewport meta so iOS opts into safe-area handling (prerequisite for Plan 03 BottomNav `pb-[calc(4rem+env(safe-area-inset-bottom))]`)
- Zero-FOUC theme boot preserved byte-for-byte (themeInitScript untouched, `<head>`/`<script>` ordering unchanged)
- Two Suspense boundaries (Header + main) preserved; Plan 03 will raise the lock to ≥3 when BottomNavServer mounts
- Contract test `tests/app/layout.test.tsx` locks the invariants: font variables present, no Geist leak, theme script intact, Suspense shape intact, viewport.viewportFit==='cover'

## Task Commits

Each task was committed atomically:

1. **Task 1: Write layout contract test (RED)** — `91d7a40` (test)
2. **Task 2: Replace Geist with IBM Plex Sans + add viewport export** — `c464fde` (feat)

## Files Created/Modified

- `tests/app/layout.test.tsx` — 7 assertions covering viewport export, metadata.title, RootLayout identity, font-variable composition, Geist negative lock (new), theme-script presence, and Suspense count. Includes vi.mock for next/font/google (SWC plugin not available under vitest).
- `src/app/layout.tsx` — Geist import replaced with IBM_Plex_Sans (targets `--font-sans`); `Viewport` type imported; `export const viewport: Viewport = { viewportFit: 'cover' }` added; `<html>` className updated to reference `ibmPlexSans.variable`. `themeInitScript`, metadata, Suspense structure, body className preserved verbatim.

## Globals.css — NOT modified (invariant grep-locked)

The `@theme inline` block at lines 7-12 already reads:

```css
--font-sans: var(--font-sans);
--font-mono: var(--font-geist-mono);
--font-heading: var(--font-sans);
```

Because `IBM_Plex_Sans({ variable: '--font-sans' })` sets `--font-sans` directly on the `<html>` element, the existing `@theme` alias resolves to IBM Plex Sans with zero CSS edits. Acceptance criteria grep-lock this invariant so a future planner cannot silently rename the variable and break the alias chain.

## Preserved Invariants

| Invariant | How preserved | Guarded by |
|-----------|---------------|------------|
| themeInitScript body | Line 36 edited NOTHING in the script | Test 5 asserts `horlo-theme` still in rendered tree |
| Two Suspense boundaries | Header + main wrappers unchanged | Test 6 walks React tree counting `React.Suspense` by type identity |
| metadata.title | L22-25 unchanged | Test 2 asserts exact title string |
| `<script>` in `<head>` pre-hydration | Not reordered | Visible in test 5 traversal |
| `--font-sans: var(--font-sans)` in globals.css | File not edited | Acceptance grep locks single occurrence |

## Downstream Impact

- **Plan 03 (BottomNav):** Can rely on font-sans resolving to IBM Plex. `<main>` padding `pb-[calc(4rem+env(safe-area-inset-bottom))]` now composes correctly because viewport-fit=cover is in place.
- **Plan 03 Task 2 Step C:** Will raise the Suspense-count assertion in this test file from `>= 2` to `>= 3` when BottomNavServer mounts as a third Suspense leaf.
- **All body-text routes:** Already render in IBM Plex Sans thanks to the self-referential `--font-sans` @theme alias. No per-route changes needed.

## Deviations from Plan

**Minor — added during Task 1:** Plan Task 1 `<action>` did not mention mocking `next/font/google`, but calling `Geist()` / `IBM_Plex_Sans()` in vitest throws because Next's SWC font loader isn't active. A `vi.mock('next/font/google', …)` was added to the top of the test file returning plain `variable` strings that match the expected CSS custom property names. This is a test-infrastructure adjustment only; runtime behavior is unchanged.

Classified as Rule 3 (blocking issue — test cannot execute without it). Documented here for transparency; no plan-level rework required.

**All other work executed exactly as written in the plan.**

## Verification Results

| Check | Result |
|-------|--------|
| `npm test -- --run tests/app/layout.test.tsx` | 7/7 passed |
| `npm test -- --run tests/proxy.test.ts` | 9/9 passed (no regression) |
| `npm test -- --run` (full suite) | 2252 passed / 0 failed / 119 skipped |
| `npx tsc --noEmit` on plan-touched files | Clean (pre-existing `LayoutProps` error in `src/app/u/[username]/layout.tsx` is unrelated and out-of-scope) |
| `npm run build` | Compiled successfully in 4.2s |
| `grep -rn "font-geist-sans" src/` | 0 results |
| All 12 Task 2 acceptance-criteria greps | Pass |

## Deferred Issues

`src/app/u/[username]/layout.tsx(21,4): error TS2304: Cannot find name 'LayoutProps'.` — pre-existing, not caused by this plan, unrelated to font/viewport surface. Logged for a future cleanup quick-task (Rule: out-of-scope boundary — do not fix).

## Self-Check: PASSED

- File `tests/app/layout.test.tsx` exists — FOUND
- File `src/app/layout.tsx` modified — FOUND
- Commit `91d7a40` (test) — FOUND
- Commit `c464fde` (feat) — FOUND
- No stubs, no TODOs, no placeholder data introduced
