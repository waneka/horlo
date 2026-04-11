---
focus: tech
generated: 2026-04-11
---
# External Integrations

## Summary
Horlo integrates with the Anthropic Claude API as its only external service, used as an optional LLM fallback for extracting watch specifications from product page HTML. All other data is stored locally in the browser via Zustand's persist middleware (localStorage).

## APIs & External Services

**AI / LLM:**
- Anthropic Claude API — powers LLM-based watch data extraction when structured/HTML parsing is insufficient
  - SDK: `@anthropic-ai/sdk` `^0.88.0`
  - Client instantiation: `src/lib/extractors/llm.ts` (`new Anthropic({ apiKey })`)
  - Model used: `claude-sonnet-4-20250514`
  - Auth env var: `ANTHROPIC_API_KEY`
  - Optional: the API route at `src/app/api/extract-watch/route.ts` checks `!!process.env.ANTHROPIC_API_KEY` and only enables LLM fallback when the key is present

**Web Scraping (outbound HTTP):**
- Arbitrary watch retailer/product URLs — fetched server-side in `src/lib/extractors/index.ts` (`fetchAndExtract`) using the built-in `fetch` API with a `User-Agent: WatchCollectionBot/1.0` header
  - No third-party scraping service; raw HTTP fetch only

## Data Storage

**Databases:**
- None — no database is used

**Client-Side Persistence:**
- Browser localStorage via Zustand `persist` middleware
  - Watch collection: key `watch-collection` — managed in `src/store/watchStore.ts`
  - User preferences: key `user-preferences` — managed in `src/store/preferencesStore.ts`
  - Data is entirely local; no sync or backend persistence

**File Storage:**
- Local filesystem only (no cloud storage service)

**Caching:**
- None

## Authentication & Identity

**Auth Provider:**
- None — no user authentication exists; the app is single-user, local-only

## Monitoring & Observability

**Error Tracking:**
- None

**Logs:**
- `console.error` used in `src/app/api/extract-watch/route.ts` and `src/lib/extractors/index.ts` for extraction failures

## CI/CD & Deployment

**Hosting:**
- Not configured; no deployment config files present (no `vercel.json`, `Dockerfile`, etc.)

**CI Pipeline:**
- None detected

## Environment Configuration

**Required env vars:**
- `ANTHROPIC_API_KEY` — Anthropic API key for LLM extraction (optional; app degrades gracefully without it)

**Secrets location:**
- `.env.local` (present, not committed; `.env.example` documents expected variables)

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Internal API Surface

**API Routes (Next.js App Router):**
- `POST /api/extract-watch` — accepts `{ url: string }`, fetches the URL server-side, runs structured + HTML + optional LLM extraction, returns `ExtractionResult`; implemented in `src/app/api/extract-watch/route.ts`
