---
phase: 39b
plan: 05
type: execute
wave: 3
depends_on:
  - 39b-01
  - 39b-02
  - 39b-04
files_modified:
  - src/data/hierarchy.ts
  - src/components/insights/SameFamilyRail.tsx
  - src/components/insights/LineageRail.tsx
  - src/app/watch/[id]/page.tsx
  - src/app/catalog/[catalogId]/page.tsx
  - tests/static/hierarchy.lineage-3-node.test.ts
autonomous: true
requirements:
  - DISC-11
nsv_rows:
  - NSV-02
  - NSV-16
disc_audit_rows:
  - DISC-AUDIT-130
commit_strategy: per-task

must_haves:
  truths:
    - "`getSameFamilyForCatalog(catalogId)` is exported from `src/data/hierarchy.ts` (closes the intentional RED static-guard assertion from Plan 39b-01 Task 2)"
    - "`SameFamilyRail` and `LineageRail` server components render a horizontal-scroll DiscoveryWatchCard rail with header 'Same family' / 'Lineage', hide when query returns 0 rows (D-39b-07)"
    - "On /watch/{id}: SameFamilyRail + LineageRail mount as Server-Component SIBLINGS of <WatchDetail/> (in page.tsx, NOT inside the client island), positioned AFTER the verdict/ReferenceIdentityCard block and BEFORE the 3-CTA block — for owner-populated, fresh-account, and cross-user viewers (UI-SPEC § Render Order /watch/{id})"
    - "On /catalog/{id}: SameFamilyRail + LineageRail mount after the OtherOwnersRoster (Plan 39b-04) and before the CTA block (UI-SPEC §Render Order)"
    - "LineageRail card sublabel is `<Badge variant='outline'>{relationshipLabel}</Badge>` per D-39b-16 map (predecessor → Predecessor, successor → Successor, remake → Modern remake, tribute → Tribute to, homage → Homage to)"
    - "SameFamilyRail card sublabel is the string '{N} collector' (singular) or '{N} collectors' (plural)"
    - "Both rails cap at 6 cards (D-39b-17); same-family rail uses live `COUNT(watches.catalog_id) DESC` (D-39b-15 Q2 verdict)"
  artifacts:
    - path: "src/data/hierarchy.ts"
      provides: "getSameFamilyForCatalog DAL"
      contains: "getSameFamilyForCatalog"
    - path: "src/components/insights/SameFamilyRail.tsx"
      provides: "Server RSC rail rendering horizontal DiscoveryWatchCard scroll with '{N} collectors' sublabel + hide-if-empty"
      contains: "Same family"
    - path: "src/components/insights/LineageRail.tsx"
      provides: "Server RSC rail rendering horizontal DiscoveryWatchCard scroll with relationship Badge sublabel + hide-if-empty"
      contains: "Lineage"
  key_links:
    - from: "src/app/watch/[id]/page.tsx (Server Component)"
      to: "src/components/insights/SameFamilyRail.tsx + LineageRail.tsx"
      via: "Server fetch of getSameFamilyForCatalog + getLineageForReference; rails render as Server-Component SIBLINGS of <WatchDetail/> at the page tree level (NOT imported into the client island)"
      pattern: "SameFamilyRail\\s+rows="
    - from: "src/app/catalog/[catalogId]/page.tsx"
      to: "src/components/insights/SameFamilyRail.tsx + LineageRail.tsx"
      via: "Same server fetches; mount AFTER OtherOwnersRoster (Plan 39b-04)"
      pattern: "LineageRail\\s+rows="
    - from: "src/data/hierarchy.ts getSameFamilyForCatalog"
      to: "watches_catalog table"
      via: "JOIN with siblings of same family_id; ORDER BY live COUNT(watches.catalog_id) DESC"
      pattern: "familyId.*COUNT.*catalog_id"
---

<objective>
Ship the NSV-02 + NSV-16 closure: inline "Same family" + "Lineage" rails on
both `/watch/{id}` and `/catalog/{id}`. Adds the new `getSameFamilyForCatalog`
DAL (live `COUNT(watches.catalog_id)` ranking per D-39b-15 Q2 verdict),
two new server RSC rails per surface (D-39b-06 — SameFamilyRail + LineageRail),
and page-level mounts on both surfaces. NO `/family/{familyId}` dedicated
page (D-39b-05 — deferred to v5.x / SEED-008 v5.1 Browse the Catalog
module); inline rails are the entire NSV-02 + NSV-16 closure surface.

Purpose: closes the Phase 33b Q2 lineage browse UI deferral. Same-family
rail surfaces highest-owned siblings; lineage rail surfaces relationship-typed
neighbors (predecessor / successor / remake / tribute / homage). Both rails
hide-if-empty per D-39b-07 — they verify against the real sparse prod data
committed by the Wave 0 operator checkpoint (Plan 39b-01 Task 7).

This plan also closes the intentional RED state from Plan 39b-01 Task 2 — the
static guard assertion for `getSameFamilyForCatalog` was authored ahead of
implementation; this plan ships the implementation and the assertion
transitions to GREEN.

Architectural note for `/watch/{id}` rail mount (B1 fix carry-forward from
Plan 39b-02): `src/components/watch/WatchDetail.tsx` is a Client Component
(`'use client'` at line 1). The SameFamilyRail and LineageRail are Server
Components and MUST NOT be imported into it. Instead, both rails mount as
Server-Component **siblings** of `<WatchDetail/>` inside
`src/app/watch/[id]/page.tsx` (which IS a Server Component). This composes
correctly at the server tree level. Plan 39b-02's Task 4 already reshaped
page.tsx to support this sibling composition pattern — this plan slots its
rails into the placeholder comment Plan 39b-02 left between the
card/caption block and the 3-CTA block.

Output: One DAL function + two new rail components + page mounts on both
surfaces + extended static guard test. Five per-task commits.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-CONTEXT.md
@.planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-PATTERNS.md
@.planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-UI-SPEC.md
@.planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-RESEARCH.md
@CLAUDE.md
@AGENTS.md
@.planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-01-SUMMARY.md
@.planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-02-SUMMARY.md
@.planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-04-SUMMARY.md
@src/data/hierarchy.ts
@src/data/discovery.ts
@src/components/explore/TrendingWatches.tsx
@src/components/explore/DiscoveryWatchCard.tsx
@src/components/ui/badge.tsx
@src/app/watch/[id]/page.tsx
@src/components/watch/WatchDetail.tsx
@src/app/catalog/[catalogId]/page.tsx
@tests/static/hierarchy.lineage-3-node.test.ts

<interfaces>
<!-- Key types and contracts. Extracted from codebase. -->

From src/data/hierarchy.ts (Plan 39b-01 Task 1 EXTENDED LineageRow with imageUrl):
```typescript
export interface LineageRow {
  id: string
  brand: string
  model: string
  reference: string | null
  imageUrl: string | null   // shipped by Plan 39b-01
  predecessor_catalog_id: string
  successor_catalog_id: string
  relationship_type: string
  depth: number
  direction: 'forward' | 'backward'
  is_cycle: boolean
}
export async function getLineageForReference(catalogId: string): Promise<LineageRow[]>
```

NEW exports this plan ships in src/data/hierarchy.ts:
```typescript
export interface SameFamilyWatch {
  id: string                   // watches_catalog.id
  brand: string
  model: string
  imageUrl: string | null
  ownersCount: number
}
export async function getSameFamilyForCatalog(
  catalogId: string,
  opts?: { limit?: number },
): Promise<SameFamilyWatch[]>
```

From src/components/explore/DiscoveryWatchCard.tsx (reused — sublabel accepts ReactNode):
```typescript
interface DiscoveryWatchCardProps {
  watch: { id: string; brand: string; model: string; imageUrl: string | null }
  sublabel: React.ReactNode
}
```

From src/components/explore/TrendingWatches.tsx (analog for rail anatomy — copy header + scroll container shape).

From src/components/ui/badge.tsx:
```typescript
export type BadgeVariant = 'default' | 'outline' | 'secondary' | 'destructive'
```

From src/components/watch/WatchDetail.tsx:1 — `'use client'`. This file is a Client Component. RSCs (SameFamilyRail, LineageRail) are NEVER imported here. The B1 fix carried forward from Plan 39b-02 keeps all new RSCs as Server-Component siblings of `<WatchDetail/>` inside `src/app/watch/[id]/page.tsx`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Implement getSameFamilyForCatalog DAL (closes RED from Plan 39b-01 Task 2)</name>
  <files>src/data/hierarchy.ts</files>
  <read_first>
    - src/data/hierarchy.ts (FULL — 106 lines after Plan 39b-01 extension; existing getLineageForReference at lines 27-106)
    - src/data/discovery.ts:135-160 (getTrendingCatalogWatches — analog for denormalized owners_count ranking)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-PATTERNS.md §6b (lines 548-616 — full function shape ready to copy; A2 trade-off note)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-RESEARCH.md §"Open Questions (RESOLVED)" Q2 (live COUNT vs denormalized owners_count)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-CONTEXT.md D-39b-15 (live COUNT — Q2 verdict per planning_context "RECOMMEND: live COUNT for D-39b-15 literal compliance")
    - tests/static/hierarchy.lineage-3-node.test.ts (Plan 39b-01 Task 2 added an intentional RED assertion: "getSameFamilyForCatalog function is exported" — this DAL closes that to GREEN)
    - src/db/schema.ts §watchesCatalog (familyId column) + §watches (catalogId column)
  </read_first>
  <behavior>
    Exports `getSameFamilyForCatalog(catalogId, opts?)`:
    1. Two-pass query: first reads `family_id` of the input catalogId; returns [] when familyId is null (D-39b-07 hide-if-empty)
    2. Second query: JOINs watches_catalog with siblings of the same family_id, LEFT JOIN watches on `watches.catalog_id = watches_catalog.id` to get a LIVE COUNT (Q2 verdict — D-39b-15 literal compliance; A2 alternative documented but not chosen)
    3. WHERE: `eq(watchesCatalog.familyId, familyId) AND watchesCatalog.id != catalogId`
    4. GROUP BY `watchesCatalog.id, watchesCatalog.brand, watchesCatalog.model, watchesCatalog.imageUrl`
    5. ORDER BY `count(watches.id) DESC, watchesCatalog.brand ASC, watchesCatalog.model ASC` (D-39b-15 + alphabetical tiebreaker)
    6. LIMIT `opts.limit ?? 6` (D-39b-17 cap)
    7. Returns `SameFamilyWatch[]` with `ownersCount` as the COUNT alias
  </behavior>
  <action>
    Append `getSameFamilyForCatalog` to `src/data/hierarchy.ts`. Use 39b-PATTERNS.md §6b (lines 561-609) as the structural skeleton, with a Q2-verdict modification: live COUNT instead of denormalized `watches_catalog.owners_count`.

    Step 1 — Extend imports (top of file). Verify `and, asc, count, desc, eq, sql` from drizzle-orm are imported; add what's missing:
    ```typescript
    import { and, asc, desc, eq, sql } from 'drizzle-orm'
    import { db } from '@/db'
    import { watches, watchesCatalog } from '@/db/schema'
    ```

    Step 2 — Add the `SameFamilyWatch` interface export:
    ```typescript
    export interface SameFamilyWatch {
      id: string
      brand: string
      model: string
      imageUrl: string | null
      ownersCount: number
    }
    ```

    Step 3 — Implement `getSameFamilyForCatalog`. Use 39b-PATTERNS.md §6b lines 568-608 as the skeleton, but REPLACE the denormalized `watchesCatalog.ownersCount` projection with a live LEFT JOIN + COUNT (D-39b-15 / Q2 RECOMMEND live count):

    ```typescript
    /**
     * Phase 39b NSV-02+16 — same-family rail DAL (D-39b-15).
     * Ranks siblings by LIVE COUNT(watches.catalog_id) (Q2 verdict — chosen over the
     * 24h-stale denormalized owners_count for literal D-39b-15 compliance).
     */
    export async function getSameFamilyForCatalog(
      catalogId: string,
      opts: { limit?: number } = {},
    ): Promise<SameFamilyWatch[]> {
      const limit = opts.limit ?? 6

      // Two-pass: (1) resolve family_id; (2) find siblings ranked by live owners count.
      const rootRows = await db
        .select({ familyId: watchesCatalog.familyId })
        .from(watchesCatalog)
        .where(eq(watchesCatalog.id, catalogId))
        .limit(1)
      const familyId = rootRows[0]?.familyId
      if (!familyId) return []  // D-39b-07 hide-if-empty

      const rows = await db
        .select({
          id: watchesCatalog.id,
          brand: watchesCatalog.brand,
          model: watchesCatalog.model,
          imageUrl: watchesCatalog.imageUrl,
          ownersCount: sql<number>`COUNT(${watches.id})::int`,
        })
        .from(watchesCatalog)
        .leftJoin(watches, eq(watches.catalogId, watchesCatalog.id))
        .where(
          and(
            eq(watchesCatalog.familyId, familyId),
            sql`${watchesCatalog.id} != ${catalogId}::uuid`,
          ),
        )
        .groupBy(
          watchesCatalog.id,
          watchesCatalog.brand,
          watchesCatalog.model,
          watchesCatalog.imageUrl,
        )
        .orderBy(
          desc(sql`COUNT(${watches.id})`),
          asc(watchesCatalog.brand),
          asc(watchesCatalog.model),
        )
        .limit(limit)

      return rows
    }
    ```

    Step 4 — Document the Q2 trade-off in a comment block above the function (or in the SUMMARY): "Live COUNT chosen over denormalized owners_count for D-39b-15 literal compliance. Cost: ~1ms additional query overhead per request. Mitigation: rail caps at 6 cards (D-39b-17); GROUP BY is on indexed familyId."

    Forbidden:
    - Do NOT use `watchesCatalog.ownersCount` (the denormalized column from Phase 17 pg_cron) — Q2 verdict is LIVE COUNT.
    - Do NOT skip the two-pass structure (resolving familyId first is load-bearing for the D-39b-07 hide-if-empty contract).
    - Do NOT change LIMIT default from 6 (D-39b-17).
    - Do NOT include the input `catalogId` in the result set (self-exclusion via `${watchesCatalog.id} != ${catalogId}`).
  </action>
  <verify>
    <automated>grep "export.*function getSameFamilyForCatalog\|export async function getSameFamilyForCatalog" src/data/hierarchy.ts</automated>
    <automated>grep "export interface SameFamilyWatch" src/data/hierarchy.ts</automated>
    <automated>grep "COUNT(\${watches.id})" src/data/hierarchy.ts</automated>
    <automated>grep "if (!familyId) return \[\]" src/data/hierarchy.ts</automated>
    <automated>npx tsc --noEmit 2>&1 | grep -c "error TS"</automated>
    <automated>npx vitest run tests/static/hierarchy.lineage-3-node.test.ts 2>&1 | tail -15</automated>
  </verify>
  <acceptance_criteria>
    - `grep -E "export (async )?function getSameFamilyForCatalog" src/data/hierarchy.ts` returns 1 line (closes the RED static assertion from Plan 39b-01 Task 2)
    - `grep "export interface SameFamilyWatch" src/data/hierarchy.ts` returns 1 line
    - `grep -E "COUNT\(\\\$\{watches\.id\}\)|count\(watches\.id\)" src/data/hierarchy.ts` returns ≥ 1 line (Q2 verdict live COUNT)
    - `grep -c "watchesCatalog.ownersCount" src/data/hierarchy.ts` returns 0 (denormalized column NOT used — Q2 verdict)
    - `grep "if (!familyId) return \[\]" src/data/hierarchy.ts` returns 1 line (D-39b-07 hide-if-empty)
    - `grep -E "limit\s*=\s*opts\.limit\s*\?\?\s*6" src/data/hierarchy.ts` returns 1 line (D-39b-17 cap default)
    - `npx vitest run tests/static/hierarchy.lineage-3-node.test.ts` exits 0 — the intentional RED assertion from Plan 39b-01 Task 2 ("getSameFamilyForCatalog function is exported") now PASSES
    - `npx tsc --noEmit 2>&1 | grep -c "error TS"` ≤ 27 (Phase 36 baseline)
  </acceptance_criteria>
  <done>
    `getSameFamilyForCatalog` exported with live COUNT ranking + two-pass family_id resolution + hide-if-empty + D-39b-17 cap. Plan 39b-01 Task 2 intentional RED transitioned to GREEN.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create SameFamilyRail and LineageRail server components</name>
  <files>src/components/insights/SameFamilyRail.tsx, src/components/insights/LineageRail.tsx</files>
  <read_first>
    - src/components/explore/TrendingWatches.tsx (FULL — analog for rail anatomy; header + horizontal-scroll container + DiscoveryWatchCard map)
    - src/components/explore/DiscoveryWatchCard.tsx (verify `sublabel: ReactNode` prop accepts both string and `<Badge>` per UI-SPEC §"NSV-02+16 Sublabel" + Pitfall 5)
    - src/components/ui/badge.tsx (variant='outline')
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-PATTERNS.md §10 (lines 776-861 — both rails ready to copy with RELATIONSHIP_LABELS map)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-UI-SPEC.md §"NSV-02+16 — Inline Lineage Rails" (lines 458-512) + §Copywriting Contract (lines 547-553)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-CONTEXT.md D-39b-15..D-39b-17
  </read_first>
  <action>
    Create TWO new files. Both are pure server components (no 'use client'). Use 39b-PATTERNS.md §10 (lines 791-853) verbatim — the components are copy-paste-ready.

    --- File 1: `src/components/insights/SameFamilyRail.tsx` ---

    ```typescript
    import { DiscoveryWatchCard } from '@/components/explore/DiscoveryWatchCard'
    import type { SameFamilyWatch } from '@/data/hierarchy'

    interface SameFamilyRailProps {
      rows: SameFamilyWatch[]
    }

    export function SameFamilyRail({ rows }: SameFamilyRailProps) {
      if (rows.length === 0) return null  // D-39b-07 hide-if-empty
      return (
        <section className="space-y-4">
          <header className="flex items-center justify-between">
            <h2 className="text-xl font-medium leading-tight text-foreground">
              Same family
            </h2>
            {/* TODO v5.x: "See all in family" link → /catalog?family={familyId} (D-39b-17 deferred) */}
          </header>
          <div className="flex gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2">
            {rows.map((w) => {
              const sublabel = w.ownersCount === 1 ? '1 collector' : `${w.ownersCount} collectors`
              return (
                <div key={w.id} className="snap-start">
                  <DiscoveryWatchCard
                    watch={{ id: w.id, brand: w.brand, model: w.model, imageUrl: w.imageUrl }}
                    sublabel={sublabel}
                  />
                </div>
              )
            })}
          </div>
        </section>
      )
    }
    ```

    --- File 2: `src/components/insights/LineageRail.tsx` ---

    ```typescript
    import { DiscoveryWatchCard } from '@/components/explore/DiscoveryWatchCard'
    import { Badge } from '@/components/ui/badge'
    import type { LineageRow } from '@/data/hierarchy'

    // D-39b-16 — relationship_type → human-readable label map
    const RELATIONSHIP_LABELS: Record<string, string> = {
      predecessor: 'Predecessor',
      successor: 'Successor',
      remake: 'Modern remake',
      tribute: 'Tribute to',
      homage: 'Homage to',
    }

    interface LineageRailProps {
      rows: LineageRow[]
    }

    export function LineageRail({ rows }: LineageRailProps) {
      if (rows.length === 0) return null  // D-39b-07 hide-if-empty
      return (
        <section className="space-y-4">
          <header className="flex items-center justify-between">
            <h2 className="text-xl font-medium leading-tight text-foreground">
              Lineage
            </h2>
          </header>
          <div className="flex gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2">
            {rows.slice(0, 6).map((r) => {  // D-39b-17 cap 6
              const label = RELATIONSHIP_LABELS[r.relationship_type] ?? r.relationship_type
              return (
                <div key={r.id} className="snap-start">
                  <DiscoveryWatchCard
                    watch={{ id: r.id, brand: r.brand, model: r.model, imageUrl: r.imageUrl }}
                    sublabel={<Badge variant="outline">{label}</Badge>}
                  />
                </div>
              )
            })}
          </div>
        </section>
      )
    }
    ```

    UI-SPEC contracts (all load-bearing — pulled from UI-SPEC §"NSV-02+16 — Inline Lineage Rails"):
    - Rail header: `text-xl font-medium leading-tight text-foreground` — NOT `font-semibold` (UI-SPEC §Typography explicit deviation from TrendingWatches)
    - Scroll container: `flex gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2` (matches TrendingWatches.tsx:39 verbatim per UI-SPEC §Spacing exception)
    - Card sublabel:
      - SameFamily: `"1 collector"` (singular) / `"{N} collectors"` (plural) — string-typed
      - Lineage: `<Badge variant="outline">{label}</Badge>` — ReactNode-typed (sublabel prop accepts ReactNode per Pitfall 5 confirmation)
    - Both rails: `if (rows.length === 0) return null` (D-39b-07)

    Forbidden:
    - Do NOT add `'use cache'` / `cacheTag` / `cacheLife` (UI-SPEC §"Concrete deviations from TrendingWatches" — rails are page-scoped, not global)
    - Do NOT add a `Flame` or other icon in the header (UI-SPEC §Copywriting line 552-553: "No icon mandated")
    - Do NOT add a "See all in family" link to SameFamilyRail (D-39b-17 — hidden in 39b, deferred to v5.x; only a code comment is allowed)
    - Do NOT use `font-semibold` in the rail header (UI-SPEC §Typography lock: `text-xl font-medium`)
    - Do NOT mount the components in this task — Tasks 3 and 4 own the page mounts.
  </action>
  <verify>
    <automated>test -f src/components/insights/SameFamilyRail.tsx && test -f src/components/insights/LineageRail.tsx && echo "both files exist"</automated>
    <automated>grep "export function SameFamilyRail" src/components/insights/SameFamilyRail.tsx</automated>
    <automated>grep "export function LineageRail" src/components/insights/LineageRail.tsx</automated>
    <automated>grep -c "if (rows.length === 0) return null" src/components/insights/SameFamilyRail.tsx src/components/insights/LineageRail.tsx</automated>
    <automated>grep "text-xl font-medium" src/components/insights/SameFamilyRail.tsx src/components/insights/LineageRail.tsx</automated>
    <automated>grep "Modern remake" src/components/insights/LineageRail.tsx</automated>
    <automated>grep "Tribute to" src/components/insights/LineageRail.tsx</automated>
    <automated>grep -cE "^['\"]use client['\"]" src/components/insights/SameFamilyRail.tsx src/components/insights/LineageRail.tsx</automated>
    <automated>npx tsc --noEmit 2>&1 | grep -c "error TS"</automated>
  </verify>
  <acceptance_criteria>
    - Both files exist: `test -f src/components/insights/SameFamilyRail.tsx && test -f src/components/insights/LineageRail.tsx` exits 0
    - `grep "export function SameFamilyRail" src/components/insights/SameFamilyRail.tsx` returns 1 line
    - `grep "export function LineageRail" src/components/insights/LineageRail.tsx` returns 1 line
    - `grep -c "if (rows.length === 0) return null" src/components/insights/SameFamilyRail.tsx` returns 1
    - `grep -c "if (rows.length === 0) return null" src/components/insights/LineageRail.tsx` returns 1
    - `grep "text-xl font-medium leading-tight" src/components/insights/SameFamilyRail.tsx` returns 1 line (UI-SPEC §Typography lock)
    - `grep "text-xl font-medium leading-tight" src/components/insights/LineageRail.tsx` returns 1 line
    - `grep -c "font-semibold" src/components/insights/SameFamilyRail.tsx src/components/insights/LineageRail.tsx` returns 0 (lock enforced)
    - `grep "Same family" src/components/insights/SameFamilyRail.tsx` returns 1 line (rail header copy)
    - `grep "Lineage" src/components/insights/LineageRail.tsx` returns ≥ 1 line
    - All 5 RELATIONSHIP_LABELS values present: `grep -c "Predecessor\|Successor\|Modern remake\|Tribute to\|Homage to" src/components/insights/LineageRail.tsx` returns ≥ 5
    - `grep "snap-x snap-mandatory" src/components/insights/SameFamilyRail.tsx src/components/insights/LineageRail.tsx` returns ≥ 2 lines (scroll snap per UI-SPEC §Rail layout)
    - `grep ".slice(0, 6)" src/components/insights/LineageRail.tsx` returns 1 line (D-39b-17 cap)
    - `grep -cE "^['\"]use client['\"]" src/components/insights/SameFamilyRail.tsx src/components/insights/LineageRail.tsx` returns 0 (Server Component lock)
    - `npx tsc --noEmit 2>&1 | grep -c "error TS"` ≤ 27 (Phase 36 baseline)
    - SameFamilyRail singular vs plural: `grep "'1 collector'" src/components/insights/SameFamilyRail.tsx` returns 1 line (singular form lock)
    - `grep "TODO v5.x" src/components/insights/SameFamilyRail.tsx` returns 1 line (D-39b-17 deferred "See all in family" comment)
  </acceptance_criteria>
  <done>
    Both rail components ship as pure server components. SameFamily uses string sublabel ({N} collectors / 1 collector); Lineage uses Badge sublabel via RELATIONSHIP_LABELS map. Hide-if-empty + D-39b-17 cap of 6 cards enforced. UI-SPEC typography lock (text-xl font-medium) honored.
  </done>
</task>

<task type="auto">
  <name>Task 3: Mount SameFamilyRail + LineageRail on /watch/{id} as Server-Component siblings of &lt;WatchDetail/&gt; (B1 carry-forward — Next 16 boundary fix)</name>
  <files>src/app/watch/[id]/page.tsx</files>
  <read_first>
    - src/app/watch/[id]/page.tsx (FULL — already reshaped by Plan 39b-02 Task 4 to support Server-Component sibling composition; ReferenceIdentityCard + fallback caption + 3-CTA block mount at the page tree level; placeholder comment `{/* Plan 39b-05 mounts SameFamilyRail + LineageRail here */}` is the slot for this task)
    - src/components/watch/WatchDetail.tsx (line 1 = `'use client'` — confirms RSCs MUST NOT be imported into this file; rails compose at page.tsx level instead)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-PATTERNS.md §7 (lines 619-663 — page mount pattern)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-UI-SPEC.md §"Render Order — /watch/{id}" (lines 256-271 — rails mount AFTER the verdict-card/ReferenceIdentityCard block and BEFORE the CTA block, for ALL viewer states)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-02-SUMMARY.md (records the placeholder comment Plan 39b-02 left at the exact insertion point)
  </read_first>
  <behavior>
    - Both rails mount as Server-Component siblings of `<WatchDetail/>` inside `src/app/watch/[id]/page.tsx`. NEITHER rail is imported into `WatchDetail.tsx` (which is a Client Component — Next 16 forbids RSC imports into Client Components).
    - Both rails render UNCONDITIONALLY on viewer state (UI-SPEC § Render Order line 269: "Owner-populated viewer sees: CollectionFitCard → Same family rail → Lineage rail"; fresh-account viewer sees the rails between the card/caption block and the 3-CTA block).
    - Both rails self-hide via `if (rows.length === 0) return null` (D-39b-07) — page.tsx does NOT need to wrap them in conditional rendering.
    - page.tsx remains a Server Component (no `'use client'`).
  </behavior>
  <action>
    Patch `src/app/watch/[id]/page.tsx` (the Server Component shell). Plan 39b-02 already reshaped this file to render multiple Server-Component children inside the page's container `<div>`. This task fetches the rail data and slots the two rail components into the placeholder comment Plan 39b-02 left between the card/caption block and the 3-CTA block.

    Architectural rationale (B1 carry-forward from Plan 39b-02): `WatchDetail.tsx` is a Client Component (`'use client'` at line 1). Importing the new RSCs (SameFamilyRail, LineageRail) into WatchDetail would violate Next 16's server/client boundary rules. The sibling composition pattern that Plan 39b-02 established at the page.tsx level extends to this task.

    Step 1 — Add imports (after Plan 39b-02's ReferenceIdentityCard import):
    ```typescript
    import { getLineageForReference, getSameFamilyForCatalog } from '@/data/hierarchy'
    import { SameFamilyRail } from '@/components/insights/SameFamilyRail'
    import { LineageRail } from '@/components/insights/LineageRail'
    ```

    Step 2 — Fetch both data sets server-side. Add to the existing `Promise.all` (or sequential awaits) after the watch fetch:
    ```typescript
    const sameFamily = watch.catalogId ? await getSameFamilyForCatalog(watch.catalogId) : []
    const lineage = watch.catalogId ? await getLineageForReference(watch.catalogId) : []
    ```
    Critical: `watch.catalogId` is nullable per Phase 36 deferred-items.md (Plan 36 Plan 01 — `.notNull()` tightening deferred to Phase 38). Guard with `watch.catalogId ?` falsy-fallback to `[]`.

    Step 3 — Locate the "Plan 39b-05 mounts SameFamilyRail + LineageRail here" comment placeholder left by Plan 39b-02. Replace it with:
    ```tsx
    <SameFamilyRail rows={sameFamily} />
    <LineageRail rows={lineage} />
    ```

    These render as Server-Component siblings of `<WatchDetail/>` — at the same JSX-tree level. They are NEVER imported into WatchDetail.

    Step 4 — Position per UI-SPEC §"/watch/{id} render order":
    1. `<WatchDetail/>` (Client Component; CollectionFitCard mounts inside for owner-populated viewers — unchanged)
    2. ReferenceIdentityCard OR fallback caption (Plan 39b-02, fresh-account branch)
    3. SameFamilyRail (this task — for ALL viewer states; self-hides when empty)
    4. LineageRail (this task — for ALL viewer states; self-hides when empty)
    5. 3-CTA block (Plan 39b-02, fresh-account branch only)

    UI-SPEC line 269 explicit: "Owner-populated viewer sees: CollectionFitCard → Same family rail → Lineage rail. No CTAs." The CollectionFitCard mount lives INSIDE `<WatchDetail/>` (the client island, unchanged); the rails render as page-level siblings after it. The 3-CTA block already gates on `collection.length === 0` per Plan 39b-02 — so owner-populated viewers see card → rails → no CTAs, exactly matching the spec.

    Forbidden:
    - Do NOT import SameFamilyRail or LineageRail into `src/components/watch/WatchDetail.tsx` (Next 16 RSC-into-client-component prohibition; B1 invariant carried forward).
    - Do NOT add `'use client'` to `src/app/watch/[id]/page.tsx`.
    - Do NOT gate the rail mount on `collection.length === 0` (UI-SPEC §Render Order — rails are unconditional on viewer state; the rails self-hide via their internal `rows.length === 0` check).
    - Do NOT mount OtherOwnersRoster on `/watch/{id}` (UI-SPEC §Render Order line 288 explicit exclusion — only `/catalog/{id}` gets the roster).
  </action>
  <verify>
    <automated>grep -c "SameFamilyRail" 'src/app/watch/[id]/page.tsx'</automated>
    <automated>grep -c "LineageRail" 'src/app/watch/[id]/page.tsx'</automated>
    <automated>grep "getSameFamilyForCatalog" 'src/app/watch/[id]/page.tsx'</automated>
    <automated>grep "getLineageForReference" 'src/app/watch/[id]/page.tsx'</automated>
    <automated>grep -c "OtherOwnersRoster" 'src/app/watch/[id]/page.tsx'</automated>
    <automated>grep -cE "^['\"]use client['\"]" 'src/app/watch/[id]/page.tsx'</automated>
    <automated>grep -c "SameFamilyRail\|LineageRail" src/components/watch/WatchDetail.tsx</automated>
    <automated>npx tsc --noEmit 2>&1 | grep -c "error TS"</automated>
    <automated>npm run build 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "SameFamilyRail" 'src/app/watch/[id]/page.tsx'` returns ≥ 2 (import + JSX mount)
    - `grep -c "LineageRail" 'src/app/watch/[id]/page.tsx'` returns ≥ 2 (import + JSX mount)
    - `grep "getSameFamilyForCatalog(watch.catalogId)" 'src/app/watch/[id]/page.tsx'` OR `grep "getSameFamilyForCatalog(watch\.catalogId" 'src/app/watch/[id]/page.tsx'` returns ≥ 1 line
    - `grep "getLineageForReference(watch.catalogId)" 'src/app/watch/[id]/page.tsx'` OR `grep "getLineageForReference(watch\.catalogId" 'src/app/watch/[id]/page.tsx'` returns ≥ 1 line
    - `grep "watch.catalogId ?" 'src/app/watch/[id]/page.tsx'` returns ≥ 1 line (nullable catalogId guard — Phase 36 deferred)
    - `grep -c "OtherOwnersRoster" 'src/app/watch/[id]/page.tsx'` returns 0 (NOT mounted on /watch/{id})
    - `grep -cE "^['\"]use client['\"]" 'src/app/watch/[id]/page.tsx'` returns 0 (page.tsx remains a Server Component — B1 invariant)
    - `grep -c "SameFamilyRail\|LineageRail" src/components/watch/WatchDetail.tsx` returns 0 (rails NOT imported into the client island — B1 invariant)
    - `npx tsc --noEmit 2>&1 | grep -c "error TS"` ≤ 27
    - `npm run build 2>&1 | tail -3` exits 0 (Next 16 boundary regression guard)
  </acceptance_criteria>
  <done>
    Both rails mount on /watch/{id} as Server-Component siblings of `<WatchDetail/>` (B1 invariant carried forward — never imported into the client island). Rails render unconditionally on viewer state; self-hide via internal `rows.length === 0` check. Render order: WatchDetail (with CollectionFitCard inside for owner viewer) → ReferenceIdentityCard/caption → SameFamilyRail → LineageRail → 3-CTA block (fresh-account only). catalogId nullable guard in place. Build smoke green.
  </done>
</task>

<task type="auto">
  <name>Task 4: Mount SameFamilyRail + LineageRail on /catalog/{id}</name>
  <files>src/app/catalog/[catalogId]/page.tsx</files>
  <read_first>
    - src/app/catalog/[catalogId]/page.tsx (FULL — Plan 39b-02 added ReferenceIdentityCard mount; Plan 39b-04 added OtherOwnersRoster mount; this task adds rails AFTER the roster)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-PATTERNS.md §8 (lines 666-716)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-UI-SPEC.md §"/catalog/{id} render order" (lines 274-286 — sequence: verdict → roster → same-family → lineage → CTAs)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-04-SUMMARY.md (where Plan 39b-04 mounted OtherOwnersRoster and left the rail placeholder comment)
  </read_first>
  <action>
    Patch `src/app/catalog/[catalogId]/page.tsx` to fetch + mount both rails AFTER the OtherOwnersRoster (Plan 39b-04 mount-site) and BEFORE the CTA block (UI-SPEC §"/catalog/{id} render order" lines 274-286).

    Step 1 — Add imports (after Plan 39b-04's `getCollectorsForCatalog` import):
    ```typescript
    import { getSameFamilyForCatalog, getLineageForReference } from '@/data/hierarchy'
    import { SameFamilyRail } from '@/components/insights/SameFamilyRail'
    import { LineageRail } from '@/components/insights/LineageRail'
    ```

    Step 2 — Extend the Promise.all (or sequential awaits) added by Plan 39b-04 to fetch both rail data sets:
    ```typescript
    const [catalogEntry, collection, preferences, viewerOwnedRow, viewerProfile, roster, sameFamily, lineage] = await Promise.all([
      getCatalogById(catalogId),
      getWatchesByUser(user.id),
      getPreferencesByUser(user.id),
      findViewerWatchByCatalogId(user.id, catalogId),
      getProfileById(user.id),
      getCollectorsForCatalog(catalogId, user.id, { limit: 5 }),  // Plan 39b-04
      getSameFamilyForCatalog(catalogId),                          // NEW this task
      getLineageForReference(catalogId),                           // NEW this task
    ])
    ```

    Note: catalogId on this page is from route params and is non-nullable (the UUID regex guard at lines 46-48 ensures it exists), so no `catalogId ?` falsy-fallback is needed (unlike /watch/{id} which depends on `watch.catalogId`).

    Step 3 — Locate the "Plan 39b-05 mounts SameFamilyRail + LineageRail here" comment placeholder left by Plan 39b-02 (or Plan 39b-04). Replace it with:
    ```tsx
    <SameFamilyRail rows={sameFamily} />
    <LineageRail rows={lineage} />
    ```

    Step 4 — Render order verification — UI-SPEC §"/catalog/{id} render order" lines 274-286:
    1. CollectionFitCard OR ReferenceIdentityCard OR fallback caption (Plan 39b-02)
    2. OtherOwnersRoster (Plan 39b-04)
    3. SameFamilyRail (this task)
    4. LineageRail (this task)
    5. CTA block (always last — fresh-account branch)

    Forbidden:
    - Do NOT mount the rails ABOVE the OtherOwnersRoster (UI-SPEC §Render Order lock)
    - Do NOT mount the rails on the owner-populated branch ONLY — UI-SPEC §Render Order is unconditional on viewer state
    - Do NOT remove or modify the OtherOwnersRoster mount from Plan 39b-04
    - Do NOT add `'use client'`
  </action>
  <verify>
    <automated>grep -c "SameFamilyRail" 'src/app/catalog/[catalogId]/page.tsx'</automated>
    <automated>grep -c "LineageRail" 'src/app/catalog/[catalogId]/page.tsx'</automated>
    <automated>grep -c "OtherOwnersRoster" 'src/app/catalog/[catalogId]/page.tsx'</automated>
    <automated>grep "getSameFamilyForCatalog" 'src/app/catalog/[catalogId]/page.tsx'</automated>
    <automated>npx tsc --noEmit 2>&1 | grep -c "error TS"</automated>
    <automated>npm run build 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "SameFamilyRail" 'src/app/catalog/[catalogId]/page.tsx'` returns ≥ 2 (import + JSX mount)
    - `grep -c "LineageRail" 'src/app/catalog/[catalogId]/page.tsx'` returns ≥ 2 (import + JSX mount)
    - `grep -c "OtherOwnersRoster" 'src/app/catalog/[catalogId]/page.tsx'` returns ≥ 2 (Plan 39b-04 mount preserved)
    - `grep "getSameFamilyForCatalog(catalogId)" 'src/app/catalog/[catalogId]/page.tsx'` returns ≥ 1 line
    - `grep "getLineageForReference(catalogId)" 'src/app/catalog/[catalogId]/page.tsx'` returns ≥ 1 line
    - Render order check (manual read): in the JSX return body, the sequence MUST be: verdict-card block → OtherOwnersRoster → SameFamilyRail → LineageRail → CTA block. Capture the JSX snippet in the SUMMARY for evidence.
    - `npx tsc --noEmit 2>&1 | grep -c "error TS"` ≤ 27
    - `npm run build 2>&1 | tail -3` exits 0
  </acceptance_criteria>
  <done>
    Both rails mount on /catalog/{id} after OtherOwnersRoster and before CTAs (UI-SPEC §Render Order line 274-286 sequence honored). Build smoke green.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Postgres pooler (service-role bypass) → DAL WHERE clause | watchesCatalog is a public-data table (no per-row privacy); but lineage rail UPSTREAM data integrity depends on operator-curated data committed in Wave 0 |
| `getLineageForReference` recursive CTE → rendered HTML | CYCLE clause + `depth < 10` guard prevents DoS; no untrusted depth input |
| `relationship_type` enum value → RELATIONSHIP_LABELS map lookup | Unknown values fall through to raw string (auto-escaped React text node) |
| Server Component page.tsx → Client Component WatchDetail | Standard server-imports-client composition; RSCs (SameFamilyRail, LineageRail) compose at the server tree level — never imported into the client island |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-39b-05 | Information Disclosure (low) | watch_lineage_edges + watches_catalog rails | accept | watches_catalog refs are all public per Phase 36 RLS; lineage_edges are operator-curated metadata about public catalog rows, not user data. No per-row privacy surface on either table. |
| Cycle/depth-overrun in lineage rail | DoS | src/data/hierarchy.ts:getLineageForReference | mitigate | Existing CYCLE clause + `depth < 10` guard inherited from Phase 35 — verified preserved by Plan 39b-01 Task 1 ACs. No new exposure in this plan. |
| Unknown relationship_type values | Information Disclosure (low) | src/components/insights/LineageRail.tsx | mitigate | RELATIONSHIP_LABELS map has fall-through to raw `r.relationship_type` string — auto-escaped React text node. Worst case: an unknown enum value renders as raw lowercase text (e.g., `unknown_type` instead of "Unknown Type"). No XSS surface. |
| Live COUNT subquery cost | DoS-very-low | src/data/hierarchy.ts:getSameFamilyForCatalog | accept | LIMIT 6 cap (D-39b-17) bounds rail size; GROUP BY on `watchesCatalog.familyId` (indexed in Phase 34) keeps cost ~1ms; trade-off documented in Q2 verdict. Mitigation if needed in future: switch to denormalized owners_count if pg slow-query log surfaces a hotspot. |
| Next 16 boundary regression (RSC imported into Client Component) | Build-time crash | src/app/watch/[id]/page.tsx + src/components/watch/WatchDetail.tsx | mitigate | B1 invariant carried forward: SameFamilyRail + LineageRail mount as Server-Component siblings of `<WatchDetail/>` at the page.tsx level — never imported into WatchDetail. AC `grep -c "SameFamilyRail\|LineageRail" src/components/watch/WatchDetail.tsx` returns 0. Build smoke (`npm run build`) is the automated regression guard. |
</threat_model>

<verification>
After all 4 tasks:
- `npx vitest run tests/static/hierarchy.lineage-3-node.test.ts` exits 0 — Plan 39b-01 Task 2 intentional RED transitioned to GREEN
- `npm test 2>&1 | tail -10` — no NEW test failures other than the intentional RED state from Plan 39b-01 Task 2 (which THIS plan's Task 1 transitions to GREEN — once Task 1 lands, that RED is closed). Phase 36 baseline preserved.
- `npm run build 2>&1 | tail -10` exits 0 (Next 16 server/client boundary check)
- Manual smoke (operator UAT, optional — relies on Wave 0 prod-DB curation):
  - Navigate to `/watch/{id}` for a watch with `catalogId` in a curated family (e.g., a Submariner per Wave 0 seed list) — verify SameFamilyRail renders cards for siblings; verify LineageRail renders cards with relationship Badges (Predecessor / Successor / etc.).
  - Navigate to a watch whose `catalogId` has NULL family_id and zero lineage edges — verify BOTH rails are entirely absent from the DOM (hide-if-empty).
  - Repeat on `/catalog/{id}` (same catalogId set) — verify render order: verdict-card → OtherOwnersRoster → SameFamilyRail → LineageRail → CTAs.
</verification>

<success_criteria>
- `getSameFamilyForCatalog` exported with live COUNT ranking (Q2 verdict — D-39b-15 literal compliance)
- Plan 39b-01 Task 2 intentional RED assertion ("getSameFamilyForCatalog function is exported") now GREEN — proves Wave 0 setup-test contract closed by Plan 39b-05 implementation
- SameFamilyRail + LineageRail server components ship; pure presentation, hide-if-empty, cap 6 cards (D-39b-17)
- Render order on /watch/{id}: WatchDetail (with CollectionFitCard inside for owner viewer) → ReferenceIdentityCard/caption → SameFamilyRail → LineageRail → 3-CTA block (UI-SPEC §Render Order /watch/{id})
- B1 invariant carried forward: rails mount as Server-Component siblings of `<WatchDetail/>` at page.tsx level; NEVER imported into the client island (`grep -c "SameFamilyRail\|LineageRail" src/components/watch/WatchDetail.tsx` returns 0)
- Render order on /catalog/{id}: verdict-card → OtherOwnersRoster → SameFamilyRail → LineageRail → CTAs (UI-SPEC §Render Order /catalog/{id})
- LineageRail relationship-type Badge labels match D-39b-16 exactly (predecessor → Predecessor; successor → Successor; remake → Modern remake; tribute → Tribute to; homage → Homage to)
- SameFamilyRail singular/plural copy: "1 collector" / "{N} collectors"
- UI-SPEC §Typography lock: rail headers use `text-xl font-medium` (NOT `font-semibold`)
- No new tsc errors above Phase 36 baseline (27); npm run build green
</success_criteria>

<output>
After completion, create `.planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-05-SUMMARY.md` with:
- DAL ship state (`getSameFamilyForCatalog` signature + Q2 trade-off note)
- Static guard transition (Plan 39b-01 Task 2 intentional RED → Plan 39b-05 GREEN)
- Component count: 2 new server RSCs (SameFamilyRail + LineageRail)
- Page mount diff snippets (before/after JSX render order for /watch/{id} and /catalog/{id})
- Render order assertion: SUMMARY captures the literal JSX block from both pages showing the verdict → roster (catalog only) → SameFamilyRail → LineageRail → CTA sequence
- B1 invariant verification: `grep -c "SameFamilyRail\|LineageRail" src/components/watch/WatchDetail.tsx` returns 0 (rails NOT in client island); `grep -cE "^['\"]use client['\"]" 'src/app/watch/[id]/page.tsx'` returns 0 (page.tsx remains Server Component)
- Q2 verdict capture: live COUNT chosen over denormalized owners_count (rationale: D-39b-15 literal compliance; cost <2ms)
- Note any deviation from CONTEXT D-39b-15 / D-39b-16 / D-39b-17 or UI-SPEC §"NSV-02+16"
- Phase 39b end-of-phase summary recommendation: with all 5 plans shipped (Wave 0 + 4 Wave 1), Phase 33b Q3 high-leverage backlog has ZERO remaining unaddressed rows (Phase 39 + Phase 39b closure complete — ROADMAP §39b SC#6).
</output>
</content>
</invoke>