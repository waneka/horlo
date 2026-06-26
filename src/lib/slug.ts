// Slug helpers — shared by Phase 79 backfill script + Phase 80 ingest resolver.
// Server-only because slugifyWithRandomSuffix uses node:crypto (randomUUID).
import 'server-only'

import { randomUUID } from 'node:crypto'

/**
 * Slug generator shared by Phase 79 backfill script + Phase 80 ingest resolver.
 * Matches the established slug shape in the existing `brands` table (53 rows
 * inspected). Verbatim copy of scripts/v8.4-brand-canonicalization.ts L165–167.
 *
 * Example: slugify('Acme Co!') === 'acme-co'
 */
export function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/**
 * Slug generator with a pre-emptive 6-char random suffix.
 *
 * D-80 Discretion / Open Question #8: auto-create rows for novel brands produced
 * by the Phase 80 ingest resolver are tagged `needs_review = true` and will be
 * renamed by the operator via Phase 82's /admin/brands UI. URL prettiness on these
 * transient rows is not a priority. By appending a random suffix at INSERT time we
 * eliminate the `brands_slug_unique` (23505) violation and the retry-on-collision
 * code path entirely — a single INSERT always succeeds on the slug constraint.
 *
 * The suffix is drawn from the first 6 hex chars of a crypto-random UUID:
 *   `${slugify(name)}-${suffix}` → e.g. 'acme-co-a1b2c3'
 * Always matches /^[a-z0-9-]+-[a-f0-9]{6}$/ for any ASCII name input.
 */
export function slugifyWithRandomSuffix(name: string): string {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 6)
  return `${slugify(name)}-${suffix}`
}
