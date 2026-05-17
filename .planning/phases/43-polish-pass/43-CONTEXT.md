# Phase 43: Polish Pass - Context

**Gathered:** 2026-05-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix seven known UX issues so the app feels polished and consistent before
v5.1's new `/explore` surfaces are built. In scope: filter-sheet dismiss
behavior, wishlist-card wear-UI removal, watch-card height consistency,
add-watch button relocation, device avatar upload, and the deprecated Claude
model ID. No new capabilities — this is a fix/polish pass on existing
surfaces (`/search`, the profile collection/wishlist tabs, `ProfileEditForm`,
the URL extractor).

</domain>

<decisions>
## Implementation Decisions

### Filter Sheet Dismiss — PLSH-01, PLSH-02
- **D-01:** Adopt the **Base UI Drawer** component (`@base-ui/react`,
  documented at 1.4.x) for the `/search` filter sheet. Use
  `swipeDirection="down"` for native swipe-to-dismiss — **no custom gesture
  code**. This requires a minor bump of `@base-ui/react` from `^1.3.0` to
  `^1.4.x` (verify exact version that ships Drawer at plan time).
- **D-02:** Migration scope is the **filter sheet only** — replace
  `WatchFacetSheet`/`FilterSheet.tsx` with a Drawer-based component. The
  shared `src/components/ui/sheet.tsx` primitive stays untouched; any other
  Dialog/Sheet usages are out of scope.
- **D-03:** The Drawer's `onOpenChange` + backdrop dismiss satisfy PLSH-01
  (close never blocked while a filtered query is in flight) — dismiss must
  not be gated on pending/loading state. Verify the Drawer migration does
  not reintroduce a pending-state guard.

### Watch Card Height Consistency — PLSH-04
- **D-04:** `ProfileWatchCard` is **restructured**, not just height-padded:
  - Brand + model move **above** the image (currently below).
  - Image sits below at **~4/5 aspect** (or slightly shorter — planner's
    discretion within "roughly 4/5").
  - A **fixed / min-height text block** below the image holds the remaining
    fields (tag pill, wear line, price line, wishlist notes). Sized for the
    fullest case, content top-aligned — sparse cards leave bottom whitespace
    rather than shrinking.
  - The wear-status badge overlay (`Worn today` / `Not worn recently`) stays
    absolutely positioned on the image.
- **D-05:** Result: every card in a given grid has identical outer height
  regardless of metadata completeness or whether a photo exists.

### Add-Watch Button — PLSH-05
- **D-06:** Replace the end-of-grid `AddWatchCard` with a **per-tab button**:
  collection tab → "Add to Collection", wishlist tab → "Add to Wishlist"
  (status implied by tab; existing two-variant labels preserved).
- **D-07:** Button is **right-aligned within the existing filter-chips +
  search row** above the grid — no new row.
- **D-08:** The empty-state CTA (centered card in `CollectionTabContent` /
  `WishlistTabContent`, including the no-`ANTHROPIC_API_KEY` two-button
  fallback) is **left unchanged** — PLSH-05 only relocates the populated-grid
  CTA. `AddWatchCard` may still be used by the empty state.

### Avatar Upload — PLSH-06
- **D-09:** Device upload uses an **interactive crop** step: after the user
  picks a file, they drag/zoom to position the crop, shown under a
  **circular mask** (avatars render as circles). Output is a square image
  stored in Supabase Storage; the circular mask is the crop UI affordance.
  No suitable crop component exists yet — one will be needed.
- **D-10:** The avatar-URL text field in `ProfileEditForm` is **dropped
  entirely** — the upload control fully replaces it. Existing avatars
  previously set via URL continue to display until the user uploads a new
  one (stored value stays a URL until overwritten).
- **D-11:** Reuse the existing photo-pipeline conventions (EXIF strip,
  canvas re-encode, ≤8 MB guard) from `CatalogPhotoUploader` /
  `src/lib/storage/catalogSourcePhotos.ts` — but the crop step is new.

### Wear UI on Wishlist Cards — PLSH-03
- **D-12:** Clear-cut, no gray area. `ProfileWatchCard` must render **no
  wear details** for wishlist/grail watches — suppress the "Never worn" /
  "Worn Xd ago" last-worn line **and** the on-image wear badge. Wear UI
  appears only for owned watches. (Note: the fixed text block from D-04
  reserves space for the fullest case — the wishlist grid's fullest case
  simply excludes the wear line.)

### Claude Model ID — PLSH-07
- **D-13:** Clear-cut, no gray area. Update the watch-extraction LLM call in
  `src/lib/extractors/llm.ts:78` from the deprecated
  `claude-sonnet-4-20250514` to `claude-sonnet-4-6`. (The catalog enricher,
  `src/lib/taste/enricher.ts`, already uses `claude-sonnet-4-6` — match it.)

### Claude's Discretion
- Exact `@base-ui/react` patch version that ships Drawer (D-01).
- Precise image aspect ratio within "roughly 4/5, maybe a bit shorter" (D-04).
- Crop component choice — build vs library — for the interactive circular
  crop (D-09); evaluate at research time.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Requirements
- `.planning/ROADMAP.md` § "Phase 43: Polish Pass" — phase goal, the seven
  PLSH requirements, and six success criteria.
- `.planning/REQUIREMENTS.md` — PLSH-01 through PLSH-07 requirement text.
- `.planning/seeds/SEED-008-v5.1-explore-redesign.md` — the v5.1 seed that
  defines the polish pass as a precursor to the `/explore` redesign.

### Base UI Drawer (PLSH-01 / PLSH-02)
- https://base-ui.com/react/components/drawer — official Drawer docs.
  Native `swipeDirection` prop ("up"/"down"/"left"/"right"), `snapPoints`,
  `Drawer.SwipeArea`, drag-progress CSS variables. Requires `@base-ui/react`
  ~1.4.x. **Read before planning the filter-sheet migration.**

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/search/FilterSheet.tsx` — current filter sheet
  (`WatchFacetSheet`); side="bottom" `Sheet`, already has a drag-handle div.
  This is the component to migrate to Base UI Drawer.
- `src/components/ui/sheet.tsx` — shared Sheet primitive wrapping
  `@base-ui/react/dialog`. **Left untouched** per D-02.
- `src/components/profile/ProfileWatchCard.tsx` — the card used by the
  collection and wishlist grids; target of the D-04 restructure and the
  D-12 wear-UI suppression. Has `showWishlistMeta` prop and a status-driven
  price line already.
- `src/components/profile/AddWatchCard.tsx` — the end-of-grid CTA being
  relocated; two-variant (collection/wishlist) with a `returnTo` prop.
- `src/components/profile/CollectionTabContent.tsx` /
  `WishlistTabContent.tsx` — host the grids, the filter-chips + search row
  (where the D-07 button lands), and the empty states (unchanged per D-08).
- `src/components/watch/CatalogPhotoUploader.tsx` — EXIF-strip + canvas
  resize + ≤8 MB photo pipeline; pattern to reuse for avatar upload.
- `src/lib/storage/catalogSourcePhotos.ts` — Supabase Storage bucket helper
  pattern (RLS folder enforcement, browser uploader). Avatar upload needs an
  analogous bucket/helper.
- `src/components/profile/ProfileEditForm.tsx` — holds the avatar-URL field
  to be replaced (lines 62-72); `updateProfile` Server Action in
  `src/app/actions/profile.ts`.

### Established Patterns
- Photo uploads: client-side EXIF strip + canvas re-encode before upload;
  RLS-scoped Supabase Storage buckets keyed by `{userId}/...` paths.
- Cards: shadcn `Card` + `next/image` with `fill` + `aspect-[4/5]`.
- Server Actions for profile mutation with strict schemas; toast feedback
  via `useFormFeedback`.

### Integration Points
- `src/lib/extractors/llm.ts:78` — model ID string to update (PLSH-07).
- `ProfileEditForm` ↔ `updateProfile` action ↔ `profiles.avatarUrl` column —
  avatar upload writes a Storage URL through this existing path.
- `package.json` — `@base-ui/react` version bump for Drawer.

</code_context>

<specifics>
## Specific Ideas

- User explicitly directed the `ProfileWatchCard` layout reorder (brand/model
  above image) — this is a deliberate visual restructure, not just a
  height fix. Honor it.
- User asked for the Drawer evaluation specifically against
  https://base-ui.com/react/components/drawer and chose it on the basis that
  it provides swipe-to-dismiss **without custom behavior**. Keep the
  implementation gesture-code-free — lean on the component's `swipeDirection`.
- Avatar crop must show a **circular** mask (not square) — matches how
  avatars render across profile surfaces.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Broader bottom-sheet primitive
migration was explicitly scoped out per D-02; if other surfaces later want
Drawer behavior, that is a separate effort.)

</deferred>

---

*Phase: 43-Polish Pass*
*Context gathered: 2026-05-16*
