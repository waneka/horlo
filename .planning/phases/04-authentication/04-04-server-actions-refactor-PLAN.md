---
phase: "04"
plan: 4
type: execute
wave: 3
depends_on: [2]
files_modified:
  - src/app/actions/watches.ts
  - src/app/actions/preferences.ts
  - tests/actions/watches.test.ts
  - tests/actions/preferences.test.ts
  - tests/data/isolation.test.ts
autonomous: true
requirements:
  - AUTH-02
  - AUTH-03
must_haves:
  truths:
    - "addWatch, editWatch, removeWatch, savePreferences no longer accept a userId parameter"
    - "Every Server Action calls getCurrentUser() before validation and before any DAL call"
    - "Every Server Action returns { success: false, error: 'Not authenticated' } when getCurrentUser throws UnauthorizedError (NOT redirect, NOT throw)"
    - "Every call site inside actions passes user.id (the session id) to the DAL, never a client-supplied id"
    - "The TODO(Phase 4) comments at the top of both action files are removed"
    - "Phase 3 DAL signatures are UNCHANGED — only actions and their tests are refactored"
    - "An integration test against the local DB proves User A cannot edit or delete User B's watches (IDOR-safe, AUTH-03)"
  artifacts:
    - path: "src/app/actions/watches.ts"
      provides: "addWatch(data), editWatch(watchId, data), removeWatch(watchId) — userId derived from session"
      exports: ["addWatch", "editWatch", "removeWatch"]
      contains: "getCurrentUser"
    - path: "src/app/actions/preferences.ts"
      provides: "savePreferences(data) — userId derived from session"
      exports: ["savePreferences"]
      contains: "getCurrentUser"
    - path: "tests/data/isolation.test.ts"
      provides: "IDOR integration test with real two-user seed against local Supabase Postgres"
      contains: "seedTwoUsers"
  key_links:
    - from: "src/app/actions/watches.ts"
      to: "watchDAL.createWatch(user.id, ...)"
      via: "getCurrentUser() -> user.id -> DAL"
      pattern: "watchDAL\\.(create|update|delete)Watch\\(user\\.id"
    - from: "src/app/actions/preferences.ts"
      to: "preferencesDAL.upsertPreferences(user.id, ...)"
      via: "getCurrentUser() -> user.id -> DAL"
      pattern: "upsertPreferences\\(user\\.id"
---

<objective>
Drop the `userId` parameter from every Server Action and read the id from `getCurrentUser()` instead (D-02, D-04, D-07). Add the integration-level IDOR test that proves cross-user access is denied at the DAL level (AUTH-03).

This plan runs in parallel with Plan 03 (proxy + API gate) and Plan 05 (auth pages) — none of them touch overlapping files.
Output: IDOR-safe Server Actions with the contract `addWatch(data)` / `editWatch(watchId, data)` / `removeWatch(watchId)` / `savePreferences(data)`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/04-authentication/04-CONTEXT.md
@.planning/phases/04-authentication/04-RESEARCH.md
@.planning/phases/04-authentication/04-02-SUMMARY.md
@.planning/phases/03-data-layer-foundation/03-CONTEXT.md
@src/app/actions/watches.ts
@src/app/actions/preferences.ts
@src/data/watches.ts
@src/data/preferences.ts
@src/lib/actionTypes.ts
@CLAUDE.md

<interfaces>
<!-- From Plan 02 (already shipped): -->
// src/lib/auth.ts
export class UnauthorizedError extends Error { name = 'UnauthorizedError' }
export async function getCurrentUser(): Promise<{ id: string; email: string }>

<!-- Phase 3 DAL — UNCHANGED in this plan (D-03): -->
// src/data/watches.ts
export async function createWatch(userId: string, data: Omit<Watch, 'id'>): Promise<Watch>
export async function updateWatch(userId: string, watchId: string, data: Partial<Watch>): Promise<Watch>
export async function deleteWatch(userId: string, watchId: string): Promise<void>
// Throws: new Error('Watch not found or access denied: ...')  on missing/other-user rows

// src/data/preferences.ts
export async function upsertPreferences(userId: string, data: Partial<UserPreferences>): Promise<UserPreferences>

<!-- VERBATIM Server Action pattern from CONTEXT D-04 — copy for every action. -->
```ts
export async function addWatch(data: unknown): Promise<ActionResult<Watch>> {
  let user
  try { user = await getCurrentUser() }
  catch { return { success: false, error: 'Not authenticated' } }

  const parsed = insertWatchSchema.safeParse(data)
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors
    const summary = Object.entries(fieldErrors)
      .map(([field, errors]) => `${field}: ${(errors ?? []).join(', ')}`)
      .join('; ')
    return { success: false, error: `Invalid watch data: ${summary}` }
  }

  try {
    const watch = await watchDAL.createWatch(user.id, parsed.data)
    revalidatePath('/')
    return { success: true, data: watch }
  } catch (err) {
    console.error('[addWatch] unexpected error:', err)
    if (err instanceof Error && err.message.includes('not found or access denied')) {
      return { success: false, error: 'Not found' }
    }
    return { success: false, error: 'Failed to create watch' }
  }
}
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Refactor src/app/actions/watches.ts — drop userId, add getCurrentUser prologue</name>
  <files>src/app/actions/watches.ts, tests/actions/watches.test.ts</files>
  <read_first>
    - src/app/actions/watches.ts (current file — 113 lines, three exported actions)
    - src/data/watches.ts (DAL — signatures unchanged, still takes userId internally)
    - src/lib/auth.ts (getCurrentUser + UnauthorizedError from Plan 02)
    - .planning/phases/04-authentication/04-CONTEXT.md (D-02, D-04, D-05, D-07, D-15)
    - .planning/phases/03-data-layer-foundation/03-CONTEXT.md (D-08 on "not found or access denied" error string contract, D-12 on never-throw)
    - tests/actions/watches.test.ts (failing stub from Plan 01)
    - tests/helpers/mock-supabase.ts (shared mock helper)
  </read_first>
  <behavior>
    - Test 1: addWatch returns { success:false, error:'Not authenticated' } when getCurrentUser throws UnauthorizedError
    - Test 2: editWatch returns { success:false, error:'Not authenticated' } when getCurrentUser throws
    - Test 3: removeWatch returns { success:false, error:'Not authenticated' } when getCurrentUser throws
    - Test 4: addWatch calls watchDAL.createWatch with the session user.id (not a client-supplied id)
    - Test 5: editWatch(watchId, data) — the new two-arg signature — calls updateWatch(user.id, watchId, data)
    - Test 6: removeWatch(watchId) — new one-arg signature — calls deleteWatch(user.id, watchId)
    - Test 7: editWatch maps DAL "not found or access denied" error to { success:false, error:'Not found' }
  </behavior>
  <action>
Rewrite `src/app/actions/watches.ts`. Delete the `// TODO(Phase 4)` comment on line 3. Update imports to add `import { getCurrentUser, UnauthorizedError } from '@/lib/auth'`. Keep all existing imports.

New signatures (D-02):
- `addWatch(data: unknown): Promise<ActionResult<Watch>>`  — was `addWatch(userId, data)`
- `editWatch(watchId: string, data: unknown): Promise<ActionResult<Watch>>`  — was `editWatch(userId, watchId, data)`
- `removeWatch(watchId: string): Promise<ActionResult<void>>`  — was `removeWatch(userId, watchId)`

Keep the existing Zod schemas (`insertWatchSchema`, `updateWatchSchema`) UNCHANGED.

Each action follows the VERBATIM pattern from the `<interfaces>` block:

1. `let user; try { user = await getCurrentUser() } catch { return { success: false, error: 'Not authenticated' } }`
   - Catch ALL errors in this prologue, not just `UnauthorizedError` — per D-15 the action should never throw across the boundary. Non-Unauthorized errors are unexpected but still must map to an ActionResult.
2. Zod parse (existing block, unchanged except no userId in scope).
3. `try { const watch = await watchDAL.XXX(user.id, ...) } catch (err) { ... }`
4. In the catch block, detect the DAL's `'not found or access denied'` error message (Phase 3 D-08) and map to `{ success: false, error: 'Not found' }` per D-05. Generic errors still map to `'Failed to update watch'` etc.

Do NOT refactor the DAL. Do NOT add a logout handler here. Do NOT change the Zod schemas.

Replace the todos in `tests/actions/watches.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  UnauthorizedError: class extends Error {
    constructor(m = 'Not authenticated') {
      super(m)
      this.name = 'UnauthorizedError'
    }
  },
  getCurrentUser: vi.fn(),
}))
vi.mock('@/data/watches', () => ({
  createWatch: vi.fn(),
  updateWatch: vi.fn(),
  deleteWatch: vi.fn(),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { addWatch, editWatch, removeWatch } from '@/app/actions/watches'
import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import * as watchDAL from '@/data/watches'

const validWatch = {
  brand: 'Omega', model: 'Seamaster', status: 'owned' as const, movement: 'automatic' as const,
}

describe('watches Server Actions auth gate — AUTH-02', () => {
  beforeEach(() => vi.clearAllMocks())

  it('addWatch returns Not authenticated when getCurrentUser throws', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new UnauthorizedError())
    await expect(addWatch(validWatch)).resolves.toEqual({
      success: false,
      error: 'Not authenticated',
    })
    expect(watchDAL.createWatch).not.toHaveBeenCalled()
  })

  it('editWatch returns Not authenticated when getCurrentUser throws', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new UnauthorizedError())
    await expect(editWatch('w-1', validWatch)).resolves.toEqual({
      success: false,
      error: 'Not authenticated',
    })
  })

  it('removeWatch returns Not authenticated when getCurrentUser throws', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new UnauthorizedError())
    await expect(removeWatch('w-1')).resolves.toEqual({
      success: false,
      error: 'Not authenticated',
    })
  })

  it('addWatch calls DAL.createWatch with session user.id', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u-1', email: 'a@b.co' })
    vi.mocked(watchDAL.createWatch).mockResolvedValue({ id: 'w-1', ...validWatch } as any)
    await addWatch(validWatch)
    expect(watchDAL.createWatch).toHaveBeenCalledWith('u-1', expect.objectContaining(validWatch))
  })

  it('editWatch(watchId, data) uses new two-arg signature', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u-1', email: 'a@b.co' })
    vi.mocked(watchDAL.updateWatch).mockResolvedValue({ id: 'w-1', ...validWatch } as any)
    await editWatch('w-1', { brand: 'Rolex' })
    expect(watchDAL.updateWatch).toHaveBeenCalledWith('u-1', 'w-1', { brand: 'Rolex' })
  })

  it('removeWatch(watchId) uses new one-arg signature', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u-1', email: 'a@b.co' })
    vi.mocked(watchDAL.deleteWatch).mockResolvedValue(undefined)
    await removeWatch('w-1')
    expect(watchDAL.deleteWatch).toHaveBeenCalledWith('u-1', 'w-1')
  })

  it('editWatch maps DAL "not found or access denied" to Not found', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u-1', email: 'a@b.co' })
    vi.mocked(watchDAL.updateWatch).mockRejectedValue(
      new Error('Watch not found or access denied: w-1'),
    )
    await expect(editWatch('w-1', { brand: 'Rolex' })).resolves.toEqual({
      success: false,
      error: 'Not found',
    })
  })
})
```
  </action>
  <verify>
    <automated>npx vitest run tests/actions/watches.test.ts --reporter=dot &amp;&amp; ! grep -q "TODO(Phase 4)" src/app/actions/watches.ts</automated>
  </verify>
  <acceptance_criteria>
    - `src/app/actions/watches.ts` does NOT contain string `TODO(Phase 4)`
    - `src/app/actions/watches.ts` contains `import { getCurrentUser, UnauthorizedError } from '@/lib/auth'`
    - `src/app/actions/watches.ts` contains `export async function addWatch(data: unknown)` — exactly one parameter named `data`
    - `src/app/actions/watches.ts` contains `export async function editWatch(watchId: string, data: unknown)` — exactly two params
    - `src/app/actions/watches.ts` contains `export async function removeWatch(watchId: string)` — exactly one param
    - `src/app/actions/watches.ts` contains literal string `await getCurrentUser()` at least 3 times (once per action)
    - `src/app/actions/watches.ts` contains literal string `'Not authenticated'` at least 3 times
    - `src/app/actions/watches.ts` contains literal string `watchDAL.createWatch(user.id` (or equivalent — session id goes to DAL)
    - `src/app/actions/watches.ts` contains literal string `'Not found'` (D-05 mapping)
    - `npx vitest run tests/actions/watches.test.ts` exits 0 with at least 7 passing tests, zero todos
    - `npx tsc --noEmit` reports zero errors for src/app/actions/watches.ts
  </acceptance_criteria>
  <done>watches.ts Server Actions match D-02 signatures, session-gate per D-04, map DAL not-found per D-05, and the unit test suite is green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Refactor src/app/actions/preferences.ts — drop userId, add getCurrentUser prologue</name>
  <files>src/app/actions/preferences.ts, tests/actions/preferences.test.ts</files>
  <read_first>
    - src/app/actions/preferences.ts (current file — 61 lines, one savePreferences action)
    - src/data/preferences.ts (DAL — upsertPreferences signature unchanged)
    - .planning/phases/04-authentication/04-CONTEXT.md (D-02, D-04, D-07)
    - tests/actions/preferences.test.ts (failing stub from Plan 01)
  </read_first>
  <behavior>
    - Test 1: savePreferences returns { success:false, error:'Not authenticated' } when getCurrentUser throws
    - Test 2: savePreferences calls DAL.upsertPreferences with session user.id
    - Test 3: savePreferences(data) — new one-arg signature — no userId parameter
  </behavior>
  <action>
Rewrite `src/app/actions/preferences.ts` following the same D-02/D-04 pattern as Task 1.

New signature: `savePreferences(data: unknown): Promise<ActionResult<UserPreferences>>` — was `savePreferences(userId, data)`.

Steps:
1. Delete the `// TODO(Phase 4)` comment.
2. Add `import { getCurrentUser, UnauthorizedError } from '@/lib/auth'`.
3. Replace the `savePreferences(userId, data)` signature with `savePreferences(data)`.
4. Insert the `let user; try { user = await getCurrentUser() } catch { return {success:false, error:'Not authenticated'} }` prologue before the Zod parse.
5. Replace `preferencesDAL.upsertPreferences(userId, parsed.data)` with `preferencesDAL.upsertPreferences(user.id, parsed.data)`.

Keep the Zod `preferencesSchema` unchanged. Keep the `revalidatePath('/preferences')` call unchanged. Keep the catch block's `'Failed to save preferences'` copy.

Replace the todos in `tests/actions/preferences.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  UnauthorizedError: class extends Error {
    constructor(m = 'Not authenticated') { super(m); this.name = 'UnauthorizedError' }
  },
  getCurrentUser: vi.fn(),
}))
vi.mock('@/data/preferences', () => ({
  upsertPreferences: vi.fn(),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { savePreferences } from '@/app/actions/preferences'
import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import * as preferencesDAL from '@/data/preferences'

describe('preferences Server Actions auth gate — AUTH-02', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns Not authenticated when getCurrentUser throws', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new UnauthorizedError())
    await expect(savePreferences({ collectionGoal: 'balanced' })).resolves.toEqual({
      success: false,
      error: 'Not authenticated',
    })
    expect(preferencesDAL.upsertPreferences).not.toHaveBeenCalled()
  })

  it('calls DAL.upsertPreferences with session user.id', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u-1', email: 'a@b.co' })
    vi.mocked(preferencesDAL.upsertPreferences).mockResolvedValue({ collectionGoal: 'balanced' } as any)
    await savePreferences({ collectionGoal: 'balanced' })
    expect(preferencesDAL.upsertPreferences).toHaveBeenCalledWith('u-1', { collectionGoal: 'balanced' })
  })

  it('savePreferences accepts one argument (new signature)', () => {
    // Compile-time check via type assertion — if this line compiles, signature is correct.
    expect(savePreferences.length).toBe(1)
  })
})
```
  </action>
  <verify>
    <automated>npx vitest run tests/actions/preferences.test.ts --reporter=dot &amp;&amp; ! grep -q "TODO(Phase 4)" src/app/actions/preferences.ts</automated>
  </verify>
  <acceptance_criteria>
    - `src/app/actions/preferences.ts` does NOT contain string `TODO(Phase 4)`
    - `src/app/actions/preferences.ts` contains `import { getCurrentUser, UnauthorizedError } from '@/lib/auth'`
    - `src/app/actions/preferences.ts` contains `export async function savePreferences(data: unknown)` — exactly one parameter
    - `src/app/actions/preferences.ts` contains `await getCurrentUser()`
    - `src/app/actions/preferences.ts` contains `upsertPreferences(user.id`
    - `src/app/actions/preferences.ts` contains `'Not authenticated'`
    - `npx vitest run tests/actions/preferences.test.ts` exits 0 with at least 3 passing tests, zero todos
    - `npx tsc --noEmit` reports zero errors for src/app/actions/preferences.ts
  </acceptance_criteria>
  <done>preferences.ts matches the same session-gated pattern; tests green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Wire real IDOR integration test against local Supabase (AUTH-03)</name>
  <files>tests/data/isolation.test.ts</files>
  <read_first>
    - tests/data/isolation.test.ts (failing stub from Plan 01)
    - tests/fixtures/users.ts (seedTwoUsers helper from Plan 01)
    - src/data/watches.ts (DAL — to understand the "not found or access denied" behavior)
    - src/db/client.ts or src/db/index.ts (existing Drizzle DB handle — find via grep; test needs to write raw rows to DB to set up the two-user fixture)
    - .planning/phases/04-authentication/04-CONTEXT.md (D-02 for the new Server Action signatures — test must use the new shapes)
    - .planning/phases/04-authentication/04-RESEARCH.md (Q7 — shadow user trigger means auth.users insert auto-populates public.users)
  </read_first>
  <behavior>
    - Test 1: editWatch(otherUsersWatchId, data) with session=UserA returns { success:false, error:'Not found' } — DAL throws "not found or access denied", action maps to 'Not found'
    - Test 2: removeWatch(otherUsersWatchId) with session=UserA returns { success:false, error:'Not found' }
    - Test 3: Control case — addWatch(data) with session=UserA creates a watch that only UserA can subsequently edit
  </behavior>
  <action>
This is the first integration test that requires a real running Postgres. It depends on:
- Plan 01 Task 2 (Supabase stack running with trigger applied)
- Plan 01 Task 3 (seedTwoUsers fixture exists)
- Task 1 of this plan (actions refactored)

Replace all todos in `tests/data/isolation.test.ts` with real integration tests. Use `seedTwoUsers()` to create two real auth users (trigger auto-populates `public.users`), then directly call `watchDAL.createWatch` to seed a watch owned by UserB, then mock `getCurrentUser()` to return UserA's id and call `editWatch` via the Server Action:

```ts
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { seedTwoUsers } from '../fixtures/users'
import * as watchDAL from '@/data/watches'

// Mock ONLY getCurrentUser — the DAL runs against the real local Postgres.
vi.mock('@/lib/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth')
  return {
    ...actual,
    getCurrentUser: vi.fn(),
  }
})

// Import AFTER the mock is set up so actions see the mocked getCurrentUser.
import { editWatch, removeWatch, addWatch } from '@/app/actions/watches'
import { getCurrentUser } from '@/lib/auth'

const skipIfNoLocalDb = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY
const maybe = skipIfNoLocalDb ? describe.skip : describe

maybe('IDOR isolation — AUTH-03', () => {
  let userA: { id: string; email: string }
  let userB: { id: string; email: string }
  let cleanup: () => Promise<void>
  let userBWatchId: string

  beforeAll(async () => {
    const seed = await seedTwoUsers()
    userA = seed.userA
    userB = seed.userB
    cleanup = seed.cleanup
    // Seed a watch directly into UserB's collection via the DAL (bypassing the action).
    const w = await watchDAL.createWatch(userB.id, {
      brand: 'Omega', model: 'Speedmaster',
      status: 'owned', movement: 'manual',
      complications: [], styleTags: [], designTraits: [], roleTags: [],
    } as any)
    userBWatchId = w.id
  }, 30_000)

  afterAll(async () => {
    // Delete UserB's seeded watch first to avoid FK violation on user delete
    try { await watchDAL.deleteWatch(userB.id, userBWatchId) } catch {}
    await cleanup()
  }, 30_000)

  it('editWatch(otherUsersWatchId) returns Not found for User A', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(userA)
    const result = await editWatch(userBWatchId, { brand: 'Hacked' })
    expect(result).toEqual({ success: false, error: 'Not found' })

    // Confirm UserB's watch is unchanged in the DB.
    const untouched = await watchDAL.findWatchesByUserId(userB.id).catch(() => [] as any[])
    const stillOmega = Array.isArray(untouched) && untouched.some((w) => w.id === userBWatchId && w.brand === 'Omega')
    expect(stillOmega).toBe(true)
  })

  it('removeWatch(otherUsersWatchId) returns Not found for User A', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(userA)
    const result = await removeWatch(userBWatchId)
    expect(result).toEqual({ success: false, error: 'Not found' })
  })

  it('addWatch with User A session creates a watch owned by User A only', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(userA)
    const result = await addWatch({
      brand: 'Seiko', model: 'SKX007', status: 'owned', movement: 'automatic',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      // Cleanup
      await watchDAL.deleteWatch(userA.id, result.data.id)
    }
  })
})
```

If `findWatchesByUserId` does not exist in the DAL (verify by reading src/data/watches.ts first), substitute with the actual read function name (e.g., `getWatches`, `listWatches`). The test asserts the row survived the failed edit attempt regardless.

NOTE: The test is guarded by `describe.skip` when the local Supabase env vars are not set, so `npm test` still runs green on CI without the local stack. Executors must set `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (from `supabase status`) in their shell before running this file.
  </action>
  <verify>
    <automated>NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-http://127.0.0.1:54321}" npx vitest run tests/data/isolation.test.ts --reporter=dot 2>&amp;1 | tee /tmp/idor-test.log; grep -E "Tests|skipped|passed" /tmp/idor-test.log</automated>
  </verify>
  <acceptance_criteria>
    - `tests/data/isolation.test.ts` imports `seedTwoUsers` from `../fixtures/users`
    - `tests/data/isolation.test.ts` contains `editWatch(userBWatchId`
    - `tests/data/isolation.test.ts` contains `removeWatch(userBWatchId`
    - `tests/data/isolation.test.ts` contains `expect(result).toEqual({ success: false, error: 'Not found' })`
    - `tests/data/isolation.test.ts` uses `describe.skip` or equivalent when env vars are absent (so CI without Supabase still passes)
    - When run with local Supabase + env vars set: all 3 tests pass
    - When run without env vars: all 3 tests skip (reported as "skipped", not "failed")
    - `npm test` (full suite) exits 0 regardless of env var state
  </acceptance_criteria>
  <done>IDOR behavior proven end-to-end against real Postgres with two real users; CI-safe via skip guard.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client form → Server Action | Client submits watchId + data; action reads user.id from session, NEVER from client. |
| Server Action → DAL | Action passes (session_user_id, watchId, data) to DAL; DAL's WHERE clause scopes by user_id. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-4-03 | Elevation of privilege | src/app/actions/watches.ts editWatch/removeWatch | mitigate | D-02 drops the `userId` parameter from the action signature entirely — there is no way for a client to lie about their identity. The session `user.id` is injected inside the action. Task 3 proves this end-to-end with real two-user DB fixture. |
| T-4-05 | Information disclosure | "Not found" vs "Access denied" wording | mitigate | Action maps DAL's "not found or access denied" error to neutral `'Not found'` string (D-05) — does not leak whether the row exists for another user. Prevents user enumeration. |
| T-4-02 | Spoofing | Server Action prologue | mitigate | `getCurrentUser()` uses server-verified `supabase.auth.getUser()` from Plan 02 — a tampered cookie fails the prologue and returns `'Not authenticated'` without touching the DAL. |
| T-4-04 | Repudiation | Server Action error paths | accept | All error paths still return an ActionResult (D-15) — no `redirect()` or `throw` across the boundary except the logout action in Plan 02. Client sees the error and can navigate to `/login?next=<current>` itself. |
</threat_model>

<verification>
- `npx vitest run tests/actions/watches.test.ts tests/actions/preferences.test.ts tests/data/isolation.test.ts` exits 0
- `grep -c "TODO(Phase 4)" src/app/actions/watches.ts src/app/actions/preferences.ts` returns 0
- `grep -c "getCurrentUser" src/app/actions/watches.ts` returns >= 3 (one per action)
- `grep -c "getCurrentUser" src/app/actions/preferences.ts` returns >= 1
- `npx tsc --noEmit` reports zero errors in src/app/actions/**
- Full suite `npm test` exits 0 (Phase 1–3 tests don't regress)
</verification>

<success_criteria>
1. Server Actions have new signatures matching D-02 exactly — consumers (forms in Plan 05, Phase 5 migration flow) can call `addWatch(data)` without passing a userId.
2. Every action has a session-read prologue that returns `{ success: false, error: 'Not authenticated' }` on failure.
3. An IDOR attempt against a real local Postgres with two seeded users is proven denied at the DAL level.
4. TODO(Phase 4) comments removed — `grep TODO src/app/actions/` is clean.
</success_criteria>

<output>
After completion, create `.planning/phases/04-authentication/04-04-SUMMARY.md`.
</output>
