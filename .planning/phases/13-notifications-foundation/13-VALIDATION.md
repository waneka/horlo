---
phase: 13
slug: notifications-foundation
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-22
updated: 2026-04-22
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

> One row per task across the 4 plans. Populated during plan authoring per the Nyquist contract. `File Exists` column reflects post-Wave-0 state: ✅ = test/code artifact lands when Wave 0 (Plan 01) ships; ❌ W0 = artifact depends on a later wave completing. Status column is ⬜ until execution flips it to ✅ / ❌ / ⚠️.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 13-01-T1 | 01 | 0 | NOTIF-04, NOTIF-09 | T-13-01-01, T-13-01-02 | Two-file migration discipline; backfill coverage so no NULL `notifications_last_seen_at` on existing rows (defense against Pitfall 2 permanent-unread bug). | schema + types | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 13-01-T2 | 01 | 0 | NOTIF-04, NOTIF-09 | T-13-01-02, T-13-01-03 | Local DB schema matches Drizzle schema.ts; backfill UPDATE ran; DO $$ ASSERT blocks verified post-migration. | migration (DB) | `docker exec -i $(docker ps --filter name=supabase_db -q) psql -U postgres -d postgres -tAc "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'profile_settings' AND column_name IN ('notifications_last_seen_at', 'notify_on_follow', 'notify_on_watch_overlap')" \| grep -q "^3$"` | ✅ | ⬜ pending |
| 13-01-T3 | 01 | 0 | NOTIF-02..10 | T-13-01 (aggregate) | RED tests exist for every behavior before any production code ships — Nyquist feedback loop established. | unit + integration (RED) | `npx vitest run tests/unit/notifications/ tests/components/notifications/ tests/actions/notifications.test.ts tests/data/getNotifications --reporter=dot 2>&1 \| grep -E "FAIL\|failed\|Cannot find module" \| wc -l \| awk '$1 > 0 { exit 0 } $1 == 0 { exit 1 }'` | ✅ | ⬜ pending |
| 13-02-T1 | 02 | 1 | NOTIF-02, NOTIF-03, NOTIF-09 | T-13-02-05, T-13-02-06 | D-18 opt-out read BEFORE insert; D-24 self-guard short-circuit; D-27 internal try/catch fire-and-forget; raw-SQL ON CONFLICT DO NOTHING hits partial UNIQUE dedup. | unit | `npx vitest run tests/unit/notifications/logger.test.ts --reporter=dot` | ❌ W0 (test exists; code lands Plan 02) | ⬜ pending |
| 13-02-T2 | 02 | 1 | NOTIF-03, NOTIF-04, NOTIF-05, NOTIF-06 | T-13-02-01, T-13-02-02, T-13-02-03 | D-25 explicit viewerId on every DAL fn (no getCurrentUser inside scope); two-layer defense (RLS + WHERE user_id = viewerId); D-22 LOWER(TRIM()) normalization on both sides; D-23 self-exclusion; owned-only status filter (Open Q #1). | integration (DAL) | `npx vitest run tests/data/getNotificationsUnreadState.test.ts tests/data/getNotificationsForViewer.test.ts --reporter=dot` | ❌ W0 (test exists; code lands Plan 02) | ⬜ pending |
| 13-02-T3 | 02 | 1 | NOTIF-06, NOTIF-09 | T-13-02-02, T-13-02-04, T-13-02-07 | D-10 mark-all-read server-side WHERE filter (never trusts client id list); Next 16 two-arg `revalidateTag(tag, 'max')` per Pitfall 4; VISIBILITY_FIELDS Zod enum whitelists the two new notify_on_* fields (mass-assignment protection preserved). | unit (Server Action) | `npx vitest run tests/actions/notifications.test.ts --reporter=dot` | ❌ W0 (test exists; code lands Plan 02) | ⬜ pending |
| 13-03-T1 | 03 | 1 | NOTIF-05, NOTIF-07, NOTIF-10 | T-13-03-02, T-13-03-03, T-13-03-04 | D-20 locked copy verbatim for all 4 type renderers; B-8 unknown type → null (no broken card); D-14 unread `border-l-accent` + `font-semibold`; React auto-escapes payload fields (no dangerouslySetInnerHTML); D-09 click-through targets derived from trusted server payload. | unit (snapshot + render) | `npx vitest run tests/components/notifications/NotificationRow.test.tsx tests/components/notifications/NotificationsEmptyState.test.tsx --reporter=dot` | ❌ W0 (test exists; code lands Plan 03) | ⬜ pending |
| 13-03-T2 | 03 | 1 | NOTIF-05, NOTIF-08 | T-13-03-01 | D-15 display-time collapse keyed on (brand_normalized, model_normalized, UTC-day); Pitfall 7 — group key is viewer-safe because DAL pre-filters rows to a single viewer; D-02 Today/Yesterday/Earlier buckets; no new npm deps (inline date math). | unit (component grouping) | `npx vitest run tests/components/notifications/NotificationsInbox.test.tsx --reporter=dot` | ❌ W0 (test exists; code lands Plan 03) | ⬜ pending |
| 13-04-T1 | 04 | 2 | NOTIF-04, NOTIF-05, NOTIF-06, NOTIF-09, NOTIF-10 | T-13-04-01, T-13-04-03, T-13-04-04, T-13-04-06, T-13-04-08 | D-25 `viewerId` is explicit prop on NotificationBell (grep gate enforces no `getCurrentUser` inside cached scope); D-26 `cacheTag('notifications', 'viewer:${id}')` + `cacheLife({ revalidate: 30 })`; D-07 page `touchLastSeenAt` + Pitfall-6 double-invalidation via `revalidateTag(tag, 'max')`; two-layer inbox privacy (RLS + DAL WHERE); D-17 Notifications settings section with Zod-whitelisted fields. | unit + type | `npx vitest run tests/components/notifications/ tests/data/getNotificationsUnreadState.test.ts --reporter=dot && npx tsc --noEmit` | ❌ W0 (code lands Plan 04; tests exist Plan 01) | ⬜ pending |
| 13-04-T2 | 04 | 2 | NOTIF-02, NOTIF-03, NOTIF-06, NOTIF-09 | T-13-04-02, T-13-04-05, T-13-04-07, T-13-04-09 | D-28 fire-and-forget `void logNotification(...)` AFTER primary commit (failure cannot roll back follow/addWatch); D-23 self-exclusion already in `findOverlapRecipients`; D-18 opt-out enforced inside logger (not caller); owned-only status gate (Open Q #1); temporary Header bell clearly marked TEMP for Phase 14 cleanup. | integration (E2E) + suite | `npx vitest run --reporter=dot && npx tsc --noEmit && npm run lint` | ❌ W0 (code lands Plan 04; tests exist Plan 01) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Coverage summary

- **Tasks:** 10 (Plan 01: 3, Plan 02: 3, Plan 03: 2, Plan 04: 2)
- **Requirements covered:** NOTIF-02, NOTIF-03, NOTIF-04, NOTIF-05, NOTIF-06, NOTIF-07, NOTIF-08, NOTIF-09, NOTIF-10 (all 9 phase requirements mapped to at least one task)
- **Threats covered:** T-13-01-01..03, T-13-02-01..07, T-13-03-01..04, T-13-04-01..09 (all 23 threats mapped)
- **No 3-consecutive-tasks without automated verify:** every task row has an `<automated>` command.

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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 20s
- [x] `nyquist_compliant: true` set in frontmatter (Per-Task Verification Map is populated; Wave 0 artifacts will flip `wave_0_complete` to true once Plan 01 ships)

**Approval:** plan-checker approved (3 warnings addressed 2026-04-22); ready for Wave 0 execution.
