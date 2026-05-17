---
phase: 43
slug: polish-pass
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-16
---

# Phase 43 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — no test runner configured in the repo |
| **Config file** | none |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npm run lint && npm run build` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npm run lint && npm run build`
- **Before `/gsd-verify-work`:** Full build must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

> Task IDs are placeholders — the planner finalizes them. The planner MUST
> ensure each plan task carries an `<acceptance_criteria>` block whose
> assertions map to the requirement rows below.

| Plan | Requirement | Secure Behavior | Test Type | Automated Command | Status |
|------|-------------|-----------------|-----------|-------------------|--------|
| 01 | PLSH-01, PLSH-02 | Filter sheet dismiss never gated on pending query state | type/build + manual | `npx tsc --noEmit` | ⬜ pending |
| 02 | PLSH-03, PLSH-04 | N/A | type/build + manual | `npm run build` | ⬜ pending |
| 03 | PLSH-05 | N/A | type/build + manual | `npx tsc --noEmit` | ⬜ pending |
| 04 | PLSH-06 | Avatar bucket RLS scoped to `{userId}/` path; ≤8 MB guard enforced | type/build + manual | `npm run build` | ⬜ pending |
| 05 | PLSH-07 | LLM call uses non-deprecated model ID | source assertion | `grep -n claude-sonnet-4-6 src/lib/extractors/llm.ts` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- No test framework is present and none is being introduced — this is a UI
  polish phase verified through type-checking, build, and manual UAT.
- Existing infrastructure (`tsc`, `next build`, `eslint`) covers automated
  signal for all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Filter sheet dismisses via swipe-down and outside-tap while a filtered query is in flight | PLSH-01, PLSH-02 | Gesture + async interaction; no DOM test harness | On `/search`, apply a filter, then while results load swipe the sheet down and tap the backdrop — sheet closes both ways |
| Wishlist cards show no wear UI; owned cards still do | PLSH-03 | Visual diff across two grids | Open profile wishlist tab — no "Never worn"/last-worn line, no wear badge; open collection tab — wear UI present |
| Every card in a grid has identical outer height | PLSH-04 | Visual/layout assertion | Inspect collection + wishlist grids — sparse and full cards align to the same bottom edge |
| Add-watch button appears right-aligned above the grid; end-of-grid AddWatchCard gone | PLSH-05 | Visual placement | Populated collection/wishlist tabs show the button in the filter row; no trailing AddWatchCard tile |
| Device avatar upload with circular crop stores to Supabase Storage and displays | PLSH-06 | File picker + crop gesture + storage round-trip | In ProfileEditForm pick an image, drag/zoom under circular mask, save — avatar updates on profile surfaces; URL text field is gone |

---

## Validation Sign-Off

- [ ] All tasks have automated verify (type/build) or a manual UAT entry above
- [ ] Sampling continuity: `tsc --noEmit` runs after every task commit
- [ ] Wave 0 covers all MISSING references (none — no framework introduced)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
