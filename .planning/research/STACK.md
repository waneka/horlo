# Stack Research

**Domain:** v8.0 Add-Watch Redesign — search-first add flow
**Researched:** 2026-05-28
**Confidence:** HIGH

## Verdict: No New Dependencies Required

Every capability v8.0 needs is covered by the existing stack. The finding below is organized by the six questions asked, then distilled into an explicit dependency decision table.

---

## Question-by-Question Findings

### 1. Search-as-you-type entry: new search library or reuse `pg_trgm` + `searchCatalogWatches`?

**Reuse as-is. No new library or index changes needed.**

`searchCatalogWatches` in `src/data/catalog.ts` already does:
- `brand_normalized ILIKE %lowerQ%`, `model_normalized ILIKE %lowerQ%`, `reference_normalized ILIKE %refNorm%`
- Popularity-DESC + alphabetical tie-break
- Viewer-state hydration (owned/wishlist badge on results)
- Facet filtering (movement, size, style, brand, era)
- 2-char minimum + pre-LIMIT 50 candidate cap

The admin `WatchPicker` component (`src/components/admin/WatchPicker.tsx`) already demonstrates exactly the search-as-you-type pattern for catalog search: `useState` debounce (200ms via `setTimeout`), `searchCatalogForPicker` Server Action (which calls `searchCatalogWatches`), positioned dropdown with `listbox`/`option` roles. The v8.0 search entry is a purpose-built version of that component, not a new search stack.

The catalog is small (~100 rows at launch, growing slowly). `pg_trgm` GIN indexes on `brand` and `model` already exist from Phase 17/19. No Algolia, MeiliSearch, typesense, or client-side fuse.js is warranted — those libraries exist to compensate for databases that can't do fast text search, not Postgres with GIN indexes.

**The only new piece** is a thin Server Action (or Server Action reuse) callable from within `AddWatchFlow` on the add-watch surface. `searchCatalogForPicker` already exists and could be reused directly, or a new `searchCatalogForAddFlow` action could be added if the return shape needs to differ (e.g., to include catalog thumbnail, user's existing verdict, or watch-detail fields not in `SearchCatalogWatchResult`). That is a phase-design decision, not a stack decision.

### 2. No-URL structured-input extraction: same SDK and pattern, `cheerio` dropped for this code path?

**Same `@anthropic-ai/sdk` at `^0.88.0`, same `claude-sonnet-4-6`, same strict tool-use or the newer `messages.parse` API. `cheerio` is not needed for this path.**

The no-URL extraction flow receives brand + model + optional reference/year from the user and sends that directly to the LLM as a text prompt, with no HTML to parse. The extractor's `extractReadableText(html)` step and `cheerio` are strictly for the URL-fetch path. The new code path is:

```
user fields (brand, model, ref?, year?) → prompt string → client.messages.create() → validateAndCleanData()
```

The current `extractWithLlm` in `src/lib/extractors/llm.ts` uses a plain `messages.create` call with a freeform JSON prompt and regex-based JSON extraction (`/\{[\s\S]*\}/`). This works but is fragile (WR-06 comment documents exactly this). The no-URL path is a clean opportunity to use the SDK's `messages.parse` + `zodOutputFormat` API, which was available as of SDK 0.72.0 and confirmed present in the installed 0.88.0 (`client.messages.parse` is type `function` in the installed version).

However, migrating the existing URL extractor to `messages.parse` is a refactor concern for a separate phase. For v8.0, the recommended approach is to write the no-URL extractor as a second function (e.g., `extractFromQuery`) in the same `llm.ts` file or a new `src/lib/extractors/structured.ts`, using whichever API the phase team prefers. Both approaches are valid:

- **Option A (minimal diff):** Copy the prompt + `validateAndCleanData` logic from `extractWithLlm`, drop the HTML/cheerio preamble, adjust the prompt to say "You are filling in specs for a watch described by the user as: brand=X, model=Y, ref=Z, year=W. Fill in what you know." Output is still freeform JSON parsed by the existing regex + `validateAndCleanData`.
- **Option B (cleaner):** Write a new function using `client.messages.parse` with `zodOutputFormat(ExtractedWatchDataSchema)`. This eliminates the regex fragility and produces typed output directly. Requires adding a Zod schema mirroring `ExtractedWatchData` — Zod 4 is already in `package.json` at `^4.3.6`, latest is 4.4.3 (pin-bump is optional but safe).

**No prompt-engineering libraries are warranted.** The prompt for the no-URL path is simpler than the URL-extract prompt because there is no HTML noise — the user has already provided structured signal (brand/model). Langchain, llamaindex, and similar prompt-orchestration libraries add hundreds of KB of dependencies and abstract over patterns that are trivial to write directly when calling a single model endpoint.

**`cheerio` stays in `package.json`** because the URL-extract path still uses it. It just does not appear in the new code path.

### 3. Lighter confirm screen: existing shadcn primitives sufficient?

**Yes. No new UI components needed.**

The confirm screen replaces `VerdictStep`'s 3-button lock with a lighter review-and-commit screen. The required primitives are all present:

| UI need | Existing component |
|---------|-------------------|
| Status picker (owned / wishlist / grail / sold) | `Select` from `src/components/ui/select.tsx` — already used in `WatchForm` for status |
| Card container for spec preview | `Card`, `CardContent` — already in `VerdictStep` |
| Key field edits (brand, model, ref) | `Input`, `Label` — in `WatchForm` |
| Grail status | `Select` with `WATCH_STATUSES` constant — `grail` is already in the enum, `WatchForm` already renders it |
| Fit card (CollectionFitCard) | `CollectionFitCard` — already in `VerdictStep`, can be reused |
| Submit / back buttons | `Button` |
| Loading states | `Loader2` from `lucide-react` — already used throughout |

`grail` is already in `WATCH_STATUSES` at `src/lib/constants.ts`. The confirm screen's status picker is a `Select` using that same constant — the only new work is surfacing grail at this step rather than hiding it behind `VerdictStep`'s 3-button lock.

No `RadioGroup` import is needed from shadcn; the existing `Select` pattern from `WatchForm` is the established convention for status selection.

### 4. State machine: add xstate, or keep the useState/discriminated-union pattern?

**Keep the existing pattern. xstate is not warranted.**

`AddWatchFlow` already manages a 9-state discriminated union (`FlowState` in `src/components/watch/flowTypes.ts`) using `useState<FlowState>`. The v8.0 redesign adds roughly 2-3 new states to the union:

- `searching` (user is typing in the catalog search box)
- `search-result-selected` (user picked a catalog row; pre-confirm)
- `confirm` (the new lighter confirm screen, replacing `verdict-ready` + `wishlist-rationale-open` + `form-prefill` merge)

The existing pattern handles this cleanly. Adding states to a discriminated union is O(1) complexity — add a new `| { kind: 'confirm'; ... }` branch, add a render branch in the JSX, done.

xstate adds ~60KB minified, a visual-state-machine mental model, and a YAML/JSON config layer that is not used anywhere else in this codebase. The project uses Zustand (not Redux, not Context, not observable streams), and the local flow state has stayed coherent across 9+ phases of development with the existing pattern. There is no debugging deficit, no state-transition ambiguity, and no concurrent-state problem that xstate uniquely solves here.

**Do not add xstate.**

### 5. Version updates that would help v8.0?

| Package | Installed | Latest (npm) | Recommendation |
|---------|-----------|--------------|---------------|
| `next` | 16.2.3 | 16.2.6 | **Patch bump** — 3 patch versions; safe, no breaking changes expected |
| `react` / `react-dom` | 19.2.4 | 19.2.6 | **Patch bump** — safe |
| `@anthropic-ai/sdk` | 0.88.0 | 0.100.0 | **Minor bump** — 0.90.0 adds claude-opus-4-7 + user_profiles; no breaking API changes in the `messages.create` / `messages.parse` surface used by this project. Bumping unlocks `messages.parse` + `zodOutputFormat` if Option B is chosen for the no-URL extractor. Bumping is low-risk but not required; 0.88.0 already has `messages.parse`. |
| `zod` | ^4.3.6 | 4.4.3 | Minor-compatible, bump is optional |
| `drizzle-orm` | ^0.45.2 | 0.45.2 | Already at latest |
| `drizzle-kit` | ^0.31.10 | 0.31.10 | Already at latest |

**What to actually do for v8.0:** The patch bumps for Next and React are safe and advisable (the project already tracks `^` so they will install on fresh `npm install` if the pinned version is updated). The SDK bump from 0.88.0 to the latest is safe if the team wants `messages.parse` on the new code path; if sticking with Option A (freeform JSON), 0.88.0 is fine.

**Do not bump as part of a feature phase plan.** Version bumps belong in a dedicated patch phase or as a pre-flight step before the milestone, not mixed into feature plans, because they can unexpectedly surface type changes.

### 6. Rich text / markdown editor for the confirm screen notes field?

**No. Keep the plain `<Textarea>`.**

Notes already exist as a plain textarea in `WatchForm`. The confirm screen is a lighter pass than `WatchForm`, not a heavier one. The project has `react-markdown` + `rehype-sanitize` in `package.json` for rendering markdown in the feed (comments/notes display), but there is no markdown editor input anywhere in the codebase — and there should not be one here. Collector notes are short freeform annotations, not documents. Adding a markdown editor (e.g., `@uiw/react-md-editor`, TipTap, Quill) would introduce hundreds of KB of dependencies, a new UX convention, and a sanitization surface for a field that displays in markdown already via `react-markdown`. The delta is not justified.

---

## Recommended Stack (delta from existing)

### New Dependencies

None. Zero new packages are required.

### Modified Code Surfaces

| File | Change |
|------|--------|
| `src/lib/extractors/llm.ts` or new `src/lib/extractors/structured.ts` | Add `extractFromQuery(brand, model, ref?, year?)` — no new imports beyond existing SDK; drops `cheerio` call for this path |
| `src/app/api/extract-watch/route.ts` | Add a branch for `{ brand, model, ref?, year? }` body shape (no `url`); routes to new `extractFromQuery` instead of `fetchAndExtract` |
| `src/components/watch/flowTypes.ts` | Add `searching`, `search-result-selected`, and `confirm` state shapes to `FlowState` discriminated union |
| `src/components/watch/AddWatchFlow.tsx` | Add handlers for new states; demote `PasteSection` to secondary surface |
| `src/components/watch/` (new files) | `SearchEntryStep.tsx` (catalog search UI), `ConfirmStep.tsx` (lighter confirm replacing VerdictStep) |

### What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Algolia / MeiliSearch / typesense | Catalog is ~100 rows; Postgres ILIKE + GIN indexes are faster at this scale than an external service | `searchCatalogWatches` (existing) |
| fuse.js or any client-side fuzzy search | Adds a bundle, moves search logic off-server, loses the viewer-state hydration (owned/wishlist badges) that `searchCatalogWatches` already does | `searchCatalogWatches` via Server Action |
| xstate | ~60KB bundle; no concurrent-state problem exists; existing `useState<FlowState>` discriminated union has served 9+ phases without issues | Continue `useState<FlowState>` pattern |
| langchain / llamaindex / any prompt library | Single-endpoint LLM call; no chain, no agent, no retrieval; library adds indirection with no benefit | Direct `@anthropic-ai/sdk` call |
| react-hook-form or formik | `WatchForm` already manages its own controlled state with `useState`; confirm screen is a lighter surface, not a new full form | Controlled inputs with `useState` as in `WatchForm` |
| Markdown editor (TipTap, Quill, @uiw/react-md-editor) | Notes field is a short freeform text annotation; no rich-text need; `react-markdown` already handles display | `<Textarea>` as in `WatchForm` |
| Separate `extractions` table or persistent draft state | The flow is ephemeral client-side state; persisting drafts adds a new DB surface for a minor UX improvement | In-memory `FlowState` as today |

## Alternatives Considered

| Area | Recommended | Alternative Considered | Why Not |
|------|-------------|----------------------|---------|
| No-URL LLM output parsing | Option A (freeform JSON + existing `validateAndCleanData`) or Option B (`messages.parse` + Zod schema) | External prompt template library (e.g. Instructor.js) | Instructor.js is a thin wrapper over exactly what the SDK now provides natively via `messages.parse`; adds a dependency with no capability gain |
| Search UI pattern | `WatchPicker`-style debounced Input + listbox | Popover + Command pattern (shadcn cmdk) | cmdk is not in the component library; the `WatchPicker` pattern is already established in the codebase and requires no new package |
| State machine | `useState<FlowState>` | xstate | See §4 above |

## Installation

No new packages to install. Optional patch bumps only:

```bash
# Optional safe patch bumps (not required for v8.0 feature work)
npm install next@16.2.6 react@19.2.6 react-dom@19.2.6
```

## Integration Points Summary

| v8.0 capability | Existing hook | Integration note |
|-----------------|---------------|-----------------|
| Catalog search entry | `searchCatalogWatches` via Server Action | Reuse or thin-wrap `searchCatalogForPicker`; return type may need thumbnail + verdict fields |
| No-URL LLM extraction | `extractWithLlm` prompt + `validateAndCleanData` | Extract shared helpers; new `extractFromQuery` function alongside it |
| Route handler no-URL mode | `POST /api/extract-watch` | Add body-shape branch: `if (body.brand && !body.url)` routes to `extractFromQuery` |
| Lighter confirm screen | `VerdictStep` (spec preview, CollectionFitCard) + `WatchForm` (field editor, status Select) | New `ConfirmStep` component; compose spec preview from `VerdictStep`, status Select from `WatchForm`, submit via existing `addWatch` Server Action |
| Grail in confirm | `WATCH_STATUSES` constant, `WatchForm` Select | Already in the constant and the form; just surface it on the new confirm screen instead of hiding behind VerdictStep |
| FlowState extension | `flowTypes.ts` discriminated union | Add 2-3 new `kind` variants; backward compatible |
| URL-paste demotion | `PasteSection` | Move to secondary affordance on no-match screen; no delete required |

## Sources

- `src/data/catalog.ts` lines 261–380 — `searchCatalogWatches` implementation (HIGH confidence; read directly)
- `src/components/admin/WatchPicker.tsx` — established debounced search-as-you-type pattern (HIGH confidence; read directly)
- `src/lib/extractors/llm.ts` — URL extractor; no-URL path omits `extractReadableText`/`cheerio` entirely (HIGH confidence; read directly)
- `src/lib/taste/enricher.ts` — `messages.create` + `tool_choice: { type: 'tool' }` strict pattern (HIGH confidence; read directly)
- `src/components/watch/flowTypes.ts` — existing 9-state `FlowState` discriminated union (HIGH confidence; read directly)
- `src/components/watch/AddWatchFlow.tsx` — state machine orchestrator (HIGH confidence; read directly)
- `/anthropics/anthropic-sdk-typescript` via Context7 — `messages.parse` + `zodOutputFormat` available in SDK 0.72.0+; confirmed present in installed 0.88.0 via Node probe (HIGH confidence)
- `npm show next version` → 16.2.6; `npm show @anthropic-ai/sdk@latest version` → 0.100.0 (HIGH confidence; live npm query)
- `package.json` — all installed deps and versions (HIGH confidence; read directly)

---
*Stack research for: v8.0 Add-Watch Redesign (search-first add flow)*
*Researched: 2026-05-28*
