---
phase: 30
slug: wywt-capture-alignment-fix
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-05
upgraded: 2026-05-16
upgrade_ref: Phase 42 DEBT-10 (42-nyquist-hardening-sweep-uat-triage-parallel-track)
backfill_location: .planning/phases/42-nyquist-hardening-sweep-uat-triage-parallel-track/42-validation-backfill/
backfill_reason: source phase directory deleted by commit dd58ba4
---

# Phase 30 — Validation Strategy (Phase 42 Upgraded)

> Per-phase validation contract recovered from git history (commit `dd58ba4^`) and upgraded
> to `nyquist_compliant: true` + `wave_0_complete: true` under Phase 42 DEBT-10.
>
> Source phase directory deleted by `dd58ba4` ("docs: start milestone v5.0"). This artifact
> lives in `42-validation-backfill/` per decision D-10.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9 + @testing-library/react 16.3.2 + jsdom 25 |
| **Config file** | `vitest.config.ts` (existing, repo root) |
| **Quick run command** | `npx vitest run --project unit tests/components/wywt/CameraCaptureView.test.tsx` |
| **Browser test command** | `npx vitest run --project browser tests/browser/phase30-css-chain.browser.test.tsx` |
| **Full suite command** | `npm test` (runs `vitest run`; reads `vitest.workspace.ts`) |
| **Estimated runtime** | ~3 seconds (quick) / ~30 seconds (full) / ~90 seconds (with browser project) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --project unit tests/components/wywt/CameraCaptureView.test.tsx`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green (both unit + browser projects)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| WYWT-22 | `computeObjectCoverSourceRect` pure math: correct source rect for 3+ stream-size fixtures (portrait, landscape, square) | unit | `npx vitest run --project unit tests/components/wywt/CameraCaptureView.test.tsx` | ✅ existing | approved |
| WYWT-22 | `aspect-square` wrapper CSS chain: computed height equals computed width (no collapsed layout) | browser (computed style) | `npx vitest run --project browser tests/browser/phase30-css-chain.browser.test.tsx` | ✅ existing (Phase 42 backfill) | approved |
| WYWT-22 | `<video>` `h-full w-full object-cover` CSS chain: computed height > 0 + `objectFit === 'cover'` | browser (computed style) | `npx vitest run --project browser tests/browser/phase30-css-chain.browser.test.tsx` | ✅ existing (Phase 42 backfill) | approved |
| WYWT-22 | WYWT capture preview ↔ saved JPEG alignment on iOS Safari: watch appears centered, no black bar | E2E manual | Manual UAT (see Manual-Only Verifications) | manual | approved (prod UAT 7132ac0, 2026-05-02) |

*Status: ⬜ pending · ✅ approved · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/components/wywt/CameraCaptureView.test.tsx` — `computeObjectCoverSourceRect` pure-math assertions (4 tests covering portrait, landscape, square, and edge fixtures). **This file now EXISTS** — it was created by the Phase 30 hotfix plan after the original VALIDATION.md was authored.
- [x] `tests/browser/phase30-css-chain.browser.test.tsx` — computed-style browser assertions for `aspect-square` wrapper + `h-full w-full object-cover` video chain (Phase 42 DEBT-10 D-07/D-08). This is the CRITICAL gap closure — see Phase 42 Upgrade Notes below.

The original VALIDATION.md (recovered from git history) marked `tests/components/wywt/CameraCaptureView.test.tsx` as `❌ W0` (sole gap). That file now exists. The Phase 42 D-08 computed-style gap (browser-mode CSS chain assertion) is closed by `tests/browser/phase30-css-chain.browser.test.tsx`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| WYWT capture preview ↔ saved JPEG alignment on iOS Safari | WYWT-22 (D-08, D-09) | Visual judgment is the acceptance criterion; no pixel-measurement tooling per D-09 | On iPhone Safari: open the app, tap WYWT compose, frame a watch dead-center under the on-screen wrist guide, capture, navigate to `/wear/[id]`. Pass = watch appears centered in the saved photo (not at the bottom edge). Black bar must NOT appear in either preview or saved photo. |

Prod UAT sign-off: commit `7132ac0`, 2026-05-02. Manual item verified in production.

---

## Phase 42 Upgrade Notes

**Root cause of `partial`:** The original VALIDATION.md (recovered from `git show dd58ba4^:.planning/phases/30-wywt-capture-alignment-fix/30-VALIDATION.md`) listed a single Wave 0 gap:

```
- [ ] tests/components/wywt/CameraCaptureView.test.tsx — D-07 pure-math assertions for
      computeObjectCoverSourceRect (3+ stream-size fixtures)
```

The file was marked `❌ W0` in the per-task map and the frontmatter stayed `nyquist_compliant: false`, `wave_0_complete: false`.

**Resolution — Gap 1 (unit tests):** `tests/components/wywt/CameraCaptureView.test.tsx` now EXISTS. It contains 4 math tests for `computeObjectCoverSourceRect` (portrait, landscape, square, and edge-case fixtures). The file was created by the Phase 30 hotfix plan (the same plan that added `h-full` to the `<video>` element via commit `2dd7377`). The `❌ W0` marker in the recovered VALIDATION.md was stale.

**Resolution — Gap 2 (D-08 computed-style assertion):** The v4.1 feedback memory (`feedback_ui_spec_css_chain_blind_spot.md`) documented that the Phase 30 black-bar shipped through 6/6 PASS because the 6-pillar checker validated declared tokens (class names), NOT the CSS chain. The `h-full` hotfix regression would NOT have been caught by class-name assertions alone — only a computed-style browser assertion can verify that `h-full` on `<video>` actually produces a non-zero computed height within the `aspect-square` wrapper.

Phase 42 closes this gap with `tests/browser/phase30-css-chain.browser.test.tsx`, which asserts:

1. **`aspect-square` wrapper:** computed `height === width` (within 1px tolerance). Before the hotfix: would still pass (wrapper sizing is not affected by the video child). After the hotfix: passes.
2. **`<video>` `h-full w-full object-cover`:** `getComputedStyle(video).height > 0` AND `getComputedStyle(video).objectFit === 'cover'`. **This assertion WOULD HAVE caught the `h-full` hotfix regression.** Before the hotfix (no `h-full` on `<video>`): computed height was `0px` → assertion FAILS. After the hotfix: `h-full` is present → computed height fills the `aspect-square` wrapper → assertion PASSES.

**The Phase 30 browser assertion is the DEBT-10 acceptance bar.** Every Phase 30 CSS-chain assertion was designed against the question: "Would this have caught the `h-full` hotfix regression?" The video computed-height assertion answers YES.

**Upgrade applied by:** Phase 42 DEBT-10 (42-nyquist-hardening-sweep-uat-triage-parallel-track), Plan 03, Task 1.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Manual-Only justification with prod UAT citation
- [x] Wave 0 unit gap closed (`tests/components/wywt/CameraCaptureView.test.tsx` confirmed existing)
- [x] D-08 computed-style gap closed (`tests/browser/phase30-css-chain.browser.test.tsx` — the DEBT-10 acceptance bar)
- [x] Browser assertion explicitly encodes the `h-full` hotfix regression check
- [x] `nyquist_compliant: true` set in frontmatter
- [x] ROADMAP SC#2 satisfied — Phase 30 VALIDATION.md cites the computed-style CSS-chain assertion

**Approval:** Phase 42 DEBT-10 upgrade — 2026-05-16
