# Phase 33: Discovery Audit - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Produce a falsifiable, read-only click-path audit of v5.0 discovery surfaces and commit it as `.planning/phases/33-discovery-audit/DISCOVERY-AUDIT.md`. The audit consists of (a) a markdown table with one row per `(surface × clickable element × viewer-state × viewport-where-different)` tagged Live / Dead / Redundant / Missing across the 6 ROADMAP surfaces (`/`, `/explore`, `/u/{user}`, `/catalog/{id}`, `/search`, `/watch/{id}`) plus the global Header nav and the 7 `/u/{user}/[tab]` profile tabs as their own surface blocks, and (b) a final § with explicit YES/NO/DEFERRED resolutions to the 4 mandated decisions, each citing the specific row IDs that justify the verdict.

**In scope:** Source-code-first enumeration (grep every Link/anchor/router.push/onClick across each surface's component tree) followed by a production-horlo.app browser spot-check pass walked from BOTH the owner account AND a fresh signed-up account (no collection, no follows) at desktop AND a representative ~390px mobile width.

**Not in scope:** Code, schema, dependency, or data changes; new tests; CI changes; auditing /notifications, /insights, /preferences, /settings, /wear/[id], /watch/new, /watch/[id]/edit, /signup, /login, /forgot-password, /reset-password, /auth/callback (utility/auth surfaces, not discovery); /explore sub-routes as separate surfaces (folded into /explore as click targets per D-06); a 5th catch-all decision beyond the 4 mandated by ROADMAP §Phase 33 criterion #3.

**ROADMAP success criteria fully covered (verbatim from `.planning/ROADMAP.md` §Phase 33):**
1. DISCOVERY-AUDIT.md exists with the click-path TABLE (D-08, D-09)
2. Pass/fail criteria written at the TOP before findings appear (D-13)
3. Decisions § with YES/NO/DEFERRED for the 4 named questions (D-15, D-16, D-17)
4. Every row has a unique row ID downstream phases can cite (D-08)
5. Zero code/schema/dependency changes ship (enforced by audit-only scope)

</domain>

<decisions>
## Implementation Decisions

### Audit method (Area 1)

- **D-01:** Source-code-first traversal. Pass 1 is a full source-code enumeration: for each surface in scope (Header + 6 ROADMAP surfaces + 7 profile tabs), grep `<Link`, `<a href`, `router.push`, `router.replace`, `redirect(`, `onClick` handlers across the component tree starting from `src/app/{surface}/page.tsx` and following imports. Each enumerated affordance becomes a candidate row tagged with `evidence: file:line`. Rationale: completeness — captures every wired affordance including those gated by runtime conditions a browser pass would miss; reproducible — re-running the greps re-validates the row set; matches v5.0 audit-first posture (SEED-004) where the table must be falsifiable.

- **D-02:** Production horlo.app for the browser spot-check pass. After the source-code pass produces candidate rows, walk ~5–10 high-stakes rows in a real browser at horlo.app to confirm runtime behavior (e.g., ExploreHero's `followingCount<3 && wearEventsCount<1` gate, Common Ground tab's gate, owner-only conditional rendering). Production is the source-of-truth tag; `evidence` for browser-confirmed rows reads `prod: <URL> + <observation>`. Rationale: matches v5.0 single-user assumption; audits what shipped, not what's pending merge.

- **D-03:** Owner AND a fresh signed-up account (no collection, no follows) walk every surface. The owner account covers the "populated owner" viewer state. The fresh account covers the "sparse network" state — necessary to reproduce surfaces gated on `followingCount<3 && wearEventsCount<1` (ExploreHero), empty-collection branches on `/`, `/explore`, `/catalog/{id}` (verdict suppression D-07 from Phase 20), and the `LockedTabCard` empty/locked profile tab states. Each row carries a `viewer_state` column tagged `owner-populated` or `fresh-account` (or `N/A` for surfaces where it doesn't matter). Rationale: catches discovery dead ends that owner-with-data view literally cannot reproduce; small-account fixture is a one-time signup at /signup → matches v5.0 single-user app structure.

- **D-04:** Both viewports (desktop ~1280px + mobile ~390px iPhone). Each row stays single unless the affordance, target, or visibility differs by viewport — in which case the row splits into two with `viewport: desktop` / `viewport: mobile`. Rows with identical behavior at both viewports carry `viewport: both`. Rationale: Phase 27 mobile-first investments (grid-cols-2, ProfileTabs scroll lock, mobile-only sheets), Phase 30 aspect-ratio findings (per the v4.1 feedback memory `feedback_ui_spec_css_chain_blind_spot.md`), and the v5.0 SRCH-16 mobile bottom-sheet pattern all live in the mobile-only branch.

### Surface coverage breadth (Area 2)

- **D-05:** Audit scope = 6 ROADMAP surfaces + Header (global) + 7 profile tabs as separate surface blocks. Final surface list (15 blocks):
  1. **Header (global)** — persistent nav rendered on every authenticated page; documented once
  2. `/` — home (5 sections: WywtRail, CollectorsLikeYou, NetworkActivityFeed, PersonalInsightsGrid, SuggestedCollectors)
  3. `/explore` — ExploreHero (sparse-state-only), PopularCollectors, TrendingWatches, GainingTractionWatches
  4. `/search` — 4-tab search (All / Watches / People / Collections) + SuggestedCollectorsForSearch empty state
  5. `/catalog/{catalogId}` — catalog detail + verdict + CatalogPageActions (gated on viewer state)
  6. `/watch/{id}` — per-user watch detail + verdict (same-user / cross-user framing)
  7. `/u/{user}/collection` — owned watches grid
  8. `/u/{user}/wishlist` — wishlist grid (incl. reorderable affordances per Phase 27)
  9. `/u/{user}/worn` — wear log
  10. `/u/{user}/notes` — note rows + NoteVisibilityPill (DEBT-09 fix territory)
  11. `/u/{user}/stats` — distributions + observations
  12. `/u/{user}/common-ground` — gated cross-viewer overlap (404 when gate fails per Phase 25 D-02/D-17)
  13. `/u/{user}/insights` — owner-only insights tab

  **Plus** the followers/following sub-routes counted as click targets, NOT separate surfaces (`/u/{user}/followers` and `/u/{user}/following` produce list pages but their interaction surface is just "list of avatar links" — fold as click targets from the ProfileHeader and the suggestion rails).

  **Explicitly out of scope:** /notifications, /insights (the `/insights` route — separate from the per-profile insights tab), /preferences, /settings, /wear/[wearEventId], /watch/new, /watch/[id]/edit, /signup, /login, /forgot-password, /reset-password, /auth/callback. Rationale: utility/edit/auth surfaces, not discovery.

- **D-06:** /explore sub-routes (`/explore/collectors`, `/explore/watches`) are NOT separate surface blocks. The "See all collectors" / "See all watches" affordances in the parent rails get rows on the `/explore` block (`element="See all collectors", target=/explore/collectors, tag=Live`). Each sub-route then gets ONE summary row noting "paginated 'see all' list; downstream affordances identical to parent rail rows DISC-AUDIT-XX..XX". Rationale: avoids 2x row duplication for paginated views of the same content set.

- **D-07:** 7 profile tabs are separate surface blocks (not one `/u/{user}` block with a tab column). Each tab renders different click-paths (e.g., notes tab has the NoteVisibilityPill DEBT-09 just fixed in Phase 32; insights tab is owner-only; common-ground is 404-on-gate-fail). Treating them as one block conflates very different click-paths and breaks scannability.

- **D-08:** Header nav documented once as the "Header (global)" surface block. Per-surface rows describe ONLY surface-specific affordances. Per-surface variation in Header (e.g., active-state highlights on the current route, conditional dropdown items per route) gets a single Header row noting "active state varies by surface; not enumerated per-surface". Rationale: Header is identical across 13 authenticated pages; repeating ~10 rows per surface for what's almost always identical inflates the table by ~130 rows of noise.

### Click-path row schema (Area 3)

- **D-09:** Row ID format = `DISC-AUDIT-NN` flat sequential, zero-padded to 2 digits when N<10 for stable sort (e.g., `DISC-AUDIT-01`, `DISC-AUDIT-23`, `DISC-AUDIT-145`). Matches ROADMAP §Phase 33 example wording verbatim. Easy to grep across downstream phase plans (`grep -n "DISC-AUDIT-23" .planning/phases/`). Surface visibility comes from the `surface` column, not the ID.

- **D-10:** Final column set (8 columns):
  | Column | Type | Required | Notes |
  |---|---|---|---|
  | `row_id` | DISC-AUDIT-NN | yes | flat sequential per D-09 |
  | `surface` | string | yes | one of the 15 blocks per D-05 |
  | `element` | string | yes | the visible affordance (e.g., "Avatar in PopularCollectors row", "Brand pill on WatchDetail") |
  | `target` | string or `—` | yes | route or action; `—` for non-navigational onClicks |
  | `tag` | enum | yes | Live / Dead / Redundant / Missing per D-11 |
  | `evidence` | string | yes | `file:line` for source-pass rows; `prod: <URL> + <observation>` for browser-pass rows |
  | `viewer_state` | enum | yes | `owner-populated` / `fresh-account` / `N/A` |
  | `viewport` | enum | yes | `desktop` / `mobile` / `both` |

  Markdown rendering: ~8 columns is the practical readability ceiling for a side-scrolling table. Excluded by deliberate choice: `priority` (audit-author judgement is unreliable; let Phase 39 prioritize), `expected_target` (folded into `element` description for Missing rows), `notes` (folded into `evidence`), `screenshot` (URL in `evidence` is sufficient at single-user scale).

- **D-11:** Strict + behavioral tag definitions, pinned in a § above the table:
  - **Live**: element renders in the documented viewer_state AND target loads to expected destination (200 + correct content in browser pass; route handler exists in source pass).
  - **Dead**: element renders but target 404s, errors, or no-ops. Includes the WR-07 silent-no-op pattern (e.g., `revalidatePath('/u/{user}/{tab}', 'page')` against a literal-template route — Phase 32 D-01 territory).
  - **Redundant**: element renders AND target works, but another element on the same surface OR a different surface delivers the same destination/value. Row MUST cite the specific row it's redundant to in `evidence` (`Redundant to DISC-AUDIT-NN`).
  - **Missing**: NO element exists for an affordance the SEED-004 Rdio quote expects. Row's `target` reads "—" and `evidence` MUST cite the specific principle violation (e.g., `Rdio violation: catalog page has no affordance to walk to other watches in the same family`).

- **D-12:** Single rubric for "ideal click-path" — the SEED-004 Rdio principle quote pinned at the top of DISCOVERY-AUDIT.md: *"A collector should be able to drift from one watch / collector / family / reference to another by clicking, without ever feeling lost or running into a dead end."* (`.planning/seeds/SEED-004-v5-discovery-north-star.md` line 15). Every Missing row cites how it violates this principle. Rationale: single anchor is falsifiable; multi-anchor risks hand-waving Missing rows by switching rubrics.

### Pass/fail + decisions doc shape (Area 4)

- **D-13:** Pass/fail criteria pinned at the TOP of DISCOVERY-AUDIT.md before any findings appear (ROADMAP §Phase 33 criterion #2 verbatim). Coverage + completeness rules (5 rules — audit passes IFF ALL hold):
  1. Every surface in the D-05 scope list has ≥1 row in the table.
  2. Every Dead row has reproduction steps in `evidence` (file:line for source-pass; URL + observation for browser-pass).
  3. Every Missing row cites the SEED-004 Rdio quote violation in `evidence`.
  4. Every Redundant row cites the specific row ID it duplicates in `evidence`.
  5. All 4 mandated decisions in the final § have an explicit YES/NO/DEFERRED resolution with rationale anchored to ≥1 row ID.
  Falsifiable: a reviewer can re-walk the surface list and check each rule literally against the table.

- **D-14:** No numeric row-count thresholds per surface. Risk of over-counting trivial rows to hit thresholds; "every clickable element" already enforces completeness via D-13 rule #1 + the source-code grep methodology.

- **D-15:** Decisions § lives INLINE in DISCOVERY-AUDIT.md as the final § (not a separate `DISCOVERY-AUDIT-DECISIONS.md` file). Single file, single read for downstream phases. Matches ROADMAP §Phase 33 criterion #3 wording ("a decisions section exists").

- **D-16:** Per-decision format = verdict + 2–4 sentence rationale + cited row IDs + downstream-phase impact. Template:
  ```markdown
  **Q1: Combine home and explore?** — YES | NO | DEFERRED.
  Rationale: [2–4 sentences citing audit findings].
  Cited rows: DISC-AUDIT-NN, DISC-AUDIT-MM, ...
  Drives: [Phase 39 polish item / Phase 34 scope decision / etc.]
  ```
  Each verdict explicitly traces (a) audit findings (rows), (b) downstream phase impact. Falsifiable by reading the cited rows and confirming they say what the rationale claims.

- **D-17:** Exactly 4 decisions in the final §, matching ROADMAP §Phase 33 criterion #3 verbatim:
  1. Combine home and explore?
  2. Lineage browse priority (drives Phase 35 schema-only vs schema+UI scope, and Phase 39 lineage-browse polish scope)
  3. Dead-end closure priority (drives Phase 39 polish item ordering)
  4. CAT-13 discovery framing (drives Phase 38 framing — "tech debt" vs "discovery improvement")

  No 5th catch-all decision. Cross-phase scope-change findings flow through the table itself; ROADMAP §Phase 39 success criterion already mandates Phase 39 close any DISC-AUDIT-NN it chooses to close, and ROADMAP §Phase 34 explicitly depends on "audit must not reveal scope-reducing findings before migration work begins" — that signal travels via the table without needing a 5th decision row.

### Claude's Discretion

User selected the recommended option on every question across all 4 areas. No areas were left for Claude's free discretion; all decisions D-01 through D-17 are user-confirmed selections among presented options.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v5.0 milestone framing
- `.planning/ROADMAP.md` §"Phase 33: Discovery Audit" (lines 132–142) — phase goal + 5 success criteria. Source of all "MUST" wording.
- `.planning/REQUIREMENTS.md` §DISC-10 (line 19) — full requirement text.
- `.planning/STATE.md` §"Key Decisions (v5.0)" (lines 65–72) — Phase 39 + Phase 35 audit-conditional scope; "DEBT-09 before audit" build-order rationale.
- `.planning/seeds/SEED-004-v5-discovery-north-star.md` line 15 — **the Rdio principle quote** that gates every Missing row (per D-12).
- `.planning/seeds/SEED-004-v5-discovery-north-star.md` lines 16–22 — audit-first scoping; lists the 6 surfaces verbatim.
- `.planning/seeds/SEED-006-premium-features-audit.md` + `.planning/research/PREMIUM-MAP.md` — confirms no paid-vs-free forks to audit (no paywall in v5.0; SEED-006 RESOLVED 2026-05-06).

### Surfaces in scope (page-level entry points to walk)
- `src/app/page.tsx` — home (5 sections; L-01 LOCKED order per Phase 10 CONTEXT)
- `src/app/explore/page.tsx` — explore (Hero + 3 rails; D-06/D-07/D-09 from Phase 18)
- `src/app/explore/collectors/page.tsx`, `src/app/explore/watches/page.tsx` — sub-route summary rows only (D-06)
- `src/app/search/page.tsx` + `src/components/search/SearchPageClient.tsx` — 4-tab search
- `src/app/catalog/[catalogId]/page.tsx` — catalog detail (D-03/D-07/D-08 verdict gating from Phase 20)
- `src/app/watch/[id]/page.tsx` — per-user watch detail (D-08 framing logic from Phase 20)
- `src/app/u/[username]/layout.tsx`, `src/app/u/[username]/page.tsx` (redirect to /collection), `src/app/u/[username]/[tab]/page.tsx` — profile + 7 tabs
- `src/components/layout/Header.tsx` — global Header surface block
- `src/components/profile/ProfileTabs.tsx`, `src/components/profile/ProfileHeader.tsx` — profile-tab affordances and ProfileHeader follower/following click targets
- `src/proxy.ts` — auth gate (informs which surfaces redirect anon viewers; relevant for D-03 fresh-account walk)

### Surfaces explicitly out of scope (do NOT enumerate rows for these)
- `src/app/notifications/`, `src/app/insights/`, `src/app/preferences/`, `src/app/settings/`, `src/app/wear/[wearEventId]/`, `src/app/watch/new/`, `src/app/watch/[id]/edit/`, `src/app/signup/`, `src/app/login/`, `src/app/forgot-password/`, `src/app/reset-password/`, `src/app/auth/callback/` — utility/edit/auth surfaces per D-05.

### Downstream phases that consume DISCOVERY-AUDIT.md
- `.planning/ROADMAP.md` §"Phase 34: Layer A" line 146 — depends on audit not revealing scope-reducing findings.
- `.planning/ROADMAP.md` §"Phase 35: Layer B" — lineage browse UI scope is audit-conditional per `STATE.md` line 77.
- `.planning/ROADMAP.md` §"Phase 38: CAT-13 Engine Rewire" lines 193–203 — D-17 decision Q4 ("CAT-13 discovery framing") shapes Phase 38's framing.
- `.planning/ROADMAP.md` §"Phase 39: Audit-Driven Discovery Polish" lines 205–215 — closes specific DISC-AUDIT-NN rows; scope is fully audit-conditional per success criterion #5.

### Codebase patterns relevant to row-level analysis
- `.planning/milestones/v4.0-phases/23-settings-sections-schema-field-ui/23-VERIFICATION.md` §"notesPublic cross-page revalidation (D-19)" + `.planning/phases/32-debt-09-notespublic-fix/32-CONTEXT.md` §"WR-07" — the `revalidatePath` literal-template silent-no-op pattern. Any `revalidatePath('/u/{username}/[tab]', 'page')` discovered in scope (e.g., wishlist.ts:206 per Phase 32 deferred ideas) is a Dead-row candidate.
- `.planning/codebase/STRUCTURE.md` — directory map (caveat: stale 2026-04-11; verify against current `src/app/` tree before relying on it).

### Feedback memory anchors
- `.claude/projects/-Users-tylerwaneka-Documents-horlo/memory/feedback_ui_spec_css_chain_blind_spot.md` — v4.1 lesson; informs D-04 mobile-viewport coverage rationale (aspect-ratio / object-fit blind spot Phase 30 shipped through 6/6 PASS).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **No code is reused** — Phase 33 produces a markdown artifact, not code. The "reusable" assets are the source files themselves as targets of the source-code grep pass:
  - `src/app/{page.tsx,layout.tsx}` for each surface in D-05 scope
  - `src/components/{home,explore,profile,search,watch}/*.tsx` — surface-specific affordance components
  - `src/components/layout/Header.tsx` — Header surface block source
  - `src/proxy.ts` — auth-gate behavior; informs which surfaces require fresh-account walk (D-03)

### Established Patterns
- **Surface auth gating:** `src/proxy.ts` redirects unauthenticated viewers to /login before page render for all 6 ROADMAP surfaces. `/u/{user}` and `/catalog/{id}` render for anon viewers. Audit is owner + fresh-account; explicit anon walk is OUT OF SCOPE per D-03.
- **Conditional rendering gates discovered to date** (the "runtime gate" risks D-01 spot-check pass must catch):
  - `/explore` — `ExploreHero` renders only when `followingCount<3 && wearEventsCount<1` (`src/app/explore/page.tsx:38`)
  - `/catalog/{id}` — verdict suppressed when `collection.length === 0`; "You own this" framing when viewer owns the catalog ref (Phase 20 D-07/D-08)
  - `/watch/{id}` — verdict suppressed when `collection.length === 0` (Phase 20 D-07)
  - `/u/{user}/common-ground` — 404 on gate-fail or empty overlap (Phase 25 D-02/D-17)
  - `/u/{user}/insights` — owner-only tab
- **Row-level evidence patterns:**
  - Source-pass rows: `evidence: src/components/explore/PopularCollectors.tsx:NN` — verifiable via `cat -n`
  - Browser-pass rows: `evidence: prod: https://horlo.app/explore — clicked "View all collectors", landed on /explore/collectors with 8 results`

### Integration Points
- **Output integration:** DISCOVERY-AUDIT.md is read by Phase 34, Phase 35, Phase 38, Phase 39 plans. Each downstream plan's success criteria will cite specific DISC-AUDIT-NN row IDs (per D-09 flat sequential format → easy `grep -rn "DISC-AUDIT-23" .planning/`).
- **STATE.md update:** After Phase 33 ships, STATE.md "Key Decisions (v5.0)" gains entries for the 4 decisions per D-17 (Q1–Q4 verdicts).
- **No code integration:** Zero changes to `src/`, `tests/`, `db/`, `package.json`, `next.config.ts`, `tsconfig.json`, or any config file. The phase commits only into `.planning/phases/33-discovery-audit/`.

</code_context>

<specifics>
## Specific Ideas

- **Sparse-account fixture:** signup at `/signup` with a throwaway email; do not follow anyone; do not add any watches; do not log any wear events. This account satisfies the `followingCount<3 && wearEventsCount<1` gate and the `collection.length === 0` branches simultaneously. After audit ships, the fixture account can be deleted via SET-13 (Phase 41) — no v5.0 work required to clean up.
- **Source-grep recipe to start the table:**
  ```bash
  rg -n '<Link\b' src/app/page.tsx src/components/home/
  rg -n '<Link\b|router\.push|router\.replace' src/components/explore/
  rg -n '<Link\b|onClick' src/components/profile/
  rg -n '<Link\b|onClick' src/components/search/
  rg -n '<Link\b|onClick' src/components/watch/
  rg -n '<Link\b|onClick' src/components/layout/Header.tsx
  ```
  Each match becomes a candidate row before the browser spot-check pass.
- **Per-decision template (per D-16) committed verbatim into DISCOVERY-AUDIT.md final §:**
  ```markdown
  ### Decision Q1: Combine home and explore?
  **Verdict:** YES | NO | DEFERRED
  **Rationale:** [2-4 sentences citing audit findings]
  **Cited rows:** DISC-AUDIT-NN, DISC-AUDIT-MM
  **Drives:** [downstream phase / item this verdict gates]
  ```

</specifics>

<deferred>
## Deferred Ideas

- **Audit a 5th catch-all "scope-change findings" decision** — discussed and dropped per D-17. If the audit table surfaces cross-phase scope-change implications, those flow through the table itself (Phase 34 dependency check; Phase 39 audit-conditional scope). Revisit only if Phase 34/35/38/39 planning surfaces a need that the table-only signal can't carry.
- **Audit the auth/utility surfaces** (/notifications, /insights, /preferences, /settings, /wear/[id], /watch/new, /watch/[id]/edit) — explicitly out of scope per D-05. Possible v5.x or v6.0 work if a "non-discovery surface audit" becomes a polish phase. Capture the SET-13 Danger Zone (/settings) and the existing /preferences/insights/notifications surfaces as future audit candidates.
- **Anonymous-viewer walk** — explicitly skipped per D-03 (owner + fresh-account is sufficient for v5.0). If v5.x adds public discovery (sharing watches publicly, anon browse), revisit with an anon-walk audit at that time.
- **Numeric row-count thresholds per surface** — discussed and dropped per D-14. Could be added in a v5.x audit-methodology refinement if reviewers find completeness rules insufficient.
- **`/explore` sub-routes as separate surface blocks** — dropped per D-06 (folded as click targets). If sub-routes diverge significantly from parent rails (e.g., add filter affordances), revisit by promoting them to their own surface blocks in a follow-up audit.
- **Header active-state per-surface enumeration** — dropped per D-08 (single-row note). If Phase 39 polish reveals surface-specific Header behavior that matters for discovery, add per-surface Header rows then.
- **`/explore/watches` and `/explore/collectors` LoadMore behavior** — covered as summary rows per D-06; if pagination introduces dead-ends (e.g., LoadMore button stuck at 50 results), capture as a single Dead row on the parent /explore block, not as a sub-route audit.
- **`wishlist.ts:206` `revalidatePath('/u/[username]/[tab]', 'page')` divergence** — flagged in Phase 32 deferred ideas (`32-CONTEXT.md` deferred §). Likely surfaces as a Dead row in the audit (the WR-07 silent-no-op pattern); the audit captures it but does NOT fix it (zero-code rule). Phase 39 or v5.x technical-debt may close it.

</deferred>

---

*Phase: 33-discovery-audit*
*Context gathered: 2026-05-06*
