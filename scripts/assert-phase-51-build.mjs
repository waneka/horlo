#!/usr/bin/env node
/**
 * Phase 51 — Profile route PPR opt-out: local build artifact structural assertion.
 *
 * Usage:
 *   node scripts/assert-phase-51-build.mjs
 *
 * Requires `npm run build` to have run successfully first.
 *
 * Env vars (optional):
 *   BUILD_LOG=<path>   Path to a captured `npm run build` stdout. When set, the
 *                     script ALSO greps the log for the literal substring
 *                     `◐ Partial Prerender /u/[username]/[tab]` and FAILS CLOSED
 *                     if found. Defense-in-depth in case Next changes its
 *                     manifest shape (plan-checker WARNING 4).
 *
 * Exit codes:
 *   0   /u/[username]/[tab] is NOT classified PPR (structural fix in place)
 *   1   /u/[username]/[tab] is still PPR-eligible (regression contract on current main)
 *   2   .next/ manifest not found — run `npm run build` first (skip, not fail)
 *
 * Assertion (REQ-51-03): the local build output must NOT classify
 * /u/[username]/[tab] as PARTIALLY_STATIC. The route must be either fully
 * dynamic (no entry) or explicitly marked non-PPR.
 *
 * The manifest shape varies by Next 16 minor; the script is permissive about
 * which file is authoritative and applies a "strictest reading wins / fail
 * closed" rule when multiple manifests disagree.
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ROUTE_KEY = '/u/[username]/[tab]'
const BUILD_LOG_LITERAL = '◐ Partial Prerender /u/[username]/[tab]'

const cwd = process.cwd()

const manifestCandidates = [
  '.next/prerender-manifest.json',
  '.next/app-build-manifest.json',
  '.next/routes-manifest.json',
  '.next/server/app-paths-manifest.json',
]

const foundManifests = manifestCandidates
  .map((rel) => ({ rel, abs: resolve(cwd, rel) }))
  .filter(({ abs }) => existsSync(abs))

if (foundManifests.length === 0) {
  console.log('SKIP: .next manifest not found; run `npm run build` first')
  process.exit(2)
}

/**
 * Inspect a single manifest payload for the route classification.
 * Returns { violated: boolean, evidence?: unknown } per manifest.
 */
function inspectManifest(rel, json) {
  // Shape 1: prerender-manifest.json
  //   { routes: { "/path": {...} }, dynamicRoutes: { "/u/[username]/[tab]": {...} } }
  //   We FAIL if /u/[username]/[tab] appears under `routes` (statically prerendered)
  //   OR under `dynamicRoutes` with a prerender:true flag.
  if (json && typeof json === 'object') {
    if (json.routes && typeof json.routes === 'object' && ROUTE_KEY in json.routes) {
      return {
        violated: true,
        evidence: { manifest: rel, where: 'routes', entry: json.routes[ROUTE_KEY] },
      }
    }
    if (
      json.dynamicRoutes &&
      typeof json.dynamicRoutes === 'object' &&
      ROUTE_KEY in json.dynamicRoutes
    ) {
      const entry = json.dynamicRoutes[ROUTE_KEY]
      // Some Next versions store {prerender: true} or {fallback: 'static'} markers.
      if (entry && typeof entry === 'object') {
        if (entry.prerender === true || entry.fallback === 'static') {
          return {
            violated: true,
            evidence: { manifest: rel, where: 'dynamicRoutes', entry },
          }
        }
      }
    }
  }

  // Shape 2: app-build-manifest.json — sometimes has a per-route renderingMode field.
  //   { rootMainFiles: [...], pages: { "/u/[username]/[tab]": {renderingMode: 'PARTIALLY_STATIC', ...} } }
  if (json && typeof json === 'object' && json.pages && typeof json.pages === 'object') {
    if (ROUTE_KEY in json.pages) {
      const entry = json.pages[ROUTE_KEY]
      if (entry && typeof entry === 'object' && entry.renderingMode === 'PARTIALLY_STATIC') {
        return {
          violated: true,
          evidence: { manifest: rel, where: 'pages', entry },
        }
      }
    }
  }

  // Shape 3: arbitrary nested objects — walk keys looking for renderingMode='PARTIALLY_STATIC'
  // associated with our route. Conservative deep search; only flags exact substring matches
  // to avoid false positives.
  // (Skipped — the two shapes above cover Next 16.2.x manifest formats; deep walks risk
  // false positives. Keep this slot for future extension.)

  return { violated: false }
}

const violations = []
for (const { rel, abs } of foundManifests) {
  try {
    const raw = readFileSync(abs, 'utf8')
    const json = JSON.parse(raw)
    const result = inspectManifest(rel, json)
    if (result.violated) violations.push(result.evidence)
  } catch (err) {
    // Manifest is unparseable — surface as a violation per fail-closed rule.
    violations.push({ manifest: rel, error: err instanceof Error ? err.message : String(err) })
  }
}

// Defense-in-depth: build-log substring check
if (process.env.BUILD_LOG) {
  const logPath = resolve(cwd, process.env.BUILD_LOG)
  if (!existsSync(logPath)) {
    console.error(`FAIL: BUILD_LOG=${process.env.BUILD_LOG} but file not found at ${logPath}`)
    process.exit(1)
  }
  const log = readFileSync(logPath, 'utf8')
  if (log.includes(BUILD_LOG_LITERAL)) {
    violations.push({
      source: 'build-log',
      literal: BUILD_LOG_LITERAL,
      path: process.env.BUILD_LOG,
    })
  }
}

if (violations.length > 0) {
  console.error('FAIL: /u/[username]/[tab] is still PPR-eligible — Phase 51 structural fix incomplete')
  for (const v of violations) {
    console.log(JSON.stringify(v, null, 2))
  }
  process.exit(1)
}

console.log('OK: /u/[username]/[tab] is not PPR-classified in build output')
process.exit(0)
