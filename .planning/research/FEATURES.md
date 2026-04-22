# Feature Research

**Domain:** Taste-discovery social app — Production Navigation & Daily Wear Loop (v3.0)
**Researched:** 2026-04-21
**Confidence:** HIGH for navigation and photo-post patterns (strong comparable app evidence); MEDIUM for notification schema choices (engineering rationale + partial comparables); MEDIUM for people-search ranking (UX patterns clear, taste-overlap weighting is Horlo-specific)

---

## Feature 1: Production Navigation

### Table Stakes

| Feature | Why Expected | Complexity | Dependencies / Notes |
|---------|--------------|------------|----------------------|
| Sticky mobile bottom nav (always visible, does not hide on scroll) | Users expect primary nav to always be reachable; hiding on scroll forces a deliberate swipe-up before any navigation — acceptable for content-heavy feeds (Instagram Reels) but a friction tax on a utility-first app where the user may want to switch context at any point | LOW | Existing: Tailwind `fixed bottom-0` + `env(safe-area-inset-bottom)` padding |
| Elevated center Wear CTA | Instagram's original + Strava both use an elevated/notch center FAB for the primary creation action. Users of any activity-logging app expect the logging action to be visually dominant and reach-friendly at thumb-center | LOW–MEDIUM | Requires `pb-[env(safe-area-inset-bottom)]` on nav container AND `calc(height + env(safe-area-inset-bottom))` for nav height; existing WatchPickerDialog is already the Wear entry point (v2.0 WYWT-03) |
| Active-state filled icons | Outline → filled icon + accent-color shift on the active tab is the universal language for "you are here." Missing it leaves users uncertain which section they're in | LOW | Existing icon set is lucide-react; lucide has filled variants for some icons, otherwise a filled SVG override per active tab is needed |
| Desktop top nav with logo, persistent search, Wear CTA, notifications bell, profile dropdown | At >=768px, bottom nav disappears; all primary actions surface in a horizontal top bar. This is the universal desktop web pattern (Letterboxd, Goodreads, Strava web) | MEDIUM | Replaces the placeholder nav from v2.0; new: notifications bell, profile dropdown |
| Slim mobile top bar (logo + search icon + notifications icon + settings icon) | Mobile top bar carries secondary/utility actions (search, notifications) so bottom nav stays clean with only the 5 primary destinations | LOW | New component; notifications bell icon needs unread dot wired to v3.0 notifications table |
| iOS safe-area-inset handling | Without `viewport-fit=cover` + `env(safe-area-inset-bottom)` padding on the nav container, the home-indicator bar on iPhone overlaps nav items and makes them untappable. Table stakes for any PWA or web app used on iOS | LOW | Must add `viewport-fit=cover` to `<meta name="viewport">` in root layout; Tailwind 4 can express `pb-[env(safe-area-inset-bottom)]` as an arbitrary value |
| Stub `/explore` route so no nav link is broken | Users will tap every nav item. A 404 on Explore is a trust-breaker. A clearly labeled "coming soon" placeholder is acceptable | LOW | New route; no data dependencies |
| `+ Add` button or icon in nav (desktop top + mobile bottom) | Adding a watch is a frequent action; burying it behind a settings menu is table stakes friction | LOW | Existing: the `+` icon in v2.0 header wired to the Add flow |

### Differentiators

| Feature | Value Proposition | Complexity | Dependencies / Notes |
|---------|-------------------|------------|----------------------|
| Elevated center Wear CTA with notch/cradle visual treatment | The cradle (semi-circular cutout in the bar with a floating circle above it) signals "this is the heartbeat of the app" more strongly than a same-height center tab. Strava, Streaks, and early Instagram all used this. In a collection app, "Wear today" is the daily ritual — visually elevating it trains the habit | MEDIUM | Pure CSS/Tailwind; no data dependencies; the cradle is a `clip-path` or `border-radius` trick on the nav bar with an absolutely-positioned circular button floating above |
| Wear CTA renders differently when user has already worn a watch today | If a wear event exists for today, the CTA shifts to a "muted" filled state (e.g., filled icon + subdued color) rather than the full accent. Communicates "done for today" without removing the button | MEDIUM | Depends on: `markAsWorn` Server Action (existing v2.0), querying today's wear events on page load. Adds one DAL query to the root layout or home page |

### Anti-Features

| Feature | Why Requested | Why Avoid | Cite |
|---------|---------------|-----------|------|
| Bottom nav hides on scroll-down / reveals on scroll-up | Maximizes content viewport; Instagram Reels does this | Horlo is a utility-discovery app, not an endless scroll feed. Hiding nav trades a few pixels of content height for unpredictable nav availability. The user deciding to switch from Home to Profile should not require a deliberate scroll-up first. If viewport space becomes an issue in the collection grid, address it at the grid level. | PRODUCT-BRIEF §10: "no social feed" — this is not an infinite-scroll content app |
| Hamburger menu / drawer for primary navigation | Familiar from older web apps | Hides primary actions behind an extra tap. Bottom nav is reachable in one tap from any content position; a drawer requires two. For a 5-destination app, bottom nav is always correct. | Navigation Model §9 defines the 5 bottom destinations explicitly |
| Notification count badge on Explore or Add nav items | Might seem helpful to badge more items | Notification badges belong only on the notifications bell. Badging Explore or Add with counts introduces false urgency and conditions users to expect algorithmic push content, conflicting with the discovery-first (not push-first) positioning. | PRODUCT-BRIEF §2: "Discovery > social engagement" |

---

## Feature 2: Notifications

### Table Stakes

| Feature | Why Expected | Complexity | Dependencies / Notes |
|---------|--------------|------------|----------------------|
| Follow notification — "X started following you" | Every social app with a follow graph surfaces this. Users want to know their follower count is growing; it validates the taste-network identity. | LOW | Depends on: `follows` table (existing v2.0); trigger: `insertFollow` Server Action writes a row to new `notifications` table |
| Watch-overlap notification — "X added [watch] to their collection" when you own the same watch | Core taste-network signal. When someone whose taste you track adds a watch you own, it reinforces your collection identity and signals the watch is well-regarded in the community. | MEDIUM | Depends on: `activities` table (existing v2.0, `watch_added` type); derivation: at insert time, query all users who own a watch with matching `brand`+`model` (normalized, lowercased, trimmed); fan-out a notification row per match. No canonical watch IDs — brand+model fuzzy match is correct for v3.0 given KEY DECISION: per-user entries |
| Unread count badge on notifications bell (nav) | Universally expected: a red or accent dot/number on the bell when unseen notifications exist | LOW | Depends on: `notifications` table with `read_at`; query `count(*) where user_id = current AND read_at IS NULL` |
| Notifications inbox page with "Mark all read" | Users expect a dedicated page to scan all notifications; "mark all read" sets `read_at = now()` on every unread row for the user in a single `UPDATE WHERE user_id = X AND read_at IS NULL` | LOW | Per-row `read_at` is correct for v3.0 scale. The user-level `last_seen_at` cursor is more scalable (one write vs. N writes) but loses per-notification read state — you cannot show which individual notifications are unread when a user returns mid-list. At sub-500-user MVP scale, per-row UPDATE is correct. |
| Empty state in notifications inbox | Without it, a blank page after "mark all read" feels broken | LOW | Static illustration + copy: "You're all caught up." No data dependency |

### Differentiators

| Feature | Value Proposition | Complexity | Dependencies / Notes |
|---------|-------------------|------------|----------------------|
| Watch-overlap notification grouped by watch at display time | Groups multiple overlap events for the same watch into one row rather than N separate rows — e.g., "3 collectors also own your Ref 5711." Reduces inbox noise when a popular watch triggers many matches at once. | MEDIUM | Insert individual rows; aggregate at display time by `(notification_type, watch_brand, watch_model, target_user_id, date)`. This preserves per-actor detail for future drill-down without complicating the write path. |
| Stubbed UI templates for Price Drop and Trending Collector notifications | Signals the product roadmap to users who see the inbox: "notifications will get richer." Templates with placeholder data or a "coming soon" label set expectations without overpromising. | LOW | No data wiring needed; static template components rendered conditionally by notification `type` enum |
| Per-type opt-out in Settings | "Notify me about: New followers / Watch overlaps" toggles per notification type. Respects user agency; follows Strava's and Instagram's established pattern of per-category notification controls. Prevents churned users from muting all notifications just to stop one noisy type. | MEDIUM | New: `notification_settings` JSONB column on `profile_settings` (or separate table). Read before fan-out: if target user has `follows_notifications = false`, skip inserting the follow notification row. |

### Anti-Features

| Feature | Why Requested | Why Avoid | Cite |
|---------|---------------|-----------|------|
| "X liked your wear" or reaction notifications | Likes are a natural extension of photo sharing | No likes exist and none will be added. Even if reactions were added later, "likes" drive engagement metrics at the cost of anxiety and comparison. | PRODUCT-BRIEF §10: "No engagement mechanics (likes/comments)" |
| "X commented on your wear" notifications | Comments make wear events feel social | No comment system is planned. WYWT is a personal habit log that generates insights, not a posting surface. | PRODUCT-BRIEF §10: "No heavy posting system" and "No engagement mechanics" |
| Real-time toast on notification receipt (WebSocket push) | Feels live and premium | No Supabase Realtime in v3.0 (KEY DECISION from v2.0: free-tier 200 concurrent WebSockets limit; server-rendered + `router.refresh()` is sufficient at MVP scale). Inbox-pull model is correct — user opens bell to see new items. Toast on receipt requires Realtime or polling; both add infra cost for minimal user value at sub-100-user scale. | PROJECT.md Key Decision: "No Supabase Realtime in v2.0" — same constraint applies to v3.0 |
| Notification digest email | Useful engagement driver | Out of scope for v3.0. Email infra (custom SMTP) is not configured and email confirmation is currently OFF. Future milestone item. | PROJECT.md Active requirements: "Custom SMTP for email confirmation — currently OFF" |

---

## Feature 3: People-Only Search

### Table Stakes

| Feature | Why Expected | Complexity | Dependencies / Notes |
|---------|--------------|------------|----------------------|
| Live debounced search results — no submit required | Users have been trained by every major search interface that results update as they type. A submit-first search feels archaic. | LOW–MEDIUM | 200–300ms debounce is the evidence-backed sweet spot (Algolia docs, UX research consensus). Use `useDebounce(query, 250)`. Under 200ms fires too many queries; over 300ms feels laggy. |
| Minimum query length of 2 characters before firing | A 1-character query on `pg_trgm` ILIKE against usernames + bios returns a large, low-signal result set. 2 characters is the established minimum for name search. | LOW | Gate: `if (query.trim().length < 2) return []` |
| Result ranking: taste overlap % first, then username ILIKE relevance | In a taste-discovery app, showing the most-similar collector first is the core value proposition. Pure alphabetical or follower-count ranking misses the point. Hybrid: `ORDER BY COALESCE(taste_overlap_pct, 0) DESC, username ASC` | MEDIUM | Depends on: Common Ground taste overlap (existing v2.0, server-computed); compute at query time with a result cap of 20; if join is too slow, stub with follower-count ranking and add overlap in a follow-up task |
| "No results" state with suggested collectors | When a search returns nothing, a blank page creates a dead end. Suggested collectors (top-taste-overlap for current user) give a graceful fallback and reinforce discovery. | LOW | Depends on: `getCollectorsLikeUser()` (existing v2.0 home section DISC-02); reuse for no-results fallback |
| 4-tab bar (All / Watches / People / Collections) with only People populated | Per PROJECT.md spec. Tabs signal the future shape of search without shipping unbuilt content. "Coming soon" state on non-People tabs prevents confusion. | LOW | Static tab UI; only People tab fires a query |

### Differentiators

| Feature | Value Proposition | Complexity | Dependencies / Notes |
|---------|-------------------|------------|----------------------|
| Taste overlap % shown inline on search result rows | Unlike follower count or join date, overlap % is a signal unique to Horlo: "This collector shares 68% taste with you." Transforms people-search from a username lookup into a discovery surface. | LOW | Depends on: Common Ground computation (v2.0); compute per result row at query time or use pre-computed value |
| Follow / unfollow inline from search results | No page navigation required to follow a discovered collector. Reduces friction in the discovery loop. | LOW | Depends on: `followUser` / `unfollowUser` Server Actions (existing v2.0 FOLL-01/02); FollowButton component (existing v2.0) |

### Anti-Features

| Feature | Why Requested | Why Avoid | Cite |
|---------|---------------|-----------|------|
| Recent searches list / search history | Standard UX on high-frequency search surfaces (Google, Instagram) | People-search in Horlo is low-frequency. Storing and surfacing search history adds infra complexity (new table or localStorage entry) for minimal return. When there is no query, show suggested collectors instead — more useful than a list of previous searches. | PRODUCT-BRIEF §8 implies low-frequency discovery, not a high-frequency search surface |
| Full pg_trgm similarity scoring (trigram similarity > threshold) | More forgiving UX for mistyped usernames | `pg_trgm` ILIKE (`username ILIKE '%query%'`) already handles partial matches and is sufficient for v3.0. Full trigram similarity scoring adds a GIN index requirement without meaningful UX improvement at sub-1000-user scale. Revisit if the user base grows. | Same rationale as KEY DECISION: per-user entries — complexity vs. current scale |

---

## Feature 4: WYWT Photo Post Flow

### Table Stakes

| Feature | Why Expected | Complexity | Dependencies / Notes |
|---------|--------------|------------|----------------------|
| Chooser-first, not camera-first | Mobile web pattern: present options first (Take Photo / Upload / Skip), then launch camera. Camera-first fails gracefully — if the user denies camera permission, a chooser-first flow still offers Upload. | LOW | Chooser step is UI-only; camera and file upload are separate branches |
| Static framing guide overlay for camera path | When the user picks "Take Wrist Shot," a static overlay (dotted oval or dotted rounded rectangle centered in the frame) communicates "frame your wrist here." Implemented as an absolutely-positioned SVG or CSS border layer over the `<video>` element — no canvas compositing needed until capture. Dotted oval is the most natural for a wrist shot. | LOW | Canvas `drawImage()` at capture; overlay is pure CSS/SVG positioned over video feed |
| EXIF stripping before upload | Location data embedded in JPEG EXIF is a real privacy risk. Stripping before upload is table stakes for any photo-sharing feature. Approach: re-encode through `canvas.toDataURL('image/jpeg', 0.9)` after capture, which strips all metadata by spec. For uploaded files, draw to canvas and re-export before sending to Supabase. | LOW–MEDIUM | Canvas re-encoding is sufficient for EXIF strip. `heic2any` handles HEIC conversion before the canvas step (already planned per PROJECT.md). |
| Per-wear visibility selector defaulting to Private | Three-tier selector is expected for any content with personal behavioral data. The DEFAULT must be Private — not last-used, not most-open. Rationale: wear events are behavioral data; logging a wear should never accidentally expose it. Strava's documented fallback behavior (server unable to read default → defaults to "Only You") confirms this industry pattern. | LOW | Default Private is a single schema default on the new `visibility` column. The Followers tier requires DAL propagation (see below). |
| Followers visibility tier rippled through all wear-reading DALs | A new "Followers" tier means every DAL function that reads wear events must gate on the follow relationship for the Followers case. Missing even one read path is a privacy leak. Two-layer privacy pattern (RLS + DAL WHERE) is the established v2.0 approach. | MEDIUM | Depends on: two-layer privacy pattern (established v2.0 RETROSPECTIVE). Audit: `getWearRailForViewer`, worn tab DAL, any future wear-reading function. Mirror the pattern from `getFeedForUser` (Phase 10). |
| Note field (0/200 characters), plain text only | A short contextual note is expected on any logging action. Plain text only — no markdown, no special emoji keyboard. 200-char cap prevents WYWT from becoming a micro-blog. | LOW | Existing `markAsWorn` Server Action (v2.0) extended with `note` and `photo_url` parameters |
| Sonner toast on successful post | Every mutation in the app surfaces a toast. Wear post is no exception. | LOW | Existing: `sonner` is in the stack; established mutation pattern |
| Multi-step modal (not full-page flow) | Step 1: Pick Watch (reuses WatchPickerDialog). Step 2: Photo + Note + Visibility. A multi-step modal keeps the page context visible beneath and matches the "lightweight interactions" principle. A full-page navigation flow would feel heavy for a 2-step log. | MEDIUM | Depends on: `WatchPickerDialog` (existing v2.0 shared component) as step 1; step 2 is a new modal panel |
| Supabase Storage with per-user RLS buckets + signed URLs | Photos stored in a bucket with RLS so User A cannot read User B's Private or Followers-tier wear photos. Signed URLs for Private and Followers-tier photos; public URLs acceptable only for Public-tier photos (to avoid per-request signing overhead). | HIGH | New infra: Supabase Storage bucket + RLS policy + signed URL generation in DAL |

### Differentiators

| Feature | Value Proposition | Complexity | Dependencies / Notes |
|---------|-------------------|------------|----------------------|
| Edit-after-post: add a photo to a wear event already logged | Collectors often log wear in the morning without a photo, then want to add one later. Allowing photo-add to an existing wear event captures more images and makes the worn tab richer over time. | MEDIUM | New: `updateWearEvent(wearId, { photo_url })` Server Action; wear detail view needs an "Add photo" affordance when `photo_url` is null |
| Wear detail overlay on home rail tap (image-first, no engagement actions) | When another user taps a wear item in the WYWT rail, they see an image-first overlay with watch brand/model and collector context — no like button, no comment field. Wrist shots become the visual identity of the network. | MEDIUM | Depends on: WYWT rail (existing v2.0 home); new overlay component; `photo_url` from `wear_events` |

### Anti-Features

| Feature | Why Requested | Why Avoid | Cite |
|---------|---------------|-----------|------|
| Confirmation dialog before submitting a wear log | Preventing accidental posts feels safe | Adds a tap with no real benefit. Wear events are low-stakes; the default of Private means accidental posts are private. Edit-after-post (and a future delete-wear action) is the escape hatch. Confirmation dialogs are a friction anti-pattern for a habit-formation loop. | PRODUCT-BRIEF §2: "Lightweight interactions > heavy posting" |
| Likes, reactions, or comments on wear photos | Photo sharing invites social engagement mechanics | No engagement mechanics in this product. WYWT is a behavioral data layer (habit + insights), not a posting surface. Photos exist to make the worn tab visually rich and the home rail more compelling — they are not content to engage with. | PRODUCT-BRIEF §10: "No engagement mechanics (likes/comments)" |
| Multi-photo carousel per wear event | Power users may want to document multiple angles | One wrist shot per wear event keeps the data model simple, storage costs predictable, and the home rail fast. Carousels push WYWT toward "social post" territory, conflicting with the lightweight-interaction principle. Revisit only if user research shows strong demand. | PRODUCT-BRIEF §2: "Lightweight interactions > heavy posting" |

### Followers Tier Introduction Risk

The "Followers" visibility tier is new in v3.0 — v2.0 had only Private and Public. Users who set their profile to "public" may assume wear posts are also public, not realizing "Followers" is a distinct, narrower audience.

This is NOT a reason to drop the tier — it is the correct privacy model — but it must be communicated:

1. Default to Private on all wear posts so the first post is never accidentally semi-public
2. Label the selector clearly: "Followers only — people who follow you" (not just "Followers")
3. Consider a one-time tooltip on first use of the flow explaining the three tiers
4. No "remember last-used setting" default — always start on Private to avoid habituation toward a more-open default

The risk of NOT having the Followers tier is worse: without it, users who want to share with their follow network but not the whole internet have only the binary Private/Public choice, which pushes them toward Public (over-sharing) or Private (under-sharing). The tier resolves this. Handle the confusion risk through UI copy, not by removing the tier.

---

## Feature Dependencies

```
[Mobile bottom nav]
    requires --> [env safe-area-inset-bottom in root layout viewport meta]
    requires --> [Stub /explore route]

[Notifications bell in nav]
    requires --> [notifications table (new v3.0)]
    requires --> [Unread count query in nav Server Component]

[Follow notification]
    requires --> [notifications table]
    triggers from --> [insertFollow Server Action (existing v2.0)]

[Watch-overlap notification]
    requires --> [notifications table]
    derives from --> [activities table watch_added rows (existing v2.0)]
    requires --> [brand+model normalize+match fan-out query]

[Mark all read]
    requires --> [notifications table with per-row read_at]

[People search]
    requires --> [/search route (new)]
    uses --> [Common Ground taste overlap (existing v2.0) for ranking]
    uses --> [FollowButton component (existing v2.0)]

[WYWT photo post step 1]
    reuses --> [WatchPickerDialog (existing v2.0 shared component)]

[WYWT photo post step 2 — photo]
    requires --> [getUserMedia (camera path) OR file input (upload path)]
    requires --> [Canvas EXIF strip before upload]
    requires --> [heic2any for HEIC conversion (planned per PROJECT.md)]
    requires --> [Supabase Storage bucket + RLS (new infra)]

[WYWT photo post step 2 — visibility]
    requires --> [visibility column on wear_events (new column on existing table)]
    requires --> [Followers tier rippled through all wear-reading DALs]
    depends on --> [Two-layer privacy pattern (established v2.0)]

[Wear CTA "done today" state]
    requires --> [Today's wear events query (existing DAL, extended)]

[Edit-after-post — add photo later]
    requires --> [updateWearEvent Server Action (new)]
    requires --> [Supabase Storage bucket (same as photo post)]
```

---

## Phase Sequencing Recommendation

**Phase 11 — Navigation Shell**
Build first. Every other surface depends on a correct nav frame. Lowest data dependencies; unblocks all subsequent phases.
- Mobile bottom nav (sticky, safe-area, elevated Wear CTA, cradle treatment)
- Desktop top nav (logo, Explore, persistent search, Wear CTA, +Add, notifications bell placeholder, profile dropdown)
- Slim mobile top bar (logo, search, notifications, settings)
- Stub `/explore` route
- Active-state filled icons per tab

**Phase 12 — Notifications Foundation**
Second. The write-side (fan-out rows) is cheap to add to existing Server Actions. The read-side (inbox, bell badge) closes the loop.
- `notifications` table with `read_at`
- Fan-out in `insertFollow` and `addWatch` Server Actions
- Inbox page + "Mark all read"
- Unread dot on nav bell (wires bell placeholder from Phase 11)

**Phase 13 — People Search**
Third. Depends on profiles and follow system (both v2.0 shipped). Taste-overlap ranking is the hardest part; if join is too slow at query time, stub with follower-count ranking and add overlap in a follow-up task.
- `/search` route with 4 tabs (People populated, others "coming soon")
- Debounced ILIKE query on username + bio with 2-char minimum
- Taste overlap % inline on result rows
- FollowButton inline on result rows

**Phase 14 — WYWT Photo Post Flow**
Last. Most infra-heavy (Supabase Storage, signed URLs, camera API, EXIF strip, new Followers privacy tier ripple). Builds on stable nav (Phase 11) and the wear event model (v2.0).
- Multi-step modal (WatchPickerDialog step 1 reuse + new step 2)
- Chooser-first (Take Wrist Shot / Upload / Skip)
- Camera path with dotted oval overlay + EXIF strip
- Upload path with heic2any + EXIF strip
- `visibility` column + Followers tier DAL propagation (two-layer privacy)
- Supabase Storage bucket + RLS + signed URLs
- Sonner toast on success
- Edit-after-post for adding photo to existing wear

---

## Sources

- Instagram navigation changes 2025-2026: https://www.inro.social/blog/instagram-tabs-new-layout-2025
- Bottom nav bar guide (AppMySite 2025): https://blog.appmysite.com/bottom-navigation-bar-in-mobile-apps-heres-all-you-need-to-know/
- Mobile navigation patterns 2026: https://phone-simulator.com/blog/mobile-navigation-patterns-in-2026
- Sticky vs fixed navigation (LogRocket): https://blog.logrocket.com/ux-design/sticky-vs-fixed-navigation/
- iOS env(safe-area-inset-bottom) (MDN): https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/env
- iOS safe area web app guide: https://jipfr.nl/blog/supporting-ios-web/
- Notification scaling — per-row vs cursor (DEV Community): https://dev.to/epilot/scaling-notification-systems-how-a-single-timestamp-improved-our-dynamodb-performance-5c84
- Notification database table structure (DEV Community): https://dev.to/echoeyecodes/database-table-structure-for-different-notification-events-3lbc
- Notification grouping / batching social apps (SuprSend): https://www.suprsend.com/post/how-to-batch-notifications-for-your-social-media-collaborative-application
- Strava notification settings: https://support.strava.com/hc/en-us/articles/216918367-Strava-Notifications
- Strava activity privacy controls (default open, private fallback): https://support.strava.com/hc/en-us/articles/216919377-Activity-Privacy-Controls
- In-app search UX debounce + instant results: https://koder.ai/blog/instant-in-app-search-ux
- Search UX debounce 200ms (Algolia): https://www.algolia.com/doc/ui-libraries/autocomplete/guides/debouncing-sources
- Mobile search UX best practices (Algolia): https://www.algolia.com/blog/ux/mobile-search-ux-best-practices
- getUserMedia still photos (MDN): https://developer.mozilla.org/en-US/docs/Web/API/Media_Capture_and_Streams_API/Taking_still_photos
- EXIF data stripping by social platforms (EXIFData.org): https://exifdata.org/blog/do-social-media-sites-strip-exif-data-2025-test
- PatternFly notification drawer design guidelines: https://www.patternfly.org/components/notification-drawer/design-guidelines/
- Letterboxd mobile responsive breakpoint: https://letterboxd.com/journal/mobile-site/

---

*Feature research for: Horlo v3.0 — Production Nav & Daily Wear Loop*
*Researched: 2026-04-21*
