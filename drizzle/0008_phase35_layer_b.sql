-- Phase 35 — Layer B: Lineage Edges + Structured Movement + Era/Material (Drizzle-side).
-- Idempotent: this migration also runs AFTER supabase db push --linked has applied
--   supabase/migrations/20260510000001_phase35_layer_b.sql (the authoritative DDL).
-- Drizzle migration carries column shapes only. No RLS, no trigger, no CHECK constraint —
-- those live exclusively in the Supabase migration.
-- Per memory rule project_local_db_reset.md, local re-sync runs:
--   supabase db reset → drizzle-kit push → docker exec psql < this file
-- so every CREATE / ALTER must be IF NOT EXISTS.

-- ----- pgEnum CREATE TYPE statements (idempotent for local re-sync) -----
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'movement_type_enum') THEN
    CREATE TYPE "movement_type_enum" AS ENUM ('auto', 'manual', 'quartz', 'spring_drive');
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lineage_relationship_type') THEN
    CREATE TYPE "lineage_relationship_type" AS ENUM ('successor', 'predecessor', 'remake', 'tribute', 'homage');
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'watch_era') THEN
    CREATE TYPE "watch_era" AS ENUM (
      '1900-1910', '1910-1920', '1920-1930', '1930-1940', '1940-1950',
      '1950-1960', '1960-1970', '1970-1980', '1980-1990', '1990-2000',
      '2000-2010', '2010-2020', '2020-2030'
    );
  END IF;
END $$;
--> statement-breakpoint

-- ----- watches: drop old movement; add movement_type + movement_caliber -----
ALTER TABLE "watches" DROP COLUMN IF EXISTS "movement";
--> statement-breakpoint
ALTER TABLE "watches" ADD COLUMN IF NOT EXISTS "movement_type" "movement_type_enum";
--> statement-breakpoint
ALTER TABLE "watches" ADD COLUMN IF NOT EXISTS "movement_caliber" text;
--> statement-breakpoint

-- ----- watches_catalog: drop old movement; add 5 new columns -----
ALTER TABLE "watches_catalog" DROP COLUMN IF EXISTS "movement";
--> statement-breakpoint
ALTER TABLE "watches_catalog" ADD COLUMN IF NOT EXISTS "movement_type" "movement_type_enum";
--> statement-breakpoint
ALTER TABLE "watches_catalog" ADD COLUMN IF NOT EXISTS "movement_caliber" text;
--> statement-breakpoint
ALTER TABLE "watches_catalog" ADD COLUMN IF NOT EXISTS "era" "watch_era";
--> statement-breakpoint
ALTER TABLE "watches_catalog" ADD COLUMN IF NOT EXISTS "case_material" text;
--> statement-breakpoint
ALTER TABLE "watches_catalog" ADD COLUMN IF NOT EXISTS "bracelet_config" text;
--> statement-breakpoint

-- ----- watch_lineage_edges table -----
CREATE TABLE IF NOT EXISTS "watch_lineage_edges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "predecessor_catalog_id" uuid NOT NULL,
  "successor_catalog_id" uuid NOT NULL,
  "relationship_type" "lineage_relationship_type" NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "lineage_edges_unique_triple" UNIQUE ("predecessor_catalog_id", "successor_catalog_id", "relationship_type")
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'watch_lineage_edges_predecessor_catalog_id_fk'
      AND conrelid = 'watch_lineage_edges'::regclass
  ) THEN
    ALTER TABLE "watch_lineage_edges"
      ADD CONSTRAINT "watch_lineage_edges_predecessor_catalog_id_fk"
      FOREIGN KEY ("predecessor_catalog_id") REFERENCES "public"."watches_catalog"("id")
      ON DELETE restrict ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'watch_lineage_edges_successor_catalog_id_fk'
      AND conrelid = 'watch_lineage_edges'::regclass
  ) THEN
    ALTER TABLE "watch_lineage_edges"
      ADD CONSTRAINT "watch_lineage_edges_successor_catalog_id_fk"
      FOREIGN KEY ("successor_catalog_id") REFERENCES "public"."watches_catalog"("id")
      ON DELETE restrict ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "watch_lineage_edges_predecessor_idx" ON "watch_lineage_edges" USING btree ("predecessor_catalog_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "watch_lineage_edges_successor_idx"   ON "watch_lineage_edges" USING btree ("successor_catalog_id");
