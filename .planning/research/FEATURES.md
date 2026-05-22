# Feature Research: v6.0 Social Interaction — Likes + Comments

**Domain:** Scoped social interaction layer on a personal watch collection intelligence app
**Researched:** 2026-05-22
**Confidence:** HIGH — behavior patterns drawn from established collector/hobby platforms (Letterboxd, Goodreads, Rdio); interaction patterns (like toggle, flat comments, notification dedup) are well-documented and stable; Horlo-specific gating rules confirmed from SEED-012 + PROJECT.md locked decisions

---

## Scope Note

This file covers ONLY the new likes and comments features in v6.0. Existing features — notifications infrastructure (Phase 13), follow graph (Phases 7–10), wear events (Phase 15), and profile surfaces (`/u/[username]/[tab]`) — are treated as pre-existing dependencies, not as features to spec.

The locked scope from SEED-012 + PROJECT.md:
- **Like targets:** individual `watches` rows + individual `wear_events` rows — open to any authenticated user
- **Comment targets:** same individual rows — flat (no threads), authors can edit + delete their own
- **Comment access asymmetry:** open on owned/sold/grail watches + wears; **mutual-followers-only** on wishlist watches
- **Guardrail:** scoped and tasteful — explicitly NOT "Instagram for watches"
- **Out of scope this milestone:** threaded replies, report/hide, moderation tooling

---

## Category 1: Likes

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Like toggle (heart/thumbs icon) on watch rows and wear events | Any social-interaction surface users encounter in 2024+ — Letterboxd, Goodreads, Discord — has a like affordance on individual content items | LOW | Toggle must be a single tap/click; not a hold, not a menu |
| Optimistic UI — icon flips immediately on tap | Users interpret any lag on a like as a broken button; half-second wait to confirm kills the interaction rhythm | LOW | Revert + surface error if server rejects; use `useOptimistic` (already established in the codebase — NotificationRow uses it) |
| Like count visible on the item | Count signals validation without requiring a full likers list; standard pattern on Letterboxd, GitHub reactions, Goodreads | LOW | Show `0` or hide until first like; decide once — see differentiators |
| Authenticated-only like; unauthenticated users see a locked state | Anonymous users clicking a like → redirect to auth or inline prompt; no silent no-op | LOW | Horlo proxy enforces auth globally; public profile viewers who aren't logged in will be on public routes — handle gracefully |
| Like is idempotent — rapid double-tap does not double-count | Rapid taps on mobile are common; double-insert must be prevented at DB level | LOW | UNIQUE constraint on `(user_id, target_id, target_type)` enforces this; UI debounce as first layer |
| Own watch: viewing user can still like their own wear events and watches | Letterboxd lets you "like" your own lists — not blocked; it signals self-endorsement | LOW | SEED-012 says likes are open; no self-block mandated |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Like count hidden until N>0, then shown | Cleaner empty state on unworn / new watches; no "0 likes" anxiety signal | LOW | Show count only when count >= 1; empty = no counter at all |
| Liker avatars strip (AvatarStack) for small-N likes | "3 people you follow liked this" is warmer than a raw count; Letterboxd does this for friends' ratings | MEDIUM | Cap at 3-5 avatars + overflow count; only viewers the current user follows — requires a JOIN on the follows table; defer if expensive |
| "You liked this" persistent state on re-visit | User can see at a glance which watches they've already liked when browsing other profiles | LOW | Already implicit if like state is loaded per-viewer from DB; confirmed by the authenticated viewer's like row |
| Viewer's own like highlighted in count tooltip | On hover/focus: "You and 4 others" — personalizes the count | LOW | Optional; useful on desktop; skip on mobile where tooltips are awkward |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Public "who liked this" list (full likers roster) | Transparency; social proof | Turns a like into a public endorsement record; creates social pressure around who liked what; directly contradicts "not Instagram" guardrail; Instagram itself removed public like counts in 2021 for this reason | Show count only; no full likers list in v6.0 |
| Like leaderboards / "most-liked watches" on explore | Popularity signal | Popularity-based feeds are the core Instagram mechanism being avoided; shifts collector attention from taste to validation-seeking | Trending Watches on /explore already uses Horlo's algorithmic signals, not like counts |
| Animated like burst (heart explosion, like Instagram Stories) | Feels expressive | Draws excessive attention to the interaction itself; moves toward Instagram aesthetic | Subtle icon fill/color change is sufficient |
| Like reactions (multiple emoji types) | Nuance | Adds a reaction taxonomy decision, rendering complexity, and DB schema variance; not appropriate for a collector app | Single like; collectors express nuance through comments |
| Like required before commenting | Prevents low-effort drive-by comments | Breaks natural comment flow; artificial gate | No gate; likes and comments are independent |

---

## Category 2: Comments

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Compose box visible under comments section on eligible watch / wear | Users expect to comment without navigating away; inline compose is required | LOW | Authed user only; unauthenticated → auth prompt |
| Submit on Enter (with Shift+Enter for newline) or submit button | Keyboard users expect Enter to submit short-form social comments; Shift+Enter for multi-line is established muscle memory | LOW | Standard textarea behavior |
| Character limit enforced with visible counter | Comments longer than ~500 characters shift toward blog-post territory; a counter near the limit prevents frustration-on-submit | LOW | Recommend 500 char max; counter appears at 400 (80%) and changes color at 480 (96%); hard block at 500 |
| Empty comment blocked at client AND server | Submitting whitespace-only comment must not create a DB row | LOW | Trim + validate length > 0 before Server Action fires; Server Action validates again (two-layer) |
| Comments ordered chronologically ascending (oldest first) | Consistent with all non-threaded comment surfaces: product detail pages, GitHub issues, Letterboxd film reviews, Goodreads book reviews | LOW | Newest-at-bottom places the compose box at the natural end of the thread |
| Author's own comments: Edit button inline | Standard on every non-threaded comment surface (GitHub, Letterboxd, Discord) | MEDIUM | Edit in-place (expand textarea pre-filled with existing text); not a modal |
| Author's own comments: Delete button inline with confirmation | Standard pattern; Goodreads, Letterboxd, GitHub all have it | LOW | Soft confirm ("Delete comment?" with Cancel/Delete) — not a disruptive dialog; one-row inline confirm is cleaner |
| Edited flag ("[edited]" label after edit timestamp) | Comment credibility: readers know the text was changed after posting | LOW | Show "edited" badge next to timestamp; no revision history needed |
| Comment count visible on the item card | Users scanning a profile grid should know which watches have discussion without opening them | LOW | Show count; 0 = no badge (or "Be first to comment" on detail view) |
| Loading state during submit | Prevent double-submit; show that the action is in flight | LOW | Button disabled + spinner during Server Action pending state |
| Error state if submit fails | Network failures happen; user must know their comment was NOT saved | LOW | Inline error below compose box; preserve draft text so user can retry |
| Empty state when no comments yet | Silence reads as broken; a soft prompt encourages the first commenter | LOW | "No comments yet. Add one." — not a heavy empty-state illustration |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Inline edit (no modal) | Keeps the user in context; modal-on-edit is disruptive for a short-form comment | MEDIUM | Replace comment text with editable textarea + Save/Cancel in the same row |
| Comment count on profile grid cards | Encourages interaction discovery; user sees "3 comments" on a card and is drawn to open it | LOW | Piggybacks on the existing ProfileWatchCard component |
| Comment author avatar + username link | Collector context: clicking a commenter navigates to their profile — consistent with the Rdio-style discovery flow | LOW | Reuse existing avatar + username link patterns from the follow/profile surfaces |
| Optimistic comment append on submit | Comment appears in thread immediately before server confirms; rolls back with error if rejected | MEDIUM | Use `useOptimistic` (same pattern as NotificationRow); new comment appears grayed out until confirmed |
| Relative timestamps ("2h ago", "3d ago") | Warmer and less clinical than absolute dates on conversational content | LOW | Absolute date on hover/focus for accessibility |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Threaded replies / nested comments | Richer conversation | Threads require reply targeting, UI nesting, depth limiting, and collapse affordances — materially more complex; SEED-012 locks this out explicitly | Flat comments only; threads are a future-milestone decision |
| Comment reactions (react to a specific comment) | Expressiveness | Compounds the like taxonomy decision with a per-comment reaction layer; no clear ROI at small scale | Single like on the parent item covers the reaction use case |
| Mention / @username tagging in comments | Social discoverability | Requires a mention autocomplete UI, parsed storage format, and a new notification type; scope-creep in this milestone | Plain text comments; mentions can be added later |
| Markdown formatting in comments | Power-user expressiveness | Inconsistent render across surfaces; moderation-harder (hidden links); collector comments are conversational, not editorial | Plain text; no Markdown |
| Comment pinning by post owner | Highlight best comment | Adds owner-privilege layer; no clear need at small scale | Not needed; flat chronological order is sufficient |
| Report / hide / moderation queue | Community safety | Explicitly out of scope per PROJECT.md + SEED-012 at single-user scale; no moderation tooling this milestone | SEED-012 decision: revisit when scale warrants it |
| Anonymous or display-name-only comments | Guest commenting | Contradicts the authenticated-only posture; breaks notification linkback; leaves no audit trail | All comments require auth; username is visible |
| Comment export / history view | Transparency | No clear collector use case; adds admin surface complexity | Not needed in v6.0 |

---

## Category 3: Like + Comment Counts and Display

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Count on the item detail page (watch detail, wear detail) | Users need to know social signal at a glance when viewing the item | LOW | Like count + comment count displayed near the interaction affordances |
| Count on profile grid cards | Without counts on the grid, users cannot tell which items have social activity; they must open every card | LOW | Show like count and/or comment count on ProfileWatchCard |
| Counts update after user's own action without full page refresh | If user likes a watch and the count stays at 0, they assume the tap failed | LOW | Count updated via optimistic state immediately; confirmed by server response |
| Comment count links to or scrolls to comment section | A count that doesn't navigate anywhere is a dead end | LOW | Tap comment count → scroll to / expand comments section |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Combined "N likes · N comments" single line | Compact: collector grid cards are small; a combined summary line uses one row instead of two | LOW | Format: "4 likes · 2 comments" or icons + counts inline |
| Count disappears when zero (not "0 likes") | Cleaner visual on items with no social activity; avoids "nobody cared" signal on every item | LOW | CSS conditional — hide the row entirely when both counts are 0 |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Live count polling / Supabase Realtime subscription | "Real-time" counts feel modern | Supabase Realtime is capped at 200 concurrent WebSockets on the free tier; PROJECT.md Key Decision explicitly rejected Realtime in v2.0; the collector use case does not need sub-second count updates | SWR via `revalidateTag` on like/comment write; `router.refresh()` on own action |
| Separate "likes" tab / page showing all liked watches | Bookmarking use case | Wishlist already serves the "I want to track this watch" intent; a separate likes tab is a second tracking surface with unclear differentiation | Wishlist = intent; likes = affirmation signal only |

---

## Category 4: Privacy Gating — Mutual-Follow Wishlist Comments

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Non-mutual viewer sees wishlist watch comment section as locked | Any privacy gate must communicate clearly that the section exists but is restricted — not a 404 or blank silence | LOW | Example copy: "Comments on wishlist watches are visible to mutual followers." with a "Follow [username]" CTA if the viewer does not yet follow them |
| Owner always sees their own wishlist comments | Owner is not gated on their own content | LOW | DAL query includes `viewer_id = owner_id` bypass |
| Mutual-follow check is bidirectional at query time | Gate requires A follows B AND B follows A — not just one direction | LOW | Two-row check on `follows` table: `EXISTS(... followerId=viewer AND followingId=owner)` AND `EXISTS(... followerId=owner AND followingId=viewer)` |
| Writing a wishlist comment blocked for non-mutual viewers | Gate applies to both reading AND writing | LOW | Compose box hidden or disabled with the locked-state explanation |
| Likes on wishlist watches remain OPEN (asymmetry preserved) | SEED-012 decision: "Confirm the asymmetry is intended: likes are open even on wishlists, but wishlist comments are mutual-follow gated." — confirmed in PROJECT.md | LOW | Like button visible and functional to any authed user regardless of follow relationship |
| Gate message does not reveal comment content | The locked state must not leak comment counts or previews to non-mutual viewers | LOW | Count display on wishlist cards suppressed for non-mutual viewers; detail page shows locked state without count |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| "Follow [username] to unlock comments" CTA in locked state | Reduces friction for interested viewers who aren't yet mutual follows; converts the gate into a follow prompt | LOW | Only show if viewer does NOT already follow the owner (following but not followed back = show "waiting for them to follow back" copy) |
| Locked state distinguished visually from "no comments yet" | User should immediately distinguish "gated" from "empty" — different icon/copy | LOW | Lock icon + brief explanation vs paperclip/speech-bubble icon + "be first to comment" |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Gated comment count (show "3 comments, unlock to read") | Curiosity hook to drive follows | Creates FOMO pressure; contradicts the "not Instagram" guardrail; exposing counts behind a gate is the same psychological mechanism as Instagram's follower-gated stories | Show no count to non-mutual viewers; locked state is the only signal |
| Temporary preview (first comment visible, rest locked) | Reduces friction | Preview of locked content is still a data leak; it also feels like a paywall tease, not a social-warmth gate | Full gate or no gate |
| Per-watch opt-out for wishlist comment gating | Granularity | Watch-level override adds a settings surface per watch, inconsistent with the product's "simple by default" posture | Consistent policy: all wishlist watches gate comments for non-mutuals |
| Comments on whole-collection/wishlist surfaces (not per-watch) | "Comment on my friend's wishlist" in SEED-012 verbatim | SEED-012 also asks "comment on the whole collection/wishlist as a surface, or on individual watches?" — PROJECT.md locked scope to individual watches + wear events; collection-surface comments are out of scope this milestone | Per-watch and per-wear only |

---

## Category 5: Notifications Extension

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Notification when someone likes your watch or wear | Standard social affordance: Letterboxd, Goodreads, GitHub all notify on like | LOW | Extend existing `notification_type` enum with `like_watch` and `like_wear` values (following the Phase 24 rename+recreate pattern — ALTER TYPE has no DROP VALUE) |
| Notification when someone comments on your watch or wear | Equivalent to a comment reply in a flat system | LOW | Extend `notification_type` enum with `comment_watch` and `comment_wear` values |
| Self-like and self-comment do NOT generate notifications | Existing `logNotification` self-guard (D-24) covers this; extend to new event types | LOW | DAL self-guard: `if (actorId === recipientId) return` |
| Dedup: multiple likes on same item from different users group into one notification (time-windowed) | Prevents like-flood noise; existing partial UNIQUE index dedup pattern applies | MEDIUM | Dedup window per recipient + item; "5 people liked your Rolex Submariner" collapses to one notification row using existing partial UNIQUE pattern |
| Notification links to the item that received the interaction | Notification is useless without a deeplink; must navigate to the watch detail or wear detail page | LOW | `watch_id` or `wear_event_id` stored on the notification row; link to `/watch/[id]` or `/wear/[wearEventId]` |
| Like/comment notifications respect existing opt-out settings | Existing `notifyOnFollow` / `notifyOnWatchOverlap` opt-out pattern in Settings → Notifications | MEDIUM | Add `notifyOnLike` and `notifyOnComment` opt-out toggles in settings; both default ON |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Grouped notification copy: "Tyler and 2 others liked your Submariner" | Warmer and less noisy than 3 separate notifications | MEDIUM | Requires the existing notification collapsing logic (NotificationsInbox `watch_overlap` collapse pattern from Phase 13) applied to like events; reuse the time-window dedup index |
| First comment on your watch shows comment preview text | "Tyler commented: 'This lume is incredible'" is more engaging than "Tyler commented on your Submariner" | LOW | Store a short preview (100 chars) on the notification row or truncate the body on render |
| Comment-reply-to-me notification (someone comments after me on the same item) | Surfaces conversation threads to participants | MEDIUM | Track "commenters on item X" and notify all prior commenters when a new comment arrives; opt-out-able; do NOT notify if the new commenter is you |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Email notification for every like/comment | Reach users who don't check the app | Like-volume emails will train users to unsubscribe from ALL Horlo emails, poisoning the auth email reputation on `mail.horlo.app` (Resend) | In-app notifications only in v6.0; email digest is a future-milestone decision after measuring like/comment volume |
| Push notifications (browser push / PWA) | Real-time reach | No service worker / PWA infrastructure exists; adds significant scope for an MVP social layer | Not in v6.0; revisit at v7.0+ or when PWA investment is justified |
| Like notification suppressed below threshold ("notify me only after 5 likes") | Noise reduction | Adds a settings UI with a number input; complexity without clear demand at single-user scale | Default dedup window covers the burst case; simple ON/OFF opt-out is sufficient |
| Notification sound or badge on browser tab | Presence signal | No PWA infrastructure; tab badge requires service worker; these features belong to a native or PWA tier | Not in v6.0 |

---

## Feature Dependencies

```
Likes (toggle + count)
    └──requires──> watches table (per-user rows) — existing
    └──requires──> wear_events table — existing
    └──requires──> follows table (for liker-avatar strip, if built) — existing
    └──requires──> New: likes table (target_type, target_id, user_id, created_at)

Comments (compose + edit + delete)
    └──requires──> watches table — existing
    └──requires──> wear_events table — existing
    └──requires──> follows table (for mutual-follow gate) — existing
    └──requires──> New: comments table (target_type, target_id, author_id, body, edited_at)

Wishlist comment gate
    └──requires──> follows table bilateral check — existing
    └──requires──> watches.status = 'wishlist' check — existing

Notification extension
    └──requires──> notifications table + notification_type enum + logNotification DAL — existing (Phase 13)
    └──requires──> notifyOn* opt-out columns on profiles/user_preferences — existing (Phase 13)
    └──requires──> follows table (self-guard) — existing
    └──requires──> Enum extension: like_watch, like_wear, comment_watch, comment_wear added via rename+recreate (Phase 24 DEBT-04 canonical pattern)

Like/comment counts on profile grid cards
    └──requires──> ProfileWatchCard component — existing
    └──requires──> Like + comment count columns or sub-selects in getWatchesByUsernameForViewer DAL

Like/comment counts on wear detail
    └──requires──> /wear/[wearEventId] route — existing (Phase 15)
    └──requires──> getWearEventForViewer DAL extended with counts

Two-layer privacy on likes and comments
    └──requires──> Existing two-layer privacy pattern (RLS + DAL WHERE) — existing
    └──requires──> RLS policies on new likes/comments tables scoped to authenticated users + owner visibility
```

### Dependency Notes

- **Enum extension (notification_type):** The Phase 24 `rename+recreate` pattern is the canonical approach — `ALTER TYPE … DROP VALUE` does not exist in Postgres. The partial UNIQUE index on notifications must survive the recreation. This is a known footgun; plan a migration task explicitly.
- **Comments before notifications:** The comments table must exist before the notification event can reference `comment_id`. Comments DB migration is a hard prerequisite for the notification extension.
- **Likes before comment-like gating:** Likes have no access gate (open to any authed user). Comments have the wishlist gate. These are independent; they can be built in parallel but the gate logic must not bleed across.
- **Two-layer privacy on new tables:** Every new table (likes, comments) needs both RLS at DB and explicit DAL WHERE predicates. Do not rely on RLS alone — this is the established two-layer posture from v2.0 through v5.x.
- **ProfileWatchCard count display:** Counts require either a JOIN+COUNT in the existing DAL read (preferred — avoids N+1) or a denormalized counter column updated on like/comment write. At <500 watches per user (PROJECT.md performance target), a JOIN+COUNT is acceptable. Denormalized counters are premature optimization.
- **Cache invalidation:** Like/comment writes must call `revalidateTag` on the affected profile and item pages. The existing pattern (`updateTag` for read-your-own-writes, `revalidateTag('max')` for other-user invalidation) applies directly.

---

## MVP Definition

### v6.0 Phase 1: Likes

- [ ] Like toggle on `/watch/[id]` watch detail (owner view) + `/u/[username]/collection` card — open to any authed user
- [ ] Like toggle on `/wear/[wearEventId]` wear detail
- [ ] Like count displayed; hidden when 0
- [ ] Optimistic toggle via `useOptimistic`
- [ ] Notification: `like_watch` and `like_wear` events with dedup + opt-out
- [ ] Two-layer RLS + DAL privacy on likes table

### v6.0 Phase 2: Comments

- [ ] Comment compose/submit on watch detail + wear detail
- [ ] Character limit (500), empty validation, submit button + Enter key
- [ ] Chronological flat display, author avatar + username link
- [ ] Edit own comment (inline) + delete own comment (inline confirm)
- [ ] "[edited]" flag on modified comments
- [ ] Comment count on watch cards and wear detail
- [ ] Wishlist comment gate: mutual-follow check + locked-state UI + like-remains-open asymmetry
- [ ] Notification: `comment_watch` and `comment_wear` events with dedup + opt-out
- [ ] Two-layer RLS + DAL privacy on comments table

### Add After Validation (v6.x)

- [ ] Optimistic comment append (adds after core submit flow is stable)
- [ ] Liker avatars strip (AvatarStack) — requires follow-aware JOIN; validate count display is sufficient first
- [ ] `notifyOnLike` + `notifyOnComment` opt-out toggles in Settings → Notifications
- [ ] Comment-reply-to-me notification (commenters on same item)

### Future Consideration (v7+)

- [ ] Mention / @username tagging
- [ ] Email digest for social notifications
- [ ] Comment pinning
- [ ] Threaded replies (full scope reassessment needed)

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Like toggle + optimistic UI | HIGH | LOW | P1 |
| Like count display | HIGH | LOW | P1 |
| Notification: like events | HIGH | LOW | P1 |
| Comment compose + submit | HIGH | LOW | P1 |
| Comment list (flat, chronological) | HIGH | LOW | P1 |
| Edit + delete own comment | HIGH | LOW | P1 |
| Comment count on cards | HIGH | LOW | P1 |
| Wishlist comment gate (mutual-follow) | HIGH | MEDIUM | P1 |
| Two-layer RLS on likes + comments tables | HIGH | MEDIUM | P1 — non-negotiable privacy |
| Notification: comment events | HIGH | MEDIUM | P1 |
| `notifyOnLike` + `notifyOnComment` opt-out | MEDIUM | LOW | P2 |
| "[edited]" flag on edited comments | MEDIUM | LOW | P2 |
| Optimistic comment append | MEDIUM | MEDIUM | P2 |
| Relative timestamps on comments | MEDIUM | LOW | P2 |
| Like count hidden when 0 | MEDIUM | LOW | P2 |
| "Follow to unlock" CTA in gate | MEDIUM | LOW | P2 |
| Grouped like notification copy | MEDIUM | MEDIUM | P2 |
| Comment preview in notification | LOW | LOW | P2 |
| Liker AvatarStack | LOW | MEDIUM | P3 |
| Comment-reply-to-me notification | LOW | MEDIUM | P3 |

---

## Comparable Product Patterns (Evidence Base)

| Behavior | Letterboxd | Goodreads | GitHub Issues | Horlo v6.0 Decision |
|----------|-----------|-----------|---------------|---------------------|
| Like target | Individual film log entry | Review | Comment / Issue | Individual watch row + wear event |
| Threads | Yes (reply to review) | Yes | Yes | NO — flat only |
| Comment order | Newest-first | Oldest-first | Oldest-first | Oldest-first (natural thread read) |
| Who liked list | Friends who liked (subset) | No | Reaction list visible | No full list — count only |
| Edit own comment | Yes | Yes | Yes | Yes, inline |
| Delete own comment | Yes | Yes | Yes | Yes, with inline confirm |
| Gated comments | No | No | No | Yes — wishlist surface, mutual-follow only |
| Notification dedup | Grouped (N people liked) | Minimal | Grouped (subscriptions) | Grouped by item + time window |
| Report/moderation | Yes | Yes | Yes | NOT in v6.0 |

---

## Sources

- SEED-012 v6.0 Social Interaction seed spec (primary source — all locked decisions originate here)
- PROJECT.md v6.0 milestone section + Key Decisions log — confirms asymmetry, per-item target scope, notification extension approach
- Phase 13 (notifications DAL + `logNotification` + `notification_type` enum + partial UNIQUE dedup) — baseline for notification extension
- Phase 15 (wear events + `/wear/[wearEventId]` route) — wear-side interaction surface
- Phase 24 (DEBT-04, notification_type enum rename+recreate) — canonical pattern for Postgres enum extension
- Letterboxd UX analysis — item-scoped social interaction, flat reviews, no threads on individual log entries, curator-voice editorial pattern
- Goodreads community patterns — book-level comments (reviews), flat ordering, edit/delete own
- Nielsen Norman Group (notification design) — grouping vs dedup distinction; separate vs bundled notification strategy
- Instagram like hiding (2021) — rationale for count-only vs full likers list; reducing social pressure is the design goal
- `useOptimistic` hook (React 19, already in codebase via NotificationRow) — confirmed pattern for optimistic like toggle
- Supabase Realtime rejection (PROJECT.md Key Decision, v2.0) — reason to use `revalidateTag` SWR pattern instead of live subscriptions
- Character limit research: Threads = 500 chars for posts, LinkedIn comments = 1500, TikTok = 150; collector comments are conversational → 500 chars is the right balance for Horlo

---
*Feature research for: v6.0 Social Interaction — scoped likes + comments on individual watches + wear events*
*Researched: 2026-05-22*
