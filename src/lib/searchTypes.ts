// Type contracts for Phase 16 People Search.
// Pure type-only module — no runtime cost; importable from server, client, and tests.
//
// SearchProfileResult is the row payload returned by `searchProfiles` DAL (D-19)
// and consumed by `<PeopleSearchRow>`. Mirrors SuggestedCollector with two
// additions: `bio`/`bioSnippet` (the bio-search match surface, D-13/D-14) and
// `isFollowing` (per-row state for the inline FollowButton, D-19 + Pitfall C-4).

export interface SearchProfileResult {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  bio: string | null
  bioSnippet: string | null
  overlap: number  // 0..1, derived from computeTasteOverlap bucket (D-16)
  sharedCount: number
  sharedWatches: Array<{
    watchId: string
    brand: string
    model: string
    imageUrl: string | null
  }>
  isFollowing: boolean
}

// Tab discriminant for the /search 4-tab control (D-05 default, D-12 URL sync).
// Default tab = 'all'; 'all' is OMITTED from the URL when active.
export type SearchTab = 'all' | 'people' | 'watches' | 'collections'

// Phase 19 Watches Search (SRCH-09 + SRCH-10).
// `viewerState` is hydrated by the DAL via a single inArray(watches.catalogId, topIds)
// batch query keyed by viewerId — never per-row (D-05 / SRCH-10 anti-N+1).
// 'owned' wins over 'wishlist' when both are present for the same catalogId.
export interface SearchCatalogWatchResult {
  catalogId: string
  brand: string
  model: string
  reference: string | null
  imageUrl: string | null
  ownersCount: number
  wishlistCount: number
  viewerState: 'owned' | 'wishlist' | null
}

// Phase 19 Collections Search (SRCH-11 + SRCH-12 + D-11 + D-16).
// `matchCount` is the total number of the collector's watches matching q
// (each matched watch contributes 1 — name match + tag match on the same row
// counts once, classified as 'name'). `tasteOverlap` is the bucketed overlap
// from computeTasteOverlap (0..1; D-16 secondary sort).
export interface SearchCollectionResult {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  matchCount: number
  tasteOverlap: number
  matchedWatches: Array<{
    watchId: string
    brand: string
    model: string
    imageUrl: string | null
    matchPath: 'name' | 'tag'
  }>
  matchedTags: string[]
}
