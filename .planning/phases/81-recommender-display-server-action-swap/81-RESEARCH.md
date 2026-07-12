# Phase 81: Recommender + Display Server Action Swap - Research

**Researched:** 2026-07-12
**Domain:** Read-time JOIN-through-catalog canonical resolution + Server-Action canonical write-time overwrite
**Confidence:** HIGH (all findings tool-verified against current source; no library-doc gaps)

## Summary

Phase 81 is a **pure code phase** (no schema changes, no migrations) that closes v8.4's canonical-string loop on two runtime surfaces:

1. **Read path** — recommender exclusion key and multi-brand-match scoring switch from lowercased free-text `(brand|model)` tuples to `(brand_id|family_id)` FK tuples; `topUpFromCatalogPopularity` INNER-JOINs `brands` + `watch_families` so synthetic rail rows carry canonical display strings; `topBrandOf` widens to count by `brandId` and return `{ brandId, brandName }`.
2. **Write path** — `addWatch` and `editWatch` Server Actions auto-overwrite `watches.brand` / `watches.model` from canonical `brands.name` / `watch_families.name` (resolved via `catalogId → brand_id → brands.name`) BEFORE the INSERT / UPDATE, discarding user-typed variants like `Hamilton Watch`.

All CONTEXT.md line-number citations verified against current source with **zero drift**. The only structural extension consumer risk is the return-type widening of `upsertCatalogFromExtractedUrl` (extract-watch route + Server Actions consume it) and `upsertCatalogFromUserInput` (Server Actions + extract-watch structured branch + wishlist Server Action). Silent-bug risk is **high** (self-in-own-rail if exclusion key mismatches) — build and DAL-mock unit tests cannot catch this class. Local `npm run dev` with the drift fixture is the mandatory correctness gate.

**Primary recommendation:** Ship in 3-4 plans — (1) type + DAL projection widening (`Watch`, `mapRowToWatch`, `getWatchesByUser`/`getWatchById` LEFT JOIN, `getCatalogById` extended, `upsertCatalogFrom*` return-type extension + all callsite updates); (2) recommender read-path swap (`topBrandOf` signature widen, `getRecommendationsForViewer` exclusion set + brandNameLookup, `topUpFromCatalogPopularity` INNER JOINs + brand_id IN clause); (3) Server Actions write-path canonical overwrite (both `addWatch` branches + `editWatch` overwrite path); (4) local-first drift-fixture walkthrough + bundled prod deploy.

## User Constraints (from CONTEXT.md)

### Locked Decisions

Copied verbatim from `81-CONTEXT.md` §Decisions:

- **D-81-01 — Canonical-name source on writes: Fresh JOIN after upsert returns catalogId.** Extend `upsertCatalogFromUserInput` and `upsertCatalogFromExtractedUrl` to return `{ catalogId, brandName, familyName }` instead of `string | null`. Extend `catalogDAL.getCatalogById` to LEFT JOIN `brands` + `watch_families` and expose `canonicalBrand: string` + `canonicalFamily: string` on the returned row. Server Actions (`addWatch` catalogId branch + user-input branch, `editWatch` new overwrite path) read canonical strings and write them into `cleanData.brand` / `cleanData.model`. Rejected alternatives: (a) resolver-only extension (misses catalogId-supplied branch), (c) DB trigger (interacts poorly with service-role writes + `[[supabase-extension-schema-function-pin]]`).

- **D-81-02 — Watch type + DAL projection: Extend `Watch` with optional `brandId?` and `familyId?`.** Not recommender-private — FK ids are canonical *domain* identity for future Explore rail / similarity engine / add-watch dedupe. `getWatchesByUser` + `getWatchById` extend the existing LEFT JOIN on `watchesCatalog` to project `brand_id` + `family_id`; `mapRowToWatch` propagates. Fields optional (`?: string`) — legacy fixtures pass `undefined`. Exclusion-set `norm(w)` becomes `${w.brandId}|${w.familyId}` with `${w.brand}|${w.model}` fallback for the `catalogId=null` edge case.

- **D-81-03 — Catalog denorm drift: Read-time JOIN in `topUpFromCatalogPopularity` only; no write-time sync.** Both SELECTs INNER JOIN `brands b ON b.id = watches_catalog.brand_id INNER JOIN watch_families f ON f.id = watches_catalog.family_id` and project `b.name AS brand` + `f.name AS model`. Synthetic Watch uses canonical strings. Owned-brand IN clause switches from `lower(trim(brand)) IN (…strings…)` to `brand_id IN (…viewer's brand_ids…)` using the same `IN (sql.join(...))` shape per `[[drizzle-sql-any-array-pitfall]]`. `watches_catalog.brand` / `.model` denorm columns LEFT UNTOUCHED.

- **D-81-04 — Deploy + local-first verification: Combine unit tests + local drift fixture; bundled prod deploy.** Fixture: INSERT a `watches_catalog` row with denorm `brand='Hamilton Watch'` on canonical Hamilton `brand_id`, personal viewer row on canonical `Hamilton`, peer `vintage-anna` owns the drift row + another Hamilton row. Walkthrough on `npm run dev` + local Supabase: (i) `viewer` loads `/` — assert drift row NOT in rail (RECO-01); (ii) peer's OTHER Hamilton catalog rows surface with `Fans of Hamilton love this` (RECO-04); (iii) add watch with brand `Hamilton Watch` — assert `watches.brand='Hamilton'` in DB (DISP-01); (iv) edit that watch typing `Hamilton Watch` — assert saves as `Hamilton` (DISP-02). Unit-test extensions: exclusion-key format, `topBrandOf` counts-by-brandId, rationaleFor receives canonical input, addWatch/editWatch persists canonical. Deploy: bundled single Vercel push + post-push prod smoke.

- **D-81-05 — `topBrandOf` counts on `w.brandId`, returns `{ brandId, brandName }`.** Signature widens to `topBrandOf(watches, brandNameLookup: Map<string, string>): { brandId: string; brandName: string } | null`. DAL builds `brandNameLookup` once from `SELECT id, name FROM brands WHERE id IN (…viewer's brandIds…)` (one query, pk-indexed). Legacy `w.brandId = undefined` rows correctly excluded from counting.

### Claude's Discretion

Copied verbatim from `81-CONTEXT.md` §Claude's Discretion:

- Exact plumbing of the fresh JOIN inside `upsertCatalogFromUserInput` — CTE extension with `RETURNING id, (SELECT name FROM brands WHERE id = brand_id) AS brand_name, ...` OR follow-up SELECT.
- Whether `getCatalogById` gains the JOIN in place OR ships as sibling `getCatalogByIdWithCanonical`. **Research finding below:** 6 existing callers; extend in place is safe (see §Existing Code Insights).
- Where `brandNameLookup` is built — naturally inside `getRecommendationsForViewer` after `viewerWatches` fetch.
- Whether exclusion-set `${brand}|${model}` fallback stays or is stripped — post-Phase-80 all catalog rows have brand+family FKs; fallback is theoretically dead code. Belt-and-suspenders acceptable.
- Test file organization — extend existing OR add integration-tier file.
- Whether `topBrandOf` gets a companion `topFamilyOf` — recommend defer.
- `mapRowToWatch` LEFT JOIN nullable handling — default `undefined` vs explicit null.

### Deferred Ideas (OUT OF SCOPE)

Copied verbatim from `81-CONTEXT.md` §Deferred Ideas:

- Write-time sync of `watches_catalog.brand`/`model` to canonical (Phase 82 admin-merge).
- Denormalizing `brand_id` onto `watches` table (CANON-V2-01).
- `brand_aliases text[]` column on `brands` (CANON-V2-02).
- `topFamilyOf` companion function.
- Full recommender bulk-JOIN query rewrite.
- Stripping the `${brand}|${model}` exclusion fallback post-migration.
- Auto-refreshing brandNameLookup via a cached DAL helper.
- Adding `familyName` alongside `brandName` to Recommendation type.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RECO-01 | `getRecommendationsForViewer` exclusion key switches from `lower(trim(brand)) | lower(trim(model))` to `brand_id | family_id` (joined via `watches.catalogId`) | Current `norm()` at `src/data/recommendations.ts` L198-199; `excluded` Set built L200-205 — see §Standard Stack §Recommender-Read-Path. New `Watch.brandId?/familyId?` from D-81-02 provides the input. |
| RECO-02 | `topUpFromCatalogPopularity` multi-brand match switches from `lower(trim(brand)) IN (...)` to `brand_id IN (...)` | Current IN clause at L454-458 uses `sql.join(brandArr.map(b => sql\`${b}\`), sql\`, \`)` — the anti-pitfall-correct pattern per `[[drizzle-sql-any-array-pitfall]]`. Phase 81 swaps column + array contents; pattern unchanged. |
| RECO-03 | `topBrandOf` operates on resolved `brand_id`; returns canonical `brands.name` | Current signature at `src/lib/recommendations.ts` L96-106 (`topBrandOf(watches): string | null`); widens per D-81-05 to accept `brandNameLookup: Map<string, string>` and return `{ brandId, brandName } | null`. Caller at `getRecommendationsForViewer` L111 uses return only for downstream rationale substitution. |
| RECO-04 | Rationale templates render canonical brand strings | `rationaleFor` at `src/lib/recommendations.ts` L53-92 reads `ctx.candidateBrand` — no signature change. Correctness comes from callers supplying canonical strings: DISP-01/02 for personal watches, INNER JOIN for synthetic top-up watches (D-81-03). |
| DISP-01 | `addWatch` auto-overwrites `watches.brand`/`model` with canonical `brands.name`/`watch_families.name` | Current `addWatch` at `src/app/actions/watches.ts` L97+, two branches (catalogId L141-157 + user-input L158-177). CatalogId branch already reads `catalogRow.brand` at L153 — swap to `catalogRow.canonicalBrand`. User-input branch adds canonical overwrite after `upsertCatalogFromUserInput` returns extended shape. |
| DISP-02 | `editWatch` runs the same auto-overwrite on UPDATE | Current `editWatch` at `src/app/actions/watches.ts` L553-704. Add canonical overwrite path before `updatedWatch = await watchDAL.updateWatch(...)` at L668. Fetch canonical strings via extended `getCatalogById` when `priorRow.catalogId` present. |

## Architectural Responsibility Map

Phase 81 is single-tier (API/DAL/Server-Action layer). No new capabilities cross tiers. Map for completeness:

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Recommender exclusion key | API/DAL (`getRecommendationsForViewer`) | — | Read-only DAL logic; runs in Server Component + `use cache` context via `CollectorsLikeYou`. |
| Multi-brand match SQL | API/DAL (`topUpFromCatalogPopularity`) | Database (Postgres INNER JOIN) | INNER JOIN safe under Phase 80 NOT NULL FKs; no browser or frontend involvement. |
| Rationale rendering | Pure lib (`rationaleFor`) | API/DAL (calls it) | No I/O; deterministic input→output. Called from Server Component context. |
| Canonical brand fetch (`brandNameLookup`) | API/DAL (Postgres SELECT) | — | Cheap pk-indexed lookup, single query per rail render. |
| `addWatch` / `editWatch` overwrite | API/Server Action | Database | Canonical strings written to `watches.brand`/`model`; client-side form UNCHANGED per CONTEXT "Explicitly NOT in this phase". |
| `Watch` type extension | Shared lib (`src/lib/types.ts`) | API/DAL (mapRowToWatch propagation) | Optional fields; back-compat with client fixtures. |

**Ownership sanity check:** Every Phase 81 requirement lives in `src/data/**` (DAL), `src/lib/**` (pure helpers), or `src/app/actions/**` (Server Actions). Client-side `WatchForm` and `AddWatchFlow` are explicitly out of scope per CONTEXT.

## Standard Stack

**No new libraries.** Phase 81 uses only in-repo primitives:

| Primitive | Purpose | Verified Location |
|-----------|---------|-------------------|
| Drizzle ORM `sql` template + `sql.join` | INNER JOIN + brand_id IN clause | `src/data/recommendations.ts` L454-458 (reference impl); import at L3 |
| Drizzle `leftJoin` / `innerJoin` | JOIN through catalogId → brand_id / family_id | Existing `.leftJoin(watchesCatalog, eq(watchesCatalog.id, watches.catalogId))` at `src/data/watches.ts` L159, L205, L251 |
| Postgres `pk-indexed IN` for brandNameLookup | Batched brand-name resolve | `SELECT id, name FROM brands WHERE id IN (…)` — 5-30 rows/viewer per §Specifics |
| `updateTag(\`viewer:${user.id}:recs\`)` | Server-Action cache invalidation (unchanged) | `src/app/actions/watches.ts` L340 (addWatch), L676 (editWatch); import at L18 |
| Next 16 `revalidateTag('explore', 'max')` | Cross-user fanout (unchanged) | `src/app/actions/watches.ts` L360, L694 |

**Installation:** N/A — no packages added.

## Architecture Patterns

### System Architecture Diagram

Phase 81 modifies two data flows through Horlo. Both are single-tier (server-only).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  READ PATH — Home rail render (RECO-01..04)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  <CollectorsLikeYou/> RSC (`use cache` — Phase 75)                          │
│     │                                                                       │
│     ▼                                                                       │
│  getRecommendationsForViewer(viewerId)                                      │
│     │                                                                       │
│     ├──► getWatchesByUser(viewerId) ──► LEFT JOIN watches_catalog           │
│     │       returns Watch[] with brandId?/familyId? (NEW — D-81-02)         │
│     │                                                                       │
│     ├──► SELECT id, name FROM brands                                        │
│     │       WHERE id IN (…viewer's brandIds…)                               │
│     │       → brandNameLookup: Map<brandId, brandName>  (NEW — D-81-05)     │
│     │                                                                       │
│     ├──► publicProfiles + overlap loop (unchanged)                          │
│     │                                                                       │
│     ├──► Exclusion Set                                                      │
│     │       norm(w) = `${w.brandId}|${w.familyId}`  (WAS brand|model)       │
│     │       fallback: `${w.brand}|${w.model}` when brandId undefined        │
│     │                                                                       │
│     ├──► topUpFromCatalogPopularity(...)  (SPARSE POOL — Phase 75 D-10)     │
│     │       │                                                               │
│     │       ├──► SELECT ... FROM watches_catalog                            │
│     │       │      INNER JOIN brands b       (NEW — D-81-03)                │
│     │       │      INNER JOIN watch_families f (NEW — D-81-03)              │
│     │       │      ORDER BY owners_count DESC LIMIT 60                      │
│     │       │      → project b.name AS brand, f.name AS model               │
│     │       │                                                               │
│     │       └──► SELECT ... FROM watches_catalog                            │
│     │              INNER JOIN brands b + watch_families f                   │
│     │              WHERE brand_id IN (…viewer's brandIds…) (WAS strings)    │
│     │              (Uses sql.join per drizzle-sql-any-array-pitfall)        │
│     │                                                                       │
│     └──► rationaleFor(ctx: {candidateBrand, …})                             │
│              candidateBrand is now canonical (peer watches: DISP-01/02;     │
│              synthetic rows: INNER JOIN)                                    │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  WRITE PATH — addWatch / editWatch canonical overwrite (DISP-01/02)         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Client (WatchForm / AddWatchFlow — UNCHANGED)                              │
│     │  posts { brand: "Hamilton Watch", model: "Khaki Field", … }           │
│     ▼                                                                       │
│  addWatch(data) Server Action                                               │
│     │                                                                       │
│     ├─ Branch A (cleanData.catalogId supplied)                              │
│     │    getCatalogById(catalogId) — EXTENDED (D-81-01)                     │
│     │       returns { …CatalogEntry, canonicalBrand, canonicalFamily }      │
│     │    cleanData.brand = canonicalBrand    (WAS catalogRow.brand)         │
│     │    cleanData.model = canonicalFamily   (WAS catalogRow.model)         │
│     │                                                                       │
│     └─ Branch B (user-input, resolver-driven)                               │
│          upsertCatalogFromUserInput({ brand, model, reference })            │
│             → { catalogId, brandName, familyName }  (EXTENDED — D-81-01)    │
│          cleanData.brand = brandName                                        │
│          cleanData.model = familyName                                       │
│     │                                                                       │
│     ▼                                                                       │
│  createWatch(userId, catalogId, cleanData) — DAL INSERT                     │
│     │                                                                       │
│     ▼                                                                       │
│  updateTag(`viewer:${user.id}:recs`) + revalidateTag('explore','max')       │
│  (UNCHANGED — string-content-only change; invalidation graph unaffected)    │
│                                                                             │
│  editWatch(watchId, data) Server Action                                     │
│     │                                                                       │
│     ├─ Fetch priorRow via getWatchById(user.id, watchId)                    │
│     │                                                                       │
│     ├─ NEW: If parsed.data.brand OR parsed.data.model was edited            │
│     │      AND priorRow.catalogId present:                                  │
│     │        getCatalogById(priorRow.catalogId) — EXTENDED                  │
│     │        updatePayload.brand = canonicalBrand                           │
│     │        updatePayload.model = canonicalFamily                          │
│     │                                                                       │
│     ▼                                                                       │
│  updateWatch(userId, watchId, updatePayload) — DAL UPDATE                   │
│  (Or db.transaction on isTransitioningToSold — unchanged)                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Reader can trace an owner of `Hamilton` from load-`/`:**
1. `getWatchesByUser(owner.id)` returns owner's watches with `brandId = <canonical Hamilton UUID>`.
2. Exclusion set adds `<Hamilton UUID>|<Khaki Field UUID>`.
3. `topUpFromCatalogPopularity`'s owned-brand query fetches all watches_catalog rows with `brand_id = <Hamilton UUID>`, INNER JOINed to `brands.name = 'Hamilton'`.
4. The drift row (denorm `Hamilton Watch` on canonical `<Hamilton UUID>` brand_id) has `syntheticWatch.brand = 'Hamilton'` (from JOIN, not denorm) — its exclusion key is `<Hamilton UUID>|<Khaki Field UUID>` → matches owner's exclusion → dropped.
5. Peer's other Hamilton catalog row (different family_id) has exclusion key `<Hamilton UUID>|<other UUID>` → does NOT match → surfaces with rationale `Fans of Hamilton love this`.

### Current File Structure (Phase 81 modifies)

```
src/
├── lib/
│   ├── types.ts                        # Add Watch.brandId?, familyId? (near L93)
│   └── recommendations.ts              # topBrandOf signature widen
├── data/
│   ├── recommendations.ts              # exclusion, brandNameLookup, topUp JOINs
│   ├── watches.ts                      # mapRowToWatch + LEFT JOIN projection
│   └── catalog.ts                      # getCatalogById + upsert helpers return-type extension
└── app/
    └── actions/
        └── watches.ts                  # addWatch + editWatch canonical overwrite

# NOT MODIFIED (verified callers)
src/data/catalog-resolver.ts            # Phase 80 resolver — contract preserved (D-81-01)
src/app/api/extract-watch/route.ts      # Consumes upsert helper return — MUST update destructure
src/app/actions/wishlist.ts             # Calls upsertCatalogFromUserInput L138 — MUST update
src/app/actions/verdict.ts              # Calls getCatalogById L54 — extending shape is additive-safe
src/app/watch/new/page.tsx              # Calls getCatalogById L167 — additive-safe
src/app/w/[ref]/page.tsx                # 4 getCatalogById callsites L322/L436/L516 — additive-safe
```

### Pattern 1: Extend LEFT JOIN projection (mirrors Phase 60 `catalogImageUrl`)

**What:** Add columns to the SELECT of `getWatchesByUser` / `getWatchById` LEFT JOIN and propagate through `mapRowToWatch`.
**When to use:** Whenever a catalog-derived field becomes read-often on the personal `Watch` domain type.
**Precedent:** Phase 38 `catalogTaste`; Phase 60 `catalogImageUrl` — the exact pattern.

```typescript
// Source: src/data/watches.ts L128-184 (verified 2026-07-12)
// Phase 81 extension INSIDE the existing .select({ … }) block:
const rows = await db
  .select({
    watch: watches,
    taste: { formality: watchesCatalog.formality, /* ... */ },
    catalogImageUrl: watchesCatalog.imageUrl,
    // NEW — Phase 81 D-81-02 additions:
    catalogBrandId: watchesCatalog.brandId,   // uuid, NOT NULL post-Phase-80
    catalogFamilyId: watchesCatalog.familyId, // uuid, NOT NULL post-Phase-80
    coverStoragePath: sql<string | null>`(…)`,
  })
  .from(watches)
  .leftJoin(watchesCatalog, eq(watchesCatalog.id, watches.catalogId))
  .where(eq(watches.userId, userId))
  .orderBy(asc(watches.sortOrder), desc(watches.createdAt))

return rows.map(({ watch, catalogBrandId, catalogFamilyId, /* ... */ }) => ({
  ...mapRowToWatch(watch),
  imageUrl: coverStoragePath ?? (catalogImageUrl ?? undefined),
  catalogTaste: taste == null ? null : { /* ... */ },
  // NEW — Phase 81:
  brandId: catalogBrandId ?? undefined,   // LEFT JOIN miss → undefined
  familyId: catalogFamilyId ?? undefined, // LEFT JOIN miss → undefined
}))
```

### Pattern 2: `IN (sql.join(...))` for brandId array (anti-pitfall correct)

**Reference implementation:** `src/data/recommendations.ts` L454-458 — the current owned-brand string IN clause. Phase 81 changes the array contents (uuid strings from `viewerOwnedBrandIds`) and the column (`watches_catalog.brand_id` instead of `lower(trim(watches_catalog.brand))`), NOT the shape.

```typescript
// Source: src/data/recommendations.ts L440-458 (verified 2026-07-12)
// CURRENT (string comparison):
if (viewerOwnedBrandsLower.size > 0) {
  const brandArr = [...viewerOwnedBrandsLower]
  ownedBrandRows = await db
    .select({ /* ... */ })
    .from(watchesCatalog)
    .where(
      and(
        hasImage,
        sql`lower(trim(${watchesCatalog.brand})) IN (${sql.join(
          brandArr.map((b) => sql`${b}`),
          sql`, `,
        )})`,
      ),
    )
}

// PHASE 81 (brand_id comparison, INNER JOINs added):
if (viewerOwnedBrandIds.size > 0) {
  const brandArr = [...viewerOwnedBrandIds]
  ownedBrandRows = await db
    .select({
      id: watchesCatalog.id,
      brand: brands.name,                 // canonical string from JOIN
      model: watchFamilies.name,          // canonical string from JOIN
      reference: watchesCatalog.reference,
      imageUrl: watchesCatalog.imageUrl,
      ownersCount: watchesCatalog.ownersCount,
      styleTags: watchesCatalog.styleTags,
    })
    .from(watchesCatalog)
    .innerJoin(brands, eq(brands.id, watchesCatalog.brandId))
    .innerJoin(watchFamilies, eq(watchFamilies.id, watchesCatalog.familyId))
    .where(
      and(
        hasImage,
        sql`${watchesCatalog.brandId} IN (${sql.join(
          brandArr.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      ),
    )
}
```

**Do NOT** replace with `= ANY(${arr})` — see §Common Pitfalls #1.

### Pattern 3: Server-Action canonical overwrite (both `addWatch` branches share one shape)

```typescript
// Source: src/app/actions/watches.ts L141-177 (verified 2026-07-12)
// CURRENT catalogId branch (L141-157):
if (cleanData.catalogId) {
  const catalogRow = await catalogDAL.getCatalogById(cleanData.catalogId)
  if (!catalogRow) return { success: false, error: 'Catalog reference not found' }
  cleanData.brand = catalogRow.brand       // ← DENORM column (drift source)
  cleanData.model = catalogRow.model       // ← DENORM column (drift source)
  cleanData.reference = catalogRow.reference ?? undefined
  catalogId = cleanData.catalogId
}

// PHASE 81 catalogId branch:
if (cleanData.catalogId) {
  const catalogRow = await catalogDAL.getCatalogById(cleanData.catalogId)
  if (!catalogRow) return { success: false, error: 'Catalog reference not found' }
  cleanData.brand = catalogRow.canonicalBrand   // ← from brands.name JOIN
  cleanData.model = catalogRow.canonicalFamily  // ← from watch_families.name JOIN
  cleanData.reference = catalogRow.reference ?? undefined // unchanged — D-10 lock
  catalogId = cleanData.catalogId
}

// CURRENT user-input branch (L158-177):
} else {
  let catalogIdResult: string | null
  try {
    catalogIdResult = await catalogDAL.upsertCatalogFromUserInput({
      brand: parsed.data.brand,
      model: parsed.data.model,
      reference: parsed.data.reference ?? null,
    })
  } catch (err) { /* fail-loud */ }
  if (!catalogIdResult) throw new Error(/* fail-loud */)
  catalogId = catalogIdResult
}

// PHASE 81 user-input branch:
} else {
  let upsertResult: { catalogId: string; brandName: string; familyName: string } | null
  try {
    upsertResult = await catalogDAL.upsertCatalogFromUserInput({
      brand: parsed.data.brand,
      model: parsed.data.model,
      reference: parsed.data.reference ?? null,
    })
  } catch (err) { /* fail-loud */ }
  if (!upsertResult) throw new Error(/* fail-loud */)
  catalogId = upsertResult.catalogId
  cleanData.brand = upsertResult.brandName    // canonical overwrite
  cleanData.model = upsertResult.familyName   // canonical overwrite
}
```

### Anti-Patterns to Avoid

- **`= ANY(${arr})` Drizzle tagged-template.** See `[[drizzle-sql-any-array-pitfall]]` — cost prod crash 2026-06-23. Always use `IN (sql.join(arr.map(x => sql\`${x}\`), sql\`, \`))`.
- **Extending the resolver contract in `catalog-resolver.ts` to also return brand name.** CONTEXT D-81-01 explicitly rejected this — the resolver-driven branch is only ONE of `addWatch`'s two branches; the catalogId-supplied branch reads `catalogRow.brand` directly. Extend the CATALOG helpers instead.
- **Adding write-time sync of `watches_catalog.brand` / `watches_catalog.model` to canonical.** D-81-03 explicitly rejected; interacts poorly with COALESCE-first-writer-wins in `upsertCatalogFromExtractedUrl`.
- **Rebuilding `topBrandOf` to accept only `brandNameLookup` and no watches array.** Breaks the pure-function contract. Signature widens to `(watches, brandNameLookup)`, not replace.
- **Stripping the exclusion-set `${brand}|${model}` fallback aggressively.** Post-Phase-80 catalog rows all have brand+family FKs, BUT `watches.catalogId` has `ON DELETE SET NULL` (verified `src/db/schema.ts` L154) — a legacy `catalogId=null` watch has undefined `brandId`. Keeping the fallback is belt-and-suspenders; stripping requires a defensive `assert w.brandId` upstream. Recommend keep.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bulk brand-id → brand-name resolution | Custom Postgres function or per-row query | Single pk-indexed `SELECT id, name FROM brands WHERE id IN (…)` from within `getRecommendationsForViewer` | 5-30 rows/viewer per §Specifics; `brands.id` is pk-indexed; unindexed only if we tried lower(name) lookup. Trivial cost. |
| INNER JOIN row-loss safety | Custom NULL-check + LEFT JOIN + orphan-filter | INNER JOIN under Phase 80 NOT NULL guarantee | Phase 80 CANON-01/02 flipped `watches_catalog.brand_id` and `family_id` to NOT NULL; every row is guaranteed to have both FKs populated. INNER JOIN loses zero rows. |
| Deep destructure of extended upsert return type at every callsite | Custom TypeScript type-narrow helper | Use `result?.catalogId ?? null` at extract-watch route callsites; destructure at Server Action callsites | 4 upsert callsites total — see §Existing Code Insights §Callsites. Straightforward pattern per callsite. |
| Canonical-brand ID → name Map key type | Custom `BrandId` branded type | Plain `Map<string, string>` | The existing schema uses plain `string` for uuid columns; branding at this boundary adds friction without catching real bugs. |

**Key insight:** Every "custom solution" in this domain is a symptom of not using the FK relationships already in the schema. Phase 80 landed the invariants; Phase 81 harvests them.

## Runtime State Inventory

Phase 81 is a **pure code phase** — no rename, no refactor of stored identifiers, no migration. This section is included for completeness but every category is `None — code-only phase`.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no keys/collections/user_ids change. `watches_catalog`/`watches`/`brands`/`watch_families` schemas unchanged. | none |
| Live service config | None — no external services referenced by name. | none |
| OS-registered state | None — no Task Scheduler / launchd / systemd / pm2 registrations touched. | none |
| Secrets/env vars | None — no ANTHROPIC_API_KEY / SUPABASE_* / SOPS keys renamed. | none |
| Build artifacts | None — no packages renamed, no egg-info/dist/binaries stale. `npm run build` unaffected. | none |

**The canonical question** *"After every file in the repo is updated, what runtime systems still have the old string cached, stored, or registered?"* — **Nothing.** Phase 81 changes runtime *behavior* (recommender exclusion key, Server-Action write-time overwrite) but no runtime state carries stale identifiers.

**One display-drift edge case worth flagging (not a state item):** Existing `watches` rows already have canonical `brand`/`model` from Phase 79 DISP-03 backfill. New writes will keep them canonical. `watches_catalog.brand`/`.model` denorm columns MAY still contain drift (e.g. `Hamilton Watch` on a canonical-Hamilton `brand_id`) — this is by design (D-81-03 keeps them untouched); Phase 81's INNER JOIN reads canonical from `brands.name` at rail-render time.

## Common Pitfalls

### Pitfall 1: `= ANY(${arr})` Drizzle template

**What goes wrong:** `sql\`${column} = ANY(${array})\`` emits a Postgres ROW literal `($1,$2,…)` NOT an array. Postgres rejects with `42809: op ANY/ALL (array) requires array on right side`. DAL test mocks (they don't run SQL) and `npm run build` (doesn't run queries) both pass; prod crashes on first hit.
**Why it happens:** Drizzle's tagged-template spreads arrays into positional binds by default. Only `sql.join(...)` emits a proper array-like list.
**How to avoid:** Use `IN (sql.join(arr.map(x => sql\`${x}\`), sql\`, \`))`. Reference impl at `src/data/recommendations.ts` L454-458.
**Warning signs:** Any array-typed value fed through Drizzle template outside of `sql.join`. Grep audit: `grep -rn "= ANY(\|=ANY(" src/`.
**Cost history:** Prod home crash 2026-06-23; 2× recurrences avoided in Phase 79 by forward-armor grep.

### Pitfall 2: `sql.join` empty-array emits invalid SQL

**What goes wrong:** `sql.join([], sql\`, \`)` produces `IN ()` — Postgres 42601 syntax error.
**Why it happens:** Empty JS array → zero binds → parseless SQL.
**How to avoid:** Guard with `if (viewerOwnedBrandIds.size === 0)` before entering the ownedBrand SELECT. Current L437-460 already guards `if (viewerOwnedBrandsLower.size > 0)` — preserve verbatim.
**Warning signs:** Any `sql.join` without an upstream size-guard.

### Pitfall 3: Return-type extension breaks unwary destructure callers

**What goes wrong:** `upsertCatalogFromExtractedUrl` and `upsertCatalogFromUserInput` return type widens from `Promise<string | null>` to `Promise<{ catalogId: string; brandName: string; familyName: string } | null>`. Callers doing `const catalogId = await upsert(...)` now assign an object where a string was expected.
**Why it happens:** TypeScript narrows via return-type; changing it broadcasts a type error to every callsite.
**How to avoid:** Audit callsites BEFORE landing the type change; use `const result = await upsert(...)` + `const catalogId = result?.catalogId ?? null` at consumers that don't need the names, OR destructure `const { catalogId, brandName, familyName } = result ?? { catalogId: null, ... }`.
**Callsites verified:**
- `src/app/actions/watches.ts` L164 (`upsertCatalogFromUserInput` — needs `brandName`/`familyName`)
- `src/app/actions/watches.ts` L830 (`upsertCatalogFromExtractedUrl` — inside `linkExtractedUrl` action; verify whether it needs canonical or can discard)
- `src/app/actions/wishlist.ts` L138 (`upsertCatalogFromUserInput` — from wear-event add; likely can discard names, needs pattern update)
- `src/app/api/extract-watch/route.ts` L226 (`upsertCatalogFromExtractedUrl` — URL branch; discards names, needs unwrap)
- `src/app/api/extract-watch/route.ts` L367 (`upsertCatalogFromUserInput` — structured branch; discards names, needs unwrap)

**Warning signs:** `tsc --noEmit` errors after landing the return-type change; verify all 5 callsites compile.

### Pitfall 4: LEFT JOIN nullable propagation into `Watch.brandId`

**What goes wrong:** `getWatchesByUser` LEFT JOINs `watchesCatalog`. Legacy watches with `catalogId = null` (Phase 17 `ON DELETE SET NULL` scenario) yield `brandId = null` from the JOIN. `mapRowToWatch` must convert to `undefined` (Watch fields are `?: string` — optional-undefined, not nullable).
**Why it happens:** Postgres NULL → Drizzle null → TypeScript `string | null`; Watch type expects `string | undefined`.
**How to avoid:** In `mapRowToWatch` post-JOIN, use `brandId: row.catalogBrandId ?? undefined`. Mirrors existing pattern for `catalogImageUrl` at L168.
**Warning signs:** Type errors compiling `mapRowToWatch`, or exclusion-set builder receiving unexpected null values.

### Pitfall 5: Self-in-own-rail if exclusion key format mismatches

**What goes wrong:** The exclusion set built from viewer's watches uses one key format; the candidate map built from peer watches (real or synthetic) uses a different format. Viewer's own watches leak into their rail.
**Why it happens:** Peer watches come from either `getWatchesByUser` (via `seed.ownerWatches` — carries `w.brandId`/`w.familyId` post-D-81-02) OR the synthetic-Watch construction in `topUpFromCatalogPopularity` L509-520 (needs updating to include `brandId`/`familyId` from the INNER-JOINed values). Mismatched key generation between the two paths is silent-bug bait.
**How to avoid:** Extract `norm(w)` as a single helper function that both paths call with a Watch (or Watch-shaped object) that reliably has `brandId` + `familyId`. In `topUpFromCatalogPopularity`, the synthetic Watch MUST include `brandId: row.brandId` and `familyId: row.familyId` from the INNER-JOINed catalog columns. Add unit test that asserts the exclusion key format is IDENTICAL across both paths.
**Warning signs:** Local walkthrough shows the viewer's own watch OR a drift-branded row surfacing in their rail. Test coverage: assert `viewer.brandId === excludedCandidateBrandId` in a synthetic-fixture unit test.
**Cost sensitivity:** HIGH — this is the class of bug the whole phase exists to close.

### Pitfall 6: `brandNameLookup` misses a brandId → substitutes undefined into rationale

**What goes wrong:** `brandNameLookup.get(brandId)` returns `undefined` when the viewer has a legacy watch whose brandId isn't in the initial `SELECT id, name FROM brands WHERE id IN (…viewer's brandIds…)`. `rationaleFor({ candidateBrand: undefined, ... })` produces `Fans of undefined love this`.
**Why it happens:** The lookup Map is scoped to viewer's currently-owned brands. If `topBrandOf` returns a brandId that's in `viewerOwnedBrandIds` (source of the lookup), it should always resolve — but a race condition (viewer added a watch mid-flight; brandNameLookup was pre-computed) could miss.
**How to avoid:** Build `brandNameLookup` AFTER `viewerWatches` is fetched, using `viewerWatches.map(w => w.brandId).filter(Boolean)` as the input set. Verify the same array is used for both the lookup and `topBrandOf`'s input.
**Warning signs:** Grep for `Fans of undefined` in prod logs; add defensive fallback `brandNameLookup.get(brandId) ?? ''` at the rationale-context construction site with a `console.warn` if empty.

### Pitfall 7: `getWatchesByUser` is called twice per viewer (once at L94, once inside the overlap loop at L151)

**What goes wrong:** If the exclusion-set builder relies on `brandId` from `viewerWatches` (fetched at L94), but the synthetic Watch in `topUpFromCatalogPopularity` needs a fresh JOIN, mixing sources produces stale data during a mid-render race.
**Why it happens:** Multiple concurrent DAL calls fetch the same underlying data with different JOIN shapes.
**How to avoid:** Only `viewerWatches` at L94 needs the extended projection; overlap-loop calls (L151, per-peer) do too (their brandId is needed for `topBrandOf` from within the overlap fixture) — SO both call sites of `getWatchesByUser` return the extended shape via the SAME DAL update. Verified: both L94 (viewer) and L151 (per-peer inside overlap loop) call `getWatchesByUser(id)`; single DAL update covers both.
**Warning signs:** Peer's own brand exclusion working but synthetic top-up brand exclusion broken.

### Pitfall 8: `Watch` type consumers with strict-object test fixtures

**What goes wrong:** Adding `brandId?` + `familyId?` as OPTIONAL fields is back-compat safe for object-literal fixtures (`{ id, brand, model, status, movement, complications, styleTags, designTraits, roleTags }` — TypeScript accepts extra-absent optional fields). Vitest suites that use `mkWatch({ overrides })` factories at `tests/lib/recommendations.test.ts` L6-19 + `src/data/__tests__/recommendations.test.ts` L205-219 + `src/components/insights/CollectionFitCard.test.tsx` L14-20 will silently pass `undefined` for the new fields.
**Why it doesn't break:** TypeScript optional-undefined is structurally satisfied by omitted properties.
**Verification:** Read the 3 fixture builders; all use `mkWatch(overrides: Partial<Watch>)` — the new optional fields are absorbed transparently. Zero fixture updates required. Verified via grep 2026-07-12.
**Warning sign:** If any test STRICTLY asserts `Object.keys(watch)`, add missing keys. None found in Horlo today.

## Code Examples

### Extended `getCatalogById` return shape

```typescript
// Source: src/data/catalog.ts L263-272 (verified 2026-07-12)
// CURRENT — 6-line implementation with no JOIN:
export async function getCatalogById(id: string): Promise<CatalogEntry | null> {
  const rows = await db.select().from(watchesCatalog).where(eq(watchesCatalog.id, id)).limit(1)
  if (rows.length === 0) return null
  return mapRowToCatalogEntry(rows[0])
}

// PHASE 81 — extend in place (Claude's Discretion; simpler than sibling function):
export interface CatalogEntryWithCanonical extends CatalogEntry {
  canonicalBrand: string   // brands.name via brand_id JOIN
  canonicalFamily: string  // watch_families.name via family_id JOIN
}

export async function getCatalogById(id: string): Promise<CatalogEntryWithCanonical | null> {
  const rows = await db
    .select({
      catalog: watchesCatalog,
      brandName: brands.name,
      familyName: watchFamilies.name,
    })
    .from(watchesCatalog)
    .leftJoin(brands, eq(brands.id, watchesCatalog.brandId))
    .leftJoin(watchFamilies, eq(watchFamilies.id, watchesCatalog.familyId))
    .where(eq(watchesCatalog.id, id))
    .limit(1)
  if (rows.length === 0) return null
  const { catalog, brandName, familyName } = rows[0]
  return {
    ...mapRowToCatalogEntry(catalog),
    // Post-Phase-80 NOT NULL FKs → LEFT JOIN cannot miss.
    // Fallback to denorm string is defensive belt-and-suspenders.
    canonicalBrand: brandName ?? catalog.brand,
    canonicalFamily: familyName ?? catalog.model,
  }
}
```

**Note:** The 6 existing callers all use `CatalogEntry`-shape properties (`.brand`, `.model`, `.imageUrl`, `.styleTags`, etc.); extending the return type is additive-safe — no existing caller destructures with `Omit<>` or `Exact<>` narrowing. Verified callers: `verdict.ts` L54 (destructures `.brand`/`.model` at shim); `watch/new/page.tsx` L167 (spreads into ExtractedWatchData); `w/[ref]/page.tsx` L322/L436/L516 (reads `.brand`/`.model`); `watches.ts` L143 (reads `.brand`/`.model` — Phase 81's target); `watches-recs-invalidation.test.ts` L48 (vi.mock — no shape care).

### Extended `upsertCatalogFromUserInput` return shape (CTE variant)

```typescript
// Source: src/data/catalog.ts L139-170 (verified 2026-07-12)
// PHASE 81 — extend the CTE RETURNING with subselects for canonical names.
// Planner picks between (A) CTE-with-subselects OR (B) follow-up SELECT.
// Below shows (A) — single round-trip.

export async function upsertCatalogFromUserInput(
  input: UserPromotedCatalogInput,
): Promise<{ catalogId: string; brandName: string; familyName: string } | null> {
  const { brand, model, reference } = input
  const { brandId } = await resolveBrandId(brand)
  const { familyId } = await resolveFamilyId(brandId, model)
  const result = await db.execute<{
    id: string
    brand_name: string
    family_name: string
  }>(sql`
    WITH ins AS (
      INSERT INTO watches_catalog (brand, model, reference, source, brand_id, family_id)
      VALUES (${brand}, ${model}, ${reference}, 'user_promoted', ${brandId}, ${familyId})
      ON CONFLICT ON CONSTRAINT watches_catalog_natural_key DO NOTHING
      RETURNING id, brand_id, family_id
    ),
    resolved AS (
      SELECT id, brand_id, family_id FROM ins
      UNION ALL
      SELECT id, brand_id, family_id FROM watches_catalog
       WHERE brand_normalized = lower(trim(${brand}))
         AND model_normalized = lower(trim(${model}))
         AND reference_normalized IS NOT DISTINCT FROM (
           CASE WHEN ${reference}::text IS NULL THEN NULL
                ELSE regexp_replace(lower(trim(${reference}::text)), '[^a-z0-9]+', '', 'g')
           END
         )
       LIMIT 1
    )
    SELECT r.id,
           (SELECT name FROM brands WHERE id = r.brand_id) AS brand_name,
           (SELECT name FROM watch_families WHERE id = r.family_id) AS family_name
    FROM resolved r
    LIMIT 1
  `)
  const rows = result as unknown as Array<{
    id: string
    brand_name: string
    family_name: string
  }>
  if (rows.length === 0) return null
  return {
    catalogId: rows[0].id,
    brandName: rows[0].brand_name,
    familyName: rows[0].family_name,
  }
}
```

### `topBrandOf` widened signature

```typescript
// Source: src/lib/recommendations.ts L96-106 (verified 2026-07-12)
// CURRENT:
export function topBrandOf(watches: readonly Watch[]): string | null {
  const owned = watches.filter((w) => w.status === 'owned')
  if (owned.length === 0) return null
  const counts = new Map<string, number>()
  for (const w of owned) counts.set(w.brand, (counts.get(w.brand) ?? 0) + 1)
  const sorted = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )
  return sorted[0]?.[0] ?? null
}

// PHASE 81 — D-81-05 signature widen:
export function topBrandOf(
  watches: readonly Watch[],
  brandNameLookup: Map<string, string>,
): { brandId: string; brandName: string } | null {
  const owned = watches.filter((w) => w.status === 'owned' && w.brandId)
  if (owned.length === 0) return null
  const counts = new Map<string, number>()
  for (const w of owned) {
    counts.set(w.brandId!, (counts.get(w.brandId!) ?? 0) + 1)
  }
  // Tiebreak by resolved brandName for stability (was: raw brand string).
  const sorted = [...counts.entries()].sort(
    (a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1]
      const aName = brandNameLookup.get(a[0]) ?? ''
      const bName = brandNameLookup.get(b[0]) ?? ''
      return aName.localeCompare(bName)
    },
  )
  const winner = sorted[0]
  if (!winner) return null
  const brandName = brandNameLookup.get(winner[0])
  if (!brandName) return null // Pitfall 6 defensive
  return { brandId: winner[0], brandName }
}
```

**Callers to update:**
- `src/data/recommendations.ts` L111 (`getRecommendationsForViewer` — passes brandNameLookup)
- Import site at L12: `import { rationaleFor, topBrandOf, dominantStyleOf } from '@/lib/recommendations'` — no change needed.
- `viewerTopBrand` at L111 must switch from `string | null` to `{ brandId, brandName } | null`; downstream `topUpFromCatalogPopularity(…, viewerTopBrand, …)` (L254) currently accepts `string | null` (see L397); update its type.
- `tests/lib/recommendations.test.ts` uses `rationaleFor` directly, NOT `topBrandOf` — `rationaleFor` calls `topBrandOf(ctx.viewerOwnedWatches)` internally at L55. **This is a caller inside `rationaleFor` itself** — needs same signature update, and `rationaleFor` must accept the brandNameLookup in its ctx OR the calling DAL passes canonical `candidateBrand` as-is (letting `rationaleFor` skip the lookup). Recommend the LATTER: `rationaleFor` continues to work on a `topBrand: {brandName, brandId} | null` value, threaded through ctx. Let the DAL compute `topBrand` once + inject.

**Simpler recommendation:** Restructure `rationaleFor`'s internal `topBrandOf` call to accept an already-computed `topBrand` value via `RationaleContext`, avoiding re-computation per-candidate:

```typescript
export interface RationaleContext {
  candidateBrand: string
  candidateModel: string
  candidateRoleTags: string[]
  candidateStyleTags: string[]
  viewerOwnedWatches: readonly Watch[]
  viewerOwnershipCount: number
  // NEW — Phase 81: caller pre-computes once.
  viewerTopBrand: { brandId: string; brandName: string } | null
}
```

`rationaleFor` reads `ctx.viewerTopBrand?.brandName` for the brand-match template. Cleaner (also removes an N² compute inside the per-candidate loop). **Backwards-incompat for `tests/lib/recommendations.test.ts` — those tests will need `viewerTopBrand` computed in test setup.** The tests currently rely on `topBrandOf(ctx.viewerOwnedWatches)` deriving from the ownedWatches array; test fixtures don't carry `brandId`, so tests must decide: (a) inject `viewerTopBrand: null` and drop brand-match assertions, OR (b) update fixtures to set `brandId` explicitly. Recommend (b) since brand-match tests are the load-bearing case (Test 1 + Test 6).

### Rail exclusion-set builder

```typescript
// Source: src/data/recommendations.ts L196-205 (verified 2026-07-12)
// CURRENT:
const norm = (w: { brand: string; model: string }) =>
  `${w.brand.trim().toLowerCase()}|${w.model.trim().toLowerCase()}`
const excluded = new Set<string>()
for (const v of viewerWatches) {
  if (v.status === 'owned' || v.status === 'wishlist' || v.status === 'grail') {
    excluded.add(norm(v))
  }
}

// PHASE 81 — D-81-02 exclusion by FK ids:
const norm = (w: { brandId?: string; familyId?: string; brand: string; model: string }) =>
  w.brandId && w.familyId
    ? `${w.brandId}|${w.familyId}`
    : `${w.brand.trim().toLowerCase()}|${w.model.trim().toLowerCase()}` // fallback for catalogId=null legacy
const excluded = new Set<string>()
for (const v of viewerWatches) {
  if (v.status === 'owned' || v.status === 'wishlist' || v.status === 'grail') {
    excluded.add(norm(v))
  }
}
```

Same `norm(w)` is used both to build `excluded` and to key candidateMap entries (L222) and synthetic-row keys in `topUpFromCatalogPopularity` (L504). All 3 callsites must switch to the same `norm` shape. Extract to a private helper if convenient.

### Synthetic Watch construction in top-up

```typescript
// Source: src/data/recommendations.ts L509-520 (verified 2026-07-12)
// CURRENT:
const syntheticWatch: Watch = {
  id: row.id,
  brand: row.brand,      // ← from watches_catalog.brand (may be drift)
  model: row.model,      // ← from watches_catalog.model (may be drift)
  status: 'owned',
  movement: 'auto',
  complications: [],
  styleTags: row.styleTags ?? [],
  designTraits: [],
  roleTags: [],
  imageUrl: row.imageUrl ?? undefined,
}

// PHASE 81 — carries JOIN-derived canonical strings + FK ids:
// (After adding brandId + familyId to the SELECT projection of both queries L411-424 + L440-460)
const syntheticWatch: Watch = {
  id: row.id,
  brand: row.brand,        // ← now brands.name (INNER JOIN)
  model: row.model,        // ← now watch_families.name (INNER JOIN)
  brandId: row.brandId,    // ← NEW: watches_catalog.brand_id (for exclusion match)
  familyId: row.familyId,  // ← NEW: watches_catalog.family_id (for exclusion match)
  status: 'owned',
  movement: 'auto',
  complications: [],
  styleTags: row.styleTags ?? [],
  designTraits: [],
  roleTags: [],
  imageUrl: row.imageUrl ?? undefined,
}
```

### `editWatch` canonical overwrite path

```typescript
// Source: src/app/actions/watches.ts L595-668 (verified 2026-07-12)
// PHASE 81 — insertion point BEFORE L620 (`let updatedWatch: Watch`):
// (Right after the wishlist-sortOrder assignment block ends L609)

// NEW: canonical-name overwrite (DISP-02). If the user edited brand/model
// AND the watch has a catalogId, fetch canonical strings and overwrite.
// Non-catalog-linked watches (priorRow.catalogId=null) skip — DISP-01/02
// don't apply; the user's typed strings persist.
if (priorRow.catalogId && (cleanData.brand !== undefined || cleanData.model !== undefined)) {
  const catalogRow = await catalogDAL.getCatalogById(priorRow.catalogId)
  if (catalogRow) {
    if (cleanData.brand !== undefined) {
      // Overwrite in cleanData (so ownership+persistence path picks it up)
      cleanData.brand = catalogRow.canonicalBrand
      updatePayload = { ...updatePayload, brand: catalogRow.canonicalBrand }
    }
    if (cleanData.model !== undefined) {
      cleanData.model = catalogRow.canonicalFamily
      updatePayload = { ...updatePayload, model: catalogRow.canonicalFamily }
    }
  }
}
// End Phase 81 addition. Falls through to existing owned→sold detection at L620.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Free-text `brand`/`model` string comparison in recommender | FK-keyed `brandId`/`familyId` comparison | Phase 81 (this phase) | Eliminates drift-class bugs (Hamilton vs Hamilton Watch). |
| User-typed brand/model persisted verbatim | Auto-overwrite from canonical `brands.name`/`watch_families.name` | Phase 81 (this phase) | Display strings never drift again. |
| `catalog.brand` denorm read for `catalogRow.brand` at L153 | Extended `getCatalogById` exposes `canonicalBrand`; caller reads canonical | Phase 81 | Fixes bug in `addWatch` catalogId branch. |
| `topBrandOf(watches): string` | `topBrandOf(watches, brandNameLookup): {brandId, brandName}` | Phase 81 | Excludes legacy `catalogId=null` watches from stale-string totals. |
| `= ANY(${arr})` Drizzle template (banned) | `IN (sql.join(arr.map(x => sql\`${x}\`), sql\`, \`))` | Prod crash 2026-06-23; forward-fix 81f78084 | Anti-pitfall lock preserved in Phase 81. |
| `revalidateTag(tag)` (single-arg, deprecated) for read-your-own-writes | `updateTag(tag)` (Next 16 named primitive) | Phase 75 | Phase 81 preserves — no new invalidation calls. |

**Deprecated/outdated:** None from Phase 81's scope. The phase closes v8.4's canonical-loop; no deprecations introduced.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `brands.id` and `watch_families.id` are pk-indexed by default via Postgres uuid PRIMARY KEY declaration | §Standard Stack / §Don't Hand-Roll | LOW — Postgres default. `brandNameLookup` SELECT would be slower but still trivial. |
| A2 | Local Supabase pg_trgm + f_unaccent extensions do NOT affect the brand/family JOIN paths in Phase 81 | Verified — Phase 81 uses `brand_id = uuid` and `family_id = uuid` JOINs only; no fuzzy/text extension usage | none |
| A3 | The 5 upsert-helper callsites (2 in extract-watch route, 1 in wishlist.ts, 2 in Server Actions) are all callers to update; no hidden dynamic-imports | Verified via `grep -rn "upsertCatalogFrom"` — 5 total callers found | LOW if wrong: TypeScript compilation would catch missed callers at plan-time. |
| A4 | Perf baseline artifact from Phase 19.1 does NOT exist in `.planning/` — success criterion #5 is interpreted as "informal comparison + local walkthrough is sufficient" | Verified — grep of `.planning/` for `p95` / `baseline` / `intel` — no data file, only prose references | LOW — CONTEXT explicitly says "if planner suspects regression, run against local seeded catalog (~205 rows)". |
| A5 | Existing test infrastructure (`vi.mock('@/db')` fluent-chain factory pattern at `src/data/__tests__/recommendations.test.ts`) can be extended to mock the new INNER JOINs by adding `.innerJoin` passthrough to the chain factory (currently only `.leftJoin` is required, but the factory's `passthrough` idiom already handles this) | Verified — chain factory L76 has `chain.innerJoin = passthrough` at L76 | none — already handled |
| A6 | `Watch` type consumers with strict-property object tests (found 3: CollectionFitCard, WishlistTabContent, CollectionTabContent) all use `Partial<Watch>` override factories that transparently accept new optional fields | Verified — see Pitfall 8 | none |
| A7 | `verdict.ts` L54 `getCatalogById` caller's downstream shim (`catalogEntryToSimilarityInput`) reads only pre-existing CatalogEntry fields, not new `canonicalBrand`/`canonicalFamily` — extending the return is additive-safe | Verified via `src/lib/verdict/shims.ts` L43-64 — shim reads `.brand`/`.model`/`.movementType` etc. from the existing type surface | none |
| A8 | The `.env.development.local` override for `npm run dev` → local Supabase (`127.0.0.1:54321`) is intact per CLAUDE.md's Local-First Development section; no env changes needed | CITED: CLAUDE.md L§Local-First Development | none |
| A9 | The Hamilton canonical resolution completed in Phase 79 `--apply` — local DB already has `brand_id` for canonical `Hamilton`; the drift fixture INSERTs a NEW `watches_catalog` row with denorm `brand='Hamilton Watch'` on that canonical UUID, then the test viewer's personal `watches.brand='Hamilton'` (Phase 79 hydrated) | Verified via memory `[[project_phase_79_v8_4_prod_shipped]]` + `supabase/seed.sql` L88 shows viewer + L134 shows Modern Mike both have `Hamilton Watch` as the seed-time brand string (Phase 79 hydration since ran on prod, but the SEED still shows `Hamilton Watch` — local re-seed re-introduces drift on watches.brand) | MEDIUM — verify by inspecting local `watches` table state on the current dev branch before writing the fixture SQL. See §Open Questions. |

**Interpretation:** All claims tagged `[ASSUMED]` above with the "Risk if Wrong: MEDIUM" tag warrant confirmation. In particular A9 needs a local-DB inspection before the plan's fixture recipe is finalized — the seed re-introduces `Hamilton Watch` on watches.brand, and Phase 79's `--apply` may or may not have been re-run against a clean local DB in the interim. Planner should verify by connecting to local Supabase and running `SELECT brand, catalog_id FROM watches WHERE user_id='00000000-0000-0000-0000-000000000001' AND brand LIKE 'Hamilton%'`.

## Open Questions

1. **Local seed state re-verification.**
   - What we know: `supabase/seed.sql` L88 explicitly INSERTs `watches.brand = 'Hamilton Watch'` for the viewer user. Phase 79 `--apply` on local ran successfully 2026-06-25 and hydrated existing rows.
   - What's unclear: Whether the current `main` branch's local DB reflects post-Phase-79 canonicalization (`watches.brand = 'Hamilton'`) or has been re-seeded since (would restore `Hamilton Watch`).
   - Recommendation: Planner runs a quick `psql`/`docker exec` check before finalizing the fixture recipe. If the local DB is post-hydrated, the fixture only needs the NEW `watches_catalog` drift row. If not, the plan should include a `UPDATE watches SET brand='Hamilton' WHERE user_id=<viewer>` pre-step OR redirect the fixture to a NET-NEW viewer + peer combo unaffected by the seed's Hamilton Watch strings.

2. **Whether `linkExtractedUrl` Server Action (watches.ts L830) needs canonical overwrite.**
   - What we know: `linkExtractedUrl` at L787 (per CONTEXT+search) calls `upsertCatalogFromExtractedUrl` — an alternate path to catalog upsert.
   - What's unclear: The action's scope + whether it hydrates `watches.brand`/`model` at all.
   - Recommendation: Planner reads `linkExtractedUrl` at src/app/actions/watches.ts L780-870 to determine if DISP-01 semantics apply. If it also inserts/updates `watches` rows, the same overwrite pattern applies. If it only upserts catalog, the return-type extension is a compile-only concern (just unwrap `.catalogId`).

3. **Whether `rationaleFor` should absorb the `topBrand` computation via ctx or re-compute internally.**
   - What we know: Current `rationaleFor` L55 calls `topBrandOf(ctx.viewerOwnedWatches)` internally per candidate — an N² compute in the outer loop at L261-282.
   - What's unclear: Under Phase 81's D-81-05 signature widen (`topBrandOf` now needs `brandNameLookup`), re-computing inside `rationaleFor` per candidate would require every ctx to carry the lookup Map.
   - Recommendation: Restructure `RationaleContext` to include a pre-computed `viewerTopBrand: { brandId, brandName } | null` (computed once in `getRecommendationsForViewer` at L111 and passed through). Cleaner + faster. Requires `tests/lib/recommendations.test.ts` fixture updates (see §Code Examples §topBrandOf).

4. **Test isolation for the `topBrandOf` fixture updates.**
   - What we know: `tests/lib/recommendations.test.ts` L21-155 has 8 test cases; Test 1 + Test 6 exercise the brand-match template.
   - What's unclear: Whether adding `brandId` + `viewerTopBrand: { brandId, brandName }` to the fixtures is trivial in-line OR needs a shared factory update.
   - Recommendation: Update the `mkWatch` factory to accept a `brandId?` override (default derives from `brand` via `slugify` or explicit); update the 2 brand-match tests to compute `viewerTopBrand` inline before calling `rationaleFor`. Roughly 10-20 lines of test churn total.

## Environment Availability

Phase 81 depends only on the existing Next 16 / Node dev toolchain + local Supabase. No new external tools.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `npm run dev` | Local-first walkthrough (D-81-04) | ✓ (in-repo) | Next 16.2.3 | — |
| Local Supabase (`127.0.0.1:54321/54322`) | Local-first walkthrough | ✓ (per Local-First Development in CLAUDE.md) | v0.x per repo config | — |
| psql / docker exec (for fixture INSERT) | Test-time drift fixture setup | ✓ (`docker exec supabase_db_horlo psql`) | — | — |
| Vitest 3 + jsdom | Unit tests | ✓ (in-repo) | per `package.json` | — |
| Drizzle ORM `sql`/`sql.join` | INNER JOIN + IN clause | ✓ (existing) | per `package.json` | — |
| Anthropic API | NOT NEEDED — Phase 81 does not modify enrichment paths | N/A | N/A | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

## Validation Architecture

`workflow.nyquist_validation: true` per `.planning/config.json` — this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm run test -- src/data/__tests__/recommendations.test.ts src/lib/__tests__ tests/lib/recommendations.test.ts src/app/actions/__tests__/watches-recs-invalidation.test.ts` |
| Full suite command | `npm run test` |
| Full build check | `npm run build` |
| Local-first walkthrough | `npm run dev` + local Supabase drift fixture (D-81-04) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| RECO-01 | Exclusion key format switches to `brandId|familyId` | unit (mock DAL) | `vitest src/data/__tests__/recommendations.test.ts -t "exclusion"` | ✅ extend |
| RECO-01 | Viewer's own watch (drift-branded catalog row) excluded from rail | e2e-local | Manual `npm run dev` walkthrough (D-81-04 step 1) | ❌ Wave 0 fixture SQL |
| RECO-02 | Multi-brand IN clause switches to `brand_id IN (...)` | unit (mock DAL — assert query shape) | Existing fluent-chain mock in recommendations.test.ts already captures `.where` args | ✅ extend |
| RECO-02 | `Hamilton` + `Hamilton Watch` both fire multi-brand `+100` | e2e-local | Manual `npm run dev` walkthrough (D-81-04 step 2) | ❌ Wave 0 fixture SQL |
| RECO-03 | `topBrandOf` returns `{ brandId, brandName }` and counts by brandId | unit (pure function) | `vitest tests/lib/recommendations.test.ts` | ✅ extend (2 tests to update) |
| RECO-03 | `topBrandOf` excludes legacy `brandId=undefined` watches | unit (pure function) | `vitest tests/lib/recommendations.test.ts -t "legacy"` | ❌ Wave 0 test |
| RECO-04 | Rationale shows `Fans of Hamilton love this` (canonical) | unit (pure function) | `vitest tests/lib/recommendations.test.ts -t "brand-match"` | ✅ extend Test 1/6 |
| RECO-04 | Synthetic top-up watches carry canonical brand string via JOIN | unit (mock DAL asserts synthetic Watch.brand from JOIN column) | `vitest src/data/__tests__/recommendations.test.ts -t "sparse-pool top-up"` | ✅ extend |
| DISP-01 | `addWatch` with catalogId branch overwrites brand/model from canonical | unit (mock DAL) | `vitest src/app/actions/__tests__/watches-recs-invalidation.test.ts` OR new test | ❌ Wave 0 test |
| DISP-01 | `addWatch` user-input branch overwrites brand/model from resolver return | unit (mock DAL) | new test | ❌ Wave 0 test |
| DISP-01 | User types `Hamilton Watch`, DB persists `Hamilton` | e2e-local | Manual `npm run dev` walkthrough (D-81-04 step 3) | ❌ Wave 0 fixture SQL |
| DISP-02 | `editWatch` overwrite path fetches canonical + overwrites | unit (mock DAL) | new test | ❌ Wave 0 test |
| DISP-02 | User edits typing `Hamilton Watch`, DB persists `Hamilton` | e2e-local | Manual `npm run dev` walkthrough (D-81-04 step 4) | ❌ Wave 0 fixture SQL |
| RECO/DISP existing tests | Regression | unit | `npm run test` | ✅ existing suites |

### Sampling Rate

- **Per task commit:** Task-scoped subset via `vitest --run <path>` for the file(s) touched.
- **Per wave merge:** `vitest --run src/data src/lib src/app/actions tests/lib` (recommendations + Server-Action families).
- **Phase gate:** `npm run test` full suite green + `npm run build` exit 0 + local-first drift-fixture walkthrough green + prod smoke post-deploy.

### Wave 0 Gaps

- [ ] `.planning/phases/81-recommender-display-server-action-swap/fixtures/drift-hamilton.sql` — one-off INSERT script for the drift fixture (D-81-04 step 1). NOT committed as a migration; committed alongside phase docs as a repeatable test artifact.
- [ ] `src/lib/__tests__/recommendations.test.ts` — CREATE. `tests/lib/recommendations.test.ts` covers `rationaleFor` (existing); consider a NEW file OR extend the existing for `topBrandOf` unit cases (legacy `brandId=undefined` handling, brandNameLookup wiring). CONTEXT names it as `src/lib/__tests__/recommendations.test.ts (if present)` — verified NOT present; only `weekIndex.test.ts` exists in `src/lib/__tests__/`. Planner picks: extend `tests/lib/recommendations.test.ts` OR create `src/lib/__tests__/recommendations.test.ts` as a sibling scope. Recommend extend `tests/lib/recommendations.test.ts` (its `rationaleFor` tests already exercise the brand-match path).
- [ ] `src/app/actions/__tests__/watches-canonical-overwrite.test.ts` — NEW file for DISP-01/02 unit tests. Can also fold into existing `watches-recs-invalidation.test.ts` (already mocks `getCatalogById`, `upsertCatalogFromUserInput`, `updateTag` — the exact surface Phase 81 needs). Recommend fold in — pattern is 1:1 with existing test structure.
- [ ] No new framework install needed.

## Security Domain

`workflow` config has no explicit `security_enforcement` key; default = enabled. Phase 81 is a code-only phase touching write-time Server Actions.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing `getCurrentUser()` gate at `addWatch`/`editWatch` entry — unchanged. |
| V3 Session Management | no | No new sessions or cookies. |
| V4 Access Control | yes | Existing DAL scoping (`.where(and(eq(userId), eq(id)))`) unchanged. Canonical overwrite happens AFTER `priorRow = await watchDAL.getWatchById(user.id, watchId)` — ownership already verified. |
| V5 Input Validation | yes | Existing Zod schema at `insertWatchSchema`/`updateWatchSchema` L37-89 unchanged. Canonical strings come from `brands.name` (server-controlled, never client input). |
| V6 Cryptography | no | No crypto operations. |
| V13 API + Web Service | yes | Server-Action boundary; ActionResult return unchanged. |

### Known Threat Patterns for Next 16 + Drizzle + Postgres

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via `sql\`...\`` template | Tampering | Drizzle parameterized binds — Phase 81 preserves; INNER JOIN, IN clause, LEFT JOIN all use `${col}` bindings, no `sql.raw`. |
| Cache poisoning of per-viewer recs | Repudiation | Existing `updateTag(\`viewer:${user.id}:recs\`)` at L340/L676 unchanged; Phase 81 changes only the STRING CONTENT written, not the invalidation graph. |
| Ownership bypass on `editWatch` overwrite path | Elevation | Overwrite happens AFTER `priorRow = getWatchById(user.id, watchId)` gate. Canonical strings resolved from `priorRow.catalogId` (owner-scoped). Never dereferences a user-supplied catalogId in edit. |
| Silent stale-content drift | Info Disclosure | Phase 81's WHOLE point: canonical brand replaces drift. Verified by local walkthrough + prod smoke. |
| Client-supplied catalogId spoofing in `addWatch` | Tampering | Existing gate at L143 (`getCatalogById` returns null → 400) unchanged. |
| Non-owner read of canonical-JOIN data via extended `getCatalogById` | Info Disclosure | `getCatalogById` is public-read via RLS (per D-13 CATALOG-RLS in schema); joining `brands.name` + `watch_families.name` (both public-read tables) does not leak PII. |

**No new attack surface introduced.** Phase 81's changes are read-time JOINs on public-read tables + write-time overwrites on already-owner-scoped rows.

## Sources

### Primary (HIGH confidence — Read from current source)

- `src/data/recommendations.ts` L1-533 — full read + trace (2026-07-12)
- `src/lib/recommendations.ts` L1-134 — full read (2026-07-12)
- `src/lib/types.ts` L1-258 — full read (2026-07-12)
- `src/data/watches.ts` L1-739 — full read; getWatchesByUser (L128-184), getWatchById (L190-213), mapRowToWatch (L17-60) (2026-07-12)
- `src/data/catalog.ts` L1-982 — full read; upsertCatalogFromUserInput (L139-170), upsertCatalogFromExtractedUrl (L184-258), getCatalogById (L268-272) (2026-07-12)
- `src/app/actions/watches.ts` L1-704 — full read; addWatch (L97-370), editWatch (L553-704) (2026-07-12)
- `src/app/api/extract-watch/route.ts` L1-450 — trace of catalog upsert callsites (L226 + L367) (2026-07-12)
- `src/app/actions/wishlist.ts` L125-165 — upsertCatalogFromUserInput caller (L138) (2026-07-12)
- `src/app/actions/verdict.ts` L40-70 — getCatalogById caller (L54) (2026-07-12)
- `src/db/schema.ts` L148-175 (watches FK) + L488-511 (watches_catalog NOT NULL brandId/familyId) + L519-564 (brands + watch_families) (2026-07-12)
- `src/data/__tests__/recommendations.test.ts` L1-200 — test infrastructure pattern (2026-07-12)
- `tests/lib/recommendations.test.ts` L1-155 — pure-function test surface (2026-07-12)
- `src/app/actions/__tests__/watches-recs-invalidation.test.ts` L1-120 — DISP-adjacent test pattern (2026-07-12)
- `src/components/insights/CollectionFitCard.test.tsx` L1-30 — Watch fixture consumer pattern (2026-07-12)
- `src/lib/verdict/shims.ts` L40-64 — catalogEntryToSimilarityInput target shape (2026-07-12)
- `supabase/seed.sql` L1-150 — local seed structure + Hamilton Watch drift source (2026-07-12)

### Secondary (HIGH confidence — CONTEXT.md + REQUIREMENTS.md + STATE.md verbatim)

- `.planning/phases/81-recommender-display-server-action-swap/81-CONTEXT.md` L1-255 (full)
- `.planning/REQUIREMENTS.md` L1-149 (full)
- `.planning/ROADMAP.md` L345-395 (Phase 81 + traceability)
- `.planning/STATE.md` L1-100 (v8.4 milestone state)

### Tertiary (memories cited)

- `[[drizzle-sql-any-array-pitfall]]` — anti-pitfall reference
- `[[local-first-dev]]` — Phase 81 gate
- `[[next16-revalidatetag-deprecated]]` — updateTag primitive
- `[[catalog-id-divergence]]` — irrelevant to Phase 81 (JOIN by FK is portable)
- `[[project_phase_79_v8_4_prod_shipped]]` — Hamilton canonical resolution history
- `[[verdict-hidden-on-owned-watches]]` — adjacent-but-orthogonal
- `[[project_next_clear_operational_debt]]` — `workflow.use_worktrees=false` (already set)

## Project Constraints (from CLAUDE.md + AGENTS.md)

Explicit directives Phase 81 must respect:

1. **Next.js 16 (NOT the Next.js you know)** — read `node_modules/next/dist/docs/` before writing code. Heed deprecation notices. Phase 81 preserves `updateTag(tag)` for read-your-own-writes; does NOT re-introduce deprecated single-arg `revalidateTag(tag)`.
2. **Local-First Development** — `npm run dev` + local Supabase verification is mandatory for runtime-behavior changes. Phase 81 falls SQUARELY in this category (silent self-in-own-rail risk). D-81-04's walkthrough is the load-bearing gate.
3. **GSD Workflow Enforcement** — start work through a GSD command. This research is being produced under `/gsd-plan-phase`; plans + execution follow via `/gsd-execute-phase 81`.
4. **`npm run build` is the authoritative gate** (per `[[baseline-not-green-build-is-gate]]`) — `tsc --noEmit` carries pre-existing test-file errors; DO NOT attribute build noise to Phase 81. Phase 81's own type errors (return-type widening ripples) will surface as NEW `.ts` errors.
5. **Drizzle `= ANY(${arr})` banned** — pattern already anti-pitfall-correct in the reference impl at L454; Phase 81's brand_id IN clause uses the same shape.
6. **`workflow.use_worktrees=false`** — set globally in `.planning/config.json`; Phase 81 is build-gated + runtime-behavior. No worktrees.
7. **CLAUDE.md Local-First exception** — mobile Safari verifies on prod. Phase 81 has NO mobile-specific paths; local walkthrough covers everything.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; only in-repo primitives.
- Architecture: HIGH — read directly from current source with verified line numbers.
- Pitfalls: HIGH — all 8 pitfalls sourced from either verified code inspection OR memory-cited prior incidents.
- Test infrastructure: HIGH — patterns read from existing test files.
- Perf baseline: LOW-flag — no artifact exists; success criterion #5 is prose-only.

**Research date:** 2026-07-12
**Valid until:** 2026-08-11 (30 days; stable domain — DAL + Server Action code, no fast-moving deps)

---

## RESEARCH COMPLETE

**Phase:** 81 - Recommender + Display Server Action Swap
**Confidence:** HIGH

### Key Findings

1. **Zero line-number drift from CONTEXT.md against current source.** All 15 verify-required citations (recommendations.ts L90-288, L390-533, L454-458, L509-520; watches.ts L128-184, L190-219; catalog.ts L139-170, L184-258, L268-272; types.ts L51-115; actions/watches.ts L141-177, L553-704; L340/L676 for updateTag) match. Planner can trust CONTEXT's line refs verbatim.

2. **5 upsert-helper callsites need update, not 4.** `upsertCatalogFromUserInput` has 3 callers (watches.ts L164, wishlist.ts L138, extract-watch route L367); `upsertCatalogFromExtractedUrl` has 2 (extract-watch route L226; watches.ts L830 `linkExtractedUrl`). All 5 assign the return to `catalogId: string | null`; the type widening breaks all 5 destructures — a task must audit and update.

3. **`getCatalogById` extend-in-place is safe (6 callers).** All 6 read only pre-existing `CatalogEntry` shape properties; extending the type with `canonicalBrand`/`canonicalFamily` is additive and back-compat.

4. **Hidden Pitfall: `rationaleFor` internally calls `topBrandOf` per-candidate.** Under D-81-05's signature widen, `topBrandOf` needs `brandNameLookup`. Recommend restructuring `RationaleContext` to carry pre-computed `viewerTopBrand: { brandId, brandName } | null` (computed once in DAL, passed through). Removes N² compute inside the outer loop AND avoids threading brandNameLookup through ctx. Trade-off: `tests/lib/recommendations.test.ts` fixtures need `brandId` + `viewerTopBrand` computed inline (10-20 lines of churn).

5. **`Watch` type extension is fixture-safe.** 3 Watch fixture builders verified (`CollectionFitCard.test.tsx` L14-20; `WishlistTabContent.test.tsx` L52; `CollectionTabContent.test.tsx` L50) all use `Partial<Watch>` factories — optional fields absorbed transparently.

6. **Synthetic Watch construction in `topUpFromCatalogPopularity` L509-520 MUST project `brandId`/`familyId` from the INNER-JOINed columns.** Otherwise the exclusion-set match fails for synthetic rows (Pitfall 5 self-in-own-rail bait).

7. **Local seed re-verification is needed** (Open Question #1). `supabase/seed.sql` L88 explicitly INSERTs `watches.brand='Hamilton Watch'` for viewer. Whether local DB reflects post-Phase-79-hydration OR post-seed drift is state-dependent. Planner should verify local state before finalizing fixture recipe.

8. **No perf baseline artifact exists** — success criterion #5's Phase 19.1 reference is prose-only. Phase 81's perf posture is informal ("verify no measurable rail-load slowdown; instrument only if concerning").

### File Created

`/Users/tylerwaneka/Documents/horlo/.planning/phases/81-recommender-display-server-action-swap/81-RESEARCH.md`

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | No new libraries; all primitives verified in current source. |
| Architecture (JOIN + IN clause + overwrite paths) | HIGH | All patterns already have precedents in the codebase (Phase 60 catalogImageUrl LEFT JOIN, Phase 75 sql.join, Phase 79 canonical-brand-identity UUID keying). |
| Pitfalls | HIGH | 6 of 8 pitfalls have prior-incident memories; 2 (self-in-own-rail, brandNameLookup miss) surface as logical corollaries of Phase 81's own design. |
| Test infrastructure | HIGH | fluent-chain mock at recommendations.test.ts + DAL-mock pattern at watches-recs-invalidation.test.ts already cover Phase 81's testing surface with minor extensions. |
| Perf baseline | LOW-flag | Success criterion #5 is prose only; no artifact to compare against. Recommend informal local walkthrough. |

### Open Questions Requiring Planner Attention

1. **Local seed state re-verification** — planner should check local `watches.brand` values before finalizing D-81-04 fixture recipe.
2. **`linkExtractedUrl` (watches.ts L830) scope** — determine whether it needs DISP-01 canonical overwrite or just return-type unwrap.
3. **`RationaleContext` restructure** — decide between (a) threading `brandNameLookup` through ctx OR (b) pre-computing `viewerTopBrand` in DAL and passing through ctx (recommended).
4. **Test fixture updates for `topBrandOf` signature change** — decide extent of `mkWatch` factory updates in `tests/lib/recommendations.test.ts`.

### Ready for Planning

Research complete. Planner has verified line numbers, all callsites of extended interfaces, exact JOIN shapes to use, drift-fixture recipe, and testing surface. The planner may proceed to author 3-4 plans (Type+DAL projection → Recommender read-path → Server Action write-path → Local-first verification + prod deploy) with high confidence that CONTEXT.md's directives land on real code.
