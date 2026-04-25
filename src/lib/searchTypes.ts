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
