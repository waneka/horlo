---
dimension: features
generated: 2026-04-26
milestone: v4.0 Discovery & Polish
---
# Feature Research — v4.0 Discovery & Polish

**Domain:** Taste-discovery / catalog-backed collection app — Discovery surfaces, catalog search, "evaluate without commit" flows, settings IA, profile prominence, empty-state polish, form feedback
**Researched:** 2026-04-26
**Confidence:** HIGH for catalog search UX, settings IA, toast vs inline, save-vs-commit pattern, empty-state guidelines (multiple authoritative sources). MEDIUM for /explore section composition (comparable apps diverge — Letterboxd is editorial-curated, Discogs is community-aggregated, Are.na is chronological-firehose). MEDIUM for in-network-vs-across-network search axis (Discogs supports both; Goodreads supports neither well; we have to choose).

> This document scopes ONLY the eight v4.0 surfaces. v3.0-shipped features (production nav, three-tier wear privacy, notifications system, photo WYWT, people search, public profiles, follow graph, Common Ground) are not re-researched — see `.planning/research/FEATURES.md` history (Phase 11–16 era) for that material.

---

## Feature Landscape

### Feature 1: `/explore` Discovery Surface

**Comparable apps:**
- **Letterboxd** — `/films/popular/`, `/lists/popular/`, "Members enjoying X" rail. Editorial Journal posts surface curated content. No algorithmic feed.
- **Discogs** — Explore tab → Trending Releases + Most Collected (filterable by genre/format) + Recently Created Lists. Community-aggregated, not editorial.
- **Are.na** — Explore is "a chronological aggregation of everyone's individual activity on the system — an in-plain-sight, nothing-to-hide aggregated pulse." Pure firehose; no ranking; no algorithm.
- **Goodreads** — Browsing → recommendations + choice awards + giveaways + new releases + lists + interviews. The 20-billion-data-point recommendation engine maps "books that appear on the same bookshelves." Closest analog to Horlo's Common Ground.
- **Untappd** — "Personalized recommendations based on your taste" + nearby breweries + "what your friends are drinking."

#### Table Stakes

| Feature | Why Expected | Complexity | Dependencies / Notes |
|---|---|---|---|
| **Popular Collectors rail** (most-followed public profiles, exclude self + already-followed) | Letterboxd, Goodreads, Untappd all ship a "discover people" rail on their explore surface. Without it, /explore for a sparse-network user feels like a dead room. | S | Reuses v2.0 follow graph + `profile_public` gate. SQL: `SELECT p FROM profiles JOIN follows ON follows.followingId = p.id WHERE p.profile_public = true GROUP BY p.id ORDER BY COUNT(follows.id) DESC LIMIT 10`. Two-layer privacy preserved. |
| **Trending Watches rail** (highest `owners_count + wishlist_count * 0.5` over a rolling window) | Discogs Trending Releases is the canonical pattern; Letterboxd `/films/popular/` is the same shape. A taste-discovery app without "what's hot in the catalog" is incomplete. | M | Hard dependency on `watches_catalog` (per STACK.md). `pg_cron` daily-batch UPDATE keeps the counts fresh at acceptable staleness. NOT a live trigger — would hot-loop on every `addWatch`. |
| **"Welcome to /explore" hero block when network is sparse** | NN/G empty-state research: "Don't default to totally empty states — creates confusion." For a brand-new user with 0 follows, /explore must feel like onboarding, not a dead end. | S | Conditional render: if `followingCount < 3 && wearEventsCount < 1`, swap default rails for an onboarding hero ("Add your first watch / Find collectors / Try Evaluate"). Same data already available in DAL. |
| **Sparse-network fallback — editorial / global content beats personalized empty content** | Spotify's "editorial playlists generate 1B streams/week" is the canonical evidence: editorial fills the cold-start gap that personalization can't. For Horlo, "Trending Watches" + "Popular Collectors" are global signals that work for any user, regardless of network depth. | S | This is a *design constraint*, not a separate feature — every /explore section must work for a 0-follow user. Personalized rails come later. |
| **Section header → "See all" link on each rail** | Standard rail pattern (Letterboxd, Discogs, Spotify). Without it, users can't drill into a rail to see >10 items. | S | Routes: `/explore/collectors` (full popular-collectors list, paginated), `/explore/watches` (full trending-watches list). Server Components, mirror /search Watches/People DAL pattern. |

#### Differentiators

| Feature | Value Proposition | Complexity | Dependencies / Notes |
|---|---|---|---|
| **"Watches Gaining Traction" rail** — fastest 7-day growth in `owners_count + wishlist_count`, NOT raw popularity | "Trending" without time-derivative is just "popular forever." A 7-day-delta rail surfaces watches that are *currently* moving — a stronger taste-network signal. Reddit r/rising, Letterboxd "What's hot this week" use this. | M | Adds a `watches_catalog_daily_snapshots` table (date, catalog_id, owners_count, wishlist_count) — `pg_cron` daily insert. Query: 7-day diff. Defer if scope-tight. |
| **"Collectors Like You" / Common Ground rail on /explore** | Common Ground already exists (v2.0 PROF-09); surfacing top-3 highest-overlap public profiles on /explore turns the page from "what's globally popular" into "what's relevant to YOU." This is the Goodreads "books on same bookshelves" signal applied to people. | M | Compute is already there. New: position on /explore home (vs current home page where it lives). Can hide for users with <5 watches (nothing to overlap on). |
| **Featured Collection / Editorial-style highlight** | Letterboxd Journal sets the model: a single human-curated highlight per week. Doesn't need automation, doesn't need a CMS — admin updates a static `featured.json` or DB row. Adds editorial voice. | S–M | Could ship as a static MDX on the page initially; if it becomes a thing, build a `featured` table later. **Optional — defer if scope-tight.** |
| **"Recently Joined" rail (last 7 days, public profiles only)** | Untappd, Letterboxd surface this; helps new users find peers. Especially valuable during a private-beta period where the network is still forming. | S | `SELECT * FROM profiles WHERE profile_public = true AND created_at > NOW() - INTERVAL '7 days' ORDER BY created_at DESC LIMIT 10`. No new schema. |

#### Anti-Features

| Feature | Why Requested | Why Avoid | Alternative |
|---|---|---|---|
| **Algorithmic personalized feed (Instagram Explore-style)** | Feels modern, "personalized" | Free-tier infra cost (real-time scoring), opacity ("why am I seeing this?"), and pivots Horlo from a deliberate-discovery tool toward an attention-engagement product. PRODUCT-BRIEF §10 explicitly calls out "Discovery > social engagement." | Editorial + popular + Common Ground rails (above). Algorithm = "watches you haven't seen, sorted by combined popularity + your overlap." Deterministic, explainable. |
| **Are.na-style chronological "everything happening" firehose** | Pure transparency, no algorithm anxiety | Untenable at scale; requires Realtime infrastructure (excluded by v3.0 KEY DECISION). At <100-user scale would feel empty, at >1000-user scale would be noise. The Goodreads/Letterboxd "popular + curated rails" pattern is correct at our scale. | Rails-with-Section-Headers pattern, refreshed daily via `pg_cron`. |
| **Taste Clusters visualization (k-means on user preference vectors)** | "Show me my taste cluster" is intuitively appealing | High implementation cost (clustering infra, label-quality problem — what do you call cluster #3?), low value at <100 users (clusters are noise without volume). STACK.md explicitly defers this to v5.0. | None for v4.0 — defer. |
| **"Trending Today" with hourly refresh** | Feels live | Hot-loop write amplification on `watches_catalog.owners_count` if triggers fire on every insert. Daily-batch via `pg_cron` is sufficient — "trending" doesn't need sub-day freshness for a taste-discovery app. | `pg_cron` daily UPDATE — documented in STACK.md. |
| **Push notifications when a "trending watch" is one you wishlist** | Could be useful | Reactivates the v3.0 `price_drop` / `trending_collector` notification stub patterns we're explicitly removing in v4.0 (per PROJECT.md cleanup). Wait until product signal demands it. | None — keep the notification surface focused on follow + watch_overlap. |

---

### Feature 2: `/search` Watches Tab — Catalog Search

**Comparable apps:**
- **Letterboxd** — `/films/` browse + global search; autocomplete dropdown with poster + year; Enter for full-results page.
- **Discogs** — Top-bar global search with "All / Releases / Artists / Labels / Users" scope. Autocomplete with thumbnail + format/year metadata.
- **Goodreads** — Search by title/author/ISBN; autocomplete shows cover + author. Filter facets on results page.
- **Spotify** — Autocomplete instant results, then "See all" → faceted results page (artists / albums / songs).

#### Table Stakes

| Feature | Why Expected | Complexity | Dependencies / Notes |
|---|---|---|---|
| **Live debounced results (no submit required)** | The Phase 16 `useSearchState` hook (250ms debounce + AbortController + URL sync) already shipped this for People. Watches must match — anything else feels archaic and inconsistent. Algolia/UX consensus: 200–400ms debounce. | S | Reuse `useSearchState` from Phase 16 verbatim. New DAL function `searchCatalogWatches(q, { limit, viewerId })` mirroring `searchProfiles`. |
| **2-character minimum query** | A 1-char `pg_trgm` ILIKE on `brand` returns hundreds of low-signal rows. 2-char minimum already established in Phase 16 for People; consistency demands it for Watches. | S | Same gate: `if (q.trim().length < 2) return []`. |
| **Result rows show brand + model + reference + thumbnail (if available)** | Discogs/Letterboxd/Goodreads ALL show thumbnail + metadata in autocomplete and result rows. Brand-name-only result rows feel broken. | M | `watches_catalog` should carry an optional `image_url` (canonical/representative). For backfill, take the first user's `imageUrl` for that catalog row. Lazy-load thumbnails via `next/image` (already in tree). |
| **"Owned by you" / "On your wishlist" badge on result rows** | Discogs shows "In your collection" / "In your wantlist" inline. Without it, the user re-clicks watches they already own and discovers the duplicate after the click. Anti-N+1 fan-out from Phase 16 (`inArray` for `isFollowing`) generalizes directly. | M | New: `getOwnedAndWishlistedCatalogIdsForUser(userId)` → `Set<catalogId>`. Pass into result rows. |
| **Empty-state in tab when no query** | NN/G: empty states should "increase learnability + suggest a CTA." When the user lands on the Watches tab with no query, show "Search for a watch by brand, model, or reference." + 3-5 example queries ("Speedmaster", "GMT-Master", "Nautilus 5711"). | S | Static UI. No data dependency. |
| **"No results for {q}" state with fallback CTA** | When the query truly returns nothing, dead-ends are forbidden. CTA: "Can't find it? [Add it to your collection manually]" — this seeds the `user_promoted` catalog row per STACK.md. | S | Reuses existing add-watch flow with the search query pre-filled. |
| **XSS-safe highlighted match text** | The Phase 16 `HighlightedText` (regex-escape + React text children, no `dangerouslySetInnerHTML`) is reusable verbatim across brand + model + reference. | S | Reuse Phase 16 component. |
| **AbortController for in-flight queries** | Standard pattern in Phase 16. A user typing "Speedm" → "Speedmaster" should not race two queries. | S | Reuse Phase 16 `useSearchState`. |

#### Differentiators

| Feature | Value Proposition | Complexity | Dependencies / Notes |
|---|---|---|---|
| **Filter facets on results page** — Movement (auto/manual/quartz), Case size (≤36 / 36–40 / 40–42 / >42mm), Style tags | Once result count exceeds a screen, faceted refinement is the universal e-commerce pattern (Adobe Commerce / Algolia best-practice). Movement + case-size are the two highest-signal facets for watches. | M | Pure SQL `WHERE` extensions on the catalog query. Tailwind 4 collapsible facet sections (mobile-first). Don't ship until result counts cross ~30 — premature for v4.0 catalog scale. **DEFER to v4.x** unless the catalog hits that threshold. |
| **"Evaluate this watch" inline CTA on each row** | Differentiator that ties Watches search → Feature 4 (Evaluate flow). User searches "Daytona" → sees rows → clicks "Evaluate" → /evaluate?catalogId={id} pre-filled. Closes the discovery → decision loop. | S | Adds a small button per row. Routes to `/evaluate?catalogId=X`. Catalog row → `Watch`-shaped object passed to `analyzeSimilarity()`. |
| **Sort by "Best match" (relevance) vs "Most owned" vs "Recently added"** | Power-user surface. Not v1, but a small Select control on the results header. | S | Three SQL `ORDER BY` branches. |

#### Anti-Features

| Feature | Why Requested | Why Avoid | Alternative |
|---|---|---|---|
| **Full-fuzzy `pg_trgm` similarity scoring (`<->` operator with threshold)** | More forgiving for typos | ILIKE `%q%` already handles the misspelling pattern most users hit, and Phase 16 verified GIN indexes are reachable for ILIKE. Trigram-distance scoring adds query complexity without measurable UX win at <5000 catalog rows. **Revisit at 100k+ rows.** | Stick with ILIKE pattern from Phase 16. |
| **Recent searches list / search history** | Standard UX on high-frequency surfaces (Google) | Catalog search is mid-frequency for Horlo (a few times per month, not per session). Storing/surfacing history adds infra (table or localStorage) for marginal return. Show example queries instead. | Curated example queries in empty state. |
| **Voice search / image search** | Modern feel | Out of scope; requires significant infra (Whisper API, vision LLM). Defer indefinitely. | None. |
| **Algolia / Meilisearch / Typesense** | "Search-as-a-service" — fast, faceted out-of-box | <5000 catalog rows × handful of users — `pg_trgm` GIN is two orders of magnitude under the threshold where these become useful. Operational overhead (separate index, sync pipeline, hosted cost) for negative ROI at v4.0 scale. | `pg_trgm` GIN (already in tree). STACK.md confirms. |

---

### Feature 3: `/search` Collections Tab — Search Across Collections

**The fundamental UX choice:** Search WITHIN a single collection (filter `/u/{user}` by tag/role/brand) or search ACROSS collections (find collections that contain a specific watch / match a tag profile)?

**Comparable apps:**
- **Discogs** — supports BOTH but separately: in-collection filtering (genre/format/year/style) is on `/user/{u}/collection`; cross-collection search ("which users own this release?") is on the release detail page as "X have this in their collection."
- **Goodreads** — within-shelf filtering is the dominant pattern; cross-collection ("who else has this on their shelf") is largely missing — frequently complained-about UX gap.
- **Letterboxd** — list filtering by year/genre/director is in-list; cross-list search is only via "members enjoying X" rails.

**Recommendation for v4.0:** ship CROSS-collection search as the primary `/search` Collections tab semantic, because:

1. The within-collection filtering already exists at `/u/{user}` via the FilterBar (v1.0 shipped) — no work needed
2. Cross-collection search is the differentiated value prop — "find people whose collection composition matches my taste" is the taste-network unlock
3. NN/G evidence: "Users overlook, misunderstand, and forget about the search scope; most people expect global results from the search bar." Global-by-default beats scoped-by-default.

#### Table Stakes

| Feature | Why Expected | Complexity | Dependencies / Notes |
|---|---|---|---|
| **Search collections by watch identity** ("Who owns a Speedmaster Professional?") | The core use case for cross-collection search in any catalog-backed app. Discogs ships this; Goodreads doesn't and gets criticized for it. | M | Query: `SELECT DISTINCT u.* FROM profiles u JOIN watches w ON w.userId = u.id WHERE w.catalogId = $catalogId AND u.profile_public = true LIMIT 20`. Hard dep on `watches_catalog` per STACK.md. |
| **Search collections by tag profile** ("Find people whose collection is heavy on `dressy` + `chronograph`") | Goes beyond watch-identity match — surfaces taste alignment. Common Ground does this for the current viewer; this exposes the same query for arbitrary tag inputs. | M | Aggregate `watches.styleTags + roleTags` per user; rank by tag-match-count. Reuses similarity-engine vocabulary (`Watch.styleTags`, `Watch.roleTags`). |
| **Result rows show: avatar + username + bio snippet + collection size + composition pills** | Mirrors People-search row design from Phase 16. Composition pills ("12 owned • mostly dressy + 3 chronographs") preview the collection without a click. | M | Aggregate computed in DAL; rendered with `HighlightedText` (Phase 16). |
| **Empty state with example searches** | Same NN/G principle as Watches tab. CTA: "Try searching for a brand, role, or style tag." | S | Static UI. |
| **Two-layer privacy: only public profiles surface** | Critical. A search that exposes private collections is a privacy leak. Mirror Phase 16 pattern: RLS on `watches` (user_id ownership OR public profile join) + DAL `WHERE profile_public = true`. | M | Established v2.0 pattern, already proven in Phase 16. |
| **"Coming soon" gate during construction phase** | Phase 16 already ships the 4-tab page with Watches/Collections/All as "coming soon." Removing the gate is a 1-line change once the DAL function lands. | S | Already wired in Phase 16. |

#### Differentiators

| Feature | Value Proposition | Complexity | Dependencies / Notes |
|---|---|---|---|
| **"Collections you might enjoy" suggested results when query is empty** | Cross-applies Common Ground: if no query, surface top-overlap public profiles. Turns the empty Collections tab into a discovery surface, not a dead form. | M | Reuses Common Ground (v2.0 PROF-09). Same query as `/explore` "Collectors Like You" rail — could be the same component. |
| **"Watches in common with you" badge** ("3 watches you both own") | Inline overlap signal on each result row. Lower-fidelity than full Common Ground % but appropriate for mid-volume scanning. | S | Pre-computed: viewer's catalogIds intersected with each result's catalogIds. Cap result set at 20 to keep this cheap. |

#### Anti-Features

| Feature | Why Requested | Why Avoid | Alternative |
|---|---|---|---|
| **Within-collection scoped search inside `/search` Collections tab** | "Search MY collection from the global search" feels powerful | NN/G: "Scoped search is dangerous — users forget which scope they're in." The within-collection filter UI ALREADY exists at `/u/{username}` via FilterBar — no need to duplicate it under `/search`. | Existing FilterBar at `/u/{user}`; potential `/u/{user}?q=…` URL param to deep-link a within-profile search. **Out of scope for v4.0.** |
| **Saved-search alerts** ("Alert me when someone's collection matches X criteria") | Engagement surface | Reactivates the notification-stub pattern we're removing. Adds infra cost (cron, fan-out, cap-management) for marginal value at MVP scale. | None. |
| **Free-text "describe your dream collection" semantic search** | LLM-era feel | Adds Anthropic API cost on every search; latency 5–15s breaks the live-search expectation; embeddings infra deferred indefinitely. Tag-profile search (table stakes above) covers 80% of the use case at zero LLM cost. | Tag-profile search (above). |
| **Cross-collection search that ignores `profile_public`** | "More results" | Privacy violation — non-negotiable. | Two-layer privacy enforced. |

---

### Feature 4: "Evaluate this Watch" — Save-vs-Commit Pattern

**Comparable apps:**
- **Letterboxd Watchlist** — single-click clock-icon toggle. Watchlist = "interested but uncommitted." Logging/rating moves the film into the committed history. **Save-then-commit is THE established UX for taste apps.**
- **Goodreads "Want to Read"** — exclusive shelf; one-click add. The `Want to Read` shelf is the parking lot before commitment to "Currently Reading" or "Read."
- **Are.na "Save to Channel"** — even more lightweight; "Save to channel" is a dropdown picker, not a commit action. Channels are the meta-organization layer.
- **Pinterest Save / Boards** — same pattern: save-now, organize-later.
- **E-commerce Save for Later** (NN/G research) — saves visible from cart; Wishlist is a longer-term parking lot. Both reduce decision friction.

**The mental model unlocks:** users want to ASK QUESTIONS about a watch before they commit to anything (collection, wishlist, sold, grail). "Should I add this?" is the question Horlo's similarity engine already answers — but today the engine only fires *after* the watch is in the collection. The Evaluate flow inverts this.

#### Table Stakes

| Feature | Why Expected | Complexity | Dependencies / Notes |
|---|---|---|---|
| **Dedicated `/evaluate` route (NOT modal)** | Confirmed in STACK.md: SimilarityResult is dense (label + per-dimension breakdown + top-3 nearest + rationale, ~80–120 lines vertical); flow involves a 5–15s server roundtrip. Modal is wrong shape. Letterboxd's `/film/{slug}` detail page is the analog. | M | New page `src/app/evaluate/page.tsx`. Server Component reads `?url=` or `?catalogId=`. Pure composition of existing primitives. |
| **Paste-URL input as primary entry** | The existing 3-stage extraction pipeline (`/api/extract-watch`) is the differentiated input — paste any retailer URL → pre-filled watch. Don't bury this. | S | Reuse `/api/extract-watch` route handler unchanged. Auth-gated, SSRF-hardened (Phase 1 SEC-01). |
| **Verdict UI: SimilarityLabel + rationale + top-3 nearest watches** | This UI exists today inside `WatchDetail` (the in-card insight). Extract into `<SimilarityVerdictCard>` — reusable across Evaluate page + WatchDetail + future Wishlist insights. | M | Refactor existing render into shared component; no new logic. |
| **"Add to my collection" CTA on verdict** | After evaluation, the user's natural next move is "OK, I'm convinced — add it." Letterboxd's "Mark as watched" on a film page is the analog. Friction-free conversion to commit. | S | Calls existing `addWatch` Server Action with the extracted Watch payload. |
| **"Add to my wishlist" CTA on verdict** | Lower-commitment commit: "interesting, but not buying yet." Mirrors Letterboxd Watchlist clock-icon. Maps to existing `WatchStatus.wishlist`. | S | Same `addWatch` action with `status: 'wishlist'`. |
| **"Save to Evaluate Later" — defer commit entirely** | The most aligned-with-mental-model action. User wants to think about it, not commit yet. Maps to Letterboxd Watchlist semantics. **Critical for the save-vs-commit UX to work** — without this, "Evaluate" becomes a thinly-disguised wishlist add. | M | **Choice point** — does this need a NEW status (`evaluating`) or does it reuse `wishlist`? Recommendation: **reuse `wishlist`**. A new status forks the data model; the wishlist already serves "interested but uncommitted." If the user wants to track *why* they wishlisted (similarity verdict), the rationale can be stored in the `notes` column alongside. NO new schema required. |
| **Empty state on `/evaluate` (no URL provided yet)** | Same NN/G principles. CTA: "Paste a watch URL from any retailer — Hodinkee, Bobs Watches, Crown & Caliber, brand sites." Sample URL or two. | S | Static UI. |
| **Auth-gated** | The similarity computation requires user collection + preferences. Anonymous evaluate would have to use stub data — not useful. | S | proxy.ts already enforces auth on `/evaluate` by default; no exclusion needed. |

#### Differentiators

| Feature | Value Proposition | Complexity | Dependencies / Notes |
|---|---|---|---|
| **Three-CTA verdict ladder: Save to Evaluate Later → Add to Wishlist → Add to Collection** | Mirrors mental progression. Most apps offer only commit; Horlo can offer the full ladder of commitment with similarity context attached. | S | All three CTAs map to existing `addWatch` paths (or Letterboxd-style Watchlist if we use a separate status — but recommendation above is to reuse wishlist). |
| **"Compare with this watch I already own" affordance on verdict** | Surfaces the engine's pairwise reasoning. User clicks a top-3 nearest match → sees "Here's why this watch overlaps with the X in your collection." Educates the engine and reinforces the verdict. | M | New: `<SimilarityPairwiseCard>` — drill-down from top-3 list. Defer to v4.x if scope-tight. |
| **Pre-fill from `/search` Watches tab → Evaluate inline button** | Cross-feature wiring: the "Evaluate" button on Watches search rows lands on `/evaluate?catalogId=X` and skips the URL-paste step. Powerful. | S | Already noted above as Feature 2 differentiator. |
| **Shareable verdict URL** (`/evaluate?url=...&shared=true`) | Power-user surface. Lets a collector send a friend a "here's what your engine would say about this watch" link. | S | URL params already drive the page; "shared" mode just hides the "Add to my collection" CTA (since it's not the recipient's verdict). Defer if scope-tight. |

#### Anti-Features

| Feature | Why Requested | Why Avoid | Alternative |
|---|---|---|---|
| **Modal pattern for Evaluate (parallel + intercepting routes)** | "Less disruptive entry from Add Watch flow" | Verdict UI is too dense; flow is too long. STACK.md: route, not modal. | New `/evaluate` route. |
| **Anonymous / pre-auth Evaluate** | Conversion driver — "try it without signing up" | Engine requires user's collection + preferences; anonymous version would be a stub. Pivots Horlo from a personal-tool to a marketing surface. Not the right tradeoff for v4.0. | Auth-gated. |
| **NEW `evaluating` status separate from wishlist** | Cleaner data model for "saved for evaluation" | Forks the data model into a 5-status discriminated union; complicates filter bar, status toggle, similarity engine, public profiles. The wishlist already serves "interested but uncommitted" — re-purposing it costs nothing. | Reuse `WatchStatus.wishlist`; verdict rationale in `notes`. |
| **"Auto-save every paste" — implicit save** | Frictionless | Violates user agency; user might just be checking, not saving. Goodreads's "auto-add to Want to Read on every interaction" is widely complained-about UX. | Explicit save CTA only. |
| **Multi-watch comparison on /evaluate (paste 3 URLs, see them ranked)** | Power user feature | Stretches scope dramatically; the engine is pairwise-against-collection, not n-way comparison. Out of scope. | None. Defer to a hypothetical v5.x "Comparison Tool." |

---

### Feature 5: Settings Page IA — Section Ordering

**Comparable apps:**
- **GitHub Settings** — Profile / Account / Appearance / Accessibility / Notifications / Billing / Emails / Password and authentication / Sessions / SSH and GPG keys / Organizations / Moderation / Repositories / Packages / Pages / Saved replies / Code review limits / Applications / Scheduled reminders / Security log / Danger Zone (per repo, not per account)
- **Vercel Account** — Profile / Account / Notifications / Email / Authentication / Security / Billing / Invoices / Plans / Integrations / Login Connections
- **Linear** — Account / Profile / Preferences / Security & access / Notifications / Connected accounts
- **Letterboxd** — Profile / Account / Privacy / Notifications / Reviews / API
- **Discord** — Account / Profile / Privacy & Safety / Authorized Apps / Connections / Friend Requests / Voice & Video / Notifications / Keybinds / Language / Streamer Mode / Advanced / Activity Privacy / Game Activity / Game Overlay

**Pattern across all:** Identity-related (Account, Profile) first → Privacy/Security adjacent → Behavior controls (Notifications, Preferences) middle → Cosmetic (Appearance) lower → Destructive (Danger Zone, Delete Account) last.

#### Recommended ordering for `/settings`

| # | Section | Contents | Source of pattern |
|---|---|---|---|
| 1 | **Account** | Email change, password change, sign-out-all-sessions (future) | GitHub, Vercel, Linear all start with Account |
| 2 | **Profile** | Username, display name, bio, avatar, profile_public toggle | GitHub Profile / Letterboxd Profile |
| 3 | **Preferences** | `collectionGoal`, `overlapTolerance`, similarity tuning (the schema-driven knobs from PROJECT.md) | Linear Preferences |
| 4 | **Privacy** | `collectionPublic` / `wishlistPublic` toggles; `notesPublic` per-watch handled in WatchForm; default-wear-visibility | Letterboxd Privacy |
| 5 | **Notifications** | `notifyOnFollow` / `notifyOnWatchOverlap` toggles (backend wired in v3.0 Phase 13; UI exposure new) | Universal |
| 6 | **Appearance** | Theme switch (lifted from UserMenu as a discoverable home), font scale (future) | GitHub, Vercel both place Appearance below Notifications |
| 7 | **Danger Zone** | Delete account (future), wipe collection (future) | GitHub Danger Zone is universal pattern |

#### Table Stakes

| Feature | Why Expected | Complexity | Dependencies / Notes |
|---|---|---|---|
| **Account section: change email** | Universal table stakes for any authenticated app since 2010. v3.0 omits it. | M | STACK.md: `supabase.auth.updateUser({ email })` + extend `/auth/confirm` for `type === 'email_change'`. |
| **Account section: change password** | Same. v3.0 omits it. | M | STACK.md: `supabase.auth.updateUser({ password })` + handle `reauthentication_needed` for stale sessions. |
| **Notifications section: opt-out toggles** | Backend already wired in v3.0 Phase 13 (`notifyOnFollow`, `notifyOnWatchOverlap`); UI is the gap. | S | Pure UI exposure of existing fields on `userPreferences`. |
| **Appearance section: theme switch** | Currently in UserMenu; Settings is the discoverable home for cosmetic prefs (GitHub/Vercel pattern). Don't remove from UserMenu — surface in BOTH places. | S | Lift `<InlineThemeSegmented>` into Settings; UserMenu retains its copy. |
| **Vertical-tabs layout (sidebar-style desktop, accordion mobile)** | STACK.md confirms `@base-ui/react` Tabs with `orientation="vertical"`. Standard SaaS pattern. | M | New layout component; URL hash drives active tab. |
| **Toast confirmation on save** | Sonner already in tree; every mutation surfaces a toast (established v3.0 pattern). | S | Existing pattern. |

#### Differentiators

| Feature | Value Proposition | Complexity | Dependencies / Notes |
|---|---|---|---|
| **Preferences live preview — "Here's how your similarity engine reads your taste"** | Surfaces what `collectionGoal` + `overlapTolerance` *do*. Without this, the knobs are obscure ("balanced vs specialist vs variety" — what does that mean for me?). Show 1–2 sample similarity verdicts with each setting. | M | Re-uses similarity engine. Renders 2–3 example verdicts at different settings. **Differentiator — can defer.** |
| **Notification preview** — "Here's what a follow notification looks like" | Mirrors GitHub's notification settings preview. Helps users decide which to opt out of. | S | Pure UI. |

#### Anti-Features

| Feature | Why Requested | Why Avoid | Alternative |
|---|---|---|---|
| **Account section as separate route** (`/settings/account`, `/settings/privacy`, …) | Each section gets its own URL | STACK.md: vertical tabs with hash-based state (`/settings#account`) survive `router.refresh()` AND remain shareable, without per-route layout boilerplate. Can migrate later if sections balloon. | URL-hash-driven tabs. |
| **Granular per-notification-actor opt-out** ("don't notify me about @user") | Power-user surface | Massive scope creep; mute-list infra; not an MVP problem. | Two coarse toggles (per type) only. |
| **Email-change without re-auth** | Less friction | Security regression — STACK.md: keep "Secure email change" + "Secure password change" Supabase Dashboard toggles ON. The two-link pattern is the project's two-layer-defense ethos applied to email. | Supabase default flow. |
| **Delete-account button shipped without confirm modal + cooling-off** | Standard "Danger Zone" feature | Too risky to ship in v4.0 without a multi-step flow (typed-username confirmation, 30-day soft-delete, etc). Defer entirely. | Stub the section as "Coming soon" — visible placeholder, not built. **Or omit Danger Zone entirely from v4.0.** |

---

### Feature 6: Profile Prominence in Nav

**Comparable apps:**
- **Letterboxd** — top-right avatar + chevron; click avatar → dropdown with Profile / Activity / Reviews / Lists / Watchlist / Diary / Likes / Settings / Sign Out
- **Mastodon** — top-right avatar opens a sidebar with profile preview + quick actions
- **Discord** — bottom-left avatar with status indicator
- **GitHub** — top-right avatar + dropdown
- **Twitter/X** — top-right avatar mobile bottom-nav profile slot
- **Universal pattern**: avatar in top-right is the dominant convention across the social/taste/dev category

#### Table Stakes

| Feature | Why Expected | Complexity | Dependencies / Notes |
|---|---|---|---|
| **Top-right avatar in `DesktopTopNav`** | Universal social-app convention; v3.0 buries Profile inside UserMenu dropdown — discoverability problem. | S | Pure markup change in `DesktopTopNav.tsx`. Avatar primitive already in `src/components/ui/`. |
| **Avatar click → drops to `/u/{username}` directly** | Letterboxd primary pattern. Avatar IS the profile shortcut. Settings/Sign-out adjacent (chevron) → keep current UserMenu dropdown semantics for those. | S | Two-affordance control: avatar = navigate; chevron = open menu. |
| **Profile slot in mobile `BottomNav`** | Already exists as v3.0 Phase 14. No change needed for mobile. | — | Already shipped. |

#### Differentiators

| Feature | Value Proposition | Complexity | Dependencies / Notes |
|---|---|---|---|
| **Status indicator on avatar** ("worn today" green dot, or notifications dot) | Discord/Mastodon-style. Could double as the notifications indicator (instead of the bell carrying it). | S | Conditional render of a small dot on the avatar. Reuses unread-notifications query. **Optional.** |
| **Avatar long-press / right-click → quick-actions menu** | Power user surface (Letterboxd-app pattern) | Mostly mobile gesture; defer. | None. |

#### Anti-Features

| Feature | Why Requested | Why Avoid | Alternative |
|---|---|---|---|
| **Two top-right profile entries (avatar + Settings link separately)** | "Both ways to access" | Visual clutter. The chevron-on-avatar pattern handles both with one control. | Single avatar control, dual affordance. |
| **Profile-tab-on-desktop bottom nav** | Mobile-desktop parity | Desktop has a top nav; bottom nav is mobile-specific. Forcing parity adds noise. | Keep desktop top-right + mobile bottom-nav profile slot. |

---

### Feature 7: Empty-State CTAs Across Collection / Wishlist / Notes / Worn

**Comparable apps best-in-class:**
- **Linear** — empty Inbox shows literal whitespace + a one-line illustration + "You're all set" + tip ("Track your team's progress here once issues come in"). Subtle.
- **Notion** — empty database shows a sample schema + "Add your first row" CTA + a sample template gallery
- **Letterboxd** — empty Watchlist: "Track films you'd like to watch by adding them to your Watchlist. The clock icon adds a film to it." Plus a button "Browse Films" linking to /films/popular/.
- **Goodreads** — empty Want to Read: "Start tracking books you want to read." + "Find books" CTA.
- **NN/G** core principle (3 guidelines): (1) Explain why the state is empty; (2) Suggest a clear next step (CTA); (3) Use illustrations/icons sparingly.

#### Table Stakes

| Feature | Why Expected | Complexity | Dependencies / Notes |
|---|---|---|---|
| **Empty-state on Collection (no watches owned)** | First-time user lands on home with 0 watches → must see clear next step. | S | Existing `WatchGrid` already renders 0 cards; need to detect length 0 and render `<EmptyState variant="collection">` with CTAs: [Add a watch] [Evaluate a watch] [Browse popular collectors]. |
| **Empty-state on Wishlist** | Letterboxd Watchlist analog. CTA: [Evaluate a watch] [Browse trending] | S | Same pattern. |
| **Empty-state on Worn tab (no wear events ever)** | After v3.0 wear loop ships, a brand-new user lands here often. CTA: [Mark a watch as worn today]. | S | Wear button already exists in `BottomNav`. |
| **Empty-state on Notes tab (no notes on any watch)** | Less common but real. CTA: [Add a note to a watch in your collection]. | S | Existing notes UI. |
| **Empty-state in NotificationsInbox (already shipped)** | v3.0 Phase 13 already shipped. | — | Already shipped. |
| **Empty-state in `/search` Watches/Collections tabs** | See Features 2 & 3 above. | S | Already covered. |
| **Empty-state on `/explore` for new users (sparse network)** | See Feature 1 above. | S | Already covered. |
| **Empty-state copy matches Horlo voice — collector-aware, not generic** | "No watches yet" is lazy. "Your collection is empty — start by adding your daily wearer or your grail" tells the story. | S | Copywriting work. |
| **Single primary CTA per empty state, not 3+** | NN/G research: too many CTAs paralyze. One primary + one optional secondary. | S | Discipline in design phase. |

#### Differentiators

| Feature | Value Proposition | Complexity | Dependencies / Notes |
|---|---|---|---|
| **Onboarding-style empty states (multi-step) on Collection** | First-time users see a 3-step "Add your first watch / Set your preferences / Find collectors" flow inline. NotionNotion uses this for empty databases. | M | New component; 3 dismissable cards. Could feel like onboarding without forcing a tour. |
| **Sample / placeholder data in empty Collection** | Show a "demo" Speedmaster card with overlay "Add yours" — Notion does this. | M | Visually loud but illustrative. **Risk:** users mistake demo for real data. Skip unless designed carefully. |

#### Anti-Features

| Feature | Why Requested | Why Avoid | Alternative |
|---|---|---|---|
| **"No data here" / "Empty" copy** | Quick to write | NN/G specifically calls this out as the lazy-placeholder anti-pattern. Generic "no data" tells the user nothing about *why* and *what to do next*. | Specific, voice-aware copy with CTA. |
| **Multiple competing CTAs in one empty state** | Variety | NN/G: too many CTAs paralyze. One primary, one optional secondary. | Single primary. |
| **Modal-blocking onboarding tour** | Forced engagement | Friction; many users instinctively dismiss. NN/G empty-state guidelines explicitly recommend in-context CTAs over modal tours. | Inline empty-state CTAs. |
| **Loading skeleton stuck rendering forever (de facto empty state)** | Misuse of skeletons | NN/G: empty states should be deliberate, not the result of failure to render. | Detect 0 results → render explicit empty state. |

---

### Feature 8: Form Feedback — Toast vs Inline, Pending States, Error Specificity

**Comparable evidence (NN/G, LogRocket, GOV.UK Design System, Pencil & Paper):**
- **Inline validation** produces a 22% increase in form-success rates and 42% decrease in completion times when feedback is specific.
- **Toast notifications** violate WCAG 2.2 in three ways: timing (auto-dismiss before screen-readers), keyboard accessibility (focus traps), and announcement (not announced unless `aria-live="polite"`). Sonner handles `aria-live` correctly but auto-dismiss timing is still a concern.
- **GOV.UK / Carbon Design System** combines both: error summary at top of form (anchor links to fields) + inline errors next to each field. Best practice for forms with > 3 fields.
- **Sonner** is already in tree (`<ThemedToaster />` shipped in v3.0 Phase 15) bound to custom ThemeProvider.

#### Recommended pattern

| Scenario | Pattern | Rationale |
|---|---|---|
| **Mutation success (transient confirmation)** | Sonner toast | Action complete, no further reading. Auto-dismiss is desirable. v3.0-established pattern. |
| **Mutation error — top-level (network, auth, unknown)** | Sonner toast (error variant) + log to console for ops | Same shape as success; user retries. |
| **Form validation — field-level** | Inline `<ErrorMessage>` next to field + `aria-describedby` | NN/G evidence: specific, location-bound feedback drives 22% success-rate lift. |
| **Form validation — multi-field summary at submit** | Inline summary banner at form top with anchor links | GOV.UK best-practice for forms > 3 fields. |
| **Pending / loading state** | Spinner inside the submit button + button disabled + form fields disabled | Standard submit-button-disabled pattern; prevents double-submit; gives precise location of the operation. |
| **Optimistic update succeeded, then server failed** | Revert UI + toast error + inline indicator on the affected row | The reverted optimistic UI tells the user "this didn't stick"; toast carries the why. |

#### Table Stakes

| Feature | Why Expected | Complexity | Dependencies / Notes |
|---|---|---|---|
| **Sonner toast on every mutation success** | v3.0 pattern is established. Audit all v4.0 surfaces (Account email/password change, preference saves, evaluate-save, etc) and ensure toast hooks. | S | Existing `<ThemedToaster />`. |
| **Inline field-level errors on all forms** | NN/G best practice. v3.0 Phase 999.1 (MR-01) already used this pattern (`role="alert"` + `aria-live="polite"`) for `PreferencesClient` save failures. | S | Pattern established; replicate. |
| **Disabled submit button during pending state** | Prevents double-submit. v3.0 pattern. | S | Existing pattern. |
| **`aria-live="polite"` on form-level status banners** | Accessibility compliance. v3.0 pattern (MR-01). | S | Pattern established. |
| **Contextual error messages — say what went wrong AND what to do** | "Network error" → "Couldn't reach the server. Check your connection and try again." Specific > generic. | S | Copywriting. Per Pencil & Paper / NN/G research, this drives the 22% success-rate lift. |
| **URL-extract error context** ("We couldn't extract this watch from {host}. Try the manufacturer's product page.") | The extract-watch route fails in non-deterministic ways (LLM stage timeout, structured-data missing, host returns 403). Generic error breaks the user. | M | Categorize extract errors in route handler; surface category to client; map to specific copy. Per PROJECT.md v4.0 scope. |
| **Form fields disabled during pending state** | Prevents user editing mid-submit. | S | Standard pattern. |

#### Differentiators

| Feature | Value Proposition | Complexity | Dependencies / Notes |
|---|---|---|---|
| **Promise-based Sonner integration** (`toast.promise()` — auto-pending, success, error states) | Sonner's `toast.promise()` API binds toast lifecycle to the Server Action promise. Cleaner than manual `toast.success()` after `await`. | S | Refactor existing manual toasts. **Optional polish.** |
| **Optimistic-update pattern across more mutations** | v3.0 Phase 13 already uses `useOptimistic` + `useTransition` on `NotificationRow`. Extend to status toggles, follow buttons, etc. | M | Use `useOptimistic` per surface. |
| **Undo-toast for destructive mutations** ("Watch deleted — Undo") | Gmail / Linear pattern. 5-second undo window before commit. Reduces destructive-mutation anxiety. | M | Soft-delete with cron cleanup, or in-memory undo queue. **Optional polish — defer if scope-tight.** |

#### Anti-Features

| Feature | Why Requested | Why Avoid | Alternative |
|---|---|---|---|
| **Toast-only for form errors** | Less visual noise | NN/G: violates WCAG 2.2 (auto-dismiss before screen-readers); user can miss the toast. Inline is canonical for forms. | Toast + inline. |
| **Modal-blocking error dialog** | Demands attention | Pencil & Paper: modal errors are an anti-pattern; they break flow and force user acknowledgment for routine errors. | Inline + toast. |
| **`alert()` / native browser dialog** | Quick to add | Pre-2010 UX. Blocks page; not stylable; not accessible. | Inline / toast. |
| **Vague "Something went wrong"** | Easy to write | NN/G: "Vague errors trigger user blame and frustration; specific errors let users self-correct." | Specific category + recovery action. |
| **Auto-clearing form on error** | Clean slate | User loses everything they typed. Anti-pattern. | Preserve all input on error; surface what failed. |

---

## Feature Dependencies

```
[Catalog `watches_catalog` table — STACK.md]
    ├──unblocks──> [/explore Trending Watches rail]
    ├──unblocks──> [/explore "Watches Gaining Traction" rail (differentiator)]
    ├──unblocks──> [/search Watches tab]
    ├──unblocks──> [/search Collections by-watch-identity (cross-collection)]
    └──unblocks──> [/evaluate?catalogId= deep-link from /search]

[/search Watches result row "Evaluate" button]
    └──requires──> [/evaluate route]

[/evaluate verdict "Add to Wishlist" CTA]
    └──reuses──> [existing addWatch Server Action with status: 'wishlist']
    └──reuses──> [existing similarity engine]
    └──reuses──> [existing /api/extract-watch route]

[Settings Account section: change email]
    └──requires──> [extend /auth/confirm route handler for type=email_change]
    └──requires──> [Supabase custom SMTP — STACK.md Resend integration]

[Settings Account section: change password]
    └──requires──> [supabase.auth.updateUser({password}) + reauth dialog]
    └──optional──> [Supabase "Secure password change" toggle ON]

[Settings Notifications opt-out toggles UI]
    └──reuses──> [v3.0 Phase 13 backend (notifyOnFollow, notifyOnWatchOverlap fields)]

[Settings Appearance theme switch]
    └──reuses──> [v3.0 InlineThemeSegmented component]

[Profile avatar in DesktopTopNav]
    └──reuses──> [Avatar primitive in src/components/ui/]
    └──reuses──> [/u/{username} route (v2.0)]

[Empty-state CTAs across Collection / Wishlist / Worn / Notes]
    └──depends on──> [Detection of `length === 0` state per surface]
    └──depends on──> [Voice-aware copy work]

[Form feedback polish]
    └──reuses──> [v3.0 Sonner ThemedToaster]
    └──reuses──> [v3.0 Phase 999.1 MR-01 pattern (role=alert + aria-live=polite)]
    └──extends──> [/api/extract-watch route handler with categorized error surface]

[/explore "Watches Gaining Traction" rail (differentiator)]
    └──requires──> [watches_catalog_daily_snapshots table + pg_cron daily insert]

[/explore Trending Watches counts]
    └──requires──> [pg_cron daily UPDATE watches_catalog SET owners_count = ... — STACK.md]

[/search Collections "Watches in common" badge]
    └──requires──> [Common Ground intersection (v2.0)]
```

### Critical-path dependencies

- **`watches_catalog` is the keystone.** /explore Trending, /search Watches, /search Collections by-watch-identity, and /evaluate?catalogId= all depend on it. Land it first.
- **Custom SMTP unblocks Account section.** Without it, email-change confirmation links go nowhere. Must precede the Account UI.
- **`/evaluate` route can ship independently** of catalog (URL-paste path works), but the cross-feature wiring from /search Watches → Evaluate requires catalog.
- **Settings restructure is independent** of catalog work — could ship in parallel.

### Conflicts (none material)

No anti-feature conflicts identified. The strongest tension is between "search WITHIN collection" (within-profile filter) vs "search ACROSS collections" (the Collections tab) — but Feature 3 resolves this by routing within-profile filtering to the existing `/u/{user}` FilterBar and reserving `/search` for across-collection.

---

## MVP Definition (v4.0 — what to launch with)

### Launch With (v4.0 core)

Minimum to satisfy the v4.0 milestone goal: finish v3.0-era stubs, expose schema-driven knobs, surface similarity as a first-class flow, and lay catalog foundation.

- [ ] **`watches_catalog` table + nullable FK from `watches.catalog_id` + backfill** — keystone (S–M; STACK.md confirms expand-contract pattern is single-pass safe at v4.0 scale)
- [ ] **/explore: Popular Collectors rail + Trending Watches rail + sparse-network welcome hero** — table stakes for /explore (M)
- [ ] **/search Watches tab populated** with thumbnails + owned/wishlist badges + "Evaluate" inline CTA + empty/no-result states (M)
- [ ] **/search Collections tab populated** with cross-collection by-watch-identity + by-tag-profile + privacy-gated rows + empty state (M)
- [ ] **/evaluate route** with paste-URL → verdict + three-CTA ladder (Save to Evaluate Later = wishlist / Add to Wishlist / Add to Collection) — reuses existing extract pipeline + similarity engine (M)
- [ ] **Settings restructure**: vertical tabs / hash-driven, sections in canonical order (Account / Profile / Preferences / Privacy / Notifications / Appearance) (M)
- [ ] **Settings → Account section: change email + change password** with re-auth flow (M)
- [ ] **Settings → Preferences UI for `collectionGoal` + `overlapTolerance`** — schema fields exist; expose them (S)
- [ ] **Settings → Notifications opt-out toggle UI** — backend wired in v3.0 Phase 13; UI is the gap (S)
- [ ] **Custom SMTP via Resend** + email confirmation ON (config, not code; STACK.md) (S)
- [ ] **Profile avatar in `DesktopTopNav` (top-right)** + dual affordance (avatar = profile, chevron = menu) (S)
- [ ] **Empty-state CTAs on Collection / Wishlist / Worn / Notes** with voice-aware copy + single primary CTA (S)
- [ ] **Form feedback polish**: Sonner toast + inline `aria-live` + categorized URL-extract errors + pending states (S)
- [ ] **Owner edit surface for `notesPublic` per-note visibility** in WatchForm/WatchDetail (S)
- [ ] **`isChronometer` toggle in WatchForm + display in WatchDetail** (S)
- [ ] **WYWT post-submit auto-nav to `/wear/[id]`** (S — v3.0 deferred UX item)
- [ ] **Remove `price_drop` + `trending_collector` notification stubs** (S — code cleanup)
- [ ] **Test fixture cleanup** — 9 files referencing removed `wornPublic` (S — chore)
- [ ] **TEST-04 / TEST-05 / TEST-06** — carried-over test gaps (M total)

### Add After Validation (v4.x)

- [ ] **/explore "Watches Gaining Traction" rail** (7-day delta — requires `watches_catalog_daily_snapshots`) — only if user feedback says raw popularity is stale-feeling
- [ ] **/explore "Collectors Like You" personalized rail** — requires `>= 5` watches per viewer to be meaningful
- [ ] **/search Watches filter facets** (Movement, Case size, Style) — only after catalog exceeds ~30 rows per top-3 query
- [ ] **/search Collections "Watches in common" badge** — Common Ground reuse, polish item
- [ ] **/evaluate "Compare with this watch I already own" pairwise drill-down** — power-user surface
- [ ] **/evaluate shareable verdict URL** (`?shared=true` mode)
- [ ] **Preferences live preview** — sample similarity verdicts at different settings
- [ ] **Onboarding-style multi-step empty state** on Collection (Notion-style)
- [ ] **Sonner `toast.promise()` refactor** — code-cleanliness polish
- [ ] **Optimistic-update extension** to status toggles + follow buttons
- [ ] **Undo-toast for destructive mutations** (delete watch, etc)
- [ ] **Status indicator on profile avatar** (worn-today dot or unread-notifications dot)
- [ ] **`/u/{user}?q=…` deep-linkable within-profile search** (URL param to FilterBar)

### Future Consideration (v5+)

- [ ] **Taste Clusters visualization** — k-means or hierarchical clustering on preference vectors (STACK.md defers to v5.0)
- [ ] **Editorial Featured Collection on /explore** — admin-curated weekly highlight; needs admin tooling
- [ ] **Account section: Delete Account / Wipe Collection** — Danger Zone needs multi-step confirmation flow + soft-delete cron
- [ ] **Multi-watch Comparison Tool** (`/compare?urls=a,b,c`) — explicit n-way comparison
- [ ] **Watch-overlap digest emails** (would need `resend` SDK install per STACK.md)
- [ ] **Saved-search alerts** (notify when collection matches criteria)
- [ ] **Faceted search on Collections tab** (composition shape facets)
- [ ] **Realtime updates** (when free-tier 200-WS limit becomes acceptable)

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---|---|---|---|
| `watches_catalog` table + backfill | HIGH (unblocks 4 surfaces) | M | P1 |
| /explore Popular Collectors rail | HIGH | S | P1 |
| /explore Trending Watches rail | HIGH | M | P1 |
| /explore sparse-network hero | MEDIUM | S | P1 |
| /search Watches tab populated | HIGH | M | P1 |
| /search Collections cross-collection | HIGH | M | P1 |
| /evaluate route + verdict + 3-CTA ladder | HIGH (core differentiator surface) | M | P1 |
| Settings restructure (vertical tabs) | MEDIUM | M | P1 |
| Settings Account: change email | HIGH (table stakes) | M | P1 |
| Settings Account: change password | HIGH (table stakes) | M | P1 |
| Settings Preferences: collectionGoal + overlapTolerance UI | MEDIUM | S | P1 |
| Settings Notifications opt-out UI | MEDIUM | S | P1 |
| Custom SMTP + email confirmation ON | MEDIUM | S (config) | P1 |
| Profile avatar in DesktopTopNav | MEDIUM | S | P1 |
| Empty-state CTAs (Collection / Wishlist / Worn / Notes) | MEDIUM | S | P1 |
| Form feedback polish (toast + inline + categorized errors) | MEDIUM | S–M | P1 |
| `notesPublic` per-note visibility owner edit | LOW–MEDIUM | S | P1 |
| `isChronometer` toggle in WatchForm | LOW | S | P1 |
| WYWT post-submit auto-nav to /wear/[id] | MEDIUM | S | P1 |
| Remove price_drop + trending_collector stubs | LOW (cleanup) | S | P1 |
| Test fixture cleanup + TEST-04/05/06 | MEDIUM (debt) | M | P1 |
| /explore "Watches Gaining Traction" (7-day delta) | MEDIUM | M | P2 |
| /search Watches filter facets | MEDIUM | M | P2 |
| /evaluate pairwise drill-down | MEDIUM | M | P2 |
| Preferences live preview | MEDIUM | M | P2 |
| Sonner toast.promise refactor | LOW (polish) | S | P2 |
| Onboarding multi-step empty state | LOW–MEDIUM | M | P2 |
| Status indicator on avatar | LOW | S | P2 |
| Undo-toast for destructive mutations | LOW–MEDIUM | M | P2 |
| Taste Clusters viz | HIGH (eventually) | HIGH | P3 |
| Watch-overlap digest emails | LOW (currently) | M | P3 |
| Editorial Featured Collection | LOW (currently) | M (with tooling) | P3 |
| Delete Account / Danger Zone | MEDIUM | M (multi-step + soft-delete) | P3 |

**Priority key:**
- P1: Must have for v4.0 launch
- P2: Should have, add in v4.x patch milestones
- P3: Nice to have, future milestone consideration

---

## Competitor Feature Analysis

| Feature | Letterboxd | Discogs | Goodreads | Are.na | Untappd | Horlo v4.0 |
|---|---|---|---|---|---|---|
| Explore: Popular | Films/lists/members rails | Trending Releases + Most Collected | Choice Awards + new releases | Chronological firehose | Top Rated Beers | Popular Collectors + Trending Watches rails |
| Explore: Personalized | Implicit (recommendations) | Minimal | 20B-data-point engine | None | "What friends are drinking" | Common Ground + sparse-network hero |
| Catalog search | Global; autocomplete with poster | Top-bar with scope select | Title/author/ISBN; autocomplete | Search blocks | Beer search | Live debounced; 2-char min; thumbnails; owned/wishlist badges |
| Search filter facets | Genre / decade / rating | Genre / format / style / year | Limited | Tags | Style / ABV | Movement + Case size + Style (P2) |
| Cross-collection ("who owns X") | "Members enjoying" | "X have this in collection" — first class | Largely missing (frequent user complaint) | N/A | Friends-only | Cross-collection by watch + by tag profile |
| Save-vs-commit | Watchlist (clock-icon toggle) → Logged | Wantlist → Collection | Want to Read → Currently Reading → Read | Save to channel (no commit hierarchy) | Wishlist → Tried | Save to Evaluate Later (= wishlist) → Wishlist → Owned |
| Evaluate-without-commit | Watchlist exists; no "is this a fit?" engine | Wantlist; no fit engine | Want-to-Read; basic recommendation | Channels; no fit engine | Recommendations; no fit engine | **/evaluate route — verdict + 3-CTA ladder (differentiator)** |
| Settings IA | Profile/Account/Privacy/Notifs/Reviews | Account/Marketplace/Privacy/Notifs | Account/Profile/Settings/Email/Apps | Profile/Account/Privacy | Profile/Notifs/Privacy | Account/Profile/Preferences/Privacy/Notifs/Appearance |
| Profile in nav | Top-right avatar | Top-right avatar | Top-right avatar | Top-right avatar | Top-right avatar (web) | Top-right avatar + chevron split |
| Empty-state quality | Decent | Minimal | Generic | Excellent (Are.na nails this) | Decent | Voice-aware single-CTA per surface |
| Form feedback | Toast + inline | Toast | Toast | Toast | Toast + inline | Sonner toast + inline + categorized URL-extract errors |

---

## Confidence Assessment

| Area | Confidence | Basis |
|---|---|---|
| /explore section composition (Popular Collectors + Trending Watches + welcome hero) | MEDIUM | Comparable apps diverge; Letterboxd is editorial, Discogs is community-aggregated, Are.na is firehose. Recommendation synthesizes the two we're closest to (Letterboxd + Discogs) given Horlo's positioning. Sparse-network handling is HIGH confidence (NN/G + Spotify editorial-fallback evidence). |
| /search Watches table stakes | HIGH | Universal pattern across Letterboxd, Discogs, Goodreads, Spotify; Phase 16 already proved the technical pattern for People |
| /search Collections cross-collection-by-default | MEDIUM | NN/G "users forget which scope they're in" is HIGH-confidence guidance; the specific feature shape (by-watch-identity + by-tag-profile) is opinionated and could be split differently |
| /evaluate route (not modal) + 3-CTA ladder | HIGH | STACK.md route-vs-modal argument is solid; 3-CTA ladder maps cleanly to existing `WatchStatus` enum without schema change |
| Reuse `wishlist` for "save to evaluate later" (vs new `evaluating` status) | MEDIUM | Argument is sound but a senior reviewer might disagree if they want sharper "haven't decided" semantics. Easy to revisit. |
| Settings IA section ordering | HIGH | GitHub / Vercel / Linear / Discord / Letterboxd all converge on Account → Profile → Privacy → Notifs → Appearance → Danger |
| Vertical-tabs over per-route Settings sections | HIGH | STACK.md confirms `@base-ui/react` Tabs `orientation="vertical"`; hash-driven state is a clean pattern |
| Profile avatar top-right in DesktopTopNav | HIGH | Universal across Letterboxd/Mastodon/GitHub/X/Vercel/Linear |
| Empty-state CTA pattern (single primary CTA + voice-aware copy) | HIGH | NN/G 3-guideline framework is canonical; Linear / Notion / Letterboxd evidence converges |
| Toast + inline form feedback combination | HIGH | NN/G + GOV.UK + Pencil & Paper all converge; Sonner already in tree; Phase 999.1 MR-01 pattern is established |
| Categorized URL-extract error copy | MEDIUM | Pattern is correct; the specific category taxonomy (host-403, structured-data-missing, LLM-timeout, etc) is a design choice that should get a final read in the architecture phase |
| `pg_cron` daily-batch over live triggers for `owners_count` | MEDIUM | STACK.md confirms; live-vs-batch is a tradeoff worth a final read |

---

## Sources

**/explore + discovery patterns:**
- [Letterboxd Popular films / lists](https://letterboxd.com/films/popular/) and [Popular lists](https://letterboxd.com/lists/popular/)
- [Letterboxd Welcome](https://letterboxd.com/welcome/) — discovery framing
- [Discogs Explore navigation guide](https://www.discogs.com/digs/collecting/16-million-releases-cataloged-in-discogs-database/)
- [Discogs database search](https://support.discogs.com/hc/en-us/articles/360003622014-How-To-Browse-Search-In-The-Database)
- [Are.na Channels & Explore](https://help.are.na/docs/getting-started/channels) and [Are.na Wikipedia overview](https://en.wikipedia.org/wiki/Are.na)
- [Goodreads Recommendation Engine announcement](https://www.goodreads.com/blog/show/303-announcing-goodreads-personalized-recommendations)
- [Untappd discovery](https://untappd.com/) and [Top Rated Beers](https://untappd.com/beer/top_rated)
- [Spotify editorial-playlist ecosystem (1B streams/week evidence)](https://www.absolutelabelservices.com/news/spotifys-editorial-ecosystem-how-playlists-power-discovery)
- [Sparse-network handling — content discovery 2026](https://beomniscient.com/blog/content-discovery-tools/)

**Catalog search UX:**
- [Adobe Commerce Live Search best practices](https://experienceleague.adobe.com/en/docs/commerce/live-search/best-practice)
- [Faceted Search Best Practices for E-commerce 2026](https://www.brokenrubik.com/blog/faceted-search-best-practices)
- [Smart autocomplete best practices (Grid Dynamics)](https://blog.griddynamics.com/smart-autocomplete-best-practices/)
- [Master Search UX in 2026](https://www.designmonks.co/blog/search-ux-best-practices)
- [Algolia search filter UX](https://www.algolia.com/blog/ux/search-filter-ux-best-practices)

**Save-vs-commit pattern:**
- [Letterboxd Watchlist vs Lists FAQ](https://letterboxd.zendesk.com/hc/en-us/articles/15179261056143-What-s-the-difference-between-my-lists-and-my-watchlist)
- [Goodreads exclusive vs nonexclusive shelves](https://help.goodreads.com/s/article/How-do-I-create-custom-shelves-1553870934223)
- [NN/G — Wishlist or shopping cart](https://www.nngroup.com/articles/wishlist-or-cart/)
- [Save For Later UX (Ty Maxey case study)](https://medium.com/ty-maxey/save-for-later-f51dc8c22657)
- [Are.na — Channels and Save](https://www.are.na/about)

**Settings IA / page structure:**
- [Vercel Account Management](https://vercel.com/docs/accounts)
- [GitHub Settings IA] (observable across `github.com/settings/profile` etc — direct observation, no single doc URL)
- [Base UI Tabs (vertical orientation)](https://base-ui.com/react/components/tabs)
- [shadcn vertical tabs pattern](https://www.shadcn.io/patterns/tabs-layout-1)

**Profile avatar in nav:**
- [Letterboxd profile avatar / nav](https://mattbusiness.com/update-your-letterboxd-profile/) and [Letterboxd UX redesign analysis](https://medium.com/@khushi.pro/letterboxd-redesign-improving-the-user-experience-of-a-social-film-discovery-platform-1b94a404ae09)
- [Mastodon profile setup](https://docs.joinmastodon.org/user/profile/)

**Empty states:**
- [NN/G — Designing Empty States in Complex Applications: 3 Guidelines](https://www.nngroup.com/articles/empty-state-interface-design/)
- [Carbon Design System — Empty States Pattern](https://carbondesignsystem.com/patterns/empty-states-pattern/)
- [Pencil & Paper — Empty State UX Examples](https://www.pencilandpaper.io/articles/empty-states)
- [Smashing Magazine — Empty States in User Onboarding](https://www.smashingmagazine.com/2017/02/user-onboarding-empty-states-mobile-apps/)

**Form feedback:**
- [NN/G — 10 Design Guidelines for Reporting Errors in Forms](https://www.nngroup.com/articles/errors-forms-design-guidelines/)
- [Pencil & Paper — Error Message UX](https://www.pencilandpaper.io/articles/ux-pattern-analysis-error-feedback)
- [Pencil & Paper — Success Message UX](https://www.pencilandpaper.io/articles/success-ux)
- [LogRocket — Top React toast libraries 2025](https://blog.logrocket.com/react-toast-libraries-compared-2025/)
- [Replacing Toasts with Accessible User Feedback Patterns](https://dev.to/miasalazar/replacing-toasts-with-accessible-user-feedback-patterns-1p8l)
- [Sonner Toast docs](https://sonner.emilkowal.ski/toast)

**Scoped vs global search:**
- [NN/G — Scoped Search: Dangerous, but Sometimes Useful](https://www.nngroup.com/articles/scoped-search/)
- [UX Movement — Global vs Scoped Search](https://uxmovement.com/navigation/global-vs-scoped-search-which-gives-better-results/)
- [Discogs collection filter discussion](https://www.discogs.com/forum/thread/735729)

---

*Feature research for: Horlo v4.0 Discovery & Polish*
*Researched: 2026-04-26*
