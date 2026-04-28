---
phase: 19
slug: search-watches-collections
status: verified
threats_open: 0
asvs_level: 1
created: 2026-04-28
---

# Phase 19 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Client → Server Action | Untrusted POST payload via Next.js Server Action transport (CSRF-protected by built-in token) | `q` (user-controlled string), `tab` (URL param) |
| Server Action → DAL | `viewerId` from `getCurrentUser()` server-side session lookup; `q` Zod-validated | viewerId (uuid), q (≤200 chars) |
| DAL → Postgres | Drizzle parameterized template-tag binds only; no string concat into SQL | parameterized values |
| Postgres → DAL | RLS on `profiles` second privacy layer; DAL WHERE first | profile rows (filtered by privacy flags) |
| Server data → Component props | Catalog text + URLs + UUIDs flow into row props | brand/model/reference, imageUrl, catalogId, collector text |
| Component props → React JSX | `q` flows into `<HighlightedText>`; collector/catalog text into rendered children | text only — no `dangerouslySetInnerHTML` anywhere in `src/components/search/` |
| Component → Browser URL | `catalogId` → `/evaluate?catalogId={uuid}`; `username` → `/u/{username}/collection` | server-controlled UUIDs + DB-validated usernames |
| Hook → Server Action | Debounced `q` flows into 3 separate Server Actions; per-section AbortController cancels in-flight on tab/q change | `q`, `tab`, signal |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-19-01-01 | Tampering | `searchCatalogWatches` q parameterization | mitigate | `src/data/catalog.ts:310-314` — Drizzle `or(ilike(brandNormalized, pattern), ...)` template binds; reference normalization JS-side before bind | closed |
| T-19-01-02 | Tampering | `searchCollections` raw SQL CTE q parameterization | mitigate | `src/data/search.ts:236-293` — all 5 ILIKE binds + viewerId bind use Drizzle `${pattern}` / `${viewerId}` template-tag interpolation | closed |
| T-19-01-03 | Information Disclosure | Two-layer privacy (collection_public=false collector leaking) | mitigate | `src/data/search.ts:257-258` — `ps.profile_public = true AND ps.collection_public = true`; regression-locked by `tests/integration/phase19-collections-privacy.test.ts` Profile B seed | closed |
| T-19-01-04 | Information Disclosure | Viewer-self in results | mitigate | `src/data/search.ts:259` — `AND p.id != ${viewerId}` | closed |
| T-19-01-05 | Information Disclosure | DAL error strings leaking schema/columns | mitigate | DAL throws plain `Error`; Server Action layer (T-19-02-04) catches and returns generic copy | closed |
| T-19-01-06 | DoS | Unbounded q length causing ILIKE slowness | mitigate | `src/app/actions/search.ts:18-22` Zod `.max(200).strict()`; DAL `trim().length<2` early-return; LIMIT 50/20 caps | closed |
| T-19-01-07 | Tampering | inArray empty degenerate IN clause | mitigate | `src/data/catalog.ts:332-345` — `topIds.length` length-guard short-circuits before second query | closed |
| T-19-01-08 | Information Disclosure (UX) | Anti-N+1 wrong viewerState across rapid sessions | mitigate | Single `inArray(watches.catalogId, topIds)` keyed by `viewerId`; Test 6 asserts exactly 2 `db.select()` calls | closed |
| T-19-01-09 | DoS | ReDoS via reference-normalization regex | accept | Acceptance holds: `/[^a-z0-9]+/g` linear in q; q bounded to 200 chars by `searchSchema.max(200)` | closed |
| T-19-02-01 | Spoofing | Unauthenticated Server Action call | mitigate | `src/app/actions/search.ts:43-48, 84-89, 120-125` — `getCurrentUser()` before Zod parse + DAL | closed |
| T-19-02-02 | Tampering | Mass-assignment via extra payload keys | mitigate | Zod `.strict()` rejects unknown keys; `viewerId: user.id` from session at lines 58, 99, 135 | closed |
| T-19-02-03 | DoS | Unbounded q payload | mitigate | `src/app/actions/search.ts:20` `z.string().max(200)` + `safeParse` at lines 50, 91, 127 | closed |
| T-19-02-04 | Information Disclosure | DAL exception leaking schema details to client | mitigate | `src/app/actions/search.ts:62-65, 103-106, 139-142` — try/catch returns generic `"Couldn't run search."`; `console.error` server-side; Test 5 asserts no "postgres"/"column" in client body | closed |
| T-19-02-05 | Tampering (CSRF) | POST Server Action | transfer | Inherited Next.js 16 Server Action token framework protection; `'use server'` directive at `src/app/actions/search.ts:1` | closed |
| T-19-02-06 | Repudiation | Server-side error log retention | accept | Acceptance holds: `console.error` to Vercel logs sufficient at v4.0 single-user MVP scale | closed |
| T-19-02-07 | Information Disclosure | Authenticated user enumerating private collections | mitigate | Upstream DAL two-layer privacy (T-19-01-03) + RLS on `profiles` | closed |
| T-19-03-01 | Tampering (XSS) | Highlighted brand/model/reference render | mitigate | `src/components/search/HighlightedText.tsx:28` regex-escapes q; React text children only; `WatchSearchRow.tsx:67, 71` wraps; 0 `dangerouslySetInnerHTML` in `src/components/search/` | closed |
| T-19-03-02 | Tampering | Image src injection (catalog imageUrl) | mitigate | `src/data/catalog.ts:20-29` `sanitizeHttpUrl()` write-time; `WatchSearchRow.tsx:53-60` `next/image unoptimized`; `next.config.ts:9-11` `images.unoptimized: true` | closed |
| T-19-03-03 | Tampering | catalogId UUID into `/evaluate?catalogId=` href | mitigate | `WatchSearchRow.tsx:43-46` — server-side UUID; Next `<Link>` encodes | closed |
| T-19-03-04 | Information Disclosure | viewerState pill leakage across viewers | mitigate | Upstream — DAL viewerState hydration keyed by `viewerId`; UI renders only | closed |
| T-19-03-05 | DoS (ReDoS) | HighlightedText regex | accept | Acceptance holds: regex-escape + 200-char bound | closed |
| T-19-04-01 | Tampering (XSS) | Collector displayName/username/matchedWatches text | mitigate | `CollectionSearchRow.tsx:60` `<HighlightedText>`; tag pills `{t}` text children at line 96; 0 `dangerouslySetInnerHTML` | closed |
| T-19-04-02 | Tampering | username injection into `/u/{username}` href | accept | Acceptance holds: DB-constraint-validated username format (Phase 7); Next `<Link>` path-segment encoding | closed |
| T-19-04-03 | Information Disclosure | Private collector display | mitigate | Upstream DAL two-layer privacy (T-19-01-03) | closed |
| T-19-04-04 | Tampering | matchedWatches imageUrl injection | mitigate | Upstream `sanitizeHttpUrl` + `next/image unoptimized` + `next.config.ts` allowlist | closed |
| T-19-04-05 | DoS | Long matchedTags array bloating render | mitigate | `src/data/search.ts:364` DAL caps to 5; `CollectionSearchRow.tsx:91` UI `slice(0, 3)` | closed |
| T-19-04-06 | DoS (ReDoS) | HighlightedText regex (collections row) | accept | Acceptance holds: same as T-19-03-05 | closed |
| T-19-05-01 | Information Disclosure (UX) | Cross-tab result leakage on rapid tab switch | mitigate | `src/components/search/useSearchState.ts:123, 167, 211` — 3 `AbortController`s; 9 `signal.aborted` guards; cleanup `controller.abort()` at 148, 192, 236; deps `[debouncedQ, tab]` | closed |
| T-19-05-02 | Information Disclosure (UX) | Stale q result overwriting newer | mitigate | Same controller pattern; deps include `debouncedQ` | closed |
| T-19-05-03 | DoS | All-tab fan-out triples request load | accept | Acceptance holds at v4.0 MVP scale; each action enforces auth + max-200 | closed |
| T-19-05-06 | Spoofing | Unauthenticated user reaching `/search` | mitigate | `src/proxy.ts:11-15` redirects unauthenticated to `/login`; `/search` not in `PUBLIC_PATHS`; per-action `getCurrentUser()` defense-in-depth | closed |
| T-19-05-07 | Tampering | Malformed `tab` URL param | mitigate | `useSearchState.ts:109, 153, 197` — explicit predicate against 4 known tab values; unknown silently no-fetch | closed |
| T-19-06-01 | Tampering | Caller passes over-cap result array | mitigate | `src/components/search/AllTabResults.tsx:65-67` — 3 defensive `slice(0, ALL_TAB_SECTION_CAP)`; See-all conditions at 73, 96, 114 reference capped vars; Tests 6+7 regression-lock | closed |
| T-19-06-02 | Tampering (XSS) | debouncedQ flowing through HighlightedText | mitigate | All 3 row components reuse `<HighlightedText>`; grep across `src/components/search/` returns 0 `dangerouslySetInnerHTML` | closed |
| T-19-06-03 | Information Disclosure | Privacy leak in Collections section of All tab | mitigate | Upstream DAL two-layer privacy (T-19-01-03) | closed |
| T-19-06-04 | Spoofing | Unauthenticated user reaching the page | mitigate | `src/proxy.ts` page auth gate + per-action `getCurrentUser()` | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-19-01 | T-19-01-09 | ReDoS via `/[^a-z0-9]+/g` is non-issue: regex is linear in q length and has no catastrophic backtracking pattern; q bounded to 200 chars by `searchSchema.max(200)` at action layer | Tyler Waneka | 2026-04-28 |
| AR-19-02 | T-19-02-06 | Server-side error log retention via `console.error` to Vercel logs is sufficient at v4.0 single-user MVP scale; structured logging infra deferred | Tyler Waneka | 2026-04-28 |
| AR-19-03 | T-19-03-05 | ReDoS in HighlightedText regex already mitigated in Phase 16 (regex-escape of q); q bounded to 200 chars | Tyler Waneka | 2026-04-28 |
| AR-19-04 | T-19-04-02 | Username href injection bounded by DB constraint on username format (Phase 7 profiles schema) + Next Link path-segment encoding; malformed `/u/../admin/collection` would 404 | Tyler Waneka | 2026-04-28 |
| AR-19-05 | T-19-04-06 | Same as AR-19-03 — HighlightedText ReDoS mitigated in Phase 16; 200-char bound | Tyler Waneka | 2026-04-28 |
| AR-19-06 | T-19-05-03 | All-tab fan-out (3 Server Actions per query) within Vercel + Supabase free-tier rate limits at v4.0 single-user MVP scale; revisit via single `searchAllAction` if usage scales | Tyler Waneka | 2026-04-28 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-28 | 36 | 36 | 0 | gsd-security-auditor (Phase 19 retroactive) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-04-28
