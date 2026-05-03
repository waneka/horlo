---
status: diagnosed
trigger: "On /watch/new, after extracting a watch and clicking 'Add to Wishlist' from verdict-ready state, the WishlistRationalePanel slides in but its textarea is empty. Per spec, the textarea must pre-fill with verdict.contextualPhrasings[0]. User suspects this is related to the sibling bug 'verdict-empty-collection-message' — i.e. a single upstream cause where verdict is missing/incomplete."
created: 2026-04-30T18:00:00Z
updated: 2026-04-30T18:30:00Z
---

## Current Focus

hypothesis: CONFIRMED — same root cause as sibling gap "verdict-empty-collection-message". Both symptoms (empty-collection message + empty textarea) are downstream effects of `state.verdict === null` in the verdict-ready state. The panel and the empty-collection notice both branch on `verdict === null` and produce the observed symptoms simultaneously.
test: Read WishlistRationalePanel, AddWatchFlow, VerdictStep, /watch/new/page.tsx, getVerdictForCatalogWatch, and getWatchesByUser to trace verdict propagation end-to-end.
expecting: Identify the single decision point where verdict gets set to null in verdict-ready state.
next_action: Return diagnosis (find_root_cause_only mode); recommend fix direction.

## Symptoms

expected: Clicking "Add to Wishlist" from verdict-ready opens WishlistRationalePanel with the textarea pre-filled by verdict.contextualPhrasings[0]. The user can edit, blank, or accept; submitting saves and toasts.
actual: User reports: "the textarea is empty, no pre-fill. might be related to the previous issue i noted. everything else works as expected" — i.e. panel opens, save flow works, but the pre-fill is missing.
errors: None reported. Investigate whether verdict.contextualPhrasings is undefined/empty at the moment the panel opens.
reproduction: Test 2 in .planning/phases/20.1-add-watch-flow-rethink-verdict-as-step/20.1-HUMAN-UAT.md — extract a real watch URL on /watch/new (non-empty collection), then click "Add to Wishlist".
started: Discovered during 20.1 UAT (2026-04-30). Likely shares a root cause with sibling gap on Test 1 (empty-collection fallback).

## Eliminated

- hypothesis: WishlistRationalePanel ignores the verdict prop or has a bug computing default value.
  evidence: WishlistRationalePanel.tsx:42-46 `defaultRationale(verdict)` correctly returns `verdict.contextualPhrasings[0] ?? ''` when verdict is non-null and framing !== 'self-via-cross-user'. Line 56 `useState<string>(() => initialNotes ?? defaultRationale(verdict))` correctly seeds the textarea. Panel-side logic is correct.
  timestamp: 2026-04-30T18:25:00Z

- hypothesis: contextualPhrasings array could be empty even with a non-null bundle.
  evidence: composer.ts:59-72 — when isFallback (confidence<0.5 or null), returns `[DESCRIPTION_FOR_LABEL[result.label]]` (always 1 element). When templates fire, returns matched phrasings; if none matched, falls back to `[DESCRIPTION_FOR_LABEL[result.label]]`. Bundle's `contextualPhrasings` is GUARANTEED non-empty when bundle is non-null. So the textarea would NOT be empty if verdict is non-null.
  timestamp: 2026-04-30T18:25:00Z

- hypothesis: collectionRevision === 0 short-circuit firing for a user with watches.
  evidence: /watch/new/page.tsx:57-60 + 68 — `getWatchesByUser(user.id)` returns ALL watches (no status filter, src/data/watches.ts:91-94). `collectionRevision = collection.length`. User reports "i do have a few pieces in my collection" → collection.length > 0 → branch never fires for this user.
  timestamp: 2026-04-30T18:26:00Z

## Evidence

- timestamp: 2026-04-30T18:15:00Z
  checked: src/components/watch/WishlistRationalePanel.tsx
  found: Panel reads `verdict.contextualPhrasings[0] ?? ''` via defaultRationale() (lines 42-46). Returns '' when verdict is null OR framing is 'self-via-cross-user'. textarea seeded from `initialNotes ?? defaultRationale(verdict)` (line 56).
  implication: Panel-side logic is correct. If textarea is empty, verdict is null OR framing is 'self-via-cross-user'.

- timestamp: 2026-04-30T18:17:00Z
  checked: src/components/watch/AddWatchFlow.tsx
  found: Passes `verdict={state.verdict}` to WishlistRationalePanel (line 336). state.verdict comes from `verdict-ready` state, which is set in handleExtract.
  implication: Whatever value verdict has on entering wishlist-rationale-open is whatever was set during extract.

- timestamp: 2026-04-30T18:18:00Z
  checked: src/components/watch/AddWatchFlow.tsx (handleExtract)
  found: 4 paths set verdict to null in verdict-ready state — (a) line 133-141 collectionRevision===0; (b) line 142-147 catalogId is falsy (catalog upsert failed silently in route); (c) line 156 v.success===false (Server Action threw or returned error); (d) NEVER null in cache-hit branch (line 149-152) since only successful bundles are cached.
  implication: For users with non-empty collection, the only paths to verdict===null are (b) catalog upsert failed and (c) Server Action failed.

- timestamp: 2026-04-30T18:19:00Z
  checked: src/components/watch/VerdictStep.tsx
  found: Line 77-83 — when `verdict===null`, renders fixed copy "Your collection is empty — fit score not available yet." This message is hardcoded to the verdict===null branch and does NOT actually check whether collection is empty. It is misleading: it fires for ANY null verdict, including server-action failures.
  implication: Test 1 symptom "Your collection is empty — fit score not available yet." is the SAME null-verdict signal as Test 2's empty textarea. Both gaps share root cause.

- timestamp: 2026-04-30T18:20:00Z
  checked: src/app/actions/verdict.ts
  found: getVerdictForCatalogWatch returns `{ success: false }` on (a) UnauthorizedError, (b) Zod validation fail (non-UUID catalogId), (c) `getCatalogById(catalogId)` returns null (line 54), (d) any thrown error in computeViewerTasteProfile / computeVerdictBundle (catch on line 68-71). On any of these, AddWatchFlow line 156 sets verdict to null silently.
  implication: Server-action failure is observable to the user only as "verdict null" → empty-collection message + empty textarea. There is no error toast on the client.

- timestamp: 2026-04-30T18:22:00Z
  checked: src/app/api/extract-watch/route.ts catalog upsert (lines 49-76)
  found: Catalog upsert is wrapped in try/catch that swallows all errors with console.error. If upsert fails, catalogId stays null and the route still returns success with `catalogId: null`. AddWatchFlow line 142 then sets verdict to null.
  implication: A silent catalog upsert failure (e.g. constraint violation, schema drift) would also produce verdict===null.

- timestamp: 2026-04-30T18:24:00Z
  checked: src/lib/verdict/composer.ts contextualPhrasings construction
  found: Line 59-72 — contextualPhrasings is ALWAYS non-empty when bundle is built. Fallback to `[DESCRIPTION_FOR_LABEL[result.label]]` ensures at least 1 element.
  implication: There is no path where bundle is non-null and contextualPhrasings is empty. Therefore the empty-textarea symptom can ONLY come from `verdict===null` (or framing==='self-via-cross-user', but verdict.ts hardcodes 'cross-user' on line 64).

- timestamp: 2026-04-30T18:26:00Z
  checked: User report cross-correlation (Test 1 + Test 2)
  found: Test 1 reports "Your collection is empty — fit score not available yet." despite non-empty collection. Test 2 reports empty textarea. User: "everything else works as expected" — meaning the panel opens, save works. Both symptoms correlate exactly with verdict===null in verdict-ready state.
  implication: SAME ROOT CAUSE confirmed. Fixing whatever causes verdict===null for this user will resolve both gaps.

## Resolution

root_cause: |
  Both this gap (wishlist-textarea-not-prefilled) and its sibling (verdict-empty-collection-message) are downstream symptoms of a single upstream condition: `state.verdict === null` after extraction in `AddWatchFlow.handleExtract` for a user with a non-empty collection. The user is hitting one of two silent-failure branches:
    - AddWatchFlow.tsx:142 `if (!catalogId)` — catalog upsert failed silently in /api/extract-watch (route.ts:74-76 swallows errors)
    - AddWatchFlow.tsx:155-156 `getVerdictForCatalogWatch` returned `{ success: false }` (verdict.ts:54 'Watch not found' or :68-71 catch)
  Both branches set `verdict: null` in `verdict-ready` state. Once verdict is null:
    1. VerdictStep renders the misleading message "Your collection is empty — fit score not available yet." (VerdictStep.tsx:77-83) regardless of actual collection state — this string is hardcoded to the null branch, not gated on collection.length.
    2. WishlistRationalePanel's defaultRationale(null) returns '' (WishlistRationalePanel.tsx:42-46), leaving the textarea empty.
  WishlistRationalePanel + VerdictStep + composer.ts are all correct. The bug is that the verdict pipeline is failing silently somewhere between catalog upsert and Server Action response, AND the UI treats `verdict===null` as "collection is empty" even though that is one of three null-paths.

fix:
  Two-part directional fix needed (NOT to be implemented in this diagnose-only run):
    1. Fix the upstream null-verdict cause: instrument both silent-failure points (extract-watch route catalog upsert catch + getVerdictForCatalogWatch error returns) so the actual cause surfaces. Likely root: catalog upsert constraint violation or Server Action throw in computeViewerTasteProfile/computeVerdictBundle. The user's `/watch/new` extract path needs end-to-end log-tracing on a real run to confirm which of the two paths trips.
    2. Fix the UI conflation: VerdictStep.tsx:77-83 must NOT show "Your collection is empty" copy for verdict===null when collectionRevision > 0. Either (a) gate the copy on a separate `isCollectionEmpty` prop passed from AddWatchFlow, or (b) split null-verdict cases into "empty-collection" vs "compute-failed" with different copy. Option (a) keeps current data flow; option (b) requires AddWatchFlow to distinguish the three null paths.

verification:
files_changed: []
