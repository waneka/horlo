---
phase: 68
slug: confirmstep-component
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-29
---

# Phase 68 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x (`vitest.config.ts` + `@vitejs/plugin-react`) |
| **Config file** | `vitest.config.ts` (root) — `tests/setup.tsx` provides StrictMode wrapping, PointerEvent polyfill, `next/navigation`, `next/cache`, localStorage stubs |
| **Quick run command** | `npm run test -- src/components/watch/ConfirmStep.test.tsx` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~5s for the file in isolation; ~60–120s full suite |
| **Build gate** | `npm run build` (exit 0 is authoritative — see project memory `baseline_not_green_build_is_gate`) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- src/components/watch/ConfirmStep.test.tsx`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd-verify-work`:** Full suite green + `npm run build` exit 0
- **Max feedback latency:** ~5 seconds per task; ~120s per wave

---

## Per-Task Verification Map

> Placeholder rows — populated by the planner during Plan 01 creation. Each
> CONF-XX requirement maps to one or more cases (a–o) inside
> `src/components/watch/ConfirmStep.test.tsx`. The test file is the Wave 0
> deliverable (alongside `ConfirmStep.tsx`); after Wave 0, every task carries
> a `<verify>` block citing one of the cases.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 68-01-XX | 01 | 1 | CONF-01..10 | T-68-01 (XSS via uncontrolled image URL) — pure presenter, no DOM injection beyond `next/image src` | Render images via `next/image unoptimized` (URL passed through Next image loader); buttons emit callbacks only | unit | `npm run test -- ConfirmStep.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/watch/ConfirmStep.tsx` — new component (the implementation)
- [ ] `src/components/watch/ConfirmStep.test.tsx` — co-located test file with cases a–o per CONTEXT D-Discretion-4
- [ ] No new test infrastructure — `vitest.config.ts` + `tests/setup.tsx` already cover this surface

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Screen-reader announcement of CTA label change ("Add to Wishlist" → "Save as Grail") via `aria-live="polite"` | CONF-08 / CONF-03 a11y | RTL doesn't drive a real AT; live-region behavior must be heard on prod | After Phase 70 wires ConfirmStep into AddWatchFlow, open `/watch/new` on prod with VoiceOver/NVDA, switch status across the 3 options, confirm the CTA label change is announced |
| Visual weight parity of the 3 picker options (CONF-04: Grail Star icon does NOT widen its button) | CONF-04 | DOM measurements via RTL can verify dimensions but not perceived visual weight | Post-Phase-70 prod review: side-by-side the 3 options, confirm Grail button looks the same height + weight as Owned/Wishlist |
| Mobile tap-target sizing on the picker buttons (≥44×44 CSS px) | CONF-03 a11y | UA touch heuristics; not unit-testable | Post-Phase-70 prod review on mobile (375×667) — confirm each button hits min target |

> NOTE: ConfirmStep ships dormant in Phase 68 (no route mount); manual UAT happens after Phase 70 wires it into AddWatchFlow on prod.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify pointing to one of cases (a)–(o)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (the component + the test file)
- [ ] No watch-mode flags (vitest run, not vitest watch)
- [ ] Feedback latency < 10s per task; < 120s per wave
- [ ] `nyquist_compliant: true` set in frontmatter (planner sets after PLAN.md ships)

**Approval:** pending
