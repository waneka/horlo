# Phase 27: Watch Card & Collection Render Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-04
**Phase:** 27-watch-card-collection-render-polish
**Areas discussed:** Reorder scope, Reorder UX feel, Mobile card density, Price line behavior

---

## Reorder scope

### Q1: Where should `sort_order` live?

| Option | Description | Selected |
|--------|-------------|----------|
| Universal column, wishlist-only UX | sort_order on every watches row. Wishlist tab UI lets you reorder. Collection tab keeps default order (createdAt DESC). Cheap to extend later. | ✓ |
| Wishlist-only and reorder Collection too | Add column AND wire reorder UI on Collection in this phase. Expands Phase 27 scope. | |
| Status-scoped semantics | Column exists but value is only valid for status=wishlist\|grail. Other statuses NULL or 0. | |

**User's choice:** Universal column, wishlist-only UX (Recommended)

### Q2: Where do new wishlist watches land?

| Option | Description | Selected |
|--------|-------------|----------|
| Append to end (highest sort_order) | Newest goes to bottom. Owner's curated order stays on top. Standard for ranked lists. | ✓ |
| Prepend to top | Newest goes to top, mirrors current createdAt DESC. Pushes curated items down. | |
| Insert based on default order | Mixed behavior depending on whether user has reordered. | |

**User's choice:** Append to end (Recommended)

### Q3: Migration backfill?

| Option | Description | Selected |
|--------|-------------|----------|
| Backfill by createdAt DESC, per-user | Each user's wishlist+grails get sort_order 0, 1, 2… in current displayed order. No visible change post-deploy. | ✓ |
| Backfill all rows to NULL, fall back to createdAt | Cheaper migration, mixed state until user reorders. | |
| Backfill every row by createdAt DESC | Initialize column for every status, useful if Collection reorder is on the horizon. | |

**User's choice:** Backfill by createdAt DESC, per-user (Recommended)

### Q4: Status transition behavior?

| Option | Description | Selected |
|--------|-------------|----------|
| Reset to end-of-target-list | Promote/demote: assign max(sort_order)+1 of destination status set. | ✓ |
| Keep existing sort_order across status changes | Watch retains its number. If converted back, lands roughly where it was. | |
| Don't bother — universal backfill makes it irrelevant | Just leave the value alone. | |

**User's choice:** Reset to end-of-target-list (Recommended)

### Q5: Wishlist + grail ordering?

| Option | Description | Selected |
|--------|-------------|----------|
| Combined — one sort_order across both | User can interleave grails with wishlist. Matches current rendering. | ✓ |
| Grails pinned to top, wishlist below | Two separate sortable groups; adds visual grouping. | |

**User's choice:** Combined (Recommended)

---

## Reorder UX feel

### Q1: Desktop drag initiation?

| Option | Description | Selected |
|--------|-------------|----------|
| Press-and-hold anywhere on the card | Same gesture as mobile. ~150ms hold disambiguates from click. No extra UI affordance. | ✓ |
| Always-visible drag handle | Explicit affordance, click-anywhere always navigates. | |
| Edit-mode toggle | "Reorder" button toggles state. Two-step interaction. | |

**User's choice:** Press-and-hold anywhere (Recommended)

### Q2: Mobile drag vs tap?

| Option | Description | Selected |
|--------|-------------|----------|
| Tap = navigate, long-press = drag | ~250ms threshold. Standard mobile pattern (iOS Photos). | ✓ |
| Render drag handle on mobile | Tap card body = navigate; handle = drag. Zero misfire, more visual noise. | |
| Edit-mode toggle on mobile | Two-step pattern unified across breakpoints. | |

**User's choice:** Tap = navigate, long-press = drag (Recommended)

### Q3: Non-owner drag UI?

| Option | Description | Selected |
|--------|-------------|----------|
| Plain cards, no drag affordance, no drag behavior | Read-only profile, tap = navigate. | ✓ |
| Same drag UI but disabled / no-op | Visual parity, no benefit. | |

**User's choice:** Plain cards, no drag affordance (Recommended)

### Q4: Persistence model?

| Option | Description | Selected |
|--------|-------------|----------|
| Optimistic UI — local reorder, fire-and-forget server, rollback on error | Snappy. Bulk update for the user's wishlist set. Sonner toast on rollback. | ✓ |
| Pessimistic — wait for server confirmation | Spinner during drop. Safer but laggy. | |

**User's choice:** Optimistic UI (Recommended)

---

## Mobile card density

### Q1: Slim card content for half-width?

| Option | Description | Selected |
|--------|-------------|----------|
| Render as-is, let it pack tighter | Tailwind text sizes scale OK. Single grid-cols change. Lowest risk. | ✓ |
| Slim text sizes on mobile only | Add responsive variants (p-3, sm text, hide notes). | |
| Different card variant for mobile | Bigger redesign — risks scope creep. | |

**User's choice:** Render as-is (Recommended)

### Q2: Image aspect ratio?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep 4:5 across all breakpoints | Watches are vertical objects; consistency makes the design system easier. | ✓ |
| Square (1:1) on mobile, 4:5 on desktop | Tighter footprint on mobile. May clip strap/lugs. | |
| Shorter (4:3 or 3:2) on mobile | Even more compact; cuts off strap context. | |

**User's choice:** Keep 4:5 across all breakpoints (Recommended)

### Q3: Wishlist meta on mobile?

| Option | Description | Selected |
|--------|-------------|----------|
| Render all meta lines as-is | Notes line-clamp-2; Target one line. Readable at half-width. | ✓ |
| Hide notes preview on mobile | Cleaner mobile cards; tap into watch to read notes. | |
| Hide both notes and target on mobile | Maximum density; loses VIS-08 price-at-a-glance benefit. | |

**User's choice:** Render all meta lines as-is (Recommended)

---

## Price line behavior

### Q1: Card price line shape?

| Option | Description | Selected |
|--------|-------------|----------|
| One unified price line, status-driven | Owned/sold → "Paid: $X", wishlist/grail → "Target: $X", hide if null. | (see notes) |
| Add paid line on owned, keep wishlist Target as-is | Less invasive, two paths. | |
| Show both prices when both exist | More density. Risks v6.0 Market Value scope. | |

**User's choice:** Free-text — "I don't know if users will be adding target prices on every watch, but we should be capturing retail price pretty consistently, at least for new watches. Maybe target makes sense for used/vintage/secondary market and retail makes sense for new… but that's probably hard to determine. Thoughts on how to evaluate this? Or what to show and when?"

**Resolution:** Surfaced the data reality — `marketPrice` is already auto-captured by the URL extractor (`src/lib/extractors/structured.ts:72`); for brand sites that's effectively retail/MSRP, for secondary it's market. Recommended a **fallback chain** with **honest labels**:
- Owned/Sold: `pricePaid` if non-null → "Paid: $X", else `marketPrice` → "Market: $X", else hide.
- Wishlist/Grail: `targetPrice` if non-null → "Target: $X", else `marketPrice` → "Market: $X", else hide.
- Labels are explicit prefixes — the prefix tells the reader where the number came from. No "Retail" vs "Market" disambiguation in v4.1 (no schema signal for new-vs-used).

**Notes:** User wants better paid/target capture in the Add-Watch flow itself — captured as a deferred idea (Phase 28 candidate).

### Q2: Label format?

**Resolution:** Explicit labels ("Paid" / "Target" / "Market"). Not flattened to "Price". Not bare amounts. Not icons. User confirmed: "don't flatten, use explicit labels."

### Q3: Sold and grail handling?

| Option | Description | Selected |
|--------|-------------|----------|
| Sold = paid→market, Grail = target→market | Sold like owned, Grail like wishlist. Matches existing isWishlistLike grouping. | ✓ |
| Sold = no price line, Grail = target→market | Sold is past-tense; arguably price isn't relevant. | |
| Sold = paid→market, Grail = no fallback (target-only) | Grails are dream watches; market number feels like noise. | |

**User's choice:** Sold = paid→market, Grail = target→market (Recommended)

### Q4: marketPrice as first-class display on ProfileWatchCard?

| Option | Description | Selected |
|--------|-------------|----------|
| No — leave marketPrice off (only as fallback) | v6.0 Market Value is the home for market price. Keep scope tight. | ✓ |
| Add marketPrice as a secondary muted line | Useful at-a-glance comparison; pre-empts v6.0. | |
| Only when isFlaggedDeal/Deal-badge already shown | Tie marketPrice to existing Deal logic. | |

**User's choice:** No — leave marketPrice off, fallback role only (Recommended)

### Q5: Visual distinction between primary and fallback?

**Resolution:** No. Single style for the price line. User confirmed when asked: "no."

---

## Claude's Discretion

- Drag-and-drop library choice (researcher/planner — `@dnd-kit/core` + `@dnd-kit/sortable` is a strong default).
- Long-press threshold tuning (150ms desktop / 250ms mobile are starting defaults).
- Server action signature for bulk reorder (e.g., `reorderWishlist({ orderedIds: string[] })`).
- Index strategy on `(user_id, sort_order)`.
- Cross-device sync conflict resolution (last-write-wins is acceptable).

## Deferred Ideas

- **Add-Watch flow paid/target capture UX** → Phase 28 candidate. User explicitly requested better UI for capturing paid (owned) and target (wishlist) prices during the Add-Watch flow. Recommend folding into Phase 28 alongside UX-09/FIT-06/ADD-08, or registering as new requirement `ADD-09`.
- **Reorder UX on Collection tab** → future phase. Universal `sort_order` column makes this a small follow-up.
- **Lexorank/midpoint positioning** → revisit if scale grows beyond ~500 watches/user.
- **`marketPrice` first-class display** → v6.0 Market Value (SEED-005).
- **Retail-vs-Market label disambiguation** → deferred schema decision (no `retailPrice` column today).
