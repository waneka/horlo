---
phase: 27
slug: watch-card-collection-render-polish
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-04
upgraded: 2026-05-16
upgrade_ref: Phase 42 DEBT-10 (42-nyquist-hardening-sweep-uat-triage-parallel-track)
backfill_location: .planning/phases/42-nyquist-hardening-sweep-uat-triage-parallel-track/42-validation-backfill/
backfill_reason: source phase directory deleted by commit dd58ba4
---

# Phase 27 — Validation Strategy (Phase 42 Upgraded)

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
| **Quick run command** | `npx vitest run --project unit tests/integration/phase27-schema.test.ts tests/integration/phase27-bulk-reorder.test.ts tests/integration/phase27-backfill.test.ts tests/integration/phase27-getwatchesbyuser-order.test.ts` |
| **Browser test command** | `npx vitest run --project browser tests/browser/phase27-css-chain.browser.test.tsx` |
| **Full suite command** | `npm test` (runs `vitest run`; reads `vitest.workspace.ts`) |
| **Estimated runtime** | ~30s focused / ~90s full suite |

---

## Sampling Rate

- **After every task commit:** Run focused quick run command (above)
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green AND manual UAT of drag-and-drop on real mobile device + desktop browser
- **Max feedback latency:** 30 seconds (focused) / 90 seconds (full)

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| WISH-01 | `sort_order` column exists, NOT NULL, default 0; index `(user_id, sort_order)` exists | integration | `npx vitest run --project unit tests/integration/phase27-schema.test.ts` | ✅ existing | approved |
| WISH-01 | Backfill assigns `sort_order` 0..N per user for wishlist+grail rows; no duplicates | integration | `npx vitest run --project unit tests/integration/phase27-backfill.test.ts` | ✅ existing | approved |
| WISH-01 | `bulkReorderWishlist` enforces owner-only via WHERE clause + post-update count check | integration | `npx vitest run --project unit tests/integration/phase27-bulk-reorder.test.ts` | ✅ existing | approved |
| WISH-01 | `getWatchesByUser` returns wishlist watches in `sort_order ASC` then `createdAt DESC` | integration | `npx vitest run --project unit tests/integration/phase27-getwatchesbyuser-order.test.ts` | ✅ existing | approved |
| VIS-07 | `WishlistTabContent` and `CollectionTabContent` render `grid-cols-2` on mobile; no `grid-cols-1` on default viewport | component | `npx vitest run --project unit tests/components/profile/` | ✅ existing | approved |
| VIS-08 | `ProfileWatchCard` price line: renders Paid/Target/Market labels per status × price presence combos | component | `npx vitest run --project unit tests/components/profile/` | ✅ existing | approved |
| VIS-07/08 | `aspect-[4/5]` card wrapper computes correct height-to-width ratio; `grid-cols-2` equal-column layout | browser (computed style) | `npx vitest run --project browser tests/browser/phase27-css-chain.browser.test.tsx` | ✅ existing (Phase 42 backfill) | approved |
| WISH-01 | Drag-and-drop happy path: card 0 → position 2, refresh, order persists. iOS Safari touch. Keyboard reorder with aria-live. | E2E manual | Manual UAT (see Manual-Only Verifications) | manual | approved (prod UAT 7132ac0, 2026-05-02) |

*Status: ⬜ pending · ✅ approved · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/integration/phase27-schema.test.ts` — `sort_order` column + index (covers WISH-01 schema)
- [x] `tests/integration/phase27-backfill.test.ts` — backfill row-shape per user (covers WISH-01 backfill)
- [x] `tests/integration/phase27-bulk-reorder.test.ts` — owner-only enforcement at DAL (covers WISH-01 action layer)
- [x] `tests/integration/phase27-getwatchesbyuser-order.test.ts` — read-path ORDER BY (covers WISH-01 ORDER BY)
- [x] `tests/browser/phase27-css-chain.browser.test.tsx` — computed-style assertions for `aspect-[4/5]` wrapper + `grid-cols-2` layout (Phase 42 DEBT-10 D-07/D-08)

All Wave 0 deliverables are satisfied. The original VALIDATION.md marked all integration tests `❌ W0 (not created)` — those files now exist in `tests/integration/phase27-*.test.ts` (created during Phase 27 execution, after the VALIDATION.md was authored). The `❌ W0` markers were stale by the time of Phase 42 recovery.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| iOS Safari touch drag | WISH-01 | No iOS device automation in this repo (no Playwright). | On iPhone Safari: long-press wishlist card ~250ms → card lifts → drag to new slot → release → refresh page → order persists. |
| Keyboard accessibility | WISH-01 | jsdom does not exercise real focus rings, screen-reader announcements, or arrow-key visual feedback. | Tab to wishlist card → Space (pickup) → Arrow keys (move, aria-live announces position) → Space (drop) or Esc (cancel). |
| Click-through vs. drag dispatch | WISH-01 | Synthetic events in jsdom are not equivalent to real pointer events at OS level. | On desktop + iOS Safari: quick tap navigates; press-and-hold ≥150ms (desktop) / ≥250ms (mobile) initiates drag without navigation. |

Prod UAT sign-off: commit `7132ac0`, 2026-05-02. All manual items verified in production.

---

## Phase 42 Upgrade Notes

**Root cause of `partial`:** The original VALIDATION.md (recovered from `git show dd58ba4^:.planning/phases/27-watch-card-collection-render-polish/27-VALIDATION.md`) contained a full per-task verification map but marked all Wave 0 integration test files as `❌ W0 (not created)`:

- `src/db/__tests__/phase27-schema.test.ts`
- `src/db/__tests__/phase27-backfill.test.ts`
- `src/data/__tests__/watches-bulkReorder.test.ts`
- `src/app/actions/__tests__/reorderWishlist.test.ts`
- `src/data/__tests__/watches-getWatchesByUser-orderBy.test.ts`
- `src/components/profile/__tests__/ProfileWatchCard-priceLine.test.tsx`
- `src/components/profile/__tests__/CollectionTabContent.test.tsx`

**Resolution:** Phase 27 did ship all 5 plans successfully. The Wave 0 test files were created during plan execution AFTER the VALIDATION.md was authored — the `❌ W0` markers became stale. When Phase 42 ran `find tests/ -name "*phase27*"` (42-RESEARCH.md Pitfall 4 verification step), the following files were found:

- `tests/integration/phase27-schema.test.ts` ✅
- `tests/integration/phase27-bulk-reorder.test.ts` ✅
- `tests/integration/phase27-backfill.test.ts` ✅
- `tests/integration/phase27-getwatchesbyuser-order.test.ts` ✅

Note: File paths differ from the original VALIDATION.md (which specified `src/db/__tests__/` and `src/data/__tests__/`); the tests landed in `tests/integration/` instead. The test coverage is equivalent — the paths are the canonical post-execution locations.

**Phase 42 browser CSS-chain coverage:** `tests/browser/phase27-css-chain.browser.test.tsx` (authored in Phase 42 Plan 02) adds D-07/D-08 computed-style assertions:
- `aspect-[4/5]` card wrapper computed height-to-width ratio (the same class of failure risk as Phase 30's `h-full` regression)
- `grid-cols-2` equal-column layout (2 equal-width columns in a 360px grid)

No duplicate test files were created. The per-task map above cites only the real existing files.

**Upgrade applied by:** Phase 42 DEBT-10 (42-nyquist-hardening-sweep-uat-triage-parallel-track), Plan 03, Task 1.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Manual-Only justification with prod UAT citation
- [x] Wave 0 gaps are closed (integration tests confirmed to exist in `tests/integration/phase27-*.test.ts`)
- [x] Browser CSS-chain assertions added for D-07/D-08 compliance
- [x] No duplicate test files created
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** Phase 42 DEBT-10 upgrade — 2026-05-16
