# Phase 74: DupeBanner Gate Refinement + Mobile Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-30
**Phase:** 74-dupebanner-gate-refinement-mobile-polish
**Areas discussed:** DUPE-04 CTA treatment, DUPE-04 prop surface, MOB-01 implementation locus, Test + verification shape

**Flow note:** User delegated all four gray-area decisions to Claude ("you can take this one") after a scope-clarification turn. Decisions below reflect Claude's recommendations applied against the v8.1 milestone constraints (subtraction-of-defects pattern, build-is-the-gate, bundle-deploy preference, additive-prop discipline).

---

## DUPE-04 CTA treatment

| Option | Description | Selected |
|--------|-------------|----------|
| Hide CTA entirely while DupeBanner mounted | No "Saving..." copy, no disabled button stub. DupeBanner is the sole choice surface. | ✓ |
| Distinct copy ("Use the banner above") | Keep button visible but disabled; differentiate banner-gated from saving-in-progress with new string. | |
| Disable + render small helper text below the button | Disabled CTA with explanatory micro-copy underneath. | |

**Claude's choice (per delegation):** Hide entirely.
**Rationale:** Minimum-surface diff (no new strings, no copy-translation surface). ROADMAP success criterion 1 explicitly allows "hidden entirely." Verifier's 70-VERIFICATION.md WR-01 note flags it as the "alternative fix." Removes the need for pending-vs-gated copy disambiguation. ARIA-clean (no disabled button under the banner that users can keyboard-Tab to). Aligns with operator preference for clarity over copy proliferation in v8.1 polish.
**Captured as:** D-01 in CONTEXT.md.

---

## DUPE-04 prop surface

| Option | Description | Selected |
|--------|-------------|----------|
| Additive `bannerActive?: boolean` prop on ConfirmStep | Phase 68 D-03 allows additive props. Revert pending OR-combine; add new gate signal. Early-return null for Section 6 inside ConfirmStep. | ✓ |
| Conditionally not-render `<ConfirmStep>` in AddWatchFlow.tsx | Wrap the JSX with `{!state.dupeContext && <ConfirmStep ...>}`. Coarser-grained gate. | |
| Revert `pending=true` gating and gate via a different mechanism | Restore Phase 68 D-03 pending purity, find another path. | |

**Claude's choice (per delegation):** Additive `bannerActive?: boolean` prop on ConfirmStep.
**Rationale:** Colocates the gating decision with the gated element (ConfirmStep owns its CTA visibility). Cleanly separates `pending` (real async work — Phase 68 D-03 LOCKED semantics restored) from `bannerActive` (banner gate — new). Conditional-not-render of the whole ConfirmStep would unmount/remount inputs on dupe-context toggle, losing user-entered values and risking radiogroup focus reset (recurrence-3 of the WAI-ARIA pattern from `project_phase_68_complete`). The additive-prop pattern is already established (Phase 70 D-17 added optional spec props).
**Captured as:** D-02 + D-03 + D-05 in CONTEXT.md.

---

## MOB-01 implementation locus

| Option | Description | Selected |
|--------|-------------|----------|
| Global `@layer base` CSS rule + audit/rewrite known `text-sm` overrides | Two-pronged: floor for native elements + responsive `text-base md:text-sm` on the 3 known offenders. | ✓ |
| Global CSS rule only with `!important` | Single line wins specificity but introduces `!important` in the codebase. | |
| Apply `text-base` to shadcn Input primitive only | Component-local; doesn't catch raw `<textarea>` / `<input>` / `<select>`. | |
| Audit/rewrite overrides only (no base CSS rule) | Cleaner Tailwind philosophy but no floor for future raw elements. | |

**Claude's choice (per delegation):** Global `@layer base` rule + audit/rewrite the 3 user-facing offenders (CommentCompose, CommentItem, SearchEntry).
**Rationale:** REQUIREMENTS.md explicitly specifies a global CSS rule. Avoids `!important` (cleaner). shadcn Input + Textarea primitives already use `text-base md:text-sm` (16px mobile, 14px desktop) — D-07 propagates the same pattern to the 3 raw-element offenders identified via grep. Admin-only files (`ListEditorClient.tsx`, etc.) are explicitly out of scope to keep the phase narrow.
**Captured as:** D-06 + D-07 + D-08 + D-09 in CONTEXT.md.

---

## Test + verification shape

| Option | Description | Selected |
|--------|-------------|----------|
| Per-defect unit tests + viewport static guard + className regression guard + prod UAT | Layered: jsdom RTL for DUPE-04 + two `tests/static/` node-env guards for MOB-01 + manual iOS Safari walk-through. | ✓ |
| Per-defect unit tests only | jsdom-only; no static guards. | |
| Per-defect unit tests + viewport static guard | One static guard; skip the className regression guard. | |
| Layer manual prod UAT items beyond MOB-01 | Add UAT walk-throughs for DUPE-04 paths on prod. | |

**Claude's choice (per delegation):** Layered approach — DUPE-04 unit tests (update 3 existing WR-01 tests with disappearance-paired assertions + add new WR-01 Test D) + MOB-01 viewport-meta static guard + MOB-01 `text-sm`-on-native-form-controls regression guard (scoped to 3 known-fixed files) + bundled prod UAT walk on iPhone Safari.
**Rationale:** DUPE-04 is deterministically testable in jsdom (presence/absence of CTA button). MOB-01's viewport-meta guard catches future "easy fix" regressions (someone adding `maximum-scale=1`). MOB-01's `text-sm`-className guard catches the most common regression (className revert). Pinch-zoom + actual iOS Safari font-rendering can ONLY be verified on a real iPhone — bundled with the v8.1 prod UAT walk (Phase 72 + 73 + 74) per `feedback_mobile_ui_verify_on_prod`. Both static guards use `// @vitest-environment node` pragma per `project_vitest_static_node_env` (fs.readFileSync walking).
**Captured as:** D-04 + D-10 + D-11 + D-12 + D-13 + D-14 + D-15 in CONTEXT.md.

---

## Claude's Discretion

User delegated wholesale ("you can take this one"). Decisions above reflect Claude's choices. Remaining discretion items embedded in CONTEXT.md `### Claude's Discretion` block cover:
- `bannerActive` prop placement order in the ConfirmStep interface
- Exact CSS comment wording in globals.css for the iOS-zoom rationale
- CommentCompose / CommentItem className token-replacement readability
- WR-01 Test D phrasing (pure-absence assertion vs. attempt-and-confirm-nothing-fires)
- Static guard regex strictness
- Consolidating D-11 + D-12 into a single static guard file vs. keeping them separate

---

## Deferred Ideas

Captured verbatim in CONTEXT.md `<deferred>` section:
- Admin-tool input audit for MOB-01 (admin-only files keep `text-sm`)
- CommentCompose + CommentItem refactor onto shadcn Textarea primitive
- ESLint rule enforcing `text-base md:text-sm` on native form controls
- CTA copy variant for DUPE-04 (rejected in favor of hide-entirely; additive `bannerActive` prop preserves the pivot option)
- Aria-live announcement when DupeBanner mounts
- Computed font-size unit test for MOB-01 (requires Tailwind compilation in vitest)
- Pinch-zoom automated test (Safari runtime behavior)
- Next.js 16 `Viewport` metadata expansion beyond `{ viewportFit: 'cover' }`

### Reviewed Todos (not folded)
None — `gsd-sdk query todo.match-phase 74` returned 0 matches.
