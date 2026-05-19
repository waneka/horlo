---
phase: 48
slug: user-facing-bug-fixes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-19
---

# Phase 48 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/app/catalog-page.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5–15 seconds (quick) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/app/catalog-page.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 48-XX-XX | — | 1 | BUG-01 | — / — | Ownership query stays scoped by userId AND catalogId; adding status filter only narrows | unit | `npx vitest run tests/app/catalog-page.test.ts` | ✅ extend | ⬜ pending |
| 48-XX-XX | — | 1 | BUG-02 | — / — | N/A (presentational token swap) | static + unit | `grep -rn "text-accent-foreground" src/components/search/` returns 0 hits | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Concrete task IDs are assigned by the planner; the planner must map every task to one of the BUG-01 / BUG-02 rows above.*

---

## Wave 0 Requirements

- [ ] `tests/app/catalog-page.test.ts` — new BUG-01 regression cases for `wishlist` (and ideally `grail` / `sold`) statuses asserting NO `self-via-cross-user` framing / no "You own this watch" callout
- [ ] `tests/app/catalog-page.test.ts` — audit `@/data/profiles` (`getProfileById`) mock coverage via `tests/setup.tsx` before adding new cases; add explicit mock if `getProfileById` is unhandled
- [ ] `tests/components/ui/chip.test.tsx` (optional) — unit test asserting `chipVariants({ variant: 'removable' })` contains `text-foreground` and NOT `text-accent-foreground`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Filter chips render with legible contrast in dark mode | BUG-02 | jsdom does not resolve CSS custom properties / `oklch` paint values — rendered contrast cannot be asserted in unit tests (see `feedback_ui_spec_css_chain_blind_spot` memory) | Run dev server, open `/search`, apply filters, toggle to dark mode, confirm all 7 chip groups + inline removable chips show legible (near-white) text on the tinted pill |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
