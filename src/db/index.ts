import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// { prepare: false } is required for Supabase connection pooling (Transaction mode).
// Without it, prepared statements fail because the pooler does not support them.
// See: https://orm.drizzle.team/docs/get-started/supabase-new
const client = postgres(process.env.DATABASE_URL!, { prepare: false })
export const db = drizzle(client, { schema })
