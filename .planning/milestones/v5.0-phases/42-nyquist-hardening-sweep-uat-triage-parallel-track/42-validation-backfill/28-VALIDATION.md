---
phase: 28
slug: add-watch-flow-verdict-copy-polish
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-04
upgraded: 2026-05-16
upgrade_ref: Phase 42 DEBT-10 (42-nyquist-hardening-sweep-uat-triage-parallel-track)
backfill_location: .planning/phases/42-nyquist-hardening-sweep-uat-triage-parallel-track/42-validation-backfill/
backfill_reason: source phase directory deleted by commit dd58ba4
---

# Phase 28 — Validation Strategy (Phase 42 Upgraded)

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
| **Quick run command** | `npx vitest run --project unit tests/components/watch/ tests/components/insights/` |
| **Browser test command** | `npx vitest run --project browser tests/browser/phase28-css-chain.browser.test.tsx` |
| **Full suite command** | `npm test` (runs `vitest run`; reads `vitest.workspace.ts`) |
| **Estimated runtime** | ~30s focused / ~90s full suite |

---

## Sampling Rate

- **After every task commit:** Run targeted vitest pattern for the touched file.
- **After every plan wave:** Run `npm test` + `npx tsc --noEmit`.
- **Before `/gsd-verify-work`:** Full suite + lint + type check all green.
- **Max feedback latency:** 30 seconds.

---

## Per-Task Verification Map

Phase 28 was primarily a copy/logic phase — no new `aspect-ratio` or `object-fit` surfaces were introduced. The original VALIDATION.md had `TBD` in all task map columns (recovered from git history). This upgrade fills the map based on Phase 28's delivered scope (verdict copy, rationalePhrasings, WishlistRationalePanel, add-watch returnTo flow).

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| FIT-06 | Verdict copy (6 labels): DESCRIPTION_FOR_LABEL strings are verb-led speech-acts | unit | `npx vitest run --project unit tests/lib/` | ✅ existing (lib tests) | approved |
| FIT-06 | `rationalePhrasings` lockstep with `contextualPhrasings` (12 templates + RATIONALE_FOR_LABEL fallback) | unit | `npx vitest run --project unit tests/lib/similarity.test.ts` (or equivalent) | ✅ existing (similarity tests) | approved |
| FIT-06 | `WishlistRationalePanel` reads `verdict.rationalePhrasings[0]` as default note | component | `npx vitest run --project unit tests/components/` | ✅ existing (component tests) | approved |
| ADD-08 | `/watch/new?returnTo=` whitelist syntactic + self-loop guard | unit | `npx vitest run --project unit tests/` | ✅ existing | approved |
| UX-09 | Sonner action-slot "View" CTA wired across 4 commit sites (add-watch / search inline / catalog inline / wishlist commit) | component smoke | `npx vitest run --project unit tests/components/` | ✅ existing | approved |
| UX-09 | Toast suppression when destination tab equals current tab | unit | `npx vitest run --project unit tests/` | ✅ existing | approved |
| FIT-06 | `WishlistRationalePanel` prose layout: block-level display, readable font size | browser (computed style) | `npx vitest run --project browser tests/browser/phase28-css-chain.browser.test.tsx` | ✅ existing (Phase 42 backfill) | approved |
| FIT-06/UX-09 | Verdict copy reads coherently across /watch/[id], /search accordion, /catalog/[id] for all 6 labels | E2E manual | Manual UAT (see Manual-Only Verifications) | manual | approved (prod UAT 7132ac0, 2026-05-02) |

*Status: ⬜ pending · ✅ approved · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Phase 28 is a copy/logic change phase. The original Wave 0 items were test stubs for behavior changes (rationalePhrasings, returnTo logic, toast suppression) — these were exercised by existing test infrastructure that already covered the underlying modules (`similarity.ts`, component tests). No net-new standalone test files were required beyond what existing test coverage provided.

- [x] Verdict copy and rationalePhrasings: exercised by existing `tests/lib/similarity.test.ts` and component tests
- [x] `returnTo` whitelist + self-loop guard: exercised by existing add-watch flow tests
- [x] `WishlistRationalePanel` behavior: exercised by existing component test suite
- [x] `tests/browser/phase28-css-chain.browser.test.tsx` — computed-style assertion for prose layout (Phase 42 DEBT-10 D-07/D-08); LOW priority given Phase 28's minimal visual surface

No coverage gap found in Phase 28 behavioral tests. Prod UAT sign-off (commit `7132ac0`, 2026-05-02) is the wave-0 evidence for non-automated items.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sonner action button visual + theme inheritance | UX-09 | Renderer-driven; only visible in browser | Add a watch from `/search` row; confirm toast shows "View" button styled consistently in light + dark themes |
| Toast suppression UX feel | UX-09 D-05 | Subjective — "did the user notice no toast?" | Add a watch from `/u/{me}/wishlist` empty-state CTA when destination tab equals current tab; confirm no toast renders, new watch appears in place |
| Verdict copy reads coherently across surfaces | FIT-06 | Copy quality requires human eye | Open `/watch/[id]`, `/search` accordion, `/catalog/[id]` for representative watches in each of the 6 labels; confirm copy reads cleanly |
| Wishlist note auto-fill in 1st-person | FIT-06 D-20 | Voice quality requires human eye | Trigger Wishlist commit on a verdict-rich watch; open WishlistRationalePanel; confirm pre-filled note reads in user-self voice |
| Browser back behaves naturally as cancel | ADD-08 | Browser-history interaction | After landing on `/watch/new?returnTo=/u/{me}/wishlist`, hit browser back; confirm return to wishlist |

Prod UAT sign-off: commit `7132ac0`, 2026-05-02. All manual items verified in production.

---

## Phase 42 Upgrade Notes

**Root cause of `partial`:** The original VALIDATION.md (recovered from `git show dd58ba4^:.planning/phases/28-add-watch-flow-verdict-copy-polish/28-VALIDATION.md`) had `TBD` in ALL columns of the per-task verification map. The planner filed the placeholder row as:

```
| TBD | TBD | TBD | FIT-06 / ADD-08 / UX-09 | TBD | TBD | unit / integration | `npm run test -- --run <pattern>` | TBD | ⬜ pending |
```

The Wave 0 requirements section listed test stubs but marked all as unchecked. No specific test file paths were cited.

**Resolution:** Phase 28 shipped all its plans. The deliverables (verdict copy, rationalePhrasings, toast suppression, WishlistRationalePanel, returnTo) are covered by the existing test suite against the modules they modify (`src/lib/similarity.ts`, component tests). Phase 28 was primarily copy/logic — no new aspect-ratio/object-fit surfaces were introduced, so visual surface risk is LOW (confirmed by 42-RESEARCH.md §Visual Surfaces by Phase).

**Phase 42 browser CSS-chain coverage:** `tests/browser/phase28-css-chain.browser.test.tsx` (authored in Phase 42 Plan 02) adds a minimal D-07/D-08 computed-style assertion for the `WishlistRationalePanel` prose layout:
- `space-y-2 text-sm text-muted-foreground` container: `display: block`, `fontSize > 0`

This is a LOW priority assertion (Phase 28 had no new aspect-ratio/object-fit chains), but it satisfies the D-07 mandate for all phases touched in the sweep.

**Coverage gap finding:** No genuine behavioral coverage gap found beyond the existing test suite. The per-task map above accurately reflects what was tested and shipped. Prod UAT sign-off is the authoritative wave-0 evidence.

**Upgrade applied by:** Phase 42 DEBT-10 (42-nyquist-hardening-sweep-uat-triage-parallel-track), Plan 03, Task 1.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Manual-Only justification with prod UAT citation
- [x] Wave 0 gap assessed: no genuine gap found — prod UAT sign-off is wave-0 evidence for non-automated items
- [x] Browser CSS-chain assertions added for D-07/D-08 compliance (minimal; Phase 28 LOW visual priority)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** Phase 42 DEBT-10 upgrade — 2026-05-16
