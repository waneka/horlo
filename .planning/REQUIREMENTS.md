# Requirements: Horlo

**Defined:** 2026-04-19
**Core Value:** Collectors discover watches through other people's collections and taste — not algorithms, catalogs, or content feeds.

## v2.0 Requirements

Requirements for Taste Network Foundation milestone. Each maps to roadmap phases.

### Data Foundation

- [ ] **DATA-01**: RLS policies enabled on all existing tables (users, watches, user_preferences) with `(SELECT auth.uid())` performance pattern
- [ ] **DATA-02**: Profiles table with username, display name, avatar URL, bio, auto-created on signup
- [ ] **DATA-03**: Follows table (asymmetric follow, follower/following) with appropriate indexes
- [ ] **DATA-04**: Activities table logging watch_added, wishlist_added, watch_worn events with user and watch references
- [ ] **DATA-05**: Profile settings table with profile_visibility, collection_public, wishlist_public, worn_public booleans
- [ ] **DATA-06**: Wear events table replacing/augmenting lastWornDate with structured wear history
- [ ] **DATA-07**: RLS policies on all new social tables enforcing ownership for writes and privacy settings for reads

### Profiles

- [ ] **PROF-01**: User can view their own profile page at `/u/[username]` with header (avatar, username, stats, taste tags)
- [ ] **PROF-02**: User can view Collection tab showing owned watches in grid with filters
- [ ] **PROF-03**: User can view Wishlist tab showing tracked intent (target price, notes, status)
- [ ] **PROF-04**: User can view Worn tab showing wear history (timeline + calendar)
- [ ] **PROF-05**: User can view Notes tab showing watch-linked notes
- [ ] **PROF-06**: User can view Stats tab showing collection composition and insights
- [ ] **PROF-07**: User can edit their profile (display name, avatar URL, bio)
- [ ] **PROF-08**: User can view another collector's profile (read-only, respects privacy settings)
- [ ] **PROF-09**: User can see Common Ground taste overlap on another collector's profile
- [ ] **PROF-10**: Profile auto-derives taste tags from collection composition

### Follow System

- [ ] **FOLL-01**: User can follow another collector
- [ ] **FOLL-02**: User can unfollow a collector
- [ ] **FOLL-03**: User can see follower and following counts on any profile
- [ ] **FOLL-04**: User can view list of followers and following on a profile

### Activity Feed

- [x] **FEED-01**: User can view a home feed of network activity from followed collectors
- [x] **FEED-02**: Activity feed shows watch_added, wishlist_added, and watch_worn events
- [x] **FEED-03**: Activity feed uses keyset pagination for efficient loading
- [x] **FEED-04**: Bulk imports generate a single aggregated activity event (not one per watch)
- [x] **FEED-05**: Home page surfaces up to 4 personal insight cards (Sleeping Beauty, Most Worn This Month, Wishlist Gap, Common Ground with a follower)

### Network Home

- [ ] **WYWT-03**: WYWT rail on home page showing followed users' wear events (last 48h, one tile per actor)
- [x] **DISC-02**: "From collectors like you" recommendations on home based on rule-based overlap + co-occurrence
- [x] **DISC-04**: Suggested collectors on home ordered by taste overlap

### Privacy & Settings

- [ ] **PRIV-01**: User can set profile visibility (public/private)
- [ ] **PRIV-02**: User can control collection visibility (public/private)
- [ ] **PRIV-03**: User can control wishlist visibility (public/private)
- [ ] **PRIV-04**: User can control worn history visibility (public/private)
- [ ] **PRIV-05**: Privacy controls enforced at both RLS and DAL layers
- [ ] **PRIV-06**: Private profiles show locked state with follow button visible (Letterboxd pattern)

## Future Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Discovery & Recommendations

- **DISC-01**: User can browse trending watches (network-weighted)
- **DISC-03**: User can browse collector archetypes

### Explore

- **EXPL-01**: User can browse Explore page with structured discovery
- **EXPL-02**: User can see collection paths (co-occurrence driven)
- **EXPL-03**: User can see featured collections and wishlist clusters

### Search

- **SRCH-01**: User can search across watches, collectors, and collections

### Notifications

- **NOTF-01**: User receives notifications for new followers
- **NOTF-02**: User receives notifications for relevant watch activity
- **NOTF-03**: User can configure notification preferences

### WYWT Enhancements

- **WYWT-01**: Dedicated wear page with multiple entry points
- **WYWT-02**: Optional wrist photo, note, and visibility controls on wear events

### Watch Details (Social Context)

- **WTCH-01**: Watch detail page shows owner count, wishlist count, wear count
- **WTCH-02**: Watch detail page shows "Appears in collections" list
- **WTCH-03**: Watch detail page shows collector notes

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Watch linking / canonical DB | v2.0 uses independent per-user entries; normalization deferred to data strategy Phase 2 |
| Image uploads / wrist shots | URL-only for now; Supabase Storage deferred |
| Likes, comments, engagement mechanics | Explicitly excluded per Rdio-inspired product vision |
| Marketplace | Not a marketplace; deferred indefinitely |
| Social feed / heavy posting | Discovery-first, not engagement-first |
| Supabase Realtime | Free tier limits (200 concurrent WS); server-rendered + refresh is sufficient for v2.0 |
| AI recommendation engine | Deferred until social foundation is solid |
| Collection visualization map | Deferred to future milestone |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 6 | Pending |
| DATA-07 | Phase 6 | Pending |
| DATA-02 | Phase 7 | Pending |
| DATA-03 | Phase 7 | Pending |
| DATA-04 | Phase 7 | Pending |
| DATA-05 | Phase 7 | Pending |
| DATA-06 | Phase 7 | Pending |
| PROF-01 | Phase 8 | Pending |
| PROF-02 | Phase 8 | Pending |
| PROF-03 | Phase 8 | Pending |
| PROF-04 | Phase 8 | Pending |
| PROF-05 | Phase 8 | Pending |
| PROF-06 | Phase 8 | Pending |
| PROF-07 | Phase 8 | Pending |
| PROF-10 | Phase 8 | Pending |
| PRIV-01 | Phase 8 | Pending |
| PRIV-02 | Phase 8 | Pending |
| PRIV-03 | Phase 8 | Pending |
| PRIV-04 | Phase 8 | Pending |
| PRIV-05 | Phase 8 | Pending |
| PRIV-06 | Phase 8 | Pending |
| FOLL-01 | Phase 9 | Pending |
| FOLL-02 | Phase 9 | Pending |
| FOLL-03 | Phase 9 | Pending |
| FOLL-04 | Phase 9 | Pending |
| PROF-08 | Phase 9 | Pending |
| PROF-09 | Phase 9 | Pending |
| DISC-02 | Phase 10 | Complete |
| DISC-04 | Phase 10 | Complete |
| FEED-01 | Phase 10 | Complete |
| FEED-02 | Phase 10 | Complete |
| FEED-03 | Phase 10 | Complete |
| FEED-04 | Phase 10 | Complete |
| FEED-05 | Phase 10 | Complete |
| WYWT-03 | Phase 10 | Complete |

**Coverage:**
- v2.0 requirements: 35 total  (was 31; +FEED-05, +WYWT-03, +DISC-02, +DISC-04)
- Mapped to phases: 35
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-19*
*Last updated: 2026-04-21 — Phase 10 scope expansion (FEED-05 + WYWT-03/DISC-02/DISC-04 promoted from future)*
