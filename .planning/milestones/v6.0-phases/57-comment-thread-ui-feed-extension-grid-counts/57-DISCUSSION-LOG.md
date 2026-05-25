# Phase 57: Comment Thread UI + Feed Extension + Grid Counts - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-23
**Phase:** 57-comment-thread-ui-feed-extension-grid-counts
**Areas discussed:** GATE-03 locked state, Edit / delete UX, Count surfacing, Feed comment-activity

---

## GATE-03 locked state

| Option | Description | Selected |
|--------|-------------|----------|
| Text + inline Follow button | "Follow [username] to comment" with a working FollowButton inline; handles the viewer's half of the mutual gate in one tap | ✓ |
| Text + link to profile | Username links to /u/[username] to follow there; no inline button | |
| Static text only | Plain label, no interactive control (dead-end) | |

**User's choice:** Text + inline Follow button.
**Notes:** "i feel like we have to explain the mutual follower relationship somehow. like if it says 'follow to comment' and then i follow but i still can't comment i need to know why" — drove the follow-up below.

| Option | Description | Selected |
|--------|-------------|----------|
| Two-state copy | Pre-follow "Follow [username] to comment"; followed-but-not-mutual "[username] needs to follow you back before you can comment"; mutual → compose appears. Needs ownerFollowsViewer signal | ✓ |
| Explicit upfront copy | State the mutual rule before any action in one message | |
| Short text + info affordance | Compact "Follow X to comment" + info icon/tooltip | |

**User's choice:** Two-state copy.
**Notes:** Directly resolves the "I followed but still can't comment — why?" dead-end. Planner: requires an `ownerFollowsViewer` signal passed into the gate component.

---

## Edit / delete UX

| Option | Description | Selected |
|--------|-------------|----------|
| All-inline (icons + in-place) | Always-visible pencil/trash on own comments; edit → in-place textarea (Save/Cancel); delete → inline "Delete? · Cancel" row; no dialogs (clean inside bottom sheet) | ✓ |
| "…" menu + inline edit + dialog delete | Overflow menu keeps rows clean; delete via AlertDialog | |
| Inline icons + dialog delete | Always-visible icons; edit in place; delete via AlertDialog | |

**User's choice:** All-inline.
**Notes:** Inline avoids stacking a modal over the wears-lane bottom-sheet-over-photo. Non-authors see no controls.

| Option | Description | Selected |
|--------|-------------|----------|
| Appended to meta line | "tyler · 2d · edited" (muted suffix on username/timestamp line) | ✓ |
| After the body text | Muted "(edited)" at end of comment body | |
| You decide | Planner picks least-disruptive placement | |

**User's choice:** Appended to meta line.

---

## Count surfacing

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror the like count | Comment icon + bare number next to ♥ N in the footer row, hidden at zero; badges the wears-lane comment-trigger | ✓ |
| Thread header count | "N Comments" heading above the list; no footer number | |
| Both | Footer count + thread header | |

**User's choice:** Mirror the like count (detail pages, CMNT-09).

| Option | Description | Selected |
|--------|-------------|----------|
| Icons, hidden at zero | "♥ 12 · 💬 3" in card text block; each metric hidden at zero; line gone when both zero | ✓ |
| Worded, always visible | "12 likes · 3 comments", shows zeros | |
| Icons, always visible | "♥ 12 · 💬 3", shows zeros | |

**User's choice:** Icons, hidden at zero (profile grid, DISP-01).
**Notes:** Claude flagged a leak guard — comment counts on gated wishlist cards must not surface to non-mutual viewers; the batched DISP-01 query must respect the gate per-watch (like counts are open, only the comment half is gated).

---

## Feed comment-activity

| Option | Description | Selected |
|--------|-------------|----------|
| Verb only (matches existing rows) | "tyler commented on [Brand Model]"; uniform flat row; no preview | ✓ |
| With comment preview | "tyler commented: 'great piece'"; needs body in metadata; breaks uniform row | |
| You decide | Planner picks, default verb-only | |

**User's choice:** Verb only.

| Option | Description | Selected |
|--------|-------------|----------|
| Per-viewer gate (correct) | Wishlist-watch comment surfaces only to feed viewers eligible (mutual with target owner, or owner); per-row gate vs. target owner | ✓ |
| Suppress wishlist-watch comments | Comments on wishlist watches never enter the feed | |
| You decide | Planner picks, default no-leak | |

**User's choice:** Per-viewer gate.
**Notes:** Claude flagged the structural difference — the existing feed gates by the actor's own privacy (actor == owner for existing types); comment activities break that (actor ≠ target owner), so visibility keys off the target owner's gate per feed viewer.

| Option | Description | Selected |
|--------|-------------|----------|
| One row per comment (never aggregate) | Exempt from ≥3-in-1hr collapse, like watch_worn | ✓ |
| Aggregate like watch_added | "commented on 3 watches"; thorny under per-viewer gate + mixed targets | |
| You decide | Planner picks, default no-aggregation | |

**User's choice:** One row per comment — never aggregate.

---

## Claude's Discretion

- Shared comment component shape (single `target`-prop component vs. wrappers).
- Wear-detail reconciliation: Phase 56 reserved footer comment-input slot vs. 56A inline host section — one compose box, one list, planner picks the seam.
- Char-counter reveal threshold + styling (UI-SPEC).
- Comment-icon / liked-state color tokens + grid-line typography/placement (UI-SPEC).
- `ownerFollowsViewer` data plumbing (extra read vs. piggyback).
- Feed-row scroll-to-comment deep link vs. link-to-detail only.

## Deferred Ideas

- Bell/inbox comment-notification rendering + deep-links — Phase 58 (NOTIF-15).
- Settings `notifyOnLike`/`notifyOnComment` toggles — Phase 58 (NOTIF-16).
- Comment preview in feed / reply threads / @mentions / liker-avatar strips — Future (SOC-F1…F5).
- Viewer-scoped comment-thread caching (Option B) — deferred (Phase 55 D-06).
