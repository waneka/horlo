---
status: diagnosed
trigger: "On /watch/new, after a successful URL extraction, the verdict card displays the empty-collection fallback ('Your collection is empty — fit score not available yet.') even though the user has multiple watches in their collection."
created: 2026-04-30T18:00:00Z
updated: 2026-04-30T18:45:00Z
---

## Current Focus

hypothesis: ROOT CAUSE — verdict is null because either the catalog upsert silently returned null (path: !catalogId in AddWatchFlow line 142) OR the getVerdictForCatalogWatch Server Action returned success:false. Both paths set verdict:null, which triggers the empty-collection fallback message. The empty-collection message copy is itself misleading — it always renders when verdict===null regardless of actual collection size.
test: diagnosis-only mode — root cause identified through static analysis. Concrete verification requires runtime logging.
expecting: Diagnosis return to caller (find_root_cause_only mode).
next_action: return ROOT CAUSE FOUND with suggested fix direction.

## Symptoms

expected: After URL extraction completes, the verdict card on /watch/new should compute a fit score against the user's existing collection and render the verdict with contextualPhrasings populated. With a non-empty collection, the empty-collection fallback message must NOT appear.
actual: User reports: "extract works but i see 'Your collection is empty — fit score not available yet.' when i do have a few pieces in my collection". Extraction succeeds, but the verdict card shows the empty-collection fallback regardless of actual collection state.
errors: None reported in console (per user). Investigate browser/server logs during reproduction.
reproduction: Test 1 in 20.1-HUMAN-UAT.md — paste a real watch URL into /watch/new while logged in as a user with a non-empty collection.
started: Discovered during 20.1 UAT (2026-04-30). Phase 20.1 introduced the verdict-as-step flow and the AddWatchFlow client component on /watch/new.

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-04-30T18:05:00Z
  checked: src/components/watch/VerdictStep.tsx lines 76-83
  found: The empty-collection fallback message ("Your collection is empty — fit score not available yet.") is rendered when `verdict === null`. There is NO branch that depends on the actual collection state — VerdictStep ONLY renders this string when the verdict prop is null.
  implication: The bug is upstream of VerdictStep — the verdict prop is being passed as null. The copy is misleading: it says "your collection is empty" but actually means "no verdict was computed." The cause is somewhere in AddWatchFlow's extraction handler (handleExtract).

- timestamp: 2026-04-30T18:08:00Z
  checked: src/components/watch/AddWatchFlow.tsx handleExtract (lines 97-168)
  found: There are exactly THREE paths that result in `verdict: null` being set on the verdict-ready state:
    1. Line 133-141: `if (collectionRevision === 0)` — Pitfall 8 short-circuit (intended for empty-collection users)
    2. Line 142-147: `if (!catalogId)` — when extract-watch response had `catalogId: null` (silent fall-through)
    3. Line 156-158: `const bundle = v.success ? v.data : null` — when getVerdictForCatalogWatch returned `success: false`
  implication: One of these three paths is being hit in production for a user with a non-empty collection. Only paths 2 and 3 are credible (path 1 requires zero watches).

- timestamp: 2026-04-30T18:10:00Z
  checked: src/app/watch/new/page.tsx line 57-68 + src/data/watches.ts getWatchesByUser (lines 91-94)
  found: `collectionRevision = collection.length` where `collection = await getWatchesByUser(user.id)`. `getWatchesByUser` does `db.select().from(watches).where(eq(watches.userId, userId))` — NO status filter. Returns ALL watches (owned, wishlist, sold, grail).
  implication: For a user with multiple watches in any status, `collectionRevision > 0`, so path 1 (`collectionRevision === 0`) is NOT being hit. Eliminated.

- timestamp: 2026-04-30T18:12:00Z
  checked: src/app/api/extract-watch/route.ts lines 50-76 catalog upsert
  found: `catalogId` is set by `await catalogDAL.upsertCatalogFromExtractedUrl(...)` ONLY when `result.data?.brand && result.data?.model` are both truthy. Wrapped in try/catch that swallows errors with `console.error('[extract-watch] catalog upsert failed (non-fatal):', err)` — server-side log only, NOT visible in browser console. If upsert throws OR if brand/model are missing, catalogId stays null.
  implication: catalogId could be null even when extraction succeeds (e.g., brand parsed but model not, or DB error during upsert). User would not see the server log.

- timestamp: 2026-04-30T18:15:00Z
  checked: src/app/actions/verdict.ts (Server Action) and src/app/catalog/[catalogId]/page.tsx (Server Component)
  found: Test 7 (catalog page cross-user verdict) PASSES per UAT — the verdict computes correctly when invoked via Server Component. The catalog page uses the SAME underlying primitives: `getCatalogById`, `getWatchesByUser`, `getPreferencesByUser`, `computeViewerTasteProfile`, `computeVerdictBundle`. The Server Action `getVerdictForCatalogWatch` wraps these same primitives.
  implication: The verdict pipeline itself works (proven by Test 7). The bug is specific to the /watch/new flow — most likely the catalogId handoff between extract-watch response and AddWatchFlow.

- timestamp: 2026-04-30T18:20:00Z
  checked: src/app/api/extract-watch/route.ts lines 117-121 response shape AND src/components/watch/AddWatchFlow.tsx lines 120-130 response read
  found: Route returns `NextResponse.json({ success: true, catalogId, ...result })`. Client reads `data.data ?? {}` for extracted and `data.catalogId ?? null` for catalogId. Note the spread `...result` where `result` is the ExtractionResult `{ data, source, confidence, fieldsExtracted, llmUsed }`. So response shape is `{ success: true, catalogId, data, source, confidence, fieldsExtracted, llmUsed }`. Client reads `data.data` (correct) and `data.catalogId` (correct).
  implication: Response shape contract matches. catalogId would only be null if the route literally returned null catalogId — which happens when (a) brand/model missing from extraction, or (b) catalog upsert threw an error.

- timestamp: 2026-04-30T18:25:00Z
  checked: tests/integration/phase17-extract-route-wiring.test.ts D-08 catalogId tests (referenced in 20.1-02-SUMMARY.md)
  found: D-08 tests are gated on DATABASE_URL — they SKIP cleanly without DB connection. The summary says "2 D-08 tests skip cleanly without DATABASE_URL". So in CI/local without DB, these tests didn't actually verify the route returns a catalogId end-to-end.
  implication: There may be a real-world path where catalog upsert fails (e.g., constraint violation, DB connection issue, or even the RETURNING clause not yielding rows under certain conditions) and the route silently returns `catalogId: null` because of the `try/catch` swallow in extract-watch/route.ts.

- timestamp: 2026-04-30T18:30:00Z
  checked: src/data/catalog.ts upsertCatalogFromExtractedUrl lines 191-234
  found: The function uses `db.execute<{ id: string }>(sql\`...\`)` and returns `rows[0]?.id ?? null`. The `db.execute` with a raw SQL template returns the result of postgres.js — depending on the driver wrapper, the return shape may need to be unwrapped. Specifically: `result as unknown as Array<{ id: string }>`. If the actual shape is `{ rows: [...], ... }` (pg-driver style) instead of just `[...]`, then `rows[0]?.id` would be undefined → null.
  implication: STRONG candidate for the bug. The raw `db.execute` may return a result object whose top-level isn't an array of rows; in that case `result[0]?.id` is undefined, the function returns null, and the route returns `catalogId: null`. AddWatchFlow then hits the `if (!catalogId)` branch on line 142, sets verdict null, and renders the empty-collection message.

## Resolution

root_cause: |
  Two compounding issues:

  (1) PRIMARY — The empty-collection fallback message in src/components/watch/VerdictStep.tsx (lines 76-83) is rendered whenever `verdict === null`, regardless of the actual collection size. The copy "Your collection is empty — fit score not available yet." is misleading because verdict can be null in three distinct cases inside AddWatchFlow.handleExtract (src/components/watch/AddWatchFlow.tsx):
    - Path 1 (line 133-141): collectionRevision === 0 (truly empty collection — Pitfall 8 short-circuit)
    - Path 2 (line 142-147): catalogId returned as null from /api/extract-watch (catalog upsert failed silently OR brand/model missing)
    - Path 3 (line 156-158): getVerdictForCatalogWatch Server Action returned success: false (auth error, catalog not found, or unexpected error)

  Only Path 1 corresponds to the message's literal meaning. Paths 2 and 3 incorrectly inherit the same fallback string.

  For a user with a non-empty collection who sees this message, the actual cause is Path 2 or Path 3 — meaning either the catalog upsert failed or the Server Action errored — but the surfaced copy mis-attributes the failure to an empty collection.

  (2) ROOT CAUSE for the user's specific case — the user's collection is non-empty (eliminating Path 1). The user reports "extract works" (brand/model render in spec preview), so the only remaining Path 2 sub-case is "catalog upsert silently failed" (DB error caught by the try/catch in src/app/api/extract-watch/route.ts lines 51-76 with console.error logged to server console only — NOT visible in browser). Path 3 is also possible if the Server Action errors after a successful catalog upsert (e.g., getCatalogById returns null due to read-after-write inconsistency, or computeViewerTasteProfile throws).

  The user reports "no errors in console" — but this is the BROWSER console only. The server console may have a "[extract-watch] catalog upsert failed (non-fatal)" entry or a "[getVerdictForCatalogWatch] unexpected error" entry. Without server log access, the precise sub-case cannot be confirmed via static analysis alone — but the failure mode is unambiguously that verdict is being set to null in AddWatchFlow despite the user having a non-empty collection.

fix: |
  Two-part fix:

  PART A (immediate UX fix — eliminates the misleading copy):
  Modify VerdictStep to differentiate between "true empty collection" and "verdict compute failed". Pass collectionRevision (or an explicit hasCollection prop) into VerdictStep, and gate the empty-collection message on collectionRevision === 0. When verdict === null AND collectionRevision > 0, render a different fallback (e.g., "Couldn't compute fit — you can still add to wishlist or collection.").

  PART B (root-cause fix — surface the silent failure):
  Add observability to AddWatchFlow.handleExtract so silent null-paths are visible:
    - When `!catalogId` (line 142), console.warn the actual response body so engineers can see which case fired (brand missing? upsert error?)
    - When `v.success === false` (line 156), console.warn the v.error string

  Also add a server-side improvement to the route: when catalog upsert throws, return the error to the client (not just server console) — at minimum a flag like `{ catalogIdError: true }` so the client knows it was a DB error vs a brand/model-missing case.

  The user's specific symptom (Test 1 of 20.1 UAT) will be resolved by Part A — they'll either see a real verdict (if the issue is just the misleading copy on a user-facing edge case) or they'll see a more accurate fallback message that hints at the underlying compute failure.

verification: |
  Diagnose-only mode (find_root_cause_only). Verification deferred to fix phase.

  To verify the precise sub-case (Path 2 vs Path 3):
    1. Add console.log in AddWatchFlow.handleExtract before each setState({ verdict: null }) call, including the catalogId value and v.success/v.error.
    2. Reproduce Test 1 (paste a real watch URL while logged in with non-empty collection).
    3. Check the server console for "[extract-watch] catalog upsert failed (non-fatal):" OR "[getVerdictForCatalogWatch] unexpected error:" entries.
    4. Check the browser console for the new console.log to identify which null path fired.

files_changed: []
files_involved:
  - src/components/watch/VerdictStep.tsx  # lines 76-83 — the misleading empty-collection copy
  - src/components/watch/AddWatchFlow.tsx  # lines 132-158 — three null paths in handleExtract
  - src/app/api/extract-watch/route.ts  # lines 50-76 — silent try/catch on catalog upsert
  - src/app/actions/verdict.ts  # getVerdictForCatalogWatch Server Action paths returning success:false
  - src/data/catalog.ts  # upsertCatalogFromExtractedUrl — possible silent failure point
