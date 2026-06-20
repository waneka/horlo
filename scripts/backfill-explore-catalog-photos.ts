/**
 * Quick task 260614-f82: Backfill image_url for catalog watches added via structured mode.
 * Usage: npm run explore:photo-backfill
 *
 * Reads .planning/quick/260614-f82-seed-explore-page-editorial-content-8-cu/URLS.md,
 * fetches each URL to extract og:image meta tag, and UPDATEs watches_catalog rows
 * that currently have image_url = NULL.
 *
 * Only touches: image_url, image_source_url, image_source_quality, updated_at.
 * Never modifies: brand, model, reference, or any other column.
 * Idempotent: skips rows that already have image_url set.
 *
 * Matching strategy:
 *   - Tries the two triples JSON files first (brand + reference key)
 *   - Falls back to parsing "ref XXXX" from the URLS.md label + domain → brand mapping
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as cheerio from 'cheerio'

// ---------------------------------------------------------------------------
// Env validation
// ---------------------------------------------------------------------------

const DB_URL = process.env.DATABASE_URL
if (!DB_URL) {
  console.error('[photo-backfill] ERROR: DATABASE_URL is not set.')
  console.error('Run: npm run explore:photo-backfill  (loads .env.local via --env-file)')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// DB client (postgres — same pattern as other scripts)
// ---------------------------------------------------------------------------

import postgres from 'postgres'

const sql = postgres(DB_URL, { prepare: false })

// ---------------------------------------------------------------------------
// SSRF-safe fetch (relative import; tsx doesn't resolve @/* aliases)
// ---------------------------------------------------------------------------

import { safeFetch } from '../src/lib/ssrf'

// ---------------------------------------------------------------------------
// File paths
// ---------------------------------------------------------------------------

const TASK_DIR = path.join(
  process.cwd(),
  '.planning/quick/260614-f82-seed-explore-page-editorial-content-8-cu',
)
const URLS_FILE = path.join(TASK_DIR, 'URLS.md')
const SEED_DATA_DIR = path.join(process.cwd(), 'scripts/seed-data')
const MANIFEST_FILE = path.join(SEED_DATA_DIR, 'explore-photo-backfill.json')

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EntryStatus = 'updated' | 'skipped-has-photo' | 'no-og-image' | 'fetch-failed' | 'no-match'

interface ManifestEntry {
  label: string
  url: string
  brand?: string
  reference?: string
  status: EntryStatus
  oldImageUrl?: string | null
  newImageUrl?: string
  errorReason?: string
}

interface ParsedUrl {
  label: string
  url: string
}

interface Triple {
  brand: string
  model: string
  reference: string
  label: string
}

// ---------------------------------------------------------------------------
// Parse URLS.md — extract (label, url) pairs
// ---------------------------------------------------------------------------

function parseUrlsMd(filePath: string): ParsedUrl[] {
  if (!fs.existsSync(filePath)) {
    console.error(`[photo-backfill] URLS.md not found at ${filePath}`)
    process.exit(1)
  }

  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n')
  const results: ParsedUrl[] = []
  const ENTRY_RE = /^-\s+(.+?):\s*(https?:\/\/\S+)\s*$/

  for (const line of lines) {
    if (line.trim().startsWith('#') || line.trim().startsWith('<!--')) continue
    const match = ENTRY_RE.exec(line)
    if (match) {
      results.push({ label: match[1].trim(), url: match[2].trim() })
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// Load triples JSON files
// ---------------------------------------------------------------------------

function loadTriples(): Triple[] {
  const files = [
    path.join(SEED_DATA_DIR, 'explore-structured-triples.json'),
    path.join(SEED_DATA_DIR, 'explore-structured-triples-missing.json'),
  ]

  const all: Triple[] = []
  for (const f of files) {
    if (fs.existsSync(f)) {
      const data = JSON.parse(fs.readFileSync(f, 'utf8')) as Triple[]
      all.push(...data)
    }
  }
  return all
}

// ---------------------------------------------------------------------------
// Domain → brand mapping
// ---------------------------------------------------------------------------

const DOMAIN_TO_BRAND: Array<[string | RegExp, string]> = [
  ['alange-soehne.com', 'A. Lange & Söhne'],
  ['anordain.com', 'anOrdain'],
  ['baltic-watches.com', 'Baltic'],
  ['baume-et-mercier.com', 'Baume & Mercier'],
  ['blancpain.com', 'Blancpain'],
  ['certina.com', 'Certina'],
  ['christopherward.com', 'Christopher Ward'],
  ['formexwatch.com', 'Formex'],
  ['furlanmarri.com', 'Furlan Marri'],
  ['girard-perregaux.com', 'Girard-Perregaux'],
  ['hamiltonwatch.com', 'Hamilton Watch'],
  ['heronwatches.com', 'Héron Watches'],
  ['jaeger-lecoultre.com', 'Jaeger-LeCoultre'],
  ['midowatches.com', 'Mido'],
  ['mido.com', 'Mido'],
  ['nomos-glashuette.com', 'Nomos Glashütte'],
  ['omegawatches.com', 'Omega'],
  ['oris.ch', 'Oris'],
  ['oris.com', 'Oris'],
  ['orientwatchusa.com', 'Orient'],
  ['orient-watch.com', 'Orient'],
  ['patek.com', 'Patek Philippe'],
  ['seikowatches.com', 'Seiko'],
  ['seica-watches.com', 'Serica'],
  ['serica-watches.com', 'Serica'],
  ['sinn.de', 'Sinn'],
  ['squale.ch', 'Squale'],
  ['tissotwatches.com', 'Tissot'],
  ['tissot.com', 'Tissot'],
  ['vacheron-constantin.com', 'Vacheron Constantin'],
  ['wrenwatches.com', 'Wren'],
  ['wrenwatches.co', 'Wren'],
  ['wristenthusiast.com', 'Wren'], // Wren Diver sold through wristenthusiast.com
  ['zenith-watches.com', 'Zenith'],
  ['tudorwatch.com', 'Tudor'],
  ['rolex.com', 'Rolex'],
  ['longines.com', 'Longines'],
  ['grand-seiko.com', 'Grand Seiko'],
  ['grandseikoboutique.us', 'Grand Seiko'],
  ['azfinetime.com', 'Seiko'], // third-party retailer for Seiko SPB239
  ['exquisitetimepieces.com', 'Squale'], // third-party for Squale SUB-37
]

function brandFromUrl(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '')
    for (const [pattern, brand] of DOMAIN_TO_BRAND) {
      if (typeof pattern === 'string') {
        if (hostname === pattern || hostname.endsWith(`.${pattern}`)) return brand
      } else {
        if (pattern.test(hostname)) return brand
      }
    }
  } catch {
    // ignore
  }
  return null
}

// ---------------------------------------------------------------------------
// Build (label → { brand, reference }) lookup
//
// Strategy:
//   1. Try to match URLS.md label against triples' brand+reference (exact substring or
//      reference match within label).
//   2. Fall back to parsing "ref XXXX" from the URLS.md label + domain-derived brand.
// ---------------------------------------------------------------------------

function buildLookup(
  entries: ParsedUrl[],
  triples: Triple[],
): Map<string, { brand: string; reference: string }> {
  const map = new Map<string, { brand: string; reference: string }>()

  // Build a lookup by (brand, reference) → triple for fast access
  const triplesByRef = new Map<string, Triple>()
  for (const t of triples) {
    triplesByRef.set(`${t.brand}||${t.reference}`, t)
  }

  for (const { label, url } of entries) {
    // Strategy 1: Check if any triple's reference appears in the URLS.md label text
    // e.g. label = "Khaki Field Mechanical (steel) ref H69399930" → H69399930
    let matched: { brand: string; reference: string } | null = null

    for (const t of triples) {
      // Check if label contains the reference (case-insensitive)
      if (label.toLowerCase().includes(t.reference.toLowerCase())) {
        matched = { brand: t.brand, reference: t.reference }
        break
      }
      // Also try: brand substring match + model substring match
      if (
        label.toLowerCase().includes(t.brand.toLowerCase()) &&
        label.toLowerCase().includes(t.model.toLowerCase().split(' ')[0])
      ) {
        matched = { brand: t.brand, reference: t.reference }
        break
      }
    }

    if (matched) {
      map.set(label, matched)
      continue
    }

    // Strategy 1.5: URL-derived brand + best model-word overlap with label.
    // Handles two cases the prior strategies miss:
    //   (a) URLS.md label has the OLD/PRE-RECONCILIATION ref (e.g. Laureato
    //       81005) but the catalog (and the triple) has the CORRECTED ref
    //       (81010). Strategy 1 fails because the label doesn't contain
    //       the new ref. Strategy 2 falls into "use parsed brand+ref directly"
    //       which then misses the catalog row.
    //   (b) Ref-less labels (Baltic Aquascaphe / MR01) — multiple triples
    //       for the brand, but each triple's model is in the label.
    const brandFromDomain = brandFromUrl(url)
    if (brandFromDomain) {
      const candidates = triples.filter(
        (t) => t.brand.toLowerCase() === brandFromDomain.toLowerCase(),
      )
      const labelLower = label.toLowerCase()
      let best: { triple: Triple; score: number } | null = null
      for (const t of candidates) {
        // Score = # of model words (length >= 3) that appear in the label.
        const score = t.model
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length >= 3)
          .reduce((acc, w) => (labelLower.includes(w) ? acc + 1 : acc), 0)
        if (!best || score > best.score) best = { triple: t, score }
      }
      if (best && best.score >= 1) {
        map.set(label, { brand: best.triple.brand, reference: best.triple.reference })
        continue
      }
    }

    // Strategy 2: Parse "ref XXXX" pattern from the URLS.md label
    const refMatch = label.match(/\bref\s+([A-Za-z0-9\-./]+(?:\s+[A-Za-z0-9\-./]+)*?)(?:\s*$|\s*\()/i)
    if (refMatch) {
      const reference = refMatch[1].trim()
      const brand = brandFromUrl(url)
      if (brand) {
        // Verify this combination exists in triples (if possible)
        const key = `${brand}||${reference}`
        if (triplesByRef.has(key)) {
          const t = triplesByRef.get(key)!
          map.set(label, { brand: t.brand, reference: t.reference })
        } else {
          // Use the parsed brand + reference directly (may not be in triples)
          map.set(label, { brand, reference })
        }
        continue
      }
    }

    // Strategy 3: No ref pattern — try brand from domain + any triple that matches brand
    const domainBrand = brandFromUrl(url)
    if (domainBrand) {
      const brandTriples = triples.filter(
        (t) => t.brand.toLowerCase() === domainBrand.toLowerCase(),
      )
      if (brandTriples.length === 1) {
        // Only one triple for this brand — must be it
        map.set(label, { brand: brandTriples[0].brand, reference: brandTriples[0].reference })
      }
      // Multiple triples for brand: can't determine which without a ref → leave unmatched
    }
  }

  return map
}

// ---------------------------------------------------------------------------
// Fetch HTML and extract og:image
// ---------------------------------------------------------------------------

async function extractOgImage(url: string): Promise<string | null> {
  const response = await safeFetch(url, {
    headers: {
      'User-Agent': 'WatchCollectionBot',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const html = await response.text()
  const $ = cheerio.load(html)

  // Primary: og:image
  const ogImage = $('meta[property="og:image"]').attr('content')
  if (ogImage) return ogImage.trim()

  // Fallback: twitter:image
  const twitterImage = $('meta[name="twitter:image"]').attr('content')
  if (twitterImage) return twitterImage.trim()

  // Fallback: link[rel="image_src"]
  const linkImage = $('link[rel="image_src"]').attr('href')
  if (linkImage) return linkImage.trim()

  return null
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const entries = parseUrlsMd(URLS_FILE)
  console.log(`[photo-backfill] Parsed ${entries.length} URL(s) from URLS.md`)

  const triples = loadTriples()
  console.log(`[photo-backfill] Loaded ${triples.length} triples`)

  const lookup = buildLookup(entries, triples)
  console.log(`[photo-backfill] Built lookup for ${lookup.size} / ${entries.length} entries`)

  const manifest: ManifestEntry[] = []
  let updatedCount = 0
  let skippedCount = 0
  let noOgImageCount = 0
  let failedCount = 0
  let noMatchCount = 0

  for (let i = 0; i < entries.length; i++) {
    const { label, url } = entries[i]
    const n = i + 1
    const total = entries.length
    const resolved = lookup.get(label)

    if (!resolved) {
      console.log(`[${n}/${total}] NO MATCH  ${label}`)
      manifest.push({ label, url, status: 'no-match', errorReason: 'could not determine brand/reference' })
      noMatchCount++
      continue
    }

    const { brand, reference } = resolved
    console.log(`[${n}/${total}] ${brand} (${reference})`)

    // Check current state
    const rows = await sql<Array<{ id: string; image_url: string | null }>>`
      SELECT id, image_url
      FROM watches_catalog
      WHERE brand = ${brand} AND reference = ${reference}
      LIMIT 1
    `

    if (rows.length === 0) {
      console.log(`  → no row in catalog (brand=${brand}, reference=${reference}) — skipping`)
      manifest.push({ label, url, brand, reference, status: 'no-match', errorReason: 'row not found in watches_catalog' })
      noMatchCount++
      continue
    }

    const row = rows[0]

    if (row.image_url) {
      console.log(`  → already has photo (skipping)`)
      manifest.push({ label, url, brand, reference, status: 'skipped-has-photo', oldImageUrl: row.image_url })
      skippedCount++
      continue
    }

    // Fetch URL and extract og:image
    let ogImage: string | null = null
    try {
      console.log(`  → fetching ${url}`)
      ogImage = await extractOgImage(url)
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      console.log(`  ✗ fetch failed: ${reason}`)
      manifest.push({ label, url, brand, reference, status: 'fetch-failed', errorReason: reason })
      failedCount++
      continue
    }

    if (!ogImage) {
      console.log(`  ✗ no og:image found`)
      manifest.push({ label, url, brand, reference, status: 'no-og-image', errorReason: 'no og:image, twitter:image, or link[rel=image_src] found' })
      noOgImageCount++
      continue
    }

    // UPDATE catalog row
    await sql`
      UPDATE watches_catalog
      SET
        image_url = ${ogImage},
        image_source_url = ${url},
        image_source_quality = 'unknown',
        updated_at = NOW()
      WHERE brand = ${brand} AND reference = ${reference}
    `

    const preview = ogImage.length > 60 ? ogImage.slice(0, 60) + '...' : ogImage
    console.log(`  ✓ ${brand} (${reference}) → ${preview}`)

    manifest.push({
      label,
      url,
      brand,
      reference,
      status: 'updated',
      oldImageUrl: null,
      newImageUrl: ogImage,
    })
    updatedCount++
  }

  // Write manifest
  fs.mkdirSync(SEED_DATA_DIR, { recursive: true })
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2), 'utf8')

  // Summary
  console.log('')
  console.log('─────────────────────────────────────────────────────────')
  console.log(
    `Updated ${updatedCount} / Skipped ${skippedCount} / No og:image ${noOgImageCount} / Failed ${failedCount} / No match ${noMatchCount}`,
  )
  console.log(`Manifest: ${MANIFEST_FILE}`)
  console.log('─────────────────────────────────────────────────────────')

  await sql.end()
  process.exit(0)
}

main().catch((err) => {
  console.error('[photo-backfill] fatal:', err)
  sql.end().finally(() => process.exit(1))
})
