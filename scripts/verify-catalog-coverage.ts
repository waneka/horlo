/**
 * Phase 44 — catalog coverage verification script (D-15, D-16, ENRH-05, ENRH-06).
 * Usage:
 *   npm run db:verify-catalog-coverage
 *
 * HARD assertions (exit 1 on failure):
 *   1. Taste population: every row must have a non-NULL confidence (taste attrs populated).
 *   2. Factual population: every row must have non-NULL movement_type, non-NULL case_size_mm,
 *      and a non-empty style_tags array. NOTE: style_tags is NOT NULL DEFAULT '{}' — a plain
 *      `style_tags IS NULL` check ALWAYS passes even when the array is empty.
 *      `array_length(style_tags, 1) IS NULL` is the correct emptiness check (returns NULL
 *      for a zero-length array), so ENRH-05 filter dimension is correctly verified.
 *
 * SOFT warn (exit 0, console.warn only):
 *   Archetype distribution: any archetype in PRIMARY_ARCHETYPES with 0 catalog rows emits a
 *   warning but does NOT cause exit 1 (D-16 — a ~100-watch catalog may legitimately lack
 *   e.g. a `racing` watch; expansion is v5.2 scope).
 *
 * Reusable by Phase 46 as a pre-ship gate.
 */
// Use relative imports — tsx does not resolve @/* path aliases.
import { db } from '../src/db'
import { sql } from 'drizzle-orm'
import { PRIMARY_ARCHETYPES } from '../src/lib/taste/vocab'

async function main() {
  const startedAt = Date.now()

  // -------------------------------------------------------------------------
  // HARD assertion 1: taste population
  // -------------------------------------------------------------------------
  const tasteNullResult = await db.execute<{ c: number }>(sql`
    SELECT count(*)::int AS c FROM watches_catalog WHERE confidence IS NULL
  `)
  const tasteNullCount = (tasteNullResult as unknown as Array<{ c: number }>)[0]?.c ?? 0

  // -------------------------------------------------------------------------
  // HARD assertion 2: factual population
  // style_tags is NOT NULL DEFAULT '{}' — plain `style_tags IS NULL` always passes
  // even when empty. `array_length(style_tags, 1) IS NULL` is the correct empty-
  // array check (array_length returns NULL for a zero-length array).
  // -------------------------------------------------------------------------
  const factualNullResult = await db.execute<{ c: number }>(sql`
    SELECT count(*)::int AS c FROM watches_catalog
     WHERE movement_type IS NULL
        OR case_size_mm IS NULL
        OR array_length(style_tags, 1) IS NULL
  `)
  const factualNullCount = (factualNullResult as unknown as Array<{ c: number }>)[0]?.c ?? 0

  // -------------------------------------------------------------------------
  // SOFT report: archetype distribution (D-16 — warn only, never exit 1)
  // -------------------------------------------------------------------------
  const archetypeDistResult = await db.execute<{ primary_archetype: string | null; c: number }>(sql`
    SELECT primary_archetype, count(*)::int AS c
    FROM watches_catalog
    GROUP BY primary_archetype
    ORDER BY c DESC
  `)
  const archetypeRows = archetypeDistResult as unknown as Array<{ primary_archetype: string | null; c: number }>

  console.log('[verify-catalog-coverage] Archetype distribution:')
  for (const row of archetypeRows) {
    console.log(`  ${String(row.primary_archetype ?? '(null)').padEnd(12)} ${row.c} rows`)
  }

  // Build count map for soft-warn check
  const distMap = new Map<string, number>()
  for (const row of archetypeRows) {
    if (row.primary_archetype !== null) {
      distMap.set(row.primary_archetype, row.c)
    }
  }

  // Soft-warn: any archetype in PRIMARY_ARCHETYPES (10 values — code is ground truth, D-16)
  // with 0 rows emits a warning but does NOT affect exit code.
  for (const archetype of PRIMARY_ARCHETYPES) {
    const count = distMap.get(archetype) ?? 0
    if (count === 0) {
      console.warn(`[verify-catalog-coverage] WARN: archetype '${archetype}' has 0 catalog rows`)
    }
  }

  const elapsedMs = Date.now() - startedAt

  // -------------------------------------------------------------------------
  // Exit-code decision
  // -------------------------------------------------------------------------
  if (tasteNullCount > 0 || factualNullCount > 0) {
    console.error(
      `[verify-catalog-coverage] FAIL — ` +
      `taste NULL rows: ${tasteNullCount}, ` +
      `factual NULL/empty rows: ${factualNullCount} ` +
      `(elapsed: ${elapsedMs}ms)`,
    )
    process.exit(1)
  }

  console.log(
    `[verify-catalog-coverage] OK — ` +
    `taste NULL rows: 0, factual NULL/empty rows: 0 ` +
    `(elapsed: ${elapsedMs}ms)`,
  )
  process.exit(0)
}

main().catch((err) => {
  console.error('[verify-catalog-coverage] fatal:', err)
  process.exit(1)
})
