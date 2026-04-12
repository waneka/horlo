# Roadmap: Horlo

## Overview

Horlo's MVP (CRUD, grid, filters, tagging, preferences, similarity engine, URL import, wear tracking) is already shipped. v1 hardens the experience and moves the app off localStorage onto a real multi-user foundation. The journey: close visible security holes and polish the UI (Phase 1), wire up the dead preference fields and wishlist intelligence while standing up the test runner (Phase 2), build a server-side Data Access Layer with Drizzle + Supabase Postgres (Phase 3), bolt on Supabase Auth with `proxy.ts` gating and per-action re-verification (Phase 4), execute the self-service localStorage import and demote Zustand to ephemeral filter state with the similarity engine reading from props (Phase 5), and finish with a full test suite covering the stabilized code (Phase 6).

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Visual Polish & Security Hardening** - Dark mode, mobile responsive, card/detail refresh, SSRF fix, next/image migration
- [ ] **Phase 2: Feature Completeness & Test Foundation** - Wire dead preference fields, wishlist intelligence, wear insights, stand up Vitest+RTL+MSW with pure-function tests
- [ ] **Phase 3: Data Layer Foundation** - Drizzle schema, Supabase Postgres, server-only DAL, Server Actions (no auth yet)
- [ ] **Phase 4: Authentication** - Supabase Auth via @supabase/ssr, proxy.ts gating, per-Action re-verification, SSRF auth gate
- [ ] **Phase 5: Migration, Zustand Cleanup & Similarity Rewire** - One-time localStorage import banner, drop persist middleware, similarity engine reads props
- [ ] **Phase 6: Test Suite Completion** - Zustand reducer tests, component tests, extract-watch route handler integration test

## Phase Details

### Phase 1: Visual Polish & Security Hardening
**Goal**: The app looks finished on every device and stops leaking server-side requests or rendering untrusted images.
**Depends on**: Nothing (first phase)
**Requirements**: VIS-01, VIS-02, VIS-03, VIS-04, VIS-06, SEC-01, SEC-02
**Success Criteria** (what must be TRUE):
  1. User can toggle light/dark/system theme from the header and the choice survives page reload with no flash of wrong theme on first paint
  2. User can complete every core workflow (browse, detail, add/edit, preferences, insights) on a 375px-wide viewport without horizontal scroll or overlap
  3. Watch cards and detail view display refined typography, spacing, and image treatment consistent across light and dark themes
  4. User sees a chart on the insights page showing their collection's style / role / dial color distribution
  5. `POST /api/extract-watch` refuses URLs that resolve to RFC 1918 / loopback / link-local IPs, pins the resolved IP for the fetch, and blocks redirects to private ranges
  6. Every watch image renders through `next/image` with the source host present in `remotePatterns`; untrusted hosts fail to render rather than load raw
**Plans**: 6 plans
Plans:
- [x] 01-01-PLAN.md — Wave 0: test runner (Vitest) + next-themes ThemeProvider + ThemeToggle + shadcn chart/popover/sheet primitives (VIS-01)
- [x] 01-02-PLAN.md — Wave 1: SSRF hardening — src/lib/ssrf.ts with DNS-pinned safeFetch, integrate into extractors, 400 response with UI-SPEC copy (SEC-01)
- [x] 01-03-PLAN.md — Wave 1: Image allow-list — next.config.ts remotePatterns + getSafeImageUrl helper + next/image migration in WatchCard/WatchDetail (SEC-02, VIS-04)
- [x] 01-04-PLAN.md — Wave 2: Mobile responsive — MobileNav drawer, FilterBar Sheet drawer <lg, WatchDetail 2-col grid, Preferences audit (VIS-02)
- [x] 01-05-PLAN.md — Wave 2: Semantic tokens — warm/brass palette in globals.css + component-wide raw-palette migration + invariant test (VIS-03, VIS-04)
- [x] 01-06-PLAN.md — Wave 3: Insights chart — BalanceChart rewrite with Recharts via shadcn Chart primitive (VIS-06)
**UI hint**: yes

### Phase 2: Feature Completeness & Test Foundation
**Goal**: Stored preferences actually influence scoring, the wishlist becomes actionable, and the test runner is in place to catch regressions from the similarity rewiring.
**Depends on**: Phase 1
**Requirements**: VIS-05, FEAT-01, FEAT-02, FEAT-03, FEAT-04, FEAT-05, FEAT-06, TEST-01, TEST-02, TEST-03
**Success Criteria** (what must be TRUE):
  1. User adding a complication in `complicationExceptions` sees watches with that complication stop contributing to overlap penalties in similarity results
  2. User switching `collectionGoal` between balanced / specialist / variety-within-theme sees similarity labels and insight framing shift accordingly
  3. User can set a target price on any wishlist watch and sees a visible "good deal" indicator when `marketPrice` drops below target
  4. User can toggle a "good deal" flag on wishlist items and filter or surface them in a distinct section
  5. Each wishlist item displays a gap-fill score derived from running the similarity engine against the owned collection
  6. User sees "days since last worn" on the watch detail view and a "Sleeping Beauties" section on insights listing neglected watches
  7. Newly created watches get `crypto.randomUUID()` IDs; no code path uses `Date.now()` for ID generation
  8. Running `npm test` executes Vitest with RTL and MSW configured, and green tests exist for `similarity.ts` (all six labels incl. preference-aware paths) and the three extractor stages
**Plans**: 5 plans
Plans:
- [x] 02-01-PLAN.md — Wave 1: Schema extensions — Watch.productionYear, Watch.isFlaggedDeal, CollectionGoal += brand-loyalist, generateId → crypto.randomUUID (FEAT-06)
- [x] 02-02-PLAN.md — Wave 2: Similarity engine rewire — complicationExceptions filter, goal-aware thresholds + reasoning, brand-loyalist routing, new gapFill.ts (FEAT-01, FEAT-02, FEAT-05)
- [x] 02-03-PLAN.md — Wave 3: Wishlist UX — productionYear input, Deal + gap-fill badges, last-worn line, flagged-deal toggle, gap-fill callout, wishlist sort (VIS-05, FEAT-03, FEAT-04, FEAT-05)
- [x] 02-04-PLAN.md — Wave 3: Insights additions — GoodDealsSection + SleepingBeautiesSection + goal-aware observation copy (VIS-05, FEAT-02, FEAT-04)
- [x] 02-05-PLAN.md — Wave 3: Test foundation — MSW devDep install, similarity.ts + gapFill.ts test suites, 3-stage extractor pipeline fixture tests (TEST-01, TEST-02, TEST-03)
**UI hint**: yes

### Phase 3: Data Layer Foundation
**Goal**: A server-side data layer and mutation surface exist and work against a real Postgres database, without touching the UI or auth yet.
**Depends on**: Phase 2
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04
**Success Criteria** (what must be TRUE):
  1. A running Supabase Postgres instance has `users`, `watches`, and `user_preferences` tables matching the Drizzle schema in `src/db/schema.ts`
  2. Every file under `src/data/` imports `server-only` and exposes DAL functions that accept an explicit `userId` and scope all queries by it
  3. Watch and preference mutations exist as Server Actions under `src/app/actions/` that delegate to the DAL and call `revalidatePath` on success
  4. Existing pages continue to render from Zustand (unchanged), but the Server Actions and DAL are callable end-to-end from a test or REPL against a seeded user
**Plans**: 3 plans
Plans:
- [ ] 03-01-PLAN.md — Wave 1: Drizzle schema + DB connection + deps + Supabase push (DATA-01)
- [ ] 03-02-PLAN.md — Wave 2: server-only DAL in src/data/ with userId-scoped CRUD and domain type mapping (DATA-02)
- [ ] 03-03-PLAN.md — Wave 3: Server Actions with Zod validation + revalidatePath + build verification (DATA-03, DATA-04)

### Phase 4: Authentication
**Goal**: Real users can sign up and log in, session is enforced at the proxy layer AND independently re-verified inside every Server Action and DAL function.
**Depends on**: Phase 3
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04
**Success Criteria** (what must be TRUE):
  1. User can sign up with email/password, log in, and log out through UI backed by Supabase Auth (`@supabase/ssr`)
  2. The project uses `proxy.ts` (not `middleware.ts`) — the Next.js 16 codemod has been run and a log line confirms the proxy executes on protected routes
  3. Every Server Action and DAL function re-verifies the session via `getCurrentUser()` before touching data; a request with a tampered cookie returns 401 even if the proxy is bypassed
  4. A user cannot read, update, or delete another user's watches or preferences regardless of the ID supplied by the client (IDOR-safe)
  5. `POST /api/extract-watch` rejects unauthenticated requests with 401 in addition to the Phase 1 SSRF protections
**Plans**: TBD

### Phase 5: Migration, Zustand Cleanup & Similarity Rewire
**Goal**: Existing local collections are self-service imported into the cloud, Zustand is demoted to filter-only state, and the similarity engine reads from props.
**Depends on**: Phase 4
**Requirements**: MIG-01, MIG-02, DATA-05
**Success Criteria** (what must be TRUE):
  1. First-time signed-in user with existing localStorage data sees a one-time dismissable banner offering to import their local collection; dismissing or importing sets a flag so the banner does not return
  2. The import flow validates localStorage payloads with Zod, regenerates any non-UUID IDs to `crypto.randomUUID()`, and bulk-inserts via a Server Action with clear success/failure feedback; localStorage is never auto-deleted
  3. `watchStore` no longer uses the `persist` middleware and exposes only ephemeral filter state (status, tags, dial colors); it contains no CRUD methods and no collection data
  4. The insights page is a Server Component; `SimilarityBadge` and `BalanceChart` receive collection + preferences as props and no longer call `useWatchStore()` or `usePreferencesStore()`
  5. A logged-in user on two different browsers sees the same collection, and changes in one browser appear in the other after refresh
**Plans**: TBD

### Phase 6: Test Suite Completion
**Goal**: The stabilized cloud-backed codebase has the test coverage called for in v1, including the route handler and key UI components.
**Depends on**: Phase 5
**Requirements**: TEST-04, TEST-05, TEST-06
**Success Criteria** (what must be TRUE):
  1. Vitest runs green unit tests for `watchStore` filter reducers with `beforeEach` reset, covering status, style, role, and dial color filter combinations
  2. An integration test hits the `POST /api/extract-watch` route handler directly and asserts on success, invalid URL, SSRF blocklist rejection, and unauthenticated denial
  3. Component tests exist for `WatchForm`, `FilterBar`, and `WatchCard` using `@testing-library/user-event` with `next/navigation` mocked
  4. `npm test` exits zero on a clean checkout and reports coverage for `src/lib/`, `src/store/`, and `src/components/`
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Visual Polish & Security Hardening | 0/6 | Not started | - |
| 2. Feature Completeness & Test Foundation | 0/5 | Not started | - |
| 3. Data Layer Foundation | 0/3 | Not started | - |
| 4. Authentication | 0/TBD | Not started | - |
| 5. Migration, Zustand Cleanup & Similarity Rewire | 0/TBD | Not started | - |
| 6. Test Suite Completion | 0/TBD | Not started | - |
