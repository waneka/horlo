---
status: complete
phase: 70-addwatchflow-state-machine-rewrite-dupe-wiring
source: [70-VERIFICATION.md human_verification block (deferred to prod walk per feedback_mobile_ui_verify_on_prod)]
deploy: 418f0515 (origin/main tip — pushed 2026-05-29)
started: 2026-05-29T22:30:00Z
updated: 2026-05-29T23:15:00Z
---

## Current Test

[testing complete — 6 passed / 2 issues / 0 pending; 4 distinct defects captured across Tests 1 + 8]

## Tests

### 1. DUPE-01 owned search-pick → /w/[ref] redirect (mobile + desktop)
expected: Typing a watch in the SearchEntry combobox, clicking a result whose viewerState is 'owned', lands on /w/[ref] (NOT the confirm screen). No spinner flicker or extra paint.
result: issue
reported: "typing the brand matches my watch. adding the model doesn't. owned watch: TIMEX Weekender 38mm Fabric Strap Watch (this model probably needs cleaned up, should just be weekender) — 'Timex' shows matches, 'Timex Weekender' shows no matches. owned watch: Brut Datejust — 'Brut' shows match, 'Brut datejust' shows no matches. SEPARATE BUG: clicking on the 'in collection' match leads to a 404. i think it's using the reference but that doesn't seem to work as the id for /w/[id]"
severity: blocker
notes: Two distinct defects reported on the same test. SRCH-01 (search-multi-token-degrades) — multi-token queries past the brand return zero matches, breaking primary search-first flow. ROUTE-01 (owned-redirect-404) — DUPE-01 success criterion ("lands on /w/[ref]") fully broken; redirect target resolves to 404. Test 1 failed on both.

### 2. DUPE-02 'Add another copy' on owned context
expected: Submitting structured input for an owned watch → DupeBanner-owned mounts above ConfirmStep with 'View existing' + 'Add another copy'. Clicking 'Add another copy' unmounts the banner and ConfirmStep stays mounted; clicking ConfirmStep primary creates a SECOND watches row bound to the same catalog row. Verify via /u/[user]/collection that two rows exist for the same catalog ref.
result: pass

### 3. DUPE-03 wishlist search-pick → Move to Collection (UPDATE not INSERT)
expected: Picking a watch with viewerState='wishlist' → DupeBanner-wishlist mounts; clicking 'Move to Collection' fires moveWishlistToCollection; after success the watch appears in /u/[user]/collection AND DISAPPEARS from /u/[user]/wishlist (single row, status flipped — NOT two rows). Activity feed shows 'watch_added' entry; cross-user overlap notifications fire.
result: pass

### 4. CLNP-06 'Skip search — enter manually' in-flow transition preserves URL
expected: On /watch/new (search-idle), clicking the 'Skip search — enter manually' link advances to WatchForm without changing the browser URL away from /watch/new (NO ?manual=1 appended). Back button goes to the prior page, not search-idle.
result: pass

### 5. ?manual=1 deep-link priority + ?returnTo= round-trip
expected: Navigating to /watch/new?manual=1&returnTo=/u/tester/wishlist lands directly in manual-entry (no SearchEntry), and after a wishlist commit the user is redirected to /u/tester/wishlist (the returnTo destination).
result: pass

### 6. Three-layer reset hygiene across user-switch + Activity-hide
expected: Sign in as user-a, type a search query (cache populated), navigate to Activity tab, navigate back to /watch/new — search-idle renders empty (Activity-hide reset). Then sign out, sign in as user-b — typing the same query produces fresh server-fetched results (user-b's viewerState NOT user-a's cached one).
result: pass

### 7. D-17 photos-pending gate on wishlist commit
expected: Manual-entry with status=wishlist → after WatchForm commit, lands directly on /u/[user]/wishlist (NO WatchPhotoStep). Manual-entry with status=owned → after commit, sees WatchPhotoStep then lands on /u/[user]/collection.
result: pass

### 8. Mobile-visual quality of DupeBanner action row
expected: On a phone-width viewport, DupeBanner's action row stacks vertically (flex-col); on desktop it lays out side-by-side (sm:flex-row). Touch targets are ≥44px tall (min-h-[44px]). Headline is font-semibold not font-medium (no-raw-palette guardrail).
result: issue
reported: "on mobile, when i focus on the input it zooms in slightly. shouldn't do that. triggered the dupebanner - the primary CTA for the form is disabled and says 'saving...'"
severity: major
notes: Two distinct defects reported. MOB-01 (input-zoom-on-focus) — iOS Safari auto-zooms when input font-size < 16px; affects the whole app, not just DupeBanner; minor severity on its own but cumulative UX cost. DUPE-04 (WR-01 fix surfaced as wrong copy) — Plan 70-08 closed the WR-01 silent-duplicate leak by passing `pending={state.pending || state.dupeContext != null}` into ConfirmStep, but ConfirmStep renders pending=true as "Saving..." copy regardless of cause; user sees a stuck "Saving..." button with no spinner and no banner-relationship cue. Functionally correct (button is gated), UX-degraded (copy is misleading). The verifier's "alternative fix" — hide ConfirmStep entirely when dupeContext is set — would avoid this regression.

## Summary

total: 8
passed: 6
issues: 2
pending: 0
skipped: 0
blocked: 0
defects_total: 4
defects:
  - SRCH-01 (blocker, test 1) — multi-token search degrades
  - ROUTE-01 (blocker, test 1) — owned redirect /w/[ref] 404
  - MOB-01 (minor, test 8) — iOS input zoom on focus (whole app)
  - DUPE-04 (major, test 8) — WR-01 gate surfaces as misleading "Saving..." copy

## Gaps

- truth: "SearchEntry returns relevant results when the query extends past the brand token (e.g., 'Brut Datejust', 'Timex Weekender')"
  status: failed
  reason: "User reported: typing the brand matches my watch. adding the model doesn't. 'Timex' shows matches, 'Timex Weekender' shows no matches. 'Brut' shows match, 'Brut datejust' shows no matches. (User also noted: TIMEX Weekender 38mm Fabric Strap Watch's model field likely needs catalog cleanup — should just be Weekender.)"
  severity: blocker
  test: 1
  defect_id: SRCH-01
  hypothesis: |
    parseSearchQuery (Phase 69 D-12 longest-prefix brand match) likely consumes the brand
    correctly but the remaining model token is being passed to the DAL as a full-string
    match instead of a substring/token match. Alt hypothesis: the catalog row's model
    field has trailing noise ('Weekender 38mm Fabric Strap Watch') and the DAL does a
    leading-substring or exact-prefix match, so 'Weekender' alone matches but
    'Weekender ' (with trailing space from parsing) misses. Confirm by grepping
    src/data/catalog.ts searchCatalog (or whatever the DAL function is) and
    src/lib/searchEntry/parseSearchQuery.ts.
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Clicking an 'In collection' search result redirects to /w/[reference] which renders the watch detail page (NOT a 404)"
  status: failed
  reason: "User reported: clicking on the 'in collection' match leads to a 404. i think it's using the reference but that doesn't seem to work as the id for /w/[id]"
  severity: blocker
  test: 1
  defect_id: ROUTE-01
  hypothesis: |
    Per memory project_v7_0_watch_photos: 'Variant C unified /w/[ref] route tackled FIRST
    as a HARD CUTOVER (legacy routes removed, no redirect)'. The route /w/[ref] should
    resolve by catalog reference field. Either: (a) the redirect target is using the
    wrong field (e.g., the wear_event id or watches.id instead of catalog reference),
    (b) the /w/[ref] route handler doesn't lookup by reference correctly, or (c) the
    catalog row's reference field is empty for the owned watch (route can't resolve a
    null/empty ref). Confirm by checking handleSearchPick owned-branch redirect logic
    in AddWatchFlow.tsx and src/app/w/[ref]/page.tsx route handler.
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Focusing any input on mobile does not trigger iOS Safari's auto-zoom"
  status: failed
  reason: "User reported: on mobile, when i focus on the input it zooms in slightly. shouldn't do that."
  severity: minor
  test: 8
  defect_id: MOB-01
  hypothesis: |
    iOS Safari auto-zooms any input whose font-size is < 16px. Fix is typically a
    global CSS rule setting `font-size: 16px` (or larger) on `input, textarea, select`
    elements, OR adding `maximum-scale=1` to the viewport meta tag (less preferred —
    breaks accessibility for users who need to zoom). Affects the whole app, not just
    the add-watch flow. Confirm by inspecting input font-size on prod (DevTools mobile
    emulator) and globals.css / Tailwind config.
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "DupeBanner's mounted state communicates the ConfirmStep CTA is gated for a clear reason (not displayed as 'Saving...' with no banner relationship)"
  status: failed
  reason: "User reported: triggered the dupebanner - the primary CTA for the form is disabled and says 'saving...'"
  severity: major
  test: 8
  defect_id: DUPE-04
  hypothesis: |
    Plan 70-08 closed WR-01 by passing `pending={state.pending || state.dupeContext != null}`
    into ConfirmStep. The button is mechanically gated (good — no silent duplicates) but
    ConfirmStep renders pending=true as "Saving..." copy regardless of cause. The verifier's
    own missing[0] note offered an "Alternative: hide ConfirmStep entirely until dupeContext
    is dismissed" — which would avoid this regression. Either:
    (a) Hide ConfirmStep when state.dupeContext != null (verifier's alternative fix), OR
    (b) Pass a separate prop to ConfirmStep (e.g., gatedReason: 'dupe' | 'pending' | null)
        and render appropriate copy ("Use the banner above" or similar) for the dupe case.
    Option (a) is the cleaner fix per the verifier's original guidance and is what closes
    the gap without copy ambiguity.
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
