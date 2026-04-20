---
dimension: features
generated: 2026-04-19
milestone: v2.0 Taste Network Foundation
---
# Feature Landscape — Social Watch Collection Discovery

## Summary

This research covers social collection platforms (Letterboxd, Goodreads, Discogs, Rdio) to map what is table stakes vs. differentiating for public profiles, follow systems, activity feeds, taste overlap, and privacy controls. The goal is to inform the v2.0 milestone which adds multi-user taste network features to an existing single-user collection tool.

**Key finding:** Horlo has a structural advantage most social collection platforms lack — a semantic similarity engine already built. The Common Ground taste overlap feature (comparing two users' collections via `analyzeSimilarity`) is a genuine differentiator because competitors either skip it entirely (Discogs, Goodreads) or farm it out to third-party tools built by users (Letterboxd). Table stakes for this milestone are simpler than they appear: public profile + follow + basic activity feed. Everything else is a differentiator or should be deferred.

**Complexity note throughout:** "Low" = 1-2 days. "Medium" = 3-5 days. "High" = 1+ week. These estimates assume the existing DAL + Server Actions + Drizzle pattern already in place.

---

## Table Stakes

Features users expect from any social collection platform. Missing = the social layer feels broken or incomplete.

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| Public profile page with username and collection | Every social collection platform (Letterboxd, Discogs, Goodreads) makes your collection the identity. A URL like `/u/[username]` that shows owned watches is the minimum viable social surface. | Medium | Username field on user record; public/private flag; RLS must be in place first |
| Follow / unfollow action | Without follow, there is no network — no feed, no taste graph, no discovery. The follow table is the prerequisite for everything else in this milestone. | Low | `follows` table; follower/following counts on profile |
| Follower / following count display on profile | Goodreads, Letterboxd, Discogs all surface these prominently. Missing = profile feels like a dead end. | Low | Depends on follow system |
| Activity feed showing followed users' events | Letterboxd's core loop: follow someone, see their logs in your feed. Goodreads does the same. Without a feed, follows have no payoff. | High | `activities` table; event types: watch_added, wishlist_added, watch_worn, watch_sold |
| Privacy control: public vs. private profile | Letterboxd makes profiles public by default (collectors expect discoverability) but requires opt-in private mode for users who want it. Goodreads does the same. | Low | `profile_visibility` enum on user settings |
| Read-only view of another user's collection | When you visit someone's profile, you see their collection grid. Editable controls (edit, delete, add) are hidden. This is the minimum for the platform to feel social. | Low | Existing collection grid; conditional rendering based on `isOwner` |
| RLS on all tables | Required before any multi-user visibility lands. Users must not see each other's private data. This is a carry-forward from v1.0 and must be resolved first. | Medium | Supabase RLS policies; all existing tables |

---

## Differentiators

Features that set Horlo apart. Not universally expected in social collection tools, but high value when present — especially given the existing similarity engine.

| Feature | Value Proposition | Complexity | Dependencies |
|---------|-------------------|------------|--------------|
| Common Ground taste overlap on collector profile | No major social collection platform (Letterboxd, Goodreads, Discogs) has a built-in taste comparison feature between two users. Letterboxd's "besties" tool and profile compare tools are third-party apps — evidence the demand exists but the platform never shipped it natively. Horlo can ship this natively because `analyzeSimilarity()` already computes semantic overlap. Display on the other user's profile: shared watches, shared wishlist brands, overlap score as a label (not a raw number). | Medium | Existing `analyzeSimilarity()`; both users' collections must be readable; RLS |
| Tabs on public profile: Collection / Wishlist / Worn | Letterboxd has Films / Reviews / Diary / Lists / Stats. Goodreads has Read / Currently Reading / Want to Read. Tab-scoped collection views are the standard profile UX for collection-first platforms. Wishlist and Worn tabs on a public profile are differentiators — competitors don't expose intent (wishlist) or behavior (worn) this way. | Medium | Privacy controls per tab; wishlist/worn visibility settings |
| Privacy per tab (collection/wishlist/worn independently controllable) | Instagram and Letterboxd allow content-level privacy. Goodreads allows shelf-level visibility. Collectors have different comfort levels: happy to share owned watches, but want to keep their wishlist private (negotiating intention). Separate toggles for collection, wishlist, and wear visibility give meaningful control without overwhelming the settings page. | Low | `settings` table with `collection_public`, `wishlist_public`, `wear_public` booleans |
| Activity feed with event filtering | Letterboxd Pro lets users filter their feed by event type. At Horlo's scale this is a small feature but maps to the product principle that wear events and collection events have different signal strength for different users. Minimum: filter between "collection changes" and "wear events". | Low | Feed infrastructure; toggle stored in user preferences |
| Shared watches highlight on collector profile | When viewing another collector's profile, Horlo can surface "You both own: X, Y, Z" — a lightweight hook that makes the social layer feel intelligent. Requires comparing viewer's collection against profile owner's collection. Simpler than full Common Ground: no similarity engine, just a set intersection. | Low | Both users' watch lists readable; simple brand/reference intersection |
| "Collectors who own this watch" on watch detail | Discogs shows how many users have a record in their collection/wishlist. This creates social proof and discovery hooks: "7 collectors own this." Clicking into owners creates paths between profiles. | Medium | Watch detail page; requires loose normalization (no canonical watch DB yet — can match on brand+model text, imprecise but useful) |
| Activity feed: wear events from followed users | The WYWT (What You're Wearing Today) rail described in PRODUCT-BRIEF.md — showing what followed collectors wore today. This is the strongest daily retention hook in the product: it surfaces behavior, not just acquisition. Rdio's "listen along" / "what friends are listening to now" was this pattern for music. | Medium | Feed infrastructure + wear event type; `activities` for wear_worn |

---

## Anti-Features

Things to explicitly NOT build in the v2.0 milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Likes / reactions on activity events | PRODUCT-BRIEF.md explicitly rules this out: "discovery, not engagement." Letterboxd has likes and the result is an engagement incentive loop that distorts what people share. Horlo's model is Rdio — taste signal through behavior, not approval mechanics. | Show event counts (N collectors own this) as social proof without requiring interaction |
| Comments on watches or profiles | Adds moderation complexity, community management burden, and notification infrastructure none of which exist yet. Goodreads comments are widely cited as a design mistake (the feed becomes noise). | Collector notes (per-watch, personal) already exist — keep them personal-only for now |
| Notifications system | Depends on email/push infrastructure not yet built. "Tyler followed you" emails require custom SMTP (currently disabled). Building notifications correctly is a separate milestone. | Surface follow count changes in settings/profile; defer push/email |
| Suggested collectors / recommendations | Requires a recommendation engine or at minimum follower-of-follower graph traversal. Needs critical mass of users and follow connections to produce good results. With small user count, suggestions are meaningless. | Defer to post-network-effect milestone |
| Explore page | Structured discovery surface requiring trending logic, curator archetypes, featured collections. All deferred per PROJECT.md. | Discovery happens through profile-to-profile navigation in v2.0 |
| Search across users | Cross-user search requires indexing all public collection data. Infrastructure and privacy complexity that exceeds v2.0 scope. | Profile URLs are the discovery surface for now |
| Mutual follow requirement ("friendship" model) | Goodreads defaults to mutual friendship — the research shows this creates friction and reduces social graph density. Letterboxd's asymmetric follow model (follow without approval) is the correct pattern for a discovery-first product. | Asymmetric follow: you follow someone, you see their feed. No approval needed. |
| "Request to follow" for private profiles | Private mode exists but a pending-follow-request workflow adds state management complexity (pending/approved/denied). | Private profile simply hides content from non-followers; no request queue needed in v2.0 |
| Watch image uploads / wrist shots on profile | Supabase Storage integration out of scope per PROJECT.md. URL-only images for v2.0. | Keep existing URL-based image handling |
| Activity pagination / infinite scroll | <500 watches per user means feed volume stays manageable. Cursor-based pagination can be added when needed. | Simple reverse-chronological list; limit to last 50 events |

---

## UX Patterns Worth Adopting

### From Letterboxd
- **Asymmetric follow model** — follow without approval. No friendship handshake. The follower immediately sees the followee's activity. Simpler state machine, higher graph density.
- **Activity types that generate minimal noise** — Letterboxd learned from Goodreads: don't put every micro-event in the feed. "Added to diary" yes; "liked a list" only with event filtering. For Horlo: watch_added and watch_worn are high-signal. wishlist_added is medium signal. watch_edited is low signal — omit from feed.
- **Profile tabs as collection structure** — Films / Diary / Lists / Stats maps cleanly to Collection / Wishlist / Worn / Stats. Tabs reduce cognitive load vs. a single scrolling profile.
- **Feed event rate limiting** — Letterboxd surfaces a maximum of one item per hour for bulk historical logs, preventing feed saturation from single users. Important for v2.0: if a user imports 40 watches at once, don't generate 40 feed events.

### From Goodreads
- **Two-level privacy: profile-level + shelf-level** — Profile can be public while wishlist is private. The equivalent for Horlo: `profile_visibility` (public/private) + `wishlist_public` / `wear_public` booleans. Don't conflate these.
- **Social proof on items** — "127 people have read this" → "14 collectors own this" creates discovery context on the watch detail without requiring social interaction.

### From Discogs
- **Collection as identity signal** — On Discogs, your collection and wantlist are your public face. No bio, no posts — just the catalog. Horlo's collection-centric profile (no bio required, collection grid is the hero) matches this correctly.
- **Wantlist as a discovery surface** — Discogs makes wishlists (wantlists) browsable for other users. Collectors discover records through other people's wants. Horlo's wishlist tab on public profiles does the same — "this collector wants an IWC Portugieser" is discovery signal.

### From Rdio (the explicit model for Horlo)
- **Behavior-driven social graph** — Rdio's social signal was what people listened to, not what they posted. For Horlo, the wear event is the behavior signal: it tells you which watches a collector actually reaches for, not just owns. Surfaces authenticity that a static collection list cannot.
- **Taste-first follow prompts** — On collector profiles, Common Ground ("you both have X, Y in common") should precede the follow button contextually. This is the hook Rdio used: "people who like what you like" as the follow CTA. Horlo can do this natively because `analyzeSimilarity()` runs in the browser.

---

## Feature Dependencies

```
RLS on all public tables (carry-forward from v1.0)
  ← blocks: ALL v2.0 social features. Must ship first.

follows table (follower_id, following_id, created_at)
  ← enables: follow/unfollow action, follower/following counts, activity feed filtering

activities table (actor_id, event_type, payload, created_at)
  ← enables: home activity feed, collector profile activity view
  ← event types needed: watch_added, wishlist_added, watch_worn, watch_sold
  ← populated by: existing Server Actions (addWatch, updateWatch, logWear) + new follow action

user profile settings (profile_visibility, wishlist_public, wear_public)
  ← enables: privacy controls, conditional rendering on public profiles
  ← stored in: existing user settings table or new profile_settings table

public profile page (/u/[username])
  ← enables: all social surface area; prerequisite for follow, Common Ground, activity feed

existing analyzeSimilarity() engine
  ← enables: Common Ground taste overlap on collector profiles (zero additional engine work)
  ← already runs client-side from props, not Zustand

existing collection data (watches, wear events, wishlist)
  ← enables: tab-scoped profile views (Collection, Wishlist, Worn)
  ← privacy controls gate which tabs are visible to visitors
```

---

## MVP Recommendation for Active Roadmap

Phases in dependency order:

1. **RLS on all tables** — Non-negotiable prerequisite. No social features can land safely before this. Medium complexity but critical. (Carried from v1.0.)

2. **Data model: follows + activities tables** — Two new tables. Simple schema. Enables the rest of the milestone. Low complexity for the tables; medium for wiring activity writes into existing Server Actions.

3. **Public profile page (`/u/[username]`)** — Collection tab first, read-only. Reveals privacy gaps early. Medium complexity.

4. **Privacy settings** — `profile_visibility`, `wishlist_public`, `wear_public` toggles in Settings. Low complexity, high trust value.

5. **Follow / unfollow** — Button on collector profile, counts on both profiles. Low complexity.

6. **Home activity feed** — Reverse-chronological list of followed users' events. Limit to `watch_added`, `watch_worn`, `wishlist_added`. Omit `watch_edited`. High complexity (feed query, event rendering, empty state).

7. **Common Ground on collector profile** — Reuse `analyzeSimilarity()` to show shared watches and overlap framing. Medium complexity. This is the signature differentiator; don't defer it.

**Defer with rationale:**
- Wishlist and Worn tabs on public profile: Lower priority than getting the Collection tab and feed right. Add in a second pass.
- "Collectors who own this watch": Requires imprecise brand+model matching (no canonical DB yet). Useful but noisy. Defer until canonical watch strategy exists.
- Activity feed event filtering: Nice-to-have once the feed has volume. At launch, default to all event types.
- WYWT wear rail on home page: High-value retention hook but depends on feed infrastructure being solid first. Can be a fast follow after feed ships.

---

## Sources

- Letterboxd FAQ and activity feed documentation: https://letterboxd.com/about/faq/
- Letterboxd activity feed privacy tweet: https://x.com/letterboxd/status/1295446440643158016
- Letterboxd Wikipedia overview: https://en.wikipedia.org/wiki/Letterboxd
- Goodreads social network site research: https://www.researchgate.net/publication/293768221_Goodreads_A_Social_Network_Site_for_Book_Readers
- Goodreads activity feed and shelves guide: https://bookwiseapp.com/blog/the-goodreads-app-a-complete-guide-to-features-how-it-works
- Activity feed design patterns: https://getstream.io/blog/activity-feed-design/
- Scalable activity feed architecture: https://getstream.io/blog/scalable-activity-feed-architecture/
- PostgreSQL follower/following schema design: https://www.geeksforgeeks.org/dbms/design-database-for-followers-following-systems-in-social-media-apps/
- Letterboxd third-party taste comparison tools (evidence of unmet native demand): https://github.com/jsalvasoler/letterboxd_user_comparison
- Rdio social discovery overview: https://en.wikipedia.org/wiki/Rdio
- Discogs collection tool overview: https://support.discogs.com/hc/en-us/articles/360007331534-How-Does-The-Collection-Feature-Work
