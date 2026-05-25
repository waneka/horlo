# Phase 58: Notification UI + Settings Opt-Out - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-24
**Phase:** 58-notification-ui-settings-opt-out
**Areas discussed:** Notification copy/voice, Like grouping behavior, Settings section framing, Comment deep-link target, Home activity feed (raised by user)

---

## Notification copy / voice

### Like + comment row wording

| Option | Description | Selected |
|--------|-------------|----------|
| Name watch + label wear | Names the watch everywhere; labels wear-events as a "wear" so watch-likes and wear-likes don't read identically. Most informative. | ✓ |
| Target-noun voice | Names watch for watch-events; bare "wear" for wear-events. | |
| Generic | "watch" / "wear" only, no watch name. | |

**User's choice:** Name watch + label wear.
**Notes:** Yields "liked your Submariner" / "liked your Submariner wear" / "commented on your Submariner [wear]".

### Comment body preview

| Option | Description | Selected |
|--------|-------------|----------|
| Show preview (2nd line) | Muted, clamped comment body on a second line below the headline. | ✓ |
| Headline only | Actor + watch line only, no body text. | |

**User's choice:** Show preview (2nd line).
**Notes:** Uses `payload.comment_preview` (already stored, first ~120 chars).

---

## Like grouping behavior

### Grouping window

| Option | Description | Selected |
|--------|-------------|----------|
| Per day (reuse pattern) | Group likes on the same target within the same calendar day — identical to existing watch_overlap collapse. | ✓ |
| Per target, all-time | One ever-growing row per target; murkier read-state; custom logic. | |

**User's choice:** Per day (reuse pattern).
**Notes:** Both watch-likes + wear-likes group; comments never group (distinct events).

### Grouped-row phrasing

| Option | Description | Selected |
|--------|-------------|----------|
| and N others | Matches the SC-2 spec wording, natural prose. | |
| + N others | Matches the existing watch_overlap row convention for inbox consistency. | ✓ |

**User's choice:** + N others.
**Notes:** Overrides the ROADMAP SC-2 "and 2 others" example in favor of inbox consistency with the live watch_overlap row.

---

## Settings section framing

| Option | Description | Selected |
|--------|-------------|----------|
| Add + rename to "Notifications" | Add Likes + Comments to existing section, rename "Email notifications" → "Notifications" (4 in-app toggles, accurate title). | ✓ |
| Add, keep title as-is | Add toggles but leave the inaccurate "Email notifications" heading. | |
| New separate section | Leave existing section untouched; new section for the two toggles. | |

**User's choice:** Add + rename to "Notifications".
**Notes:** Verified no email send is wired to `notify_on_*` — the toggles gate in-app rows via the logger, so the "Email" title was a misnomer.

---

## Comment deep-link target

| Option | Description | Selected |
|--------|-------------|----------|
| Land on detail page | Open /watch/[id] or /wear/[wearEventId]; comment thread visible, newest comment at top. No anchor logic. | ✓ |
| Scroll-anchor to comment | Use comment_id to scroll/highlight the exact comment; needs anchor + scroll-into-view wiring. | |

**User's choice:** Land on detail page.
**Notes:** Comment threads are newest-first (Phase 57), so the notified comment is already at the top.

---

## Home activity feed (raised by user)

| Option | Description | Selected |
|--------|-------------|----------|
| Keep likes bell-only | Status quo: comments in feed + bell; likes in bell only. Feed already complete. | ✓ |
| Revisit likes-in-feed | Reconsider a 'liked' feed entry — new FEED scope, own follow-up phase. | |

**User's choice:** Keep likes bell-only.
**Notes:** User asked to verify the home feed covers the new events. Confirmed in code: comments already surface (Phase 57 FEED-06 'commented' activity + FEED-07 gate); likes have no ActivityType by deliberate 2026-05-22 operator decision. Decision re-affirmed; no Phase 58 feed work.

---

## Claude's Discretion

- Exact Tailwind classes/spacing for the muted comment-preview second line.
- Whether to generalize `collapseWatchOverlaps` into a shared helper vs. parallel branches (behavior must hold).
- Test shape (unit vs integration) for grouping + opt-out wiring.

## Deferred Ideas

- **Likes in the home activity feed** — explicitly kept out (re-affirmed). Would be its own future FEED phase.
- **Scroll-anchoring comment deep-links** to a specific comment via `comment_id` — deferred; newest-first ordering makes page-landing sufficient.
