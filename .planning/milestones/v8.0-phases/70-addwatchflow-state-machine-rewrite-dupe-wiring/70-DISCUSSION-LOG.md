# Phase 70: AddWatchFlow State Machine Rewrite + DUPE Wiring - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-29
**Phase:** 70-addwatchflow-state-machine-rewrite-dupe-wiring
**Areas discussed:** FlowState shape + transitions, DUPE-01/02/03 mechanics, URL-backup path (EXTR-07), Photos-pending continuation + post-commit nav

---

## Gray-area selection turn

| Option | Description | Selected |
|--------|-------------|----------|
| FlowState shape + transitions | Reconcile the ROADMAP's four-new-states enumeration with what SearchEntry already owns internally; surviving + new + retired variants. CLNP-06 link placement subsumed. | ✓ (delegated) |
| DUPE-01/02/03 mechanics | Owned-redirect target; "Add another copy" surface; "Move to Collection" Server Action choice + DupeBanner placement against ConfirmStep's locked contract. | ✓ (delegated) |
| URL-backup path (EXTR-07) | Inline mini-URL input vs `extracting-url` FlowState vs keep PasteSection. | ✓ (delegated) |
| Photos-pending continuation + post-commit nav | WatchPhotoStep gate on status; destination matrix per branch incl. DUPE-01 + DUPE-03; default initial status. | ✓ (delegated) |

**User's choice:** "Make good choices — you got this." — full delegation to Claude across all four areas.
**Notes:** User has been the operator/visionary across all prior v8.0 phases (66/67/68/69 CONTEXT.md files capture deep, hands-on decision-making). The "make good choices" pattern is a calibrated delegation — informed by the dense prior CONTEXT layer that locked every primitive Phase 70 mounts. Claude proceeds by synthesizing decisions from the established Phase 66–69 CONTEXT constraints, the ROADMAP success criteria, the PROJECT.md scope locks ("Verdict deliberately out of scope", "no changes to /w/[ref]"), and confirmed codebase facts (e.g., `editWatch` does NOT fire `logActivity` or `logNotification` — verified at `src/app/actions/watches.ts:358-512`).

---

## FlowState shape + transitions

| Option | Description | Selected |
|--------|-------------|----------|
| Honor ROADMAP CLNP-05 literally — split `search-idle`/`search-results`/`structured-input`/`extracting-structured` at the orchestrator level | Four distinct orchestrator states mirroring SearchEntry's internal state | |
| Collapse to one `search-idle` orchestrator state (SearchEntry owns sub-states internally) | Smaller union; orchestrator doesn't duplicate SearchEntry's internal state machine; reconciles to CLNP-05 SPIRIT not literal enumeration | ✓ |

**Decision:** Collapse — D-01. Reasoned deviation from ROADMAP CLNP-05's literal enumeration; CONTEXT.md captures the reconciliation; Phase 71 plan should be told to assert against THIS final union, not the ROADMAP draft.

**Transition map locked in D-02.**

**CLNP-06 link placement (D-19/D-20):** sibling-level under SearchEntry in `search-idle` branch; in-flow transition (no `?manual=1` URL push); manual-entry back-affordance label changes from "← Cancel — paste a URL instead" to "← Cancel — return to search".

**`?manual=1` + `?returnTo=` precedence (D-03/D-04):** preserved verbatim from current Server Component + AddWatchFlow plumbing; third branch of the initialState ternary changes from `'idle'` to `'search-idle'`; everything else untouched.

---

## DUPE-01/02/03 mechanics

| Option | Description | Selected |
|--------|-------------|----------|
| DUPE-01 owned redirect: route to `/w/[result.reference]` directly | Single line `router.push`; no extra round-trip; uses v7.0 unified route | ✓ |
| DUPE-01 owned redirect: look up watchId via `findViewerWatchByCatalogId` | Extra round-trip; same destination | |

**Decision:** D-05. Direct `/w/[ref]` route. D-06 fallback for null-reference catalog rows: fall through to confirming with DUPE-02 owned-banner.

| Option | Description | Selected |
|--------|-------------|----------|
| DUPE-02 surface as `/w/[ref]` button addition | Closes search-pick path; PROHIBITED by PROJECT.md "no changes to /w/[ref]" | |
| DUPE-02 surface on confirm screen via sibling DupeBanner | Honors Phase 68 D-03 LOCKED ConfirmStep contract; only appears via URL/structured paths (search-pick owned → DUPE-01 redirect skips confirm) | ✓ |
| DUPE-02 surface as inline interstitial before DUPE-01 redirect | "You already own this — View existing | Add another copy" pre-redirect; rejected: SearchCatalogWatchResult already signals viewerState before pick (user knows; redirect is the affirmative action) | |

**Decision:** D-07 + D-08. DupeBanner sibling above ConfirmStep; "Add another copy" clears dupeContext and re-renders without banner; CTA stays primary addWatch.

| Option | Description | Selected |
|--------|-------------|----------|
| DUPE-03 mechanism: extend `editWatch` with `{status: 'owned'}` shortcut | Smaller surface; but `editWatch` does NOT fire `logActivity` or `logNotification` (verified at `src/app/actions/watches.ts:358-512`) — would silently skip activity feed + overlap notifications | |
| DUPE-03 mechanism: new `moveWishlistToCollection(watchId, opts)` Server Action | Wraps the status flip + emits the missing `logActivity('watch_added', source:'wishlist_move')` + overlap notifications + revalidates | ✓ |

**Decision:** D-10. New Server Action; rationale captured.

**DupeBanner placement (D-11):** ABOVE ConfirmStep; pure presenter sibling; Phase 68 D-03 contract honored.
**CTA emphasis (D-12):** ConfirmStep primary CTA stays primary visually; DupeBanner action is contextual; UAT may revisit if confusion emerges.
**Post-DUPE-03 nav (D-13):** `defaultDestinationForStatus('owned', viewerUsername)` = `/u/[username]/collection`; skip photos-pending.

---

## URL-backup path (EXTR-07)

| Option | Description | Selected |
|--------|-------------|----------|
| Inline mini-URL input as `extracting-url` FlowState; no PasteSection import | Hard cutover ahead of Phase 71's static guard; minimal new code (small `<Input>` + `<Button>`); reuses Phase 66 `/api/extract-watch?mode=url` body shape | ✓ |
| Keep PasteSection for Phase 70; delete in Phase 71 | Zero new component code; but couples Phase 70 + Phase 71 imports awkwardly; defies Phase 71 static-guard hard-cutover muscle-memory from v7.0 ROUTE-03 Variant C | |

**Decision:** D-14 + D-15 + D-16. Inline `extracting-url` branch; "Back to search" ghost link; reuse `useUrlExtractCache` for cache-hit short-circuit (sans the verdict-compute branch — verdict is out of scope for v8.0).

---

## Photos-pending continuation + post-commit nav

| Option | Description | Selected |
|--------|-------------|----------|
| Universal photos-pending (every commit branch) | Matches v7.0 behavior; consistent UX | |
| Gate photos-pending on `status === 'owned'` | Wishlist/grail have no physical copy to photograph; "lighter confirm" goal slightly honored | ✓ |
| Drop photos-pending in v8.0 search-first / structured paths entirely | Aggressive — discards v7.0 investment in the photo system; rejected | |

**Decision:** D-17. Gate on owned. Surfaces as a v7.0→v8.0 UX evolution worth calling out in prod UAT. Form-prefill + manual-entry paths inherit the gate (today they're universal — a small regression for the manual-entry-wishlist path; acceptable).

**Post-commit destination matrix locked in D-18.** DUPE-01 → `/w/[ref]`; everything else → `defaultDestinationForStatus(status, username)` or `initialReturnTo`.

**Default initial status (D-21):** `'wishlist'` (matches WatchForm initialFormData; Phase 68 D-11 recommendation honored). DUPE-03 wishlist context → `'wishlist'`. DUPE-02 owned context → `'owned'`.

---

## Three-layer reset extension (Phase 29 / SC#5)

| Option | Description | Selected |
|--------|-------------|----------|
| Clear all four module caches on Activity-hide cleanup | Universal "fresh visit" semantics; loses cache-hit perf on back-button re-paste/re-search within session | |
| Extend cleanup only to new FlowState kinds; module caches NOT cleared on Activity-hide (CLNP-07's cross-user reset handles them) | Honors Phase 29's "local React state only" original intent; cache-hit perf preserved; Phase 69 CLNP-07 already covers cross-user signOut | ✓ |

**Decision:** D-22. Sentinel checks updated for new kinds; module caches left to CLNP-07. SC#5 of Phase 70 is satisfied by Phase 69's existing `lastUserId` reset chain — confirmed.

---

## Claude's Discretion

- DupeBanner styling, copy, and visual tokens (use `font-semibold`; muted-fill rounded card; mobile-first stacked → desktop side-by-side button row)
- `moveWishlistToCollection` Zod schema bounds (matches `addWatch` insertWatchSchema)
- Test layering: `flowTypes.test.ts`, `AddWatchFlow.test.tsx` retrofit, `DupeBanner.test.tsx`, `moveWishlistToCollection.test.ts`
- `useCallback` discipline for orchestrator handlers threaded into children
- Telemetry: `console.warn` lines on DUPE-02 + DUPE-03 surfaces for early prod observability
- `onClick` vs `onPointerDown` for DupeBanner buttons (default to `onClick`; switch if stale-instance behavior observed)
- `dupeContext` resolution shape — extend `findViewerWatchByCatalogId` to also return joined catalog reference, OR fetch separately
- VERIFY at plan-phase: `onSubmitStructured` payload from Phase 69 StructuredEntryPanel — does it include `catalogId` alongside `ExtractedWatchData`? If not, Phase 70 amends the Phase 69 contract with a small additive patch (single-line emit change). Flagged in CONTEXT specifics.

## Deferred Ideas

- `/w/[ref]` "+ Add another copy" button — closes the DUPE-02 search-pick path; PROJECT.md prohibits in v8.0
- Typed error codes from `addWatch` + `moveWishlistToCollection` — Phase 67 D-09 deferral carries forward
- Cross-action shared helper `fireWatchAddedSideEffects(watch, user)` — planner's discretion in D-10
- DupeBanner CTA emphasis swap — UAT-gated future polish
- Optimistic UI for DUPE-03 status change — consistency with addWatch wins for v8.0
- DUPE-02 "Add another copy" telemetry threshold — data-gated future polish
- Photos-pending universal mode for wishlist/grail — UAT-gated
- Phase 71 follow-ups carried forward (file deletions + static guards + RailEntry/PendingTarget cleanup)
