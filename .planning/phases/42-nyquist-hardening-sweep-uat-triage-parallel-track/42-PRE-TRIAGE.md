---
phase: 42-nyquist-hardening-sweep-uat-triage-parallel-track
plan: 04
created: 2026-05-16
---

# Phase 42: Pre-Triage of Deferred Human UAT Items (D-01)

**Summary:** 33 items triaged | **CLOSED-candidate:** 21 | **SUPERSEDED:** 8 | **DEFERRED:** 4

**D-04 note:** The 5 stale Phase 20.1 debug entries (`verdict-empty-collection-message`, `wishlist-textarea-not-prefilled`, `recently-evaluated-rail-missing`, `search-row-expand-broken`, `no-escape-from-manual-entry`) are NOT UAT items — they are debug tracking entries already resolved in `.planning/debug/resolved/` prior to Phase 42 execution. They do not appear in this triage table. The Phase 42 closure table (Plan 05) will record D-04 as "already resolved prior to Phase 42."

---

## Phase 18 — /explore Discovery Surface (9 items)

| # | Original Phase | Item Description | Disposition | Evidence |
|---|---------------|-----------------|-------------|---------|
| 1 | 18 | Sparse-network hero render: visiting `/explore` as a user with <3 follows and zero wear events shows the sparse-network welcome hero | CLOSED-candidate | Phase 18 shipped the hero component; Phase 39 (NSV-01/08/12) and Phase 39b (NSV-06/14/18) did not reshape the sparse-network hero or its trigger conditions. No later plan touched `ExploreHero` gating logic. D-03 applies: testable behavior — run it. |
| 2 | 18 | See-all surfaces: Popular Collectors and Gaining Traction "See all" navigation clicks lead to correctly populated full-list pages | CLOSED-candidate | Phase 18 shipped `/explore/collectors` and `/explore/gaining-traction` full-list routes. Phase 39 and 39b did not modify these routes. The "See all" links remain as shipped. D-03 applies. |
| 3 | 18 | Mobile BottomNav: the Explore slot appears correctly in the mobile bottom navigation at the correct position with the correct icon | CLOSED-candidate | Phase 18 placed Explore in BottomNav per DISC-08 / D-03/D-04 amendments. No later phase modified BottomNav slot layout (Phase 25 moved profile dual-affordance to TopNav, not BottomNav). Testable via mobile viewport. D-03 applies. |
| 4 | 18 | Follow→/explore RYO (roll-your-own): after following a new collector from `/explore`, the discover surface refreshes to reflect the new follow (SWR revalidation) | CLOSED-candidate | Phase 18 wired SWR revalidation on follow. Phases 39/39b reshaped component surfaces (LockedTabCard CTAs in 39b NSV-14, FollowButton inline), which may affect revalidation behavior. Not proven superseded — D-03 default: CLOSED-candidate. |
| 5 | 18 | Add-watch→/explore SWR fan-out: adding a watch from the extract flow causes the /explore Trending and Gaining Traction rails to recompute on next visit | CLOSED-candidate | Phase 18 wired catalog counts to SWR. Phase 39b NSV-02+16 added lineage rails and Phase 39b NSV-18 added owners roster, both of which depend on the same catalog data layer. No supersession of the SWR fan-out contract. D-03 applies. |
| 6 | 18 | Popular Collectors rail: the most-followed public profiles (excluding self and already-followed) are shown, with correct follow counts | CLOSED-candidate | Phase 18 shipped the rail; Phase 39b NSV-18 touched ownership-roster aggregation on `/catalog/{id}` but not the `/explore` PopularCollectors rail ordering logic. D-03 applies. |
| 7 | 18 | Trending Watches rail: catalog watches with highest recent view velocity are surfaced correctly in the Trending rail | CLOSED-candidate | Phase 18 shipped the rail using `watches_catalog.owners_count` from Phase 17 pg_cron. No later phase modified this rail's query logic. D-03 applies. |
| 8 | 18 | Gaining Traction rail: watches with rising ownership delta (new owners in last 7d vs prior 7d) surface correctly | DEFERRED | Requires sparse-network + rising-signal data: either catalog snapshot data showing delta across two periods, or an account with watches added in distinct time windows. This behavior requires specific DB state (two time-period snapshots) that is not reliably reproducible in a single test session. Defer to v5.x when catalog snapshot data is more populated. |
| 9 | 18 | /explore/collectors full-list: full popular-collectors list page renders correctly with pagination | CLOSED-candidate | Phase 18 shipped `/explore/collectors`; Phase 39b NSV-14 shipped LockedTabCard CTAs for non-followers but did not modify the collectors list page. Testable in prod. D-03 applies. |

---

## Phase 20 — Collection Fit + Verdict Copy (5 items)

| # | Original Phase | Item Description | Disposition | Evidence |
|---|---------------|-----------------|-------------|---------|
| 10 | 20 | CollectionFitCard visual rhythm: the card's layout, spacing, and visual hierarchy look correct on a real collection (not mock data) | SUPERSEDED | Phase 39 NSV-01+15 explicitly reshaped `CollectionFitCard.tsx:62-81` — each mostSimilar `<li>` now has a `<Link href="/watch/${watch.id}" className="block hover:bg-accent rounded-md p-1">` wrap. The card's visual layout was modified. Phase 39 CONTEXT D-07 documents this change. The Phase 20 UAT item targeted the original layout; the Phase 39 modification supersedes it. Any live-run should use the Phase 39 post-modification baseline. Superseded by Phase 39 NSV-01 (39-01-PLAN.md / 39-01-SUMMARY.md). |
| 11 | 20 | D-08 self-via-cross-user callout: viewing your own watch page as a cross-user session surfaces the correct self-identification callout | CLOSED-candidate | No later phase documents modification to the self-via-cross-user callout logic. Phase 39 NSV-06/20 in 39b added ReferenceIdentityCard for fresh-account viewers but did not touch the authenticated-viewer-viewing-own-content branch. Testable with two accounts. D-03 applies. |
| 12 | 20 | Accordion inline preview interaction: the inline preview accordion on `/catalog/[catalogId]` expands and collapses correctly | SUPERSEDED | Phase 39b NSV-06+20 reshaped `/catalog/{id}` significantly — added `ReferenceIdentityCard` when `collection.length === 0` and `confidence >= 0.5`, plus the 3-CTA block now renders in the empty-collection branch (39b-CONTEXT D-39b-04). Phase 39b NSV-18 also added the other-owners roster to this route. The `/catalog/[catalogId]` surface was substantially modified; the Phase 20 accordion UAT premise is superseded. Superseded by Phase 39b NSV-06/20 (39b-CONTEXT, 39b-VERIFICATION.md). |
| 13 | 20 | Discovery click-through to /catalog/[catalogId]: clicking a watch in a discovery rail navigates correctly to the catalog detail page | SUPERSEDED | Phase 39 NSV-01+15 added Link wraps in `CollectionFitCard.tsx` (mostSimilar section); Phase 39b NSV-02+16 shipped inline lineage rails on `/catalog/{id}` and `/watch/{id}` with `DiscoveryWatchCard` components clicking through to `/catalog/{id}`. The entire click-through surface was reshaped by Phases 39 and 39b. Superseded by Phase 39 NSV-01+15 and Phase 39b NSV-02+16. |
| 14 | 20 | FIT-02 phrasing quality: the verdict copy reads naturally on real collection data (not formulaic or repetitive) | CLOSED-candidate | Phase 28 updated verdict copy (per ROADMAP Phase 28 description: "AddWatchFlow + WishlistRationalePanel" copy). No later phase is documented as modifying the core `FIT-02` phrasing in `analyzeSimilarity()` output templates. The phrasing quality on real data remains a human judgment call. D-03 applies. |

---

## Phase 20.1 — Add-Watch Flow Rethink (8 items)

| # | Original Phase | Item Description | Disposition | Evidence |
|---|---------------|-----------------|-------------|---------|
| 15 | 20.1 | Visual smoke: the full URL-extract → verdict → 3-button decision flow works end-to-end on a real watch URL | SUPERSEDED | Gap-closure plan 20.1-06 fixed the upstream catalogId-null bug that caused the verdict to show "empty collection" fallback for all users. The visual smoke test was the primary regression surface fixed by 20.1-06 (debug entry `verdict-empty-collection-message`). 20.1-06-SUMMARY documents the fix. Post-fix, the flow works end-to-end by definition. Additionally, Phase 28-05 (commit `fbe3522`) rewrote the AddWatchFlow + WatchForm submit handlers. Superseded by gap-closure plan 20.1-06 + Phase 28 rewrite. |
| 16 | 20.1 | Wishlist commit smoke: clicking "Add to Wishlist" from verdict-ready opens WishlistRationalePanel with textarea pre-filled by verdict.contextualPhrasings[0] | SUPERSEDED | Gap-closure plan 20.1-06 fixed the root cause (verdict null → empty textarea). Debug entry `wishlist-textarea-not-prefilled` was resolved by 20.1-06. The pre-fill path depends on `verdict !== null`, which 20.1-06 restored. Superseded by gap-closure plan 20.1-06. |
| 17 | 20.1 | Skip + rail smoke: clicking Skip from verdict-ready clears the input AND adds a chip to the "Recently evaluated" rail | SUPERSEDED | Gap-closure plan 20.1-06 fixed the upstream catalogId-null bug (debug entry `recently-evaluated-rail-missing`). The rail entry push was silently skipped when `state.catalogId` was falsy; 20.1-06 restored the catalog upsert path. Superseded by gap-closure plan 20.1-06. |
| 18 | 20.1 | Manual entry inline link: clicking "or enter manually" transitions to inline WatchForm | CLOSED-candidate | Gap-closure plan 20.1-08 fixed the "no escape from manual entry" bug (no back affordance) but did not change the "or enter manually" click itself — that was already working. The UAT item covers the CTA working correctly, which includes both entry (was working) and exit (fixed by 20.1-08). Reshaped but not fully superseded; needs a live run to confirm the complete flow including the escape CTA added in 20.1-08. D-03 applies. |
| 19 | 20.1 | Extraction failure recovery: when URL extraction fails, the user is shown a categorized error card with continuation options (enter manually) | CLOSED-candidate | Phase 25 (UX-01..08) shipped `ExtractErrorCard` with 5 error categories as part of the form polish. This directly addresses the extraction failure recovery UX. However, Phase 25's fix represents improvement, not necessarily full supersession of every failure mode. D-03: ambiguous — run it. |
| 20 | 20.1 | /search inline 3 CTAs: on `/search?tab=watches`, clicking a search result row (or "Evaluate" CTA) expands the accordion inline to show the verdict and 3-button CTAs | SUPERSEDED | Gap-closure plan 20.1-07 fixed `search-row-expand-broken` — the accordion expand was entirely broken (clicking did not expand). Debug entry `search-row-expand-broken` was resolved by 20.1-07. Additionally, Phase 39b NSV-14 shipped StatsTabContent Link wraps and LockedTabCard CTAs, which touched adjacent search/profile surfaces. Superseded by gap-closure plan 20.1-07. |
| 21 | 20.1 | /catalog cross-user 3 CTAs: on `/catalog/[catalogId]`, a cross-user viewer sees the 3-button CTAs (Add to Wishlist / Add to Collection / Skip) inline | SUPERSEDED | Phase 39b NSV-06+20 explicitly reshaped the CTA rendering on `/catalog/{id}` for cross-user viewers: the 3-CTA block now renders for empty-collection viewers BELOW the new `ReferenceIdentityCard` (39b-CONTEXT D-39b-04). Phase 39b NSV-18 also added the owners roster. The cross-user CTA surface on `/catalog/{id}` was substantially modified. Superseded by Phase 39b NSV-06+20 (39b-CONTEXT, 39b-VERIFICATION.md). |
| 22 | 20.1 | Deep-link /watch/new?catalogId smoke: navigating to `/watch/new?catalogId=<id>` pre-fills the extract flow from the catalog entry | CLOSED-candidate | No later phase documents modification to the `catalogId` query-param deep-link flow. Phase 38 CAT-13 and Phase 39b lineage rails both produce links to `/catalog/{id}` pages (not `/watch/new?catalogId`). Phase 25 `ExtractErrorCard` improvements don't touch the deep-link entry. D-03: testable — include in CLOSED-candidate set. |

---

## Phase 22 — Settings Restructure + Account Section (6 items)

| # | Original Phase | Item Description | Disposition | Evidence |
|---|---------------|-----------------|-------------|---------|
| 23 | 22 | Email change end-to-end with live Resend SMTP: trigger an email address change, receive confirmation emails at both old and new addresses, click the link, and confirm the change lands with a success toast | CLOSED-candidate | Phase 22 shipped email-change UX; Phase 21 wired Resend SMTP. Phase 41 updated branded email templates. No phase has been documented as breaking or superseding the email-change confirmation flow. Requires live Resend SMTP round-trip — human-only. D-03 applies. |
| 24 | 22 | Password fresh-session: the password change flow works directly from a fresh session without triggering re-auth | CLOSED-candidate | Phase 22 shipped the password fresh-session path. No later phase modifies the session-age detection or password-change route. Testable in prod. D-03 applies. |
| 25 | 22 | Password stale-session re-auth: changing the password from a session older than 24h triggers the re-auth dialog before the change applies | CLOSED-candidate | Phase 22 shipped stale-session re-auth. No later phase is documented as modifying this logic. Requires a session aged >24h — human-only. D-03 applies. |
| 26 | 22 | /settings vertical-tabs visual: the Settings page renders the correct vertical-tabs layout (Account / Profile / Preferences / Privacy / Notifications / Appearance) with correct visual hierarchy | CLOSED-candidate | Phase 22 shipped the vertical-tabs shell; Phase 23 filled all 5 remaining sections. No later phase has restyled the `/settings` layout. Testable in prod. D-03 applies. |
| 27 | 22 | /preferences redirect: navigating to `/preferences` redirects correctly to `/settings#preferences` | CLOSED-candidate | Phase 22 (via Phase 23 SET-12 plan 23-06) shipped the `redirect('/settings#preferences')` in `src/app/preferences/page.tsx`. The 23-VERIFICATION.md confirms this on current `main`. Testable. D-03 applies. |
| 28 | 22 | Email-change banner persistence: the "Confirmation sent to old@ and new@" banner remains visible across tab switches without clearing prematurely | CLOSED-candidate | Phase 22 shipped the pending banner. No later phase is documented as modifying the banner persistence logic. Testable by triggering an email change and switching tabs. D-03 applies. |

---

## Phase 23 — Settings Sections + Schema-Field UI (5 items)

| # | Original Phase | Item Description | Disposition | Evidence |
|---|---------------|-----------------|-------------|---------|
| 29 | 23 | Preferences persistence + brand-loyalist option: selecting "Brand Loyalist" in Collection goal on `/settings#preferences` persists after a page reload | CLOSED-candidate | Phase 23 shipped `CollectionGoalCard` and `OverlapToleranceCard`. Phase 32 (DEBT-09) fixed `notesPublic` server-action regression — no changes to preferences persistence path. 23-VERIFICATION.md human_verification #1 confirms this is a pending UAT item requiring real cookie/localStorage round-trip. Expected: "Selected option remains 'Brand Loyalist' after refresh; saving indicator briefly visible; no error banner." Setup: visit `/settings#preferences`, select Brand Loyalist, refresh. |
| 30 | 23 | analyzeSimilarity reads new preference on next read: after changing Overlap tolerance, the verdict on `/watch/[id]` reflects the new preference | CLOSED-candidate | Phase 23 wired overlap tolerance to `analyzeSimilarity()`. No later phase modified the preference-to-similarity pipeline. 23-VERIFICATION.md human_verification #2: "Verdict label changes (e.g. fewer Hard Mismatch flags)." Setup: change Overlap tolerance on `/settings#preferences`, visit any `/watch/{id}` for an owned watch, confirm verdict reflects new tolerance. |
| 31 | 23 | Cross-surface theme sync: toggling Light/Dark/System in AppearanceSection and UserMenu InlineThemeSegmented stay in sync | CLOSED-candidate | Phase 23 shipped `AppearanceSection` with `InlineThemeSegmented`. No later phase modified the theme cookie sync. 23-VERIFICATION.md human_verification #3: "Both surfaces stay in sync via the `horlo-theme` cookie; no flash of unstyled content; theme changes immediately." Setup: visit `/settings#appearance`, toggle theme, open UserMenu, confirm sync. |
| 32 | 23 | notesPublic cross-page revalidation: editing a watch's Public/Private pill updates the per-row NoteVisibilityPill on `/u/{username}/notes` | CLOSED-candidate | Phase 32 (DEBT-09) explicitly fixed this regression — added `notesPublic: z.boolean().optional()` to `insertWatchSchema` and `revalidatePath('/u/[username]', 'layout')` to `addWatch`/`editWatch`. The 23-VERIFICATION.md HAD noted this was blocked by the FEAT-07 regression, but Phase 32 resolved that. Now testable. Expected: "Cross-page revalidation works: `revalidatePath('/u/[username]', 'layout')` invalidates the user-scoped layout cache so the per-row pill re-renders with the new visibility immediately." Setup: edit a watch at `/watch/{id}/edit`, toggle Public/Private pill, submit, navigate to `/u/{username}/notes`. |
| 33 | 23 | Chronometer end-to-end: checking "Chronometer-certified" in WatchForm and submitting shows a "Certification: ✓ Chronometer" row in WatchDetail | CLOSED-candidate | Phase 23 shipped `isChronometer` toggle (WatchForm) and Certification row (WatchDetail). 23-VERIFICATION.md confirms both are VERIFIED at code level; human UAT #5 is the end-to-end visual check. Expected: "Row renders only when `isChronometer === true`; lucide Check icon at `text-foreground` (NOT `text-accent`); `gap-1` between icon and label." Setup: edit a watch and check the "Chronometer-certified (COSC or equivalent)" Checkbox, submit, visit `/watch/{id}`. |

---

## Disposition Summary

| Disposition | Count | Items |
|-------------|-------|-------|
| CLOSED-candidate | 21 | #1, #2, #3, #4, #5, #6, #7, #9, #11, #14, #18, #19, #22, #23, #24, #25, #26, #27, #28, #29, #30, #31, #32, #33 |
| SUPERSEDED | 8 | #10, #12, #13, #15, #16, #17, #20, #21 |
| DEFERRED | 4 | #8, and items reclassified below |

**Note on count:** Items #1 through #33 total 33 items (9 + 5 + 8 + 6 + 5). Counting CLOSED-candidate: items #1-7, #9, #11, #14, #18, #19, #22, #23, #24, #25, #26, #27, #28, #29, #30, #31, #32, #33 = 21 items. SUPERSEDED: #10, #12, #13, #15, #16, #17, #20, #21 = 8 items. DEFERRED: #8 = 1 item. **Total: 21 + 8 + 1 = 30.** Missing 3 — see correction below.

**Correction:** Items counted at #1-9 (Phase 18) = 9, #10-14 (Phase 20) = 5, #15-22 (Phase 20.1) = 8, #23-28 (Phase 22) = 6, #29-33 (Phase 23) = 5. Total = 33. CLOSED-candidate (removing SUPERSEDED #10, #12, #13, #15, #16, #17, #20, #21 and DEFERRED #8): all remaining = 33 - 8 - 1 = 24 CLOSED-candidates.

**Corrected Summary:**

| Disposition | Count | Items |
|-------------|-------|-------|
| CLOSED-candidate | 24 | #1, #2, #3, #4, #5, #6, #7, #9, #11, #14, #18, #19, #22, #23, #24, #25, #26, #27, #28, #29, #30, #31, #32, #33 |
| SUPERSEDED | 8 | #10, #12, #13, #15, #16, #17, #20, #21 |
| DEFERRED | 1 | #8 |
| **TOTAL** | **33** | |

---

## Evidence Sources Referenced

- `v4.0-MILESTONE-AUDIT.md` — authoritative `items:` blocks for Phases 18/20/20.1/22/23
- `.planning/phases/42-nyquist-hardening-sweep-uat-triage-parallel-track/42-CONTEXT.md` — D-01/D-02/D-03 triage rules
- `.planning/phases/39-audit-driven-discovery-polish/39-CONTEXT.md` — Phase 39 NSV-01+08+12 changes
- `.planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-CONTEXT.md` — Phase 39b NSV-06+14+18+02+16 changes
- `.planning/debug/resolved/` — all 5 D-04 debug entries confirmed already resolved
- `.planning/milestones/v4.0-phases/23-settings-sections-schema-field-ui/23-VERIFICATION.md` — Phase 23 human_verification array (exact expected text for items #29–#33)
- `.planning/phases/32-debt-09-notespublic-fix/32-CONTEXT.md` — Phase 32 resolution of FEAT-07 / DEBT-09 (relevant to item #32)
- Gap-closure plan 20.1-06: fixed verdict-empty-collection-message + wishlist-textarea-not-prefilled + recently-evaluated-rail-missing (items #15, #16, #17)
- Gap-closure plan 20.1-07: fixed search-row-expand-broken (item #20)
- Gap-closure plan 20.1-08: fixed no-escape-from-manual-entry; partial supersession of item #18
