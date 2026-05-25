---
phase: 58
slug: notification-ui-settings-opt-out
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-24
---

# Phase 58 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `58-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + Testing Library |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test -- tests/components/notifications/ tests/components/settings/NotificationsSection.test.tsx tests/unit/notifications/` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~30 seconds (quick) / full suite varies |

---

## Sampling Rate

- **After every task commit:** Run quick command (notifications + settings + logger unit specs)
- **After every plan wave:** Run `npm run test` (full suite)
- **Before `/gsd-verify-work`:** Full suite green AND `npm run build` green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

> Task IDs assigned by the planner. Rows below are the requirement-level behaviors each task must satisfy; the executor maps each to a concrete `<automated>` verify command. All target test files already exist — extend, do not create.

| Behavior | Requirement | Test Type | Automated Command | File Exists | Status |
|----------|-------------|-----------|-------------------|-------------|--------|
| `watch_like` renders "liked your {model}" copy | NOTIF-16 | unit (component) | `npm run test -- tests/components/notifications/NotificationRow.test.tsx` | ✅ extend | ⬜ pending |
| `wear_like` renders "liked your {model} wear" copy | NOTIF-16 | unit (component) | same | ✅ extend | ⬜ pending |
| `watch_comment` renders "commented on your {model}" copy | NOTIF-16 | unit (component) | same | ✅ extend | ⬜ pending |
| `wear_comment` renders "commented on your {model} wear" copy | NOTIF-16 | unit (component) | same | ✅ extend | ⬜ pending |
| Comment rows render muted clamped preview second line | NOTIF-16 | unit (component) | same | ✅ extend | ⬜ pending |
| Like rows have NO second line | NOTIF-16 | unit (component) | same | ✅ extend | ⬜ pending |
| `watch_like` / `watch_comment` deep-link → `/watch/{watch_id}` | NOTIF-16 | unit (component) | same | ✅ extend | ⬜ pending |
| `wear_like` / `wear_comment` deep-link → `/wear/{wear_event_id}` | NOTIF-16 | unit (component) | same | ✅ extend | ⬜ pending |
| B-8 guard: unknown future type still returns `null` | NOTIF-16 | unit (component) | same | ✅ preserve | ⬜ pending |
| Grouped like copy: "{actor} + N others liked your {model}" | NOTIF-16 | unit (component) | same | ✅ extend | ⬜ pending |
| `watch_like` rows same `watch_id` + UTC-day collapse into one row | NOTIF-16 | unit (component) | `npm run test -- tests/components/notifications/NotificationsInbox.test.tsx` | ✅ extend | ⬜ pending |
| `wear_like` rows same `wear_event_id` + UTC-day collapse | NOTIF-16 | unit (component) | same | ✅ extend | ⬜ pending |
| Collapsed like row carries `actorCount` = group size | NOTIF-16 | unit (component) | same | ✅ extend | ⬜ pending |
| Most-recent actor wins for avatar/name after collapse | NOTIF-16 | unit (component) | same | ✅ extend | ⬜ pending |
| `watch_comment` / `wear_comment` rows are NOT grouped | NOTIF-16 | unit (component) | same | ✅ extend | ⬜ pending |
| `NotificationsSection` renders 4 toggles (not 2) | NOTIF-15 | unit (component) | `npm run test -- tests/components/settings/NotificationsSection.test.tsx` | ✅ update | ⬜ pending |
| Section title is "Notifications" (not "Email notifications") | NOTIF-15 | unit (component) | same | ✅ update | ⬜ pending |
| Likes toggle calls SA with `{ field: 'notifyOnLike', value: false }` | NOTIF-15 | unit (component) | same | ✅ update | ⬜ pending |
| Comments toggle calls SA with `{ field: 'notifyOnComment', value: false }` | NOTIF-15 | unit (component) | same | ✅ update | ⬜ pending |
| Logger skips like insert when `notifyOnLike=false` | NOTIF-15 | unit (logger) | `npm run test -- tests/unit/notifications/logger.test.ts` | ✅ exists (P55) | ⬜ pending |
| Logger skips comment insert when `notifyOnComment=false` | NOTIF-15 | unit (logger) | same | ✅ exists (P55) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* No new test files or framework installs needed — `NotificationRow.test.tsx`, `NotificationsInbox.test.tsx`, `NotificationsSection.test.tsx`, and `logger.test.ts` all exist and are extended in place.

- [ ] `tests/components/settings/NotificationsSection.test.tsx` fixture must add `notifyOnLike: true` + `notifyOnComment: true` (otherwise TS errors after the `ProfileSettings` type widening — see RESEARCH drift item 1).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end opt-out suppression (toggle off → like a watch → confirm NO new notification row) | NOTIF-15 | Crosses UI → Server Action → DB column → logger read → DAL; component test covers the SA call, logger unit test covers the skip, but the full live round-trip is prod-verified per project convention | Toggle off "Likes" in Settings → have another user like one of your watches → open `/notifications` → confirm no new like row appears |
| Visual rendering of new rows + grouped copy + muted preview line on mobile | NOTIF-16 | Visual/device behavior verified on prod (Vercel) per project convention, not local | After deploy: trigger each of the 4 types + a grouped like, open the bell/inbox on mobile, confirm copy, deep-links, and clamping |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (none — fixture update only)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
