# Phase 13: Notifications Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-22
**Phase:** 13-notifications-foundation
**Areas discussed:** Inbox layout & grouping, Click & read semantics, Row visual structure, Settings opt-outs & stub templates

---

## Inbox layout & grouping

### Q: Row density on /notifications

| Option | Description | Selected |
|--------|-------------|----------|
| Compact one-liner | Single-line ~48px row, avatar(sm) + actor + verb + object + relative time | ✓ |
| Two-line with object preview | Avatar(md) + actor + verb + watch model with mini watch image, ~72px | |
| Card style with full detail | Card per notification with full actor block + watch image + View button, ~120px | |

### Q: Time grouping

| Option | Description | Selected |
|--------|-------------|----------|
| Today / Yesterday / Earlier | Three sticky sub-headers | ✓ |
| Flat list newest-first | No grouping headers | |
| Per-day headers | Today, Yesterday, Apr 22, Apr 21 … | |

### Q: Pagination strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Show last 50, no paging | Server-rendered, no infinite scroll complexity | ✓ |
| Infinite scroll | useInfiniteQuery pattern from feed | |
| 'Load more' button | Manual pagination | |

### Q: Older-than-X retention

| Option | Description | Selected |
|--------|-------------|----------|
| Show all forever, no cleanup | Defer cleanup until volume is real | ✓ |
| UI shows last 90 days, older silently hidden | Read-side filter only | |
| Hard delete > 90 days via cron | Adds Vercel Cron / scheduled fn | |

---

## Click & read semantics

### Q: What marks rows as read on visit?

| Option | Description | Selected |
|--------|-------------|----------|
| Visit clears bell dot only; rows stay unread until explicit action | GitHub/Linear pattern | ✓ |
| Visit auto-marks ALL displayed rows as read | Single visit clears everything | |
| Pure manual; bell dot stays even after visiting | Strictest model | |

### Q: Per-row click behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Mark row read + navigate to target | Single click does both, optimistic | ✓ |
| Navigate only, read state via Mark-all-read | Decouples reading from navigation | |
| Mark read only, separate action button | Inbox-as-archive pattern | |

### Q: Click-through targets per type

| Option | Description | Selected |
|--------|-------------|----------|
| Follow → /u/[username]; Overlap → /u/[username]?focusWatch=[id] | Overlap opens new owner's profile, scrolled to matching watch | ✓ |
| Follow → /u/[username]; Overlap → /watch/[watchId] (recipient's own) | Overlap opens recipient's own watch detail | |
| Both → /u/[username] | Simplest; loses jump-to-watch | |

### Q: Bell unread state mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| COUNT(*) WHERE read_at IS NULL > 0 — no separate column | NOTIF-04 as written | ✓ (then conflicted) |
| read_at + profile_settings.notifications_last_seen_at | Bell dot = created_at > last_seen_at | |

### Q: Reconcile conflict (visit clears dot but rows stay unread)

| Option | Description | Selected |
|--------|-------------|----------|
| Add notifications_last_seen_at to profile_settings; bell uses created_at > last_seen_at | Two-state model: bell-seen vs row-read | ✓ |
| Visit auto-marks all rows read (overrides Q1) | No new column | |
| Bell dot persists until Mark all read (overrides Q1) | No new column, strictest | |

**Notes:** Initial Q1 + Q4 picks were inconsistent — Claude flagged the conflict; user chose to add `notifications_last_seen_at` to honor Q1's "rows stay visually unread" intent. NOTIF-04 must be amended in PLAN to use the new column instead of raw `read_at IS NULL`.

---

## Row visual structure

### Q: Row anatomy

| Option | Description | Selected |
|--------|-------------|----------|
| Avatar(sm) + actor link + verb + object link + relative time | Standard inbox row | ✓ |
| Verb + actor + object, no avatar | Text-only, lighter | |
| Icon (per type) + actor + verb + object + time | Type icon left of avatar | |

### Q: Time format

| Option | Description | Selected |
|--------|-------------|----------|
| Relative everywhere | 2h ago, 3d ago, then absolute date >7d | ✓ |
| Absolute only | Today 2:34 PM, Yesterday 11:00 AM, Mar 15 | |
| Hybrid: relative under 24h, then absolute | Tighter rule | |

### Q: Unread differentiation

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle left border in primary + slightly bolder actor name | Linear/Notion pattern | ✓ |
| Background tint (light primary) | GitHub pattern | |
| Blue dot indicator on right | iOS Mail pattern | |

### Q: Watch-overlap aggregated copy

| Option | Description | Selected |
|--------|-------------|----------|
| **Alex** + 2 others also own your **Royal Oak** | 1 named actor + count, single avatar | ✓ |
| **3 collectors** also own your Royal Oak | Count only, no named actor | |
| **Alex**, **Sam** and 1 other also own your Royal Oak | 2 named + count, stacked avatars | |

---

## Settings opt-outs & stub templates

### Q: Default state for opt-out toggles

| Option | Description | Selected |
|--------|-------------|----------|
| Both ON by default | Opt-out model; social signal is v3.0 hook | ✓ |
| Both OFF by default | Opt-in; quieter onboarding | |
| Follow ON, watch-overlap OFF | Mixed | |

### Q: Where in settings page

| Option | Description | Selected |
|--------|-------------|----------|
| New 'Notifications' section on /settings | Below Profile + Privacy | ✓ |
| Inside existing Privacy section | Conflates 'who sees what' with 'what is sent to me' | |
| Separate /settings/notifications page | Premature route split | |

### Q: NOTIF-07 stub template coverage

| Option | Description | Selected |
|--------|-------------|----------|
| Renderer with type-specific copy + icon, no fixture data ever inserted | Renderer complete-but-dormant, future phase wires data | ✓ |
| Render templates AND seed fixture rows in dev | Lets dev visually QA; risk of accidental seed in prod | |
| Templates throw on render until wired | Stub returns null + warn | |

### Q: Stub copy text

| Option | Description | Selected |
|--------|-------------|----------|
| Price Drop: 'Your **Royal Oak** wishlist watch dropped to **$12,500**' · Trending: '**3 collectors** in your taste cluster added a **Speedmaster** this week' | Concrete, payload-driven | ✓ |
| Generic placeholders | 'Price drop notification — details coming soon' | |
| Skip copy entirely, type name only | Most minimal | |

---

## Claude's Discretion

- Tailwind class tokens for left border (D-14) and avatar size (D-12)
- Empty-state icon choice (D-05)
- /notifications page heading text
- Settings "Notifications" subsection ordering and labels (D-17)
- Bell DAL return shape — `{ hasUnread }` only, vs `{ hasUnread, lastSeenAt }`
- File location for new `NotificationRow` component

## Deferred Ideas

- Per-actor mute / snooze / per-watch-model mute
- Notification grouping windows other than calendar_day
- Email digest (NOTIF-FUT-03; SMTP off)
- Real-time WebSocket push (NOTIF-FUT-04; Realtime off)
- Stacked avatars for watch-overlap rows
- Click-through to `/wear/[wearEventId]` (re-evaluate when a `wear` notification type is added in the WYWT photo phase)
- Per-row archive / dismiss
- Notification activity in admin/observability dashboards
