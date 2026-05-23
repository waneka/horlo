---
title: Wear View Unification — decision log + EN→surface mapping
date: 2026-05-23
context: /gsd-explore session after Phase 56 UAT; informs Phase 56a discuss/spec
related: [seed wear-view-unification, phase 56a, .planning/phases/56-like-ui/56-HUMAN-UAT.md]
---

# Wear View Unification — decision log

Decisions locked during the 2026-05-23 explore session (see seed `wear-view-unification` for the full build direction).

## Root-cause finding
`/wear/[id]` (Phase 56) is reached **only** by the post-creation `router.push('/wear/${wearEventId}')` in `src/components/wywt/ComposeStep.tsx`. The home WYWT overlay (the actual browse path) never links to it and carries no likes/comments. So Phase 56's likes are stranded on a page browsers don't visit. This — not "two views" per se — is the real defect. The fix is to **connect the browse path to engagement**, via two purpose-built routes.

## Decisions
- **D-A: Two routes, not a collapse.** `/wears/[username]` (stories/swipe) + `/wear/[id]` (detail/permalink). Distinct jobs, neither redundant.
- **D-B: Reels engagement model.** Action stays in the swipe view — no routing away to like/comment.
- **D-C: Comments = bottom sheet** over the full-bleed photo in the stories view; **inline list** down the page in the detail view.
- **D-D: Intentional layout divergence is OK.** Stories = full-screen, no nav, viewport-fit. Detail = nav-retained, vertically scrollable. Consistency is enforced by **shared content/engagement components**, not identical chrome.
- **D-E: Shared components are the contract.** One wear-content card, one `LikeButton` (exists), one comment component (Phase 57). Container differs; content/engagement does not.

## EN → surface mapping (from 56-HUMAN-UAT.md — do not fix piecemeal)
| Note | Belongs to | Disposition |
|------|-----------|-------------|
| EN-1 mobile full-screen, no nav | `/wears/[username]` | property of stories route |
| EN-5 viewport-fit, no scroll | `/wears/[username]` | property of stories route; detail page is intentionally scrollable |
| EN-2 brighter white + text-shadow | shared wear card | fold into unified card (both routes inherit) |
| EN-3 avatar → collector link | shared wear card | fold into unified card |
| EN-4 brand/model → watch link | shared wear card | fold into unified card |
| EN-6 dead anon code cleanup | both wear routes (auth-only) | independent; anytime |

## Why this gates Phase 57
Phase 57 builds the comment thread UI. It must render in **both** hosts (bottom sheet + inline) through the shared comment component. Building it before unification would either bury comments on the orphan permalink or strand them in the ephemeral overlay. → Phase 56a precedes Phase 57.
