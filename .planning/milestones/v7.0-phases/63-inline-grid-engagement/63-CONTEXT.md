# Phase 63: Inline Grid Engagement - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Add interactive **like** + a **lightweight compose-only comment box** to the profile collection/wishlist grid cards (`ProfileWatchCard`), so a viewer can like a watch and post a short comment **without opening `/w/[ref]`**. The card's like/comment counts update optimistically, and the GATE-03 wishlist mutual-follow comment gate is enforced per card.

Delivers GRID-01..05:
- GRID-01 — viewer can like a watch from a grid card (one tap, optimistic).
- GRID-02 — viewer can post a comment from a grid card via a lightweight inline composer (no detail nav).
- GRID-03 — the card's like + comment counts update optimistically after an inline like or comment.
- GRID-04 — the full comment **thread** is still only reachable by opening the detail page (inline is compose-only).
- GRID-05 — the GATE-03 wishlist mutual-follow gate is enforced per card; gated cards do **not** expose the composer.

**Not this phase:** the detail-page information-hierarchy / comment-placement redesign is **Phase 64** (PAGE-01..04). This phase adds engagement affordances onto the existing grid card; it does not re-architect the card layout or the detail page. The like/comment **data layer, server actions, and gate logic already exist** (v6.0 + Phase 62) — this phase surfaces them on the grid, it does not invent new social primitives.

</domain>

<decisions>
## Implementation Decisions

### Card Affordance Placement
- **D-01:** Engagement controls render as **overlay pill chips** (♥ + 💬) **on the image, bottom-left corner**, with a dark scrim (e.g. `bg-black/55`) + white icon+count. Bottom-left is clear of the existing badges (status/deal/gap are `absolute top-2 right-2`; wear badge is `absolute top-2 left-2` — `ProfileWatchCard.tsx:51-98`). Pill-with-scrim is chosen so legibility is **independent of the photo** (bright dials / white backgrounds / dark straps) — matches the existing badge language; avoids the CSS-chain contrast gap that has shipped through visual review before (MEMORY `feedback_ui_spec_css_chain_blind_spot`).
- **D-02 (nested-Link conflict):** The whole card is wrapped in `<Link href={`/w/${watch.id}`}>` today (`ProfileWatchCard.tsx:63`). The overlay chips sit over the image (inside the link DOM), so the chip click handlers MUST `preventDefault()` + `stopPropagation()` so tapping a chip likes/opens-composer **without navigating to detail**; tapping anywhere else on the card still opens detail. (Planner may instead restructure the link to wrap only the image+text and render chips as siblings — either is fine; the hard requirement is **chip-tap ≠ navigate**.)
- **D-03 (who sees chips):** Interactive chips render for **non-owner, authenticated viewers only**. The owner's own cards keep today's static count line (display-only) and show **no** interactive chips — this sidesteps the wishlist drag-reorder (`SortableProfileWatchCard`) tap-vs-drag (dnd-kit sensor) conflict and treats engagement as a visitor action.

### Like Affordance (GRID-01 / GRID-03)
- **D-04:** Reuse the existing optimistic like pattern from `LikeButton` (`src/components/shared/LikeButton.tsx`) — `useState` + `useTransition` + rollback + reconcile to server-confirmed count — but rendered as the overlay ♥ pill chip. The ♥ chip is **always present** for engageable viewers (so they can initiate a like); the count renders only when `count > 0 || liked` (mirror `LikeButton`'s zero-state). Likes are open to **all** authenticated viewers (GATE-02) — **no gate** on the ♥ chip, including foreign wishlist cards.
- **D-05:** Optimistic flip happens before the Server Action resolves; on success reconcile to the server-confirmed `{liked, count}`; on failure roll back **silently** (no user-facing error toast — idempotent re-like must not error; matches `LikeButton` `LIKE-04/SC#4`).

### Inline Comment Composer (GRID-02 / GRID-04)
- **D-06:** Tapping the 💬 chip opens a **bottom sheet** (reuse the **Phase 62 wear-pic-comment sheet** primitive). The sheet shows the **watch identity** (thumbnail + brand/model) + the existing `CommentCompose` (textarea + Post). It is **COMPOSE-ONLY** — no thread is rendered inline (GRID-04). Sheet vs grid-reflow: the sheet was chosen over inline-expand so the grid does **not** reflow and so the page's Cache Components structure stays undisturbed. Exact sheet/dialog primitive = planner's discretion.
- **D-07:** After Post **succeeds**: close the sheet, fire a **'Comment posted' toast** (`sonner` — mirror Phase 61/62), and **bump the card's 💬 count optimistically**. Reading the thread or adding more is done by tapping through to `/w/[ref]`.
- **D-08:** On Post **failure**: roll back the optimistic 💬 count bump and **keep the typed text for retry** (`CommentCompose` already retains `body` on failure; clear-on-success is the parent's job). Surface a failure toast.

### Gate Enforcement (GRID-05)
- **D-09:** The gate is **already implemented** — `canViewerCommentOnTarget` (`src/data/comments.ts:60`) and the `allowedSet` computation in `getBatchedWatchCounts` (`src/data/reactions.ts:245`). For a **non-mutual viewer on a foreign WISHLIST card** (GATE-05 fails): **hide the 💬 chip entirely** (the ♥ chip stays). No locked/teaser affordance. Comment count is already `0` for gated viewers (existing query behavior), so nothing teases unreachable content. (Owner is always allowed — GATE-04; non-wishlist + wear targets are open — GATE-01.)
- **D-10 (defense-in-depth):** The chip is hidden client-side via a per-card gate flag, **AND** `createComment` (`src/data/comments.ts:100`) re-checks `canViewerCommentOnTarget` server-side and throws `CommentGateError`. The **server action is the real gate** (RLS-subquery-caller gotcha — MEMORY `project_rls_subquery_caller_rls`); the hidden chip is UX, not security.

### Data Layer (technical — locked direction, planner owns shape)
- **D-11:** `getBatchedWatchCounts` / `getBatchedWatchCountsCached` (`src/data/reactions.ts:191` / `:316`) today return only `{ likeCount, commentCount }` per watch. Phase 63 MUST extend the batched result to also carry, per-viewer: **`liked`** (seeds each ♥ chip's `initialLiked`) and **`canComment`** (drives 💬 chip visibility / the GRID-05 gate). The follows queries + `allowedSet` (= `canComment`) **already exist** in this function — `canComment` is `allowedSet` membership. `liked` needs **one** added query (the viewer's `watch_likes` via `inArray(watchIds)`) — keep the constant query budget (≤~6, no N+1).
- **D-12 (cache):** `getBatchedWatchCountsCached` is `'use cache'`, **viewer-scoped** via the `viewer:${viewerId}:counts` tag (+ `profile:${username}`). A grid like/comment must bust **this viewer's counts tag** so a navigate-away/back shows fresh state (optimistic UI covers the immediate frame; the tag covers re-hydration). Confirm `toggleLikeAction` (`src/app/actions/reactions.ts`) and the comment-create action (`src/app/actions/comments.ts`) revalidate `viewer:{viewerId}:counts` — today the like action busts `viewer:{userId}:reactions` (see `reactions.ts:131` note); verify the **counts** tag is also busted. Do **NOT** introduce request-time APIs (auth/cookies/headers) inside the `'use cache'` scope (Next 16.2.3 forbids it) — auth stays resolved outside, as today.

### Claude's Discretion
- Exact chip styling (pill radius, scrim opacity, icon size), and bottom-left vs bottom-right if a collision emerges; whether the owner's display count stays as today's bottom line or also moves to a non-interactive overlay (lean: keep owner exactly as today).
- The specific sheet/dialog primitive for the composer (the Phase 62 one vs an existing dialog/sheet).
- Whether to refactor the whole-card `<Link>` (preventDefault on chips vs restructuring the link to image+text only) — as long as **chip-tap ≠ navigate**.
- Toast copy and optimistic-rollback specifics — mirror existing `sonner` patterns.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope
- `.planning/ROADMAP.md` — "Phase 63: Inline Grid Engagement" (goal + 5 success criteria + "UI hint: yes"; depends on Phase 59 only).
- `.planning/REQUIREMENTS.md` — GRID-01..05 (lines 56–60) + the scope-boundary table (lines 98–99: "Full comment thread inline in the grid card → Compose-only inline by design (GRID-04); reading the thread clicks through"; threaded replies / moderation / public liker lists / Realtime out per v6.0 scope).

### Cards this phase extends
- `src/components/profile/ProfileWatchCard.tsx` — the grid card. **The whole card is a `<Link href={`/w/${watch.id}`}>`** (line 63). Existing badges: status/deal/gap `top-2 right-2` (51), wear `top-2 left-2` (87). The static `♥ N · 💬 M` count line is at **117–136** (whole line hidden when both zero) — overlay chips supersede this for non-owner viewers (D-01/D-03).
- `src/components/profile/CollectionTabContent.tsx` + `src/components/profile/WishlistTabContent.tsx` — render `ProfileWatchCard`, receive `counts` + `isOwner`. **They do not currently receive `viewerId` or per-card `liked`/`canComment`** — Phase 63 threads those through (D-11). `WishlistTabContent` also renders `SortableProfileWatchCard` (owner drag-reorder) — chips are non-owner-only so they never collide with dnd-kit (D-03).
- `src/components/profile/SortableProfileWatchCard.tsx` — owner-only wishlist reorder wrapper (the drag-conflict surface D-03 avoids).

### Reusable engagement primitives (already built — reuse, don't reinvent)
- `src/components/shared/LikeButton.tsx` — the optimistic ♥ toggle pattern to mirror for the overlay chip (D-04/D-05). Note: `viewerId` is always non-null on `/u/*` (auth-gated, Phase 51 Branch B) — the anon-bounce branch won't fire here.
- `src/components/comment/CommentCompose.tsx` — textarea + Post (maxLength 500, char counter at ≥450); render this inside the bottom sheet (D-06). Retains `body` on failure (D-08).
- `src/components/comment/CommentThread.tsx` / `CommentList.tsx` — the FULL thread (detail-only; NOT used inline per GRID-04). Referenced only to confirm the compose-only boundary.
- `src/components/watch/WatchDetail.tsx` (188, 228–232) — the detail-page like/comment precedent; `LikeButton` is visible to all authenticated viewers there (D-09 reference).

### DAL + gate (read before touching the data layer)
- `src/data/reactions.ts` — `getBatchedWatchCounts` (191) and `getBatchedWatchCountsCached` (316, `'use cache'`, tags `profile:${username}` + `viewer:${viewerId}:counts`). The `allowedSet` (245) IS the per-card comment gate; the follows queries (226–238) already run. **Extend the return to add per-viewer `liked` + `canComment`** (D-11). Cache-tag busting note at line 131.
- `src/data/comments.ts` — `canViewerCommentOnTarget` (60, the SOLE enforced gate: wear open / owner allowed / non-wishlist open / foreign wishlist needs mutual-follow) and `createComment` (100, throws `CommentGateError` when gated — D-10).
- `src/app/actions/reactions.ts` — `toggleLikeAction` (the like Server Action; verify it busts the counts tag — D-12).
- `src/app/actions/comments.ts` — the comment-create Server Action (re-checks the gate; verify counts-tag bust — D-10/D-12).
- `src/app/u/[username]/[tab]/page.tsx` (366–388) — where counts are batched once per grid render (DISP-01). Phase 63 threads `viewerId` + per-card `liked`/`canComment` from here into the tab-content components. **Do NOT mark `ProfileTabContent` `'use cache'`** (Cache Components landmine, D-52-16 — the cached read is the wrapper function, not the RSC).

### Load-bearing gotchas (MEMORY)
- `project_router_cache_stale_instance` — reset one-shot UI state (sheet open, optimistic flip) on **interaction (onPointerDown)**, not on mount; `/u/[username]/[tab]` is a revisited dynamic route that restores stale client-component instances.
- `project_ppr_dynamic_before_use_cache` / **`unstable_instant = false` on `/u/[username]/[tab]` is PERMANENT** — do not re-enable, do not disturb the Cache Components structure (Phase 51/52). `getBatchedWatchCountsCached`'s `'use cache'` scope must stay free of request-time APIs.
- `feedback_mobile_ui_verify_on_prod` — sheet open/close, chip tap, and optimistic behavior are confirmed on **prod** (push → Vercel), not locally (empty test DB skips e2e). Classify device/touch behavior `human_needed`, build-gate, bundle into one deploy.
- `project_baseline_not_green_build_is_gate` — `npm run build` (exit 0) is the authoritative gate; ignore the ~77 pre-existing tsc test-file errors and the 1 pre-existing test failure.
- `project_rls_subquery_caller_rls` — the service-role DAL + the Server Action gate are the real comment gate; the hidden chip is UX only.
- `project_next_clear_operational_debt` — `workflow.use_worktrees = false` globally (build-gated, DB-backed RSC routes need `.env.local`).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`LikeButton`** (`shared/LikeButton.tsx`) — complete optimistic ♥ toggle (useState + useTransition + rollback + reconcile). Reuse its logic for the overlay chip; only the chrome changes (pill-on-image vs inline button).
- **`CommentCompose`** (`comment/CommentCompose.tsx`) — textarea + Post, 500-char cap, retains body on failure. Drop into the bottom sheet for the compose-only composer (D-06).
- **Phase 62 wear-pic comment sheet** — the bottom-sheet primitive to reuse for the grid composer (D-06); same "open a sheet, post, dismiss" interaction, now keyed to a watch target instead of a wear target.
- **`getBatchedWatchCounts` gate** (`reactions.ts:245`, `allowedSet`) — the per-card `canComment` answer already exists; the follows queries already run. Extend the return shape, don't rebuild the gate (D-11).
- **`canViewerCommentOnTarget` + `createComment`** (`comments.ts`) — server-side gate + insert; the grid composer calls the SAME comment-create action used by the detail page (D-10).

### Established Patterns
- **Optimistic mutation + `sonner` toast** — mirrored from Phase 61/62 (like, reorder, delete); apply to the grid like + the post-comment confirmation (D-05/D-07/D-08).
- **Batched, viewer-scoped, cached counts** (DISP-01 / `getBatchedWatchCountsCached`) — one query pass per grid render, cached under `viewer:${viewerId}:counts`; per-viewer `liked`/`canComment` ride the same batch (D-11/D-12).
- **Defense-in-depth gate** — UI hide (`canComment` flag) + Server Action re-check + service-role DAL (D-09/D-10), the established v6.0 social pattern.
- **State reset on interaction, not mount** (`project_router_cache_stale_instance`) — preserve for the sheet-open / optimistic state on the dynamic profile route.

### Integration Points
- `ProfileWatchCard` slide/card model → add overlay ♥/💬 chips (non-owner only); chip handlers `preventDefault` the wrapping `<Link>` (D-01/D-02/D-03).
- `getBatchedWatchCounts(Cached)` return shape → `{ likeCount, commentCount, liked, canComment }` per watch (D-11); `page.tsx:366-388` threads `viewerId` + the enriched map into `CollectionTabContent` / `WishlistTabContent`, which pass per-card props down.
- New grid comment sheet → reuses Phase 62 sheet + `CommentCompose` + the existing comment-create Server Action (D-06/D-07).
- `toggleLikeAction` + comment-create action → must revalidate `viewer:{viewerId}:counts` so re-hydration after navigation is fresh (D-12).

</code_context>

<specifics>
## Specific Ideas

- **Photo-first tile, glassy chips.** The card stays a clean photo-first tile; engagement lives as lightweight dark-scrim chips on the image (bottom-left), not a chrome-heavy footer — minimal, Instagram-like.
- **Compose in a sheet, not inline-expand.** Deliberately chosen so the grid never reflows and so the page's Cache Components structure (Phase 51/52) is untouched — and it reuses the Phase 62 precedent rather than inventing a new surface.
- **Engagement is a visitor action.** The owner sees their own grid as a management surface (counts + reorder), not an engagement surface — hence no chips on owner cards.
- **Reuse over reinvention.** Likes, comments, the gate, the optimistic patterns, and the sheet all already exist. Phase 63 is mostly a *surfacing + data-threading* job: enrich the batched counts with per-viewer `liked`/`canComment`, render two chips, open one sheet.

</specifics>

<deferred>
## Deferred Ideas

- **Full comment thread inline in the grid card** — out by design (GRID-04); reading the thread clicks through to `/w/[ref]`.
- **Locked/teaser comment affordance on gated cards** — considered, rejected (hide the 💬 chip entirely; D-09).
- **Owner self-engagement chips on own grid** — considered, rejected (hide chips for owner; D-03).
- **Threaded/nested replies, comment moderation, public liker lists, Realtime** — out per the v6.0 social scope (unchanged).
- **Detail-page information hierarchy + deliberate comment placement** — Phase 64 (PAGE-01..04).

### Reviewed Todos (not folded)
None — `todo.match-phase 63` returned 0 matches.

</deferred>

---

*Phase: 63-inline-grid-engagement*
*Context gathered: 2026-05-27*
