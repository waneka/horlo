@AGENTS.md

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Horlo**

A taste-aware watch collection intelligence system for personal collectors. Users manage their collection and wishlist, understand how their watches relate to each other, and make more intentional buying decisions. The core insight engine evaluates any watch against the user's collection and preferences to produce a semantic label (Core Fit, Role Duplicate, Hard Mismatch, etc.) rather than a raw score.

**Core Value:** A collector can evaluate any watch against their collection and get a meaningful, preference-aware answer about whether it adds something or just duplicates what they already own.

### Constraints

- **Tech stack**: Next.js 16 App Router — continue with existing framework, no rewrites
- **Data model**: Watch and UserPreferences types are established — extend, don't break existing structure
- **Personal first**: Single-user experience and data isolation must remain correct even after multi-user auth is added
- **Performance**: Target <500 watches per user; no need for complex pagination or infinite scroll in MVP
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Summary
## Languages
- TypeScript 5 (`^5`) — all source files in `src/`
- CSS — global styles in `src/app/globals.css`
## Runtime
- Node.js (version not pinned; `.nvmrc` not present)
- npm
- Lockfile: `package-lock.json` present (lockfileVersion 3)
## Frameworks
- Next.js 16.2.3 — full-stack React framework; App Router used exclusively (no `pages/` directory)
- React 19.2.4 — UI rendering
- React DOM 19.2.4 — DOM bindings
- TypeScript compiler via Next.js — `tsconfig.json` targets ES2017, `moduleResolution: bundler`
- Tailwind CSS 4 (`^4`) — utility-first CSS, configured via PostCSS (`postcss.config.mjs`)
- `@tailwindcss/postcss` (`^4`) — PostCSS integration for Tailwind 4
- ESLint 9 (`^9`) with `eslint-config-next` 16.2.3 — linting (`eslint.config.mjs`)
## Key Dependencies
- `@anthropic-ai/sdk` `^0.88.0` — Anthropic Claude API client; used in `src/lib/extractors/llm.ts` to call `claude-sonnet-4-20250514`
- `zustand` `^5.0.12` — client-side state management with `persist` middleware; stores in `src/store/watchStore.ts` and `src/store/preferencesStore.ts`
- `cheerio` `^1.2.0` — server-side HTML parsing for watch data extraction in `src/lib/extractors/llm.ts` and `src/lib/extractors/html.ts`
- `@base-ui/react` `^1.3.0` — headless UI primitives
- `shadcn` `^4.2.0` — component library scaffolding; CSS imported via `shadcn/tailwind.css` in `src/app/globals.css`
- `lucide-react` `^1.8.0` — icon set
- `class-variance-authority` `^0.7.1` — variant-based class composition
- `clsx` `^2.1.1` — conditional class name utility
- `tailwind-merge` `^3.5.0` — Tailwind class conflict resolution
- `tw-animate-css` `^1.4.0` — animation utilities imported in `src/app/globals.css`
- `next/font/google` — Geist and Geist Mono loaded in `src/app/layout.tsx`
## Configuration
- Config: `tsconfig.json`
- Path alias: `@/*` maps to `./src/*`
- Strict mode enabled
- JSX: `react-jsx`
- Config: `next.config.ts` (minimal — no custom options set)
- App Router only; no `pages/` directory
- Config: `postcss.config.mjs`
- Config: `eslint.config.mjs`
- `.env.example` present (documents `ANTHROPIC_API_KEY`)
- `.env.local` present (not read; contains secrets)
## Platform Requirements
- `npm run dev` — starts Next.js dev server
- `npm run lint` — runs ESLint
- `npm run build` then `npm run start`
- Deployment target not explicitly configured; compatible with any Node.js host or Vercel (default Next.js target)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Summary
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
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Summary
## System Overview
```
```
## Data Flow
### Watch Import (URL → Collection)
### Collection Browsing
- `useWatchStore().getFilteredWatches()` applies status, style, role, and dial-color filters client-side
- Filters are stored in the Zustand store (not persisted to localStorage)
### Similarity Analysis
- `analyzeSimilarity(targetWatch, collection, preferences)` in `src/lib/similarity.ts` runs entirely in the browser
- Weighted scoring across 8 dimensions with tolerance-adjusted thresholds
- Produces a `SimilarityResult` with a `SimilarityLabel` and list of top matches
## Architectural Patterns
- Zustand + `persist` middleware; no server-side session or database
- All business logic (filtering, similarity, preferences) is client-side
- Graceful degradation: structured data → regex/selector → LLM
- LLM stage is optional; gated on `ANTHROPIC_API_KEY` presence
- Stages merge results; earlier stages take precedence over later ones
- The API route proxies external watch page fetches server-side to avoid CORS and to keep the Anthropic API key off the client
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
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

## Local-First Development

Verify in `npm run dev` against local Supabase **before** pushing to prod.

`npm run build` and `vitest` are not sufficient runtime gates. DAL test mocks don't execute SQL and the build doesn't run queries — a Drizzle `sql\`= ANY(${arr})\`` template once passed both gates and crashed prod home on first deploy (digest `2193629549`).

For any change that touches runtime behavior (DAL, Server Actions, Server Components, API routes, UI):

1. Make the change.
2. Run it in `npm run dev` against local Supabase. The local DB is seeded with realistic data — 4 test users (`viewer@horlo.test`, `vintage-anna@horlo.test`, `modern-mike@horlo.test`, `dress-dan@horlo.test`, all password `password123`) plus ~205 catalog rows. Re-seed via `supabase/seed.sql` + `scripts/import-prod-catalog.sh` if needed. Sign in as a seeded user and exercise the actual code path you changed.
3. Then commit and push.

Local env setup: `.env.development.local` (gitignored) overrides `.env.local` for `npm run dev` only — points `DATABASE_URL` + `NEXT_PUBLIC_SUPABASE_*` at `127.0.0.1:54321`/`54322`. `next build` still uses `.env.local` (prod) so SSG works.

Exceptions:
- Pure documentation / planning-artifact changes — no runtime risk.
- Mobile-Safari behavior — still verified on prod (pointing a real mobile browser at localhost is painful; see `feedback_mobile_ui_verify_on_prod.md` for the existing pattern).
- Explicit user request to skip local verification (e.g., incident recovery where reverting and re-deploying is the right move).

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
