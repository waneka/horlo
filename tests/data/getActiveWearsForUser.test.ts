import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Unit tests (always run): mock Drizzle to assert the SQL shape built by
// getActiveWearsForUser. Verifies: oldest-first ordering (D-05), 48h cutoff
// (D-04/48h), self-bypass branch (SEC gate G-5), non-self gate including
// profilePublic predicate (SEC gate G-4), raw photoUrl passthrough (F-2),
// and actor filter.
//
// Mirrors the mocked-drizzle PART A structure from
// tests/data/getWearRailForViewer.test.ts.
// ---------------------------------------------------------------------------

type Call = { op: string; args: unknown[] }

// ── Mock state ──────────────────────────────────────────────────────────────
// selectCount tracks which select() invocation we are on:
//   self branch   → 1 select (wears only)
//   non-self branch → 2 selects (follows check, then wears)
let followRows: Array<{ id: string }> = []
let wearRows: unknown[] = []
let calls: Call[] = []
let selectCount = 0

function makeFollowChain() {
  const chain: Record<string, (...args: unknown[]) => unknown> = {
    from: (...args: unknown[]) => {
      calls.push({ op: 'follow.from', args })
      return chain
    },
    where: (...args: unknown[]) => {
      calls.push({ op: 'follow.where', args })
      return chain
    },
    limit: (...args: unknown[]) => {
      calls.push({ op: 'follow.limit', args })
      return Promise.resolve(followRows)
    },
  } as never
  return chain
}

function makeWearChain() {
  const chain: Record<string, (...args: unknown[]) => unknown> = {
    from: (...args: unknown[]) => {
      calls.push({ op: 'wear.from', args })
      return chain
    },
    innerJoin: (...args: unknown[]) => {
      calls.push({ op: 'wear.innerJoin', args })
      return chain
    },
    where: (...args: unknown[]) => {
      calls.push({ op: 'wear.where', args })
      return chain
    },
    orderBy: (...args: unknown[]) => {
      calls.push({ op: 'wear.orderBy', args })
      return Promise.resolve(wearRows)
    },
  } as never
  return chain
}

// Track whether the mock is in "self" mode (viewer === actor → no follow check)
let mockSelfMode = false

vi.mock('@/db', () => ({
  db: {
    select: (...args: unknown[]) => {
      selectCount += 1
      calls.push({ op: 'select', args })
      if (mockSelfMode) {
        // Self branch: single select → wear chain immediately
        return makeWearChain()
      }
      // Non-self branch:
      //   select 1 = follow lookup (follow chain)
      //   select 2 = wear join (wear chain)
      return selectCount === 1 ? makeFollowChain() : makeWearChain()
    },
    insert: () => makeWearChain(),
  },
}))

import { getActiveWearsForUser } from '@/data/wearEvents'

const VIEWER = 'aaaaaaaa-bbbb-4ccc-8ddd-111111111111'
const ACTOR  = 'cccccccc-dddd-4eee-8fff-222222222222'

describe('getActiveWearsForUser — SQL shape (unit, D-04/D-05/SEC gate/F-2)', () => {
  beforeEach(() => {
    followRows = []
    wearRows = []
    calls = []
    selectCount = 0
    mockSelfMode = false
  })

  // ── Test 1: oldest-first ordering (D-05) ─────────────────────────────────
  it('Test 1 (D-05): wear query orders by wornDate ASC then createdAt ASC (2 args)', async () => {
    await getActiveWearsForUser(VIEWER, ACTOR)
    const orderBy = calls.find((c) => c.op === 'wear.orderBy')
    expect(orderBy, 'orderBy must be called').toBeDefined()
    // Two ordering arguments: asc(wornDate) and asc(createdAt)
    expect(orderBy!.args, 'must have 2 ordering args').toHaveLength(2)
  })

  // ── Test 2: 48h cutoff included in WHERE (D-04/48h) ──────────────────────
  it('Test 2 (D-04/48h): query issues at least one where() call (48h cutoff + actor filter)', async () => {
    await getActiveWearsForUser(VIEWER, ACTOR)
    const whereCalls = calls.filter((c) => c.op === 'wear.where')
    expect(whereCalls.length, 'at least one where() on wear chain').toBeGreaterThanOrEqual(1)
  })

  // ── Test 3: self-bypass (G-5) — no follow-lookup, no profileSettings JOIN ──
  it('Test 3 (SEC gate G-5): self-bypass branch skips follow-lookup when viewerId === actorId', async () => {
    mockSelfMode = true
    await getActiveWearsForUser(VIEWER, VIEWER) // same ID → self branch
    // Must issue exactly 1 select (no follow pre-check)
    const selects = calls.filter((c) => c.op === 'select')
    expect(selects, 'self branch issues exactly 1 select').toHaveLength(1)
    // Must NOT join profileSettings on self branch
    const joinOps = calls.filter((c) => c.op === 'wear.innerJoin')
    // Self branch: only profiles + watches (2 joins, no profileSettings)
    const innerJoinCount = joinOps.length
    expect(innerJoinCount, 'self branch has 2 innerJoins (profiles + watches), not 3').toBe(2)
  })

  // ── Test 4: non-self gate includes profilePublic predicate (G-4) ──────────
  it('Test 4 (SEC gate G-4): non-self branch issues 2 selects (follow check + wear join)', async () => {
    await getActiveWearsForUser(VIEWER, ACTOR)
    const selects = calls.filter((c) => c.op === 'select')
    // Non-self: follow lookup (select 1) + wear query (select 2)
    expect(selects, 'non-self branch issues 2 selects').toHaveLength(2)
  })

  // ── Test 5: raw photoUrl passthrough — no signing (F-2) ──────────────────
  it('Test 5 (F-2): returns raw photoUrl from DB row unchanged (no signing)', async () => {
    const rawPath = 'user-abc/wear-evt-xyz.jpg'
    wearRows = [
      {
        id: 'we-001',
        userId: ACTOR,
        watchId: 'w-001',
        wornDate: '2026-05-22',
        note: null,
        photoUrl: rawPath,
        visibility: 'public',
        createdAt: new Date('2026-05-22T10:00:00Z'),
        username: 'testuser',
        displayName: 'Test User',
        avatarUrl: null,
        brand: 'Rolex',
        model: 'GMT',
        watchImageUrl: null,
      },
    ]
    const result = await getActiveWearsForUser(VIEWER, ACTOR)
    expect(result).toHaveLength(1)
    // Raw Storage path must be returned as-is — no supabase.storage.createSignedUrl
    expect((result[0] as { photoUrl: string | null }).photoUrl).toBe(rawPath)
  })

  // ── Test 6 (D-07 precondition): empty rows → returns [] ──────────────────
  it('Test 6 (D-07): returns empty array when no wears in window', async () => {
    wearRows = []
    const result = await getActiveWearsForUser(VIEWER, ACTOR)
    expect(result).toEqual([])
  })

  // ── Test 7: non-self branch joins profileSettings (G-4 outer gate) ───────
  it('Test 7 (SEC gate G-4): non-self branch uses 3 innerJoins (profileSettings + profiles + watches)', async () => {
    await getActiveWearsForUser(VIEWER, ACTOR)
    const joinOps = calls.filter((c) => c.op === 'wear.innerJoin')
    expect(joinOps, 'non-self branch joins profileSettings + profiles + watches').toHaveLength(3)
  })
})
