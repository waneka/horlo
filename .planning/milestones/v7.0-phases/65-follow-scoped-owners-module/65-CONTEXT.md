# Phase 65: Follow-Scoped Owners Module - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning

<domain>
## Phase Boundary

On the unified `/w/[ref]` watch-detail page, render a compact, **hide-if-empty** "people you follow who own this" module in the **hero right column** (below the existing minimal title / spec-strip / like+jump / owner-actions block, per Phase 64 D-09/D-10 hero layout). The chip-set is the intersection of:

1. The viewer's `follows` set (one-way `viewer → owner` direction — NOT mutual, NOT "your followers"), and
2. The set of users who currently `own / wishlist / grail` this catalog ref (status filter consistent with the existing broad `OtherOwnersRoster`).

Delivers **FOLL-01..04**:
- **FOLL-01** — module renders on `/w/[ref]` hero right column when ≥1 followed owner exists; **entirely absent from the DOM** at zero.
- **FOLL-02** — one-way direction `viewer → owner` (people the viewer follows), not "your followers" and not mutual-only (per UAT 2026-05-27).
- **FOLL-03** — each row = `avatar + @username` chip, navigable link, accessible label.
- **FOLL-04** — single efficient query (no N+1), respects existing profile-visibility / privacy rules, does not block the hero render path (Suspense-wrap if it cannot resolve synchronously).

**This phase adds one new RSC module + one new DAL function. No schema changes, no new social primitives, no new routes.** It composes around the Phase 64 hero as an additional sibling within the right column.

**Not this phase:** mutual-follow gating; a separate "your followers who own this" surface; a see-all page for overflow; new privacy semantics; per-user-watch-detail click targets (chips link to the owner's collection page, not a specific watch).

</domain>

<decisions>
## Implementation Decisions

### Branch visibility & viewer context (FOLL-01)
- **D-01:** **Renders on all 3 render branches in `src/app/w/[ref]/page.tsx`, for every viewer.** Branch 1 (per-user watch detail — your own watch + cross-user), Branch 2 (owner-via-catalog), Branch 3 (pure catalog). The chip-set is always derived from `catalogId` (Branch 1's per-user watch resolves `catalogId` from the loaded `Watch`; Branches 2/3 already have `catalogId` as `ref`). **Self-excludes the viewer** in the DAL WHERE clause (matches `getCollectorsForCatalog` T-39b-04). When you view YOUR OWN watch, you still see followed collectors who ALSO own this catalog ref — social-proof framing is intentional. Hide-if-empty is intrinsic: empty intersection → no DOM (FOLL-01).
- **D-01a (catalogId resolution on Branch 1):** Branch 1 today loads the watch via `getWatchByIdForViewer` — the row carries `catalogId` (nullable). When `watch.catalogId` is null the module **cannot** render (no key to intersect on); treat as empty → hide-if-empty (no DOM). Document this null-handling in the DAL call site, not the component.

### Chip click destination (FOLL-03)
- **D-02:** Each chip is a **single tap target** linking to **`/u/${username}/collection`** — matches the existing `OtherOwnersRoster` pattern (`OtherOwnersRoster.tsx:70`). The success criteria's "owner's profile / per-user watch detail" `or` is resolved in favor of the simpler / cheaper / pattern-consistent target. The DAL therefore does NOT need to project per-owner `watches.id` — projection is `{ userId, username, displayName, avatarUrl }`, identical to `CatalogCollector`.
- **D-02a (accessible label):** Use the existing `OtherOwnersRoster` pattern — `aria-label="${displayName ?? '@'+username}'s collection"` on the absolute-inset `<Link>`. FOLL-03 satisfied.

### Coexistence with existing OtherOwnersRoster (Branch 3)
- **D-03:** **Both modules render** on Branch 3. The new follow-scoped module sits in the **hero right column** (slot established by Phase 64); the existing broad `OtherOwnersRoster` stays where it is **below the hero** (today's position at `page.tsx:737`, untouched). Two distinct surfaces with distinct meaning:
  - Hero right column → "From your circle" (followed-only, taste/social driven, tight)
  - Below hero → "X collectors own this" (broad, public-roster, discoverability)
- **D-03a:** **No layout regression on Branch 3.** Do not relocate, suppress, or reorder the existing `OtherOwnersRoster`. The new module is purely additive on this branch.
- **D-03b (B1/B2 — no existing roster):** On Branch 1 (per-user) and Branch 2 (owner-via-catalog), `OtherOwnersRoster` is currently not rendered. Phase 65 adds **only** the new follow-scoped module to the hero right column on these branches — it does NOT introduce the broad roster to surfaces where it doesn't exist today (out of scope).

### Visual shape, count, overflow (FOLL-03)
- **D-04 (layout):** **Compact vertical chips** in the hero right column — one chip per row, `avatar (40px, AvatarDisplay primitive — 40 is the smallest legal AvatarDisplay size per `AvatarDisplay.tsx:10`) + @username + optional displayName`. Vertical stack (NOT horizontal scroll like `OtherOwnersRoster`) because the hero right column is the narrow `minmax(0,2fr)` track of the `[3fr_2fr]` grid; horizontal scroll within a narrow column reads cramped. Single column on mobile carries naturally (FOLL: "Mobile: stacks naturally below the hero's right-column content — no separate mobile layout required").
- **D-04a (header copy):** `"From your circle"` — warmer Rdio-inspired identity framing (matches the project's taste-network framing) over the literal "People you follow who own this" phrasing. Header is present (not chip-only).
- **D-04b (count limit):** **Top 5** by recency. Matches `getCollectorsForCatalog` default limit (`getCollectorsForCatalog(ref, viewerId, { limit: 5 })`).
- **D-04c (overflow):** When >5 followed owners exist, render **plain text caption "and {N} more"** below the 5 chips. **No see-all route. No inline expand.** Keeps Phase 65 scope tight; a navigable see-all is out of scope for this milestone.

### Privacy gates (FOLL-04)
- **D-05:** Apply **both privacy gates** — `profileSettings.profilePublic = true` AND `profileSettings.collectionPublic = true`. Identical contract to the broad `OtherOwnersRoster` two-layer privacy (T-39b-01 layers 1 & 2 in `discovery.ts:91-94`). **A follow does NOT override either flag** — a private-profile or private-collection person you follow does NOT appear in this module even though you follow them. Consistent with the rest of the app: follow currently does not grant collection-visibility anywhere else.
- **D-05a (self-exclusion):** `sql\`${profiles.id} != ${viewerId}\`` — viewer never appears in their own follow-scoped roster (T-39b-04 pattern). Even though you follow yourself implicitly = no (follows.followerId != follows.followingId by definition), keep the explicit clause for symmetry with the broad roster.
- **D-05b (status filter):** `inArray(watches.status, ['owned', 'wishlist', 'grail'])` — exclude `sold`. Matches `getCollectorsForCatalog` so "own this" copy is consistent across both rosters.

### Claude's Discretion (planner / researcher to resolve)
- **D-06 (DAL strategy):** Extend `getCollectorsForCatalog` with an optional `viewerFollowingOnly: true` parameter, OR create a new dedicated DAL function `getFollowedOwnersForCatalog(catalogId, viewerId, { limit })`. Lean toward a **dedicated new function** — keeps the existing two-layer-privacy-only call path of `getCollectorsForCatalog` untouched (regression-safe) and lets the new function's tests own the follow-join concern. Both paths share the same projection shape + status filter, so duplication is mechanical. Planner decides; document in PLAN.
- **D-07 (query shape):** Single SQL query joining `follows` (viewer-follows-X) ⋈ `watches` (X owns this catalogId) ⋈ `profiles` ⋈ `profileSettings`. Same Pitfall 3 dedup pattern as `getCollectorsForCatalog` (a user can have multiple matching `watches` rows — `owned` + `wishlist`). JS-side `Set`-based dedup keeps the first occurrence ordered by `watches.createdAt DESC`. **FOLL-04 single-query mandate satisfied** — exactly one DAL call per page render, joined-in-SQL (no per-chip follow-up). A separate `count(DISTINCT)` query for `totalCount` mirrors Pitfall 4 if "+N more" needs the true overflow count.
- **D-08 (ordering signal):** Order by `watches.createdAt DESC` (when they added it — same as `getCollectorsForCatalog` D-39b-10 "liveness signal over follower-count"). NOT `follows.createdAt` (when you followed them) — recency of their ownership is the more useful signal for "who in my circle just got one." Document in PLAN.
- **D-09 (Suspense vs pre-fetch):** Pre-fetch in the existing `Promise.all` block at the top of each branch (mirrors how `getCollectorsForCatalog` is already invoked on Branch 2/3) — the JOIN should resolve well under the hero render budget, so a separate `<Suspense>` is unnecessary. **If** profiling shows it adds >100ms p95 to the hero render path, wrap the new module in a sibling `<Suspense>` with a 1-row skeleton, but DO NOT import it into the `WatchDetailHero` `'use client'` island (preserve Phase 64 D-07 B1 sibling-composition discipline). Pass already-resolved data into the hero as a prop, like `signedPhotos`/`wearPics` today.
- **D-10 (component placement in hero):** The new module renders as a child of `WatchDetailHero` inside the right column `<div className="space-y-6 min-w-0">` (after the LikeButton + jump-to-comments row at `WatchDetailHero.tsx:276`, before the Last-Worn line). Pure-presentation prop-driven RSC (NOT a 'use client' component — chips are plain `<Link>`); accepts `followedOwners: FollowedOwner[]` + `totalCount: number`. New file `src/components/insights/FollowedOwnersModule.tsx` (mirrors `OtherOwnersRoster.tsx` shape). Add `followedOwners` and `followedOwnersTotal` (or a single bundle prop) to `WatchDetailHeroProps`.
- **D-11 (FollowedOwner row type):** `FollowedOwner = { userId, username, displayName, avatarUrl }`. Live in `src/data/follows.ts` next to the new DAL function (or in `src/data/discovery.ts` if planner picks the extend-existing path). NOT imported from `discovery.ts:CatalogCollector` to keep the surfaces independently evolvable.
- **D-12 (test coverage):** Mirror `tests/data/getCollectorsForCatalog.test.ts` for the new DAL — privacy edges (4 layers: profilePublic, collectionPublic, self-exclusion, follow-direction), Pitfall 3 dedup, Pitfall 4 totalCount. Component test for hide-if-empty + "+N more" caption.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope
- `.planning/ROADMAP.md` — "Phase 65: Follow-Scoped Owners Module" (goal + 5 success criteria; "UI hint: yes"; depends on Phase 64).
- `.planning/REQUIREMENTS.md` — **FOLL-01..04** (the 4 requirements this phase delivers).
- `.planning/phases/64-detail-page-ia-redesign/64-CONTEXT.md` — the just-shipped hero this module slots into. **Read D-09/D-10** (verdict + empty-collection states pulled OUT of the hero right column per UAT 2026-05-27; the right column is now `title → spec strip → like+jump → owner actions` only) — Phase 65's module is the **next addition** to that minimal column.
- `.planning/phases/64-detail-page-ia-redesign/64-SUMMARY.md` — confirms what shipped in Phase 64 (the hero right column is what we're extending).

### The page + components being extended
- `src/app/w/[ref]/page.tsx` — the unified route. **Three render branches must each pass the new follow-scoped data into the hero**:
  - Branch 1 (per-user watch, `lines ~304-391` legacy / current after Phase 64 refactor) — derive `catalogId` from `watch.catalogId`; skip the DAL call when null.
  - Branch 2 (owner-via-catalog, `findViewerWatchByCatalogId` branch around `lines ~456-545`) — `ref` IS the catalogId.
  - Branch 3 (pure catalog, `lines ~656+`) — `ref` IS the catalogId; this branch already calls `getCollectorsForCatalog` in its `Promise.all` (line ~431).
  - The new DAL call belongs in the same `Promise.all` blocks for each branch; result flows into `WatchDetailHero` as a prop.
  - **Preserve Phase 51/52 Cache Components route shape** — `export const unstable_instant = false` (line 50), `await connection()` opt-out (line 96), sync-outer / async-inner / `<Suspense>` (lines 83-102). DO NOT touch these.
- `src/components/watch/WatchDetailHero.tsx` — the `'use client'` hero island. The right column's `<div className="space-y-6 min-w-0">` (line 230) holds the existing minimal stack; the new module is the next sibling after the LikeButton+jump row (line 276) and before the Last-Worn block (line 300). Accept new prop(s) on `WatchDetailHeroProps` (line 48).

### Reusable / prior-art components & DAL
- `src/components/insights/OtherOwnersRoster.tsx` — **the closest prior art.** Same problem (catalog owners → chip row), same `aria-label` pattern, same `absolute-inset <Link>` click-surface, same `AvatarDisplay` size constraint (40/64/96 — substitute 40). The visual layout differs (horizontal scroll there vs vertical chips here per D-04), but the prop shape + privacy-gate-at-DAL invariant is identical.
- `src/data/discovery.ts` — `getCollectorsForCatalog` (line 72) is the **DAL template to mirror or extend** for D-06. Read its full JSDoc — the two-layer-privacy + self-exclusion + status-filter + Pitfall 3/4 patterns are the exact contract this phase needs.
- `src/data/follows.ts` — the follow graph DAL. Existing helpers (`isFollowing`, `isMutualFollow`, `getFollowingForProfile`) live here; the new follow-scoped roster DAL likely belongs **here** rather than `discovery.ts` (D-06).
- `src/components/profile/AvatarDisplay.tsx` — the avatar primitive. **Size is a literal union 40 | 64 | 96** — use 40 (matches `OtherOwnersRoster`).

### Schema (for query authoring — no changes)
- `src/db/schema.ts` — `follows` table (followerId / followingId), `watches` (catalogId / userId / status), `profiles` (id / username / displayName / avatarUrl), `profileSettings` (userId / profilePublic / collectionPublic). All of these already participate in the broad roster query.

### Load-bearing gotchas (MEMORY — verify still current at plan time)
- `project_ppr_dynamic_before_use_cache` — **`unstable_instant = false` + `await connection()` on `/w/[ref]` is PERMANENT.** Do NOT touch the route's opt-out mechanics when wiring the new DAL into the `Promise.all`.
- `project_react_418_date_tz_hydration` — N/A for this phase (no date rendering) but preserve when touching neighboring date-rendering blocks (Last-Worn line in `WatchDetailHero.tsx:300-319`).
- `feedback_mobile_ui_verify_on_prod` — module's mobile single-column collapse, "+N more" caption rendering at narrow widths, and chip tap-target size verify on **prod** (push → Vercel), not locally (empty test DB skips e2e). Classify device behavior `human_needed`; bundle into one deploy; build-gate before push.
- `project_baseline_not_green_build_is_gate` — `npm run build` (exit 0) is the authoritative gate.
- `project_next_clear_operational_debt` — `workflow.use_worktrees = false` globally (this phase touches the DB-backed RSC page → `.env.local` unavailable in worktrees).
- `feedback_execute_phase_no_worktree_when_db` — applies (DAL touches `db`; verification runs `npm run build`).
- `project_phase_complete_999_1_misset` — after Phase 65 completion, hand-correct `STATE.md` (the SDK's `phase.complete` mis-sets next-phase / progress).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`OtherOwnersRoster.tsx`** — same problem class. Reuse its `aria-label`, absolute-inset `<Link>` click-surface, focus-visible ring, displayName-fallback patterns. Visual layout diverges (vertical chips here per D-04) but the structural conventions transfer 1:1.
- **`AvatarDisplay`** — the avatar primitive (size 40 is the supported minimum). Already used by `OtherOwnersRoster`; reuse here.
- **`getCollectorsForCatalog`** (`src/data/discovery.ts:72`) — the JOIN template. The new DAL is structurally a near-clone with one added `INNER JOIN follows ON follows.followingId = profiles.id AND follows.followerId = ${viewerId}` clause. Same projection, same status filter, same Pitfall 3/4 dedup.
- **Phase 64 hero shell** — the `<div className="space-y-6 min-w-0">` right-column container already enforces a vertical 24px-gap rhythm. The new module slots in as another `space-y-6` child; no new layout primitives needed.

### Established Patterns
- **B1 sibling composition / RSC pre-fetch** — per Phase 64 D-07, the hero island accepts already-resolved data as props; do NOT import server-only DAL functions or `cookies()`-touching helpers into `WatchDetailHero` (it's `'use client'`). The DAL call lives in `page.tsx`, the result flows as a prop. The new `FollowedOwnersModule` itself is RSC-pure-presentation (no `'use client'`, no `cookies()`).
- **Two-layer privacy at the DAL WHERE** — service-role pooler bypasses RLS in this codebase (see `discovery.ts` "Threat surface" comment). The DAL WHERE clause IS the privacy gate. Both layers (profilePublic + collectionPublic) must appear; never split.
- **JS-side dedup after overfetch** — Pitfall 3 in `discovery.ts`. A user can have multiple `watches` rows for one catalogId (owned + wishlist). Overfetch with `.limit(50)`, then JS-dedup by userId keeping the first occurrence (ordered DESC), then slice to top-N.
- **Separate count(DISTINCT) for totalCount** — Pitfall 4. If "+N more" needs a true overflow count, a second query with the **identical WHERE clause** preserves privacy consistency.
- **Hero data threading** — `signedPhotos`, `wearPics`, etc. are pre-resolved in `page.tsx` and passed into `WatchDetailHero` (`WatchDetailHero.tsx:73-101`). Phase 65 adds `followedOwners` (and optional `followedOwnersTotal`) to that same prop-shape.

### Integration Points
- **`src/app/w/[ref]/page.tsx` Promise.all blocks** — each of the 3 branches has its own `Promise.all` for parallel DAL fetches. Add the new DAL call to each (skipping Branch 1 when `watch.catalogId` is null).
- **`src/components/watch/WatchDetailHero.tsx`** — extend `WatchDetailHeroProps` (line 48-102); render the new `FollowedOwnersModule` as a sibling inside the right column's `space-y-6` stack, positioned **between LikeButton/jump-row and Last-Worn line** (so the module sits visually under the like+comment-jump affordances, above the owner-only Last-Worn/Flag/Action rows — non-owners see only the brand+model heading, spec strip, like+jump, then "From your circle"; owners see the full stack).
- **`src/components/insights/FollowedOwnersModule.tsx` (new)** — pure-presentation RSC; props `{ owners: FollowedOwner[]; totalCount: number }`; returns `null` when `owners.length === 0` (hide-if-empty per FOLL-01). Mirrors `OtherOwnersRoster` shape.
- **`src/data/follows.ts`** — most likely home for the new DAL (`getFollowedOwnersForCatalog`). Planner may instead extend `getCollectorsForCatalog` with a `viewerFollowingOnly` flag (D-06).

</code_context>

<specifics>
## Specific Ideas

- **Header copy is "From your circle"** — explicit user choice (D-04a). Warmer than the literal ROADMAP/REQUIREMENTS phrasing; matches Horlo's Rdio-inspired taste-network identity framing.
- **"and {N} more" caption is plain text** — explicit user choice (D-04c). NO see-all link, NO inline expand. If overflow is rare in practice, the plain caption is sufficient; if it becomes load-bearing later, a see-all page is a clean follow-on phase.
- **Click target is the collection page, not the per-user watch detail** — explicit user choice (D-02). Matches existing `OtherOwnersRoster`; viewer lands on the collector's grid and continues exploring from there.
- **Both rosters render on Branch 3** — explicit user choice (D-03). No layout regression; the broad roster stays exactly where Phase 39b+64 put it.

</specifics>

<deferred>
## Deferred Ideas

- **See-all page for followed owners** — when >5 followed owners exist, today we render plain "+N more" text. A future phase could add `/w/${ref}/followed-owners` (or similar) with pagination. Out of scope for FOLL-01..04.
- **Mutual-follow variant** — a "your mutuals who own this" surface (vs the chosen one-way `viewer → owner` direction). Explicitly rejected by FOLL-02 / UAT 2026-05-27.
- **"Your followers who own this" surface** — the reverse direction. Same rejection as above.
- **Per-user-watch-detail click target** — chips routing to `/w/${their-watch-id}` instead of `/u/${username}/collection`. Captured but not built (D-02). Would require projecting per-owner `watches.id` in the DAL; trivially additive if reversed later.
- **Inline expand on "+N more"** — client-side reveal-in-place. Cleaner UX than the static caption but adds a `'use client'` island that complicates the hero's B1 sibling-composition. Capturing for future polish if overflow becomes common.
- **Promoting `FollowedOwnersModule` to a shared component for other surfaces** — e.g., a profile-level "your circle's recent additions" feed. Out of v7.0 scope; would belong in v8.0+ (recommender / discovery).

</deferred>

---

*Phase: 65-follow-scoped-owners-module*
*Context gathered: 2026-05-28*
