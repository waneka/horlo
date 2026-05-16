---
status: resolved
trigger: "Light mode isn't working — only dark mode works. Clicking light mode in the menu doesn't change the theme. If I refresh the page, light mode is still active (selected) but the dark theme is applied."
created: 2026-05-16
updated: 2026-05-16
---

# Debug Session: light-mode-theme-not-applying

## Symptoms

- **Expected:** Selecting "Light" in the theme control (UserMenu `InlineThemeSegmented` and/or `/settings#appearance` theme segmented control) applies the light theme. The rendered theme matches the selected preference. "System" follows the OS.
- **Actual:** Only the dark theme ever renders. Clicking "Light" does not change the applied theme. After a page refresh, the **Light preference is correctly persisted** (Light shows as the selected option) but the **dark theme CSS is still applied**. → Preference write/persistence works; theme *application* is stuck on dark.
- **Errors:** None — browser DevTools console is clean when toggling the theme.
- **Timeline:** **Regression** — Light mode used to work and broke at some point. The theme feature originates in Phase 23 (Cross-surface theme sync, `horlo-theme` cookie).
- **Reproduction:** Go to `/settings#appearance` (or open the UserMenu avatar dropdown) → click "Light" in the theme segmented control → the theme does not change to light; dark stays applied.

## Current Focus

hypothesis: CONFIRMED — `@media (prefers-color-scheme: dark) { :root:not(.light) }` in globals.css always matches because `.light` is never added to `<html>`; dark variables override the `:root` light defaults even when the user explicitly chooses Light.
test: Read globals.css, theme-provider.tsx, layout.tsx, InlineThemeSegmented.tsx, AppearanceSection.tsx.
expecting: `.light` class to be added somewhere when light mode is selected.
next_action: FIXED — deleted the entire `@media (prefers-color-scheme: dark)` block from globals.css. (The debugger's initial proposal — `:root:not(.light)` → `:root:not(.dark)` — was rejected during orchestrator review: it is logically inverted; see Evidence below.)
reasoning_checkpoint: The ThemeProvider only ever adds/removes `.dark` on `<html>`. The media query guard `.light` is a next-themes idiom that was cargo-culted into a custom provider that never sets it.

## Orientation (candidate files — not yet evidence)

- `src/components/theme-provider.tsx` — theme provider
- `src/app/layout.tsx` — root layout (where the provider mounts; where the no-flash theme script / `<html>` class is set)
- `src/components/layout/InlineThemeSegmented.tsx` — theme control in the UserMenu
- `src/components/layout/ThemeToggle.tsx` — theme toggle
- `src/components/settings/AppearanceSection.tsx` — `/settings#appearance` theme control
- `src/components/ui/ThemedToaster.tsx` — theme consumer
- `horlo-theme` cookie — the persistence mechanism (per Phase 23)

## Evidence

- timestamp: 2026-05-16
  file: src/app/globals.css:120-154
  observation: `@media (prefers-color-scheme: dark) { :root:not(.light) { ... dark variables ... } }` — this media query applies dark CSS variables to `:root` whenever the OS prefers dark AND the `.light` class is absent. Since `.light` is never added to `<html>` by any code path, this block always fires on dark-OS machines and overrides the `:root` light variable definitions.
  significance: ROOT CAUSE — this is why selecting Light mode has no effect on a machine with OS dark mode: the dark variables are re-applied by this media query every time, overriding the CSS cascade.

- timestamp: 2026-05-16
  file: src/components/theme-provider.tsx:35-41
  observation: `applyTheme()` adds `.dark` for dark, removes `.dark` for light. It never adds `.light`. So the guard `:not(.light)` in the CSS media query is permanently disabled as a guard.
  significance: Confirms `.light` class never enters the DOM. The CSS's assumption does not match the ThemeProvider's implementation.

- timestamp: 2026-05-16
  file: src/app/layout.tsx:38
  observation: Inline script also only adds/removes `.dark` — never `.light`. Consistent with ThemeProvider.
  significance: Eliminates SSR inline script as a fix point. The bug is purely CSS.

- timestamp: 2026-05-16
  git: commit 6f09888 "fix(01): replace next-themes with cookie-driven local ThemeProvider"
  observation: The `:root:not(.light)` pattern originates in this commit — the moment next-themes (which does set `.light`) was replaced with the custom ThemeProvider (which does not). The CSS was not updated to match.
  significance: Pinpoints the regression to commit 6f09888.

- timestamp: 2026-05-16
  file: src/app/globals.css:51-118
  observation: A standalone `.dark { ... }` block (lines 86-118) already defines the full dark variable set. The inline no-flash script in layout.tsx + ThemeProvider resolve all three states (Dark / Light / System) into one signal — presence or absence of the `.dark` class. The `@media (prefers-color-scheme: dark)` block was a duplicate of `.dark`'s variables. The `.dark` class alone fully drives dark mode (this is why Dark mode worked).
  significance: The `@media` block is pure redundant leftover, not a needed mechanism. Correct fix = DELETE it, not re-guard it.

- timestamp: 2026-05-16
  note: REJECTED FIX — the debugger first proposed `:root:not(.light)` → `:root:not(.dark)`. This is logically inverted. Selecting Light *removes* `.dark`, which makes `:root:not(.dark)` MATCH; on a dark-OS machine the media query would still apply dark variables in Light mode. "Explicit light" and "system / no-class" are the same DOM state (`.dark` absent), so no `:not()` guard on the media query can distinguish them. The only correct fix is to remove the media query entirely and let `.dark`-presence (already resolved pre-paint by the inline script) be the single source of truth.
  significance: Caught in orchestrator review before application; the applied fix differs from the debugger's first proposal.

## Eliminated

- ThemeProvider.setTheme() — correctly calls applyTheme() and writeCookie(); preference write and DOM class manipulation work.
- InlineThemeSegmented — correctly calls setTheme(value) on click; stopPropagation guards are correct.
- AppearanceSection — passthrough; no logic.
- horlo-theme cookie — correctly persisted and correctly read on remount.
- applyTheme() DOM logic — adds/removes `.dark` correctly; not the fault.

## Resolution

root_cause: `globals.css` line 121 uses `:root:not(.light)` as the guard for the `prefers-color-scheme: dark` media query. The custom ThemeProvider only manipulates the `.dark` class — it never adds a `.light` class. So on a dark-OS machine, the media query always fires and dark CSS variables always win, making it impossible to apply the light theme via CSS regardless of what the ThemeProvider does to the DOM.

fix: Deleted the entire `@media (prefers-color-scheme: dark) { :root:not(.light) { ... } }` block from `globals.css` (former lines 120-154), replacing it with an explanatory comment. The `.dark { ... }` block already defines the full dark variable set, and the inline no-flash script in `layout.tsx` resolves Dark / Light / System into the presence/absence of the `.dark` class pre-paint. With the media query gone, `.dark`-presence is the single source of truth: Light → no `.dark` → `:root` light variables; Dark / System-dark → `.dark` → dark variables. No DOM state is ambiguous. (The debugger's initial `:root:not(.dark)` proposal was rejected — see the REJECTED FIX evidence entry.)

verification: `npm run build` passes (exit 0). User-confirmed in the browser 2026-05-16: the Light toggle now correctly switches the theme (both the UserMenu segmented control and `/settings#appearance`). Closes Phase 42 UAT item 22.

  GOTCHA — stale Turbopack cache: after the fix landed, the bug appeared to persist on `npm run dev` even after a dev-server restart AND a hard refresh. Cause of the false negative: Turbopack's `.next/` build cache served the OLD `globals.css` (still containing the `@media` block, which on a dark-OS machine matched `:root:not(.light)` and forced `--background` dark). A plain dev-server restart reuses `.next/`. The fix only became visible after `rm -rf .next && npm run dev` + hard refresh. When debugging CSS on this project, treat `.next/` as a suspect — clear it before concluding a CSS fix did not work.

files_changed:
  - src/app/globals.css (removed the @media (prefers-color-scheme: dark) block, former lines 120-154)
