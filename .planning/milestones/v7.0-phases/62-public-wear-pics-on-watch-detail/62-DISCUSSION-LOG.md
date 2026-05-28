# Phase 62: Public Wear Pics on Watch Detail - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 62-public-wear-pics-on-watch-detail
**Areas discussed:** Carousel placement, Wear-pic treatment, Per-pic hide control, Likes/comments surfacing

---

## Carousel placement

| Option | Description | Selected |
|--------|-------------|----------|
| Owner uploads, then wear pics | Owner uploads first (cover = lowest sort_order owner upload, untouched), then public wear pics appended | ✓ |
| Interleaved by date | Owner uploads + wear pics merged into one date-sorted stream | |
| Separate 'Worn' group | Owner uploads in main carousel, then a visually distinct wear-pic cluster | |
| Wear pics only when empty | Wear pics fill the carousel only when there are zero owner uploads | |

**Follow-up — within the wear-pic group, what order?**

| Option | Description | Selected |
|--------|-------------|----------|
| Newest worn first | Most recent wear leads; recency-forward, matches the rest of the app | ✓ |
| Oldest worn first | Chronological history arc; buries recent shots | |

**User's choice:** Owner uploads first, then public wear pics — newest-worn first. Wear pics also appear in the Phase 61 filmstrip as tap-to-jump thumbnails.
**Notes:** Keeps the Phase 60 cover contract untouched (cover stays the lowest-sort_order owner upload).

---

## Wear-pic treatment

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle 'Worn [date]' badge | Small 'Worn · [date]' badge on wear-pic slides; studio uploads unmarked | ✓ |
| Seamless, no marking | Wear pics identical to uploads; cleanest gallery but no real-world signal | |
| Badge + wear note | Badge plus the wear's note/caption on the slide; starts pulling Phase 64 IA decisions | |

**User's choice:** Subtle "Worn · [date]" badge.
**Notes:** No per-user attribution needed (all wear pics on a watch page are the owner's own). Flagged the #418 date-TZ hydration gotcha — badge must format worn_date with timeZone:'UTC' + 'en-US'.

---

## Per-pic hide control

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse Phase 61 Edit mode | Owner flips the existing 'Edit photos' toggle; wear-pic thumbnails get an eye/hide action (vs ×-delete for uploads) | ✓ |
| Control on the carousel slide | A 'hide from page' control overlaid on the active wear-pic slide outside Edit mode | |
| Both | Hide from Edit-mode filmstrip AND a slide overlay | |

**Follow-up — what does hide mean + how is it reversible?**

| Option | Description | Selected |
|--------|-------------|----------|
| Reversible in same Edit mode | Hide = removed from detail carousel only; stays in Wears tab + rail; hidden pic shows greyed/marked 'Hidden' in filmstrip, eye toggles back | ✓ |
| Hide here, un-hide in Wears tab | Hidden pics vanish from detail filmstrip; un-hide via Wears tab visibility control | |
| Hide = set non-public | Hide flips the wear event off 'public'; conflates hide-from-page with make-private | |

**User's choice:** Reuse Phase 61 Edit mode; hide reversible in the same place.
**Notes:** Hide is a dedicated state, separate from wear visibility (WPIC-02 vs WPIC-05 are distinct). Data shape (column vs join table) is the planner's call within stated constraints.

---

## Likes/comments surfacing

| Option | Description | Selected |
|--------|-------------|----------|
| Inline on the active slide | Wear-pic slide shows its wear-target like toggle + count and a comment count; watch-level like/comments stay separate | ✓ |
| Counts on slide, tap to open | Slide shows counts only; tap opens a new wear-detail surface (none exists today) | |
| Merge into the page thread | Fold wear-pic comments into the single watch-level CommentThread | |

**Follow-up — how does the wear pic's comment thread open?**

| Option | Description | Selected |
|--------|-------------|----------|
| Bottom sheet / overlay | Tapping the count opens that pic's thread (CommentThread, wear target) in a sheet; view + post | ✓ |
| Inline expand under slide | Thread expands beneath the slide; awkward per-slide RSC under Cache Components; overlaps Phase 64 | |
| Like only now, comments Phase 64 | Defers part of WPIC-06 | |

**User's choice:** Inline like + counts on the slide; comment count opens the wear pic's thread in a bottom sheet.
**Notes:** Sheet chosen to keep the carousel clean, avoid per-slide uncached-RSC re-render on swipe, and preserve the Phase 51/52 Cache Components contract (CommentThread stays an uncached sibling; do not disturb unstable_instant locks).

---

## Claude's Discretion

- Exact hide/eye icon + "Hidden" greyed-thumbnail treatment; "Worn · [date]" badge styling/position; like control placement on vs beneath the slide.
- The sheet/overlay primitive for the wear-pic comment thread.
- Optimistic-update + toast copy (mirror existing like/reorder patterns).
- Hide-flag data shape (column on wear_events vs separate join table) — must be a dedicated state separate from visibility, keyed per wear_event.

## Deferred Ideas

- Full detail-page IA / comment-placement redesign → Phase 64 (PAGE-01..04).
- Wear note/caption on wear-pic slides → considered, deferred to Phase 64 IA.
- Per-viewer/multi-actor attribution on wear pics → future.
- Inline grid like/comment composer → Phase 63 (GRID-01..05).
