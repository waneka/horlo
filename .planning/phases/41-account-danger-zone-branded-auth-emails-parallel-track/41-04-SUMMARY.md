---
phase: 41-account-danger-zone-branded-auth-emails-parallel-track
plan: 04
subsystem: ui/email-templates
tags: [react-email, supabase-auth, email-templates, branding, transactional-email]

# Dependency graph
requires:
  - phase: 41-account-danger-zone-branded-auth-emails-parallel-track
    plan: 01
    provides: "react-email + @react-email/components devDependencies; tests/static/email-templates.test.ts RED scaffold"
provides:
  - "Three branded Supabase Auth email templates (confirm signup, reset password, change email) as react-email .tsx source"
  - "Shared HorloEmailLayout component — wordmark header, 600px container, dark-mode meta, footer"
  - "emails/ build-excluded from tsconfig.json (D-09)"
  - "Exported static HTML pasted into the Supabase Auth dashboard for all three template slots"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "react-email templates live in a top-level build-excluded emails/ directory; .tsx is the source of truth, emails/out/*.html is regenerable build output (gitignored)"
    - "Thin template files default-export a component wrapping a shared HorloEmailLayout"
    - "All email styling via inline style={{}} props only (no className, no <style> blocks — Gmail strips them)"
    - "Go-template tokens ({{ .ConfirmationURL }}) passed as plain string literals so JSX does not escape the braces; survives react-email export verbatim"

key-files:
  created:
    - "emails/components/HorloEmailLayout.tsx"
    - "emails/confirm-signup.tsx"
    - "emails/reset-password.tsx"
    - "emails/change-email.tsx"
  modified:
    - "tsconfig.json (added \"emails\" to exclude array)"

key-decisions:
  - "D-11 accent correction: exact CSS Color 4 conversion of --accent oklch(0.76 0.12 75) is #DDA552, not the UI-SPEC approximation #D9A441 — #DDA552 used across all three templates"
  - "emails/out/*.html is gitignored (regenerable via npx react-email export); .tsx source is the committed source of truth"
  - "emails/ excluded from tsconfig.json so react-email types never enter the Next.js build/type-check (D-09)"

patterns-established:
  - "Branded transactional email: shared HorloEmailLayout + thin per-action template files"

requirements-completed: [SET-14]

# Metrics
duration: 6min
completed: 2026-05-16
---

# Phase 41 Plan 04: Branded Auth Email Templates Summary

**Three branded Supabase Auth email templates (confirm signup / reset password / change email) built with react-email, sharing a Horlo wordmark layout, exported to email-safe static HTML, and installed in the Supabase dashboard**

## Performance

- **Duration:** ~6 min
- **Tasks:** 4 (Tasks 1-3 auto; Task 4 human-action checkpoint)
- **Files created/modified:** 5

## Accomplishments

- Excluded `emails/` from `tsconfig.json` so the react-email source never enters the Next.js build/type-check (D-09); `npm run build` stays green
- Built `HorloEmailLayout` — styled `Horlo` text wordmark header (no `<img>`, D-10), 600px container, `color-scheme`/`supported-color-schemes` dark-mode meta, shared footer
- Built three templates each with an action-specific CTA label (D-12): `Confirm your email` / `Reset your password` / `Confirm email change`
- Exported all three to email-safe static HTML (table layout, inline styles, Outlook MSO fallbacks); `{{ .ConfirmationURL }}` token survives export literal; zero `oklch()` in output
- `tests/static/email-templates.test.ts` 14/14 GREEN (turned the 41-01 RED scaffold green)
- Operator pasted all three exported HTML files into the Supabase Auth dashboard (Confirm signup, Reset Password, Change Email Address) and verified the rendered preview

## Task Commits

| # | Task | Commit | Type |
|---|------|--------|------|
| 1 | Exclude emails/ from tsconfig + compute oklch→hex accent | `3f5b336` | chore |
| 2 | Build the shared HorloEmailLayout component | `f1c316f` | feat |
| 3 | Build the three templates and export to static HTML | `4efa15f` | feat |
| 4 | Paste exported HTML into Supabase Auth dashboard | — | human-action checkpoint (no code) |

Worktree branch merged to `main` via merge commit `5efadd6`.

## Files Created/Modified

- `emails/components/HorloEmailLayout.tsx` — shared layout: wordmark header in `#DDA552`, 600px container, dark-mode meta, footer copy
- `emails/confirm-signup.tsx` — Confirm signup template, CTA `Confirm your email`
- `emails/reset-password.tsx` — Reset password template, CTA `Reset your password`
- `emails/change-email.tsx` — Change email template, CTA `Confirm email change`
- `tsconfig.json` — `"emails"` added to `exclude`

## Decisions Made

- **D-11 accent correction:** UI-SPEC carried an approximate `#D9A441`. The exact CSS Color 4 conversion of `--accent: oklch(0.76 0.12 75)` is `#DDA552` (R=221, G=165, B=82). All templates use `#DDA552`. `oklch()` is forbidden in email HTML (Outlook MSO) — hex literal only.
- **emails/out/ gitignored:** the exported HTML is build output, regenerable via `npx react-email export --dir emails --outDir emails/out`. The `.tsx` files are the committed source of truth.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] cwd-drift — Task 1 tsconfig commit leaked to main**
- **Found during:** Task 1
- **Issue:** A `cd /Users/tylerwaneka/Documents/horlo` changed cwd out of the worktree; the `tsconfig.json` change committed to `main` as `9360d95` instead of the worktree branch.
- **Fix:** The identical change was also committed correctly on the worktree branch as `3f5b336`. Because both commits add `"emails"` to the same `exclude` array, the orchestrator's 3-way merge of the worktree branch auto-resolved with no conflict — `main` carries the correct `tsconfig.json` and the leaked commit is a benign duplicate in history.
- **Net effect:** `tsconfig.json` content on `main` is correct; no functional impact.

---

**Total deviations:** 1 auto-fixed (1 cwd-drift bug)
**Impact on plan:** No scope or content impact — the leaked commit duplicates content already on the worktree branch.

## Issues Encountered

- During the Task 4 checkpoint the operator initially pasted `emails/confirm-signup.tsx` (the React source) into the Supabase dashboard instead of `emails/out/confirm-signup.html` (the compiled output) — the preview rendered raw component code. Resolved by pasting the exported `.html` files; previews then rendered the branded layout correctly.

## User Setup Required

The three exported HTML templates are installed in the Supabase Auth dashboard (operator-confirmed). `emails/out/*.html` is gitignored — regenerate before any future dashboard update with `npx react-email export --dir emails --outDir emails/out`.

## Next Phase Readiness

- SET-14 (branded auth emails) delivered. Track B is complete and independent of the remaining Track A UI work (41-03).
- Cross-client UAT (Apple Mail iOS dark / Outlook MSO / Gmail web) is an operator verification item — preview confirmed in-dashboard.

## Self-Check: PASSED

Files verified present:
- `emails/components/HorloEmailLayout.tsx` — FOUND
- `emails/confirm-signup.tsx`, `emails/reset-password.tsx`, `emails/change-email.tsx` — FOUND
- `tsconfig.json` `exclude` contains `"emails"` — VERIFIED

Commits verified in git log:
- `3f5b336`, `f1c316f`, `4efa15f` — FOUND (merged via `5efadd6`)

---
*Phase: 41-account-danger-zone-branded-auth-emails-parallel-track*
*Completed: 2026-05-16*
