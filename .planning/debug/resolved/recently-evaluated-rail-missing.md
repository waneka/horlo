---
status: diagnosed
trigger: "On /watch/new, after clicking Skip from a verdict-ready state, the URL input clears and focus returns to the input — but the 'Recently evaluated' rail/chip that should display the just-skipped watch is not rendered."
created: 2026-04-30T18:00:00Z
updated: 2026-04-30T18:30:00Z
---

## Current Focus

hypothesis: CONFIRMED. handleSkip in AddWatchFlow.tsx silently no-ops the rail-entry push when state.catalogId is an empty string (''). state.catalogId is set to '' whenever the /api/extract-watch response returns catalogId: null (catalog upsert failed/skipped) OR when collectionRevision === 0. This is the same upstream cause as Test 1's reported "Your collection is empty" message even with a non-empty collection.
test: Traced data flow from /watch/new page → AddWatchFlow → handleExtract → handleSkip → RecentlyEvaluatedRail. Ran existing AddWatchFlow.test.tsx — all 5 tests pass (because tests mock catalogId: 'cat-uuid'). The bug only surfaces when catalogId is null in production.
expecting: Bug is in the handleSkip guard on line 189 of AddWatchFlow.tsx — `if (state.catalogId)` skips the rail push when catalogId is empty string.
next_action: Return diagnosis (find_root_cause_only mode).

## Symptoms

expected: Click Skip from verdict-ready → URL input clears, focus returns to input, AND a chip with the watch thumbnail + brand/model appears in a "Recently evaluated" rail below the input. Clicking the chip should re-open the cached verdict instantly (no re-fetch).
actual: User reports: "i clicked skip and i don't see a recently evaluated rail - just looks like i landed on the page from scratch". Skip itself works (input clears), but the rail/chip is invisible.
errors: None reported.
reproduction: Test 3 in 20.1-HUMAN-UAT.md — extract a real watch URL on /watch/new, then click Skip from the verdict.
started: Discovered during 20.1 UAT (2026-04-30). The "Recently evaluated" rail was a 20.1 deliverable.

## Eliminated

- hypothesis: Rail component is not mounted in /watch/new page
  evidence: AddWatchFlow.tsx lines 406-411 mount RecentlyEvaluatedRail in idle/extracting/verdict-ready/extraction-failed states. Page.tsx (line 67-72) renders AddWatchFlow correctly.
  timestamp: 2026-04-30T18:15:00Z

- hypothesis: Skip handler is broken in transition logic (state machine bug)
  evidence: handleSkip correctly transitions state to {kind: 'idle'} (line 203) and clears url (line 202). Skip behavior IS happening — input clears as user reports.
  timestamp: 2026-04-30T18:15:00Z

- hypothesis: RecentlyEvaluatedRail is hidden by CSS / conditional render bug
  evidence: Component returns null on empty entries by design (line 27 of RecentlyEvaluatedRail.tsx). When entries.length > 0, it renders a visible <div> with heading + list. Tests confirm rail renders correctly when state has entries.
  timestamp: 2026-04-30T18:15:00Z

## Evidence

- timestamp: 2026-04-30T18:00:00Z
  checked: src/components/watch/ directory listing
  found: All 5 leaf component files exist (PasteSection, VerdictStep, WishlistRationalePanel, RecentlyEvaluatedRail, flowTypes), plus AddWatchFlow.tsx and AddWatchFlow.test.tsx
  implication: Components are present; investigation focuses on how AddWatchFlow composes them and how Skip handler updates entries state.

- timestamp: 2026-04-30T18:10:00Z
  checked: AddWatchFlow.tsx handleSkip handler (lines 186-204)
  found: |
    const handleSkip = () => {
      if (state.kind !== 'verdict-ready') return
      // D-14: append rail entry, FIFO cap at 5, dedupe by catalogId.
      if (state.catalogId) {  // <-- KEY GUARD
        const entry: RailEntry = { ... }
        setRail((prev) => [entry, ...prev.filter(...)].slice(0, RAIL_MAX))
      }
      setUrl('')
      setState({ kind: 'idle' })
    }
  implication: The `if (state.catalogId)` guard means an empty-string catalogId silently skips the rail push. setState/setUrl still execute, so the input clears and state goes to idle — EXACTLY the "looks like fresh load" symptom.

- timestamp: 2026-04-30T18:15:00Z
  checked: AddWatchFlow.tsx handleExtract — three setState paths to verdict-ready
  found: |
    Path A (line 133-141): collectionRevision === 0 → state.catalogId = catalogId ?? '' (often '')
    Path B (line 142-146): !catalogId from API response → state.catalogId = ''
    Path C (line 158): catalogId valid + verdict computed → state.catalogId = catalogId (non-empty)
  implication: Paths A and B both produce state.catalogId === '' which then trips the handleSkip guard. Only Path C produces a working rail entry.

- timestamp: 2026-04-30T18:18:00Z
  checked: /api/extract-watch/route.ts catalog upsert (lines 50-76)
  found: |
    catalogId is set ONLY when:
      1. result.data.brand && result.data.model are both truthy AND
      2. catalogDAL.upsertCatalogFromExtractedUrl does not throw
    On any failure (try/catch swallows errors with console.error), catalogId stays null. The HTTP response always returns whatever catalogId ended as: null OR a UUID string.
  implication: If the catalog upsert silently fails for the user's URL (e.g., DB constraint, network blip, unknown brand normalization issue), the API returns catalogId: null → AddWatchFlow goes to Path B → state.catalogId = '' → handleSkip silently skips rail push.

- timestamp: 2026-04-30T18:20:00Z
  checked: User report cross-reference — Test 1 ("Your collection is empty — fit score not available yet") AND Test 3 (no rail) reported by same user in same UAT session
  found: |
    "Your collection is empty" message in VerdictStep.tsx (lines 77-83) renders when verdict === null. Per AddWatchFlow handleExtract, verdict === null when:
      - collectionRevision === 0 (Path A)
      - catalogId is null from API (Path B)
      - getVerdictForCatalogWatch returned failure (line 156)
    User has non-empty collection, so Path A is excluded. Most likely cause is Path B: API returned catalogId: null (catalog upsert failed/silently no-op).
  implication: Test 1 and Test 3 share a single upstream root cause — the catalog upsert in /api/extract-watch is silently returning null for the user's test URLs, which both starves the verdict computation AND breaks the rail push guard.

- timestamp: 2026-04-30T18:25:00Z
  checked: AddWatchFlow.test.tsx ADD-04 Skip path test (lines 156-200)
  found: Test passes because the mock fetches with `catalogId: 'cat-uuid'` (truthy). All 5 tests in AddWatchFlow.test.tsx pass when run via vitest.
  implication: The bug does not surface in tests because the test fixture always provides a non-empty catalogId. This is a test-coverage gap — there is no RED test for the "verdict-ready with empty catalogId → Skip" path, which is exactly the production failure mode. The RAIL_MAX/dedupe logic is tested but not the catalogId === '' branch of handleSkip.

## Resolution

root_cause: |
  AddWatchFlow.handleSkip (src/components/watch/AddWatchFlow.tsx lines 186-204) silently no-ops the rail-entry push when state.catalogId is an empty string. The guard `if (state.catalogId)` was intended as defense against pushing entries with no stable ID for cache re-lookup, but it makes the rail invisible whenever the upstream extract path produces verdict-ready state with catalogId: ''. This happens in two real scenarios:

  1. /api/extract-watch returns catalogId: null because the catalog upsert (upsertCatalogFromExtractedUrl) silently failed or did not run (brand/model missing). AddWatchFlow.tsx line 145 sets state.catalogId = ''.
  2. collectionRevision === 0. AddWatchFlow.tsx line 136 sets state.catalogId = catalogId ?? '' — often ''.

  The user's UAT scenario hits case 1 (non-empty collection + extracted brand/model + catalog upsert silently failed). This is the same root cause as Test 1's reported "Your collection is empty — fit score not available yet" message: when state.catalogId === '' the verdict computation is skipped and verdict stays null, which trips the empty-collection fallback copy in VerdictStep.tsx lines 77-83 even when the actual collection is non-empty.

fix: |
  (Suggested fix direction; not applied — find_root_cause_only mode.)

  Two complementary fixes:

  A. Push to rail even when catalogId is empty — use a synthesized stable key (e.g., brand+model hash or uuid()) so the rail still displays the chip. Re-click can then either re-extract the URL or no-op gracefully when no cache key exists. Update RailEntry.catalogId type to allow synthesized keys, OR introduce a separate RailEntry.id field distinct from catalogId.

  B. Fix the upstream root cause in /api/extract-watch: surface catalog-upsert failures to the response (not just console.error) so the client can distinguish "extraction succeeded but cataloging failed" from "extraction failed entirely". Optionally add a fallback path that creates a minimal placeholder catalog row even when the full upsert path fails.

  C. (Bonus) Fix the misleading "Your collection is empty" copy in VerdictStep.tsx — distinguish "verdict could not be computed" (catalogId missing OR getVerdictForCatalogWatch failed) from "user has no watches yet". The current single-message conflation hides the underlying problem from users.

  Add a RED test for the empty-catalogId Skip path so this regression is caught:
    it('Skip path with empty catalogId still adds rail chip', ...) — fetch mock returns catalogId: null, brand/model still extracted, click Skip, expect chip visible.

verification: (none — find_root_cause_only mode)
files_changed: []
