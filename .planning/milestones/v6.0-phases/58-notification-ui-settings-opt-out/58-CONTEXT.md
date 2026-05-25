# Phase 58: Notification UI + Settings Opt-Out - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the four social notification types render in the existing bell/inbox, and add two opt-out toggles in Settings. Specifically:

1. **NOTIF-16** — `watch_like`, `wear_like`, `watch_comment`, `wear_comment` render in the `/notifications` inbox (and light the bell dot) with clear copy that names the actor + target and deep-links to the target watch/wear; repeated likes on the same target collapse into one grouped row.
2. **NOTIF-15** — Settings exposes independent `notifyOnLike` and `notifyOnComment` toggles that suppress future like/comment notification rows.

**This is a UI + settings-wiring phase only.** The backend is already complete:
- The logger (`src/lib/notifications/logger.ts`) already reads `notify_on_like` / `notify_on_comment` and skips inserts when off — so NOTIF-15's suppression mechanism already exists; this phase only adds the UI that flips those columns.
- Payload shapes, dedup partial-UNIQUE indexes, and enum values all exist (Phases 53/55).
- The DAL (`getNotificationsForViewer`) already returns all six types; the bell dot already lights for any unread row.

**NOT in scope:** the home activity feed (FEED-* was delivered in Phase 57 and is complete — see Deferred Ideas for the confirmed likes-in-feed decision); any change to like/comment creation, dedup, or the gate.
</domain>

<decisions>
## Implementation Decisions

### Notification copy / voice (NotificationRow)
- **D-01: Voice = "name the watch, label the wear."** Render strings:
  - `watch_like` → "**{actor}** liked your **{model}**"
  - `wear_like` → "**{actor}** liked your **{model}** wear"
  - `watch_comment` → "**{actor}** commented on your **{model}**"
  - `wear_comment` → "**{actor}** commented on your **{model}** wear"
  - `{model}` = `payload.watch_model` (the worn watch for wear-events). Actor = `actor_display_name ?? actor_username ?? 'Someone'`, matching the existing `follow` / `watch_overlap` rows.
- **D-02: Comment rows show a body preview on a muted second line.** Use `payload.comment_preview` (already stored as `body.slice(0,120)`), clamped (e.g. `line-clamp-2`) in muted/secondary text below the headline line. Like rows have no second line.
- **D-03: Grouped-like phrasing uses the existing "+ N others" convention** (NOT "and N others"): "**{actor}** + {N-1} others liked your **{model}**". This matches the live `watch_overlap` row copy (`NotificationRow.tsx:158-166` "+ {actorCount-1} others also own your…") for inbox consistency. (Note: the ROADMAP SC-2 example text says "and 2 others" — overridden here in favor of inbox consistency.)

### Like grouping (NotificationsInbox)
- **D-04: Likes collapse per (type, target_id, calendar-day) — reuse the existing `collapseWatchOverlaps` pattern.** Generalize/extend the current `collapseWatchOverlaps` collapse so it also groups `watch_like` (key on `payload.watch_id`) and `wear_like` (key on `payload.wear_event_id`) within the same UTC calendar day. Most-recent actor wins for avatar + name; `actorCount` = group size; re-sort newest-first after merge — identical mechanics to today's overlap collapse (`NotificationsInbox.tsx:76-110`).
- **D-05: Comments are never grouped.** Each comment is a distinct event (NOTIF-12, no dedup index) → one row each, pass through the collapse unchanged (like `follow` does today).
- **D-06: Read-state / bucketing follow the existing precedent.** Grouped like rows keep the current behavior: the displayed (most-recent) row's `id` is what `markNotificationRead` targets on tap; Today/Yesterday/Earlier bucketing (`bucketByDay`) is unchanged. Do not invent new read semantics for grouped rows.

### Deep-links (NotificationRow.resolveHref)
- **D-07: Rows land on the target detail page, no scroll-anchor.**
  - `watch_like` / `watch_comment` → `/watch/{payload.watch_id}`
  - `wear_like` / `wear_comment` → `/wear/{payload.wear_event_id}` (the conventional permalink with inline comments, per Phase 56a SC-3 — NOT `/wears/[username]`)
  - Comment rows do NOT use `payload.comment_id` to scroll/anchor to a specific comment. Comment threads render newest-first (Phase 57), so a freshly-notified comment is already at the top of the list. Avoids anchor-id + scroll-into-view wiring on both hosts.
- **D-08: Flip the B-8 unknown-type guard for the four new types.** `NotificationRow.tsx:52` currently early-returns `null` for anything that isn't `follow`/`watch_overlap`. Phase 58 extends the render path (guard + `resolveHref` + `resolveCopy`) to cover the four new types. Keep a null fallback for any genuinely-unknown future type.

### Settings (NotificationsSection)
- **D-09: Add `notifyOnLike` + `notifyOnComment` to the existing section AND rename the section title "Email notifications" → "Notifications".** These toggles (and the pre-existing follow/overlap toggles) gate *in-app* notification rows via the logger — there is no email send wired to them (verified: no Resend/sendEmail path touches `notify_on_*`). The "Email" heading is a misnomer; rename it so all four toggles read as accurate in-app controls. One coherent section with four `PrivacyToggleRow`s.
- **D-10: New toggle labels + copy follow the existing `PrivacyToggleRow` style:**
  - **Likes** — "Get notified when someone likes your watches or wear posts." → `field="notifyOnLike"`
  - **Comments** — "Get notified when someone comments on your watches or wear posts." → `field="notifyOnComment"`
  - Persist via the same mechanism the existing follow/overlap toggles use (`PrivacyToggleRow` → its Server Action). The columns already exist (`profile_settings.notify_on_like` / `notify_on_comment`, `schema.ts:273-274`).
- **D-11: Suppression is already enforced server-side.** SC-3 ("toggle off → no new like row") is satisfied by the existing logger reads (`logger.ts:99-105`). No logger change needed — only the toggle UI + persistence + the `ProfileSettings` prop on `NotificationsSection` widened from the current `Pick<…, 'notifyOnFollow' | 'notifyOnWatchOverlap'>` to also include `'notifyOnLike' | 'notifyOnComment'`.

### Claude's Discretion
- Exact Tailwind classes / spacing for the muted comment-preview second line (follow `NotificationRow` + UI-SPEC conventions).
- Whether to refactor `collapseWatchOverlaps` into a generalized `collapseRows(types, keyFn)` helper vs. adding parallel collapse branches — planner/executor choice, as long as D-04/D-05 behavior holds.
- Test shape (unit vs integration) for grouping + opt-out wiring, following Phase 55/57 Nyquist patterns.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` §NOTIF-15, §NOTIF-16 — the two requirements this phase closes.
- `.planning/ROADMAP.md` → "Phase 58: Notification UI + Settings Opt-Out" — goal + 3 success criteria.

### Notification UI (the surfaces to modify)
- `src/components/notifications/NotificationRow.tsx` — the row renderer. The B-8 guard (line 52), `resolveHref` (116-134), and `resolveCopy` (136-180) all currently no-op the four new types; `NotificationRowData` (19-32) already carries `actorCount` for grouping. THIS is the primary edit target.
- `src/components/notifications/NotificationsInbox.tsx` — `collapseWatchOverlaps` (76-110) + `bucketByDay` (123-145). Extend the collapse to like types (D-04).
- `src/lib/notifications/types.ts` — payload field shapes for all four new types (`watch_id`, `wear_event_id`, `watch_model`, `comment_id`, `comment_preview`). Field names are load-bearing (must match dedup index expressions).
- `src/data/notifications.ts` — `getNotificationsForViewer` (already returns all 6 types), `getNotificationsUnreadState` (bell dot, type-agnostic). No change expected; read to confirm.
- `src/app/notifications/page.tsx` — inbox page (fetches 50, renders `NotificationsInbox`). No change expected.

### Settings UI (the toggle target)
- `src/components/settings/NotificationsSection.tsx` — the section to extend + rename (currently 2 toggles, titled "Email notifications").
- `src/components/settings/PrivacyToggleRow.tsx` — the reusable toggle row + its Server Action (the persistence path for the two new toggles).
- `src/data/profiles.ts` — `ProfileSettings` type (the `Pick<…>` on `NotificationsSection` props must widen).
- `src/db/schema.ts:267-274` — `profile_settings` notify columns; `notify_on_like` / `notify_on_comment` already exist with `DEFAULT true`.

### Backend that is already done (read for confirmation, do NOT modify)
- `src/lib/notifications/logger.ts` — opt-out reads (99-105) already suppress like/comment rows; dedup ON CONFLICT branches for likes.
- Prior decisions: `.planning/phases/55-server-actions-notification-dedup/55-CONTEXT.md` — notification logger/dedup decisions (D-18 opt-out, caller pre-resolves actor profile into payload).

### Activity feed (confirmed NOT in scope)
- `src/data/activities.ts` + `src/components/home/ActivityRow.tsx` — `ActivityType` includes `'commented'` (Phase 57 FEED-06) but NOT `'liked'` (deliberate). Read only to confirm the feed is already complete.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`collapseWatchOverlaps` (NotificationsInbox.tsx:76-110)** — proven display-time grouping: group-by-key map, most-recent-actor-wins, `actorCount`, newest-first re-sort. Like grouping (D-04) reuses this verbatim with a like-aware key function.
- **`PrivacyToggleRow` (settings)** — the exact toggle component + Server Action the two new toggles plug into; the existing `notifyOnFollow`/`notifyOnWatchOverlap` rows are the copy/structure template.
- **`AvatarDisplay` + `timeAgo` + the `actorClass` unread-weight pattern** in NotificationRow — reuse for the new rows' avatar, timestamp, and bold-when-unread actor name.
- **`NotificationRowData.actorCount` field** — already exists on the row type for exactly this grouping use.

### Established Patterns
- **Unknown-type null guard (B-8)** — `NotificationRow` returns `null` for any type it can't render. Phase 58 adds the four new render branches and keeps the null fallback for forward types.
- **In-app opt-out via `profile_settings.notify_on_*` read at write-time** (logger D-18) — toggles persist to columns; logger gates on them. No per-type send-time UI logic needed beyond the toggle.
- **Deep-link routing convention** — `/watch/[id]` and `/wear/[wearEventId]` (permalink) are the canonical targets (Phase 56a).

### Integration Points
- `NotificationsSection` props (`ProfileSettings` `Pick`) must widen to include `notifyOnLike | notifyOnComment`, and the Settings page that renders it must pass those fields through.
- `resolveHref`/`resolveCopy` read `payload` fields by the exact names in `types.ts` — `watch_id`, `wear_event_id`, `watch_model`, `comment_preview`.
</code_context>

<specifics>
## Specific Ideas

- Render targets, verbatim: "Tyler liked your Submariner" / "Tyler liked your Submariner wear" / "Tyler commented on your Submariner" / "Tyler commented on your Submariner wear" / grouped: "Tyler + 2 others liked your Submariner".
- Comment row second line = muted, clamped comment body preview (e.g. "Beautiful patina on that dial, where did you source it?").
- Settings section reads: **Notifications** → New Followers · Watch Overlaps · Likes · Comments (four toggles).
</specifics>

<deferred>
## Deferred Ideas

- **Likes in the home activity feed — explicitly NOT added (confirmed 2026-05-24).** The user asked to verify the home feed covers the new events. Confirmed: comments already surface in the feed (Phase 57 FEED-06, verb "commented on", with the FEED-07 mutual-follow gate); likes are intentionally bell-only (operator decision 2026-05-22 — keep likes a quiet signal, don't flood the feed). Decision re-affirmed: likes stay out of the feed. Revisiting would be new FEED scope (a `'liked'` ActivityType + DAL + render) and belongs in its own future phase, not Phase 58.
- **Scroll-anchoring comment deep-links to a specific comment** (using `payload.comment_id`) — deferred; newest-first ordering makes plain page-landing sufficient. Revisit only if comment threads grow long enough that the notified comment isn't near the top.

### Reviewed Todos (not folded)
None — no pending todos matched Phase 58.
</deferred>

---

*Phase: 58-notification-ui-settings-opt-out*
*Context gathered: 2026-05-24*
