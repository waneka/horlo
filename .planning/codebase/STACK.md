---
focus: tech
generated: 2026-04-11
---
# Technology Stack

## Summary
Horlo is a Next.js 16 application written in TypeScript 5, using React 19 for the UI, Tailwind CSS 4 for styling, and Zustand for client-side state management. It runs as a full-stack app with both frontend components and a server-side API route.

## Languages

**Primary:**
- TypeScript 5 (`^5`) — all source files in `src/`

**Secondary:**
- CSS — global styles in `src/app/globals.css`

## Runtime

**Environment:**
- Node.js (version not pinned; `.nvmrc` not present)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present (lockfileVersion 3)

## Frameworks

**Core:**
- Next.js 16.2.3 — full-stack React framework; App Router used exclusively (no `pages/` directory)
- React 19.2.4 — UI rendering
- React DOM 19.2.4 — DOM bindings

**Build/Dev:**
- TypeScript compiler via Next.js — `tsconfig.json` targets ES2017, `moduleResolution: bundler`
- Tailwind CSS 4 (`^4`) — utility-first CSS, configured via PostCSS (`postcss.config.mjs`)
- `@tailwindcss/postcss` (`^4`) — PostCSS integration for Tailwind 4
- ESLint 9 (`^9`) with `eslint-config-next` 16.2.3 — linting (`eslint.config.mjs`)

## Key Dependencies

**Critical:**
- `@anthropic-ai/sdk` `^0.88.0` — Anthropic Claude API client; used in `src/lib/extractors/llm.ts` to call `claude-sonnet-4-20250514`
- `zustand` `^5.0.12` — client-side state management with `persist` middleware; stores in `src/store/watchStore.ts` and `src/store/preferencesStore.ts`
- `cheerio` `^1.2.0` — server-side HTML parsing for watch data extraction in `src/lib/extractors/llm.ts` and `src/lib/extractors/html.ts`

**UI:**
- `@base-ui/react` `^1.3.0` — headless UI primitives
- `shadcn` `^4.2.0` — component library scaffolding; CSS imported via `shadcn/tailwind.css` in `src/app/globals.css`
- `lucide-react` `^1.8.0` — icon set
- `class-variance-authority` `^0.7.1` — variant-based class composition
- `clsx` `^2.1.1` — conditional class name utility
- `tailwind-merge` `^3.5.0` — Tailwind class conflict resolution
- `tw-animate-css` `^1.4.0` — animation utilities imported in `src/app/globals.css`

**Fonts:**
- `next/font/google` — Geist and Geist Mono loaded in `src/app/layout.tsx`

## Configuration

**TypeScript:**
- Config: `tsconfig.json`
- Path alias: `@/*` maps to `./src/*`
- Strict mode enabled
- JSX: `react-jsx`

**Next.js:**
- Config: `next.config.ts` (minimal — no custom options set)
- App Router only; no `pages/` directory

**PostCSS:**
- Config: `postcss.config.mjs`

**ESLint:**
- Config: `eslint.config.mjs`

**Environment:**
- `.env.example` present (documents `ANTHROPIC_API_KEY`)
- `.env.local` present (not read; contains secrets)

## Platform Requirements

**Development:**
- `npm run dev` — starts Next.js dev server
- `npm run lint` — runs ESLint

**Production:**
- `npm run build` then `npm run start`
- Deployment target not explicitly configured; compatible with any Node.js host or Vercel (default Next.js target)
