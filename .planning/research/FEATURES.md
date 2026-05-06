# Feature Research — v5.0 Discovery North Star

**Domain:** Taste-aware watch collection intelligence — discovery, catalog hierarchy, engine rewire, polish
**Researched:** 2026-05-06
**Confidence:** HIGH (catalog hierarchy, engine rewire, account UX, email UX), MEDIUM (click-driven discovery methodology, editorial curation, pairwise drill-down), LOW (lineage UX in watch-collector-specific apps — no direct comparables found; patterns drawn from Discogs + Letterboxd analogues)

---

## Categories

- **A: Discovery Audit** — click-path methodology
- **B: Catalog Hierarchy** — 5-level Brand/Family/Reference/Variant/Individual
- **C: Engine Rewire** — CAT-13 + CAT-14
- **D: Discovery Polish** — surfaces shaped by audit (DISC-09, SRCH-16, FIT-05)
- **E: Carryover / Polish** — DEBT-09, SET-13, SET-14, Nyquist sweep, UAT triage

---

## A: Discovery Audit

### A-1: Click-path audit (read-only Phase 1)

**What it is.** Map every click-path users can take starting from each of the six surfaces: `/` (home), `/explore`, `/u/{user}`, `/catalog/{catalogId}`, `/search`, `/watch/{id}`. For each surface: what can a user click to navigate forward, where does each click land, and is there a forward exit from the landing page? Tag each path outcome as: Live (navigates to a real, non-empty state), Dead (clicks land on a 404, empty state, or page with no onward navigation), Redundant (same destination reachable from two surfaces without differentiation), or Missing (an obvious next step that has no affordance).

**Why this has to be Phase 1.** SEED-004 is explicit: audit-first prevents premature consolidation. "Combine home and explore?" is exactly the kind of question that gets decided wrong by gut. The audit answers it with evidence. Any discovery polish phase that ships before the audit is shipping into the dark.

**Making the audit falsifiable.** The audit is not useful if it produces impressionistic prose ("the explore page feels disconnected"). It is useful if it produces a closed set of specific, enumerable path outcomes with pass/fail criteria. Falsifiable methodology:

1. Define the entry points exhaustively: every route in the app that an authenticated user can reach from the nav (Home `/`, Explore `/explore`, Search `/search`, Profile `/u/{username}`, Catalog detail `/catalog/{id}`, Watch detail `/watch/{id}`).
2. For each entry point, enumerate every clickable element that produces navigation (links, buttons, cards, row items). This is an inventory step.
3. For each clickable element, record: destination route, whether the destination has zero onward navigation options (dead end), whether this is the only path to that destination or one of N paths (redundancy score).
4. Pass criteria per surface: every clickable element either (a) leads to a page with at least one onward navigation affordance, or (b) is explicitly a terminal action (Save, Delete — user-initiated finality). Fail criteria: a page with no onward navigation affordances that is NOT a terminal action page.
5. The audit output is a table with one row per (surface × clickable element), not a report. That table is the falsifiable artifact; phases close rows.

**Table stakes.** The audit pass/fail criteria must be written before the audit runs, not after. "Audit finds problems" is not falsifiable. "Audit finds zero dead ends per the enumerated criteria" is.

**Complexity:** SMALL — no code ships, only a structured document. Output is a decisions doc (DECISIONS.md in the phase directory) with the click-path table and a prioritized list of gaps for subsequent phases.

**Depends on:** Nothing new — reads existing app surfaces.

**Anti-feature:** Pre-deciding that home and explore should be merged before the audit runs. The decision must follow evidence. SEED-004 explicitly forbids pre-deciding.

---

## B: Catalog Hierarchy

### B-1: Layer A — Brand + Family entities (additive, schema-only)

**What it is.** Add `brands` and `watch_families` tables. Add nullable `brand_id` FK and nullable `family_id` FK to `watches_catalog`. No UI — this is a schema migration that makes Brand and Family first-class entities rather than normalized strings, without breaking any existing query.

**Why additive matters.** The existing flat catalog is Reference-granularity (dial color is a column, not a separate row), so the existing social signal (owners_count, wishlist_count aggregated per Reference) is correct. Layer A only adds two new tables and two nullable FKs. Every existing DAL query continues to work unchanged. Backfill is manual curation (or deferred for catalog seeding) — no automated migration necessary.

**Table stakes.** Brand and Family as first-class entities is the precondition for every higher-level feature: Family pages, lineage edges, faceted search by family, the eventual recommender taste graph at Reference granularity. Without them you have strings; with them you have navigable entities.

**Complexity:** SMALL — two new tables, two nullable FKs, one migration. No DAL rewrites. No UI.

**Depends on:** Existing `watches_catalog` flat table (already shipped, Phase 17).

### B-2: Layer B — Lineage edges + structured movement + era/case_material/bracelet_config

**What it is.** Add `watch_lineage_edges` table with `predecessor_catalog_id → successor_catalog_id` FK pairs (directed graph). Add structured `movement_caliber` (text) and `movement_type` (enum: auto/manual/quartz/spring_drive) columns to `watches_catalog` to replace free-text `movement`. Add first-class `era` (text enum), `case_material` (text), and `bracelet_config` (text) columns.

**Why lineage edges matter for discovery.** The collector mental model for browse is: "I like the Submariner 16610 — what came before it? What came after?" That question is unanswerble without an explicit predecessor/successor edge. Lineage edges are the data model precondition for any "predecessor / successor" UX affordance. They're also the hook for SEED-002's recommender ("if you own this, you might like its predecessor") without ML.

**Structured movement type** is required for SRCH-16 search facets (Movement filter needs clean enum values, not free text like "ETA 2824-2" and "Sellita SW200" mixed together).

**Complexity:** MEDIUM — new `watch_lineage_edges` table, 3-4 new columns on `watches_catalog`, one migration. No UI yet. Lineage backfill is manual curation only — no automation.

**Depends on:** Layer A (family_id exists before lineage edges are added, so edges can be scoped to a Family).

**Anti-feature: Automated lineage inference.** Do not attempt to infer predecessor/successor relationships algorithmically from reference numbers or production years. The edge must be explicitly curated. Automated inference would introduce incorrect edges (e.g., "16610" → "116610" is correct for Submariner Date, but automated inference keyed on numeric prefix would generate false positives across unrelated families). Manual curation only.

### B-3: Layer C — Variant split (clean-slate DB wipe + reseed)

**What it is.** A clean-slate migration: wipe the existing `watches_catalog` rows, introduce a `watch_variants` table, and relink existing `watches.catalog_id` FKs to Reference-level rows (not Variant-level). This is safe because the app is single-user (owner) with a small DB and the owner is explicitly willing to wipe.

**Why Variant fragmentation must be fixed.** SEED-001 documents Variant creep: the same Reference (e.g., Submariner 16610) can exist as two rows ("16610 Kermit" and "16610 black dial") when they're really the same Reference with different dial/bezel variants. Fragmentation at the Reference level destroys the social signal because owners_count and wishlist_count fragment across the same watch. The Discogs Master Release model demonstrates the right approach: one parent entity (Master Release / Reference), N child entities (Release / Variant) that share the parent's social aggregation.

**Clean slate enabled by single-user context.** In a production multi-user system this migration would require a complex backfill with user communication. Here, one user, owner is explicitly willing to wipe and reseed. CAT-14 (`SET NOT NULL` on `watches.catalog_id`) also becomes feasible in this milestone for the same reason.

**Complexity:** HIGH — new `watch_variants` table, migration that drops and reseeds `watches_catalog`, re-links `watches.catalog_id` FKs. Requires DAL updates for any query that selects variant-level columns directly.

**Depends on:** Layer A (brand_id/family_id must exist before Variants reference them) and Layer B (structured movement must exist before Variants are created with clean data).

**Anti-feature: Exhaustive variant enumeration.** Do not attempt to enumerate all known variants of every Reference at catalog-seeding time. The Variant table ships empty (or sparsely populated). Variants grow organically as users add watches with distinct dial/bezel/bracelet configurations. The Reference row is always the canonical social-graph unit.

### B-4: Layer D — Provenance fields on `watches` + `divestments` table

**What it is.** Add provenance fields to the `watches` table: `serialNumber` (text, nullable), `yearOfAcquisition` (integer, nullable), `boxAndPapers` (enum: none/box-only/papers-only/full-set, nullable), `serviceHistory` (text, nullable, collector's diary free-text), `conditionNotes` (text, nullable). Add a `divestments` table to record sold-watch events (catalog_id, sold_date, sold_price, provenance_notes) so the sold signal is Individual-level rather than Reference-level.

**Why provenance fields matter.** For a collector, the Individual watch — this specific 16610 they've owned since 2019, with box and papers, two services — is distinct from an abstract Reference entry. Provenance is what makes the sold signal meaningful for SEED-002: a collector divesting a specific Individual (box+papers, low service cost, appreciated value) is a stronger negative signal than simply removing a Reference from a wishlist. Without Individual-level fields, the recommender milestone has to relitigate the data model.

**No paywall.** SEED-006 resolved: provenance ships free. Do not add any paid-tier gating to provenance fields.

**Collector UX pattern (from art/collectibles domain research).** The correct UI pattern for provenance fields is an optional "Collector's Record" section on the watch edit form, collapsed by default. Fields: Serial Number (text), Year Acquired (year picker), Box & Papers (chip group: None / Box Only / Papers Only / Full Set), Service History (free-text textarea labeled "Service notes, authenticity details"), Condition Notes (free-text). The section is disclosure-based — users who don't care about provenance never see it. Users who do find it where they expect it (on the watch record, not on a separate "portfolio" page).

**divestments table.** When a watch transitions to `status = 'sold'`, the app should optionally prompt for a divestment record: sold date, sold price, notes. This is Layer D's second schema artifact. The sold workflow UI can be a simple follow-on dialog after the status change — one extra step, not a blocking form.

**Complexity:** MEDIUM — 5 new columns on `watches`, 1 new `divestments` table, 1 migration, optional UI section in WatchForm edit mode.

**Depends on:** Layer C (clean-slate DB enables CAT-14 NOT NULL; provenance fields are per-Individual so they belong on `watches`, not `watches_catalog`).

**Not in scope for v5.0: Divestment workflow UI.** The `divestments` table schema lands in v5.0. The UI that captures a divestment record on status change (the "I just sold this watch" flow) may land in v5.0 or be deferred to v5.x. The data model must exist before the recommender milestone, but the UI can follow.

---

## C: Engine Rewire

### C-1: CAT-13 — analyzeSimilarity() reads catalog taste columns at JOIN time

**What it is.** `analyzeSimilarity()` in `src/lib/similarity.ts` currently reads taste attributes (formality, sportiness, heritage_score, primary_archetype, era_signal, design_motifs) from per-user `watches` data only — it cannot see the Phase 19.1 LLM-derived catalog columns unless the user's watch row has been enriched. CAT-13 rewires the engine to JOIN `watches` against `watches_catalog` at query time and feed catalog taste columns into the scoring when available.

**Discovery framing.** Better verdicts produce better evaluative discovery: when a user adds a watch from search or catalog, the CollectionFitCard verdict becomes more accurate because it reads Brand/Family/Reference-level taste signal rather than per-user tag data. This is a discovery improvement, not just tech-debt cleanup.

**Table stakes.** Without CAT-13, the Phase 19.1 taste enrichment columns are wasted. The LLM-derived attributes sit in `watches_catalog` but the scoring engine never reads them. The verdict shown to users is less accurate than the data supports. This is the engine rewire SEED-004 identifies as the "natural anchor" of v5.0.

**Complexity:** MEDIUM — changes to `analyzeSimilarity()` (reading catalog columns via JOIN), likely a new DAL helper to fetch catalog taste data alongside the user's watches, updates to the verdict composer to integrate catalog-level taste when per-user data is sparse or absent.

**Depends on:** Layer A (brand_id/family_id must exist for the JOIN to be meaningful), Layer B (structured movement_type enables movement-dimension scoring), Phase 19.1 taste enrichment columns (already shipped — no new schema).

**Byte-lock note.** `analyzeSimilarity()` has been byte-locked across multiple phases (v4.0). CAT-13 is an intentional, planned break of that lock. The lock served its purpose (preventing accidental mutation); CAT-13 is the planned migration.

### C-2: CAT-14 — SET NOT NULL on watches.catalog_id

**What it is.** After Layer C's clean-slate DB wipe and reseed, every `watches` row has a valid `catalog_id`. CAT-14 drops the nullable constraint and adds `NOT NULL`.

**Why it matters.** The nullable FK was a deliberate choice in Phase 17 ("NEVER SET NOT NULL in v4.0") to avoid blocking the milestone while the backfill ran. Now that clean-slate is on the table, the backfill is provably complete (single-user, small DB). `NOT NULL` enables simpler DAL queries, eliminates null-guard branches, and makes the catalog FK a reliable join target.

**Complexity:** SMALL — one migration statement. Depends entirely on clean-slate Layer C being verified before this lands.

**Depends on:** Layer C (clean-slate DB wipe proves 100% backfill).

---

## D: Discovery Polish

### D-1: Audit-driven surface polish (shapes are TBD until audit runs)

**What it is.** Based on the discovery audit (Phase A-1), specific surfaces receive targeted fixes: dead-end pages get onward navigation, missing affordances get added, redundant paths get differentiated or consolidated. The exact shape of this work is unknown until the audit document is written.

**What research suggests is likely.** Based on the existing surface inventory and common discovery dead-end patterns (Letterboxd UX case studies, Rdio browse analysis), the most likely audit findings for Horlo:

- `/catalog/{catalogId}` likely has insufficient onward navigation to Family or related References.
- `/u/{username}` collection/wishlist tabs likely have no "explore similar watches" affordance after viewing a watch.
- `/watch/{id}` detail likely exits to `/` or back-button only — no "compare" or "similar References" forward path.
- `/explore` Trending/Gaining rails link to catalog detail, but catalog detail may not link back into explore rails.

**Table stakes for any dead-end fix:** Every non-terminal page must have at least one forward navigation option. "Back" is not a forward option — it's a retreat. The audit defines which pages fail this test; the polish phase closes them.

**Complexity:** MEDIUM — unknown until audit, likely 2-4 targeted surface fixes.

**Depends on:** Phase A-1 discovery audit producing its decisions doc.

### D-2: DISC-09 — /explore Editorial Featured Collection

**What it is.** A manually curated editorial slot on `/explore` that surfaces a "Featured Collection" — a hand-picked set of watches organized around a theme (e.g., "Entry-level dress watches under 38mm", "Tool watches with documented lineage"). This is the Letterboxd HQ Lists / Spotify Editorial Playlists analog for Horlo.

**How Letterboxd does it (MEDIUM confidence — from Letterboxd journal article).** Letterboxd's Featured Lists are hand-curated by the Letterboxd team and surfaced on a dedicated `/lists/featured/` page. Any member can make a list; featured designation is editorial. Key patterns: the featured collection has a title, a short editorial description (2-3 sentences), a curator attribution, and an ordered list of items. Featured lists appear in a dedicated module on the discovery surface — not mixed with algorithmic rails.

**Table-stakes version (v5.0 scope).** A single Featured Collection slot on `/explore`, admin-only creation via a simple internal form or admin route. Fields: title, description (2-3 sentences), curator name, ordered list of `catalog_id` references (up to 12). The slot renders as a horizontal scroll rail with a title + description above it.

**Anti-feature: Full admin CMS.** Do not build a full admin CMS with rich text, scheduling, image upload, or A/B testing for this slot. The editorial rhythm is infrequent (weekly or monthly); a minimal admin form is sufficient. Build the simplest thing that makes curation possible.

**Anti-feature: Algorithmic "featured" determination.** The editorial slot must be manually curated. An algorithmic "staff picks" that selects from trending data is a different feature (and may conflict with existing Trending/Gaining rails). Keep the editorial slot explicitly human-curated and distinct.

**Complexity:** MEDIUM — new DB table for featured collections (title, description, curator, ordered catalog IDs, published_at, expires_at), admin route for CRUD, rail component on `/explore`.

**Depends on:** Existing `/explore` surface, existing `watches_catalog` table. Does NOT require catalog hierarchy layers to ship (can reference flat catalog rows by ID). Layer A is helpful (Family can be used as the editorial organizing principle) but not blocking.

### D-3: SRCH-16 — Search facets (Movement / Case size / Style) on /search Watches tab

**What it is.** Faceted filtering on the existing `/search` Watches tab. Three facets: Movement type (auto/manual/quartz/spring_drive — structured enum after Layer B), Case size (numeric range slider or chip group: under 36mm / 36-39mm / 40-42mm / over 42mm), Style tags (existing `styleTags` array — multi-select chips).

**Table-stakes UX pattern.** Based on NN/Group, Algolia, and pencil-and-paper mobile filter research (HIGH confidence): on mobile, facets belong in a bottom drawer or modal (not a persistent sidebar), opened by a single "Filters" button. Selected filter counts appear on the button. Chips are correct for Movement type (3-4 categorical values) and Style tags (multi-select). Case size: a pre-defined chip group ("Under 36mm / 36-39mm / 40-42mm / 43mm+") is more mobile-friendly than a range slider at this small a value set. Apply button is sticky at bottom of the drawer; tapping Apply closes the drawer and fires the search.

**Differentiator addition.** Show the active filter count on the Filters button. Highlight which facets have active selections inside the drawer (e.g., dot indicator on the Movement chip group label).

**Anti-feature: Sidebar facets.** A persistent left-sidebar facet panel is the e-commerce pattern, not the collector-app pattern. Horlo's search surface is narrow (max-w-3xl per current search page); a sidebar would crush the result list on mobile. Drawer only.

**Anti-feature: Free-text movement filter.** Movement must be faceted against the structured `movement_type` enum (requires Layer B). Do not ship SRCH-16 against the existing free-text `movement` column — the facet would produce inconsistent results ("automatic" vs "Automatic" vs "ETA 2824-2"). **SRCH-16 depends on Layer B landing first.** If Layer B is delayed, SRCH-16 must be deferred.

**Complexity:** MEDIUM — filter drawer component, facet state in URL params (shareable filtered search URLs), DAL updates to `searchCatalogWatches` to accept facet filters.

**Depends on:** Layer B (structured movement_type enum), existing `/search` Watches tab (Phase 19).

### D-4: FIT-05 — Pairwise drill-down inside CollectionFitCard

**What it is.** A "Compare with [Watch You Own]" action inside the CollectionFitCard. Currently the "Most Similar in Collection" list shows watch names and similarity scores (percent similar). FIT-05 deepens this: clicking a watch from the Most Similar list opens a pairwise comparison view showing both watches side-by-side with their key attributes and taste-attribute deltas.

**What research says about comparison UX (NN/Group — HIGH confidence).** Best practices: products as columns, attributes as rows, max 2 items on mobile. Keep sticky headers. Show only attributes that differ (hide rows where both values are identical). Brief text — not full sentences. On mobile, 2-column comparison is the limit without scrolling off-screen.

**Recommended pattern for FIT-05.** Two-panel layout: left column is the watch being evaluated (the "new" watch), right column is the owned watch being compared. Rows: Brand/Model/Reference, Case size, Movement type, Style tags (as chips), Taste attributes (formality/sportiness as labeled bars, not raw numbers). A "delta" row at the bottom summarizing the key difference: "This watch is more formal (+0.3) and less sporty (−0.2) than your [Submariner]." The pairwise view renders inside the CollectionFitCard as an expandable section (accordion), not a new page — keeping the user in context.

**Anti-feature: Full spec-table comparison.** Do not show all 20+ columns from the watches table in the comparison. Show only the dimensions that the similarity engine weights: case size, movement type, style tags, role tags, and taste attributes. Full spec tables are the e-commerce pattern (laptop comparisons, airline seats); collector comparison is about taste alignment, not spec parity.

**Anti-feature: Three-way or N-way comparison.** FIT-05 is explicitly pairwise — the evaluated watch vs. one owned watch. N-way comparison compounds cognitive load exponentially and is not motivated by the use case (a collector deciding whether a new watch duplicates their collection picks the most similar watch to compare against, not all similar watches simultaneously).

**Complexity:** MEDIUM — new comparison sub-component in CollectionFitCard, taste attribute delta calculation, accordion expansion state.

**Depends on:** Existing `CollectionFitCard` with `mostSimilar` list (Phase 20), CAT-13 (taste attributes from catalog JOIN — without CAT-13, taste-attribute rows in the comparison will be sparse). FIT-05 can ship without CAT-13 but the taste-attribute rows will be empty for many watches. **Recommended: ship FIT-05 after CAT-13.**

---

## E: Carryover / Polish

### E-1: DEBT-09 — notesPublic + revalidatePath regression fix

**What it is.** `addWatch`/`editWatch` in `src/app/actions/watches.ts` do not persist `notesPublic` and do not call `revalidatePath('/u/{username}/{tab}')`. WatchForm sends `notesPublic` but Zod silently strips it (no schema field). RED test scaffold (`tests/actions/watches.notesPublic.test.ts`) is 4/4 FAIL. Surfaced by Phase 31 audit.

**Complexity:** SMALL — add `notesPublic` to Zod schema in `addWatch`/`editWatch`, add `revalidatePath` call. Fix the 4 failing tests. Verifiable by the existing RED test scaffold.

**Depends on:** Nothing new — the test scaffold already exists.

### E-2: SET-13 — Account Delete / Wipe Collection (Danger Zone)

**What it is.** Two distinct destructive operations under a "Danger Zone" section in Settings → Account tab: (1) Wipe Collection — delete all watches but keep the account; (2) Delete Account — delete the account and all data.

**UX pattern (GitHub model — HIGH confidence from search results).** The standard pattern is: Danger Zone section at the bottom of the account settings page, visually separated (red border, warning icon). Each action requires a multi-step confirm: (a) click the action button, (b) read a consequence description ("This will permanently delete your collection of N watches and cannot be undone"), (c) type the account username or a confirmation phrase to enable the final button, (d) final destructive button. GitHub uses this for account deletion; Vercel uses a simpler "type your username" single-confirm. Reddit's pattern includes a 30-day grace period before hard deletion.

**Recommended pattern for Horlo.** For Wipe Collection: two-step confirm (modal with consequence count + "Type your username to confirm" text input). For Delete Account: three-step confirm (modal → consequence list → "Type DELETE to confirm" text input). No grace period needed for Wipe Collection (reversible via re-adding watches). For Delete Account: soft-delete with a 30-day recovery window is the safe pattern, but at Horlo's scale (single user) an immediate hard delete of the Supabase Auth user + all data is acceptable — simpler to implement and no ambiguity for the user. Document the choice in CONTEXT.md.

**Anti-feature: "Delete without confirming."** Any destructive operation that does not require explicit typed confirmation is a UX anti-pattern. The friction is intentional.

**Anti-feature: Wipe + Delete in the same button.** Keep them separate. A collector who wants to start over (wipe collection) may not want to delete their account, and vice versa.

**Complexity:** SMALL-MEDIUM — new Danger Zone section in Settings Account tab, two confirmation dialogs, two Server Actions (wipeCollection, deleteAccount) with proper auth checks.

**Depends on:** Existing Settings Account tab (Phase 22), Supabase Auth user deletion API.

### E-3: SET-14 — Branded HTML email templates

**What it is.** Replace Supabase Auth's default email templates (plain text / generic HTML) with Horlo-branded HTML templates for: Confirm signup, Reset Password, Email Change.

**Table-stakes pattern (Tabular.email research — HIGH confidence).** Required elements: (a) logo centered at top (the "anchor of trust"), (b) brief subject-relevant greeting, (c) 1-2 sentences of context, (d) single CTA button (44px min height, primary brand color, strong verb: "Confirm your email" / "Reset your password" / "Confirm email change"), (e) plaintext fallback link below the button for email clients that block images, (f) footer with legal name + physical address + unsubscribe link. Brand colors used ONLY on logo and CTA. All other elements neutral (off-white background, dark text). Single-column, max 600px width.

**Anti-feature: Marketing content in transactional emails.** Do not add feature announcements, "check out what's new," or other promotional content to auth emails. Transactional emails have a single job; promotional content dilutes trust and increases spam scoring.

**Anti-feature: Multiple CTAs.** Each auth email has exactly one CTA. No secondary links beyond the plaintext fallback.

**Implementation note.** Supabase Auth templates are set in the Supabase project dashboard under Authentication → Email Templates. The template is raw HTML with Supabase template variables (`{{ .TokenHash }}`, `{{ .SiteURL }}`). The existing SMTP setup (Phase 21, Resend via `mail.horlo.app`) is already in place — this task is UI/HTML only.

**Complexity:** SMALL — HTML/CSS email templates (3 templates: confirm, reset, email change). No code changes to Next.js app or DB.

**Depends on:** Phase 21 SMTP setup (already shipped — Resend custom domain `mail.horlo.app` live).

### E-4: Nyquist hardening sweep

**What it is.** Close the 4/5 partial Nyquist coverage from v4.1 (Phases 27/28/30/31) and the two phases with no VALIDATION.md (25/26). Also address drift from v3.0+ phases flagged in PROJECT.md active items.

**Complexity:** SMALL-MEDIUM — primarily documentation + targeted test additions for missing wave_0 coverage.

**Depends on:** Phase execution in v5.0 — best done as a sweep phase near the end of the milestone rather than on each individual phase.

### E-5: ~33 deferred UAT items (Phases 18/20/20.1/22/23)

**What it is.** Triage the ~33 deferred human UAT items. Many in Phase 20.1 are likely overtaken by gap-closure plans 06/07/08. The triage step determines which items are: (a) already resolved, (b) still open and reproduced, (c) superseded by v5.0 changes and need re-evaluation after.

**Complexity:** SMALL per item, variable total — depends on triage outcome.

**Depends on:** Audit-driven polish phases landing first (many UAT items touch surfaces that v5.0 polish will change).

---

## Feature Landscape Summary

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Category |
|---------|--------------|------------|----------|
| Discovery audit with falsifiable pass/fail criteria | Rdio-style click-driven discovery is the North Star — can't declare it achieved without measuring it | SMALL | A |
| Brand + Family entities (schema) | Collector mental model starts with Brand and Family, not flat Reference list | SMALL | B |
| Lineage edges (schema) | Collectors know Submariner lineage; surfacing predecessor/successor is expected behavior | MEDIUM | B |
| Structured movement type (enum) | Free-text movement blocks faceted search | MEDIUM | B |
| CAT-13 engine reads catalog taste | Taste enrichment columns sitting unused is an invisible quality gap | MEDIUM | C |
| Search facets (Movement/Case size/Style) | Every collector catalog app has faceted search; /search Watches without facets feels incomplete | MEDIUM | D |
| Account delete / Wipe collection (Danger Zone) | Every SaaS account settings page has a Danger Zone | SMALL-MEDIUM | E |
| Branded auth emails | Default Supabase emails signal "unfinished product" | SMALL | E |
| DEBT-09 notesPublic regression fix | Published notes not persisting is a data loss bug | SMALL | E |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Category |
|---------|-------------------|------------|----------|
| FIT-05 pairwise drill-down | Taste-attribute delta between evaluated watch and most-similar owned watch is Horlo-native; Watch Charts/Chrono24 have no equivalent | MEDIUM | D |
| Lineage browse / Family pages | Collector UX organized by Reference lineage (5513→1680→16800→16610→116610) has no analogue in current watch apps; Discogs has it for music | MEDIUM | B+D |
| CAT-13 verdict quality from catalog taste | Verdict accuracy using LLM-derived formality/sportiness/archetype at Reference granularity is architecturally ahead of any watch marketplace | MEDIUM | C |
| DISC-09 editorial featured collection | Letterboxd-style human-curated discovery slot differentiates from algorithmic-only explore | MEDIUM | D |
| Layer D provenance fields (Individual level) | Serial/box+papers/service history as a collector's diary that compounds with time is genuinely Horlo-native | MEDIUM | B |

### Anti-Features (Do Not Build in v5.0)

| Anti-Feature | Why Requested | Why Not | What Instead |
|--------------|---------------|---------|--------------|
| Home + Explore merger (pre-audit) | Feels like duplication to look at | The audit may find they serve distinct jobs; merging before evidence destroys a valid distinction | Let the audit decide |
| Automated lineage inference | Seems like it would save manual curation effort | Will generate wrong edges (same numeric prefix ≠ same lineage) | Manual curation only |
| Variant enumeration at seeding | "Complete" catalog feels more professional | Premature completeness fragments the Reference-level social graph; Variants should grow organically | Reference-only seeding, Variants organic |
| Recommender or personalized explore rails | Would make discover feel smarter | SEED-002 prereqs unmet; would require onboarding cold-start (SEED-003) simultaneously | v6.0+ milestone |
| Onboarding flow | Helps new users get started | SEED-003 pairs with recommender, not discovery | Post-recommender milestone |
| Market value / portfolio valuation | Watch Charts has it free | Watch Charts does this better for free; charging or building it now is a non-starter | v6.0 milestone (SEED-005) |
| Paywall / subscription tier | Revenue | SEED-006 resolved: no paywall in v5.0; worst pattern is gating the differentiator | Everything ships free |
| Full admin CMS for editorial | "Real" editorial tooling | Infrequent editorial cadence doesn't justify CMS complexity | Minimal admin form or dev-only seeding |
| Multiple CTAs in auth emails | Want to promote the product | Dilutes trust, increases spam scoring | Single-CTA, transactional only |
| N-way watch comparison | "Compare all similar watches" | Cognitive load compounds; pairwise is the right granularity | FIT-05 pairwise only |
| Slider for case size filter | "More precise than chips" | At the 30-50mm range with 5 meaningful bands, chips are faster to tap than a slider | Pre-defined size chip group |
| Wipe + Delete as a single button | Simpler UI | Collectors who want a fresh start may not want to lose their account | Keep them separate with distinct confirms |

---

## Feature Dependencies

```
Layer A (brands + families)
    └──required by──> Layer B (lineage edges scoped to family)
                          └──required by──> Layer C (clean-slate with correct Reference granularity)
                                               └──required by──> CAT-14 (NOT NULL after 100% backfill)
                                               └──required by──> Layer D (provenance on well-linked individuals)

Layer B (structured movement_type enum)
    └──required by──> SRCH-16 (Movement facet needs enum, not free-text)

CAT-13 (catalog taste JOIN)
    └──enhances──> FIT-05 (taste-attribute rows in pairwise comparison are populated)
    └──required by──> FIT-05 (for taste-attribute delta to be non-empty for most watches)

Discovery Audit (A-1)
    └──required by──> Audit-Driven Polish (D-1) — audit shapes the work

Phase 21 SMTP (already shipped)
    └──required by──> SET-14 (branded email templates use existing Resend route)

DEBT-09 fix
    └──independent (no blockers)

SET-13 Account Delete
    └──independent (no blockers beyond existing Settings Account tab, Phase 22)
```

### Dependency Notes

- **SRCH-16 requires Layer B:** Movement facet against free-text `movement` column produces inconsistent results. Defer SRCH-16 if Layer B slips.
- **FIT-05 should follow CAT-13:** Can technically ship without CAT-13, but the taste-attribute comparison rows will be empty for most watches. Shipping FIT-05 before CAT-13 produces a degraded experience.
- **Layer C (Variant split) requires clean-slate DB wipe:** This is safe only because of single-user context. Do not attempt Layer C without documenting the wipe in CONTEXT.md and verifying the owner's explicit consent.
- **CAT-14 requires Layer C verification:** Two consecutive deploys with 100% backfill confirmed per PROJECT.md; clean-slate makes this feasible inside v5.0.
- **Audit-driven polish (D-1) cannot be scoped until A-1 ships:** Do not write implementation plans for discovery polish before the audit document exists.

---

## What Must Not Ship in v5.0

| Feature | Blocking Prereq | Correct Milestone |
|---------|----------------|-------------------|
| Recommender (SEED-002) | Catalog hierarchy, sold-signal schema, cold-start density | v6.0+ |
| Onboarding cold-start (SEED-003) | Recommender | Post-recommender milestone |
| Market value / portfolio (SEED-005) | Pricing API spike (SEED-007) | v6.0 |
| Subscription tier / Stripe / entitlements | SEED-006 resolved: no paywall | Never (until recommender is serviceable + wedge proven) |
| CAT-14 SET NOT NULL before Layer C clean-slate | Layer C must ship and be verified first | Late in v5.0, not early |
| SRCH-16 Movement facet without Layer B | Free-text movement column produces bad facet results | After Layer B |

---

## Feature Prioritization Matrix

| Feature | User Value | Cost | Priority |
|---------|------------|------|----------|
| DEBT-09 notesPublic fix | HIGH (data loss bug) | LOW | P1 |
| Discovery audit (A-1) | HIGH (shapes all polish) | LOW | P1 |
| Layer A Brand+Family schema | HIGH (foundation) | LOW | P1 |
| Layer B lineage+movement | HIGH (unblocks SRCH-16 + FIT-05 quality) | MEDIUM | P1 |
| CAT-13 engine rewire | HIGH (verdict quality) | MEDIUM | P1 |
| Layer C Variant split | HIGH (Reference integrity) | HIGH | P1 |
| Audit-driven polish (D-1) | HIGH (shaped by audit) | MEDIUM | P1 |
| SET-14 branded emails | MEDIUM (polish/trust) | LOW | P2 |
| SET-13 account delete | MEDIUM (table-stakes SaaS) | MEDIUM | P2 |
| FIT-05 pairwise drill-down | HIGH (differentiator) | MEDIUM | P2 |
| DISC-09 editorial featured | MEDIUM (discovery quality) | MEDIUM | P2 |
| SRCH-16 search facets | MEDIUM (catalog usability) | MEDIUM | P2 |
| Layer D provenance schema | MEDIUM (SEED-002 prep) | MEDIUM | P2 |
| CAT-14 NOT NULL | LOW (tech-debt cleanup, enabled by Layer C) | LOW | P3 |
| Nyquist sweep | LOW (test coverage quality) | MEDIUM | P3 |
| UAT triage (~33 items) | LOW-MEDIUM (depends on triage) | VARIABLE | P3 |

**Priority key:** P1 = ships in v5.0 core wave; P2 = ships in v5.0 but after P1 blockers clear; P3 = late-v5.0 or v5.x polish.

---

## Sources

- SEED-001 catalog hierarchy seed (`.planning/seeds/SEED-001-catalog-hierarchy-and-attributes.md`) — Reference granularity rationale, Variant fragmentation analysis
- SEED-004 v5.0 Discovery North Star (`.planning/seeds/SEED-004-v5-discovery-north-star.md`) — audit-first ordering, CAT-13 framing
- PREMIUM-MAP.md (`.planning/research/PREMIUM-MAP.md`) — no-paywall constraint
- PROJECT.md v5.0 milestone section — target features, hard constraints
- Discogs Master Release UX model — hierarchy (Master/Release = Reference/Variant analogue) — [Discogs Database Guidelines 16](https://support.discogs.com/hc/en-us/articles/360005055493-Database-Guidelines-16-Master-Release)
- NN/Group comparison tables — [Comparison Tables for Products, Services, and Features](https://www.nngroup.com/articles/comparison-tables/)
- Pencil & Paper mobile filter patterns — [Mobile Filter UX Design Patterns & Best Practices](https://www.pencilandpaper.io/articles/ux-pattern-analysis-mobile-filters)
- Tabular.email transactional email design — [How to Design Transactional Emails That Build Trust](https://tabular.email/blog/how-to-design-transactional-emails)
- Letterboxd Featured Lists model — [There's a List for That!](https://letterboxd.com/journal/featured-lists-explainer/)
- GitHub account deletion Danger Zone pattern — [community discussion #135123](https://github.com/orgs/community/discussions/135123)
- Algolia search filter UX — [Search Filters: 5 Best Practices](https://www.algolia.com/blog/ux/search-filter-ux-best-practices)
- Rdio UX analysis — musicux.com (2016) and Bryan Clark, Medium — Rdio's browse experience as the click-driven discovery reference

---

*Feature research for: Horlo v5.0 Discovery North Star*
*Researched: 2026-05-06*
