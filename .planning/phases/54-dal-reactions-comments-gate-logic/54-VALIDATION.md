---
phase: 54
slug: dal-reactions-comments-gate-logic
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-22
---

# Phase 54 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (project-wide) |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npm run test -- src/data/__tests__/reactions-comments-gate.test.ts` |
| **Full suite command** | `npm run test` |
| **Integration command** | `npm run test -- tests/integration/phase54-dal-gate.test.ts` (requires local Supabase Docker; `describe.skip` unless `DATABASE_URL` is localhost) |
| **Estimated runtime** | ~3s unit (mocked db) · integration gated on localhost |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- src/data/__tests__/reactions-comments-gate.test.ts` (unit, mocked db — fast)
- **After every plan wave:** Run `npm run test -- tests/integration/phase54-dal-gate.test.ts` (integration, local Supabase Docker)
- **Before `/gsd-verify-work`:** Full `npm run test` suite must be green
- **Max feedback latency:** ~5s (unit)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 54-W0 | — | 0 | GATE-01/04/05, SEC-02 | T-SEC-02 | Test scaffolds exist & are runnable | infra | `npm run test -- tests/integration/phase54-dal-gate.test.ts` | ❌ W0 | ⬜ pending |
| GATE-05 | follows | — | GATE-05 | — | `isMutualFollow(a,b)` returns false when only A→B exists (single query, bidirectional) | unit + integration | `npm run test -- src/data/__tests__/reactions-comments-gate.test.ts` | ❌ W0 | ⬜ pending |
| GATE-01 | comments | — | GATE-01 | — | `getCommentsForTarget` returns `[]` for non-mutual on wishlist; returns comments for owned/sold/grail + all wears | integration | `npm run test -- tests/integration/phase54-dal-gate.test.ts` | ❌ W0 | ⬜ pending |
| GATE-04 | comments | — | GATE-04 | — | Owner can always read + `createComment` on own watch regardless of gate | integration | `npm run test -- tests/integration/phase54-dal-gate.test.ts` | ❌ W0 | ⬜ pending |
| SEC-02 | comments | — | SEC-02 | T-SEC-02 | `createComment` on wishlist watch throws `CommentGateError` for non-mutual caller (DAL-direct, bypassing RLS) | integration | `npm run test -- tests/integration/phase54-dal-gate.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/integration/phase54-dal-gate.test.ts` — SEC-02, GATE-04, GATE-05 integration suite (localhost-gated; mixes Drizzle `db` RLS-bypass with supabase-js clients; seeds two users + follow rows + a wishlist watch)
- [ ] `src/data/__tests__/reactions-comments-gate.test.ts` — mocked-db unit tests for `isMutualFollow` (false for one-way follow) and `canViewerCommentOnTarget` (all gate branches: owner / non-wishlist / mutual-follow / non-mutual)

*Both are new files — no existing infrastructure covers Phase 54 requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| — | — | — | — |

*All phase behaviors have automated verification (the SEC-02 / GATE-04 / GATE-05 contract is fully exercisable via the localhost-gated integration suite + mocked-db unit suite).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
