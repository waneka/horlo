import {
  pgTable,
  uuid,
  text,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// Shadow users table for FK integrity.
// Supabase Auth owns the real user record; this table exists solely for foreign key references.
export const users = pgTable('users', {
  id: uuid('id').primaryKey(), // matches Supabase Auth user ID, set explicitly on insert
  email: text('email').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// watches table — maps every field from the Watch domain type in src/lib/types.ts
// plus userId FK for multi-user isolation (D-10) and Phase 2 additions (D-05).
export const watches = pgTable(
  'watches',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

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
    // Array fields use Postgres text arrays (D-01). Default is an empty array, not null.
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

    // Phase 2 additions (D-05)
    productionYear: integer('production_year'),
    isFlaggedDeal: boolean('is_flagged_deal').default(false),
    isChronometer: boolean('is_chronometer').default(false),

    notes: text('notes'),
    imageUrl: text('image_url'),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('watches_user_id_idx').on(table.userId)],
)

// userPreferences table — normalized columns (D-02), one row per user.
// preferredCaseSizeRange is the single jsonb exception because it is a compound value
// { min, max } — splitting into two columns adds mapping complexity for no benefit (Pitfall 6).
export const userPreferences = pgTable(
  'user_preferences',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' })
      .unique(), // one preferences row per user

    preferredStyles: text('preferred_styles').array().notNull().default(sql`'{}'::text[]`),
    dislikedStyles: text('disliked_styles').array().notNull().default(sql`'{}'::text[]`),

    preferredDesignTraits: text('preferred_design_traits').array().notNull().default(sql`'{}'::text[]`),
    dislikedDesignTraits: text('disliked_design_traits').array().notNull().default(sql`'{}'::text[]`),

    preferredComplications: text('preferred_complications').array().notNull().default(sql`'{}'::text[]`),
    complicationExceptions: text('complication_exceptions').array().notNull().default(sql`'{}'::text[]`),

    preferredDialColors: text('preferred_dial_colors').array().notNull().default(sql`'{}'::text[]`),
    dislikedDialColors: text('disliked_dial_colors').array().notNull().default(sql`'{}'::text[]`),

    // jsonb for this one compound field — consistent with D-02 spirit, avoids awkward min/max split
    preferredCaseSizeRange: jsonb('preferred_case_size_range'),

    overlapTolerance: text('overlap_tolerance', {
      enum: ['low', 'medium', 'high'],
    })
      .notNull()
      .default('medium'),

    collectionGoal: text('collection_goal', {
      enum: ['balanced', 'specialist', 'variety-within-theme', 'brand-loyalist'],
    }),

    notes: text('notes'),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('user_preferences_user_id_idx').on(table.userId)],
)
