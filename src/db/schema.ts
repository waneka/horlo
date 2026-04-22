import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  index,
  unique,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// ----- Phase 11: wear_visibility enum (WYWT-09) -----
export const wearVisibilityEnum = pgEnum('wear_visibility', [
  'public',
  'followers',
  'private',
])

// ----- Phase 11: notification_type enum (NOTIF-01, D-09) -----
// All four values defined upfront even though `price_drop` and `trending_collector`
// have no write-path in v3.0 (they're stubs per NOTIF-07). Pre-populating avoids
// ALTER TYPE ADD VALUE in a later phase (non-transactional on Postgres).
export const notificationTypeEnum = pgEnum('notification_type', [
  'follow',
  'watch_overlap',
  'price_drop',
  'trending_collector',
])

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

    // Phase 2 additions (D-05)
    productionYear: integer('production_year'),
    isFlaggedDeal: boolean('is_flagged_deal').default(false),
    isChronometer: boolean('is_chronometer').default(false),

    notes: text('notes'),
    notesPublic: boolean('notes_public').notNull().default(true),
    notesUpdatedAt: timestamp('notes_updated_at', { withTimezone: true }),
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

// --- Social tables (Phase 7) ---

export const profiles = pgTable(
  'profiles',
  {
    id: uuid('id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
    username: text('username').notNull().unique(),
    displayName: text('display_name'),
    bio: text('bio'),
    avatarUrl: text('avatar_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('profiles_username_idx').on(table.username)]
)

export const follows = pgTable(
  'follows',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    followerId: uuid('follower_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    followingId: uuid('following_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('follows_follower_idx').on(table.followerId),
    index('follows_following_idx').on(table.followingId),
    unique('follows_unique_pair').on(table.followerId, table.followingId),
  ]
)

export const profileSettings = pgTable('profile_settings', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  profilePublic: boolean('profile_public').notNull().default(true),
  collectionPublic: boolean('collection_public').notNull().default(true),
  wishlistPublic: boolean('wishlist_public').notNull().default(true),
  wornPublic: boolean('worn_public').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const activities = pgTable(
  'activities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // 'watch_added' | 'wishlist_added' | 'watch_worn'
    watchId: uuid('watch_id').references(() => watches.id, { onDelete: 'set null' }),
    metadata: jsonb('metadata'), // { brand, model, imageUrl }
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('activities_user_id_idx').on(table.userId),
    index('activities_user_created_at_idx').on(table.userId, table.createdAt),
  ]
)

export const wearEvents = pgTable(
  'wear_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    watchId: uuid('watch_id').notNull().references(() => watches.id, { onDelete: 'cascade' }),
    wornDate: text('worn_date').notNull(), // ISO date string, e.g. '2026-04-19'
    note: text('note'),
    // Phase 11 additions (WYWT-09):
    photoUrl: text('photo_url'),
    visibility: wearVisibilityEnum('visibility').notNull().default('public'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('wear_events_watch_worn_at_idx').on(table.watchId, table.wornDate),
    unique('wear_events_unique_day').on(table.userId, table.watchId, table.wornDate),
  ]
)

// ----- Phase 11: notifications table (NOTIF-01) -----
// Column shapes only. Partial indexes, CHECK constraints, dedup UNIQUE, and RLS
// live in supabase/migrations/20260423000002_phase11_notifications.sql (D-08).
// Drizzle-orm 0.45.2 cannot express partial indexes or CHECK constraints in the
// pg-core DSL — raw SQL is authoritative for those. This table definition is the
// source of truth for column types and type inference only.
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'cascade' }),
    type: notificationTypeEnum('type').notNull(),
    payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('notifications_user_id_idx').on(table.userId)],
)
