/**
 * Wave 0 guardrail — WPIC-04 (D-17)
 * Asserts that getWearRailForViewer is unchanged by Phase 62 work.
 *
 * This is a SOURCE-LEVEL structural guardrail:
 * - The function body must still contain its 48h cutoff token.
 * - The function body must still contain the followers-branch predicate.
 * - The function body must NOT reference hiddenFromDetail or hidden_from_detail.
 *
 * D-17: The wear rail function must stay byte-for-byte unchanged through Phase 62.
 * Any accidental edit to the rail triggers this test as a canary.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// @vitest-environment node

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WEAR_EVENTS_SRC = path.resolve(__dirname, '../../src/data/wearEvents.ts')

function readSource(): string {
  return readFileSync(WEAR_EVENTS_SRC, 'utf-8')
}

function extractFunctionBody(src: string, fnName: string): string {
  // Find the function declaration line
  const fnStart = src.indexOf(`export async function ${fnName}`)
  if (fnStart === -1) throw new Error(`Function ${fnName} not found in wearEvents.ts`)

  // Walk forward to find the matching closing brace
  let depth = 0
  let started = false
  let i = fnStart
  while (i < src.length) {
    if (src[i] === '{') {
      depth++
      started = true
    } else if (src[i] === '}') {
      depth--
      if (started && depth === 0) {
        return src.slice(fnStart, i + 1)
      }
    }
    i++
  }
  throw new Error(`Could not find closing brace for ${fnName}`)
}

describe('getWearRailForViewer guardrail (WPIC-04 / D-17)', () => {
  it('D-17: function exists in src/data/wearEvents.ts', () => {
    const src = readSource()
    expect(src).toContain('export async function getWearRailForViewer')
  })

  it('D-17: function body retains 48h cutoff token', () => {
    const src = readSource()
    const body = extractFunctionBody(src, 'getWearRailForViewer')
    // The 48h window — exact token used in the implementation
    expect(body).toContain('48 * 60 * 60 * 1000')
  })

  it("D-17: function body retains followers-branch predicate (visibility, 'followers')", () => {
    const src = readSource()
    const body = extractFunctionBody(src, 'getWearRailForViewer')
    // The followers visibility branch
    expect(body).toContain("'followers'")
  })

  it('D-17: function body does NOT reference hiddenFromDetail', () => {
    const src = readSource()
    const body = extractFunctionBody(src, 'getWearRailForViewer')
    // The rail must NOT filter on hidden_from_detail (D-17: rail is unchanged)
    expect(body).not.toContain('hiddenFromDetail')
    expect(body).not.toContain('hidden_from_detail')
  })

  it('D-17: function body retains G-5 self-bypass (viewerId equality check)', () => {
    const src = readSource()
    const body = extractFunctionBody(src, 'getWearRailForViewer')
    // Self-include bypass must remain
    expect(body).toContain('viewerId')
  })

  it('D-17: function body retains leftJoin against follows table', () => {
    const src = readSource()
    const body = extractFunctionBody(src, 'getWearRailForViewer')
    // leftJoin for follow-status resolution
    expect(body).toContain('leftJoin')
  })
})
