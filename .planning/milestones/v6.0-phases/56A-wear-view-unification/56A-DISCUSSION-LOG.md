# Phase 56a: Wear View Unification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-23
**Phase:** 56a-Wear View Unification
**Areas discussed:** Route transition, Stories lane scope, Add-to-wishlist fate, Comment slot scope

---

## Route transition

### Story slide → /wear/[id] permalink
| Option | Description | Selected |
|--------|-------------|----------|
| Share/overflow control | "…"/share icon on each slide → copies/opens /wear/[id]; existing avatar & brand/model links stay | ✓ |
| Tappable timestamp | Relative time links to /wear/[id]; easy to fat-finger in a swipe lane | |
| No direct link | Permalink only via external share/notification | |

**User's choice:** Share/overflow control

### In-app presentation of /wear/[id]
| Option | Description | Selected |
|--------|-------------|----------|
| Plain full-page nav | Standard navigation; back returns to prior page; matches conventional-page decision | ✓ |
| Intercepting + parallel routes | (.)wear/[id] modal-over-feed with real URL; more routing complexity | |
| You decide | Defer to planning | |

**User's choice:** Plain full-page nav

### /wear/[id] → swipe lane entry
| Option | Description | Selected |
|--------|-------------|----------|
| Via avatar/username only | Avatar/username → /u/[username]; no dedicated control | ✓ |
| Add 'View in stories' | Explicit control opening /wears/[username] at this wear | |
| No entry | Detail terminal; back only | |

**User's choice:** Via avatar/username only

---

## Stories lane scope

### Active-window rule
| Option | Description | Selected |
|--------|-------------|----------|
| Keep ~48h (match rail) | Same window as getWearRailForViewer; one definition of "active" | ✓ |
| Different window | 24h/72h; diverges from rail | |
| You decide | Defer to planning | |

**User's choice:** Keep ~48h (match rail)

### Ordering of multiple active wears
| Option | Description | Selected |
|--------|-------------|----------|
| Newest-first | Matches wornDate DESC; tapped tile = first slide | |
| Oldest-first (chronology) | Classic stories playback order | ✓ |
| You decide | Defer to planning | |

**User's choice:** Oldest-first (chronology)
**Notes:** Planner reconciliation captured in CONTEXT D-05 — drive with useViewedWears to open at oldest UNVIEWED and play forward, so it doesn't jump backward from the most-recent tile the user tapped.

### Self-lane inclusion
| Option | Description | Selected |
|--------|-------------|----------|
| Traverse rail order, self if present | user→user follows rail order; own lane appears if active; /wears/[you] valid | ✓ |
| Skip self when swiping | Others only during swipe | |
| You decide | Defer to planning | |

**User's choice:** Traverse rail order, self if present

### Empty state (no active wears)
| Option | Description | Selected |
|--------|-------------|----------|
| Redirect to /u/[username] | Graceful for aged-out ephemeral links | ✓ |
| Empty state on route | "No active wears" message + profile link | |
| 404 notFound() | Treat as missing | |

**User's choice:** Redirect to /u/[username]

---

## Add-to-wishlist fate

### Placement
| Option | Description | Selected |
|--------|-------------|----------|
| Into the overflow menu | Co-located with share/copy-link "…"; on both routes via shared card | ✓ |
| Keep visible inline button | Standalone button on both routes; competes with like/comment | |
| Drop it | Remove; add from /watch/[id] only | |

**User's choice:** Into the overflow menu

### Applicability gating
| Option | Description | Selected |
|--------|-------------|----------|
| Hide when not applicable | Suppress on own wears / already owned or wishlisted | ✓ |
| Always show | Show everywhere; rely on server no-op | |
| You decide | Defer to planning | |

**User's choice:** Hide when not applicable
**Notes:** Today's WywtSlide does not gate this; planner needs an ownership/wishlist-membership check.

---

## Comment slot scope

### How much of the comment host 56a builds
| Option | Description | Selected |
|--------|-------------|----------|
| Full host chrome + trigger, empty body | Bottom-sheet (open/close, swipe-pause, over-photo, keyboard) + inline section + trigger with "No comments yet" placeholder; Phase 57 fills body | ✓ |
| Slots only, no visible trigger | Reserve layout space only; Phase 57 builds sheet chrome too | |
| You decide | Defer to planning | |

**User's choice:** Full host chrome + trigger, empty body
**Notes:** Rationale — 56a ships/verifies to prod before 57, so the host must be self-consistent without the component; building the hard immersive-sheet mechanics with the route maximizes the Phase 57 host contract.

### Engagement + overflow control layout (stories)
| Option | Description | Selected |
|--------|-------------|----------|
| Bottom row + top-right "…" | Like + comment trigger in bottom row over photo (mirrors /wear/[id] footer); share/wishlist "…" top-right | ✓ |
| Right-edge vertical rail | TikTok-style vertical like/comment/share stack | |
| You decide | Defer to gsd-ui-phase | |

**User's choice:** Bottom row + top-right "…"

---

## Claude's Discretion
- Shared wear-card component extraction/naming (factor out of WearPhotoOverlays/WearPhotoClient).
- New per-user "all active wears" DAL read for the lane (current rail read is most-recent-per-actor).
- Lane photo signed-URL minting (per-request, never cached — Pitfall F-2).
- Add-to-wishlist success/error feedback style when moved into a menu (preserve double-submit guard).

## Deferred Ideas
- Desktop layout for /wears/[username] (mobile full-screen locked; desktop column vs full-viewport) → gsd-ui-phase.
- Stories per-wear progress segments / ring-progress UI → gsd-ui-phase polish.
