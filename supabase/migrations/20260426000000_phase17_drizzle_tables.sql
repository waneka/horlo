-- Phase 17 — drizzle-side schema: watches_catalog + watches_catalog_daily_snapshots tables.
-- Ported from drizzle/0004_phase17_catalog.sql so prod can apply via supabase db push --linked.
-- Idempotent: CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, DO-block constraint guards.
-- Locally these objects already exist (drizzle-kit push); this migration is a no-op there.

CREATE TABLE IF NOT EXISTS "watches_catalog" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "brand" text NOT NULL,
  "model" text NOT NULL,
  "reference" text,
  "brand_normalized" text GENERATED ALWAYS AS (lower(trim(brand))) STORED,
  "model_normalized" text GENERATED ALWAYS AS (lower(trim(model))) STORED,
  "reference_normalized" text GENERATED ALWAYS AS (CASE WHEN reference IS NULL THEN NULL ELSE regexp_replace(lower(trim(reference)), '[^a-z0-9]+', '', 'g') END) STORED,
  "source" text DEFAULT 'user_promoted' NOT NULL,
  "image_url" text,
  "image_source_url" text,
  "image_source_quality" text,
  "movement" text,
  "case_size_mm" real,
  "lug_to_lug_mm" real,
  "water_resistance_m" integer,
  "crystal_type" text,
  "dial_color" text,
  "is_chronometer" boolean,
  "production_year" integer,
  "production_year_is_estimate" boolean DEFAULT false NOT NULL,
  "style_tags" text[] DEFAULT '{}'::text[] NOT NULL,
  "design_traits" text[] DEFAULT '{}'::text[] NOT NULL,
  "role_tags" text[] DEFAULT '{}'::text[] NOT NULL,
  "complications" text[] DEFAULT '{}'::text[] NOT NULL,
  "owners_count" integer DEFAULT 0 NOT NULL,
  "wishlist_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "watches_catalog_daily_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "catalog_id" uuid NOT NULL,
  "snapshot_date" text NOT NULL,
  "owners_count" integer NOT NULL,
  "wishlist_count" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "watches_catalog_snapshots_unique_per_day" UNIQUE("catalog_id","snapshot_date")
);

-- profile_settings notification columns (drizzle 0004 also added these).
ALTER TABLE "profile_settings" ADD COLUMN IF NOT EXISTS "notifications_last_seen_at" timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE "profile_settings" ADD COLUMN IF NOT EXISTS "notify_on_follow" boolean DEFAULT true NOT NULL;
ALTER TABLE "profile_settings" ADD COLUMN IF NOT EXISTS "notify_on_watch_overlap" boolean DEFAULT true NOT NULL;

-- watches.catalog_id FK (drizzle 0004 also added this).
ALTER TABLE "watches" ADD COLUMN IF NOT EXISTS "catalog_id" uuid;

-- FK: watches_catalog_daily_snapshots.catalog_id -> watches_catalog.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'watches_catalog_daily_snapshots_catalog_id_watches_catalog_id_fk'
      AND conrelid = 'watches_catalog_daily_snapshots'::regclass
  ) THEN
    ALTER TABLE "watches_catalog_daily_snapshots"
      ADD CONSTRAINT "watches_catalog_daily_snapshots_catalog_id_watches_catalog_id_fk"
      FOREIGN KEY ("catalog_id") REFERENCES "public"."watches_catalog"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

-- FK: watches.catalog_id -> watches_catalog.id (set null on delete so user data survives catalog deletes).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'watches_catalog_id_watches_catalog_id_fk'
      AND conrelid = 'watches'::regclass
  ) THEN
    ALTER TABLE "watches"
      ADD CONSTRAINT "watches_catalog_id_watches_catalog_id_fk"
      FOREIGN KEY ("catalog_id") REFERENCES "public"."watches_catalog"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "watches_catalog_snapshots_date_idx" ON "watches_catalog_daily_snapshots" USING btree ("snapshot_date","catalog_id");
CREATE INDEX IF NOT EXISTS "watches_catalog_id_idx" ON "watches" USING btree ("catalog_id");
