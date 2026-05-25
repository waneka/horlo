# Phase 56: Like UI - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

A `LikeButton` client island wired into the **watch detail page** (`/watch/[id]`) and the
**wear detail page** (`/wear/[wearEventId]`) so any authenticated viewer can like/unlike individual
watches and wear posts, with optimistic toggle + rollback and an inline count hidden at zero.
Requirements: **LIKE-01, LIKE-02, LIKE-03, LIKE-04**.

This phase also carries a **user-directed redesign of the wear detail page layout** to host the new
control coherently (overlays on the photo, thumbnail removal, a footer action row). This is a
*presentation* change (no new capability) — it is the like control's home, not new functionality.

**In scope:**
- A single `LikeButton` component (icon-only `Heart`, fill-toggles, inline count) reused on both pages.
- Server hydration of initial `{ count, viewerHasLiked }` via `getLikesForTarget`, with the
  Phase-55 cache tags attached (`reactions:{type}:{id}` + `viewer:{userId}:reactions`) so the
  already-wired `revalidateTag`/`updateTag` in `toggleLikeAction` actually invalidate the read.
- Watch page: place the control inside `WatchDetail` (under brand/model title).
- Wear page redesign: avatar+username+timestamp overlay top-left; brand/model overlay bottom-left;
  remove the watch thumbnail; note as a caption below the photo; a footer action row =
  `[reserved comment-input space] [like icon, right]`.
- Anon-on-wear handling: heart + count visible, click → `/login?next=<path>`.

**Out of scope (later phases):**
- The actual comment compose box / thread (Phase 57) — Phase 56 only **reserves layout space** in the
  wear footer row; it builds no comment input.
- Profile-grid "X likes · Y comments" badge (DISP-01, Phase 57).
- Bell/inbox rendering of like notifications, the "X and N others" grouping, Settings opt-out
  (Phase 58).
- No Server Action, DAL, or migration changes — Phase 55/54/53 are consumed as-is.

</domain>

<decisions>
## Implementation Decisions

### Control form & count (Area: Control form / Count format)
- **D-01:** **Icon-only lucide `Heart` whose fill toggles** — outline when not liked, filled when liked.
  Universal convention, smallest footprint, pairs with an inline count. (`Heart`/`HeartOff` confirmed
  available in `lucide-react`; not used anywhere else yet.) **Rejected:** Heart + text label (heavier,
  wider); color-only toggle (too subtle).
- **D-02:** **Inline bare number** to the right of the heart, e.g. `♥ 12` — no "like(s)" word, no
  pluralization logic, language-neutral. **Hidden when count is zero** (LIKE-04, locked).
  **Rejected:** "12 likes" word form; count as secondary/caption text.
- The **exact liked-state color** (accent vs destructive/red) is deliberately deferred to the
  UI-SPEC (`/gsd-ui-phase 56`) — see Specific Ideas.

### Placement (Area: Watch place / Wear place)
- **D-03:** **Watch page** — control sits **inside `WatchDetail`** (a `'use client'` island), under the
  brand/model title block, visible to **every** viewer. It is **separate** from the owner-only
  Edit/Delete actions row. `WatchDetail` gains `viewerId` + initial `{ liked, count }` props.
  **Rejected:** a standalone server-page sibling row (visually detached from the watch identity).
- **D-04:** **Wear page footer action row** — below the photo (and below the note caption) render a
  single row: a **reserved, mostly-full-width comment-input slot on the left** and the **like icon on
  the right**. Phase 56 builds only the like icon; the comment input is empty reserved space that
  **Phase 57** fills. **Rejected:** like in the collector row / directly under the photo (the footer
  reads as the post's engagement action).

### Wear-page redesign (user-directed, Area: Other → redesign)
- **D-05:** **Avatar + username + relative timestamp overlay the photo, top-left** (e.g. "tyler · 2d").
  Keeps collector identity + recency together on the image.
- **D-06:** **Brand / model overlay the photo, bottom-left**, and the **watch thumbnail is removed** —
  the photo carries the watch identity now.
- **D-07:** **Note / caption renders below the photo**, above the footer action row; hidden when the
  note is null. **Rejected:** overlaying the note (clutter/legibility on long notes); dropping it.
- **D-08 (legibility constraint):** overlays require a **legibility scrim/gradient** and **must work on
  the no-photo / `watchImageUrl` fallback hero** (`WearDetailHero`), not just on signed wear photos.
  See [[feedback_ui_spec_css_chain_blind_spot]] — assert the aspect-ratio/object-fit + overlay CSS chain
  explicitly; a passing 6-pillar checker has shipped a broken chain on this codebase before (Phase 30).

### Visibility model (Area: Owner self / Anon wear)
- **D-09:** **Interactive for the owner too** — the owner can like their own watch/wear. Single render
  path, matches GATE-02 ("any authenticated viewer") and IG/X behavior; the self-like **notification is
  already suppressed** server-side (`ownerId !== user.id` in `toggleLikeAction`). **No self-hide branch.**
  **Rejected:** read-only count for owner; hide-entirely (mirrors FollowButton but hides the owner's own
  like count).
- **D-10:** **Anon viewer on a wear page** sees the heart + count; **click → `/login?next=<pathname>`**,
  exactly mirroring `FollowButton`'s anon handling. The watch page is auth-only so anon never reaches it.
  Net effect: `LikeButton` takes `viewerId: string | null` (same shape as `FollowButton`); `null` ⇒
  login bounce, non-null ⇒ optimistic toggle.

### Carried forward (locked by prior phases / house pattern — binding, not re-decided)
- **Optimistic mechanism:** `useState` + `useTransition` + **rollback-on-failure**, mirroring
  `src/components/profile/FollowButton.tsx` — deliberately **NOT `useOptimistic`** (the house pattern
  owns compound local state for clean rollback). `disabled={pending}` blocks double-fire.
- **Action contract (Phase 55 D-08):** `toggleLikeAction({ type, id })` →
  `ActionResult<{ liked: boolean; count: number }>`. The UI **reconciles to the server-confirmed
  `count`** after the transition (do not trust the optimistic increment as final).
- **Cache contract (Phase 55 D-07):** the action already fires
  `revalidateTag('reactions:{type}:{id}', 'max')` + `updateTag('viewer:{userId}:reactions')` +
  `revalidateTag('profile:{username}', 'max')`. **Phase 56 only attaches matching `cacheTag()`s on the
  server read that hydrates initial state — it never re-touches the action.**
- **Likes are open to all authenticated viewers on every status** incl. wishlist (GATE-02). Idempotency
  is the DB UNIQUE-constraint + `onConflictDoNothing` backstop (LIKE-05, Phase 53/54).

### Claude's Discretion
- Exact `cacheTag()` wiring mechanism for the initial-state read (a dedicated `'use cache'`-wrapped
  reader vs. tagging within the page) — planner picks per Next 16 Cache Components norms, honoring
  [[project_cc_audit_2026_05_21]] structural rules.
- Whether `LikeButton` is one shared component with a `target: { type, id }` prop (recommended) or two
  thin wrappers — planner's call; the action and DAL are already target-discriminated.
- Markup split for the wear-page overlay (extend `WearDetailHero`/`WearPhotoClient` with overlay
  children vs. a new overlay wrapper) — planner's call, subject to D-08.
- Final liked-state color token — defer to UI-SPEC.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — Phase 56 owns **LIKE-01, LIKE-02, LIKE-03, LIKE-04**. GATE-02
  (likes open to all authenticated, incl. wishlist) and LIKE-05 (UNIQUE-constraint idempotency) are
  complete and constrain this phase.
- `.planning/ROADMAP.md` §"Phase 56: Like UI" — the four success criteria are the verification contract
  (likeable on both pages regardless of status; reflects viewer state w/o reload + optimistic+rollback;
  count next to control, hidden at zero; double-/concurrent-like → exactly one row, no user-facing error).

### Locked backend contract (Phase 55 — read before wiring the button)
- `.planning/phases/55-server-actions-notification-dedup/55-CONTEXT.md` — **D-07** full cache-tag contract
  (Phase 56 only attaches matching `cacheTag()`s); **D-08** action return shapes (`{liked,count}`);
  the **"Naming reconciliation" landmine** (`'wear'` DAL discriminator ≠ `'wear_event'`).
- `src/app/actions/reactions.ts` — `toggleLikeAction(data: unknown)`; Zod `.strict()` accepts only
  `{ type: 'watch'|'wear', id: uuid }`; returns `ActionResult<{ liked, count }>`. The button calls this.
- `src/data/reactions.ts` — `getLikesForTarget(viewerId, target)` → `{ count, viewerHasLiked }` for
  server hydration; `LikeTarget = { type: 'watch'|'wear'; id }`. **Note signature expects
  `viewerId: string`** — the anon wear path (viewerId `null`) must pass a non-matching sentinel or be
  guarded so `viewerHasLiked` resolves false (flag for planner).

### Code precedent to mirror
- `src/components/profile/FollowButton.tsx` — **the optimistic-button template**: `useState` +
  `useTransition` + rollback; `viewerId: string | null` with `/login?next=` bounce on null;
  `disabled={pending}`, `aria-pressed`/`aria-busy`/`aria-label`. `LikeButton` clones this skeleton.

### Placement / redesign targets
- `src/components/watch/WatchDetail.tsx` — `'use client'` island; title block (brand/model ~L139-142),
  owner-only Edit/Delete row (~L186). D-03 adds the control under the title; gains `viewerId` + initial
  like-state props (threaded from the page's `getCurrentUser()` + a new `getLikesForTarget` read).
- `src/app/watch/[id]/page.tsx` — server hydration site (already does `getCurrentUser()` + `Promise.all`);
  add the `getLikesForTarget(user.id, {type:'watch', id})` read here and pass into `WatchDetail`.
  `isOwner` already computed (not needed to gate the button per D-09, but available).
- `src/app/wear/[wearEventId]/page.tsx` — **anon-allowed** (`viewerId: string | null`); composes the
  Suspense'd photo + `WearDetailMetadata`. Redesign rewires this tree; add `getLikesForTarget` hydration
  (handle null viewer per the note above).
- `src/components/wear/WearDetailMetadata.tsx` — being **gutted** by D-05/06/07 (its comment literally
  says "No engagement mechanics" — this phase introduces the first). Collector row → top-left overlay;
  watch row/thumbnail → removed (brand/model → bottom-left overlay); note → caption below photo.
- `src/components/wear/WearDetailHero.tsx`, `src/components/wear/WearPhotoClient.tsx`,
  `src/components/wear/PhotoSkeleton.tsx` — the photo render surfaces that must host the overlays and the
  **no-photo fallback** path (D-08).

### Research & pitfalls (concepts only)
- `.planning/research/ARCHITECTURE.md` §5 "Caching Strategy" — the optimistic-UI sketch + the
  `reactions:{type}:{id}` / `viewer:{userId}:reactions` tag taxonomy. **Caveat:** written in obsolete
  polymorphic `'wear_event'` terms; the live discriminator is `'wear'`.

### Codebase maps
- `.planning/codebase/CONVENTIONS.md`, `.planning/codebase/STRUCTURE.md`,
  `.planning/codebase/ARCHITECTURE.md` — naming, component grouping (`watch/`, `wear/`), and the
  client-island / server-sibling composition rules.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`FollowButton.tsx`** — near-complete structural template for `LikeButton` (optimistic toggle,
  `viewerId: string|null` + login bounce, rollback, a11y attributes, `disabled={pending}`).
- **`lucide-react` `Heart` / `HeartOff`** — confirmed exported; `Heart` with a `fill` prop covers the
  outline↔filled toggle (D-01). No icon currently uses Heart, so no conflict.
- **`getLikesForTarget` (`src/data/reactions.ts`)** — single-query `{ count, viewerHasLiked }`; the only
  read the UI needs for hydration.
- **`cn()` (`src/lib/utils.ts`)** — conditional class composition, used by FollowButton.

### Established Patterns
- **Client island hydrated with server initial state** — the page resolves like-state on the server and
  passes `initial*` props (FollowButton's `initialIsFollowing` → LikeButton's `initialLiked`/`initialCount`).
- **`viewerId: string | null` + `/login?next=encodeURIComponent(pathname)`** on null (FollowButton L70-73).
- **Two-tag cache discipline** (Phase 39c / 55 D-07): cross-user `revalidateTag(..., 'max')` + RYO
  `updateTag(...)` — already in the action; Phase 56 attaches the matching `cacheTag()` to the read.
- **Server-sibling vs client-island composition** — RSCs cannot be imported into a `'use client'`
  island, but a client component (LikeButton) CAN be placed inside one (`WatchDetail`) or as a server
  sibling. D-03 puts it inside `WatchDetail`; the wear footer row can be a client island sibling.

### Integration Points
- **New:** `src/components/<watch|wear or shared>/LikeButton.tsx` (planner picks the home; shared is
  natural since both pages use it).
- **Edit:** `WatchDetail.tsx` (+props, render control under title); `watch/[id]/page.tsx` (+hydration read).
- **Restructure:** `wear/[wearEventId]/page.tsx` + `WearDetailMetadata.tsx` (+ `WearDetailHero`/
  `WearPhotoClient`) for the overlay redesign + footer action row + hydration read.

### Known landmines (carried into the code)
- **`'wear'` vs `'wear_event'`** — the DAL/action discriminator is `'wear'`. Do not let the research
  doc's `'wear_event'` leak into the `target` prop or the `reactions:wear:{id}` cache tag (Phase 55 landmine).
- **`getLikesForTarget(viewerId: string, …)` on the anon wear path** — viewerId is `null` for anon;
  guard or pass a sentinel so `bool_or(userId = …)` resolves `viewerHasLiked = false` without a type error.
- **Overlay-on-photo CSS chain** — aspect-ratio/object-fit + absolute overlays have shipped looking
  broken through a passing checker here ([[feedback_ui_spec_css_chain_blind_spot]], Phase 30). Assert the
  chain explicitly and verify after clearing `.next/` ([[project_turbopack_next_cache_stale_css]]).

</code_context>

<specifics>
## Specific Ideas

- **Liked-state color** is intentionally unspecified here — it's a UI-SPEC decision (`/gsd-ui-phase 56`).
- **SC#4 (double-/concurrent-like → exactly one row, no error shown):** satisfied by `disabled={pending}`
  (no double-fire in one tab, FollowButton precedent) + DB `onConflictDoNothing` idempotency +
  **reconcile to the server-confirmed `count`**. An idempotent re-like must **not** surface an error toast.
- **The wear-footer comment slot is empty reserved space in Phase 56** — sized/positioned so Phase 57 can
  drop the compose box in without re-layout. The like icon anchors the right of that row.
- **Wear redesign target layout:**
  `[photo: ○ user · 2d (top-left) / Brand Model (bottom-left)]` → `note caption` →
  `[ reserved comment input ……… ] ♥ N`.
- `LikeButton` should read like a `FollowButton` sibling so a reviewer diffing them sees the same shape.

</specifics>

<deferred>
## Deferred Ideas

- **Comment compose box + thread** (CMNT-01..09, Phase 57) — Phase 56 only reserves the wear-footer slot.
- **⚠ Cross-phase conflict to resolve in Phase 57:** the wear redesign places a comment **input** in the
  footer below the photo. There is an unresolved record conflict on comment ordering/compose placement —
  `STATE.md` says **newest-first, compose box above the list** (operator decision 2026-05-22) while
  `REQUIREMENTS.md` CMNT-03 says **oldest-first, compose box below the list**. Phase 57 must reconcile this
  AND fit it to the footer slot reserved here. Not a Phase 56 decision.
- **Profile-grid like/comment counts** (DISP-01) — Phase 57; the action already invalidates
  `profile:{username}` so the badge will refresh once it exists.
- **Liker-avatar strip / who-liked list, reply fan-out, @mentions** — `REQUIREMENTS.md` §Future
  (SOC-F1…F5). Not this milestone.

</deferred>

---

*Phase: 56-like-ui*
*Context gathered: 2026-05-22*
