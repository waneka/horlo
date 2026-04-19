# Product Brief — Horlo

## 1. Product Vision

Horlo is a **taste network for watch collectors** where:

- Collections are identity
- People drive discovery
- Behavior (owning, wanting, wearing) defines taste

The product replaces fragmented discovery (YouTube, forums, marketplaces) with a **single system where users explore watches through other collectors**.

## 2. Core Principles

- **Collections > content**
- **People > algorithms (initially)**
- **Behavior > stated preferences**
- **Discovery > social engagement**
- **Lightweight interactions > heavy posting**

## 3. Core Objects

- **User** — collector identity
- **Watch** — the central content node
- **CollectionEntry** — owned / wishlist / sold
- **WearEvent (WYWT)** — daily wear logging
- **Follow** — collector-to-collector connection
- **Activity** — system-wide event log

## 4. Core Loops

### Identity Loop
Add watches → build collection → profile becomes identity

### Discovery Loop
View collectors → explore their watches → add to wishlist → repeat

### Wear Loop (Retention)
Log wear → generate insights → reinforce usage → return daily

## 5. Pages & Flows

### 5.1 Home

Personalized discovery dashboard driven by network activity, recommendations, and wear signals.

**Sections (top → bottom):**
1. **WYWT Rail** — followed users' wear events, entry point for Wear flow
2. **Recommendations** — "From collectors like you", based on overlap + co-occurrence
3. **Network Activity (condensed)** — adds, wishlist, wear, notes
4. **Personal Insights** — based on collection + wear behavior
5. **Suggested Collectors**

### 5.2 Explore

Cold-start and structured discovery.

**Sections:**
- Trending (network-weighted)
- Collector archetypes
- Collection paths (co-occurrence driven)
- Featured collections
- Featured wishlist clusters

### 5.3 Profile (Self)

Primary identity surface.

**Header:** avatar, username, stats, optional derived taste tags

**Tabs:**
- **Collection** — owned watches (grid), filters + sort, editable
- **Wishlist** — tracked intent (target, notes, status)
- **Worn** — wear history (timeline + calendar)
- **Notes** — watch-linked notes
- **Stats** — composition + insights

### 5.4 Collector Profile (Other User)

Primary discovery surface. Read-only, no management actions. Includes comparison + overlap context.

**Key Modules:**
- Header + follow
- **Common Ground** (taste overlap)
- Collection (with shared highlights)
- Wishlist (discovery surface)
- Worn (behavior signal)
- Similar collectors

### 5.5 Watch Details

Central node for discovery.

**Sections:**
- Watch hero (image + metadata)
- Social context: owner count, wishlist count, wear count
- Collector notes
- Appears in collections
- Similar / adjacent watches
- Wear context

**Actions:** Add to Collection, Add to Wishlist, View owners

### 5.6 Add (Watch)

**Flow:**
1. Search / paste / manual entry
2. Set status: owned / wishlist / sold
3. Optional metadata: role, notes, price / target
4. (Owned only) prompt for wrist photo

**Output:** creates CollectionEntry, logs Activity, updates recommendation graph

### 5.7 Wear (WYWT)

Log what user is wearing — daily habit + data layer.

**Constraints:** must select owned watch first, one wear event per watch per day

**Entry Points:** nav (primary), home WYWT rail, watch detail, collection card, profile worn tab

**Flow:**
1. Select owned watch
2. Optional: wrist photo, note, visibility
3. Save

**Output:** creates WearEvent, updates home WYWT rail, profile worn history, watch context, insights

**WYWT Interaction:** Tap wear item → Wear Detail Overlay (image-first, primary CTA: View Watch, collector + collection context, no social engagement features)

### 5.8 Search

Universal lookup + discovery entry. Results grouped by: Watches, Collectors, Collections.

### 5.9 Notifications

Surface relevant activity: new followers, relevant watch activity, wishlist signals, recommendation triggers.

### 5.10 Settings

**Sections:** privacy (profile + wear visibility), notifications, defaults (visibility, preferences), account

## 6. Data Strategy

| Phase | Approach |
|-------|----------|
| Phase 1 | User-generated watch entries, loose normalization |
| Phase 2 | Clustering → canonical watches |
| Phase 3 | Enrich via usage + images |

## 7. Recommendation Strategy (Initial)

- Collection overlap
- Brand overlap
- Role/style similarity
- Co-occurrence patterns

## 8. Image Strategy

**Priority:** user wrist shots > user uploaded images > community images > product images (fallback)

**Images propagate:** watch pages, collections, WYWT, explore

## 9. Navigation Model

**Mobile:** Home, Explore, Wear (primary), Add, Profile

**Desktop:** Logo (home), Explore, Search (persistent), Wear (primary action), Add (+), Notifications, Profile menu

## 10. Non-Goals

- No marketplace (initially)
- No social feed
- No heavy posting system
- No engagement mechanics (likes/comments)
- No full canonical watch DB upfront

## 11. Success Criteria (Early)

- Users add ≥3 watches
- Users log wear events
- Users follow ≥3 collectors
- Watch detail views per session increase
- Wishlist growth

---
*This document defines the full product vision. Individual milestones scope subsets of this vision.*
