# Phase 57: Comment Thread UI + Feed Extension + Grid Counts - Context

**Gathered:** 2026-05-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Drop the **real comment component** (compose → list → edit/delete) into the hosts already built
in Phase 56/56A, and add the two surfacing surfaces around it. Specifically:

- **Comment thread UI** (CMNT-01..09) rendered in three hosts: `/watch/[id]` detail, `/wear/[id]`
  inline (`WearCommentHost` `variant="inline"`), and the wears-lane bottom sheet
  (`WearCommentHost` `variant="bottom-sheet"`). The host chrome already exists (56A D-10) — this
  phase fills the marked `{/* Phase 57: shared comment component renders here */}` seam.
- **GATE-03** mutual-follow locked-state replacing the compose box on gated wishlist watches.
- **Feed extension** (FEED-06/07): a comment activity recorded on comment-create, surfaced in the
  home Network Activity feed for the commenter's followers, gated so it never leaks a comment on a
  gated wishlist watch.
- **Grid counts** (DISP-01): an "X likes · Y comments" line on profile collection/wishlist grid
  cards, from a single batched query (no N+1).

**Requirements:** CMNT-01, CMNT-02, CMNT-03, CMNT-04, CMNT-05, CMNT-06, CMNT-07, CMNT-08, CMNT-09,
GATE-03, FEED-06, FEED-07, DISP-01.

**Out of scope (later phases):** bell/inbox rendering of like/comment notifications, "X and N others"
like grouping, Settings opt-out toggles (`notifyOnLike`/`notifyOnComment`) — all Phase 58. No new
Server Actions or DAL functions for comments — Phase 54/55 are consumed as-is (one exception: the
comment action gains **activity logging** for FEED-06; see D-13). The `activities.type` column is
plain `text`, so FEED-06 needs **no enum migration**.

</domain>

<decisions>
## Implementation Decisions

### GATE-03 locked state (Area: GATE-03)
- **D-01:** A non-mutual-follower viewing a wishlist watch sees **text + an inline `FollowButton`**
  (reuse `src/components/profile/FollowButton.tsx` — already has optimistic toggle + anon `/login?next=`
  bounce) in place of the compose box. **Rejected:** link-to-profile only; static text only — both
  dead-end the user.
- **D-02:** **Two-state copy** so a viewer who follows but still can't comment understands why (the gate
  is *mutual*, GATE-05):
  - Pre-follow: **"Follow [username] to comment"** (the ROADMAP SC5 copy) + Follow button.
  - Followed but **not yet mutual**: copy changes to **"[username] needs to follow you back before you
    can comment"** — still no compose box, no Follow button (the viewer's half is done).
  - Mutual (owner already follows viewer, or follows back): compose box appears.
  **Rejected:** explicit-upfront single message; tooltip/info affordance — both leave the post-follow
  dead-end unexplained, which the operator explicitly flagged as the confusing case.
- **D-03:** This requires an **`ownerFollowsViewer` signal** passed into the gate component so the
  post-follow transition resolves client-side (the initial server gate is `canViewerCommentOnTarget`;
  it only returns a boolean, so the component needs to know whether the owner already follows the
  viewer to decide between the "needs to follow you back" state and unlocking). **Planner: source this
  alongside the existing follow-relationship reads (`src/data/follows.ts` `isMutualFollow` /
  follow-status reads used by `FollowButton`).**
- **D-04:** The comment **count is hidden** from gated viewers — `getCommentsForTarget` already returns
  `[]` for gated viewers and the DAL note states "no content and no count is leaked" (Phase 55 D-06 /
  comments.ts). The gate state shows neither the thread nor the count.

### Edit / delete UX (Area: Edit/Delete)
- **D-05:** **All-inline** controls — always-visible pencil + trash icons on the author's *own*
  comments (always-visible because mobile has no hover). Non-authors see **no** edit/delete controls
  (authorship-scoped; the DAL is already IDOR-safe via `(id, authorId)` WHERE).
- **D-06:** **Edit in place** — the comment body swaps to a textarea (Save / Cancel), reusing the
  compose-box styling and the same 500-char enforcement. **Delete = inline "Delete? · Cancel" confirm
  row** in place — **no AlertDialog / modal**. Rationale: edit/delete must also work inside the
  wears-lane bottom sheet (overlay-over-photo); a stacked dialog over a sheet-over-photo is awkward.
  **Rejected:** "…" overflow menu + AlertDialog delete; inline icons + dialog delete.
- **D-07:** **`[edited]` indicator appended to the meta line** — e.g. `tyler · 2d · edited` (muted
  suffix on the username/timestamp line, not on the body). `editCommentAction` returns `editedAt`
  (Phase 55 D-08) which drives the badge. **Rejected:** "(edited)" after the body text.

### Count surfacing (Area: Counts — CMNT-09 + DISP-01)
- **D-08:** **Detail-page comment count mirrors the like count** — a `MessageCircle` icon + bare inline
  number (no "comment(s)" word), **hidden at zero**, sitting next to the `♥ N` like control in the same
  footer action row on `/watch/[id]` and `/wear/[id]`. On the **wears-lane**, the count **badges the
  existing comment-trigger icon** (built 56A). Tapping focuses/opens the thread. Matches Phase 56 D-02
  exactly (`♥ N` form, hidden at zero, LIKE-04 convention). **Rejected:** "N Comments" thread header
  only; both header + footer count (redundant).
- **D-09:** **Profile-grid line = icons, hidden at zero** — `♥ 12 · 💬 3` in the `ProfileWatchCard`
  text block; each metric hidden when its count is zero, and the **whole line removed when both are
  zero** (matches the detail hidden-at-zero convention; keeps a sparse grid uncluttered). **Rejected:**
  worded "12 likes · 3 comments" always-visible; icons always-visible-with-zeros.
- **D-10 (leak guard):** The DISP-01 batched query must **respect the comment gate per-watch for the
  viewer** — comment counts on **gated wishlist cards** must not surface to non-mutual viewers (same
  principle as the DAL hiding counts, D-04). Like counts are open to all (GATE-02), so only the
  *comment* half of the grid line is gated. **Planner: a single batched query that joins like counts
  (open) + comment counts (gated per `canViewerCommentOnTarget` semantics) without N+1.**

### Feed comment-activity (Area: Feed — FEED-06/07)
- **D-11:** **Verb-only feed copy** — "tyler commented on [Brand Model]" — same flat composition as the
  existing `ActivityRow` (avatar left, `{username} {verb} {watchName}`, thumbnail right). New verb
  `commented`. **No comment preview text.** **Rejected:** preview ("commented: 'great piece'") — breaks
  the uniform row shape and forces comment body into activity metadata.
- **D-12 (per-viewer gate — correctness-critical, FEED-07):** Wear comments and comments on
  **non-wishlist** (owned/sold/grail) watches surface normally. A comment on a **wishlist** watch
  surfaces **only to feed viewers who are themselves eligible** (mutual-follow with the *target owner*,
  or the owner). **STRUCTURAL NOTE for researcher/planner:** the existing feed gates by the **actor's**
  own privacy settings because for `watch_added`/`wishlist_added`/`watch_worn` the actor *is* the watch
  owner. A comment activity breaks that assumption — actor (commenter) ≠ target owner — so its
  visibility keys off the **target owner's gate evaluated per feed viewer**, NOT the actor's settings.
  The feed query (`getFeedForUser`, `src/data/activities.ts`) needs a per-row mutual-follow check
  between the feed viewer and the target owner for wishlist-watch comment rows. This is the single most
  likely place to leak gated content — research it explicitly.
- **D-13:** A comment activity is **logged on comment-create only** (FEED-06 mirrors NOTIF-12
  INSERT-only — never on edit/delete). This means **`addCommentAction` gains a `logActivity` call**
  (`src/data/activities.ts`), the only DAL-adjacent change this phase makes. **Planner:** the
  `activities` table has `watchId` but no `wearEventId`; a **wear** comment activity needs the wear
  target carried in `metadata` (and the feed row must link `/wear/[id]` vs `/watch/[id]` accordingly).
  `activities.type` is `text` → widen the `ActivityType` TS union + `RawFeedRow`/`ActivityRow`; **no
  SQL enum migration**.
- **D-14:** **One row per comment — never aggregate.** Comment activities are exempt from the
  `feedAggregate` ≥3-in-1hr collapse, mirroring `watch_worn`'s "intentional per-day signal" exemption.
  Avoids an aggregate row mixing gated + ungated targets under one per-viewer gate. **Rejected:**
  aggregate like `watch_added`.

### Carried forward (locked by prior phases / operator — binding, NOT re-decided)
- **Comment order = NEWEST-FIRST, compose box ABOVE the list, optimistic insert at the TOP**
  (operator decision 2026-05-22, recorded in STATE.md; ROADMAP SC1 + SC4). ⚠️ **RECONCILIATION
  REQUIRED:** REQUIREMENTS.md CMNT-03/CMNT-08 AND `getCommentsForTarget` (`src/data/comments.ts`,
  `orderBy(asc(comments.createdAt))` with a "(oldest first, CMNT-03)" comment) still say
  *oldest-first / compose-below / optimistic-at-bottom* — these are **STALE**. The plan must reconcile:
  either reverse to newest-first in the UI, or add a `desc` DAL read. Update the stale REQUIREMENTS text
  + the DAL comment as part of this phase so downstream readers aren't misled.
- **Comments render UNCACHED** — plain Server Component inside Suspense (Phase 55 D-06). No
  `comments:{type}:{id}` cache tag. No shared cache ⇒ no gated-thread leak via cache.
- **Action contracts (Phase 55 D-08):** `addCommentAction → ActionResult<Comment>` (incl. `id`,
  `createdAt`); `editCommentAction → ActionResult<Comment>` (incl. `editedAt`);
  `deleteCommentAction → ActionResult<{ id }>`. UI reconciles to the server-confirmed row.
- **Gate rejection = discriminated `code: 'gate'` (Phase 55 D-09):** the action returns
  `{ success:false, error, code:'gate' }` → branch to the GATE-03 locked state **without
  string-matching**. The compose box also gates **pre-submit** via `canViewerCommentOnTarget`
  (the action gate is the race backstop if status flips between render and submit).
- **Optimistic mechanism = `useState` + `useTransition` + rollback** (house pattern, mirror
  `FollowButton`/`LikeButton`) — deliberately **NOT** `useOptimistic`. `disabled={pending}` blocks
  double-fire.
- **500-char limit triple-enforced** (CMNT-04): input maxLength + Zod `.strict()` (Phase 55) + DB CHECK
  (Phase 53 D-04). Whitespace-only rejected. Live char counter as the user nears the limit (CMNT-05).
- **Comment host chrome already built (56A D-10):** `WearCommentHost` bottom-sheet variant (open/close,
  swipe-pause, over-photo) + inline variant (`<section id="wear-comments">`). Phase 57 drops the shared
  comment component into the marked seam in both variants. The watch-detail host is new this phase.
- **`profile:{username}` tag already invalidated** by all three comment actions (Phase 55 D-07) → the
  DISP-01 grid badge refreshes for free. Phase 57 only attaches the matching `cacheTag()` on the grid
  read (no action changes for cache).
- **Grandfather policy (Phase 53 D-11):** the gate keys off the watch's CURRENT status; existing
  comments from non-mutual followers when a watch moves to wishlist are kept (read continues to work).
- **`'wear'` discriminator landmine:** the DAL/action `CommentTarget` is `{ type: 'watch' | 'wear' }` —
  NOT `'wear_event'`. Keep this straight in cache tags, target props, and the new activity metadata.

### Claude's Discretion
- Whether the shared comment component is one component taking `target: { type, id }` + a host variant
  prop, vs. thin wrappers — planner's call (the action/DAL are already target-discriminated).
- Exact wear-detail layout reconciliation: Phase 56 reserved a "comment-input slot" in the wear footer
  row, while 56A built an inline `WearCommentHost` `<section id="wear-comments">` for smooth-scroll.
  With compose-above-list locked, the planner decides whether the footer slot becomes a trigger that
  scrolls to / focuses the inline host's compose box, or the compose box lives in the footer with the
  list below. Either way, ONE compose box, ONE list per host.
- Char-counter reveal threshold (e.g., show at 450/500) and styling — UI-SPEC.
- Liked-state / comment-icon color tokens, exact grid-line typography/placement within the card text
  block — defer to `/gsd-ui-phase 57`.
- The exact `ownerFollowsViewer` data plumbing (extra read vs. piggyback on existing follow-status
  reads) — planner's call.
- Feed-row "scroll to the specific comment" deep-link (nice-to-have) vs. just linking to the target
  detail page — planner/UI-SPEC.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/ROADMAP.md` §"Phase 57: Comment Thread UI + Feed Extension + Grid Counts" — goal + 7
  success criteria (the verification contract). **SC1 says newest-first / compose-above; SC4 says
  optimistic-at-top** — authoritative over the stale REQUIREMENTS text.
- `.planning/REQUIREMENTS.md` — Phase 57 owns CMNT-01..09, GATE-03, FEED-06, FEED-07, DISP-01.
  ⚠️ **CMNT-03/CMNT-08 are STALE** (say oldest-first / compose-below) — superseded by the operator
  decision + ROADMAP SC; reconcile per the carried-forward note.

### Locked backend contract (read before wiring the UI)
- `.planning/phases/55-server-actions-notification-dedup/55-CONTEXT.md` — D-06 uncached comment threads;
  D-07 cache-tag contract (`profile:{username}` already invalidated; Phase 57 only attaches `cacheTag()`s);
  D-08 action return shapes; D-09 `code:'gate'` discriminant; the `'wear'` vs `'wear_event'` landmine.
- `src/app/actions/comments.ts` — `addCommentAction` / `editCommentAction` / `deleteCommentAction`
  (consumed as-is; **gains a `logActivity` call for FEED-06**, D-13). Already imports `logNotification`.
- `src/data/comments.ts` — `getCommentsForTarget` (oldest-first today — **stale**), `createComment`,
  `editComment`, `deleteComment`, `canViewerCommentOnTarget` (the load-bearing gate predicate — drives
  both compose gating AND the grid count-leak guard), `class CommentGateError`. Read the PRIVACY LAYER
  NOTE at the top: all comment reads/writes go through this DAL (RLS is non-functional by design).

### Component hosts + precedents to mirror
- `src/components/wear/WearCommentHost.tsx` — the bottom-sheet + inline host shells (56A). Phase 57
  fills the marked seam in BOTH variants.
- `src/components/profile/FollowButton.tsx` — the optimistic-button template (D-01/D-06 reuse it for
  GATE-03 + the compose pattern); `viewerId: string | null` + `/login?next=` bounce.
- `src/components/shared/LikeButton.tsx` (Phase 56) — the `♥ N` hidden-at-zero pattern the comment
  count (D-08) mirrors.
- `.planning/phases/56-like-ui/56-CONTEXT.md` — D-02 count form (mirror it), D-04 wear footer action
  row (the reserved comment-input slot to reconcile), the overlay CSS-chain landmine
  ([[feedback_ui_spec_css_chain_blind_spot]], Phase 30) + clear `.next/` before judging CSS
  ([[project_turbopack_next_cache_stale_css]]).
- `.planning/phases/56A-wear-view-unification/56A-CONTEXT.md` — D-10/D-11 comment host seam + the
  shared `WearCard` engagement row the comment trigger/count live in.

### Feed surfaces (FEED-06/07)
- `src/data/activities.ts` — `getFeedForUser` (the two-layer privacy query; D-12 needs a per-row
  target-owner gate for wishlist-watch comments — this query gates by ACTOR settings today),
  `logActivity` (overloaded; add a `comment` overload/branch), `ActivityType`.
- `src/lib/feedTypes.ts` — `ActivityType` union + `RawFeedRow` (widen for comment rows; carry wear
  target + link target).
- `src/components/home/ActivityRow.tsx` — `VERBS` map (add `commented`), row composition + the
  `/watch/{watchId}` link (needs `/wear/{id}` branch for wear comments).
- `src/lib/feedAggregate.ts` — comment rows are EXEMPT from aggregation (D-14), like `watch_worn`.

### Grid surface (DISP-01)
- `src/components/profile/ProfileWatchCard.tsx` — the grid card (a `<Link>` client component); D-09
  adds the `♥ N · 💬 M` line in the `CardContent` text block. Also `SortableProfileWatchCard.tsx`.
- `src/data/reactions.ts` — `getLikesForTarget` (single-query like count); the batched DISP-01 read
  pairs like counts (open) with gated comment counts (D-10).

### Codebase maps
- `.planning/codebase/CONVENTIONS.md`, `.planning/codebase/STRUCTURE.md`,
  `.planning/codebase/ARCHITECTURE.md` — naming, component grouping (`watch/`, `wear/`, `home/`,
  `profile/`, `shared/`), client-island/server-sibling composition rules.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`WearCommentHost`** (`src/components/wear/WearCommentHost.tsx`) — bottom-sheet + inline shells with
  marked Phase-57 insertion seams; discriminated-union props prevent the missing-handler footgun.
- **`FollowButton`** (`src/components/profile/FollowButton.tsx`) — reused inline for GATE-03 (D-01) and
  as the optimistic-mutation template for compose/edit/delete.
- **`LikeButton`** (`src/components/shared/LikeButton.tsx`) — the `♥ N` hidden-at-zero count form the
  comment count mirrors (D-08); already sits in the wear/watch footer action rows.
- **`ProfileWatchCard`** (`src/components/profile/ProfileWatchCard.tsx`) — the grid card text block
  (`CardContent`) is where the DISP-01 count line lands.
- **`ActivityRow`** (`src/components/home/ActivityRow.tsx`) + `VERBS` map — the flat feed row to extend
  with a `commented` verb (D-11).
- **`canViewerCommentOnTarget`** (`src/data/comments.ts`) — the SINGLE gate predicate driving compose
  gating, read-gating, AND the grid/feed count-leak guards. Keys off current watch status (grandfather).
- **`getCommentsForTarget`** — returns the thread (oldest-first today — reconcile to newest-first) and
  `[]` for gated viewers (no count leak).

### Established Patterns
- **Client island hydrated with server initial state** — page resolves data on the server, passes
  `initial*` props (FollowButton/LikeButton precedent). Comment thread = uncached Server Component in
  Suspense (Phase 55 D-06) hydrating the optimistic client list.
- **`viewerId: string | null` + `/login?next=`** anon bounce (FollowButton) — the wear thread is
  anon-reachable; the watch page is auth-only.
- **Optimistic = `useState` + `useTransition` + rollback**, reconcile to server-confirmed row
  (`{ id, createdAt, editedAt }`).
- **Two-layer feed privacy** (`src/data/activities.ts`): RLS outer gate + WHERE-clause inner gate.
  D-12 must extend the inner gate with a target-owner-relative check for comment rows (the actor-based
  gate does not transfer).

### Integration Points
- **New:** shared comment component (compose + list + comment item w/ edit/delete) under
  `src/components/<comment|shared>/` (planner picks the home); rendered in `WearCommentHost` (both
  variants) + `/watch/[id]` detail.
- **Edit:** `src/app/actions/comments.ts` (`addCommentAction` += `logActivity`, D-13); `ActivityType`
  union + `RawFeedRow` (`src/lib/feedTypes.ts`); `getFeedForUser` gate + `logActivity` overload
  (`src/data/activities.ts`); `ActivityRow.tsx` (`commented` verb + `/wear` link branch);
  `ProfileWatchCard.tsx` (count line) + the profile grid read (batched like+comment counts);
  `/watch/[id]/page.tsx` + `/wear/[wearEventId]/page.tsx` (thread hydration + count + gate state);
  `src/data/comments.ts` (reconcile order comment / add a newest-first read).
- **Reconcile:** Phase 56 reserved wear-footer comment-input slot vs. 56A inline host section — one
  compose box, one list (Claude's Discretion above).

### Known landmines (carried into the code)
- **`'wear'` vs `'wear_event'`** — DAL discriminator is `'wear'`; don't let `'wear_event'` leak into
  target props / activity metadata / link branches.
- **Feed actor-vs-owner privacy** — the existing feed gate assumes actor == owner; comment activities
  break this. Per-viewer target-owner gate or the feed leaks gated wishlist watches (D-12).
- **Comment-order contradiction** — ROADMAP/operator (newest-first) vs. REQUIREMENTS/DAL (oldest-first).
  Reconcile before implementing or the thread renders in the wrong order.
- **Overlay/CSS-chain blind spot** — wears-lane bottom-sheet over the photo; assert the CSS chain and
  clear `.next/` before judging ([[feedback_ui_spec_css_chain_blind_spot]],
  [[project_turbopack_next_cache_stale_css]]).

</code_context>

<specifics>
## Specific Ideas

- **GATE-03 must teach the mutual rule, not just state it.** The operator's explicit concern: "if it
  says 'follow to comment' and then I follow but I still can't comment, I need to know why." The
  two-state copy (D-02) is the answer — the post-follow state names the missing half ("[username] needs
  to follow you back").
- **Comment count and like count should read as siblings** — same `icon N` form, same hidden-at-zero
  rule, same footer action row, so a reviewer diffing them sees one pattern (D-08 mirrors Phase 56 D-02).
- **The grid line is gated asymmetrically:** likes are open to everyone (GATE-02), comments on wishlist
  watches are mutual-gated — so the `♥ N · 💬 M` line can show the like half but must hide the comment
  half from non-mutual viewers (D-10).
- **Feed stays uniform:** comment rows look exactly like every other feed row (verb-only), not a special
  preview card (D-11).

</specifics>

<deferred>
## Deferred Ideas

- **Bell/inbox rendering of comment notifications + deep-links** — Phase 58 (NOTIF-15). The notification
  rows are already written by `addCommentAction` (Phase 55 NOTIF-12); Phase 58 renders them.
- **Settings opt-out toggles** (`notifyOnLike`/`notifyOnComment`) — Phase 58 (NOTIF-16). The columns +
  write-time read exist (Phase 53 D-10); only the toggle UI is deferred.
- **Comment preview text in the feed / reply threads / @mentions / liker-avatar strips** —
  `.planning/REQUIREMENTS.md` §Future (SOC-F1…F5). Not this milestone.
- **Comment-thread caching (viewer-scoped Option B)** — deliberately not built (Phase 55 D-06); revisit
  only if comment volume makes the uncached Suspense render a hot path.
- **Feed-row scroll-to-specific-comment deep link** — nice-to-have; planner may link to the target
  detail page only.

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 57-comment-thread-ui-feed-extension-grid-counts*
*Context gathered: 2026-05-23*
