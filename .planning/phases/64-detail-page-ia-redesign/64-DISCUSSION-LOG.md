# Phase 64: Detail Page IA Redesign - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 64-detail-page-ia-redesign
**Areas discussed:** Section order & layout, Comment placement, Verdict prominence, Catalog branch parity

---

## Section order & layout

### Desktop skeleton
| Option | Description | Selected |
|--------|-------------|----------|
| Single-column, full-width | Everything stacks at one width; specs become a flow section | |
| Keep 2-column (photo + spec rail) | Today's `2fr/1fr` grid; spec rail competes with verdict | |
| Hybrid: photo-led hero, then 1-col | 2-col hero (carousel left / verdict+like+title right), single-col below | ✓ |

### Spec card treatment
| Option | Description | Selected |
|--------|-------------|----------|
| Full cards, full-width grid | All 4 cards as-is below comments | |
| Condensed strip in hero + full below | One-line `SpecsSublabel` in hero + full cards below comments | ✓ |
| Collapsible / accordion | Specs collapse into expandable sections | |

### Owner-action placement
| Option | Description | Selected |
|--------|-------------|----------|
| Stay in the hero | Owner actions near the photo/title | |
| Move to a footer action bar | Group Edit/Delete/Mark-worn at the bottom | |
| You decide | Planner places them; non-owner views unaffected | ✓ |

**User's choice:** Hybrid hero + condensed spec strip (full cards below comments) + owner-action placement at Claude's discretion.
**Notes:** User selected the hybrid via its ASCII preview (carousel left / verdict+like right; comments full-width directly under hero; specs + rails + footer below).

---

## Comment placement

### Jump-to-comments affordance
| Option | Description | Selected |
|--------|-------------|----------|
| Yes — tap count scrolls to comments | Hero comment-count becomes a smooth-scroll anchor | ✓ |
| No — comments are high enough | Keep count display-only | |

### Comments desktop width
| Option | Description | Selected |
|--------|-------------|----------|
| Full content width | Span full body width | |
| Narrower reading column | Centered ~640px conversational column | |
| You decide | Planner/UI picks | ✓ |

**User's choice:** Comments directly under the hero (from layout pick); hero comment-count = tap-to-scroll jump link; desktop width at Claude's discretion.
**Notes:** Confirmed the architectural implication — `CommentThread` stays an uncached RSC sibling, so the `WatchDetail` island is split to let its trailing specs/notes render after the thread.

---

## Verdict prominence

### Empty-collection hero fill
| Option | Description | Selected |
|--------|-------------|----------|
| Reference identity card up top | ReferenceIdentityCard (conf ≥ 0.5) else caption, in the hero slot | |
| Keep hero verdict-only; fresh content below | Fresh-account card + 3-CTA lower in flow | |
| You decide | Planner places fresh/empty content | ✓ |

### Gap-fill callout placement
| Option | Description | Selected |
|--------|-------------|----------|
| With the verdict in the hero | Pair gap-fill with verdict at top | |
| Separate card lower in the flow | Keep gap-fill below | |
| You decide | Planner places it | ✓ |

**User's choice:** Verdict elevated into the hero (locked by the layout pick); empty-state fill and gap-fill placement at Claude's discretion.
**Notes:** Core decision (verdict in hero) was already made in the layout area; both remaining edge cases delegated to the planner.

---

## Catalog branch parity

### Catalog branch scope
| Option | Description | Selected |
|--------|-------------|----------|
| Align the visual shell, accept the gaps | Same hero shell (single image), omit comments + carousel | ✓ |
| Scope to owned/per-user branches only | Leave generic catalog page as-is | |
| You decide | Planner decides extent | |

### OtherOwnersRoster + CatalogPageActions placement
| Option | Description | Selected |
|--------|-------------|----------|
| Footer/rails zone, after comments | Lower band | |
| High, near the verdict | Social proof + CTA up top | ✓ |
| You decide | Planner places per scope | |

**User's choice:** Align the catalog branch to the same visual IA shell (cleanly omitting comments — no target — and the multi-photo carousel — single image); surface OtherOwnersRoster + CatalogPageActions high, near the verdict.
**Notes:** Resolves the two `page.tsx` TODOs that explicitly defer roster/actions visibility to "Phase 64 IA redesign."

---

## Claude's Discretion

- Owner-only management actions placement (hero vs footer band); keep hidden for non-owners.
- Empty-collection hero verdict-slot fill (ReferenceIdentityCard vs caption) + fresh-account 3-CTA placement.
- Gap-fill callout placement (lean: with the verdict).
- Comments desktop width (full vs narrower reading column).
- Notes/Tracking sub-ordering in the lower spec section + updating `WatchPageSkeleton` to mirror the new IA.

## Deferred Ideas

- Real comment thread on a generic catalog entry (no per-user comment target — would need a new data model).
- Multi-photo carousel for catalog entries (`watches_catalog` photos out of scope per Phase 60 D-10; ties to SEED-009 catalog strategy).
- New social primitives / threaded replies / moderation / public liker lists / Realtime (out per v6.0 scope).
