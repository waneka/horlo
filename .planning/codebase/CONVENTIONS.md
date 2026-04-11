---
focus: quality
generated: 2026-04-11
---
# Code Conventions

## Summary
The codebase follows standard Next.js + TypeScript conventions: PascalCase React components, camelCase variables/functions, kebab-case file names for non-component files, and absolute imports via the `@/*` alias. No explicit style guide document exists, but patterns are consistent throughout.

## Naming

| Construct | Convention | Example |
|-----------|-----------|---------|
| React components | PascalCase | `WatchCard`, `FilterBar`, `UrlImport` |
| Component files | PascalCase.tsx | `WatchCard.tsx`, `StatusToggle.tsx` |
| Non-component files | camelCase.ts | `similarity.ts`, `watchStore.ts`, `constants.ts` |
| Types / interfaces | PascalCase | `Watch`, `UserPreferences`, `SimilarityResult` |
| Type aliases | PascalCase | `WatchStatus`, `MovementType`, `SimilarityLabel` |
| Zustand stores | `use<Name>Store` | `useWatchStore`, `usePreferencesStore` |
| Functions | camelCase | `analyzeSimilarity`, `fetchAndExtract`, `generateId` |
| Constants | UPPER_SNAKE_CASE | `WEIGHTS`, `THRESHOLDS` |
| Route segments | kebab-case dirs | `extract-watch/`, `[id]/edit/` |

## Imports

- Absolute imports via `@/*` (maps to `src/`) used throughout — no relative `../../` traversals
- Type-only imports use `import type { ... }` syntax consistently
- No barrel files (no `index.ts` re-exports from component folders); components imported directly

## React Patterns

- `'use client'` directive on pages and components that use Zustand hooks (client-side state)
- Server Components used by default where no client state is needed (layout.tsx)
- `export default function` for page components; named exports for shared components
- No class components; all functional

## TypeScript

- Strict mode enabled (`tsconfig.json`)
- All domain types defined centrally in `src/lib/types.ts`
- Extractor types isolated in `src/lib/extractors/types.ts`
- Discriminated unions used for `SimilarityLabel` and `WatchStatus`
- `Partial<Watch>` used for updates; `Omit<Watch, 'id'>` for new watch input

## State Management

- Zustand stores accessed via `useWatchStore()` / `usePreferencesStore()` hooks
- Store actions (not raw setters) used for mutations — `addWatch`, `updateWatch`, `deleteWatch`
- `getFilteredWatches()` is a derived selector computed inside the store

## Styling

- Tailwind CSS 4 utility classes inline in JSX — no CSS modules, no styled-components
- `cn()` helper (`src/lib/utils.ts`) used for conditional class composition
- Shadcn component primitives in `src/components/ui/`; not customized beyond slot composition

## API Route Conventions

- Only one route handler exists (`POST /api/extract-watch`)
- Input validated with early returns and `NextResponse.json(..., { status: 4xx })`
- Errors caught with try/catch; `console.error` for unexpected failures
- URL validation before outbound fetch (protocol allow-list: http/https only)

## Comments

- Inline comments used sparingly for non-obvious logic (similarity scoring weights, extraction stages)
- No JSDoc / TSDoc annotations present
- TODO/FIXME comments: none found
