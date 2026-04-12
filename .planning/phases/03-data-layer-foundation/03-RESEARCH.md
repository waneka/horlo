# Phase 03: Data Layer Foundation - Research

**Researched:** 2026-04-11
**Domain:** Drizzle ORM + Supabase Postgres + Next.js 16 Server Actions + Data Access Layer
**Confidence:** HIGH

## Summary

Phase 3 builds the server-side data foundation: a Drizzle ORM schema mapped to the existing `Watch` and `UserPreferences` types, a `server-only` DAL in `src/data/`, and Server Actions in `src/app/actions/`. All of this runs against a real Supabase Postgres instance. The UI remains unchanged -- Zustand continues to drive all rendering.

The core technical challenge is straightforward: Drizzle ORM has excellent Postgres support including text arrays, and Next.js 16's Server Actions follow the standard `'use server'` directive pattern confirmed in the bundled docs. The `server-only` package provides build-time enforcement that DAL files cannot be imported from client code. Zod validation for Server Actions is now built into `drizzle-orm/zod` (the separate `drizzle-zod` package is deprecated).

**Primary recommendation:** Use `drizzle-orm` with the `postgres` (postgres.js) driver, `drizzle-kit push` for local development, `drizzle-kit generate`/`migrate` for production. Connect to a hosted Supabase Postgres instance for development since Docker is not available on this machine (blocking Supabase CLI local dev). Use `drizzle-orm/zod` for Server Action input validation.

**CRITICAL environment finding:** Neither Docker nor the Supabase CLI are installed on this machine. Supabase local development requires Docker. The development workflow must use a hosted Supabase project (free tier) with `drizzle-kit push` against the remote database. This is a viable and common pattern but means no offline development.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Array fields stored as Postgres text arrays via `text('...').array()`
- **D-02:** UserPreferences stored as normalized columns, not JSON blob
- **D-03:** Tables: `users` (shadow for FK integrity), `watches` (all Watch fields + userId FK), `user_preferences` (all fields + userId FK, one row per user)
- **D-04:** Schema at `src/db/schema.ts`, Drizzle config at `drizzle.config.ts`
- **D-05:** Phase 2 fields (productionYear, isFlaggedDeal, isChronometer) in watches table from day one
- **D-06:** DAL in `src/data/` with `server-only` import. Two files: `src/data/watches.ts` and `src/data/preferences.ts`
- **D-07:** Every DAL function accepts explicit `userId` parameter -- no session reading
- **D-08:** DAL functions throw errors for unexpected failures; Server Actions catch and shape
- **D-09:** DAL returns domain types (`Watch`, `UserPreferences`) -- mapping happens inside DAL
- **D-10:** All queries scoped by `userId` in WHERE clause
- **D-11:** Server Actions in `src/app/actions/watches.ts` and `src/app/actions/preferences.ts`
- **D-12:** Actions return `{ success: boolean, data?: T, error?: string }` -- no throwing across boundary
- **D-13:** Revalidation: `revalidatePath('/')` for watches, `revalidatePath('/preferences')` for preferences
- **D-14:** Input validation with Zod schemas in each Server Action
- **D-15:** Local dev uses Supabase CLI + local Postgres (NOTE: blocked -- see Environment Availability)
- **D-16:** Schema sync via `drizzle-kit push` for dev, `drizzle-kit generate` + `migrate` for production
- **D-17:** Connection string from `DATABASE_URL` env var
- **D-18:** Existing pages continue rendering from Zustand -- no changes
- **D-19:** Phase 5 does Zustand demotion, not Phase 3

### Claude's Discretion
- Exact Drizzle column types for numeric fields (integer vs real for caseSizeMm, etc.)
- Index strategy (minimum: watches.userId and user_preferences.userId)
- Single `src/data/db.ts` connection file vs inline
- Zod schema structure for Server Action validation
- Database seeding script (deferred idea, planner's discretion)

### Deferred Ideas (OUT OF SCOPE)
- UI rewire to Server Components (Phase 5)
- Zustand demotion (Phase 5)
- Auth enforcement in DAL (Phase 4)
- Production Supabase setup (deployment concern)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | Drizzle ORM schema defines `users`, `watches`, `user_preferences` tables scoped to Postgres | Drizzle pg-core column types verified; text arrays, uuid, timestamp, real, integer, boolean, jsonb all supported. Schema pattern documented below. |
| DATA-02 | Data Access Layer in `src/data/` marked `server-only`; every query scoped to authenticated `userId` | `server-only` package verified (v0.0.1). Next.js 16 docs confirm DAL pattern with `import 'server-only'` as build-time enforcement. |
| DATA-03 | Watch CRUD and preference mutations move to Server Actions in `src/app/actions/` | Next.js 16 `'use server'` directive confirmed in bundled docs. `revalidatePath` API verified. `drizzle-orm/zod` provides `createInsertSchema`/`createUpdateSchema` for validation. |
| DATA-04 | Existing pages fetch from Zustand unchanged; Server Actions and DAL callable end-to-end | No UI files touched. DAL functions are plain async functions testable without Next.js server. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.45.2 | TypeScript ORM for Postgres | Type-safe SQL, first-class Postgres arrays, built-in Zod integration [VERIFIED: npm registry] |
| drizzle-kit | 0.31.10 | Schema management CLI | Push/migrate workflow, schema introspection [VERIFIED: npm registry] |
| postgres | 3.4.9 | PostgreSQL client (postgres.js) | Recommended driver for Drizzle + Supabase, no native deps [VERIFIED: npm registry] |
| zod | 4.3.6 | Schema validation | Server Action input validation via drizzle-orm/zod integration [VERIFIED: npm registry] |
| server-only | 0.0.1 | Build-time server enforcement | Prevents DAL imports from client bundles [VERIFIED: npm registry] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| dotenv | latest | Env var loading for drizzle-kit CLI | Only needed by drizzle.config.ts; Next.js handles .env.local natively |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| postgres (postgres.js) | @vercel/postgres, pg | postgres.js is zero-dep, ESM-native, and Drizzle's recommended Supabase driver |
| drizzle-orm/zod | Hand-written Zod schemas | drizzle-orm/zod auto-generates from schema; hand-written gives more control but duplicates definitions |
| drizzle-kit push | drizzle-kit generate+migrate | Push is simpler for dev; generate+migrate for production audit trail |

**Installation:**
```bash
npm install drizzle-orm postgres server-only zod
npm install -D drizzle-kit dotenv
```

**Note on Zod 4:** The npm registry shows zod@4.3.6 as latest. Zod 4 is a major rewrite. Verify compatibility with `drizzle-orm/zod` at implementation time. If incompatible, pin `zod@3.x` instead. [ASSUMED -- drizzle-orm/zod may not yet support Zod 4]

## Architecture Patterns

### Recommended Project Structure
```
src/
  db/
    schema.ts          # Drizzle table definitions
    index.ts           # Database connection singleton
  data/
    watches.ts         # Watch DAL (import 'server-only')
    preferences.ts     # Preferences DAL (import 'server-only')
  app/
    actions/
      watches.ts       # Watch Server Actions ('use server')
      preferences.ts   # Preference Server Actions ('use server')
drizzle.config.ts      # Drizzle Kit configuration (project root)
```

### Pattern 1: Database Connection Singleton
**What:** Single `src/db/index.ts` exporting the Drizzle instance
**When to use:** Always -- avoids multiple connection pools

```typescript
// Source: https://orm.drizzle.team/docs/get-started/supabase-new
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const client = postgres(process.env.DATABASE_URL!, { prepare: false })
export const db = drizzle(client, { schema })
```

**Note:** `{ prepare: false }` is required when using Supabase connection pooling (Transaction mode). Without it, prepared statements fail silently. [VERIFIED: Drizzle + Supabase docs]

### Pattern 2: DAL with server-only Enforcement
**What:** Every DAL file starts with `import 'server-only'` and accepts explicit `userId`
**When to use:** All data access functions

```typescript
// Source: Next.js 16 bundled docs (data-security.md)
import 'server-only'
import { db } from '@/db'
import { watches } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import type { Watch } from '@/lib/types'

export async function getWatchesByUser(userId: string): Promise<Watch[]> {
  const rows = await db.select().from(watches).where(eq(watches.userId, userId))
  return rows.map(mapRowToWatch)
}
```

### Pattern 3: Server Actions with Zod Validation + Result Shape
**What:** Actions validate input, delegate to DAL, catch errors, return `{ success, data?, error? }`
**When to use:** Every mutation exposed to the client

```typescript
// Source: Next.js 16 bundled docs (forms.md, use-server.md, data-security.md)
'use server'

import { revalidatePath } from 'next/cache'
import { createInsertSchema } from 'drizzle-orm/zod'
import { watches } from '@/db/schema'
import * as watchDAL from '@/data/watches'

const insertWatchSchema = createInsertSchema(watches).omit({ id: true, userId: true })

export async function addWatch(userId: string, data: unknown) {
  const parsed = insertWatchSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors }
  }
  try {
    const watch = await watchDAL.createWatch(userId, parsed.data)
    revalidatePath('/')
    return { success: true, data: watch }
  } catch (err) {
    return { success: false, error: 'Failed to create watch' }
  }
}
```

### Pattern 4: Drizzle Schema with Text Arrays and Domain Type Mapping
**What:** Schema mirrors the TypeScript types with proper Postgres column types

```typescript
// Source: https://orm.drizzle.team/docs/column-types/pg + empty-array-default guide
import { pgTable, uuid, text, integer, real, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const watches = pgTable('watches', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),

  brand: text('brand').notNull(),
  model: text('model').notNull(),
  reference: text('reference'),

  status: text('status', { enum: ['owned', 'wishlist', 'sold', 'grail'] }).notNull(),

  pricePaid: real('price_paid'),
  targetPrice: real('target_price'),
  marketPrice: real('market_price'),

  movement: text('movement', {
    enum: ['automatic', 'manual', 'quartz', 'spring-drive', 'other'],
  }).notNull(),
  complications: text('complications').array().notNull().default(sql`'{}'::text[]`),

  caseSizeMm: real('case_size_mm'),
  lugToLugMm: real('lug_to_lug_mm'),
  waterResistanceM: integer('water_resistance_m'),

  strapType: text('strap_type', {
    enum: ['bracelet', 'leather', 'rubber', 'nato', 'other'],
  }),
  crystalType: text('crystal_type', {
    enum: ['sapphire', 'mineral', 'acrylic', 'hesalite', 'hardlex'],
  }),

  dialColor: text('dial_color'),

  styleTags: text('style_tags').array().notNull().default(sql`'{}'::text[]`),
  designTraits: text('design_traits').array().notNull().default(sql`'{}'::text[]`),
  roleTags: text('role_tags').array().notNull().default(sql`'{}'::text[]`),

  acquisitionDate: text('acquisition_date'),
  lastWornDate: text('last_worn_date'),

  productionYear: integer('production_year'),
  isFlaggedDeal: boolean('is_flagged_deal').default(false),
  isChronometer: boolean('is_chronometer').default(false),

  notes: text('notes'),
  imageUrl: text('image_url'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
```

### Anti-Patterns to Avoid
- **Importing DAL files in 'use client' components:** Build will fail thanks to `server-only`, but the error message is confusing -- document why it exists in comments
- **Throwing errors from Server Actions:** The Next.js 16 docs warn this sends raw error objects to the client. Always catch and return shaped results.
- **Trusting client-supplied userId:** Phase 3 accepts userId as a parameter for testability, but Phase 4 must replace this with session-derived userId. Do NOT expose userId as a form field.
- **Using `drizzle-zod` package:** Deprecated since drizzle-orm 0.30.0. Use `drizzle-orm/zod` instead. [VERIFIED: official Drizzle docs]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema validation | Manual Zod schemas duplicating Drizzle columns | `createInsertSchema` / `createUpdateSchema` from `drizzle-orm/zod` | Auto-generates from schema; stays in sync as columns change |
| UUID generation | `crypto.randomUUID()` in application code | `uuid().defaultRandom()` in Drizzle schema | Database generates UUIDs; no application-layer concern |
| Connection pooling | Manual pool management | `postgres()` client with Supabase's built-in pooler | postgres.js handles connection lifecycle |
| Server-only enforcement | Runtime checks for `typeof window` | `import 'server-only'` package | Build-time error is vastly more reliable than runtime check |
| Empty array defaults | Application-level `?? []` fallback | `default(sql\`'{}'\:\:text[]\`)` in schema | Database enforces the default; no null-handling in every query |

**Key insight:** The Drizzle + Postgres stack handles arrays, UUIDs, timestamps, and enum validation at the database level. Application code should delegate these concerns to the schema definition rather than reimplementing them.

## Common Pitfalls

### Pitfall 1: Supabase Connection Pooling + Prepared Statements
**What goes wrong:** Queries silently fail or return unexpected errors when using Supabase's connection pooler in Transaction mode
**Why it happens:** Transaction-mode pooling does not support prepared statements; postgres.js uses them by default
**How to avoid:** Always pass `{ prepare: false }` to the postgres client constructor
**Warning signs:** Intermittent query failures, "prepared statement already exists" errors

### Pitfall 2: Drizzle Text Array Defaults
**What goes wrong:** Array columns default to `null` instead of empty arrays, causing null checks everywhere
**Why it happens:** Drizzle defaults to nullable columns; must explicitly chain `.notNull().default(sql\`'{}'\:\:text[]\`)`
**How to avoid:** Set `.notNull().default(sql\`'{}'\:\:text[]\`)` on every array column in the schema
**Warning signs:** `TypeError: Cannot read properties of null (reading 'includes')` in client code

### Pitfall 3: revalidatePath Does Not Work in Proxy
**What goes wrong:** Calling `revalidatePath` in `proxy.ts` (Next.js 16's renamed middleware) throws
**Why it happens:** revalidatePath is only available in Server Functions and Route Handlers, not in proxy
**How to avoid:** Only call `revalidatePath` inside Server Actions or Route Handlers [VERIFIED: Next.js 16 bundled docs]
**Warning signs:** Build error or runtime exception in proxy

### Pitfall 4: Drizzle Schema ≠ Domain Types
**What goes wrong:** DAL returns raw Drizzle row types with snake_case column names and extra DB fields (createdAt, updatedAt, userId)
**Why it happens:** Drizzle `$inferSelect` includes all columns; domain `Watch` type uses camelCase and omits DB-specific fields
**How to avoid:** Write explicit mapping functions in the DAL that convert DB rows to domain types. Never leak Drizzle types past the DAL boundary.
**Warning signs:** TypeScript type errors when passing DAL results to existing components

### Pitfall 5: Zod 4 Compatibility
**What goes wrong:** `drizzle-orm/zod` may not support Zod 4 yet
**Why it happens:** Zod 4 is a major rewrite with API changes; drizzle-orm may still target Zod 3
**How to avoid:** Check `drizzle-orm` peer dependencies at install time. If Zod 4 is not supported, install `zod@3` explicitly.
**Warning signs:** Type errors from `createInsertSchema`, runtime failures in `.safeParse()`

### Pitfall 6: Domain Type Mismatch for preferredCaseSizeRange
**What goes wrong:** `UserPreferences.preferredCaseSizeRange` is `{ min: number, max: number } | undefined` -- a nested object, not a flat column
**Why it happens:** Decision D-02 says normalized columns, but this field is inherently structured
**How to avoid:** Use `jsonb` column for this single field. It is the correct Postgres type for a small structured object. This does not violate D-02 -- the rest of the preferences are flat columns; this one field is genuinely a compound value.
**Warning signs:** Awkward `preferred_case_size_min` + `preferred_case_size_max` split that then needs reassembly

## Code Examples

### drizzle.config.ts
```typescript
// Source: https://orm.drizzle.team/docs/get-started/supabase-new
import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

### DAL Row-to-Domain Mapping
```typescript
import type { Watch } from '@/lib/types'

// DB row type from Drizzle (snake_case, includes userId/timestamps)
// Domain Watch type (camelCase, no userId/timestamps)
function mapRowToWatch(row: typeof watches.$inferSelect): Watch {
  return {
    id: row.id,
    brand: row.brand,
    model: row.model,
    reference: row.reference ?? undefined,
    status: row.status,
    pricePaid: row.pricePaid ?? undefined,
    targetPrice: row.targetPrice ?? undefined,
    marketPrice: row.marketPrice ?? undefined,
    movement: row.movement,
    complications: row.complications,
    caseSizeMm: row.caseSizeMm ?? undefined,
    // ... map all fields, converting null to undefined
    styleTags: row.styleTags,
    designTraits: row.designTraits,
    roleTags: row.roleTags,
    // Phase 2 fields
    productionYear: row.productionYear ?? undefined,
    isFlaggedDeal: row.isFlaggedDeal ?? undefined,
    isChronometer: row.isChronometer ?? undefined,
    notes: row.notes ?? undefined,
    imageUrl: row.imageUrl ?? undefined,
  }
}
```

### Server Action Result Type
```typescript
// Shared result type for all Server Actions (D-12)
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `drizzle-zod` package | `drizzle-orm/zod` built-in | drizzle-orm 0.30.0 | No separate package needed; import from `drizzle-orm/zod` |
| `middleware.ts` | `proxy.ts` | Next.js 16 | Not relevant to Phase 3 (Phase 4 concern) but good to know |
| `useFormState` | `useActionState` | React 19 | Not relevant to Phase 3 (no UI changes) but Server Action return types should be compatible |

**Deprecated/outdated:**
- `drizzle-zod` package: Use `drizzle-orm/zod` instead [VERIFIED: official docs]
- `middleware.ts` in Next.js 16: Renamed to `proxy.ts` [VERIFIED: Next.js 16 bundled docs]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `drizzle-orm/zod` is compatible with Zod 4.x | Standard Stack, Common Pitfalls | Medium -- may need to pin zod@3; easy fix but blocks validation code |
| A2 | Supabase free-tier Postgres is adequate for development (cold start <30s, no blocking limits) | Environment Availability | Low -- known pain point from STATE.md; Neon is documented fallback |
| A3 | `preferredCaseSizeRange` as jsonb column is acceptable under D-02 "normalized columns" | Common Pitfalls | Low -- two flat columns is the alternative; jsonb is cleaner for a compound value |

## Open Questions

1. **Zod 4 compatibility with drizzle-orm/zod**
   - What we know: npm registry shows zod@4.3.6 as latest; drizzle-orm/zod was built against Zod 3
   - What's unclear: Whether drizzle-orm 0.45.2 supports Zod 4
   - Recommendation: Try `zod@4` first. If `createInsertSchema` fails, fall back to `zod@3.23.x`. Check `drizzle-orm` peer dependencies during install.

2. **preferredCaseSizeRange column strategy**
   - What we know: D-02 says "normalized columns, not JSON blob" for UserPreferences
   - What's unclear: Whether a single jsonb column for this compound field violates the spirit of D-02
   - Recommendation: Use jsonb for this one field. The alternative (two integer columns `preferred_case_size_min`, `preferred_case_size_max`) works but adds mapping complexity for negligible benefit. Document the rationale in schema comments.

3. **Development database hosting**
   - What we know: Docker is not available, so Supabase CLI local dev is blocked
   - What's unclear: Whether user has a Supabase cloud project already set up
   - Recommendation: Plan should include a task for creating a Supabase cloud project (free tier) and getting the `DATABASE_URL`. Alternatively, use Neon (serverless Postgres, no Docker needed) as a swap-out.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Everything | Yes | (not pinned) | -- |
| npm | Package install | Yes | (available) | -- |
| Docker | Supabase CLI local | **No** | -- | Use hosted Supabase free tier or Neon |
| Supabase CLI | Local Postgres | **No** | -- | Use hosted Supabase free tier or Neon |
| PostgreSQL (local) | Direct connection | **No** | -- | Use hosted Supabase free tier or Neon |

**Missing dependencies with no fallback:**
- None -- all missing tools have viable cloud alternatives

**Missing dependencies with fallback:**
- **Docker + Supabase CLI:** Use a hosted Supabase project (free tier) or Neon serverless Postgres. Decision D-15 calls for local Supabase but this is physically blocked. The `drizzle-kit push` workflow works identically against a remote database. Development requires internet access.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (configured in Phase 2) |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | Schema matches domain types | smoke | `npx drizzle-kit push --dry-run` (schema validity) | N/A -- schema test is the push |
| DATA-02 | DAL functions scope by userId | unit | `npx vitest run tests/data/watches.test.ts -x` | Wave 0 |
| DATA-03 | Server Actions validate + delegate + return shaped results | integration | `npx vitest run tests/actions/watches.test.ts -x` | Wave 0 |
| DATA-04 | Existing pages unchanged | smoke | `npm run build` (no build errors) | N/A -- build is the test |

### Sampling Rate
- **Per task commit:** `npm run build` (verify no client import of server-only modules)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** `npm run build` + `npx drizzle-kit push` against dev DB succeeds

### Wave 0 Gaps
- [ ] `tests/data/watches.test.ts` -- covers DATA-02 (DAL userId scoping)
- [ ] `tests/data/preferences.test.ts` -- covers DATA-02 (preferences DAL)
- [ ] `tests/actions/watches.test.ts` -- covers DATA-03 (Server Action validation + result shape)
- [ ] `tests/actions/preferences.test.ts` -- covers DATA-03 (preference actions)

**Note:** DAL tests require a real database connection. These are integration tests, not unit tests. They should use a test-specific DATABASE_URL or the dev database with transaction rollbacks. The planner should decide whether to include these in Phase 3 or defer to Phase 6 (TEST-04/05/06 scope).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (Phase 4) | Supabase Auth (deferred) |
| V3 Session Management | No (Phase 4) | Supabase Auth (deferred) |
| V4 Access Control | Partial | Every DAL query scoped by userId in WHERE clause (D-10); full auth enforcement in Phase 4 |
| V5 Input Validation | Yes | Zod validation via `drizzle-orm/zod` in every Server Action (D-14) |
| V6 Cryptography | No | No crypto operations in Phase 3 |

### Known Threat Patterns for Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection | Tampering | Drizzle ORM parameterized queries (never raw SQL for user input) |
| Mass assignment | Tampering | Zod schema validation strips unknown fields before DAL |
| IDOR (insecure direct object reference) | Information Disclosure | All queries scoped by userId (D-10); Phase 4 adds auth verification |
| Server Action direct POST | Elevation of Privilege | Next.js encrypted action IDs + Phase 4 auth checks |
| Leaked DB credentials | Information Disclosure | `server-only` build-time enforcement; DATABASE_URL in .env.local |

## Sources

### Primary (HIGH confidence)
- Next.js 16 bundled docs (`node_modules/next/dist/docs/01-app/02-guides/forms.md`) -- Server Actions, `'use server'` directive, Zod validation pattern
- Next.js 16 bundled docs (`node_modules/next/dist/docs/01-app/02-guides/data-security.md`) -- DAL pattern, `server-only`, mutation security
- Next.js 16 bundled docs (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md`) -- revalidatePath API
- Next.js 16 bundled docs (`node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-server.md`) -- `'use server'` directive
- npm registry -- verified versions: drizzle-orm@0.45.2, drizzle-kit@0.31.10, postgres@3.4.9, zod@4.3.6, server-only@0.0.1, drizzle-zod@0.8.3

### Secondary (MEDIUM confidence)
- [Drizzle + Supabase setup guide](https://orm.drizzle.team/docs/get-started/supabase-new) -- connection config, drizzle.config.ts
- [Drizzle PostgreSQL column types](https://orm.drizzle.team/docs/column-types/pg) -- text arrays, uuid, timestamp, real, etc.
- [Drizzle empty array defaults](https://orm.drizzle.team/docs/guides/empty-array-default-value) -- `sql\`'{}'\:\:text[]\`` pattern
- [Drizzle Zod integration](https://orm.drizzle.team/docs/zod) -- createInsertSchema, createUpdateSchema, deprecation notice
- [Supabase local development docs](https://supabase.com/docs/guides/local-development) -- Docker requirement confirmed

### Tertiary (LOW confidence)
- Zod 4 + drizzle-orm compatibility -- not verified, flagged in Assumptions Log

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages verified on npm, Drizzle + Supabase is a well-documented combo
- Architecture: HIGH -- Next.js 16 bundled docs confirm DAL + Server Actions pattern exactly as designed
- Pitfalls: HIGH -- common issues documented across multiple official sources
- Environment: HIGH -- Docker/Supabase CLI absence confirmed by direct probing

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (stable stack, 30-day validity)
