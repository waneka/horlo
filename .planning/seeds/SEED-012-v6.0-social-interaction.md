---
id: SEED-012
status: dormant
planted: 2026-05-19
planted_during: 2026-05-19 bug/feature triage — post-v5.1 notes review
trigger_when: starting milestone v6.0, after v5.2 closes.
scope: large
related_phases: [v3.0 notifications system (Phase 13), v3.0 WYWT wear flow (Phase 15), v2.0 follow graph + two-layer privacy (Phases 7-10)]
---

# SEED-012: v6.0 Social Interaction — comments & likes

## The Idea

Add a scoped social-interaction layer on top of the existing Rdio-style discovery — likes and comments on other users' collections, wishlists, and wears.

Verbatim notes:
> users should be able to comment on other user's collection/wishlist/wears
> maybe it's scoped to a mutual follow relationship? i get excited thinking about being able to comment on my friends wishlists and wears
> i don't want to build instagram for watches. (that already exists, and i hate instagram lol). but i think some level of social interaction sounds fun, on top of the existing rdio style social discovery benefits
> wear pics should have likes and comments
> collection/wishlist should def have comments, maybe likes?

## Decisions locked (2026-05-19 triage)

- **Likes:** open — any authenticated user can like collections, wishlists, and wears.
- **Comments on wears + collections:** any authenticated user.
- **Comments on wishlists:** mutual followers only (both users follow each other). Wishlists are more personal/aspirational, so that comment surface is kept tighter.
- **Guardrail:** scoped and tasteful — explicitly NOT "Instagram for watches."

## Why This Matters

- Adds genuine social warmth on top of discovery without becoming a feed-driven attention machine.
- The mutual-follow gate on wishlist comments keeps the most personal surface intimate.

## When to Surface

Trigger: `/gsd-new-milestone` for v6.0, after v5.2 ships.

## Open Questions (for the milestone's discuss / spec step)

- Comment target granularity — comment on the whole collection/wishlist as a surface, or on individual watches within it? ("comment on my friends wishlists" reads surface-level, but per-watch comments are also natural.)
- Data model — one polymorphic `comments` / `reactions` table targeting wear_event | watch | collection | wishlist, or per-target tables.
- Notifications — extend the existing `notification_type` enum + notifications system for comment/like events (dedup, opt-out).
- Edit/delete own comments; report/hide; moderation posture at single-user scale and beyond.
- Rendering surfaces — wear detail page, watch cards, profile collection/wishlist tabs.
- Confirm the asymmetry is intended: likes are open even on wishlists, but wishlist *comments* are mutual-follow gated.

## Breadcrumbs

- `notifications` table + `notification_type` enum + notifications DAL (v3.0 Phase 13) — extend for comment/like events.
- `follows` table — mutual-follow = bidirectional row check, for the wishlist-comment gate.
- `wear_events` + `/wear/[wearEventId]` route (v3.0 Phase 15) — wear-pic like/comment surface.
- Two-layer privacy pattern (RLS + DAL WHERE) — apply to comment/like reads.
- `/u/[username]` collection + wishlist tabs — comment/like rendering surfaces.
