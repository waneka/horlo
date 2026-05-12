-- Phase 37 — Layer D: Provenance Fields + Divestments Table (Drizzle-side).
-- Idempotent: this migration also runs AFTER supabase db push --linked has applied
--   supabase/migrations/20260511010000_phase37_layer_d.sql (authoritative DDL).
-- Drizzle migration carries column shapes only. No RLS, no GRANT, no DO $$ pre-flight,
-- no trigger, no CREATE TYPE — those live exclusively in the Supabase migration.
-- Per memory rule project_local_db_reset.md, local re-sync runs:
--   supabase db reset → docker exec psql < supabase/migrations/...phase37...sql → drizzle-kit push
-- so every CREATE / ALTER must be IF NOT EXISTS.

-- ----- watches: ADD COLUMN x 7 (D-01..D-08) -----
ALTER TABLE "watches" ADD COLUMN IF NOT EXISTS "serial" text;
--> statement-breakpoint
ALTER TABLE "watches" ADD COLUMN IF NOT EXISTS "year_of_acquisition" integer;
--> statement-breakpoint
ALTER TABLE "watches" ADD COLUMN IF NOT EXISTS "condition" "condition_grade";
--> statement-breakpoint
ALTER TABLE "watches" ADD COLUMN IF NOT EXISTS "box_papers" "box_papers_status";
--> statement-breakpoint
ALTER TABLE "watches" ADD COLUMN IF NOT EXISTS "service_history" text;
--> statement-breakpoint
ALTER TABLE "watches" ADD COLUMN IF NOT EXISTS "paid_currency" "currency_code";
--> statement-breakpoint
ALTER TABLE "watches" ADD COLUMN IF NOT EXISTS "purchase_date" date;
--> statement-breakpoint

-- ----- divestments table (D-09) -----
CREATE TABLE IF NOT EXISTS "divestments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "catalog_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "divested_at" timestamp with time zone DEFAULT now() NOT NULL,
  "replaced_by_catalog_id" uuid,
  "sale_price" real,
  "sale_currency" "currency_code",
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- FK guard 1: divestments.catalog_id → watches_catalog.id ON DELETE RESTRICT
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'divestments_catalog_id_fk'
      AND conrelid = 'divestments'::regclass
  ) THEN
    ALTER TABLE "divestments"
      ADD CONSTRAINT "divestments_catalog_id_fk"
      FOREIGN KEY ("catalog_id") REFERENCES "public"."watches_catalog"("id")
      ON DELETE restrict ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint

-- FK guard 2: divestments.user_id → auth.users.id ON DELETE CASCADE
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'divestments_user_id_fk'
      AND conrelid = 'divestments'::regclass
  ) THEN
    ALTER TABLE "divestments"
      ADD CONSTRAINT "divestments_user_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint

-- FK guard 3: divestments.replaced_by_catalog_id → watches_catalog.id ON DELETE SET NULL
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'divestments_replaced_by_catalog_id_fk'
      AND conrelid = 'divestments'::regclass
  ) THEN
    ALTER TABLE "divestments"
      ADD CONSTRAINT "divestments_replaced_by_catalog_id_fk"
      FOREIGN KEY ("replaced_by_catalog_id") REFERENCES "public"."watches_catalog"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint

-- Indexes
CREATE INDEX IF NOT EXISTS "divestments_user_id_idx" ON "divestments" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "divestments_catalog_id_idx" ON "divestments" USING btree ("catalog_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "divestments_user_divested_at_idx" ON "divestments" USING btree ("user_id", "divested_at");
--> statement-breakpoint
