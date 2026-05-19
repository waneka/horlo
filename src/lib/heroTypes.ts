// HeroFeature discriminated union — forward-compatible shape for SEED-008.
//
// Phase 47 wires `featured_list` only.
// `featured_collector` variant reserved for SEED-008 (v5.1 Explore Redesign).
// The union MUST NOT be collapsed to a single variant — SEED-008 requires both.
//
// D-10: HeroModule builds a HeroFeature value before rendering so callers can
// switch on `format` and TypeScript narrows the correct variant.

export type CuratedListHero = {
  id: string
  title: string
  curatorName: string
  coverUrl: string | null
  introMarkdown: string | null
  publishedAt: Date | null
  sortOrder: number
  status: string
  createdAt: Date
  updatedAt: Date
  // item count pre-fetched during quality-gate evaluation
  itemCount: number
}

export type HeroFeature =
  | { format: 'featured_list'; list: CuratedListHero }
  | { format: 'featured_collector' } // SEED-008 future shape
