---
phase: 65
slug: follow-scoped-owners-module
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-28
source: extracted from 65-RESEARCH.md §Validation Architecture
---

# Phase 65 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Extracted from `65-RESEARCH.md` §Validation Architecture (the planner's
> RESEARCH.md is the source of truth; this artifact exists to satisfy
> the Nyquist gate's structural assumption that VALIDATION.md is
> standalone, per `gsd-plan-checker` Dimension 8 Check 8e).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/static/ tests/data/getFollowedOwnersForCatalog.test.ts --reporter=verbose` |
| **Full suite command** | `npm run test` |
| **Build gate command** | `npm run build` (exit 0 — memory `project_baseline_not_green_build_is_gate`) |
| **Estimated runtime** | ~10s static; ~60s full; DAL integration ~5s per file when env present |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/static/ --reporter=verbose` (~10s)
- **After every plan wave:** Run `npm run test` (~60s full suite)
- **Before `/gsd-verify-work`:** `npm run build` must exit 0 AND full suite green
- **Max feedback latency:** ~10s for fast loop; ~60s for wave merge

---

## Per-Requirement Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists |
|--------|----------|-----------|-------------------|-------------|
| FOLL-01 | Module returns `null` when `owners.length === 0` (hide-if-empty) | Unit (component) | `npx vitest run tests/components/insights/FollowedOwnersModule.test.tsx -t "hide-if-empty"` | ❌ Wave 0 |
| FOLL-01 | Branch 1 null-catalogId → DAL not called or returns empty (no DOM) | Static (fs-scan grep for guard) | Extend `tests/static/watch-detail-ia-order.test.ts` | ⚠️ extend |
| FOLL-02 | DAL excludes followed users you do NOT follow (Test 7) | Integration (DAL) | `npx vitest run tests/data/getFollowedOwnersForCatalog.test.ts -t "Test 7"` | ❌ Wave 0 |
| FOLL-02 | DAL includes one-way follows; NOT mutual-only (Test 8) | Integration (DAL) | `npx vitest run tests/data/getFollowedOwnersForCatalog.test.ts -t "Test 8"` | ❌ Wave 0 |
| FOLL-03 | Chip renders `<Link href="/u/${username}/collection">` with `aria-label` | Unit (component) | `npx vitest run tests/components/insights/FollowedOwnersModule.test.tsx -t "chip link"` | ❌ Wave 0 |
| FOLL-04 | DAL excludes profilePublic=false (Test 1 mirror) | Integration (DAL) | Same DAL file | ❌ Wave 0 |
| FOLL-04 | DAL excludes collectionPublic=false (Test 2 mirror) | Integration (DAL) | Same | ❌ Wave 0 |
| FOLL-04 | DAL excludes viewer self (Test 3 mirror) | Integration (DAL) | Same | ❌ Wave 0 |
| FOLL-04 | DAL excludes sold-status rows (Test 4 mirror) | Integration (DAL) | Same | ❌ Wave 0 |
| FOLL-04 | DAL orders by `watches.created_at DESC` (Test 5 mirror) | Integration (DAL) | Same | ❌ Wave 0 |
| FOLL-04 | DAL dedups multi-row-per-user owned+wishlist (Test 6 mirror) | Integration (DAL) | Same | ❌ Wave 0 |
| FOLL-04 | "+N more" caption renders correctly when totalCount > owners.length | Unit (component) | `npx vitest run tests/components/insights/FollowedOwnersModule.test.tsx -t "and N more"` | ❌ Wave 0 |
| FOLL-04 | Page.tsx adds new DAL inside Promise.all (not awaited serially) | Static (fs-scan source position) | Extend `tests/static/watch-detail-ia-order.test.ts` | ⚠️ extend |
| PAGE-03 preserve | `unstable_instant = false` still set; `await connection()` still above Suspense | Static (existing guard) | `npx vitest run tests/static/ppr-dynamic-before-use-cache.test.ts` | ✅ existing |
| PAGE-03 preserve | `FollowedOwnersModule` has NO `'use client'` directive | Static (grep) | `npx vitest run tests/static/followed-owners-module-rsc.test.ts` | ❌ Wave 0 |
| PAGE-03 preserve | `WatchDetailHero` does NOT import the DAL function from `@/data/follows` | Static (grep, import-aware regex) | Extend `tests/static/watch-detail-ia-order.test.ts` | ⚠️ extend |

---

## Wave 0 Requirements

- [ ] `tests/data/getFollowedOwnersForCatalog.test.ts` — full mirror of `getCollectorsForCatalog.test.ts` (Tests 1–6) + new Tests 7, 8 for follow-direction gate. Reuses `seedProfile` / `seedTestCatalogRow` / `seedWatchForCatalog` helpers from the existing file (copy-paste preferred for regression isolation).
- [ ] `tests/components/insights/FollowedOwnersModule.test.tsx` — unit tests for: (a) `null` return on empty owners, (b) chip link `href` / `aria-label` shape, (c) "+N more" caption renders/omitted correctly, (d) renders the literal "From your circle" header.
- [ ] `tests/static/followed-owners-module-rsc.test.ts` — `// @vitest-environment node` on line 1 (per `project_vitest_static_node_env` memory) + `readFileSync` of `FollowedOwnersModule.tsx`, assert NO `'use client'` or `'use cache'` directive. Mirrors `tests/static/comment-thread-no-client.test.ts`.
- [ ] Extend `tests/static/watch-detail-ia-order.test.ts` to (a) assert the new DAL call sits inside each branch's `Promise.all` (not awaited serially), (b) assert `WatchDetailHero.tsx` does not import the `getFollowedOwnersForCatalog` *function* (allows `import type { FollowedOwner }`).

---

## Manual-Only Verifications (`human_needed` on prod)

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Responsive mobile single-column collapse | FOLL-01, success-criterion 5 | Visual / viewport — memory `feedback_mobile_ui_verify_on_prod` | Resize prod browser to mobile width; module stacks naturally under hero right column |
| Vertical chip stack proportion in narrow right column | UI-SPEC D-04 | Subjective layout call | Visual inspection on a watch with 3–7 followed owners |
| 44px tap-target on mobile | UI-SPEC accessibility | Tap-target sized at the device | Use mobile inspector or physical device tap |
| Soft-nav → `/w/[ref]` does NOT regress React #419 | PAGE-03 preserve | Cache-fill timing — memory `project_ppr_dynamic_before_use_cache` | Navigate from a grid card to a watch detail AFTER cache fills on prod; no #419 in console |
| "From your circle" placement: between LikeButton+jump-row and Last-Worn line on owner view; between LikeButton+jump-row and (no Last-Worn) on cross-user view | UI-SPEC D-10 | Visual order check | Hit prod on owner + cross-user URLs; eyeball the order |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (verified in 65-01/02/03-PLAN.md)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (4 new test files / extensions listed above)
- [x] No watch-mode flags (commands use `vitest run`, not `vitest watch`)
- [x] Feedback latency < 10s (quick) / 60s (full)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-28 (extracted from RESEARCH.md by orchestrator during plan-phase 65 --chain after gsd-plan-checker flagged structural gap)
