-- Phase 19.1 — drizzle-side schema: taste enrichment columns on watches_catalog.
-- Ported from drizzle/0005_phase19_1_taste_columns.sql so prod can apply via supabase db push --linked.
-- Idempotent: ADD COLUMN IF NOT EXISTS for all 8 columns.
-- Locally these columns already exist (drizzle-kit push); this migration is a no-op there.

ALTER TABLE "watches_catalog" ADD COLUMN IF NOT EXISTS "formality" numeric(3, 2);
ALTER TABLE "watches_catalog" ADD COLUMN IF NOT EXISTS "sportiness" numeric(3, 2);
ALTER TABLE "watches_catalog" ADD COLUMN IF NOT EXISTS "heritage_score" numeric(3, 2);
ALTER TABLE "watches_catalog" ADD COLUMN IF NOT EXISTS "primary_archetype" text;
ALTER TABLE "watches_catalog" ADD COLUMN IF NOT EXISTS "era_signal" text;
ALTER TABLE "watches_catalog" ADD COLUMN IF NOT EXISTS "design_motifs" text[] DEFAULT '{}'::text[] NOT NULL;
ALTER TABLE "watches_catalog" ADD COLUMN IF NOT EXISTS "confidence" numeric(3, 2);
ALTER TABLE "watches_catalog" ADD COLUMN IF NOT EXISTS "extracted_from_photo" boolean DEFAULT false NOT NULL;
