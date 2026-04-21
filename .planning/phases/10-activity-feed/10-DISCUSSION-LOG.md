# Phase 10: Activity Feed - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 10-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 10-activity-feed
**Areas discussed:** Scope, Home Layout, Network Activity feed, WYWT rail, From Collectors Like You, Personal Insights, Suggested Collectors, Top Nav, Canonical refs

---

## Scope

**Context:** User pointed to a Figma home-page design that includes WYWT, Collectors Like You, Network Activity, Personal Insights, and Suggested Collectors — significantly more than the FEED-01/02/03/04 requirements scoped to Phase 10 in REQUIREMENTS.md.

| Option | Description | Selected |
|--------|-------------|----------|
| Build all 5 sections in Phase 10 | Promote WYWT-03, DISC-02, DISC-04 into Phase 10 | ✓ |
| Feed only now, scaffold the rest | Build Network Activity; placeholder stubs for others | |
| Feed only, defer the rest visually | Phase 10 = only Network Activity at `/` | |
| Feed + one or two extras | Pick and choose | |

**User's choice:** Build all 5 sections in Phase 10.
**Notes:** CONTEXT.md flags the need to update REQUIREMENTS.md and ROADMAP.md downstream.

---

## Gray Area Selection

User selected all 8 offered gray areas across two batched questions:
- **Batch 1:** Home page composition, Event card design, Bulk-import aggregation, Empty/no-follows state
- **Batch 2:** Feed privacy strictness, Pagination UX + page size, Own-activity filter, New-activity indicator

**User note:** "I have a figma design to reference for this updated home page" — triggered a scope review before any other discussion.

---

## Home Layout

### Section order

| Option | Selected |
|--------|----------|
| Figma order (WYWT → Collectors Like You → Network Activity → Personal Insights → Suggested Collectors) | ✓ |
| Feed-first order | |
| Taste-first order | |

### Zero state

| Option | Selected |
|--------|----------|
| Onboarding home — full layout renders with per-section empty states | ✓ |
| Fall back to `/u/[me]/collection` | |
| Minimalist empty | |

### Where does own collection live?

| Option | Selected |
|--------|----------|
| `/u/[me]/collection` (already built Phase 8) | ✓ |
| Dedicated `/collection` route | |
| `/` has a 'My Collection' section | |

---

## Network Activity Feed

### Row layout

| Option | Selected |
|--------|----------|
| Figma-faithful single line (avatar right) | |
| Row + watch thumbnail | |
| Two-line with context | |

**User's choice (free text):** "the figma is off a bit, it should be avatar on the left before the text, and the far right image should be the watch thumbnail"
**Notes:** Overrides Figma mock; user-corrected layout captured as F-01.

### Verbs

| Option | Selected |
|--------|----------|
| Flat verbs (wore X, added X, wishlisted X) (Recommended) | ✓ |
| Verb + preposition | |
| Emoji-prefixed | |

### Click target

| Option | Selected |
|--------|----------|
| Row → collector profile (Recommended) | ✓ |
| Row → watch detail | |
| Username = profile, watch = watch detail | |

### Pagination

| Option | Selected |
|--------|----------|
| Load More button, 20/page (Recommended) | ✓ |
| Infinite scroll, 20/page | |
| Load More, 30/page | |
| Load More, 10/page | |

### Own events in feed

| Option | Selected |
|--------|----------|
| Filter own out (Recommended) | ✓ |
| Include own mixed in | |
| Include own with subtle differentiation | |

### Privacy strictness

| Option | Selected |
|--------|----------|
| Per-event gate (Recommended) | ✓ |
| Profile-level gate only | |
| Follows bypass privacy | |

### New events indicator

| Option | Selected |
|--------|----------|
| Silent insert (Recommended) | ✓ |
| 'N new' banner | |
| Subtle highlight on new rows | |

### Bulk aggregation (FEED-04)

First pass — user asked for explanation:

| Option | Selected |
|--------|----------|
| Time-window collapse | |
| Dedicated bulk-add UX this phase | |
| Schema aggregate + write grouping | |
| Defer | |

**User's choice (free text):** "explain this feature to me i don't understand"

After explanation (Letterboxd-style feed saturation framing, four handling strategies compared in a table):

| Option | Selected |
|--------|----------|
| Time-window collapse (Recommended) | ✓ |
| Defer to future phase | |
| Dedicated bulk-add UX this phase | |
| Schema aggregate + write grouping | |

---

## WYWT Rail

### Source

| Option | Selected |
|--------|----------|
| Today only, followed + self | |
| Last 24h rolling | |
| Last 7 days, most recent per user | |

**User's choice (free text):** "last 48h rolling. any duplicate from a single user should only show the most recent"
**Notes:** Captured as W-01 with dedupe-per-user.

### Self-tile action

| Option | Selected |
|--------|----------|
| Opens watch picker dialog (Recommended) | ✓ |
| Links to /u/[me]/worn + CTA | |
| Inline swipe-through picker | |

### Empty rail

| Option | Selected |
|--------|----------|
| Self-tile only (Recommended) | ✓ |
| Hide rail entirely when empty | |
| Show self-tile + ghost empty tiles | |

### Tile content

| Option | Selected |
|--------|----------|
| Watch photo + username + time (Figma) | |
| Watch photo + username + watch name | |
| Watch photo + time (initials avatar overlay) | |

**User's choice (free text):** "watch photo plus username. i want this section to feel similar to instagram's reels. there should also be a border or other signifier for viewed/not-viewed."
**Notes:** Captured as W-04 — IG Reels feel, viewed/not-viewed border.

### Tap action

| Option | Selected |
|--------|----------|
| Full-screen wear viewer (IG Reels-like) (Recommended) | |
| Inline expand card | |
| Navigate to watch detail | |

**User's choice (free text):** "full screen on mobile, modal on desktop. overlay should include username + time, watch name (link to watch detail), button to add to wishlist, caption/note if present. swipe/tap to advance, swipe back to see previous wear, swipe down to close."
**Notes:** Richer than any offered option — captured verbatim as W-05.

### Viewed tracking

| Option | Selected |
|--------|----------|
| localStorage per viewer (Recommended) | ✓ |
| DB table `wear_event_views` | |
| Time-based 'since last visit' | |

### Max tiles

| Option | Selected |
|--------|----------|
| No cap, horizontal scroll (Recommended) | ✓ |
| Cap at 10, 'show all' link | |
| Cap at 20 silently | |

---

## From Collectors Like You

### Similarity definition

| Option | Selected |
|--------|----------|
| Taste overlap via analyzeSimilarity (Recommended) | ✓ |
| Shared style/role tags count | |
| Collaborative filtering (watch co-occurrence) | |

### Candidate pool

| Option | Selected |
|--------|----------|
| Watches owned by similar collectors, not by viewer (Recommended) | ✓ |
| Any owned watch from any public user | |
| Watches in similar collectors' wishlists | |

### Rationale generation

| Option | Selected |
|--------|----------|
| Rule-based from tags (Recommended) | ✓ |
| LLM-generated caption | |
| Skip rationale | |

### Card count / overflow

| Option | Selected |
|--------|----------|
| 4 cards, horizontal scroll on mobile (Recommended) | ✓ |
| Fixed 4, no scroll | |
| 8 cards (2 rows) | |

### Card click target

| Option | Selected |
|--------|----------|
| Watch detail (Recommended) | ✓ |
| List of collectors who own it | |
| Wishlist prompt | |

### Freshness

| Option | Selected |
|--------|----------|
| Per-request, cached for home (Recommended) | ✓ |
| Daily rotation | |
| Every request, no cache | |

### Dedupe rule

| Option | Selected |
|--------|----------|
| Normalized `(brand, model)` (Recommended) | ✓ |
| Exact watch.id only | |

---

## Personal Insights

### Which cards (multi-select)

| Option | Selected |
|--------|----------|
| Sleeping Beauty alert | ✓ |
| Most worn this month | ✓ |
| Wishlist gap | ✓ |
| Common Ground with a follower | ✓ |

All four selected.

### Where logic lives

| Option | Selected |
|--------|----------|
| Reuse `/insights` lib + new wishlist-gap fn (Recommended) | ✓ |
| New `src/lib/homeInsights.ts` | |
| Inline in the home page component | |

### Click behavior

| Option | Selected |
|--------|----------|
| Clickable with contextual target (Recommended) | |
| Read-only cards | |
| Every card → `/insights` page | |

**User's choice (free text):** "clickable but sleeping beauty should also go to watch detail"
**Notes:** User overrode the "Log Wear" default for Sleeping Beauty → watch detail. Captured as I-03.

### Empty state

| Option | Selected |
|--------|----------|
| Hide section entirely (Recommended) | ✓ |
| Show one onboarding card | |
| Show all cards in empty state | |

---

## Suggested Collectors

### Pool

| Option | Selected |
|--------|----------|
| Public profiles the viewer doesn't follow (Recommended) | ✓ |
| Public + private, Letterboxd-style | |
| Only public with ≥1 shared watch | |

### Card content

| Option | Selected |
|--------|----------|
| Figma-faithful (Recommended) | ✓ |
| Add display name + bio | |
| Minimal | |

### Count / overflow

| Option | Selected |
|--------|----------|
| 3-5 rows, scroll for more (Recommended) | ✓ |
| Fixed 5, no more | |
| Unlimited with Load More | |

### Follow behavior

| Option | Selected |
|--------|----------|
| Optimistic remove + shift next in (Recommended) | |
| Stay in place, button flips to 'Following' | ✓ |
| Collapse after 3 follows | |

---

## Top Nav

### Phase 10 nav scope (multi-select)

| Option | Selected |
|--------|----------|
| Brand + 'Explore' link | |
| Global search bar | |
| Notifications bell | |
| Wear + Add buttons | ✓ |

Only "+Wear" + "+" Add selected.

### Search bar treatment

| Option | Selected |
|--------|----------|
| Hide from Phase 10 nav (Recommended) | ✓ |
| Render disabled + 'Coming soon' tooltip | |
| Render, route to a placeholder page | |

### Bulk-import UX timing

| Option | Selected |
|--------|----------|
| Future phase (Recommended) | ✓ |
| Note as a follow-up in STATE.md | |
| Fold into Phase 10 | |

---

## Canonical refs citation

| Option | Selected |
|--------|----------|
| Figma URL + node ID (Recommended) | ✓ |
| Description only | |
| Export static screenshots to .planning/design/ | |

Node id `1:2205` (Body) captured; file URL to be added by planner via Figma MCP.

### Final prompt

| Option | Selected |
|--------|----------|
| Nothing else — write CONTEXT.md | ✓ |
| More questions | |
| Revisit an area | |

---

## Claude's Discretion (areas where user said "you decide")

- Wishlist Gap click target (filtered wishlist view vs. scroll-to recs)
- Exact dimensions, spacing, typographic scale throughout
- Keyset cursor encoding
- Swipe gesture implementation library choice
- Wishlist-gap algorithm specifics
- Sign-in redirect UX on WYWT overlay actions
- Toast placement on follow errors
- localStorage viewed-state schema
- Brand/model snapshot mechanics for WYWT "add to wishlist"

## Deferred Ideas

- Bulk-import UX (CSV / multi-URL import) — future phase
- Cross-device viewed-state sync for WYWT (DB-backed)
- Schema aggregate column on activities (writer-side aggregation)
- Daily rec rotation cron
- Collaborative-filtering recommendations
- Explore page / global search / notifications bell
- Rec cache invalidation on follow/unfollow
- WYWT auto-advance timer
- "You and {name} shared N recent wears this week" composite insight
