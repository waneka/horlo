# Phase 56: Like UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-22
**Phase:** 56-like-ui
**Areas discussed:** Control form & count, Placement (watch + wear), Owner self, Anon on wear, Wear-page redesign (user-raised)

---

## Control form

| Option | Description | Selected |
|--------|-------------|----------|
| Heart, fill toggles | Icon-only lucide Heart; outline when not liked, filled when liked | ✓ |
| Heart + text label | Heart icon plus "Like" / "Liked" text | |
| Heart, color only | Outline always; only color shifts on liked | |

**User's choice:** Heart, fill toggles
**Notes:** Exact liked-color deferred to UI-SPEC.

---

## Count format

| Option | Description | Selected |
|--------|-------------|----------|
| Inline number | Bare count right of the heart, e.g. "♥ 12" | ✓ |
| Number + word | "1 like" / "12 likes" with pluralization | |
| Count as secondary text | Small muted caption count | |

**User's choice:** Inline number
**Notes:** Hidden at zero already locked by LIKE-04.

---

## Watch place

| Option | Description | Selected |
|--------|-------------|----------|
| In the watch header | Inside WatchDetail, under brand/model title, visible to all viewers | ✓ |
| Standalone page row | Server-page sibling below WatchDetail (like the rails) | |

**User's choice:** In the watch header
**Notes:** Separate from the owner-only Edit/Delete row; WatchDetail gains viewerId + initial-state props.

---

## Wear place

| Option | Description | Selected |
|--------|-------------|----------|
| Post footer (under note) | Last element of metadata block, below the note | ✓ |
| Top, by the timestamp | In the collector row, trailing the timestamp | |
| Under the photo | Immediately beneath the hero image | |

**User's choice:** Post footer (under note) — later refined by the wear-page redesign into a dedicated footer action row `[reserved comment input] ♥ N`.

---

## Owner self

| Option | Description | Selected |
|--------|-------------|----------|
| Read-only count for owner | Count shown, heart non-interactive | |
| Interactive for owner too | Owner can like own items; single render path | ✓ |
| Hide entirely for owner | Mirror FollowButton self-hide | |

**User's choice:** Interactive for owner too
**Notes:** Matches GATE-02; self-notification already suppressed in toggleLikeAction. No self-hide branch.

---

## Anon wear

| Option | Description | Selected |
|--------|-------------|----------|
| Bounce to login | Show heart + count; click → /login?next= | ✓ |
| Read-only count | Show count, no toggle, no redirect | |
| Hide entirely | No control for anon | |

**User's choice:** Bounce to login
**Notes:** Mirrors FollowButton anon handling exactly. LikeButton takes viewerId: string | null.

---

## Wear-page redesign (user-raised during done-check)

Free-text proposal: *"Slight redesign to the wear page to support this feature — name + avatar overlay top-left of the image, brand/model overlay bottom-left (remove the watch thumbnail). Below the photo, a comment text input taking most of the width with the like icon to the right; since the comment field is a future phase, just leave space for it."*

Clarifying questions resolved:

| Question | Options | Selected |
|----------|---------|----------|
| Wear note/caption placement | Caption below photo / Overlay on photo / Drop from page | Caption below photo ✓ |
| Relative timestamp placement | With the name overlay / In the action row / You decide | With the name overlay ✓ |

**Notes / scope call:** Accepted as an in-scope *presentation* change (no new capability) — the like control's home. Flagged to the user that this restructures `WearDetailHero`/`WearDetailMetadata` beyond a button drop-in, requires an overlay legibility scrim that must also work on the no-photo fallback hero, and is the primary input for `/gsd-ui-phase 56`. The comment input is reserved layout space only; Phase 57 fills it.

## Claude's Discretion

- `cacheTag()` wiring mechanism for the initial-state read.
- Single shared `LikeButton` (target-prop) vs two thin wrappers.
- Overlay markup split (extend WearDetailHero/WearPhotoClient vs new wrapper).
- Final liked-state color token (→ UI-SPEC).

## Deferred Ideas

- Comment compose box + thread (Phase 57) — only the wear-footer slot is reserved here.
- ⚠ Cross-phase conflict for Phase 57: STATE.md (newest-first, compose above) vs REQUIREMENTS CMNT-03 (oldest-first, compose below) — must reconcile, and fit the reserved footer slot.
- Profile-grid like/comment counts (DISP-01, Phase 57).
- Liker-avatar strip / who-liked, reply fan-out, @mentions (Future / SOC-F1…F5).
