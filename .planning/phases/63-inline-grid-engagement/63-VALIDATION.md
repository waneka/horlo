---
phase: 63
slug: inline-grid-engagement
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-27
---

# Phase 63 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^2.1.9 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run tests/data/getBatchedWatchCounts.test.ts tests/actions/reactions.test.ts tests/actions/comments.test.ts` |
| **Full suite command** | `npm run test` |
| **Build gate** | `npm run build` (exit 0 is the authoritative gate — MEMORY `project_baseline_not_green_build_is_gate`) |
| **Estimated runtime** | ~10s quick / ~60s full |

---

## Sampling Rate

- **After every task commit:** Run quick command (`getBatchedWatchCounts` + `reactions` + `comments` action tests)
- **After every plan wave:** Run `npm run test`
- **Before `/gsd-verify-work`:** `npm run build` must exit 0 (authoritative gate; the ~77 pre-existing tsc test-file errors and 1 pre-existing test failure are baseline noise)
- **Max feedback latency:** ~10 seconds (quick) / ~60 seconds (full)

---

## Per-Task Verification Map

| Req | Behavior | Test Type | Automated Command | File Exists | Status |
|-----|----------|-----------|-------------------|-------------|--------|
| GRID-01 | `getBatchedWatchCounts` returns `liked: true` for watches the viewer liked, `false` otherwise | unit | `npx vitest run tests/data/getBatchedWatchCounts.test.ts` | ✅ (new cases) | ⬜ pending |
| GRID-01 | `toggleLikeAction` revalidates `viewer:{userId}:counts` tag (D-12 gap fix) | unit | `npx vitest run tests/actions/reactions.test.ts` | ✅ (new assertion) | ⬜ pending |
| GRID-03 | `getBatchedWatchCounts` query count stays ≤6 (Q6 added, no N+1) | unit | `npx vitest run tests/data/getBatchedWatchCounts.test.ts` | ✅ (budget assertion) | ⬜ pending |
| GRID-05 | `getBatchedWatchCounts` returns `canComment: false` for a non-mutual viewer on a foreign wishlist watch, `true` otherwise | unit | `npx vitest run tests/data/getBatchedWatchCounts.test.ts` | ✅ (new cases) | ⬜ pending |
| GRID-05 | `addCommentAction` revalidates `viewer:{userId}:counts` tag (D-12) | unit | `npx vitest run tests/actions/comments.test.ts` | ✅ (new assertion) | ⬜ pending |
| GRID-05 | `createComment` re-checks `canViewerCommentOnTarget` and throws `CommentGateError` for gated viewer (D-10 server gate) | unit | `npx vitest run tests/data/` (existing gate coverage) | ✅ existing | ⬜ pending |
| GRID-02 / GRID-04 | Composer sheet renders `CommentCompose` with NO `CommentThread`/`CommentList` (compose-only) | structural | `npm run build` (type/JSX check) + source assertion | build only | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

The existing test files already cover `getBatchedWatchCounts`, `toggleLikeAction`, and `addCommentAction`. The gaps are new test CASES within existing files, not new files:

- [ ] `tests/data/getBatchedWatchCounts.test.ts` — add cases asserting `liked: true/false` and `canComment: true/false` in the result; assert Q6 (`watch_likes` for viewer) is enqueued and total query count stays ≤6. **The mock result queue is consumed by call order — add a Q6 slot to each test's `mockResultQueue` or the mock breaks with "unexpected queue dequeue".**
- [ ] `tests/actions/reactions.test.ts` — add assertion that `revalidateTag` is called with `viewer:{userId}:counts` after a successful toggle
- [ ] `tests/actions/comments.test.ts` — add assertion that `revalidateTag` is called with `viewer:{userId}:counts` after a successful `addCommentAction`

---

## Manual-Only Verifications

Mobile/touch/optimistic UI behavior is verified on **PROD** (push → Vercel), not locally — local e2e skips on an empty test DB (MEMORY `feedback_mobile_ui_verify_on_prod`). Classify these `human_needed`, bundle into one deploy, build-gate before push.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Chip tap ≠ navigate (tapping ♥/💬 does not open `/w/[ref]`; tapping elsewhere does) | GRID-01/02, D-02 | Touch-event propagation only observable on a real device against the wrapping `<Link>` | On prod, open a non-owner profile grid; tap ♥ → like fires, no nav; tap card body → detail opens |
| Owner sees no chips; non-owner authenticated viewer sees chips | D-03 | Viewer-identity branch needs two real accounts | On prod, view own grid (no chips, static counts) then a foreign grid (chips visible) |
| Optimistic like flip-then-reconcile | GRID-03, D-05 | Animation/timing visible only at runtime | On prod, tap ♥ → instant flip; confirm count reconciles to server value; re-tap is idempotent (no error toast) |
| Composer sheet opens on 💬 tap, posts, dismisses, fires 'Comment posted' toast | GRID-02, D-06/D-07 | Sheet open/close + sonner toast are runtime behaviors | On prod, tap 💬 → sheet with watch identity + textarea; Post → sheet closes, toast fires, count bumps |
| Post failure keeps typed text + rolls back count bump | D-08 | Failure path requires induced server error | Force a failure (e.g., offline); confirm text retained and count reverts with failure toast |
| Gated foreign-wishlist card hides 💬 chip (♥ stays) | GRID-05, D-09 | Requires a non-mutual viewer on a foreign wishlist | On prod, as a non-follower, view another user's wishlist grid — 💬 absent, ♥ present |
| navigate-away/back shows fresh liked/count state | GRID-03, D-12 | Cache re-hydration only after `viewer:counts` tag busts + cache fills | On prod (after cache warms), like → navigate away → back; state persists fresh |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (or are classified human_needed with prod instructions)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (new test cases in 3 existing files)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s (full suite)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
