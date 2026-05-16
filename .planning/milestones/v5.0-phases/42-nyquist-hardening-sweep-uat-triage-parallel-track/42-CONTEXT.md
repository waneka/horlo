# Phase 42: Nyquist Hardening Sweep + UAT Triage - Context

**Gathered:** 2026-05-15
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase closes two accumulated tech-debt items from the v4.0/v4.1 close,
neither of which touches the catalog schema serial spine:

1. **Nyquist hardening sweep (DEBT-10)** — retroactively bring six prior phases
   to Nyquist validation compliance:
   - Phases **25, 26** — no VALIDATION.md exists; author one for each.
   - Phases **27, 28, 30, 31** — VALIDATION.md exists (in git history only —
     see below) at `partial`; upgrade to `nyquist_compliant: true` +
     `wave_0_complete: true`.
   - Phase **30** (aspect-ratio / object-fit) gains CSS-chain assertions that
     check *computed styles*, not class names — assertions that would have
     caught the `h-full` hotfix regression flagged in the v4.1 feedback memory.

2. **UAT triage (DEBT-11)** — triage all ~33 deferred human UAT items across
   v4.0 Phases 18 (9) / 20 (5) / 20.1 (8) / 22 (6) / 23 (5) into explicit
   CLOSED / SUPERSEDED / DEFERRED dispositions. Output is a closure table.

**Parallel track:** numbered 42 for ROADMAP tracking; executes after Phase 39b,
overlapping Phase 40. Independent of catalog schema.

Discussion clarified HOW to execute this hardening. No new product capability
is in scope.

</domain>

<decisions>
## Implementation Decisions

### UAT Triage Process (DEBT-11)
- **D-01:** Claude pre-triages all ~33 UAT items. Each item is classified with
  **cited evidence** — the specific gap-closure plan (20.1-06 / 07 / 08) or
  Phase 39 / 39b change that supersedes it, or the reason it must defer.
  SUPERSEDED and DEFERRED items close on evidence alone (no live run). Items
  that genuinely survived become the **CLOSED-candidate** set.
- **D-02:** The CLOSED-candidate set is run as a **blocking** step during Phase
  42 execution — a `42-HUMAN-UAT.md` checklist (same pattern as
  `41-HUMAN-UAT.md`). Execution pauses for the user's sign-off; the closure
  table is finalized with real CLOSED / FAIL results **before the phase can
  close**. No provisional rows ship.
- **D-03:** Ambiguous items — can't prove superseded, but expensive/impractical
  to UAT (live-network behaviors, sparse-network states) — default to
  **CLOSED-candidate**, i.e. they go into the user's run-batch and get a real
  verdict. Err toward running, not deferring. Expect a larger-than-minimal batch.
- **D-04:** Fold in the adjacent v4.0-audit hygiene finding: move the **5 stale
  Phase 20.1 debug entries** (still `status: diagnosed` in `.planning/debug/`
  despite closure by gap-closure plans 20.1-06/07/08) to
  `.planning/debug/resolved/`. Items: `verdict-empty-collection-message`,
  `wishlist-textarea-not-prefilled`, `recently-evaluated-rail-missing` (06);
  `search-row-expand-broken` (07); `no-escape-from-manual-entry` (08).

### Triage Output Format
- **D-05:** The closure table lives in this phase's CONTEXT.md per ROADMAP
  success criterion #4. **Append the final closure table to this file** during
  execution (a `<triage>` section) — it is the canonical DEBT-11 artifact.
  Each row: item description · original phase · disposition (CLOSED / SUPERSEDED
  / DEFERRED) · resolution note (for SUPERSEDED, cite the superseding phase/plan;
  for DEFERRED, an explicit reason; for CLOSED, the UAT result).

### Computed-Style Testing (DEBT-10)
- **D-06:** **Add Playwright** as the CSS-chain assertion tool — committed
  regardless of whether jsdom `getComputedStyle` could suffice. Real-browser
  layout is treated as the only honest way to assert the CSS chain, and this
  establishes browser-test infra future visual phases reuse.
- **D-07:** Browser-based computed-style assertions cover **all visual surfaces
  touched by Phases 25–31**, not only Phase 30's aspect-ratio / object-fit. Any
  visual rendering in scope gets a computed-style assertion.
- **D-08:** All new assertions check **computed styles, not class names**
  (DEBT-10 hard requirement; also ROADMAP success criterion #5).

### VALIDATION.md Depth — Phases 25 & 26
- **D-09:** **Targeted** depth. Author the D-07 browser tests for 25/26 visual
  surfaces. For non-visual requirements (NAV-13..15, UX-01..08, WYWT-20..21),
  VALIDATION.md **cites existing test-suite coverage** where it exists and
  records **prod UAT approval (commit `7132ac0`, 2026-05-02)** as wave-0
  evidence for the rest. Author new behavioral tests **only where there is a
  genuine coverage gap**. Do not re-litigate phases that shipped to prod with
  full UAT sign-off.

### VALIDATION.md File Location
- **D-10:** The Phase 25–31 directories were **deleted** by commit `dd58ba4`
  ("docs: start milestone v5.0") — not archived. The 27/28/30/31 VALIDATION.md
  files exist only in git history; 25/26 never had one. **Consolidate all 6
  VALIDATION.md files under a `42-validation-backfill/` subfolder** inside this
  phase directory. Phase 42 owns DEBT-10 end-to-end; the debt closure is
  self-contained and traceable in one place. Source phase directories stay
  deleted — do NOT recreate them.

### Claude's Discretion
- **Existing partial VALIDATION.md (27, 28, 30, 31):** apply the same targeted
  principle as D-09 — recover the file from git history
  (`git show dd58ba4^:<path>`), root-cause what made it `partial`, close that
  specific gap, add the D-07 browser tests for that phase's visual surfaces,
  then flip frontmatter to `nyquist_compliant: true` + `wave_0_complete: true`.
  Don't re-derive full coverage for already-shipped phases.
- **Playwright integration mechanism:** prefer **Vitest browser mode**
  (`vitest --browser` with the Playwright provider) over a standalone
  `@playwright/test` runner — keeps a single test runner and one config.
  Researcher confirms this is viable on the current Vitest 2.1.9 / Next.js 16
  setup; if not, a scoped standalone Playwright config is the fallback.
- **Consolidated filenames:** inside `42-validation-backfill/`, keep the
  original phase-numbered names (`25-VALIDATION.md` … `31-VALIDATION.md`) so
  each file is recognizable by the phase it validates.
- **UAT item sourcing:** the ~33 items are enumerated in
  `v4.0-MILESTONE-AUDIT.md` (the per-phase `items:` blocks). Use that as the
  authoritative source list for the triage table.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` §DEBT-10, §DEBT-11 — the two requirements this
  phase satisfies; DEBT-10 names the exact target phases and the computed-style
  mandate, DEBT-11 names the five source phases and the closure-table contract.
- `.planning/ROADMAP.md` §"Phase 42" — the 5 locked success criteria.

### UAT Triage Source Material (DEBT-11)
- `.planning/milestones/v4.0-MILESTONE-AUDIT.md` — **authoritative enumeration**
  of all ~33 deferred UAT items, broken down per phase in the `items:` blocks
  (Phase 18 / 20 / 20.1 / 22 / 23). Also documents the 5 stale debug entries
  (D-04) and notes which 20.1/22 items the audit already suspects are stale.
- `.planning/milestones/v4.0-phases/23-settings-sections-schema-field-ui/23-VERIFICATION.md`
  — Phase 23's 5 pending UAT items + frontmatter `human_verification` array.

### Nyquist Hardening Source Material (DEBT-10)
- Git history only — Phase 27/28/30/31 VALIDATION.md were deleted by commit
  `dd58ba4`. Recover via `git show dd58ba4^:.planning/phases/<dir>/<file>`.
  Relevant deleted paths:
  - `.planning/phases/27-watch-card-collection-render-polish/27-VALIDATION.md`
  - `.planning/phases/28-add-watch-flow-verdict-copy-polish/28-VALIDATION.md`
  - `.planning/phases/29-nav-profile-chrome-cleanup/29-VALIDATION.md` (the only
    already-COMPLIANT one — use as the reference shape for the upgrades)
  - `.planning/phases/30-wywt-capture-alignment-fix/30-VALIDATION.md`
  - `.planning/phases/31-v4-0-verification-backfill/31-VALIDATION.md`
- `.planning/codebase/TESTING.md` — **stale** (generated 2026-04-11, says "no
  tests"); current reality is Vitest 2.1.9 + jsdom 25 + Testing Library, per
  `package.json`. Treat package.json as ground truth.

### Reference Artifacts (validation shape / patterns)
- `.planning/phases/41-account-danger-zone-branded-auth-emails-parallel-track/41-HUMAN-UAT.md`
  — the `*-HUMAN-UAT.md` pattern D-02 reuses for the blocking UAT checklist.
- `.planning/phases/41-account-danger-zone-branded-auth-emails-parallel-track/41-VALIDATION.md`
  — a recent compliant VALIDATION.md for frontmatter/structure reference.

### Memory (project feedback — informs DEBT-10)
- Auto-memory `feedback_ui_spec_css_chain_blind_spot.md` — the v4.1 feedback
  that the 6-pillar checker validated declared tokens, not the CSS chain; the
  Phase 30 black-bar shipped through 6/6 PASS. This is the direct origin of
  DEBT-10's "computed styles, not class names" requirement and the bar that
  D-06/D-07/D-08 must meet.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Test stack** — Vitest 2.1.9 + jsdom 25 + `@testing-library/react` 16 +
  `@testing-library/jest-dom` 6 + `@testing-library/user-event` 14. `npm test`
  runs `vitest run`. Playwright (D-06) is additive on top of this; Vitest
  browser mode is the preferred integration so the runner count stays at one.
- **`*-HUMAN-UAT.md` pattern** — Phase 41 produced `41-HUMAN-UAT.md`; D-02's
  blocking UAT checklist follows that shape.
- **Compliant VALIDATION.md exemplars** — Phase 29 (the only v4.1 phase that
  reached COMPLIANT) and Phase 41's VALIDATION.md show the target frontmatter
  (`nyquist_compliant: true`, `wave_0_complete: true`) and structure.

### Established Patterns
- VALIDATION.md is a per-phase artifact with YAML frontmatter
  (`nyquist_compliant`, `wave_0_complete`, `status`). D-10 deliberately breaks
  the per-phase *location* convention (source dirs are gone) but keeps the
  per-phase *file* identity via `42-validation-backfill/<NN>-VALIDATION.md`.
- No CI exists (`.github/workflows/` absent). New tests must pass locally via
  `npm test`; this phase does not introduce CI.

### Integration Points
- Playwright / Vitest browser mode wires into the existing `vitest.config`
  and `package.json` test scripts.
- The triage closure table appends into this CONTEXT.md as a `<triage>`
  section (D-05) — the only file DEBT-11 must produce.

</code_context>

<specifics>
## Specific Ideas

- The acceptance bar for DEBT-10 is concrete and quotable: assertions that
  **"would have caught the `h-full` hotfix regression."** Every Phase 30
  CSS-chain assertion should be checked against that question explicitly.
- "Don't re-litigate shipped phases" is the governing principle for D-09 —
  Phases 25/26 had real prod UAT sign-off; the goal is closing the *artifact*
  gap, not reconstructing validation as if the phases were unverified.

</specifics>

<deferred>
## Deferred Ideas

- **DEBT-12 (drizzle journal repair)** — explicitly NOT in Phase 42. It is
  unscheduled/opportunistic per REQUIREMENTS.md, to land with the next prod
  deploy needing `drizzle-kit migrate` (likely Phase 35/36/37). Out of scope.
- **CI pipeline** — no `.github/workflows/` exists. Setting up CI so these new
  tests run on every push is a worthwhile follow-up but is its own concern, not
  part of this hardening sweep.

None other — discussion stayed within phase scope.

</deferred>

---

*Phase: 42-Nyquist Hardening Sweep + UAT Triage*
*Context gathered: 2026-05-15*

<triage>
## DEBT-11 Final Closure Table

**Completed:** 2026-05-16 | **Total items:** 34 (33 UAT items + 1 D-04 note row)
**Dispositions:** CLOSED: 24 | SUPERSEDED: 9 | DEFERRED: 1

> **Post-phase update 2026-05-16:** Row 31 (Cross-surface theme sync) was originally
> DEFERRED on a failed UAT verdict. The underlying Light-mode bug was subsequently
> fixed in commit `f9fcb85` and user-verified — row 31 is now CLOSED. See debug
> session `.planning/debug/resolved/light-mode-theme-not-applying.md`.

All 33 deferred UAT items from v4.0 Phases 18/20/20.1/22/23 are accounted for below, plus one administrative note row (D-04). CLOSED rows are backed by real UAT pass verdicts from `42-HUMAN-UAT.md` (run 2026-05-16). SUPERSEDED rows are closed on cited evidence (no live run required per D-01). DEFERRED rows carry an explicit reason and forward target.

| # | Item Description | Original Phase | Disposition | Resolution Note |
|---|-----------------|----------------|-------------|-----------------|
| 1 | Sparse-network hero render: visiting `/explore` as a user with <3 follows and zero wear events shows the sparse-network welcome hero | 18 | CLOSED | UAT 2026-05-16: passed |
| 2 | See-all surfaces: Popular Collectors and Gaining Traction "See all" navigation clicks lead to correctly populated full-list pages | 18 | CLOSED | UAT 2026-05-16: passed |
| 3 | Mobile BottomNav: the Explore slot appears correctly in the mobile bottom navigation at the correct position with the correct icon | 18 | CLOSED | UAT 2026-05-16: passed |
| 4 | Follow→/explore SWR revalidation: after following a new collector from `/explore`, the discover surface refreshes to reflect the new follow | 18 | CLOSED | UAT 2026-05-16: passed |
| 5 | Add-watch→/explore SWR fan-out: adding a watch from the extract flow causes the /explore Trending and Gaining Traction rails to recompute on next visit | 18 | CLOSED | UAT 2026-05-16: passed |
| 6 | Popular Collectors rail: the most-followed public profiles (excluding self and already-followed) are shown, with correct follow counts | 18 | CLOSED | UAT 2026-05-16: passed |
| 7 | Trending Watches rail: catalog watches with highest recent view velocity are surfaced correctly in the Trending rail | 18 | CLOSED | UAT 2026-05-16: passed |
| 8 | Gaining Traction rail: watches with rising ownership delta (new owners in last 7d vs prior 7d) surface correctly | 18 | DEFERRED | Requires specific DB state (two time-period catalog snapshots) not reproducible in a single test session; carry to v5.x when catalog snapshot data is more populated (per 42-PRE-TRIAGE.md evidence) |
| 9 | /explore/collectors full-list: full popular-collectors list page renders correctly with pagination | 18 | CLOSED | UAT 2026-05-16: passed |
| 10 | CollectionFitCard visual rhythm: the card's layout, spacing, and visual hierarchy look correct on a real collection | 20 | SUPERSEDED | Superseded by Phase 39 NSV-01 — `CollectionFitCard.tsx:62-81` was reshaped (mostSimilar `<li>` elements gained `<Link>` wraps with hover styles); the Phase 20 UAT targeted the original layout; Phase 39 NSV-01+15 are the correct post-modification baseline (39-CONTEXT D-07) |
| 11 | D-08 self-via-cross-user callout: viewing your own watch page as a cross-user session surfaces the correct self-identification callout | 20 | CLOSED | UAT 2026-05-16: passed |
| 12 | Accordion inline preview interaction: the inline preview accordion on `/catalog/[catalogId]` expands and collapses correctly | 20 | SUPERSEDED | Superseded by Phase 39b NSV-06+20 — `/catalog/{id}` was substantially reshaped (ReferenceIdentityCard added, 3-CTA block restructured for empty-collection branch, owners roster added by NSV-18); the Phase 20 accordion premise is no longer valid (39b-CONTEXT D-39b-04, 39b-VERIFICATION.md) |
| 13 | Discovery click-through to /catalog/[catalogId]: clicking a watch in a discovery rail navigates correctly to the catalog detail page | 20 | SUPERSEDED | Superseded by Phase 39 NSV-01+15 (Link wraps in CollectionFitCard) and Phase 39b NSV-02+16 (DiscoveryWatchCard components on `/catalog/{id}` and `/watch/{id}` lineage rails clicking through to `/catalog/{id}`); the entire click-through surface was reshaped |
| 14 | FIT-02 phrasing quality: the verdict copy reads naturally on real collection data (not formulaic or repetitive) | 20 | CLOSED | UAT 2026-05-16: passed |
| 15 | Visual smoke: the full URL-extract → verdict → 3-button decision flow works end-to-end on a real watch URL | 20.1 | SUPERSEDED | Superseded by gap-closure plan 20.1-06 (fixed catalogId-null bug causing empty-collection fallback for all users, debug entry `verdict-empty-collection-message`) and Phase 28-05 (commit `fbe3522`, full AddWatchFlow + WatchForm submit handler rewrite); post-fix the flow works end-to-end by definition |
| 16 | Wishlist commit smoke: clicking "Add to Wishlist" from verdict-ready opens WishlistRationalePanel with textarea pre-filled by verdict.contextualPhrasings[0] | 20.1 | SUPERSEDED | Superseded by gap-closure plan 20.1-06 (fixed `verdict !== null` path, debug entry `wishlist-textarea-not-prefilled`); pre-fill now works by definition |
| 17 | Skip + rail smoke: clicking Skip from verdict-ready clears the input AND adds a chip to the "Recently evaluated" rail | 20.1 | SUPERSEDED | Superseded by gap-closure plan 20.1-06 (fixed `state.catalogId` falsy guard that silently skipped the rail entry push, debug entry `recently-evaluated-rail-missing`) |
| 18 | Manual entry inline flow (entry + escape): clicking "or enter manually" transitions to inline WatchForm AND a Cancel CTA escapes back to URL entry mode | 20.1 | CLOSED | UAT 2026-05-16: passed |
| 19 | Extraction failure recovery: when URL extraction fails, the user is shown a categorized error card (`ExtractErrorCard`) with continuation options | 20.1 | CLOSED | UAT 2026-05-16: passed |
| 20 | /search inline 3 CTAs: on `/search?tab=watches`, clicking a result row expands the accordion inline to show the verdict and 3-button CTAs | 20.1 | SUPERSEDED | Superseded by gap-closure plan 20.1-07 (fixed `search-row-expand-broken` — accordion expand was entirely non-functional, debug entry resolved) and Phase 39b NSV-14 (StatsTabContent Link wraps and LockedTabCard CTAs touching adjacent search/profile surfaces) |
| 21 | /catalog cross-user 3 CTAs: on `/catalog/[catalogId]`, a cross-user viewer sees the 3-button CTAs (Add to Wishlist / Add to Collection / Skip) inline | 20.1 | SUPERSEDED | Superseded by Phase 39b NSV-06+20 (3-CTA block now renders for empty-collection viewers below the new ReferenceIdentityCard, 39b-CONTEXT D-39b-04; owners roster added by NSV-18); cross-user CTA surface was substantially modified |
| 22 | Deep-link /watch/new?catalogId smoke: navigating to `/watch/new?catalogId=<id>` pre-fills the extract flow from the catalog entry | 20.1 | CLOSED | UAT 2026-05-16: passed |
| 23 | Email change end-to-end with live Resend SMTP: trigger an email address change, receive confirmation emails at both addresses, click the link, confirm success toast | 22 | CLOSED | UAT 2026-05-16: passed |
| 24 | Password change — fresh session: the password change flow works directly from a fresh session without triggering re-auth | 22 | CLOSED | UAT 2026-05-16: passed |
| 25 | Password change — stale session re-auth: changing the password from a session older than 24h triggers the re-auth dialog before the change applies | 22 | CLOSED | UAT 2026-05-16: passed |
| 26 | /settings vertical-tabs visual: the Settings page renders the correct vertical-tabs layout (Account / Profile / Preferences / Privacy / Notifications / Appearance) with correct visual hierarchy | 22 | CLOSED | UAT 2026-05-16: passed |
| 27 | /preferences redirect: navigating to `/preferences` redirects correctly to `/settings#preferences` | 22 | CLOSED | UAT 2026-05-16: passed |
| 28 | Email-change banner persistence: the "Confirmation sent to old@ and new@" banner remains visible across tab switches without clearing prematurely | 22 | CLOSED | UAT 2026-05-16: passed |
| 29 | Preferences persistence — Brand Loyalist: selecting "Brand Loyalist" in Collection goal on `/settings#preferences` persists after page reload | 23 | CLOSED | UAT 2026-05-16: passed |
| 30 | analyzeSimilarity reads new preference on next render: after changing Overlap tolerance, the verdict on `/watch/{id}` reflects the new preference | 23 | CLOSED | UAT 2026-05-16: passed |
| 31 | Cross-surface theme sync: toggling Light/Dark/System in AppearanceSection and UserMenu InlineThemeSegmented stay in sync via the `horlo-theme` cookie | 23 | CLOSED | UAT 2026-05-16 initially failed — Light-mode theme application broken. Root-caused and fixed post-phase: a leftover `@media (prefers-color-scheme: dark)` block in `globals.css` forced dark variables on dark-OS machines. Fixed in commit `f9fcb85`, user-verified 2026-05-16. See debug session `.planning/debug/resolved/light-mode-theme-not-applying.md` |
| 32 | notesPublic cross-page revalidation: editing a watch's Public/Private pill updates the per-row NoteVisibilityPill on `/u/{username}/notes` | 23 | CLOSED | UAT 2026-05-16: passed |
| 33 | Chronometer end-to-end: checking "Chronometer-certified" in WatchForm and submitting shows a "Certification: ✓ Chronometer" row in WatchDetail | 23 | CLOSED | UAT 2026-05-16: passed |
| D-04 | 5 stale Phase 20.1 debug entries: `verdict-empty-collection-message`, `wishlist-textarea-not-prefilled`, `recently-evaluated-rail-missing`, `search-row-expand-broken`, `no-escape-from-manual-entry` | 20.1 | SUPERSEDED | Already resolved prior to Phase 42 execution by gap-closure plans 20.1-06/07/08; entries moved to `.planning/debug/resolved/`; no further action needed (per D-04 decision in 42-CONTEXT.md) |

</triage>
