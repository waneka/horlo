---
phase: 32
slug: debt-09-notespublic-fix
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-06
---

# Phase 32 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 2.1.9 |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `npx vitest run tests/actions/watches.notesPublic.test.ts` |
| **Full suite command** | `npm test` (alias for `vitest run`) |
| **Estimated runtime** | ~3s quick / ~30–60s full |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/actions/watches.notesPublic.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 32-01-01 | 01 | 1 | DEBT-09 | — | N/A (server-action regression fix) | unit | `npx vitest run tests/actions/watches.notesPublic.test.ts` | ✅ | ⬜ pending |
| 32-01-02 | 01 | 1 | DEBT-09 | — | N/A | unit | `npx vitest run tests/actions/watches.test.ts` | ✅ | ⬜ pending |
| 32-01-03 | 01 | 1 | DEBT-09 | — | N/A | unit | `npm test` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* The 4 RED tests in `tests/actions/watches.notesPublic.test.ts` already exist as the GREEN target. No new test files, no fixture changes, no framework install required.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `revalidatePath('/u/[username]', 'layout')` cascades to `/u/{user}/notes` rendering | DEBT-09 | Server-side cache behavior under real Next.js dispatcher; vitest mock asserts the call but cannot verify the framework's downstream invalidation cascade | (Optional smoke check — not required for green) Start `npm run dev`, edit a watch's `notesPublic` from `/u/{user}/edit/{id}`, navigate to `/u/{user}/notes`, confirm `<NoteVisibilityPill>` reflects the new state without a hard refresh |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references — N/A (no Wave 0 needed)
- [ ] No watch-mode flags (vitest invocations use `run` not `watch`)
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter (toggle after planner aligns task IDs)

**Approval:** pending
