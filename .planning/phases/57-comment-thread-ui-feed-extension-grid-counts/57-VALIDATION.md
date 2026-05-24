---
phase: 57
slug: comment-thread-ui-feed-extension-grid-counts
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-23
---

# Phase 57 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `57-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test && npm run build` |
| **Estimated runtime** | ~30 seconds (unit) + build |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test && npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green + prod visual verification (per MEMORY.md `feedback_mobile_ui_verify_on_prod.md` — mobile/visual confirmed on prod after Vercel deploy, not locally; local e2e skips on empty test DB)
- **Max feedback latency:** ~30 seconds (unit suite)

---

## Per-Task Verification Map

> Task IDs are assigned during planning; map keyed by requirement until plans land.

| Requirement | Behavior | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|------------|-----------------|-----------|-------------------|-------------|--------|
| CMNT-01/02 | `addCommentAction` returns `ActionResult<Comment>` with `id` + `createdAt` | — | N/A | unit (mock DAL) | `npm run test -- tests/actions/addCommentAction.test.ts` | ❌ W0 | ⬜ pending |
| CMNT-03 | Comments render newest-first (DAL returns `desc` order) | — | N/A | unit (mock db) | `npm run test -- tests/data/getCommentsForTarget.test.ts` | ❌ W0 | ⬜ pending |
| CMNT-04 | 500-char enforcement at Zod layer; whitespace-only rejected | — | N/A | unit | `npm run test -- tests/data/getCommentsForTarget.test.ts` | ❌ W0 | ⬜ pending |
| CMNT-05 | Live char counter appears near limit | — | N/A | manual (browser) | n/a | manual | ⬜ pending |
| CMNT-06 | `editCommentAction` returns `Comment` with `editedAt` set | — | author-scoped `(id, authorId)` WHERE | unit (mock DAL) | `npm run test -- tests/actions/editCommentAction.test.ts` | ❌ W0 | ⬜ pending |
| CMNT-07 | `deleteCommentAction` returns `{ id }` + revalidates `profile:{username}` | — | author-scoped delete (IDOR-safe) | unit (mock DAL) | `npm run test -- tests/actions/deleteCommentAction.test.ts` | ❌ W0 | ⬜ pending |
| CMNT-08 | Optimistic insert at top; rollback indicator on failure | — | N/A | manual (browser) | n/a — optimistic timing not testable in jsdom | manual | ⬜ pending |
| CMNT-09 | Comment count present + hidden-at-zero, mirrors `♥ N` | — | N/A | unit + manual | `npm run test -- tests/data/getCommentsForTarget.test.ts` | ❌ W0 | ⬜ pending |
| GATE-03 | `canViewerCommentOnTarget` false for non-mutual on wishlist; two-state locked UI | T-57 gate | no thread + no count leaked to gated viewer | unit | `npm run test -- tests/data/comments.test.ts` | ❌ check/extend | ⬜ pending |
| FEED-06 | `addCommentAction` calls `logActivity` with `commented` type (INSERT-only) | — | N/A | unit (spy on logActivity) | `npm run test -- tests/actions/addCommentAction.test.ts` | ❌ W0 | ⬜ pending |
| **FEED-07** | `getFeedForUser` does NOT return commented-on-wishlist rows for non-eligible viewers | **T-57 leak (HIGH)** | per-viewer target-owner mutual-follow gate | unit (mock db) | `npm run test -- tests/data/getFeedForUser.test.ts` | ✅ exists — add case | ⬜ pending |
| **DISP-01** | `getBatchedWatchCounts` returns `commentCount:0` for gated wishlist watches; no N+1 | **T-57 leak (HIGH)** | comment-half gated, like-half open | unit (mock db) | `npm run test -- tests/data/getBatchedWatchCounts.test.ts` | ❌ W0 | ⬜ pending |
| SEC (thread) | Comment thread does not leak across viewers (no cacheTag on thread) | T-57 cache | uncached Suspense render, no shared cache | manual (code review) | n/a — structural property | manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/actions/addCommentAction.test.ts` — CMNT-01, CMNT-02, FEED-06 (spy on `logActivity`)
- [ ] `tests/actions/editCommentAction.test.ts` — CMNT-06
- [ ] `tests/actions/deleteCommentAction.test.ts` — CMNT-07 (incl. revalidate assertion)
- [ ] `tests/data/getCommentsForTarget.test.ts` — CMNT-03 (desc order), CMNT-04, CMNT-09 count
- [ ] `tests/data/getBatchedWatchCounts.test.ts` — DISP-01 no-N+1 + comment-count gate leak
- [ ] Extend `tests/data/getFeedForUser.test.ts` — FEED-07 gated-wishlist comment case
- [ ] Check/extend `tests/data/comments.test.ts` — GATE-03 `canViewerCommentOnTarget`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Optimistic insert at top + rollback indicator | CMNT-08 | React component interaction + optimistic timing not testable in jsdom | On `/watch/[id]`, post a comment → appears immediately at top in pending state, reconciles on success; force a failure → row disappears with rollback indicator |
| Live char counter near limit | CMNT-05 | Visual reveal threshold (UI-SPEC) | Type toward 500 chars → counter appears at the configured threshold |
| Two-state GATE-03 copy (pre-follow / followed-but-not-mutual / mutual) | GATE-03, D-02 | Multi-state transition needs real follow-relationship flips | Non-mutual viewer on wishlist watch sees "Follow [username] to comment" + Follow button; after following (owner not yet following back) copy changes to "[username] needs to follow you back…"; on mutual, compose box appears |
| Comment thread no cross-viewer cache leak | SEC (thread) | Structural property, no runtime test | Code review: thread is uncached Server Component in Suspense, no `comments:{type}:{id}` cache tag |
| Mobile/overlay rendering (bottom-sheet over photo, CSS chain) | CMNT-01..09 hosts | Mobile/visual confirmed on prod, not locally; CSS-chain blind spot | After Vercel deploy: verify compose+list+edit/delete inside wears-lane bottom-sheet over photo; clear `.next/` before judging any CSS fix |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
