---
status: complete
phase: 29-nav-profile-chrome-cleanup
source:
  - 29-01-SUMMARY.md
  - 29-02-SUMMARY.md
  - 29-03-SUMMARY.md
  - 29-04-SUMMARY.md
started: 2026-05-05T07:45:00Z
updated: 2026-05-05T08:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: |
  Kill any running dev server. Run `npm run dev`. Server boots without errors,
  the homepage loads, and `/watch/new` returns 200 (not 500). Phase 29 touched
  `src/app/watch/new/page.tsx` (Server Component), so a fresh start exercises
  the new `crypto.randomUUID()` code path.
result: pass

### 2. NAV-16 — UserMenu dropdown order
expected: |
  Click the chevron next to your avatar in the top-right. Dropdown shows
  (top to bottom): email label → Settings → Theme segmented control → Sign out.
  No "Profile" row anywhere. Avatar itself (not the chevron) still navigates
  to `/u/{username}/collection` when clicked.
result: pass

### 3. PROF-10 — Profile tab strip horizontal scroll only
expected: |
  Visit `/u/{your-username}`. The profile tab strip (Collection / Wishlist /
  Insights / Common Ground / Activity / etc.) overflows horizontally on a
  narrow window. NO vertical scrollbar appears on the tab strip itself.
  The active-tab underline is fully visible (not clipped at the bottom).
result: pass

### 4. PROF-10 — Vertical scroll gesture passthrough
expected: |
  On `/u/{your-username}`, hover or touch the profile tab strip and do a
  vertical scroll gesture (two-finger trackpad swipe up/down, OR touch swipe
  on mobile). The PAGE scrolls; the tab strip does NOT consume the gesture.
  Horizontal swipes on the tab strip still scroll the tabs.
result: pass

### 5. FORM-04 Layer 1 — CTA re-entry reset
expected: |
  Visit `/watch/new`. Paste any URL into the paste-input field. Click any
  "Add Watch" CTA elsewhere in the app (top-nav, search row 3-CTA, etc.) —
  this re-enters `/watch/new`. The paste-input field is EMPTY (not still
  showing your prior paste). Rail is empty. State is idle.
result: pass

### 6. FORM-04 Layer 2 — Back-nav from collection
expected: |
  Visit `/watch/new`. Paste a URL → wait for verdict ready. Manually navigate
  to `/u/{your-username}/collection` (or any other route). Click browser BACK
  to return to `/watch/new`. The paste-input field is EMPTY, FlowState is
  idle (no verdict-ready panel showing the prior URL's data).
result: pass

### 7. FORM-04 Layer 3 — Post-commit reset
expected: |
  Complete a full Add-Watch flow (paste URL → verdict → "Add to Collection"
  or "Add to Wishlist" → confirm). After the redirect to your collection/wishlist,
  click any "Add Watch" CTA. The form is empty (no stale paste URL, no
  stale rail entries from the just-committed flow).
result: pass

### 8. FORM-04 — Verdict cache survives remount (Option B regression check)
expected: |
  On `/watch/new`, paste a URL → verdict appears (e.g., "Core Fit" or "Role
  Duplicate"). Navigate away (browser back, or click any link). Re-enter
  `/watch/new` and paste the SAME URL again. The verdict should appear
  near-instantly (cache hit on catalogId), NOT trigger a fresh LLM extraction
  + similarity re-run. The verdict bundle is keyed on (catalogId, collectionRevision)
  and intentionally cross-session — Phase 29 should NOT have broken this.
result: issue
reported: "fail - clicking extract on the same url that i just extracted is not instant. i confirmed that http://localhost:3000/api/extract-watch fires and takes some time to resolve"
severity: major

### 9. FORM-04 — Within-flow Skip still loops back to idle inside same mount
expected: |
  On `/watch/new`, paste a URL → verdict ready → click "Skip". The view
  returns to the paste-input idle state, paste-input has focus (auto-focus
  useEffect fires), the rail keeps the just-skipped entry as a "recently
  evaluated" tile. This is a within-flow loop — NOT a re-entry — so the
  cleanup-on-remount does NOT fire. (Within-flow Skip behavior unchanged
  per CONTEXT D-17.)
result: pass

### 10. Deep-link prefill from /search "Add to Collection" CTA
expected: |
  On `/search`, click the "Add to Collection" 3-CTA on a search result row.
  Should navigate to `/watch/new?catalogId={uuid}&intent=owned` (or similar
  deep-link params per Phase 20.1) AND short-circuit the paste-flow to a
  prefilled `manual-entry` / `form-prefill` state — brand, model, reference,
  etc. populated from the catalog watch. Per CONTEXT D-16: "Deep-link entry
  from `/search` row 3-CTA or `/catalog/[id]` 3-CTA (with `?catalogId=X&intent=owned`)
  still short-circuits to form-prefill."
result: issue
reported: "clicking the 'add to collection' from a watch on /search, it navigates to /watch/new but the form is completely empty - should be prefilled with the data from the watch"
severity: major

## Summary

total: 10
passed: 8
issues: 2
pending: 0
skipped: 0

## Gaps

- truth: "Deep-link entry from /search '/Add to Collection' CTA short-circuits AddWatchFlow to a prefilled form-prefill / manual-entry state with brand, model, reference populated from the catalog watch (CONTEXT D-16)"
  status: failed
  reason: "User reported: clicking the 'add to collection' from a watch on /search, it navigates to /watch/new but the form is completely empty - should be prefilled with the data from the watch"
  severity: major
  test: 10
  artifacts: []
  missing: []

- truth: "useWatchSearchVerdictCache survives AddWatchFlow remount; pasting the same URL on re-entry returns a cached verdict bundle near-instantly without firing /api/extract-watch (CONTEXT D-15: 'The contract is cache survives entry')"
  status: failed
  reason: "User reported: fail - clicking extract on the same url that i just extracted is not instant. i confirmed that http://localhost:3000/api/extract-watch fires and takes some time to resolve"
  severity: major
  test: 8
  artifacts: []
  missing: []
  root_cause_hint: "Plan 29-04 picked Option B (let cache reset per remount) but the cache lives inside AddWatchFlow as useState. The `key` prop on <AddWatchFlow> nukes the cache on every entry. Fix: hoist useWatchSearchVerdictCache above the key boundary (Option A) — either via a Client Component wrapper that owns the cache and passes get/set down as props, OR migrate to a module-level / Zustand store that survives React tree remounts."
