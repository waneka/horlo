---
phase: 28-add-watch-flow-verdict-copy-polish
verified: 2026-05-05T02:36:52Z
status: passed
score: 4/4 must-haves verified (+ 22/22 D-decisions verified)
overrides_applied: 0
---

# Phase 28: Add-Watch Flow & Verdict Copy Polish — Verification Report

**Phase Goal:** Adding a watch lands the user back where they started, gives them a clear next-step link, and the verdict copy reads coherently both as a verdict and as the wishlist-note auto-fill.

**Verified:** 2026-05-05T02:36:52Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | After adding a watch from any entry point (Add-Watch Flow, /search row 3-CTA, /catalog/[id] 3-CTA), the user sees a success toast that includes a link to the corresponding profile collection or wishlist tab. | VERIFIED | 4 commit sites all wire toast+CTA: AddWatchFlow.tsx:312 (`toast.success('Saved to your wishlist', { action: { label: 'View', onClick: () => router.push(actionHref) } })`); WatchForm.tsx:732-735 (buildSuccessOpts returns `successAction: { label: 'View', href: actionHref }` consumed by useFormFeedback at useFormFeedback.ts:181-187); WatchSearchRowsAccordion.tsx:101-110 (toast with action when viewerUsername set, bare toast when null); CatalogPageActions.tsx:102-111 (same two-branch pattern). Suppress carve-out (D-05/D-06) implemented at AddWatchFlow.tsx:307-309 and WatchForm.tsx:726-731 via canonicalize comparison. |
| 2 | After completing or canceling the Add-Watch Flow, the user is returned to the entry point they came from via a `?returnTo=` parameter validated against an allow-list of internal paths. | VERIFIED | Server-side validation at watch/new/page.tsx:81 via `validateReturnTo(sp.returnTo)` which calls watchFlow/destinations.ts:22-27 (regex `/^\/(?!\/)[^\\\r\n\t]*$/` byte-identical to auth-callback regex per destinations.test.ts:18 + self-loop guard `startsWith('/watch/new')`). 8 entry-point callsites append `?returnTo=`: DesktopTopNav.tsx:99, CollectionTabContent.tsx:39-41,136,178, WishlistTabContent.tsx:51-53,108,247, AddWatchCard.tsx:31-33, WatchPickerDialog.tsx:81-87, WatchSearchRowsAccordion.tsx:124-126, CatalogPageActions.tsx:127-129. Default destination falls back to `/u/{username}/{matching-tab}` per destinations.ts:41-48. WatchForm.tsx:232-233 replaces hardcoded `router.push('/')` with `dest = returnTo ?? defaultDestinationForStatus(...)`. AddWatchFlow.tsx:303 uses same pattern for Wishlist commit. |
| 3 | The "unusual for your collection" verdict reads coherently to the user on /watch/[id], the /search accordion, and /catalog/[id]. | VERIFIED | All 6 DESCRIPTION_FOR_LABEL strings rewritten verb-led at templates.ts:142-149: 'Lines up cleanly with what you already like.' (core-fit), "Sits in territory you've already explored." (familiar-territory), "Plays a role you've already filled in your collection." (role-duplicate), "Stretches your taste in a direction it's already leaning." (taste-expansion), "Stands apart from your collection but doesn't conflict." (outlier — replaces dismissive "unusual"), 'Conflicts with styles you said you avoid.' (hard-mismatch). Each string is verb-led, ≥6 words, period-terminated. Same composer (`computeVerdictBundle` — single emit point per composer.ts:43) feeds VerdictStep, /search row, and /catalog/[id], so all 3 surfaces read the same rewritten copy. |
| 4 | The wishlist note auto-fill, when populated from a verdict, reads as the user's own first-person rationale, and the source is intentional rather than incidentally `contextualPhrasings[0]`. | VERIFIED | WishlistRationalePanel.tsx:47 reads `verdict.rationalePhrasings[0] ?? ''` (NOT `contextualPhrasings[0]`). `framing === 'self-via-cross-user'` early-return-empty branch preserved at line 46. Hint copy updated to D-20 voice direction at line 87: "Pre-filled with why this watch fits — written as if you wrote it. Edit to make it yours, or clear it." rationalePhrasings is filled in lockstep with contextualPhrasings by composer.ts:65-78 (predicate parity, hedge-prefix parity at lines 72-75, fallback parity at lines 61-63 using RATIONALE_FOR_LABEL). VerdictBundleFull.rationalePhrasings is required (not optional) at types.ts:32 — type-system enforces fill. |

**Score:** 4/4 truths verified

### D-Decision Coverage (22 locked decisions from CONTEXT.md)

| # | Decision | Status | Evidence |
|---|----------|--------|----------|
| D-01 | Toast CTA copy = literal "View" | VERIFIED | `label: 'View'` at AddWatchFlow.tsx:314, WatchForm.tsx:734, WatchSearchRowsAccordion.tsx:104, CatalogPageActions.tsx:105 |
| D-02 | CTA destination = /u/{username}/wishlist or /collection by status | VERIFIED | destinations.ts:41-48 maps wishlist/grail→wishlist, owned/sold→collection; consumed by 4 commit sites |
| D-03 | Sonner action slot (built-in), NOT custom JSX | VERIFIED | useFormFeedback.ts:181-187 wires `action: { label, onClick }`; AddWatchFlow.tsx:312-318 uses Sonner action API directly |
| D-04 | useFormFeedback successAction additive opt | VERIFIED | useFormFeedback.ts:74 `successAction?: { label: string; href: string }` on opts type; line 86 `useRouter` imported; line 184 `onClick: () => router.push(successAction.href)` |
| D-05 | Suppress-toast rule when destination matches | VERIFIED | useFormFeedback.ts:171 `suppressToast = !callerProvidedMessage && !callerProvidedAction` short-circuit; AddWatchFlow.tsx:307-310 + WatchForm.tsx:726-731 (`buildSuccessOpts` returns `{}` when canonicalized paths match) |
| D-06 | canonicalize / `/u/me/` shorthand resolution | VERIFIED | destinations.ts:69-89 implements rewrite-`/u/me/`→`/u/{viewerUsername}/`, strip query, strip trailing slash, null-username early-return-unchanged |
| D-07 | FormStatusBanner stays terse — NO CTA variant | VERIFIED | grep on FormStatusBanner.tsx returns 0 matches for `successAction\|action.*label.*View\|cta` — banner unchanged from Phase 25 |
| D-08 | ?returnTo= captured at every entry-point callsite | VERIFIED | 8 callsites verified above (success criterion 2 evidence) |
| D-09 | BottomNav phantom — verified untouched | VERIFIED | `grep -c "watch/new" BottomNav.tsx === 0` — Add slot was removed in Phase 18 |
| D-10 | NotesTabContent skip — Server Component fallback | VERIFIED | `grep -c "returnTo" NotesTabContent.tsx === 0`; the Link still points to bare `/watch/new` (line 57) — D-13 default destination kicks in |
| D-11 | Server-side validation at /watch/new | VERIFIED | watch/new/page.tsx:81 calls `validateReturnTo(sp.returnTo)` from destinations.ts:22-27; two-stage check (regex + self-loop guard) |
| D-12 | AddWatchFlow holds returnTo as one-way commit param | VERIFIED | AddWatchFlow.tsx:71 typed prop `initialReturnTo: string \| null`; consumed only by handleWishlistConfirm (line 303) and WatchForm pass-through (lines 467, 499) — never written back to URL |
| D-13 | Default destination /u/{username}/{matching-tab} | VERIFIED | destinations.ts:41-48 defaultDestinationForStatus; called at AddWatchFlow.tsx:303 and WatchForm.tsx:232 |
| D-14 | Exit paths route to returnTo (Wishlist commit + Collection commit + manual-entry) | VERIFIED | AddWatchFlow.tsx:323 `router.push(dest)`; WatchForm.tsx:233 `router.push(dest)`; manualAction at AddWatchFlow.tsx:375-378 preserves `&returnTo=ENC(initialReturnTo)`. Skip + Cancel paths unchanged. |
| D-15 | router.refresh removed from Wishlist commit | VERIFIED | `grep -nE "^[[:space:]]*router\\.refresh" AddWatchFlow.tsx` returns 0; line 319 has comment "Phase 28 D-15 — REMOVED router.refresh()". Inline-commit sites (search/catalog) DELIBERATELY retain refresh per D-05 row 5/6 carve-out. |
| D-16 | All 6 DESCRIPTION_FOR_LABEL rewritten verb-led, ≥6 words, period-terminated | VERIFIED | templates.ts:142-149 — all 6 strings shipped, verb-led, ≥6 words, period-terminated |
| D-17 | rationaleTemplate slot on all 12 TEMPLATES | VERIFIED | templates.ts:14-131 — every TEMPLATES entry has a `rationaleTemplate: string` field with 1st-person voice; type required at types.ts:88 |
| D-18 | RATIONALE_FOR_LABEL fallback table (6 strings) | VERIFIED | templates.ts:151-158 — RATIONALE_FOR_LABEL constant with all 6 SimilarityLabel keys; consumed by composer.ts:63 in fallback branch |
| D-19 | rationalePhrasings required field on VerdictBundleFull | VERIFIED | types.ts:32 declares `rationalePhrasings: string[]` (NOT optional); composer.ts:60-83 fills in lockstep with contextualPhrasings; predicate/hedge/fallback parity verified |
| D-20 | WishlistRationalePanel source switch | VERIFIED | WishlistRationalePanel.tsx:47 reads `verdict.rationalePhrasings[0] ?? ''` (NOT contextualPhrasings[0]); framing==='self-via-cross-user' branch preserved at line 46; hint copy updated at line 87 |
| D-21 | Planner drafts copy + supersession marker | VERIFIED | All 25 literal copy strings shipped (24 verdict + 1 hint per Plan 01 SUMMARY); WatchForm.tsx supersession block at lines 156-166 + 3 "Phase 28 D-21" markers replace Phase 25 LOCKED comment (count of "LOCKED per UI-SPEC §Default copy contract" === 0) |
| D-22 | FIT-02 lock preserved + literal-string lock at composer.test.ts:226 removed | VERIFIED | 4 roadmap-mandated `template` strings byte-identical at templates.ts:24,35,46,57; `Highly aligned with your taste` literal absent from composer.test.ts; by-reference assertion `DESCRIPTION_FOR_LABEL['core-fit']` at composer.test.ts:225 preserved; all 13 composer tests pass |

**D-decision score:** 22/22 verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/verdict/templates.ts` | DESCRIPTION_FOR_LABEL rewrite + 12 rationaleTemplate + RATIONALE_FOR_LABEL | VERIFIED | All 3 structures present; 159 LOC; verb-led description copy; 1st-person rationale templates; mirror RATIONALE_FOR_LABEL |
| `src/lib/verdict/composer.ts` | Lockstep rationalePhrasings fill | VERIFIED | Lines 60-83 fill rationalePhrasings via TEMPLATES iteration in lockstep with contextualPhrasings; same hedge-prefix logic; same fallback path using RATIONALE_FOR_LABEL |
| `src/lib/verdict/types.ts` | VerdictBundleFull.rationalePhrasings + Template.rationaleTemplate | VERIFIED | Line 32 `rationalePhrasings: string[]` required; line 88 `rationaleTemplate: string` required on Template interface |
| `src/lib/hooks/useFormFeedback.ts` | successAction extension + suppress short-circuit | VERIFIED | Line 74 `successAction?: { label, href }` on opts; line 86 `useRouter` imported; line 171 suppress logic; line 184 `router.push(href)` wiring |
| `src/lib/watchFlow/destinations.ts` | RETURN_TO_REGEX + validateReturnTo + defaultDestinationForStatus + canonicalize | VERIFIED | All 4 exports present; regex byte-identical to auth-callback regex (verified via test #18); two-stage validator; status→tab mapping; canonicalize handles /u/me/ rewrite, query strip, trailing slash, null-username early return |
| `src/lib/watchFlow/destinations.test.ts` | 15 unit tests including source-equality parity | VERIFIED | 15 tests pass; `RETURN_TO_REGEX.source === '^\\/(?!\\/)[^\\\\\\r\\n\\t]*$'` source-equality at line 18 |
| `src/app/watch/new/page.tsx` | returnTo whitelist + viewerUsername resolution | VERIFIED | Line 81 `validateReturnTo(sp.returnTo)`; lines 90-95 viewerUsername via `getProfileById` folded into Promise.all; line 109-110 typed props passed to AddWatchFlow |
| `src/components/watch/AddWatchFlow.tsx` | handleWishlistConfirm rewrite + nav-on-commit + suppress + router.refresh removal | VERIFIED | Lines 286-336: D-13 default + D-14 returnTo + D-05/D-06 suppress + D-01/D-03 Sonner action toast + D-15 router.refresh REMOVED; manualAction (lines 372-379) preserves initialReturnTo |
| `src/components/watch/WatchForm.tsx` | Phase 25 LOCKED supersession + dest resolution + buildSuccessOpts | VERIFIED | Lines 156-176 supersession block with 3 "Phase 28 D-21" markers; line 232 `dest = returnTo ?? defaultDestinationForStatus(...)`; lines 713-736 `buildSuccessOpts` helper; "LOCKED per UI-SPEC" comment removed (count === 0); edit-mode literal 'Watch updated' preserved at line 173 |
| `src/components/watch/WishlistRationalePanel.tsx` | defaultRationale source switch | VERIFIED | Line 47 reads `verdict.rationalePhrasings[0] ?? ''`; line 87 updated hint copy; line 46 self-via-cross-user early-return preserved |
| `src/components/layout/BottomNav.tsx` | UNTOUCHED (D-09 phantom) | VERIFIED | `grep -c "watch/new" === 0` and `grep -c "returnTo" === 0` — file is clean; no Add slot exists since Phase 18 |
| `src/components/layout/DesktopTopNav.tsx` | ?returnTo= append | VERIFIED | Line 99 `href={`/watch/new?returnTo=${encodeURIComponent(pathname || '/')}`}` |
| `src/components/profile/CollectionTabContent.tsx` | ?returnTo= append (Pattern B) | VERIFIED | Lines 39-41 capture + manualHref; lines 136, 178 AddWatchCard returnTo prop pass-through |
| `src/components/profile/WishlistTabContent.tsx` | ?returnTo= append (Pattern B) | VERIFIED | Lines 51-53 capture + wishlistHref; line 108 OwnerWishlistGrid returnTo threading; line 247 AddWatchCard prop |
| `src/components/profile/AddWatchCard.tsx` | returnTo prop (Pattern D) | VERIFIED | Lines 26-33 optional returnTo prop; existing labels 'Add to Wishlist' / 'Add to Collection' PRESERVED VERBATIM at line 30 |
| `src/components/home/WatchPickerDialog.tsx` | ?returnTo= append (Pattern B) | VERIFIED | Lines 81-87 pathname + addWatchHref captured ABOVE conditional return (rules-of-hooks compliant) |
| `src/components/search/WatchSearchRowsAccordion.tsx` | inline-commit toast + ?returnTo= on Collection nav (Pattern A) | VERIFIED | Lines 101-110 two-branch toast (action-slot when viewerUsername set, bare otherwise); lines 124-126 Pattern A returnTo capture from window.location |
| `src/components/watch/CatalogPageActions.tsx` | inline-commit toast + ?returnTo= on Collection nav (Pattern A) | VERIFIED | Lines 102-111 two-branch toast; lines 127-129 Pattern A returnTo capture |

**Artifact score:** 18/18 verified

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| /watch/new entry callsites | /watch/new server validator | ?returnTo= URL param | WIRED | 8 callsites append; server validates via destinations.ts:22-27; validated value flows into AddWatchFlow as initialReturnTo prop |
| AddWatchFlow.handleWishlistConfirm | profile collection/wishlist tab | router.push(dest) | WIRED | dest computed at line 303; router.push(dest) at line 323; replaces removed router.refresh() |
| WatchForm Collection commit | profile collection tab | router.push(dest) | WIRED | dest computed at line 232; router.push(dest) at line 233; replaces hardcoded router.push('/') |
| /search inline Wishlist commit | toast → /u/{username}/wishlist | router.push(actionHref) onClick | WIRED | WatchSearchRowsAccordion.tsx:105; viewerUsername-gated branch |
| /catalog/[id] inline Wishlist commit | toast → /u/{username}/wishlist | router.push(actionHref) onClick | WIRED | CatalogPageActions.tsx:106; viewerUsername-gated branch |
| Composer | rationalePhrasings | TEMPLATES iteration + lockstep fill | WIRED | composer.ts:65-78 fills rationalePhrasings array in same loop as contextualPhrasings; predicate parity, hedge parity, fallback parity all verified |
| WishlistRationalePanel | verdict pre-fill text | verdict.rationalePhrasings[0] | WIRED | Line 47 reads rationalePhrasings[0] (NOT contextualPhrasings[0]); type-required field guarantees presence |
| useFormFeedback successAction | router navigation | toast.success(msg, { action: { label, onClick } }) | WIRED | Line 184 `onClick: () => router.push(successAction.href)`; consumed by WatchForm.buildSuccessOpts |

**Key links score:** 8/8 wired

### Behavioral Spot-Checks

| Behavior | Test Suite | Result | Status |
|----------|------------|--------|--------|
| Verdict composer fills rationalePhrasings in lockstep | composer.test.ts | 13/13 pass | PASS |
| watchFlow destinations validate returnTo, canonicalize paths | destinations.test.ts | 15/15 pass | PASS |
| useFormFeedback successAction + suppress short-circuit | useFormFeedback.test.tsx | 18/18 pass | PASS |
| AddWatchFlow Wishlist commit + manual-entry returnTo flow | AddWatchFlow.test.tsx | 12/12 pass | PASS |
| WishlistRationalePanel reads rationalePhrasings | WishlistRationalePanel.test.tsx | 5/5 pass | PASS |
| DesktopTopNav add-watch href contract (Phase 28 ?returnTo=) | DesktopTopNav.test.tsx | 13/13 pass | PASS |
| WatchSearchRowsAccordion (inline Wishlist + Collection nav) | WatchSearchRowsAccordion.test.tsx | 6/6 pass | PASS |
| /search add-watch CTA integration | add-watch-flow-search-cta.test.tsx | 3/3 pass | PASS |

**Aggregate phase-relevant tests: 85/85 pass.**

### Anti-Patterns Found

None found. The phase deliberately preserved Phase 25 anti-pattern #16 (FormStatusBanner has no CTA variant — D-07).

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|-------------|--------|----------|
| FIT-06 | 28-01 | Verdict copy rewrite + speech-act split | SATISFIED | All 6 DESCRIPTION_FOR_LABEL rewritten; 12 rationaleTemplates added; RATIONALE_FOR_LABEL fallback added; rationalePhrasings filled lockstep; WishlistRationalePanel source switched |
| ADD-08 | 28-03, 28-05 | Return-to-entry-point on Add-Watch commit via ?returnTo= allow-list | SATISFIED | Server-side validator (auth-callback regex parity + self-loop guard); 8 callsites append; AddWatchFlow + WatchForm consume validated initialReturnTo for nav-on-commit |
| UX-09 | 28-02, 28-04, 28-05 | Success toast with profile-tab CTA-link variant | SATISFIED | useFormFeedback successAction additive opt + Sonner action-slot wiring; 4 commit sites all wire toast+CTA; D-05 suppress carve-out fires when destination matches action target |

### Critical Invariants

| Invariant | Status | Evidence |
|-----------|--------|----------|
| D-15: AddWatchFlow.handleWishlistConfirm no longer calls router.refresh() | VERIFIED | `grep -nE "^[[:space:]]*router\\.refresh" AddWatchFlow.tsx` returns 0; only call sites remain in /search and /catalog inline commits where D-05 row 5/6 explicitly carves it out |
| D-07: FormStatusBanner CTA variant NOT introduced | VERIFIED | `grep` on FormStatusBanner.tsx finds no successAction/action label/cta references; Phase 25 anti-pattern #16 stays |
| D-09: BottomNav untouched | VERIFIED | `grep -c "watch/new" BottomNav.tsx === 0` |
| Phase 25 LOCKED block in WatchForm explicitly superseded with Phase 28 D-21 comment | VERIFIED | `grep -c "LOCKED per UI-SPEC §Default copy contract" === 0`; `grep -c "Phase 28 D-21" === 3`; supersession block at WatchForm.tsx:156-166 |
| AddWatchCard label strings preserved verbatim | VERIFIED | AddWatchCard.tsx:30 `const label = variant === 'wishlist' ? 'Add to Wishlist' : 'Add to Collection'` — pre-Phase 28 wording preserved |
| 24+ literal copy strings shipped (Plan 01 SUMMARY) | VERIFIED | 6 DESCRIPTION_FOR_LABEL + 12 rationaleTemplate + 6 RATIONALE_FOR_LABEL + 1 hint = 25 literal strings, all verifiable in templates.ts and WishlistRationalePanel.tsx |
| Open-redirect security: returnTo regex byte-identical to auth-callback regex | VERIFIED | destinations.test.ts:18 `RETURN_TO_REGEX.source === '^\\/(?!\\/)[^\\\\\\r\\n\\t]*$'` source-equality assertion; auth/callback/route.ts:61 has same regex inline |
| Self-loop guard rejects /watch/new prefix | VERIFIED | destinations.ts:25 `if (value.startsWith('/watch/new')) return null`; tested at destinations.test.ts (case 5) |
| Phase 28 commits all merged to main | VERIFIED | 5 plan-merge commits + 15 task commits found via `git log --oneline --all`: ac73e9d, 8a8234f, 67e3ea4, 9886cd0, 3c33a60 (Plan 01); 32d8453, 2c99999 (Plan 02); a038d8e, d698810, e147c02 (Plan 03); d45fac5, 10f3aed (Plan 04); fbe3522, 47f7000, 3e3e5a8 (Plan 05); merges cdcb948, 449fe92, 574db36, 168b35d, adddbd8 |

### Gaps Summary

No gaps found. All 4 Roadmap success criteria, all 22 D-decisions from CONTEXT.md, all 18 expected artifacts, all 8 critical key links, and all 9 critical invariants verified against the actual codebase.

The phase delivered exactly what it promised:
- **Goal #1 (toast+CTA from any entry point):** All 4 commit sites — AddWatchFlow Wishlist commit, WatchForm Collection/manual commit, /search inline Wishlist, /catalog/[id] inline Wishlist — wire the Sonner action-slot toast with a literal "View" label pointing at `/u/{viewerUsername}/{matching-tab}`. The D-05 suppress carve-out correctly fires at nav-on-commit sites (AddWatchFlow + WatchForm) when the post-commit destination canonicalizes to the action target.
- **Goal #2 (returnTo round-trip):** 8 active entry-point callsites append `?returnTo=ENC(pathname[+search])`; server-side validator at /watch/new chokepoint reuses the auth-callback regex byte-identically (proven by source-equality test) plus a self-loop guard; AddWatchFlow + WatchForm consume the validated `initialReturnTo` to compute commit destination, falling back to `/u/{username}/{matching-tab}` when null.
- **Goal #3 (verdict reads coherently):** All 6 DESCRIPTION_FOR_LABEL strings rewritten verb-led (≥6 words, period-terminated); single composer emit point guarantees consistency across /watch/[id], /search accordion, and /catalog/[id]. The "outlier" label specifically addressed: "Stands apart from your collection but doesn't conflict." replaces the dismissive "unusual" wording.
- **Goal #4 (1st-person wishlist auto-fill):** WishlistRationalePanel.defaultRationale reads `verdict.rationalePhrasings[0]` — a NEW required type field filled lockstep by composer with rationale-voice 1st-person templates. The source is now structurally intentional, not incidental.

The 4 Phase 25 anti-patterns and locked invariants (FormStatusBanner stays terse, BottomNav untouched per phantom D-09, NotesTabContent skipped per D-10, AddWatchCard labels preserved verbatim) were all preserved.

The full vitest suite shows 50 failed / 4187 passed — slightly better than the 51/4186 baseline documented at Plan 28-05 close. All failures are pre-existing in unrelated test files (preferences DEBT-01, palette tests, WYWT post dialog, watch-new-page DB-required, etc.); zero new failures introduced.

---

_Verified: 2026-05-05T02:36:52Z_
_Verifier: Claude (gsd-verifier)_
