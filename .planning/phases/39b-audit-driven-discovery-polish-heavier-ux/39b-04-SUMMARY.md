---
phase: 39b-audit-driven-discovery-polish-heavier-ux
plan: 04
subsystem: data-access + ui
tags: [drizzle, next-16, server-rsc, two-layer-privacy, t-39b-01, t-39b-04, vitest, integration-test, nsv-18]

# Dependency graph
requires:
  - phase: 39b-02
    provides: /catalog/[catalogId]/page.tsx mount surface pattern (ReferenceIdentityCard sibling composition; verdict-card → [Plan 04 slot] → [Plan 05 slot] → CTAs render order)
  - phase: 39b-01
    provides: scripts/seed-bootstrap-2026-05-13.sql produced 100 catalog rows that getCollectorsForCatalog reads (informational dependency — DAL works against empty catalog tables too)
provides:
  - getCollectorsForCatalog DAL in src/data/discovery.ts (NEW export — joins watches × profiles × profile_settings with two-layer privacy + viewer self-exclusion + sold-status filter + JS dedup + separate count(DISTINCT) totalCount query)
  - CatalogCollector interface in src/data/discovery.ts (NEW export — projected row shape for the roster: userId, username, displayName, avatarUrl)
  - OtherOwnersRoster Server Component in src/components/insights/OtherOwnersRoster.tsx (NEW — pure presentation chip row; hide-if-empty; count label gated on totalCount > 5; absolute-inset Link click surface; AvatarDisplay size=40 Pitfall 1 substitution)
  - Integration test tests/data/getCollectorsForCatalog.test.ts (6 tests — privacy edges T-39b-01 layers 1+2, T-39b-04 self-exclusion, A1 sold-filter, D-39b-10 ORDER BY DESC, Pitfall 3 dedup)
  - /catalog/[catalogId]/page.tsx mount — getCollectorsForCatalog fetch inside Promise.all + OtherOwnersRoster JSX between the verdict card and the SameFamilyRail placeholder
affects: [39b-05, future-roster-pagination-v5x, future-avatar-primitive-size-36]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-layer privacy gate on DAL — eq(profileSettings.profilePublic, true) AND eq(profileSettings.collectionPublic, true) — load-bearing for any cross-user catalog/collection read since service-role pooler bypasses RLS. D-39b-09 NEW second-layer gate does not exist in getMostFollowedCollectors (Phase 18 DAL precedent — single-layer)."
    - "Separate count(DISTINCT) totalCount query with IDENTICAL WHERE clause (Pitfall 4) — totalCount cannot be derived from rows.length when rows are dedup'd AND limited; the only correct shape is two queries. Reusable pattern for any 'top-N + total count' DAL."
    - "JS-side dedup loop after SQL ORDER BY desc(...) (Pitfall 3) — for any DAL where a single user can have multiple rows on the same target entity (here: owned + wishlist on same catalog); overfetch at SQL LIMIT 50 then keep first-seen via Set, slice to top-N."
    - "Server-only DAL → Server Component → page mount triad — getCollectorsForCatalog (server-only DAL) → OtherOwnersRoster (no 'use client') → /catalog/[catalogId]/page.tsx mount. Component self-hides when collectors.length === 0 so caller wrappers are unnecessary."
    - "Test-mock cascade lesson — when a Server Component page imports a new DAL from another module, EVERY page-level test that uses a shallow `vi.mock('@/db')` will break with 'innerJoin is not a function' the moment the new DAL hits a JOIN-heavy chain. Fix is `vi.mock('@/data/discovery')` with a stable default — NOT extending the @/db mock to enumerate every Drizzle method."

key-files:
  created:
    - tests/data/getCollectorsForCatalog.test.ts (312 lines, 6 it() blocks, maybe-gate via hasDrizzle && hasSupabaseAdmin)
    - src/components/insights/OtherOwnersRoster.tsx (85 lines, Server Component, JSDoc references T-39b-01/T-39b-04 + Pitfall 1)
  modified:
    - src/data/discovery.ts (285 → 398 lines; +113 lines for CatalogCollector interface + getCollectorsForCatalog function + JSDoc block; existing exports byte-untouched)
    - src/app/catalog/[catalogId]/page.tsx (211 → 232 lines; +OtherOwnersRoster import + getCollectorsForCatalog import + Promise.all extension to 6 fetches + JSX mount replacing the Plan 39b-04 placeholder comment)
    - tests/app/catalog-page.test.ts (213 → 234 lines; Rule 1 auto-fix — vi.mock('@/data/discovery') + mockGetCollectorsForCatalog default in beforeEach to keep the 8 existing verdict/CTA tests green after Task 4 mount)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-VALIDATION.md (rows 04-T1..T4 marked ✅ green with per-task commit refs + grep counts)

key-decisions:
  - "T-39b-01 mitigation literal: BOTH eq(profileSettings.profilePublic, true) AND eq(profileSettings.collectionPublic, true) appear in BOTH the rows query and the count(DISTINCT) totalCount query. Layer 1 mirrors Phase 18 D-09. Layer 2 (D-39b-09 NEW) does not exist in getMostFollowedCollectors and is the load-bearing add for NSV-18. Integration tests #1 + #2 prove each layer independently when SUPABASE_SERVICE_ROLE_KEY env is present."
  - "T-39b-04 mitigation literal: sql`${profiles.id} != ${viewerId}` (search.ts:87 canonical) on BOTH queries. Integration test #3 proves viewer self-exclusion."
  - "Q1 verdict / A1 SHIPPED: inArray(watches.status, ['owned', 'wishlist', 'grail']) excludes 'sold'. Semantics match 'X collectors own this' copy — a sold watch is not currently owned. Integration test #4 proves the exclusion."
  - "Pitfall 1 / A4 deviation SHIPPED: UI-SPEC §NSV-18 specifies AvatarDisplay size=36, but the primitive only accepts a literal union of 40/64/96. Substituted size={40} per RESEARCH A4 RECOMMEND. The 64px chip width (w-16) accommodates the 40px avatar with breathing room. Primitive extension to add size=36 deferred to a follow-up patch if real-world chip rows feel too large."
  - "Rule 1 auto-fix applied: tests/app/catalog-page.test.ts shallow vi.mock('@/db') only mocks select().from().where().limit() — the new getCollectorsForCatalog call from the page's Promise.all hits db.innerJoin which isn't in the mock. Fix: vi.mock('@/data/discovery') with mockGetCollectorsForCatalog defaulting to { collectors: [], totalCount: 0 } in beforeEach. Net regression delta 0 (pre-plan 53 failed → post-Task-4 53 failed)."

patterns-established:
  - "Pattern: any new DAL imported by /catalog/[catalogId]/page.tsx via Promise.all must be vi.mock'd in tests/app/catalog-page.test.ts with a sensible empty-state default. Future plans extending the page should anticipate this and update the test in the SAME commit as the import (Rule 1 auto-fix shipped as belt-and-suspenders this plan)."
  - "Pattern: privacy-gated cross-user reads always shape as { rows query + count(DISTINCT) totalCount query } with IDENTICAL WHERE clause. The DRY violation (two near-identical WHERE blocks) is intentional — defense against future refactors that might drift the two queries' filter conditions and introduce a privacy hole."
  - "Pattern: a Server Component (`OtherOwnersRoster`) that consumes a DAL type (`CatalogCollector`) imports the type via `import type { CatalogCollector } from '@/data/discovery'` — proves at the type-system level that the component's data dependency is the DAL contract. Establishes a one-way arrow Page → DAL → Component-Props that future plans can rely on."

requirements-completed: [DISC-11]

# Metrics
duration: 14m 40s
completed: 2026-05-13
---

# Phase 39b Plan 04: NSV-18 Catalog Other-Owners Roster Summary

**Catalog other-owners roster on `/catalog/{id}` — getCollectorsForCatalog DAL with two-layer privacy + self-exclusion + sold-filter + JS dedup + separate totalCount query; OtherOwnersRoster Server Component renders compact avatar+@username chip row with hide-if-empty and count label only when totalCount exceeds 5.**

## Performance

- **Duration:** 14 min 40 sec
- **Started:** 2026-05-13T18:27:32Z
- **Completed:** 2026-05-13T18:42:12Z
- **Tasks:** 4 (+ 1 Rule 1 auto-fix on test infrastructure inside Task 4)
- **Files modified:** 4 (2 new — 1 test + 1 component; 2 modified — DAL + page)
- **Commits:** 4 task commits

## Accomplishments

- **DAL shipped (Task 2 / 3ec0f4a):** `getCollectorsForCatalog(catalogId, viewerId, opts?)` exports from `src/data/discovery.ts`. Joins `watches × profiles × profile_settings`. Returns `{ collectors: CatalogCollector[]; totalCount: number }`. Defaults to top 5 collectors ordered by `desc(watches.createdAt), asc(profiles.username)` (D-39b-10 liveness signal + alphabetical tiebreaker).
- **Two-layer privacy literal (verbatim from src/data/discovery.ts:228-233 rows query):**
  ```typescript
  .where(
    and(
      eq(watches.catalogId, catalogId),
      eq(profileSettings.profilePublic, true),    // T-39b-01 layer 1
      eq(profileSettings.collectionPublic, true), // T-39b-01 layer 2 (D-39b-09 NEW)
      sql`${profiles.id} != ${viewerId}`,         // T-39b-04 self-exclusion
      inArray(watches.status, ['owned', 'wishlist', 'grail']), // A1 / Q1 — exclude sold
    ),
  )
  ```
  The same `WHERE` block appears on the `count(DISTINCT profiles.id)::int` totalCount query at lines 247-252 — both queries enforce both privacy layers and the sold filter so the totalCount label cannot drift from the row set.
- **Component shipped (Task 3 / c10a2d2):** `OtherOwnersRoster` Server Component (no `'use client'`). Returns `null` when `collectors.length === 0` (D-39b-07 / D-39b-09 hide-if-empty). Count label `"{totalCount} collectors own this"` renders ONLY when `totalCount > 5`. Chip row: `flex gap-2 overflow-x-auto scroll-smooth pb-1` with `w-16 shrink-0 flex-col` chips, absolute-inset `<Link>` click surface + `focus-visible:ring-2 ring-ring` a11y focus ring, AvatarDisplay `size={40}`, `@${c.username}` text.
- **Page mount shipped (Task 4 / bc557bb):** `src/app/catalog/[catalogId]/page.tsx` Promise.all extended from 5 → 6 fetches; `OtherOwnersRoster` JSX mounted between the verdict-card block (CollectionFitCard / ReferenceIdentityCard / fallback caption) and the SameFamilyRail placeholder (UI-SPEC §Render Order position #2). `/watch/{id}` unchanged — `grep -c "OtherOwnersRoster" 'src/app/watch/[id]/page.tsx'` = 0 (NSV-18 is catalog-only per UI-SPEC §Render Order line 288).
- **Integration test transition (Task 1 / 1d2e4a4 — RED → Task 2 / 3ec0f4a — GREEN):**
  - RED state proof (pre-Task-2 tsc): 11 errors on `tests/data/getCollectorsForCatalog.test.ts` for `Property 'getCollectorsForCatalog' does not exist on type 'typeof import("…/discovery")'` plus implicit-any cascades. Total tsc 39 (28 baseline + 11 RED).
  - GREEN state proof (post-Task-2 tsc): all 11 RED errors resolved → tsc 28 (back to project baseline). The 6 it() blocks compile cleanly against the DAL contract.
  - Local run state: tests SKIP via `maybe = hasDrizzle && hasSupabaseAdmin ? describe : describe.skip` because `.env.local` ships only `NEXT_PUBLIC_SUPABASE_ANON_KEY` (newer Supabase CLI uses `Publishable` + `Secret` naming, not the legacy `anon` + `service_role`). The 6 tests are GREEN-ready and will execute the moment a runtime carrying `SUPABASE_SERVICE_ROLE_KEY` invokes the suite. This matches the plan's literal AC: "When env is unset: tests skip via maybe-gate; exit 0".
- **Rule 1 auto-fix (Task 4 / bc557bb same commit):** `tests/app/catalog-page.test.ts` shallow `vi.mock('@/db')` only mocks the `select().from().where().limit()` chain — Task 4's new `getCollectorsForCatalog` import from `@/data/discovery` calls `db.select().from(...).innerJoin(...)` which isn't in the mock, breaking all 8 D-10 page tests with `db.select(...).from(...).innerJoin is not a function`. Fix: `vi.mock('@/data/discovery', () => ({ getCollectorsForCatalog: mockGetCollectorsForCatalog }))` + `mockGetCollectorsForCatalog.mockResolvedValue({ collectors: [], totalCount: 0 })` in `beforeEach`. Net regression delta: 0 (pre-plan baseline 53 failed → post-Task-4 53 failed).

## Task Commits

Each task committed atomically (no `--no-verify`, normal hooks):

1. **Task 1: Write integration test for getCollectorsForCatalog (RED)** — `1d2e4a4` (test)
2. **Task 2: Implement getCollectorsForCatalog DAL (GREEN)** — `3ec0f4a` (feat)
3. **Task 3: Create OtherOwnersRoster Server Component** — `c10a2d2` (feat)
4. **Task 4: Mount OtherOwnersRoster on /catalog/{id} + Rule 1 auto-fix in catalog-page.test.ts** — `bc557bb` (feat)

**Plan metadata commit:** pending (this SUMMARY + STATE/ROADMAP/VALIDATION advance).

## Render Order Verification

`/catalog/{id}` JSX render order (verified by reading `src/app/catalog/[catalogId]/page.tsx:155-225`):

```
1. <div className="flex items-start gap-4"> — image + title block
2. {verdict && <CollectionFitCard verdict={verdict} />} — Phase 20 D-04 cross-user verdict
3. {collection.length === 0 && catalogTaste && ... && <ReferenceIdentityCard taste={catalogTaste} />} — Phase 39b NSV-20 fresh-account high-confidence
4. {collection.length === 0 && (!catalogTaste || ...) && <p>Add a few watches…</p>} — Phase 39b NSV-20 fresh-account low-confidence fallback caption
5. <OtherOwnersRoster collectors={roster.collectors} totalCount={roster.totalCount} /> — Phase 39b NSV-18 (THIS PLAN)
6. {/* Plan 39b-05 mounts SameFamilyRail + LineageRail here */} — Phase 39b NSV-02/16 placeholder
7. {actionsSpec && <CatalogPageActions … />} — Phase 20.1 D-05 + Phase 39b NSV-20 3-CTA block
```

`/watch/{id}` render order unchanged — NSV-18 catalog-only per UI-SPEC §Render Order line 288.

## T-39b-01 + T-39b-04 Mitigation Proof

- **T-39b-01 layer 1 (Information Disclosure of private profile):** Integration test #1 `excludes private-profile users (T-39b-01 layer 1)` — seeds a profile with `profilePublic: false`, inserts a watches row, asserts the DAL returns `{ collectors: [], totalCount: 0 }`. Command (when env present): `set -a; source .env.local; set +a; npx vitest run tests/data/getCollectorsForCatalog.test.ts -t "layer 1"`.
- **T-39b-01 layer 2 (Information Disclosure of private collection):** Integration test #2 `excludes collectionPublic=false users (T-39b-01 layer 2 / D-39b-09)` — seeds a profile with `profilePublic: true, collectionPublic: false` (collection-private despite profile-public), inserts a watches row, asserts the DAL excludes them. This is the D-39b-09 NEW second-layer gate; `getMostFollowedCollectors` does NOT enforce this and would leak collectors with private collections.
- **T-39b-04 (Viewer self-leak):** Integration test #3 `excludes viewer self (T-39b-04)` — viewer themselves owns the catalog row; asserts the DAL excludes them from their own roster.
- **All four edges + dedup + ordering covered:** Integration tests #1–#6 cover layer 1, layer 2, self-exclusion, sold-status filter, ORDER BY created_at DESC, and multi-row-per-user dedup.

Run command (when full env present): `set -a; source .env.local; set +a; npx vitest run tests/data/getCollectorsForCatalog.test.ts`.

## Deviations from Plan

### Deviation 1: AvatarDisplay size — UI-SPEC says 36, ship 40 (Pitfall 1 / A4 RECOMMEND)

**Type:** Documented deviation flagged in PLAN, executed as specified.
**Found during:** Pre-execution review of UI-SPEC §NSV-18 line 415 (`size={36}`) against `AvatarDisplay.tsx:10` literal-union type `40 | 64 | 96`.
**Issue:** The UI-SPEC visual contract specifies a 36px avatar in the chip row, but the existing `AvatarDisplay` primitive does not accept 36 in its `size` prop — only 40 / 64 / 96.
**Fix:** Substituted `size={40}` in `OtherOwnersRoster.tsx:71`. Documented inline at the JSX site (`{/* UI-SPEC requests size=36; AvatarDisplay primitive only supports 40/64/96 — substitute 40 per RESEARCH A4 */}`).
**Alternative considered:** Extend the AvatarDisplay primitive to accept `size={36}`. REJECTED — touches an established component used by 4 other call sites; the type-union widening would risk implicit any propagation. Defer until real-world chip rows feel too large at 40px.
**Files modified:** `src/components/insights/OtherOwnersRoster.tsx`.
**Commit:** `c10a2d2`.

### Deviation 2: Rule 1 auto-fix — catalog-page.test.ts mock chain

**Type:** Rule 1 (bug — broken test infrastructure caused by this plan's mount).
**Found during:** Task 4 verification — `npm test` regression delta went 53 → 60 failed. All 8 D-10 page tests broke with `db.select(...).from(...).innerJoin is not a function`.
**Issue:** The pre-existing shallow `vi.mock('@/db', () => ({ db: { select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: mockDbLimit })) })) })) } }))` only covers the inline Drizzle SELECT used by `findViewerWatchByCatalogId`. The new `getCollectorsForCatalog` call from the page's Promise.all hits a JOIN-heavy chain (`db.select().from(watches).innerJoin(profiles, …).innerJoin(profileSettings, …).where(…).orderBy(…).limit(…)`) that is not in the mock.
**Fix:** Added `vi.mock('@/data/discovery', () => ({ getCollectorsForCatalog: mockGetCollectorsForCatalog }))` with a sensible empty-state default `{ collectors: [], totalCount: 0 }` in `beforeEach`. This is the canonical pattern for any new DAL imported by `/catalog/[catalogId]/page.tsx` (cf. existing mocks for `@/data/catalog`, `@/data/watches`, `@/data/preferences`).
**Files modified:** `tests/app/catalog-page.test.ts` (3 line additions: hoist var + vi.mock factory + beforeEach default).
**Commit:** `bc557bb` (same commit as Task 4 mount — atomic ship of mount + test infrastructure update).
**Net regression delta:** 0 (pre-plan baseline 53 failed → post-Task-4 53 failed).

## Deferred Issues

None — no out-of-scope discoveries triggered `deferred-items.md` entries.

## Authentication Gates

None.

## Q1 Decision Capture (A1 SHIPPED)

**Q1 RESEARCH question:** Should `getCollectorsForCatalog` include rows where `watches.status = 'sold'`?

**A1 verdict (PLAN frontmatter must_haves line 28 — Q1 RECOMMEND):** Filter `watches.status IN ('owned', 'wishlist', 'grail')` — exclude `sold`. Semantics match the UI-SPEC §Copywriting Contract "X collectors own this" copy — a sold watch is not currently owned.

**Implementation:** `inArray(watches.status, ['owned', 'wishlist', 'grail'])` appears in BOTH the rows query AND the count(DISTINCT) totalCount query at `src/data/discovery.ts:232` and `:251`. Integration test #4 `excludes sold-status rows (A1 / Q1 RECOMMEND)` proves the exclusion.

**Alternative considered:** Include `'sold'` so the roster reflects historical ownership ("X people have owned this, even if some don't anymore"). REJECTED — the copy and the visual chip vocabulary (avatar + @username) both communicate "current ownership"; an ex-owner appearing in the roster would be a UI surprise.

## Threat Surface Verification

Plan's `<threat_model>` STRIDE register entries verified shipped:

| Threat ID | Status | Mitigation in Code |
|-----------|--------|---------------------|
| T-39b-01 layer 1 (Info Disclosure private profile) | ✅ mitigated | `eq(profileSettings.profilePublic, true)` on both DAL queries (src/data/discovery.ts:229, :248) |
| T-39b-01 layer 2 (Info Disclosure private collection — D-39b-09 NEW) | ✅ mitigated | `eq(profileSettings.collectionPublic, true)` on both DAL queries (src/data/discovery.ts:230, :249) |
| T-39b-04 (Viewer self-leak) | ✅ mitigated | `sql\`${profiles.id} != ${viewerId}\`` on both DAL queries (src/data/discovery.ts:231, :250) |
| SQL injection via catalogId | ✅ mitigated | Drizzle ORM parameterizes via `sql` template tags; UUID regex check upstream at page.tsx:47 rejects malformed input before the DAL is reached |
| Data exfil via over-fetch | ✅ mitigated | Hard `LIMIT 50` in the rows query (Pitfall 3); JS slice to top-N (default 5) after dedup; totalCount uses `count(DISTINCT)` (no row leak) |
| XSS via collector username / displayName | ✅ mitigated | React text-node auto-escape on `{c.username}` + `{c.displayName}`; aria-label constructed via template literal; no dangerouslySetInnerHTML |

No new threat-surface flags introduced beyond the plan's threat_model.

## Known Stubs

None. The OtherOwnersRoster receives real DAL output (not hardcoded `[]`); the page wires real `getCollectorsForCatalog(catalogId, user.id, { limit: 5 })` (not a placeholder). The component's hide-if-empty branch is the legitimate empty-state behavior, not a stub.

## Self-Check: PASSED

**Files verified to exist:**

- `tests/data/getCollectorsForCatalog.test.ts` — FOUND
- `src/components/insights/OtherOwnersRoster.tsx` — FOUND
- `src/data/discovery.ts` (modified, getCollectorsForCatalog exported) — FOUND
- `src/app/catalog/[catalogId]/page.tsx` (modified, OtherOwnersRoster mounted) — FOUND
- `tests/app/catalog-page.test.ts` (modified, Rule 1 fix) — FOUND

**Commit hashes verified via git log --oneline --all:**

- `1d2e4a4` (test: 39b-04 Task 1) — FOUND
- `3ec0f4a` (feat: 39b-04 Task 2) — FOUND
- `c10a2d2` (feat: 39b-04 Task 3) — FOUND
- `bc557bb` (feat: 39b-04 Task 4 + Rule 1 fix) — FOUND

**Final-state verification commands:**

- `grep -c "export.*function getCollectorsForCatalog" src/data/discovery.ts` = 1 ✅
- `grep -cE "profileSettings\.collectionPublic.*true" src/data/discovery.ts` = 3 (≥ 2 required — both queries + JSDoc) ✅
- `grep -c "OtherOwnersRoster" 'src/app/watch/[id]/page.tsx'` = 0 ✅ (NSV-18 catalog-only)
- `grep -c "OtherOwnersRoster" 'src/app/catalog/[catalogId]/page.tsx'` = 3 (≥ 2 required — import + JSX + comment) ✅
- `grep "if (collectors.length === 0) return null" src/components/insights/OtherOwnersRoster.tsx` = 1 ✅
- `grep "totalCount > 5" src/components/insights/OtherOwnersRoster.tsx` = 1 ✅
- `npm run build` exit 0 (Compiled successfully in 6.9s) ✅
- `npx tsc --noEmit` = 28 errors (project baseline; net 0 new from this plan) ✅
- `npm test` = 53 failed (pre-plan baseline preserved; net regression delta 0) ✅
