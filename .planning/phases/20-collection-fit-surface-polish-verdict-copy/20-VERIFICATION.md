---
phase: 20-collection-fit-surface-polish-verdict-copy
verified: 2026-04-29T19:05:00Z
status: gaps_found
score: 6/7 must-haves verified (1 build-blocker gap)
overrides_applied: 0
gaps:
  - truth: "Production build (`npm run build`) succeeds — Next.js TypeScript validation passes for all Phase 20-owned source files"
    status: failed
    reason: "src/lib/verdict/viewerTasteProfile.ts imports PrimaryArchetype and EraSignal from @/lib/verdict/types, but those names are only privately imported in types.ts and never re-exported. Next.js build fails with TS2459 on this file. Vitest does not surface this because it does not run tsc; tests pass at runtime."
    artifacts:
      - path: "src/lib/verdict/viewerTasteProfile.ts"
        issue: "Line 6: `import type { ViewerTasteProfile, PrimaryArchetype, EraSignal } from '@/lib/verdict/types'` — PrimaryArchetype and EraSignal are not exported from that module. They live in @/lib/types."
      - path: "src/lib/verdict/types.ts"
        issue: "Imports PrimaryArchetype and EraSignal from @/lib/types for use in the ViewerTasteProfile / CandidateTasteSnapshot interface definitions, but does not re-export them. Either fix the import in viewerTasteProfile.ts (preferred — cleaner module boundary) OR re-export the types from types.ts."
      - path: "src/lib/verdict/composer.test.ts"
        issue: "Line 24: `analyzeSimilarity: (...args: unknown[]) => analyzeSimilaritySpy(...args)` — TS2556 spread argument tuple error. Non-blocking for test runtime, but appears in tsc output."
      - path: "src/lib/verdict/confidence.test.ts"
        issue: "Line 23: same TS2556 spread argument tuple error pattern as composer.test.ts."
    missing:
      - "Change line 6 of src/lib/verdict/viewerTasteProfile.ts to import PrimaryArchetype and EraSignal from '@/lib/types' instead of '@/lib/verdict/types' (single-line fix)."
      - "Optionally tighten the spy signature in composer.test.ts:24 and confidence.test.ts:23 to match analyzeSimilarity's actual signature, or cast the spy to suppress the TS2556. Lower priority — does not break the Next.js build."
human_verification:
  - test: "Visit /watch/[id] for a watch the viewer owns; confirm the new <CollectionFitCard> renders 'Collection Fit' header, outline Badge with similarity label, headline phrasing, contextual phrasings list, most-similar list (when applicable), and role-overlap warning (when applicable). Confirm visual rhythm matches the prior <SimilarityBadge>."
    expected: "Card renders cleanly, no layout shift, no missing copy."
    why_human: "Visual layout, rhythm, and reading flow cannot be programmatically verified — RTL only confirms text presence."
  - test: "Visit /catalog/{some-catalog-uuid} for a catalog watch the viewer DOES own; confirm 'You own this watch' callout renders with 'Added {date}' and 'Visit your watch detail' link pointing to /watch/{viewer's-watches.id}."
    expected: "D-08 self-via-cross-user callout renders correctly; link navigates to viewer's per-user watch detail."
    why_human: "End-to-end navigation flow requires browser session with seeded data."
  - test: "Visit /search?tab=watches with at least one collection watch; type a query that returns results; click a row's Evaluate trigger and confirm the accordion expands inline showing <VerdictSkeleton> momentarily, then <CollectionFitCard> with the verdict. Click another row to confirm one-at-a-time. Re-click the original row — verify cache hit (no skeleton flash, instant render). Press ESC — verify panel collapses."
    expected: "Inline accordion preview works smoothly; cache prevents redundant Server Action calls; ESC and one-at-a-time accordion behaviour both function."
    why_human: "Real-time interaction (skeleton timing, animation, keyboard handling) cannot be programmatically verified."
  - test: "From /explore, click a Trending or Gaining Traction watch tile; confirm navigation to /catalog/{catalogId} (NOT /evaluate?catalogId=); confirm catalog page renders verdict card."
    expected: "DiscoveryWatchCard now navigates to /catalog/[catalogId]; no dangling /evaluate links."
    why_human: "Click-through navigation requires a browser session."
  - test: "Read the verdict copy on /watch/[id] for a few different watches in your collection; confirm the contextual phrasings feel meaningful (not just SimilarityLabel descriptions)."
    expected: "FIT-02 templates fire under appropriate signal combinations; phrasings read naturally."
    why_human: "Copy quality is a subjective judgement; only a human can decide if 'Aligns with your heritage-driven taste' reads better than 'Highly aligned with your taste'."
---

# Phase 20: Collection Fit Surface Polish + Verdict Copy — Verification Report

**Phase Goal:** Replace `<SimilarityBadge>` with the verdict-bundle-driven `<CollectionFitCard>` across three surfaces (`/watch/[id]`, `/search` row inline-expand accordion, `/catalog/[catalogId]`), plus a 12-template composer with confidence gating that uses the Phase 19.1 catalog taste attributes. Eliminate the dangling `/evaluate?catalogId=` link by replacing the route with the inline-expand surface; the `/evaluate` route should not exist.

**Verified:** 2026-04-29T19:05:00Z
**Status:** `gaps_found` (1 production-build gap; 6 of 7 must-haves verified)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                          | Status     | Evidence                                                                                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `<CollectionFitCard>` is a pure renderer; the static no-engine guard passes file-present                     | ✓ VERIFIED | `src/components/insights/CollectionFitCard.tsx` exists, no `'use client'`, no engine/composer imports; `tests/static/CollectionFitCard.no-engine.test.ts` passes (3/3)                |
| 2   | Composer + 12 templates + confidence gate live; `analyzeSimilarity` is byte-locked (D-09)                      | ✓ VERIFIED | `src/lib/verdict/composer.ts`, `templates.ts` (12 ids), confidence gate at 0.5/0.7. similarity.ts shasum matches 969af09 base verbatim                                              |
| 3   | `/watch/[id]/page.tsx` computes VerdictBundle Server-side and threads to WatchDetail; `<SimilarityBadge>` is deleted | ✓ VERIFIED | `src/app/watch/[id]/page.tsx` calls `computeVerdictBundle`; WatchDetail imports CollectionFitCard; `src/components/insights/SimilarityBadge.tsx` does not exist                            |
| 4   | `WatchSearchRow` Evaluate CTA opens an inline-expand accordion backed by `getVerdictForCatalogWatch` Server Action; `/evaluate` route does not exist | ✓ VERIFIED | `src/components/search/WatchSearchRowsAccordion.tsx`, `src/app/actions/verdict.ts`, `src/components/search/useWatchSearchVerdictCache.ts` exist; `src/app/evaluate/` does not exist; `tests/no-evaluate-route.test.ts` 3/3 pass |
| 5   | `/catalog/[catalogId]/page.tsx` exists; `DiscoveryWatchCard` links to `/catalog/{id}`                          | ✓ VERIFIED | `src/app/catalog/[catalogId]/page.tsx` exists with D-07/D-08 framing; DiscoveryWatchCard wraps in `<Link href={`/catalog/${watch.id}`}>`; no `/evaluate` references in src/                |
| 6   | Verdict module at `src/lib/verdict/` with full file set + matching tests                                       | ✓ VERIFIED | types.ts (8 exports), viewerTasteProfile.ts, shims.ts, templates.ts (12 templates), composer.ts (server-only); composer.test, confidence.test, shims.test, viewerTasteProfile.test all pass |
| 7   | Production build (`npm run build`) succeeds — Next.js TypeScript validation passes for Phase 20-owned source files | ✗ FAILED   | `npm run build` fails: `src/lib/verdict/viewerTasteProfile.ts:6` — TS2459 (PrimaryArchetype/EraSignal not exported from @/lib/verdict/types). Tests pass at runtime; tsc/build do not.    |

**Score:** 6/7 truths verified

### Required Artifacts

| Artifact                                                       | Expected                                                                                | Status      | Details                                                                                                                                       |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/verdict/types.ts`                                     | 8 type exports (Framing, VerdictBundle*, ViewerTasteProfile, Template, etc.)            | ✓ VERIFIED  | All 8 exports present; types-only file; no runtime exports; ISO-string in place of Date                                                       |
| `src/lib/verdict/composer.ts`                                  | computeVerdictBundle, server-only, hedge thresholds at 0.5/0.7                         | ✓ VERIFIED  | server-only present; HEDGE_PREFIX = 'Possibly '; FULL/HEDGE thresholds correct; iterates TEMPLATES deterministically                          |
| `src/lib/verdict/templates.ts`                                 | 12 templates (4 roadmap + 8 supporting); HEADLINE/DESCRIPTION_FOR_LABEL maps           | ✓ VERIFIED  | 12 entries; 4 roadmap ids (fills-a-hole, aligns-with-heritage, collection-skews-contrast, overlaps-with-specific) all present                  |
| `src/lib/verdict/viewerTasteProfile.ts`                        | computeViewerTasteProfile + EMPTY_PROFILE + confidence floor + INNER JOIN              | ⚠️ TS-ERROR | Implementation correct at runtime, but line 6 import is broken: imports PrimaryArchetype and EraSignal from @/lib/verdict/types (not exported there) |
| `src/lib/verdict/shims.ts`                                     | catalogEntryToSimilarityInput; status='wishlist'; movement/crystal coercion            | ✓ VERIFIED  | Pitfall 7 comment cites src/lib/similarity.ts:225; closed-union coercion correct                                                              |
| `src/components/insights/CollectionFitCard.tsx`                | Pure renderer, no engine import, no 'use client', 3 framings via discriminated union   | ✓ VERIFIED  | All 3 framings; UTC timezone in date format; verbatim copy ('Collection Fit', 'You own this watch', 'May compete for wrist time…')           |
| `src/components/insights/VerdictSkeleton.tsx`                  | Pulse cells matching CollectionFitCard structural shape                                 | ✓ VERIFIED  | h-4/w-24, h-5/w-16/rounded-4xl, h-3.5/w-32 etc. all match UI-SPEC                                                                            |
| `src/app/watch/[id]/page.tsx`                                  | Computes VerdictBundle in Server Component; threads to WatchDetail; D-07 hide-when-empty | ✓ VERIFIED  | computeVerdictBundle called when collection.length > 0; framing branches on isOwner; verdict prop threaded to WatchDetail                    |
| `src/components/watch/WatchDetail.tsx`                         | Renders CollectionFitCard; SimilarityBadge import removed                              | ✓ VERIFIED  | imports CollectionFitCard; renders `{verdict && <CollectionFitCard verdict={verdict} />}`; SimilarityBadge.tsx deleted                       |
| `src/components/insights/SimilarityBadge.tsx`                  | DELETED                                                                                 | ✓ VERIFIED  | File does not exist                                                                                                                            |
| `src/app/actions/verdict.ts`                                   | 'use server' Server Action; Zod .uuid().strict(); auth-gated                            | ✓ VERIFIED  | All checks present; framing hardcoded to 'cross-user'; never accepts viewerId from input                                                      |
| `src/components/search/WatchSearchRowsAccordion.tsx`           | Accordion shell with cache, skeleton, ESC handler, one-at-a-time                       | ✓ VERIFIED  | base-ui Accordion, multiple={false} default, ESC handler, error toast + collapse, VerdictSkeleton/CollectionFitCard render branches            |
| `src/components/search/useWatchSearchVerdictCache.ts`          | Cache keyed by collectionRevision; invalidates on revision change                      | ✓ VERIFIED  | useState-based cache; setState-in-render pattern for revision change; stale-write guard                                                       |
| `src/app/catalog/[catalogId]/page.tsx`                         | Server Component; D-07/D-08 framing; notFound on missing catalog                       | ✓ VERIFIED  | All branches present; findViewerWatchByCatalogId scoped by userId AND catalogId (T-20-06-01); ownerHref points to /watch/{viewer's-watches.id} |
| `src/components/explore/DiscoveryWatchCard.tsx`                | Wrapped in `<Link href="/catalog/{watch.id}">`                                          | ✓ VERIFIED  | Link import + `href={`/catalog/${watch.id}`}` present; no `/evaluate` references                                                              |
| `tests/no-evaluate-route.test.ts`                              | Filesystem assertion that /evaluate route does not exist                                | ✓ VERIFIED  | 3/3 assertions pass                                                                                                                            |
| `tests/static/CollectionFitCard.no-engine.test.ts`             | Static text-scan against engine/composer imports in CollectionFitCard                  | ✓ VERIFIED  | 3/3 assertions pass; vacuous-pass shim no longer applies (file exists)                                                                         |

### Key Link Verification

| From                                                | To                                                                | Via                                              | Status   | Details                                                                                       |
| --------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------ | -------- | --------------------------------------------------------------------------------------------- |
| `src/lib/verdict/composer.ts`                       | `src/lib/similarity.ts`                                           | `import { analyzeSimilarity } from '@/lib/similarity'` | ✓ WIRED  | Line 2 import; analyzeSimilarity called at line 44 within computeVerdictBundle                |
| `src/app/watch/[id]/page.tsx`                       | `src/lib/verdict/composer.ts`                                     | `import { computeVerdictBundle }`                  | ✓ WIRED  | Line 7 import; called at line 46                                                              |
| `src/app/watch/[id]/page.tsx`                       | `src/lib/verdict/viewerTasteProfile.ts`                           | `import { computeViewerTasteProfile }`             | ✓ WIRED  | Line 8 import; called at line 43                                                              |
| `src/components/watch/WatchDetail.tsx`              | `src/components/insights/CollectionFitCard.tsx`                   | client component import                          | ✓ WIRED  | Conditionally renders `{verdict && <CollectionFitCard verdict={verdict} />}`                  |
| `src/components/search/WatchSearchRowsAccordion.tsx`| `src/app/actions/verdict.ts`                                      | Server Action call on first row expand           | ✓ WIRED  | `getVerdictForCatalogWatch({ catalogId: nextId })` inside startTransition + handleValueChange |
| `src/components/search/WatchSearchRowsAccordion.tsx`| `src/components/insights/CollectionFitCard.tsx` + VerdictSkeleton | renders verdict result / pending state           | ✓ WIRED  | Both components rendered conditionally inside Accordion.Panel                                  |
| `src/app/catalog/[catalogId]/page.tsx`              | `src/lib/verdict/shims.ts` (`catalogEntryToSimilarityInput`)      | candidate construction                           | ✓ WIRED  | Called at line 63 of page.tsx                                                                 |
| `src/components/explore/DiscoveryWatchCard.tsx`     | `/catalog/[catalogId]` route                                      | `<Link href={`/catalog/${watch.id}`}>`              | ✓ WIRED  | Link wrapper + aria-label; no /evaluate references                                              |

### Data-Flow Trace (Level 4)

| Artifact                            | Data Variable                | Source                                                                                              | Produces Real Data | Status     |
| ----------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------- | ------------------ | ---------- |
| `CollectionFitCard.tsx`             | `verdict` prop               | upstream caller (Server Component or Server Action)                                                 | Yes (composer)     | ✓ FLOWING  |
| `WatchDetail.tsx` (verdict slot)    | `verdict` prop               | `/watch/[id]/page.tsx` calls `computeVerdictBundle`                                                | Yes — DB-backed    | ✓ FLOWING  |
| `WatchSearchRowsAccordion.tsx`      | cache.get(catalogId)         | `getVerdictForCatalogWatch` Server Action → composer with viewer's collection                       | Yes — DB-backed    | ✓ FLOWING  |
| `/catalog/[catalogId]/page.tsx`     | `verdict`                    | inline branch: D-08 self-owned shape OR composer call                                               | Yes — DB-backed    | ✓ FLOWING  |
| `viewerTasteProfile.ts` aggregate   | `rows` (Drizzle query)       | INNER JOIN watches → watches_catalog filtered by confidence ≥ 0.5                                   | Yes — Phase 19.1   | ✓ FLOWING  |

### Behavioral Spot-Checks

| Behavior                                                                                                | Command                                                          | Result                                                          | Status   |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------- | -------- |
| Phase 20 test suite passes                                                                              | vitest run on Phase 20 paths                                     | 12 files / 72 tests pass                                        | ✓ PASS   |
| Full vitest suite passes (excluding pre-existing failures documented in deferred-items.md + prompt) | vitest run                                                       | 117 files passed, 2 failed (5 tests). All 5 are pre-existing.   | ✓ PASS (with documented pre-existing failures) |
| `tests/no-evaluate-route.test.ts` enforces /evaluate route does not exist                                | `npx vitest run tests/no-evaluate-route`                          | 3/3 pass                                                        | ✓ PASS   |
| `tests/static/CollectionFitCard.no-engine.test.ts` enforces card has no engine import                    | `npx vitest run tests/static/CollectionFitCard.no-engine`         | 3/3 pass                                                        | ✓ PASS   |
| `analyzeSimilarity` body byte-identical to pre-Phase-20 base (D-09 lock)                                 | `shasum -a 256 src/lib/similarity.ts` vs. `git show 969af09:src/lib/similarity.ts | shasum -a 256` | both `2bdc0cc0e7c82a73…d3d1125564`                              | ✓ PASS   |
| `npm run build` succeeds (Next.js production build)                                                     | `npm run build`                                                  | **FAIL** — TS2459 in `src/lib/verdict/viewerTasteProfile.ts:6` | ✗ FAIL   |
| 12 templates in templates.ts                                                                            | `grep -cE "id: '" src/lib/verdict/templates.ts`                   | 12                                                              | ✓ PASS   |
| 4 roadmap templates present                                                                             | `grep -cE "fills-a-hole\|aligns-with-heritage\|collection-skews-contrast\|overlaps-with-specific" src/lib/verdict/templates.ts` | 4 | ✓ PASS   |

### Requirements Coverage

| Requirement | Source Plan        | Description                                                                                                                                  | Status                | Evidence                                                                                                       |
| ----------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------- |
| FIT-01      | 20-01, 20-03, 20-04 | Pure-renderer `<CollectionFitCard>` extracted from `<SimilarityBadge>`; computation moves to caller                                          | ✓ SATISFIED           | CollectionFitCard.tsx exists as pure renderer; engine no longer imported in WatchDetail; SimilarityBadge deleted |
| FIT-02      | 20-02              | Verdict copy expands beyond 6 fixed labels — fills-a-hole, aligns-with-heritage, collection-skews-contrast, overlaps-with-specific          | ✓ SATISFIED           | 12 templates including all 4 roadmap-mandated; composer.test.ts asserts each fires under canonical fixture (9 tests) |
| FIT-03      | 20-04, 20-06       | Cross-user `/watch/[id]` renders CollectionFitCard correctly framed for non-owned watches; `/catalog/[catalogId]` route ships              | ✓ SATISFIED           | watch-page-verdict.test.ts asserts framing branch; catalog-page.test.ts asserts D-08 + D-07 + cross-user        |
| FIT-04      | 20-01, 20-05       | WatchSearchRow Evaluate CTA repointed from /evaluate?catalogId= to inline-expand verdict preview; /evaluate route does not exist            | ✓ SATISFIED           | WatchSearchRowsAccordion + getVerdictForCatalogWatch + cache hook all wired; tests/no-evaluate-route.test.ts 3/3 pass |

### Anti-Patterns Found

| File                                                  | Line | Pattern                                                              | Severity   | Impact                                                                                                  |
| ----------------------------------------------------- | ---- | -------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------- |
| `src/lib/verdict/viewerTasteProfile.ts`              | 6    | Imports PrimaryArchetype/EraSignal from a module that does not export them | 🛑 Blocker | **Next.js production build fails (TS2459).** Vitest does not run tsc, so test suite stays green and this slipped through self-checks. |
| `src/lib/verdict/composer.test.ts`                    | 24   | Spread argument tuple TS2556                                         | ⚠️ Warning  | Test runs (vitest accepts), but tsc reports error. Cosmetic for now since composer.test.ts is excluded from Next.js build. |
| `src/lib/verdict/confidence.test.ts`                  | 23   | Spread argument tuple TS2556                                         | ⚠️ Warning  | Same as composer.test.ts — runtime green, tsc red.                                                      |
| `tests/components/search/SearchPageClient.test.tsx`   | 158, 212, 236, 255, 262, 267, 271, 275 | Missing required `collectionRevision` prop on SearchPageClient | ⚠️ Warning  | Tests pass at runtime (React permissive prop handling), but tsc reports 8 errors. Plan 20-05 fixed `tests/app/search/SearchPageClient.test.tsx` (the other parallel test file) and missed this one. |

### Human Verification Required

1. **Visual rhythm of CollectionFitCard on /watch/[id]**
   - Test: Visit /watch/[id] for a watch the viewer owns; confirm the new card renders cleanly with the same visual weight as the prior SimilarityBadge.
   - Expected: No layout shift, copy reads naturally, badge alignment matches Card title.
   - Why human: RTL only checks text presence; visual weight is subjective.

2. **D-08 self-owned callout end-to-end**
   - Test: Visit /catalog/{catalog-uuid} for a watch the viewer already owns. Confirm 'You own this watch' callout renders, 'Added {date}' shows the correct calendar day, and 'Visit your watch detail' link navigates to `/watch/{viewer's-watches.id}` (per-user, not catalog).
   - Expected: Callout renders, date is correct, link navigates correctly.
   - Why human: Requires browser session + seeded data.

3. **Search accordion inline preview interaction**
   - Test: From /search?tab=watches with at least one collection watch, type a query, click a row's trigger, watch the skeleton appear, then the card. Open another row — confirm the first collapses (one-at-a-time). Re-click a previously-opened row — confirm cache hit (instant render, no skeleton flash). Press ESC — confirm panel collapses.
   - Expected: All four behaviours work smoothly.
   - Why human: Real-time interaction (timing, animations, keyboard handling).

4. **Discovery click-through to /catalog/[catalogId]**
   - Test: Visit /explore, click a Trending or Gaining Traction card. Confirm navigation to /catalog/{catalogId} (NOT /evaluate?catalogId=).
   - Expected: Navigation lands on the new catalog page.
   - Why human: End-to-end navigation requires a browser session.

5. **FIT-02 phrasing quality on real collection data**
   - Test: Read the contextual phrasings on /watch/[id] for a few different watches in your collection. Confirm they read naturally and convey the verdict (not just SimilarityLabel descriptions).
   - Expected: Templates fire under the right signal combinations; copy is meaningful.
   - Why human: Copy quality is subjective.

### Gaps Summary

**Phase 20 ships its goal at the runtime layer** — every must-have surface (CollectionFitCard pure renderer, composer + 12 templates + confidence gate, /watch/[id] verdict integration, /search inline-expand accordion via Server Action, /catalog/[catalogId] page with D-07/D-08 framing, /evaluate route eliminated) is wired and tested. The static guards (`tests/no-evaluate-route.test.ts`, `tests/static/CollectionFitCard.no-engine.test.ts`) pass. D-09 byte-lock on `analyzeSimilarity` is preserved (shasum verified against pre-phase base 969af09).

**One blocker remains: the Next.js production build fails** because `src/lib/verdict/viewerTasteProfile.ts` line 6 imports `PrimaryArchetype` and `EraSignal` from `@/lib/verdict/types`, but `types.ts` only imports those names privately for use in interface definitions — it never re-exports them. The fix is a one-line import path correction (point at `@/lib/types` instead). This slipped through every plan's self-check because (a) plan-level `<verify>` scripts only ran `npx vitest run`, never `npm run build` or full-project `npx tsc --noEmit`, and (b) vitest does not enforce TypeScript at runtime.

Two minor TS warnings (`composer.test.ts:24`, `confidence.test.ts:23` spread-argument tuples; `tests/components/search/SearchPageClient.test.tsx` 8 missing-prop errors from Plan 20-05's parallel test file that escaped the SUMMARY's reported fix) round out the type-check noise. None of these block the runtime, but they should be tidied up in the closure plan alongside the build-blocker.

Pre-existing failures documented in `<known_pre_existing_failures>`:
- `tests/app/explore.test.tsx` — 3 stale-fixture failures (Phase 14 stub copy that no longer exists; Phase 18 rewrote /explore). Out of Phase 20 scope per `deferred-items.md`.
- `tests/no-raw-palette.test.ts` — 2 failures on `font-medium` usage in `CollectionFitCard.tsx` and `WatchSearchRow.tsx`. The lint forbids `font-medium`, but the 20-UI-SPEC § Typography explicitly mandates it. This is a UI-SPEC vs. lint conflict; per the prompt's escalation, the lowest-cost code fix is `font-medium → font-semibold` per code review WR-01. **Not flagged as a Phase 20 gap** — pre-existing-policy / acknowledged conflict.

### Closure Path

A focused single-task plan can close the gap in under 5 minutes:
1. Edit `src/lib/verdict/viewerTasteProfile.ts:6` to import `PrimaryArchetype, EraSignal` from `@/lib/types`.
2. Run `npm run build` → confirm green.
3. Optionally fix the 4 TS2556/2741 warning-tier items (composer.test.ts, confidence.test.ts spy signatures; tests/components/search/SearchPageClient.test.tsx prop additions).

After closure, status → `human_needed` (5 human-verification items remain) → after human sign-off → `passed`.

---

_Verified: 2026-04-29T19:05:00Z_
_Verifier: Claude (gsd-verifier)_
