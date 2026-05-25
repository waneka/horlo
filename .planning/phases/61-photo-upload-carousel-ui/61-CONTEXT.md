# Phase 61: Photo Upload + Carousel UI - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

The **UI layer** for owner-managed watch photos on the unified `/w/[ref]` detail page, plus a first-class photo-upload step in the add-watch flow. Builds on Phase 60's schema + DAL + storage helper + EXIF pipeline.

Delivers (PHOTO-02/03/05/06/09):
- A carousel showing one photo at a time, navigable by arrows + swipe (`embla-carousel-react`).
- An always-on thumbnail filmstrip under the carousel: tap-to-jump for everyone; an owner-only **Edit-photos toggle** that turns on add / delete / drag-reorder inline.
- Multi-select upload (HEIC→JPEG, EXIF-strip, ≤1080px) routed through the Phase 60 storage helper + server action, respecting the 10-photo cap.
- Drag-reorder on the filmstrip that sets the cover/thumbnail across grids and rails.
- Per-photo delete.
- A prominent, friction-to-skip **"Add your photos" step** in the add-watch flow.

**UI only.** No schema changes. No public wear-pic surfacing (that's Phase 62 — the carousel here is **owner uploads only**, with the catalog stock image as a read-only fallback slide). No detail-page IA redesign (Phase 64).

**Requirements:** PHOTO-02 (upload one or more), PHOTO-03 (carousel one-at-a-time, arrows + swipe), PHOTO-05 (drag-reorder sets cover), PHOTO-06 (delete a photo), PHOTO-09 (add-watch prominent affordance).

</domain>

<decisions>
## Implementation Decisions

### Management Surface (where owner controls live)
- **D-01:** Carousel stays the **clean viewing surface** for all viewers. Owner controls live on an **always-on thumbnail filmstrip** beneath the carousel — **no modal/sheet.** (The "manage sheet" idea floated early in discussion was superseded by the inline-filmstrip decision below.)
- **D-02:** The filmstrip is visible to everyone as **tap-to-jump navigation** (tapping a thumbnail moves the carousel to that slide). The owner additionally gets an **"Edit photos" toggle** near the filmstrip:
  - **Off** (default) → clean viewing + tap-to-jump only.
  - **On** → each thumbnail shows a delete **×** badge; a trailing **"+ Add"** tile appears; drag-reorder becomes active.
- **D-03:** Owner-only affordances are gated on `viewerCanEdit` (the existing `WatchDetail` prop fed by `isOwner`). Non-owners never see the Edit toggle, +Add tile, ×, or drag handles. Server actions must double-verify ownership (DAL already does — `addWatchPhoto`/`deleteWatchPhoto` check `watches.user_id`).

### Reorder (PHOTO-05)
- **D-04:** Drag-reorder happens **on the filmstrip** (in Edit mode) using `@dnd-kit/core` + `@dnd-kit/sortable`, mirroring the Phase 27 wishlist reorder pattern — **dual Mouse + Touch sensors** (activation constraints are mutually exclusive on one sensor) and **`touchAction: 'manipulation'`** on the draggable (without it iOS Safari claims the long-press as scroll). See `SortableProfileWatchCard` / `WishlistTabContent`.
- **D-05:** **GAP — no reorder DAL function exists.** Phase 60 shipped `addWatchPhoto` + `deleteWatchPhoto` only. This phase must build a **bulk reorder helper** (full integer `sort_order` rewrite per Phase 60 D-03) in `src/data/watches.ts` **and** a server action, mirroring `reorderWishlist` (`src/app/actions/wishlist.ts`). This is the single biggest net-new server-side piece in an otherwise UI phase.
- **D-06:** Reorder uses **optimistic update** (mirror `reorderWishlist`'s `useOptimistic`/transition), with a **toast on save** ("Order updated"). On failure, revert + error toast.

### Cover Feedback (PHOTO-04 surfacing, PHOTO-05)
- **D-07:** The **first filmstrip thumbnail always carries a small "Cover" badge.** The badge moves with the first position as you drag — the cover rule is self-evident and persistent, no transient explainer needed. (Cover itself is computed at read by the Phase 60 DAL: lowest `sort_order`; D-04/D-05 of Phase 60.)
- **D-08:** No separate "Make cover" button — drag-to-first IS the cover-setting gesture (kept minimal; option to add an explicit action was declined).

### Carousel Contents (PHOTO-03)
- **D-09:** When a watch has **zero owner uploads but a catalog `imageUrl` exists**, the carousel shows the **catalog stock image as its single slide** — the detail page is never empty (matches today's single-image behavior). No "catalog/stock" label on it (declined). Once the owner uploads ≥1 photo, the carousel shows **owner photos only** and the catalog fallback drops out.
- **D-10:** Cover fallback chain stays the Phase 60 contract (owner `[0]` → catalog `imageUrl` → placeholder, D-05). The carousel is the visual expression of "owner photos, else catalog fallback slide, else empty/placeholder."
- **D-11:** Carousel uses **`embla-carousel-react`** (already a dependency) for one-at-a-time + swipe + arrows. Position indicator (dots/index) for orientation. **Owner photos only** in Phase 61 — the public-wear-pic *union into the carousel* is explicitly Phase 62 (Phase 60 D-02: union-at-read).

### Upload Input (PHOTO-02)
- **D-12:** File input gets **`multiple`** so the owner picks several photos at once. Each file routes through the existing inherited pipeline: HEIC→JPEG (worker) → `stripAndResize` (EXIF strip + ≤1080px JPEG @0.85) → `uploadWatchPhoto` (client-direct upload) → `addWatchPhoto` server action records the row.
- **D-13:** **Desktop also gets a drag-and-drop zone** (new pattern in this app, but standard). Mobile relies on the OS picker — `accept="image/*,.heic,.heif"` with **no forced `capture` attr** (matching `wywt/PhotoUploader` + `CatalogPhotoUploader`), so the OS offers camera-or-library and the owner chooses.
- **D-14:** **Cap enforcement is UI + DAL.** When at/near the 10-photo cap, the **+Add tile is hidden/disabled with a clear message** (SC4: "cap affordance is visibly blocked"). A batch selection exceeding the remaining slots accepts up to the cap and **rejects the extras with a message** (don't silently drop). The DAL's `PhotoCapExceededError` is the backstop.

### Add-Watch Nudge (PHOTO-09)
- **D-15:** Insert a **dedicated "Add your photos" step** in the `AddWatchFlow` state machine — placed **after the watch is identified (verdict shown) and before final commit.** A big drop zone / picker as a first-class screen, not a buried field. Works for both the URL-extract and manual-entry paths.
- **D-16:** **Skippable with friction.** Primary CTA = "Add photos"; **"Skip for now"** is a smaller, secondary, lower-contrast link — clearly the lesser path, but it **never blocks saving** (a watch is never truly imageless thanks to the catalog fallback). Once the owner adds ≥1 photo, the primary button becomes "Continue." No extra confirm-on-skip dialog (option declined).

### Claude's Discretion (decided here, open to planner refinement)
- Exact toast copy ("Order updated", "Photo deleted", cap-reached message), per-photo upload progress/spinner UX, and delete confirmation pattern (a `Dialog` confirm already exists in `WatchDetail` for whole-watch delete — per-photo delete can be lighter, e.g., immediate with undo toast, or a small confirm — planner's call).
- Whether the add-watch step reuses the exact detail-page filmstrip/upload component or a leaner add-flow variant — planner picks based on component fit. Reuse the upload mechanics either way (D-12/D-13).
- Embla position-indicator style (dots vs. "2/7" counter) and arrow styling.
- Whether the filmstrip wraps/scrolls horizontally at higher photo counts (≤10 photos → likely a single scrollable row).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope
- `.planning/ROADMAP.md` "Phase 61: Photo Upload + Carousel UI" (lines 222–233) — goal + 5 success criteria + "UI hint: yes".
- `.planning/REQUIREMENTS.md` §"Multi-Photo Model + Carousel — `PHOTO`" (lines 31–39) — PHOTO-02/03/05/06/09 in scope this phase; PHOTO-01/04/07/08 already shipped in Phase 60.

### Phase 60 contract (what this UI sits on — READ FIRST)
- `.planning/phases/60-multi-photo-schema-dal/60-CONTEXT.md` — the authoritative schema/DAL/storage decisions. Especially: D-02 (wear-pic union is Phase 62, NOT here — carousel is owner-only now), D-03 (integer `sort_order`, full-rewrite reorder), D-04/D-05 (computed cover + fallback chain), D-12/D-13 (cap=10 in DAL, `PhotoCapExceededError`), D-15/D-16 (reuse `stripAndResize`).
- `src/data/watches.ts` — `addWatchPhoto` (line ~567; takes `(userId, watchId, storagePath)`, cap-checks, computes next `sort_order`), `deleteWatchPhoto` (line ~676). **No reorder fn exists — build one here (D-05).** Cover join lives in `getWatchesByUser` (~145) and `getWatchById*`; `Watch.imageUrl` is now the computed cover (Phase 60 D-08).
- `src/lib/storage/watchPhotos.ts` — `buildWatchPhotoPath` + `uploadWatchPhoto` (client-direct upload, `{userId}/...` RLS folder scoping). The upload helper to call.
- `src/lib/exif/strip.ts` — `stripAndResize(blob, maxDim=1080, quality=0.85)`; EXIF strip + ≤1080px JPEG re-encode. Reuse verbatim (do not rebuild).

### UI surfaces this phase modifies
- `src/app/w/[ref]/page.tsx` (510 lines) — the unified detail route (Server Component; resolves `isOwner`, `viewerCanEdit`, viewer/owner framing). Feeds `WatchDetail`.
- `src/components/watch/WatchDetail.tsx` — renders the **single square image** today (lines ~128–143, `safeUrl = getSafeImageUrl(watch.imageUrl)`); Phase 61 **replaces that block** with the carousel + filmstrip. Has `viewerCanEdit` prop (line ~82) gating owner UI; existing whole-watch delete `Dialog` pattern (~229) is a confirm precedent.
- `src/app/watch/new/page.tsx` (154 lines) — add-watch Server Component root; renders `AddWatchFlow`.
- `src/components/watch/AddWatchFlow.tsx` — the `FlowState` state machine (paste/extract → verdict → save). **Insert the "Add your photos" step here** (D-15). See `src/components/watch/flowTypes.ts` for `FlowState`/`RailEntry`, and `WatchForm.tsx` / `VerdictStep.tsx` for the surrounding steps.

### Reusable patterns (mirror, don't reinvent)
- `src/components/profile/SortableProfileWatchCard.tsx` + `src/components/profile/WishlistTabContent.tsx` — the **Phase 27 dnd-kit reorder precedent**: `DndContext`, dual `MouseSensor`+`TouchSensor` (`useSensors`), `SortableContext`, `useOptimistic`/`useTransition`, `touchAction: 'manipulation'` gotcha, quick-tap-vs-drag activation thresholds. Template for D-04/D-06.
- `src/app/actions/wishlist.ts` → `reorderWishlist` — the bulk-reorder **server action** template for the new photo-reorder action (D-05). `bulkReorderWishlist` in `src/data/watches.ts` (~433) is the DAL bulk-rewrite precedent.
- `src/components/wywt/PhotoUploader.tsx` + `src/components/watch/CatalogPhotoUploader.tsx` — the **upload-input pattern**: hidden `<input type="file" accept="image/*,.heic,.heif">`, programmatic `.click()` from a user-gesture handler, HEIC→worker→`stripAndResize` pipeline. Extend to `multiple` + drop zone (D-12/D-13).

### Libraries (already installed — no new deps expected)
- `embla-carousel-react` `^8.6.0` — carousel (PHOTO-03). `@dnd-kit/core` `^6.3.1` + `@dnd-kit/sortable` `^10.0.0` + `@dnd-kit/utilities` — reorder (PHOTO-05). `sonner` (`toast`) — already used by reorder.

### Load-bearing gotchas (MEMORY)
- `feedback_mobile_ui_verify_on_prod` — mobile/visual behavior (swipe, drag on iOS, filmstrip touch) is confirmed by the user on **prod**, not locally (local e2e skips on empty test DB). Classify device behavior `human_needed`, build-gate, bundle into one deploy.
- `project_baseline_not_green_build_is_gate` — `npm run build` (exit 0) is the authoritative gate; ignore pre-existing tsc/test noise (incl. the CommentGateLocked font-medium failure).
- `feedback_execute_phase_no_worktree_when_db` / `project_next_clear_operational_debt` — `workflow.use_worktrees=false` is set globally (build-gated, DB-backed RSC routes need `.env.local`).
- `project_router_cache_stale_instance` — Next 16 restores the SAME stale client component instance on revisited dynamic `/w/[ref]` URLs; reset one-shot UI state (e.g., the Edit toggle, carousel index) on **interaction (onPointerDown)**, not mount. Directly relevant to a stateful carousel/filmstrip on a dynamic route.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`embla-carousel-react`** (installed) — one-at-a-time + swipe + arrows carousel for PHOTO-03; no new dep.
- **dnd-kit + Phase 27 reorder stack** (`SortableProfileWatchCard`, `WishlistTabContent`, `reorderWishlist`, `bulkReorderWishlist`) — the complete drag-reorder + optimistic + bulk-DAL-rewrite template for PHOTO-05.
- **`stripAndResize` + `uploadWatchPhoto`** (Phase 60 / v3.0) — the upload pipeline; client strips/resizes then client-direct uploads; server action records the row via `addWatchPhoto`.
- **`PhotoUploader` / `CatalogPhotoUploader`** — file-input + HEIC + gesture-handler pattern to extend with `multiple` + drop zone.
- **`WatchDetail.viewerCanEdit`** — existing owner-gating prop; the carousel/filmstrip owner controls hang off it.

### Established Patterns
- **Server Component page → client component** : `/w/[ref]/page.tsx` (RSC, resolves owner/viewer) hands `WatchDetail` (client) the data + `viewerCanEdit`. Carousel/filmstrip is a new client component nested in `WatchDetail`.
- **Optimistic mutation + toast** (`reorderWishlist`, `sonner`) — apply to reorder + delete.
- **Owner gate is defense-in-depth** : UI hide (`viewerCanEdit`) + server action ownership re-check + DAL `watches.user_id` guard.
- **Cap is UI-visible + DAL-enforced** : disable/hide the +Add affordance at cap; `PhotoCapExceededError` backstop.

### Integration Points
- `WatchDetail` image block (the single `<Image>`) → replaced by `<Carousel + Filmstrip>`.
- New `reorderWatchPhotos` server action + DAL helper → `src/app/actions/watches.ts` + `src/data/watches.ts`.
- `AddWatchFlow` `FlowState` → new "photos" step between verdict and commit.
- The cover the carousel/reorder sets flows back out through the Phase 60 computed-cover read → grid/rail thumbnails update everywhere (`Watch.imageUrl` contract, no reader churn).

</code_context>

<specifics>
## Specific Ideas

- **Filmstrip-as-hub** is the deliberate spine of the design: it's the navigation for everyone AND the owner's add/delete/reorder surface (via an Edit toggle) — instead of a separate manage modal. Viewing stays as clean as a visitor's, editing is one toggle away.
- **Drag-to-first IS make-cover**, with a persistent moving "Cover" badge — the rule teaches itself; no separate cover button, no transient-only explanation.
- **Catalog image as fallback slide** (no "stock" label) — the page is never empty, but the owner's own uploads cleanly take over once present.
- **Add-watch photo step is a real step, friction-to-skip** — "Add photos" primary, small "Skip for now" secondary; never blocks save. SC5's "prominent, not easily skipped" satisfied without trapping batch-adders.

</specifics>

<deferred>
## Deferred Ideas

- **Public wear-pic surfacing into the carousel + per-pic hide** — Phase 62 (WPIC-01..06). Phase 61's carousel is owner-uploads-only by design (Phase 60 D-02 union-at-read happens in 62).
- **Detail-page information-hierarchy redesign** (deliberate placement of carousel vs. specs vs. comments) — Phase 64. Phase 61 swaps the image block for the carousel in place, without re-architecting the page IA.
- **Per-account photo / storage quota** — PHOTO-F1 (future). v7.0 caps per-watch only.
- **In-app photo editing beyond capture crop** (filters, rotate, crop) — PHOTO-F2 (future).
- **Multi-photo extraction from URL import** — PHOTO-F3 (future); add-watch URL extract still pulls a single image, and the new photos step is for owner uploads on top of that.

### Reviewed Todos (not folded)
None — `todo.match-phase 61` returned 0 matches.

</deferred>

---

*Phase: 61-photo-upload-carousel-ui*
*Context gathered: 2026-05-25*
