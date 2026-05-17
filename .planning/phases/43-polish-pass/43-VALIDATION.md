---
phase: 43
slug: polish-pass
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-16
---

# Phase 43 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9 (`vitest run`) — component harness under `tests/components/` |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- <name>` (single-file/pattern run) |
| **Full suite command** | `npm test` then `npm run lint && npm run build` |
| **Estimated runtime** | quick ~5–15s; full suite ~60–120s |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- <name>` for the file(s) the task touched
- **After every plan wave:** Run `npm test` (full Vitest suite)
- **Before `/gsd-verify-work`:** Full Vitest suite + `npm run build` must be green
- **Max feedback latency:** 15 seconds (single-file run)

---

## Per-Task Verification Map

> Test files are created inline by the plans (not pre-existing) — `wave_0_complete`
> is `false` by design. Each plan task carries an `<acceptance_criteria>` block whose
> assertions map to the requirement rows below.

| Plan | Requirement | Secure Behavior | Test Type | Automated Command | Status |
|------|-------------|-----------------|-----------|-------------------|--------|
| 43-01 | PLSH-01, PLSH-02 | Filter drawer dismiss never gated on pending query state | component | `npm test -- FilterDrawer` | ⬜ pending |
| 43-01 | PLSH-07 | LLM call uses non-deprecated model ID | component / source | `npm test -- llm` · `grep -n claude-sonnet-4-6 src/lib/extractors/llm.ts` | ⬜ pending |
| 43-02 | PLSH-03, PLSH-04 | N/A | component | `npm test -- ProfileWatchCard` | ⬜ pending |
| 43-03 | PLSH-05 | N/A | component | `npm test -- CollectionTabContent` · `npm test -- WishlistTabContent` | ⬜ pending |
| 43-04 | PLSH-06 | Avatar bucket RLS scoped to `{userId}/` path; ≤size guard enforced; EXIF stripped | component + build | `npm test -- AvatarUploader` · `npm run build` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Vitest 2.1.9 is already configured (`vitest.config.ts`, `tests/components/` harness)
  — no framework install needed.
- Test files for Phase 43 components do not pre-exist; each plan creates its test
  file inline alongside the implementation. `wave_0_complete: false` reflects this —
  there is no separate Wave 0 test-stub task.
- Files created (inline by plans): `tests/components/search/FilterDrawer.test.tsx`,
  `tests/lib/extractors/llm.test.ts` (or extends existing), `tests/components/profile/ProfileWatchCard.test.tsx`,
  `tests/components/profile/CollectionTabContent.test.tsx`,
  `tests/components/profile/WishlistTabContent.test.tsx`,
  `tests/components/profile/AvatarUploader.test.tsx` — final paths are the planner's
  call; they must follow the `tests/components/<dir>/` mirror convention.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Filter sheet dismisses via swipe-down and outside-tap while a filtered query is in flight | PLSH-01, PLSH-02 | Touch gesture + async interaction; not reproducible in jsdom | On `/search`, apply a filter, then while results load swipe the drawer down and tap the backdrop — drawer closes both ways |
| Every card in a grid has identical outer height | PLSH-04 | Cross-card layout assertion best confirmed visually | Inspect collection + wishlist grids — sparse and full cards align to the same bottom edge |
| Add-watch button appears right-aligned above the grid; end-of-grid AddWatchCard gone | PLSH-05 | Visual placement | Populated collection/wishlist tabs show the button in the filter row; no trailing AddWatchCard tile |
| Device avatar upload with circular crop stores to Supabase Storage and displays | PLSH-06 | File picker + crop gesture + storage round-trip | In ProfileEditForm pick an image, drag/zoom under circular mask, save — avatar updates on profile surfaces; URL text field is gone |

---

## Validation Sign-Off

- [x] All tasks have automated verify (`npm test` / build) or a manual UAT entry above
- [x] Sampling continuity: `npm test -- <name>` runs after every task commit
- [x] Wave 0 covers all MISSING references (no framework install; tests created inline)
- [x] No watch-mode flags (`vitest run`, not `vitest`)
- [x] Feedback latency < 15s (single-file run)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-16
