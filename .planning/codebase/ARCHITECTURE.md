---
focus: arch
generated: 2026-04-11
---
# Architecture

## Summary
Horlo is a single-user, client-first watch collection app built on Next.js 16 App Router. All persistent state lives in browser localStorage via Zustand; the only server-side component is the `POST /api/extract-watch` route which orchestrates a three-stage watch data extraction pipeline.

## System Overview

```
Browser
  ├── Zustand watchStore (localStorage: "watch-collection")
  ├── Zustand preferencesStore (localStorage: "user-preferences")
  └── React UI (App Router pages)
        │
        └── POST /api/extract-watch  ← Next.js Route Handler
                │
                ├── Stage 1: extractStructuredData() — JSON-LD / microdata parsing
                ├── Stage 2: extractFromHtml()        — Cheerio CSS-selector scraping
                └── Stage 3: extractWithLlm()         — Anthropic claude-sonnet-4 (optional)
```

## Data Flow

### Watch Import (URL → Collection)
1. User pastes a URL into `UrlImport.tsx`
2. `POST /api/extract-watch` is called with `{ url }`
3. Server fetches the URL with a custom `User-Agent` header
4. Extraction pipeline runs (structured → HTML → LLM if needed)
5. `ExtractionResult` returned to browser
6. User reviews/edits in `WatchForm.tsx`, then saves via `watchStore.addWatch()`

### Collection Browsing
- `useWatchStore().getFilteredWatches()` applies status, style, role, and dial-color filters client-side
- Filters are stored in the Zustand store (not persisted to localStorage)

### Similarity Analysis
- `analyzeSimilarity(targetWatch, collection, preferences)` in `src/lib/similarity.ts` runs entirely in the browser
- Weighted scoring across 8 dimensions with tolerance-adjusted thresholds
- Produces a `SimilarityResult` with a `SimilarityLabel` and list of top matches

## Architectural Patterns

**Client-First State Management**
- Zustand + `persist` middleware; no server-side session or database
- All business logic (filtering, similarity, preferences) is client-side

**Three-Stage Extraction Pipeline**
- Graceful degradation: structured data → regex/selector → LLM
- LLM stage is optional; gated on `ANTHROPIC_API_KEY` presence
- Stages merge results; earlier stages take precedence over later ones

**Server-Side Proxy**
- The API route proxies external watch page fetches server-side to avoid CORS and to keep the Anthropic API key off the client

**Feature-Based Component Organization**
- Components are grouped by domain (`watch/`, `filters/`, `insights/`, `layout/`) under `src/components/`
- Shadcn/base-ui primitives live in `src/components/ui/`

## Key Files

| File | Role |
|------|------|
| `src/lib/types.ts` | Central type definitions for `Watch`, `UserPreferences`, `SimilarityResult` |
| `src/lib/similarity.ts` | Full similarity scoring engine |
| `src/lib/extractors/index.ts` | Extraction pipeline orchestrator |
| `src/store/watchStore.ts` | Watch collection CRUD + filtering state |
| `src/store/preferencesStore.ts` | User preference state |
| `src/app/api/extract-watch/route.ts` | Only server-side API route |
