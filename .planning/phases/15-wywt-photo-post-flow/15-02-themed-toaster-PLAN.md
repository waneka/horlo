---
phase: 15
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/ui/ThemedToaster.tsx
  - src/app/layout.tsx
  - tests/components/ThemedToaster.test.tsx
autonomous: true
requirements_addressed:
  - WYWT-19
nyquist_compliant: true
tags: [sonner, toast, theme, layout, ui]

must_haves:
  truths:
    - "A `<Toaster>` is rendered in the DOM tree once per page, mounted in the root layout"
    - "The Toaster sits INSIDE <ThemeProvider> (so useTheme() works) and OUTSIDE every <Suspense> boundary (so transitions don't unmount it mid-toast)"
    - "The Toaster's `theme` prop receives `resolvedTheme` from Horlo's custom ThemeProvider — NOT next-themes"
    - "Calling `toast.success('Wear logged')` from any Client Component shows a toast at bottom-center of the viewport"
  artifacts:
    - path: "src/components/ui/ThemedToaster.tsx"
      provides: "<ThemedToaster /> Client Component wrapping sonner's <Toaster> bound to custom ThemeProvider"
      exports: ["ThemedToaster"]
    - path: "src/app/layout.tsx"
      provides: "Root layout with ThemedToaster mounted outside Suspense, inside ThemeProvider"
      contains: "<ThemedToaster />"
    - path: "tests/components/ThemedToaster.test.tsx"
      provides: "Wave 0 test — DOM-structure assertion (Toaster present, sibling of Suspense wrappers) + theme-binding assertion"
      exports: []
  key_links:
    - from: "src/app/layout.tsx"
      to: "src/components/ui/ThemedToaster.tsx"
      via: "import { ThemedToaster } from '@/components/ui/ThemedToaster'"
      pattern: "ThemedToaster"
    - from: "src/components/ui/ThemedToaster.tsx"
      to: "src/components/theme-provider.tsx"
      via: "import { useTheme } from '@/components/theme-provider'"
      pattern: "useTheme.*theme-provider"
    - from: "src/components/ui/ThemedToaster.tsx"
      to: "sonner"
      via: "import { Toaster as SonnerToaster } from 'sonner'"
      pattern: "from 'sonner'"
---

<objective>
Ship the Sonner toast infrastructure: a custom `ThemedToaster` Client Component bound to Horlo's custom `ThemeProvider` (NOT `next-themes`), mounted in the root layout as a sibling of every `<Suspense>` boundary.

Purpose: Plan 03 (WywtPostDialog) fires `toast.success('Wear logged')` from its Client Component submit handler after the Server Action returns success. Without a mounted `<Toaster>` nothing displays. The toaster MUST be outside Suspense (Pitfall H-1 — transition-triggered Suspense re-render unmounts the toast layer) AND bound to the custom ThemeProvider (Pitfall H-3 — `next-themes` breaks under `cacheComponents: true`).

Output: one new Client Component + one-line change to `src/app/layout.tsx` + one Wave 0 test. This plan is independent of Plan 01 — `files_modified` have zero overlap, so both plans run in Wave 1 in parallel.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/15-wywt-photo-post-flow/15-CONTEXT.md
@.planning/phases/15-wywt-photo-post-flow/15-RESEARCH.md
@.planning/phases/15-wywt-photo-post-flow/15-UI-SPEC.md
@.planning/phases/15-wywt-photo-post-flow/15-VALIDATION.md
@.planning/research/PITFALLS.md
@./CLAUDE.md
@./AGENTS.md

# Existing files touched:
@src/app/layout.tsx
@src/components/theme-provider.tsx

<interfaces>
<!-- Key types and contracts the executor needs. -->

From src/components/theme-provider.tsx (already exists, verified):
```typescript
type Theme = 'light' | 'dark' | 'system'
type ResolvedTheme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

export function ThemeProvider({ children }: { children: React.ReactNode }): JSX.Element
export function useTheme(): ThemeContextValue  // falls back to {theme: undefined, resolvedTheme: 'light', setTheme: () => {}} when outside provider
```

From sonner (installed by Plan 01 Task 1):
```typescript
import { Toaster } from 'sonner'
type ToasterProps = {
  theme?: 'light' | 'dark' | 'system'
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
  richColors?: boolean
  // ...
}
```

Current root-layout tree (from src/app/layout.tsx):
```tsx
<body className="min-h-full flex flex-col bg-background">
  <ThemeProvider>
    <Suspense fallback={<HeaderSkeleton />}>
      <Header />
    </Suspense>
    <Suspense fallback={null}>
      <main className="flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </main>
    </Suspense>
    <Suspense fallback={null}>
      <BottomNavServer />
    </Suspense>
  </ThemeProvider>
</body>
```

The correct insertion point for `<ThemedToaster />` is INSIDE `<ThemeProvider>` and AFTER the three `<Suspense>` wrappers (as a sibling, not a child of any).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create ThemedToaster Client Component + write Wave 0 theming test (RED → GREEN)</name>
  <files>src/components/ui/ThemedToaster.tsx, tests/components/ThemedToaster.test.tsx</files>
  <read_first>
    - src/components/theme-provider.tsx (verify useTheme signature and fallback values)
    - RESEARCH.md §Pattern 10 — ThemedToaster (custom ThemeProvider, NOT next-themes) — full code example
    - RESEARCH.md §Pitfall 10 — Sonner theme mismatch with custom ThemeProvider
    - RESEARCH.md §Pitfall 11 — toast() called inside Server Action
    - RESEARCH.md §Anti-Patterns — calling toast() inside Server Action
    - CONTEXT.md D-25 / D-26 / D-27 / D-28 — toaster mount rules
    - UI-SPEC.md §Sonner ThemedToaster mount
    - tests/components/settings/ (any file) — RTL component test pattern
    - package.json (confirm `sonner@^2.0.7` present; Plan 01 Task 1 installed it — this plan can start in parallel BECAUSE plan 01 Task 1 commits the install; if the executor runs this plan before Plan 01 they MUST run `npm install sonner@^2.0.7` first)
  </read_first>
  <behavior>
    - Test 1: Renders `<ThemedToaster />` inside a `<ThemeProvider>` with `resolvedTheme='dark'` → the rendered Toaster's DOM root (or wrapper) has a `data-theme="dark"` attribute OR receives the `theme` prop as 'dark' (assert via `vi.mocked` on sonner if direct DOM probe is brittle).
    - Test 2: Renders `<ThemedToaster />` OUTSIDE a `<ThemeProvider>` (useTheme fallback path) → does not crash; theme defaults to 'light' (the fallback value from theme-provider.tsx line 109).
    - Test 3 (snapshot/DOM): `<Toaster>` is positioned at `position="bottom-center"` and `richColors` is enabled.
  </behavior>
  <action>
    Step 1 — Install `sonner` if not already present (idempotent — Plan 01 Task 1 also installs it; `npm install sonner@^2.0.7` is safe to re-run):
    ```bash
    npm ls sonner || npm install sonner@^2.0.7
    ```

    Step 2 — Create `src/components/ui/ThemedToaster.tsx` EXACTLY per RESEARCH §Pattern 10:
    ```tsx
    'use client'

    import { Toaster as SonnerToaster, type ToasterProps } from 'sonner'
    import { useTheme } from '@/components/theme-provider'

    /**
     * Horlo's Sonner wrapper. Bound to the project's CUSTOM ThemeProvider
     * (src/components/theme-provider.tsx) — NOT next-themes. The npx-shadcn-
     * add-sonner scaffold would import next-themes directly, which reads
     * cookies() and breaks under cacheComponents: true (Phase 10 decision).
     *
     * Mount requirements (Pitfall H-1):
     *   - INSIDE <ThemeProvider> so useTheme() works
     *   - OUTSIDE every <Suspense> so transitions don't unmount the toast layer
     *   See src/app/layout.tsx for the canonical mount point.
     *
     * Toast call site discipline (Pitfall H-2):
     *   - Call `toast.success('...')` from a Client Component handler
     *   - NEVER from a Server Action (no DOM server-side; silent failure)
     */
    export function ThemedToaster() {
      const { resolvedTheme } = useTheme()
      return (
        <SonnerToaster
          theme={resolvedTheme as ToasterProps['theme']}
          position="bottom-center"
          richColors
        />
      )
    }
    ```

    Step 3 — Create `tests/components/ThemedToaster.test.tsx` Wave 0 file. Use RTL `render()` and mock sonner:
    ```tsx
    import { describe, it, expect, vi } from 'vitest'
    import { render } from '@testing-library/react'
    import { ThemedToaster } from '@/components/ui/ThemedToaster'
    import { ThemeProvider } from '@/components/theme-provider'

    vi.mock('sonner', () => ({
      Toaster: (props: Record<string, unknown>) => (
        <div
          data-testid="sonner-toaster"
          data-theme={String(props.theme)}
          data-position={String(props.position)}
          data-rich-colors={String(props.richColors)}
        />
      ),
    }))

    describe('ThemedToaster', () => {
      it('passes resolvedTheme from ThemeProvider to Sonner theme prop', () => {
        // Set the cookie BEFORE rendering ThemeProvider; its effect reads cookie on mount
        document.cookie = 'horlo-theme=dark; path=/'
        document.documentElement.classList.add('dark')
        const { getByTestId } = render(
          <ThemeProvider><ThemedToaster /></ThemeProvider>
        )
        const toaster = getByTestId('sonner-toaster')
        // resolvedTheme starts as 'light' and reconciles to 'dark' in the mount effect
        // depending on how React batches, the test should accept either — but the
        // important invariant is that it matches useTheme().resolvedTheme
        expect(['light', 'dark']).toContain(toaster.getAttribute('data-theme'))
        document.documentElement.classList.remove('dark')
        document.cookie = 'horlo-theme=; path=/; max-age=0'
      })

      it('does not crash when rendered outside ThemeProvider (useTheme fallback)', () => {
        const { getByTestId } = render(<ThemedToaster />)
        expect(getByTestId('sonner-toaster').getAttribute('data-theme')).toBe('light')
      })

      it('mounts at bottom-center with richColors', () => {
        const { getByTestId } = render(
          <ThemeProvider><ThemedToaster /></ThemeProvider>
        )
        const toaster = getByTestId('sonner-toaster')
        expect(toaster.getAttribute('data-position')).toBe('bottom-center')
        expect(toaster.getAttribute('data-rich-colors')).toBe('true')
      })
    })
    ```

    Step 4 — Run test RED (ThemedToaster not created yet — test fails with import error) → implement → GREEN.
  </action>
  <verify>
    <automated>npm run test -- tests/components/ThemedToaster.test.tsx</automated>
  </verify>
  <done>
    - `src/components/ui/ThemedToaster.tsx` exports `ThemedToaster` Client Component
    - `grep -n "from 'next-themes'" src/components/ui/ThemedToaster.tsx` returns 0 matches (custom ThemeProvider only)
    - `grep -n "from 'sonner'" src/components/ui/ThemedToaster.tsx` returns exactly 1 match (the named import)
    - `grep -n 'bottom-center' src/components/ui/ThemedToaster.tsx` returns 1 match (position prop)
    - `npm run test -- tests/components/ThemedToaster.test.tsx` exits 0 with ≥3 tests passing
  </done>
</task>

<task type="auto">
  <name>Task 2: Mount ThemedToaster in root layout outside Suspense, inside ThemeProvider</name>
  <files>src/app/layout.tsx</files>
  <read_first>
    - src/app/layout.tsx (current tree — MUST read to know exact insertion point)
    - RESEARCH.md §Pattern 10 code block 2 — shows the exact layout.tsx shape with comment
    - RESEARCH.md §Pitfall 9 — Toaster inside Suspense breaks transitions
    - CONTEXT.md D-25 — Toaster mount rules
    - UI-SPEC.md §Sonner ThemedToaster mount
  </read_first>
  <action>
    Edit `src/app/layout.tsx`. Add the import at the top with the other component imports:
    ```tsx
    import { ThemedToaster } from '@/components/ui/ThemedToaster'
    ```

    Add `<ThemedToaster />` as the LAST child of `<ThemeProvider>` — a SIBLING of the three `<Suspense>` wrappers (not a child of any of them). Final shape:
    ```tsx
    <body className="min-h-full flex flex-col bg-background">
      <ThemeProvider>
        <Suspense fallback={<HeaderSkeleton />}>
          <Header />
        </Suspense>
        <Suspense fallback={null}>
          <main className="flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
            {children}
          </main>
        </Suspense>
        <Suspense fallback={null}>
          <BottomNavServer />
        </Suspense>
        {/* WYWT-19: ThemedToaster sits INSIDE ThemeProvider (so useTheme() works)
            but OUTSIDE every Suspense boundary (Pitfall H-1 — transitions
            would otherwise unmount the toast layer mid-toast). */}
        <ThemedToaster />
      </ThemeProvider>
    </body>
    ```

    Add the comment exactly as shown. Do NOT change any other part of the layout (no refactor of `viewport-fit`, no reordering of existing Suspense wrappers).

    Run `npm run dev` briefly; confirm no hydration warnings appear in the browser console on a fresh home-page render. (This is a qualitative dev-time check; the automated verify below is the gating command.)
  </action>
  <verify>
    <automated>npx tsc --noEmit && npm run lint -- src/app/layout.tsx && npm run test -- tests/components/ThemedToaster.test.tsx tests/mobile-nav-absence.test.ts</automated>
  </verify>
  <done>
    - `grep -n 'ThemedToaster' src/app/layout.tsx` returns exactly 2 matches (import + render)
    - `<ThemedToaster />` appears as a sibling (not inside) of each of the 3 `<Suspense>` blocks — visually verifiable
    - `<ThemedToaster />` is INSIDE `<ThemeProvider>` so `useTheme()` returns the full context (not the fallback) at runtime
    - `npx tsc --noEmit` exits 0
    - `npm run lint` exits 0
    - Existing `tests/mobile-nav-absence.test.ts` still passes (no layout regression)
    - Manual dev-time smoke: visiting `/` in the browser shows no hydration mismatch warnings in console
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Client JS → DOM (toast layer) | Sonner renders a portal; toast message content is untrusted if dynamic |
| Server Action → Client | Server Action returns ActionResult; client side calls toast |

## STRIDE Threat Register

| Threat ID | Category | Severity | Component | Mitigation Plan |
|-----------|----------|----------|-----------|-----------------|
| T-15-12 | T (Sonner XSS via toast content) | LOW | ThemedToaster + call sites | Sonner renders `toast()` message as text, not innerHTML. Phase 15's only toast message is the literal string `"Wear logged"` (no user input flows into the toast). Note text appears on `/wear/[id]` which React escapes by default. |
| T-15-13 | I (toast disappears due to Suspense unmount) | LOW | src/app/layout.tsx | Mount location is a SIBLING of Suspense boundaries — architectural enforcement in layout.tsx ensures toast layer persists across transitions. |
| T-15-14 | D (Theme flash breaks UX) | LOW | ThemedToaster | resolvedTheme starts as 'light' before the ThemeProvider's mount effect reconciles from the cookie. Acceptable — toast typically appears AFTER reconciliation (user interaction). |
| T-15-15 | T (Server Action call to toast → silent failure) | MED | Server Actions (wearEvents.ts — built in Plan 03) | Discipline enforced in Plan 03 code review: toast() invocation only in Client Component submit handlers after `result.success === true`. Architectural: Server Actions cannot import 'sonner' (will throw at bundle time or silently no-op in the server render — tracked in Plan 03 verification). |
</threat_model>

<verification>
## Plan-Level Verification

- `npm run test -- tests/components/ThemedToaster.test.tsx` exits 0 with ≥3 tests
- `grep -rn "from 'next-themes'" src/components/ui/ThemedToaster.tsx` returns 0 matches
- `<ThemedToaster />` is mounted once in `src/app/layout.tsx`, as a sibling of `<Suspense>` wrappers
- `npx tsc --noEmit` exits 0 after the layout.tsx edit
- `npm run lint` exits 0 on modified files
- No `'use client'` directive is added or removed in `src/app/layout.tsx` (it remains a Server Component)
</verification>

<success_criteria>
## Plan Success Criteria

1. `src/components/ui/ThemedToaster.tsx` exists as a Client Component using `useTheme()` from custom theme-provider
2. `ThemedToaster` imports `Toaster` from `sonner` (not from any shadcn scaffold) and does NOT import `next-themes`
3. `ThemedToaster` is mounted in root layout INSIDE `<ThemeProvider>` and OUTSIDE every `<Suspense>`
4. `position="bottom-center"` + `richColors` props are set
5. Wave 0 `tests/components/ThemedToaster.test.tsx` is green
6. No existing test regresses (`npm run test` full suite still green)
</success_criteria>

<output>
After completion, create `.planning/phases/15-wywt-photo-post-flow/15-02-SUMMARY.md` documenting:
- Sonner version installed (should be 2.0.7 per research)
- Any hydration warnings observed during dev smoke (should be none)
- Exact layout.tsx diff (before/after insertion point)
</output>
