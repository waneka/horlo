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
  numeric,
  index,
  unique,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// NOTE: watchesCatalog is defined after `watches` in this file.
// watches.catalogId uses a callback reference `() => watchesCatalog.id`
// so Drizzle resolves it lazily — same pattern as users ← watches.userId.

// ----- Phase 11: wear_visibility enum (WYWT-09) -----
export const wearVisibilityEnum = pgEnum('wear_visibility', [
  'public',
  'followers',
  'private',
])

// ----- Phase 11: notification_type enum (NOTIF-01, D-09) -----
// Narrowed to 2 values in Phase 24 (DEBT-05) after prod migration applied.
// Stub values with no write-path removed (see Phase 24 migration for history).
export const notificationTypeEnum = pgEnum('notification_type', [
  'follow',
  'watch_overlap',
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
// Phase 17: catalogId FK added (nullable, ON DELETE SET NULL) — never SET NOT NULL in v4.0.
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

    // Phase 17: catalog FK — nullable, ON DELETE SET NULL (CAT-04, D-catalog-14: NEVER SET NOT NULL in v4.0)
    // Forward-reference resolved lazily by Drizzle (watchesCatalog defined below).
    catalogId: uuid('catalog_id').references(() => watchesCatalog.id, { onDelete: 'set null' }),

    // Phase 27 — sort_order for wishlist drag-reorder (D-01).
    // Default 0; backfilled per-user in createdAt DESC order via parallel
    // supabase migration. Universal column on every row regardless of status.
    sortOrder: integer('sort_order').notNull().default(0),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('watches_user_id_idx').on(table.userId),
    index('watches_catalog_id_idx').on(table.catalogId),
    // Phase 27 — composite index for getWatchesByUser ORDER BY (D-01).
    index('watches_user_sort_idx').on(table.userId, table.sortOrder),
  ],
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
  // wornPublic: REMOVED in Phase 12 (WYWT-11) — replaced by per-row
  // wear_events.visibility enum. Column dropped in
  // supabase/migrations/20260424000001_phase12_drop_worn_public.sql.

  // Phase 13 additions (NOTIF-04, NOTIF-09; CONTEXT.md D-06, D-16, D-18):
  // - notificationsLastSeenAt drives the bell unread-dot query (D-06):
  //   dot = EXISTS(notifications WHERE user_id = current AND created_at > last_seen_at).
  //   Updated server-side when the user visits /notifications (D-07).
  // - notifyOnFollow / notifyOnWatchOverlap are write-time opt-outs (D-18):
  //   logNotification reads these before insert; skips insert when false.
  notificationsLastSeenAt: timestamp('notifications_last_seen_at', { withTimezone: true }).defaultNow().notNull(),
  notifyOnFollow: boolean('notify_on_follow').notNull().default(true),
  notifyOnWatchOverlap: boolean('notify_on_watch_overlap').notNull().default(true),

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

// ----- Phase 17: canonical watches catalog (CAT-01, CAT-02, CAT-03, CAT-12) -----
// Column shapes only. The natural-key UNIQUE NULLS NOT DISTINCT, GENERATED ALWAYS AS
// columns, CHECK constraints, RLS policies, GIN indexes, and updated_at trigger all
// live in supabase/migrations/20260427000000_phase17_catalog_schema.sql.
// This Drizzle definition is the source of truth for column types and type inference only.
//
// The Drizzle migration (drizzle/0004_phase17_catalog.sql) carries the column shapes.
// If drizzle-kit emitted malformed GENERATED DDL, the Supabase migration is authoritative
// (see Plan 01 Task 2 fallback note and Task 3 DO $$ idempotent clause).
export const watchesCatalog = pgTable(
  'watches_catalog',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    brand: text('brand').notNull(),
    model: text('model').notNull(),
    reference: text('reference'),

    // GENERATED columns — computed by Postgres, not app code (D-02, D-03).
    // Drizzle 0.45.2 supports generatedAlwaysAs; if emitted DDL is malformed,
    // the Supabase migration's DO $$ block re-creates them correctly.
    brandNormalized: text('brand_normalized').generatedAlwaysAs(
      sql`lower(trim(brand))`,
    ),
    modelNormalized: text('model_normalized').generatedAlwaysAs(
      sql`lower(trim(model))`,
    ),
    referenceNormalized: text('reference_normalized').generatedAlwaysAs(
      sql`CASE WHEN reference IS NULL THEN NULL ELSE regexp_replace(lower(trim(reference)), '[^a-z0-9]+', '', 'g') END`,
    ),

    // CHECK constraints on source and image_source_quality are added in raw SQL migration (D-04, D-06).
    source: text('source').notNull().default('user_promoted'),
    imageUrl: text('image_url'),
    imageSourceUrl: text('image_source_url'),
    imageSourceQuality: text('image_source_quality'),

    movement: text('movement'),
    caseSizeMm: real('case_size_mm'),
    lugToLugMm: real('lug_to_lug_mm'),
    waterResistanceM: integer('water_resistance_m'),
    crystalType: text('crystal_type'),
    dialColor: text('dial_color'),
    isChronometer: boolean('is_chronometer'),
    productionYear: integer('production_year'),
    productionYearIsEstimate: boolean('production_year_is_estimate').notNull().default(false),

    // Tag columns mirror watches table shape exactly (D-09)
    styleTags:    text('style_tags').array().notNull().default(sql`'{}'::text[]`),
    designTraits: text('design_traits').array().notNull().default(sql`'{}'::text[]`),
    roleTags:     text('role_tags').array().notNull().default(sql`'{}'::text[]`),
    complications: text('complications').array().notNull().default(sql`'{}'::text[]`),

    // Denormalized counts refreshed by pg_cron daily batch (CAT-09, D-15)
    ownersCount:   integer('owners_count').notNull().default(0),
    wishlistCount: integer('wishlist_count').notNull().default(0),

    // ----- Phase 19.1 D-01 taste attributes (LLM-derived, cached on catalog row) -----
    formality:        numeric('formality',        { precision: 3, scale: 2 }),
    sportiness:       numeric('sportiness',       { precision: 3, scale: 2 }),
    heritageScore:    numeric('heritage_score',   { precision: 3, scale: 2 }),
    primaryArchetype: text('primary_archetype'),
    eraSignal:        text('era_signal'),
    designMotifs:     text('design_motifs').array().notNull().default(sql`'{}'::text[]`),
    confidence:       numeric('confidence',       { precision: 3, scale: 2 }),
    extractedFromPhoto: boolean('extracted_from_photo').notNull().default(false),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
)

// ----- Phase 17: daily catalog snapshots (CAT-12) -----
// Records (catalog_id, snapshot_date, owners_count, wishlist_count) once per day.
// UNIQUE (catalog_id, snapshot_date) enforced in raw SQL; idempotent on re-run.
export const watchesCatalogDailySnapshots = pgTable(
  'watches_catalog_daily_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    catalogId: uuid('catalog_id').notNull().references(() => watchesCatalog.id, { onDelete: 'cascade' }),
    snapshotDate: text('snapshot_date').notNull(),
    ownersCount: integer('owners_count').notNull(),
    wishlistCount: integer('wishlist_count').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('watches_catalog_snapshots_unique_per_day').on(table.catalogId, table.snapshotDate),
    index('watches_catalog_snapshots_date_idx').on(table.snapshotDate, table.catalogId),
  ],
)
