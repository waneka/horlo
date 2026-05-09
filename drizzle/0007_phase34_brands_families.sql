-- Phase 34 — Layer A: brands + watch_families column shapes (Drizzle-side).
-- Idempotent: this migration also runs AFTER supabase db push --linked has applied
--   supabase/migrations/20260510000000_phase34_brands_families.sql (which already created the tables
--   with CREATE TABLE IF NOT EXISTS). drizzle-kit migrate must therefore not error on existing objects.
-- Pattern source: supabase/migrations/20260426000000_phase17_drizzle_tables.sql.

CREATE TABLE IF NOT EXISTS "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"name_normalized" text GENERATED ALWAYS AS (lower(trim(name))) STORED,
	"slug" text NOT NULL,
	"country_of_origin" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brands_slug_unique" UNIQUE("slug"),
	CONSTRAINT "brands_name_normalized_unique" UNIQUE("name_normalized")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "watch_families" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"name" text NOT NULL,
	"name_normalized" text GENERATED ALWAYS AS (lower(trim(name))) STORED,
	"slug" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watch_families_brand_name_unique" UNIQUE("brand_id","name_normalized")
);
--> statement-breakpoint
ALTER TABLE "watches_catalog" ADD COLUMN IF NOT EXISTS "brand_id" uuid;--> statement-breakpoint
ALTER TABLE "watches_catalog" ADD COLUMN IF NOT EXISTS "family_id" uuid;--> statement-breakpoint
-- FK guards — Postgres has no `ADD CONSTRAINT IF NOT EXISTS`; use DO blocks (matches phase17_drizzle_tables.sql pattern).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'watch_families_brand_id_brands_id_fk'
      AND conrelid = 'watch_families'::regclass
  ) THEN
    ALTER TABLE "watch_families"
      ADD CONSTRAINT "watch_families_brand_id_brands_id_fk"
      FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id")
      ON DELETE restrict ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'watches_catalog_brand_id_brands_id_fk'
      AND conrelid = 'watches_catalog'::regclass
  ) THEN
    ALTER TABLE "watches_catalog"
      ADD CONSTRAINT "watches_catalog_brand_id_brands_id_fk"
      FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id")
      ON DELETE restrict ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'watches_catalog_family_id_watch_families_id_fk'
      AND conrelid = 'watches_catalog'::regclass
  ) THEN
    ALTER TABLE "watches_catalog"
      ADD CONSTRAINT "watches_catalog_family_id_watch_families_id_fk"
      FOREIGN KEY ("family_id") REFERENCES "public"."watch_families"("id")
      ON DELETE restrict ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "watch_families_brand_id_idx" ON "watch_families" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "watches_catalog_brand_id_idx" ON "watches_catalog" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "watches_catalog_family_id_idx" ON "watches_catalog" USING btree ("family_id");
