# Phase 13: Notifications Foundation - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the notification write path (fire-and-forget logger called from the Follow Server Action and the `addWatch` Server Action), build the bell unread indicator that lives in the nav, build the `/notifications` inbox page with mark-all-read + per-row click semantics, ship the settings opt-out toggles (per NOTIF-09), and stand up renderer-only stub UI templates for Price Drop and Trending notification types so future wiring phases don't have to touch the renderer.

**Out of scope (reaffirmed):** NOTIF-FUT-01 (price drop wiring requires price-tracking infra), NOTIF-FUT-02 (trending wiring requires aggregation/canonical-watch identity), NOTIF-FUT-03 (email digest requires custom SMTP), NOTIF-FUT-04 (real-time push requires Supabase Realtime). NOTIF-01 (table schema) shipped in Phase 11 and is locked.

</domain>

<decisions>
## Implementation Decisions

### Inbox layout & grouping (NOTIF-05, NOTIF-10)
- **D-01:** `/notifications` rows are **compact one-liners** (~48px): `[avatar(sm)] **Actor** verb object · relative-time`. Mobile-first, fast scan; matches the v3.0 "daily wear loop" framing.
- **D-02:** Inbox is grouped by **Today / Yesterday / Earlier** with three sticky sub-headers. No per-day proliferation. Empty buckets are hidden.
- **D-03:** Inbox shows **last 50 notifications, no pagination**. Personal-MVP scale (<500 watches/user). No "Load more", no infinite scroll. Add pagination later when traffic justifies it.
- **D-04:** **No retention cleanup** in this phase — show all forever. Defer cron/cleanup until volume is real. Keeps NOTIF-08 grouping accurate over arbitrary windows.
- **D-05:** NOTIF-10 empty state copy: **"You're all caught up"** with a subtle muted-foreground icon (e.g., `lucide-react` `Check` or `Inbox`).

### Click & read semantics (NOTIF-04, NOTIF-06)
- **D-06:** **Bell unread state uses a separate `notifications_last_seen_at` timestamp on `profile_settings`** (added by a small Phase 13 migration). Bell dot = `EXISTS(notifications WHERE user_id = current AND created_at > profile_settings.notifications_last_seen_at)`. NOTIF-04 must be amended in PLAN to use this query, not raw `read_at IS NULL`.
- **D-07:** **Visiting `/notifications` updates `notifications_last_seen_at = now()`** server-side (via Server Component or a Server Action triggered on mount). Visit clears the bell dot. Rows themselves keep their unread treatment until row-click or "Mark all read".
- **D-08:** **Per-row click** does both: optimistic `read_at = now()` update **and** navigate to target. Single tap. Standard inbox UX.
- **D-09:** **Click-through targets:**
  - Follow notification → `/u/[username]` (actor's profile)
  - Watch-overlap notification → `/u/[username]?focusWatch=[watchId]` (new owner's profile, scrolled to / highlighting the matching watch — recipient sees the overlap in context)
  - Future Price Drop / Trending → TBD when wiring phase ships (renderer doesn't need it yet)
- **D-10:** **"Mark all read" Server Action** (NOTIF-06) sets `read_at = now()` on all rows where `user_id = current AND read_at IS NULL`. Stays as written.
- **D-11:** **Two-state model** explicitly: `notifications_last_seen_at` controls bell visibility; per-row `read_at` controls row visual state. Row-level `read_at IS NULL` no longer drives the bell.

### Row visual structure (NOTIF-05, NOTIF-07, NOTIF-08)
- **D-12:** Row anatomy = `[avatar(sm, clickable→actor)] **Actor name (bold link)** verb object(link if applicable) · relative-time`. Whole row is clickable per D-08; the actor avatar/name link nests inside but resolves to the same target since both navigate to the actor profile.
- **D-13:** **Time format is relative everywhere**: `2h ago`, `3d ago`, `Mar 15` once older than 7d. Reuse the existing `formatRelativeTime` utility from the Phase 10 activity feed — do NOT introduce a new time helper.
- **D-14:** **Unread differentiation** = subtle left border in primary accent color (e.g., `border-l-2 border-l-primary`) + slightly bolder actor name (`font-semibold` instead of `font-medium`). Same treatment in dark mode (primary color is already theme-aware).
- **D-15:** **Watch-overlap aggregated copy** (NOTIF-08 display-time grouping): `**[Most recent actor]** + N others also own your **[Watch model]**` where N is `actor_count - 1`. Most recent actor's avatar is shown (single avatar, not stacked). Clicking the row navigates to the most recent actor's profile per D-09. (If actor_count == 1, render `**Actor** also owns your **Watch**` — no "+ N others" suffix.)

### Settings opt-outs (NOTIF-09)
- **D-16:** **Both opt-outs default ON** — `notify_on_follow boolean DEFAULT true` and `notify_on_watch_overlap boolean DEFAULT true` columns added to `profile_settings` via the same Phase 13 migration that adds `notifications_last_seen_at`. Opt-out model: new users get notifications immediately (social signal is the v3.0 product hook).
- **D-17:** Toggles live in a **new "Notifications" section** on `/settings`, below Profile and Privacy. Future-proof for NOTIF-FUT email-digest toggles.
- **D-18:** **Opt-out is checked at write time, not read time** — the fire-and-forget logger reads the recipient's `profile_settings.notify_on_*` and **skips the insert** when off. This avoids storing notifications the user will never see and keeps the inbox query simple. (NOTIF-09 written this way; reaffirmed.)

### Stub UI templates (NOTIF-07)
- **D-19:** The `NotificationRow` component's render switch handles **all 4 types** (`follow`, `watch_overlap`, `price_drop`, `trending`). Phase 13 only ever inserts `follow` and `watch_overlap` rows. No fixture data is ever inserted for `price_drop` or `trending` — the renderer is complete-but-dormant.
- **D-20:** **Stub copy** is locked now (so future-phase developers don't bikeshed it):
  - Price Drop: `Your **{watchModel}** wishlist watch dropped to **{newPrice}**`
  - Trending: `**{actorCount} collectors** in your taste cluster added a **{watchModel}** this week`
  - Both read from `payload jsonb`. Payload shape: `{ watchModel: string, newPrice?: string, actorCount?: number }`. Locked here as a contract for the future wiring phase.
- **D-21:** **Vitest snapshot test** covers all 4 type renderers using fixture rows constructed inline (no DB seeding). Confirms the stubs render without throwing and the copy matches D-20.

### Watch-overlap matching (NOTIF-03 reaffirmed)
- **D-22:** Brand+model normalized match uses `LOWER(TRIM(brand)) = LOWER(TRIM(brand))` AND same for model. Same `LOWER(TRIM())` discipline on both sides — already mandated by NOTIF-03 wording.
- **D-23:** **Self-actions excluded** for watch-overlap (don't notify yourself when you add a watch that matches another of your own). Implementation: `WHERE owner_user_id != actor_user_id` in the matching query.
- **D-24:** **Self-actions for follow are not a concern** — the application does not support self-follow (existing follow Server Action presumably already rejects this). Add a defensive `if (actor === target) return` in the logger anyway as belt-and-suspenders.

### Bell DAL caching (NOTIF-04 amended)
- **D-25:** Bell unread DAL function is **`'use cache'`-wrapped** with `viewerId` as an explicit function argument (per v3.0 pitfall #3 — leak prevention). Function signature: `getNotificationsUnreadState(viewerId: string): Promise<{ hasUnread: boolean }>`. Returns boolean only (not count) since NAV-06/NAV-07 specify a dot, not a number.
- **D-26:** **`cacheTag(['notifications', \`viewer:${viewerId}\`])` + `cacheLife({ revalidate: 30 })`** — 30s TTL is enough for the dot since visiting `/notifications` invalidates via `revalidateTag('viewer:${viewerId}')` after the seen-at update. Mirror the Phase 10 cache-component pattern.

### Fire-and-forget logger
- **D-27:** New module `src/lib/notifications/logger.ts` exports `logNotification({ recipientUserId, type, payload })`. Wrapped in try/catch internally; on throw, calls `console.error` and returns. Caller never awaits the result. Mirrors the existing `logActivity` pattern from v2.0.
- **D-28:** Two call sites in this phase: `followUser` Server Action (NOTIF-02) and `addWatch` Server Action (NOTIF-03). Both call `logNotification(...)` **without await** and after their primary commit succeeds — so a logger failure cannot roll back the original action.

### Claude's Discretion
- Exact Tailwind class names for D-14 (left border) and D-12 (avatar size). Use existing tokens.
- Choice of `Inbox` vs `Check` vs `BellOff` icon for D-05 empty state.
- Exact `/notifications` page heading text (default to `Notifications`).
- Exact `<section>` ordering and labels in the new settings "Notifications" subsection (D-17).
- Whether the bell DAL returns `{ hasUnread: boolean }` or `{ hasUnread: boolean, lastSeenAt: Date }` — only export what the bell renderer needs.
- File location for the new `NotificationRow` component (probably `src/components/notifications/NotificationRow.tsx` to mirror existing folder convention).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & roadmap
- `.planning/PROJECT.md` — v3.0 milestone framing, Active items, key decisions table
- `.planning/REQUIREMENTS.md` — NOTIF-01..10, NAV-06..07, WYWT-18 acceptance criteria; NOTIF-FUT-01..04 deferral fences
- `.planning/ROADMAP.md` §"Phase 13: Notifications Foundation" — phase goal and requirement IDs

### Prior phase context (locked decisions to honor)
- `.planning/phases/11-schema-storage-foundation/11-CONTEXT.md` — `notifications` table shape, RLS pattern, partial-UNIQUE dedup discussion
- `.planning/phases/12-visibility-ripple-in-dal/12-CONTEXT.md` — viewer-aware DAL cache patterns, `'use cache'` + viewerId discipline

### Schema files (read to confirm current state)
- `src/lib/db/schema.ts` — Drizzle schema for `notifications`, `profile_settings`, `users`, `watches`, `follows`
- `supabase/migrations/` — chronological migration history; NOTIF-01 already shipped in Phase 11 set

### Existing patterns to mirror (Phase 13 should not invent new patterns here)
- `src/lib/activities/logger.ts` (or wherever `logActivity` lives) — pattern for fire-and-forget logger (D-27)
- `src/components/feed/` — relative-time helper `formatRelativeTime` (D-13) reuse target
- `src/lib/data/getTasteOverlapData.ts` (or similar) — `'use cache'` + `viewerId` argument pattern (D-25)
- `src/components/settings/PrivacyToggleRow.tsx` — toggle row component reuse for D-17 settings additions
- `src/app/actions/preferences.ts` — Server Action shape (`ActionResult<T>` return) for the settings opt-out save path

### External docs
- No external specs/ADRs — requirements fully captured in REQUIREMENTS.md and the decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`logActivity` pattern** (v2.0) — fire-and-forget logger with try/catch + console.error. Direct template for `logNotification` (D-27).
- **`formatRelativeTime`** (Phase 10 feed) — relative time formatter. Reuse verbatim for D-13.
- **`PrivacyToggleRow`** — existing toggle row that calls a Server Action and renders an inline error banner via the canonical `ActionResult` shape. Settings opt-out toggles (D-17) should reuse this component, not re-implement.
- **`'use cache'` + `viewerId` pattern** (Phase 10/12) — established in `getTasteOverlapData` and the Phase 12 visibility-ripple DAL functions. D-25/D-26 mirror this exactly.
- **Avatar component** — already exists for profile pages; reuse for D-12 row avatar.
- **`/u/[username]` route + collection grid** — D-09 click-through target. Need to confirm `?focusWatch=[id]` query param wiring; if it doesn't exist, planner adds it as a small task.

### Established Patterns
- **Two-layer privacy** (RLS + DAL WHERE) — applies to notifications DAL: `getNotificationsForViewer(viewerId)` filters `WHERE user_id = viewerId` even though RLS already does. Defense in depth is non-negotiable per v2.0 pitfall.
- **Server Component pages with Suspense** — `/notifications` page should be a Server Component with the inbox in a Suspense boundary (matches Phase 10 cacheComponents pattern; bell stays in the nav which is already wrapped).
- **`ActionResult<T>` discriminated union** for Server Action returns — mark-all-read and opt-out save actions both return this shape.
- **Drizzle migrations via `supabase db push --linked`** for prod — the small migration this phase introduces follows `docs/deploy-db-setup.md` discipline.

### Integration Points
- **Bell** — lives in the nav components added by Phase 14 (Nav Shell). Phase 13 should ship the **bell DAL + bell renderer component** but the nav placement is owned by Phase 14. Phase 13's bell renderer must be drop-in-ready as a child of the nav header.
  - **Sequencing risk:** Phase 13 can land before Phase 14 ships the new nav, but the bell will not be visually present anywhere until Phase 14 wires it. PLAN should document this and add a temporary placement (e.g., in the existing nav placeholder or behind a feature flag) if visibility is needed for UAT.
- **`/notifications` route** — new route. Add to existing app router under `src/app/notifications/page.tsx`.
- **Settings** — adds a new section to `src/app/settings/page.tsx` (or wherever it lives); doesn't replace existing sections.
- **Follow + addWatch Server Actions** — already exist; phase adds `await logNotification(...)` (no, **non-await** per D-28) calls AFTER the primary commit.

</code_context>

<specifics>
## Specific Ideas

- **NOTIF-08 grouping is display-time, NOT write-time.** Each watch-overlap match inserts ONE row per matching collector (so 3 pre-existing owners of a Speedmaster get 3 separate rows when a 4th person adds one). The inbox query collapses these at render time using a `(target_user, payload->>'brand', payload->>'model', date_trunc('day', created_at))` group key. This is more flexible than write-time aggregation (no race conditions, no stale group rows).
- **`payload jsonb` shape for follow notifications:** `{ actorUserId, actorUsername }` — enough to render the row without joining. Avatar URL is fetched server-side via the DAL since avatars rotate.
- **`payload jsonb` shape for watch-overlap notifications:** `{ actorUserId, actorUsername, watchId, watchBrand, watchModel }` — denormalized so the inbox query doesn't join `watches` (which would slow it down at scale).
- **Optimistic update for per-row click** (D-08): client component updates local read state first, then navigates. The Server Action for marking-one-read fires in the background. If the action fails, no rollback (next visit / mark-all-read corrects it). Same forgiveness model as the Phase 12 wear-photo upload optimism.
- **Test fixture for NOTIF-08 grouping** — write a test that inserts 3 watch_overlap rows with the same brand/model/calendar_day and asserts the renderer collapses to one row with `+ 2 others` copy.
- **`notifications_last_seen_at` initial value** for existing users: backfill to `now()` so they don't see a stale "everything is unread" dot the first time the bell ships. New users default to `now()` at row creation.

</specifics>

<deferred>
## Deferred Ideas

- **Notification preferences granularity** — per-actor mute, snooze, "mute notifications for this watch model" → future product phase, not v3.0.
- **Notification grouping window other than calendar_day** — e.g., 6h windows, last-N-minutes — current `calendar_day` per NOTIF-08 is fine for MVP.
- **Email digest of unread notifications** — NOTIF-FUT-03; requires custom SMTP (still off per personal-MVP posture).
- **Real-time WebSocket push** — NOTIF-FUT-04; requires Supabase Realtime (still gated on free-tier WS limit).
- **Stacked avatars for watch-overlap rows** — D-15 chose single most-recent avatar; multi-avatar treatment deferred until aggregated rows feel sparse in real use.
- **Click-through to `/wear/[wearEventId]`** — D5 from STATE.md mentions this for "wear-related" entry points, but Phase 13 has no `wear`-typed notification (WYWT-18 covers feed/search/notifications nav for wear photos that arrive in *future* `wear` notifications, not the follow/watch-overlap types this phase ships). Re-evaluate in the WYWT photo phase if a `wear` notification type is added.
- **Per-row archive / dismiss** — beyond mark-as-read; defer until users complain about inbox bloat.
- **Notification activity in admin/observability dashboards** — defer until ops needs it.

### Reviewed Todos (not folded)
- None — todo match returned 0 matches for Phase 13.

</deferred>

---

*Phase: 13-notifications-foundation*
*Context gathered: 2026-04-22*
