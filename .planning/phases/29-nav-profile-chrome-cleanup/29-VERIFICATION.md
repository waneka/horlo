---
phase: 29-nav-profile-chrome-cleanup
verified: 2026-05-04T00:43:46Z
re_verified: 2026-05-05T12:35:00Z
status: passed
score: 3/3 must-haves verified at unit-test level + 10/10 UAT items passed in browser
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 3/3 must-haves at unit-test level (5 manual UAT items pending)
  trigger: "29-UAT.md status: complete — 10/10 tests passed across three rounds of re-testing"
  ships_since_first_verification:
    - "29-05 — useWatchSearchVerdictCache module-scope migration (commits e3f691d, 61f0820, a11061f)"
    - "29-06 — StrictMode-safe useLayoutEffect cleanup + global vitest StrictMode wrapper (commits 7b5c98f, 3e7d20a, 881d6fb, dd2e147)"
    - "Quick Task FORM-04 Gap 3 — useUrlExtractCache module-scope (commits 03667a5, 8de2382, 726f2ed, 0815c96)"
human_verification:
  - test: "PROF-10 vertical-scroll passthrough on touch/trackpad"
    expected: "On /u/{username} narrow viewport: scroll vertically with two-finger trackpad swipe over the tab strip — page scrolls, tab strip does NOT consume the gesture. Touch on mobile if available."
    why_human: "JSDOM does not faithfully simulate touch/trackpad gesture forwarding (RESEARCH D-11)."
    status: passed
    verified_via: "29-UAT.md Test 4 (re-test 2026-05-05)"
  - test: "FORM-04 back-nav reset (Activity-preservation)"
    expected: "Navigate /watch/new → paste URL → wait for verdict-ready → router.push('/u/{username}/collection') → browser-back → assert paste URL input is empty AND state.kind === 'idle'."
    why_human: "Activity-preservation behavior is router-runtime-specific; JSDOM cannot replay Next.js client cache. Validates the useLayoutEffect cleanup-on-hide layer (Layer 2)."
    status: passed
    verified_via: "29-UAT.md Test 6 (originally pass; preserved across 29-06 cleanup-guard rework)"
  - test: "FORM-04 CTA re-entry reset"
    expected: "Enter /watch/new from any 'Add Watch' CTA → paste URL → navigate elsewhere via Cancel/Skip-to-elsewhere or commit → click 'Add Watch' CTA again → paste URL must be empty AND rail must be empty."
    why_human: "End-to-end navigation flow not exercised in unit tests. Validates the per-request nonce + key prop layer (Layer 1)."
    status: passed
    verified_via: "29-UAT.md Test 5 (originally pass; preserved)"
  - test: "FORM-04 forward-nav post-commit reset"
    expected: "Navigate /watch/new → paste URL → verdict-ready → commit (wishlist confirm) → land on /u/{username}/wishlist → click Add Watch CTA → assert paste URL empty + state idle. Validates Layer 3 (commit-time reset BEFORE router.push)."
    why_human: "Requires running router.push and re-entering the route — needs live app."
    status: passed
    verified_via: "29-UAT.md Test 7 (originally pass; preserved)"
  - test: "FORM-04 verdict cache survival check"
    expected: "Navigate /watch/new → evaluate catalog A → navigate elsewhere → re-enter /watch/new → paste catalog A again → verdict appears (cache repopulates fast via collectionRevision-keyed re-fetch per Phase 20 D-06; Option B accepted)."
    why_human: "Tests cache-keyed re-fetch behavior across navigation; UAT confirms the reset is not user-observable."
    status: passed
    verified_via: |
      29-UAT.md Test 8 — closed across two ships:
        1. 29-05 made the verdict cache survive remount (module-scope migration)
        2. Quick FORM-04 Gap 3 added useUrlExtractCache so /api/extract-watch is also skipped on URL re-paste (the user-observable bottleneck the verdict cache could not address — its keying on catalogId requires the extract step to have already completed)
      Re-test 2026-05-05: DevTools Network filter empty on second paste of same URL across remount; verdict appears instantly.
---

# Phase 29: Nav & Profile Chrome Cleanup — Verification Report

**Phase Goal:** The UserMenu, profile tab strip, and Add-Watch flow are tight and predictable — no duplicate Profile affordance, no surprise vertical scroll on the tab strip, and a fresh Add-Watch form on every entry instead of stale data from the prior session.

**Verified:** 2026-05-04T00:43:46Z (initial)
**Re-verified:** 2026-05-05T12:35:00Z
**Status:** passed (3/3 success criteria + 10/10 UAT items + 2 phase-29-regression UAT gaps closed)
**Re-verification:** Yes — see "Re-Verification (2026-05-05)" section below.

---

## Re-Verification (2026-05-05)

**Trigger:** 29-UAT.md status flipped to `complete` after the user manually re-tested in browser. 10/10 UAT items now pass (was 8/10 with 2 phase-29-regression gaps after the original 2026-05-04 verification round).

**What changed since initial verification:**

| Ship | Commits | What it closed |
|---|---|---|
| Plan 29-05 | `e3f691d` `61f0820` `a11061f` | Verdict cache survives AddWatchFlow remount via module-scope migration of `useWatchSearchVerdictCache`. Public API `{revision, get, set}` byte-identical; both consumers zero-diff. Closes 29-UAT Test 8 partially (verdict layer). |
| Plan 29-06 | `7b5c98f` `3e7d20a` `881d6fb` `dd2e147` | StrictMode-safe `useLayoutEffect` cleanup with two skip cases (initial idle + form-prefill). Global vitest StrictMode wrapper added (`tests/setup.ts` → `tests/setup.tsx` + `vi.mock('@testing-library/react', ...)`). Closes 29-UAT Test 10 (deep-link prefill from `/search` survives StrictMode). |
| Quick FORM-04 Gap 3 | `03667a5` `8de2382` `726f2ed` `0815c96` | New `src/components/watch/useUrlExtractCache.ts` — module-scoped Map keyed on raw URL. `handleExtract` consults it BEFORE `/api/extract-watch` fetch; on hit, skips the round-trip entirely. Closes 29-UAT Test 8 fully (extract layer — the user-observable bottleneck). |

**Why two ships were needed for Test 8:** Plan 29-05 fixed what its contract promised — the verdict cache survives remount. But the `useWatchSearchVerdictCache` only short-circuits the verdict server action, not the upstream `/api/extract-watch` fetch. The cache key is `catalogId`, which is only known AFTER extract returns. Re-test of Test 8 still failed because the user observes the network call in DevTools. Quick FORM-04 Gap 3 added a parallel `useUrlExtractCache` keyed on URL → `{catalogId, extracted, catalogIdError}` so the fetch itself is also skipped on hit. Strongest assertion in the FORM-04 test suite: `tests/components/watch/AddWatchFlow.urlCacheRemount.test.tsx` proves `fetchSpy === 1` across remount + same-URL re-paste.

**Verification artifacts updated:**
- 29-UAT.md `status: complete`, 10/10 pass, both prior gaps marked CLOSED with `resolution:` stanzas
- STATE.md `status: verifying`, last_activity reflects UAT closure
- ROADMAP.md Phase 29 line bumped to "6/6 plans complete; ready for re-verification" (now superseded by this re-verification)

**Score:** 3/3 must-haves + 10/10 UAT + 2 regression gaps closed = phase fully verified.

---

---

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | UserMenu dropdown no longer shows a "Profile" item; avatar Link remains primary path to /u/{username}; UserMenu still exposes Settings, Theme segmented control, and Sign out | VERIFIED | `grep -c "Profile" src/components/layout/UserMenu.tsx` returns `0`. UserMenu.tsx:60-89 dropdownContent renders email-label → DropdownMenuSeparator → Settings → DropdownMenuSeparator → Theme → DropdownMenuSeparator → Sign out (no Profile row). Avatar Link at lines 110-122 routes to `/u/${username}/collection`. Test 3 (`UserMenu.test.tsx:75-90`) asserts ordering Settings/Theme/Sign out + `expect(text).not.toMatch(/Profile/)`. 12/12 UserMenu tests pass. |
| 2 | On /u/[username], profile tab strip scrolls horizontally only when tabs overflow — no vertical scroll-bar appears, no vertical-scroll gesture is consumed by tab strip on touch/trackpad | VERIFIED (unit) + DEFERRED (gesture passthrough) | `ProfileTabs.tsx:65` TabsList className: `w-full justify-start gap-2 overflow-x-auto overflow-y-hidden pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`. All 4 PROF-10 utilities present in locked literal. Test at `ProfileTabs.test.tsx:120-138` asserts all 4 utilities. `src/components/ui/tabs.tsx` UNCHANGED (Pitfall 7 honored). 8/8 ProfileTabs tests pass. Touch-gesture passthrough is manual UAT (JSDOM cannot simulate). |
| 3 | Every entry to /watch/new (CTA, browser back/forward, refresh, post-commit re-nav) renders Add-Watch flow in fresh state; verdict cache unaffected; within-flow Skip/Cancel still loop to idle inside same mount | VERIFIED (unit) + DEFERRED (cross-route routing) | Three-layer defense shipped: **Layer 1** — `src/app/watch/new/page.tsx:102` `const flowKey = crypto.randomUUID()` → `<AddWatchFlow key={flowKey}>` (line 110, JSX-level — Pitfall 8 honored). **Layer 2** — `AddWatchFlow.tsx:137-143` `useLayoutEffect(() => () => { setState({kind:'idle'}); setUrl(''); setRail([]) }, [])`. **Layer 3** — `AddWatchFlow.tsx:346-349` resets BEFORE `router.push(dest)` in handleWishlistConfirm. Within-flow useEffect (line 122-127) preserved verbatim — D-17 honored. Verdict cache (`useWatchSearchVerdictCache`) UNCHANGED at line 114. AddWatchFlow.test.tsx Test 1 (key-change) + Test 2 (cleanup sanity) pass; WatchForm.test.tsx FORM-04 reset block passes; useWatchSearchVerdictCache.test.tsx 4/4 pass. |

**Score:** 3/3 success criteria DELIVERED at code+unit-test level. 5 items routed to manual UAT (gesture passthrough + 4 cross-route navigation flows that JSDOM cannot replay).

---

## Required Artifacts

### NAV-16

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/layout/UserMenu.tsx` | Profile DropdownMenuItem deleted; both surrounding separators preserved | VERIFIED | `grep -c "Profile" UserMenu.tsx` = 0 (zero Profile references including JSDoc). `grep -c "DropdownMenuSeparator" UserMenu.tsx` = 4 (1 import + 3 JSX usages — UI-SPEC D-01 wording precision honored: BOTH separators stayed). dropdownContent (lines 60-89) shows email-label / Settings / Theme / Sign out only. JSDoc line 25 reads "Settings / Theme / Sign out — per Phase 29 NAV-16 dropdown content". |
| `tests/components/layout/UserMenu.test.tsx` | Test 3 rewritten without profileIdx; Test 4 deleted; Test 9 (null-username) preserved | VERIFIED | Test 3 (line 75) asserts ordering Settings/Theme/Sign out + `expect(text).not.toMatch(/Profile/)`. Test 4 not present (deleted per D-05). Test 5+ retain original IDs (line 91 = "Test 5 — Settings item links to /settings"). 3 Profile string matches remain (in non-deleted tests / comments — global-truth assertion `queryByRole({ name: /^profile$/i })).toBeNull()`). 12/12 tests pass. |

### PROF-10

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/profile/ProfileTabs.tsx` | TabsList className includes locked-literal: `w-full justify-start gap-2 overflow-x-auto overflow-y-hidden pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden` | VERIFIED | Line 65 contains the full locked literal (verified via direct read). Tailwind 4 arbitrary-variant utilities (`[scrollbar-width:none]`, `[&::-webkit-scrollbar]:hidden`) present. Indicator-overshoot mitigation (`pb-2`) present. |
| `tests/components/profile/ProfileTabs.test.tsx` | New describe block asserting all 4 PROF-10 utilities + 4 preserved utilities | VERIFIED | New describe block at line 120 ("ProfileTabs — PROF-10 horizontal-only scroll className override") asserts `overflow-x-auto`, `overflow-y-hidden`, `pb-2`, `[scrollbar-width:none]`, `[&::-webkit-scrollbar]:hidden` (lines 132-137). |
| `src/components/ui/tabs.tsx` | UNCHANGED (Pitfall 7 / D-09) | VERIFIED | File contents match pre-Phase-29 state (tabsListVariants cva at lines 26-39 unchanged; TabsTrigger active-line indicator `after:bottom-[-5px]` at line 64 unchanged). |

### FORM-04

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/watch/new/page.tsx` | per-request `crypto.randomUUID()` nonce + `key={flowKey}` on AddWatchFlow + Pitfall 2 inline guard | VERIFIED | Line 97-101: comment block including "DO NOT add 'use cache' to this file; the nonce must be per-request, not per-build (RESEARCH Pitfall 2)". Line 102: `const flowKey = crypto.randomUUID()`. Line 110: `key={flowKey}` as first prop on `<AddWatchFlow>` (JSX level, NOT inside spread — Pitfall 8). Page is dynamic via `await searchParams` (line 55) so connection() ceremony not required. |
| `src/components/watch/AddWatchFlow.tsx` Layer 2 | useLayoutEffect cleanup-on-hide reset to {kind:'idle'} / '' / [] | VERIFIED | Line 3: `import { useCallback, useEffect, useLayoutEffect, useState, useTransition } from 'react'` (canonical alphabetical position). Lines 137-143: `useLayoutEffect(() => { return () => { setState({ kind: 'idle' }); setUrl(''); setRail([]) } }, [])`. Empty-deps array — runs on unmount / Activity-hide. Existing focus useEffect at lines 122-127 preserved verbatim (D-17 within-flow Skip behavior unchanged). |
| `src/components/watch/AddWatchFlow.tsx` Layer 3 | handleWishlistConfirm explicit reset BEFORE router.push | VERIFIED | Lines 340-349 contain the Phase 29 D-14 explanatory comment + reset sequence: `setUrl(''); setRail([]); setState({ kind: 'idle' }); router.push(dest)`. Phase 28 contradicted comment ("intentionally NOT called") removed. |
| `src/components/watch/WatchForm.tsx` | UNCHANGED (re-mounts implicitly via parent key change) | VERIFIED | No edits to WatchForm.tsx — re-mount behavior is implicit through parent (PATTERNS.md §3 contract). Plan 01's WatchForm reset-on-key-change test passes without any direct WatchForm change. |
| `src/components/search/useWatchSearchVerdictCache.ts` | UNCHANGED (locked READ-ONLY per D-15 Option B) | VERIFIED | No edits. Phase 20 D-06 useWatchSearchVerdictCache.test.tsx 4/4 pass post-Plan-04. |
| `tests/components/watch/AddWatchFlow.test.tsx` | NEW Wave 0 — Test 1 (key-change remount) + Test 2 (useLayoutEffect cleanup-on-hide sanity) | VERIFIED | NEW file (per SUMMARY 01). Test 1 (line 68): rerender with new key — paste URL empty assertion. Test 2 (line 90): mount, type, unmount — `expect(() => unmount()).not.toThrow()`. Both pass. |
| `tests/components/watch/WatchForm.test.tsx` | Extended FORM-04 describe block | VERIFIED | New describe block at line 237: "WatchForm — FORM-04 reset on parent key change (CONTEXT D-19)". Lines 241-250: render `<WatchForm key="a">`, type Omega/Speedmaster, rerender with `key="b"`, assert formData defaults restored. Passes. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| /watch/new page | AddWatchFlow remount | crypto.randomUUID() → key prop | VERIFIED | page.tsx:102 generates per-request nonce; line 110 threads as key. RTL rerender + key change triggers React's standard remount semantics; AddWatchFlow.test.tsx Test 1 passes. |
| AddWatchFlow Activity-hide | local state reset | useLayoutEffect cleanup empty-deps | VERIFIED | AddWatchFlow.tsx:137-143. Cleanup callback resets all 3 state slots (state/url/rail). Test 2 sanity gate green (no throw on unmount). Live UAT confirms back-nav case (Pitfall 4). |
| handleWishlistConfirm success | router.push(dest) post-reset | inline setUrl/setRail/setState before router.push | VERIFIED | AddWatchFlow.tsx:346-349 — exact ordering shipped per plan. Eliminates post-commit stale-state paint frame (Layer 3 defense-in-depth on Layer 1+2). |
| AddWatchFlow remount | verdict cache survival | Option B (collectionRevision re-fetch) | VERIFIED | useWatchSearchVerdictCache.test.tsx 4/4 pass; cache resets per remount and repopulates fast via collectionRevision-keyed re-fetch (Phase 20 D-06 contract). |
| UserMenu avatar | /u/{username}/collection | Link href | VERIFIED | UserMenu.tsx:111 — `<Link href={\`/u/${username}/collection\`}>`. Phase 25 D-01..D-04 dual-affordance preserved. |
| ProfileTabs render site | /u/[username] layout | mounted at layout.tsx:136-142 | VERIFIED (referenced) | Layout.tsx render site UNCHANGED per CONTEXT scope; only TabsList className modified. |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| UserMenu | user.email, username | server-resolved Server Component prop | Yes (live auth + profile table) | FLOWING |
| ProfileTabs | tabs[] derived from showCommonGround / isOwner | parent layout (server) — pathname driven | Yes (renders 5-7 tabs based on owner/visitor state) | FLOWING |
| AddWatchFlow | initialState derived from initialCatalogPrefill, initialIntent, initialManual | page Server Component (catalog DB fetch + searchParams) | Yes (deep-link prefill resolved server-side) | FLOWING |
| AddWatchFlow flowKey | crypto.randomUUID() | request-time | Yes (fresh UUID per request — confirmed by Pitfall 2 guard) | FLOWING |
| WatchForm formData | initialFormData lazy-init | re-runs on parent key change (no client storage) | Yes (defaults restored) | FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All Phase 29 test files green | `npm run test -- tests/components/layout/UserMenu.test.tsx tests/components/profile/ProfileTabs.test.tsx tests/components/watch/AddWatchFlow.test.tsx tests/components/watch/WatchForm.test.tsx` | 33/33 pass in 2.37s | PASS |
| Verdict cache regression (Phase 20 D-06) | `npm run test -- tests/components/search/useWatchSearchVerdictCache.test.tsx` | 4/4 pass | PASS |
| Zero Profile references in UserMenu source | `grep -c "Profile" src/components/layout/UserMenu.tsx` | `0` | PASS |
| 4 separator usages preserved (1 import + 3 JSX) | `grep -c "DropdownMenuSeparator" src/components/layout/UserMenu.tsx` | `4` | PASS |
| useLayoutEffect imported + invoked in AddWatchFlow | `grep -n "useLayoutEffect" src/components/watch/AddWatchFlow.tsx` | 4 occurrences (import + hook call + comment refs) | PASS |
| crypto.randomUUID() in /watch/new page | `grep -n "crypto.randomUUID" src/app/watch/new/page.tsx` | line 102 | PASS |
| key={flowKey} on AddWatchFlow JSX | `grep -n "key={flowKey}" src/app/watch/new/page.tsx` | line 110 | PASS |
| tabs.tsx UNCHANGED (Pitfall 7) | direct read + diff | tabsListVariants cva and TabsTrigger after:bottom-[-5px] match pre-phase | PASS |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| NAV-16 | Plan 02 | Remove redundant Profile link from UserMenu dropdown | SATISFIED | UserMenu.tsx — Profile DropdownMenuItem deleted; 12/12 tests pass; avatar Link remains primary path |
| PROF-10 | Plan 03 | Profile tab strip horizontal-only scroll | SATISFIED (unit) + DEFERRED (gesture passthrough) | ProfileTabs.tsx:65 locked literal applied; 8/8 tests pass; manual UAT for touch/trackpad gesture passthrough |
| FORM-04 | Plans 01 + 04 | Add-Watch flow resets on every entry | SATISFIED (unit) + DEFERRED (cross-route nav) | Three-layer defense shipped (key prop + useLayoutEffect cleanup + commit-time reset); AddWatchFlow + WatchForm + verdict cache tests all green; manual UAT for back-nav, CTA re-entry, post-commit nav |

**Tracking-doc inconsistency note:** REQUIREMENTS.md line 42 marks FORM-04 as `- [ ]` and the table at line 91 lists `Pending`. The actual implementation is complete (Plan 04 SUMMARY shipped 2026-05-05; commits `6b4546b` + `d51dad3` landed). REQUIREMENTS.md needs a check-mark update during phase-end housekeeping. This is a documentation lag, not a goal-achievement gap.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | — | — | All edited files clean. No TODOs/FIXMEs/placeholders introduced. No empty handlers or hardcoded empty data flowing to UI. |

Pre-existing TypeScript errors in unrelated test files (RecentlyEvaluatedRail.test.tsx, DesktopTopNav.test.tsx, PreferencesClient.debt01.test.tsx, useSearchState.test.tsx, PreferencesClientEmbedded.test.tsx, WatchForm.isChronometer.test.tsx, WatchForm.notesPublic.test.tsx, phase17-extract-route-wiring.test.ts) are documented in Plan 01 + Plan 04 SUMMARYs as pre-existing on `main`. None introduced by Phase 29 edits — verified via `tsc --noEmit | grep -E "(watch/new/page|AddWatchFlow.tsx|UserMenu|ProfileTabs)"` (zero output).

---

## Human Verification Required

Five manual UAT items routed to `/gsd-verify-work` per CONTEXT D-11 + D-19:

### 1. PROF-10 vertical-scroll gesture passthrough

**Test:** On `/u/{username}/collection` at narrow viewport (<768px), scroll vertically with two-finger trackpad swipe over the tab strip. Repeat with touch on mobile if available.
**Expected:** Page scrolls; tab strip does NOT consume the gesture. NO horizontal scrollbar visible. NO vertical scrollbar visible. Active-tab underline indicator remains visible (clipped inside parent's `pb-2` region).
**Why human:** JSDOM does not faithfully simulate touch/trackpad gesture forwarding (RESEARCH D-11).

### 2. FORM-04 back-nav reset (Activity-preservation)

**Test:** Navigate to `/watch/new` → paste a URL → wait for verdict-ready → router.push to `/u/{username}/collection` → press browser-back to return to `/watch/new`.
**Expected:** Paste URL input is empty AND `state.kind === 'idle'`.
**Why human:** Activity-preservation behavior is router-runtime-specific; JSDOM cannot replay Next.js client cache. This validates Layer 2 (useLayoutEffect cleanup-on-hide) — Pitfall 4 (Server Component does NOT re-run on back-nav, so Layer 1 nonce is stale).

### 3. FORM-04 CTA re-entry reset

**Test:** Enter `/watch/new` from any "Add Watch" CTA → paste URL → navigate elsewhere via Cancel/Skip-to-elsewhere or commit → click "Add Watch" CTA again.
**Expected:** Paste URL is empty AND rail is empty.
**Why human:** End-to-end navigation flow not exercised in unit tests. Validates Layer 1 (per-request nonce → fresh React tree).

### 4. FORM-04 forward-nav post-commit reset

**Test:** Navigate `/watch/new` → paste URL → verdict-ready → wishlist confirm commit → land on `/u/{username}/wishlist` → click "Add Watch" CTA.
**Expected:** Paste URL is empty + state idle. Validates Layer 3 (commit-time reset BEFORE `router.push`).
**Why human:** Requires running router.push and re-entering the route — needs live app.

### 5. FORM-04 verdict cache survival check

**Test:** Navigate `/watch/new` → evaluate catalog A → navigate elsewhere → re-enter `/watch/new` → paste catalog A URL again.
**Expected:** Verdict appears (cache repopulates fast via collectionRevision-keyed re-fetch per Phase 20 D-06; Option B accepted).
**Why human:** Tests cache-keyed re-fetch behavior across navigation; UAT confirms the reset is not user-observable.

---

## Gaps Summary

**No blocking gaps.** All 3 phase success criteria are delivered at the code + unit-test level:

- **SC-1 (NAV-16):** Profile DropdownMenuItem deleted, both surrounding separators preserved per UI-SPEC wording-precision override, dropdown order is email-label → Settings → Theme → Sign out, avatar Link unchanged. 12/12 UserMenu tests pass.
- **SC-2 (PROF-10):** Locked-literal className applied verbatim to ProfileTabs.tsx TabsList; tabs.tsx primitive UNCHANGED (Pitfall 7). 8/8 ProfileTabs tests pass. Touch/trackpad gesture passthrough deferred to manual UAT (JSDOM limitation).
- **SC-3 (FORM-04):** Three-layer defense shipped — Layer 1 (server nonce → key prop), Layer 2 (useLayoutEffect cleanup-on-hide), Layer 3 (commit-time reset before router.push). Verdict cache UNCHANGED. Within-flow Skip/Cancel paths preserved (D-17). AddWatchFlow + WatchForm + verdict cache tests all green.

**Status: passed** — 10/10 UAT items confirmed in browser 2026-05-05. The 5 manual UAT items deferred at first verification are now all marked passing in 29-UAT.md (see frontmatter `human_verification[].status: passed` for the verified-via crosswalk). Two phase-29-regression gaps surfaced during UAT (Tests 8 + 10) were closed across three ships: 29-05 (verdict cache), 29-06 (StrictMode cleanup), and Quick FORM-04 Gap 3 (URL extract cache).

**Tracking-doc lag:** REQUIREMENTS.md line 42 + line 91 still show FORM-04 as `[ ]` / `Pending` — needs check-mark update during phase-end housekeeping. Documentation lag only; implementation is complete and verified.

---

*Verified: 2026-05-04T00:43:46Z (initial — status: human_needed)*
*Re-verified: 2026-05-05T12:35:00Z (status: passed after UAT closure + 3 fix-chain ships)*
*Verifier: Claude (gsd-verifier — initial); manual verification via 29-UAT.md (re-verification)*
