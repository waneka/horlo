---
id: SEED-015
status: dormant
planted: 2026-05-24
planted_during: v6.0 Social Interaction / Phase 57 prod UAT
trigger_when: next social-polish milestone (v6.x) or v7.0
scope: medium
---

# SEED-015: Inline like + comment from profile grid cards

Let viewers like a watch AND write a comment directly from a profile collection/wishlist grid card (`/u/[username]/collection|wishlist`) without opening `/watch/[id]`.

## Why This Matters

Phase 57 shipped the `♥ N · 💬 M` count line on grid cards (DISP-01) but the counts are read-only — to act on a watch you must click into detail. Reducing that friction makes the grid a real engagement surface, not just a display. Likes especially are a one-tap action that currently costs a full navigation.

## When to Surface

**Trigger:** a v6.x social-polish milestone, or v7.0 (Watch Photos / SEED-013) where the grid card is already being reworked.

## Scope Estimate

**Medium** — split sharply by interaction:
- **Likes from grid (easy):** reuse `LikeButton` + the per-watch like state from the Phase 57 `getBatchedWatchCounts` batched read; wire optimistic toggle into the card. The batched-counts plumbing already exists.
- **Write a comment from grid (harder UX):** needs a lightweight inline composer or a quick popover that posts via `addCommentAction` and bumps the count optimistically — WITHOUT pulling the full thread into the grid. Reading the full thread can still require a click-through to detail. The GATE-03 wishlist comment gate must be respected per card (the batched read already zeroes gated comment counts).

## Breadcrumbs

- `src/components/profile/ProfileWatchCard.tsx` — the count line (Phase 57 / D-09)
- `src/data/reactions.ts` `getBatchedWatchCounts` / `getBatchedWatchCountsCached` — batched like+comment counts (DISP-01)
- `src/components/comment/CommentCompose.tsx` + `src/app/actions/comments.ts addCommentAction` — composer + post action to reuse
- `src/components/watch/LikeButton.tsx` (Phase 56) — like toggle to reuse
- Related: [[project_v6_0_social_interaction]]-adjacent; pairs with SEED-013 (v7.0 grid rework)

## Notes

Source: prod UAT 2026-05-24 (Phase 57 #7). User: "likes seems easy, comments is more difficult… ok to click in to VIEW comments, but writing a comment from this view would be great."
