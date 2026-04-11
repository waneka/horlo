---
phase: 01-visual-polish-security-hardening
plan: 01
subsystem: test-infra + theming
tags: [vitest, next-themes, shadcn, theme-toggle, wave-0]
requirements: [VIS-01]
dependency_graph:
  requires: []
  provides:
    - vitest test runner (jsdom + RTL + jest-dom)
    - next-themes ThemeProvider mounted in root layout
    - ThemeToggle component in Header (Light/Dark/System)
    - shadcn chart/popover/sheet primitives
  affects:
    - src/app/layout.tsx
    - src/components/layout/Header.tsx
    - tests/setup.ts (matchMedia shim)
tech-stack:
  added:
    - vitest ^2
    - "@vitejs/plugin-react ^4"
    - "@testing-library/react ^16"
    - "@testing-library/jest-dom ^6"
    - "@testing-library/user-event ^14"
    - jsdom ^25
    - next-themes ^0.4.6
    - recharts (via shadcn chart)
  patterns:
    - base-ui Popover render prop pattern (avoid asChild nested button)
    - next-themes FOUC prevention via suppressHydrationWarning
    - jsdom matchMedia stub for next-themes under test
key-files:
  created:
    - vitest.config.ts
    - tests/setup.ts
    - tests/smoke.test.ts
    - tests/theme.test.tsx
    - src/components/layout/ThemeToggle.tsx
    - src/components/ui/chart.tsx
    - src/components/ui/popover.tsx
    - src/components/ui/sheet.tsx
  modified:
    - package.json (test scripts + deps)
    - tsconfig.json (vitest/jest-dom types)
    - src/app/layout.tsx (ThemeProvider, Instrument_Serif, bg-background)
    - src/components/layout/Header.tsx (ThemeToggle, bg-background/80)
decisions:
  - Used base-ui render prop instead of asChild (base-ui API differs from radix)
  - Stubbed window.matchMedia in tests/setup.ts (jsdom does not implement it, next-themes requires it)
metrics:
  duration: ~10 minutes
  completed: 2026-04-11
---

# Phase 01 Plan 01: Wave 0 Foundation Summary

Stood up the Vitest test runner (jsdom + React Testing Library) and wired next-themes ThemeProvider into the root layout with a three-state ThemeToggle in the Header, unblocking every downstream Wave 1 plan.

## What Was Built

### Task 1 — Vitest test runner (commit `88e0252`)

- Installed `vitest@^2`, `@vitejs/plugin-react@^4`, `@testing-library/react@^16`, `@testing-library/jest-dom@^6`, `@testing-library/user-event@^14`, `jsdom@^25`, `@types/node`.
- Created `vitest.config.ts` with jsdom environment, `@/*` alias pointing at `src/`, global test API, and setup file wiring.
- Created `tests/setup.ts` importing `@testing-library/jest-dom/vitest` for DOM matchers.
- Created `tests/smoke.test.ts` asserting `1 + 1 === 2` to confirm the runner executes.
- Added `"test": "vitest run"` and `"test:watch": "vitest"` scripts to `package.json`.
- Extended `tsconfig.json` `compilerOptions.types` with `"vitest/globals"` and `"@testing-library/jest-dom"`.

### Task 2 — next-themes + shadcn primitives (commit `0ec20f0`)

- Installed `next-themes@^0.4.6`.
- Ran `npx shadcn@latest add chart` — created `src/components/ui/chart.tsx` and installed `recharts`.
- Ran `npx shadcn@latest add popover` — created `src/components/ui/popover.tsx` (base-ui-backed).
- Ran `npx shadcn@latest add sheet` — created `src/components/ui/sheet.tsx`.

### Task 3 — ThemeProvider wired in layout + ThemeToggle in Header (commits `ed3adad`, `1329985`)

TDD cycle:
1. **RED** (`ed3adad`): Added `tests/theme.test.tsx` asserting (a) ThemeToggle exposes a button with `aria-label="Theme"`, (b) clicking it reveals Light / Dark / System options. Tests failed because the component did not yet exist.
2. **GREEN** (`1329985`): Built ThemeToggle, wired ThemeProvider, tests pass.

Layout changes:
- Imported `ThemeProvider` from `next-themes` and `Instrument_Serif` from `next/font/google` (as `--font-serif`).
- Added `suppressHydrationWarning` to `<html>`.
- Replaced body class `bg-gray-50` with `bg-background`.
- Wrapped `<Header />` and `<main>` in `<ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="horlo-theme">`.

ThemeToggle:
- Uses `useTheme()` from next-themes, tracks `mounted` to avoid hydration mismatch.
- Displays the current mode icon (`Sun` / `Moon` / `Monitor` from lucide-react).
- Uses base-ui `PopoverTrigger` with a `render` prop (NOT `asChild`) to wrap the shadcn `Button` — this avoids the "button cannot contain a nested button" React warning that `asChild` would cause with base-ui's slot-less API.
- PopoverContent lists the three options; the active option is highlighted via `bg-accent text-accent-foreground`.
- 44px touch target (`h-11 w-11`) per UI-SPEC mobile contract.

Header changes:
- Imported `ThemeToggle` and rendered it in the right-side flex cluster immediately before the "Add Watch" link.
- Replaced `bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60` with `bg-background/80 backdrop-blur` (token migration).
- Replaced `border-b` with `border-b border-border` (explicit token).
- Other Header structure (nav, mobile behavior) untouched — mobile nav is Plan 04.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Stub window.matchMedia in tests/setup.ts**
- **Found during:** Task 3 GREEN step
- **Issue:** `npm test` crashed with `TypeError: window.matchMedia is not a function` when rendering `<ThemeProvider>` under jsdom. jsdom does not implement `matchMedia`, but next-themes calls it immediately on mount to probe `(prefers-color-scheme: dark)`.
- **Fix:** Added a `matchMedia` shim in `tests/setup.ts` that returns a non-matching MediaQueryList-shaped object. Gated behind an existence check so real browsers are untouched.
- **Files modified:** `tests/setup.ts`
- **Commit:** `1329985`

**2. [Rule 1 — Bug] Use base-ui `render` prop instead of `asChild`**
- **Found during:** Task 3 GREEN step
- **Issue:** Initial ThemeToggle used `<PopoverTrigger asChild><Button ...></PopoverTrigger>`, producing React warnings `<button> cannot contain a nested <button>` and `React does not recognize the asChild prop on a DOM element`. base-ui's `Popover.Trigger` does not implement radix-style `asChild` — it uses a `render` prop to replace the rendered element.
- **Fix:** Rewrote the trigger as `<PopoverTrigger render={<Button ... />}><CurrentIcon .../></PopoverTrigger>`. Button becomes the rendered element, icon becomes its child — no nested buttons, no stray prop.
- **Files modified:** `src/components/layout/ThemeToggle.tsx`
- **Commit:** `1329985`

## Authentication Gates

None.

## Tests

- `tests/smoke.test.ts` — 1 test, passing
- `tests/theme.test.tsx` — 2 tests, passing (ThemeToggle renders button; Popover shows all three options on click)

`npm test -- tests/theme.test.tsx tests/smoke.test.ts` → **3 passed, 0 failed.**

Note: running bare `npm test` picks up `tests/ssrf.test.ts` which belongs to Plan 02 (running in parallel in another worktree). That file is out of scope for this plan.

## Verification

- `npx vitest run tests/theme.test.tsx tests/smoke.test.ts` exits 0 with 3 passed
- `npm run build` exits 0 — all 8 routes prerender/compile
- `npm run lint` exits 0 (14 pre-existing warnings in unrelated files; 0 new warnings from this plan's changes)
- `grep 'bg-gray-50' src/app/layout.tsx` returns nothing
- `grep 'suppressHydrationWarning' src/app/layout.tsx` matches

## Threat Flags

None. The plan's `<threat_model>` covered all introduced surface (localStorage theme key accepted; hydration mismatch mitigated via `suppressHydrationWarning`; test fixtures contain no secrets).

## Known Stubs

None. Every component introduced is fully wired.

## Self-Check: PASSED

Created files verified to exist on disk:
- FOUND: vitest.config.ts
- FOUND: tests/setup.ts
- FOUND: tests/smoke.test.ts
- FOUND: tests/theme.test.tsx
- FOUND: src/components/layout/ThemeToggle.tsx
- FOUND: src/components/ui/chart.tsx
- FOUND: src/components/ui/popover.tsx
- FOUND: src/components/ui/sheet.tsx

Commits verified via `git log --oneline`:
- FOUND: 88e0252 chore(01-01): add vitest test runner with jsdom + RTL
- FOUND: 0ec20f0 chore(01-01): add next-themes, recharts, and shadcn chart/popover/sheet
- FOUND: ed3adad test(01-01): add failing test for ThemeToggle
- FOUND: 1329985 feat(01-01): wire ThemeProvider + ThemeToggle into root layout
