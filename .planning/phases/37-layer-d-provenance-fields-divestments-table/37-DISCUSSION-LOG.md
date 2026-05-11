# Phase 37 — Discussion Log

**Phase:** 37 — Layer D — Provenance Fields + Divestments Table
**Date:** 2026-05-11
**Mode:** default (4 selected areas + 2 follow-ups, single-question turns)
**Outcome:** CONTEXT.md committed; 15 decisions captured (D-01 through D-15) plus carry-forward inheritance from Phases 17 / 34 / 35 / 36.

---

## Pre-Discussion Framing (Claude → User)

Phase 37 is "Layer D" of the v5.0 catalog hierarchy serial. **What it ships:**

1. 7 provenance columns on `watches` (serial, year_of_acquisition, condition, box_papers, service_history, paid_currency, purchase_date) — all nullable; existing rows unaffected
2. New `divestments` table for structured sold records (timestamped + price + replacement link + notes)
3. Server Action that writes a divestment row when status flips `owned → sold` (`watches.status = 'sold'` also kept for UI display — dual-write)
4. WatchForm gains a collapsed "Collector's Record" disclosure exposing the 7 provenance fields (edit page only)

**Why we need it:**
- `watches.status = 'sold'` is a single bit — no timestamp, no price, no replacement link. Future SEED-002 recommender needs a timestamped sold signal for temporal decay
- Provenance fields are what makes Horlo a collector's tool, not a watch-tracker — a 1985 Sub with box/papers ≠ a 2020 Sub serviced twice
- Sets up v6.0 SEED-005 market-value math: paid_price + paid_currency + purchase_date + condition + box_papers + sale_price + sale_currency

**Value to the user:**
- Each watch captures its specific history (serial, condition, service, papers)
- Sold watches become part of the collector's story (not silent deletions)
- Data shape ready for the recommender + market-value engines that follow

**Explicitly deferred** (per ROADMAP success #5 + this discussion):
- Divestment dialog UI ("I just sold this watch" post-status flow) → v5.x
- `replaced_by_catalog_id` UI capture → depends on the dialog → v5.x
- Drizzle `watches.catalogId .notNull()` tightening → Phase 38 (inherited from Phase 36 Plan 01 Rule 4)

---

## Areas Discussed

User selected all 4 areas at the initial menu:

1. year_of_acquisition vs acquisition_date
2. Sold-watch visibility in /collection
3. paid_currency strictness
4. Disclosure UI primitive

Two adjacent follow-ups added during discussion (D-04 sale_currency and D-06 condition).

---

## Area 1: year_of_acquisition vs existing acquisition_date

**Question (single turn):** How should year_of_acquisition relate to the existing watches.acquisition_date column?

**Options presented:**
1. Both coexist; user fills either (zero migration; year for "got it in 90s, don't remember date")
2. Year replaces date entirely (migrate text → year; lose precision)
3. Convert date → real DATE type, add year as fallback (more structured; migration risk)
4. Drop acquisition_date; year_of_acquisition + purchase_date together cover both (two new cols replace one old)

**User selection:** Option 1 — Both coexist; user fills either

**Captured as:** D-01 — existing `watches.acquisition_date` (text) preserved unchanged; new `year_of_acquisition` (int) is additive; new `purchase_date` (date) is the exact-date companion; UI prefers exact date when present, falls back to year. Zero migration risk.

---

## Area 2: Sold-watch visibility in /collection

**Question (single turn):** When a watch is sold, where does it live in /collection?

**Options presented:**
1. Stays visible with sold badge; existing status filter chip controls visibility (reuses existing chip infrastructure)
2. Hidden from /collection by default; opt-in filter to show
3. Separate 'Past Collection' / sold-archive surface (new page/tab)
4. Visible but dimmed/greyscale; clicking opens a read-only past-watch view

**User selection:** Option 1 — Stays visible with sold badge; existing status filter chip controls visibility

**Captured as:** D-14 — Sold watches stay in the `/collection` grid with a sold badge treatment (planner reads existing WatchCard badge patterns). Existing FilterBar status chip group governs visibility. No new surface. No DAL change. D-14a default-filter-chip-state question deferred to Phase 39 polish or v5.x.

---

## Area 3: paid_currency strictness

**Question (single turn):** How strict should paid_currency be?

**Options presented:**
1. pgEnum of ~10-15 common watch-collecting currencies (mirror Phase 35 movement_type pattern; schema-enforced)
2. Text + CHECK constraint with same short list (similar but easier to extend via DROP/CREATE CHECK)
3. Free text + UI chip selector for top currencies (UI guidance, no DB constraint)
4. Plain text, no UI guidance

**User selection:** Option 1 — pgEnum of common currencies

**Captured as:** D-03 — pgEnum `currency_code` with values `USD, EUR, GBP, JPY, CHF, AUD, CAD, HKD, SGD, CNY` (10 codes covering Swiss/Japanese/UK/EU/major-Asian markets). UI chip selector when price_paid is set. Schema-enforced determinism for v6.0 market-value math.

---

## Follow-up: divestments.sale_currency

**Question (single turn):** ROADMAP specifies divestments.sale_price but doesn't list a sale_currency. How should divestment currency work?

**Options presented:**
1. Add divestments.sale_currency using the same pgEnum (additive beyond ROADMAP letter; provenance-accurate)
2. Assume sale_currency = watches.paid_currency at sell-time (no new column; lies about reality on cross-currency sales)
3. Add divestments.sale_currency as nullable text (no enum) — mismatches strict pgEnum decision for paid_currency

**User selection:** Option 1 — Add divestments.sale_currency using the same pgEnum

**Captured as:** D-04 — `divestments.sale_currency` added as additive column (NOT in original ROADMAP letter) using the same `currency_code` pgEnum as `watches.paid_currency`. Nullable. Reason: a watch bought in USD and sold in EUR records the EUR price honestly; assumption-based currency would lie.

---

## Area 4: Disclosure UI primitive

**Question (single turn):** Which primitive should the 'Collector's Record' disclosure on WatchForm use?

**Options presented:**
1. shadcn Accordion (matches CollectionFitCard already in codebase)
2. Native HTML <details>/<summary> (zero JS, native semantics)
3. base-ui Disclosure (@base-ui/react in project)
4. Custom button + conditional render

**User selection:** Option 1 — shadcn Accordion

**Captured as:** D-15 — "Collector's Record" disclosure uses shadcn Accordion (single-section, collapsed by default). Mirrors CollectionFitCard accordion already in the app. Full keyboard a11y; consistent dark-mode visual treatment.

---

## Follow-up: condition + service_history shape

**Pre-question (single turn):** Wrap up vs quick-lock condition + service_history?

**User selection:** Quick lock (1 more question on condition; service_history defaulted to free text)

**Question (single turn):** Should 'condition' be a strict industry-grade pgEnum or free text?

**Options presented:**
1. Strict pgEnum: Mint / Near Mint / Excellent / Good / Fair / Poor (industry standard)
2. Free text (mirrors Phase 35 D-10/D-11 precedent for subjective fields)
3. Pre-set chip UI + free text fallback

**User selection:** Option 1 — Strict pgEnum with 6 industry grades

**Captured as:**
- **D-02 (condition):** pgEnum `condition_grade` with `mint, near_mint, excellent, good, fair, poor`. Industry standard for Chrono24/WatchUSeek/dealer listings; v6.0 market-value math needs structured input.
- **D-06 (service_history):** Free text, single nullable text column. Mirrors `watches.notes` pattern. No structured shape.

---

## Decisions Captured (final list)

| ID | Topic | Decision |
|---|---|---|
| D-01 | year_of_acquisition vs acquisition_date | Both coexist; UI prefers exact date when present |
| D-02 | condition | pgEnum (6 industry grades: mint/near_mint/excellent/good/fair/poor) |
| D-03 | paid_currency | pgEnum (10 codes: USD/EUR/GBP/JPY/CHF/AUD/CAD/HKD/SGD/CNY) |
| D-04 | divestments.sale_currency | Additive column; same currency_code pgEnum; nullable |
| D-05 | box_papers | pgEnum (4 ROADMAP-locked values: none/box_only/papers_only/full_set) |
| D-06 | service_history | Free text (mirrors watches.notes) |
| D-07 | serial | Free text, no validation |
| D-08 | purchase_date | Postgres native date type |
| D-09 | divestments table shape | 9-column shape with PK + 2 FKs to watches_catalog + FK to users + timestamps + indexes |
| D-10 | divestments RLS | Per-user (auth.uid() = user_id) on SELECT/INSERT/UPDATE/DELETE |
| D-11 | recordDivestment Server Action | Mirrors updateWatch action pattern; dual-write (insert divestment row + UPDATE watches.status='sold') |
| D-12 | Status-transition trigger point | Existing StatusToggle/select wires the action; Phase 37 calls with empty metadata; v5.x dialog backfills |
| D-13 | divestments cardinality | Soft 1:1 with watch (no UNIQUE constraint); FK links via catalog_id (cross-collector-friendly) |
| D-14 | Sold-watch /collection visibility | Stays visible with sold badge; existing filter chip controls; no new surface |
| D-14a | Default filter chip selection | Deferred to Phase 39 polish or v5.x |
| D-15 | Disclosure UI primitive | shadcn Accordion (matches CollectionFitCard) |

---

## Deferred Ideas

- Divestment dialog UI (ROADMAP-locked deferred to v5.x)
- `replaced_by_catalog_id` UI capture (depends on dialog)
- v6.0 market-value math consuming divestments + paid_currency (SEED-005)
- SEED-002 recommender consuming divestments.divested_at for temporal decay
- Drizzle `watches.catalogId .notNull()` tightening (Phase 38 owns the DAL flow rewrite)
- Default filter chip selection ("show sold by default") — Phase 39 polish or v5.x
- Structured service_history (JSON list of {date, service_type, provider}) — future enrichment
- Serial format validation per brand — future enrichment
- Soft-delete / archive for sold watches — explicitly NOT needed per D-14
- Sold-watch read-only edit mode — not needed; collectors may update provenance after sale

---

## Claude's Discretion (handed off to planner)

- Migration filename exact 14-digit timestamp (greater than 20260511000000)
- Drizzle migration filename + journal idx=10
- pgEnum naming (`condition_grade`, `currency_code`, `box_papers_status` — renameable if cleaner convention emerges)
- Server Action file location (existing watches.ts vs new divestments.ts)
- Server Action input zod schema exact shape
- WatchCard sold badge visual treatment (chip vs strikethrough vs corner ribbon)
- WatchForm provenance field grouping within the Accordion body (acquisition info → condition+papers → financials → service_history)
- Plan count + wave grouping (informational target: 3 waves, 4-5 plans)

---

*Phase 37 context: ready for planning.*
