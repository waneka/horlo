---
phase: 17
slug: catalog-foundation
status: verified
threats_open: 0
asvs_level: 2
created: 2026-04-27
---

# Phase 17 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Catalog foundation = canonical `watches_catalog` table + DAL helpers + fire-and-forget wiring + backfill + pg_cron daily refresh with SECDEF lockdown.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| anon Supabase JS client → public.watches_catalog | Untrusted reader; must not write | Spec rows (non-PII watch metadata) |
| authenticated Supabase JS client → public.watches_catalog | Authenticated user; must not write directly | Same as anon (catalog is server-role-write only) |
| service-role DB client (Drizzle pooler) → public.watches_catalog | Trusted; bypasses RLS | All catalog rows + denormalized counts |
| URL extractor LLM output → catalog DAL | LLM-generated text flows into image_url, image_source_url, tag arrays | Image URLs, free-text tags |
| Authenticated user → addWatch / /api/extract-watch | Auth-gated by `getCurrentUser()`; user.id flows into linkWatchToCatalog | watches.catalog_id FK |
| anon / authenticated → public.refresh_watches_catalog_counts() | Untrusted; must NOT EXECUTE the SECDEF function | Function invocation |
| service-role / pg_cron → refresh_watches_catalog_counts() | Trusted; only role with EXECUTE | Bulk count recompute, snapshot insert |
| Backfill script process → DB via service-role DATABASE_URL | Operator-driven; bypasses RLS by design | watches_catalog inserts + watches.catalog_id updates |
| Operator → prod DB via `supabase db push --linked` | Trusted human operator; documented runbook | Schema migrations |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-17-01-01 | Tampering | watches_catalog rows by anon | mitigate | RLS ENABLED + SELECT-only policy; no INSERT/UPDATE/DELETE policies — `supabase/migrations/20260427000000_phase17_catalog_schema.sql:156-160`. Sanity assertion at lines 174-204 fails migration if policy missing. Verified by `tests/integration/phase17-catalog-rls.test.ts` (8 tests). | closed |
| T-17-01-02 | Tampering | watches_catalog rows by authenticated user | mitigate | Same RLS shape — no INSERT/UPDATE/DELETE policies for `authenticated` role; PostgREST blocks writes. `supabase/migrations/20260427000000_phase17_catalog_schema.sql:156-160`. | closed |
| T-17-01-03 | Information disclosure | catalog rows readable by anon | accept | Documented Key Decision: catalog is non-PII spec data; intentional public-read RLS asymmetry (CAT-02). Captured in `.planning/PROJECT.md` v4.0 Phase 17 Key Decisions. | closed |
| T-17-01-04 | Tampering | watches_catalog_daily_snapshots by anon/authenticated | mitigate | RLS ENABLED + SELECT-only policy on snapshots — `supabase/migrations/20260427000000_phase17_catalog_schema.sql:165-169`. Sanity assertion confirms `watches_catalog_snapshots_select_all` policy. Verified by phase17-catalog-rls.test.ts. | closed |
| T-17-01-05 | Tampering | brand/model/reference normalization bypass via raw SQL | mitigate | DB-enforced GENERATED ALWAYS AS STORED columns — `supabase/migrations/20260427000000_phase17_catalog_schema.sql:36-65`. Even raw INSERTs compute normalized columns; UNIQUE NULLS NOT DISTINCT enforces dedup at DB level. Verified by `tests/integration/phase17-natural-key.test.ts`. | closed |
| T-17-01-06 | Denial of service | unbounded INSERT rate via legitimate channels | accept | Catalog writes are fire-and-forget from authenticated paths only (addWatch + /api/extract-watch); rate is bounded by user-driven CRUD frequency. Solo-collector use case (<500 watches per user). | closed |
| T-17-01-07 | Spoofing | source field forged to 'admin_curated' on first write | mitigate | DB CHECK constraint allows only the three literals — `supabase/migrations/20260427000000_phase17_catalog_schema.sql:73-77`. DAL hardcodes `'user_promoted'` (`src/data/catalog.ts:130`) and `'url_extracted'` (`src/data/catalog.ts:191`); no code path writes `admin_curated`. | closed |
| T-17-02-01 | Information disclosure / Tampering | image_source_url + image_url from URL extractor LLM | mitigate | `sanitizeHttpUrl()` in `src/data/catalog.ts:19-28` validates protocol === http: || https: before write; rejects `javascript:`, `data:`, `file:`, etc. Applied at lines 166-167. Verified by `tests/integration/phase17-upsert-coalesce.test.ts` "image_source_url rejects non-http" + `tests/integration/phase17-image-provenance.test.ts`. | closed |
| T-17-02-02 | Tampering / DoS | tag arrays from URL extractor LLM (style, design, role, complications) | mitigate | `sanitizeTagArray()` in `src/data/catalog.ts:35-42` filters non-strings, trims, drops empty/oversized strings (>64 chars), caps array length at 32. Applied to all 4 tag arrays at lines 169-172. | closed |
| T-17-02-03 | Tampering | linkWatchToCatalog called for another user's watch | mitigate | UPDATE WHERE includes `eq(watches.userId, userId)` AND `eq(watches.id, watchId)` — `src/data/watches.ts:227-230`. Cross-user link is silent no-op (zero rows updated). | closed |
| T-17-02-04 | Spoofing | source forged to 'admin_curated' via URL-extract path | mitigate | DAL hard-codes `'url_extracted'` literal in INSERT VALUES — `src/data/catalog.ts:191`. CASE guard at lines 202-205 also prevents downgrade if existing row is `admin_curated`. CHECK constraint backstops at DB level. Verified by phase17-upsert-coalesce.test.ts "admin_curated locked". | closed |
| T-17-02-05 | Tampering | concurrent INSERT race on same natural key | accept | ON CONFLICT ON CONSTRAINT DO NOTHING/DO UPDATE is atomic — Postgres serializes via the UNIQUE constraint `watches_catalog_natural_key`. Loser of race reads existing id via UNION ALL fallback in `upsertCatalogFromUserInput`. No new mitigation required. | closed |
| T-17-03-01 | Denial of service | Catalog wiring throws → addWatch fails → user can't add watch | mitigate | Inner try/catch around catalog wiring — `src/app/actions/watches.ts:70-81` (addWatch) and `src/app/api/extract-watch/route.ts:50-75`. Catalog failure logged via `console.error('[addWatch] catalog wiring failed (non-fatal)')` and swallowed; watch row committed regardless. Verified by `tests/actions/addwatch-catalog-resilience.test.ts` (3 tests). | closed |
| T-17-03-02 | Tampering | linkWatchToCatalog called with another user's watchId | mitigate | Inherited from T-17-02-03. Server Action's `user.id` comes from `getCurrentUser()` (auth-gated); linkWatchToCatalog WHERE includes `userId`. Defense-in-depth at action + DAL layers. | closed |
| T-17-03-03 | Information disclosure | URL-extract path leaks SSRF target via image_source_url | accept | `image_source_url` is the URL the user submitted (not the resolved IP). The SSRF check at `src/app/api/extract-watch/route.ts:40-44` is upstream of catalog write. Already hardened in v1.0 (SEC-01); no new disclosure surface in Phase 17. | closed |
| T-17-03-04 | Tampering | Image extractor LLM emits malicious image_url that flows into catalog | mitigate | Inherited from T-17-02-01. `sanitizeHttpUrl()` in DAL rejects non-http/https before write. | closed |
| T-17-03-05 | Repudiation | Failed catalog wiring leaves no audit trail | accept | `console.error` log on failure is acceptable for v4.0 (mirrors logActivity / logNotification fire-and-forget pattern). v5+ admin tooling can add an audit table if needed. | closed |
| T-17-04-01 | Tampering | Anon client invokes backfill | mitigate | Script reads service-role `DATABASE_URL` via `src/db` Drizzle client — `scripts/backfill-catalog.ts:14`. Anon SDK key irrelevant; running the script requires `.env.local` access (same trust as any service-role op). | closed |
| T-17-04-02 | Repudiation | Failed backfill leaves no audit trail | mitigate | Script logs every pass to `console.log` (`scripts/backfill-catalog.ts:65`) AND dumps unlinked rows via `console.table(unlinked)` on failure (line 79). Operator runs interactively. | closed |
| T-17-04-03 | Tampering | Backfill writes wrong catalog row to per-user watch | accept | Script scans `watches WHERE catalog_id IS NULL` per row and links each row to its OWN catalog match by natural key. Per-user `watches.user_id` is preserved untouched. Two users' Submariners correctly link to the SAME catalog row (CAT-11 source-of-truth split — by design). | closed |
| T-17-04-04 | Denial of service | Script runs forever on a stuck row | mitigate | WHERE filter shrinks every pass; loop exits when `rows.length === 0`. Final zero-unlinked assertion at `scripts/backfill-catalog.ts:69-81` forces `process.exit(1)` AND dumps unlinked rows for human review. Verified by phase17-backfill-idempotency.test.ts. | closed |
| T-17-04-05 | Spoofing | Script writes source='admin_curated' instead of 'user_promoted' | mitigate | Hardcoded literal `'user_promoted'` in INSERT VALUES — `scripts/backfill-catalog.ts:42`. DB CHECK constraint backstops. | closed |
| T-17-05-01 | Elevation of privilege | anon RPC call to refresh_watches_catalog_counts | mitigate | **Per project memory `project_supabase_secdef_grants.md`** — explicit `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC, anon, authenticated, service_role` (NOT just FROM PUBLIC) — `supabase/migrations/20260427000001_phase17_pg_cron.sql:70-71`. Then GRANT EXECUTE TO `service_role` ONLY (line 72-73). Sanity assertion at lines 78-95 RAISEs EXCEPTION if anon/authed retain EXECUTE. Verified live: anon=f, authed=f, service=t (verification report). | closed |
| T-17-05-02 | Elevation of privilege | authenticated user spam-triggers expensive count refresh | mitigate | Same REVOKE shape as T-17-05-01 — authenticated has no EXECUTE. Verified by `tests/integration/phase17-secdef.test.ts` "has_function_privilege" check. | closed |
| T-17-05-03 | Tampering | SECDEF function uses unsafe search_path; could call attacker functions | mitigate | `SET search_path = public, extensions` locks the search path inside function body — `supabase/migrations/20260427000001_phase17_pg_cron.sql:29`. Standard Postgres SECDEF hardening. | closed |
| T-17-05-04 | Tampering | refresh function modifies rows without RLS checks | accept | This IS the design: function bypasses RLS via SECDEF to refresh denormalized counts. The lockdown (T-17-05-01) ensures only service_role + pg_cron can invoke. Documented in `.planning/PROJECT.md`. | closed |
| T-17-05-05 | Denial of service | snapshot table grows unbounded | accept | D-17 retains snapshots indefinitely. ~5K catalog × 365 days × ~80 bytes/row = ~146MB/year — well within Supabase free tier. Future purge job deferred to ops phase. | closed |
| T-17-05-06 | Repudiation | failed cron run leaves no audit trail | accept | pg_cron logs failures to `cron.job_run_details` table (Supabase exposes via standard query). Operator can query post-hoc. Future: alert on failures, deferred to ops phase. | closed |
| T-17-05-07 | Spoofing | local script `npm run db:refresh-counts` invoked against prod by accident | mitigate | Script wired via `tsx --env-file=.env.local` in `package.json` — always loads LOCAL DB env vars. `docs/deploy-db-setup.md` section 17.5 documents "DO NOT run against prod". Memory `project_drizzle_supabase_db_mismatch.md` reinforces the rule. | closed |
| T-17-06-01 | Repudiation | Phase 17 deployed without runbook reference | mitigate | `docs/deploy-db-setup.md` updated with Phase 17 sections 17.1-17.6 (per Plan 06 SUMMARY): prod push order, backfill step, cron verify, SECDEF verify, footgun warning, backout plan. | closed |
| T-17-06-02 | Tampering | Operator runs backfill against LOCAL Docker by accident | mitigate | Footgun T-17-BACKFILL-PROD-DB documented in `docs/deploy-db-setup.md` section 17.2. Operator must explicitly export `DATABASE_URL=<prod>` in same shell. | closed |
| T-17-06-03 | Tampering | Operator runs db:refresh-counts against prod | accept | Function is idempotent (snapshot ON CONFLICT DO UPDATE). Section 17.5 documents the discipline rule, not a security boundary. | closed |
| T-17-06-04 | Information disclosure | Catalog rows visible to anon include image URLs | accept | Catalog is intentionally public-read (CAT-02). Image URLs are public on retailer pages; no PII or private data flows through catalog. PROJECT.md captures the privacy decision. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**Total threats:** 33
**Closed:** 33 / 33
**Open:** 0

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-17-01 | T-17-01-03 | Catalog rows are non-PII spec data; deliberate public-read RLS asymmetry enables /search Watches, /explore Trending, /search Collections, /evaluate?catalogId= without per-user gating. Captured in `.planning/PROJECT.md` v4.0 Phase 17 Key Decisions ("two-layer privacy departure"). | Phase 17 PLAN | 2026-04-27 |
| AR-17-02 | T-17-01-06 | Catalog INSERT rate bounded by authenticated user CRUD frequency; solo-collector MVP target <500 watches per user × N users. No abuse vector via legitimate addWatch / extract-watch paths. | Phase 17 PLAN | 2026-04-27 |
| AR-17-03 | T-17-02-05 | Postgres serializes ON CONFLICT via UNIQUE constraint atomically; concurrent inserts on same natural key are safe by design. UNION ALL fallback in `upsertCatalogFromUserInput` always returns id of winner. | Phase 17 PLAN | 2026-04-27 |
| AR-17-04 | T-17-03-03 | `image_source_url` is the user-submitted URL (not resolved IP). SSRF check at `/api/extract-watch` line 40-44 is upstream of catalog write; already hardened in v1.0 SEC-01. | Phase 17 PLAN | 2026-04-27 |
| AR-17-05 | T-17-03-05 | `console.error` log on catalog wiring failure is acceptable for v4.0 (mirrors existing logActivity / logNotification fire-and-forget pattern). v5+ admin tooling may add audit table. | Phase 17 PLAN | 2026-04-27 |
| AR-17-06 | T-17-04-03 | Backfill script links each watch row to ITS OWN natural-key match in catalog (per-user `watches.user_id` preserved). Two users' Submariners correctly converge on same catalog row — this is CAT-11 source-of-truth split by design. | Phase 17 PLAN | 2026-04-27 |
| AR-17-07 | T-17-05-04 | SECDEF function intentionally bypasses RLS to recompute denormalized counts. Lockdown (REVOKE from anon/authenticated/service_role + GRANT to service_role) ensures only pg_cron + service-role invoke. Captured in PROJECT.md. | Phase 17 PLAN | 2026-04-27 |
| AR-17-08 | T-17-05-05 | Snapshot table growth ~146MB/year worst case (5K catalog × 365 days × 80 bytes) — well within Supabase free tier. Future purge job deferred to ops phase. | Phase 17 PLAN | 2026-04-27 |
| AR-17-09 | T-17-05-06 | pg_cron logs to `cron.job_run_details` (standard Supabase view); operator can query failures post-hoc. Alerting deferred to ops phase. | Phase 17 PLAN | 2026-04-27 |
| AR-17-10 | T-17-06-03 | `refresh_watches_catalog_counts()` is idempotent (snapshot ON CONFLICT DO UPDATE); double-running against prod is harmless. Section 17.5 of deploy-db-setup.md is a discipline rule, not a security control. | Phase 17 PLAN | 2026-04-27 |
| AR-17-11 | T-17-06-04 | Image URLs in catalog are sourced from public retailer pages; no PII flows through catalog. Public-read RLS is the intentional design (CAT-02). | Phase 17 PLAN | 2026-04-27 |

*Accepted risks do not resurface in future audit runs.*

---

## Unregistered Threat Flags

None. All six SUMMARY.md files (`17-01-SUMMARY.md` through `17-06-SUMMARY.md`) report "## Threat Flags — None found." Every `<threat_flag>` in the in-flight notes maps to a registered threat above; no new attack surface emerged during implementation that wasn't pre-modeled.

---

## Project-Memory Cross-Checks

| Memory | Reference | Verification |
|--------|-----------|--------------|
| `project_supabase_secdef_grants.md` | "REVOKE FROM PUBLIC alone does not block anon. Supabase auto-grants direct EXECUTE to anon/authenticated/service_role on public-schema functions. Mitigation MUST explicitly REVOKE from each role." | **VERIFIED** — `supabase/migrations/20260427000001_phase17_pg_cron.sql:70-71`: `REVOKE EXECUTE ON FUNCTION public.refresh_watches_catalog_counts() FROM PUBLIC, anon, authenticated, service_role;` Each role explicitly REVOKE'd; not just PUBLIC. Sanity DO block at lines 78-95 RAISEs EXCEPTION if grants leak back. Live `has_function_privilege` matrix verified anon=f, authed=f, service=t. |
| `project_drizzle_supabase_db_mismatch.md` | "drizzle-kit push is LOCAL ONLY; prod migrations use `supabase db push --linked`" | **VERIFIED** — `docs/deploy-db-setup.md` Phase 17 section 17.1 documents `supabase db push --linked` for prod. Section 17.5 explicitly warns against local npm scripts targeting prod. |
| `project_drizzle_supabase_db_mismatch.md` Rule 3 | "Schema-qualify extension opclasses" | **VERIFIED** — `supabase/migrations/20260427000000_phase17_catalog_schema.sql:127, 129` use `extensions.gin_trgm_ops` schema-qualified form. |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-27 | 33 | 33 | 0 | gsd-secure-phase (Claude) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter
- [x] Project-memory hardenings (SECDEF grants, schema-qualified opclasses, prod-vs-local DB rules) cross-checked

**Approval:** verified 2026-04-27
