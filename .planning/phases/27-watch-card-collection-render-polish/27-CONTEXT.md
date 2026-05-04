# Phase 27: Watch Card & Collection Render Polish - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Polish the per-watch card and the Collection/Wishlist grids on `/u/[username]/[tab]` so owners can:
1. See their watches in a denser 2-column grid on mobile (<768px); desktop layout unchanged.
2. See a price line on each card — `pricePaid` for owned/sold, `targetPrice` for wishlist/grail, with `marketPrice` as a fallback when the primary value is null.
3. Reorder their wishlist (wishlist + grail combined) via drag-and-drop on desktop and long-press-and-drag on mobile, with the order persisting across sessions and devices, and rendering in the owner's chosen order on the public profile.

In scope: schema column for `sort_order` on `watches`, server action for bulk reorder, drag/drop UX on Wishlist tab, mobile grid breakpoint change, price-line rendering on `ProfileWatchCard`.

Out of scope: Add-Watch flow paid/target capture UX (deferred to Phase 28), `marketPrice` surfacing on Profile cards beyond the fallback role (v6.0 Market Value territory), reorder UX on the Collection tab (column exists; UX deferred), Notes tab reorder, design redesign of the card itself.

</domain>

<decisions>
## Implementation Decisions

### Schema & Sort Order

- **D-01:** Add a single `sort_order` column to `watches` (universal, on every row regardless of status). Type: `integer`. Indexed by `(user_id, status, sort_order)` is not required for v4.1 scale (<500 watches per user) — a plain `(user_id, sort_order)` index is sufficient if the read path needs one. No `NOT NULL` constraint needed; default 0.
- **D-02:** Backfill on migration — for each user, assign `sort_order` 0, 1, 2, … to their existing wishlist+grail watches in `createdAt DESC` order (newest first, current display order). Owned/sold watches can be backfilled with the same per-user createdAt-DESC ordering or left at default; either is acceptable since Collection reorder UX is not in this phase. No visible change to any user's order post-deploy.
- **D-03:** When a user adds a new wishlist (or grail) watch, assign `sort_order = max(sort_order) + 1` for that user's wishlist+grail set. New watch lands at the end (bottom) of the list, preserving curated order.
- **D-04:** Status transitions reset `sort_order`. When a watch's status changes (wishlist → owned, owned → wishlist, wishlist ↔ grail, etc.), set its `sort_order = max(sort_order) + 1` for the destination status group (wishlist+grail share one group; owned+sold are separate). No "remember the original slot" behavior.
- **D-05:** Wishlist tab reorder treats `wishlist` and `grail` as one combined list (single `sort_order` sequence across both). Matches today's filter (`w.status === 'wishlist' || w.status === 'grail'`) and combined render in `WishlistTabContent`.

### Reorder UX

- **D-06:** Desktop drag affordance — **press-and-hold anywhere on the card** initiates drag (~150ms hold). No always-visible drag handle, no edit-mode toggle. Click without hold still navigates to `/watch/[id]`.
- **D-07:** Mobile drag affordance — **long-press anywhere on the card** initiates drag (~250ms threshold). Tap = navigate; long-press = drag. Same gesture model as desktop, just a longer threshold to disambiguate from a tap.
- **D-08:** Non-owner viewing a public Wishlist sees plain cards — **no drag affordance, no drag behavior**. Tap = navigate. Order is the owner's chosen order, threaded through the existing privacy gates.
- **D-09:** Reorder persistence is **optimistic UI** — local state updates immediately on drop, server action fires fire-and-forget, Sonner toast on error with local rollback. Server action computes a bulk update for the user's wishlist+grail `sort_order` set in one round-trip. At <500 watches per user (typically <50 in wishlist), bulk write is fine; no need for lexorank/midpoint gap-positioning.
- **D-10:** Reorder is owner-only at the action layer — server action validates `userId === session.user.id` for every row in the bulk update.

### Mobile Grid Density (VIS-07)

- **D-11:** Change `CollectionTabContent` and `WishlistTabContent` grid from `grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4` to `grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4`. Mobile (<640px): 2 columns. Tablet+ unchanged.
- **D-12:** Render `ProfileWatchCard` content as-is at half-width on mobile. No responsive text-size variants, no compressed padding, no different-card-variant. Keep `p-4`, keep `text-base font-semibold` on model, keep tag pill, keep wear label, keep notes/target preview lines on Wishlist. Ship and iterate visually if anything reads poorly.
- **D-13:** Image aspect ratio stays `4:5` across all breakpoints. Watches are vertical objects (case + strap); shrinking to square or 4:3 on mobile would clip strap context. Update the `Image` `sizes` attribute to reflect the new mobile layout: `(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw`.
- **D-14:** Wishlist meta lines (`Target: $X`, `Notes: …`) render unchanged on mobile half-width. Notes preview keeps `line-clamp-2`. No mobile-specific hiding.

### Price Line (VIS-08)

- **D-15:** Add a single price line to `ProfileWatchCard` driven by status. Replace the existing wishlist-only `Target: $X` block with the unified line so there's one rendering path.
- **D-16:** Status → bucket mapping:
  - `owned`, `sold` → **paid bucket** (label "Paid" or "Market" depending on fallback)
  - `wishlist`, `grail` → **target bucket** (label "Target" or "Market" depending on fallback)
- **D-17:** Fallback chain (per bucket):
  - **Paid bucket:** show `pricePaid` if non-null with label `"Paid: $X"`. Else show `marketPrice` if non-null with label `"Market: $X"`. Else hide the line entirely.
  - **Target bucket:** show `targetPrice` if non-null with label `"Target: $X"`. Else show `marketPrice` if non-null with label `"Market: $X"`. Else hide the line entirely.
- **D-18:** Labels are explicit prefixes — `"Paid: $X"`, `"Target: $X"`, `"Market: $X"`. Not bare amounts, not icons. The label honestly tells the reader where the number came from.
- **D-19:** No visual distinction between primary and fallback (no muted styling for `marketPrice` when it's standing in). Single style for the price line.
- **D-20:** `marketPrice` is **not** independently surfaced on `ProfileWatchCard` outside the fallback role. v6.0 Market Value (SEED-005) is the home for market price as a first-class display.
- **D-21:** Number formatting — use `toLocaleString()` for thousands separators (matches existing card patterns). Currency is USD, prefix `$`, no decimals. (`$4,200`, not `$4,200.00`.)

### Claude's Discretion

- Drag-and-drop **library choice** is for the planner/researcher. Constraints from this discussion: must support touch (mobile long-press), must support keyboard reorder for accessibility, must integrate cleanly with React 19 Server Components/Client boundary (drag UI is necessarily a Client Component). `@dnd-kit/core` + `@dnd-kit/sortable` is a strong default candidate but the planner can substitute equivalents.
- Long-press threshold values (150ms desktop / 250ms mobile) are starting defaults — adjust if testing reveals misfire patterns.
- The exact server-action signature for bulk reorder (e.g., `reorderWishlist({ orderedIds: string[] })`) and the read-path order-by clause shape are planner-owned.
- Whether the index `(user_id, sort_order)` is added in the same migration or skipped at this scale is planner-owned.
- Cross-device sync semantics — since reorder is fire-and-forget optimistic, two-tab last-write-wins is acceptable. No conflict resolution beyond that.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/REQUIREMENTS.md` §"Wishlist UX" (WISH-01), §"Visual Polish" (VIS-07, VIS-08) — the three locked requirements for this phase
- `.planning/ROADMAP.md` §"Phase 27" — goal + 4 success criteria
- `.planning/PROJECT.md` — overall product context (taste-aware watch collection intelligence)
- `.planning/STATE.md` — current milestone status (v4.1 Polish & Patch)

### Schema & data layer
- `src/db/schema.ts` lines 48–110 — `watches` table definition; `sort_order` column added here
- `src/data/watches.ts` `getWatchesByUser` (line 91) — current read path; gets ORDER BY `sort_order` ASC for wishlist queries

### Components touched
- `src/components/watch/ProfileWatchCard.tsx` — primary card; receives the new price line and is the drag target
- `src/components/profile/CollectionTabContent.tsx` — grid breakpoint change (VIS-07)
- `src/components/profile/WishlistTabContent.tsx` — grid breakpoint change + drag/drop wiring
- `src/app/u/[username]/[tab]/page.tsx` lines 145–180 — feeds watches into both tab components; threads `isOwner` for drag-affordance gating

### Server actions & DAL
- `src/app/actions/watches.ts` — pattern for new bulk-reorder action (Zod validation, `getCurrentUser`, `revalidatePath`)
- `src/app/actions/wishlist.ts` — closest existing analog (wishlist-scoped action)

### Migration pattern
- `supabase/migrations/20260501000000_phase24_notification_enum_cleanup.sql` — most recent migration; pattern reference
- Memory: drizzle-kit push is LOCAL ONLY; prod uses `supabase db push --linked` (see `project_drizzle_supabase_db_mismatch.md`)

### Legacy / out-of-scope reference (for awareness only)
- `src/components/watch/WatchCard.tsx` — legacy v1.0 card; only used by `WatchGrid` → `CollectionView` which is **not imported anywhere**. Do NOT modify in this phase. The "Watch card" the roadmap references is `ProfileWatchCard`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`ProfileWatchCard`** (`src/components/profile/ProfileWatchCard.tsx`) — already shows `Target: $X` for wishlist (line 86). The new price line replaces this block with a unified status-driven implementation.
- **`getSafeImageUrl`** (`src/lib/images.ts`) — already used; no change.
- **Server-action pattern** (`src/app/actions/wishlist.ts`, `watches.ts`) — Zod `.strict()` + `getCurrentUser()` + `ActionResult<T>` discriminated return + `revalidatePath` on success. Reuse for `reorderWishlist`.
- **`useFormFeedback` + `FormStatusBanner`** (Phase 25) — available if a reorder needs error toast UI; Sonner is the existing toast surface.
- **`isWishlistLike` pattern** (`WatchCard.tsx:23`) — `status === 'wishlist' || status === 'grail'`. Reuse the same predicate for the bucket map (D-16).

### Established Patterns
- **Two-layer privacy** — DAL enforces RLS at anon-key + WHERE-clause profile-public/tab-public gating. Public Wishlist render via existing `getWatchesByUser` already passes through these gates; just add ORDER BY.
- **Drizzle schema lives in `src/db/schema.ts`** with forward-references resolved lazily (see catalog FK pattern at line 101). `sort_order` is a simple column — no FK juggling.
- **Tailwind grid pattern in profile tabs** — `grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4`. Single string change to `grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4`.
- **Optimistic UI in mutations** — match the existing pattern in wear-event toggles / verdict actions where applicable.

### Integration Points
- **`getWatchesByUser`** (`src/data/watches.ts:91`) needs `ORDER BY sort_order ASC, created_at DESC` — the secondary `created_at DESC` is a stable tiebreaker for any rows that share a `sort_order` (post-migration there shouldn't be ties, but defensive).
- **Tab page** (`src/app/u/[username]/[tab]/page.tsx`) threads `isOwner` to `WishlistTabContent` already (D-08). Drag-affordance gating uses this prop directly — no new prop needed.
- **Server action `reorderWishlist`** lives in `src/app/actions/wishlist.ts` (extends the existing wishlist actions file) or `src/app/actions/watches.ts` — planner's call.

</code_context>

<specifics>
## Specific Ideas

- **Press-and-hold to drag** is the user's chosen model for both desktop and mobile (unified gesture). Threshold tuning matters more than affordance design.
- **Honest labels** are non-negotiable on the price line. The label tells the user what the number is (`Paid` vs `Target` vs `Market`). No "Price: $X" generic flattening.
- **No marketPrice as a first-class display** on the profile card today — the user is reserving market-price surfacing for v6.0 Market Value (SEED-005) so the v4.1 polish doesn't pre-empt that scope.
- **Mobile density: ship and iterate.** Render `ProfileWatchCard` as-is at half-width; visual tuning happens after the user can see it on a real phone. Don't preemptively add responsive text/padding variants.

</specifics>

<deferred>
## Deferred Ideas

### Add-Watch flow paid/target capture UX → Phase 28 candidate
The Add-Watch flow (URL paste → verdict preview → 3-button decision) doesn't have a dedicated UI moment for capturing `pricePaid` (when adding owned) or `targetPrice` (when adding wishlist). User wants to "do a better job in the UI of capturing paid/target price in that moment." Phase 28 ("Add-Watch Flow & Verdict Copy Polish") is the natural home — recommend folding this in alongside UX-09/FIT-06/ADD-08, or registering it as a new requirement (e.g., `ADD-09: Capture paid/target price during Add-Watch flow`). The price-line fallback chain in Phase 27 (D-17) is partly a workaround for the gap this would close.

### Reorder UX on the Collection tab → future phase
Universal `sort_order` column means Collection-tab reorder is a small follow-up — wire the same drag/drop UX onto `CollectionTabContent`. Not in v4.1 scope; revisit when Collection is large enough that users want explicit ordering, or as a v5+ polish.

### Lexorank / midpoint sort_order positioning → if scale grows
Bulk-write reorder is fine at <500 watches/user. If the scale ceiling rises (multi-user power users, shared collections, etc.), revisit gap-positioning to avoid full-list rewrites. Not a v4.1 concern.

### `marketPrice` first-class display on cards → v6.0 Market Value (SEED-005)
v4.1 only uses `marketPrice` as a fallback in the price line. v6.0 will surface market price prominently with proper market-data integration (Watch Charts) and `market_prices` schema. Do not pre-empt.

### Retail-vs-Market label disambiguation → schema decision deferred
There's no `retailPrice` column or "new vs used" signal. v4.1 covers the gap with the honest "Market" label whether the URL source was a brand site (retail/MSRP) or secondary market (Chrono24/eBay). If a future user-research finding shows the ambiguity is painful, a `retailPrice` column or source-tagging on `marketPrice` is a v5+ schema change.

</deferred>

---

*Phase: 27-watch-card-collection-render-polish*
*Context gathered: 2026-05-04*
