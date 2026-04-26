# Phase 16 People Search — Security Verification

**Phase:** 16 — people-search
**Verified:** 2026-04-25
**ASVS Level:** L1
**Block-on:** high+critical
**Result:** SECURED — 14/14 threats closed, 0 unregistered flags

---

## Threat Verification Summary

| ID | Category | Disposition | Status | Evidence |
|----|----------|-------------|--------|----------|
| T-16-01 | Tampering (SQLi) | mitigate | CLOSED | `src/data/search.ts:70` `or(ilike(profiles.username, pattern), ilike(profiles.bio, pattern))` and `:71` `ilike(profiles.username, pattern)` — Drizzle parameterized binds; `:65` pattern is `\`%${trimmed}%\`` but never reaches `sql\`...\`` interpolation (only fed to `ilike()` ORM helper which parameterizes). The single `sql\`...\`` template in the file (`:87`) is `sql\`${profiles.id} != ${viewerId}\`` — `viewerId` is a server-derived UUID from `getCurrentUser()` (see `src/app/actions/search.ts:53`), not user input. NO `sql\`%${q}%\`` interpolation present. |
| T-16-01b | Tampering (Zod bypass / mass assignment) | mitigate | CLOSED | `src/app/actions/search.ts:13-17` `z.object({ q: z.string().max(200) }).strict()`; `:45` `searchSchema.safeParse(data)`; `:47` `return { success: false, error: 'Invalid request' }` — generic message, no Zod issue leakage. |
| T-16-02 | Tampering / Stored XSS via bio | mitigate | CLOSED | Confirmed zero `dangerouslySetInnerHTML` occurrences across `src/components/search/` (grep returned no files). `src/components/search/HighlightedText.tsx:31` `text.split(re)` produces string array; `:36-42` emits `<strong>` and `<Fragment>` React nodes only — React auto-escapes text content. Bio renders as text even if it contains `<script>`. |
| T-16-03 | Information Disclosure (private profile leak) | mitigate | CLOSED | `src/data/search.ts:86` `eq(profileSettings.profilePublic, true)` predicate inside `and(...)` WHERE clause. Cross-DAL parity: `src/data/suggestions.ts:104` also enforces `eq(profileSettings.profilePublic, true)` in `getSuggestedCollectors`. Both DALs that surface profiles in /search gate on `profile_public = true`. |
| T-16-04 | DoS (search-driven DB load) | mitigate | CLOSED | Multi-layer defense verified: `useSearchState.ts:9` `DEBOUNCE_MS = 250`; `:10` `CLIENT_MIN_CHARS = 2` enforced at `:83`; `src/data/search.ts:14` `TRIM_MIN_LEN = 2` enforced at `:62-63` (server gate, D-20); `:91` `.limit(CANDIDATE_CAP)` (50-row pre-LIMIT cap, Pitfall 5); `:156` `ordered.slice(0, limit)` final 20-row trim; `useSearchState.ts:90,113` `AbortController` + `controller.abort()` cleanup; `src/app/actions/search.ts:39-43` `getCurrentUser()` auth gate before DAL invocation. |
| T-16-04b | DoS (effect storm under React 19 Strict Mode double-effect) | accept | CLOSED | No implementation regression. `useSearchState.ts:59-62` debounce effect cleanup clears the timer on each rerun; `:73-114` fetch effect cleanup at `:113` calls `controller.abort()`. Cleanup-before-next-effect ordering preserved per Plan 03 RESEARCH.md Pitfall 3. AbortController behavior is well-defined under Strict Mode double-effect; documented acceptance still valid. |
| T-16-05 | DoS (regex catastrophic backtracking in highlight) | mitigate | CLOSED | `src/components/search/HighlightedText.tsx:28` `const escapedQ = trimmedQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` escapes regex metacharacters; `:29` `const re = new RegExp(\`(${escapedQ})\`, 'gi')` — capture group of literal-q only; no quantifier-on-quantifier patterns possible. |
| T-16-06 | Tampering (self-follow / self-row exploitation) | mitigate | CLOSED | `src/data/search.ts:87` `sql\`${profiles.id} != ${viewerId}\`` — viewer self-exclusion in WHERE clause inside `and(...)`. `viewerId` is a server-derived UUID from `getCurrentUser()` (cannot be tampered by the client). |
| T-16-07 | DoS / performance (N+1 follow lookup) | mitigate | CLOSED | `src/data/search.ts:159-170` — single batched `inArray(follows.followingId, topIds)` query AFTER the slice at `:156`. Exactly one follows-table SELECT regardless of result count (verified by Plan 02 Test 11). |
| T-16-08 | Tampering (CSRF on Server Action + XSS via search-form URL) | mitigate | CLOSED | `src/app/actions/search.ts:1` `'use server'` — Next 16 built-in origin-header CSRF protection on Server Actions. `:39-43` `getCurrentUser()` auth gate fails closed with 'Not authenticated'. `src/components/layout/DesktopTopNav.tsx:59` `window.location.href = \`/search?q=${encodeURIComponent(q)}\`` — query string properly encoded; cannot inject ` ` or path traversal characters. |
| T-16-build | DoS (broken-import build failure) | mitigate | CLOSED | `src/components/layout/HeaderNav.tsx` and `tests/components/layout/HeaderNav.test.tsx` both confirmed absent on disk (`ls` returns ENOENT). `Grep for "from '@/components/layout/HeaderNav'"` across `src/` and `tests/` returns ZERO matches; only references are in `.planning/` plan/research docs (informational, not compiled). Build invariant preserved. |
| T-16-vis | Information Disclosure (visual leak of actor identity) | accept | CLOSED | `src/components/layout/DesktopTopNav.tsx:103` still renders `<UserMenu user={user} username={username} />` (pre-existing surface). No new disclosure introduced — accepted per Phase 16 plan rationale. |
| T-16-render | Information Disclosure (prerender bailout) | mitigate | CLOSED | `src/app/search/page.tsx:30` `<Suspense fallback={...}>` wraps `<SearchPageClient>` (which calls `useSearchParams()` via `useSearchState`). Prerender produces only the empty fallback shell; no auth-bound state reaches the static HTML. |
| T-16-MANUAL-01 | Performance / DoS (Seq Scan instead of Bitmap Index Scan at scale) | mitigate | CLOSED | `.planning/phases/16-people-search/16-VERIFICATION.md:151-260` "Pitfall C-1 Evidence" section. Forced-plan EXPLAIN ANALYZE (`SET enable_seqscan = off`) confirms `Bitmap Index Scan on profiles_username_trgm_idx` (line 200) and `Bitmap Index Scan on profiles_bio_trgm_idx` (line 233). Both indexes are on disk, defined with `gin_trgm_ops`, and reachable by the planner — natural-plan Seq Scan at 127 rows is expected small-table cost behavior. |

---

## Mitigation Categories Verified

### Tampering (4 threats — all CLOSED)
- **SQL injection** — Drizzle parameterized `ilike()` + only `viewerId` interpolated in single `sql\`\``
- **Mass assignment** — Zod `.strict()` + `safeParse` + generic error
- **Self-row exploitation** — `profiles.id != viewerId` predicate
- **CSRF on Server Action** — Next 16 origin-header protection + auth gate + `encodeURIComponent` on form URL

### Information Disclosure (3 threats — all CLOSED)
- **Private profile leak** — Two-DAL `profile_public = true` enforcement (search.ts + suggestions.ts)
- **Stored XSS via bio** — Zero `dangerouslySetInnerHTML`; HighlightedText emits React nodes only
- **Prerender bailout** — `<Suspense>` wrapper at page boundary

### Denial of Service (5 threats — all CLOSED)
- **Search-driven DB load** — debounce + 2-char client/server gates + 50/20 row caps + AbortController + auth gate
- **React 19 Strict Mode effect storm** — accepted; AbortController behavior verified
- **Regex catastrophic backtracking** — metacharacter escape in HighlightedText
- **N+1 follow lookup** — batched `inArray()` post-slice
- **Index Seq Scan at scale** — EXPLAIN ANALYZE evidence captured (forced + natural plans)

### Build Integrity (1 threat — CLOSED)
- **Broken-import build failure** — HeaderNav.tsx and test file deleted, zero residual importers

---

## Accepted Risks Log

| ID | Description | Rationale | Date |
|----|-------------|-----------|------|
| T-16-04b | React 19 Strict Mode double-effect may cause brief duplicate timer/abort cycles in dev only | Cleanup-before-next-effect guarantees stale fetches never reach state; documented in Plan 16-03 RESEARCH.md Pitfall 3; production builds run effects once. | 2026-04-25 |
| T-16-vis | DesktopTopNav UserMenu surfaces username + avatar to authenticated viewer | Pre-existing surface from Phase 14; Phase 16 introduced no new disclosure. UserMenu visibility itself is gated by authenticated session. | 2026-04-25 |

---

## Unregistered Flags

None. SUMMARY.md files for plans 16-01 through 16-05 contain no `## Threat Flags` entries beyond what is already mapped to T-16-01 .. T-16-MANUAL-01.

---

## Implementation Files Verified (read-only)

- `src/data/search.ts` (174 lines)
- `src/app/actions/search.ts` (61 lines)
- `src/components/search/HighlightedText.tsx` (46 lines)
- `src/components/search/PeopleSearchRow.tsx` (112 lines)
- `src/components/search/useSearchState.ts` (119 lines)
- `src/components/search/SearchPageClient.tsx` (223 lines)
- `src/app/search/page.tsx` (70 lines)
- `src/components/layout/DesktopTopNav.tsx` (108 lines)
- `src/data/suggestions.ts` (177 lines)
- `src/components/layout/HeaderNav.tsx` — ABSENT (deletion verified)
- `tests/components/layout/HeaderNav.test.tsx` — ABSENT (deletion verified)

No implementation files modified by this audit.
