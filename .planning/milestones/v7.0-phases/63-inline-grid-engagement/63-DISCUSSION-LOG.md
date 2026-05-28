# Phase 63: Inline Grid Engagement - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 63-inline-grid-engagement
**Areas discussed:** Affordance placement, Composer presentation, Post-submit feedback, Gated & owner cards

---

## Affordance placement — where the chips sit

| Option | Description | Selected |
|--------|-------------|----------|
| Footer action row | Dedicated interactive row at the bottom of the card, replacing the static count line | |
| Image overlay icons | ♥ + 💬 floated over the photo (bottom corner) | ✓ |
| Make count line tappable | Keep the existing bottom count line, make its segments interactive | |

**User's choice:** Image overlay icons (bottom-left of image, clear of existing top badges).
**Notes:** Whole card is a `<Link>` today → chip handlers must `preventDefault` so chip-tap ≠ navigate. Captured as D-01/D-02.

## Affordance placement — legibility treatment

| Option | Description | Selected |
|--------|-------------|----------|
| Pill chips w/ scrim | Rounded pill, semi-opaque dark bg, white icon+count — contrast independent of photo | ✓ |
| Bare icons + drop shadow | Plain white icons + text-shadow, lighter weight, contrast risk on light/busy photos | |
| Bottom gradient scrim | Single dark gradient strip across image bottom + bare icons | |

**User's choice:** Pill chips with scrim.
**Notes:** Matches the existing badge language; guards against the CSS-chain contrast gap (MEMORY `feedback_ui_spec_css_chain_blind_spot`). Captured as D-01.

## Composer presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Bottom sheet | Sheet slides up with textarea + Post, reusing the Phase 62 wear-pic-comment primitive; no grid reflow | ✓ |
| Inline expand in place | Card grows to reveal the composer; reflows the grid; cramped on mobile | |
| Popover / dialog | Floating popover anchored to the card, or a centered modal | |

**User's choice:** Bottom sheet (reuse Phase 62 sheet pattern, compose-only).
**Notes:** Avoids grid reflow + keeps Cache Components structure undisturbed. Captured as D-06.

## Post-submit feedback (compose-only seam)

| Option | Description | Selected |
|--------|-------------|----------|
| Close + toast + count bump | Sheet closes, 'Comment posted' toast, optimistic 💬 bump | ✓ |
| Close + count + 'View thread' | Same + a deep-link to the detail thread in the confirmation | |
| Keep sheet open, clear field | Sheet stays open for a second comment | |

**User's choice:** Close + toast + count bump.
**Notes:** Matches compose-only intent; reading the thread / adding more is done by tapping through to detail. Rollback + retain text on failure. Captured as D-07/D-08.

## Gated card behavior (GRID-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Hide 💬 chip entirely | No comment chip on gated foreign-wishlist cards (♥ stays); count already 0 for gated | ✓ |
| Show locked 💬 chip | Dimmed/locked chip with a 'follow each other' hint (CommentGateLocked language) | |

**User's choice:** Hide 💬 chip entirely.
**Notes:** ♥ stays (likes open to all, GATE-02); comment count already 0 for gated viewers; server action re-checks the gate (defense-in-depth). Captured as D-09/D-10.

## Owner viewing own grid

| Option | Description | Selected |
|--------|-------------|----------|
| Hide chips for owner | Chips only for non-owner viewers; owner keeps the static count line | ✓ |
| Show chips for owner too | Consistent with detail (GATE-04/D-09); requires resolving the wishlist drag-vs-tap conflict | |

**User's choice:** Hide chips for owner.
**Notes:** Sidesteps the `SortableProfileWatchCard` dnd-kit tap-vs-drag conflict; engagement is treated as a visitor action. Captured as D-03.

---

## Claude's Discretion

- Exact chip styling (pill radius, scrim opacity, icon size); bottom-left vs bottom-right if a collision emerges; whether the owner's display count stays as today's bottom line or moves to a non-interactive overlay.
- The specific sheet/dialog primitive for the composer.
- Whether to refactor the whole-card `<Link>` vs `preventDefault` on chips — as long as chip-tap ≠ navigate.
- Toast copy and optimistic-rollback specifics — mirror existing `sonner` patterns.
- Data layer: extend `getBatchedWatchCounts` to return per-viewer `liked` + `canComment` (one added query, no N+1); confirm `viewer:{viewerId}:counts` cache-tag busting on like/comment.

## Deferred Ideas

- Full comment thread inline in the grid card — out by design (GRID-04).
- Locked/teaser comment affordance on gated cards — considered, rejected.
- Owner self-engagement chips on own grid — considered, rejected.
- Threaded replies, moderation, public liker lists, Realtime — out per v6.0 scope.
- Detail-page IA redesign / comment placement — Phase 64 (PAGE-01..04).
