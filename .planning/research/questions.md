# Research / Open Questions

Open questions captured during exploration, to be resolved at discuss/spec time.

## Wear View Unification (Phase 56a) — captured 2026-05-23 (/gsd-explore)

> See seed `wear-view-unification` + note `wear-view-unification-decisions`. The two-route model
> (`/wears/[username]` stories + `/wear/[id]` detail), Reels-style inline engagement, and bottom-sheet
> vs inline comments are DECIDED. These forks remain open:

1. **Route transition.** How does a user move between the two routes? Does a story slide in `/wears/[username]` link to its `/wear/[id]` permalink (e.g. via timestamp / "…" / share)? Does the detail page offer an entry into the swipe lane? Or are they reached independently (rail → stories; notification/share/direct → detail)?
2. **"Add to wishlist" CTA fate.** WYWT's slide currently has an "Add to wishlist" action (`addToWishlistFromWearEvent`). In the unified model, keep it as an inline action on both routes, drop it, or relocate it (e.g. into an actions menu alongside like/comment)?
3. **Active-window rule for `/wears/[username]`.** Keep WYWT's ~48h "active wears" window? Make it configurable? What shows when a user has no active wears (empty state vs. omit from the rail)?
4. **Routing mechanism for the stories→permalink hop.** Plain client navigation vs. Next.js intercepting + parallel routes (`@modal` + `(.)wear/[wearEventId]`) so the permalink can render as a modal-over-feed when navigated from within the app while staying a real shareable URL. Trade-off: intercepting routes give "modal with URL + back-to-close" for free but add routing complexity.
