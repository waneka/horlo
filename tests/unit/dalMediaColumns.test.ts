// Wave 0 RED stub — Phase 77 / 77-01-PLAN.md
// Plan 03: upgraded from todo to assertions (WR-02)
//
// Source-level structural guardrails — analog: tests/unit/wearRail.test.ts.
// For each of the 4 readers widened in Plan 03, assert the function body
// SELECTs the three Phase 76 media columns (mediaType / mediaPath / posterPath)
// alongside the preserved photoUrl. Strategy (b) per 77-03-PLAN.md — column-
// reference identity is what WR-02 actually asserts; mocking the Drizzle chain
// adds shape without value.

// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WEAR_EVENTS_SRC = path.resolve(__dirname, '../../src/data/wearEvents.ts')

function readSource(): string {
  return readFileSync(WEAR_EVENTS_SRC, 'utf-8')
}

function extractFunctionBody(src: string, fnName: string): string {
  const fnStart = src.indexOf(`export async function ${fnName}`)
  if (fnStart === -1) throw new Error(`Function ${fnName} not found in wearEvents.ts`)
  let depth = 0
  let started = false
  let i = fnStart
  while (i < src.length) {
    if (src[i] === '{') {
      depth++
      started = true
    } else if (src[i] === '}') {
      depth--
      if (started && depth === 0) return src.slice(fnStart, i + 1)
    }
    i++
  }
  throw new Error(`Could not find closing brace for ${fnName}`)
}

describe('DAL media columns (WR-02)', () => {
  it('getWearEventByIdForViewer SELECTs mediaType/mediaPath/posterPath (WR-02)', () => {
    const body = extractFunctionBody(readSource(), 'getWearEventByIdForViewer')
    expect(body).toContain('mediaType: wearEvents.mediaType')
    expect(body).toContain('mediaPath: wearEvents.mediaPath')
    expect(body).toContain('posterPath: wearEvents.posterPath')
    // VID-15 regression guard — photo column preserved
    expect(body).toContain('photoUrl: wearEvents.photoUrl')
  })

  it('getWearEventsForViewer (non-owner) SELECTs mediaType/mediaPath/posterPath (WR-02)', () => {
    const body = extractFunctionBody(readSource(), 'getWearEventsForViewer')
    expect(body).toContain('mediaType: wearEvents.mediaType')
    expect(body).toContain('mediaPath: wearEvents.mediaPath')
    expect(body).toContain('posterPath: wearEvents.posterPath')
    expect(body).toContain('photoUrl: wearEvents.photoUrl')
  })

  it('getWearRailForViewer SELECTs mediaType/mediaPath/posterPath + propagates to tile (WR-02)', () => {
    const body = extractFunctionBody(readSource(), 'getWearRailForViewer')
    expect(body).toContain('mediaType: wearEvents.mediaType')
    expect(body).toContain('mediaPath: wearEvents.mediaPath')
    expect(body).toContain('posterPath: wearEvents.posterPath')
    expect(body).toContain('photoUrl: wearEvents.photoUrl')
    // tile mapping surfaces mediaType + posterPath per Plan 02 type extension
    expect(body).toContain('mediaType: r.mediaType')
    expect(body).toContain('posterPath: r.posterPath')
  })

  it('getActiveWearsForUser SELECTs mediaType/mediaPath/posterPath in both branches (WR-02)', () => {
    const body = extractFunctionBody(readSource(), 'getActiveWearsForUser')
    // both owner and non-owner branches reference each column at least once
    const mediaTypeCount = body.split('mediaType: wearEvents.mediaType').length - 1
    const mediaPathCount = body.split('mediaPath: wearEvents.mediaPath').length - 1
    const posterPathCount = body.split('posterPath: wearEvents.posterPath').length - 1
    expect(mediaTypeCount).toBeGreaterThanOrEqual(2)
    expect(mediaPathCount).toBeGreaterThanOrEqual(2)
    expect(posterPathCount).toBeGreaterThanOrEqual(2)
    expect(body).toContain('photoUrl: wearEvents.photoUrl')
  })
})
