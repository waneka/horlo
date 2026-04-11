---
generated: 2026-04-11
---
# Research Summary

## TL;DR

- **Security first, then cloud.** The SSRF on `/api/extract-watch` and the raw `<img src>` on watch cards are active vulnerabilities — fix them before (or alongside) the visual milestone, not after auth. Auth alone does not close SSRF; hostname-string blocklists are trivially bypassable and must validate resolved IPs.
- **Bundle auth + DB with Supabase.** Supabase Auth + Supabase Postgres + Drizzle is the smallest-surface choice for a personal-use app that already needs a database. Row-level security handles per-user isolation at the database layer. Neon + Better Auth is the swap-out path if vendor lock-in becomes a concern later.
- **DAL + Server Actions, not API routes.** Next.js 16's canonical pattern for new multi-user apps is a server-only Data Access Layer called directly from Server Components for reads, with thin Server Actions for writes. Zustand narrows to ephemeral UI state (filter selections); it is no longer the source of truth for collection or preferences.
- **The two feature fixes are high-leverage, low-cost.** Wiring `complicationExceptions` and `collectionGoal` into `similarity.ts` eliminates dead code, makes the scoring engine respect stored preferences, and unblocks preference-aware gap analysis. Ship these before the auth migration so the data model is stable when it moves to the DB.
- **Migration is export/import, not dual-write.** `crypto.randomUUID()` must replace `Date.now()`-based IDs before any batch insert. A one-time "Import your local collection" banner on first sign-in is the only safe cutover strategy; never auto-delete localStorage, never dual-write.

---

## Recommended Stack

| Concern | Choice | Why |
|---------|--------|-----|
| Dark mode | `next-themes` + `@custom-variant dark (&:where(.dark, .dark *))` in `globals.css` | Tailwind 4 removed `darkMode: 'class'`; `@custom-variant` is the v4 API. `next-themes` handles FOUC and three-state (light/dark/system) correctly. |
| Auth | **Supabase Auth** via `@supabase/ssr` | First-class App Router support, bundles with the DB, RLS handles per-user isolation. Avoids vendor lock-in of Clerk and the declining Auth.js path. |
| Database | **Supabase Postgres** (falls back to Neon if swapping auth) | Single free tier covers auth + DB for a personal app. Neon has faster cold starts (~500ms vs 10–30s) if cold-start latency becomes a problem. |
| ORM | **Drizzle** | ~7.4 KB vs Prisma's ~1.6 MB; code-first TypeScript schema; the default in new t3 projects; sufficient migration tooling for <500 rows per user. |
| Test runner | **Vitest** (not Jest) | Officially documented in `node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`. Native ESM, 4–5x faster than Jest, Jest-compatible API. |
| Component tests | `@testing-library/react` + `@testing-library/user-event` | Standard; no alternative. |
| Network mocks | **MSW** | Intercepts at the network layer so app code is unchanged between test and prod. |

**Install line:**
```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom @testing-library/user-event vite-tsconfig-paths msw
```

**Confidence:** HIGH on dark mode, DB, and testing. MEDIUM on Supabase Auth recommendation — verify cold-start behavior on the free tier before committing if production latency matters.

---

## Feature Categories

### Table Stakes (required for the app to feel complete)
- Collection CRUD, status model, filters, detail view, wear logging — **all already built.**
- **Mobile-responsive layout** (active) and **dark mode** (active) are table-stakes gaps the visual milestone closes.
- **Cross-device persistence** and **per-user isolation** are table stakes the auth + cloud milestone closes.
- **"Last worn X days ago" surfaced in detail view** — built but not surfaced; trivial UI addition.

### Differentiators (Horlo's unique positioning)
- **Taste-aware scoring engine** (already built) — no competitor scores against explicit user preferences.
- **Wire up `complicationExceptions` + `collectionGoal`** (low effort) — these are stored and displayed but ignored by the engine; fixing them turns dead data into an actual opinion.
- **Wishlist intelligence**: target price field, "good deal" flag, and gap-fill score reusing the similarity engine on wishlist items vs owned — no competitor does preference-aware wishlist ranking.
- **"Sleeping Beauties" neglect framing** (from Klokker) — surface `daysSinceWorn` with collector-friendly language rather than a dry stat.
- **Preference-aware gap analysis** — "you own 4 dress watches, 0 field, but stated preference includes field" — only possible because Horlo stores explicit preferences.
- **Collection balance visualization** — donut/bar chart on existing balance data; Recharts or Nivo.

### Anti-features (explicitly do not build this cycle)
- Automated price tracking / market API integrations — adds ToS-hostile scraping or paid API infra; out of scope per PROJECT.md.
- Price alert push notifications — requires the above + notification infrastructure.
- Social / public collections, community forums, sharing — out of scope, dilutes personal-first positioning.
- AI "best next watch" recommendation — small per-user data produces mediocre output; existing gap analysis is sufficient.
- Barcode / case-back scanning — URL import is the correct import path for mechanical watches.
- Cost-per-wear — deferred; requires adding `purchasePrice` and `wearCount` to the Watch type. Good candidate for the post-auth milestone.
- Rotation profile labels ("The Faithful" etc.) — needs weeks of wear history to be meaningful; defer until data persists across sessions.

---

## Critical Architecture Decisions

1. **DAL in `src/data/`, server-only.** Every file marked `import 'server-only'`. `getCurrentUser()` wrapped in React's `cache()` so it runs once per request. Every DAL function checks auth and scopes queries to `userId` before returning DTOs (not raw rows).

2. **Server Actions in `src/app/actions/` are thin.** They delegate to DAL functions and handle `revalidatePath()` / `revalidateTag()` on mutation. No business logic in actions. No new API routes for CRUD — Server Actions cover watch and preference mutations.

3. **`/api/extract-watch` stays a Route Handler.** It is an external-URL proxy, which is the correct use of Route Handlers per official Next.js guidance. But it must gain auth + IP validation + redirect-chain validation.

4. **Middleware is NOT a security gate.** Next.js 16 renamed `middleware.ts` -> `proxy.ts` (run the codemod: `npx @next/codemod@canary middleware-to-proxy`). CVE-2025-29927 demonstrated middleware bypass. Every Server Action and every DAL function must re-verify session independently.

5. **Zustand narrows dramatically.** After migration: `watchStore` keeps only filter state (selectedStatus, activeStyleTags, etc.), drops `persist` and CRUD methods. `preferencesStore` is removed or reduced to a read-only cache for client components. Server is the source of truth.

6. **Similarity engine stays client-side.** It is a pure scoring function with no I/O, it runs on data already resident in the browser, and a server round-trip would add latency with zero benefit. Only the call site changes (props from Server Component parent instead of `useWatchStore()`).

7. **Session strategy: stateless JWT in HttpOnly cookie.** Sufficient for <500 records per user. If using Auth.js v5 with a DB adapter, use the split-config pattern (`auth.config.ts` edge-safe without adapter, `auth.ts` Node-only with adapter).

---

## Top Pitfalls to Avoid

1. **SSRF "fix" via hostname string matching is bypassed.** Decimal/hex/octal IP notation, IPv6-mapped addresses, and DNS rebinding all defeat a naive `hostname === 'localhost'` check. Must resolve hostname -> IP, validate against RFC 1918/5735 ranges, pin the resolved IP for the actual request, and validate every redirect hop with `redirect: 'manual'`. Use `ssrf-req-filter` or equivalent.

2. **Raw `<img src={watch.imageUrl}>` is a separate injection vector.** Tracking pixels, credentialed CSRF, arbitrary content from untrusted origins. Replace with `next/image` + `remotePatterns` domain allowlist in `next.config.ts`. Treat as a security fix in the visual milestone.

3. **`middleware.ts` is silently ignored in Next.js 16.** The file was renamed to `proxy.ts` and the exported function to `proxy`. Old filename = no protection, no error, no log. Run the Vercel codemod and verify execution with a log before trusting it.

4. **Watch IDs generated with `Date.now()` will collide on batch import.** Switch to `crypto.randomUUID()` before the migration. During the import script, regenerate any non-UUID IDs.

5. **Split-brain collection at cutover.** Dual-write to localStorage + cloud leaves divergent state on network failure. Correct pattern: self-service import flow, never auto-delete localStorage, keep localStorage-read fallback for 30-60 days, prompt to import on first login.

6. **Per-user isolation must be enforced at query time, not inferred from session.** Every DAL query scoped as `WHERE id = ? AND userId = auth().user.id`. Never trust client-supplied IDs as authorization. A naive `deleteWatch(id)` that skips the ownership check is a trivial IDOR.

7. **Flash of wrong theme on SSR page load.** The server cannot know the user's preference. Inject a blocking inline `<script>` in `<head>` that reads localStorage and sets `.dark` before first paint. `useEffect` runs after paint — too late. Use `suppressHydrationWarning` on `<html>`. `next-themes` handles this correctly out of the box.

8. **Async Server Components cannot be unit-tested with Vitest + RTL.** Test the data-fetching functions and rendering logic separately as pure functions. Use Playwright for integrated RSC output. The similarity engine, extractor pipeline, and store reducers are already pure — test those directly.

---

## Build Order Implications

The architectural research gives a clean linear dependency chain. The feature and security work should interleave with it as follows:

```
Phase 1 — Visual + Security
  - Dark mode (next-themes, globals.css, blocking inline script)
  - Mobile responsive pass
  - UI polish / better data display
  - SSRF fix on /api/extract-watch (IP validation, redirect chain, ssrf-req-filter)
  - next/image migration with remotePatterns allowlist
  No dependencies. Ships value immediately.

Phase 2 — Feature Completeness
  - Fix complicationExceptions in similarity.ts
  - Fix collectionGoal in similarity.ts + insights
  - Wear tracking insight surfacing (daysSinceWorn, "Sleeping Beauty" framing)
  - Wishlist intelligence (targetPrice field, goodDeal flag, gap-fill score)
  Depends on Phase 1 for UI affordances. Ships before migration so data model is stable.

Phase 3 — Database + DAL foundation
  - Drizzle schema (users, watches, user_preferences)
  - Supabase project + connection
  - DAL: src/data/auth.ts, watches.ts, preferences.ts (server-only, cache())
  - Server Actions: src/app/actions/watches.ts, preferences.ts
  No UI changes. Existing pages not yet switched over.
  CRITICAL: crypto.randomUUID() must replace Date.now() IDs before any insert.

Phase 4 — Auth
  - Supabase Auth + @supabase/ssr
  - proxy.ts (not middleware.ts) — run codemod
  - Signup / login / logout Server Actions
  - getCurrentUser() non-stub; redirect from DAL on invalid session
  - Protect all Server Actions with re-verification (not just proxy)
  - SSRF route: add auth gate (complementary to Phase 1 IP validation)
  Depends on Phase 3.

Phase 5 — localStorage import + Zustand cleanup
  - LocalStorageImport.tsx client component, Zod validation
  - importFromLocalStorage() Server Action -> DAL bulk insert
  - One-time dismissable banner with imported_local flag
  - Remove Zustand persist middleware
  - watchStore reduced to filter state; preferencesStore removed/cached
  Depends on Phase 4 (users must exist before they can own watches).

Phase 6 — Similarity / insights re-wiring
  - Insights page becomes Server Component
  - SimilarityBadge/BalanceChart receive props instead of reading Zustand
  - similarity.ts unchanged — only call sites change
  Depends on Phase 5.

Phase 7 — Test suite
  - Vitest + RTL + MSW setup
  - Pure-function tests: similarity.ts, extractor stages, store reducers
  - Component tests: FilterBar, WatchCard, WatchForm (mock next/navigation)
  - Route handler test: /api/extract-watch called directly
  - E2E smoke tests (Playwright) for integrated RSC pages
  Can start earlier in parallel but best run against stabilized code.
```

**Key sequencing calls:**
- Feature fixes (Phase 2) before DB migration (Phase 3) so the schema captures the final data model.
- SSRF IP validation (Phase 1) before auth (Phase 4), not after — the endpoint is currently public.
- DAL scaffolding (Phase 3) before auth (Phase 4) so auth has something to scope queries against.
- Import flow (Phase 5) strictly after auth (Phase 4) — there's no user to own imported data otherwise.
- Similarity re-wiring (Phase 6) strictly after import (Phase 5) — Zustand needs to be demoted before props-based data flow works.

---

## Open Questions for Roadmap

1. **Supabase vs Neon+BetterAuth decision.** Research recommends Supabase for the bundled free tier, but flags cold-start (10-30s on free plan) as a known pain point. Does the roadmapper want to verify current Supabase cold-start behavior, or accept the MEDIUM-confidence recommendation?

2. **Does the Visual milestone split into sub-phases?** Dark mode + mobile + UI polish + image security fix is a lot for one phase. The roadmapper may want to break it into "Security-visible fixes" (SSRF, next/image) as Phase 1a and "Visual polish" (dark mode, mobile, card redesign) as Phase 1b so security lands first.

3. **Should `purchasePrice` and `wearCount` fields be added in Phase 2 (feature completeness) or deferred to post-auth?** Adding them in Phase 2 enables cost-per-wear. Deferring keeps Phase 2 narrow. Research recommends deferring, but the roadmapper should confirm.

4. **Test suite phasing.** Research places tests in Phase 7 (end), but pure-function tests for `similarity.ts` and extractor stages could start in Phase 2 alongside the similarity fixes to catch regressions from the `complicationExceptions` / `collectionGoal` rewiring. Recommend starting test infra earlier.

5. **Chart library choice.** Research mentions Recharts and Nivo as standard React options for the collection balance visualization but does not pick one. Both are fine; Recharts has broader adoption.

6. **Do the feature fixes get research during planning?** `complicationExceptions` and `collectionGoal` wiring is well-understood (it's a code change inside `similarity.ts`). The migration phase, SSRF fix, and auth phase all warrant `/gsd-research-phase` passes. The visual milestone does not.

7. **Does the roadmap include the `proxy.ts` codemod as an explicit step?** It is a Next.js 16 housekeeping item the auth phase cannot skip, and it's easy to forget because most community auth guides still reference `middleware.ts`.
