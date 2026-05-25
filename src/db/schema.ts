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
  date,           // Phase 37 D-08: purchase_date column
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
// Phase 53 D-09: 4 new values added via ALTER TYPE ADD VALUE in raw SQL migration
// (20260522000001_phase53_notification_enum.sql — non-transactional, no BEGIN/COMMIT).
export const notificationTypeEnum = pgEnum('notification_type', [
  'follow',
  'watch_overlap',
  'watch_like',
  'wear_like',
  'watch_comment',
  'wear_comment',
])

// ----- Phase 35 D-01: movement type pgEnum (CAT-16) -----
export const movementTypeEnum = pgEnum('movement_type_enum', [
  'auto', 'manual', 'quartz', 'spring_drive',
] as const)

// ----- Phase 35 D-04: lineage relationship type pgEnum (CAT-16) -----
export const lineageRelationshipTypeEnum = pgEnum('lineage_relationship_type', [
  'successor', 'predecessor', 'remake', 'tribute', 'homage',
] as const)

// ----- Phase 35 D-09: watch era pgEnum (CAT-16) — independent of era_signal (Phase 19.1 D-01) -----
export const watchEraEnum = pgEnum('watch_era', [
  '1900-1910', '1910-1920', '1920-1930', '1930-1940', '1940-1950',
  '1950-1960', '1960-1970', '1970-1980', '1980-1990', '1990-2000',
  '2000-2010', '2010-2020', '2020-2030',
] as const)

// ----- Phase 37 D-02: condition grade pgEnum (CAT-18) -----
export const conditionGradeEnum = pgEnum('condition_grade', [
  'mint', 'near_mint', 'excellent', 'good', 'fair', 'poor',
] as const)

// ----- Phase 37 D-03 / D-04: currency code pgEnum (CAT-18) -----
export const currencyCodeEnum = pgEnum('currency_code', [
  'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'HKD', 'SGD', 'CNY',
] as const)

// ----- Phase 37 D-05: box/papers status pgEnum (CAT-18) -----
export const boxPapersStatusEnum = pgEnum('box_papers_status', [
  'none', 'box_only', 'papers_only', 'full_set',
] as const)

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

    // Phase 35 D-03: movement_type enum + movement_caliber (replaces nullable text 'movement')
    movementType: movementTypeEnum('movement_type'),
    movementCaliber: text('movement_caliber'),
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

    // ----- Phase 37 D-01..D-08: collector provenance fields (all nullable; CAT-18) -----
    serial: text('serial'),
    yearOfAcquisition: integer('year_of_acquisition'),
    condition: conditionGradeEnum('condition'),
    boxPapers: boxPapersStatusEnum('box_papers'),
    serviceHistory: text('service_history'),
    paidCurrency: currencyCodeEnum('paid_currency'),
    purchaseDate: date('purchase_date'),

    // Phase 17 + Phase 36 + Phase 38: catalog FK — NOT NULL.
    // Phase 36 shipped SET NOT NULL to prod (20260511000000_phase36_layer_c_variants.sql).
    // Phase 38 Plan 01 catches up Drizzle types: DAL rewrite (createWatch 3-arg), 3 callsite
    // refactors, 17 fixture cascades, and this .notNull() flip. ON DELETE SET NULL preserved
    // for catalog row cleanup safety (Phase 17 D-04).
    catalogId: uuid('catalog_id').notNull().references(() => watchesCatalog.id, { onDelete: 'set null' }),

    // Phase 36 D-04: variant FK — nullable, ON DELETE SET NULL (CAT-17).
    // No NOT NULL flip scheduled — variants will never hit 100% coverage (D-04 rationale).
    // Forward-reference resolved lazily by Drizzle (watchVariants defined below at end of file).
    variantId: uuid('variant_id').references(() => watchVariants.id, { onDelete: 'set null' }),

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
    // D-01: owner identity — single source of truth for RLS and assertOwner().
    // Set true by migration via email key (D-04); never app-writable.
    isAdmin: boolean('is_admin').notNull().default(false),
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
  // Phase 53 D-10: opt-out columns for new v6.0 interaction types
  notifyOnLike:    boolean('notify_on_like').notNull().default(true),
  notifyOnComment: boolean('notify_on_comment').notNull().default(true),

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

// ----- Phase 53 D-01: watch_likes table (LIKE-05, SEC-01, SEC-06) -----
// Column shapes only. UNIQUE constraint (watch_likes_unique_pair), RLS policies,
// GRANT/REVOKE, and DO $$ assertions live in
// supabase/migrations/20260522000000_phase53_likes_comments_rls.sql.
// Drizzle 0.45.2 cannot express RLS in the pg-core DSL — raw SQL is authoritative.
export const watchLikes = pgTable(
  'watch_likes',
  {
    id:        uuid('id').defaultRandom().primaryKey(),
    userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    watchId:   uuid('watch_id').notNull().references(() => watches.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('watch_likes_unique_pair').on(table.userId, table.watchId),
    index('watch_likes_watch_id_idx').on(table.watchId),
    index('watch_likes_user_id_idx').on(table.userId),
  ],
)

// ----- Phase 60 D-01..D-03: watch_photos table (PHOTO-01) -----
// Column shapes only. ENABLE ROW LEVEL SECURITY, all RLS policies, bucket
// creation, and the backfill + DROP sequence live in
// supabase/migrations/20260525000000_phase60_watch_photos.sql.
// Drizzle 0.45.2 cannot express RLS in the pg-core DSL — raw SQL is authoritative.
export const watchPhotos = pgTable(
  'watch_photos',
  {
    id:          uuid('id').defaultRandom().primaryKey(),
    watchId:     uuid('watch_id').notNull().references(() => watches.id, { onDelete: 'cascade' }),
    storagePath: text('storage_path').notNull(),
    sortOrder:   integer('sort_order').notNull().default(0),
    createdAt:   timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('watch_photos_watch_id_sort_idx').on(table.watchId, table.sortOrder),
  ],
)

// ----- Phase 53 D-01: wear_likes table (LIKE-05, SEC-01, SEC-06) -----
// Column shapes only. UNIQUE constraint (wear_likes_unique_pair), RLS policies,
// GRANT/REVOKE, and DO $$ assertions live in
// supabase/migrations/20260522000000_phase53_likes_comments_rls.sql.
export const wearLikes = pgTable(
  'wear_likes',
  {
    id:          uuid('id').defaultRandom().primaryKey(),
    userId:      uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    wearEventId: uuid('wear_event_id').notNull().references(() => wearEvents.id, { onDelete: 'cascade' }),
    createdAt:   timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('wear_likes_unique_pair').on(table.userId, table.wearEventId),
    index('wear_likes_wear_event_id_idx').on(table.wearEventId),
    index('wear_likes_user_id_idx').on(table.userId),
  ],
)

// ----- Phase 53 D-02: comments table (GATE-02, SEC-01, SEC-04, SEC-06) -----
// Column shapes only. CHECK constraints (comments_exactly_one_target: XOR of nullable FKs;
// comments_body_length: char_length <= 500 AND non-blank) and all RLS policies live in
// supabase/migrations/20260522000000_phase53_likes_comments_rls.sql (D-12).
// Drizzle 0.45.2 cannot express CHECK constraints or RLS in the pg-core DSL —
// raw SQL is authoritative for those. This table definition is the source of truth
// for column types and type inference only.
export const comments = pgTable(
  'comments',
  {
    id:          uuid('id').defaultRandom().primaryKey(),
    authorId:    uuid('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    // Exactly one of watchId / wearEventId must be non-null — enforced by DB CHECK
    watchId:     uuid('watch_id').references(() => watches.id, { onDelete: 'cascade' }),
    wearEventId: uuid('wear_event_id').references(() => wearEvents.id, { onDelete: 'cascade' }),
    body:        text('body').notNull(),
    // editedAt: set by editComment Server Action (Phase 55); null means never edited (CMNT-06)
    editedAt:    timestamp('edited_at', { withTimezone: true }),
    createdAt:   timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt:   timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('comments_watch_id_created_at_idx').on(table.watchId, table.createdAt),
    index('comments_wear_event_id_created_at_idx').on(table.wearEventId, table.createdAt),
    index('comments_author_id_idx').on(table.authorId),
    // NOTE: no unique() — comments intentionally have no UNIQUE constraint (D-02 / Pitfall 5)
  ],
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

    // Phase 35 D-03 + D-09 + D-10 + D-11: structured movement + era + material + bracelet
    movementType: movementTypeEnum('movement_type'),
    movementCaliber: text('movement_caliber'),
    era: watchEraEnum('era'),
    caseMaterial: text('case_material'),
    braceletConfig: text('bracelet_config'),
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
    eraSignal:        text('era_signal'),
    designMotifs:     text('design_motifs').array().notNull().default(sql`'{}'::text[]`),
    confidence:       numeric('confidence',       { precision: 3, scale: 2 }),
    extractedFromPhoto: boolean('extracted_from_photo').notNull().default(false),

    // ----- Phase 34 D-02: nullable FKs to brand + family entities (CAT-15) -----
    // ON DELETE RESTRICT — service-role-only writes; orphan-detection signal at delete.
    // Different from watches.catalogId 'set null' (Phase 36 wipes catalog rows; brands/families don't).
    brandId: uuid('brand_id').references(() => brands.id, { onDelete: 'restrict' }),
    familyId: uuid('family_id').references(() => watchFamilies.id, { onDelete: 'restrict' }),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
)

// ============================================================
// Phase 34 — Layer A (CAT-15, D-01..D-04): brands + watch_families
// Schema-only entities; populated via service-role backfill (D-03).
// RLS public-read + service-role-write co-located in
// supabase/migrations/20260510000000_phase34_brands_families.sql.
// ============================================================
export const brands = pgTable(
  'brands',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    // GENERATED ALWAYS AS (lower(trim(name))) STORED — Phase 17 D-02/D-03 inheritance.
    nameNormalized: text('name_normalized').generatedAlwaysAs(
      sql`lower(trim(name))`,
    ),
    slug: text('slug').notNull().unique(),
    countryOfOrigin: text('country_of_origin'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('brands_name_normalized_unique').on(table.nameNormalized),
  ]
)

export const watchFamilies = pgTable(
  'watch_families',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // brand_id NOT NULL per D-01 (a family must belong to a brand); ON DELETE RESTRICT per D-02.
    brandId: uuid('brand_id').notNull().references(() => brands.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    nameNormalized: text('name_normalized').generatedAlwaysAs(
      sql`lower(trim(name))`,
    ),
    // slug nullable per D-01a — global slug uniqueness not enforced for families.
    slug: text('slug'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('watch_families_brand_name_unique').on(table.brandId, table.nameNormalized),
  ]
)

// ----- Phase 35 D-04..D-07: watch_lineage_edges junction table (CAT-16) -----
// CHECK (predecessor_catalog_id <> successor_catalog_id) and BEFORE INSERT cycle trigger
// live in the Supabase migration (Plan 05) — not expressible in Drizzle 0.45.2 pg-core DSL.
// Same pattern as notifications table comment above.
export const watchLineageEdges = pgTable(
  'watch_lineage_edges',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    predecessorCatalogId: uuid('predecessor_catalog_id')
      .notNull()
      .references(() => watchesCatalog.id, { onDelete: 'restrict' }),
    successorCatalogId: uuid('successor_catalog_id')
      .notNull()
      .references(() => watchesCatalog.id, { onDelete: 'restrict' }),
    relationshipType: lineageRelationshipTypeEnum('relationship_type').notNull(),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('watch_lineage_edges_predecessor_idx').on(table.predecessorCatalogId),
    index('watch_lineage_edges_successor_idx').on(table.successorCatalogId),
    unique('lineage_edges_unique_triple').on(
      table.predecessorCatalogId,
      table.successorCatalogId,
      table.relationshipType,
    ),
  ],
)

// ============================================================
// Phase 36 — Layer C (CAT-17, D-02..D-05): watch_variants
// Schema-only entity; populated via service-role backfill in Phase 39 (D-06).
// RLS public-read + GRANT SELECT to anon/authenticated co-located in
// supabase/migrations/20260511000000_phase36_layer_c_variants.sql.
// Same Drizzle-vs-Supabase split as Phase 34/35: Drizzle = column shapes;
// Supabase = authoritative DDL including RLS + GRANT + DO $$ pre-flight + assertions.
// ============================================================
export const watchVariants = pgTable(
  'watch_variants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // D-03: ON DELETE RESTRICT — orphan-detection signal; service-role-only writes mean no app-flow risk.
    catalogId: uuid('catalog_id')
      .notNull()
      .references(() => watchesCatalog.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    // D-02: slug is set explicitly (NOT GENERATED) — URL-stable across name edits.
    slug: text('slug').notNull(),
    dialColor: text('dial_color'),
    bezel: text('bezel'),
    braceletVariant: text('bracelet_variant'),
    imageUrl: text('image_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('watch_variants_catalog_id_idx').on(table.catalogId),
    unique('watch_variants_catalog_slug_unique').on(table.catalogId, table.slug),
  ],
)

// ============================================================
// Phase 37 — Layer D (CAT-18, D-09): divestments table
// Records every sale with timestamp / price / replacement / notes —
// replaces watches.status='sold' single-bit signal with a structured
// sold record the future recommender (SEED-002) consumes for
// temporal decay weighting.
// RLS = PER-USER (auth.uid() = user_id) — see Plan 02 Supabase migration
// for ENABLE ROW LEVEL SECURITY + 4 policies + GRANT.
// Drizzle-side carries column shapes only; no RLS, no GRANT, no triggers.
// ============================================================
export const divestments = pgTable(
  'divestments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // D-09 + Phase 34 D-02: catalog_id NOT NULL FK ON DELETE RESTRICT.
    catalogId: uuid('catalog_id')
      .notNull()
      .references(() => watchesCatalog.id, { onDelete: 'restrict' }),
    // D-09 + Phase 17 D-04: user_id NOT NULL FK ON DELETE CASCADE.
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // D-09: divested_at defaults to now() so Server Action does not pass it.
    divestedAt: timestamp('divested_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    // D-09: replaced_by_catalog_id nullable FK ON DELETE SET NULL (soft hint).
    replacedByCatalogId: uuid('replaced_by_catalog_id')
      .references(() => watchesCatalog.id, { onDelete: 'set null' }),
    // D-09: sale_price + sale_currency are nullable (sell-dialog deferred to v5.x).
    salePrice: real('sale_price'),
    saleCurrency: currencyCodeEnum('sale_currency'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('divestments_user_id_idx').on(table.userId),
    index('divestments_catalog_id_idx').on(table.catalogId),
    // D-09: composite index for "recent divestments per user" recommender query.
    // Note: drizzle .on() does not express DESC; the Supabase migration creates
    // the index with DESC explicitly. Drizzle uses ASC default — Postgres still
    // uses the index for DESC queries (B-tree ordered both directions).
    index('divestments_user_divested_at_idx').on(table.userId, table.divestedAt),
  ],
)

// ============================================================
// Phase 45 — CMS tables (CMS-01, CMS-02, CMS-05, CMS-08, CMS-09)
// Column shapes only. CHECK constraints (path_type_check, cms_settings_single_row)
// and RLS policies live in supabase/migrations/20260518200000_phase45_cms_tables.sql.
// Drizzle 0.45.2 cannot express CHECK constraints in the pg-core DSL — raw SQL is
// authoritative for those. This table definition is the source of truth for column
// types and type inference only.
// ============================================================

export const curatedLists = pgTable(
  'curated_lists',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    curatorName: text('curator_name').notNull(),
    coverUrl: text('cover_url'),
    introMarkdown: text('intro_markdown'),
    status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
    sortOrder: integer('sort_order').notNull().default(0),
    publishedAt: timestamp('published_at', { withTimezone: true }),  // nullable — set on first publish (D-02)
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('curated_lists_status_sort_idx').on(table.status, table.sortOrder),
  ],
)

export const curatedListItems = pgTable(
  'curated_list_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    listId: uuid('list_id').notNull().references(() => curatedLists.id, { onDelete: 'cascade' }),
    // D-07: ON DELETE RESTRICT — blocks catalog watch deletion when referenced
    catalogId: uuid('catalog_id').notNull().references(() => watchesCatalog.id, { onDelete: 'restrict' }),
    commentary: text('commentary'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('curated_list_items_list_id_idx').on(table.listId),
    index('curated_list_items_catalog_id_idx').on(table.catalogId),
    unique('curated_list_items_unique_pair').on(table.listId, table.catalogId),
  ],
)

export const collectionPaths = pgTable(
  'collection_paths',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // D-07: ON DELETE RESTRICT on seed_catalog_id as well
    seedCatalogId: uuid('seed_catalog_id').notNull().references(() => watchesCatalog.id, { onDelete: 'restrict' }),
    status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
    // D-17: text + CHECK (not enum) — CHECK constraint lives in raw SQL migration only
    pathType: text('path_type').notNull(),
    rationale: text('rationale'),
    // SEED-008: forward-compat source field for future computed paths
    source: text('source', { enum: ['manual', 'computed'] }).notNull().default('manual'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('collection_paths_status_idx').on(table.status),
  ],
)

export const collectionPathNodes = pgTable(
  'collection_path_nodes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    pathId: uuid('path_id').notNull().references(() => collectionPaths.id, { onDelete: 'cascade' }),
    // D-07: ON DELETE RESTRICT — blocks catalog watch deletion when referenced
    catalogId: uuid('catalog_id').notNull().references(() => watchesCatalog.id, { onDelete: 'restrict' }),
    rationale: text('rationale'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('collection_path_nodes_path_id_idx').on(table.pathId),
    index('collection_path_nodes_catalog_id_idx').on(table.catalogId),
    // WR-06: one node per slot — gives setPathNode's onConflictDoUpdate a target.
    unique('collection_path_nodes_unique_slot').on(table.pathId, table.sortOrder),
  ],
)

// Single-row settings table. PK=1 enforced by CHECK (id = 1) in raw SQL migration.
// SEED-008: heroFormat discriminated union with forward-compat 'featured_collector' value.
export const cmsSettings = pgTable('cms_settings', {
  id: integer('id').primaryKey().default(1),
  pinnedListId: uuid('pinned_list_id').references(() => curatedLists.id, { onDelete: 'set null' }),
  pinExpiresAt: timestamp('pin_expires_at', { withTimezone: true }),
  heroFormat: text('hero_format', { enum: ['featured_list', 'featured_collector'] })
    .notNull().default('featured_list'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

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
