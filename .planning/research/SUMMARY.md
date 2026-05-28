# Project Research Summary

**Project:** Horlo v8.0 Add-Watch Redesign
**Domain:** Add-flow / search-first creation UX on an existing Next.js 16 + Supabase app
**Researched:** 2026-05-28
**Confidence:** HIGH

## Executive Summary

v8.0 is a flow and UX redesign against a fully-assembled stack — **zero new dependencies, zero new infrastructure, zero new DB tables**. The milestone restructures `AddWatchFlow` to lead with catalog search instead of URL paste, adds a `mode: 'structured'` branch to `/api/extract-watch` so brand+model+optional ref/year can seed LLM extraction without a URL, and replaces the locked 3-button `VerdictStep` with a lighter `ConfirmStep` that exposes all four statuses including grail. URL paste demotes to a "Have a URL for this watch?" backup on the no-match screen; manual entry survives as a "Skip search" link from the entry surface; `CollectionFitCard` drops from the add flow entirely (no changes to `/w/[ref]` — verdict still lives there from Phase 64).

Every capability needed already exists: `searchCatalogWatches` (Phase 19) is the search backbone; `extractWithLlm` + `claude-sonnet-4-6` strict tool-use (Phase 17 / 19.1) is the extraction backbone; shadcn primitives + `WATCH_STATUSES` constant cover the confirm screen; the `AddWatchFlow` discriminated-union state-machine pattern extends naturally to new branches. The risk surface is integration hazards from prior phases — module-scope cache hygiene, the cheerio-extractor short-circuit, the `(brand, model, reference)` race condition, the Phase 29 three-layer reset, and the `useWatchSearchVerdictCache` signOut-leak Active item — not novel architecture problems.

The milestone is small-to-medium scope: ~6 phases of composition + cleanup, no DB migration likely, full prod verification gated by the photo step (Phase 61) carrying through untouched via `WatchForm.onWatchCreated`.

## Key Findings

### Recommended Stack

**Zero new dependencies.** Every primitive needed is already installed. See `.planning/research/STACK.md` for the full audit.

**Core technologies (already in place):**
- **`@anthropic-ai/sdk` v0.88.0 + `claude-sonnet-4-6`** — extraction backbone; structured-input mode is a prompt-shape change, not a new model or library. Either keep the existing freeform-JSON + `validateAndCleanData` path (minimal diff) or use the SDK's `messages.parse` + `zodOutputFormat` (cleaner — same SDK already supports it).
- **`pg_trgm` GIN indexes + `searchCatalogWatches` DAL** — search backbone; at ~100 catalog rows no Algolia / fuse.js / external search service is warranted. Existing `viewerState` field on each row is the badge hook.
- **Shadcn `Select` + `Card` + `Button` + `RadioGroup` / segmented-control primitives** — confirm-screen UI; `WATCH_STATUSES` constant already includes `grail`.
- **Existing `useState<FlowState>` discriminated-union pattern** — state-machine; adding 2–3 new `kind` variants in `flowTypes.ts` is the right move, not xstate.
- **Existing module-scope cache hooks** — extended to `useCatalogSearchCache` + `useStructuredExtractCache`; signOut cleanup must ship with them, not deferred.

**Optional safe patch bumps:** Next 16.2.3 → 16.2.6, React 19.2.4 → 19.2.6. Not required for v8.0; treat as a separate pre-flight step if appetite exists.

### Expected Features

Eight feature categories surfaced in `.planning/research/FEATURES.md`. Highlights:

**Must have (table stakes):**
- Debounced search-as-you-type entry (250 ms; ≥2 chars to fire, ≥3 chars before "no match → add manually" shows) — backed by `searchCatalogWatches` + pg_trgm
- Catalog-match results list with `viewerState` badges (`owned` / `wishlist` / null) and brand+model+reference identity
- No-match path with structured-input fields (brand + model required; reference + year optional) + "Have a URL for this watch?" backup affordance
- Confirm screen with cover photo, identity (read-only), segmented status picker including **grail**, status-gated price field, "Edit details" escape to full `WatchForm`
- Manual entry stays reachable as "Skip search" link from the entry surface (`?manual=1` priority preserved)
- `addWatch` Server Action accepts optional `catalogId` so search-pick binds to existing catalog row without redundant upsert
- `?returnTo=` validated round-trip preserved from Phase 28
- Phase 29 three-layer reset extended to new structured-extract + search caches
- Phase 61 photo step survives untouched via `WatchForm.onWatchCreated` callback

**Should have (differentiator):**
- Clicking an "owned" search result redirects to `/w/[ref]` (Discogs / Letterboxd pattern) instead of opening the add flow
- Grail visually distinguished in the picker (lucide `Star` icon inline) rather than indistinct 4th radio
- Persistent "Not finding it?" nudge inside the results list, not just below — reduces dead-end friction
- Existing-in-collection guard with explicit "Already in your collection — add another copy" affordance for legit duplicates
- LLM-confidence calibration on structured-input output (low-confidence fields visually flagged on confirm screen)

**Defer (v8.x / v9.0+):**
- Catalog expansion (SEED-009 / v9.0)
- Fuzzy-typo tolerance beyond pg_trgm trigram threshold (only useful at higher catalog depth)
- LLM-generated reference-photo card preview pre-commit
- Search-history surface on the entry view (would be valuable; not in scope)

**Explicit anti-features:**
- `CollectionFitCard` in the add flow — operator decision; verdict lives only on `/w/[ref]`
- Any changes to `/w/[ref]` — out of scope this milestone
- New catalog rows from add flow without `(brand, model, reference)` natural-key dedup — would create duplicates

### Architecture Approach

The work is **composition + extension**, not new architecture. See `.planning/research/ARCHITECTURE.md` for the full integration map.

**Major components:**
1. **`/api/extract-watch` (extended)** — single route, discriminated body `{ mode: 'url', url: string } | { mode: 'structured', brand: string, model: string, reference?: string, year?: number }`; structured branch must short-circuit BEFORE the cheerio HTML stages (Pitfall 3); reuses existing Phase 25 D-15 5-category error taxonomy.
2. **`addWatch` Server Action (extended)** — Zod schema gains optional `catalogId: z.string().uuid()`; when supplied, action calls `getCatalogById(catalogId)` instead of `upsertCatalogFromUserInput`. Single 1-field schema diff.
3. **`searchCatalogForAddFlow` Server Action (new)** — wraps `searchCatalogWatches` with add-flow-specific JS post-sort (exact-reference-match bubbled to front; single `inArray` batch for `viewerState` to avoid N+1). Existing `/search` consumer of `searchCatalogWatches` untouched.
4. **`SearchEntryStep` (new component)** — debounced typeahead surface; results list with `viewerState` badges; persistent "Not finding it?" footer row; routes to `noMatch` or `matchPicked` state.
5. **`StructuredEntryPanel` (new component)** — 4-field form (brand/model/ref/year); URL-backup affordance below ("Have a URL for this watch?"); triggers `searchCatalogForAddFlow` Server Action call to the structured-extract path.
6. **`ConfirmStep` (new component)** — pure presenter; cover photo, identity readout, segmented status picker driven by `WATCH_STATUSES` so grail is structurally present; status-gated price; "Edit details" transitions into existing `WatchForm` inline; replaces `VerdictStep` + `WishlistRationalePanel` entirely.
7. **`AddWatchFlow` state machine rewrite** — new `FlowState` kinds: `searching`, `matchPicked`, `noMatch`, `structuredExtracting`, `confirm`, plus retained `form-prefill`, `manual-entry`, `photos-pending`; preserves `?manual=1` priority and `?returnTo=` round-trip; Phase 29 three-layer reset carries to new caches.
8. **Deprecated components removed:** `VerdictStep.tsx`, `WishlistRationalePanel.tsx`, `PasteSection.tsx` and their test files. `RecentlyEvaluatedRail` disposition TBD during Phase 5 planning (kept-but-repurposed vs. removed; depends on whether `useWatchSearchVerdictCache` survives).

### Critical Pitfalls

19 named pitfalls in `.planning/research/PITFALLS.md`. The top-leverage 6:

1. **Module-scope cache cross-user leak compounding** — `useUrlExtractCache` + `useWatchSearchVerdictCache` are module-scoped Maps that survive signOut (already-Active tech debt). Adding `useCatalogSearchCache` + `useStructuredExtractCache` without shipping signOut cleanup turns a 2-cache leak into a 4-cache leak. **Mitigation:** the phase that introduces new caches must bundle a `lastUserId` check that clears all four on user-switch.
2. **Cheerio short-circuit gap** — `extractWatchData` unconditionally runs all three HTML stages today; `mode: 'structured'` must branch BEFORE reaching them or cheerio processes a query string as HTML. **Mitigation:** integration test asserting no `cheerio` call for `mode === 'structured'`; explicit branch in the route handler.
3. **Catalog write race + wrong upsert variant** — structured-input extraction must use `upsertCatalogFromUserInput` (DO NOTHING + UNION ALL — preserves user-supplied values), NOT `upsertCatalogFromExtractedUrl` (DO UPDATE COALESCE — would let LLM-inferred year overwrite the correct null). **Mitigation:** assertion in the structured-mode handler; test using a known catalog row.
4. **VerdictStep removal regression set** — three sub-risks: stale tests asserting verdict-in-flow, no static guard preventing reintroduction (mirror `tests/static/CollectionFitCard.no-engine.test.ts` pattern), `RecentlyEvaluatedRail` cache dependency. **Mitigation:** the cleanup phase ships all three guards together with a `@vitest-environment node` directive.
5. **Owned-result redirect needs new DAL query** — clicking an owned search result navigates to `/w/[ref]`, but `searchCatalogWatches` doesn't return the user's watch `id` today. **Mitigation:** add `getWatchIdByCatalogId(userId, catalogId)` DAL helper; planner decides if it's P0 (in v8.0) or P2 (v8.x).
6. **Vitest static fs-guards need node env** — every new `tests/static/` file using `node:fs` must declare `// @vitest-environment node` or it passes locally and fails the Vercel prebuild (cost a Phase 59 prod deploy). **Mitigation:** include the directive on every new static guard added in v8.0.

## Implications for Roadmap

Based on research, suggested **6-phase** structure (Phase 66–71, continuing from v7.0's last phase 65):

### Phase 66: API Route Extension (no-URL structured mode)
**Rationale:** API contract change is independently testable and unblocks both component branches. Must land before any UI consumes it.
**Delivers:** `/api/extract-watch` discriminated body; structured-mode branch that short-circuits cheerio; integration tests.
**Addresses:** No-URL extraction feature category.
**Avoids:** Pitfalls 2, 3 (cheerio short-circuit + wrong upsert variant).

### Phase 67: Server Action + DAL Extensions
**Rationale:** Server-side seams the components will consume.
**Delivers:** `searchCatalogForAddFlow` Server Action with JS post-sort; `addWatch` gains optional `catalogId` passthrough; optional `getWatchIdByCatalogId` DAL helper if owned-redirect lands in v8.0.
**Uses:** Existing `searchCatalogWatches`, `getCatalogById`, `upsertCatalogFromUserInput`.
**Implements:** Architecture components 2 + 3.
**Parallelizable with Phase 66.**

### Phase 68: ConfirmStep Component
**Rationale:** Highest-leverage new UI — the heart of the redesign. Builds in isolation before flow wiring.
**Delivers:** `ConfirmStep` pure presenter; segmented status picker driven by `WATCH_STATUSES`; "Edit details" → `WatchForm` inline; component tests.
**Addresses:** Confirm Screen + Status Selection feature categories; grail-add-time fix.

### Phase 69: SearchEntry + StructuredEntryPanel
**Rationale:** Two coordinated entry surfaces; share the new module-scope caches.
**Delivers:** `SearchEntryStep` typeahead, `StructuredEntryPanel` 4-field form, URL-backup affordance, new `useCatalogSearchCache` + `useStructuredExtractCache` **shipped together with signOut cleanup for all four module-scope caches** (closes existing tech debt in the same change).
**Addresses:** Search Entry + No-Match Path feature categories.
**Avoids:** Pitfall 1 (module-scope cache cross-user leak).
**Parallelizable with Phase 68.**

### Phase 70: AddWatchFlow State Machine Rewrite
**Rationale:** Wires Phases 66–69 together; biggest integration risk; depends on all four upstream phases. May warrant a split into 69a/69b during plan-phase if the state-machine + cache-survival diff balloons.
**Delivers:** Rewritten `FlowState` discriminated union; new render branches; `?manual=1` priority preserved; `?returnTo=` round-trip intact; Phase 29 three-layer reset extended.
**Uses:** All artifacts from Phases 66–69.
**Avoids:** State-machine regression and Phase 29 regression set.

### Phase 71: Dead Code Cleanup + Static Guards
**Rationale:** Subtractive phase enforcing the new flow as canonical.
**Delivers:** `VerdictStep.tsx` + `WishlistRationalePanel.tsx` + `PasteSection.tsx` (+ test files) deleted; `tests/static/AddWatchFlow.no-verdict-step.test.ts` (`@vitest-environment node`); `tests/static/AddWatchFlow.no-collection-fit-card.test.ts` (mirror Phase 20 pattern); `RecentlyEvaluatedRail` disposition resolved.
**Avoids:** Pitfall 4 (VerdictStep regression set), Pitfall 6 (vitest static fs-guard node-env requirement).

### Phase Ordering Rationale

- **66 + 67 in parallel (server-side seams), then 68 + 69 in parallel (UI), then 70 (wire), then 71 (cleanup)** — respects the DAL→API→component dependency chain while pulling forward what can ship in parallel.
- **Cleanup last (Phase 71)** so the dead-code static guards activate only after the new flow proves stable on prod via Phase 70 verification.
- **Caches + signOut cleanup bundled into Phase 69, not split** — operator-stated Pitfall 1 mitigation requires shipping cache hygiene alongside cache introduction.
- **No DB migration phase** — schema is unchanged.
- **Photo step (Phase 61) survives untouched** — `WatchForm.onWatchCreated` callback contract is the seam.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 70 (AddWatchFlow rewrite):** state-machine has 15+ transitions including back-nav edge cases (Phase 29), StrictMode spurious cleanup, Activity-hide reset, deep-link short-circuit. May warrant split 70a/70b during plan-phase. The Phase 29 decisions are densely commented in current code and need careful carry-forward.
- **Phase 66 (no-URL prompt design):** the structured-context prompt wording needs to be written and evaluated; LLM accuracy on obscure references is the LOW-confidence area. Plan-phase researcher should probe Anthropic prompt-engineering docs for "infer from sparse structured input" patterns.

Phases with standard patterns (skip research-phase):
- **Phase 67 (Server Action + DAL):** direct Phase 19 + Phase 23 templates to follow.
- **Phase 68 (ConfirmStep):** direct shadcn + `WatchForm` templates to follow.
- **Phase 69 (Search + Structured entry):** direct Phase 16 `useSearchState` + Phase 20.1 `AddWatchFlow` cache templates to follow.
- **Phase 71 (Cleanup):** direct Phase 20 `CollectionFitCard.no-engine.test.ts` template to follow.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Live `npm show` queries; `messages.parse` confirmed in installed SDK; all shadcn primitives verified |
| Features | HIGH for must-haves / MEDIUM for differentiators | Letterboxd / Discogs / Goodreads patterns confirmed; owned-redirect is industry standard; grail-icon treatment is domain-specific |
| Architecture | HIGH | All primary source files read directly; `addWatch` schema change verified against `insertWatchSchema`; state-machine transitions traced |
| Pitfalls | HIGH | All 19 pitfalls traced to specific file locations and prior-phase decisions |

**Overall confidence:** HIGH

### Gaps to Address

- **No-URL prompt wording + low-confidence-reference fallback strategy** — research couldn't pre-write the prompt; Phase 66 will need a small evaluation set (10 references — mix of well-known + obscure) and a written confidence-threshold decision.
- **`RecentlyEvaluatedRail` fate** — depends on whether `useWatchSearchVerdictCache` survives in some form. Plan-phase decision in Phase 70 or Phase 71.
- **Owned-result redirect — v8.0 P0 or v8.x P2?** — owner-stated nice-to-have in FEATURES.md; if it lands in v8.0 it lives in Phase 67 (DAL helper) and Phase 69 (click handler); if it slips it's a one-PR follow-up.
- **`?manual=1` priority preservation during state-machine rewrite** — Phase 70 must not regress this; explicit test required.

## Sources

### Primary (HIGH confidence)
- Direct source reads: `AddWatchFlow.tsx`, `PasteSection.tsx`, `VerdictStep.tsx`, `WishlistRationalePanel.tsx`, `WatchForm.tsx`, `extract-watch/route.ts`, `actions/watches.ts`, `lib/extractors/llm.ts`, `lib/extractors/index.ts`, `data/search.ts` / `data/catalog.ts`, `lib/types.ts`
- `.planning/PROJECT.md` — Active tech debt, Key Decisions across all prior phases
- `.planning/seeds/SEED-010-v5.3-add-watch-redesign.md` — original seed
- `package.json` + live `npm show` for version checks

### Secondary (MEDIUM confidence)
- Letterboxd / Discogs / Goodreads / Spotify add-to-library UX patterns (web research)
- W3C ARIA APG combobox + listbox patterns
- Gravity UI / Atlassian / IBM Carbon segmented-control docs

### Tertiary (LOW confidence)
- LLM accuracy on obscure watch references (Phase 66 will produce empirical data)

---
*Research completed: 2026-05-28*
*Ready for roadmap: yes*
