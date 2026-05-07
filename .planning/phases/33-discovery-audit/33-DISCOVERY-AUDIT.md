---
title: Discovery Audit — v5.0 Click-Path Map
status: draft
date: 2026-05-06
audit_seed: SEED-004
phase: 33-discovery-audit
requirement: DISC-10
decision: pending
---

# Discovery Audit — v5.0

> Read-only click-path audit of v5.0 discovery surfaces.
> Zero code, schema, or dependency changes ship in this phase
> (per ROADMAP §Phase 33 success criterion #5).

## Pass/Fail Criteria

The audit passes IFF all 5 rules below hold (mechanically enforced by
`.planning/phases/33-discovery-audit/checks/full.sh`):

1. Every surface in the D-05 scope list has ≥1 row in the table.
2. Every Dead row has reproduction steps in `evidence` (file:line for source-pass; URL + observation for browser-pass).
3. Every Missing row cites the SEED-004 Rdio quote violation in `evidence`.
4. Every Redundant row cites the specific row ID it duplicates in `evidence`.
5. All 4 mandated decisions in the final § have an explicit YES/NO/DEFERRED resolution with rationale anchored to ≥1 row ID.

### Tag definitions (D-11)

- **Live:** element renders in the documented `viewer_state` AND target loads to expected destination (200 + correct content in browser pass; route handler exists in source pass).
- **Dead:** element renders but target 404s, errors, or no-ops. Includes the WR-07 silent-no-op pattern (`revalidatePath('/u/{username}/{tab}', 'page')` against a literal-template route).
- **Redundant:** element renders AND target works, but another element on the same surface OR a different surface delivers the same destination/value. Row MUST cite the specific row it's redundant to in `evidence` (`Redundant to DISC-AUDIT-NN`).
- **Missing:** NO element exists for an affordance the SEED-004 Rdio quote expects. Row's `target` reads "—" and `evidence` MUST cite the specific principle violation (e.g., `Rdio violation: catalog page has no affordance to walk to other watches in the same family`).

### Row schema (D-10)

Exactly 8 columns, this order:

1. `row_id` — `DISC-AUDIT-NN` (zero-padded to 2 digits when N<10), flat sequential, no gaps, no duplicates.
2. `surface` — one of the 13 D-05 blocks (Header, `/`, `/explore`, `/search`, `/catalog/{catalogId}`, `/watch/{id}`, `/u/{user}/collection`, `/u/{user}/wishlist`, `/u/{user}/worn`, `/u/{user}/notes`, `/u/{user}/stats`, `/u/{user}/common-ground`, `/u/{user}/insights`).
3. `element` — the visible affordance (e.g., "Avatar in PopularCollectors row", "Brand pill on WatchDetail").
4. `target` — route or action; `—` for non-navigational onClicks; `—` for Missing rows.
5. `tag` — exactly one of: `Live`, `Dead`, `Redundant`, `Missing`.
6. `evidence` — `file:line` for source-pass rows; `prod: <URL> + <observation>` for browser-pass rows; `Redundant to DISC-AUDIT-NN — <reason>` for Redundant; `Rdio violation: <description>` for Missing.
7. `viewer_state` — exactly one of: `owner-populated`, `fresh-account`, `N/A`.
8. `viewport` — exactly one of: `desktop`, `mobile`, `both`.

## Rdio Principle Anchor

> "A collector should be able to drift from one watch / collector / family / reference to another by clicking, without ever feeling lost or running into a dead end."
>
> — `.planning/seeds/SEED-004-v5-discovery-north-star.md` line 15

Every Missing row in the Click-Path Audit table MUST cite this principle by name (`Rdio violation:` or `SEED-004`) in its `evidence` cell. This is the SINGLE rubric per D-12 — no alternative anchors permitted.

## Click-Path Audit

| row_id | surface | element | target | tag | evidence | viewer_state | viewport |
|--------|---------|---------|--------|-----|----------|--------------|----------|
| DISC-AUDIT-01 | Header | SlimTopNav Horlo wordmark Link | / | Live | src/components/layout/SlimTopNav.tsx:53 | TBD | mobile |
| DISC-AUDIT-02 | Header | SlimTopNav Search icon Link | /search | Live | src/components/layout/SlimTopNav.tsx:57 | TBD | mobile |
| DISC-AUDIT-03 | Header | SlimTopNav NotificationBell trigger | /notifications | Live | src/components/layout/SlimTopNav.tsx:64 — `{hasUser && bell}` renders NotificationBell Server Component | TBD | mobile |
| DISC-AUDIT-04 | Header | DesktopTopNav Horlo wordmark Link | / | Live | src/components/layout/DesktopTopNav.tsx:69 | TBD | desktop |
| DISC-AUDIT-05 | Header | DesktopTopNav Explore Link | /explore | Live | src/components/layout/DesktopTopNav.tsx:72 | TBD | desktop |
| DISC-AUDIT-06 | Header | DesktopTopNav persistent search input (submit) | /search?q=... | Live | src/components/layout/DesktopTopNav.tsx:79 — handleSearchSubmit window.location.href | TBD | desktop |
| DISC-AUDIT-07 | Header | DesktopTopNav NavWearButton (opens WywtPostDialog) | — | Live | src/components/layout/DesktopTopNav.tsx:97 + src/components/layout/NavWearButton.tsx:101 — onClick setOpen(true) | TBD | desktop |
| DISC-AUDIT-08 | Header | DesktopTopNav Add-watch icon Link | /watch/new?returnTo=... | Live | src/components/layout/DesktopTopNav.tsx:98 | TBD | desktop |
| DISC-AUDIT-09 | Header | DesktopTopNav NotificationBell trigger | /notifications | Live | src/components/layout/DesktopTopNav.tsx:106 — `{bell}` shared by reference with SlimTopNav | TBD | desktop |
| DISC-AUDIT-10 | Header | UserMenu avatar Link | /u/{viewer-username}/collection | Live | src/components/layout/UserMenu.tsx:110 — Link wrapping AvatarDisplay (size-11 hit target) | TBD | both |
| DISC-AUDIT-11 | Header | UserMenu chevron DropdownMenu trigger | — | Live | src/components/layout/UserMenu.tsx:124 — DropdownMenuTrigger renders ChevronDown Button | TBD | both |
| DISC-AUDIT-12 | Header | UserMenu dropdown Settings item Link | /settings | Live | src/components/layout/UserMenu.tsx:68 | TBD | both |
| DISC-AUDIT-13 | Header | UserMenu dropdown Sign out form button | logout Server Action | Live | src/components/layout/UserMenu.tsx:77 — form action={logout} | TBD | both |
| DISC-AUDIT-14 | Header | UserMenu Sign in Link (unauth fallback) | /login | Live | src/components/layout/UserMenu.tsx:51 — `!user` branch | N/A | both |
| DISC-AUDIT-15 | Header | BottomNav Home NavLink | / | Live | src/components/layout/BottomNav.tsx:126 + :77 NavLink Link | TBD | mobile |
| DISC-AUDIT-16 | Header | BottomNav Search NavLink | /search | Live | src/components/layout/BottomNav.tsx:128 | TBD | mobile |
| DISC-AUDIT-17 | Header | BottomNav NavWearButton (Wear circle, opens WywtPostDialog) | — | Live | src/components/layout/BottomNav.tsx:139 + src/components/layout/NavWearButton.tsx:81 onClick setOpen(true) | TBD | mobile |
| DISC-AUDIT-18 | Header | BottomNav Explore NavLink | /explore | Live | src/components/layout/BottomNav.tsx:144 | TBD | mobile |
| DISC-AUDIT-19 | Header | BottomNav Profile NavLink | /u/{viewer-username}/collection | Live | src/components/layout/BottomNav.tsx:150 — `profileHref` | TBD | mobile |
| DISC-AUDIT-20 | Header | Active-state highlight (per-surface aria-current) | — | Live | src/components/layout/BottomNav.tsx:79 + src/components/layout/SlimTopNav.tsx — active state varies by surface; not enumerated per-surface (D-08) | N/A | both |
| DISC-AUDIT-21 | / | WywtRail self-placeholder tile (opens WywtPostDialog) | — | Live | src/components/home/WywtTile.tsx:56 onClick={onOpenPicker}; src/components/home/WywtRail.tsx:111 setPickerOpen(true) | TBD | both |
| DISC-AUDIT-22 | / | WywtRail standard tile (opens WywtOverlay at index) | — | Live | src/components/home/WywtTile.tsx:85 onClick={onOpen}; src/components/home/WywtRail.tsx:108 openAt(tile) | TBD | both |
| DISC-AUDIT-23 | / | WywtOverlay close button | — | Live | src/components/home/WywtOverlay.tsx:96 — onClick onOpenChange(false) | TBD | both |
| DISC-AUDIT-24 | / | WywtOverlay previous slide chevron | — | Live | src/components/home/WywtOverlay.tsx:105 — emblaApi?.scrollPrev() | TBD | desktop |
| DISC-AUDIT-25 | / | WywtOverlay next slide chevron | — | Live | src/components/home/WywtOverlay.tsx:114 — emblaApi?.scrollNext() | TBD | desktop |
| DISC-AUDIT-26 | / | WywtSlide brand+model Link (in overlay) | /watch/{watchId} | Live | src/components/home/WywtSlide.tsx:77 | TBD | both |
| DISC-AUDIT-27 | / | WywtSlide Add to wishlist button (in overlay) | addToWishlistFromWearEvent Server Action | Live | src/components/home/WywtSlide.tsx:110 onClick={handleAddToWishlist} | TBD | both |
| DISC-AUDIT-28 | / | WywtSlide Retry button (error state) | addToWishlistFromWearEvent Server Action | Live | src/components/home/WywtSlide.tsx:101 onClick={handleAddToWishlist} | TBD | both |
| DISC-AUDIT-29 | / | CollectorsLikeYou RecommendationCard Link | /watch/{representativeWatchId} | Live | src/components/home/RecommendationCard.tsx:21 | TBD | both |
| DISC-AUDIT-30 | / | NetworkActivityFeed ActivityRow whole-row Link | /u/{username}/collection | Live | src/components/home/ActivityRow.tsx:34 — absolute-inset Link overlay | TBD | both |
| DISC-AUDIT-31 | / | NetworkActivityFeed ActivityRow watch-name Link (nested) | /watch/{watchId} | Live | src/components/home/ActivityRow.tsx:50 — nested z-10 Link | TBD | both |
| DISC-AUDIT-32 | / | NetworkActivityFeed AggregatedActivityRow whole-row Link | /u/{username}/collection | Live | src/components/home/AggregatedActivityRow.tsx:36 | TBD | both |
| DISC-AUDIT-33 | / | NetworkActivityFeed Load more button | loadMoreFeed Server Action | Live | src/components/home/LoadMoreButton.tsx:78 onClick={handleClick} | TBD | both |
| DISC-AUDIT-34 | / | FeedEmptyState "Find collectors to follow" CTA anchor | #suggested-collectors (same-page anchor) | Live | src/components/home/FeedEmptyState.tsx:21 — Link href="#suggested-collectors" | TBD | both |
| DISC-AUDIT-35 | / | PersonalInsightsGrid SleepingBeautyCard Link | /watch/{watchId} | Live | src/components/home/SleepingBeautyCard.tsx:32 | TBD | both |
| DISC-AUDIT-36 | / | PersonalInsightsGrid MostWornThisMonthCard Link | /watch/{watchId} | Live | src/components/home/MostWornThisMonthCard.tsx:20 | TBD | both |
| DISC-AUDIT-37 | / | PersonalInsightsGrid WishlistGapCard Link | /u/me/wishlist?filter={role} | Live | src/components/home/WishlistGapCard.tsx:23 | TBD | both |
| DISC-AUDIT-38 | / | PersonalInsightsGrid CommonGroundFollowerCard Link | /u/{username}/common-ground | Live | src/components/home/CommonGroundFollowerCard.tsx:26 | TBD | both |
| DISC-AUDIT-39 | / | SuggestedCollectors SuggestedCollectorRow whole-row Link | /u/{username}/collection | Live | src/components/home/SuggestedCollectorRow.tsx:36 — absolute-inset Link overlay | TBD | both |
| DISC-AUDIT-40 | / | SuggestedCollectors SuggestedCollectorRow FollowButton | followUser Server Action (or /login?next= unauth) | Live | src/components/home/SuggestedCollectorRow.tsx:87 + src/components/profile/FollowButton.tsx:132 onClick={handleClick} | TBD | both |
| DISC-AUDIT-41 | / | SuggestedCollectors Load more button | loadMoreSuggestions Server Action | Live | src/components/home/LoadMoreSuggestionsButton.tsx:79 onClick={handleClick} | TBD | both |
| DISC-AUDIT-42 | / | WatchPickerDialog list-item button (select watch) | — | Live | src/components/home/WatchPickerDialog.tsx:198 onClick={...setSelectedId} | TBD | both |
| DISC-AUDIT-43 | / | WatchPickerDialog Keep browsing dismiss button | — | Live | src/components/home/WatchPickerDialog.tsx:235 onClick={handleDismiss} | TBD | both |
| DISC-AUDIT-44 | / | WatchPickerDialog Log wear submit button | markAsWorn Server Action | Live | src/components/home/WatchPickerDialog.tsx:242 onClick={handleSubmit} | TBD | both |
| DISC-AUDIT-45 | / | WatchPickerDialog empty-state Add watch Link | /watch/new?returnTo=... | Live | src/components/home/WatchPickerDialog.tsx:154 — Link in empty-collection branch | TBD | both |
| DISC-AUDIT-46 | / | WatchPickerDialog empty-state Keep browsing button | — | Live | src/components/home/WatchPickerDialog.tsx:150 onClick={handleDismiss} | TBD | both |
| DISC-AUDIT-47 | /explore | ExploreHero "Browse popular collectors" CTA Link | /explore/collectors | Live | src/components/explore/ExploreHero.tsx:28 — gated by followingCount<3 && wearEventsCount<1 (G-1) | TBD | both |
| DISC-AUDIT-48 | /explore | PopularCollectors "See all" header Link | /explore/collectors | Live | src/components/explore/PopularCollectors.tsx:36 | TBD | both |
| DISC-AUDIT-49 | /explore | PopularCollectorRow whole-row Link | /u/{username}/collection | Live | src/components/explore/PopularCollectorRow.tsx:42 — absolute-inset Link | TBD | both |
| DISC-AUDIT-50 | /explore | PopularCollectorRow FollowButton | followUser Server Action (or /login?next=) | Live | src/components/explore/PopularCollectorRow.tsx:61 + src/components/profile/FollowButton.tsx:132 | TBD | both |
| DISC-AUDIT-51 | /explore | TrendingWatches "See all" header Link | /explore/watches | Live | src/components/explore/TrendingWatches.tsx:32 | TBD | both |
| DISC-AUDIT-52 | /explore | TrendingWatches DiscoveryWatchCard Link | /catalog/{catalogId} | Live | src/components/explore/DiscoveryWatchCard.tsx:29 | TBD | both |
| DISC-AUDIT-53 | /explore | GainingTractionWatches "See all" header Link | /explore/watches | Redundant | src/components/explore/GainingTractionWatches.tsx:35; Redundant to DISC-AUDIT-51 — both rails point at the same /explore/watches sub-route | TBD | both |
| DISC-AUDIT-54 | /explore | GainingTractionWatches DiscoveryWatchCard Link | /catalog/{catalogId} | Live | src/components/explore/DiscoveryWatchCard.tsx:29 — same component as TrendingWatches | TBD | both |
| DISC-AUDIT-55 | /explore | /explore/collectors paginated 'see all' page (D-06 summary row) | /explore/collectors | Live | src/app/explore/collectors/page.tsx:23 — paginated 'see all' list (LIMIT 50, no pagination); downstream affordances identical to parent rail rows DISC-AUDIT-49..50 | TBD | both |
| DISC-AUDIT-56 | /explore | /explore/watches paginated 'see all' page (D-06 summary row) | /explore/watches | Live | src/app/explore/watches/page.tsx:56 — paginated 'see all' list (Trending + Gaining Traction stacked sections, LIMIT 50 each); downstream affordances identical to parent rail rows DISC-AUDIT-52, DISC-AUDIT-54 | TBD | both |
| DISC-AUDIT-57 | /search | Search input field (debounced query) | useSearchState debouncedQ → router.replace | Live | src/components/search/SearchPageClient.tsx:103 onChange={setQ}; src/components/search/useSearchState.ts:104 router.replace | N/A | both |
| DISC-AUDIT-58 | /search | TabsList tab triggers (All/Watches/People/Collections) | setTab(value) state change | Live | src/components/search/SearchPageClient.tsx:114-117 | N/A | both |
| DISC-AUDIT-59 | /search | All-tab Section "See all" button (per-section) | setTab(section) state change | Live | src/components/search/AllTabResults.tsx:161 onClick={onSeeAll} | N/A | both |
| DISC-AUDIT-60 | /search | PeopleSearchRow whole-row Link | /u/{username}/collection | Live | src/components/search/PeopleSearchRow.tsx:47 — absolute-inset Link | TBD | both |
| DISC-AUDIT-61 | /search | PeopleSearchRow FollowButton | followUser Server Action (or /login?next=) | Live | src/components/search/PeopleSearchRow.tsx:102 + src/components/profile/FollowButton.tsx:132 | TBD | both |
| DISC-AUDIT-62 | /search | WatchSearchRow body Link (image + brand/model + Owned/Wishlist pill) | /catalog/{catalogId} | Live | src/components/search/WatchSearchRow.tsx:30 | TBD | both |
| DISC-AUDIT-63 | /search | WatchSearchRowsAccordion chevron trigger (expand verdict) | getVerdictForCatalogWatch Server Action | Live | src/components/search/WatchSearchRowsAccordion.tsx:147 — Accordion.Trigger; src/components/search/WatchSearchRowsAccordion.tsx:58 lazy-fetch verdict | TBD | both |
| DISC-AUDIT-64 | /search | WatchSearchRowsAccordion Verdict pill/CollectionFitCard render (in panel) | — | Live | src/components/search/WatchSearchRowsAccordion.tsx:160 + src/components/insights/CollectionFitCard.tsx:41 — Verdict label rendered as Badge inside CardTitle | TBD | both |
| DISC-AUDIT-65 | /search | WatchSearchRowsAccordion "Add to Wishlist" button (in panel) | addWatch Server Action + toast View → /u/{viewer-username}/wishlist | Live | src/components/search/WatchSearchRowsAccordion.tsx:169 onClick={handleAddToWishlist}; src/components/search/WatchSearchRowsAccordion.tsx:105 router.push wishlist | TBD | both |
| DISC-AUDIT-66 | /search | WatchSearchRowsAccordion "Add to Collection" button (in panel) | /watch/new?catalogId=...&intent=owned&returnTo=... | Live | src/components/search/WatchSearchRowsAccordion.tsx:189 onClick={handleAddToCollection}; src/components/search/WatchSearchRowsAccordion.tsx:125 router.push | TBD | both |
| DISC-AUDIT-67 | /search | CollectionSearchRow whole-row Link | /u/{username}/collection | Live | src/components/search/CollectionSearchRow.tsx:47 — absolute-inset Link | TBD | both |
| DISC-AUDIT-68 | /search | SuggestedCollectorsForSearch SuggestedCollectorRow whole-row Link (pre-query / no-results state) | /u/{username}/collection | Live | src/app/search/page.tsx:88 → src/components/home/SuggestedCollectorRow.tsx:36 (rendered inside SearchPageClient children slot) | TBD | both |
| DISC-AUDIT-69 | /search | SuggestedCollectorsForSearch FollowButton (pre-query / no-results state) | followUser Server Action | Live | src/components/home/SuggestedCollectorRow.tsx:87 + src/components/profile/FollowButton.tsx:132 | TBD | both |
| DISC-AUDIT-70 | /catalog/{catalogId} | Verdict label/pill on CollectionFitCard (cross-user framing) | — | Live | src/app/catalog/[catalogId]/page.tsx:145 + src/components/insights/CollectionFitCard.tsx:41 — Verdict Badge rendered when collection.length > 0 (G-4) | TBD | both |
| DISC-AUDIT-71 | /catalog/{catalogId} | Verdict mostSimilar list watch row (text-only, no link) | — | Live | src/components/insights/CollectionFitCard.tsx:69 — non-link list item; SEED-004 Rdio violation candidate (no click affordance to walk to similar watch) — left as Live for source pass; Wave 3 may downgrade | TBD | both |
| DISC-AUDIT-72 | /catalog/{catalogId} | "You own this" callout Link (self-via-cross-user framing G-3) | /watch/{viewer-owned-id} | Live | src/components/insights/CollectionFitCard.tsx:114 — `ownerHref` Link | TBD | both |
| DISC-AUDIT-73 | /catalog/{catalogId} | CatalogPageActions: Add to Wishlist CTA (cross-user framing, collection>0) | addWatch Server Action + toast View → /u/{viewer-username}/wishlist | Live | src/app/catalog/[catalogId]/page.tsx:151 → src/components/watch/CatalogPageActions.tsx:147 onClick={handleWishlist}; CatalogPageActions.tsx:106 router.push wishlist | TBD | both |
| DISC-AUDIT-74 | /catalog/{catalogId} | CatalogPageActions: Add to Collection CTA | /watch/new?catalogId=...&intent=owned&returnTo=... | Live | src/components/watch/CatalogPageActions.tsx:164 onClick={handleCollection}; CatalogPageActions.tsx:128 router.push | TBD | both |
| DISC-AUDIT-75 | /catalog/{catalogId} | CatalogPageActions: Skip CTA | router.back() | Live | src/components/watch/CatalogPageActions.tsx:174 onClick={handleSkip}; CatalogPageActions.tsx:135 router.back() | TBD | both |
| DISC-AUDIT-76 | /watch/{id} | WatchDetail Mark as Worn button (owner-only, owned status) | markAsWorn Server Action | Live | src/components/watch/WatchDetail.tsx:189 onClick={handleMarkAsWorn} — gated `viewerCanEdit && watch.status === 'owned'` (G-7) | TBD | both |
| DISC-AUDIT-77 | /watch/{id} | Edit Link on WatchDetail (owner-only) | /watch/{id}/edit | Live | src/components/watch/WatchDetail.tsx:195 — gated `viewerCanEdit` (G-7 owner) | TBD | both |
| DISC-AUDIT-78 | /watch/{id} | Delete dialog trigger on WatchDetail (owner-only) | — | Live | src/components/watch/WatchDetail.tsx:199 — DialogTrigger Button (G-7 owner) | TBD | both |
| DISC-AUDIT-79 | /watch/{id} | Delete confirm button on WatchDetail (owner-only, in dialog) | removeWatch Server Action → router.push('/') | Live | src/components/watch/WatchDetail.tsx:220 onClick={handleDelete}; WatchDetail.tsx:84 router.push('/') | TBD | both |
| DISC-AUDIT-80 | /watch/{id} | Delete dialog Cancel button on WatchDetail | — | Live | src/components/watch/WatchDetail.tsx:213 onClick={() => setIsDeleteDialogOpen(false)} | TBD | both |
| DISC-AUDIT-81 | /watch/{id} | WatchDetail Verdict label/pill on CollectionFitCard | — | Live | src/components/watch/WatchDetail.tsx:444 + src/components/insights/CollectionFitCard.tsx:41 — Verdict Badge rendered when verdict !== null (G-6) | TBD | both |
| DISC-AUDIT-82 | /watch/{id} | WatchDetail Verdict mostSimilar list watch row (text-only, no link) | — | Live | src/components/insights/CollectionFitCard.tsx:69 — text-only; SEED-004 Rdio violation candidate (no click affordance to similar watch) — Live for source pass; Wave 3 may downgrade | TBD | both |
| DISC-AUDIT-83 | /watch/{id} | WatchDetail Flag-as-good-deal Checkbox (owner-only, wishlist/grail) | editWatch Server Action | Live | src/components/watch/WatchDetail.tsx:172 onCheckedChange (gated `isWishlistLike && viewerCanEdit`) | TBD | both |
| DISC-AUDIT-84 | /u/{user}/collection | ProfileTabs Tab triggers (Collection/Wishlist/Worn/Notes/Stats/CommonGround/Insights) | /u/{username}/{tab} | Live | src/components/profile/ProfileTabs.tsx:73 — render={<Link>} per tab | TBD | both |
| DISC-AUDIT-85 | /u/{user}/collection | ProfileHeader followers Link | /u/{username}/followers | Live | src/components/profile/ProfileHeader.tsx:71 | TBD | both |
| DISC-AUDIT-86 | /u/{user}/collection | ProfileHeader following Link | /u/{username}/following | Live | src/components/profile/ProfileHeader.tsx:78 | TBD | both |
| DISC-AUDIT-87 | /u/{user}/collection | ProfileHeader Edit Profile button (owner-only) | — | Live | src/components/profile/ProfileHeader.tsx:102 onClick={() => setEditing(true)} (toggles ProfileEditForm) | TBD | both |
| DISC-AUDIT-88 | /u/{user}/collection | ProfileHeader FollowButton (non-owner) | followUser Server Action (or /login?next=) | Live | src/components/profile/ProfileHeader.tsx:109 + src/components/profile/FollowButton.tsx:132 | TBD | both |
| DISC-AUDIT-89 | /u/{user}/collection | ProfileEditForm Save Changes button (owner-only) | updateProfile Server Action | Live | src/components/profile/ProfileEditForm.tsx:97 onClick={handleSave} | TBD | both |
| DISC-AUDIT-90 | /u/{user}/collection | ProfileEditForm Discard Changes button (owner-only) | — | Live | src/components/profile/ProfileEditForm.tsx:94 onClick={onDone} | TBD | both |
| DISC-AUDIT-91 | /u/{user}/collection | CollectionTabContent FilterChips role-tag chips | — | Live | src/components/profile/FilterChips.tsx:18 onClick={() => onChange(opt)} | N/A | both |
| DISC-AUDIT-92 | /u/{user}/collection | CollectionTabContent Search input | — | Live | src/components/profile/CollectionTabContent.tsx:163 onChange={setSearch} | N/A | both |
| DISC-AUDIT-93 | /u/{user}/collection | ProfileWatchCard whole-card Link | /watch/{watch.id} | Live | src/components/profile/ProfileWatchCard.tsx:59 | TBD | both |
| DISC-AUDIT-94 | /u/{user}/collection | AddWatchCard Link (owner end-of-grid CTA, populated) | /watch/new?returnTo=... | Live | src/components/profile/AddWatchCard.tsx:35 — gated `isOwner` (G-20 ANTHROPIC_API_KEY-aware in empty branch) | TBD | both |
| DISC-AUDIT-95 | /u/{user}/collection | CollectionTabContent owner empty-state "Add manually" Button (G-20 fallback when ANTHROPIC_API_KEY unset) | /watch/new?manual=1&returnTo=... | Live | src/components/profile/CollectionTabContent.tsx:120 — render={<Link href={manualHref}>} | TBD | both |
| DISC-AUDIT-96 | /u/{user}/collection | CollectionTabContent owner empty-state "Add by URL" Button (G-20 disabled when ANTHROPIC_API_KEY unset) | — | Live | src/components/profile/CollectionTabContent.tsx:104 — disabled Button with tooltip "URL extraction unavailable — ANTHROPIC_API_KEY not set"; affordance renders as disabled (designed lock state per D-11 Live tag definition) | TBD | both |
| DISC-AUDIT-97 | /u/{user}/collection | LockedTabCard Connect CTA — none rendered (G-8 non-owner && !collectionPublic shows lock card with no CTA) | — | Missing | src/components/profile/LockedTabCard.tsx:46 — Lock icon + "{name} keeps their collection private." text; NO Connect/Follow CTA. Rdio violation: locked state offers no affordance to walk back to discovery (SEED-004 — viewer hits a dead-end without a way out). | TBD | both |


## Decisions

Per D-15 + D-17, exactly 4 decisions. Per D-16, each uses the verdict + 2–4 sentence rationale + cited rows + drives template. No 5th catch-all.

### Decision Q1: Combine home and explore?

**Verdict:** PENDING <!-- Wave 3 (Pass D) replaces with YES | NO | DEFERRED -->
**Rationale:** [Wave 3 fills with 2–4 sentences citing audit findings]
**Cited rows:** [Wave 3 fills with DISC-AUDIT-NN, DISC-AUDIT-MM]
**Drives:** [Wave 3 fills with downstream phase / item this verdict gates]

### Decision Q2: Lineage browse priority

**Verdict:** PENDING <!-- Wave 3 (Pass D) replaces with YES | NO | DEFERRED -->
**Rationale:** [Wave 3 fills with 2–4 sentences citing audit findings]
**Cited rows:** [Wave 3 fills with DISC-AUDIT-NN, DISC-AUDIT-MM]
**Drives:** [Wave 3 fills with Phase 35 schema-only vs schema+UI scope, and Phase 39 lineage-browse polish scope]

### Decision Q3: Dead-end closure priority

**Verdict:** PENDING <!-- Wave 3 (Pass D) replaces with YES | NO | DEFERRED -->
**Rationale:** [Wave 3 fills with 2–4 sentences citing audit findings]
**Cited rows:** [Wave 3 fills with DISC-AUDIT-NN, DISC-AUDIT-MM]
**Drives:** [Wave 3 fills with Phase 39 polish item ordering]

### Decision Q4: CAT-13 discovery framing

**Verdict:** PENDING <!-- Wave 3 (Pass D) replaces with YES | NO | DEFERRED -->
**Rationale:** [Wave 3 fills with 2–4 sentences citing audit findings]
**Cited rows:** [Wave 3 fills with DISC-AUDIT-NN, DISC-AUDIT-MM]
**Drives:** [Wave 3 fills with Phase 38 framing — "tech debt" vs "discovery improvement"]

## Cross-References

- `.planning/ROADMAP.md` §"Phase 33: Discovery Audit" lines 132–142 — phase goal + 5 success criteria.
- `.planning/REQUIREMENTS.md` §DISC-10 line 19 — full requirement text.
- `.planning/STATE.md` §"Key Decisions (v5.0)" lines 65–72 — Phase 39 + Phase 35 audit-conditional scope.
- `.planning/seeds/SEED-004-v5-discovery-north-star.md` line 15 — the Rdio principle quote (D-12 anchor).
- `.planning/phases/33-discovery-audit/33-CONTEXT.md` — D-01..D-17 user-confirmed decisions locking the audit method.
- `.planning/phases/33-discovery-audit/33-RESEARCH.md` §"Conditional Rendering Map" — G-1..G-20 runtime gates feeding the viewer_state column.
- Downstream consumers: ROADMAP §Phase 34 line 146, §Phase 35, §Phase 38 lines 193–203, §Phase 39 lines 205–215 — each cites specific DISC-AUDIT-NN rows or the decisions verdicts.
