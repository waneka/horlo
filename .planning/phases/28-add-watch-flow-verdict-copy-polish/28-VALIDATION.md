---
phase: 28
slug: add-watch-flow-verdict-copy-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-04
---

# Phase 28 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Decision IDs (D-NN) refer to `28-CONTEXT.md`. Test architecture mapping is detailed in `28-RESEARCH.md` §"Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 2.1.9 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test -- --run <pattern>` |
| **Full suite command** | `npm run test` |
| **Lint** | `npm run lint` |
| **Type check** | `npx tsc --noEmit` |
| **Estimated runtime** | ~30s (full suite, single-shot) |

---

## Sampling Rate

- **After every task commit:** Run targeted vitest pattern for the touched file (e.g., `npm run test -- --run useFormFeedback`).
- **After every plan wave:** Run `npm run test` (full suite) + `npx tsc --noEmit`.
- **Before `/gsd-verify-work`:** Full suite + lint + type check all green.
- **Max feedback latency:** 30 seconds (full suite).

---

## Per-Task Verification Map

> Filled by the planner. Each PLAN.md task that has an automated verification path gets a row here. Manual-only checks (visual toast appearance, theme inheritance) move to the Manual-Only section below.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | FIT-06 / ADD-08 / UX-09 | TBD | TBD | unit / integration | `npm run test -- --run <pattern>` | TBD | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] No new test framework install required — vitest already present
- [ ] `tests/` or co-located `*.test.ts(x)` test stubs for new behavior:
  - [ ] `useFormFeedback` — successAction wiring (D-04, D-05)
  - [ ] `/watch/new` returnTo whitelist — syntactic + self-loop guard (D-11)
  - [ ] composer — rationalePhrasings lockstep with contextualPhrasings (D-19, D-22)
  - [ ] WishlistRationalePanel.defaultRationale source switch (D-20)
  - [ ] Suppress-toast path-equality helper (D-05, D-06)

*Wave 0 deliverables are planner-owned in PLAN.md tasks.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sonner action button visual + theme inheritance | UX-09 | Renderer-driven; only visible in browser | Add a watch from `/search` row; confirm toast shows "View" button styled consistent with the rest of the toast in light + dark themes |
| Toast suppression UX feel | UX-09 D-05 | Subjective — "did the user notice no toast?" | Add a watch from `/u/{me}/wishlist` empty-state CTA when destination tab equals current tab; confirm no toast renders, the new watch appears in place |
| Verdict copy reads coherently across surfaces | FIT-06 | Copy quality requires human eye | Open `/watch/[id]`, `/search` accordion, `/catalog/[id]` for representative watches in each of the 6 labels; confirm copy reads cleanly |
| Wishlist note auto-fill in 1st-person | FIT-06 D-20 | Voice quality requires human eye | Trigger Wishlist commit on a verdict-rich watch; open WishlistRationalePanel; confirm pre-filled note reads in user-self voice |
| Browser back behaves naturally as cancel | ADD-08 (specifics) | Browser-history interaction | After landing on `/watch/new?returnTo=/u/{me}/wishlist`, hit browser back; confirm return to `/u/{me}/wishlist` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Manual-Only justification
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all listed test stubs above
- [ ] No watch-mode flags in commands
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter once planner fills the per-task map

**Approval:** pending
