---
phase: 64
slug: detail-page-ia-redesign
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-27
---

# Phase 64 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `64-RESEARCH.md` § Validation Architecture. This phase is a layout/IA recompose —
> structural correctness (RSC/client boundaries, server-tree child order, anchor ids) is
> statically testable; visual/responsive behavior is `human_needed` on prod.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/static/ --reporter=verbose` |
| **Full suite command** | `npm run test` |
| **Build gate command** | `npm run build` (exit 0 is the authoritative gate — MEMORY `project_baseline_not_green_build_is_gate`) |
| **Estimated runtime** | ~10s static / ~60s full |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/static/ --reporter=verbose`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd-verify-work`:** `npm run build` must exit 0
- **Max feedback latency:** ~10 seconds (static guards)

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists |
|--------|----------|-----------|-------------------|-------------|
| PAGE-01 | Server-tree child order: hero → comments → trailing → rails → footer in `page.tsx` (all branches) | Static (fs-scan) | `npx vitest run tests/static/watch-detail-ia-order.test.ts` | ❌ W0 |
| PAGE-02 | `CommentThread` renders before the full spec-card section (not after all rails) | Static (fs-scan) | Same file | ❌ W0 |
| PAGE-03 | `CommentThread` has no `'use client'` and no `'use cache'` at file top | Static (grep) | `npx vitest run tests/static/comment-thread-no-client.test.ts` | ❌ W0 |
| PAGE-03 | `unstable_instant = false` still at `page.tsx` module scope | Static (fs-scan) | `npx vitest run tests/static/ppr-dynamic-before-use-cache.test.ts` | ✅ existing |
| PAGE-03 | `await connection()` still inside the page default export before `<Suspense>` | Static (fs-scan) | Same existing test (add assertion) | ⚠️ partial |
| PAGE-03 | new hero island does not import `CommentThread` (B1 invariant) | Static (grep) | `npx vitest run tests/static/watch-detail-ia-order.test.ts` | ❌ W0 |
| PAGE-04 | `WatchPhotoSection` appears in the hero island source | Static (grep) | Same file | ❌ W0 |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/static/watch-detail-ia-order.test.ts` — static guard for the new IA child order + island-split correctness:
  - PAGE-01: in `src/app/w/[ref]/page.tsx`, hero render line precedes `CommentThread`, which precedes the trailing-content render, which precedes `SameFamilyRail`.
  - PAGE-02: `CommentThread` appears before the full spec-card section by source position.
  - PAGE-03: the hero island source does **not** match `import.*CommentThread`.
  - PAGE-04: the hero island source contains `WatchPhotoSection`.
  - **MUST** start with `// @vitest-environment node` (filesystem reads — MEMORY `project_vitest_static_node_env`; jsdom passes locally but the Vercel prebuild fails without it).
- [ ] `tests/static/comment-thread-no-client.test.ts` — `readFileSync` `CommentThread.tsx`, assert `!includes("'use client'")` and `!includes("'use cache'")` (turns the existing top-of-file documentation comment into an enforced CI guard). MUST use `// @vitest-environment node`.
- [ ] **Pre-existing guard audit (Pitfall 8):** `ppr-dynamic-before-use-cache.test.ts` matches `createSupabaseServerClient(` but the route uses `createSupabaseAdminClient(` — the guard may be vacuously passing. Either fix the pattern or ensure the restructured route keeps the admin-client-before-cached-call ordering the guard intends to enforce.

*Existing infrastructure (`tests/static/`, `ppr-dynamic-before-use-cache.test.ts`, `legacy-watch-routes.test.ts`) covers the Cache Components / route-shape guards; the two new files above cover the IA reorder.*

---

## Manual-Only Verifications (`human_needed` on prod)

> Empty local test DB skips e2e; static tests don't render. Verify on prod (push → Vercel) per MEMORY `feedback_mobile_ui_verify_on_prod`. Bundle into one deploy, build-gate first.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Responsive hero collapse (2-col desktop → 1-col mobile) | PAGE-01/04 | Visual/viewport | Open `/w/[ref]` on desktop + mobile widths; hero is 2-col on `lg`, single-column below |
| Smooth-scroll on comment-count tap | PAGE-02 | Browser scroll behavior | Tap hero comment count → page scrolls to `#comments` section |
| Desktop 2-col hero visual balance | PAGE-04 | Subjective proportion | Carousel vs verdict proportions read deliberately, not cramped |
| `WatchPageSkeleton` mirrors new IA | PAGE-01 | Loading-shell visual | Throttle network; skeleton layout matches the new hero/order |
| "Intentional hierarchy" overall feel | PAGE-01 | Subjective | Comments reachable without scrolling past all rails on a populated watch |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers the two new static guards + the pre-existing-guard audit
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s (static)
- [ ] `nyquist_compliant: true` set in frontmatter (set by planner once tasks map to tests)

**Approval:** pending
