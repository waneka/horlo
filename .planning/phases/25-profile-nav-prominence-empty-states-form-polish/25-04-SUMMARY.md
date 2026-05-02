---
phase: 25-profile-nav-prominence-empty-states-form-polish
plan: 04
subsystem: api+ui
tags: [api-route, error-taxonomy, addwatchflow, useCallback, security, anthropic-sdk]

# Dependency graph
requires:
  - phase: 25-profile-nav-prominence-empty-states-form-polish
    provides: "25-02 (ExtractErrorCard component + ExtractErrorCategory type) consumed by AddWatchFlow render branch; 25-05 (AddWatchFlow ?manual=1/?status=wishlist query-param wiring + initialManual/initialStatus props) preserved end-to-end"
  - phase: 20.1
    provides: "FlowState extraction-failed variant — extended with category field this plan"
provides:
  - "5-category error taxonomy enum (host-403, structured-data-missing, LLM-timeout, quota-exceeded, generic-network) emitted from POST /api/extract-watch"
  - "LOCKED D-15 user-facing recovery copy table (CATEGORY_COPY) sourced into every error response — never err.message / err.stack / String(err)"
  - "D-12 post-extract gate that flips silent-empty extractions (brand AND model both empty/whitespace) into structured-data-missing 422 errors"
  - "categorizeExtractionError(err) helper with HTTP-status mapping (502/422/504/503/500) per category"
  - "AddWatchFlow extraction-failed FlowState extended with `category: ExtractErrorCategory` field"
  - "ExtractErrorCard mounted in AddWatchFlow's failed-state render branch with stable useCallback retryAction/manualAction props"
affects:
  - "Future plans calling POST /api/extract-watch — must consume the 5-category enum + locked copy contract"
  - "Future flows reading FlowState.kind === 'extraction-failed' — must read state.category"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Category-as-enum-literal at explicit emit sites (one switch case per category) — keeps every LOCKED user-facing copy emission grep-able and visible at the call site"
    - "Duck-type Anthropic SDK error detection via err.status === 429 — robust across SDK module boundaries / version drift (RateLimitError extends APIError<429> in @anthropic-ai/sdk v0.88; we don't rely on instanceof)"
    - "Server-side console.error for raw error + sanitized client response sourced from a const lookup table (T-25-04-01 information-disclosure mitigation)"
    - "useCallback for callback-prop stability across render cycles (T-25-04-04 rerender-storm mitigation; both retryAction and manualAction wrapped)"
    - "Defensive client-side fallback for missing server fields (data?.category ?? 'generic-network') — T-25-04-03 mitigation against unexpected response shapes"

key-files:
  created: []
  modified:
    - "src/app/api/extract-watch/route.ts (5-category taxonomy + D-12 gate + sanitized catch block; ~80 lines added net)"
    - "src/components/watch/AddWatchFlow.tsx (ExtractErrorCard wiring + FlowState category extension + useCallback callbacks; ~25 net lines, including replacement of legacy 38-line failed-state Card)"
    - "src/components/watch/flowTypes.ts (category field added to extraction-failed variant; ExtractErrorCategory imported from ./ExtractErrorCard)"
    - "tests/api/extract-watch.test.ts (9 new categorization tests + 2 updated assertions for new SsrfError + brand/model-missing semantics)"
    - "tests/api/extract-watch-auth.test.ts (mock fetchAndExtract returns brand+model so the new D-12 gate doesn't intercept the existing auth success-path assertions)"
    - "src/components/watch/AddWatchFlow.test.tsx (ADD-07 assertion rewritten + 2 new UX-05 tests + UAT-gap-4 escape test rewritten)"

key-decisions:
  - "Explicit per-category switch cases in catch block (vs. a single helper invocation) — keeps each LOCKED D-15 copy emission grep-able + visible at call site, satisfying the plan's strict acceptance criteria (≥5 emit sites for `category:`)"
  - "Duck-type 429 detection (typeof err.status === 'number' && err.status === 429) rather than instanceof RateLimitError — robust across SDK module boundaries; the SDK exports RateLimitError extends APIError<429, Headers> in v0.88 but bundler-split errors may not pass instanceof"
  - "SsrfError preserved as generic-network at HTTP 400 (not 500) per CONTEXT §integration_points line 148 — distinct from upstream 502/503/504/500 because SsrfError is a client-input class of error"
  - "Defensive fallback `data?.category ?? 'generic-network'` on client side — T-25-04-03 mitigation handles future build skew (route omits field) and pre-Phase-25 cached responses gracefully"
  - "manualAction = router.push('/watch/new?manual=1') (not in-flow transition) per D-14 LITERAL — matches the 25-05 Collection no-key fallback CTA semantics; user lands on a fresh manual-entry page with the URL input field cleared"
  - "Removed legacy handleContinueManually + Card/Button imports — the post-failure in-flow manual transition is gone; the only manual-entry ingress paths are now PasteSection's 'or enter manually' link + ExtractErrorCard's 'Add manually' CTA (which routes away)"

patterns-established:
  - "Category-as-enum-literal switch dispatch in error response emission: every LOCKED user-facing copy lives at an explicit call site rather than behind a helper, making security-critical surfaces auditable via plain grep"
  - "Duck-typing for cross-module-boundary error detection (e.g., third-party SDK errors that may not pass instanceof in bundled environments)"
  - "Defensive client-side fallback for required-but-optional response fields (?? 'safe-default') protects against build skew between client and server deploys"

requirements-completed:
  - UX-05

# Metrics
duration: ~12 min
completed: 2026-05-02
---

# Phase 25 Plan 04: URL-Extract Error Taxonomy Wiring Summary

**Wires the 5-category URL-extract error taxonomy end-to-end. POST /api/extract-watch maps every error path to one of `host-403` / `structured-data-missing` / `LLM-timeout` / `quota-exceeded` / `generic-network` with LOCKED D-15 recovery copy; AddWatchFlow renders the ExtractErrorCard component (from 25-02) in the extraction-failed state branch.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-02T17:19:23Z
- **Completed:** 2026-05-02T17:30:57Z
- **Tasks:** 2 implementation tasks (TDD: RED + GREEN per task) + Task 3 deferred to UAT
- **Files modified:** 6 (3 source + 3 test)

## Accomplishments

- POST /api/extract-watch now emits `{ success: false, error: <D-15>, category: <enum> }` for all error paths.
- D-12 post-extract gate flips silent-empty extractions (brand AND model both empty/whitespace) into a 422 structured-data-missing response — previously these returned `{ success: true, data: {...mostly-empty...} }` and rendered verdict-ready with no useful data.
- AddWatchFlow's `extraction-failed` FlowState carries `category: ExtractErrorCategory` and renders `<ExtractErrorCard>` (from 25-02) with stable useCallback'd `retryAction` (clears URL, resets to idle) and `manualAction` (router.push to `/watch/new?manual=1` per D-14 LITERAL).
- T-25-04-01 information-disclosure mitigation enforced: response `error` field is ALWAYS sourced from `CATEGORY_COPY[category]` (compile-time constant); raw error logged server-side via `console.error('Extraction error:', error)` only.
- All previously-passing tests still pass; 9 new route-level categorization tests + 3 new client-level UX-05 tests added (all GREEN).
- ESLint clean on all modified files; tsc clean for all modified files (3 pre-existing errors in RecentlyEvaluatedRail.test.tsx are out of scope per CONTEXT — verified via `git stash` baseline check).

## 5-Category Enum + LOCKED D-15 Copy Table

| Category                 | HTTP Status | LOCKED D-15 Copy                                                                            | Trigger                                                                                                                  |
| ------------------------ | ----------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `host-403`               | 502         | "This site doesn't allow data extraction. Try entering manually."                            | Caught Error whose message matches `/Failed to fetch URL:\s*403\b/` (thrown by `fetchAndExtract` for 403 upstream).      |
| `structured-data-missing` | 422         | "Couldn't find watch info on this page. Try the original product page or enter manually."   | D-12 post-extract gate: `result.data?.brand?.trim()` AND `result.data?.model?.trim()` are both empty/whitespace/null.    |
| `LLM-timeout`            | 504         | "Extraction is taking longer than expected. Try again or enter manually."                   | Caught Error with `err.name === 'AbortError'` OR `/timeout/i.test(err.message)`.                                         |
| `quota-exceeded`         | 503         | "Extraction service is busy. Try again in a few minutes."                                   | Caught error with `typeof err.status === 'number' && err.status === 429` (Anthropic SDK `RateLimitError extends APIError<429>`). |
| `generic-network`        | 500 (400 for SsrfError) | "Couldn't reach that URL. Check the link and try again."                       | Default — any other thrown error. Also: `SsrfError` (preserved at HTTP 400 per CONTEXT §integration_points line 148).   |

## `categorizeExtractionError` Helper Signature

```ts
function categorizeExtractionError(err: unknown): ExtractErrorCategory
```

Detection order (first match wins, per plan acceptance criteria):

1. `err instanceof Error && /Failed to fetch URL:\s*403\b/.test(err.message)` → `'host-403'`
2. `err instanceof Error && (err.name === 'AbortError' || /timeout/i.test(err.message))` → `'LLM-timeout'`
3. `typeof err.status === 'number' && err.status === 429` → `'quota-exceeded'` (duck-type, robust across SDK module boundaries)
4. Default → `'generic-network'`

Note: SsrfError is handled separately in the catch block (BEFORE this helper is called) so it preserves its existing HTTP 400 status while still emitting the `generic-network` category + copy.

## D-12 Post-Extract Gate Condition

```ts
const brandPopulated = Boolean(result.data?.brand?.trim())
const modelPopulated = Boolean(result.data?.model?.trim())
if (!brandPopulated && !modelPopulated) {
  return NextResponse.json({
    success: false,
    error: CATEGORY_COPY['structured-data-missing'],
    category: 'structured-data-missing' as const,
  }, { status: 422 })
}
```

The gate sits between `await fetchAndExtract(url)` and the catalog upsert — runs only on successful extraction (not in the catch path). Treats null / undefined / '' / whitespace-only as empty (per plan: `result.data?.brand?.trim()`).

## HTTP Status Code Mapping per Category

```ts
const CATEGORY_HTTP_STATUS: Record<ExtractErrorCategory, number> = {
  'host-403': 502,                  // Bad Gateway (upstream blocked)
  'structured-data-missing': 422,   // Unprocessable Entity (extraction succeeded but unusable)
  'LLM-timeout': 504,               // Gateway Timeout
  'quota-exceeded': 503,            // Service Unavailable (transient)
  'generic-network': 500,           // Internal Server Error (default)
}
```

Defense-in-depth: non-200 status keeps cache layers (CDNs, browser cache) from caching transient errors. SsrfError preserves the legacy 400 (client-input class, not upstream failure).

## FlowState Shape Change

`src/components/watch/flowTypes.ts`:

```ts
// BEFORE:
| { kind: 'extraction-failed'; partial: ExtractedWatchData | null; reason: string }

// AFTER:
| { kind: 'extraction-failed'; partial: ExtractedWatchData | null; reason: string; category: ExtractErrorCategory }
```

`ExtractErrorCategory` is imported from `./ExtractErrorCard` (single source of truth — same union type the component branches on).

## Task Commits

Each task was committed atomically per the TDD gate sequence:

1. **Task 1 (RED)** — `0849497` — failing tests for /api/extract-watch 5-category taxonomy
2. **Task 1 (GREEN)** — `8444d4a` — wire 5-category error taxonomy in /api/extract-watch
3. **Task 2 (RED)** — `637a77e` — failing tests for AddWatchFlow ExtractErrorCard render branch
4. **Task 2 (GREEN)** — `2bc31de` — mount ExtractErrorCard in AddWatchFlow extraction-failed branch

No REFACTOR commits needed — the implementations match plan structure one-to-one after the GREEN passes.

## Decisions Made

- **Explicit per-category switch in catch block (vs. helper consolidation):** Initial implementation collapsed all 4 catch-path categories into a single `categoryErrorResponse(category)` helper, which dropped the `category:` literal grep count to 2 (helper definition + SsrfError branch). Plan acceptance criteria require ≥5 emit sites for `category:`, so I expanded into an explicit switch — each case literally emits `category: 'host-403' as const` etc. The helper was removed (otherwise unused). This is more verbose but makes every LOCKED user-facing copy emission visible at the call site, supporting plain-grep auditability of security-critical surfaces.
- **Duck-typed Anthropic 429 detection (vs. `instanceof RateLimitError`):** Anthropic SDK v0.88 exports `RateLimitError extends APIError<429, Headers>` from `@anthropic-ai/sdk`. The plan acknowledges that `instanceof` checks can fail across module boundaries with bundlers (a common pitfall). The `typeof err.status === 'number' && err.status === 429` check is more robust and matches the plan's preferred approach. The SDK error message text is NOT relied on (versions change).
- **D-12 gate uses `?.trim()`:** Treats null / undefined / '' / whitespace-only all as "empty" — matches the plan's "both empty/null" criteria semantically and is more defensive against extractor implementations that may emit whitespace strings.
- **`manualAction = router.push('/watch/new?manual=1')` (route push, NOT in-flow transition):** Per D-14 LITERAL. The user lands on a fresh manual-entry page with the URL input cleared (matching the 25-05 Collection no-key fallback CTA semantics). The legacy in-flow `handleContinueManually` was removed since it's no longer wired.
- **`?? 'generic-network'` defensive client-side fallback:** Per T-25-04-03. Handles future build skew (route deploys later than client and omits the field), pre-Phase-25 cached service worker responses, and any other shape-drift failure mode gracefully — never crashes, always renders an actionable error card.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] tests/api/extract-watch-auth.test.ts mock broken by D-12 gate**
- **Found during:** Task 1 GREEN verification (post-route-edit `npx vitest run tests/api/extract-watch-auth.test.ts`)
- **Issue:** The auth test mocks `fetchAndExtract` to resolve with `{ name: 'mock' }` — no `data` property. With my new D-12 post-extract gate, `result.data?.brand?.trim()` and `result.data?.model?.trim()` are both empty → returns 422 instead of the expected 200. The test "proceeds past auth check when session is present" failed.
- **Fix:** Updated the mock to include `data: { brand: 'Omega', model: 'Speedmaster' }` so the success-path assertions still hold. Pure scope fix — directly caused by my D-12 gate.
- **Files modified:** `tests/api/extract-watch-auth.test.ts`
- **Verification:** `npx vitest run tests/api/extract-watch-auth.test.ts` → 4/4 pass.
- **Committed in:** `8444d4a` (Task 1 GREEN commit)

**2. [Rule 3 - Blocking] AddWatchFlow.test.tsx legacy "Continue manually" / "Try another URL" assertions broken by ExtractErrorCard replacement**
- **Found during:** Task 2 RED was authored proactively (test-first), so the existing ADD-07 + UAT-gap-4 tests were rewritten as part of the same RED commit rather than being discovered as a post-edit failure.
- **Fix:** ADD-07 assertion now checks for ExtractErrorCard's locked D-15 copy + dual CTAs ('Add manually' / 'Try a different URL'). The UAT-gap-4 post-failure escape test now exercises 'Try a different URL' (the new equivalent of the legacy back-link path; in-flow manual transition no longer exists).
- **Files modified:** `src/components/watch/AddWatchFlow.test.tsx`
- **Verification:** 12/12 AddWatchFlow tests pass.
- **Committed in:** `637a77e` (Task 2 RED) + `2bc31de` (Task 2 GREEN).

### Auth Gates

None — the route already had AUTH-04 wired via `getCurrentUser()`; no Anthropic API calls or external auth required by this plan's tasks.

### Architectural Changes (Rule 4)

None.

## TDD Gate Compliance

- **Task 1:** RED commit `0849497` (failing tests, 9/16 fail) → GREEN commit `8444d4a` (all 20/20 pass — 16 categorization + 4 auth). PASS.
- **Task 2:** RED commit `637a77e` (failing tests, 4/12 fail) → GREEN commit `2bc31de` (all 12/12 pass). PASS.

Plan-level TDD gate sequence satisfied — both implementation tasks have explicit `test(...)` → `feat(...)` commit pairs in git log.

## Verification Results

| Check                                                                                     | Status   |
| ----------------------------------------------------------------------------------------- | -------- |
| `npx vitest run tests/api/extract-watch.test.ts`                                          | 16/16 pass |
| `npx vitest run tests/api/extract-watch-auth.test.ts`                                     | 4/4 pass  |
| `npx vitest run src/components/watch/AddWatchFlow.test.tsx`                               | 12/12 pass |
| `npx vitest run src/components/watch/ExtractErrorCard.test.tsx`                           | 15/15 pass |
| `npx tsc --noEmit` on modified files                                                      | clean (3 pre-existing errors in RecentlyEvaluatedRail.test.tsx are out of scope per SCOPE BOUNDARY) |
| `npx eslint src/app/api/extract-watch/route.ts src/components/watch/AddWatchFlow.tsx src/components/watch/flowTypes.ts` | 0 errors |
| Plan acceptance grep — host-403 / structured-data-missing / LLM-timeout / quota-exceeded / generic-network counts ≥1 | confirmed (9 / 8 / 9 / 9 / 11) |
| Plan acceptance grep — "Try entering manually" + "Try again in a few minutes" counts ≥1   | confirmed (1 + 1) |
| Plan acceptance grep — `category:` count ≥5                                               | confirmed (6) |
| Plan acceptance grep — `categorizeExtractionError` count ≥2                               | confirmed (2) |
| Plan acceptance grep — `result.data?.brand` count ≥2                                      | confirmed (3) |
| Plan acceptance grep — `ExtractErrorCard` count in AddWatchFlow.tsx ≥2                    | confirmed (6) |
| Plan acceptance grep — `state.category` count in AddWatchFlow.tsx ≥1                      | confirmed (1) |
| Plan acceptance grep — `useCallback` count in AddWatchFlow.tsx ≥1                         | confirmed (4) |
| Plan acceptance grep — `retryAction` + `manualAction` counts ≥2                           | confirmed (3 + 3) |
| Plan acceptance grep — `/watch/new?manual=1` count ≥1                                     | confirmed (3) |
| Plan acceptance grep — `category: data?.category` count ≥1                                | confirmed (1) |
| Plan acceptance grep — `category: 'generic-network'` count ≥1                             | confirmed (1) |
| Plan acceptance grep — `Continue manually` / `Try another URL` count == 0                 | confirmed (0) — old branch deleted |
| Plan acceptance grep — `Extraction didn't work` count == 0                                | confirmed (0) — old CardTitle gone |
| Plan acceptance grep — `category` in flowTypes.ts ≥1                                      | confirmed (3 — comment + import + variant field) |
| Code-only info-disclosure check (anthropic / claude / stack tokens, comments stripped)    | 0 matches in route.ts code (T-25-04-01 mitigation enforced) |

## Information Disclosure Audit (T-25-04-01)

Verified via `node` script that strips both block (`/* */`) and line (`//`) comments from `src/app/api/extract-watch/route.ts` and greps the code-only output for `anthropic|claude|stack`:

```bash
$ node -e "..." # see verification block above
Code-only matches for anthropic/claude/stack: []
```

The two block-comment matches noted in plan acceptance grep (line 13: `err.stack` discussion; line 53: `Anthropic SDK detection` note) are intentional documentation of the design and are NOT in any code path. The response sanitization paths are enforced by reading only `CATEGORY_COPY[category]` — never `err.message`, `err.stack`, or `String(err)` — and the explicit per-category switch makes every LOCKED copy emission auditable at the call site.

## Threat Surface Scan

No new security-relevant surface beyond the plan's documented threat model (T-25-04-01..T-25-04-07). All mitigations verified:

- **T-25-04-01** (info disclosure via error message) — mitigated. Response `error` field always sourced from `CATEGORY_COPY[category]`; raw error logged server-side only.
- **T-25-04-02** (info disclosure via category enum) — accepted per threat register. Category strings are user-safe.
- **T-25-04-03** (tampering with category in client) — mitigated. TypeScript narrows via FlowState union; defensive `?? 'generic-network'` handles unexpected shapes.
- **T-25-04-04** (rerender storm via unstable callbacks) — mitigated. Both `retryAction` and `manualAction` wrapped in `useCallback`.
- **T-25-04-05** (forged response from MITM) — accepted per threat register (out-of-scope; HTTPS via Vercel/Next.js).
- **T-25-04-06** (open redirect via manualAction) — mitigated. Hard-coded literal `/watch/new?manual=1`; no user input concatenated. Param whitelisted server-side per 25-05.
- **T-25-04-07** (HTTP 503 leaks LLM provider) — accepted per threat register. 503 is generic.

## Known Stubs

None. Every code path emits a real category enum + LOCKED D-15 copy + appropriate HTTP status. No placeholder text, no hardcoded empties, no TODO/FIXME comments.

## Threat Flags

No new security surface beyond what the plan's threat model already covers.

## Human Verification Pending (Task 3 — checkpoint:human-verify)

The plan's final task is a UAT checkpoint. Auto-mode is NOT active (`workflow._auto_chain_active: false`, `workflow.auto_advance: false` per `.planning/config.json`). Per parallel-executor protocol, this executor defers the human-verify steps to the user/orchestrator post-merge.

### What was built

URL-extract failures now surface as categorized error cards (one of 5: host-403 / structured-data-missing / LLM-timeout / quota-exceeded / generic-network). The `<ExtractErrorCard>` component (created in 25-02) replaces the legacy plain-reason-string Card in AddWatchFlow's `extraction-failed` state. Each category has a locked icon, heading, and recovery copy per D-15. Both CTAs ("Add manually" → /watch/new?manual=1; "Try a different URL" → resets the flow to idle with URL input cleared) work consistently.

### How to verify (verbatim from plan §Task 3)

1. `npm run dev`. Sign in.
2. Visit `/watch/new`.
3. **Test generic-network (easy, reproducible):** paste `https://this-domain-truly-does-not-exist-xyz123.example` and click Extract.
   - Expect: ExtractErrorCard with WifiOff icon, heading "Couldn't reach that URL", body "Couldn't reach that URL. Check the link and try again.", primary "Add manually" + secondary "Try a different URL" CTAs. URL input is still visible above the card so you can paste a different one.
4. **Test host-403 (reproducible with sites that block bots):** paste `https://www.linkedin.com/` and click Extract.
   - Expect: ExtractErrorCard with Lock icon, heading "This site blocks data extraction", body "This site doesn't allow data extraction. Try entering manually.".
5. **Test structured-data-missing (reproducible with non-watch URLs):** paste a URL like `https://example.com`.
   - Expect: ExtractErrorCard with FileQuestion icon, heading "No watch info found", body "Couldn't find watch info on this page. Try the original product page or enter manually.".
6. **Test LLM-timeout (hard to reproduce):** NOT REQUIRED in UAT. Verify code path via `grep -A3 "LLM-timeout" src/app/api/extract-watch/route.ts` (matcher: `err.name === 'AbortError' || /timeout/i.test(err.message)`).
7. **Test quota-exceeded (hard to reproduce without a real 429):** NOT REQUIRED in UAT. Verify code path via `grep -A5 "quota-exceeded" src/app/api/extract-watch/route.ts` (matcher: `typeof err.status === 'number' && err.status === 429`).
8. **Test recovery CTAs:**
   a. From any error card, click "Try a different URL" — the URL input clears, the card disappears, and focus lands on the URL input.
   b. Click "Add manually" — should navigate to /watch/new?manual=1 with the manual-entry form already shown (this exercises the 25-05 wiring too).
9. **Verify no info leak in DevTools Network tab:**
   a. Open DevTools → Network. Trigger any error.
   b. Inspect the `/api/extract-watch` response body. Expect: `{ success: false, error: "<one of the 5 D-15 strings>", category: "<enum>" }`.
   c. Confirm: NO `stack` field, NO `originalError` field, NO file paths, NO mention of "Anthropic" or "claude" anywhere in the response.
   d. Server logs (terminal where `npm run dev` runs) DO show the full error via `console.error('Extraction error:', error)` — that's correct (server-side debug).

### Resume signal

Type "approved" if generic-network + host-403 + structured-data-missing render correctly with locked copy + correct icons, recovery CTAs work, and no info leak in DevTools. LLM-timeout / quota-exceeded code-path inspection is sufficient (no need to force them).

## Self-Check: PASSED

Verified before commit:

- `[x] FOUND: src/app/api/extract-watch/route.ts` (modified)
- `[x] FOUND: src/components/watch/AddWatchFlow.tsx` (modified)
- `[x] FOUND: src/components/watch/flowTypes.ts` (modified)
- `[x] FOUND: tests/api/extract-watch.test.ts` (modified)
- `[x] FOUND: tests/api/extract-watch-auth.test.ts` (modified)
- `[x] FOUND: src/components/watch/AddWatchFlow.test.tsx` (modified)
- `[x] FOUND commit: 0849497 (Task 1 RED)`
- `[x] FOUND commit: 8444d4a (Task 1 GREEN)`
- `[x] FOUND commit: 637a77e (Task 2 RED)`
- `[x] FOUND commit: 2bc31de (Task 2 GREEN)`
- `[x] All plan acceptance grep gates pass`
- `[x] 47/47 tests pass across all touched test files`
- `[x] tsc clean for all modified files (pre-existing RecentlyEvaluatedRail.test.tsx errors are out of scope)`
- `[x] eslint clean (0 errors) for all modified source files`
- `[x] Information-disclosure audit: 0 matches in code paths for anthropic/claude/stack`

---
*Phase: 25-profile-nav-prominence-empty-states-form-polish*
*Plan: 04 (Wave 2)*
*Completed: 2026-05-02*
