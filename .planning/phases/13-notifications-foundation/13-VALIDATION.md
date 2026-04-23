---
phase: 13
slug: notifications-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-22
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (already installed per repo) |
| **Config file** | `vitest.config.ts` (confirm during Wave 0; install if missing) |
| **Quick run command** | `npx vitest run --reporter=dot` |
| **Full suite command** | `npx vitest run && npm run lint && npm run build` |
| **Estimated runtime** | ~20s unit / ~60s full suite |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=dot`
- **After every plan wave:** Run `npx vitest run && npm run lint && npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

> Populated by planner during plan authoring. Each task in every PLAN.md must map to one row here or carry an explicit `manual-only` justification.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 13-XX-XX | 0X | W | NOTIF-0X | T-13-XX / — | {expected secure behavior or "N/A"} | unit / integration | `{command}` | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/notifications/logger.test.ts` — logger opt-out, self-actor, dedup, try/catch branches (NOTIF-02, NOTIF-03, NOTIF-09)
- [ ] `tests/unit/notifications/NotificationRow.test.tsx` — snapshot for all 4 type renderers with locked stub copy (NOTIF-07, D-20/D-21)
- [ ] `tests/integration/phase13-notifications-follow.test.ts` — follow Server Action inserts follow notification; respects `notify_on_follow` (NOTIF-02, NOTIF-09)
- [ ] `tests/integration/phase13-notifications-overlap.test.ts` — addWatch inserts watch_overlap per matching owner (excluding self); respects `notify_on_watch_overlap`; dedup UNIQUE constraint 30-day window (NOTIF-03, NOTIF-09)
- [ ] `tests/integration/phase13-notifications-inbox.test.ts` — mark-all-read Server Action sets `read_at = now()` only on the caller's unread rows (NOTIF-06); bell DAL returns `hasUnread` based on `notifications_last_seen_at` (NOTIF-04)
- [ ] `tests/integration/phase13-notifications-rls.test.ts` — anon cannot SELECT; another user cannot SELECT a recipient's rows (reaffirms Phase 11 RLS under new DAL)
- [ ] `tests/integration/phase13-profile-settings-migration.test.ts` — post-migration assertions: `notifications_last_seen_at timestamptz NOT NULL DEFAULT now()`, `notify_on_follow boolean NOT NULL DEFAULT true`, `notify_on_watch_overlap boolean NOT NULL DEFAULT true`; existing rows backfilled to `now()`
- [ ] Confirm or install `vitest.config.ts` + React Testing Library setup (if missing)
- [ ] Confirm test DB fixtures for authenticated user sessions (reuse Phase 11/12 fixtures)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Bell dot disappears after visiting `/notifications` on next server render | NOTIF-04, NOTIF-06 | Server-rendered per request; requires browser round-trip | 1) Log in as User B. 2) Trigger follow from User A. 3) Load any page — dot visible. 4) Visit `/notifications`. 5) Load any page — dot gone. |
| Visual differentiation of unread vs read rows (left border + font weight) | NOTIF-05, D-14 | Visual verification | Inbox with mixed read/unread rows — eye-check left border + font weight per UI-SPEC.md |
| Settings Notifications section renders below Profile and Privacy | NOTIF-09, D-17 | Visual section ordering | Load `/settings`, confirm order: Profile → Privacy → Notifications |
| Empty-state copy "You're all caught up" renders with icon | NOTIF-10, D-05 | Visual copy + icon assertion | Log in as fresh user, visit `/notifications`, confirm copy + muted icon |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
