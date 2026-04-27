# Project Research Summary

**Project:** Horlo
**Domain:** Taste-aware watch collection intelligence — v4.0 Discovery & Polish milestone
**Researched:** 2026-04-26
**Confidence:** HIGH

## Executive Summary

Horlo v4.0 is a feature-completion milestone layered onto a v3.0 codebase that already ships production navigation, three-tier wear privacy, notifications, photo-first WYWT, and people search. The milestone has one keystone architectural shift — a canonical `watches_catalog` table with a nullable `catalog_id` FK from per-user `watches` — and ten dependent surfaces that this shift unblocks (`/explore` rails, `/search` Watches tab, `/search` Collections cross-user search, deep-linkable `/evaluate?catalogId=`, denormalized owners/wishlist counts). Everything else (Settings expansion with Account/Notifications/Appearance, custom SMTP via Resend, profile avatar in DesktopTopNav, empty-state CTAs, WYWT auto-nav, form-feedback polish, schema-field UI exposure, dead-stub cleanup, carryover tests) is independent and can ship in parallel tracks.

The recommended approach is the **expand-contract migration pattern** for the catalog (additive schema, idempotent backfill, keep `catalog_id` nullable indefinitely; do NOT add `SET NOT NULL` in v4.0), composition-only for /explore + /search (no new search engine — `pg_trgm` GIN is two orders of magnitude under the threshold where Algolia/Meilisearch become useful), a route-not-modal pattern for `/evaluate` (verdict UI is too dense for a modal; reuses existing `/api/extract-watch` and `analyzeSimilarity()`), vertical tabs via `@base-ui/react` with hash state for Settings (avoids per-section route boilerplate and the shadcn Sidebar primitive that would conflict with the BottomNav), and Resend over SMTP for Auth-only email (no npm install needed; native Supabase partner integration; 30x the free-tier headroom of Postmark).

Key risks cluster around the catalog migration (backfill safety, ON CONFLICT semantics, casing/typo identity fragmentation, dual Drizzle+Supabase migration tracks, RLS-default-on for new tables), the SMTP go-live ordering (DKIM verification must complete BEFORE flipping "Confirm email" ON, or new signups silently land in spam), enum cleanup (`ALTER TYPE DROP VALUE` does not exist — requires rename+recreate), Cache Components Suspense boundaries on `/evaluate`, and BottomNav muscle-memory disruption (`/explore` deserves the bottom-nav slot; profile goes top-right, NOT into BottomNav). Mitigations are documented per pitfall and informed by patterns proven in v3.0 (Phase 11 RLS audit, Phase 13 fire-and-forget logger, Phase 15 Sonner ThemeProvider binding, Phase 16 anti-N+1 + forced-plan EXPLAIN verification).

## Key Findings

### Recommended Stack

The v4.0 stack is **almost entirely composition** of what's already in the tree. Exactly one new package — `resend@^4.0.0` — and that install is *optional* (Auth-only path is pure SMTP via Supabase Dashboard config; install Resend SDK only when product transactional emails ship). Everything else is schema additions, raw-SQL migrations, route additions, and UI composition with libraries already shipped (Drizzle 0.45.2, `@supabase/ssr` 0.10.2, `@base-ui/react` 1.3.0, Sonner via `<ThemedToaster />`, `pg_trgm`, `pg_cron`).

**Core technologies (additions, not the existing stack):**
- **`watches_catalog` table + nullable FK** — surrogate UUID PK, natural-key UNIQUE on `(brand_normalized, model_normalized, reference_normalized)` with `NULLS NOT DISTINCT` (PG 15+) or `COALESCE` fallback; mirrors classic e-commerce normalization
- **Resend SMTP via Supabase native partner integration** — `smtp.resend.com:465`; 3,000/mo, 100/day free tier; SPF + DKIM + bounce MX at registrar; `resend` npm SDK NOT required for Auth-only path
- **`pg_trgm` GIN on `watches_catalog.brand` + `model`** — same query shape as Phase 16 `profiles.username` (proven); at <5,000 catalog rows times handful of users, no Algolia/Meilisearch
- **`pg_cron` daily refresh of `owners_count` + `wishlist_count`** — denormalized counters for /explore Trending; reject live triggers (write amplification on `addWatch` hot path)
- **`@base-ui/react` Tabs `orientation="vertical"`** — Settings sidebar pattern with hash-state URL, accordion fallback on mobile; reject shadcn Sidebar (built for app-shell nav, conflicts with BottomNav)

See `.planning/research/STACK.md` for full recommendations including DNS records, Supabase rate-limit knob behavior, and rejected alternatives.

### Expected Features

The eight v4.0 surfaces map cleanly to comparable apps (Letterboxd, Discogs, Goodreads, Are.na, Untappd, Spotify), with /evaluate being Horlo's differentiator — no comparable taste-app ships a "is this a fit?" pre-commit verdict engine.

**Must have (table stakes for v4.0 launch):**
- `watches_catalog` table + backfill (keystone — unblocks 4 downstream surfaces)
- `/explore` Popular Collectors rail + Trending Watches rail + sparse-network welcome hero
- `/search` Watches tab populated with thumbnails + owned/wishlist badges + "Evaluate" inline CTA
- `/search` Collections tab (cross-collection by-watch-identity + by-tag-profile, two-layer privacy)
- `/evaluate` route (paste URL — verdict + three-CTA ladder: Save to Evaluate Later [reuse wishlist] / Add to Wishlist / Add to Collection)
- Settings restructure (vertical tabs, hash-driven, sections in canonical order: Account / Profile / Preferences / Privacy / Notifications / Appearance)
- Settings — Account: change email + change password with re-auth flow (Supabase `updateUser` + `verifyOtp` `email_change`)
- Settings — Preferences UI for `collectionGoal` + `overlapTolerance` (schema fields exist; expose them)
- Settings — Notifications opt-out toggle UI (backend wired in v3.0 Phase 13)
- Custom SMTP via Resend + email confirmation ON (config, not code)
- Profile avatar in `DesktopTopNav` top-right with dual affordance (avatar = profile, chevron = menu)
- Empty-state CTAs across Collection / Wishlist / Worn / Notes (single primary CTA, voice-aware copy)
- Form feedback polish (Sonner toast + inline `aria-live` + categorized URL-extract errors + pending states)
- `notesPublic` per-note visibility owner edit; `isChronometer` toggle in WatchForm
- WYWT post-submit auto-nav to `/wear/[id]` (v3.0 deferred UX)
- Remove `price_drop` + `trending_collector` notification stubs
- Test fixture cleanup (9 files w/ `wornPublic` references) + TEST-04/05/06

**Should have (v4.x patch milestones):**
- /explore "Watches Gaining Traction" rail (7-day delta — requires `watches_catalog_daily_snapshots`)
- /search Watches filter facets (Movement / Case size / Style)
- /evaluate "Compare with watch I own" pairwise drill-down
- Preferences live preview ("here's how your similarity engine reads your taste")
- Sonner `toast.promise()` refactor; optimistic-update extension to status toggles

**Defer (v5+):**
- Taste Clusters visualization (k-means on preference vectors)
- Editorial Featured Collection (admin tooling required)
- Account — Delete Account / Wipe Collection (Danger Zone — needs multi-step confirm + soft-delete cron)
- Multi-watch Comparison Tool; saved-search alerts; faceted search on Collections; Realtime updates
- Watch-overlap digest emails (would require `resend` SDK install)
- Migrating similarity engine to read from canonical catalog (catalog is silent infrastructure in v4.0)

See `.planning/research/FEATURES.md` for the full prioritization matrix and competitor analysis.

### Architecture Approach

V4.0 layers onto v3.0's established frame: Server Components by default with `cacheComponents: true`, server-only DAL with `'server-only'` import, Server Actions for all mutations, `proxy.ts` edge auth via `PUBLIC_PATHS`, two-layer privacy (RLS + DAL WHERE), Drizzle for column shapes + raw-SQL Supabase migrations for RLS/partial indexes/CHECK/triggers, fire-and-forget activity + notification logging, Sonner `<ThemedToaster />` bound to custom ThemeProvider. The catalog is **silent infrastructure** in v4.0 — `analyzeSimilarity()` is NOT modified; it continues reading from per-user `watches`. Catalog migration to similarity is a v5.0+ concern.

**Major components (new for v4.0):**
1. **`watches_catalog` (Postgres table)** — canonical spec sheet with denormalized `owners_count` + `wishlist_count`; public-read RLS / service-role-write-only (deliberate departure from two-layer privacy, documented as Key Decision); populated via `addWatch` (`user_promoted` source) and `/api/extract-watch` (`url_extracted` source, higher-trust enrichment via `ON CONFLICT DO UPDATE … COALESCE` per nullable spec column)
2. **`src/data/catalog.ts` + `src/data/explore.ts` (new DAL modules)** — `getOrCreateCatalogEntry`, `searchCatalogWatches` (mirrors Phase 16 `searchProfiles` shape including anti-N+1 `inArray` for viewer-state badges), `getPopularCollectors`, `getTrendingWatches`
3. **`/evaluate` route (Server Component shell + Client Component form)** — `<Suspense>` wraps the auth-gated body; reuses `/api/extract-watch` route handler unchanged; `analyzeSimilarity()` runs client-side (pure); shared `<SimilarityVerdictCard>` component extracted from existing `<SimilarityBadge>` (refactor: pure renderer, computation moves to caller)
4. **`/settings` single-page vertical-tabs layout (`<SettingsTabs>` Client Component)** — base-ui Tabs with `orientation="vertical"`, hash state via `window.location.hash` + `useEffect` (no `router.push` to avoid re-running page loader), section components `<AccountSection>` / `<PreferencesSection>` / `<PrivacySection>` / `<NotificationsSection>` / `<AppearanceSection>` (the latter lifts `<InlineThemeSegmented>` from UserMenu)
5. **Auth confirm route handler extension** — `/auth/confirm/route.ts` switches on `type` to handle `signup` | `recovery` | `email_change` | `magiclink` | `invite` with a redirect map (post-`email_change` lands on `/settings/account?status=email_changed`)
6. **`pg_cron` daily refresh function** — `refresh_watches_catalog_counts()` SECURITY DEFINER with REVOKE FROM PUBLIC/anon/authenticated + GRANT TO service_role (mirrors Phase 11 SECDEF posture from MEMORY); local-dev path is manual `npm run db:refresh-counts` script (vanilla Supabase Docker doesn't ship pg_cron)

See `.planning/research/ARCHITECTURE.md` for full data flow diagrams, JOIN topologies, and integration points.

### Critical Pitfalls

The five highest-severity risks are migration safety, SMTP DKIM ordering, enum-removal mechanics, Cache Components Suspense, and BottomNav muscle memory.

1. **Catalog migration backfill half-completes; `SET NOT NULL` forced too early** — Split into THREE phases: (a) additive schema with `NULLS NOT DISTINCT` UNIQUE in raw SQL, (b) idempotent batched backfill script with `WHERE catalog_id IS NULL` short-circuit + final `COUNT(*)` assertion, (c) **DO NOT** add `SET NOT NULL` in v4.0 (preserves "user hasn't matched catalog yet" UX state; defer to v5.0). Local works, prod aborts because casing collisions explode `(brand, model, NULL reference)` UNIQUE.

2. **`ON CONFLICT (...) DO NOTHING` silently discards URL-extracted enrichment** — Two helpers, not one: `upsertCatalogFromUserInput` uses `DO NOTHING` (don't enrich from typed input — too much typo risk); `upsertCatalogFromExtractedUrl` uses `DO UPDATE SET col = COALESCE(catalog.col, EXCLUDED.col)` per nullable spec column with `source` pinned to `admin_curated` if already set. Catalog identity fragmentation (Pitfall 3 in PITFALLS.md) is a sibling: normalize at Server Action boundary via Postgres generated columns (`brand_normalized TEXT GENERATED ALWAYS AS (lower(trim(brand))) STORED`); UNIQUE on the normalized trio; preserve original casing for display.

3. **`watches_catalog` public-read RLS forgotten — table anon-invisible after RLS-default-on** — Project-wide RLS audited ON in v3.0 Phase 11 (DEBT-02). Every new table inherits "no policies — no rows visible to non-service-role." `/search` Watches and `/explore` Trending silently return empty arrays in production. Mandate that EVERY phase plan adding a table includes BOTH a Drizzle migration AND a sibling `supabase/migrations/*.sql` with `ALTER TABLE … ENABLE RLS` + `CREATE POLICY … FOR SELECT USING (true)` in the SAME commit. Add `tests/integration/catalog-rls.test.ts` opening anon connection asserting >0 rows.

4. **Custom SMTP goes live before DKIM verifies — confirmation emails land in spam, lock out new signups** — Mandatory ordered checklist: Resend account — DNS records at registrar — wait minimum 1 hour for propagation — verify Resend "Verified" badge — send Resend test email — copy SMTP creds to Supabase Dashboard — send Supabase Auth test — ONLY THEN toggle "Confirm email" ON. Backout plan: keep Supabase hosted SMTP toggle accessible; revert if DKIM fails post-flip. Two domain setup recommended (`mail.staging.horlo.app` for staging, `mail.horlo.app` for prod).

5. **`ALTER TYPE notification_type DROP VALUE` does not exist — Postgres rejects the migration** — Pre-flight assertion: `SELECT type, COUNT(*) FROM notifications WHERE type IN ('price_drop', 'trending_collector')` MUST return zero rows before proceeding. Two-step pattern: `ALTER TYPE … RENAME TO …_old` — `CREATE TYPE … AS ENUM (...)` (without dead values) — `ALTER TABLE … ALTER COLUMN type TYPE … USING type::text::…` — `DROP TYPE …_old`. `grep -r 'price_drop\|trending_collector'` across `src/`, `tests/`, `scripts/`, `seed/` BEFORE step 1; update Drizzle `pgEnum` AFTER prod migration applied.

Additional high-severity pitfalls (full list in `.planning/research/PITFALLS.md`):
- **`/evaluate` Cache Components Suspense pattern** — `cookies()` / `auth.getUser()` must live INSIDE a Suspense boundary, not in the route's default export body; `next dev` is permissive but `next build` aborts
- **/search Collections two-layer privacy drift** — gate BOTH `profile_public` AND `collection_public` (latter on `profile_settings` table — easy to forget when copying Phase 16 people-search pattern)
- **Email-change "updated" toast fires before user clicks link** — `updateUser({ email })` resolves on dispatch, NOT confirmation; show pending banner ("Confirmation sent to both old@ and new@"), do NOT display new email as current
- **BottomNav muscle memory** — Profile lives in SlimTopNav top-right (universal Twitter/Letterboxd/GitHub/Instagram pattern); BottomNav stays 5 slots: Home / Search / **Wear** / Notifications / **Explore** (the new /explore replaces "discover")
- **WYWT auto-nav races storage CDN propagation** — Inside `/wear/[id]` page, wrap photo render in `<Suspense fallback={<PhotoSkeleton />}>` to cover the 200–800ms signed-URL window; await both `uploadResult` AND `logWearWithPhoto` BEFORE `router.push`

## Implications for Roadmap

The keystone (`watches_catalog`) creates a hard dependency that drives phase ordering. SMTP is independent, /evaluate is mostly independent (URL-paste path works without catalog; deep-link from /search Watches requires catalog). Settings work parallels everything. Polish lands last.

### Phase 1: Catalog Schema + Backfill (Keystone)

**Rationale:** Unblocks 4 downstream surfaces (`/explore` Trending, `/search` Watches, `/search` Collections by-watch-identity, `/evaluate?catalogId=` deep-link). Higher-risk migration work goes first while milestone scope is still flexible.

**Delivers:** `watches_catalog` table with normalized natural-key UNIQUE, public-read RLS, pg_trgm GIN indexes, nullable `watches.catalog_id` FK with `ON DELETE SET NULL`, idempotent batched backfill script, two upsert helpers (`upsertCatalogFromUserInput` `DO NOTHING` vs `upsertCatalogFromExtractedUrl` `DO UPDATE SET … COALESCE`), `addWatch` and `/api/extract-watch` extended to populate catalog, `pg_cron` daily refresh function (prod-only) + manual `npm run db:refresh-counts` script for local dev, source-of-truth decision documented (catalog authoritative for SPEC fields; per-user `watches` authoritative for OWNERSHIP/PROVENANCE fields).

### Phase 2: /explore Discovery Surface

Smallest catalog-dependent surface. Popular Collectors rail + Trending Watches rail + sparse-network welcome hero. BottomNav slot wiring (Explore replaces Discover slot).

### Phase 3: /search Watches + Collections Tabs

Reuses Phase 16 4-tab shell. `searchCatalogWatches` DAL (anti-N+1 owned/wishlist badges + Evaluate inline CTA). `searchCollections` DAL with two-layer privacy (BOTH `profile_public` AND `collection_public`).

### Phase 4: /evaluate Route + Verdict UI

`<Suspense>`-wrapped Server Component; Client Component form posting to `/api/extract-watch`; pure-renderer `<SimilarityVerdictCard>` extracted from `<SimilarityBadge>`; three-CTA ladder reusing `wishlist` status.

### Phase 5: Custom SMTP Setup (Resend)

Independent from catalog. Long DNS propagation lead time — start in parallel with Phase 1. Resend domain verify, Supabase Dashboard wire, "Confirm email" ON only after DKIM "Verified ✓" badge.

### Phase 6: Settings Restructure + Account Section

Depends on Phase 5 SMTP. Vertical-tabs shell + Account section (email/password change with re-auth + pending banner UI). `/auth/confirm` extended with redirect map per `type`.

### Phase 7: Settings Sections (Preferences / Privacy / Notifications / Appearance) + notesPublic + isChronometer

Depends on Phase 6 shell. UI exposure of existing schema fields. Lifts `<InlineThemeSegmented>` from UserMenu.

### Phase 8: Notification Stub Cleanup + Test Fixture Cleanup

Two-step ENUM rename+recreate; pre-flight zero-row assertion; Drizzle update lands AFTER prod migration. 9 fixture files w/ `wornPublic` cleanup; TEST-04/05/06.

### Phase 9: Profile Nav Prominence + Empty-State CTAs + Form Polish

Polish phase. Top-right avatar in `DesktopTopNav` (dual affordance: avatar=profile, chevron=menu). Voice-aware empty states with single primary CTA + "Add manually" fallback. Sonner toast + inline `aria-live` polite banners + categorized URL-extract errors.

### Phase 10: WYWT Auto-Nav

Single race condition: `router.push(/wear/${wearEventId})` after BOTH upload AND server action resolve; `<Suspense fallback={<PhotoSkeleton />}>` around photo render in `/wear/[id]`.

### Phase Ordering Rationale

- **Catalog is keystone, must land first** — every search/explore/evaluate-deep-link surface depends on it
- **SMTP DNS propagation lead time** — start Phase 5 in parallel with Phase 1; the DNS wait window can run during catalog implementation
- **Settings shell before sections** — vertical-tabs layout is the substrate
- **Notifications cleanup independent** — schedule when convenient
- **Polish phase last** — empty-state CTAs need all functional surfaces existing to link correctly

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 1 (Catalog Schema + Backfill):** Highest-risk migration; validate `NULLS NOT DISTINCT` behavior with current Drizzle 0.45.2 introspection (fallback: `UNIQUE (brand_norm, model_norm, COALESCE(reference_norm, ''))`); generated-column normalization pattern needs final read
- **Phase 5 (Custom SMTP):** Verify Resend free-tier rates haven't shifted; validate Supabase rate-limit auto-jump from 2/h to 30/h on custom SMTP save
- **Phase 8 (Notification Stub Cleanup):** ALTER TYPE rename + recreate has known data-cast pitfalls; grep across `tests/`, `scripts/`, `seed/` BEFORE writing the migration

Phases with standard patterns (skip deeper research, plan directly): Phases 2, 3, 4, 6, 7, 9, 10.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Resend partner integration, `pg_trgm` proven in Phase 16, `@base-ui/react` Tabs vertical, Supabase Auth `updateUser` |
| Features | HIGH-MEDIUM | Catalog search UX, settings IA, save-vs-commit converge across multiple sources. /explore section composition is MEDIUM (comparable apps diverge). Reusing `wishlist` for "Save to Evaluate Later" is opinionated |
| Architecture | HIGH | Phase 16 patterns generalize cleanly. `pg_cron` vs live triggers is MEDIUM but documented |
| Pitfalls | HIGH | Each pitfall has verifiable warning sign + tested mitigation from v3.0 patterns |

**Overall confidence:** HIGH

### Gaps to Address

- **`NULLS NOT DISTINCT` vs `COALESCE` fallback** — verify in Phase 1 plan
- **Source-of-truth for SPEC fields** — catalog vs per-user `watches` Key Decision
- **/evaluate auth posture** — auth-only redirect for v4.0 (recommend); demo path defers to v5.0
- **Catalog-row image_url provenance** — resolve in Phase 1
- **Trending vs Gaining Traction** — Trending P1; Gaining Traction P2 (requires daily snapshots)
- **Sonner `toast.promise()` refactor** — absorb in Phase 9 or defer

## Sources

### Primary (HIGH confidence)

- **STACK.md sources:** Resend Supabase partner integration docs, Supabase Auth `updateUser` JS reference, Drizzle ORM zero-downtime schema changes, Base UI Tabs (vertical orientation), Cybertec polymorphism analysis
- **FEATURES.md sources:** Letterboxd Watchlist FAQ, Discogs database search, Are.na Channels, Goodreads recommendation engine, NN/G empty-state guidelines, NN/G error-form guidelines, NN/G scoped-vs-global search, GOV.UK Design System forms
- **ARCHITECTURE.md sources:** Direct codebase read (`src/`, `.planning/PROJECT.md`, prior phase RESEARCH artifacts); Cache Components rules from Phase 10/13/14 verified-shipped patterns
- **PITFALLS.md sources:** Postgres 15 `NULLS NOT DISTINCT` docs, Postgres ALTER TYPE limitations, MEMORY (drizzle/supabase migration split, SECDEF grants), v3.0 Phase 11/13/15/16 patterns

### Secondary (MEDIUM confidence)

- Spotify editorial-playlist ecosystem (sparse-network evidence)
- Pencil & Paper error/success UX articles
- LogRocket React toast libraries 2025 comparison
- Sonner Toast docs

### Tertiary (LOW confidence)

- Specific UX copy for two-link email confirmation
- Exact Resend free-tier rates as of April 2026 (verify in Phase 5 plan)

---
*Research completed: 2026-04-26*
*Ready for roadmap: yes*
