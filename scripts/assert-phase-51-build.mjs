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
 *   0   /u/[username]/[tab] is NOT classified PPR AND appears in at least one
 *       manifest in a fully-dynamic (non-PPR) shape (structural fix verified).
 *   1   /u/[username]/[tab] is still PPR-eligible (regression contract on current main).
 *   2   .next/ manifest not found — run `npm run build` first (skip, not fail).
 *   3   (WR-03) Route NOT FOUND in any inspected manifest AND no BUILD_LOG
 *       fallback ran. This indicates the manifest shape may have changed — the
 *       assertion is INCONCLUSIVE and we fail CLOSED so a silent regression
 *       cannot pass. Set BUILD_LOG=<path> to provide a defense-in-depth
 *       fallback check; if the build log confirms the route is non-PPR, the
 *       script will pass even when the manifest shape is unrecognized.
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
let routeFoundInAnyManifest = false
for (const { rel, abs } of foundManifests) {
  try {
    const raw = readFileSync(abs, 'utf8')
    const json = JSON.parse(raw)
    // WR-03: track whether the route appears in ANY known manifest slot
    // (irrespective of PPR classification). A "not found anywhere" outcome
    // is treated as an inconclusive result (exit 3) further down rather
    // than a silent pass — the previous behavior of exiting 0 when the
    // route was missing from every manifest could mask a manifest-shape
    // change that simply moved the entry to a new key.
    if (json && typeof json === 'object') {
      if (
        (json.routes && typeof json.routes === 'object' && ROUTE_KEY in json.routes) ||
        (json.dynamicRoutes &&
          typeof json.dynamicRoutes === 'object' &&
          ROUTE_KEY in json.dynamicRoutes) ||
        (json.pages && typeof json.pages === 'object' && ROUTE_KEY in json.pages)
      ) {
        routeFoundInAnyManifest = true
      }
    }
    const result = inspectManifest(rel, json)
    if (result.violated) violations.push(result.evidence)
  } catch (err) {
    // Manifest is unparseable — surface as a violation per fail-closed rule.
    violations.push({ manifest: rel, error: err instanceof Error ? err.message : String(err) })
  }
}

// Defense-in-depth: build-log substring check
let buildLogCheckPerformed = false
let buildLogConfirmsNonPpr = false
if (process.env.BUILD_LOG) {
  const logPath = resolve(cwd, process.env.BUILD_LOG)
  if (!existsSync(logPath)) {
    console.error(`FAIL: BUILD_LOG=${process.env.BUILD_LOG} but file not found at ${logPath}`)
    process.exit(1)
  }
  const log = readFileSync(logPath, 'utf8')
  buildLogCheckPerformed = true
  if (log.includes(BUILD_LOG_LITERAL)) {
    violations.push({
      source: 'build-log',
      literal: BUILD_LOG_LITERAL,
      path: process.env.BUILD_LOG,
    })
  } else {
    // WR-03 (Phase 51 review): when the build log was inspected and the
    // PPR literal is absent, treat that as positive confirmation that the
    // route is non-PPR — covers the manifest-shape-change scenario below.
    buildLogConfirmsNonPpr = true
  }
}

if (violations.length > 0) {
  console.error('FAIL: /u/[username]/[tab] is still PPR-eligible — Phase 51 structural fix incomplete')
  for (const v of violations) {
    console.log(JSON.stringify(v, null, 2))
  }
  process.exit(1)
}

// WR-03 (Phase 51 review): when the route is NOT found in any inspected
// manifest and no BUILD_LOG fallback confirmed non-PPR behavior, the result
// is INCONCLUSIVE rather than a clean pass. Previously the script exited 0
// in this case ("if it's not present, it isn't PPR-classified") — but that
// silently masks the manifest-shape-change scenario explicitly called out
// in the inspectManifest comment block above. Fail closed instead.
if (!routeFoundInAnyManifest && !buildLogConfirmsNonPpr) {
  console.error(
    `FAIL: ${ROUTE_KEY} not found in any of the inspected Next 16 manifests, ` +
      'and no BUILD_LOG fallback was supplied. The Next manifest shape may have ' +
      'changed since this script was written, so the assertion is inconclusive. ' +
      'Either (a) update inspectManifest() to recognize the new shape, or ' +
      '(b) capture build output to a file and re-run with BUILD_LOG=<path> ' +
      'so the build-log substring check can confirm non-PPR classification.',
  )
  console.error(
    `  inspected manifests: ${foundManifests.map((m) => m.rel).join(', ')}`,
  )
  process.exit(3)
}

console.log(
  buildLogCheckPerformed
    ? `OK: ${ROUTE_KEY} is not PPR-classified (manifest + build-log checks both pass)`
    : `OK: ${ROUTE_KEY} is not PPR-classified in build output`,
)
process.exit(0)
