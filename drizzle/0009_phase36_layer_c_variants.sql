-- Phase 36 — Layer C: watch_variants table + watches.variant_id (Drizzle-side).
-- Idempotent: this migration also runs AFTER supabase db push --linked has applied
--   supabase/migrations/20260511000000_phase36_layer_c_variants.sql (authoritative DDL).
-- Drizzle migration carries column shapes only. No RLS, no GRANT, no DO $$ pre-flight —
-- those live exclusively in the Supabase migration.
-- Per memory rule project_local_db_reset.md, local re-sync runs:
--   supabase db reset → drizzle-kit push → docker exec psql < supabase/migrations/...phase36...sql
-- so every CREATE / ALTER must be IF NOT EXISTS.

-- ----- watch_variants table -----
CREATE TABLE IF NOT EXISTS "watch_variants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "catalog_id" uuid NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "dial_color" text,
  "bezel" text,
  "bracelet_variant" text,
  "image_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "watch_variants_catalog_slug_unique" UNIQUE ("catalog_id", "slug")
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'watch_variants_catalog_id_fk'
      AND conrelid = 'watch_variants'::regclass
  ) THEN
    ALTER TABLE "watch_variants"
      ADD CONSTRAINT "watch_variants_catalog_id_fk"
      FOREIGN KEY ("catalog_id") REFERENCES "public"."watches_catalog"("id")
      ON DELETE restrict ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "watch_variants_catalog_id_idx" ON "watch_variants" USING btree ("catalog_id");
--> statement-breakpoint

-- ----- watches: ADD COLUMN variant_id (D-04) -----
ALTER TABLE "watches" ADD COLUMN IF NOT EXISTS "variant_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'watches_variant_id_fk'
      AND conrelid = 'watches'::regclass
  ) THEN
    ALTER TABLE "watches"
      ADD CONSTRAINT "watches_variant_id_fk"
      FOREIGN KEY ("variant_id") REFERENCES "public"."watch_variants"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "watches_variant_id_idx" ON "watches" USING btree ("variant_id");
--> statement-breakpoint

-- ----- watches.catalog_id: CAT-14 NOT NULL flip (idempotent — no-op if already NOT NULL) -----
-- Per RESEARCH.md §Assumption A1, SET NOT NULL on an already-NOT-NULL column is a no-op in
-- Postgres. This statement only does work if drizzle-kit runs against a fresh local DB
-- where the Supabase Phase 36 migration has NOT yet been applied.
ALTER TABLE "watches" ALTER COLUMN "catalog_id" SET NOT NULL;
