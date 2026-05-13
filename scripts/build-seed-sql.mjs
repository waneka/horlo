#!/usr/bin/env node
/**
 * Phase 39b Wave 0 — generate a single idempotent SQL seed file from the
 * agent-authored markdown at `scripts/watch-seed-data.md`.
 *
 * Output: scripts/seed-bootstrap-2026-05-13.sql
 *
 * What the SQL does (in one transaction):
 *   1. INSERT brands ON CONFLICT (name_normalized) DO NOTHING
 *   2. INSERT watch_families ON CONFLICT (brand_id, name_normalized) DO NOTHING
 *   3. INSERT watches_catalog (with family_id pre-resolved via JOIN) ON CONFLICT
 *      (brand_normalized, model_normalized, reference_normalized) DO NOTHING
 *   4. INSERT watch_lineage_edges (resolving catalog UUIDs via JOIN on brand+reference)
 *      ON CONFLICT (predecessor_catalog_id, successor_catalog_id, relationship_type) DO NOTHING
 *
 * Idempotency: every INSERT carries ON CONFLICT DO NOTHING. Re-running yields 0 new rows.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')

const md = readFileSync(resolve(repoRoot, 'scripts/watch-seed-data.md'), 'utf8')

// --------------------------------------------------------------------------
// Parse TypeScript arrays from section 2
// Each entry looks like:
//   { catalogId: '__CAT__rolex__submariner-date__126610ln__', familyId: '__FAM__rolex__submariner__',
//     brand: 'Rolex', model: 'Submariner Date 126610LN' }, // note: ...
// And for lineage:
//   { predecessorCatalogId: '__CAT__...__', successorCatalogId: '__CAT__...__',
//     relationshipType: 'successor', note: '...' },
// --------------------------------------------------------------------------

function parseFamilyAssignments(text) {
  const out = []
  const re = /\{\s*catalogId:\s*'([^']+)',\s*familyId:\s*'([^']+)',\s*brand:\s*'([^']+)',\s*model:\s*'([^']+)'\s*\}/g
  let m
  while ((m = re.exec(text)) !== null) {
    out.push({ catalogId: m[1], familyId: m[2], brand: m[3], model: m[4] })
  }
  return out
}

function parseLineageEdges(text) {
  const out = []
  // Tolerate escaped apostrophes inside strings: (?:[^'\\]|\\.)+
  const STR = `'((?:[^'\\\\]|\\\\.)*)'`
  const re = new RegExp(
    `\\{\\s*predecessorCatalogId:\\s*${STR},\\s*successorCatalogId:\\s*${STR},\\s*relationshipType:\\s*${STR},\\s*note:\\s*${STR}\\s*\\}`,
    'g'
  )
  let m
  while ((m = re.exec(text)) !== null) {
    out.push({
      pred: m[1],
      succ: m[2],
      type: m[3],
      // unescape the note for SQL emission
      note: m[4].replace(/\\(.)/g, '$1'),
    })
  }
  return out
}

const assignments = parseFamilyAssignments(md)
const edges = parseLineageEdges(md)

if (assignments.length === 0) {
  console.error('ERROR: parsed 0 FAMILY_ASSIGNMENTS — abort')
  process.exit(1)
}

// --------------------------------------------------------------------------
// Derive brands + families + catalog tuples
// --------------------------------------------------------------------------

// Each catalogId placeholder: __CAT__<brand-slug>__<model-slug>__<reference-slug>__
// Each familyId placeholder:  __FAM__<brand-slug>__<family-slug>__

function parsePlaceholder(p, kind) {
  // strip __KIND__ prefix and __ suffix
  const rest = p.replace(new RegExp(`^__${kind}__`), '').replace(/__$/, '')
  return rest.split('__')
}

// Extract the proper-case reference from the model field.
// Heuristic: the reference is the trailing whitespace-separated token (the
// agent's manifest always puts the ref number at the end).
// e.g. "Submariner Date 126610LN" → model="Submariner Date", reference="126610LN"
//       "Speedmaster CK2998"     → model="Speedmaster", reference="CK2998"
//       "62MAS 6217-8001"        → model="62MAS", reference="6217-8001"
function splitModelRef(modelFull) {
  const tokens = modelFull.split(/\s+/)
  if (tokens.length === 1) {
    // single-token model — reference is the whole thing (e.g. "SKX007")
    return { model: tokens[0], reference: tokens[0] }
  }
  return {
    model: tokens.slice(0, -1).join(' '),
    reference: tokens[tokens.length - 1],
  }
}

// Derive the family DISPLAY name from the family placeholder slug.
// Agent's slug rules: lowercase hyphenated. We restore proper title case.
// Hardcoded acronym/special-case map to preserve mixed-case where horology uses it.
const FAMILY_NAME_MAP = {
  'submariner': 'Submariner',
  'sea-dweller': 'Sea-Dweller',
  'gmt-master-ii': 'GMT-Master II',
  'daytona': 'Daytona',
  'explorer': 'Explorer',
  'datejust': 'Datejust',
  'speedmaster-moonwatch': 'Speedmaster Moonwatch',
  'seamaster-diver-300m': 'Seamaster Diver 300M',
  'seamaster-planet-ocean': 'Seamaster Planet Ocean',
  'constellation': 'Constellation',
  'royal-oak': 'Royal Oak',
  'royal-oak-offshore': 'Royal Oak Offshore',
  'black-bay': 'Black Bay',
  'pelagos': 'Pelagos',
  '1521': '1521',
  'c60-trident': 'C60 Trident',
  'ocean': 'Ocean',
  'moonswatch': 'MoonSwatch',
  'legend-diver': 'Legend Diver',
  'heritage-military': 'Heritage Military',
  'spirit': 'Spirit',
  'hydroconquest': 'HydroConquest',
  'prospex-marinemaster': 'Prospex Marinemaster',
  'prospex-turtle': 'Prospex Turtle',
  'prospex-sumo': 'Prospex Sumo',
  '5-sports': '5 Sports',
  'skx': 'SKX',
  'alpinist': 'Alpinist',
  'heritage': 'Heritage',
  'evolution-9': 'Evolution 9',
  'sport': 'Sport',
  'elegance': 'Elegance',
}

// Slug-to-display brand map (the agent's TS entries already carry proper-case
// brand strings; we use those directly. This map is only for cases where we
// derive a brand string from a family placeholder.)
function slugToBrand(slug) {
  return slug.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
}

// Build sets of (brand, family, catalog, edge) deduplicated.
const brandSet = new Map() // name -> { slug, country }
const familySet = new Map() // key=`${brand}|${familyName}` -> { brand, familyName }
const catalogRows = []
const edgeRows = []

const COUNTRY_OF_ORIGIN = {
  'Rolex': 'Switzerland',
  'Omega': 'Switzerland',
  'Audemars Piguet': 'Switzerland',
  'Tudor': 'Switzerland',
  'Squale': 'Switzerland',
  'Christopher Ward': 'United Kingdom',
  'Steinhart': 'Germany',
  'Swatch': 'Switzerland',
  'Longines': 'Switzerland',
  'Seiko': 'Japan',
  'Grand Seiko': 'Japan',
}

function brandSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

for (const a of assignments) {
  brandSet.set(a.brand, {
    slug: brandSlug(a.brand),
    country: COUNTRY_OF_ORIGIN[a.brand] ?? null,
  })

  // Parse family slug → display name
  const famSlugs = parsePlaceholder(a.familyId, 'FAM')
  // famSlugs = [brand-slug, family-slug]
  const familySlug = famSlugs.slice(1).join('-')
  const familyName = FAMILY_NAME_MAP[familySlug]
  if (!familyName) {
    console.error(`ERROR: no FAMILY_NAME_MAP entry for slug '${familySlug}' (placeholder ${a.familyId})`)
    process.exit(1)
  }
  familySet.set(`${a.brand}|${familyName}`, { brand: a.brand, familyName })

  // Parse catalog model + reference
  const { model, reference } = splitModelRef(a.model)
  catalogRows.push({
    brand: a.brand,
    model,
    reference,
    familyBrand: a.brand,
    familyName,
  })
}

// Build edge rows. Each edge's predecessor/successor placeholder maps to a
// catalog row via (brand-slug, model-slug, reference-slug). We resolve via the
// catalog table's (brand_normalized, reference_normalized) — model_normalized
// is implicit because the agent's placeholders are 1:1 with the TS arrays.
//
// We need to find the catalog row in our catalogRows[] array by matching the
// placeholder back. Then we emit SQL that JOINs to the catalog table by
// (brand_normalized, reference_normalized) — those are GENERATED on the
// catalog row.

function placeholderToBrandRef(p) {
  // __CAT__<brand-slug>__<model-slug>__<reference-slug>__
  // Returns the lowercase (brand, reference) the catalog row will normalize to.
  const parts = parsePlaceholder(p, 'CAT')
  if (parts.length < 3) {
    throw new Error(`malformed catalog placeholder: ${p}`)
  }
  const refSlug = parts[parts.length - 1]
  const brandSlugStr = parts[0]
  // brand_normalized is lower(trim(brand)) — collapse dashes back to single string
  return {
    brandNorm: brandSlugStr.replace(/-/g, ' '),
    refNormSlug: refSlug, // already lowercase alphanumeric+dash; catalog ref_normalized strips non-alphanum
    placeholder: p,
  }
}

for (const e of edges) {
  edgeRows.push({
    pred: placeholderToBrandRef(e.pred),
    succ: placeholderToBrandRef(e.succ),
    type: e.type,
    note: e.note,
  })
}

// --------------------------------------------------------------------------
// Emit SQL
// --------------------------------------------------------------------------

function sqlString(s) {
  if (s === null || s === undefined) return 'NULL'
  return `'${String(s).replace(/'/g, "''")}'`
}

let sql = ''
sql += `-- Phase 39b Wave 0 — catalog bootstrap (one-shot data seed).\n`
sql += `-- Generated by scripts/build-seed-sql.mjs from scripts/watch-seed-data.md\n`
sql += `-- Idempotent: every INSERT uses ON CONFLICT DO NOTHING.\n`
sql += `-- Counts: ${brandSet.size} brands, ${familySet.size} families, ${catalogRows.length} catalog rows, ${edgeRows.length} lineage edges.\n`
sql += `\n`
sql += `BEGIN;\n\n`

// 1. Brands
sql += `-- ----- 1. brands (${brandSet.size}) -----\n`
sql += `INSERT INTO brands (name, slug, country_of_origin) VALUES\n`
const brandValues = []
for (const [name, info] of brandSet) {
  brandValues.push(`  (${sqlString(name)}, ${sqlString(info.slug)}, ${sqlString(info.country)})`)
}
sql += brandValues.join(',\n') + '\n'
sql += `ON CONFLICT (name_normalized) DO NOTHING;\n\n`

// 2. Families
sql += `-- ----- 2. watch_families (${familySet.size}) -----\n`
sql += `INSERT INTO watch_families (brand_id, name)\n`
sql += `SELECT b.id, v.family_name\n`
sql += `FROM (VALUES\n`
const famValues = []
for (const { brand, familyName } of familySet.values()) {
  famValues.push(`  (${sqlString(brand)}, ${sqlString(familyName)})`)
}
sql += famValues.join(',\n') + '\n'
sql += `) AS v(brand_name, family_name)\n`
sql += `JOIN brands b ON b.name_normalized = lower(trim(v.brand_name))\n`
sql += `ON CONFLICT (brand_id, name_normalized) DO NOTHING;\n\n`

// 3. Catalog rows (with family_id pre-resolved).
// Uses WHERE NOT EXISTS rather than ON CONFLICT because local Docker DB does not
// carry the watches_catalog_natural_key unique constraint (Phase 17/19 drift) —
// prod has it but local doesn't, and we want the same SQL to smoke both.
sql += `-- ----- 3. watches_catalog (${catalogRows.length}) -----\n`
sql += `INSERT INTO watches_catalog (brand, model, reference, family_id, brand_id, source)\n`
sql += `SELECT v.brand, v.model, v.reference, wf.id, b.id, 'admin_curated'\n`
sql += `FROM (VALUES\n`
const catValues = []
for (const c of catalogRows) {
  catValues.push(
    `  (${sqlString(c.brand)}, ${sqlString(c.model)}, ${sqlString(c.reference)}, ${sqlString(c.familyName)})`
  )
}
sql += catValues.join(',\n') + '\n'
sql += `) AS v(brand, model, reference, family_name)\n`
sql += `JOIN brands b ON b.name_normalized = lower(trim(v.brand))\n`
sql += `JOIN watch_families wf ON wf.brand_id = b.id AND wf.name_normalized = lower(trim(v.family_name))\n`
sql += `WHERE NOT EXISTS (\n`
sql += `  SELECT 1 FROM watches_catalog c\n`
sql += `   WHERE c.brand_normalized = lower(trim(v.brand))\n`
sql += `     AND c.model_normalized = lower(trim(v.model))\n`
sql += `     AND c.reference_normalized = regexp_replace(lower(trim(v.reference)), '[^a-z0-9]+', '', 'g')\n`
sql += `);\n\n`

// 4. Lineage edges (resolve catalog UUIDs via JOIN on brand_normalized + reference_normalized)
sql += `-- ----- 4. watch_lineage_edges (${edgeRows.length}) -----\n`
sql += `INSERT INTO watch_lineage_edges (predecessor_catalog_id, successor_catalog_id, relationship_type)\n`
sql += `SELECT pred.id, succ.id, v.rel_type::lineage_relationship_type\n`
sql += `FROM (VALUES\n`
const edgeValues = []
for (const e of edgeRows) {
  edgeValues.push(
    `  (${sqlString(e.pred.brandNorm)}, ${sqlString(e.pred.refNormSlug)}, ${sqlString(e.succ.brandNorm)}, ${sqlString(e.succ.refNormSlug)}, ${sqlString(e.type)}, ${sqlString(e.note)})`
  )
}
sql += edgeValues.join(',\n') + '\n'
sql += `) AS v(pred_brand_norm, pred_ref_norm, succ_brand_norm, succ_ref_norm, rel_type, note)\n`
sql += `JOIN watches_catalog pred ON pred.brand_normalized = v.pred_brand_norm\n`
sql += `  AND pred.reference_normalized = regexp_replace(v.pred_ref_norm, '[^a-z0-9]+', '', 'g')\n`
sql += `JOIN watches_catalog succ ON succ.brand_normalized = v.succ_brand_norm\n`
sql += `  AND succ.reference_normalized = regexp_replace(v.succ_ref_norm, '[^a-z0-9]+', '', 'g')\n`
sql += `ON CONFLICT (predecessor_catalog_id, successor_catalog_id, relationship_type) DO NOTHING;\n\n`

// 5. Summary
sql += `-- ----- summary -----\n`
sql += `SELECT\n`
sql += `  (SELECT COUNT(*) FROM brands)                AS total_brands,\n`
sql += `  (SELECT COUNT(*) FROM watch_families)        AS total_families,\n`
sql += `  (SELECT COUNT(*) FROM watches_catalog)       AS total_catalog_rows,\n`
sql += `  (SELECT COUNT(*) FROM watches_catalog WHERE family_id IS NOT NULL) AS catalog_with_family,\n`
sql += `  (SELECT COUNT(*) FROM watch_lineage_edges)   AS total_lineage_edges;\n\n`

sql += `COMMIT;\n`

const out = resolve(repoRoot, 'scripts/seed-bootstrap-2026-05-13.sql')
writeFileSync(out, sql)

console.log(`✓ Wrote ${out}`)
console.log(`  ${brandSet.size} brands, ${familySet.size} families, ${catalogRows.length} catalog rows, ${edgeRows.length} lineage edges`)
console.log(`\nBrands inserted: ${[...brandSet.keys()].join(', ')}`)
console.log(`\nFamilies inserted:`)
const byBrand = new Map()
for (const { brand, familyName } of familySet.values()) {
  if (!byBrand.has(brand)) byBrand.set(brand, [])
  byBrand.get(brand).push(familyName)
}
for (const [brand, fams] of byBrand) {
  console.log(`  ${brand}: ${fams.join(', ')}`)
}
