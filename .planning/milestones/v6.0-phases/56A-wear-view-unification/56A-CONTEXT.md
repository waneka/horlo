# Phase 56a: Wear View Unification - Context

**Gathered:** 2026-05-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Restructure the two disconnected wear-viewing surfaces into **two purpose-built routes** that share one wear-content card, one `LikeButton`, and one comment host — so engagement (likes now, comments in Phase 57) is reachable while browsing instead of stranded on the orphan `/wear/[id]` permalink. This lands **before** Phase 57 because the comment component must render in both hosts via shared component contracts.

- **`/wears/[username]`** — STORIES lane. Full-screen, no nav chrome, viewport-fit (no page scroll). Swipe through a user's active wears (~48h), then advance user→user. Reels model: engagement is INLINE (comments open in a bottom sheet over the photo; swipe paused while open).
- **`/wear/[id]`** — DETAIL permalink. Conventional: keeps nav bars, vertically scrollable, no swipe, single wear, inline comment list. Reached by direct URL / share / notification deep-link.

**Locked before this discussion** (from `/gsd-explore` 2026-05-23 — see canonical refs):
- **D-A** Two routes, not a collapse. **D-B** Reels inline engagement (never route away to act). **D-C** Comments = bottom sheet (stories) / inline list (detail). **D-D** Intentional layout divergence; **D-E** consistency enforced by shared content/engagement components (container chrome is the only divergence).
- **EN→surface mapping**: EN-1/EN-5 → `/wears/[username]` only; EN-2/EN-3/EN-4 → fold into the shared wear card (both routes inherit); EN-6 (dead `__anon__` cleanup) → anytime, both routes auth-only.
- **SC#5**: the legacy `WywtOverlay`/`WywtSlide` client modal (URL stuck on `/`) is replaced by the routed `/wears/[username]`.

**Not in scope:** the comment thread component itself (Phase 57), feed/grid comment surfacing (Phase 57), notification UI (Phase 58).

</domain>

<decisions>
## Implementation Decisions

### Route transition
- **D-01:** Each story slide in `/wears/[username]` exposes a **share / overflow ("…") control** that copies/opens that wear's `/wear/[id]` permalink. This is the in-app path to the shareable permalink. The existing card links stay: avatar/username → `/u/[username]`, brand/model → `/watch/[id]`.
- **D-02:** When `/wear/[id]` is opened from inside the app, it uses **plain full-page navigation** — NOT Next.js intercepting/parallel routes. Matches the locked "conventional nav-retaining, vertically-scrollable page" decision; avoids a second render path. (Fork #4 resolved: no `@modal` + `(.)wear/[id]`.)
- **D-03:** `/wear/[id]` offers entry into the swipe lane **only via the avatar/username link** (→ `/u/[username]` profile). No dedicated "View in stories" control. The home rail is the natural entry to stories.

### Stories lane scope (`/wears/[username]`)
- **D-04:** Active-window rule = **keep ~48h**, matching `getWearRailForViewer` (48h cutoff). One definition of "active" shared between rail and stories — do not introduce a second window.
- **D-05:** When a user has multiple active wears, slides play **oldest-first (chronological)**. Planner note: the rail tile shows the *most-recent* wear, so to avoid a jarring jump backward, drive the lane with the existing `useViewedWears` state — **open at the oldest UNVIEWED wear and play forward** (oldest→newest) rather than always starting at the absolute oldest.
- **D-06:** Swiping user→user **traverses the home rail's user order, with the viewer's own lane included if present** (mirrors the existing rail self-tile). `/wears/[you]` is a valid route.
- **D-07:** When `/wears/[username]` has **no active wears** (stale/aged-out ephemeral link), **redirect to `/u/[username]`** (the durable profile). The rail never links here, so this only hits stale/manual URLs.

### Add-to-wishlist fate
- **D-08:** Relocate the existing `addToWishlistFromWearEvent` action **into the overflow ("…") menu** alongside the share/copy-link control (D-01). It lives on **both routes** via the shared card — keeps the immersive photo uncluttered while preserving the one-tap-from-a-wear path.
- **D-09:** **Hide Add-to-wishlist when it doesn't apply** — on the viewer's own wears, and on watches already owned or already on the wishlist. Planner note: today's `WywtSlide` does NOT gate this; an ownership/wishlist-membership check is needed.

### Comment slot scope (Phase 57 hand-off)
- **D-10:** 56a builds the **full comment HOST chrome + trigger with an empty placeholder body** ("No comments yet"). Stories host = the bottom-sheet (open/close, swipe-pause while open, over-photo positioning, keyboard handling). Detail host = the inline section container. The comment trigger (icon) is wired in both. **Phase 57 drops the shared comment component into the (already-built) body** — the hard immersive-sheet mechanics ship and get tested WITH this route. Rationale: 56a ships/verifies to prod before 57, so the host must be self-consistent without the component.
- **D-11:** Stories engagement layout = **bottom action row over the photo holding like + comment trigger** (mirrors the existing footer action row on `/wear/[id]` → maximizes shared chrome), with the **share / add-to-wishlist "…" overflow in the top-right corner** (where the close affordance lives). Not the right-edge vertical rail.

### Shared component contract (locked direction, restated for planner)
- **D-12:** Exactly one wear-content card, one `LikeButton` (already shared, Phase 56), one comment host component — **both routes render these**. Divergence is limited to container chrome (immersive full-screen + bottom-sheet vs. nav-retaining scrollable page + inline section). The shared card already exists in seed form as `WearPhotoOverlays` (avatar/username/timestamp top + brand/model bottom) in `WearDetailHero.tsx`; EN-2/3/4 fold into it.

### Claude's Discretion
- Component extraction/naming for the shared wear card (e.g., factoring a `WearCard` out of `WearPhotoOverlays` + `WearPhotoClient`) — planner decides.
- New DAL shape for per-user active wears feeding `/wears/[username]` (the current `getWearRailForViewer` is most-recent-per-actor across followings; the lane needs ALL of one user's active wears) — planner/researcher decides.
- Photo signed-URL minting strategy for the swipe lane (per-request, never cached — Pitfall F-2 carry-forward) — follow the existing pattern.
- Add-to-wishlist success/error feedback style when moved into a menu (toast vs inline) — planner decides; preserve the existing double-submit guard semantics.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Decision direction (read first — these LOCK the build)
- `.planning/seeds/wear-view-unification.md` — full build direction: two-route model, shared core, EN-1..6 reconciliation, sequencing before Phase 57.
- `.planning/notes/wear-view-unification-decisions.md` — decision log (D-A..E) + EN→surface mapping table + root-cause finding (orphan permalink).
- `.planning/research/questions.md` § "Wear View Unification (Phase 56a)" — the four open forks (now resolved in `<decisions>` above as D-01..D-11).

### Phase definition + UAT source
- `.planning/ROADMAP.md` § "Phase 56a: Wear View Unification" — goal + 5 success criteria.
- `.planning/phases/56-like-ui/56-HUMAN-UAT.md` — source of EN-1..EN-6 polish notes (do NOT fix piecemeal; they split across the two surfaces per the mapping).

### Implementation precedent (Phase 56 likes)
- `src/app/wear/[wearEventId]/page.tsx` — the detail route to be unified; already has the footer action row + `LikeButton` + reserved comment slot + signed-URL streaming pattern.
- `src/components/wear/WearDetailHero.tsx` — contains `WearPhotoOverlays` (the shared overlay seed: avatar/username/timestamp + brand/model) imported by `WearPhotoClient.tsx`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`WearPhotoOverlays`** (`src/components/wear/WearDetailHero.tsx`): the seed of the shared wear-content card overlay (top avatar/username/timestamp, bottom brand/model, gradient scrims, `hasPhoto` text-color switch). EN-2/3/4 fold in here; both routes inherit.
- **`WearPhotoClient`** (`src/components/wear/WearPhotoClient.tsx`): signed-URL `<img>` + 3-retry CDN-propagation state machine + overlay render. Native `<img>` not `next/image` (Pitfall F-2). Reusable as the card's photo layer for both routes.
- **`LikeButton`** (`src/components/shared/LikeButton.tsx`): already shared, optimistic toggle, anon→`/login?next=` bounce, count hidden when 0. Drops into both routes' engagement rows unchanged.
- **`WywtRail` / `WywtTile`** (`src/components/home/`): the home entry strip stays. Tile tap currently calls `openAt()` → opens `WywtOverlay`; this must change to **navigate to `/wears/[username]`** (positioned at the tapped wear). Self-placeholder → `WywtPostDialog` flow is unchanged (out of scope).
- **`useViewedWears`** (`src/hooks/useViewedWears.ts`): per-`wearEventId` viewed-state in localStorage — drives D-05's "open at oldest unviewed".
- **`getWearRailForViewer`** (`src/data/wearEvents.ts:317`): 48h cutoff, most-recent-per-actor, ordered `wornDate DESC, createdAt DESC`. Defines the rail's user order (D-06) and the 48h window (D-04). A NEW per-user "all active wears" read is needed for the lane.
- **`getWearEventByIdForViewer`** (`src/data/wearEvents.ts:246`) + `getLikesForTargetCached` (`src/data/reactions.ts`): the detail route's existing reads; the lane will need analogous per-wear like state.
- **`addToWishlistFromWearEvent`** (`src/app/actions/wishlist.ts`): the wishlist action to relocate into the overflow menu (D-08) with applicability gating (D-09).

### Established Patterns
- Both wear routes are **auth-only / proxy-gated** → the `__anon__` sentinel and null-bounce branches in `/wear/[id]` are dead code (EN-6) and can be removed.
- Signed wear-photo URLs are minted **per-request, never cached** (Pitfall F-2) — both `page.tsx` (home) and `/wear/[id]` follow this; the lane must too.
- 4:5 portrait aspect, full-bleed on mobile, `md:max-w-[600px] md:mx-auto` on desktop is the current detail-photo convention.

### Integration Points
- **Home rail → stories**: `WywtRail.openAt()` changes from "open overlay" to "navigate to `/wears/[username]`".
- **Delete after migration** (SC#5): `WywtOverlay.tsx` and `WywtSlide.tsx` are replaced by the routed lane — remove once the lane renders the shared card + engagement.
- **Phase 57 seam**: the comment host body (bottom-sheet content + inline section content) is the single insertion point for the shared comment component.

</code_context>

<specifics>
## Specific Ideas

- Reels/stories mental model is the explicit reference for `/wears/[username]`: full-bleed photo, inline like + comment, bottom-sheet comments that pause the swipe — but the chrome split is **bottom engagement row + top-right "…" overflow** (D-11), NOT a TikTok right-edge vertical rail.
- The "consistency guarantee" is the shared card + LikeButton + comment host — divergence is *only* container chrome (D-12).

</specifics>

<deferred>
## Deferred Ideas

- **Desktop layout for `/wears/[username]`** — mobile full-screen/no-nav is locked (SC#2); desktop centered-column vs full-viewport is unspecified. → resolve in `gsd-ui-phase` (phase has UI hint = yes).
- **Stories per-wear progress segments / ring-progress UI** — classic stories progress bars at top. → `gsd-ui-phase` polish, not a 56a blocker.

None of the above expand 56a scope — they are UI-design refinements for the UI-SPEC step.

</deferred>

---

*Phase: 56a-Wear View Unification*
*Context gathered: 2026-05-23*
