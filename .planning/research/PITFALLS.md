# Domain Pitfalls: v8.0 Add-Watch Redesign

**Domain:** Search-first watch add flow on Next.js 16 + Supabase + Drizzle (Horlo)
**Researched:** 2026-05-28
**Sources:** Code inspection of AddWatchFlow.tsx, VerdictStep.tsx, WatchForm.tsx, PasteSection.tsx, CollectionFitCard.tsx, /api/extract-watch/route.ts, watches.ts (Server Actions), catalog.ts (DAL), search.ts (DAL), useWatchSearchVerdictCache.ts, useUrlExtractCache.ts, types.ts, PROJECT.md (Active section), SEED-010

---

## Critical Pitfalls

Mistakes that cause rewrites, data corruption, or cache cross-contamination across users.

---

### Pitfall 1: Module-scope caches not cleared on signOut — compounded by new caches

**What goes wrong:** `useWatchSearchVerdictCache` and `useUrlExtractCache` are **module-scoped Maps**, not React state. They survive signOut because Next.js does not tear down the module graph when the user signs out — the module instance stays warm across the session boundary. Today the stale verdict cache is listed as Active tech debt in PROJECT.md. Adding a new search-result cache (catalog search hits) and a structured-extract cache in the same pattern without fixing the underlying signOut cleanup means three independently-stale caches.

**Why it happens:** The Phase 29 three-layer reset (per-request nonce `key`, `useLayoutEffect` cleanup-on-hide, explicit reset before `router.push`) resets React state and clears the module caches for the CURRENT user's flow. But it does not fire on signOut — the module variables persist, and the next signed-in session (different user on the same browser) inherits the previous user's catalog search results and extracted watch data.

**Symptom (user sees):** After signing out and signing in as a different account, the new user's add-watch flow shows search results or extracted watch cards from the previous user's session without a network call.

**Affected code locations:**
- `src/components/search/useWatchSearchVerdictCache.ts` — `let moduleCache: Map` at line 24 and `let moduleRevision = 0` at line 25
- `src/components/watch/useUrlExtractCache.ts` — `let moduleCache: Map` at line 33
- Any new `useSearchResultCache` or `useStructuredExtractCache` added in v8.0

**Prevention:** The signOut handler (or the supabase auth state-change listener) must call all `__reset*ForTests()` -style functions — or their production equivalents — after a signOut event. This is the correct fix for the pre-existing tech debt AND the gate on adding any new module-scoped cache in v8.0. Do not add a new module-scope cache without shipping the signOut cleanup at the same time.

**Which phase:** The first phase that introduces a new cache (catalog search or structured-extract) must ship the signOut cleanup simultaneously. Do not defer.

---

### Pitfall 2: Search-first route emits one SQL query per result row (N+1 on viewer state)

**What goes wrong:** A naively-written catalog search adds a secondary per-row query to check whether the viewer already owns or has wishlisted each result row (`watches.catalog_id = ?`). With 20 result rows that is 21 queries. Under Supabase connection-pool pressure (Vercel edge functions share a pool), these cascade into visible latency.

**Why it happens:** The existing `searchProfiles` DAL in `src/data/search.ts` already solved this problem for the People tab: it uses `inArray(follows.followingId, topIds)` to batch the "does viewer follow this person?" lookup in a single query after the candidate fetch (comment on line 49: "Anti-N+1 (Pitfall C-4)"). The same anti-N+1 pattern is documented in the Phase 19 SRCH-10 requirement for the Watches tab. A new developer writing the catalog search DAL for v8.0 may not know this pattern applies here too.

**Symptom (user sees):** Search-as-you-type response feels slow (>500ms) when typing a brand/model. Worse on cold DB connections.

**Affected code locations:**
- New DAL function `searchCatalogWatches` (does not exist yet — must be written for v8.0)
- Pattern to follow: `src/data/search.ts` lines 73–120 (candidate pool) + single `inArray` follow-state batch at end

**Prevention:** Write the viewer-state batch (owns/wishlisted check) as a single `inArray(watchesCatalog.id, topCatalogIds)` query executed AFTER the candidate fetch. Do not add a per-row subquery or per-row DAL call. The Phase 16/19 commentaries document this pattern by name ("anti-N+1 single inArray"). Add a static test that counts SQL statements emitted per search call (or a code comment + code review gate).

**Which phase:** Phase that introduces the catalog search DAL (likely Phase 1 of v8.0).

---

### Pitfall 3: `cheerio`-based HTML extraction stages run when mode === 'structured'

**What goes wrong:** The `/api/extract-watch` route today calls `fetchAndExtract(url)` which calls `extractWatchData(html)` which unconditionally calls `extractStructuredData(html)`, `extractFromHtml(html)`, and `extractWithLlm(html, ...)`. All three stages expect HTML input. If the route gains a `mode: 'structured'` path that bypasses the `safeFetch` step and passes user-typed fields directly to the LLM, the cheerio HTML stages must **short-circuit** — they will either silently produce empty results (harmless but wasteful) or — if called with a query string mistaken for HTML — produce garbage that contaminates the merge step.

**Why it happens:** `extractFromHtml` and `extractStructuredData` in `src/lib/extractors/html.ts` and `src/lib/extractors/structured.ts` do not guard on whether their input is real HTML. The merge logic in `src/lib/extractors/index.ts` (lines 34–48) gives `NON_AMBIGUOUS_FIELDS` priority to static extraction results — so even a junk cheerio result on a query string input could silently override a correct LLM field for brand, model, or imageUrl.

**Symptom (user sees):** For a structured-input extract of "Omega Speedmaster 311.30.42.30.01.005", the extracted brand or model field comes back blank or wrong because cheerio found something in the query-string text that matched a selector.

**Affected code locations:**
- `src/lib/extractors/index.ts` — `extractWatchData` (always runs all three stages)
- `src/lib/extractors/html.ts` — `extractFromHtml`
- `src/lib/extractors/structured.ts` — `extractStructuredData`
- `src/app/api/extract-watch/route.ts` — must discriminate on `mode`

**Prevention:** The structured-input path must **not** call `fetchAndExtract`. It needs its own code path that calls `extractWithLlm` directly with the typed fields as the prompt content, bypassing cheerio entirely. In the route handler, parse the request body's `mode` discriminant first and branch early — never reach the HTML extractor stages for structured input.

**Which phase:** Phase that adds structured-input extraction to `/api/extract-watch`.

---

### Pitfall 4: LLM hallucination on reference–year combos produces wrong catalog row

**What goes wrong:** The LLM extraction prompt (in `src/lib/extractors/llm.ts`) asks the model to infer reference numbers and production years from page text. In the no-URL structured-input mode, there is no page text to cross-reference against — the model has only the user's typed query. Under these conditions the model can confidently hallucinate plausible-looking but factually wrong combos (e.g. "Rolex Submariner ref 116610LN year 1992" — that reference was introduced in 2010). The hallucination gets stored in `watches_catalog` as `productionYear` and is then trusted by the taste enricher and the future market-value engine.

**Why it happens:** The existing LLM prompt includes `"Only include fields you're confident about"` but the model has no way to verify reference-to-year accuracy without a product page. Confidence calibration from the extractor (`countPopulatedFields` threshold) is designed for HTML-with-structured-data richness, not for structured-input correctness.

**Symptom (user sees):** The watch detail page shows a wrong production year. The taste enricher's `heritageScore` and `eraSignal` are derived from a wrong era bucket. The user may not notice for months.

**Affected code locations:**
- `src/lib/extractors/llm.ts` — `EXTRACTION_PROMPT` and `extractWithLlm`
- `src/data/catalog.ts` — `upsertCatalogFromExtractedUrl` / new structured-input upsert
- `src/lib/taste/enricher.ts` — reads `productionYear` for era bucketing

**Prevention:** (a) In structured-input mode, pass only fields the user actually typed; do not ask the LLM to infer reference or productionYear from a bare query string — treat those as user-supplied or absent. (b) Set `productionYearIsEstimate = true` whenever the year comes from LLM inference with no source URL. (c) Do not block the flow on year accuracy; let the user correct it on the confirm screen.

**Which phase:** Phase that implements no-URL structured extraction.

---

### Pitfall 5: Catalog UNIQUE conflict second user does not get the existing catalog_id

**What goes wrong:** When two users near-simultaneously submit the same `(brand, model, reference)` via structured extract, the ON CONFLICT path in `upsertCatalogFromExtractedUrl` correctly returns the existing row's id for the first writer. But if the second writer's INSERT fires before the first writer's RETURNING completes, the `WITH ins AS (INSERT ... ON CONFLICT DO NOTHING RETURNING id) UNION ALL SELECT id FROM watches_catalog WHERE ...` pattern in `upsertCatalogFromUserInput` does return the pre-existing id correctly — the `UNION ALL` SELECT arm picks it up. However, the **structured-extract** path uses `upsertCatalogFromExtractedUrl` (the DO UPDATE variant, not DO NOTHING), and a slow LLM response on one request could race a search-pick on another, causing the LLM path to overwrite a human-verified catalog row's fields with hallucinated values.

**Why it happens:** `upsertCatalogFromExtractedUrl` uses `ON CONFLICT DO UPDATE SET ... COALESCE(...)` — it updates NULL fields on conflict. If the search-pick path lands first (writing the row with only brand/model/reference) and then the LLM structured-extract path lands second (with an inferred productionYear), the LLM's hallucinated year fills the previously-NULL column via COALESCE. The "first-non-null wins" policy was designed for URL-extracted data where the source page is the authority; it is wrong for LLM-only inference.

**Symptom (user sees):** A catalog row that was correctly empty for productionYear is silently populated with a wrong year after a race condition. Invisible unless the user inspects the watch detail page.

**Affected code locations:**
- `src/data/catalog.ts` — `upsertCatalogFromExtractedUrl` (DO UPDATE COALESCE path)
- `src/data/catalog.ts` — `upsertCatalogFromUserInput` (DO NOTHING + UNION ALL path — safe)
- New structured-extract server action / route extension

**Prevention:** The structured-input path should use `upsertCatalogFromUserInput` (DO NOTHING + UNION ALL) for the initial catalog row creation, not `upsertCatalogFromExtractedUrl`. Only a URL extraction that fetches a real product page deserves the DO UPDATE COALESCE enrichment semantics. If the structured-input path also wants to write spec fields, it should do so only with explicit confidence gating and should use the same COALESCE (never overwrite non-null) pattern — and it must **not** write `productionYear` from LLM inference alone.

**Which phase:** Phase that wires structured-input extraction to catalog write.

---

## Moderate Pitfalls

---

### Pitfall 6: VerdictStep and CollectionFitCard removed from flow — stale tests and rail regression

**What goes wrong:** Three simultaneous regression risks when `VerdictStep` is removed from `AddWatchFlow`:

**6a — Tests that assert verdict-in-add-flow left behind as false negatives.** Any test that imports `VerdictStep` or `CollectionFitCard` from within the add-watch flow's render tree and asserts on verdict copy will either (a) fail immediately because the component is no longer rendered or (b) accidentally pass because the assertion node is not found and the test used `.queryBy` instead of `.findBy`. Either outcome leaves CI in a state where the regression class is undetected.

**6b — No static guard preventing CollectionFitCard reintroduction into the add flow.** The existing `tests/static/CollectionFitCard.no-engine.test.ts` guards that the component does not import the similarity engine — it does NOT guard that the component is not rendered in `AddWatchFlow`. A future plan could re-add `<CollectionFitCard>` to the new confirm screen without tripping the existing guard.

**6c — `RecentlyEvaluatedRail` is keyed on `useWatchSearchVerdictCache` entries.** If the full verdict cache is removed from the flow, the rail also goes dark. If the rail is retained for a "recently searched" UX purpose but the cache is not wired, the rail renders empty with no explanation.

**Symptom (user sees):** 6a: silent test suite regression. 6b: verdict card appears in the add flow after being deliberately removed. 6c: recently-viewed chips disappear or show stale data.

**Affected code locations:**
- `src/components/watch/AddWatchFlow.tsx` — `VerdictStep`, `RecentlyEvaluatedRail`, `useWatchSearchVerdictCache` imports
- `src/components/watch/VerdictStep.tsx` — to be deleted/replaced
- `tests/static/CollectionFitCard.no-engine.test.ts` — existing guard (does not block add-flow render)
- Any test files that render `AddWatchFlow` and assert on verdict copy

**Prevention:**
- Delete all tests asserting verdict-in-add-flow when removing VerdictStep; do not suppress or skip.
- Add a new static guard: `tests/static/AddWatchFlow.no-verdict-step.test.ts` that reads `src/components/watch/AddWatchFlow.tsx` and asserts `not.toMatch(/VerdictStep/)` and `not.toMatch(/CollectionFitCard/)`.
- Decide explicitly whether `RecentlyEvaluatedRail` survives the redesign. If retained with a search-history flavor, wire it to the new search cache. If removed, delete it.
- Add "evaluate this watch on its detail page" copy to the new confirm screen entry copy, acknowledging the removed verdict step.

**Which phase:** The phase that rewires `AddWatchFlow` (VerdictStep removal phase).

---

### Pitfall 7: WatchForm status field — grail is in the type but the new confirm screen must expose it

**What goes wrong:** The existing `WatchStatus` union is `'owned' | 'wishlist' | 'sold' | 'grail'`. The current `VerdictStep` only offers Wishlist and Collection (owned) buttons — grail is only reachable via the manual path (`WatchForm` with no `lockedStatus`). SEED-010's stated goal is to close this gap. The risk is that the new confirm screen status picker renders only two or three options and silently drops grail, shipping the same bug under a new UI.

**Why it happens:** The `addWatch` Zod schema in `src/app/actions/watches.ts` already accepts all four statuses (line 27: `z.enum(['owned', 'wishlist', 'sold', 'grail'])`). The gap is purely in the confirm screen's status picker UI — not in the schema, not in the DAL, not in the Server Action. A developer building the status picker from scratch may copy the VerdictStep's 2-button pattern rather than consulting the full type.

**Symptom (user sees):** User cannot mark a watch as grail from the new add flow. Grail requires clicking "Edit details" to open WatchForm.

**Affected code locations:**
- `src/lib/types.ts` line 1 — `WatchStatus`
- `src/lib/constants.ts` — `WATCH_STATUSES` constant (must include grail and its label)
- New confirm screen component (does not exist yet)

**Prevention:** The confirm screen status picker must render all four statuses. Reference `WATCH_STATUSES` from `src/lib/constants.ts` as the source of truth — do not hard-code status options. Include a UAT requirement that explicitly verifies grail status can be set at add time from the primary search-first path.

**Which phase:** Confirm screen phase.

---

### Pitfall 8: Debounce too tight on search-as-you-type — flicker on every keystroke

**What goes wrong:** A 100ms debounce on a catalog search input fires a network request after almost every keystroke. With a round-trip to Supabase, each request takes 150–400ms, producing visible loading-state flicker and potentially issuing requests that complete out of order (if request N+1 resolves before request N, the stale result can overwrite the fresh one).

**Why it happens:** The existing `useSearchState` hook in Phase 16/19 uses 250ms debounce, which was chosen specifically to avoid this. A new developer writing a catalog search hook may pick a smaller number intuitively or copy the input without the AbortController pattern.

**Symptom (user sees):** Search results flicker, jump between states, or (in the out-of-order case) show results for a previous shorter query after the user has typed a longer query.

**Affected code locations:**
- New `useSearchState`-equivalent hook for catalog search (does not exist yet)
- Pattern to follow: `src/components/search/` — existing `useSearchState` with AbortController

**Prevention:** Use 250ms debounce minimum, matching Phase 16's documented choice. Use `AbortController` + `signal.aborted` check in the fetch callback to discard stale responses. Enforce a 2-character minimum before firing any request (matching Phase 16's `TRIM_MIN_LEN = 2` in `search.ts`). Add a test that verifies only one network request fires when the user types 5 characters within 200ms.

**Which phase:** Phase that introduces the catalog search input.

---

### Pitfall 9: `?returnTo=` round-trip broken across 8 entry points after flow rewire

**What goes wrong:** Phase 28 wired `?returnTo=` through 8 entry points with a server-side validator at `/watch/new` (server validates against an auth-callback regex, strips self-loops). The AddWatchFlow passes `initialReturnTo` down to `WatchForm` (as `returnTo` prop) and uses it in `handleWishlistConfirm`. If the v8.0 rewire introduces a new flow state (e.g., `search-result-picked` or `structured-confirm`) that commits via a different code path, that code path must thread `initialReturnTo` the same way or the user loses their entry-point context.

**Why it happens:** The `initialReturnTo` threading is deep and non-obvious — it is set in the page Server Component, passed as a prop to `AddWatchFlow`, and then explicitly forwarded to `WatchForm` and used in `handleWishlistConfirm` and `manualAction`. A developer adding a new commit path (e.g., confirm-screen commit that bypasses VerdictStep) may call `router.push(defaultDestinationForStatus(...))` directly without reading `initialReturnTo`.

**Symptom (user sees):** User arrives at `/watch/new?returnTo=/u/alice/wishlist` from Alice's profile, adds a watch via the new search flow, and lands on the home page instead of Alice's wishlist.

**Affected code locations:**
- `src/components/watch/AddWatchFlow.tsx` — `initialReturnTo` prop, `handleWishlistConfirm`, `manualAction`
- New confirm-screen commit handler (does not exist yet)
- `src/app/watch/new/page.tsx` — `?returnTo=` server-side validator

**Prevention:** Any new commit path in `AddWatchFlow` must use `initialReturnTo ?? defaultDestinationForStatus(status, viewerUsername)` as the navigation target — never `defaultDestinationForStatus` alone. Add a test that verifies `router.push` receives the `returnTo` value when it is set. Grep for all `router.push` callsites added in v8.0 as part of plan verification.

**Which phase:** Every phase that adds a new commit path.

---

### Pitfall 10: Activity-hide three-layer reset must extend to new search and structured-extract caches

**What goes wrong:** Phase 29's three-layer reset (`useLayoutEffect` cleanup-on-hide, StrictMode-safe ref guards, explicit reset before `router.push`) resets `url`, `rail`, and `state` in `AddWatchFlow`. The module-scope caches (`useWatchSearchVerdictCache`, `useUrlExtractCache`) are NOT reset by the three-layer mechanism — they are intentionally persistent across remounts. A new search-query cache or a new structured-extract cache added in v8.0 will also NOT be reset by the three-layer mechanism. This is correct behavior for verdict and URL-extract caches (they are stable across collection-state changes). But a search-term input state or a "typed fields" cache that is tied to the user's current add-watch session MUST be reset on Activity-hide, or a returning user sees stale in-progress search state.

**Why it happens:** The Phase 29 cleanup was designed for exactly the existing states. The developer who adds a search-input `useState` (for the query string, the results list, etc.) must explicitly include those in the `useLayoutEffect` cleanup body, or they survive the Activity-hide.

**Symptom (user sees):** User types "Rolex Sub" in the search box, navigates away, returns via browser back, and sees "Rolex Sub" pre-populated and stale results displayed before refetching.

**Affected code locations:**
- `src/components/watch/AddWatchFlow.tsx` — `useLayoutEffect` cleanup (lines 175–191)
- New search state variables (does not exist yet)

**Prevention:** Every new `useState` variable in `AddWatchFlow` that represents transient session state (search query, search results, typed structured-input fields) must be reset inside the `useLayoutEffect` cleanup. The cleanup body comment `// Real Activity-hide / unmount: user has accumulated state. Reset.` is the landmark — extend the reset block there. Do not add state without auditing the cleanup.

**Which phase:** Every phase that adds new React state to `AddWatchFlow`.

---

### Pitfall 11: `?manual=1` "Skip search" link must survive the new flow's entry states

**What goes wrong:** Phase 25 added `?manual=1` as a server-whitelisted query parameter that causes `AddWatchFlow` to start in `manual-entry` state, bypassing the paste/search step. Phase 28 extended `manualAction` to preserve `?returnTo=` through the manual-entry restart. In the v8.0 redesign, the headline entry surface is search (not paste), but `?manual=1` must still work — it is the CTAs on Collection and Wishlist empty states. If the redesign changes the `initialState` logic without updating the manual-entry guard, those CTAs break silently.

**Symptom (user sees):** Clicking "Add to Collection" from an empty collection empty-state lands the user on the search UI instead of the direct WatchForm, ignoring `?manual=1`.

**Affected code locations:**
- `src/components/watch/AddWatchFlow.tsx` lines 112–117 — `initialState` computation, `initialManual` prop
- `src/app/watch/new/page.tsx` — `?manual=1` server-side whitelist
- Empty-state CTAs that navigate to `/watch/new?manual=1`

**Prevention:** The v8.0 `initialState` priority order must be: `search-pick` deep-link > `manual-entry` (`?manual=1`) > new default entry (search). Test this by rendering `AddWatchFlow` with `initialManual: true` and asserting WatchForm renders directly, not the search input.

**Which phase:** Phase that rewires `AddWatchFlow`'s `initialState` for the new search-first default.

---

### Pitfall 12: Empty-state on first focus (before typing) — wrong affordance

**What goes wrong:** If the search input shows nothing before the user types (a blank box with no hint), first-time users interpret the add flow as broken or empty. If it shows a full list of all ~100 catalog rows before typing, it creates a false impression that Horlo has comprehensive catalog coverage (the catalog has ~100 rows; users searching for obscure references will hit no-match frequently).

**Why it happens:** No-match is the expected outcome for the majority of searches given current catalog depth (~100 rows). There is no precedent in the existing codebase for a search-first add UI.

**Symptom (user sees):** Either (a) blank page, interpreted as loading failure, or (b) a list of 100 random watches, inviting the user to browse rather than search, then hitting nothing when they type a specific reference.

**Prevention:** On first focus before typing: show a short "Type brand or model to search our catalog" hint inside the input area plus a "Skip search — add manually" link below. Explicitly do NOT show a pre-populated list. Document this as a design decision in the phase plan, not as a future polish item, to prevent it being implemented as "show all rows on focus" during development.

**Which phase:** Phase that implements the search input UI.

---

### Pitfall 13: Router Cache stale instance on confirm-screen back-navigation

**What goes wrong:** Per the durable lesson from Phase 56A (documented in PROJECT.md memory `project_router_cache_stale_instance.md`): Next.js 16 restores the SAME stale client component instance on revisited dynamic URLs. Key-remounting (`key=`) will not reset state if the component is inside the Activity window. If the confirm screen is a modal or step inside `AddWatchFlow` that renders a "Confirm" button and a "Go back" affordance, a user who clicks "Confirm", sees an error, and clicks "Go back" may find the confirm button disabled in a stale pending state.

**Why it happens:** Phase 61 and 56A established that one-shot state (like a "submitting" flag) must be reset on `onPointerDown` (interaction), not on mount or key-remount. A developer writing the confirm screen's submit logic with a `const [submitting, setSubmitting] = useState(false)` and setting it to `true` on click, then resetting it only in the success/error callback, creates a stale `submitting=true` state if the user navigates away mid-flight and returns.

**Symptom (user sees):** The confirm button appears permanently disabled after a failed submit + back-navigation within the 3-route Activity window.

**Prevention:** Reset one-shot state (`submitting`, `pending`) on `onPointerDown` of the button — not in an effect on mount. In `AddWatchFlow`'s confirm state, roll back to the pre-submit state on error (same pattern as `handleWishlistConfirm`'s rollback to `wishlist-rationale-open` on `addWatch` failure, line 437–443 in AddWatchFlow.tsx). Include the confirm state's submitting flag in the `useLayoutEffect` cleanup reset.

**Which phase:** Confirm-screen phase.

---

### Pitfall 14: `vitest static fs-guards` fail on Vercel prebuild when added without `@vitest-environment node`

**What goes wrong:** Any static guard that uses `readFileSync` or `readdirSync` to inspect source files (like `CollectionFitCard.no-engine.test.ts`) must declare `// @vitest-environment node` at the top. Without it, the test runs in jsdom, which externalizes `node:fs`, causing `readdirSync` to be undefined on Vercel's prebuild and silently failing or erroring the build.

**Why it happens:** Documented in memory `project_vitest_static_node_env.md` — this burned Phase 59's prod deploy. The existing `CollectionFitCard.no-engine.test.ts` does NOT have the directive (it uses `existsSync`/`readFileSync` directly). Any NEW static guards added for v8.0 (e.g., `AddWatchFlow.no-verdict-step.test.ts`) must have the directive.

**Symptom (user sees):** Vercel prebuild fails with a cryptic `readdirSync is not a function` or the static guard silently vacuous-passes on Vercel while failing locally.

**Prevention:** Every new file in `tests/static/` that uses any `node:fs` API must begin with `// @vitest-environment node`. Add a meta-static guard or include this as a required checklist item in every plan that creates a new static test.

**Which phase:** Any phase that adds a static guard test.

---

## Minor Pitfalls

---

### Pitfall 15: Disambiguation when brand+model match multiple references

**What goes wrong:** A user types "Rolex Submariner" and the catalog has three rows: ref 116610LN (black), ref 116610LV (green), ref 126610LN (current). The search results show all three. The user picks "Submariner" without reading the reference. They add the wrong reference to their collection.

**Prevention:** In the search results list, always show the reference number prominently alongside brand+model. If the reference is null on the catalog row, show "(no reference)" explicitly, not a blank. Add a disambiguation prompt on the confirm screen when the selected row has a null reference and siblings exist with the same brand+model. This is a UX design decision for the confirm screen phase, not a code bug, but must be in the phase plan's acceptance criteria.

**Which phase:** Search results UI phase and confirm screen phase.

---

### Pitfall 16: `#418 date-TZ hydration` — any date-only field formatted without `timeZone: 'UTC'`

**What goes wrong:** If the confirm screen or the new add-watch form renders a date field (`acquisitionDate`, `purchaseDate`) using `toLocaleDateString()` without `timeZone: 'UTC'`, Server UTC vs browser local timezone will produce a hydration mismatch (React Error #418) on Vercel.

**Why it happens:** Documented in memory `project_react_418_date_tz_hydration.md` — this was fixed in Phase 61 for `WatchDetail`/`WornTimeline`/`WornCalendar`. The fix is pinning `timeZone: 'UTC' + locale: 'en-US'`.

**Prevention:** Any new client component in v8.0 that formats a date-only field from a database string must use `{ timeZone: 'UTC', locale: 'en-US' }`. Grep for `toLocaleDateString` in v8.0 additions as part of plan verification.

**Which phase:** Any phase that introduces date display in the confirm screen.

---

### Pitfall 17: `drizzle-kit push` is LOCAL ONLY — if v8.0 adds schema, follow the four prod-push rules

**What goes wrong:** v8.0 is described as a flow+UX milestone with no new schema. But if a phase adds any new column (e.g., a `search_query` column, a structured-extract-specific column, or an audit trail), the local `drizzle-kit push` must be followed by `supabase db push --linked` on prod. Skipping the prod push means local works but prod throws a column-not-found error.

**Why it happens:** Documented in memory `project_drizzle_supabase_db_mismatch.md` and recurring across multiple milestones. The four prod-push gotchas: (1) migration filename must match exactly, (2) migration ordering matters, (3) extension schema differences, (4) enum-bound dependents — query `pg_depend` BEFORE writing enum cleanups.

**Prevention:** v8.0 phases should avoid schema changes by design. If a phase author determines a schema change is needed, it must follow the documented prod-push procedure. Include schema-change detection as an explicit checklist item in phase plan verifiers (`npm run db:generate && git diff --stat` check).

**Which phase:** Any phase that touches schema (verify none do for v8.0).

---

### Pitfall 18: `workflow.use_worktrees = false` is permanent — do not re-enable for build-gated phases

**What goes wrong:** If any v8.0 phase plan enables worktree isolation (`workflow.use_worktrees = true`) without realizing it is globally disabled, the phase executor creates a worktree that omits `.env.local`, and `DATABASE_URL` is undefined, causing `npm run build` to fail at the catalog DAL imports.

**Why it happens:** Documented in memory `execute_phase_no_worktree_when_db`. `workflow.use_worktrees = false` was set globally because the project is DB-touching and build-gated. The setting is stored in the project's GSD config.

**Prevention:** All v8.0 phase plans must not set `workflow.use_worktrees: true`. If a plan template defaults to `true`, the planner must explicitly override to `false`. Add a verification that `workflow.use_worktrees` is `false` before executing any phase.

**Which phase:** All v8.0 phases.

---

### Pitfall 19: `unstable_instant = false` on `/u/[username]/[tab]` must not be re-enabled

**What goes wrong:** Phase 52 locked `unstable_instant = false` as PERMANENT on the `/u/[username]/[tab]` route. If a v8.0 plan modifies the profile tab to surface "recently added" watches from the new add-flow and re-enables `unstable_instant`, it reintroduces the React #419 soft-nav abort bug.

**Prevention:** Do not modify `unstable_instant` on any existing route. If v8.0 introduces a new route, verify the correct Cache Components pattern (sync layout + Suspense + async RSC children) before any caching configuration.

**Which phase:** Not specifically a v8.0 phase risk unless profile tab routes are modified.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Catalog search DAL | N+1 viewer-state queries (Pitfall 2) | Single `inArray` batch after candidate pool; mirror Phase 16 pattern |
| Catalog search DAL | signOut cache not cleared (Pitfall 1) | Ship signOut cleanup in same phase as first new module-scope cache |
| Structured-input extraction | cheerio stages run on non-HTML input (Pitfall 3) | Branch on `mode` discriminant before reaching HTML extractors |
| Structured-input extraction | LLM hallucination on year/reference (Pitfall 4) | Pass only user-typed fields; set `productionYearIsEstimate = true` |
| Structured-input catalog write | Race condition overwrites correct row (Pitfall 5) | Use `upsertCatalogFromUserInput` (DO NOTHING) not DO UPDATE for structured path |
| VerdictStep removal | Stale tests + no guard on reintroduction (Pitfall 6) | Delete tests asserting verdict-in-add-flow; add static guard for AddWatchFlow |
| Confirm screen | grail not in status picker (Pitfall 7) | Drive picker from `WATCH_STATUSES` constant; UAT requirement for grail |
| Search input UI | Debounce too tight (Pitfall 8) | 250ms minimum, AbortController, 2-char minimum |
| Any new commit path | `?returnTo=` not threaded (Pitfall 9) | Always use `initialReturnTo ??` pattern; test explicitly |
| New `useState` in AddWatchFlow | Not reset on Activity-hide (Pitfall 10) | Add to `useLayoutEffect` cleanup block |
| `initialState` rewire | `?manual=1` broken (Pitfall 11) | Preserve manual-entry priority above new search-first default |
| Search input UX | Wrong empty-state on first focus (Pitfall 12) | Hint text + "Skip search" link; no pre-populated list |
| Confirm screen button | Router Cache stale pending state (Pitfall 13) | Reset on `onPointerDown`; roll back on error |
| New static test | Missing `@vitest-environment node` (Pitfall 14) | Every `tests/static/` file using `node:fs` must declare it |
| Date display in confirm | React #418 date-TZ hydration (Pitfall 16) | `timeZone: 'UTC'` + `'en-US'` on all `toLocaleDateString` calls |
| Any schema change | drizzle-kit push LOCAL ONLY (Pitfall 17) | `supabase db push --linked`; four prod-push rules apply |

---

## Distinction: Horlo-Specific vs Domain-General

### Horlo-Specific (locked decisions from prior phases — must not be revisited)

- **Module-scope caches + signOut** (Pitfall 1): The module-scope pattern was an explicit Phase 29 decision for cross-remount persistence. The signOut gap is documented Active tech debt in PROJECT.md. Any new cache must fix the gap, not extend it.
- **`workflow.use_worktrees = false`** (Pitfall 18): Globally locked per memory `execute_phase_no_worktree_when_db`. Not a suggestion.
- **`unstable_instant = false` on `/u/[username]/[tab]`** (Pitfall 19): Locked per Phase 52 durable fix. Re-enabling causes React #419.
- **`watches_catalog` not wipeable** (Pitfall 5 context): Data migrations key on `(brand, model, reference)`, not id. Local and prod catalog ids diverge. In-place ALTER only.
- **VerdictStep 3-button lock removes grail** (Pitfall 7): This is not a new discovery — SEED-010 explicitly documents it as the reason for the redesign. The confirm screen must close the gap.
- **Router Cache stale instance on `onPointerDown`** (Pitfall 13): Established durable pattern from Phase 56A; applies to every new one-shot button in the confirm screen.
- **`#418` date-TZ hydration** (Pitfall 16): Documented and fixed in Phase 61 for existing date surfaces; must carry forward.
- **Static guards need `@vitest-environment node`** (Pitfall 14): Burned Phase 59 prod deploy.
- **`drizzle-kit push` local only** (Pitfall 17): Multi-milestone recurring footgun.

### Domain-General (common to search-first add flows, not Horlo-specific)

- **N+1 viewer-state query on search results** (Pitfall 2): Universal anti-pattern in search DALs.
- **Cheerio short-circuit needed for non-HTML extraction** (Pitfall 3): Standard extraction-pipeline architecture issue.
- **LLM hallucination on reference-year combos** (Pitfall 4): Inherent to LLM-only extraction with no source document.
- **Debounce + AbortController for search-as-you-type** (Pitfall 8): Standard search UX pattern.
- **Empty-state UX on first focus** (Pitfall 12): Standard search UI design decision.
- **Disambiguation for multi-reference brand+model** (Pitfall 15): Standard catalog search UX.
- **Catalog UNIQUE race condition** (Pitfall 5): Common multi-user upsert pattern.

---

## Sources

- `src/components/watch/AddWatchFlow.tsx` — three-layer reset, cache hooks, FlowState machine
- `src/components/watch/VerdictStep.tsx` — 3-button status lock pattern
- `src/components/watch/WatchForm.tsx` — `lockedStatus` / `defaultStatus` semantics, status field
- `src/components/watch/useUrlExtractCache.ts` — module-scope cache pattern
- `src/components/search/useWatchSearchVerdictCache.ts` — module-scope cache + revision invalidation
- `src/app/api/extract-watch/route.ts` — 5-category error taxonomy, URL-only extraction path
- `src/app/actions/watches.ts` — `addWatch` Zod schema (4-status enum), catalog upsert precedence
- `src/data/catalog.ts` — `upsertCatalogFromUserInput` (DO NOTHING) vs `upsertCatalogFromExtractedUrl` (DO UPDATE COALESCE)
- `src/data/search.ts` — Phase 16 anti-N+1 pattern, debounce, CANDIDATE_CAP
- `src/lib/extractors/index.ts` — three-stage merge, `NON_AMBIGUOUS_FIELDS` priority
- `src/lib/types.ts` — `WatchStatus` union (4 values incl. grail)
- `tests/static/CollectionFitCard.no-engine.test.ts` — static guard pattern
- `.planning/PROJECT.md` — Active section (signOut cache gap, worktree lock, 3-layer reset, stale-instance)
- `.planning/seeds/SEED-010-v5.3-add-watch-redesign.md` — grail gap documentation, open questions
- Memory: `project_vitest_static_node_env.md`, `project_drizzle_supabase_db_mismatch.md`, `execute_phase_no_worktree_when_db`, `project_router_cache_stale_instance.md`, `project_react_418_date_tz_hydration.md`, `project_phase_52_in_progress.md`
