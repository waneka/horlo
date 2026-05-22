---
phase: 55
slug: server-actions-notification-dedup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-22
---

# Phase 55 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `55-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npm test -- reactions.test.ts comments.test.ts logger.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10–20 seconds (unit suite); integration tests require live DB |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- reactions.test.ts comments.test.ts logger.test.ts` (targeted fast loop)
- **After every plan wave:** Run `npm test` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~20 seconds

---

## Per-Task Verification Map

> Task IDs are assigned at plan time (`/gsd-plan-phase`). Until then this map is keyed by
> requirement + secure behavior. The planner/executor links each row to a concrete `{N}-PP-TT`
> task and the Nyquist auditor reconciles file existence.

| Task ID | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | SEC-03 | T-55-IDOR | `toggleLikeAction` returns `{success:false, error:'Not authenticated'}` when `getCurrentUser` throws | unit | `npm test -- reactions.test.ts` | ❌ W0 | ⬜ pending |
| TBD | SEC-03 | T-55-IDOR | `toggleLikeAction` rejects payload with extra keys (Zod `.strict()`) | unit | `npm test -- reactions.test.ts` | ❌ W0 | ⬜ pending |
| TBD | SEC-03 | T-55-IDOR | `addCommentAction` rejects unauthenticated caller | unit | `npm test -- comments.test.ts` | ❌ W0 | ⬜ pending |
| TBD | SEC-03 | T-55-IDOR | `editCommentAction`/`deleteCommentAction` derive authorId from `getCurrentUser().id`, never client-supplied | unit | `npm test -- comments.test.ts` | ❌ W0 | ⬜ pending |
| TBD | NOTIF-11 | — | `toggleLikeAction` calls `logNotification` ONLY when `liked===true` (not on unlike) | unit | `npm test -- reactions.test.ts` | ❌ W0 | ⬜ pending |
| TBD | NOTIF-11 | — | `logNotification`/action does NOT notify when actor === target owner (self-guard) | unit | `npm test -- reactions.test.ts` | ❌ W0 | ⬜ pending |
| TBD | NOTIF-12 | — | `addCommentAction` calls `logNotification` on successful insert (non-self) | unit | `npm test -- comments.test.ts` | ❌ W0 | ⬜ pending |
| TBD | NOTIF-12 | — | `editCommentAction` does NOT call `logNotification` (comment notifications INSERT-only) | unit | `npm test -- comments.test.ts` | ❌ W0 | ⬜ pending |
| TBD | NOTIF-13 | — | `logNotification` `watch_like` payload includes `watch_id` (not `wear_event_id`) | unit | `npm test -- logger.test.ts` | ❌ W0 (new file) | ⬜ pending |
| TBD | NOTIF-13 | — | `logNotification` `wear_like` payload includes `wear_event_id` (not `watch_id`) | unit | `npm test -- logger.test.ts` | ❌ W0 (new file) | ⬜ pending |
| TBD | NOTIF-14 | — | Like dedup raw SQL emits `ON CONFLICT DO NOTHING`; rapid like→unlike→like → at most 1 notification row | unit | `npm test -- logger.test.ts` | ❌ W0 (new file) | ⬜ pending |
| TBD | SEC-05 | T-55-LEAK | `toggleLikeAction` calls both `revalidateTag(reactions:{type}:{id}, 'max')` AND `updateTag(viewer:{userId}:reactions)` | unit | `npm test -- reactions.test.ts` | ❌ W0 | ⬜ pending |
| TBD | SEC-05 | T-55-LEAK | comment actions call `revalidateTag(profile:{username}, 'max')` and NO comments-thread tag (D-06) | unit | `npm test -- comments.test.ts` | ❌ W0 | ⬜ pending |
| TBD | D-09 | — | `addCommentAction` returns `{success:false, error, code:'gate'}` on `CommentGateError` | unit | `npm test -- comments.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/actions/reactions.test.ts` — stubs for SEC-03, NOTIF-11, SEC-05 (`toggleLikeAction`)
- [ ] `tests/actions/comments.test.ts` — stubs for SEC-03, NOTIF-12, SEC-05, D-09 (comment actions)
- [ ] `tests/lib/notifications/logger.test.ts` — stubs for NOTIF-13, NOTIF-14 (NEW file — dedup `ON CONFLICT DO NOTHING` assertion)

*Vitest is already installed and configured (`vitest.config.ts`) — no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Prod dedup indexes enforced (`supabase db push --linked`) | NOTIF-14 / D-03 | Prod DDL push is a blocking human-action checkpoint; cannot be automated in CI per project DB rules | After local verify, run `supabase db push --linked`; confirm `notifications_watch_like_dedup` and `notifications_wear_like_dedup` exist via `\d notifications` against the linked DB |
| Cross-viewer cache isolation at runtime (viewer A's like not visible to viewer B) | SEC-05 | True cross-request cache fan-out is observable only against a running app + cache layer | After deploy, like a target as user A, load the same target as user B in a separate session, confirm B does not see A's liked state without a like of their own |

*The `ON CONFLICT DO NOTHING` SQL emission and the `updateTag`/`revalidateTag` call shape ARE automatable as unit assertions (see map). The two rows above are the residual runtime/deploy checks.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (3 test files)
- [ ] No watch-mode flags (`vitest run`, not `vitest --watch`)
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
