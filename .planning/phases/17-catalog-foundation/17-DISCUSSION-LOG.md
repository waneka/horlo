# Phase 17: Catalog Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-27
**Phase:** 17-catalog-foundation
**Areas discussed:** Identity & normalization, Catalog field scope + imageUrl, Source provenance & enrichment, Backfill + cron operations

---

## Identity & Normalization

### Q1: How should the natural-key UNIQUE handle nullable `reference`?

| Option | Description | Selected |
|--------|-------------|----------|
| NULLS NOT DISTINCT | PG 15+ syntax. Two `(Rolex, Submariner, NULL)` rows collide and dedup. Cleaner SQL; verify Drizzle introspection. | ✓ |
| COALESCE fallback | `UNIQUE (..., COALESCE(reference_n, ''))`. Works on any PG. Uglier; need CHECK to forbid empty-string refs. | |
| Make reference NOT NULL | Forbids refless catalog rows. Cleanest UNIQUE; breaks vintage/dressy pieces. | |

**User's choice:** NULLS NOT DISTINCT (Recommended)

---

### Q2: Where does brand/model/reference normalization happen?

| Option | Description | Selected |
|--------|-------------|----------|
| Postgres generated columns | DB-enforced `brand_normalized GENERATED ALWAYS AS (lower(trim(brand))) STORED`. Source columns keep display casing. Impossible to bypass. | ✓ |
| App-level only | Helper lowercases before insert. Source columns store normalized form (loses display casing). Future code paths bypassing helper break dedup silently. | |
| Hybrid (raw + normalized columns) | Both columns writeable, no GENERATED clause. Helper writes both. Max flexibility, max rope. | |

**User's choice:** Postgres generated columns (Recommended)

---

### Q3: How aggressive should reference normalization be?

| Option | Description | Selected |
|--------|-------------|----------|
| lower + trim only | `116610LN` and `116610ln` collapse. `116610 LN` and `116610-LN` stay distinct. | |
| lower + trim + strip whitespace/punctuation | All four variants collapse to `116610ln`. Risks merging refs where punctuation matters (Patek `5711/1A`). | ✓ |
| lower + trim + alphanumeric only | Most aggressive. Best dedup hit rate; highest risk of collapsing distinct vintage refs. | |

**User's choice:** lower + trim + strip whitespace/punctuation (medium aggressiveness)

---

### Q4: Should the catalog `source` be CHECK or pgEnum?

| Option | Description | Selected |
|--------|-------------|----------|
| CHECK constraint on text | Cheap to evolve via DROP/ADD CONSTRAINT. Avoids the rename+recreate dance Phase 24 is cleaning up. Add TS literal union manually. | ✓ |
| Drizzle pgEnum | Auto-generates TS literal union. Type-safer; same Phase 24-style migration pain if values change. | |

**User's choice:** CHECK constraint on text (Recommended)

---

## Catalog Field Scope + imageUrl

### Q1: When typed input creates a NEW catalog row, what gets written?

| Option | Description | Selected |
|--------|-------------|----------|
| Natural key only | Only `(brand, model, reference, source='user_promoted')`. URL extraction enriches later via COALESCE. Lowest typo risk. | ✓ |
| Natural key + tags | Add `styleTags`, `designTraits`, `roleTags` (lower typo risk than spec numbers). Catalog richer immediately. | |
| Full spec sheet from typed input | Write everything user typed. Catalog populates fast. **High typo risk.** | |

**User's choice:** Natural key only (Recommended)

---

### Q2: Where does `imageUrl` live?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-user only — no catalog imageUrl | `watches.imageUrl` stays. Catalog has no imageUrl. /search and /explore render generic icon or fallback. | |
| Catalog imageUrl, URL-extract enriches | Catalog has `image_url`, populated via URL extract COALESCE. Per-user `watches.imageUrl` overrides for that user's display. | ✓ |
| Catalog imageUrl curated only | Catalog has `image_url` but only `admin_curated` writes set it. Highest quality bar; needs admin tooling. | |

**User's choice:** Catalog imageUrl, URL-extract enriches
**Notes:** "Would be ideal if image upgrades when source is more reliable (brand website > retailer); admin override desired eventually." Captured as deferred work; columns added now to support future smart-replace logic.

---

### Q3: How does `dialColor` slot in?

| Option | Description | Selected |
|--------|-------------|----------|
| Catalog SPEC field | Different references = different rows (`116610LN` vs `116610LB`). Aligns with real SKUs. | ✓ |
| Per-user only — NOT in catalog | Catalog has one Submariner row; each user's dialColor is theirs. Loses /search dial filtering. | |
| Both — catalog AND per-user | Most flexible, most complex. Probably overkill. | |

**User's choice:** Catalog SPEC field (Recommended)

---

### Q4: Single `productionYear` vs `start` + `end` range?

| Option | Description | Selected |
|--------|-------------|----------|
| Single `productionYear` | Matches existing `watches.productionYear`. | ✓ |
| Range `start` + `end` | Reflects reference production windows. Adds two columns; breaks parity with `watches`. | |

**User's choice:** Single `productionYear` (Recommended)
**Notes:** "Lots of vintage pieces won't have an exact date — need a way to mark estimated." Addressed via additional `production_year_is_estimate` boolean (see Q6 below).

---

### Q5: How far do we go with image-source quality in v4.0?

| Option | Description | Selected |
|--------|-------------|----------|
| Add columns now, defer logic | Add `image_url`, `image_source_url`, `image_source_quality`. Smart-replace logic deferred to v5+. | ✓ |
| Add columns + brand allowlist + tier-aware COALESCE now | Ship full smart-replace logic in Phase 17. More work; product-visible payoff. | |
| Just `image_url`, defer everything else | Single column, no provenance. Future quality work means a real migration later. | |

**User's choice:** Add columns now, defer logic (Recommended)

---

### Q6: Production-year precision shape?

| Option | Description | Selected |
|--------|-------------|----------|
| `production_year_is_estimate` boolean | Lightest touch. Easy to back-port to per-user `watches`. | ✓ |
| `production_year_precision` text CHECK enum | Three states: `'exact' | 'estimated' | 'unknown'`. Richer; more code. | |
| Skip in v4.0 | Add later when vintage workflows actually need it. | |

**User's choice:** `production_year_is_estimate` boolean (Recommended)

---

## Source Provenance & Enrichment

### Q1: When URL extraction enriches a `user_promoted` row, does `source` upgrade?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — upgrade to `url_extracted` | `source` reflects highest-trust write. Never downgrade. | ✓ |
| No — source is creation-only | `source = 'user_promoted'` even after URL extract enriches every field. | |
| Track separately via `last_enrichment_source` | Two columns, two truths. Most expressive; most code. | |

**User's choice:** Yes — upgrade to `url_extracted` on enrichment (Recommended)

---

### Q2: How do `admin_curated` rows come into existence in v4.0?

| Option | Description | Selected |
|--------|-------------|----------|
| No rows hit `admin_curated` in v4.0 | CHECK allows the value; no code path writes it. Admin tooling deferred to v5+. | ✓ |
| Bootstrap migration: hand-curate flagship references | Phase 17 includes hand-curated SQL inserts. Day-one quality content. Maintenance cost. | |
| Manual SQL UPDATE post-deploy | No code; SSH and UPDATE. Frictionful but honest. | |

**User's choice:** No rows hit `admin_curated` in v4.0 (Recommended)

---

### Q3: What audit trail does the catalog need for enrichment writes?

| Option | Description | Selected |
|--------|-------------|----------|
| `updated_at` only | Standard column. Trigger updates on any write. Cheapest. | ✓ |
| `updated_at` + `last_enriched_at` + `enrichment_count` | Track URL-extract touches. Future-friendly for admin tooling. | |
| Separate `watches_catalog_audit` log table | Heaviest; most powerful. Overkill for v4.0. | |

**User's choice:** `updated_at` only (Recommended)

---

### Q4: What happens when URL #2 disagrees with URL #1 on an already-populated field?

| Option | Description | Selected |
|--------|-------------|----------|
| COALESCE-only — first non-null write wins | Matches CAT-07 spec exactly. Conflicts surface as admin work later. | ✓ |
| Last-extract-wins on URL paths | URL extraction always overwrites unless `admin_curated`. Risks oscillation. | |
| Track conflicts in audit log, never overwrite | Logs disagreements for admin review. v5+ scope. | |

**User's choice:** COALESCE-only — first non-null write wins (Recommended)

---

### Mid-area scope clarification: Tag taxonomy audit

User raised: "Currently on the watch there are complications, style, role, and design sections with a bunch of fields. I don't think these fields are implemented very well, they're confusing, there is overlap, and I don't think they're providing much value."

Discussed as scope-creep risk for Phase 17. Resolution: **defer to its own future phase** (v4.x or pre-v5, before catalog→similarity rewire). Phase 17 catalog tag columns mirror current `watches` shape exactly to keep the deferred audit cheap (lockstep migration when it lands).

| Option | Description | Selected |
|--------|-------------|----------|
| Defer to own phase | Capture as deferred idea + backlog. Phase 17 mirrors current shape. | ✓ |
| Pull into Phase 17 — audit + overhaul tags now | Expands phase scope; forces `analyzeSimilarity()` change. | |
| Lightweight — audit & document only, no code | Quick research doc; informs future phase. | |

**User's choice:** Defer to own phase (Recommended)

---

## Backfill + Cron Operations

### Q1: How does the one-shot backfill get invoked?

| Option | Description | Selected |
|--------|-------------|----------|
| `npm run db:backfill-catalog` script, manual post-deploy | Standalone TS script. Documented step in deploy runbook. Idempotent. | ✓ |
| Auto-run in a Drizzle migration as part of deploy | Zero ops post-deploy. Risk: long-running migration blocks deploys. | |
| Auto-run via Server Action lazily on first read | First Server Action triggers background sweep. Latency spike risk. | |

**User's choice:** `npm run db:backfill-catalog` script, manual post-deploy (Recommended)

---

### Q2: When does pg_cron run the daily count refresh in prod?

| Option | Description | Selected |
|--------|-------------|----------|
| 03:00 UTC daily | Off-peak for US/EU/Asia. Cheap, predictable. | ✓ |
| Midnight UTC daily | Aligns snapshot dates with calendar dates. May overlap with Supabase maintenance. | |
| Twice daily (e.g., 03:00 + 15:00 UTC) | Trending counts refresh more often. Could break Gaining Traction delta math. | |

**User's choice:** 03:00 UTC daily (Recommended)

---

### Q3: What does the local `npm run db:refresh-counts` script do?

| Option | Description | Selected |
|--------|-------------|----------|
| Refresh counts + write a snapshot row | Same code path as pg_cron. Local dev gets identical behavior to prod. | ✓ |
| Refresh counts only, skip snapshot | Snapshots are prod-only. Locally /explore Gaining Traction renders empty. | |
| Two scripts: `db:refresh-counts` and `db:write-snapshot` | Separation of concerns. More to maintain. | |

**User's choice:** Refresh counts + write a snapshot row (Recommended)

---

### Q4: How long do daily snapshots stick around?

| Option | Description | Selected |
|--------|-------------|----------|
| Indefinitely — no purge in v4.0 | ~1.8M rows/year, well within Supabase free tier. Cheapest path. | ✓ |
| 30-day rolling window via pg_cron purge | Bounds DB size; loses long-tail analytics. | |
| 90-day rolling window | Compromise. No real product use case. | |

**User's choice:** Indefinitely — no purge in v4.0 (Recommended)

---

## Claude's Discretion

The plan can decide:
- Exact regex/character set for "strip whitespace/punctuation" in `reference_normalized` GENERATED expression
- Whether `image_source_quality` ships as a CHECK enum or free-text in v4.0
- Snake-case column naming details (snake_case throughout)
- Backfill script logging format
- pg_cron job naming
- Migration filename ordering relative to existing v3.0 migrations
- Exact SECURITY DEFINER + REVOKE/GRANT incantation on the cron function (mirror Phase 11 pattern)

## Deferred Ideas

- Admin tooling for catalog curation (image override, spec corrections, source promotion to `admin_curated`) — v5+
- Brand-domain allowlist + tier-aware image COALESCE smart-replace logic — v5+
- Back-port `production_year_is_estimate` flag to per-user `watches` — v4.x or v5+
- Tag taxonomy audit & rewire (complications/style/role/design overlap) — own phase, before v5.0 catalog→similarity rewire
- Snapshot purge job — if storage becomes a concern, future ops/maintenance phase
