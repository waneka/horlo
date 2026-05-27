# Phase 62: Public Wear Pics on Watch Detail - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Surface a watch owner's **public** wear photos onto the unified `/w/[ref]` detail page by **unioning them into the Phase 61 carousel** (no row copying — query `wear_events` where `visibility='public'` at the DAL read layer, per Phase 60 D-02). Add an **owner per-pic hide control** for surfaced wear pics, and attach the **v6.0 like/comment layer** to each surfaced pic. Also fix the Wears tab to display the actual wear photo instead of the generic catalog image.

Delivers WPIC-01..06:
- WPIC-01 — public wear pics auto-surface in the carousel.
- WPIC-02 — owner can hide a specific surfaced pic from detail (it stays in the Wears tab).
- WPIC-03 — Wears tab shows the actual wear photo, not the catalog image.
- WPIC-04 — Home wear rail stays 48h-ephemeral and unchanged (guardrail).
- WPIC-05 — non-public (followers/private) wear pics never surface (guardrail).
- WPIC-06 — surfaced pics carry working like + comment interactions.

**Not this phase:** the full detail-page information-hierarchy / comment-placement redesign is **Phase 64** (PAGE-01..04). Phase 62 unions wear pics into the existing carousel and exposes their social layer via a sheet — it does **not** re-architect the page IA. Owner photo upload/delete/reorder shipped in Phase 61; multi-photo schema/DAL/cover/cap shipped in Phase 60.

</domain>

<decisions>
## Implementation Decisions

### Carousel Composition & Ordering
- **D-01 (inherited, LOCKED — Phase 60 D-02):** Wear pics are **NOT** copied into `watch_photos`. They are queried from `wear_events` (`visibility='public'`) and **merged into the carousel photo stream at the DAL read layer**, preserving each pic's `wear_event` identity (so its existing `wear_likes` + comments stay attached — WPIC-06). No sync logic, no re-migration.
- **D-02:** Carousel order = **owner uploads first, then public wear pics appended.** The cover stays the lowest-`sort_order` owner upload (Phase 60 contract untouched). Within the wear-pic group: **newest-worn first** (recency-forward, matches the rest of the app).
- **D-03:** Wear pics also render in the **always-on Phase 61 filmstrip** as tap-to-jump thumbnails (the filmstrip mirrors the full carousel for everyone).
- **D-04 (inherited, LOCKED — Phase 60 D-14):** Surfaced wear pics do **not** count against the 10-photo owner-upload cap.

### Wear-Pic Visual Treatment
- **D-05:** Wear-pic slides carry a **subtle "Worn · [date]" badge**; owner studio/hero uploads stay unmarked. The badge gives real-world context and naturally explains why some slides show like/comment counts (the wear pics) and others don't.
- **D-06:** **No per-user attribution.** On a watch's detail page all wear pics are the watch owner's own; a non-owner viewing still sees only that owner's public wear pics. (Per-viewer attribution is a future multi-actor concern, not v7.0.)
- **D-07 (GOTCHA):** The badge formats `wear_events.worn_date` (a date-only field). Pin `timeZone:'UTC'` + `'en-US'` locale on the formatter to avoid the React #418 hydration mismatch class (MEMORY `project_react_418_date_tz_hydration`) — server UTC vs browser-local diverge otherwise.

### Per-Pic Hide Control (WPIC-02)
- **D-08:** The hide control **reuses the Phase 61 "Edit photos" mode.** In Edit mode, wear-pic filmstrip thumbnails get an **eye/hide action**; owner uploads keep their `×`-delete + drag-reorder. Wear pics get **hide only** — they aren't `watch_photos` rows, so no delete/reorder applies to them. One consistent owner-controls surface; no new affordance.
- **D-09:** **"Hide" = removed from this watch detail carousel ONLY.** The wear pic remains in the owner's **Wears tab** and (within the 48h window) the **Home rail** — untouched. It is **NOT** a visibility change.
- **D-10:** Hide is **reversible in the same Edit mode** — a hidden wear pic still appears in the filmstrip but **greyed / marked "Hidden"**, and the eye action toggles it back. Un-hide lives exactly where you hid it (no separate management screen).
- **D-11:** Hide is a **dedicated persistent state, separate from `wear_events.visibility`** (so "hide from this page" ≠ "make private"). Data shape (a `hidden_from_detail`-style column on `wear_events` vs a small join table) is the **planner's call**, with these constraints: (a) it must NOT alter `visibility`; (b) it must key per `wear_event` so it persists across reads (consistent with D-01's no-row-copy); (c) the union query must filter hidden pics out for **all** viewers, not just hide them client-side.
- **D-12:** Owner-gating is **defense-in-depth**: the hide UI sits behind `viewerCanEdit`; the hide server action re-checks ownership against `watches.user_id`; the **DAL union query** is the real gate (it filters `visibility='public'` AND not-hidden) so non-owners can never receive a hidden or non-public pic. (Service-role DAL is the read gate — RLS-subquery-caller gotcha, Phase 53.)

### Likes/Comments on Surfaced Wear Pics (WPIC-06)
- **D-13:** Each surfaced wear pic carries its **own wear-target** like + comment layer (`{type:'wear', id}` — already supported by `src/data/reactions.ts` / `src/data/comments.ts` / `CommentThread`). The page's existing **watch-level** like + `CommentThread` (`{type:'watch'}`) stay **separate and unchanged**.
- **D-14:** **Inline on the active slide** — when the carousel sits on a wear-pic slide, show that pic's **like toggle + count** and a **comment count**. Like is one-tap optimistic (mirror the existing like UX).
- **D-15:** Tapping the comment count opens that wear pic's thread in a **bottom sheet / overlay** (`CommentThread` with a wear target — view + post), dismiss returns to the carousel. Chosen to keep the carousel clean, avoid per-slide uncached-RSC re-rendering as the user swipes, and **preserve the Phase 51/52 Cache Components contract** (CommentThread remains an uncached Suspense sibling; do **not** disturb any `unstable_instant = false` locks on related routes — see PAGE-03). The exact sheet/overlay primitive is planner's discretion.

### Wears Tab Photo (WPIC-03)
- **D-16:** The Wears tab shows the **actual wear photo** for a logged wear, falling back to the catalog/cover image only when that wear has no photo. The DAL must surface each wear event's `photoUrl` (+ signed URL) per entry — today the tab uses the watch cover (`watch.imageUrl`), see `src/app/u/[username]/[tab]/page.tsx:423-456` → `WornTimeline`/`WornCalendar`.

### Guardrails (locked constraints, not design choices)
- **D-17 (WPIC-04):** The Home wear rail stays **48h-ephemeral**; surfacing on detail must NOT change `getWearRailForViewer` or its window. The detail union reads the **full** wear history (not time-gated); the rail is the time-gated surface. Verify the rail independently.
- **D-18 (WPIC-05):** followers-only / private wear pics **never** surface on detail, regardless of viewer. Enforced by the union filtering `visibility='public'` AND not-hidden, with the service-role DAL as the real gate.

### Photo Signing (carry-over from Phase 61)
- **D-19:** Surfaced wear-pic URLs live in the **`wear-photos` bucket** and must be signed via the **admin/service-role client** (not the cookie client) — mirrors the `/w/[ref]` owner-photo signing pattern and avoids PPR/cache-fill corruption (MEMORY `project_ppr_dynamic_before_use_cache`). Storage paths are `{userId}/…` scoped; preserve the Phase 61 IDOR fix (CR-02 — storage path must be prefixed with the owning user id). Phase 61 deferred "non-owner cover signing fails safe to placeholder" — apply the same fail-safe-to-placeholder behavior to wear-pic signing here.

### Claude's Discretion (decided here, open to planner refinement)
- Exact hide/eye icon, the "Hidden" greyed-thumbnail treatment, the "Worn · [date]" badge styling/position, and whether the like control sits on vs just beneath the active slide.
- The sheet/overlay primitive for the wear-pic comment thread (an existing dialog/sheet primitive vs a new one).
- Optimistic-update + toast copy — mirror the existing like/reorder patterns (`sonner`).
- The hide-flag data shape (column vs join table) per D-11's constraints.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope
- `.planning/ROADMAP.md` — "Phase 62: Public Wear Pics on Watch Detail" (goal + 5 success criteria + "UI hint: yes").
- `.planning/REQUIREMENTS.md` §"Public Wear Pics → Watch Detail — `WPIC`" (lines 41–50) — WPIC-01..06.

### Locked upstream contracts (READ FIRST)
- `.planning/phases/60-multi-photo-schema-dal/60-CONTEXT.md` — **D-02 (union-at-read — the spine of this phase: query `wear_events` `visibility='public'`, merge into carousel at the DAL, no row copy)**, D-14 (wear pics excluded from the 10-photo cap), D-04/D-05 (computed cover + fallback chain — must stay untouched by the union), the Phase 53 RLS-subquery-caller note (service-role DAL is the read gate).
- `.planning/phases/61-photo-upload-carousel-ui/61-CONTEXT.md` — the carousel + always-on filmstrip + "Edit photos" toggle pattern this phase extends (D-01/D-02/D-03), the `viewerCanEdit` owner gate, and the Phase 61 IDOR/storage-path fix to preserve.

### Schema (what this phase reads / extends)
- `src/db/schema.ts` — `wearEvents` (294–311): `photoUrl` (303), `visibility` (304, `wearVisibilityEnum` `public|followers|private` at 23–27), `watchId` FK (299), `wornDate` (the badge source). **A dedicated "hidden-from-detail" state attaches here per D-11.** `comments` (378–398, XOR `watchId`|`wearEventId` CHECK), `wearLikes` (356–369, `UNIQUE(userId, wearEventId)`), `watchPhotos` (338–350).
- Dual-migration discipline if a hide column/table is added: `drizzle-kit push` LOCAL ONLY; prod via `supabase db push --linked` (MEMORY `project_drizzle_supabase_db_mismatch` — 4 prod-push gotchas).

### DAL (what this phase modifies)
- `src/data/watches.ts` — `getWatchByIdForViewer` (228–285, the per-viewer resolver feeding `/w/[ref]`); cover join (150–156); the photo array assembled here is where the wear-pic union slots in (D-01/D-02). `Watch` type at `src/lib/types.ts:51–115` exposes cover as a single `imageUrl?` today — the carousel already takes a richer `SignedPhoto[]`; wear pics extend that slide model.
- `src/data/reactions.ts` — `getLikesForTarget` / `createLike` support `'watch'|'wear'` targets (D-13/D-14).
- `src/data/comments.ts` — `CommentTarget {type:'watch'|'wear'; id}`, `canViewerCommentOnTarget` (wear targets open per GATE-01), `getCommentsForTarget` (D-13/D-15).
- `src/data/wearEvents.ts` — `getWearRailForViewer` (324; 48h window) — **must stay unchanged** (D-17); reuse its `visibility`/follows predicate logic as the reference for the detail union's public filter (D-18).

### UI surfaces this phase touches
- `src/components/watch/WatchPhotoSection.tsx` — the Phase 61 carousel + filmstrip + Edit-toggle. `SignedPhoto {id, signedUrl, sortOrder}` (61–65) extends to carry wear-pic metadata (wearEventId, wornDate, like/comment state). Edit-mode reset on `onPointerDown` (27–30) — keep (MEMORY `project_router_cache_stale_instance`).
- `src/components/comment/CommentThread.tsx` — uncached RSC threading watch+wear targets; reuse for the wear-pic comment sheet (D-15) **without** disturbing Cache Components structure.
- `src/app/w/[ref]/page.tsx` — owner/viewer resolution (`isOwner`/`viewerCanEdit`), admin-client photo signing (D-19). The union'd wear-pic signed URLs are produced here.
- `src/app/u/[username]/[tab]/page.tsx` (423–456) + `WornTimeline`/`WornCalendar` — the Wears tab image source to repoint to the wear photo (WPIC-03 / D-16).

### Load-bearing gotchas (MEMORY)
- `project_react_418_date_tz_hydration` — pin `timeZone:'UTC'`+`'en-US'` on the "Worn · [date]" badge (D-07).
- `project_ppr_dynamic_before_use_cache` — sign wear-pic URLs via admin client; verify on prod after cache fills; do not disturb the static-shell opt-out (D-19, D-15).
- `project_rls_subquery_caller_rls` — service-role DAL is the real read gate for cross-table visibility; RLS is defense-in-depth (D-12/D-18).
- `feedback_mobile_ui_verify_on_prod` — swipe/sheet/touch behavior is confirmed on **prod**, not locally (empty test DB skips e2e); classify device behavior `human_needed`, build-gate, bundle one deploy.
- `project_baseline_not_green_build_is_gate` — `npm run build` (exit 0) is the authoritative gate; ignore pre-existing tsc/test noise.
- `project_next_clear_operational_debt` — `workflow.use_worktrees=false` globally (build-gated, DB-backed RSC routes need `.env.local`).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Phase 61 carousel + filmstrip + Edit toggle** (`WatchPhotoSection.tsx`) — the surface wear pics union into; the Edit toggle is where the per-pic hide action lives (D-08).
- **v6.0 social layer** (`reactions.ts`, `comments.ts`, `CommentThread.tsx`) — already targets `wear` entities; the surfaced pic's like/comment "just works" with the existing wear target (D-13). No new social DAL needed.
- **`getWearRailForViewer`'s public/follows predicate** (`wearEvents.ts`) — the reference implementation for the detail union's `visibility='public'` filter (D-18).
- **Admin-client signing pattern** in `/w/[ref]/page.tsx` — reuse for wear-pic signed URLs (D-19).

### Established Patterns
- **Union at read, no row copy** (Phase 60 D-02) — the carousel photo array is composed in the DAL/page from two sources (watch_photos + public wear_events).
- **Owner gate = defense-in-depth** — UI hide (`viewerCanEdit`) + server-action ownership re-check + DAL/union as the real filter (D-12).
- **Optimistic mutation + toast** (`sonner`, mirrored from Phase 61 reorder/delete) — apply to like + hide toggle.
- **Edit-mode state reset on interaction, not mount** (`project_router_cache_stale_instance`) — preserve for the carousel/filmstrip on the dynamic `/w/[ref]` route.

### Integration Points
- `getWatchByIdForViewer` photo assembly → union public wear pics after owner uploads (D-01/D-02).
- New hide state (column/table) + a hide/unhide server action → `src/app/actions/*` + `src/data/*`.
- `WatchPhotoSection` slide model → extended to render the badge + inline like/comment-count for wear-pic slides, and the eye/hide action in Edit mode.
- Wear-pic comment sheet → `CommentThread` (wear target) in an overlay, uncached-sibling-safe.
- Wears tab image source → wear `photoUrl` with catalog fallback (WPIC-03).

</code_context>

<specifics>
## Specific Ideas

- **Owner-curated first, then "in the wild."** The carousel reads as: the owner's hero/studio shots (cover untouched), then their real-world wear pics newest-first — a deliberate curated-then-candid arc.
- **The "Worn · [date]" badge is the seam.** It's the one signal that distinguishes a wear pic from a studio upload and explains why only some slides carry like/comment counts — minimal chrome, maximum context.
- **Hide ≠ make private.** A dedicated hide-from-detail state keeps the owner's curation of their public watch page fully decoupled from who can see the wear elsewhere (rail/feed). This decoupling is the whole point of WPIC-02 vs WPIC-05.
- **Comments in a sheet, not inline-per-slide** — deliberately chosen to stay clear of the Phase 51/52 Cache Components landmines (no per-slide uncached RSC churn) and to leave the page's IA for Phase 64.

</specifics>

<deferred>
## Deferred Ideas

- **Full detail-page information hierarchy + deliberate comment placement** — Phase 64 (PAGE-01..04). Phase 62 unions into the existing carousel and uses a sheet for wear-pic comments; it does not re-architect the page.
- **Wear note/caption shown on the wear-pic slide** — considered during treatment discussion; deferred to Phase 64's IA work (badge is date-only for now).
- **Per-viewer/multi-actor attribution on wear pics** — future; today every wear pic on a watch's page is the watch owner's own.
- **Inline grid like/comment composer** — Phase 63 (GRID-01..05), separate surface.

### Reviewed Todos (not folded)
None — `todo.match-phase 62` returned 0 matches.

</deferred>

---

*Phase: 62-public-wear-pics-on-watch-detail*
*Context gathered: 2026-05-27*
