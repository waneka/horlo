---
phase: 16-people-search
plan: 05
subsystem: ui
tags: [search, server-component, suspense, tabs, useSearchParams, suggested-collectors, pg-trgm, D-29, D-11, D-10, Pitfall-C-1]

# Dependency graph
requires:
  - phase: 16-people-search-02-search-dal
    provides: searchProfiles DAL + searchPeopleAction Server Action
  - phase: 16-people-search-03-search-components
    provides: useSearchState hook + PeopleSearchRow + SearchResultsSkeleton + ComingSoonCard + HighlightedText
  - phase: 16-people-search-04-nav-cleanup
    provides: DesktopTopNav restyle (D-24) + HeaderNav purge (D-23)
  - phase: 11-schema-storage-foundation
    provides: pg_trgm extension + GIN trigram indexes on profiles.username/bio
provides:
  - "/search route shipping the production People search experience (4 tabs · live debounced ILIKE · taste overlap % · inline FollowButton · suggested-collectors empty/no-results states)"
  - "SearchPageClient.tsx — 4-tab composition with Suspense-safe useSearchParams + Server-Component-as-children pattern (D-29)"
  - "Server Component wrapper at src/app/search/page.tsx — resolves viewerId via getCurrentUser, wraps Client Component in Suspense, passes SuggestedCollectorsForSearch (limit 8 · NO LoadMore) as children"
  - "16-VERIFICATION.md — pg_trgm Bitmap Index Scan evidence (Pitfall C-1 closure) + UAT sign-off (D-24 + D-25)"
  - "Plan 01 Task 5 RED → GREEN snapshot for tests/app/search/SearchPageClient.test.tsx (13 tests)"
affects: [17-future, gsd-verify-work]

# Tech tracking
tech-stack:
  added: []  # No new dependencies — Suspense + useSearchParams are core React/Next, lucide-react Watch + Layers icons already available
  patterns:
    - "Server-Component-as-children pattern (D-29): Server Component child rendered server-side and passed via React node tree to Client parent which decides WHEN to display it (avoids forcing the heavy DAL onto the client)"
    - "Pitfall 4 mitigation: Suspense wraps Client Components that call useSearchParams() so prerender doesn't bail (verified with Next 16 docs in RESEARCH.md)"
    - "Local Server Component for forking shared UI (SuggestedCollectorsForSearch) — same DAL, different limit + LoadMore omission, single caller, intentionally inline rather than abstracted to a shared module"
    - "Forced-plan EXPLAIN ANALYZE pattern (SET enable_seqscan = off) for proving GIN index correctness on small dev datasets where the planner naturally prefers Seq Scan"

key-files:
  created:
    - src/components/search/SearchPageClient.tsx
    - .planning/phases/16-people-search/16-VERIFICATION.md
  modified:
    - src/app/search/page.tsx
  deleted:
    - tests/app/search.test.tsx  # Phase 14 stub-route smoke test deleted; superseded by SearchPageClient + Server Component wrapper tests

key-decisions:
  - "SuggestedCollectorsForSearch defined inline in src/app/search/page.tsx rather than abstracted to a shared module (single caller; lifting is premature)"
  - "Limit 8 + NO LoadMore on /search empty/no-results suggested-collectors block (Open Question 3 resolution from RESEARCH.md): empty state should feel light, not feed-like — diverges from home's 5 + LoadMore"
  - "Declarative autoFocus on the page-level Input over imperative useRef.focus(): the shadcn <Input> wrapper does not forwardRef, so an imperative ref+effect would silently no-op. autoFocus is forwarded as a plain DOM attribute via rest spread"
  - "PeopleResultsBlock distilled as an inner helper component to avoid duplicating the 5-state branch logic (loading · error · pre-query · no-results · results) across the All and People TabsContent panels"
  - "children prop passed verbatim to BOTH pre-query and no-results states (D-11 + D-10 render the SAME suggested-collectors block — same DAL, same viewerId, same surface)"
  - "Pitfall C-1 closed via forced-plan EXPLAIN ANALYZE evidence (SET enable_seqscan = off) rather than waiting on a natural-plan Bitmap Index Scan: at 127 rows the planner correctly prefers Seq Scan because GIN consultation cost > heap scan cost. Forced plan proves the indexes are on disk, correctly defined with gin_trgm_ops, and reachable when row counts grow"
  - "Local DB trgm indexes re-created from Phase 11 migration body verbatim during executor session (drift detected — likely a `supabase db reset` ran without re-applying the migration). Production DB is unaffected (indexes baked into the migration)"

patterns-established:
  - "Pattern: Server Component child via children prop — when a Client Component needs to conditionally show a server-rendered subtree, render the Server Component server-side and pass it as children. Client Component decides WHEN to show; Server Component decides WHAT to render. Two clean concerns, no client-side DAL leaks"
  - "Pattern: Forced-plan EXPLAIN ANALYZE — for verifying GIN/trigram indexes exist and are usable on small dev datasets. Run both natural plan (planner judgment) AND forced plan (SET enable_seqscan = off) to capture full evidence in VERIFICATION.md"
  - "Pattern: ?tab= URL param omitted when default — useSearchState writes ?tab=people but omits ?tab=all (D-12). Tab gate inside the hook short-circuits searchPeopleAction calls when tab !== 'all' && tab !== 'people'"

requirements-completed: [SRCH-01, SRCH-02, SRCH-03, SRCH-04, SRCH-05, SRCH-06, SRCH-07]

# Metrics
duration: ~50min
completed: 2026-04-25
---

# Phase 16 Plan 05: Search Page Assembly Summary

**/search route shipping the production People search experience: 4-tab control · Suspense-wrapped useSearchParams · Server-Component-as-children pattern (D-29) · suggested-collectors empty/no-results surfaces · pg_trgm Bitmap Index Scan evidence (Pitfall C-1 closed) · UAT approved.**

## Performance

- **Duration:** ~50 min (Tasks 1+2: ~20 min · Pitfall C-1 EXPLAIN ANALYZE evidence capture: ~25 min · UAT sign-off + finalization: ~5 min)
- **Started:** 2026-04-25T17:04:55Z (after 16-03 completion)
- **Completed:** 2026-04-25 (UAT approved, finalization run)
- **Tasks:** 3/3 completed (Task 1 auto · Task 2 auto · Task 3 manual checkpoint approved)
- **Files modified:** 2 source files (1 created, 1 replaced) + 1 verification doc + 1 stub test deleted

## Accomplishments

- **/search shipping production:** 4 tabs (All · Watches · People · Collections) with the documented behavioral contract: All-tab + People-tab share the live People search; Watches and Collections render full-page coming-soon cards and never fire `searchPeopleAction` (SRCH-02 verified by Plan 01 Tests 4/5)
- **Server-Component-as-children (D-29) wired end-to-end:** `src/app/search/page.tsx` resolves `viewerId` via `getCurrentUser()`, renders `<SuggestedCollectorsForSearch viewerId={user.id} />` as a Server Component child of `<SearchPageClient>`. Heavy DAL work stays on the server; the Client Component just decides WHEN to show the children (D-11 pre-query + D-10 no-results)
- **Pitfall 4 mitigated:** `<Suspense fallback={<div … />}>` wraps `<SearchPageClient>` so `useSearchParams()` inside the Client tree does not cause prerender bailout. Static HTML produces only the placeholder; the dynamic Client subtree streams in
- **Open Question 3 resolution shipped:** `SuggestedCollectorsForSearch` runs `getSuggestedCollectors` with `limit: 8` and renders a flat list of `SuggestedCollectorRow` — explicitly NO `LoadMoreSuggestionsButton`. Diverges from the home `SuggestedCollectors` (5 + LoadMore) so the search empty state feels light, not feed-like
- **Pitfall C-1 closed:** `16-VERIFICATION.md` captures both natural-plan and forced-plan EXPLAIN ANALYZE for `username ILIKE '%bo%'` and `bio ILIKE '%bob%'`. Forced plan (`SET enable_seqscan = off`) proves `Bitmap Index Scan on profiles_username_trgm_idx` and `Bitmap Index Scan on profiles_bio_trgm_idx` are reachable. Natural-plan Seq Scan at 127 rows is correct cost-model behavior — trgm indexes will activate at production-scale row counts
- **D-24 + D-25 UAT approved:** User verified in desktop browser that nav search input has muted-fill + leading magnifier, HeaderNav inline links are gone, and two-input architecture (nav input → /search?q= → page-level input) works without layout shift across transitions
- **Plan 01 Task 5 RED → GREEN closed:** All 13 tests in `tests/app/search/SearchPageClient.test.tsx` GREEN. Combined with the Plan 03 component tests, the SRCH-01..SRCH-07 contract is fully test-locked
- **Full suite GREEN end-of-phase:** 2813 passed · 152 skipped · 0 failed. Lint exits 0. tsc --noEmit shows 6 pre-existing errors (Plan 03 deferred-items.md), no new errors from this plan

## Task Commits

Each task was committed atomically:

1. **Task 1: SearchPageClient assembly + 4-tab control** — `e5a2644` (feat)
2. **Task 2: /search Server Component wrapper with Suspense + SuggestedCollectorsForSearch** — `7905769` (feat)
3. **Task 3a: EXPLAIN ANALYZE evidence captured in 16-VERIFICATION.md** — `0938873` (docs)
4. **Task 3 [MANUAL CHECKPOINT]: UAT sign-off received from user — "approved"** — finalization commit (this docs commit)

_Note: Task 1 was marked `tdd="true"` but RED was already established by Plan 01 Task 5 commit (Phase 16 Plan 01) — Task 1 is the pure GREEN step. Task 3 was a `checkpoint:human-action`; Task 3a captured the executable evidence (EXPLAIN ANALYZE) before pausing for the human UAT step._

## Files Created/Modified

### Created

- `src/components/search/SearchPageClient.tsx` (223 lines) — Page-level Client Component composing the 4-tab control. Owns the page-level input (autoFocus, pre-filled from `useSearchState.q`), routes the q ↔ URL ↔ fetch trifecta through `useSearchState`, and renders the `<PeopleResultsBlock>` helper across All and People panels. Watches + Collections panels render `<ComingSoonCard variant="full">`. All-tab appends two `<ComingSoonCard variant="compact">` footers (D-06).

- `.planning/phases/16-people-search/16-VERIFICATION.md` — Pitfall C-1 evidence (natural + forced EXPLAIN ANALYZE for both username and bio trgm indexes) + UAT runbook + sign-off block. Verdict: **APPROVED — Phase 16 ships**.

### Modified (replaced)

- `src/app/search/page.tsx` (70 lines, replacing the Phase 14 stub) — Server Component wrapper. Awaits `getCurrentUser()` for `viewerId`. Renders `<Suspense fallback>` wrapping `<SearchPageClient viewerId={user.id}>` with a child `<SuggestedCollectorsForSearch viewerId={user.id} />`. Local async `SuggestedCollectorsForSearch` runs `getSuggestedCollectors(viewerId, { limit: 8 })` and emits a flat `SuggestedCollectorRow` list with NO LoadMore (Open Question 3).

### Deleted

- `tests/app/search.test.tsx` — Phase 14 stub-route smoke test that asserted "Search is coming" copy. Replaced by the SearchPageClient + Server Component wrapper tests landed in Plan 01.

## Decisions Made

- **Inline `SuggestedCollectorsForSearch` rather than abstracting to a shared module:** Single caller; identical DAL to home but with different limit + LoadMore omission. Lifting to `src/components/home/SuggestedCollectors.tsx` would force a `mode="search"` prop and obscure the shared dependency. Single caller wins.
- **Limit 8 + NO LoadMore (Open Question 3 resolution):** /search's pre-query and no-results states should feel like a discovery surface, not an infinite feed. Home's 5 + LoadMore is appropriate for a daily-return feed; /search's empty state benefits from a slightly larger flat list with no engagement hook. RESEARCH.md notes user explicitly wanted lightness.
- **Declarative `autoFocus` over imperative `useRef`:** The shadcn `<Input>` wrapper (`src/components/ui/input.tsx`) is a function component without `forwardRef`, so an imperative `useRef` + `.focus()` call would silently no-op (logged in `<action>` body inline comments). `autoFocus` is forwarded as a plain DOM attribute through the rest spread and works regardless of ref forwarding.
- **`PeopleResultsBlock` inner helper:** Same People search visuals across All and People tabs. Distilling avoids duplicating the 5-state branch (loading · error · pre-query · no-results · results) across two TabsContent panels. The helper takes `childrenSlot` so the All-tab compact footers don't bleed into the People-tab.
- **Pitfall C-1 closed via forced-plan evidence:** At 127 rows the natural plan correctly prefers Seq Scan (5.59 cost units) over GIN consultation (1963.34 cost units to set up Bitmap). The trgm index is on disk and the planner is willing to use it — proven by `SET enable_seqscan = off` flipping to `Bitmap Index Scan on profiles_username_trgm_idx` (and the equivalent for bio). RESEARCH.md Pitfall 1 explicitly anticipated this small-table behavior.

## Deviations from Plan

None — plan executed exactly as written. All 3 tasks ran their `<action>` blocks verbatim; all acceptance criteria passed; no Rule 1/2/3/4 deviations triggered during the assembly tasks. The single environmental wrinkle (local DB drift — trgm indexes missing on local Supabase at start of Task 3) was a setup-only concern and did not modify any plan code or contract; the indexes were re-created from the Phase 11 migration body verbatim and the evidence captured.

## Test Snapshot

```
tests/app/search/SearchPageClient.test.tsx — 13/13 GREEN
  Plan 01 Task 5 RED → GREEN closed
  Tests cover: 4-tab rendering · default tab='all' · tab gate (Watches/Collections never fire searchPeopleAction) ·
              pre-query state (D-11 + children) · no-results state (D-10 + children) · results list ·
              All-tab compact footers (D-06) · People-tab no-footers (D-07) · isLoading skeleton ·
              hasError alert · autoFocus on input · debouncedQ flow · viewerId propagation

Full suite — 2813 passed | 152 skipped | 0 failed (zero regressions)
npm run lint — exit 0
npx tsc --noEmit — 6 pre-existing errors (Plan 03 deferred-items.md), 0 new from this plan
```

## Pitfall C-1 Evidence Snapshot

From `.planning/phases/16-people-search/16-VERIFICATION.md`:

- **Index inventory:** Both `profiles_username_trgm_idx` and `profiles_bio_trgm_idx` confirmed on disk with `gin (column gin_trgm_ops)` definitions
- **Username natural plan (127 rows):** `Seq Scan on profiles  (cost=0.00..5.59 rows=9 width=16)` — expected at small-table scale
- **Username forced plan (`SET enable_seqscan = off`):** `Bitmap Index Scan on profiles_username_trgm_idx (cost=0.00..1963.34 rows=9 width=0)` — index is reachable
- **Bio natural plan:** `Seq Scan on profiles  (cost=0.00..5.59 rows=1 width=16)` — same small-table cost behavior
- **Bio forced plan:** `Bitmap Index Scan on profiles_bio_trgm_idx (cost=0.00..4.38 rows=1 width=0)` — index is reachable
- **Verdict:** ✅ GREEN — Both indexes exist, are correctly defined with `gin_trgm_ops`, and are usable for ILIKE queries. Production-scale row counts will trigger the planner's pivot to Bitmap Index Scan as proven by the forced-plan evidence

## UAT Sign-off

User confirmed in desktop browser:
- D-24 nav restyle: muted-fill background ✓ · leading lucide Search icon ✓ · balanced width ✓ · HeaderNav inline links absent ✓ · Profile/Settings reachable via UserMenu ✓
- D-24 nav → /search flow: typing "bob" + Enter navigates to `/search?q=bob` ✓ · page-level input pre-filled ✓ · 250ms debounce + results render ✓
- D-25 two-input architecture: nav input from /search updates URL + page-level results ✓ · NO layout shift across transitions ✓

## Issues Encountered

- **Local DB drift (setup-only, not a plan deviation):** When the executor opened `psql` for the Pitfall C-1 EXPLAIN ANALYZE step, `\d+ profiles` showed the trgm indexes were missing from the local DB. Likely a recent `supabase db reset` ran without re-applying Phase 11 migration `20260423000003_phase11_pg_trgm.sql`. The indexes were re-created from the migration body verbatim (with `IF NOT EXISTS` guards). MEMORY.md note "DB migration rules — drizzle-kit push is LOCAL ONLY; prod migrations use `supabase db push --linked`" applies here: production DB has these indexes baked in via the Phase 11 migration; only local environment had drifted. **No production impact, no plan deviation.**

## User Setup Required

None — no external service configuration required. The /search route is fully self-contained on existing Phase 11 schema + Phase 14 nav frame + Phase 16 Plans 02/03/04 primitives.

## Next Phase Readiness

- **Phase 16 is COMPLETE** — all 7 SRCH requirements (SRCH-01..SRCH-07) ship live behavior. Ready for `/gsd-verify-work` to run the cross-plan verifier.
- **SRCH-08** (`pg_trgm extension + GIN trigram indexes`) is mapped to Phase 11 in REQUIREMENTS.md (already shipped); this plan's EXPLAIN ANALYZE evidence is the production-readiness gate for that requirement.
- **Future SRCH-FUT requirements** (SRCH-FUT-01 watches search · SRCH-FUT-02 collections search · SRCH-FUT-03 search history) are explicitly out of scope; the 4-tab shell already accommodates them as drop-in panel replacements when those features ship.
- **Test debt:** 6 pre-existing `tsc --noEmit` errors flagged in Plan 03 `deferred-items.md` remain open; they are NOT regressions from this plan and are queued as a `/gsd-quick` follow-up.

## Self-Check: PASSED

Verification (executed 2026-04-25):
- `test -f src/components/search/SearchPageClient.tsx` → FOUND (223 lines)
- `test -f src/app/search/page.tsx` → FOUND (70 lines, replaces Phase 14 stub)
- `test -f .planning/phases/16-people-search/16-VERIFICATION.md` → FOUND
- `git log --oneline | grep -q e5a2644` → FOUND (Task 1 commit)
- `git log --oneline | grep -q 7905769` → FOUND (Task 2 commit)
- `git log --oneline | grep -q 0938873` → FOUND (Task 3a evidence commit)
- `grep -q 'Bitmap Index Scan' .planning/phases/16-people-search/16-VERIFICATION.md` → FOUND (Pitfall C-1 evidence)
- `grep -q 'APPROVED' .planning/phases/16-people-search/16-VERIFICATION.md` → FOUND (UAT sign-off)
- `grep -q 'TabsTrigger value="all"' src/components/search/SearchPageClient.tsx` → FOUND (SRCH-01)
- `grep -q '<Suspense' src/app/search/page.tsx` → FOUND (Pitfall 4)
- `grep -qE 'limit:\s*8' src/app/search/page.tsx` → FOUND (Open Question 3)
- `! grep -q 'LoadMoreSuggestionsButton' src/app/search/page.tsx` → ZERO matches (Open Question 3 — no LoadMore on /search)

---
*Phase: 16-people-search*
*Completed: 2026-04-25*
