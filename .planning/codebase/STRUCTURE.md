---
focus: arch
generated: 2026-04-11
---
# Directory Structure

## Summary
Next.js 16 App Router layout with `src/` root. Source is cleanly divided into `app/` (routes), `components/` (UI by domain), `lib/` (business logic), and `store/` (Zustand state).

## Top-Level Layout

```
horlo/
├── src/
│   ├── app/                    # Next.js App Router pages and layouts
│   ├── components/             # React components, grouped by domain
│   ├── lib/                    # Business logic, utilities, extractors
│   └── store/                  # Zustand state stores
├── .planning/                  # GSD planning artifacts (not shipped)
├── .next/                      # Build output (gitignored)
├── public/                     # Static assets
├── eslint.config.mjs
├── next.config.ts
├── postcss.config.mjs
├── tsconfig.json
└── package.json
```

## App Router Pages (`src/app/`)

```
src/app/
├── layout.tsx                  # Root layout — Geist fonts, Header, body wrapper
├── page.tsx                    # / — Collection grid with sidebar filters
├── globals.css                 # Global CSS; imports shadcn + tw-animate-css
├── favicon.ico
├── api/
│   └── extract-watch/
│       └── route.ts            # POST /api/extract-watch
├── insights/
│   └── page.tsx                # /insights — Balance charts and similarity badges
├── preferences/
│   └── page.tsx                # /preferences — User preference editor
└── watch/
    ├── new/
    │   └── page.tsx            # /watch/new — Add watch (URL import or manual)
    └── [id]/
        ├── page.tsx            # /watch/[id] — Watch detail view
        └── edit/
            └── page.tsx        # /watch/[id]/edit — Edit watch
```

## Components (`src/components/`)

```
src/components/
├── filters/
│   ├── FilterBar.tsx           # Multi-dimension sidebar filter panel
│   └── StatusToggle.tsx        # owned/wishlist/sold/grail status switcher
├── insights/
│   ├── BalanceChart.tsx        # Collection balance visualization
│   └── SimilarityBadge.tsx     # Similarity label display
├── layout/
│   └── Header.tsx              # Global navigation header
├── ui/                         # Shadcn/base-ui primitive components
│   ├── badge.tsx
│   ├── button.tsx
│   ├── card.tsx
│   ├── checkbox.tsx
│   ├── dialog.tsx
│   ├── input.tsx
│   ├── label.tsx
│   ├── select.tsx
│   ├── tabs.tsx
│   └── textarea.tsx
└── watch/
    ├── UrlImport.tsx           # URL paste + extraction trigger
    ├── WatchCard.tsx           # Card in collection grid
    ├── WatchDetail.tsx         # Full watch detail display
    ├── WatchForm.tsx           # Add/edit form with all Watch fields
    └── WatchGrid.tsx           # Responsive grid of WatchCards
```

## Library (`src/lib/`)

```
src/lib/
├── types.ts                    # All shared TypeScript types
├── constants.ts                # App-wide constants (style tags, roles, etc.)
├── similarity.ts               # Weighted similarity scoring engine
├── utils.ts                    # cn() and other small helpers
└── extractors/
    ├── index.ts                # Pipeline orchestrator (fetchAndExtract, extractWatchData)
    ├── types.ts                # ExtractedWatchData, ExtractionResult types
    ├── structured.ts           # Stage 1: JSON-LD / microdata extraction
    ├── html.ts                 # Stage 2: Cheerio CSS-selector extraction
    └── llm.ts                  # Stage 3: Anthropic Claude extraction
```

## State (`src/store/`)

```
src/store/
├── watchStore.ts               # Watch CRUD, filters, localStorage key: "watch-collection"
└── preferencesStore.ts         # UserPreferences, localStorage key: "user-preferences"
```
