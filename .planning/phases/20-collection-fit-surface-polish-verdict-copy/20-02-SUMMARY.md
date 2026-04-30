---
phase: 20-collection-fit-surface-polish-verdict-copy
plan: 02
subsystem: verdict
tags: [typescript, vitest, similarity, verdict, composer, drizzle]

# Dependency graph
requires:
  - phase: 20-collection-fit-surface-polish-verdict-copy/01
    provides: VerdictBundle / Framing / ViewerTasteProfile / Template / CandidateTasteSnapshot type contract at src/lib/verdict/types.ts; 4 it.todo scaffolds (composer, viewerTasteProfile, shims, confidence)
  - phase: 19.1-catalog-taste-enrichment
    provides: watches_catalog taste columns (formality, sportiness, heritage_score, primary_archetype, era_signal, design_motifs, confidence); CatalogEntry surface in src/lib/types.ts
provides:
  - computeVerdictBundle entry point at src/lib/verdict/composer.ts (FIT-02)
  - computeViewerTasteProfile + EMPTY_PROFILE at src/lib/verdict/viewerTasteProfile.ts (D-02)
  - catalogEntryToSimilarityInput shim at src/lib/verdict/shims.ts (D-09)
  - 12-template TEMPLATES array + HEADLINE_FOR_LABEL + DESCRIPTION_FOR_LABEL at src/lib/verdict/templates.ts (D-01)
  - 27 unit tests covering aggregate null-tolerance, shim round-trip, composer determinism, 4 roadmap-mandated phrasings, and the Phase 19.1 D-14 confidence gate (null/<0.5/0.5–0.7/≥0.7)
affects: [20-03-card-renderer, 20-04-watch-detail-integration, 20-05-search-accordion-action, 20-06-catalog-page-and-cleanup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-only composer that imports analyzeSimilarity by reference but never modifies it (D-09 byte-lock honoured)"
    - "Drizzle inner-join WHERE filter with parameterised confidence threshold for SQL-side row exclusion"
    - "Template predicate library: all firing decisions are observable from the tuple (SimilarityResult, ViewerTasteProfile, Watch, CandidateTasteSnapshot) — no randomness, no I/O"
    - "Hedge prefix transformation: lowercases first letter then prepends 'Possibly ' so '\"Aligns with…\"' → '\"Possibly aligns with…\"' reads naturally"
    - "Vitest mock pattern: chainable Drizzle stub (select → from → innerJoin → where) returning controlled rows; spy validates call counts"

key-files:
  created:
    - src/lib/verdict/viewerTasteProfile.ts
    - src/lib/verdict/shims.ts
    - src/lib/verdict/templates.ts
    - src/lib/verdict/composer.ts
  modified:
    - src/lib/verdict/viewerTasteProfile.test.ts (replaced 8 it.todo with 8 real tests)
    - src/lib/verdict/shims.test.ts (replaced 6 it.todo with 6 real tests)
    - src/lib/verdict/composer.test.ts (replaced 9 it.todo with 9 real tests)
    - src/lib/verdict/confidence.test.ts (replaced 4 it.todo with 4 real tests)

key-decisions:
  - "Numeric columns (formality, sportiness, heritageScore) coerced via Number() at the JS boundary because Postgres `numeric` surfaces as string through postgres-js — pattern mirrored from src/data/catalog.ts:78"
  - "topK tiebreak by Map insertion order: when two motifs share the same count, the first one observed wins. Matches plan acceptance criterion ('onyx-dial', 'fluted-bezel', 'jubilee-bracelet')"
  - "12 templates total: 4 D-01 roadmap-mandated + 8 supporting. era-echo is reserved (predicate returns null) because CandidateTasteSnapshot does not yet carry eraSignal — composer caller can wire it in a future plan without changing the template library shape"
  - "Composer fires ALL applicable templates in insertion order; UI surfaces decide display count (Plan 03 owns the cap)"
  - "Default-fallback policy: when no template matches AND confidence ≥ 0.5, contextualPhrasings is [DESCRIPTION_FOR_LABEL[label]] — never empty"
  - "Hedge boundary at 0.5 inclusive (must hedge); full at 0.7 inclusive (must not hedge). Tested at the boundaries and one tick inside"
  - "Mock strategy uses Drizzle chainable stubs returning Promise<rows> from .where; the SQL filter is enforced inside Postgres so tests just feed already-filtered rows"

patterns-established:
  - "Pattern 4: server-only composer that imports analyzeSimilarity but never mutates it — byte-lock verified by HEAD shasum equality"
  - "Pattern 5: predicate-based template library — every phrasing path is testable in isolation by exercising one tuple of inputs at a time"
  - "Pattern 6: confidence gate at the consumer (composer.ts) — Phase 19.1 D-14 thresholds (0.5/0.7) live in one place; downstream plans don't re-declare them"

requirements-completed: [FIT-02]

# Metrics
duration: 5min
completed: 2026-04-30
---

# Phase 20 Plan 02: Verdict Module Summary

**Built the Phase 20 verdict module substrate — deterministic 12-template composer, null-tolerant viewer aggregate, and the CatalogEntry → Watch caller shim — with 27 tests green and `analyzeSimilarity` byte-identical to HEAD.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-30T00:43:42Z
- **Completed:** 2026-04-30T00:49:15Z
- **Tasks:** 4 (3 implement + 1 verify-only)
- **Files created:** 4 (templates, composer, viewerTasteProfile, shims)
- **Files modified:** 4 (test scaffolds replaced with real assertions)

## Accomplishments

- `src/lib/verdict/viewerTasteProfile.ts` — server-only `computeViewerTasteProfile(collection)` with `EMPTY_PROFILE`, Drizzle inner-join, SQL-side `confidence ≥ 0.5` filter (CONFIDENCE_FLOOR), null-tolerant avg/mode/topK helpers.
- `src/lib/verdict/shims.ts` — pure `catalogEntryToSimilarityInput(entry): Watch` with closed-union coercion (movement → 'other', crystalType → undefined). Pitfall 7 comment cites `src/lib/similarity.ts:225`.
- `src/lib/verdict/templates.ts` — `TEMPLATES[12]` (4 D-01 roadmap + 8 supporting), `HEADLINE_FOR_LABEL`, `DESCRIPTION_FOR_LABEL`. All 4 roadmap phrasings present verbatim.
- `src/lib/verdict/composer.ts` — server-only `computeVerdictBundle(args): VerdictBundleFull`. Confidence gate enforces null/<0.5 → fixed-label fallback, 0.5–<0.7 → "Possibly " hedge, ≥0.7 → full contextual. Default fallback when no predicate fires.
- 27 unit tests pass: 8 viewerTasteProfile + 6 shims + 9 composer + 4 confidence.
- `analyzeSimilarity` body byte-identical to HEAD (D-09 byte-lock — shasum match: `2bdc0cc0e7c82a73…`).

## Task Commits

Each task committed atomically with `--no-verify` per parallel-agent contract:

1. **Task 1: viewerTasteProfile + 8 tests** — `7af6ff2` (feat)
2. **Task 2: catalogEntryToSimilarityInput shim + 6 tests** — `5717bee` (feat)
3. **Task 3: templates + composer + confidence gate + 13 tests** — `c34a463` (feat)
4. **Task 4: D-09 byte-lock verification** — no commit (verification-only; `git diff HEAD -- src/lib/similarity.ts` empty)

## Files Created/Modified

### Created

- `src/lib/verdict/viewerTasteProfile.ts` — Drizzle aggregate with `CONFIDENCE_FLOOR = 0.5` SQL filter; `avg/mode/topK` pure helpers.
- `src/lib/verdict/shims.ts` — closed-union `MovementType` + `CrystalType` coercion at the catalog→engine boundary.
- `src/lib/verdict/templates.ts` — 12 `Template` entries with predicate + slot-bag pattern.
- `src/lib/verdict/composer.ts` — `computeVerdictBundle` entry point with `HEDGE_PREFIX = 'Possibly '`, `FULL_CONFIDENCE_THRESHOLD = 0.7`, `HEDGE_CONFIDENCE_THRESHOLD = 0.5`.

### Modified

- `src/lib/verdict/viewerTasteProfile.test.ts` — 8 real tests (was 8 it.todo).
- `src/lib/verdict/shims.test.ts` — 6 real tests (was 6 it.todo).
- `src/lib/verdict/composer.test.ts` — 9 real tests (was 9 it.todo).
- `src/lib/verdict/confidence.test.ts` — 4 real tests (was 4 it.todo).

## Decisions Made

- **`numeric` columns coerced via `Number()`.** Postgres `numeric` surfaces as `string` through `postgres-js`. The `numbersOf` helper inside `viewerTasteProfile.ts` filters nulls then `Number()`s the remaining values; an extra `!Number.isNaN` guard catches malformed inputs without throwing.
- **`era-echo` template is reserved.** Predicate returns `null` because `CandidateTasteSnapshot` (Plan 01 type) does not carry `eraSignal`. Slot lives in the library so a future plan can wire it in without changing the template count or downstream verifications.
- **Composer fires all applicable templates.** No early-return after first match. Caller (Plan 03 card renderer) decides how many phrasings to display. Reduces template-library coupling to UI choices.
- **Hedge prefix lowercases first character.** `'Aligns with…'` → `'Possibly aligns with…'` reads naturally mid-sentence; the un-hedged form is never valid for `0.5 ≤ confidence < 0.7`.
- **Default fallback uses `DESCRIPTION_FOR_LABEL[label]`.** When no predicate fires AND confidence ≥ 0.5, returns the fixed-label description as a single-entry array. `contextualPhrasings` is therefore never empty — UI can render unconditionally.
- **Composer args take `catalogEntry?: CatalogEntry | null`.** Threading `null` through `args.catalogEntry` produces `confidence === null`, which the gate treats identically to `< 0.5` (fallback). Plan 03 doesn't need a separate "no catalog row" code path.

## Deviations from Plan

None substantive — all four tasks executed exactly as specified.

Two minor refinements stayed inside the plan's intent:

1. **`era` template predicate returns `null` permanently.** The plan explicitly says "Reserved slot — composer caller may inject candidateEraSignal in future." Implemented as documented.
2. **`numbersOf` helper accepts `number | string | null` instead of just `number | null`.** Postgres `numeric` returns strings through `postgres-js`; the plan's reference implementation was right to coerce via `Number()`, but the type signature in the plan didn't reflect the string surface. Tightened the signature without changing semantics; tests pass with both numeric and string inputs.

## Issues Encountered

- **Worktree branch base mismatch (resolved).** Worktree was at `0dcdf85` (old `main`) instead of the expected base `d23d26a`. Hard-reset at the start of execution; all tasks ran cleanly afterwards.
- **No other issues.** Test scaffolds from Plan 01 had the right structure; replacing `it.todo` with real tests was straightforward.

## Known Stubs

None. All 4 test files now contain real assertions covering the documented behaviour.

## Threat Flags

None. The plan's `<threat_model>` (T-20-02-01..04) covers everything this plan introduces:

- `computeViewerTasteProfile` reads only `watches` + `watches_catalog` via Drizzle parameterised binds; caller must scope to viewer's collection (T-20-02-01 mitigated by caller contract — Plans 04/05/06 own this).
- Template slot values flow as plain strings; no `dangerouslySetInnerHTML` (T-20-02-02 — Plan 03 will enforce in renderer).
- Movement coercion to `'other'` is a closed-union safety net (T-20-02-03 — accepted).
- `analyzeSimilarity` body byte-identical (T-20-02-04 — accepted; same posture as v1.0–v3.0).

No new SQL surfaces, no new network endpoints, no new auth paths.

## User Setup Required

None — no external service configuration.

## Next Phase Readiness

- `src/lib/verdict/composer.ts` is the single import target for Plans 04/05/06 (`computeVerdictBundle`).
- `src/lib/verdict/viewerTasteProfile.ts` exports `computeViewerTasteProfile` + `EMPTY_PROFILE` for Plans 04/05/06 to call.
- `src/lib/verdict/shims.ts` exports `catalogEntryToSimilarityInput` for Plan 05 (search accordion) and Plan 06 (catalog page).
- `src/lib/verdict/templates.ts` is internal to the composer; downstream plans don't import directly.
- Plan 03 (card renderer) renders `VerdictBundle` and depends only on the type contract from Plan 01 — independent of this plan; can land in parallel.

## Self-Check

Files verified to exist on disk:

- `src/lib/verdict/viewerTasteProfile.ts` — FOUND
- `src/lib/verdict/shims.ts` — FOUND
- `src/lib/verdict/templates.ts` — FOUND
- `src/lib/verdict/composer.ts` — FOUND
- `src/lib/verdict/viewerTasteProfile.test.ts` — FOUND (8 real tests)
- `src/lib/verdict/shims.test.ts` — FOUND (6 real tests)
- `src/lib/verdict/composer.test.ts` — FOUND (9 real tests)
- `src/lib/verdict/confidence.test.ts` — FOUND (4 real tests)

Commits verified to exist:

- `7af6ff2` (Task 1: viewerTasteProfile) — FOUND
- `5717bee` (Task 2: shims) — FOUND
- `c34a463` (Task 3: templates + composer + tests) — FOUND

D-09 byte-lock verified:

- `git show HEAD:src/lib/similarity.ts | shasum -a 256` = `2bdc0cc0e7c82a73…`
- `shasum -a 256 src/lib/similarity.ts` = `2bdc0cc0e7c82a73…`
- `git diff HEAD -- src/lib/similarity.ts` empty.

Test suite:

- `npx vitest run src/lib/verdict --reporter=basic` → 4 files, 27 tests, all passing.

## Self-Check: PASSED

---
*Phase: 20-collection-fit-surface-polish-verdict-copy*
*Completed: 2026-04-30*
