# Stack Research

**Domain:** Catalog hierarchy + engine rewire + discovery polish (v5.0 Discovery North Star)
**Researched:** 2026-05-06
**Confidence:** HIGH — all version claims verified against npm registry, Context7, or Anthropic official docs

---

## Existing Stack (Validated — Do Not Re-Research)

| Technology | Version | Status |
|------------|---------|--------|
| Next.js App Router | 16.2.3 | Locked — no upgrade in scope |
| React | 19.2.4 | Locked |
| TypeScript | ^5 | Locked |
| Drizzle ORM | 0.45.2 | Current latest — confirmed on npm |
| drizzle-kit | 0.31.10 | Current latest — confirmed on npm |
| @supabase/supabase-js | ^2.103.0 | Locked |
| @anthropic-ai/sdk | ^0.88.0 | Upgrade available — see below |
| Vitest + RTL + MSW | 2.x | Locked |
| Tailwind CSS 4 | ^4 | Locked |
| Zustand | ^5.0.12 | Locked (filter-only, 31 lines) |

---

## v5.0 New Capabilities — Stack Analysis by Area

### 1. Catalog Hierarchy Schema (Layers A–D)

**Verdict: No new libraries needed. Existing Drizzle 0.45.2 covers everything.**

Drizzle 0.45.2 supports self-referencing foreign keys via the `AnyPgColumn` callback pattern — confirmed in Context7 official docs (`/drizzle-team/drizzle-orm-docs`):

```typescript
import type { AnyPgColumn } from 'drizzle-orm/pg-core'

export const watchFamilies = pgTable('watch_families', {
  id: uuid('id').defaultRandom().primaryKey(),
  brandId: uuid('brand_id').notNull().references(() => brands.id, { onDelete: 'cascade' }),
  // ...
})
```

For the FK chain `brands → watch_families → watches_catalog → watch_variants`, all four tables can be modeled with `.references(() => targetTable.col)` callbacks. No circular dependency issues because each layer references upward only.

For `watch_lineage_edges` (predecessor/successor DAG), self-referencing on `watches_catalog.id` uses the same `AnyPgColumn` callback:

```typescript
export const watchLineageEdges = pgTable('watch_lineage_edges', {
  predecessorId: uuid('predecessor_id').notNull().references((): AnyPgColumn => watchesCatalog.id, { onDelete: 'cascade' }),
  successorId: uuid('successor_id').notNull().references((): AnyPgColumn => watchesCatalog.id, { onDelete: 'cascade' }),
  // ...
})
```

**Movement enum:** Use `pgEnum` — Drizzle 0.45.2 supports this natively. Extend the pattern already used in `schema.ts` (`wearVisibilityEnum`, `notificationTypeEnum`).

---

### 2. DAG Traversal (Lineage Browse — WITH RECURSIVE)

**Verdict: Drizzle does NOT support WITH RECURSIVE natively. Use `db.execute(sql\`...\`)` for lineage CTE queries.**

Drizzle issue #209 ("Support WITH RECURSIVE") is open with a PR in progress but not merged as of 0.45.2. This is confirmed by the issue tracker and the absence of a `$withRecursive` API in the current release.

**Pattern to use for lineage traversal:**

```typescript
import { sql } from 'drizzle-orm'

// Traverse successors from a given reference_id
const result = await db.execute(sql`
  WITH RECURSIVE lineage AS (
    SELECT successor_id, 1 AS depth
    FROM watch_lineage_edges
    WHERE predecessor_id = ${catalogId}
    UNION ALL
    SELECT e.successor_id, l.depth + 1
    FROM watch_lineage_edges e
    INNER JOIN lineage l ON l.successor_id = e.predecessor_id
    WHERE l.depth < 10  -- cycle guard
  )
  SELECT wc.* FROM lineage
  JOIN watches_catalog wc ON wc.id = lineage.successor_id
  ORDER BY lineage.depth
`)
```

This is the recommended pattern — `db.execute(sql\`...\`)` is fully typed (returns `postgres.RowList`) and the project already uses it in migrations. No additional library needed.

**Cycle prevention:** Add a `CHECK (predecessor_id != successor_id)` constraint in the migration SQL, and use depth-limited CTEs in application queries. Postgres enforces referential integrity; cycles only exist within the DAG logic itself.

---

### 3. DB Wipe + Re-Seed Flow (Clean Slate for Layer C)

**Verdict: No new tooling needed. Existing drizzle-kit push + supabase db push --linked covers this.**

The clean-slate DB wipe (single user, single environment) is an operational step, not a library problem. Existing flow per memory file `project_drizzle_supabase_db_mismatch.md`:

- Local: `supabase db reset` → `drizzle push` (per `project_local_db_reset.md` workflow)
- Prod: `supabase db push --linked` with the 4 gotchas already documented

For the Layer C variant split, the migration is a DDL-only wipe + reseed using existing `tsx` scripts (pattern: `npm run db:backfill-catalog`). No pg-format or additional migration tooling warranted — raw SQL in Drizzle `db.execute(sql\`...\`)` handles data seeding inline.

**What to avoid:** Do not add `pg-format` as a runtime dependency. It's a string formatter for dynamic SQL, not needed here since the catalog seed will be a curated static script, not dynamic SQL generation.

---

### 4. CAT-13: analyzeSimilarity() Engine Rewire

**Verdict: No new libraries. The rewire is a JOIN pattern change in the existing DAL + `src/lib/similarity.ts` refactor.**

The current `analyzeSimilarity()` reads from per-user `Watch` objects in memory (all taste attributes are duplicated on the `watches` table). CAT-13 rewires it to read catalog taste columns at JOIN time via the DAL.

The shape of the change:
- `src/data/watches.ts` DAL query adds `LEFT JOIN watches_catalog` to return `CatalogTasteAttributes` alongside each `Watch`
- `analyzeSimilarity()` signature extends to accept catalog taste columns merged onto the watch type
- No new ORM features needed — `leftJoin` + `eq` are supported in Drizzle 0.45.2

CAT-14 (`SET NOT NULL` on `watches.catalog_id`) is a DDL migration with no application code change beyond removing null-guards in the DAL.

---

### 5. Discovery Audit (Phase 1 — Read-Only)

**Verdict: No new libraries. This is a documentation exercise, not a code feature.**

The discovery audit maps click-paths across existing routes (`/`, `/explore`, `/u/{user}`, `/catalog/{id}`, `/search`, `/watch/{id}`). Output is a decisions document (`.planning/phases/32-discovery-audit/` or similar). No instrumentation, analytics SDK, or tracking library needed. Reading source code + manual click-through + writing a structured Markdown doc is the correct approach.

If lightweight UX flow tracing is desired, Next.js App Router Server Components already log requests via `console.log` or the Vercel platform's built-in request logs. No Hotjar, Mixpanel, or similar.

---

### 6. Branded HTML Email Templates (SET-14)

**Recommendation: react-email 6.1.1 + @react-email/components 1.0.12**

React Email is the correct choice for this stack because:
- **Existing stack alignment:** TypeScript + React. Maizzle requires learning a separate Tailwind-based email templating paradigm. react-email uses familiar JSX.
- **Resend first-party integration:** react-email is published by Resend. The `resend` npm package accepts `react` as a first-class prop for the `from` field. No render step needed — Resend handles `ReactElement → HTML` internally.
- **Tailwind 4 support:** React Email 5.0 added Tailwind 4 support. Version 6.1.1 (current) includes the unified package and open-source visual editor.
- **2M weekly npm downloads** as of the v6.0 announcement — active, not abandoned.

```bash
npm install react-email @react-email/components
```

Note: `react-email` (6.1.1) and `@react-email/components` (1.0.12) are the two packages needed. The `resend` npm package is NOT yet in the project — add it when SET-14 is implemented.

**Maizzle is not recommended** because it requires a Node.js build step outside the Next.js pipeline, a separate config, and a different mental model. The Tailwind-for-email appeal doesn't offset the DX friction when the codebase is already React/TypeScript.

**Hand-rolling is not recommended** because table-based email layout CSS is a maintenance trap. react-email's components handle inbox compatibility (Outlook, Gmail, Apple Mail) automatically.

---

### 7. Variant Dedup Tooling (Post-User-Promoted Catalog Growth)

**Recommendation: pg_trgm Postgres extension (already available in Supabase) — no npm library needed.**

The dedup problem — "Submariner Date" vs "Submariner Date 16610" being ingested twice — is best solved at the database layer using `pg_trgm` trigram similarity, not in application code.

**Why pg_trgm:**
- Available as a Supabase extension (enable via dashboard or `CREATE EXTENSION pg_trgm;`)
- `similarity('Submariner Date', 'Submariner Date 16610')` returns a float 0..1
- A GIN index on `(model_normalized || ' ' || brand_normalized)` makes dedup queries fast even at thousands of catalog rows
- Dedup can run as a one-time curation script (`npm run db:dedup-catalog`) using `db.execute(sql\`...\`)` — no application runtime path needed for v5.0

**Pattern for a curation script:**

```sql
-- Find candidate duplicates before the Layer C wipe
SELECT a.id, a.brand, a.model, a.reference, b.id, b.brand, b.model, b.reference,
       similarity(
         lower(trim(a.brand)) || ' ' || lower(trim(a.model)),
         lower(trim(b.brand)) || ' ' || lower(trim(b.model))
       ) AS sim
FROM watches_catalog a
JOIN watches_catalog b ON a.id < b.id
WHERE similarity(
  lower(trim(a.brand)) || ' ' || lower(trim(a.model)),
  lower(trim(b.brand)) || ' ' || lower(trim(b.model))
) > 0.7
ORDER BY sim DESC;
```

**npm libraries to avoid:** `fuzzysort`, `fuse.js`, `natural` — these run in application memory and can't leverage Postgres indexes. The catalog is the source of truth; dedup belongs in the DB.

---

### 8. AI SDK / Model Upgrade (LLM-Driven Curation)

**Recommendation: Upgrade @anthropic-ai/sdk from ^0.88.0 to ^0.94.0. Keep model string `claude-sonnet-4-6` — no change needed.**

Verified against Anthropic official docs (platform.claude.com/docs/en/about-claude/models/overview):

- `claude-sonnet-4-6` is the **current production alias** for Claude Sonnet 4.6 (latest generation Sonnet). It is NOT deprecated.
- `claude-sonnet-4-20250514` (the old model ID used in `enricher.ts` comments) IS deprecated — retirement June 15, 2026. The codebase already uses `claude-sonnet-4-6` in `enricher.ts` (`model: 'claude-sonnet-4-6'`), which is correct.
- The SDK is at 0.94.0 on npm (last published within 24 hours as of research date). ^0.88.0 is 6 minor versions behind but compatible — bump is safe and gives access to any tool-use or streaming improvements.

```bash
npm install @anthropic-ai/sdk@^0.94.0
```

**No model change for v5.0:** `claude-sonnet-4-6` remains the right choice for taste enrichment — fast, cost-effective, already proven in Phase 19.1. `claude-opus-4-7` (the new flagship) is significantly more expensive ($5/MTok input vs $3/MTok) and not warranted for batch catalog enrichment.

---

### 9. Testing Additions for Hierarchical Data

**Recommendation: @electric-sql/pglite 0.4.5 + @praha/drizzle-factory 1.4.2**

The existing Vitest + RTL + MSW stack tests application logic well but has no in-process database for schema-level tests. Hierarchy tests (e.g., "brand_id FK resolves through family to catalog row", "lineage edge prevents self-reference") need a real Postgres schema, not mocks.

**@electric-sql/pglite 0.4.5** runs WASM-compiled Postgres in-process inside Vitest. Confirmed by the drizzle-orm community docs and GitHub discussions (#4205, #4216). Pattern:
- `vitest.config.ts` global setup pushes Drizzle schema to PGLite
- Each test file gets an isolated PGLite instance
- No Docker, no external Postgres, works in CI

**@praha/drizzle-factory 1.4.2** generates typed test fixtures from Drizzle schema tables. Pattern from Context7 community docs:
- `createFactory(db, brandSchema)` produces a `BrandFactory`
- `BrandFactory.create({ name: 'Rolex' })` inserts and returns a typed row
- `composeFactory([BrandFactory, FamilyFactory, CatalogFactory])` builds a full hierarchy tree in one call

These two libraries together solve the "how do I create a valid 4-level hierarchy (Brand → Family → Reference → Variant) as a test fixture" problem without writing 40-line setup helpers per test.

```bash
npm install -D @electric-sql/pglite @praha/drizzle-factory
```

**Note on MSW:** The existing MSW setup handles API route mocking. PGLite + drizzle-factory is additive for DB-layer tests, not a replacement for MSW's HTTP-level tests.

---

## Summary: What to Add vs What Already Ships

| Capability | Add? | Package | Version | Notes |
|------------|------|---------|---------|-------|
| Self-referencing FK (Brand/Family/Variant) | No | — | — | Drizzle 0.45.2 `AnyPgColumn` pattern |
| WITH RECURSIVE lineage traversal | No | — | — | `db.execute(sql\`WITH RECURSIVE...\`)` pattern |
| Clean-slate DB wipe + reseed | No | — | — | Existing drizzle-kit + supabase db push flow |
| CAT-13 analyzeSimilarity() rewire | No | — | — | DAL JOIN + type extension, no new lib |
| Discovery audit | No | — | — | Read-only documentation exercise |
| Branded HTML email (SET-14) | YES | `react-email`, `@react-email/components`, `resend` | 6.1.1, 1.0.12, latest | Add when SET-14 phase starts |
| Variant dedup | No (app lib) | pg_trgm | Postgres ext | Enable extension; use `db.execute(sql\`...\`)` |
| AI SDK upgrade | YES | `@anthropic-ai/sdk` | ^0.94.0 | Bump from ^0.88.0; keep `claude-sonnet-4-6` |
| Hierarchy test fixtures | YES | `@electric-sql/pglite`, `@praha/drizzle-factory` | 0.4.5, 1.4.2 | Dev dependency only |

---

## Installation Snapshot

```bash
# Runtime additions (add at milestone start)
npm install @anthropic-ai/sdk@^0.94.0

# Email (add when SET-14 phase starts — defer until that phase)
npm install react-email @react-email/components resend

# Dev additions (add at milestone start)
npm install -D @electric-sql/pglite @praha/drizzle-factory
```

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| pg-format | Runtime SQL string formatting; not needed for static migration scripts | Raw SQL in `db.execute(sql\`...\`)` |
| fuse.js / fuzzysort | In-memory fuzzy matching for catalog dedup | pg_trgm Postgres extension |
| Stripe / entitlements | SEED-006 resolved: no paywall in v5.0 | Nothing — stay fully free |
| Hotjar / Mixpanel | Overkill for a discovery audit phase | Manual click-path walkthrough + Markdown output |
| Maizzle | Separate build pipeline, non-React paradigm | react-email |
| @anthropic-ai/sdk Bedrock variant | Not needed — direct API usage is correct | Keep direct `@anthropic-ai/sdk` |
| drizzle-seeder / knex | Redundant with tsx scripts already in package.json | `npm run db:*` tsx scripts |

---

## Deprecation Notice (Action Required Before June 15, 2026)

The `claude-sonnet-4-20250514` model ID (used in old comments and the enricher.ts comment block) is deprecated by Anthropic. The codebase currently passes `claude-sonnet-4-6` to the API, which is correct and is the current production alias. No code change is needed — the model string in `enricher.ts` is already correct. The deprecation only affects old snapshot IDs; `claude-sonnet-4-6` is a live alias.

---

## Sources

- Context7 `/drizzle-team/drizzle-orm-docs` — self-referencing FK (`AnyPgColumn`), CTE patterns, `db.execute(sql\`...\`)` raw queries — HIGH confidence
- GitHub `drizzle-team/drizzle-orm` issue #209 — WITH RECURSIVE not yet supported; raw SQL workaround confirmed — HIGH confidence
- `npm show drizzle-orm version` → 0.45.2 (current latest); `npm show drizzle-kit version` → 0.31.10 — HIGH confidence
- Anthropic official docs `platform.claude.com/docs/en/about-claude/models/overview` — `claude-sonnet-4-6` is current alias, `claude-sonnet-4-20250514` deprecated June 15 2026 — HIGH confidence
- `npm show @anthropic-ai/sdk version` → 0.94.0 — HIGH confidence
- `npm show react-email version` → 6.1.1; `npm show @react-email/components version` → 1.0.12 — HIGH confidence
- `resend.com/blog/react-email-6` — v6.0 Resend integration, Tailwind 4 support, 2M weekly downloads — MEDIUM confidence (official Resend blog)
- `npm show @electric-sql/pglite version` → 0.4.5; `npm show @praha/drizzle-factory version` → 1.4.2 — HIGH confidence
- PostgreSQL docs `pg_trgm` extension; Supabase extensions docs — MEDIUM confidence (pg_trgm must be explicitly enabled, not auto-enabled)
- WebSearch: react-email vs Maizzle comparison (2026 sources on trybuildpilot.com, websyro.com) — MEDIUM confidence

---

*Stack research for: Horlo v5.0 Discovery North Star*
*Researched: 2026-05-06*
