# Phase 43: Polish Pass - Research

**Researched:** 2026-05-16
**Domain:** React component migration (Base UI Drawer), card layout restructure, Supabase Storage (avatar bucket), interactive image crop, model ID patch
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Filter Sheet Dismiss — PLSH-01, PLSH-02**
- D-01: Adopt the Base UI Drawer component (`@base-ui/react`, documented at 1.4.x) for the `/search` filter sheet. Use `swipeDirection="down"` for native swipe-to-dismiss — no custom gesture code. Requires a minor bump of `@base-ui/react` from `^1.3.0` to `^1.4.x` (verify exact version that ships Drawer at plan time).
- D-02: Migration scope is the filter sheet only — replace `WatchFacetSheet`/`FilterSheet.tsx` with a Drawer-based component. The shared `src/components/ui/sheet.tsx` primitive stays untouched; any other Dialog/Sheet usages are out of scope.
- D-03: The Drawer's `onOpenChange` + backdrop dismiss satisfy PLSH-01 (close never blocked while a filtered query is in flight) — dismiss must not be gated on pending/loading state. Verify the Drawer migration does not reintroduce a pending-state guard.

**Watch Card Height Consistency — PLSH-04**
- D-04: `ProfileWatchCard` is restructured, not just height-padded: brand + model move above the image; image sits below at ~4/5 aspect (or slightly shorter — planner's discretion within "roughly 4/5"); a fixed/min-height text block below the image holds the remaining fields (tag pill, wear line, price line, wishlist notes). Sized for the fullest case, content top-aligned — sparse cards leave bottom whitespace rather than shrinking.
- D-05: Result: every card in a given grid has identical outer height regardless of metadata completeness or whether a photo exists.

**Add-Watch Button — PLSH-05**
- D-06: Replace the end-of-grid `AddWatchCard` with a per-tab button: collection tab → "Add to Collection", wishlist tab → "Add to Wishlist" (status implied by tab; existing two-variant labels preserved).
- D-07: Button is right-aligned within the existing filter-chips + search row above the grid — no new row.
- D-08: The empty-state CTA (centered card in `CollectionTabContent` / `WishlistTabContent`, including the no-`ANTHROPIC_API_KEY` two-button fallback) is left unchanged — PLSH-05 only relocates the populated-grid CTA. `AddWatchCard` may still be used by the empty state.

**Avatar Upload — PLSH-06**
- D-09: Device upload uses an interactive crop step: after the user picks a file, they drag/zoom to position the crop, shown under a circular mask (avatars render as circles). Output is a square image stored in Supabase Storage; the circular mask is the crop UI affordance. No suitable crop component exists yet — one will be needed.
- D-10: The avatar-URL text field in `ProfileEditForm` is dropped entirely — the upload control fully replaces it. Existing avatars previously set via URL continue to display until the user uploads a new one (stored value stays a URL until overwritten).
- D-11: Reuse the existing photo-pipeline conventions (EXIF strip, canvas re-encode, ≤8 MB guard) from `CatalogPhotoUploader` / `src/lib/storage/catalogSourcePhotos.ts` — but the crop step is new.

**Wear UI on Wishlist Cards — PLSH-03**
- D-12: `ProfileWatchCard` must render no wear details for wishlist/grail watches — suppress the "Never worn" / "Worn Xd ago" last-worn line AND the on-image wear badge. Wear UI appears only for owned watches.

**Claude Model ID — PLSH-07**
- D-13: Update the watch-extraction LLM call in `src/lib/extractors/llm.ts:78` from the deprecated `claude-sonnet-4-20250514` to `claude-sonnet-4-6`. (The catalog enricher, `src/lib/taste/enricher.ts`, already uses `claude-sonnet-4-6` — match it.)

### Claude's Discretion
- Exact `@base-ui/react` patch version that ships Drawer (D-01).
- Precise image aspect ratio within "roughly 4/5, maybe a bit shorter" (D-04).
- Crop component choice — build vs library — for the interactive circular crop (D-09); evaluate at research time.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. Broader bottom-sheet primitive migration was explicitly scoped out per D-02; if other surfaces later want Drawer behavior, that is a separate effort.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLSH-01 | The `/search` filter bottom-sheet can be dismissed (tap-outside or close control) while a filtered query is still loading — close is never blocked by pending state. | Base UI Drawer's `onOpenChange` is a pure UI callback — not wired to query state in the current implementation. Dismiss is never blocked by async loading. |
| PLSH-02 | The `/search` filter bottom-sheet can be dismissed with a downward swipe gesture. | Base UI Drawer `swipeDirection="down"` provides native swipe-to-dismiss. Present in installed v1.3.0. |
| PLSH-03 | Wishlist watch cards render no wear details — "Never worn", wear badges, and the last-worn line appear only on owned watches. | `ProfileWatchCard` currently renders wear badge and `lastWornLabel` for all statuses. A status check gates these conditionally (see Patterns). |
| PLSH-04 | Watch cards in the collection and wishlist grids have a consistent height regardless of a watch's metadata or photo. | Card layout restructure: brand/model above image, fixed-height text block below. CSS pattern documented. |
| PLSH-05 | The add-to-collection / add-to-wishlist action is a button above the watch grid rather than a card at the end of the grid. | `CollectionTabContent` and `WishlistTabContent` both have filter-chips + search row where the right-aligned button lands. |
| PLSH-06 | User can upload a profile photo from their device; it is stored in Supabase Storage and served on profile surfaces, replacing the avatar-URL text field. | `react-easy-crop` with `cropShape="round"`, new avatar-uploads Supabase Storage bucket + RLS migration, adapts existing `stripAndResize` pattern. |
| PLSH-07 | The watch-extraction LLM integration uses a current, non-deprecated Claude model ID. | `src/lib/extractors/llm.ts:78` currently reads `claude-sonnet-4-20250514`. One-line change to `claude-sonnet-4-6`. |
</phase_requirements>

---

## Summary

Phase 43 is a focused polish pass — seven discrete UX fixes with no new DB tables. Each fix is mechanically independent of the others. The riskiest surface is the avatar upload (D-09 to D-11): it introduces a new library (`react-easy-crop`), a new Supabase Storage bucket, and a new migration. The Drawer migration (D-01 to D-03) is the second most complex piece but is substantially de-risked: the Drawer component shipped in `@base-ui/react` v1.2.0 and is **already stable in the currently installed v1.3.0**, meaning the package bump described in CONTEXT.md ("`^1.3.0` to `^1.4.x`") is **not required** — Drawer is present and stable at the installed version.

The `ProfileWatchCard` restructure (D-04, D-05, D-12) touches layout CSS carefully to avoid the known CSS-chain blind spot (aspect-ratio / object-fit + equal-height grids). The add-watch button relocation (D-06 to D-08) is purely additive — the empty-state CTAs are untouched, and `AddWatchCard` is relegated to a button version in the filter row. The model ID change (D-13) is a single-line patch.

**Primary recommendation:** Execute in five waves: (1) model ID trivial patch, (2) wishlist wear UI suppression, (3) add-watch button relocation, (4) ProfileWatchCard layout restructure, (5) Drawer migration + avatar upload (largest surface area, should be last to allow earlier waves to ship clean).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Filter sheet gesture dismiss | Browser / Client | — | `WatchFacetSheet` is a `'use client'` component; gesture handling is pure client-side DOM interaction |
| Watch card height consistency | Browser / Client | — | CSS layout, rendered on client from Zustand store data |
| Add-watch button | Browser / Client | — | `CollectionTabContent`/`WishlistTabContent` are `'use client'`; button is a navigation link |
| Avatar upload (crop + encode) | Browser / Client | API / Backend (Storage) | Crop, EXIF strip, and canvas re-encode happen on-device; resulting JPEG uploaded to Supabase Storage via browser session |
| Avatar Storage bucket + RLS | Database / Storage | — | Supabase Storage bucket + row-level security policies, created via SQL migration |
| Avatar URL persistence | API / Backend | — | `updateProfile` Server Action writes the Storage URL to `profiles.avatar_url` |
| Wishlist wear UI suppression | Browser / Client | — | Conditional rendering inside `ProfileWatchCard` based on `watch.status` |
| Claude model ID | API / Backend | — | Server-side extractor (`src/lib/extractors/llm.ts`) — executed in API route context |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@base-ui/react` | 1.3.0 (installed) / 1.4.1 (latest) | Base UI Drawer for swipe-dismissible filter sheet | Already in use for Dialog/Sheet; Drawer stable since v1.2.0; no new dependency |
| `react-easy-crop` | 5.5.7 | Interactive image crop with circular mask | `cropShape="round"` built-in; touch/pinch-zoom; peer deps `react>=16.4.0`; compatible with React 19 |

[VERIFIED: npm registry — `@base-ui/react` latest is 1.4.1; installed is 1.3.0]
[VERIFIED: npm registry — `react-easy-crop` latest is 5.5.7; peerDeps `react>=16.4.0`]
[VERIFIED: node_modules — Drawer module present and stable at installed v1.3.0 (CHANGELOG confirms stable in v1.3.0)]

### Version Verification

```
@base-ui/react:  installed 1.3.0, latest 1.4.1
react-easy-crop: not installed, latest 5.5.7
```

**Package bump decision:** CONTEXT.md D-01 anticipated a bump to `^1.4.x`. Research shows the Drawer component shipped in v1.2.0 and was **promoted to stable (non-preview) in v1.3.0** (`CHANGELOG.md` line 57: "Drawer is now stable and should be imported as `{ Drawer } from '@base-ui/react/drawer'`"). The installed 1.3.0 already has all needed Drawer parts (`drawer/` directory with all sub-components confirmed in `node_modules`). **Recommendation: do not bump; use the installed 1.3.0.** If the team wants v1.4.x anyway for other fixes (e.g., the `data-base-ui-swipe-ignore` improvement in v1.3.0), bump is safe — no breaking changes to Dialog between 1.3.0 and 1.4.1.

### Installation Required

```bash
npm install react-easy-crop
```

No other new runtime dependencies.

---

## Architecture Patterns

### System Architecture Diagram

```
User action (swipe / tap outside)
  └─► Drawer.Root onOpenChange(false)
        └─► setSheetOpen(false) in SearchPageClient
              └─► Drawer unmounts / transitions closed
                    (query state in useSearchState unaffected)

User picks avatar file
  └─► <input type="file"> triggers handleChange
        └─► 8 MB guard
              └─► HEIC convert (if needed, via heic-worker)
                    └─► react-easy-crop UI shown (circular mask)
                          └─► user drags/zooms → confirm crop
                                └─► canvas crop to square pixels (getCroppedCanvas)
                                      └─► stripAndResize (EXIF strip)
                                            └─► uploadAvatarPhoto(userId, jpeg)
                                                  └─► Supabase Storage: avatars/{userId}/avatar.jpg
                                                        └─► updateProfile({ avatarUrl: publicUrl })
                                                              └─► profiles.avatar_url updated
                                                                    └─► revalidatePath → AvatarDisplay re-renders
```

### Recommended Project Structure

No new top-level directories needed. New and modified files:

```
src/
├── components/
│   ├── search/
│   │   └── FilterDrawer.tsx          # NEW: Drawer-based replacement for FilterSheet.tsx
│   └── profile/
│       ├── ProfileWatchCard.tsx       # MODIFIED: brand/model above, fixed text block, wear suppression
│       ├── CollectionTabContent.tsx   # MODIFIED: right-aligned add button; AddWatchCard stays in empty state
│       ├── WishlistTabContent.tsx     # MODIFIED: right-aligned add button
│       ├── AvatarUploader.tsx         # NEW: react-easy-crop + pipeline, replaces URL field
│       └── ProfileEditForm.tsx        # MODIFIED: replace avatarUrl Input with AvatarUploader
├── lib/
│   └── storage/
│       └── avatarPhotos.ts            # NEW: analogous to catalogSourcePhotos.ts
└── supabase/
    └── migrations/
        └── 20260516000000_phase43_avatar_bucket.sql   # NEW: bucket + 4 RLS policies
```

---

### Pattern 1: Base UI Drawer (replaces Sheet for filter panel)

**What:** `Drawer.Root` with `swipeDirection="down"` provides swipe-to-dismiss natively. `open`/`onOpenChange` is the same controlled-open interface as the current Sheet.

**When to use:** Any bottom sheet that should be swipe-dismissible without custom gesture code.

**Import path (verified in node_modules):**
```typescript
// Source: node_modules/@base-ui/react/drawer/index.d.ts
import { Drawer } from '@base-ui/react/drawer'
```

**Component tree required:**
```typescript
// Source: base-ui.com/react/components/drawer + node_modules type definitions
<Drawer.Root
  open={open}
  onOpenChange={onOpenChange}
  swipeDirection="down"
>
  <Drawer.Portal>
    <Drawer.Backdrop />
    <Drawer.Viewport>
      <Drawer.Popup className="fixed inset-x-0 bottom-0 ...">
        {/* drag handle */}
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-muted-foreground/30 shrink-0" />
        {/* content */}
        <Drawer.Content>
          <Drawer.Title>Filters</Drawer.Title>
          {/* filter chips */}
        </Drawer.Content>
        {/* footer */}
        <Drawer.Close render={<Button variant="ghost" ... />}>Clear all</Drawer.Close>
      </Drawer.Popup>
    </Drawer.Viewport>
  </Drawer.Portal>
</Drawer.Root>
```

**Note:** `Drawer.Content`, `Drawer.Title`, `Drawer.Close` are all confirmed sub-parts in v1.3.0 type definitions. `Drawer.Trigger` is not needed (the filter button in `SearchPageClient` controls `setSheetOpen` directly — same pattern as current `Sheet` usage).

**PLSH-01 guarantee:** The Drawer's `onOpenChange` fires unconditionally on outside press, swipe, or ESC. It is not connected to the watch query state machine in `useSearchState`. The current `FilterSheet.tsx` does not gate `onOpenChange` on any pending state — and the Drawer migration must not introduce one. The `WatchFacetSheet` props (`movement`, `size`, `styleArr`, etc.) are filter *values* passed down; they do not block dismiss.

**CSS variables for drag-follow animations (optional — not required for PLSH-02):**
- `--drawer-swipe-movement-y` — real-time drag offset in px
- `--drawer-swipe-progress` — normalized 0–1 progress
- `--drawer-swipe-strength` — velocity scalar 0.1–1

### Pattern 2: ProfileWatchCard Layout Restructure (D-04, D-05, D-12)

**Current structure (confirmed from source):**
```
<Card>
  <div className="relative aspect-[4/5] bg-muted">  ← image area
    {image or icon placeholder}
    {wear badge — absolute positioned}
  </div>
  <CardContent className="p-4">
    <p>{watch.brand}</p>           ← brand BELOW image
    <p>{watch.model}</p>           ← model BELOW image
    {tag badge}
    <p>{lastWornLabel}</p>        ← wear line (always rendered)
    {priceLine}
    {showWishlistMeta && notes}
  </CardContent>
</Card>
```

**Target structure (D-04, D-05, D-12):**
```typescript
// [ASSUMED] layout — planner should verify precise Tailwind classes
<Link href={`/watch/${watch.id}`}>
  <Card className="group cursor-pointer overflow-hidden transition-shadow hover:shadow-lg h-full flex flex-col">
    {/* Brand + model ABOVE image */}
    <div className="px-3 pt-3 pb-1">
      <p className="text-sm font-normal text-muted-foreground truncate">{watch.brand}</p>
      <p className="text-base font-semibold leading-tight truncate">{watch.model}</p>
    </div>

    {/* Image area — aspect ~4/5 (planner discretion: 4/5 or 3/4) */}
    <div className="relative aspect-[4/5] bg-muted">
      {safeUrl ? <Image ... /> : <WatchIcon ... />}
      {/* Wear badge — OWNED watches only (D-12) */}
      {!isWishlistLike && (isWornToday || isStale) && (
        <span className="absolute top-2 left-2 ...">
          {isWornToday ? 'Worn today' : 'Not worn recently'}
        </span>
      )}
    </div>

    {/* Fixed-height text block — fullest case is OWNED (tag + wear + price) */}
    {/* Wishlist fullest case: tag + price (no wear) — use min-h sized to OWNED fullest */}
    <CardContent className="p-3 flex flex-col gap-1 min-h-[...px]">
      {tag && <Badge variant="secondary" className="rounded-full text-xs font-normal self-start">{tag}</Badge>}
      {/* Wear line: OWNED only (D-12) */}
      {!isWishlistLike && (
        <p className="text-xs text-muted-foreground">{lastWornLabel}</p>
      )}
      {priceLine && <p className="text-xs font-normal text-foreground">{priceLine}</p>}
      {showWishlistMeta && watch.notes && (
        <p className="line-clamp-2 text-xs text-muted-foreground">Notes: {watch.notes}</p>
      )}
    </CardContent>
  </Card>
</Link>
```

**CSS-chain pitfall (project memory):** The memory note flags "aspect-ratio / object-fit phases" as a known blind spot where the 6-pillar CSS chain checker passed but the visual contract failed. In this restructure, the image `<div>` uses `aspect-[4/5]` with `next/image fill` + `object-cover`. To guarantee equal-height cards in a CSS grid, the **outer Card must NOT have `height: auto` driven by variable content**. Use `h-full` on `<Card>` AND `grid` layout on the wrapper div. Verify that `min-h-[...]` on the text block is sized correctly after implementation — do not accept it at face value from spec alone.

**`isWishlistLike` gate for wear suppression (D-12):**
```typescript
// Already computed in ProfileWatchCard:
const isWishlistLike = watch.status === 'wishlist' || watch.status === 'grail'
// Use this gate to suppress BOTH the badge AND the lastWornLabel line.
```

### Pattern 3: Add-Watch Button Relocation (D-06, D-07, D-08)

**CollectionTabContent populated state — current filter row:**
```tsx
// lines 153-169
<div className="mb-4 flex items-center gap-2">
  <FilterChips options={chipOptions} active={activeChip} onChange={setActiveChip} />
  <div className="relative ml-auto w-48 shrink-0">
    {/* search input */}
  </div>
</div>
```

**Target — add button right of search input:**
```tsx
<div className="mb-4 flex items-center gap-2">
  <FilterChips options={chipOptions} active={activeChip} onChange={setActiveChip} />
  <div className="relative ml-auto w-48 shrink-0">
    {/* search input — unchanged */}
  </div>
  {isOwner && (
    <Button asChild variant="default" size="sm" className="shrink-0">
      <Link href={returnTo ? `/watch/new?returnTo=${encodeURIComponent(returnTo)}` : '/watch/new'}>
        Add to Collection
      </Link>
    </Button>
  )}
</div>
```

**WishlistTabContent — no filter chips, no search in current populated view.** The current populated `OwnerWishlistGrid` renders the grid directly with no filter row. D-07 says "right-aligned within the existing filter-chips + search row" — but the wishlist tab doesn't have one. **The planner must decide whether to (a) add a new wrapper row above the grid for the wishlist button, or (b) note this discrepancy and interpret D-07 liberally (add a minimal single-row above the grid for the wishlist add button).** Research recommends option (b): a `<div className="mb-4 flex justify-end">` wrapper with the add-wishlist button, mirroring the collection tab pattern without the filter chips.

**The `AddWatchCard` grid-end card is REMOVED from the populated state** in both tabs (D-06). It stays used by empty states only (D-08). `WishlistTabContent`'s `OwnerWishlistGrid` currently renders `<AddWatchCard variant="wishlist" returnTo={returnTo} />` after the SortableContext — remove this.

### Pattern 4: Avatar Upload Pipeline (D-09, D-10, D-11)

**Step 1 — File selection + 8 MB guard:** Identical to `CatalogPhotoUploader`.

**Step 2 — HEIC conversion (if needed):** Identical — use existing `heic-worker.ts` path.

**Step 3 — Show crop UI (NEW):**
```tsx
// react-easy-crop with circular mask
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'

// State:
const [crop, setCrop] = useState({ x: 0, y: 0 })
const [zoom, setZoom] = useState(1)
const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
const [imageSrc, setImageSrc] = useState<string | null>(null) // object URL

// Show cropper:
<Cropper
  image={imageSrc}
  crop={crop}
  zoom={zoom}
  aspect={1}               // output is square
  cropShape="round"        // circular mask
  showGrid={false}         // cleaner for avatar use case
  onCropChange={setCrop}
  onZoomChange={setZoom}
  onCropComplete={(_, areaPixels) => setCroppedAreaPixels(areaPixels)}
/>
// Plus: zoom slider (optional) and "Confirm crop" button
```

**Step 4 — Extract cropped pixels from canvas:**
```typescript
// getCroppedCanvas: create canvas, drawImage with crop rectangle, toBlob
async function getCroppedBlob(imageSrc: string, cropArea: Area): Promise<Blob> {
  const image = new window.Image()
  image.src = imageSrc
  await new Promise((r) => { image.onload = r })
  const canvas = document.createElement('canvas')
  canvas.width = cropArea.width
  canvas.height = cropArea.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(image, cropArea.x, cropArea.y, cropArea.width, cropArea.height, 0, 0, cropArea.width, cropArea.height)
  return new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => b ? res(b) : rej(new Error('toBlob returned null')), 'image/jpeg', 0.9)
  )
}
```

**Step 5 — EXIF strip + resize:** Call existing `stripAndResize(blob, 512)` — 512px is appropriate for an avatar square (larger than display sizes; compresses well).

**Step 6 — Upload to Supabase Storage:** Use `uploadAvatarPhoto(userId, jpeg)` from `src/lib/storage/avatarPhotos.ts` (path: `{userId}/avatar.jpg`, upsert: true — avatars replace in place).

**Step 7 — Write URL to profile:** Call `updateProfile({ avatarUrl: publicUrl })` (existing Server Action). For the `avatars` bucket, the public URL pattern is: `{SUPABASE_URL}/storage/v1/object/public/avatars/{path}` (if bucket is public) or a signed URL (if private). For avatars, a **public bucket** is appropriate: avatar images are shown to all viewers, and serving them via public CDN URL avoids signed-URL expiry issues. [ASSUMED — see Assumptions Log A2.]

### Pattern 5: Avatar Storage Bucket Migration

**Model: `supabase/migrations/20260430000001_phase19_1_catalog_source_photos_bucket.sql`**

The avatar bucket needs a similar migration file. Key differences from the catalog-source-photos bucket:

1. Bucket name: `avatars`
2. **Public bucket** (`public: true`) — avatar images are visible to all site visitors. [ASSUMED — A2]
3. Simpler path convention: `{userId}/avatar.jpg` — one file per user (upsert: true on upload replaces in place)
4. RLS policies: INSERT + UPDATE for own folder; SELECT open to all (or authenticated-only if bucket is public, SELECT policy may be redundant — confirm against Supabase storage RLS behavior)
5. File size limit: 4 MB (avatars are small; 512px JPEG is typically 50–200 KB after re-encode — 4 MB is generous)

**Migration file path convention:** `supabase/migrations/20260516000000_phase43_avatar_bucket.sql`

**Prod push:** Per project memory, `drizzle-kit push` is LOCAL ONLY. For this migration (pure SQL, no Drizzle schema change), use:
```bash
supabase db push --linked   # prod
supabase db reset            # local reset if needed
```

**`updateProfile` Server Action schema** must accept Storage URLs for `avatarUrl`. Current schema:
```typescript
avatarUrl: z.string().url().max(500).nullable().optional(),
```
This accepts any URL — including Supabase Storage public URLs. No schema change needed. [VERIFIED: `src/app/actions/profile.ts:13`]

### Anti-Patterns to Avoid

- **Gating Drawer dismiss on async state:** The new `FilterDrawer` must not wrap `onOpenChange` in a guard like `if (!watchesIsLoading) onOpenChange(open)`. The Drawer fires `onOpenChange(false)` unconditionally — pass it straight through to `setSheetOpen`.
- **`aspect-[4/5]` on outer Card instead of image div:** The `aspect-[4/5]` must stay on the image container div only. The outer Card must use `h-full flex flex-col` to grow to grid row height. Putting aspect on the Card breaks equal-height layout.
- **Signed URLs for avatar bucket (if public):** If the bucket is public, use the permanent public URL pattern, not `createSignedUrl`. Signed URLs expire (60s default), which would break avatar display after TTL.
- **Not revoking object URLs:** The crop preview uses `URL.createObjectURL`. Revoke in a `useEffect` cleanup (identical to `CatalogPhotoUploader` pattern at line 119).
- **Storing `cropShape="round"` output as non-square:** The crop confirm step must use `aspect={1}` in `<Cropper>` and produce a square canvas — storing as 1:1 square is correct. The circular display is handled by `AvatarDisplay` (`rounded-full overflow-hidden`), not by the stored image shape.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Swipe gesture detection for drawer | Custom `onTouchStart`/`onTouchMove`/`onTouchEnd` handlers | `Drawer.Root swipeDirection="down"` | Velocity detection, snap-point physics, and accessibility are all handled internally |
| Circular crop mask + drag/zoom | Canvas clip-path gesture detector from scratch | `react-easy-crop` with `cropShape="round"` | Touch-event normalization, pinch-zoom, constrained pan, and crop area math are non-trivial |
| EXIF strip for avatar | New canvas pipeline | Existing `stripAndResize` in `src/lib/exif/strip.ts` | Already handles orientation, HEIC, and iOS Safari fallbacks |

---

## Common Pitfalls

### Pitfall 1: Base UI Drawer CSS Transitions Conflict with Tailwind 4

**What goes wrong:** The existing `sheet.tsx` uses Base UI Dialog data attributes (`data-starting-style`, `data-ending-style`) with inline transition classes. Drawer uses analogous data attributes (`data-open`, `data-closed`, `data-swiping`). If the Drawer inherits global `transition` declarations from the existing Tailwind config, the swipe animation may fight with Base UI's internal animation system.

**Why it happens:** Tailwind 4 applies `transition` utilities broadly; Base UI Drawer uses JS-driven CSS variables (`--drawer-swipe-movement-y`) for gesture-follow animation, which can interact with CSS transitions on the Popup element.

**How to avoid:** Only apply `transition-transform duration-200` to the `Drawer.Popup` via `data-starting-style` / `data-ending-style` selectors (same pattern as `sheet.tsx`). Do not wrap the Popup in a generic `transition` utility class.

**Warning signs:** Drawer popup "snaps" rather than follows finger during swipe, or takes > 200ms to dismiss.

### Pitfall 2: Equal-Height Cards Require Grid Row Height, Not Fixed px

**What goes wrong:** Setting `min-h-[80px]` on the text block does not equalize cards across rows — it only prevents collapsing. Cards in a CSS grid row naturally equalize height when the **outer card** is `height: 100%` (i.e., `h-full`) within a `grid` parent.

**Why it happens:** CSS grid makes all cells in a row the same height by default, but only if each cell's direct child fills the height via `h-full`. Without `h-full` on the Card, the text block's `min-h` just sets a floor independent of siblings.

**How to avoid:** Apply `h-full flex flex-col` to `<Card>`. Apply `flex-1` to the text block (not a fixed `min-h`) so it absorbs any extra height. This is the correct pattern for equal-height grid cards.

**Warning signs:** Cards in the same row have different total heights when one has a photo and another doesn't, or when one has a price line and another doesn't.

### Pitfall 3: react-easy-crop `onCropComplete` Returns Percentage AND Pixel Area

**What goes wrong:** `onCropComplete(croppedArea, croppedAreaPixels)` provides two arguments. Using `croppedArea` (percentages) for the canvas `drawImage` call instead of `croppedAreaPixels` (pixels) results in a wildly wrong crop.

**Why it happens:** The percentage-based area is for display/storage of the crop region relative to image dimensions; the pixel area is what `drawImage` needs.

**How to avoid:** Always capture the second argument (`croppedAreaPixels`) and pass it to the `getCroppedBlob` helper. Never use the first argument for canvas operations.

### Pitfall 4: `updateProfile` Zod Schema Validates `avatarUrl` as URL

**What goes wrong:** If the avatar Storage URL is passed with a non-standard scheme or path, Zod's `z.string().url()` will reject it.

**Why it happens:** `z.string().url()` uses the URL constructor — valid for `https://` Supabase URLs. No issue expected, but worth noting if testing with local dev URLs (`http://`).

**How to avoid:** Ensure the avatar URL is an absolute `https://` URL. In local dev, Supabase Storage URLs are `http://127.0.0.1:54321/...` — `z.string().url()` accepts `http://` as well as `https://`, so this is safe. [VERIFIED: Zod `url()` uses the URL constructor which accepts any valid scheme.]

### Pitfall 5: WishlistTabContent Has No Existing Filter Row

**What goes wrong:** D-07 says the add button goes "in the existing filter-chips + search row." The wishlist tab's `OwnerWishlistGrid` has no such row — it renders the DnD grid directly. Adding the button requires adding a new wrapper row.

**Why it happens:** The wishlist tab uses DnD-kit and was designed without a filter bar.

**How to avoid:** Add a `<div className="mb-4 flex justify-end">` wrapper above the `DndContext` in `OwnerWishlistGrid` (or in `WishlistTabContent` before the branch that returns `<OwnerWishlistGrid>`). Pass `isOwner` down so the button only renders for owners.

---

## Code Examples

### Minimal FilterDrawer Skeleton

```typescript
// Source: @base-ui/react/drawer type definitions (node_modules, verified)
'use client'

import { Drawer } from '@base-ui/react/drawer'
import { Button } from '@/components/ui/button'
import { MovementChips } from '@/components/search/MovementChips'
// ... other chip imports

interface FilterDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  movement: string | null
  size: string | null
  styleArr: string[]
  onMovementChange: (v: string | null) => void
  onSizeChange: (v: string | null) => void
  onStyleChange: (v: string[]) => void
  styleVocab: string[]
}

export function FilterDrawer({ open, onOpenChange, ...filterProps }: FilterDrawerProps) {
  function handleClearAll() {
    filterProps.onMovementChange(null)
    filterProps.onSizeChange(null)
    filterProps.onStyleChange([])
  }

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} swipeDirection="down">
      <Drawer.Portal>
        <Drawer.Backdrop className="fixed inset-0 z-50 bg-black/10" />
        <Drawer.Viewport className="fixed inset-0 z-50 flex flex-col justify-end pointer-events-none">
          <Drawer.Popup className="max-h-[80vh] overflow-y-auto bg-popover rounded-t-xl border-t border-border pb-[env(safe-area-inset-bottom)] pointer-events-auto">
            {/* Drag handle */}
            <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-muted-foreground/30 shrink-0" />
            <Drawer.Content className="flex flex-col gap-6 px-4 pb-2 pt-2">
              <Drawer.Title className="font-heading text-base font-medium text-foreground">Filters</Drawer.Title>
              <MovementChips selected={filterProps.movement} onSelect={filterProps.onMovementChange} />
              <CaseSizeChips selected={filterProps.size} onSelect={filterProps.onSizeChange} />
              <StyleChips selected={filterProps.styleArr} onSelect={filterProps.onStyleChange} vocab={filterProps.styleVocab} />
            </Drawer.Content>
            <div className="mt-auto flex flex-col gap-2 p-4 border-t border-border pt-3">
              <Drawer.Close
                render={
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive w-full" onClick={handleClearAll} />
                }
              >
                Clear all
              </Drawer.Close>
            </div>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
```

### Avatar Upload Bucket Migration (model)

```sql
-- supabase/migrations/20260516000000_phase43_avatar_bucket.sql
BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,           -- public: avatar images served directly via CDN URL
  4194304,        -- 4 MB (512px JPEG ~50-200 KB; 4 MB is generous)
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- INSERT: owner may only write to their own folder
DROP POLICY IF EXISTS avatars_insert_own_folder ON storage.objects;
CREATE POLICY avatars_insert_own_folder ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- UPDATE: owner may overwrite their own files
DROP POLICY IF EXISTS avatars_update_own_folder ON storage.objects;
CREATE POLICY avatars_update_own_folder ON storage.objects
  FOR UPDATE TO authenticated
  USING      (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

-- DELETE: owner may delete their own files
DROP POLICY IF EXISTS avatars_delete_own_folder ON storage.objects;
CREATE POLICY avatars_delete_own_folder ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

COMMIT;
```

Note: If the bucket is `public: true`, a SELECT policy is not needed — public buckets allow unauthenticated reads via the public URL path.

### Model ID Patch (PLSH-07)

```typescript
// File: src/lib/extractors/llm.ts, line 78
// BEFORE:
model: 'claude-sonnet-4-20250514',
// AFTER:
model: 'claude-sonnet-4-6',
```

Confirmed: `src/lib/taste/enricher.ts` already uses `claude-sonnet-4-6` (verified in source). [VERIFIED: direct codebase read]

---

## Runtime State Inventory

> This phase involves no rename/refactor/migration of stored string identifiers. No runtime state inventory required.

**Not applicable:** Phase 43 is a UI polish pass. No renamed identifiers, no string replacements propagated to stored data. The only storage change is a new bucket (`avatars`) which is additive.

---

## Open Questions

1. **Drawer.Viewport requirement**
   - What we know: The official docs show `Drawer.Viewport` wrapping `Drawer.Popup`. The type definitions confirm `DrawerViewport` exists in v1.3.0.
   - What's unclear: Whether `Drawer.Viewport` is required or optional. The Base UI docs appear to use it consistently.
   - Recommendation: Include `Drawer.Viewport` in the implementation as shown in docs. Without it, positioning may be incorrect on iOS Safari.

2. **Avatar bucket: public vs private**
   - What we know: `catalog-source-photos` is private (signed URLs). Avatars are shown to all site visitors.
   - What's unclear: Whether the team prefers signed URLs (expire risk) or public bucket (permanent URLs, simpler).
   - Recommendation: Public bucket. Avatar URLs stored in `profiles.avatar_url` should be permanent direct URLs, not expiring signed URLs. `AvatarDisplay` uses `next/image` with `getSafeImageUrl` — a permanent public URL fits this pattern best. (Marked ASSUMED — A2 in Assumptions Log.)

3. **WishlistTabContent add-button placement**
   - What we know: D-07 says "right-aligned within the existing filter-chips + search row." The wishlist tab has no such row.
   - What's unclear: Exact visual treatment.
   - Recommendation: Add a `<div className="mb-4 flex justify-end">` row with the "Add to Wishlist" button above `<OwnerWishlistGrid>`, mirroring the collection tab's structure minus the filter chips.

4. **`react-easy-crop` output size for avatar**
   - What we know: Crop output pixels correspond to `croppedAreaPixels` dimensions (native image pixels). A 4K photo cropped to a 200x200 area in the UI might produce 200px or 4000px raw — depends on `zoom` and source resolution.
   - What's unclear: Exact `maxDim` to pass to `stripAndResize` after crop.
   - Recommendation: Pass `maxDim=512` to `stripAndResize`. This is 2x the largest `AvatarDisplay` size (96px × device pixel ratio 2 = 192px displayed). 512px provides retina-quality avatars at minimal file size.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@base-ui/react` Drawer | PLSH-01, PLSH-02 | ✓ | 1.3.0 installed | — |
| `react-easy-crop` | PLSH-06 | ✗ (not installed) | 5.5.7 (latest) | Build from scratch — NOT recommended |
| Supabase (local) | PLSH-06 (dev testing) | ✓ (assumed) | — | — |
| `supabase` CLI | Avatar bucket migration | ✓ (assumed) | — | — |

**Missing dependencies with no fallback:**
- `react-easy-crop` — install with `npm install react-easy-crop` before starting PLSH-06 work.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLSH-01 | Drawer `onOpenChange` fires while `watchesIsLoading=true` — no guard | unit | `npm test -- FilterDrawer` | ❌ Wave 0 |
| PLSH-02 | Drawer renders `swipeDirection="down"` prop | unit | `npm test -- FilterDrawer` | ❌ Wave 0 |
| PLSH-03 | `ProfileWatchCard` with `status='wishlist'` renders no wear badge and no last-worn line | unit | `npm test -- ProfileWatchCard` | ❌ Wave 0 |
| PLSH-04 | `ProfileWatchCard` renders brand + model above image container | unit | `npm test -- ProfileWatchCard` | ❌ Wave 0 |
| PLSH-05 | `CollectionTabContent` with `watches.length > 0` renders add button in filter row | unit | `npm test -- CollectionTabContent` | ❌ Wave 0 |
| PLSH-05 | `WishlistTabContent` with `watches.length > 0` renders "Add to Wishlist" button above grid | unit | `npm test -- WishlistTabContent` | ❌ Wave 0 (existing test file exists) |
| PLSH-06 | Avatar upload pipeline calls `stripAndResize`, uploads to `avatars` bucket | unit (mock) | `npm test -- AvatarUploader` | ❌ Wave 0 |
| PLSH-07 | `extractWithLlm` uses model string `claude-sonnet-4-6` | unit | `npm test -- llm` | ❌ Wave 0 |

**Note:** `tests/components/WishlistTabContent.test.tsx` exists (seen in directory listing). It covers the DnD and empty-state behaviors from Phase 27. The PLSH-05 test for the add button can be added as a new `it()` block in that file.

### Sampling Rate

- **Per task commit:** `npm test` (full suite; it runs fast with jsdom)
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green + visual smoke-check on mobile viewport (swipe gesture cannot be automated in jsdom — requires manual)

### Wave 0 Gaps

- [ ] `tests/components/FilterDrawer.test.tsx` — covers PLSH-01, PLSH-02
- [ ] `tests/components/ProfileWatchCard.test.tsx` — covers PLSH-03, PLSH-04
- [ ] `tests/components/CollectionTabContent.test.tsx` (new file) — covers PLSH-05 collection side
- [ ] Add PLSH-05 wishlist case to existing `tests/components/WishlistTabContent.test.tsx`
- [ ] `tests/components/AvatarUploader.test.tsx` — covers PLSH-06 (with Supabase Storage mocked)
- [ ] Add PLSH-07 assertion to `tests/extractors/llm.test.ts` (check if this file exists — if not, create it)

**Manual-only tests:**
- PLSH-02 swipe gesture (physical touch or Playwright TouchAction): mark as manual verification step in VALIDATION.md
- PLSH-04 equal-height visual check: screenshot comparison or manual review

---

## Security Domain

> `security_enforcement` not explicitly set to false in config.json — treating as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | — |
| V3 Session Management | No | — |
| V4 Access Control | Yes | Supabase RLS folder enforcement `(storage.foldername(name))[1] = auth.uid()` — same pattern as catalog-source-photos |
| V5 Input Validation | Yes | File size guard (≤4 MB), MIME type allow-list in bucket config, canvas re-encode strips arbitrary file content |
| V6 Cryptography | No | — |

### Known Threat Patterns for Avatar Upload

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal in Storage path | Tampering | RLS folder enforcement: `(storage.foldername(name))[1] = auth.uid()` — exact same guard as `catalog_source_photos_insert_own_folder` |
| Malicious file upload (polyglot image) | Tampering | Canvas re-encode via `stripAndResize` — raw file bytes never stored; only the re-encoded JPEG from `canvas.toBlob` reaches Storage |
| Overwriting another user's avatar | Tampering | RLS INSERT+UPDATE policies restrict to own folder path; Supabase enforces at storage layer |
| EXIF metadata (GPS, personal) in avatar | Info disclosure | `stripAndResize` via canvas re-encode drops all EXIF unconditionally |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@base-ui/react` v1.4.1 (latest) has no breaking changes to `Dialog` vs v1.3.0 — the installed 1.3.0 Drawer is sufficient and a bump is not required | Standard Stack | Low — if a bump is chosen, the CHANGELOG shows no Dialog breaking changes between 1.3.0 and 1.4.1 |
| A2 | The `avatars` Storage bucket should be `public: true` (CDN URL, no expiry), not private with signed URLs | Pattern 5 / Open Questions | Medium — if private is preferred, the upload helper must generate 1-year signed URLs and store them, with periodic refresh logic |
| A3 | `stripAndResize` with `maxDim=512` is appropriate for avatar output resolution | Pattern 4 | Low — if the team prefers a different size, only the `maxDim` argument changes |

---

## Sources

### Primary (HIGH confidence)

- `node_modules/@base-ui/react` (v1.3.0 installed) — Drawer type definitions, component tree, CSS variables, `onOpenChange` event signature
- `node_modules/@base-ui/react/CHANGELOG.md` — Confirms Drawer shipped in v1.2.0 and was promoted stable in v1.3.0; confirms no Dialog breaking changes in 1.3.0→1.4.1
- `src/components/search/FilterSheet.tsx` — Current `WatchFacetSheet` props interface and render structure (direct codebase read)
- `src/components/profile/ProfileWatchCard.tsx` — Current card layout, `isWishlistLike` logic, wear badge pattern (direct codebase read)
- `src/components/profile/CollectionTabContent.tsx` — Filter-row structure, empty-state branches (direct codebase read)
- `src/components/profile/WishlistTabContent.tsx` — `OwnerWishlistGrid`, DnD setup, `AddWatchCard` placement (direct codebase read)
- `src/lib/storage/catalogSourcePhotos.ts` — Bucket helper pattern (direct codebase read)
- `supabase/migrations/20260430000001_phase19_1_catalog_source_photos_bucket.sql` — RLS policy template (direct codebase read)
- `src/lib/exif/strip.ts` — `stripAndResize` API (direct codebase read)
- `src/lib/extractors/llm.ts:78` — Deprecated model ID confirmed as `claude-sonnet-4-20250514` (direct codebase read)
- `src/app/actions/profile.ts` — `updateProfile` schema confirmed accepts `avatarUrl: z.string().url()` (direct codebase read)
- npm registry — `@base-ui/react` latest 1.4.1; `react-easy-crop` latest 5.5.7, peerDeps `react>=16.4.0`

### Secondary (MEDIUM confidence)

- `base-ui.com/react/components/drawer` (WebFetch) — Component tree structure, CSS variables, `swipeDirection` prop, backdrop dismiss behavior
- `github.com/ValentinH/react-easy-crop` (WebFetch) — `cropShape="round"` API, `onCropComplete` second-argument usage, touch support

### Tertiary (LOW confidence)

None — all claims in this document are verified against official sources or direct codebase reads.

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — versions verified via npm registry and node_modules
- Architecture: HIGH — based on direct codebase reads of all named files
- Pitfalls: HIGH — PLSH-04 height pitfall documented in project memory; others derived from direct code inspection
- Base UI Drawer API: HIGH — verified against installed type definitions and CHANGELOG
- react-easy-crop API: MEDIUM — verified against GitHub README + npm (403 on npmjs.com)

**Research date:** 2026-05-16
**Valid until:** 2026-06-15 (stable libraries; Base UI changelog checked)
