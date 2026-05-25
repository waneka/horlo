# Phase 55: Server Actions + Notification Dedup - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

The mutation entry points the UI calls. Zod-validated Server Actions in `src/app/actions/` —
`toggleLikeAction`, `addCommentAction`, `editCommentAction`, `deleteCommentAction` — that wrap the
Phase 54 DAL (`src/data/reactions.ts`, `src/data/comments.ts`), re-verify auth + ownership/authorship
server-side (no IDOR, no client-trusted ids, Zod `.strict()`), invalidate the correct cache tags, and
fire like/comment notifications with deduplication. Plus the one schema change this requires: a
**SQL migration** adding two partial UNIQUE dedup indexes on `notifications` (the first migration since
Phase 53), pushed to prod this phase.

**In scope:** the four Server Actions (SEC-03); `logNotification` extension (4 new union branches +
`notifyOnLike`/`notifyOnComment` opt-out checks); the like-dedup migration (NOTIF-14) + WR-03 fold;
notification fan-out for likes (NOTIF-11) and comments (NOTIF-12) with self-guard; the cache-invalidation
contract for all reaction/comment write paths (SEC-05); the deduped, groupable like-notification **data**
contract that Phase 58 will render (NOTIF-13). Requirements: **SEC-03, SEC-05, NOTIF-11, NOTIF-12, NOTIF-13, NOTIF-14**.

**Out of scope (later phases):** all UI — LikeButton + optimistic state (Phase 56, LIKE-01..04); comment
compose/list/edit/delete UI, the GATE-03 "Follow X to comment" locked-state, feed activities, profile grid
counts (Phase 57); bell/inbox rendering of the new types, the "X and N others" grouping **render**, and the
Settings opt-out toggles (Phase 58, NOTIF-15/16). No DAL changes — the Phase 54 functions are consumed as-is.

</domain>

<decisions>
## Implementation Decisions

### Dedup migration + WR-03 (Area 1)
- **D-01:** **Two per-type partial UNIQUE indexes** on `notifications`, mirroring the existing
  `notifications_watch_overlap_dedup` exactly:
  - `notifications_watch_like_dedup` on `(user_id, actor_id, (payload->>'watch_id')) WHERE type = 'watch_like'`
  - `notifications_wear_like_dedup` on `(user_id, actor_id, (payload->>'wear_event_id')) WHERE type = 'wear_like'`
  **Rejected:** one combined index across both like types — the target id lives under a different payload key
  per type (`watch_id` vs `wear_event_id`), so a single index would need a `COALESCE(...)` expression for no
  payoff. Two indexes match the Phase 11 precedent and the per-target-table reality (Phase 53 D-01).
- **D-02:** **Fold WR-03 into this phase's migration.** The Phase 53 enum migration
  (`supabase/migrations/20260522000001_phase53_notification_enum.sql`) asserts `enum_count <> 6` (hard-coded),
  which breaks `supabase db reset` replay once a 7th enum value lands. Change it to assert **presence of the 4
  Phase 53 values** rather than an exact total. Phase 55 is the next migration-touching phase — exactly the
  trigger the Phase 54 deferral named. **Note:** editing the already-pushed Phase 53 migration file is for
  *replay correctness* (local resets), not a new prod statement; the planner confirms whether to edit in place
  vs add a corrective migration, but the operator's intent is "fix the assertion."
- **D-03:** **Push to prod in Phase 55.** Same blocking human-action checkpoint pattern as Phase 53-03
  (`supabase db push --linked`, see [[project_drizzle_supabase_db_mismatch]]). Keeps the phase self-contained
  and the dedup actually enforced wherever the actions run. The dedup indexes are `CREATE UNIQUE INDEX` (no
  existing like-notification rows yet, so no duplicate-row risk at creation) — far lower-risk than the
  non-transactional enum `ADD VALUE` of Phase 53. **Rejected:** local-only + batch-prod-later — risks a
  notification write path landing before its dedup index exists in prod.

### NOTIF-13 grouping boundary (Area 2)
- **D-04:** **One deduped notification row per (actor, target).** N likers → N rows (one each), exactly like
  the existing one-row-per-event follow notifications. The D-01 dedup index makes each (recipient, actor, target)
  pair idempotent. **Rejected:** a single mutable "rollup" row per target that appends actor ids — conflicts
  with the per-(actor, target) dedup index and diverges from the established notification model.
- **D-05:** **Phase 55 owns the groupable data contract; Phase 58 renders "X and N others."** NOTIF-13 sits in
  both phases' lists. In Phase 55 it means: rows are stored with correct `actor_id` + target so they CAN be
  grouped, and are never duplicated. The `GROUP BY target` aggregation + "Tyler and 2 others liked your
  Submariner" copy lands in Phase 58 (its SC#2). NOTIF-13's **data shape** is verified in 55; its **visible line**
  in 58. **Rejected:** building the grouped read now in 55 — front-loads work onto a phase with no surface to show it.

### Cache invalidation breadth (Area 3)
- **D-06:** **Comment threads are uncached (research Option A).** CommentThread (Phase 57) renders as a plain
  uncached Server Component inside Suspense. No shared cache ⇒ no gated-thread leak ⇒ **comment create/edit/delete
  actions need NO comments-tag invalidation**; the SEC-05 comment half is satisfied by the *absence* of a shared
  cache, not by viewer-scoped tags. **Rejected:** Option B (viewer-scoped `comments:{id}` + `viewer:{viewerId}`
  tags) — correct but doubles cache entries and adds invalidation surface for a short, flat, low-traffic list;
  premature until scale demands it. (Consequence: the `comments:{type}:{id}` tag from the research taxonomy is
  **not used** this milestone.)
- **D-07:** **Phase 55 wires the FULL cache-invalidation contract** so 56/57 only attach matching `cacheTag()`s
  and never re-touch the actions:
  - `toggleLikeAction` → `revalidateTag(`reactions:{type}:{id}`, 'max')` (cross-user count) **+**
    `updateTag(`viewer:{userId}:reactions`)` (RYO, viewer's own liked state) **+**
    `revalidateTag(`profile:{username}`, 'max')` (the Phase 57 grid count badge on the target owner's profile).
  - `addCommentAction` / `editCommentAction` / `deleteCommentAction` → `revalidateTag(`profile:{username}`, 'max')`
    (grid comment-count badge). No comments-thread tag (D-06).
  Slight over-invalidation (any like anywhere on a profile refreshes that profile's grid envelope) is fine at
  <500 watches/user. **Rejected:** invalidating only this-phase tags and spreading the contract across 56/57.

### Action return contract (Area 4)
- **D-08:** **Actions return server-confirmed rows** so Phase 56/57 optimistic UI reconciles in place
  (Phase 57 SC#4 — "reconciles to the server-confirmed row on success"):
  - `toggleLikeAction` → `ActionResult<{ liked: boolean; count: number }>`
  - `addCommentAction` → `ActionResult<Comment>` (the inserted row incl. `id`, `createdAt`)
  - `editCommentAction` → `ActionResult<Comment>` (incl. `editedAt` for the `[edited]` badge)
  - `deleteCommentAction` → `ActionResult<{ id: string }>`
  **Rejected:** `ActionResult<void>` everywhere relying purely on cache revalidation — turns Phase 57's in-place
  reconcile into a re-fetch round-trip.
- **D-09:** **Gate rejection surfaces as a discriminated error code.** The comment action catches the Phase 54
  `CommentGateError` (D-05 in 54-CONTEXT) and returns a failure carrying a discriminant, e.g.
  `{ success: false, error, code: 'gate' }`, so Phase 57 branches to the GATE-03 "Follow X to comment"
  locked-state vs a generic toast **without string-matching**. Matches D-05's "structurally distinct from a
  generic auth failure" intent. The Phase 57 compose box still gates pre-submit via `canViewerCommentOnTarget`
  (54-CONTEXT D-04/D-06) — the action gate is the **race backstop** (status flips between render and submit).
  This may require extending the `ActionResult` type in `src/lib/actionTypes.ts` with an optional `code` field
  (planner confirms shape; keep the existing `error` string for display).

### Carried-forward mechanics (locked by prior phases / house pattern — not re-decided, but binding here)
- **Action house pattern** (mirror `src/app/actions/follows.ts`): `getCurrentUser()` **first** (catch → "Not
  authenticated"); Zod `.strict()` `safeParse` → "Invalid request"; never trust client-supplied author/target/owner
  ids — derive the actor from `getCurrentUser().id`; resolve target + owner server-side. This is SEC-03.
- **Notifications are AWAITED, not fire-and-forget**, in the action (follows.ts:55-70 rationale): Next 16
  `workAsyncStorage` is torn down when the action returns, so the insert must complete before the bell-cache
  invalidation or the bell refetch races a stale "no unread". The logger's internal try/catch guarantees it never
  throws to the caller, so awaiting preserves "logger failure can't roll back the mutation."
- **Like notifications fire only on `liked === true`** (the create direction of the toggle), never on unlike;
  the logger's existing `if (recipient === actor) return` self-guard (NOTIF-11 "never self-notified") is reused.
- **Comment notifications fire on INSERT only, never on edit** (NOTIF-12); no dedup index for comment types —
  each comment is a distinct event.
- **Caller pre-resolves the notification payload** (logger CALLER CONTRACT, logger.ts:27-32): the action fetches
  the actor profile (`getProfileById`, `@/data/profiles`) for `actor_username`/`actor_display_name`, the target
  watch/wear for `brand`/`model` + the recipient owner-id (`watches.user_id` / `wear_events.user_id`), and (for
  comments) a `comment_preview`. The logger does not fetch.
- **Bell cache invalidation on the recipient**: after a notification insert, `revalidateTag(`viewer:{recipientId}`, 'max')`
  (follows.ts:77 precedent) so the unread dot lights up. (Distinct from the `viewer:{userId}:reactions` RYO tag in D-07.)

### Naming reconciliation (LANDMINE — flag for planner)
- The Phase 54 DAL discriminator is **`{ type: 'watch' | 'wear'; id }`** (`LikeTarget`/`CommentTarget` in
  `reactions.ts`/`comments.ts`) — note **`'wear'`, not `'wear_event'`**. The research doc (ARCHITECTURE.md) was
  written in polymorphic `'wear_event'` terms and is obsolete on this point. Concretely:
  - Cache tag uses the DAL discriminator: `reactions:watch:{id}` / `reactions:wear:{id}`.
  - Notification **enum type** is `watch_like` / `wear_like` / `watch_comment` / `wear_comment` (Phase 53 D-09).
  - Dedup-index **payload key** is `watch_id` (watch_like) / `wear_event_id` (wear_like) — the column-style name.
  Keep these three vocabularies straight; do not let the research's `'wear_event'` discriminator leak into the
  Server Action / cache-tag layer.

### Claude's Discretion
- Whether `toggleLikeAction` reads `viewerHasLiked` (from `getLikesForTarget`, 54-CONTEXT D-07) then branches to
  `createLike`/`deleteLike`, vs a `toggleLike` DAL helper (54-CONTEXT left this to Phase 55). Roadmap names a
  single `toggleLikeAction`, so the action is a single toggle regardless.
- Exact `ActionResult` extension shape for the `code: 'gate'` discriminant (new optional field vs a discriminated
  union) — planner picks the least-disruptive change to `src/lib/actionTypes.ts`.
- Whether the WR-03 fix is an in-place edit of the Phase 53 migration file vs a corrective migration (D-02) — the
  *intent* (assert presence of the 4 values, not an exact count) is locked; the mechanism is the planner's call
  given `supabase db reset` replay semantics.
- Zod schema phrasing for each action (`.strict()` is mandatory; comment body schema must match the DB
  500-char + non-blank CHECK from Phase 53 D-04).
- `CREATE INDEX` vs `CREATE INDEX CONCURRENTLY` for the dedup indexes, and migration filename/sequencing.

### Folded Todos
None matched by `todo.match-phase` (todo_count 0). **WR-03 was a Phase 54 *deferred idea*, not a tracked todo** —
it is folded into scope here per D-02 (see 54-CONTEXT `<deferred>`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — Phase 55 owns **SEC-03, SEC-05, NOTIF-11, NOTIF-12, NOTIF-13, NOTIF-14**.
  GATE-01/04/05 + SEC-02 (Phase 54, complete) and SEC-01/04/06 + LIKE-05 + GATE-02 (Phase 53, complete) constrain
  this phase's behavior. Note NOTIF-13's "X and N others" render is scored in Phase 58 (D-05).
- `.planning/ROADMAP.md` §"Phase 55: Server Actions + Notification Dedup" — the five success criteria are the
  verification contract (server-side auth re-verify + IDOR rejection; like-notif on `liked` only + dedup index;
  rapid like/unlike → at most one notif; comment-notif on every non-self comment; the two named cache tags).

### Research (HIGH confidence — but written in obsolete polymorphic terms; adapt to per-target schema)
- `.planning/research/ARCHITECTURE.md` §3 "Notifications Extension" — payload type sketches, `logNotification`
  union widening + opt-out branches, the like-dedup partial-index strategy, and the "fire only on first like /
  comments never on edit" rules. §5 "Caching Strategy" — the `reactions:{type}:{id}` / `viewer:{userId}:reactions`
  tag taxonomy, the optimistic-UI sketch, and the Server-Action invalidation pattern (`updateTag` RYO +
  `revalidateTag(..., 'max')` cross-user). **Caveat:** the data-model code uses a single polymorphic `reactions`
  table and `'wear_event'` discriminator — both REJECTED by Phase 53/54 (per-target tables, `'wear'` discriminator).
  Read for the *concepts*, not the literal table/column/discriminator names.
- `.planning/research/PITFALLS.md` — notification self-notify, unidirectional mutual-follow, asymmetric gate,
  cascade gap; the relevant pitfalls for the fan-out + cache layers.

### Prior phase context (locked decisions carried forward)
- `.planning/phases/54-dal-reactions-comments-gate-logic/54-CONTEXT.md` — D-05 `CommentGateError` (the action
  catches it → D-09 here); D-07 `getLikesForTarget` returns `{ count, viewerHasLiked }` (feeds `toggleLikeAction`
  + the `{liked,count}` return); D-08 target-discriminated `{type:'watch'|'wear'}` module layout;
  the discretion note that edit/delete DAL was built in Phase 54.
- `.planning/phases/53-schema-rls-enum-extension/53-CONTEXT.md` — D-09 enum `ADD VALUE` x4 (the four notif types
  now exist); D-10 `notify_on_like`/`notify_on_comment` opt-out columns (`logNotification` reads them write-time);
  D-04 comment 500-char + non-blank CHECK (Zod must match); D-11 grandfather (gate keys off current status).

### Code precedents to mirror
- `src/app/actions/follows.ts` — **the action house pattern this phase clones**: `getCurrentUser()`-first →
  `ActionResult` → Zod `.strict()` → DAL call → **awaited** `logNotification` → `revalidateTag('viewer:{recipient}','max')`
  + `updateTag(...)` RYO. Read all 148 lines; both the await-rationale comment (55-70) and the dual-tag
  invalidation (77-91) are directly reused.
- `src/lib/notifications/logger.ts` — `LogNotificationInput` union (add 4 branches) + the opt-out read (add
  `notifyOnLike`/`notifyOnComment` branches) + the `watch_overlap` raw-SQL `ON CONFLICT DO NOTHING` dedup pattern
  (the like types copy this to hit the new partial indexes; Drizzle's default `.onConflictDoNothing()` targets the
  PK and is wrong here — see logger.ts:23-25, 70-83). Self-guard at logger.ts:50-51 covers NOTIF-11/12 "never self".
- `src/lib/notifications/types.ts` — add `WatchLikePayload` / `WearLikePayload` / `WatchCommentPayload` /
  `WearCommentPayload` (shapes sketched in ARCHITECTURE.md §3).
- `src/data/reactions.ts` — `getLikesForTarget` / `createLike` / `deleteLike` (consumed by `toggleLikeAction`;
  `LikeTarget = {type:'watch'|'wear'; id}`).
- `src/data/comments.ts` — `createComment` / `editComment` / `deleteComment` / `getCommentsForTarget` /
  `canViewerCommentOnTarget` / `class CommentGateError` (all wrapped by the comment actions).
- `src/data/follows.ts` — `isMutualFollow` (already used by the comment gate inside the DAL; the action does not
  re-check it — the DAL throws `CommentGateError`).
- `src/lib/actionTypes.ts` — `ActionResult<T>` (extend for the `code:'gate'` discriminant per D-09).
- `src/lib/auth.ts` — `getCurrentUser()` (throws when unauthenticated) + `UnauthorizedError`.
- `src/data/profiles.ts` — `getProfileById` (caller pre-resolves actor profile for the payload).

### Migration precedents (raw SQL is authoritative)
- `supabase/migrations/20260423000002_phase11_notifications.sql` — the partial UNIQUE dedup index +
  `ON CONFLICT DO NOTHING` + anon-block `DO $$` assertion pattern the two like-dedup indexes (D-01) mirror exactly.
- `supabase/migrations/20260522000001_phase53_notification_enum.sql` — **the WR-03 target** (D-02): the
  `enum_count <> 6` hard-coded assertion to change to a presence-of-the-4-values check.
- Phase 53-03 prod-push flow (`supabase db push --linked` as a blocking human-action checkpoint) — the model for
  D-03's prod push. See [[project_drizzle_supabase_db_mismatch]] for the 4 prod-push gotchas.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app/actions/follows.ts` — near-complete structural template for all four actions (auth → validate →
  DAL → await-notify → invalidate). The notification-await rationale and dual-tag invalidation transfer directly.
- `src/lib/notifications/logger.ts` — extend, don't rewrite: the union widens, two opt-out branches are added,
  and the like types reuse the `watch_overlap` raw-SQL `ON CONFLICT DO NOTHING` shape against the new indexes.
- `src/data/reactions.ts` + `src/data/comments.ts` — the entire write/read DAL already exists (Phase 54). The
  actions are thin wrappers; no DAL changes.

### Established Patterns
- **DAL throws typed errors; Server Actions return `ActionResult<T>` and catch.** `createComment` throws
  `CommentGateError` → the action maps it to `code:'gate'` (D-09). Generic failures → `{ success:false, error }`.
- **Two-tag cache discipline** (Phase 39c): `updateTag(...)` for read-your-own-writes (the caller's own state),
  `revalidateTag(tag, 'max')` for cross-user fan-out (state other viewers see). D-07 applies both.
- **Caller-denormalized notification payloads + awaited logger** (Phase 13 + follows.ts) — load-bearing for the
  bell-cache-doesn't-race-the-insert invariant.
- **Raw SQL is authoritative for indexes/CHECK/RLS; Drizzle = column shapes only**; `drizzle-kit push` is LOCAL
  ONLY, prod via `supabase db push --linked` ([[project_drizzle_supabase_db_mismatch]]). The dedup indexes live
  in a raw migration, not Drizzle.

### Integration Points
- New/edited: `src/app/actions/reactions.ts` (NEW — `toggleLikeAction`), `src/app/actions/comments.ts`
  (NEW — `addCommentAction`/`editCommentAction`/`deleteCommentAction`), `src/lib/notifications/logger.ts` (EDIT —
  union + opt-out branches + like-dedup raw SQL), `src/lib/notifications/types.ts` (EDIT — 4 payload types),
  `src/lib/actionTypes.ts` (possible EDIT — `code` discriminant), one new `supabase/migrations/*` (dedup indexes +
  WR-03 fix), `src/db/schema.ts` (the two new indexes if represented in Drizzle).
- Consumed downstream: Phase 56 LikeButton calls `toggleLikeAction` (consumes `{liked,count}` + the
  `reactions:*` / `viewer:*:reactions` tags); Phase 57 comment UI calls the comment actions (consumes the
  `Comment` rows + `code:'gate'` + `profile:{username}` tag); Phase 58 renders the deduped like rows grouped.

### Known landmine (carried into the code)
- `'wear'` (DAL discriminator) vs `'wear_event'` (research doc) vs `wear_like`/`wear_event_id` (enum type /
  payload key) — see the "Naming reconciliation" decision. The single most likely source of a wrong cache tag or
  a dedup index that never fires.

</code_context>

<specifics>
## Specific Ideas

- The four actions should read like `followUser`'s siblings — same auth-first / Zod-strict / await-notify /
  invalidate skeleton, so a reviewer diffing them against `follows.ts` sees the same shape.
- NOTIF-14's "rapid like → unlike → like produces at most one notification" is the headline test: it exercises
  the `liked===true`-only fire **and** the dedup index together. The verification test calls the action (or the
  logger) directly through that churn and asserts a single notification row.
- The WR-03 fix should make the enum assertion future-proof: assert the 4 Phase 53 values are present, so a
  later 7th/8th enum value never breaks `supabase db reset` replay again.

</specifics>

<deferred>
## Deferred Ideas

- **"X and N others liked…" render + grouping** — explicitly Phase 58 (D-05). Phase 55 only guarantees the
  deduped, groupable row data.
- **Settings opt-out toggles UI** (`notifyOnLike`/`notifyOnComment`) — Phase 58 (NOTIF-16). The columns + the
  logger write-time read land here; the toggle UI does not.
- **Comment-thread caching (Option B, viewer-scoped)** — deliberately not built (D-06); revisit only if comment
  volume makes the uncached Suspense render a hot path.
- Future social work (liker-avatar strip, reply fan-out, email digest, @mentions, threaded replies) — tracked in
  `.planning/REQUIREMENTS.md` §"Future Requirements" (SOC-F1…F5). Not this milestone.

### Reviewed Todos (not folded)
None — `todo.match-phase` returned no matches; WR-03 (a Phase 54 deferred idea, not a todo) was folded per D-02.

</deferred>

---

*Phase: 55-server-actions-notification-dedup*
*Context gathered: 2026-05-22*
