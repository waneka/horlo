---
focus: concerns
generated: 2026-04-11
---
# Codebase Concerns

## Summary
MVP-quality codebase with good bones but several HIGH-severity issues: an unauthenticated open proxy with SSRF exposure, two preference fields that are captured in the UI but silently ignored by the engine, and all user data stored only in localStorage with no export/backup mechanism.

## Security Concerns

**[HIGH] SSRF via unauthenticated open proxy**
- `POST /api/extract-watch` accepts any `http/https` URL, fetches it server-side, and returns the content
- No authentication or rate limiting on this route
- No blocklist for internal/link-local addresses (127.x, 10.x, 192.168.x, 169.254.x, ::1)
- An attacker can use this endpoint to probe internal network resources from the server
- File: `src/app/api/extract-watch/route.ts`

**[HIGH] Unvalidated image URLs rendered as `<img src>`**
- `watch.imageUrl` is rendered directly without using `next/image` or a domain allowlist
- Enables tracking pixels and content from arbitrary origins
- File: `src/components/watch/WatchCard.tsx`, `WatchDetail.tsx`

**[LOW] No Content-Security-Policy headers**
- No CSP or security headers configured in `next.config.ts`

## Broken Product Features

**[HIGH] `complicationExceptions` preference is dead code**
- `UserPreferences.complicationExceptions` is stored in `preferencesStore` and shown in the preferences UI
- The field is never consulted in `src/lib/similarity.ts` — the "always allow this complication" intent has zero effect
- Files: `src/lib/types.ts`, `src/lib/similarity.ts`, `src/store/preferencesStore.ts`

**[HIGH] `collectionGoal` preference is dead code**
- `UserPreferences.collectionGoal` is stored and displayed in preferences UI
- Never used in similarity scoring or any other computation
- Files: `src/lib/types.ts`, `src/lib/similarity.ts`

## Data Safety

**[HIGH] No data export or backup**
- All watch data and preferences are in `localStorage` only
- Browser clearing, storage eviction, or switching devices permanently destroys the collection
- No export-to-JSON, import, or sync mechanism exists

**[MED] No localStorage schema migration**
- If a new required field is added to the `Watch` type, old rehydrated records will silently have `undefined` for that field
- No version field or migration logic in either Zustand store

## Technical Debt

**[MED] Duplicate utility code**
- `daysSince`, `formatCurrency`, and `statusColors` appear to be duplicated across multiple files
- Should be consolidated in `src/lib/utils.ts`

**[MED] Dead fields on `ExtractedWatchData`**
- `roleTags`, `pricePaid`, and `notes` are defined on `ExtractedWatchData` in `src/lib/extractors/types.ts` but never populated by any extractor stage
- Creates a misleading API surface

**[LOW] No error boundaries**
- No React error boundaries anywhere in the component tree
- A single malformed localStorage record (e.g., missing required field) could crash the entire app

## Missing Pieces

- **Tests** — zero test coverage; pure functions in `similarity.ts` and the extractor pipeline are obvious candidates
- **CI/CD** — no pipeline, no automated lint/build checks on push
- **Authentication** — single-user app but no protection; the API route is publicly accessible
- **Export/Import** — no way to back up or migrate the collection

## Inconsistencies

- `filters` in `watchStore` are not persisted to localStorage (intentional?), but preferences in `preferencesStore` are — there is no comment explaining the distinction
- `useLlmFallback` defaults to `true` in `extractWatchData()` but in the API route it's gated on `ANTHROPIC_API_KEY`, so direct library use would attempt LLM without a key and throw
