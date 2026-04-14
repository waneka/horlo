# Horlo Requirements

## v1 Scope

Brownfield project. The MVP (CRUD, grid, filters, tagging, preferences, similarity engine, URL import, wear tracking) is already built and working. v1 focuses on polishing the experience, fixing dead preference code, migrating to multi-user cloud persistence, and adding test coverage.

---

## Visual Polish & Security

- [ ] **VIS-01**: User can toggle between light, dark, and system theme — preference persists across sessions and no flash of wrong theme on SSR load
- [ ] **VIS-02**: Every page (collection grid, detail view, preferences, insights, add/edit) is fully usable on mobile and tablet viewports
- [ ] **VIS-03**: UI refinement pass — consistent spacing, typography scale, and color tokens across all views
- [ ] **VIS-04**: Richer watch cards and improved detail view — better data density, clearer hierarchy, improved images
- [ ] **VIS-05**: User sees "days since last worn" surfaced in the watch detail view with "Sleeping Beauties" framing for neglected watches in the insights panel
- [ ] **VIS-06**: Collection balance visualization as a chart (style, role, and dial color distribution) on the insights page
- [ ] **SEC-01**: `POST /api/extract-watch` validates resolved IPs against RFC 1918/5735 ranges, pins IPs before fetch, and validates every redirect hop — naive hostname matching is not sufficient
- [ ] **SEC-02**: All watch images render via `next/image` with a `remotePatterns` domain allowlist in `next.config.ts`

## Feature Completeness

- [ ] **FEAT-01**: `complicationExceptions` preference is respected by the similarity engine — complications in the exceptions list no longer count toward overlap penalty
- [ ] **FEAT-02**: `collectionGoal` preference ("balanced" / "specialist" / "variety-within-theme") modifies similarity thresholds and influences insight framing
- [ ] **FEAT-03**: User can set a target price per wishlist watch and see visual indication when `marketPrice` dips below target
- [ ] **FEAT-04**: User can toggle a "good deal" flag on any wishlist watch to surface it in a distinct section
- [ ] **FEAT-05**: Wishlist items display a "gap-fill score" computed by running the existing similarity engine against the owned collection
- [ ] **FEAT-06**: Watch IDs are generated with `crypto.randomUUID()` (replaces `Date.now()`-based IDs to prevent collisions on batch imports)

## Data Layer & Architecture

- [ ] **DATA-01**: Drizzle ORM schema defines `users`, `watches`, `user_preferences` tables scoped to Postgres
- [ ] **DATA-02**: Data Access Layer in `src/data/` marked `server-only`; every query scoped to the authenticated `userId`
- [ ] **DATA-03**: Watch CRUD and preference mutations move to Server Actions in `src/app/actions/`
- [ ] **DATA-04**: Existing pages fetch data via Server Components calling the DAL; Zustand `watchStore` narrows to filter-only ephemeral state (no more `persist` middleware)
- [ ] **DATA-05**: Similarity engine remains client-side and receives collection + preferences as props instead of reading from Zustand

## Auth

- [ ] **AUTH-01**: Supabase Auth integrated via `@supabase/ssr`; users can sign up, log in, and log out
- [ ] **AUTH-02**: Auth is enforced via `proxy.ts` (NOT `middleware.ts` — Next.js 16 renamed it) AND independently re-verified inside every Server Action and DAL function
- [ ] **AUTH-03**: Per-user data isolation enforced at the DAL query level — every read and write scoped by `userId`; client-supplied IDs are never trusted for authorization
- [ ] **AUTH-04**: `POST /api/extract-watch` requires an authenticated session (complementary to the Phase 1 IP validation)

## Testing

- [ ] **TEST-01**: Vitest + React Testing Library + MSW configured for the Next.js 16 App Router project
- [ ] **TEST-02**: Unit tests for `src/lib/similarity.ts` covering all six `SimilarityLabel` outputs including preference-aware paths (`complicationExceptions`, `collectionGoal`)
- [ ] **TEST-03**: Unit tests for the 3-stage extractor pipeline (`structured.ts`, `html.ts`, and the merge logic in `index.ts`) with fixture HTML
- [ ] **TEST-04**: Unit tests for Zustand `watchStore` CRUD and filter logic with explicit `beforeEach` reset
- [ ] **TEST-05**: Integration test for `POST /api/extract-watch` route handler covering success, invalid URL, SSRF blocklist, and auth denial
- [ ] **TEST-06**: Component tests for `WatchForm`, `FilterBar`, and `WatchCard` using `@testing-library/user-event`

## Operations

- [ ] **OPS-01**: `docs/deploy-db-setup.md` runbook exists with verified, step-by-step commands for a solo operator to link the existing prod Supabase project, apply all migrations (including the Phase 4 shadow-user trigger), push the Drizzle schema, set Vercel env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL`), and smoke-test signup + logout against horlo.app — completing the runbook yields a working authenticated prod environment

---

## Out of Scope for v1

- **Automated price tracking / market API integrations** — requires ToS-hostile scraping or paid APIs; deferred to future milestone
- **Price alert notifications** — depends on price tracking infrastructure
- **Social / public collections / following other users** — dilutes personal-first positioning
- **AI "best next watch" recommendation engine** — small per-user datasets produce mediocre output; existing gap analysis is sufficient
- **Cost-per-wear tracking** — deferred; requires adding `purchaseDate`/`wearCount` and enough wear history to be meaningful
- **Collection 2D visualization map** (dressy↔sporty × affordable↔expensive) — future milestone
- **Barcode / case-back scanning** — URL import is the right mechanism for mechanical watches
- **Rotation profile labels** ("The Faithful" etc.) — needs weeks of persisted wear data; revisit post-migration
- **Self-service localStorage import flow** (former MIG-01 / MIG-02) — dropped 2026-04-13. The app has a single user (the developer) with no legacy localStorage data worth migrating; a polished banner-driven import flow has no audience. Phase 5 starts the cloud collection from scratch instead.

---

## v2 Deferred (next milestone candidates)

- Cost-per-wear tracking
- AI-assisted similarity explanations (human-readable reasoning for labels)
- Collection 2D visualization map
- Rotation profile insights

---

## Traceability

REQ-ID → Phase mapping (populated by roadmapper 2026-04-11):

| Requirement | Phase | Status |
|-------------|-------|--------|
| VIS-01 | Phase 1 | Pending |
| VIS-02 | Phase 1 | Pending |
| VIS-03 | Phase 1 | Pending |
| VIS-04 | Phase 1 | Pending |
| VIS-05 | Phase 2 | Pending |
| VIS-06 | Phase 1 | Pending |
| SEC-01 | Phase 1 | Pending |
| SEC-02 | Phase 1 | Pending |
| FEAT-01 | Phase 2 | Pending |
| FEAT-02 | Phase 2 | Pending |
| FEAT-03 | Phase 2 | Pending |
| FEAT-04 | Phase 2 | Pending |
| FEAT-05 | Phase 2 | Pending |
| FEAT-06 | Phase 2 | Pending |
| DATA-01 | Phase 3 | Pending |
| DATA-02 | Phase 3 | Pending |
| DATA-03 | Phase 3 | Pending |
| DATA-04 | Phase 3 | Pending |
| DATA-05 | Phase 5 | Pending |
| AUTH-01 | Phase 4 | Pending |
| AUTH-02 | Phase 4 | Pending |
| AUTH-03 | Phase 4 | Pending |
| AUTH-04 | Phase 4 | Pending |
| TEST-01 | Phase 2 | Pending |
| TEST-02 | Phase 2 | Pending |
| TEST-03 | Phase 2 | Pending |
| TEST-04 | Phase 6 | Pending |
| TEST-05 | Phase 6 | Pending |
| TEST-06 | Phase 6 | Pending |

**Coverage:** 29/29 v1 requirements mapped. No orphans. No duplicates.

**Sequencing notes:**
- VIS-05 moved to Phase 2 (not Phase 1) because the "Sleeping Beauties" framing is an insight feature that pairs naturally with the collection-goal / complicationException rewiring, not the visual polish pass.
- TEST-01/02/03 pulled into Phase 2 (not deferred to end) per research open question #4: pure-function tests catch regressions from the similarity engine rewiring in the same phase.
- DATA-05 (similarity engine props rewire) lives in Phase 5 alongside the Zustand demotion — it is the same operation (demoting Zustand from collection store to filter-only).
- MIG-01 / MIG-02 dropped 2026-04-13 — single-developer project with no legacy localStorage data to migrate; see "Out of Scope for v1".
- TEST-04/05/06 stay in the final phase because they test stabilized code (store reducers post-demotion, route handler post-auth, components post-redesign).
