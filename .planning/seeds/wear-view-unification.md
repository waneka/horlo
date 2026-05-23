---
title: Wear View Unification — two-route model (/wears/[username] stories + /wear/[id] detail)
trigger_condition: Feeds Phase 56a discuss/spec; MUST land before Phase 57 (comment thread UI needs the shared comment component + both hosts)
planted_date: 2026-05-23
status: active
related_phase: 56a
source: /gsd-explore session 2026-05-23
---

# Wear View Unification

## Problem (the orphan-permalink finding)
Two disconnected wear-viewing experiences shipped at different times:
- **WYWT** (Phases 10/15): home rail (`WywtRail`) → client-side embla overlay (`WywtOverlay`/`WywtSlide`). URL stays `/` (no route). Swipe carousel, viewed/unviewed rings, ~48h window, only an "Add to wishlist" CTA. **No likes/comments.**
- **`/wear/[id]`** (Phase 56): the permalink detail with likes (comments coming Phase 57) — but reached **only** via the post-creation `router.push` in `ComposeStep.tsx`. Browsers never navigate to it while browsing, so the Phase 56 likes live on an effectively orphan page.

Net: the engagement we're building (likes now, comments next) sits where nobody reaches it while browsing, and the two surfaces diverge visually.

## Decision direction (locked in /gsd-explore 2026-05-23)
Two distinct, purpose-built routes — NOT a collapse to one:
- **`/wears/[username]` — STORIES lane.** Full-screen, **no nav chrome**, viewport-fit (no page scroll). Swipe through a user's active wears (~48h), then user→user. **Reels model: engagement is INLINE — never route away to act.** Comments open in a **bottom sheet** over the photo (swipe paused while open).
- **`/wear/[id]` — DETAIL permalink.** Conventional: **keeps nav bars, vertically scrollable**, no swipe. Single wear. Comments render as an **inline list** down the page. Reached by direct URL / share / notification deep-link. Back/close affordance comes free from retained nav.

## Shared core (the consistency guarantee)
One shared wear-content card (photo + avatar/username/brand-model overlays), one `LikeButton` (already shared, Phase 56), one comment component. **Both routes render these.** Divergence is limited to **container chrome** (immersive full-screen + bottom-sheet vs. nav-retaining scrollable page + inline list) — never the content/engagement components. The comment row + composer are identical across hosts; only the wrapper differs (bottom sheet vs. inline section).

## EN-1..6 reconciliation (from .planning/phases/56-like-ui/56-HUMAN-UAT.md)
The UAT polish notes split cleanly across the two surfaces — do NOT fix them piecemeal on today's page:
- **EN-1** (mobile full-screen, no nav) → `/wears/[username]` only.
- **EN-5** (viewport-fit, no scroll) → `/wears/[username]` only; `/wear/[id]` is intentionally scrollable.
- **EN-2** (brighter white + text-shadow legibility), **EN-3** (avatar→collector link), **EN-4** (brand/model→watch link) → properties of the **shared wear-content card**, inherited by both routes. Fold into the unified card, not the current page.
- **EN-6** (dead anon code: `__anon__` sentinel / null bounce) → independent cleanup; both wear routes are auth-only (proxy-gated). Anytime.

## Open forks (tracked in .planning/research/questions.md)
1. Transition between routes — does a story slide link to its `/wear/[id]` permalink? does the detail page offer a way into the swipe?
2. Fate of WYWT's "Add to wishlist" CTA — keep inline in both, drop, or relocate?
3. The ~48h active-window rule for `/wears/[username]` — same as today's WYWT window? configurable?
4. Plain nav vs. Next.js intercepting routes for the stories→permalink hop.

## Sequencing
**Phase 56a (this) lands BEFORE Phase 57.** Phase 57's comment UI must render in BOTH hosts (bottom sheet + inline) via the shared comment component, so the unification's component contracts gate it. See note `wear-view-unification-decisions` for the decision log.
