---
status: complete
phase: 39c-profile-layout-next-16-conformance
source:
  - 39c-01-SUMMARY.md
  - 39c-02-SUMMARY.md
  - 39c-03-SUMMARY.md
  - 39c-04-SUMMARY.md
  - 39c-05-SUMMARY.md
  - 39c-06-SUMMARY.md
  - 39c-07-SUMMARY.md
started: 2026-05-14T14:22:55Z
updated: 2026-05-14T14:35:00Z
---

## Current Test

[UAT HALTED — Tests 1-4 and Test 6 reported as issues. Tests 7-8 blocked on navigation regression. Routing to gap-closure.]

## Tests

### 1. Profile loads from top-nav (no 404)
expected: Signed in, clicking the UserMenu avatar in the top nav loads `/u/twwaneka/collection` without 404. (D-39c-09 step 3; was the original repro path.)
result: issue
reported: "the 404s are back - clicking any profile page link leads to a 404. every once in a while, like maybe 2% of the time, i won't see a 404, so it's a tiny bit inconsistent, but the vast majority of clicks result in a 404."
severity: blocker
note: "Earlier `pass` sign-off retracted — original D-39c-09 operator check was likely a false-positive (the ~2% successful-load rate matches the operator's earlier ad-hoc test sample). Phase goal NOT achieved on production at fa22080."

### 2. Each profile tab loads on click
expected: From the profile page, clicking each tab in turn (wishlist → worn → notes → stats → insights) loads without 404. Tab content swaps; URL updates to `/u/twwaneka/{tab}`. (D-39c-09 step 4.)
result: issue
reported: "the 404s are back - clicking any profile page link leads to a 404. every once in a while, like maybe 2% of the time, i won't see a 404"
severity: blocker
note: "Same regression as Test 1. The 'profile page link' covers ProfileTabs triggers as well as the UserMenu avatar."

### 3. BottomNav Profile (mobile)
expected: In DevTools mobile emulation (or on an actual phone), the BottomNav's "Profile" link loads the profile route without 404. (D-39c-09 step 5.)
result: issue
reported: "the 404s are back - clicking any profile page link leads to a 404"
severity: blocker
note: "Same regression. BottomNav Profile is one of the three documented entry points; the 'any profile page link' scope from the user's report covers it."

### 4. Two-stage partial-prefetch visible in DevTools
expected: With DevTools Network filtered to `?_rsc=`, hovering/scrolling-into-view of a Profile Link triggers a small RSC fetch (skeleton chrome, no profile content). Clicking the Link triggers a second, larger RSC fetch with the resolved content. (D-39c-09 step 6.)
result: issue
reported: "[implied — if clicks 404, the click-stage RSC fetch cannot return resolved content]"
severity: blocker
note: "Cannot trust the earlier `pass` while Tests 1-3 are blocked. The 'click' half of the two-stage prefetch is the same event that 404s in Tests 1-3. Per Plan 07 failure-mode mapping: 'Step 6 fails (only one large RSC, no partial prefetch): `unstable_instant` is not actually firing — verify Plan 04's export shipped and `cacheComponents: true` is still on at next.config.ts:13.'"

### 5. Profile edit reflects immediately (cache RYO)
expected: Edit your display name or bio via Settings → save. Navigate back to `/u/twwaneka` (or refresh that tab). The new value is visible without manual cache-clear. (Plan 05 `updateTag('profile:${username}')` RYO contract.)
result: pass

### 6. Watch add/edit/remove updates collection view
expected: Add a watch → it appears in `/u/twwaneka/collection`. Edit a watch → changes appear. Remove a watch → it disappears. No stale data, no manual reload. (Plan 05 `revalidateTag('profile:${ownerUsername}', 'max')` cross-user SWR.)
result: issue
reported: "after removing a watch, it doesn't show in the collection. the watch now appears in the 'from collectors like you' row on the home page. if i click it i see the /watch/[id] detail page and it's still showing 'owned' and i can't re-add it to my collection. even after page re-load, same state. if i search for the watch and click into the details page in the catalog, i can add it from there."
severity: major
note: "TWO bugs in one report: (a) cache: removed watch still appears in 'from collectors like you' home-row (likely Plan 05 missed an `explore`/`discovery` tag invalidation, or the cross-user fan-out tag mismatch); (b) data persistence: /watch/[id] detail page shows status='owned' AFTER reload — server-side stale, not a browser cache miss. The catalog path can re-add suggests the watch row was deleted but its presence in some derived view is sticky. Likely root cause: `removeWatch` deletes the watch row but the home 'from collectors like you' view reads from a denormalized aggregate that wasn't invalidated, AND `/watch/[id]` route was reading a derived `userStatus` projection from a stale source."

### 7. Follow / unfollow updates follower counts
expected: From a second account (or DevTools), follow or unfollow twwaneka. The follower count on `/u/twwaneka` updates within one refresh. (Plan 05 mixed RYO + cross-user invalidation in follows.ts.)
result: blocked
blocked_by: prior-test
reason: "Cannot validate while Tests 1-3 are failing — `/u/twwaneka` itself 404s on the navigation that would let us see the updated count. Re-test after Test 1-3 blocker is resolved."

### 8. Private-profile gate still works (SC#6)
expected: Toggle profile to private via Settings. From a logged-out browser (or another account), visit `/u/twwaneka` — the LockedProfileState card is shown instead of the public profile composition. No 404, no leakage. (Phase 39b carry-forward; preserved by Plan 03.)
result: blocked
blocked_by: prior-test
reason: "Cannot validate while Tests 1-3 are failing — visiting `/u/twwaneka` itself 404s. Re-test after navigation regression is resolved."

## Summary

total: 8
passed: 1
issues: 5
pending: 0
skipped: 0
blocked: 2

note: |
  Earlier `pass` marks on Tests 1-4 retracted after user reported the 404
  regression mid-UAT (Test 6 turn). The original D-39c-09 operator sign-off
  was likely a false-positive — the ~2% non-404 rate user reports matches
  the kind of sample size an ad-hoc 7-step manual check would have hit.
  Phase 39c is NOT done. Verifier PASS at fa22080 should be considered
  superseded by this empirical retest.

## Gaps

- truth: "Clicking the UserMenu avatar / ProfileTabs trigger / BottomNav Profile from a populated page navigates to the profile route without a 404, on production"
  status: failed
  reason: "User reported: 'the 404s are back - clicking any profile page link leads to a 404. every once in a while, like maybe 2% of the time, i won't see a 404, so it's a tiny bit inconsistent, but the vast majority of clicks result in a 404.' Original D-39c-09 operator sign-off retracted — the ~2% non-404 rate matches the ad-hoc sample size the manual check would have caught."
  severity: blocker
  test: 1,2,3,4
  artifacts:
    - "src/app/u/[username]/layout.tsx (Plan 03 — refactored to thin Suspense shell)"
    - "src/app/u/[username]/profile-gate.tsx (Plan 03 — viewer-dependent branching)"
    - "src/app/u/[username]/profile-shell-resolver.tsx (Plan 02 — 'use cache' resolver)"
    - "src/app/u/[username]/[tab]/page.tsx (Plan 04 — unstable_instant gate)"
    - "src/components/layout/UserMenu.tsx (Plan 06 — prefetch={false} removed)"
    - "src/components/profile/ProfileTabs.tsx (Plan 06)"
    - "src/components/layout/BottomNav.tsx (Plan 06)"
    - ".planning/debug/profile-page-404-top-nav.md (original bug report)"
  missing:
    - "Empirical verification at >1 sample size — manual D-39c-09 check was a 1-click-per-step protocol that could not catch a ~98% failure rate"
    - "Server-side log evidence (where does the 404 originate? notFound() from ProfileGate, or actual route miss?)"
    - "Browser DevTools Network capture of a failing click (RSC payload? status code? cookies?)"
  failure_mode_routing: "Plan 07 §how-to-verify maps: 'Step 3/4/5 fails (404 reproduces) → structural refactor is incomplete — most likely the layout still has an uncached top-level read OR the resolver leaks viewer state. Re-run static-analysis grep from VALIDATION.md.' Reopen Plan 03; treat as gap-closure."

- truth: "Removing a watch removes it from the user's collection view AND from any derived 'from collectors like you' / discovery surfaces; the /watch/[id] detail page reflects the removed status server-side after page reload"
  status: failed
  reason: "User reported: 'after removing a watch, it doesn't show in the collection. the watch now appears in the from collectors like you row on the home page. if i click it i see the /watch/[id] detail page and it's still showing owned and i can't re-add it to my collection. even after page re-load, same state. if i search for the watch and click into the details page in the catalog, i can add it from there.'"
  severity: major
  test: 6
  artifacts:
    - "src/app/actions/watches.ts (Plan 05 — `removeWatch` invalidation wiring)"
    - "src/app/actions/watches.ts (`removeWatch` server action body — does it actually DELETE, or does it soft-flip status?)"
    - "Home page 'from collectors like you' data source — which DAL? Which cache tag?"
    - "src/app/watch/[id]/page.tsx — does it read user-status via a cached path that wasn't invalidated by removeWatch?"
  missing:
    - "Tag-family coverage check: does `revalidateTag('profile:${ownerUsername}', 'max')` reach the home 'from collectors like you' rail? Likely NO — that rail probably reads from `explore` or `discovery:*` tag space not invalidated by profile-tag fan-out."
    - "Persistence check: does removeWatch actually delete the row, or only flip status? If only flip, where does /watch/[id] read user-status from?"
    - "Root-cause distinction: the user notes the catalog detail page CAN re-add the watch — so the watch row IS gone, but some derived view (likely cached by id) persists 'owned' state."
  failure_mode_routing: "Reopen Plan 05 (cache invalidation) AND audit `removeWatch` body in src/app/actions/watches.ts. Add `revalidateTag('explore', 'max')` or whatever tag the 'from collectors like you' source uses. Audit the /watch/[id] route data dependency for user-status caching."
